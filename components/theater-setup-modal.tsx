"use client"

import { useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Film, Loader2, Paperclip, Upload } from "lucide-react"
import { toast } from "sonner"
import { fetchArchiveVideoInfo, extractArchiveId } from "@/utils/infra/archive-org"
import { buildVimeoEmbedUrl, extractVimeoVideoRef } from "@/utils/infra/vimeo-url"

type TheaterVideoType = "direct" | "youtube" | "vimeo" | "twitch" | "dailymotion" | "archive" | "soundcloud" | "webrtc"

interface TheaterSetupModalProps {
  isOpen: boolean
  onClose: () => void
  onCreateSession: (
    videoUrl: string,
    videoType: TheaterVideoType,
    file?: File
  ) => void
}

function normalizeInputUrl(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ""
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function detectVideoType(input: string): Exclude<TheaterVideoType, "webrtc"> {
  const normalized = normalizeInputUrl(input).toLowerCase()
  if (!normalized) return "direct"

  if (
    normalized.includes("youtube.com/watch") ||
    normalized.includes("youtube.com/shorts/") ||
    normalized.includes("youtube.com/live/") ||
    normalized.includes("youtu.be/")
  ) {
    return "youtube"
  }

  if (normalized.includes("vimeo.com/") || normalized.includes("player.vimeo.com/")) {
    return "vimeo"
  }

  if (normalized.includes("dailymotion.com/video/") || normalized.includes("dai.ly/")) {
    return "dailymotion"
  }

  if (normalized.includes("archive.org/")) {
    return "archive"
  }

  if (normalized.includes("soundcloud.com/") || normalized.includes("snd.sc/") || normalized.includes("w.soundcloud.com/")) {
    return "soundcloud"
  }

  if (normalized.includes("twitch.tv/") || normalized.includes("clips.twitch.tv/")) {
    return "twitch"
  }

  return "direct"
}

function getTypeLabel(videoType: Exclude<TheaterVideoType, "webrtc">): string {
  switch (videoType) {
    case "youtube":
      return "YouTube"
    case "vimeo":
      return "Vimeo"
    case "dailymotion":
      return "Dailymotion"
    case "archive":
      return "Archive.org"
    case "soundcloud":
      return "SoundCloud"
    case "twitch":
      return "Twitch"
    default:
      return "Direct URL"
  }
}

export function TheaterSetupModal({ isOpen, onClose, onCreateSession }: TheaterSetupModalProps) {
  const [videoUrl, setVideoUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const detectedType = useMemo(() => detectVideoType(videoUrl), [videoUrl])

  const handleLoadVideo = async () => {
    if (!videoUrl.trim()) return

    setIsLoading(true)
    try {
      const normalizedUrl = normalizeInputUrl(videoUrl)
      let processedUrl = normalizedUrl
      const autoType = detectVideoType(normalizedUrl)

      if (autoType === "vimeo") {
        const vimeoInfo = extractVimeoVideoRef(processedUrl)
        if (!vimeoInfo) {
          toast.error("Invalid Vimeo URL")
          setIsLoading(false)
          return
        }
        const normalizedEmbed = buildVimeoEmbedUrl(processedUrl, { autoplay: false })
        if (normalizedEmbed) {
          // Store canonical Vimeo embed URL so playback controls always have API enabled.
          processedUrl = normalizedEmbed
        }
      } else if (autoType === "archive") {
        const itemId = extractArchiveId(processedUrl)
        if (itemId) {
          const info = await fetchArchiveVideoInfo(itemId)
          if (info && info.directVideoUrl) {
            processedUrl = info.directVideoUrl
          }
        }
      }

      onCreateSession(processedUrl, autoType)
      onClose()
      setVideoUrl("")
      toast.success(`${getTypeLabel(autoType)} link loaded successfully.`)
    } catch (error) {
      console.error("Error loading video:", error)
      toast.error("Failed to load video")
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onCreateSession("local://stream", "webrtc", file)
      onClose()
      toast.success(`Starting stream: ${file.name}`)
    }
  }

  const handleClose = () => {
    setVideoUrl("")
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md p-4 sm:p-5">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            Cinema Theater Setup
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-sm">
            Paste one link. SatLoom auto-detects the platform and syncs playback for everyone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <div className="relative flex items-center">
              <Input
                id="theater-video-url"
                name="video-url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="Paste video or audio link (YouTube, Vimeo, Archive, SoundCloud, etc.)"
                className="bg-slate-700 border-slate-600 text-white placeholder-gray-400 pr-11 h-11 rounded-xl text-sm"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-600/50 rounded-lg w-8 h-8"
                onClick={() => fileInputRef.current?.click()}
                title="Stream from local device"
              >
                <Paperclip className="w-4 h-4" />
              </Button>
            </div>
            <input
              id="theater-file-input"
              name="theater-file"
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="video/*,audio/*"
              onChange={handleFileSelect}
            />
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-400">Detected platform:</span>
              <span className="px-2 py-1 rounded-full border border-cyan-500/35 bg-cyan-500/10 text-cyan-300 font-semibold">
                {videoUrl.trim() ? getTypeLabel(detectedType) : "Waiting for link"}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              If no platform matches, SatLoom treats it as direct media URL.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={handleLoadVideo}
              disabled={!videoUrl.trim() || isLoading}
              className="bg-cyan-500 hover:bg-cyan-600"
            >
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Film className="w-4 h-4 mr-2" />}
              Start Theater
            </Button>
            <Button
              variant="outline"
              className="border-slate-600 text-white"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
            >
              <Upload className="w-4 h-4 mr-2" />
              Local File
            </Button>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleClose} variant="outline" className="border-slate-600 text-white" disabled={isLoading}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
