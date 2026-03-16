"use client"

import { useEffect, useState, useCallback } from "react"
import { Volume2, VolumeX, Keyboard } from "lucide-react"
import { createPortal } from "react-dom"
import { soundboard, DEFAULT_SOUNDS, SoundboardState } from "@/utils/games/soundboard"

interface SoundboardProps {
    isOpen: boolean
    onClose: () => void
    roomId: string
    userId: string
    userName: string
}

export function Soundboard({ isOpen, onClose, roomId, userId, userName }: SoundboardProps) {
    const [soundState, setSoundState] = useState<SoundboardState>(() => ({
        isPlaying: false,
        currentSound: null,
        volume: soundboard.getVolume(),
    }))
    const [showHotkeys, setShowHotkeys] = useState(false)

    useEffect(() => {
        if (isOpen) {
            // Initialize soundboard to preload actual MP3 files
            soundboard.initialize(roomId, userId, userName)

            const unsubState = soundboard.subscribe((state) => {
                setSoundState(state)
            })

            return () => {
                unsubState()
            }
        }
    }, [isOpen])

    const handlePlaySound = useCallback(
        async (soundId: string) => {
            // Browsers require a user interaction to resume AudioContext
            try {
                const ctx = (soundboard as any).audioContext as AudioContext | null
                if (ctx && ctx.state === 'suspended') {
                    await ctx.resume()
                }
            } catch (e) {
                console.error("Failed to resume AudioContext:", e)
            }

            await soundboard.playSound(soundId)
        },
        [soundboard]
    )

    const handleVolumeChange = useCallback(
        (volume: number) => {
            soundboard.setVolume(volume)
        },
        [soundboard]
    )

    if (!isOpen) return null

    return createPortal(
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-[99998] bg-black/20" onClick={onClose} />

            {/* Popup */}
            <div
                className="fixed bottom-24 md:bottom-20 right-4 md:right-8 z-[99999] bg-white/5 backdrop-blur-[20px] border border-white/10 rounded-2xl p-3 md:p-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] w-[280px] md:w-[320px] max-h-[70vh] flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300 ring-1 ring-white/5"
                onClick={(e) => e.stopPropagation()}
            >

                {/* Header controls hidden as per user request */}
                <div className="hidden">
                    {/* ... (Keeping volume logic but visually hidden as per previous request) */}
                </div>

                {/* Sound Grid - 4x2 Layout */}
                <div className="grid grid-cols-4 gap-2 py-1.5 overflow-y-auto custom-scrollbar pr-1">
                    {DEFAULT_SOUNDS.slice(0, 8).map((sound) => (
                        <button
                            key={sound.id}
                            onClick={() => handlePlaySound(sound.id)}
                            disabled={soundState.isPlaying && soundState.currentSound === sound.id}
                            className={`
                relative flex flex-col items-center justify-center p-2 h-14 md:h-16 rounded-xl transition-all duration-300
                ${soundState.currentSound === sound.id 
                    ? "bg-white/20 ring-2 ring-white/50 scale-105" 
                    : "bg-white/[0.03] hover:bg-white/[0.08] hover:scale-105 active:scale-95 border border-white/5"}
              `}
                        >
                            <span className="text-xl md:text-2xl mb-1 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">{sound.icon}</span>
                            <span className="text-[8px] md:text-[9px] font-bold text-white/90 truncate w-full text-center leading-tight tracking-tight uppercase">{sound.name}</span>
                            
                            {soundState.currentSound === sound.id && (
                                <div className="absolute inset-x-1 bottom-1 h-0.5 bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(34,211,238,0.8)] animate-pulse" />
                            )}
                            
                            {/* Subtle Glass Highlight */}
                            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl pointer-events-none" />
                        </button>
                    ))}
                </div>


            </div>
        </>,
        document.body
    )
}
