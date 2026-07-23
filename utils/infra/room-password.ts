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

/**
 * PIN hashing — Tier 1 hardening.
 *
 * Previously this was a single unsalted SHA-256 round, which is brute-forceable
 * in microseconds for the 4–6 digit PIN keyspace SatLoom uses. Now uses
 * PBKDF2-SHA256 with 600,000 iterations (OWASP 2023+ recommendation), a
 * CSPRNG salt, and a versioned output so legacy hashes can be verified and
 * transparently upgraded on next successful unlock.
 *
 * Stored format:  `pbkdf2$<iterations>$<saltB64>$<hashHex>`
 * Legacy format:  bare 64-char hex (single SHA-256 of pin+salt) — still
 *                 accepted by verifyPin, then re-hashed to PBKDF2 on success.
 */

const PBKDF2_ITERATIONS = 600_000
const PBKDF2_HASH_LEN = 32 // SHA-256 output, bytes
const PBKDF2_PREFIX = `pbkdf2$${PBKDF2_ITERATIONS}$`

/** Buffer <-> base64 helpers (URL-safe base64, no padding). */
function bytesToB64(bytes: Uint8Array): string {
    let bin = ""
    for (const b of bytes) bin += String.fromCharCode(b)
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}
function b64ToBytes(b64: string): Uint8Array {
    const norm = b64.replace(/-/g, "+").replace(/_/g, "/")
    const bin = atob(norm)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
}

/** Constant-time string comparison. Returns true iff a === b. Length-safe. */
function constantTimeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
        // Still walk both to avoid leaking length via timing. Compare against
        // a zero buffer of the longer length so the loop count is constant.
        const max = Math.max(a.length, b.length)
        let diff = 1
        for (let i = 0; i < max; i++) {
            const av = i < a.length ? a.charCodeAt(i) : 0
            const bv = i < b.length ? b.charCodeAt(i) : 0
            diff |= av ^ bv
        }
        return diff === 0 && a.length === b.length
    }
    let diff = 0
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
    return diff === 0
}

/** PBKDF2-SHA256 derivation of the PIN with the given salt. */
async function derivePbkdf2(pin: string, saltBytes: Uint8Array): Promise<string> {
    const encoder = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(pin),
        { name: "PBKDF2" },
        false,
        ["deriveBits"],
    )
    const bits = await crypto.subtle.deriveBits(
        // `salt` must be a BufferSource; copy into a fresh ArrayBuffer-backed
        // Uint8Array so the strict DOM lib type is satisfied regardless of the
        // source ArrayBuffer's exact generic parameter.
        { name: "PBKDF2", salt: new Uint8Array(saltBytes), iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
        keyMaterial,
        PBKDF2_HASH_LEN * 8,
    )
    return Array.from(new Uint8Array(bits))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
}

/**
 * Hash a PIN for storage. Always produces the new PBKDF2 format.
 */
async function hashPin(pin: string, saltB64: string): Promise<string> {
    const hashHex = await derivePbkdf2(pin, b64ToBytes(saltB64))
    return `${PBKDF2_PREFIX}${saltB64}$${hashHex}`
}

/**
 * Verify a PIN against a stored hash, accepting both the new PBKDF2 format
 * and the legacy single-SHA-256 format. Returns true on match.
 *
 * Legacy hashes are a bare 64-char hex of SHA-256(pin + salt), where salt was
 * a Math.random base36 string. We reconstruct that path for backward compat.
 */
async function verifyPin(pin: string, storedHash: string, salt: string): Promise<boolean> {
    if (storedHash.startsWith(PBKDF2_PREFIX)) {
        // New format: pbkdf2$<iters>$<saltB64>$<hashHex>
        const parts = storedHash.split("$")
        // parts: ["pbkdf2", "<iters>", "<saltB64>", "<hashHex>"]
        const hashHex = parts[3]
        const candidate = await derivePbkdf2(pin, b64ToBytes(parts[2]))
        return constantTimeEqual(candidate, hashHex)
    }
    // Legacy format: single SHA-256(pin + salt), salt is the raw stored string.
    const encoder = new TextEncoder()
    const buf = await crypto.subtle.digest("SHA-256", encoder.encode(pin + salt))
    const legacy = Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
    return constantTimeEqual(legacy, storedHash)
}

/** Returns true if a stored hash is legacy (needs transparent upgrade). */
function isLegacyHash(storedHash: string): boolean {
    return !storedHash.startsWith(PBKDF2_PREFIX)
}

// Generate a cryptographically secure random salt (16 bytes, base64).
function generateSalt(): string {
    return bytesToB64(crypto.getRandomValues(new Uint8Array(16)))
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
                // Salt is CSPRNG-generated and is not secret — co-locating it
                // with the hash is standard (the PBKDF2 cost is the defense,
                // not salt secrecy). 600k iterations make offline brute force
                // of the 4–6 digit PIN keyspace impractical.
                salt,
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

        // Validate PIN (constant-time; accepts legacy SHA-256 + new PBKDF2).
        const match = await verifyPin(pin, protectionData.passwordHash, protectionData.salt)

        if (match) {
            // Successful login - clear any lockout
            await remove(lockoutRef)
            this.state.isLockedOut = false
            this.state.remainingAttempts = protectionData.maxAttempts
            this.notifyListeners()

            // Transparent upgrade: if the stored hash was the legacy single
            // SHA-256 format, re-hash with PBKDF2 using a fresh CSPRNG salt
            // and persist, so the weak hash is replaced on next unlock.
            if (isLegacyHash(protectionData.passwordHash)) {
                try {
                    const newSalt = generateSalt()
                    const newHash = await hashPin(pin, newSalt)
                    await update(roomRef, { passwordHash: newHash, salt: newSalt })
                } catch (e) {
                    // Upgrade is best-effort; don't fail the unlock over it.
                    console.warn("Room password: legacy→PBKDF2 upgrade failed", e)
                }
            }

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
