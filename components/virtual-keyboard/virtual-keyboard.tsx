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
import { Settings, X, Send, Plus, Smile, Mic, Paperclip, Keyboard as KeyboardIcon } from 'lucide-react'
import { KeyboardSettings } from '@/components/virtual-keyboard/keyboard-settings'
import { cn } from '@/lib/utils'

interface VirtualKeyboardProps {
    inputRef?: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>
    onTextChange?: (text: string) => void
    onSend?: () => void
    initialValue?: string
}

export function VirtualKeyboard({
    inputRef,
    onTextChange,
    onSend,
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
    const [dragDirection, setDragDirection] = useState<'horizontal' | 'vertical' | null>(null)
    const [headerMessage, setHeaderMessage] = useState('')
    const inputValueRef = useRef(initialValue)
    const shiftTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const keyboardRef = useRef<HTMLDivElement>(null)
    const fabRef = useRef<HTMLDivElement>(null)

    // Dragging threshold to determine direction
    const DRAG_THRESHOLD = 10

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

    // FAB (Floating Action Button) Dragging Logic
    const handleFabPointerDown = (e: React.PointerEvent) => {
        if (!isFloating) return
        setIsDragging(true)
        const rect = fabRef.current?.getBoundingClientRect()
        if (rect) {
            setDragOffset({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            })
        }
        setDragDirection(null)
            ; (e.target as HTMLElement).setPointerCapture(e.pointerId)
    }

    const handleFabPointerMove = (e: React.PointerEvent) => {
        if (!isDragging || !isFloating) return

        const rect = fabRef.current?.getBoundingClientRect()
        if (!rect) return

        const deltaX = e.clientX - dragOffset.x - coords.x
        const deltaY = e.clientY - dragOffset.y - coords.y

        // Determine drag direction on first movement beyond threshold
        if (!dragDirection) {
            if (Math.abs(deltaX) > DRAG_THRESHOLD) {
                setDragDirection('horizontal')
            } else if (Math.abs(deltaY) > DRAG_THRESHOLD) {
                setDragDirection('vertical')
            }
            return
        }

        // Calculate new position based on drag direction
        let newX = coords.x
        let newY = coords.y

        if (dragDirection === 'horizontal') {
            newX = e.clientX - dragOffset.x
        } else {
            newY = e.clientY - dragOffset.y
        }

        // Constrain to viewport bounds
        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight
        const fabSize = 56 // FAB button size

        newX = Math.max(0, Math.min(viewportWidth - fabSize, newX))
        newY = Math.max(0, Math.min(viewportHeight - fabSize, newY))

        setCoords({ x: newX, y: newY })
    }

    const handleFabPointerUp = (e: React.PointerEvent) => {
        setIsDragging(false)
        setDragDirection(null)
            ; (e.target as HTMLElement).releasePointerCapture(e.pointerId)
    }

    // Keyboard Dragging Logic (constrained to single axis)
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
        setDragDirection(null)
            ; (e.target as HTMLElement).setPointerCapture(e.pointerId)
    }

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging || !isFloating) return

        const rect = keyboardRef.current?.getBoundingClientRect()
        if (!rect) return

        const deltaX = e.clientX - dragOffset.x - coords.x
        const deltaY = e.clientY - dragOffset.y - coords.y

        // Determine drag direction on first movement beyond threshold
        if (!dragDirection) {
            if (Math.abs(deltaX) > DRAG_THRESHOLD) {
                setDragDirection('horizontal')
            } else if (Math.abs(deltaY) > DRAG_THRESHOLD) {
                setDragDirection('vertical')
            }
            return
        }

        // Calculate new position based on drag direction only
        let newX = coords.x
        let newY = coords.y

        if (dragDirection === 'horizontal') {
            newX = e.clientX - dragOffset.x
        } else {
            newY = e.clientY - dragOffset.y
        }

        // Constrain to viewport bounds
        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight
        const keyboardWidth = (viewportWidth * width) / 100
        const keyboardHeight = height

        newX = Math.max(0, Math.min(viewportWidth - keyboardWidth, newX))
        newY = Math.max(0, Math.min(viewportHeight - keyboardHeight, newY))

        setCoords({ x: newX, y: newY })
    }

    const handlePointerUp = (e: React.PointerEvent) => {
        setIsDragging(false)
        setDragDirection(null)
            ; (e.target as HTMLElement).releasePointerCapture(e.pointerId)
    }

    // Handle send from keyboard header
    const handleKeyboardSend = useCallback(() => {
        // Update input with current message
        if (inputRef && 'current' in inputRef && inputRef.current) {
            inputRef.current.value = inputValueRef.current
            inputRef.current.dispatchEvent(new Event('input', { bubbles: true }))
        }

        // Trigger onSend callback
        onSend?.()

        // Also trigger form submission
        if (inputRef && 'current' in inputRef && inputRef.current) {
            const form = inputRef.current.closest('form')
            if (form) {
                form.requestSubmit()
            }
        }

        // Clear message
        setHeaderMessage('')
        inputValueRef.current = ''
        onTextChange?.('')
    }, [onSend, onTextChange, inputRef])

    // Handle header input change
    const handleHeaderInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value
        setHeaderMessage(newValue)
        inputValueRef.current = newValue
        onTextChange?.(newValue)

        // Sync with actual input if available
        if (inputRef && 'current' in inputRef && inputRef.current) {
            inputRef.current.value = newValue
            inputRef.current.dispatchEvent(new Event('input', { bubbles: true }))
        }
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

    // Don't render if not enabled - but show FAB if enabled but not visible
    if (!isEnabled) return null

    // Show FAB (Floating Action Button) when keyboard is not visible
    if (!isVisible) {
        return (
            <>
                {/* FAB Button - Shows when keyboard is hidden but enabled */}
                <div
                    ref={fabRef}
                    onPointerDown={handleFabPointerDown}
                    onPointerMove={handleFabPointerMove}
                    onPointerUp={handleFabPointerUp}
                    onClick={() => setVisible(true)}
                    className={cn(
                        'fixed z-[999] flex items-center justify-center cursor-pointer',
                        'bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700',
                        'rounded-full shadow-lg transition-all duration-200',
                        'w-14 h-14',
                        isDragging ? 'scale-110' : 'scale-100'
                    )}
                    style={{
                        left: coords.x || 16,
                        top: coords.y || window.innerHeight - 100,
                    }}
                    role="button"
                    aria-label="Open virtual keyboard"
                >
                    <KeyboardIcon className="w-6 h-6 text-white" />
                </div>

                {/* Settings Panel */}
                {showSettings && (
                    <KeyboardSettings onClose={() => setShowSettings(false)} />
                )}
            </>
        )
    }

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
                    isDragging ? 'scale-[1.02]' : 'scale-100'
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
                {/* Header with input, send button, and controls */}
                <div
                    className={cn(
                        "flex items-center gap-2 px-3 py-2 bg-white/5 border-b border-white/10",
                        isFloating ? "cursor-move" : ""
                    )}
                    onPointerDown={isFloating ? handlePointerDown : undefined}
                >
                    {/* Attachment button */}
                    <button
                        type="button"
                        className="p-2 rounded-full hover:bg-white/10 transition-colors"
                        aria-label="Add attachment"
                    >
                        <Paperclip className="w-4 h-4 text-white/70" />
                    </button>

                    {/* Message input field */}
                    <input
                        type="text"
                        value={headerMessage}
                        onChange={handleHeaderInputChange}
                        placeholder="Type a message..."
                        className="flex-1 bg-white/10 border border-white/10 rounded-full px-4 py-2 text-white text-sm placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                        inputMode="none"
                    />

                    {/* Emoji button */}
                    <button
                        type="button"
                        className="p-2 rounded-full hover:bg-white/10 transition-colors"
                        aria-label="Add emoji"
                    >
                        <Smile className="w-4 h-4 text-white/70" />
                    </button>

                    {/* Mic button */}
                    <button
                        type="button"
                        className="p-2 rounded-full hover:bg-white/10 transition-colors"
                        aria-label="Record voice"
                    >
                        <Mic className="w-4 h-4 text-white/70" />
                    </button>

                    {/* Send button */}
                    <button
                        type="button"
                        onClick={handleKeyboardSend}
                        disabled={!headerMessage.trim()}
                        className={cn(
                            "p-2 rounded-full transition-colors",
                            headerMessage.trim()
                                ? "bg-cyan-500 hover:bg-cyan-400"
                                : "bg-white/10 cursor-not-allowed"
                        )}
                        aria-label="Send message"
                    >
                        <Send className="w-4 h-4 text-white" />
                    </button>

                    {/* Settings button */}
                    <button
                        type="button"
                        onClick={() => setShowSettings(true)}
                        className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
                    >
                        <Settings className="w-3.5 h-3.5 text-white/60" />
                    </button>

                    {/* Close button - Now calls toggleEnabled to fully disable */}
                    <button
                        type="button"
                        onClick={() => toggleEnabled()}
                        className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
                    >
                        <X className="w-3.5 h-3.5 text-white/60" />
                    </button>
                </div>

                {/* Minimal Drag Handle */}
                <div
                    onPointerDown={handlePointerDown}
                    className={cn(
                        "flex items-center justify-center py-1 cursor-move active:cursor-grabbing",
                        isFloating ? "bg-white/5" : "bg-transparent"
                    )}
                >
                    <div className="w-8 h-1 bg-white/20 rounded-full" />
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