"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { X, Mic, Mic2, Volume2, Music, Radio, Zap, Ghost, Phone, Waves, Sparkles } from "lucide-react"
import { voiceFilterProcessor, type VoiceFilterType } from "@/utils/hardware/voice-filters"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

interface VoiceFilterModalProps {
    isOpen: boolean
    onClose: () => void
    onFilterSelect: (filter: VoiceFilterType) => void
    currentFilter: VoiceFilterType
}

const filterIcons: Record<VoiceFilterType, React.ReactNode> = {
    none: <Mic className="w-5 h-5" />,
    robot: <Mic2 className="w-5 h-5" />,
    deep: <Volume2 className="w-5 h-5" />,
    helium: <Zap className="w-5 h-5" />,
    chipmunk: <Music className="w-5 h-5" />,
    reverb: <Radio className="w-5 h-5" />,
    echo: <Waves className="w-5 h-5" />,
    pitch_shift: <Zap className="w-5 h-5" />,
    baritone: <Volume2 className="w-5 h-5" />,
    whisper: <Ghost className="w-5 h-5" />,
    underwater: <Waves className="w-5 h-5" />,
    telephone: <Phone className="w-5 h-5" />,
}

const filterNames: Record<VoiceFilterType, string> = {
    none: "Normal",
    robot: "Robot",
    deep: "Deep Voice",
    helium: "Helium",
    chipmunk: "Chipmunk",
    reverb: "Reverb",
    echo: "Echo",
    pitch_shift: "Pitch Shift",
    baritone: "Baritone",
    whisper: "Whisper",
    underwater: "Underwater",
    telephone: "Telephone",
}

const filterDescriptions: Record<VoiceFilterType, string> = {
    none: "Your natural voice",
    robot: "Mechanical robotic voice",
    deep: "Deep bass voice effect",
    helium: "High-pitched helium voice",
    chipmunk: "Very high-pitched voice",
    reverb: "Cathedral-like reverb",
    echo: "Delayed echo effect",
    pitch_shift: "Pitch-shifted voice",
    baritone: "Enhanced bass",
    whisper: "Whispering effect",
    underwater: "Muffled underwater sound",
    telephone: "Telephone-band limited",
}

export function VoiceFilterModal({ isOpen, onClose, onFilterSelect, currentFilter }: VoiceFilterModalProps) {
    const [intensity, setIntensity] = useState(50)
    const [previewFilter, setPreviewFilter] = useState<VoiceFilterType>(currentFilter)
    const [processor] = useState(() => voiceFilterProcessor)

    const filters: VoiceFilterType[] = [
        "none",
        "robot",
        "deep",
        "helium",
        "chipmunk",
        "reverb",
        "echo",
        "pitch_shift",
        "baritone",
        "whisper",
        "underwater",
        "telephone",
    ]

    const handleFilterClick = (filter: VoiceFilterType) => {
        setPreviewFilter(filter)
        onFilterSelect(filter)
    }

    const handleClose = () => {
        setPreviewFilter(currentFilter)
        onClose()
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Mic className="w-5 h-5 text-cyan-400" />
                        Voice Filters
                    </DialogTitle>
                    <DialogDescription className="text-slate-400">
                        Choose a voice effect for your call
                    </DialogDescription>
                </DialogHeader>

                {/* Filter Grid */}
                <div className="grid grid-cols-3 gap-2 mt-4">
                    {filters.map((filter) => (
                        <button
                            key={filter}
                            onClick={() => handleFilterClick(filter)}
                            className={`p-3 rounded-lg flex flex-col items-center gap-2 transition-all ${previewFilter === filter
                                ? "bg-cyan-500/20 border-2 border-cyan-400"
                                : "bg-slate-800 border border-slate-700 hover:bg-slate-700"
                                }`}
                        >
                            <div
                                className={`${previewFilter === filter ? "text-cyan-400" : "text-gray-400"
                                    }`}
                            >
                                {filterIcons[filter]}
                            </div>
                            <span
                                className={`text-xs font-medium ${previewFilter === filter ? "text-cyan-400" : "text-gray-300"
                                    }`}
                            >
                                {filterNames[filter]}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Filter Description */}
                <div className="mt-4 p-3 bg-slate-800 rounded-lg">
                    <p className="text-sm text-gray-300">
                        <span className="font-medium text-cyan-400">{filterNames[previewFilter]}: </span>
                        {filterDescriptions[previewFilter]}
                    </p>
                </div>

                {/* Intensity Slider */}
                <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-sm text-gray-300">Effect Intensity</label>
                        <span className="text-xs text-cyan-400">{intensity}%</span>
                    </div>
                    <Slider
                        value={[intensity]}
                        onValueChange={([value]) => setIntensity(value)}
                        min={0}
                        max={100}
                        step={10}
                        className="[&_.bg-primary]:bg-cyan-500"
                    />
                </div>

                {/* Apply Button */}
                <div className="mt-6 flex justify-end gap-2">
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        className="border-slate-600 text-gray-300 hover:bg-slate-800"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleClose}
                        className="bg-cyan-500 hover:bg-cyan-600 text-white"
                    >
                        Apply Filter
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
