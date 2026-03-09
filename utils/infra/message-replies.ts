/**
 * Message Replies System
 * 
 * Thread-based messaging with reply chains,
 * mentions, and nested threading support.
 */

type ReplyStatus = 'open' | 'resolved' | 'archived';

interface MessageReply {
    id: string;
    messageId: string;
    parentReplyId: string | null;
    channelId: string;
    content: ReplyContent;
    authorId: string;
    authorName: string;
    authorAvatar?: string;
    createdAt: number;
    updatedAt?: number;
    status: ReplyStatus;
    mentions: string[];
    replyCount: number;
    lastReplyAt?: number;
    lastReplyBy?: string;
    isPinned: boolean;
    viewCount: number;
    reactionCount: number;
    reactions: Record<string, string[]>; // emoji -> userIds
}

interface ReplyContent {
    text: string;
    attachments?: Attachment[];
    mentions?: string[];
    replyToId?: string;
    replyToName?: string;
}

interface Attachment {
    id: string;
    type: 'image' | 'file' | 'video' | 'audio' | 'code';
    url: string;
    name: string;
    size: number;
    mimeType?: string;
    thumbnail?: string;
}

interface ReplyThread {
    id: string;
    rootMessageId: string;
    channelId: string;
    title?: string;
    status: ReplyStatus;
    createdAt: number;
    updatedAt: number;
    replyCount: number;
    participantCount: number;
    participants: string[];
    isSubscribed: boolean;
    lastActivityAt: number;
}

interface ReplyNotification {
    id: string;
    threadId: string;
    replyId: string;
    userId: string;
    type: 'mention' | 'reply' | 'update';
    read: boolean;
    createdAt: number;
}

interface ReplySettings {
    maxThreadDepth: number;
    maxRepliesPerThread: number;
    autoSubscribeAuthor: boolean;
    notifyOnMention: boolean;
    showParentPreview: boolean;
    collapseOldThreads: boolean;
    threadExpirationDays?: number;
    allowResolvedArchive: boolean;
}

interface ThreadSearchQuery {
    channelId?: string;
    status?: ReplyStatus;
    participant?: string;
    searchText?: string;
    fromDate?: number;
    toDate?: number;
    subscribedOnly: boolean;
    limit: number;
    offset: number;
}

interface ReplyAnalytics {
    totalThreads: number;
    activeThreads: number;
    resolvedThreads: number;
    totalReplies: number;
    avgRepliesPerThread: number;
    topParticipants: { userId: string; name: string; replyCount: number }[];
}

class MessageReplies {
    private static instance: MessageReplies;
    private storageKey = 'satloom_message_replies';
    private replies: Map<string, MessageReply> = new Map();
    private threads: Map<string, ReplyThread> = new Map();
    private notifications: Map<string, ReplyNotification> = new Map();
    private settings: ReplySettings = {
        maxThreadDepth: 5,
        maxRepliesPerThread: 500,
        autoSubscribeAuthor: true,
        notifyOnMention: true,
        showParentPreview: true,
        collapseOldThreads: false,
        allowResolvedArchive: true,
    };
    private listeners: ((data: { replies: MessageReply[]; threads: ReplyThread[] }) => void)[] = [];

    private constructor() {
        this.loadFromStorage();
    }

    static getInstance(): MessageReplies {
        if (!MessageReplies.instance) {
            MessageReplies.instance = new MessageReplies();
        }
        return MessageReplies.instance;
    }

    /**
     * Load from localStorage
     */
    private loadFromStorage(): void {
        try {
            const data = localStorage.getItem(this.storageKey);
            if (data) {
                const parsed = JSON.parse(data);
                this.replies = new Map(Object.entries(parsed.replies || {}));
                this.threads = new Map(Object.entries(parsed.threads || {}));
                this.notifications = new Map(Object.entries(parsed.notifications || {}));
            }
        } catch (error) {
            console.error('Failed to load replies:', error);
        }
    }

