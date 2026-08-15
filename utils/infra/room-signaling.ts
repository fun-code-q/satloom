import { getFirebaseDatabase } from "@/lib/firebase"
import { ref, push, set, onChildAdded, serverTimestamp } from "firebase/database"
import { ReactionEmoji } from "./reaction-rain"

export interface RoomReaction {
    emoji: ReactionEmoji
    userId: string
    userName: string
    timestamp: any
}

class RoomSignaling {
    private static instance: RoomSignaling
    private listeners: Map<string, (reaction: RoomReaction) => void> = new Map()

    static getInstance(): RoomSignaling {
        if (!RoomSignaling.instance) {
            RoomSignaling.instance = new RoomSignaling()
        }
        return RoomSignaling.instance
    }

    async sendReaction(roomId: string, emoji: ReactionEmoji, userId: string, userName: string) {
        try {
            const db = getFirebaseDatabase()
            if (!db) return

            const reactionsRef = ref(db, `rooms/${roomId}/reactions`)
            const newReactionRef = push(reactionsRef)
            await set(newReactionRef, {
                emoji,
                userId,
                userName,
                timestamp: serverTimestamp()
            })
        } catch (error) {
            console.error("Failed to send room reaction:", error)
        }
    }

    listenForReactions(roomId: string, callback: (reaction: RoomReaction) => void) {
        const db = getFirebaseDatabase()
        if (!db) return () => {}

        const reactionsRef = ref(db, `rooms/${roomId}/reactions`)
        
        // Only listen for new reactions (since now)
        const now = Date.now()
        
        const unsubscribe = onChildAdded(reactionsRef, (snapshot) => {
            const data = snapshot.val()
            if (data && data.timestamp && (typeof data.timestamp === 'number' ? data.timestamp : Date.now()) > now - 5000) {
                callback(data as RoomReaction)
            }
        })

        // Call the Unsubscribe that onChildAdded returned.
        //
        // This used to be `off(reactionsRef, "child_added", unsubscribe)`.
        // off()'s third argument is the ORIGINAL snapshot callback, and it
        // matches by identity — passing the unsubscribe function instead
        // matched nothing, so the listener was never detached. Every
        // re-subscribe stacked another live listener, and each one re-fired
        // the same remote reaction, multiplying the 60fps rain animation.
        return () => {
            unsubscribe()
        }
    }
}

export const roomSignaling = RoomSignaling.getInstance()
