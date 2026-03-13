// Archive.org Integration
// Fetches direct video URLs from Archive.org metadata API for native playback

export interface ArchiveVideoInfo {
    identifier: string
    title: string
    description: string
    duration: number
    directVideoUrl: string
    thumbnailUrl: string
    format: string
}

// Extract item ID from Archive.org URL
export function extractArchiveId(url: string): string | null {
    // Match patterns like:
    // https://archive.org/details/identifier
    // https://archive.org/identifier
    // https://www.archive.org/details/identifier
    // identifier (just the ID)
    const patterns = [
        /archive\.org\/details\/([a-zA-Z0-9_-]+)/,
        /archive\.org\/([a-zA-Z0-9_-]+)/,
        /^([a-zA-Z0-9_-]+)$/
    ]

    for (const pattern of patterns) {
        const match = url.match(pattern)
        if (match) {
            return match[1]
        }
    }
    return null
}

// Fetch video metadata from Archive.org
export async function fetchArchiveVideoInfo(itemId: string): Promise<ArchiveVideoInfo | null> {
    try {
        const metadataUrl = `https://archive.org/metadata/${itemId}`
        const response = await fetch(metadataUrl)

        if (!response.ok) {
            console.error(`[Archive.org] Failed to fetch metadata: ${response.status}`)
            return null
        }

        const metadata = await response.json()

        // Find the best video file
        const videoFiles = metadata.files?.filter((file: any) =>
            file.format === 'Video' ||
            file.format === 'MP4' ||
            file.format === 'WebM' ||
            file.name?.endsWith('.mp4') ||
            file.name?.endsWith('.webm')
        ) || []

        if (videoFiles.length === 0) {
            console.error('[Archive.org] No video files found')
            return null
        }

        // Sort by size (prefer larger files for better quality)
        videoFiles.sort((a: any, b: any) => (b.size || 0) - (a.size || 0))

        const bestVideo = videoFiles[0]

        // Construct direct URL
        const directVideoUrl = `https://archive.org/download/${itemId}/${bestVideo.name}`

        // Get thumbnail
        const thumbnailUrl = `https://archive.org/services/img/${itemId}`

        return {
            identifier: itemId,
            title: metadata.title || 'Untitled',
            description: metadata.description || '',
            duration: parseFloat(bestVideo.length) || 0,
            directVideoUrl,
            thumbnailUrl,
            format: bestVideo.format || 'Unknown'
        }
    } catch (error) {
        console.error('[Archive.org] Error fetching video info:', error)
        return null
    }
}

// Get embed URL from item ID
export function getArchiveEmbedUrl(url: string): string | null {
    const itemId = extractArchiveId(url)
    if (!itemId) return null
    return `https://archive.org/embed/${itemId}`
}

// Archive.org Player Controller that fetches direct URLs
export class ArchivePlayerController {
    private currentItemId: string | null = null
    private videoInfo: ArchiveVideoInfo | null = null

    async loadVideo(url: string): Promise<ArchiveVideoInfo | null> {
        const itemId = extractArchiveId(url)
        if (!itemId) {
            console.error('[Archive.org] Could not extract item ID from URL')
            return null
        }

        // Check if we already have this video loaded
        if (this.currentItemId === itemId && this.videoInfo) {
            return this.videoInfo
        }

        console.log(`[Archive.org] Fetching info for: ${itemId}`)
        const info = await fetchArchiveVideoInfo(itemId)

        if (info) {
            this.currentItemId = itemId
            this.videoInfo = info
        }

        return info
    }

    getDirectVideoUrl(): string | null {
        return this.videoInfo?.directVideoUrl || null
    }

    getTitle(): string {
        return this.videoInfo?.title || 'Archive.org Video'
    }

    getDuration(): number {
        return this.videoInfo?.duration || 0
    }

    reset(): void {
        this.currentItemId = null
        this.videoInfo = null
    }
}
