import { WEBRTC_CONFIG } from "@/lib/webrtc"

export class WebRTCManager {
    private static instance: WebRTCManager
    private peerConnections: Map<string, RTCPeerConnection> = new Map()
    private localStreams: Map<string, MediaStream> = new Map() // trackIdx -> Stream
    private remoteStreams: Map<string, Map<string, MediaStream>> = new Map() // userId -> (label -> Stream)

    private onRemoteStreamListeners: Set<(stream: MediaStream, userId: string, label: string) => void> = new Set()
    /**
     * The listener initialize() registered for a given `${userId}::${label}`.
     *
     * onRemoteStreamListeners is a flat Set, and initialize() is called with a
     * NEW inline closure every time — theater re-initialises on each incoming
     * offer signal, so the Set grew without bound and every ontrack invoked
     * all the stale handlers as well as the live one. Keying them lets a
     * repeat initialize for the same peer+label replace its predecessor.
     */
    private remoteStreamListenersByKey: Map<string, (stream: MediaStream, userId: string, label: string) => void> = new Map()
    /** Same replace-don't-accumulate bookkeeping for the other two listener kinds. */
    private iceListenersByKey: Map<string, (candidate: RTCIceCandidate, userId: string) => void> = new Map()
    private stateListenersByKey: Map<string, (state: RTCPeerConnectionState, userId: string) => void> = new Map()
    private onIceCandidateListeners: Map<string, Set<(candidate: RTCIceCandidate, userId: string) => void>> = new Map() // userId -> listeners
    private onStateChangeListeners: Map<string, Set<(state: RTCPeerConnectionState, userId: string) => void>> = new Map() // userId -> listeners
    private isCleanupInProgress = false
    private iceCandidateBuffers: Map<string, RTCIceCandidateInit[]> = new Map()
    private signalingLock: Map<string, boolean> = new Map()
    // Peers currently undergoing an ICE restart. Prevents CONCURRENT restart
    // offers for the same peer. Cleared when the restart offer is sent.
    private restartInProgress: Set<string> = new Set()
    // Per-peer restart history for backoff/cap. Prevents a persistently-
    // broken link from looping failed→restart→failed indefinitely. The
    // restartInProgress Set above only blocks concurrency, NOT repeated
    // restarts across time; this Map adds the time-domain dampening.
    private restartHistory: Map<string, { count: number; lastAttemptAt: number }> = new Map()

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

        // Replace, don't accumulate: a repeat initialize() for the same peer
        // and label supersedes its previous listener rather than stacking
        // another one that also fires on every ontrack.
        const streamListenerKey = `${targetUserId}::${label}`
        const previousStreamListener = this.remoteStreamListenersByKey.get(streamListenerKey)
        if (previousStreamListener) this.onRemoteStreamListeners.delete(previousStreamListener)
        this.remoteStreamListenersByKey.set(streamListenerKey, onRemoteStream)
        this.onRemoteStreamListeners.add(onRemoteStream)

        // Add ICE candidate listener for this user, replacing any previous one
        // registered under the same key. onicecandidate fans out to every
        // listener in this Set, so an accumulated duplicate means the same
        // candidate gets written to Firebase once per stale listener.
        let userIceListeners = this.onIceCandidateListeners.get(targetUserId)
        if (!userIceListeners) {
            userIceListeners = new Set()
            this.onIceCandidateListeners.set(targetUserId, userIceListeners)
        }
        const previousIceListener = this.iceListenersByKey.get(streamListenerKey)
        if (previousIceListener) userIceListeners.delete(previousIceListener)
        this.iceListenersByKey.set(streamListenerKey, onIceCandidate)
        userIceListeners.add(onIceCandidate)

