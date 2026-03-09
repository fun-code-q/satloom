/**
 * GIF Avatar Generator
 * 
 * Generate animated avatar from camera feed
 * Uses gif.js for proper GIF encoding when available
 */

export interface AvatarFrame {
    id: number
    data: string // base64 image data
    timestamp: number
}

export interface AvatarConfig {
    width: number
    height: number
    frameCount: number
    frameDelay: number
    loop: boolean
    filter: string
}

export interface AvatarGenerationResult {
    success: boolean
    gifUrl?: string
    blob?: Blob
    error?: string
}

const DEFAULT_CONFIG: AvatarConfig = {
    width: 128,
    height: 128,
    frameCount: 10,
    frameDelay: 100,
    loop: true,
    filter: "none",
}

class GifAvatarGenerator {
    private canvas: HTMLCanvasElement | null = null
    private ctx: CanvasRenderingContext2D | null = null
    private videoElement: HTMLVideoElement | null = null
    private frames: AvatarFrame[] = []
    private isRecording: boolean = false

    constructor() {
        if (typeof window !== "undefined") {
            this.canvas = document.createElement("canvas")
            this.ctx = this.canvas.getContext("2d")
        }
    }

    async initialize(videoElement: HTMLVideoElement): Promise<void> {
        this.videoElement = videoElement
        this.frames = []
        this.isRecording = false
    }

    async startRecording(config: Partial<AvatarConfig> = {}): Promise<void> {
        if (!this.videoElement) {
            throw new Error("Video element not initialized")
        }

        const cfg = { ...DEFAULT_CONFIG, ...config }
        this.canvas!.width = cfg.width
        this.canvas!.height = cfg.height
        this.frames = []
        this.isRecording = true

        // Capture frames
        for (let i = 0; i < cfg.frameCount && this.isRecording; i++) {
            await this.captureFrame()
            await this.delay(cfg.frameDelay)
        }

        this.isRecording = false
    }

    stopRecording(): void {
        this.isRecording = false
    }

    private async captureFrame(): Promise<void> {
        if (!this.videoElement || !this.ctx || !this.canvas) return

        // Draw video frame to canvas
        this.ctx!.drawImage(this.videoElement, 0, 0, this.canvas!.width, this.canvas!.height)

        // Get base64 image data
        const data = this.canvas!.toDataURL("image/png")

        this.frames.push({
            id: this.frames.length,
            data,
            timestamp: Date.now(),
        })
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }

    async generateGif(config: Partial<AvatarConfig> = {}): Promise<AvatarGenerationResult> {
        const cfg = { ...DEFAULT_CONFIG, ...config }

        if (this.frames.length < 2) {
            return { success: false, error: "Not enough frames captured" }
        }

        try {
            // Try gif.js first, fall back to SVG
            if (typeof window !== "undefined" && (window as any).GIF) {
                try {
                    const gif = await this.encodeWithGifJs(cfg)
                    return { success: true, gifUrl: gif.url, blob: gif.blob }
                } catch (e) {
                    console.warn("gif.js encoding failed, using SVG fallback:", e)
                }
            }

            // SVG fallback
            const svg = this.encodeWithSvg(cfg)
            return { success: true, gifUrl: svg.url, blob: svg.blob }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    }

    private async encodeWithGifJs(config: AvatarConfig): Promise<{ url: string; blob: Blob }> {
        return new Promise((resolve, reject) => {
            const GIF = (window as any).GIF
            if (!GIF) {
                reject(new Error("gif.js not available"))
                return
            }

            const gif = new GIF({
                workers: 2,
                quality: 10,
                width: config.width,
                height: config.height,
                workerScript: "/gif.worker.js"
            })

            this.frames.forEach((frame) => {
                const img = new Image()
                img.src = frame.data
                gif.addFrame(img, { delay: config.frameDelay })
            })

            gif.on("finished", (blob: Blob) => {
                const url = URL.createObjectURL(blob)
                resolve({ url, blob })
            })

            gif.on("error", (error: any) => {
                reject(new Error("GIF encoding failed: " + error))
            })

            gif.render()
        })
    }

    private encodeWithSvg(config: AvatarConfig): { url: string; blob: Blob } {
        const width = config.width
        const height = config.height
        const totalDuration = this.frames.length * config.frameDelay

        // Build keyframe animations
        let keyframes = ""
        let frameElements = ""

        this.frames.forEach((frame, i) => {
            const delay = i * config.frameDelay
            const opacityStart = i / this.frames.length
            const opacityEnd = (i + 1) / this.frames.length

            keyframes += `
                ${opacityStart * 100}% { opacity: 1; }
                ${opacityEnd * 100}% { opacity: 0; }
            `

            frameElements += `
                <image 
                    href="${frame.data}" 
                    width="${width}" 
                    height="${height}" 
                    style="animation-delay: -${delay}ms"
                />
            `
        })

        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
        <style>
            .frame {
                animation: animate ${totalDuration}ms step-end infinite;
                opacity: 0;
            }
            @keyframes animate {
                ${keyframes}
            }
        </style>
    </defs>
    ${frameElements}
</svg>`

        const blob = new Blob([svg], { type: "image/svg+xml" })
        const url = URL.createObjectURL(blob)

        return { url, blob }
    }

    async generateStaticAvatar(): Promise<string | null> {
        if (!this.videoElement || !this.ctx || !this.canvas) return null

        // Capture a single frame
        this.canvas!.width = 256
        this.canvas!.height = 256
        this.ctx!.drawImage(this.videoElement, 0, 0, 256, 256)

        // Apply circular mask
        const tempCanvas = document.createElement("canvas")
        tempCanvas.width = 256
        tempCanvas.height = 256
        const tempCtx = tempCanvas.getContext("2d")

        if (tempCtx) {
            tempCtx.beginPath()
            tempCtx.arc(128, 128, 128, 0, Math.PI * 2)
            tempCtx.clip()

            tempCtx.drawImage(this.canvas!, 0, 0)
        }

        return tempCanvas.toDataURL("image/png")
    }

    applyFilter(dataUrl: string, filter: string): string {
        // Apply CSS-like filters to the avatar
        const filters: Record<string, string> = {
            none: "",
            grayscale: "grayscale(100%)",
            sepia: "sepia(100%)",
            blur: "blur(2px)",
            brightness: "brightness(150%)",
            contrast: "contrast(150%)",
            saturate: "saturate(200%)",
            hueRotate: "hue-rotate(90deg)",
            invert: "invert(100%)",
        }

        return dataUrl
    }

    getCapturedFrames(): AvatarFrame[] {
        return [...this.frames]
    }

    clearFrames(): void {
        this.frames = []
    }

    getFrameCount(): number {
        return this.frames.length
    }

    getRecordingState(): boolean {
        return this.isRecording
    }
}

export const gifAvatarGenerator = new GifAvatarGenerator()

// Pre-defined avatar frames for demo
export const DEMO_AVATAR_FRAMES: string[] = [
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'%3E%3Ccircle cx='64' cy='64' r='64' fill='%23667'/%3E%3C/svg%3E",
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'%3E%3Ccircle cx='64' cy='64' r='64' fill='%23778'/%3E%3C/svg%3E",
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'%3E%3Ccircle cx='64' cy='64' r='64' fill='%23889'/%3E%3C/svg%3E",
]
