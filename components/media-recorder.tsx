"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Mic, Video, Camera, RotateCcw, Square, Loader2, Sparkles, Send } from "lucide-react"
import { VoiceFilterModal } from "./voice-filter-modal"
import { voiceFilterProcessor, type VoiceFilterType } from "@/utils/hardware/voice-filters"
import { toast } from "sonner"

interface MediaRecorderProps {
  isOpen: boolean
  onClose: () => void
  mode: "audio" | "video" | "photo"
  onMediaReady: (file: File, type: string) => void
  onRecordingStart?: () => void
  onRecordingEnd?: () => void
}

export function MediaRecorder({ isOpen, onClose, mode, onMediaReady, onRecordingStart, onRecordingEnd }: MediaRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user")
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showVoiceFilters, setShowVoiceFilters] = useState(false)
  const [voiceFilter, setVoiceFilter] = useState<VoiceFilterType>("none")
  const [currentMode, setCurrentMode] = useState<"audio" | "video" | "photo">(mode)
  const [recordedPreviewUrl, setRecordedPreviewUrl] = useState<string | null>(null)
  const [recordingSeconds, setRecordingSeconds] = useState(0)

  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<any>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    setCurrentMode(mode)
  }, [mode])

  useEffect(() => {
    if (!recordedBlob) {
      setRecordedPreviewUrl(null)
      return
    }

    const previewUrl = URL.createObjectURL(recordedBlob)
    setRecordedPreviewUrl(previewUrl)

    return () => {
      URL.revokeObjectURL(previewUrl)
    }
  }, [recordedBlob])

  useEffect(() => {
    if (!isRecording) {
      setRecordingSeconds(0)
      return
    }

    const timer = window.setInterval(() => {
      setRecordingSeconds((prev) => prev + 1)
    }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [isRecording])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      setStream(null)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const initCamera = async () => {
      try {
        const constraints: MediaStreamConstraints = {
          audio: currentMode === "audio" || currentMode === "video",
          video: currentMode === "video" || currentMode === "photo" ? { facingMode } : false,
        }

        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)

        if (!mounted) {
          mediaStream.getTracks().forEach(t => t.stop())
          return
        }

        setStream(mediaStream)
        streamRef.current = mediaStream
        setIsLoading(false)

        if (videoRef.current && (currentMode === "video" || currentMode === "photo")) {
          videoRef.current.srcObject = mediaStream
        }
      } catch (err) {
        if (!mounted) return

        console.error("Error accessing media devices:", err)
        setIsLoading(false)

        const error = err as Error
        if (error.name === "NotAllowedError") {
          setError("Camera/microphone access denied. Please allow access in your browser settings.")
          toast.error("Access denied", {
            description: "Please allow camera and microphone access to use this feature."
          })
        } else if (error.name === "NotFoundError") {
          setError("No camera or microphone found. Please connect a device and try again.")
          toast.error("No device found", {
            description: "Please connect a camera or microphone."
          })
        } else if (error.name === "NotReadableError") {
          setError("Camera or microphone is already in use by another application.")
          toast.error("Device in use", {
            description: "Please close other applications using your camera or microphone."
          })
        } else {
          setError("Could not access camera/microphone. Please check your permissions.")
          toast.error("Access error", {
            description: "Could not access camera or microphone."
          })
        }
      }
    }

    if (isOpen && !recordedBlob) {
      setIsLoading(true)
      setError(null)
      initCamera()
    } else {
      stopCamera()
    }

    return () => {
      mounted = false
      stopCamera()
    }
  }, [isOpen, facingMode, currentMode, recordedBlob, stopCamera])

  const startRecording = () => {
    if (!stream) return

    chunksRef.current = []
    setRecordingSeconds(0)
    const mediaRecorder = new window.MediaRecorder(stream)
    mediaRecorderRef.current = mediaRecorder

    mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data)
      }
    }

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, {
        type: currentMode === "audio" ? "audio/wav" : "video/mp4",
      })
      setRecordedBlob(blob)
      onRecordingEnd?.()
      toast.success(currentMode === "audio" ? "Audio recorded!" : currentMode === "video" ? "Video recorded!" : "Photo taken!")
    }

    mediaRecorder.start()
    setIsRecording(true)
    onRecordingStart?.()
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const takePhoto = () => {
    if (!videoRef.current) return

    const canvas = document.createElement("canvas")
    const context = canvas.getContext("2d")
    if (!context) return

    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    context.drawImage(videoRef.current, 0, 0)

    canvas.toBlob((blob) => {
      if (blob) {
        setRecordedBlob(blob)
        toast.success("Photo taken!")
      }
    }, "image/jpeg")
  }

  const sendMedia = () => {
    if (recordedBlob) {
      const fileName = `${currentMode}-${Date.now()}.${currentMode === "photo" ? "jpg" : currentMode === "audio" ? "wav" : "mp4"}`
      const file = new File([recordedBlob], fileName, {
        type: recordedBlob.type,
      })
      toast.success("Media sent!")
      onMediaReady(file, currentMode)
      handleClose()
    }
  }

  const handleClose = () => {
    if (isRecording) {
      stopRecording()
    }
    stopCamera()
    setRecordedBlob(null)
    setIsRecording(false)
    setError(null)
    setRecordingSeconds(0)
    onClose()
  }

  const switchCamera = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"))
  }

  const switchMode = (nextMode: "photo" | "video") => {
    if (isRecording) return
    stopCamera()
    setRecordedBlob(null)
    setCurrentMode(nextMode)
    setIsLoading(true)
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const isCameraMode = currentMode === "video" || currentMode === "photo"
  const canCapture = !isLoading && !error

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className="bg-slate-900 border-slate-700 text-white w-[95vw] max-w-xl p-0 overflow-hidden"
        aria-label={currentMode === "audio" ? "Record audio" : currentMode === "video" ? "Record video" : "Take photo"}
      >
        <DialogHeader className="px-4 py-3 border-b border-slate-800 bg-slate-900/95">
          <DialogTitle className="text-cyan-300 flex items-center justify-center gap-2 text-base">
            {currentMode === "audio" && <Mic className="w-5 h-5" />}
            {currentMode === "video" && <Video className="w-5 h-5" />}
            {currentMode === "photo" && <Camera className="w-5 h-5" />}
            {currentMode === "audio" ? "Record Audio" : currentMode === "video" ? "Record Video" : "Take Photo"}
          </DialogTitle>
        </DialogHeader>

        <div className="p-3 sm:p-4 space-y-3">
          {error && (
            <div className="p-2.5 bg-red-500/20 border border-red-500/50 rounded-xl flex items-center gap-2">
              <span className="text-red-400 text-sm">{error}</span>
            </div>
          )}

          {!recordedBlob && isCameraMode && (
            <div className="flex items-center justify-center">
              <div className="inline-flex rounded-full p-1 bg-slate-800 border border-slate-700">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`rounded-full px-4 h-8 ${currentMode === "photo" ? "bg-cyan-500/20 text-cyan-300" : "text-slate-400 hover:text-slate-200"}`}
                  onClick={() => switchMode("photo")}
                  disabled={isRecording}
                >
                  <Camera className="w-4 h-4 mr-1.5" />
                  Photo
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`rounded-full px-4 h-8 ${currentMode === "video" ? "bg-cyan-500/20 text-cyan-300" : "text-slate-400 hover:text-slate-200"}`}
                  onClick={() => switchMode("video")}
                  disabled={isRecording}
                >
                  <Video className="w-4 h-4 mr-1.5" />
                  Video
                </Button>
              </div>
            </div>
          )}

          {isCameraMode && !recordedBlob && (
            <div className="relative bg-black rounded-2xl overflow-hidden aspect-video border border-slate-700">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className={`w-full h-full object-cover ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
                style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
              />

              {isRecording && currentMode === "video" && (
                <div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-red-500/90 text-white text-xs font-semibold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  {formatDuration(recordingSeconds)}
                </div>
              )}

              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-20">
                  <div className="flex items-center gap-2 text-slate-300 text-sm">
                    <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                    Loading camera...
                  </div>
                </div>
              )}

              {!isLoading && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white z-10 h-9 w-9"
                  onClick={switchCamera}
                  title="Switch Camera"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              )}
            </div>
          )}

          {currentMode === "audio" && !recordedBlob && (
            <div className="h-32 bg-slate-900 rounded-2xl border border-slate-700 flex items-center justify-center">
              <div className={`flex items-center gap-3 ${isRecording ? "text-red-400" : "text-slate-300"}`}>
                {isRecording ? (
                  <>
                    <div className="w-2.5 h-2.5 bg-red-400 rounded-full animate-pulse" />
                    <span className="text-sm font-medium">Recording {formatDuration(recordingSeconds)}</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-6 h-6 text-cyan-300" />
                    <span className="text-sm">Ready to record audio</span>
                  </>
                )}
              </div>
            </div>
          )}

          {recordedBlob && (
            <div className="bg-slate-900 rounded-2xl border border-slate-700 p-3 space-y-2">
              <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Preview</h4>
              {currentMode === "audio" && (
                <audio controls className="w-full">
                  <source src={recordedPreviewUrl || undefined} type="audio/wav" />
                </audio>
              )}
              {currentMode === "video" && (
                <video controls className="w-full max-h-52 rounded-xl bg-black">
                  <source src={recordedPreviewUrl || undefined} type="video/mp4" />
                </video>
              )}
              {currentMode === "photo" && (
                <img
                  src={recordedPreviewUrl || "/placeholder.svg"}
                  alt="Captured"
                  className="w-full max-h-52 object-contain rounded-xl bg-black"
                />
              )}
            </div>
          )}

          <div className="space-y-3">
            {!recordedBlob && (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {(currentMode === "audio" || currentMode === "video") && !isRecording && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="bg-slate-800 border-slate-700 text-cyan-300 hover:bg-slate-700 hover:text-cyan-200 h-10 w-10 rounded-full"
                      onClick={() => setShowVoiceFilters(true)}
                      title="Voice Filters"
                    >
                      <Sparkles className="w-5 h-5" />
                    </Button>
                  )}
                </div>

                {currentMode === "photo" ? (
                  <Button
                    onClick={takePhoto}
                    className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 h-11 px-6 rounded-full font-semibold"
                    disabled={!canCapture}
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Capture
                  </Button>
                ) : (
                  <Button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`${isRecording ? "bg-red-500 hover:bg-red-400" : "bg-cyan-500 hover:bg-cyan-400 text-slate-950"} h-11 px-6 rounded-full font-semibold`}
                    disabled={!canCapture}
                  >
                    {isRecording ? (
                      <>
                        <Square className="w-4 h-4 mr-2" />
                        Stop
                      </>
                    ) : (
                      <>
                        {currentMode === "audio" ? <Mic className="w-4 h-4 mr-2" /> : <Video className="w-4 h-4 mr-2" />}
                        Record
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}

            {recordedBlob && (
              <div className="flex justify-between gap-2">
                <Button
                  onClick={() => setRecordedBlob(null)}
                  variant="outline"
                  className="border-slate-600 bg-transparent flex-1 h-10"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Retake
                </Button>
                <Button
                  onClick={sendMedia}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold flex-1 h-10"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send
                </Button>
              </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={handleClose}
                variant="ghost"
                className="text-slate-300 hover:text-white hover:bg-slate-800 h-9 px-3"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
        <VoiceFilterModal
          isOpen={showVoiceFilters}
          onClose={() => setShowVoiceFilters(false)}
          currentFilter={voiceFilter}
          onFilterSelect={(filter) => {
            setVoiceFilter(filter)
            voiceFilterProcessor.setFilter(filter)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

// Add BlobEvent type declaration
interface BlobEvent extends Event {
  data: Blob
}
