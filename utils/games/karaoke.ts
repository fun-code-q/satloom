/**
 * Karaoke Mode Manager
 * 
 * Manages karaoke sessions with lyrics overlay, scoring, and multiplayer support.
 */

import { getFirebaseDatabase } from "@/lib/firebase"
import { ref, set, get, update, onValue, remove } from "firebase/database"

export type KaraokeRole = "singer" | "audience"

export interface LyricLine {
    id: string
    startTime: number // milliseconds
    endTime: number
    text: string
    words?: { text: string; startTime: number; endTime: number }[]
}

export interface KaraokeSong {
    id: string
    title: string
    artist: string
    duration: number
    lyrics: LyricLine[]
    coverUrl?: string
}

export interface KaraokePlayer {
    id: string
    name: string
    role: KaraokeRole
    score: number
    isSinging: boolean
    hasJoined: boolean
}

export interface KaraokeSession {
    id: string
    roomId: string
    song: KaraokeSong | null
    status: "waiting" | "playing" | "paused" | "ended"
    currentTime: number
    players: Record<string, KaraokePlayer>
    hostId: string
    createdAt: number
}

export interface KaraokeInvite {
    id: string
    roomId: string
    song: KaraokeSong
    hostId: string
    hostName: string
    expiresAt: number
}

// Demo songs for testing
export const DEMO_SONGS: KaraokeSong[] = [
    {
        id: "song-1",
        title: "Amazing Grace",
        artist: "Traditional",
        duration: 180000,
        lyrics: [
            { id: "l1", startTime: 0, endTime: 8000, text: "Amazing grace, how sweet the sound" },
            { id: "l2", startTime: 8000, endTime: 16000, text: "That saved a wretch like me" },
            { id: "l3", startTime: 16000, endTime: 24000, text: "I once was lost, but now am found" },
            { id: "l4", startTime: 24000, endTime: 32000, text: "Was blind, but now I see" },
        ],
    },
    {
        id: "song-2",
        title: "Twinkle Twinkle",
        artist: "Nursery Rhyme",
        duration: 120000,
        lyrics: [
            { id: "l1", startTime: 0, endTime: 5000, text: "Twinkle, twinkle, little star" },
            { id: "l2", startTime: 5000, endTime: 10000, text: "How I wonder what you are" },
            { id: "l3", startTime: 10000, endTime: 15000, text: "Up above the world so high" },
            { id: "l4", startTime: 15000, endTime: 20000, text: "Like a diamond in the sky" },
        ],
    },
    {
        id: "song-3",
        title: "Happy Birthday",
        artist: "Traditional",
        duration: 60000,
        lyrics: [
            { id: "l1", startTime: 0, endTime: 4000, text: "Happy birthday to you" },
            { id: "l2", startTime: 4000, endTime: 8000, text: "Happy birthday to you" },
            { id: "l3", startTime: 8000, endTime: 12000, text: "Happy birthday dear user" },
            { id: "l4", startTime: 12000, endTime: 16000, text: "Happy birthday to you!" },
        ],
    },
]

interface KaraokeState {
    isActive: boolean
    session: KaraokeSession | null
    currentPlayer: string | null
    isSinging: boolean
    score: number
    lyricsProgress: number
    currentTime: number
}

class KaraokeManager {
    private static instance: KaraokeManager
    private state: KaraokeState = {
        isActive: false,
        session: null,
        currentPlayer: null,
        isSinging: false,
        score: 0,
        lyricsProgress: 0,
        currentTime: 0,
    }
    private listeners: ((state: KaraokeState) => void)[] = []
    private roomId: string | null = null
    private userId: string | null = null
    private userName: string = "Anonymous"
    private unsubscribers: (() => void)[] = []
    private animationFrameId: number | null = null

    private constructor() { }

    static getInstance(): KaraokeManager {
        if (!KaraokeManager.instance) {
            KaraokeManager.instance = new KaraokeManager()
        }
        return KaraokeManager.instance
    }

    /**
     * Initialize for a room
     */
    initialize(roomId: string, userId: string, userName: string): void {
        this.roomId = roomId
        this.userId = userId
        this.userName = userName
    }

    /**
     * Create a new karaoke session
     */
    async createSession(song: KaraokeSong): Promise<KaraokeSession | null> {
        if (!this.roomId || !getFirebaseDatabase() || !this.userId) return null

        try {
            const sessionId = `karaoke-${Date.now()}`
            const session: KaraokeSession = {
                id: sessionId,
                roomId: this.roomId,
                song,
                status: "waiting",
                currentTime: 0,
                players: {
                    [this.userId]: {
                        id: this.userId,
                        name: this.userName,
                        role: "singer",
                        score: 0,
                        isSinging: true,
                        hasJoined: true,
                    },
                },
                hostId: this.userId,
                createdAt: Date.now(),
            }

            const sessionRef = ref(getFirebaseDatabase()!, `karaoke/${this.roomId}`)
            await set(sessionRef, session)

            this.state.isActive = true
            this.state.session = session
            this.notifyListeners()

            return session
        } catch (error) {
            console.error("Failed to create karaoke session:", error)
            return null
        }
    }

