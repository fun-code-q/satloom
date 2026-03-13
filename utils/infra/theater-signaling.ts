import { getFirebaseDatabase } from "@/lib/firebase"
import { ref, set, onValue, remove, off, get, update } from "firebase/database"

export interface TheaterSession {
  id: string
  roomId: string
  hostId: string
  hostName: string
  videoUrl: string
  videoType: "direct" | "youtube" | "vimeo" | "twitch" | "dailymotion" | "archive" | "soundcloud" | "webrtc"
  status: "waiting" | "loading" | "playing" | "paused" | "buffering" | "ended"
  participants: string[]
  currentTime: number
  queue?: any[]
  lastAction?: TheaterAction
  createdAt: number
}

export interface TheaterAction {
  type: "play" | "pause" | "seek" | "buffering" | "reaction" | "queue_update" | "rate_change" | "join_sync" | "quality_change"
  payload?: any
  currentTime?: number
  timestamp: number
  hostId: string
  hostName: string
}

export interface TheaterInvite {
  id: string
  sessionId: string
  roomId: string
  host: string
  hostId: string
  videoTitle: string
  timestamp: number
}

export class TheaterSignaling {
  private static instance: TheaterSignaling
  private currentSession: TheaterSession | null = null
  private theaterListeners: Array<() => void> = []
  private hostPresenceUnsubscribe: (() => void) | null = null
  private hostHeartbeatInterval: NodeJS.Timeout | null = null
  private lastHeartbeat: number = 0

  static getInstance(): TheaterSignaling {
    if (!TheaterSignaling.instance) {
      TheaterSignaling.instance = new TheaterSignaling()
    }
    return TheaterSignaling.instance
  }

  // Create a new theater session
  async createSession(
    roomId: string,
    hostName: string,
    hostId: string,
    videoUrl: string,
    videoType: "direct" | "youtube" | "vimeo" | "twitch" | "dailymotion" | "archive" | "soundcloud" | "webrtc",
  ): Promise<string> {
    if (!getFirebaseDatabase()!) {
      throw new Error("Firebase database not initialized")
    }

    const sessionId = `theater_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const session: TheaterSession = {
      id: sessionId,
      roomId,
      hostId,
      hostName,
      videoUrl,
      videoType,
      status: "waiting",
      participants: [hostId],
      currentTime: 0,
      createdAt: Date.now(),
    }

    const sessionRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/theater/${sessionId}`)
    await set(sessionRef, session)

