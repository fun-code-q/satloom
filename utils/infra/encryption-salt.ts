/**
 * Per-room PBKDF2 salt persistence — Phase 6.
 *
 * What this is for
 * ----------------
 * Before Phase 6, every room derived its AES-GCM key with a deterministic
 * salt — `"salt_" + roomId` — meaning the salt was as guessable as the
 * room ID itself. That's not how PBKDF2 salts are supposed to work: a
 * predictable salt makes per-room rainbow-table attacks against many
 * rooms feasible at once.
 *
 * Phase 6 stores a **random 16-byte salt per room** at
 * `rooms/$roomId/encryption/salt` (base64-encoded). It's generated at
 * room-creation time, never changes, and is read by every joiner so all
 * members derive the same key from the password.
 *
 * Threat-model honesty
 * --------------------
 * This is **not** a fix for the bigger encryption-theater problem: in a
 * non-password-protected room, the "password" used for derivation is
 * still the public roomId, so anyone with the URL can derive the key.
 * That's a UX overhaul (introduce a real per-user join secret) and is
 * tracked separately. The salt fix is independent and worth shipping
 * regardless: it strengthens the password-protected case and gives
 * non-password rooms a reasonable migration target.
 */

import { getFirebaseDatabase } from "@/lib/firebase"
import { get, ref, set } from "firebase/database"

const SALT_BYTES = 16

function arrayBufferToBase64(bytes: Uint8Array): string {
    let binary = ""
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i])
    }
    return window.btoa(binary)
}

function base64ToUint8Array(b64: string): Uint8Array {
    const binary = window.atob(b64)
    const out = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
        out[i] = binary.charCodeAt(i)
    }
    return out
}

/**
 * Generate a fresh random salt and write it to Firebase. Idempotent:
 * if a salt already exists at the given path, the existing value is
 * preserved (the rule should also forbid overwrite — see firebase-rules.json).
 *
 * Returns the salt that's now in Firebase, in base64.
 */
export async function ensureRoomSalt(roomId: string): Promise<string> {
    const db = getFirebaseDatabase()
    if (!db) throw new Error("Firebase not initialized")

    const saltRef = ref(db, `rooms/${roomId}/encryption/salt`)
    const snap = await get(saltRef)
    if (snap.exists() && typeof snap.val() === "string" && snap.val().length > 0) {
        return snap.val() as string
    }

    const fresh = window.crypto.getRandomValues(new Uint8Array(SALT_BYTES))
    const b64 = arrayBufferToBase64(fresh)
    await set(saltRef, b64)
    return b64
}

/**
 * Read a room's salt for key derivation. If the room predates Phase 6
 * and has no stored salt, fall back to the legacy `"salt_" + roomId`
 * derivation so existing rooms remain decipherable. New rooms always
 * have a real random salt.
 */
export async function getRoomSalt(roomId: string): Promise<Uint8Array> {
    const db = getFirebaseDatabase()
    if (!db) {
        // Best-effort fallback if Firebase isn't reachable — treat as legacy.
        return new TextEncoder().encode("salt_" + roomId)
    }

    try {
        const snap = await get(ref(db, `rooms/${roomId}/encryption/salt`))
        if (snap.exists() && typeof snap.val() === "string" && snap.val().length > 0) {
            return base64ToUint8Array(snap.val() as string)
        }
    } catch (err) {
        console.warn("[encryption-salt] read failed, falling back to legacy salt:", err)
    }

    // Legacy fallback for rooms created before Phase 6.
    return new TextEncoder().encode("salt_" + roomId)
}
