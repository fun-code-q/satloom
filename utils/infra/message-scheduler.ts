/**
 * Message Scheduling System
 * 
 * Schedule messages to be sent at a later time,
 * with support for recurring messages, drafts, and reminders.
 */

type ScheduledStatus = 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled' | 'draft';
type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
type MessageType = 'text' | 'image' | 'file' | 'poll' | 'event' | 'ai';

interface ScheduledMessage {
    id: string;
    channelId: string;
    channelName?: string;
    content: MessageContent;
    scheduledFor: number; // Unix timestamp
    createdAt: number;
    status: ScheduledStatus;
    recurrence: RecurrenceConfig;
    metadata: MessageMetadata;
    sentAt?: number;
    error?: string;
}

interface MessageContent {
    type: MessageType;
    text?: string;
    attachments?: Attachment[];
    mentions?: string[];
    replyTo?: string;
    poll?: PollConfig;
    event?: EventConfig;
}

interface Attachment {
    id: string;
    type: 'image' | 'file' | 'video' | 'audio' | 'code';
    url: string;
    name: string;
    size: number;
    mimeType?: string;
    thumbnail?: string;
    metadata?: Record<string, unknown>;
}

interface PollConfig {
    question: string;
    options: { id: string; text: string }[];
    allowMultiple: boolean;
    hideVotes: boolean;
    expiresAt?: number;
}

interface EventConfig {
    title: string;
    description?: string;
    location?: string;
    startTime: number;
    endTime: number;
    isAllDay: boolean;
    reminders?: number[];
    attendees?: string[];
}

interface RecurrenceConfig {
    type: RecurrenceType;
    interval?: number; // Every N days/weeks/months
    daysOfWeek?: number[]; // 0-6 for weekly
    dayOfMonth?: number; // 1-31 for monthly
    monthOfYear?: number; // 0-11 for yearly
    endDate?: number; // When to stop recurring
    occurrences?: number; // How many times to send
    count?: number; // Current occurrence count
}

interface MessageMetadata {
    priority: 'low' | 'normal' | 'high' | 'urgent';
    tags?: string[];
    customFields?: Record<string, unknown>;
    encrypt?: boolean;
    pinAfterSend?: boolean;
}

interface ScheduleQuery {
    channelId?: string;
    status?: ScheduledStatus;
    fromDate?: number;
    toDate?: number;
    includeSent?: boolean;
    limit?: number;
    offset?: number;
}

interface ScheduleStats {
    totalScheduled: number;
    sentToday: number;
    scheduledForToday: number;
    failed: number;
    byChannel: Record<string, number>;
    byPriority: Record<string, number>;
}

interface BulkScheduleOperation {
    messages: Omit<ScheduledMessage, 'id' | 'createdAt' | 'status'>[];
    validateOnly?: boolean;
}

class MessageScheduler {
    private static instance: MessageScheduler;
    private storageKey = 'satloom_scheduled_messages';
    private messages: Map<string, ScheduledMessage> = new Map();
    private listeners: ((messages: ScheduledMessage[]) => void)[] = [];
    private checkInterval: NodeJS.Timeout | null = null;

    private constructor() {
        this.loadFromStorage();
        this.startScheduler();
    }

    static getInstance(): MessageScheduler {
        if (!MessageScheduler.instance) {
            MessageScheduler.instance = new MessageScheduler();
        }
        return MessageScheduler.instance;
    }

    /**
     * Load messages from localStorage
     */
    private loadFromStorage(): void {
        try {
            const data = localStorage.getItem(this.storageKey);
            if (data) {
                const parsed = JSON.parse(data);
                this.messages = new Map(Object.entries(parsed));
            }
        } catch (error) {
            console.error('Failed to load scheduled messages:', error);
            this.messages = new Map();
        }
    }

