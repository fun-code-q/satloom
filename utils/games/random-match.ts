/**
 * SatLoom Random Match Manager
 * 
 * Handles random stranger connections (Omegle-style)
 */

import { getFirebaseDatabase } from "@/lib/firebase"
import { ref, set, get, update, onValue, remove } from "firebase/database"

export interface RandomMatchConfig {
    interests?: string[]
    language?: string
    minAge?: number
    maxAge?: number
}

export interface RandomMatchSession {
    sessionId: string
    userId: string
    userName: string
    partnerId: string | null
    partnerName: string | null
    status: "searching" | "connected" | "ended"
    interests: string[]
    language: string
    startTime: number
    connectedTime: number | null
}

export interface RandomMatchState {
    isSearching: boolean
    session: RandomMatchSession | null
    averageWaitTime: number
}

class RandomMatchManager {
    private static instance: RandomMatchManager
    private state: RandomMatchState = {
        isSearching: false,
        session: null,
        averageWaitTime: 0,
    }
    private listeners: ((state: RandomMatchState) => void)[] = []
    private sessionUnsubscribe: (() => void) | null = null
    private poolUnsubscribe: (() => void) | null = null
    private userId: string = ""
    private userName: string = "Anonymous"

    private constructor() { }

    static getInstance(): RandomMatchManager {
        if (!RandomMatchManager.instance) {
            RandomMatchManager.instance = new RandomMatchManager()
        }
        return RandomMatchManager.instance
    }

    initialize(userId: string, userName: string): void {
        this.userId = userId
        this.userName = userName
    }

    subscribe(listener: (state: RandomMatchState) => void): () => void {
        this.listeners.push(listener)
        listener(this.state)

        return () => {
            this.listeners = this.listeners.filter(l => l !== listener)
        }
    }

    private notify(): void {
        this.listeners.forEach(listener => listener(this.state))
    }

