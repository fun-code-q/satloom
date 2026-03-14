// Connect Four Game Logic for Multiplayer
import { getFirebaseDatabase } from "@/lib/firebase"
import { ref, set, get, update, remove, onValue } from "firebase/database"

export type ConnectFourPlayer = "red" | "yellow"
export type ConnectFourCell = ConnectFourPlayer | null
export type ConnectFourStatus = "waiting" | "in_progress" | "finished" | "abandoned"

export interface ConnectFourGame {
    id: string
    roomId: string
    board: ConnectFourCell[][] // 6 rows x 7 columns
    currentPlayer: ConnectFourPlayer
    players: {
        red: { id: string; name: string; avatar?: string }
        yellow: { id: string; name: string; avatar?: string }
    }
    winner: ConnectFourPlayer | "draw" | null
    status: ConnectFourStatus
    moves: Array<{ player: ConnectFourPlayer; column: number; timestamp: number }>
    createdAt: number
    updatedAt: number
    rematches: string[]
}

export interface ConnectFourMove {
    column: number // 0-6
}

export class ConnectFourManager {
    private static instance: ConnectFourManager
    private listeners: Array<() => void> = []

    // Initialize board
    private createBoard(): ConnectFourCell[][] {
        return Array(6).fill(null).map(() => Array(7).fill(null))
    }

    static getInstance(): ConnectFourManager {
        if (!ConnectFourManager.instance) {
            ConnectFourManager.instance = new ConnectFourManager()
        }
        return ConnectFourManager.instance
    }

    private normalizeGame(game: any): ConnectFourGame | null {
        if (!game) return null

        // Ensure board
        if (!game.board) {
            game.board = Array(6).fill(null).map(() => Array(7).fill(null))
        } else {
            const rawBoard = game.board
            const normalizedBoard: ConnectFourCell[][] = Array(6).fill(null).map(() => Array(7).fill(null))
            
            for (let r = 0; r < 6; r++) {
                const rowData = rawBoard[r]
                if (rowData) {
                    for (let c = 0; c < 7; c++) {
                        normalizedBoard[r][c] = rowData[c] !== undefined ? rowData[c] : null
                    }
                }
            }
            game.board = normalizedBoard
        }

        // Ensure moves
        if (!game.moves || !Array.isArray(game.moves)) {
            game.moves = []
        }

        // Ensure rematches
        if (!game.rematches || !Array.isArray(game.rematches)) {
            game.rematches = []
        }

        return game as ConnectFourGame
    }

    // Create a new game
    async createGame(
        roomId: string,
        playerRedId: string,
        playerRedName: string,
        playerRedAvatar?: string,
        providedGameId?: string
    ): Promise<ConnectFourGame | null> {
        if (!getFirebaseDatabase()!) return null

        try {
            const gameId = providedGameId || `connect4_${Date.now()}`

            const game: ConnectFourGame = {
                id: gameId,
                roomId,
                board: this.createBoard(),
                currentPlayer: "red",
                players: {
                    red: { id: playerRedId, name: playerRedName, ...(playerRedAvatar && { avatar: playerRedAvatar }) },
                    yellow: { id: "", name: "Waiting..." },
                },
                winner: null,
                status: "waiting",
                moves: [],
                createdAt: Date.now(),
                updatedAt: Date.now(),
                rematches: [],
            }

            const sanitizedGame = JSON.parse(JSON.stringify(game))
            await set(ref(getFirebaseDatabase()!, `rooms/${roomId}/games/connect4/${gameId}`), sanitizedGame)
            return game
        } catch (error) {
            console.error("Failed to create Connect Four game:", error)
            return null
        }
    }

