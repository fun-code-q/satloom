/**
 * Theater Queue Manager
 * 
 * Video queue management with drag-and-drop,
 * vote-to-skip, and playlist features.
 */

interface QueuedVideo {
    id: string;
    url: string;
    title: string;
    thumbnail?: string;
    duration: number;
    addedBy: string;
    addedByName: string;
    addedAt: number;
    votes: number;
    voters: string[];
    isPlayed: boolean;
    metadata?: VideoMetadata;
}

interface VideoMetadata {
    type: 'youtube' | 'vimeo' | 'direct' | 'stream';
    quality?: string;
    aspectRatio?: number;
    subtitles?: boolean;
}

interface QueueSettings {
    maxQueueLength: number;
    voteSkipThreshold: number;
    allowDuplicates: boolean;
    autoPlay: boolean;
    shuffleQueue: boolean;
    repeatMode: 'none' | 'all' | 'one';
}

interface SkipVote {
    userId: string;
    timestamp: number;
}

class TheaterQueueManager {
    private static instance: TheaterQueueManager;
    private queue: QueuedVideo[] = [];
    private settings: QueueSettings = {
        maxQueueLength: 50,
        voteSkipThreshold: 0.5, // 50% of viewers
        allowDuplicates: false,
        autoPlay: true,
        shuffleQueue: false,
        repeatMode: 'none',
    };
    private skipVotes: Map<string, SkipVote[]> = new Map();
    private listeners: ((queue: QueuedVideo[]) => void)[] = [];

    private constructor() { }

    static getInstance(): TheaterQueueManager {
        if (!TheaterQueueManager.instance) {
            TheaterQueueManager.instance = new TheaterQueueManager();
        }
        return TheaterQueueManager.instance;
    }

