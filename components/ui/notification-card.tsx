
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

interface NotificationCardProps {
    children: React.ReactNode
    className?: string
    onClose?: () => void
    title?: string
    icon?: React.ReactNode
}

export function NotificationCard({ children, className, onClose, title, icon }: NotificationCardProps) {
    return (
        <div
            className={cn(
                "fixed top-4 right-4 z-50 w-full max-w-sm bg-slate-800/95 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 shadow-2xl animate-in slide-in-from-right-full duration-300",
                className
            )}
            role="alert"
        >
            <div className="flex items-start gap-4">
                {icon && (
                    <div className="flex-shrink-0">
                        {icon}
                    </div>
                )}

                <div className="flex-1 min-w-0">
                    {title && <h3 className="text-white font-medium mb-1">{title}</h3>}
                    {children}
                </div>

                {onClose && (
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors"
                        aria-label="Close notification"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    )
}
