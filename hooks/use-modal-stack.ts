"use client"

/**
 * useModalStack — Phase 8.4.
 *
 * Replaces the project-wide z-index numerology (70/80/95/300/420/500/900/
 * 1000/9999 scattered across components) with a monotonically-assigned
 * layer per open overlay. The top of the stack is always topmost; Escape
 * dismisses just the top overlay, not every overlay on the page.
 *
 * Usage:
 *
 *   const { layerZ } = useModalStack(isOpen, {
 *     onEscape: () => setOpen(false),
 *     id: "audio-call",
 *   })
 *   <div style={{ zIndex: layerZ }}>...</div>
 *
 * The first call gets z-index = BASE_Z; every subsequent open call gets
 * BASE_Z + N. When an overlay closes, its layer is released and reused.
 *
 * Why not a full Zustand portal manager? That would be the right call
 * for a rewrite, but it would touch every modal — out of Phase 8 scope.
 * This hook is opt-in and incremental: components adopt it at their own
 * pace; ones that haven't adopted it continue using whatever z-index
 * they have today.
 */

import { useEffect, useMemo, useRef } from "react"

const BASE_Z = 1000
const Z_STEP = 10

const stack: string[] = []
const escapeListeners = new Map<string, () => void>()

function topId(): string | undefined {
    return stack[stack.length - 1]
}

function dispatchTopEscape(): void {
    const top = topId()
    if (!top) return
    const handler = escapeListeners.get(top)
    handler?.()
}

let escapeHandlerInstalled = false
function installGlobalEscapeHandler(): void {
    if (escapeHandlerInstalled || typeof window === "undefined") return
    escapeHandlerInstalled = true
    window.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return
        // Only intercept if there's at least one overlay on the stack;
        // otherwise let the rest of the app handle it (Radix dialog etc.).
        if (stack.length === 0) return
        dispatchTopEscape()
    })
}

export interface UseModalStackOptions {
    /** Called when Escape is pressed AND this overlay is the top of stack. */
    onEscape?: () => void
    /**
     * Stable identifier. If you mount multiple instances of the same modal
     * (rare), make them unique. Default: random per mount.
     */
    id?: string
}

export interface UseModalStackResult {
    /** Z-index value to apply to the overlay's root element. */
    layerZ: number
    /** True when this overlay is currently topmost on the stack. */
    isTop: boolean
}

/**
 * Subscribe an overlay to the global modal stack.
 *
 * - `isOpen=true` pushes this overlay; `isOpen=false` pops it.
 * - The returned `layerZ` is monotonic w.r.t. open order.
 * - Escape always closes the topmost overlay (callable opt-in via `onEscape`).
 */
export function useModalStack(isOpen: boolean, opts: UseModalStackOptions = {}): UseModalStackResult {
    const idRef = useRef<string>(opts.id ?? `m_${Math.random().toString(36).slice(2)}`)
    const onEscapeRef = useRef<typeof opts.onEscape>(opts.onEscape)
    onEscapeRef.current = opts.onEscape

    useEffect(() => {
        installGlobalEscapeHandler()
    }, [])

    useEffect(() => {
        const id = idRef.current
        if (!isOpen) return
        stack.push(id)
        escapeListeners.set(id, () => onEscapeRef.current?.())
        return () => {
            const idx = stack.lastIndexOf(id)
            if (idx >= 0) stack.splice(idx, 1)
            escapeListeners.delete(id)
        }
    }, [isOpen])

    const { layerZ, isTop } = useMemo(() => {
        if (!isOpen) return { layerZ: BASE_Z, isTop: false }
        const idx = stack.lastIndexOf(idRef.current)
        const depth = idx < 0 ? 0 : idx
        return {
            layerZ: BASE_Z + depth * Z_STEP,
            isTop: idx === stack.length - 1,
        }
    }, [isOpen])

    return { layerZ, isTop }
}
