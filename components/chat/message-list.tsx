
"use client"

import { Message, MessageBubble } from "@/components/message-bubble"
import { useChatStore } from "@/stores/chat-store"
import { useEffect, useRef, useCallback, useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useShallow } from "zustand/react/shallow"

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

interface SeparatorDisplayItem {
    id: string
    itemType: "separator"
    label: string
}

interface MessageDisplayItem {
    id: string
    itemType: "message"
    message: Message
    isFirstInGroup: boolean
    isLastInGroup: boolean
}

type DisplayItem = SeparatorDisplayItem | MessageDisplayItem

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
    const { messages, currentUser, onlineUsers, roomMembers, roomId, searchQuery } = useChatStore(
        useShallow((state) => ({
            messages: state.messages,
            currentUser: state.currentUser,
            onlineUsers: state.onlineUsers,
            roomMembers: state.roomMembers,
            roomId: state.roomId,
            searchQuery: state.searchQuery,
        }))
    )
    const parentRef = useRef<HTMLDivElement>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const displayItemsRef = useRef<DisplayItem[]>([])
    const previousMessageCountRef = useRef(messages.length)
    const scrollRafRef = useRef<number | null>(null)
    const [headerHeight, setHeaderHeight] = useState(120)
    const [showJumpToBottom, setShowJumpToBottom] = useState(false)
    const [unreadInFab, setUnreadInFab] = useState(0)
    const normalizedQuery = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery])

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
        if (!normalizedQuery) return messages

        return messages.filter((msg) => {
            const messageText = msg.text?.toLowerCase() || ""
            return (
                messageText.includes(normalizedQuery) ||
                msg.sender?.toLowerCase().includes(normalizedQuery)
            )
        })
    }, [messages, normalizedQuery])

    const displayItems = useMemo<DisplayItem[]>(() => {
        const items: DisplayItem[] = []
        let lastDateString = ""
        const today = new Date().toLocaleDateString([], {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
        })
        const yesterday = new Date(Date.now() - 86400000).toLocaleDateString([], {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
        })

        filteredMessages.forEach((msg: Message, index) => {
            const prevMsg = index > 0 ? filteredMessages[index - 1] : null
            const nextMsg = index < filteredMessages.length - 1 ? filteredMessages[index + 1] : null
            const date = new Date(msg.timestamp)
            const dateString = date.toLocaleDateString([], {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
            })

            if (dateString !== lastDateString) {
                let label = dateString
                if (dateString === today) label = "Today"
                else if (dateString === yesterday) label = "Yesterday"

                items.push({
                    id: `date-${dateString}`,
                    itemType: "separator",
                    label,
                })
                lastDateString = dateString
            }

            items.push({
                id: msg.id,
                itemType: "message",
                message: msg,
                isFirstInGroup: !prevMsg || prevMsg.sender !== msg.sender,
                isLastInGroup: !nextMsg || nextMsg.sender !== msg.sender,
            })
        })

        return items
    }, [filteredMessages])

    useEffect(() => {
        displayItemsRef.current = displayItems
    }, [displayItems])

    const avatarByName = useMemo(() => {
        const map = new Map<string, string>()

        roomMembers.forEach((member) => {
            if (member.name && member.avatar) {
                map.set(member.name, member.avatar)
            }
        })

        onlineUsers.forEach((user) => {
            if (user.name && user.avatar) {
                map.set(user.name, user.avatar)
            }
        })

        return map
    }, [onlineUsers, roomMembers])

    const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior, block: "end" })
        }
    }, [])

    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const container = e.currentTarget
        if (scrollRafRef.current !== null) return

        scrollRafRef.current = window.requestAnimationFrame(() => {
            scrollRafRef.current = null
            const { scrollTop, scrollHeight, clientHeight } = container
            const isFarUp = scrollHeight - scrollTop - clientHeight > 400

            setShowJumpToBottom((prev) => (prev === isFarUp ? prev : isFarUp))
            if (!isFarUp) {
                setUnreadInFab((prev) => (prev === 0 ? prev : 0))
            }
        })
    }, [])

    // Virtualizer for message list - significantly improves performance for large message lists
    const rowVirtualizer = useVirtualizer({
        count: displayItems.length,
        getScrollElement: () => parentRef.current,
        getItemKey: (index) => displayItems[index]?.id ?? `row-${index}`,
        estimateSize: (index) => displayItems[index]?.itemType === "separator" ? 50 : 120,
        overscan: 8,
    })

    useEffect(() => {
        rowVirtualizer.measure()
    }, [displayItems.length, rowVirtualizer])

    useEffect(() => {
        const nextMessageCount = messages.length
        const newMessageCount = Math.max(0, nextMessageCount - previousMessageCountRef.current)
        previousMessageCountRef.current = nextMessageCount

        const container = parentRef.current
        if (!container) return

        if (normalizedQuery) {
            setUnreadInFab(0)
            return
        }

        const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
        const isNearBottom = distanceFromBottom < 120

        if (isNearBottom || nextMessageCount <= 10) {
            scrollToBottom(nextMessageCount <= 10 ? "auto" : "smooth")
            setShowJumpToBottom(false)
            setUnreadInFab(0)
            return
        }

        if (newMessageCount > 0) {
            setShowJumpToBottom(true)
            setUnreadInFab((prev) => prev + newMessageCount)
        }
    }, [messages.length, normalizedQuery, scrollToBottom])

    useEffect(() => {
        return () => {
            if (scrollRafRef.current !== null) {
                window.cancelAnimationFrame(scrollRafRef.current)
            }
        }
    }, [])

    const handleReplyClick = useCallback((replyId: string) => {
        const index = displayItemsRef.current.findIndex(item => item.id === replyId)
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
    }, [rowVirtualizer])
    return (
        <div className="flex-1 flex flex-col min-h-0 relative z-[10]">
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
 
                {displayItems.length > 0 && (
                    <div
                        style={{
                            height: `${rowVirtualizer.getTotalSize()}px`,
                            width: "100%",
                            position: "relative",
                        }}
                    >
                        {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                            const item = displayItems[virtualItem.index]
                            
                            if (item?.itemType === "separator") {
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
                                            {item.label}
                                        </div>
                                    </div>
                                )
                            }

                            if (!item || item.itemType !== "message") return null
                            const msg = item.message
                            return (
                                <div
                                    key={virtualItem.key}
                                    data-index={virtualItem.index}
                                    ref={rowVirtualizer.measureElement}
                                    className="message-virtual-row"
                                    style={{
                                        position: "absolute",
                                        top: 0,
                                        left: 0,
                                        width: "100%",
                                        minHeight: "40px",
                                        transform: `translateY(${virtualItem.start}px)`,
                                    }}
                                >
                                    <MessageBubble
                                        message={msg}
                                        isOwnMessage={msg.sender === currentUser?.name}
                                        userColor={getUserColor(msg.sender)}
                                        currentUser={currentUser?.name || ""}
                                        userAvatar={avatarByName.get(msg.sender)}
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
                                        isFirstInGroup={item.isFirstInGroup}
                                        isLastInGroup={item.isLastInGroup}
                                        isConsecutive={!item.isFirstInGroup}
                                    />
                                </div>
                            )
                        })}
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
 
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
                >
                    <Button
                        size="icon"
                        className="rounded-xl h-12 w-12 bg-slate-900/90 backdrop-blur-xl border border-white/10 text-cyan-400 shadow-2xl hover:scale-110 active:scale-95 transition-all relative"
                        onClick={() => scrollToBottom("smooth")}
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
