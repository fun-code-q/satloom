/**
 * Soundboard Manager
 * 
 * Manages meme sound effects that can be triggered by users.
 * Sounds play locally and broadcast to other participants.
 */

import { getFirebaseDatabase } from "@/lib/firebase"
import { ref, set, push, onValue, remove, serverTimestamp } from "firebase/database"

export interface SoundEffect {
    id: string
    name: string
    icon: string
    audioUrl: string
    duration: number // in milliseconds
    color: string
    hotkey?: string
}

export interface SoundboardState {
    isPlaying: boolean
    currentSound: string | null
    volume: number
}

// Predefined sound effects
export const DEFAULT_SOUNDS: SoundEffect[] = [
    { id: "bruh", name: "Bruh", icon: "😤", audioUrl: "/satloom/sounds/bruh.mp3", duration: 2000, color: "#f59e0b", hotkey: "1" },
    { id: "wow", name: "Wow", icon: "😮", audioUrl: "/satloom/sounds/wow.mp3", duration: 1500, color: "#8b5cf6", hotkey: "2" },
    { id: "airhorn", name: "Airhorn", icon: "📢", audioUrl: "/satloom/sounds/airhorn.mp3", duration: 1000, color: "#ef4444", hotkey: "3" },
    { id: "vineboom", name: "Vine Boom", icon: "💥", audioUrl: "/satloom/sounds/vineboom.mp3", duration: 2000, color: "#dc2626", hotkey: "4" },
    { id: "sad-violin", name: "Sad Violin", icon: "🎻", audioUrl: "/satloom/sounds/sad-violin.mp3", duration: 3000, color: "#6366f1", hotkey: "5" },
    { id: "crickets", name: "Crickets", icon: "🦗", audioUrl: "/satloom/sounds/crickets.mp3", duration: 2500, color: "#065f46", hotkey: "6" },
    { id: "rimshot", name: "Rimshot", icon: "🥁", audioUrl: "/satloom/sounds/rimshot.mp3", duration: 1500, color: "#7c3aed", hotkey: "7" },
    { id: "trombone", name: "Trombone", icon: "🎺", audioUrl: "/satloom/sounds/trombone.mp3", duration: 2000, color: "#ca8a04", hotkey: "8" },
    { id: "cartoon-boing", name: "Boing", icon: "🔔", audioUrl: "/satloom/sounds/cartoon-boing.mp3", duration: 1000, color: "#0ea5e9", hotkey: "9" },
    { id: "punch", name: "Punch", icon: "👊", audioUrl: "/satloom/sounds/punch.mp3", duration: 500, color: "#b91c1c", hotkey: "0" },
    { id: "celebration", name: "Celebrate", icon: "🥳", audioUrl: "/satloom/audio-emoji/celebration.mp3", duration: 2000, color: "#10b981", hotkey: "q" },
    { id: "laughter", name: "Laugh", icon: "😂", audioUrl: "/satloom/audio-emoji/laughter.mp3", duration: 3000, color: "#fcd34d", hotkey: "w" },
    { id: "applause", name: "Applause", icon: "👏", audioUrl: "/satloom/audio-emoji/applause.mp3", duration: 2500, color: "#34d399", hotkey: "e" },
    { id: "correct", name: "Correct", icon: "✅", audioUrl: "/satloom/audio-emoji/correct.mp3", duration: 1000, color: "#22c55e", hotkey: "r" },
    { id: "wrong", name: "Wrong", icon: "❌", audioUrl: "/satloom/audio-emoji/wrong.mp3", duration: 1000, color: "#ef4444", hotkey: "t" },
]

export interface PlayedSound {
    id: string
    soundId: string
    userId: string
    userName: string
    timestamp: number
}

class SoundboardManager {
    private static instance: SoundboardManager
    private audioContext: AudioContext | null = null
    private audioBuffers: Map<string, AudioBuffer> = new Map()
    private state: SoundboardState = {
        isPlaying: false,
        currentSound: null,
        volume: 0.7,
    }
    private listeners: ((state: SoundboardState) => void)[] = []
    private roomId: string | null = null
    private userId: string | null = null
    private userName: string = "Anonymous"
    private unsubscribers: (() => void)[] = []
    private lastPlayedTimestamp: number = Date.now()

    private constructor() {
        console.log("[Soundboard] Constructor called, waiting for interaction to init AudioContext...")
    }

    static getInstance(): SoundboardManager {
        if (!SoundboardManager.instance) {
            SoundboardManager.instance = new SoundboardManager()
        }
        return SoundboardManager.instance
    }

