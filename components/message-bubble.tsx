"use client";

import { useState, memo, useMemo, useRef, useEffect, useCallback } from "react"
import { Button } from "./ui/button"
import { Heart, ThumbsUp, Reply, MoreVertical, Trash2, Download, Play, Pause, User, Copy, Edit, Check, Zap, FileIcon, MapPin, Calendar, Clock, Maximize2 } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu"
import { parseUrls, parseEmojis } from "@/utils/core/message-formatter"
import { FilePreview } from "./file-preview"
import dynamic from "next/dynamic"

// Dynamically import LinkPreview to avoid SSR fetch issues
const LinkPreview = dynamic(
  () => import("./link-preview").then(mod => mod.LinkPreview),
  { ssr: false, loading: () => null }
)
import { p2pFileTransfer, type TransferProgress } from "@/utils/infra/p2p-file-transfer"

export interface Message {
  id: string
  text: string
  sender: string
  timestamp: Date
  replyTo?: {
    id: string
    text: string
    sender: string
  }
  reactions?: {
    heart: string[]
    thumbsUp: string[]
  }
  file?: {
    name: string
    type: string
    url: string
    size?: number
    p2p?: boolean
    fileId?: string
    senderId?: string
    encrypted?: boolean
  }
  edited?: boolean
  editedAt?: Date
  type?: string
  poll?: {
    question: string
    options: Array<{
      text: string
      votes: string[]
    }>
    isOpen: boolean
  }
  event?: {
    title: string
    date: string
    time: string
    location?: string
    description?: string
    attendees?: {
      going: string[]
      maybe: string[]
      notGoing: string[]
    }
  }
  readBy?: string[]
}

interface MessageBubbleProps {
  message: Message
  isOwnMessage: boolean
  userColor: string
  currentUser: string
  userAvatar?: string
  onReply: (message: Message) => void
  onReact: (messageId: string, reaction: "heart" | "thumbsUp", userId: string) => void
  onDelete: (messageId: string) => void
  onEdit?: (messageId: string, newText: string) => void
  onCopy?: (text: string) => void
  onVote?: (messageId: string, optionIndex: number) => void
  onRSVP?: (messageId: string, status: "going" | "maybe" | "notGoing") => void
  onPin?: (messageId: string) => void
  onReplyClick?: (messageId: string) => void
  roomId: string
  isFirstInGroup?: boolean
  isLastInGroup?: boolean
  isConsecutive?: boolean
}

