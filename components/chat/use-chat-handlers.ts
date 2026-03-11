"use client"

import { useCallback } from "react"
import { ref, remove } from "firebase/database"
import { getFirebaseDatabase } from "../../lib/firebase"
import { NotificationSystem } from "@/utils/core/notification-system"
import { MessageStorage } from "@/utils/infra/message-storage"
import { UserPresenceSystem } from "@/utils/infra/user-presence"
import { SecurityUtils } from "@/utils/infra/security-utils"
import { p2pFileTransfer } from "@/utils/infra/p2p-file-transfer"
import { telemetry } from "@/utils/core/telemetry"
import type { Message } from "../message-bubble"

interface UseChatHandlersParams {
    roomId: string
    userProfile: { name: string; avatar?: string }
    currentUserId: string
    isHost: boolean
    onLeave: () => void
    // State setters
    setReplyingTo: (msg: Message | null) => void
    setShowMediaRecorder: (val: boolean) => void
    setMediaRecorderMode: (mode: "audio" | "video" | "photo") => void
    setShowLeaveConfirmation: (val: boolean) => void
    setPasswordValidated: (val: boolean) => void
    setCurrentUserMood: (mood: { emoji: string; text: string } | null) => void
    fileInputRef: React.RefObject<HTMLInputElement | null>
    setPendingChatFile: (data: { type: string; file: File } | null) => void
}

