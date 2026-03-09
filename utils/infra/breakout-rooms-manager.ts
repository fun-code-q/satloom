import { getFirebaseDatabase } from "@/lib/firebase"
import { ref, set, remove, get, onValue, update } from "firebase/database"

export interface BreakoutRoom {
    id: string
    name: string
    createdAt: number
    createdBy: string
    participants: string[]
    maxParticipants: number
    isOpen: boolean
    mainRoomId: string
}

export interface BreakoutInvite {
    id: string
    breakoutRoomId: string
    breakoutRoomName: string
    fromUserId: string
    fromUserName: string
    toUserId: string
    timestamp: number
    status: "pending" | "accepted" | "declined"
}

export class BreakoutRoomsManager {
    private static instance: BreakoutRoomsManager
    private listeners: Array<() => void> = []
    private currentRoomId: string | null = null
    private currentUserId: string | null = null

    static getInstance(): BreakoutRoomsManager {
        if (!BreakoutRoomsManager.instance) {
            BreakoutRoomsManager.instance = new BreakoutRoomsManager()
        }
        return BreakoutRoomsManager.instance
    }

    // Create a breakout room
    async createBreakoutRoom(
        mainRoomId: string,
        breakoutRoomId: string,
        name: string,
        creatorId: string,
        creatorName: string,
        maxParticipants: number = 10
    ): Promise<boolean> {
        if (!getFirebaseDatabase()!) return false

        try {
            const breakoutRoom: BreakoutRoom = {
                id: breakoutRoomId,
                name,
                createdAt: Date.now(),
                createdBy: creatorId,
                participants: [creatorId],
                maxParticipants,
                isOpen: true,
                mainRoomId,
            }

            await set(ref(getFirebaseDatabase()!, `rooms/${mainRoomId}/breakoutRooms/${breakoutRoomId}`), breakoutRoom)
            return true
        } catch (error) {
            console.error("Failed to create breakout room:", error)
            return false
        }
    }

    // Join a breakout room
    async joinBreakoutRoom(
        mainRoomId: string,
        breakoutRoomId: string,
        userId: string,
        userName: string
    ): Promise<{ success: boolean; error?: string }> {
        if (!getFirebaseDatabase()!) return { success: false, error: "Database not available" }

        try {
            const roomRef = ref(getFirebaseDatabase()!, `rooms/${mainRoomId}/breakoutRooms/${breakoutRoomId}`)
            const snapshot = await get(roomRef)

            if (!snapshot.exists()) {
                return { success: false, error: "Breakout room not found" }
            }

            const room = snapshot.val() as BreakoutRoom

            if (!room.isOpen) {
                return { success: false, error: "Breakout room is closed" }
            }

            if (room.participants.length >= room.maxParticipants) {
                return { success: false, error: "Breakout room is full" }
            }

            if (room.participants.includes(userId)) {
                return { success: false, error: "Already in room" }
            }

            // Add user to breakout room
            const updatedParticipants = [...room.participants, userId]
            await update(ref(getFirebaseDatabase()!, `rooms/${mainRoomId}/breakoutRooms/${breakoutRoomId}`), {
                participants: updatedParticipants,
            })

            // Update user's presence to show they're in a breakout room
            await update(ref(getFirebaseDatabase()!, `rooms/${mainRoomId}/members/${userId}`), {
                currentBreakoutRoom: breakoutRoomId,
            })

            return { success: true }
        } catch (error) {
            console.error("Failed to join breakout room:", error)
            return { success: false, error: "Failed to join room" }
        }
    }

    // Leave breakout room
    async leaveBreakoutRoom(
        mainRoomId: string,
        breakoutRoomId: string,
        userId: string
    ): Promise<boolean> {
        if (!getFirebaseDatabase()!) return false

        try {
            const roomRef = ref(getFirebaseDatabase()!, `rooms/${mainRoomId}/breakoutRooms/${breakoutRoomId}`)
            const snapshot = await get(roomRef)

            if (!snapshot.exists()) {
                return false
            }

            const room = snapshot.val() as BreakoutRoom
            const updatedParticipants = room.participants.filter((p) => p !== userId)

            if (updatedParticipants.length === 0) {
                // Delete the room if no participants
                await remove(ref(getFirebaseDatabase()!, `rooms/${mainRoomId}/breakoutRooms/${breakoutRoomId}`))
            } else {
                await update(roomRef, {
                    participants: updatedParticipants,
                })
            }

            // Clear user's breakout room status
            await update(ref(getFirebaseDatabase()!, `rooms/${mainRoomId}/members/${userId}`), {
                currentBreakoutRoom: null,
            })

            return true
        } catch (error) {
            console.error("Failed to leave breakout room:", error)
            return false
        }
    }

