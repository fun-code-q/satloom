"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Lock, LockOpen, Trash2, Shield, ShieldCheck } from "lucide-react"
import { roomPasswordManager } from "@/utils/infra/room-password"

interface HostPasswordModalProps {
    isOpen: boolean
    roomId: string
    isProtected: boolean
    onClose: () => void
    onProtectedChange: (isProtected: boolean) => void
}

export function HostPasswordModal({
    isOpen,
    roomId,
    isProtected,
    onClose,
    onProtectedChange,
}: HostPasswordModalProps) {
    const [pin, setPin] = useState("")
    const [confirmPin, setConfirmPin] = useState("")
    const [hint, setHint] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)

    const handleSetPassword = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")
        setSuccess(false)

        // Validation
        if (pin.length < 4) {
            setError("PIN must be at least 4 digits")
            return
        }

        if (pin !== confirmPin) {
            setError("PINs do not match")
            return
        }

        setLoading(true)

        try {
            const result = await roomPasswordManager.setPassword(pin, hint)
            if (result) {
                setSuccess(true)
                onProtectedChange(true)
                setTimeout(() => {
                    handleClose()
                }, 1500)
            } else {
                setError("Failed to set password")
            }
        } catch (err) {
            setError("Failed to set password")
        } finally {
            setLoading(false)
        }
    }

    const handleRemovePassword = async () => {
        setLoading(true)
        setError("")

        try {
            const result = await roomPasswordManager.removePassword()
            if (result) {
                setSuccess(true)
                onProtectedChange(false)
                setTimeout(() => {
                    handleClose()
                }, 1500)
            } else {
                setError("Failed to remove password")
            }
        } catch (err) {
            setError("Failed to remove password")
        } finally {
            setLoading(false)
        }
    }

    const handleClose = () => {
        setPin("")
        setConfirmPin("")
        setHint("")
        setError("")
        setSuccess(false)
        onClose()
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="bg-slate-800 border-slate-700 text-white w-full max-w-sm mx-4">
                <DialogHeader>
                    <DialogTitle className="text-center text-cyan-400 flex items-center justify-center gap-2">
                        <Shield className="w-5 h-5" />
                        Room Security
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Status */}
                    <div className="flex items-center justify-center gap-2 p-3 bg-slate-700/50 rounded-lg">
                        {isProtected ? (
                            <>
                                <ShieldCheck className="w-5 h-5 text-green-400" />
                                <span className="text-green-400">Room is password protected</span>
                            </>
                        ) : (
                            <>
                                <LockOpen className="w-5 h-5 text-yellow-400" />
                                <span className="text-yellow-400">Room is open to anyone</span>
                            </>
                        )}
                    </div>

                    {isProtected ? (
                        /* Remove Password */
                        <div className="space-y-3">
                            <p className="text-sm text-gray-300 text-center">
                                Remove the password to make this room public.
                            </p>
                            <Button
                                onClick={handleRemovePassword}
                                className="w-full bg-red-500 hover:bg-red-600"
                                disabled={loading}
                            >
                                {loading ? (
                                    <span className="flex items-center gap-2">
                                        <span className="animate-spin">⏳</span>
                                        Removing...
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2">
                                        <Trash2 className="w-4 h-4" />
                                        Remove Password
                                    </span>
                                )}
                            </Button>
                        </div>
                    ) : (
                        /* Set Password Form */
                        <form onSubmit={handleSetPassword} className="space-y-3">
                            <p className="text-sm text-gray-300 text-center">
                                Set a PIN to protect your room. Guests will need to enter it to join.
                            </p>

                            <div>
                                <label className="block text-xs text-gray-400 mb-1">New PIN (4-6 digits)</label>
                                <Input
                                    id="host-pin-input"
                                    name="host-pin"
                                    type="password"
                                    maxLength={6}
                                    value={pin}
                                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                                    placeholder="1234"
                                    className="text-center text-xl tracking-widest bg-slate-700 border-slate-600 text-white"
                                    disabled={loading}
                                />
                            </div>

                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Confirm PIN</label>
                                <Input
                                    id="host-confirm-pin"
                                    name="host-confirm-pin"
                                    type="password"
                                    maxLength={6}
                                    value={confirmPin}
                                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                                    placeholder="1234"
                                    className="text-center text-xl tracking-widest bg-slate-700 border-slate-600 text-white"
                                    disabled={loading}
                                />
                            </div>

                            <div>
                                <label className="block text-xs text-gray-400 mb-1">
                                    Hint (optional, shown to guests)
                                </label>
                                <Input
                                    id="host-hint-input"
                                    name="host-hint"
                                    type="text"
                                    value={hint}
                                    onChange={(e) => setHint(e.target.value)}
                                    placeholder="e.g., Our anniversary"
                                    className="bg-slate-700 border-slate-600 text-white"
                                    disabled={loading}
                                    maxLength={50}
                                />
                            </div>

                            {/* Error/Success Messages */}
                            {error && (
                                <div className="p-2 bg-red-500/20 border border-red-500/50 rounded-lg">
                                    <p className="text-xs text-red-400 text-center">{error}</p>
                                </div>
                            )}

                            {success && (
                                <div className="p-2 bg-green-500/20 border border-green-500/50 rounded-lg">
                                    <p className="text-xs text-green-400 text-center">
                                        {isProtected ? "Password removed!" : "Password set successfully!"}
                                    </p>
                                </div>
                            )}

                            {/* Buttons */}
                            <div className="flex gap-3 pt-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleClose}
                                    className="flex-1 border-slate-600 text-gray-300 hover:bg-slate-700 bg-transparent"
                                    disabled={loading}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    className="flex-1 bg-cyan-500 hover:bg-cyan-600"
                                    disabled={loading || pin.length < 4}
                                >
                                    {loading ? (
                                        <span className="flex items-center gap-2">
                                            <span className="animate-spin">⏳</span>
                                            Setting...
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-2">
                                            <Lock className="w-4 h-4" />
                                            Set Password
                                        </span>
                                    )}
                                </Button>
                            </div>
                        </form>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
