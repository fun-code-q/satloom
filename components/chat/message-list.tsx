
"use client"

import { Message, MessageBubble } from "@/components/message-bubble"
import { useChatStore } from "@/stores/chat-store"
import { useEffect, useRef, useCallback, useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { X, ChevronDown } from "lucide-react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { ChatSearch } from "./chat-search"

interface MessageListProps {
    onReply: (message: Message) => void
    onReact: (messageId: string, reaction: "heart" | "thumbsUp", userId: string) => void
    onDelete: (messageId: string) => void
    onEdit: (messageId: string, newText: string) => void
    onCopy: (text: string) => void
    onVote: (messageId: string, optionIndex: number) => void
    onRSVP: (messageId: string, status: "going" | "maybe" | "notGoing") => void
    onPin: (id: string) => void
    // Helpers
    getUserColor: (username: string) => string
    showSearch: boolean
}

export function MessageList({
    onReply,
    onReact,
    onDelete,
    onEdit,
    onCopy,
    onVote,
    onRSVP,
    onPin,
    getUserColor,
    showSearch
}: MessageListProps) {
    const { messages, currentUser, onlineUsers, roomMembers, roomId, replyingTo, setReplyingTo, searchQuery } = useChatStore()
    const parentRef = useRef<HTMLDivElement>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const [headerHeight, setHeaderHeight] = useState(120)
    const [showJumpToBottom, setShowJumpToBottom] = useState(false)
    const [unreadInFab, setUnreadInFab] = useState(0)

    // Dynamically measure actual header height so first message is never hidden beneath it
    useEffect(() => {
        // The chat header renders as position:absolute within the parent container
        // We target it by its known z-index class or data attribute
        const updateHeight = () => {
            // Use the stable data attribute added to the chat header
            const header = document.querySelector('[data-chat-header]') as HTMLElement
            if (header) {
                setHeaderHeight(header.offsetHeight + 8) // +8px breathing room
            }
        }

        updateHeight()

        const observer = new ResizeObserver(updateHeight)
        const header = document.querySelector('[data-chat-header]') as HTMLElement
        if (header) observer.observe(header)

        // Also update on window resize (mobile orientation changes)
        window.addEventListener('resize', updateHeight)
        return () => {
            observer.disconnect()
            window.removeEventListener('resize', updateHeight)
        }
    }, [])

    // List of items including messages and date separators
    const filteredMessages = useMemo(() => {
        return messages.filter((msg) => {
            const messageText = msg.text?.toLowerCase() || ""
            return (
                messageText.includes(searchQuery.toLowerCase()) ||
                msg.sender?.toLowerCase().includes(searchQuery.toLowerCase())
            )
        })
    }, [messages, searchQuery])

    const displayItems = useMemo(() => {
        const items: (Message | { id: string; type: 'separator'; label: string })[] = []
        let lastDateString = ""

        filteredMessages.forEach((msg: Message) => {
            const date = new Date(msg.timestamp)
            const dateString = date.toLocaleDateString([], { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            })

            if (dateString !== lastDateString) {
                // Determine display label (Today, Yesterday, or Full Date)
                const today = new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                const yesterday = new Date(Date.now() - 86400000).toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                
                let label = dateString
                if (dateString === today) label = "Today"
                else if (dateString === yesterday) label = "Yesterday"

                items.push({ 
                    id: `date-${dateString}`, 
                    type: 'separator', 
                    label 
                })
                lastDateString = dateString
            }
            items.push(msg)
        })
        return items
    }, [filteredMessages])

    // Track scroll for FAB
    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
        const isFarUp = scrollHeight - scrollTop - clientHeight > 400
        setShowJumpToBottom(isFarUp)
        if (!isFarUp) setUnreadInFab(0)
    }

    // Auto-scroll to bottom when new messages arrive
    const scrollToBottom = useCallback(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
        }
    }, [])

    useEffect(() => {
        // Only auto-scroll if we're not searching and we're near the bottom
        if (parentRef.current && !searchQuery) {
            const { scrollTop, scrollHeight, clientHeight } = parentRef.current
            const isNearBottom = scrollHeight - scrollTop - clientHeight < 100

            if (isNearBottom || messages.length <= 10) {
                scrollToBottom()
            }
        }
    }, [messages, scrollToBottom, searchQuery])

    // Virtualizer for message list - significantly improves performance for large message lists
    const rowVirtualizer = useVirtualizer({
        count: displayItems.length,
        getScrollElement: () => parentRef.current,
        estimateSize: (index) => displayItems[index]?.type === 'separator' ? 50 : 120,
        overscan: 5,
    })

    // Force re-measurement when messages list changes to prevent overlaps
    useEffect(() => {
        rowVirtualizer.measure()
        if (!showJumpToBottom) {
             scrollToBottom()
        } else {
             setUnreadInFab(prev => prev + 1)
        }
    }, [displayItems.length, rowVirtualizer])

    const handleReplyClick = (replyId: string) => {
        const index = displayItems.findIndex(item => item.id === replyId)
        if (index !== -1) {
            rowVirtualizer.scrollToIndex(index, { align: 'center', behavior: 'smooth' })
            
            // Elite highlight after virtualization settles
            setTimeout(() => {
                const element = document.getElementById(`message-${replyId}`)
                if (element) {
                    element.classList.add("highlight-reply")
                    setTimeout(() => element.classList.remove("highlight-reply"), 2000)
                }
            }, 600)
        }
    }
    return (
        <div className="flex-1 flex flex-col min-h-0 relative z-[10]">
            {showSearch && <ChatSearch />}
            {/* Chat Messages Area */}
            <div
                ref={parentRef}
                className="flex-1 px-4 pb-4 overflow-y-auto message-list flex flex-col scroll-smooth"
                style={{ paddingTop: `${headerHeight}px` }}
                onScroll={handleScroll}
            >
                {displayItems.length === 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400 animate-in fade-in zoom-in duration-1000 p-8">
                        <div className="text-8xl mb-6 drop-shadow-[0_0_30px_rgba(34,211,238,0.3)] animate-bounce select-none">
                            {searchQuery ? "🔍" : "💬"}
                        </div>
                        <h3 className="text-4xl font-black text-white mb-3 tracking-tighter uppercase italic">
                            {searchQuery ? "No results found!" : "No message yet!"}
                        </h3>
                        <p className="text-xl text-cyan-400/80 font-medium tracking-wide">
                            {searchQuery ? "Try a different keyword" : "Start conversation"}
                        </p>
                    </div>
                )}
 
                {filteredMessages.length > 0 && (
                    <div
                        style={{
                            height: `${rowVirtualizer.getTotalSize()}px`,
                            width: "100%",
                            position: "relative",
                        }}
                    >
                        {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                            const item = displayItems[virtualItem.index]
                            
                            if (item.type === 'separator') {
                                return (
                                    <div
                                        key={virtualItem.key}
                                        ref={rowVirtualizer.measureElement}
                                        className="flex justify-center p-6 pb-2"
                                        style={{
                                            position: "absolute",
                                            top: 0,
                                            left: 0,
                                            width: "100%",
                                            transform: `translateY(${virtualItem.start}px)`,
                                        }}
                                    >
                                        <div className="bg-slate-800/80 backdrop-blur-md px-4 py-1 rounded-full border border-white/5 text-[10px] uppercase tracking-[0.15em] font-bold text-gray-400 shadow-xl">
                                            {(item as any).label}
                                        </div>
                                    </div>
                                )
                            }

                            const msg = item as Message
                            return (
                                <div
                                    key={virtualItem.key}
                                    data-index={virtualItem.index}
                                    ref={rowVirtualizer.measureElement}
                                    style={{
                                        position: "absolute",
                                        top: 0,
                                        left: 0,
                                        width: "100%",
                                        minHeight: "40px",
                                        transform: `translateY(${virtualItem.start}px)`,
                                    }}
                                >
                                    {(() => {
                                        // Find neighbors while ignoring separators
                                        let prevMsgIdx = virtualItem.index - 1
                                        while (prevMsgIdx >= 0 && (displayItems[prevMsgIdx] as any).type === 'separator') prevMsgIdx--
                                        const prevMsg = prevMsgIdx >= 0 ? displayItems[prevMsgIdx] as Message : null
                                        
                                        let nextMsgIdx = virtualItem.index + 1
                                        while (nextMsgIdx < displayItems.length && (displayItems[nextMsgIdx] as any).type === 'separator') nextMsgIdx++
                                        const nextMsg = nextMsgIdx < displayItems.length ? displayItems[nextMsgIdx] as Message : null
                                        
                                        const isFirstInGroup = !prevMsg || prevMsg.sender !== msg.sender
                                        const isLastInGroup = !nextMsg || nextMsg.sender !== msg.sender
                                        const isConsecutive = !isFirstInGroup
                                        
                                        return (
                                            <MessageBubble
                                                message={msg}
                                                isOwnMessage={msg.sender === currentUser?.name}
                                                userColor={getUserColor(msg.sender)}
                                                currentUser={currentUser?.name || ""}
                                                userAvatar={
                                                    roomMembers.find((m) => m.name === msg.sender)?.avatar ||
                                                    onlineUsers.find((u) => u.name === msg.sender)?.avatar
                                                }
                                                onReply={onReply}
                                                onReact={onReact}
                                                onDelete={onDelete}
                                                onEdit={onEdit}
                                                onCopy={onCopy}
                                                onVote={onVote}
                                                onRSVP={onRSVP}
                                                onPin={onPin}
                                                onReplyClick={handleReplyClick}
                                                roomId={roomId || ""}
                                                isFirstInGroup={isFirstInGroup}
                                                isLastInGroup={isLastInGroup}
                                                isConsecutive={isConsecutive}
                                            />
                                        )
                                    })()}
                                </div>
                            )
                        })}
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
 
            {/* Reply indicator */}
            {replyingTo && (
                <div className="px-4 py-2 bg-slate-800/60 border-t border-slate-700">
                    <div className="flex items-center justify-between bg-slate-700/50 rounded-lg p-2">
                        <div className="flex-1">
                            <div className="text-xs text-cyan-400 font-medium">Replying to {replyingTo.sender}</div>
                            <div className="text-xs text-gray-300 truncate">{replyingTo.text}</div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-gray-400 hover:text-white haptic"
                            onClick={() => setReplyingTo(null)}
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Typing Indicator */}
            {onlineUsers.some((u) => u.isTyping && u.name !== currentUser?.name) && (
                <div className="px-4 py-2 flex justify-start z-10 sticky bottom-0 pointer-events-none">
                    <div className="bg-slate-800/80 backdrop-blur-md rounded-2xl p-3 flex items-center gap-2 haptic-flash border border-slate-700/50 shadow-xl">
                        <div className="flex gap-1">
                            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"></div>
                        </div>
                        <span className="text-xs font-medium text-cyan-400/90 ml-2">
                            {(onlineUsers || [])
                                .filter((u) => u.isTyping && u.name !== currentUser?.name)
                                .map((u) => u.name)
                                .join(", ")}{" "}
                            is typing...
                        </span>
                    </div>
                </div>
            )}

            {/* Jump to Bottom FAB */}
            {showJumpToBottom && (
                <div 
                    className="absolute bottom-24 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 zoom-in duration-300"
                    onClick={scrollToBottom}
                >
                    <Button
                        size="icon"
                        className="rounded-xl h-12 w-12 bg-slate-900/90 backdrop-blur-xl border border-white/10 text-cyan-400 shadow-2xl hover:scale-110 active:scale-95 transition-all relative"
                    >
                        <ChevronDown className="w-6 h-6" />
                        {unreadInFab > 0 && (
                            <span className="absolute -top-2 -right-2 bg-cyan-500 text-slate-950 text-[10px] font-black px-1.5 py-0.5 rounded-md shadow-lg animate-bounce">
                                {unreadInFab}
                            </span>
                        )}
                    </Button>
                </div>
            )}
        </div>
    )
}
