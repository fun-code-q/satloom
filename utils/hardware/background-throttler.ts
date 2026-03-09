/**
 * Background Tab Throttler
 * 
 * Reduces resource usage when tab is in background,
 * with configurable throttling strategies.
 */

type ThrottleLevel = 'none' | 'light' | 'moderate' | 'aggressive';

interface ThrottleConfig {
    level: ThrottleLevel;
    reduceAnimationFPS: boolean;
    reducePollingInterval: boolean;
    reduceHeartbeatInterval: boolean;
    pauseNonEssentialTasks: boolean;
    reduceNetworkPriority: boolean;
}

interface ThrottleSettings {
    foregroundFPS: number;
    backgroundFPS: number;
    foregroundPollingInterval: number;
    backgroundPollingInterval: number;
    foregroundHeartbeatInterval: number;
    backgroundHeartbeatInterval: number;
}

interface ThrottleCallbacks {
    onThrottle?: (level: ThrottleLevel) => void;
    onRestore?: () => void;
    onAnimationFrame?: (deltaTime: number) => void;
    onPoll?: () => void;
    onHeartbeat?: () => void;
}

class BackgroundThrottler {
    private static instance: BackgroundThrottler;
    private config: ThrottleConfig = {
        level: 'light',
        reduceAnimationFPS: true,
        reducePollingInterval: true,
        reduceHeartbeatInterval: true,
        pauseNonEssentialTasks: true,
        reduceNetworkPriority: true,
    };
    private settings: Record<ThrottleLevel, ThrottleSettings> = {
        none: {
            foregroundFPS: 60,
            backgroundFPS: 60,
            foregroundPollingInterval: 1000,
            backgroundPollingInterval: 1000,
            foregroundHeartbeatInterval: 5000,
            backgroundHeartbeatInterval: 5000,
        },
        light: {
            foregroundFPS: 60,
            backgroundFPS: 30,
            foregroundPollingInterval: 1000,
            backgroundPollingInterval: 5000,
            foregroundHeartbeatInterval: 5000,
            backgroundHeartbeatInterval: 30000,
        },
        moderate: {
            foregroundFPS: 60,
            backgroundFPS: 15,
            foregroundPollingInterval: 2000,
            backgroundPollingInterval: 10000,
            foregroundHeartbeatInterval: 10000,
            backgroundHeartbeatInterval: 60000,
        },
        aggressive: {
            foregroundFPS: 30,
            backgroundFPS: 1,
            foregroundPollingInterval: 5000,
            backgroundPollingInterval: 30000,
            foregroundHeartbeatInterval: 30000,
            backgroundHeartbeatInterval: 120000,
        },
    };
    private isBackground = false;
    private currentLevel: ThrottleLevel = 'none';
    private callbacks: ThrottleCallbacks = {};
    private animationFrameId: number | null = null;
    private lastFrameTime = 0;
    private pollTimer: NodeJS.Timeout | null = null;
    private heartbeatTimer: NodeJS.Timeout | null = null;
    private pausedTasks: Set<string> = new Set();
    private listeners: ((level: ThrottleLevel) => void)[] = [];

    private constructor() {
        this.setupVisibilityListener();
        this.updateSettings();
    }

    static getInstance(): BackgroundThrottler {
        if (!BackgroundThrottler.instance) {
            BackgroundThrottler.instance = new BackgroundThrottler();
        }
        return BackgroundThrottler.instance;
    }

    /**
     * Setup visibility change listener
     */
    private setupVisibilityListener(): void {
        const handleVisibilityChange = () => {
            this.isBackground = document.hidden;
            this.updateSettings();
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    /**
     * Update settings based on current state
     */
    private updateSettings(): void {
        const level = this.isBackground ? this.config.level : 'none';

        if (level !== this.currentLevel) {
            this.currentLevel = level;

            if (this.isBackground) {
                this.applyThrottling();
                this.callbacks.onThrottle?.(level);
            } else {
                this.restoreFromThrottling();
                this.callbacks.onRestore?.();
            }

            this.notifyListeners();
        }
    }

    /**
     * Apply throttling settings
     */
    private applyThrottling(): void {
        const settings = this.settings[this.currentLevel];

        // Update animation frame rate
        if (this.config.reduceAnimationFPS) {
            this.startAnimationLoop();
        }

        // Update polling interval
        if (this.config.reducePollingInterval) {
            this.startPolling();
        }

        // Update heartbeat interval
        if (this.config.reduceHeartbeatInterval) {
            this.startHeartbeat();
        }

        // Pause non-essential tasks
        if (this.config.pauseNonEssentialTasks) {
            this.pauseNonEssentialTasks();
        }

        // Reduce network priority
        if (this.config.reduceNetworkPriority) {
            // In production, would adjust fetch priority using fetchPriority API
        }
    }

    /**
     * Restore from throttling
     */
    private restoreFromThrottling(): void {
        // Restore animation frame rate
        if (this.config.reduceAnimationFPS) {
            this.stopAnimationLoop();
            this.startAnimationLoop();
        }

        // Restore polling interval
        if (this.config.reducePollingInterval) {
            this.startPolling();
        }

        // Restore heartbeat interval
        if (this.config.reduceHeartbeatInterval) {
            this.startHeartbeat();
        }

        // Resume non-essential tasks
        if (this.config.pauseNonEssentialTasks) {
            this.resumeNonEssentialTasks();
        }
    }

    /**
     * Animation loop with throttled FPS
     */
    private startAnimationLoop(): void {
        const settings = this.settings[this.currentLevel];
        const frameInterval = 1000 / settings.backgroundFPS;

        const animate = (timestamp: number) => {
            const elapsed = timestamp - this.lastFrameTime;

            if (elapsed >= frameInterval) {
                this.lastFrameTime = timestamp - (elapsed % frameInterval);
                this.callbacks.onAnimationFrame?.(elapsed);
            }

            this.animationFrameId = requestAnimationFrame(animate);
        };

        this.animationFrameId = requestAnimationFrame(animate);
    }

    /**
     * Stop animation loop
     */
    private stopAnimationLoop(): void {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    /**
     * Start polling with throttled interval
     */
    private startPolling(): void {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
        }

        const settings = this.settings[this.currentLevel];
        const interval = this.isBackground
            ? settings.backgroundPollingInterval
            : settings.foregroundPollingInterval;

        this.pollTimer = setInterval(() => {
            this.callbacks.onPoll?.();
        }, interval);
    }

    /**
     * Start heartbeat with throttled interval
     */
    private startHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
        }

        const settings = this.settings[this.currentLevel];
        const interval = this.isBackground
            ? settings.backgroundHeartbeatInterval
            : settings.foregroundHeartbeatInterval;

        this.heartbeatTimer = setInterval(() => {
            this.callbacks.onHeartbeat?.();
        }, interval);
    }

