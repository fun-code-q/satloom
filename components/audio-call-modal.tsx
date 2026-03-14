"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX, Minimize2, Maximize2, Square, Disc, Video, Sparkles, Settings, User, X } from "lucide-react"

// Debug icons to prevent crashes if icons are missing from lucide-react version
const Icon = ({ icon: LucideIcon, ...props }: any) => {
  if (!LucideIcon) return <X {...props} />
  return <LucideIcon {...props} />
}

import { CallSignaling, type CallData } from "@/utils/infra/call-signaling"
import { useCallRecording } from "@/hooks/use-call-recording"
import { voiceFilterProcessor, type VoiceFilterType } from "@/utils/hardware/voice-filters"
import { VoiceFilterModal } from "./voice-filter-modal"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { WebRTCManager } from "@/utils/infra/webrtc-manager"
import { toast } from "sonner"
import { audioNotificationManager } from "@/utils/hardware/audio-notification-manager"
import { AudioVisualizer } from "@/components/audio-visualizer"

interface AudioCallModalProps {
  isOpen: boolean
  onClose: () => void
  roomId: string
  currentUser: string
  currentUserId: string
  callData: CallData | null
  isIncoming?: boolean
  onAnswer?: () => void
  onSwitchToVideo?: () => void
}

export function AudioCallModal({
  isOpen,
  onClose,
  roomId,
  currentUser,
  currentUserId,
  callData,
  isIncoming = false,
  onAnswer,
  onSwitchToVideo
}: AudioCallModalProps) {
  const [isMuted, setIsMuted] = useState(false)
  const [isSpeakerOn, setIsSpeakerOn] = useState(true)
  const [isMinimized, setIsMinimized] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [position, setPosition] = useState({ x: 20, y: 20 })
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [showVoiceFilters, setShowVoiceFilters] = useState(false)
  const [voiceFilter, setVoiceFilter] = useState<VoiceFilterType>("none")
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>("")
  const [showSettings, setShowSettings] = useState(false)

  const modalRef = useRef<HTMLDivElement>(null)
  const callTimerRef = useRef<NodeJS.Timeout | null>(null)
  const callSignaling = CallSignaling.getInstance()

  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)

  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteStreamRef = useRef<MediaStream | null>(null)
  const unsubscribeSignalsRef = useRef<() => void>(() => { })
  const isInitializedRef = useRef(false)
  const offerSentRef = useRef(false)
  const pendingOfferRef = useRef<any>(null)
  const remoteAudioRef = useRef<HTMLAudioElement>(null)
  const wasOpenRef = useRef(false)
  const [switchRequest, setSwitchRequest] = useState<{ fromUserId: string } | null>(null)
  const [isAwaitingSwitchResponse, setIsAwaitingSwitchResponse] = useState(false)

  const { isRecording, startRecording, stopRecording } = useCallRecording({
    stream: remoteStream,
    fileType: "audio/webm"
  })

  const cleanupMedia = (reason?: string) => {
    if (reason) console.log(`AudioCall: Cleanup (${reason})`)

    try {
      unsubscribeSignalsRef.current()
    } catch { }

    const streamsToStop = [localStreamRef.current, remoteStreamRef.current].filter(Boolean) as MediaStream[]
    streamsToStop.forEach(stream => {
      stream.getTracks().forEach(track => {
        track.stop()
        console.log(`AudioCall: Stopped track: ${track.kind}`)
      })
    })

    localStreamRef.current = null
    remoteStreamRef.current = null
    setLocalStream(null)
    setRemoteStream(null)

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null
    }

    WebRTCManager.getInstance().cleanup()
    isInitializedRef.current = false
    offerSentRef.current = false
    pendingOfferRef.current = null
    setCallDuration(0)
  }

  useEffect(() => {
    let mounted = true
    if (isOpen) {
      const shouldInitMedia = !isIncoming || callData?.status === "answered"
      const initMedia = async () => {
        if (!shouldInitMedia || localStreamRef.current) return
        try {
          if (!navigator?.mediaDevices?.getUserMedia) {
            toast.error("Microphone access is not supported in this browser.")
            return
          }
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
          if (!mounted) {
            stream.getTracks().forEach(track => track.stop())
            return
          }
          setLocalStreamRef(stream)

          const devices = await navigator.mediaDevices.enumerateDevices()
          if (mounted) {
            setAudioDevices(devices.filter(d => d.kind === "audioinput"))
          }
        } catch (e: any) {
          console.error("Failed to get audio stream:", e)
          const reason =
            e?.name === "NotAllowedError" ? "Microphone permission denied." :
              e?.name === "NotFoundError" ? "No microphone device found." :
                "Could not access microphone."
          toast.error(reason)
        }
      }
      initMedia()

      // Handle outgoing ringtone
      if (!isIncoming && callData?.status === "ringing") {
        audioNotificationManager.startOutgoingRing()
      }
    } else {
      audioNotificationManager.stopAll()
    }

    if (isOpen && callData?.status === "answered" && !callTimerRef.current) {
      callTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1)
      }, 1000)
    }

    return () => {
      mounted = false
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current)
        callTimerRef.current = null
      }
    }
  }, [isOpen, callData?.status, isIncoming])

  useEffect(() => {
    if (!isOpen) {
      if (wasOpenRef.current) {
        audioNotificationManager.stopAll()
        cleanupMedia("modal closed")
        wasOpenRef.current = false
      }
      return
    }

    if (!wasOpenRef.current) {
      wasOpenRef.current = true
    }
  }, [isOpen])

  useEffect(() => {
      if (callData?.status === "answered" || callData?.status === "ended") {
          audioNotificationManager.stopAll()
      }
  }, [callData?.status])

  const setLocalStreamRef = (stream: MediaStream | null) => {
    setLocalStream(stream)
    localStreamRef.current = stream
  }

  const setRemoteStreamRef = (stream: MediaStream | null) => {
    setRemoteStream(stream)
    remoteStreamRef.current = stream
    if (remoteAudioRef.current && stream) {
      remoteAudioRef.current.srcObject = stream
      remoteAudioRef.current.play().catch(e => {
        if (e.name !== "AbortError") console.error("Audio play failed:", e)
      })
    }
  }

  // Effect 2: WebRTC Initialization
  useEffect(() => {
    if (!isOpen || isInitializedRef.current || !localStream || !callData) return

    const webrtc = WebRTCManager.getInstance()
    const targetUserId = callData.participants.find(p => p !== currentUserId) || 
                       (callData.targetUserId !== "all" ? callData.targetUserId : null) || 
                       (callData.callerId !== currentUserId ? callData.callerId : null)

    if (!targetUserId || targetUserId === currentUserId) return

    isInitializedRef.current = true

    webrtc.initialize(
      targetUserId,
      localStream,
      (s, uid, label) => {
        if (uid === targetUserId && (label === "default" || !label) && !s.getVideoTracks().length) setRemoteStreamRef(s)
      },
      (c, uid) => {
        if (callData?.id && uid === targetUserId) {
          const payload = {
            candidate: c.candidate,
            sdpMid: c.sdpMid,
            sdpMLineIndex: c.sdpMLineIndex
          }
          callSignaling.sendSignal(roomId, callData.id, "ice-candidate", payload, currentUserId)
        }
      },
      (state, uid) => {
        if (state === "connected") toast.success("Connected to audio")
      }
    )

    unsubscribeSignalsRef.current = callSignaling.listenForSignals(roomId, callData.id, currentUserId, async (type, payload, senderId) => {
      const targetUserId = senderId
      if (type === "offer") {
        if (callData.status === "answered") {
          const answer = await webrtc.createAnswer(targetUserId, payload)
          callSignaling.sendSignal(roomId, callData.id, "answer", answer, currentUserId)
        } else {
          pendingOfferRef.current = payload
        }
      } else if (type === "answer") {
        await webrtc.handleAnswer(targetUserId, payload)
      } else if (type === "ice-candidate") {
        await webrtc.addIceCandidate(targetUserId, payload)
      } else if (type === "bye") {
        onClose()
      } else if (type === "switch-request") {
        if (payload?.to === "video" && callData?.status === "answered") {
          setSwitchRequest({ fromUserId: senderId })
        }
      } else if (type === "switch-accept") {
        setIsAwaitingSwitchResponse(false)
      } else if (type === "switch-decline") {
        setIsAwaitingSwitchResponse(false)
        toast.error("Video upgrade declined")
      }
    })

    if (!isIncoming && callData.status === "answered" && !offerSentRef.current) {
      offerSentRef.current = true
      webrtc.createOffer(targetUserId).then(offer => {
        callSignaling.sendSignal(roomId, callData.id, "offer", offer, currentUserId)
      })
    }
  }, [isOpen, localStream, roomId, currentUserId, callData?.id, callData?.participants, isIncoming])

  // Effect 2.5: Handshake
  useEffect(() => {
    if (!isOpen || !isInitializedRef.current || !callData || offerSentRef.current) return
    if (!isIncoming && callData.status === "answered") {
      const targetUserId = callData.participants.find(p => p !== currentUserId) || callData.callerId
      if (!targetUserId || targetUserId === currentUserId) return
      offerSentRef.current = true
      WebRTCManager.getInstance().createOffer(targetUserId).then(offer => {
        callSignaling.sendSignal(roomId, callData.id, "offer", offer, currentUserId)
      })
    }
  }, [isOpen, callData?.status, isIncoming])

  // Effect to handle pending offer when call is answered
  useEffect(() => {
    if (isOpen && isIncoming && callData?.status === "answered" && pendingOfferRef.current) {
      const webrtc = WebRTCManager.getInstance()
      const targetUserId = callData.participants.find(p => p !== currentUserId) || callData.targetUserId || callData.callerId
      if (!targetUserId || targetUserId === currentUserId) return

      console.log("[AudioCallModal] Processing pending offer for user:", targetUserId)
      webrtc.createAnswer(targetUserId, pendingOfferRef.current).then(answer => {
        callSignaling.sendSignal(roomId, callData.id, "answer", answer, currentUserId)
        pendingOfferRef.current = null
      }).catch(err => console.error("Error answering pending offer:", err))
    }
  }, [isOpen, callData?.status, isIncoming, roomId, currentUserId, callData?.id, callData?.participants])

  useEffect(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted
      })
    }
  }, [isMuted, localStream])

  useEffect(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = !isSpeakerOn
      remoteAudioRef.current.volume = isSpeakerOn ? 1 : 0
    }
  }, [isSpeakerOn])

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleEndCall = async () => {
    audioNotificationManager.stopAll()
    if (callData) {
      try {
        await callSignaling.sendSignal(roomId, callData.id, "bye", {}, currentUserId)
        await callSignaling.endCall(roomId, callData.id)
      } catch (err) {}
    }
    cleanupMedia("end call")
    onClose()
  }

  const handleAnswerCall = async () => {
    audioNotificationManager.stopAll()
    if (onAnswer) {
      onAnswer()
    } else if (callData) {
      await callSignaling.answerCall(roomId, callData.id, currentUserId, currentUser)
    }
  }

  const handleRequestVideoSwitch = async () => {
    if (!callData || callData.status !== "answered") return
    setIsAwaitingSwitchResponse(true)
    await callSignaling.sendSignal(roomId, callData.id, "switch-request", { to: "video" }, currentUserId)
  }

  const handleAcceptVideoSwitch = async () => {
    if (!callData || !switchRequest) return
    await callSignaling.switchCallType(roomId, callData.id, "video")
    await callSignaling.sendSignal(roomId, callData.id, "switch-accept", { to: "video" }, currentUserId)
    setSwitchRequest(null)
  }

  const handleDeclineVideoSwitch = async () => {
    if (!callData || !switchRequest) return
    await callSignaling.sendSignal(roomId, callData.id, "switch-decline", { to: "video" }, currentUserId)
    setSwitchRequest(null)
  }

  const handleAudioDeviceChange = async (deviceId: string) => {
    setSelectedAudioDevice(deviceId)
    await WebRTCManager.getInstance().switchMicrophone(deviceId)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isMinimized) return
    setIsDragging(true)
    const rect = modalRef.current?.getBoundingClientRect()
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      })
    }
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMinimized) return
    const touch = e.touches[0]
    setIsDragging(true)
    const rect = modalRef.current?.getBoundingClientRect()
    if (rect) {
      setDragOffset({
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      })
    }
  }

  useEffect(() => {
    const handleMove = (e: any) => {
      if (!isDragging || !isMinimized) return
      const clientX = e.clientX || e.touches?.[0]?.clientX
      const clientY = e.clientY || e.touches?.[0]?.clientY
      const newX = clientX - dragOffset.x
      const newY = clientY - dragOffset.y
      setPosition({
        x: Math.max(0, Math.min(newX, window.innerWidth - 200)),
        y: Math.max(0, Math.min(newY, window.innerHeight - 100)),
      })
    }
    const handleUp = () => setIsDragging(false)

    if (isDragging) {
      window.addEventListener("mousemove", handleMove)
      window.addEventListener("mouseup", handleUp)
      window.addEventListener("touchmove", handleMove, { passive: false })
      window.addEventListener("touchend", handleUp)
    }
    return () => {
      window.removeEventListener("mousemove", handleMove)
      window.removeEventListener("mouseup", handleUp)
      window.removeEventListener("touchmove", handleMove)
      window.removeEventListener("touchend", handleUp)
    }
  }, [isDragging, isMinimized, dragOffset])

  if (!isOpen) return null

  const getOtherParticipantName = () => {
    if (!callData) return "Unknown"
    const otherId = callData.participants.find((p) => p !== currentUserId) || (callData.callerId !== currentUserId ? callData.callerId : null)
    return (otherId && callData.participantNames?.[otherId]) || callData.caller || "Waiting..."
  }

  const otherParticipant = getOtherParticipantName()

  if (isMinimized) {
    return (
      <div
        ref={modalRef}
        className="fixed z-[1000] bg-slate-800 border border-slate-700 rounded-2xl p-3 shadow-2xl cursor-move select-none animate-in fade-in zoom-in duration-200"
        style={{ left: position.x, top: position.y, width: "200px" }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-500/20 rounded-full flex items-center justify-center">
              <Phone className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-medium truncate">{otherParticipant}</p>
              <p className="text-gray-400 text-[10px]">{formatDuration(callDuration)}</p>
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="w-6 h-6 text-gray-400" onClick={() => setIsMinimized(false)}>
              <Maximize2 className="w-3 h-3" />
            </Button>
            <Button variant="ghost" size="icon" className="w-6 h-6 text-red-400" onClick={handleEndCall}>
              <PhoneOff className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/95 z-[1000] flex items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
      <div
        ref={modalRef}
        className="bg-slate-900 border-x sm:border border-slate-700/50 shadow-2xl w-full h-[100dvh] sm:h-auto sm:max-w-md sm:max-h-[90vh] rounded-none sm:rounded-2xl flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700/50 bg-slate-800/50 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <Mic className="w-4 h-4 text-indigo-400" />
            <h2 className="text-white font-semibold">Audio Call</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 rounded-full text-gray-400 hover:text-white"
              onClick={() => setIsMinimized(true)}
            >
              <Minimize2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Call Info Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-8">
            <div className="relative">
                <div className="w-28 h-28 sm:w-36 sm:h-36 bg-slate-800 rounded-full flex items-center justify-center border-2 border-indigo-500/30 relative z-10">
                    <User className="w-14 h-14 sm:w-18 sm:h-18 text-slate-500" />
                </div>
                {callData?.status === "answered" && (
                    <div className="absolute inset-0 z-0">
                        <AudioVisualizer stream={localStream} width={144} height={144} className="opacity-50" />
                    </div>
                )}
                {callData?.status === "ringing" && (
                    <div className="absolute inset-x-[-15px] inset-y-[-15px] border-2 border-indigo-500/50 rounded-full animate-ping opacity-20" />
                )}
            </div>

            <div className="text-center space-y-2">
                <h3 className="text-2xl font-bold text-white">{otherParticipant}</h3>
                <p className={`text-sm font-medium tracking-wide uppercase ${callData?.status === "answered" ? "text-indigo-400" : "text-gray-400 animate-pulse"}`}>
                    {callData?.status === "ringing" ? (isIncoming ? "Incoming..." : "Ringing...") : 
                     callData?.status === "answered" ? formatDuration(callDuration) : "Connecting..."}
                </p>
            </div>

            {switchRequest && (
                <div className="w-full max-w-xs p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 backdrop-blur-sm animate-in slide-in-from-bottom-4">
                    <p className="text-indigo-100 text-sm font-medium mb-3 text-center">Wants to switch to video</p>
                    <div className="flex gap-2">
                        <Button onClick={handleAcceptVideoSwitch} className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white h-10 rounded-xl">Accept</Button>
                        <Button onClick={handleDeclineVideoSwitch} variant="ghost" className="flex-1 text-gray-400 hover:text-white h-10 rounded-xl">Decline</Button>
                    </div>
                </div>
            )}
        </div>

        {/* Controls */}
        <div className="p-8 bg-gradient-to-t from-slate-900 via-slate-900 to-transparent">
            {isIncoming && callData?.status === "ringing" ? (
                <div className="flex justify-center gap-8">
                    <Button onClick={handleEndCall} className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20 transition-transform active:scale-90">
                        <PhoneOff className="w-7 h-7" />
                    </Button>
                    <Button onClick={handleAnswerCall} className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/20 transition-transform active:scale-95 animate-bounce">
                        <Phone className="w-7 h-7" />
                    </Button>
                </div>
            ) : (
                <div className="flex flex-col items-center gap-8">
                    <div className="flex items-center justify-center gap-4 sm:gap-6">
                        <Button
                            variant="ghost"
                            size="icon"
                            className={`rounded-full w-12 h-12 sm:w-14 sm:h-14 transition-all ${isMuted ? "bg-red-500/20 text-red-500 border border-red-500/30" : "bg-slate-800 text-white border border-white/5"}`}
                            onClick={() => setIsMuted(!isMuted)}
                        >
                            {isMuted ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
                        </Button>

                        <Button
                            variant="ghost"
                            size="icon"
                            className={`rounded-full w-12 h-12 sm:w-14 sm:h-14 transition-all ${!isSpeakerOn ? "bg-slate-800 text-gray-500 border border-white/5" : "bg-indigo-500/20 text-indigo-500 border border-indigo-500/30"}`}
                            onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                        >
                            {isSpeakerOn ? <Volume2 className="w-5 h-5 sm:w-6 sm:h-6" /> : <VolumeX className="w-5 h-5 sm:w-6 sm:h-6" />}
                        </Button>

                        <Button
                            onClick={handleEndCall}
                            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20 transition-transform active:scale-90"
                        >
                            <PhoneOff className="w-6 h-6 sm:w-7 sm:h-7" />
                        </Button>

                        <div className="flex gap-4">
                            <Popover open={showSettings} onOpenChange={setShowSettings}>
                                <PopoverTrigger asChild>
                                    <Button variant="ghost" size="icon" className="rounded-full w-12 h-12 bg-slate-800 text-white border border-white/5">
                                        <Settings className="w-5 h-5" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 bg-slate-900 border-slate-700 text-white p-4">
                                    <div className="space-y-4">
                                        <h4 className="font-medium text-xs text-gray-400 uppercase tracking-widest">Settings</h4>
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium text-gray-500">Microphone</label>
                                            <Select value={selectedAudioDevice} onValueChange={handleAudioDeviceChange}>
                                                <SelectTrigger className="bg-slate-800 border-slate-700 h-9">
                                                    <SelectValue placeholder="Select Device" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                                                    {audioDevices.map((device) => (
                                                        <SelectItem key={device.deviceId} value={device.deviceId}>{device.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    {onSwitchToVideo && callData?.status === "answered" && (
                        <Button
                             variant="ghost"
                             className="text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 gap-2 h-9 rounded-full px-6 border border-indigo-500/20"
                             onClick={handleRequestVideoSwitch}
                             disabled={isAwaitingSwitchResponse}
                        >
                            <Video className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-wider">
                                {isAwaitingSwitchResponse ? "Waiting..." : "Switch to Video"}
                            </span>
                        </Button>
                    )}
                </div>
            )}
        </div>

        <audio ref={remoteAudioRef} className="hidden" aria-hidden="true" />
      </div>

      <VoiceFilterModal
        isOpen={showVoiceFilters}
        onClose={() => setShowVoiceFilters(false)}
        currentFilter={voiceFilter}
        onFilterSelect={async (filter) => {
          setVoiceFilter(filter)
          if (localStream) {
            const processedStream = await voiceFilterProcessor.setFilter(filter)
            if (processedStream) {
              const audioTrack = processedStream.getAudioTracks()[0]
              if (audioTrack) {
                await WebRTCManager.getInstance().replaceAudioTrack(audioTrack)
              }
            }
          }
        }}
      />
    </div>
  )
}
