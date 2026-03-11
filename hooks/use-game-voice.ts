import { useState, useEffect, useRef, useCallback } from "react"
import { createPeerConnection } from "@/lib/webrtc"
import { NotificationSystem } from "@/utils/core/notification-system"
import { UserPresenceSystem } from "@/utils/infra/user-presence"
import { GameConfig } from "@/components/playground-setup-modal"
import { ref, onValue, set, remove } from "firebase/database"
import { getFirebaseDatabase } from "@/lib/firebase"

interface UseGameVoiceProps {
    gameConfig: GameConfig
    roomId: string
    currentUserId: string
}

export function useGameVoice({ gameConfig, roomId, currentUserId }: UseGameVoiceProps) {
    const [isMicMuted, setIsMicMuted] = useState(true)
    const [isSpeakerMuted, setIsSpeakerMuted] = useState(false)
    const [isVoiceChatActive, setIsVoiceChatActive] = useState(false)
    const [isPTTActive, setIsPTTActive] = useState(false)

    const localStreamRef = useRef<MediaStream | null>(null)
    const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map())

    const notificationSystem = NotificationSystem.getInstance()
    const userPresence = UserPresenceSystem.getInstance()

    const setupPeerConnection = useCallback((playerId: string, isInitiator: boolean) => {
        if (peerConnectionsRef.current.has(playerId)) return

        const peerConnection = createPeerConnection(
            (state) => console.log(`Game Voice PC to ${playerId}: ${state}`),
            () => { },
            (candidate) => {
                if (candidate) {
                    sendSignal("ice-candidate", candidate, playerId)
                }
            }
        )

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => {
                peerConnection.addTrack(track, localStreamRef.current!)
            })
        }

        peerConnection.ontrack = (event) => {
            console.log(`Game Voice: Received stream from ${playerId}`)
            const remoteAudio = new Audio()
            remoteAudio.srcObject = event.streams[0]
            remoteAudio.muted = isSpeakerMuted
            remoteAudio.play().catch(e => console.warn("Game voice playback failed:", e))
        }

        peerConnectionsRef.current.set(playerId, peerConnection)

        if (isInitiator) {
            peerConnection.createOffer().then(async (offer) => {
                await peerConnection.setLocalDescription(offer)
                sendSignal("offer", offer, playerId)
            })
        }
    }, [isSpeakerMuted, roomId, currentUserId])

    const sendSignal = useCallback(async (type: string, payload: any, toUserId: string) => {
        const db = getFirebaseDatabase()
        if (!db) return
        const signalId = `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const signalRef = ref(db, `rooms/${roomId}/gameVoiceSignals/${toUserId}/${signalId}`)
        await set(signalRef, {
            type,
            payload,
            fromUserId: currentUserId,
            timestamp: Date.now()
        })

        // Auto-remove signal
        setTimeout(async () => {
            try { await remove(signalRef) } catch (e) { }
        }, 10000)
    }, [roomId, currentUserId])

    useEffect(() => {
        if (!isVoiceChatActive) return

        const db = getFirebaseDatabase()
        if (!db) return

        const signalsRef = ref(db, `rooms/${roomId}/gameVoiceSignals/${currentUserId}`)
        const unsubscribe = onValue(signalsRef, async (snapshot) => {
            const signals = snapshot.val()
            if (!signals) return

            for (const [id, sig] of Object.entries(signals) as [string, any][]) {
                let pc = peerConnectionsRef.current.get(sig.fromUserId)
                if (!pc) {
                    setupPeerConnection(sig.fromUserId, false)
                    pc = peerConnectionsRef.current.get(sig.fromUserId)!
                }

                try {
                    if (sig.type === "offer") {
                        await pc.setRemoteDescription(new RTCSessionDescription(sig.payload))
                        const answer = await pc.createAnswer()
                        await pc.setLocalDescription(answer)
                        sendSignal("answer", answer, sig.fromUserId)
                    } else if (sig.type === "answer") {
                        await pc.setRemoteDescription(new RTCSessionDescription(sig.payload))
                    } else if (sig.type === "ice-candidate") {
                        await pc.addIceCandidate(new RTCIceCandidate(sig.payload))
                    }
                } catch (err) {
                    console.error("Game Voice signal error:", err)
                }

                // Remove signal after processing
                remove(ref(db, `rooms/${roomId}/gameVoiceSignals/${currentUserId}/${id}`))
            }
        })

        return () => unsubscribe()
    }, [isVoiceChatActive, roomId, currentUserId, setupPeerConnection, sendSignal])

    const setupVoiceChat = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            localStreamRef.current = stream

            stream.getAudioTracks().forEach((track) => {
                track.enabled = false
            })

            setIsVoiceChatActive(true)

            gameConfig.players.forEach((player) => {
                if (player.id !== currentUserId && !player.isComputer) {
                    setupPeerConnection(player.id, true)
                }
            })
        } catch (error) {
            console.error("Error setting up voice chat:", error)
            notificationSystem.error("Could not access microphone for voice chat")
        }
    }, [gameConfig.players, currentUserId, setupPeerConnection, notificationSystem])

    const handlePushToTalk = useCallback(
        async (active: boolean) => {
            if (!localStreamRef.current || !gameConfig.voiceChatEnabled) return

            localStreamRef.current.getAudioTracks().forEach((track) => {
                track.enabled = active
            })
            setIsPTTActive(active)
            setIsMicMuted(!active)

            // Update presence
            try {
                await userPresence.setRecordingVoice(roomId, currentUserId, active)
            } catch (error) {
                console.error("Error updating presence for PTT:", error)
            }
        },
        [roomId, currentUserId, gameConfig.voiceChatEnabled, userPresence],
    )

    const toggleMicrophone = useCallback(() => {
        if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach((track) => {
                track.enabled = !track.enabled
            })
            setIsMicMuted((prev) => !prev)
        }
    }, [])

    const toggleSpeaker = useCallback(() => {
        setIsSpeakerMuted((prev) => !prev)
        document.querySelectorAll("audio").forEach((audio) => {
            audio.muted = !isSpeakerMuted
        })
    }, [isSpeakerMuted])

    const cleanupVoice = useCallback(() => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => track.stop())
        }
        peerConnectionsRef.current.forEach((pc) => pc.close())
        peerConnectionsRef.current.clear()
    }, [])

    return {
        isMicMuted,
        isSpeakerMuted,
        isVoiceChatActive,
        isPTTActive,
        localStream: localStreamRef.current,
        setupVoiceChat,
        handlePushToTalk,
        toggleMicrophone,
        toggleSpeaker,
        cleanupVoice
    }
}
