"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Mic, Video, Camera, RotateCcw, Square, Loader2, Sparkles, Smile } from "lucide-react"
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

  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<any>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    setCurrentMode(mode)
  }, [mode])

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
      toast.success(currentMode === "audio" ? "Audio recorded!" : currentMode === "video" ? "Video recorded!" : "Photo taken!")
    }

    mediaRecorder.start()
    setIsRecording(true)
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
    setRecordedBlob(null)
    setIsRecording(false)
    setError(null)
    onClose()
  }

  const switchCamera = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"))
  }

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className="bg-slate-800 border-slate-700 text-white max-w-2xl"
        aria-label={currentMode === "audio" ? "Record audio" : currentMode === "video" ? "Record video" : "Take photo"}
      >
        <DialogHeader>
          <DialogTitle className="text-center text-cyan-400 flex items-center justify-center gap-2">
            {currentMode === "audio" && <Mic className="w-5 h-5" />}
            {currentMode === "video" && <Video className="w-5 h-5" />}
            {currentMode === "photo" && <Camera className="w-5 h-5" />}
            {currentMode === "audio" ? "Record Audio" : currentMode === "video" ? "Record Video" : "Take Photo"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-2">
              <span className="text-red-400 text-sm">{error}</span>
            </div>
          )}

          {(currentMode === "video" || currentMode === "photo") && (
            <div className="relative bg-black rounded-lg overflow-hidden h-64">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className={`w-full h-full object-cover ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
                style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
              />

              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-20">
                  <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                  <span className="sr-only">Loading camera...</span>
                </div>
              )}

              {!isLoading && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white z-10"
                  onClick={switchCamera}
                  title="Switch Camera"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              )}
            </div>
          )}

          {currentMode === "audio" && (
            <div className="h-32 bg-slate-900 rounded-lg flex items-center justify-center">
              <div className="flex items-center gap-4">
                <div className={`flex items-center gap-2 ${isRecording ? "text-red-400" : "text-gray-400"}`}>
                  {isRecording ? (
                    <>
                      <div className="w-3 h-3 bg-red-400 rounded-full animate-pulse" />
                      <span>Recording...</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-8 h-8" />
                      <span className="text-lg">Ready to record</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {recordedBlob && (
            <div className="bg-slate-900 rounded-lg p-4">
              <h4 className="text-sm font-medium mb-2 text-gray-300">Preview:</h4>
              {currentMode === "audio" && (
                <audio controls className="w-full">
                  <source src={URL.createObjectURL(recordedBlob)} type="audio/wav" />
                </audio>
              )}
              {currentMode === "video" && (
                <video controls className="w-full max-h-48">
                  <source src={URL.createObjectURL(recordedBlob)} type="video/mp4" />
                </video>
              )}
              {currentMode === "photo" && (
                <img
                  src={URL.createObjectURL(recordedBlob) || "/placeholder.svg"}
                  alt="Captured"
                  className="w-full max-h-48 object-contain rounded-lg"
                />
              )}
            </div>
          )}

          <div className="flex flex-col items-center gap-4">
            {!recordedBlob && (
              <div className="flex flex-col items-center gap-4">
                {currentMode === "photo" || currentMode === "video" ? (
                  <div className="flex items-center gap-2 mb-2 bg-slate-900/50 p-1 rounded-full">
                    <Button
                      variant={currentMode === "photo" ? "secondary" : "ghost"}
                      size="sm"
                      className={`rounded-full px-4 ${currentMode === "photo" ? "bg-cyan-500/20 text-cyan-400" : "text-gray-400"}`}
                      onClick={() => {
                        stopCamera()
                        setCurrentMode("photo")
                        setIsLoading(true)
                      }}
                      disabled={isRecording}
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Photo
                    </Button>
                    <Button
                      variant={currentMode === "video" ? "secondary" : "ghost"}
                      size="sm"
                      className={`rounded-full px-4 ${currentMode === "video" ? "bg-cyan-500/20 text-cyan-400" : "text-gray-400"}`}
                      onClick={() => {
                        stopCamera()
                        setCurrentMode("video")
                        setIsLoading(true)
                      }}
                      disabled={isRecording}
                    >
                      <Video className="w-4 h-4 mr-2" />
                      Video
                    </Button>
                  </div>
                ) : null}

                {currentMode === "photo" ? (
                  <Button
                    onClick={takePhoto}
                    className="bg-cyan-500 hover:bg-cyan-600"
                    disabled={isLoading || !!error}
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Take Photo
                  </Button>
                ) : (
                  <Button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`${isRecording ? "bg-red-500 hover:bg-red-600" : "bg-cyan-500 hover:bg-cyan-600"} h-12 px-8 rounded-full shadow-lg haptic`}
                    disabled={isLoading || !!error}
                  >
                    {isRecording ? (
                      <>
                        <Square className="w-5 h-5 mr-2" />
                        Stop Recording
                      </>
                    ) : (
                      <>
                        {currentMode === "audio" ? <Mic className="w-5 h-5 mr-2" /> : <Video className="w-5 h-5 mr-2" />}
                        Start Recording
                      </>
                    )}
                  </Button>
                )}

                {!recordedBlob && !isRecording && (
                  <div className="flex gap-4">
                    {(currentMode === "audio" || currentMode === "video") && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="bg-slate-700/50 border-slate-600 text-cyan-400 hover:bg-slate-700 hover:text-cyan-300 w-12 h-12 rounded-full haptic"
                        onClick={() => setShowVoiceFilters(true)}
                        title="Voice Filters"
                      >
                        <Sparkles className="w-6 h-6" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {recordedBlob && (
              <div className="flex justify-center gap-4">
                <Button
                  onClick={() => setRecordedBlob(null)}
                  variant="outline"
                  className="border-slate-600"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Retake
                </Button>
                <Button
                  onClick={sendMedia}
                  className="bg-green-500 hover:bg-green-600"
                >
                  Send
                </Button>
              </div>
            )}

            <Button
              onClick={handleClose}
              variant="outline"
              className="border-slate-600 bg-transparent mt-4"
            >
              Cancel
            </Button>
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
