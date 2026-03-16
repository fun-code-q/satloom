"use client"

import React, { useEffect, useState } from "react"
import { Input } from "../ui/input"
import { Search, X } from "lucide-react"
import { useChatStore } from "@/stores/chat-store"

export function ChatSearch({ onClose }: { onClose?: () => void }) {
    const { searchQuery, setSearchQuery } = useChatStore()
    const [localQuery, setLocalQuery] = useState(searchQuery)

    const inputRef = React.useRef<HTMLInputElement>(null)

    // Debounce the search query
    useEffect(() => {
        const timer = setTimeout(() => {
            setSearchQuery(localQuery)
        }, 300)
        return () => clearTimeout(timer)
    }, [localQuery, setSearchQuery])

    // Sync with store if changed externally
    useEffect(() => {
        setLocalQuery(searchQuery)
    }, [searchQuery])

    // Force focus on mount
    useEffect(() => {
        const timer = setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.focus()
            }
        }, 100)
        return () => clearTimeout(timer)
    }, [])

    return (
        <div className="flex-1 min-w-[120px] max-w-xl mx-2 animate-in fade-in zoom-in-95 duration-200">
            <div className="relative group flex items-center h-8 gap-2">
                <div className="relative flex-1 items-center h-8 rounded-lg overflow-hidden border border-white/10 group-focus-within:border-cyan-500/50 bg-white/5 transition-all">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 group-focus-within:text-cyan-400 transition-colors pointer-events-none" />
                    <Input
                        ref={inputRef}
                        id="chat-search-input"
                        name="chat-search"
                        className="w-full pl-8 pr-8 py-1 bg-transparent border-0 focus-visible:ring-0 text-white text-xs placeholder:text-gray-500 h-8"
                        placeholder="Search messages..."
                        value={localQuery}
                        onChange={(e) => setLocalQuery(e.target.value)}
                    />
                    {localQuery && (
                        <button
                            onClick={() => setLocalQuery("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors p-1"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    )}
                </div>
                {onClose && (
                    <button 
                        onClick={onClose}
                        className="flex-shrink-0 text-gray-400 hover:text-white transition-colors haptic p-1"
                        title="Close search"
                    >
                        <span className="text-[10px] font-bold uppercase tracking-widest mr-1 hidden sm:inline">Close</span>
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    )
}
