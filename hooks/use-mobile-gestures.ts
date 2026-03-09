/**
 * Mobile Gestures Hook
 * 
 * Touch gesture detection including swipe,
 * pull-to-refresh, and touch drag functionality.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

interface SwipeGesture {
    direction: 'up' | 'down' | 'left' | 'right';
    distance: number;
    velocity: number;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    timestamp: number;
}

interface DragGesture {
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    deltaX: number;
    deltaY: number;
    isActive: boolean;
}

interface TouchCallbacks {
    onSwipe?: (gesture: SwipeGesture) => void;
    onSwipeLeft?: (gesture: SwipeGesture) => void;
    onSwipeRight?: (gesture: SwipeGesture) => void;
    onSwipeUp?: (gesture: SwipeGesture) => void;
    onSwipeDown?: (gesture: SwipeGesture) => void;
    onDragStart?: (position: { x: number; y: number }) => void;
    onDrag?: (drag: DragGesture) => void;
    onDragEnd?: (drag: DragGesture) => void;
    onPullToRefresh?: () => void;
    onPullProgress?: (progress: number) => void;
    onTap?: (position: { x: number; y: number }) => void;
    onLongPress?: (position: { x: number; y: number }) => void;
}

interface UseMobileGesturesOptions {
    threshold?: number;
    maxDuration?: number;
    enableSwipe?: boolean;
    enableDrag?: boolean;
    enablePullToRefresh?: boolean;
    pullThreshold?: number;
    maxPullDistance?: number;
}

export function useMobileGestures(
    callbacks: TouchCallbacks,
    options: UseMobileGesturesOptions = {}
) {
    const {
        threshold = 50,
        maxDuration = 500,
        enableSwipe = true,
        enableDrag = true,
        enablePullToRefresh = false,
        pullThreshold = 80,
        maxPullDistance = 150,
    } = options;

    const [isPulling, setIsPulling] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const stateRef = useRef({
        startX: 0,
        startY: 0,
        startTime: 0,
        currentX: 0,
        currentY: 0,
        isDragging: false,
        isSwiping: false,
        lastTap: 0,
        tapCount: 0,
        longPressTimer: null as NodeJS.Timeout | null,
    });

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        const touch = e.touches[0];
        const state = stateRef.current;

        state.startX = touch.clientX;
        state.startY = touch.clientY;
        state.currentX = touch.clientX;
        state.currentY = touch.clientY;
        state.startTime = Date.now();
        state.isDragging = false;
        state.isSwiping = false;

        // Long press detection
        state.longPressTimer = setTimeout(() => {
            if (!state.isDragging && !state.isSwiping) {
                callbacks.onLongPress?.({ x: touch.clientX, y: touch.clientY });
            }
        }, 500);
    }, [callbacks]);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        const touch = e.touches[0];
        const state = stateRef.current;

        // Clear long press timer
        if (state.longPressTimer) {
            clearTimeout(state.longPressTimer);
            state.longPressTimer = null;
        }

        const deltaX = touch.clientX - state.startX;
        const deltaY = touch.clientY - state.startY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        // Check if this is a swipe or drag
        if (!state.isDragging && !state.isSwiping) {
            if (distance > 10) {
                // Determine direction
                if (Math.abs(deltaX) > Math.abs(deltaY)) {
                    state.isSwiping = true;
                } else {
                    if (enablePullToRefresh && deltaY > 0 && state.startY < 50) {
                        // Pull to refresh
                        setIsPulling(true);
                        setPullDistance(Math.min(deltaY, maxPullDistance));
                        callbacks.onPullProgress?.(Math.min(deltaY / pullThreshold, 1));
                    } else if (enableDrag) {
                        state.isDragging = true;
                        callbacks.onDragStart?.({ x: touch.clientX, y: touch.clientY });
                    }
                }
            }
        }

        // Handle drag
        if (state.isDragging && enableDrag) {
            state.currentX = touch.clientX;
            state.currentY = touch.clientY;
            callbacks.onDrag?.({
                startX: state.startX,
                startY: state.startY,
                currentX: state.currentX,
                currentY: state.currentY,
                deltaX: state.currentX - state.startX,
                deltaY: state.currentY - state.startY,
                isActive: true,
            });
        }

        // Handle swipe
        if (state.isSwiping && enableSwipe) {
            state.currentX = touch.clientX;
            state.currentY = touch.clientY;
        }
    }, [enablePullToRefresh, enableDrag, enableSwipe, maxPullDistance, pullThreshold, callbacks]);

    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
        const state = stateRef.current;

        // Clear long press timer
        if (state.longPressTimer) {
            clearTimeout(state.longPressTimer);
            state.longPressTimer = null;
        }

        const deltaX = state.currentX - state.startX;
        const deltaY = state.currentY - state.startY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const duration = Date.now() - state.startTime;
        const velocity = distance / duration;

        // Handle pull-to-refresh release
        if (isPulling) {
            if (pullDistance >= pullThreshold && !isRefreshing) {
                setIsRefreshing(true);
                callbacks.onPullToRefresh?.();
            }
            setIsPulling(false);
            setPullDistance(0);
        }

        // Handle drag end
        if (state.isDragging && enableDrag) {
            state.isDragging = false;
            callbacks.onDragEnd?.({
                startX: state.startX,
                startY: state.startY,
                currentX: state.currentX,
                currentY: state.currentY,
                deltaX,
                deltaY,
                isActive: false,
            });
        }

        // Handle swipe
        if (state.isSwiping && enableSwipe) {
            state.isSwiping = false;

            if (distance >= threshold && duration <= maxDuration) {
                const direction = Math.abs(deltaX) > Math.abs(deltaY)
                    ? deltaX > 0 ? 'right' : 'left'
                    : deltaY > 0 ? 'down' : 'up';

                const gesture: SwipeGesture = {
                    direction,
                    distance,
                    velocity,
                    startX: state.startX,
                    startY: state.startY,
                    endX: state.currentX,
                    endY: state.currentY,
                    timestamp: state.startTime,
                };

                callbacks.onSwipe?.(gesture);

                switch (direction) {
                    case 'left':
                        callbacks.onSwipeLeft?.(gesture);
                        break;
                    case 'right':
                        callbacks.onSwipeRight?.(gesture);
                        break;
                    case 'up':
                        callbacks.onSwipeUp?.(gesture);
                        break;
                    case 'down':
                        callbacks.onSwipeDown?.(gesture);
                        break;
                }
            }
        }

        // Handle tap
        const now = Date.now();
        if (now - state.lastTap < 300) {
            state.tapCount++;
            if (state.tapCount === 2) {
                state.tapCount = 0;
            }
        } else {
            state.tapCount = 1;
        }
        state.lastTap = now;

        if (state.tapCount === 1 && !state.isDragging && !state.isSwiping) {
            callbacks.onTap?.({ x: state.startX, y: state.startY });
        }
    }, [isPulling, pullDistance, isRefreshing, threshold, maxDuration, enableDrag, enableSwipe, pullThreshold, callbacks]);

    // Reset refreshing state
    const completeRefresh = useCallback(() => {
        setIsRefreshing(false);
    }, []);

    return {
        isPulling,
        pullDistance,
        isRefreshing,
        completeRefresh,
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd,
    };
}

export default useMobileGestures;
export type { SwipeGesture, DragGesture, TouchCallbacks, UseMobileGesturesOptions };
