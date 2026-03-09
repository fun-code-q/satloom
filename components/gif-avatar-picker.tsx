"use client"

import React, { useState, useRef, useEffect } from "react"
import { gifAvatarGenerator } from "@/utils/infra/gif-avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { BaseModal } from "@/components/base-modal"
import { Camera, Video, StopCircle, Download, RefreshCw, Wand2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface GifAvatarPickerProps {
    isOpen: boolean
    onClose: () => void
    onSelectAvatar: (avatarUrl: string) => void
}

export function GifAvatarPicker({ isOpen, onClose, onSelectAvatar }: GifAvatarPickerProps) {
    const [isRecording, setIsRecording] = useState(false)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [gifUrl, setGifUrl] = useState<string | null>(null)
    const [frameCount, setFrameCount] = useState(10)
    const [frameDelay, setFrameDelay] = useState(100)
    const [capturedFrames, setCapturedFrames] = useState(0)
    const videoRef = useRef<HTMLVideoElement>(null)
    const streamRef = useRef<MediaStream | null>(null)

    useEffect(() => {
        if (isOpen) {
            startCamera()
        }

        return () => {
            stopCamera()
        }
    }, [isOpen])

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 256, height: 256, facingMode: "user" },
            })
            streamRef.current = stream

            if (videoRef.current) {
                videoRef.current.srcObject = stream
                await videoRef.current.play()
            }
        } catch (error) {
            console.error("Failed to access camera:", error)
        }
    }

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop())
            streamRef.current = null
        }
    }

    const handleStartRecording = async () => {
        if (!videoRef.current) return

        setIsRecording(true)
        setCapturedFrames(0)
        setPreviewUrl(null)
        setGifUrl(null)

        await gifAvatarGenerator.initialize(videoRef.current)
        await gifAvatarGenerator.startRecording({
            frameCount,
            frameDelay,
        })

        const interval = setInterval(() => {
            setCapturedFrames(gifAvatarGenerator.getFrameCount())
        }, 50)

        setTimeout(() => {
            clearInterval(interval)
            setIsRecording(false)
            setCapturedFrames(gifAvatarGenerator.getFrameCount())
            const frames = gifAvatarGenerator.getCapturedFrames()
            if (frames.length > 0) {
                setPreviewUrl(frames[frames.length - 1].data)
            }
        }, (frameCount * frameDelay) + 500)
    }

    const handleStopRecording = () => {
        gifAvatarGenerator.stopRecording()
        setIsRecording(false)
    }

    const handleGenerateGif = async () => {
        const result = await gifAvatarGenerator.generateGif({
            frameCount,
            frameDelay,
        })

        if (result.success && result.gifUrl) {
            setGifUrl(result.gifUrl)
        }
    }

    const handleSelectAvatar = () => {
        const finalUrl = gifUrl || previewUrl
        if (finalUrl) {
            onSelectAvatar(finalUrl)
            onClose()
        }
    }

    const handleUseStatic = async () => {
        const staticAvatar = await gifAvatarGenerator.generateStaticAvatar()
        if (staticAvatar) {
            setPreviewUrl(staticAvatar)
            setGifUrl(null)
        }
    }

    const handleDownload = () => {
        const url = gifUrl || previewUrl
        if (url) {
            const a = document.createElement("a")
            a.href = url
            a.download = `avatar-${Date.now()}.${gifUrl ? "gif" : "png"}`
            a.click()
        }
    }

    return (
        <BaseModal isOpen={isOpen} onClose={onClose} title="GIF Avatar Generator" className="max-w-lg">
            <div className="space-y-4">
                <Card className="bg-slate-800 border-slate-700 overflow-hidden">
                    <div className="aspect-square relative bg-slate-900">
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className={cn(
                                "w-full h-full object-cover",
                                isRecording && "animate-pulse"
                            )}
                        />
                        {!videoRef.current && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Camera className="h-12 w-12 text-slate-600" />
                            </div>
                        )}
                    </div>
                </Card>

                {isRecording && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-400">Recording</span>
                            <span className="text-red-400 animate-pulse">●</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-2">
                            <div
                                className="bg-red-500 h-2 rounded-full transition-all"
                                style={{ width: `${(capturedFrames / frameCount) * 100}%` }}
                            />
                        </div>
                        <p className="text-xs text-slate-400 text-center">
                            {capturedFrames} / {frameCount} frames
                        </p>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                    {!isRecording ? (
                        <Button
                            onClick={handleStartRecording}
                            className="bg-gradient-to-r from-purple-500 to-pink-500"
                        >
                            <Video className="h-4 w-4 mr-2" />
                            Record GIF
                        </Button>
                    ) : (
                        <Button variant="destructive" onClick={handleStopRecording}>
                            <StopCircle className="h-4 w-4 mr-2" />
                            Stop
                        </Button>
                    )}
                    <Button variant="outline" onClick={handleUseStatic}>
                        <Camera className="h-4 w-4 mr-2" />
                        Static
                    </Button>
                </div>

                <Card className="bg-slate-800 border-slate-700">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-white text-sm">Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-slate-400">Frames</span>
                                <span className="text-white">{frameCount}</span>
                            </div>
                            <Slider
                                value={[frameCount]}
                                onValueChange={([v]) => setFrameCount(v)}
                                min={4}
                                max={20}
                                step={2}
                            />
                        </div>
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-slate-400">Frame Delay</span>
                                <span className="text-white">{frameDelay}ms</span>
                            </div>
                            <Slider
                                value={[frameDelay]}
                                onValueChange={([v]) => setFrameDelay(v)}
                                min={50}
                                max={300}
                                step={50}
                            />
                        </div>
                    </CardContent>
                </Card>

                {(previewUrl || gifUrl) && (
                    <Card className="bg-slate-800 border-slate-700">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-white text-sm flex items-center gap-2">
                                <Wand2 className="h-4 w-4 text-purple-400" />
                                Preview
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-center gap-4">
                                <div className="w-24 h-24 rounded-full overflow-hidden bg-slate-700">
                                    {previewUrl && (
                                        <img
                                            src={previewUrl}
                                            alt="Preview"
                                            className="w-full h-full object-cover"
                                        />
                                    )}
                                </div>
                                {gifUrl && (
                                    <Badge variant="outline" className="text-green-400 border-green-400">
                                        GIF Ready
                                    </Badge>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {(previewUrl || gifUrl) && (
                    <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={handleGenerateGif}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Generate GIF
                        </Button>
                        <Button variant="outline" className="flex-1" onClick={handleDownload}>
                            <Download className="h-4 w-4 mr-2" />
                            Download
                        </Button>
                    </div>
                )}

                <Button
                    onClick={handleSelectAvatar}
                    disabled={!previewUrl && !gifUrl}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-500"
                >
                    Use as Avatar
                </Button>
            </div>
        </BaseModal>
    )
}
