// Virtual Keyboard Components
export { VirtualKeyboard, useVirtualKeyboard } from './virtual-keyboard'
export { KeyboardSettings } from './keyboard-settings'
export { KeyboardKey } from './keyboard-key'
export { KeyboardRow } from './keyboard-row'

// Types
export type {
    KeyboardTheme,
    KeyboardLayout,
    KeyboardPosition,
    KeyType,
    KeyboardKeyData,
    VirtualKeyboardSettings,
} from './types'

// Store
export {
    useVirtualKeyboardStore,
    virtualKeyboardManager,
} from '@/stores/virtual-keyboard-store'

// Layouts
export {
    QWERTY_LAYOUT,
    NUMERIC_LAYOUT,
    SYMBOLS_LAYOUT,
    DEFAULT_KEYBOARD_SETTINGS,
} from './types'