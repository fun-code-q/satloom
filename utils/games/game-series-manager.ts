import type { GameConfig } from "@/components/playground-setup-modal"
import { getFirebaseDatabase } from "@/lib/firebase"
import { ConnectFourManager } from "@/utils/games/connect-four"
import { ChessManager } from "@/utils/games/chess-manager"
import { TicTacToeManager } from "@/utils/games/tic-tac-toe"
import type { UserPresence } from "@/utils/infra/user-presence"
import { get, onValue, ref, set, update } from "firebase/database"

export type SeriesGameType = "chess" | "connect4" | "tictactoe"
export type SeriesMatchStatus = "pending" | "in_progress" | "computer_pending" | "completed"
export type SeriesStatus = "in_progress" | "completed"

export interface SeriesParticipant {
    id: string
    name: string
    avatar?: string
}

export interface GameSeriesMatch {
    id: string
    seriesId: string
    round: number
    position: number
    gameType: SeriesGameType
    gameId: string | null
    player1: SeriesParticipant
    player2: SeriesParticipant | null
    isComputerMatch: boolean
    status: SeriesMatchStatus
    winnerId: string | null
    winnerName: string | null
    createdAt: number
    updatedAt: number
}

export interface GameSeriesViewer {
    id: string
    name: string
    avatar?: string
    joinedAt: number
    lastSeen: number
}

export interface GameSeries {
    id: string
    roomId: string
    gameType: SeriesGameType
    createdBy: string
    createdByName: string
    createdAt: number
    updatedAt: number
    currentRound: number
    status: SeriesStatus
    participants: SeriesParticipant[]
    matches: GameSeriesMatch[]
    finalWinnerId: string | null
    finalWinnerName: string | null
    viewers: Record<string, GameSeriesViewer>
    predictions?: Record<string, Record<string, { userId: string; userName: string; winnerId: string; createdAt: number }>>
    votes?: Record<string, Record<string, { userId: string; userName: string; winnerId: string; createdAt: number }>>
    bets?: Record<string, Record<string, { userId: string; userName: string; winnerId: string; amount: number; createdAt: number }>>
}

const SERIES_PATH = (roomId: string, seriesId: string) => `rooms/${roomId}/gameSeries/${seriesId}`

export class GameSeriesManager {
    private static instance: GameSeriesManager

    static getInstance(): GameSeriesManager {
        if (!GameSeriesManager.instance) {
            GameSeriesManager.instance = new GameSeriesManager()
        }
        return GameSeriesManager.instance
    }

    supportsSeriesMode(game: GameConfig["selectedGame"]) {
        return game === "chess" || game === "connect4" || game === "tictactoe"
    }

    getSeriesGameType(game: GameConfig["selectedGame"]): SeriesGameType | null {
        if (game === "chess" || game === "connect4" || game === "tictactoe") return game
        return null
    }

    buildParticipantsFromPresence(
        onlineUsers: UserPresence[],
        currentUserId: string,
        currentUserName: string,
        currentUserAvatar?: string
    ): SeriesParticipant[] {
        const map = new Map<string, SeriesParticipant>()
        for (const user of onlineUsers) {
            if (!user?.id || !user?.name || user.status !== "online") continue
            map.set(user.id, {
                id: user.id,
                name: user.name,
                avatar: user.avatar
            })
        }

        if (!map.has(currentUserId)) {
            map.set(currentUserId, {
                id: currentUserId,
                name: currentUserName,
                avatar: currentUserAvatar
            })
        }

        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
    }

