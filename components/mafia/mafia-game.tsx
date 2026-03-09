"use client"

import React, { useEffect, useState } from "react"
import { mafiaManager, type MafiaSession, type MafiaPlayer, type MafiaRole } from "@/utils/games/mafia-game"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Skull, Moon, Sun, Vote, X, AlertTriangle, Shield, Search, Heart } from "lucide-react"

interface MafiaGameProps {
    config: any
    roomId: string
    userId: string
    userName: string
    isHost: boolean
    onClose: () => void
}

export function MafiaGame({ config, roomId, userId, userName, isHost, onClose }: MafiaGameProps) {
    const [session, setSession] = useState<MafiaSession | null>(null)
    const [myRole, setMyRole] = useState<MafiaRole | null>(null)
    const [showRole, setShowRole] = useState(false)

    useEffect(() => {
        // Initialize session
        mafiaManager.initialize(roomId, userId, userName)
        mafiaManager.createSession(config)

        const unsubscribe = mafiaManager.subscribe((state) => {
            setSession(state.session)
            setMyRole(state.myRole)
        })

        return () => {
            unsubscribe()
            mafiaManager.destroy()
        }
    }, [roomId, userId, userName, config])

    const handleLeave = async () => {
        await mafiaManager.leaveSession()
        onClose()
    }

    if (!session) {
        return (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                <Card className="bg-slate-800 border-slate-700 max-w-md w-full mx-4">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Mafia/Werewolf
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-slate-300 text-center">Waiting for game to start...</p>
                        <Button onClick={handleLeave} variant="outline" className="w-full">
                            Leave Game
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
            <Card className="bg-slate-800 border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-auto">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                        <Skull className="h-5 w-5 text-red-400" />
                        Mafia/Werewolf - Day {session.dayNumber}
                    </CardTitle>
                    <Button variant="ghost" size="icon" onClick={handleLeave}>
                        <X className="h-5 w-5" />
                    </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Phase Indicator */}
                    <div className="flex items-center justify-center gap-2">
                        {session.phase === "night" ? (
                            <Moon className="h-5 w-5 text-blue-400" />
                        ) : (
                            <Sun className="h-5 w-5 text-yellow-400" />
                        )}
                        <span className="text-lg font-medium capitalize text-white">
                            {session.phase}
                        </span>
                    </div>

                    {/* My Role (hidden until revealed) */}
                    {!showRole && myRole && (
                        <div className="text-center">
                            <Button onClick={() => setShowRole(true)}>
                                Reveal My Role
                            </Button>
                        </div>
                    )}
                    {showRole && myRole && (
                        <div className="text-center p-4 bg-slate-700/50 rounded-lg">
                            <p className="text-sm text-slate-400 mb-1">Your Role</p>
                            <p className="text-xl font-bold capitalize text-white flex items-center justify-center gap-2">
                                {getRoleIcon(myRole)}
                                {myRole}
                            </p>
                            <p className="text-sm text-slate-400 mt-2">{getRoleDescription(myRole)}</p>
                        </div>
                    )}

                    {/* Player List */}
                    <div className="space-y-2">
                        <h3 className="text-sm font-medium text-slate-400">
                            Players ({Object.keys(session.players).length}/{session.maxPlayers})
                        </h3>
                        <div className="grid gap-2">
                            {Object.values(session.players).map((player: MafiaPlayer) => (
                                <div
                                    key={player.id}
                                    className={`flex items-center justify-between p-3 rounded-lg ${player.isAlive ? "bg-slate-700/50" : "bg-red-900/20"
                                        }`}
                                >
                                    <div className="flex items-center gap-2">
                                        {getRoleIcon(player.role)}
                                        <span className={player.isAlive ? "text-white" : "text-slate-500"}>
                                            {player.name}
                                        </span>
                                        {!player.isAlive && (
                                            <Skull className="h-4 w-4 text-red-400" />
                                        )}
                                    </div>
                                    <span className="text-xs text-slate-400 capitalize">
                                        {player.role}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="flex justify-center gap-6 text-sm">
                        <div className="text-center">
                            <p className="text-slate-400">Alive</p>
                            <p className="text-xl font-bold text-green-400">{session.aliveCount}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-slate-400">Mafia/Werewolves</p>
                            <p className="text-xl font-bold text-red-400">{session.mafiaCount}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

function getRoleIcon(role: MafiaRole): React.ReactNode {
    switch (role) {
        case "mafia":
        case "werewolf":
            return <Skull className="h-4 w-4 text-red-400" />
        case "minion":
            return <AlertTriangle className="h-4 w-4 text-orange-400" />
        case "detective":
            return <Search className="h-4 w-4 text-blue-400" />
        case "doctor":
            return <Heart className="h-4 w-4 text-green-400" />
        case "witch":
            return <AlertTriangle className="h-4 w-4 text-purple-400" />
        case "hunter":
            return <Skull className="h-4 w-4 text-amber-400" />
        case "cupid":
            return <Heart className="h-4 w-4 text-pink-400" />
        case "elder":
            return <Shield className="h-4 w-4 text-gray-400" />
        case "little-girl":
            return <Users className="h-4 w-4 text-yellow-400" />
        case "villager":
        default:
            return <Users className="h-4 w-4 text-gray-400" />
    }
}

function getRoleDescription(role: MafiaRole): string {
    switch (role) {
        case "mafia":
            return "Kill a player each night"
        case "werewolf":
            return "Kill villagers at night"
        case "minion":
            return "Help the mafia win"
        case "detective":
            return "Discover the mafia each night"
        case "doctor":
            return "Protect a player each night"
        case "witch":
            return "Has special potions"
        case "hunter":
            return "Can take someone with you when you die"
        case "cupid":
            return "Link two players as lovers"
        case "elder":
            return "Cannot be killed by mafia the first night"
        case "little-girl":
            return "Can peek during the night"
        case "villager":
        default:
            return "Find and lynch the mafia"
    }
}
