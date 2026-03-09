"use client"

import { Mic, Video, FileText, Keyboard } from "lucide-react"
import type { UserPresence } from "@/utils/infra/user-presence"

interface UserActivityIndicatorsProps {
  users: UserPresence[]
  currentUserId: string
}

export function UserActivityIndicators({ users, currentUserId }: UserActivityIndicatorsProps) {
  const activeUsers = users.filter((user) => {
    return (
      user.id !== currentUserId &&
      (user.isTyping || user.isRecordingVoice || user.isRecordingVideo || user.isSendingFile)
    )
  })

  if (activeUsers.length === 0) return null

  return (
    <div className="px-4 py-2 bg-slate-800/50 border-b border-slate-700">
      <div className="space-y-1">
        {activeUsers.map((user) => (
          <div key={user.id} className="flex items-center gap-2 text-sm">
            <div className="flex items-center gap-1 bg-slate-700/50 rounded-full px-2 py-1">
              {user.avatar ? (
                <img src={user.avatar || "/placeholder.svg"} alt={user.name} className="w-4 h-4 rounded-full" />
              ) : (
                <div className="w-4 h-4 rounded-full bg-slate-600 flex items-center justify-center">
                  <span className="text-xs">{user.name[0]}</span>
                </div>
              )}
              <span className="text-white text-xs">{user.name}</span>
            </div>

            <div className="flex items-center gap-2">
              {user.isTyping && (
                <div className="flex items-center gap-1 text-cyan-400">
                  <Keyboard className="w-3 h-3" />
                  <div className="flex gap-1">
                    <div className="w-1 h-1 bg-cyan-400 rounded-full animate-bounce" />
                    <div
                      className="w-1 h-1 bg-cyan-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    />
                    <div
                      className="w-1 h-1 bg-cyan-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    />
                  </div>
                  <span className="text-xs">typing...</span>
                </div>
              )}

              {user.isRecordingVoice && (
                <div className="flex items-center gap-1 text-red-400">
                  <Mic className="w-3 h-3 animate-pulse" />
                  <span className="text-xs">recording voice...</span>
                </div>
              )}

              {user.isRecordingVideo && (
                <div className="flex items-center gap-1 text-purple-400">
                  <Video className="w-3 h-3 animate-pulse" />
                  <span className="text-xs">recording video...</span>
                </div>
              )}

              {user.isSendingFile && (
                <div className="flex items-center gap-1 text-yellow-400">
                  <FileText className="w-3 h-3" />
                  <div className="w-3 h-1 bg-gray-600 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-400 rounded-full animate-pulse" style={{ width: "60%" }} />
                  </div>
                  <span className="text-xs">sending file...</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