    /**
     * Save to localStorage
     */
    private saveToStorage(): void {
        try {
            const data = {
                replies: Object.fromEntries(this.replies),
                threads: Object.fromEntries(this.threads),
                notifications: Object.fromEntries(this.notifications),
            };
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (error) {
            console.error('Failed to save replies:', error);
        }
    }

    /**
     * Update settings
     */
    configure(settings: Partial<ReplySettings>): void {
        this.settings = { ...this.settings, ...settings };
    }

    /**
     * Create a new reply thread
     */
    createThread(
        messageId: string,
        channelId: string,
        content: ReplyContent,
        authorId: string,
        authorName: string,
        authorAvatar?: string,
        title?: string
    ): { thread: ReplyThread; reply: MessageReply } | null {
        const threadId = `thread_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        // Create thread
        const thread: ReplyThread = {
            id: threadId,
            rootMessageId: messageId,
            channelId,
            title,
            status: 'open',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            replyCount: 1,
            participantCount: 1,
            participants: [authorId],
            isSubscribed: true,
            lastActivityAt: Date.now(),
        };

        // Create initial reply
        const mentions = this.extractMentions(content.text);
        const reply: MessageReply = {
            id: `reply_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            messageId,
            parentReplyId: null,
            channelId,
            content,
            authorId,
            authorName,
            authorAvatar,
            createdAt: Date.now(),
            status: 'open',
            mentions,
            replyCount: 0,
            isPinned: false,
            viewCount: 0,
            reactionCount: 0,
            reactions: {},
        };

        // Create notification for mentions
        if (this.settings.notifyOnMention) {
            mentions.forEach(userId => {
                if (userId !== authorId) {
                    this.createNotification(threadId, reply.id, userId, 'mention');
                }
            });
        }

        this.threads.set(threadId, thread);
        this.replies.set(reply.id, reply);
        this.saveToStorage();
        this.notifyListeners();

        return { thread, reply };
    }

