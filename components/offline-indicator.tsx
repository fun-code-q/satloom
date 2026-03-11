"use client"

import { useIsOnline } from "@/hooks/use-offline"
import { Wifi, WifiOff, CloudOff, RefreshCw } from "lucide-react"

interface OfflineIndicatorProps {
    pendingCount?: number
    isSyncing?: boolean
    onSync?: () => void
}

export function OfflineIndicator({ pendingCount = 0, isSyncing = false, onSync }: OfflineIndicatorProps) {
    const isOnline = useIsOnline()

    if (isOnline) {
        return null
    }

    return (
        <div className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm">
            <WifiOff className="w-4 h-4" />
            <span>You&apos;re offline</span>

            {pendingCount > 0 && (
                <>
                    <span className="mx-1">•</span>
                    <CloudOff className="w-4 h-4" />
                    <span>{pendingCount} message{pendingCount !== 1 ? "s" : ""} pending</span>

                    {onSync && (
                        <button
                            onClick={onSync}
                            disabled={isSyncing}
                            className="ml-2 flex items-center gap-1 px-2 py-1 bg-amber-500/20 rounded hover:bg-amber-500/30 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`w-3 h-3 ${isSyncing ? "animate-spin" : ""}`} />
                            <span className="text-xs">{isSyncing ? "Syncing..." : "Sync"}</span>
                        </button>
                    )}
                </>
            )}
        </div>
    )
}

// Banner style for showing at top of chat
export function OfflineBanner({ pendingCount = 0, isSyncing = false, onSync }: OfflineIndicatorProps) {
    const isOnline = useIsOnline()

    if (isOnline) {
        return null
    }

    return (
        <div className="sticky top-0 z-40 flex items-center justify-center gap-2 px-4 py-2 bg-amber-500/90 text-white text-sm font-medium">
            <WifiOff className="w-4 h-4" />
            <span>You&apos;re offline</span>

            {pendingCount > 0 && (
                <>
                    <span className="mx-1">•</span>
                    <CloudOff className="w-4 h-4" />
                    <span>{pendingCount} pending</span>

                    {onSync && (
                        <button
                            onClick={onSync}
                            disabled={isSyncing}
                            className="ml-2 flex items-center gap-1 px-2 py-1 bg-white/20 rounded hover:bg-white/30 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`w-3 h-3 ${isSyncing ? "animate-spin" : ""}`} />
                            <span className="text-xs">{isSyncing ? "Syncing..." : "Retry"}</span>
                        </button>
                    )}
                </>
            )}
        </div>
    )
}
