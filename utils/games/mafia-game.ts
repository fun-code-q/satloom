/**
 * Mafia/Werewolf Game Manager
 * 
 * Manages multiplayer social deduction game sessions.
 */

import { getFirebaseDatabase } from "@/lib/firebase"
import { ref, set, get, update, onValue, remove } from "firebase/database"

export type MafiaRole =
    | "mafia"
    | "detective"
    | "doctor"
    | "villager"
    | "werewolf"
    | "minion"
    | "cupid"
    | "hunter"
    | "witch"
    | "elder"
    | "little-girl"

export type MafiaPhase =
    | "lobby"
    | "night"
    | "day"
    | "voting"
    | "lynching"
    | "gameover"

export interface MafiaPlayer {
    id: string
    name: string
    role: MafiaRole
    isAlive: boolean
    hasVoted: boolean
    voteTarget: string | null
    specialActionsUsed: Record<string, boolean>
    isProtected: boolean
    isLinked: boolean
}

export interface MafiaSession {
    id: string
    roomId: string
    phase: MafiaPhase
    dayNumber: number
    players: Record<string, MafiaPlayer>
    hostId: string
    minPlayers: number
    maxPlayers: number
    roles: MafiaRole[]
    aliveCount: number
    mafiaCount: number
    createdAt: number
    nightActionsPending: string[]
    currentSpeaker: string | null
    lastLynched: MafiaPlayer | null
    latestEvent: string | null
    gameLog: string[]
}

export interface NightAction {
    playerId: string
    action: "kill" | "protect" | "investigate" | "link"
    targetId?: string
}

// Default role distribution based on player count
const ROLE_DISTRIBUTIONS: Record<number, MafiaRole[]> = {
    5: ["mafia", "mafia", "detective", "doctor", "villager"],
    6: ["mafia", "mafia", "detective", "doctor", "villager", "villager"],
    7: ["mafia", "mafia", "mafia", "detective", "doctor", "villager", "villager"],
    8: ["mafia", "mafia", "mafia", "detective", "doctor", "witch", "villager", "villager"],
    9: ["mafia", "mafia", "mafia", "detective", "doctor", "witch", "hunter", "villager", "villager"],
    10: ["mafia", "mafia", "mafia", "detective", "doctor", "witch", "hunter", "cupid", "villager", "villager"],
}

interface MafiaState {
    isActive: boolean
    session: MafiaSession | null
    myRole: MafiaRole | null
    isMyTurn: boolean
    canAct: boolean
}

class MafiaManager {
    private static instance: MafiaManager
    private state: MafiaState = {
        isActive: false,
        session: null,
        myRole: null,
        isMyTurn: false,
        canAct: false,
    }
    private listeners: ((state: MafiaState) => void)[] = []
    private roomId: string | null = null
    private userId: string | null = null
    private userName: string = "Anonymous"
    private unsubscribers: (() => void)[] = []

    private constructor() { }

