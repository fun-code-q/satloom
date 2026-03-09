"use client"

import React, { useState, useEffect } from "react"
import { audioEmojiManager, type AudioEmoji } from "@/utils/hardware/audio-emoji"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Volume2, Plus, Trash2, Pause, Music, Gamepad2, Laugh, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface AudioEmojiPickerProps {
    isOpen: boolean
    onClose: () => void
    roomId: string
    userId: string
    userName: string
}

export function AudioEmojiPicker({ isOpen, onClose, roomId, userId, userName }: AudioEmojiPickerProps) {
    const [emojis, setEmojis] = useState<AudioEmoji[]>([])
    const [recentPlays, setRecentPlays] = useState<any[]>([])
    const [isPlaying, setIsPlaying] = useState(false)
    const [showCustomForm, setShowCustomForm] = useState(false)
    const [customName, setCustomName] = useState("")
    const [customEmoji, setCustomEmoji] = useState("")
    const [activeCategory, setActiveCategory] = useState<AudioEmoji["category"] | "all">("all")

    useEffect(() => {
        if (isOpen) {
            audioEmojiManager.initialize(roomId, userId, userName)
            audioEmojiManager.listenForPlays()

            const unsubscribe = audioEmojiManager.subscribe((state) => {
                setEmojis(state.availableEmojis)
                setRecentPlays(state.recentPlays)
                setIsPlaying(state.isPlaying)
            })

            return () => {
                unsubscribe()
                audioEmojiManager.stopListening()
            }
        }
    }, [isOpen, roomId, userId, userName])

    const handlePlayEmoji = async (emojiId: string) => {
        await audioEmojiManager.playAudioEmoji(emojiId)
    }

    const handleAddCustom = async () => {
        if (customName.trim() && customEmoji.trim()) {
            await audioEmojiManager.addCustomEmoji(customName, customEmoji, "", 2000)
            setCustomName("")
            setCustomEmoji("")
            setShowCustomForm(false)
        }
    }

    const handleRemoveCustom = async (emojiId: string) => {
        await audioEmojiManager.removeCustomEmoji(emojiId)
    }

    const categories = [
        { id: "all", label: "All", icon: Sparkles },
        { id: "reaction", label: "Reactions", icon: Laugh },
        { id: "game", label: "Games", icon: Gamepad2 },
        { id: "meme", label: "Memes", icon: Music },
        { id: "custom", label: "Custom", icon: Sparkles },
    ] as const

    const filteredEmojis = activeCategory === "all"
        ? emojis
        : emojis.filter(e => e.category === activeCategory)

    if (!isOpen) return null

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40" onClick={onClose} />

            {/* Popup */}
            <div className="fixed bottom-20 right-8 z-50 bg-slate-800/95 backdrop-blur-sm border border-slate-600 rounded-2xl p-4 shadow-2xl w-80 max-h-[420px] flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <Volume2 className="w-4 h-4 text-orange-400" />
                        Audio Emojis
                    </div>
                    {isPlaying && (
                        <div className="flex items-center gap-1 text-purple-400">
                            <Pause className="h-3 w-3 animate-pulse" />
                            <span className="text-xs">Playing...</span>
                        </div>
                    )}
                </div>

                {/* Category tabs */}
                <div className="flex gap-1 mb-3 overflow-x-auto scrollbar-hide">
                    {categories.map((cat) => (
                        <Button
                            key={cat.id}
                            variant={activeCategory === cat.id ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setActiveCategory(cat.id)}
                            className={`text-xs whitespace-nowrap h-7 px-2 ${activeCategory === cat.id
                                ? "bg-orange-500 hover:bg-orange-600 text-white"
                                : "text-gray-400 hover:text-white hover:bg-slate-700"
                                }`}
                        >
                            <cat.icon className="h-3 w-3 mr-1" />
                            {cat.label}
                        </Button>
                    ))}
                </div>

                {/* Emoji Grid */}
                <div className="grid grid-cols-4 gap-1.5 max-h-52 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-slate-700">
                    {filteredEmojis.map((emoji) => (
                        <div
                            key={emoji.id}
                            className={cn(
                                "relative p-2 rounded-lg text-center cursor-pointer transition-all",
                                "hover:bg-slate-700 active:scale-95",
                                emoji.category === "custom" && "border border-purple-500/50"
                            )}
                            onClick={() => handlePlayEmoji(emoji.id)}
                        >
                            <span className="text-2xl block">{emoji.emoji}</span>
                            <span className="text-[10px] text-slate-400 truncate block mt-0.5">{emoji.name}</span>
                            {emoji.category === "custom" && (
                                <button
                                    className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        handleRemoveCustom(emoji.id)
                                    }}
                                >
                                    <Trash2 className="h-2.5 w-2.5 text-white" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                {/* Custom emoji add */}
                <div className="mt-2 pt-2 border-t border-slate-600">
                    {showCustomForm ? (
                        <div className="space-y-2">
                            <Input
                                value={customName}
                                onChange={(e) => setCustomName(e.target.value)}
                                placeholder="Name..."
                                className="bg-slate-700 border-slate-600 h-8 text-xs"
                            />
                            <Input
                                value={customEmoji}
                                onChange={(e) => setCustomEmoji(e.target.value)}
                                placeholder="🎉"
                                className="bg-slate-700 border-slate-600 h-8 text-lg"
                            />
                            <div className="flex gap-1">
                                <Button onClick={handleAddCustom} size="sm" className="flex-1 h-7 text-xs">Add</Button>
                                <Button variant="ghost" size="sm" onClick={() => setShowCustomForm(false)} className="h-7 text-xs text-gray-400">Cancel</Button>
                            </div>
                        </div>
                    ) : (
                        <button
                            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors w-full"
                            onClick={() => setShowCustomForm(true)}
                        >
                            <Plus className="h-3 w-3" />
                            Add custom audio emoji
                        </button>
                    )}
                </div>

                {/* Recent plays */}
                {recentPlays.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-600">
                        <div className="text-[10px] text-gray-500 mb-1">Recently played</div>
                        <div className="flex gap-2">
                            {recentPlays.slice(0, 5).map((play) => (
                                <span key={play.id} className="text-lg" title={`${play.userName}`}>
                                    {emojis.find(e => e.id === play.emojiId)?.emoji || "🔊"}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}
