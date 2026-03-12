/**
 * Audio Emoji Manager
 * 
 * Short sound reactions that play in chat (🥳, 😂, 🔥, etc.)
 */

import { getFirebaseDatabase } from "@/lib/firebase"
import { ref, set, push, onValue, remove } from "firebase/database"

// Safe database reference with null check
const getDbRef = (path: string) => {
    if (!getFirebaseDatabase()!) {
        console.error("Firebase database not initialized")
        return null
    }
    return ref(getFirebaseDatabase()!, path)
}

export interface AudioEmoji {
    id: string
    name: string
    emoji: string
    audioUrl: string
    duration: number // in milliseconds
    category: "reaction" | "game" | "meme" | "custom"
}

export interface AudioEmojiPlay {
    id: string
    emojiId: string
    userId: string
    userName: string
    timestamp: number
    roomId: string
}

export interface AudioEmojiState {
    isPlaying: boolean
    recentPlays: AudioEmojiPlay[]
    availableEmojis: AudioEmoji[]
}

export const DEFAULT_AUDIO_EMOJIS: AudioEmoji[] = [
    // Reaction sounds
    { id: "celebration", name: "Celebration", emoji: "🥳", audioUrl: "audio-emoji/celebration.mp3", duration: 2000, category: "reaction" },
    { id: "laughter", name: "Laughter", emoji: "😂", audioUrl: "audio-emoji/laughter.mp3", duration: 3000, category: "reaction" },
    { id: "fire", name: "Fire", emoji: "🔥", audioUrl: "audio-emoji/fire.mp3", duration: 1500, category: "reaction" },
    { id: "applause", name: "Applause", emoji: "👏", audioUrl: "audio-emoji/applause.mp3", duration: 2500, category: "reaction" },
    { id: "wow", name: "Wow", emoji: "😮", audioUrl: "audio-emoji/wow.mp3", duration: 1500, category: "reaction" },
    { id: "sad", name: "Sad", emoji: "😢", audioUrl: "audio-emoji/sad.mp3", duration: 2000, category: "reaction" },
    { id: "angry", name: "Angry", emoji: "😡", audioUrl: "audio-emoji/angry.mp3", duration: 1500, category: "reaction" },
    { id: "love", name: "Love", emoji: "❤️", audioUrl: "audio-emoji/love.mp3", duration: 2000, category: "reaction" },

    // Game sounds
    { id: "correct", name: "Correct", emoji: "✅", audioUrl: "audio-emoji/correct.mp3", duration: 1000, category: "game" },
    { id: "wrong", name: "Wrong", emoji: "❌", audioUrl: "audio-emoji/wrong.mp3", duration: 1000, category: "game" },
    { id: "buzzer", name: "Buzzer", emoji: "🔔", audioUrl: "audio-emoji/buzzer.mp3", duration: 2000, category: "game" },
    { id: "ding", name: "Ding", emoji: "🔔", audioUrl: "audio-emoji/ding.mp3", duration: 500, category: "game" },
    { id: "countdown", name: "Countdown", emoji: "⏰", audioUrl: "audio-emoji/countdown.mp3", duration: 3000, category: "game" },

    // Meme sounds
    { id: "bruh", name: "Bruh", emoji: "😤", audioUrl: "audio-emoji/bruh.mp3", duration: 1000, category: "meme" },
    { id: "vine_boom", name: "Vine Boom", emoji: "💥", audioUrl: "audio-emoji/vine-boom.mp3", duration: 2000, category: "meme" },
    { id: "airhorn", name: "Airhorn", emoji: "📢", audioUrl: "audio-emoji/airhorn.mp3", duration: 1500, category: "meme" },
    { id: "sad_violin", name: "Sad Violin", emoji: "🎻", audioUrl: "audio-emoji/sad-violin.mp3", duration: 3000, category: "meme" },
    { id: "crickets", name: "Crickets", emoji: "🦗", audioUrl: "audio-emoji/crickets.mp3", duration: 3000, category: "meme" },
    { id: "wow_spongebob", name: "Spongebob Wow", emoji: "🧜", audioUrl: "audio-emoji/spongebob-wow.mp3", duration: 2000, category: "meme" },
]

