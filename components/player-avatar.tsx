"use client"

import type { Player } from "@/utils/games/dots-and-boxes-game"
import { Crown, Wifi, WifiOff, Bot } from "lucide-react"

interface PlayerAvatarProps {
    player: Player
    size?: 'sm' | 'md' | 'lg' | 'xl'
    showStatus?: boolean
    showBadges?: boolean
    className?: string
}

const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-xl',
}

const badgeSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
    xl: 'w-5 h-5',
}

export function PlayerAvatar({
    player,
    size = 'md',
    showStatus = true,
    showBadges = true,
    className = '',
}: PlayerAvatarProps) {
    const isDisconnected = player.status === 'disconnected'
    const isSpectator = player.status === 'spectator'

    return (
        <div className={`relative inline-block ${className}`}>
            {/* Avatar Circle */}
            <div
                className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-bold text-white shadow-lg transition-all ${isDisconnected ? 'opacity-50 grayscale' : ''
                    } ${isSpectator ? 'opacity-60' : ''}`}
                style={{
                    backgroundColor: player.color,
                    boxShadow: `0 0 0 2px ${player.color}40`,
                }}
            >
                {player.avatar || player.initials}
            </div>

            {/* Badges */}
            {showBadges && (
                <>
                    {/* Host Badge */}
                    {player.isHost && (
                        <div className="absolute -top-1 -right-1 bg-yellow-400 rounded-full p-0.5 shadow-lg">
                            <Crown className={`${badgeSizes[size]} text-yellow-900`} />
                        </div>
                    )}

                    {/* AI Badge */}
                    {player.isComputer && !player.isHost && (
                        <div className="absolute -top-1 -right-1 bg-blue-400 rounded-full p-0.5 shadow-lg">
                            <Bot className={`${badgeSizes[size]} text-blue-900`} />
                        </div>
                    )}
                </>
            )}

            {/* Status Indicator */}
            {showStatus && (
                <div className="absolute -bottom-0.5 -right-0.5">
                    {isDisconnected ? (
                        <div className="bg-red-500 rounded-full p-0.5 shadow-lg">
                            <WifiOff className={`${badgeSizes[size]} text-white`} />
                        </div>
                    ) : player.status === 'active' ? (
                        <div className="bg-green-500 rounded-full w-3 h-3 border-2 border-slate-900 shadow-lg" />
                    ) : null}
                </div>
            )}
        </div>
    )
}

interface PlayerAvatarGroupProps {
    players: Player[]
    maxVisible?: number
    size?: 'sm' | 'md' | 'lg' | 'xl'
    className?: string
}

export function PlayerAvatarGroup({
    players,
    maxVisible = 5,
    size = 'md',
    className = '',
}: PlayerAvatarGroupProps) {
    const visiblePlayers = players.slice(0, maxVisible)
    const remainingCount = Math.max(0, players.length - maxVisible)

    return (
        <div className={`flex items-center ${className}`}>
            <div className="flex -space-x-2">
                {visiblePlayers.map((player) => (
                    <PlayerAvatar
                        key={player.id}
                        player={player}
                        size={size}
                        showBadges={false}
                        className="ring-2 ring-slate-900"
                    />
                ))}
            </div>

            {remainingCount > 0 && (
                <div
                    className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-bold text-white bg-slate-700 ml-2 ring-2 ring-slate-900`}
                >
                    +{remainingCount}
                </div>
            )}
        </div>
    )
}
