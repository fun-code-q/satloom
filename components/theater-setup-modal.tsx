"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Film, Play, Youtube, Video, Loader2, Monitor, Globe, Paperclip } from "lucide-react"
import { toast } from "sonner"
import { fetchArchiveVideoInfo, extractArchiveId } from "@/utils/infra/archive-org"
import { buildVimeoEmbedUrl, extractVimeoVideoRef } from "@/utils/infra/vimeo-url"

interface TheaterSetupModalProps {
  isOpen: boolean
  onClose: () => void
  onCreateSession: (
    videoUrl: string,
    videoType: "direct" | "youtube" | "vimeo" | "dailymotion" | "archive" | "soundcloud" | "webrtc",
    file?: File
  ) => void
}

export function TheaterSetupModal({ isOpen, onClose, onCreateSession }: TheaterSetupModalProps) {
  const [videoUrl, setVideoUrl] = useState("")
  const [selectedType, setSelectedType] = useState<"direct" | "youtube" | "vimeo" | "dailymotion" | "archive" | "soundcloud" | "webrtc">("direct")
  const [isLoading, setIsLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const videoTypes = [
    {
      id: "direct" as const,
      label: "Direct Video",
      icon: Video,
      description: "MP4, WebM files",
    },
    {
      id: "youtube" as const,
      label: "YouTube",
      icon: Youtube,
      description: "YouTube videos",
    },
    {
      id: "vimeo" as const,
      label: "Vimeo",
      icon: Play,
      description: "Vimeo videos",
    },
    {
      id: "dailymotion" as const,
      label: "Dailymotion",
      icon: Monitor,
      description: "Dailymotion videos",
    },
    {
      id: "archive" as const,
      label: "Archive.org",
      icon: Globe,
      description: "Public Domain Movies",
    },
    {
      id: "soundcloud" as const,
      label: "Soundcloud",
      icon: Paperclip, // Use Paperclip or Music if available, but Paperclip is imported
      description: "Audio & Podcasts",
    },
  ]

  const handleLoadVideo = async () => {
    if (selectedType !== "webrtc" && !videoUrl.trim()) return

    setIsLoading(true)
    try {
      // Validate URL based on type
      // Keep original URL for ReactPlayer - it handles conversion internally
      let processedUrl = videoUrl.trim()
      let embedUrl = videoUrl.trim() // Separate embed URL for iframe fallback

      if (selectedType === "webrtc") {
        processedUrl = "local://stream"
        embedUrl = "local://stream"
      } else if (selectedType === "youtube") {
        // Handle youtube.com, youtu.be, and shorts
        const youtubeRegex = /(?:youtube\.com\/(?:watch\?v=|shorts\/|live\/)|youtu\.be\/)([^&\n?#]+)/
        const match = processedUrl.match(youtubeRegex)
        if (match) {
          embedUrl = `https://www.youtube.com/embed/${match[1]}?enablejsapi=1&controls=1&origin=${typeof window !== 'undefined' ? window.location.origin : '*'}`
        }
      } else if (selectedType === "vimeo") {
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
          embedUrl = normalizedEmbed
        }
      } else if (selectedType === "dailymotion") {
        // Handle dailymotion.com and dai.ly
        const dmRegex = /(?:dailymotion\.com\/video\/|dai\.ly\/)([a-zA-Z0-9]+)/
        const match = processedUrl.match(dmRegex)
        if (match) {
          embedUrl = `https://www.dailymotion.com/embed/video/${match[1]}?autoplay=1`
        }
      } else if (selectedType === "archive") {
        const itemId = extractArchiveId(processedUrl)
        if (itemId) {
          const info = await fetchArchiveVideoInfo(itemId)
          if (info && info.directVideoUrl) {
            processedUrl = info.directVideoUrl
            embedUrl = info.directVideoUrl
          } else {
            // Fallback to iframe if metadata fetch fails
            embedUrl = processedUrl.replace("/details/", "/embed/")
          }
        } else if (processedUrl.includes("/details/") || processedUrl.includes("/download/")) {
          // Fallback regex-based replacement if extractArchiveId fails
          embedUrl = processedUrl.replace("/details/", "/embed/")
        }
      } else if (selectedType === "soundcloud") {
        embedUrl = `https://w.soundcloud.com/player/?url=${encodeURIComponent(processedUrl)}&color=%23ff5500&auto_play=true&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true`
      }

      // Pass the ReactPlayer-compatible URL (not embed format)
      onCreateSession(processedUrl, selectedType)
      onClose()
      setVideoUrl("")
      toast.success(selectedType === "webrtc" ? "Local streaming mode entered!" : "Video loaded successfully!")
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
    setSelectedType("direct")
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            Cinema Theater Setup
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Configure your video session and share media with everyone in the room.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[280px] overflow-y-auto pr-1 custom-scrollbar">
            {videoTypes.map((type) => (
              <Button
                key={type.id}
                variant={selectedType === type.id ? "default" : "outline"}
                className={`h-auto p-3 flex flex-col gap-2 transition-all duration-200 ${selectedType === type.id
                  ? "bg-cyan-500 hover:bg-cyan-600 border-transparent shadow-md shadow-cyan-500/20"
                  : "border-slate-600 hover:bg-slate-700 bg-transparent text-slate-300"
                  }`}
                onClick={() => setSelectedType(type.id)}
              >
                <div className={`p-1.5 rounded-lg ${selectedType === type.id ? "bg-white/20" : "bg-slate-700"}`}>
                  <type.icon className="w-4 h-4" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-bold truncate w-full">{type.label}</span>
                  <span className="text-[9px] opacity-40 truncate w-full">{type.description}</span>
                </div>
              </Button>
            ))}
          </div>

          <div className="space-y-2">
            {selectedType === "webrtc" ? (
              <div className="p-4 bg-slate-900/50 rounded-xl border border-cyan-500/30 text-center">
                <p className="text-cyan-400 font-bold mb-1">Local Streaming Mode</p>
                <p className="text-xs text-slate-400">Select a file below or click the paperclip to choose again.</p>
              </div>
            ) : (
              <div className="relative flex items-center">
                <Input
                  id="theater-video-url"
                  name="video-url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder={
                    selectedType === "direct" ? "Paste direct video URL" :
                      selectedType === "youtube" ? "Paste YouTube URL" :
                        selectedType === "vimeo" ? "Paste Vimeo URL" :
                          selectedType === "dailymotion" ? "Paste Dailymotion URL" :
                            selectedType === "soundcloud" ? "Paste Soundcloud URL" : "Paste Archive.org URL"
                  }
                  className="bg-slate-700 border-slate-600 text-white placeholder-gray-400 pr-12 h-12 rounded-xl"
                />
                <input
                  id="theater-file-input"
                  name="theater-file"
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="video/*,audio/*"
                  onChange={handleFileSelect}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 text-slate-400 hover:text-cyan-400 hover:bg-slate-600/50 rounded-lg w-8 h-8"
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach local video/audio file"
                >
                  <Paperclip className="w-4 h-4" />
                </Button>
              </div>
            )}
            <p className="text-xs text-gray-400">
              Note: {selectedType === "webrtc" ? "Supports MP4, WebM, MP3, etc." : "Video must be served with proper CORS headers"}
            </p>
          </div>

          <div className="flex gap-4 justify-center pt-4">
            <Button
              onClick={handleLoadVideo}
              disabled={(selectedType !== "webrtc" && !videoUrl.trim()) || isLoading}
              className="bg-cyan-500 hover:bg-cyan-600 px-8"
            >
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Film className="w-4 h-4 mr-2" />}
              {selectedType === "webrtc" ? "Enter Local Mode" : "Load Video"}
            </Button>
            <Button onClick={handleClose} variant="outline" className="border-slate-600 text-white px-8" disabled={isLoading}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
