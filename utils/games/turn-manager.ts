import type { Player, GameState } from "./dots-and-boxes-game"

/**
 * Turn Manager for 12-player Dots and Boxes
 * Handles turn rotation, skipping disconnected players, and turn timeouts
 */
export class TurnManager {
    private currentPlayerIndex: number = 0
    private turnStartTime: number = 0
    private turnTimeoutMs: number = 30000 // 30 seconds per turn
    private turnHistory: Array<{ playerId: string; timestamp: number }> = []

    constructor(
        private players: Player[],
        private onTurnTimeout?: (playerId: string) => void
    ) {
        this.currentPlayerIndex = 0
        this.turnStartTime = Date.now()
    }

    /**
     * Get the current active player
     */
    getCurrentPlayer(): Player {
        return this.players[this.currentPlayerIndex]
    }

    /**
     * Get the current player index
     */
    getCurrentPlayerIndex(): number {
        return this.currentPlayerIndex
    }

    /**
     * Get time remaining for current turn (in seconds)
     */
    getTimeRemaining(): number {
        const elapsed = Date.now() - this.turnStartTime
        const remaining = Math.max(0, this.turnTimeoutMs - elapsed)
        return Math.floor(remaining / 1000)
    }

    /**
     * Check if current turn has timed out
     */
    hasTimedOut(): boolean {
        return Date.now() - this.turnStartTime > this.turnTimeoutMs
    }

    /**
     * Move to the next player's turn
     * Automatically skips disconnected players
     */
    nextTurn(): Player {
        const startIndex = this.currentPlayerIndex
        let attempts = 0
        const maxAttempts = this.players.length

        do {
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length
            attempts++

            // Prevent infinite loop if all players are disconnected
            if (attempts >= maxAttempts) {
                console.warn("All players are disconnected!")
                break
            }
        } while (
            this.players[this.currentPlayerIndex].status === 'disconnected' &&
            this.currentPlayerIndex !== startIndex
        )

        const currentPlayer = this.getCurrentPlayer()
        this.turnStartTime = Date.now()

        // Record turn in history
        this.turnHistory.push({
            playerId: currentPlayer.id,
            timestamp: Date.now(),
        })

        return currentPlayer
    }

    /**
     * Skip current player's turn (for timeout or disconnection)
     */
    skipTurn(): Player {
        const currentPlayer = this.getCurrentPlayer()

        if (this.onTurnTimeout) {
            this.onTurnTimeout(currentPlayer.id)
        }

        return this.nextTurn()
    }

    /**
     * Set a specific player as current (for rejoining)
     */
    setCurrentPlayer(playerId: string): boolean {
        const playerIndex = this.players.findIndex(p => p.id === playerId)

        if (playerIndex === -1) return false

        this.currentPlayerIndex = playerIndex
        this.turnStartTime = Date.now()
        return true
    }

    /**
     * Update players list (when players join/leave)
     */
    updatePlayers(players: Player[]): void {
        const currentPlayerId = this.getCurrentPlayer().id
        this.players = players

        // Try to maintain current player
        const newIndex = players.findIndex(p => p.id === currentPlayerId)
        if (newIndex !== -1) {
            this.currentPlayerIndex = newIndex
        } else {
            // Current player left, move to next
            this.currentPlayerIndex = Math.min(this.currentPlayerIndex, players.length - 1)
            this.turnStartTime = Date.now()
        }
    }

    /**
     * Get turn statistics
     */
    getTurnStats(): {
        totalTurns: number
        averageTurnTime: number
        playerTurnCounts: Record<string, number>
    } {
        const playerTurnCounts: Record<string, number> = {}
        let totalTurnTime = 0

        this.turnHistory.forEach((turn, index) => {
            playerTurnCounts[turn.playerId] = (playerTurnCounts[turn.playerId] || 0) + 1

            if (index > 0) {
                totalTurnTime += turn.timestamp - this.turnHistory[index - 1].timestamp
            }
        })

        return {
            totalTurns: this.turnHistory.length,
            averageTurnTime: this.turnHistory.length > 1
                ? totalTurnTime / (this.turnHistory.length - 1)
                : 0,
            playerTurnCounts,
        }
    }

    /**
     * Get next N players in turn order
     */
    getUpcomingPlayers(count: number = 3): Player[] {
        const upcoming: Player[] = []
        let index = this.currentPlayerIndex

        for (let i = 0; i < Math.min(count, this.players.length); i++) {
            index = (index + 1) % this.players.length

            // Skip disconnected players
            if (this.players[index].status !== 'disconnected') {
                upcoming.push(this.players[index])
            }
        }

        return upcoming
    }

    /**
     * Check if a player is currently active
     */
    isPlayerTurn(playerId: string): boolean {
        return this.getCurrentPlayer().id === playerId
    }

    /**
     * Reset turn timer
     */
    resetTimer(): void {
        this.turnStartTime = Date.now()
    }

    /**
     * Set turn timeout duration
     */
    setTurnTimeout(timeoutMs: number): void {
        this.turnTimeoutMs = timeoutMs
    }

    /**
     * Get turn order (all players in sequence)
     */
    getTurnOrder(): Player[] {
        const order: Player[] = []
        let index = this.currentPlayerIndex

        for (let i = 0; i < this.players.length; i++) {
            order.push(this.players[index])
            index = (index + 1) % this.players.length
        }

        return order
    }
}

/**
 * Create turn manager from game state
 */
export function createTurnManager(
    gameState: GameState,
    onTurnTimeout?: (playerId: string) => void
): TurnManager {
    const manager = new TurnManager(gameState.players, onTurnTimeout)

    // Set to current player from game state
    if (gameState.currentPlayerIndex >= 0) {
        const currentPlayer = gameState.players[gameState.currentPlayerIndex]
        if (currentPlayer) {
            manager.setCurrentPlayer(currentPlayer.id)
        }
    }

    return manager
}
