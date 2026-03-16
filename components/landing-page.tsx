"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { AnimatedLogo } from "./animated-logo"
import { LoadingBars } from "./loading-bars"
import { SpaceBackground } from "./space-background"
import { Users, LogIn, AlertCircle } from "lucide-react"
import { AdminPanelLogin } from "./admin/admin-panel"

interface LandingPageProps {
  onCreateRoom: () => void
  onJoinRoom: (roomId: string) => void
  error?: string
  initialRoomId?: string
}

export function LandingPage({ onCreateRoom, onJoinRoom, error, initialRoomId }: LandingPageProps) {
  const [roomId, setRoomId] = useState("")
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isMounted, setIsMounted] = useState(false)

  // Handle hydration and initialRoomId
  useEffect(() => {
    setIsMounted(true)
    if (initialRoomId) {
      setRoomId(initialRoomId)
    }
  }, [initialRoomId])

  // Update time every second after mount
  useEffect(() => {
    if (!isMounted) return

    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(interval)
  }, [isMounted])

  const handleJoinRoom = () => {
    if (roomId.trim()) {
      onJoinRoom(roomId.trim())
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleJoinRoom()
    }
  }

  if (!isMounted) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4">
        <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl p-8 border border-slate-700 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="h-16 w-16 mx-auto mb-4 bg-slate-700 rounded-full animate-pulse" />
          </div>
          <div className="space-y-4">
            <div className="h-12 bg-slate-700 rounded-lg animate-pulse" />
            <div className="h-12 bg-slate-700 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="h-full flex flex-col items-center justify-center p-4 relative"
      role="main"
      aria-label="SatLoom chat application landing page"
    >
      <SpaceBackground />

      <div className="absolute top-0 left-0 right-0 p-4 z-40 flex items-center justify-center md:justify-start">
        <AnimatedLogo showTextOnMobile={true} />
      </div>

      <div className="w-full max-w-md mx-auto z-10">
        {/* Main Content Card */}
        <div
          className="bg-slate-800/60 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-slate-700 shadow-2xl w-full"
          role="region"
          aria-label="Chat room options"
        >
          {/* Logo */}
          <div className="text-center mb-6 sm:mb-8">
            <AdminPanelLogin>
              <AnimatedLogo showTextOnMobile={true} className="justify-center mb-3 sm:mb-4 scale-90 sm:scale-100" />
            </AdminPanelLogin>
            <p className="text-gray-400 text-xs sm:text-sm px-2">Secure, anonymous, real-time communication</p>
          </div>

          {/* Error Message */}
          {error && (
            <div
              className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-500/20 border border-red-500/50 rounded-xl flex items-center gap-3 haptic-shake"
              role="alert"
              aria-live="polite"
            >
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" aria-hidden="true" />
              <span className="text-red-400 text-xs sm:text-sm">{error}</span>
            </div>
          )}

          {/* Room Input */}
          <div className="mb-6 sm:mb-8">
            <label htmlFor="room-id" className="sr-only">
              Enter Room ID
            </label>
            <div className="relative">
              <Input
                id="room-id"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleJoinRoom()
                  }
                }}
                placeholder="Enter Room ID"
                className="w-full bg-slate-700/50 border-slate-600 text-white placeholder-gray-400 text-center py-3 sm:py-4 text-base sm:text-lg min-h-[48px] sm:min-h-[52px] rounded-xl border-0 focus-visible:ring-2 focus-visible:ring-cyan-500"
                aria-label="Room ID"
                autoComplete="off"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div
            className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mb-8 sm:mb-12"
            role="group"
            aria-label="Room actions"
          >
            <Button
              onClick={onCreateRoom}
              className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-3 sm:py-4 rounded-xl font-medium w-full sm:w-auto min-h-[48px] sm:min-h-[52px] haptic"
              aria-label="Create a new chat room"
            >
              <Users className="w-5 h-5 mr-2" aria-hidden="true" />
              Create Room
            </Button>
            <Button
              onClick={handleJoinRoom}
              disabled={!roomId.trim()}
              variant="outline"
              className="border-slate-600 text-white hover:bg-slate-700 px-6 py-3 sm:py-4 rounded-xl font-medium bg-transparent w-full sm:w-auto min-h-[48px] sm:min-h-[52px] haptic"
              aria-label="Join existing chat room"
              aria-disabled={!roomId.trim()}
            >
              <LogIn className="w-5 h-5 mr-2" aria-hidden="true" />
              Join Room
            </Button>
          </div>

          {/* Loading Animation */}
          <div className="scale-75 sm:scale-100 origin-center">
            <LoadingBars />
          </div>
        </div>

        {/* Footer */}
        <div
          className="text-center mt-6 sm:mt-8 text-gray-500 text-xs sm:text-sm"
          role="contentinfo"
          aria-label="Application version and credits"
        >
          SatLoom v2.0.0 | Powered by SatLoom Developers
        </div>
      </div>
    </div>
  )
}