    /**
     * Pause non-essential tasks
     */
    private pauseNonEssentialTasks(): void {
        // Mark all tasks as paused
        this.pausedTasks.add('analytics');
        this.pausedTasks.add('prefetching');
        this.pausedTasks.add('non-critical-updates');

        this.notifyTaskPause();
    }

    /**
     * Resume non-essential tasks
     */
    private resumeNonEssentialTasks(): void {
        // Resume all tasks
        this.pausedTasks.clear();
        this.notifyTaskResume();
    }

    /**
     * Pause a specific task
     */
    pauseTask(taskId: string): void {
        this.pausedTasks.add(taskId);
        this.notifyTaskPause();
    }

    /**
     * Resume a specific task
     */
    resumeTask(taskId: string): void {
        this.pausedTasks.delete(taskId);
        this.notifyTaskResume();
    }

    /**
     * Check if task is paused
     */
    isTaskPaused(taskId: string): boolean {
        return this.pausedTasks.has(taskId);
    }

    /**
     * Get all paused tasks
     */
    getPausedTasks(): string[] {
        return Array.from(this.pausedTasks);
    }

    /**
     * Configure throttling
     */
    configure(config: Partial<ThrottleConfig>): void {
        this.config = { ...this.config, ...config };
        this.updateSettings();
    }

    /**
     * Set callbacks
     */
    onThrottling(callbacks: Partial<ThrottleCallbacks>): void {
        this.callbacks = { ...this.callbacks, ...callbacks };
    }

    /**
     * Get current throttle level
     */
    getCurrentLevel(): ThrottleLevel {
        return this.currentLevel;
    }

    /**
     * Get current settings
     */
    getCurrentSettings(): ThrottleSettings {
        return this.settings[this.currentLevel];
    }

    /**
     * Get all settings
     */
    getAllSettings(): Record<ThrottleLevel, ThrottleSettings> {
        return this.settings;
    }

    /**
     * Subscribe to level changes
     */
    subscribe(listener: (level: ThrottleLevel) => void): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    /**
     * Notify listeners
     */
    private notifyListeners(): void {
        this.listeners.forEach(listener => listener(this.currentLevel));
    }

    /**
     * Notify task pause
     */
    private notifyTaskPause(): void {
        // In production, would dispatch custom event
    }

    /**
     * Notify task resume
     */
    private notifyTaskResume(): void {
        // In production, would dispatch custom event
    }

    /**
     * Manually set background state
     */
    setBackground(isBackground: boolean): void {
        this.isBackground = isBackground;
        this.updateSettings();
    }

    /**
     * Check if currently throttled
     */
    isThrottled(): boolean {
        return this.isBackground && this.currentLevel !== 'none';
    }

    /**
     * Get status summary
     */
    getStatus(): {
        isBackground: boolean;
        level: ThrottleLevel;
        isThrottled: boolean;
        pausedTasks: string[];
        settings: ThrottleSettings;
    } {
        return {
            isBackground: this.isBackground,
            level: this.currentLevel,
            isThrottled: this.isThrottled(),
            pausedTasks: this.getPausedTasks(),
            settings: this.getCurrentSettings(),
        };
    }

    /**
     * Reset to defaults
     */
    reset(): void {
        this.config = {
            level: 'light',
            reduceAnimationFPS: true,
            reducePollingInterval: true,
            reduceHeartbeatInterval: true,
            pauseNonEssentialTasks: true,
            reduceNetworkPriority: true,
        };
        this.pausedTasks.clear();
        this.updateSettings();
    }

    /**
     * Cleanup
     */
    destroy(): void {
        this.stopAnimationLoop();

        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }

        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }

        this.listeners = [];
    }
}

export const backgroundThrottler = BackgroundThrottler.getInstance();
export type { ThrottleConfig, ThrottleSettings, ThrottleCallbacks, ThrottleLevel };
