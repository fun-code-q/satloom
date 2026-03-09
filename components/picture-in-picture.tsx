"use client"

import React, { useEffect, useState, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// Picture-in-Picture Manager
class PiPManager {
    private static instance: PiPManager
    private videoElement: HTMLVideoElement | null = null
    private pipWindow: PictureInPictureWindow | null = null

    static getInstance(): PiPManager {
        if (!PiPManager.instance) {
            PiPManager.instance = new PiPManager()
        }
        return PiPManager.instance
    }

    async isSupported(): Promise<boolean> {
        if (typeof window === "undefined") return false
        return "documentPictureInPicture" in window || "pictureInPictureEnabled" in document
    }

    async enterPiP(videoElement: HTMLVideoElement): Promise<boolean> {
        this.videoElement = videoElement

        try {
            // Try the newer Document PiP API first
            if ("documentPictureInPicture" in window) {
                const pipWindow = await (window as any).documentPictureInPicture.requestWindow({
                    width: 400,
                    height: 300,
                })
                pipWindow.document.body.appendChild(videoElement)
                this.pipWindow = pipWindow
                return true
            }

            // Fall back to classic PiP
            if ("pictureInPictureElement" in document) {
                await videoElement.requestPictureInPicture()
                return true
            }

            return false
        } catch (error) {
            console.error("Failed to enter PiP:", error)
            return false
        }
    }

    async exitPiP(): Promise<void> {
        try {
            if ("pictureInPictureElement" in document && document.pictureInPictureElement) {
                await document.exitPictureInPicture()
            }
            this.videoElement = null
            this.pipWindow = null
        } catch (error) {
            console.error("Failed to exit PiP:", error)
        }
    }

    isInPiP(): boolean {
        return document.pictureInPictureElement !== null
    }

    getVideoElement(): HTMLVideoElement | null {
        return this.videoElement
    }
}

const pipManager = PiPManager.getInstance()

// Hook for Picture-in-Picture
export function usePictureInPicture() {
    const [isSupported, setIsSupported] = useState(false)
    const [isActive, setIsActive] = useState(false)
    const [pipWindow, setPipWindow] = useState<PictureInPictureWindow | null>(null)

    useEffect(() => {
        pipManager.isSupported().then(setIsSupported)

        const handleEnterPiP = () => setIsActive(true)
        const handleExitPiP = () => setIsActive(false)

        document.addEventListener("enterpictureinpicture", handleEnterPiP)
        document.addEventListener("exitpictureinpicture", handleExitPiP)

        return () => {
            document.removeEventListener("enterpictureinpicture", handleEnterPiP)
            document.removeEventListener("exitpictureinpicture", handleExitPiP)
        }
    }, [])

    const enterPiP = useCallback(async (videoElement: HTMLVideoElement) => {
        const success = await pipManager.enterPiP(videoElement)
        if (success) {
            setIsActive(true)
        }
        return success
    }, [])

    const exitPiP = useCallback(async () => {
        await pipManager.exitPiP()
        setIsActive(false)
    }, [])

    return { isSupported, isActive, pipWindow, enterPiP, exitPiP }
}

// Picture-in-Picture Button Component
interface PiPButtonProps {
    videoRef: React.RefObject<HTMLVideoElement>
    className?: string
}

export function PiPButton({ videoRef, className = "" }: PiPButtonProps) {
    const { isSupported, isActive, enterPiP, exitPiP } = usePictureInPicture()
    const [error, setError] = useState<string | null>(null)

    const handlePiP = async () => {
        if (!videoRef.current) return

        setError(null)

        if (isActive) {
            await exitPiP()
        } else {
            const success = await enterPiP(videoRef.current)
            if (!success) {
                setError("PiP not supported or denied")
            }
        }
    }

    if (!isSupported) {
        return null
    }

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className={className}
                        onClick={handlePiP}
                    >
                        {isActive ? (
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <rect x="2" y="2" width="20" height="20" rx="2" ry="2" />
                                <line x1="22" y1="2" x2="22" y2="22" />
                                <line x1="2" y1="22" x2="22" y2="22" />
                            </svg>
                        ) : (
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <rect x="2" y="2" width="20" height="20" rx="2" ry="2" />
                                <line x1="22" y1="2" x2="22" y2="22" />
                                <line x1="2" y1="22" x2="22" y2="22" />
                            </svg>
                        )}
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{isActive ? "Exit Picture-in-Picture" : "Enter Picture-in-Picture"}</p>
                </TooltipContent>
            </Tooltip>
            {error && <p className="text-xs text-red-500">{error}</p>}
        </TooltipProvider>
    )
}

// Floating Video Component (for custom PiP-like experience)
interface FloatingVideoProps {
    videoRef: React.RefObject<HTMLVideoElement>
    position?: { x: number; y: number }
    onClose?: () => void
    onDrag?: (x: number, y: number) => void
}

export function FloatingVideo({
    videoRef,
    position = { x: 20, y: 20 },
    onClose,
    onDrag,
}: FloatingVideoProps) {
    const [isDragging, setIsDragging] = useState(false)
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
    const [pos, setPos] = useState(position)

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        setIsDragging(true)
        setDragOffset({
            x: e.clientX - pos.x,
            y: e.clientY - pos.y,
        })
    }, [pos])

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging) return

        const newX = e.clientX - dragOffset.x
        const newY = e.clientY - dragOffset.y

        setPos({ x: newX, y: newY })
        onDrag?.(newX, newY)
    }, [isDragging, dragOffset, onDrag])

    const handleMouseUp = useCallback(() => {
        setIsDragging(false)
    }, [])

    useEffect(() => {
        if (isDragging) {
            window.addEventListener("mousemove", handleMouseMove as any)
            window.addEventListener("mouseup", handleMouseUp)
            return () => {
                window.removeEventListener("mousemove", handleMouseMove as any)
                window.removeEventListener("mouseup", handleMouseUp)
            }
        }
    }, [isDragging, handleMouseMove, handleMouseUp])

    return (
        <div
            className="fixed z-50 rounded-lg overflow-hidden shadow-lg bg-black"
            style={{
                left: pos.x,
                top: pos.y,
                width: "320px",
                height: "180px",
                cursor: isDragging ? "grabbing" : "grab",
            }}
            onMouseDown={handleMouseDown}
        >
            {videoRef.current && (
                <video
                    ref={videoRef}
                    autoPlay
                    muted
                    className="w-full h-full object-cover"
                />
            )}
            {onClose && (
                <button
                    className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
                    onClick={onClose}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            )}
        </div>
    )
}

// Mini Player Component (floating with PiP behavior)
interface MiniPlayerProps {
    videoRef: React.RefObject<HTMLVideoElement>
    isOpen: boolean
    onClose: () => void
}

export function MiniPlayer({ videoRef, isOpen, onClose }: MiniPlayerProps) {
    const [position, setPosition] = useState({ x: 20, y: 20 })

    if (!isOpen) return null

    return (
        <FloatingVideo
            videoRef={videoRef}
            position={position}
            onDrag={(x, y) => setPosition({ x, y })}
            onClose={onClose}
        />
    )
}
