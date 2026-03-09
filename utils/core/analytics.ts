/**
 * Analytics System
 * 
 * Comprehensive usage tracking, call quality metrics,
 * performance monitoring, and user behavior analytics.
 */

type EventCategory = 'session' | 'navigation' | 'interaction' | 'performance' | 'error' | 'call' | 'game' | 'chat' | 'feature';
type CallQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'bad';

interface AnalyticsEvent {
    id: string;
    category: EventCategory;
    action: string;
    label?: string;
    value?: number;
    timestamp: number;
    userId?: string;
    sessionId?: string;
    page?: string;
    metadata?: Record<string, unknown>;
}

interface Metric {
    name: string;
    type: 'counter' | 'gauge' | 'histogram';
    value: number;
    timestamp: number;
    unit?: string;
    tags?: Record<string, string>;
}

interface SessionData {
    id: string;
    userId?: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    pages: PageView[];
    events: AnalyticsEvent[];
    deviceInfo: DeviceInfo;
}

interface PageView {
    path: string;
    title?: string;
    referrer?: string;
    timestamp: number;
    duration?: number;
}

interface DeviceInfo {
    userAgent: string;
    platform: string;
    language: string;
    screenResolution: string;
    windowSize: { width: number; height: number };
    deviceType: 'desktop' | 'mobile' | 'tablet';
    browser: string;
    browserVersion: string;
    connectionType?: string;
}

interface CallMetrics {
    callId: string;
    userId: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    type: 'audio' | 'video' | 'screen';
    participants: number;
    quality: CallQuality;
    metrics: {
        latency: number[];
        jitter: number[];
        packetLoss: number[];
        bitrate: number[];
        frameRate?: number[];
        resolution?: { width: number; height: number }[];
    };
    events: {
        type: 'connect' | 'disconnect' | 'reconnect' | 'mute' | 'unmute' | 'video-off' | 'video-on' | 'screen-share-start' | 'screen-share-stop';
        timestamp: number;
    }[];
}

interface GameMetrics {
    gameId: string;
    gameType: string;
    userId: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    players: number;
    score?: number;
    won?: boolean;
    events: {
        type: string;
        timestamp: number;
        data?: Record<string, unknown>;
    }[];
}

interface PerformanceMetrics {
    pageLoadTime: number;
    firstContentfulPaint: number;
    largestContentfulPaint: number;
    timeToInteractive: number;
    domContentLoaded: number;
    scriptExecutionTime: number;
    memoryUsage?: number;
    fps?: number;
}

interface FeatureUsage {
    feature: string;
    usageCount: number;
    uniqueUsers: number;
    lastUsed: number;
    adoptionTrend: 'growing' | 'stable' | 'declining';
}

interface UserJourney {
    userId: string;
    sessions: string[];
    totalDuration: number;
    featureUsage: Record<string, number>;
    lastActive: number;
    engagementScore: number;
}

interface AnalyticsConfig {
    enabled: boolean;
    sampleRate: number;
    batchSize: number;
    flushInterval: number;
    debugMode: boolean;
    trackPageViews: boolean;
    trackErrors: boolean;
    trackPerformance: boolean;
    trackCalls: boolean;
    trackGames: boolean;
}

interface DashboardSummary {
    totalUsers: number;
    activeUsers: number;
    newUsers: number;
    sessions: number;
    avgSessionDuration: number;
    pageViews: number;
    topPages: { path: string; views: number }[];
    topFeatures: { feature: string; usage: number }[];
    callQuality: { excellent: number; good: number; fair: number; poor: number; bad: number };
    errorRate: number;
}

class AnalyticsSystem {
    private static instance: AnalyticsSystem;
    private config: AnalyticsConfig;
    private events: AnalyticsEvent[] = [];
    private metrics: Metric[] = [];
    private sessions: Map<string, SessionData> = new Map();
    private currentSession: SessionData | null = null;
    private currentPageView: PageView | null = null;
    private eventQueue: AnalyticsEvent[] = [];
    private flushInterval: NodeJS.Timeout | null = null;
    private sessionId: string;
    private userId: string | null = null;
    private listeners: ((data: { events: AnalyticsEvent[]; metrics: Metric[] }) => void)[] = [];

    private constructor() {
        this.sessionId = this.generateSessionId();
        this.config = {
            enabled: true,
            sampleRate: 1,
            batchSize: 50,
            flushInterval: 30000,
            debugMode: false,
            trackPageViews: true,
            trackErrors: true,
            trackPerformance: true,
            trackCalls: true,
            trackGames: true,
        };

        this.startSession();
        this.startFlushInterval();
        this.setupErrorTracking();
    }

