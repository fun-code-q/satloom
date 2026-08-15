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

    // Read the live count inside the callback without making it a dependency.
    // The subscription used to re-run on every onlineUsers.length change —
    // i.e. every join and leave — which, combined with the unsubscribe bug in
    // room-signaling, stacked a new permanent listener each time. In a busy
    // room one remote emoji then triggered N simultaneous 60fps rain bursts.
    const onlineCountRef = useRef(onlineUsers.length)
    onlineCountRef.current = onlineUsers.length

    useEffect(() => {
        if (!containerRef.current) return

        // Set up the container for gravity effects
        reactionRain.setContainer(containerRef.current)

        // Listen for remote reactions from signaling
        const unsubscribeSignaling = roomSignaling.listenForReactions(roomId, (reaction) => {
            // Pass total users count from store to calculate majority threshold
            reactionRain.addReaction(reaction.emoji, reaction.userId, onlineCountRef.current)
        })

        return () => {
            unsubscribeSignaling()
            reactionRain.clear()
        }
    }, [roomId])

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 pointer-events-none z-[9999]"
            style={{ position: "fixed" as const, inset: 0 }}
        />
    )
}
