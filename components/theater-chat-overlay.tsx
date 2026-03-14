"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, X, MessageSquare } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageStorage } from "@/utils/infra/message-storage"

export interface Message {
    id: string
    text: string
    sender: string
    senderId: string
    timestamp: number
    type: "text" | "image" | "file" | "audio" | "poll" | "event"
}

interface TheaterChatOverlayProps {
    isOpen: boolean
    onClose: () => void
    messages: Message[]
    roomId: string
    currentUser: string
    currentUserId: string
}

export function TheaterChatOverlay({
    isOpen,
    onClose,
    messages,
    roomId,
    currentUser,
    currentUserId,
}: TheaterChatOverlayProps) {
    const [inputText, setInputText] = useState("")
    const scrollRef = useRef<HTMLDivElement>(null)

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages, isOpen])

    const handleSend = async () => {
        if (!inputText.trim()) return
        const textToSend = inputText.trim()
        setInputText("")

        try {
            const messageStorage = MessageStorage.getInstance()
            const newMessage = {
                text: textToSend,
                sender: currentUser,
                senderId: currentUserId,
                timestamp: new Date(),
                reactions: {
                    heart: [],
                    thumbsUp: [],
                },
            }

            await messageStorage.sendMessage(roomId, newMessage, currentUserId)
        } catch (error) {
            console.error("Failed to send message:", error)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    if (!isOpen) return null

    const isOwnMessage = (msg: Message) => {
        return msg.senderId === currentUserId || (!msg.senderId && msg.sender === currentUser)
    }

    return (
        <div className="fixed sm:absolute bottom-20 sm:bottom-24 right-4 left-4 sm:left-auto w-auto sm:w-80 max-h-[50vh] sm:max-h-[70vh] bg-slate-950/40 backdrop-blur-3xl rounded-3xl sm:rounded-2xl border border-white/10 flex flex-col shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[70] animate-in fade-in slide-in-from-bottom-4 sm:slide-in-from-right-4 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-2 text-white">
                    <MessageSquare className="w-4 h-4 text-cyan-400" />
                    <span className="font-bold text-xs tracking-wider uppercase">Live Chat</span>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-gray-400 hover:text-white"
                    onClick={onClose}
                >
                    <X className="w-3 h-3" />
                </Button>
            </div>

            {/* Messages */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent"
            >
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex flex-col ${isOwnMessage(msg) ? "items-end" : "items-start"}`}
                    >
                        <div className="flex items-baseline gap-2 mb-1">
                            <span className={`text-xs font-medium ${isOwnMessage(msg) ? "text-cyan-400" : "text-gray-300"}`}>
                                {msg.sender}
                            </span>
                            <span className="text-[10px] text-gray-500">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>

                        <div
                            className={`px-3 py-2 rounded-2xl max-w-[85%] text-xs break-words shadow-sm ${isOwnMessage(msg)
                                ? "bg-cyan-500/30 text-white rounded-tr-none border border-cyan-500/20"
                                : "bg-white/10 text-white rounded-tl-none border border-white/10"
                                }`}
                        >
                            {(!msg.type || msg.type === "text") ? (
                                msg.text
                            ) : (
                                <span className="italic opacity-60">[{msg.type} message]</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Input */}
            <div className="p-4 bg-white/5 border-t border-white/5">
                <div className="relative">
                    <Input
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Say something..."
                        className="pr-12 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-cyan-500/50 rounded-2xl h-11 text-xs"
                    />
                    <Button
                        size="icon"
                        className="absolute right-1 top-1 h-9 w-9 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl shadow-lg shadow-cyan-500/20"
                        onClick={handleSend}
                        disabled={!inputText.trim()}
                    >
                        <Send className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
