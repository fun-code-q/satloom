"use client"

import React from "react"
import { Button } from "../ui/button"
import { Monitor, X, Play } from "lucide-react"

interface PresentationInviteNotificationProps {
    invite: {
        presentationId: string
        hostName: string
        hostId: string
    }
    onAccept: () => void
    onDecline: () => void
}

export function PresentationInviteNotification({ invite, onAccept, onDecline }: PresentationInviteNotificationProps) {
    return (
        <div className="fixed bottom-6 right-6 z-[300] max-w-sm w-full bg-slate-900/95 border border-purple-500/30 rounded-3xl shadow-2xl overflow-hidden glass-morphism animate-in slide-in-from-bottom-10 duration-500">
            <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 p-6">
                <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-purple-600 flex items-center justify-center shadow-lg shadow-purple-600/40">
                        <Monitor className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1">
                        <h4 className="text-white font-black tracking-tight text-lg mb-1">Presentation Started!</h4>
                        <p className="text-slate-300 text-sm font-medium leading-relaxed">
                            <span className="text-purple-400 font-bold">{invite.hostName}</span> has invited you to join their presentation.
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onDecline}
                        className="h-8 w-8 text-slate-400 hover:text-white rounded-full -mt-2 -mr-2"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <div className="mt-6 flex gap-3">
                    <Button
                        onClick={onAccept}
                        className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-2xl h-11 shadow-lg shadow-purple-600/20 transition-all active:scale-95"
                    >
                        <Play className="h-4 w-4 mr-2 fill-current" />
                        JOIN NOW
                    </Button>
                    <Button
                        onClick={onDecline}
                        variant="outline"
                        className="bg-white/5 border-white/10 text-white hover:bg-white/10 font-bold rounded-2xl h-11"
                    >
                        IGNORE
                    </Button>
                </div>
            </div>

            {/* Progress line */}
            <div className="h-1 w-full bg-white/5 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 animate-[progress_5s_linear_forwards]" />
            </div>

            <style jsx>{`
                @keyframes progress {
                    from { width: 100%; }
                    to { width: 0%; }
                }
            `}</style>
        </div>
    )
}