    /**
     * Add video to queue
     */
    addToQueue(video: Omit<QueuedVideo, 'id' | 'addedAt' | 'votes' | 'voters' | 'isPlayed'>): QueuedVideo | null {
        if (this.queue.length >= this.settings.maxQueueLength) {
            console.warn('Queue is full');
            return null;
        }

        if (!this.settings.allowDuplicates) {
            const exists = this.queue.some(v => v.url === video.url);
            if (exists) {
                console.warn('Video already in queue');
                return null;
            }
        }

        const queued: QueuedVideo = {
            ...video,
            id: `video_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            addedAt: Date.now(),
            votes: 0,
            voters: [],
            isPlayed: false,
        };

        this.queue.push(queued);
        this.notifyListeners();

        return queued;
    }

    /**
     * Remove video from queue
     */
    removeFromQueue(videoId: string): boolean {
        const index = this.queue.findIndex(v => v.id === videoId);
        if (index === -1) return false;

        this.queue.splice(index, 1);
        this.skipVotes.delete(videoId);
        this.notifyListeners();

        return true;
    }

    /**
     * Reorder queue (drag and drop)
     */
    reorderQueue(fromIndex: number, toIndex: number): boolean {
        if (fromIndex < 0 || fromIndex >= this.queue.length) return false;
        if (toIndex < 0 || toIndex >= this.queue.length) return false;

        const [removed] = this.queue.splice(fromIndex, 1);
        this.queue.splice(toIndex, 0, removed);
        this.notifyListeners();

        return true;
    }

    /**
     * Move video to position
     */
    moveTo(videoId: string, newIndex: number): boolean {
        const index = this.queue.findIndex(v => v.id === videoId);
        if (index === -1) return false;

        return this.reorderQueue(index, newIndex);
    }

    /**
     * Vote to skip video
     */
    voteSkip(videoId: string, userId: string): { success: boolean; shouldSkip: boolean; voteCount: number } {
        const video = this.queue.find(v => v.id === videoId);
        if (!video) return { success: false, shouldSkip: false, voteCount: 0 };

        if (video.voters.includes(userId)) {
            return { success: false, shouldSkip: false, voteCount: video.votes };
        }

        video.votes++;
        video.voters.push(userId);

        // Store skip vote
        if (!this.skipVotes.has(videoId)) {
            this.skipVotes.set(videoId, []);
        }
        this.skipVotes.get(videoId)!.push({ userId, timestamp: Date.now() });

        // Check threshold (simplified - would need viewer count)
        const shouldSkip = video.votes >= this.settings.voteSkipThreshold;

        this.notifyListeners();

        return { success: true, shouldSkip, voteCount: video.votes };
    }

    /**
     * Get current video
     */
    getCurrentVideo(): QueuedVideo | null {
        return this.queue.find(v => !v.isPlayed) || null;
    }

    /**
     * Mark current video as played
     */
    markAsPlayed(): QueuedVideo | null {
        const current = this.getCurrentVideo();
        if (current) {
            current.isPlayed = true;
            this.skipVotes.delete(current.id);

            // Handle repeat mode
            if (this.settings.repeatMode === 'one') {
                // Keep current video at front
            } else if (this.settings.repeatMode === 'all' && this.settings.shuffleQueue) {
                // Move to end and shuffle
            }

            this.notifyListeners();
        }
        return current;
    }

    /**
     * Play next video
     */
    playNext(): QueuedVideo | null {
        const current = this.getCurrentVideo();
        if (current) {
            current.isPlayed = true;
        }

        // Move to next unplayed video
        const next = this.queue.find(v => !v.isPlayed);
        if (next) {
            this.notifyListeners();
            return next;
        }

        // Handle repeat
        if (this.settings.repeatMode === 'all') {
            // Reset all videos
            this.queue.forEach(v => v.isPlayed = false);
            this.skipVotes.clear();
            this.notifyListeners();
            return this.getCurrentVideo();
        }

        return null;
    }

    /**
     * Shuffle queue
     */
    shuffleQueue(): void {
        if (this.settings.shuffleQueue) {
            // Keep current video at front, shuffle rest
            const current = this.getCurrentVideo();
            const remaining = this.queue.filter(v => v.id !== current?.id);

            for (let i = remaining.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
            }

            this.queue = current ? [current, ...remaining] : remaining;
            this.notifyListeners();
        }
    }

    /**
     * Get upcoming videos
     */
    getUpcoming(limit = 10): QueuedVideo[] {
        return this.queue
            .filter(v => !v.isPlayed)
            .slice(0, limit);
    }

    /**
     * Get played videos
     */
    getHistory(): QueuedVideo[] {
        return this.queue.filter(v => v.isPlayed);
    }

    /**
     * Clear queue
     */
    clearQueue(): void {
        this.queue = [];
        this.skipVotes.clear();
        this.notifyListeners();
    }

    /**
     * Update settings
     */
    configure(settings: Partial<QueueSettings>): void {
        this.settings = { ...this.settings, ...settings };
    }

    /**
     * Get settings
     */
    getSettings(): QueueSettings {
        return { ...this.settings };
    }

    /**
     * Subscribe to changes
     */
    subscribe(listener: (queue: QueuedVideo[]) => void): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    /**
     * Notify listeners
     */
    private notifyListeners(): void {
        this.listeners.forEach(listener => listener([...this.queue]));
    }

    /**
     * Export queue
     */
    export(): string {
        return JSON.stringify({
            queue: this.queue,
            settings: this.settings,
            exportedAt: new Date().toISOString(),
        });
    }

    /**
     * Get statistics
     */
    getStats(): {
        totalVideos: number;
        totalDuration: number;
        upcomingCount: number;
        playedCount: number;
        totalVotes: number;
    } {
        const now = Date.now();
        const totalDuration = this.queue.reduce((sum, v) => sum + v.duration, 0);

        return {
            totalVideos: this.queue.length,
            totalDuration,
            upcomingCount: this.queue.filter(v => !v.isPlayed).length,
            playedCount: this.queue.filter(v => v.isPlayed).length,
            totalVotes: this.queue.reduce((sum, v) => sum + v.votes, 0),
        };
    }
}

export const theaterQueue = TheaterQueueManager.getInstance();
export type { QueuedVideo, VideoMetadata, QueueSettings, SkipVote };
