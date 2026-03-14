import { generateCompositeRingWav } from "./audio-utility";

/**
 * Audio Notification Manager
 * 
 * Handles playing ringtones and notification sounds for calls using HTML5 Audio.
 */
class AudioNotificationManager {
  private static instance: AudioNotificationManager;
  private incomingRing: HTMLAudioElement | null = null;
  private outgoingRing: HTMLAudioElement | null = null;

  private constructor() {}

  static getInstance(): AudioNotificationManager {
    if (!AudioNotificationManager.instance) {
      AudioNotificationManager.instance = new AudioNotificationManager();
    }
    return AudioNotificationManager.instance;
  }

  /**
   * Generates a procedurally generated ringtone if no audio file is provided.
   */
  private createRingtone(type: 'incoming' | 'outgoing'): HTMLAudioElement {
    const audio = new Audio();
    
    // Fallback procedural sounds
    if (type === 'incoming') {
      // UK/Europe style double ring: 400Hz + 450Hz
      audio.src = generateCompositeRingWav(400, 450, 1.2, 0.3);
    } else {
      // US style single ring: 440Hz + 480Hz
      audio.src = generateCompositeRingWav(440, 480, 2.0, 0.2);
    }
    
    audio.loop = true;
    return audio;
  }

  startIncomingRing() {
    this.stopAll();
    
    // In a real app we'd try to load a file first:
    // try { this.incomingRing = new Audio("/sounds/ringtone-in.mp3"); ... }
    
    this.incomingRing = this.createRingtone('incoming');
    this.incomingRing.play().catch(err => {
      console.warn("AudioNotificationManager: Failed to play incoming ring", err);
    });
  }

  startOutgoingRing() {
    this.stopAll();
    this.outgoingRing = this.createRingtone('outgoing');
    this.outgoingRing.play().catch(err => {
      console.warn("AudioNotificationManager: Failed to play outgoing ring", err);
    });
  }

  stopAll() {
    if (this.incomingRing) {
      this.incomingRing.pause();
      if (this.incomingRing.src.startsWith('blob:')) {
        URL.revokeObjectURL(this.incomingRing.src);
      }
      this.incomingRing = null;
    }
    
    if (this.outgoingRing) {
      this.outgoingRing.pause();
      if (this.outgoingRing.src.startsWith('blob:')) {
        URL.revokeObjectURL(this.outgoingRing.src);
      }
      this.outgoingRing = null;
    }
  }
}

export const audioNotificationManager = AudioNotificationManager.getInstance();
