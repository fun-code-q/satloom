"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Mic, MicOff, Video, VideoOff, Phone, PhoneOff, Minimize2, Maximize2, Camera, CameraOff, Monitor, Palette, Settings, SignalHigh, SignalMedium, SignalLow, SignalZero, Info, Music, Smile, Wand2, Sparkles, MonitorPlay, Film, X } from "lucide-react"

// Debug icons to prevent crashes if icons are missing from lucide-react version
const Icon = ({ icon: LucideIcon, ...props }: any) => {
  if (!LucideIcon) return <X {...props} />
  return <LucideIcon {...props} />
}
import { CallSignaling, type CallData } from "@/utils/infra/call-signaling"
import { useCallRecording } from "@/hooks/use-call-recording"
import { WebRTCManager } from "@/utils/infra/webrtc-manager"
import { AudioVisualizer } from "@/components/audio-visualizer"
import { VoiceFilterModal } from "@/components/voice-filter-modal"
import { voiceFilterProcessor, type VoiceFilterType } from "@/utils/hardware/voice-filters"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { toast } from "sonner"

const DEFAULT_EFFECTS = [
  { id: "none", name: "None", icon: "🚫", type: "none" as const },
  { id: "blur", name: "Blur", icon: "🌫️", type: "blur" as const },
  { id: "grayscale", name: "B&W", icon: "⬛", type: "grayscale" as const },
  { id: "sepia", name: "Sepia", icon: "🟫", type: "sepia" as const },
  { id: "vintage", name: "Vintage", icon: "📷", type: "vintage" as const },
  { id: "cool", name: "Cool", icon: "❄️", type: "cool" as const },
  { id: "warm", name: "Warm", icon: "🔥", type: "warm" as const },
]

interface VideoCallModalProps {
  isOpen: boolean
  onClose: () => void
  roomId: string
  currentUser: string
  currentUserId: string
  callData: CallData | null
  isIncoming?: boolean
  onAnswer?: () => void
  onStartWhiteboard?: () => void
  onWatchTogether?: () => void
  onSwitchToAudio?: () => void
}

