"use client"

/**
 * TrustModeBadge — Phase 5.
 *
 * A small honest-marketing pill rendered on every game whose move
 * validation runs entirely on the client. The badge surfaces the trust
 * model so users don't assume "no cheating possible just because the app
 * looks polished".
 *
 * Wear it on:
 *   - Tic-Tac-Toe, Connect Four, Dots & Boxes (board state is client-authored)
 *   - Bingo (host calls words; players self-mark)
 *   - Karaoke (host scores; player can edit DOM)
 *
 * Don't wear it on:
 *   - Mafia (private roles + lynch tx are server-validated)
 *   - Quiz (host evaluates with answer key the player can't read)
 *
 * Rationale lives in `firebase-rules.md` (Phase 1) and the README "Game
 * integrity is currently trust-based" disclosure.
 */

import { useEffect, useState } from "react"
import { Handshake } from "lucide-react"

const STORAGE_KEY = "satloom.trustModeAck"
const ACK_VERSION = "1"

export interface TrustModeBadgeProps {
  /** Game name for the explainer body. */
  gameName?: string
  /** Optional className passthrough for placement-specific tweaks. */
  className?: string
  /**
   * Compact = pill only, no expand-on-click. Default false: tap shows a
   * brief explainer until the user has acknowledged it once.
   */
  compact?: boolean
}

export function TrustModeBadge({ gameName = "this game", className = "", compact = false }: TrustModeBadgeProps) {
  const [acknowledged, setAcknowledged] = useState(true)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      setAcknowledged(stored === ACK_VERSION)
    } catch {
      setAcknowledged(false)
    }
  }, [])

  const acknowledge = () => {
    try { window.localStorage.setItem(STORAGE_KEY, ACK_VERSION) } catch { /* ignore */ }
    setAcknowledged(true)
    setOpen(false)
  }

  const pill = (
    <button
      type="button"
      aria-label="Trust mode information"
      onClick={() => !compact && setOpen(o => !o)}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide
        bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-colors
        ${compact ? "cursor-default pointer-events-none" : "cursor-pointer haptic"} ${className}`}
    >
      <Handshake className="w-3 h-3" />
      <span>Trust mode</span>
    </button>
  )

  if (compact) return pill

  return (
    <span className="relative inline-block">
      {pill}
      {open && (
        <span
          role="dialog"
          aria-label="What is trust mode?"
          className="absolute z-50 mt-2 left-0 w-72 max-w-[90vw] rounded-xl border border-amber-500/30 bg-slate-900/95 p-3 text-[11px] text-slate-200 shadow-xl backdrop-blur-md"
        >
          <p className="mb-2 leading-snug">
            <span className="font-semibold text-amber-300">{gameName}</span> validates moves on the
            <em> player&apos;s own device</em>. A determined opponent with browser dev-tools can
            cheat. Use with people you trust.
          </p>
          {!acknowledged && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); acknowledge() }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); acknowledge() } }}
              className="inline-block px-2 py-1 text-[10px] rounded bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 cursor-pointer"
            >
              Got it, don&apos;t show again
            </span>
          )}
        </span>
      )}
    </span>
  )
}
