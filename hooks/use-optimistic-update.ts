/**
 * Optimistic Update Hook for Immediate UI Feedback
 * 
 * Provides optimistic update patterns for immediate UI feedback
 * with rollback on failure.
 */

import { useState, useCallback, useRef } from 'react';

/**
 * Optimistic update state
 */
export interface OptimisticState<T> {
    data: T;
    isLoading: boolean;
    error: Error | null;
    isOptimistic: boolean;
}

/**
 * Optimistic update configuration
 */
export interface OptimisticConfig<T, R> {
    /** Function to perform the actual update */
    updateFn: (data: T) => Promise<R>;
    /** Function to rollback on error */
    rollbackFn: (originalData: T, error: Error) => void;
    /** Callback on successful update */
    onSuccess?: (result: R, optimisticData: T) => void;
    /** Callback on error */
    onError?: (error: Error, originalData: T) => void;
    /** Debounce delay in ms (0 to disable) */
    debounce?: number;
}

/**
 * Create optimistic update state
 */
export function useOptimisticUpdate<T>(
    initialData: T
): [
        OptimisticState<T>,
        (newData: T, updateFn: () => Promise<void>) => Promise<void>,
        () => void
    ] {
    const [state, setState] = useState<OptimisticState<T>>({
        data: initialData,
        isLoading: false,
        error: null,
        isOptimistic: false,
    });

    const originalDataRef = useRef<T>(initialData);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const optimisticUpdate = useCallback(
        async (newData: T, updateFn: () => Promise<void>) => {
            // Store original data for rollback
            originalDataRef.current = state.data;

            // Set optimistic state
            setState(prev => ({
                ...prev,
                data: newData,
                isLoading: true,
                error: null,
                isOptimistic: true,
            }));

            try {
                // Perform actual update
                await updateFn();

                // Update to final state
                setState(prev => ({
                    ...prev,
                    data: newData,
                    isLoading: false,
                    isOptimistic: false,
                }));
            } catch (error) {
                // Rollback on error
                setState(prev => ({
                    ...prev,
                    data: originalDataRef.current,
                    isLoading: false,
                    error: error as Error,
                    isOptimistic: false,
                }));

                // Throw error for caller handling
                throw error;
            }
        },
        [state.data]
    );

    const rollback = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        setState(prev => ({
            ...prev,
            data: originalDataRef.current,
            isLoading: false,
            isOptimistic: false,
        }));
    }, []);

    return [state, optimisticUpdate, rollback];
}

/**
 * Batch optimistic updates
 */
export function useOptimisticBatch<T extends { id: string }>() {
    const [items, setItems] = useState<T[]>([]);
    const pendingUpdates = useRef<Map<string, { original: T; optimistic: T }>>(new Map());
    const isLoadingRef = useRef(false);

    const batchUpdate = useCallback(
        async (
            updates: Array<{ id: string; data: Partial<T> }>,
            executeUpdate: (ids: string[]) => Promise<void>
        ) => {
            isLoadingRef.current = true;

            // Store original items and create optimistic updates
            const updateMap = new Map<string, { original: T; optimistic: T }>();

            setItems(prev => {
                const newItems = prev.map(item => {
                    const update = updates.find(u => u.id === item.id);
                    if (update) {
                        updateMap.set(item.id, { original: item, optimistic: { ...item, ...update.data } });
                        return { ...item, ...update.data };
                    }
                    return item;
                });
                return newItems;
            });

            pendingUpdates.current = updateMap;

            try {
                await executeUpdate(updates.map(u => u.id));
                isLoadingRef.current = false;
                pendingUpdates.current.clear();
            } catch (error) {
                // Rollback all changes
                setItems(prev => prev.map(item => {
                    const stored = pendingUpdates.current.get(item.id);
                    return stored ? stored.original : item;
                }));
                isLoadingRef.current = false;
                pendingUpdates.current.clear();
                throw error;
            }
        },
        []
    );

    const rollbackItem = useCallback((id: string) => {
        const stored = pendingUpdates.current.get(id);
        if (stored) {
            setItems(prev => prev.map(item =>
                item.id === id ? stored.original : item
            ));
            pendingUpdates.current.delete(id);
        }
    }, []);

    return { items, batchUpdate, rollbackItem, isLoading: isLoadingRef.current };
}

/**
 * Message sending with optimistic update
 */
export interface MessageOptimistic {
    id: string;
    content: string;
    senderId: string;
    timestamp: number;
    status: 'sending' | 'sent' | 'delivered' | 'failed';
}

