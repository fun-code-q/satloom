export class GameSounds {
  private static instance: GameSounds
  private audioContext: AudioContext | null = null
  private soundEnabled = true
  private isCleanupCalled = false

  static getInstance(): GameSounds {
    if (!GameSounds.instance) {
      GameSounds.instance = new GameSounds()
    }
    return GameSounds.instance
  }

  constructor() {
    this.initAudioContext()
  }

  private initAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    } catch (error) {
      console.warn("Audio context not supported:", error)
    }
  }

  setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled
  }

  private async playTone(frequency: number, duration: number, volume = 0.3, type: OscillatorType = "sine") {
    if (!this.soundEnabled || !this.audioContext) return

    try {
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume()
      }

      const oscillator = this.audioContext.createOscillator()
      const gainNode = this.audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(this.audioContext.destination)

      oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime)
      oscillator.type = type

      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime)
      gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01)
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration)

      oscillator.start(this.audioContext.currentTime)
      oscillator.stop(this.audioContext.currentTime + duration)
    } catch (error) {
      console.warn("Error playing tone:", error)
    }
  }

  // Game sound effects
  async playLineDrawn() {
    await this.playTone(800, 0.1, 0.2)
  }

  async playBoxCompleted() {
    await this.playTone(1200, 0.2, 0.3)
    setTimeout(() => this.playTone(1400, 0.2, 0.3), 100)
  }

  async playGameStart() {
    await this.playTone(600, 0.3, 0.3)
    setTimeout(() => this.playTone(800, 0.3, 0.3), 200)
    setTimeout(() => this.playTone(1000, 0.3, 0.3), 400)
  }

  async playGameEnd() {
    await this.playTone(1000, 0.5, 0.4)
    setTimeout(() => this.playTone(800, 0.5, 0.4), 300)
    setTimeout(() => this.playTone(600, 0.8, 0.4), 600)
  }

  async playTurnChange() {
    await this.playTone(500, 0.15, 0.2)
  }

  async playInvalidMove() {
    await this.playTone(200, 0.3, 0.3, "sawtooth")
  }

  async playWin() {
    const notes = [523, 659, 784, 1047] // C, E, G, C
    for (let i = 0; i < notes.length; i++) {
      setTimeout(() => this.playTone(notes[i], 0.4, 0.4), i * 200)
    }
  }

  async playLose() {
    await this.playTone(400, 0.6, 0.3)
    setTimeout(() => this.playTone(300, 0.8, 0.3), 400)
  }

  // Cleanup method to properly close AudioContext
  cleanup() {
    if (this.isCleanupCalled) return
    this.isCleanupCalled = true

    try {
      if (this.audioContext) {
        if (this.audioContext.state !== "closed") {
          this.audioContext.close().catch((error) => {
            console.warn("Error closing audio context:", error)
          })
        }
        this.audioContext = null
      }
    } catch (error) {
      console.warn("Error during game sounds cleanup:", error)
    }
  }
}

// Singleton instance cleanup on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    GameSounds.getInstance().cleanup()
  })
}
