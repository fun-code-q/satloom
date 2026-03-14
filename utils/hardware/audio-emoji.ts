/**
 * Audio Emoji Manager
 * 
 * Short sound reactions that play in chat (🥳, 😂, 🔥, etc.)
 */

import { getFirebaseDatabase } from "@/lib/firebase"
import { ref, set, push, onValue, remove } from "firebase/database"
import { generateWavDataUri } from "./audio-utility"

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
    { id: "celebration", name: "Celebration", emoji: "🥳", audioUrl: "/satloom/audio-emoji/celebration.mp3", duration: 2000, category: "reaction" },
    { id: "laughter", name: "Laughter", emoji: "😂", audioUrl: "/satloom/audio-emoji/laughter.mp3", duration: 3000, category: "reaction" },
    { id: "fire", name: "Fire", emoji: "🔥", audioUrl: "/satloom/audio-emoji/fire.mp3", duration: 1500, category: "reaction" },
    { id: "applause", name: "Applause", emoji: "👏", audioUrl: "/satloom/audio-emoji/applause.mp3", duration: 2500, category: "reaction" },
    { id: "wow", name: "Wow", emoji: "😮", audioUrl: "/satloom/audio-emoji/wow.mp3", duration: 1500, category: "reaction" },
    { id: "sad", name: "Sad", emoji: "😢", audioUrl: "/satloom/audio-emoji/sad.mp3", duration: 2000, category: "reaction" },
    { id: "angry", name: "Angry", emoji: "😡", audioUrl: "/satloom/audio-emoji/angry.mp3", duration: 1500, category: "reaction" },
    { id: "love", name: "Love", emoji: "❤️", audioUrl: "/satloom/audio-emoji/love.mp3", duration: 2000, category: "reaction" },

    // Game sounds
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

  private async playLocalAudio(emoji: AudioEmoji): Promise<void> {
    if (this.audioElement) {
      this.audioElement.pause();
    }

    // Determine signal parameters for procedural fallback
    let freq = 440;
    let duration = emoji.duration / 1000;
    let type: 'sine' | 'square' | 'sawtooth' = 'sine';

    if (emoji.id === "celebration") {
      freq = 880;
      type = 'sine';
    } else if (emoji.id === "laughter") {
      freq = 600;
      type = 'square';
    } else if (emoji.id === "sad" || emoji.id === "sad_violin") {
      freq = 330;
      type = 'sine';
    } else if (emoji.id === "wrong" || emoji.id === "buzzer") {
      freq = 150;
      type = 'sawtooth';
    } else if (emoji.id === "fire" || emoji.id === "vine_boom") {
      freq = 100;
      type = 'square';
    } else if (emoji.id === "ding") {
      freq = 1200;
      type = 'sine';
    }

    // Use HTML5 Audio
    const url = generateWavDataUri(freq, duration, 0.3, type);
    this.audioElement = new Audio(url);
    this.audioElement.volume = 0.5;

    this.state.isPlaying = true;
    this.notify();

    await this.audioElement.play().catch(err => {
      console.warn("AudioEmojiManager: Failed to play audio", err);
    });

    setTimeout(() => {
      this.state.isPlaying = false;
      this.notify();
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    }, emoji.duration);
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
