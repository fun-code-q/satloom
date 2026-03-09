import { getFirebaseDatabase } from "@/lib/firebase"
import { ref, set, remove, get, onValue, update } from "firebase/database"

export type TournamentStatus = "registration" | "in_progress" | "finished"
export type MatchStatus = "pending" | "active" | "completed"

export interface TournamentPlayer {
    id: string
    name: string
    avatar?: string
    joinedAt: number
    score: number
    seed?: number
}

export interface TournamentMatch {
    id: string
    tournamentId: string
    round: number
    position: number
    player1Id: string | null
    player2Id: string | null
    winnerId: string | null
    score1: number
    score2: number
    status: MatchStatus
    nextMatchId?: string
}

export interface Tournament {
    id: string
    name: string
    gameType: string // "dots-and-boxes", "quiz", etc.
    createdBy: string
    createdAt: number
    status: TournamentStatus
    maxParticipants: number
    participants: TournamentPlayer[]
    rounds: number
    matches: TournamentMatch[]
    prizes?: string[]
    rules?: string
}

export interface TournamentInvite {
    id: string
    tournamentId: string
    tournamentName: string
    fromUserId: string
    fromUserName: string
    toUserId: string
    timestamp: number
    status: "pending" | "accepted" | "declined"
}

export class TournamentManager {
    private static instance: TournamentManager
    private listeners: Array<() => void> = []

    static getInstance(): TournamentManager {
        if (!TournamentManager.instance) {
            TournamentManager.instance = new TournamentManager()
        }
        return TournamentManager.instance
    }

    // Create a tournament
    async createTournament(
        roomId: string,
        name: string,
        gameType: string,
        creatorId: string,
        creatorName: string,
        maxParticipants: number = 16,
        rounds?: number,
        prizes?: string[],
        rules?: string
    ): Promise<Tournament | null> {
        if (!getFirebaseDatabase()!) return null

        try {
            const tournamentId = `tournament_${Date.now()}`

            const tournament: Tournament = {
                id: tournamentId,
                name,
                gameType,
                createdBy: creatorId,
                createdAt: Date.now(),
                status: "registration",
                maxParticipants,
                participants: [
                    {
                        id: creatorId,
                        name: creatorName,
                        joinedAt: Date.now(),
                        score: 0,
                    },
                ],
                rounds: rounds || Math.ceil(Math.log2(maxParticipants)),
                matches: [],
                prizes,
                rules,
            }

            await set(ref(getFirebaseDatabase()!, `rooms/${roomId}/tournaments/${tournamentId}`), tournament)
            return tournament
        } catch (error) {
            console.error("Failed to create tournament:", error)
            return null
        }
    }

