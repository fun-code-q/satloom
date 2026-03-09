/**
 * Video Quality Scaler
 * 
 * Adaptive video quality based on device capabilities,
 * network conditions, and user preferences.
 */

type VideoQuality = '1080p' | '720p' | '480p' | '360p' | '240p' | 'auto';

interface VideoQualitySettings {
    defaultQuality: VideoQuality;
    autoAdjust: boolean;
    minQuality: VideoQuality;
    maxQuality: VideoQuality;
    preferHigherFPS: boolean;
    enableHardwareAcceleration: boolean;
}

interface DeviceCapabilities {
    maxWidth: number;
    maxHeight: number;
    maxFPS: number;
    supportsH264: boolean;
    supportsVP9: boolean;
    supportsH265: boolean;
    hardwareAcceleration: boolean;
    memoryLimit: number; // MB
}

interface BandwidthEstimate {
    kbps: number;
    confidence: number;
    timestamp: number;
}

class VideoQualityScaler {
    private static instance: VideoQualityScaler;
    private settings: VideoQualitySettings = {
        defaultQuality: 'auto',
        autoAdjust: true,
        minQuality: '240p',
        maxQuality: '1080p',
        preferHigherFPS: false,
        enableHardwareAcceleration: true,
    };
    private deviceCapabilities: DeviceCapabilities | null = null;
    private bandwidthHistory: BandwidthEstimate[] = [];
    private listeners: ((quality: VideoQuality) => void)[] = [];

    private constructor() {
        this.detectCapabilities();
    }

    static getInstance(): VideoQualityScaler {
        if (!VideoQualityScaler.instance) {
            VideoQualityScaler.instance = new VideoQualityScaler();
        }
        return VideoQualityScaler.instance;
    }

    /**
     * Detect device capabilities
     */
    private detectCapabilities(): void {
        // Detect max video resolution
        const maxWidth = window.screen.width * window.devicePixelRatio;
        const maxHeight = window.screen.height * window.devicePixelRatio;

        // Detect FPS capability
        const maxFPS = 60; // Default, could detect via requestVideoFrameCallback

        // Codec support detection
        const video = document.createElement('video');
        const supportsH264 = video.canPlayType('video/mp4; codecs="avc1.42E01E"') !== '';
        const supportsVP9 = video.canPlayType('video/webm; codecs="vp9"') !== '';

        // Hardware acceleration
        const hardwareAcceleration = (navigator as Navigator & { hardwareConcurrency?: number }).hardwareConcurrency !== undefined;

        // Memory limit (if available)
        const perf = window.performance as Performance & { memory?: { jsHeapSizeLimit: number } };
        const memoryLimit = perf.memory?.jsHeapSizeLimit
            ? Math.floor(perf.memory.jsHeapSizeLimit / (1024 * 1024))
            : 512; // Default 512MB

        this.deviceCapabilities = {
            maxWidth,
            maxHeight,
            maxFPS,
            supportsH264,
            supportsVP9,
            supportsH265: false, // Not widely supported
            hardwareAcceleration,
            memoryLimit,
        };
    }

    /**
     * Get device capabilities
     */
    getCapabilities(): DeviceCapabilities {
        return this.deviceCapabilities || {
            maxWidth: 1920,
            maxHeight: 1080,
            maxFPS: 30,
            supportsH264: true,
            supportsVP9: true,
            supportsH265: false,
            hardwareAcceleration: false,
            memoryLimit: 512,
        };
    }

    /**
     * Update bandwidth estimate
     */
    updateBandwidthEstimate(kbps: number, confidence: number): void {
        this.bandwidthHistory.push({
            kbps,
            confidence,
            timestamp: Date.now(),
        });

        // Keep only last 10 estimates
        if (this.bandwidthHistory.length > 10) {
            this.bandwidthHistory.shift();
        }
    }

    /**
     * Get average bandwidth
     */
    getAverageBandwidth(): number {
        if (this.bandwidthHistory.length === 0) return 5000; // Default 5 Mbps

        const recent = this.bandwidthHistory.slice(-5);
        const total = recent.reduce((sum, e) => sum + e.kbps * e.confidence, 0);
        const weight = recent.reduce((sum, e) => sum + e.confidence, 0);

        return total / weight;
    }

