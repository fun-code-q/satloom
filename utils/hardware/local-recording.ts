// Local Recording Storage using IndexedDB
// Stores recordings locally in the browser

export interface Recording {
    id: string
    type: "audio" | "video" | "screen"
    title: string
    createdAt: number
    duration: number // milliseconds
    blob: Blob
    size: number // bytes
    thumbnail?: string
    transcript?: string // Local transcription
}

export interface RecordingMetadata {
    id: string
    type: "audio" | "video" | "screen"
    title: string
    createdAt: number
    duration: number
    size: number
    thumbnail?: string
    hasTranscript: boolean
}

class LocalRecordingStorage {
    private dbName = "SatLoomRecordings"
    private storeName = "recordings"
    private db: IDBDatabase | null = null
    private dbVersion = 1

    // Initialize IndexedDB
    async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (typeof window === "undefined") {
                reject(new Error("IndexedDB not available"))
                return
            }

            const request = indexedDB.open(this.dbName, this.dbVersion)

            request.onerror = () => {
                reject(request.error)
            }

            request.onsuccess = () => {
                this.db = request.result
                resolve()
            }

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result

                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: "id" })
                    store.createIndex("type", "type", { unique: false })
                    store.createIndex("createdAt", "createdAt", { unique: false })
                    store.createIndex("title", "title", { unique: false })
                }
            }
        })
    }

    // Ensure DB is initialized
    private async ensureDB(): Promise<IDBDatabase> {
        if (!this.db) {
            await this.init()
        }
        return this.db!
    }

    // Save a recording
    async saveRecording(recording: Recording): Promise<boolean> {
        try {
            const db = await this.ensureDB()

            return new Promise((resolve, reject) => {
                const transaction = db.transaction([this.storeName], "readwrite")
                const store = transaction.objectStore(this.storeName)

                const request = store.put(recording)

                request.onsuccess = () => resolve(true)
                request.onerror = () => reject(request.error)
            })
        } catch (error) {
            console.error("Failed to save recording:", error)
            return false
        }
    }

    // Get a recording by ID
    async getRecording(id: string): Promise<Recording | null> {
        try {
            const db = await this.ensureDB()

            return new Promise((resolve, reject) => {
                const transaction = db.transaction([this.storeName], "readonly")
                const store = transaction.objectStore(this.storeName)
                const request = store.get(id)

                request.onsuccess = () => resolve(request.result || null)
                request.onerror = () => reject(request.error)
            })
        } catch (error) {
            console.error("Failed to get recording:", error)
            return null
        }
    }

    // Get all recordings
    async getAllRecordings(): Promise<RecordingMetadata[]> {
        try {
            const db = await this.ensureDB()

            return new Promise((resolve, reject) => {
                const transaction = db.transaction([this.storeName], "readonly")
                const store = transaction.objectStore(this.storeName)
                const request = store.getAll()

                request.onsuccess = () => {
                    const recordings = request.result || []
                    // Return metadata without blob
                    resolve(
                        recordings.map((r: Recording) => ({
                            id: r.id,
                            type: r.type,
                            title: r.title,
                            createdAt: r.createdAt,
                            duration: r.duration,
                            size: r.size,
                            thumbnail: r.thumbnail,
                            hasTranscript: !!r.transcript,
                        }))
                    )
                }
                request.onerror = () => reject(request.error)
            })
        } catch (error) {
            console.error("Failed to get all recordings:", error)
            return []
        }
    }

    // Get recordings by type
    async getRecordingsByType(type: "audio" | "video" | "screen"): Promise<RecordingMetadata[]> {
        try {
            const db = await this.ensureDB()

            return new Promise((resolve, reject) => {
                const transaction = db.transaction([this.storeName], "readonly")
                const store = transaction.objectStore(this.storeName)
                const index = store.index("type")
                const request = index.getAll(type)

                request.onsuccess = () => {
                    const recordings = request.result || []
                    resolve(
                        recordings.map((r: Recording) => ({
                            id: r.id,
                            type: r.type,
                            title: r.title,
                            createdAt: r.createdAt,
                            duration: r.duration,
                            size: r.size,
                            thumbnail: r.thumbnail,
                            hasTranscript: !!r.transcript,
                        }))
                    )
                }
                request.onerror = () => reject(request.error)
            })
        } catch (error) {
            console.error("Failed to get recordings by type:", error)
            return []
        }
    }

    // Delete a recording
    async deleteRecording(id: string): Promise<boolean> {
        try {
            const db = await this.ensureDB()

            return new Promise((resolve, reject) => {
                const transaction = db.transaction([this.storeName], "readwrite")
                const store = transaction.objectStore(this.storeName)
                const request = store.delete(id)

                request.onsuccess = () => resolve(true)
                request.onerror = () => reject(request.error)
            })
        } catch (error) {
            console.error("Failed to delete recording:", error)
            return false
        }
    }

    // Export recording to device
    async exportRecording(id: string): Promise<{ url: string; filename: string } | null> {
        try {
            const recording = await this.getRecording(id)
            if (!recording) return null

            const extension = this.getExtension(recording.type)
            const filename = `${recording.title.replace(/[^a-z0-9]/gi, "_")}_${new Date(recording.createdAt).toISOString().split("T")[0]}${extension}`

            const url = URL.createObjectURL(recording.blob)

            return { url, filename }
        } catch (error) {
            console.error("Failed to export recording:", error)
            return null
        }
    }

    // Get file extension based on type
    private getExtension(type: "audio" | "video" | "screen"): string {
        switch (type) {
            case "audio":
                return ".webm"
            case "video":
                return ".webm"
            case "screen":
                return ".webm"
            default:
                return ".webm"
        }
    }

    // Get total storage used
    async getTotalStorageUsed(): Promise<number> {
        try {
            const recordings = await this.getAllRecordings()
            return recordings.reduce((total, r) => total + r.size, 0)
        } catch (error) {
            console.error("Failed to get storage used:", error)
            return 0
        }
    }

    // Clear all recordings
    async clearAllRecordings(): Promise<boolean> {
        try {
            const db = await this.ensureDB()

            return new Promise((resolve, reject) => {
                const transaction = db.transaction([this.storeName], "readwrite")
                const store = transaction.objectStore(this.storeName)
                const request = store.clear()

                request.onsuccess = () => resolve(true)
                request.onerror = () => reject(request.error)
            })
        } catch (error) {
            console.error("Failed to clear recordings:", error)
            return false
        }
    }

    // Update recording metadata
    async updateRecording(id: string, updates: Partial<Pick<Recording, "title" | "transcript">>): Promise<boolean> {
        try {
            const recording = await this.getRecording(id)
            if (!recording) return false

            const updated = { ...recording, ...updates }

            return new Promise((resolve, reject) => {
                const db = this.db!
                const transaction = db.transaction([this.storeName], "readwrite")
                const store = transaction.objectStore(this.storeName)
                const request = store.put(updated)

                request.onsuccess = () => resolve(true)
                request.onerror = () => reject(request.error)
            })
        } catch (error) {
            console.error("Failed to update recording:", error)
            return false
        }
    }

    // Search recordings by title
    async searchRecordings(query: string): Promise<RecordingMetadata[]> {
        try {
            const db = await this.ensureDB()
            const lowerQuery = query.toLowerCase()

            return new Promise((resolve, reject) => {
                const transaction = db.transaction([this.storeName], "readonly")
                const store = transaction.objectStore(this.storeName)
                const request = store.getAll()

                request.onsuccess = () => {
                    const recordings = request.result || []
                    const filtered = recordings
                        .filter((r: Recording) => r.title.toLowerCase().includes(lowerQuery))
                        .map((r: Recording) => ({
                            id: r.id,
                            type: r.type,
                            title: r.title,
                            createdAt: r.createdAt,
                            duration: r.duration,
                            size: r.size,
                            thumbnail: r.thumbnail,
                            hasTranscript: !!r.transcript,
                        }))
                    resolve(filtered)
                }
                request.onerror = () => reject(request.error)
            })
        } catch (error) {
            console.error("Failed to search recordings:", error)
            return []
        }
    }
}

