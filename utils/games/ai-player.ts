import type { GameState, Move, Line, Box } from "./dots-and-boxes-game"

/**
 * Enhanced AI for Dots and Boxes with multiple difficulty levels
 * Uses minimax algorithm with alpha-beta pruning for high intelligence
 */

export type AIDifficulty = 'easy' | 'medium' | 'hard' | 'expert'

interface MoveScore {
    move: Move
    score: number
}

export class DotsAndBoxesAI {
    private difficulty: AIDifficulty
    private maxDepth: number
    private thinkingTimeMs: number

    constructor(difficulty: AIDifficulty = 'hard') {
        this.difficulty = difficulty

        // Set search depth based on difficulty
        switch (difficulty) {
            case 'easy':
                this.maxDepth = 1
                this.thinkingTimeMs = 500
                break
            case 'medium':
                this.maxDepth = 2
                this.thinkingTimeMs = 1000
                break
            case 'hard':
                this.maxDepth = 3
                this.thinkingTimeMs = 1500
                break
            case 'expert':
                this.maxDepth = 4
                this.thinkingTimeMs = 2000
                break
        }
    }

    /**
     * Get the best move for the AI player
     */
    async getBestMove(gameState: GameState, playerId: string): Promise<Move | null> {
        // Simulate thinking time
        await this.delay(this.thinkingTimeMs)

        const availableMoves = this.getAvailableMoves(gameState)

        if (availableMoves.length === 0) return null

        // Easy mode: random move
        if (this.difficulty === 'easy') {
            return this.getRandomMove(availableMoves, gameState, playerId)
        }

        // Medium+: Use strategy
        // 1. First, check for moves that complete boxes
        const completingMoves = this.getBoxCompletingMoves(gameState, availableMoves, playerId)
        if (completingMoves.length > 0) {
            return this.selectBestCompletingMove(completingMoves)
        }

        // 2. Avoid moves that give opponent a box (if possible)
        const safeMoves = this.getSafeMoves(gameState, availableMoves)

        // Hard/Expert: Use minimax for strategic play
        if (this.difficulty === 'hard' || this.difficulty === 'expert') {
            return this.minimaxMove(gameState, playerId, safeMoves.length > 0 ? safeMoves : availableMoves)
        }

        // Medium: Pick safe move or random
        if (safeMoves.length > 0) {
            return this.getRandomMove(safeMoves, gameState, playerId)
        }

        return this.getRandomMove(availableMoves, gameState, playerId)
    }

    /**
     * Get all available moves
     */
    private getAvailableMoves(gameState: GameState): Array<{ type: 'horizontal' | 'vertical', row: number, col: number }> {
        const moves: Array<{ type: 'horizontal' | 'vertical', row: number, col: number }> = []

        // Check horizontal lines
        for (let row = 0; row < gameState.horizontalLines.length; row++) {
            for (let col = 0; col < gameState.horizontalLines[row].length; col++) {
                if (!gameState.horizontalLines[row][col].isDrawn) {
                    moves.push({ type: 'horizontal', row, col })
                }
            }
        }

        // Check vertical lines
        for (let row = 0; row < gameState.verticalLines.length; row++) {
            for (let col = 0; col < gameState.verticalLines[row].length; col++) {
                if (!gameState.verticalLines[row][col].isDrawn) {
                    moves.push({ type: 'vertical', row, col })
                }
            }
        }

        return moves
    }

    /**
     * Get moves that complete at least one box
     */
    private getBoxCompletingMoves(
        gameState: GameState,
        moves: Array<{ type: 'horizontal' | 'vertical', row: number, col: number }>,
        playerId: string
    ): MoveScore[] {
        const completingMoves: MoveScore[] = []

        for (const move of moves) {
            const boxesCompleted = this.countBoxesCompleted(gameState, move)
            if (boxesCompleted > 0) {
                completingMoves.push({
                    move: {
                        playerId,
                        type: move.type,
                        row: move.row,
                        col: move.col,
                        boxesCompleted,
                        timestamp: Date.now(),
                    },
                    score: boxesCompleted,
                })
            }
        }

        return completingMoves
    }

