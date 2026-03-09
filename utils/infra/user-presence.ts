import { getFirebaseDatabase } from "@/lib/firebase"
import { ref, set, onValue, onDisconnect, remove, update } from "firebase/database"

export interface UserPresence {
  id: string
  name: string
  avatar?: string
  status: "online" | "away" | "busy" | "offline"
  lastSeen: number
  currentActivity?: "chat" | "call" | "video-call" | "theater" | "game" | "presentation"
  isTyping?: boolean
  isRecordingVoice?: boolean
  isRecordingVideo?: boolean
  isSendingFile?: boolean
  mood?: {
    emoji: string
    text: string
  }
}

export class UserPresenceSystem {
  private static instance: UserPresenceSystem
  private presenceListeners: Array<() => void> = []
  private currentUserId: string | null = null
  private activityInterval: NodeJS.Timeout | null = null
  private typingTimeout: NodeJS.Timeout | null = null

  static getInstance(): UserPresenceSystem {
    if (!UserPresenceSystem.instance) {
      UserPresenceSystem.instance = new UserPresenceSystem()
    }
    return UserPresenceSystem.instance
  }

  // Generate unique user ID to prevent duplicates
  private generateUniqueUserId(userName: string): string {
    return `${userName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Clean data to remove undefined values
  private cleanPresenceData(data: any): any {
    const cleaned: any = {}
    Object.keys(data).forEach((key) => {
      const value = data[key]
      if (value !== undefined && value !== null) {
        cleaned[key] = value
      }
    })
    return cleaned
  }

  // Set user online with better error handling
  async setUserOnline(userId: string, roomId: string, userInfo: Omit<UserPresence, "id" | "status" | "lastSeen">) {
    try {
      if (!getFirebaseDatabase()!) {
        console.warn("Firebase database not initialized, skipping presence update")
        this.currentUserId = userId
        return
      }

      this.currentUserId = userId
      const userRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/presence/${userId}`)

      const presenceData: UserPresence = {
        id: userId,
        status: "online",
        lastSeen: Date.now(),
        isTyping: false,
        isRecordingVoice: false,
        isRecordingVideo: false,
        isSendingFile: false,
        name: userInfo.name,
        currentActivity: userInfo.currentActivity || "chat",
      }

      // Only add avatar if it exists and is not undefined
      if (userInfo.avatar && userInfo.avatar.trim() !== "") {
        presenceData.avatar = userInfo.avatar
      }

      // Clean the data to ensure no undefined values
      const cleanedData = this.cleanPresenceData(presenceData)

      console.log("Setting user online:", { userId, roomId, cleanedData })
      await set(userRef, cleanedData)

      // Set up disconnect handler
      try {
        const disconnectRef = onDisconnect(userRef)
        await disconnectRef.remove()
      } catch (disconnectError) {
        console.warn("Could not set up disconnect handler:", disconnectError)
      }

