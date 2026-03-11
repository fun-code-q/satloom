import { getFirebaseDatabase } from "@/lib/firebase"
import { ref, get, set, update } from "firebase/database"
import { GameState } from "./dots-and-boxes-game"

export class DotsBoxesManager {
    private static instance: DotsBoxesManager

    static getInstance(): DotsBoxesManager {
        if (!DotsBoxesManager.instance) {
            DotsBoxesManager.instance = new DotsBoxesManager()
        }
        return DotsBoxesManager.instance
    }

    /**
     * Join an existing Dots & Boxes game session
     */
    async joinGame(roomId: string, gameId: string, playerId: string, playerName: string, avatar?: string): Promise<boolean> {
        const db = getFirebaseDatabase()
        if (!db) return false

        try {
            const gameRef = ref(db, `games/${roomId}/${gameId}`)
            const snapshot = await get(gameRef)

            if (!snapshot.exists()) {
                console.error("DotsBoxesManager: Game not found:", gameId)
                return false
            }

            const gameState = snapshot.val() as GameState

            // Find the slot for the guest player
            // In a 2-player game, index 0 is host, index 1 is guest
            const players = [...gameState.players]

            // Look for a player slot that matches the expected placeholder/guest criteria
            let joined = false
            for (let i = 0; i < players.length; i++) {
                if (!players[i].isHost && !players[i].isComputer && (players[i].id.startsWith('player_') || players[i].name.includes('Waiting'))) {
                    players[i] = {
                        ...players[i],
                        id: playerId,
                        name: playerName,
                        avatar: avatar,
                        status: 'active',
                        isReady: true,
                        lastSeen: Date.now()
                    }
                    joined = true
                    break
                }
            }

            if (!joined) {
                console.warn("DotsBoxesManager: No available slot found for player to join")
                return false
            }

            // Update the game state with the new players list
            await update(gameRef, {
                players,
                lastUpdated: Date.now()
            })

            console.log(`DotsBoxesManager: Player ${playerName} joined game ${gameId}`)
            return true
        } catch (error) {
            console.error("DotsBoxesManager: Error joining game:", error)
            return false
        }
    }
}
