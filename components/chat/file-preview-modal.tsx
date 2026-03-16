"use client"

import React, { useState, useEffect } from "react"
import { X, Send, FileText, Image as ImageIcon, FileArchive, Film, Sparkles, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"

interface FilePreviewModalProps {
    fileData: { type: string; file: File } | null
    onClose: () => void
    onSend: (file: File) => void
}

export function FilePreviewModal({ fileData, onClose, onSend }: FilePreviewModalProps) {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [imageMeta, setImageMeta] = useState<{ width: number; height: number } | null>(null)

    useEffect(() => {
        if (fileData?.file && (fileData.file.type.startsWith("image/") || fileData.file.type.startsWith("video/"))) {
            const url = URL.createObjectURL(fileData.file)
            setPreviewUrl(url)

            if (fileData.file.type.startsWith("image/")) {
                const img = new window.Image()
                img.onload = () => setImageMeta({ width: img.naturalWidth, height: img.naturalHeight })
                img.onerror = () => setImageMeta(null)
                img.src = url
            } else {
                setImageMeta(null)
            }

            return () => {
                URL.revokeObjectURL(url)
                setImageMeta(null)
            }
        }

        setPreviewUrl(null)
        setImageMeta(null)
    }, [fileData])

    useEffect(() => {
        if (!fileData) return
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose()
        }

        window.addEventListener("keydown", handleEsc)
        return () => window.removeEventListener("keydown", handleEsc)
    }, [fileData, onClose])

    if (!fileData) return null

    const { file } = fileData
    const isImage = file.type.startsWith("image/")
    const isVideo = file.type.startsWith("video/")
    const isArchive = file.name.endsWith(".zip") || file.name.endsWith(".rar")
    const extension = file.name.split(".").pop()?.toUpperCase() || "FILE"

    const formatBytes = (bytes: number, decimals = 2) => {
        if (!+bytes) return "0 Bytes"
        const k = 1024
        const dm = decimals < 0 ? 0 : decimals
        const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
    }

    const renderFileIcon = () => {
        if (isImage) return <ImageIcon className="w-16 h-16 text-cyan-400" />
        if (isVideo) return <Film className="w-16 h-16 text-purple-400" />
        if (isArchive) return <FileArchive className="w-16 h-16 text-orange-400" />
        return <FileText className="w-16 h-16 text-emerald-400" />
    }

    return (
        <div
            className="fixed inset-0 z-[1200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-slate-900 border border-slate-700/50 rounded-3xl overflow-hidden w-full max-w-3xl shadow-2xl flex flex-col relative"
                onClick={(event) => event.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-800/70">
                    <div className="min-w-0">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-cyan-400" />
                            Ready to Share
                        </h3>
                        <p className="text-xs text-slate-400 mt-1 truncate">{file.name}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full text-slate-400 hover:text-white hover:bg-slate-700">
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Preview Area */}
                <div className="flex-1 min-h-[340px] sm:min-h-[420px] flex items-center justify-center bg-slate-950 p-4 sm:p-6 relative overflow-hidden">
                    {isImage && previewUrl ? (
                        <div className="relative w-full h-full min-h-[280px] rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-[radial-gradient(circle_at_20%_20%,rgba(6,182,212,0.12),transparent_50%),radial-gradient(circle_at_80%_80%,rgba(16,185,129,0.1),transparent_50%),#020617]">
                            <img
                                src={previewUrl}
                                alt={file.name}
                                className="w-full h-full object-contain p-4"
                            />
                        </div>
                    ) : isVideo && previewUrl ? (
                        <div className="relative w-full h-full min-h-[280px] rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-black/60">
                            <video
                                src={previewUrl}
                                controls
                                playsInline
                                className="w-full h-full object-contain"
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center gap-4 text-center">
                            <div className="w-32 h-32 rounded-3xl bg-slate-800/80 flex items-center justify-center shadow-xl border border-slate-700/50">
                                {renderFileIcon()}
                            </div>
                            <div className="px-6 py-3 bg-slate-800/50 rounded-2xl border border-slate-700/50 mt-4 backdrop-blur-sm">
                                <p className="text-white font-medium text-lg truncate max-w-[250px]">{file.name}</p>
                                <p className="text-slate-400 text-sm mt-1 font-mono">{formatBytes(file.size)}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="p-4 bg-slate-800/80 backdrop-blur-md border-t border-slate-700/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-slate-700/70 text-slate-200 border border-slate-600/80">
                            {extension}
                        </span>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-700/40 text-slate-300 border border-slate-600/60">
                            {formatBytes(file.size)}
                        </span>
                        {isImage && imageMeta && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                                {imageMeta.width} x {imageMeta.height}
                            </span>
                        )}
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 inline-flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            Protected Share
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            className="rounded-xl border-slate-600 text-slate-300 hover:text-white hover:bg-slate-700 font-semibold h-11 px-5"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => onSend(file)}
                            className="rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold h-11 px-8 shadow-lg shadow-cyan-500/20 group transition-all duration-300"
                        >
                            Send File
                            <Send className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
