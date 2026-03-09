/**
 * Vanish Mode - Ephemeral Messaging System
 * 
 * Messages that disappear after being read or after a timeout.
 * Features: Read-once, timed messages, screenshot detection, screenshot notifications.
 */

export type VanishModeType = 'off' | 'read_once' | 'timed' | 'after_exit';
export type VanishMessageStatus = 'pending' | 'delivered' | 'read' | 'expired' | 'screenshot';

interface VanishMessage {
    id: string;
    content: string;
    type: VanishModeType;
    createdAt: number;
    expiresAt?: number;
    readAt?: number;
    status: VanishMessageStatus;
    metadata?: {
        screenshotTaken?: boolean;
        screenshotTime?: number;
        forwarded?: boolean;
        reply?: string;
    };
}

interface VanishConfig {
    defaultTimeout: number; // milliseconds
    maxMessageLength: number;
    allowScreenshots: boolean;
    notifyOnScreenshot: boolean;
    showExpirationTimer: boolean;
    blurPreview: boolean;
    showReadReceipt: boolean;
}

interface VanishStats {
    totalMessages: number;
    readMessages: number;
    expiredMessages: number;
    screenshotAttempts: number;
    avgReadTime: number;
}

class VanishModeManager {
    private static instance: VanishModeManager;
    private messages: Map<string, VanishMessage> = new Map();
    private listeners: Map<string, Set<(message: VanishMessage) => void>> = new Map();
    private config: VanishConfig = {
        defaultTimeout: 10000, // 10 seconds
        maxMessageLength: 1000,
        allowScreenshots: false,
        notifyOnScreenshot: true,
        showExpirationTimer: true,
        blurPreview: true,
        showReadReceipt: true,
    };
    private screenshotDetectionInterval: NodeJS.Timeout | null = null;
    private stats: VanishStats = {
        totalMessages: 0,
        readMessages: 0,
        expiredMessages: 0,
        screenshotAttempts: 0,
        avgReadTime: 0,
    };

    private constructor() { }

    static getInstance(): VanishModeManager {
        if (!VanishModeManager.instance) {
            VanishModeManager.instance = new VanishModeManager();
        }
        return VanishModeManager.instance;
    }

