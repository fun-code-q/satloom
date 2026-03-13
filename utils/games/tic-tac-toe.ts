// Tic-Tac-Toe Game Logic for Multiplayer
import { getFirebaseDatabase } from "@/lib/firebase"
import { ref, set, get, update, remove, onValue } from "firebase/database"

export type Player = "X" | "O"
export type CellValue = Player | null
export type GameStatus = "waiting" | "in_progress" | "finished" | "abandoned"

export interface TicTacToeGame {
    id: string
    roomId: string
    board: CellValue[]
    currentPlayer: Player
    players: {
        X: { id: string; name: string; avatar?: string }
        O: { id: string; name: string; avatar?: string }
    }
    winner: Player | "draw" | null
    status: GameStatus
    moves: Array<{ player: Player; position: number; timestamp: number }>
    createdAt: number
    updatedAt: number
    rematches: string[] // Player IDs who requested rematch
}

export interface TicTacToeMove {
    position: number // 0-8
}

export class TicTacToeManager {
    private static instance: TicTacToeManager
    private listeners: Array<() => void> = []

    static getInstance(): TicTacToeManager {
        if (!TicTacToeManager.instance) {
            TicTacToeManager.instance = new TicTacToeManager()
        }
        return TicTacToeManager.instance
    }

    // Create a new game
    async createGame(
        roomId: string,
        playerXId: string,
        playerXName: string,
        playerXAvatar?: string,
        providedGameId?: string
    ): Promise<TicTacToeGame | null> {
        if (!getFirebaseDatabase()!) return null

        try {
            const gameId = providedGameId || `tictactoe_${Date.now()}`

            const game: TicTacToeGame = {
                id: gameId,
                roomId,
                board: Array(9).fill(null),
                currentPlayer: "X",
                players: {
                    X: { id: playerXId, name: playerXName, ...(playerXAvatar && { avatar: playerXAvatar }) },
                    O: { id: "", name: "Waiting..." },
                },
                winner: null,
                status: "waiting",
                moves: [],
                createdAt: Date.now(),
                updatedAt: Date.now(),
                rematches: [],
            }

            const sanitizedGame = JSON.parse(JSON.stringify(game))
            await set(ref(getFirebaseDatabase()!, `rooms/${roomId}/games/tictactoe/${gameId}`), sanitizedGame)
            return game
        } catch (error) {
            console.error("Failed to create Tic-Tac-Toe game:", error)
            return null
        }
    }

