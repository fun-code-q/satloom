/**
 * Knock Knock - Pre-Call Video Preview
 * 
 * Features like Google Duo:
 * - Pre-call video preview with filters
 * - "Knock knock" style interactions
 * - Camera/microphone preview
 * - Effects and filters selection
 */

export type KnockKnockState = 'idle' | 'preview' | 'calling' | 'ringing' | 'connected';

export interface KnockKnockConfig {
    showEffects: boolean;
    showFilters: boolean;
    showBackgrounds: boolean;
    autoPreview: boolean;
    mirrorPreview: boolean;
    countdownSeconds: number;
}

export interface KnockKnockEvent {
    type: 'preview_started' | 'preview_stopped' | 'call_started' | 'call_ended' | 'ringing' | 'connected' | 'effect_changed' | 'filter_changed' | 'background_changed';
    timestamp: number;
    data?: Record<string, unknown>;
}

export interface KnockKnockCallbacks {
    onPreviewStart?: (stream: MediaStream) => void;
    onPreviewStop?: () => void;
    onCallStart?: (roomId: string) => void;
    onCallEnd?: () => void;
    onRinging?: (callerInfo: { id: string; name: string; avatar?: string; roomId: string; timestamp: number }) => void;
    onConnected?: (participantInfo: { id: string; name: string; avatar?: string; isHost: boolean }) => void;
    onEffectChange?: (effect: string) => void;
    onFilterChange?: (filter: string) => void;
    onBackgroundChange?: (background: string) => void;
    onError?: (error: Error) => void;
}

export interface VideoEffect {
    id: string;
    name: string;
    icon: string;
    type: 'none' | 'blur' | 'grayscale' | 'sepia' | 'vintage' | 'cool' | 'warm';
}

export interface VideoFilter {
    id: string;
    name: string;
    icon: string;
    preview: string;
    cssFilter: string;
}

export interface VirtualBackground {
    id: string;
    name: string;
    icon: string;
    preview: string;
    type: 'blur' | 'image' | 'video';
    url?: string;
}

const DEFAULT_EFFECTS: VideoEffect[] = [
    { id: 'none', name: 'None', icon: '🚫', type: 'none' },
    { id: 'blur', name: 'Blur', icon: '🌫️', type: 'blur' },
    { id: 'grayscale', name: 'B&W', icon: '⬛', type: 'grayscale' },
    { id: 'sepia', name: 'Sepia', icon: '🟫', type: 'sepia' },
    { id: 'vintage', name: 'Vintage', icon: '📷', type: 'vintage' },
    { id: 'cool', name: 'Cool', icon: '❄️', type: 'cool' },
    { id: 'warm', name: 'Warm', icon: '🔥', type: 'warm' },
];

const DEFAULT_FILTERS: VideoFilter[] = [
    { id: 'none', name: 'None', icon: '🚫', preview: '', cssFilter: 'none' },
    { id: 'grayscale', name: 'Grayscale', icon: '⬛', preview: 'grayscale(100%)', cssFilter: 'grayscale(100%)' },
    { id: 'sepia', name: 'Sepia', icon: '🟫', preview: 'sepia(100%)', cssFilter: 'sepia(100%)' },
    { id: 'contrast', name: 'High Contrast', icon: '◼️', preview: 'contrast(150%)', cssFilter: 'contrast(150%)' },
    { id: 'brightness', name: 'Bright', icon: '☀️', preview: 'brightness(130%)', cssFilter: 'brightness(130%)' },
    { id: 'saturate', name: 'Vibrant', icon: '🌈', preview: 'saturate(150%)', cssFilter: 'saturate(150%)' },
    { id: 'hue-rotate', name: 'Hue', icon: '🎨', preview: 'hue-rotate(90deg)', cssFilter: 'hue-rotate(90deg)' },
];

const DEFAULT_BACKGROUNDS: VirtualBackground[] = [
    { id: 'blur', name: 'Blur', icon: '🌫️', preview: 'blur(20px)', type: 'blur' },
    { id: 'office', name: 'Office', icon: '🏢', preview: '/backgrounds/office.jpg', type: 'image' },
    { id: 'nature', name: 'Nature', icon: '🌿', preview: '/backgrounds/nature.jpg', type: 'image' },
    { id: 'beach', name: 'Beach', icon: '🏖️', preview: '/backgrounds/beach.jpg', type: 'image' },
    { id: 'city', name: 'City', icon: '🌃', preview: '/backgrounds/city.jpg', type: 'image' },
    { id: 'space', name: 'Space', icon: '🚀', preview: '/backgrounds/space.jpg', type: 'image' },
];