    /**
     * Get recommended quality based on conditions
     */
    getRecommendedQuality(): VideoQuality {
        const bandwidth = this.getAverageBandwidth();
        const capabilities = this.getCapabilities();

        // Calculate available bandwidth per stream
        const availableBandwidth = bandwidth * 0.7; // Use 70% of bandwidth

        // Determine max quality based on bandwidth
        let maxQuality: VideoQuality;
        if (availableBandwidth >= 5000) {
            maxQuality = '1080p';
        } else if (availableBandwidth >= 2500) {
            maxQuality = '720p';
        } else if (availableBandwidth >= 1000) {
            maxQuality = '480p';
        } else if (availableBandwidth >= 500) {
            maxQuality = '360p';
        } else {
            maxQuality = '240p';
        }

        // Check device capabilities
        const maxDeviceQuality = this.getQualityForResolution(
            Math.min(capabilities.maxWidth, capabilities.maxHeight)
        );

        // Return the lower of the two
        const recommended = this.compareQualities(maxQuality, maxDeviceQuality);

        // Respect min/max settings
        const minQuality = this.getNumericQuality(this.settings.minQuality);
        const maxQualityNum = this.getNumericQuality(this.settings.maxQuality);
        const recommendedNum = this.getNumericQuality(recommended);

        const finalQuality = Math.max(minQuality, Math.min(maxQualityNum, recommendedNum));

        return this.getQualityFromNumeric(finalQuality);
    }

    /**
     * Get quality for resolution
     */
    private getQualityForResolution(resolution: number): VideoQuality {
        if (resolution >= 1080) return '1080p';
        if (resolution >= 720) return '720p';
        if (resolution >= 480) return '480p';
        if (resolution >= 360) return '360p';
        return '240p';
    }

    /**
     * Compare two qualities
     */
    private compareQualities(a: VideoQuality, b: VideoQuality): VideoQuality {
        const aNum = this.getNumericQuality(a);
        const bNum = this.getNumericQuality(b);
        return aNum >= bNum ? a : b;
    }

    /**
     * Get numeric value for quality
     */
    private getNumericQuality(quality: VideoQuality): number {
        const qualities: VideoQuality[] = ['240p', '360p', '480p', '720p', '1080p', 'auto'];
        return qualities.indexOf(quality === 'auto' ? '720p' : quality);
    }

    /**
     * Get quality from numeric
     */
    private getQualityFromNumeric(num: number): VideoQuality {
        const qualities: VideoQuality[] = ['240p', '360p', '480p', '720p', '1080p'];
        return qualities[Math.min(num, qualities.length - 1)];
    }

    /**
     * Calculate optimal bitrate for quality
     */
    getOptimalBitrate(quality: VideoQuality, fps: number = 30): number {
        const baseBitrates: Record<VideoQuality, number> = {
            '1080p': 5000,
            '720p': 2500,
            '480p': 1000,
            '360p': 500,
            '240p': 250,
            'auto': 2500,
        };

        let bitrate = baseBitrates[quality] || 2500;

        // Adjust for FPS
        if (fps > 30) {
            bitrate *= 1.2; // 20% more for 60fps
        }

        // Adjust for motion (simulated by checking if content is likely high motion)
        // This would typically come from content analysis

        return bitrate;
    }

    /**
     * Set quality
     */
    setQuality(quality: VideoQuality): void {
        if (quality === 'auto') {
            this.settings.autoAdjust = true;
        } else {
            this.settings.autoAdjust = false;
            this.settings.defaultQuality = quality;
        }
        this.notifyListeners(quality);
    }

    /**
     * Configure settings
     */
    configure(settings: Partial<VideoQualitySettings>): void {
        this.settings = { ...this.settings, ...settings };
    }

    /**
     * Get current quality
     */
    getCurrentQuality(): VideoQuality {
        if (this.settings.autoAdjust) {
            return this.getRecommendedQuality();
        }
        return this.settings.defaultQuality;
    }

    /**
     * Subscribe to quality changes
     */
    subscribe(listener: (quality: VideoQuality) => void): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    /**
     * Notify listeners
     */
    private notifyListeners(quality: VideoQuality): void {
        this.listeners.forEach(listener => listener(quality));
    }

    /**
     * Get quality settings
     */
    getSettings(): VideoQualitySettings {
        return { ...this.settings };
    }

    /**
     * Get quality ladder for streaming
     */
    getQualityLadder(): { quality: VideoQuality; width: number; height: number; bitrate: number }[] {
        const capabilities = this.getCapabilities();
        const bandwidth = this.getAverageBandwidth();

        const ladder = [
            { quality: '1080p' as VideoQuality, width: 1920, height: 1080, bitrate: 5000 },
            { quality: '720p' as VideoQuality, width: 1280, height: 720, bitrate: 2500 },
            { quality: '480p' as VideoQuality, width: 854, height: 480, bitrate: 1000 },
            { quality: '360p' as VideoQuality, width: 640, height: 360, bitrate: 500 },
            { quality: '240p' as VideoQuality, width: 426, height: 240, bitrate: 250 },
        ];

        // Filter based on device capabilities
        return ladder.filter(level => {
            // Check if device can decode this resolution
            if (level.height > Math.min(capabilities.maxWidth, capabilities.maxHeight)) {
                return false;
            }

            // Check bandwidth
            if (level.bitrate > bandwidth * 0.8) { // Use 80% of available
                return false;
            }

            return true;
        });
    }
}

export const videoQualityScaler = VideoQualityScaler.getInstance();
export type { VideoQuality, VideoQualitySettings, DeviceCapabilities, BandwidthEstimate };