    async startSearching(config: RandomMatchConfig = {}): Promise<void> {
        if (this.state.isSearching) {
            console.log("Already searching for a match")
            return
        }

        const sessionId = `random_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const session: RandomMatchSession = {
            sessionId,
            userId: this.userId,
            userName: this.userName,
            partnerId: null,
            partnerName: null,
            status: "searching",
            interests: config.interests || [],
            language: config.language || "en",
            startTime: Date.now(),
            connectedTime: null,
        }

        // Add to waiting pool
        await set(ref(getFirebaseDatabase()!, `randomMatchPool/${this.userId}`), {
            sessionId,
            userId: this.userId,
            userName: this.userName,
            interests: session.interests,
            language: session.language,
            timestamp: Date.now(),
        })

        this.state.isSearching = true
        this.state.session = session
        this.notify()

        // Listen for pool changes
        this.listenForPool()

        // Check if there's already someone waiting
        this.findMatch()
    }

    private async findMatch(): Promise<void> {
        if (!this.state.session) return

        try {
            const poolSnapshot = await get(ref(getFirebaseDatabase()!, "randomMatchPool"))
            const pool = poolSnapshot.val()

            if (pool && Object.keys(pool).length > 0) {
                // Filter out self
                const otherUsers = Object.entries(pool).filter(
                    ([id, data]: [string, any]) => id !== this.userId
                )

                if (otherUsers.length > 0) {
                    // Pick random user from pool
                    const randomIndex = Math.floor(Math.random() * otherUsers.length)
                    const [partnerId, partnerData] = otherUsers[randomIndex]

                    await this.connectWithPartner(partnerId, partnerData)
                }
            }
        } catch (error) {
            console.error("Error finding match:", error)
        }
    }

    private listenForPool(): void {
        this.poolUnsubscribe = onValue(ref(getFirebaseDatabase()!, "randomMatchPool"), () => {
            if (this.state.isSearching && !this.state.session?.partnerId) {
                this.findMatch()
            }
        })
    }

    private async connectWithPartner(partnerId: string, partnerData: any): Promise<void> {
        if (!this.state.session) return

        try {
            const partnerSessionId = partnerData.sessionId

            // Create connection record
            const connectionId = `${this.state.session.sessionId}_${partnerSessionId}`
            await set(ref(getFirebaseDatabase()!, `randomMatchConnections/${connectionId}`), {
                userId: this.userId,
                userName: this.userName,
                partnerId,
                partnerName: partnerData.userName,
                createdAt: Date.now(),
            })

            // Update both sessions
            await update(ref(getFirebaseDatabase()!, `randomMatchSessions/${this.state.session.sessionId}`), {
                partnerId,
                partnerName: partnerData.userName,
                status: "connected",
                connectedTime: Date.now(),
            })

            await update(ref(getFirebaseDatabase()!, `randomMatchSessions/${partnerSessionId}`), {
                partnerId: this.userId,
                partnerName: this.userName,
                status: "connected",
                connectedTime: Date.now(),
            })

            // Remove from pool
            await remove(ref(getFirebaseDatabase()!, `randomMatchPool/${this.userId}`))
            await remove(ref(getFirebaseDatabase()!, `randomMatchPool/${partnerId}`))

            // Update local state
            this.state.session.partnerId = partnerId
            this.state.session.partnerName = partnerData.userName
            this.state.session.status = "connected"
            this.state.session.connectedTime = Date.now()
            this.notify()

            // Listen for session updates
            this.listenForSession()

            console.log(`Connected with ${partnerData.userName}`)
        } catch (error) {
            console.error("Error connecting with partner:", error)
        }
    }

    private listenForSession(): void {
        if (!this.state.session) return

        this.sessionUnsubscribe = onValue(
            ref(getFirebaseDatabase()!, `randomMatchSessions/${this.state.session.sessionId}`),
            (snapshot) => {
                const data = snapshot.val()
                if (data && this.state.session) {
                    if (data.status === "ended") {
                        this.handleMatchEnded()
                    } else {
                        this.state.session.status = data.status
                        this.notify()
                    }
                }
            }
        )
    }

    async endSearch(): Promise<void> {
        if (!this.state.isSearching || !this.state.session) return

        // Clean up
        if (this.sessionUnsubscribe) {
            this.sessionUnsubscribe()
            this.sessionUnsubscribe = null
        }
        if (this.poolUnsubscribe) {
            this.poolUnsubscribe()
            this.poolUnsubscribe = null
        }

        // Remove from pool if still searching
        await remove(ref(getFirebaseDatabase()!, `randomMatchPool/${this.userId}`))

        // Update session status
        if (this.state.session.status === "searching") {
            await update(ref(getFirebaseDatabase()!, `randomMatchSessions/${this.state.session.sessionId}`), {
                status: "ended",
            })
        }

        this.state.isSearching = false
        this.state.session = null
        this.notify()
    }

    async endMatch(): Promise<void> {
        if (!this.state.session || this.state.session.status !== "connected") return

        try {
            // Update session status
            await update(ref(getFirebaseDatabase()!, `randomMatchSessions/${this.state.session.sessionId}`), {
                status: "ended",
            })

            // End match
            this.handleMatchEnded()
        } catch (error) {
            console.error("Error ending match:", error)
        }
    }

    private async handleMatchEnded(): Promise<void> {
        if (this.sessionUnsubscribe) {
            this.sessionUnsubscribe()
            this.sessionUnsubscribe = null
        }

        this.state.isSearching = false
        this.state.session = null
        this.notify()
    }

    getState(): RandomMatchState {
        return this.state
    }

    isSearching(): boolean {
        return this.state.isSearching
    }

    getSession(): RandomMatchSession | null {
        return this.state.session
    }

    destroy(): void {
        if (this.sessionUnsubscribe) {
            this.sessionUnsubscribe()
        }
        if (this.poolUnsubscribe) {
            this.poolUnsubscribe()
        }
        this.listeners = []
        this.state = {
            isSearching: false,
            session: null,
            averageWaitTime: 0,
        }
    }
}

export const randomMatchManager = RandomMatchManager.getInstance()
