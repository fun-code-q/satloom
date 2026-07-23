/**
 * Pure rule adapter for Connect Four — Phase 14 / A2.
 *
 * Same pattern as `tic-tac-toe-rules.ts` — extracts the validation +
 * state-transition logic into a pure function the distributed-referee
 * runs against move proposals.
 *
 * Gravity is enforced here: a proposal carries only a column index;
 * the rules figure out which row the piece lands in. A cheating
 * client can't claim a piece floats mid-air.
 */

import type { GameRules, MoveProposal } from "./referee"
import type { ConnectFourGame, ConnectFourMove, ConnectFourPlayer, ConnectFourCell } from "./connect-four"

const ROWS = 6
const COLS = 7

function checkWinner(board: ConnectFourCell[][]): ConnectFourPlayer | "draw" | null {
    const dirs = [
        [0, 1], // horizontal
        [1, 0], // vertical
        [1, 1], // diag down-right
        [1, -1], // diag down-left
    ]
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = board[r][c]
            if (!cell) continue
            for (const [dr, dc] of dirs) {
                let count = 1
                for (let k = 1; k < 4; k++) {
                    const nr = r + dr * k
                    const nc = c + dc * k
                    if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) break
                    if (board[nr][nc] !== cell) break
                    count++
                }
                if (count >= 4) return cell as ConnectFourPlayer
            }
        }
    }
    if (board.every((row) => row.every((cell) => cell !== null))) return "draw"
    return null
}

function dropPosition(board: ConnectFourCell[][], col: number): number | null {
    for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r][col] === null) return r
    }
    return null
}

export const connectFourRules: GameRules<ConnectFourGame, ConnectFourMove> = {
    validate(state, proposal: MoveProposal<ConnectFourMove>) {
        if (state.status !== "in_progress") {
            return { ok: false, reason: "Game is not in progress" }
        }
        const proposingUid = proposal.playerUid
        const playerColor: ConnectFourPlayer | null =
            state.players.red.id === proposingUid
                ? "red"
                : state.players.yellow.id === proposingUid
                    ? "yellow"
                    : null

        if (!playerColor) return { ok: false, reason: "Not a player in this game" }
        if (playerColor !== state.currentPlayer) return { ok: false, reason: "Not your turn" }

        const col = proposal.payload.column
        if (typeof col !== "number" || col < 0 || col >= COLS || !Number.isInteger(col)) {
            return { ok: false, reason: "Invalid column" }
        }

        const row = dropPosition(state.board, col)
        if (row === null) {
            return { ok: false, reason: "Column is full" }
        }

        // Apply gravity in a fresh board copy so the validator stays pure.
        const nextBoard: ConnectFourCell[][] = state.board.map((r) => [...r])
        nextBoard[row][col] = playerColor

        const winnerOrDraw = checkWinner(nextBoard)
        const next: ConnectFourGame = {
            ...state,
            board: nextBoard,
            moves: [
                ...state.moves,
                { player: playerColor, column: col, timestamp: proposal.timestamp },
            ],
            winner: winnerOrDraw,
            status: winnerOrDraw ? "finished" : state.status,
            currentPlayer: winnerOrDraw
                ? state.currentPlayer
                : (playerColor === "red" ? "yellow" : "red"),
            updatedAt: proposal.timestamp,
        }
        return { ok: true, next }
    },
}
