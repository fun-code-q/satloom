/**
 * Error handling utilities with toast notifications
 */

import { toast } from "sonner"
import { ERROR_MESSAGES } from "./constants"

/**
 * Error severity levels
 */
export type ErrorSeverity = "info" | "warning" | "error" | "critical"

/**
 * Custom error class with severity support
 */
export class AppError extends Error {
    severity: ErrorSeverity
    code: string
    details?: any

    constructor(message: string, severity: ErrorSeverity = "error", code: string = "UNKNOWN", details?: any) {
        super(message)
        this.name = "AppError"
        this.severity = severity
        this.code = code
        this.details = details
    }
}

/**
 * Handle error with toast notification
 * @param error - The error to handle
 * @param options - Toast options
 */
export function handleError(
    error: unknown,
    options?: {
        showToast?: boolean
        severity?: ErrorSeverity
        title?: string
        duration?: number
    }
): AppError | null {
    const { showToast = true, severity = "error", title } = options || {}

    // Convert to AppError if not already
    const appError = error instanceof AppError ? error : createAppError(error)

    // Log error
    console.error(`[${appError.severity.toUpperCase()}] ${appError.code}:`, appError.message, appError.details)

    // Show toast if enabled
    if (showToast) {
        showErrorToast(appError, title)
    }

    return appError
}

/**
 * Create AppError from unknown error
 */
export function createAppError(error: unknown): AppError {
    if (error instanceof AppError) {
        return error
    }

    if (error instanceof Error) {
        // Map known error messages to codes
        const code = mapErrorToCode(error.message)
        return new AppError(error.message, mapToSeverity(code), code, error)
    }

    return new AppError("An unexpected error occurred", "error", "UNKNOWN", error)
}

/**
 * Map error message to error code
 */
function mapErrorToCode(message: string): string {
    const lowerMessage = message.toLowerCase()

    if (lowerMessage.includes("network") || lowerMessage.includes("fetch")) {
        return "NETWORK_ERROR"
    }
    if (lowerMessage.includes("permission") || lowerMessage.includes("denied")) {
        return "PERMISSION_DENIED"
    }
    if (lowerMessage.includes("not found") || lowerMessage.includes("404")) {
        return "NOT_FOUND"
    }
    if (lowerMessage.includes("unauthorized") || lowerMessage.includes("401")) {
        return "UNAUTHORIZED"
    }
    if (lowerMessage.includes("timeout") || lowerMessage.includes("timed out")) {
        return "TIMEOUT"
    }
    if (lowerMessage.includes("validation") || lowerMessage.includes("invalid")) {
        return "VALIDATION_ERROR"
    }
    if (lowerMessage.includes("firebase") || lowerMessage.includes("database")) {
        return "FIREBASE_ERROR"
    }

    return "UNKNOWN_ERROR"
}

/**
 * Map error code to severity
 */
function mapToSeverity(code: string): ErrorSeverity {
    switch (code) {
        case "NETWORK_ERROR":
            return "warning"
        case "PERMISSION_DENIED":
            return "warning"
        case "TIMEOUT":
            return "warning"
        case "CRITICAL_ERROR":
            return "critical"
        default:
            return "error"
    }
}

/**
 * Show error toast notification
 */
export function showErrorToast(error: AppError, customTitle?: string): void {
    const title = customTitle || getErrorTitle(error.severity)

    switch (error.severity) {
        case "info":
            toast.info(title, {
                description: error.message,
                duration: 3000,
            })
            break
        case "warning":
            toast.warning(title, {
                description: error.message,
                duration: 4000,
            })
            break
        case "critical":
            toast.error(title, {
                description: error.message,
                duration: 5000,
                style: { background: "#dc2626", color: "#fff" },
            })
            break
        default:
            toast.error(title, {
                description: error.message,
                duration: 3000,
            })
    }
}

/**
 * Get error title based on severity
 */
function getErrorTitle(severity: ErrorSeverity): string {
    switch (severity) {
        case "info":
            return "Information"
        case "warning":
            return "Warning"
        case "critical":
            return "Critical Error"
        default:
            return "Error"
    }
}

/**
 * Show success toast
 */
export function showSuccess(message: string, description?: string): void {
    toast.success(message, {
        description,
        duration: 3000,
    })
}

/**
 * Show info toast
 */
export function showInfo(message: string, description?: string): void {
    toast.info(message, {
        description,
        duration: 3000,
    })
}

/**
 * Async error wrapper
 * @param promise - Promise to wrap
 * @param options - Error handling options
 */
export async function handleAsync<T>(
    promise: Promise<T>,
    options?: {
        successMessage?: string
        errorMessage?: string
        showToast?: boolean
    }
): Promise<{ data: T | null; error: AppError | null }> {
    try {
        const data = await promise

        if (options?.successMessage) {
            toast.success(options.successMessage)
        }

        return { data, error: null }
    } catch (err) {
        const error = handleError(err, {
            showToast: options?.showToast !== false,
            title: options?.errorMessage,
        })

        return { data: null, error }
    }
}

/**
 * Retry function with exponential backoff
 * @param fn - Function to retry
 * @param retries - Number of retries (default 3)
 * @param delay - Initial delay in ms (default 1000)
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    retries: number = 3,
    delay: number = 1000
): Promise<T> {
    try {
        return await fn()
    } catch (error) {
        if (retries === 0) {
            throw error
        }

        // Exponential backoff with jitter
        const waitTime = delay * Math.pow(2, 3 - retries) + Math.random() * delay
        await new Promise((resolve) => setTimeout(resolve, waitTime))

        return withRetry(fn, retries - 1, delay)
    }
}

/**
 * Safe async function wrapper
 * @param fn - Async function to wrap
 * @param fallback - Fallback value on error
 */
export function safeAsync<T>(
    fn: () => Promise<T>,
    fallback: T
): Promise<T> {
    return fn().catch(() => fallback)
}

/**
 * Assert function for runtime checks
 * @param condition - Condition to check
 * @param message - Error message if condition fails
 * @param severity - Error severity
 */
export function assert(
    condition: any,
    message: string,
    severity: ErrorSeverity = "error"
): asserts condition {
    if (!condition) {
        throw new AppError(message, severity, "ASSERTION_FAILED")
    }
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyError(error: unknown): string {
    if (error instanceof AppError) {
        return ERROR_MESSAGES[error.code as keyof typeof ERROR_MESSAGES] || error.message
    }

    if (error instanceof Error) {
        const code = mapErrorToCode(error.message)
        return ERROR_MESSAGES[code as keyof typeof ERROR_MESSAGES] || error.message
    }

    return ERROR_MESSAGES.GENERIC_ERROR
}
