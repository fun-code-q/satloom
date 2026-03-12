import { getFirebaseDatabase, database } from "@/lib/firebase"
// @ts-ignore
import { ref, push, set, onValue, remove, update, get, onChildAdded } from "firebase/database"

// Helper to get typed database reference
const getDb = () => {
  const db = getFirebaseDatabase()!
  if (!db) {
    console.warn("Firebase database not initialized")
    return null
  }
  return db
}

export interface CallData {
  id: string
  callerId: string
  caller: string
  type: "audio" | "video"
  status: "ringing" | "answered" | "ended" | "missed"
  roomId: string
  participants: string[]
  participantNames?: Record<string, string>
  timestamp: number
  offer?: any
  answer?: any
  targetUserId?: string
}

export class CallSignaling {
  private static instance: CallSignaling
  private callListeners: Map<string, () => void> = new Map()

  static getInstance(): CallSignaling {
    if (!CallSignaling.instance) {
      CallSignaling.instance = new CallSignaling()
    }
    return CallSignaling.instance
  }

  async startCall(
    roomId: string,
    callerId: string,
    callerName: string,
    type: "audio" | "video",
    targetUserId: string,
  ): Promise<string> {
    try {
      const db = getFirebaseDatabase()
      if (!db) throw new Error("Firebase not initialized")

      const callsRef = ref(db, `rooms/${roomId}/calls`)
      const newCallRef = push(callsRef)
      const callId = newCallRef.key!

      const callData: CallData = {
        id: callId,
        callerId,
        caller: callerName,
        type,
        status: "ringing",
        roomId,
        participants: [callerId],
        participantNames: {
          [callerId]: callerName
        },
        timestamp: Date.now(),
        targetUserId
      }

      await set(newCallRef, callData)
      console.log("Call started:", callData)

      // Auto-end call after 60 seconds if not answered
      setTimeout(async () => {
        try {
          const db = getDb()
          if (!db) return
          const callRef = ref(db, `rooms/${roomId}/calls/${callId}`)
          const snapshot = await get(callRef)
          if (snapshot.exists() && snapshot.val().status === "ringing") {
            await this.endCall(roomId, callId)
          }
        } catch (error) {
          console.error("Error auto-ending call:", error)
        }
      }, 60000)

      return callId
    } catch (error) {
      console.error("Error starting call:", error)
      throw error
    }
  }

  async answerCall(roomId: string, callId: string, userId: string, userName?: string): Promise<void> {
    try {
      const db = getDb()
      if (!db) return

      const callRef = ref(db, `rooms/${roomId}/calls/${callId}`)
      const snapshot = await get(callRef)

      if (snapshot.exists()) {
        const callData = snapshot.val() as CallData
        const updatedParticipants = [...callData.participants]
        if (!updatedParticipants.includes(userId)) {
          updatedParticipants.push(userId)
        }

        const updatedNames = { ...(callData.participantNames || {}) }
        if (userName) {
          updatedNames[userId] = userName
        }

        await update(callRef, {
          status: "answered",
          participants: updatedParticipants,
          participantNames: updatedNames
        })

        console.log("Call answered:", callId)
      }
    } catch (error) {
      console.error("Error answering call:", error)
      throw error
    }
  }

  async endCall(roomId: string, callId: string): Promise<void> {
    try {
      const db = getDb()
      if (!db) return

      const callRef = ref(db, `rooms/${roomId}/calls/${callId}`)
      await update(callRef, { status: "ended" })

      console.log("Call ended:", callId)

      // Remove call data after 5 seconds
      setTimeout(async () => {
        try {
          const dbCleanup = getDb()
          if (!dbCleanup) return
          await remove(ref(dbCleanup, `rooms/${roomId}/calls/${callId}`))
        } catch (error) {
          console.error("Error removing call data:", error)
        }
      }, 5000)
    } catch (error) {
      console.error("Error ending call:", error)
      throw error
    }
  }

  async switchCallType(roomId: string, callId: string, type: "audio" | "video"): Promise<void> {
    try {
      const db = getDb()
      if (!db) return

      const callRef = ref(db, `rooms/${roomId}/calls/${callId}`)
      await update(callRef, { type })

      console.log(`Call type switched to ${type}:`, callId)
    } catch (error) {
      console.error("Error switching call type:", error)
      throw error
    }
  }

  listenForCalls(
    roomId: string,
    currentUserId: string,
    onIncomingCall: (call: CallData) => void,
    onCallUpdate: (call: CallData) => void,
  ): () => void {
    const db = getDb()
    if (!db) return () => { }

    const callsRef = ref(db, `rooms/${roomId}/calls`)
    const STALE_THRESHOLD = 5 * 60 * 1000 // 5 minutes

    const unsubscribe = onValue(callsRef, (snapshot: any) => {
      const calls = snapshot.val()
      if (calls) {
        const now = Date.now()
        Object.values(calls).forEach((call: any) => {
          const callData = call as CallData

          // Ignore very old calls
          if (now - callData.timestamp > STALE_THRESHOLD && callData.status !== "ringing") {
            return
          }

          // Handle incoming calls (for other users)
          if (callData.status === "ringing" && callData.callerId !== currentUserId) {
            console.log("[Signaling] Incoming call detected:", callData.id)
            onIncomingCall(callData)
          }

          // Handle call updates (for all participants)
          if (callData.participants.includes(currentUserId) || callData.callerId === currentUserId) {
            // Only update if it's not a dead call unless it just ended
            onCallUpdate(callData)
          }
        })
      }
    })

    this.callListeners.set(roomId, unsubscribe)
    return unsubscribe
  }

  // WebRTC Signaling Methods
  async sendSignal(roomId: string, callId: string, type: "offer" | "answer" | "ice-candidate" | "bye", payload: any, senderId: string) {
    const db = getDb()
    if (!db) return
    const signalRef = ref(db, `rooms/${roomId}/calls/${callId}/signals`)
    await push(signalRef, {
      type,
      payload,
      timestamp: Date.now(),
      senderId
    })
  }

  listenForSignals(roomId: string, callId: string, currentUserId: string, onSignal: (type: string, payload: any, senderId: string) => void): () => void {
    const db = getDb()
    if (!db) return () => { }
    const signalsRef = ref(db, `rooms/${roomId}/calls/${callId}/signals`)

    const unsubscribe = onChildAdded(signalsRef, (snapshot: any) => {
      const data = snapshot.val()
      if (data && data.senderId !== currentUserId) {
        // Only process signals from the OTHER person
        onSignal(data.type, data.payload, data.senderId)

        // Remove signal after processing to keep DB clean and avoid stale processing
        remove(snapshot.ref).catch(err => console.warn("Failed to remove signal:", err))
      }
    })

    return unsubscribe
  }

  async clearSignals(roomId: string, callId: string) {
    const db = getDb()
    if (!db) return
    const signalsRef = ref(db, `rooms/${roomId}/calls/${callId}/signals`)
    await remove(signalsRef)
  }

  // Actually, let's implement sending correctly first.

  cleanup(): void {
    console.log("Cleaning up call signaling")
    this.callListeners.forEach((unsubscribe) => {
      unsubscribe()
    })
    this.callListeners.clear()
  }

  // Placeholder methods to match the class structure if helper needed
  private getCurrentUserId() {
    // Implementation depends on auth, but we pass IDs usually.
    return "user"
  }
}
