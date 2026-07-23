"use client"

/**
 * AdaptiveModal — Phase 11 / C2.
 *
 * On desktop renders as a Radix Dialog. On mobile renders as a Vaul
 * bottom drawer (swipe-to-dismiss, native-feeling). Same prop surface
 * either way so adopting it in a feature modal is a one-line replace.
 *
 * Why this exists: the audit flagged that modals are Dialog-on-mobile
 * everywhere, which feels like a desktop app on a phone. Vaul's been
 * in deps since Phase 0 but unused. This is the wedge component that
 * lets feature modals migrate incrementally — replace
 * `<Dialog>...</Dialog>` with `<AdaptiveModal>...</AdaptiveModal>` and
 * the same JSX gets the right presentation on each form factor.
 */

import * as React from "react"
import { Drawer as DrawerPrimitive } from "vaul"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"

export interface AdaptiveModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    title?: React.ReactNode
    description?: React.ReactNode
    /** Optional className applied to the inner content container. */
    className?: string
    children: React.ReactNode
    /**
     * Force a presentation regardless of viewport — useful for stories
     * or unit tests. Default: auto (drawer on mobile, dialog on desktop).
     */
    forcePresentation?: "dialog" | "drawer"
    /**
     * Mobile-only: render a small drag handle at the top of the sheet.
     * Default true.
     */
    showDragHandle?: boolean
}

export function AdaptiveModal({
    open,
    onOpenChange,
    title,
    description,
    className,
    children,
    forcePresentation,
    showDragHandle = true,
}: AdaptiveModalProps) {
    const isMobile = useIsMobile()
    const useDrawer = forcePresentation === "drawer" || (forcePresentation !== "dialog" && isMobile)

    if (useDrawer) {
        return (
            <DrawerPrimitive.Root open={open} onOpenChange={onOpenChange} shouldScaleBackground>
                <DrawerPrimitive.Portal>
                    <DrawerPrimitive.Overlay className="fixed inset-0 z-[1200] bg-black/80 backdrop-blur-sm" />
                    <DrawerPrimitive.Content
                        className={cn(
                            "fixed inset-x-0 bottom-0 z-[1210] mt-24 flex h-auto max-h-[90dvh] flex-col rounded-t-2xl border-t border-slate-700 bg-slate-900 text-white overflow-hidden",
                            className,
                        )}
                    >
                        {showDragHandle && (
                            <div className="mx-auto mt-3 mb-1 h-1.5 w-12 rounded-full bg-slate-600 shrink-0" aria-hidden />
                        )}
                        {(title || description) && (
                            <div className="px-4 pt-2 pb-3 text-left">
                                {title && (
                                    <DrawerPrimitive.Title className="text-lg font-semibold leading-tight">
                                        {title}
                                    </DrawerPrimitive.Title>
                                )}
                                {description && (
                                    <DrawerPrimitive.Description className="mt-1 text-sm text-slate-400">
                                        {description}
                                    </DrawerPrimitive.Description>
                                )}
                            </div>
                        )}
                        <div className="flex-1 overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),16px)]">
                            {children}
                        </div>
                    </DrawerPrimitive.Content>
                </DrawerPrimitive.Portal>
            </DrawerPrimitive.Root>
        )
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={cn("bg-slate-900 border-slate-700 text-white", className)}>
                {(title || description) && (
                    <DialogHeader>
                        {title && <DialogTitle>{title}</DialogTitle>}
                        {description && <DialogDescription>{description}</DialogDescription>}
                    </DialogHeader>
                )}
                {children}
            </DialogContent>
        </Dialog>
    )
}
