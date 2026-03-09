/**
 * Haptic Feedback Utility
 * Provides both vibration feedback for mobile devices and visual feedback for all devices
 */

// Vibration patterns for different haptic types
const vibrationPatterns: Record<string, number[]> = {
    light: [10],
    medium: [20],
    heavy: [50],
    success: [20, 30, 20],
    error: [50, 30, 50],
    warning: [30, 20, 30],
    selection: [5],
    soft: [8],
    rigid: [15],
}

export type HapticType = keyof typeof vibrationPatterns

/**
 * Trigger haptic feedback
 * @param type - The type of haptic feedback to trigger
 * @param options - Additional options for visual feedback
 */
export function triggerHaptic(
    type: HapticType = "light",
    options: {
        visual?: boolean
        element?: HTMLElement
        className?: string
    } = {}
): void {
    const { visual = true, element, className = "haptic-flash" } = options

    // Trigger vibration on mobile devices
    if ("vibrate" in navigator && navigator.vibrate) {
        const pattern = vibrationPatterns[type] || [10]
        navigator.vibrate(pattern)
    }

    // Trigger visual feedback
    if (visual && element) {
        // Add the haptic class
        element.classList.add(className)

        // Remove the class after animation completes
        const removeClass = () => {
            element.classList.remove(className)
            element.removeEventListener("animationend", removeClass)
        }
        element.addEventListener("animationend", removeClass)
    }
}

/**
 * Success haptic feedback
 */
export function hapticSuccess(element?: HTMLElement): void {
    triggerHaptic("success", { element, className: "haptic-success" })
}

/**
 * Error haptic feedback
 */
export function hapticError(element?: HTMLElement): void {
    triggerHaptic("error", { element, className: "haptic-error" })
}

/**
 * Warning haptic feedback
 */
export function hapticWarning(element?: HTMLElement): void {
    triggerHaptic("warning", { element })
}

/**
 * Light haptic feedback for taps
 */
export function hapticLight(element?: HTMLElement): void {
    triggerHaptic("light", { element })
}

/**
 * Medium haptic feedback for important actions
 */
export function hapticMedium(element?: HTMLElement): void {
    triggerHaptic("medium", { element })
}

/**
 * Heavy haptic feedback for critical actions
 */
export function hapticHeavy(element?: HTMLElement): void {
    triggerHaptic("heavy", { element })
}

/**
 * Selection haptic feedback
 */
export function hapticSelection(element?: HTMLElement): void {
    triggerHaptic("selection", { element })
}

/**
 * Shake animation for errors
 */
export function hapticShake(element: HTMLElement): void {
    triggerHaptic("error", { element, className: "haptic-shake" })
}

/**
 * Pulse animation for notifications
 */
export function hapticPulse(element: HTMLElement): void {
    element.classList.add("haptic-pulse")
}

/**
 * Stop pulse animation
 */
export function hapticPulseStop(element: HTMLElement): void {
    element.classList.remove("haptic-pulse")
}

/**
 * Ring animation for emphasis
 */
export function hapticRing(element: HTMLElement): void {
    element.classList.add("haptic-ring")
}

/**
 * Stop ring animation
 */
export function hapticRingStop(element: HTMLElement): void {
    element.classList.remove("haptic-ring")
}

/**
 * Apply haptic scale effect to an element
 */
export function hapticScale(element: HTMLElement): void {
    element.classList.add("haptic")
    const removeScale = () => {
        element.classList.remove("haptic")
        element.removeEventListener("transitionend", removeScale)
    }
    element.addEventListener("transitionend", removeScale)
}

/**
 * React Hook for haptic feedback
 */
export function useHaptic() {
    return {
        success: hapticSuccess,
        error: hapticError,
        warning: hapticWarning,
        light: hapticLight,
        medium: hapticMedium,
        heavy: hapticHeavy,
        selection: hapticSelection,
        shake: hapticShake,
        pulse: hapticPulse,
        pulseStop: hapticPulseStop,
        ring: hapticRing,
        ringStop: hapticRingStop,
        scale: hapticScale,
        trigger: triggerHaptic,
    }
}

/**
 * Check if device supports vibration
 */
export function supportsVibration(): boolean {
    return "vibrate" in navigator && typeof navigator.vibrate === "function"
}

/**
 * Check if device supports haptic feedback
 */
export function supportsHaptic(): boolean {
    return supportsVibration()
}

/**
 * Custom vibration pattern
 */
export function vibrate(pattern: number | number[]): void {
    if ("vibrate" in navigator && navigator.vibrate) {
        navigator.vibrate(pattern)
    }
}
