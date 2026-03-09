"use client"

import React, { useState } from "react"
import { DEFAULT_BINGO_WORDS, bingoGameManager } from "@/utils/games/bingo-game"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BaseModal } from "@/components/base-modal"
import { X, Users, Play, Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface BingoSetupModalProps {
    isOpen: boolean
    onClose: () => void
    roomId: string
    userId: string
    userName: string
}

export function BingoSetupModal({ isOpen, onClose, roomId, userId, userName }: BingoSetupModalProps) {
    const [words, setWords] = useState<string[]>(DEFAULT_BINGO_WORDS.slice(0, 24))
    const [customWord, setCustomWord] = useState("")
    const [playerCount, setPlayerCount] = useState(4)
    const [gameId, setGameId] = useState<string | null>(null)
    const [joinedPlayers, setJoinedPlayers] = useState<{ id: string; name: string }[]>([])

    const handleAddWord = () => {
        if (customWord.trim() && words.length < 40) {
            setWords([...words, customWord.trim()])
            setCustomWord("")
        }
    }

    const handleRemoveWord = (index: number) => {
        setWords(words.filter((_, i) => i !== index))
    }

    const handleCreateGame = async () => {
        bingoGameManager.initialize(roomId, userId, userName)
        await bingoGameManager.createGame(words.length >= 15 ? words : [...words, ...DEFAULT_BINGO_WORDS])

        // Listen for players joining
        bingoGameManager.subscribe((state) => {
            if (state.game) {
                setGameId(state.game.id)
                setJoinedPlayers(
                    Object.values(state.game.cards || {}).map((card) => ({
                        id: card.userId,
                        name: card.userName,
                    }))
                )
            }
        })
    }

    const handleStartGame = async () => {
        if (gameId) {
            await bingoGameManager.startGame(gameId)
        }
    }

    const handleJoinGame = () => {
        // Show game ID input dialog
        const gameIdToJoin = prompt("Enter Game ID to join:")
        if (gameIdToJoin) {
            bingoGameManager.initialize(roomId, userId, userName)
            bingoGameManager.listenForGame(gameIdToJoin)
            bingoGameManager.joinGame(gameIdToJoin)
        }
    }

    return (
        <BaseModal isOpen={isOpen} onClose={onClose} title="Buzzword Bingo" className="max-w-2xl">
            <div className="space-y-6">
                {/* Game ID Display (if created) */}
                {gameId && (
                    <Card className="bg-slate-800 border-slate-700">
                        <CardContent className="pt-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">Game ID</p>
                                    <p className="text-2xl font-mono font-bold text-purple-400">{gameId}</p>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => navigator.clipboard.writeText(gameId)}
                                >
                                    Copy
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Joined Players */}
                {joinedPlayers.length > 0 && (
                    <Card className="bg-slate-800 border-slate-700">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-white text-lg flex items-center gap-2">
                                <Users className="h-5 w-5" />
                                Players ({joinedPlayers.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-2">
                                {joinedPlayers.map((player) => (
                                    <div
                                        key={player.id}
                                        className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300"
                                    >
                                        {player.name}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Word Selection */}
                <Card className="bg-slate-800 border-slate-700">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-white text-lg">Custom Words ({words.length}/40)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Add Custom Word */}
                        <div className="flex gap-2">
                            <Input
                                value={customWord}
                                onChange={(e) => setCustomWord(e.target.value)}
                                placeholder="Add custom buzzword..."
                                className="bg-slate-700 border-slate-600"
                                onKeyDown={(e) => e.key === "Enter" && handleAddWord()}
                            />
                            <Button onClick={handleAddWord} disabled={words.length >= 40}>
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Word Grid */}
                        <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                            {words.map((word, index) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between px-2 py-1 rounded bg-slate-700 text-xs text-white"
                                >
                                    <span className="truncate">{word}</span>
                                    <button
                                        onClick={() => handleRemoveWord(index)}
                                        className="text-slate-400 hover:text-red-400"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Player Count */}
                <Card className="bg-slate-800 border-slate-700">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-white text-lg">Settings</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-4">
                            <div>
                                <Label className="text-slate-300">Max Players</Label>
                                <div className="flex items-center gap-2 mt-1">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPlayerCount(Math.max(2, playerCount - 1))}
                                    >
                                        -
                                    </Button>
                                    <span className="text-xl font-bold text-white w-8 text-center">
                                        {playerCount}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPlayerCount(Math.min(20, playerCount + 1))}
                                    >
                                        +
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Action Buttons */}
                <div className="flex gap-3">
                    {!gameId ? (
                        <>
                            <Button
                                onClick={handleCreateGame}
                                className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500"
                            >
                                <Play className="h-4 w-4 mr-2" />
                                Create Game
                            </Button>
                            <Button variant="outline" onClick={handleJoinGame}>
                                Join Game
                            </Button>
                        </>
                    ) : (
                        <Button
                            onClick={handleStartGame}
                            className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500"
                            disabled={joinedPlayers.length < 2}
                        >
                            <Play className="h-4 w-4 mr-2" />
                            Start Game
                        </Button>
                    )}
                </div>
            </div>
        </BaseModal>
    )
}
