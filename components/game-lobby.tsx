"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { GameSignaling, type LobbyState } from "@/utils/infra/game-signaling"
import { assignPlayerColor, PLAYER_COLORS } from "@/utils/core/player-colors"
import type { Player } from "@/utils/games/dots-and-boxes-game"
import {
    Users,
    Crown,
    Check,
    X,
    Settings,
    Play,
    Eye,
    LogOut,
    MoreVertical,
    UserPlus,
    Shield
} from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface GameLobbyProps {
    gameId: string
    roomId: string
    currentUserId: string
    currentUserName: string
    onStartGame: (players: Player[]) => void
    onExit: () => void
}

export function GameLobby({
    gameId,
    roomId,
    currentUserId,
    currentUserName,
    onStartGame,
    onExit,
}: GameLobbyProps) {
    const [lobby, setLobby] = useState<LobbyState | null>(null)
    const [isReady, setIsReady] = useState(false)
    const [showSettings, setShowSettings] = useState(false)

    const gameSignaling = GameSignaling.getInstance()
    const isHost = lobby?.host.id === currentUserId
    const currentPlayer = lobby?.players.find(p => p.id === currentUserId)
    const isSpectator = lobby?.spectators.some(s => s.id === currentUserId)

    useEffect(() => {
        // Listen for lobby changes
        const unsubscribe = gameSignaling.listenForLobbyChanges(gameId, roomId, (updatedLobby) => {
            setLobby(updatedLobby)

            // Check if game started
            if (updatedLobby?.status === 'in-progress' && updatedLobby.players) {
                onStartGame(updatedLobby.players)
            }
        })

        return () => {
            unsubscribe()
        }
    }, [gameId, roomId])

    const handleToggleReady = async () => {
        if (!currentPlayer) return

        const newReadyState = !isReady
        setIsReady(newReadyState)
        await gameSignaling.setPlayerReady(gameId, roomId, currentUserId, newReadyState)
    }

    const handleStartGame = async () => {
        if (!isHost || !lobby) return

        // Check if all players are ready
        const allReady = lobby.players.every(p =>
            lobby.readyPlayers.includes(p.id) || p.id === lobby.host.id
        )

        if (!allReady) {
            alert("All players must be ready before starting!")
            return
        }

        if (lobby.players.length < 2) {
            alert("Need at least 2 players to start!")
            return
        }

        await gameSignaling.startGameFromLobby(gameId, roomId)
    }

    const handleKickPlayer = async (playerId: string) => {
        if (!isHost) return
        await gameSignaling.kickPlayer(gameId, roomId, playerId, currentUserId)
    }

    const handlePromoteToHost = async (playerId: string) => {
        if (!isHost) return
        await gameSignaling.promoteToHost(gameId, roomId, playerId)
    }

    const handleLeaveLobby = async () => {
        await gameSignaling.leaveLobby(gameId, roomId, currentUserId)
        onExit()
    }

    const handleUpdateSettings = async (settings: Partial<LobbyState['settings']>) => {
        if (!isHost) return
        await gameSignaling.updateLobbySettings(gameId, roomId, settings)
    }

    if (!lobby) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
                    <p className="text-gray-400">Loading lobby...</p>
                </div>
            </div>
        )
    }

    const readyCount = lobby.readyPlayers.length
    const totalPlayers = lobby.players.length
    const canStart = isHost && readyCount >= totalPlayers - 1 && totalPlayers >= 2

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 rounded-lg p-6 border border-purple-500/30">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <Users className="w-6 h-6 text-purple-400" />
                            Game Lobby
                        </h2>
                        <p className="text-gray-400 mt-1">
                            {lobby.settings.gridSize}x{lobby.settings.gridSize} Grid • {totalPlayers}/{lobby.settings.maxPlayers} Players
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {isHost && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowSettings(!showSettings)}
                                className="text-gray-300 hover:bg-purple-500/20"
                            >
                                <Settings className="w-4 h-4" />
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleLeaveLobby}
                            className="text-red-400 hover:bg-red-500/20"
                        >
                            <LogOut className="w-4 h-4 mr-1" />
                            Leave
                        </Button>
                    </div>
                </div>

                {/* Settings Panel */}
                {showSettings && isHost && (
                    <div className="mt-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700 space-y-3">
                        <h3 className="text-sm font-semibold text-white">Lobby Settings</h3>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-gray-400">Grid Size</label>
                                <select
                                    value={lobby.settings.gridSize}
                                    onChange={(e) => handleUpdateSettings({ gridSize: Number(e.target.value) })}
                                    className="w-full mt-1 bg-slate-700 text-white rounded px-2 py-1 text-sm"
                                >
                                    <option value={3}>3x3</option>
                                    <option value={4}>4x4</option>
                                    <option value={5}>5x5</option>
                                    <option value={6}>6x6</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-xs text-gray-400">Max Players</label>
                                <select
                                    value={lobby.settings.maxPlayers}
                                    onChange={(e) => handleUpdateSettings({ maxPlayers: Number(e.target.value) })}
                                    className="w-full mt-1 bg-slate-700 text-white rounded px-2 py-1 text-sm"
                                >
                                    {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                                        <option key={n} value={n}>{n} Players</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400">Voice Chat</span>
                            <button
                                onClick={() => handleUpdateSettings({ voiceChatEnabled: !lobby.settings.voiceChatEnabled })}
                                className={`px-3 py-1 rounded text-xs font-medium ${lobby.settings.voiceChatEnabled
                                    ? 'bg-green-500/20 text-green-400'
                                    : 'bg-gray-700 text-gray-400'
                                    }`}
                            >
                                {lobby.settings.voiceChatEnabled ? 'Enabled' : 'Disabled'}
                            </button>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400">Computer Players</span>
                            <button
                                onClick={() => handleUpdateSettings({ allowComputerPlayers: !lobby.settings.allowComputerPlayers })}
                                className={`px-3 py-1 rounded text-xs font-medium ${lobby.settings.allowComputerPlayers
                                    ? 'bg-blue-500/20 text-blue-400'
                                    : 'bg-gray-700 text-gray-400'
                                    }`}
                            >
                                {lobby.settings.allowComputerPlayers ? 'Allowed' : 'Disabled'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Players List */}
            <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-cyan-400" />
                    Players ({totalPlayers}/{lobby.settings.maxPlayers})
                </h3>

                <div className="space-y-2">
                    {lobby.players.map((player, index) => {
                        const playerIsReady = lobby.readyPlayers.includes(player.id)
                        const playerIsHost = player.id === lobby.host.id

                        return (
                            <div
                                key={player.id}
                                className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg border border-slate-600 hover:border-slate-500 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    {/* Player Color Indicator */}
                                    <div
                                        className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-lg"
                                        style={{ backgroundColor: player.color }}
                                    >
                                        {player.initials}
                                    </div>

                                    {/* Player Info */}
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-white font-medium">{player.name}</span>
                                            {playerIsHost && (
                                                <Crown className="w-4 h-4 text-yellow-400" />
                                            )}
                                            {player.isComputer && (
                                                <Shield className="w-4 h-4 text-blue-400" />
                                            )}
                                        </div>
                                        <span className="text-xs text-gray-400">
                                            {playerIsReady ? '✓ Ready' : 'Not ready'}
                                        </span>
                                    </div>
                                </div>

                                {/* Player Actions */}
                                <div className="flex items-center gap-2">
                                    {playerIsReady && (
                                        <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center">
                                            <Check className="w-4 h-4 text-green-400" />
                                        </div>
                                    )}

                                    {isHost && player.id !== currentUserId && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0 text-gray-400 hover:text-white"
                                                >
                                                    <MoreVertical className="w-4 h-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                                                <DropdownMenuItem
                                                    onClick={() => handlePromoteToHost(player.id)}
                                                    className="text-yellow-400 hover:bg-yellow-500/20"
                                                >
                                                    <Crown className="w-4 h-4 mr-2" />
                                                    Make Host
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => handleKickPlayer(player.id)}
                                                    className="text-red-400 hover:bg-red-500/20"
                                                >
                                                    <X className="w-4 h-4 mr-2" />
                                                    Kick Player
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Spectators */}
            {lobby.spectators.length > 0 && (
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                    <h3 className="text-sm font-semibold text-gray-400 mb-2 flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        Spectators ({lobby.spectators.length})
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {lobby.spectators.map(spec => (
                            <div
                                key={spec.id}
                                className="px-3 py-1 bg-slate-700 rounded-full text-sm text-gray-300 flex items-center gap-2"
                            >
                                <Eye className="w-3 h-3" />
                                {spec.name}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Controls */}
            <div className="flex items-center justify-between gap-4">
                {!isSpectator && (
                    <Button
                        onClick={handleToggleReady}
                        className={`flex-1 ${isReady
                            ? 'bg-green-500 hover:bg-green-600'
                            : 'bg-slate-700 hover:bg-slate-600'
                            } text-white`}
                    >
                        {isReady ? (
                            <>
                                <Check className="w-4 h-4 mr-2" />
                                Ready
                            </>
                        ) : (
                            'Mark as Ready'
                        )}
                    </Button>
                )}

                {isHost && (
                    <Button
                        onClick={handleStartGame}
                        disabled={!canStart}
                        className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Play className="w-4 h-4 mr-2" />
                        Start Game ({readyCount}/{totalPlayers} ready)
                    </Button>
                )}
            </div>

            {/* Status Message */}
            {isHost && !canStart && (
                <p className="text-center text-sm text-yellow-400">
                    {totalPlayers < 2
                        ? 'Waiting for more players...'
                        : `Waiting for ${totalPlayers - readyCount} player(s) to be ready...`}
                </p>
            )}
        </div>
    )
}
