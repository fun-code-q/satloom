import { useState, useEffect, useRef, useCallback } from "react"
import { createPeerConnection } from "@/lib/webrtc"
import { NotificationSystem } from "@/utils/core/notification-system"
import { UserPresenceSystem } from "@/utils/infra/user-presence"
import { GameConfig } from "@/components/playground-setup-modal"

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

    const setupPeerConnection = useCallback((playerId: string) => {
        const peerConnection = createPeerConnection()

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => {
                peerConnection.addTrack(track, localStreamRef.current!)
            })
        }

        peerConnection.ontrack = (event) => {
            const remoteAudio = new Audio()
            remoteAudio.srcObject = event.streams[0]
            remoteAudio.muted = isSpeakerMuted
            remoteAudio.play()
        }

        peerConnectionsRef.current.set(playerId, peerConnection)
    }, [isSpeakerMuted])

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
                    setupPeerConnection(player.id)
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
