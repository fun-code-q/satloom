"use client"

import { useState, useEffect, useRef } from "react"
import { getFirebaseDatabase } from "@/lib/firebase"
import { ref, onValue } from "firebase/database"
import { NotificationSystem } from "@/utils/core/notification-system"

interface MoodPlayerProps {
    roomId: string
}

export function MoodPlayer({ roomId }: MoodPlayerProps) {
    const [playlist, setPlaylist] = useState<string[]>([])
    const [currentSongIndex, setCurrentSongIndex] = useState(0)
    const [volume, setVolume] = useState(0.5) // Base volume

    const audioRef = useRef<HTMLAudioElement | null>(null)
    const notificationSystem = NotificationSystem.getInstance()

    // 1. Listen to Firebase for Mood changes
    useEffect(() => {
        const db = getFirebaseDatabase()
        if (!db || !roomId) return

        const moodRef = ref(db, `rooms/${roomId}/mood`)
        const unsubscribe = onValue(moodRef, (snapshot) => {
            const data = snapshot.val()
            if (data && data.playlist && Array.isArray(data.playlist)) {
                // Create a new array reference to trigger re-renders only if content changed
                const newPlaylist = data.playlist

                // Check if playlist actually changed to avoid resetting song
                setPlaylist(prev => {
                    if (JSON.stringify(prev) !== JSON.stringify(newPlaylist)) {
                        return newPlaylist
                    }
                    return prev
                })
            } else {
                setPlaylist([])
            }
        })

        return () => unsubscribe()
    }, [roomId])

    // 2. Audio Element Setup and Playlist Logic
    useEffect(() => {
        if (!playlist || playlist.length === 0) {
            if (audioRef.current) {
                audioRef.current.pause()
                audioRef.current.src = ""
                audioRef.current = null
            }
            return
        }

        if (!audioRef.current) {
            audioRef.current = new Audio()
            audioRef.current.volume = volume
        }

        const audio = audioRef.current

        const playSong = async (index: number) => {
            if (index < 0 || index >= playlist.length) index = 0

            const src = playlist[index]
            if (audio.src !== src) {
                console.log("MoodPlayer: Playing song:", src)
                audio.src = src
                audio.load() // Explicitly load
            }

            try {
                await audio.play()
                setCurrentSongIndex(index)
            } catch (e) {
                console.log("MoodPlayer: Auto-play blocked, waiting for interaction...")

                // Use a named handler so we can properly remove it after success
                const unlockAudio = async () => {
                    try {
                        await audio.play()
                        setCurrentSongIndex(index)
                        console.log("MoodPlayer: Unlocked and playing via user interaction")
                        // Remove from all sources after successful play
                        window.removeEventListener("click", unlockAudio, { capture: true })
                        window.removeEventListener("touchstart", unlockAudio, { capture: true })
                        document.removeEventListener("click", unlockAudio, { capture: true })
                    } catch (err) {
                        console.error("MoodPlayer: Manual play failed:", err)
                    }
                }

                // Add to both window and document at capture phase for broadest coverage
                window.addEventListener("click", unlockAudio, { capture: true, once: false })
                window.addEventListener("touchstart", unlockAudio, { capture: true, once: false })
                document.addEventListener("click", unlockAudio, { capture: true, once: false })
            }
        }

        const handleEnded = () => {
            const nextIndex = (currentSongIndex + 1) % playlist.length
            playSong(nextIndex)
        }

        audio.addEventListener("ended", handleEnded)

        // Only trigger play if paused or source changed
        if (audio.paused || audio.src !== playlist[currentSongIndex]) {
            playSong(currentSongIndex)
        }

        return () => {
            audio.removeEventListener("ended", handleEnded)
        }
    }, [playlist, currentSongIndex])


    // 3. Volume Ducking Logic
    useEffect(() => {
        // Subscribe to notification system audio events
        const unsubscribe = notificationSystem.subscribeToAudioActivity((isActive) => {
            if (!audioRef.current) return

            if (isActive) {
                // Duck volume
                audioRef.current.volume = 0.1 // Low volume
            } else {
                // Restore volume
                audioRef.current.volume = 0.5 // Base volume
            }
        })

        return () => {
            unsubscribe()
        }
    }, [])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause()
                audioRef.current = null
            }
        }
    }, [])

    return null // Invisible component
}
