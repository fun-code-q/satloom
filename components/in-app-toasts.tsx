"use client"

import { useEffect, useState } from "react"
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react"
import { NotificationSystem, type InAppToast } from "@/utils/core/notification-system"

const DISMISS_AFTER_MS = 4000
const MAX_VISIBLE = 3

const LEVEL_STYLES: Record<InAppToast["level"], { ring: string; icon: React.ReactNode }> = {
    error: {
        ring: "border-red-500/40 bg-red-950/80",
        icon: <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />,
    },
    success: {
        ring: "border-emerald-500/40 bg-emerald-950/80",
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />,
    },
    info: {
        ring: "border-cyan-500/40 bg-cyan-950/80",
        icon: <Info className="w-4 h-4 text-cyan-400 shrink-0" />,
    },
}

/**
 * Renders notificationSystem.error/success/info in-app.
 *
 * Those calls previously reached only the Web Notification API, which silently
 * does nothing unless the user granted OS notification permission — so on a
 * default install the app never told the user that a send had failed, that a
 * poll went through, or that they had hit the 1 msg/sec limit.
 *
 * Mounted once in the root layout. It subscribes to the notification singleton
 * rather than taking a provider, so the 77 existing call sites keep working
 * unchanged.
 */
export function InAppToasts() {
    const [toasts, setToasts] = useState<InAppToast[]>([])

    useEffect(() => {
        const notificationSystem = NotificationSystem.getInstance()
        const timers = new Map<number, ReturnType<typeof setTimeout>>()

        const unsubscribe = notificationSystem.subscribeToToasts((toast) => {
            setToasts((prev) => {
                // Identical back-to-back messages (a retry loop, a repeatedly
                // tapped rate limit) should refresh the existing toast rather
                // than stack up.
                const deduped = prev.filter((t) => t.message !== toast.message)
                return [...deduped, toast].slice(-MAX_VISIBLE)
            })
            timers.set(
                toast.id,
                setTimeout(() => {
                    setToasts((prev) => prev.filter((t) => t.id !== toast.id))
                    timers.delete(toast.id)
                }, DISMISS_AFTER_MS)
            )
        })

        return () => {
            unsubscribe()
            timers.forEach(clearTimeout)
            timers.clear()
        }
    }, [])

    if (toasts.length === 0) return null

    return (
        <div
            className="fixed z-[9999] left-1/2 -translate-x-1/2 bottom-24 sm:bottom-auto sm:top-4 flex flex-col gap-2 w-[min(92vw,26rem)] pointer-events-none"
            role="status"
            aria-live="polite"
        >
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={`pointer-events-auto flex items-center gap-2 rounded-xl border px-3 py-2 shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200 ${LEVEL_STYLES[toast.level].ring}`}
                >
                    {LEVEL_STYLES[toast.level].icon}
                    <span className="text-xs text-white/90 flex-1 leading-snug">{toast.message}</span>
                    {/* min-w/h 44px: the icon is small, but the tap target must
                        not be — 44x44 is the documented minimum. */}
                    <button
                        onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                        className="text-white/50 hover:text-white transition-colors shrink-0 flex items-center justify-center min-w-[44px] min-h-[44px] -my-2 -mr-2"
                        aria-label="Dismiss notification"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            ))}
        </div>
    )
}
