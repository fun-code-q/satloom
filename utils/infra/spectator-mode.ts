/**
 * Spectator Mode System
 * 
 * Allows users to watch live games (chess, pictionary, etc.)
 * with real-time updates, live chat, and special features.
 */

type SpectatableGame = 'chess' | 'pictionary' | 'dots-and-boxes' | 'quiz' | 'custom';
type SpectatorStatus = 'idle' | 'watching' | 'connecting' | 'reconnecting' | 'ended';

interface Spectator {
    id: string;
    name: string;
    avatar?: string;
    isModerator: boolean;
    isVIP: boolean;
    joinTime: number;
    messagesCount: number;
    reactionsCount: number;
    isActive: boolean;
}

interface LiveGame {
    gameId: string;
    gameType: SpectatableGame;
    hostId: string;
    hostName: string;
    players: LivePlayer[];
    spectators: Spectator[];
    status: 'waiting' | 'in-progress' | 'paused' | 'ended';
    startedAt: number;
    settings: GameSettings;
    isPublic: boolean;
    tags: string[];
}

interface LivePlayer {
    id: string;
    name: string;
    avatar?: string;
    isHost: boolean;
    isReady: boolean;
    score?: number;
    status: 'connected' | 'disconnected' | 'away';
}

interface GameSettings {
    allowSpectators: boolean;
    allowChat: boolean;
    allowReactions: boolean;
    allowCommentary: boolean;
    maxSpectators: number;
    slowModeDelay: number;
    onlyVIPChat: boolean;
}

interface SpectatorMessage {
    id: string;
    spectatorId: string;
    spectatorName: string;
    content: string;
    timestamp: number;
    type: 'message' | 'question' | 'commentary' | 'reaction';
    isHighlighted: boolean;
    isDeleted: boolean;
}

interface Commentary {
    id: string;
    authorId: string;
    authorName: string;
    content: string;
    timestamp: number;
    gameState?: string; // JSON snapshot of relevant game state
    timestampMark?: number; // For video replay
    isOfficial: boolean;
}

interface GameStateSnapshot {
    timestamp: number;
    gameType: SpectatableGame;
    state: Record<string, unknown>;
    players: Record<string, unknown>[];
    moveHistory: GameMove[];
}

interface GameMove {
    moveNumber: number;
    playerId: string;
    move: string;
    timestamp: number;
    notation: string;
}

interface SpectatorModeState {
    isActive: boolean;
    currentGame: LiveGame | null;
    spectatorId: string | null;
    spectatorStatus: SpectatorStatus;
    messages: SpectatorMessage[];
    commentaries: Commentary[];
    gameHistory: GameStateSnapshot[];
    currentHistoryIndex: number;
    playbackSpeed: number;
    isPaused: boolean;
    quality: 'low' | 'medium' | 'high' | 'auto';
    soundEnabled: boolean;
    reactionCooldown: number;
}

interface SpectatorCallbacks {
    onGameUpdate?: (game: LiveGame) => void;
    onSpectatorJoin?: (spectator: Spectator) => void;
    onSpectatorLeave?: (spectatorId: string) => void;
    onMessage?: (message: SpectatorMessage) => void;
    onCommentary?: (commentary: Commentary) => void;
    onGameEnd?: (finalState: GameStateSnapshot) => void;
    onError?: (error: string) => void;
    onConnectionChange?: (status: SpectatorStatus) => void;
}

class SpectatorMode {
    private static instance: SpectatorMode;
    private state: SpectatorModeState;
    private callbacks: SpectatorCallbacks = {};
    private listeners: ((state: SpectatorModeState) => void)[] = [];
    private eventSource: EventSource | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private heartbeatInterval: NodeJS.Timeout | null = null;

    private constructor() {
        this.state = this.getInitialState();
    }

    static getInstance(): SpectatorMode {
        if (!SpectatorMode.instance) {
            SpectatorMode.instance = new SpectatorMode();
        }
        return SpectatorMode.instance;
    }

