export class NotificationSystem {
  private static instance: NotificationSystem
  private audioContext: AudioContext | null = null
  private notificationsEnabled = true
  private soundEnabled = true
  private permissionRequested = false
  private isCleanupCalled = false

  static getInstance(): NotificationSystem {
    if (!NotificationSystem.instance) {
      NotificationSystem.instance = new NotificationSystem()
    }
    return NotificationSystem.instance
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

  setNotificationsEnabled(enabled: boolean) {
    this.notificationsEnabled = enabled
  }

  setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled
  }

  private vibrationEnabled = true

  setVibrationEnabled(enabled: boolean) {
    this.vibrationEnabled = enabled
  }

  vibrate(pattern: number[]) {
    if (!this.vibrationEnabled || !("vibrate" in navigator)) return
    try {
      navigator.vibrate(pattern)
    } catch (e) {
      console.warn("Vibration failed:", e)
    }
  }

  private async playTone(frequency: number, duration: number, volume = 0.3) {
    if (!this.soundEnabled || !this.audioContext) return

    try {
      // Resume audio context if suspended
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume()
      }

      const oscillator = this.audioContext.createOscillator()
      const gainNode = this.audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(this.audioContext.destination)

      oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime)
      oscillator.type = "sine"

      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime)
      gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01)
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration)

      this.notifyAudioActivity(true)

      oscillator.start(this.audioContext.currentTime)
      oscillator.stop(this.audioContext.currentTime + duration)

      setTimeout(() => {
        this.notifyAudioActivity(false)
      }, duration * 1000 + 100)
    } catch (error) {
      console.warn("Error playing tone:", error)
      this.notifyAudioActivity(false)
    }
  }

  private showNotification(title: string, body: string, icon?: string) {
    if (!this.notificationsEnabled) return

    try {
      if ("Notification" in window && Notification.permission === "granted") {
        const notification = new Notification(title, {
          body,
          icon: icon || "/favicon.ico",
          badge: "/favicon.ico",
          tag: "satloom-notification",
          requireInteraction: false,
        })

        // Auto-close after 5 seconds
        setTimeout(() => {
          notification.close()
        }, 5000)
      }
    } catch (error) {
      console.warn("Error showing notification:", error)
    }
  }

  async requestPermission() {
    if (!("Notification" in window)) {
      console.warn("This browser does not support notifications")
      return false
    }

    if (this.permissionRequested) return Notification.permission === "granted"

    this.permissionRequested = true

    try {
      const permission = await Notification.requestPermission()
      return permission === "granted"
    } catch (error) {
      console.warn("Error requesting notification permission:", error)
      return false
    }
  }

  // Notification methods
  async newMessage(sender: string, message: string) {
    await this.playTone(800, 0.2)
    this.showNotification("New Message", `${sender}: ${message.substring(0, 50)}${message.length > 50 ? "..." : ""}`)
  }

  async roomCreated(roomId: string) {
    await this.playTone(600, 0.3)
    await this.playTone(800, 0.3)
    this.showNotification("Room Created", `Room ${roomId} has been created`)
  }

  async roomJoined(roomId: string) {
    await this.playTone(500, 0.2)
    await this.playTone(700, 0.2)
    this.showNotification("Room Joined", `You joined room ${roomId}`)
  }

  async roomLeft(roomId: string) {
    await this.playTone(400, 0.4)
    this.showNotification("Room Left", `You left room ${roomId}`)
  }

  async incomingCall(caller: string) {
    // Play ringing sound - enhanced for better audio
    const playRingTone = async () => {
      await this.playTone(800, 0.5, 0.4)
      await new Promise((resolve) => setTimeout(resolve, 200))
      await this.playTone(600, 0.5, 0.4)
    }

    await playRingTone()
    this.vibrate([200, 100, 200, 100, 200, 100, 200])
    this.showNotification("Incoming Call", `${caller} is calling you`)
  }

  async incomingVideoCall(caller: string) {
    // Play video call sound (different pattern from audio call)
    const playVideoRingTone = async () => {
      await this.playTone(1000, 0.3, 0.4)
      await new Promise((resolve) => setTimeout(resolve, 100))
      await this.playTone(800, 0.3, 0.4)
      await new Promise((resolve) => setTimeout(resolve, 100))
      await this.playTone(1200, 0.3, 0.4)
    }

    await playVideoRingTone()
    this.vibrate([500, 200, 500, 200, 500])
    this.showNotification("Incoming Video Call", `${caller} wants to video call`)
  }

  async theaterInvite(host: string, videoTitle: string) {
    await this.playTone(600, 0.4)
    await this.playTone(900, 0.4)
    this.showNotification("Theater Invite", `${host} invited you to watch ${videoTitle}`)
  }

  async gameInvite(host: string, gameType: string) {
    await this.playTone(700, 0.3)
    await this.playTone(1000, 0.3)
    this.showNotification("Game Invite", `${host} invited you to play ${gameType}`)
  }

  async callConnected() {
    await this.playTone(1000, 0.2)
    await this.playTone(1200, 0.2)
  }

  async callEnded() {
    await this.playTone(400, 0.6)
  }

  async callNotAnswered() {
    await this.playTone(300, 1.0)
    this.showNotification("Call Missed", "Call was not answered")
  }

  async error(message: string) {
    await this.playTone(200, 0.8)
    this.showNotification("Error", message)
  }

  async success(message: string) {
    await this.playTone(1200, 0.3)
    this.showNotification("Success", message)
  }

  async info(message: string) {
    await this.playTone(800, 0.2)
    this.showNotification("Info", message)
  }

  // Audio activity subscription for ducking
  private audioActivityListeners: ((active: boolean) => void)[] = []

  subscribeToAudioActivity(callback: (active: boolean) => void) {
    this.audioActivityListeners.push(callback)
    return () => {
      this.audioActivityListeners = this.audioActivityListeners.filter((cb) => cb !== callback)
    }
  }

  private notifyAudioActivity(active: boolean) {
    this.audioActivityListeners.forEach((cb) => cb(active))
  }

  // Cleanup method to properly close AudioContext
  cleanup() {
    if (this.isCleanupCalled) return
    this.isCleanupCalled = true

    this.audioActivityListeners = []

    try {
      if (this.audioContext) {
        // Close the audio context to release resources
        if (this.audioContext.state !== "closed") {
          this.audioContext.close().catch((error) => {
            console.warn("Error closing audio context:", error)
          })
        }
        this.audioContext = null
      }
    } catch (error) {
      console.warn("Error during notification system cleanup:", error)
    }
  }
}

// Singleton instance cleanup on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    NotificationSystem.getInstance().cleanup()
  })
}
