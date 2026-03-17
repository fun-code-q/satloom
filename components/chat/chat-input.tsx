
"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Video, Camera, Smile, Send, Plus, X, Music2, BarChart2, HelpCircle, Palette, Keyboard, Sparkles } from "lucide-react"
import { EmojiPicker } from "@/components/emoji-picker"
import { PollCreator } from "./poll-creator"
import { EventCreator } from "./event-creator"
import { AttachmentMenu } from "@/components/attachment-menu"
import { Soundboard } from "@/components/soundboard"
import { VanishModeModal } from "@/components/vanish-mode-modal"
import { ReactionRain } from "@/components/reaction-rain"
import { vanishModeManager, type VanishModeType } from "@/utils/infra/vanish-mode"
import { useChatStore } from "@/stores/chat-store"
import { MessageStorage } from "@/utils/infra/message-storage"
import { UserPresenceSystem } from "@/utils/infra/user-presence"
import { NotificationSystem } from "@/utils/core/notification-system"
import { EncryptionManager } from "@/utils/infra/encryption-manager"
import { useIsMobile } from "@/hooks/use-mobile"
import { throttle } from "@/utils/core/lazy-loader"
import { SecurityUtils } from "@/utils/infra/security-utils"
import { telemetry } from "@/utils/core/telemetry"
import { VirtualKeyboard, useVirtualKeyboardStore } from "@/components/virtual-keyboard"
import { cn } from "@/utils/core/cn"
import { useOfflineSupport } from "@/hooks/use-offline"
import { OfflineIndicator } from "@/components/offline-indicator"
import { useShallow } from "zustand/react/shallow"

interface ChatInputProps {
    onFileSelect: (type: string, file?: File | any) => void
    onStartRecording: (mode: "audio" | "video" | "photo") => void
    onQuizStart: () => void
    onWhiteboard?: () => void
    onPresentation?: () => void
    onNotes?: () => void
    onCheckList?: () => void
    onMoodTrigger?: () => void
    onSoundboard?: () => void
    showSoundboard: boolean
    setShowSoundboard: (val: boolean) => void
    onStartAudioCall: () => void
    onStartVideoCall: () => void
    currentUserId: string
    inputRef: React.RefObject<HTMLInputElement | null>
    showPollCreator: boolean
    setShowPollCreator: (val: boolean) => void
    showEventCreator: boolean
    setShowEventCreator: (val: boolean) => void
    showVanishModal: boolean
    setShowVanishModal: (val: boolean) => void
    vanishMode: VanishModeType
    setVanishMode: (val: VanishModeType) => void
    vanishDuration: number
    setVanishDuration: (val: number) => void
    showMobileReactions: boolean
    setShowMobileReactions: (val: boolean) => void
    hasUnreadNotes?: boolean
    hasUnreadTasks?: boolean
    onSearch?: (query: string) => void
}

interface PendingMessage {
    id: string
    text: string
    replyTo?: {
        id: string
        text: string
        sender: string
    }
    status: "sending" | "failed"
    attempts: number
}

interface MentionCandidate {
    name: string
    avatar?: string
    isOnline: boolean
}

