"use client"

import React, { useState } from "react"
import { BaseModal } from "@/components/base-modal"
import { Button } from "@/components/ui/button"
import { Users, Play, Users2, Shield, Skull, Search, Heart } from "lucide-react"

interface MafiaSetupModalProps {
    onClose: () => void
    onStartSession: (config: {
        minPlayers: number
        maxPlayers: number
        roles: Record<string, number>
    }) => void
}

export function MafiaSetupModal({
    onClose,
    onStartSession
}: MafiaSetupModalProps) {
    const [minPlayers, setMinPlayers] = useState(5)
    const [maxPlayers, setMaxPlayers] = useState(10)

    const handleCreateGame = () => {
        const config = {
            minPlayers,
            maxPlayers,
            roles: {
                mafia: Math.floor(maxPlayers / 4),
                werewolf: Math.floor(maxPlayers / 6) || 1,
                detective: 1,
                doctor: 1,
                witch: 0,
                hunter: 0,
                cupid: 0,
                minion: 0,
            }
        }
        onStartSession(config)
    }

    return (
        <BaseModal
            isOpen={true}
            onClose={onClose}
            title="Mafia/Werewolf Game"
            description="Create a game of social deduction"
            className="max-w-md"
        >
            <div className="space-y-6">
                {/* Player Count Selection */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Minimum Players</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setMinPlayers(Math.max(3, minPlayers - 1))}
                                disabled={minPlayers <= 3}
                            >
                                -
                            </Button>
                            <span className="w-8 text-center font-medium">{minPlayers}</span>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setMinPlayers(Math.min(maxPlayers - 1, minPlayers + 1))}
                                disabled={minPlayers >= maxPlayers - 1}
                            >
                                +
                            </Button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Users2 className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Maximum Players</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setMaxPlayers(Math.min(18, Math.max(minPlayers + 1, maxPlayers - 1)))}
                                disabled={maxPlayers <= minPlayers + 1}
                            >
                                -
                            </Button>
                            <span className="w-8 text-center font-medium">{maxPlayers}</span>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setMaxPlayers(Math.min(18, maxPlayers + 1))}
                                disabled={maxPlayers >= 18}
                            >
                                +
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Role Distribution Preview */}
                <div className="space-y-3">
                    <span className="text-sm font-medium flex items-center gap-2">
                        <Skull className="h-4 w-4" />
                        Role Distribution
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center justify-between p-2 rounded bg-red-500/10">
                            <span className="flex items-center gap-2">
                                <Skull className="h-4 w-4 text-red-400" />
                                Mafia
                            </span>
                            <span className="font-medium">{Math.floor(maxPlayers / 4)}</span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded bg-orange-500/10">
                            <span className="flex items-center gap-2">
                                <Skull className="h-4 w-4 text-orange-400" />
                                Werewolf
                            </span>
                            <span className="font-medium">{Math.floor(maxPlayers / 6) || 1}</span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded bg-blue-500/10">
                            <span className="flex items-center gap-2">
                                <Search className="h-4 w-4 text-blue-400" />
                                Detective
                            </span>
                            <span className="font-medium">1</span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded bg-green-500/10">
                            <span className="flex items-center gap-2">
                                <Heart className="h-4 w-4 text-green-400" />
                                Doctor
                            </span>
                            <span className="font-medium">1</span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded bg-purple-500/10 col-span-2">
                            <span className="flex items-center gap-2">
                                <Shield className="h-4 w-4 text-purple-400" />
                                Villagers
                            </span>
                            <span className="font-medium">{maxPlayers - Math.floor(maxPlayers / 4) - (Math.floor(maxPlayers / 6) || 1) - 2}</span>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="flex-1"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleCreateGame}
                        disabled={maxPlayers < minPlayers || maxPlayers < 4}
                        className="flex-1"
                    >
                        <Play className="h-4 w-4 mr-2" />
                        Create Game
                    </Button>
                </div>
            </div>
        </BaseModal>
    )
}
