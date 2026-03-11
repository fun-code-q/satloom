import { getFirebaseDatabase } from "@/lib/firebase"
import { ref, set, onValue, remove, push, serverTimestamp, get, update, onChildAdded, onChildRemoved } from "firebase/database"
import type { GameState, Move, Player } from "@/utils/games/dots-and-boxes-game"

// Game Invitation Interface
export interface GameInvite {
  id: string
  roomId: string
  gameId: string
  hostId: string
  hostName: string
  invitedUsers: string[] // Array of user IDs or ['all'] for everyone
  gameConfig: any
  expiresAt: number
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  timestamp: number
}

// Lobby State Interface
export interface LobbyState {
  gameId: string
  roomId: string
  host: Player
  players: Player[]
  spectators: Player[]
  settings: {
    gridSize: number
    maxPlayers: number
    voiceChatEnabled: boolean
    allowComputerPlayers: boolean
  }
  status: 'waiting' | 'starting' | 'in-progress'
  readyPlayers: string[] // Array of player IDs who are ready
  kickedUsers: string[] // Temporarily kicked users
  createdAt: number
  lastUpdated: number
}

export type JoinResult = {
  success: boolean
  error?: 'GAME_FULL' | 'KICKED' | 'ALREADY_STARTED' | 'INVALID_NAME' | 'DUPLICATE_NAME'
  assignedColor?: string
  playerSlot?: number
}

export type LeaveReason = 'voluntary' | 'kicked' | 'disconnected' | 'timeout'

export class GameSignaling {
  private static instance: GameSignaling
  private gameListeners: Array<() => void> = []

  static getInstance(): GameSignaling {
    if (!GameSignaling.instance) {
      GameSignaling.instance = new GameSignaling()
    }
    return GameSignaling.instance
  }

  // Create a new game
  async createGame(roomId: string, gameId: string, gameState: GameState, gameType: string = 'dots'): Promise<void> {
    if (!getFirebaseDatabase()!) {
      throw new Error("Firebase database not initialized")
    }

    const gameRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/games/${gameType}/${gameId}`)
    const cleanedState = this.cleanGameState(gameState)

    // Add host status information
    await set(gameRef, {
      ...cleanedState,
      hostActive: true,
      lastUpdated: serverTimestamp(),
    })
  }

  // Update game state
  async updateGame(roomId: string, gameId: string, gameState: Partial<GameState>, gameType: string = 'dots'): Promise<void> {
    if (!getFirebaseDatabase()!) return

    const gameRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/games/${gameType}/${gameId}`)
    const cleanedState = this.cleanGameState(gameState as GameState)

