"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Music, Image as ImageIcon, Plus, Trash2, X, Save } from "lucide-react"
import { getFirebaseDatabase } from "@/lib/firebase"
import { ref, update, onValue } from "firebase/database"
import { toast } from "sonner"

interface MoodSetupModalProps {
    isOpen: boolean
    onClose: () => void
    roomId: string
}

export function MoodSetupModal({ isOpen, onClose, roomId }: MoodSetupModalProps) {
    const [backgroundImage, setBackgroundImage] = useState("")
    const [currentSongUrl, setCurrentSongUrl] = useState("")
    const [playlist, setPlaylist] = useState<string[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [songAdded, setSongAdded] = useState(false)

    // Load implementation existing mood settings
    useEffect(() => {
        if (!isOpen || !roomId) return

        const db = getFirebaseDatabase()
        if (!db) return
        const moodRef = ref(db, `rooms/${roomId}/mood`)
        const unsubscribe = onValue(moodRef, (snapshot) => {
            const data = snapshot.val() as { backgroundImage?: string; playlist?: string[] } | null
            if (data) {
                setBackgroundImage(data.backgroundImage || "")
                setPlaylist(data.playlist || [])
            }
        })

        return () => unsubscribe()
    }, [isOpen, roomId])

    const handleAddSong = () => {
        if (!currentSongUrl.trim()) return

        // Basic URL validation
        try {
            new URL(currentSongUrl)
        } catch (e) {
            toast.error("Please enter a valid URL")
            return
        }

        setPlaylist([...playlist, currentSongUrl.trim()])
        setCurrentSongUrl("")
        setSongAdded(true)
    }

    const handleRemoveSong = (index: number) => {
        const newPlaylist = [...playlist]
        newPlaylist.splice(index, 1)
        setPlaylist(newPlaylist)
    }

    const handleSave = async () => {
        const db = getFirebaseDatabase()
        if (!db || !roomId) return
        setIsLoading(true)

        try {
            const moodRef = ref(db, `rooms/${roomId}/mood`)
            const hasSongs = playlist.length > 0
            await update(moodRef, {
                backgroundImage: backgroundImage.trim() || null,
                playlist: playlist,
                updatedAt: Date.now(),
                // If saving with songs AND a new song was added this session, broadcast the magic trigger
                ...(songAdded && hasSongs && { magicSongTrigger: Date.now() })
            })
            toast.success("Mood updated for everyone!")
            onClose()
        } catch (error) {
            console.error("Error saving mood:", error)
            toast.error("Failed to update mood")
        } finally {
            setIsLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                            <Music className="w-4 h-4 text-purple-400" />
                        </div>
                        <h2 className="text-xl font-semibold text-white">Set the Mood</h2>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                    {/* Background Image Section */}
                    <div className="space-y-3">
                        <Label className="text-white flex items-center gap-2">
                            <ImageIcon className="w-4 h-4 text-cyan-400" />
                            Background Image
                        </Label>
                        <Input
                            id="mood-background-image"
                            name="background-image"
                            value={backgroundImage}
                            onChange={(e) => setBackgroundImage(e.target.value)}
                            placeholder="Paste image URL (e.g., https://...)"
                            className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                        />
                        {backgroundImage && (
                            <div className="relative w-full h-32 rounded-lg overflow-hidden border border-slate-700 mt-2 group">
                                <img
                                    src={backgroundImage}
                                    alt="Background Preview"
                                    className="w-full h-full object-cover"
                                    onError={() => toast.error("Invalid image URL")}
                                />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <span className="text-xs text-white">Preview</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Music Playlist Section */}
                    <div className="space-y-3">
                        <Label className="text-white flex items-center gap-2">
                            <Music className="w-4 h-4 text-pink-400" />
                            Music Playlist
                        </Label>

                        <div className="flex gap-2">
                            <Input
                                id="mood-song-url"
                                name="song-url"
                                value={currentSongUrl}
                                onChange={(e) => setCurrentSongUrl(e.target.value)}
                                placeholder="Paste YouTube or MP3 URL"
                                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 flex-1"
                                onKeyDown={(e) => e.key === "Enter" && handleAddSong()}
                            />
                            <Button onClick={handleAddSong} size="icon" className="bg-slate-700 hover:bg-slate-600 text-white shrink-0">
                                <Plus className="w-4 h-4" />
                            </Button>
                        </div>

                        {/* Playlist Items */}
                        <div className="space-y-2 mt-2 max-h-40 overflow-y-auto pr-1">
                            {playlist.length === 0 ? (
                                <div className="text-center p-4 border border-dashed border-slate-800 rounded-lg text-slate-500 text-sm">
                                    No songs added yet
                                </div>
                            ) : (
                                playlist.map((url, index) => (
                                    <div key={index} className="flex items-center gap-2 bg-slate-800/50 p-2 rounded group border border-transparent hover:border-slate-700">
                                        <div className="w-6 h-6 rounded bg-slate-700 flex items-center justify-center shrink-0 text-xs font-mono text-slate-400">
                                            {index + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-slate-300 truncate" title={url}>{url.split("/").pop() || url}</p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleRemoveSong(index)}
                                            className="w-6 h-6 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-800 flex justify-end gap-3 bg-slate-900/50 rounded-b-2xl">
                    <Button variant="ghost" onClick={onClose} className="text-gray-400 hover:text-white">
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isLoading} className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white gap-2">
                        <Save className="w-4 h-4" />
                        Save Mood
                    </Button>
                </div>
            </div>
        </div>
    )
}
