"use client"

import { useState, useEffect, useRef } from "react"
import { database } from "@/lib/firebase"
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
        if (!roomId) return

        const moodRef = ref(database!, `rooms/${roomId}/mood`)
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
                audioRef.current = null
            }
            return
        }

        // Initialize audio if not exists
        if (!audioRef.current) {
            audioRef.current = new Audio()
            audioRef.current.volume = volume
        }

        const audio = audioRef.current

        // Play current song
        const playSong = async (index: number) => {
            if (index >= playlist.length) index = 0 // Loop back

            const src = playlist[index]
            if (audio.src !== src) {
                audio.src = src
                try {
                    await audio.play()
                    setCurrentSongIndex(index)
                } catch (e) {
                    console.error("Auto-play failed (likely interaction needed):", e)
                }
            } else if (audio.paused) {
                audio.play().catch(e => console.error("Play failed:", e))
            }
        }

        // Handle song end -> Next song
        const handleEnded = () => {
            const nextIndex = (currentSongIndex + 1) % playlist.length
            setCurrentSongIndex(nextIndex) // Update state
            playSong(nextIndex)
        }

        audio.addEventListener("ended", handleEnded)

        // Initial play
        playSong(currentSongIndex)

        return () => {
            audio.removeEventListener("ended", handleEnded)
            // Don't pause on cleanup of effect to allow continuous play, 
            // unless component unmounts (handled by parent removal or strict mode)
        }
    }, [playlist, currentSongIndex]) // Dependencies: when playlist updates or index changes

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
