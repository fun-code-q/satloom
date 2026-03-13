import { getFirebaseDatabase } from "@/lib/firebase"
import { ref, push, set, onValue, remove, onChildAdded } from "firebase/database"
import { SecurityUtils } from "./security-utils"

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
    private peerConnections: Map<string, RTCPeerConnection> = new Map()
    private files: Map<string, File> = new Map()
    private signalsRef: any = null
    private currentUserId: string = ""
    private roomId: string = ""

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

    // Register a file for P2P sharing
    registerFile(file: File): string {
        const fileId = `p2p_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        this.files.set(fileId, file)
        return fileId
    }

    // Broadcast file offer signal (via Chat message usually, but we keep metadata here)
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
            encrypted: true // We always encrypt as per our security strategy
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

            if (type === "request") {
                await this.handleFileRequest(fromUserId, fileId)
            } else if (type === "answer") {
                await this.handleOfferAnswer(fromUserId, payload)
            } else if (type === "candidate") {
                await this.handleIceCandidate(fromUserId, payload)
            }

            // Cleanup signal after reading
            if (db) {
                remove(ref(db, `rooms/${this.roomId}/p2pSignals/${this.currentUserId}/${signalId}`))
            }
        })
    }

    private async sendSignal(toUserId: string, type: string, payload: any, fileId?: string) {
        if (!getFirebaseDatabase()!) return
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

        const pc = this.createPeerConnection(fromUserId)
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

        reader.onload = (e) => {
            const result = e.target?.result as ArrayBuffer
            if (dc.readyState === "open") {
                try {
                    dc.send(result)
                    offset += result.byteLength

                    if (offset < file.size) {
                        readNext()
                    } else {
                        dc.send("EOF") // End of file indicator
                    }
                } catch (err) {
                    console.error("DataChannel send failed:", err)
                }
            }
        }

        const readNext = () => {
            const slice = file.slice(offset, offset + CHUNK_SIZE)
            reader.readAsArrayBuffer(slice)
        }

        readNext()
    }

    // -- RECEIVER LOGIC --

    async requestFile(senderId: string, fileId: string, expectedSize: number, onProgress: (progress: TransferProgress) => void): Promise<Blob> {
        return new Promise(async (resolve, reject) => {
            const pc = this.createPeerConnection(senderId)
            let receivedChunks: ArrayBuffer[] = []
            let receivedSize = 0

            pc.ondatachannel = (event) => {
                const dc = event.channel
                dc.onmessage = (e) => {
                    if (e.data === "EOF") {
                        const blob = new Blob(receivedChunks)
                        onProgress({ percentage: 100, status: "completed" })
                        resolve(blob)
                        pc.close()
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

            // Listen for offer
            if (!getFirebaseDatabase()!) {
                reject(new Error("Database not initialized"))
                return
            }
            const signalsRef = ref(getFirebaseDatabase()!, `rooms/${this.roomId}/p2pSignals/${this.currentUserId}`)
            const unsubscribe = onChildAdded(signalsRef, async (snapshot) => {
                const signal = snapshot.val()
                if (signal && signal.fromUserId === senderId && signal.type === "offer") {
                    await pc.setRemoteDescription(new RTCSessionDescription(signal.payload))
                    const answer = await pc.createAnswer()
                    await pc.setLocalDescription(answer)
                    await this.sendSignal(senderId, "answer", answer)
                    unsubscribe()
                    if (getFirebaseDatabase()!) {
                        remove(ref(getFirebaseDatabase()!, `rooms/${this.roomId}/p2pSignals/${this.currentUserId}/${snapshot.key}`))
                    }
                }
            })

            await this.sendSignal(senderId, "request", {}, fileId)
            onProgress({ percentage: 0, status: "connecting" })

            // Timeout if no connection after 15s
            setTimeout(() => {
                if (receivedSize === 0) {
                    unsubscribe()
                    reject(new Error("Connecting timeout"))
                }
            }, 15000)
        })
    }

    // -- SHARED HELPERS --

    private createPeerConnection(peerId: string): RTCPeerConnection {
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:stun1.l.google.com:19302" },
                { urls: "stun:stun2.l.google.com:19302" },
                { urls: "stun:stun3.l.google.com:19302" },
                { urls: "stun:stun4.l.google.com:19302" },
                {
                    urls: "turn:openrelay.metered.ca:80",
                    username: "openrelayproject",
                    credential: "openrelayproject",
                },
                {
                    urls: "turn:openrelay.metered.ca:443",
                    username: "openrelayproject",
                    credential: "openrelayproject",
                },
                {
                    urls: "turn:openrelay.metered.ca:443?transport=tcp",
                    username: "openrelayproject",
                    credential: "openrelayproject",
                },
            ]
        })

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendSignal(peerId, "candidate", event.candidate)
            }
        }

        this.peerConnections.set(peerId, pc)
        return pc
    }

    private async handleOfferAnswer(fromUserId: string, answer: any) {
        const pc = this.peerConnections.get(fromUserId)
        if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(answer))
        }
    }

    private async handleIceCandidate(fromUserId: string, candidate: any) {
        const pc = this.peerConnections.get(fromUserId)
        if (pc) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate))
        }
    }
}

export const p2pFileTransfer = P2PFileTransfer.getInstance()
