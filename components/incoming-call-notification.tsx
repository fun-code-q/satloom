import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Phone, PhoneOff, User } from "lucide-react"
import type { CallData } from "@/utils/infra/call-signaling"
import { NotificationCard } from "@/components/ui/notification-card"
import { audioNotificationManager } from "@/utils/hardware/audio-notification-manager"

interface IncomingCallNotificationProps {
  call: CallData
  onAnswer: () => void
  onDecline: () => void
}

export function IncomingCallNotification({ call, onAnswer, onDecline }: IncomingCallNotificationProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    // Start incoming ringtone
    audioNotificationManager.startIncomingRing()

    // Auto-hide after 30 seconds
    const timer = setTimeout(() => {
      audioNotificationManager.stopAll()
      setIsVisible(false)
      onDecline()
    }, 30000)

    return () => {
      clearTimeout(timer)
      audioNotificationManager.stopAll()
    }
  }, [onDecline])

  if (!isVisible) return null

  const handleAnswer = () => {
    audioNotificationManager.stopAll()
    onAnswer()
  }

  const handleDecline = () => {
    audioNotificationManager.stopAll()
    onDecline()
  }

  return (
    <NotificationCard
      className="border-cyan-500/30"
      icon={
        <div className="w-12 h-12 rounded-full border-2 border-cyan-400 flex items-center justify-center bg-slate-700 animate-pulse">
          <User className="w-6 h-6 text-gray-400" />
        </div>
      }
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-white font-medium text-lg">{call.caller}</div>
          <div className="text-cyan-400 text-sm animate-pulse">Incoming audio call...</div>
        </div>
      </div>

      <div className="flex gap-3 mt-4 justify-end">
        <Button
          size="icon"
          className="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20"
          onClick={handleDecline}
          aria-label="Decline call"
        >
          <PhoneOff className="w-5 h-5 text-white" />
        </Button>
        <Button
          size="icon"
          className="w-10 h-10 rounded-full bg-green-500 hover:bg-green-600 shadow-lg shadow-green-500/20"
          onClick={handleAnswer}
          aria-label="Answer call"
        >
          <Phone className="w-5 h-5 text-white" />
        </Button>
      </div>
    </NotificationCard>
  )
}
