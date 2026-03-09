import { getFirebaseDatabase } from "@/lib/firebase"
import { ref, set, remove, get, onValue } from "firebase/database"

export type ModerationAction = "mute" | "unmute" | "kick" | "ban" | "unban" | "warn"

export interface ModerationRule {
    id: string
    type: "keyword" | "regex" | "user"
    value: string
    action: "warn" | "mute" | "delete"
    enabled: boolean
    createdAt: number
}

export interface ModerationLog {
    id: string
    moderatorId: string
    moderatorName: string
    targetId: string
    targetName: string
    action: ModerationAction
    reason?: string
    timestamp: number
    roomId: string
}

export class ModerationManager {
    private static instance: ModerationManager
    private listeners: Array<() => void> = []

    static getInstance(): ModerationManager {
        if (!ModerationManager.instance) {
            ModerationManager.instance = new ModerationManager()
        }
        return ModerationManager.instance
    }

    // Mute a user in the room
    async muteUser(roomId: string, targetUserId: string, targetUserName: string, moderatorId: string, moderatorName: string, durationMinutes: number = 10, reason?: string): Promise<boolean> {
        if (!getFirebaseDatabase()!) return false

        try {
            const muteData = {
                userId: targetUserId,
                userName: targetUserName,
                mutedAt: Date.now(),
                mutedUntil: Date.now() + durationMinutes * 60 * 1000,
                reason: reason || "No reason provided",
                moderatorId,
                moderatorName,
            }

            await set(ref(getFirebaseDatabase()!, `rooms/${roomId}/muted/${targetUserId}`), muteData)

            // Log the action
            await this.logModerationAction({
                moderatorId,
                moderatorName,
                targetId: targetUserId,
                targetName: targetUserName,
                action: "mute",
                reason: `Muted for ${durationMinutes} minutes: ${reason || "No reason"}`,
                roomId,
            })

            return true
        } catch (error) {
            console.error("Failed to mute user:", error)
            return false
        }
    }

    // Unmute a user
    async unmuteUser(roomId: string, targetUserId: string, targetUserName: string, moderatorId: string, moderatorName: string, reason?: string): Promise<boolean> {
        if (!getFirebaseDatabase()!) return false

        try {
            await remove(ref(getFirebaseDatabase()!, `rooms/${roomId}/muted/${targetUserId}`))

            await this.logModerationAction({
                moderatorId,
                moderatorName,
                targetId: targetUserId,
                targetName: targetUserName,
                action: "unmute",
                reason: reason || "Manually unmuted",
                roomId,
            })

            return true
        } catch (error) {
            console.error("Failed to unmute user:", error)
            return false
        }
    }

