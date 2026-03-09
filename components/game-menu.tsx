"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Gamepad2, Plus, Users, Play, Crown, Trophy, Loader2 } from "lucide-react"
import { ChessManager, type ChessGameSession } from "@/utils/games/chess-manager"
import { ConnectFourManager, type ConnectFourGame } from "@/utils/games/connect-four"
import { TicTacToeManager, type TicTacToeGame } from "@/utils/games/tic-tac-toe"
import { toast } from "sonner"
import { cn } from "@/utils/core/cn"

interface GameMenuProps {
    isOpen: boolean
    onClose: () => void
    roomId: string
    currentUserId: string
    currentUserName: string
    currentUserAvatar?: string
    onJoinGame: (gameType: "chess" | "connect4" | "tictactoe", gameId: string) => void
    onOpenPlayground?: (type?: "dots" | "chess" | "tictactoe" | "connect4") => void
}

export function GameMenu({
    isOpen,
    onClose,
    roomId,
    currentUserId,
    currentUserName,
    currentUserAvatar,
    onJoinGame,
    onOpenPlayground
}: GameMenuProps) {
    const [activeTab, setActiveTab] = useState("new")
    const [activeGames, setActiveGames] = useState<Array<{ type: string, id: string, name: string, players: number, status: string, creatorId: string }>>([])
    const [isFetching, setIsFetching] = useState(true)
    const [isCreating, setIsCreating] = useState(false)

    // Managers
    const chessManager = ChessManager.getInstance()
    const c4Manager = ConnectFourManager.getInstance()
    const tttManager = TicTacToeManager.getInstance()

    // Load active games
    useEffect(() => {
        if (!isOpen) return

        let isFirstLoad = true

        const loadGames = async () => {
            if (isFirstLoad) setIsFetching(true)
            try {
                const [chessGames, c4Games, tttGames] = await Promise.all([
                    chessManager.getActiveGames(roomId),
                    c4Manager.getActiveGames(roomId),
                    tttManager.getActiveGames(roomId)
                ])

                const formattedGames = [
                    ...chessGames.map(g => ({
                        type: "chess",
                        id: g.id,
                        name: `${g.whitePlayer.name} vs ${g.blackPlayer.name}`,
                        players: g.status === "waiting" ? 1 : 2,
                        status: g.status,
                        creatorId: g.whitePlayer.id
                    })),
                    ...c4Games.map(g => ({
                        type: "connect4",
                        id: g.id,
                        name: `${g.players.red.name} vs ${g.players.yellow.name}`,
                        players: g.status === "waiting" ? 1 : 2,
                        status: g.status,
                        creatorId: g.players.red.id
                    })),
                    ...tttGames.map(g => ({
                        type: "tictactoe",
                        id: g.id,
                        name: `${g.players.X.name} vs ${g.players.O.name}`,
                        players: g.status === "waiting" ? 1 : 2,
                        status: g.status,
                        creatorId: g.players.X.id
                    }))
                ]
                setActiveGames(formattedGames)
            } catch (error) {
                console.error("Failed to load games", error)
            } finally {
                if (isFirstLoad) {
                    setIsFetching(false)
                    isFirstLoad = false
                }
            }
        }

        loadGames()
        // Poll every 5 seconds for updates
        const interval = setInterval(loadGames, 5000)
        return () => clearInterval(interval)
    }, [isOpen, roomId])

    const handleCreateGame = async (type: "chess" | "connect4" | "tictactoe") => {
        setIsCreating(true)
        try {
            let gameId: string | undefined

            if (type === "chess") {
                const game = await chessManager.createGame(roomId, currentUserId, currentUserName, currentUserAvatar)
                gameId = game?.id
            } else if (type === "connect4") {
                const game = await c4Manager.createGame(roomId, currentUserId, currentUserName, currentUserAvatar)
                gameId = game?.id
            } else if (type === "tictactoe") {
                const game = await tttManager.createGame(roomId, currentUserId, currentUserName, currentUserAvatar)
                gameId = game?.id
            }

            if (gameId) {
                onJoinGame(type, gameId)
                onClose()
                toast.success(`Created new ${type} game!`)
            } else {
                toast.error("Failed to create game")
            }
        } catch (error) {
            console.error(error)
            toast.error("Error creating game")
        } finally {
            setIsCreating(false)
        }
    }

    const handleJoinActiveGame = async (game: typeof activeGames[0]) => {
        setIsCreating(true)
        try {
            let success = false

            // Only need to "join" if we are the second player
            if (activeGames.find(g => g.id === game.id)?.creatorId === currentUserId) {
                // Re-joining own game
                success = true
            } else {
                if (game.type === "chess") {
                    success = await chessManager.joinGame(roomId, game.id, currentUserId, currentUserName, currentUserAvatar)
                } else if (game.type === "connect4") {
                    success = await c4Manager.joinGame(roomId, game.id, currentUserId, currentUserName, currentUserAvatar)
                } else if (game.type === "tictactoe") {
                    success = await tttManager.joinGame(roomId, game.id, currentUserId, currentUserName, currentUserAvatar)
                }
            }

            if (success) {
                onJoinGame(game.type as any, game.id)
                onClose()
            } else {
                // Maybe it's full or already started, but we might be rejoining as a player who is already in it?
                // The managers handle checking if we are already in checks usually, or we can just open the board view
                // Let's assume onJoinGame just opens the view, and the view handles the state.
                // But validation is good.
                toast.error("Could not join game (maybe full?)")
            }
        } catch (error) {
            console.error(error)
            toast.error("Error joining game")
        } finally {
            setIsCreating(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-3xl h-[600px] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2 bg-slate-800/50 border-b border-slate-800">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Gamepad2 className="w-6 h-6 text-cyan-400" />
                        Game Center
                    </DialogTitle>
                </DialogHeader>

                <Tabs defaultValue="new" value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                    <div className="px-6 pt-4">
                        <TabsList className="bg-slate-800 border border-slate-700 w-full justify-start h-auto p-1">
                            <TabsTrigger value="new" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white px-4 py-2">
                                <Plus className="w-4 h-4 mr-2" />
                                New Game
                            </TabsTrigger>
                            <TabsTrigger value="active" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white px-4 py-2">
                                <Play className="w-4 h-4 mr-2" />
                                Active Games
                                {activeGames.length > 0 && (
                                    <span className="ml-2 bg-slate-900 text-xs px-2 py-0.5 rounded-full">{activeGames.length}</span>
                                )}
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-700">
                        <TabsContent value="new" className="mt-0 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Chess */}
                                <GameCard
                                    title="Chess"
                                    description="Classic strategy game. Checkmate your opponent."
                                    icon={<Crown className="w-8 h-8 text-yellow-500" />}
                                    color="hover:border-yellow-500/50"
                                    onClick={() => { onOpenPlayground?.("chess"); onClose(); }}
                                    disabled={isCreating}
                                />

                                {/* Connect Four */}
                                <GameCard
                                    title="Connect Four"
                                    description="Get 4 in a row horizontally, vertically, or diagonally."
                                    icon={<div className="flex gap-1"><div className="w-4 h-4 rounded-full bg-red-500" /><div className="w-4 h-4 rounded-full bg-yellow-400" /></div>}
                                    color="hover:border-red-500/50"
                                    onClick={() => { onOpenPlayground?.("connect4"); onClose(); }}
                                    disabled={isCreating}
                                />

                                {/* Tic Tac Toe */}
                                <GameCard
                                    title="Tic Tac Toe"
                                    description="Simple 3x3 grid. The classic X vs O."
                                    icon={<div className="text-2xl font-bold text-cyan-400">#</div>}
                                    color="hover:border-cyan-500/50"
                                    onClick={() => { onOpenPlayground?.("tictactoe"); onClose(); }}
                                    disabled={isCreating}
                                />

                                {/* Dots & Boxes */}
                                {onOpenPlayground && (
                                    <GameCard
                                        title="Dots & Boxes"
                                        description="Connect dots to close boxes. Claim the most boxes to win!"
                                        icon={<div className="text-2xl font-bold text-green-400">⊞</div>}
                                        color="hover:border-green-500/50"
                                        onClick={() => { onOpenPlayground?.("dots"); onClose(); }}
                                        disabled={isCreating}
                                    />
                                )}
                            </div>
                        </TabsContent>

                        <TabsContent value="active" className="mt-0">
                            {isFetching && activeGames.length === 0 ? (
                                <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-cyan-400" /></div>
                            ) : activeGames.length === 0 ? (
                                <div className="text-center p-12 text-slate-500">
                                    <Gamepad2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    No active games found. Start one!
                                </div>
                            ) : (
                                <div className="grid gap-3">
                                    {activeGames.map(game => (
                                        <div key={game.id} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-slate-600 transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className="p-2 bg-slate-800 rounded-md">
                                                    {game.type === "chess" && <Crown className="w-5 h-5 text-yellow-500" />}
                                                    {game.type === "connect4" && <div className="flex gap-0.5"><div className="w-2 h-2 rounded-full bg-red-500" /><div className="w-2 h-2 rounded-full bg-yellow-400" /></div>}
                                                    {game.type === "tictactoe" && <div className="text-lg font-bold text-cyan-400 leading-none">#</div>}
                                                </div>
                                                <div>
                                                    <h4 className="font-medium text-slate-200 capitalize">{game.type.replace("connect4", "Connect 4")}</h4>
                                                    <p className="text-sm text-slate-400">{game.name}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <span className={cn(
                                                        "text-xs px-2 py-1 rounded-full",
                                                        game.status === "waiting" ? "bg-yellow-500/20 text-yellow-400" :
                                                            game.status === "in_progress" ? "bg-green-500/20 text-green-400" :
                                                                "bg-slate-700 text-slate-400"
                                                    )}>
                                                        {game.status === "waiting" ? "Waiting for player" : "In Progress"}
                                                    </span>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant={game.status === "waiting" && game.creatorId !== currentUserId ? "default" : "secondary"}
                                                    className={cn(
                                                        game.status === "waiting" && game.creatorId !== currentUserId ? "bg-cyan-600 hover:bg-cyan-700" : ""
                                                    )}
                                                    onClick={() => handleJoinActiveGame(game)}
                                                >
                                                    {game.creatorId === currentUserId ? "Rejoin" : "Join"}
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </TabsContent>
                    </div>
                </Tabs>
            </DialogContent>
        </Dialog>
    )
}

function GameCard({ title, description, icon, color, onClick, disabled }: any) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={cn(
                "flex flex-col items-center text-center p-6 bg-slate-800/80 rounded-xl border border-slate-700 transition-all hover:scale-[1.02] hover:bg-slate-800 disabled:opacity-50 disabled:hover:scale-100",
                color
            )}
        >
            <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center mb-4 shadow-inner">
                {icon}
            </div>
            <h3 className="font-bold text-lg mb-1 text-white">{title}</h3>
            <p className="text-sm text-slate-400">{description}</p>
        </button>
    )
}
