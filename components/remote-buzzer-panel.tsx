"use client"

import React, { useEffect, useState, useCallback } from "react"
import { remoteBuzzerManager } from "@/utils/infra/remote-buzzer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Trophy, Users, Zap, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"

interface RemoteBuzzerPanelProps {
    roomId: string
    userId: string
    userName: string
    isHost: boolean
}

export function RemoteBuzzerPanel({ roomId, userId, userName, isHost }: RemoteBuzzerPanelProps) {
    const [isActive, setIsActive] = useState(false)
    const [sessionState, setSessionState] = useState<string>("ready")
    const [activePlayer, setActivePlayer] = useState<{ id: string; name: string } | null>(null)
    const [canBuzz, setCanBuzz] = useState(false)
    const [hasBuzzed, setHasBuzzed] = useState(false)
    const [scoreboard, setScoreboard] = useState<{ id: string; name: string; score: number; buzzCount: number }[]>([])

    useEffect(() => {
        remoteBuzzerManager.initialize(roomId, userId, userName)

        const unsubscribe = remoteBuzzerManager.subscribe((state) => {
            setIsActive(state.isActive)
            setSessionState(state.session?.state || "ready")
            setActivePlayer(
                state.session?.activePlayerId
                    ? {
                        id: state.session.activePlayerId,
                        name: state.session.activePlayerName || "",
                    }
                    : null
            )
            setCanBuzz(state.canBuzz)
            setHasBuzzed(state.hasBuzzed)
            setScoreboard(remoteBuzzerManager.getScoreboard())
        })

        remoteBuzzerManager.listenForSession()

        return () => {
            unsubscribe()
            remoteBuzzerManager.destroy()
        }
    }, [roomId, userId, userName])

    const handleBuzz = useCallback(async () => {
        if (!canBuzz || hasBuzzed) return
        await remoteBuzzerManager.buzz()
    }, [canBuzz, hasBuzzed])

    const handleReset = useCallback(async () => {
        await remoteBuzzerManager.reset()
    }, [])

    const handleAwardPoints = useCallback(async (points: number) => {
        await remoteBuzzerManager.awardPoints(points)
    }, [])

    const handleJoinSession = useCallback(async () => {
        await remoteBuzzerManager.joinSession()
    }, [])

    const handleCreateSession = useCallback(async () => {
        await remoteBuzzerManager.createSession()
    }, [])

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-border">
                <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" />
                    <h2 className="font-semibold">Buzzer</h2>
                </div>
                {activePlayer && (
                    <div className="flex items-center gap-2 text-sm">
                        <Zap className="h-4 w-4 text-yellow-400 animate-pulse" />
                        <span className="text-yellow-400 font-medium">{activePlayer.name}</span>
                    </div>
                )}
            </div>

            {/* Main Buzzer Button */}
            <div className="flex-1 flex items-center justify-center p-4">
                {!isActive ? (
                    <div className="text-center space-y-4">
                        <p className="text-muted-foreground text-sm">No active buzzer session</p>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handleJoinSession}>
                                <Users className="h-4 w-4 mr-2" />
                                Join
                            </Button>
                            <Button onClick={handleCreateSession}>
                                <Zap className="h-4 w-4 mr-2" />
                                Create
                            </Button>
                        </div>
                    </div>
                ) : (
                    <Button
                        onClick={handleBuzz}
                        disabled={!canBuzz || hasBuzzed}
                        className={cn(
                            "w-40 h-40 rounded-full text-2xl font-bold transition-all",
                            canBuzz && !hasBuzzed
                                ? "bg-yellow-500 hover:bg-yellow-600 text-black shadow-lg shadow-yellow-500/30 animate-pulse"
                                : hasBuzzed
                                    ? "bg-gray-600 text-gray-400"
                                    : "bg-gray-700 text-gray-500"
                        )}
                    >
                        {hasBuzzed ? "Buzzed!" : "BUZZ!"}
                    </Button>
                )}
            </div>

            {/* Scoreboard */}
            {scoreboard.length > 0 && (
                <div className="p-3 border-t border-border">
                    <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-yellow-400" />
                        Scoreboard
                    </h3>
                    <div className="space-y-1">
                        {scoreboard.slice(0, 5).map((player, index) => (
                            <div
                                key={player.id}
                                className={cn(
                                    "flex items-center justify-between p-2 rounded",
                                    index === 0 && "bg-yellow-500/10"
                                )}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium w-6">{index + 1}.</span>
                                    <span className="text-sm">{player.name}</span>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                    <span>{player.score} pts</span>
                                    <span className="text-xs">({player.buzzCount} buzzes)</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Host Controls */}
            {isHost && isActive && (
                <div className="p-3 border-t border-border space-y-2">
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAwardPoints(1)}
                            className="flex-1"
                        >
                            +1 Point
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAwardPoints(2)}
                            className="flex-1"
                        >
                            +2 Points
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleReset}>
                            <RotateCcw className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
