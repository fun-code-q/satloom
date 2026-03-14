import { getFirebaseDatabase } from "@/lib/firebase"
import { ref, push, set, onChildAdded, off, serverTimestamp } from "firebase/database"
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

        return () => {
            off(reactionsRef, "child_added", unsubscribe)
        }
    }
}

export const roomSignaling = RoomSignaling.getInstance()
