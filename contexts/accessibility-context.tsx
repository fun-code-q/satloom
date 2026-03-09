"use client"

import React, { useEffect, useState, createContext, useContext, useCallback } from "react"

// Accessibility Context
interface AccessibilityContextType {
    highContrast: boolean
    setHighContrast: (value: boolean) => void
    largeText: boolean
    setLargeText: (value: boolean) => void
    reducedMotion: boolean
    setReducedMotion: (value: boolean) => void
    screenReaderAnnounce: (message: string, priority?: "polite" | "assertive") => void
    keyboardNavigation: boolean
    setKeyboardNavigation: (value: boolean) => void
    focusIndicators: boolean
    setFocusIndicators: (value: boolean) => void
}

const AccessibilityContext = createContext<AccessibilityContextType | null>(null)

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
    const [highContrast, setHighContrast] = useState(false)
    const [largeText, setLargeText] = useState(false)
    const [reducedMotion, setReducedMotion] = useState(false)
    const [keyboardNavigation, setKeyboardNavigation] = useState(false)
    const [focusIndicators, setFocusIndicators] = useState(true)

    // Initialize from system preferences
    useEffect(() => {
        // Check for reduced motion preference
        const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        setReducedMotion(prefersReducedMotion)

        // Check for high contrast preference
        const prefersHighContrast = window.matchMedia("(prefers-contrast: more)").matches
        setHighContrast(prefersHighContrast)

        // Detect keyboard navigation
        const handleKeyDown = () => {
            setKeyboardNavigation(true)
        }
        window.addEventListener("keydown", handleKeyDown)

        // Check for large text preference
        const prefersLargeText = window.matchMedia("(prefers-font-size: larger)").matches
        setLargeText(prefersLargeText)

        return () => {
            window.removeEventListener("keydown", handleKeyDown)
        }
    }, [])

    // Apply classes to document
    useEffect(() => {
        document.documentElement.classList.toggle("high-contrast", highContrast)
        document.documentElement.classList.toggle("large-text", largeText)
        document.documentElement.classList.toggle("reduced-motion", reducedMotion)
        document.documentElement.classList.toggle("focus-visible", focusIndicators)
    }, [highContrast, largeText, reducedMotion, focusIndicators])

    const screenReaderAnnounce = useCallback((message: string, priority: "polite" | "assertive" = "polite") => {
        const announcement = document.createElement("div")
        announcement.setAttribute("role", "status")
        announcement.setAttribute("aria-live", priority)
        announcement.setAttribute("aria-atomic", "true")
        announcement.className = "sr-only"
        announcement.textContent = message
        document.body.appendChild(announcement)

        setTimeout(() => {
            document.body.removeChild(announcement)
        }, 1000)
    }, [])

    return (
        <AccessibilityContext.Provider
            value={{
                highContrast,
                setHighContrast,
                largeText,
                setLargeText,
                reducedMotion,
                setReducedMotion,
                screenReaderAnnounce,
                keyboardNavigation,
                setKeyboardNavigation,
                focusIndicators,
                setFocusIndicators,
            }}
        >
            {children}
        </AccessibilityContext.Provider>
    )
}

export function useAccessibility() {
    const context = useContext(AccessibilityContext)
    if (!context) {
        throw new Error("useAccessibility must be used within an AccessibilityProvider")
    }
    return context
}

// Skip Link Component
export function SkipLink({ href = "#main-content", children = "Skip to main content" }: { href?: string; children?: string }) {
    return (
        <a
            href={href}
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
        >
            {children}
        </a>
    )
}

// Live Region for Screen Reader Announcements
export function LiveRegion({ message, priority = "polite" }: { message: string; priority?: "polite" | "assertive" }) {
    return (
        <div
            role="status"
            aria-live={priority}
            aria-atomic="true"
            className="sr-only"
        >
            {message}
        </div>
    )
}

// Focus Trap Component
export function FocusTrap({ children, active = true }: { children: React.ReactNode; active?: boolean }) {
    const containerRef = React.useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!active) return

        const container = containerRef.current
        if (!container) return

        const focusableElements = container.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )

        const firstFocusable = focusableElements[0] as HTMLElement
        const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "Tab") return

            if (e.shiftKey) {
                if (document.activeElement === firstFocusable) {
                    e.preventDefault()
                    lastFocusable?.focus()
                }
            } else {
                if (document.activeElement === lastFocusable) {
                    e.preventDefault()
                    firstFocusable?.focus()
                }
            }
        }

        container.addEventListener("keydown", handleKeyDown)
        firstFocusable?.focus()

        return () => {
            container.removeEventListener("keydown", handleKeyDown)
        }
    }, [active])

    return <div ref={containerRef}>{children}</div>
}

