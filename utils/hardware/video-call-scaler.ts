/**
 * Video Call Resolution Scaler
 * 
 * Manages video call resolution based on network conditions,
 * device capabilities, and user preferences.
 */

export type VideoResolution = '360p' | '480p' | '720p' | '1080p' | '4K';
export type FrameRate = 15 | 24 | 30 | 60;

interface ResolutionSettings {
    maxResolution: VideoResolution;
    maxFrameRate: FrameRate;
    maintainAspectRatio: boolean;
    preferSmoothness: boolean;
    bandwidthSaver: boolean;
}

interface NetworkStats {
    downloadSpeed: number; // Mbps
    uploadSpeed: number; // Mbps
    latency: number; // ms
    jitter: number; // ms
    packetLoss: number; // percentage
}

interface DeviceCapabilities {
    maxResolution: VideoResolution;
    maxFrameRate: FrameRate;
    hardwareEncoding: boolean;
    hardwareDecoding: boolean;
    totalMemory: number; // GB
    cpuCores: number;
}

interface AdaptiveConfig {
    minBitrate: number; // kbps
    maxBitrate: number; // kbps
    startBitrate: number; // kbps
    bandwidthCheckInterval: number; // ms
    enableAutoScaling: boolean;
    scaleDownThreshold: number; // percentage of max bitrate
    scaleUpThreshold: number; // percentage of max bitrate
}

const RESOLUTION_CONFIG: Record<VideoResolution, { width: number; height: number; aspectRatio: string }> = {
    '360p': { width: 640, height: 360, aspectRatio: '16:9' },
    '480p': { width: 854, height: 480, aspectRatio: '16:9' },
    '720p': { width: 1280, height: 720, aspectRatio: '16:9' },
    '1080p': { width: 1920, height: 1080, aspectRatio: '16:9' },
    '4K': { width: 3840, height: 2160, aspectRatio: '16:9' },
};

const BITRATE_RANGES: Record<VideoResolution, { min: number; max: number; recommended: number }> = {
    '360p': { min: 300, max: 700, recommended: 500 },
    '480p': { min: 500, max: 1500, recommended: 1000 },
    '720p': { min: 1500, max: 3000, recommended: 2500 },
    '1080p': { min: 3000, max: 6000, recommended: 4500 },
    '4K': { min: 8000, max: 20000, recommended: 15000 },
};

const FRAME_RATE_CONFIG: Record<FrameRate, number> = {
    15: 15,
    24: 24,
    30: 30,
    60: 60,
};

class VideoResolutionScaler {
    private static instance: VideoResolutionScaler;
    private currentSettings: ResolutionSettings;
    private networkStats: NetworkStats | null = null;
    private deviceCapabilities: DeviceCapabilities | null = null;
    private config: AdaptiveConfig;
    private localStream: MediaStream | null = null;
    private videoTrack: MediaStreamTrack | null = null;
    private peerConnections: Map<string, RTCPeerConnection> = new Map();
    private bitrateMonitorInterval: NodeJS.Timeout | null = null;
    private bandwidthHistory: { timestamp: number; bitrate: number }[] = [];
    private listeners: Set<(settings: ResolutionSettings) => void> = new Set();
    private initialized: boolean = false;

    private constructor() {
        this.currentSettings = {
            maxResolution: '720p',
            maxFrameRate: 30,
            maintainAspectRatio: true,
            preferSmoothness: true,
            bandwidthSaver: false,
        };
        this.config = {
            minBitrate: 300,
            maxBitrate: 6000,
            startBitrate: 2500,
            bandwidthCheckInterval: 5000,
            enableAutoScaling: true,
            scaleDownThreshold: 70,
            scaleUpThreshold: 90,
        };
    }

    static getInstance(): VideoResolutionScaler {
        if (!VideoResolutionScaler.instance) {
            VideoResolutionScaler.instance = new VideoResolutionScaler();
        }
        return VideoResolutionScaler.instance;
    }