    /**
     * Join an existing session
     */
    async joinSession(playerId: string, playerName: string, role: KaraokeRole = "audience"): Promise<boolean> {
        if (!this.roomId || !getFirebaseDatabase()!) return false

        try {
            const sessionRef = ref(getFirebaseDatabase()!, `karaoke/${this.roomId}`)
            const snapshot = await get(sessionRef)
            const session = snapshot.val() as KaraokeSession | null

            if (!session) return false

            const players = {
                ...session.players,
                [playerId]: {
                    id: playerId,
                    name: playerName,
                    role,
                    score: 0,
                    isSinging: role === "singer",
                    hasJoined: true,
                },
            }

            await update(sessionRef, { players })
            return true
        } catch (error) {
            console.error("Failed to join karaoke session:", error)
            return false
        }
    }

    /**
     * Start the session
     */
    async startSession(): Promise<boolean> {
        if (!this.roomId || !getFirebaseDatabase()!) return false

        try {
            const sessionRef = ref(getFirebaseDatabase()!, `karaoke/${this.roomId}`)
            await update(sessionRef, { status: "playing", currentTime: 0 })

            this.state.isSinging = true
            this.state.session!.status = "playing"
            this.notifyListeners()

            // Start syncing time
            this.startTimeSync()
            return true
        } catch (error) {
            console.error("Failed to start karaoke session:", error)
            return false
        }
    }

    /**
     * Pause the session
     */
    async pauseSession(): Promise<boolean> {
        if (!this.roomId || !getFirebaseDatabase()!) return false

        try {
            const sessionRef = ref(getFirebaseDatabase()!, `karaoke/${this.roomId}`)
            await update(sessionRef, { status: "paused" })

            this.state.isSinging = false
            this.state.session!.status = "paused"
            this.notifyListeners()

            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId)
                this.animationFrameId = null
            }

