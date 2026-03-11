"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * VisuallyHidden component to hide content visually while keeping it accessible to screen readers.
 */
const VisuallyHidden = ({ as: Component = "span", className, ...props }: React.HTMLAttributes<HTMLElement> & { as?: React.ElementType }) => {
  const Element = Component as any
  return (
    <Element
      className={cn(
        "absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0",
        className
      )}
      style={{ clip: "rect(0, 0, 0, 0)" } as React.CSSProperties}
      {...props}
    />
  )
}
VisuallyHidden.displayName = "VisuallyHidden"

/**
 * Dialog root component from Radix UI.
 * @see https://www.radix-ui.com/docs/primitives/components/dialog
 */
const Dialog = DialogPrimitive.Root

/**
 * Trigger to open the dialog.
 */
const DialogTrigger = DialogPrimitive.Trigger

/**
 * Portal for rendering the dialog content.
 */
const DialogPortal = DialogPrimitive.Portal

/**
 * Button to close the dialog.
 */
const DialogClose = DialogPrimitive.Close

/**
 * Overlay component that dims the background when the dialog is open.
 */
const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-[600] bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

/**
 * Content component for the dialog, containing the main content and a close button.
 * Note: For accessibility, include a `DialogTitle` component within `DialogContent` to provide a descriptive label for screen readers.
 * If no `DialogTitle` is provided, a visually hidden `DialogTitle` with a generic label is added as a fallback.
 */
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    hideCloseButton?: boolean
  }
>(({ className, children, hideCloseButton, ...props }, ref) => {
  // Check if children include a DialogTitle
  const hasDialogTitle = React.Children.toArray(children).some(
    (child) => React.isValidElement(child) && child.type === DialogTitle
  )

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-[50%] top-[50%] z-[600] grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border bg-slate-800 p-6 shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-2xl",
          className
        )}
        aria-label={props["aria-label"] || undefined}
        {...props}
      >
        {!hasDialogTitle && (
          <VisuallyHidden as={DialogPrimitive.Title}>Dialog</VisuallyHidden>
        )}
        {children}
        {!hideCloseButton && (
          <DialogPrimitive.Close
            className="absolute right-3 top-3 rounded-full opacity-70 ring-offset-background transition-all hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground haptic"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

/**
 * Header component for the dialog, typically containing `DialogTitle` and/or `DialogDescription`.
 */
const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

/**
 * Footer component for the dialog, typically containing action buttons.
 */
const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

/**
 * Title component for the dialog, required for accessibility to provide a descriptive label for screen readers.
 * Use with `VisuallyHidden` if the title should not be visible but still accessible.
 */
const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight text-white",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

/**
 * Description component for the dialog, providing additional context for screen readers.
 */
const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
