import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Gamepad2, Check, Users, Eye, Clock } from "lucide-react"
import { NotificationCard } from "@/components/ui/notification-card"
import type { GameInvite } from "@/utils/infra/game-signaling"

interface GameInviteNotificationProps {
  invite: GameInvite
  currentPlayerCount?: number
  onAccept: (guestName: string) => void
  onAcceptAsSpectator?: () => void
  onDecline: () => void
}

export function GameInviteNotification({
  invite,
  currentPlayerCount = 1,
  onAccept,
  onAcceptAsSpectator,
  onDecline
}: GameInviteNotificationProps) {
  const [timeLeft, setTimeLeft] = useState(0)
  const [isEnteringName, setIsEnteringName] = useState(false)
  const [guestName, setGuestName] = useState("")

  useEffect(() => {
    const updateTimer = () => {
      const remaining = Math.max(0, Math.floor((invite.expiresAt - Date.now()) / 1000))
      setTimeLeft(remaining)

      if (remaining === 0) {
        onDecline()
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [invite.expiresAt, onDecline])

  const maxPlayers = Number(invite.gameConfig?.maxPlayers || 2)
  const isSeriesInvite = invite.gameConfig?.matchmakingMode === "series"
  const gameName = invite.gameConfig?.selectedGame || invite.gameConfig?.gameType || "game"
  const displayedPlayerCount = isSeriesInvite ? maxPlayers : currentPlayerCount
  const isFull = !isSeriesInvite && currentPlayerCount >= maxPlayers

  return (
    <NotificationCard
      icon={
        <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
          <Gamepad2 className="w-5 h-5 text-purple-400" />
        </div>
      }
      onClose={onDecline}
    >
      <div>
        <div className="text-sm text-gray-200">
          <span className="font-semibold text-purple-400">{invite.hostName}</span> invited you to play{" "}
          <span className="font-bold text-white">{gameName}</span>
        </div>

        <div className="mt-2 space-y-1">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Users className="w-3 h-3" />
            <span>
              {displayedPlayerCount}/{maxPlayers} players{invite.gameConfig?.gridSize ? ` • ${invite.gameConfig.gridSize}x${invite.gameConfig.gridSize} grid` : ""}
            </span>
          </div>

          {isSeriesInvite && (
            <div className="text-xs text-cyan-300">
              Series mode: members are auto-grouped into 1v1 rooms.
            </div>
          )}

          {invite.gameConfig?.voiceChatEnabled && (
            <div className="text-xs text-green-400">Voice chat enabled</div>
          )}

          <div className="flex items-center gap-2 text-xs">
            <Clock className="w-3 h-3 text-yellow-400" />
            <span className={timeLeft <= 10 ? "text-red-400 font-semibold" : "text-gray-400"}>
              Expires in {timeLeft}s
            </span>
          </div>
        </div>

        {isFull && (
          <div className="mt-2 text-xs text-yellow-400 bg-yellow-500/10 rounded px-2 py-1">
            Game is full. Join as viewer.
          </div>
        )}

        {isEnteringName && !isFull && (
          <div className="mt-3 space-y-2 animate-in slide-in-from-top-2 duration-300">
            <input
              type="text"
              placeholder="Your display name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="w-full bg-slate-800 border border-purple-500/30 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500 transition-all"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && guestName.trim()) {
                  onAccept(guestName.trim())
                }
              }}
            />
            <Button
              onClick={() => {
                if (guestName.trim()) onAccept(guestName.trim())
              }}
              size="sm"
              className="w-full bg-purple-500 hover:bg-purple-600 text-white h-8"
              disabled={!guestName.trim()}
            >
              <Check className="w-3 h-3 mr-1" />
              Confirm & Play
            </Button>
          </div>
        )}

        {!isEnteringName && (
          <div className="flex gap-2 mt-3">
            {!isFull && (
              <Button
                onClick={() => setIsEnteringName(true)}
                size="sm"
                className="flex-1 bg-purple-500 hover:bg-purple-600 text-white h-8"
              >
                <Check className="w-3 h-3 mr-1" />
                Join
              </Button>
            )}

            {onAcceptAsSpectator && (
              <Button
                onClick={onAcceptAsSpectator}
                size="sm"
                variant="outline"
                className="flex-1 border-slate-600 hover:bg-slate-700 text-gray-300 h-8"
              >
                <Eye className="w-3 h-3 mr-1" />
                Join as Viewer
              </Button>
            )}

            <Button
              onClick={onDecline}
              variant="ghost"
              size="sm"
              className="flex-1 hover:bg-slate-700 text-gray-300 h-8"
            >
              Decline
            </Button>
          </div>
        )}
      </div>
    </NotificationCard>
  )
}

