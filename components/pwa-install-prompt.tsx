"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Download, Share2, Smartphone, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

const DISMISS_KEY = "satloom-install-dismissed-at"
const DISMISS_DURATION_MS = 3 * 24 * 60 * 60 * 1000

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [showIOSHint, setShowIOSHint] = useState(false)

  const isIOS = useMemo(() => {
    if (typeof window === "undefined") return false
    const ua = window.navigator.userAgent.toLowerCase()
    return /iphone|ipad|ipod/.test(ua)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return

    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    if (isStandalone) {
      setIsInstalled(true)
      return
    }

    const dismissedAtRaw = localStorage.getItem(DISMISS_KEY)
    if (dismissedAtRaw) {
      const dismissedAt = Number(dismissedAtRaw)
      if (!Number.isNaN(dismissedAt) && Date.now() - dismissedAt < DISMISS_DURATION_MS) {
        setDismissed(true)
      }
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }

    const handleInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
      setDismissed(true)
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleInstalled)

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleInstalled)
    }
  }, [])

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    const register = async () => {
      const pathsToTry = ["/satloom/sw.js", "/sw.js"]
      for (const swPath of pathsToTry) {
        try {
          await navigator.serviceWorker.register(swPath)
          return
        } catch {
          // Try next path.
        }
      }
    }

    void register()
  }, [])

  useEffect(() => {
    if (!isIOS || deferredPrompt || dismissed || isInstalled) return
    const timer = window.setTimeout(() => {
      setShowIOSHint(true)
    }, 2500)

    return () => window.clearTimeout(timer)
  }, [deferredPrompt, dismissed, isIOS, isInstalled])

  const dismissPrompt = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setDismissed(true)
    setDeferredPrompt(null)
    setShowIOSHint(false)
  }, [])

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const result = await deferredPrompt.userChoice

    if (result.outcome === "accepted") {
      setIsInstalled(true)
    }

    setDeferredPrompt(null)
  }, [deferredPrompt])

  if (isInstalled || dismissed) return null
  if (!deferredPrompt && !showIOSHint) return null

  return (
    <div className="fixed left-3 right-3 bottom-3 z-[420] sm:left-auto sm:right-5 sm:max-w-sm">
      <div className="rounded-2xl border border-white/15 bg-slate-900/90 backdrop-blur-xl shadow-2xl p-3 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-300 font-bold">Install SatLoom</div>
            <p className="text-sm text-slate-200 mt-1">
              {deferredPrompt
                ? "Install for faster startup, fullscreen feel, and home-screen access."
                : "On iPhone/iPad: tap Share then Add to Home Screen."}
            </p>
          </div>
          <button
            type="button"
            className="h-7 w-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300"
            onClick={dismissPrompt}
            aria-label="Dismiss install prompt"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          {deferredPrompt ? (
            <Button
              className="h-9 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl px-3"
              onClick={() => void handleInstall()}
            >
              <Download className="w-4 h-4 mr-2" />
              Install App
            </Button>
          ) : (
            <div className="h-9 px-3 rounded-xl bg-white/5 border border-white/10 flex items-center text-xs text-slate-300">
              <Share2 className="w-4 h-4 mr-2" />
              Share
              <span className="mx-1 text-slate-500">/</span>
              <Smartphone className="w-4 h-4 mr-2" />
              Add to Home Screen
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