    /**
     * Initialize soundboard for a room
     */
    initialize(roomId: string, userId: string, userName: string): void {
        // Clear existing room listeners if room changes or re-initializing
        this.unsubscribers.forEach((unsub) => unsub())
        this.unsubscribers = []

        this.roomId = roomId
        this.userId = userId
        this.userName = userName

        // Preload sounds if not already done
        this.preloadSounds()

        // Listen for remote sounds
        this.listenToRemoteSounds()

        // Global click listener to resume/init audio context
        if (typeof window !== "undefined") {
            const resumeAudio = async () => {
                if (!this.audioContext) {
                    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
                }
                if (this.audioContext.state === 'suspended') {
                    await this.audioContext.resume()
                }
            }
            document.addEventListener("click", resumeAudio, { once: false })
        }
    }

    /**
     * Preload all sounds using AudioContext
     */
    private async preloadSounds(): Promise<void> {
        if (typeof window === "undefined" || this.audioBuffers.size > 0) return

        console.log("[Soundboard] Preloading sounds into AudioBuffers...")

        // We need a temporary context if the main one isn't ready, 
        // but decoding usually works better on the actual context.
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        }

        const loadSound = async (sound: SoundEffect) => {
            // Skip placeholders that use synth logic
            const synthSounds = ["celebration", "laughter", "applause", "correct", "wrong"]
            if (synthSounds.includes(sound.id)) return

            try {
                const response = await fetch(sound.audioUrl)
                const arrayBuffer = await response.arrayBuffer()
                const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer)
                this.audioBuffers.set(sound.id, audioBuffer)
                console.log(`[Soundboard] Decoded: ${sound.id}`)
            } catch (err) {
                console.error(`[Soundboard] Failed to load/decode ${sound.id}:`, err)
            }
        }

        // Load all concurrently
        await Promise.all(DEFAULT_SOUNDS.map(loadSound))
        console.log(`[Soundboard] Preloaded ${this.audioBuffers.size} audio buffers`)
    }

    private listenToRemoteSounds(): void {
        if (!this.roomId || !getFirebaseDatabase()) return

        const soundsRef = ref(getFirebaseDatabase()!, `rooms/${this.roomId}/sounds`)
        const unsubscribe = onValue(soundsRef, (snapshot) => {
            const data = snapshot.val()
            if (data) {
                const sounds = Object.entries(data as Record<string, PlayedSound>)
                // Only process sounds that are newer than our last played sound
                const newSounds = sounds.filter(([_, sound]) => {
                    return sound.timestamp > this.lastPlayedTimestamp && sound.userId !== this.userId
                })

                if (newSounds.length > 0) {
                    // Update the last played timestamp to the newest one in this batch
                    const latestTimestamp = Math.max(...newSounds.map(([_, s]) => s.timestamp))
                    this.lastPlayedTimestamp = latestTimestamp

                    newSounds.forEach(([_, sound]) => {
                        this.playSoundLocally(sound.soundId)
                    })
                }
            }
        })

        this.unsubscribers.push(unsubscribe)
    }

    /**
     * Play a sound locally using AudioContext
     */
    private async playSoundLocally(soundId: string): Promise<void> {
        if (typeof window === "undefined") return

        // Ensure Context is ready
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        }

        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume()
        }

        const buffer = this.audioBuffers.get(soundId)
        if (buffer) {
            try {
                const source = this.audioContext.createBufferSource()
                source.buffer = buffer

                const gainNode = this.audioContext.createGain()
                gainNode.gain.setValueAtTime(this.state.volume, this.audioContext.currentTime)

                source.connect(gainNode)
                gainNode.connect(this.audioContext.destination)

                source.start(0)
                this.setState({ isPlaying: true, currentSound: soundId })

                source.onended = () => {
                    this.setState({ isPlaying: false, currentSound: null })
                }
            } catch (err) {
                console.error(`[Soundboard] Error playing AudioBuffer ${soundId}, falling back to synth:`, err)
                this.playSynthSound(soundId)
            }
        } else {
            console.warn(`[Soundboard] Buffer missing for ${soundId}, playing synth version...`)
            this.playSynthSound(soundId)
        }
    }

    /**
     * Play synthesized sound using Web Audio API
     */
    private playSynthSound(soundId: string): void {
        if (!this.audioContext) return

        const ctx = this.audioContext
        const now = ctx.currentTime
        const gainNode = ctx.createGain()
        gainNode.connect(ctx.destination)
        gainNode.gain.setValueAtTime(this.state.volume * 0.4, now)

        this.setState({ isPlaying: true, currentSound: soundId })

        // Find duration for state reset
        const sound = DEFAULT_SOUNDS.find(s => s.id === soundId)
        const duration = sound?.duration || 1000

        if (soundId === "bruh") {
            // Low thud synth
            const osc = ctx.createOscillator()
            osc.type = "sine"
            osc.frequency.setValueAtTime(150, now)
            osc.frequency.exponentialRampToValueAtTime(40, now + 0.3)
            osc.connect(gainNode)
            osc.start(now)
            osc.stop(now + 0.4)
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4)
        } else if (soundId === "wow") {
            // "Wow" - high rising pitch
            const osc = ctx.createOscillator()
            osc.type = "sine"
            osc.frequency.setValueAtTime(300, now)
            osc.frequency.exponentialRampToValueAtTime(600, now + 0.2)
            osc.frequency.exponentialRampToValueAtTime(500, now + 0.4)
            osc.connect(gainNode)
            osc.start(now)
            osc.stop(now + 0.5)
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5)
        } else if (soundId === "airhorn") {
            // Aggressive sawtooth blasts
            for (let i = 0; i < 3; i++) {
                const osc = ctx.createOscillator()
                const start = now + (i * 0.2)
                osc.type = "sawtooth"
                osc.frequency.setValueAtTime(440 + (i * 10), start)
                osc.connect(gainNode)
                osc.start(start)
                osc.stop(start + 0.15)
            }
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.8)
        } else if (soundId === "vineboom") {
            // Deep 808-style drop
            const osc = ctx.createOscillator()
            osc.type = "sine"
            osc.frequency.setValueAtTime(60, now)
            osc.frequency.exponentialRampToValueAtTime(30, now + 0.8)
            osc.connect(gainNode)
            osc.start(now)
            osc.stop(now + 1.0)
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 1.0)
        } else if (soundId === "sad-violin") {
            // High wavering pitch
            const osc = ctx.createOscillator()
            osc.type = "triangle"
            osc.frequency.setValueAtTime(880, now)
            for (let i = 0; i < 10; i++) {
                osc.frequency.linearRampToValueAtTime(880 + (i % 2 === 0 ? 20 : -20), now + (i * 0.1))
            }
            osc.connect(gainNode)
            osc.start(now)
            osc.stop(now + 1.2)
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 1.2)
        } else if (soundId === "crickets") {
            // Chirping noise
            for (let i = 0; i < 5; i++) {
                const start = now + (i * 0.4)
                const osc = ctx.createOscillator()
                osc.type = "sine"
                osc.frequency.setValueAtTime(4000, start)
                osc.connect(gainNode)
                osc.start(start)
                osc.stop(start + 0.1)
            }
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 2.0)
        } else if (soundId === "rimshot") {
            // Snare-like noise burst then tap
            const noise = ctx.createOscillator()
            noise.type = "square"
            noise.frequency.setValueAtTime(1000, now)
            noise.connect(gainNode)
            noise.start(now)
            noise.stop(now + 0.05)

            const tap = ctx.createOscillator()
            tap.type = "sine"
            tap.frequency.setValueAtTime(200, now + 0.1)
            tap.connect(gainNode)
            tap.start(now + 0.1)
            tap.stop(now + 0.15)
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3)
        } else if (soundId === "trombone") {
            // Falling saw wave
            const osc = ctx.createOscillator()
            osc.type = "sawtooth"
            osc.frequency.setValueAtTime(220, now)
            osc.frequency.exponentialRampToValueAtTime(110, now + 0.8)
            osc.connect(gainNode)
            osc.start(now)
            osc.stop(now + 1.0)
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 1.0)
        } else if (soundId === "cartoon-boing") {
            // Rising sine
            const osc = ctx.createOscillator()
            osc.type = "sine"
            osc.frequency.setValueAtTime(200, now)
            osc.frequency.exponentialRampToValueAtTime(800, now + 0.3)
            osc.connect(gainNode)
            osc.start(now)
            osc.stop(now + 0.4)
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4)
        } else if (soundId === "punch") {
            // Low freq impact
            const osc = ctx.createOscillator()
            osc.type = "square"
            osc.frequency.setValueAtTime(80, now)
            osc.connect(gainNode)
            osc.start(now)
            osc.stop(now + 0.05)
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1)
        } else if (soundId === "celebration") {
            // Arpeggio synthesis
            for (let i = 0; i < 4; i++) {
                const osc = ctx.createOscillator()
                const freq = [440, 554.37, 659.25, 880][i]
                osc.type = "sine"
                osc.frequency.setValueAtTime(freq, now + (i * 0.1))
                osc.connect(gainNode)
                osc.start(now + (i * 0.1))
                osc.stop(now + (i * 0.1) + 0.3)
            }
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.8)
        } else if (soundId === "laughter") {
            // Staccato synthesis
            for (let i = 0; i < 6; i++) {
                const osc = ctx.createOscillator()
                osc.type = "triangle"
                osc.frequency.setValueAtTime(800 + (i % 2 === 0 ? 200 : 0), now + (i * 0.12))
                osc.connect(gainNode)
                osc.start(now + (i * 0.12))
                osc.stop(now + (i * 0.12) + 0.08)
            }
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 1.0)
        } else if (soundId === "applause") {
            // Noise synthesis for clapping
            for (let i = 0; i < 8; i++) {
                const osc = ctx.createOscillator()
                osc.type = "sawtooth"
                osc.frequency.setValueAtTime(200 + Math.random() * 100, now + (i * 0.15))
                osc.connect(gainNode)
                osc.start(now + (i * 0.15))
                osc.stop(now + (i * 0.15) + 0.05)
            }
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 1.5)
        } else if (soundId === "correct") {
            const osc = ctx.createOscillator()
            osc.type = "sine"
            osc.frequency.setValueAtTime(600, now)
            osc.frequency.setValueAtTime(800, now + 0.15)
            osc.connect(gainNode)
            osc.start(now)
            osc.stop(now + 0.5)
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5)
        } else if (soundId === "wrong") {
            const osc = ctx.createOscillator()
            osc.type = "sawtooth"
            osc.frequency.setValueAtTime(150, now)
            osc.frequency.linearRampToValueAtTime(120, now + 0.5)
            osc.connect(gainNode)
            osc.start(now)
            osc.stop(now + 0.6)
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.6)
        }

        // Auto-reset state
        setTimeout(() => {
            this.setState({ isPlaying: false, currentSound: null })
        }, duration)
    }

    /**
     * Play a sound and broadcast to room
     */
    async playSound(soundId: string): Promise<void> {
        // Play locally first
        await this.playSoundLocally(soundId)

        // Broadcast to room
        if (this.roomId && getFirebaseDatabase()!) {
            const soundsRef = ref(getFirebaseDatabase()!, `rooms/${this.roomId}/sounds`)
            const newSoundRef = push(soundsRef)
            await set(newSoundRef, {
                id: newSoundRef.key,
                soundId,
                userId: this.userId,
                userName: this.userName,
                timestamp: Date.now(),
            } as PlayedSound)
        }
    }

    /**
     * Set volume
     */
    setVolume(volume: number): void {
        const vol = Math.max(0, Math.min(1, volume))
        this.setState({ volume: vol })
    }

    /**
     * Get volume
     */
    getVolume(): number {
        return this.state.volume
    }

    /**
     * Get available sounds
     */
    getSounds(): SoundEffect[] {
        return DEFAULT_SOUNDS
    }

    /**
     * Get current state
     */
    getState(): SoundboardState {
        return { ...this.state }
    }

    /**
     * Subscribe to state changes
     */
    subscribe(listener: (state: SoundboardState) => void): () => void {
        this.listeners.push(listener)
        return () => {
            this.listeners = this.listeners.filter((l) => l !== listener)
        }
    }

    /**
     * Set state and notify listeners
     */
    private setState(partial: Partial<SoundboardState>): void {
        this.state = { ...this.state, ...partial }
        this.notifyListeners()
    }

    /**
     * Notify all listeners
     */
    private notifyListeners(): void {
        this.listeners.forEach((listener) => listener(this.getState()))
    }

    /**
     * Setup keyboard shortcuts
     */
    setupHotkeys(): () => void {
        if (typeof window === "undefined") return () => { }

        const handleKeydown = (e: KeyboardEvent) => {
            // Ignore if typing in input
            if (
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement
            ) {
                return
            }

            const sound = DEFAULT_SOUNDS.find((s) => s.hotkey === e.key.toLowerCase())
            if (sound) {
                e.preventDefault()
                this.playSound(sound.id)
            }
        }

        window.addEventListener("keydown", handleKeydown)
        return () => window.removeEventListener("keydown", handleKeydown)
    }

    /**
     * Clean up
     */
    destroy(): void {
        this.audioBuffers.clear()
        this.unsubscribers.forEach((unsub) => unsub())
        this.unsubscribers = []
        this.roomId = null
        this.userId = null
        if (this.audioContext) {
            this.audioContext.close()
            this.audioContext = null
        }
    }
}

export const soundboard = SoundboardManager.getInstance()
