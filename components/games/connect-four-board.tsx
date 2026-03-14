"use client"

import { useEffect, useState, useRef } from "react"
import { type ConnectFourGame, ConnectFourManager, type ConnectFourPlayer, type ConnectFourCell } from "@/utils/games/connect-four"
import { Button } from "@/components/ui/button"
import { Loader2, X, RotateCcw, Trophy, Clock, ChevronDown, Pause, Play, Settings, Minimize2 } from "lucide-react"
import { PlaygroundSetupModal } from "../playground-setup-modal"
import { toast } from "sonner"
import { cn } from "@/utils/core/cn"
import type { GameConfig } from "../playground-setup-modal"

interface ConnectFourBoardProps {
    gameConfig: GameConfig
    roomId: string
    currentUserId: string
    onClose?: () => void
    onMinimize?: () => void
}

export function ConnectFourBoard({ gameConfig, roomId, currentUserId, onClose, onMinimize }: ConnectFourBoardProps) {
    const [game, setGame] = useState<ConnectFourGame | null>(null)
    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState(false)
    const [gameTime, setGameTime] = useState(0)
    const [hoverColumn, setHoverColumn] = useState<number | null>(null)
    const [isPaused, setIsPaused] = useState(false)
    const [showPauseMenu, setShowPauseMenu] = useState(false)
    const [showSettingsModal, setShowSettingsModal] = useState(false)

    const manager = ConnectFourManager.getInstance()
    const timerRef = useRef<NodeJS.Timeout | null>(null)
    const gameId = useRef(gameConfig.gameId || `c4_${Date.now()}`).current
    const joinRequestedRef = useRef(false)
    const lastFeedbackRef = useRef(0)

    // Sync session
    useEffect(() => {
        if (gameConfig.gameType === "single") {
            const initialGame: ConnectFourGame = {
                id: gameId,
                roomId,
                board: Array(6).fill(null).map(() => Array(7).fill(null)),
                currentPlayer: "red",
                players: {
                    red: { id: currentUserId, name: gameConfig.players[0].name },
                    yellow: { id: "ai", name: gameConfig.players[1]?.name || "Computer" }
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
            joinRequestedRef.current = false
            const isHostPlayer = gameConfig.players[0]?.id === currentUserId
            const unsubscribe = manager.listenForGameUpdates(roomId, gameId, (gameState) => {
                if (gameState) {
                    // redundant safety check
                    if (!gameState.board || !Array.isArray(gameState.board)) {
                        gameState.board = Array(6).fill(null).map(() => Array(7).fill(null))
                    }
                    if (!gameState.moves || !Array.isArray(gameState.moves)) {
                        gameState.moves = []
                    }
                    if (!gameState.rematches || !Array.isArray(gameState.rematches)) {
                        gameState.rematches = []
                    }
                    setGame(gameState)
                    setLoading(false)

                    // If I am not the host and the guest slot is open, join now
                    const hostId = gameState.players?.red?.id
                    const guestId = gameState.players?.yellow?.id
                    const isHost = hostId === currentUserId
                    if (!isHost && (!guestId || guestId === "") && gameState.status === "waiting" && !joinRequestedRef.current) {
                        joinRequestedRef.current = true
                        const guestName = gameConfig.players?.[1]?.name || "Guest"
                        manager.joinGame(roomId, gameId, currentUserId, guestName).then((success) => {
                            if (!success) joinRequestedRef.current = false
                        })
                    }
                } else if (isHostPlayer) {
                    // Only HOST creates the game session in Firebase
                    const hostName = gameConfig.players?.[0]?.name || "Host"
                    manager.createGame(roomId, currentUserId, hostName, undefined, gameId).then(newGame => {
                        if (newGame) setGame(newGame)
                        setLoading(false)
                    })
                }
                // Guests stay in loading state until host creates the game
            })
            return () => unsubscribe()
        }
    }, [roomId, gameId, gameConfig.gameType, currentUserId, gameConfig.players])

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
        if (gameConfig.gameType === "single" && game?.status === "in_progress" && game.currentPlayer === "yellow" && !isPaused) {
            const timer = setTimeout(() => {
                const bestCol = ConnectFourManager.getBestMove(game.board, "yellow")
                if (bestCol !== -1) {
                    handleMove(bestCol, "yellow")
                }
            }, 1000)
            return () => clearTimeout(timer)
        }
    }, [game?.currentPlayer, game?.status, gameConfig.gameType, isPaused])

    const showFeedback = (message: string, type: "info" | "error" = "info") => {
        const now = Date.now()
        if (now - lastFeedbackRef.current < 1200) return
        lastFeedbackRef.current = now
        if (type === "error") toast.error(message)
        else toast(message)
    }

    const handleColumnClick = async (colIndex: number) => {
        if (!game || !game.board?.[0] || processing || isPaused) return
        if (game.status !== "in_progress") {
            showFeedback(game.status === "waiting" ? "Waiting for opponent to join." : "Game is not active.")
            return
        }
        if (game.board[0][colIndex]) {
            showFeedback("That column is full.")
            return
        }

        const isPlayer = game.players.red.id === currentUserId || game.players.yellow.id === currentUserId
        if (!isPlayer) {
            showFeedback("You're not registered as a player in this game. Try rejoining or start a new game.", "error")
            return
        }

        const myColor = game.players.red.id === currentUserId ? "red" : "yellow"
        if (game.currentPlayer !== myColor) {
            showFeedback("Not your turn yet.")
            return
        }

        setProcessing(true)
        try {
            if (gameConfig.gameType === "single") {
                handleMove(colIndex, myColor)
            } else {
                const result = await manager.makeMove(roomId, gameId, currentUserId, { column: colIndex })
                if (!result.success && result.error) toast.error(result.error)
            }
        } finally {
            setProcessing(false)
        }
    }

    const handleMove = (col: number, color: ConnectFourPlayer) => {
        setGame(prev => {
            if (!prev) return null
            const newBoard = prev.board.map(row => [...row])

            let row = -1
            for (let r = 5; r >= 0; r--) {
                if (newBoard[r][col] === null) {
                    row = r
                    break
                }
            }
            if (row === -1) return prev

            newBoard[row][col] = color

            const winner = checkWinner(newBoard)
            const isDraw = !winner && newBoard[0].every(c => c !== null)

            return {
                ...prev,
                board: newBoard,
                currentPlayer: color === "red" ? "yellow" : "red",
                status: (winner || isDraw) ? "finished" : "in_progress",
                winner: winner || (isDraw ? "draw" : null),
                updatedAt: Date.now()
            }
        })
    }

    const checkWinner = (board: ConnectFourCell[][]): ConnectFourPlayer | null => {
        for (let r = 0; r < 6; r++) {
            for (let c = 0; c <= 3; c++) {
                if (board[r][c] && board[r][c] === board[r][c + 1] && board[r][c] === board[r][c + 2] && board[r][c] === board[r][c + 3]) return board[r][c]
            }
        }
        for (let r = 0; r <= 2; r++) {
            for (let c = 0; c < 7; c++) {
                if (board[r][c] && board[r][c] === board[r + 1][c] && board[r][c] === board[r + 2][c] && board[r][c] === board[r + 3][c]) return board[r][c]
            }
        }
        for (let r = 0; r <= 2; r++) {
            for (let c = 0; c <= 3; c++) {
                if (board[r][c] && board[r][c] === board[r + 1][c + 1] && board[r][c] === board[r + 2][c + 2] && board[r][c] === board[r + 3][c + 3]) return board[r][c]
            }
        }
        for (let r = 0; r <= 2; r++) {
            for (let c = 3; c < 7; c++) {
                if (board[r][c] && board[r][c] === board[r + 1][c - 1] && board[r][c] === board[r + 2][c - 2] && board[r][c] === board[r + 3][c - 3]) return board[r][c]
            }
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
                board: Array(6).fill(null).map(() => Array(7).fill(null)),
                currentPlayer: "red",
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

    if (loading) return <div className="flex items-center justify-center p-20 text-white"><Loader2 className="animate-spin mr-2" /> Loading Connect Four...</div>
    if (!game) return <div className="flex items-center justify-center p-20 text-slate-400">Game not found or failed to initialize.</div>

    const isMyTurn = game.status === "in_progress" && (
        (game.currentPlayer === "red" && game.players.red.id === currentUserId) ||
        (game.currentPlayer === "yellow" && game.players.yellow.id === currentUserId)
    )
    const isPlayer = game.players.red.id === currentUserId || game.players.yellow.id === currentUserId

    return (
        <div className="flex flex-col items-center gap-6 p-6 bg-slate-900/95 rounded-3xl border border-white/10 shadow-2xl backdrop-blur-xl max-w-[650px] w-full mx-auto relative overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center w-full">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-xl">
                        <Trophy className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white tracking-tight">Connect Four</h2>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <Clock className="w-3.5 h-3.5" />
                            <span className="font-mono">{formatTime(gameTime)}</span>
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
                <C4PlayerBadge name={game?.players?.red?.name || "Red"} color="red" active={game?.currentPlayer === "red"} />
                <div className="text-slate-600 font-bold italic text-xs uppercase tracking-tighter">VS</div>
                <C4PlayerBadge name={game?.players?.yellow?.name || "Yellow"} color="yellow" active={game?.currentPlayer === "yellow"} />
            </div>

            {/* Game Board */}
            <div className="relative p-4 bg-blue-600 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-t-4 border-blue-400/30">
                {/* Hover Indicator */}
                <div className="flex gap-2 sm:gap-4 px-2 mb-2 h-8">
                    {Array(7).fill(0).map((_, i) => (
                        <div key={i} className="flex-1 flex justify-center">
                            {hoverColumn === i && isMyTurn && !(game?.board?.[0]?.[i]) && !isPaused && (
                                <ChevronDown className={cn(
                                    "w-6 h-6 animate-bounce",
                                    game?.currentPlayer === "red" ? "text-red-500" : "text-yellow-400"
                                )} />
                            )}
                        </div>
                    ))}
                </div>

                {/* Grid */}
                <div className="grid grid-rows-6 gap-3 sm:gap-5">
                    {(Array.isArray(game?.board) ? game.board : []).map((row, r) => (
                        <div key={r} className="flex gap-3 sm:gap-5">
                            {(Array.isArray(row) ? row : []).map((cell, c) => (
                                <div
                                    key={c}
                                    onMouseEnter={() => setHoverColumn(c)}
                                    onMouseLeave={() => setHoverColumn(null)}
                                    onClick={() => handleColumnClick(c)}
                                    className={cn(
                                        "w-12 h-12 sm:w-16 sm:h-16 rounded-full ring-inset ring-4 ring-blue-700 transition-all duration-300 transform",
                                        cell === "red" ? "bg-red-500 shadow-[0_6px_0_rgb(153,27,27)]" :
                                            cell === "yellow" ? "bg-yellow-400 shadow-[0_6px_0_rgb(161,98,7)]" :
                                                "bg-slate-900/80 shadow-inner",
                                        !cell && isMyTurn && !isPaused && "cursor-pointer hover:bg-slate-800 active:scale-95",
                                        cell && "animate-in slide-in-from-top-4 duration-300 ease-out"
                                    )}
                                />
                            ))}
                        </div>
                    ))}
                </div>

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
                        <Trophy className="w-16 h-16 text-yellow-400 mb-4 animate-bounce" />
                        <h3 className="text-3xl font-black text-white mb-2 uppercase tracking-tighter">
                            {game.winner === "draw" ? "Stalemate!" :
                                `${game.winner === "red" ? game.players.red.name : game.players.yellow.name} Wins!`}
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
            <div className="text-center h-6">
                {game.status === "in_progress" && (
                    <p className={cn("text-base font-bold animate-pulse tracking-tight", isMyTurn ? "text-blue-400" : "text-slate-500")}>
                        {isMyTurn ? "Your Strategy, General" : `Awaiting ${game.currentPlayer}'s deployment...`}
                    </p>
                )}
                {game.status === "waiting" && (
                    <div className="flex items-center justify-center gap-2">
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" />
                        <p className="text-sm font-bold text-blue-400/80 uppercase tracking-widest">Waiting for challenger...</p>
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                    </div>
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
                    initialGame="connect4"
                    hostName={game.players.red.id === currentUserId ? game.players.red.name : game.players.yellow.name}
                    currentUserId={currentUserId}
                />
            )}
        </div>
    )
}

function C4PlayerBadge({ name, color, active }: { name: string, color: "red" | "yellow", active: boolean }) {
    return (
        <div className={cn(
            "flex items-center gap-3 px-4 py-2 rounded-xl transition-all duration-300",
            active ? "bg-white/10 ring-1 ring-white/20 shadow-lg scale-105" : "opacity-30 blur-[0.5px]"
        )}>
            <div className={cn(
                "w-4 h-4 rounded-full shadow-lg",
                color === "red" ? "bg-red-500" : "bg-yellow-400"
            )} />
            <span className="text-xs font-bold text-white max-w-[80px] truncate tracking-tight uppercase">{name}</span>
        </div>
    )
}