// Singleton instance
export const localRecordingStorage = new LocalRecordingStorage()

// Recording Manager for handling media recording
export class RecordingManager {
    private mediaRecorder: MediaRecorder | null = null
    private recordedChunks: Blob[] = []
    private recordingStream: MediaStream | null = null
    private startTime: number = 0
    private onDataAvailable: ((chunk: Blob) => void) | null = null

    // Check if recording is supported
    static isSupported(): boolean {
        return typeof window !== "undefined" && "mediaDevices" in navigator && "MediaRecorder" in window
    }

    // Get available mime types
    static getSupportedMimeTypes(): string[] {
        const types = [
            "video/webm;codecs=vp9,opus",
            "video/webm;codecs=vp8,opus",
            "video/webm;codecs=daala,opus",
            "video/webm",
            "audio/webm",
        ]

        return types.filter((type) => MediaRecorder.isTypeSupported(type))
    }

    // Start audio recording
    async startAudioRecording(): Promise<boolean> {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            return this.startRecording(stream, "audio")
        } catch (error) {
            console.error("Failed to start audio recording:", error)
            return false
        }
    }

    // Start video recording
    async startVideoRecording(): Promise<boolean> {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            return this.startRecording(stream, "video")
        } catch (error) {
            console.error("Failed to start video recording:", error)
            return false
        }
    }

    // Start screen recording
    async startScreenRecording(): Promise<boolean> {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: "always" } as MediaTrackConstraints,
                audio: true,
            })
            return this.startRecording(stream, "screen")
        } catch (error) {
            console.error("Failed to start screen recording:", error)
            return false
        }
    }

    // Start recording with given stream
    private async startRecording(stream: MediaStream, type: "audio" | "video" | "screen"): Promise<boolean> {
        this.recordingStream = stream
        this.recordedChunks = []
        this.startTime = Date.now()

        const mimeType = RecordingManager.getSupportedMimeTypes()[0] || "video/webm"

        this.mediaRecorder = new MediaRecorder(stream, {
            mimeType,
            videoBitsPerSecond: 2500000, // 2.5 Mbps
        })

        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.recordedChunks.push(event.data)
                this.onDataAvailable?.(event.data)
            }
        }

        this.mediaRecorder.start(1000) // Collect data every second
        return true
    }

    // Stop recording
    async stopRecording(): Promise<Recording | null> {
        return new Promise((resolve) => {
            if (!this.mediaRecorder || !this.recordingStream) {
                resolve(null)
                return
            }

            this.mediaRecorder.onstop = async () => {
                // Stop all tracks
                if (this.recordingStream) {
                    this.recordingStream.getTracks().forEach((track) => track.stop())
                }

                const blob = new Blob(this.recordedChunks, { type: this.mediaRecorder?.mimeType })
                const duration = Date.now() - this.startTime

                const recording: Recording = {
                    id: `recording_${Date.now()}`,
                    type: "video", // Will be updated based on actual type
                    title: `Recording ${new Date().toLocaleString()}`,
                    createdAt: Date.now(),
                    duration,
                    blob,
                    size: blob.size,
                }

                // Save to local storage
                await localRecordingStorage.saveRecording(recording)

                this.mediaRecorder = null
                this.recordingStream = null

                resolve(recording)
            }

            this.mediaRecorder.stop()
        })
    }

    // Pause recording
    pauseRecording(): boolean {
        if (this.mediaRecorder?.state === "recording") {
            this.mediaRecorder.pause()
            return true
        }
        return false
    }

    // Resume recording
    resumeRecording(): boolean {
        if (this.mediaRecorder?.state === "paused") {
            this.mediaRecorder.resume()
            return true
        }
        return false
    }

    // Get recording duration so far
    getCurrentDuration(): number {
        return Date.now() - this.startTime
    }

    // Check if recording is active
    isRecording(): boolean {
        return this.mediaRecorder?.state === "recording"
    }

    // Check if recording is paused
    isPaused(): boolean {
        return this.mediaRecorder?.state === "paused"
    }

    // Set data callback
    setOnDataAvailable(callback: (chunk: Blob) => void): void {
        this.onDataAvailable = callback
    }

    // Get recording levels
    async getAudioLevels(): Promise<number[]> {
        if (!this.recordingStream) return []

        const audioContext = new AudioContext()
        const source = audioContext.createMediaStreamSource(this.recordingStream)
        const analyser = audioContext.createAnalyser()
        source.connect(analyser)

        const dataArray = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(dataArray)

        return Array.from(dataArray)
    }

    // Cleanup resources
    cleanup(): void {
        if (this.recordingStream) {
            this.recordingStream.getTracks().forEach(track => track.stop())
            this.recordingStream = null
        }
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop()
        }
        this.mediaRecorder = null
        this.recordedChunks = []
    }
}

// Helper functions
export function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    const pad = (n: number) => n.toString().padStart(2, "0")

    if (hours > 0) {
        return `${pad(hours)}:${pad(minutes % 60)}:${pad(seconds % 60)}`
    }
    return `${pad(minutes)}:${pad(seconds % 60)}`
}

export function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}
