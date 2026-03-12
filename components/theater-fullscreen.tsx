"use client"

import { useState, useRef, useEffect } from "react"
import dynamic from "next/dynamic"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
// @ts-ignore
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, X, Mic, MicOff, Users, MessageSquare, Smile, Film, Minimize2, Monitor, Maximize, Minimize } from "lucide-react"
import { TheaterSignaling, type TheaterSession, type TheaterAction } from "@/utils/infra/theater-signaling"
import { TheaterChatOverlay, type Message } from "./theater-chat-overlay"
import { EmojiPicker } from "./emoji-picker"
import { UserPresenceSystem } from "@/utils/infra/user-presence"
import { AudioVisualizer } from "./audio-visualizer"
import { PrivacyShield } from "./privacy-shield"
import { VideoStreamManager } from "@/utils/hardware/video-stream-manager"
import { theaterQueue, type QueuedVideo } from "@/utils/infra/theater-queue-manager"
import { theaterQuality } from "@/utils/infra/theater-quality-manager"
import { WebRTCManager } from "@/utils/infra/webrtc-manager"
import { Settings, List, ChevronRight, ChevronLeft, FastForward } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"

// Native video will handle most streams, HLS will be supported via hls.js if needed

interface TheaterFullscreenProps {
  isOpen: boolean
  onClose: () => void
  session: TheaterSession
  roomId: string
  currentUser: string
  currentUserId: string
  isHost: boolean
  messages: Message[]
  pendingFile?: File | null
  onFileProcessed?: () => void
  onMinimize?: () => void
  pendingScreenStream?: MediaStream | null
  onScreenStreamProcessed?: () => void
}