        // Add state change listener if provided
        if (onStateChange) {
            let userStateListeners = this.onStateChangeListeners.get(targetUserId)
            if (!userStateListeners) {
                userStateListeners = new Set()
                this.onStateChangeListeners.set(targetUserId, userStateListeners)
            }
            const previousStateListener = this.stateListenersByKey.get(streamListenerKey)
            if (previousStateListener) userStateListeners.delete(previousStateListener)
            this.stateListenersByKey.set(streamListenerKey, onStateChange)
            userStateListeners.add(onStateChange)
        }

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
            const streamLabel = stream.id.toLowerCase().includes("theater") ? "theater" : "default"

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
            if (event.candidate) {
                const listeners = this.onIceCandidateListeners.get(targetUserId)
                listeners?.forEach(listener => listener(event.candidate!, targetUserId))
            }
        }

        // Connection state logging
        pc.onconnectionstatechange = () => {
            const state = pc!.connectionState
            console.log(`[WebRTC] Connection ${targetUserId} State:`, state)
            const listeners = this.onStateChangeListeners.get(targetUserId)
            listeners?.forEach(listener => listener(state, targetUserId))
        }

        this.iceCandidateBuffers.set(targetUserId, [])
    }

    async createOffer(targetUserId: string): Promise<RTCSessionDescriptionInit> {
        const pc = this.peerConnections.get(targetUserId)
        if (!pc) throw new Error(`No PC for user ${targetUserId}`)

        // If we are already stable or have an offer, check if we can restart ICE
        if (pc.signalingState !== "stable" && pc.signalingState !== "have-local-offer") {
            console.warn(`[WebRTC] createOffer: PC state is ${pc.signalingState}, cannot create offer`)
            throw new Error(`Invalid signaling state: ${pc.signalingState}`)
        }

        const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
        })
        await pc.setLocalDescription(offer)
        return offer
    }

    /**
     * Initiate an ICE restart for a peer whose connection has failed.
     *
     * Generates a new offer with `{ iceRestart: true }`, which forces the ICE
     * agent to re-gather candidates (useful after a WiFi→cellular handoff or
     * NAT rebind). The returned offer must be signaled to the remote peer via
     * the normal offer/answer path — the remote's existing offer handler calls
     * createAnswer(), which processes a restart offer like any other. Both
     * sides then re-gather ICE candidates and the connection can recover
     * without a hang-up/redial.
     *
     * Guards:
     *   - Only restarts if a peer connection exists.
     *   - One restart per peer at a time (restartInProgress) — blocks
     *     CONCURRENT restart offers. Cleared in cleanup() and by the caller
     *     once the offer is sent.
     *   - Backoff/cap (restartHistory): max ICE_MAX_RESTARTS attempts per
     *     peer within ICE_RESTART_COOLDOWN_MS, so a persistently-broken link
     *     can't loop failed→restart→failed indefinitely. The concurrency
     *     guard alone does NOT prevent repeated restarts across time.
     *   - Respects the signalingLock (won't restart mid-negotiation).
     *
     * Note: this does NOT implement perfect-negotiation glare avoidance —
     * if both peers hit "failed" simultaneously both may fire restartIce.
     * The remote createAnswer() path + signalingLock keep that non-fatal,
     * but only one side's restart will land.
     *
     * Returns the restart offer, or null if a restart is already in progress,
     * the backoff/cap is exhausted, or conditions aren't met (caller treats
     * null as "skip").
     */
    async restartIce(targetUserId: string): Promise<RTCSessionDescriptionInit | null> {
        const pc = this.peerConnections.get(targetUserId)
        if (!pc) return null
        if (this.restartInProgress.has(targetUserId)) {
            console.log(`[WebRTC] ICE restart already in progress for ${targetUserId}, skipping`)
            return null
        }
        if (this.signalingLock.get(targetUserId)) {
            console.log(`[WebRTC] Signaling lock active for ${targetUserId}, deferring ICE restart`)
            return null
        }

        // Backoff/cap: count restarts per peer within the cooldown window.
        // If the cap is exceeded, stop retrying — the link is persistently
        // broken and the user should hang up rather than loop forever.
        const ICE_MAX_RESTARTS = 3
        const ICE_RESTART_COOLDOWN_MS = 30_000
        const now = Date.now()
        const hist = this.restartHistory.get(targetUserId)
        if (hist) {
            if (now - hist.lastAttemptAt > ICE_RESTART_COOLDOWN_MS) {
                // Window elapsed — reset the counter.
                this.restartHistory.set(targetUserId, { count: 0, lastAttemptAt: now })
            } else if (hist.count >= ICE_MAX_RESTARTS) {
                console.warn(
                    `[WebRTC] ICE restart cap hit for ${targetUserId} (${hist.count} attempts in ${ICE_RESTART_COOLDOWN_MS}ms). ` +
                        `Giving up — connection appears persistently broken; user should hang up.`,
                )
                return null
            }
        } else {
            this.restartHistory.set(targetUserId, { count: 0, lastAttemptAt: now })
        }

        this.restartInProgress.add(targetUserId)
        try {
            // iceRestart requires the PC to be in stable or have-local-offer
            // state. On a "failed" connection the signaling state is normally
            // stable (ICE failure doesn't change signaling state), so this is
            // safe.
            if (pc.signalingState !== "stable" && pc.signalingState !== "have-local-offer") {
                console.warn(`[WebRTC] restartIce: PC ${targetUserId} in state ${pc.signalingState}, aborting`)
                this.restartInProgress.delete(targetUserId)
                return null
            }
            const offer = await pc.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true,
                iceRestart: true,
            })
            await pc.setLocalDescription(offer)
            // Count this attempt toward the backoff cap.
            const h = this.restartHistory.get(targetUserId)
            if (h) {
                h.count += 1
                h.lastAttemptAt = Date.now()
            }
            console.log(`[WebRTC] ICE restart offer created for ${targetUserId} (attempt ${h?.count ?? "?"})`)
            return offer
        } catch (err) {
            console.error(`[WebRTC] restartIce failed for ${targetUserId}:`, err)
            this.restartInProgress.delete(targetUserId)
            throw err
        }
    }

    /** Clear the restart-in-progress flag (caller invokes after sending the offer). */
    clearRestartInProgress(targetUserId: string): void {
        this.restartInProgress.delete(targetUserId)
    }

    /**
     * Reset the per-peer restart backoff history. Callers should invoke this
     * when a connection transitions to "connected" (a successful recovery),
     * so a link that flapped once then stabilized gets a fresh restart budget
     * for future failures rather than staying near the cap.
     */
    resetRestartHistory(targetUserId: string): void {
        this.restartHistory.delete(targetUserId)
    }

    async createAnswer(targetUserId: string, remoteOffer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
        const pc = this.peerConnections.get(targetUserId)
        if (!pc) throw new Error(`No PC for user ${targetUserId}`)

        if (this.signalingLock.get(targetUserId)) {
            console.log(`[WebRTC] Signaling lock active for ${targetUserId}, skipping createAnswer`)
            throw new Error("Signaling lock active")
        }

        this.signalingLock.set(targetUserId, true)
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(remoteOffer))
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)

            await this.processIceBuffer(targetUserId)
            return answer
        } finally {
            this.signalingLock.set(targetUserId, false)
        }
    }

    async handleAnswer(targetUserId: string, remoteAnswer: RTCSessionDescriptionInit) {
        const pc = this.peerConnections.get(targetUserId)
        if (!pc || pc.signalingState === "stable") {
            console.log(`[WebRTC] handleAnswer: PC ${targetUserId} already stable or missing, skipping`)
            return
        }

        if (pc.signalingState !== "have-local-offer") {
            console.warn(`[WebRTC] handleAnswer: PC ${targetUserId} is in state ${pc.signalingState}, cannot handle answer`)
            return
        }

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
            if (track) {
                await this.replaceAudioTrack(track)
                // We don't stop the track here because it's now being used by the peer connection.
                // However, we should stop any OTHER tracks that might have been opened by getUserMedia (though we only asked for audio)
                stream.getTracks().forEach(t => {
                    if (t !== track) t.stop()
                })
            }
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

    /**
     * Read-only accessor for a peer's RTCPeerConnection.
     *
     * Used by host-side broadcast modules (e.g. theater-broadcast) that need
     * to inspect sender parameters (encodings/bitrate) to ramp quality with
     * audience size, without re-implementing peer tracking. Returns undefined
     * if no connection exists for the given user — callers must null-check.
     * The returned PC is NOT to be closed by the caller; use cleanup(uid).
     */
    getPeerConnection(targetUserId: string): RTCPeerConnection | undefined {
        return this.peerConnections.get(targetUserId)
    }

    cleanup(targetUserId?: string) {
        if (targetUserId) {
            const pc = this.peerConnections.get(targetUserId)
            if (pc) {
                pc.close()
                this.peerConnections.delete(targetUserId)
                this.remoteStreams.delete(targetUserId)
                this.iceCandidateBuffers.delete(targetUserId)
                this.restartInProgress.delete(targetUserId)
                this.restartHistory.delete(targetUserId)
            }
            // Drop this peer's listeners even when no PC existed.
            //
            // These were previously never removed by either branch, and
            // initialize() adds a fresh closure per call. Calling the same
            // peer a second time in one page session therefore left two ICE
            // listeners registered, and onicecandidate fans out to all of
            // them (see the handler in initialize) — so every candidate was
            // written to Firebase twice, three times on the third call, and
            // so on. The stale closures also pinned dead React state.
            this.onIceCandidateListeners.delete(targetUserId)
            this.onStateChangeListeners.delete(targetUserId)
            this.removeRemoteStreamListenersFor(targetUserId)
            this.forgetListenerKeys(targetUserId)
        } else {
            this.peerConnections.forEach(pc => pc.close())
            this.peerConnections.clear()
            this.remoteStreams.clear()
            this.iceCandidateBuffers.clear()
            this.restartInProgress.clear()
            this.restartHistory.clear()
            this.onRemoteStreamListeners.clear()
            this.remoteStreamListenersByKey.clear()
            this.iceListenersByKey.clear()
            this.stateListenersByKey.clear()
            this.onIceCandidateListeners.clear()
            this.onStateChangeListeners.clear()
        }
    }

    /** Removes every remote-stream listener registered for a peer. */
    private removeRemoteStreamListenersFor(targetUserId: string) {
        const prefix = `${targetUserId}::`
        for (const [key, listener] of this.remoteStreamListenersByKey) {
            if (!key.startsWith(prefix)) continue
            this.onRemoteStreamListeners.delete(listener)
            this.remoteStreamListenersByKey.delete(key)
        }
    }

    /** Drops the per-key bookkeeping for a peer so it cannot leak either. */
    private forgetListenerKeys(targetUserId: string) {
        const prefix = `${targetUserId}::`
        for (const key of this.iceListenersByKey.keys()) {
            if (key.startsWith(prefix)) this.iceListenersByKey.delete(key)
        }
        for (const key of this.stateListenersByKey.keys()) {
            if (key.startsWith(prefix)) this.stateListenersByKey.delete(key)
        }
    }
}