            return true
        } catch (error) {
            console.error("Failed to pause karaoke session:", error)
            return false
        }
    }

    /**
     * Resume the session
     */
    async resumeSession(): Promise<boolean> {
        if (!this.roomId || !getFirebaseDatabase()!) return false

        try {
            const sessionRef = ref(getFirebaseDatabase()!, `karaoke/${this.roomId}`)
            await update(sessionRef, { status: "playing" })

            this.state.isSinging = true
            this.state.session!.status = "playing"
            this.notifyListeners()

            this.startTimeSync()
            return true
        } catch (error) {
            console.error("Failed to resume karaoke session:", error)
            return false
        }
    }

    /**
     * End the session
     */
    async endSession(): Promise<boolean> {
        if (!this.roomId || !getFirebaseDatabase()!) return false

        try {
            const sessionRef = ref(getFirebaseDatabase()!, `karaoke/${this.roomId}`)
            await remove(sessionRef)

            this.state.isActive = false
            this.state.session = null
            this.state.isSinging = false
            this.state.score = 0
            this.state.lyricsProgress = 0
            this.notifyListeners()

            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId)
                this.animationFrameId = null
            }

            return true
        } catch (error) {
            console.error("Failed to end karaoke session:", error)
            return false
        }
    }

    /**
     * Update player score
     */
    async updateScore(playerId: string, points: number): Promise<void> {
        if (!this.roomId || !getFirebaseDatabase() || !this.state.session) return

        try {
            const player = this.state.session.players[playerId]
            if (!player) return

            const newScore = (player.score || 0) + points
            const sessionRef = ref(getFirebaseDatabase()!, `karaoke/${this.roomId}/players/${playerId}`)
            await update(sessionRef, { score: newScore })

            // Update local state
            this.state.session.players[playerId].score = newScore
            if (playerId === this.userId) {
                this.state.score = newScore
            }
            this.notifyListeners()
        } catch (error) {
            console.error("Failed to update score:", error)
        }
    }

    /**
     * Start syncing time with Firebase
     */
    startTimeSync(): void {
        if (!this.roomId || !getFirebaseDatabase() || !this.state.isSinging) return

        const startTime = Date.now()
        const sessionStartOffset = this.state.session?.currentTime || 0

        const syncTime = () => {
            if (!this.state.isSinging || this.state.session?.status !== "playing") return

            const elapsed = Date.now() - startTime
            const currentTime = sessionStartOffset + elapsed

            this.state.currentTime = currentTime
            this.state.lyricsProgress = currentTime

            // Update Firebase
            if (getFirebaseDatabase()!) {
                const sessionRef = ref(getFirebaseDatabase()!, `karaoke/${this.roomId}`)
                update(sessionRef, { currentTime })
            }

            // Check for lyrics progress
            this.updateLyricsProgress(currentTime)

            // Continue syncing
            this.animationFrameId = requestAnimationFrame(syncTime)
        }

        syncTime()
    }

    /**
     * Update lyrics progress
     */
    private updateLyricsProgress(currentTime: number): void {
        if (!this.state.session?.song) return

        const currentLine = this.state.session.song.lyrics.find(
            (line) => currentTime >= line.startTime && currentTime < line.endTime
        )

        if (currentLine) {
            // Calculate progress percentage for current line
            const lineProgress = ((currentTime - currentLine.startTime) / (currentLine.endTime - currentLine.startTime)) * 100
            this.state.lyricsProgress = lineProgress
        }
    }

    /**
     * Get current lyrics to display
     */
    getCurrentLyrics(): { current: LyricLine | null; next: LyricLine | null; progress: number } {
        if (!this.state.session?.song) {
            return { current: null, next: null, progress: 0 }
        }

        const lyrics = this.state.session.song.lyrics
        const currentTime = this.state.currentTime

        const currentIndex = lyrics.findIndex(
            (line) => currentTime >= line.startTime && currentTime < line.endTime
        )

        if (currentIndex === -1) {
            // Find next upcoming line
            const nextIndex = lyrics.findIndex((line) => line.startTime > currentTime)
            return {
                current: null,
                next: nextIndex !== -1 ? lyrics[nextIndex] : null,
                progress: 0,
            }
        }

        const current = lyrics[currentIndex]
        const next = currentIndex + 1 < lyrics.length ? lyrics[currentIndex + 1] : null
        const progress = ((currentTime - current.startTime) / (current.endTime - current.startTime)) * 100

        return { current, next, progress }
    }

    /**
     * Get demo songs
     */
    getDemoSongs(): KaraokeSong[] {
        return DEMO_SONGS
    }

    /**
     * Get current state
     */
    getState(): KaraokeState {
        return { ...this.state }
    }

    /**
     * Subscribe to state changes
     */
    subscribe(listener: (state: KaraokeState) => void): () => void {
        this.listeners.push(listener)
        return () => {
            this.listeners = this.listeners.filter((l) => l !== listener)
        }
    }

    /**
     * Notify all listeners
     */
    private notifyListeners(): void {
        this.listeners.forEach((listener) => listener(this.getState()))
    }

    /**
     * Broadcast a karaoke invitation
     */
    async broadcastInvite(song: KaraokeSong): Promise<void> {
        if (!this.roomId || !this.userId || !getFirebaseDatabase()) return

        try {
            const inviteRef = ref(getFirebaseDatabase()!, `karaokeInvites/${this.roomId}`)
            const invite: KaraokeInvite = {
                id: `invite-${Date.now()}`,
                roomId: this.roomId,
                song,
                hostId: this.userId,
                hostName: this.userName,
                expiresAt: Date.now() + 60000, // 1 minute
            }
            await set(inviteRef, invite)
        } catch (error) {
            console.error("Failed to broadcast karaoke invite:", error)
        }
    }

    /**
     * Listen for karaoke invitations
     */
    listenForInvites(callback: (invite: KaraokeInvite | null) => void): () => void {
        if (!this.roomId || !getFirebaseDatabase()!) return () => { }

        const inviteRef = ref(getFirebaseDatabase()!, `karaokeInvites/${this.roomId}`)
        const unsubscribe = onValue(inviteRef, (snapshot) => {
            const invite = snapshot.val() as KaraokeInvite | null
            if (invite && invite.expiresAt > Date.now() && invite.hostId !== this.userId) {
                callback(invite)
            } else {
                callback(null)
            }
        })

        this.unsubscribers.push(unsubscribe)
        return unsubscribe
    }

    /**
     * Listen for session changes
     */
    listenForSession(): void {
        if (!this.roomId || !getFirebaseDatabase()!) return

        const sessionRef = ref(getFirebaseDatabase()!, `karaoke/${this.roomId}`)
        const unsubscribe = onValue(sessionRef, (snapshot) => {
            const session = snapshot.val() as KaraokeSession | null

            if (session) {
                this.state.isActive = true
                this.state.session = session
                this.state.isSinging = session.status === "playing"
            } else {
                this.state.isActive = false
                this.state.session = null
                this.state.isSinging = false
            }

            this.notifyListeners()
        })

        this.unsubscribers.push(unsubscribe)
    }

    /**
     * Clean up
     */
    destroy(): void {
        this.unsubscribers.forEach((unsub) => unsub())
        this.unsubscribers = []
        this.roomId = null
        this.userId = null

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId)
            this.animationFrameId = null
        }

        this.state = {
            isActive: false,
            session: null,
            currentPlayer: null,
            isSinging: false,
            score: 0,
            lyricsProgress: 0,
            currentTime: 0,
        }
    }
}

export const karaokeManager = KaraokeManager.getInstance()
