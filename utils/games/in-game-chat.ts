/**
 * In-Game Chat System
 * 
 * Provides real-time chat for games including:
 * - Team chat (private messages between team members)
 * - Global game chat
 * - Emotes (quick reactions)
 * - Game-specific messages
 */

export type ChatType = 'global' | 'team' | 'private';
export type MessagePriority = 'low' | 'normal' | 'high' | 'urgent';

interface GameChatMessage {
    id: string;
    type: ChatType;
    senderId: string;
    senderName: string;
    senderTeam?: string;
    content: string;
    timestamp: number;
    priority: MessagePriority;
    isEmote: boolean;
    emoteId?: string;
    replyTo?: string;
    metadata?: Record<string, unknown>;
}

interface TeamInfo {
    id: string;
    name: string;
    members: string[];
    color: string;
    isAlive: boolean;
}

interface Emote {
    id: string;
    name: string;
    icon: string;
    category: 'reaction' | 'game' | 'celebration' | 'communication';
    animation?: string;
    sound?: string;
}

interface ChatChannel {
    id: string;
    type: ChatType;
    name: string;
    participants: string[];
    isMuted: boolean;
    unreadCount: number;
}

interface ChatConfig {
    maxMessagesPerChannel: number;
    messageExpirationTime: number; // ms
    enableEmotes: boolean;
    maxEmotePerMessage: number;
    enableTeamChat: boolean;
    emoteCooldown: number; // ms
    floodControl: boolean;
    maxMessagesPerSecond: number;
    showMessageTimestamps: boolean;
    enableAnimations: boolean;
}

interface MessageFilter {
    contains?: string;
    senderId?: string;
    type?: ChatType;
    after?: number;
    before?: number;
}

interface ChatStats {
    totalMessages: number;
    messagesByType: Record<ChatType, number>;
    emoteUsage: Record<string, number>;
    avgMessageLength: number;
    peakMessagesPerSecond: number;
}

const DEFAULT_EMOTES: Emote[] = [
    // Reactions
    { id: 'thumbs_up', name: 'Thumbs Up', icon: '👍', category: 'reaction' },
    { id: 'thumbs_down', name: 'Thumbs Down', icon: '👎', category: 'reaction' },
    { id: 'clap', name: 'Clap', icon: '👏', category: 'reaction' },
    { id: 'wave', name: 'Wave', icon: '👋', category: 'reaction' },
    { id: 'point_up', name: 'Point Up', icon: '☝️', category: 'reaction' },
    { id: 'raised_hands', name: 'Raised Hands', icon: '🙌', category: 'reaction' },
    { id: 'pray', name: 'Pray', icon: '🙏', category: 'reaction' },
    { id: 'muscle', name: 'Muscle', icon: '💪', category: 'reaction' },

    // Celebration
    { id: 'fire', name: 'Fire', icon: '🔥', category: 'celebration' },
    { id: 'trophy', name: 'Trophy', icon: '🏆', category: 'celebration' },
    { id: 'star', name: 'Star', icon: '⭐', category: 'celebration' },
    { id: 'confetti', name: 'Confetti', icon: '🎉', category: 'celebration' },
    { id: 'birthday', name: 'Birthday', icon: '🎂', category: 'celebration' },
    { id: 'party', name: 'Party', icon: '🥳', category: 'celebration' },
    { id: 'medal', name: 'Medal', icon: '🎖️', category: 'celebration' },

    // Game specific
    { id: 'dice', name: 'Dice', icon: '🎲', category: 'game' },
    { id: 'chess', name: 'Chess', icon: '♟️', category: 'game' },
    { id: 'game_die', name: 'Game Die', icon: '🎯', category: 'game' },
    { id: 'target', name: 'Target', icon: '🎯', category: 'game' },
    { id: 'dart', name: 'Dart', icon: '🎯', category: 'game' },

    // Communication
    { id: 'ok_hand', name: 'OK', icon: '👌', category: 'communication' },
    { id: '100', name: '100', icon: '💯', category: 'communication' },
    { id: 'eyes', name: 'Eyes', icon: '👀', category: 'communication' },
    { id: 'thinking', name: 'Thinking', icon: '🤔', category: 'communication' },
    { id: 'call_me', name: 'Call Me', icon: '🤙', category: 'communication' },
];

class InGameChat {
    private static instance: InGameChat;
    private messages: Map<string, GameChatMessage[]> = new Map();
    private channels: Map<string, ChatChannel> = new Map();
    private teams: Map<string, TeamInfo> = new Map();
    private emoteCooldowns: Map<string, number> = new Map();
    private messageRateLimit: { count: number; window: number }[] = [];
    private currentUserId: string = '';
    private currentUserName: string = '';
    private currentUserTeam: string | undefined;
    private listeners: Map<string, Set<(messages: GameChatMessage[]) => void>> = new Map();
    private unreadCounts: Map<string, number> = new Map();

