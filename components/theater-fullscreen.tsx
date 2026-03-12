"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
// @ts-ignore
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, X, Mic, MicOff, Users, MessageSquare, Smile, Film, Minimize2, Monitor } from "lucide-react"
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
  const controlsTimeoutRef = useRef<any>(null)
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

  // Initialize VideoStreamManager and Queue
  useEffect(() => {
    console.log("TheaterFullscreen mounted, initializing...")
    videoStreamManagerRef.current = new VideoStreamManager()

    // Subscribe to queue changes
    const unsubscribeQueue = theaterQueue.subscribe(setQueue)
    const unsubscribeQuality = theaterQuality.subscribe(setQualitySettings)

    return () => {
      console.log("TheaterFullscreen cleanup")
      videoStreamManagerRef.current?.cleanup()
      unsubscribeQueue()
      unsubscribeQuality()
    }
  }, [])

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
  }, [session.id, isOpen, roomId, currentUserId])

  // Final cleanup on unmount
  useEffect(() => {
    return () => {
      WebRTCManager.getInstance().cleanup()
    }
  }, [])

  // PTT Setup
  useEffect(() => {
    const setupMic = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        localStreamRef.current = stream
        // Mic starts muted
        stream.getAudioTracks().forEach(track => track.enabled = false)
        setIsMicMuted(true)
      } catch (err) {
        console.error("Failed to get microphone for Theater:", err)
      }
    }

    if (isOpen) {
      setupMic()
    }

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          track.stop()
          console.log(`Theater: Stopped PTT mic track: ${track.kind}`)
        })
        localStreamRef.current = null
      }
    }
  }, [isOpen])

  // Listen for theater session updates
  useEffect(() => {
    if (!session) return

    const unsubscribe = theaterSignaling.listenForSession(roomId, session.id, (updatedSession) => {
      if (updatedSession.status === "ended") {
        setTimeout(() => onClose(), 1000)
        return
      }

      // Handle remote actions with timestamp checking to prevent double-processing/loops
      if (updatedSession.lastAction &&
        updatedSession.lastAction.hostId !== currentUserId &&
        updatedSession.lastAction.timestamp > lastActionTimestampRef.current) {

        console.log(`[TheaterSync] Processing remote action: ${updatedSession.lastAction.type} at ${updatedSession.lastAction.timestamp}`);
        lastActionTimestampRef.current = updatedSession.lastAction.timestamp;
        handleRemoteAction(updatedSession.lastAction)
      }

      // Sync Queue from Firebase
      if (updatedSession.queue && JSON.stringify(updatedSession.queue) !== JSON.stringify(queue)) {
        // Manual deep sync (simplified)
        theaterQueue.clearQueue()
        updatedSession.queue.forEach(v => theaterQueue.addToQueue(v))
      }

      // Handle Buffering State
      if (updatedSession.status === 'buffering' && !isHost) {
        setIsBuffering(true)
        setIsPlaying(false) // Pause locally
      } else if (updatedSession.status === 'playing' && isBuffering) {
        setIsBuffering(false)
        setIsPlaying(true)
      }

      // Fluid Catch-up (Micro-Sync) - Only if status is playing and no action was just processed
      if (!isHost && updatedSession.status === 'playing') {
        const drift = updatedSession.currentTime - currentTime

        // Only drift correct if we are not actively handling a hard seek/action
        if (Math.abs(drift) > 0.5) {
          if (Math.abs(drift) > 2) {
            // Large drift: Hard seek
            console.log("[TheaterSync] Large drift detected, seeking to", updatedSession.currentTime)
            if (videoRef.current) {
              videoRef.current.currentTime = updatedSession.currentTime
            }
            setPlaybackRate(1.0)
          } else if (drift > 0.5) {
            // Behind by 0.5s - 2s: Speed up slightly
            setPlaybackRate(1.05)
          } else if (drift < -0.5) {
            // Ahead by 0.5s - 2s: Slow down slightly
            setPlaybackRate(0.95)
          }
        } else {
          // In sync: Normal speed
          if (playbackRate !== 1.0) setPlaybackRate(1.0)
        }
      }
      // Handle Presence Sync / Auto-Join WebRTC
      if (isHost && updatedSession.videoType === "webrtc" && localMovieStream) {
        const webrtc = WebRTCManager.getInstance()
        const currentParticipants = updatedSession.participants || []

        currentParticipants.forEach(async (participantId: string) => {
          if (participantId !== currentUserId && !connectedPeersRef.current.has(participantId)) {
            console.log("Theater: New participant detected, initiating WebRTC:", participantId)

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
  }, [session, roomId, currentUserId, onClose, isHost, currentTime])

  // Effect to determine if we can use native video element
  useEffect(() => {
    if (!session.videoUrl || session.videoType === "webrtc") {
      console.log("Video type check: webrtc or no URL")
      return
    }

    console.log("Checking video type:", session.videoType)
    // For direct video types, we can use native video element
    if (session.videoType === "direct") {
      setCanReactPlayerPlay(true)
    } else {
      // For other types (youtube, vimeo, etc.), use iframe
      setCanReactPlayerPlay(false)
    }
  }, [session.videoUrl, session.videoType])

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

  const handleRemoteAction = (action: TheaterAction) => {
    switch (action.type) {
      case "reaction":
        if (action.payload?.emoji) {
          addFloatingEmoji(action.payload.emoji)
        }
        break
      case "play":
        if (videoRef.current) {
          setIsPlaying(true)
          if (action.currentTime !== undefined) {
            // Only seek if significantly different to avoid jitter
            if (Math.abs(videoRef.current.currentTime - action.currentTime) > 0.5) {
              videoRef.current.currentTime = action.currentTime
            }
          }
          videoRef.current.play().catch(e => console.error("Play error:", e))
        }
        break
      case "pause":
        if (videoRef.current) {
          videoRef.current.pause()
        }
        setIsPlaying(false)
        break
      case "seek":
        if (videoRef.current && action.currentTime !== undefined) {
          videoRef.current.currentTime = action.currentTime
          setCurrentTime(action.currentTime)
        }
        break
      case "buffering":
        setIsBuffering(true)
        setIsPlaying(false)
        break
      case "rate_change":
        if (action.payload?.rate) {
          setPlaybackRate(action.payload.rate)
        }
        break
    }
  }

  const handleReaction = (emoji: string) => {
    theaterSignaling.sendReaction(roomId, session.id, emoji, currentUserId, currentUser)
    addFloatingEmoji(emoji)
    setShowEmojiPicker(false)
  }

  const handlePlay = async () => {
    console.log("handlePlay called, isHost:", isHost, "isPlaying:", isPlaying)
    if (!isHost) {
      console.log("Not host, ignoring play click")
      return
    }

    const video = videoRef.current
    if (!video) {
      console.log("No video ref!")
      return
    }

    console.log("Attempting to toggle play/pause")
    // Toggle play/pause on the video element
    if (isPlaying) {
      video.pause()
    } else {
      video.play().catch(e => console.error("Play error:", e))
    }

    // Toggle play/pause
    const newIsPlaying = !isPlaying
    setIsPlaying(newIsPlaying)

    const time = video.currentTime

    await theaterSignaling.sendAction(
      roomId,
      session.id,
      newIsPlaying ? "play" : "pause",
      time,
      currentUserId,
      currentUser
    )
  }

  const handleSeek = async (newTime: number) => {
    if (!isHost) return

    const video = videoRef.current
    if (video) {
      video.currentTime = newTime
    }
    setCurrentTime(newTime)
    await theaterSignaling.sendAction(roomId, session.id, "seek", newTime, currentUserId, currentUser)
  }

  const handleSkip = async (seconds: number) => {
    if (!isHost) return
    const newTime = Math.max(0, Math.min(duration, currentTime + seconds))
    handleSeek(newTime)
  }

  const handleProgress = (state: { played: number; playedSeconds: number; loaded: number; loadedSeconds: number }) => {
    if (!isDragging) {
      setCurrentTime(state.playedSeconds)
    }

    // Host Sync Heartbeat
    if (isHost && isPlaying && state.playedSeconds % 5 < 0.5) {
      // Periodically update current time in DB for drift correction (every ~5s)
      theaterSignaling.updateCurrentTime(roomId, session.id, state.playedSeconds)
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

  const handlePushToTalk = (active: boolean) => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = active
      })
      setIsPushToTalkActive(active)
      setIsMicMuted(!active)

      // Replace audio track in all active WebRTC connections
      const audioTrack = localStreamRef.current.getAudioTracks()[0]
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

  if (!isOpen) return null

  return (
    <PrivacyShield>
      <div
        className="fixed inset-0 bg-black z-[500] flex flex-col overflow-hidden select-none"
        onMouseMove={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
        onTouchStart={() => setShowControls(true)}
      >
        {/* Video Container */}
        <div className="flex-1 relative bg-black flex items-center justify-center">
          {session.videoType === "webrtc" ? (
            <div className="w-full h-full relative flex items-center justify-center bg-black">
              <video
                ref={(el) => {
                  if (el) {
                    const streamToUse = isHost ? localMovieStream : remoteMovieStream;
                    if (streamToUse) {
                      if (el.srcObject !== streamToUse) {
                        el.srcObject = streamToUse;
                        el.play().catch(e => {
                          if (e.name !== 'AbortError') {
                            console.error("Video play failed:", e);
                          }
                        });
                      }
                    }
                  }
                }}
                className="w-full h-full object-contain"
                autoPlay
                playsInline
                muted={isMuted}
                onLoadedMetadata={(e) => setDuration((e.target as HTMLVideoElement).duration || 0)}
              />

              {isHost && !localMovieStream && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 backdrop-blur-md z-20">
                  <div className="text-center p-12 rounded-[40px] bg-slate-800/80 border border-slate-700 shadow-2xl max-w-md animate-in fade-in zoom-in duration-500">
                    <div className="w-24 h-24 rounded-full bg-cyan-500/20 flex items-center justify-center mx-auto mb-6 border border-cyan-500/30">
                      <Film className="w-10 h-10 text-cyan-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">Local Streaming Mode</h3>
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
          ) : (
            <div className="w-full h-full relative">

              {/* Click blockers for sync enforcement (like Player.html) */}
              <div className="absolute inset-0 z-10 cursor-default" onClick={(e) => {
                // If not host, clicking should do nothing. If host, clicking toggles playback.
                if (isHost) handlePlay();
                // We don't preventDefault here because we want the controls to be able to show on hover if handled by us
              }}>
                <div className="absolute top-0 left-0 w-full h-[37%] bg-transparent" />
                <div className="absolute top-[37%] left-0 w-full h-[30%] bg-transparent" />
                <div className="absolute bottom-0 left-0 w-full h-[33%] bg-transparent" />
              </div>

              {canReactPlayerPlay ? (
                <video
                  ref={videoRef}
                  src={session.videoUrl}
                  className="w-full h-full object-contain"
                  autoPlay={isPlaying}
                  muted={isMuted}
                  onLoadedMetadata={(e) => {
                    const video = e.target as HTMLVideoElement;
                    console.log("Video loaded metadata, duration:", video.duration, "isHost:", isHost);
                    setDuration(video.duration || 0);
                    setPlayerReady(true);
                    console.log("Player ready set to true");
                  }}
                  onPlay={() => {
                    setIsPlaying(true);
                    console.log("Video play event");
                  }}
                  onPause={() => {
                    setIsPlaying(false);
                    console.log("Video pause event");
                  }}
                  onEnded={() => {
                    setIsPlaying(false);
                    console.log("Video ended event");
                  }}
                  onTimeUpdate={(e) => {
                    setCurrentTime((e.target as HTMLVideoElement).currentTime);
                  }}
                  onWaiting={() => {
                    setIsBuffering(true);
                    console.log("Video buffering...", "isHost:", isHost);
                  }}
                  onCanPlay={() => {
                    setIsBuffering(false);
                    console.log("Video can play", "isHost:", isHost);
                  }}
                  onError={(e) => console.error("Video error:", e)}
                />
              ) : (
                <iframe
                  ref={iframeRef}
                  src={session.videoUrl}
                  className="w-full h-full border-none"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  onLoad={() => setPlayerReady(true)}
                />
              )}
            </div>
          )}

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
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/5"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Film className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </Button>
                  <Button
                    variant={"ghost" as any}
                    size={"icon" as any}
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/5"
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
                        <div className="text-[10px] font-bold text-gray-400">QUALITY</div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {['360p', '720p', '1080p'].map(q => (
                            <Button
                              key={q}
                              variant="ghost"
                              size="sm"
                              className={`text-[10px] h-7 rounded-lg border border-white/5 ${qualitySettings.preferredQuality === q ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'text-white/40'}`}
                              onClick={() => theaterQuality.setQuality(q as any)}
                            >
                              {q}
                            </Button>
                          ))}
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
          className={`fixed sm:absolute top-0 right-0 bottom-0 w-full sm:w-80 bg-slate-950/95 sm:bg-slate-900/40 backdrop-blur-3xl border-l border-white/10 z-[60] transition-transform duration-500 ease-out shadow-[-20px_0_50px_rgba(0,0,0,0.5)] ${showPlaylist ? "translate-x-0" : "translate-x-full"}`}
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
          <div className="absolute top-4 right-4 bg-green-500/90 backdrop-blur text-white px-3 py-1 rounded-full text-sm font-medium animate-pulse shadow-lg z-20">
            🎤 Speaking
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
    </PrivacyShield >
  )
}
