export class WebRTCManager {
    private static instance: WebRTCManager
    private peerConnections: Map<string, RTCPeerConnection> = new Map()
    private localStream: MediaStream | null = null
    private remoteStreams: Map<string, MediaStream> = new Map()

    private onRemoteStream: ((stream: MediaStream, userId: string) => void) | null = null
    private onIceCandidate: ((candidate: RTCIceCandidate, userId: string) => void) | null = null
    private isCleanupInProgress = false
    private onStateChange: ((state: RTCPeerConnectionState, userId: string) => void) | null = null
    private iceCandidateBuffers: Map<string, RTCIceCandidateInit[]> = new Map()

    private config: RTCConfiguration = {
        iceServers: this.getIceServers(),
        iceCandidatePoolSize: 10,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
    }

    private getIceServers(): RTCIceServer[] {
        const servers: RTCIceServer[] = []
        const stunServers = [
            process.env.NEXT_PUBLIC_STUN_SERVER_1,
            process.env.NEXT_PUBLIC_STUN_SERVER_2,
            process.env.NEXT_PUBLIC_STUN_SERVER_3,
            process.env.NEXT_PUBLIC_STUN_SERVER_4,
            process.env.NEXT_PUBLIC_STUN_SERVER_5,
            process.env.NEXT_PUBLIC_STUN_SERVER_6,
            process.env.NEXT_PUBLIC_STUN_SERVER_7,
            process.env.NEXT_PUBLIC_STUN_SERVER_8,
        ].filter(Boolean) as string[]

        stunServers.forEach(url => {
            servers.push({ urls: url })
        })

        const turnConfigs = [
            {
                url: process.env.NEXT_PUBLIC_TURN_SERVER_1,
                username: process.env.NEXT_PUBLIC_TURN_USERNAME_1,
                credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL_1,
            },
            {
                url: process.env.NEXT_PUBLIC_TURN_SERVER_2,
                username: process.env.NEXT_PUBLIC_TURN_USERNAME_2,
                credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL_2,
            },
            {
                url: process.env.NEXT_PUBLIC_TURN_SERVER_3,
                username: process.env.NEXT_PUBLIC_TURN_USERNAME_3,
                credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL_3,
            },
        ]

        turnConfigs.forEach(config => {
            if (config.url && config.username && config.credential) {
                servers.push({
                    urls: config.url,
                    username: config.username,
                    credential: config.credential,
                })
            }
        })

        if (servers.length === 0) {
            // High-reliability fallbacks - mix of Google and public STUN/TURN
            servers.push(
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' },
                // Fallback public TURN from OpenRelay (sometimes works as fallback even without fresh credentials if using default ones)
                {
                    urls: 'turn:openrelay.metered.ca:80',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                },
                {
                    urls: 'turn:openrelay.metered.ca:443',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                }
            )
        }

        console.log(`WebRTC: Initialized with ${servers.length} ICE servers`)
        return servers
    }

    static getInstance(): WebRTCManager {
        if (!WebRTCManager.instance) {
            WebRTCManager.instance = new WebRTCManager()
        }
        return WebRTCManager.instance
    }

    get getLocalStream() {
        return this.localStream
    }

    getRemoteStream(userId: string) {
        return this.remoteStreams.get(userId)
    }

