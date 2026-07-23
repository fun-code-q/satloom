/**
 * SatLoom Cloud Functions — Phase 13.
 *
 * Currently exports a single scheduled pruner that removes vanish-mode
 * messages whose `expiresAt` is in the past, closing the gap Phase 7
 * left open (in-app pruner is best-effort + author-scoped; if the
 * author never returns, the row lingers on disk).
 *
 * Deploy with: `npm --prefix functions run deploy`
 * Logs:        `npm --prefix functions run logs`
 */

import { onSchedule } from "firebase-functions/v2/scheduler"
import { initializeApp } from "firebase-admin/app"
import { getDatabase } from "firebase-admin/database"
import { logger } from "firebase-functions/v2"

initializeApp()

/**
 * Sweep expired vanish messages.
 *
 * Runs every 5 minutes. For each room, lists messages with
 * `expiresAt` in the past and removes them. Server timestamp is used
 * so client clock skew can't keep a message alive past its TTL.
 *
 * Memory + time: a small room (~100 messages) reads <10 KB and
 * completes in ~50 ms; the function should comfortably handle a few
 * thousand active rooms before needing a fan-out.
 */
export const pruneExpiredVanishMessages = onSchedule(
    {
        schedule: "every 5 minutes",
        timeoutSeconds: 540,
        memory: "256MiB",
        // Recommended in production — limits concurrent invocations:
        // maxInstances: 1,
    },
    async () => {
        const db = getDatabase()
        const roomsSnap = await db.ref("rooms").get()
        if (!roomsSnap.exists()) {
            logger.info("[vanish-pruner] no rooms; nothing to do")
            return
        }

        const now = Date.now()
        let totalDeleted = 0
        let roomsTouched = 0

        const rooms = roomsSnap.val() as Record<string, {
            members?: Record<string, unknown>
            messages?: Record<string, {
                expiresAt?: unknown
                vanishMode?: unknown
                userId?: unknown
                readBy?: Record<string, unknown> | unknown[]
            }>
        }>
        for (const [roomId, room] of Object.entries(rooms)) {
            const messages = room.messages
            if (!messages) continue
            const memberUids = room.members ? Object.keys(room.members) : []
            let perRoom = 0
            const updates: Record<string, null> = {}

            for (const [msgId, msg] of Object.entries(messages)) {
                let shouldDelete = false

                // Reason 1: TTL elapsed.
                const exp = msg?.expiresAt
                if (typeof exp === "number" && exp <= now) {
                    shouldDelete = true
                }

                // Reason 2 (Phase 13 / A5): read-once message and every
                // eligible member has acked.
                if (
                    !shouldDelete &&
                    msg?.vanishMode === "read_once" &&
                    typeof msg?.userId === "string"
                ) {
                    const senderUid = msg.userId
                    const eligible = memberUids.filter((u) => u !== senderUid)
                    if (eligible.length > 0) {
                        const readBy = msg.readBy
                        const readKeys = Array.isArray(readBy)
                            ? new Set(readBy as string[])
                            : new Set(Object.keys((readBy ?? {}) as Record<string, unknown>))
                        const everyoneSaw = eligible.every((u) => readKeys.has(u))
                        if (everyoneSaw) shouldDelete = true
                    }
                }

                if (!shouldDelete) continue
                updates[`rooms/${roomId}/messages/${msgId}`] = null
                perRoom++
            }

            if (perRoom > 0) {
                await db.ref().update(updates)
                totalDeleted += perRoom
                roomsTouched++
            }
        }

        logger.info(
            "[vanish-pruner] sweep complete",
            { totalDeleted, roomsTouched, totalRooms: Object.keys(rooms).length },
        )
    },
)
