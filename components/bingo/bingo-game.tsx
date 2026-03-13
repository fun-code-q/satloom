"use client"

import React, { useEffect, useState } from "react"
import { bingoGameManager, type BingoCard } from "@/utils/games/bingo-game"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy, Users, Volume2, VolumeX, Share2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { NotificationSystem } from "@/utils/core/notification-system"

interface BingoGameProps {
    roomId: string
    userId: string
    userName: string
}

export function BingoGame({ roomId, userId, userName }: BingoGameProps) {
    const [myCard, setMyCard] = useState<BingoCard | null>(null)
    const [calledWords, setCalledWords] = useState<string[]>([])
    const [gameStatus, setGameStatus] = useState<"lobby" | "playing" | "finished">("lobby")
    const [winner, setWinner] = useState<string | null>(null)
    const [isMuted, setIsMuted] = useState(false)
    const [otherPlayers, setOtherPlayers] = useState<Record<string, BingoCard>>({})

    useEffect(() => {
        bingoGameManager.initialize(roomId, userId, userName)

        const unsubscribe = bingoGameManager.subscribe((state) => {
            setMyCard(state.myCard)
            setCalledWords(state.calledWords)
            setGameStatus(state.game?.status || "lobby")
            setWinner(state.game?.winner || null)
            if (state.game?.cards) {
                const others = { ...state.game.cards }
                delete others[userId]
                setOtherPlayers(others)
            }
        })

        return () => {
            unsubscribe()
            bingoGameManager.destroy()
        }
    }, [roomId, userId, userName])

    useEffect(() => {
        if (gameStatus === "finished") {
            const notificationSystem = NotificationSystem.getInstance()
            if (winner === userId) {
                notificationSystem.gameWon("Bingo")
            } else if (winner) {
                notificationSystem.gameLost("Bingo")
            }
        }
    }, [gameStatus, winner, userId])

    const handleMarkWord = async (word: string) => {
        if (!myCard) return

        const gameId = bingoGameManager.getState().game?.id
        if (gameId) {
            await bingoGameManager.markWord(gameId, word)
        }
    }

    const handleLeaveGame = async () => {
        const gameId = bingoGameManager.getState().game?.id
        if (gameId) {
            await bingoGameManager.leaveGame(gameId)
        }
    }

    const playBingoSound = () => {
        if (!isMuted) {
            // Simple beep sound
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
            const oscillator = audioContext.createOscillator()
            const gainNode = audioContext.createGain()

            oscillator.connect(gainNode)
            gainNode.connect(audioContext.destination)

            oscillator.frequency.value = 800
            oscillator.type = "sine"
            gainNode.gain.value = 0.1

            oscillator.start()
            setTimeout(() => oscillator.stop(), 200)
        }
    }

    return (
        <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-md flex flex-col items-center overflow-auto p-4 animate-in fade-in duration-300">
            <div className="flex flex-col items-center gap-4 w-full max-w-4xl">
                {/* Header */}
                <div className="flex items-center justify-between w-full max-w-lg">
                    <h2 className="text-2xl font-bold text-white">Buzzword Bingo</h2>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setIsMuted(!isMuted)}
                        >
                            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                        </Button>
                        <Button variant="outline" onClick={handleLeaveGame}>
                            Leave
                        </Button>
                    </div>
                </div>

                {/* Status Bar */}
                <div className="flex items-center gap-4">
                    <Badge variant={gameStatus === "playing" ? "default" : "secondary"}>
                        {gameStatus === "lobby" && "Waiting to start..."}
                        {gameStatus === "playing" && "Game in progress"}
                        {gameStatus === "finished" && "Game ended"}
                    </Badge>
                    {winner && (
                        <Badge variant="default" className="bg-yellow-500">
                            <Trophy className="h-3 w-3 mr-1" />
                            Winner: {winner === userId ? "You!" : "Someone"}
                        </Badge>
                    )}
                </div>

                {/* Called Words */}
                {calledWords.length > 0 && (
                    <Card className="bg-slate-800 border-slate-700 w-full max-w-lg">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-white text-lg flex items-center gap-2">
                                <Volume2 className="h-4 w-4 text-purple-400" />
                                Called Words ({calledWords.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-2">
                                {calledWords.map((word, index) => (
                                    <span
                                        key={index}
                                        className="px-2 py-1 rounded bg-purple-500/20 text-purple-300 text-sm"
                                    >
                                        {word}
                                    </span>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* My Bingo Card */}
                {myCard && (
                    <Card className="bg-slate-800 border-slate-700">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-white">Your Card</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-5 gap-1">
                                {myCard.words.map((word, index) => {
                                    const isMarked = myCard.markedWords.includes(word)
                                    const isCalled = calledWords.includes(word)
                                    const isCenter = index === 12

                                    return (
                                        <button
                                            key={index}
                                            onClick={() => {
                                                if (isCalled && !isMarked) {
                                                    handleMarkWord(word)
                                                }
                                            }}
                                            disabled={!isCalled || isMarked || isCenter || gameStatus !== "playing"}
                                            className={cn(
                                                "w-16 h-16 sm:w-20 sm:h-20 text-xs sm:text-sm font-medium rounded transition-all",
                                                "flex items-center justify-center text-center p-1",
                                                isCenter && "bg-slate-700 text-slate-400 cursor-default",
                                                !isCenter && !isMarked && isCalled && "bg-green-500/20 text-green-400 hover:bg-green-500/30 cursor-pointer",
                                                !isCenter && !isMarked && !isCalled && "bg-slate-700 text-slate-400 cursor-not-allowed",
                                                isMarked && "bg-purple-500 text-white",
                                                gameStatus !== "playing" && "opacity-50 cursor-not-allowed"
                                            )}
                                        >
                                            <span className="truncate">{word}</span>
                                        </button>
                                    )
                                })}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Other Players */}
                {Object.keys(otherPlayers).length > 0 && (
                    <Card className="bg-slate-800 border-slate-700 w-full max-w-lg">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-white flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                Other Players ({Object.keys(otherPlayers).length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-2">
                                {Object.values(otherPlayers).map((card) => (
                                    <div
                                        key={card.userId}
                                        className="flex items-center justify-between p-2 rounded bg-slate-700"
                                    >
                                        <span className="text-white">{card.userName}</span>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline">
                                                {card.markedWords.length} marked
                                            </Badge>
                                            {card.hasBingo && (
                                                <Badge className="bg-yellow-500">
                                                    <Trophy className="h-3 w-3 mr-1" />
                                                    BINGO!
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Bingo Button */}
                {myCard && myCard.hasBingo && gameStatus === "playing" && (
                    <Button
                        onClick={playBingoSound}
                        className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold"
                        size="lg"
                    >
                        <Trophy className="h-5 w-5 mr-2" />
                        BINGO!
                    </Button>
                )}
            </div>
        </div>
    )
}
