"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { KeyboardRow } from './keyboard-row'
import { useVirtualKeyboardStore } from '@/stores/virtual-keyboard-store'
import { useIsMobile } from '@/hooks/use-mobile'
import {
    QWERTY_LAYOUT,
    NUMERIC_LAYOUT,
    SYMBOLS_LAYOUT,
    type KeyboardKeyData,
    type KeyboardLayout,
} from './types'
import { Settings, X } from 'lucide-react'
import { KeyboardSettings } from '@/components/virtual-keyboard/keyboard-settings'
import { cn } from '@/lib/utils'

interface VirtualKeyboardProps {
    inputRef?: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>
    onTextChange?: (text: string) => void
    initialValue?: string
}

export function VirtualKeyboard({
    inputRef,
    onTextChange,
    initialValue = ''
}: VirtualKeyboardProps) {
    const isMobile = useIsMobile()

    const {
        isEnabled,
        isVisible,
        position,
        width,
        height,
        opacity,
        theme,
        backgroundColor,
        textColor,
        keyTextSize,
        layout,
        isFloating,
        coords,
        setLayout,
        toggleEnabled,
        setVisible,
        setCoords,
        setIsFloating,
    } = useVirtualKeyboardStore()

    const [showSettings, setShowSettings] = useState(false)
    const [isShiftActive, setIsShiftActive] = useState(false)
    const [nativeKeyboardHeight, setNativeKeyboardHeight] = useState(0)
    const [isDragging, setIsDragging] = useState(false)
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
    const inputValueRef = useRef(initialValue)
    const shiftTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const keyboardRef = useRef<HTMLDivElement>(null)

    // Auto-show when input is focused
    useEffect(() => {
        if (!inputRef?.current || !isEnabled) return

        const handleFocus = () => {
            if (isEnabled) setVisible(true)
        }

        const input = inputRef.current
        input.addEventListener('focus', handleFocus)
        return () => input.removeEventListener('focus', handleFocus)
    }, [inputRef, isEnabled, setVisible])

    // Dragging Logic
    const handlePointerDown = (e: React.PointerEvent) => {
        if (!isFloating) return
        setIsDragging(true)
        const rect = keyboardRef.current?.getBoundingClientRect()
        if (rect) {
            setDragOffset({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            })
        }
        ; (e.target as HTMLElement).setPointerCapture(e.pointerId)
    }

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging || !isFloating) return
        const x = e.clientX - dragOffset.x
        const y = e.clientY - dragOffset.y
        setCoords({ x, y })
    }

    const handlePointerUp = (e: React.PointerEvent) => {
        setIsDragging(false)
            ; (e.target as HTMLElement).releasePointerCapture(e.pointerId)
    }

    // Get current layout
    const getCurrentLayout = useCallback((): KeyboardKeyData[][] => {
        switch (layout) {
            case 'numeric':
                return NUMERIC_LAYOUT
            case 'symbols':
                return SYMBOLS_LAYOUT
            case 'qwerty':
            default:
                return QWERTY_LAYOUT
        }
    }, [layout])

    // Sync visibility with enabled state for animations
    useEffect(() => {
        if (isEnabled) {
            // Short delay to ensure transition works
            const timer = setTimeout(() => setVisible(true), 10)
            return () => clearTimeout(timer)
        } else {
            setVisible(false)
        }
    }, [isEnabled, setVisible])

    // Detect native keyboard using visualViewport API
    useEffect(() => {
        if (!isMobile || !isEnabled || isFloating) {
            setNativeKeyboardHeight(0)
            return
        }

        const viewport = window.visualViewport
        if (!viewport) return

        const handleResize = () => {
            const keyboardHeight = window.innerHeight - viewport.height
            setNativeKeyboardHeight(Math.max(0, keyboardHeight))
        }

        viewport.addEventListener('resize', handleResize)
        handleResize() // Initial check
        return () => viewport.removeEventListener('resize', handleResize)
    }, [isMobile, isEnabled])

    // Handle key press
    const handleKeyPress = useCallback((key: KeyboardKeyData) => {
        const currentInput = inputValueRef.current

        switch (key.type) {
            case 'letter':
            case 'number':
            case 'symbol':
            case 'comma':
            case 'dot':
            case 'domain': {
                let value = key.value

                // Handle domain keys
                if (key.type === 'domain') {
                    value = key.value
                }

                // Apply shift if active
                if (isShiftActive && key.type === 'letter') {
                    value = value.toUpperCase()
                    setIsShiftActive(false)
                }

                const newValue = currentInput + value
                inputValueRef.current = newValue
                onTextChange?.(newValue)

                // Update input element if available
                if (inputRef && 'current' in inputRef && inputRef.current) {
                    inputRef.current.value = newValue
                    inputRef.current.dispatchEvent(new Event('input', { bubbles: true }))
                }
                break
            }

            case 'space': {
                const newValue = currentInput + ' '
                inputValueRef.current = newValue
                onTextChange?.(newValue)

                if (inputRef && 'current' in inputRef && inputRef.current) {
                    inputRef.current.value = newValue
                    inputRef.current.dispatchEvent(new Event('input', { bubbles: true }))
                }
                break
            }

            case 'backspace': {
                const newValue = currentInput.slice(0, -1)
                inputValueRef.current = newValue
                onTextChange?.(newValue)

                if (inputRef && 'current' in inputRef && inputRef.current) {
                    inputRef.current.value = newValue
                    inputRef.current.dispatchEvent(new Event('input', { bubbles: true }))
                }
                break
            }

            case 'enter': {
                // Enter key - triggers send
                if (inputRef && 'current' in inputRef && inputRef.current) {
                    const event = new KeyboardEvent('keydown', {
                        key: 'Enter',
                        code: 'Enter',
                        bubbles: true,
                    })
                    inputRef.current.dispatchEvent(event)

                    // Also try to find and click the send button if event doesn't trigger it
                    const form = inputRef.current.closest('form')
                    if (form) {
                        form.requestSubmit()
                    }
                }
                break
            }

            case 'shift': {
                setIsShiftActive(!isShiftActive)

                // Auto-disable shift after a delay
                if (!isShiftActive) {
                    if (shiftTimeoutRef.current) clearTimeout(shiftTimeoutRef.current)
                    shiftTimeoutRef.current = setTimeout(() => {
                        setIsShiftActive(false)
                    }, 5000)
                }
                break
            }

            case 'switch': {
                // Handle layout switching
                if (key.value === 'switch-numeric') {
                    setLayout('numeric')
                } else if (key.value === 'switch-symbols') {
                    setLayout('symbols')
                } else if (key.value === 'switch-qwerty') {
                    setLayout('qwerty')
                }
                break
            }
        }
    }, [isShiftActive, onTextChange, inputRef, setLayout])

    // Get position styles
    const getPositionStyles = () => {
        if (isFloating) {
            return {
                left: coords.x || '10%',
                top: coords.y || '30%',
                width: `${width}%`,
                position: 'fixed' as const,
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            }
        }

        const baseStyles = {}

        if (position === 'bottom') {
            return {
                ...baseStyles,
                bottom: nativeKeyboardHeight > 0 ? `${nativeKeyboardHeight}px` : '0px',
                left: `${(100 - width) / 2}%`,
                width: `${width}%`,
            }
        } else {
            return {
                ...baseStyles,
                top: '0px',
                left: `${(100 - width) / 2}%`,
                width: `${width}%`,
            }
        }
    }

    // Only render on mobile
    if (!isMobile) return null

    // Don't render if not enabled
    if (!isEnabled) return null

    return (
        <>
            <div
                ref={keyboardRef}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                className={cn(
                    'fixed z-[1000] transition-all duration-300 backdrop-blur-xl border border-white/10 overflow-hidden',
                    'flex flex-col rounded-2xl select-none',
                    isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none translate-y-4',
                    isDragging ? 'scale-[1.02] rotate-1' : 'scale-100 rotate-0'
                )}
                style={{
                    ...getPositionStyles(),
                    height: `${height}px`,
                    opacity: opacity / 100,
                    backgroundColor: backgroundColor,
                }}
                role="keyboard"
                aria-label="Virtual keyboard"
            >
                {/* Minimal Header / Drag Handle */}
                <div
                    onPointerDown={handlePointerDown}
                    className={cn(
                        "flex items-center justify-between px-4 py-2 cursor-move active:cursor-grabbing",
                        isFloating ? "bg-white/5" : "bg-transparent"
                    )}
                >
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-1 bg-white/20 rounded-full" />
                        <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">
                            {layout}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setShowSettings(true)}
                            className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
                        >
                            <Settings className="w-3.5 h-3.5 text-white/60" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setVisible(false)}
                            className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
                        >
                            <X className="w-3.5 h-3.5 text-white/60" />
                        </button>
                    </div>
                </div>

                {/* Keyboard rows */}
                <div className="flex-1 flex flex-col justify-center px-1 pb-2">
                    {getCurrentLayout().map((row, rowIndex) => (
                        <KeyboardRow
                            key={`row-${rowIndex}`}
                            keys={row}
                            theme={theme}
                            textColor={textColor}
                            textSize={keyTextSize}
                            onKeyPress={handleKeyPress}
                            isShiftActive={isShiftActive}
                        />
                    ))}
                </div>
            </div>

            {/* Settings Panel */}
            {showSettings && (
                <KeyboardSettings onClose={() => setShowSettings(false)} />
            )}
        </>
    )
}

// Export a hook for managing keyboard state externally
export function useVirtualKeyboard() {
    const store = useVirtualKeyboardStore()

    return {
        isEnabled: store.isEnabled,
        isVisible: store.isVisible,
        toggle: store.toggleEnabled,
        show: () => store.setEnabled(true),
        hide: () => store.setEnabled(false),
        settings: {
            position: store.position,
            width: store.width,
            height: store.height,
            opacity: store.opacity,
            theme: store.theme,
            backgroundColor: store.backgroundColor,
            textColor: store.textColor,
            keyTextSize: store.keyTextSize,
            layout: store.layout,
        },
    }
}