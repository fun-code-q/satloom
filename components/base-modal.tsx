"use client"

import React, { useEffect, useCallback, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

interface BaseModalProps {
    isOpen: boolean
    onClose: () => void
    title: string
    description?: string
    children: React.ReactNode
    isLoading?: boolean
    loadingText?: string
    size?: "sm" | "md" | "lg" | "xl" | "full"
    showCloseButton?: boolean
    closeOnOutsideClick?: boolean
    closeOnEscape?: boolean
    className?: string
}

/**
 * Base modal component with common functionality
 */
export function BaseModal({
    isOpen,
    onClose,
    title,
    description,
    children,
    isLoading = false,
    loadingText = "Loading...",
    size = "md",
    showCloseButton = true,
    closeOnOutsideClick = true,
    closeOnEscape = true,
    className = "",
}: BaseModalProps) {
    const focusRef = useRef<HTMLButtonElement>(null)
    const previousActiveElement = useRef<HTMLElement | null>(null)

    // Handle escape key
    useEffect(() => {
        if (!closeOnEscape || !isOpen) return

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose()
            }
        }

        document.addEventListener("keydown", handleEscape)
        return () => document.removeEventListener("keydown", handleEscape)
    }, [closeOnEscape, isOpen, onClose])

    // Focus trap and restore
    useEffect(() => {
        if (isOpen) {
            previousActiveElement.current = document.activeElement as HTMLElement
            // Focus the first focusable element
            setTimeout(() => {
                const focusableElement = document.querySelector<HTMLElement>(
                    '[data-modal-focus="true"]'
                )
                if (focusableElement) {
                    focusableElement.focus()
                } else {
                    focusRef.current?.focus()
                }
            }, 100)
        } else {
            // Restore focus when modal closes
            previousActiveElement.current?.focus()
        }
    }, [isOpen])

    // Handle tab navigation for focus trap
    const handleKeyDown = useCallback(
        (event: React.KeyboardEvent) => {
            if (event.key !== "Tab" || !isOpen) return

            const focusableElements = document.querySelectorAll<HTMLElement>(
                '[data-modal-focus="true"], [role="button"]:not([disabled]), button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]'
            )

            const firstElement = focusableElements[0]
            const lastElement = focusableElements[focusableElements.length - 1]

            if (event.shiftKey && document.activeElement === firstElement) {
                event.preventDefault()
                lastElement?.focus()
            } else if (!event.shiftKey && document.activeElement === lastElement) {
                event.preventDefault()
                firstElement?.focus()
            }
        },
        [isOpen]
    )

    const sizeClasses = {
        sm: "w-full max-w-sm mx-4 sm:mx-auto",
        md: "w-full max-w-md mx-4 sm:mx-auto",
        lg: "w-full max-w-lg mx-4 sm:mx-auto",
        xl: "w-full max-w-xl mx-4 sm:mx-auto",
        full: "w-full max-w-4xl mx-4 sm:mx-auto",
    }

    return (
        <Dialog open={isOpen} onOpenChange={closeOnOutsideClick ? onClose : undefined}>
            <DialogContent
                className={`bg-slate-800 border-slate-700 text-white ${sizeClasses[size]} max-h-[90vh] overflow-y-auto ${className}`}
                onKeyDown={handleKeyDown}
                aria-describedby={description ? "modal-description" : undefined}
                hideCloseButton={!showCloseButton || isLoading}
            >
                {/* Loading overlay */}
                {isLoading && (
                    <div className="absolute inset-0 bg-slate-800/80 z-10 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
                            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                            <span className="text-gray-300">{loadingText}</span>
                        </div>
                    </div>
                )}

                {/* Header */}
                <DialogHeader className={isLoading ? "opacity-50" : ""}>
                    <DialogTitle className="text-cyan-400 text-lg sm:text-xl">{title}</DialogTitle>
                    {description && (
                        <p id="modal-description" className="text-sm text-gray-400 mt-1">
                            {description}
                        </p>
                    )}
                </DialogHeader>

                {/* Content */}
                <div className={`${isLoading ? "opacity-50 pointer-events-none" : ""} p-4 sm:p-6`}>
                    {children}
                </div>
            </DialogContent>
        </Dialog>
    )
}

/**
 * Confirmation modal component
 */
interface ConfirmModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    variant?: "danger" | "warning" | "default"
    isLoading?: boolean
}

export function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = "default",
    isLoading = false,
}: ConfirmModalProps) {
    const confirmButtonVariant = variant === "danger" ? "destructive" : "default"

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            size="sm"
            isLoading={isLoading}
        >
            <div className="space-y-6">
                <p className="text-gray-300">{message}</p>

                <div className="flex flex-col sm:flex-row justify-end gap-3">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={isLoading}
                        className="border-slate-600 w-full sm:w-auto min-h-[44px]"
                    >
                        {cancelText}
                    </Button>
                    <Button
                        variant={confirmButtonVariant}
                        onClick={onConfirm}
                        disabled={isLoading}
                        className="w-full sm:w-auto min-h-[44px]"
                    >
                        {confirmText}
                    </Button>
                </div>
            </div>
        </BaseModal>
    )
}

/**
 * Toast notification component (inline)
 */
interface InlineToastProps {
    message: string
    type?: "success" | "error" | "warning" | "info"
    onClose?: () => void
    duration?: number
}

export function InlineToast({
    message,
    type = "info",
    onClose,
    duration = 3000,
}: InlineToastProps) {
    useEffect(() => {
        if (duration > 0 && onClose) {
            const timer = setTimeout(onClose, duration)
            return () => clearTimeout(timer)
        }
    }, [duration, onClose])

    const toastStyles = {
        success: "bg-green-500/20 border-green-500/50 text-green-400",
        error: "bg-red-500/20 border-red-500/50 text-red-400",
        warning: "bg-yellow-500/20 border-yellow-500/50 text-yellow-400",
        info: "bg-blue-500/20 border-blue-500/50 text-blue-400",
    }

    return (
        <div
            className={`p-4 rounded-lg border ${toastStyles[type]} animate-fade-in`}
            role="alert"
        >
            {message}
        </div>
    )
}
