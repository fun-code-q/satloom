import { getFirebaseDatabase } from "@/lib/firebase"
import { ref, push, set, onValue, remove, onChildAdded } from "firebase/database"
import { SecurityUtils } from "./security-utils"
import { WEBRTC_CONFIG } from "@/lib/webrtc"

export interface P2PFileMetadata {
    id: string
    name: string
    size: number
    type: string
    senderId: string
    roomId: string
    encrypted: boolean
}

export interface TransferProgress {
    percentage: number
    status: "connecting" | "transferring" | "completed" | "error"
    error?: string
}

export class P2PFileTransfer {
    private static instance: P2PFileTransfer
    private peerConnections: Map<string, RTCPeerConnection> = new Map() // peerId_fileId -> PC
    private files: Map<string, File> = new Map()
    private currentUserId: string = ""
    private roomId: string = ""
    private iceCandidateBuffers: Map<string, RTCIceCandidateInit[]> = new Map()

    static getInstance(): P2PFileTransfer {
        if (!P2PFileTransfer.instance) {
            P2PFileTransfer.instance = new P2PFileTransfer()
        }
        return P2PFileTransfer.instance
    }

    initialize(roomId: string, userId: string) {
        this.roomId = roomId
        this.currentUserId = userId
        this.listenForSignals()
    }

