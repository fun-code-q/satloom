"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import dynamic from "next/dynamic"
import { getFirebaseDatabase } from "@/lib/firebase"
import { ref, onValue } from "firebase/database"
import { NotificationSystem } from "@/utils/core/notification-system"
import { Sparkles, Music } from "lucide-react"
import { toast } from "sonner"

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
  const [currentUrl, setCurrentUrl] = useState<string>("")

  const lastTriggerRef = useRef<number>(0)
  const playerRef = useRef<any>(null)
  const playRequestedRef = useRef(false)
  const suppressPauseEventUntilRef = useRef(0)
  const audioElementRef = useRef<HTMLAudioElement | null>(null)
  const notificationSystem = NotificationSystem.getInstance()

  const BASE_VOLUME = 0.25
  const DUCKED_VOLUME = 0.1

  const extractYouTubeVideoId = (url: string): string | null => {
    try {
      const parsed = new URL(url)
      const host = parsed.hostname.replace(/^www\./, "")
      const isYouTubeHost =
        host === "youtube.com" ||
        host === "m.youtube.com" ||
        host === "music.youtube.com" ||
        host === "youtu.be" ||
        host === "youtube-nocookie.com"

      if (!isYouTubeHost) return null

      const pathname = parsed.pathname
      let candidate = ""

      if (host === "youtu.be") {
        candidate = pathname.split("/").filter(Boolean)[0] || ""
      } else if (pathname.startsWith("/watch")) {
        candidate = parsed.searchParams.get("v") || ""
      } else if (pathname.startsWith("/shorts/")) {
        candidate = pathname.split("/shorts/")[1]?.split(/[/?#&]/)[0] || ""
      } else if (pathname.startsWith("/live/")) {
        candidate = pathname.split("/live/")[1]?.split(/[/?#&]/)[0] || ""
      } else if (pathname.startsWith("/embed/")) {
        candidate = pathname.split("/embed/")[1]?.split(/[/?#&]/)[0] || ""
      } else if (pathname.startsWith("/v/")) {
        candidate = pathname.split("/v/")[1]?.split(/[/?#&]/)[0] || ""
      }

      const validId = candidate.match(/^[A-Za-z0-9_-]{11}$/)?.[0]
      return validId || null
    } catch {
      return null
    }
  }

  const isYouTubeUrl = (url: string): boolean => Boolean(extractYouTubeVideoId(url))

  const normalizeSongUrl = (url: string): string => {
    try {
      const parsed = new URL(url)
      const host = parsed.hostname

      if (host === "archive.org" || host === "www.archive.org") {
        const parts = parsed.pathname.split("/").filter(Boolean)
        if (parts.length >= 3 && parts[0] === "details") {
          const item = parts[1]
          const file = parts.slice(2).join("/")
          return `https://archive.org/download/${item}/${file}`
        }
      }

      const videoId = extractYouTubeVideoId(url)
      if (videoId) {
        return `https://www.youtube.com/watch?v=${videoId}`
      }

      return url
    } catch {
      return url
    }
  }

  const isDirectAudioUrl = (url: string): boolean => {
    return /\.(mp3|wav|ogg|m4a|aac|flac|webm|m3u|m3u8)(\?|#|$)/i.test(url)
  }

  const kickOffEmbeddedPlayback = useCallback(() => {
    try {
      const internalPlayer = playerRef.current?.getInternalPlayer?.()
      if (internalPlayer?.playVideo) {
        internalPlayer.playVideo()
        return
      }
      if (internalPlayer?.play) {
        internalPlayer.play().catch(() => {})
      }
    } catch {
      // Ignore player kick errors; ReactPlayer props still drive playback.
    }
  }, [])

  useEffect(() => {
    const db = getFirebaseDatabase()
    if (!db || !roomId) return

    const moodRef = ref(db, `rooms/${roomId}/mood`)
    const unsubscribe = onValue(moodRef, (snapshot) => {
      const data = snapshot.val()
      if (!data) return

      if (data.playlist && Array.isArray(data.playlist)) {
        setPlaylist((prev) => {
          if (JSON.stringify(prev) !== JSON.stringify(data.playlist)) {
            return data.playlist
          }
          return prev
        })
      } else {
        setPlaylist([])
      }

      if (data.magicSongTrigger && data.playlist?.length > 0 && data.magicSongTrigger !== lastTriggerRef.current) {
        lastTriggerRef.current = data.magicSongTrigger
        setIsPlaying(false)
        setCurrentSongIndex(0)
        setShowMagicPopup(true)
      }
    })

    return () => unsubscribe()
  }, [roomId])

  const currentVolume = isDucked ? DUCKED_VOLUME : BASE_VOLUME

  const handleMagicYes = () => {
    if (playlist.length === 0) {
      toast.error("No songs in playlist. Please add a song first.")
      return
    }

    const songUrl = playlist[currentSongIndex] || playlist[0]
    if (songUrl) {
      const normalizedUrl = normalizeSongUrl(songUrl)
      setCurrentUrl(normalizedUrl)

      const isDirectAudio = isDirectAudioUrl(normalizedUrl)

      if (isDirectAudio && audioElementRef.current) {
        try {
          audioElementRef.current.src = normalizedUrl
          audioElementRef.current.volume = currentVolume
          audioElementRef.current.play().catch(() => {})
        } catch {
          // Ignore direct-audio startup errors here; playback is still driven by state.
        }
      } else {
        kickOffEmbeddedPlayback()
        window.setTimeout(kickOffEmbeddedPlayback, 200)
        window.setTimeout(kickOffEmbeddedPlayback, 800)
      }
    }

    setCurrentSongIndex(0)
    playRequestedRef.current = true
    suppressPauseEventUntilRef.current = Date.now() + 2000
    setIsPlaying(true)
    setShowMagicPopup(false)
    toast.success("Magic is starting!")
  }

  useEffect(() => {
    const audio = audioElementRef.current
    if (!audio) return

    if (currentUrl && isDirectAudioUrl(currentUrl)) {
      if (audio.src !== currentUrl) {
        audio.src = currentUrl
      }
      return
    }

    // Never feed YouTube/webpage URLs into <audio>; it causes CORS failures.
    if (audio.src) {
      audio.pause()
      audio.removeAttribute("src")
      audio.load()
    }
  }, [currentUrl])

  useEffect(() => {
    const unsubscribe = notificationSystem.subscribeToAudioActivity((isActive) => {
      setIsDucked(isActive)
    })
    return () => unsubscribe()
  }, [notificationSystem])

  useEffect(() => {
    return () => {
      setIsPlaying(false)
      if (audioElementRef.current && !audioElementRef.current.paused) {
        audioElementRef.current.pause()
      }
    }
  }, [])

  useEffect(() => {
    if (playlist.length > 0 && playlist[currentSongIndex]) {
      setCurrentUrl(normalizeSongUrl(playlist[currentSongIndex]))
    } else if (playlist.length > 0) {
      setCurrentUrl(normalizeSongUrl(playlist[0]))
    }
  }, [playlist, currentSongIndex])

  const handlePlayerEnded = () => {
    if (!playlist || playlist.length === 0) return
    const nextIndex = (currentSongIndex + 1) % playlist.length
    setCurrentSongIndex(nextIndex)
  }

  const getPlayerUrl = () => {
    let url = ""
    if (currentUrl) {
      url = currentUrl
    } else if (playlist.length > 0 && playlist[currentSongIndex]) {
      url = playlist[currentSongIndex]
    } else if (playlist.length > 0) {
      url = playlist[0]
    }
    return normalizeSongUrl(url)
  }

  const playerUrl = getPlayerUrl()
  const useNativeAudio = isDirectAudioUrl(playerUrl)
  const isEmbeddedYouTube = isYouTubeUrl(playerUrl)

  useEffect(() => {
    const audio = audioElementRef.current
    if (!audio) return

    audio.volume = currentVolume

    if (useNativeAudio) {
      if (audio.src !== playerUrl) {
        audio.src = playerUrl
      }
      if (isPlaying) {
        audio.play().catch(() => {})
      } else if (!audio.paused) {
        audio.pause()
      }
    } else if (!audio.paused) {
      audio.pause()
    }
  }, [playerUrl, useNativeAudio, isPlaying, currentVolume])

  useEffect(() => {
    if (!isPlaying || useNativeAudio || !playerUrl) return

    kickOffEmbeddedPlayback()
    const retryTimers = [150, 500, 1200].map((delay) => window.setTimeout(kickOffEmbeddedPlayback, delay))

    return () => {
      retryTimers.forEach((timerId) => window.clearTimeout(timerId))
    }
  }, [isPlaying, useNativeAudio, playerUrl, kickOffEmbeddedPlayback])

  return (
    <>
      {playlist.length > 0 && (
        <div className="fixed bottom-0 right-0 w-px h-px pointer-events-none z-[-1] opacity-0 overflow-hidden" aria-hidden="true">
          <ReactPlayer
            key="mood-player-stable"
            ref={playerRef}
            {...({
              url: playerUrl,
              playing: isPlaying && !useNativeAudio,
              volume: currentVolume,
              width: "100%",
              height: "100%",
              playsinline: true,
              muted: false,
              onEnded: handlePlayerEnded,
              onPlay: () => setIsPlaying(true),
              onPause: () => {
                if (Date.now() < suppressPauseEventUntilRef.current) {
                  return
                }
                if (!showMagicPopup) {
                  setIsPlaying(false)
                }
              },
              onError: (error: any) => {
                console.error("MoodPlayer Error:", error)
                toast.error("Failed to play the song. Please check the URL.")
                if (audioElementRef.current && useNativeAudio) {
                  audioElementRef.current.play().catch(() => {})
                }
              },
              onReady: () => {
                if (playRequestedRef.current) {
                  setIsPlaying(true)
                  if (!useNativeAudio) {
                    kickOffEmbeddedPlayback()
                  }
                  playRequestedRef.current = false
                }
              },
              config: {
                file: {
                  attributes: {
                    crossOrigin: "anonymous",
                  },
                },
                youtube: {
                  playerVars: {
                    autoplay: 1,
                    controls: 0,
                    rel: 0,
                    modestbranding: 1,
                    playsinline: 1,
                    iv_load_policy: 3,
                    enablejsapi: 1,
                    mute: 0,
                    origin: typeof window !== "undefined" ? window.location.origin : "",
                  },
                },
              },
            } as any)}
          />
        </div>
      )}

      {playlist.length > 0 && (
        <audio
          ref={audioElementRef}
          className="fixed top-[-200px] left-[-200px] w-10 h-10 pointer-events-none z-[-2] overflow-hidden"
          aria-hidden="true"
          preload="auto"
          crossOrigin="anonymous"
        />
      )}

      {showMagicPopup && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 border border-purple-500/30 rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl shadow-purple-900/50 text-center overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-1 h-1 bg-purple-400/60 rounded-full animate-ping"
                  style={{
                    left: `${10 + (i * 8) % 90}%`,
                    top: `${5 + (i * 11) % 90}%`,
                    animationDelay: `${i * 0.3}s`,
                    animationDuration: `${1.5 + (i % 3) * 0.5}s`,
                  }}
                />
              ))}
            </div>

            <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/40 relative">
              <Sparkles className="w-9 h-9 text-white animate-pulse" />
              <div className="absolute -right-1 -bottom-1 w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-orange-400 flex items-center justify-center">
                <Music className="w-4 h-4 text-white" />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Want to see magic?</h2>
            <p className="text-sm text-purple-300/80 mb-7 leading-relaxed">
              The room mood has been set.
              <br />
              Click below to feel the vibe.
            </p>

            <button
              onClick={handleMagicYes}
              className="w-full py-3.5 px-8 rounded-2xl font-bold text-white text-lg bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 hover:from-purple-600 hover:via-pink-600 hover:to-orange-500 shadow-lg shadow-purple-500/40 transition-all duration-200 hover:scale-105 active:scale-95"
            >
              Yes
            </button>
            {isEmbeddedYouTube && <p className="mt-3 text-[11px] text-purple-200/70">YouTube audio will continue in the background.</p>}
          </div>
        </div>
      )}
    </>
  )
}
