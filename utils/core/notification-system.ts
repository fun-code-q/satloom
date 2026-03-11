export class NotificationSystem {
  private static instance: NotificationSystem
  private audioContext: AudioContext | null = null
  private notificationsEnabled = true
  private soundEnabled = true
  private vibrationEnabled = true
  private permissionsRequested = false
  private isCleanupCalled = false
  private ringingInterval: any = null
  private currentRingingType: "audio" | "video" | null = null
  private audioActivityListeners: ((active: boolean) => void)[] = []

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
    if (typeof window === "undefined") return
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

  private async playChord(frequencies: number[], duration: number, volume = 0.3, type: OscillatorType = "sine") {
    if (!this.soundEnabled || !this.audioContext) return
    const individualVolume = volume / frequencies.length
    await Promise.all(frequencies.map(freq => this.playTone(freq, duration, individualVolume, type)))
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

    if (this.permissionsRequested) return Notification.permission === "granted"

    this.permissionsRequested = true

    try {
      const permission = await Notification.requestPermission()
      return permission === "granted"
    } catch (error) {
      console.warn("Error requesting notification permission:", error)
      return false
    }
  }

  // Event methods
  async newMessage(sender: string, message: string) {
    await this.playTone(800, 0.2)
    this.showNotification("New Message", `${sender}: ${message.substring(0, 50)}${message.length > 50 ? "..." : ""}`)
  }

  async roomCreated(roomId: string) {
    await this.playChord([523, 659, 783], 0.4)
    this.showNotification("Room Created", `Room ${roomId} created successfully`)
  }

  async roomJoined(roomId: string) {
    await this.playTone(440, 0.1)
    await this.playTone(554, 0.1)
    await this.playTone(659, 0.3)
    this.showNotification("Room Joined", `You joined room ${roomId}`)
  }

  async userJoined(userName: string) {
    await this.playTone(659, 0.1)
    await this.playTone(880, 0.2)
    this.showNotification("User Joined", `${userName} entered the room`)
  }

  async userLeft(userName: string) {
    await this.playTone(554, 0.2)
    await this.playTone(440, 0.3)
  }

  async roomLeft(roomId: string) {
    await this.playTone(400, 0.4)
    this.showNotification("Room Left", `You left room ${roomId}`)
  }

  async incomingCall(caller: string) {
    this.startRinging(caller, "audio")
  }

  async incomingVideoCall(caller: string) {
    this.startRinging(caller, "video")
  }

  startRinging(caller: string, type: "audio" | "video") {
    if (this.ringingInterval) return
    this.currentRingingType = type

    const ringPattern = async () => {
      if (type === "audio") {
        await this.playChord([440, 554, 659], 0.6, 0.4)
        await new Promise(r => setTimeout(r, 100))
        await this.playChord([440, 554, 659], 0.6, 0.4)
      } else {
        await this.playChord([554, 698, 830], 0.4, 0.4)
        await new Promise(r => setTimeout(r, 100))
        await this.playChord([659, 830, 987], 0.4, 0.4)
      }
      this.vibrate([200, 100, 200])
    }

    ringPattern()
    this.ringingInterval = setInterval(ringPattern, 3000)

    this.showNotification(
      type === "audio" ? "Incoming Call" : "Incoming Video Call",
      `${caller} is calling you...`
    )
  }

  stopRinging() {
    if (this.ringingInterval) {
      clearInterval(this.ringingInterval)
      this.ringingInterval = null
      this.currentRingingType = null
    }
  }

  async presentationInvite(host: string) {
    await this.playChord([523, 659, 783], 0.3)
    await this.playChord([587, 739, 880], 0.4)
    this.showNotification("Presentation Invite", `${host} started a presentation`)
  }

  async theaterInvite(host: string, videoTitle: string) {
    await this.playTone(600, 0.4)
    await this.playTone(900, 0.4)
    this.showNotification("Theater Invite", `${host} invited you to watch ${videoTitle}`)
  }

  async whiteboardInvite(host: string) {
    await this.playTone(500, 0.3)
    await this.playTone(800, 0.3)
    this.showNotification("Whiteboard Invite", `${host} invited you to collaborate on the whiteboard`)
  }

  async notesUpdated(userName: string) {
    await this.playTone(700, 0.1)
    this.showNotification("Notes Updated", `${userName} updated the shared notes`)
  }

  async tasksUpdated(userName: string) {
    await this.playTone(750, 0.1)
    this.showNotification("Tasks Updated", `${userName} updated the shared task list`)
  }

  async gameInvite(host: string, gameType: string) {
    await this.playTone(700, 0.3)
    await this.playTone(1000, 0.3)
    this.showNotification("Game Invite", `${host} invited you to play ${gameType}`)
  }

  async callConnected() {
    this.stopRinging()
    await this.playTone(1000, 0.2)
    await this.playTone(1200, 0.2)
  }

  async callEnded() {
    this.stopRinging()
    await this.playTone(400, 0.6)
  }

  async callNotAnswered() {
    this.stopRinging()
    await this.playTone(349, 0.3, 0.3, "square")
    await new Promise(r => setTimeout(r, 100))
    await this.playTone(349, 0.3, 0.3, "square")
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

  subscribeToAudioActivity(callback: (active: boolean) => void) {
    this.audioActivityListeners.push(callback)
    return () => {
      this.audioActivityListeners = this.audioActivityListeners.filter((cb) => cb !== callback)
    }
  }

  private notifyAudioActivity(active: boolean) {
    this.audioActivityListeners.forEach((cb) => cb(active))
  }

  cleanup() {
    if (this.isCleanupCalled) return
    this.isCleanupCalled = true
    this.stopRinging()
    this.audioActivityListeners = []
    try {
      if (this.audioContext) {
        if (this.audioContext.state !== "closed") {
          this.audioContext.close().catch((error) => console.warn("Error closing audio context:", error))
        }
        this.audioContext = null
      }
    } catch (error) {
      console.warn("Cleanup error:", error)
    }
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    NotificationSystem.getInstance().cleanup()
  })
}
