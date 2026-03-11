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
        setLayout,
        toggleEnabled,
        setVisible,
    } = useVirtualKeyboardStore()

    const [showSettings, setShowSettings] = useState(false)
    const [isShiftActive, setIsShiftActive] = useState(false)
    const [nativeKeyboardHeight, setNativeKeyboardHeight] = useState(0)
    const inputValueRef = useRef(initialValue)
    const shiftTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
        if (!isMobile || !isEnabled) {
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
                // Enter key - could trigger submit
                if (inputRef && 'current' in inputRef && inputRef.current) {
                    inputRef.current.dispatchEvent(new Event('submit', { bubbles: true }))
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
                    }, 1000)
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
        const baseStyles = {}

        if (position === 'bottom') {
            return {
                ...baseStyles,
                bottom: nativeKeyboardHeight > 0 ? `${nativeKeyboardHeight}px` : '0px',
            }
        } else {
            return {
                ...baseStyles,
                top: '0px',
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
                className={cn(
                    'fixed left-0 right-0 z-[100] transition-all duration-200',
                    'flex flex-col',
                    isVisible ? 'translate-y-0' : 'translate-y-full'
                )}
                style={{
                    ...getPositionStyles(),
                    height: `${height}px`,
                    width: `${width}%`,
                    left: `${(100 - width) / 2}%`,
                    opacity: opacity / 100,
                    backgroundColor: backgroundColor,
                }}
                role="keyboard"
                aria-label="Virtual keyboard"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 font-medium">
                            {layout === 'qwerty' ? 'QWERTY' : layout === 'numeric' ? '123' : '#+='}
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => setShowSettings(true)}
                            className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
                            aria-label="Keyboard settings"
                        >
                            <Settings className="w-4 h-4 text-gray-400" />
                        </button>
                        <button
                            type="button"
                            onClick={toggleEnabled}
                            className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
                            aria-label="Close keyboard"
                        >
                            <X className="w-4 h-4 text-gray-400" />
                        </button>
                    </div>
                </div>

                {/* Keyboard rows */}
                <div className="flex-1 flex flex-col justify-center py-1 overflow-hidden">
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