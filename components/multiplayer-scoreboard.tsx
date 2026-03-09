"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import type { Player, GameState } from "@/utils/games/dots-and-boxes-game"
import { PlayerAvatar } from "./player-avatar"
import { Trophy, Medal, Award, TrendingUp, Target } from "lucide-react"

interface MultiplayerScoreboardProps {
    gameState: GameState
    currentPlayerId?: string
    compact?: boolean
}

export function MultiplayerScoreboard({
    gameState,
    currentPlayerId,
    compact = false,
}: MultiplayerScoreboardProps) {
    const [sortedPlayers, setSortedPlayers] = useState<Player[]>([])

    useEffect(() => {
        // Sort players by score (descending)
        const sorted = [...gameState.players].sort((a, b) => {
            const scoreA = gameState.scores[a.id] || 0
            const scoreB = gameState.scores[b.id] || 0
            return scoreB - scoreA
        })
        setSortedPlayers(sorted)
    }, [gameState.players, gameState.scores])

    const totalBoxes = gameState.boxes.reduce(
        (sum, row) => sum + row.filter(box => box.isCompleted).length,
        0
    )
    const maxPossibleBoxes = gameState.grid.rows * gameState.grid.cols

    const getRankIcon = (rank: number) => {
        switch (rank) {
            case 0:
                return <Trophy className="w-5 h-5 text-yellow-400" />
            case 1:
                return <Medal className="w-5 h-5 text-gray-400" />
            case 2:
                return <Award className="w-5 h-5 text-orange-600" />
            default:
                return null
        }
    }

    const getScorePercentage = (score: number): number => {
        return maxPossibleBoxes > 0 ? (score / maxPossibleBoxes) * 100 : 0
    }

    if (compact) {
        return (
            <Card className="bg-slate-800/50 border-slate-700 p-3">
                <div className="space-y-2">
                    {sortedPlayers.slice(0, 3).map((player, index) => {
                        const score = gameState.scores[player.id] || 0
                        const isCurrent = player.id === currentPlayerId

                        return (
                            <div
                                key={player.id}
                                className={`flex items-center justify-between p-2 rounded ${isCurrent ? 'bg-cyan-500/10 border border-cyan-500/30' : 'bg-slate-700/50'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    {getRankIcon(index)}
                                    <PlayerAvatar player={player} size="sm" />
                                    <span className="text-sm text-white font-medium">{player.name}</span>
                                </div>
                                <span className="text-lg font-bold text-white">{score}</span>
                            </div>
                        )
                    })}
                    {sortedPlayers.length > 3 && (
                        <p className="text-xs text-gray-500 text-center">
                            +{sortedPlayers.length - 3} more players
                        </p>
                    )}
                </div>
            </Card>
        )
    }

    return (
        <Card className="bg-slate-800/50 border-slate-700 p-4">
            <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-yellow-400" />
                        Scoreboard
                    </h3>
                    <div className="text-sm text-gray-400">
                        {totalBoxes}/{maxPossibleBoxes} boxes
                    </div>
                </div>

                {/* Players List */}
                <div className="space-y-2">
                    {sortedPlayers.map((player, index) => {
                        const score = gameState.scores[player.id] || 0
                        const percentage = getScorePercentage(score)
                        const isCurrent = player.id === currentPlayerId
                        const isCurrentTurn = gameState.players[gameState.currentPlayerIndex]?.id === player.id

                        return (
                            <div
                                key={player.id}
                                className={`relative overflow-hidden rounded-lg transition-all ${isCurrent
                                        ? 'bg-cyan-500/10 border-2 border-cyan-500/50'
                                        : 'bg-slate-700/50 border-2 border-transparent'
                                    } ${isCurrentTurn ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-800' : ''}`}
                            >
                                {/* Progress Bar Background */}
                                <div
                                    className="absolute inset-0 transition-all duration-500"
                                    style={{
                                        background: `linear-gradient(to right, ${player.color}20 ${percentage}%, transparent ${percentage}%)`,
                                    }}
                                />

                                {/* Content */}
                                <div className="relative p-3 flex items-center justify-between">
                                    <div className="flex items-center gap-3 flex-1">
                                        {/* Rank */}
                                        <div className="w-8 flex items-center justify-center">
                                            {getRankIcon(index) || (
                                                <span className="text-lg font-bold text-gray-500">#{index + 1}</span>
                                            )}
                                        </div>

                                        {/* Avatar */}
                                        <PlayerAvatar player={player} size="md" />

                                        {/* Player Info */}
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-white font-semibold">{player.name}</span>
                                                {isCurrentTurn && (
                                                    <span className="text-xs bg-cyan-500 text-white px-2 py-0.5 rounded-full">
                                                        Playing
                                                    </span>
                                                )}
                                                {player.status === 'disconnected' && (
                                                    <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">
                                                        Offline
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <div className="flex-1 bg-slate-600 rounded-full h-1.5 overflow-hidden">
                                                    <div
                                                        className="h-full transition-all duration-500"
                                                        style={{
                                                            width: `${percentage}%`,
                                                            backgroundColor: player.color,
                                                        }}
                                                    />
                                                </div>
                                                <span className="text-xs text-gray-400">{percentage.toFixed(0)}%</span>
                                            </div>
                                        </div>

                                        {/* Score */}
                                        <div className="text-right">
                                            <div className="text-2xl font-bold text-white">{score}</div>
                                            <div className="text-xs text-gray-400">boxes</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Game Stats */}
                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-700">
                    <div className="text-center">
                        <div className="text-xs text-gray-400 mb-1">Total Moves</div>
                        <div className="text-lg font-bold text-white">{gameState.moveCount}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xs text-gray-400 mb-1">Completion</div>
                        <div className="text-lg font-bold text-white">
                            {((totalBoxes / maxPossibleBoxes) * 100).toFixed(0)}%
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="text-xs text-gray-400 mb-1">Leader</div>
                        <div className="text-lg font-bold" style={{ color: sortedPlayers[0]?.color }}>
                            {sortedPlayers[0]?.name.substring(0, 8)}
                        </div>
                    </div>
                </div>

                {/* Winner Display */}
                {gameState.gameStatus === 'finished' && gameState.winner && (
                    <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-lg p-4 text-center">
                        <Trophy className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                        <p className="text-lg font-bold text-white">
                            {sortedPlayers[0]?.name} Wins!
                        </p>
                        <p className="text-sm text-gray-300 mt-1">
                            with {gameState.scores[gameState.winner]} boxes
                        </p>
                    </div>
                )}
            </div>
        </Card>
    )
}