    // Close a breakout room (creator only)
    async closeBreakoutRoom(
        mainRoomId: string,
        breakoutRoomId: string,
        requesterId: string
    ): Promise<{ success: boolean; error?: string }> {
        if (!getFirebaseDatabase()!) return { success: false, error: "Database not available" }

        try {
            const roomRef = ref(getFirebaseDatabase()!, `rooms/${mainRoomId}/breakoutRooms/${breakoutRoomId}`)
            const snapshot = await get(roomRef)

            if (!snapshot.exists()) {
                return { success: false, error: "Breakout room not found" }
            }

            const room = snapshot.val() as BreakoutRoom

            if (room.createdBy !== requesterId) {
                return { success: false, error: "Only the creator can close the room" }
            }

            // Notify all participants and close the room
            await remove(roomRef)

            // Clear breakout room status for all participants
            for (const participantId of room.participants) {
                await update(ref(getFirebaseDatabase()!, `rooms/${mainRoomId}/members/${participantId}`), {
                    currentBreakoutRoom: null,
                })
            }

            return { success: true }
        } catch (error) {
            console.error("Failed to close breakout room:", error)
            return { success: false, error: "Failed to close room" }
        }
    }

    // Send breakout room invite
    async sendInvite(
        mainRoomId: string,
        breakoutRoomId: string,
        breakoutRoomName: string,
        fromUserId: string,
        fromUserName: string,
        toUserId: string
    ): Promise<boolean> {
        if (!getFirebaseDatabase()!) return false

        try {
            const invite: BreakoutInvite = {
                id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                breakoutRoomId,
                breakoutRoomName,
                fromUserId,
                fromUserName,
                toUserId,
                timestamp: Date.now(),
                status: "pending",
            }

            await set(ref(getFirebaseDatabase()!, `rooms/${mainRoomId}/breakoutInvites/${invite.id}`), invite)
            return true
        } catch (error) {
            console.error("Failed to send invite:", error)
            return false
        }
    }

    // Respond to invite
    async respondToInvite(
        mainRoomId: string,
        inviteId: string,
        invite: BreakoutInvite,
        response: "accepted" | "declined"
    ): Promise<boolean> {
        if (!getFirebaseDatabase()!) return false

        try {
            // Update invite status
            await update(ref(getFirebaseDatabase()!, `rooms/${mainRoomId}/breakoutInvites/${inviteId}`), {
                status: response,
            })

            if (response === "accepted") {
                // Join the breakout room
                await this.joinBreakoutRoom(mainRoomId, invite.breakoutRoomId, invite.toUserId, "")
            }

            return true
        } catch (error) {
            console.error("Failed to respond to invite:", error)
            return false
        }
    }

    // Get all breakout rooms for a main room
    async getBreakoutRooms(mainRoomId: string): Promise<BreakoutRoom[]> {
        if (!getFirebaseDatabase()!) return []

        try {
            const roomsRef = ref(getFirebaseDatabase()!, `rooms/${mainRoomId}/breakoutRooms`)
            const snapshot = await get(roomsRef)

            if (!snapshot.exists()) {
                return []
            }

            const rooms: BreakoutRoom[] = []
            snapshot.forEach((child) => {
                rooms.push(child.val() as BreakoutRoom)
            })

            return rooms
        } catch (error) {
            console.error("Failed to get breakout rooms:", error)
            return []
        }
    }

    // Get pending invites for a user
    async getPendingInvites(mainRoomId: string, userId: string): Promise<BreakoutInvite[]> {
        if (!getFirebaseDatabase()!) return []

        try {
            const invitesRef = ref(getFirebaseDatabase()!, `rooms/${mainRoomId}/breakoutInvites`)
            const snapshot = await get(invitesRef)

            if (!snapshot.exists()) {
                return []
            }

            const invites: BreakoutInvite[] = []
            snapshot.forEach((child) => {
                const invite = child.val() as BreakoutInvite
                if (invite.toUserId === userId && invite.status === "pending") {
                    invites.push(invite)
                }
            })

            return invites
        } catch (error) {
            console.error("Failed to get invites:", error)
            return []
        }
    }

    // Listen for breakout room changes
    listenForBreakoutRooms(
        mainRoomId: string,
        callback: (rooms: BreakoutRoom[]) => void
    ): () => void {
        if (!getFirebaseDatabase()!) return () => { }

        const roomsRef = ref(getFirebaseDatabase()!, `rooms/${mainRoomId}/breakoutRooms`)

        const unsubscribe = onValue(roomsRef, (snapshot) => {
            if (!snapshot.exists()) {
                callback([])
                return
            }

            const rooms: BreakoutRoom[] = []
            snapshot.forEach((child) => {
                rooms.push(child.val() as BreakoutRoom)
            })

            callback(rooms)
        })

        this.listeners.push(unsubscribe)
        return unsubscribe
    }

    // Listen for invites
    listenForInvites(
        mainRoomId: string,
        userId: string,
        callback: (invites: BreakoutInvite[]) => void
    ): () => void {
        if (!getFirebaseDatabase()!) return () => { }

        const invitesRef = ref(getFirebaseDatabase()!, `rooms/${mainRoomId}/breakoutInvites`)

        const unsubscribe = onValue(invitesRef, (snapshot) => {
            if (!snapshot.exists()) {
                callback([])
                return
            }

            const invites: BreakoutInvite[] = []
            snapshot.forEach((child) => {
                const invite = child.val() as BreakoutInvite
                if (invite.toUserId === userId && invite.status === "pending") {
                    invites.push(invite)
                }
            })

            callback(invites)
        })

        this.listeners.push(unsubscribe)
        return unsubscribe
    }

    // Cleanup
    cleanup(): void {
        this.listeners.forEach((unsubscribe) => unsubscribe())
        this.listeners = []
    }
}
