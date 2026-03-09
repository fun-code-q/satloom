"use client"

import React, { useState, useEffect } from "react"
import { presentationModeManager, type Slide } from "@/utils/infra/presentation-mode"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BaseModal } from "@/components/base-modal"
import { Monitor, Plus, X, Image, Video, Code, BarChart3, HelpCircle, Layout, Play, Users, FileText } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getFirebaseDatabase } from "@/lib/firebase"
import { ref, onValue } from "firebase/database"

interface PresentationSetupModalProps {
    isOpen: boolean
    onClose: () => void
    roomId: string
    userId: string
    userName: string
    onStartPresentation?: (presentationId: string) => void
    onJoinPresentation?: (presentationId: string) => void
}

export function PresentationSetupModal({ isOpen, onClose, roomId, userId, userName, onStartPresentation, onJoinPresentation }: PresentationSetupModalProps) {
    const [title, setTitle] = useState("")
    const [presentationId, setPresentationId] = useState<string | null>(null)
    const [slides, setSlides] = useState<Slide[]>([])
    const [showJoinSection, setShowJoinSection] = useState(false)
    const [joinId, setJoinId] = useState("")
    const [activeRoomPresentation, setActiveRoomPresentation] = useState<{ id: string; title: string; hostName: string } | null>(null)

    useEffect(() => {
        if (!isOpen || !roomId) return

        const db = getFirebaseDatabase()
        if (!db) return

        const roomPresRef = ref(db, `rooms/${roomId}/activePresentation`)
        const unsubscribe = onValue(roomPresRef, (snapshot) => {
            setActiveRoomPresentation(snapshot.val())
        })

        return () => unsubscribe()
    }, [isOpen, roomId])

    const slideTypes: { type: Slide["type"]; icon: React.ElementType; label: string }[] = [
        { type: "title", icon: FileText, label: "Title Slide" },
        { type: "content", icon: FileText, label: "Content Slide" },
        { type: "image", icon: Image, label: "Image Slide" },
        { type: "code", icon: Code, label: "Code Slide" },
        { type: "video", icon: Video, label: "Video Slide" },
        { type: "poll", icon: BarChart3, label: "Poll Slide" },
        { type: "quiz", icon: HelpCircle, label: "Quiz Slide" },
        { type: "screen", icon: Monitor, label: "Screen Share" },
    ]

    const handleCreatePresentation = async () => {
        if (!title.trim()) return

        presentationModeManager.initialize(roomId, userId, userName)
        const id = await presentationModeManager.createPresentation(title)
        setPresentationId(id)
    }

    const handleAddSlide = async (slideType: Slide["type"]) => {
        if (!presentationId) return

        const slide: Omit<Slide, "id"> = {
            type: slideType,
            title: slideType === "title" ? "New Slide" : slideType.charAt(0).toUpperCase() + slideType.slice(1) + " Slide",
            content: slideType === "content" ? "Add your content here..." : undefined,
            code: slideType === "code" ? "// Add your code here..." : undefined,
            language: slideType === "code" ? "javascript" : undefined,
            imageUrl: slideType === "image" ? "" : undefined,
            videoUrl: slideType === "video" ? "" : undefined,
            options: slideType === "poll" || slideType === "quiz" ? ["Option 1", "Option 2", "Option 3", "Option 4"] : undefined,
            correctAnswer: slideType === "quiz" ? 0 : undefined,
        }

        const slideId = await presentationModeManager.addSlide(presentationId, slide)
        setSlides([...slides, { ...slide, id: slideId }])
    }

    const handleDeleteSlide = async (slideId: string) => {
        if (presentationId) {
            await presentationModeManager.deleteSlide(presentationId, slideId)
            setSlides(slides.filter(s => s.id !== slideId))
        }
    }

    const handleStartPresentation = async () => {
        if (presentationId) {
            await presentationModeManager.startPresentation(presentationId)
            if (onStartPresentation) {
                onStartPresentation(presentationId)
            }
            onClose()
        }
    }

    const handleJoinPresentation = (id?: string) => {
        const targetId = id || joinId
        if (!targetId.trim()) return

        presentationModeManager.initialize(roomId, userId, userName)
        presentationModeManager.listenForPresentation(targetId)
        presentationModeManager.joinPresentation(targetId)
        setPresentationId(targetId)
        setShowJoinSection(false)

        if (onJoinPresentation) {
            onJoinPresentation(targetId)
        }
        onClose()
    }

    return (
        <BaseModal isOpen={isOpen} onClose={onClose} title="Presentation Mode" className="max-w-2xl">
            <div className="space-y-6">
                {/* Presentation ID */}
                {presentationId && (
                    <Card className="bg-purple-500/10 border-purple-500/20 shadow-lg shadow-purple-500/10 overflow-hidden">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
                                        <Monitor className="h-5 w-5 text-purple-400" />
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className="text-[10px] font-black tracking-widest text-purple-400 uppercase">Status</p>
                                        <p className="text-sm font-bold text-white uppercase tracking-tight">Active Presentation Session</p>
                                    </div>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="rounded-xl border-white/10 hover:bg-white/5 text-white/50 text-[10px] font-bold uppercase tracking-widest"
                                    onClick={() => {
                                        navigator.clipboard.writeText(presentationId)
                                    }}
                                >
                                    Copy Session Ref
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Active Room Presentation (The Streamlined Logic) */}
                {!presentationId && activeRoomPresentation && (
                    <Card className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 border-purple-500/30 shadow-2xl animate-in zoom-in-95 duration-500 overflow-hidden">
                        <CardContent className="pt-8 pb-8 text-center relative">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Monitor className="h-24 w-24" />
                            </div>
                            <div className="relative z-10">
                                <Badge className="bg-purple-500 text-white mb-4 px-3 py-1 font-bold animate-pulse">LIVE NOW IN ROOM</Badge>
                                <h3 className="text-2xl font-black text-white tracking-tight mb-2 uppercase italic">{activeRoomPresentation.title}</h3>
                                <p className="text-slate-400 text-sm mb-6 flex items-center justify-center gap-2">
                                    <Users className="h-4 w-4 text-purple-400" />
                                    Started by <span className="text-white font-bold">{activeRoomPresentation.hostName}</span>
                                </p>
                                <Button
                                    onClick={() => handleJoinPresentation(activeRoomPresentation.id)}
                                    className="w-full max-w-xs bg-purple-600 hover:bg-purple-500 text-white font-black h-14 rounded-2xl shadow-xl shadow-purple-600/20 transition-all hover:scale-105 active:scale-95"
                                >
                                    <Play className="h-5 w-5 mr-2 fill-current" />
                                    JOIN PRESENTATION
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Join Existing (The Fallback Logic) */}
                {showJoinSection && (
                    <Card className="bg-slate-800/50 border-white/5 animate-in slide-in-from-top-4 duration-300">
                        <CardContent className="pt-6">
                            <div className="flex flex-col gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">JOIN BY UNIQUE ID</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            value={joinId}
                                            onChange={(e) => setJoinId(e.target.value)}
                                            placeholder="Enter Presentation ID (e.g., pres_123...)"
                                            className="bg-slate-900/50 border-white/10 h-12 rounded-xl text-purple-400 font-mono"
                                        />
                                        <Button
                                            onClick={() => handleJoinPresentation()}
                                            className="h-12 px-6 rounded-xl bg-purple-600 hover:bg-purple-500"
                                            disabled={!joinId.trim()}
                                        >
                                            Join
                                        </Button>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowJoinSection(false)}
                                    className="text-slate-500 hover:text-white"
                                >
                                    Cancel
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* New Presentation Setup */}
                {!presentationId && (
                    <Card className="bg-slate-800 border-slate-700">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-white">Create New Presentation</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label className="text-slate-300">Presentation Title</Label>
                                <Input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Enter presentation title..."
                                    className="bg-slate-700 border-slate-600 mt-1"
                                />
                            </div>
                            <Button
                                onClick={handleCreatePresentation}
                                className="w-full bg-gradient-to-r from-purple-500 to-pink-500"
                                disabled={!title.trim()}
                            >
                                <Play className="h-4 w-4 mr-2" />
                                Create Presentation
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Slide Management */}
                {presentationId && (
                    <>
                        <Card className="bg-slate-800 border-slate-700">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-white flex items-center justify-between">
                                    <span>Slides ({slides.length})</span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleStartPresentation}
                                        className="bg-green-500/20 text-green-400 hover:bg-green-500/30"
                                    >
                                        <Play className="h-4 w-4 mr-2" />
                                        Start
                                    </Button>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1 custom-scrollbar">
                                    {slides.map((slide, index) => (
                                        <div
                                            key={slide.id}
                                            className="group relative p-3 rounded-xl bg-slate-700/50 border border-slate-600/50 text-center cursor-pointer hover:bg-slate-600 transition-all hover:scale-[1.02]"
                                        >
                                            <span className="absolute top-1 left-2 text-[10px] text-slate-500 font-bold">#{index + 1}</span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500/80 hover:bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleDeleteSlide(slide.id)
                                                }}
                                            >
                                                <X className="h-2.5 w-2.5" />
                                            </Button>
                                            <div className="flex flex-col items-center justify-center pt-1">
                                                <FileText className="h-4 w-4 text-purple-400 mb-1" />
                                                <p className="text-white text-[11px] font-medium truncate w-full px-1">{slide.title}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {slides.length === 0 && (
                                        <div className="col-span-2 sm:col-span-4 flex flex-col items-center justify-center py-8 text-center opacity-30">
                                            <FileText className="h-8 w-8 mb-2" />
                                            <p className="text-sm font-medium">No slides yet. Add your first slide below!</p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-slate-800 border-slate-700">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-white text-base">Add New Slide</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                                    {slideTypes.map((st) => (
                                        <button
                                            key={st.type}
                                            onClick={() => handleAddSlide(st.type)}
                                            className={cn(
                                                "flex flex-col items-center gap-1.5 p-3 rounded-xl bg-slate-700/50 border border-slate-600/50",
                                                "hover:bg-slate-600/80 hover:border-purple-500/50 hover:scale-[1.02] transition-all group"
                                            )}
                                        >
                                            <div className="p-2 rounded-lg bg-slate-800 group-hover:bg-slate-700 transition-colors">
                                                {/* @ts-ignore */}
                                                <st.icon className="h-4 w-4 text-purple-400 group-hover:text-purple-300" />
                                            </div>
                                            <span className="text-slate-300 text-[10px] font-bold">{st.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}

                {/* Subtle Manual Join Footer */}
                {!presentationId && !showJoinSection && (
                    <div className="pt-4 border-t border-white/5 flex justify-center">
                        <button
                            onClick={() => setShowJoinSection(true)}
                            className="text-[10px] font-bold text-slate-500 hover:text-purple-400 transition-colors uppercase tracking-[0.2em]"
                        >
                            Advanced: Connect by Session Reference
                        </button>
                    </div>
                )}
            </div>
        </BaseModal>
    )
}
