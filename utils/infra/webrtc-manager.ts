export class WebRTCManager {
    private static instance: WebRTCManager
    private peerConnection: RTCPeerConnection | null = null
    private localStream: MediaStream | null = null
    private remoteStream: MediaStream | null = null

    private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null
    private onIceCandidateCallback: ((candidate: RTCIceCandidate) => void) | null = null

    private config: RTCConfiguration = {
        iceServers: this.getIceServers(),
        iceCandidatePoolSize: 10,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
    }

    /**
     * Get ICE servers from environment variables with fallback to defaults
     */
    private getIceServers(): RTCIceServer[] {
        const servers: RTCIceServer[] = []

        // Add STUN servers from environment
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

        // Add each STUN server
        stunServers.forEach(url => {
            servers.push({ urls: url })
        })

        // Add TURN servers with credentials
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

        // Fallback to Google STUN if no servers configured
        if (servers.length === 0) {
            console.warn('No ICE servers configured, using fallback Google STUN')
            servers.push(
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            )
        }

        console.log(`WebRTC configured with ${servers.length} ICE servers`)
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

    get getRemoteStream() {
        return this.remoteStream
    }

    initialize(
        localStream: MediaStream,
        onRemoteStream: (stream: MediaStream) => void,
        onIceCandidate: (candidate: RTCIceCandidate) => void
    ) {
        if (this.peerConnection) {
            console.warn("WebRTCManager already initialized, cleaning up first")
            this.cleanup()
        }

        this.localStream = localStream
        this.onRemoteStreamCallback = onRemoteStream
        this.onIceCandidateCallback = onIceCandidate

        this.peerConnection = new RTCPeerConnection(this.config)

        // Add local tracks to connection
        this.localStream.getTracks().forEach(track => {
            if (this.peerConnection && this.localStream) {
                this.peerConnection.addTrack(track, this.localStream)
            }
        })

        // Handle remote tracks
        this.peerConnection.ontrack = (event) => {
            if (event.streams && event.streams[0]) {
                this.remoteStream = event.streams[0]
                if (this.onRemoteStreamCallback) {
                    this.onRemoteStreamCallback(this.remoteStream)
                }
            }
        }

        // Handle ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && this.onIceCandidateCallback) {
                this.onIceCandidateCallback(event.candidate)
            }
        }

        // Connection state logging
        this.peerConnection.onconnectionstatechange = () => {
            console.log("WebRTC Connection State:", this.peerConnection?.connectionState)
        }
    }

    async createOffer(): Promise<RTCSessionDescriptionInit> {
        if (!this.peerConnection) throw new Error("PeerConnection not initialized")

        const offer = await this.peerConnection.createOffer()
        await this.peerConnection.setLocalDescription(offer)
        return offer
    }

    async createAnswer(remoteOffer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
        if (!this.peerConnection) throw new Error("PeerConnection not initialized")

        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(remoteOffer))
        const answer = await this.peerConnection.createAnswer()
        await this.peerConnection.setLocalDescription(answer)
        return answer
    }

    async handleAnswer(remoteAnswer: RTCSessionDescriptionInit) {
        if (!this.peerConnection) throw new Error("PeerConnection not initialized")
        // Avoid setting if already set or stable to prevent errors in some race conditions
        if (this.peerConnection.signalingState === "stable") return

        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(remoteAnswer))
    }

    async addIceCandidate(candidate: RTCIceCandidateInit) {
        if (!this.peerConnection) return

        try {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
        } catch (e) {
            console.error("Error adding ICE candidate:", e)
        }
    }

    async startScreenShare(): Promise<MediaStream | null> {
        if (!this.peerConnection) return null

        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: "always" } as any,
                audio: false
            })

            const videoTrack = screenStream.getVideoTracks()[0]

            // Replace the video track in the peer connection
            const sender = this.peerConnection.getSenders().find(s => s.track?.kind === 'video')
            if (sender) {
                await sender.replaceTrack(videoTrack)
            }

            // Listen for when user clicks "Stop Sharing" on the browser UI
            videoTrack.onended = () => {
                this.stopScreenShare()
            }

            return screenStream
        } catch (error) {
            console.error("Error starting screen share:", error)
            return null
        }
    }

    async stopScreenShare(originalStream?: MediaStream) {
        if (!this.peerConnection) return

        let streamToRevertTo = originalStream || this.localStream

        if (!streamToRevertTo || !streamToRevertTo.active) {
            try {
                streamToRevertTo = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            } catch (e) {
                console.error("Failed to revert to camera:", e)
                return
            }
        }

        const videoTrack = streamToRevertTo.getVideoTracks()[0]
        const sender = this.peerConnection.getSenders().find(s => s.track?.kind === 'video')
        if (sender && videoTrack) {
            await sender.replaceTrack(videoTrack)
        }

        this.localStream = streamToRevertTo
        return streamToRevertTo
    }

    cleanup() {
        if (this.peerConnection) {
            this.peerConnection.close()
            this.peerConnection = null
        }

        // Stop all tracks in local stream
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                track.stop()
                console.log(`WebRTC: Stopped local track: ${track.kind}`)
            })
            this.localStream = null
        }

        // Stop all tracks in remote stream
        if (this.remoteStream) {
            this.remoteStream.getTracks().forEach(track => {
                track.stop()
                console.log(`WebRTC: Stopped remote track: ${track.kind}`)
            })
            this.remoteStream = null
        }

        this.onRemoteStreamCallback = null
        this.onIceCandidateCallback = null
    }
    async getDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices()
            return devices.filter(device => device.kind === "audioinput" || device.kind === "videoinput")
        } catch (error) {
            console.error("Error enumerating devices:", error)
            return []
        }
    }

    async switchMicrophone(deviceId: string) {
        if (!this.peerConnection) return

        try {
            const newStream = await navigator.mediaDevices.getUserMedia({
                audio: { deviceId: { exact: deviceId } },
                video: false
            })

            const audioTrack = newStream.getAudioTracks()[0]

            const sender = this.peerConnection.getSenders().find(s => s.track?.kind === 'audio')
            if (sender) {
                await sender.replaceTrack(audioTrack)
            }

            // Update local stream
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
        if (!this.peerConnection) return

        const sender = this.peerConnection.getSenders().find(s => s.track?.kind === 'audio')
        if (sender) {
            await sender.replaceTrack(newAudioTrack)
        }
    }

    async switchCamera(newStreamOrDeviceId: MediaStream | string) {
        if (!this.peerConnection) return

        let newStream: MediaStream

        if (typeof newStreamOrDeviceId === 'string') {
            try {
                newStream = await navigator.mediaDevices.getUserMedia({
                    video: { deviceId: { exact: newStreamOrDeviceId } },
                    audio: true
                })
            } catch (e) {
                console.error("Error getting new camera stream:", e)
                return
            }
        } else {
            newStream = newStreamOrDeviceId
        }

        const videoTrack = newStream.getVideoTracks()[0]
        if (!videoTrack) return

        const sender = this.peerConnection.getSenders().find(s => s.track?.kind === 'video')
        if (sender) {
            await sender.replaceTrack(videoTrack)
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

    async getConnectionStats() {
        if (!this.peerConnection) return null

        try {
            const stats = await this.peerConnection.getStats()
            let packetLoss = 0
            let rtt = 0
            let jitter = 0

            stats.forEach(report => {
                // Video inbound stats
                if (report.type === 'inbound-rtp' && report.kind === 'video') {
                    const lost = report.packetsLost || 0
                    const received = report.packetsReceived || 0
                    if (lost + received > 0) {
                        packetLoss = (lost / (lost + received)) * 100
                    }
                    jitter = (report.jitter || 0) * 1000 // Convert to ms
                }

                // Connection pair stats for latency
                if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                    rtt = (report.currentRoundTripTime || 0) * 1000 // Convert to ms
                }
            })

            return { packetLoss, rtt, jitter }
        } catch (error) {
            console.error("Error getting WebRTC stats:", error)
            return null
        }
    }
}