// Keyboard Shortcut Display
export function KeyboardShortcut({ keys, description }: { keys: string[]; description: string }) {
    return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">{keys.join(" + ")}</kbd>
            <span>{description}</span>
        </div>
    )
}

// ARIA Label Helper
export function ariaLabel(required: boolean, label: string): { "aria-label": string; "aria-required"?: boolean } {
    return {
        "aria-label": label,
        ...(required && { "aria-required": true }),
    }
}

// Interactive Element with ARIA
interface AccessibleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    label: string
    description?: string
    shortcut?: string[]
}

export function AccessibleButton({ label, description, shortcut, children, ...props }: AccessibleButtonProps) {
    const { reducedMotion, screenReaderAnnounce } = useAccessibility()

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (description) {
            screenReaderAnnounce(`${label}: ${description}`)
        }
        props.onClick?.(e)
    }

    return (
        <button
            {...ariaLabel(true, label)}
            {...props}
            onClick={handleClick}
            aria-describedby={description ? `${label}-description` : undefined}
        >
            {children}
            {description && (
                <span id={`${label}-description`} className="sr-only">
                    {description}
                </span>
            )}
            {shortcut && (
                <span className="sr-only">
                    Shortcut: {shortcut.join(" + ")}
                </span>
            )}
        </button>
    )
}

// Form Field with ARIA
interface AccessibleFormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string
    error?: string
    helpText?: string
}

export function AccessibleFormField({ label, error, helpText, id, ...props }: AccessibleFormFieldProps) {
    const fieldId = id || `field-${label.toLowerCase().replace(/\s+/g, "-")}`
    const errorId = `${fieldId}-error`
    const helpId = `${fieldId}-help`

    return (
        <div className="space-y-2">
            <label htmlFor={fieldId} className="block text-sm font-medium">
                {label}
                {props.required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
            </label>
            <input
                id={fieldId}
                aria-invalid={error ? "true" : "false"}
                aria-describedby={`${error ? errorId : ""} ${helpText ? helpId : ""}`.trim() || undefined}
                {...props}
            />
            {helpText && (
                <p id={helpId} className="text-sm text-muted-foreground">
                    {helpText}
                </p>
            )}
            {error && (
                <p id={errorId} className="text-sm text-red-500" role="alert">
                    {error}
                </p>
            )}
        </div>
    )
}

// Menu with ARIA
interface AccessibleMenuProps {
    trigger: React.ReactNode
    items: Array<{
        label: string
        onClick: () => void
        disabled?: boolean
        icon?: React.ReactNode
    }>
    label: string
}

export function AccessibleMenu({ trigger, items, label }: AccessibleMenuProps) {
    const [open, setOpen] = useState(false)
    const menuRef = React.useRef<HTMLDivElement>(null)
    const { reducedMotion, screenReaderAnnounce } = useAccessibility()

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setOpen(false)
            }
        }

        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!open) return

        const focusableItems = menuRef.current?.querySelectorAll('[role="menuitem"]')
        if (!focusableItems) return

        const itemsArray = Array.from(focusableItems)
        const currentIndex = itemsArray.indexOf(document.activeElement as Element)

        switch (e.key) {
            case "ArrowDown":
                e.preventDefault()
                const nextIndex = currentIndex < itemsArray.length - 1 ? currentIndex + 1 : 0
                    ; (itemsArray[nextIndex] as HTMLElement).focus()
                break
            case "ArrowUp":
                e.preventDefault()
                const prevIndex = currentIndex > 0 ? currentIndex - 1 : itemsArray.length - 1
                    ; (itemsArray[prevIndex] as HTMLElement).focus()
                break
            case "Escape":
                setOpen(false)
                break
        }
    }

    return (
        <div ref={menuRef} className="relative">
            <button
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen(!open)}
                {...ariaLabel(true, label)}
            >
                {trigger}
            </button>
            {open && (
                <div
                    role="menu"
                    aria-label={label}
                    className="absolute right-0 mt-2 w-48 bg-background border rounded-md shadow-lg z-50"
                    onKeyDown={handleKeyDown}
                >
                    {items.map((item, index) => (
                        <button
                            key={index}
                            role="menuitem"
                            disabled={item.disabled}
                            className="w-full px-4 py-2 text-left hover:bg-accent disabled:opacity-50"
                            onClick={() => {
                                item.onClick()
                                setOpen(false)
                            }}
                        >
                            {item.icon && <span className="mr-2">{item.icon}</span>}
                            {item.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

// Announcement Component
export function Announcement({ message, priority = "polite" }: { message: string; priority?: "polite" | "assertive" }) {
    const [announcement, setAnnouncement] = useState("")

    useEffect(() => {
        setAnnouncement(message)
    }, [message])

    return (
        <div
            role="status"
            aria-live={priority}
            aria-atomic="true"
            className="sr-only"
        >
            {announcement}
        </div>
    )
}
