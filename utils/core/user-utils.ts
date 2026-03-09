/**
 * User-related utilities
 */

/**
 * Generate a consistent color for a user based on their ID
 * @param userId - The user's unique identifier
 * @returns A hex color code
 */
export function getUserColor(userId: string): string {
    const colors = [
        "#ef4444", // red
        "#f97316", // orange
        "#f59e0b", // amber
        "#eab308", // yellow
        "#84cc16", // lime
        "#22c55e", // green
        "#10b981", // emerald
        "#14b8a6", // teal
        "#06b6d4", // cyan
        "#0ea5e9", // sky
        "#3b82f6", // blue
        "#6366f1", // indigo
        "#8b5cf6", // violet
        "#a855f7", // purple
        "#d946ef", // fuchsia
        "#ec4899", // pink
        "#f43f5e", // rose
    ]

    // Generate a consistent index based on userId
    let hash = 0
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash)
    }

    const index = Math.abs(hash) % colors.length
    return colors[index]
}

/**
 * Generate a gradient background for a user avatar
 * @param userId - The user's unique identifier
 * @returns Tailwind CSS gradient classes
 */
export function getUserAvatarGradient(userId: string): string {
    const color = getUserColor(userId)
    return `bg-gradient-to-br from-${color}-400 to-${color}-600`
}

/**
 * Get initials from a display name
 * @param displayName - The user's display name
 * @returns Initials (max 2 characters)
 */
export function getInitials(displayName: string): string {
    if (!displayName) return "??"

    const parts = displayName.trim().split(/\s+/)
    if (parts.length === 1) {
        return parts[0].substring(0, 2).toUpperCase()
    }

    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Format a timestamp for display
 * @param date - The date to format
 * @returns Formatted time string (e.g., "2:30 PM")
 */
export function formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

/**
 * Format a date for display
 * @param date - The date to format
 * @returns Formatted date string (e.g., "Today", "Yesterday", or "MM/DD/YYYY")
 */
export function formatDate(date: Date): string {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

    const diffDays = Math.floor((today.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24))

    switch (diffDays) {
        case 0:
            return "Today"
        case 1:
            return "Yesterday"
        case 2:
        case 3:
        case 4:
        case 5:
        case 6:
            return `${diffDays} days ago`
        default:
            return date.toLocaleDateString([], { month: "short", day: "numeric", year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined })
    }
}

/**
 * Format a relative time (e.g., "5 minutes ago")
 * @param date - The date to format
 * @returns Relative time string
 */
export function formatRelativeTime(date: Date): string {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHour = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHour / 24)

    if (diffSec < 60) {
        return "just now"
    } else if (diffMin < 60) {
        return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`
    } else if (diffHour < 24) {
        return `${diffHour} hour${diffHour === 1 ? "" : "s"} ago`
    } else if (diffDay < 7) {
        return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`
    } else {
        return formatDate(date)
    }
}

/**
 * Truncate text with ellipsis
 * @param text - The text to truncate
 * @param maxLength - Maximum length before truncating
 * @returns Truncated text
 */
export function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength - 3) + "..."
}

/**
 * Generate a random ID
 * @param length - Length of the ID (default 20)
 * @returns Random ID string
 */
export function generateId(length = 20): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    let result = ""
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
}

/**
 * Debounce a function
 * @param func - The function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    return (...args: Parameters<T>) => {
        if (timeoutId) {
            clearTimeout(timeoutId)
        }

        timeoutId = setTimeout(() => {
            func(...args)
        }, wait)
    }
}

/**
 * Throttle a function
 * @param func - The function to throttle
 * @param limit - Time limit in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle = false

    return (...args: Parameters<T>) => {
        if (!inThrottle) {
            func(...args)
            inThrottle = true
            setTimeout(() => {
                inThrottle = false
            }, limit)
        }
    }
}

/**
 * Check if a value is empty (null, undefined, empty string, empty array, empty object)
 * @param value - The value to check
 * @returns True if empty
 */
export function isEmpty(value: any): boolean {
    if (value === null || value === undefined) {
        return true
    }

    if (typeof value === "string") {
        return value.trim().length === 0
    }

    if (Array.isArray(value)) {
        return value.length === 0
    }

    if (typeof value === "object") {
        return Object.keys(value).length === 0
    }

    return false
}

/**
 * Safely parse JSON
 * @param json - JSON string to parse
 * @param fallback - Fallback value if parsing fails
 * @returns Parsed object or fallback
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
    try {
        return JSON.parse(json) as T
    } catch {
        return fallback
    }
}

/**
 * Copy text to clipboard
 * @param text - Text to copy
 * @returns Promise that resolves when copied
 */
export async function copyToClipboard(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text)
        return true
    } catch {
        // Fallback for older browsers
        const textarea = document.createElement("textarea")
        textarea.value = text
        textarea.style.position = "fixed"
        textarea.style.opacity = "0"
        document.body.appendChild(textarea)
        textarea.select()

        try {
            document.execCommand("copy")
            return true
        } catch {
            return false
        } finally {
            document.body.removeChild(textarea)
        }
    }
}