    static getInstance(): MafiaManager {
        if (!MafiaManager.instance) {
            MafiaManager.instance = new MafiaManager()
        }
        return MafiaManager.instance
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
     * Create a new game session
     */
    async createSession(minPlayers: number = 5, maxPlayers: number = 10): Promise<MafiaSession | null> {
        if (!this.roomId || !getFirebaseDatabase() || !this.userId) return null

        try {
            const sessionId = `mafia-${Date.now()}`

            const session: MafiaSession = {
                id: sessionId,
                roomId: this.roomId,
                phase: "lobby",
                dayNumber: 0,
                players: {
                    [this.userId]: {
                        id: this.userId,
                        name: this.userName,
                        role: "villager",
                        isAlive: true,
                        hasVoted: false,
                        voteTarget: null,
                        specialActionsUsed: {},
                        isProtected: false,
                        isLinked: false,
                    },
                },
                hostId: this.userId,
                minPlayers,
                maxPlayers,
                roles: [],
                aliveCount: 1,
                mafiaCount: 0,
                createdAt: Date.now(),
                nightActionsPending: [],
                currentSpeaker: null,
                lastLynched: null,
                latestEvent: "Waiting for players to join...",
                gameLog: [],
            }

            const sessionRef = ref(getFirebaseDatabase()!, `mafia/${this.roomId}`)
            await set(sessionRef, session)

            this.state.isActive = true
            this.state.session = session
            this.notifyListeners()

            return session
        } catch (error) {
            console.error("Failed to create mafia session:", error)
            return null
        }
    }

    /**
     * Join an existing session
     */
    async joinSession(): Promise<boolean> {
        if (!this.roomId || !getFirebaseDatabase() || !this.userId) return false

        try {
            const sessionRef = ref(getFirebaseDatabase()!, `mafia/${this.roomId}`)
            const snapshot = await get(sessionRef)
            const session = snapshot.val() as MafiaSession | null

            if (!session || session.phase !== "lobby") return false
            if (Object.keys(session.players).length >= session.maxPlayers) return false

            const players = {
                ...session.players,
                [this.userId]: {
                    id: this.userId,
                    name: this.userName,
                    role: "villager",
                    isAlive: true,
                    hasVoted: false,
                    voteTarget: null,
                    specialActionsUsed: {},
                    isProtected: false,
                    isLinked: false,
                },
            }

            await update(sessionRef, {
                players,
                aliveCount: Object.keys(players).length,
            })

            return true
        } catch (error) {
            console.error("Failed to join mafia session:", error)
            return false
        }
    }

    /**
     * Leave the session
     */
    async leaveSession(): Promise<void> {
        if (!this.roomId || !getFirebaseDatabase() || !this.userId) return

        try {
            const sessionRef = ref(getFirebaseDatabase()!, `mafia/${this.roomId}`)
            const snapshot = await get(sessionRef)
            const session = snapshot.val() as MafiaSession | null

            if (!session) return

            const players = { ...session.players }
            delete players[this.userId]

            if (Object.keys(players).length === 0) {
                await remove(sessionRef)
                this.state.isActive = false
                this.state.session = null
            } else {
                await update(sessionRef, {
                    players,
                    aliveCount: Object.keys(players).filter(id => players[id]?.isAlive).length,
                    hostId: session.hostId === this.userId ? Object.keys(players)[0] : session.hostId,
                })
            }

            this.notifyListeners()
        } catch (error) {
            console.error("Failed to leave mafia session:", error)
        }
    }

    /**
     * Start the game
     */
    async startGame(): Promise<boolean> {
        if (!this.roomId || !getFirebaseDatabase() || !this.state.session) return false

        try {
            const session = this.state.session
            const playerCount = Object.keys(session.players).length

            if (playerCount < session.minPlayers) {
                console.error("Not enough players to start")
                return false
            }

            const availableRoles = ROLE_DISTRIBUTIONS[playerCount] || ROLE_DISTRIBUTIONS[5]
            const shuffledRoles = [...availableRoles].sort(() => Math.random() - 0.5)

            const players = { ...session.players }
            const playerIds = Object.keys(players)

            playerIds.forEach((id, index) => {
                players[id] = {
                    ...players[id],
                    role: shuffledRoles[index] || "villager",
                }
            })

            const mafiaCount = playerIds.filter(id =>
                ["mafia", "werewolf", "minion"].includes(players[id]?.role || "")
            ).length

            const sessionRef = ref(getFirebaseDatabase()!, `mafia/${this.roomId}`)
            await update(sessionRef, {
                players,
                roles: shuffledRoles,
                phase: "night",
                dayNumber: 1,
                mafiaCount,
                aliveCount: playerCount,
                latestEvent: "Night falls... The town sleeps. Mafia, wake up!",
                gameLog: ["Game started with " + playerCount + " players"],
            })

            this.state.session.phase = "night"
            this.state.session.players = players
            this.state.myRole = players[this.userId!]?.role || null
            this.notifyListeners()

            return true
        } catch (error) {
            console.error("Failed to start game:", error)
            return false
        }
    }

    /**
     * Submit a night action
     */
    async submitNightAction(action: NightAction): Promise<void> {
        if (!this.roomId || !getFirebaseDatabase() || !this.userId) return

        try {
            const actionRef = ref(getFirebaseDatabase()!, `mafia/${this.roomId}/nightActions/${this.userId}`)
            await set(actionRef, action)
        } catch (error) {
            console.error("Failed to submit night action:", error)
        }
    }

    /**
     * Vote to lynch a player
     */
    async submitVote(targetId: string): Promise<void> {
        if (!this.roomId || !getFirebaseDatabase() || !this.userId || !this.state.session) return

        try {
            const sessionRef = ref(getFirebaseDatabase()!, `mafia/${this.roomId}`)
            const session = this.state.session

            const players = { ...session.players }
            players[this.userId] = {
                ...players[this.userId],
                hasVoted: true,
                voteTarget: targetId,
            }

            await update(sessionRef, { players })

            const alivePlayers = Object.values(players).filter(p => p.isAlive)
            const votedPlayers = alivePlayers.filter(p => p.hasVoted)

            if (votedPlayers.length === alivePlayers.length) {
                await this.processLynch(players)
            }

            this.state.session.players = players
            this.notifyListeners()
        } catch (error) {
            console.error("Failed to submit vote:", error)
        }
    }

    /**
     * Process the lynching results
     */
    private async processLynch(players: Record<string, MafiaPlayer>): Promise<void> {
        const voteCounts: Record<string, number> = {}

        Object.values(players).forEach(player => {
            if (player.isAlive && player.voteTarget) {
                voteCounts[player.voteTarget] = (voteCounts[player.voteTarget] || 0) + 1
            }
        })

        let maxVotes = 0
        let lynchedPlayerId: string | null = null

        Object.entries(voteCounts).forEach(([playerId, votes]) => {
            if (votes > maxVotes) {
                maxVotes = votes
                lynchedPlayerId = playerId
            }
        })

        const tiedPlayers = Object.entries(voteCounts).filter(([_, votes]) => votes === maxVotes)
        if (tiedPlayers.length > 1) {
            const db = getFirebaseDatabase()
            if (db) {
                const sessionRef = ref(db, `mafia/${this.roomId}`)
                await update(sessionRef, {
                    players: Object.values(players).map(p => ({ ...p, hasVoted: false, voteTarget: null })),
                    latestEvent: "Tie vote! No one was lynched.",
                    phase: "night",
                })
            }
            return
        }

        if (lynchedPlayerId && players[lynchedPlayerId]) {
            const lynched = players[lynchedPlayerId]
            lynched.isAlive = false

            const aliveCount = Object.values(players).filter(p => p.isAlive).length

            const db = getFirebaseDatabase()
            if (db) {
                const sessionRef = ref(db, `mafia/${this.roomId}`)
                await update(sessionRef, {
                    players,
                    lastLynched: lynched,
                    aliveCount,
                    latestEvent: `${lynched.name} (${lynched.role}) was lynched!`,
                    phase: "night",
                    gameLog: [...(this.state.session?.gameLog || []), `Day ${this.state.session?.dayNumber}: ${lynched.name} was lynched`],
                })
            }

            await this.checkWinCondition(players, aliveCount)
        }
    }

    /**
     * Process night actions
     */
    async processNightActions(): Promise<void> {
        if (!this.roomId || !getFirebaseDatabase() || !this.state.session) return

        try {
            const snapshot = await get(ref(getFirebaseDatabase()!, `mafia/${this.roomId}/nightActions`))
            const actions = snapshot.val() || {}

            const players = { ...this.state.session.players }

            const killActions = Object.values(actions).filter((a: any) => a.action === "kill") as NightAction[]
            let killTarget = killActions[0]?.targetId

            if (killTarget && players[killTarget]?.isAlive) {
                const protectActions = Object.values(actions).filter((a: any) =>
                    a.action === "protect" && a.targetId === killTarget
                ) as NightAction[]

                if (protectActions.length === 0) {
                    players[killTarget].isAlive = false
                }
            }

            const aliveCount = Object.values(players).filter(p => p.isAlive).length

            await remove(ref(getFirebaseDatabase()!, `mafia/${this.roomId}/nightActions`))

            const db = getFirebaseDatabase()
            if (db) {
                const sessionRef = ref(db, `mafia/${this.roomId}`)
                await update(sessionRef, {
                    players,
                    phase: "day",
                    aliveCount,
                    latestEvent: "The sun rises... Discuss who the mafia might be!",
                    gameLog: [...this.state.session.gameLog, `Night ${this.state.session.dayNumber} ended`],
                })
            }

            this.state.session.players = players
            this.state.session.phase = "day"
            this.state.session.dayNumber++

            Object.values(players).forEach(p => {
                p.hasVoted = false
                p.voteTarget = null
            })

            await this.checkWinCondition(players, aliveCount)
            this.notifyListeners()
        } catch (error) {
            console.error("Failed to process night actions:", error)
        }
    }

    /**
     * Check win conditions
     */
    private async checkWinCondition(players: Record<string, MafiaPlayer>, aliveCount: number): Promise<void> {
        const alivePlayers = Object.values(players).filter(p => p.isAlive)
        const mafiaAlive = alivePlayers.filter(p =>
            ["mafia", "werewolf", "minion"].includes(p.role)
        ).length
        const villagerAlive = alivePlayers.filter(p =>
            ["villager", "detective", "doctor", "hunter", "witch", "elder", "cupid", "little-girl"].includes(p.role)
        ).length

        let winner: "mafia" | "villagers" | null = null
        let gameOverMessage = ""

        if (mafiaAlive === 0) {
            winner = "villagers"
            gameOverMessage = "The town has won! The mafia has been eliminated."
        } else if (mafiaAlive >= villagerAlive) {
            winner = "mafia"
            gameOverMessage = "The mafia has won! The town has fallen."
        }

        if (winner) {
            const db = getFirebaseDatabase()
            if (db) {
                const sessionRef = ref(db, `mafia/${this.roomId}`)
                await update(sessionRef, {
                    phase: "gameover",
                    latestEvent: gameOverMessage,
                    gameLog: [...this.state.session?.gameLog || [], gameOverMessage],
                })
            }

            this.state.session!.phase = "gameover"
            this.notifyListeners()
        }
    }

    /**
     * Get my role info
     */
    getMyRoleInfo(): { role: MafiaRole | null; isAlive: boolean; canAct: boolean } | null {
        const uid = this.userId
        if (!uid || !this.state.session?.players[uid]) return null

        const player = this.state.session.players[uid]
        return {
            role: player.role,
            isAlive: player.isAlive,
            canAct: this.canPlayerAct(player.role),
        }
    }

    /**
     * Check if a role can act
     */
    private canPlayerAct(role: MafiaRole): boolean {
        if (this.state.session?.phase !== "night") return false
        const uid = this.userId
        if (!uid || !this.state.session?.players[uid]?.isAlive) return false

        const nightActionRoles: MafiaRole[] = ["mafia", "detective", "doctor", "werewolf", "witch", "cupid"]
        return nightActionRoles.includes(role)
    }

    /**
     * Get current state
     */
    getState(): MafiaState {
        return { ...this.state }
    }

    /**
     * Subscribe to state changes
     */
    subscribe(listener: (state: MafiaState) => void): () => void {
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

        const sessionRef = ref(getFirebaseDatabase()!, `mafia/${this.roomId}`)
        const unsubscribe = onValue(sessionRef, (snapshot) => {
            const session = snapshot.val() as MafiaSession | null
            const uid = this.userId

            if (session) {
                this.state.isActive = true
                this.state.session = session
                this.state.myRole = uid ? session.players[uid]?.role || null : null

                const player = uid ? session.players[uid] : undefined
                this.state.canAct = !!player?.isAlive && this.canPlayerAct(player.role)
            } else {
                this.state.isActive = false
                this.state.session = null
                this.state.myRole = null
                this.state.canAct = false
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
            myRole: null,
            isMyTurn: false,
            canAct: false,
        }
    }
}

export const mafiaManager = MafiaManager.getInstance()
export type { MafiaState }