function MessageBubble({
  message,
  isOwnMessage,
  userColor,
  currentUser,
  userAvatar,
  onReply,
  onReact,
  onDelete,
  onEdit,
  onCopy,
  onVote,
  onRSVP,
  onPin,
  onReplyClick,
  roomId,
  isFirstInGroup = true,
  isLastInGroup = true,
  isConsecutive = false,
}: MessageBubbleProps) {
  const [showFilePreview, setShowFilePreview] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(message.text)
  const [transferProgress, setTransferProgress] = useState<TransferProgress | null>(null)
  const [p2pBlobUrl, setP2pBlobUrl] = useState<string | null>(null)
  const longPressTimer = useRef<NodeJS.Timeout | null>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [showHeartPulse, setShowHeartPulse] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [audioDuration, setAudioDuration] = useState(0)
  const [audioCurrentTime, setAudioCurrentTime] = useState(0)
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const [swipeX, setSwipeX] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const [hasTriggeredReply, setHasTriggeredReply] = useState(false)
  const swipeStartRef = useRef({ x: 0, y: 0 })
  const swipeQueuedXRef = useRef(0)
  const swipeRafRef = useRef<number | null>(null)
  const replyTriggeredRef = useRef(false)

  const SWIPE_REPLY_THRESHOLD = 64
  const SWIPE_MAX_DISTANCE = 120
  const SWIPE_ELASTIC_START = 72
  const SWIPE_CANCEL_VERTICAL = 18
  const SWIPE_MOVE_CANCEL_LONG_PRESS = 8


  const heartCount = useMemo(() => message.reactions?.heart?.length || 0, [message.reactions])
  const thumbsUpCount = useMemo(() => message.reactions?.thumbsUp?.length || 0, [message.reactions])
  const hasUserHearted = useMemo(() => message.reactions?.heart?.includes(currentUser), [message.reactions, currentUser])
  const hasUserThumbsUp = useMemo(() => message.reactions?.thumbsUp?.includes(currentUser), [message.reactions, currentUser])
  const isImage = useMemo(() => message.file?.type.startsWith("image/"), [message.file])
  const isVideo = useMemo(() => message.file?.type.startsWith("video/"), [message.file])
  const isAudio = useMemo(() => message.file?.type.startsWith("audio/"), [message.file])
  const processedText = useMemo(() => parseEmojis(message.text), [message.text])
  const parsedMessageParts = useMemo(() => parseUrls(processedText), [processedText])
  const urls = useMemo(() => message.text.match(/(https?:\/\/[^\s]+)/g) || [], [message.text])
  const messageId = `message-${message.id}`
  const fileUrl = p2pBlobUrl || message.file?.url

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return "Unknown size"
    const units = ["B", "KB", "MB", "GB"]
    const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
    const value = bytes / Math.pow(1024, power)
    return `${value.toFixed(power === 0 ? 0 : 1)} ${units[power]}`
  }

  const formatAudioTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return "0:00"
    const safeSeconds = Math.floor(seconds)
    const mins = Math.floor(safeSeconds / 60)
    const secs = safeSeconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleAudioToggle = useCallback(async () => {
    const audio = audioRef.current
    if (!audio) return

    if (audio.paused) {
      try {
        await audio.play()
      } catch (error) {
        if ((error as DOMException)?.name !== "AbortError") {
          console.error("Audio playback failed:", error)
        }
      }
      return
    }

    audio.pause()
  }, [])

  const handleAudioMetadataLoaded = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    setAudioDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
  }, [])

  const handleAudioTimeUpdate = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    setAudioCurrentTime(audio.currentTime || 0)
  }, [])

  const handleAudioEnded = useCallback(() => {
    setIsAudioPlaying(false)
    setAudioCurrentTime(0)
  }, [])

  const handleAudioSeek = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    if (!audio || !audioDuration) return

    const rect = event.currentTarget.getBoundingClientRect()
    const clickPosition = event.clientX - rect.left
    const ratio = Math.min(1, Math.max(0, clickPosition / rect.width))
    audio.currentTime = ratio * audioDuration
    setAudioCurrentTime(audio.currentTime)
  }, [audioDuration])

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
      }
    }
  }, [])

  useEffect(() => {
    return () => {
      if (p2pBlobUrl) {
        URL.revokeObjectURL(p2pBlobUrl)
      }
    }
  }, [p2pBlobUrl])

  const handleReaction = (reaction: "heart" | "thumbsUp") => {
    onReact(message.id, reaction, currentUser)
  }

  const handleEdit = () => {
    if (onEdit && editText.trim() !== message.text) {
      onEdit(message.id, editText.trim())
    }
    setIsEditing(false)
  }

  const handleCopy = () => {
    if (onCopy) {
      onCopy(message.text)
    } else {
      navigator.clipboard.writeText(message.text)
    }
  }

  const clearLongPressTimer = useCallback(() => {
    if (!longPressTimer.current) return
    clearTimeout(longPressTimer.current)
    longPressTimer.current = null
  }, [])

  const queueSwipeXUpdate = useCallback((nextSwipeX: number) => {
    swipeQueuedXRef.current = nextSwipeX
    if (swipeRafRef.current !== null) return

    swipeRafRef.current = window.requestAnimationFrame(() => {
      swipeRafRef.current = null
      setSwipeX(swipeQueuedXRef.current)
    })
  }, [])

  const setReplyTriggeredState = useCallback((nextValue: boolean) => {
    if (replyTriggeredRef.current === nextValue) return
    replyTriggeredRef.current = nextValue
    setHasTriggeredReply(nextValue)
    if (nextValue && navigator.vibrate) {
      navigator.vibrate(10)
    }
  }, [])

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.targetTouches[0]
    swipeStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
    }
    setIsSwiping(true)
    setReplyTriggeredState(false)
    queueSwipeXUpdate(0)

    // Long press detection for mobile
    clearLongPressTimer()
    longPressTimer.current = setTimeout(() => {
        if (navigator.vibrate) navigator.vibrate(40)
        setIsMenuOpen(true)
    }, 500)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping) return

    const touch = e.targetTouches[0]
    const diffX = touch.clientX - swipeStartRef.current.x
    const diffY = touch.clientY - swipeStartRef.current.y

    // Let vertical scroll gestures pass through quickly.
    if (Math.abs(diffY) > SWIPE_CANCEL_VERTICAL && Math.abs(diffY) > Math.abs(diffX)) {
      clearLongPressTimer()
      setIsSwiping(false)
      setReplyTriggeredState(false)
      queueSwipeXUpdate(0)
      return
    }

    if (Math.abs(diffX) > SWIPE_MOVE_CANCEL_LONG_PRESS || Math.abs(diffY) > SWIPE_MOVE_CANCEL_LONG_PRESS) {
      clearLongPressTimer()
    }

    // Only allow swiping right
    if (diffX <= 0) {
      queueSwipeXUpdate(0)
      setReplyTriggeredState(false)
      return
    }

    const clampedDiff = Math.min(diffX, SWIPE_MAX_DISTANCE)
    const easedDiff =
      clampedDiff <= SWIPE_ELASTIC_START
        ? clampedDiff
        : SWIPE_ELASTIC_START + (clampedDiff - SWIPE_ELASTIC_START) * 0.35

    queueSwipeXUpdate(easedDiff)
    setReplyTriggeredState(clampedDiff >= SWIPE_REPLY_THRESHOLD)
  }

  const handleTouchEnd = () => {
    clearLongPressTimer()
    if (replyTriggeredRef.current) {
      onReply(message)
    }
    setReplyTriggeredState(false)
    queueSwipeXUpdate(0)
    setIsSwiping(false)
  }

  const handleTouchCancel = () => {
    clearLongPressTimer()
    setReplyTriggeredState(false)
    queueSwipeXUpdate(0)
    setIsSwiping(false)
  }

  useEffect(() => {
    return () => {
      clearLongPressTimer()
      if (swipeRafRef.current !== null) {
        window.cancelAnimationFrame(swipeRafRef.current)
      }
    }
  }, [clearLongPressTimer])

  const handleDoubleClick = () => {
    handleReaction("heart")
    setShowHeartPulse(true)
    if (navigator.vibrate) navigator.vibrate([30, 50])
    setTimeout(() => setShowHeartPulse(false), 1000)
  }

  const handleVote = (index: number) => {
    if (onVote) {
      onVote(message.id, index)
    }
  }

  const renderPoll = () => {
    if (!message.poll) return null

    const totalVotes = message.poll.options.reduce((acc, opt) => acc + (opt.votes?.length || 0), 0)

    return (
      <div className="mt-2 space-y-2 min-w-[250px]">
        {message.poll.options.map((option, index) => {
          const votes = option.votes?.length || 0
          const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0
          const hasVoted = option.votes?.includes(currentUser)

          return (
            <div key={index} className="relative">
              <Button
                variant="outline"
                className={`w-full justify-between relative overflow-hidden h-auto py-2 border-slate-600 hover:bg-slate-700/50 ${hasVoted ? "border-cyan-500 ring-1 ring-cyan-500" : ""}`}
                onClick={() => handleVote(index)}
              >
                {/* Progress Bar Background */}
                <div
                  className="absolute left-0 top-0 bottom-0 bg-cyan-900/30 transition-all duration-500"
                  style={{ width: `${percentage}%` }}
                />

                <span className="relative z-10 text-sm truncate mr-2">{option.text}</span>
                <span className="relative z-10 text-xs font-medium">{percentage}% ({votes})</span>
              </Button>
            </div>
          )
        })}
        <div className="text-xs text-gray-400 text-right mt-1">
          {totalVotes} votes
        </div>
      </div>
    )
  }

  const renderEvent = () => {
    if (!message.event) return null

    const goingCount = message.event.attendees?.going?.length || 0
    const maybeCount = message.event.attendees?.maybe?.length || 0

    // Parse Date for card display
    const eventDate = new Date(message.event.date)
    const month = eventDate.toLocaleString('default', { month: 'short' }).toUpperCase()
    const day = eventDate.getDate()

    return (
      <div className="mt-2 bg-slate-800/80 border border-slate-600 rounded-xl p-3 min-w-[260px] shadow-lg max-w-xs transition-colors hover:border-indigo-500/50">
        <div className="flex items-start gap-3 mb-2">
          {/* Calendar Badge */}
          <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex flex-col items-center justify-center border border-indigo-500/30 flex-shrink-0 shadow-inner">
            <span className="text-[10px] font-bold text-indigo-400 leading-none tracking-wider mb-0.5">{month}</span>
            <span className="text-lg font-black text-white leading-none">{day}</span>
          </div>

          <div className="flex-1 min-w-0 pt-0.5">
            <div className="text-sm font-bold text-white truncate pr-2">{message.event.title}</div>
            <div className="text-[11px] font-medium text-indigo-300 mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {message.event.time}
            </div>
          </div>
        </div>

        {message.event.location && (
          <div className="text-xs text-gray-300 flex items-start gap-1 mb-1.5 ml-1">
            <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
            <span className="line-clamp-2 leading-snug">{message.event.location}</span>
          </div>
        )}

        {message.event.description && (
          <div className="text-xs text-gray-400 line-clamp-3 mb-3 bg-slate-900/60 p-2.5 rounded-lg italic border border-slate-700/50">
            &quot;{message.event.description}&quot;
          </div>
        )}

        {/* RSVP Buttons */}
        <div className="flex gap-2 mt-3 pt-3 border-t border-slate-700/50">
          <Button
            size="sm"
            variant="ghost"
            className={`flex-1 h-9 rounded-lg text-xs transition-all ${message.event.attendees?.going?.includes(currentUser) ? 'bg-indigo-500 text-white font-bold shadow-md shadow-indigo-500/20' : 'bg-slate-700/50 hover:bg-slate-700 text-gray-300'}`}
            onClick={() => onRSVP?.(message.id, 'going')}
          >
            Going ({goingCount})
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className={`flex-1 h-9 rounded-lg text-xs transition-all ${message.event.attendees?.maybe?.includes(currentUser) ? 'bg-slate-600 text-white font-medium ring-1 ring-slate-500' : 'bg-slate-700/50 hover:bg-slate-700 text-gray-300'}`}
            onClick={() => onRSVP?.(message.id, 'maybe')}
          >
            Maybe ({maybeCount})
          </Button>
        </div>
      </div>
    )
  }

  const handleP2PDownload = async () => {
    if (!message.file?.p2p || !message.file.senderId || !message.file.fileId) return

    try {
      const blob = await p2pFileTransfer.requestFile(
        message.file.senderId,
        message.file.fileId,
        message.file.size || 0,
        (progress) => setTransferProgress(progress)
      )
      const url = URL.createObjectURL(blob)
      setP2pBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return url
      })
    } catch (err) {
      console.error("P2P download failed:", err)
      setTransferProgress({ percentage: 0, status: "error", error: "Transfer failed" })
    }
  }

  const renderFilePreview = () => {
    if (!message.file) return null
    const isEncryptedLocked = message.file.encrypted && !p2pBlobUrl && !isOwnMessage

    // P2P Transfer UI
    if (message.file.p2p && !p2pBlobUrl) {
      return (
        <div className="mt-2 bg-slate-800/80 border border-slate-700 rounded-xl p-4 shadow-xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-cyan-500/20 rounded-full flex items-center justify-center border border-cyan-500/30">
              <Zap className="w-5 h-5 text-cyan-400 animate-pulse" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-white">{message.file.name}</div>
              <div className="text-[10px] text-cyan-400 font-mono tracking-tighter uppercase">P2P Peer Direct Transfer</div>
            </div>
          </div>

          {transferProgress?.status === "transferring" || transferProgress?.status === "connecting" ? (
            <div className="space-y-2">
              <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden border border-slate-600/50">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                  style={{ width: `${transferProgress.percentage}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-medium text-slate-400">
                <span>{transferProgress.status === "connecting" ? "Establishing connection..." : `Downloading...`}</span>
                <span>{transferProgress.percentage}%</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="text-[10px] text-slate-400">
                Size: {(message.file.size! / 1024 / 1024).toFixed(1)}MB
              </div>
              <Button
                size="sm"
                onClick={handleP2PDownload}
                className="bg-cyan-500 hover:bg-cyan-600 text-white h-8 px-4 rounded-lg haptic flex gap-2"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </Button>
            </div>
          )}

          {transferProgress?.status === "error" && (
            <div className="mt-2 text-[10px] text-red-400 flex items-center gap-1">
              <span>⚠️</span> {transferProgress.error} - <span className="underline cursor-pointer" onClick={handleP2PDownload}>Retry</span>
            </div>
          )}
        </div>
      )
    }

    if (isImage) {
      return (
        <div
          className={`mt-2 ${isEncryptedLocked ? "cursor-default" : "cursor-pointer"}`}
          onClick={() => {
            if (isEncryptedLocked) return
            setShowFilePreview(true)
          }}
        >
          {isEncryptedLocked ? (
            <div className="w-64 h-48 rounded-lg bg-slate-700/50 flex flex-col items-center justify-center border border-dashed border-cyan-500/30">
              <span className="text-2xl mb-2">🔒</span>
              <span className="text-xs text-cyan-400">Encrypted Image</span>
            </div>
          ) : (
            <div className="relative group/media overflow-hidden rounded-2xl border border-white/15 bg-slate-900/40 shadow-[0_14px_30px_rgba(2,6,23,0.45)] transition-all duration-300 hover:shadow-[0_20px_35px_rgba(6,182,212,0.18)] hover:border-cyan-400/50">
              <img
                src={fileUrl || "/placeholder.svg"}
                alt={message.file.name}
                className="max-w-72 max-h-72 object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute top-2 right-2 rounded-full bg-black/45 backdrop-blur-md border border-white/20 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <Maximize2 className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent p-3">
                <p className="text-[11px] text-white font-semibold truncate">{message.file.name}</p>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-white/75">
                  <span>{formatFileSize(message.file.size)}</span>
                  <span className="h-1 w-1 rounded-full bg-white/40" />
                  <span>Tap to open</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )
    }

    if (isVideo) {
      return (
        <div
          className={`mt-2 relative group/media overflow-hidden rounded-xl shadow-2xl transition-all duration-500 ${isEncryptedLocked ? "cursor-default" : "cursor-pointer hover:ring-2 ring-cyan-500/50"}`}
          onClick={() => {
            if (isEncryptedLocked) return
            setShowFilePreview(true)
          }}
        >
          {isEncryptedLocked ? (
            <div className="w-64 h-48 rounded-lg bg-slate-700/50 flex flex-col items-center justify-center border border-dashed border-cyan-500/30">
              <span className="text-2xl mb-2">🎞️🔒</span>
              <span className="text-xs text-cyan-400">Encrypted Video</span>
            </div>
          ) : (
            <>
              <video className="max-w-64 max-h-64 object-cover transition-transform duration-700 group-hover:scale-105" muted>
                <source src={fileUrl} type={message.file.type} />
              </video>
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/media:bg-black/40 transition-all duration-300">
                <div className="w-14 h-14 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/20 shadow-2xl group-hover:scale-110 transition-transform">
                  <Play className="w-6 h-6 text-white fill-white ml-1" />
                </div>
              </div>
            </>
          )}
        </div>
      )
    }

    if (isAudio) {
      const progressPercent = audioDuration > 0 ? (audioCurrentTime / audioDuration) * 100 : 0
      return (
        isEncryptedLocked ? (
          <div className="mt-2 w-64 h-28 rounded-lg bg-slate-700/50 flex flex-col items-center justify-center border border-dashed border-cyan-500/30">
            <span className="text-2xl mb-2">🔒</span>
            <span className="text-xs text-cyan-400">Encrypted Audio</span>
          </div>
        ) : (
          <div className="mt-2 bg-slate-900/40 backdrop-blur-md rounded-2xl p-3 border border-white/5 flex items-center gap-3 min-w-[240px] max-w-xs">
            <audio
              ref={audioRef}
              preload="metadata"
              className="hidden"
              onLoadedMetadata={handleAudioMetadataLoaded}
              onTimeUpdate={handleAudioTimeUpdate}
              onPlay={() => setIsAudioPlaying(true)}
              onPause={() => setIsAudioPlaying(false)}
              onEnded={handleAudioEnded}
            >
              <source src={fileUrl} type={message.file.type} />
            </audio>

            <Button
              type="button"
              size="icon"
              className="h-10 w-10 rounded-full bg-cyan-500 hover:bg-cyan-600 text-white shadow-lg shrink-0 haptic"
              onClick={(event) => {
                event.stopPropagation()
                void handleAudioToggle()
              }}
            >
              {isAudioPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </Button>

            <div className="flex-1 space-y-2">
              <div className="flex justify-between items-center gap-2">
                <span className="text-[10px] font-bold text-cyan-400 truncate">{message.file.name}</span>
                <span className="text-[10px] font-medium text-gray-400 font-mono">
                  {formatAudioTime(audioCurrentTime)} / {formatAudioTime(audioDuration)}
                </span>
              </div>
              <div
                className="h-1.5 bg-slate-700 rounded-full overflow-hidden cursor-pointer"
                onClick={(event) => {
                  event.stopPropagation()
                  handleAudioSeek(event)
                }}
              >
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-cyan-300 transition-all duration-150"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        )
      )
    }

    // Other file types
    return (
      <div className="mt-2 bg-slate-700/50 rounded-lg p-3 cursor-pointer" onClick={() => setShowFilePreview(true)}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <span className="text-xs">📄</span>
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium">{message.file.name}</div>
            <div className="text-xs text-gray-400">{message.file.type}</div>
          </div>
          <Download className="w-4 h-4 text-gray-400" />
        </div>
      </div>
    )
  }

  return (
    <div
      id={messageId}
      className={`flex ${isOwnMessage ? "justify-end" : "justify-start"} ${isFirstInGroup ? "mt-6" : "mt-1"} mb-1 min-h-[auto] scroll-mt-20 transition-colors duration-300 relative z-0 hover:z-50`}
    >
      <div className={`max-w-[85%] ${isOwnMessage ? "order-2" : "order-1"} flex flex-col ${isOwnMessage ? "items-end" : "items-start"}`}>
        {/* Reply indicator */}
        {message.replyTo && (
          <div
            className="mb-1.5 px-3 py-2 bg-slate-700/50 rounded-lg border-l-2 border-cyan-400 cursor-pointer hover:bg-slate-700/70 transition-colors haptic"
            onClick={() => onReplyClick?.(message.replyTo!.id)}
          >
            <div className="text-xs text-cyan-400 font-medium">{message.replyTo.sender}</div>
            <div className="text-xs text-gray-300 truncate">{message.replyTo.text}</div>
          </div>
        )}

        {/* Message bubble */}
        <div
          className={`relative group p-2.5 pb-1.5 px-3 ${isOwnMessage ? "text-white ml-auto" : "text-white"} ${!isSwiping ? "transition-transform duration-300 ease-out" : ""} shadow-sm overflow-hidden select-none`}
          style={{
            backgroundColor: isOwnMessage ? "#0891b2" : userColor,
            backgroundImage: isOwnMessage 
                ? "linear-gradient(135deg, #0891b2 0%, #0e7490 100%)" 
                : "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
            backdropFilter: !isOwnMessage ? "blur(20px)" : "none",
            border: !isOwnMessage ? "1px solid rgba(255,255,255,0.1)" : "none",
            borderRadius: isOwnMessage
                ? `${isFirstInGroup ? "20px" : "20px"} ${isFirstInGroup ? "20px" : "4px"} ${isLastInGroup ? "4px" : "20px"} ${isLastInGroup ? "20px" : "20px"}`
                : `${isFirstInGroup ? "4px" : "20px"} ${isFirstInGroup ? "20px" : "20px"} ${isFirstInGroup ? "20px" : "20px"} ${isLastInGroup ? "4px" : "20px"}`,
            transform: `translateX(${swipeX}px)`,
            touchAction: "pan-y",
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
          onDoubleClick={handleDoubleClick}
        >
          {/* Double Tap Heart Animation Overlay */}
          {showHeartPulse && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
              <Heart className="w-12 h-12 text-white fill-current animate-ping opacity-60" />
              <Heart className="absolute w-12 h-12 text-white fill-current animate-pulse scale-110" />
            </div>
          )}
          {/* Bubble Tail for Group Start */}
          {isFirstInGroup && (
            <div 
              className={`absolute top-0 w-3 h-3 ${isOwnMessage ? "right-[-6px] -scale-x-100" : "left-[-6px]"}`}
              style={{ color: isOwnMessage ? "#0891b2" : userColor }}
            >
              <svg viewBox="0 0 11 11" className="w-full h-full fill-current">
                <path d="M10 0v11C10 5.4 6 1 0 0h10z" />
              </svg>
            </div>
          )}

          {/* Reply Icon Background (revealed on swipe) */}
          <div 
            className="absolute left-[-40px] top-1/2 -translate-y-1/2 opacity-0 transition-all duration-200"
            style={{ 
                opacity: Math.min(swipeX / 40, 1),
                transform: `translateY(-50%) scale(${Math.min(0.5 + swipeX / 100, 1)})`,
                color: hasTriggeredReply ? '#22d3ee' : '#94a3b8'
            }}
          >
            <Reply className={`w-5 h-5 ${hasTriggeredReply ? "scale-125" : ""} transition-transform`} />
          </div>

          {/* User info - only if first in group */}
          {isFirstInGroup && !isOwnMessage && (
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold text-cyan-400 opacity-90">{message.sender}</span>
            </div>
          )}

          {/* Message text with formatting */}
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full bg-slate-700 text-white rounded p-2 text-sm resize-none"
                rows={3}
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleEdit} className="bg-green-500 hover:bg-green-600 text-xs">
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false)
                    setEditText(message.text)
                  }}
                  className="text-xs"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              {message.text && !message.text.startsWith("📊 Poll: ") && !message.text.startsWith("📅 Event: ") && (
                <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {parsedMessageParts.map((part, index) => (
                    <span key={index}>{part}</span>
                  ))}
                </div>
              )}
              {/* Poll/Event Title */}
              {message.text && (message.text.startsWith("📊 Poll: ") || message.text.startsWith("📅 Event: ")) && (
                <div className="font-semibold text-sm mb-2">{message.text}</div>
              )}
            </>
          )}

          {/* Link Previews */}
          {urls.length > 0 && !isEditing && (
            <div className="space-y-2 mt-2">
              {urls.slice(0, 2).map((url, idx) => (
                <LinkPreview key={idx} url={url} />
              ))}
            </div>
          )}

          {/* Poll Render */}
          {message.type === 'poll' && renderPoll()}

          {/* Event Render */}
          {message.type === 'event' && renderEvent()}

          {/* File preview */}
          {renderFilePreview()}

          {/* Timestamp and options - Overlay style */}
          <div className="mt-1 flex items-center justify-end gap-1.5 float-right ml-2 mb-[-2px] relative z-10 select-none">
            <span className="text-[10px] opacity-60 font-medium tracking-tight">
              {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
            {message.edited && <span className="text-[9px] opacity-40 uppercase font-bold tracking-tighter">Edited</span>}
            {isOwnMessage && (
              <span className="flex-shrink-0">
                {(message.readBy && message.readBy.length > 0) ? (
                  <div className="flex scale-75 origin-right">
                    <Check className="w-3.5 h-3.5 text-cyan-200 drop-shadow-sm" />
                    <Check className="w-3.5 h-3.5 -ml-1 text-cyan-200 drop-shadow-sm" />
                  </div>
                ) : (
                  <Check className="w-3.5 h-3.5 text-white/40 scale-75 origin-right" />
                )}
              </span>
            )}

            {/* Hidden Options Trigger for Premium Feel */}
            <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <DropdownMenuTrigger asChild>
                <div className="absolute inset-0 opacity-0 cursor-pointer" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-slate-900/90 backdrop-blur-xl border-white/10 text-white rounded-xl shadow-2xl">
                <DropdownMenuItem onClick={() => onReply(message)} className="hover:bg-white/10 cursor-pointer haptic">
                  <Reply className="w-4 h-4 mr-2" />
                  Reply
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopy} className="hover:bg-white/10 cursor-pointer haptic">
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </DropdownMenuItem>
                {isOwnMessage && onEdit && (
                  <DropdownMenuItem onClick={() => setIsEditing(true)} className="hover:bg-white/10 cursor-pointer haptic">
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                )}
                {isOwnMessage && (
                  <DropdownMenuItem
                    onClick={() => onDelete(message.id)}
                    className="hover:bg-red-500/20 cursor-pointer text-red-400 haptic"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
                {onPin && (
                  <DropdownMenuItem onClick={() => onPin(message.id)} className="hover:bg-white/10 cursor-pointer haptic">
                    <span className="w-4 h-4 mr-2 flex items-center justify-center opacity-70">📌</span>
                    Pin Message
                  </DropdownMenuItem>
                )}
                {message.file?.url && (
                  <DropdownMenuItem asChild>
                    <a href={message.file.url} download target="_blank" rel="noopener noreferrer" className="hover:bg-white/10 cursor-pointer flex items-center haptic">
                      <Download className="w-4 h-4 mr-2" />
                      Download File
                    </a>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Reaction buttons (show on hover) */}
        {!isEditing && (
        <div className="absolute -bottom-8 right-0 flex gap-1 bg-slate-800 rounded-full p-1 shadow-lg border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity z-[60]">
            <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-400 hover:text-white hover:bg-slate-700"
            onClick={() => handleReaction("heart")}
            title="Love"
            >
            <Heart className={`w-3.5 h-3.5 ${message.reactions?.heart?.includes(currentUser) ? "fill-pink-500 text-pink-500" : ""}`} />
            </Button>
            <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-400 hover:text-white hover:bg-slate-700"
            onClick={() => handleReaction("thumbsUp")}
            title="Like"
            >
            <ThumbsUp className={`w-3.5 h-3.5 ${message.reactions?.thumbsUp?.includes(currentUser) ? "fill-yellow-500 text-yellow-500" : ""}`} />
            </Button>
            <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-400 hover:text-white hover:bg-slate-700"
            onClick={() => onReply(message)}
            title="Reply"
            >
            <Reply className="w-3.5 h-3.5" />
            </Button>
        </div>
        )}

        {/* Reaction counts */}
        {(heartCount > 0 || thumbsUpCount > 0) && (
          <div className="flex gap-1.5 mt-[-8px] text-[10px] px-1 relative z-20 select-none">
            {heartCount > 0 && (
              <div
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full cursor-pointer transition-all hover:scale-110 shadow-sm border ${hasUserHearted ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-slate-800/80 text-gray-400 border-white/5 backdrop-blur-md"}`}
                onClick={() => handleReaction("heart")}
              >
                <Heart className={`w-2.5 h-2.5 ${hasUserHearted ? "fill-current" : ""}`} />
                <span>{heartCount}</span>
              </div>
            )}
            {thumbsUpCount > 0 && (
              <div
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full cursor-pointer transition-all hover:scale-110 shadow-sm border ${hasUserThumbsUp ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "bg-slate-800/80 text-gray-400 border-white/5 backdrop-blur-md"}`}
                onClick={() => handleReaction("thumbsUp")}
              >
                <ThumbsUp className={`w-2.5 h-2.5 ${hasUserThumbsUp ? "fill-current" : ""}`} />
                <span>{thumbsUpCount}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {message.file && (
        <FilePreview
          isOpen={showFilePreview}
          onClose={() => setShowFilePreview(false)}
          file={{
            ...message.file,
            url: fileUrl || message.file.url,
          }}
          roomId={roomId}
        />
      )}
    </div>
  )
}

const toTimestamp = (value: unknown): number => {
  if (value instanceof Date) return value.getTime()
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const parsed = new Date(value).getTime()
    return Number.isNaN(parsed) ? 0 : parsed
  }
  return 0
}

const areStringArraysEqual = (left?: string[], right?: string[]) => {
  if (left === right) return true
  if (!left || !right) return !left && !right
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

const areReplyEqual = (left?: Message["replyTo"], right?: Message["replyTo"]) => {
  if (left === right) return true
  if (!left || !right) return !left && !right
  return left.id === right.id && left.text === right.text && left.sender === right.sender
}

const areFileEqual = (left?: Message["file"], right?: Message["file"]) => {
  if (left === right) return true
  if (!left || !right) return !left && !right
  return (
    left.name === right.name &&
    left.type === right.type &&
    left.url === right.url &&
    left.size === right.size &&
    left.p2p === right.p2p &&
    left.fileId === right.fileId &&
    left.senderId === right.senderId &&
    left.encrypted === right.encrypted
  )
}

const arePollEqual = (left?: Message["poll"], right?: Message["poll"]) => {
  if (left === right) return true
  if (!left || !right) return !left && !right
  if (left.question !== right.question || left.isOpen !== right.isOpen) return false
  if (left.options.length !== right.options.length) return false

  for (let index = 0; index < left.options.length; index += 1) {
    const leftOption = left.options[index]
    const rightOption = right.options[index]
    if (!rightOption) return false
    if (leftOption.text !== rightOption.text) return false
    if (!areStringArraysEqual(leftOption.votes, rightOption.votes)) return false
  }

  return true
}

const areEventEqual = (left?: Message["event"], right?: Message["event"]) => {
  if (left === right) return true
  if (!left || !right) return !left && !right

  return (
    left.title === right.title &&
    left.date === right.date &&
    left.time === right.time &&
    left.location === right.location &&
    left.description === right.description &&
    areStringArraysEqual(left.attendees?.going, right.attendees?.going) &&
    areStringArraysEqual(left.attendees?.maybe, right.attendees?.maybe) &&
    areStringArraysEqual(left.attendees?.notGoing, right.attendees?.notGoing)
  )
}

const areReactionsEqual = (left?: Message["reactions"], right?: Message["reactions"]) => {
  if (left === right) return true
  if (!left || !right) return !left && !right
  return (
    areStringArraysEqual(left.heart, right.heart) &&
    areStringArraysEqual(left.thumbsUp, right.thumbsUp)
  )
}

const areMessagesEqual = (left: Message, right: Message) => {
  return (
    left.id === right.id &&
    left.text === right.text &&
    left.sender === right.sender &&
    toTimestamp(left.timestamp) === toTimestamp(right.timestamp) &&
    left.edited === right.edited &&
    toTimestamp(left.editedAt) === toTimestamp(right.editedAt) &&
    left.type === right.type &&
    areReplyEqual(left.replyTo, right.replyTo) &&
    areReactionsEqual(left.reactions, right.reactions) &&
    areFileEqual(left.file, right.file) &&
    arePollEqual(left.poll, right.poll) &&
    areEventEqual(left.event, right.event) &&
    areStringArraysEqual(left.readBy, right.readBy)
  )
}

const areMessageBubblePropsEqual = (prevProps: MessageBubbleProps, nextProps: MessageBubbleProps) => {
  return (
    areMessagesEqual(prevProps.message, nextProps.message) &&
    prevProps.isOwnMessage === nextProps.isOwnMessage &&
    prevProps.userColor === nextProps.userColor &&
    prevProps.currentUser === nextProps.currentUser &&
    prevProps.userAvatar === nextProps.userAvatar &&
    prevProps.roomId === nextProps.roomId &&
    prevProps.isFirstInGroup === nextProps.isFirstInGroup &&
    prevProps.isLastInGroup === nextProps.isLastInGroup &&
    prevProps.isConsecutive === nextProps.isConsecutive &&
    prevProps.onReply === nextProps.onReply &&
    prevProps.onReact === nextProps.onReact &&
    prevProps.onDelete === nextProps.onDelete &&
    prevProps.onEdit === nextProps.onEdit &&
    prevProps.onCopy === nextProps.onCopy &&
    prevProps.onVote === nextProps.onVote &&
    prevProps.onRSVP === nextProps.onRSVP &&
    prevProps.onPin === nextProps.onPin &&
    prevProps.onReplyClick === nextProps.onReplyClick
  )
}

// Memoized version for better performance in virtual lists
const MemoizedMessageBubble = memo(MessageBubble, areMessageBubblePropsEqual)
MemoizedMessageBubble.displayName = "MessageBubble"

// Export the memoized version as MessageBubble
export { MemoizedMessageBubble as MessageBubble }