    /**
     * Initialize the scaler
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        await this.detectDeviceCapabilities();
        this.loadSettings();
        this.initialized = true;

        console.log('Video Resolution Scaler initialized:', {
            capabilities: this.deviceCapabilities,
            settings: this.currentSettings,
        });
    }

    /**
     * Detect device capabilities
     */
    private async detectDeviceCapabilities(): Promise<void> {
        // Check for hardware encoding support
        const hwEncoding = await this.checkHardwareEncoding();

        // Get device memory
        const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 8;

        // Get CPU cores
        const cores = (navigator as Navigator & { hardwareConcurrency?: number }).hardwareConcurrency || 4;

        // Check for 4K support
        const screen4K = window.screen.width >= 3840 || window.screen.height >= 2160;

        // Determine max resolution based on device
        let maxResolution: VideoResolution = '720p';
        if (hwEncoding && memory >= 16 && cores >= 8) {
            maxResolution = screen4K ? '4K' : '1080p';
        } else if (hwEncoding && memory >= 8) {
            maxResolution = '1080p';
        } else if (memory >= 4) {
            maxResolution = '720p';
        } else {
            maxResolution = '480p';
        }

        // Determine max frame rate
        let maxFrameRate: FrameRate = 30;
        if (hwEncoding && cores >= 8) {
            maxFrameRate = 60;
        } else if (cores >= 4) {
            maxFrameRate = 30;
        } else {
            maxFrameRate = 24;
        }

        this.deviceCapabilities = {
            maxResolution,
            maxFrameRate,
            hardwareEncoding: hwEncoding,
            hardwareDecoding: true,
            totalMemory: memory,
            cpuCores: cores,
        };
    }

    /**
     * Check for hardware encoding support
     */
    private async checkHardwareEncoding(): Promise<boolean> {
        if (!('MediaRecorder' in window)) return false;

        try {
            // Check for various codec support
            const supportedTypes = [
                'video/webm;codecs=vp9',
                'video/webm;codecs=vp8',
                'video/webm;codecs=h264',
            ];

            for (const type of supportedTypes) {
                if (MediaRecorder.isTypeSupported(type)) {
                    return true;
                }
            }

            return false;
        } catch {
            return false;
        }
    }

    /**
     * Load settings from localStorage
     */
    private loadSettings(): void {
        try {
            const stored = localStorage.getItem('videoResolutionSettings');
            if (stored) {
                const parsed = JSON.parse(stored);
                this.currentSettings = { ...this.currentSettings, ...parsed };
            }
        } catch {
            console.warn('Failed to load video settings');
        }
    }

    /**
     * Save settings to localStorage
     */
    private saveSettings(): void {
        try {
            localStorage.setItem('videoResolutionSettings', JSON.stringify(this.currentSettings));
        } catch {
            console.warn('Failed to save video settings');
        }
    }

    /**
     * Set the local video stream
     */
    setLocalStream(stream: MediaStream): void {
        this.localStream = stream;
        this.videoTrack = stream.getVideoTracks()[0] || null;

        if (this.videoTrack) {
            this.videoTrack.addEventListener('ended', () => {
                this.localStream = null;
                this.videoTrack = null;
            });
        }
    }

    /**
     * Add a peer connection to manage
     */
    addPeerConnection(peerId: string, pc: RTCPeerConnection): void {
        this.peerConnections.set(peerId, pc);
    }

    /**
     * Remove a peer connection
     */
    removePeerConnection(peerId: string): void {
        this.peerConnections.delete(peerId);
    }

    /**
     * Start bandwidth monitoring
     */
    startMonitoring(): void {
        if (this.bitrateMonitorInterval) return;

        this.bitrateMonitorInterval = setInterval(() => {
            this.measureBandwidth();
        }, this.config.bandwidthCheckInterval);
    }

    /**
     * Stop bandwidth monitoring
     */
    stopMonitoring(): void {
        if (this.bitrateMonitorInterval) {
            clearInterval(this.bitrateMonitorInterval);
            this.bitrateMonitorInterval = null;
        }
    }

    /**
     * Measure current bandwidth
     */
    private async measureBandwidth(): Promise<void> {
        // Simple bandwidth estimation based on WebRTC stats
        for (const [peerId, pc] of this.peerConnections) {
            try {
                const stats = await pc.getStats();

                let bytesReceived = 0;
                let bytesSent = 0;
                let timestamp: number | null = null;

                stats.forEach((report) => {
                    if (report.type === 'inbound-rtp' && report.kind === 'video') {
                        bytesReceived += report.bytesReceived || 0;
                        timestamp = report.timestamp;
                    }
                    if (report.type === 'outbound-rtp' && report.kind === 'video') {
                        bytesSent += report.bytesSent || 0;
                    }
                });

                if (timestamp && bytesReceived > 0 && bytesSent > 0) {
                    // Calculate approximate bitrate
                    const bitrate = (bytesSent * 8) / (this.config.bandwidthCheckInterval / 1000);

                    this.bandwidthHistory.push({
                        timestamp: Date.now(),
                        bitrate,
                    });

                    // Keep only last 10 measurements
                    if (this.bandwidthHistory.length > 10) {
                        this.bandwidthHistory.shift();
                    }
                }
            } catch (error) {
                console.warn(`Failed to get stats for peer ${peerId}:`, error);
            }
        }

        // Auto-scale if enabled
        if (this.config.enableAutoScaling) {
            this.adjustToNetworkConditions();
        }
    }

