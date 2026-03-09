"use client";

import { useState, memo, useMemo } from "react"
import { Button } from "./ui/button"
import { Heart, ThumbsUp, Reply, MoreVertical, Trash2, Download, Play, User, Copy, Edit, Check, Zap, FileIcon, MapPin, Calendar, Clock } from "lucide-react"
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
}: MessageBubbleProps) {
  const [showReactions, setShowReactions] = useState(false)
  const [showFilePreview, setShowFilePreview] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(message.text)
  const [transferProgress, setTransferProgress] = useState<TransferProgress | null>(null)
  const [p2pBlobUrl, setP2pBlobUrl] = useState<string | null>(null)


  const heartCount = useMemo(() => message.reactions?.heart?.length || 0, [message.reactions])
  const thumbsUpCount = useMemo(() => message.reactions?.thumbsUp?.length || 0, [message.reactions])
  const hasUserHearted = useMemo(() => message.reactions?.heart?.includes(currentUser), [message.reactions, currentUser])
  const hasUserThumbsUp = useMemo(() => message.reactions?.thumbsUp?.includes(currentUser), [message.reactions, currentUser])
  const isImage = useMemo(() => message.file?.type.startsWith("image/"), [message.file])
  const isVideo = useMemo(() => message.file?.type.startsWith("video/"), [message.file])
  const isAudio = useMemo(() => message.file?.type.startsWith("audio/"), [message.file])
  const processedText = useMemo(() => parseEmojis(message.text), [message.text])
  const urls = useMemo(() => message.text.match(/(https?:\/\/[^\s]+)/g) || [], [message.text])
  const messageId = `message-${message.id}`

  const handleReaction = (reaction: "heart" | "thumbsUp") => {
    onReact(message.id, reaction, currentUser)
    setShowReactions(false)
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
            "{message.event.description}"
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
      setP2pBlobUrl(url)
    } catch (err) {
      console.error("P2P download failed:", err)
      setTransferProgress({ percentage: 0, status: "error", error: "Transfer failed" })
    }
  }

  const renderFilePreview = () => {
    if (!message.file) return null

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

    const fileUrl = p2pBlobUrl || message.file.url

    if (isImage) {
      return (
        <div className="mt-2 cursor-pointer" onClick={() => setShowFilePreview(true)}>
          {message.file.encrypted && !p2pBlobUrl ? (
            <div className="w-64 h-48 rounded-lg bg-slate-700/50 flex flex-col items-center justify-center border border-dashed border-cyan-500/30">
              <span className="text-2xl mb-2">🔒</span>
              <span className="text-xs text-cyan-400">Encrypted Image</span>
            </div>
          ) : (
            <img
              src={fileUrl || "/placeholder.svg"}
              alt={message.file.name}
              className="max-w-64 max-h-48 rounded-lg object-cover"
              loading="lazy"
            />
          )}
        </div>
      )
    }

    if (isVideo) {
      return (
        <div className="mt-2 cursor-pointer relative" onClick={() => setShowFilePreview(true)}>
          {message.file.encrypted && !p2pBlobUrl ? (
            <div className="w-64 h-48 rounded-lg bg-slate-700/50 flex flex-col items-center justify-center border border-dashed border-cyan-500/30">
              <span className="text-2xl mb-2">🎞️🔒</span>
              <span className="text-xs text-cyan-400">Encrypted Video</span>
            </div>
          ) : (
            <>
              <video className="max-w-64 max-h-48 rounded-lg object-cover" muted>
                <source src={fileUrl} type={message.file.type} />
              </video>
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
                <Play className="w-8 h-8 text-white" />
              </div>
            </>
          )}
        </div>
      )
    }

    if (isAudio) {
      return (
        <div className="mt-2 bg-slate-700/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center">
              <Play className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-medium">{message.file.name}</span>
          </div>
          <audio controls className="w-full">
            <source src={fileUrl} type={message.file.type} />
          </audio>
        </div>
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
      className={`flex ${isOwnMessage ? "justify-end" : "justify-start"} mb-2 scroll-mt-20 transition-colors duration-300`}
    >
      <div className={`max-w-[85%] ${isOwnMessage ? "order-2" : "order-1"}`}>
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
          className={`relative group rounded-2xl p-3 ${isOwnMessage ? "bg-cyan-600 text-white ml-auto" : "text-white"} ${isOwnMessage ? "rounded-br-md" : "rounded-bl-md"}`}
          style={{
            backgroundColor: isOwnMessage ? "#0891b2" : userColor,
          }}
          onMouseEnter={() => setShowReactions(true)}
          onMouseLeave={() => setShowReactions(false)}
        >
          {/* User info inside message bubble */}
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-7 h-7 rounded-full border border-slate-600 flex items-center justify-center bg-slate-700 overflow-hidden flex-shrink-0">
              {userAvatar ? (
                <img
                  src={userAvatar || "/placeholder.svg"}
                  alt={message.sender}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none"
                    e.currentTarget.nextElementSibling?.classList.remove("hidden")
                  }}
                />
              ) : null}
              <User className={`w-4 h-4 text-gray-300 ${userAvatar ? "hidden" : ""}`} />
            </div>
            <span className="text-xs font-medium text-gray-200 opacity-90">{message.sender}</span>
          </div>

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
                  {parseUrls(processedText).map((part, index) => (
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

          {/* Timestamp and options */}
          <div className="text-xs opacity-70 mt-1 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>{message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              {message.edited && <span className="text-xs opacity-50">(edited)</span>}
              {isOwnMessage && (
                <span className="ml-1">
                  {(message.readBy && message.readBy.length > 0) ? (
                    <div className="flex">
                      <Check className="w-3 h-3 text-blue-400" />
                      <Check className="w-3 h-3 -ml-1 text-blue-400" />
                    </div>
                  ) : (
                    <Check className="w-3 h-3 text-gray-400" />
                  )}
                </span>
              )}
            </div>

            {/* Message options menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700 text-white">
                <DropdownMenuItem onClick={() => onReply(message)} className="hover:bg-slate-700 cursor-pointer">
                  <Reply className="w-4 h-4 mr-2" />
                  Reply
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopy} className="hover:bg-slate-700 cursor-pointer">
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </DropdownMenuItem>
                {isOwnMessage && onEdit && (
                  <DropdownMenuItem onClick={() => setIsEditing(true)} className="hover:bg-slate-700 cursor-pointer">
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                )}
                {isOwnMessage && (
                  <DropdownMenuItem
                    onClick={() => onDelete(message.id)}
                    className="hover:bg-slate-700 cursor-pointer text-red-400"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Reaction buttons (show on hover) */}
          {/* Quick Actions - Visible on group hover (dap/touch on mobile) */}
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

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-white hover:bg-slate-700">
                    <MoreVertical className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700 text-white z-50">
                  <DropdownMenuItem onClick={handleCopy} className="hover:bg-slate-700 cursor-pointer">
                    <Copy className="w-4 h-4 mr-2" /> Copy text
                  </DropdownMenuItem>
                  {isOwnMessage && (
                    <>
                      <DropdownMenuItem onClick={() => setIsEditing(true)} className="hover:bg-slate-700 cursor-pointer">
                        <Edit className="w-4 h-4 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDelete(message.id)} className="text-red-400 hover:bg-slate-700 hover:text-red-400 cursor-pointer">
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </>
                  )}
                  {onPin && (
                    <DropdownMenuItem onClick={() => onPin(message.id)} className="hover:bg-slate-700 cursor-pointer">
                      <span className="w-4 h-4 mr-2 flex items-center justify-center">📌</span> Pin Message
                    </DropdownMenuItem>
                  )}
                  {message.file?.url && (
                    <DropdownMenuItem asChild>
                      <a href={message.file.url} download target="_blank" rel="noopener noreferrer" className="hover:bg-slate-700 cursor-pointer flex items-center">
                        <Download className="w-4 h-4 mr-2" /> Download File
                      </a>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {/* Reaction counts */}
        {(heartCount > 0 || thumbsUpCount > 0) && (
          <div className="flex gap-2 mt-1 text-xs">
            {heartCount > 0 && (
              <div
                className={`flex items-center gap-1 px-2 py-1 rounded-full cursor-pointer ${hasUserHearted ? "bg-red-500/20 text-red-400" : "bg-slate-700/50 text-gray-400"}`}
                onClick={() => handleReaction("heart")}
              >
                <Heart className="w-3 h-3" />
                <span>{heartCount}</span>
              </div>
            )}
            {thumbsUpCount > 0 && (
              <div
                className={`flex items-center gap-1 px-2 py-1 rounded-full cursor-pointer ${hasUserThumbsUp ? "bg-blue-500/20 text-blue-400" : "bg-slate-700/50 text-gray-400"}`}
                onClick={() => handleReaction("thumbsUp")}
              >
                <ThumbsUp className="w-3 h-3" />
                <span>{thumbsUpCount}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* File Preview Modal */}
      {message.file && (
        <FilePreview
          isOpen={showFilePreview}
          onClose={() => setShowFilePreview(false)}
          file={{
            ...message.file,
            fileId: message.file.fileId || "",
            senderId: message.file.senderId || ""
          }}
          roomId={roomId}
        />
      )}
    </div>
  )
}

// Memoized version for better performance in virtual lists
const MemoizedMessageBubble = memo(MessageBubble)
MemoizedMessageBubble.displayName = "MessageBubble"

// Export the memoized version as MessageBubble
export { MemoizedMessageBubble as MessageBubble }

