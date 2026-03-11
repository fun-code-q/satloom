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
    { id: "bruh", name: "Bruh", icon: "😤", audioUrl: "/sounds/bruh.mp3", duration: 2000, color: "#f59e0b", hotkey: "1" },
    { id: "wow", name: "Wow", icon: "😮", audioUrl: "/sounds/wow.mp3", duration: 1500, color: "#8b5cf6", hotkey: "2" },
    { id: "airhorn", name: "Airhorn", icon: "📢", audioUrl: "/sounds/airhorn.mp3", duration: 1000, color: "#ef4444", hotkey: "3" },
    { id: "vineboom", name: "Vine Boom", icon: "💥", audioUrl: "/sounds/vineboom.mp3", duration: 2000, color: "#dc2626", hotkey: "4" },
    { id: "sad-violin", name: "Sad Violin", icon: "🎻", audioUrl: "/sounds/sad-violin.mp3", duration: 3000, color: "#6366f1", hotkey: "5" },
    { id: "crickets", name: "Crickets", icon: "🦗", audioUrl: "/sounds/crickets.mp3", duration: 2500, color: "#065f46", hotkey: "6" },
    { id: "rimshot", name: "Rimshot", icon: "🥁", audioUrl: "/sounds/rimshot.mp3", duration: 1500, color: "#7c3aed", hotkey: "7" },
    { id: "trombone", name: "Trombone", icon: "🎺", audioUrl: "/sounds/trombone.mp3", duration: 2000, color: "#ca8a04", hotkey: "8" },
    { id: "cartoon-boing", name: "Boing", icon: "🔔", audioUrl: "/sounds/cartoon-boing.mp3", duration: 1000, color: "#0ea5e9", hotkey: "9" },
    { id: "punch", name: "Punch", icon: "👊", audioUrl: "/sounds/punch.mp3", duration: 500, color: "#b91c1c", hotkey: "0" },
    { id: "celebration", name: "Celebrate", icon: "🥳", audioUrl: "/audio-emoji/celebration.mp3", duration: 2000, color: "#10b981", hotkey: "q" },
    { id: "laughter", name: "Laugh", icon: "😂", audioUrl: "/audio-emoji/laughter.mp3", duration: 3000, color: "#fcd34d", hotkey: "w" },
    { id: "applause", name: "Applause", icon: "👏", audioUrl: "/audio-emoji/applause.mp3", duration: 2500, color: "#34d399", hotkey: "e" },
    { id: "correct", name: "Correct", icon: "✅", audioUrl: "/audio-emoji/correct.mp3", duration: 1000, color: "#22c55e", hotkey: "r" },
    { id: "wrong", name: "Wrong", icon: "❌", audioUrl: "/audio-emoji/wrong.mp3", duration: 1000, color: "#ef4444", hotkey: "t" },
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
    private audioElements: Map<string, HTMLAudioElement> = new Map()
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
        this.preloadSounds()
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

        // Listen for remote sounds
        this.listenToRemoteSounds()
    }

    /**
     * Preload all sounds
     */
    private preloadSounds(): void {
        if (typeof window === "undefined") return

        DEFAULT_SOUNDS.forEach((sound) => {
            // Skip preloading for synth sounds
            if (["celebration", "laughter", "applause", "correct", "wrong"].includes(sound.id)) {
                return
            }

            const audio = new Audio(sound.audioUrl)
            audio.preload = "auto"
            audio.volume = this.state.volume
            this.audioElements.set(sound.id, audio)

            audio.addEventListener("ended", () => {
                this.setState({ isPlaying: false, currentSound: null })
            })
        })

        // Initialize AudioContext on user interaction
        document.addEventListener(
            "click",
            () => {
                if (!this.audioContext) {
                    this.audioContext = new AudioContext()
                }
            },
            { once: true }
        )
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
     * Play a sound locally
     */
    private playSoundLocally(soundId: string): void {
        const synthSounds = ["celebration", "laughter", "applause", "correct", "wrong"]

        if (synthSounds.includes(soundId)) {
            this.playSynthSound(soundId)
            this.setState({ isPlaying: true, currentSound: soundId })

            // Auto-reset state after a duration
            const duration = DEFAULT_SOUNDS.find(s => s.id === soundId)?.duration || 1000
            setTimeout(() => {
                this.setState({ isPlaying: false, currentSound: null })
            }, duration)
            return
        }

        const audio = this.audioElements.get(soundId)
        if (audio) {
            audio.currentTime = 0
            audio.volume = this.state.volume
            audio.play().catch((err) => console.error("Failed to play sound:", err))
            this.setState({ isPlaying: true, currentSound: soundId })
        }
    }

    /**
     * Play synthesized sound using Web Audio API
     */
    private playSynthSound(soundId: string): void {
        if (typeof window === "undefined") return

        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        }

        const ctx = this.audioContext
        const now = ctx.currentTime
        const gainNode = ctx.createGain()
        gainNode.connect(ctx.destination)
        gainNode.gain.setValueAtTime(this.state.volume * 0.3, now)

        if (soundId === "celebration") {
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
    }

    /**
     * Play a sound and broadcast to room
     */
    async playSound(soundId: string): Promise<void> {
        // Play locally first for instant feedback
        this.playSoundLocally(soundId)

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
        this.audioElements.forEach((audio) => {
            audio.volume = vol
        })
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
        this.audioElements.forEach((audio) => {
            audio.pause()
            audio.src = ""
        })
        this.audioElements.clear()
        this.unsubscribers.forEach((unsub) => unsub())
        this.unsubscribers = []
        this.roomId = null
        this.userId = null
    }
}

export const soundboard = SoundboardManager.getInstance()