    /**
     * Get initial state
     */
    private getInitialState(): SpectatorModeState {
        return {
            isActive: false,
            currentGame: null,
            spectatorId: null,
            spectatorStatus: 'idle',
            messages: [],
            commentaries: [],
            gameHistory: [],
            currentHistoryIndex: -1,
            playbackSpeed: 1,
            isPaused: false,
            quality: 'auto',
            soundEnabled: true,
            reactionCooldown: 0,
        };
    }

    /**
     * Set callbacks
     */
    setCallbacks(callbacks: SpectatorCallbacks): void {
        this.callbacks = { ...this.callbacks, ...callbacks };
    }

    /**
     * Get current state
     */
    getState(): SpectatorModeState {
        return { ...this.state };
    }

    /**
     * Subscribe to state changes
     */
    subscribe(listener: (state: SpectatorModeState) => void): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    /**
     * Notify listeners
     */
    private notifyListeners(): void {
        this.listeners.forEach(listener => listener(this.state));
    }

    /**
     * Join game as spectator
     */
    async joinGame(gameId: string, spectatorInfo: { id: string; name: string; avatar?: string }): Promise<boolean> {
        try {
            this.state.spectatorStatus = 'connecting';
            this.state.spectatorId = spectatorInfo.id;
            this.notifyListeners();
            this.callbacks.onConnectionChange?.('connecting');

            // Simulate API call - replace with actual Firebase/WebSocket
            const gameData = await this.fetchGameData(gameId);

            if (!gameData) {
                throw new Error('Game not found');
            }

            // Check if spectators are allowed
            if (!gameData.settings.allowSpectators) {
                throw new Error('Spectators are not allowed in this game');
            }

            // Check max spectators
            if (gameData.spectators.length >= gameData.settings.maxSpectators) {
                throw new Error('Game is full of spectators');
            }

            this.state.currentGame = {
                ...gameData,
                spectators: [
                    ...gameData.spectators,
                    {
                        id: spectatorInfo.id,
                        name: spectatorInfo.name,
                        avatar: spectatorInfo.avatar,
                        isModerator: false,
                        isVIP: false,
                        joinTime: Date.now(),
                        messagesCount: 0,
                        reactionsCount: 0,
                        isActive: true,
                    },
                ],
            };

            this.state.isActive = true;
            this.state.spectatorStatus = 'watching';
            this.state.messages = [];
            this.state.commentaries = [];
            this.state.gameHistory = [];

            // Start heartbeat
            this.startHeartbeat();

            // Subscribe to real-time updates (EventSource or WebSocket)
            this.subscribeToUpdates(gameId);

            this.callbacks.onGameUpdate?.(this.state.currentGame);
            this.callbacks.onConnectionChange?.('watching');
            this.notifyListeners();

            return true;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to join';
            this.callbacks.onError?.(errorMessage);
            this.state.spectatorStatus = 'idle';
            this.notifyListeners();
            return false;
        }
    }

    /**
     * Fetch game data (mock - replace with actual API)
     */
    private async fetchGameData(gameId: string): Promise<LiveGame | null> {
        // Mock implementation
        return {
            gameId,
            gameType: 'chess',
            hostId: 'host-1',
            hostName: 'ChessMaster',
            players: [
                { id: 'player-1', name: 'Player1', isHost: false, isReady: true, status: 'connected' },
                { id: 'player-2', name: 'Player2', isHost: false, isReady: true, status: 'connected' },
            ],
            spectators: [],
            status: 'in-progress',
            startedAt: Date.now() - 300000,
            settings: {
                allowSpectators: true,
                allowChat: true,
                allowReactions: true,
                allowCommentary: true,
                maxSpectators: 100,
                slowModeDelay: 0,
                onlyVIPChat: false,
            },
            isPublic: true,
            tags: ['chess', 'rated', 'casual'],
        };
    }

    /**
     * Subscribe to real-time updates
     */
    private subscribeToUpdates(gameId: string): void {
        // In production, use WebSocket or Server-Sent Events
        // This is a mock implementation
        console.log(`Subscribed to updates for game: ${gameId}`);
    }