    /**
     * Configure vanish mode
     */
    configure(config: Partial<VanishConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Create a vanish message
     */
    createVanishMessage(
        content: string,
        type: VanishModeType = 'timed',
        timeout?: number
    ): VanishMessage {
        // Validate content
        if (content.length > this.config.maxMessageLength) {
            throw new Error(`Message exceeds maximum length of ${this.config.maxMessageLength}`);
        }

        const id = this.generateId();
        const now = Date.now();

        const message: VanishMessage = {
            id,
            content,
            type,
            createdAt: now,
            status: 'pending',
        };

        // Set expiration based on type
        if (type === 'read_once') {
            message.expiresAt = undefined; // Expires when read
        } else if (type === 'timed') {
            message.expiresAt = now + (timeout || this.config.defaultTimeout);
        } else if (type === 'after_exit') {
            message.expiresAt = now + (timeout || 60000); // 1 minute default
        }

        this.messages.set(id, message);
        this.stats.totalMessages++;

        return message;
    }

    /**
     * Mark message as read
     */
    markAsRead(messageId: string): VanishMessage | null {
        const message = this.messages.get(messageId);
        if (!message) return null;

        message.status = 'delivered';
        message.readAt = Date.now();

        // Calculate read time
        const readTime = message.readAt! - message.createdAt;
        this.updateAvgReadTime(readTime);
        this.stats.readMessages++;

        // Handle read-once messages
        if (message.type === 'read_once') {
            message.status = 'read';
            message.expiresAt = Date.now(); // Expire immediately after read
        }

        // Schedule expiration for timed messages
        if (message.type === 'timed') {
            setTimeout(() => {
                if (message.status === 'delivered') {
                    this.expireMessage(messageId);
                }
            }, Math.max(0, (message.expiresAt || 0) - Date.now()));
        }

        this.notifyListeners(messageId, message);
        return message;
    }

    /**
     * Expire a message
     */
    expireMessage(messageId: string): VanishMessage | null {
        const message = this.messages.get(messageId);
        if (!message || message.status === 'read' || message.status === 'expired') return null;

        message.status = 'expired';
        message.content = ''; // Clear content
        this.stats.expiredMessages++;

        this.notifyListeners(messageId, message);
        return message;
    }

    /**
     * Handle screenshot detection
     */
    handleScreenshot(messageId: string): void {
        const message = this.messages.get(messageId);
        if (!message) return;

        if (!this.config.allowScreenshots) {
            message.metadata = {
                ...message.metadata,
                screenshotTaken: true,
                screenshotTime: Date.now(),
            };

            this.stats.screenshotAttempts++;
            this.notifyListeners(messageId, message);
        }
    }

    /**
     * Start screenshot detection
     */
    startScreenshotDetection(): void {
        if (this.screenshotDetectionInterval) return;

        // Listen for keyboard shortcuts that might indicate screenshots
        document.addEventListener('keydown', this.handleKeyDown);

        // Use the visibilitychange API to detect when user leaves (might take screenshot)
        document.addEventListener('visibilitychange', this.handleVisibilityChange);

        this.screenshotDetectionInterval = setInterval(() => {
            // Periodic check for screenshot indicators
            this.checkForScreenshots();
        }, 5000);
    }

    /**
     * Stop screenshot detection
     */
    stopScreenshotDetection(): void {
        if (this.screenshotDetectionInterval) {
            clearInterval(this.screenshotDetectionInterval);
            this.screenshotDetectionInterval = null;
        }
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }

    private handleKeyDown = (e: KeyboardEvent): void => {
        // Detect common screenshot shortcuts
        if (
            (e.key === 'PrintScreen') ||
            (e.metaKey && e.shiftKey && e.key === '3') || // Mac screenshot
            (e.metaKey && e.shiftKey && e.key === '4') || // Mac selection screenshot
            (e.ctrlKey && e.key === 's') // Sometimes used for save
        ) {
            this.notifyScreenshotAttempt();
        }
    };

    private handleVisibilityChange = (): void => {
        if (document.hidden) {
            // User might be taking a screenshot outside the window
            this.notifyScreenshotAttempt();
        }
    };

    private checkForScreenshots(): void {
        // Check for clipboard changes (some screenshot tools copy to clipboard)
        navigator.clipboard.read().then((items) => {
            items.forEach((item) => {
                if (item.types.some(type => type.includes('image'))) {
                    this.notifyScreenshotAttempt();
                }
            });
        }).catch(() => {
            // Clipboard read might fail, ignore
        });
    }

    private notifyScreenshotAttempt(): void {
        if (this.config.notifyOnScreenshot) {
            this.stats.screenshotAttempts++;
            // Notify all active vanish messages
            this.messages.forEach((message) => {
                if (message.status === 'pending' || message.status === 'delivered') {
                    message.metadata = {
                        ...message.metadata,
                        screenshotTaken: true,
                        screenshotTime: Date.now(),
                    };
                    this.notifyListeners(message.id, message);
                }
            });
        }
    }

    /**
     * Forward a vanish message
     */
    forwardMessage(messageId: string, newType?: VanishModeType): VanishMessage | null {
        const original = this.messages.get(messageId);
        if (!original || original.status === 'expired') return null;

        // Mark original as forwarded
        original.metadata = { ...original.metadata, forwarded: true };

        // Create new vanish message
        const newMessage = this.createVanishMessage(
            original.content,
            newType || original.type
        );

        return newMessage;
    }

    /**
     * Reply to a vanish message
     */
    replyToMessage(messageId: string, content: string): VanishMessage | null {
        const original = this.messages.get(messageId);
        if (!original) return null;

        original.metadata = {
            ...original.metadata,
            reply: content,
        };

        this.notifyListeners(messageId, original);
        return this.createVanishMessage(content, 'timed', this.config.defaultTimeout);
    }

    /**
     * Get a message
     */
    getMessage(messageId: string): VanishMessage | undefined {
        return this.messages.get(messageId);
    }

    /**
     * Get all active messages
     */
    getActiveMessages(): VanishMessage[] {
        return Array.from(this.messages.values()).filter(
            m => m.status !== 'expired' && m.status !== 'read'
        );
    }

    /**
     * Get messages by type
     */
    getMessagesByType(type: VanishModeType): VanishMessage[] {
        return Array.from(this.messages.values()).filter(m => m.type === type);
    }

    /**
     * Subscribe to message updates
     */
    subscribe(messageId: string, listener: (message: VanishMessage) => void): () => void {
        if (!this.listeners.has(messageId)) {
            this.listeners.set(messageId, new Set());
        }
        this.listeners.get(messageId)!.add(listener);

        return () => {
            const listeners = this.listeners.get(messageId);
            if (listeners) {
                listeners.delete(listener);
            }
        };
    }

    /**
     * Notify listeners
     */
    private notifyListeners(messageId: string, message: VanishMessage): void {
        const listeners = this.listeners.get(messageId);
        if (listeners) {
            listeners.forEach(listener => listener(message));
        }
    }

    /**
     * Update average read time
     */
    private updateAvgReadTime(readTime: number): void {
        const totalReads = this.stats.readMessages;
        this.stats.avgReadTime =
            (this.stats.avgReadTime * (totalReads - 1) + readTime) / totalReads;
    }

    /**
     * Get stats
     */
    getStats(): VanishStats {
        return { ...this.stats };
    }

    /**
     * Get remaining time for a message
     */
    getRemainingTime(messageId: string): number | null {
        const message = this.messages.get(messageId);
        if (!message || !message.expiresAt) return null;

        const remaining = message.expiresAt - Date.now();
        return remaining > 0 ? remaining : 0;
    }

    /**
     * Clear all messages
     */
    clear(): void {
        this.messages.clear();
        this.notifyAllListeners();
    }

    /**
     * Clear expired messages
     */
    clearExpired(): void {
        this.messages.forEach((message, id) => {
            if (message.status === 'expired' || message.status === 'read') {
                this.messages.delete(id);
            }
        });
    }

    /**
     * Notify all listeners
     */
    private notifyAllListeners(): void {
        this.messages.forEach((message, id) => {
            this.notifyListeners(id, message);
        });
    }

    /**
     * Generate unique ID
     */
    private generateId(): string {
        return `vanish_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get configuration
     */
    getConfig(): VanishConfig {
        return { ...this.config };
    }

    /**
     * Cleanup
     */
    destroy(): void {
        this.stopScreenshotDetection();
        this.messages.clear();
        this.listeners.clear();
        this.stats = {
            totalMessages: 0,
            readMessages: 0,
            expiredMessages: 0,
            screenshotAttempts: 0,
            avgReadTime: 0,
        };
    }
}

export const vanishModeManager = VanishModeManager.getInstance();
export type { VanishMessage, VanishConfig, VanishStats };
