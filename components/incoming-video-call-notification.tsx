import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Phone, PhoneOff, User, Video } from "lucide-react"
import type { CallData } from "@/utils/infra/call-signaling"
import { NotificationCard } from "@/components/ui/notification-card"

interface IncomingVideoCallNotificationProps {
  call: CallData
  onAnswer: () => void
  onDecline: () => void
}

export function IncomingVideoCallNotification({ call, onAnswer, onDecline }: IncomingVideoCallNotificationProps) {
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
      className="border-blue-500/30"
      icon={
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-cyan-400 flex items-center justify-center bg-slate-700 animate-pulse">
            <User className="w-6 h-6 text-gray-400" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
            <Video className="w-3 h-3 text-white" />
          </div>
        </div>
      }
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-white font-medium text-lg">{call.caller}</div>
          <div className="text-blue-400 text-sm flex items-center gap-1 animate-pulse">
            <span>Incoming video call...</span>
          </div>
        </div>
      </div>

      <div className="flex gap-3 mt-4 justify-end">
        <Button
          size="icon"
          className="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20"
          onClick={onDecline}
          aria-label="Decline video call"
        >
          <PhoneOff className="w-5 h-5 text-white" />
        </Button>
        <Button
          size="icon"
          className="w-10 h-10 rounded-full bg-green-500 hover:bg-green-600 shadow-lg shadow-green-500/20"
          onClick={onAnswer}
          aria-label="Answer video call"
        >
          <Phone className="w-5 h-5 text-white" />
        </Button>
      </div>
    </NotificationCard>
  )
}