    // Join tournament
    async joinTournament(
        roomId: string,
        tournamentId: string,
        playerId: string,
        playerName: string,
        avatar?: string
    ): Promise<{ success: boolean; error?: string }> {
        if (!getFirebaseDatabase()!) return { success: false, error: "Database not available" }

        try {
            const tournamentRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/tournaments/${tournamentId}`)
            const snapshot = await get(tournamentRef)

            if (!snapshot.exists()) {
                return { success: false, error: "Tournament not found" }
            }

            const tournament = snapshot.val() as Tournament

            if (tournament.status !== "registration") {
                return { success: false, error: "Registration is closed" }
            }

            if (tournament.participants.length >= tournament.maxParticipants) {
                return { success: false, error: "Tournament is full" }
            }

            const existingParticipant = tournament.participants.find((p) => p.id === playerId)
            if (existingParticipant) {
                return { success: false, error: "Already registered" }
            }

            // Add participant
            const updatedParticipants = [
                ...tournament.participants,
                {
                    id: playerId,
                    name: playerName,
                    avatar,
                    joinedAt: Date.now(),
                    score: 0,
                },
            ]

            await update(tournamentRef, { participants: updatedParticipants })

            return { success: true }
        } catch (error) {
            console.error("Failed to join tournament:", error)
            return { success: false, error: "Failed to join" }
        }
    }

    // Leave tournament
    async leaveTournament(
        roomId: string,
        tournamentId: string,
        playerId: string
    ): Promise<boolean> {
        if (!getFirebaseDatabase()!) return false

        try {
            const tournamentRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/tournaments/${tournamentId}`)
            const snapshot = await get(tournamentRef)

            if (!snapshot.exists()) {
                return false
            }

            const tournament = snapshot.val() as Tournament

            if (tournament.status !== "registration") {
                return false
            }

            const updatedParticipants = tournament.participants.filter((p) => p.id !== playerId)
            await update(tournamentRef, { participants: updatedParticipants })

            return true
        } catch (error) {
            console.error("Failed to leave tournament:", error)
            return false
        }
    }

    // Start tournament (generate brackets)
    async startTournament(roomId: string, tournamentId: string): Promise<{ success: boolean; error?: string }> {
        if (!getFirebaseDatabase()!) return { success: false, error: "Database not available" }

        try {
            const tournamentRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/tournaments/${tournamentId}`)
            const snapshot = await get(tournamentRef)

            if (!snapshot.exists()) {
                return { success: false, error: "Tournament not found" }
            }

            const tournament = snapshot.val() as Tournament

            if (tournament.participants.length < 2) {
                return { success: false, error: "Need at least 2 participants" }
            }

            // Generate bracket
            const matches = this.generateBracket(tournament)

            await update(tournamentRef, {
                status: "in_progress",
                matches,
                participants: tournament.participants.map((p, i) => ({ ...p, seed: i + 1 })),
            })

            return { success: true }
        } catch (error) {
            console.error("Failed to start tournament:", error)
            return { success: false, error: "Failed to start" }
        }
    }

    // Generate tournament bracket
    private generateBracket(tournament: Tournament): TournamentMatch[] {
        const matches: TournamentMatch[] = []
        const participants = [...tournament.participants]
        const numRounds = Math.ceil(Math.log2(participants.length))

        // Shuffle participants for randomness (seeds will be assigned)
        for (let i = participants.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
                ;[participants[i], participants[j]] = [participants[j], participants[i]]
        }

        // Generate matches for each round
        for (let round = 1; round <= numRounds; round++) {
            const matchesInRound = Math.ceil(participants.length / Math.pow(2, round))

            for (let position = 1; position <= matchesInRound; position++) {
                const matchId = `${tournament.id}_r${round}_m${position}`
                const matchIndex = matches.length
                const nextMatchPosition = Math.ceil(position / 2)
                const nextMatchRound = round + 1
                const nextMatchId =
                    nextMatchRound <= numRounds
                        ? `${tournament.id}_r${nextMatchRound}_m${nextMatchPosition}`
                        : undefined

                matches.push({
                    id: matchId,
                    tournamentId: tournament.id,
                    round,
                    position,
                    player1Id: null,
                    player2Id: null,
                    winnerId: null,
                    score1: 0,
                    score2: 0,
                    status: "pending",
                    nextMatchId,
                })
            }
        }

        // Assign first round players
        const firstRoundMatches = matches.filter((m) => m.round === 1)
        firstRoundMatches.forEach((match, index) => {
            if (participants[index * 2]) {
                match.player1Id = participants[index * 2].id
            }
            if (participants[index * 2 + 1]) {
                match.player2Id = participants[index * 2 + 1].id
            }
            if (match.player1Id || match.player2Id) {
                match.status = "active"
            }
        })

        return matches
    }

    // Update match result
    async updateMatchResult(
        roomId: string,
        tournamentId: string,
        matchId: string,
        winnerId: string,
        score1: number,
        score2: number
    ): Promise<boolean> {
        if (!getFirebaseDatabase()!) return false

        try {
            const tournamentRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/tournaments/${tournamentId}`)
            const snapshot = await get(tournamentRef)

            if (!snapshot.exists()) {
                return false
            }

            const tournament = snapshot.val() as Tournament
            const match = tournament.matches.find((m) => m.id === matchId)

            if (!match) {
                return false
            }

            // Update match
            match.winnerId = winnerId
            match.score1 = score1
            match.score2 = score2
            match.status = "completed"

            // Update participant scores
            const p1 = tournament.participants.find((p) => p.id === match.player1Id)
            const p2 = tournament.participants.find((p) => p.id === match.player2Id)

            if (p1) p1.score += score1
            if (p2) p2.score += score2

            // Advance winner to next round
            if (match.nextMatchId) {
                const nextMatch = tournament.matches.find((m) => m.id === match.nextMatchId)
                if (nextMatch) {
                    const isPlayer1InNext = match.position % 2 === 1
                    if (isPlayer1InNext) {
                        nextMatch.player1Id = winnerId
                    } else {
                        nextMatch.player2Id = winnerId
                    }
                    if (nextMatch.player1Id && nextMatch.player2Id) {
                        nextMatch.status = "active"
                    }
                }
            } else {
                // Tournament finished - determine final ranking
                tournament.status = "finished"
            }

            await set(tournamentRef, tournament)
            return true
        } catch (error) {
            console.error("Failed to update match:", error)
            return false
        }
    }

    // Get tournament leaderboard
    getLeaderboard(tournament: Tournament): TournamentPlayer[] {
        return [...tournament.participants].sort((a, b) => {
            // First by wins/score, then by seed
            return b.score - a.score || (a.seed || 999) - (b.seed || 999)
        })
    }

    // Send tournament invite
    async sendInvite(
        roomId: string,
        tournamentId: string,
        tournamentName: string,
        fromUserId: string,
        fromUserName: string,
        toUserId: string
    ): Promise<boolean> {
        if (!getFirebaseDatabase()!) return false

        try {
            const invite: TournamentInvite = {
                id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                tournamentId,
                tournamentName,
                fromUserId,
                fromUserName,
                toUserId,
                timestamp: Date.now(),
                status: "pending",
            }

            await set(ref(getFirebaseDatabase()!, `rooms/${roomId}/tournamentInvites/${invite.id}`), invite)
            return true
        } catch (error) {
            console.error("Failed to send invite:", error)
            return false
        }
    }

    // Get pending invites for user
    async getPendingInvites(roomId: string, userId: string): Promise<TournamentInvite[]> {
        if (!getFirebaseDatabase()!) return []

        try {
            const invitesRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/tournamentInvites`)
            const snapshot = await get(invitesRef)

            if (!snapshot.exists()) {
                return []
            }

            const invites: TournamentInvite[] = []
            snapshot.forEach((child) => {
                const invite = child.val() as TournamentInvite
                if (invite.toUserId === userId && invite.status === "pending") {
                    invites.push(invite)
                }
            })

            return invites
        } catch (error) {
            console.error("Failed to get invites:", error)
            return []
        }
    }

    // Get tournament by ID
    async getTournament(roomId: string, tournamentId: string): Promise<Tournament | null> {
        if (!getFirebaseDatabase()!) return null

        try {
            const tournamentRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/tournaments/${tournamentId}`)
            const snapshot = await get(tournamentRef)
            return snapshot.exists() ? (snapshot.val() as Tournament) : null
        } catch (error) {
            console.error("Failed to get tournament:", error)
            return null
        }
    }

    // Get all tournaments for a room
    async getTournaments(roomId: string): Promise<Tournament[]> {
        if (!getFirebaseDatabase()!) return []

        try {
            const tournamentsRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/tournaments`)
            const snapshot = await get(tournamentsRef)

            if (!snapshot.exists()) {
                return []
            }

            const tournaments: Tournament[] = []
            snapshot.forEach((child) => {
                tournaments.push(child.val() as Tournament)
            })

            return tournaments
        } catch (error) {
            console.error("Failed to get tournaments:", error)
            return []
        }
    }

    // Listen for tournament changes
    listenForTournaments(
        roomId: string,
        callback: (tournaments: Tournament[]) => void
    ): () => void {
        if (!getFirebaseDatabase()!) return () => { }

        const tournamentsRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/tournaments`)

        const unsubscribe = onValue(tournamentsRef, (snapshot) => {
            if (!snapshot.exists()) {
                callback([])
                return
            }

            const tournaments: Tournament[] = []
            snapshot.forEach((child) => {
                tournaments.push(child.val() as Tournament)
            })

            callback(tournaments)
        })

        this.listeners.push(unsubscribe)
        return unsubscribe
    }

    // Delete tournament
    async deleteTournament(roomId: string, tournamentId: string): Promise<boolean> {
        if (!getFirebaseDatabase()!) return false

        try {
            await remove(ref(getFirebaseDatabase()!, `rooms/${roomId}/tournaments/${tournamentId}`))
            return true
        } catch (error) {
            console.error("Failed to delete tournament:", error)
            return false
        }
    }

    cleanup(): void {
        this.listeners.forEach((unsubscribe) => unsubscribe())
        this.listeners = []
    }
}
