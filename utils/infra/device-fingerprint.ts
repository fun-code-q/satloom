/**
 * Device Fingerprinting System
 * 
 * Creates unique device identifiers for user tracking and banning.
 * Uses browser fingerprinting techniques without storing personal data.
 */

export interface DeviceFingerprint {
    id: string;
    hash: string;
    components: FingerprintComponents;
    createdAt: number;
    lastSeen: number;
    confidence: number;
}

export interface FingerprintComponents {
    userAgent: string;
    platform: string;
    language: string;
    timezone: string;
    screenResolution: string;
    colorDepth: number;
    pixelRatio: number;
    hardwareConcurrency: number;
    deviceMemory: number;
    touchSupport: boolean;
    canvasFingerprint: string;
    audioFingerprint: string;
    webglVendor: string;
    webglRenderer: string;
    plugins: string[];
    mimeTypes: string[];
    fonts: string[];
    doNotTrack: boolean | null;
    cookiesEnabled: boolean;
    localStorageEnabled: boolean;
    sessionStorageEnabled: boolean;
    indexedDBEnabled: boolean;
    platformNavigator: string;
    vendor: string;
    appName: string;
    appVersion: string;
    product: string;
    buildID: string;
    oscpu: string;
    connectionType: string;
}

export interface BanInfo {
    deviceId: string;
    reason: string;
    bannedAt: number;
    expiresAt?: number;
    bannedBy?: string;
    evidence?: string[];
}

interface BannedDevice {
    fingerprint: DeviceFingerprint;
    banInfo: BanInfo;
}

interface BanConfig {
    autoExpire: boolean;
    defaultBanDuration: number; // milliseconds
    maxSuspiciousScore: number;
    logAllFingerprints: boolean;
}

interface SuspiciousActivity {
    type: string;
    timestamp: number;
    details: string;
}

class DeviceFingerprintManager {
    private static instance: DeviceFingerprintManager;
    private currentFingerprint: DeviceFingerprint | null = null;
    private bannedDevices: Map<string, BannedDevice> = new Map();
    private suspiciousActivity: SuspiciousActivity[] = [];
    private config: BanConfig = {
        autoExpire: false,
        defaultBanDuration: 7 * 24 * 60 * 60 * 1000, // 7 days
        maxSuspiciousScore: 100,
        logAllFingerprints: true,
    };
    private listeners: Set<(event: string, data: unknown) => void> = new Set();
    private fingerprintId: string | null = null;

    private constructor() { }

    static getInstance(): DeviceFingerprintManager {
        if (!DeviceFingerprintManager.instance) {
            DeviceFingerprintManager.instance = new DeviceFingerprintManager();
        }
        return DeviceFingerprintManager.instance;
    }

    /**
     * Generate device fingerprint
     */
    async generateFingerprint(): Promise<DeviceFingerprint> {
        const components = await this.collectComponents();
        const hash = await this.hashComponents(components);
        const id = this.generateId(hash);

        this.currentFingerprint = {
            id,
            hash,
            components,
            createdAt: Date.now(),
            lastSeen: Date.now(),
            confidence: this.calculateConfidence(components),
        };

        this.fingerprintId = id;

        return this.currentFingerprint;
    }

    /**
     * Collect all fingerprinting components
     */
    private async collectComponents(): Promise<FingerprintComponents> {
        if (typeof window === "undefined") {
            // Return dummy components for SSR
            return {} as FingerprintComponents;
        }

        const nav = navigator;
        const screen = window.screen;

        const components: FingerprintComponents = {
            userAgent: nav.userAgent,
            platform: nav.platform,
            language: nav.language,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            screenResolution: `${screen.width}x${screen.height}`,
            colorDepth: screen.colorDepth,
            pixelRatio: window.devicePixelRatio,
            hardwareConcurrency: nav.hardwareConcurrency || 0,
            deviceMemory: (nav as any).deviceMemory || 0,
            touchSupport: 'ontouchstart' in window || (nav as any).maxTouchPoints > 0,
            canvasFingerprint: await this.getCanvasFingerprint(),
            audioFingerprint: await this.getAudioFingerprint(),
            webglVendor: this.getWebGLVendor(),
            webglRenderer: this.getWebGLRenderer(),
            plugins: this.getPlugins(),
            mimeTypes: this.getMimeTypes(),
            fonts: await this.getFonts(),
            doNotTrack: (nav.doNotTrack as '1' | '0' | null) === '1' ? true : (nav.doNotTrack as '1' | '0' | null) === '0' ? false : null,
            cookiesEnabled: nav.cookieEnabled,
            localStorageEnabled: this.testLocalStorage(),
            sessionStorageEnabled: this.testSessionStorage(),
            indexedDBEnabled: this.testIndexedDB(),
            platformNavigator: (nav as any).platform || '',
            vendor: nav.vendor || '',
            appName: nav.appName,
            appVersion: nav.appVersion,
            product: nav.product,
            buildID: (nav as any).buildID || '',
            oscpu: (nav as any).oscpu || '',
            connectionType: this.getConnectionType(),
        };

        return components;
    }

