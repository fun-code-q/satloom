import { generateWavDataUri } from "../hardware/audio-utility"

export class GameSounds {
  private static instance: GameSounds
  private audioCache: Map<string, HTMLAudioElement> = new Map()
  private soundEnabled = true
  private isCleanupCalled = false

  static getInstance(): GameSounds {
    if (!GameSounds.instance) {
      GameSounds.instance = new GameSounds()
    }
    return GameSounds.instance
  }

  constructor() {}

  setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled
  }

  private async playTone(frequency: number, duration: number, volume = 0.3, type: 'sine' | 'square' | 'sawtooth' = "sine") {
    if (!this.soundEnabled) return

    try {
      const key = `${frequency}-${duration}-${volume}-${type}`
      let audio = this.audioCache.get(key)
      
      if (!audio) {
        const url = generateWavDataUri(frequency, duration, volume, type)
        audio = new Audio(url)
        this.audioCache.set(key, audio)
      }

      audio.currentTime = 0
      await audio.play().catch(e => {
        if (e.name !== "AbortError") console.warn("Error playing game sound:", e)
      })
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

  // Cleanup method to revoke all blob URLs
  cleanup() {
    if (this.isCleanupCalled) return
    this.isCleanupCalled = true

    // Revoke all blob URLs in cache
    this.audioCache.forEach(audio => {
      if (audio.src.startsWith('blob:')) {
        URL.revokeObjectURL(audio.src)
      }
    })
    this.audioCache.clear()
  }
}

// Singleton instance cleanup on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    GameSounds.getInstance().cleanup()
  })
}
