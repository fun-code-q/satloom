"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX, Minimize2, Maximize2, Square, Disc, Video } from "lucide-react"
import { CallSignaling, type CallData } from "@/utils/infra/call-signaling"
import { useCallRecording } from "@/hooks/use-call-recording"
import { voiceFilterProcessor, type VoiceFilterType } from "@/utils/hardware/voice-filters"
import { VoiceFilterModal } from "./voice-filter-modal"
import { Sparkles, Settings } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { WebRTCManager } from "@/utils/infra/webrtc-manager"
import { toast } from "sonner"

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
  const pendingOfferRef = useRef<any>(null)
  const remoteAudioRef = useRef<HTMLAudioElement>(null)

  const { isRecording, startRecording, stopRecording } = useCallRecording({
    stream: remoteStream,
    fileType: "audio/webm"
  })

  useEffect(() => {
    let mounted = true
    if (isOpen) {
      const initMedia = async () => {
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
    }

    if (isOpen && callData?.status === "answered") {
      callTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1)
      }, 1000)
    }

    return () => {
      mounted = false
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current)
      }

      // Stop all tracks using refs
      [localStreamRef.current, remoteStreamRef.current].forEach(stream => {
        if (stream) {
          stream.getTracks().forEach(track => {
            track.stop()
            console.log(`AudioCall: Stopped track: ${track.kind}`)
          })
        }
      })
      localStreamRef.current = null
      remoteStreamRef.current = null
      setLocalStream(null)
      setRemoteStream(null)
    }
  }, [isOpen, callData?.status])

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

  // Effect 2: WebRTC Initialization (Runs once)
  useEffect(() => {
    if (!isOpen) {
      if (isInitializedRef.current) {
        console.log("AudioCall: Cleaning up WebRTC")
        unsubscribeSignalsRef.current()
        // Only cleanup ALL connections if call is actually ended or modal unmounted
      }
      return
    }
  }, [isOpen])

  // Final cleanup on unmount
  useEffect(() => {
    return () => {
      WebRTCManager.getInstance().cleanup()
    }
  }, [])

  useEffect(() => {
    if (!isOpen || isInitializedRef.current || !localStream || !callData) return

    const webrtc = WebRTCManager.getInstance()

    // Correctly resolve the actual user ID we are talking to
    const targetUserId = callData.participants.find(p => p !== currentUserId) || 
                       (callData.targetUserId !== "all" ? callData.targetUserId : null) || 
                       (callData.callerId !== currentUserId ? callData.callerId : null)

    if (!targetUserId || targetUserId === currentUserId) {
      console.log("AudioCall: Waiting for a specific target user to join...", { 
        participants: callData.participants, 
        targetUserId: callData.targetUserId,
        callerId: callData.callerId 
      })
      return
    }

    isInitializedRef.current = true

    console.log("AudioCall: Initializing WebRTC for target", targetUserId)
    webrtc.initialize(
      targetUserId,
      localStream,
      (s, uid) => {
        if (uid === targetUserId) setRemoteStreamRef(s)
      },
      (c, uid) => {
        if (callData?.id && uid === targetUserId) {
          // Send structured payload matching video-call.html and standard expectations
          const payload = {
            candidate: c.candidate,
            sdpMid: c.sdpMid,
            sdpMLineIndex: c.sdpMLineIndex
          }
          callSignaling.sendSignal(roomId, callData.id, "ice-candidate", payload, currentUserId)
        }
      },
      (state, uid) => {
        console.log(`[AudioCall] WebRTC state for ${uid}: ${state}`)
        if (state === "connected") {
          console.log(`[AudioCall] SUCCESSFULLY CONNECTED to ${uid}`)
        }
        if (state === "failed") {
          console.error(`[AudioCall] Connection to ${uid} FAILED. Check network/ICE servers.`)
        }
        if (state === "disconnected") {
          console.warn(`[AudioCall] Connection to ${uid} disconnected.`)
        }
      }
    )

    console.log(`[AudioCall] Initialized WebRTC for ${targetUserId} with local stream ${localStream.id}`)
    localStream.getTracks().forEach(t => console.log(`[AudioCall] Local track active: ${t.kind} (${t.id})`))

    unsubscribeSignalsRef.current = callSignaling.listenForSignals(roomId, callData.id, currentUserId, async (type, payload, senderId) => {
      console.log(`AudioCall: Signal received (${type}) from ${senderId}`)
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
        console.log("AudioCall: Remote peer sent bye")
        onClose()
      }
    })
  }, [isOpen, localStream, roomId, currentUserId, callData?.id, callData?.participants])
  // Removed callData.status to prevent re-init

  // Effect 2.5: Handshake Action (Triggered on status change)
  useEffect(() => {
    if (!isOpen || !isInitializedRef.current || !callData) return

    const webrtc = WebRTCManager.getInstance()

    // If we are the caller and call just became answered, send the offer
    if (!isIncoming && callData.status === "answered") {
      const targetUserId = callData.participants.find(p => p !== currentUserId) || 
                         (callData.targetUserId !== "all" ? callData.targetUserId : null) || 
                         (callData.callerId !== currentUserId ? callData.callerId : null)

      if (!targetUserId || targetUserId === currentUserId) return

      console.log("AudioCall: Call answered, sending offer as caller")
      webrtc.createOffer(targetUserId).then(offer => {
        callSignaling.sendSignal(roomId, callData.id, "offer", offer, currentUserId)
      }).catch(err => console.error("AudioCall: Error creating offer:", err))
    }
  }, [isOpen, callData?.status, isIncoming, roomId, currentUserId, callData?.id, callData?.participants])

  // Effect 3: Handle pending offer
  useEffect(() => {
    if (isOpen && isIncoming && callData?.status === "answered" && pendingOfferRef.current) {
      const webrtc = WebRTCManager.getInstance()
      const targetUserId = callData.participants.find(p => p !== currentUserId) || callData.targetUserId || callData.callerId
      if (!targetUserId || targetUserId === currentUserId) return

      webrtc.createAnswer(targetUserId, pendingOfferRef.current).then(answer => {
        callSignaling.sendSignal(roomId, callData.id, "answer", answer, currentUserId)
        pendingOfferRef.current = null
      }).catch(err => console.error("Error answering pending offer:", err))
    }
  }, [isOpen, callData?.status, isIncoming, roomId, currentUserId, callData?.id])

  // Effect to handle actual track muting
  useEffect(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted
      })
    }
  }, [isMuted, localStream])

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleEndCall = async () => {
    if (callData) {
      try {
        // Send bye signal before closing to notify remote peer immediately
        await callSignaling.sendSignal(roomId, callData.id, "bye", {}, currentUserId)
        await callSignaling.endCall(roomId, callData.id)
      } catch (err) {
        console.error("Error during end call signaling:", err)
      }
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop()
        console.log(`AudioCall: Stopped local track on end: ${track.kind}`)
      })
      setLocalStreamRef(null)
    }

    setCallDuration(0)
    onClose()
  }

  const handleAnswerCall = async () => {
    if (onAnswer) {
      onAnswer()
    } else if (callData) {
      await callSignaling.answerCall(roomId, callData.id, currentUserId, currentUser)
    }
  }

  const handleAudioDeviceChange = async (deviceId: string) => {
    setSelectedAudioDevice(deviceId)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
        video: false
      })
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop())
      }
      setLocalStream(stream)
      // Note: In v2, WebRTC switching is handled by WebRTCManager
      await WebRTCManager.getInstance().switchMicrophone(deviceId)
    } catch (e) {
      console.error("Failed to switch audio device:", e)
    }
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

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !isMinimized) return

    const newX = e.clientX - dragOffset.x
    const newY = e.clientY - dragOffset.y

    // Keep within viewport bounds
    const maxX = window.innerWidth - 200
    const maxY = window.innerHeight - 100

    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY)),
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
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

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging || !isMinimized) return
    e.preventDefault()

    const touch = e.touches[0]
    const newX = touch.clientX - dragOffset.x
    const newY = touch.clientY - dragOffset.y

    // Keep within viewport bounds
    const maxX = window.innerWidth - 200
    const maxY = window.innerHeight - 100

    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY)),
    })
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      document.addEventListener("touchmove", handleTouchMove, { passive: false })
      document.addEventListener("touchend", handleTouchEnd)
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.removeEventListener("touchmove", handleTouchMove)
      document.removeEventListener("touchend", handleTouchEnd)
    }
  }, [isDragging])

  if (!isOpen) return null

  const getOtherParticipantName = () => {
    if (!callData) return "Unknown"
    const otherId = callData.participants.find((p) => p !== currentUserId) || (callData.callerId !== currentUserId ? callData.callerId : null)

    if (otherId && callData.participantNames?.[otherId]) {
      return callData.participantNames[otherId]
    }

    if (callData.callerId !== currentUserId) {
      return callData.caller
    }

    return "Waiting..."
  }

  const otherParticipant = getOtherParticipantName()

  if (isMinimized) {
    return (
      <div
        ref={modalRef}
        className="fixed z-[1000] bg-slate-800 border border-slate-700 rounded-2xl p-3 shadow-2xl cursor-move select-none"
        style={{
          left: position.x,
          top: position.y,
          width: "200px",
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
              <Phone className="w-4 h-4 text-green-400" />
            </div>
            <div>
              <p className="text-white text-sm font-medium truncate">{otherParticipant}</p>
              <p className="text-gray-400 text-xs">{formatDuration(callDuration)}</p>
            </div>
          </div>

          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6 text-gray-400 hover:text-white"
              onClick={() => setIsMinimized(false)}
            >
              <Maximize2 className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6 text-red-400 hover:text-red-300"
              onClick={() => handleEndCall()}
            >
              <PhoneOff className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000] p-4">
      <div
        ref={modalRef}
        className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto mx-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-indigo-950/50 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Mic className="w-4 h-4 text-indigo-400" />
            <h2 className="text-white font-semibold tracking-tight">Audio Connection</h2>
          </div>
          <div className="flex items-center gap-2">
            {onSwitchToVideo && callData?.status === "answered" && (
              <Button
                variant="outline"
                size="sm"
                className="border-indigo-500/50 text-indigo-300 hover:text-white hover:bg-indigo-500/20 gap-1.5 h-8 bg-indigo-950/20"
                onClick={onSwitchToVideo}
              >
                <Video className="w-3.5 h-3.5" />
                <span className="text-xs font-bold uppercase tracking-wider">Enable Video</span>
              </Button>
            )}

            <Popover open={showSettings} onOpenChange={setShowSettings}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`text-gray-400 hover:text-white w-8 h-8 ${showSettings ? "bg-indigo-500/20 text-indigo-300" : ""}`}
                  title="Settings"
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 bg-slate-800 border-slate-700 text-white p-4">
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-gray-400 uppercase">Input Devices</h4>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-400">Microphone</label>
                    <Select value={selectedAudioDevice} onValueChange={handleAudioDeviceChange}>
                      <SelectTrigger className="bg-slate-900 border-slate-600">
                        <SelectValue placeholder="Select Microphone" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-600 text-white">
                        {audioDevices.map((device) => (
                          <SelectItem key={device.deviceId} value={device.deviceId}>
                            {device.label || `Microphone ${device.deviceId.slice(0, 5)}...`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Button
              variant="ghost"
              size="icon"
              className="text-gray-400 hover:text-white w-8 h-8"
              onClick={() => setIsMinimized(true)}
            >
              <Minimize2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Call Info */}
        <div className="p-6 text-center">
          <div className="w-20 h-20 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl text-white font-semibold">{otherParticipant.charAt(0).toUpperCase()}</span>
          </div>

          <h3 className="text-xl font-semibold text-white mb-2">{otherParticipant}</h3>

          <p className="text-gray-400 mb-6">
            {callData?.status === "ringing"
              ? isIncoming
                ? "Incoming call..."
                : "Calling..."
              : callData?.status === "answered"
                ? formatDuration(callDuration)
                : "Connecting..."}
          </p>


          {/* Incoming Call Actions */}
          {isIncoming && callData?.status === "ringing" && (
            <div className="flex gap-4 justify-center mb-6">
              <Button onClick={() => handleEndCall()} className="bg-red-500 hover:bg-red-600 text-white rounded-full w-16 h-16">
                <PhoneOff className="w-6 h-6" />
              </Button>
              <Button
                onClick={() => handleAnswerCall()}
                className="bg-green-500 hover:bg-green-600 text-white rounded-full w-16 h-16"
              >
                <Phone className="w-6 h-6" />
              </Button>
            </div>
          )}

          {/* Outgoing Call Actions */}
          {!isIncoming && callData?.status === "ringing" && (
            <div className="flex gap-4 justify-center mb-6">
              <Button onClick={() => handleEndCall()} className="bg-red-500 hover:bg-red-600 text-white rounded-full w-16 h-16">
                <PhoneOff className="w-6 h-6" />
              </Button>
            </div>
          )}

          {/* Active Call Controls */}
          {callData?.status === "answered" && (
            <div className="flex flex-wrap gap-4 justify-center mb-6">
              <Button
                variant="ghost"
                size="icon"
                className={`rounded-full w-14 h-14 ${isMuted ? "bg-red-500/20 text-red-400" : "bg-slate-700 text-white"
                  } shadow-lg transition-all duration-200 hover:scale-105`}
                onClick={() => setIsMuted(!isMuted)}
              >
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className={`rounded-full w-14 h-14 ${isSpeakerOn ? "bg-blue-500/20 text-blue-400" : "bg-slate-700 text-white"
                  } shadow-lg transition-all duration-200 hover:scale-105`}
                onClick={() => setIsSpeakerOn(!isSpeakerOn)}
              >
                {isSpeakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="rounded-full w-14 h-14 bg-slate-700 text-white hover:bg-slate-600 shadow-lg transition-all duration-200 hover:scale-105"
                onClick={() => setShowVoiceFilters(true)}
                title="Voice Filters"
              >
                <Sparkles className="w-6 h-6" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className={`rounded-full w-14 h-14 ${isRecording ? "bg-red-500 hover:bg-red-600 text-white animate-pulse" : "bg-slate-700 text-white"
                  } shadow-lg transition-all duration-200 hover:scale-105`}
                onClick={isRecording ? () => stopRecording() : () => startRecording()}
                title={isRecording ? "Stop Recording" : "Record Audio"}
              >
                {isRecording ? <Square className="w-6 h-6" /> : <Disc className="w-6 h-6" />}
              </Button>

              <Button onClick={() => handleEndCall()} className="bg-red-500 hover:bg-red-600 text-white rounded-full w-14 h-14 shadow-xl transition-all duration-200 hover:scale-110 active:scale-95">
                <PhoneOff className="w-7 h-7" />
              </Button>
            </div>
          )}

          {/* Remote audio output */}
          <audio ref={remoteAudioRef} className="hidden" aria-hidden="true" />
        </div>
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
