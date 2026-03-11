"use client"

import { useEffect, useState, useRef } from "react"
import { type TicTacToeGame, TicTacToeManager, type Player as TicSymbol, type CellValue } from "@/utils/games/tic-tac-toe"
import { Button } from "@/components/ui/button"
import { Loader2, X, Circle, RotateCcw, Trophy, Clock, Pause, Play, Settings, Minimize2 } from "lucide-react"
import { PlaygroundSetupModal } from "../playground-setup-modal"
import { toast } from "sonner"
import { cn } from "@/utils/core/cn"
import type { GameConfig } from "../playground-setup-modal"

interface TicTacToeBoardProps {
    gameConfig: GameConfig
    roomId: string
    currentUserId: string
    onClose?: () => void
    onMinimize?: () => void
}

export function TicTacToeBoard({ gameConfig, roomId, currentUserId, onClose, onMinimize }: TicTacToeBoardProps) {
    const [game, setGame] = useState<TicTacToeGame | null>(null)
    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState(false)
    const [gameTime, setGameTime] = useState(0)
    const [isPaused, setIsPaused] = useState(false)
    const [showPauseMenu, setShowPauseMenu] = useState(false)
    const [showSettingsModal, setShowSettingsModal] = useState(false)

    const manager = TicTacToeManager.getInstance()
    const timerRef = useRef<NodeJS.Timeout | null>(null)
    const gameId = useRef(gameConfig.gameId || `ttt_${Date.now()}`).current

    // Sync session
    useEffect(() => {
        if (gameConfig.gameType === "single") {
            const initialGame: TicTacToeGame = {
                id: gameId,
                roomId,
                board: Array(9).fill(null),
                currentPlayer: "X",
                players: {
                    X: { id: currentUserId, name: gameConfig.players[0].name },
                    O: { id: "ai", name: gameConfig.players[1]?.name || "Computer" }
                },
                winner: null,
                status: "in_progress",
                moves: [],
                createdAt: Date.now(),
                updatedAt: Date.now(),
                rematches: []
            }
            setGame(initialGame)
            setLoading(false)
        } else {
            const isHostPlayer = gameConfig.players[0]?.id === currentUserId
            const unsubscribe = manager.listenForGameUpdates(roomId, gameId, (gameState) => {
                if (gameState) {
                    setGame(gameState)
                    setLoading(false)
                } else if (isHostPlayer) {
                    // Only HOST creates the game session in Firebase
                    manager.createGame(roomId, currentUserId, gameConfig.players[0].name, undefined, gameId).then(newGame => {
                        if (newGame) setGame(newGame)
                        setLoading(false)
                    })
                }
                // Guests stay in loading state until host creates the game
            })
            return () => unsubscribe()
        }
    }, [roomId, gameId, gameConfig.gameType])

    // Game Timer
    useEffect(() => {
        if (game?.status === "in_progress" && !isPaused) {
            timerRef.current = setInterval(() => setGameTime(prev => prev + 1), 1000)
        } else {
            if (timerRef.current) clearInterval(timerRef.current)
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current) }
    }, [game?.status, isPaused])

    // AI Move
    useEffect(() => {
        if (gameConfig.gameType === "single" && game?.status === "in_progress" && game.currentPlayer === "O" && !isPaused) {
            const timer = setTimeout(() => {
                const bestMove = TicTacToeManager.getBestMove(game.board, "O")
                if (bestMove !== -1) {
                    handleMove(bestMove, "O")
                }
            }, 1000)
            return () => clearTimeout(timer)
        }
    }, [game?.currentPlayer, game?.status, gameConfig.gameType, isPaused])

    const handleCellClick = async (index: number) => {
        if (!game || game.board[index] || game.status !== "in_progress" || processing || isPaused) return

        const mySymbol = game.players.X.id === currentUserId ? "X" : "O"
        if (game.currentPlayer !== mySymbol) return

        setProcessing(true)
        if (gameConfig.gameType === "single") {
            handleMove(index, mySymbol)
        } else {
            const result = await manager.makeMove(roomId, gameId, currentUserId, { position: index })
            if (!result.success && result.error) toast.error(result.error)
        }
        setProcessing(false)
    }

    const handleMove = (index: number, symbol: TicSymbol) => {
        setGame(prev => {
            if (!prev) return null
            const newBoard = [...prev.board]
            newBoard[index] = symbol

            const winner = checkWinner(newBoard)
            const isDraw = !winner && newBoard.every(c => c !== null)

            return {
                ...prev,
                board: newBoard,
                currentPlayer: symbol === "X" ? "O" : "X",
                status: (winner || isDraw) ? "finished" : "in_progress",
                winner: winner || (isDraw ? "draw" : null),
                updatedAt: Date.now()
            }
        })
    }

    const checkWinner = (board: CellValue[]): TicSymbol | null => {
        const wins = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]
        for (const [a, b, c] of wins) {
            if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a] as TicSymbol
        }
        return null
    }

    const handlePause = () => {
        setIsPaused(!isPaused)
        setShowPauseMenu(!isPaused)
    }

    const handleResume = () => {
        setIsPaused(false)
        setShowPauseMenu(false)
    }

    const handleRestart = () => {
        setGame(prev => {
            if (!prev) return null
            return {
                ...prev,
                board: Array(9).fill(null),
                currentPlayer: "X",
                winner: null,
                status: "in_progress",
                moves: [],
                updatedAt: Date.now()
            }
        })
        setGameTime(0)
        setIsPaused(false)
        setShowPauseMenu(false)
    }

    const handleSettings = () => {
        setShowSettingsModal(true)
    }

    const handleExitGame = () => {
        if (onClose) onClose()
    }

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
    }

    if (loading) return <div className="flex items-center justify-center p-20 text-white"><Loader2 className="animate-spin mr-2" /> Loading Tic Tac Toe...</div>
    if (!game) return <div className="flex items-center justify-center p-20 text-slate-400">Game not found or failed to initialize.</div>

    const isMyTurn = game.currentPlayer === (game.players.X.id === currentUserId ? "X" : "O")

    return (
        <div className="flex flex-col items-center gap-6 p-6 bg-slate-900/90 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl max-w-sm w-full mx-auto relative overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center w-full">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-purple-500/20 to-cyan-500/20 rounded-xl border border-white/10">
                        <Trophy className="w-5 h-5 text-yellow-500" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white tracking-tight">Tic Tac Toe</h2>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <Clock className="w-3.5 h-3.5" />
                            <span className="font-mono text-cyan-400/80">{formatTime(gameTime)}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8 rounded-full bg-slate-700 hover:bg-slate-600 text-white"
                        onClick={handlePause}
                    >
                        {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    </Button>
                    {onMinimize && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="w-8 h-8 rounded-full bg-slate-700 hover:bg-slate-600 text-white"
                            onClick={onMinimize}
                        >
                            <Minimize2 className="w-4 h-4" />
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8 rounded-full bg-slate-700 hover:bg-slate-600 text-white"
                        onClick={handleSettings}
                    >
                        <Settings className="w-4 h-4" />
                    </Button>
                    {onClose && (
                        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-white/10 text-slate-400">
                            <X className="w-5 h-5" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Players */}
            <div className="flex justify-between w-full items-center px-4 py-3 bg-white/5 rounded-2xl">
                <PlayerInfo name={game.players.X.name || "X"} symbol="X" active={game.currentPlayer === "X" && game.status === "in_progress"} color="text-cyan-400" />
                <div className="text-slate-600 font-bold italic">VS</div>
                <PlayerInfo name={game.players.O.name || "O"} symbol="O" active={game.currentPlayer === "O" && game.status === "in_progress"} color="text-pink-400" />
            </div>

            {/* Board */}
            <div className="grid grid-cols-3 gap-3 bg-slate-800/50 p-3 rounded-2xl relative">
                {game.board.map((cell, i) => (
                    <button
                        key={i}
                        onClick={() => handleCellClick(i)}
                        disabled={!!cell || game.status !== "in_progress" || processing || isPaused}
                        className={cn(
                            "w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center rounded-xl text-4xl transition-all duration-300",
                            cell === "X" ? "bg-cyan-500/10 text-cyan-400 shadow-[inset_0_0_20px_rgba(6,182,212,0.1)]" :
                                cell === "O" ? "bg-pink-500/10 text-pink-400 shadow-[inset_0_0_20px_rgba(236,72,153,0.1)]" :
                                    "bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600/30",
                            isMyTurn && !cell && !isPaused && "hover:scale-105 active:scale-95 cursor-pointer ring-cyan-500/30 hover:ring-4",
                            (!isMyTurn || cell || isPaused) && "cursor-default opacity-90"
                        )}
                    >
                        {cell === "X" && <X className="w-12 h-12 animate-in zoom-in duration-300" strokeWidth={2.5} />}
                        {cell === "O" && <Circle className="w-10 h-10 animate-in zoom-in duration-300" strokeWidth={3} />}
                    </button>
                ))}

                {/* Overlays */}
                {isPaused && (
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center rounded-2xl z-30">
                        <div className="text-center">
                            <Pause className="w-12 h-12 text-white mx-auto mb-2 animate-pulse" />
                            <p className="text-white font-bold tracking-widest uppercase text-xs">Game Paused</p>
                        </div>
                    </div>
                )}

                {game.status === "finished" && (
                    <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md flex flex-col items-center justify-center rounded-2xl animate-in fade-in zoom-in duration-300 border border-white/10 shadow-2xl z-40">
                        <Trophy className="w-12 h-12 text-yellow-400 mb-2 animate-bounce" />
                        <h3 className="text-2xl font-bold text-white mb-1">
                            {game.winner === "draw" ? "It's a Draw!" :
                                game.winner ? (game.winner === "X" ? game.players.X.name : game.players.O.name) + " Wins!" :
                                    "Game Over"}
                        </h3>
                        <div className="flex flex-col gap-3 w-48 mt-4">
                            <Button onClick={handleRestart} className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-full font-bold transition-all flex items-center justify-center gap-2 h-11">
                                <RotateCcw className="w-4 h-4" /> Play Again
                            </Button>
                            <Button onClick={handleExitGame} className="bg-white text-slate-900 hover:bg-slate-200 rounded-full font-bold transition-all h-11">
                                Main Menu
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Turn Status */}
            <div className="text-center h-4">
                {game.status === "in_progress" && (
                    <p className={cn("text-sm font-medium animate-pulse", isMyTurn ? "text-cyan-400" : "text-slate-500")}>
                        {isMyTurn ? "Your Turn" : `Waiting for ${game.currentPlayer === "X" ? game.players.X.name : game.players.O.name}...`}
                    </p>
                )}
            </div>

            {/* Pause Menu Overlay */}
            {showPauseMenu && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] animate-in fade-in duration-300">
                    <div className="bg-slate-800 rounded-3xl p-6 w-full max-w-xs mx-4 border border-white/10 shadow-2xl">
                        <h2 className="text-xl font-black text-center mb-6 text-white uppercase tracking-tight">Game Paused</h2>
                        <div className="space-y-3">
                            <Button onClick={handleResume} className="w-full bg-cyan-500 hover:bg-cyan-600 text-white h-12 rounded-xl flex items-center justify-center gap-2 font-bold shadow-lg">
                                <Play className="w-4 h-4" /> Resume Game
                            </Button>
                            <Button onClick={handleRestart} className="w-full bg-amber-500 hover:bg-amber-600 text-white h-12 rounded-xl flex items-center justify-center gap-2 font-bold shadow-lg">
                                <RotateCcw className="w-4 h-4" /> Restart Game
                            </Button>
                            <Button onClick={handleSettings} className="w-full bg-slate-700 hover:bg-slate-600 text-white h-12 rounded-xl flex items-center justify-center gap-2 font-bold shadow-lg">
                                <Settings className="w-4 h-4" /> Game Settings
                            </Button>
                            <Button onClick={handleExitGame} className="w-full bg-red-500 hover:bg-red-600 text-white h-12 rounded-xl flex items-center justify-center gap-2 font-bold shadow-lg">
                                <X className="w-4 h-4" /> Exit Game
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Modal */}
            {showSettingsModal && (
                <PlaygroundSetupModal
                    isOpen={showSettingsModal}
                    onClose={() => setShowSettingsModal(false)}
                    onStartGame={(newConfig) => {
                        setShowSettingsModal(false)
                        handleRestart()
                    }}
                    initialGame="tictactoe"
                    hostName={game.players.X.id === currentUserId ? game.players.X.name : game.players.O.name}
                    currentUserId={currentUserId}
                />
            )}
        </div>
    )
}

function PlayerInfo({ name, symbol, active, color }: { name: string, symbol: string, active: boolean, color: string }) {
    return (
        <div className={cn(
            "flex flex-col items-center p-3 rounded-2xl transition-all duration-500 min-w-[100px]",
            active ? "bg-slate-800 shadow-lg ring-1 ring-white/10 scale-105" : "opacity-40 grayscale-[0.5]"
        )}>
            <div className={cn("text-2xl font-black mb-1", color)}>{symbol}</div>
            <div className="text-xs font-semibold text-slate-200 truncate w-full text-center">{name}</div>
            {active && <div className={cn("mt-1 w-1.5 h-1.5 rounded-full animate-ping", symbol === "X" ? "bg-cyan-400" : "bg-pink-400")} />}
        </div>
    )
}
