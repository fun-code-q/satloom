/**
 * Enhanced Reaction Manager
 * 
 * Provides GIF reactions, custom emoji reactions, and animated reactions.
 */

interface Reaction {
    emoji: string;
    count: number;
    userReacted: boolean;
    animated?: boolean;
}

interface CustomEmoji {
    id: string;
    name: string;
    url: string;
    pack?: string;
}

interface GifReaction {
    id: string;
    title: string;
    previewUrl: string;
    url: string;
    width: number;
    height: number;
}

interface ReactionConfig {
    maxReactions: number;
    animationDuration: number;
    enableGifs: boolean;
    enableCustomEmojis: boolean;
}

class ReactionManager {
    private static instance: ReactionManager;
    private reactions: Map<string, Reaction[]> = new Map();
    private customEmojis: Map<string, CustomEmoji[]> = new Map();
    private userReactions: Map<string, Set<string>> = new Map();
    private config: ReactionConfig = {
        maxReactions: 5,
        animationDuration: 500,
        enableGifs: true,
        enableCustomEmojis: true,
    };

    private constructor() {
        this.loadCustomEmojis();
    }

    static getInstance(): ReactionManager {
        if (!ReactionManager.instance) {
            ReactionManager.instance = new ReactionManager();
        }
        return ReactionManager.instance;
    }

    /**
     * Load custom emojis from localStorage
     */
    private loadCustomEmojis(): void {
        if (typeof window === 'undefined') return;

        const stored = localStorage.getItem('satloom-custom-emojis');
        if (stored) {
            try {
                const emojis = JSON.parse(stored);
                emojis.forEach((emoji: CustomEmoji) => {
                    this.customEmojis.set(emoji.pack || 'default', [...(this.customEmojis.get(emoji.pack || 'default') || []), emoji]);
                });
            } catch (e) {
                console.error('Failed to load custom emojis:', e);
            }
        }
    }

    /**
     * Get default reactions
     */
    getDefaultReactions(): Reaction[] {
        return [
            { emoji: '👍', count: 0, userReacted: false },
            { emoji: '❤️', count: 0, userReacted: false },
            { emoji: '😂', count: 0, userReacted: false },
            { emoji: '😮', count: 0, userReacted: false },
            { emoji: '🎉', count: 0, userReacted: false },
            { emoji: '😢', count: 0, userReacted: false },
        ];
    }

    /**
     * Get reactions for a message
     */
    getReactions(messageId: string): Reaction[] {
        return this.reactions.get(messageId) || this.getDefaultReactions();
    }

    /**
     * Add a reaction to a message
     */
    addReaction(messageId: string, emoji: string, userId: string): Reaction[] {
        const currentReactions = this.reactions.get(messageId) || this.getDefaultReactions();
        const userReactedSet = this.userReactions.get(messageId) || new Set();

        // Check if user already reacted with this emoji
        if (userReactedSet.has(emoji)) {
            // Remove reaction
            userReactedSet.delete(emoji);
            const updatedReactions = currentReactions.map(r => {
                if (r.emoji === emoji) {
                    return { ...r, count: Math.max(0, r.count - 1), userReacted: false };
                }
                return r;
            });
            this.reactions.set(messageId, updatedReactions);
            this.userReactions.set(messageId, userReactedSet);
            return updatedReactions;
        }

        // Check if user already reacted with a different emoji
        const previousEmoji = Array.from(userReactedSet)[0];
        if (previousEmoji) {
            userReactedSet.delete(previousEmoji);
            const updatedReactions = currentReactions.map(r => {
                if (r.emoji === previousEmoji) {
                    return { ...r, count: Math.max(0, r.count - 1), userReacted: false };
                }
                return r;
            });
            this.reactions.set(messageId, updatedReactions);
        }

        // Add new reaction
        userReactedSet.add(emoji);
        const updatedReactions = currentReactions.map(r => {
            if (r.emoji === emoji) {
                return { ...r, count: r.count + 1, userReacted: true };
            }
            return r;
        });

        this.reactions.set(messageId, updatedReactions);
        this.userReactions.set(messageId, userReactedSet);

        return updatedReactions;
    }

    /**
     * Add animated reaction
     */
    addAnimatedReaction(messageId: string, emoji: string, userId: string): void {
        // Create animated effect element
        const emojiElement = document.createElement('div');
        emojiElement.textContent = emoji;
        emojiElement.style.cssText = `
      position: fixed;
      font-size: 32px;
      pointer-events: none;
      z-index: 10000;
      animation: floatUp ${this.config.animationDuration}ms ease-out forwards;
    `;

        document.body.appendChild(emojiElement);

        // Remove after animation
        setTimeout(() => {
            emojiElement.remove();
        }, this.config.animationDuration);
    }

