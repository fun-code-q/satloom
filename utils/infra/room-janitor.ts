import { getFirebaseDatabase } from "@/lib/firebase"
import { ref, get, remove, serverTimestamp, set } from "firebase/database"

/**
 * Client-assisted zombie-room cleanup.
 *
 * Without Cloud Functions there's no server-side TTL. Instead, every time a
 * user joins or creates a room, we opportunistically check the room they're
 * touching — if it has no live presence entries AND the last activity was
 * more than ROOM_IDLE_TTL_MS ago, it counts as abandoned and we purge it
 * along with its side-channels (burner links, game state, etc).
 *
 * Only the creator can purge under our rules, so in practice this runs only
 * when the creator returns. For orphaned rooms (creator gone permanently), a
 * scheduled cleanup job would be needed — out of scope for Phase 1.
 *
 * Also updates `lastActivityAt` on the room so our "idle" check has real data.
 */

const ROOM_IDLE_TTL_MS = 15 * 60 * 1000 // 15 minutes

export async function touchRoomActivity(roomId: string): Promise<void> {
  const db = getFirebaseDatabase()
  if (!db) return
  try {
    await set(ref(db, `rooms/${roomId}/lastActivityAt`), serverTimestamp())
  } catch {
    // Non-members can't write here; ignore.
  }
}

/**
 * If the given room has been empty and idle for longer than ROOM_IDLE_TTL_MS,
 * purge it and all related data. Safe to call from any client; rules ensure
 * only the creator can actually destroy the room.
 *
 * Returns true if the room was purged.
 */
export async function purgeIfZombie(roomId: string, currentUserId: string): Promise<boolean> {
  const db = getFirebaseDatabase()
  if (!db) return false

  try {
    const roomSnap = await get(ref(db, `rooms/${roomId}`))
    if (!roomSnap.exists()) return false

    const room = roomSnap.val() as {
      createdByUid?: string
      lastActivityAt?: number
      createdAt?: number
      presence?: Record<string, unknown>
    }

    // Only the creator can purge (rules enforce). Bail out early if we aren't.
    if (room.createdByUid !== currentUserId) return false

    const presentCount = Object.keys(room.presence || {}).length
    if (presentCount > 0) return false // Room has live users.

    const lastActivity = typeof room.lastActivityAt === "number" ? room.lastActivityAt : room.createdAt ?? 0
    const idleMs = Date.now() - lastActivity
    if (idleMs < ROOM_IDLE_TTL_MS) return false

    console.log(`[RoomJanitor] Purging zombie room ${roomId} (idle ${Math.round(idleMs / 1000)}s)`)

    await Promise.all([
      remove(ref(db, `rooms/${roomId}`)),
      remove(ref(db, `calls/${roomId}`)),
      remove(ref(db, `games/${roomId}`)),
      // Mafia was removed as a feature, but these nodes may still hold data
      // written by older clients — keep sweeping them so zombie rooms don't
      // leave orphans behind. The matching rules stay in firebase-rules.json
      // for the same reason; without them these removes would be denied.
      remove(ref(db, `mafia/${roomId}`)),
      remove(ref(db, `mafiaRoles/${roomId}`)),
      remove(ref(db, `mafiaNightActions/${roomId}`)),
      remove(ref(db, `theater/${roomId}`)),
      remove(ref(db, `karaoke/${roomId}`)),
      remove(ref(db, `presentations/${roomId}`)),
      remove(ref(db, `whiteboards/${roomId}`)),
    ])
    return true
  } catch (err) {
    console.warn("[RoomJanitor] purge failed:", err)
    return false
  }
}