    // Join a game
    async joinGame(
        roomId: string,
        gameId: string,
        playerYellowId: string,
        playerYellowName: string,
        avatar?: string
    ): Promise<boolean> {
        if (!getFirebaseDatabase()!) return false

        try {
            const gameRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/games/connect4/${gameId}`)
            const snapshot = await get(gameRef)

            if (!snapshot.exists()) {
                return false
            }

            const game = this.normalizeGame(snapshot.val())
            if (!game) return false

            if (game.status !== "waiting") {
                return false
            }

            game.players.yellow = { id: playerYellowId, name: playerYellowName, ...(avatar && { avatar }) }
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

    async leaveGame(roomId: string, gameId: string, playerId: string): Promise<boolean> {
        if (!getFirebaseDatabase()!) return false

        try {
            const gameRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/games/connect4/${gameId}`)
            const snapshot = await get(gameRef)

            if (!snapshot.exists()) return false

            const game = this.normalizeGame(snapshot.val())
            if (!game) return false

            const isHost = game.players.red.id === playerId
            const isGuest = game.players.yellow.id === playerId

            if (!isHost && !isGuest) return false

            if (isHost) {
                // If host leaves, mark as abandoned or delete
                game.status = "abandoned"
            } else {
                // If guest leaves, mark as abandoned
                game.status = "abandoned"
            }

            game.updatedAt = Date.now()
            const sanitizedGame = JSON.parse(JSON.stringify(game))
            await set(gameRef, sanitizedGame)
            return true
        } catch (error) {
            console.error("Failed to leave game:", error)
            return false
        }
    }

    // Make a move
    async makeMove(
        roomId: string,
        gameId: string,
        playerId: string,
        move: ConnectFourMove
    ): Promise<{ success: boolean; error?: string }> {
        if (!getFirebaseDatabase()!) return { success: false, error: "Database not available" }

        try {
            const gameRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/games/connect4/${gameId}`)
            const snapshot = await get(gameRef)

            if (!snapshot.exists()) {
                return { success: false, error: "Game not found" }
            }

            const game = this.normalizeGame(snapshot.val())
            if (!game) return { success: false, error: "Game not found" }

            if (game.status !== "in_progress") {
                return { success: false, error: "Game is not in progress" }
            }

            // Check if it's this player's turn
            const playerColor = game.players.red.id === playerId ? "red" : game.players.yellow.id === playerId ? "yellow" : null
            if (!playerColor || playerColor !== game.currentPlayer) {
                return { success: false, error: "Not your turn" }
            }

            // Check if column is valid
            if (move.column < 0 || move.column > 6) {
                return { success: false, error: "Invalid column" }
            }

            // Find the lowest empty cell in the column
            let row = -1
            for (let r = 5; r >= 0; r--) {
                if (game.board[r][move.column] === null) {
                    row = r
                    break
                }
            }

            if (row === -1) {
                return { success: false, error: "Column is full" }
            }

            // Make the move
            game.board[row][move.column] = playerColor
            game.moves.push({ player: playerColor, column: move.column, timestamp: Date.now() })

            // Check for winner
            const winner = this.checkWinner(game.board)
            if (winner) {
                game.winner = winner
                game.status = "finished"
            } else if (this.checkDraw(game.board)) {
                game.winner = "draw"
                game.status = "finished"
            } else {
                // Switch player
                game.currentPlayer = game.currentPlayer === "red" ? "yellow" : "red"
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
    private checkWinner(board: ConnectFourCell[][]): ConnectFourPlayer | null {
        const rows = 6
        const cols = 7

        // Check horizontal
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c <= cols - 4; c++) {
                if (
                    board[r][c] &&
                    board[r][c] === board[r][c + 1] &&
                    board[r][c] === board[r][c + 2] &&
                    board[r][c] === board[r][c + 3]
                ) {
                    return board[r][c]
                }
            }
        }

        // Check vertical
        for (let r = 0; r <= rows - 4; r++) {
            for (let c = 0; c < cols; c++) {
                if (
                    board[r][c] &&
                    board[r][c] === board[r + 1][c] &&
                    board[r][c] === board[r + 2][c] &&
                    board[r][c] === board[r + 3][c]
                ) {
                    return board[r][c]
                }
            }
        }

        // Check diagonal (top-left to bottom-right)
        for (let r = 0; r <= rows - 4; r++) {
            for (let c = 0; c <= cols - 4; c++) {
                if (
                    board[r][c] &&
                    board[r][c] === board[r + 1][c + 1] &&
                    board[r][c] === board[r + 2][c + 2] &&
                    board[r][c] === board[r + 3][c + 3]
                ) {
                    return board[r][c]
                }
            }
        }

        // Check diagonal (top-right to bottom-left)
        for (let r = 0; r <= rows - 4; r++) {
            for (let c = 3; c < cols; c++) {
                if (
                    board[r][c] &&
                    board[r][c] === board[r + 1][c - 1] &&
                    board[r][c] === board[r + 2][c - 2] &&
                    board[r][c] === board[r + 3][c - 3]
                ) {
                    return board[r][c]
                }
            }
        }

        return null
    }

    // Check for draw
    private checkDraw(board: ConnectFourCell[][]): boolean {
        return board[0].every((cell) => cell !== null)
    }

    // Get game by ID
    async getGame(roomId: string, gameId: string): Promise<ConnectFourGame | null> {
        if (!getFirebaseDatabase()!) return null

        try {
            const gameRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/games/connect4/${gameId}`)
            const snapshot = await get(gameRef)
            return snapshot.exists() ? (snapshot.val() as ConnectFourGame) : null
        } catch (error) {
            console.error("Failed to get game:", error)
            return null
        }
    }

    // Get active games
    async getActiveGames(roomId: string): Promise<ConnectFourGame[]> {
        if (!getFirebaseDatabase()!) return []

        try {
            const gamesRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/games/connect4`)
            const snapshot = await get(gamesRef)

            if (!snapshot.exists()) {
                return []
            }

            const games: ConnectFourGame[] = []
            snapshot.forEach((child) => {
                const game = child.val() as ConnectFourGame
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
            await remove(ref(getFirebaseDatabase()!, `rooms/${roomId}/games/connect4/${gameId}`))
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
        callback: (game: ConnectFourGame | null) => void
    ): () => void {
        if (!getFirebaseDatabase()!) return () => { }

        const gameRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/games/connect4/${gameId}`)

        const unsubscribe = onValue(gameRef, (snapshot) => {
            const data = this.normalizeGame(snapshot.val())
            callback(data)
        })

        this.listeners.push(unsubscribe)
        return unsubscribe
    }

    // Get best move using minimax (AI)
    static getBestMove(board: ConnectFourCell[][], aiColor: ConnectFourPlayer): number {
        const rows = 6
        const cols = 7
        const opponentColor = aiColor === "red" ? "yellow" : "red"

        // Heuristic evaluation of a position
        const evaluateBoard = (b: ConnectFourCell[][]): number => {
            let score = 0
            // Check all possible 4-in-a-row segments
            // This is a simplified version of a fuller evaluation function
            // (horizontal, vertical, diagonal)

            // For brevity, we'll use a simpler "immediate win/block" + "center preference"

            // 1. Center preference
            for (let r = 0; r < rows; r++) {
                if (b[r][3] === aiColor) score += 3
                else if (b[r][3] === opponentColor) score -= 3
            }

            return score
        }

        // Recursive minimax with alpha-beta pruning (simplified)
        const minimax = (b: ConnectFourCell[][], depth: number, isMaximizing: boolean): number => {
            const winner = this.checkWinnerStatic(b)
            if (winner === aiColor) return 1000 - depth
            if (winner === opponentColor) return -1000 + depth
            if (depth >= 4) return evaluateBoard(b)

            if (isMaximizing) {
                let bestEval = -Infinity
                for (let c = 0; c < cols; c++) {
                    const row = this.getLowestEmptyRow(b, c)
                    if (row !== -1) {
                        b[row][c] = aiColor
                        const evaluation = minimax(b, depth + 1, false)
                        b[row][c] = null
                        bestEval = Math.max(bestEval, evaluation)
                    }
                }
                return bestEval === -Infinity ? 0 : bestEval
            } else {
                let bestEval = Infinity
                for (let c = 0; c < cols; c++) {
                    const row = this.getLowestEmptyRow(b, c)
                    if (row !== -1) {
                        b[row][c] = opponentColor
                        const evaluation = minimax(b, depth + 1, true)
                        b[row][c] = null
                        bestEval = Math.min(bestEval, evaluation)
                    }
                }
                return bestEval === Infinity ? 0 : bestEval
            }
        }

        let bestScore = -Infinity
        let bestMove = -1
        const availableCols = []

        for (let c = 0; c < cols; c++) {
            const row = this.getLowestEmptyRow(board, c)
            if (row !== -1) {
                // Immediate win check
                board[row][c] = aiColor
                if (this.checkWinnerStatic(board) === aiColor) {
                    board[row][c] = null
                    return c
                }
                board[row][c] = null

                // Immediate block check
                board[row][c] = opponentColor
                if (this.checkWinnerStatic(board) === opponentColor) {
                    board[row][c] = null
                    // Keep track of this to potentially prioritize it
                    availableCols.push({ col: c, score: 500 })
                } else {
                    board[row][c] = null
                    const score = minimax(board, 0, false)
                    availableCols.push({ col: c, score })
                }
            }
        }

        if (availableCols.length === 0) return -1

        availableCols.sort((a, b) => b.score - a.score)
        return availableCols[0].col
    }

    private static getLowestEmptyRow(board: ConnectFourCell[][], col: number): number {
        for (let r = 5; r >= 0; r--) {
            if (board[r][col] === null) return r
        }
        return -1
    }

    private static checkWinnerStatic(board: ConnectFourCell[][]): ConnectFourPlayer | "draw" | null {
        const rows = 6
        const cols = 7

        // Horizontal
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c <= cols - 4; c++) {
                if (board[r][c] && board[r][c] === board[r][c + 1] && board[r][c] === board[r][c + 2] && board[r][c] === board[r][c + 3]) return board[r][c]
            }
        }
        // Vertical
        for (let r = 0; r <= rows - 4; r++) {
            for (let c = 0; c < cols; c++) {
                if (board[r][c] && board[r][c] === board[r + 1][c] && board[r][c] === board[r + 2][c] && board[r][c] === board[r + 3][c]) return board[r][c]
            }
        }
        // Diagonal
        for (let r = 0; r <= rows - 4; r++) {
            for (let c = 0; c <= cols - 4; c++) {
                if (board[r][c] && board[r][c] === board[r + 1][c + 1] && board[r][c] === board[r + 2][c + 2] && board[r][c] === board[r + 3][c + 3]) return board[r][c]
            }
        }
        for (let r = 0; r <= rows - 4; r++) {
            for (let c = 3; c < cols; c++) {
                if (board[r][c] && board[r][c] === board[r + 1][c - 1] && board[r][c] === board[r + 2][c - 2] && board[r][c] === board[r + 3][c - 3]) return board[r][c]
            }
        }
        if (board[0].every(c => c !== null)) return "draw"
        return null
    }

    cleanup(): void {
        this.listeners.forEach((unsubscribe) => unsubscribe())
        this.listeners = []
    }
}