class KnockKnockManager {
    private static instance: KnockKnockManager;
    private state: KnockKnockState = 'idle';
    private previewStream: MediaStream | null = null;
    private videoElement: HTMLVideoElement | null = null;
    private canvasElement: HTMLCanvasElement | null = null;
    private currentEffect: string = 'none';
    private currentFilter: string = 'none';
    private currentBackground: string = 'blur';
    private callbacks: KnockKnockCallbacks = {};
    private events: KnockKnockEvent[] = [];
    private animationFrame: number | null = null;
    private roomId: string | null = null;
    private isMirrored: boolean = true;

    private config: KnockKnockConfig = {
        showEffects: true,
        showFilters: true,
        showBackgrounds: true,
        autoPreview: false,
        mirrorPreview: true,
        countdownSeconds: 3,
    };

    private constructor() { }

    static getInstance(): KnockKnockManager {
        if (!KnockKnockManager.instance) {
            KnockKnockManager.instance = new KnockKnockManager();
        }
        return KnockKnockManager.instance;
    }

    /**
     * Configure knock knock settings
     */
    configure(config: Partial<KnockKnockConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Set callbacks
     */
    setCallbacks(callbacks: KnockKnockCallbacks): void {
        this.callbacks = { ...this.callbacks, ...callbacks };
    }

    /**
     * Start video preview
     */
    async startPreview(videoElement: HTMLVideoElement): Promise<MediaStream | null> {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
                audio: { echoCancellation: true, noiseSuppression: true },
            });

            this.previewStream = stream;
            this.videoElement = videoElement;

            videoElement.srcObject = stream;
            await videoElement.play();

            this.canvasElement = document.createElement('canvas');
            this.canvasElement.width = videoElement.videoWidth || 1280;
            this.canvasElement.height = videoElement.videoHeight || 720;

            this.applyEffect(videoElement);

            this.state = 'preview';
            this.emitEvent('preview_started', { hasAudio: stream.getAudioTracks().length > 0 });

            if (this.callbacks.onPreviewStart) {
                this.callbacks.onPreviewStart(stream);
            }

