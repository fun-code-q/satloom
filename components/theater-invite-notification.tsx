import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Film, Check } from "lucide-react"
import { NotificationCard } from "@/components/ui/notification-card"
import type { TheaterInvite } from "@/utils/infra/theater-signaling"

interface TheaterInviteNotificationProps {
  invite: TheaterInvite
  onAccept: () => void
  onDecline: () => void
}

export function TheaterInviteNotification({ invite, onAccept, onDecline }: TheaterInviteNotificationProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    // Auto-hide after 30 seconds
    const timer = setTimeout(() => {
      setIsVisible(false)
      onDecline()
    }, 30000)

    return () => clearTimeout(timer)
  }, [onDecline])

  if (!isVisible) return null

  return (
    <NotificationCard
      icon={
        <div className="w-10 h-10 rounded-full border border-purple-400/30 flex items-center justify-center bg-slate-700 flex-shrink-0">
          <Film className="w-5 h-5 text-purple-400" />
        </div>
      }
      onClose={onDecline}
    >
      <div>
        <div className="text-sm text-gray-200">
          <span className="font-medium text-white">{invite.host}</span> invited you to watch
          <div className="text-cyan-400 font-medium truncate mt-1">{invite.videoTitle}</div>
        </div>
        <div className="text-xs text-gray-500 mt-2">Movie Theater Session</div>

        <div className="flex gap-2 mt-3">
          <Button
            size="sm"
            className="flex-1 bg-green-500 hover:bg-green-600 text-white h-8"
            onClick={onAccept}
          >
            <Check className="w-3 h-3 mr-1" />
            Join
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 hover:bg-slate-700 text-gray-300 h-8"
            onClick={onDecline}
          >
            Decline
          </Button>
        </div>
      </div>
    </NotificationCard>
  )
}