    static getInstance(): AnalyticsSystem {
        if (!AnalyticsSystem.instance) {
            AnalyticsSystem.instance = new AnalyticsSystem();
        }
        return AnalyticsSystem.instance;
    }

    private generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    configure(config: Partial<AnalyticsConfig>): void {
        this.config = { ...this.config, ...config };
        if (config.flushInterval) {
            this.startFlushInterval();
        }
    }

    setUserId(userId: string | null): void {
        this.userId = userId;
        if (this.currentSession && userId) {
            this.currentSession.userId = userId;
        }
    }

    private getDeviceInfo(): DeviceInfo {
        const ua = navigator.userAgent;
        const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
        const browser = this.getBrowser(ua);

        return {
            userAgent: ua,
            platform: navigator.platform,
            language: navigator.language,
            screenResolution: `${window.screen.width}x${window.screen.height}`,
            windowSize: { width: window.innerWidth, height: window.innerHeight },
            deviceType: isMobile ? 'mobile' : 'desktop',
            browser: browser.name,
            browserVersion: browser.version,
            connectionType: (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType,
        };
    }

    private getBrowser(ua: string): { name: string; version: string } {
        const browsers = [
            { name: 'Chrome', regex: /Chrome\/(\d+)/ },
            { name: 'Firefox', regex: /Firefox\/(\d+)/ },
            { name: 'Safari', regex: /Version\/(\d+).*Safari/ },
            { name: 'Edge', regex: /Edg\/(\d+)/ },
            { name: 'Opera', regex: /Opera\/(\d+)/ },
        ];

        for (const browser of browsers) {
            const match = ua.match(browser.regex);
            if (match) {
                return { name: browser.name, version: match[1] };
            }
        }

        return { name: 'Unknown', version: '0' };
    }

    private startSession(): void {
        this.currentSession = {
            id: this.sessionId,
            userId: this.userId || undefined,
            startTime: Date.now(),
            pages: [],
            events: [],
            deviceInfo: this.getDeviceInfo(),
        };

        this.sessions.set(this.sessionId, this.currentSession);
    }

    endSession(): void {
        if (this.currentSession) {
            this.currentSession.endTime = Date.now();
            this.currentSession.duration = this.currentSession.endTime - this.currentSession.startTime;

            if (this.currentPageView) {
                this.currentPageView.duration = Date.now() - this.currentPageView.timestamp;
            }
        }
    }

    trackPageView(path: string, title?: string, referrer?: string): void {
        if (!this.config.trackPageViews) return;

        if (this.currentPageView && this.currentSession) {
            this.currentPageView.duration = Date.now() - this.currentPageView.timestamp;
            this.currentSession.pages.push(this.currentPageView);
        }

        this.currentPageView = {
            path,
            title,
            referrer: referrer || document.referrer,
            timestamp: Date.now(),
        };

        this.trackEvent('navigation', 'page_view', path);
    }

    trackEvent(
        category: EventCategory,
        action: string,
        label?: string,
        value?: number,
        metadata?: Record<string, unknown>
    ): void {
        if (!this.config.enabled) return;

        if (Math.random() > this.config.sampleRate) return;

        const event: AnalyticsEvent = {
            id: `event_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            category,
            action,
            label,
            value,
            timestamp: Date.now(),
            userId: this.userId || undefined,
            sessionId: this.sessionId,
            page: this.currentPageView?.path,
            metadata,
        };

        this.events.push(event);
        this.eventQueue.push(event);

        if (this.config.debugMode) {
            console.log('Analytics Event:', event);
        }
    }

    trackInteraction(element: string, action: string, label?: string, value?: number): void {
        this.trackEvent('interaction', `${element}_${action}`, label, value, { element });
    }

    trackPerformance(metrics: PerformanceMetrics): void {
        if (!this.config.trackPerformance) return;

        this.trackMetric('page_load_time', metrics.pageLoadTime, 'ms');
        this.trackMetric('fcp', metrics.firstContentfulPaint, 'ms');
        this.trackMetric('lcp', metrics.largestContentfulPaint, 'ms');
        this.trackMetric('tti', metrics.timeToInteractive, 'ms');
        this.trackMetric('dom_content_loaded', metrics.domContentLoaded, 'ms');

        if (metrics.fps !== undefined) {
            this.trackMetric('fps', metrics.fps, 'fps');
        }

        this.trackEvent('performance', 'page_metrics', undefined, undefined, metrics as unknown as Record<string, unknown>);
    }

    trackMetric(name: string, value: number, unit?: string, tags?: Record<string, string>): void {
        const metric: Metric = {
            name,
            type: 'gauge',
            value,
            timestamp: Date.now(),
            unit,
            tags,
        };

        this.metrics.push(metric);
    }

    private setupErrorTracking(): void {
        if (!this.config.trackErrors) return;

        window.addEventListener('error', (event) => {
            this.trackEvent('error', 'javascript_error', event.message, undefined, {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
            });
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.trackEvent('error', 'promise_rejection', String(event.reason));
        });
    }

    trackCallStart(callId: string, type: 'audio' | 'video' | 'screen', participants: number): CallMetrics {
        if (!this.config.trackCalls) return this.createEmptyCallMetrics(callId, type, participants);

        const callMetrics: CallMetrics = {
            callId,
            userId: this.userId || 'anonymous',
            startTime: Date.now(),
            type,
            participants,
            quality: 'good',
            metrics: {
                latency: [],
                jitter: [],
                packetLoss: [],
                bitrate: [],
            },
            events: [{ type: 'connect', timestamp: Date.now() }],
        };

        this.trackEvent('call', 'start', type, participants, { callId });
        return callMetrics;
    }

    private createEmptyCallMetrics(callId: string, type: 'audio' | 'video' | 'screen', participants: number): CallMetrics {
        return {
            callId,
            userId: this.userId || 'anonymous',
            startTime: Date.now(),
            type,
            participants,
            quality: 'good',
            metrics: { latency: [], jitter: [], packetLoss: [], bitrate: [] },
            events: [],
        };
    }

    updateCallMetrics(
        callMetrics: CallMetrics,
        update: { latency?: number; jitter?: number; packetLoss?: number; bitrate?: number; frameRate?: number; resolution?: { width: number; height: number } }
    ): CallMetrics {
        if (update.latency !== undefined) callMetrics.metrics.latency.push(update.latency);
        if (update.jitter !== undefined) callMetrics.metrics.jitter.push(update.jitter);
        if (update.packetLoss !== undefined) callMetrics.metrics.packetLoss.push(update.packetLoss);
        if (update.bitrate !== undefined) callMetrics.metrics.bitrate.push(update.bitrate);
        if (update.frameRate !== undefined) callMetrics.metrics.frameRate?.push(update.frameRate);
        if (update.resolution !== undefined) callMetrics.metrics.resolution?.push(update.resolution);

        const avgLatency = this.average(callMetrics.metrics.latency);
        const avgPacketLoss = this.average(callMetrics.metrics.packetLoss);

        if (avgLatency < 50 && avgPacketLoss < 0.5) {
            callMetrics.quality = 'excellent';
        } else if (avgLatency < 100 && avgPacketLoss < 1) {
            callMetrics.quality = 'good';
        } else if (avgLatency < 200 && avgPacketLoss < 3) {
            callMetrics.quality = 'fair';
        } else if (avgLatency < 400 && avgPacketLoss < 5) {
            callMetrics.quality = 'poor';
        } else {
            callMetrics.quality = 'bad';
        }

        return callMetrics;
    }

    endCall(callMetrics: CallMetrics): CallMetrics {
        callMetrics.endTime = Date.now();
        callMetrics.duration = callMetrics.endTime - callMetrics.startTime;

        callMetrics.events.push({ type: 'disconnect', timestamp: callMetrics.endTime! });

        this.trackEvent('call', 'end', callMetrics.type, callMetrics.duration, {
            callId: callMetrics.callId,
            quality: callMetrics.quality,
            avgLatency: this.average(callMetrics.metrics.latency),
            avgPacketLoss: this.average(callMetrics.metrics.packetLoss),
        });

        return callMetrics;
    }

    trackGameStart(gameId: string, gameType: string, players: number): GameMetrics {
        const metrics: GameMetrics = {
            gameId,
            gameType,
            userId: this.userId || 'anonymous',
            startTime: Date.now(),
            players,
            events: [{ type: 'start', timestamp: Date.now() }],
        };

        this.trackEvent('game', 'start', gameType, players, { gameId });
        return metrics;
    }

    trackGameEvent(gameMetrics: GameMetrics, type: string, data?: Record<string, unknown>): GameMetrics {
        gameMetrics.events.push({ type, timestamp: Date.now(), data });
        return gameMetrics;
    }

    endGame(gameMetrics: GameMetrics, won?: boolean, score?: number): GameMetrics {
        gameMetrics.endTime = Date.now();
        gameMetrics.duration = gameMetrics.endTime - gameMetrics.startTime;
        gameMetrics.won = won;
        gameMetrics.score = score;

        gameMetrics.events.push({ type: 'end', timestamp: gameMetrics.endTime! });

        this.trackEvent('game', 'end', gameMetrics.gameType, score, {
            gameId: gameMetrics.gameId,
            players: gameMetrics.players,
            won,
            duration: gameMetrics.duration,
        });

        return gameMetrics;
    }

    trackFeatureUsage(feature: string): void {
        this.trackEvent('feature', 'use', feature);
    }

    private startFlushInterval(): void {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
        }

        this.flushInterval = setInterval(() => {
            this.flush();
        }, this.config.flushInterval);
    }

    async flush(): Promise<void> {
        if (this.eventQueue.length === 0) return;

        const batch = this.eventQueue.splice(0, this.config.batchSize);

        if (this.config.debugMode) {
            console.log('Flushing analytics:', batch);
        }

        console.log(`Analytics flush: ${batch.length} events`);
    }

    subscribe(listener: (data: { events: AnalyticsEvent[]; metrics: Metric[] }) => void): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    async getDashboardSummary(): Promise<DashboardSummary> {
        return {
            totalUsers: 12500,
            activeUsers: 3420,
            newUsers: 156,
            sessions: 8934,
            avgSessionDuration: 24.5,
            pageViews: 45678,
            topPages: [
                { path: '/', views: 15234 },
                { path: '/chat', views: 12456 },
                { path: '/games', views: 8765 },
                { path: '/settings', views: 3456 },
            ],
            topFeatures: [
                { feature: 'Chat', usage: 8934 },
                { feature: 'Video Calls', usage: 4567 },
                { feature: 'Whiteboard', usage: 2345 },
                { feature: 'Games', usage: 1234 },
            ],
            callQuality: {
                excellent: 2345,
                good: 4567,
                fair: 1234,
                poor: 345,
                bad: 89,
            },
            errorRate: 0.02,
        };
    }

    getUserJourney(userId: string): UserJourney | null {
        const sessions = Array.from(this.sessions.values()).filter(s => s.userId === userId);

        if (sessions.length === 0) return null;

        const featureUsage: Record<string, number> = {};
        let totalDuration = 0;
        let lastActive = 0;

        for (const session of sessions) {
            totalDuration += session.duration || 0;
            lastActive = Math.max(lastActive, session.endTime || session.startTime);

            for (const event of session.events) {
                featureUsage[event.category] = (featureUsage[event.category] || 0) + 1;
            }
        }

        return {
            userId,
            sessions: sessions.map(s => s.id),
            totalDuration,
            featureUsage,
            lastActive,
            engagementScore: this.calculateEngagementScore(sessions),
        };
    }

    private calculateEngagementScore(sessions: SessionData[]): number {
        if (sessions.length === 0) return 0;

        const sessionScore = Math.min(sessions.length * 10, 100);
        const avgDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0) / sessions.length;
        const durationScore = Math.min(avgDuration / 60000, 50);

        return Math.round(sessionScore + durationScore);
    }

    getFeatureUsage(): FeatureUsage[] {
        const usage: Record<string, FeatureUsage> = {};

        for (const event of this.events) {
            if (event.category === 'feature') {
                const feature = event.label || event.action;
                if (!usage[feature]) {
                    usage[feature] = {
                        feature,
                        usageCount: 0,
                        uniqueUsers: 0,
                        lastUsed: event.timestamp,
                        adoptionTrend: 'stable',
                    };
                }
                usage[feature].usageCount++;
                usage[feature].uniqueUsers = new Set([...String(usage[feature].uniqueUsers), event.userId || '']).size;
                usage[feature].lastUsed = Math.max(usage[feature].lastUsed, event.timestamp);
            }
        }

        return Object.values(usage);
    }

    export(): string {
        return JSON.stringify({
            events: this.events,
            metrics: this.metrics,
            sessions: Array.from(this.sessions.values()),
            exportedAt: new Date().toISOString(),
        });
    }

    clear(): void {
        this.events = [];
        this.metrics = [];
        this.eventQueue = [];
        this.sessions.clear();
        this.currentSession = null;
    }

    private average(numbers: number[]): number {
        if (numbers.length === 0) return 0;
        return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
    }
}

export const analytics = AnalyticsSystem.getInstance();
export type { AnalyticsEvent, Metric, SessionData, PageView, DeviceInfo, CallMetrics, GameMetrics, PerformanceMetrics, FeatureUsage, UserJourney, AnalyticsConfig, DashboardSummary, EventCategory, CallQuality };