    /**
     * Adjust settings based on network conditions
     */
    private adjustToNetworkConditions(): void {
        if (this.bandwidthHistory.length < 3 || !this.deviceCapabilities) {
            return;
        }

        // Calculate average bitrate from recent history
        const recentHistory = this.bandwidthHistory.slice(-5);
        const avgBitrate = recentHistory.reduce((sum, h) => sum + h.bitrate, 0) / recentHistory.length;

        // Get recommended bitrate for current resolution
        const currentBitrateRange = BITRATE_RANGES[this.currentSettings.maxResolution];
        const utilizationPercent = (avgBitrate / (currentBitrateRange.max * 1000)) * 100;

        // Determine if we should scale up or down
        if (utilizationPercent > this.config.scaleUpThreshold) {
            // Network is handling current resolution well, try higher
            const higherResolutions = this.getHigherResolution(this.currentSettings.maxResolution);
            if (higherResolutions.length > 0) {
                this.setResolution(higherResolutions[0]);
            }
        } else if (utilizationPercent < this.config.scaleDownThreshold) {
            // Network is struggling, reduce resolution
            const lowerResolutions = this.getLowerResolution(this.currentSettings.maxResolution);
            if (lowerResolutions.length > 0) {
                this.setResolution(lowerResolutions[0]);
            }
        }
    }

    /**
     * Get higher resolutions than current
     */
    private getHigherResolution(current: VideoResolution): VideoResolution[] {
        const order: VideoResolution[] = ['360p', '480p', '720p', '1080p', '4K'];
        const currentIndex = order.indexOf(current);
        return order.slice(currentIndex + 1);
    }

    /**
     * Get lower resolutions than current
     */
    private getLowerResolution(current: VideoResolution): VideoResolution[] {
        const order: VideoResolution[] = ['360p', '480p', '720p', '1080p', '4K'];
        const currentIndex = order.indexOf(current);
        return order.slice(0, currentIndex).reverse();
    }

    /**
     * Set video resolution
     */
    async setResolution(resolution: VideoResolution): Promise<void> {
        if (!this.deviceCapabilities) {
            await this.initialize();
        }

        // Check if device supports this resolution
        if (this.deviceCapabilities) {
            const capabilityOrder = ['360p', '480p', '720p', '1080p', '4K'];
            const requestedIndex = capabilityOrder.indexOf(resolution);
            const maxIndex = capabilityOrder.indexOf(this.deviceCapabilities.maxResolution);

            if (requestedIndex > maxIndex) {
                console.warn(`Device does not support ${resolution}, using max supported: ${this.deviceCapabilities.maxResolution}`);
                resolution = this.deviceCapabilities.maxResolution;
            }
        }

        this.currentSettings.maxResolution = resolution;
        this.applySettings();
        this.saveSettings();
        this.notifyListeners();
    }

    /**
     * Set frame rate
     */
    async setFrameRate(frameRate: FrameRate): Promise<void> {
        if (!this.deviceCapabilities) {
            await this.initialize();
        }

        if (this.deviceCapabilities && frameRate > this.deviceCapabilities.maxFrameRate) {
            frameRate = this.deviceCapabilities.maxFrameRate;
        }

        this.currentSettings.maxFrameRate = frameRate;
        this.applySettings();
        this.saveSettings();
        this.notifyListeners();
    }

    /**
     * Apply current settings to the video track
     */
    private async applySettings(): Promise<void> {
        if (!this.videoTrack) return;

        const settings = RESOLUTION_CONFIG[this.currentSettings.maxResolution];
        const frameRate = FRAME_RATE_CONFIG[this.currentSettings.maxFrameRate];

        try {
            // Apply constraints
            const constraints: MediaTrackConstraints = {
                width: { ideal: settings.width },
                height: { ideal: settings.height },
                frameRate: { ideal: frameRate },
            };

            await this.videoTrack.applyConstraints(constraints);

            console.log(`Applied video settings: ${this.currentSettings.maxResolution} @ ${this.currentSettings.maxFrameRate}fps`);
        } catch (error) {
            console.error('Failed to apply video constraints:', error);
        }
    }

