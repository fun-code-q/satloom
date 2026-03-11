import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { VirtualKeyboardSettings, KeyboardTheme, KeyboardLayout, KeyboardPosition } from '@/components/virtual-keyboard/types'
import { DEFAULT_KEYBOARD_SETTINGS } from '@/components/virtual-keyboard/types'

interface VirtualKeyboardState extends VirtualKeyboardSettings {
    // Actions
    toggleEnabled: () => void
    toggleVisibility: () => void
    setEnabled: (enabled: boolean) => void
    setVisible: (visible: boolean) => void
    setPosition: (position: KeyboardPosition) => void
    setWidth: (width: number) => void
    setHeight: (height: number) => void
    setOpacity: (opacity: number) => void
    setTheme: (theme: KeyboardTheme) => void
    setBackgroundColor: (color: string) => void
    setTextColor: (color: string) => void
    setKeyTextSize: (size: number) => void
    setLayout: (layout: KeyboardLayout) => void
    setShowNumbersRow: (show: boolean) => void
    setHapticFeedback: (enabled: boolean) => void
    setIsFloating: (isFloating: boolean) => void
    setCoords: (coords: { x: number; y: number }) => void
    updateSettings: (settings: Partial<VirtualKeyboardSettings>) => void
    resetToDefaults: () => void
}

// Custom storage with prefix
const customStorage = {
    getItem: (name: string): string | null => {
        if (typeof window === 'undefined') return null
        const value = localStorage.getItem(`satloom-virtual-keyboard-${name}`)
        return value ?? null
    },
    setItem: (name: string, value: string): void => {
        if (typeof window === 'undefined') return
        localStorage.setItem(`satloom-virtual-keyboard-${name}`, value)
    },
    removeItem: (name: string): void => {
        if (typeof window === 'undefined') return
        localStorage.removeItem(`satloom-virtual-keyboard-${name}`)
    },
}

export const useVirtualKeyboardStore = create<VirtualKeyboardState>()(
    persist(
        (set) => ({
            ...DEFAULT_KEYBOARD_SETTINGS,

            toggleEnabled: () => set((state) => ({ isEnabled: !state.isEnabled })),

            toggleVisibility: () => set((state) => ({ isVisible: !state.isVisible })),

            setEnabled: (enabled: boolean) => set({ isEnabled: enabled }),

            setVisible: (visible: boolean) => set({ isVisible: visible }),

            setPosition: (position: KeyboardPosition) => set({ position }),

            setWidth: (width: number) => set({ width: Math.max(50, Math.min(100, width)) }),

            setHeight: (height: number) => set({ height: Math.max(150, Math.min(400, height)) }),

            setOpacity: (opacity: number) => set({ opacity: Math.max(50, Math.min(100, opacity)) }),

            setTheme: (theme: KeyboardTheme) => set({ theme }),

            setBackgroundColor: (color: string) => set({ backgroundColor: color }),

            setTextColor: (color: string) => set({ textColor: color }),

            setKeyTextSize: (size: number) => set({ keyTextSize: Math.max(12, Math.min(24, size)) }),

            setLayout: (layout: KeyboardLayout) => set({ layout }),

            setShowNumbersRow: (show: boolean) => set({ showNumbersRow: show }),

            setHapticFeedback: (enabled: boolean) => set({ hapticFeedback: enabled }),

            setIsFloating: (isFloating: boolean) => set({ isFloating }),

            setCoords: (coords: { x: number; y: number }) => set({ coords }),

            updateSettings: (settings: Partial<VirtualKeyboardSettings>) => set((state) => ({ ...state, ...settings })),

            resetToDefaults: () => set({ ...DEFAULT_KEYBOARD_SETTINGS }),
        }),
        {
            name: 'satloom-virtual-keyboard-settings',
            storage: createJSONStorage(() => customStorage),
            partialize: (state) => ({
                isEnabled: state.isEnabled,
                position: state.position,
                width: state.width,
                height: state.height,
                opacity: state.opacity,
                theme: state.theme,
                backgroundColor: state.backgroundColor,
                textColor: state.textColor,
                keyTextSize: state.keyTextSize,
                layout: state.layout,
                showNumbersRow: state.showNumbersRow,
                hapticFeedback: state.hapticFeedback,
                isFloating: state.isFloating,
                coords: state.coords,
            }),
        }
    )
)

// Singleton manager for external access
export const virtualKeyboardManager = {
    show: () => useVirtualKeyboardStore.getState().setEnabled(true),
    hide: () => useVirtualKeyboardStore.getState().setEnabled(false),
    toggle: () => useVirtualKeyboardStore.getState().toggleEnabled(),
    isEnabled: () => useVirtualKeyboardStore.getState().isEnabled,
}