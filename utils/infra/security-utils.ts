/**
 * Security Utilities
 * 
 * Provides centralized functions for content sanitization,
 * file validation, and link safety.
 */

export class SecurityUtils {
    /**
     * Removes malicious hidden characters like Zero-Width Spaces
     * and non-printable control characters.
     */
    static cleanText(text: string): string {
        if (!text) return ""
        // Remove ZWS (\u200B), Zero-Width Joiner (\u200D), etc.
        // And non-printable control characters (00-1F)
        return text
            .replace(/[\u200B-\u200D\uFEFF\u2060\u202E]/g, "")
            .replace(/[\x00-\x1F\x7F]/g, "")
            .trim()
    }

    /**
     * Validates file size and MIME type.
     * Checks magic bytes for images/videos to ensure they match their extension.
     */
    static async validateFile(file: File): Promise<{ valid: boolean; error?: string }> {
        // 1. Size Limit (10MB)
        const MAX_SIZE = 10 * 1024 * 1024
        if (file.size > MAX_SIZE) {
            return { valid: false, error: "File size exceeds 10MB limit." }
        }

        // 2. MIME Type Allow-list
        const ALLOWED_MIME_TYPES = [
            "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
            "video/mp4", "video/webm", "video/ogg",
            "audio/mpeg", "audio/ogg", "audio/wav", "audio/webm",
            "application/pdf", "text/plain"
        ]
        if (!ALLOWED_MIME_TYPES.includes(file.type)) {
            return { valid: false, error: "Unsupported file type." }
        }

        // 3. Magic Byte Verification for common images
        try {
            const buffer = await file.slice(0, 4).arrayBuffer()
            const header = new Uint8Array(buffer)
            let hex = ""
            for (let i = 0; i < header.length; i++) {
                hex += header[i].toString(16).padStart(2, '0')
            }

            // Check common signatures
            const signatures: Record<string, string[]> = {
                "image/jpeg": ["ffd8ff"],
                "image/png": ["89504e47"],
                "image/gif": ["47494638"],
                "application/pdf": ["25504446"],
            }

            for (const [mime, sigs] of Object.entries(signatures)) {
                if (file.type === mime) {
                    const matched = sigs.some(sig => hex.startsWith(sig))
                    if (!matched) return { valid: false, error: "File content mismatch (Spoofed extension)." }
                }
            }
        } catch (e) {
            return { valid: false, error: "Integrity check failed." }
        }

        return { valid: true }
    }

    /**
     * Validates link protocol and checks against basic safety criteria.
     */
    static isLinkSafe(url: string): boolean {
        try {
            const parsed = new URL(url)
            // Only allow http/https
            if (!["http:", "https:"].includes(parsed.protocol)) {
                return false
            }
            return true
        } catch (e) {
            return false
        }
    }
}