    /**
     * Configure adaptive streaming
     */
    configureAdaptive(config: Partial<AdaptiveConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Get current settings
     */
    getSettings(): ResolutionSettings {
        return { ...this.currentSettings };
    }

    /**
     * Get recommended bitrate for current settings
     */
    getRecommendedBitrate(): number {
        return BITRATE_RANGES[this.currentSettings.maxResolution].recommended;
    }

    /**
     * Get bitrate range for a resolution
     */
    getBitrateRange(resolution: VideoResolution): { min: number; max: number; recommended: number } {
        return BITRATE_RANGES[resolution];
    }

    /**
     * Get resolution dimensions
     */
    getResolutionDimensions(resolution: VideoResolution): { width: number; height: number; aspectRatio: string } {
        return RESOLUTION_CONFIG[resolution];
    }

    /**
     * Enable bandwidth saver mode
     */
    setBandwidthSaver(enabled: boolean): void {
        this.currentSettings.bandwidthSaver = enabled;

        if (enabled) {
            // Auto-reduce to 480p in bandwidth saver mode
            this.setResolution('480p');
        } else {
            // Restore to device max
            if (this.deviceCapabilities) {
                this.setResolution(this.deviceCapabilities.maxResolution);
            }
        }
    }

    /**
     * Set prefer smoothness over quality
     */
    setPreferSmoothness(prefer: boolean): void {
        this.currentSettings.preferSmoothness = prefer;
        this.saveSettings();
    }

    /**
     * Subscribe to settings changes
     */
    subscribe(listener: (settings: ResolutionSettings) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Notify listeners of settings changes
     */
    private notifyListeners(): void {
        this.listeners.forEach(listener => listener(this.currentSettings));
    }

    /**
     * Get bandwidth statistics
     */
    getBandwidthStats(): { avgBitrate: number; history: { timestamp: number; bitrate: number }[] } {
        const history = [...this.bandwidthHistory];
        const avgBitrate = history.length > 0
            ? history.reduce((sum, h) => sum + h.bitrate, 0) / history.length
            : 0;

        return { avgBitrate, history };
    }

    /**
     * Reset to defaults
     */
    reset(): void {
        if (this.deviceCapabilities) {
            this.currentSettings.maxResolution = this.deviceCapabilities.maxResolution;
            this.currentSettings.maxFrameRate = this.deviceCapabilities.maxFrameRate;
        } else {
            this.currentSettings.maxResolution = '720p';
            this.currentSettings.maxFrameRate = 30;
        }

        this.currentSettings.bandwidthSaver = false;
        this.currentSettings.preferSmoothness = true;

        this.applySettings();
        this.saveSettings();
        this.notifyListeners();
    }

    /**
     * Get available resolutions for current device
     */
    getAvailableResolutions(): VideoResolution[] {
        if (!this.deviceCapabilities) {
            return ['360p', '480p', '720p', '1080p'];
        }

        const order: VideoResolution[] = ['360p', '480p', '720p', '1080p', '4K'];
        const maxIndex = order.indexOf(this.deviceCapabilities.maxResolution);
        return order.slice(0, maxIndex + 1);
    }

    /**
     * Get available frame rates for current device
     */
    getAvailableFrameRates(): FrameRate[] {
        if (!this.deviceCapabilities) {
            return [15, 24, 30];
        }

        const rates: FrameRate[] = [];
        if (this.deviceCapabilities.maxFrameRate >= 15) rates.push(15);
        if (this.deviceCapabilities.maxFrameRate >= 24) rates.push(24);
        if (this.deviceCapabilities.maxFrameRate >= 30) rates.push(30);
        if (this.deviceCapabilities.maxFrameRate >= 60) rates.push(60);

        return rates;
    }

    /**
     * Cleanup
     */
    destroy(): void {
        this.stopMonitoring();
        this.listeners.clear();
        this.peerConnections.clear();
        this.bandwidthHistory = [];
        this.initialized = false;
    }
}

export const videoResolutionScaler = VideoResolutionScaler.getInstance();
export type { ResolutionSettings, NetworkStats, DeviceCapabilities, AdaptiveConfig };
