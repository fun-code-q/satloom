"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { reactionRain } from "@/utils/infra/reaction-rain"
import { roomSignaling } from "@/utils/infra/room-signaling"
import { useChatStore } from "@/stores/chat-store"

interface ReactionRainViewProps {
    roomId: string
}

export function ReactionRainView({ roomId }: ReactionRainViewProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const { onlineUsers } = useChatStore()
    // document.body is only available after mount; this is a static export.
    const [mounted, setMounted] = useState(false)
    useEffect(() => setMounted(true), [])

    // Read the live count inside the callback without making it a dependency.
    // The subscription used to re-run on every onlineUsers.length change —
    // i.e. every join and leave — which, combined with the unsubscribe bug in
    // room-signaling, stacked a new permanent listener each time. In a busy
    // room one remote emoji then triggered N simultaneous 60fps rain bursts.
    const onlineCountRef = useRef(onlineUsers.length)
    onlineCountRef.current = onlineUsers.length

    // `mounted` is a dependency because the layer is portalled: on the first
    // pass the portal has not rendered yet, so containerRef is still null and
    // this bails out. Without re-running once mounted flips, the container is
    // never registered and no reaction ever draws.
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
    }, [roomId, mounted])

    // Portal to <body> so the layer competes in the ROOT stacking context.
    //
    // This used to render inside the chat shell, whose wrapper is
    // position:fixed — and fixed positioning always creates a stacking
    // context. That trapped this layer's z-index inside the shell, so it was
    // compared against its siblings there, not against the surfaces that sit
    // above it. Every full-screen surface (games, theater, whiteboard,
    // presentation, calls) is portalled to <body> with its own z-index, so all
    // of them painted over the rain and the reaction was invisible while any
    // of them was open.
    //
    // z-index is above every portalled surface (the highest in use is the
    // soundboard at 99999) and the layer never takes pointer events, so
    // nothing underneath becomes unclickable.
    if (!mounted) return null
    return createPortal(
        <div
            ref={containerRef}
            className="fixed inset-0 pointer-events-none z-[100000]"
            style={{ position: "fixed" as const, inset: 0 }}
        />,
        document.body
    )
}
