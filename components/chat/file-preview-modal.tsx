"use client"

import React, { useState, useEffect } from "react"
import { X, Send, FileText, Image as ImageIcon, FileArchive, Film } from "lucide-react"
import { Button } from "@/components/ui/button"
import Image from "next/image"

interface FilePreviewModalProps {
    fileData: { type: string; file: File } | null
    onClose: () => void
    onSend: (file: File) => void
}

export function FilePreviewModal({ fileData, onClose, onSend }: FilePreviewModalProps) {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)

    useEffect(() => {
        if (fileData?.file && fileData.file.type.startsWith("image/")) {
            const url = URL.createObjectURL(fileData.file)
            setPreviewUrl(url)
            return () => URL.revokeObjectURL(url)
        }
        setPreviewUrl(null)
    }, [fileData])

    if (!fileData) return null

    const { file } = fileData
    const isImage = file.type.startsWith("image/")
    const isVideo = file.type.startsWith("video/")
    const isArchive = file.name.endsWith(".zip") || file.name.endsWith(".rar")

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
        <div className="fixed inset-0 z-[1200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700/50 rounded-3xl overflow-hidden w-full max-w-md shadow-2xl flex flex-col relative">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-800/50">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Preview Document</h3>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full text-slate-400 hover:text-white hover:bg-slate-700">
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Preview Area */}
                <div className="flex-1 min-h-[300px] flex items-center justify-center bg-slate-950 p-6 relative overflow-hidden group">
                    {previewUrl ? (
                        <div className="relative w-full h-full min-h-[250px] rounded-xl overflow-hidden shadow-2xl">
                            <Image
                                src={previewUrl}
                                alt={file.name}
                                fill
                                className="object-contain"
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
                <div className="p-4 bg-slate-800/80 backdrop-blur-md border-t border-slate-700/50 flex items-center justify-between gap-4">
                    <div className="flex-1">
                        {previewUrl && (
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-white truncate w-[200px] block">{file.name}</span>
                                <span className="text-xs text-slate-400 font-mono">{formatBytes(file.size)}</span>
                            </div>
                        )}
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
                            Send
                            <Send className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
