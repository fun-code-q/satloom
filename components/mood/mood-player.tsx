"use client"

import { useState, useEffect, useRef } from "react"
import { getFirebaseDatabase } from "@/lib/firebase"
import { ref, onValue } from "firebase/database"
import { NotificationSystem } from "@/utils/core/notification-system"
import { Sparkles, Music } from "lucide-react"
import { toast } from "sonner"

interface MoodPlayerProps {
    roomId: string
}

export function MoodPlayer({ roomId }: MoodPlayerProps) {
    const [playlist, setPlaylist] = useState<string[]>([])
    const [currentSongIndex, setCurrentSongIndex] = useState(0)
    const [showMagicPopup, setShowMagicPopup] = useState(false)
    const [isPlaying, setIsPlaying] = useState(false)

    const BASE_VOLUME = 0.35 // 35% as requested
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const lastTriggerRef = useRef<number>(0)
    const notificationSystem = NotificationSystem.getInstance()

    // 1. Listen to Firebase for Mood changes & magic trigger
    useEffect(() => {
        const db = getFirebaseDatabase()
        if (!db || !roomId) return

        const moodRef = ref(db, `rooms/${roomId}/mood`)
        const unsubscribe = onValue(moodRef, (snapshot) => {
            const data = snapshot.val()
            if (!data) return

            // Update playlist
            if (data.playlist && Array.isArray(data.playlist)) {
                setPlaylist(prev => {
                    if (JSON.stringify(prev) !== JSON.stringify(data.playlist)) {
                        return data.playlist
                    }
                    return prev
                })
            } else {
                setPlaylist([])
            }

            // Check for magic song trigger — only fires if it's a NEW trigger timestamp
            if (
                data.magicSongTrigger &&
                data.playlist?.length > 0 &&
                data.magicSongTrigger !== lastTriggerRef.current
            ) {
                lastTriggerRef.current = data.magicSongTrigger
                // Stop any existing audio first
                if (audioRef.current) {
                    audioRef.current.pause()
                    audioRef.current.src = ""
                }
                setIsPlaying(false)
                setCurrentSongIndex(0)
                // Show the magic popup to everyone in the room
                setShowMagicPopup(true)
            }
        })

        return () => unsubscribe()
    }, [roomId])

    // 2. Handle magic popup "Yes" button — plays song at 35% volume
    const handleMagicYes = async () => {
        setShowMagicPopup(false)
        if (!playlist || playlist.length === 0) return

        if (!audioRef.current) {
            audioRef.current = new Audio()
        }

        const audio = audioRef.current
        audio.volume = BASE_VOLUME
        audio.src = playlist[0]
        audio.load()

        try {
            console.log("MoodPlayer: Attempting to play magic song:", playlist[0])
            await audio.play()
            setIsPlaying(true)
            setCurrentSongIndex(0)
            toast.success("Magic is starting! 🎶")
        } catch (e) {
            console.error("MoodPlayer: Autoplay blocked or failed:", e)
            toast.error("Audio playback failed. Please check your browser permissions.")
        }
    }

    // 3. Audio playlist logic (next song on end)
    useEffect(() => {
        if (!audioRef.current || !isPlaying) return

        const audio = audioRef.current
        const handleEnded = () => {
            if (!playlist || playlist.length === 0) return
            const nextIndex = (currentSongIndex + 1) % playlist.length
            const nextSrc = playlist[nextIndex]
            audio.src = nextSrc
            audio.volume = BASE_VOLUME
            audio.load()
            audio.play().catch(e => console.log("MoodPlayer next song error:", e))
            setCurrentSongIndex(nextIndex)
        }

        audio.addEventListener("ended", handleEnded)
        return () => audio.removeEventListener("ended", handleEnded)
    }, [playlist, currentSongIndex, isPlaying])

    // 4. Volume Ducking Logic — duck to 10% during notification sounds, restore to 35%
    useEffect(() => {
        const unsubscribe = notificationSystem.subscribeToAudioActivity((isActive) => {
            if (!audioRef.current) return
            audioRef.current.volume = isActive ? 0.1 : BASE_VOLUME
        })
        return () => unsubscribe()
    }, [])

    // 5. Cleanup on unmount
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause()
                audioRef.current = null
            }
        }
    }, [])

    // Magic popup — shown to all users in the room when a song mood is set
    if (showMagicPopup) {
        return (
            <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
                <div className="relative bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 border border-purple-500/30 rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl shadow-purple-900/50 text-center overflow-hidden">
                    {/* Animated sparkle bg */}
                    <div className="absolute inset-0 pointer-events-none">
                        {[...Array(12)].map((_, i) => (
                            <div
                                key={i}
                                className="absolute w-1 h-1 bg-purple-400/60 rounded-full animate-ping"
                                style={{
                                    left: `${10 + (i * 8) % 90}%`,
                                    top: `${5 + (i * 11) % 90}%`,
                                    animationDelay: `${i * 0.3}s`,
                                    animationDuration: `${1.5 + (i % 3) * 0.5}s`
                                }}
                            />
                        ))}
                    </div>

                    {/* Icon */}
                    <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/40 relative">
                        <Sparkles className="w-9 h-9 text-white animate-pulse" />
                        <div className="absolute -right-1 -bottom-1 w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-orange-400 flex items-center justify-center">
                            <Music className="w-4 h-4 text-white" />
                        </div>
                    </div>

                    {/* Text */}
                    <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">
                        ✨ Want to see a magic?
                    </h2>
                    <p className="text-sm text-purple-300/80 mb-7 leading-relaxed">
                        The room mood has been set.<br />Click below to feel the vibe.
                    </p>

                    {/* Single Yes button */}
                    <button
                        onClick={handleMagicYes}
                        className="w-full py-3.5 px-8 rounded-2xl font-bold text-white text-lg bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 hover:from-purple-600 hover:via-pink-600 hover:to-orange-500 shadow-lg shadow-purple-500/40 transition-all duration-200 hover:scale-105 active:scale-95"
                    >
                        Yes ✨
                    </button>
                </div>
            </div>
        )
    }

    return null // Invisible during playback
}
