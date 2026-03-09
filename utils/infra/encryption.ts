/**
 * End-to-End Encryption utilities
 * Note: This is a basic implementation. For production use, consider using libsodium or Web Crypto API more extensively.
 */

// Session key storage
const sessionKeys: Map<string, CryptoKey> = new Map()

/**
 * Generate a new encryption key pair
 */
export async function generateKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
    const keyPair = await crypto.subtle.generateKey(
        {
            name: "ECDH",
            namedCurve: "P-256",
        },
        true,
        ["deriveBits", "deriveKey"]
    )

    const publicKeyBuffer = await crypto.subtle.exportKey("spki", keyPair.publicKey)
    const privateKeyBuffer = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey)

    return {
        publicKey: arrayBufferToBase64(publicKeyBuffer),
        privateKey: arrayBufferToBase64(privateKeyBuffer),
    }
}

/**
 * Derive a shared secret key from our private key and their public key
 */
export async function deriveSharedKey(
    ourPrivateKeyBase64: string,
    theirPublicKeyBase64: string,
    roomId: string
): Promise<CryptoKey> {
    // Check if we already have a key for this room
    const existingKey = sessionKeys.get(roomId)
    if (existingKey) {
        return existingKey
    }

    const privateKeyBuffer = base64ToArrayBuffer(ourPrivateKeyBase64)
    const publicKeyBuffer = base64ToArrayBuffer(theirPublicKeyBase64)

    const privateKey = await crypto.subtle.importKey(
        "pkcs8",
        privateKeyBuffer,
        { name: "ECDH", namedCurve: "P-256" },
        false,
        ["deriveBits", "deriveKey"]
    )

    const publicKey = await crypto.subtle.importKey(
        "spki",
        publicKeyBuffer,
        { name: "ECDH", namedCurve: "P-256" },
        false,
        []
    )

    const sharedKey = await crypto.subtle.deriveKey(
        { name: "ECDH", public: publicKey },
        privateKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    )

    // Store the key for the session
    sessionKeys.set(roomId, sharedKey)

    return sharedKey
}

/**
 * Encrypt a message for a room
 */
export async function encryptMessage(
    roomId: string,
    message: string
): Promise<{ ciphertext: string; iv: string } | null> {
    const key = sessionKeys.get(roomId)
    if (!key) {
        console.warn("No encryption key found for room:", roomId)
        return null
    }

    try {
        const encoder = new TextEncoder()
        const data = encoder.encode(message)

        // Generate a random IV
        const iv = crypto.getRandomValues(new Uint8Array(12))

        const ciphertext = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            key,
            data
        )

        return {
            ciphertext: arrayBufferToBase64(ciphertext),
            iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
        }
    } catch (error) {
        console.error("Encryption failed:", error)
        return null
    }
}

/**
 * Decrypt a message for a room
 */
export async function decryptMessage(
    roomId: string,
    ciphertextBase64: string,
    ivBase64: string
): Promise<string | null> {
    const key = sessionKeys.get(roomId)
    if (!key) {
        console.warn("No encryption key found for room:", roomId)
        return null
    }

    try {
        const ciphertext = base64ToArrayBuffer(ciphertextBase64)
        const iv = base64ToArrayBuffer(ivBase64)

        const decrypted = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            key,
            ciphertext
        )

        const decoder = new TextDecoder()
        return decoder.decode(decrypted)
    } catch (error) {
        console.error("Decryption failed:", error)
        return null
    }
}

/**
 * Clear session key for a room
 */
export function clearRoomKey(roomId: string): void {
    sessionKeys.delete(roomId)
}

/**
 * Clear all session keys
 */
export function clearAllKeys(): void {
    sessionKeys.clear()
}

/**
 * Generate a random encryption key for local storage
 */
export async function generateLocalKey(): Promise<string> {
    const key = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    )

    const exportedKey = await crypto.subtle.exportKey("raw", key)
    return arrayBufferToBase64(exportedKey)
}

/**
 * Import a local key from base64
 */
export async function importLocalKey(keyBase64: string): Promise<CryptoKey> {
    const keyBuffer = base64ToArrayBuffer(keyBase64)
    return crypto.subtle.importKey(
        "raw",
        keyBuffer,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    )
}

/**
 * Hash a string using SHA-256
 */
export async function hashString(str: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(str)
    const hashBuffer = await crypto.subtle.digest("SHA-256", data)
    return arrayBufferToBase64(hashBuffer as ArrayBuffer)
}

// Utility functions
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ""
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
    }
    return bytes.buffer
}

/**
 * Encrypt data for local storage
 */
export async function encryptForStorage(
    data: string,
    keyBase64: string
): Promise<{ ciphertext: string; iv: string }> {
    const key = await importLocalKey(keyBase64)
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encoder = new TextEncoder()
    const encodedData = encoder.encode(data)

    const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        encodedData
    )

    return {
        ciphertext: arrayBufferToBase64(ciphertext),
        iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
    }
}

/**
 * Decrypt data from local storage
 */
export async function decryptFromStorage(
    ciphertextBase64: string,
    ivBase64: string,
    keyBase64: string
): Promise<string> {
    const key = await importLocalKey(keyBase64)
    const ciphertext = base64ToArrayBuffer(ciphertextBase64)
    const iv = base64ToArrayBuffer(ivBase64)

    const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        ciphertext
    )

    const decoder = new TextDecoder()
    return decoder.decode(decrypted)
}