    /**
     * Get moves that don't give opponent a box
     */
    private getSafeMoves(
        gameState: GameState,
        moves: Array<{ type: 'horizontal' | 'vertical', row: number, col: number }>
    ): Array<{ type: 'horizontal' | 'vertical', row: number, col: number }> {
        return moves.filter(move => {
            // Check if this move would create a 3-sided box for opponent
            const adjacentBoxes = this.getAdjacentBoxes(gameState, move)

            for (const box of adjacentBoxes) {
                const sides = this.countBoxSides(gameState, box.row, box.col)
                // If box already has 2 sides, this move would give it 3 (dangerous)
                if (sides === 2) {
                    return false
                }
            }

            return true
        })
    }

    /**
     * Minimax algorithm with alpha-beta pruning
     */
    private minimaxMove(
        gameState: GameState,
        playerId: string,
        moves: Array<{ type: 'horizontal' | 'vertical', row: number, col: number }>
    ): Move | null {
        let bestMove: Move | null = null
        let bestScore = -Infinity

        for (const move of moves) {
            const simState = this.simulateMove(gameState, move, playerId)
            const score = this.minimax(simState, this.maxDepth - 1, -Infinity, Infinity, false, playerId)

            if (score > bestScore) {
                bestScore = score
                bestMove = {
                    playerId,
                    type: move.type,
                    row: move.row,
                    col: move.col,
                    boxesCompleted: this.countBoxesCompleted(gameState, move),
                    timestamp: Date.now(),
                }
            }
        }

        return bestMove
    }

    /**
     * Minimax recursive function
     */
    private minimax(
        gameState: GameState,
        depth: number,
        alpha: number,
        beta: number,
        isMaximizing: boolean,
        aiPlayerId: string
    ): number {
        if (depth === 0 || this.isGameOver(gameState)) {
            return this.evaluatePosition(gameState, aiPlayerId)
        }

        const moves = this.getAvailableMoves(gameState)

        if (isMaximizing) {
            let maxScore = -Infinity
            for (const move of moves) {
                const simState = this.simulateMove(gameState, move, aiPlayerId)
                const score = this.minimax(simState, depth - 1, alpha, beta, false, aiPlayerId)
                maxScore = Math.max(maxScore, score)
                alpha = Math.max(alpha, score)
                if (beta <= alpha) break // Alpha-beta pruning
            }
            return maxScore
        } else {
            let minScore = Infinity
            for (const move of moves) {
                const opponentId = this.getOpponentId(gameState, aiPlayerId)
                const simState = this.simulateMove(gameState, move, opponentId)
                const score = this.minimax(simState, depth - 1, alpha, beta, true, aiPlayerId)
                minScore = Math.min(minScore, score)
                beta = Math.min(beta, score)
                if (beta <= alpha) break // Alpha-beta pruning
            }
            return minScore
        }
    }

    /**
     * Evaluate board position
     */
    private evaluatePosition(gameState: GameState, aiPlayerId: string): number {
        const aiScore = gameState.scores[aiPlayerId] || 0
        const opponentScores = Object.entries(gameState.scores)
            .filter(([id]) => id !== aiPlayerId)
            .reduce((sum, [, score]) => sum + score, 0)

        return aiScore - opponentScores
    }

    /**
     * Count boxes completed by a move
     */
    private countBoxesCompleted(
        gameState: GameState,
        move: { type: 'horizontal' | 'vertical', row: number, col: number }
    ): number {
        const adjacentBoxes = this.getAdjacentBoxes(gameState, move)
        let count = 0

        for (const box of adjacentBoxes) {
            const sides = this.countBoxSides(gameState, box.row, box.col)
            if (sides === 3) count++ // This move would complete the box
        }

        return count
    }

