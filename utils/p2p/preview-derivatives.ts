/**
 * Tiny, side-effect-free derivative generators for media messages.
 *
 * The principle: a chat message carries the **smallest possible preview**
 * inline (so the bubble paints instantly when the message arrives) while
 * the full payload stays on the sender's device until a peer claims it
 * over WebRTC DataChannel.
 *
 * What lives in the chat message in Firebase:
 *   - thumbnail (image): ≤ ~3 KB base64 JPEG
 *   - duration (audio/video): number of seconds, 0..7200
 *   - waveform (audio): 16 floats in [0, 1] — peak energy per bucket
 *
 * What stays peer-to-peer:
 *   - the full image bytes
 *   - the full audio bytes
 *   - the full video bytes
 *   - documents, PDFs, code, models, anything else
 *
 * All generators are best-effort. If anything fails, they return `null`
 * and the caller silently continues without the derivative — the chat
 * message still works, the bubble just falls back to "Download" UX.
 */

// ---------------------------------------------------------------------------
// Configuration

/** Max thumbnail edge length in pixels — bigger gets scaled down. */
const THUMB_MAX_EDGE = 240

/** JPEG quality for thumbnails. Tuned for <3 KB on typical photos. */
const THUMB_JPEG_QUALITY = 0.5

/** Hard cap on thumbnail data-URL length. Skip the thumbnail if exceeded. */
const THUMB_MAX_DATAURL_LEN = 6 * 1024 // ~4.4 KB binary equivalent

/** Number of waveform buckets persisted with the message. 16 = ~64 bytes JSON. */
const WAVEFORM_BUCKETS = 16

/** Don't try to decode audio files larger than this for waveform extraction. */
const WAVEFORM_MAX_BYTES = 25 * 1024 * 1024 // 25 MB

// ---------------------------------------------------------------------------
// Image thumbnails

/**
 * Generate a tiny JPEG thumbnail of an image file. Returns a base64 data URL
 * (e.g. "data:image/jpeg;base64,…") or null if the image cannot be decoded
 * or the encoded thumbnail exceeds the size cap.
 */
export async function generateImageThumbnail(file: File): Promise<string | null> {
    if (!file.type.startsWith("image/")) return null

    let url: string | null = null
    try {
        url = URL.createObjectURL(file)
        const img = await loadImage(url)

        const { width, height } = scaleToFit(img.naturalWidth, img.naturalHeight, THUMB_MAX_EDGE)

        const canvas = document.createElement("canvas")
        canvas.width = Math.max(1, Math.round(width))
        canvas.height = Math.max(1, Math.round(height))

        const ctx = canvas.getContext("2d")
        if (!ctx) return null
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        const dataUrl = canvas.toDataURL("image/jpeg", THUMB_JPEG_QUALITY)
        if (dataUrl.length > THUMB_MAX_DATAURL_LEN) {
            // Try once more at half resolution before giving up.
            const half = document.createElement("canvas")
            half.width = Math.max(1, Math.round(canvas.width / 2))
            half.height = Math.max(1, Math.round(canvas.height / 2))
            const hctx = half.getContext("2d")
            if (!hctx) return null
            hctx.drawImage(canvas, 0, 0, half.width, half.height)
            const smaller = half.toDataURL("image/jpeg", THUMB_JPEG_QUALITY)
            return smaller.length <= THUMB_MAX_DATAURL_LEN ? smaller : null
        }
        return dataUrl
    } catch (err) {
        console.warn("[preview-derivatives] thumbnail generation failed:", err)
        return null
    } finally {
        if (url) URL.revokeObjectURL(url)
    }
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = err => reject(err)
        img.src = src
    })
}

function scaleToFit(srcW: number, srcH: number, maxEdge: number): { width: number; height: number } {
    if (srcW <= maxEdge && srcH <= maxEdge) return { width: srcW, height: srcH }
    const ratio = srcW > srcH ? maxEdge / srcW : maxEdge / srcH
    return { width: srcW * ratio, height: srcH * ratio }
}

// ---------------------------------------------------------------------------
// Audio / video duration

/**
 * Read the duration in seconds from an audio/video file by attaching it to a
 * temporary HTMLMediaElement. Returns null if metadata can't be read.
 */
