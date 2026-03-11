"use client"

import React, { useEffect, useState, useRef, useCallback } from "react"
import { presentationModeManager, type Slide } from "@/utils/infra/presentation-mode"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, ChevronLeft, ChevronRight, Play, Pause, X, Monitor, Image, Video } from "lucide-react"
import { cn } from "@/lib/utils"
import { WebRTCManager } from "@/utils/infra/webrtc-manager"
import { stopMediaStream } from "@/lib/webrtc"

interface PresentationViewerProps {
    roomId: string
    userId: string
    userName: string
    presentationId: string
    isOpen: boolean
    onClose: () => void
    onMinimize?: () => void
}

export function PresentationViewer({ roomId, userId, userName, presentationId, isOpen, onClose, onMinimize }: PresentationViewerProps) {
    const [currentSlide, setCurrentSlide] = useState<Slide | null>(null)
    const [presentation, setPresentation] = useState<any>(null)
    const [canControl, setCanControl] = useState(false)
    const [viewerCount, setViewerCount] = useState(0)
    const [isPlaying, setIsPlaying] = useState(false)
    const [screenStream, setScreenStream] = useState<MediaStream | null>(null)

    const localStreamRef = useRef<MediaStream | null>(null)
    const connectedPeersRef = useRef<Set<string>>(new Set())
    const videoRef = useRef<HTMLVideoElement>(null)

    // setupPeerConnection is handled by WebRTCManager

    // Cleanup WebRTC
    const cleanupWebRTC = useCallback(() => {
        WebRTCManager.getInstance().cleanup()
        localStreamRef.current = null
        connectedPeersRef.current.clear()
        setScreenStream(null)
    }, [])

    useEffect(() => {
        presentationModeManager.initialize(roomId, userId, userName)
        presentationModeManager.listenForPresentation(presentationId)

        const unsubscribe = presentationModeManager.subscribe((state) => {
            setCurrentSlide(state.currentSlide)
            setPresentation(state.presentation)
            setCanControl(state.canControl)
            setViewerCount(state.viewerCount)
            setIsPlaying(state.presentation?.isPlaying || false)
        })

        // Listen for signals
        const unsubscribeSignals = presentationModeManager.listenForSignals(presentationId, userId, async (type, payload, fromUserId) => {
            const webrtc = WebRTCManager.getInstance()

            if (type === "offer") {
                webrtc.initialize(
                    fromUserId,
                    localStreamRef.current || new MediaStream(),
                    (s, uid) => { if (uid === fromUserId) setScreenStream(s) },
                    (c, uid) => { if (uid === fromUserId) presentationModeManager.sendSignal(presentationId, "ice-candidate", c, userId, fromUserId) }
                )
                const answer = await webrtc.createAnswer(fromUserId, payload)
                presentationModeManager.sendSignal(presentationId, "answer", answer, userId, fromUserId)
            } else if (type === "answer") {
                await webrtc.handleAnswer(fromUserId, payload)
            } else if (type === "ice-candidate") {
                await webrtc.addIceCandidate(fromUserId, payload)
            }
        })

        return () => {
            unsubscribe()
            unsubscribeSignals()
            cleanupWebRTC()
            presentationModeManager.destroy()
        }
    }, [roomId, userId, userName, presentationId, cleanupWebRTC])

    // Handle Screen Sharing Slide
    useEffect(() => {
        const startScreenShare = async () => {
            const webrtc = WebRTCManager.getInstance()
            if (canControl && currentSlide?.type === "screen") {
                if (!localStreamRef.current) {
                    try {
                        const stream = await webrtc.startScreenShare()
                        if (stream) {
                            localStreamRef.current = stream
                            setScreenStream(stream)
                        }
                    } catch (err) {
                        console.error("Failed to start screen share:", err)
                        return
                    }
                }

                // Initiate connection to all current viewers
                if (presentation?.viewers) {
                    Object.keys(presentation.viewers).forEach(async (viewerId) => {
                        if (viewerId !== userId && !connectedPeersRef.current.has(viewerId) && localStreamRef.current) {
                            console.log("Connecting to viewer:", viewerId)

                            webrtc.initialize(
                                viewerId,
                                localStreamRef.current,
                                (s, uid) => { if (uid === viewerId) setScreenStream(s) },
                                (c, uid) => { if (uid === viewerId) presentationModeManager.sendSignal(presentationId, "ice-candidate", c, userId, viewerId) }
                            )

                            const offer = await webrtc.createOffer(viewerId)
                            presentationModeManager.sendSignal(presentationId, "offer", offer, userId, viewerId)
                            connectedPeersRef.current.add(viewerId)
                        }
                    })
                }
            } else if (currentSlide?.type !== "screen" && currentSlide) {
                cleanupWebRTC()
            }
        }

        startScreenShare()
    }, [currentSlide?.type, canControl, presentation?.viewers, userId, presentationId, cleanupWebRTC])

    // Attach stream to video element
    useEffect(() => {
        if (videoRef.current && screenStream) {
            videoRef.current.srcObject = screenStream
        }
    }, [screenStream])

    const handleNextSlide = async () => {
        await presentationModeManager.nextSlide(presentationId)
    }

    const handlePrevSlide = async () => {
        await presentationModeManager.previousSlide(presentationId)
    }

    const handleGoToSlide = async (index: number) => {
        await presentationModeManager.goToSlide(presentationId, index)
    }

    const handleTogglePlay = async () => {
        if (isPlaying) {
            await presentationModeManager.pausePresentation(presentationId)
        } else {
            await presentationModeManager.resumePresentation(presentationId)
        }
    }

    const handleLeave = async () => {
        await presentationModeManager.leavePresentation(presentationId)
        onClose()
    }

    const renderSlideContent = (slide: Slide) => {
        const baseContentClass = "h-full flex flex-col justify-center p-12 transition-all duration-500 animate-in zoom-in-95 fade-in"

        switch (slide.type) {
            case "title":
                return (
                    <div className={cn(baseContentClass, "items-center text-center")}>
                        <h1 className="text-7xl font-black text-white mb-6 tracking-tighter drop-shadow-2xl leading-tight">
                            {slide.title}
                        </h1>
                        <div className="h-1.5 w-24 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mb-8 shadow-lg shadow-purple-500/20" />
                        <p className="text-2xl text-slate-400 font-medium max-w-2xl leading-relaxed">
                            {slide.content}
                        </p>
                    </div>
                )
            case "content":
                return (
                    <div className={baseContentClass}>
                        <div className="flex items-center gap-4 mb-8">
                            <div className="h-12 w-1.5 bg-purple-500 rounded-full" />
                            <h2 className="text-4xl font-black text-white tracking-tight">{slide.title}</h2>
                        </div>
                        <div className="text-xl text-slate-300 leading-relaxed font-medium bg-white/5 p-8 rounded-[32px] border border-white/10 backdrop-blur-sm">
                            {slide.content}
                        </div>
                    </div>
                )
            case "image":
                return (
                    <div className={baseContentClass}>
                        <h2 className="text-3xl font-black text-white mb-8 text-center">{slide.title}</h2>
                        <div className="flex-1 flex items-center justify-center overflow-hidden">
                            {slide.imageUrl ? (
                                <img
                                    src={slide.imageUrl}
                                    alt={slide.title}
                                    className="max-w-full max-h-full object-contain rounded-3xl shadow-2xl border border-white/10"
                                />
                            ) : (
                                <div className="w-full h-64 bg-slate-800/50 rounded-3xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center text-white/20">
                                    <Image className="h-12 w-12 mb-3" />
                                    <p className="font-bold">NO IMAGE LOADED</p>
                                </div>
                            )}
                        </div>
                    </div>
                )
            case "code":
                return (
                    <div className={baseContentClass}>
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-3xl font-black text-white">{slide.title}</h2>
                            <Badge className="bg-slate-800 text-purple-400 border-purple-500/20 px-3 py-1 font-mono uppercase tracking-widest text-[10px]">
                                {slide.language || "code"}
                            </Badge>
                        </div>
                        <div className="bg-slate-950/80 rounded-[32px] p-8 border border-white/5 overflow-auto shadow-inner relative group">
                            <div className="absolute top-4 right-6 flex gap-1.5 opacity-30 group-hover:opacity-100 transition-opacity">
                                <div className="h-2 w-2 rounded-full bg-red-500" />
                                <div className="h-2 w-2 rounded-full bg-yellow-500" />
                                <div className="h-2 w-2 rounded-full bg-green-500" />
                            </div>
                            <pre className="text-sm font-mono text-white/80 leading-relaxed">
                                <code>{slide.code}</code>
                            </pre>
                        </div>
                    </div>
                )
            case "video":
                return (
                    <div className={baseContentClass}>
                        <h2 className="text-3xl font-black text-white mb-8 text-center">{slide.title}</h2>
                        <div className="flex-1 w-full max-w-4xl mx-auto aspect-video rounded-3xl overflow-hidden shadow-2xl border border-white/10 bg-black">
                            {slide.videoUrl ? (
                                <iframe
                                    src={slide.videoUrl}
                                    className="w-full h-full"
                                    allowFullScreen
                                />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-white/20">
                                    <Video className="h-12 w-12 mb-3" />
                                    <p className="font-bold">VIDEO SOURCE REQUIRED</p>
                                </div>
                            )}
                        </div>
                    </div>
                )
            case "screen":
                return (
                    <div className={cn(baseContentClass, "items-center")}>
                        <h2 className="text-3xl font-black text-white mb-8 text-center">{slide.title}</h2>
                        <div className="flex-1 w-full max-w-5xl mx-auto aspect-video rounded-3xl overflow-hidden shadow-2xl border border-white/10 bg-black relative group">
                            {screenStream ? (
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    className="w-full h-full object-contain"
                                />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-white/20">
                                    <Monitor className="h-16 w-16 mb-4 animate-pulse" />
                                    <p className="font-black tracking-widest uppercase">
                                        {canControl ? "STARTING SCREEN SHARE..." : "WAITING FOR HOST SCREEN..."}
                                    </p>
                                </div>
                            )}

                            {/* Screen Share Indicator */}
                            {screenStream && (
                                <div className="absolute top-4 right-4 z-20">
                                    <Badge className="bg-red-500 text-white animate-pulse px-3 py-1 font-bold">
                                        LIVE SCREEN
                                    </Badge>
                                </div>
                            )}
                        </div>
                    </div>
                )
            case "poll":
            case "quiz":
                const isQuiz = slide.type === "quiz"
                return (
                    <div className={cn(baseContentClass, "items-center")}>
                        <h2 className="text-4xl font-black text-white mb-10 text-center tracking-tight drop-shadow-lg">
                            {slide.title}
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-4xl">
                            {slide.options?.map((option, index) => (
                                <button
                                    key={index}
                                    className={cn(
                                        "group relative flex items-center justify-between p-6 rounded-[24px] border-2 transition-all text-left overflow-hidden",
                                        isQuiz && index === slide.correctAnswer
                                            ? "bg-green-500/10 border-green-500/30 text-white"
                                            : "bg-white/5 border-white/5 text-white/80 hover:bg-white/10 hover:border-purple-500/30 hover:scale-[1.02]"
                                    )}
                                >
                                    <div className="flex items-center gap-4 relative z-10">
                                        <div className={cn(
                                            "h-10 w-10 rounded-xl flex items-center justify-center font-bold text-sm",
                                            isQuiz && index === slide.correctAnswer
                                                ? "bg-green-500 text-white"
                                                : "bg-slate-800 text-white/30 group-hover:bg-purple-600 group-hover:text-white"
                                        )}>
                                            {String.fromCharCode(65 + index)}
                                        </div>
                                        <span className="text-lg font-bold">{option}</span>
                                    </div>
                                    {/* Decoration */}
                                    <div className="absolute top-0 right-0 bottom-0 w-32 bg-gradient-to-l from-white/5 to-transparent skew-x-12 translate-x-16 pointer-events-none" />
                                </button>
                            ))}
                        </div>
                    </div>
                )
            default:
                return (
                    <div className="flex flex-col items-center justify-center h-full text-white/20">
                        <Monitor className="h-16 w-16 mb-4" />
                        <p className="font-black tracking-widest uppercase">READY TO PRESENT</p>
                    </div>
                )
        }
    }

    const slideKeys = Object.keys(presentation?.slides || {})
    const currentIndex = presentation?.currentSlideIndex || 0

    if (!isOpen) return null

    if (!currentSlide) {
        return (
            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-3xl">
                <div className="h-16 w-16 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin mb-4" />
                <p className="text-white/40 font-bold tracking-widest uppercase text-sm">Synchronizing Stream...</p>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/80 backdrop-blur-3xl animate-in fade-in duration-500 overflow-hidden">
            {/* Top Bar */}
            <div className="flex items-center justify-between p-6 px-10 z-10">
                <div className="flex items-center gap-6">
                    <div className="h-12 w-12 rounded-2xl bg-purple-600 flex items-center justify-center shadow-lg shadow-purple-600/20">
                        <Monitor className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tighter uppercase">{presentation?.title || "Presentation"}</h2>
                        <div className="flex items-center gap-3 mt-1">
                            <Badge variant="outline" className="bg-white/5 border-white/10 text-white/50 text-[10px] font-bold">
                                <Users className="h-3 w-3 mr-1" />
                                {viewerCount} VIEWERS
                            </Badge>
                            {canControl && (
                                <Badge variant="default" className="bg-purple-500 text-white text-[10px] font-bold shadow-lg shadow-purple-500/20">
                                    PRESENTING
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {onMinimize && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onMinimize}
                            className="h-12 w-12 rounded-2xl bg-white/5 hover:bg-purple-500/20 text-white transition-all border border-white/10"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleLeave}
                        className="h-12 w-12 rounded-2xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-all border border-red-500/20"
                    >
                        <X className="h-6 w-6" />
                    </Button>
                </div>
            </div>

            {/* Main Stage */}
            <div className="flex-1 flex items-center justify-center p-10 relative overflow-hidden">
                <div className="w-full max-w-6xl aspect-video bg-slate-900/50 rounded-[40px] border border-white/10 shadow-2xl overflow-hidden relative group">
                    {/* Glass Overlay for depth */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

                    <div className="h-full relative z-10 p-12">
                        {renderSlideContent(currentSlide)}
                    </div>

                    {/* Quick Nav Overlays (Host only) */}
                    {canControl && (
                        <>
                            <button
                                onClick={handlePrevSlide}
                                disabled={currentIndex === 0}
                                className="absolute left-4 top-1/2 -translate-y-1/2 h-14 w-14 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all disabled:hidden"
                            >
                                <ChevronLeft className="h-8 w-8" />
                            </button>
                            <button
                                onClick={handleNextSlide}
                                disabled={currentIndex >= slideKeys.length - 1}
                                className="absolute right-4 top-1/2 -translate-y-1/2 h-14 w-14 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all disabled:hidden"
                            >
                                <ChevronRight className="h-8 w-8" />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Bottom Control Bar */}
            <div className="p-10 px-10 flex flex-col gap-6 z-10">
                {/* Progress */}
                <div className="w-full max-w-4xl mx-auto flex flex-col gap-2">
                    <div className="flex items-center justify-between text-[10px] font-black tracking-widest text-white/30 px-1">
                        <span>SLIDE {currentIndex + 1} OF {slideKeys.length}</span>
                        <span>{Math.round(((currentIndex + 1) / slideKeys.length) * 100)}% COMPLETE</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                        <div
                            className="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-full transition-all duration-700 ease-out"
                            style={{ width: `${((currentIndex + 1) / slideKeys.length) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Host Controls */}
                {canControl && (
                    <div className="flex items-center justify-center gap-4">
                        <Button
                            variant="outline"
                            size="lg"
                            className="h-14 px-8 rounded-2xl bg-white/5 border-white/10 text-white font-bold hover:bg-white/10"
                            onClick={handlePrevSlide}
                            disabled={currentIndex === 0}
                        >
                            <ChevronLeft className="h-5 w-5 mr-2" />
                            PREVIOUS
                        </Button>

                        <Button
                            variant="default"
                            size="lg"
                            className="h-16 w-16 rounded-full bg-purple-600 hover:bg-purple-500 shadow-xl shadow-purple-600/20 border-0"
                            onClick={handleTogglePlay}
                        >
                            {isPlaying ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 fill-current" />}
                        </Button>

                        <Button
                            variant="outline"
                            size="lg"
                            className="h-14 px-8 rounded-2xl bg-white/5 border-white/10 text-white font-bold hover:bg-white/10"
                            onClick={handleNextSlide}
                            disabled={currentIndex >= slideKeys.length - 1}
                        >
                            NEXT
                            <ChevronRight className="h-5 w-5 ml-2" />
                        </Button>
                    </div>
                )}

                {/* Thumbnail Strip */}
                {canControl && (
                    <div className="flex items-center justify-center gap-2 overflow-x-auto max-w-4xl mx-auto py-2 px-4 custom-scrollbar">
                        {slideKeys.map((key, index) => (
                            <button
                                key={key}
                                onClick={() => handleGoToSlide(index)}
                                className={cn(
                                    "w-12 h-8 rounded-lg border-2 text-[10px] font-black transition-all flex-shrink-0 flex items-center justify-center",
                                    index === currentIndex
                                        ? "border-purple-500 bg-purple-500/20 text-purple-400 scale-110"
                                        : "border-white/5 bg-white/5 text-white/30 hover:border-white/20 hover:text-white"
                                )}
                            >
                                {index + 1}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    height: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                }
            `}</style>
        </div>
    )
}
