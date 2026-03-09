// Noise Suppression using Web Audio API
// Provides echo cancellation and audio quality optimization

export interface NoiseSuppressionConfig {
    echoCancellation: boolean
    noiseSuppression: boolean
    autoGainControl: boolean
}

export class NoiseSuppressor {
    private audioContext: AudioContext | null = null
    private sourceNode: MediaStreamAudioSourceNode | null = null
    private destinationNode: MediaStreamAudioDestinationNode | null = null
    private stream: MediaStream | null = null
    private isActive: boolean = false

    // Check if browser supports audio constraints
    static isSupported(): boolean {
        return typeof navigator !== "undefined" && "mediaDevices" in navigator
    }

    // Get optimal audio constraints
    static getOptimalConstraints(config?: Partial<NoiseSuppressionConfig>): Record<string, any> {
        const constraints: Record<string, any> = {}

        constraints.echoCancellation = config?.echoCancellation ?? true
        constraints.noiseSuppression = config?.noiseSuppression ?? true
        constraints.autoGainControl = config?.autoGainControl ?? true

        return constraints
    }

    // Initialize with media stream
    async initialize(stream: MediaStream): Promise<boolean> {
        try {
            this.stream = stream
            this.audioContext = new AudioContext()

            // Create source node
            this.sourceNode = this.audioContext.createMediaStreamSource(stream)

            // Create destination node
            this.destinationNode = this.audioContext.createMediaStreamDestination()

            // Create noise reduction chain
            this.setupNoiseReduction()

            this.isActive = true
            return true
        } catch (error) {
            console.error("Failed to initialize noise suppressor:", error)
            return false
        }
    }

    // Setup noise reduction audio nodes
    private setupNoiseReduction(): void {
        if (!this.audioContext || !this.sourceNode || !this.destinationNode) return

        // Create high-pass filter for removing low-frequency noise
        const highPass = this.audioContext.createBiquadFilter()
        highPass.type = "highpass"
        highPass.frequency.value = 80 // Hz
        highPass.Q.value = 1

        // Create low-pass filter for removing high-frequency noise
        const lowPass = this.audioContext.createBiquadFilter()
        lowPass.type = "lowpass"
        lowPass.frequency.value = 12000 // Hz
        lowPass.Q.value = 1

        // Create dynamics compressor for preventing clipping
        const compressor = this.audioContext.createDynamicsCompressor()
        compressor.threshold.value = -24
        compressor.knee.value = 30
        compressor.ratio.value = 12
        compressor.attack.value = 0.003
        compressor.release.value = 0.25

        // Connect the chain
        this.sourceNode.connect(highPass)
        highPass.connect(lowPass)
        lowPass.connect(compressor)
        compressor.connect(this.destinationNode)
    }

    // Get processed stream
    getProcessedStream(): MediaStream | null {
        return this.destinationNode?.stream || null
    }

    // Get audio levels
    getAudioLevels(): { left: number; right: number } | null {
        if (!this.audioContext || !this.sourceNode) return null

        try {
            const analyser = this.audioContext.createAnalyser()
            analyser.fftSize = 256

            this.sourceNode.connect(analyser)

            const dataArray = new Uint8Array(analyser.frequencyBinCount)
            analyser.getByteFrequencyData(dataArray)

            const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length

            return {
                left: average,
                right: average,
            }
        } catch {
            return null
        }
    }

    // Get waveform data
    getWaveform(): Uint8Array | null {
        if (!this.audioContext || !this.sourceNode) return null

        try {
            const analyser = this.audioContext.createAnalyser()
            analyser.fftSize = 2048

            this.sourceNode.connect(analyser)

            const dataArray = new Uint8Array(analyser.frequencyBinCount)
            analyser.getByteTimeDomainData(dataArray)

            return dataArray
        } catch {
            return null
        }
    }

    // Get frequency data
    getFrequencyData(): Uint8Array | null {
        if (!this.audioContext || !this.sourceNode) return null

        try {
            const analyser = this.audioContext.createAnalyser()
            analyser.fftSize = 1024

            this.sourceNode.connect(analyser)

            const dataArray = new Uint8Array(analyser.frequencyBinCount)
            analyser.getByteFrequencyData(dataArray)

            return dataArray
        } catch {
            return null
        }
    }

    // Check if active
    getIsActive(): boolean {
        return this.isActive
    }

    // Cleanup
    cleanup(): void {
        if (this.audioContext) {
            this.audioContext.close()
            this.audioContext = null
        }

        this.sourceNode = null
        this.destinationNode = null
        this.stream = null
        this.isActive = false
    }
}

// Audio Quality Manager
export class AudioQualityManager {
    private static instance: AudioQualityManager
    private stream: MediaStream | null = null
    private audioTrack: MediaStreamTrack | null = null
    private originalConstraints: MediaTrackConstraints | null = null

    static getInstance(): AudioQualityManager {
        if (!AudioQualityManager.instance) {
            AudioQualityManager.instance = new AudioQualityManager()
        }
        return AudioQualityManager.instance
    }

    // Set audio stream
    setStream(stream: MediaStream): void {
        this.stream = stream
        this.audioTrack = stream.getAudioTracks()[0] || null
        if (this.audioTrack) {
            this.originalConstraints = this.audioTrack.getConstraints()
        }
    }

    // Apply quality presets
    async applyPreset(preset: "low" | "medium" | "high"): Promise<boolean> {
        if (!this.audioTrack) return false

        const constraints: MediaTrackConstraints = {}

        switch (preset) {
            case "low":
                constraints.sampleRate = 16000
                constraints.channelCount = 1
                break
            case "medium":
                constraints.sampleRate = 32000
                constraints.channelCount = 1
                break
            case "high":
                constraints.sampleRate = 48000
                constraints.channelCount = 2
                break
        }

        try {
            await this.audioTrack.applyConstraints(constraints)
            return true
        } catch {
            return false
        }
    }

    // Set sample rate
    async setSampleRate(rate: number): Promise<boolean> {
        if (!this.audioTrack) return false
        try {
            await this.audioTrack.applyConstraints({ sampleRate: rate })
            return true
        } catch {
            return false
        }
    }

    // Set channel count
    async setChannelCount(count: 1 | 2): Promise<boolean> {
        if (!this.audioTrack) return false
        try {
            await this.audioTrack.applyConstraints({ channelCount: count })
            return true
        } catch {
            return false
        }
    }

    // Get audio statistics
    getStats(): {
        sampleRate: number | null
        channelCount: number | null
        inputLevel: number | null
    } {
        if (!this.audioTrack) {
            return {
                sampleRate: null,
                channelCount: null,
                inputLevel: null,
            }
        }

        const settings = this.audioTrack.getSettings() as any

        return {
            sampleRate: settings.sampleRate || null,
            channelCount: settings.channelCount || null,
            inputLevel: settings.inputLevel || null,
        }
    }

    // Reset to original
    async reset(): Promise<boolean> {
        if (!this.audioTrack || !this.originalConstraints) return false
        try {
            await this.audioTrack.applyConstraints(this.originalConstraints)
            return true
        } catch {
            return false
        }
    }

    // Cleanup
    cleanup(): void {
        this.stream = null
        this.audioTrack = null
        this.originalConstraints = null
    }
}
