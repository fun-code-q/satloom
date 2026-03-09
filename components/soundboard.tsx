"use client"

import { useEffect, useState, useCallback } from "react"
import { Volume2, VolumeX, Keyboard } from "lucide-react"
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
            soundboard.initialize(roomId, userId, userName)
            const unsubHotkeys = soundboard.setupHotkeys()

            const unsubState = soundboard.subscribe((state) => {
                setSoundState(state)
            })

            return () => {
                unsubState()
                unsubHotkeys()
            }
        }
    }, [isOpen, roomId, userId, userName])

    const handlePlaySound = useCallback(
        async (soundId: string) => {
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

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40" onClick={onClose} />

            {/* Popup */}
            <div
                className="fixed bottom-20 right-8 z-50 bg-slate-800/95 backdrop-blur-md border border-slate-600 rounded-3xl p-5 shadow-2xl w-[410px] flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300"
                onClick={(e) => e.stopPropagation()}
            >

                <div className="flex items-center justify-between gap-4 px-4 py-3 bg-slate-700/40 rounded-2xl border border-slate-600/30">
                    <div className="flex items-center gap-2">
                        {soundState.volume > 0 ? (
                            <Volume2 className="w-5 h-5 text-cyan-400" />
                        ) : (
                            <VolumeX className="w-5 h-5 text-red-400" />
                        )}
                        <span className="text-sm text-gray-300">Volume</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={soundState.volume}
                        onInput={(e) => handleVolumeChange(parseFloat((e.target as HTMLInputElement).value))}
                        className="w-32 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-cyan-400 w-9 text-right tabular-nums">
                            {Math.round(soundState.volume * 100)}%
                        </span>
                        <div className="w-px h-5 bg-slate-600/50 mx-1"></div>
                        <button
                            onClick={() => setShowHotkeys(!showHotkeys)}
                            className={`p-2 rounded-xl transition-all ${showHotkeys ? 'bg-cyan-500/20 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.2)]' : 'text-gray-400 hover:text-gray-300 hover:bg-slate-700/60'}`}
                            title="Toggle Hotkeys"
                        >
                            <Keyboard className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Sound Grid */}
                <div className="grid grid-cols-5 gap-2.5 py-4">
                    {DEFAULT_SOUNDS.map((sound) => (
                        <button
                            key={sound.id}
                            onClick={() => handlePlaySound(sound.id)}
                            disabled={soundState.isPlaying && soundState.currentSound === sound.id}
                            className={`
                relative flex flex-col items-center justify-center p-2.5 h-16 rounded-2xl transition-all duration-200
                ${soundState.currentSound === sound.id ? "ring-2 ring-white scale-105" : "hover:bg-slate-700/30 hover:scale-110 active:scale-95"}
              `}
                            style={{ backgroundColor: `${sound.color}15`, borderColor: `${sound.color}40`, borderWidth: "1.5px" }}
                        >
                            <span className="text-xl mb-0.5">{sound.icon}</span>
                            <span className="text-[9px] font-semibold text-gray-200 truncate w-full text-center leading-tight">{sound.name}</span>
                            {showHotkeys && sound.hotkey && (
                                <span className="absolute -top-1 -right-1 text-[7px] font-black text-white bg-cyan-600 px-1 rounded-full shadow-sm z-10 border border-slate-800">
                                    {sound.hotkey.toUpperCase()}
                                </span>
                            )}
                            {soundState.currentSound === sound.id && (
                                <div className="absolute inset-0 flex items-center justify-center bg-cyan-400/20 rounded-2xl">
                                    <div className="w-1 h-1 bg-white rounded-full animate-ping" />
                                </div>
                            )}
                        </button>
                    ))}
                </div>

                {/* Now Playing Indicator */}
                {soundState.currentSound && (
                    <div className="text-center py-1.5 bg-cyan-500/10 rounded-xl border border-cyan-500/20 mt-1">
                        <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">
                            Playing: {DEFAULT_SOUNDS.find((s) => s.id === soundState.currentSound)?.name}
                        </span>
                    </div>
                )}
            </div>
        </>
    )
}