class AudioEmojiManager {
    private static instance: AudioEmojiManager
    private state: AudioEmojiState = {
        isPlaying: false,
        recentPlays: [],
        availableEmojis: DEFAULT_AUDIO_EMOJIS,
    }
    private listeners: ((state: AudioEmojiState) => void)[] = []
    private unsubscribe: (() => void) | null = null
    private roomId: string = ""
    private userId: string = ""
    private userName: string = ""
    private audioElement: HTMLAudioElement | null = null
    private playedEventIds: Set<string> = new Set()

    private constructor() { }

    static getInstance(): AudioEmojiManager {
        if (!AudioEmojiManager.instance) {
            AudioEmojiManager.instance = new AudioEmojiManager()
        }
        return AudioEmojiManager.instance
    }

    initialize(roomId: string, userId: string, userName: string): void {
        this.roomId = roomId
        this.userId = userId
        this.userName = userName
    }

    subscribe(listener: (state: AudioEmojiState) => void): () => void {
        this.listeners.push(listener)
        listener(this.state)

        return () => {
            this.listeners = this.listeners.filter(l => l !== listener)
        }
    }

    private notify(): void {
        this.listeners.forEach(listener => listener(this.state))
    }

    async playAudioEmoji(emojiId: string): Promise<void> {
        const emoji = this.state.availableEmojis.find(e => e.id === emojiId)
        if (!emoji) return

        // Create play event
        const play: AudioEmojiPlay = {
            id: `play_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            emojiId,
            userId: this.userId,
            userName: this.userName,
            timestamp: Date.now(),
            roomId: this.roomId,
        }

        // Save to Firebase
        const playsRef = getDbRef(`audioEmojiPlays/${this.roomId}`)
        if (playsRef) {
            await push(playsRef, play)
        }

        // Play local audio (with fallback for demo)
        this.playLocalAudio(emoji)
        this.playedEventIds.add(play.id)
    }

    private playLocalAudio(emoji: AudioEmoji): void {
        // Generate simple beep sounds for demo (since we don't have actual audio files)
        if (this.audioElement) {
            this.audioElement.pause()
        }

        this.audioElement = new Audio()
        this.audioElement.volume = 0.5

        // Create a simple beep pattern based on emoji type
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)

        // Different sounds for specific emojis
        const now = audioContext.currentTime

        if (emoji.id === "celebration") {
            // Arpeggio
            oscillator.type = "sine"
            oscillator.frequency.setValueAtTime(440, now)       // A4
            oscillator.frequency.setValueAtTime(554.37, now + 0.1) // C#5
            oscillator.frequency.setValueAtTime(659.25, now + 0.2) // E5
            oscillator.frequency.setValueAtTime(880, now + 0.3)    // A5
            gainNode.gain.setValueAtTime(0.3, now)
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.8)
            oscillator.start(now)
            oscillator.stop(now + 0.8)
            emoji.duration = 800
        } else if (emoji.id === "laughter") {
            // Staccato high pitches
            oscillator.type = "triangle"
            for (let i = 0; i < 5; i++) {
                oscillator.frequency.setValueAtTime(800 + (i % 2 === 0 ? 200 : 0), now + (i * 0.15))
                gainNode.gain.setValueAtTime(0.3, now + (i * 0.15))
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + (i * 0.15) + 0.1)
            }
            oscillator.start(now)
            oscillator.stop(now + 0.8)
            emoji.duration = 800
        } else if (emoji.id === "sad" || emoji.id === "sad_violin") {
            // Descending pitch
            oscillator.type = "sine"
            oscillator.frequency.setValueAtTime(440, now)
            oscillator.frequency.exponentialRampToValueAtTime(220, now + 1.0)
            gainNode.gain.setValueAtTime(0.3, now)
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 1.0)
            oscillator.start(now)
            oscillator.stop(now + 1.0)
            emoji.duration = 1000
        } else if (emoji.id === "correct") {
            // Happy ding (two rising notes)
            oscillator.type = "sine"
            oscillator.frequency.setValueAtTime(600, now)
            oscillator.frequency.setValueAtTime(800, now + 0.15)
            gainNode.gain.setValueAtTime(0.3, now)
            gainNode.gain.setValueAtTime(0.3, now + 0.15)
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5)
            oscillator.start(now)
            oscillator.stop(now + 0.5)
            emoji.duration = 500
        } else if (emoji.id === "wrong" || emoji.id === "buzzer") {
            // Low harsh buzz
            oscillator.type = "sawtooth"
            oscillator.frequency.setValueAtTime(150, now)
            oscillator.frequency.setValueAtTime(140, now + 0.2)
            gainNode.gain.setValueAtTime(0.3, now)
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.6)
            oscillator.start(now)
            oscillator.stop(now + 0.6)
            emoji.duration = 600
        } else if (emoji.id === "fire" || emoji.id === "vine_boom") {
            // Low boom drop
            oscillator.type = "square"
            oscillator.frequency.setValueAtTime(100, now)
            oscillator.frequency.exponentialRampToValueAtTime(40, now + 0.5)
            gainNode.gain.setValueAtTime(0.4, now)
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5)
            oscillator.start(now)
            oscillator.stop(now + 0.5)
            emoji.duration = 500
        } else if (emoji.id === "ding") {
            oscillator.type = "sine"
            oscillator.frequency.setValueAtTime(1200, now)
            gainNode.gain.setValueAtTime(0.3, now)
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5)
            oscillator.start(now)
            oscillator.stop(now + 0.5)
            emoji.duration = 500
        } else {
            // Generic fallback sounds based on category
            switch (emoji.category) {
                case "reaction":
                    oscillator.frequency.value = 500
                    oscillator.type = "sine"
                    break
                case "game":
                    oscillator.frequency.value = 880
                    oscillator.type = "square"
                    break
                case "meme":
                    oscillator.frequency.value = 220
                    oscillator.type = "sawtooth"
                    break
                default:
                    oscillator.frequency.value = 440
                    oscillator.type = "sine"
            }
            gainNode.gain.setValueAtTime(0.3, now)
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5)
            oscillator.start(now)
            oscillator.stop(now + 0.5)
            emoji.duration = 500
        }

        this.state.isPlaying = true
        this.notify()

        setTimeout(() => {
            this.state.isPlaying = false
            this.notify()
        }, emoji.duration)
    }

    async addCustomEmoji(name: string, emoji: string, audioUrl: string, duration: number = 2000): Promise<void> {
        const customEmoji: AudioEmoji = {
            id: `custom_${Date.now()}`,
            name,
            emoji,
            audioUrl,
            duration,
            category: "custom",
        }

        this.state.availableEmojis.push(customEmoji)
        this.notify()
    }

    async removeCustomEmoji(emojiId: string): Promise<void> {
        this.state.availableEmojis = this.state.availableEmojis.filter(e => e.id !== emojiId || e.category !== "custom")
        this.notify()
    }

    listenForPlays(): void {
        const playsRef = getDbRef(`audioEmojiPlays/${this.roomId}`)
        if (playsRef) {
            this.unsubscribe = onValue(playsRef, (snapshot) => {
                const data = snapshot.val() as Record<string, AudioEmojiPlay> | null
                if (data) {
                    const plays = Object.values(data)
                        .filter(p => p.timestamp > Date.now() - 60000) // Last 60 seconds
                        .sort((a, b) => b.timestamp - a.timestamp)
                        .slice(0, 10) // Keep last 10 plays

                    this.state.recentPlays = plays
                    this.notify()

                    // Play new arriving events for other users' reactions
                    plays.forEach(play => {
                        if (play.userId !== this.userId && !this.playedEventIds.has(play.id)) {
                            this.playedEventIds.add(play.id)
                            const emoji = this.state.availableEmojis.find(e => e.id === play.emojiId)
                            if (emoji) {
                                this.playLocalAudio(emoji)
                            }
                        }
                    })
                }
            })
        }
    }

    stopListening(): void {
        if (this.unsubscribe) {
            this.unsubscribe()
            this.unsubscribe = null
        }
    }

    getState(): AudioEmojiState {
        return this.state
    }

    getEmojisByCategory(category: AudioEmoji["category"]): AudioEmoji[] {
        return this.state.availableEmojis.filter(e => e.category === category)
    }

    getAllEmojis(): AudioEmoji[] {
        return this.state.availableEmojis
    }

    destroy(): void {
        this.stopListening()
        this.listeners = []
        this.state = {
            isPlaying: false,
            recentPlays: [],
            availableEmojis: DEFAULT_AUDIO_EMOJIS,
        }
        this.playedEventIds.clear()
    }
}

export const audioEmojiManager = AudioEmojiManager.getInstance()
