// Virtual Background utilities for video calls
// Uses WebGL for background blur/replacement

export interface VirtualBackgroundConfig {
    type: "none" | "blur" | "image"
    blurAmount: number
    imageUrl?: string
}

export class VirtualBackgroundProcessor {
    private stream: MediaStream | null = null
    private canvas: HTMLCanvasElement | null = null
    private ctx: CanvasRenderingContext2D | null = null
    private animationFrame: number | null = null
    private worker: Worker | null = null

    async initialize(stream: MediaStream): Promise<boolean> {
        try {
            this.stream = stream
            this.canvas = document.createElement("canvas")
            this.ctx = this.canvas.getContext("2d", { willReadFrequently: true })

            if (!this.ctx) {
                console.error("Could not get canvas context")
                return false
            }

            // Set canvas size to match video
            const videoTrack = stream.getVideoTracks()[0]
            const settings = videoTrack.getSettings()
            this.canvas.width = settings.width || 640
            this.canvas.height = settings.height || 480

            return true
        } catch (error) {
            console.error("Failed to initialize virtual background:", error)
            return false
        }
    }

    async applyBackground(
        videoElement: HTMLVideoElement,
        config: VirtualBackgroundConfig
    ): Promise<MediaStream | null> {
        if (!this.canvas || !this.ctx || !this.stream) {
            return null
        }

        try {
            const { type, blurAmount, imageUrl } = config

            // Process each frame
            const processFrame = () => {
                if (!this.canvas || !this.ctx || !videoElement.videoWidth) {
                    return
                }

                // Draw video frame
                this.ctx.drawImage(videoElement, 0, 0, this.canvas.width, this.canvas.height)

                // Apply background effect
                if (type === "blur" && blurAmount > 0) {
                    this.applyBlur(blurAmount)
                } else if (type === "image" && imageUrl) {
                    this.applyImage(imageUrl)
                }

                // Request next frame
                this.animationFrame = requestAnimationFrame(processFrame)
            }

            // Cancel any existing processing
            if (this.animationFrame) {
                cancelAnimationFrame(this.animationFrame)
            }

            // Start processing
            processFrame()

            // Create new stream from canvas
            const canvasStream = this.canvas.captureStream(30)

            // Copy audio track from original stream
            const audioTrack = this.stream.getAudioTracks()[0]
            if (audioTrack) {
                canvasStream.addTrack(audioTrack)
            }

            return canvasStream
        } catch (error) {
            console.error("Failed to apply virtual background:", error)
            return null
        }
    }

    private applyBlur(blurAmount: number) {
        if (!this.ctx || !this.canvas) return

        // Simple box blur approximation
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height)
        const data = imageData.data
        const width = this.canvas.width
        const height = this.canvas.height

        // Create temporary buffer
        const tempBuffer = new Uint8ClampedArray(data)

        // Apply blur (simplified - for production, use a proper blur algorithm)
        const iterations = Math.ceil(blurAmount / 10)
        for (let iter = 0; iter < iterations; iter++) {
            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    const idx = (y * width + x) * 4

                    // Average of neighbors
                    let r = 0, g = 0, b = 0, a = 0

                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const nidx = ((y + dy) * width + (x + dx)) * 4
                            r += tempBuffer[nidx]
                            g += tempBuffer[nidx + 1]
                            b += tempBuffer[nidx + 2]
                            a += tempBuffer[nidx + 3]
                        }
                    }

                    data[idx] = r / 9
                    data[idx + 1] = g / 9
                    data[idx + 2] = b / 9
                    data[idx + 3] = a / 9
                }
            }
        }

        this.ctx.putImageData(imageData, 0, 0)
    }

    private async applyImage(imageUrl: string): Promise<void> {
        if (!this.ctx || !this.canvas) return

        try {
            const img = new Image()
            img.crossOrigin = "anonymous"
            img.src = imageUrl

            await new Promise((resolve, reject) => {
                img.onload = resolve
                img.onerror = reject
            })

            // Calculate cover dimensions
            const imgRatio = img.width / img.height
            const canvasRatio = this.canvas!.width / this.canvas!.height

            let drawWidth, drawHeight, drawX, drawY

            if (imgRatio > canvasRatio) {
                drawHeight = this.canvas!.height
                drawWidth = img.width * (this.canvas!.height / img.height)
                drawX = (this.canvas!.width - drawWidth) / 2
                drawY = 0
            } else {
                drawWidth = this.canvas!.width
                drawHeight = img.height * (this.canvas!.width / img.width)
                drawX = 0
                drawY = (this.canvas!.height - drawHeight) / 2
            }

            // Draw background image
            this.ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight)
        } catch (error) {
            console.error("Failed to load background image:", error)
        }
    }

    // Create blur stream using MediaPipe or similar
    async createBlurStream(blurAmount: number = 15): Promise<MediaStream | null> {
        if (!this.stream) return null

        try {
            // Use canvas-based blur as fallback
            const videoTrack = this.stream.getVideoTracks()[0]
            const settings = videoTrack.getSettings()

            const canvas = document.createElement("canvas")
            canvas.width = settings.width || 640
            canvas.height = settings.height || 480
            const ctx = canvas.getContext("2d")

            if (!ctx) return null

            const outputStream = canvas.captureStream(30)

            // Copy audio
            const audioTrack = this.stream.getAudioTracks()[0]
            if (audioTrack) {
                outputStream.addTrack(audioTrack)
            }

            const processFrame = () => {
                if (!this.stream) return

                const videoTrack = this.stream.getVideoTracks()[0]
                if (videoTrack.readyState === "live") {
                    ctx.drawImage(canvas, 0, 0)
                    ctx.filter = `blur(${blurAmount}px)`
                    ctx.drawImage(canvas, 0, 0)
                    ctx.filter = "none"
                }

                requestAnimationFrame(processFrame)
            }

            processFrame()
            return outputStream
        } catch (error) {
            console.error("Failed to create blur stream:", error)
            return null
        }
    }

    // Pre-defined background images
    static getDefaultBackgrounds(): { id: string; name: string; url: string }[] {
        return [
            { id: "blur", name: "Blur", url: "" },
            { id: "none", name: "None", url: "" },
            { id: "office", name: "Office", url: "/backgrounds/office.svg" },
            { id: "nature", name: "Nature", url: "/backgrounds/nature.svg" },
            { id: "beach", name: "Beach", url: "/backgrounds/beach.svg" },
            { id: "space", name: "Space", url: "/backgrounds/space.svg" },
            { id: "gradient1", name: "Sunset", url: "/backgrounds/gradient-1.svg" },
            { id: "gradient2", name: "Ocean", url: "/backgrounds/gradient-2.svg" },
        ]
    }

    cleanup(): void {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame)
        }
        this.stream = null
        this.canvas = null
        this.ctx = null
    }
}
