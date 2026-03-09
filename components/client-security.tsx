"use client"

import { useEffect } from "react"

export function ClientSecurity() {
    useEffect(() => {
        // === 1. DISABLE CONSOLE IN PRODUCTION ===
        if (process.env.NODE_ENV === "production") {
            const noop = () => { }
            const methods: (keyof Console)[] = ["log", "debug", "info", "warn", "error", "table", "trace", "dir", "group", "groupEnd", "groupCollapsed", "time", "timeEnd", "profile", "profileEnd", "count", "assert"]
            methods.forEach((method) => {
                try {
                    (console as any)[method] = noop
                } catch (e) { }
            })
        }

        // === 2. BLOCK DEVTOOLS SHORTCUTS ===
        const handleKeyDown = (e: KeyboardEvent) => {
            // F12
            if (e.key === "F12") {
                e.preventDefault()
                e.stopPropagation()
                return false
            }

            // Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C (Windows/Linux)
            if (e.ctrlKey && e.shiftKey && ["I", "i", "J", "j", "C", "c"].includes(e.key)) {
                e.preventDefault()
                e.stopPropagation()
                return false
            }

            // Ctrl+U (view source)
            if (e.ctrlKey && (e.key === "u" || e.key === "U")) {
                e.preventDefault()
                e.stopPropagation()
                return false
            }

            // Cmd+Option+I, Cmd+Option+J (macOS)
            if (e.metaKey && e.altKey && ["I", "i", "J", "j"].includes(e.key)) {
                e.preventDefault()
                e.stopPropagation()
                return false
            }

            // PrintScreen key - clear clipboard
            if (e.key === "PrintScreen") {
                e.preventDefault()
                try {
                    navigator.clipboard.writeText("")
                } catch (err) { }
                return false
            }

            // Ctrl+P (Print)
            if (e.ctrlKey && (e.key === "p" || e.key === "P")) {
                e.preventDefault()
                e.stopPropagation()
                return false
            }

            // Ctrl+S (Save page)
            if (e.ctrlKey && (e.key === "s" || e.key === "S")) {
                e.preventDefault()
                e.stopPropagation()
                return false
            }
        }

        // === 3. BLOCK RIGHT-CLICK CONTEXT MENU ===
        const handleContextMenu = (e: MouseEvent) => {
            e.preventDefault()
            return false
        }

        // === 4. DEVTOOLS DETECTION (debugger-based) ===
        let devtoolsInterval: NodeJS.Timeout | null = null
        if (process.env.NODE_ENV === "production") {
            devtoolsInterval = setInterval(() => {
                const threshold = 160
                const widthDiff = window.outerWidth - window.innerWidth > threshold
                const heightDiff = window.outerHeight - window.innerHeight > threshold
                if (widthDiff || heightDiff) {
                    // DevTools likely open — could redirect or show warning
                    document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0F172A;color:#06B6D4;font-family:system-ui;font-size:24px;text-align:center;padding:20px"><div><h1 style="font-size:48px;margin-bottom:16px">⚠️</h1><p>Developer tools are not permitted.</p><p style="font-size:14px;color:#64748b;margin-top:8px">Please close developer tools to continue using SatLoom.</p></div></div>'
                }
            }, 1000)
        }

        // === 5. BLOCK DRAG (prevents drag-to-save images) ===
        const handleDragStart = (e: DragEvent) => {
            e.preventDefault()
            return false
        }

        // === 6. BLOCK COPY FOR SENSITIVE ELEMENTS ===
        const handleCopy = (e: ClipboardEvent) => {
            // Allow copy in input/textarea fields
            const target = e.target as HTMLElement
            if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
                return true
            }
        }

        // Attach listeners
        document.addEventListener("keydown", handleKeyDown, { capture: true })
        document.addEventListener("contextmenu", handleContextMenu)
        document.addEventListener("dragstart", handleDragStart)
        document.addEventListener("copy", handleCopy)

        return () => {
            document.removeEventListener("keydown", handleKeyDown, { capture: true })
            document.removeEventListener("contextmenu", handleContextMenu)
            document.removeEventListener("dragstart", handleDragStart)
            document.removeEventListener("copy", handleCopy)
            if (devtoolsInterval) clearInterval(devtoolsInterval)
        }
    }, [])

    return null
}
