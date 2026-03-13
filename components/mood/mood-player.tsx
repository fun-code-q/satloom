"use client"

import { useState, useEffect, useRef } from "react"
import dynamic from "next/dynamic"
import { getFirebaseDatabase } from "@/lib/firebase"
import { ref, onValue } from "firebase/database"
import { NotificationSystem } from "@/utils/core/notification-system"
import { Sparkles, Music } from "lucide-react"
import { toast } from "sonner"

// Dynamic import for react-player (client-side only)
const ReactPlayer = dynamic(() => import("react-player"), { ssr: false })

interface MoodPlayerProps {
    roomId: string
}

export function MoodPlayer({ roomId }: MoodPlayerProps) {
    const [playlist, setPlaylist] = useState<string[]>([])
    const [currentSongIndex, setCurrentSongIndex] = useState(0)
    const [showMagicPopup, setShowMagicPopup] = useState(false)
    const [isPlaying, setIsPlaying] = useState(false)
    const [isDucked, setIsDucked] = useState(false)
    const [playerReady, setPlayerReady] = useState(false)
    const [currentUrl, setCurrentUrl] = useState<string>("")
    const [lastTrigger, setLastTrigger] = useState<number>(0)
    const [backupUrl, setBackupUrl] = useState<string>("")

    // Refs
    const lastTriggerRef = useRef<number>(0)
    const playerRef = useRef<any>(null)
    const playRequestedRef = useRef(false)
    const audioElementRef = useRef<HTMLAudioElement | null>(null)
    const notificationSystem = NotificationSystem.getInstance()

    const BASE_VOLUME = 0.35 // 35% as requested
    const DUCKED_VOLUME = 0.10 // 10% during notifications

    // Helper function to get proxied URL if needed for CORS
    const getProxiedUrlIfNeeded = (url: string): string => {
        try {
            const parsed = new URL(url)
            // List of domains that we know require a proxy (due to CORS restrictions)
            const proxyDomains = ['archive.org', 'www.archive.org']
            if (proxyDomains.includes(parsed.hostname)) {
                // We assume the proxy is at `/api/audio-proxy`
                return `${window.location.origin}/api/audio-proxy?url=${encodeURIComponent(url)}`
            }
            return url
        } catch {
            return url
        }
    }

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
                setLastTrigger(data.magicSongTrigger)
                setIsPlaying(false)
                setCurrentSongIndex(0)
                // Show the magic popup to everyone in the room
                setShowMagicPopup(true)
            }
        })

        return () => unsubscribe()
    }, [roomId])

    // 2. Handle magic popup "Yes" button — plays song at 35% volume using react-player with backup
    const handleMagicYes = () => {
        // Get the current playlist from Firebase state before closing popup
        if (playlist.length === 0) {
            toast.error("No songs in playlist. Please add a song first.")
            return
        }

        // Always start from the first song when magic mood is activated
        const songUrl = playlist[0]
        if (songUrl) {
            setCurrentUrl(songUrl)
            // Set the backup URL with proxy if needed
            setBackupUrl(getProxiedUrlIfNeeded(songUrl))
        }

        setCurrentSongIndex(0)

        setShowMagicPopup(false)

        // Start playback immediately on user gesture to satisfy autoplay policies
        playRequestedRef.current = true
        setIsPlaying(true)
        toast.success("Magic is starting! 🎶")
    }

    // 3. Update the backup audio element's src when backupUrl changes
    useEffect(() => {
        if (audioElementRef.current && backupUrl) {
            audioElementRef.current.src = backupUrl
        }
    }, [backupUrl])

    // 4. Audio playlist logic (next song on end)
    // Playlist continues automatically via react-player's onEnded callback

    // 5. Volume Ducking Logic — duck to 10% during notification sounds, restore to 35%
    useEffect(() => {
        const unsubscribe = notificationSystem.subscribeToAudioActivity((isActive) => {
            setIsDucked(isActive)
        })
        return () => unsubscribe()
    }, [notificationSystem])

    // 6. Cleanup on unmount
    useEffect(() => {
        return () => {
            setIsPlaying(false)
            // Pause backup audio element
            if (audioElementRef.current && !audioElementRef.current.paused) {
                audioElementRef.current.pause()
            }
        }
    }, [])

    // 7. Sync current URL when playlist or index changes
    useEffect(() => {
        if (playlist.length > 0 && playlist[currentSongIndex]) {
            setCurrentUrl(playlist[currentSongIndex])
        } else if (playlist.length > 0) {
            setCurrentUrl(playlist[0])
        }
    }, [playlist, currentSongIndex])

    // Handle when current song ends - play next song in playlist
    const handlePlayerEnded = () => {
        if (!playlist || playlist.length === 0) return
        const nextIndex = (currentSongIndex + 1) % playlist.length
        setCurrentSongIndex(nextIndex)
    }

    const currentVolume = isDucked ? DUCKED_VOLUME : BASE_VOLUME

    // Get the current URL to play (with proxy if needed)
    const getPlayerUrl = () => {
        let url = ""
        if (currentUrl) {
            url = currentUrl
        } else if (playlist.length > 0 && playlist[currentSongIndex]) {
            url = playlist[currentSongIndex]
        } else if (playlist.length > 0) {
            url = playlist[0]
        }
        return getProxiedUrlIfNeeded(url)
    }

    return (
        <>
            {/* Unified ReactPlayer - Always mounted to prevent playback drops */}
            {/* Use stable key to prevent unnecessary remounting */}
            {playlist.length > 0 && (
                <div
                    className="fixed top-[-100px] left-[-100px] w-16 h-16 pointer-events-none z-[-1] overflow-hidden"
                    aria-hidden="true"
                >
                    <ReactPlayer
                        key="mood-player-stable"
                        ref={playerRef}
                        {...({
                            url: getPlayerUrl(),
                            playing: isPlaying,
                            volume: currentVolume,
                            width: "100%",
                            height: "100%",
                            playsinline: true,
                            muted: false,
                            onEnded: handlePlayerEnded,
                            onError: (e: any) => {
                                console.error("MoodPlayer Error:", e)
                                toast.error("Failed to play the song. Please check the URL.")
                                // Try backup audio player if ReactPlayer fails
                                if (audioElementRef.current) {
                                    audioElementRef.current.play().catch((err) => {
                                        console.warn("Backup audio player also failed:", err)
                                        toast.error("Both primary and backup players failed to play the audio.")
                                    })
                                }
                            },
                            onReady: () => {
                                console.log("MoodPlayer Ready")
                                setPlayerReady(true)
                                if (playRequestedRef.current) {
                                    setIsPlaying(true)
                                    // Reset the play request flag
                                    playRequestedRef.current = false
                                }
                            },
                            config: {
                                youtube: {
                                    playerVars: {
                                        showinfo: 0,
                                        controls: 0,
                                        modestbranding: 1,
                                        rel: 0,
                                        origin: typeof window !== 'undefined' ? window.location.origin : ''
                                    }
                                }
                            }
                        } as any)}
                    />
                </div>
            )}

            {/* Backup HTML5 Audio Player - hidden off-screen */}
            {playlist.length > 0 && (
                <audio
                    ref={audioElementRef}
                    className="fixed top-[-200px] left-[-200px] w-10 h-10 pointer-events-none z-[-2] overflow-hidden"
                    aria-hidden="true"
                    preload="auto"
                />
            )}

            {/* Magic popup — shown to all users in the room when a song mood is set */}
            {showMagicPopup && (
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
            )}
        </>
    )
}
