/**
 * Theater Quality Manager
 * 
 * Adaptive video quality settings with auto-detection,
 * bandwidth adaptation, and manual selection.
 */

type QualityLevel = 'auto' | '1080p' | '720p' | '480p' | '360p' | '240p' | 'audio';

interface QualitySettings {
    mode: 'auto' | 'manual';
    preferredQuality: QualityLevel;
    bandwidthSaver: boolean;
    dataSaver: boolean;
    autoPlay: boolean;
    subtitles: boolean;
    subtitleLanguage: string;
    playbackSpeed: number;
}

interface NetworkInfo {
    effectiveType: 'slow-2g' | '2g' | '3g' | '4g' | '5g' | 'unknown';
    downlink: number; // Mbps
    rtt: number; // ms
    saveData: boolean;
}

interface QualityRecommendation {
    quality: QualityLevel;
    reason: string;
    bandwidth: number; // required kbps
}

const QUALITY_BANDWIDTH: Record<QualityLevel, number> = {
    '1080p': 5000,
    '720p': 2500,
    '480p': 1000,
    '360p': 500,
    '240p': 250,
    'audio': 64,
    'auto': 0,
};

class TheaterQualityManager {
    private static instance: TheaterQualityManager;
    private settings: QualitySettings = {
        mode: 'auto',
        preferredQuality: 'auto',
        bandwidthSaver: false,
        dataSaver: false,
        autoPlay: true,
        subtitles: false,
        subtitleLanguage: 'en',
        playbackSpeed: 1,
    };
    private networkInfo: NetworkInfo = {
        effectiveType: 'unknown',
        downlink: 0,
        rtt: 0,
        saveData: false,
    };
    private listeners: ((settings: QualitySettings) => void)[] = [];

    private constructor() {
        this.detectNetwork();
        this.loadFromStorage();
    }

    static getInstance(): TheaterQualityManager {
        if (!TheaterQualityManager.instance) {
            TheaterQualityManager.instance = new TheaterQualityManager();
        }
        return TheaterQualityManager.instance;
    }

    /**
     * Detect network conditions
     */
    detectNetwork(): void {
        const connection = (navigator as Navigator & { connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean } }).connection;

        if (connection) {
            this.networkInfo = {
                effectiveType: (connection.effectiveType as NetworkInfo['effectiveType']) || 'unknown',
                downlink: connection.downlink || 0,
                rtt: connection.rtt || 0,
                saveData: connection.saveData || false,
            };
        }