export function TheaterFullscreen({
  isOpen,
  onClose,
  session,
  roomId,
  currentUser,
  currentUserId,
  isHost,
  messages,
  pendingFile,
  onFileProcessed,
  onMinimize,
  pendingScreenStream,
  onScreenStreamProcessed,
}: TheaterFullscreenProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [isPushToTalkActive, setIsPushToTalkActive] = useState(false)
  const [isMicMuted, setIsMicMuted] = useState(true)
  const [playerReady, setPlayerReady] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [floatingEmojis, setFloatingEmojis] = useState<{ id: string; emoji: string; x: number; y: number }[]>([])
  const [isBuffering, setIsBuffering] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1.0)
  const [showPlaylist, setShowPlaylist] = useState(false)
  const [queue, setQueue] = useState<QueuedVideo[]>([])
  const [qualitySettings, setQualitySettings] = useState(theaterQuality.getSettings())
  const [canReactPlayerPlay, setCanReactPlayerPlay] = useState(true)

  const videoRef = useRef<HTMLVideoElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const controlsTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const theaterSignaling = TheaterSignaling.getInstance()
  const userPresence = UserPresenceSystem.getInstance()
  const localStreamRef = useRef<MediaStream | null>(null)
  const videoStreamManagerRef = useRef<VideoStreamManager | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const connectedPeersRef = useRef<Set<string>>(new Set())
  const [remoteMovieStream, setRemoteMovieStream] = useState<MediaStream | null>(null)
  const [localMovieStream, setLocalMovieStream] = useState<MediaStream | null>(null)
  const [transcodingProgress, setTranscodingProgress] = useState<number | null>(null)
  const [newQueueUrl, setNewQueueUrl] = useState("")
  const [isAddingToQueue, setIsAddingToQueue] = useState(false)
  const lastActionTimestampRef = useRef<number>(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [participantsCount, setParticipantsCount] = useState(0)
  const [mounted, setMounted] = useState(false)
  const lastPlaybackToggleRef = useRef<number>(0)
  const playerReadyTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  // Initialize VideoStreamManager and Queue
  useEffect(() => {
    setMounted(true)
    console.log("TheaterFullscreen mounted, initializing...")
    videoStreamManagerRef.current = new VideoStreamManager()

    // Subscribe to queue changes
    const unsubscribeQueue = theaterQueue.subscribe(setQueue)
    const unsubscribeQuality = theaterQuality.subscribe(setQualitySettings)

    // Track participants
    const unsubscribePresence = userPresence.listenForPresence(roomId, (users: any[]) => {
      setParticipantsCount(users.length)

      // Host Handover Logic
      if (session && session.hostId && users.length > 0) {
        const currentHostGone = !users.find(u => u.uid === session.hostId)
        if (currentHostGone) {
          console.log("[TheaterHandover] Host is gone, electing new host...")
          // Elect the earliest joiner as the new host
          const sortedUsers = [...users].sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0))
          if (sortedUsers[0].uid === currentUserId) {
            console.log("[TheaterHandover] I am the earliest joiner. Taking over host role.");
            theaterSignaling.transferHost(roomId, session.id, currentUserId, currentUser);
          }
        }
      }
    })

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)

    return () => {
      console.log("TheaterFullscreen cleanup")
      videoStreamManagerRef.current?.cleanup()
      unsubscribeQueue()
      unsubscribeQuality()
      unsubscribePresence()
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  // Sync playback state to video element
  useEffect(() => {
    const video = videoRef.current
    if (video) {
      if (isPlaying && video.paused) {
        video.play().catch(err => {
          if (err.name !== 'AbortError') console.error("Video play error:", err)
        })
      } else if (!isPlaying && !video.paused) {
        video.pause()
      }
    }
  }, [isPlaying])

  // Handle WebRTC stream srcObject assignment and HLS initialization
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (session.videoType === "webrtc") {
      const streamToUse = isHost ? localMovieStream : remoteMovieStream
      if (streamToUse) {
        if (video.srcObject !== streamToUse) {
          video.srcObject = streamToUse
          video.play().catch(err => {
            if (err.name !== 'AbortError') console.error("WebRTC video play error:", err)
          })
        }
      } else {
        video.srcObject = null
      }
    } else if (session.videoUrl?.includes(".m3u8")) {
      // HLS Support
      video.srcObject = null

      const initHls = async () => {
        try {
          const { default: Hls } = await import("hls.js")
          if (Hls.isSupported()) {
            const hls = new Hls()
            hls.loadSource(session.videoUrl as string)
            hls.attachMedia(video)
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              if (isPlaying) video.play()
            })
            return () => hls.destroy()
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = session.videoUrl as string
          }
        } catch (err) {
          console.error("HLS init error:", err)
        }
      }

      const cleanup = initHls()
      return () => {
        cleanup.then(fn => fn?.())
      }
    } else {
      // For regular videos, we clear srcObject as src is handled in JSX
      video.srcObject = null
    }
  }, [session.videoType, isHost, localMovieStream, remoteMovieStream, session.videoUrl, isPlaying])

  // Sync volume changes to video element
  useEffect(() => {
    const video = videoRef.current
    if (video) {
      video.volume = isMuted ? 0 : volume
    }
  }, [volume, isMuted])

  // Sync playbackRate changes to video element
  useEffect(() => {
    const video = videoRef.current
    if (video) {
      video.playbackRate = playbackRate
    }
  }, [playbackRate])

  // Player Ready Timeout - decoupled from frequent state updates
  useEffect(() => {
    if (isOpen && !playerReady && !playerReadyTimeoutRef.current && session.status !== "loading") {
      console.log("[Theater] Starting player ready timeout...")
      playerReadyTimeoutRef.current = setTimeout(() => {
        if (!playerReady) {
          console.warn("Player ready timed out, forcing ready state")
          setPlayerReady(true)
        }
      }, 10000)
    }

    return () => {
      // Only cleanup timeout if it was set
      if (playerReadyTimeoutRef.current) {
        // We don't necessarily want to clear it on every small prop change
        // but we should clear it if the modal closes
        if (!isOpen) {
          clearTimeout(playerReadyTimeoutRef.current)
          playerReadyTimeoutRef.current = undefined
        }
      }
    }
  }, [isOpen, playerReady, session.status])

  // Separate Join Sync Effect
  useEffect(() => {
    if (isOpen && playerReady && !isHost && currentTime === 0 && session.currentTime > 0) {
      console.log("[TheaterSync] Initial join sync to:", session.currentTime);
      if (videoRef.current) {
        videoRef.current.currentTime = session.currentTime;
      }
      setCurrentTime(session.currentTime);
    }
  }, [isOpen, playerReady, isHost, session.currentTime])

  // No manual setupPeerConnection - handled by WebRTCManager

  // Handle pending file from setup
  useEffect(() => {
    if (isOpen && isHost && pendingFile && onFileProcessed) {
      console.log("Handling pending file:", pendingFile.name)
      handleFileSelect(undefined, pendingFile)
      onFileProcessed()
    }
  }, [isOpen, isHost, pendingFile, onFileProcessed])

  // Handle pending screen stream
  useEffect(() => {
    if (isOpen && isHost && pendingScreenStream && onScreenStreamProcessed) {
      handleScreenStreamReady(pendingScreenStream)
      onScreenStreamProcessed()
    }
  }, [isOpen, isHost, pendingScreenStream, onScreenStreamProcessed])

  const handleScreenStreamReady = async (stream: MediaStream) => {
    setLocalMovieStream(stream)

    // Update session to webrtc mode if not already
    if (session.videoType !== "webrtc") {
      await theaterSignaling.createSession(roomId, currentUser, currentUserId, "screen://share", "webrtc")
    }

    // Broadcast stream to all current participants
    const webrtc = WebRTCManager.getInstance()
    const participants = session.participants || []

    participants.forEach(async (participantId: string) => {
      if (participantId === currentUserId) return

      webrtc.initialize(
        participantId,
        stream,
        (s, uid) => { if (uid === participantId) setRemoteMovieStream(s) },
        (c, uid) => { if (uid === participantId) theaterSignaling.sendSignal(roomId, session.id, "ice-candidate", c, currentUserId, participantId) }
      )

      const offer = await webrtc.createOffer(participantId)
      theaterSignaling.sendSignal(roomId, session.id, "offer", offer, currentUserId, participantId)
    })

    setIsBuffering(false)
    setIsPlaying(true)

    // Handle track ended
    const videoTrack = stream.getVideoTracks()[0]
    if (videoTrack) {
      videoTrack.onended = () => {
        stream.getTracks().forEach(t => t.stop())
        setLocalMovieStream(null)
        setIsPlaying(false)
        // Optionally close the session or just stop sharing
      }
    }
  }

  const handleStartScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" } as any,
        audio: true
      })
      handleScreenStreamReady(stream)
    } catch (err) {
      console.error("Screen share error:", err)
    }
  }

  // Handle Incoming Signals
  useEffect(() => {
    if (!session || !isOpen) return
    const webrtc = WebRTCManager.getInstance()

    const unsubscribeSignals = theaterSignaling.listenForSignals(roomId, session.id, currentUserId, async (type, payload, fromUserId) => {
      console.log(`Theater: Signal received (${type}) from ${fromUserId}`)

      if (type === "offer") {
        const streamToUse = localMovieStream || localStreamRef.current || new MediaStream()
        webrtc.initialize(
          fromUserId,
          streamToUse,
          (s, uid) => { if (uid === fromUserId) setRemoteMovieStream(s) },
          (c, uid) => {
            if (uid === fromUserId) {
              const payload = {
                candidate: c.candidate,
                sdpMid: c.sdpMid,
                sdpMLineIndex: c.sdpMLineIndex
              }
              theaterSignaling.sendSignal(roomId, session.id, "ice-candidate", payload, currentUserId, fromUserId)
            }
          }
        )
        const answer = await webrtc.createAnswer(fromUserId, payload)
        theaterSignaling.sendSignal(roomId, session.id, "answer", answer, currentUserId, fromUserId)
      } else if (type === "answer") {
        await webrtc.handleAnswer(fromUserId, payload)
      } else if (type === "ice-candidate") {
        await webrtc.addIceCandidate(fromUserId, payload)
      } else if (type === "bye") {
        console.log("Theater: Remote peer sent bye")
        // Just log for theater, manager handles track cleanup better
      }
    })

    return () => {
      unsubscribeSignals()
      // Only cleanup ALL connections if theater is closing
    }
  }, [session.id, roomId, currentUserId])

  // Final cleanup on unmount
  useEffect(() => {
    return () => {
      WebRTCManager.getInstance().cleanup()
    }
  }, [])

  // PTT Setup - Only request when actually needed
  const setupMic = async () => {
    if (localStreamRef.current) return localStreamRef.current
    try {
      console.log("[Theater] Requesting mic access for PTT/Sync...")
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      localStreamRef.current = stream
      // Mic starts muted until pressed
      stream.getAudioTracks().forEach(track => track.enabled = false)
      setIsMicMuted(true)
      return stream
    } catch (err) {
      console.error("Failed to get microphone for Theater:", err)
      return null
    }
  }

  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          track.stop()
          console.log(`Theater: Released mic track: ${track.kind}`)
        })
        localStreamRef.current = null
      }
    }
  }, [])

  // Listen for theater session updates
  useEffect(() => {
    if (!session) return

    const unsubscribe = theaterSignaling.listenForSession(roomId, session.id, (updatedSession: any) => {
      if (updatedSession.status === "ended") {
        setTimeout(() => onClose(), 1000)
        return
      }

      // Handle remote actions with timestamp checking
      if (updatedSession.lastAction &&
        updatedSession.lastAction.hostId !== currentUserId &&
        updatedSession.lastAction.timestamp > (lastActionTimestampRef.current || 0)) {

        console.log(`[TheaterSync] Processing remote action: ${updatedSession.lastAction.type}`);
        lastActionTimestampRef.current = updatedSession.lastAction.timestamp;

        const action = updatedSession.lastAction
        switch (action.type) {
          case "play":
            setIsPlaying(true)
            if (action.currentTime !== undefined) {
              if (Math.abs(currentTime - action.currentTime) > 1) {
                if (videoRef.current) videoRef.current.currentTime = action.currentTime
                syncIframePlayer("seek", action.currentTime)
                syncIframePlayer("play")
                if (session.videoType === "webrtc" && videoStreamManagerRef.current) {
                  videoStreamManagerRef.current.syncPlayback('seek', action.currentTime)
                  videoStreamManagerRef.current.syncPlayback('play')
                }
              }
            }
            break
          case "pause":
            setIsPlaying(false)
            syncIframePlayer("pause")
            if (session.videoType === "webrtc" && videoStreamManagerRef.current) {
              videoStreamManagerRef.current.syncPlayback('pause')
            }
            break
          case "seek":
            if (action.currentTime !== undefined) {
              if (videoRef.current) videoRef.current.currentTime = action.currentTime
              syncIframePlayer("seek", action.currentTime)
              if (session.videoType === "webrtc" && videoStreamManagerRef.current) {
                videoStreamManagerRef.current.syncPlayback('seek', action.currentTime)
              }
              setCurrentTime(action.currentTime)
            }
            break
          case "buffering":
            setIsBuffering(true)
            setIsPlaying(false)
            break
          case "reaction":
            if (action.payload?.emoji) addFloatingEmoji(action.payload.emoji)
            break
          case "join_sync":
            if (isHost && action.payload?.requestorId) {
              theaterSignaling.sendAction(roomId, session.id, "seek", currentTime, currentUserId, currentUser, { targetId: action.payload.requestorId })
            }
            break
          case "quality_change":
            if (action.payload?.quality) {
              theaterQuality.setQuality(action.payload.quality);
            }
            break
        }
      }

      // Sync Queue
      if (updatedSession.queue && JSON.stringify(updatedSession.queue) !== JSON.stringify(queue)) {
        theaterQueue.clearQueue()
        updatedSession.queue.forEach((v: any) => theaterQueue.addToQueue(v))
      }

      // Handle Buffering
      if (updatedSession.status === 'buffering' && !isHost) {
        setIsBuffering(true)
        setIsPlaying(false)
      } else if (updatedSession.status === 'playing' && isBuffering) {
        setIsBuffering(false)
        setIsPlaying(true)
      }

      // Sync Time / Playback Rate (Enhanced Drift Correction)
      if (!isHost && updatedSession.status === 'playing' && playerReady) {
        const drift = updatedSession.currentTime - currentTime

        // If drift is very large (e.g. > 5s), hard seek
        if (Math.abs(drift) > 5) {
          console.log("[TheaterSync] Large drift detected, hard seeking:", drift);
          if (videoRef.current) videoRef.current.currentTime = updatedSession.currentTime
          setCurrentTime(updatedSession.currentTime)
          setPlaybackRate(1.0)
        }
        // Small drift (0.5s to 5s), adjust playback rate for smooth catch-up
        else if (Math.abs(drift) > 0.5) {
          const newRate = drift > 0 ? 1.05 : 0.95
          if (playbackRate !== newRate) {
            console.log("[TheaterSync] Adjusting playback rate for drift:", newRate);
            setPlaybackRate(newRate)
          }
        }
        // Drift resolved
        else if (playbackRate !== 1.0) {
          setPlaybackRate(1.0)
        }
      }

      // WebRTC Presence
      if (isHost && updatedSession.videoType === "webrtc" && localMovieStream) {
        const webrtc = WebRTCManager.getInstance()
        const currentParticipants = updatedSession.participants || []
        currentParticipants.forEach(async (participantId: string) => {
          if (participantId !== currentUserId && !connectedPeersRef.current.has(participantId)) {
            webrtc.initialize(
              participantId,
              localMovieStream,
              (s, uid) => { if (uid === participantId) setRemoteMovieStream(s) },
              (c, uid) => { if (uid === participantId) theaterSignaling.sendSignal(roomId, session.id, "ice-candidate", c, currentUserId, participantId) }
            )
            const offer = await webrtc.createOffer(participantId)
            theaterSignaling.sendSignal(roomId, session.id, "offer", offer, currentUserId, participantId)
            connectedPeersRef.current.add(participantId)
          }
        })
      }
    })

    return () => unsubscribe()
  }, [session.id, roomId, currentUserId, onClose, isHost])


  // ... (keep Auto-hide controls)
  // ... (keep setupPushToTalk)

  // ... (keep setupPushToTalk)

  const addFloatingEmoji = (emoji: string) => {
    const id = Math.random().toString(36).substr(2, 9)
    const x = Math.random() * 80 + 10 // Random X position (10-90%)
    const y = Math.random() * 50 + 25 // Random Y position (25-75%)

    setFloatingEmojis((prev) => [...prev, { id, emoji, x, y }])

    // Remove after animation
    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((e) => e.id !== id))
    }, 2000)
  }


  const handleReaction = (emoji: string) => {
    theaterSignaling.sendReaction(roomId, session.id, emoji, currentUserId, currentUser)
    addFloatingEmoji(emoji)
    setShowEmojiPicker(false)
  }

  const getEmbedUrl = (url: string, type: string) => {
    if (type === "youtube") {
      const match = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|live\/)|youtu\.be\/)([^&\n?#]+)/)
      return match ? `https://www.youtube.com/embed/${match[1]}?enablejsapi=1&autoplay=1&controls=0&origin=${typeof window !== 'undefined' ? window.location.origin : '*'}` : url
    }
    if (type === "vimeo") {
      const match = url.match(/vimeo\.com\/(?:groups\/[^/]+\/videos\/|)(\d+)/)
      return match ? `https://player.vimeo.com/video/${match[1]}?api=1&autoplay=1` : url
    }
    if (type === "twitch") {
      const match = url.match(/twitch\.tv\/([a-zA-Z0-9_]+)/)
      return match ? `https://player.twitch.tv/?channel=${match[1]}&parent=${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}&autoplay=true` : url
    }
    if (type === "dailymotion") {
      const match = url.match(/(?:dailymotion\.com\/video\/|dai\.ly\/)([a-zA-Z0-9]+)/)
      return match ? `https://www.dailymotion.com/embed/video/${match[1]}?autoplay=1&controls=0` : url
    }
    if (type === "soundcloud") {
      return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff5500&auto_play=true&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true`
    }
    if (type === "archive") {
      // Handle archive.org URLs - convert /details/ to /embed/
      if (url.includes("/details/")) {
        return url.replace("/details/", "/embed/")
      }
      // If already an embed URL, use as-is
      if (url.includes("/embed/")) {
        return url
      }
      // Try to construct embed URL from item ID
      const itemMatch = url.match(/archive\.org\/([a-zA-Z0-9_-]+)/)
      if (itemMatch) {
        return `https://archive.org/embed/${itemMatch[1]}`
      }
      return url
    }
    return url
  }

  const syncIframePlayer = (action: 'play' | 'pause' | 'seek', time?: number) => {
    if (!iframeRef.current) return
    const iframe = iframeRef.current
    const type = session.videoType

    if (type === "youtube") {
      const msg = action === 'play' ? '{"event":"command","func":"playVideo","args":""}' :
        action === 'pause' ? '{"event":"command","func":"pauseVideo","args":""}' :
          `{"event":"command","func":"seekTo","args":[${time}, true]}`
      iframe.contentWindow?.postMessage(msg, '*')
    } else if (type === "vimeo") {
      const msg = action === 'play' ? '{"method":"play"}' :
        action === 'pause' ? '{"method":"pause"}' :
          `{"method":"seekTo","value":${time}}`
      iframe.contentWindow?.postMessage(msg, '*')
    } else if (type === "dailymotion") {
      const msg = action === 'play' ? '{"command":"play"}' :
        action === 'pause' ? '{"command":"pause"}' :
          `{"command":"seek","parameters":[${time}]}`
      iframe.contentWindow?.postMessage(msg, '*')
    } else if (type === "soundcloud") {
      const msg = action === 'play' ? '{"method":"play"}' :
        action === 'pause' ? '{"method":"pause"}' :
          `{"method":"seekTo","value":${(time || 0) * 1000}}` // SoundCloud uses ms
      iframe.contentWindow?.postMessage(msg, '*')
    } else if (type === "twitch") {
      const msg = action === 'play' ? '{"command":"play"}' :
        action === 'pause' ? '{"command":"pause"}' :
          `{"command":"seek","args":[${time}]}`
      iframe.contentWindow?.postMessage(msg, '*')
    }
  }

  const handlePlay = async () => {
    console.log("handlePlay called, isHost:", isHost, "isPlaying:", isPlaying)
    if (!isHost) {
      console.log("Not host, ignoring play click")
      return
    }

    // Debounce to prevent AbortError
    const now = Date.now()
    if (now - lastPlaybackToggleRef.current < 800) {
      console.log("Playback toggle debounced")
      return
    }
    lastPlaybackToggleRef.current = now

    console.log("Attempting to toggle play/pause")
    // Toggle play/pause
    const newIsPlaying = !isPlaying
    setIsPlaying(newIsPlaying)

    if (session.videoType === "webrtc" && videoStreamManagerRef.current) {
      videoStreamManagerRef.current.syncPlayback(newIsPlaying ? 'play' : 'pause')
    }

    try {
      await theaterSignaling.sendAction(
        roomId,
        session.id,
        newIsPlaying ? "play" : "pause",
        currentTime,
        currentUserId,
        currentUser
      )
    } catch (err) {
      console.error("Failed to send playback action:", err)
    }
  }

  const handleSeek = async (newTime: number) => {
    if (!isHost) return

    if (videoRef.current) {
      videoRef.current.currentTime = newTime
    }

    if (session.videoType === "webrtc" && videoStreamManagerRef.current) {
      videoStreamManagerRef.current.syncPlayback('seek', newTime)
    }

    syncIframePlayer("seek", newTime)

    setCurrentTime(newTime)
    await theaterSignaling.sendAction(roomId, session.id, "seek", newTime, currentUserId, currentUser)
  }

  const handleSkip = async (seconds: number) => {
    if (!isHost) return
    const newTime = Math.max(0, Math.min(duration, currentTime + seconds))
    handleSeek(newTime)
  }

  const handleProgress = () => {
    const video = videoRef.current
    if (!video || isDragging) return

    setCurrentTime(video.currentTime)

    // Host Sync Heartbeat
    if (isHost && isPlaying && video.currentTime % 5 < 0.2) {
      // Periodically update current time in DB for drift correction (every ~5s)
      theaterSignaling.updateCurrentTime(roomId, session.id, video.currentTime)
    }
  }

  const handleMetadata = () => {
    const video = videoRef.current
    if (video) {
      setDuration(video.duration || 0)
      setPlayerReady(true)
    }
  }

  const handleBuffer = () => {
    if (isHost && !isBuffering) {
      theaterSignaling.sendBuffering(roomId, session.id, currentUserId, currentUser)
      setIsBuffering(true)
    }
  }

  const handleBufferEnd = () => {
    if (isHost && isBuffering) {
      const time = videoRef.current ? videoRef.current.currentTime : 0
      theaterSignaling.sendAction(roomId, session.id, "play", time, currentUserId, currentUser)
      setIsBuffering(false)
    }
  }

  const [isDragging, setIsDragging] = useState(false)

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume)
    setIsMuted(newVolume === 0)
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)
  }

  const handlePushToTalk = async (active: boolean) => {
    let stream = localStreamRef.current
    if (active && !stream) {
      stream = await setupMic()
    }

    if (stream) {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = active
      })
      setIsPushToTalkActive(active)
      setIsMicMuted(!active)

      // Replace audio track in all active WebRTC connections
      const audioTrack = stream.getAudioTracks()[0]
      if (audioTrack) {
        WebRTCManager.getInstance().replaceAudioTrack(audioTrack)
      }

      // Update presence
      userPresence.setRecordingVoice(roomId, currentUserId, active).catch(err => {
        console.error("Error updating presence for Theater PTT:", err)
      })
    }
  }

  const isMovieStreaming = session.videoType === "webrtc"

  const handleFileSelect = async (e?: React.ChangeEvent<HTMLInputElement>, directFile?: File) => {
    const file = directFile || e?.target.files?.[0]
    if (!file || !videoStreamManagerRef.current) return

    try {
      setIsBuffering(true)
      setTranscodingProgress(null)
      const url = await videoStreamManagerRef.current.loadFile(file, (percent) => {
        setTranscodingProgress(percent)
      })
      setTranscodingProgress(null)
      const stream = videoStreamManagerRef.current.captureStream()
      setLocalMovieStream(stream)

      // Update session to webrtc mode
      await theaterSignaling.createSession(roomId, currentUser, currentUserId, "local://stream", "webrtc")

      // Broadcast stream to all current participants
      const webrtc = WebRTCManager.getInstance()
      session.participants.forEach(async (participantId) => {
        if (participantId === currentUserId) return

        webrtc.initialize(
          participantId,
          stream,
          (s, uid) => { if (uid === participantId) setRemoteMovieStream(s) },
          (c, uid) => { if (uid === participantId) theaterSignaling.sendSignal(roomId, session.id, "ice-candidate", c, currentUserId, participantId) }
        )

        const offer = await webrtc.createOffer(participantId)
        theaterSignaling.sendSignal(roomId, session.id, "offer", offer, currentUserId, participantId)
      })

      setIsBuffering(false)
      setIsPlaying(true)
      videoStreamManagerRef.current.syncPlayback('play')
    } catch (err: any) {
      console.error("Movie streaming error:", err)
      alert(err.message || "Failed to start streaming.")
      setIsBuffering(false)
    }
  }

  // Effect to sync VideoStreamManager with session status - Optimized to prevent stutter
  useEffect(() => {
    if (isMovieStreaming && videoStreamManagerRef.current) {
      // Only sync play/pause states, don't sync 'currentTime' here every render
      // as that triggers high-overhead re-seeks which cause stuttering.
      // Seeks should only happen via handleRemoteAction (explicit actions) or handleProgress heartbeats.
      videoStreamManagerRef.current.syncPlayback(isPlaying ? 'play' : 'pause')
    }
  }, [isPlaying, isMovieStreaming])
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.code === "Space" || e.key === "v") && !isPushToTalkActive && isOpen) {
        // Only trigger if not focused on an input
        if (document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
          if (e.code === "Space") e.preventDefault() // Prevent scroll/play
          handlePushToTalk(true)
        }
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.key === "v") {
        if (isPushToTalkActive) {
          handlePushToTalk(false)
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [isPushToTalkActive, isOpen, roomId, currentUserId])

  const handleAddToQueue = async () => {
    if (!newQueueUrl.trim() || !isHost) return
    setIsAddingToQueue(true)
    try {
      const video = {
        url: newQueueUrl.trim(),
        title: "Added Video", // In a real app we'd fetch title from API
        duration: 0,
        addedBy: currentUserId,
        addedByName: currentUser,
        metadata: { type: 'stream' as const }
      }

      const queued = theaterQueue.addToQueue(video as any)
      if (queued) {
        // Sync to Firebase
        const updatedQueue = (theaterQueue as any).queue
        await theaterSignaling.updateQueue(roomId, session.id, updatedQueue)
        await theaterSignaling.sendAction(roomId, session.id, "queue_update", 0, currentUserId, currentUser)
        setNewQueueUrl("")
      }
    } catch (err) {
      console.error("Queue add error:", err)
    } finally {
      setIsAddingToQueue(false)
    }
  }

  const handleClose = async () => {
    if (isHost) {
      // Host ending session - notify all participants
      await theaterSignaling.endSession(roomId, session.id)
    }
    onClose()
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`)
      })
    } else {
      document.exitFullscreen()
    }
  }

  // Use off-screen positioning to prevent browser throttling while minimized
  const rootStyles = !isOpen
    ? "fixed top-[-9999px] left-[-9999px] w-[1px] h-[1px] bg-black z-[500] flex flex-col overflow-hidden select-none opacity-0 pointer-events-none"
    : "fixed inset-0 bg-black z-[500] flex flex-col overflow-hidden select-none"

  if (!mounted) return null

  return createPortal(
    <PrivacyShield enabled={isOpen}>
      <div
        className={rootStyles}
        onMouseMove={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
        onTouchStart={() => setShowControls(true)}
      >
        {/* Video Container */}
        <div className="flex-1 relative bg-black flex items-center justify-center">
          <div className="w-full h-full relative flex items-center justify-center">
            {["youtube", "vimeo", "twitch", "dailymotion", "soundcloud", "archive"].includes(session.videoType) ? (
              <iframe
                ref={iframeRef}
                src={getEmbedUrl(session.videoUrl || "", session.videoType)}
                className="w-full h-full border-0"
                allow="autoplay; fullscreen; picture-in-picture; encrypted-media; microphone"
                allowFullScreen
                onLoad={() => setPlayerReady(true)}
              />
            ) : (
              <video
                ref={videoRef}
                src={session.videoType !== "webrtc" && !session.videoUrl?.includes(".m3u8") ? (session.videoUrl || "") : undefined}
                className="w-full h-full object-contain"
                playsInline
                autoPlay={isPlaying}
                muted={isMuted}
                onTimeUpdate={handleProgress}
                onLoadedMetadata={handleMetadata}
                onWaiting={handleBuffer}
                onPlaying={handleBufferEnd}
                onPlay={() => console.log("Native onPlay")}
                onPause={() => console.log("Native onPause")}
                onError={(e) => {
                  console.error("Native video error:", e)
                  setPlayerReady(true)
                }}
              />
            )}

            {/* Click Shield - Prevents direct interaction with iframes/video */}
            <div
              className="absolute inset-0 z-40 cursor-default bg-transparent"
              onClick={() => {
                if (isHost) {
                  handlePlay();
                }
              }}
              onDoubleClick={toggleFullscreen}
              title={isHost ? "Click to play/pause" : "Governed by Host"}
            />

            {isHost && !localMovieStream && session.videoType === "webrtc" && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 backdrop-blur-md z-20">
                <div className="text-center p-12 rounded-[40px] bg-slate-800/80 border border-slate-700 shadow-2xl max-w-md animate-in fade-in zoom-in duration-500">
                  <div className="w-24 h-24 rounded-full bg-cyan-500/20 flex items-center justify-center mx-auto mb-6 border border-cyan-500/30">
                    <Film className="w-10 h-10 text-cyan-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Local Movie Streaming</h3>
                  <p className="text-slate-400 mb-8">Select a video or audio file from your device to start sharing with everyone in the room.</p>
                  <div className="flex flex-col gap-3">
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-cyan-500 hover:bg-cyan-600 text-white px-10 py-6 rounded-2xl text-lg font-bold shadow-lg shadow-cyan-500/20 w-full"
                    >
                      Select Media File
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={handleClose}
                      className="text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-xl"
                    >
                      Cancel & Exit
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Loading / Buffering Overlay */}
          {(!playerReady || session.status === "loading" || isBuffering || transcodingProgress !== null) && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-30 backdrop-blur-md">
              <div className="text-white text-center animate-in fade-in zoom-in duration-500">
                <div className="animate-spin w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full mx-auto mb-6" />
                <h3 className="text-xl font-bold mb-2">
                  {transcodingProgress !== null
                    ? `Processing compatibility... ${transcodingProgress}%`
                    : !playerReady ? "Initializing Cinema..."
                      : isBuffering ? "Waiting for Host..."
                        : "Synchronizing..."}
                </h3>
                <p className="text-slate-400 text-sm mb-8">This won&apos;t take long</p>
                <Button
                  variant="ghost"
                  onClick={handleClose}
                  className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-8 py-3 rounded-xl border border-red-500/30 transition-all font-bold"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel & Leave
                </Button>
                <Button
                  variant="ghost"
                  onClick={onMinimize}
                  className="bg-white/10 hover:bg-white/20 text-white px-8 py-3 rounded-xl border border-white/10 transition-all font-bold ml-3"
                >
                  <Minimize2 className="w-4 h-4 mr-2" />
                  Minimize
                </Button>
                {transcodingProgress !== null && (
                  <div className="w-64 h-1.5 bg-white/10 rounded-full mt-6 mx-auto overflow-hidden">
                    <div
                      className="h-full bg-cyan-500 transition-all duration-300"
                      style={{ width: `${transcodingProgress}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Controls Overlay */}
        <div
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-4 sm:p-6 transition-opacity duration-300 z-50 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        >
          {/* Progress Bar Area */}
          <div className="space-y-1 mb-4">
            <div className="flex items-center justify-between text-white/90 text-[10px] sm:text-xs px-0.5">
              <span className="font-medium bg-black/40 px-2 py-0.5 rounded-full">{formatTime(currentTime)}</span>
              <span className="font-medium bg-black/40 px-2 py-0.5 rounded-full tracking-wider">{formatTime(duration)}</span>
            </div>
            <div className="relative group py-2">
              <div className="w-full h-1 bg-white/20 rounded-full group-hover:h-1.5 transition-all overflow-hidden">
                <div
                  className="h-full bg-cyan-400 rounded-full relative shadow-[0_0_10px_rgba(34,211,238,0.5)]"
                  style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                />
              </div>
              {isHost && (
                <input
                  type="range"
                  min={0}
                  max={duration}
                  step="any"
                  value={currentTime}
                  onMouseDown={() => setIsDragging(true)}
                  onMouseUp={() => {
                    setIsDragging(false)
                    handleSeek(currentTime)
                  }}
                  onTouchStart={() => setIsDragging(true)}
                  onTouchEnd={() => {
                    setIsDragging(false)
                    handleSeek(currentTime)
                  }}
                  onChange={(e) => setCurrentTime(Number(e.target.value))}
                  className="absolute inset-x-0 -top-1 bottom-0 w-full opacity-0 cursor-pointer z-10"
                />
              )}
            </div>
          </div>

          {/* Buttons & Tools Bar Area */}
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
            {/* Left/Middle Section: Playback & Action Tools */}
            <div className="flex items-center gap-3 w-full lg:w-auto overflow-x-auto no-scrollbar py-1">
              {/* Playback Controls (Host Only) */}
              {isHost ? (
                <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-full border border-white/5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-full hover:bg-white/10"
                    onClick={() => handleSkip(-10)}
                  >
                    <SkipBack className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </Button>

                  <Button
                    variant={"ghost" as any}
                    size={"icon" as any}
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-cyan-400 hover:bg-cyan-500 shadow-lg shadow-cyan-400/20"
                    onClick={handlePlay}
                  >
                    {isPlaying ? <Pause className="w-5 h-5 sm:w-6 sm:h-6 text-black" /> : <Play className="w-5 h-5 sm:w-6 sm:h-6 text-black" />}
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-full hover:bg-white/10"
                    onClick={() => handleSkip(10)}
                  >
                    <SkipForward className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-gray-400 text-[10px] sm:text-xs bg-white/5 px-3 py-1.5 rounded-full border border-white/5 whitespace-nowrap">
                  <Users className="w-3 h-3 sm:w-4 sm:h-4 text-cyan-400" />
                  <span>Governed by Host</span>
                </div>
              )}

              {/* Action Tools */}
              {isHost && (
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="video/*,audio/*"
                    onChange={handleFileSelect}
                  />
                  <Button
                    variant={"ghost" as any}
                    size={"icon" as any}
                    title="Stream Local Movie"
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/5"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Film className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </Button>
                  <Button
                    variant={"ghost" as any}
                    size={"icon" as any}
                    title="Screen Share"
                    className="hidden sm:flex w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 items-center justify-center"
                    onClick={handleStartScreenShare}
                  >
                    <Monitor className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </Button>
                </div>
              )}
            </div>

            {/* Right Section: Interaction & Settings */}
            <div className="flex items-center justify-between lg:justify-end gap-3 w-full lg:w-auto">
              <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-full border border-white/5">
                <Button
                  variant={"ghost" as any}
                  size={"icon" as any}
                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full ${showChat ? "bg-cyan-500 text-white" : "hover:bg-white/10 text-white/70"}`}
                  onClick={() => setShowChat(!showChat)}
                >
                  <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
                </Button>

                <Button
                  variant={"ghost" as any}
                  size={"icon" as any}
                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full ${showEmojiPicker ? "bg-cyan-500 text-white" : "hover:bg-white/10 text-white/70"}`}
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                >
                  <Smile className="w-4 h-4 sm:w-5 sm:h-5" />
                </Button>

                <Button
                  variant={"ghost" as any}
                  size={"icon" as any}
                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full ${showPlaylist ? "bg-cyan-500 text-white" : "hover:bg-white/10 text-white/70"}`}
                  onClick={() => setShowPlaylist(!showPlaylist)}
                >
                  <List className="w-4 h-4 sm:w-5 sm:h-5" />
                </Button>

                <Button
                  variant={"ghost" as any}
                  size={"icon" as any}
                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full transition-all ${isPushToTalkActive ? "bg-green-500 scale-110 shadow-[0_0_15px_rgba(34,197,94,0.6)]" : "hover:bg-white/10 text-white/70"}`}
                  onMouseDown={() => handlePushToTalk(true)}
                  onMouseUp={() => handlePushToTalk(false)}
                  onMouseLeave={() => handlePushToTalk(false)}
                  onTouchStart={(e) => {
                    e.preventDefault()
                    handlePushToTalk(true)
                  }}
                  onTouchEnd={() => handlePushToTalk(false)}
                >
                  {isMicMuted ? <MicOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Mic className="w-4 h-4 sm:w-5 sm:h-5" />}
                </Button>

                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-full border border-white/5">
                  <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" />
                  <span className="text-[10px] sm:text-xs font-bold text-white/90">{participantsCount}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-4">
                {/* Volume (Desktop Only) */}
                <div className="hidden md:flex items-center gap-2 group">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 rounded-full hover:bg-white/10"
                    onClick={toggleMute}
                  >
                    {isMuted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
                  </Button>
                  <div className="w-0 overflow-hidden group-hover:w-24 transition-all duration-300">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.1}
                      value={isMuted ? 0 : volume}
                      onChange={(e) => {
                        const newVol = Number(e.target.value)
                        setVolume(newVol)
                        setIsMuted(newVol === 0)
                      }}
                      className="w-24 h-1 bg-white/20 rounded-full appearance-none cursor-pointer"
                    />
                  </div>
                </div>

                {/* Settings Popover */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"ghost" as any}
                      size={"icon" as any}
                      className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/5"
                    >
                      <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 bg-slate-900/95 border-slate-700 backdrop-blur-xl text-white p-4 rounded-3xl shadow-2xl">
                    <div className="space-y-6">
                      <h4 className="font-bold text-cyan-400 flex items-center gap-2">
                        <Settings className="w-4 h-4" /> Theater Settings
                      </h4>
                      {/* Speed */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-[10px] font-bold text-gray-400">
                          <span>PLAYBACK SPEED</span>
                          <span className="text-cyan-400">{playbackRate}x</span>
                        </div>
                        <Slider
                          value={[playbackRate]}
                          min={0.5}
                          max={2.0}
                          step={0.1}
                          onValueChange={([val]) => {
                            setPlaybackRate(val)
                            if (isHost) {
                              theaterQuality.setPlaybackSpeed(val)
                              theaterSignaling.syncPlaybackRate(roomId, session.id, val, currentUserId, currentUser)
                            }
                          }}
                        />
                      </div>
                      {/* Quality */}
                      <div className="space-y-3">
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center justify-between">
                          <span>QUALITY</span>
                          {qualitySettings.mode === 'auto' && <Badge variant="secondary" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 text-[8px] h-4">AUTO</Badge>}
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {['360p', '720p', '1080p'].map(q => (
                            <Button
                              key={q}
                              variant="ghost"
                              size="sm"
                              className={`text-[10px] h-7 rounded-lg border border-white/5 transition-all ${qualitySettings.preferredQuality === q ? 'bg-cyan-500 text-white border-cyan-500 shadow-lg shadow-cyan-500/20' : 'text-white/40 hover:bg-white/5 hover:text-white'}`}
                              onClick={() => {
                                theaterQuality.setQuality(q as any);
                                // Optionally sync host quality change to everyone
                                if (isHost) {
                                  theaterSignaling.sendAction(roomId, session.id, "quality_change", currentTime, currentUserId, currentUser, { quality: q });
                                }

                                // Update internal player quality if possible
                                if (videoRef.current) {
                                  // Native video doesn't have quality selection like this,
                                  // it would usually be done via different source URLs or HLS levels.
                                }
                              }}
                            >
                              {q}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {/* Subtitles */}
                      <div className="space-y-4 pt-2 border-t border-white/5">
                        <div className="flex items-center justify-between">
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <MessageSquare className="w-3 h-3 text-cyan-400" /> SUBTITLES
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`h-7 px-3 rounded-lg border transition-all ${qualitySettings.subtitles ? 'bg-cyan-500 text-white border-cyan-500 shadow-lg shadow-cyan-500/20' : 'bg-white/5 text-white/40 border-white/10 hover:text-white'}`}
                            onClick={() => {
                              theaterQuality.toggleSubtitles();
                              // Internal player subtitle logic
                              if (videoRef.current) {
                                // Native video subtitle logic (tracks)
                              }
                            }}
                          >
                            {qualitySettings.subtitles ? 'Enabled' : 'Disabled'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Minimize & Exit */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Button
                    variant={"ghost" as any}
                    size={"icon" as any}
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/5"
                    onClick={onMinimize}
                  >
                    <Minimize2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </Button>
                  <Button
                    variant={"ghost" as any}
                    size={"icon" as any}
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/5"
                    onClick={toggleFullscreen}
                  >
                    {isFullscreen ? <Minimize className="w-4 h-4 sm:w-5 sm:h-5 text-white" /> : <Maximize className="w-4 h-4 sm:w-5 sm:h-5 text-white" />}
                  </Button>
                  <Button
                    variant={"ghost" as any}
                    size={"icon" as any}
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20"
                    onClick={handleClose}
                  >
                    <X className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Playlist Sidebar */}
        <div
          className={`fixed sm:absolute top-0 right-0 bottom-0 w-full sm:w-80 bg-slate-950/95 sm:bg-slate-900/40 backdrop-blur-3xl border-l border-white/10 z-[70] transition-transform duration-500 ease-out shadow-[-20px_0_50px_rgba(0,0,0,0.5)] ${showPlaylist ? "translate-x-0" : "translate-x-full"}`}
        >
          <div className="flex flex-col h-full">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-black text-white text-lg tracking-tighter flex items-center gap-2">
                <List className="w-5 h-5 text-cyan-400" /> PLAYLIST
              </h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowPlaylist(false)}
                className="text-white/40 hover:text-white"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {queue.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-center opacity-20">
                  <Film className="w-12 h-12 mb-2" />
                  <p className="text-sm font-medium">Your queue is empty</p>
                </div>
              ) : (
                queue.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-2xl border transition-all group ${idx === 0 ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-slate-800 flex items-center justify-center text-[10px] font-bold text-white/40 group-hover:text-cyan-400">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-white truncate group-hover:text-cyan-400 transition-colors">{item.title}</h4>
                        <p className="text-[10px] font-medium text-white/30 truncate">Added by {item.addedByName}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {isHost && (
              <div className="p-6 bg-white/5 border-t border-white/5 space-y-3">
                <div className="relative">
                  <Input
                    value={newQueueUrl}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewQueueUrl(e.target.value)}
                    placeholder="Paste Video URL..."
                    className="bg-white/5 border-white/10 rounded-2xl h-12 pr-12 text-sm placeholder:text-white/20"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleAddToQueue}
                    disabled={!newQueueUrl.trim() || isAddingToQueue}
                    className="absolute right-1 top-1 h-10 w-10 text-cyan-400 hover:text-cyan-300"
                  >
                    <Play className="w-4 h-4 fill-current" />
                  </Button>
                </div>
                <p className="text-[10px] text-center text-white/20 font-medium">Add YouTube, Vimeo, Twitch, or Direct links</p>
              </div>
            )}
          </div>
        </div>

        {/* Floating Emojis */}
        <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
          {floatingEmojis.map((emoji) => (
            <div
              key={emoji.id}
              className="absolute text-4xl animate-bounce"
              style={{
                left: `${emoji.x}%`,
                top: `${emoji.y}%`,
                animationDuration: '2s',
              }}
            >
              {emoji.emoji}
            </div>
          ))}
          {/* Style for float animation manually injected if needed, or rely on animate-bounce for visibility */}
          <style jsx>{`
          @keyframes floatUp {
            0% { transform: translateY(0) scale(0.5); opacity: 0; }
            10% { opacity: 1; transform: translateY(0) scale(1); }
            100% { transform: translateY(-100px) scale(1.5); opacity: 0; }
          }
        `}</style>
        </div>

        {/* OSD Layers */}
        {isHost && (
          <div className="absolute top-4 left-4 bg-cyan-500/90 backdrop-blur text-white px-3 py-1 rounded-full text-sm font-medium shadow-lg z-20">
            Host
          </div>
        )}

        {isPushToTalkActive && (
          <div className="absolute top-4 right-4 bg-green-500/90 backdrop-blur-md text-white px-4 py-2 rounded-2xl text-xs font-bold animate-pulse shadow-2xl z-20 flex items-center gap-2 border border-green-400/30">
            <Mic className="w-3.5 h-3.5" />
            <span>SPEAKING</span>
          </div>
        )}

        <TheaterChatOverlay
          isOpen={showChat}
          onClose={() => setShowChat(false)}
          messages={messages}
          roomId={roomId}
          currentUser={currentUser}
          currentUserId={currentUserId}
        />

        <EmojiPicker
          isOpen={showEmojiPicker}
          onClose={() => setShowEmojiPicker(false)}
          onEmojiSelect={handleReaction}
        />
      </div>
    </PrivacyShield>,
    document.body
  )
}
