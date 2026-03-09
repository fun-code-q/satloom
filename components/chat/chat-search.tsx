"use client"

import React, { useEffect, useState } from "react"
import { Input } from "../ui/input"
import { Search, X } from "lucide-react"
import { useChatStore } from "@/stores/chat-store"

export function ChatSearch() {
    const { searchQuery, setSearchQuery } = useChatStore()
    const [localQuery, setLocalQuery] = useState(searchQuery)

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

    return (
        <div className="relative w-full px-4 py-2 border-b border-white/5 bg-slate-900/40 animate-in slide-in-from-top duration-300">
            <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-cyan-400 transition-colors" />
                <Input
                    className="pl-10 pr-10 py-5 bg-white/5 border-white/10 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 text-white placeholder:text-gray-500 rounded-xl transition-all h-9"
                    placeholder="Search in chat..."
                    value={localQuery}
                    onChange={(e) => setLocalQuery(e.target.value)}
                    autoFocus
                />
                {localQuery && (
                    <button
                        onClick={() => setLocalQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    )
}