    initialize(
        targetUserId: string,
        localStream: MediaStream,
        onRemoteStream: (stream: MediaStream, userId: string) => void,
        onIceCandidate: (candidate: RTCIceCandidate, userId: string) => void,
        onStateChange?: (state: RTCPeerConnectionState, userId: string) => void
    ) {
        if (this.isCleanupInProgress) return

        this.localStream = localStream
        this.onRemoteStream = onRemoteStream
        this.onIceCandidate = onIceCandidate
        this.onStateChange = onStateChange || null

        if (this.peerConnections.has(targetUserId)) {
            console.log(`WebRTCManager: Connection to ${targetUserId} already exists`)
            return
        }

        const pc = new RTCPeerConnection(this.config)
        this.peerConnections.set(targetUserId, pc)

        // Add local tracks
        this.localStream.getTracks().forEach(track => {
            pc.addTrack(track, this.localStream!)
        })

        // Handle remote tracks
        pc.ontrack = (event) => {
            console.log(`[WebRTC] Received remote track: ${event.track.kind}`)
            let stream = event.streams[0]
            if (!stream) {
                // Fallback: build stream manually if not provided by browser
                stream = this.remoteStreams.get(targetUserId) || new MediaStream()
                if (!stream.getTracks().some(t => t.id === event.track.id)) {
                    stream.addTrack(event.track)
                }
            }

            this.remoteStreams.set(targetUserId, stream)
            if (this.onRemoteStream) {
                this.onRemoteStream(stream, targetUserId)
            }
        }

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate && this.onIceCandidate) {
                this.onIceCandidate(event.candidate, targetUserId)
            }
        }

        // Connection state logging
        pc.onconnectionstatechange = () => {
            const state = pc.connectionState
            console.log(`[WebRTC] Connection ${targetUserId} State:`, state)
            if (this.onStateChange) this.onStateChange(state, targetUserId)
        }

        this.iceCandidateBuffers.set(targetUserId, [])
    }

    async createOffer(targetUserId: string): Promise<RTCSessionDescriptionInit> {
        const pc = this.peerConnections.get(targetUserId)
        if (!pc) throw new Error(`No PC for user ${targetUserId}`)

        const offer = await pc.createOffer()
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

    async startScreenShare(): Promise<MediaStream | null> {
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: "always" } as any,
                audio: false
            })

            const videoTrack = screenStream.getVideoTracks()[0]

            // Replace track in all connections
            for (const pc of this.peerConnections.values()) {
                const sender = pc.getSenders().find(s => s.track?.kind === 'video')
                if (sender) await sender.replaceTrack(videoTrack)
            }

            videoTrack.onended = () => this.stopScreenShare()
            return screenStream
        } catch (error) {
            console.error("Error starting screen share:", error)
            return null
        }
    }

    async stopScreenShare(originalStream?: MediaStream) {
        let streamToRevertTo = originalStream || this.localStream
        if (!streamToRevertTo || !streamToRevertTo.active) {
            try {
                streamToRevertTo = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            } catch (e) {
                return
            }
        }

        const videoTrack = streamToRevertTo.getVideoTracks()[0]
        for (const pc of this.peerConnections.values()) {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video')
            if (sender && videoTrack) await sender.replaceTrack(videoTrack)
        }

        this.localStream = streamToRevertTo
        return streamToRevertTo
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

            if (this.localStream) {
                this.localStream.getTracks().forEach(track => track.stop())
                this.localStream = null
            }
            this.onRemoteStream = null
            this.onIceCandidate = null
            this.onStateChange = null
        }
    }

    async getDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices()
            return devices.filter(device => device.kind === "audioinput" || device.kind === "videoinput")
        } catch (error) {
            return []
        }
    }

    async switchMicrophone(deviceId: string) {
        try {
            const newStream = await navigator.mediaDevices.getUserMedia({
                audio: { deviceId: { exact: deviceId } },
                video: false
            })
            const audioTrack = newStream.getAudioTracks()[0]

            for (const pc of this.peerConnections.values()) {
                const sender = pc.getSenders().find(s => s.track?.kind === 'audio')
                if (sender) await sender.replaceTrack(audioTrack)
            }

            if (this.localStream) {
                const oldTrack = this.localStream.getAudioTracks()[0]
                if (oldTrack) oldTrack.stop()
                this.localStream.removeTrack(oldTrack)
                this.localStream.addTrack(audioTrack)
            }
        } catch (error) {
            console.error("Error switching microphone:", error)
        }
    }

    async replaceAudioTrack(newAudioTrack: MediaStreamTrack) {
        for (const pc of this.peerConnections.values()) {
            const sender = pc.getSenders().find(s => s.track?.kind === 'audio')
            if (sender) await sender.replaceTrack(newAudioTrack)
        }
    }

    async switchCamera(newStreamOrDeviceId: MediaStream | string) {
        let newStream: MediaStream
        if (typeof newStreamOrDeviceId === 'string') {
            try {
                newStream = await navigator.mediaDevices.getUserMedia({
                    video: { deviceId: { exact: newStreamOrDeviceId } },
                    audio: true
                })
            } catch (e) {
                return
            }
        } else {
            newStream = newStreamOrDeviceId
        }

        const videoTrack = newStream.getVideoTracks()[0]
        if (!videoTrack) return

        for (const pc of this.peerConnections.values()) {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video')
            if (sender) await sender.replaceTrack(videoTrack)
        }

        if (this.localStream) {
            const oldVideoTrack = this.localStream.getVideoTracks()[0]
            if (oldVideoTrack) {
                oldVideoTrack.stop()
                this.localStream.removeTrack(oldVideoTrack)
            }
            this.localStream.addTrack(videoTrack)
        } else {
            this.localStream = newStream
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
                    const lost = report.packetsLost || 0
                    const received = report.packetsReceived || 0
                    if (lost + received > 0) packetLoss = (lost / (lost + received)) * 100
                    jitter = (report.jitter || 0) * 1000
                }
                if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                    rtt = (report.currentRoundTripTime || 0) * 1000
                }
            })

            return { packetLoss, rtt, jitter }
        } catch (error) {
            return null
        }
    }
}
