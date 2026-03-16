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
        <div className="flex-1 min-w-0 max-w-xl mx-2 animate-in fade-in zoom-in-95 duration-200">
            <div className="relative group flex items-center h-8">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 group-focus-within:text-cyan-400 transition-colors pointer-events-none" />
                <Input
                    id="chat-search-input"
                    name="chat-search"
                    className="w-full pl-8 pr-8 py-1 bg-white/5 border-white/10 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 text-white text-xs placeholder:text-gray-500 rounded-lg transition-all h-8"
                    placeholder="Search in chat..."
                    value={localQuery}
                    onChange={(e) => setLocalQuery(e.target.value)}
                    autoFocus
                />
                {localQuery && (
                    <button
                        onClick={() => setLocalQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
        </div>
    )
}
