"use client"

import { useEffect, useState } from "react"
import { reactionRain, ReactionEmoji } from "@/utils/infra/reaction-rain"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Sparkles } from "lucide-react"
import { telemetry } from "@/utils/core/telemetry"
import { roomSignaling } from "@/utils/infra/room-signaling"

interface ReactionRainProps {
    roomId: string
    userId: string
    inline?: boolean
}

const REACTIONS: { emoji: ReactionEmoji; label: string; color: string }[] = [
    { emoji: "❤️", label: "Love", color: "#ef4444" },
    { emoji: "😂", label: "Lol", color: "#eab308" },
    { emoji: "😮", label: "Wow", color: "#8b5cf6" },
    { emoji: "😢", label: "Sad", color: "#3b82f6" },
    { emoji: "👏", label: "Clap", color: "#22c55e" },
    { emoji: "🔥", label: "Fire", color: "#f97316" },
    { emoji: "🎉", label: "Party", color: "#ec4899" },
    { emoji: "💯", label: "100", color: "#06b6d4" },
]

export function ReactionRain({ roomId, userId, inline = false }: ReactionRainProps) {
    const [counts, setCounts] = useState<Record<ReactionEmoji, number>>({
        "❤️": 0,
        "😂": 0,
        "😮": 0,
        "😢": 0,
        "👏": 0,
        "🔥": 0,
        "🎉": 0,
        "💯": 0,
    })
    const [isOpen, setIsOpen] = useState(false)

    useEffect(() => {
        // Subscribe to reaction counts for UI badges
        const unsubscribe = reactionRain.subscribe((emoji, count) => {
            setCounts((prev) => ({
                ...prev,
                [emoji]: count,
            }))
        })

        return () => {
            unsubscribe()
        }
    }, [])

    const handleReaction = (emoji: ReactionEmoji) => {
        // Send to signaling
        roomSignaling.sendReaction(roomId, emoji, userId, "") 
        telemetry.logEvent('emoji_sent', roomId, userId, 'Room React', { emoji, type: 'rain' })
        setIsOpen(false)
    }

    const renderEmojiList = () => (
        <div className={`flex flex-wrap gap-2 ${inline ? 'justify-start' : 'justify-center w-[210px]'}`}>
            {REACTIONS.map((reaction) => (
                <button
                    key={reaction.emoji}
                    onClick={() => handleReaction(reaction.emoji)}
                    className="relative flex items-center justify-center w-10 h-10 rounded-full bg-slate-700 hover:bg-slate-600 transition-all active:scale-90"
                    style={{ borderColor: reaction.color, borderWidth: "2px" }}
                    title={reaction.label}
                >
                    <span className="text-xl">{reaction.emoji}</span>
                    {counts[reaction.emoji] > 0 && (
                        <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full text-[10px] font-bold text-white z-10">
                            {counts[reaction.emoji]}
                        </span>
                    )}
                </button>
            ))}
        </div>
    )

    return (
        <>
            {inline ? (
                renderEmojiList()
            ) : (
                <Popover open={isOpen} onOpenChange={setIsOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-gray-400 hover:text-white hover:bg-slate-700 h-10 w-10 flex-shrink-0 haptic"
                            title="React to room"
                        >
                            <Sparkles className="w-5 h-5" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent side="top" align="center" sideOffset={10} className="w-auto p-3 bg-slate-800/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-xl">
                        {renderEmojiList()}
                    </PopoverContent>
                </Popover>
            )}
        </>
    )
}
