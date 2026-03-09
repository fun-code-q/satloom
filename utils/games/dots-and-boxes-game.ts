// Game Constants
export const MAX_PLAYERS = 12
export const MIN_PLAYERS = 2
export const REJOIN_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

export interface Player {
  id: string
  name: string
  initials: string
  color: string
  avatar?: string
  isComputer: boolean
  isHost: boolean
  status: 'active' | 'spectator' | 'disconnected'
  isReady: boolean
  joinedAt: number
  lastSeen: number
}

export interface Line {
  isDrawn: boolean
  playerId: string | null
}

export interface Box {
  isCompleted: boolean
  playerId: string | null
}

export interface Move {
  playerId: string
  type: "horizontal" | "vertical"
  row: number
  col: number
  boxesCompleted: number
  timestamp: number
}

export interface GameState {
  id: string
  roomId: string
  players: Player[]
  currentPlayerIndex: number
  horizontalLines: Line[][]
  verticalLines: Line[][]
  boxes: Box[][]
  scores: Record<string, number>
  gameStatus: "waiting" | "playing" | "finished"
  winner: string | null
  lastMove: Move | null
  moveCount: number
  grid: {
    rows: number
    cols: number
  }
}

export class DotsAndBoxesGame {
  private gameState: GameState
  private gridSize: number

  constructor(gameId: string, roomId: string, players: Player[], gridSize = 5, voiceChatEnabled = false) {
    this.gridSize = gridSize

    // Initialize horizontal lines
    const horizontalLines: Line[][] = []
    for (let row = 0; row <= gridSize; row++) {
      horizontalLines[row] = []
      for (let col = 0; col < gridSize; col++) {
        horizontalLines[row][col] = {
          isDrawn: false,
          playerId: null,
        }
      }
    }

    // Initialize vertical lines
    const verticalLines: Line[][] = []
    for (let row = 0; row < gridSize; row++) {
      verticalLines[row] = []
      for (let col = 0; col <= gridSize; col++) {
        verticalLines[row][col] = {
          isDrawn: false,
          playerId: null,
        }
      }
    }

    // Initialize boxes
    const boxes: Box[][] = []
    for (let row = 0; row < gridSize; row++) {
      boxes[row] = []
      for (let col = 0; col < gridSize; col++) {
        boxes[row][col] = {
          isCompleted: false,
          playerId: null,
        }
      }
    }

    // Initialize scores
    const scores: Record<string, number> = {}
    players.forEach((player) => {
      scores[player.id] = 0
    })

    this.gameState = {
      id: gameId,
      roomId,
      players,
      currentPlayerIndex: 0,
      horizontalLines,
      verticalLines,
      boxes,
      scores,
      gameStatus: "waiting",
      winner: null,
      lastMove: null,
      moveCount: 0,
      grid: {
        rows: gridSize,
        cols: gridSize,
      },
    }
  }

  startGame(): void {
    this.gameState.gameStatus = "playing"
    this.gameState.currentPlayerIndex = 0
    this.gameState.winner = null
    this.gameState.lastMove = null
    this.gameState.moveCount = 0

    // Reset scores
    this.gameState.players.forEach((player) => {
      this.gameState.scores[player.id] = 0
    })

    // Reset lines
    for (let row = 0; row <= this.gridSize; row++) {
      for (let col = 0; col < this.gridSize; col++) {
        this.gameState.horizontalLines[row][col] = {
          isDrawn: false,
          playerId: null,
        }
      }
    }

    for (let row = 0; row < this.gridSize; row++) {
      for (let col = 0; col <= this.gridSize; col++) {
        this.gameState.verticalLines[row][col] = {
          isDrawn: false,
          playerId: null,
        }
      }
    }

    // Reset boxes
    for (let row = 0; row < this.gridSize; row++) {
      for (let col = 0; col < this.gridSize; col++) {
        this.gameState.boxes[row][col] = {
          isCompleted: false,
          playerId: null,
        }
      }
    }
  }

