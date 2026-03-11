"use client"

import { KeyboardKey } from './keyboard-key'
import type { KeyboardKeyData, KeyboardTheme } from './types'
import { cn } from '@/lib/utils'

interface KeyboardRowProps {
    keys: KeyboardKeyData[]
    theme: KeyboardTheme
    textColor: string
    textSize: number
    onKeyPress: (key: KeyboardKeyData) => void
    isShiftActive?: boolean
    className?: string
}

export function KeyboardRow({
    keys,
    theme,
    textColor,
    textSize,
    onKeyPress,
    isShiftActive = false,
    className = '',
}: KeyboardRowProps) {
    return (
        <div
            className={cn(
                'flex items-center gap-1 px-1 py-0.5',
                className
            )}
            role="row"
        >
            {keys.map((key, index) => (
                <KeyboardKey
                    key={`${key.value}-${index}`}
                    keyData={key}
                    theme={theme}
                    textColor={textColor}
                    textSize={textSize}
                    onKeyPress={onKeyPress}
                    isShiftActive={isShiftActive}
                    className={key.width}
                />
            ))}
        </div>
    )
}