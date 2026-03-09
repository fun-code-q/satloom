/**
 * Message Pins System
 * 
 * Pin messages to channels/rooms for quick access,
 * with support for multiple pins, categories, and expiration.
 */

type PinCategory = 'important' | 'announcement' | 'todo' | 'reference' | 'custom';

interface MessagePin {
    id: string;
    messageId: string;
    channelId: string;
    channelName?: string;
    content: PinContent;
    pinnedBy: string;
    pinnedByName: string;
    pinnedAt: number;
    expiresAt?: number;
    category: PinCategory;
    order: number;
    isActive: boolean;
    viewCount: number;
    lastViewed?: number;
}

interface PinContent {
    type: 'text' | 'image' | 'file' | 'poll' | 'mixed';
    text?: string;
    attachments?: Attachment[];
    preview?: string;
}

interface Attachment {
    id: string;
    type: 'image' | 'file' | 'video' | 'audio';
    url: string;
    name: string;
    size: number;
    mimeType?: string;
    thumbnail?: string;
}

interface PinSettings {
    maxPinsPerChannel: number;
    allowCategoryOverride: boolean;
    autoExpireDays?: number;
    requirePermission: boolean;
    showPinBadge: boolean;
    pinNotifications: boolean;
}

interface PinSearchQuery {
    channelId?: string;
    category?: PinCategory;
    searchText?: string;
    pinnedBy?: string;
    fromDate?: number;
    toDate?: number;
    includeExpired: boolean;
    limit: number;
    offset: number;
}

class MessagePins {
    private static instance: MessagePins;
    private storageKey = 'satloom_message_pins';
    private pins: Map<string, MessagePin> = new Map();
    private listeners: ((pins: MessagePin[]) => void)[] = [];

    private constructor() {
        this.loadFromStorage();
    }

    static getInstance(): MessagePins {
        if (!MessagePins.instance) {
            MessagePins.instance = new MessagePins();
        }
        return MessagePins.instance;
    }

    /**
     * Load pins from localStorage
     */
    private loadFromStorage(): void {
        try {
            const data = localStorage.getItem(this.storageKey);
            if (data) {
                const parsed = JSON.parse(data);
                this.pins = new Map(Object.entries(parsed));
            }
        } catch (error) {
            console.error('Failed to load message pins:', error);
            this.pins = new Map();
        }
    }