    /**
     * Add reply to thread
     */
    addReply(
        threadId: string,
        messageId: string,
        content: ReplyContent,
        authorId: string,
        authorName: string,
        authorAvatar?: string,
        parentReplyId?: string
    ): MessageReply | null {
        const thread = this.threads.get(threadId);
        if (!thread) return null;

        // Check max replies limit
        if (thread.replyCount >= this.settings.maxRepliesPerThread) {
            console.warn('Thread has reached maximum replies limit');
            return null;
        }

        // Check thread depth if parent specified
        if (parentReplyId) {
            const parentReply = this.replies.get(parentReplyId);
            if (parentReply && parentReply.parentReplyId) {
                // Calculate depth
                let depth = 0;
                let current = parentReply;
                while (current.parentReplyId && depth < this.settings.maxThreadDepth) {
                    current = this.replies.get(current.parentReplyId)!;
                    depth++;
                }
                if (depth >= this.settings.maxThreadDepth) {
                    console.warn('Maximum thread depth reached');
                    return null;
                }
            }
        }

        // Extract mentions
        const mentions = this.extractMentions(content.text);

        const reply: MessageReply = {
            id: `reply_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            messageId,
            parentReplyId: parentReplyId || null,
            channelId: thread.channelId,
            content,
            authorId,
            authorName,
            authorAvatar,
            createdAt: Date.now(),
            status: 'open',
            mentions,
            replyCount: 0,
            lastReplyAt: Date.now(),
            lastReplyBy: authorName,
            isPinned: false,
            viewCount: 0,
            reactionCount: 0,
            reactions: {},
        };

        // Update thread
        thread.replyCount++;
        thread.updatedAt = Date.now();
        thread.lastActivityAt = Date.now();

        if (!thread.participants.includes(authorId)) {
            thread.participants.push(authorId);
            thread.participantCount = thread.participants.length;
        }

        // Update parent reply
        if (parentReplyId) {
            const parent = this.replies.get(parentReplyId);
            if (parent) {
                parent.replyCount++;
                parent.lastReplyAt = Date.now();
                parent.lastReplyBy = authorName;
            }
        }

        // Create notifications
        if (this.settings.notifyOnMention) {
            mentions.forEach(userId => {
                if (userId !== authorId) {
                    this.createNotification(threadId, reply.id, userId, 'mention');
                }
            });
        }

        // Notify thread subscribers
        if (thread.isSubscribed && authorId !== thread.participants[0]) {
            this.createNotification(threadId, reply.id, thread.participants[0], 'reply');
        }

        this.replies.set(reply.id, reply);
        this.threads.set(threadId, thread);
        this.saveToStorage();
        this.notifyListeners();

        return reply;
    }

    /**
     * Extract mentions from text
     */
    private extractMentions(text: string): string[] {
        const mentionRegex = /@(\w+)/g;
        const matches = text.match(mentionRegex);
        return matches ? matches.map(m => m.substring(1)) : [];
    }

    /**
     * Get thread by ID
     */
    getThread(threadId: string): ReplyThread | null {
        return this.threads.get(threadId) || null;
    }

    /**
     * Get replies for thread
     */
    getRepliesForThread(threadId: string, limit?: number): MessageReply[] {
        const thread = this.threads.get(threadId);
        if (!thread) return [];

        const replies = Array.from(this.replies.values())
            .filter(r => r.messageId === thread.rootMessageId && r.channelId === thread.channelId)
            .sort((a, b) => a.createdAt - b.createdAt);

        return limit ? replies.slice(0, limit) : replies;
    }

    /**
     * Get nested replies (threaded view)
     */
    getNestedReplies(threadId: string): MessageReply[] {
        const thread = this.threads.get(threadId);
        if (!thread) return [];

        const allReplies = this.getRepliesForThread(threadId);

        // Build reply tree
        const replyMap = new Map<string, MessageReply>();
        const rootReplies: MessageReply[] = [];

        allReplies.forEach(reply => {
            replyMap.set(reply.id, { ...reply, replyCount: 0 });
        });

        // Count children and build hierarchy
        allReplies.forEach(reply => {
            if (reply.parentReplyId) {
                const parent = replyMap.get(reply.parentReplyId);
                if (parent) {
                    parent.replyCount++;
                }
            } else {
                rootReplies.push(replyMap.get(reply.id)!);
            }
        });

        return rootReplies;
    }

    /**
     * Update reply
     */
    updateReply(replyId: string, content: Partial<ReplyContent>): MessageReply | null {
        const reply = this.replies.get(replyId);
        if (!reply) return null;

        if (content.text !== undefined) {
            reply.content.text = content.text;
            reply.mentions = this.extractMentions(content.text);
        }
        if (content.attachments !== undefined) {
            reply.content.attachments = content.attachments;
        }

        reply.updatedAt = Date.now();
        this.replies.set(replyId, reply);
        this.saveToStorage();
        this.notifyListeners();

        return reply;
    }

    /**
     * Delete reply
     */
    deleteReply(replyId: string): boolean {
        const reply = this.replies.get(replyId);
        if (!reply) return false;

        // Soft delete
        reply.content.text = '[deleted]';
        reply.content.attachments = [];
        this.replies.set(replyId, reply);

        this.saveToStorage();
        this.notifyListeners();

        return true;
    }

    /**
     * Set thread status
     */
    setThreadStatus(threadId: string, status: ReplyStatus): boolean {
        const thread = this.threads.get(threadId);
        if (!thread) return false;

        thread.status = status;
        thread.updatedAt = Date.now();
        this.threads.set(threadId, thread);
        this.saveToStorage();
        this.notifyListeners();

        return true;
    }

    /**
     * Toggle thread subscription
     */
    toggleSubscription(threadId: string, userId: string): boolean {
        const thread = this.threads.get(threadId);
        if (!thread) return false;

        thread.isSubscribed = !thread.isSubscribed;
        this.threads.set(threadId, thread);
        this.saveToStorage();
        this.notifyListeners();

        return thread.isSubscribed;
    }

    /**
     * Pin/unpin reply
     */
    togglePinReply(replyId: string): boolean {
        const reply = this.replies.get(replyId);
        if (!reply) return false;

        reply.isPinned = !reply.isPinned;
        this.replies.set(replyId, reply);
        this.saveToStorage();
        this.notifyListeners();

        return reply.isPinned;
    }

    /**
     * Add reaction to reply
     */
    addReaction(replyId: string, emoji: string, userId: string): boolean {
        const reply = this.replies.get(replyId);
        if (!reply) return false;

        if (!reply.reactions[emoji]) {
            reply.reactions[emoji] = [];
        }

        if (!reply.reactions[emoji].includes(userId)) {
            reply.reactions[emoji].push(userId);
            reply.reactionCount++;
            this.replies.set(replyId, reply);
            this.saveToStorage();
        }

        return true;
    }

    /**
     * Remove reaction from reply
     */
    removeReaction(replyId: string, emoji: string, userId: string): boolean {
        const reply = this.replies.get(replyId);
        if (!reply || !reply.reactions[emoji]) return false;

        const index = reply.reactions[emoji].indexOf(userId);
        if (index > -1) {
            reply.reactions[emoji].splice(index, 1);
            reply.reactionCount--;
            if (reply.reactions[emoji].length === 0) {
                delete reply.reactions[emoji];
            }
            this.replies.set(replyId, reply);
            this.saveToStorage();
        }

        return true;
    }

    /**
     * Create notification
     */
    private createNotification(threadId: string, replyId: string, userId: string, type: 'mention' | 'reply' | 'update'): void {
        const notification: ReplyNotification = {
            id: `notif_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            threadId,
            replyId,
            userId,
            type,
            read: false,
            createdAt: Date.now(),
        };

        this.notifications.set(notification.id, notification);
    }

