"use client"

import { useState, useRef, useEffect, useCallback } from "react"
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
import { SoundCloudPlayerController } from "@/utils/infra/soundcloud-widget"
import { Settings, List, ChevronRight, ChevronLeft, FastForward, Music2 } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"

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
  showSoundboard?: boolean
  setShowSoundboard?: (val: boolean) => void
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
  showSoundboard,
  setShowSoundboard,
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
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0)
  const lastMessageIdRef = useRef<string | null>(null)
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

  const iframePlayerReadyRef = useRef<boolean>(false)
  const pendingCommandsRef = useRef<Array<{ action: 'play' | 'pause' | 'seek', time?: number }>>([])
  const soundcloudControllerRef = useRef<SoundCloudPlayerController | null>(null)
  const toIcePayload = (c: RTCIceCandidate) => ({
    candidate: c.candidate,
    sdpMid: c.sdpMid,
    sdpMLineIndex: c.sdpMLineIndex
  })

  useEffect(() => {
    setMounted(true)
    videoStreamManagerRef.current = new VideoStreamManager()
    const unsubscribeQueue = theaterQueue.subscribe(setQueue)
    const unsubscribeQuality = theaterQuality.subscribe(setQualitySettings)
    const unsubscribePresence = userPresence.listenForPresence(roomId, (users: any[]) => {
      setParticipantsCount(users.length)
      if (session && session.hostId && users.length > 0) {
        const currentHostGone = !users.find(u => u.uid === session.hostId)
        if (currentHostGone) {
          const sortedUsers = [...users].sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0))
          if (sortedUsers[0].uid === currentUserId) {
            theaterSignaling.transferHost(roomId, session.id, currentUserId, currentUser);
          }
        }
      }
    })
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      videoStreamManagerRef.current?.cleanup()
      unsubscribeQueue()
      unsubscribeQuality()
      unsubscribePresence()
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  useEffect(() => {
    if (!showChat && messages.length > 0) {
      const lastMsg = messages[messages.length - 1]
      if (lastMsg.id !== lastMessageIdRef.current) {
        setUnreadMessagesCount(prev => prev + 1)
        lastMessageIdRef.current = lastMsg.id
      }
    } else if (showChat) {
      setUnreadMessagesCount(0)
      if (messages.length > 0) {
        lastMessageIdRef.current = messages[messages.length - 1].id
      }
    }
  }, [messages, showChat])

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
      video.srcObject = null
      const initHls = async () => {
        try {
          const { default: Hls } = await import("hls.js")
          if (Hls.isSupported()) {
            const hls = new Hls()
            hls.loadSource(session.videoUrl as string)
            hls.attachMedia(video)
            hls.on(Hls.Events.MANIFEST_PARSED, () => { if (isPlaying) video.play() })
            return () => hls.destroy()
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = session.videoUrl as string
          }
        } catch (err) { console.error("HLS init error:", err) }
      }
      const cleanup = initHls()
      return () => { cleanup.then(fn => fn?.()) }
    } else { video.srcObject = null }
  }, [session.videoType, isHost, localMovieStream, remoteMovieStream, session.videoUrl, isPlaying])

  useEffect(() => { if (videoRef.current) videoRef.current.volume = isMuted ? 0 : volume }, [volume, isMuted])
  useEffect(() => { if (videoRef.current) videoRef.current.playbackRate = playbackRate }, [playbackRate])

  useEffect(() => {
    if (isOpen && !playerReady && !playerReadyTimeoutRef.current && session.status !== "loading") {
      playerReadyTimeoutRef.current = setTimeout(() => {
        if (!playerReady) setPlayerReady(true)
      }, 10000)
    }
    return () => {
      if (playerReadyTimeoutRef.current && !isOpen) {
        clearTimeout(playerReadyTimeoutRef.current)
        playerReadyTimeoutRef.current = undefined
      }
    }
  }, [isOpen, playerReady, session.status])

  useEffect(() => {
    if (isOpen && playerReady && !isHost && currentTime === 0 && session.currentTime > 0) {
      if (videoRef.current) videoRef.current.currentTime = session.currentTime;
      setCurrentTime(session.currentTime);
    }
  }, [isOpen, playerReady, isHost, session.currentTime])

  useEffect(() => {
    if (isOpen && isHost && pendingFile && onFileProcessed) {
      handleFileSelect(undefined, pendingFile)
      onFileProcessed()
    }
  }, [isOpen, isHost, pendingFile, onFileProcessed])

  useEffect(() => {
    if (isOpen && isHost && pendingScreenStream && onScreenStreamProcessed) {
      handleScreenStreamReady(pendingScreenStream)
      onScreenStreamProcessed()
    }
  }, [isOpen, isHost, pendingScreenStream, onScreenStreamProcessed])

  const handleScreenStreamReady = async (stream: MediaStream) => {
    setLocalMovieStream(stream)
    await theaterSignaling.updateSessionMedia(roomId, session.id, "screen://share", "webrtc")
    const webrtc = WebRTCManager.getInstance()
    const participants = session.participants || []
    participants.forEach(async (participantId: string) => {
      if (participantId === currentUserId) return
      webrtc.initialize(participantId, stream,
        (s, uid, label) => { if (uid === participantId && label === "theater") setRemoteMovieStream(s) },
        (c, uid) => { if (uid === participantId) theaterSignaling.sendSignal(roomId, session.id, "ice-candidate", toIcePayload(c), currentUserId, participantId) },
        undefined, "theater")
      const offer = await webrtc.createOffer(participantId)
      theaterSignaling.sendSignal(roomId, session.id, "offer", offer, currentUserId, participantId)
      connectedPeersRef.current.add(participantId)
    })
    setIsBuffering(false); setIsPlaying(true); setCurrentTime(0)
    try { await theaterSignaling.sendAction(roomId, session.id, "play", 0, currentUserId, currentUser) } catch (err) { console.error("Failed to send play action:", err) }
    const videoTrack = stream.getVideoTracks()[0]
    if (videoTrack) { videoTrack.onended = () => { stream.getTracks().forEach(t => t.stop()); setLocalMovieStream(null); setIsPlaying(false) } }
  }

  const handleStartScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: "always" } as any, audio: true })
      handleScreenStreamReady(stream)
    } catch (err) { console.error("Screen share error:", err) }
  }

  useEffect(() => {
    if (!session || !isOpen) return
    const webrtc = WebRTCManager.getInstance()
    const unsubscribeSignals = theaterSignaling.listenForSignals(roomId, session.id, currentUserId, async (type, payload, fromUserId) => {
      if (type === "offer") {
        const streamToUse = localMovieStream || localStreamRef.current || new MediaStream()
        webrtc.initialize(fromUserId, streamToUse, (s, uid, label) => { if (uid === fromUserId && label === "theater") setRemoteMovieStream(s) },
          (c, uid) => { if (uid === fromUserId) theaterSignaling.sendSignal(roomId, session.id, "ice-candidate", { candidate: c.candidate, sdpMid: c.sdpMid, sdpMLineIndex: c.sdpMLineIndex }, currentUserId, fromUserId) },
          undefined, "theater")
        const answer = await webrtc.createAnswer(fromUserId, payload)
        theaterSignaling.sendSignal(roomId, session.id, "answer", answer, currentUserId, fromUserId)
      } else if (type === "answer") { await webrtc.handleAnswer(fromUserId, payload) }
      else if (type === "ice-candidate") { await webrtc.addIceCandidate(fromUserId, payload) }
    })
    return () => unsubscribeSignals()
  }, [session.id, roomId, currentUserId])

  useEffect(() => { return () => WebRTCManager.getInstance().cleanup() }, [])

  const reactivateControls = useCallback(() => {
    setShowControls(true)
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)

    // Auto-hide after 3 seconds of inactivity
    controlsTimeoutRef.current = setTimeout(() => {
      if (!showChat && !showEmojiPicker && !showPlaylist && !showSoundboard) {
        setShowControls(false)
      }
    }, 3000)
  }, [showChat, showEmojiPicker, showPlaylist, showSoundboard])

  useEffect(() => {
    reactivateControls()
  }, [reactivateControls])

  const setupMic = async () => {
    if (localStreamRef.current) return localStreamRef.current
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      localStreamRef.current = stream
      stream.getAudioTracks().forEach(track => track.enabled = false)
      setIsMicMuted(true)
      return stream
    } catch (err) { console.error("Failed to get microphone:", err); return null }
  }

  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop())
        localStreamRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (session?.videoType) {
      iframePlayerReadyRef.current = false; pendingCommandsRef.current = []; setPlayerReady(false)
    }
  }, [session?.videoType])

  useEffect(() => {
    if (!session) return
    const unsubscribe = theaterSignaling.listenForSession(roomId, session.id, (updatedSession: any) => {
      if (updatedSession.status === "ended") { setTimeout(() => onClose(), 1000); return }
      if (updatedSession.lastAction && updatedSession.lastAction.hostId !== currentUserId && updatedSession.lastAction.timestamp > (lastActionTimestampRef.current || 0)) {
        lastActionTimestampRef.current = updatedSession.lastAction.timestamp;
        const action = updatedSession.lastAction
        switch (action.type) {
          case "play":
            setIsPlaying(true)
            syncIframePlayer("play")
            if (session.videoType === "webrtc" && videoStreamManagerRef.current) videoStreamManagerRef.current.syncPlayback('play')
            if (session.videoType === "direct" && videoRef.current) videoRef.current.play().catch(err => console.error("Play error:", err))

            if (action.currentTime !== undefined && Math.abs(currentTime - action.currentTime) > 1) {
              if (videoRef.current) videoRef.current.currentTime = action.currentTime
              syncIframePlayer("seek", action.currentTime)
              if (session.videoType === "webrtc" && videoStreamManagerRef.current) videoStreamManagerRef.current.syncPlayback('seek', action.currentTime)
            }
            break
          case "pause":
            setIsPlaying(false); syncIframePlayer("pause")
            if (session.videoType === "webrtc" && videoStreamManagerRef.current) videoStreamManagerRef.current.syncPlayback('pause')
            if (session.videoType === "direct" && videoRef.current) videoRef.current.pause()
            break
          case "seek":
            if (action.currentTime !== undefined) {
              if (videoRef.current) videoRef.current.currentTime = action.currentTime
              syncIframePlayer("seek", action.currentTime)
              if (session.videoType === "webrtc" && videoStreamManagerRef.current) videoStreamManagerRef.current.syncPlayback('seek', action.currentTime)
              if (session.videoType === "direct" && videoRef.current && isPlaying) videoRef.current.play().catch(err => console.error("Play error:", err))
              setCurrentTime(action.currentTime)
            }
            break
          case "buffering": setIsBuffering(true); setIsPlaying(false); break
          case "reaction": if (action.payload?.emoji) addFloatingEmoji(action.payload.emoji); break
          case "join_sync": if (isHost && action.payload?.requestorId) theaterSignaling.sendAction(roomId, session.id, "seek", currentTime, currentUserId, currentUser, { targetId: action.payload.requestorId }); break
          case "quality_change": if (action.payload?.quality) theaterQuality.setQuality(action.payload.quality); break
        }
      }
      if (updatedSession.queue) { theaterQueue.clearQueue(); updatedSession.queue.forEach((v: any) => theaterQueue.addToQueue(v)) }
      if (updatedSession.status === 'buffering' && !isHost) { setIsBuffering(true); setIsPlaying(false) }
      else if (updatedSession.status === 'playing' && isBuffering) { setIsBuffering(false); setIsPlaying(true) }
      if (!isHost && updatedSession.status === 'playing' && playerReady) {
        const drift = updatedSession.currentTime - currentTime
        if (Math.abs(drift) > 5) {
          if (videoRef.current) videoRef.current.currentTime = updatedSession.currentTime
          setCurrentTime(updatedSession.currentTime); setPlaybackRate(1.0)
        } else if (Math.abs(drift) > 0.5) { setPlaybackRate(drift > 0 ? 1.05 : 0.95) }
        else if (playbackRate !== 1.0) setPlaybackRate(1.0)
      }
      if (isHost && updatedSession.videoType === "webrtc" && localMovieStream) {
        const currentParticipants = updatedSession.participants || []
        currentParticipants.forEach(async (participantId: string) => {
          if (participantId !== currentUserId && !connectedPeersRef.current.has(participantId)) {
            WebRTCManager.getInstance().initialize(participantId, localMovieStream,
              (s, uid, label) => { if (uid === participantId && label === "theater") setRemoteMovieStream(s) },
              (c, uid) => { if (uid === participantId) theaterSignaling.sendSignal(roomId, session.id, "ice-candidate", toIcePayload(c), currentUserId, participantId) },
              undefined, "theater")
            const offer = await WebRTCManager.getInstance().createOffer(participantId)
            theaterSignaling.sendSignal(roomId, session.id, "offer", offer, currentUserId, participantId)
            connectedPeersRef.current.add(participantId)
          }
        })
      }
    })
    return () => unsubscribe()
  }, [session.id, roomId, currentUserId, onClose, isHost])

  const addFloatingEmoji = (emoji: string) => {
    const id = Math.random().toString(36).substr(2, 9)
    const x = Math.random() * 80 + 10; const y = Math.random() * 50 + 25
    setFloatingEmojis((prev) => [...prev, { id, emoji, x, y }])
    setTimeout(() => setFloatingEmojis((prev) => prev.filter((e) => e.id !== id)), 2000)
  }

  const handleReaction = (emoji: string) => {
    theaterSignaling.sendReaction(roomId, session.id, emoji, currentUserId, currentUser)
    addFloatingEmoji(emoji); setShowEmojiPicker(false)
  }

  const getEmbedUrl = (url: string, type: string) => {
    if (type === "youtube") {
      const match = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|live\/)|youtu\.be\/)([^&\n?#]+)/)
      return match ? `https://www.youtube.com/embed/${match[1]}?enablejsapi=1&autoplay=0&controls=0&origin=${typeof window !== 'undefined' ? window.location.origin : '*'}` : url
    }
    if (type === "vimeo") {
      const match = url.match(/vimeo\.com\/(?:groups\/[^/]+\/videos\/|)(\d+)/)
      return match ? `https://player.vimeo.com/video/${match[1]}?api=1&autoplay=0` : url
    }
    if (type === "twitch") {
      const match = url.match(/twitch\.tv\/([a-zA-Z0-9_]+)/)
      return match ? `https://player.twitch.tv/?channel=${match[1]}&parent=${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}&autoplay=false` : url
    }
    if (type === "dailymotion") {
      const match = url.match(/(?:dailymotion\.com\/video\/|dai\.ly\/)([a-zA-Z0-9]+)/)
      return match ? `https://www.dailymotion.com/embed/video/${match[1]}?autoplay=0&controls=0` : url
    }
    if (type === "soundcloud") return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true`
    if (type === "archive") {
      if (url.includes("/details/")) return url.replace("/details/", "/embed/")
      if (url.includes("/embed/")) return url
      const itemMatch = url.match(/archive\.org\/([a-zA-Z0-9_-]+)/)
      return itemMatch ? `https://archive.org/embed/${itemMatch[1]}` : url
    }
    return url
  }

  const syncIframePlayer = (action: 'play' | 'pause' | 'seek', time?: number) => {
    if (!iframeRef.current) return
    const iframe = iframeRef.current
    const type = session.videoType
    if (!iframePlayerReadyRef.current) { pendingCommandsRef.current.push({ action, time }); return }
    const executeCommand = () => {
      if (type === "youtube") {
        const msg = action === 'play' ? '{"event":"command","func":"playVideo","args":""}' :
          action === 'pause' ? '{"event":"command","func":"pauseVideo","args":""}' :
            `{"event":"command","func":"seekTo","args":[${time}, true]}`
        iframe.contentWindow?.postMessage(msg, '*')
      } else if (type === "vimeo") {
        const msg = action === 'play' ? '{"method":"play"}' : action === 'pause' ? '{"method":"pause"}' : `{"method":"seekTo","value":${time}}`
        iframe.contentWindow?.postMessage(msg, '*')
      } else if (type === "dailymotion") {
        const msg = action === 'play' ? '{"command":"play"}' : action === 'pause' ? '{"command":"pause"}' : `{"command":"seek","parameters":[${time}]}`
        iframe.contentWindow?.postMessage(msg, '*')
      } else if (type === "soundcloud") {
        if (soundcloudControllerRef.current) {
          if (action === 'play') soundcloudControllerRef.current.play()
          else if (action === 'pause') soundcloudControllerRef.current.pause()
          else if (action === 'seek' && time !== undefined) soundcloudControllerRef.current.seekTo(time)
        } else {
          const msg = action === 'play' ? '{"method":"play"}' : action === 'pause' ? '{"method":"pause"}' : `{"method":"seekTo","value":${(time || 0) * 1000}}`
          iframe.contentWindow?.postMessage(msg, '*')
        }
      } else if (type === "twitch") {
        const msg = action === 'play' ? '{"command":"play"}' : action === 'pause' ? '{"command":"pause"}' : `{"command":"seek","args":[${time}]}`
        iframe.contentWindow?.postMessage(msg, '*')
      }
    }
    executeCommand()
  }

  const processPendingCommands = () => {
    const commands = [...pendingCommandsRef.current]; pendingCommandsRef.current = []
    commands.forEach(cmd => syncIframePlayer(cmd.action, cmd.time))
  }

  const handlePlay = async () => {
    if (!isHost) return
    const now = Date.now(); if (now - lastPlaybackToggleRef.current < 800) return
    lastPlaybackToggleRef.current = now
    const newIsPlaying = !isPlaying; setIsPlaying(newIsPlaying)
    if (session.videoType === "direct" && videoRef.current) {
      if (newIsPlaying) videoRef.current.play().catch(err => console.error("Play error:", err))
      else videoRef.current.pause()
    }
    if (session.videoType !== "direct" && session.videoType !== "webrtc") syncIframePlayer(newIsPlaying ? 'play' : 'pause')
    if (session.videoType === "webrtc" && videoStreamManagerRef.current) videoStreamManagerRef.current.syncPlayback(newIsPlaying ? 'play' : 'pause')
    try { await theaterSignaling.sendAction(roomId, session.id, newIsPlaying ? "play" : "pause", currentTime, currentUserId, currentUser) } catch (err) { console.error("Failed to send playback action:", err) }
  }

  const handleSeek = async (newTime: number) => {
    if (!isHost) return
    if (videoRef.current) videoRef.current.currentTime = newTime
    if (session.videoType === "webrtc" && videoStreamManagerRef.current) videoStreamManagerRef.current.syncPlayback('seek', newTime)
    syncIframePlayer("seek", newTime); setCurrentTime(newTime)
    await theaterSignaling.sendAction(roomId, session.id, "seek", newTime, currentUserId, currentUser)
  }

  const handleSkip = async (seconds: number) => {
    if (!isHost) return
    const newTime = duration > 0 ? Math.max(0, Math.min(duration, currentTime + seconds)) : Math.max(0, currentTime + seconds)
    handleSeek(newTime)
  }

  const handleProgress = () => {
    const video = videoRef.current; if (!video || isDragging) return
    setCurrentTime(video.currentTime)
    if (isHost && isPlaying && video.currentTime % 5 < 0.2) theaterSignaling.updateCurrentTime(roomId, session.id, video.currentTime)
  }

  const handleMetadata = () => { if (videoRef.current) { setDuration(videoRef.current.duration || 0); setPlayerReady(true) } }
  const handleBuffer = () => { if (isHost && !isBuffering) { theaterSignaling.sendBuffering(roomId, session.id, currentUserId, currentUser); setIsBuffering(true) } }
  const handleBufferEnd = () => { if (isHost && isBuffering) { theaterSignaling.sendAction(roomId, session.id, "play", videoRef.current ? videoRef.current.currentTime : 0, currentUserId, currentUser); setIsBuffering(false) } }

  const [isDragging, setIsDragging] = useState(false)
  const toggleMute = () => setIsMuted(!isMuted)

  const handlePushToTalk = async (active: boolean) => {
    let stream = localStreamRef.current; if (active && !stream) stream = await setupMic()
    if (stream) {
      if (active) stream.getAudioTracks().forEach(track => track.enabled = true)
      else { stream.getAudioTracks().forEach(track => track.stop()); localStreamRef.current = null }
      setIsPushToTalkActive(active); setIsMicMuted(!active)
      WebRTCManager.getInstance().replaceAudioTrack(active ? stream.getAudioTracks()[0] : null)
      userPresence.setRecordingVoice(roomId, currentUserId, active).catch(err => console.error("Error updating presence:", err))
    }
  }

  const handleFileSelect = async (e?: React.ChangeEvent<HTMLInputElement>, directFile?: File) => {
    const file = directFile || e?.target.files?.[0]
    if (!file || !videoStreamManagerRef.current) return
    try {
      setIsBuffering(true); setTranscodingProgress(null)
      await videoStreamManagerRef.current.loadFile(file, (p) => setTranscodingProgress(p))
      setTranscodingProgress(null)
      const stream = videoStreamManagerRef.current.captureStream(); setLocalMovieStream(stream)
      await theaterSignaling.updateSessionMedia(roomId, session.id, "local://stream", "webrtc")
      session.participants.forEach(async (participantId) => {
        if (participantId === currentUserId) return
        WebRTCManager.getInstance().initialize(participantId, stream,
          (s, uid, label) => { if (uid === participantId && label === "theater") setRemoteMovieStream(s) },
          (c, uid) => { if (uid === participantId) theaterSignaling.sendSignal(roomId, session.id, "ice-candidate", toIcePayload(c), currentUserId, participantId) },
          undefined, "theater")
        const offer = await WebRTCManager.getInstance().createOffer(participantId)
        theaterSignaling.sendSignal(roomId, session.id, "offer", offer, currentUserId, participantId)
        connectedPeersRef.current.add(participantId)
      })
      setIsBuffering(false); setIsPlaying(true); setCurrentTime(0)
      try { await theaterSignaling.sendAction(roomId, session.id, "play", 0, currentUserId, currentUser) } catch (err) { console.error("Failed to send play action:", err) }
      videoStreamManagerRef.current.syncPlayback('play')
    } catch (err: any) { console.error("Streaming error:", err); setIsBuffering(false) }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.code === "Space" || e.key === "v") && !isPushToTalkActive && isOpen) {
        if (document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
          if (e.code === "Space") e.preventDefault(); handlePushToTalk(true)
        }
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => { if (e.code === "Space" || e.key === "v") if (isPushToTalkActive) handlePushToTalk(false) }
    window.addEventListener("keydown", handleKeyDown); window.addEventListener("keyup", handleKeyUp)
    return () => { window.removeEventListener("keydown", handleKeyDown); window.removeEventListener("keyup", handleKeyUp) }
  }, [isPushToTalkActive, isOpen, roomId, currentUserId])

  const handleAddToQueue = async () => {
    if (!newQueueUrl.trim() || !isHost) return
    setIsAddingToQueue(true)
    try {
      const video = { url: newQueueUrl.trim(), title: "Added Video", duration: 0, addedBy: currentUserId, addedByName: currentUser, metadata: { type: 'stream' as const } }
      if (theaterQueue.addToQueue(video as any)) {
        await theaterSignaling.updateQueue(roomId, session.id, (theaterQueue as any).queue)
        await theaterSignaling.sendAction(roomId, session.id, "queue_update", 0, currentUserId, currentUser); setNewQueueUrl("")
      }
    } catch (err) { console.error("Queue add error:", err) } finally { setIsAddingToQueue(false) }
  }

  const handleClose = async () => { if (isHost) await theaterSignaling.endSession(roomId, session.id); onClose() }
  const formatTime = (time: number) => { const min = Math.floor(time / 60); const sec = Math.floor(time % 60); return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}` }
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        // Try to lock orientation to landscape on mobile
        if (window.screen.orientation && (window.screen.orientation as any).lock) {
          (window.screen.orientation as any).lock('landscape').catch((err: any) => {
            console.warn("Orientation lock failed:", err)
          })
        }
      }).catch(err => {
        console.error("Fullscreen request failed:", err)
      })
    } else {
      document.exitFullscreen()
      // Unlock orientation if it was locked
      if (window.screen.orientation && (window.screen.orientation as any).unlock) {
        (window.screen.orientation as any).unlock()
      }
    }
  }

  if (!mounted) return null

  return createPortal(
    <PrivacyShield enabled={isOpen}>
      <div className={!isOpen ? "fixed top-[-9999px] left-[-9999px] opacity-0" : "fixed inset-0 bg-black z-[500] flex flex-col overflow-hidden select-none"}
        onMouseMove={reactivateControls} onMouseLeave={() => setShowControls(false)} onTouchStart={reactivateControls}>
        <div className="flex-1 relative bg-black flex items-center justify-center">
          <div className="w-full h-full relative flex items-center justify-center">
            {["youtube", "vimeo", "twitch", "dailymotion", "soundcloud", "archive"].includes(session.videoType) ? (
              <iframe ref={iframeRef} src={getEmbedUrl(session.videoUrl || "", session.videoType)} className="w-full h-full border-0" allow="autoplay; fullscreen; encrypted-media; microphone" allowFullScreen
                onLoad={() => {
                  setPlayerReady(true); iframePlayerReadyRef.current = true
                  if (session.videoType === "soundcloud" && iframeRef.current) {
                    const ctrl = new SoundCloudPlayerController(); ctrl.initialize(iframeRef.current).then(() => { soundcloudControllerRef.current = ctrl })
                  }
                  setTimeout(() => processPendingCommands(), 500)
                }} />
            ) : (
              <video ref={videoRef} src={session.videoType !== "webrtc" && !session.videoUrl?.includes(".m3u8") ? (session.videoUrl || "") : undefined} className="w-full h-full object-contain" playsInline autoPlay={isPlaying} muted={isMuted}
                onTimeUpdate={handleProgress} onLoadedMetadata={handleMetadata} onWaiting={handleBuffer} onPlaying={handleBufferEnd} />
            )}
            <div className="absolute inset-0 z-40 cursor-default bg-transparent" onClick={() => { if (isHost) handlePlay() }} onDoubleClick={toggleFullscreen} />
          </div>

          {(!playerReady || session.status === "loading" || isBuffering || transcodingProgress !== null) && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-30 backdrop-blur-md">
              <div className="text-white text-center">
                <div className="animate-spin w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full mx-auto mb-6" />
                <h3 className="text-xl font-bold mb-2">{transcodingProgress !== null ? `Processing... ${transcodingProgress}%` : !playerReady ? "Initializing..." : isBuffering ? "Buffering..." : "Syncing..."}</h3>
                <Button variant="ghost" onClick={handleClose} className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-8 py-3 rounded-xl border border-red-500/30">Cancel</Button>
                <Button variant="ghost" onClick={onMinimize} className="bg-white/10 hover:bg-white/20 text-white px-8 py-3 rounded-xl border border-white/10 ml-3">Minimize</Button>
              </div>
            </div>
          )}
        </div>

        <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-4 sm:p-6 transition-opacity duration-300 z-50 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
          <div className="space-y-1 mb-2 sm:mb-4">
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-block font-medium bg-black/40 px-2 py-0.5 rounded-full text-white/90 text-[10px] sm:text-xs shrink-0">{formatTime(currentTime)}</span>
              <div className="flex-1 relative group py-2">
                <div className="w-full h-1 bg-white/20 rounded-full group-hover:h-1.5 transition-all overflow-hidden border border-white/5">
                  <div className="h-full bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.5)]" style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }} />
                </div>
                {isHost && <input type="range" min={0} max={duration || 100} step="any" value={currentTime}
                  onMouseDown={() => setIsDragging(true)}
                  onMouseUp={(e) => { setIsDragging(false); handleSeek(Number((e.target as HTMLInputElement).value)) }}
                  onTouchStart={() => setIsDragging(true)}
                  onTouchEnd={(e) => { setIsDragging(false); handleSeek(Number((e.target as HTMLInputElement).value)) }}
                  onChange={(e) => setCurrentTime(Number(e.target.value))}
                  className="absolute inset-x-0 -top-1 bottom-0 w-full opacity-0 cursor-pointer z-10" />}
              </div>
              <span className="hidden sm:inline-block font-medium bg-black/40 px-2 py-0.5 rounded-full text-white/90 text-[10px] sm:text-xs shrink-0">{formatTime(duration)}</span>
            </div>
            {/* Mobile-only time bar below seekbar for portrait, but we'll hide it in landscape later with CSS or just keep it side-by-side */}
            <div className="flex sm:hidden items-center justify-between text-white/90 text-[10px] px-0.5">
              <span className="font-medium bg-black/40 px-2 py-0.5 rounded-full">{formatTime(currentTime)}</span>
              <span className="font-medium bg-black/40 px-2 py-0.5 rounded-full">{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex flex-row items-center justify-between gap-3 sm:gap-4 w-full overflow-x-auto no-scrollbar pb-1">
            {/* Left Controls */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {isHost ? (
                <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-full border border-white/5 backdrop-blur-md">
                  <Button variant="ghost" size="icon" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full hover:bg-white/10" onClick={() => handleSkip(-10)}><SkipBack className="w-4 h-4 sm:w-5 sm:h-5 text-white" /></Button>
                  <Button variant={"ghost" as any} size={"icon" as any} className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-cyan-400 hover:bg-cyan-500 shadow-lg text-black" onClick={handlePlay}>
                    {isPlaying ? <Pause className="w-4 h-4 sm:w-5 sm:h-5" /> : <Play className="w-4 h-4 sm:w-5 sm:h-5" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full hover:bg-white/10" onClick={() => handleSkip(10)}><SkipForward className="w-4 h-4 sm:w-5 sm:h-5 text-white" /></Button>
                </div>
              ) : <div className="flex items-center gap-2 text-white/50 text-[10px] sm:text-xs bg-white/5 px-3 py-1.5 rounded-full border border-white/5 backdrop-blur-md">Host Controlled</div>}
              {isHost && (
                <div className="flex items-center gap-2">
                  <input type="file" ref={fileInputRef} className="hidden" accept="video/*,audio/*" onChange={handleFileSelect} />
                  <Button variant="ghost" size="icon" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/5 border border-white/5 hover:bg-white/10" onClick={() => fileInputRef.current?.click()}><Film className="w-4 h-4 sm:w-5 sm:h-5 text-white" /></Button>
                  <Button variant="ghost" size="icon" className="hidden sm:flex w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/5 border border-white/5 hover:bg-white/10" onClick={handleStartScreenShare}><Monitor className="w-4 h-4 sm:w-5 sm:h-5 text-white" /></Button>
                </div>
              )}
            </div>

            {/* Right Controls - Compact for landscape */}
            <div className="flex items-center gap-1.5 sm:gap-3 overflow-x-auto no-scrollbar py-0.5 px-0.5 justify-end flex-1">
              <div className="flex items-center gap-1 bg-white/5 p-1 rounded-full border border-white/5 backdrop-blur-md">
                <Button variant="ghost" size="icon" className={`relative w-8 h-8 sm:w-10 sm:h-10 rounded-full transition-colors ${showChat ? "bg-cyan-500 text-white" : "text-white/70 hover:bg-white/10"}`} onClick={() => setShowChat(!showChat)}>
                  <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
                  {unreadMessagesCount > 0 && !showChat && <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 bg-red-500 text-[10px] animate-pulse border-none">{unreadMessagesCount > 9 ? "9+" : unreadMessagesCount}</Badge>}
                </Button>
                <Button variant="ghost" size="icon" className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full transition-colors ${showSoundboard ? "bg-cyan-500 text-white" : "text-white/70 hover:bg-white/10"}`} onClick={() => setShowSoundboard?.(!showSoundboard)}><Music2 className="w-4 h-4 sm:w-5 sm:h-5" /></Button>
                <Button variant="ghost" size="icon" className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full transition-colors ${showEmojiPicker ? "bg-cyan-500 text-white" : "text-white/70 hover:bg-white/10"}`} onClick={() => setShowEmojiPicker(!showEmojiPicker)}><Smile className="w-4 h-4 sm:w-5 sm:h-5" /></Button>
                <Button variant="ghost" size="icon" className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full transition-colors ${showPlaylist ? "bg-cyan-500 text-white" : "text-white/70 hover:bg-white/10"}`} onClick={() => setShowPlaylist(!showPlaylist)}><List className="w-4 h-4 sm:w-5 sm:h-5" /></Button>
                <Button variant="ghost" size="icon" className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full transition-colors ${isPushToTalkActive ? "bg-green-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.3)]" : "text-white/70 hover:bg-white/10"}`} onMouseDown={() => handlePushToTalk(true)} onMouseUp={() => handlePushToTalk(false)} onTouchStart={(e) => { e.preventDefault(); handlePushToTalk(true) }} onTouchEnd={() => handlePushToTalk(false)}>{isMicMuted ? <MicOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Mic className="w-4 h-4 sm:w-5 sm:h-5" />}</Button>
              </div>

              <div className="flex items-center gap-1 sm:gap-2">
                <Button variant="ghost" size="icon" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/5 border border-white/5 hover:bg-white/10" onClick={onMinimize}><Minimize2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" /></Button>
                <Button variant="ghost" size="icon" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/5 border border-white/5 hover:bg-white/10" onClick={toggleFullscreen}>{isFullscreen ? <Minimize className="w-4 h-4 sm:w-5 sm:h-5 text-white" /> : <Maximize className="w-4 h-4 sm:w-5 sm:h-5 text-white" />}</Button>
                <Button variant="ghost" size="icon" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-red-500 border border-red-400/20 shadow-lg shadow-red-500/20 hover:bg-red-600" onClick={handleClose}><X className="w-4 h-4 sm:w-5 sm:h-5 text-white" /></Button>
              </div>
            </div>
          </div>
        </div>

        {showPlaylist && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-full max-w-sm bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-500/20 rounded-xl">
                    <List className="w-5 h-5 text-cyan-400" />
                  </div>
                  <h3 className="font-bold tracking-widest text-sm uppercase">PLAYLIST</h3>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/10" onClick={() => setShowPlaylist(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="max-h-[40vh] overflow-y-auto p-4 space-y-2 custom-scrollbar">
                {queue.length > 0 ? queue.map((item, idx) => (
                  <div key={item.id} className="p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl transition-all group flex items-center gap-3">
                    <div className="w-8 h-8 bg-black/40 rounded-lg flex items-center justify-center text-[10px] font-bold text-white/40 group-hover:text-cyan-400 transition-colors">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{item.title}</div>
                      <div className="text-[10px] text-white/40">{item.addedByName || "System"}</div>
                    </div>
                  </div>
                )) : (
                  <div className="py-8 text-center text-white/20">
                    <List className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="text-xs">Queue is empty</p>
                  </div>
                )}
              </div>

              {isHost && (
                <div className="p-5 bg-white/5 border-t border-white/5 space-y-3">
                  <div className="relative">
                    <Input
                      value={newQueueUrl}
                      onChange={(e) => setNewQueueUrl(e.target.value)}
                      placeholder="Paste video URL..."
                      className="bg-black/40 border-white/5 rounded-xl h-11 text-sm focus:ring-cyan-500/30"
                    />
                  </div>
                  <Button
                    onClick={handleAddToQueue}
                    disabled={isAddingToQueue || !newQueueUrl.trim()}
                    className="w-full bg-cyan-500 hover:bg-cyan-600 text-black font-bold h-11 rounded-xl shadow-lg shadow-cyan-500/20 transition-all active:scale-[0.98]"
                  >
                    {isAddingToQueue ? "Adding..." : "Add to Queue"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
          {floatingEmojis.map((e) => (<div key={e.id} className="absolute text-4xl animate-bounce" style={{ left: `${e.x}%`, top: `${e.y}%` }}>{e.emoji}</div>))}
        </div>

        <TheaterChatOverlay isOpen={showChat} onClose={() => setShowChat(false)} messages={messages} roomId={roomId} currentUser={currentUser} currentUserId={currentUserId} />
        <EmojiPicker isOpen={showEmojiPicker} onClose={() => setShowEmojiPicker(false)} onEmojiSelect={handleReaction} />
      </div>
    </PrivacyShield>,
    document.body
  )
}
