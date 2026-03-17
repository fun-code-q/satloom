"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Timer, Eye, EyeOff, Camera, Clock, Check } from "lucide-react"
import type { VanishModeType } from "@/utils/infra/vanish-mode"

interface VanishModeModalProps {
    isOpen: boolean
    onClose: () => void
    onVanishModeSelect: (mode: VanishModeType, duration: number) => void
    currentMode: VanishModeType
    currentDuration: number
}

const vanishModes: { id: VanishModeType; name: string; description: string; icon: React.ReactNode; color: string }[] = [
    {
        id: "off",
        name: "Normal",
        description: "Permanent history",
        icon: <EyeOff className="w-5 h-5" />,
        color: "slate"
    },
    {
        id: "read_once",
        name: "Read Once",
        description: "Viewed once",
        icon: <Eye className="w-5 h-5" />,
        color: "purple"
    },
    {
        id: "timed",
        name: "Timed",
        description: "Self-destructs",
        icon: <Timer className="w-5 h-5" />,
        color: "cyan"
    },
]

const durations = [
    { value: 5000, label: "5s" },
    { value: 10000, label: "10s" },
    { value: 30000, label: "30s" },
    { value: 60000, label: "1m" },
    { value: 300000, label: "5m" },
    { value: 3600000, label: "1h" },
]

export function VanishModeModal({
    isOpen,
    onClose,
    onVanishModeSelect,
    currentMode,
    currentDuration,
}: VanishModeModalProps) {
    const [mounted, setMounted] = useState(false)
    const [selectedMode, setSelectedMode] = useState<VanishModeType>(currentMode)
    const [selectedDuration, setSelectedDuration] = useState(currentDuration)

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (!isOpen) return
        setSelectedMode(currentMode)
        setSelectedDuration(currentDuration)
    }, [currentDuration, currentMode, isOpen])

    if (!isOpen || !mounted) return null

    const handleApply = () => {
        onVanishModeSelect(selectedMode, selectedDuration)
        onClose()
    }

    const modalContent = (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-[1190] bg-black/35 backdrop-blur-sm" onClick={onClose} />

            {/* Vanish Mode Pop-up */}
            <div className="fixed left-3 right-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] md:left-auto md:right-[240px] md:bottom-16 md:w-[292px] md:translate-x-1/2 z-[1200] bg-slate-900/65 backdrop-blur-2xl border border-white/10 rounded-2xl p-3.5 md:p-4 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)] w-auto max-w-none md:max-w-[292px] max-h-[68vh] md:max-h-[72vh] animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300 ease-out flex flex-col gap-3 overflow-y-auto overscroll-contain">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center">
                            <EyeOff className="w-3.5 h-3.5 text-purple-400" />
                        </div>
                        <span className="text-xs font-bold text-white tracking-tight">Vanish Mode</span>
                    </div>
                </div>

                {/* Mode Grid */}
                <div className="grid grid-cols-1 gap-2">
                    {vanishModes.map((mode) => (
                        <button
                            key={mode.id}
                            onClick={() => setSelectedMode(mode.id)}
                            className={`group relative flex items-center gap-3 p-2.5 rounded-xl transition-all duration-300 border ${selectedMode === mode.id
                                    ? "bg-white/10 border-white/20 shadow-[0_8px_20px_-6px_rgba(0,0,0,0.3)]"
                                    : "bg-transparent border-transparent hover:bg-white/5"
                                }`}
                        >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${selectedMode === mode.id
                                    ? mode.id === 'off' ? 'bg-slate-500/20 text-slate-300' : mode.id === 'read_once' ? 'bg-purple-500/20 text-purple-400' : 'bg-cyan-500/20 text-cyan-400'
                                    : "bg-slate-800/50 text-slate-500 group-hover:text-slate-300"
                                }`}>
                                {mode.icon}
                            </div>
                            <div className="flex-1 text-left">
                                <div className={`text-xs font-bold ${selectedMode === mode.id ? "text-white" : "text-slate-400"}`}>
                                    {mode.name}
                                </div>
                                <div className="text-[9px] text-slate-500 font-medium">{mode.description}</div>
                            </div>
                            {selectedMode === mode.id && (
                                <div className="w-4.5 h-4.5 rounded-full bg-cyan-500 flex items-center justify-center animate-in zoom-in duration-300 shadow-[0_0_10px_rgba(34,211,238,0.4)]">
                                    <Check className="w-2.5 h-2.5 text-slate-900 stroke-[3px]" />
                                </div>
                            )}
                        </button>
                    ))}
                </div>

                {/* Custom Duration Selector (only for timed mode) */}
                {selectedMode === "timed" && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center gap-2 px-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Destroy After</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                            {durations.map((d) => (
                                <button
                                    key={d.value}
                                    onClick={() => setSelectedDuration(d.value)}
                                    className={`py-1.5 rounded-lg text-[11px] font-bold transition-all ${selectedDuration === d.value
                                            ? "bg-cyan-500 text-slate-900 shadow-[0_4px_12px_rgba(34,211,238,0.3)] scale-105"
                                            : "bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                                        }`}
                                >
                                    {d.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Screenshot Warning */}
                {selectedMode !== "off" && (
                    <div className="flex items-center gap-2 p-2 bg-amber-500/5 border border-amber-500/10 rounded-xl animate-in slide-in-from-bottom-2 duration-300">
                        <Camera className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="text-[9px] leading-tight text-amber-500/80 font-medium">
                            Anti-screenshot enabled. Senders will be notified.
                        </span>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2 border-t border-white/5">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl text-[11px] font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleApply}
                        className="flex-[1.5] py-2.5 rounded-xl text-[11px] font-bold bg-white text-slate-900 hover:bg-slate-100 transition-all shadow-xl active:scale-95"
                    >
                        Activate Mode
                    </button>
                </div>

                {/* Arrow Pointer */}
                <div className="hidden md:block absolute bottom-[-8px] left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-900 shadow-[10px_10px_30px_rgba(0,0,0,0.5)] rotate-45 border-r border-b border-white/10" />
            </div>
        </>
    )

    return createPortal(modalContent, document.body)
}
