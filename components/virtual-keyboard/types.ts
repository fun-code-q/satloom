// Virtual Keyboard Types

export type KeyboardTheme = 'dark' | 'light' | 'transparent'
export type KeyboardLayout = 'qwerty' | 'numeric' | 'symbols'
export type KeyboardPosition = 'bottom' | 'top'

export type KeyType =
    | 'letter'
    | 'number'
    | 'symbol'
    | 'space'
    | 'backspace'
    | 'enter'
    | 'shift'
    | 'switch'
    | 'comma'
    | 'dot'
    | 'domain'

export interface KeyboardKeyData {
    display: string
    value: string
    type: KeyType
    width?: string
}

export interface VirtualKeyboardSettings {
    // Visibility
    isEnabled: boolean
    isVisible: boolean

    // Position & Size
    position: KeyboardPosition
    width: number
    height: number

    // Appearance
    opacity: number
    theme: KeyboardTheme
    backgroundColor: string
    textColor: string
    keyTextSize: number

    // Keyboard Layout
    layout: KeyboardLayout
    showNumbersRow: boolean
    hapticFeedback: boolean

    // Floating State
    isFloating: boolean
    coords: { x: number; y: number }
}

export const DEFAULT_KEYBOARD_SETTINGS: VirtualKeyboardSettings = {
    isEnabled: false,
    isVisible: false,
    position: 'bottom',
    width: 100,
    height: 220,
    opacity: 95,
    theme: 'transparent',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    textColor: '#ffffff',
    keyTextSize: 16,
    layout: 'qwerty',
    showNumbersRow: true,
    hapticFeedback: true,
    isFloating: false,
    coords: { x: 0, y: 0 },
}

// QWERTY Layout
export const QWERTY_LAYOUT: KeyboardKeyData[][] = [
    // Row 1: Numbers
    [
        { display: '1', value: '1', type: 'number' },
        { display: '2', value: '2', type: 'number' },
        { display: '3', value: '3', type: 'number' },
        { display: '4', value: '4', type: 'number' },
        { display: '5', value: '5', type: 'number' },
        { display: '6', value: '6', type: 'number' },
        { display: '7', value: '7', type: 'number' },
        { display: '8', value: '8', type: 'number' },
        { display: '9', value: '9', type: 'number' },
        { display: '0', value: '0', type: 'number' },
        { display: '-', value: '-', type: 'symbol' },
        { display: '⌫', value: 'backspace', type: 'backspace', width: 'flex-1' },
    ],
    // Row 2: Q-P
    [
        { display: 'Q', value: 'q', type: 'letter' },
        { display: 'W', value: 'w', type: 'letter' },
        { display: 'E', value: 'e', type: 'letter' },
        { display: 'R', value: 'r', type: 'letter' },
        { display: 'T', value: 't', type: 'letter' },
        { display: 'Y', value: 'y', type: 'letter' },
        { display: 'U', value: 'u', type: 'letter' },
        { display: 'I', value: 'i', type: 'letter' },
        { display: 'O', value: 'o', type: 'letter' },
        { display: 'P', value: 'p', type: 'letter' },
    ],
    // Row 3: A-L
    [
        { display: 'A', value: 'a', type: 'letter' },
        { display: 'S', value: 's', type: 'letter' },
        { display: 'D', value: 'd', type: 'letter' },
        { display: 'F', value: 'f', type: 'letter' },
        { display: 'G', value: 'g', type: 'letter' },
        { display: 'H', value: 'h', type: 'letter' },
        { display: 'J', value: 'j', type: 'letter' },
        { display: 'K', value: 'k', type: 'letter' },
        { display: 'L', value: 'l', type: 'letter' },
    ],
    // Row 4: Shift-Z-M
    [
        { display: '⇧', value: 'shift', type: 'shift', width: 'w-12' },
        { display: 'Z', value: 'z', type: 'letter' },
        { display: 'X', value: 'x', type: 'letter' },
        { display: 'C', value: 'c', type: 'letter' },
        { display: 'V', value: 'v', type: 'letter' },
        { display: 'B', value: 'b', type: 'letter' },
        { display: 'N', value: 'n', type: 'letter' },
        { display: 'M', value: 'm', type: 'letter' },
        { display: '123', value: 'switch-numeric', type: 'switch', width: 'flex-1' },
    ],
    // Row 5: Bottom row
    [
        { display: '123', value: 'switch-numeric', type: 'switch', width: 'w-14' },
        { display: ',', value: ',', type: 'comma', width: 'w-10' },
        { display: '␣', value: ' ', type: 'space', width: 'flex-1' },
        { display: '.', value: '.', type: 'dot', width: 'w-10' },
        { display: '↵', value: 'enter', type: 'enter', width: 'w-16' },
    ],
]

