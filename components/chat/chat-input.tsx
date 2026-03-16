
"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Mic, Video, Camera, Smile, Send, Plus, X, EyeOff, Eye, Music2, BarChart2, HelpCircle, Palette, Keyboard, Sparkles } from "lucide-react"
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
import { debounce, throttle } from "@/utils/core/lazy-loader"
import { SecurityUtils } from "@/utils/infra/security-utils"
import { telemetry } from "@/utils/core/telemetry"
import { VirtualKeyboard, useVirtualKeyboardStore } from "@/components/virtual-keyboard"
import { cn } from "@/utils/core/cn"

interface ChatInputProps {
    onFileSelect: (type: string, file?: File | any) => void
    onStartRecording: (mode: "audio" | "video" | "photo") => void
    onQuizStart: () => void
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
}

interface PendingMessage {
    id: string
    tempId: string
    text: string
    sender: string
    timestamp: Date
    status: 'sending' | 'sent' | 'failed'
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
}: ChatInputProps) {
    const { roomId, currentUser, replyingTo, setReplyingTo, setIsTyping, isTyping, roomMembers, onlineUsers } = useChatStore()
    const [message, setMessage] = useState("")
    const [showEmojiPicker, setShowEmojiPicker] = useState(false)
    const [showAttachments, setShowAttachments] = useState(false)
    const [isRecording, setIsRecording] = useState(false)
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

    const handleSendMessage = async () => {
        if (!message.trim() || !roomId || !currentUser) return

        let tempId = ""
        try {
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

            const encryptionManager = EncryptionManager.getInstance()
            const encryptedText = await encryptionManager.encrypt(cleanedMessage, roomId)

            const newMessage = {
                text: encryptedText,
                sender: currentUser.name,
                timestamp: new Date(),
                replyTo: replyingTo
                    ? {
                        id: replyingTo.id,
                        text: replyingTo.text,
                        sender: replyingTo.sender,
                    }
                    : undefined,
                reactions: {
                    heart: [],
                    thumbsUp: [],
                },
            }

            // Send to server
            await messageStorage.sendMessage(roomId, newMessage, currentUserId)

            // Log telemetry
            telemetry.logEvent('message_sent', roomId, currentUser.name, currentUser.name, { length: cleanedMessage.length })

            // Link detection
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const urls = cleanedMessage.match(urlRegex);
            if (urls && urls.length > 0) {
                telemetry.logEvent('link_shared', roomId, currentUser.name, currentUser.name, { url: urls[0], count: urls.length })
            }

            // Haptic feedback for successful send
            notificationSystem.newMessage(currentUser.name, cleanedMessage)

        } catch (error) {
            console.error("Error sending message:", error)

            notificationSystem.error("Failed to send message")
        }
    }

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

    // Debounced typing indicator
    const handleTypingIndicator = useCallback(
        (isTyping: boolean) => {
            throttle((isTyping: boolean) => {
                if (!roomId || !currentUserId) return
                userPresence.setTyping(roomId, currentUserId, isTyping)
            }, 500)(isTyping)
        },
        [roomId, currentUserId, userPresence]
    )

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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

    // Sync recording status with presence system
    useEffect(() => {
        if (!roomId || !currentUserId) return
        userPresence.setRecordingVoice(roomId, currentUserId, isRecording)

        return () => {
            if (roomId && currentUserId) {
                userPresence.setRecordingVoice(roomId, currentUserId, false)
            }
        }
    }, [isRecording, roomId, currentUserId, userPresence])
    
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
                {/* Recording indicator */}
                {isRecording && (
                    <div className="px-4 py-2 bg-red-500/40 backdrop-blur-md border-t border-red-500/30 flex items-center justify-center gap-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-sm text-red-400">Recording...</span>
                    </div>
                )}

                {/* Mobile Reactions Bar - Compact floating grid on the right */}
                {showMobileReactions && (
                    <div className="absolute bottom-full right-2 mb-2 p-2 bg-slate-900/40 backdrop-blur-xl rounded-2xl shadow-2xl animate-in slide-in-from-bottom-2 duration-200 z-[80]">
                        <ReactionRain roomId={roomId || ""} userId={currentUserId} inline={true} />
                    </div>
                )}

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
                            className={`h-10 w-10 rounded-full shrink-0 transition-colors ${showAttachments ? 'bg-cyan-500 text-white shadow-lg' : 'bg-white/5 text-gray-300'}`}
                            onClick={() => {
                                setShowAttachments(!showAttachments)
                                setShowEmojiPicker(false)
                            }}
                        >
                            <Plus className={`w-5 h-5 transition-transform ${showAttachments ? 'rotate-45' : ''}`} />
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

                            {message.trim() ? (
                                <Button
                                    type="submit"
                                    size="icon"
                                    className="h-10 w-10 rounded-full bg-cyan-500 hover:bg-cyan-600 text-white shrink-0 shadow-lg"
                                >
                                    <Send className="w-5 h-5" />
                                </Button>
                            ) : (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-10 w-10 rounded-full bg-white/5 text-gray-300 shrink-0 haptic"
                                    onClick={() => setIsRecording(!isRecording)}
                                >
                                    <Mic className={`w-5 h-5 ${isRecording ? 'text-red-400' : ''}`} />
                                </Button>
                            )}
                        </div>
                    </div>
                </form>

                <EmojiPicker
                    isOpen={!isMobile ? showEmojiPicker : false}
                    onClose={() => setShowEmojiPicker(false)}
                    onEmojiSelect={handleEmojiSelect}
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
                        onAudioCall={onStartAudioCall}
                        onVideoCall={onStartVideoCall}
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

                <Button
                    variant="ghost"
                    size="icon"
                    className={`text-gray-400 hover:text-white hover:bg-slate-700 h-10 w-10 flex-shrink-0 haptic ${vanishMode !== "off" ? "bg-purple-500/20 text-purple-400" : ""}`}
                    onClick={() => setShowVanishModal(!showVanishModal)}
                    title={vanishMode !== "off" ? `Vanish: ${vanishMode}` : "Vanish Mode"}
                >
                    {vanishMode !== "off" ? <Eye className="w-5 h-5 text-purple-400" /> : <Eye className="w-5 h-5" />}
                </Button>

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
