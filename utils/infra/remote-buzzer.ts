/**
 * Remote Buzzer Manager
 * 
 * Manages buzz-in functionality for trivia and Q&A sessions.
 */

import { getFirebaseDatabase } from "@/lib/firebase"
import { ref, set, get, update, onValue, remove } from "firebase/database"

export type BuzzerState = "ready" | "active" | "locked" | "reset"

export interface BuzzerSession {
    id: string
    roomId: string
    state: BuzzerState
    activePlayerId: string | null
    activePlayerName: string | null
    buzzTime: number | null
    buzzQueue: string[]
    hostId: string
    scoreboard: Record<string, { name: string; score: number; buzzCount: number }>
    createdAt: number
}

interface BuzzerStateInternal {
    isActive: boolean
    session: BuzzerSession | null
    canBuzz: boolean
    hasBuzzed: boolean
    isLocked: boolean
}

class RemoteBuzzerManager {
    private static instance: RemoteBuzzerManager
    private state: BuzzerStateInternal = {
        isActive: false,
        session: null,
        canBuzz: false,
        hasBuzzed: false,
        isLocked: false,
    }
    private listeners: ((state: BuzzerStateInternal) => void)[] = []
    private roomId: string | null = null
    private userId: string | null = null
    private userName: string = "Anonymous"
    private unsubscribers: (() => void)[] = []

    private constructor() { }