export function VideoCallModal({
  isOpen,
  onClose,
  roomId,
  currentUser,
  currentUserId,
  callData,
  isIncoming = false,
  onAnswer,
  onStartWhiteboard,
  onWatchTogether,
  onSwitchToAudio,
}: VideoCallModalProps) {
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [isFrontCamera, setIsFrontCamera] = useState(true)
  const [isMinimized, setIsMinimized] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [position, setPosition] = useState({ x: 20, y: 20 })
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [showVoiceFilterModal, setShowVoiceFilterModal] = useState(false)
  const [currentVoiceFilter, setCurrentVoiceFilter] = useState<VoiceFilterType>("none")
  const [currentEffect, setCurrentEffect] = useState("none")
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)

  // Refs for cleanup to avoid closure capture issues
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteStreamRef = useRef<MediaStream | null>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)

  const updateLocalStream = (stream: MediaStream | null) => {
    setLocalStream(stream)
    localStreamRef.current = stream
    if (stream) cameraStreamRef.current = stream
  }

  const updateRemoteStream = (stream: MediaStream | null) => {
    setRemoteStream(stream)
    remoteStreamRef.current = stream
  }

  // Device Selection State
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>("")
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>("")
  const [connectionStats, setConnectionStats] = useState<{ packetLoss: number; rtt: number; jitter: number } | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  const modalRef = useRef<HTMLDivElement>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const callTimerRef = useRef<any>(null)
  const pendingOfferRef = useRef<any>(null)
  const callSignaling = CallSignaling.getInstance()

  const { isRecording, startRecording, stopRecording } = useCallRecording({
    stream: remoteStream,
    fileType: "video/webm"
  })
  useEffect(() => {
    if (isOpen && callData?.status === "answered") {
      callTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1)
      }, 1000)
    }

    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current)
      }
    }
  }, [isOpen, callData?.status])

  // Effect to handle connection stats and device loading
  useEffect(() => {
    if (!isOpen || callData?.status !== "answered") {
      setConnectionStats(null)
      return
    }

    const interval = setInterval(async () => {
      const targetUserId = callData.participants.find(p => p !== currentUserId) || callData.callerId
      if (!targetUserId) return

      const stats = await WebRTCManager.getInstance().getConnectionStats(targetUserId)
      if (stats) {
        setConnectionStats((prev) => {
          if (prev?.rtt === stats.rtt && prev?.packetLoss === stats.packetLoss) return prev
          return stats
        })
      }
    }, 3000)

    const loadDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        setAudioDevices(devices.filter(d => d.kind === "audioinput"))
        setVideoDevices(devices.filter(d => d.kind === "videoinput"))
      } catch (e) {
        console.error("Failed to load devices:", e)
      }
    }
    loadDevices()

    return () => clearInterval(interval)
  }, [isOpen, callData?.status])

  const onRemoteStreamRef = useRef<(stream: MediaStream, userId: string) => void>(() => { })
  const onIceCandidateRef = useRef<(candidate: RTCIceCandidate) => void>(() => { })
  const isInitializedRef = useRef(false)

  useEffect(() => {
    const targetUserId = callData?.participants.find(p => p !== currentUserId) || callData?.caller
    onRemoteStreamRef.current = (stream: MediaStream, userId: string) => {
      if (userId === targetUserId) {
        console.log(`VideoCall: Remote stream received for user ${userId}. Stream ID: ${stream.id}`)
        
        // Ensure the stream has tracks before updating state
        const tracks = stream.getTracks()
        console.log(`VideoCall: Remote tracks existing:`, tracks.map(t => t.kind))
        
        updateRemoteStream(stream)
        
        // Listen for new tracks being added to this stream
        stream.onaddtrack = (e) => {
          console.log(`VideoCall: New track added to remote stream: ${e.track.kind}`)
          updateRemoteStream(new MediaStream(stream.getTracks())) // Force re-render with new stream object
        }

        tracks.forEach(track => {
          track.onmute = () => console.log(`[VideoCall] Remote track ${track.kind} MUTED`)
          track.onunmute = () => console.log(`[VideoCall] Remote track ${track.kind} UNMUTED`)
          track.onended = () => console.log(`[VideoCall] Remote track ${track.kind} ENDED`)
        })
      }
    }
    onIceCandidateRef.current = (candidate: RTCIceCandidate) => {
      if (callData?.id) {
        // Send structured payload matching video-call.html and standard expectations
        const payload = {
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex
        }
        callSignaling.sendSignal(roomId, callData.id, "ice-candidate", payload, currentUserId)
      }
    }
  }, [callData?.id, roomId, currentUserId, callData?.participants, callData?.caller])

  // Effect 1: Media Setup
  useEffect(() => {
    let mounted = true
    let wakeLock: any = null

    if (!isOpen) {
      return
    }

    const setupMedia = async () => {
      try {
        if ("wakeLock" in navigator) {
          try { wakeLock = await (navigator as any).wakeLock.request("screen") } catch (e) { }
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        if (!mounted) {
          stream.getTracks().forEach(track => track.stop())
          return
        }
        updateLocalStream(stream)
      } catch (e) {
        console.error("Failed to get local media", e)
      }
    }
    setupMedia()

    return () => {
      mounted = false
      if (wakeLock) {
        try { wakeLock.release() } catch (e) { }
      }
      // Final aggressive cleanup of all known streams using refs
      [localStreamRef.current, remoteStreamRef.current, cameraStreamRef.current].forEach(stream => {
        if (stream) {
          stream.getTracks().forEach(track => {
            track.stop()
            console.log(`VideoCall: Aggressive stop (ref): ${track.kind}`)
          })
        }
      })
      localStreamRef.current = null
      remoteStreamRef.current = null
      cameraStreamRef.current = null
      setLocalStream(null)
      setRemoteStream(null)
    }
  }, [isOpen])

  // Effect 2: WebRTC Initialization (Runs once)
  const unsubscribeSignalsRef = useRef<() => void>(() => { })

  useEffect(() => {
    if (!isOpen) {
      if (isInitializedRef.current) {
        console.log("VideoCall: Cleaning up WebRTC")
        unsubscribeSignalsRef.current()
        WebRTCManager.getInstance().cleanup()
        isInitializedRef.current = false
      }
      return
    }

    if (isInitializedRef.current || !localStream || !callData) return

    const webrtc = WebRTCManager.getInstance()

    // Correctly resolve the actual user ID we are talking to
    const targetUserId = callData.participants.find(p => p !== currentUserId) || 
                       (callData.targetUserId !== "all" ? callData.targetUserId : null) || 
                       (callData.callerId !== currentUserId ? callData.callerId : null)

    if (!targetUserId || targetUserId === currentUserId) {
      console.log("VideoCall: Waiting for a specific target user to join...", { 
        participants: callData.participants, 
        targetUserId: callData.targetUserId,
        callerId: callData.callerId 
      })
      return
    }

    isInitializedRef.current = true

    console.log("VideoCall: Initializing WebRTC and Signal Listeners for target", targetUserId)
    webrtc.initialize(
      targetUserId,
      localStream,
      (s, uid) => onRemoteStreamRef.current(s, uid),
      (c, uid) => { if (uid === targetUserId) onIceCandidateRef.current(c) },
      (state, uid) => {
        console.log(`[VideoCall] WebRTC state for ${uid}: ${state}`)
        if (state === "connected") {
          console.log(`[VideoCall] SUCCESSFULLY CONNECTED to ${uid}`)
          toast.success("Connection established")
        }
        if (state === "failed") {
          console.error(`[VideoCall] Connection to ${uid} FAILED. Check network/ICE servers.`)
          toast.error("Connection failed. Retrying...")
        }
        if (state === "disconnected") {
          console.warn(`[VideoCall] Connection to ${uid} disconnected.`)
        }
      }
    )

    // Log tracking for debugging
    console.log(`[VideoCall] Initialized WebRTC for ${targetUserId} with local stream ${localStream.id}`)
    localStream.getTracks().forEach(t => console.log(`[VideoCall] Local track active: ${t.kind} (${t.id})`))

    unsubscribeSignalsRef.current = callSignaling.listenForSignals(roomId, callData.id, currentUserId, async (type, payload, senderId) => {
      console.log(`VideoCall: Signal received (${type}) from ${senderId}`)

      // Use the senderId directly from the signal
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
        console.log("VideoCall: Remote peer sent bye")
        onClose()
      }
    })
  }, [isOpen, localStream, roomId, currentUserId, callData?.id, callData?.participants]) // Added participants to trigger re-init when someone joins

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

      console.log("VideoCall: Call answered, sending offer as caller to", targetUserId)
      webrtc.createOffer(targetUserId).then(offer => {
        callSignaling.sendSignal(roomId, callData.id, "offer", offer, currentUserId)
      }).catch(err => console.error("VideoCall: Error creating offer:", err))
    }
  }, [isOpen, callData?.status, isIncoming, roomId, currentUserId, callData?.id, callData?.participants])

  // Effect 3: Handle pending offer when call is answered
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

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const getFilterStyle = () => {
    switch (currentEffect) {
      case "blur": return "blur(8px)"
      case "grayscale": return "grayscale(100%)"
      case "sepia": return "sepia(100%)"
      case "vintage": return "contrast(1.2) sepia(0.2) brightness(0.9)"
      case "cool": return "hue-rotate(180deg) saturate(1.2)"
      case "warm": return "sepia(0.3) saturate(1.4) brightness(1.1)"
      default: return "none"
    }
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

    // Stop all tracks immediately using refs for aggressive hardware release
    const streamsToStop = [localStreamRef.current, remoteStreamRef.current, cameraStreamRef.current];
    streamsToStop.forEach(stream => {
      if (stream) {
        stream.getTracks().forEach(track => {
          track.stop()
          console.log(`VideoCall: Explicit track stop: ${track.kind}`)
        })
      }
    })

    // Clear everything
    localStreamRef.current = null
    remoteStreamRef.current = null
    cameraStreamRef.current = null
    setLocalStream(null)
    setRemoteStream(null)

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
    await WebRTCManager.getInstance().switchMicrophone(deviceId)
  }

  const handleVideoDeviceChange = async (deviceId: string) => {
    setSelectedVideoDevice(deviceId)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } }
      })
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }
      await WebRTCManager.getInstance().switchCamera(stream)
    } catch (e) {
      console.error("Failed to switch camera device:", e)
    }
  }

  const handleSwitchCamera = async () => {
    try {
      const newFacingMode = isFrontCamera ? 'environment' : 'user'
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacingMode },
        audio: true // Keep audio
      })

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = newStream
      }
      setLocalStream(newStream)

      await WebRTCManager.getInstance().switchCamera(newStream)
      setIsFrontCamera(!isFrontCamera)
    } catch (error) {
      console.error("Failed to switch camera:", error)
    }
  }

  const handleToggleScreenShare = async () => {
    const webrtc = WebRTCManager.getInstance()
    if (isScreenSharing) {
      setIsScreenSharing(false)
      const restoredStream = await webrtc.stopScreenShare(cameraStreamRef.current || undefined)
      if (restoredStream) {
        updateLocalStream(restoredStream)
        if (localVideoRef.current) localVideoRef.current.srcObject = restoredStream
      }
      return
    }

    try {
      if (localVideoRef.current?.srcObject) {
        cameraStreamRef.current = localVideoRef.current.srcObject as MediaStream
      }

      const screenStream = await webrtc.startScreenShare()
      if (screenStream) {
        setIsScreenSharing(true)
        updateLocalStream(screenStream)
        if (localVideoRef.current) localVideoRef.current.srcObject = screenStream
      }
    } catch (err: any) {
      console.error("Screen share failed:", err)
      toast.error("Screen sharing failed. Please try again.")
    }
  }

  // Effect to re-attach streams when toggling minimize/maximize or when streams change
  useEffect(() => {
    const safePlay = (el: HTMLVideoElement) => {
      const playPromise = el.play()
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          if (error.name !== "AbortError") {
            console.error("Video play failed:", error)
          }
        })
      }
    }

    // Local Stream re-attachment
    if (localVideoRef.current && localStream) {
      if (localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream
        safePlay(localVideoRef.current)
      }
    }
    // Remote Stream re-attachment
    if (remoteVideoRef.current && remoteStream) {
      if (remoteVideoRef.current.srcObject !== remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream
        safePlay(remoteVideoRef.current)
      }
    }
  }, [isMinimized, isVideoOn, localStream, remoteStream, localVideoRef, remoteVideoRef])

  // Effect to handle actual track muting
  useEffect(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted
      })
    }
  }, [isMuted, localStream])

  useEffect(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = isVideoOn
      })
    }
  }, [isVideoOn, localStream])

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
    const maxX = window.innerWidth - 250
    const maxY = window.innerHeight - 150

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
    const maxX = window.innerWidth - 250
    const maxY = window.innerHeight - 150

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
        className="fixed z-[1000] bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl cursor-move select-none overflow-hidden"
        style={{
          left: position.x,
          top: position.y,
          width: "250px",
          height: "150px",
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* Mini video preview */}
        <div className="relative w-full h-full bg-slate-900">
          <video
            ref={localVideoRef}
            className={`w-full h-full object-cover ${isFrontCamera ? 'scale-x-[-1]' : ''}`}
            autoPlay
            muted
            playsInline
            style={{ filter: getFilterStyle() }}
          />

          {!isVideoOn && (
            <div className="absolute inset-0 bg-slate-700 flex items-center justify-center">
              <CameraOff className="w-8 h-8 text-gray-400" />
            </div>
          )}

          {/* Mini controls overlay */}
          <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
            <div className="text-white text-xs font-medium truncate">{otherParticipant}</div>

            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="w-6 h-6 text-gray-400 hover:text-white bg-black/50"
                onClick={() => setIsMinimized(false)}
              >
                <Maximize2 className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="w-6 h-6 text-red-400 hover:text-red-300 bg-black/50"
                onClick={handleEndCall}
              >
                <PhoneOff className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {/* Call duration */}
          <div className="absolute top-2 left-2 bg-black/50 rounded px-2 py-1">
            <span className="text-white text-xs">{formatDuration(callDuration)}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[1000]">
      <div
        ref={modalRef}
        className="bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl w-full h-full max-w-4xl max-h-[90vh] mx-4 my-4 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50">
          <div className="flex items-center gap-3">
            <h2 className="text-white font-semibold">Video Call</h2>
            <span className="text-gray-400 text-sm">{otherParticipant}</span>
          </div>

          <div className="flex items-center gap-4">
            {connectionStats && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900 border border-slate-700 group relative cursor-help">
                {connectionStats.rtt < 100 && connectionStats.packetLoss < 1 ? (
                  <Icon icon={SignalHigh} className="w-4 h-4 text-green-400" />
                ) : connectionStats.rtt < 250 && connectionStats.packetLoss < 3 ? (
                  <SignalMedium className="w-3.5 h-3.5 text-yellow-400" />
                ) : connectionStats.rtt < 500 && connectionStats.packetLoss < 7 ? (
                  <SignalLow className="w-3.5 h-3.5 text-orange-400" />
                ) : (
                  <SignalZero className="w-3.5 h-3.5 text-red-400" />
                )}
                <span className="text-[10px] font-mono text-gray-300">{Math.round(connectionStats.rtt)}ms</span>

                {/* Tooltip */}
                <div className="absolute top-full right-0 mt-2 hidden group-hover:block z-50">
                  <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-2xl min-w-[140px] text-xs">
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center gap-4 text-gray-400">
                        <span>Latency</span>
                        <span className="font-mono text-cyan-400">{Math.round(connectionStats.rtt)}ms</span>
                      </div>
                      <div className="flex justify-between items-center gap-4 text-gray-400">
                        <span>Packet Loss</span>
                        <span className="font-mono text-cyan-400">{connectionStats.packetLoss.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between items-center gap-4 text-gray-400">
                        <span>Jitter</span>
                        <span className="font-mono text-cyan-400">{connectionStats.jitter.toFixed(1)}ms</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">{formatDuration(callDuration)}</span>
              {onSwitchToAudio && callData?.status === "answered" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 gap-1.5 h-8 mr-2"
                  onClick={onSwitchToAudio}
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span className="text-xs font-bold uppercase tracking-wider">Switch to Audio</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-white"
                onClick={() => setIsMinimized(true)}
              >
                <Minimize2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Video Area */}
        <div className="flex-1 relative bg-black">
          {/* Remote video (main) */}
          <video ref={remoteVideoRef} className="w-full h-full object-cover" autoPlay playsInline />

          {/* Local video (picture-in-picture) */}
          <div className="absolute top-4 right-4 w-48 h-36 bg-slate-800 rounded-lg overflow-hidden border border-slate-600">
            <video
              ref={localVideoRef}
              className={`w-full h-full object-cover scale-x-[-1]`}
              autoPlay
              muted
              playsInline
              style={{ filter: getFilterStyle() }}
            />

            {!isVideoOn && (
              <div className="absolute inset-0 bg-slate-700 flex items-center justify-center">
                <CameraOff className="w-8 h-8 text-gray-400" />
              </div>
            )}
          </div>

          {/* Call status overlay */}
          {callData?.status !== "answered" && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl text-white font-semibold">{otherParticipant.charAt(0).toUpperCase()}</span>
                </div>
                <p className="text-gray-400 mb-6">
                  {callData?.status === "ringing"
                    ? isIncoming
                      ? "Incoming video call..."
                      : "Calling..."
                    : "Connecting..."}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-4 bg-slate-800/50 border-t border-slate-700">
          <div className="flex justify-center flex-wrap gap-4">
            {/* Incoming Call Actions */}
            {isIncoming && callData?.status === "ringing" && (
              <>
                <Button
                  onClick={handleEndCall}
                  className="bg-red-500 hover:bg-red-600 text-white rounded-full w-14 h-14"
                >
                  <PhoneOff className="w-6 h-6" />
                </Button>
                <Button
                  onClick={handleAnswerCall}
                  className="bg-green-500 hover:bg-green-600 text-white rounded-full w-14 h-14"
                >
                  <Phone className="w-6 h-6" />
                </Button>
              </>
            )}

            {/* Active Call Controls */}
            {callData?.status === "answered" && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`rounded-full w-12 h-12 ${isMuted ? "bg-red-500/20 text-red-400" : "bg-slate-700 text-white"
                    }`}
                  onClick={() => setIsMuted(!isMuted)}
                >
                  {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className={`rounded-full w-12 h-12 ${!isVideoOn ? "bg-red-500/20 text-red-400" : "bg-slate-700 text-white"
                    }`}
                  onClick={() => setIsVideoOn(!isVideoOn)}
                >
                  {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                </Button>


                <Button variant="ghost" size="icon" className="rounded-full w-12 h-12 bg-slate-700 text-white hover:bg-slate-600 transition-colors" onClick={handleSwitchCamera} title="Switch Camera">
                  <Camera className="w-5 h-5" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className={`rounded-full w-12 h-12 ${isScreenSharing ? "bg-cyan-500 text-white" : "bg-slate-700 text-white hover:bg-slate-600"} transition-colors`}
                  onClick={handleToggleScreenShare}
                  title={isScreenSharing ? "Stop Sharing" : "Share Screen"}
                >
                  <Monitor className="w-5 h-5" />
                </Button>

                {/* Watch Together Button */}
                {onWatchTogether && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full w-12 h-12 bg-slate-700 text-white hover:bg-violet-500/30 hover:text-violet-300 transition-colors"
                    onClick={onWatchTogether}
                    title="Watch Together (Movie Theater)"
                  >
                    <Icon icon={Film} className="w-4 h-4" />
                  </Button>
                )}

                {onStartWhiteboard && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full w-12 h-12 bg-slate-700 text-white hover:bg-slate-600 transition-colors"
                    onClick={onStartWhiteboard}
                    title="Open Whiteboard"
                  >
                    <Icon icon={MonitorPlay} className="w-4 h-4" />
                  </Button>
                )}

                {/* Voice Filter Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className={`rounded-full w-12 h-12 transition-colors ${currentVoiceFilter !== "none" ? "bg-cyan-500 text-white" : "bg-slate-700 text-white hover:bg-slate-600"}`}
                  onClick={() => setShowVoiceFilterModal(true)}
                  title={currentVoiceFilter !== "none" ? `Voice: ${currentVoiceFilter}` : "Voice Effects"}
                >
                  <Sparkles className="w-5 h-5" />
                </Button>

                {/* Video Effects Button */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`rounded-full w-12 h-12 transition-colors ${currentEffect !== "none" ? "bg-indigo-500 text-white" : "bg-slate-700 text-white hover:bg-slate-600"}`}
                      title="Video Effects"
                    >
                      <Wand2 className="w-5 h-5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 bg-slate-800 border-slate-700 p-2">
                    <div className="grid grid-cols-2 gap-2">
                      {DEFAULT_EFFECTS.map((effect) => (
                        <Button
                          key={effect.id}
                          variant="ghost"
                          className={`justify-start gap-2 h-9 text-xs px-2 ${currentEffect === effect.id ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/50" : "text-gray-300 hover:bg-slate-700"}`}
                          onClick={() => setCurrentEffect(effect.id)}
                        >
                          <span className="text-sm">{effect.icon}</span>
                          <span>{effect.name}</span>
                        </Button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full w-12 h-12 bg-slate-700 text-white relative"
                      title="Settings"
                    >
                      <Settings className="w-5 h-5" />
                      <div className="absolute -top-1 -right-1">
                        <AudioVisualizer stream={localStream} width={20} height={20} />
                      </div>
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
                        <div className="bg-slate-900 p-2 rounded flex justify-center items-center h-12 border border-slate-700">
                          <AudioVisualizer stream={localStream} width={200} height={30} />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium">Camera</label>
                        <Select value={selectedVideoDevice} onValueChange={handleVideoDeviceChange}>
                          <SelectTrigger className="bg-slate-900 border-slate-600">
                            <SelectValue placeholder="Select Camera" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-600 text-white">
                            {videoDevices.map((device) => (
                              <SelectItem key={device.deviceId} value={device.deviceId}>
                                {device.label || `Camera ${device.deviceId.slice(0, 5)}...`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                <Button
                  onClick={handleEndCall}
                  className="bg-red-500 hover:bg-red-600 text-white rounded-full w-12 h-12"
                >
                  <PhoneOff className="w-5 h-5" />
                </Button>
              </>
            )}

            {/* Outgoing Call Controls */}
            {!isIncoming && callData?.status === "ringing" && (
              <Button
                onClick={handleEndCall}
                className="bg-red-500 hover:bg-red-600 text-white rounded-full w-14 h-14 shadow-xl"
              >
                <PhoneOff className="w-6 h-6" />
              </Button>
            )}

          </div>
        </div>
      </div>

      {/* Voice Filter Modal */}
      <VoiceFilterModal
        isOpen={showVoiceFilterModal}
        onClose={() => setShowVoiceFilterModal(false)}
        onFilterSelect={async (filter) => {
          setCurrentVoiceFilter(filter)
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
        currentFilter={currentVoiceFilter}
      />
    </div>
  )
}