    /**
     * Start heartbeat
     */
    private startHeartbeat(): void {
        this.heartbeatInterval = setInterval(() => {
            if (this.state.spectatorStatus === 'watching') {
                // Send heartbeat to server
                console.log('Heartbeat sent');
            }
        }, 30000);
    }

    /**
     * Leave game
     */
    leaveGame(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }

        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }

        // Notify host that spectator left
        if (this.state.currentGame && this.state.spectatorId) {
            this.callbacks.onSpectatorLeave?.(this.state.spectatorId);
        }

        this.state = this.getInitialState();
        this.notifyListeners();
    }

    /**
     * Send spectator message
     */
    sendMessage(content: string): boolean {
        if (!this.state.currentGame || !this.state.spectatorId) return false;
        if (!this.state.currentGame.settings.allowChat) return false;
        if (this.state.currentGame.settings.onlyVIPChat) return false;

        const spectator = this.state.currentGame.spectators.find(s => s.id === this.state.spectatorId);
        if (!spectator) return false;

        // Check slow mode
        const lastMessage = this.state.messages[this.state.messages.length - 1];
        if (lastMessage && Date.now() - lastMessage.timestamp < this.state.currentGame.settings.slowModeDelay * 1000) {
            this.callbacks.onError?.('Slow mode is enabled. Please wait before sending another message.');
            return false;
        }

        const message: SpectatorMessage = {
            id: `msg-${Date.now()}`,
            spectatorId: this.state.spectatorId,
            spectatorName: spectator.name,
            content,
            timestamp: Date.now(),
            type: 'message',
            isHighlighted: false,
            isDeleted: false,
        };

        spectator.messagesCount++;
        this.state.messages.push(message);
        this.callbacks.onMessage?.(message);
        this.notifyListeners();

        return true;
    }

    /**
     * Send reaction (emoji)
     */
    sendReaction(emoji: string): boolean {
        if (!this.state.currentGame) return false;
        if (!this.state.currentGame.settings.allowReactions) return false;

        // Check cooldown
        if (this.state.reactionCooldown > 0) {
            return false;
        }

        const spectator = this.state.currentGame.spectators.find(s => s.id === this.state.spectatorId);
        if (spectator) {
            spectator.reactionsCount++;
        }

        // Set cooldown (3 seconds)
        this.state.reactionCooldown = 3;
        const cooldownInterval = setInterval(() => {
            this.state.reactionCooldown--;
            if (this.state.reactionCooldown <= 0) {
                clearInterval(cooldownInterval);
            }
            this.notifyListeners();
        }, 1000);

        // Create highlighted message for reaction
        const message: SpectatorMessage = {
            id: `reaction-${Date.now()}`,
            spectatorId: this.state.spectatorId || '',
            spectatorName: spectator?.name || '',
            content: emoji,
            timestamp: Date.now(),
            type: 'reaction',
            isHighlighted: true,
            isDeleted: false,
        };

        this.state.messages.push(message);
        this.notifyListeners();

        return true;
    }

    /**
     * Add commentary
     */
    addCommentary(content: string, gameState?: Record<string, unknown>): void {
        if (!this.state.currentGame || !this.state.currentGame.settings.allowCommentary) return;

        const commentary: Commentary = {
            id: `commentary-${Date.now()}`,
            authorId: this.state.spectatorId || '',
            authorName: this.state.currentGame.spectators.find(s => s.id === this.state.spectatorId)?.name || '',
            content,
            timestamp: Date.now(),
            gameState: gameState ? JSON.stringify(gameState) : undefined,
            isOfficial: false,
        };

        this.state.commentaries.push(commentary);
        this.callbacks.onCommentary?.(commentary);
        this.notifyListeners();
    }

    /**
     * Request time travel (view game history)
     */
    goToTimestamp(timestamp: number): void {
        const snapshot = this.state.gameHistory.find(s => s.timestamp === timestamp);
        if (snapshot) {
            this.state.currentHistoryIndex = this.state.gameHistory.indexOf(snapshot);
            this.notifyListeners();
        }
    }

    /**
     * Time travel controls
     */
    goBack(): void {
        if (this.state.currentHistoryIndex > 0) {
            this.state.currentHistoryIndex--;
            this.notifyListeners();
        }
    }

    /**
     * Go forward
     */
    goForward(): void {
        if (this.state.currentHistoryIndex < this.state.gameHistory.length - 1) {
            this.state.currentHistoryIndex++;
            this.notifyListeners();
        }
    }

    /**
     * Toggle playback
     */
    togglePlayback(): void {
        this.state.isPaused = !this.state.isPaused;
        this.notifyListeners();
    }

    /**
     * Set playback speed
     */
    setPlaybackSpeed(speed: number): void {
        this.state.playbackSpeed = Math.max(0.25, Math.min(4, speed));
        this.notifyListeners();
    }

    /**
     * Set quality preference
     */
    setQuality(quality: 'low' | 'medium' | 'high' | 'auto'): void {
        this.state.quality = quality;
        this.notifyListeners();
    }

    /**
     * Toggle sound
     */
    toggleSound(): void {
        this.state.soundEnabled = !this.state.soundEnabled;
        this.notifyListeners();
    }

    /**
     * Highlight message
     */
    highlightMessage(messageId: string): void {
        const message = this.state.messages.find(m => m.id === messageId);
        if (message) {
            message.isHighlighted = true;
            this.notifyListeners();
        }
    }

    /**
     * Delete message
     */
    deleteMessage(messageId: string): void {
        const message = this.state.messages.find(m => m.id === messageId);
        if (message && message.spectatorId === this.state.spectatorId) {
            message.isDeleted = true;
            this.notifyListeners();
        }
    }

    /**
     * Get player colors
     */
    getPlayerColors(): { player1: string; player2: string } {
        return {
            player1: '#3b82f6', // blue
            player2: '#ef4444', // red
        };
    }

    /**
     * Get spectator count
     */
    getSpectatorCount(): number {
        return this.state.currentGame?.spectators.length || 0;
    }

    /**
     * Get message count
     */
    getMessageCount(): number {
        return this.state.messages.filter(m => !m.isDeleted).length;
    }

    /**
     * Get reaction count
     */
    getReactionCount(): number {
        return this.state.messages.filter(m => m.type === 'reaction').length;
    }

    /**
     * Request moderator action
     */
    requestModeration(action: 'kick' | 'mute' | 'report', targetId: string, reason?: string): void {
        if (!this.state.currentGame) return;

        // In production, send to host or moderation system
        console.log(`Moderation request: ${action} on ${targetId}`, reason);
    }

    /**
     * Report game issue
     */
    reportIssue(issue: string): void {
        console.log(`Game reported: ${issue}`);
        this.callbacks.onError?.('Thank you for your report. Our team will review it.');
    }

    /**
     * Get connection quality
     */
    getConnectionQuality(): { latency: number; jitter: number; packetLoss: number } {
        // In production, measure actual connection metrics
        return {
            latency: 45,
            jitter: 5,
            packetLoss: 0.1,
        };
    }

    /**
     * Export game session
     */
    exportSession(): string {
        return JSON.stringify({
            game: this.state.currentGame,
            messages: this.state.messages,
            commentaries: this.state.commentaries,
            gameHistory: this.state.gameHistory,
            exportedAt: new Date().toISOString(),
            spectatorInfo: {
                id: this.state.spectatorId,
                joinTime: this.state.currentGame?.spectators.find(s => s.id === this.state.spectatorId)?.joinTime,
            },
        });
    }

    /**
     * Reset state
     */
    reset(): void {
        this.leaveGame();
        this.state = this.getInitialState();
        this.notifyListeners();
    }
}

export const spectatorMode = SpectatorMode.getInstance();
export type { SpectatorModeState, LiveGame, Spectator, SpectatorMessage, Commentary, GameStateSnapshot, GameMove, SpectatorCallbacks, SpectatableGame, SpectatorStatus };
