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
import { Settings, X, Send, Plus, Smile, Mic, Paperclip, Keyboard as KeyboardIcon, ImageIcon, Camera, MapPin, User, FileText, Video, BarChart2, Calendar, Eye, Music2, Sparkles } from 'lucide-react'
import { KeyboardSettings } from '@/components/virtual-keyboard/keyboard-settings'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface VirtualKeyboardProps {
    inputRef?: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>
    onTextChange?: (text: string) => void
    onSend?: () => void
    onFileSelect?: (type: string, file?: File | any) => void
    onStartRecording?: (mode: "audio" | "video" | "photo") => void
    onPollCreate?: () => void
    onEventCreate?: () => void
    onMoodTrigger?: () => void
    onVanishMode?: () => void
    onSoundboard?: () => void
    onReactRoom?: () => void
    onStartVideoCall?: () => void
    onStartAudioCall?: () => void
    initialValue?: string
}

export function VirtualKeyboard({
    inputRef,
    onTextChange,
    onSend,
    onFileSelect,
    onStartRecording,
    onPollCreate,
    onEventCreate,
    onMoodTrigger,
    onVanishMode,
    onSoundboard,
    onReactRoom,
    onStartVideoCall,
    onStartAudioCall,
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
        setHeight,
        setWidth,
    } = useVirtualKeyboardStore()

    const [showSettings, setShowSettings] = useState(false)
    const [isShiftActive, setIsShiftActive] = useState(false)
    const [nativeKeyboardHeight, setNativeKeyboardHeight] = useState(0)
    const [isDragging, setIsDragging] = useState(false)
    const [isResizing, setIsResizing] = useState(false)
    const [showPlusMenu, setShowPlusMenu] = useState(false)
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
    const [dragDirection, setDragDirection] = useState<'horizontal' | 'vertical' | null>(null)
    const [headerMessage, setHeaderMessage] = useState('')
    const inputValueRef = useRef(initialValue)
    const shiftTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const keyboardRef = useRef<HTMLDivElement>(null)
    const fabRef = useRef<HTMLDivElement>(null)

    // Resize state
    const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 })

    const handleResizeDown = (e: React.PointerEvent) => {
        e.stopPropagation()
        setIsResizing(true)
        setResizeStart({
            x: e.clientX,
            y: e.clientY,
            width: width,
            height: height
        })
        const target = e.target as HTMLElement
        target.setPointerCapture(e.pointerId)
    }

    const handleResizeMove = (e: React.PointerEvent) => {
        if (!isResizing) return

        const deltaX = e.clientX - resizeStart.x
        const deltaY = e.clientY - resizeStart.y

        // Calculate new height (px)
        const newHeight = Math.max(180, Math.min(500, resizeStart.height + deltaY))
        setHeight(newHeight)

        // Calculate new width (percentage)
        const pixelDeltaX = deltaX
        const currentWidthPx = (window.innerWidth * resizeStart.width) / 100
        const newWidthPx = currentWidthPx + pixelDeltaX
        const newWidthPercent = Math.max(40, Math.min(100, (newWidthPx / window.innerWidth) * 100))
        setWidth(newWidthPercent)
    }

    const handleResizeUp = (e: React.PointerEvent) => {
        setIsResizing(false)
        const target = e.target as HTMLElement
        target.releasePointerCapture(e.pointerId)
    }

    // Dragging threshold
    const DRAG_THRESHOLD = 5

    // Constraints for keyboard (stay on screen)
    const constraintPosition = (x: number, y: number) => {
        const keyboardWidth = keyboardRef.current?.offsetWidth || 0
        const keyboardHeight = keyboardRef.current?.offsetHeight || 0
        const newX = Math.max(0, Math.min(window.innerWidth - keyboardWidth, x))
        const newY = Math.max(0, Math.min(window.innerHeight - keyboardHeight, y))
        return { x: newX, y: newY }
    }

    // Pointer events for keyboard dragging (when header is grabbed)
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
    }

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging || !isFloating) return
        const newX = e.clientX - dragOffset.x
        const newY = e.clientY - dragOffset.y
        const constrained = constraintPosition(newX, newY)
        setCoords(constrained)
    }

    const handlePointerUp = () => {
        setIsDragging(false)
    }

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
        const value = e.target.value
        setHeaderMessage(value)
        inputValueRef.current = value
        onTextChange?.(value)

        if (inputRef && 'current' in inputRef && inputRef.current) {
            inputRef.current.value = value
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
                setHeaderMessage(newValue)
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
                setHeaderMessage(newValue)
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
                setHeaderMessage(newValue)
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
                left: `${coords.x}px`,
                top: `${coords.y}px`,
                width: `${width}%`,
                position: 'fixed' as const,
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                transform: `scale(${isResizing ? 1.01 : 1})`,
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

    // Picker Helpers
    const triggerFileInput = (accept: string, type: string) => {
        const input = document.createElement("input")
        input.type = "file"
        input.accept = accept
        input.multiple = type !== "document"

        input.onchange = (e) => {
            const files = (e.target as HTMLInputElement).files
            if (files) {
                Array.from(files).forEach((file) => {
                    onFileSelect?.(type, file)
                })
            }
        }
        input.click()
    }

    const shareLocation = () => {
        if (navigator.geolocation) {
            toast.loading("Getting your location...", { id: "kb-location-loading" })
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const location = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                    }
                    toast.dismiss("kb-location-loading")
                    toast.success("Location shared!")
                    onFileSelect?.("location", location as any)
                },
                (error) => {
                    toast.dismiss("kb-location-loading")
                    toast.error("Could not get location")
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
            )
        } else {
            toast.error("Geolocation not supported")
        }
    }

    const shareContact = async () => {
        try {
            if ("contacts" in navigator && "ContactsManager" in window) {
                toast.loading("Opening contacts...", { id: "kb-contacts-loading" })
                const contacts = await (navigator as any).contacts.select(["name", "tel", "email"], { multiple: false })
                toast.dismiss("kb-contacts-loading")
                if (contacts.length > 0) {
                    const contact = contacts[0]
                    onFileSelect?.("contact", {
                        name: contact.name?.[0] || "Unknown",
                        phone: contact.tel?.[0] || "",
                        email: contact.email?.[0] || "",
                    } as any)
                    toast.success("Contact shared!")
                }
            } else {
                const name = prompt("Enter contact name:")
                const phone = prompt("Enter phone number:")
                if (name && phone) {
                    onFileSelect?.("contact", { name, phone, email: "" } as any)
                    toast.success("Contact shared!")
                }
            }
        } catch (error) {
            toast.error("Could not access contacts")
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
                    'fixed z-[1000] transition-transform duration-300 backdrop-blur-xl border border-white/10 overflow-hidden',
                    'flex flex-col rounded-2xl select-none',
                    isVisible ? 'opacity-100 scale-100' : 'opacity-0 pointer-events-none translate-y-4 scale-95',
                    isDragging ? 'opacity-80' : ''
                )}
                style={{
                    ...getPositionStyles(),
                    height: `${height}px`,
                    opacity: opacity / 100,
                    backgroundColor: backgroundColor,
                    transition: isDragging || isResizing ? 'none' : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                role="keyboard"
                aria-label="Virtual keyboard"
            >
                {/* Header with full chat controls */}
                <div
                    className={cn(
                        "flex flex-col bg-white/5 border-b border-white/10",
                        isFloating ? "cursor-move" : ""
                    )}
                    onPointerDown={isFloating ? handlePointerDown : undefined}
                >
                    {/* Minimal Drag Handle Indicator */}
                    <div className="w-full flex justify-center py-1">
                        <div className="w-12 h-1 bg-white/20 rounded-full" />
                    </div>

                    <div className="flex items-center gap-2 px-3 pb-3 pt-1">
                        <button
                            type="button"
                            onClick={() => setShowPlusMenu(!showPlusMenu)}
                            className={cn(
                                "p-2.5 rounded-full transition-all text-white/80",
                                showPlusMenu ? "bg-cyan-500 text-white rotate-45" : "bg-slate-700/50 hover:bg-slate-600/50"
                            )}
                            aria-label="More options"
                            title="Plus"
                        >
                            <Plus className="w-5 h-5" />
                        </button>

                        {/* Message input field */}
                        <div className="flex-1 relative">
                            <input
                                ref={(el) => {
                                    if (el && isEnabled) {
                                        // Auto focus when keyboard is enabled
                                        setTimeout(() => el.focus({ preventScroll: true }), 100)
                                    }
                                }}
                                type="text"
                                value={headerMessage}
                                onChange={handleHeaderInputChange}
                                placeholder="Type a message..."
                                className="w-full bg-slate-700/50 border border-white/10 rounded-full px-4 py-2 text-white text-base placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 h-10"
                                inputMode="none"
                            />
                        </div>

                        {/* Emoji button */}
                        <button
                            type="button"
                            onClick={() => setLayout(layout === 'symbols' ? 'qwerty' : 'symbols')}
                            className={cn(
                                "p-2.5 rounded-full transition-colors text-white/80",
                                layout === 'symbols' ? "bg-cyan-500/50" : "bg-slate-700/50 hover:bg-slate-600/50"
                            )}
                            aria-label="Add emoji"
                        >
                            <Smile className="w-5 h-5" />
                        </button>

                        {/* Keyboard Toggle button (to show/hide settings or layout) */}
                        <button
                            type="button"
                            onClick={() => setShowSettings(true)}
                            className="p-2.5 rounded-full bg-slate-700/50 hover:bg-slate-600/50 transition-colors text-white/80"
                            aria-label="Keyboard settings"
                        >
                            <Settings className="w-5 h-5" />
                        </button>

                        {/* Mic button */}
                        <button
                            type="button"
                            onClick={() => onStartRecording?.("audio")}
                            className="p-2.5 rounded-full bg-slate-700/50 hover:bg-slate-600/50 transition-colors text-white/80"
                            aria-label="Record voice"
                            title="Mic"
                        >
                            <Mic className="w-5 h-5" />
                        </button>

                        {/* Close button */}
                        <button
                            type="button"
                            onClick={() => toggleEnabled()}
                            className="p-2.5 rounded-full bg-red-500/20 hover:bg-red-500/40 transition-colors text-red-100"
                            aria-label="Close keyboard"
                            title="Close"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        {/* Send button */}
                        <button
                            type="button"
                            onClick={handleKeyboardSend}
                            disabled={!headerMessage.trim()}
                            className={cn(
                                "p-2.5 rounded-full transition-all flex items-center justify-center h-10 w-10",
                                headerMessage.trim()
                                    ? "bg-cyan-500 hover:bg-cyan-400 text-white shadow-lg"
                                    : "bg-white/10 text-white/30 cursor-not-allowed"
                            )}
                            aria-label="Send message"
                        >
                            <Send className="w-5 h-5 translate-x-0.5" />
                        </button>
                    </div>

                    {/* Scrollable Plus Menu */}
                    {showPlusMenu && (
                        <div className="flex items-center gap-4 px-4 py-3 bg-white/5 border-t border-white/5 overflow-x-auto scrollbar-hide animate-in slide-in-from-top-2 duration-200">
                            {[
                                { icon: ImageIcon, label: "Gallery", action: () => triggerFileInput("image/*,video/*", "gallery") },
                                { icon: Camera, label: "Camera", action: () => onStartRecording?.("photo") },
                                { icon: Mic, label: "Audio", action: () => onStartRecording?.("audio") },
                                { icon: MapPin, label: "Location", action: () => shareLocation() },
                                { icon: User, label: "Contact", action: () => shareContact() },
                                { icon: FileText, label: "Documents", action: () => triggerFileInput(".pdf,.doc,.docx,.txt", "document") },
                                { icon: BarChart2, label: "Poll", action: () => onPollCreate?.() },
                                { icon: Calendar, label: "Event", action: () => onEventCreate?.() },
                                { icon: Eye, label: "Vanish", action: () => onVanishMode?.() },
                                { icon: Music2, label: "Sounds", action: () => onSoundboard?.() },
                                { icon: Sparkles, label: "React", action: () => onReactRoom?.() },
                                { icon: Mic, label: "Audio Call", action: () => onStartAudioCall?.() },
                                { icon: Video, label: "Video Call", action: () => onStartVideoCall?.() },
                            ].map((item, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        item.action()
                                        setShowPlusMenu(false)
                                    }}
                                    className="flex flex-col items-center gap-1.5 min-w-[60px] group active:scale-95 transition-transform"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-slate-700/50 group-hover:bg-cyan-500/50 flex items-center justify-center text-white/70 group-hover:text-white transition-colors">
                                        <item.icon className="w-5 h-5" />
                                    </div>
                                    <span className="text-[10px] text-white/50 group-hover:text-white/80 transition-colors whitespace-nowrap">{item.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Keyboard rows */}
                <div className="flex-1 flex flex-col justify-center px-1 py-2 overflow-hidden">
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

                {/* Smooth Resize Handle (Bottom-Right) */}
                <div
                    onPointerDown={handleResizeDown}
                    onPointerMove={handleResizeMove}
                    onPointerUp={handleResizeUp}
                    className="absolute bottom-1 right-1 w-6 h-6 flex items-end justify-end cursor-nwse-resize active:cursor-nwse-resize z-[1001]"
                >
                    <div className="w-4 h-4 border-r-2 border-b-2 border-white/30 rounded-br-sm m-0.5" />
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