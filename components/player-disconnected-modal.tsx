"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { WifiOff, RefreshCw, LogOut, Clock } from "lucide-react"

interface PlayerDisconnectedModalProps {
    isOpen: boolean
    onReconnect: () => void
    onLeaveGame: () => void
    reconnectAttempt: number
    maxAttempts: number
}

export function PlayerDisconnectedModal({
    isOpen,
    onReconnect,
    onLeaveGame,
    reconnectAttempt,
    maxAttempts,
}: PlayerDisconnectedModalProps) {
    const [timeLeft, setTimeLeft] = useState(300) // 5 minutes in seconds

    useEffect(() => {
        if (!isOpen) return

        const interval = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(interval)
                    onLeaveGame() // Auto-leave when time expires
                    return 0
                }
                return prev - 1
            })
        }, 1000)

        return () => clearInterval(interval)
    }, [isOpen, onLeaveGame])

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    const progressPercent = (reconnectAttempt / maxAttempts) * 100

    return (
        <Dialog open={isOpen} onOpenChange={() => { }}>
            <DialogContent
                className="bg-slate-900 border-red-500/50 text-white max-w-md"
                onPointerDownOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
            >
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold flex items-center gap-2 text-red-400">
                        <WifiOff className="w-6 h-6" />
                        Connection Lost
                    </DialogTitle>
                    <DialogDescription className="text-gray-400">
                        You've been disconnected from the game
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 mt-4">
                    {/* Reconnection Status */}
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-300">Reconnection Attempt</span>
                            <span className="text-sm font-semibold text-cyan-400">
                                {reconnectAttempt}/{maxAttempts}
                            </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>

                        <p className="text-xs text-gray-400 mt-2">
                            {reconnectAttempt < maxAttempts
                                ? 'Attempting to reconnect...'
                                : 'Max attempts reached. Try manual reconnect.'}
                        </p>
                    </div>

                    {/* Time Remaining */}
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                        <div className="flex items-center gap-3">
                            <Clock className="w-5 h-5 text-yellow-400" />
                            <div className="flex-1">
                                <p className="text-sm font-medium text-yellow-300">
                                    Rejoin Window
                                </p>
                                <p className="text-xs text-yellow-400/80">
                                    You have {formatTime(timeLeft)} to reconnect
                                </p>
                            </div>
                            <div className="text-2xl font-bold text-yellow-400">
                                {formatTime(timeLeft)}
                            </div>
                        </div>
                    </div>

                    {/* Warning Message */}
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                        <p className="text-sm text-red-300">
                            ⚠️ If you don't reconnect within 5 minutes, you'll be removed from the game.
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <Button
                            onClick={onReconnect}
                            className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white"
                        >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Reconnect Now
                        </Button>
                        <Button
                            onClick={onLeaveGame}
                            variant="ghost"
                            className="flex-1 hover:bg-red-500/20 text-red-400"
                        >
                            <LogOut className="w-4 h-4 mr-2" />
                            Leave Game
                        </Button>
                    </div>

                    {/* Help Text */}
                    <p className="text-xs text-center text-gray-500">
                        Check your internet connection and try reconnecting
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    )
}
