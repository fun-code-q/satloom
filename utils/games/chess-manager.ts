import { getFirebaseDatabase } from "@/lib/firebase"
import { ref, set, get, update, remove, onValue } from "firebase/database"

export type ChessPlayerColor = "white" | "black"
export type ChessGameStatus = "waiting" | "in_progress" | "check" | "checkmate" | "stalemate" | "draw" | "abandoned"

export interface ChessGameSession {
    id: string
    roomId: string
    fen: string
    whitePlayer: { id: string; name: string; avatar?: string }
    blackPlayer: { id: string; name: string; avatar?: string }
    currentPlayer: ChessPlayerColor
    status: ChessGameStatus
    winner: ChessPlayerColor | "draw" | null
    lastMove?: { from: string; to: string; san: string }
    createdAt: number
    updatedAt: number
    rematches: string[]
}

export class ChessManager {
    private static instance: ChessManager
    private listeners: Array<() => void> = []

    static getInstance(): ChessManager {
        if (!ChessManager.instance) {
            ChessManager.instance = new ChessManager()
        }
        return ChessManager.instance
    }

    async createGame(roomId: string, hostId: string, hostName: string, hostAvatar?: string, providedGameId?: string): Promise<ChessGameSession | null> {
        if (!getFirebaseDatabase()!) return null
        const gameId = providedGameId || `chess_${Date.now()}`
        const game: ChessGameSession = {
            id: gameId,
            roomId,
            fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            whitePlayer: { id: hostId, name: hostName, ...(hostAvatar && { avatar: hostAvatar }) },
            blackPlayer: { id: "", name: "Waiting..." },
            currentPlayer: "white",
            status: "waiting",
            winner: null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            rematches: []
        }
        await set(ref(getFirebaseDatabase()!, `rooms/${roomId}/games/chess/${gameId}`), game)
        return game
    }

    async joinGame(roomId: string, gameId: string, playerId: string, playerName: string, avatar?: string): Promise<boolean> {
        if (!getFirebaseDatabase()!) return false
        const gameRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/games/chess/${gameId}`)
        const snapshot = await get(gameRef)
        if (!snapshot.exists()) return false

        const game = snapshot.val() as ChessGameSession
        if (game.status !== "waiting") return false

        game.blackPlayer = { id: playerId, name: playerName, ...(avatar && { avatar }) }
        game.status = "in_progress"
        game.updatedAt = Date.now()
        await set(gameRef, game)
        return true
    }

    async updateGameState(roomId: string, gameId: string, fen: string, status: ChessGameStatus, winner: ChessPlayerColor | "draw" | null, lastMove?: { from: string, to: string, san: string }): Promise<boolean> {
        if (!getFirebaseDatabase()!) return false
        const gameRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/games/chess/${gameId}`)

        // Toggle turn calc (simple version, better to rely on FEN but for UI display...)
        // Actually FEN contains the turn. We can parse it if needed.

        await update(gameRef, {
            fen,
            status,
            winner,
            lastMove,
            updatedAt: Date.now()
        })
        return true
    }

    async requestRematch(roomId: string, gameId: string, playerId: string): Promise<boolean> {
        if (!getFirebaseDatabase()!) return false
        const gameRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/games/chess/${gameId}`)
        const snapshot = await get(gameRef)
        if (!snapshot.exists()) return false

        const game = snapshot.val() as ChessGameSession
        if (!game.rematches) game.rematches = []
        if (!game.rematches.includes(playerId)) {
            game.rematches.push(playerId)
            await update(gameRef, { rematches: game.rematches })
        }

        if (game.rematches.length >= 2) {
            // Create new game logic would go here
            // For simplicity, we just reset the board
            await update(gameRef, {
                fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                status: "in_progress",
                winner: null,
                lastMove: null,
                rematches: [],
                updatedAt: Date.now()
            })
        }
        return true
    }

    listenForGameUpdates(roomId: string, gameId: string, callback: (game: ChessGameSession | null) => void): () => void {
        if (!getFirebaseDatabase()!) return () => { }
        const gameRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/games/chess/${gameId}`)
        const unsubscribe = onValue(gameRef, (snapshot) => {
            callback(snapshot.exists() ? snapshot.val() : null)
        })
        this.listeners.push(unsubscribe)
        return unsubscribe
    }

    async getActiveGames(roomId: string): Promise<ChessGameSession[]> {
        if (!getFirebaseDatabase()!) return []
        const gamesRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/games/chess`)
        const snapshot = await get(gamesRef)
        if (!snapshot.exists()) return []

        const games: ChessGameSession[] = []
        snapshot.forEach((child) => {
            const game = child.val()
            if (game.status === "waiting" || game.status === "in_progress" || game.status === "check") {
                games.push(game)
            }
        })
        return games
    }
}
