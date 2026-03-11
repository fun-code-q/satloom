import { getFirebaseDatabase } from "@/lib/firebase"
import { ref, set, onValue, serverTimestamp } from "firebase/database"

export interface WhiteboardInvite {
    hostId: string
    hostName: string
    timestamp: number
}

class WhiteboardSignaling {
    private static instance: WhiteboardSignaling

    static getInstance(): WhiteboardSignaling {
        if (!WhiteboardSignaling.instance) {
            WhiteboardSignaling.instance = new WhiteboardSignaling()
        }
        return WhiteboardSignaling.instance
    }

    async broadcastInvite(roomId: string, hostId: string, hostName: string) {
        const db = getFirebaseDatabase()
        if (!db) return

        const inviteRef = ref(db, `rooms/${roomId}/whiteboardInvites/${hostId}`)
        await set(inviteRef, {
            hostId,
            hostName,
            timestamp: Date.now()
        })
    }

    listenForInvites(roomId: string, currentUserId: string, callback: (invite: WhiteboardInvite) => void) {
        const db = getFirebaseDatabase()
        if (!db) return () => { }

        const inviteRef = ref(db, `rooms/${roomId}/whiteboardInvites`)
        const unsubscribe = onValue(inviteRef, (snapshot) => {
            const data = snapshot.val()
            if (data) {
                const invites = Object.values(data) as WhiteboardInvite[]
                // Get the latest invite not from self
                const latestInvite = invites
                    .filter(inv => inv.hostId !== currentUserId)
                    .sort((a, b) => b.timestamp - a.timestamp)[0]

                if (latestInvite && (Date.now() - latestInvite.timestamp < 30000)) {
                    callback(latestInvite)
                }
            }
        })

        return unsubscribe
    }
}

export const whiteboardSignaling = WhiteboardSignaling.getInstance()