    /**
     * Get custom emojis
     */
    getCustomEmojis(pack?: string): CustomEmoji[] {
        if (pack) {
            return this.customEmojis.get(pack) || [];
        }

        // Return all custom emojis
        const allEmojis: CustomEmoji[] = [];
        this.customEmojis.forEach(emojis => {
            allEmojis.push(...emojis);
        });
        return allEmojis;
    }

    /**
     * Add custom emoji
     */
    addCustomEmoji(emoji: CustomEmoji): void {
        const pack = emoji.pack || 'default';
        const packEmojis = this.customEmojis.get(pack) || [];

        // Check for duplicates
        if (packEmojis.find(e => e.name === emoji.name)) {
            return;
        }

        packEmojis.push(emoji);
        this.customEmojis.set(pack, packEmojis);

        // Save to localStorage
        this.saveCustomEmojis();
    }

    /**
     * Save custom emojis to localStorage
     */
    private saveCustomEmojis(): void {
        if (typeof window === 'undefined') return;

        const allEmojis: CustomEmoji[] = [];
        this.customEmojis.forEach(emojis => {
            allEmojis.push(...emojis);
        });

        localStorage.setItem('satloom-custom-emojis', JSON.stringify(allEmojis));
    }

    /**
     * Remove custom emoji
     */
    removeCustomEmoji(emojiId: string): void {
        this.customEmojis.forEach((emojis, pack) => {
            const filtered = emojis.filter(e => e.id !== emojiId);
            this.customEmojis.set(pack, filtered);
        });
        this.saveCustomEmojis();
    }

    /**
     * Search for GIFs (placeholder - would integrate with Giphy API)
     */
    async searchGifs(query: string, limit = 10): Promise<GifReaction[]> {
        // Placeholder for Giphy API integration
        // In production, you would use the Giphy API:
        // const response = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${API_KEY}&q=${encodeURIComponent(query)}&limit=${limit}`);

        return [
            {
                id: '1',
                title: `${query} reaction`,
                previewUrl: '',
                url: '',
                width: 200,
                height: 200,
            },
        ];
    }

    /**
     * Add GIF reaction
     */
    addGifReaction(messageId: string, gif: GifReaction, userId: string): void {
        const messageGifs = this.reactions.get(messageId) || [];
        messageGifs.push({
            emoji: gif.title,
            count: 1,
            userReacted: true,
            animated: true,
        });
        this.reactions.set(messageId, messageGifs);
    }

    /**
     * Get reaction summary for display
     */
    getReactionSummary(messageId: string): { emoji: string; count: number; users: string[] }[] {
        const reactions = this.getReactions(messageId);
        return reactions
            .filter(r => r.count > 0)
            .map(r => ({
                emoji: r.emoji,
                count: r.count,
                users: [], // Would track users who reacted
            }))
            .sort((a, b) => b.count - a.count);
    }

    /**
     * Configure reaction manager
     */
    configure(config: Partial<ReactionConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Create emoji pack
     */
    createEmojiPack(name: string): string {
        const packId = 'pack-' + Date.now();
        this.customEmojis.set(name, []);
        return packId;
    }

    /**
     * Export emoji pack
     */
    exportEmojiPack(packName: string): string | null {
        const emojis = this.customEmojis.get(packName);
        if (!emojis) return null;

        return JSON.stringify({
            name: packName,
            emojis,
            exportedAt: Date.now(),
        });
    }

    /**
     * Import emoji pack
     */
    importEmojiPack(packData: string): boolean {
        try {
            const pack = JSON.parse(packData);
            if (!pack.name || !pack.emojis) return false;

            const existing = this.customEmojis.get(pack.name) || [];
            pack.emojis.forEach((emoji: CustomEmoji) => {
                if (!existing.find((e: CustomEmoji) => e.name === emoji.name)) {
                    existing.push(emoji);
                }
            });
            this.customEmojis.set(pack.name, existing);
            this.saveCustomEmojis();
            return true;
        } catch (e) {
            console.error('Failed to import emoji pack:', e);
            return false;
        }
    }

    /**
     * Get popular reactions
     */
    getPopularReactions(messageId: string, limit = 3): Reaction[] {
        const reactions = this.getReactions(messageId);
        return reactions
            .filter(r => r.count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
    }

    /**
     * Clear all reactions for a message
     */
    clearReactions(messageId: string): void {
        this.reactions.delete(messageId);
        this.userReactions.delete(messageId);
    }

    /**
     * Get user reaction count
     */
    getUserReactionCount(messageId: string): number {
        return this.userReactions.get(messageId)?.size || 0;
    }
}

// Add CSS animation for floating emojis
const style = document.createElement('style');
style.textContent = `
  @keyframes floatUp {
    0% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    100% {
      opacity: 0;
      transform: translateY(-100px) scale(1.5);
    }
  }
`;
document.head.appendChild(style);

export const reactionManager = ReactionManager.getInstance();
export type { Reaction, CustomEmoji, GifReaction, ReactionConfig };