        // Update data saver if network indicates
        if (this.networkInfo.saveData || this.settings.dataSaver) {
            this.settings.bandwidthSaver = true;
        }
    }

    /**
     * Get quality recommendation based on network
     */
    getRecommendation(): QualityRecommendation {
        const bandwidth = this.networkInfo.downlink * 1000; // Convert to kbps

        // Adjust for RTT
        if (this.networkInfo.rtt > 300) {
            // High latency, suggest lower quality
            return {
                quality: '720p',
                reason: 'High latency detected',
                bandwidth: QUALITY_BANDWIDTH['720p'],
            };
        }

        // Adjust for bandwidth
        if (bandwidth >= QUALITY_BANDWIDTH['1080p']) {
            return {
                quality: '1080p',
                reason: 'High bandwidth available',
                bandwidth: QUALITY_BANDWIDTH['1080p'],
            };
        } else if (bandwidth >= QUALITY_BANDWIDTH['720p']) {
            return {
                quality: '720p',
                reason: 'Moderate bandwidth',
                bandwidth: QUALITY_BANDWIDTH['720p'],
            };
        } else if (bandwidth >= QUALITY_BANDWIDTH['480p']) {
            return {
                quality: '480p',
                reason: 'Limited bandwidth',
                bandwidth: QUALITY_BANDWIDTH['480p'],
            };
        } else if (bandwidth >= QUALITY_BANDWIDTH['360p']) {
            return {
                quality: '360p',
                reason: 'Low bandwidth',
                bandwidth: QUALITY_BANDWIDTH['360p'],
            };
        } else {
            return {
                quality: '240p',
                reason: 'Very low bandwidth',
                bandwidth: QUALITY_BANDWIDTH['240p'],
            };
        }
    }

    /**
     * Get current quality
     */
    getCurrentQuality(): QualityLevel {
        if (this.settings.mode === 'manual') {
            return this.settings.preferredQuality;
        }

        return this.getRecommendation().quality;
    }

    /**
     * Set quality manually
     */
    setQuality(quality: QualityLevel): void {
        this.settings.mode = 'manual';
        this.settings.preferredQuality = quality;
        this.saveToStorage();
        this.notifyListeners();
    }

    /**
     * Enable auto quality
     */
    setAutoQuality(): void {
        this.settings.mode = 'auto';
        this.saveToStorage();
        this.notifyListeners();
    }

    /**
     * Enable/disable bandwidth saver
     */
    setBandwidthSaver(enabled: boolean): void {
        this.settings.bandwidthSaver = enabled;
        this.settings.dataSaver = enabled;
        this.saveToStorage();
        this.notifyListeners();
    }

    /**
     * Set playback speed
     */
    setPlaybackSpeed(speed: number): void {
        this.settings.playbackSpeed = Math.max(0.25, Math.min(4, speed));
        this.saveToStorage();
        this.notifyListeners();
    }

    /**
     * Toggle subtitles
     */
    toggleSubtitles(): void {
        this.settings.subtitles = !this.settings.subtitles;
        this.saveToStorage();
        this.notifyListeners();
    }

    /**
     * Set subtitle language
     */
    setSubtitleLanguage(language: string): void {
        this.settings.subtitleLanguage = language;
        this.saveToStorage();
        this.notifyListeners();
    }

    /**
     * Get settings
     */
    getSettings(): QualitySettings {
        return { ...this.settings };
    }

    /**
     * Get network info
     */
    getNetworkInfo(): NetworkInfo {
        return { ...this.networkInfo };
    }

    /**
     * Get available qualities
     */
    getAvailableQualities(): { level: QualityLevel; bandwidth: number; label: string }[] {
        return [
            { level: '1080p', bandwidth: QUALITY_BANDWIDTH['1080p'], label: '1080p Full HD' },
            { level: '720p', bandwidth: QUALITY_BANDWIDTH['720p'], label: '720p HD' },
            { level: '480p', bandwidth: QUALITY_BANDWIDTH['480p'], label: '480p SD' },
            { level: '360p', bandwidth: QUALITY_BANDWIDTH['360p'], label: '360p' },
            { level: '240p', bandwidth: QUALITY_BANDWIDTH['240p'], label: '240p' },
            { level: 'audio', bandwidth: QUALITY_BANDWIDTH['audio'], label: 'Audio Only' },
        ];
    }

    /**
     * Subscribe to settings changes
     */
    subscribe(listener: (settings: QualitySettings) => void): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    /**
     * Notify listeners
     */
    private notifyListeners(): void {
        this.listeners.forEach(listener => listener({ ...this.settings }));
    }

    /**
     * Load from storage
     */
    private loadFromStorage(): void {
        try {
            const saved = localStorage.getItem('theater_quality_settings');
            if (saved) {
                const parsed = JSON.parse(saved);
                this.settings = { ...this.settings, ...parsed };
            }
        } catch (error) {
            console.error('Failed to load quality settings:', error);
        }
    }

    /**
     * Save to storage
     */
    private saveToStorage(): void {
        try {
            localStorage.setItem('theater_quality_settings', JSON.stringify(this.settings));
        } catch (error) {
            console.error('Failed to save quality settings:', error);
        }
    }

    /**
     * Reset settings
     */
    reset(): void {
        this.settings = {
            mode: 'auto',
            preferredQuality: 'auto',
            bandwidthSaver: false,
            dataSaver: false,
            autoPlay: true,
            subtitles: false,
            subtitleLanguage: 'en',
            playbackSpeed: 1,
        };
        this.saveToStorage();
        this.notifyListeners();
    }
}

export const theaterQuality = TheaterQualityManager.getInstance();
export type { QualitySettings, NetworkInfo, QualityRecommendation, QualityLevel };
