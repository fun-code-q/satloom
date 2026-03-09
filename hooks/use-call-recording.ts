
import { useState, useRef, useCallback } from "react"
import { toast } from "sonner"

interface UseCallRecordingProps {
    stream: MediaStream | null
    fileType?: "video/webm" | "audio/webm"
}

export function useCallRecording({ stream, fileType = "video/webm" }: UseCallRecordingProps) {
    const [isRecording, setIsRecording] = useState(false)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])

    const startRecording = useCallback(() => {
        if (!stream) {
            toast.error("No active stream to record")
            return
        }

        try {
            chunksRef.current = []
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: fileType
            })

            mediaRecorderRef.current = mediaRecorder

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data)
                }
            }

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: fileType })
                const url = URL.createObjectURL(blob)
                const a = document.createElement("a")
                document.body.appendChild(a)
                a.style.display = "none"
                a.href = url
                const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
                a.download = `call-recording-${timestamp}.${fileType.split("/")[0] === "video" ? "webm" : "webm"}`
                a.click()
                window.URL.revokeObjectURL(url)
                document.body.removeChild(a)
                toast.success("Recording saved to computer")
            }

            mediaRecorder.start()
            setIsRecording(true)
            toast.success("Recording started")
        } catch (error) {
            console.error("Error starting recording:", error)
            toast.error("Failed to start recording")
        }
    }, [stream, fileType])

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop()
            setIsRecording(false)
        }
    }, [])

    return {
        isRecording,
        startRecording,
        stopRecording
    }
}
