"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Mic, MicOff, Video, VideoOff, Phone, PhoneOff, Minimize2, Maximize2, Camera, CameraOff, Monitor, Palette, Settings, SignalHigh, SignalMedium, SignalLow, SignalZero, Info, Music, Smile, Wand2, Sparkles, MonitorPlay, Film, X, User } from "lucide-react"

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
import { audioNotificationManager } from "@/utils/hardware/audio-notification-manager"

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

const isScreenShareStream = (stream: MediaStream | null) => {
  if (!stream) return false
  const track = stream.getVideoTracks()[0]
  if (!track) return false
  const settings = track.getSettings ? (track.getSettings() as MediaTrackSettings & { displaySurface?: string }) : {}
  if (settings.displaySurface) return true
  const label = (track.label || "").toLowerCase()
  return label.includes("screen") || label.includes("display") || label.includes("window") || label.includes("monitor")
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
  const [isRemoteScreenShare, setIsRemoteScreenShare] = useState(false)

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
  const wakeLockRef = useRef<any>(null)
  const pendingOfferRef = useRef<any>(null)
  const offerSentRef = useRef(false)
  const unsubscribeSignalsRef = useRef<() => void>(() => { })
  const wasOpenRef = useRef(false)
  const callSignaling = CallSignaling.getInstance()

  const { isRecording, startRecording, stopRecording } = useCallRecording({
    stream: remoteStream,
    fileType: "video/webm"
  })

  const cleanupMedia = (reason?: string) => {
    if (reason) console.log(`VideoCall: Cleanup (${reason})`)

    try {
      unsubscribeSignalsRef.current()
    } catch { }

    const streamsToStop = [localStreamRef.current, remoteStreamRef.current, cameraStreamRef.current].filter(Boolean) as MediaStream[]
    streamsToStop.forEach(stream => {
      stream.getTracks().forEach(track => {
        track.stop()
        console.log(`VideoCall: Stopped track: ${track.kind}`)
      })
    })

    localStreamRef.current = null
    remoteStreamRef.current = null
    cameraStreamRef.current = null
    setLocalStream(null)
    setRemoteStream(null)

    if (localVideoRef.current) localVideoRef.current.srcObject = null
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null

    WebRTCManager.getInstance().cleanup()
    isInitializedRef.current = false
    offerSentRef.current = false
    pendingOfferRef.current = null
    setCallDuration(0)
  }
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
    const targetUserId = callData?.participants.find(p => p !== currentUserId) || callData?.callerId
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
  }, [callData?.id, roomId, currentUserId, callData?.participants, callData?.callerId])

  // Effect 1: Media Setup
  useEffect(() => {
    let mounted = true

    if (!isOpen) {
      audioNotificationManager.stopAll()
      return
    }

    // Start outgoing ring if we are the caller and ringing
    if (!isIncoming && callData?.status === "ringing") {
      audioNotificationManager.startOutgoingRing()
    }

    const shouldInitMedia = !isIncoming || callData?.status === "answered"
    const setupMedia = async () => {
      if (!shouldInitMedia || localStreamRef.current) return
      try {
        if (!navigator?.mediaDevices?.getUserMedia) {
          toast.error("Camera/microphone access is not supported in this browser.")
          return
        }
        if ("wakeLock" in navigator && !wakeLockRef.current) {
          try { wakeLockRef.current = await (navigator as any).wakeLock.request("screen") } catch (e) { }
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        if (!mounted) {
          stream.getTracks().forEach(track => track.stop())
          return
        }
        updateLocalStream(stream)
      } catch (e: any) {
        console.error("Failed to get local media", e)
        const reason =
          e?.name === "NotAllowedError" ? "Camera/microphone permission denied." :
            e?.name === "NotFoundError" ? "No camera or microphone device found." :
              "Could not access camera/microphone."
        toast.error(reason)
      }
    }
    setupMedia()

    return () => {
      mounted = false
    }
  }, [isOpen, isIncoming, callData?.status])

  useEffect(() => {
    if (!isOpen && wakeLockRef.current) {
      try { wakeLockRef.current.release() } catch (e) { }
      wakeLockRef.current = null
    }
  }, [isOpen])

  // Effect 2: WebRTC Initialization (Runs once)
  useEffect(() => {
    if (!isOpen) {
      if (!wasOpenRef.current) return
      if (isInitializedRef.current) {
        console.log("VideoCall: Cleaning up WebRTC")
        unsubscribeSignalsRef.current()
        WebRTCManager.getInstance().cleanup()
        isInitializedRef.current = false
      }
      cleanupMedia("modal closed")
      wasOpenRef.current = false
      return
    }

    if (!wasOpenRef.current) {
      wasOpenRef.current = true
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
      (s, uid, label) => {
        if (uid === targetUserId && (label === "default" || !label)) onRemoteStreamRef.current(s, uid)
      },
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

    // If we are caller and call already answered, send offer immediately
    if (!isIncoming && callData.status === "answered" && !offerSentRef.current) {
      offerSentRef.current = true
      console.log("VideoCall: Call already answered, sending offer as caller")
      webrtc.createOffer(targetUserId).then(offer => {
        callSignaling.sendSignal(roomId, callData.id, "offer", offer, currentUserId)
      }).catch(err => console.error("VideoCall: Error creating offer:", err))
    }
  }, [isOpen, localStream, roomId, currentUserId, callData?.id, callData?.participants]) // Added participants to trigger re-init when someone joins

  // Effect 2.5: Handshake Action (Triggered on status change)
  useEffect(() => {
    if (!isOpen || !isInitializedRef.current || !callData || offerSentRef.current) return

    const webrtc = WebRTCManager.getInstance()

    // If we are the caller and call just became answered, send the offer
    if (!isIncoming && callData.status === "answered") {
      const targetUserId = callData.participants.find(p => p !== currentUserId) || 
                         (callData.targetUserId !== "all" ? callData.targetUserId : null) || 
                         (callData.callerId !== currentUserId ? callData.callerId : null)
                         
      if (!targetUserId || targetUserId === currentUserId) return

      console.log("VideoCall: Call answered, sending offer as caller to", targetUserId)
      offerSentRef.current = true
      webrtc.createOffer(targetUserId).then(offer => {
        callSignaling.sendSignal(roomId, callData.id, "offer", offer, currentUserId)
      }).catch(err => console.error("VideoCall: Error creating offer:", err))
    }
  }, [isOpen, callData?.status, isIncoming, roomId, currentUserId, callData?.id, callData?.participants])

  useEffect(() => {
    if (!isOpen) {
      offerSentRef.current = false
    }
  }, [isOpen])

  useEffect(() => {
    offerSentRef.current = false
  }, [callData?.id])

  useEffect(() => {
    if (callData?.status === "answered" || callData?.status === "ended") {
      audioNotificationManager.stopAll()
    }
  }, [callData?.status])

  useEffect(() => {
    if (callData?.status === "ended") {
      cleanupMedia("call ended")
      audioNotificationManager.stopAll()
    }
  }, [callData?.status])

  useEffect(() => {
    setIsRemoteScreenShare(isScreenShareStream(remoteStream))
  }, [remoteStream])

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
    audioNotificationManager.stopAll()
    if (callData) {
      try {
        // Send bye signal before closing to notify remote peer immediately
        await callSignaling.sendSignal(roomId, callData.id, "bye", {}, currentUserId)
        await callSignaling.endCall(roomId, callData.id)
      } catch (err) {
        console.error("Error during end call signaling:", err)
      }
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

      // Stop old stream tracks to release the camera/mic
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop())
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = newStream
      }
      updateLocalStream(newStream)

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
      // Stop the screen share tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop())
      }
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
  const shouldMirrorLocal = !isScreenSharing && isFrontCamera
  const localVideoFitClass = isScreenSharing ? "object-contain" : "object-cover"

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
            className={`w-full h-full ${localVideoFitClass} ${shouldMirrorLocal ? "scale-x-[-1]" : ""}`}
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
    <div className="fixed inset-0 bg-black/95 sm:bg-black/90 z-[1000] flex items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
      <div
        ref={modalRef}
        className="bg-slate-900 border-x sm:border border-slate-700/50 shadow-2xl w-full h-[100dvh] sm:h-full sm:max-w-4xl sm:max-h-[85vh] rounded-none sm:rounded-2xl flex flex-col min-h-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] overflow-hidden"
      >
        {/* Header - Compact on mobile */}
        <div className="flex items-center justify-between gap-2 p-2 sm:p-4 border-b border-slate-700/50 bg-slate-800/80 backdrop-blur-md">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
              <Video className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 min-w-0">
              <h2 className="text-lg sm:text-base font-semibold text-white truncate">Video Call</h2>
              <span className="text-gray-400 text-[10px] sm:text-sm truncate opacity-80">{otherParticipant}</span>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-3">
            {connectionStats && (
              <div className="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full bg-slate-900/50 border border-slate-700/50">
                {connectionStats.rtt < 100 && connectionStats.packetLoss < 1 ? (
                  <SignalHigh className="w-3 h-3 text-green-400" />
                ) : (
                  <SignalLow className="w-3 h-3 text-yellow-400" />
                )}
                <span className="text-[9px] sm:text-[10px] font-mono text-gray-400">{Math.round(connectionStats.rtt)}ms</span>
              </div>
            )}
            
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

        {/* Video Area - Fill space */}
        <div className="flex-1 relative bg-slate-950 overflow-hidden flex items-center justify-center">
          {/* Main Content: Remote video or Connecting UI */}
          {!remoteStream || callData?.status === "ringing" ? (
            <div className="flex flex-col items-center justify-center gap-6 p-8 text-center animate-in zoom-in duration-500">
               <div className="relative">
                 <div className="w-24 h-24 sm:w-32 sm:h-32 bg-slate-800 rounded-full flex items-center justify-center border-2 border-blue-500/30">
                   <User className="w-12 h-12 sm:w-16 sm:h-16 text-slate-500" />
                 </div>
                 {callData?.status === "ringing" && (
                   <div className="absolute inset-x-[-10px] inset-y-[-10px] border-2 border-blue-500/50 rounded-full animate-ping opacity-20" />
                 )}
               </div>
               
               <div>
                 <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">{otherParticipant}</h3>
                 <p className="text-blue-400 text-sm font-medium tracking-wide animate-pulse uppercase">
                   {callData?.status === "ringing" ? "Ringing..." : "Connecting..."}
                 </p>
               </div>
            </div>
          ) : (
            <video
              ref={remoteVideoRef}
              className={`w-full h-full ${isRemoteScreenShare ? "object-contain" : "object-cover"} transition-opacity duration-700`}
              autoPlay
              playsInline
            />
          )}

          {/* Local Preview - PiP */}
          <div className={`absolute bottom-4 right-4 sm:bottom-6 sm:right-6 w-24 sm:w-32 aspect-[3/4] bg-slate-800 rounded-lg sm:rounded-xl border border-white/10 shadow-2xl overflow-hidden transition-all z-10 ${isMinimized ? "hidden" : ""}`}>
            <video
              ref={localVideoRef}
              className={`w-full h-full object-cover ${shouldMirrorLocal ? "scale-x-[-1]" : ""}`}
              autoPlay
              muted
              playsInline
              style={{ filter: getFilterStyle() }}
            />
            {!isVideoOn && (
              <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center">
                <CameraOff className="w-6 h-6 text-gray-500" />
              </div>
            )}
          </div>

          <div className="absolute top-4 left-4 text-[10px] text-white/50 bg-black/30 backdrop-blur-sm rounded px-2 py-1 pointer-events-none">
            {formatDuration(callDuration)}
          </div>
        </div>

        {/* Controls Bar - Floating and optimized */}
        <div className="p-4 sm:p-6 bg-gradient-to-t from-slate-900 via-slate-900/90 to-transparent">
          <div className="flex items-center justify-center gap-3 sm:gap-6">
            <Button
              variant="ghost"
              size="icon"
              className={`rounded-full w-12 h-12 sm:w-14 sm:h-14 transition-all duration-300 ${isMuted ? "bg-red-500/20 text-red-500 border border-red-500/30" : "bg-slate-800/80 text-white hover:bg-slate-700 border border-white/5"}`}
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className={`rounded-full w-12 h-12 sm:w-14 sm:h-14 transition-all duration-300 ${!isVideoOn ? "bg-red-500/20 text-red-500 border border-red-500/30" : "bg-slate-800/80 text-white hover:bg-slate-700 border border-white/5"}`}
              onClick={() => setIsVideoOn(!isVideoOn)}
            >
              {!isVideoOn ? <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Video className="w-5 h-5 sm:w-6 sm:h-6" />}
            </Button>

            <Button
              onClick={handleEndCall}
              className="bg-red-500 hover:bg-red-600 text-white rounded-full w-12 h-12 sm:w-14 sm:h-14 shadow-lg shadow-red-500/20 transition-transform active:scale-95"
            >
              <PhoneOff className="w-5 h-5 sm:w-6 sm:h-6" />
            </Button>

            {isIncoming && callData?.status === "ringing" && (
                <Button
                onClick={handleAnswerCall}
                className="bg-green-500 hover:bg-green-600 text-white rounded-full w-12 h-12 sm:w-14 sm:h-14 shadow-lg shadow-green-500/20 transition-transform active:scale-95"
                >
                <Phone className="w-5 h-5 sm:w-6 sm:h-6" />
                </Button>
            )}

            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className={`rounded-full w-12 h-12 bg-slate-800/80 text-white hover:bg-slate-700 border border-white/5 ${isScreenSharing ? "text-blue-400 bg-blue-500/10" : ""}`}
                onClick={handleToggleScreenShare}
                title="Share Screen"
              >
                <Monitor className="w-5 h-5" />
              </Button>
              
              <Popover open={showSettings} onOpenChange={setShowSettings}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full w-12 h-12 bg-slate-800/80 text-white hover:bg-slate-700 border border-white/5"
                  >
                    <Settings className="w-5 h-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 bg-slate-900 border-slate-700 text-white p-4">
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
            </div>
          </div>
        </div>
      </div>

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
