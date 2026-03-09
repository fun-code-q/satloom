/**
 * Multi-User Cursors System
 * 
 * Tracks and displays cursors of all users in real-time
 * with name tags on hover and cursor following.
 */

import { ref, onValue, set, onDisconnect } from 'firebase/database';
import { getFirebaseDatabase } from '@/lib/firebase';

// Get database instance with fallback
function getDb() {
    try {
        return getFirebaseDatabase()!;
    } catch {
        return null;
    }
}

interface CursorPosition {
    x: number;
    y: number;
    timestamp: number;
}

interface UserCursor {
    userId: string;
    userName: string;
    color: string;
    position: CursorPosition;
}

interface CursorConfig {
    /** Timeout for cursor inactivity (ms) */
    inactivityTimeout: number;
    /** Cursor visibility timeout (ms) */
    visibilityTimeout: number;
    /** Minimum distance to send update */
    distanceThreshold: number;
    /** Throttle delay for updates (ms) */
    throttleDelay: number;
}

class MultiUserCursors {
    private static instance: MultiUserCursors;
    private cursors: Map<string, UserCursor> = new Map();
    private listeners: Map<string, () => void> = new Map();
    private roomId: string | null = null;
    private currentUserId: string | null = null;
    private currentUserName: string = '';
    private currentUserColor: string = '#3b82f6';
    private lastPosition: CursorPosition | null = null;
    private throttleTimer: NodeJS.Timeout | null = null;
    private inactivityTimer: NodeJS.Timeout | null = null;
    private visibilityTimer: NodeJS.Timeout | null = null;
    private isVisible: boolean = true;

    private config: CursorConfig = {
        inactivityTimeout: 5000,
        visibilityTimeout: 30000,
        distanceThreshold: 10,
        throttleDelay: 50,
    };

    private constructor() { }

    static getInstance(): MultiUserCursors {
        if (!MultiUserCursors.instance) {
            MultiUserCursors.instance = new MultiUserCursors();
        }
        return MultiUserCursors.instance;
    }

    /**
     * Initialize cursors for a room
     */
    initialize(roomId: string, userId: string, userName: string, color?: string): void {
        this.roomId = roomId;
        this.currentUserId = userId;
        this.currentUserName = userName;
        if (color) this.currentUserColor = color;

        // Generate consistent color from username
        this.currentUserColor = this.generateColor(userName);

        // Set up presence
        this.setupPresence();

        // Listen for other users' cursors
        this.listenForCursors();
    }

    /**
     * Set up user presence
     */
    private setupPresence(): void {
        if (!this.roomId || !this.currentUserId) return;

        const db = getDb();
        if (!db) return;

        const presenceRef = ref(db, `rooms/${this.roomId}/presence/${this.currentUserId}`);

        set(presenceRef, {
            name: this.currentUserName,
            color: this.currentUserColor,
            isTyping: false,
            lastSeen: Date.now(),
        });

        // Remove cursor on disconnect
        const cursorRef = ref(db, `rooms/${this.roomId}/cursors/${this.currentUserId}`);
        onDisconnect(cursorRef).remove();

        const presencePresenceRef = ref(db, `rooms/${this.roomId}/presence/${this.currentUserId}`);
        onDisconnect(presencePresenceRef).remove();
    }

    /**
     * Listen for other users' cursors
     */
    private listenForCursors(): void {
        if (!this.roomId) return;

        const db = getDb();
        if (!db) return;

        const cursorsRef = ref(db, `rooms/${this.roomId}/cursors`);

        const unsubscribe = onValue(cursorsRef, (snapshot) => {
            if (!snapshot.exists()) {
                this.cursors.clear();
                return;
            }

            const data = snapshot.val() as Record<string, any>;

            // Update cursors
            this.cursors.forEach((cursor, userId) => {
                if (userId !== this.currentUserId && !data[userId]) {
                    this.cursors.delete(userId);
                }
            });

            Object.entries(data).forEach(([userId, cursorData]) => {
                if (userId !== this.currentUserId) {
                    this.cursors.set(userId, {
                        userId,
                        userName: cursorData.userName || 'Unknown',
                        color: cursorData.color || '#6b7280',
                        position: cursorData.position || { x: 0, y: 0, timestamp: Date.now() },
                    });
                }
            });
        });

        this.listeners.set('cursors', unsubscribe);
    }

