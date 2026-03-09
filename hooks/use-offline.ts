import { useState, useEffect, useCallback, useRef } from "react"

interface OfflineMessage {
    id: string
    text: string
    sender: string
    timestamp: Date
    replyTo?: {
        id: string
        text: string
        sender: string
    }
    reactions?: {
        heart: string[]
        thumbsUp: string[]
    }
    retryCount: number
}

interface UseOfflineSupportOptions {
    onReconnect?: () => void
    onSyncMessages?: (messages: OfflineMessage[]) => Promise<void>
    maxRetryCount?: number
}

export function useOfflineSupport({
    onReconnect,
    onSyncMessages,
    maxRetryCount = 3,
}: UseOfflineSupportOptions = {}) {
    const [isOnline, setIsOnline] = useState(true)
    const [isSyncing, setIsSyncing] = useState(false)
    const [pendingMessages, setPendingMessages] = useState<OfflineMessage[]>([])
    const messageQueueRef = useRef<Map<string, OfflineMessage>>(new Map())

    // Load pending messages from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem("satloom-offline-queue")
        if (saved) {
            try {
                const parsed = JSON.parse(saved)
                const messages: OfflineMessage[] = parsed.map((m: any) => ({
                    ...m,
                    timestamp: new Date(m.timestamp),
                }))
                messageQueueRef.current = new Map(messages.map((m) => [m.id, m]))
                setPendingMessages(messages)
            } catch (e) {
                console.error("Failed to load offline queue:", e)
            }
        }

        // Check initial online status
        setIsOnline(navigator.onLine)
    }, [])

    // Save to localStorage when queue changes
    useEffect(() => {
        const messages = Array.from(messageQueueRef.current.values())
        localStorage.setItem("satloom-offline-queue", JSON.stringify(messages))
        setPendingMessages(messages)
    }, [messageQueueRef.current.size])

    // Listen for online/offline events
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true)
            onReconnect?.()
            syncPendingMessages()
        }

        const handleOffline = () => {
            setIsOnline(false)
        }

        window.addEventListener("online", handleOnline)
        window.addEventListener("offline", handleOffline)

        return () => {
            window.removeEventListener("online", handleOnline)
            window.removeEventListener("offline", handleOffline)
        }
    }, [onReconnect])

    // Sync pending messages when back online
    const syncPendingMessages = useCallback(async () => {
        if (!navigator.onLine || isSyncing || messageQueueRef.current.size === 0) {
            return
        }

        setIsSyncing(true)

        try {
            const messages = Array.from(messageQueueRef.current.values())

            if (onSyncMessages) {
                await onSyncMessages(messages)
            }

            // Clear queue after successful sync
            messageQueueRef.current.clear()
            localStorage.removeItem("satloom-offline-queue")
            setPendingMessages([])
        } catch (error) {
            console.error("Failed to sync messages:", error)

            // Increment retry count and remove failed messages
            messageQueueRef.current.forEach((msg, id) => {
                if (msg.retryCount >= maxRetryCount) {
                    messageQueueRef.current.delete(id)
                } else {
                    messageQueueRef.current.set(id, {
                        ...msg,
                        retryCount: msg.retryCount + 1,
                    })
                }
            })
        } finally {
            setIsSyncing(false)
        }
    }, [onSyncMessages, maxRetryCount, isSyncing])

    // Add message to queue
    const queueMessage = useCallback((message: Omit<OfflineMessage, "retryCount">) => {
        const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const offlineMessage: OfflineMessage = {
            ...message,
            id,
            retryCount: 0,
        }

        messageQueueRef.current.set(id, offlineMessage)
        setPendingMessages(Array.from(messageQueueRef.current.values()))

        // Try to send immediately if online
        if (navigator.onLine) {
            syncPendingMessages()
        }

        return id
    }, [syncPendingMessages])

    // Remove message from queue
    const removeFromQueue = useCallback((id: string) => {
        messageQueueRef.current.delete(id)
        setPendingMessages(Array.from(messageQueueRef.current.values()))
    }, [])

    // Clear entire queue
    const clearQueue = useCallback(() => {
        messageQueueRef.current.clear()
        localStorage.removeItem("satloom-offline-queue")
        setPendingMessages([])
    }, [])

    return {
        isOnline,
        isSyncing,
        pendingMessages,
        pendingCount: pendingMessages.length,
        queueMessage,
        removeFromQueue,
        clearQueue,
        syncPendingMessages,
    }
}

// Hook for detecting online status only
export function useIsOnline() {
    const [isOnline, setIsOnline] = useState(true)

    useEffect(() => {
        setIsOnline(navigator.onLine)

        const handleOnline = () => setIsOnline(true)
        const handleOffline = () => setIsOnline(false)

        window.addEventListener("online", handleOnline)
        window.addEventListener("offline", handleOffline)

        return () => {
            window.removeEventListener("online", handleOnline)
            window.removeEventListener("offline", handleOffline)
        }
    }, [])

    return isOnline
}
