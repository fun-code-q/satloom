
"use client"

import { Message, MessageBubble } from "@/components/message-bubble"
import { QuizQuestionBubble } from "@/components/quiz-question-bubble"
import { QuizResultsBubble } from "@/components/quiz-results-bubble"
import { useChatStore } from "@/stores/chat-store"
import { QuizAnswer, QuizResult, QuizSession } from "@/utils/games/quiz-system"
import { useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { ChatSearch } from "./chat-search"

interface MessageListProps {
    onReply: (message: Message) => void
    onReact: (messageId: string, reaction: "heart" | "thumbsUp", userId: string) => void
    onDelete: (messageId: string) => void
    onEdit: (messageId: string, newText: string) => void
    onCopy: (text: string) => void
    // Quiz props - passing these down for now until we move Quiz to store fully
    currentQuizSession: QuizSession | null
    quizTimeRemaining: number
    quizAnswers: QuizAnswer[]
    quizResults: QuizResult[]
    userQuizAnswer: string
    showQuizResults: boolean
    onQuizAnswer: (answer: string) => void
    onQuizExit: () => void
    onVote: (messageId: string, optionIndex: number) => void
    onRSVP: (messageId: string, status: "going" | "maybe" | "notGoing") => void
    onPin: (messageId: string) => void
    // Helpers
    getUserColor: (username: string) => string
    showSearch?: boolean
}

export function MessageList({
    onReply,
    onReact,
    onDelete,
    onEdit,
    onCopy,
    currentQuizSession,
    quizTimeRemaining,
    quizAnswers,
    quizResults,
    userQuizAnswer,
    showQuizResults,
    onQuizAnswer,
    onQuizExit,
    onVote,
    onRSVP,
    onPin,
    getUserColor,
    showSearch
}: MessageListProps) {
    const { messages, currentUser, onlineUsers, roomId, replyingTo, setReplyingTo, searchQuery } = useChatStore()
    const parentRef = useRef<HTMLDivElement>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Filter messages based on search query
    const filteredMessages = messages.filter((msg) =>
        msg.text.toLowerCase().includes(searchQuery.toLowerCase())
    )

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
        count: filteredMessages.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 120, // Better estimate for messages with avatars/formatting
        overscan: 5, // Number of items to render outside visible area for smoother scrolling
    })

    // Force re-measurement when messages list changes to prevent overlaps
    useEffect(() => {
        rowVirtualizer.measure()
    }, [filteredMessages.length, rowVirtualizer])

    const getQuizParticipants = () => {
        if (!currentQuizSession) return []

        // Include all participants, even if they're not currently online
        return currentQuizSession.participants.map((participantId) => {
            const user = onlineUsers.find((u) => u.id === participantId)
            const hasAnswered = quizAnswers.some(
                (a) =>
                    a.playerId === participantId &&
                    a.questionId === currentQuizSession.questions[currentQuizSession.currentQuestionIndex]?.id,
            )

            return {
                id: participantId,
                name: user?.name || "Unknown",
                hasAnswered,
            }
        })
    }

    const handleReplyClick = (replyId: string) => {
        const element = document.getElementById(`message-${replyId}`)
        if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" })
            // Optional: Add highlight effect
            element.classList.add("bg-slate-800/50")
            setTimeout(() => element.classList.remove("bg-slate-800/50"), 1000)
        }
    }

    return (
        <div className="flex-1 flex flex-col min-h-0 relative z-[10]">
            {showSearch && <ChatSearch />}
            {/* Chat Messages Area */}
            <div
                ref={parentRef}
                className="flex-1 p-4 overflow-y-auto message-list"
            >
                {filteredMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 animate-in fade-in zoom-in duration-1000 p-8">
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
                ) : (
                    <>
                        {/* Virtualized message list - only renders visible items */}
                        <div
                            style={{
                                height: `${rowVirtualizer.getTotalSize()}px`,
                                width: "100%",
                                position: "relative",
                            }}
                        >
                            {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                                const msg = filteredMessages[virtualItem.index]
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
                                            minHeight: "100px",
                                            transform: `translateY(${virtualItem.start}px)`,
                                        }}
                                    >
                                        <MessageBubble
                                            message={msg}
                                            isOwnMessage={msg.sender === currentUser?.name}
                                            userColor={getUserColor(msg.sender)}
                                            currentUser={currentUser?.name || ""}
                                            userAvatar={onlineUsers.find((u) => u.name === msg.sender)?.avatar}
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
                                        />
                                    </div>
                                )
                            })}
                        </div>

                        {/* Quiz Question */}
                        {currentQuizSession &&
                            currentQuizSession.status === "active" &&
                            currentQuizSession.questions[currentQuizSession.currentQuestionIndex] && (
                                <QuizQuestionBubble
                                    question={currentQuizSession.questions[currentQuizSession.currentQuestionIndex]}
                                    currentQuestionNumber={currentQuizSession.currentQuestionIndex + 1}
                                    totalQuestions={currentQuizSession.totalQuestions}
                                    timeRemaining={quizTimeRemaining}
                                    participants={getQuizParticipants()}
                                    userAnswer={userQuizAnswer}
                                    onAnswer={onQuizAnswer}
                                    onExit={onQuizExit}
                                    showResults={showQuizResults}
                                    correctAnswer={
                                        showQuizResults
                                            ? currentQuizSession.questions[currentQuizSession.currentQuestionIndex].correctAnswer
                                            : undefined
                                    }
                                    answers={
                                        showQuizResults
                                            ? quizAnswers.filter(
                                                (a) =>
                                                    a.questionId === currentQuizSession.questions[currentQuizSession.currentQuestionIndex].id,
                                            )
                                            : []
                                    }
                                />
                            )}

                        {/* Quiz Results */}
                        {currentQuizSession && currentQuizSession.status === "finished" && quizResults.length > 0 && (
                            <QuizResultsBubble results={quizResults} totalQuestions={currentQuizSession.totalQuestions} />
                        )}

                        {/* Typing indicator removed from here */}
                    </>
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
                            {onlineUsers
                                .filter((u) => u.isTyping && u.name !== currentUser?.name)
                                .map((u) => u.name)
                                .join(", ")}{" "}
                            is typing...
                        </span>
                    </div>
                </div>
            )}
        </div>
    )
}
