import { WEBRTC_CONFIG } from "@/lib/webrtc"

export class WebRTCManager {
    private static instance: WebRTCManager
    private peerConnections: Map<string, RTCPeerConnection> = new Map()
    private localStreams: Map<string, MediaStream> = new Map() // trackIdx -> Stream
    private remoteStreams: Map<string, Map<string, MediaStream>> = new Map() // userId -> (label -> Stream)

    private onRemoteStreamListeners: Set<(stream: MediaStream, userId: string, label: string) => void> = new Set()
    private onIceCandidate: ((candidate: RTCIceCandidate, userId: string) => void) | null = null
    private isCleanupInProgress = false
    private onStateChange: ((state: RTCPeerConnectionState, userId: string) => void) | null = null
    private iceCandidateBuffers: Map<string, RTCIceCandidateInit[]> = new Map()

    private config: RTCConfiguration = WEBRTC_CONFIG

    static getInstance(): WebRTCManager {
        if (!WebRTCManager.instance) {
            WebRTCManager.instance = new WebRTCManager()
        }
        return WebRTCManager.instance
    }

    addRemoteStreamListener(listener: (stream: MediaStream, userId: string, label: string) => void) {
        this.onRemoteStreamListeners.add(listener)
    }

    removeRemoteStreamListener(listener: (stream: MediaStream, userId: string, label: string) => void) {
        this.onRemoteStreamListeners.delete(listener)
    }

    getRemoteStream(userId: string, label: string = "default") {
        return this.remoteStreams.get(userId)?.get(label)
    }