    async createSeries(
        roomId: string,
        gameType: SeriesGameType,
        createdBy: string,
        createdByName: string,
        participants: SeriesParticipant[]
    ): Promise<GameSeries | null> {
        const db = getFirebaseDatabase()
        if (!db || participants.length < 2) return null

        const seriesId = `series_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        const round = 1
        const createdAt = Date.now()
        const matches: GameSeriesMatch[] = []

        for (let i = 0; i < participants.length; i += 2) {
            const player1 = participants[i]
            const player2 = participants[i + 1] || null
            const position = Math.floor(i / 2) + 1
            const matchId = `${seriesId}_r${round}_m${position}`

            let gameId: string | null = null
            let status: SeriesMatchStatus = "pending"
            let isComputerMatch = false
            let resolvedPlayer2 = player2

            if (player2) {
                gameId = `${gameType}_${seriesId}_r${round}_m${position}`
                const created = await this.createHeadToHeadGame(roomId, gameType, gameId, player1, player2)
                status = created ? "in_progress" : "pending"
            } else {
                isComputerMatch = true
                status = "computer_pending"
                resolvedPlayer2 = {
                    id: `ai_${seriesId}_${position}`,
                    name: "Computer"
                }
            }

            matches.push({
                id: matchId,
                seriesId,
                round,
                position,
                gameType,
                gameId,
                player1,
                player2: resolvedPlayer2,
                isComputerMatch,
                status,
                winnerId: null,
                winnerName: null,
                createdAt,
                updatedAt: createdAt
            })
        }

        const series: GameSeries = {
            id: seriesId,
            roomId,
            gameType,
            createdBy,
            createdByName,
            createdAt,
            updatedAt: createdAt,
            currentRound: 1,
            status: "in_progress",
            participants,
            matches,
            finalWinnerId: null,
            finalWinnerName: null,
            viewers: {}
        }

        await set(ref(db, SERIES_PATH(roomId, seriesId)), JSON.parse(JSON.stringify(series)))
        return series
    }

    async getSeries(roomId: string, seriesId: string): Promise<GameSeries | null> {
        const db = getFirebaseDatabase()
        if (!db) return null

        const snap = await get(ref(db, SERIES_PATH(roomId, seriesId)))
        return snap.exists() ? (snap.val() as GameSeries) : null
    }

    listenForSeries(roomId: string, seriesId: string, callback: (series: GameSeries | null) => void): () => void {
        const db = getFirebaseDatabase()
        if (!db) return () => { }

        const seriesRef = ref(db, SERIES_PATH(roomId, seriesId))
        const unsubscribe = onValue(seriesRef, (snap) => {
            callback(snap.exists() ? (snap.val() as GameSeries) : null)
        })
        return unsubscribe
    }

    async joinAsViewer(
        roomId: string,
        seriesId: string,
        viewer: { id: string; name: string; avatar?: string }
    ): Promise<boolean> {
        const db = getFirebaseDatabase()
        if (!db) return false

        const viewerRef = ref(db, `${SERIES_PATH(roomId, seriesId)}/viewers/${viewer.id}`)
        await set(viewerRef, {
            id: viewer.id,
            name: viewer.name,
            avatar: viewer.avatar || null,
            joinedAt: Date.now(),
            lastSeen: Date.now()
        })
        return true
    }

    async submitPrediction(
        roomId: string,
        seriesId: string,
        matchId: string,
        userId: string,
        userName: string,
        winnerId: string
    ) {
        const db = getFirebaseDatabase()
        if (!db) return

        await set(ref(db, `${SERIES_PATH(roomId, seriesId)}/predictions/${matchId}/${userId}`), {
            userId,
            userName,
            winnerId,
            createdAt: Date.now()
        })
    }

    async submitVote(
        roomId: string,
        seriesId: string,
        matchId: string,
        userId: string,
        userName: string,
        winnerId: string
    ) {
        const db = getFirebaseDatabase()
        if (!db) return

        await set(ref(db, `${SERIES_PATH(roomId, seriesId)}/votes/${matchId}/${userId}`), {
            userId,
            userName,
            winnerId,
            createdAt: Date.now()
        })
    }

    async submitBet(
        roomId: string,
        seriesId: string,
        matchId: string,
        userId: string,
        userName: string,
        winnerId: string,
        amount: number
    ) {
        const db = getFirebaseDatabase()
        if (!db) return

        await set(ref(db, `${SERIES_PATH(roomId, seriesId)}/bets/${matchId}/${userId}`), {
            userId,
            userName,
            winnerId,
            amount,
            createdAt: Date.now()
        })
    }

    getAssignedMatch(series: GameSeries, userId: string): GameSeriesMatch | null {
        const roundMatches = series.matches
            .filter((match) => match.round === series.currentRound)
            .sort((a, b) => a.position - b.position)

        for (const match of roundMatches) {
            if (match.winnerId) continue
            if (match.player1.id === userId || match.player2?.id === userId) {
                return match
            }
        }

        return null
    }

    getWatchableMatches(series: GameSeries): GameSeriesMatch[] {
        return [...series.matches]
            .filter((match) => !!match.gameId)
            .sort((a, b) => {
                if (a.round === b.round) return a.position - b.position
                return a.round - b.round
            })
    }

    toMatchConfig(baseConfig: GameConfig, match: GameSeriesMatch, userId: string): GameConfig {
        const isComputerMatch = match.isComputerMatch && (match.player1.id === userId || match.player2?.id === userId)
        if (isComputerMatch) {
            const human = match.player1.id === userId ? match.player1 : (match.player2 || match.player1)
            return {
                ...baseConfig,
                selectedGame: match.gameType,
                gameType: "single",
                gameId: `${match.id}_local`,
                players: [
                    {
                        id: human.id,
                        name: human.name,
                        isComputer: false,
                        isHost: true,
                        color: "#3b82f6"
                    },
                    {
                        id: `ai_${match.id}`,
                        name: "Computer",
                        isComputer: true,
                        isHost: false,
                        color: "#ef4444"
                    }
                ]
            }
        }

        return {
            ...baseConfig,
            selectedGame: match.gameType,
            gameType: "double",
            gameId: match.gameId || undefined,
            players: [
                {
                    id: match.player1.id,
                    name: match.player1.name,
                    isComputer: false,
                    isHost: true,
                    color: "#3b82f6"
                },
                {
                    id: match.player2?.id || "",
                    name: match.player2?.name || "Waiting...",
                    isComputer: !!match.player2?.id?.startsWith("ai_"),
                    isHost: false,
                    color: "#ef4444"
                }
            ]
        }
    }

    async reportComputerMatchResult(
        roomId: string,
        seriesId: string,
        matchId: string,
        winnerId: string,
        winnerName: string
    ) {
        const series = await this.getSeries(roomId, seriesId)
        if (!series) return

        const updatedMatches = series.matches.map((match) => {
            if (match.id !== matchId) return match
            return {
                ...match,
                status: "completed" as const,
                winnerId,
                winnerName,
                updatedAt: Date.now()
            }
        })

        await update(ref(getFirebaseDatabase()!, SERIES_PATH(roomId, seriesId)), {
            matches: updatedMatches,
            updatedAt: Date.now()
        })
    }

    async forfeitParticipant(
        roomId: string,
        seriesId: string,
        userId: string,
        userName?: string
    ): Promise<GameSeries | null> {
        const series = await this.getSeries(roomId, seriesId)
        if (!series || series.status === "completed") return series

        const target = series.matches.find((match) => {
            if (match.round !== series.currentRound || match.status === "completed") return false
            return match.player1.id === userId || match.player2?.id === userId
        })

        if (!target) return series

        let winnerId = ""
        let winnerName = ""

        if (target.player1.id === userId) {
            winnerId = target.player2?.id || ""
            winnerName = target.player2?.name || "Opponent"
        } else {
            winnerId = target.player1.id
            winnerName = target.player1.name
        }

        if (!winnerId) {
            winnerId = target.player1.id
            winnerName = target.player1.name || userName || "Opponent"
        }

        const updatedMatches = series.matches.map((match) => {
            if (match.id !== target.id) return match
            return {
                ...match,
                status: "completed" as const,
                winnerId,
                winnerName: `${winnerName} (forfeit)`,
                updatedAt: Date.now()
            }
        })

        await update(ref(getFirebaseDatabase()!, SERIES_PATH(roomId, seriesId)), {
            matches: updatedMatches,
            updatedAt: Date.now()
        })

        return this.syncSeriesProgress(roomId, seriesId)
    }

    async syncSeriesProgress(roomId: string, seriesId: string): Promise<GameSeries | null> {
        const db = getFirebaseDatabase()
        if (!db) return null

        const series = await this.getSeries(roomId, seriesId)
        if (!series || series.status === "completed") return series

        const matches = [...series.matches]
        let hasMatchUpdates = false

        for (let i = 0; i < matches.length; i++) {
            const match = matches[i]
            if (match.status === "completed" || match.isComputerMatch || !match.gameId) continue

            const outcome = await this.getMatchOutcome(roomId, match)
            if (!outcome.completed) continue

            const fallbackWinner = match.player1
            const winnerId = outcome.winnerId || fallbackWinner.id
            const winnerName = outcome.winnerName || `${fallbackWinner.name} (draw tiebreak)`

            matches[i] = {
                ...match,
                status: "completed",
                winnerId,
                winnerName,
                updatedAt: Date.now()
            }
            hasMatchUpdates = true
        }

        const inCurrentRound = matches.filter((match) => match.round === series.currentRound)
        const isCurrentRoundDone = inCurrentRound.length > 0 && inCurrentRound.every((match) => match.status === "completed")

        const patch: Partial<GameSeries> = {}
        if (hasMatchUpdates) {
            patch.matches = matches
            patch.updatedAt = Date.now()
        }

        if (isCurrentRoundDone) {
            const winners = inCurrentRound
                .map((match) => {
                    if (!match.winnerId) return null
                    return {
                        id: match.winnerId,
                        name: match.winnerName || this.findParticipantName(series, match.winnerId)
                    }
                })
                .filter(Boolean) as Array<{ id: string; name: string }>

            if (winners.length <= 1) {
                patch.status = "completed"
                patch.finalWinnerId = winners[0]?.id || null
                patch.finalWinnerName = winners[0]?.name || null
                patch.updatedAt = Date.now()
            } else {
                const nextRound = series.currentRound + 1
                const alreadyCreated = matches.some((match) => match.round === nextRound)
                if (!alreadyCreated) {
                    const nextRoundMatches = await this.createRoundMatches(series, nextRound, winners)
                    patch.matches = [...matches, ...nextRoundMatches]
                }
                patch.currentRound = nextRound
                patch.updatedAt = Date.now()
            }
        }

        if (Object.keys(patch).length > 0) {
            await update(ref(db, SERIES_PATH(roomId, seriesId)), patch)
            return {
                ...series,
                ...patch,
                matches: (patch.matches as GameSeriesMatch[]) || matches
            }
        }

        return series
    }

    private async createRoundMatches(
        series: GameSeries,
        round: number,
        winners: Array<{ id: string; name: string }>
    ): Promise<GameSeriesMatch[]> {
        const matches: GameSeriesMatch[] = []
        const createdAt = Date.now()

        for (let i = 0; i < winners.length; i += 2) {
            const player1 = this.findParticipant(series, winners[i].id) || { id: winners[i].id, name: winners[i].name }
            const winner2 = winners[i + 1] || null
            const player2 = winner2 ? (this.findParticipant(series, winner2.id) || { id: winner2.id, name: winner2.name }) : null
            const position = Math.floor(i / 2) + 1
            const matchId = `${series.id}_r${round}_m${position}`

            let gameId: string | null = null
            let status: SeriesMatchStatus = "pending"
            let isComputerMatch = false
            let resolvedPlayer2 = player2

            if (player2) {
                gameId = `${series.gameType}_${series.id}_r${round}_m${position}`
                const created = await this.createHeadToHeadGame(series.roomId, series.gameType, gameId, player1, player2)
                status = created ? "in_progress" : "pending"
            } else {
                isComputerMatch = true
                status = "computer_pending"
                resolvedPlayer2 = {
                    id: `ai_${series.id}_r${round}_m${position}`,
                    name: "Computer"
                }
            }

            matches.push({
                id: matchId,
                seriesId: series.id,
                round,
                position,
                gameType: series.gameType,
                gameId,
                player1,
                player2: resolvedPlayer2,
                isComputerMatch,
                status,
                winnerId: null,
                winnerName: null,
                createdAt,
                updatedAt: createdAt
            })
        }

        return matches
    }

    private async createHeadToHeadGame(
        roomId: string,
        gameType: SeriesGameType,
        gameId: string,
        player1: SeriesParticipant,
        player2: SeriesParticipant
    ): Promise<boolean> {
        try {
            if (gameType === "chess") {
                const game = await ChessManager.getInstance().createGame(roomId, player1.id, player1.name, player1.avatar, gameId)
                if (!game) return false
                return ChessManager.getInstance().joinGame(roomId, gameId, player2.id, player2.name, player2.avatar)
            }

            if (gameType === "connect4") {
                const game = await ConnectFourManager.getInstance().createGame(roomId, player1.id, player1.name, player1.avatar, gameId)
                if (!game) return false
                return ConnectFourManager.getInstance().joinGame(roomId, gameId, player2.id, player2.name, player2.avatar)
            }

            const game = await TicTacToeManager.getInstance().createGame(roomId, player1.id, player1.name, player1.avatar, gameId)
            if (!game) return false
            return TicTacToeManager.getInstance().joinGame(roomId, gameId, player2.id, player2.name, player2.avatar)
        } catch (error) {
            console.error("Failed to create head-to-head game:", error)
            return false
        }
    }

    private async getMatchOutcome(
        roomId: string,
        match: GameSeriesMatch
    ): Promise<{ completed: boolean; winnerId: string | null; winnerName: string | null }> {
        const db = getFirebaseDatabase()
        if (!db || !match.gameId) return { completed: false, winnerId: null, winnerName: null }

        if (match.gameType === "chess") {
            const snap = await get(ref(db, `rooms/${roomId}/games/chess/${match.gameId}`))
            if (!snap.exists()) return { completed: false, winnerId: null, winnerName: null }
            const game = snap.val()
            const isFinished = game.status === "checkmate" || game.status === "draw" || game.status === "stalemate"
            if (!isFinished) return { completed: false, winnerId: null, winnerName: null }

            if (game.winner === "white") return { completed: true, winnerId: match.player1.id, winnerName: match.player1.name }
            if (game.winner === "black" && match.player2) return { completed: true, winnerId: match.player2.id, winnerName: match.player2.name }
            return { completed: true, winnerId: null, winnerName: null }
        }

        if (match.gameType === "connect4") {
            const snap = await get(ref(db, `rooms/${roomId}/games/connect4/${match.gameId}`))
            if (!snap.exists()) return { completed: false, winnerId: null, winnerName: null }
            const game = snap.val()
            if (game.status !== "finished") return { completed: false, winnerId: null, winnerName: null }

            if (game.winner === "red") return { completed: true, winnerId: match.player1.id, winnerName: match.player1.name }
            if (game.winner === "yellow" && match.player2) return { completed: true, winnerId: match.player2.id, winnerName: match.player2.name }
            return { completed: true, winnerId: null, winnerName: null }
        }

        const snap = await get(ref(db, `rooms/${roomId}/games/tictactoe/${match.gameId}`))
        if (!snap.exists()) return { completed: false, winnerId: null, winnerName: null }
        const game = snap.val()
        if (game.status !== "finished") return { completed: false, winnerId: null, winnerName: null }

        if (game.winner === "X") return { completed: true, winnerId: match.player1.id, winnerName: match.player1.name }
        if (game.winner === "O" && match.player2) return { completed: true, winnerId: match.player2.id, winnerName: match.player2.name }
        return { completed: true, winnerId: null, winnerName: null }
    }

    private findParticipant(series: GameSeries, id: string): SeriesParticipant | null {
        return series.participants.find((player) => player.id === id) || null
    }

    private findParticipantName(series: GameSeries, id: string): string {
        return this.findParticipant(series, id)?.name || "Unknown"
    }
}

export const gameSeriesManager = GameSeriesManager.getInstance()
