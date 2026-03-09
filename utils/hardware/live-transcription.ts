// Live Transcription using Web Speech API
// Browser-based speech-to-text for local transcription

export interface TranscriptionSegment {
    id: string
    text: string
    startTime: number
    endTime: number
    confidence: number
    isFinal: boolean
}

export interface TranscriptionConfig {
    language: string
    continuous: boolean
    interimResults: boolean
}

export type TranscriptionEventType = "start" | "end" | "result" | "error" | "nomatch"

export interface TranscriptionEvent {
    type: TranscriptionEventType
    data?: any
}

// Live Transcription Manager
export class LiveTranscriptionManager {
    private static instance: LiveTranscriptionManager
    private recognition: any = null
    private isListening: boolean = false
    private segments: TranscriptionSegment[] = []
    private onEventCallback: ((event: TranscriptionEvent) => void) | null = null

    static getInstance(): LiveTranscriptionManager {
        if (!LiveTranscriptionManager.instance) {
            LiveTranscriptionManager.instance = new LiveTranscriptionManager()
        }
        return LiveTranscriptionManager.instance
    }

    // Check if speech recognition is supported
    static isSupported(): boolean {
        if (typeof window === "undefined") return false
        return "SpeechRecognition" in window || "webkitSpeechRecognition" in window
    }

    // Initialize speech recognition
    initialize(config: Partial<TranscriptionConfig> = {}): boolean {
        if (!LiveTranscriptionManager.isSupported()) {
            console.error("Speech recognition not supported")
            return false
        }

        const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        this.recognition = new SpeechRecognitionClass()

        this.recognition.continuous = config.continuous ?? true
        this.recognition.interimResults = config.interimResults ?? true
        this.recognition.lang = config.language ?? "en-US"
        this.recognition.maxAlternatives = 1

        this.recognition.onstart = () => {
            this.isListening = true
            this.onEventCallback?.({ type: "start" })
        }

        this.recognition.onend = () => {
            this.isListening = false
            this.onEventCallback?.({ type: "end" })
        }

        this.recognition.onresult = (event: any) => {
            let interimTranscript = ""
            let finalTranscript = ""

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i]
                if (result.isFinal) {
                    finalTranscript += result[0].transcript
                    const segment: TranscriptionSegment = {
                        id: `segment_${Date.now()}_${i}`,
                        text: result[0].transcript,
                        startTime: event.timeStamp - 2000,
                        endTime: event.timeStamp,
                        confidence: result[0].confidence,
                        isFinal: true,
                    }
                    this.segments.push(segment)
                } else {
                    interimTranscript += result[0].transcript
                }
            }

            if (finalTranscript || interimTranscript) {
                this.onEventCallback?.({
                    type: "result",
                    data: {
                        final: finalTranscript,
                        interim: interimTranscript,
                        segments: this.segments,
                    },
                })
            }
        }

        this.recognition.onerror = (event: any) => {
            this.onEventCallback?.({
                type: "error",
                data: event.error,
            })
        }

        this.recognition.onnomatch = () => {
            this.onEventCallback?.({ type: "nomatch" })
        }

        return true
    }

    // Start listening
    start(): boolean {
        if (!this.recognition || this.isListening) {
            return false
        }

        this.segments = []
        this.recognition.start()
        return true
    }

    // Stop listening
    stop(): boolean {
        if (!this.recognition || !this.isListening) {
            return false
        }

        this.recognition.stop()
        return true
    }

    // Set event callback
    onEvent(callback: (event: TranscriptionEvent) => void): void {
        this.onEventCallback = callback
    }

    // Get all segments
    getSegments(): TranscriptionSegment[] {
        return [...this.segments]
    }

    // Get transcript text
    getTranscript(): string {
        return this.segments.map((s) => s.text).join(" ")
    }

    // Clear segments
    clear(): void {
        this.segments = []
    }

    // Set language
    setLanguage(lang: string): void {
        if (this.recognition) {
            this.recognition.lang = lang
        }
    }

    // Check if listening
    getIsListening(): boolean {
        return this.isListening
    }

    // Cleanup
    cleanup(): void {
        if (this.recognition) {
            this.recognition.abort()
            this.recognition = null
        }
        this.isListening = false
        this.segments = []
        this.onEventCallback = null
    }
}

