"use client"

import { useState } from 'react'
import { X, RotateCcw, Check } from 'lucide-react'
import { useVirtualKeyboardStore } from '@/stores/virtual-keyboard-store'
import type { KeyboardTheme, KeyboardLayout, KeyboardPosition } from './types'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

interface KeyboardSettingsProps {
    onClose: () => void
}

const THEMES: { value: KeyboardTheme; label: string }[] = [
    { value: 'dark', label: 'Dark' },
    { value: 'light', label: 'Light' },
    { value: 'transparent', label: 'Transparent' },
]

const LAYOUTS: { value: KeyboardLayout; label: string }[] = [
    { value: 'qwerty', label: 'QWERTY' },
    { value: 'numeric', label: '123' },
    { value: 'symbols', label: '#+=' },
]

const POSITIONS: { value: KeyboardPosition; label: string }[] = [
    { value: 'bottom', label: 'Bottom' },
    { value: 'top', label: 'Top' },
]

export function KeyboardSettings({ onClose }: KeyboardSettingsProps) {
    const {
        position,
        width,
        height,
        opacity,
        theme,
        backgroundColor,
        textColor,
        keyTextSize,
        layout,
        setPosition,
        setWidth,
        setHeight,
        setOpacity,
        setTheme,
        setBackgroundColor,
        setTextColor,
        setKeyTextSize,
        setLayout,
        setIsFloating,
        setCoords,
        isFloating,
        coords,
        resetToDefaults,
    } = useVirtualKeyboardStore()

    const [localTheme, setLocalTheme] = useState(theme)
    const [localPosition, setLocalPosition] = useState(position)
    const [localTextColor, setLocalTextColor] = useState(textColor)
    const [localBgColor, setLocalBgColor] = useState(backgroundColor)

    const handleThemeChange = (newTheme: KeyboardTheme) => {
        setLocalTheme(newTheme)
        setTheme(newTheme)

        // Apply default colors based on theme
        if (newTheme === 'dark') {
            setBackgroundColor('rgba(15, 23, 42, 0.85)')
            setTextColor('#ffffff')
            setLocalBgColor('rgba(15, 23, 42, 0.85)')
            setLocalTextColor('#ffffff')
        } else if (newTheme === 'light') {
            setBackgroundColor('rgba(226, 232, 240, 0.85)')
            setTextColor('#1e293b')
            setLocalBgColor('rgba(226, 232, 240, 0.85)')
            setLocalTextColor('#1e293b')
        } else {
            setBackgroundColor('rgba(15, 23, 42, 0.6)')
            setTextColor('#ffffff')
            setLocalBgColor('rgba(15, 23, 42, 0.6)')
            setLocalTextColor('#ffffff')
        }
    }

    const handleReset = () => {
        resetToDefaults()
        setLocalTheme('transparent')
        setLocalPosition('bottom')
        setLocalTextColor('#ffffff')
        setLocalBgColor('rgba(15, 23, 42, 0.85)')
    }

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50">
            <div
                className="bg-slate-800 rounded-lg w-full max-w-sm max-h-[90vh] overflow-y-auto mx-4 shadow-xl"
                role="dialog"
                aria-label="Keyboard Settings"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-700">
                    <h2 className="text-lg font-semibold text-white">Keyboard Settings</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-md hover:bg-slate-700 transition-colors"
                        aria-label="Close settings"
                    >
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                {/* Settings Content */}
                <div className="p-4 space-y-6">
                    {/* Position */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Position</label>
                        <div className="flex gap-2">
                            {POSITIONS.map((pos) => (
                                <button
                                    key={pos.value}
                                    type="button"
                                    onClick={() => {
                                        setLocalPosition(pos.value)
                                        setPosition(pos.value)
                                    }}
                                    className={cn(
                                        'flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors',
                                        localPosition === pos.value
                                            ? 'bg-cyan-600 text-white'
                                            : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                                    )}
                                >
                                    {pos.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Width */}
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <label className="text-sm font-medium text-gray-300">Width</label>
                            <span className="text-sm text-gray-400">{width}%</span>
                        </div>
                        <Slider
                            value={[width]}
                            onValueChange={([value]) => setWidth(value)}
                            min={50}
                            max={100}
                            step={1}
                            className="py-2"
                        />
                    </div>

                    {/* Height */}
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <label className="text-sm font-medium text-gray-300">Height</label>
                            <span className="text-sm text-gray-400">{height}px</span>
                        </div>
                        <Slider
                            value={[height]}
                            onValueChange={([value]) => setHeight(value)}
                            min={150}
                            max={400}
                            step={10}
                            className="py-2"
                        />
                    </div>

                    {/* Opacity */}
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <label className="text-sm font-medium text-gray-300">Opacity</label>
                            <span className="text-sm text-gray-400">{opacity}%</span>
                        </div>
                        <Slider
                            value={[opacity]}
                            onValueChange={([value]) => setOpacity(value)}
                            min={50}
                            max={100}
                            step={1}
                            className="py-2"
                        />
                    </div>

                    {/* Text Size */}
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <label className="text-sm font-medium text-gray-300">Text Size</label>
                            <span className="text-sm text-gray-400">{keyTextSize}px</span>
                        </div>
                        <Slider
                            value={[keyTextSize]}
                            onValueChange={([value]) => setKeyTextSize(value)}
                            min={12}
                            max={24}
                            step={1}
                            className="py-2"
                        />
                    </div>

                    {/* Theme */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Theme</label>
                        <div className="flex gap-2">
                            {THEMES.map((t) => (
                                <button
                                    key={t.value}
                                    type="button"
                                    onClick={() => handleThemeChange(t.value)}
                                    className={cn(
                                        'flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors',
                                        localTheme === t.value
                                            ? 'bg-cyan-600 text-white'
                                            : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                                    )}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Layout */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Default Layout</label>
                        <div className="flex gap-2">
                            {LAYOUTS.map((l) => (
                                <button
                                    key={l.value}
                                    type="button"
                                    onClick={() => setLayout(l.value)}
                                    className={cn(
                                        'flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors',
                                        layout === l.value
                                            ? 'bg-cyan-600 text-white'
                                            : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                                    )}
                                >
                                    {l.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Floating Mode Toggle */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Keyboard Mode</label>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setIsFloating(false)}
                                className={cn(
                                    'flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors',
                                    !isFloating
                                        ? 'bg-cyan-600 text-white'
                                        : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                                )}
                            >
                                Docked
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsFloating(true)}
                                className={cn(
                                    'flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors',
                                    isFloating
                                        ? 'bg-cyan-600 text-white'
                                        : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                                )}
                            >
                                Floating
                            </button>
                        </div>
                        {isFloating && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full mt-2 bg-slate-700 border-slate-600 text-xs"
                                onClick={() => setCoords({ x: 10, y: 30 })}
                            >
                                <RotateCcw className="w-3 h-3 mr-2" />
                                Reset Position
                            </Button>
                        )}
                    </div>

                    {/* Text Color */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Text Color</label>
                        <div className="flex items-center gap-3">
                            <input
                                type="color"
                                value={localTextColor}
                                onChange={(e) => {
                                    setLocalTextColor(e.target.value)
                                    setTextColor(e.target.value)
                                }}
                                className="w-10 h-10 rounded-md border border-slate-600 cursor-pointer"
                            />
                            <input
                                type="text"
                                value={localTextColor}
                                onChange={(e) => {
                                    setLocalTextColor(e.target.value)
                                    setTextColor(e.target.value)
                                }}
                                className="flex-1 bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white text-sm"
                                placeholder="#ffffff"
                            />
                        </div>
                    </div>

                    {/* Background Color */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Background Color</label>
                        <div className="flex items-center gap-3">
                            <input
                                type="color"
                                value={localBgColor.slice(0, 7)} // Get hex part
                                onChange={(e) => {
                                    const newColor = e.target.value
                                    const opacityValue = opacity / 100
                                    const rgbaColor = `${newColor}${Math.round(opacityValue * 255).toString(16).padStart(2, '0')}`
                                    setLocalBgColor(rgbaColor)
                                    setBackgroundColor(rgbaColor)
                                }}
                                className="w-10 h-10 rounded-md border border-slate-600 cursor-pointer"
                            />
                            <input
                                type="text"
                                value={localBgColor}
                                onChange={(e) => {
                                    setLocalBgColor(e.target.value)
                                    setBackgroundColor(e.target.value)
                                }}
                                className="flex-1 bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white text-sm"
                                placeholder="rgba(15, 23, 42, 0.85)"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex gap-3 p-4 border-t border-slate-700">
                    <Button
                        variant="outline"
                        onClick={handleReset}
                        className="flex-1 bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
                    >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reset
                    </Button>
                    <Button
                        onClick={onClose}
                        className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white"
                    >
                        <Check className="w-4 h-4 mr-2" />
                        Save
                    </Button>
                </div>
            </div>
        </div>
    )
}