export function useOptimisticMessages() {
    const [messages, setMessages] = useState<MessageOptimistic[]>([]);
    const pendingIds = useRef<Set<string>>(new Set());

    const sendMessage = useCallback(
        async (
            message: Omit<MessageOptimistic, 'id' | 'timestamp' | 'status'>,
            sendToServer: (msg: MessageOptimistic) => Promise<{ id: string }>
        ) => {
            const tempId = 'temp-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            const optimisticMessage: MessageOptimistic = {
                ...message,
                id: tempId,
                timestamp: Date.now(),
                status: 'sending',
            };

            // Add optimistic message
            setMessages(prev => [...prev, optimisticMessage]);
            pendingIds.current.add(tempId);

            try {
                // Send to server
                const { id: serverId } = await sendToServer(optimisticMessage);

                // Update with server ID and mark as sent
                setMessages(prev => prev.map(msg =>
                    msg.id === tempId
                        ? { ...msg, id: serverId, status: 'sent' as const }
                        : msg
                ));

                // Remove from pending after a delay (for delivered status simulation)
                setTimeout(() => {
                    pendingIds.current.delete(tempId);
                    setMessages(prev => prev.map(msg =>
                        msg.id === serverId ? { ...msg, status: 'delivered' as const } : msg
                    ));
                }, 1000);

            } catch (error) {
                // Remove optimistic message on error
                setMessages(prev => prev.filter(msg => msg.id !== tempId));
                pendingIds.current.delete(tempId);
                throw error;
            }
        },
        []
    );

    const retryMessage = useCallback(async (
        message: MessageOptimistic,
        sendToServer: (msg: MessageOptimistic) => Promise<{ id: string }>
    ) => {
        // Update status to sending
        setMessages(prev => prev.map(msg =>
            msg.id === message.id ? { ...msg, status: 'sending' as const } : msg
        ));

        try {
            const { id: serverId } = await sendToServer(message);
            setMessages(prev => prev.map(msg =>
                msg.id === message.id
                    ? { ...msg, id: serverId, status: 'sent' as const }
                    : msg
            ));
        } catch (error) {
            setMessages(prev => prev.map(msg =>
                msg.id === message.id ? { ...msg, status: 'failed' as const } : msg
            ));
            throw error;
        }
    }, []);

    return { messages, sendMessage, retryMessage };
}

/**
 * Presence status with optimistic update
 */
export function useOptimisticPresence(
    userId: string,
    updatePresence: (status: 'online' | 'away' | 'offline') => Promise<void>
) {
    const [status, setStatus] = useState<'online' | 'away' | 'offline'>('online');
    const pendingStatusRef = useRef<'online' | 'away' | 'offline' | null>(null);

    const updateStatus = useCallback(
        async (newStatus: 'online' | 'away' | 'offline') => {
            // Optimistic update
            const originalStatus = status;
            setStatus(newStatus);
            pendingStatusRef.current = newStatus;

            try {
                await updatePresence(newStatus);
                pendingStatusRef.current = null;
            } catch (error) {
                // Rollback on error
                setStatus(originalStatus);
                pendingStatusRef.current = null;
                throw error;
            }
        },
        [status, updatePresence]
    );

    const clearPending = useCallback(() => {
        if (pendingStatusRef.current !== null) {
            setStatus(pendingStatusRef.current);
            pendingStatusRef.current = null;
        }
    }, []);

    return { status, updateStatus, clearPending, pendingStatus: pendingStatusRef.current };
}

/**
 * Typing indicator with optimistic debounce
 */
export function useTypingIndicator(
    roomId: string,
    sendTyping: (isTyping: boolean) => Promise<void>
) {
    const [isTyping, setIsTyping] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const sentRef = useRef(false);

    const setTyping = useCallback(() => {
        if (!isTyping) {
            setIsTyping(true);
            sentRef.current = false;
        }

        // Clear existing timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // Send typing status after delay (debounced)
        timeoutRef.current = setTimeout(async () => {
            if (!sentRef.current) {
                try {
                    await sendTyping(true);
                    sentRef.current = true;
                } catch (error) {
                    // Ignore typing status errors
                }
            }
        }, 500);

        // Clear typing after longer delay (auto-clear)
        timeoutRef.current = setTimeout(() => {
            setIsTyping(false);
            sentRef.current = false;
        }, 3000);
    }, [isTyping, sendTyping]);

    const stopTyping = useCallback(async () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        if (isTyping) {
            setIsTyping(false);
            try {
                await sendTyping(false);
            } catch (error) {
                // Ignore typing status errors
            }
        }
    }, [isTyping, sendTyping]);

    return { isTyping, setTyping, stopTyping };
}

/**
 * Reaction update with optimistic UI
 */
export interface Reaction {
    emoji: string;
    count: number;
    userReacted: boolean;
}

export function useOptimisticReactions(
    messageId: string,
    existingReactions: Reaction[],
    toggleReaction: (emoji: string) => Promise<void>
) {
    const [reactions, setReactions] = useState<Reaction[]>(existingReactions);
    const pendingRef = useRef<Set<string>>(new Set());

    const toggle = useCallback(
        async (emoji: string) => {
            // Store original state
            const originalReactions = [...reactions];

            // Optimistic update
            setReactions(prev => prev.map(r => {
                if (r.emoji === emoji) {
                    const newCount = r.userReacted ? r.count - 1 : r.count + 1;
                    return { ...r, count: newCount, userReacted: !r.userReacted };
                }
                return r;
            }));

            pendingRef.current.add(emoji);

            try {
                await toggleReaction(emoji);
                pendingRef.current.delete(emoji);
            } catch (error) {
                // Rollback on error
                setReactions(originalReactions);
                pendingRef.current.delete(emoji);
                throw error;
            }
        },
        [reactions, toggleReaction]
    );

    return { reactions, toggle, pending: pendingRef.current.size > 0 };
}