    private config: ChatConfig = {
        maxMessagesPerChannel: 100,
        messageExpirationTime: 300000, // 5 minutes
        enableEmotes: true,
        maxEmotePerMessage: 1,
        enableTeamChat: true,
        emoteCooldown: 1000,
        floodControl: true,
        maxMessagesPerSecond: 5,
        showMessageTimestamps: true,
        enableAnimations: true,
    };

    private stats: ChatStats = {
        totalMessages: 0,
        messagesByType: { global: 0, team: 0, private: 0 },
        emoteUsage: {},
        avgMessageLength: 0,
        peakMessagesPerSecond: 0,
    };

    private constructor() {
        this.initializeChannels();
    }

    static getInstance(): InGameChat {
        if (!InGameChat.instance) {
            InGameChat.instance = new InGameChat();
        }
        return InGameChat.instance;
    }

    /**
     * Initialize default channels
     */
    private initializeChannels(): void {
        this.channels.set('global', {
            id: 'global',
            type: 'global',
            name: 'Game Chat',
            participants: [],
            isMuted: false,
            unreadCount: 0,
        });

        this.channels.set('team', {
            id: 'team',
            type: 'team',
            name: 'Team Chat',
            participants: [],
            isMuted: false,
            unreadCount: 0,
        });
    }