// Numeric Layout
export const NUMERIC_LAYOUT: KeyboardKeyData[][] = [
    // Row 1
    [
        { display: '1', value: '1', type: 'number' },
        { display: '2', value: '2', type: 'number' },
        { display: '3', value: '3', type: 'number' },
        { display: '4', value: '4', type: 'number' },
        { display: '5', value: '5', type: 'number' },
        { display: '6', value: '6', type: 'number' },
        { display: '7', value: '7', type: 'number' },
        { display: '8', value: '8', type: 'number' },
        { display: '9', value: '9', type: 'number' },
        { display: '0', value: '0', type: 'number' },
    ],
    // Row 2
    [
        { display: '-', value: '-', type: 'symbol' },
        { display: '/', value: '/', type: 'symbol' },
        { display: ':', value: ':', type: 'symbol' },
        { display: ';', value: ';', type: 'symbol' },
        { display: '(', value: '(', type: 'symbol' },
        { display: ')', value: ')', type: 'symbol' },
        { display: '$', value: '$', type: 'symbol' },
        { display: '&', value: '&', type: 'symbol' },
        { display: '@', value: '@', type: 'symbol' },
        { display: '"', value: '"', type: 'symbol' },
    ],
    // Row 3
    [
        { display: '#+=', value: 'switch-symbols', type: 'switch', width: 'w-14' },
        { display: '.', value: '.', type: 'dot', width: 'w-10' },
        { display: ',', value: ',', type: 'comma', width: 'w-10' },
        { display: '?', value: '?', type: 'symbol', width: 'w-10' },
        { display: '!', value: '!', type: 'symbol', width: 'w-10' },
        { display: "'", value: "'", type: 'symbol', width: 'w-10' },
        { display: '⌫', value: 'backspace', type: 'backspace', width: 'flex-1' },
    ],
    // Row 4
    [
        { display: 'ABC', value: 'switch-qwerty', type: 'switch', width: 'w-14' },
        { display: '.', value: '.', type: 'dot', width: 'w-10' },
        { display: ',', value: ',', type: 'comma', width: 'w-10' },
        { display: '?', value: '?', type: 'symbol', width: 'w-10' },
        { display: '!', value: '!', type: 'symbol', width: 'w-10' },
        { display: "'", value: "'", type: 'symbol', width: 'w-10' },
        { display: '⌫', value: 'backspace', type: 'backspace', width: 'flex-1' },
    ],
    // Row 5
    [
        { display: '123', value: 'switch-numeric', type: 'switch', width: 'w-14' },
        { display: '␣', value: ' ', type: 'space', width: 'flex-1' },
        { display: '↵', value: 'enter', type: 'enter', width: 'w-20' },
    ],
]

// Symbols Layout
export const SYMBOLS_LAYOUT: KeyboardKeyData[][] = [
    // Row 1
    [
        { display: '[', value: '[', type: 'symbol' },
        { display: ']', value: ']', type: 'symbol' },
        { display: '{', value: '{', type: 'symbol' },
        { display: '}', value: '}', type: 'symbol' },
        { display: '#', value: '#', type: 'symbol' },
        { display: '%', value: '%', type: 'symbol' },
        { display: '^', value: '^', type: 'symbol' },
        { display: '*', value: '*', type: 'symbol' },
        { display: '+', value: '+', type: 'symbol' },
        { display: '=', value: '=', type: 'symbol' },
    ],
    // Row 2
    [
        { display: '_', value: '_', type: 'symbol' },
        { display: '\\', value: '\\', type: 'symbol' },
        { display: '|', value: '|', type: 'symbol' },
        { display: '~', value: '~', type: 'symbol' },
        { display: '<', value: '<', type: 'symbol' },
        { display: '>', value: '>', type: 'symbol' },
        { display: '€', value: '€', type: 'symbol' },
        { display: '£', value: '£', type: 'symbol' },
        { display: '¥', value: '¥', type: 'symbol' },
        { display: '•', value: '•', type: 'symbol' },
    ],
    // Row 3
    [
        { display: '123', value: 'switch-numeric', type: 'switch', width: 'w-14' },
        { display: '.', value: '.', type: 'dot', width: 'w-10' },
        { display: ',', value: ',', type: 'comma', width: 'w-10' },
        { display: '?', value: '?', type: 'symbol', width: 'w-10' },
        { display: '!', value: '!', type: 'symbol', width: 'w-10' },
        { display: "'", value: "'", type: 'symbol', width: 'w-10' },
        { display: '⌫', value: 'backspace', type: 'backspace', width: 'flex-1' },
    ],
    // Row 4
    [
        { display: 'ABC', value: 'switch-qwerty', type: 'switch', width: 'w-14' },
        { display: '.', value: '.', type: 'dot', width: 'w-10' },
        { display: ',', value: ',', type: 'comma', width: 'w-10' },
        { display: '?', value: '?', type: 'symbol', width: 'w-10' },
        { display: '!', value: '!', type: 'symbol', width: 'w-10' },
        { display: "'", value: "'", type: 'symbol', width: 'w-10' },
        { display: '⌫', value: 'backspace', type: 'backspace', width: 'flex-1' },
    ],
    // Row 5
    [
        { display: '123', value: 'switch-numeric', type: 'switch', width: 'w-14' },
        { display: '␣', value: ' ', type: 'space', width: 'flex-1' },
        { display: '↵', value: 'enter', type: 'enter', width: 'w-20' },
    ],
]