  makeMove(playerId: string, lineType: "horizontal" | "vertical", row: number, col: number): boolean {
    // Check if game is playing
    if (this.gameState.gameStatus !== "playing") {
      return false
    }

    // Check if it's the player's turn
    const currentPlayer = this.gameState.players[this.gameState.currentPlayerIndex]
    if (currentPlayer.id !== playerId) {
      return false
    }

    // Check if the line is already drawn
    if (
      (lineType === "horizontal" && this.gameState.horizontalLines[row][col].isDrawn) ||
      (lineType === "vertical" && this.gameState.verticalLines[row][col].isDrawn)
    ) {
      return false
    }

    // Draw the line
    if (lineType === "horizontal") {
      this.gameState.horizontalLines[row][col] = {
        isDrawn: true,
        playerId,
      }
    } else {
      this.gameState.verticalLines[row][col] = {
        isDrawn: true,
        playerId,
      }
    }

    // Check if any boxes are completed
    let boxesCompleted = 0
    if (lineType === "horizontal") {
      // Check box above
      if (row > 0) {
        const boxRow = row - 1
        const boxCol = col
        if (this.isBoxCompleted(boxRow, boxCol)) {
          this.gameState.boxes[boxRow][boxCol] = {
            isCompleted: true,
            playerId,
          }
          this.gameState.scores[playerId] = (this.gameState.scores[playerId] || 0) + 1
          boxesCompleted++
        }
      }

      // Check box below
      if (row < this.gridSize) {
        const boxRow = row
        const boxCol = col
        if (this.isBoxCompleted(boxRow, boxCol)) {
          this.gameState.boxes[boxRow][boxCol] = {
            isCompleted: true,
            playerId,
          }
          this.gameState.scores[playerId] = (this.gameState.scores[playerId] || 0) + 1
          boxesCompleted++
        }
      }
    } else {
      // Check box to the left
      if (col > 0) {
        const boxRow = row
        const boxCol = col - 1
        if (this.isBoxCompleted(boxRow, boxCol)) {
          this.gameState.boxes[boxRow][boxCol] = {
            isCompleted: true,
            playerId,
          }
          this.gameState.scores[playerId] = (this.gameState.scores[playerId] || 0) + 1
          boxesCompleted++
        }
      }

      // Check box to the right
      if (col < this.gridSize) {
        const boxRow = row
        const boxCol = col
        if (this.isBoxCompleted(boxRow, boxCol)) {
          this.gameState.boxes[boxRow][boxCol] = {
            isCompleted: true,
            playerId,
          }
          this.gameState.scores[playerId] = (this.gameState.scores[playerId] || 0) + 1
          boxesCompleted++
        }
      }
    }

    // Record the move
    this.gameState.lastMove = {
      playerId,
      type: lineType,
      row,
      col,
      boxesCompleted,
      timestamp: Date.now(),
    }

    // Increment move count
    this.gameState.moveCount++

    // Check if the game is finished
    const totalBoxes = this.gridSize * this.gridSize
    const completedBoxes = this.countCompletedBoxes()
    if (completedBoxes === totalBoxes) {
      this.gameState.gameStatus = "finished"
      this.gameState.winner = this.determineWinner()
    }

    // If no boxes were completed, move to the next player
    if (boxesCompleted === 0) {
      this.gameState.currentPlayerIndex = (this.gameState.currentPlayerIndex + 1) % this.gameState.players.length
    }

    return true
  }

  makeComputerMove(): boolean {
    // Check if game is playing
    if (this.gameState.gameStatus !== "playing") {
      return false
    }

    // Check if it's a computer player's turn
    const currentPlayer = this.gameState.players[this.gameState.currentPlayerIndex]
    if (!currentPlayer.isComputer) {
      return false
    }

    // Find all available moves
    const availableMoves: { type: "horizontal" | "vertical"; row: number; col: number }[] = []

    // Check horizontal lines
    for (let row = 0; row <= this.gridSize; row++) {
      for (let col = 0; col < this.gridSize; col++) {
        if (!this.gameState.horizontalLines[row][col].isDrawn) {
          availableMoves.push({ type: "horizontal", row, col })
        }
      }
    }

    // Check vertical lines
    for (let row = 0; row < this.gridSize; row++) {
      for (let col = 0; col <= this.gridSize; col++) {
        if (!this.gameState.verticalLines[row][col].isDrawn) {
          availableMoves.push({ type: "vertical", row, col })
        }
      }
    }

    if (availableMoves.length === 0) {
      return false
    }

    // Choose a random move
    const randomIndex = Math.floor(Math.random() * availableMoves.length)
    const move = availableMoves[randomIndex]

    // Make the move
    return this.makeMove(currentPlayer.id, move.type, move.row, move.col)
  }

  private isBoxCompleted(row: number, col: number): boolean {
    // Check if all four sides of the box are drawn
    return (
      this.gameState.horizontalLines[row][col].isDrawn &&
      this.gameState.horizontalLines[row + 1][col].isDrawn &&
      this.gameState.verticalLines[row][col].isDrawn &&
      this.gameState.verticalLines[row][col + 1].isDrawn &&
      !this.gameState.boxes[row][col].isCompleted
    )
  }

  private countCompletedBoxes(): number {
    let count = 0
    for (let row = 0; row < this.gridSize; row++) {
      for (let col = 0; col < this.gridSize; col++) {
        if (this.gameState.boxes[row][col].isCompleted) {
          count++
        }
      }
    }
    return count
  }

  private determineWinner(): string | null {
    let maxScore = -1
    let winnerId: string | null = null
    let isTie = false

    // Find the player with the highest score
    for (const player of this.gameState.players) {
      const score = this.gameState.scores[player.id] || 0
      if (score > maxScore) {
        maxScore = score
        winnerId = player.id
        isTie = false
      } else if (score === maxScore) {
        isTie = true
      }
    }

    return isTie ? null : winnerId
  }

  getGameState(): GameState {
    return { ...this.gameState }
  }

  // Update the game state from an external source (e.g., Firebase)
  updateGameState(newState: GameState): void {
    // Update only the game state properties, not the methods
    this.gameState = {
      ...newState,
      // Ensure we keep the same game ID and room ID
      id: this.gameState.id,
      roomId: this.gameState.roomId,
    }
  }
}