    this.currentSession = session
    return sessionId
  }

  // Send invite to all room members
  async sendInvite(roomId: string, sessionId: string, hostName: string, hostId: string, videoTitle: string) {
    if (!getFirebaseDatabase()!) return

    const invite: TheaterInvite = {
      id: `invite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      roomId,
      host: hostName,
      hostId,
      videoTitle,
      timestamp: Date.now(),
    }

    const inviteRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/theaterInvites/${invite.id}`)
    await set(inviteRef, invite)

    // Auto-remove invite after 30 seconds
    setTimeout(async () => {
      try {
        if (!inviteRef) return
        await remove(inviteRef)
      } catch (error) {
        console.error("Error removing theater invite:", error)
      }
    }, 30000)
  }

  // Join theater session
  async joinSession(roomId: string, sessionId: string, userId: string) {
    if (!getFirebaseDatabase()!) return

    const sessionRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/theater/${sessionId}`)

    // Get current session data
    const snapshot = await new Promise<any>((resolve) => {
      onValue(sessionRef, resolve, { onlyOnce: true })
    })

    const session = snapshot.val()
    if (session && !session.participants.includes(userId)) {
      const updatedParticipants = [...session.participants, userId]
      await set(ref(getFirebaseDatabase()!, `rooms/${roomId}/theater/${sessionId}/participants`), updatedParticipants)
    }

    // Clear stale signals for this user
    await this.clearSignals(roomId, sessionId, userId)
  }

  // Clear all signals for a user
  async clearSignals(roomId: string, sessionId: string, userId: string) {
    if (!getFirebaseDatabase()!) return
    const signalsRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/theater/${sessionId}/signals/${userId}`)
    await remove(signalsRef)
  }

  // Send theater action (play, pause, seek)
  async sendAction(
    roomId: string,
    sessionId: string,
    type: "play" | "pause" | "seek" | "queue_update" | "join_sync" | "quality_change",
    currentTime: number,
    hostId: string,
    hostName: string,
    payload?: any
  ) {
    if (!getFirebaseDatabase()!) return

    const action: TheaterAction = {
      type,
      currentTime,
      timestamp: Date.now(),
      hostId,
      hostName,
      payload
    }

    const actionRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/theater/${sessionId}/lastAction`)
    await set(actionRef, action)

    // Update session status only for play/pause, not for seek/queue
    if (type === "play" || type === "pause") {
      const statusRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/theater/${sessionId}/status`)
      await set(statusRef, type === "play" ? "playing" : "paused")
    }

    // Update current time
    const timeRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/theater/${sessionId}/currentTime`)
    await set(timeRef, currentTime)
  }

  // Explicitly set session status
  async setStatus(roomId: string, sessionId: string, status: TheaterSession["status"]) {
    if (!getFirebaseDatabase()!) return
    const statusRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/theater/${sessionId}/status`)
    await set(statusRef, status)
  }

  // Transfer host ownership
  async transferHost(roomId: string, sessionId: string, newHostId: string, newHostName: string) {
    if (!getFirebaseDatabase()!) return
    const sessionPath = `rooms/${roomId}/theater/${sessionId}`
    await set(ref(getFirebaseDatabase()!, `${sessionPath}/hostId`), newHostId)
    await set(ref(getFirebaseDatabase()!, `${sessionPath}/hostName`), newHostName)
  }

  // Start host heartbeat - call this periodically from the host's client
  startHostHeartbeat(roomId: string, sessionId: string, hostId: string) {
    if (this.hostHeartbeatInterval) {
      clearInterval(this.hostHeartbeatInterval)
    }

    this.lastHeartbeat = Date.now()

    // Update heartbeat every 5 seconds
    this.hostHeartbeatInterval = setInterval(async () => {
      if (!getFirebaseDatabase()) return

      this.lastHeartbeat = Date.now()
      await set(
        ref(getFirebaseDatabase()!, `rooms/${roomId}/theater/${sessionId}/lastHeartbeat`),
        this.lastHeartbeat
      )
    }, 5000)
  }

  // Stop host heartbeat
  stopHostHeartbeat() {
    if (this.hostHeartbeatInterval) {
      clearInterval(this.hostHeartbeatInterval)
      this.hostHeartbeatInterval = null
    }
  }

  // Monitor host presence - returns unsubscribe function
  monitorHostPresence(
    roomId: string,
    sessionId: string,
    onHostGone: (newHostId: string, newHostName: string) => void,
    heartbeatTimeout: number = 15000 // 15 seconds timeout
  ): () => void {
    if (!getFirebaseDatabase()) {
      return () => { }
    }

    const sessionRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/theater/${sessionId}`)
    let checkInterval: NodeJS.Timeout | null = null

    const unsubscribe = onValue(sessionRef, async (snapshot) => {
      const session = snapshot.val()
      if (!session || !getFirebaseDatabase()) return

      const lastHeartbeat = session.lastHeartbeat
      const currentHostId = session.hostId

      // Check if heartbeat is too old (host may have crashed)
      if (lastHeartbeat && Date.now() - lastHeartbeat > heartbeatTimeout) {
        console.log("[TheaterSignaling] Host heartbeat timeout, initiating handover...")

        // Get participants and find next host
        const participants = session.participants || []
        if (participants.length > 1) {
          // Find a new host (first participant that isn't the old host)
          const newHostId = participants.find((id: string) => id !== currentHostId) || participants[0]
          const newHostName = session.hostName + " (former host)"

          // Transfer host
          await this.transferHost(roomId, sessionId, newHostId, newHostName)

          // Notify about host change
          onHostGone(newHostId, newHostName)
        }
      }
    })

    return () => {
      unsubscribe()
      if (checkInterval) {
        clearInterval(checkInterval)
      }
    }
  }

  // Get current playback state for host handover
  async getPlaybackState(roomId: string, sessionId: string) {
    const db = getFirebaseDatabase()
    if (!db) return null

    const sessionRef = ref(db, `rooms/${roomId}/theater/${sessionId}`)
    const snapshot = await get(sessionRef)

    if (snapshot.exists()) {
      const session = snapshot.val()
      return {
        currentTime: session.currentTime || 0,
        status: session.status || 'paused',
        lastAction: session.lastAction
      }
    }
    return null
  }

  // Send buffering status
  async sendBuffering(
    roomId: string,
    sessionId: string,
    hostId: string,
    hostName: string,
  ) {
    if (!getFirebaseDatabase()!) return

    const action: TheaterAction = {
      type: "buffering",
      timestamp: Date.now(),
      hostId,
      hostName,
    }

    const actionRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/theater/${sessionId}/lastAction`)
    await set(actionRef, action)

    // Update session status
    const statusRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/theater/${sessionId}/status`)
    await set(statusRef, "buffering")
  }

  // Send reaction (emoji)
  async sendReaction(
    roomId: string,
    sessionId: string,
    emoji: string,
    hostId: string,
    hostName: string,
  ) {
    if (!getFirebaseDatabase()!) return

    const action: TheaterAction = {
      type: "reaction",
      timestamp: Date.now(),
      hostId,
      hostName,
      payload: { emoji },
    }

    const actionRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/theater/${sessionId}/lastAction`)
    await set(actionRef, action)
  }

  // Update current time (Drift Correction Heartbeat)
  async updateCurrentTime(roomId: string, sessionId: string, currentTime: number) {
    if (!getFirebaseDatabase()!) return
    const timeRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/theater/${sessionId}/currentTime`)
    await set(timeRef, currentTime)
  }

  // Update theater queue
  async updateQueue(roomId: string, sessionId: string, queue: any[]) {
    if (!getFirebaseDatabase()!) return
    const queueRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/theater/${sessionId}/queue`)
    await set(queueRef, queue)
  }

  // Update playback rate
  async syncPlaybackRate(roomId: string, sessionId: string, rate: number, hostId: string, hostName: string) {
    if (!getFirebaseDatabase()!) return
    const action: TheaterAction = {
      type: "rate_change",
      payload: { rate },
      timestamp: Date.now(),
      hostId,
      hostName
    }
    const actionRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/theater/${sessionId}/lastAction`)
    await set(actionRef, action)
  }

  // Update session media details (video URL/type/status)
  async updateSessionMedia(
    roomId: string,
    sessionId: string,
    videoUrl: string,
    videoType: TheaterSession["videoType"],
    status?: TheaterSession["status"],
    currentTime?: number
  ) {
    if (!getFirebaseDatabase()!) return

    const updates: any = {
      videoUrl,
      videoType,
    }

    if (status) {
      updates.status = status
    }

    if (typeof currentTime === "number") {
      updates.currentTime = currentTime
    }

    await update(ref(getFirebaseDatabase()!, `rooms/${roomId}/theater/${sessionId}`), updates)
  }

  // WebRTC Signaling for Theater (e.g., for movie streaming or high-quality voice)
  async sendSignal(
    roomId: string,
    sessionId: string,
    type: "offer" | "answer" | "ice-candidate" | "bye",
    payload: any,
    fromUserId: string,
    toUserId: string
  ) {
    if (!getFirebaseDatabase()!) return
    const signalId = `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const signalRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/theater/${sessionId}/signals/${toUserId}/${signalId}`)
    await set(signalRef, {
      type,
      payload,
      fromUserId,
      timestamp: Date.now()
    })

    // Auto-remove signal after 10 seconds
    setTimeout(async () => {
      try {
        await remove(signalRef)
      } catch (e) { }
    }, 10000)
  }

  listenForSignals(
    roomId: string,
    sessionId: string,
    userId: string,
    onSignal: (type: string, payload: any, fromUserId: string) => void
  ) {
    const db = getFirebaseDatabase()
    if (!db) return () => { }

    // @ts-ignore
    const { onChildAdded } = require("firebase/database")
    const signalsRef = ref(db, `rooms/${roomId}/theater/${sessionId}/signals/${userId}`)

    const unsubscribe = onChildAdded(signalsRef, (snapshot: any) => {
      const sig = snapshot.val()
      if (sig) {
        onSignal(sig.type, sig.payload, sig.fromUserId)
        // Optionally remove the signal once processed
        remove(snapshot.ref).catch(() => { })
      }
    })
    return unsubscribe
  }

  // End theater session
  async endSession(roomId: string, sessionId: string) {
    if (!getFirebaseDatabase()!) return

    // Update session status to ended
    const statusRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/theater/${sessionId}/status`)
    await set(statusRef, "ended")

    // Clean up after 5 seconds
    setTimeout(async () => {
      try {
        if (!getFirebaseDatabase()!) return
        const sessionRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/theater/${sessionId}`)
        await remove(sessionRef)
      } catch (error) {
        console.error("Error removing theater session:", error)
      }
    }, 5000)

    this.currentSession = null
  }

  // Listen for theater session updates
  listenForSession(roomId: string, sessionId: string, onUpdate: (session: TheaterSession) => void) {
    if (!getFirebaseDatabase()!) {
      console.warn("Firebase database not initialized, theater listening disabled")
      return () => { }
    }

    const sessionRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/theater/${sessionId}`)

    const unsubscribe = onValue(sessionRef, (snapshot) => {
      const session = snapshot.val()
      if (session) {
        this.currentSession = session
        onUpdate(session)

        // If session ended, notify all participants
        if (session.status === "ended") {
          setTimeout(() => {
            onUpdate({ ...session, status: "ended" })
          }, 1000)
        }
      }
    })

    this.theaterListeners.push(unsubscribe)
    return unsubscribe
  }

  // Listen for theater invites
  listenForInvites(roomId: string, userId: string, onInvite: (invite: TheaterInvite) => void) {
    if (!getFirebaseDatabase()!) {
      console.warn("Firebase database not initialized, theater invite listening disabled")
      return () => { }
    }

    const invitesRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/theaterInvites`)

    const unsubscribe = onValue(invitesRef, (snapshot) => {
      const invites = snapshot.val()
      if (invites) {
        Object.values(invites).forEach((invite: any) => {
          // Only show invites from other users
          if (invite.hostId !== userId) {
            onInvite(invite)
          }
        })
      }
    })

    this.theaterListeners.push(unsubscribe)
    return unsubscribe
  }

  // Get current session
  getCurrentSession(): TheaterSession | null {
    return this.currentSession
  }

  // Clean up listeners
  cleanup() {
    this.theaterListeners.forEach((unsubscribe) => unsubscribe())
    this.theaterListeners = []
    this.currentSession = null
  }
}
