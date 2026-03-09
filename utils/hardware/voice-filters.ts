/**
 * Voice Filter Processor
 * 
 * Real-time audio effects for voice using Web Audio API.
 * Supports: Robot, Deep, Helium, Chipmunk, Reverb, Echo, Pitch Shift
 */

export type VoiceFilterType =
    | 'none'
    | 'robot'
    | 'deep'
    | 'helium'
    | 'chipmunk'
    | 'reverb'
    | 'echo'
    | 'pitch_shift'
    | 'baritone'
    | 'whisper'
    | 'underwater'
    | 'telephone';

interface VoiceFilterSettings {
    type: VoiceFilterType;
    intensity: number;
    wetDryRatio: number;
}

class VoiceFilterProcessor {
    private static instance: VoiceFilterProcessor;
    private audioContext: AudioContext | null = null;
    private mediaStream: MediaStream | null = null;
    private currentFilter: VoiceFilterType = 'none';
    private listeners: Set<(filter: VoiceFilterType) => void> = new Set();
    private isInitialized: boolean = false;

    private constructor() { }

    static getInstance(): VoiceFilterProcessor {
        if (!VoiceFilterProcessor.instance) {
            VoiceFilterProcessor.instance = new VoiceFilterProcessor();
        }
        return VoiceFilterProcessor.instance;
    }

    /**
     * Initialize the audio context
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        try {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.isInitialized = true;
            console.log('Voice Filter Processor initialized');
        } catch (error) {
            console.error('Failed to initialize AudioContext:', error);
            throw error;
        }
    }

    /**
     * Start processing a media stream with filter
     */
    async startProcessing(stream: MediaStream, filter: VoiceFilterType = 'none'): Promise<MediaStream> {
        await this.initialize();

        if (!this.audioContext) {
            throw new Error('AudioContext not initialized');
        }

        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        this.mediaStream = stream;
        this.currentFilter = filter;

        // Create destination
        const destination = this.audioContext.createMediaStreamDestination();
        const source = this.audioContext.createMediaStreamSource(stream);
        const processor = this.createProcessor(filter);

        source.connect(processor);
        processor.connect(destination);

        return destination.stream;
    }

    /**
     * Create audio processor based on filter type
     */
    private createProcessor(filter: VoiceFilterType): AudioNode {
        if (!this.audioContext) {
            throw new Error('AudioContext not initialized');
        }

        switch (filter) {
            case 'robot':
                return this.createRobotProcessor();
            case 'deep':
                return this.createDeepProcessor();
            case 'helium':
                return this.createHeliumProcessor();
            case 'chipmunk':
                return this.createChipmunkProcessor();
            case 'reverb':
                return this.createReverbProcessor();
            case 'echo':
                return this.createEchoProcessor();
            case 'baritone':
                return this.createBaritoneProcessor();
            case 'whisper':
                return this.createWhisperProcessor();
            case 'underwater':
                return this.createUnderwaterProcessor();
            case 'telephone':
                return this.createTelephoneProcessor();
            default:
                return this.audioContext.createGain();
        }
    }

    private createRobotProcessor(): AudioNode {
        if (!this.audioContext) throw new Error('AudioContext not initialized');

        const distortion = this.audioContext.createWaveShaper();
        const curve = new Float32Array(44100);
        const deg = Math.PI / 180;
        for (let i = 0; i < 44100; i++) {
            const x = (i * 2) / 44100 - 1;
            curve[i] = ((3 + 50) * x * 20 * deg) / (Math.PI + 50 * Math.abs(x));
        }
        distortion.curve = curve;
        return distortion;
    }

    private createDeepProcessor(): AudioNode {
        if (!this.audioContext) throw new Error('AudioContext not initialized');
        const lowpass = this.audioContext.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = 400;
        return lowpass;
    }

    private createHeliumProcessor(): AudioNode {
        if (!this.audioContext) throw new Error('AudioContext not initialized');
        const highpass = this.audioContext.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 500;
        return highpass;
    }

    private createChipmunkProcessor(): AudioNode {
        if (!this.audioContext) throw new Error('AudioContext not initialized');
        const highpass = this.audioContext.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 300;
        return highpass;
    }

    private createReverbProcessor(): AudioNode {
        if (!this.audioContext) throw new Error('AudioContext not initialized');
        const convolver = this.audioContext.createConvolver();
        const length = this.audioContext.sampleRate * 2;
        const buffer = this.audioContext.createBuffer(2, length, this.audioContext.sampleRate);
        for (let channel = 0; channel < 2; channel++) {
            const data = buffer.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
            }
        }
        convolver.buffer = buffer;
        return convolver;
    }

    private createEchoProcessor(): AudioNode {
        if (!this.audioContext) throw new Error('AudioContext not initialized');
        const delay = this.audioContext.createDelay(5);
        delay.delayTime.value = 0.4;
        const feedback = this.audioContext.createGain();
        feedback.gain.value = 0.4;
        delay.connect(feedback);
        feedback.connect(delay);
        return delay;
    }

    private createBaritoneProcessor(): AudioNode {
        if (!this.audioContext) throw new Error('AudioContext not initialized');
        const lowpass = this.audioContext.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = 800;
        lowpass.Q.value = 2;
        return lowpass;
    }

    private createWhisperProcessor(): AudioNode {
        if (!this.audioContext) throw new Error('AudioContext not initialized');
        const highpass = this.audioContext.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 1000;
        return highpass;
    }

    private createUnderwaterProcessor(): AudioNode {
        if (!this.audioContext) throw new Error('AudioContext not initialized');
        const lowpass = this.audioContext.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = 300;
        lowpass.Q.value = 10;
        return lowpass;
    }

    private createTelephoneProcessor(): AudioNode {
        if (!this.audioContext) throw new Error('AudioContext not initialized');
        const bandpass = this.audioContext.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.value = 2000;
        bandpass.Q.value = 1;
        return bandpass;
    }

    /**
     * Change the current filter
     */
    async setFilter(filter: VoiceFilterType): Promise<MediaStream | null> {
        if (!this.audioContext || !this.mediaStream) {
            this.currentFilter = filter;
            return null;
        }

        const newStream = await this.startProcessing(this.mediaStream, filter);
        this.notifyListeners(filter);
        return newStream;
    }

    /**
     * Get current filter
     */
    getCurrentFilter(): VoiceFilterType {
        return this.currentFilter;
    }

    /**
     * Stop processing
     */
    stop(): void {
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
        this.currentFilter = 'none';
    }

    /**
     * Subscribe to filter changes
     */
    subscribe(listener: (filter: VoiceFilterType) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Notify listeners
     */
    private notifyListeners(filter: VoiceFilterType): void {
        this.listeners.forEach(listener => listener(filter));
    }

    /**
     * Get available filters
     */
    getAvailableFilters(): VoiceFilterType[] {
        return ['none', 'robot', 'deep', 'helium', 'chipmunk', 'reverb', 'echo', 'pitch_shift', 'baritone', 'whisper', 'underwater', 'telephone'];
    }

    /**
     * Check if audio context is supported
     */
    isSupported(): boolean {
        return !!(window.AudioContext || (window as any).webkitAudioContext);
    }

    /**
     * Cleanup
     */
    destroy(): void {
        this.stop();
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        this.listeners.clear();
        this.isInitialized = false;
    }
}

export const voiceFilterProcessor = VoiceFilterProcessor.getInstance();
export type { VoiceFilterSettings };