    /**
     * Get unread notifications
     */
    getUnreadNotifications(userId: string): ReplyNotification[] {
        return Array.from(this.notifications.values())
            .filter(n => n.userId === userId && !n.read)
            .sort((a, b) => b.createdAt - a.createdAt);
    }

    /**
     * Mark notification as read
     */
    markNotificationRead(notificationId: string): boolean {
        const notification = this.notifications.get(notificationId);
        if (!notification) return false;

        notification.read = true;
        this.notifications.set(notificationId, notification);
        return true;
    }

    /**
     * Mark all notifications as read for user
     */
    markAllNotificationsRead(userId: string): number {
        let count = 0;
        for (const [id, notification] of this.notifications) {
            if (notification.userId === userId && !notification.read) {
                notification.read = true;
                count++;
            }
        }
        return count;
    }

    /**
     * Search threads
     */
    searchThreads(query: ThreadSearchQuery): ReplyThread[] {
        let results: ReplyThread[] = [];

        const allThreads = Array.from(this.threads.values());

        // Filter by channel
        if (query.channelId) {
            results = allThreads.filter(t => t.channelId === query.channelId);
        } else {
            results = allThreads;
        }

        // Filter by status
        if (query.status) {
            results = results.filter(t => t.status === query.status);
        }

        // Filter by participant
        if (query.participant) {
            const participant = query.participant;
            results = results.filter(t => t.participants.includes(participant));
        }

        // Filter by subscribed only
        if (query.subscribedOnly) {
            results = results.filter(t => t.isSubscribed);
        }

        // Filter by date range
        if (query.fromDate) {
            results = results.filter(t => t.createdAt >= query.fromDate!);
        }
        if (query.toDate) {
            results = results.filter(t => t.createdAt <= query.toDate!);
        }

        // Sort by last activity
        results.sort((a, b) => b.lastActivityAt - a.lastActivityAt);

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
     * Get analytics
     */
    getAnalytics(): ReplyAnalytics {
        const allThreads = Array.from(this.threads.values());
        const allReplies = Array.from(this.replies.values());

        const byParticipant: Record<string, number> = {};
        allReplies.forEach(r => {
            byParticipant[r.authorId] = (byParticipant[r.authorId] || 0) + 1;
        });

        const topParticipants = Object.entries(byParticipant)
            .map(([userId, count]) => {
                const reply = allReplies.find(r => r.authorId === userId);
                return { userId, name: reply?.authorName || 'Unknown', replyCount: count };
            })
            .sort((a, b) => b.replyCount - a.replyCount)
            .slice(0, 10);

        return {
            totalThreads: allThreads.length,
            activeThreads: allThreads.filter(t => t.status === 'open').length,
            resolvedThreads: allThreads.filter(t => t.status === 'resolved').length,
            totalReplies: allReplies.length,
            avgRepliesPerThread: allThreads.length > 0 ? allThreads.reduce((sum, t) => sum + t.replyCount, 0) / allThreads.length : 0,
            topParticipants,
        };
    }

    /**
     * Subscribe to changes
     */
    subscribe(listener: (data: { replies: MessageReply[]; threads: ReplyThread[] }) => void): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    /**
     * Notify listeners
     */
    private notifyListeners(): void {
        const replies = Array.from(this.replies.values());
        const threads = Array.from(this.threads.values());
        this.listeners.forEach(listener => listener({ replies, threads }));
    }

    /**
     * Export data
     */
    export(): string {
        return JSON.stringify({
            threads: Object.fromEntries(this.threads),
            replies: Object.fromEntries(this.replies),
            notifications: Object.fromEntries(this.notifications),
            exportedAt: new Date().toISOString(),
        });
    }

    /**
     * Clear all data
     */
    clear(): void {
        this.replies.clear();
        this.threads.clear();
        this.notifications.clear();
        this.saveToStorage();
        this.notifyListeners();
    }
}

export const messageReplies = MessageReplies.getInstance();
export type { MessageReply, ReplyContent, Attachment, ReplyThread, ReplyNotification, ReplyStatus, ReplySettings, ThreadSearchQuery, ReplyAnalytics };