    // Check if user is muted
    async isUserMuted(roomId: string, userId: string): Promise<{ isMuted: boolean; muteData?: any }> {
        if (!getFirebaseDatabase()!) return { isMuted: false }

        try {
            const muteRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/muted/${userId}`)
            const snapshot = await get(muteRef)

            if (!snapshot.exists()) {
                return { isMuted: false }
            }

            const muteData = snapshot.val()

            // Check if mute has expired
            if (muteData.mutedUntil && Date.now() > muteData.mutedUntil) {
                await remove(muteRef)
                return { isMuted: false }
            }

            return { isMuted: true, muteData }
        } catch (error) {
            console.error("Failed to check mute status:", error)
            return { isMuted: false }
        }
    }

    // Kick a user from the room
    async kickUser(roomId: string, targetUserId: string, targetUserName: string, moderatorId: string, moderatorName: string, reason?: string): Promise<boolean> {
        if (!getFirebaseDatabase()!) return false

        try {
            // Remove from members
            await remove(ref(getFirebaseDatabase()!, `rooms/${roomId}/members/${targetUserId}`))

            // Log the action
            await this.logModerationAction({
                moderatorId,
                moderatorName,
                targetId: targetUserId,
                targetName: targetUserName,
                action: "kick",
                reason: reason || "Kicked from room",
                roomId,
            })

            return true
        } catch (error) {
            console.error("Failed to kick user:", error)
            return false
        }
    }

    // Ban a user from the room
    async banUser(roomId: string, targetUserId: string, targetUserName: string, moderatorId: string, moderatorName: string, reason?: string): Promise<boolean> {
        if (!getFirebaseDatabase()!) return false

        try {
            const banData = {
                userId: targetUserId,
                userName: targetUserName,
                bannedAt: Date.now(),
                reason: reason || "Banned from room",
                moderatorId,
                moderatorName,
            }

            // Remove from members
            await remove(ref(getFirebaseDatabase()!, `rooms/${roomId}/members/${targetUserId}`))

            // Add to banned list
            await set(ref(getFirebaseDatabase()!, `rooms/${roomId}/banned/${targetUserId}`), banData)

            // Log the action
            await this.logModerationAction({
                moderatorId,
                moderatorName,
                targetId: targetUserId,
                targetName: targetUserName,
                action: "ban",
                reason: reason || "Permanently banned",
                roomId,
            })

            return true
        } catch (error) {
            console.error("Failed to ban user:", error)
            return false
        }
    }

    // Unban a user
    async unbanUser(roomId: string, targetUserId: string, targetUserName: string, moderatorId: string, moderatorName: string, reason?: string): Promise<boolean> {
        if (!getFirebaseDatabase()!) return false

        try {
            await remove(ref(getFirebaseDatabase()!, `rooms/${roomId}/banned/${targetUserId}`))

            await this.logModerationAction({
                moderatorId,
                moderatorName,
                targetId: targetUserId,
                targetName: targetUserName,
                action: "unban",
                reason: reason || "Manually unbanned",
                roomId,
            })

            return true
        } catch (error) {
            console.error("Failed to unban user:", error)
            return false
        }
    }

    // Check if user is banned
    async isUserBanned(roomId: string, userId: string): Promise<{ isBanned: boolean; banData?: any }> {
        if (!getFirebaseDatabase()!) return { isBanned: false }

        try {
            const banRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/banned/${userId}`)
            const snapshot = await get(banRef)

            if (!snapshot.exists()) {
                return { isBanned: false }
            }

            return { isBanned: true, banData: snapshot.val() }
        } catch (error) {
            console.error("Failed to check ban status:", error)
            return { isBanned: false }
        }
    }

    // Warn a user
    async warnUser(roomId: string, targetUserId: string, targetUserName: string, moderatorId: string, moderatorName: string, reason?: string): Promise<boolean> {
        try {
            await this.logModerationAction({
                moderatorId,
                moderatorName,
                targetId: targetUserId,
                targetName: targetUserName,
                action: "warn",
                reason: reason || "Warning issued",
                roomId,
            })

            return true
        } catch (error) {
            console.error("Failed to warn user:", error)
            return false
        }
    }

    // Delete a message
    async deleteMessage(roomId: string, messageId: string, moderatorId: string, moderatorName: string, reason?: string): Promise<boolean> {
        if (!getFirebaseDatabase()!) return false

        try {
            await remove(ref(getFirebaseDatabase()!, `rooms/${roomId}/messages/${messageId}`))

            // Log the action
            await this.logModerationAction({
                moderatorId,
                moderatorName,
                targetId: "message",
                targetName: messageId,
                action: "warn",
                reason: reason || "Message deleted",
                roomId,
            })

            return true
        } catch (error) {
            console.error("Failed to delete message:", error)
            return false
        }
    }

    // Log moderation action
    private async logModerationAction(data: Omit<ModerationLog, "id" | "timestamp">): Promise<void> {
        if (!getFirebaseDatabase()!) return

        try {
            await set(ref(getFirebaseDatabase()!, `rooms/${data.roomId}/moderationLogs/${Date.now()}_${Math.random().toString(36).substr(2, 9)}`), {
                ...data,
                timestamp: Date.now(),
            })
        } catch (error) {
            console.error("Failed to log moderation action:", error)
        }
    }

    // Get moderation logs for a room
    async getModerationLogs(roomId: string): Promise<ModerationLog[]> {
        if (!getFirebaseDatabase()!) return []

        try {
            const logsRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/moderationLogs`)
            const snapshot = await get(logsRef)

            if (!snapshot.exists()) {
                return []
            }

            const logs: ModerationLog[] = []
            snapshot.forEach((child) => {
                logs.push(child.val() as ModerationLog)
            })

            return logs.sort((a, b) => b.timestamp - a.timestamp)
        } catch (error) {
            console.error("Failed to get moderation logs:", error)
            return []
        }
    }

    // Listen for mute changes
    listenForMutes(roomId: string, callback: (mutedUsers: Record<string, any>) => void): () => void {
        if (!getFirebaseDatabase()!) return () => { }

        const muteRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/muted`)

        const unsubscribe = onValue(muteRef, (snapshot) => {
            if (snapshot.exists()) {
                callback(snapshot.val())
            } else {
                callback({})
            }
        })

        this.listeners.push(unsubscribe)
        return unsubscribe
    }

    // Listen for ban changes
    listenForBans(roomId: string, callback: (bannedUsers: Record<string, any>) => void): () => void {
        if (!getFirebaseDatabase()!) return () => { }

        const banRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/banned`)

        const unsubscribe = onValue(banRef, (snapshot) => {
            if (snapshot.exists()) {
                callback(snapshot.val())
            } else {
                callback({})
            }
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
