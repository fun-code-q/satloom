"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Lock, LockOpen, HelpCircle } from "lucide-react"
import { roomPasswordManager, RoomPasswordState } from "@/utils/infra/room-password"

interface PasswordEntryModalProps {
    isOpen: boolean
    roomId: string
    onSuccess: () => void
    onCancel: () => void
}

export function PasswordEntryModal({ isOpen, roomId, onSuccess, onCancel }: PasswordEntryModalProps) {
    const [pin, setPin] = useState("")
    const [hint, setHint] = useState<string | null>(null)
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)
    const [passwordState, setPasswordState] = useState<RoomPasswordState>({
        isProtected: false,
        isLockedOut: false,
        remainingAttempts: 3,
        lockoutTimeRemaining: 0,
    })

    useEffect(() => {
        if (isOpen) {
            roomPasswordManager.initialize(roomId)

            // Load hint
            roomPasswordManager.getHint().then((h) => setHint(h))

            // Subscribe to state changes
            const unsubscribe = roomPasswordManager.subscribe((state) => {
                setPasswordState(state)
                if (state.isLockedOut) {
                    setError(`Locked out! Try again in ${state.lockoutTimeRemaining} seconds`)
                }
            })

            return () => {
                unsubscribe()
            }
        }
    }, [isOpen, roomId])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")
        setLoading(true)

        try {
            const result = await roomPasswordManager.validatePassword(pin, "guest-user-id")
            if (result.success) {
                onSuccess()
                setPin("")
                setError("")
            } else {
                setError(result.error || "Invalid PIN")
            }
        } catch (err) {
            setError("Failed to validate PIN")
        } finally {
            setLoading(false)
        }
    }

    const handleCancel = () => {
        setPin("")
        setError("")
        onCancel()
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleCancel}>
            <DialogContent className="bg-slate-800 border-slate-700 text-white w-full max-w-sm mx-4">
                <DialogHeader>
                    <DialogTitle className="text-center text-cyan-400 flex items-center justify-center gap-2">
                        <Lock className="w-5 h-5" />
                        Enter Room PIN
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Hint */}
                    {hint && (
                        <div className="flex items-center gap-2 p-3 bg-slate-700/50 rounded-lg">
                            <HelpCircle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                            <span className="text-sm text-gray-300">Hint: {hint}</span>
                        </div>
                    )}

                    {/* PIN Input */}
                    <div>
                        <Input
                            id="room-pin-input"
                            name="room-pin"
                            type="password"
                            maxLength={6}
                            value={pin}
                            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                            placeholder="Enter 4-6 digit PIN"
                            className="text-center text-2xl tracking-widest bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                            disabled={loading || passwordState.isLockedOut}
                            autoFocus
                        />
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
                            <p className="text-sm text-red-400 text-center">{error}</p>
                        </div>
                    )}

                    {/* Attempts Remaining */}
                    {!passwordState.isLockedOut && passwordState.remainingAttempts < 3 && (
                        <div className="text-center">
                            <p className="text-sm text-yellow-400">
                                {passwordState.remainingAttempts} attempts remaining
                            </p>
                        </div>
                    )}

                    {/* Buttons */}
                    <div className="flex gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleCancel}
                            className="flex-1 border-slate-600 text-gray-300 hover:bg-slate-700 bg-transparent"
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1 bg-cyan-500 hover:bg-cyan-600"
                            disabled={loading || pin.length < 4 || passwordState.isLockedOut}
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <span className="animate-spin">⏳</span>
                                    Checking...
                                </span>
                            ) : (
                                <span className="flex items-center gap-2">
                                    <LockOpen className="w-4 h-4" />
                                    Join Room
                                </span>
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
