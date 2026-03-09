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
        <div className="absolute right-4 bottom-24 top-24 w-80 bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-700 flex flex-col shadow-2xl z-40 animate-in fade-in slide-in-from-right-4">
            {/* Header */}
            <div className="p-3 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white">
                    <MessageSquare className="w-4 h-4 text-cyan-400" />
                    <span className="font-medium text-sm">Live Chat</span>
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
                            className={`px-3 py-2 rounded-lg max-w-[90%] text-sm break-words ${isOwnMessage(msg)
                                ? "bg-cyan-600/50 text-white rounded-tr-none"
                                : "bg-slate-700/50 text-white rounded-tl-none"
                                }`}
                        >
                            {msg.type === "text" ? (
                                msg.text
                            ) : (
                                <span className="italic text-gray-300">[{msg.type} message]</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-slate-700">
                <div className="relative">
                    <Input
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message..."
                        className="pr-10 bg-slate-800 border-slate-600 text-white placeholder-gray-400 focus-visible:ring-cyan-500"
                    />
                    <Button
                        size="icon"
                        className="absolute right-1 top-1 h-8 w-8 bg-cyan-500 hover:bg-cyan-600 text-white rounded-md"
                        onClick={handleSend}
                        disabled={!inputText.trim()}
                    >
                        <Send className="w-3 h-3" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
