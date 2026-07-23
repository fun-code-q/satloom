/**
 * Pure rule adapter for Tic-Tac-Toe — Phase 14 / A2.
 *
 * Exports a `GameRules<TicTacToeGame, TicTacToeMove>` implementation
 * that the distributed-referee uses to validate move proposals. Every
 * client (whether they're the referee or not) imports this for
 * speculative local checks, but ONLY the elected referee's validation
 * result lands in Firebase.
 *
 * The validation logic here is the same as the pre-Phase-14
 * `TicTacToeManager.makeMove` — extracted into a pure function so it
 * can be reused on both sides of the referee protocol.
 */

import type { GameRules, MoveProposal } from "./referee"
import type { TicTacToeGame, TicTacToeMove, Player, CellValue } from "./tic-tac-toe"

const WINNING_LINES: ReadonlyArray<readonly [number, number, number]> = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
]

function checkWinner(board: CellValue[]): Player | "draw" | null {
    for (const [a, b, c] of WINNING_LINES) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a] as Player
        }
    }
    if (board.every((cell) => cell !== null)) return "draw"
    return null
}

export const ticTacToeRules: GameRules<TicTacToeGame, TicTacToeMove> = {
    validate(state, proposal: MoveProposal<TicTacToeMove>) {
        if (state.status !== "in_progress") {
            return { ok: false, reason: "Game is not in progress" }
        }

        const proposingUid = proposal.playerUid
        const playerSymbol: Player | null =
            state.players.X.id === proposingUid
                ? "X"
                : state.players.O.id === proposingUid
                    ? "O"
                    : null

        if (!playerSymbol) {
            return { ok: false, reason: "Not a player in this game" }
        }
        if (playerSymbol !== state.currentPlayer) {
            return { ok: false, reason: "Not your turn" }
        }

        const pos = proposal.payload.position
        if (typeof pos !== "number" || pos < 0 || pos > 8 || !Number.isInteger(pos)) {
            return { ok: false, reason: "Invalid position" }
        }
        if (state.board[pos] !== null) {
            return { ok: false, reason: "Cell already occupied" }
        }

        // Build the new state.
        const nextBoard = [...state.board]
        nextBoard[pos] = playerSymbol

        const winnerOrDraw = checkWinner(nextBoard)
        const next: TicTacToeGame = {
            ...state,
            board: nextBoard,
            moves: [
                ...state.moves,
                { player: playerSymbol, position: pos, timestamp: proposal.timestamp },
            ],
            winner: winnerOrDraw,
            status: winnerOrDraw ? "finished" : state.status,
            currentPlayer: winnerOrDraw ? state.currentPlayer : (playerSymbol === "X" ? "O" : "X"),
            updatedAt: proposal.timestamp,
        }
        return { ok: true, next }
    },
}
