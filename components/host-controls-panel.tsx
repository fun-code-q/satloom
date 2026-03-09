"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { Player } from "@/utils/games/dots-and-boxes-game"
import type { LobbyState } from "@/utils/infra/game-signaling"
import {
    Crown,
    UserX,
    Settings,
    Play,
    X,
    Shield,
    MoreVertical,
    AlertCircle,
} from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
    Alert,
    AlertDescription,
} from "@/components/ui/alert"

interface HostControlsPanelProps {
    lobby: LobbyState
    currentUserId: string
    onKickPlayer: (playerId: string) => void
    onPromoteToHost: (playerId: string) => void
    onUpdateSettings: (settings: Partial<LobbyState['settings']>) => void
    onStartGame: () => void
    onCancelGame: () => void
}

export function HostControlsPanel({
    lobby,
    currentUserId,
    onKickPlayer,
    onPromoteToHost,
    onUpdateSettings,
    onStartGame,
    onCancelGame,
}: HostControlsPanelProps) {
    const isHost = lobby.host.id === currentUserId
    const readyCount = lobby.readyPlayers.length
    const totalPlayers = lobby.players.length
    const canStart = readyCount >= totalPlayers - 1 && totalPlayers >= 2

    if (!isHost) {
        return null
    }

    return (
        <Card className="bg-slate-800/50 border-slate-700 p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Crown className="w-5 h-5 text-yellow-400" />
                    Host Controls
                </h3>
                <Shield className="w-5 h-5 text-yellow-400" />
            </div>

            {/* Game Settings Section */}
            <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-300">Game Settings</h4>

                <div className="grid grid-cols-2 gap-3">
                    {/* Grid Size */}
                    <div>
                        <label className="text-xs text-gray-400 block mb-1">Grid Size</label>
                        <select
                            value={lobby.settings.gridSize}
                            onChange={(e) => onUpdateSettings({ gridSize: Number(e.target.value) })}
                            className="w-full bg-slate-700 text-white rounded px-3 py-2 text-sm border border-slate-600 hover:border-slate-500 focus:border-cyan-400 focus:outline-none"
                        >
                            <option value={3}>3x3 (Quick)</option>
                            <option value={4}>4x4 (Standard)</option>
                            <option value={5}>5x5 (Long)</option>
                            <option value={6}>6x6 (Epic)</option>
                        </select>
                    </div>

                    {/* Max Players */}
                    <div>
                        <label className="text-xs text-gray-400 block mb-1">Max Players</label>
                        <select
                            value={lobby.settings.maxPlayers}
                            onChange={(e) => onUpdateSettings({ maxPlayers: Number(e.target.value) })}
                            className="w-full bg-slate-700 text-white rounded px-3 py-2 text-sm border border-slate-600 hover:border-slate-500 focus:border-cyan-400 focus:outline-none"
                            disabled={totalPlayers > 2} // Can't reduce below current player count
                        >
                            {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                                <option key={n} value={n} disabled={n < totalPlayers}>
                                    {n} Players
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Toggle Settings */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 bg-slate-700/50 rounded">
                        <span className="text-sm text-gray-300">Voice Chat</span>
                        <button
                            onClick={() => onUpdateSettings({ voiceChatEnabled: !lobby.settings.voiceChatEnabled })}
                            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${lobby.settings.voiceChatEnabled
                                    ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                }`}
                        >
                            {lobby.settings.voiceChatEnabled ? 'ON' : 'OFF'}
                        </button>
                    </div>

                    <div className="flex items-center justify-between p-2 bg-slate-700/50 rounded">
                        <span className="text-sm text-gray-300">Computer Players</span>
                        <button
                            onClick={() => onUpdateSettings({ allowComputerPlayers: !lobby.settings.allowComputerPlayers })}
                            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${lobby.settings.allowComputerPlayers
                                    ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                }`}
                        >
                            {lobby.settings.allowComputerPlayers ? 'ALLOWED' : 'DISABLED'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Player Management Section */}
            <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-300">Player Management</h4>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                    {lobby.players.filter(p => p.id !== currentUserId).map(player => {
                        const isReady = lobby.readyPlayers.includes(player.id)

                        return (
                            <div
                                key={player.id}
                                className="flex items-center justify-between p-2 bg-slate-700/50 rounded hover:bg-slate-700 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                                        style={{ backgroundColor: player.color }}
                                    >
                                        {player.avatar || player.initials}
                                    </div>
                                    <div>
                                        <p className="text-sm text-white">{player.name}</p>
                                        <p className="text-xs text-gray-400">
                                            {isReady ? '✓ Ready' : 'Not ready'}
                                        </p>
                                    </div>
                                </div>

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-slate-600"
                                        >
                                            <MoreVertical className="w-4 h-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                                        <DropdownMenuItem
                                            onClick={() => onPromoteToHost(player.id)}
                                            className="text-yellow-400 hover:bg-yellow-500/20 cursor-pointer"
                                        >
                                            <Crown className="w-4 h-4 mr-2" />
                                            Make Host
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator className="bg-slate-700" />
                                        <DropdownMenuItem
                                            onClick={() => onKickPlayer(player.id)}
                                            className="text-red-400 hover:bg-red-500/20 cursor-pointer"
                                        >
                                            <UserX className="w-4 h-4 mr-2" />
                                            Kick Player
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        )
                    })}
                </div>

                {lobby.players.length === 1 && (
                    <Alert className="bg-blue-500/10 border-blue-500/30">
                        <AlertCircle className="h-4 w-4 text-blue-400" />
                        <AlertDescription className="text-blue-300 text-sm">
                            Waiting for other players to join...
                        </AlertDescription>
                    </Alert>
                )}
            </div>

            {/* Game Control Section */}
            <div className="space-y-2 pt-2 border-t border-slate-700">
                <Button
                    onClick={onStartGame}
                    disabled={!canStart}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Play className="w-4 h-4 mr-2" />
                    Start Game ({readyCount}/{totalPlayers} ready)
                </Button>

                {!canStart && totalPlayers >= 2 && (
                    <p className="text-xs text-yellow-400 text-center">
                        All players must be ready to start
                    </p>
                )}

                <Button
                    onClick={onCancelGame}
                    variant="destructive"
                    className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
                >
                    <X className="w-4 h-4 mr-2" />
                    Cancel Game
                </Button>
            </div>

            {/* Kicked Users Info */}
            {lobby.kickedUsers.length > 0 && (
                <Alert className="bg-orange-500/10 border-orange-500/30">
                    <AlertCircle className="h-4 w-4 text-orange-400" />
                    <AlertDescription className="text-orange-300 text-xs">
                        {lobby.kickedUsers.length} player(s) have been kicked
                    </AlertDescription>
                </Alert>
            )}
        </Card>
    )
}