    /**
     * Save messages to localStorage
     */
    private saveToStorage(): void {
        try {
            const data = Object.fromEntries(this.messages);
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (error) {
            console.error('Failed to save scheduled messages:', error);
        }
    }

    /**
     * Start the scheduler
     */
    private startScheduler(): void {
        // Check every minute for messages to send
        this.checkInterval = setInterval(() => {
            this.processScheduledMessages();
        }, 60000);

        // Also check immediately
        this.processScheduledMessages();
    }

    /**
     * Stop the scheduler
     */
    stopScheduler(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    /**
     * Process scheduled messages
     */
    private async processScheduledMessages(): Promise<void> {
        const now = Date.now();

        for (const [id, message] of this.messages) {
            if (message.status === 'scheduled' && message.scheduledFor <= now) {
                await this.sendMessage(id);
            }
        }
    }

    /**
     * Send a scheduled message
     */
    private async sendMessage(id: string): Promise<boolean> {
        const message = this.messages.get(id);
        if (!message || message.status !== 'scheduled') return false;

        message.status = 'sending';
        this.saveToStorage();
        this.notifyListeners();

        try {
            // Simulate sending (replace with actual Firebase)
            await this.mockSend(message);

            message.status = 'sent';
            message.sentAt = Date.now();

            // Handle recurrence
            if (message.recurrence.type !== 'none') {
                const nextOccurrence = this.calculateNextOccurrence(message);
                if (nextOccurrence) {
                    const newMessage: ScheduledMessage = {
                        ...message,
                        id: `${message.id}_${Date.now()}`,
                        scheduledFor: nextOccurrence,
                        createdAt: Date.now(),
                        status: 'scheduled',
                        recurrence: {
                            ...message.recurrence,
                            count: (message.recurrence.count || 0) + 1,
                        },
                    };
                    this.messages.set(newMessage.id, newMessage);
                }
            }

            this.saveToStorage();
            this.notifyListeners();
            return true;
        } catch (error) {
            message.status = 'failed';
            message.error = error instanceof Error ? error.message : 'Unknown error';
            this.saveToStorage();
            this.notifyListeners();
            return false;
        }
    }

    /**
     * Mock send (replace with actual implementation)
     */
    private mockSend(message: ScheduledMessage): Promise<void> {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                // 95% success rate simulation
                if (Math.random() > 0.05) {
                    console.log(`Message sent: ${message.id}`, message.content);
                    resolve();
                } else {
                    reject(new Error('Network error'));
                }
            }, 500);
        });
    }

    /**
     * Calculate next occurrence for recurrence
     */
    private calculateNextOccurrence(message: ScheduledMessage): number | null {
        const { type, interval = 1, endDate } = message.recurrence;
        let nextDate = new Date(message.scheduledFor);

        // Check if past end date
        if (endDate && nextDate.getTime() > endDate) {
            return null;
        }

        switch (type) {
            case 'daily':
                nextDate.setDate(nextDate.getDate() + interval);
                break;
            case 'weekly':
                nextDate.setDate(nextDate.getDate() + 7 * interval);
                break;
            case 'monthly':
                nextDate.setMonth(nextDate.getMonth() + interval);
                break;
            case 'yearly':
                nextDate.setFullYear(nextDate.getFullYear() + interval);
                break;
            default:
                return null;
        }

        const result = nextDate.getTime();

        // Check if past end date
        if (endDate && result > endDate) {
            return null;
        }

        return result;
    }

    /**
     * Schedule a new message
     */
    schedule(message: Omit<ScheduledMessage, 'id' | 'createdAt' | 'status'>): ScheduledMessage {
        const id = `scheduled_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        const newMessage: ScheduledMessage = {
            ...message,
            id,
            createdAt: Date.now(),
            status: 'scheduled',
        };

        this.messages.set(id, newMessage);
        this.saveToStorage();
        this.notifyListeners();

        return newMessage;
    }

    /**
     * Save as draft
     */
    saveDraft(message: Omit<ScheduledMessage, 'id' | 'createdAt' | 'status' | 'scheduledFor'>): ScheduledMessage {
        const id = `draft_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        const newMessage: ScheduledMessage = {
            ...message,
            id,
            createdAt: Date.now(),
            scheduledFor: 0,
            status: 'draft',
        };

        this.messages.set(id, newMessage);
        this.saveToStorage();
        this.notifyListeners();

        return newMessage;
    }

    /**
     * Update scheduled message
     */
    update(id: string, updates: Partial<ScheduledMessage>): ScheduledMessage | null {
        const message = this.messages.get(id);
        if (!message) return null;

        const updated = { ...message, ...updates };
        this.messages.set(id, updated);
        this.saveToStorage();
        this.notifyListeners();

        return updated;
    }

    /**
     * Cancel scheduled message
     */
    cancel(id: string): boolean {
        const message = this.messages.get(id);
        if (!message) return false;

        message.status = 'cancelled';
        this.saveToStorage();
        this.notifyListeners();

        return true;
    }

    /**
     * Delete message permanently
     */
    delete(id: string): boolean {
        const deleted = this.messages.delete(id);
        if (deleted) {
            this.saveToStorage();
            this.notifyListeners();
        }
        return deleted;
    }

    /**
     * Get single message
     */
    get(id: string): ScheduledMessage | null {
        return this.messages.get(id) || null;
    }

    /**
     * Query messages
     */
    query(query: ScheduleQuery): ScheduledMessage[] {
        let results: ScheduledMessage[] = [];

        // Convert map to array
        const allMessages = Array.from(this.messages.values());

        // Filter by channel
        if (query.channelId) {
            results = allMessages.filter(m => m.channelId === query.channelId);
        } else {
            results = allMessages;
        }

        // Filter by status
        if (query.status) {
            results = results.filter(m => m.status === query.status);
        } else if (!query.includeSent) {
            // By default, exclude sent messages
            results = results.filter(m => m.status !== 'sent');
        }

        // Filter by date range
        if (query.fromDate) {
            results = results.filter(m => m.scheduledFor >= query.fromDate!);
        }
        if (query.toDate) {
            results = results.filter(m => m.scheduledFor <= query.toDate!);
        }

        // Sort by scheduled time
        results.sort((a, b) => a.scheduledFor - b.scheduledFor);

        // Pagination
        if (query.offset) {
            results = results.slice(query.offset);
        }
        if (query.limit) {
            results = results.slice(0, query.limit);
        }

        return results;
    }

    /**
     * Get messages for channel
     */
    getForChannel(channelId: string): ScheduledMessage[] {
        return this.query({ channelId, includeSent: true });
    }

    /**
     * Get upcoming messages
     */
    getUpcoming(limit = 10): ScheduledMessage[] {
        const now = Date.now();
        return this.query({
            status: 'scheduled',
            fromDate: now,
            toDate: now + 7 * 24 * 60 * 60 * 1000, // Next 7 days
            limit,
        });
    }

    /**
     * Get drafts
     */
    getDrafts(): ScheduledMessage[] {
        return this.query({ status: 'draft', includeSent: true });
    }

    /**
     * Get failed messages
     */
    getFailed(): ScheduledMessage[] {
        return this.query({ status: 'failed', includeSent: true });
    }

    /**
     * Retry failed message
     */
    async retry(id: string): Promise<boolean> {
        const message = this.messages.get(id);
        if (!message || message.status !== 'failed') return false;

        message.status = 'scheduled';
        message.error = undefined;
        this.saveToStorage();

        return this.sendMessage(id);
    }

    /**
     * Bulk schedule messages
     */
    async bulkSchedule(operation: BulkScheduleOperation): Promise<{ success: number; failed: number; errors: string[] }> {
        const results = { success: 0, failed: 0, errors: [] as string[] };

        if (operation.validateOnly) {
            // Just validate
            for (let i = 0; i < operation.messages.length; i++) {
                const msg = operation.messages[i];
                if (!msg.content.text && !msg.content.attachments?.length) {
                    results.errors.push(`Message ${i}: Content is required`);
                    results.failed++;
                } else if (msg.scheduledFor <= Date.now()) {
                    results.errors.push(`Message ${i}: Scheduled time must be in the future`);
                    results.failed++;
                } else {
                    results.success++;
                }
            }
            return results;
        }

        // Schedule all messages
        for (const msg of operation.messages) {
            try {
                this.schedule(msg);
                results.success++;
            } catch (error) {
                results.failed++;
                results.errors.push(error instanceof Error ? error.message : 'Unknown error');
            }
        }

        return results;
    }

    /**
     * Get statistics
     */
    getStats(): ScheduleStats {
        const allMessages = Array.from(this.messages.values());
        const now = Date.now();
        const todayStart = new Date().setHours(0, 0, 0, 0);

        const stats: ScheduleStats = {
            totalScheduled: allMessages.filter(m => m.status === 'scheduled').length,
            sentToday: allMessages.filter(m => m.status === 'sent' && m.sentAt && m.sentAt >= todayStart).length,
            scheduledForToday: allMessages.filter(m =>
                m.status === 'scheduled' &&
                m.scheduledFor >= todayStart &&
                m.scheduledFor < todayStart + 24 * 60 * 60 * 1000
            ).length,
            failed: allMessages.filter(m => m.status === 'failed').length,
            byChannel: {},
            byPriority: {},
        };

        // Count by channel
        for (const msg of allMessages) {
            stats.byChannel[msg.channelId] = (stats.byChannel[msg.channelId] || 0) + 1;
            stats.byPriority[msg.metadata.priority] = (stats.byPriority[msg.metadata.priority] || 0) + 1;
        }

        return stats;
    }

    /**
     * Export messages
     */
    export(query?: ScheduleQuery): string {
        const messages = query ? this.query(query) : Array.from(this.messages.values());
        return JSON.stringify({
            messages,
            exportedAt: new Date().toISOString(),
        });
    }

    /**
     * Import messages
     */
    import(json: string): { imported: number; skipped: number } {
        try {
            const data = JSON.parse(json);
            const messages = Array.isArray(data) ? data : data.messages;
            let imported = 0;
            let skipped = 0;

            for (const msg of messages) {
                // Check for duplicates
                if (!this.messages.has(msg.id)) {
                    // Regenerate ID to avoid conflicts
                    const newId = `imported_${Date.now()}_${Math.random().toString(36).substring(7)}`;
                    this.messages.set(newId, { ...msg, id: newId });
                    imported++;
                } else {
                    skipped++;
                }
            }

            this.saveToStorage();
            this.notifyListeners();

            return { imported, skipped };
        } catch (error) {
            throw new Error('Invalid import data');
        }
    }

    /**
     * Subscribe to changes
     */
    subscribe(listener: (messages: ScheduledMessage[]) => void): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    /**
     * Notify listeners
     */
    private notifyListeners(): void {
        const messages = Array.from(this.messages.values());
        this.listeners.forEach(listener => listener(messages));
    }

    /**
     * Clear all messages
     */
    clear(): void {
        this.messages.clear();
        this.saveToStorage();
        this.notifyListeners();
    }
}

export const messageScheduler = MessageScheduler.getInstance();
export type { ScheduledMessage, MessageContent, Attachment, PollConfig, EventConfig, RecurrenceConfig, MessageMetadata, ScheduleQuery, ScheduleStats, BulkScheduleOperation, ScheduledStatus, RecurrenceType, MessageType };
