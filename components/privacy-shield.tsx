"use client"

import React, { useEffect, useState, useCallback } from "react"
import { useChatStore } from "@/stores/chat-store"

interface PrivacyShieldProps {
    children: React.ReactNode
    enabled?: boolean
    showWatermark?: boolean
    blurOnFocusLoss?: boolean
}

export function PrivacyShield({
    children,
    enabled = true,
    showWatermark = false,
    blurOnFocusLoss = true,
}: PrivacyShieldProps) {
    const [isBlurred, setIsBlurred] = useState(false)
    const { currentUser } = useChatStore()
    const userName = currentUser?.name || "User"

    const handleVisibilityChange = useCallback(() => {
        if (document.hidden && blurOnFocusLoss) {
            setIsBlurred(true)
        } else {
            setIsBlurred(false)
        }
    }, [blurOnFocusLoss])

    const handleBlur = useCallback(() => {
        if (blurOnFocusLoss) setIsBlurred(true)
    }, [blurOnFocusLoss])

    const handleFocus = useCallback(() => {
        setIsBlurred(false)
    }, [])

    useEffect(() => {
        if (!enabled) return

        const handleKeyDown = (e: KeyboardEvent) => {
            // Block PrintScreen (Some browsers/OS combinations support this)
            if (e.key === "PrintScreen") {
                e.preventDefault()
                alert("Screenshots are restricted for privacy.")
                return false
            }

            // Block Ctrl+P / Cmd+P (Print)
            if ((e.ctrlKey || e.metaKey) && e.key === "p") {
                e.preventDefault()
                return false
            }

            // Block Ctrl+S / Cmd+S (Save)
            if ((e.ctrlKey || e.metaKey) && e.key === "s") {
                e.preventDefault()
                return false
            }

            // Block DevTools shortcuts
            if (e.key === "F12" ||
                ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "I" || e.key === "J" || e.key === "C"))) {
                e.preventDefault()
                return false
            }
        }

        const handleContextMenu = (e: MouseEvent) => {
            e.preventDefault()
        }

        window.addEventListener("keydown", handleKeyDown)
        window.addEventListener("contextmenu", handleContextMenu)
        window.addEventListener("blur", handleBlur)
        window.addEventListener("focus", handleFocus)
        document.addEventListener("visibilitychange", handleVisibilityChange)

        return () => {
            window.removeEventListener("keydown", handleKeyDown)
            window.removeEventListener("contextmenu", handleContextMenu)
            window.removeEventListener("blur", handleBlur)
            window.removeEventListener("focus", handleFocus)
            document.removeEventListener("visibilitychange", handleVisibilityChange)
        }
    }, [enabled, handleBlur, handleFocus, handleVisibilityChange])

    if (!enabled) return <>{children}</>

    return (
        <div className="relative w-full h-full overflow-hidden group/privacy">
            {/* Global CSS for Print Protection */}
            <style jsx global>{`
        @media print {
          body {
            display: none !important;
          }
        }
        .privacy-blur {
          filter: blur(20px);
          transition: filter 0.3s ease;
        }
      `}</style>

            {/* Main Content */}
            <div className={`w-full h-full transition-all duration-300 ${isBlurred ? "privacy-blur pointer-events-none select-none" : ""}`}>
                {children}
            </div>

            {/* Focus Loss Overlay */}
            {isBlurred && (
                <div className="absolute inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-xl transition-all duration-500">
                    <div className="p-8 rounded-2xl bg-slate-800/50 border border-slate-700 shadow-2xl text-center space-y-4 max-w-md animate-in fade-in zoom-in duration-300">
                        <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto">
                            <svg className="w-8 h-8 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-white">Privacy Shield Active</h3>
                        <p className="text-slate-400 text-sm">
                            Content is hidden while you are away to prevent unauthorized capture. Click back into the window to resume.
                        </p>
                        <button
                            onClick={() => setIsBlurred(false)}
                            className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium transition-colors"
                        >
                            Resume Session
                        </button>
                    </div>
                </div>
            )}

            {/* Traceable Watermark Overlay */}
            {showWatermark && !isBlurred && (
                <div className="absolute inset-0 z-[9998] pointer-events-none select-none opacity-[0.03] overflow-hidden whitespace-nowrap rotate-[-30deg] origin-center scale-[2]">
                    {Array.from({ length: 20 }).map((_, i) => (
                        <div key={i} className="flex gap-12 py-8 text-2xl font-bold text-white tracking-widest uppercase">
                            {Array.from({ length: 15 }).map((_, j) => (
                                <span key={j}>{userName} • {new Date().toLocaleDateString()}</span>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
