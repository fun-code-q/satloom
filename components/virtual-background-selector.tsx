"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ImageIcon, Palette, X } from "lucide-react"
import { VirtualBackgroundProcessor, VirtualBackgroundConfig } from "@/utils/hardware/virtual-background"
import { Input } from "@/components/ui/input"

interface VirtualBackgroundSelectorProps {
    onApply: (config: VirtualBackgroundConfig) => void
    currentConfig?: VirtualBackgroundConfig
}

const backgrounds = VirtualBackgroundProcessor.getDefaultBackgrounds()

export function VirtualBackgroundSelector({ onApply, currentConfig }: VirtualBackgroundSelectorProps) {
    const [selectedType, setSelectedType] = useState<"none" | "blur" | "image">(currentConfig?.type || "none")
    const [blurAmount, setBlurAmount] = useState(currentConfig?.blurAmount || 15)
    const [customImageUrl, setCustomImageUrl] = useState("")

    const handleApply = () => {
        const config: VirtualBackgroundConfig = {
            type: selectedType,
            blurAmount,
            imageUrl: selectedType === "image" ? (customImageUrl || backgrounds[2]?.url) : undefined,
        }
        onApply(config)
    }

    const handleSelectBackground = (bg: typeof backgrounds[0]) => {
        if (bg.id === "blur") {
            setSelectedType("blur")
        } else if (bg.id === "none") {
            setSelectedType("none")
        } else {
            setSelectedType("image")
            setCustomImageUrl(bg.url)
        }
    }

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full w-12 h-12 bg-slate-700 text-white"
                    title="Virtual Background"
                >
                    <Palette className="w-5 h-5" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="end"
                className="bg-slate-800 border-slate-700 text-white p-4 w-72"
            >
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm text-gray-400">Virtual Background</h4>
                    </div>

                    {/* Preset backgrounds */}
                    <div className="grid grid-cols-3 gap-2">
                        {backgrounds.map((bg) => (
                            <button
                                key={bg.id}
                                onClick={() => handleSelectBackground(bg)}
                                className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-colors ${(bg.id === "none" && selectedType === "none") ||
                                        (bg.id === "blur" && selectedType === "blur") ||
                                        (bg.id === "image" && selectedType === "image" && !customImageUrl && bg.url === currentConfig?.imageUrl) ||
                                        (selectedType === "image" && customImageUrl === bg.url)
                                        ? "border-cyan-400"
                                        : "border-transparent hover:border-slate-500"
                                    }`}
                            >
                                <div className="w-full h-full bg-slate-700 flex items-center justify-center">
                                    {bg.id === "none" ? (
                                        <X className="w-4 h-4 text-gray-400" />
                                    ) : bg.id === "blur" ? (
                                        <div className="w-full h-full bg-gradient-to-br from-slate-600 to-slate-500" />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-cyan-500 to-blue-500" />
                                    )}
                                </div>
                                <span className="absolute bottom-0 left-0 right-0 text-[10px] text-center bg-black/60 text-white py-0.5 truncate">
                                    {bg.name}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Custom image URL */}
                    <div className="space-y-2">
                        <label className="text-xs text-gray-400">Custom Background URL</label>
                        <div className="flex gap-2">
                            <Input
                                value={customImageUrl}
                                onChange={(e) => {
                                    setCustomImageUrl(e.target.value)
                                    if (e.target.value) {
                                        setSelectedType("image")
                                    }
                                }}
                                placeholder="https://..."
                                className="bg-slate-900 border-slate-600 text-white text-xs h-8"
                            />
                        </div>
                    </div>

                    {/* Blur amount slider */}
                    {selectedType === "blur" && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs text-gray-400">Blur Amount</label>
                                <span className="text-xs text-cyan-400">{blurAmount}px</span>
                            </div>
                            <input
                                type="range"
                                min="5"
                                max="50"
                                value={blurAmount}
                                onChange={(e) => setBlurAmount(parseInt(e.target.value))}
                                className="w-full accent-cyan-400"
                            />
                        </div>
                    )}

                    {/* Apply button */}
                    <Button
                        onClick={handleApply}
                        className="w-full bg-cyan-500 hover:bg-cyan-600"
                    >
                        Apply Background
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    )
}
