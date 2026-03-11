"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
// @ts-ignore
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, X, Mic, MicOff, Users, MessageSquare, Smile, Film, Minimize2 } from "lucide-react"
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
import dynamic from 'next/dynamic'

const ReactPlayer = dynamic(() => import('react-player'), { ssr: false }) as any

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

  const playerRef = useRef<any>(null)
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

  // Initialize VideoStreamManager and Queue
  useEffect(() => {
    videoStreamManagerRef.current = new VideoStreamManager()

    // Subscribe to queue changes
    const unsubscribeQueue = theaterQueue.subscribe(setQueue)
    const unsubscribeQuality = theaterQuality.subscribe(setQualitySettings)

    return () => {
      videoStreamManagerRef.current?.cleanup()
      unsubscribeQueue()
      unsubscribeQuality()
    }
  }, [])

  // No manual setupPeerConnection - handled by WebRTCManager

  // Handle pending file from setup
  useEffect(() => {
    if (isOpen && isHost && pendingFile && onFileProcessed) {
      handleFileSelect(undefined, pendingFile)
      onFileProcessed()
    }
  }, [isOpen, isHost, pendingFile, onFileProcessed])

  // Handle Incoming Signals
  useEffect(() => {
    if (!session) return
    const webrtc = WebRTCManager.getInstance()

    const unsubscribeSignals = theaterSignaling.listenForSignals(roomId, session.id, currentUserId, async (type, payload, fromUserId) => {
      console.log(`Theater: Signal received (${type}) from ${fromUserId}`)

      if (type === "offer") {
        const streamToUse = localMovieStream || localStreamRef.current || new MediaStream()
        webrtc.initialize(
          fromUserId,
          streamToUse,
          (s, uid) => { if (uid === fromUserId) setRemoteMovieStream(s) },
          (c, uid) => { if (uid === fromUserId) theaterSignaling.sendSignal(roomId, session.id, "ice-candidate", c, currentUserId, fromUserId) }
        )
        const answer = await webrtc.createAnswer(fromUserId, payload)
        theaterSignaling.sendSignal(roomId, session.id, "answer", answer, currentUserId, fromUserId)
      } else if (type === "answer") {
        await webrtc.handleAnswer(fromUserId, payload)
      } else if (type === "ice-candidate") {
        await webrtc.addIceCandidate(fromUserId, payload)
      }
    })

    return () => {
      unsubscribeSignals()
      webrtc.cleanup()
    }
  }, [session, isOpen, roomId, currentUserId, localMovieStream])

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
      localStreamRef.current?.getTracks().forEach(track => track.stop())
      localStreamRef.current = null
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

      // Handle remote actions
      if (updatedSession.lastAction && updatedSession.lastAction.hostId !== currentUserId) {
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

      // Fluid Catch-up (Micro-Sync)
      if (!isHost && updatedSession.status === 'playing') {
        const drift = updatedSession.currentTime - currentTime

        if (Math.abs(drift) > 2) {
          // Large drift: Hard seek
          console.log("Large drift detected, seeking to", updatedSession.currentTime)
          playerRef.current?.seekTo(updatedSession.currentTime, 'seconds')
          setPlaybackRate(1.0)
        } else if (drift > 0.5) {
          // Behind by 0.5s - 2s: Speed up slightly
          setPlaybackRate(1.05)
        } else if (drift < -0.5) {
          // Ahead by 0.5s - 2s: Slow down slightly
          setPlaybackRate(0.95)
        } else {
          // In sync: Normal speed
          setPlaybackRate(1.0)
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
        if (playerRef.current) {
          setIsPlaying(true)
          if (action.currentTime !== undefined) {
            // Only seek if significantly different to avoid jitter
            if (Math.abs(playerRef.current.getCurrentTime() - action.currentTime) > 0.5) {
              playerRef.current.seekTo(action.currentTime, 'seconds')
            }
          }
        }
        break
      case "pause":
        setIsPlaying(false)
        break
      case "seek":
        if (playerRef.current && action.currentTime !== undefined) {
          playerRef.current.seekTo(action.currentTime, 'seconds')
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
    if (!isHost) return

    // Toggle play/pause
    const newIsPlaying = !isPlaying
    setIsPlaying(newIsPlaying)

    const time = playerRef.current ? playerRef.current.getCurrentTime() : 0

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

    playerRef.current?.seekTo(newTime, 'seconds')
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
      const time = playerRef.current ? playerRef.current.getCurrentTime() : 0
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

  // Effect to sync VideoStreamManager with session status
  useEffect(() => {
    if (isMovieStreaming && videoStreamManagerRef.current) {
      videoStreamManagerRef.current.syncPlayback(isPlaying ? 'play' : 'pause', currentTime)
    }
  }, [isPlaying, currentTime, isMovieStreaming])
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
        className="fixed inset-0 bg-black z-50 flex flex-col"
        onMouseMove={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
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
            <ReactPlayer
              ref={playerRef}
              url={session.videoUrl}
              width="100%"
              height="100%"
              playing={isPlaying}
              volume={isMuted ? 0 : volume}
              playbackRate={playbackRate}
              onReady={() => setPlayerReady(true)}
              onProgress={handleProgress as any}
              onDuration={setDuration}
              onEnded={() => setIsPlaying(false)}
              onBuffer={() => setIsBuffering(true)}
              onBufferEnd={() => setIsBuffering(false)}
            />
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
                <p className="text-slate-400 text-sm mb-8">This won't take long</p>
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

        {/* Controls */}
        <div
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0"
            }`}
        >
          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex items-center gap-2 text-white text-sm mb-2">
              <span>{formatTime(currentTime)}</span>
              <span>/</span>
              <span>{formatTime(duration)}</span>
            </div>
            <div className="relative group">
              <div className="w-full h-1 bg-gray-600 rounded group-hover:h-2 transition-all">
                <div
                  className="h-full bg-cyan-400 rounded relative"
                  style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 shadow" />
                </div>
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
                  onChange={(e) => setCurrentTime(Number(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              )}
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isHost && (
                <>
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
                    className="w-10 h-10 rounded-full bg-slate-700 hover:bg-slate-600"
                    onClick={() => fileInputRef.current?.click()}
                    title="Stream local movie"
                  >
                    <Film className="w-5 h-5 text-white" />
                  </Button>
                </>
              )}
            </div>

            <div className="flex items-center gap-4">
              {/* Chat Toggle */}
              <Button
                variant={"ghost" as any}
                size={"icon" as any}
                className={`w-10 h-10 rounded-full ${showChat ? "bg-cyan-500 hover:bg-cyan-600" : "bg-slate-700 hover:bg-slate-600"}`}
                onClick={() => setShowChat(!showChat)}
              >
                <MessageSquare className="w-5 h-5 text-white" />
              </Button>

              {/* Emoji Reaction Button */}
              <Button
                variant={"ghost" as any}
                size={"icon" as any}
                className={`w-10 h-10 rounded-full ${showEmojiPicker ? "bg-cyan-500 hover:bg-cyan-600" : "bg-slate-700 hover:bg-slate-600"}`}
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                <Smile className="w-5 h-5 text-white" />
              </Button>

              {/* Playlist Toggle */}
              <Button
                variant={"ghost" as any}
                size={"icon" as any}
                className={`w-10 h-10 rounded-full ${showPlaylist ? "bg-cyan-500 hover:bg-cyan-600" : "bg-slate-700 hover:bg-slate-600"}`}
                onClick={() => setShowPlaylist(!showPlaylist)}
              >
                <List className="w-5 h-5 text-white" />
              </Button>

              {/* Push to Talk */}
              <Button
                variant={"ghost" as any}
                size={"icon" as any}
                className={`w-10 h-10 rounded-full relative transition-all ${isPushToTalkActive ? "bg-green-500 scale-110 shadow-[0_0_15px_rgba(34,197,94,0.6)]" : "bg-slate-700 hover:bg-slate-600"
                  }`}
                onMouseDown={() => handlePushToTalk(true)}
                onMouseUp={() => handlePushToTalk(false)}
                onMouseLeave={() => handlePushToTalk(false)}
                onTouchStart={(e) => {
                  e.preventDefault()
                  handlePushToTalk(true)
                }}
                onTouchEnd={() => handlePushToTalk(false)}
                title="Hold to Talk (Space/V)"
              >
                {isMicMuted ? (
                  <MicOff className="w-5 h-5 text-white" />
                ) : (
                  <div className="flex items-center justify-center">
                    <AudioVisualizer stream={localStreamRef.current} width={30} height={20} barColor="#ffffff" />
                    <Mic className="w-5 h-5 text-white absolute" />
                  </div>
                )}

                {isPushToTalkActive && (
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-green-500 text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap animate-bounce">
                    Speaking...
                  </div>
                )}
              </Button>

              {/* Playback Controls (Host Only) */}
              {isHost ? (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-10 h-10 rounded-full bg-slate-700 hover:bg-slate-600"
                    onClick={() => handleSkip(-10)}
                  >
                    <SkipBack className="w-5 h-5 text-white" />
                  </Button>

                  <Button
                    variant={"ghost" as any}
                    size={"icon" as any}
                    className="w-12 h-12 rounded-full bg-cyan-500 hover:bg-cyan-600"
                    onClick={handlePlay}
                  >
                    {isPlaying ? <Pause className="w-6 h-6 text-white" /> : <Play className="w-6 h-6 text-white" />}
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-10 h-10 rounded-full bg-slate-700 hover:bg-slate-600"
                    onClick={() => handleSkip(10)}
                  >
                    <SkipForward className="w-5 h-5 text-white" />
                  </Button>
                </>
              ) : (
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <Users className="w-4 h-4" />
                  <span>Host controls playback</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              {/* Volume Control */}
              <div className="flex items-center gap-2 group">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 rounded-full bg-slate-700 hover:bg-slate-600"
                  onClick={toggleMute}
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
                </Button>
                <div className="w-0 overflow-hidden group-hover:w-20 transition-all duration-300">
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
                    className="w-20 h-1 bg-gray-600 rounded appearance-none cursor-pointer"
                  />
                </div>
              </div>

              {/* Participants Count */}
              <div className="flex items-center gap-1 text-white text-sm bg-slate-800/50 px-2 py-1 rounded-full border border-slate-700">
                <Users className="w-3 h-3" />
                <span>{session.participants.length}</span>
              </div>

              {/* Settings Popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"ghost" as any}
                    size={"icon" as any}
                    className="w-10 h-10 rounded-full bg-slate-700 hover:bg-slate-600 border border-slate-600"
                  >
                    <Settings className="w-5 h-5 text-white" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 bg-slate-900/95 border-slate-700 backdrop-blur-xl text-white p-4 rounded-3xl shadow-2xl">
                  <div className="space-y-6">
                    <h4 className="font-bold text-cyan-400 flex items-center gap-2">
                      <Settings className="w-4 h-4" /> Theater Settings
                    </h4>

                    {/* Playback Speed */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs font-bold text-gray-400 hover:text-white transition-colors">
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
                        className="cursor-pointer"
                      />
                    </div>

                    {/* Quality Selection */}
                    <div className="space-y-3">
                      <div className="text-xs font-bold text-gray-400">QUALITY</div>
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

                    <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-white/30 font-medium">
                      <span>March 2026 Enhanced Sync</span>
                      <Badge variant="outline" className="text-[8px] h-4 border-cyan-500/20 text-cyan-500/50">v4.2</Badge>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Minimize Button */}
              <Button
                variant={"ghost" as any}
                size={"icon" as any}
                className="w-10 h-10 rounded-full bg-slate-700 hover:bg-slate-600 transition-all hover:scale-110 border border-slate-600"
                onClick={onMinimize}
              >
                <Minimize2 className="w-5 h-5 text-white" />
              </Button>

              {/* Exit Button */}
              <Button
                variant={"ghost" as any}
                size={"icon" as any}
                className="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 transition-all hover:scale-110 shadow-lg shadow-red-500/20"
                onClick={handleClose}
              >
                <X className="w-5 h-5 text-white" />
              </Button>
            </div>
          </div>
        </div>

        {/* Playlist Sidebar */}
        <div
          className={`absolute top-0 right-0 bottom-0 w-80 bg-slate-900/40 backdrop-blur-3xl border-l border-white/10 z-40 transition-transform duration-500 ease-out shadow-[-20px_0_50px_rgba(0,0,0,0.5)] ${showPlaylist ? "translate-x-0" : "translate-x-full"}`}
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
    </PrivacyShield>
  )
}
