"use client"

import { useEffect, useState, useRef } from "react"
import { ChessManager, type ChessGameSession } from "@/utils/games/chess-manager"
import { chessGame, type Piece, type PieceColor } from "@/utils/games/chess-game"
import { Button } from "@/components/ui/button"
import { Loader2, X, RotateCcw, Trophy, Clock, Pause, Play, Settings, Minimize2 } from "lucide-react"
import { PlaygroundSetupModal } from "../playground-setup-modal"
import { toast } from "sonner"
import { cn } from "@/utils/core/cn"
import type { GameConfig } from "../playground-setup-modal"

interface ChessBoardProps {
    gameConfig: GameConfig
    roomId: string
    currentUserId: string
    onClose?: () => void
    onMinimize?: () => void
}

export function ChessBoard({ gameConfig, roomId, currentUserId, onClose, onMinimize }: ChessBoardProps) {
    const [session, setSession] = useState<ChessGameSession | null>(null)
    const [board, setBoard] = useState<(Piece | null)[][]>([])
    const [selectedSquare, setSelectedSquare] = useState<{ row: number, col: number } | null>(null)
    const [validMoves, setValidMoves] = useState<{ row: number, col: number }[]>([])
    const [processing, setProcessing] = useState(false)
    const [gameTime, setGameTime] = useState(0)
    const [isPaused, setIsPaused] = useState(false)
    const [showPauseMenu, setShowPauseMenu] = useState(false)
    const [showSettingsModal, setShowSettingsModal] = useState(false)
    const manager = ChessManager.getInstance()
    const timerRef = useRef<NodeJS.Timeout | null>(null)
    const gameId = useRef(gameConfig.gameId || `chess_${Date.now()}`).current
    const initialized = useRef(false)

    const initEngine = (fen: string) => {
        chessGame.loadFEN(fen)
        setBoard(chessGame.getGameState().board)
    }

    // Sync session
    useEffect(() => {
        if (gameConfig.gameType === "single") {
            if (initialized.current) return;
            initialized.current = true;

            const initialSession: ChessGameSession = {
                id: gameId,
                roomId,
                fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                whitePlayer: { id: currentUserId, name: gameConfig.players[0].name },
                blackPlayer: { id: "ai", name: gameConfig.players[1]?.name || "Computer" },
                currentPlayer: "white",
                status: "waiting",
                winner: null,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                rematches: []
            }
            setSession(initialSession)
            initEngine(initialSession.fen)
        } else {
            const unsubscribe = manager.listenForGameUpdates(roomId, gameId, (newSession) => {
                if (newSession) {
                    setSession(newSession)
                    initEngine(newSession.fen)
                } else if (gameConfig.players.find(p => p.id === currentUserId)?.isHost) {
                    manager.createGame(roomId, currentUserId, gameConfig.players[0].name, undefined, gameId).then(game => {
                        if (game) setSession(game)
                    })
                }
            })
            return () => unsubscribe()
        }
    }, [roomId, gameId, gameConfig.gameType, currentUserId])

    // Timer
    useEffect(() => {
        if ((session?.status === "in_progress" || session?.status === "check" || session?.status === "waiting") && !isPaused) {
            if (!timerRef.current) {
                timerRef.current = setInterval(() => setGameTime(prev => prev + 1), 1000)
            }
        } else {
            if (timerRef.current) {
                clearInterval(timerRef.current)
                timerRef.current = null
            }
        }
        return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } }
    }, [session?.status, isPaused])

    // AI Move
    useEffect(() => {
        if (gameConfig.gameType === "single" && session?.currentPlayer === "black" && session?.status !== "checkmate" && session?.status !== "draw" && !isPaused) {
            const timer = setTimeout(async () => {
                chessGame.loadFEN(session.fen)
                await (chessGame as any).makeAIMove()
                const state = chessGame.getGameState()
                const newFen = chessGame.getFEN()
                await syncGame(newFen, state.status, state.winner as any)
            }, 1000)
            return () => clearTimeout(timer)
        }
    }, [session?.currentPlayer, session?.status, gameConfig.gameType, isPaused])

    const syncGame = async (fen: string, status: string, winner: any) => {
        if (gameConfig.gameType === "single") {
            setSession(prev => prev ? ({
                ...prev,
                fen,
                status: (status === "waiting" || status === "playing" ? "in_progress" : status) as any,
                winner,
                currentPlayer: fen.split(" ")[1] === "w" ? "white" : "black",
                updatedAt: Date.now()
            }) : null)
            // Essential for updating the local board view!
            initEngine(fen)
        } else {
            await manager.updateGameState(roomId, gameId, fen, status as any, winner)
        }
    }

    const handleSquareClick = async (row: number, col: number) => {
        if (!session || processing || isPaused) return

        const fenParts = session.fen.split(" ")
        const turn = fenParts[1] === "w" ? "white" : "black"
        const myColor = session.whitePlayer.id === currentUserId ? "white" : "black"

        if (turn !== myColor || session.status === "checkmate" || session.status === "draw" || session.status === "stalemate") return

        if (!selectedSquare) {
            const piece = board[row][col]
            if (piece && piece.color === myColor) {
                setSelectedSquare({ row, col })
                chessGame.loadFEN(session.fen)
                const moves = chessGame.getValidMoves(row, col)
                setValidMoves(moves)
            }
            return
        }

        const isMove = validMoves.some(m => m.row === row && m.col === col)
        if (isMove) {
            setProcessing(true)
            chessGame.loadFEN(session.fen)
            const success = chessGame.makeMove(selectedSquare, { row, col })

            if (success) {
                const state = chessGame.getGameState()
                await syncGame(chessGame.getFEN(), state.status, state.winner as any)
            }

            setSelectedSquare(null)
            setValidMoves([])
            setProcessing(false)
        } else {
            const piece = board[row][col]
            if (piece && piece.color === myColor) {
                setSelectedSquare({ row, col })
                chessGame.loadFEN(session.fen)
                setValidMoves(chessGame.getValidMoves(row, col))
            } else {
                setSelectedSquare(null)
                setValidMoves([])
            }
        }
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
        chessGame.initialize()
        const state = chessGame.getGameState()
        setBoard(state.board)
        setGameTime(0)
        setIsPaused(false)
        setShowPauseMenu(false)
        syncGame(chessGame.getFEN(), "in_progress", null)
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

    if (!session || board.length === 0) return <div className="flex items-center justify-center p-20 text-white"><Loader2 className="animate-spin mr-2" /> Loading Chess Arena...</div>

    const turn = session.fen.split(" ")[1] === "w" ? "white" : "black"
    const myColor = session.whitePlayer.id === currentUserId ? "white" : "black"
    const isMyTurn = turn === myColor

    return (
        <div className="flex flex-col items-center gap-3 sm:gap-6 p-4 sm:p-8 pt-12 sm:pt-10 bg-slate-900/95 rounded-2xl sm:rounded-3xl border border-white/10 shadow-2xl backdrop-blur-2xl w-[95vw] sm:max-w-2xl mx-auto relative overflow-hidden">
            {/* Header */}
            <div className="flex flex-wrap justify-between items-center w-full gap-3 px-1 sm:px-2">
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <div className="p-1.5 sm:p-2 bg-gradient-to-br from-purple-500/20 to-cyan-500/20 rounded-xl border border-white/10">
                        <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500" />
                    </div>
                    <div>
                        <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-tight">Chess Arena</h2>
                        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-slate-400 mt-0.5">
                            <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            <span className="font-mono text-cyan-400/80">{formatTime(gameTime)}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-700 hover:bg-slate-600 text-white"
                        onClick={handlePause}
                    >
                        {isPaused ? <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                    </Button>
                    {onMinimize && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-700 hover:bg-slate-600 text-white"
                            onClick={onMinimize}
                        >
                            <Minimize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-700 hover:bg-slate-600 text-white"
                        onClick={handleSettings}
                    >
                        <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </Button>
                    {onClose && (
                        <Button variant="ghost" size="icon" onClick={onClose} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full hover:bg-white/10 text-slate-400">
                            <X className="w-4 h-4 sm:w-5 sm:h-5" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Players Area */}
            <div className="grid grid-cols-2 gap-2 sm:gap-4 w-full">
                <PlayerPanel
                    name={session.blackPlayer.name}
                    color="black"
                    active={turn === "black"}
                    captured={board.flat().filter(p => p && p.color === 'white' && p.type !== 'king').length}
                />
                <PlayerPanel
                    name={session.whitePlayer.name}
                    color="white"
                    active={turn === "white"}
                    captured={board.flat().filter(p => p && p.color === 'black' && p.type !== 'king').length}
                />
            </div>

            {/* Chess Board Container */}
            <div className="relative flex flex-col items-center">
                <div className="relative flex">
                    {/* Row Labels */}
                    <div className="flex flex-col justify-around py-2 mr-1 sm:mr-2 text-[10px] font-bold text-slate-500 w-3 sm:w-4">
                        {(myColor === "white" ? ["8", "7", "6", "5", "4", "3", "2", "1"] : ["1", "2", "3", "4", "5", "6", "7", "8"]).map(label => (
                            <div key={label} className="h-9 sm:h-14 flex items-center justify-center">{label}</div>
                        ))}
                    </div>

                    <div className="relative group p-2 bg-slate-800 rounded-xl shadow-2xl border-4 border-slate-700">
                        <div className="grid grid-cols-8 rounded-sm overflow-hidden border border-slate-900 shadow-inner">
                            {(myColor === "white" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0]).map(row =>
                                (myColor === "white" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0]).map(col => {
                                    const isBlackSquare = (row + col) % 2 === 1
                                    const piece = board[row][col]
                                    const isSelected = selectedSquare?.row === row && selectedSquare?.col === col
                                    const isValidMove = validMoves.some(m => m.row === row && m.col === col)

                                    return (
                                        <div
                                            key={`${row}-${col}`}
                                            onClick={() => handleSquareClick(row, col)}
                                            className={cn(
                                                "w-9 h-9 sm:w-14 sm:h-14 flex items-center justify-center select-none cursor-pointer transition-all duration-200 relative",
                                                isBlackSquare ? "bg-[#769656]" : "bg-[#eeeed2]",
                                                isSelected && "bg-[#bac34b] ring-inset ring-2 ring-white/30 z-10",
                                                !isSelected && isValidMove && "relative after:content-[''] after:absolute after:w-3 after:h-3 after:bg-black/10 after:rounded-full after:z-20",
                                                isValidMove && piece && "bg-rose-500/40 ring-inset ring-4 ring-rose-500/50"
                                            )}
                                        >
                                            {piece && (
                                                <div className={cn(
                                                    "transition-all duration-300 transform w-8 h-8 sm:w-12 sm:h-12 flex items-center justify-center",
                                                    isSelected && "scale-110 -translate-y-1 drop-shadow-2xl z-30"
                                                )}>
                                                    <PieceGraphic type={piece.type} color={piece.color} />
                                                </div>
                                            )}
                                        </div>
                                    )
                                })
                            )}
                        </div>

                        {/* Overlays */}
                        {isPaused && (
                            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center rounded-lg z-40">
                                <div className="text-center">
                                    <Pause className="w-12 h-12 text-white mx-auto mb-2 animate-pulse" />
                                    <p className="text-white font-bold tracking-widest uppercase text-xs">Game Paused</p>
                                </div>
                            </div>
                        )}

                        {(session.status === "checkmate" || session.status === "draw" || session.status === "stalemate") && (
                            <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center rounded-lg animate-in fade-in zoom-in duration-500 z-50 p-6 border border-white/10 shadow-black shadow-2xl">
                                <Trophy className="w-16 h-16 text-yellow-500 mb-4 animate-bounce" />
                                <h3 className="text-3xl font-black text-white mb-2 uppercase tracking-tighter text-center">
                                    {session.status === "checkmate" ? "Checkmate!" : "Stalemate!"}
                                </h3>
                                <p className="text-slate-400 mb-8 text-sm text-center font-medium max-w-[200px]">
                                    {session.status === "checkmate"
                                        ? `${session.winner === "white" ? "White" : "Black"} dominates the battlefield!`
                                        : "Fate ends in a balanced draw."}
                                </p>
                                <div className="flex flex-col gap-3 w-full max-w-[200px]">
                                    <Button onClick={handleRestart} className="rounded-xl h-12 bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-600 hover:to-blue-700 font-black transition-all shadow-lg flex items-center justify-center gap-2 border-t border-white/20">
                                        <RotateCcw className="w-5 h-5" /> RESTART DUEL
                                    </Button>
                                    <Button onClick={handleExitGame} className="rounded-xl h-12 bg-slate-700 text-white hover:bg-slate-600 font-bold transition-all border border-white/5">
                                        QUIT MATCH
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Column Labels */}
                <div className="flex justify-around mt-2 text-[10px] font-bold text-slate-500 w-full pl-4 sm:pl-6">
                    {(myColor === "white" ? ["a", "b", "c", "d", "e", "f", "g", "h"] : ["h", "g", "f", "e", "d", "c", "b", "a"]).map(label => (
                        <div key={label} className="w-9 sm:w-14 text-center lowercase">{label}</div>
                    ))}
                </div>
            </div>

            {/* Status Footer */}
            <div className="w-full flex justify-between items-center px-5 py-4 bg-slate-800/50 rounded-2xl border border-white/10 mt-2 shadow-inner">
                <div className="flex items-center gap-4">
                    {session.status === "check" && (
                        <div className="px-4 py-1.5 bg-red-500/20 border border-red-500/40 rounded-lg animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.3)]">
                            <span className="text-red-400 text-xs font-black uppercase tracking-widest flex items-center gap-2">
                                <span className="w-2 h-2 bg-red-400 rounded-full animate-ping" />
                                CHECK!
                            </span>
                        </div>
                    )}
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Game Status</span>
                    <div className="text-sm font-bold flex items-center gap-2">
                        {isMyTurn ? (
                            <span className="text-cyan-400 animate-pulse flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                                Your Turn
                            </span>
                        ) : (
                            <span className="text-slate-500 flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                                Opponent's Turn
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Pause Menu Overlay */}
            {showPauseMenu && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] animate-in fade-in duration-300 backdrop-blur-md">
                    <div className="bg-slate-800 rounded-[32px] p-8 w-full max-w-sm mx-4 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col items-center">
                        <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mb-6 shadow-inner border border-white/5">
                            <Pause className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-2xl font-black text-center mb-2 text-white uppercase tracking-tighter">Match Paused</h2>
                        <p className="text-slate-400 text-sm mb-8 text-center px-4 font-medium">The board is frozen. Ready to resume the battle?</p>

                        <div className="space-y-3 w-full">
                            <Button onClick={handleResume} className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white h-14 rounded-2xl flex items-center justify-center gap-3 font-black shadow-lg border-t border-white/20">
                                <Play className="w-5 h-5 fill-current" /> RESUME DUEL
                            </Button>
                            <Button onClick={handleRestart} className="w-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 h-14 rounded-2xl flex items-center justify-center gap-3 font-bold border border-amber-500/30">
                                <RotateCcw className="w-5 h-5" /> RESTART GAME
                            </Button>
                            <Button onClick={handleSettings} className="w-full bg-slate-700 hover:bg-slate-600 text-white h-14 rounded-2xl flex items-center justify-center gap-3 font-bold border border-white/5">
                                <Settings className="w-5 h-5" /> ADJUST SETTINGS
                            </Button>
                            <Button onClick={handleExitGame} className="w-full bg-transparent hover:bg-red-500/10 text-red-400 h-11 rounded-xl flex items-center justify-center gap-2 font-semibold transition-all">
                                <X className="w-4 h-4" /> LEAVE ARENA
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {showSettingsModal && (
                <PlaygroundSetupModal
                    isOpen={showSettingsModal}
                    onClose={() => setShowSettingsModal(false)}
                    onStartGame={(newConfig) => {
                        setShowSettingsModal(false)
                        handleRestart()
                    }}
                    initialGame="chess"
                    hostName={session.whitePlayer.id === currentUserId ? session.whitePlayer.name : session.blackPlayer.name}
                />
            )}
        </div>
    )
}

function PieceGraphic({ type, color }: { type: string, color: string }) {
    const isWhite = color === 'white';
    const mainFill = isWhite ? "#FFFFFF" : "#000000";
    const strokeColor = isWhite ? "#000000" : "#FFFFFF";
    const shadowClass = isWhite ? "drop-shadow-md" : "drop-shadow-lg";

    switch (type) {
        case 'pawn':
            return (
                <svg viewBox="0 0 45 45" className={cn("w-full h-full", shadowClass)}>
                    <path
                        d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 12.47H34c0-6.92-4.41-11.41-7.41-12.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z"
                        fill={mainFill}
                        stroke={strokeColor}
                        strokeWidth="1.5"
                    />
                </svg>
            );
        case 'rook':
            return (
                <svg viewBox="0 0 45 45" className={cn("w-full h-full", shadowClass)}>
                    <g fill={mainFill} stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 39h27v-3H9v3zM12 36l1.5-21h18l1.5 21H12z" />
                        <path d="M11 14V9h4v2h5V9h5v2h5V9h4v5H11z" />
                        <path d="M34 14l.3 3H10.7l.3-3" fill="none" />
                    </g>
                </svg>
            );
        case 'knight':
            return (
                <svg viewBox="0 0 45 45" className={cn("w-full h-full", shadowClass)}>
                    <g fill={mainFill} stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-11.5 8-26z" />
                        <path d="M24 18c.3 1 1 3 0 5-1.2 2-3.5 3-4 1" />
                        <path d="M9 26c8.5-1.5 21-2 21-2s-12.5-10-21-1c0 0 7.5-1.5 11 1.5L9 27z" />
                        <path d="M11 38c5-1 15-1 20 0" />
                        <circle cx="27" cy="14" r="2" fill={isWhite ? "#000" : "#fff"} stroke="none" />
                    </g>
                </svg>
            );
        case 'bishop':
            return (
                <svg viewBox="0 0 45 45" className={cn("w-full h-full", shadowClass)}>
                    <g fill={mainFill} stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 0 3-3 3H12c-3 0-3-3-3-3z" />
                        <path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z" />
                        <circle cx="22.5" cy="8" r="2.5" />
                        <path d="M17.5 26h10M15 30h15" fill="none" />
                    </g>
                </svg>
            );
        case 'queen':
            return (
                <svg viewBox="0 0 45 45" className={cn("w-full h-full", shadowClass)}>
                    <g fill={mainFill} stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11V11l-5.5 13.5L20 11l-5.5 13.5L9 11l0 15z" />
                        <path d="M9 26c0 2 1.5 2 2.5 4 1 2.5 1 1 .5 3-.5 2-3 2.5-3 2.5h27c0 0-2.5-.5-3-2.5-.5-2-.5-.5.5-3 1-2 2.5-2 2.5-4-6-1.5-18.5-1.5-27 0z" />
                        <path d="M11.5 30c3.5-1 18.5-1 22 0M12 33.5c6-1 15-1 21 0" fill="none" />
                        <circle cx="6" cy="12" r="2" />
                        <circle cx="14" cy="9" r="2" />
                        <circle cx="22.5" cy="8" r="2" />
                        <circle cx="31" cy="9" r="2" />
                        <circle cx="39" cy="12" r="2" />
                    </g>
                </svg>
            );
        case 'king':
            return (
                <svg viewBox="0 0 45 45" className={cn("w-full h-full", shadowClass)}>
                    <g fill={mainFill} stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22.5 11.63V6M20 8h5" />
                        <path d="M22.5 25s4.5-7.5 3-10c-1.5-2.5-6-2.5-6 0-1.5 2.5 3 10 3 10" />
                        <path d="M11.5 37c5.5 3.5 16.5 3.5 22 0v-7s9-4.5 6-10.5c-4-1-1-.5-6 3V13c0-3-2-3-2-3H13.5s-2 0-2 3v8c-5-3.5-2-3-6-2-3 6 6 10.5 6 10.5v7z" />
                        <path d="M11.5 30c5.5-3 16.5-3 22 0m-22 3.5c5.5-3 16.5-3 22 0m-22 3.5c5.5-3 16.5-3 22 0" fill="none" />
                    </g>
                </svg>
            );
        default:
            return (
                <svg viewBox="0 0 45 45" className="w-full h-full">
                    <circle cx="22.5" cy="22.5" r="5" fill={mainFill} />
                </svg>
            );
    }
}

function PlayerPanel({ name, color, active, captured }: { name: string, color: "white" | "black", active: boolean, captured: number }) {
    return (
        <div className={cn(
            "flex items-center justify-between p-2 sm:p-3.5 rounded-xl sm:rounded-2xl transition-all duration-500 border-2",
            active ? "bg-slate-800 border-cyan-500/50 shadow-[0_0_20px_rgba(34,211,238,0.2)] scale-[1.03]" : "bg-slate-900/50 border-white/5 opacity-40 grayscale-[0.3]"
        )}>
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className={cn(
                    "w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg shrink-0",
                    color === "white" ? "bg-white text-slate-900" : "bg-slate-700 text-white"
                )}>
                    {color === "white" ? <div className="w-6 h-6 sm:w-8 sm:h-8"><PieceGraphic type="king" color="white" /></div> : <div className="w-6 h-6 sm:w-8 sm:h-8"><PieceGraphic type="king" color="black" /></div>}
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="text-[11px] sm:text-[13px] font-black text-white tracking-tight uppercase truncate leading-none mb-1">{name}</span>
                    <span className={cn(
                        "text-[8px] sm:text-[9px] font-black uppercase tracking-wider sm:tracking-[0.2em] truncate",
                        color === "white" ? "text-cyan-400" : "text-slate-500"
                    )}>{color} COMMANDER</span>
                </div>
            </div>
            {captured > 0 && (
                <div className="hidden sm:flex items-center -space-x-1.5 bg-black/20 px-2 py-1 rounded-lg border border-white/5 ml-1">
                    <span className="text-[11px] font-black text-white mr-1">+{captured}</span>
                </div>
            )}
        </div>
    )
}