    /**
     * Configure the chat system
     */
    configure(config: Partial<ChatConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Set the current user
     */
    setCurrentUser(userId: string, userName: string, teamId?: string): void {
        this.currentUserId = userId;
        this.currentUserName = userName;
        this.currentUserTeam = teamId;

        // Add user to global channel
        const globalChannel = this.channels.get('global');
        if (globalChannel && !globalChannel.participants.includes(userId)) {
            globalChannel.participants.push(userId);
        }

        // Add user to team channel if applicable
        if (teamId) {
            const teamChannel = this.channels.get('team');
            if (teamChannel && !teamChannel.participants.includes(userId)) {
                teamChannel.participants.push(userId);
            }
        }
    }

    /**
     * Add a team to the game
     */
    addTeam(team: TeamInfo): void {
        this.teams.set(team.id, team);

        // Update team channel participants
        const teamChannel = this.channels.get('team');
        if (teamChannel) {
            teamChannel.participants = [...new Set([...teamChannel.participants, ...team.members])];
        }
    }

    /**
     * Remove a team from the game
     */
    removeTeam(teamId: string): void {
        const team = this.teams.get(teamId);
        if (team) {
            team.members.forEach(memberId => {
                const teamChannel = this.channels.get('team');
                if (teamChannel) {
                    teamChannel.participants = teamChannel.participants.filter(id => id !== memberId);
                }
            });
            this.teams.delete(teamId);
        }
    }

    /**
     * Send a message
     */
    async sendMessage(
        content: string,
        type: ChatType = 'global',
        options?: {
            replyTo?: string;
            priority?: MessagePriority;
            metadata?: Record<string, unknown>;
        }
    ): Promise<GameChatMessage | null> {
        // Check rate limiting
        if (this.config.floodControl && !this.checkRateLimit()) {
            console.warn('Message rate limited');
            return null;
        }

        // Check if team chat is enabled
        if (type === 'team' && !this.config.enableTeamChat) {
            console.warn('Team chat is disabled');
            return null;
        }

        // Check if user is in the team
        if (type === 'team' && this.currentUserTeam) {
            const team = this.teams.get(this.currentUserTeam);
            if (!team || !team.members.includes(this.currentUserId)) {
                console.warn('User is not in this team');
                return null;
            }
        }

        // Check for emote
        const emoteMatch = this.parseEmote(content);
        const isEmote = emoteMatch !== null;

        const message: GameChatMessage = {
            id: this.generateMessageId(),
            type,
            senderId: this.currentUserId,
            senderName: this.currentUserName,
            senderTeam: this.currentUserTeam,
            content: isEmote ? '' : content,
            timestamp: Date.now(),
            priority: options?.priority || 'normal',
            isEmote,
            emoteId: emoteMatch?.id,
            replyTo: options?.replyTo,
            metadata: options?.metadata,
        };

        // Add to channel
        const channelId = this.getChannelId(type);
        this.addMessageToChannel(channelId, message);

        // Update stats
        this.updateStats(message);

        // Notify listeners
        this.notifyListeners(channelId, [message]);

        return message;
    }

    /**
     * Parse emote from content
     */
    private parseEmote(content: string): Emote | null {
        const trimmed = content.trim();

        // Check if it's just an emote icon
        for (const emote of DEFAULT_EMOTES) {
            if (trimmed === emote.icon || trimmed === `:${emote.id}:`) {
                return emote;
            }
        }

        return null;
    }

    /**
     * Send an emote quickly
     */
    async sendEmote(emoteId: string): Promise<GameChatMessage | null> {
        // Check cooldown
        const lastUsed = this.emoteCooldowns.get(emoteId) || 0;
        if (Date.now() - lastUsed < this.config.emoteCooldown) {
            console.warn('Emote on cooldown');
            return null;
        }

        // Check if emote exists
        const emote = DEFAULT_EMOTES.find(e => e.id === emoteId);
        if (!emote) {
            console.warn('Unknown emote');
            return null;
        }

        this.emoteCooldowns.set(emoteId, Date.now());

        return this.sendMessage(emote.icon, 'global', {
            priority: 'low',
            metadata: { emoteId },
        });
    }

    /**
     * Send a team emote
     */
    async sendTeamEmote(emoteId: string): Promise<GameChatMessage | null> {
        // Check cooldown
        const lastUsed = this.emoteCooldowns.get(`team_${emoteId}`) || 0;
        if (Date.now() - lastUsed < this.config.emoteCooldown) {
            console.warn('Emote on cooldown');
            return null;
        }

        // Check if emote exists
        const emote = DEFAULT_EMOTES.find(e => e.id === emoteId);
        if (!emote) {
            console.warn('Unknown emote');
            return null;
        }

        this.emoteCooldowns.set(`team_${emoteId}`, Date.now());

        return this.sendMessage(emote.icon, 'team', {
            priority: 'low',
            metadata: { emoteId, isTeamEmote: true },
        });
    }

    /**
     * Check rate limit
     */
    private checkRateLimit(): boolean {
        const now = Date.now();
        const windowStart = now - 1000;

        // Remove old entries
        this.messageRateLimit = this.messageRateLimit.filter(m => m.window > windowStart);

        // Count messages in window
        const count = this.messageRateLimit.length;

        if (count >= this.config.maxMessagesPerSecond) {
            return false;
        }

        this.messageRateLimit.push({ count: count + 1, window: now });
        return true;
    }

    /**
     * Add message to channel
     */
    private addMessageToChannel(channelId: string, message: GameChatMessage): void {
        const channelMessages = this.messages.get(channelId) || [];
        channelMessages.push(message);

        // Trim old messages
        while (channelMessages.length > this.config.maxMessagesPerChannel) {
            channelMessages.shift();
        }

        this.messages.set(channelId, channelMessages);

        // Update unread count
        const currentCount = this.unreadCounts.get(channelId) || 0;
        this.unreadCounts.set(channelId, currentCount + 1);

        // Clean old messages
        this.cleanOldMessages(channelId);
    }

    /**
     * Clean old messages from a channel
     */
    private cleanOldMessages(channelId: string): void {
        const channelMessages = this.messages.get(channelId);
        if (!channelMessages) return;

        const cutoff = Date.now() - this.config.messageExpirationTime;
        this.messages.set(
            channelId,
            channelMessages.filter(m => m.timestamp > cutoff)
        );
    }

    /**
     * Get channel ID based on type
     */
    private getChannelId(type: ChatType): string {
        if (type === 'private') return `private_${this.currentUserId}`;
        return type;
    }

    /**
     * Generate unique message ID
     */
    private generateMessageId(): string {
        return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get messages from a channel
     */
    getMessages(type: ChatType, filter?: MessageFilter): GameChatMessage[] {
        const channelId = this.getChannelId(type);
        let messages = this.messages.get(channelId) || [];

        // Apply filters
        if (filter) {
            if (filter.contains) {
                messages = messages.filter(m =>
                    m.content.toLowerCase().includes(filter.contains!.toLowerCase())
                );
            }
            if (filter.senderId) {
                messages = messages.filter(m => m.senderId === filter.senderId);
            }
            if (filter.after) {
                messages = messages.filter(m => m.timestamp > filter.after!);
            }
            if (filter.before) {
                messages = messages.filter(m => m.timestamp < filter.before!);
            }
        }

        return messages;
    }

    /**
     * Get all messages
     */
    getAllMessages(): Record<string, GameChatMessage[]> {
        return Object.fromEntries(this.messages);
    }

    /**
     * Mark channel as read
     */
    markAsRead(type: ChatType): void {
        const channelId = this.getChannelId(type);
        this.unreadCounts.set(channelId, 0);

        const channel = this.channels.get(channelId);
        if (channel) {
            channel.unreadCount = 0;
        }
    }

    /**
     * Get unread count for a channel
     */
    getUnreadCount(type: ChatType): number {
        const channelId = this.getChannelId(type);
        return this.unreadCounts.get(channelId) || 0;
    }

    /**
     * Get total unread count
     */
    getTotalUnreadCount(): number {
        let total = 0;
        this.unreadCounts.forEach(count => total += count);
        return total;
    }

    /**
     * Get available emotes
     */
    getEmotes(): Emote[] {
        return [...DEFAULT_EMOTES];
    }

    /**
     * Get emotes by category
     */
    getEmotesByCategory(category: Emote['category']): Emote[] {
        return DEFAULT_EMOTES.filter(e => e.category === category);
    }

    /**
     * Subscribe to messages
     */
    subscribe(type: ChatType, listener: (messages: GameChatMessage[]) => void): () => void {
        const channelId = this.getChannelId(type);

        if (!this.listeners.has(channelId)) {
            this.listeners.set(channelId, new Set());
        }

        this.listeners.get(channelId)!.add(listener);

        // Return unsubscribe function
        return () => {
            const listeners = this.listeners.get(channelId);
            if (listeners) {
                listeners.delete(listener);
            }
        };
    }

    /**
     * Notify listeners
     */
    private notifyListeners(channelId: string, messages: GameChatMessage[]): void {
        const listeners = this.listeners.get(channelId);
        if (listeners) {
            listeners.forEach(listener => listener(messages));
        }
    }

    /**
     * Update chat stats
     */
    private updateStats(message: GameChatMessage): void {
        this.stats.totalMessages++;
        this.stats.messagesByType[message.type]++;
        this.stats.avgMessageLength =
            (this.stats.avgMessageLength * (this.stats.totalMessages - 1) + message.content.length)
            / this.stats.totalMessages;

        if (message.emoteId) {
            this.stats.emoteUsage[message.emoteId] =
                (this.stats.emoteUsage[message.emoteId] || 0) + 1;
        }
    }

    /**
     * Get chat stats
     */
    getStats(): ChatStats {
        return { ...this.stats };
    }

    /**
     * Get channel info
     */
    getChannelInfo(type: ChatType): ChatChannel | undefined {
        const channelId = this.getChannelId(type);
        return this.channels.get(channelId);
    }

    /**
     * Get all channels
     */
    getChannels(): ChatChannel[] {
        return Array.from(this.channels.values());
    }

    /**
     * Mute/unmute a channel
     */
    setChannelMuted(type: ChatType, muted: boolean): void {
        const channelId = this.getChannelId(type);
        const channel = this.channels.get(channelId);
        if (channel) {
            channel.isMuted = muted;
        }
    }

    /**
     * Clear messages in a channel
     */
    clearChannel(type: ChatType): void {
        const channelId = this.getChannelId(type);
        this.messages.set(channelId, []);
        this.unreadCounts.set(channelId, 0);

        const channel = this.channels.get(channelId);
        if (channel) {
            channel.unreadCount = 0;
        }
    }

    /**
     * Clear all channels
     */
    clearAll(): void {
        this.messages.clear();
        this.unreadCounts.clear();
        this.initializeChannels();
    }

    /**
     * Get quick emote reactions (most used)
     */
    getQuickEmotes(count: number = 4): Emote[] {
        const sortedEmotes = Object.entries(this.stats.emoteUsage)
            .sort((a, b) => b[1] - a[1])
            .slice(0, count)
            .map(([id]) => id);

        return DEFAULT_EMOTES.filter(e => sortedEmotes.includes(e.id))
            .slice(0, count);
    }

    /**
     * Get configuration
     */
    getConfig(): ChatConfig {
        return { ...this.config };
    }

    /**
     * Cleanup
     */
    destroy(): void {
        this.listeners.clear();
        this.messages.clear();
        this.channels.clear();
        this.teams.clear();
        this.unreadCounts.clear();
        this.messageRateLimit = [];
        this.stats = {
            totalMessages: 0,
            messagesByType: { global: 0, team: 0, private: 0 },
            emoteUsage: {},
            avgMessageLength: 0,
            peakMessagesPerSecond: 0,
        };
    }
}

export const inGameChat = InGameChat.getInstance();
export type { GameChatMessage, TeamInfo, Emote, ChatChannel, ChatConfig, MessageFilter, ChatStats };
