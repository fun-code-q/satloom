// CDN Manager for optimizing media delivery
// Provides helpers for CDN URLs and optimization

export interface CDNConfig {
    provider: "cloudflare" | "vercel" | "fastly" | "custom"
    baseUrl: string
    imageOptimization: boolean
    videoOptimization: boolean
}

export interface ImageTransformOptions {
    width?: number
    height?: number
    quality?: number // 1-100
    format?: "webp" | "avif" | "jpeg" | "png"
    fit?: "cover" | "contain" | "fill" | "inside" | "outside"
    gravity?: "center" | "face" | "faces" | "north" | "south" | "east" | "west"
}

export interface VideoTransformOptions {
    width?: number
    height?: number
    quality?: number // 1-100
    format?: "mp4" | "webm"
    fps?: number
    bitrate?: number
}

class CDNManager {
    private config: CDNConfig = {
        provider: "custom",
        baseUrl: "",
        imageOptimization: true,
        videoOptimization: true,
    }

    // Configure CDN
    configure(config: Partial<CDNConfig>): void {
        this.config = { ...this.config, ...config }
    }

    // Get CDN URL for an asset
    getUrl(path: string, _options?: { type?: "image" | "video" | "audio" | "static" }): string {
        const baseUrl = this.config.baseUrl

        if (!baseUrl) {
            return path
        }

        // Remove leading slash from path if present
        const normalizedPath = path.startsWith("/") ? path.slice(1) : path

        return `${baseUrl}/${normalizedPath}`
    }

    // Transform image URL
    transformImage(url: string, options: ImageTransformOptions): string {
        if (!this.config.imageOptimization) {
            return url
        }

        // If using a known CDN provider, generate transformed URL
        switch (this.config.provider) {
            case "cloudflare":
                return this.transformImageCloudflare(url, options)
            case "vercel":
                return this.transformImageVercel(url, options)
            default:
                return this.transformImageGeneric(url, options)
        }
    }

    // Cloudflare Image Transformation
    private transformImageCloudflare(url: string, options: ImageTransformOptions): string {
        const params = new URLSearchParams()

        if (options.width) params.set("width", options.width.toString())
        if (options.height) params.set("height", options.height.toString())
        if (options.quality) params.set("quality", options.quality.toString())
        if (options.format) params.set("format", options.format)
        if (options.fit) params.set("fit", options.fit)
        if (options.gravity) params.set("gravity", options.gravity)

        const queryString = params.toString()
        return queryString ? `${url}?${queryString}` : url
    }

    // Vercel Image Transformation
    private transformImageVercel(url: string, options: ImageTransformOptions): string {
        const params = new URLSearchParams()

        if (options.width) params.set("w", options.width.toString())
        if (options.height) params.set("h", options.height.toString())
        if (options.quality) params.set("q", options.quality.toString())
        if (options.format) params.set("fm", options.format)
        if (options.fit) params.set("fit", options.fit)

        const queryString = params.toString()
        return queryString ? `${url}?${queryString}` : url
    }

    // Generic transformation (for custom CDNs)
    private transformImageGeneric(url: string, options: ImageTransformOptions): string {
        const params = new URLSearchParams()

        if (options.width) params.set("w", options.width.toString())
        if (options.height) params.set("h", options.height.toString())
        if (options.quality) params.set("q", options.quality.toString())
        if (options.format) params.set("fm", options.format)

        const queryString = params.toString()
        return queryString ? `${url}?${queryString}` : url
    }

    // Transform video URL
    transformVideo(url: string, options: VideoTransformOptions): string {
        if (!this.config.videoOptimization) {
            return url
        }

        const params = new URLSearchParams()

        if (options.width) params.set("width", options.width.toString())
        if (options.height) params.set("height", options.height.toString())
        if (options.quality) params.set("quality", options.quality.toString())
        if (options.format) params.set("format", options.format)
        if (options.fps) params.set("fps", options.fps.toString())
        if (options.bitrate) params.set("bitrate", options.bitrate.toString())

        const queryString = params.toString()
        return queryString ? `${url}?${queryString}` : url
    }

    // Get responsive image srcset
    getResponsiveSrcset(
        url: string,
        widths: number[] = [320, 640, 960, 1280, 1920],
        options: Omit<ImageTransformOptions, "width"> = {}
    ): string {
        return widths
            .map((width) => {
                const transformedUrl = this.transformImage(url, { ...options, width })
                return `${transformedUrl} ${width}w`
            })
            .join(", ")
    }

    // Get responsive video sources
    getResponsiveVideoSources(
        url: string,
        qualities: Array<{ label: string; width: number; height: number; bitrate: number }>
    ): Array<{ src: string; type: string; label: string }> {
        return qualities.map((quality) => ({
            src: this.transformVideo(url, {
                width: quality.width,
                height: quality.height,
                bitrate: quality.bitrate,
                format: "webm",
            }),
            type: "video/webm",
            label: quality.label,
        }))
    }

    // Preconnect to CDN
    async preconnect(): Promise<void> {
        if (typeof window === "undefined" || !this.config.baseUrl) {
            return
        }

        try {
            const link = document.createElement("link")
            link.rel = "preconnect"
            link.href = this.config.baseUrl
            document.head.appendChild(link)
        } catch {
            // Silently fail
        }
    }

    // Prefetch asset
    async prefetch(url: string): Promise<void> {
        if (typeof window === "undefined") {
            return
        }

        try {
            const link = document.createElement("link")
            link.rel = "prefetch"
            link.href = url
            document.head.appendChild(link)
        } catch {
            // Silently fail
        }
    }

    // Get optimal image format based on browser support
    getOptimalImageFormat(): ImageTransformOptions["format"] {
        if (typeof window === "undefined") {
            return "webp"
        }

        // Check for WebP support
        const canvas = document.createElement("canvas")
        canvas.width = 1
        canvas.height = 1
        const ctx = canvas.getContext("2d")

        if (ctx) {
            ctx.fillStyle = "#000000"
            ctx.fillRect(0, 0, 1, 1)
            const dataUrl = canvas.toDataURL("image/webp")

            if (dataUrl.startsWith("data:image/webp")) {
                return "webp"
            }
        }

        return "jpeg"
    }

    // Optimize image for current device
    getOptimizedImageOptions(): ImageTransformOptions {
        const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1
        const screenWidth = typeof window !== "undefined" ? window.innerWidth : 1920

        return {
            width: Math.min(screenWidth * dpr, 1920),
            quality: 80,
            format: this.getOptimalImageFormat(),
            fit: "inside",
        }
    }
}

// Singleton instance
export const cdnManager = new CDNManager()

// Helper functions for common operations
export function getOptimizedAvatarUrl(url: string, size: number = 128): string {
    return cdnManager.transformImage(url, {
        width: size,
        height: size,
        quality: 80,
        fit: "cover",
        gravity: "face",
    })
}

export function getOptimizedThumbnailUrl(url: string): string {
    return cdnManager.transformImage(url, {
        width: 400,
        height: 225,
        quality: 70,
        fit: "cover",
    })
}

export function getOptimizedPreviewUrl(url: string): string {
    return cdnManager.transformImage(url, {
        width: 800,
        height: 600,
        quality: 85,
        fit: "inside",
    })
}

export function getResponsiveImageProps(url: string, sizes: string = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"): {
    src: string
    srcSet: string
    sizes: string
    alt: string
} {
    return {
        src: cdnManager.transformImage(url, cdnManager.getOptimizedImageOptions()),
        srcSet: cdnManager.getResponsiveSrcset(url),
        sizes,
        alt: "",
    }
}