    // Join a game
    async joinGame(roomId: string, gameId: string, playerOId: string, playerOName: string, avatar?: string): Promise<boolean> {
        if (!getFirebaseDatabase()!) return false

        try {
            const gameRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/games/tictactoe/${gameId}`)
            const snapshot = await get(gameRef)

            if (!snapshot.exists()) {
                return false
            }

            const game = snapshot.val() as TicTacToeGame

            if (game.status !== "waiting") {
                return false
            }

            game.players.O = { id: playerOId, name: playerOName, ...(avatar && { avatar }) }
            game.status = "in_progress"
            game.updatedAt = Date.now()

            const sanitizedGame = JSON.parse(JSON.stringify(game))
            await set(gameRef, sanitizedGame)
            return true
        } catch (error) {
            console.error("Failed to join game:", error)
            return false
        }
    }

    // Make a move
    async makeMove(roomId: string, gameId: string, playerId: string, move: TicTacToeMove): Promise<{ success: boolean; error?: string }> {
        if (!getFirebaseDatabase()!) return { success: false, error: "Database not available" }

        try {
            const gameRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/games/tictactoe/${gameId}`)
            const snapshot = await get(gameRef)

            if (!snapshot.exists()) {
                return { success: false, error: "Game not found" }
            }

            const game = snapshot.val() as TicTacToeGame

            if (game.status !== "in_progress") {
                return { success: false, error: "Game is not in progress" }
            }

            // Check if it's this player's turn
            const playerSymbol = game.players.X.id === playerId ? "X" : game.players.O.id === playerId ? "O" : null
            if (!playerSymbol || playerSymbol !== game.currentPlayer) {
                return { success: false, error: "Not your turn" }
            }

            // Check if cell is empty
            if (game.board[move.position] !== null) {
                return { success: false, error: "Cell already occupied" }
            }

            // Make the move
            game.board[move.position] = playerSymbol
            game.moves.push({ player: playerSymbol, position: move.position, timestamp: Date.now() })

            // Check for winner
            const winner = this.checkWinner(game.board)
            if (winner) {
                game.winner = winner
                game.status = "finished"
            } else if (game.board.every((cell) => cell !== null)) {
                game.winner = "draw"
                game.status = "finished"
            } else {
                // Switch player
                game.currentPlayer = game.currentPlayer === "X" ? "O" : "X"
            }

            game.updatedAt = Date.now()
            const sanitizedGame = JSON.parse(JSON.stringify(game))
            await set(gameRef, sanitizedGame)

            return { success: true }
        } catch (error) {
            console.error("Failed to make move:", error)
            return { success: false, error: "Failed to make move" }
        }
    }

    // Check for winner
    private checkWinner(board: CellValue[]): Player | "draw" | null {
        const winningCombinations = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
            [0, 4, 8], [2, 4, 6], // Diagonals
        ]

        for (const [a, b, c] of winningCombinations) {
            if (board[a] && board[a] === board[b] && board[a] === board[c]) {
                return board[a]
            }
        }

        if (board.every((cell) => cell !== null)) {
            return "draw"
        }

        return null
    }

    // Request rematch
    async requestRematch(roomId: string, gameId: string, playerId: string): Promise<boolean> {
        if (!getFirebaseDatabase()!) return false

        try {
            const gameRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/games/tictactoe/${gameId}`)
            const snapshot = await get(gameRef)

            if (!snapshot.exists()) {
                return false
            }

            const game = snapshot.val() as TicTacToeGame

            if (!game.rematches.includes(playerId)) {
                game.rematches.push(playerId)
                await set(gameRef, game)
            }

            // If both requested, start new game
            const expectedRematches = [game.players.X.id, game.players.O.id].filter((id) => id)
            if (game.rematches.length >= expectedRematches.length) {
                // Create new game
                const newGame = await this.createGame(
                    roomId,
                    game.players.X.id,
                    game.players.X.name,
                    game.players.X.avatar
                )

                if (newGame) {
                    // Join with O player
                    await this.joinGame(roomId, newGame.id, game.players.O.id, game.players.O.name, game.players.O.avatar)
                }
            }

            return true
        } catch (error) {
            console.error("Failed to request rematch:", error)
            return false
        }
    }

    // Get game by ID
    async getGame(roomId: string, gameId: string): Promise<TicTacToeGame | null> {
        if (!getFirebaseDatabase()!) return null

        try {
            const gameRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/games/tictactoe/${gameId}`)
            const snapshot = await get(gameRef)
            return snapshot.exists() ? (snapshot.val() as TicTacToeGame) : null
        } catch (error) {
            console.error("Failed to get game:", error)
            return null
        }
    }

    // Get active games for room
    async getActiveGames(roomId: string): Promise<TicTacToeGame[]> {
        if (!getFirebaseDatabase()!) return []

        try {
            const gamesRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/games/tictactoe`)
            const snapshot = await get(gamesRef)

            if (!snapshot.exists()) {
                return []
            }

            const games: TicTacToeGame[] = []
            snapshot.forEach((child) => {
                const game = child.val() as TicTacToeGame
                if (game.status === "waiting" || game.status === "in_progress") {
                    games.push(game)
                }
            })

            return games
        } catch (error) {
            console.error("Failed to get games:", error)
            return []
        }
    }

    // Delete game
    async deleteGame(roomId: string, gameId: string): Promise<boolean> {
        if (!getFirebaseDatabase()!) return false

        try {
            await remove(ref(getFirebaseDatabase()!, `rooms/${roomId}/games/tictactoe/${gameId}`))
            return true
        } catch (error) {
            console.error("Failed to delete game:", error)
            return false
        }
    }

    // Listen for game updates
    listenForGameUpdates(
        roomId: string,
        gameId: string,
        callback: (game: TicTacToeGame | null) => void
    ): () => void {
        if (!getFirebaseDatabase()!) return () => { }

        const gameRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/games/tictactoe/${gameId}`)

        const unsubscribe = onValue(gameRef, (snapshot) => {
            const data = snapshot.val();
            callback(data ? (data as TicTacToeGame) : null)
        })

        this.listeners.push(unsubscribe)
        return unsubscribe
    }

    // Get best move using minimax (AI)
    static getBestMove(board: CellValue[], aiPlayer: Player): number {
        const opponent = aiPlayer === "X" ? "O" : "X"

        // Check for winning move
        for (let i = 0; i < 9; i++) {
            if (board[i] === null) {
                board[i] = aiPlayer
                if (this.checkWinnerStatic(board) === aiPlayer) {
                    board[i] = null
                    return i
                }
                board[i] = null
            }
        }

        // Check for blocking move
        for (let i = 0; i < 9; i++) {
            if (board[i] === null) {
                board[i] = opponent
                if (this.checkWinnerStatic(board) === opponent) {
                    board[i] = null
                    return i
                }
                board[i] = null
            }
        }

        // Take center if available
        if (board[4] === null) {
            return 4
        }

        // Take corner if available
        const corners = [0, 2, 6, 8].filter((i) => board[i] === null)
        if (corners.length > 0) {
            return corners[Math.floor(Math.random() * corners.length)]
        }

        // Take any available
        const available = board.map((cell, i) => cell === null ? i : -1).filter((i) => i !== -1)
        if (available.length > 0) {
            return available[Math.floor(Math.random() * available.length)]
        }

        return -1
    }

    private static checkWinnerStatic(board: CellValue[]): Player | "draw" | null {
        const winningCombinations = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6],
        ]

        for (const [a, b, c] of winningCombinations) {
            if (board[a] && board[a] === board[b] && board[a] === board[c]) {
                return board[a]
            }
        }

        if (board.every((cell) => cell !== null)) {
            return "draw"
        }

        return null
    }

    cleanup(): void {
        this.listeners.forEach((unsubscribe) => unsubscribe())
        this.listeners = []
    }
}
