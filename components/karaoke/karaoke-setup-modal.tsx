"use client"

import React, { useState } from "react"
import { BaseModal } from "@/components/base-modal"
import { DEMO_SONGS, type KaraokeSong, karaokeManager } from "@/utils/games/karaoke"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, Music, Mic, Clock } from "lucide-react"

interface KaraokeSetupModalProps {
    isOpen: boolean
    onClose: () => void
    onStartSession: (song: KaraokeSong) => void
}

export function KaraokeSetupModal({ isOpen, onClose, onStartSession }: KaraokeSetupModalProps) {
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedSong, setSelectedSong] = useState<KaraokeSong | null>(null)
    const [isCreating, setIsCreating] = useState(false)
    const [activeTab, setActiveTab] = useState<"library" | "custom">("library")

    // Custom song form state
    const [customTitle, setCustomTitle] = useState("")
    const [customArtist, setCustomArtist] = useState("")
    const [customLyrics, setCustomLyrics] = useState("")

    const filteredSongs = DEMO_SONGS.filter(
        (song) =>
            song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            song.artist.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const handleStartSession = async () => {
        let songToStart = selectedSong

        if (activeTab === "custom") {
            if (!customTitle || !customLyrics) return
            // Parse lyrics (simple newline split for now)
            const lines = customLyrics.split('\n').filter(l => l.trim()).map((text, idx) => ({
                id: `custom-l-${idx}`,
                startTime: idx * 4000,
                endTime: (idx + 1) * 4000,
                text: text.trim()
            }))

            songToStart = {
                id: `custom-${Date.now()}`,
                title: customTitle,
                artist: customArtist || "Unknown Artist",
                duration: lines.length * 4000,
                lyrics: lines
            }
        }

        if (!songToStart) return

        setIsCreating(true)
        try {
            await karaokeManager.broadcastInvite(songToStart)
            await onStartSession(songToStart)
            onClose()
        } finally {
            setIsCreating(false)
        }
    }

    const formatDuration = (ms: number) => {
        const minutes = Math.floor(ms / 60000)
        const seconds = Math.floor((ms % 60000) / 1000)
        return `${minutes}:${seconds.toString().padStart(2, "0")}`
    }

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            title="Stage & Mic"
            description="Pick a soundtrack or create your own custom performance"
            className="max-w-xl bg-slate-900/60 backdrop-blur-2xl border-white/10 rounded-[32px] overflow-hidden"
            isLoading={isCreating}
            loadingText="Syncing with stage..."
        >
            <div className="space-y-6">
                {/* Tabs */}
                <div className="flex p-1 bg-white/5 rounded-2xl border border-white/10">
                    <button
                        onClick={() => setActiveTab("library")}
                        className={`flex-1 py-2.5 text-sm font-medium rounded-xl transition-all ${activeTab === "library" ? "bg-cyan-600 text-white shadow-lg shadow-cyan-600/25" : "text-white/40 hover:text-white/70"}`}
                    >
                        Song Library
                    </button>
                    <button
                        onClick={() => setActiveTab("custom")}
                        className={`flex-1 py-2.5 text-sm font-medium rounded-xl transition-all ${activeTab === "custom" ? "bg-cyan-600 text-white shadow-lg shadow-cyan-600/25" : "text-white/40 hover:text-white/70"}`}
                    >
                        Add Custom Song
                    </button>
                </div>

                {activeTab === "library" ? (
                    <div className="space-y-4">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                            <Input
                                placeholder="Search songs..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 bg-white/5 border-white/10 rounded-xl focus:ring-primary/50 text-white placeholder:text-white/20"
                            />
                        </div>

                        {/* Song List */}
                        <ScrollArea className="h-[280px] pr-4">
                            <div className="space-y-2">
                                {filteredSongs.map((song) => (
                                    <div
                                        key={song.id}
                                        onClick={() => setSelectedSong(song)}
                                        className={`p-4 rounded-2xl border cursor-pointer transition-all animate-in fade-in zoom-in-95 duration-200 ${selectedSong?.id === song.id
                                            ? "border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-500/10"
                                            : "border-white/5 bg-white/5 hover:border-white/20 hover:bg-white/10"
                                            }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary/40 to-primary/10 flex items-center justify-center flex-shrink-0 shadow-inner">
                                                <Music className="h-6 w-6 text-white" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-semibold text-white truncate text-lg">{song.title}</h4>
                                                <p className="text-sm text-white/50 truncate">{song.artist}</p>
                                                <div className="flex items-center gap-3 mt-2 text-xs text-white/30 font-medium">
                                                    <span className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-md">
                                                        <Clock className="h-3 w-3" />
                                                        {formatDuration(song.duration)}
                                                    </span>
                                                    <span className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-md">
                                                        <Mic className="h-3 w-3" />
                                                        {song.lyrics.length} lines
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {filteredSongs.length === 0 && (
                                    <div className="text-center py-12 text-white/20 border-2 border-dashed border-white/5 rounded-2xl">
                                        <Music className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                        <p className="font-medium">No tracks found in library</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                ) : (
                    <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-white/40 uppercase tracking-wider ml-1">Song Title</label>
                                <Input
                                    placeholder="Enter title..."
                                    value={customTitle}
                                    onChange={(e) => setCustomTitle(e.target.value)}
                                    className="bg-white/5 border-white/10 rounded-xl focus:ring-primary/50 text-white"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-white/40 uppercase tracking-wider ml-1">Artist Name</label>
                                <Input
                                    placeholder="Enter artist..."
                                    value={customArtist}
                                    onChange={(e) => setCustomArtist(e.target.value)}
                                    className="bg-white/5 border-white/10 rounded-xl focus:ring-primary/50 text-white"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-white/40 uppercase tracking-wider ml-1">Paste Lyrics</label>
                            <textarea
                                placeholder="Paste lyrics here (each line will be timed for 4 seconds)..."
                                value={customLyrics}
                                onChange={(e) => setCustomLyrics(e.target.value)}
                                className="w-full h-40 bg-white/5 border border-white/10 rounded-2xl p-4 focus:ring-2 focus:ring-primary/50 text-white resize-none placeholder:text-white/20 outline-none"
                            />
                        </div>
                        <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 flex items-start gap-3">
                            <div className="mt-1">
                                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                            </div>
                            <p className="text-xs text-primary/80 leading-relaxed font-medium">
                                TIP: Each line you paste will be auto-timed to 4 seconds for a balanced rhythm. You can refine the timing in future updates.
                            </p>
                        </div>
                    </div>
                )}

                {/* Selected Song Preview (Library only) */}
                {selectedSong && activeTab === "library" && (
                    <div className="p-4 rounded-2xl bg-slate-800 border border-cyan-500/30 shadow-lg shadow-cyan-500/10 flex items-center justify-between animate-in slide-in-from-bottom-2">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-cyan-600/20 rounded-lg flex items-center justify-center">
                                <Mic className="h-5 w-5 text-cyan-400" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-cyan-400/60 uppercase tracking-tighter">Ready to sing</p>
                                <h4 className="font-bold text-white leading-none">{selectedSong.title}</h4>
                            </div>
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-4 pt-2">
                    <Button variant="ghost" onClick={onClose} className="flex-1 text-white/60 hover:text-white hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-2xl h-12 transition-all">
                        Exit
                    </Button>
                    <Button
                        onClick={handleStartSession}
                        disabled={(activeTab === "library" ? !selectedSong : (!customTitle || !customLyrics)) || isCreating}
                        className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/25 rounded-2xl h-12 transition-all"
                    >
                        <Mic className="h-5 w-5 mr-2" />
                        Start Show
                    </Button>
                </div>
            </div>
        </BaseModal>
    )
}