export async function getMediaDuration(file: File): Promise<number | null> {
    const isAudio = file.type.startsWith("audio/")
    const isVideo = file.type.startsWith("video/")
    if (!isAudio && !isVideo) return null

    const url = URL.createObjectURL(file)
    try {
        const el: HTMLMediaElement = isAudio ? document.createElement("audio") : document.createElement("video")
        el.preload = "metadata"
        el.src = url

        const duration = await new Promise<number | null>(resolve => {
            const cleanup = () => {
                el.onloadedmetadata = null
                el.onerror = null
            }
            const timer = window.setTimeout(() => {
                cleanup()
                resolve(null)
            }, 5000)
            el.onloadedmetadata = () => {
                clearTimeout(timer)
                cleanup()
                const d = Number.isFinite(el.duration) ? el.duration : null
                resolve(d)
            }
            el.onerror = () => {
                clearTimeout(timer)
                cleanup()
                resolve(null)
            }
        })

        if (duration === null) return null
        // Pin to a sane range — Phase 1 firebase rules cap this at 7200 too.
        return Math.max(0, Math.min(7200, Math.round(duration * 100) / 100))
    } finally {
        URL.revokeObjectURL(url)
    }
}

// ---------------------------------------------------------------------------
// Audio waveform

/**
 * Compute a {@link WAVEFORM_BUCKETS}-bucket peak waveform for an audio file.
 * Each bucket is the RMS of one chunk of the channel data, normalized to
 * [0, 1]. Returns null if decoding isn't possible (large files, codec
 * unsupported, AudioContext blocked by browser, etc).
 */
export async function generateAudioWaveform(file: File): Promise<number[] | null> {
    if (!file.type.startsWith("audio/")) return null
    if (file.size > WAVEFORM_MAX_BYTES) return null
    if (typeof window === "undefined") return null

    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return null

    let ctx: AudioContext | null = null
    try {
        ctx = new Ctx()
        const buf = await file.arrayBuffer()
        const decoded = await ctx.decodeAudioData(buf.slice(0))
        const ch = decoded.getChannelData(0) // first channel only

        const bucketSize = Math.max(1, Math.floor(ch.length / WAVEFORM_BUCKETS))
        const peaks: number[] = []
        let max = 0
        for (let b = 0; b < WAVEFORM_BUCKETS; b++) {
            const start = b * bucketSize
            const end = Math.min(start + bucketSize, ch.length)
            let sumSq = 0
            for (let i = start; i < end; i++) {
                sumSq += ch[i] * ch[i]
            }
            const rms = Math.sqrt(sumSq / Math.max(1, end - start))
            peaks.push(rms)
            if (rms > max) max = rms
        }

        // Normalize so the loudest bucket is 1.0 — gives a nice visual range
        // even for quiet recordings.
        if (max > 0) {
            for (let i = 0; i < peaks.length; i++) {
                peaks[i] = Math.round((peaks[i] / max) * 100) / 100
            }
        }
        return peaks
    } catch (err) {
        console.warn("[preview-derivatives] waveform generation failed:", err)
        return null
    } finally {
        try { await ctx?.close() } catch { /* ignore */ }
    }
}

// ---------------------------------------------------------------------------
// Combined helper

export interface MessageDerivatives {
    thumbnail?: string
    duration?: number
    waveform?: number[]
}

/**
 * Run all applicable derivative generators for a file. Each generator is
 * best-effort; failures yield no field rather than throwing. The result is
 * safe to spread into a Message.file payload.
 */
export async function deriveMessagePreviews(file: File): Promise<MessageDerivatives> {
    const result: MessageDerivatives = {}

    if (file.type.startsWith("image/")) {
        const thumb = await generateImageThumbnail(file)
        if (thumb) result.thumbnail = thumb
    }

    if (file.type.startsWith("audio/") || file.type.startsWith("video/")) {
        const dur = await getMediaDuration(file)
        if (dur !== null) result.duration = dur
    }

    if (file.type.startsWith("audio/")) {
        const wave = await generateAudioWaveform(file)
        if (wave) result.waveform = wave
    }

    return result
}