export function useChatHandlers({
    roomId,
    userProfile,
    currentUserId,
    isHost,
    onLeave,
    setReplyingTo,
    setShowMediaRecorder,
    setMediaRecorderMode,
    setShowLeaveConfirmation,
    setPasswordValidated,
    setCurrentUserMood,
    fileInputRef,
    setPendingChatFile,
}: UseChatHandlersParams) {
    const notificationSystem = NotificationSystem.getInstance()
    const messageStorage = MessageStorage.getInstance()
    const userPresence = UserPresenceSystem.getInstance()

    const handleSendMessage = useCallback(async (text: string) => {
        if (!text.trim() || !roomId || !currentUserId) return
        try {
            const cleanedText = SecurityUtils.cleanText(text.trim())
            if (!cleanedText) return

            const newMessage = {
                text: cleanedText,
                sender: userProfile.name,
                roomId: roomId,
                timestamp: Date.now(),
            }

            await messageStorage.sendMessage(roomId, newMessage as any, currentUserId)
        } catch (error) {
            console.error("Error sending message:", error)
            notificationSystem.error("Failed to send message")
        }
    }, [roomId, currentUserId, userProfile.name, messageStorage, notificationSystem])

    const handleSendPoll = useCallback(async (question: string, options: string[]) => {
        if (!roomId || !currentUserId) return
        try {
            const pollMessage = {
                text: "📊 Poll: " + question,
                sender: userProfile.name,
                timestamp: new Date(),
                type: 'poll',
                poll: {
                    question,
                    options: options.map(opt => ({ text: opt, votes: [] })),
                    isOpen: true
                }
            }

            await messageStorage.sendMessage(roomId, pollMessage as any, currentUserId)
            telemetry.logEvent('poll_created', roomId, userProfile.name, userProfile.name, { question })
            notificationSystem.success("Poll sent!")
        } catch (error) {
            console.error("Error sending poll:", error)
            notificationSystem.error("Failed to send poll")
        }
    }, [roomId, currentUserId, userProfile.name, messageStorage, notificationSystem])

    const handleSendEvent = useCallback(async (eventData: any) => {
        if (!roomId || !currentUserId) return
        try {
            const eventMessage = {
                text: "📅 Event: " + eventData.title,
                sender: userProfile.name,
                timestamp: new Date(),
                type: 'event',
                event: {
                    ...eventData,
                    attendees: {
                        going: [currentUserId],
                        maybe: [],
                        notGoing: []
                    }
                }
            }

            await messageStorage.sendMessage(roomId, eventMessage as any, currentUserId)
            notificationSystem.success("Event sent!")
        } catch (error) {
            console.error("Error sending event:", error)
            notificationSystem.error("Failed to send event")
        }
    }, [roomId, currentUserId, userProfile.name, messageStorage, notificationSystem])

    const handleReply = useCallback((messageToReply: Message) => {
        setReplyingTo(messageToReply)
    }, [setReplyingTo])

    const handleReact = useCallback(async (messageId: string, reaction: "heart" | "thumbsUp", userId: string) => {
        try {
            await messageStorage.addReaction(roomId, messageId, reaction, userId)
            telemetry.logEvent('emoji_sent', roomId, userId, userProfile.name, { reaction })
        } catch (error) {
            console.error("Error adding reaction:", error)
        }
    }, [roomId, messageStorage])

    const handleDeleteMessage = useCallback(async (messageId: string) => {
        try {
            await messageStorage.deleteMessage(roomId, messageId)
        } catch (error) {
            console.error("Error deleting message:", error)
            notificationSystem.error("Failed to delete message")
        }
    }, [roomId, messageStorage, notificationSystem])

    const handleEditMessage = useCallback(async (messageId: string, newText: string) => {
        try {
            await messageStorage.editMessage(roomId, messageId, newText)
        } catch (error) {
            console.error("Error editing message:", error)
            notificationSystem.error("Failed to edit message")
        }
    }, [roomId, messageStorage, notificationSystem])

    const handleCopyMessage = useCallback((text: string) => {
        navigator.clipboard.writeText(text)
        notificationSystem.success("Message copied to clipboard")
    }, [notificationSystem])

    const handleVote = useCallback(async (messageId: string, optionIndex: number) => {
        try {
            await messageStorage.vote(roomId, messageId, optionIndex, currentUserId)
        } catch (error) {
            console.error("Error voting:", error)
            notificationSystem.error("Failed to submit vote")
        }
    }, [roomId, currentUserId, messageStorage, notificationSystem])

    const handleRSVP = useCallback(async (messageId: string, status: "going" | "maybe" | "notGoing") => {
        try {
            await messageStorage.rsvp(roomId, messageId, status, currentUserId)
        } catch (error) {
            console.error("Error RSVPing:", error)
            notificationSystem.error("Failed to update status")
        }
    }, [roomId, currentUserId, messageStorage, notificationSystem])

    const handlePinMessage = useCallback(async (messageId: string) => {
        try {
            await messageStorage.pinMessage(roomId, messageId)
            notificationSystem.success("Message pinned")
        } catch (error) {
            console.error("Error pinning message:", error)
            notificationSystem.error("Failed to pin message")
        }
    }, [roomId, messageStorage, notificationSystem])

    const handleUnpinMessage = useCallback(async () => {
        try {
            await messageStorage.unpinMessage(roomId)
            notificationSystem.success("Message unpinned")
        } catch (error) {
            notificationSystem.error("Failed to unpin message")
        }
    }, [roomId, messageStorage, notificationSystem])

    const handleFileSelect = useCallback(async (type: string, file?: File | any) => {
        console.log(`ChatInterface: File select - type: ${type}, file:`, file)

        try {
            if (type === "input" && !file) {
                fileInputRef.current?.click()
                return
            }

            if (file instanceof File) {
                setPendingChatFile({ type, file })
            }
        } catch (error) {
            console.error("Error handling file select:", error)
            notificationSystem.error("Failed to prepare file")
        }
    }, [setPendingChatFile, fileInputRef, notificationSystem])

    const handleSendFile = useCallback(async (file: File) => {
        try {
            const validation = await SecurityUtils.validateFile(file)
            if (!validation.valid) {
                notificationSystem.error(validation.error || "Invalid file")
                return
            }

            const MAX_SIZE = 50 * 1024 * 1024
            if (file.size > MAX_SIZE) {
                notificationSystem.error("File too large (Max 50MB)")
                return
            }

            const localPreviewUrl = URL.createObjectURL(file)
            notificationSystem.info(`Preparing ${file.name} for P2P sharing...`)
            userPresence.setSendingFile(roomId, currentUserId, true)

            const fileId = p2pFileTransfer.registerFile(file)

            const p2pMessage = {
                text: `Shared a file: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`,
                sender: userProfile.name,
                roomId: roomId,
                timestamp: Date.now(),
                file: {
                    url: localPreviewUrl,
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    encrypted: true,
                    p2p: true,
                    fileId: fileId,
                    senderId: userProfile.name
                }
            }

            await messageStorage.sendMessage(roomId, p2pMessage as any, currentUserId)
            userPresence.setSendingFile(roomId, currentUserId, false)
            telemetry.logEvent('file_shared', roomId, currentUserId, userProfile.name, { fileName: file.name, fileSize: file.size })
            notificationSystem.success("File ready for P2P download")
            setPendingChatFile(null)
        } catch (error) {
            console.error("Error sending file:", error)
            userPresence.setSendingFile(roomId, currentUserId, false)
            notificationSystem.error("Failed to share file")
        }
    }, [roomId, currentUserId, userProfile.name, setPendingChatFile, messageStorage, notificationSystem, userPresence])

    const handleMediaRecorded = useCallback((file: File, type: string) => {
        handleFileSelect(type, file)
        setShowMediaRecorder(false)
    }, [handleFileSelect, setShowMediaRecorder])

    const handleStartMediaRecording = useCallback((mode: "audio" | "video" | "photo") => {
        setMediaRecorderMode(mode)
        setShowMediaRecorder(true)

        if (mode === "audio") {
            userPresence.setRecordingVoice(roomId, currentUserId, true)
        } else if (mode === "video") {
            userPresence.setRecordingVideo(roomId, currentUserId, true)
        }
    }, [roomId, currentUserId, setMediaRecorderMode, setShowMediaRecorder, userPresence])

    const handleStopMediaRecording = useCallback(() => {
        userPresence.setRecordingVoice(roomId, currentUserId, false)
        userPresence.setRecordingVideo(roomId, currentUserId, false)
    }, [roomId, currentUserId, userPresence])

    const handleLeaveRoom = useCallback(async () => {
        setShowLeaveConfirmation(true)
    }, [setShowLeaveConfirmation])

    const handleConfirmLeave = useCallback(async () => {
        try {
            if (isHost) {
                await userPresence.setUserOffline(roomId, currentUserId)

                const db = getFirebaseDatabase()
                if (db) {
                    const roomRef = ref(db, `rooms/${roomId}`)
                    await remove(roomRef)
                    const callsRef = ref(db, `rooms/${roomId}/calls`)
                    await remove(callsRef)
                    const gamesRef = ref(db, `games/${roomId}`)
                    await remove(gamesRef)
                }

                notificationSystem.success("Room destroyed successfully")
            } else {
                await userPresence.setUserOffline(roomId, currentUserId)

                const db = getFirebaseDatabase()
                if (db) {
                    const memberRef = ref(db, `rooms/${roomId}/members/${userProfile.name}`)
                    await remove(memberRef)
                }

                notificationSystem.roomLeft(roomId)
            }

            setShowLeaveConfirmation(false)
            onLeave()
        } catch (error) {
            console.error("Error leaving room:", error)
            setShowLeaveConfirmation(false)
            onLeave()
        }
    }, [roomId, currentUserId, isHost, userProfile.name, onLeave, setShowLeaveConfirmation, userPresence, notificationSystem])

    const handleCancelLeave = useCallback(() => {
        setShowLeaveConfirmation(false)
    }, [setShowLeaveConfirmation])

    const handleCopyRoomLink = useCallback(() => {
        try {
            console.log("ChatInterface: Attempting to copy room link for roomId:", roomId)

            if (!roomId) {
                console.error("ChatInterface: roomId is null or undefined:", roomId)
                notificationSystem.error("Room ID is not available")
                return
            }

            if (typeof roomId !== "string") {
                console.error("ChatInterface: roomId is not a string:", typeof roomId, roomId)
                notificationSystem.error("Invalid room ID format")
                return
            }

            if (roomId.trim() === "") {
                console.error("ChatInterface: roomId is empty string")
                notificationSystem.error("Room ID is empty")
                return
            }

            const baseUrl = window.location.origin + window.location.pathname
            const cleanRoomId = roomId.trim().toUpperCase()
            const roomLink = `${baseUrl}?room=${encodeURIComponent(cleanRoomId)}`

            console.log("ChatInterface: Copying room link:", roomLink)

            navigator.clipboard
                .writeText(roomLink)
                .then(() => {
                    console.log("ChatInterface: Successfully copied room link")
                    notificationSystem.success(`Room link copied! Room ID: ${cleanRoomId}`)
                })
                .catch((error) => {
                    console.error("ChatInterface: Failed to copy room link:", error)
                    const textArea = document.createElement("textarea")
                    textArea.value = roomLink
                    textArea.style.position = "fixed"
                    textArea.style.left = "-999999px"
                    textArea.style.top = "-999999px"
                    document.body.appendChild(textArea)
                    textArea.focus()
                    textArea.select()
                    try {
                        const successful = document.execCommand("copy")
                        if (successful) {
                            notificationSystem.success(`Room link copied! Room ID: ${cleanRoomId}`)
                        } else {
                            throw new Error("Fallback copy failed")
                        }
                    } catch (fallbackError) {
                        notificationSystem.error("Failed to copy room link. Please copy manually: " + roomLink)
                    }
                    document.body.removeChild(textArea)
                })
        } catch (error) {
            console.error("ChatInterface: Error in handleCopyRoomLink:", error)
            notificationSystem.error("Failed to create room link")
        }
    }, [roomId, notificationSystem])

    const handleMoodChange = useCallback(async (mood: { emoji: string; text: string } | null) => {
        setCurrentUserMood(mood)
        try {
            await userPresence.setUserMood(roomId, currentUserId, mood || undefined)
            if (mood) {
                telemetry.logEvent('vibe_changed', roomId, currentUserId, userProfile.name, { emoji: mood.emoji, status: mood.text })
                notificationSystem.success(`Status updated to: ${mood.emoji} ${mood.text}`)
            }
        } catch (error) {
            console.error("Error updating mood:", error)
        }
    }, [roomId, currentUserId, setCurrentUserMood, userPresence, notificationSystem])

    const handleKickUser = useCallback(async (userId: string) => {
        try {
            await userPresence.kickUser(roomId, userId)
            notificationSystem.success("User kicked from the room")
            telemetry.logEvent('user_kicked', roomId, currentUserId, userProfile.name, { targetUserId: userId })
        } catch (error) {
            console.error("Error kicking user:", error)
            notificationSystem.error("Failed to kick user")
        }
    }, [roomId, currentUserId, userProfile.name, userPresence, notificationSystem])

    return {
        handleSendMessage,
        handleSendPoll,
        handleSendEvent,
        handleReply,
        handleReact,
        handleDeleteMessage,
        handleEditMessage,
        handleCopyMessage,
        handleVote,
        handleRSVP,
        handlePinMessage,
        handleUnpinMessage,
        handleFileSelect,
        handleSendFile,
        handleMediaRecorded,
        handleStartMediaRecording,
        handleStopMediaRecording,
        handleLeaveRoom,
        handleConfirmLeave,
        handleCancelLeave,
        handleCopyRoomLink,
        handleMoodChange,
        handleKickUser,
    }
}
