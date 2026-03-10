"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Mic, Check } from "lucide-react"
import { NotificationCard } from "@/components/ui/notification-card"
import type { KaraokeInvite } from "@/utils/games/karaoke"

interface KaraokeInviteNotificationProps {
    invite: KaraokeInvite
    onAccept: () => void
    onDecline: () => void
}

export function KaraokeInviteNotification({ invite, onAccept, onDecline }: KaraokeInviteNotificationProps) {
    const [isVisible, setIsVisible] = useState(true)

    useEffect(() => {
        // Auto-hide after 45 seconds
        const timer = setTimeout(() => {
            setIsVisible(false)
            onDecline()
        }, 45000)

        return () => clearTimeout(timer)
    }, [onDecline])

    if (!isVisible) return null

    return (
        <NotificationCard
            icon={
                <div className="w-10 h-10 rounded-full border border-cyan-400/30 flex items-center justify-center bg-slate-700 flex-shrink-0">
                    <Mic className="w-5 h-5 text-cyan-400" />
                </div>
            }
            onClose={onDecline}
        >
            <div>
                <div className="text-sm text-gray-200">
                    <span className="font-medium text-white">{invite.hostName}</span> is taking the stage!
                    <div className="text-cyan-400 font-medium truncate mt-1">Singing: {invite.song.title}</div>
                </div>
                <div className="text-xs text-gray-500 mt-2">Karaoke Show</div>

                <div className="flex gap-2 mt-3">
                    <Button
                        size="sm"
                        className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white h-8"
                        onClick={onAccept}
                    >
                        <Check className="w-3 h-3 mr-1" />
                        Join Stage
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 hover:bg-slate-700 text-gray-300 h-8"
                        onClick={onDecline}
                    >
                        Ignore
                    </Button>
                </div>
            </div>
        </NotificationCard>
    )
}