export function ChatInput({
    onFileSelect,
    onStartRecording,
    onQuizStart,
    onWhiteboard,
    onPresentation,
    onNotes,
    onCheckList,
    onMoodTrigger,
    onSoundboard,
    showSoundboard,
    setShowSoundboard,
    onStartAudioCall,
    onStartVideoCall,
    currentUserId,
    inputRef,
    showPollCreator,
    setShowPollCreator,
    showEventCreator,
    setShowEventCreator,
    showVanishModal,
    setShowVanishModal,
    vanishMode,
    setVanishMode,
    vanishDuration,
    setVanishDuration,
    showMobileReactions,
    setShowMobileReactions,
    hasUnreadNotes,
    hasUnreadTasks,
    onSearch,
}: ChatInputProps) {
    const MAX_PENDING_MESSAGES = 4
    const {
        roomId,
        currentUser,
        replyingTo,
        setReplyingTo,
        setIsTyping,
        isTyping,
        roomMembers,
        onlineUsers,
    } = useChatStore(
        useShallow((state) => ({
            roomId: state.roomId,
            currentUser: state.currentUser,
            replyingTo: state.replyingTo,
            setReplyingTo: state.setReplyingTo,
            setIsTyping: state.setIsTyping,
            isTyping: state.isTyping,
            roomMembers: state.roomMembers,
            onlineUsers: state.onlineUsers,
        }))
    )
    const [message, setMessage] = useState("")
    const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([])
    const [showEmojiPicker, setShowEmojiPicker] = useState(false)
    const [showAttachments, setShowAttachments] = useState(false)
    const [showMentionSuggestions, setShowMentionSuggestions] = useState(false)
    const [mentionQuery, setMentionQuery] = useState("")
    const [mentionStartIndex, setMentionStartIndex] = useState<number | null>(null)
    const [selectedMentionIndex, setSelectedMentionIndex] = useState(0)
    const isMobile = useIsMobile()

    // Virtual keyboard
    const { isEnabled: isKeyboardEnabled, isVisible: isKeyboardVisible, toggleEnabled: toggleKeyboard } = useVirtualKeyboardStore()

    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const messageStorage = MessageStorage.getInstance()
    const userPresence = UserPresenceSystem.getInstance()
    const notificationSystem = NotificationSystem.getInstance()
    const lastSentTimeRef = useRef<number>(0)
    const mentionMenuRef = useRef<HTMLDivElement>(null)
    const throttledTypingIndicatorRef = useRef<((typing: boolean) => void) | null>(null)

    useEffect(() => {
        throttledTypingIndicatorRef.current = throttle((typing: boolean) => {
            if (!roomId || !currentUserId) return
            userPresence.setTyping(roomId, currentUserId, typing)
        }, 500)
    }, [roomId, currentUserId, userPresence])

    const getMentionHandle = useCallback((name: string) => {
        const cleaned = name
            .trim()
            .replace(/\s+/g, "_")
            .replace(/[^\w]/g, "")
        return cleaned || "user"
    }, [])

    const mentionCandidates = useMemo(() => {
        const membersByName = new Map<string, MentionCandidate>()

        roomMembers.forEach((member) => {
            const key = member.name.trim().toLowerCase()
            if (!key) return
            membersByName.set(key, {
                name: member.name.trim(),
                avatar: member.avatar,
                isOnline: false,
            })
        })

        onlineUsers.forEach((onlineUser) => {
            const key = (onlineUser.name || "").trim().toLowerCase()
            if (!key) return
            const existing = membersByName.get(key)
            membersByName.set(key, {
                name: onlineUser.name,
                avatar: onlineUser.avatar || existing?.avatar,
                isOnline: true,
            })
        })

        return Array.from(membersByName.values())
            .filter((candidate) => candidate.name !== "System")
            .sort((a, b) => {
                if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1
                return a.name.localeCompare(b.name)
            })
    }, [onlineUsers, roomMembers])

    const filteredMentionCandidates = useMemo(() => {
        const query = mentionQuery.toLowerCase()

        return mentionCandidates
            .filter((candidate) => {
                if (!query) return true
                const displayName = candidate.name.toLowerCase()
                const handle = getMentionHandle(candidate.name).toLowerCase()
                return displayName.includes(query) || handle.includes(query)
            })
            .slice(0, 8)
    }, [getMentionHandle, mentionCandidates, mentionQuery])

    const updateMentionSuggestions = useCallback((nextMessage: string, caretPosition?: number | null) => {
        const fallbackCaret = nextMessage.length
        const caret = typeof caretPosition === "number" ? caretPosition : fallbackCaret

        const beforeCaret = nextMessage.slice(0, caret)
        const atIndex = beforeCaret.lastIndexOf("@")

        if (atIndex === -1) {
            setShowMentionSuggestions(false)
            setMentionQuery("")
            setMentionStartIndex(null)
            return
        }

        const charBeforeAt = atIndex > 0 ? beforeCaret[atIndex - 1] : ""
        if (charBeforeAt && !/\s/.test(charBeforeAt)) {
            setShowMentionSuggestions(false)
            setMentionQuery("")
            setMentionStartIndex(null)
            return
        }

        const queryPart = beforeCaret.slice(atIndex + 1)
        if (!/^[A-Za-z0-9_]*$/.test(queryPart)) {
            setShowMentionSuggestions(false)
            setMentionQuery("")
            setMentionStartIndex(null)
            return
        }

        setMentionStartIndex(atIndex)
        setMentionQuery(queryPart)
        setShowMentionSuggestions(true)
    }, [])

    const handleMentionSelect = useCallback((candidate: MentionCandidate) => {
        if (mentionStartIndex === null) return

        const inputElement = inputRef.current
        const selectionEnd = inputElement?.selectionStart ?? message.length
        const mentionToken = `@${getMentionHandle(candidate.name)}`
        const nextMessage =
            message.slice(0, mentionStartIndex) +
            mentionToken +
            " " +
            message.slice(selectionEnd)

        setMessage(nextMessage)
        setShowMentionSuggestions(false)
        setMentionQuery("")
        setMentionStartIndex(null)
        setSelectedMentionIndex(0)

        requestAnimationFrame(() => {
            if (!inputElement) return
            const nextCursor = mentionStartIndex + mentionToken.length + 1
            inputElement.focus()
            inputElement.setSelectionRange(nextCursor, nextCursor)
        })
    }, [getMentionHandle, inputRef, mentionStartIndex, message])

    const handleMessageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const nextMessage = event.target.value
        setMessage(nextMessage)
        updateMentionSuggestions(nextMessage, event.target.selectionStart)
    }

    const createPendingMessageId = useCallback(() => {
        return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    }, [])

    const removePendingMessage = useCallback((pendingId: string) => {
        setPendingMessages((prev) => prev.filter((item) => item.id !== pendingId))
    }, [])

    const markPendingMessageFailed = useCallback((pendingId: string) => {
        setPendingMessages((prev) =>
            prev.map((item) =>
                item.id === pendingId ? { ...item, status: "failed" } : item
            )
        )
    }, [])

    const sendEncryptedMessage = useCallback(async (plainText: string, replyTo?: PendingMessage["replyTo"]) => {
        if (!roomId || !currentUser) {
            throw new Error("Missing room or user for send")
        }

        const encryptionManager = EncryptionManager.getInstance()
        const encryptedText = await encryptionManager.encrypt(plainText, roomId)

        const newMessage = {
            text: encryptedText,
            sender: currentUser.name,
            timestamp: new Date(),
            replyTo,
            reactions: {
                heart: [],
                thumbsUp: [],
            },
        }

        await messageStorage.sendMessage(roomId, newMessage, currentUserId)

        telemetry.logEvent("message_sent", roomId, currentUser.name, currentUser.name, { length: plainText.length })

        const urlRegex = /(https?:\/\/[^\s]+)/g
        const urls = plainText.match(urlRegex)
        if (urls && urls.length > 0) {
            telemetry.logEvent("link_shared", roomId, currentUser.name, currentUser.name, { url: urls[0], count: urls.length })
        }

        notificationSystem.newMessage(currentUser.name, plainText)
    }, [currentUser, currentUserId, messageStorage, notificationSystem, roomId])

    const handleReconnect = useCallback(() => {
        notificationSystem.info("Back online. Syncing queued messages...")
    }, [notificationSystem])

    const handleOfflineSync = useCallback(async (queuedMessages: Array<{ text: string; replyTo?: PendingMessage["replyTo"] }>) => {
        for (const queuedMessage of queuedMessages) {
            await sendEncryptedMessage(queuedMessage.text, queuedMessage.replyTo)
        }

        if (queuedMessages.length > 0) {
            notificationSystem.success(`Synced ${queuedMessages.length} queued message${queuedMessages.length === 1 ? "" : "s"}.`)
        }
    }, [notificationSystem, sendEncryptedMessage])

    const {
        isOnline,
        isSyncing: isOfflineSyncing,
        pendingCount: offlinePendingCount,
        queueMessage,
        syncPendingMessages,
    } = useOfflineSupport({
        onReconnect: handleReconnect,
        onSyncMessages: handleOfflineSync,
    })

    const handleSendMessage = async () => {
        if (!message.trim() || !roomId || !currentUser) return

        const draftMessage = message

        // Check for quiz trigger
        if (message.trim().toLowerCase() === "?quiz?") {
            onQuizStart()
            setMessage("")
            return
        }

        // Check for mood trigger
        if (message.trim().toLowerCase() === "?mood?" || message.trim().toLowerCase() === "/mood") {
            onMoodTrigger?.()
            setMessage("")
            return
        }

        // Check for search trigger (^s^ xxxxxxx)
        if (message.trim().startsWith("^s^ ")) {
            const query = message.trim().substring(4).trim()
            if (query && onSearch) {
                onSearch(query)
            }
            setMessage("")
            return
        }

        // Rate limiting (1s)
        const now = Date.now()
        if (now - lastSentTimeRef.current < 1000) {
            notificationSystem.error("Slow down! 1 message per second.")
            return
        }
        lastSentTimeRef.current = now

        // Clean message
        const cleanedMessage = SecurityUtils.cleanText(message.trim())
        if (!cleanedMessage) {
            setMessage("")
            return
        }

        const replySnapshot = replyingTo
            ? {
                id: replyingTo.id,
                text: replyingTo.text,
                sender: replyingTo.sender,
            }
            : undefined

        // Clear input immediately to prevent double-send or concatenation
        setMessage("")
        setReplyingTo(null)
        setShowMentionSuggestions(false)
        setMentionQuery("")
        setMentionStartIndex(null)
        setSelectedMentionIndex(0)

        // Stop typing indicator
        setIsTyping(false)
        userPresence.setTyping(roomId, currentUserId, false)

        if (!isOnline || !navigator.onLine) {
            queueMessage({
                text: cleanedMessage,
                sender: currentUser.name,
                timestamp: new Date(),
                replyTo: replySnapshot,
                reactions: {
                    heart: [],
                    thumbsUp: [],
                },
            })
            notificationSystem.info("You are offline. Message queued and will auto-send when connection returns.")
            return
        }

        const pendingId = createPendingMessageId()
        const nextPendingMessage: PendingMessage = {
            id: pendingId,
            text: cleanedMessage,
            replyTo: replySnapshot,
            status: "sending",
            attempts: 1,
        }
        setPendingMessages((prev) =>
            [...prev, nextPendingMessage].slice(-MAX_PENDING_MESSAGES)
        )

        try {
            await sendEncryptedMessage(cleanedMessage, replySnapshot)
            removePendingMessage(pendingId)
        } catch (error) {
            console.error("Error sending message:", error)
            markPendingMessageFailed(pendingId)
            setMessage((currentValue) => (currentValue.trim().length > 0 ? currentValue : draftMessage))
            notificationSystem.error("Failed to send message. Tap retry.")
        }
    }

    const handleRetryPendingMessage = useCallback(async (pendingId: string) => {
        const pendingMessage = pendingMessages.find((item) => item.id === pendingId)
        if (!pendingMessage || pendingMessage.status !== "failed") return

        setPendingMessages((prev) =>
            prev.map((item) =>
                item.id === pendingId
                    ? { ...item, status: "sending", attempts: item.attempts + 1 }
                    : item
            )
        )

        try {
            await sendEncryptedMessage(pendingMessage.text, pendingMessage.replyTo)
            removePendingMessage(pendingId)
        } catch (error) {
            console.error("Error retrying pending message:", error)
            markPendingMessageFailed(pendingId)
            notificationSystem.error("Retry failed")
        }
    }, [markPendingMessageFailed, notificationSystem, pendingMessages, removePendingMessage, sendEncryptedMessage])

    const handleSendPoll = async (question: string, options: string[]) => {
        if (!roomId || !currentUser) return

        try {
            const pollMessage = {
                text: "📊 Poll: " + question,
                sender: currentUser.name,
                timestamp: new Date(),
                type: 'poll',
                poll: {
                    question,
                    options: options.map(opt => ({ text: opt, votes: [] })),
                    isOpen: true
                }
            }

            await messageStorage.sendMessage(roomId, pollMessage, currentUserId)

            // Log telemetry
            telemetry.logEvent('poll_created', roomId, currentUser.name, currentUser.name, { question })

            setShowPollCreator(false)
            notificationSystem.success("Poll sent!")
        } catch (error) {
            console.error("Error sending poll:", error)
            notificationSystem.error("Failed to send poll")
        }
    }

    const handleSendEvent = async (eventData: any) => {
        if (!roomId || !currentUser) return

        try {
            const eventMessage = {
                text: "📅 Event: " + eventData.title,
                sender: currentUser.name,
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

            await messageStorage.sendMessage(roomId, eventMessage, currentUserId)
            setShowEventCreator(false)
            notificationSystem.success("Event sent!")
        } catch (error) {
            console.error("Error sending event:", error)
            notificationSystem.error("Failed to send event")
        }
    }

    // Stable throttled typing indicator
    const handleTypingIndicator = useCallback(
        (typing: boolean) => {
            throttledTypingIndicatorRef.current?.(typing)
        },
        []
    )

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.nativeEvent.isComposing) return

        if (showMentionSuggestions) {
            if (e.key === "ArrowDown") {
                e.preventDefault()
                if (!filteredMentionCandidates.length) return
                setSelectedMentionIndex((prev) => (prev + 1) % filteredMentionCandidates.length)
                return
            }

            if (e.key === "ArrowUp") {
                e.preventDefault()
                if (!filteredMentionCandidates.length) return
                setSelectedMentionIndex((prev) => (prev - 1 + filteredMentionCandidates.length) % filteredMentionCandidates.length)
                return
            }

            if ((e.key === "Enter" || e.key === "Tab") && filteredMentionCandidates.length > 0) {
                e.preventDefault()
                handleMentionSelect(filteredMentionCandidates[selectedMentionIndex])
                return
            }

            if (e.key === "Escape") {
                e.preventDefault()
                setShowMentionSuggestions(false)
                setMentionStartIndex(null)
                return
            }
        }

        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            handleSendMessage()
            return
        }

        if (!roomId || !currentUser) return

        const shouldTrackTyping = e.key.length === 1 || e.key === "Backspace" || e.key === "Delete"
        if (!shouldTrackTyping) return

        // Handle typing indicator with throttle
        if (!isTyping) {
            setIsTyping(true)
            handleTypingIndicator(true)
        }

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current)
        }

        typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false)
            handleTypingIndicator(false)
        }, 2000)
    }

    const handleInputCursorChanged = (event: React.SyntheticEvent<HTMLInputElement>) => {
        const inputElement = event.currentTarget
        updateMentionSuggestions(inputElement.value, inputElement.selectionStart)
    }

    const handleEmojiSelect = (emoji: string) => {
        setMessage((prev) => {
            const nextMessage = prev + emoji
            setShowMentionSuggestions(false)
            setMentionStartIndex(null)
            setMentionQuery("")
            return nextMessage
        })
        setShowEmojiPicker(false)
    }

    useEffect(() => {
        setSelectedMentionIndex(0)
    }, [mentionQuery, showMentionSuggestions])

    useEffect(() => {
        if (selectedMentionIndex < filteredMentionCandidates.length) return
        setSelectedMentionIndex(0)
    }, [filteredMentionCandidates.length, selectedMentionIndex])

    useEffect(() => {
        if (!showMentionSuggestions) return

        const handlePointerDownOutside = (event: MouseEvent | TouchEvent) => {
            const target = event.target as Node
            if (inputRef.current?.contains(target)) return
            if (mentionMenuRef.current?.contains(target)) return
            setShowMentionSuggestions(false)
            setMentionQuery("")
            setMentionStartIndex(null)
        }

        document.addEventListener("mousedown", handlePointerDownOutside)
        document.addEventListener("touchstart", handlePointerDownOutside)
        return () => {
            document.removeEventListener("mousedown", handlePointerDownOutside)
            document.removeEventListener("touchstart", handlePointerDownOutside)
        }
    }, [inputRef, showMentionSuggestions])

    // Cleanup typing timeout
    useEffect(() => {
        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current)
            }
        }
    }, [])

    const mobileContainerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!isMobile) return
        
        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            if (mobileContainerRef.current && !mobileContainerRef.current.contains(event.target as Node)) {
                setShowEmojiPicker(false)
                setShowMobileReactions(false)
                setShowAttachments(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        document.addEventListener('touchstart', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('touchstart', handleClickOutside)
        }
    }, [isMobile])

    const renderMentionSuggestions = (mobileLayout: boolean) => {
        if (!showMentionSuggestions) return null

        return (
            <div
                ref={mentionMenuRef}
                className={cn(
                    "absolute left-0 right-0 z-[95] bg-slate-900/95 border border-slate-700 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden",
                    mobileLayout ? "bottom-full mb-2" : "bottom-full mb-3"
                )}
            >
                {filteredMentionCandidates.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-slate-400">No matching members</div>
                ) : (
                    filteredMentionCandidates.map((candidate, index) => {
                        const mentionHandle = getMentionHandle(candidate.name)
                        return (
                            <button
                                key={`${candidate.name}-${index}`}
                                type="button"
                                className={cn(
                                    "w-full px-3 py-2 flex items-center justify-between text-left transition-colors",
                                    index === selectedMentionIndex ? "bg-cyan-500/20 text-white" : "hover:bg-white/5 text-slate-200"
                                )}
                                onMouseDown={(event) => {
                                    event.preventDefault()
                                    handleMentionSelect(candidate)
                                }}
                                onTouchStart={(event) => {
                                    event.preventDefault()
                                    handleMentionSelect(candidate)
                                }}
                            >
                                <div className="min-w-0">
                                    <div className="text-sm font-medium truncate">{candidate.name}</div>
                                    <div className="text-[11px] text-slate-400 truncate">@{mentionHandle}</div>
                                </div>
                                <div className="flex items-center gap-2 pl-2">
                                    {candidate.isOnline && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
                                </div>
                            </button>
                        )
                    })
                )}
            </div>
        )
    }

    const visiblePendingMessages = useMemo(() => pendingMessages.slice(-3), [pendingMessages])

    const renderPendingMessageQueue = (mobileLayout: boolean) => {
        if (visiblePendingMessages.length === 0) return null

        return (
            <div
                className={cn(
                    "flex gap-2 overflow-x-auto scrollbar-hide",
                    mobileLayout ? "px-3 pb-1" : "mb-2 px-1"
                )}
            >
                {visiblePendingMessages.map((pendingMessage) => (
                    <div
                        key={pendingMessage.id}
                        className={cn(
                            "min-w-[170px] max-w-[240px] rounded-xl border px-2.5 py-2 backdrop-blur-sm",
                            pendingMessage.status === "failed"
                                ? "border-rose-500/50 bg-rose-500/10"
                                : "border-cyan-500/35 bg-cyan-500/10"
                        )}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <span
                                className={cn(
                                    "text-[10px] font-semibold uppercase tracking-wide",
                                    pendingMessage.status === "failed" ? "text-rose-300" : "text-cyan-300"
                                )}
                            >
                                {pendingMessage.status === "failed" ? "Failed" : "Sending"}
                            </span>
                            {pendingMessage.status === "failed" ? (
                                <button
                                    type="button"
                                    onClick={() => void handleRetryPendingMessage(pendingMessage.id)}
                                    className="text-[10px] font-semibold text-cyan-300 hover:text-cyan-200 transition-colors"
                                >
                                    Retry
                                </button>
                            ) : (
                                <span className="text-[10px] text-slate-400">...</span>
                            )}
                        </div>
                        <p className="mt-1 text-[11px] text-slate-200 truncate">{pendingMessage.text}</p>
                    </div>
                ))}
            </div>
        )
    }


    if (isMobile) {
        // Hide bottom input controls when virtual keyboard is visible
        /*
        if (isKeyboardEnabled && isKeyboardVisible) {
            return (
                <div className="flex flex-col bg-slate-900/95 border-t border-slate-700 backdrop-blur-md z-30 flex-shrink-0 pb-safe">
                    <div className="px-4 py-2 bg-cyan-500/20 border-t border-cyan-500/30 flex items-center justify-center gap-2">
                        <Keyboard className="w-4 h-4 text-cyan-400" />
                        <span className="text-sm text-cyan-400">Virtual Keyboard Active</span>
                    </div>
                </div>
            )
        }
        */

        return (
            <div ref={mobileContainerRef} className="flex flex-col z-30 flex-shrink-0 pb-safe pointer-events-none sticky bottom-0">
                <div className="pointer-events-auto">
                <OfflineIndicator
                    pendingCount={offlinePendingCount}
                    isSyncing={isOfflineSyncing}
                    onSync={() => void syncPendingMessages()}
                />
                {/* Mobile Reactions Bar - Compact floating grid on the right */}
                {showMobileReactions && (
                    <div className="absolute bottom-full right-2 mb-2 p-2 bg-slate-900/40 backdrop-blur-xl rounded-2xl shadow-2xl animate-in slide-in-from-bottom-2 duration-200 z-[80]">
                        <ReactionRain roomId={roomId || ""} userId={currentUserId} inline={true} />
                    </div>
                )}

                {renderPendingMessageQueue(true)}

                {/* Reply indicator */}
                {replyingTo && (
                    <div className="px-4 py-2 bg-slate-900/40 backdrop-blur-xl border-t border-slate-700/50 flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                            <div className="text-xs text-cyan-400 font-medium">Replying to {replyingTo.sender}</div>
                            <div className="text-xs text-gray-300 truncate">{replyingTo.text}</div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-gray-400 ml-2"
                            onClick={() => setReplyingTo(null)}
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                )}

                {/* Attachment menu popup */}
                {showAttachments && (
                    <div className="absolute bottom-full mb-3 left-4 z-[70] animate-in slide-in-from-bottom-2 duration-200">
                        <div className="shadow-2xl rounded-3xl">
                            <AttachmentMenu
                                isMobile={true}
                                onFileSelect={onFileSelect}
                                onPollCreate={() => {
                                    setShowAttachments(false)
                                    setShowPollCreator(true)
                                }}
                                onEventCreate={() => {
                                    setShowAttachments(false)
                                    setShowEventCreator(true)
                                }}
                                onMoodTrigger={() => {
                                    setShowAttachments(false)
                                    onMoodTrigger?.()
                                }}
                                onVanishMode={() => {
                                    setShowAttachments(false)
                                    setShowVanishModal(true)
                                }}
                                onSoundboard={() => {
                                    setShowAttachments(false)
                                    onSoundboard?.()
                                }}
                                onReactRoom={() => {
                                    setShowAttachments(false)
                                    setShowMobileReactions(true)
                                }}
                                onAudioCall={onStartAudioCall}
                                onVideoCall={onStartVideoCall}
                                onWhiteboard={onWhiteboard}
                                onPresentation={onPresentation}
                                onNotes={onNotes}
                                onCheckList={onCheckList}
                                onQuizStart={onQuizStart}
                                hasUnreadNotes={hasUnreadNotes}
                                hasUnreadTasks={hasUnreadTasks}
                            />
                        </div>
                    </div>
                )}

                {/* Mobile input row */}
                <form
                    className="flex flex-col gap-2 p-3"
                    onSubmit={(e) => {
                        e.preventDefault()
                        handleSendMessage()
                    }}
                >


                    <div className="flex items-end gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className={`h-10 w-10 rounded-full shrink-0 transition-colors ${showAttachments ? 'bg-cyan-500 text-white shadow-lg' : 'bg-white/5 text-gray-300'} relative`}
                            onClick={() => {
                                setShowAttachments(!showAttachments)
                                setShowEmojiPicker(false)
                            }}
                        >
                            <Plus className={`w-5 h-5 transition-transform ${showAttachments ? 'rotate-45' : ''}`} />
                            {!showAttachments && (
                                <>
                                    {hasUnreadNotes && (
                                        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-slate-900 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                                    )}
                                    {hasUnreadTasks && (
                                        <span className="absolute top-1.5 left-1.5 w-2 h-2 bg-red-500 rounded-full border border-slate-900 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                                    )}
                                </>
                            )}
                        </Button>

                        <div className="flex-1 relative">
                            <Input
                                id="message-input"
                                name="message"
                                ref={inputRef}
                                value={message}
                                onChange={handleMessageChange}
                                onKeyDown={handleKeyDown}
                                onKeyUp={handleInputCursorChanged}
                                onClick={handleInputCursorChanged}
                                placeholder={vanishMode !== "off" ? `Vanish Mode Active (${vanishDuration}s)...` : "Type something..."}
                                className={cn(
                                    "w-full bg-white/5 border-white/10 focus:ring-1 focus:ring-cyan-500/50 text-white placeholder-gray-400/50 py-3 scrollbar-hide text-base sm:text-lg min-h-[44px] leading-relaxed transition-all duration-300 rounded-2xl backdrop-blur-sm",
                                    vanishMode !== "off" && "text-purple-300 placeholder-purple-400/50 italic font-medium border-purple-500/50"
                                )}
                            />
                            {renderMentionSuggestions(true)}
                        </div>

                        <div className="flex items-center gap-1">
                            <div className="relative">
                                {/* Stacked Quick Actions Row for Mobile Emoji Icon */}
                                {showEmojiPicker && (
                                    <div className="absolute bottom-full right-0 mb-2 flex flex-col gap-2 items-center animate-in slide-in-from-bottom-2 duration-200">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-10 w-10 bg-white/10 hover:bg-white/20 text-white rounded-full haptic shadow-lg backdrop-blur-md"
                                            onClick={() => {
                                                onSoundboard?.()
                                                setShowEmojiPicker(false)
                                            }}
                                            title="Soundboard"
                                        >
                                            <Music2 className="w-5 h-5 text-orange-400" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-10 w-10 bg-white/10 hover:bg-white/20 text-white rounded-full haptic shadow-lg backdrop-blur-md"
                                            onClick={() => {
                                                setShowMobileReactions(true)
                                                setShowEmojiPicker(false)
                                            }}
                                            title="Room React"
                                        >
                                            <Sparkles className="w-5 h-5 text-cyan-400" />
                                        </Button>
                                    </div>
                                )}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-10 w-10 rounded-full bg-white/5 text-gray-300 shrink-0 haptic"
                                    onClick={() => {
                                        if (showMobileReactions || showEmojiPicker) {
                                            setShowEmojiPicker(false)
                                            setShowMobileReactions(false)
                                        } else {
                                            setShowEmojiPicker(true)
                                        }
                                        setShowAttachments(false)
                                    }}
                                >
                                    <Smile className={`w-5 h-5 ${showEmojiPicker ? 'text-cyan-400' : ''}`} />
                                </Button>
                            </div>

                            <Button
                                type="submit"
                                size="icon"
                                className="h-10 w-10 rounded-full bg-cyan-500 hover:bg-cyan-600 text-white shrink-0 shadow-lg disabled:bg-white/10 disabled:text-gray-500 disabled:shadow-none"
                                disabled={!message.trim()}
                            >
                                <Send className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>
                </form>

                <EmojiPicker
                    isOpen={!isMobile ? showEmojiPicker : false}
                    onClose={() => setShowEmojiPicker(false)}
                    onEmojiSelect={handleEmojiSelect}
                />
                <VanishModeModal
                    isOpen={showVanishModal}
                    onClose={() => setShowVanishModal(false)}
                    currentMode={vanishMode}
                    currentDuration={vanishDuration}
                    onVanishModeSelect={(mode: VanishModeType, duration: number) => {
                        setVanishMode(mode)
                        setVanishDuration(duration)
                    }}
                />
                </div>
            </div>
        )
    }

    // Desktop layout
    if (isKeyboardEnabled && isMobile) {
        return null;
    }

    return (
        <div className="relative w-full max-w-4xl mx-auto">
            <OfflineIndicator
                pendingCount={offlinePendingCount}
                isSyncing={isOfflineSyncing}
                onSync={() => void syncPendingMessages()}
            />
            {renderPendingMessageQueue(false)}

            {/* Reply indicator */}
            {replyingTo && (
                <div className="px-2 py-1.5 bg-slate-800/60 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-cyan-400 font-medium">Replying to {replyingTo.sender}</span>
                        <span className="text-xs text-gray-400 truncate max-w-[200px]">{replyingTo.text}</span>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-gray-400"
                        onClick={() => setReplyingTo(null)}
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            )}

            {/* Poll/Event Modals are handled by ChatModals */}


            {/* Main input area */}
            <form
                className="flex items-center gap-3"
                onSubmit={(e) => {
                    e.preventDefault()
                    handleSendMessage()
                }}
            >
                <div className="flex items-center gap-1 shrink-0">
                    <AttachmentMenu
                        onFileSelect={onFileSelect}
                        onPollCreate={() => setShowPollCreator(true)}
                        onEventCreate={() => setShowEventCreator(true)}
                        onAudioRecord={() => onStartRecording("audio")}
                        onVideoRecord={() => onStartRecording("video")}
                        onPhotoCapture={() => onStartRecording("photo")}
                        onMoodTrigger={onMoodTrigger}
                        onVanishMode={() => setShowVanishModal(true)}
                        onAudioCall={onStartAudioCall}
                        onVideoCall={onStartVideoCall}
                        onWhiteboard={onWhiteboard}
                        onPresentation={onPresentation}
                        onNotes={onNotes}
                        onCheckList={onCheckList}
                        onQuizStart={onQuizStart}
                        hasUnreadNotes={hasUnreadNotes}
                        hasUnreadTasks={hasUnreadTasks}
                    />
                </div>

                <div className="flex-1 relative">
                    <Input
                        id="desktop-chat-input"
                        name="message"
                        ref={inputRef}
                        value={message}
                        onChange={handleMessageChange}
                        onKeyDown={handleKeyDown}
                        onKeyUp={handleInputCursorChanged}
                        onClick={handleInputCursorChanged}
                        placeholder="Type a message..."
                        className="flex-1 bg-slate-800/80 border-transparent text-white placeholder-gray-400 min-h-[44px] text-base rounded-full"
                        maxLength={1000}
                    />
                    {renderMentionSuggestions(false)}
                </div>

                {/* Soundboard */}
                {onSoundboard && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-gray-400 hover:text-orange-400 hover:bg-slate-700 h-10 w-10 flex-shrink-0 haptic"
                        onClick={onSoundboard}
                        title="Soundboard"
                    >
                        <Music2 className="w-5 h-5" />
                    </Button>
                )}

                {/* Reaction Emoji Menu */}
                {isMobile ? (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-gray-400 hover:text-white hover:bg-slate-700 h-10 w-10 flex-shrink-0 haptic"
                        onClick={() => setShowMobileReactions(!showMobileReactions)}
                        title="React to room"
                    >
                        <Sparkles className="w-5 h-5" />
                    </Button>
                ) : (
                    <ReactionRain roomId={roomId || ""} userId={currentUserId} />
                )}

                <Button
                    variant="ghost"
                    size="icon"
                    className="text-gray-400 hover:text-white hover:bg-slate-700 h-10 w-10 flex-shrink-0 haptic"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    title="Add Emoji"
                >
                    <Smile className="w-5 h-5" />
                </Button>

                <Button
                    type="submit"
                    className="bg-[#2196F3] hover:bg-blue-500 h-[44px] w-[44px] rounded-full p-0 flex-shrink-0 ml-2 shadow-lg"
                    disabled={!message.trim()}
                    title="Send Message"
                >
                    <Send className="w-5 h-5 mr-1" />
                </Button>
            </form>

            <EmojiPicker
                isOpen={showEmojiPicker}
                onClose={() => setShowEmojiPicker(false)}
                onEmojiSelect={handleEmojiSelect}
            />

            <VanishModeModal
                isOpen={showVanishModal}
                onClose={() => setShowVanishModal(false)}
                currentMode={vanishMode}
                currentDuration={vanishDuration}
                onVanishModeSelect={(mode: VanishModeType, duration: number) => {
                    setVanishMode(mode)
                    setVanishDuration(duration)
                }}
            />
        </div>
    )
}