    /**
     * Save pins to localStorage
     */
    private saveToStorage(): void {
        try {
            const data = Object.fromEntries(this.pins);
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (error) {
            console.error('Failed to save message pins:', error);
        }
    }

    /**
     * Pin a message
     */
    pinMessage(
        messageId: string,
        channelId: string,
        content: PinContent,
        pinnedBy: string,
        pinnedByName: string,
        options?: { category?: PinCategory; expiresAt?: number; channelName?: string }
    ): MessagePin | null {
        // Check max pins limit
        const channelPins = this.getPinsForChannel(channelId);
        const maxPins = 50; // Default max

        if (channelPins.length >= maxPins) {
            console.warn('Maximum pins reached for this channel');
            return null;
        }

        // Get next order
        const maxOrder = Math.max(0, ...channelPins.map(p => p.order));

        const pin: MessagePin = {
            id: `pin_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            messageId,
            channelId,
            channelName: options?.channelName,
            content,
            pinnedBy,
            pinnedByName,
            pinnedAt: Date.now(),
            expiresAt: options?.expiresAt,
            category: options?.category || 'important',
            order: maxOrder + 1,
            isActive: true,
            viewCount: 0,
        };

        this.pins.set(pin.id, pin);
        this.saveToStorage();
        this.notifyListeners();

        return pin;
    }

    /**
     * Unpin a message
     */
    unpinMessage(pinId: string): boolean {
        const pin = this.pins.get(pinId);
        if (!pin) return false;

        pin.isActive = false;
        this.saveToStorage();
        this.notifyListeners();

        return true;
    }

    /**
     * Delete pin permanently
     */
    deletePin(pinId: string): boolean {
        const deleted = this.pins.delete(pinId);
        if (deleted) {
            this.saveToStorage();
            this.notifyListeners();
        }
        return deleted;
    }

    /**
     * Update pin
     */
    updatePin(pinId: string, updates: Partial<MessagePin>): MessagePin | null {
        const pin = this.pins.get(pinId);
        if (!pin) return null;

        const updated = { ...pin, ...updates };
        this.pins.set(pinId, updated);
        this.saveToStorage();
        this.notifyListeners();

        return updated;
    }

    /**
     * Reorder pins
     */
    reorderPins(channelId: string, pinIds: string[]): boolean {
        const channelPins = this.getPinsForChannel(channelId);
        const pinSet = new Set(pinIds);

        // Verify all pins belong to channel
        if (!channelPins.every(p => pinSet.has(p.id))) {
            return false;
        }

        // Update order
        pinIds.forEach((id, index) => {
            const pin = this.pins.get(id);
            if (pin) {
                pin.order = index;
            }
        });

        this.saveToStorage();
        this.notifyListeners();

        return true;
    }

    /**
     * Get pins for a channel
     */
    getPinsForChannel(channelId: string): MessagePin[] {
        const now = Date.now();
        return Array.from(this.pins.values())
            .filter(p => p.channelId === channelId && p.isActive)
            .filter(p => !p.expiresAt || p.expiresAt > now)
            .sort((a, b) => a.order - b.order);
    }

    /**
     * Get single pin
     */
    getPin(pinId: string): MessagePin | null {
        return this.pins.get(pinId) || null;
    }

    /**
     * Search pins
     */
    search(query: PinSearchQuery): MessagePin[] {
        let results: MessagePin[] = [];
        const now = Date.now();

        // Convert to array
        const allPins = Array.from(this.pins.values());

        // Filter by channel
        if (query.channelId) {
            results = allPins.filter(p => p.channelId === query.channelId);
        } else {
            results = allPins;
        }

        // Filter by category
        if (query.category) {
            results = results.filter(p => p.category === query.category);
        }

        // Filter by text content
        if (query.searchText) {
            const search = query.searchText.toLowerCase();
            results = results.filter(p =>
                p.content.text?.toLowerCase().includes(search) ||
                p.pinnedByName.toLowerCase().includes(search)
            );
        }

        // Filter by pinned by
        if (query.pinnedBy) {
            results = results.filter(p => p.pinnedBy === query.pinnedBy);
        }

        // Filter by date range
        if (query.fromDate) {
            results = results.filter(p => p.pinnedAt >= query.fromDate!);
        }
        if (query.toDate) {
            results = results.filter(p => p.pinnedAt <= query.toDate!);
        }

        // Filter expired
        if (!query.includeExpired) {
            results = results.filter(p => p.isActive && (!p.expiresAt || p.expiresAt > now));
        }

        // Sort by order
        results.sort((a, b) => a.order - b.order);

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
     * Record pin view
     */
    viewPin(pinId: string): void {
        const pin = this.pins.get(pinId);
        if (pin) {
            pin.viewCount++;
            pin.lastViewed = Date.now();
            this.saveToStorage();
        }
    }

    /**
     * Get pin statistics
     */
    getStats(): {
        totalPins: number;
        activePins: number;
        expiredPins: number;
        byCategory: Record<PinCategory, number>;
        topViewed: MessagePin[];
        recentlyPinned: MessagePin[];
    } {
        const now = Date.now();
        const allPins = Array.from(this.pins.values());

        const active = allPins.filter(p => p.isActive && (!p.expiresAt || p.expiresAt > now));
        const expired = allPins.filter(p => p.expiresAt && p.expiresAt <= now);

        const byCategory: Record<PinCategory, number> = {
            important: 0,
            announcement: 0,
            todo: 0,
            reference: 0,
            custom: 0,
        };

        active.forEach(p => {
            byCategory[p.category]++;
        });

        return {
            totalPins: allPins.length,
            activePins: active.length,
            expiredPins: expired.length,
            byCategory,
            topViewed: [...active].sort((a, b) => b.viewCount - a.viewCount).slice(0, 5),
            recentlyPinned: [...active].sort((a, b) => b.pinnedAt - a.pinnedAt).slice(0, 5),
        };
    }

    /**
     * Clean up expired pins
     */
    cleanupExpired(): number {
        const now = Date.now();
        let count = 0;

        for (const [id, pin] of this.pins) {
            if (pin.expiresAt && pin.expiresAt <= now) {
                pin.isActive = false;
                count++;
            }
        }

        if (count > 0) {
            this.saveToStorage();
            this.notifyListeners();
        }

        return count;
    }

    /**
     * Subscribe to changes
     */
    subscribe(listener: (pins: MessagePin[]) => void): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    /**
     * Notify listeners
     */
    private notifyListeners(): void {
        const activePins = Array.from(this.pins.values()).filter(p => p.isActive);
        this.listeners.forEach(listener => listener(activePins));
    }

    /**
     * Export pins
     */
    export(channelId?: string): string {
        const pins = channelId
            ? Array.from(this.pins.values()).filter(p => p.channelId === channelId)
            : Array.from(this.pins.values());

        return JSON.stringify({
            pins,
            exportedAt: new Date().toISOString(),
        });
    }

    /**
     * Clear all pins
     */
    clear(): void {
        this.pins.clear();
        this.saveToStorage();
        this.notifyListeners();
    }
}

export const messagePins = MessagePins.getInstance();
export type { MessagePin, PinContent, Attachment, PinCategory, PinSettings, PinSearchQuery };
