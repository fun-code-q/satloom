/**
 * Optional image compression for the P2P send path — C6.
 *
 * Phase 2 sends image bytes peer-to-peer with no resampling, which is
 * what most users want (preserve quality). For users on metered
 * connections or with large camera photos (15+ MB), C6 adds an opt-in
 * quality-tier: max dimension + JPEG quality applied via canvas before
 * the P2P offer is registered.
 *
 * The picker is presented in the attach flow when an image is >2 MB.
 * Quality choice is remembered per-session via the modal-state store.
 *
 * Why not always compress: SatLoom's "no server, no storage" thesis
 * means quality decisions live with the user, not us. Defaulting to
 * "Original" is the right behaviour for "send a photo to a friend over
 * good wifi"; the picker exists for the long tail of bandwidth-
 * constrained scenarios.
 */

export type ImageQuality = "original" | "high" | "medium" | "low"

export interface QualityPreset {
    label: string
    maxEdgePx: number | null    // null = no scaling
    jpegQuality: number          // 0–1
    description: string
}

export const QUALITY_PRESETS: Record<ImageQuality, QualityPreset> = {
    original: {
        label: "Original",
        maxEdgePx: null,
        jpegQuality: 1,
        description: "Full quality, full size",
    },
    high: {
        label: "1080p",
        maxEdgePx: 1920,
        jpegQuality: 0.92,
        description: "≤ 1920 × 1920, near-lossless",
    },
    medium: {
        label: "720p",
        maxEdgePx: 1280,
        jpegQuality: 0.85,
        description: "≤ 1280 × 1280, good for chat",
    },
    low: {
        label: "480p",
        maxEdgePx: 854,
        jpegQuality: 0.75,
        description: "≤ 854 × 854, fastest",
    },
}

/**
 * Threshold above which the UI prompts for a quality choice (bytes).
 * Below this, the original is used without asking.
 */
export const COMPRESSION_PROMPT_THRESHOLD = 2 * 1024 * 1024 // 2 MB

/**
 * Apply a quality preset to an image File. Returns a NEW File (the
 * caller can pass it straight to the P2P send path); for
 * `quality === "original"` returns the input unchanged.
 *
 * Non-image inputs (mime doesn't start with `image/`) are returned
 * unchanged regardless of `quality`.
 */
export async function compressImage(file: File, quality: ImageQuality): Promise<File> {
    if (!file.type.startsWith("image/")) return file
    if (quality === "original") return file

    const preset = QUALITY_PRESETS[quality]
    const url = URL.createObjectURL(file)
    try {
        const img = await loadImage(url)
        const { width, height } = scaleToFit(img.naturalWidth, img.naturalHeight, preset.maxEdgePx)

        const canvas = document.createElement("canvas")
        canvas.width = Math.max(1, Math.round(width))
        canvas.height = Math.max(1, Math.round(height))
        const ctx = canvas.getContext("2d")
        if (!ctx) return file
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        const blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob((b) => resolve(b), "image/jpeg", preset.jpegQuality)
        })
        if (!blob) return file
        // If compression somehow made the file LARGER (e.g. tiny PNG → JPEG
        // gains overhead), keep the original.
        if (blob.size >= file.size) return file

        const base = file.name.replace(/\.[^.]+$/, "")
        return new File([blob], `${base}.${preset.label.toLowerCase()}.jpg`, { type: "image/jpeg" })
    } catch (err) {
        console.warn("[image-compression] failed, sending original:", err)
        return file
    } finally {
        URL.revokeObjectURL(url)
    }
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = (err) => reject(err)
        img.src = src
    })
}

function scaleToFit(srcW: number, srcH: number, maxEdge: number | null): { width: number; height: number } {
    if (maxEdge === null) return { width: srcW, height: srcH }
    if (srcW <= maxEdge && srcH <= maxEdge) return { width: srcW, height: srcH }
    const ratio = srcW > srcH ? maxEdge / srcW : maxEdge / srcH
    return { width: srcW * ratio, height: srcH * ratio }
}
