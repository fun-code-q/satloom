/**
 * Generates a minimal WAV file from raw audio data.
 * Useful for creating procedural sounds that can be played with HTML5 Audio.
 */
export function generateWavDataUri(frequency: number, duration: number, volume = 0.3, type: 'sine' | 'square' | 'sawtooth' = 'sine'): string {
    const sampleRate = 44100;
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    // RIFF identifier
    view.setUint32(0, 0x52494646, false); // "RIFF"
    // file length
    view.setUint32(4, 36 + numSamples * 2, true);
    // RIFF type
    view.setUint32(8, 0x57415645, false); // "WAVE"
    // format chunk identifier
    view.setUint32(12, 0x666d7420, false); // "fmt "
    // format chunk length
    view.setUint32(16, 16, true);
    // sample format (raw)
    view.setUint16(20, 1, true); // PCM
    // channel count
    view.setUint16(22, 1, true); // Mono
    // sample rate
    view.setUint32(24, sampleRate, true);
    // byte rate (sample rate * block align)
    view.setUint32(28, sampleRate * 2, true);
    // block align (channel count * bytes per sample)
    view.setUint16(32, 2, true);
    // bits per sample
    view.setUint16(34, 16, true);
    // data chunk identifier
    view.setUint32(36, 0x64617461, false); // "data"
    // data chunk length
    view.setUint32(40, numSamples * 2, true);

    // Generate samples
    for (let i = 0; i < numSamples; i++) {
        const time = i / sampleRate;
        let sample = 0;
        
        const angle = 2 * Math.PI * frequency * time;
        
        if (type === 'sine') {
            sample = Math.sin(angle);
        } else if (type === 'square') {
            sample = Math.sin(angle) >= 0 ? 1 : -1;
        } else if (type === 'sawtooth') {
            sample = 2 * (time * frequency - Math.floor(time * frequency + 0.5));
        }

        // Apply volume envelope (fade out to avoid clicks)
        const envelope = Math.min(1, (numSamples - i) / (sampleRate * 0.05));
        const finalSample = sample * volume * envelope;
        
        // Convert to 16-bit PCM
        const pcmValue = Math.max(-1, Math.min(1, finalSample)) * 0x7FFF;
        view.setInt16(44 + i * 2, pcmValue, true);
    }

    const blob = new Blob([buffer], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
}

/**
 * Generates a dual-tone ring tone common in telephony.
 */
export function generateCompositeRingWav(freq1: number, freq2: number, duration: number, volume = 0.2): string {
    const sampleRate = 44100;
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    view.setUint32(0, 0x52494646, false);
    view.setUint32(4, 36 + numSamples * 2, true);
    view.setUint32(8, 0x57415645, false);
    view.setUint32(12, 0x666d7420, false);
    view.setUint16(22, 1, true);
    view.setUint16(34, 16, true);
    view.setUint32(36, 0x64617461, false);
    view.setUint32(40, numSamples * 2, true);

    for (let i = 0; i < numSamples; i++) {
        const time = i / sampleRate;
        // Sum two sine waves
        const sample = (Math.sin(2 * Math.PI * freq1 * time) + Math.sin(2 * Math.PI * freq2 * time)) / 2;
        
        // Envelope fade out
        const envelope = Math.min(1, (numSamples - i) / (sampleRate * 0.05));
        const finalSample = sample * volume * envelope;
        
        view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, finalSample)) * 0x7FFF, true);
    }

    const blob = new Blob([buffer], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
}
