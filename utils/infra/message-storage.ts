import { getFirebaseDatabase } from "@/lib/firebase"
import { ref, push, set, onValue, query, orderByChild, limitToLast, remove, update, runTransaction } from "firebase/database"
import type { Message } from "@/components/message-bubble"

export class MessageStorage {
  private static instance: MessageStorage
  private messageListeners: Map<string, () => void> = new Map()
  private currentRoomId: string | null = null

  // Constants
  private static readonly MESSAGE_RETENTION_MS = 24 * 60 * 60 * 1000 // 24 hours
  private static readonly DEFAULT_MESSAGE_LIMIT = 50

  static getInstance(): MessageStorage {
    if (!MessageStorage.instance) {
      MessageStorage.instance = new MessageStorage()
    }
    return MessageStorage.instance
  }

  // Clean data before sending to Firebase (remove undefined values)
  private cleanData(obj: any): any {
    if (obj === null || obj === undefined) {
      return null
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.cleanData(item)).filter((item) => item !== undefined)
    }

    if (typeof obj === "object") {
      const cleaned: any = {}
      Object.keys(obj).forEach((key) => {
        const value = this.cleanData(obj[key])
        if (value !== undefined) {
          cleaned[key] = value
        }
      })
      return cleaned
    }

    return obj
  }

  // Send a message
  async sendMessage(roomId: string, message: Omit<Message, "id">, userId: string): Promise<string> {
    try {
      if (!getFirebaseDatabase()!) {
        console.warn("Firebase database not initialized, message not sent")
        return ""
      }

      const messagesRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/messages`)
      const newMessageRef = push(messagesRef)

      // Clean the message data to remove undefined values
      const messageData = this.cleanData({
        ...message,
        id: newMessageRef.key,
        userId: userId, // Required by Firebase rules
        roomId: roomId, // Explicitly add room ID
        timestamp: message.timestamp.toISOString(),
        // Ensure replyTo is either a complete object or null
        replyTo: message.replyTo
          ? {
            id: message.replyTo.id || null,
            text: message.replyTo.text || "",
            sender: message.replyTo.sender || "",
          }
          : null,
        // Ensure reactions object exists
        reactions: message.reactions || {
          heart: [],
          thumbsUp: [],
        },
        // Ensure file is either a complete object or null
        file: message.file
          ? {
            name: message.file.name || "",
            type: message.file.type || "",
            url: message.file.url || "",
            size: message.file.size || 0,
          }
          : null,
        // Handle optional fields
        edited: message.edited || false,
        editedAt: message.editedAt ? message.editedAt.toISOString() : null,
      })

      console.log("Sending message to room:", roomId, messageData)
      await set(newMessageRef, messageData)
      console.log("Message sent successfully")
      return newMessageRef.key!
    } catch (error) {
      console.error("Error sending message:", error)
      throw error
    }
  }

  // Send quiz notification message
  async sendQuizNotification(roomId: string, hostName: string, topic?: string): Promise<void> {
    const message: Omit<Message, "id"> = {
      text: `🧠 ${hostName} started a ${topic ? `${topic} ` : ""}quiz! Get ready for 10 questions!`,
      sender: "System",
      timestamp: new Date(),
      type: "quiz",
      reactions: {
        heart: [],
        thumbsUp: [],
      },
    }

    await this.sendMessage(roomId, message, "system")
  }

  // Send quiz results message
  async sendQuizResults(roomId: string, results: any[], totalQuestions: number): Promise<void> {
    const winner = results[0]
    const message: Omit<Message, "id"> = {
      text: `🏆 Quiz completed! ${winner?.playerName || "Someone"} won with ${winner?.score || 0}/${totalQuestions} correct answers!`,
      sender: "System",
      timestamp: new Date(),
      type: "quiz-results",
      reactions: {
        heart: [],
        thumbsUp: [],
      },
    }

    await this.sendMessage(roomId, message, "system")
  }

  // Listen for messages
  listenForMessages(roomId: string, onMessage: (messages: Message[]) => void, limit = 50) {
    console.log("Setting up message listener for room:", roomId)

    // Always clear messages immediately when setting up a new listener
    onMessage([])

    // If switching rooms, clean up previous listeners aggressively
    if (this.currentRoomId && this.currentRoomId !== roomId) {
      console.log("Switching from room", this.currentRoomId, "to", roomId)
      this.cleanupRoom(this.currentRoomId)
      // Force clear messages again after cleanup
      onMessage([])
    }

    this.currentRoomId = roomId

    if (!getFirebaseDatabase()!) {
      console.warn("Firebase database not initialized, no messages will be loaded")
      onMessage([])
      return () => { }
    }

    const messagesRef = query(ref(getFirebaseDatabase()!, `rooms/${roomId}/messages`), orderByChild("timestamp"), limitToLast(limit))

    // Capture the roomId in the closure at subscription time.
    // This prevents a race where this.currentRoomId is updated to a new room
    // before old snapshots finish arriving, causing them to wipe the new room's messages.
    const subscribedRoomId = roomId

    const unsubscribe = onValue(
      messagesRef,
      (snapshot) => {
        // If this listener is for a room we've already left, silently discard.
        if (this.currentRoomId !== subscribedRoomId) {
          console.log("Discarding stale snapshot for old room:", subscribedRoomId, "current:", this.currentRoomId)
          return
        }

        console.log("Received message snapshot for room:", subscribedRoomId)
        const data = snapshot.val()

        if (data) {
          const messages: Message[] = Object.entries(data)
            .map(([id, msg]: [string, any]) => {
              // Bulletproof timestamp parsing
              let msgDate = new Date()
              if (msg && msg.timestamp) {
                const parsed = new Date(msg.timestamp)
                if (!isNaN(parsed.getTime())) {
                  msgDate = parsed
                }
              } else if (msg && msg.time) {
                // Fallback for some older node structures
                const parsed = new Date(msg.time)
                if (!isNaN(parsed.getTime())) {
                  msgDate = parsed
                }
              }

              return {
                ...msg,
                id,
                timestamp: msgDate,
                editedAt: msg?.editedAt ? new Date(msg.editedAt) : undefined,
                // Ensure reactions exist
                reactions: msg?.reactions || { heart: [], thumbsUp: [] },
                // Clean up null values
                replyTo: msg?.replyTo || undefined,
                file: msg?.file || undefined,
              }
            })
            .filter((msg: Message) => {
              // STRICT room ID filtering - only show messages from current room
              const messageRoomId = (msg as any).roomId
              const isFromCurrentRoom = messageRoomId === subscribedRoomId || !messageRoomId

              if (!isFromCurrentRoom) {
                console.log("Filtering out message from different room:", messageRoomId, "current:", subscribedRoomId)
                return false
              }

              // Only show messages from the last 24 hours
              const now = new Date()
              const messageAge = now.getTime() - msg.timestamp.getTime()
              const isRecent = messageAge < MessageStorage.MESSAGE_RETENTION_MS

              if (!isRecent) {
                console.log("Filtering out old message:", msg.timestamp)
                return false
              }

              return true
            })

          // Sort by timestamp
          messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
          console.log(`Loaded ${messages.length} messages for room ${subscribedRoomId}`)

          onMessage(messages)
        } else {
          console.log("No messages found for room:", subscribedRoomId)
          onMessage([])
        }
      },
      (error) => {
        // Log the error but do NOT wipe messages — transient errors should not blank the chat
        console.error("Error listening for messages:", error)
      },
    )

    // Store the unsubscribe function with room ID
    this.messageListeners.set(roomId, unsubscribe)
    return unsubscribe
  }


  // Edit a message
  async editMessage(roomId: string, messageId: string, newText: string): Promise<void> {
    try {
      if (!getFirebaseDatabase()!) return

      const messageRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/messages/${messageId}`)
      const updateData = this.cleanData({
        text: newText,
        edited: true,
        editedAt: new Date().toISOString(),
      })
      await update(messageRef, updateData)
    } catch (error) {
      console.error("Error editing message:", error)
      throw error
    }
  }

  // Delete a message
  async deleteMessage(roomId: string, messageId: string): Promise<void> {
    try {
      if (!getFirebaseDatabase()!) return

      const messageRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/messages/${messageId}`)
      await remove(messageRef)
    } catch (error) {
      console.error("Error deleting message:", error)
      throw error
    }
  }

  // Add reaction to message
  async addReaction(roomId: string, messageId: string, reaction: "heart" | "thumbsUp", userId: string): Promise<void> {
    try {
      if (!getFirebaseDatabase()!) return

      const reactionRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/messages/${messageId}/reactions/${reaction}`)

      // Get current reactions
      const snapshot = await new Promise<any>((resolve) => {
        onValue(reactionRef, resolve, { onlyOnce: true })
      })

      const currentReactions = snapshot.val() || []

      // Toggle reaction
      let newReactions
      if (currentReactions.includes(userId)) {
        newReactions = currentReactions.filter((id: string) => id !== userId)
      } else {
        newReactions = [...currentReactions, userId]
      }

      await set(reactionRef, newReactions)
    } catch (error) {
      console.error("Error adding reaction:", error)
      throw error
    }
  }

  // Vote on a poll
  async vote(roomId: string, messageId: string, optionIndex: number, userId: string): Promise<void> {
    try {
      if (!getFirebaseDatabase()!) return

      const pollOptionsRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/messages/${messageId}/poll/options`)

      await runTransaction(pollOptionsRef, (options) => {
        if (options) {
          // Remove user from all options (enforce single choice)
          options.forEach((opt: any) => {
            if (opt.votes) {
              opt.votes = opt.votes.filter((id: string) => id !== userId)
            }
          })

          // Add user to selected option
          if (options[optionIndex]) {
            if (!options[optionIndex].votes) {
              options[optionIndex].votes = []
            }
            options[optionIndex].votes.push(userId)
          }
        }
        return options
      })
    } catch (error) {
      console.error("Error voting:", error)
      throw error
    }
  }

  // RSVP to an event
  async rsvp(roomId: string, messageId: string, status: "going" | "maybe" | "notGoing", userId: string): Promise<void> {
    try {
      if (!getFirebaseDatabase()!) return

      const eventRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/messages/${messageId}/event/attendees`)

      await runTransaction(eventRef, (attendees) => {
        if (attendees) {
          // Initialize arrays if they don't exist
          if (!attendees.going) attendees.going = []
          if (!attendees.maybe) attendees.maybe = []
          if (!attendees.notGoing) attendees.notGoing = []

          // Remove user from all lists
          attendees.going = attendees.going.filter((id: string) => id !== userId)
          attendees.maybe = attendees.maybe.filter((id: string) => id !== userId)
          attendees.notGoing = attendees.notGoing.filter((id: string) => id !== userId)

          // Add user to selected status
          if (attendees[status]) {
            attendees[status].push(userId)
          }
        }
        return attendees
      })
    } catch (error) {
      console.error("Error RSVPing:", error)
      throw error
    }
  }

  // Pin a message
  async pinMessage(roomId: string, messageId: string): Promise<void> {
    try {
      if (!getFirebaseDatabase()!) return
      const roomRef = ref(getFirebaseDatabase()!, `rooms/${roomId}`)
      await update(roomRef, { pinnedMessageId: messageId })
    } catch (error) {
      console.error("Error pinning message:", error)
      throw error
    }
  }

  // Unpin a message
  async unpinMessage(roomId: string): Promise<void> {
    try {
      if (!getFirebaseDatabase()!) return
      const roomRef = ref(getFirebaseDatabase()!, `rooms/${roomId}`)
      await update(roomRef, { pinnedMessageId: null })
    } catch (error) {
      console.error("Error unpinning message:", error)
      throw error
    }
  }

  // Clean up specific room listeners more aggressively
  private cleanupRoom(roomId: string) {
    const unsubscribe = this.messageListeners.get(roomId)
    if (unsubscribe) {
      console.log("Cleaning up listeners for room:", roomId)
      unsubscribe()
      this.messageListeners.delete(roomId)
    }
  }

  // Enhanced clear messages for room switching
  clearMessages() {
    console.log("Clearing message cache and resetting current room")
    this.currentRoomId = null
    // Force cleanup of all listeners to prevent cross-contamination
    this.cleanup()
  }

  // More thorough cleanup
  cleanup() {
    console.log("Cleaning up all message listeners and resetting state")
    this.messageListeners.forEach((unsubscribe, roomId) => {
      console.log("Cleaning up listener for room:", roomId)
      try {
        unsubscribe()
      } catch (error) {
        console.error("Error cleaning up listener for room:", roomId, error)
      }
    })
    this.messageListeners.clear()
    this.currentRoomId = null
  }
  // Mark a message as read
  async markMessageAsRead(roomId: string, messageId: string, userId: string): Promise<void> {
    try {
      if (!getFirebaseDatabase()!) return

      const messageRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/messages/${messageId}`)

      // Use transaction to safely add user to readBy array
      await runTransaction(messageRef, (message) => {
        if (message) {
          if (!message.readBy) {
            message.readBy = []
          }
          if (!Array.isArray(message.readBy)) {
            message.readBy = []
          }
          if (!message.readBy.includes(userId)) {
            message.readBy.push(userId)
          }
        }
        return message
      })
    } catch (error) {
      console.error("Error marking message as read:", error)
    }
  }
}