    initialize(
        targetUserId: string,
        localStream: MediaStream,
        onRemoteStream: (stream: MediaStream, userId: string, label: string) => void,
        onIceCandidate: (candidate: RTCIceCandidate, userId: string) => void,
        onStateChange?: (state: RTCPeerConnectionState, userId: string) => void,
        label: string = "default"
    ) {
        if (this.isCleanupInProgress) return

        this.onRemoteStreamListeners.add(onRemoteStream)
        this.onIceCandidate = onIceCandidate
        this.onStateChange = onStateChange || null

        let pc = this.peerConnections.get(targetUserId)

        if (pc) {
            console.log(`WebRTCManager: Connection to ${targetUserId} already exists, updating tracks for label [${label}]...`)
            
            // Add or update tracks from this stream
            localStream.getTracks().forEach(track => {
                // We use stream id as a way to group tracks
                const sender = pc!.getSenders().find(s => s.track?.id === track.id)
                if (!sender) {
                    pc!.addTrack(track, localStream)
                }
            })
            return
        }

        pc = new RTCPeerConnection(this.config)
        this.peerConnections.set(targetUserId, pc)

        // Add local tracks
        localStream.getTracks().forEach(track => {
            pc!.addTrack(track, localStream)
        })

        // Handle remote tracks
        pc.ontrack = (event) => {
            console.log(`[WebRTC] Received remote track: ${event.track.kind} for ${targetUserId}`)
            const stream = event.streams[0] || new MediaStream([event.track])
            
            // Determine label from stream metadata if possible, or fallback to default
            // In a better system, we'd negotiate labels via DataChannel
            const streamLabel = stream.id.includes("theater") ? "theater" : "default"

            let userStreams = this.remoteStreams.get(targetUserId)
            if (!userStreams) {
                userStreams = new Map()
                this.remoteStreams.set(targetUserId, userStreams)
            }
            userStreams.set(streamLabel, stream)

            this.onRemoteStreamListeners.forEach(listener => {
                listener(stream, targetUserId, streamLabel)
            })
        }

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate && this.onIceCandidate) {
                this.onIceCandidate(event.candidate, targetUserId)
            }
        }

        // Connection state logging
        pc.onconnectionstatechange = () => {
            const state = pc!.connectionState
            console.log(`[WebRTC] Connection ${targetUserId} State:`, state)
            if (this.onStateChange) this.onStateChange(state, targetUserId)
        }

        this.iceCandidateBuffers.set(targetUserId, [])
    }

    async createOffer(targetUserId: string): Promise<RTCSessionDescriptionInit> {
        const pc = this.peerConnections.get(targetUserId)
        if (!pc) throw new Error(`No PC for user ${targetUserId}`)

        const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
        })
        await pc.setLocalDescription(offer)
        return offer
    }

    async createAnswer(targetUserId: string, remoteOffer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
        const pc = this.peerConnections.get(targetUserId)
        if (!pc) throw new Error(`No PC for user ${targetUserId}`)

        await pc.setRemoteDescription(new RTCSessionDescription(remoteOffer))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        await this.processIceBuffer(targetUserId)
        return answer
    }

    async handleAnswer(targetUserId: string, remoteAnswer: RTCSessionDescriptionInit) {
        const pc = this.peerConnections.get(targetUserId)
        if (!pc || pc.signalingState === "stable") return

        await pc.setRemoteDescription(new RTCSessionDescription(remoteAnswer))
        await this.processIceBuffer(targetUserId)
    }

    async addIceCandidate(targetUserId: string, candidate: RTCIceCandidateInit) {
        const pc = this.peerConnections.get(targetUserId)
        if (!pc) return

        if (!pc.remoteDescription) {
            const buffer = this.iceCandidateBuffers.get(targetUserId) || []
            buffer.push(candidate)
            this.iceCandidateBuffers.set(targetUserId, buffer)
            return
        }

        try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate))
        } catch (e) {
            console.error(`Error adding ICE to ${targetUserId}:`, e)
        }
    }

    private async processIceBuffer(targetUserId: string) {
        const pc = this.peerConnections.get(targetUserId)
        const buffer = this.iceCandidateBuffers.get(targetUserId)
        if (!pc || !pc.remoteDescription || !buffer) return

        while (buffer.length > 0) {
            const candidate = buffer.shift()
            if (candidate) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate))
                } catch (e) {
                    console.error(`Error adding buffered ICE to ${targetUserId}:`, e)
                }
            }
        }
    }

    async replaceAudioTrack(newAudioTrack: MediaStreamTrack | null) {
        for (const pc of this.peerConnections.values()) {
            // Replaces the track for the "default" (voice) stream
            // We find the sender that is NOT part of a high-bandwidth video stream if possible
            const senders = pc.getSenders().filter(s => s.track?.kind === 'audio')
            for (const sender of senders) {
                // Heuristic: theater tracks usually have a different id or are attached to theater streams
                // For now, replace all audio tracks that aren't theater-labeled if we had labels
                await sender.replaceTrack(newAudioTrack)
            }
        }
    }

    async switchMicrophone(deviceId: string) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId } } })
            const track = stream.getAudioTracks()[0]
            if (track) await this.replaceAudioTrack(track)
        } catch (err) {
            console.error("Error switching microphone:", err)
        }
    }

    async switchCamera(newStream: MediaStream) {
        const videoTrack = newStream.getVideoTracks()[0]
        if (!videoTrack) return

        for (const pc of this.peerConnections.values()) {
            const senders = pc.getSenders()
            const videoSender = senders.find(s => s.track?.kind === "video")
            if (videoSender) {
                try {
                    await videoSender.replaceTrack(videoTrack)
                } catch (err) {
                    console.error("Error replacing video track for peer:", err)
                }
            }
        }
    }

    async getConnectionStats(targetUserId: string) {
        const pc = this.peerConnections.get(targetUserId)
        if (!pc) return null

        try {
            const stats = await pc.getStats()
            let packetLoss = 0
            let rtt = 0
            let jitter = 0

            stats.forEach(report => {
                if (report.type === 'inbound-rtp' && report.kind === 'video') {
                    packetLoss = report.packetsLost || 0
                    jitter = report.jitter || 0
                } else if (report.type === 'remote-outbound-rtp') {
                    rtt = report.roundTripTime || 0
                }
            })

            return { packetLoss, rtt, jitter }
        } catch (err) {
            console.error("Error getting connection stats:", err)
            return null
        }
    }

    async startScreenShare() {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
            const track = stream.getVideoTracks()[0]
            if (track) {
                for (const pc of this.peerConnections.values()) {
                    const senders = pc.getSenders()
                    const videoSender = senders.find(s => s.track?.kind === "video")
                    if (videoSender) {
                        await videoSender.replaceTrack(track)
                    }
                }
            }
            return stream
        } catch (err) {
            console.error("Error starting screen share:", err)
            return null
        }
    }

    async stopScreenShare(cameraStream?: MediaStream) {
        if (!cameraStream) return null
        const track = cameraStream.getVideoTracks()[0]
        if (track) {
            for (const pc of this.peerConnections.values()) {
                const senders = pc.getSenders()
                const videoSender = senders.find(s => s.track?.kind === "video")
                if (videoSender) {
                    await videoSender.replaceTrack(track)
                }
            }
        }
        return cameraStream
    }

    cleanup(targetUserId?: string) {
        if (targetUserId) {
            const pc = this.peerConnections.get(targetUserId)
            if (pc) {
                pc.close()
                this.peerConnections.delete(targetUserId)
                this.remoteStreams.delete(targetUserId)
                this.iceCandidateBuffers.delete(targetUserId)
            }
        } else {
            this.peerConnections.forEach(pc => pc.close())
            this.peerConnections.clear()
            this.remoteStreams.clear()
            this.iceCandidateBuffers.clear()
            this.onRemoteStreamListeners.clear()
        }
    }
}

