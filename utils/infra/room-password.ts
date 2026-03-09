/**
 * Room Password Manager
 * 
 * Manages password protection for rooms.
 * Host sets a PIN; guests must enter it to join.
 */

import { getFirebaseDatabase } from "@/lib/firebase"
import { ref, set, get, update, remove, onValue } from "firebase/database"

export interface ProtectedRoom {
    roomId: string
    passwordHash: string
    hint?: string
    maxAttempts: number
    lockoutDuration: number // minutes
    isActive: boolean
    createdAt: number
}

export interface PasswordAttempt {
    userId: string
    timestamp: number
    success: boolean
}

interface RoomPasswordState {
    isProtected: boolean
    isLockedOut: boolean
    remainingAttempts: number
    lockoutTimeRemaining: number // seconds
}

// Simple hash function for PIN (use bcrypt in production)
async function hashPin(pin: string, salt: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(pin + salt)
    const hashBuffer = await crypto.subtle.digest("SHA-256", data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

// Generate a random salt
function generateSalt(): string {
    return Math.random().toString(36).substring(2, 15)
}

class RoomPasswordManager {
    private static instance: RoomPasswordManager
    private state: RoomPasswordState = {
        isProtected: false,
        isLockedOut: false,
        remainingAttempts: 3,
        lockoutTimeRemaining: 0,
    }
    private listeners: ((state: RoomPasswordState) => void)[] = []
    private roomId: string | null = null
    private unsubscribers: (() => void)[] = []

    private constructor() { }

    static getInstance(): RoomPasswordManager {
        if (!RoomPasswordManager.instance) {
            RoomPasswordManager.instance = new RoomPasswordManager()
        }
        return RoomPasswordManager.instance
    }

    /**
     * Initialize for a room
     */
    initialize(roomId: string): void {
        this.roomId = roomId
        this.checkProtectionStatus()
    }

    /**
     * Check if room is protected
     */
    private async checkProtectionStatus(): Promise<void> {
        if (!this.roomId || !getFirebaseDatabase()!) return

        const roomRef = ref(getFirebaseDatabase()!, `rooms/${this.roomId}/protection`)
        onValue(roomRef, (snapshot) => {
            const data = snapshot.val() as ProtectedRoom | null
            this.state.isProtected = data?.isActive ?? false
            this.notifyListeners()
        })
    }

    /**
     * Set room password (host only)
     */
    async setPassword(pin: string, hint?: string): Promise<boolean> {
        if (!this.roomId || !getFirebaseDatabase()!) return false

        try {
            const salt = generateSalt()
            const passwordHash = await hashPin(pin, salt)

            const roomRef = ref(getFirebaseDatabase()!, `rooms/${this.roomId}/protection`)
            await set(roomRef, {
                roomId: this.roomId,
                passwordHash,
                hint: hint || "",
                salt, // In production, store salt separately
                maxAttempts: 3,
                lockoutDuration: 5, // 5 minutes lockout
                isActive: true,
                createdAt: Date.now(),
            } as Omit<ProtectedRoom, "salt"> & { salt: string })

            this.state.isProtected = true
            this.notifyListeners()
            return true
        } catch (error) {
            console.error("Failed to set password:", error)
            return false
        }
    }

    /**
     * Remove room password (host only)
     */
    async removePassword(): Promise<boolean> {
        if (!this.roomId || !getFirebaseDatabase()!) return false

        try {
            const roomRef = ref(getFirebaseDatabase()!, `rooms/${this.roomId}/protection`)
            await remove(roomRef)

            this.state.isProtected = false
            this.notifyListeners()
            return true
        } catch (error) {
            console.error("Failed to remove password:", error)
            return false
        }
    }

    /**
     * Validate password attempt
     */
    async validatePassword(pin: string, userId: string): Promise<{ success: boolean; error?: string }> {
        if (!this.roomId || !getFirebaseDatabase()!) {
            return { success: false, error: "Room not initialized" }
        }

        // Check lockout status
        const lockoutRef = ref(getFirebaseDatabase()!, `rooms/${this.roomId}/lockout/${userId}`)
        const lockoutSnapshot = await get(lockoutRef)
        const lockoutData = lockoutSnapshot.val() as { until: number } | null

        if (lockoutData && lockoutData.until > Date.now()) {
            this.state.isLockedOut = true
            this.state.lockoutTimeRemaining = Math.ceil((lockoutData.until - Date.now()) / 1000)
            this.notifyListeners()
            return { success: false, error: `Locked out. Try again in ${this.state.lockoutTimeRemaining}s` }
        }

        // Get room protection data
        const roomRef = ref(getFirebaseDatabase()!, `rooms/${this.roomId}/protection`)
        const snapshot = await get(roomRef)
        const protectionData = snapshot.val() as (ProtectedRoom & { salt: string }) | null

        if (!protectionData || !protectionData.isActive) {
            return { success: true } // No password required
        }

        // Validate PIN
        const inputHash = await hashPin(pin, protectionData.salt)

        if (inputHash === protectionData.passwordHash) {
            // Successful login - clear any lockout
            await remove(lockoutRef)
            this.state.isLockedOut = false
            this.state.remainingAttempts = protectionData.maxAttempts
            this.notifyListeners()
            return { success: true }
        }

        // Failed attempt - record it
        const attemptsRef = ref(getFirebaseDatabase()!, `rooms/${this.roomId}/attempts/${userId}`)
        const attemptsSnapshot = await get(attemptsRef)
        const attemptsData = attemptsSnapshot.val() as PasswordAttempt[] | null
        const attempts = attemptsData || []

        const newAttempt: PasswordAttempt = {
            userId,
            timestamp: Date.now(),
            success: false,
        }
        attempts.push(newAttempt)

        // Count recent failed attempts (last 5 minutes)
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
        const recentFailedAttempts = attempts.filter(
            (a) => !a.success && a.timestamp > fiveMinutesAgo
        ).length

        this.state.remainingAttempts = Math.max(0, protectionData.maxAttempts - recentFailedAttempts)

        // Check if should lock out
        if (recentFailedAttempts >= protectionData.maxAttempts) {
            const lockoutDuration = protectionData.lockoutDuration * 60 * 1000
            await set(lockoutRef, {
                userId,
                until: Date.now() + lockoutDuration,
            })

            this.state.isLockedOut = true
            this.state.lockoutTimeRemaining = protectionData.lockoutDuration * 60
            this.notifyListeners()
            return { success: false, error: "Too many failed attempts. Locked out for 5 minutes." }
        }

        await set(attemptsRef, attempts)
        this.notifyListeners()

        return {
            success: false,
            error: `Wrong PIN. ${this.state.remainingAttempts} attempts remaining.`,
        }
    }

    /**
     * Get room hint
     */
    async getHint(): Promise<string | null> {
        if (!this.roomId || !getFirebaseDatabase()!) return null

        const roomRef = ref(getFirebaseDatabase()!, `rooms/${this.roomId}/protection`)
        const snapshot = await get(roomRef)
        const data = snapshot.val() as ProtectedRoom | null

        return data?.hint || null
    }

    /**
     * Check if room is protected
     */
    async isRoomProtected(): Promise<boolean> {
        if (!this.roomId || !getFirebaseDatabase()!) return false

        const roomRef = ref(getFirebaseDatabase()!, `rooms/${this.roomId}/protection`)
        const snapshot = await get(roomRef)
        const data = snapshot.val() as ProtectedRoom | null

        return data?.isActive ?? false
    }

    /**
     * Get current state
     */
    getState(): RoomPasswordState {
        return { ...this.state }
    }

    /**
     * Subscribe to state changes
     */
    subscribe(listener: (state: RoomPasswordState) => void): () => void {
        this.listeners.push(listener)
        return () => {
            this.listeners = this.listeners.filter((l) => l !== listener)
        }
    }

    /**
     * Notify all listeners
     */
    private notifyListeners(): void {
        this.listeners.forEach((listener) => listener(this.getState()))
    }

    /**
     * Clean up
     */
    destroy(): void {
        this.unsubscribers.forEach((unsub) => unsub())
        this.unsubscribers = []
        this.roomId = null
        this.state = {
            isProtected: false,
            isLockedOut: false,
            remainingAttempts: 3,
            lockoutTimeRemaining: 0,
        }
    }
}

export const roomPasswordManager = RoomPasswordManager.getInstance()
export type { RoomPasswordState }