// Closed Caption Manager
export class ClosedCaptionManager {
    private static instance: ClosedCaptionManager
    private manager: LiveTranscriptionManager
    private displayElement: HTMLElement | null = null
    private isEnabled: boolean = false

    static getInstance(): ClosedCaptionManager {
        if (!ClosedCaptionManager.instance) {
            ClosedCaptionManager.instance = new ClosedCaptionManager()
        }
        return ClosedCaptionManager.instance
    }

    constructor() {
        this.manager = LiveTranscriptionManager.getInstance()
    }

    // Initialize with transcription manager
    initialize(): boolean {
        if (!this.manager.initialize()) {
            return false
        }

        this.manager.onEvent((event) => {
            if (event.type === "result" && this.isEnabled && this.displayElement) {
                const data = event.data
                const displayText = data.final || data.interim
                if (this.displayElement) {
                    this.displayElement.textContent = displayText || this.manager.getTranscript()
                }
            }
        })

        return true
    }

    // Enable closed captions
    enable(displayElement: HTMLElement): void {
        this.displayElement = displayElement
        this.isEnabled = true
    }

    // Disable closed captions
    disable(): void {
        this.isEnabled = false
        if (this.displayElement) {
            this.displayElement.textContent = ""
        }
    }

    // Start captioning
    start(): boolean {
        return this.manager.start()
    }

    // Stop captioning
    stop(): boolean {
        return this.manager.stop()
    }

    // Set language
    setLanguage(lang: string): void {
        this.manager.setLanguage(lang)
    }

    // Get transcript
    getTranscript(): string {
        return this.manager.getTranscript()
    }

    // Cleanup
    cleanup(): void {
        this.disable()
        this.manager.cleanup()
    }
}

// Meeting Notes Generator
export class MeetingNotesGenerator {
    private segments: TranscriptionSegment[] = []

    // Process segments into structured notes
    generateNotes(segments: TranscriptionSegment[] = []): {
        summary: string
        actionItems: string[]
        keyPoints: string[]
        attendees: string[]
    } {
        const allSegments = segments.length > 0 ? segments : this.segments
        const fullText = allSegments.map((s) => s.text).join(" ")

        // Extract action items
        const actionItemPatterns = [
            /should\s+(.+?)(?:\.|$)/gi,
            /need\s+to\s+(.+?)(?:\.|$)/gi,
            /will\s+(.+?)(?:\.|$)/gi,
        ]

        const actionItems: string[] = []
        for (const pattern of actionItemPatterns) {
            let match
            while ((match = pattern.exec(fullText)) !== null) {
                const item = match[1].trim()
                if (item.length > 5 && item.length < 200) {
                    actionItems.push(item)
                }
            }
        }

        // Extract key points
        const importantWords = [
            "important", "key", "main", "critical", "essential",
            "remember", "note", "point", "decision", "agreed",
        ]

        const sentences = fullText.split(/[.!?]+/).filter((s) => s.trim().length > 10)
        const keyPoints = sentences
            .filter((s) => {
                const lower = s.toLowerCase()
                return importantWords.some((word) => lower.includes(word))
            })
            .slice(0, 5)
            .map((s) => s.trim())

        // Extract attendees
        const attendeePattern = /@(\w+)/g
        const attendees: string[] = []
        let match
        while ((match = attendeePattern.exec(fullText)) !== null) {
            if (!attendees.includes(match[1])) {
                attendees.push(match[1])
            }
        }

        // Generate summary
        const summary = sentences.slice(0, 3).join(". ").trim()

        return {
            summary: summary || "No transcript available",
            actionItems: [...new Set(actionItems)],
            keyPoints,
            attendees,
        }
    }

    // Add segment
    addSegment(segment: TranscriptionSegment): void {
        this.segments.push(segment)
    }

    // Clear segments
    clear(): void {
        this.segments = []
    }

    // Get notes
    getNotes(): ReturnType<typeof this.generateNotes> {
        return this.generateNotes()
    }
}