      // Update activity periodically
      this.startActivityUpdater(roomId, userId)
    } catch (error) {
      console.error("Error setting user online:", error)
      // Fallback: continue without presence system
      this.currentUserId = userId
    }
  }

  // Update user activity
  async updateActivity(roomId: string, userId: string, activity?: UserPresence["currentActivity"]) {
    try {
      if (!getFirebaseDatabase() || this.currentUserId !== userId) return

      const activityRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/presence/${userId}`)
      const updateData = this.cleanPresenceData({
        currentActivity: activity || "chat",
        lastSeen: Date.now(),
      })

      console.log("Updating activity:", { userId, roomId, updateData })
      await update(activityRef, updateData)
    } catch (error) {
      console.error("Error updating activity:", error)
    }
  }

  // Set typing indicator
  async setTyping(roomId: string, userId: string, isTyping: boolean) {
    try {
      if (!getFirebaseDatabase() || this.currentUserId !== userId) return

      const typingRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/presence/${userId}`)
      const updateData = this.cleanPresenceData({
        isTyping,
        lastSeen: Date.now(),
      })

      console.log("Setting typing indicator:", { userId, roomId, isTyping })
      await update(typingRef, updateData)

      // Auto-clear typing after 3 seconds
      if (isTyping) {
        if (this.typingTimeout) {
          clearTimeout(this.typingTimeout)
        }
        this.typingTimeout = setTimeout(() => {
          this.setTyping(roomId, userId, false)
        }, 3000)
      }
    } catch (error) {
      console.error("Error setting typing indicator:", error)
    }
  }

  // Set voice recording indicator
  async setRecordingVoice(roomId: string, userId: string, isRecording: boolean) {
    try {
      if (!getFirebaseDatabase() || this.currentUserId !== userId) return

      const recordingRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/presence/${userId}`)
      const updateData = this.cleanPresenceData({
        isRecordingVoice: isRecording,
        lastSeen: Date.now(),
      })
      await update(recordingRef, updateData)
    } catch (error) {
      console.error("Error setting voice recording indicator:", error)
    }
  }

  // Set video recording indicator
  async setRecordingVideo(roomId: string, userId: string, isRecording: boolean) {
    try {
      if (!getFirebaseDatabase() || this.currentUserId !== userId) return

      const recordingRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/presence/${userId}`)
      const updateData = this.cleanPresenceData({
        isRecordingVideo: isRecording,
        lastSeen: Date.now(),
      })
      await update(recordingRef, updateData)
    } catch (error) {
      console.error("Error setting video recording indicator:", error)
    }
  }

  // Set file sending indicator
  async setSendingFile(roomId: string, userId: string, isSending: boolean) {
    try {
      if (!getFirebaseDatabase() || this.currentUserId !== userId) return

      const sendingRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/presence/${userId}`)
      const updateData = this.cleanPresenceData({
        isSendingFile: isSending,
        lastSeen: Date.now(),
      })
      await update(sendingRef, updateData)
    } catch (error) {
      console.error("Error setting file sending indicator:", error)
    }
  }

  // Set user status
  async setUserStatus(roomId: string, userId: string, status: UserPresence["status"]) {
    try {
      if (!getFirebaseDatabase() || this.currentUserId !== userId) return

      const statusRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/presence/${userId}/status`)
      await set(statusRef, status)
    } catch (error) {
      console.error("Error setting user status:", error)
    }
  }

  // Set user mood
  async setUserMood(roomId: string, userId: string, mood: UserPresence["mood"]) {
    try {
      if (!getFirebaseDatabase() || this.currentUserId !== userId) return

      const moodRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/presence/${userId}/mood`)
      await set(moodRef, mood)
    } catch (error) {
      console.error("Error setting user mood:", error)
    }
  }

  // Listen for presence updates
  listenForPresence(roomId: string, onPresenceUpdate: (users: UserPresence[]) => void) {
    if (!getFirebaseDatabase()!) {
      console.warn("Firebase database not initialized, skipping presence listener")
      onPresenceUpdate([])
      return () => { }
    }

    const presenceRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/presence`)

    const unsubscribe = onValue(
      presenceRef,
      (snapshot) => {
        const data = snapshot.val()
        if (data) {
          const users: UserPresence[] = Object.values(data)
          // Filter out duplicate users by name (keep the most recent one)
          const uniqueUsers = users.reduce((acc: UserPresence[], user: UserPresence) => {
            const existingIndex = acc.findIndex((u) => u.name === user.name)
            if (existingIndex >= 0) {
              // Keep the user with the most recent lastSeen
              if (user.lastSeen > acc[existingIndex].lastSeen) {
                acc[existingIndex] = user
              }
            } else {
              acc.push(user)
            }
            return acc
          }, [])

          onPresenceUpdate(uniqueUsers)
        } else {
          onPresenceUpdate([])
        }
      },
      (error) => {
        console.error("Error listening for presence:", error)
        // Continue without presence updates
        onPresenceUpdate([])
      },
    )

    this.presenceListeners.push(unsubscribe)
    return unsubscribe
  }

  // Set user offline
  async setUserOffline(roomId: string, userId: string) {
    try {
      if (!getFirebaseDatabase()!) {
        console.warn("Firebase database not initialized, skipping offline update")
        return
      }

      const userRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/presence/${userId}`)
      await remove(userRef)

      if (this.activityInterval) {
        clearInterval(this.activityInterval)
        this.activityInterval = null
      }

      if (this.typingTimeout) {
        clearTimeout(this.typingTimeout)
        this.typingTimeout = null
      }
    } catch (error) {
      console.error("Error setting user offline:", error)
    }
  }

  private startActivityUpdater(roomId: string, userId: string) {
    // Clear any existing interval
    if (this.activityInterval) {
      clearInterval(this.activityInterval)
    }

    // Update last seen every 30 seconds
    this.activityInterval = setInterval(async () => {
      if (this.currentUserId === userId && getFirebaseDatabase()!) {
        try {
          const lastSeenRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/presence/${userId}/lastSeen`)
          await set(lastSeenRef, Date.now())
        } catch (error) {
          console.error("Error updating last seen:", error)
        }
      } else {
        if (this.activityInterval) {
          clearInterval(this.activityInterval)
          this.activityInterval = null
        }
      }
    }, 30000)
  }

  // Clean up
  cleanup() {
    this.presenceListeners.forEach((unsubscribe) => unsubscribe())
    this.presenceListeners = []
    this.currentUserId = null

    if (this.activityInterval) {
      clearInterval(this.activityInterval)
      this.activityInterval = null
    }

    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout)
      this.typingTimeout = null
    }
  }

  // Generate unique user ID (public method)
  createUniqueUserId(userName: string): string {
    return this.generateUniqueUserId(userName)
  }
}
