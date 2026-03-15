"use client"

import { useEffect, useRef } from "react"
import { reactionRain } from "@/utils/infra/reaction-rain"
import { roomSignaling } from "@/utils/infra/room-signaling"
import { useChatStore } from "@/stores/chat-store"

interface ReactionRainViewProps {
    roomId: string
}

export function ReactionRainView({ roomId }: ReactionRainViewProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const { onlineUsers } = useChatStore()

    useEffect(() => {
        if (!containerRef.current) return

        // Set up the container for gravity effects
        reactionRain.setContainer(containerRef.current)

        // Listen for remote reactions from signaling
        const unsubscribeSignaling = roomSignaling.listenForReactions(roomId, (reaction) => {
            // Pass total users count from store to calculate majority threshold
            reactionRain.addReaction(reaction.emoji, reaction.userId, onlineUsers.length)
        })

        return () => {
            unsubscribeSignaling()
            reactionRain.clear()
        }
    }, [roomId, onlineUsers.length])

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 pointer-events-none z-[9999]"
            style={{ position: "fixed" as const, inset: 0 }}
        />
    )
}