    /**
     * Update cursor position
     */
    updateCursor(x: number, y: number): void {
        if (!this.roomId || !this.currentUserId) return;

        // Check distance threshold
        if (this.lastPosition) {
            const distance = Math.sqrt(
                Math.pow(x - this.lastPosition.x, 2) + Math.pow(y - this.lastPosition.y, 2)
            );
            if (distance < this.config.distanceThreshold) {
                return;
            }
        }

        // Throttle updates
        if (this.throttleTimer) return;

        this.throttleTimer = setTimeout(() => {
            const position: CursorPosition = { x, y, timestamp: Date.now() };
            this.lastPosition = position;

            const db = getDb();
            if (!db) return;

            const cursorRef = ref(db, `rooms/${this.roomId}/cursors/${this.currentUserId}`);
            set(cursorRef, {
                userName: this.currentUserName,
                color: this.currentUserColor,
                position,
            });

            this.throttleTimer = null;
        }, this.config.throttleDelay);

        // Reset inactivity timer
        this.resetInactivityTimer();
    }

    /**
     * Reset inactivity timer
     */
    private resetInactivityTimer(): void {
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer);
        }

        this.inactivityTimer = setTimeout(() => {
            // Mark as inactive
            const db = getDb();
            if (!db || !this.roomId || !this.currentUserId) return;

            const presenceRef = ref(db, `rooms/${this.roomId}/presence/${this.currentUserId}`);
            set(presenceRef, {
                name: this.currentUserName,
                color: this.currentUserColor,
                isTyping: false,
                lastSeen: Date.now(),
            });
        }, this.config.inactivityTimeout);
    }

    /**
     * Show/hide cursor
     */
    setCursorVisible(visible: boolean): void {
        this.isVisible = visible;

        if (!visible && this.visibilityTimer) {
            clearTimeout(this.visibilityTimer);
        }

        if (!visible) {
            this.visibilityTimer = setTimeout(() => {
                this.hideCursor();
            }, this.config.visibilityTimeout);
        }
    }

    /**
     * Hide cursor from others
     */
    hideCursor(): void {
        if (!this.roomId || !this.currentUserId) return;

        const db = getDb();
        if (!db) return;

        const cursorRef = ref(db, `rooms/${this.roomId}/cursors/${this.currentUserId}`);
        set(cursorRef, null);
    }

    /**
     * Get all active cursors
     */
    getCursors(): UserCursor[] {
        const now = Date.now();
        return Array.from(this.cursors.values()).filter(cursor => {
            // Filter out stale cursors
            return now - cursor.position.timestamp < this.config.inactivityTimeout + 5000;
        });
    }

    /**
     * Get cursor by user ID
     */
    getCursor(userId: string): UserCursor | undefined {
        return this.cursors.get(userId);
    }

    /**
     * Generate consistent color from username
     */
    private generateColor(name: string): string {
        const colors = [
            '#8b5cf6', // purple
            '#06b6d4', // cyan
            '#10b981', // emerald
            '#f59e0b', // amber
            '#ef4444', // red
            '#3b82f6', // blue
            '#8b5a2b', // brown
            '#ec4899', // pink
        ];

        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    }

    /**
     * Get user color
     */
    getUserColor(): string {
        return this.currentUserColor;
    }

    /**
     * Update typing status
     */
    setTyping(isTyping: boolean): void {
        if (!this.roomId || !this.currentUserId) return;

        const db = getDb();
        if (!db) return;

        const presenceRef = ref(db, `rooms/${this.roomId}/presence/${this.currentUserId}`);
        set(presenceRef, {
            name: this.currentUserName,
            color: this.currentUserColor,
            isTyping,
            lastSeen: Date.now(),
        });
    }

    /**
     * Clean up
     */
    cleanup(): void {
        // Remove cursor
        if (this.roomId && this.currentUserId) {
            const db = getDb();
            if (db) {
                const cursorRef = ref(db, `rooms/${this.roomId}/cursors/${this.currentUserId}`);
                set(cursorRef, null);
            }
        }

        // Clear timers
        if (this.throttleTimer) clearTimeout(this.throttleTimer);
        if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
        if (this.visibilityTimer) clearTimeout(this.visibilityTimer);

        // Unsubscribe listeners
        this.listeners.forEach(unsubscribe => unsubscribe());
        this.listeners.clear();

        // Clear state
        this.cursors.clear();
        this.roomId = null;
        this.currentUserId = null;
        this.lastPosition = null;
    }
}

export const multiUserCursors = MultiUserCursors.getInstance();
export type { UserCursor, CursorPosition, CursorConfig };