    static getInstance(): RemoteBuzzerManager {
        if (!RemoteBuzzerManager.instance) {
            RemoteBuzzerManager.instance = new RemoteBuzzerManager()
        }
        return RemoteBuzzerManager.instance
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
     * Create a new buzzer session
     */
    async createSession(): Promise<BuzzerSession | null> {
        if (!this.roomId || !getFirebaseDatabase() || !this.userId) return null

        try {
            const session: BuzzerSession = {
                id: `buzzer-${Date.now()}`,
                roomId: this.roomId,
                state: "ready",
                activePlayerId: null,
                activePlayerName: null,
                buzzTime: null,
                buzzQueue: [],
                hostId: this.userId,
                scoreboard: {
                    [this.userId]: { name: this.userName, score: 0, buzzCount: 0 },
                },
                createdAt: Date.now(),
            }

            const sessionRef = ref(getFirebaseDatabase()!, `buzzer/${this.roomId}`)
            await set(sessionRef, session)

            this.state.isActive = true
            this.state.session = session
            this.state.canBuzz = true
            this.notifyListeners()

            return session
        } catch (error) {
            console.error("Failed to create buzzer session:", error)
            return null
        }
    }

    /**
     * Join an existing session
     */
    async joinSession(): Promise<boolean> {
        if (!this.roomId || !getFirebaseDatabase() || !this.userId) return false

        try {
            const sessionRef = ref(getFirebaseDatabase()!, `buzzer/${this.roomId}`)
            const snapshot = await get(sessionRef)
            const session = snapshot.val() as BuzzerSession | null

            if (!session) return false

            // Add player to scoreboard if not exists
            const scoreboard = { ...session.scoreboard }
            if (!scoreboard[this.userId]) {
                scoreboard[this.userId] = { name: this.userName, score: 0, buzzCount: 0 }
                await update(sessionRef, { scoreboard })
            }

            this.state.isActive = true
            this.state.session = session
            this.state.canBuzz = session.state === "ready"
            this.notifyListeners()

            return true
        } catch (error) {
            console.error("Failed to join buzzer session:", error)
            return false
        }
    }

    /**
     * Buzz in
     */
    async buzz(): Promise<boolean> {
        if (!this.roomId || !getFirebaseDatabase() || !this.userId || !this.state.session) return false

        try {
            // Only allow buzz if ready and hasn't buzzed yet in current round
            if (this.state.session.state !== "ready" || this.state.hasBuzzed) return false

            const sessionRef = ref(getFirebaseDatabase()!, `buzzer/${this.roomId}`)
            const session = this.state.session

            // Set as active player
            await update(sessionRef, {
                state: "locked",
                activePlayerId: this.userId,
                activePlayerName: this.userName,
                buzzTime: Date.now(),
            })

            // Update scoreboard
            const scoreboard = { ...session.scoreboard }
            if (scoreboard[this.userId]) {
                scoreboard[this.userId].buzzCount++
            }

            this.state.hasBuzzed = true
            this.state.canBuzz = false
            this.state.isLocked = true
            this.notifyListeners()

            return true
        } catch (error) {
            console.error("Failed to buzz:", error)
            return false
        }
    }

    /**
     * Reset buzzer (host only)
     */
    async reset(): Promise<boolean> {
        if (!this.roomId || !getFirebaseDatabase() || !this.userId || !this.state.session) return false

        try {
            // Only host can reset
            if (this.state.session.hostId !== this.userId) {
                console.error("Only host can reset buzzer")
                return false
            }

            const sessionRef = ref(getFirebaseDatabase()!, `buzzer/${this.roomId}`)
            await update(sessionRef, {
                state: "ready",
                activePlayerId: null,
                activePlayerName: null,
                buzzTime: null,
            })

            this.state.session.state = "ready"
            this.state.canBuzz = true
            this.state.hasBuzzed = false
            this.state.isLocked = false
            this.notifyListeners()

            return true
        } catch (error) {
            console.error("Failed to reset buzzer:", error)
            return false
        }
    }

    /**
     * Give points to active player
     */
    async awardPoints(points: number): Promise<boolean> {
        if (!this.roomId || !getFirebaseDatabase() || !this.state.session) return false

        try {
            const session = this.state.session
            const activeId = session.activePlayerId

            if (!activeId) return false

            const sessionRef = ref(getFirebaseDatabase()!, `buzzer/${this.roomId}`)
            const scoreboard = { ...session.scoreboard }

            if (scoreboard[activeId]) {
                scoreboard[activeId].score += points
            }

            await update(sessionRef, { scoreboard })

            this.state.session.scoreboard = scoreboard
            this.notifyListeners()

            return true
        } catch (error) {
            console.error("Failed to award points:", error)
            return false
        }
    }

    /**
     * End session
     */
    async endSession(): Promise<void> {
        if (!this.roomId || !getFirebaseDatabase()!) return

        try {
            const sessionRef = ref(getFirebaseDatabase()!, `buzzer/${this.roomId}`)
            await remove(sessionRef)

            this.state = {
                isActive: false,
                session: null,
                canBuzz: false,
                hasBuzzed: false,
                isLocked: false,
            }
            this.notifyListeners()
        } catch (error) {
            console.error("Failed to end buzzer session:", error)
        }
    }

    /**
     * Get scoreboard sorted by score
     */
    getScoreboard(): { id: string; name: string; score: number; buzzCount: number }[] {
        if (!this.state.session?.scoreboard) return []

        return Object.entries(this.state.session.scoreboard)
            .map(([id, data]) => ({ id, ...data }))
            .sort((a, b) => b.score - a.score)
    }

    /**
     * Get current state
     */
    getState(): BuzzerStateInternal {
        return { ...this.state }
    }

    /**
     * Subscribe to state changes
     */
    subscribe(listener: (state: BuzzerStateInternal) => void): () => void {
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
     * Listen for session changes
     */
    listenForSession(): void {
        if (!this.roomId || !getFirebaseDatabase()!) return

        const sessionRef = ref(getFirebaseDatabase()!, `buzzer/${this.roomId}`)
        const unsubscribe = onValue(sessionRef, (snapshot) => {
            const session = snapshot.val() as BuzzerSession | null

            if (session) {
                this.state.isActive = true
                this.state.session = session

                // Update canBuzz based on state
                if (session.state === "ready") {
                    this.state.canBuzz = true
                    this.state.hasBuzzed = false
                    this.state.isLocked = false
                } else if (session.state === "locked" && session.activePlayerId === this.userId) {
                    this.state.canBuzz = false
                    this.state.hasBuzzed = true
                    this.state.isLocked = true
                }
            } else {
                this.state.isActive = false
                this.state.session = null
                this.state.canBuzz = false
                this.state.hasBuzzed = false
                this.state.isLocked = false
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

        this.state = {
            isActive: false,
            session: null,
            canBuzz: false,
            hasBuzzed: false,
            isLocked: false,
        }
    }
}

export const remoteBuzzerManager = RemoteBuzzerManager.getInstance()
export type { BuzzerStateInternal }