            return stream;
        } catch (error) {
            console.error('Failed to start preview:', error);
            if (this.callbacks.onError) {
                this.callbacks.onError(error as Error);
            }
            return null;
        }
    }

    /**
     * Stop video preview
     */
    stopPreview(): void {
        if (this.previewStream) {
            this.previewStream.getTracks().forEach(track => track.stop());
            this.previewStream = null;
        }

        if (this.videoElement) {
            this.videoElement.srcObject = null;
            this.videoElement = null;
        }

        if (this.canvasElement) {
            this.canvasElement = null;
        }

        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }

        this.state = 'idle';
        this.emitEvent('preview_stopped');

        if (this.callbacks.onPreviewStop) {
            this.callbacks.onPreviewStop();
        }
    }

    /**
     * Apply effect to video
     */
    private applyEffect(videoElement: HTMLVideoElement): void {
        if (!videoElement) return;

        const apply = () => {
            if (!this.videoElement || !this.canvasElement) return;

            const ctx = this.canvasElement.getContext('2d');
            if (!ctx) return;

            ctx.save();

            if (this.isMirrored) {
                ctx.translate(this.canvasElement.width, 0);
                ctx.scale(-1, 1);
            }

            ctx.drawImage(videoElement, 0, 0, this.canvasElement.width, this.canvasElement.height);
            ctx.restore();

            const filter = this.getFilterCSS(this.currentFilter);
            if (filter !== 'none') {
                ctx.filter = filter;
                ctx.drawImage(videoElement, 0, 0, this.canvasElement.width, this.canvasElement.height);
                ctx.filter = 'none';
            }

            this.animationFrame = requestAnimationFrame(apply);
        };

        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        apply();
    }

    /**
     * Get CSS filter string
     */
    private getFilterCSS(filterId: string): string {
        const filter = DEFAULT_FILTERS.find(f => f.id === filterId);
        return filter?.cssFilter || 'none';
    }

    /**
     * Set video effect
     */
    setEffect(effectId: string): void {
        this.currentEffect = effectId;
        this.emitEvent('effect_changed', { effect: effectId });

        if (this.callbacks.onEffectChange) {
            this.callbacks.onEffectChange(effectId);
        }
    }

    /**
     * Set video filter
     */
    setFilter(filterId: string): void {
        this.currentFilter = filterId;
        this.emitEvent('filter_changed', { filter: filterId });

        if (this.callbacks.onFilterChange) {
            this.callbacks.onFilterChange(filterId);
        }
    }

    /**
     * Set virtual background
     */
    setBackground(backgroundId: string): void {
        this.currentBackground = backgroundId;
        this.emitEvent('background_changed', { background: backgroundId });

        if (this.callbacks.onBackgroundChange) {
            this.callbacks.onBackgroundChange(backgroundId);
        }
    }

    /**
     * Toggle mirror
     */
    toggleMirror(): void {
        this.isMirrored = !this.isMirrored;
    }

    /**
     * Get mirror state
     */
    isMirroredEnabled(): boolean {
        return this.isMirrored;
    }

    /**
     * Start a call
     */
    async startCall(roomId: string): Promise<string | null> {
        if (!this.previewStream) {
            if (this.videoElement) {
                await this.startPreview(this.videoElement);
            } else {
                return null;
            }
        }

        this.roomId = roomId;
        this.state = 'calling';
        this.emitEvent('call_started', { roomId });

        if (this.callbacks.onCallStart) {
            this.callbacks.onCallStart(roomId);
        }

        setTimeout(() => {
            this.state = 'ringing';
            this.emitEvent('ringing', { roomId });

            if (this.callbacks.onRinging) {
                this.callbacks.onRinging({
                    id: 'caller',
                    name: 'Unknown Caller',
                    roomId,
                    timestamp: Date.now(),
                });
            }
        }, this.config.countdownSeconds * 1000);

        return roomId;
    }

    /**
     * End call
     */
    endCall(): void {
        this.stopPreview();
        this.state = 'idle';
        this.roomId = null;
        this.emitEvent('call_ended');

        if (this.callbacks.onCallEnd) {
            this.callbacks.onCallEnd();
        }
    }

    /**
     * Simulate incoming call
     */
    simulateIncomingCall(callerInfo: { id: string; name: string; avatar?: string; roomId: string; timestamp: number }): void {
        this.state = 'ringing';
        this.emitEvent('ringing', { ...callerInfo });

        if (this.callbacks.onRinging) {
            this.callbacks.onRinging(callerInfo);
        }
    }

    /**
     * Accept call
     */
    async acceptCall(): Promise<void> {
        if (this.state !== 'ringing') return;

        this.state = 'connected';
        this.emitEvent('connected', { isHost: false });

        if (this.callbacks.onConnected) {
            this.callbacks.onConnected({
                id: 'participant',
                name: 'You',
                isHost: false,
            });
        }
    }

    /**
     * Get current state
     */
    getState(): KnockKnockState {
        return this.state;
    }

    /**
     * Get current preview stream
     */
    getPreviewStream(): MediaStream | null {
        return this.previewStream;
    }

    /**
     * Get available effects
     */
    getEffects(): VideoEffect[] {
        return this.config.showEffects ? DEFAULT_EFFECTS : [];
    }

    /**
     * Get available filters
     */
    getFilters(): VideoFilter[] {
        return this.config.showFilters ? DEFAULT_FILTERS : [];
    }

    /**
     * Get available backgrounds
     */
    getBackgrounds(): VirtualBackground[] {
        return this.config.showBackgrounds ? DEFAULT_BACKGROUNDS : [];
    }

    /**
     * Get current effect
     */
    getCurrentEffect(): string {
        return this.currentEffect;
    }

    /**
     * Get current filter
     */
    getCurrentFilter(): string {
        return this.currentFilter;
    }

    /**
     * Get current background
     */
    getCurrentBackground(): string {
        return this.currentBackground;
    }

    /**
     * Get events history
     */
    getEvents(): KnockKnockEvent[] {
        return [...this.events];
    }

    /**
     * Emit event
     */
    private emitEvent(type: KnockKnockEvent['type'], data?: Record<string, unknown>): void {
        const event: KnockKnockEvent = {
            type,
            timestamp: Date.now(),
            data,
        };
        this.events.push(event);

        if (this.events.length > 100) {
            this.events = this.events.slice(-100);
        }
    }

    /**
     * Get config
     */
    getConfig(): KnockKnockConfig {
        return { ...this.config };
    }

    /**
     * Take preview snapshot
     */
    takeSnapshot(): string | null {
        if (!this.canvasElement) return null;
        return this.canvasElement.toDataURL('image/png');
    }

    /**
     * Get video element
     */
    getVideoElement(): HTMLVideoElement | null {
        return this.videoElement;
    }

    /**
     * Get canvas element
     */
    getCanvasElement(): HTMLCanvasElement | null {
        return this.canvasElement;
    }

    /**
     * Check if camera is available
     */
    async isCameraAvailable(): Promise<boolean> {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.some(d => d.kind === 'videoinput');
        } catch {
            return false;
        }
    }

    /**
     * Check if microphone is available
     */
    async isMicrophoneAvailable(): Promise<boolean> {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.some(d => d.kind === 'audioinput');
        } catch {
            return false;
        }
    }

    /**
     * Cleanup
     */
    destroy(): void {
        this.stopPreview();
        this.callbacks = {};
        this.events = [];
        this.state = 'idle';
        this.roomId = null;
    }
}

export const knockKnockManager = KnockKnockManager.getInstance();