    await update(gameRef, {
      ...cleanedState,
      lastUpdated: serverTimestamp(),
    })
  }

  // Set host status (active/inactive)
  async setHostStatus(roomId: string, gameId: string, isActive: boolean, gameType: string = 'dots'): Promise<void> {
    if (!getFirebaseDatabase()!) return

    const hostStatusRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/games/${gameType}/${gameId}/hostActive`)
    await set(hostStatusRef, isActive)
  }

  // Listen for host status changes
  listenForHostStatus(roomId: string, gameId: string, onStatusChange: (isActive: boolean) => void, gameType: string = 'dots') {
    if (!getFirebaseDatabase()!) {
      console.warn("Firebase database not initialized, host status listening disabled")
      return () => { }
    }

    const hostStatusRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/games/${gameType}/${gameId}/hostActive`)

    const unsubscribe = onValue(hostStatusRef, (snapshot) => {
      const isActive = snapshot.val()
      onStatusChange(isActive)
    })

    this.gameListeners.push(unsubscribe)
    return unsubscribe
  }

  // Send a move
  async sendMove(roomId: string, gameId: string, move: Move, gameType: string = 'dots'): Promise<void> {
    if (!getFirebaseDatabase()!) return

    const moveRef = push(ref(getFirebaseDatabase()!, `rooms/${roomId}/games/${gameType}/${gameId}/moves`))
    await set(moveRef, move)
  }

  // Listen for game updates
  listenForGame(roomId: string, gameId: string, onUpdate: (gameState: GameState) => void, gameType: string = 'dots') {
    if (!getFirebaseDatabase()!) {
      console.warn("Firebase database not initialized, game listening disabled")
      return () => { }
    }

    const gameRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/games/${gameType}/${gameId}`)

    const unsubscribe = onValue(gameRef, (snapshot) => {
      const gameState = snapshot.val()
      if (gameState) {
        // Remove Firebase-specific fields before passing to game logic
        const { hostActive, lastUpdated, ...cleanGameState } = gameState
        onUpdate(cleanGameState as GameState)
      }
    })

    this.gameListeners.push(unsubscribe)
    return unsubscribe
  }

  // Listen for moves
  listenForMoves(roomId: string, gameId: string, onMove: (move: Move) => void, gameType: string = 'dots') {
    if (!getFirebaseDatabase()!) {
      console.warn("Firebase database not initialized, move listening disabled")
      return () => { }
    }

    const movesRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/games/${gameType}/${gameId}/moves`)

    const unsubscribe = onValue(movesRef, (snapshot) => {
      const moves = snapshot.val()
      if (moves) {
        // Get the latest move
        const moveKeys = Object.keys(moves)
        const latestMoveKey = moveKeys[moveKeys.length - 1]
        const latestMove = moves[latestMoveKey]
        onMove(latestMove)
      }
    })

    this.gameListeners.push(unsubscribe)
    return unsubscribe
  }

  // End game
  async endGame(roomId: string, gameId: string, gameType: string = 'dots'): Promise<void> {
    if (!getFirebaseDatabase()!) return

    const gameRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/games/${gameType}/${gameId}`)
    await remove(gameRef)
  }

  // Clean game state for Firebase (remove functions and complex objects)
  private cleanGameState(gameState: GameState): any {
    // Create a deep copy of the game state
    const cleanState = JSON.parse(JSON.stringify(gameState))

    // Handle undefined winner property
    if (cleanState.winner === undefined) {
      cleanState.winner = null // Replace undefined with null for Firebase
    }

    // Add moveCount if it doesn't exist
    if (cleanState.moveCount === undefined) {
      cleanState.moveCount = 0
    }

    // Ensure all nested objects are properly serializable
    return {
      ...cleanState,
      grid: cleanState.grid,
      horizontalLines: cleanState.horizontalLines,
      verticalLines: cleanState.verticalLines,
      boxes: cleanState.boxes,
    }
  }

  // ============================================================
  // PHASE 1: GAME INVITATIONS
  // ============================================================

  /**
   * Send a game invitation to specific users or all room members
   */
  async sendGameInvite(invite: Omit<GameInvite, 'id' | 'timestamp' | 'status'>): Promise<string> {
    if (!getFirebaseDatabase()!) throw new Error("Firebase database not initialized")

    const invitesRef = ref(getFirebaseDatabase()!, `gameInvites/${invite.roomId}`)
    const newInviteRef = push(invitesRef)
    const inviteId = newInviteRef.key!

    const fullInvite: GameInvite = {
      ...invite,
      id: inviteId,
      timestamp: Date.now(),
      status: 'pending',
    }

    await set(newInviteRef, fullInvite)
    console.log('Game invite sent:', fullInvite)
    return inviteId
  }

  /**
   * Accept a game invitation
   */
  async acceptGameInvite(roomId: string, inviteId: string, playerId: string): Promise<void> {
    if (!getFirebaseDatabase()!) return

    const inviteRef = ref(getFirebaseDatabase()!, `gameInvites/${roomId}/${inviteId}`)
    await update(inviteRef, {
      status: 'accepted',
      [`acceptedBy/${playerId}`]: Date.now(),
    })
  }

  /**
   * Decline a game invitation
   */
  async declineGameInvite(roomId: string, inviteId: string): Promise<void> {
    if (!getFirebaseDatabase()!) return

    const inviteRef = ref(getFirebaseDatabase()!, `gameInvites/${roomId}/${inviteId}`)
    await update(inviteRef, { status: 'declined' })
  }

  /**
   * Listen for game invitations for a specific user
   */
  listenForGameInvites(roomId: string, userId: string, callback: (invite: GameInvite) => void) {
    if (!getFirebaseDatabase()!) {
      console.warn("Firebase database not initialized")
      return () => { }
    }

    const invitesRef = ref(getFirebaseDatabase()!, `gameInvites/${roomId}`)

    const unsubscribe = onValue(invitesRef, (snapshot: any) => {
      const invites = snapshot.val()
      if (invites) {
        Object.values(invites).forEach((invite: any) => {
          // Check if invite is for this user (either in invitedUsers or 'all')
          if (
            invite.status === 'pending' &&
            invite.expiresAt > Date.now() &&
            (invite.invitedUsers.includes('all') || invite.invitedUsers.includes(userId))
          ) {
            callback(invite as GameInvite)
          }
        })
      }
    })

    this.gameListeners.push(unsubscribe)
    return unsubscribe
  }

  /**
   * Broadcast game invite to all room members
   */
  async broadcastGameInvite(
    roomId: string,
    gameId: string,
    hostId: string,
    hostName: string,
    gameConfig: GameInvite['gameConfig']
  ): Promise<string> {
    return this.sendGameInvite({
      roomId,
      gameId,
      hostId,
      hostName,
      invitedUsers: ['all'],
      gameConfig,
      expiresAt: Date.now() + 30000, // 30 seconds
    })
  }

  // ============================================================
  // PHASE 2: LOBBY MANAGEMENT
  // ============================================================

  /**
   * Create a new game lobby
   */
  async createLobby(config: {
    gameId: string
    roomId: string
    host: Player
    settings: LobbyState['settings']
  }): Promise<void> {
    if (!getFirebaseDatabase()!) throw new Error("Firebase database not initialized")

    const lobbyRef = ref(getFirebaseDatabase()!, `lobbies/${config.roomId}/${config.gameId}`)

    const lobby: LobbyState = {
      gameId: config.gameId,
      roomId: config.roomId,
      host: config.host,
      players: [config.host],
      spectators: [],
      settings: config.settings,
      status: 'waiting',
      readyPlayers: [],
      kickedUsers: [],
      createdAt: Date.now(),
      lastUpdated: Date.now(),
    }

    await set(lobbyRef, lobby)
    console.log('Lobby created:', lobby)
  }

  /**
   * Join a game lobby
   */
  async joinLobby(gameId: string, roomId: string, player: Player, asSpectator = false): Promise<JoinResult> {
    if (!getFirebaseDatabase()!) throw new Error("Firebase database not initialized")

    const lobbyRef = ref(getFirebaseDatabase()!, `lobbies/${roomId}/${gameId}`)
    const snapshot = await get(lobbyRef)

    if (!snapshot.exists()) {
      return { success: false, error: 'ALREADY_STARTED' }
    }

    const lobby: LobbyState = snapshot.val()

    // Check if kicked
    if (lobby.kickedUsers.includes(player.id)) {
      return { success: false, error: 'KICKED' }
    }

    // Check if game already started
    if (lobby.status !== 'waiting') {
      return { success: false, error: 'ALREADY_STARTED' }
    }

    // Check for duplicate names
    const existingNames = lobby.players.map(p => p.name.toLowerCase())
    if (existingNames.includes(player.name.toLowerCase())) {
      return { success: false, error: 'DUPLICATE_NAME' }
    }

    if (asSpectator) {
      // Join as spectator
      await update(lobbyRef, {
        spectators: [...lobby.spectators, player],
        lastUpdated: Date.now(),
      })
      return { success: true }
    }

    // Check if lobby is full
    if (lobby.players.length >= lobby.settings.maxPlayers) {
      return { success: false, error: 'GAME_FULL' }
    }

    // Add player to lobby
    await update(lobbyRef, {
      players: [...lobby.players, player],
      lastUpdated: Date.now(),
    })

    return {
      success: true,
      assignedColor: player.color,
      playerSlot: lobby.players.length,
    }
  }

  /**
   * Leave a game lobby
   */
  async leaveLobby(gameId: string, roomId: string, playerId: string, reason: LeaveReason = 'voluntary'): Promise<void> {
    if (!getFirebaseDatabase()!) return

    const lobbyRef = ref(getFirebaseDatabase()!, `lobbies/${roomId}/${gameId}`)
    const snapshot = await get(lobbyRef)

    if (!snapshot.exists()) return

    const lobby: LobbyState = snapshot.val()

    // Remove from players or spectators
    const updatedPlayers = lobby.players.filter(p => p.id !== playerId)
    const updatedSpectators = lobby.spectators.filter(p => p.id !== playerId)

    // If host left, promote next player
    let newHost = lobby.host
    if (lobby.host.id === playerId && updatedPlayers.length > 0) {
      newHost = updatedPlayers[0]
      updatedPlayers[0] = { ...updatedPlayers[0], isHost: true }
    }

    await update(lobbyRef, {
      host: newHost,
      players: updatedPlayers,
      spectators: updatedSpectators,
      readyPlayers: lobby.readyPlayers.filter(id => id !== playerId),
      lastUpdated: Date.now(),
    })

    // If no players left, delete lobby
    if (updatedPlayers.length === 0) {
      await remove(lobbyRef)
    }
  }

  /**
   * Set player ready status
   */
  async setPlayerReady(gameId: string, roomId: string, playerId: string, isReady: boolean): Promise<void> {
    if (!getFirebaseDatabase()!) return

    const lobbyRef = ref(getFirebaseDatabase()!, `lobbies/${roomId}/${gameId}`)
    const snapshot = await get(lobbyRef)

    if (!snapshot.exists()) return

    const lobby: LobbyState = snapshot.val()
    let updatedReadyPlayers = [...lobby.readyPlayers]

    if (isReady && !updatedReadyPlayers.includes(playerId)) {
      updatedReadyPlayers.push(playerId)
    } else if (!isReady) {
      updatedReadyPlayers = updatedReadyPlayers.filter(id => id !== playerId)
    }

    await update(lobbyRef, {
      readyPlayers: updatedReadyPlayers,
      lastUpdated: Date.now(),
    })
  }

  /**
   * Kick a player from lobby (temporary)
   */
  async kickPlayer(gameId: string, roomId: string, playerId: string, kickedBy: string): Promise<void> {
    if (!getFirebaseDatabase()!) return

    const lobbyRef = ref(getFirebaseDatabase()!, `lobbies/${roomId}/${gameId}`)
    const snapshot = await get(lobbyRef)

    if (!snapshot.exists()) return

    const lobby: LobbyState = snapshot.val()

    // Only host can kick
    if (lobby.host.id !== kickedBy) return

    const updatedPlayers = lobby.players.filter(p => p.id !== playerId)
    const updatedKickedUsers = [...lobby.kickedUsers, playerId]

    await update(lobbyRef, {
      players: updatedPlayers,
      kickedUsers: updatedKickedUsers,
      readyPlayers: lobby.readyPlayers.filter(id => id !== playerId),
      lastUpdated: Date.now(),
    })
  }

  /**
   * Promote a player to host
   */
  async promoteToHost(gameId: string, roomId: string, newHostId: string): Promise<void> {
    if (!getFirebaseDatabase()!) return

    const lobbyRef = ref(getFirebaseDatabase()!, `lobbies/${roomId}/${gameId}`)
    const snapshot = await get(lobbyRef)

    if (!snapshot.exists()) return

    const lobby: LobbyState = snapshot.val()
    const newHost = lobby.players.find(p => p.id === newHostId)

    if (!newHost) return

    // Update host status for all players
    const updatedPlayers = lobby.players.map(p => ({
      ...p,
      isHost: p.id === newHostId,
    }))

    await update(lobbyRef, {
      host: { ...newHost, isHost: true },
      players: updatedPlayers,
      lastUpdated: Date.now(),
    })
  }

  /**
   * Start game from lobby
   */
  async startGameFromLobby(gameId: string, roomId: string): Promise<void> {
    if (!getFirebaseDatabase()!) return

    const lobbyRef = ref(getFirebaseDatabase()!, `lobbies/${roomId}/${gameId}`)
    await update(lobbyRef, {
      status: 'in-progress',
      lastUpdated: Date.now(),
    })
  }

  /**
   * Listen for lobby changes
   */
  listenForLobbyChanges(gameId: string, roomId: string, callback: (lobby: LobbyState | null) => void) {
    if (!getFirebaseDatabase()!) {
      console.warn("Firebase database not initialized")
      return () => { }
    }

    const lobbyRef = ref(getFirebaseDatabase()!, `lobbies/${roomId}/${gameId}`)

    const unsubscribe = onValue(lobbyRef, (snapshot: any) => {
      const lobby = snapshot.val()
      callback(lobby as LobbyState | null)
    })

    this.gameListeners.push(unsubscribe)
    return unsubscribe
  }

  /**
   * Update lobby settings (host only)
   */
  async updateLobbySettings(
    gameId: string,
    roomId: string,
    settings: Partial<LobbyState['settings']>
  ): Promise<void> {
    if (!getFirebaseDatabase()!) return

    const lobbyRef = ref(getFirebaseDatabase()!, `lobbies/${roomId}/${gameId}/settings`)
    await update(lobbyRef, settings)
  }

  // ============================================================
  // PHASE 5: JOIN/LEAVE MECHANICS WITH REJOIN
  // ============================================================

  /**
   * Mark player as disconnected (allows rejoin within timeout)
   */
  async markPlayerDisconnected(gameId: string, roomId: string, playerId: string): Promise<void> {
    if (!getFirebaseDatabase()!) return

    const lobbyRef = ref(getFirebaseDatabase()!, `lobbies/${roomId}/${gameId}`)
    const snapshot = await get(lobbyRef)

    if (!snapshot.exists()) return

    const lobby: LobbyState = snapshot.val()
    const updatedPlayers = lobby.players.map(p =>
      p.id === playerId
        ? { ...p, status: 'disconnected' as const, lastSeen: Date.now() }
        : p
    )

    await update(lobbyRef, {
      players: updatedPlayers,
      lastUpdated: Date.now(),
    })
  }

  /**
   * Rejoin game after disconnection
   */
  async rejoinGame(gameId: string, roomId: string, playerId: string): Promise<JoinResult> {
    if (!getFirebaseDatabase()!) throw new Error("Firebase database not initialized")

    const lobbyRef = ref(getFirebaseDatabase()!, `lobbies/${roomId}/${gameId}`)
    const snapshot = await get(lobbyRef)

    if (!snapshot.exists()) {
      return { success: false, error: 'ALREADY_STARTED' }
    }

    const lobby: LobbyState = snapshot.val()
    const disconnectedPlayer = lobby.players.find(p => p.id === playerId && p.status === 'disconnected')

    if (!disconnectedPlayer) {
      return { success: false, error: 'INVALID_NAME' }
    }

    // Check if rejoin timeout has expired (5 minutes)
    const REJOIN_TIMEOUT = 5 * 60 * 1000 // 5 minutes
    if (Date.now() - disconnectedPlayer.lastSeen > REJOIN_TIMEOUT) {
      // Remove player if timeout expired
      await this.leaveLobby(gameId, roomId, playerId, 'timeout')
      return { success: false, error: 'ALREADY_STARTED' }
    }

    // Restore player to active status
    const updatedPlayers = lobby.players.map(p =>
      p.id === playerId
        ? { ...p, status: 'active' as const, lastSeen: Date.now() }
        : p
    )

    await update(lobbyRef, {
      players: updatedPlayers,
      lastUpdated: Date.now(),
    })

    return {
      success: true,
      assignedColor: disconnectedPlayer.color,
    }
  }

  /**
   * Remove inactive players (called periodically)
   */
  async removeInactivePlayers(gameId: string, roomId: string): Promise<void> {
    if (!getFirebaseDatabase()!) return

    const lobbyRef = ref(getFirebaseDatabase()!, `lobbies/${roomId}/${gameId}`)
    const snapshot = await get(lobbyRef)

    if (!snapshot.exists()) return

    const lobby: LobbyState = snapshot.val()
    const REJOIN_TIMEOUT = 5 * 60 * 1000 // 5 minutes
    const now = Date.now()

    // Find players who have been disconnected too long
    const expiredPlayerIds = lobby.players
      .filter(p => p.status === 'disconnected' && now - p.lastSeen > REJOIN_TIMEOUT)
      .map(p => p.id)

    // Remove expired players
    for (const playerId of expiredPlayerIds) {
      await this.leaveLobby(gameId, roomId, playerId, 'timeout')
    }
  }

  /**
   * Check if player can rejoin
   */
  async canPlayerRejoin(gameId: string, roomId: string, playerId: string): Promise<boolean> {
    if (!getFirebaseDatabase()!) return false

    const lobbyRef = ref(getFirebaseDatabase()!, `lobbies/${roomId}/${gameId}`)
    const snapshot = await get(lobbyRef)

    if (!snapshot.exists()) return false

    const lobby: LobbyState = snapshot.val()
    const player = lobby.players.find(p => p.id === playerId)

    if (!player || player.status !== 'disconnected') return false

    const REJOIN_TIMEOUT = 5 * 60 * 1000
    return Date.now() - player.lastSeen <= REJOIN_TIMEOUT
  }

  // Clean up listeners
  cleanup() {
    this.gameListeners.forEach((unsubscribe) => unsubscribe())
    this.gameListeners = []
  }
}