    /**
     * Get canvas fingerprint
     */
    private async getCanvasFingerprint(): Promise<string> {
        if (typeof document === "undefined") return "not-available";
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 50;
        const ctx = canvas.getContext('2d');

        if (!ctx) return 'not-available';

        // Draw various elements
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('Fingerprint', 2, 15);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('Test', 4, 17);

        // Get data URL
        const dataUrl = canvas.toDataURL();

        // Hash it
        return await this.simpleHash(dataUrl);
    }

    /**
     * Get audio fingerprint
     */
    private async getAudioFingerprint(): Promise<string> {
        if (typeof window === "undefined") return "not-available";
        try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const analyser = audioContext.createAnalyser();
            const gainNode = audioContext.createGain();
            const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);

            oscillator.type = 'triangle';
            oscillator.connect(analyser);
            analyser.connect(scriptProcessor);
            scriptProcessor.connect(audioContext.destination);

            const fingerprint = await new Promise<string>((resolve) => {
                scriptProcessor.onaudioprocess = (event) => {
                    const data = event.inputBuffer.getChannelData(0);
                    let sum = 0;
                    for (let i = 0; i < data.length; i++) {
                        sum += Math.abs(data[i]);
                    }
                    resolve(sum.toString());
                };
                oscillator.start();
            });

            oscillator.stop();
            audioContext.close();