    registerFile(file: File): string {
        const fileId = `p2p_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        this.files.set(fileId, file)
        return fileId
    }

    getFileMetadata(fileId: string): P2PFileMetadata | null {
        const file = this.files.get(fileId)
        if (!file) return null

        return {
            id: fileId,
            name: file.name,
            size: file.size,
            type: file.type,
            senderId: this.currentUserId,
            roomId: this.roomId,
            encrypted: true 
        }
    }

    private listenForSignals() {
        const db = getFirebaseDatabase()
        if (!db || !this.roomId || !this.currentUserId) return

        const signalsRef = ref(db, `rooms/${this.roomId}/p2pSignals/${this.currentUserId}`)
        onChildAdded(signalsRef, async (snapshot) => {
            const signal = snapshot.val()
            const signalId = snapshot.key
            if (!signal) return

            const { fromUserId, type, payload, fileId } = signal
            const connectionKey = `${fromUserId}_${fileId}`

            if (type === "request") {
                await this.handleFileRequest(fromUserId, fileId)
            } else if (type === "offer") {
                // This handles the offer for a file the user requested
                await this.handleOffer(fromUserId, fileId, payload)
            } else if (type === "answer") {
                await this.handleOfferAnswer(connectionKey, payload)
            } else if (type === "candidate") {
                await this.addIceCandidate(connectionKey, payload)
            }

            remove(ref(db, `rooms/${this.roomId}/p2pSignals/${this.currentUserId}/${signalId}`))
        })
    }

    private async sendSignal(toUserId: string, type: string, payload: any, fileId: string) {
        if (!getFirebaseDatabase()) return
        const signalRef = ref(getFirebaseDatabase()!, `rooms/${this.roomId}/p2pSignals/${toUserId}`)
        await push(signalRef, {
            fromUserId: this.currentUserId,
            type,
            payload,
            fileId,
            timestamp: Date.now()
        })
    }

    // -- SENDER LOGIC --

    private async handleFileRequest(fromUserId: string, fileId: string) {
        const file = this.files.get(fileId)
        if (!file) return

        const connectionKey = `${fromUserId}_${fileId}`
        const pc = this.createPeerConnection(fromUserId, fileId)
        const dc = pc.createDataChannel(`fileTransfer_${fileId}`)

        dc.onopen = () => {
            this.sendChunks(dc, file)
        }

        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        await this.sendSignal(fromUserId, "offer", offer, fileId)
    }

    private async sendChunks(dc: RTCDataChannel, file: File) {
        const CHUNK_SIZE = 16384 // 16KB
        const reader = new FileReader()
        let offset = 0

        const readNext = () => {
            if (dc.readyState !== "open") return
            
            // Handle backpressure
            if (dc.bufferedAmount > CHUNK_SIZE * 2) {
                setTimeout(readNext, 1)
                return
            }

            const slice = file.slice(offset, offset + CHUNK_SIZE)
            reader.readAsArrayBuffer(slice)
        }

        reader.onload = (e) => {
            const result = e.target?.result as ArrayBuffer
            try {
                dc.send(result)
                offset += result.byteLength

                if (offset < file.size) {
                    readNext()
                } else {
                    dc.send("EOF")
                }
            } catch (err) {
                console.error("DataChannel send failed:", err)
            }
        }

        readNext()
    }

    // -- RECEIVER LOGIC --

    private async handleOffer(fromUserId: string, fileId: string, offer: any) {
        const connectionKey = `${fromUserId}_${fileId}`
        let pc = this.peerConnections.get(connectionKey)
        
        // If we requested the file, the PC might already exist
        if (!pc) {
            pc = this.createPeerConnection(fromUserId, fileId)
        }

        await pc.setRemoteDescription(new RTCSessionDescription(offer))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        await this.sendSignal(fromUserId, "answer", answer, fileId)
        
        await this.processIceBuffer(connectionKey)
    }

    async requestFile(senderId: string, fileId: string, expectedSize: number, onProgress: (progress: TransferProgress) => void): Promise<Blob> {
        return new Promise(async (resolve, reject) => {
            const connectionKey = `${senderId}_${fileId}`
            const pc = this.createPeerConnection(senderId, fileId)
            let receivedChunks: ArrayBuffer[] = []
            let receivedSize = 0

            pc.ondatachannel = (event) => {
                const dc = event.channel
                dc.onmessage = (e) => {
                    if (e.data === "EOF") {
                        const blob = new Blob(receivedChunks)
                        onProgress({ percentage: 100, status: "completed" })
                        resolve(blob)
                        this.cleanup(connectionKey)
                    } else if (typeof e.data !== "string") {
                        receivedChunks.push(e.data)
                        receivedSize += e.data.byteLength
                        const percentage = Math.round((receivedSize / expectedSize) * 100)
                        onProgress({ percentage, status: "transferring" })
                    }
                }

                dc.onerror = (err) => {
                    reject(err)
                    onProgress({ percentage: 0, status: "error", error: "Transfer interrupted" })
                }
            }

            await this.sendSignal(senderId, "request", {}, fileId)
            onProgress({ percentage: 0, status: "connecting" })

            // Timeout if no connection after 30s
            setTimeout(() => {
                const currentPC = this.peerConnections.get(connectionKey)
                if (currentPC && receivedSize === 0 && currentPC.iceConnectionState !== "connected" && currentPC.iceConnectionState !== "completed") {
                    this.cleanup(connectionKey)
                    reject(new Error("Connecting timeout"))
                }
            }, 30000)
        })
    }

    // -- SHARED HELPERS --

    private createPeerConnection(peerId: string, fileId: string): RTCPeerConnection {
        const connectionKey = `${peerId}_${fileId}`
        const pc = new RTCPeerConnection(WEBRTC_CONFIG)

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendSignal(peerId, "candidate", event.candidate, fileId)
            }
        }

        pc.onconnectionstatechange = () => {
            console.log(`P2P File Transfer [${fileId}] State:`, pc.connectionState)
            if (pc.connectionState === "failed" || pc.connectionState === "closed") {
                this.cleanup(connectionKey)
            }
        }

        this.peerConnections.set(connectionKey, pc)
        this.iceCandidateBuffers.set(connectionKey, [])
        return pc
    }

    private async handleOfferAnswer(connectionKey: string, answer: any) {
        const pc = this.peerConnections.get(connectionKey)
        if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(answer))
            await this.processIceBuffer(connectionKey)
        }
    }

    private async addIceCandidate(connectionKey: string, candidate: any) {
        const pc = this.peerConnections.get(connectionKey)
        if (!pc) return

        if (!pc.remoteDescription) {
            const buffer = this.iceCandidateBuffers.get(connectionKey) || []
            buffer.push(candidate)
            this.iceCandidateBuffers.set(connectionKey, buffer)
            return
        }

        try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate))
        } catch (e) {
            console.error("Error adding P2P ICE candidate:", e)
        }
    }

    private async processIceBuffer(connectionKey: string) {
        const pc = this.peerConnections.get(connectionKey)
        const buffer = this.iceCandidateBuffers.get(connectionKey)
        if (!pc || !pc.remoteDescription || !buffer) return

        while (buffer.length > 0) {
            const candidate = buffer.shift()
            if (candidate) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate))
                } catch (e) {
                    console.error("Error adding buffered P2P ICE candidate:", e)
                }
            }
        }
    }

    private cleanup(connectionKey: string) {
        const pc = this.peerConnections.get(connectionKey)
        if (pc) {
            pc.close()
            this.peerConnections.delete(connectionKey)
        }
        this.iceCandidateBuffers.delete(connectionKey)
    }
}

export const p2pFileTransfer = P2PFileTransfer.getInstance()
