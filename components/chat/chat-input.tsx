
"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Mic, Video, Camera, Smile, Send, Plus, X, EyeOff, Eye, Music2, BarChart2, HelpCircle, Palette, Keyboard } from "lucide-react"
import { EmojiPicker } from "@/components/emoji-picker"
import { PollCreator } from "./poll-creator"
import { EventCreator } from "./event-creator"
import { AttachmentMenu } from "@/components/attachment-menu"
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

interface ChatInputProps {
    onFileSelect: (type: string, file?: File | any) => void
    onStartRecording: (mode: "audio" | "video" | "photo") => void
    onQuizStart: () => void
    onMoodTrigger?: () => void
    onSoundboard?: () => void
    onStartAudioCall: () => void
    onStartVideoCall: () => void
    currentUserId: string
}

interface PendingMessage {
    id: string
    tempId: string
    text: string
    sender: string
    timestamp: Date
    status: 'sending' | 'sent' | 'failed'
}

export function ChatInput({ onFileSelect, onStartRecording, onQuizStart, onMoodTrigger, onSoundboard, onStartAudioCall, onStartVideoCall, currentUserId }: ChatInputProps) {
    const { roomId, currentUser, replyingTo, setReplyingTo, setIsTyping, isTyping } = useChatStore()
    const [message, setMessage] = useState("")
    const [showEmojiPicker, setShowEmojiPicker] = useState(false)
    const [showPollCreator, setShowPollCreator] = useState(false)
    const [showEventCreator, setShowEventCreator] = useState(false)
    const [showAttachments, setShowAttachments] = useState(false)
    const [isRecording, setIsRecording] = useState(false)
    const [showVanishModal, setShowVanishModal] = useState(false)
    const [vanishMode, setVanishMode] = useState<VanishModeType>("off")
    const [vanishDuration, setVanishDuration] = useState(30000)
    const isMobile = useIsMobile()

    // Virtual keyboard
    const inputRef = useRef<HTMLInputElement>(null)
    const { isEnabled: isKeyboardEnabled, toggleEnabled: toggleKeyboard } = useVirtualKeyboardStore()

    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const messageStorage = MessageStorage.getInstance()
    const userPresence = UserPresenceSystem.getInstance()
    const notificationSystem = NotificationSystem.getInstance()
    const lastSentTimeRef = useRef<number>(0)

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
        throttle((isTyping: boolean) => {
            if (!roomId || !currentUserId) return
            userPresence.setTyping(roomId, currentUserId, isTyping)
        }, 500),
        [roomId, currentUserId]
    )

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            handleSendMessage()
        } else {
            if (!roomId || !currentUser) return

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
    }

    const handleEmojiSelect = (emoji: string) => {
        setMessage((prev) => prev + emoji)
        setShowEmojiPicker(false)
    }

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
    }, [isRecording, roomId, currentUserId])

    const [showMobileReactions, setShowMobileReactions] = useState(false)

    if (isMobile) {
        return (
            <div className="flex flex-col bg-slate-900/95 border-t border-slate-700 backdrop-blur-md z-30 flex-shrink-0 pb-safe">
                {/* Recording indicator */}
                {isRecording && (
                    <div className="px-4 py-2 bg-red-500/20 border-t border-red-500/30 flex items-center justify-center gap-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-sm text-red-400">Recording...</span>
                    </div>
                )}

                {/* Mobile Reactions Bar */}
                {showMobileReactions && (
                    <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-800/60 animate-in slide-in-from-bottom-2">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-cyan-400">Room Reactions</span>
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setShowMobileReactions(false)}>
                                <X className="w-3 h-3" />
                            </Button>
                        </div>
                        <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-hide">
                            {/* Re-using ReactionRain logic but simplified for mobile row */}
                            <ReactionRain roomId={roomId || ""} userId={currentUserId} inline={true} />
                        </div>
                    </div>
                )}

                {/* Reply indicator */}
                {replyingTo && (
                    <div className="px-4 py-2 bg-slate-700/50 border-t border-slate-600 flex items-center justify-between">
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

                {/* Poll/Event Creator Mobile Popups */}
                {showPollCreator && (
                    <div className="absolute bottom-full mb-2 left-2 right-2 z-50 shadow-2xl">
                        <PollCreator onSend={handleSendPoll} onCancel={() => setShowPollCreator(false)} />
                    </div>
                )}

                {showEventCreator && (
                    <div className="absolute bottom-full mb-2 left-2 right-2 z-50 shadow-2xl">
                        <EventCreator onSend={handleSendEvent} onCancel={() => setShowEventCreator(false)} />
                    </div>
                )}

                {/* Attachment menu popup - now absolute above input */}
                {showAttachments && (
                    <div className="absolute bottom-full mb-3 left-3 right-3 z-[70] animate-in slide-in-from-bottom-2 duration-200">
                        <div className="shadow-2xl rounded-3xl overflow-hidden border border-slate-700/50">
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
                    className="flex items-end gap-2 p-3"
                    onSubmit={(e) => {
                        e.preventDefault()
                        handleSendMessage()
                    }}
                >
                    {/* Attachment button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className={`h-10 w-10 rounded-full shrink-0 transition-colors ${showAttachments ? 'bg-cyan-500 text-white' : 'bg-slate-700 text-gray-300'}`}
                        onClick={() => setShowAttachments(!showAttachments)}
                    >
                        <Plus className={`w-5 h-5 transition-transform ${showAttachments ? 'rotate-45' : ''}`} />
                    </Button>

                    {/* Text input */}
                    <div className="flex-1 relative">
                        <Input
                            ref={inputRef}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder={isRecording ? "Recording..." : "Type a message..."}
                            disabled={isRecording}
                            inputMode={isKeyboardEnabled ? "none" : undefined}
                            className="bg-slate-700 border-slate-600 text-white placeholder:text-gray-400 h-10 pr-10 rounded-full"
                        />
                    </div>

                    <div className="flex items-center gap-1">
                        {/* Emoji button next to mic */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-full bg-slate-700 text-gray-300 shrink-0 haptic"
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        >
                            <Smile className={`w-5 h-5 ${showEmojiPicker ? 'text-cyan-400' : ''}`} />
                        </Button>

                        {/* Virtual keyboard toggle */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className={`h-10 w-10 rounded-full shrink-0 transition-colors ${isKeyboardEnabled ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-gray-300'} haptic`}
                            onClick={() => toggleKeyboard()}
                            title="Toggle virtual keyboard"
                        >
                            <Keyboard className="w-5 h-5" />
                        </Button>

                        {/* Action button - mic or send */}
                        {message.trim() ? (
                            <Button
                                type="submit"
                                size="icon"
                                className="h-10 w-10 rounded-full bg-cyan-500 hover:bg-cyan-600 text-white shrink-0"
                            >
                                <Send className="w-5 h-5" />
                            </Button>
                        ) : (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 rounded-full bg-slate-700 text-gray-300 shrink-0 haptic"
                                onClick={() => setIsRecording(!isRecording)}
                            >
                                <Mic className={`w-5 h-5 ${isRecording ? 'text-red-400' : ''}`} />
                            </Button>
                        )}
                    </div>
                </form>

                <EmojiPicker
                    isOpen={showEmojiPicker}
                    onClose={() => setShowEmojiPicker(false)}
                    onEmojiSelect={handleEmojiSelect}
                />

                {/* Vanish Mode Modal for Mobile */}
                <VanishModeModal
                    isOpen={showVanishModal}
                    onClose={() => setShowVanishModal(false)}
                    onVanishModeSelect={(mode, duration) => {
                        setVanishMode(mode)
                        setVanishDuration(duration)
                    }}
                    currentMode={vanishMode}
                    currentDuration={vanishDuration}
                />

                {/* Virtual Keyboard */}
                <VirtualKeyboard
                    inputRef={inputRef}
                />
            </div>
        )
    }

    // Desktop layout
    return (
        <div className="flex flex-col gap-2 z-30 flex-shrink-0 p-4 relative">
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

            {/* Poll/Event Creator Desktop Backdrop */}
            {(showPollCreator || showEventCreator) && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={(e) => {
                        e.stopPropagation()
                        setShowPollCreator(false)
                        setShowEventCreator(false)
                    }}
                    role="button"
                    tabIndex={-1}
                />
            )}

            {/* Poll/Event Creator Desktop Popups */}
            {showPollCreator && (
                <div className="absolute bottom-[72px] left-4 z-50 w-[340px] shadow-2xl">
                    <PollCreator onSend={handleSendPoll} onCancel={() => setShowPollCreator(false)} />
                </div>
            )}

            {showEventCreator && (
                <div className="absolute bottom-[72px] left-4 z-50 w-[340px] shadow-2xl">
                    <EventCreator onSend={handleSendEvent} onCancel={() => setShowEventCreator(false)} />
                </div>
            )}


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

                <Input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type a message..."
                    className="flex-1 bg-slate-800/80 border-transparent text-white placeholder-gray-400 min-h-[44px] text-base rounded-full"
                    maxLength={1000}
                />

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
                <ReactionRain roomId={roomId || ""} userId={currentUserId} />

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

            {/* Vanish Mode Modal */}
            <VanishModeModal
                isOpen={showVanishModal}
                onClose={() => setShowVanishModal(false)}
                onVanishModeSelect={(mode, duration) => {
                    setVanishMode(mode)
                    setVanishDuration(duration)
                }}
                currentMode={vanishMode}
                currentDuration={vanishDuration}
            />
        </div>
    )
}