    /**
     * Get boxes adjacent to a line
     */
    private getAdjacentBoxes(
        gameState: GameState,
        move: { type: 'horizontal' | 'vertical', row: number, col: number }
    ): Array<{ row: number, col: number }> {
        const boxes: Array<{ row: number, col: number }> = []

        if (move.type === 'horizontal') {
            // Box above
            if (move.row > 0) {
                boxes.push({ row: move.row - 1, col: move.col })
            }
            // Box below
            if (move.row < gameState.boxes.length) {
                boxes.push({ row: move.row, col: move.col })
            }
        } else {
            // Box to the left
            if (move.col > 0) {
                boxes.push({ row: move.row, col: move.col - 1 })
            }
            // Box to the right
            if (move.col < gameState.boxes[0].length) {
                boxes.push({ row: move.row, col: move.col })
            }
        }

        return boxes
    }

    /**
     * Count how many sides a box has
     */
    private countBoxSides(gameState: GameState, row: number, col: number): number {
        let count = 0

        if (gameState.horizontalLines[row][col].isDrawn) count++ // Top
        if (gameState.horizontalLines[row + 1][col].isDrawn) count++ // Bottom
        if (gameState.verticalLines[row][col].isDrawn) count++ // Left
        if (gameState.verticalLines[row][col + 1].isDrawn) count++ // Right

        return count
    }

    /**
     * Simulate a move on a copy of the game state
     */
    private simulateMove(
        gameState: GameState,
        move: { type: 'horizontal' | 'vertical', row: number, col: number },
        playerId: string
    ): GameState {
        // Deep clone game state
        const simState: GameState = JSON.parse(JSON.stringify(gameState))

        // Apply move
        if (move.type === 'horizontal') {
            simState.horizontalLines[move.row][move.col].isDrawn = true
            simState.horizontalLines[move.row][move.col].playerId = playerId
        } else {
            simState.verticalLines[move.row][move.col].isDrawn = true
            simState.verticalLines[move.row][move.col].playerId = playerId
        }

        // Update boxes
        const boxesCompleted = this.countBoxesCompleted(gameState, move)
        simState.scores[playerId] = (simState.scores[playerId] || 0) + boxesCompleted

        return simState
    }

    /**
     * Select best completing move (most boxes)
     */
    private selectBestCompletingMove(moves: MoveScore[]): Move {
        return moves.reduce((best, current) =>
            current.score > best.score ? current : best
        ).move
    }

    /**
     * Get random move
     */
    private getRandomMove(
        moves: Array<{ type: 'horizontal' | 'vertical', row: number, col: number }>,
        gameState: GameState,
        playerId: string
    ): Move {
        const randomMove = moves[Math.floor(Math.random() * moves.length)]
        return {
            playerId,
            type: randomMove.type,
            row: randomMove.row,
            col: randomMove.col,
            boxesCompleted: this.countBoxesCompleted(gameState, randomMove),
            timestamp: Date.now(),
        }
    }

    /**
     * Check if game is over
     */
    private isGameOver(gameState: GameState): boolean {
        return this.getAvailableMoves(gameState).length === 0
    }

    /**
     * Get opponent player ID
     */
    private getOpponentId(gameState: GameState, aiPlayerId: string): string {
        const opponent = gameState.players.find(p => p.id !== aiPlayerId && p.status === 'active')
        return opponent?.id || gameState.players[0].id
    }

    /**
     * Delay helper
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms))
    }

    /**
     * Set difficulty level
     */
    setDifficulty(difficulty: AIDifficulty): void {
        this.difficulty = difficulty

        switch (difficulty) {
            case 'easy':
                this.maxDepth = 1
                this.thinkingTimeMs = 500
                break
            case 'medium':
                this.maxDepth = 2
                this.thinkingTimeMs = 1000
                break
            case 'hard':
                this.maxDepth = 3
                this.thinkingTimeMs = 1500
                break
            case 'expert':
                this.maxDepth = 4
                this.thinkingTimeMs = 2000
                break
        }
    }
}
