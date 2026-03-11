"use client"

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { KeyboardKeyData, KeyboardTheme } from './types'

interface KeyboardKeyProps {
    keyData: KeyboardKeyData
    theme: KeyboardTheme
    textColor: string
    textSize: number
    onKeyPress: (key: KeyboardKeyData) => void
    isShiftActive?: boolean
    className?: string
}

export function KeyboardKey({
    keyData,
    theme,
    textColor,
    textSize,
    onKeyPress,
    isShiftActive = false,
    className = '',
}: KeyboardKeyProps) {
    const [isPressed, setIsPressed] = useState(false)

    const handlePress = useCallback(() => {
        setIsPressed(true)

        // Haptic feedback if enabled
        if (navigator.vibrate && typeof navigator.vibrate === 'function') {
            navigator.vibrate(10)
        }

        onKeyPress(keyData)

        setTimeout(() => setIsPressed(false), 100)
    }, [keyData, onKeyPress])

    // Get theme-based styles
    const getThemeStyles = () => {
        switch (theme) {
            case 'dark':
                return {
                    base: 'bg-slate-700',
                    pressed: 'bg-slate-600',
                    special: 'bg-slate-600',
                    specialPressed: 'bg-slate-500',
                }
            case 'light':
                return {
                    base: 'bg-gray-200',
                    pressed: 'bg-gray-300',
                    special: 'bg-gray-300',
                    specialPressed: 'bg-gray-400',
                }
            case 'transparent':
            default:
                return {
                    base: 'bg-slate-700/60',
                    pressed: 'bg-slate-600/80',
                    special: 'bg-slate-600/60',
                    specialPressed: 'bg-slate-500/80',
                }
        }
    }

    const styles = getThemeStyles()

    // Determine if this is a special key
    const isSpecial = ['backspace', 'enter', 'shift', 'switch', 'space'].includes(keyData.type)
    const isSwitchKey = keyData.type === 'switch'
    const isShiftKey = keyData.type === 'shift'
    const isSpaceKey = keyData.type === 'space'

    // Handle display value based on shift state
    const displayValue = isShiftActive && keyData.type === 'letter'
        ? keyData.display.toUpperCase()
        : keyData.display

    const handleKeyDown = (e: React.MouseEvent) => {
        e.preventDefault()
    }

    return (
        <button
            type="button"
            aria-label={`${keyData.display} key`}
            onClick={handlePress}
            onMouseDown={handleKeyDown}
            className={cn(
                'flex items-center justify-center rounded-md transition-all duration-75 select-none',
                'focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-1',
                'active:scale-95 active:translate-y-0.5',
                isPressed
                    ? (isSpecial ? styles.specialPressed : styles.pressed)
                    : (isSpecial ? styles.special : styles.base),
                isShiftActive && isShiftKey ? 'bg-cyan-600' : '',
                keyData.width || 'flex-1',
                className
            )}
            style={{
                color: textColor,
                fontSize: `${textSize}px`,
                minHeight: keyData.type === 'space' ? '44px' : '40px',
                aspectRatio: keyData.type === 'space' ? 'auto' : '1',
            }}
        >
            {isShiftKey && isShiftActive ? (
                <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path d="M12 2L4 12l8 10 8-10L12 2zm0 4l4 6-4 6-4-6 4-6z" />
                </svg>
            ) : (
                <span className={cn(
                    'font-medium',
                    isSpaceKey ? 'text-xs tracking-widest' : '',
                    isSwitchKey ? 'text-xs' : '',
                    isShiftKey ? 'text-sm' : ''
                )}>
                    {displayValue}
                </span>
            )}
        </button>
    )
}