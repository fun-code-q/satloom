import { getFirebaseDatabase } from "@/lib/firebase"
import { ref, set, push, onValue, remove, serverTimestamp } from "firebase/database"
import { generateWavDataUri } from "../hardware/audio-utility"

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
    private audioCache: Map<string, HTMLAudioElement> = new Map()
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

    private constructor() {}

    static getInstance(): SoundboardManager {
        if (!SoundboardManager.instance) {
            SoundboardManager.instance = new SoundboardManager()
        }
        return SoundboardManager.instance
    }

    initialize(roomId: string, userId: string, userName: string): void {
        this.unsubscribers.forEach((unsub) => unsub())
        this.unsubscribers = []

        this.roomId = roomId
        this.userId = userId
        this.userName = userName

        this.listenToRemoteSounds()
    }

    private listenToRemoteSounds(): void {
        if (!this.roomId || !getFirebaseDatabase()) return

        const soundsRef = ref(getFirebaseDatabase()!, `rooms/${this.roomId}/sounds`)
        const unsubscribe = onValue(soundsRef, (snapshot) => {
            const data = snapshot.val()
            if (data) {
                const sounds = Object.entries(data as Record<string, PlayedSound>)
                const newSounds = sounds.filter(([_, sound]) => {
                    return sound.timestamp > this.lastPlayedTimestamp && sound.userId !== this.userId
                })

                if (newSounds.length > 0) {
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

    private async playSoundLocally(soundId: string): Promise<void> {
        if (typeof window === "undefined") return

        const sound = DEFAULT_SOUNDS.find(s => s.id === soundId)
        if (!sound) return

        try {
            let audio = this.audioCache.get(soundId)
            if (!audio) {
                audio = new Audio(sound.audioUrl)
                this.audioCache.set(soundId, audio)
            }

            audio.volume = this.state.volume
            audio.currentTime = 0
            
            this.setState({ isPlaying: true, currentSound: soundId })
            
            await audio.play().catch(err => {
                console.warn(`[Soundboard] File play failed for ${soundId}, trying synth fallback:`, err)
                this.playSynthSound(soundId)
            })

            audio.onended = () => {
                this.setState({ isPlaying: false, currentSound: null })
            }
        } catch (err) {
            console.error(`[Soundboard] Error playing ${soundId}:`, err)
            this.playSynthSound(soundId)
        }
    }

    /**
     * Play synthesized sound using Web Audio API
     */
    private playSynthSound(soundId: string): void {
        const sound = DEFAULT_SOUNDS.find(s => s.id === soundId)
        const duration = (sound?.duration || 1000) / 1000
        
        let freq = 440
        let type: 'sine' | 'square' | 'sawtooth' = 'sine'

        if (soundId === "bruh") {
            freq = 60
            type = 'sine'
        } else if (soundId === "wow") {
            freq = 400
            type = 'sine'
        } else if (soundId === "airhorn") {
            freq = 440
            type = 'sawtooth'
        } else if (soundId === "vineboom") {
            freq = 50
            type = 'sine'
        } else if (soundId === "wrong") {
            freq = 150
            type = 'sawtooth'
        }

        const url = generateWavDataUri(freq, duration, this.state.volume * 0.4, type)
        const audio = new Audio(url)
        
        this.setState({ isPlaying: true, currentSound: soundId })
        audio.play().catch(() => {})

        setTimeout(() => {
            this.setState({ isPlaying: false, currentSound: null })
            if (url.startsWith('blob:')) {
                URL.revokeObjectURL(url)
            }
        }, duration * 1000)
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

    destroy(): void {
        this.audioCache.forEach(audio => {
            audio.pause()
            if (audio.src.startsWith('blob:')) {
                URL.revokeObjectURL(audio.src)
            }
        })
        this.audioCache.clear()
        this.unsubscribers.forEach((unsub) => unsub())
        this.unsubscribers = []
        this.roomId = null
        this.userId = null
    }
}

export const soundboard = SoundboardManager.getInstance()
