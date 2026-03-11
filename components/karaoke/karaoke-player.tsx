"use client"

import React, { useEffect, useState } from "react"
import { karaokeManager, type KaraokeSession, type KaraokeSong } from "@/utils/games/karaoke"
import { Button } from "@/components/ui/button"
import { Pause, Play, Mic, X, Volume2, VolumeX, Minimize2 } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import dynamic from "next/dynamic"

const ReactPlayer = dynamic(() => import("react-player"), { ssr: false })

interface KaraokePlayerProps {
    session: KaraokeSession
    onEnd: () => void
    onMinimize: () => void
}

export function KaraokePlayer({ session, onEnd, onMinimize }: KaraokePlayerProps) {
    const [isPlaying, setIsPlaying] = useState(session.status === "playing")
    const [isMuted, setIsMuted] = useState(false)
    const [lyrics, setLyrics] = useState<{ current: any; next: any; progress: number }>({
        current: null,
        next: null,
        progress: 0,
    })
    const [playbackRate, setPlaybackRate] = useState(1.0)
    const [currentTime, setCurrentTime] = useState(session.currentTime)
    const isHost = session.hostId === karaokeManager.getState().currentPlayer || session.hostId === (window as any).userId // Fallback check

    useEffect(() => {
        const unsubscribe = karaokeManager.subscribe((state) => {
            setIsPlaying(state.isSinging)
            setCurrentTime(state.currentTime)

            // Fluid Catch-up logic for clients
            if (!isHost && state.session && state.session.status === "playing") {
                const drift = (state.session.currentTime - state.currentTime) / 1000 // drift in seconds

                if (Math.abs(drift) > 2) {
                    // Large drift - hard sync (karaokeManager does this internally too)
                    setPlaybackRate(1.0)
                } else if (drift > 0.3) {
                    setPlaybackRate(1.05) // Speed up slightly
                } else if (drift < -0.3) {
                    setPlaybackRate(0.95) // Slow down slightly
                } else {
                    setPlaybackRate(1.0)
                }
            } else {
                setPlaybackRate(1.0)
            }

            setLyrics(karaokeManager.getCurrentLyrics())
        })

        if (session.status === "playing") {
            karaokeManager.startTimeSync()
        }

        return () => unsubscribe()
    }, [session, isHost])

    const handleTogglePlay = async () => {
        if (isPlaying) {
            await karaokeManager.pauseSession()
        } else {
            await karaokeManager.resumeSession()
        }
    }

    const handleEndSession = async () => {
        if (isHost) {
            await karaokeManager.endSession()
        }
        onEnd()
    }

    const handleProgress = (state: { playedSeconds: number }) => {
        if (isHost && isPlaying) {
            const currentTime = Math.floor(state.playedSeconds * 1000)
            // The karaokeManager.startTimeSync already updates Firebase, 
            // but we can ensure the ReactPlayer progress is the source of truth for the host
            const db = (window as any).firebaseDb || null // Assuming it's exposed or accessible
            // Since karaokeManager is a singleton, it handles the sync
        }
    }

    const formatTime = (ms: number) => {
        const minutes = Math.floor(ms / 60000)
        const seconds = Math.floor((ms % 60000) / 1000)
        return `${minutes}:${seconds.toString().padStart(2, "0")}`
    }

    const song = session.song
    if (!song) return null

    const progress = song.duration > 0 ? (session.currentTime / song.duration) * 100 : 0

    return (
        <div className="fixed inset-0 bg-[#020617] z-[510] flex flex-col overflow-hidden">
            {/* Stage Visual Effects */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full animate-pulse delay-700" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gradient-to-b from-transparent via-primary/5 to-transparent opacity-50" />

                {/* Simulated Spotlights */}
                <div className="absolute top-0 left-1/4 w-[1px] h-full bg-gradient-to-b from-white/20 to-transparent rotate-[-15deg] blur-sm animate-pulse" />
                <div className="absolute top-0 right-1/4 w-[1px] h-full bg-gradient-to-b from-white/20 to-transparent rotate-[15deg] blur-sm animate-pulse delay-1000" />
            </div>

            <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center justify-between p-6 backdrop-blur-md bg-white/5 border-b border-white/10">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-cyan-600 flex items-center justify-center shadow-lg shadow-cyan-600/20">
                            <Mic className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h2 className="font-bold text-white text-xl tracking-tight">{song.title}</h2>
                            <div className="flex items-center gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                                <p className="text-sm text-white/40 font-medium uppercase tracking-widest">{song.artist}</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="px-3 py-1 bg-white/5 rounded-full border border-white/10 flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-primary" />
                            <span className="text-xs font-bold text-white/60 tracking-wider">LIVE</span>
                        </div>
                        <Button variant="ghost" size="icon" onClick={onMinimize} className="text-white/40 hover:text-white hover:bg-white/10 rounded-full">
                            <Minimize2 className="h-6 w-6" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={handleEndSession} className="text-white/40 hover:text-white hover:bg-white/10 rounded-full">
                            <X className="h-6 w-6" />
                        </Button>
                    </div>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
                    {/* Next lyrics */}
                    {lyrics.next && (
                        <div className="absolute top-[20%] text-center animate-in fade-in slide-in-from-bottom-2 duration-700">
                            <p className="text-white/20 text-xl font-medium tracking-wide italic">
                                Next: {lyrics.next.text}
                            </p>
                        </div>
                    )}

                    {/* Current lyrics */}
                    <div className="text-center max-w-4xl px-4">
                        {lyrics.current ? (
                            <div className="space-y-12 transition-all duration-500">
                                <p className="text-5xl md:text-7xl font-black text-white leading-tight tracking-tighter animate-in zoom-in-95 fade-in duration-300 drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                                    {lyrics.current.text}
                                </p>

                                {/* Line progress indicator */}
                                <div className="relative h-2 w-64 mx-auto rounded-full bg-white/5 overflow-hidden border border-white/10">
                                    <div
                                        className="absolute inset-y-0 left-0 bg-cyan-500 transition-all duration-300 ease-linear shadow-[0_0_15px_rgba(6,182,212,0.5)]"
                                        style={{ width: `${lyrics.progress}%` }}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6 animate-pulse">
                                <p className="text-5xl md:text-6xl font-black text-white/10 uppercase tracking-[0.2em]">
                                    Prepare
                                </p>
                                <div className="flex items-center justify-center gap-2">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="h-3 w-3 rounded-full bg-primary/20" />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="px-8 pb-4">
                    <div className="relative h-1.5 w-full bg-white/5 rounded-full overflow-hidden mb-2">
                        <div
                            className="absolute inset-y-0 left-0 bg-primary/40 transition-all duration-500"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-[10px] font-black text-white/30 tracking-widest px-1 uppercase">
                        <span>{formatTime(currentTime)}</span>
                        <span className="text-primary/40">Total Session {playbackRate !== 1.0 && `(Syncing ${playbackRate}x)`}</span>
                        <span>{formatTime(song.duration)}</span>
                    </div>
                </div>

                {/* Controls */}
                <div className="p-8 backdrop-blur-2xl bg-white/5 border-t border-white/10">
                    <div className="flex items-center justify-between max-w-2xl mx-auto">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsMuted(!isMuted)}
                            className="h-12 w-12 rounded-2xl bg-white/5 hover:bg-white/10 text-white/60"
                        >
                            {isMuted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
                        </Button>

                        <button
                            className="h-20 w-20 flex items-center justify-center rounded-[32px] bg-cyan-600 hover:bg-cyan-500 text-white shadow-2xl shadow-cyan-600/40 transition-transform active:scale-95 outline-none"
                            onClick={handleTogglePlay}
                            disabled={!isHost && session.status !== "playing"}
                        >
                            {isPlaying ? (
                                <Pause className="h-8 w-8 fill-current" />
                            ) : (
                                <Play className="h-8 w-8 ml-1 fill-current" />
                            )}
                        </button>

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleEndSession}
                            className="h-12 w-12 rounded-2xl bg-white/5 hover:bg-red-500/20 text-white/60 hover:text-red-400 border border-transparent hover:border-red-500/30"
                        >
                            <X className="h-6 w-6" />
                        </Button>
                    </div>
                </div>
            </div>

            {song.audioUrl && (
                <div className="hidden">
                    <ReactPlayer
                        {...({
                            url: song.audioUrl,
                            playing: isPlaying,
                            volume: isMuted ? 0 : 1,
                            playbackRate: playbackRate,
                            onProgress: handleProgress,
                            onEnded: handleEndSession,
                            config: {
                                youtube: {
                                    playerVars: { showinfo: 0, controls: 0, modestbranding: 1 }
                                }
                            }
                        } as any)}
                    />
                </div>
            )}
        </div>
    )
}