            return await this.simpleHash(fingerprint);
        } catch {
            return 'not-available';
        }
    }

    /**
     * Get WebGL vendor
     */
    private getWebGLVendor(): string {
        try {
            if (typeof document === "undefined") return "not-available";
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (!gl) return 'not-available';

            const debugInfo = (gl as any).getExtension('WEBGL_debug_renderer_info');
            if (!debugInfo) return 'not-available';

            return (gl as any).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        } catch {
            return 'not-available';
        }
    }

    /**
     * Get WebGL renderer
     */
    private getWebGLRenderer(): string {
        try {
            if (typeof document === "undefined") return "not-available";
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (!gl) return 'not-available';

            const debugInfo = (gl as any).getExtension('WEBGL_debug_renderer_info');
            if (!debugInfo) return 'not-available';

            return (gl as any).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        } catch {
            return 'not-available';
        }
    }

    /**
     * Get installed plugins
     */
    private getPlugins(): string[] {
        const plugins = navigator.plugins;
        return Array.from(plugins).map(p => `${p.name}`).filter(Boolean);
    }

    /**
     * Get MIME types
     */
    private getMimeTypes(): string[] {
        const mimeTypes = navigator.mimeTypes;
        return Array.from(mimeTypes).map(m => m.type).filter(Boolean);
    }

    /**
     * Get installed fonts
     */
    private async getFonts(): Promise<string[]> {
        if (typeof document === "undefined") return [];
        const fontList = [
            'Arial', 'Arial Black', 'Arial Narrow', 'Calibri', 'Cambria',
            'Comic Sans MS', 'Consolas', 'Courier', 'Courier New', 'Georgia',
            'Helvetica', 'Impact', 'Lucida Console', 'Lucida Sans Unicode',
            'Microsoft Sans Serif', 'Monaco', 'Palatino Linotype', 'Segoe UI',
            'Tahoma', 'Times', 'Times New Roman', 'Trebuchet MS', 'Verdana'
        ];

        const testString = 'mmmmmmmmmmlli';
        const testSize = '72px';
        const body = document.body;

        const spans: HTMLElement[] = [];
        const detected: string[] = [];

        fontList.forEach(font => {
            const span = document.createElement('span');
            span.style.fontSize = testSize;
            span.style.position = 'absolute';
            span.style.left = '-9999px';
            span.style.visibility = 'hidden';
            span.textContent = testString;
            span.style.fontFamily = 'sans-serif';
            body.appendChild(span);
            const defaultWidth = span.offsetWidth;

            span.style.fontFamily = `"${font}", sans-serif`;
            if (span.offsetWidth !== defaultWidth) {
                detected.push(font);
            }
            body.removeChild(span);
        });

        return detected;
    }

    /**
     * Test local storage
     */
    private testLocalStorage(): boolean {
        try {
            localStorage.setItem('test', 'test');
            localStorage.removeItem('test');
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Test session storage
     */
    private testSessionStorage(): boolean {
        try {
            sessionStorage.setItem('test', 'test');
            sessionStorage.removeItem('test');
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Test indexedDB
     */
    private testIndexedDB(): boolean {
        return 'indexedDB' in window;
    }

    /**
     * Get connection type
     */
    private getConnectionType(): string {
        const nav = navigator as any;
        if (nav.connection) {
            return nav.connection.effectiveType || nav.connection.type || 'unknown';
        }
        return 'unknown';
    }

    /**
     * Hash components
     */
    private async hashComponents(components: FingerprintComponents): Promise<string> {
        const str = JSON.stringify(components);
        return await this.simpleHash(str);
    }

    /**
     * Simple hash function
     */
    private async simpleHash(str: string): Promise<string> {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }

    /**
     * Generate ID from hash
     */
    private generateId(hash: string): string {
        return `fp_${hash}_${Date.now().toString(36)}`;
    }

    /**
     * Calculate confidence score
     */
    private calculateConfidence(components: FingerprintComponents): number {
        // Higher score = more unique
        let score = 0;

        if (components.canvasFingerprint !== 'not-available') score += 20;
        if (components.audioFingerprint !== 'not-available') score += 15;
        if (components.webglRenderer !== 'not-available') score += 15;
        if (components.hardwareConcurrency > 0) score += 10;
        if (components.deviceMemory > 0) score += 10;
        if (components.fonts.length > 15) score += 15;
        if (components.touchSupport) score += 5;
        if (!components.doNotTrack) score += 10;

        return Math.min(score, 100);
    }

    /**
     * Get current fingerprint
     */
    getCurrentFingerprint(): DeviceFingerprint | null {
        return this.currentFingerprint;
    }

    /**
     * Get fingerprint ID
     */
    getFingerprintId(): string | null {
        return this.fingerprintId;
    }

    /**
     * Check if device is banned
     */
    isBanned(fingerprintId?: string): { banned: boolean; banInfo?: BanInfo } {
        const id = fingerprintId || this.fingerprintId;
        if (!id) return { banned: false };

        const bannedDevice = this.bannedDevices.get(id);
        if (!bannedDevice) return { banned: false };

        // Check if ban has expired
        if (bannedDevice.banInfo.expiresAt && bannedDevice.banInfo.expiresAt < Date.now()) {
            this.unban(id);
            return { banned: false };
        }

        return { banned: true, banInfo: bannedDevice.banInfo };
    }

    /**
     * Ban a device
     */
    banDevice(fingerprintId: string, reason: string, options?: {
        duration?: number;
        evidence?: string[];
        bannedBy?: string;
    }): BanInfo {
        const banInfo: BanInfo = {
            deviceId: fingerprintId,
            reason,
            bannedAt: Date.now(),
            evidence: options?.evidence,
            bannedBy: options?.bannedBy,
        };

        if (options?.duration) {
            banInfo.expiresAt = Date.now() + options.duration;
        } else if (this.config.autoExpire) {
            banInfo.expiresAt = Date.now() + this.config.defaultBanDuration;
        }

        this.bannedDevices.set(fingerprintId, {
            fingerprint: this.currentFingerprint!,
            banInfo,
        });

        this.notifyListeners('ban', { fingerprintId, banInfo });
        return banInfo;
    }

    /**
     * Unban a device
     */
    unban(fingerprintId: string): boolean {
        const result = this.bannedDevices.delete(fingerprintId);
        if (result) {
            this.notifyListeners('unban', { fingerprintId });
        }
        return result;
    }

    /**
     * Get all banned devices
     */
    getBannedDevices(): BannedDevice[] {
        return Array.from(this.bannedDevices.values());
    }

    /**
     * Report suspicious activity
     */
    reportSuspiciousActivity(type: string, details: string): void {
        const activity: SuspiciousActivity = {
            type,
            timestamp: Date.now(),
            details,
        };

        this.suspiciousActivity.push(activity);
        this.notifyListeners('suspicious', activity);

        // Auto-ban if too many suspicious activities
        if (this.suspiciousActivity.length >= this.config.maxSuspiciousScore) {
            if (this.fingerprintId) {
                this.banDevice(this.fingerprintId, 'Automatic ban: Suspicious activity threshold exceeded');
            }
        }
    }

    /**
     * Get suspicious activity
     */
    getSuspiciousActivity(): SuspiciousActivity[] {
        return [...this.suspiciousActivity];
    }

    /**
     * Configure ban settings
     */
    configure(config: Partial<BanConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Subscribe to events
     */
    subscribe(listener: (event: string, data: unknown) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Notify listeners
     */
    private notifyListeners(event: string, data: unknown): void {
        this.listeners.forEach(listener => listener(event, data));
    }

    /**
     * Export fingerprint data (for debugging/admin)
     */
    exportData(): {
        fingerprint: DeviceFingerprint | null;
        bannedCount: number;
        suspiciousCount: number;
    } {
        return {
            fingerprint: this.currentFingerprint,
            bannedCount: this.bannedDevices.size,
            suspiciousCount: this.suspiciousActivity.length,
        };
    }

    /**
     * Clear all data
     */
    clear(): void {
        this.currentFingerprint = null;
        this.fingerprintId = null;
        this.bannedDevices.clear();
        this.suspiciousActivity = [];
    }

    /**
     * Get config
     */
    getConfig(): BanConfig {
        return { ...this.config };
    }

    /**
     * Cleanup
     */
    destroy(): void {
        this.clear();
        this.listeners.clear();
    }
}

export const deviceFingerprintManager = DeviceFingerprintManager.getInstance();
export type { BanConfig, SuspiciousActivity };
