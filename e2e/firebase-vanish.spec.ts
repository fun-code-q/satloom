import { test } from "@playwright/test"
import { skipWithoutFirebase, spawnPeer, closePeer, newTestRoomId, waitFor, expect, enterRoom, rtdbPush } from "./_helpers"

/**
 * Vanish-mode TTL smoke — Phase 12 / E2 (verifies Phase 7).
 *
 * Alice writes a message directly to Firebase with `expiresAt = now+3s`
 * (simulating a vanish-mode message). Bob loads the room and verifies:
 *   1. The message is briefly visible.
 *   2. After the TTL elapses (and the local read-filter ticks), it's gone.
 *
 * This is a "user contract" test, not a "pruner removed it from disk"
 * test — that part is a server-side Cloud Function concern (Phase 13).
 * Here we exercise the read-filter behaviour the user actually sees.
 */

test.describe("@firebase vanish mode", () => {
    test.beforeEach(() => skipWithoutFirebase())

    test("message with expiresAt < now is hidden from the receiver", async ({ browser }) => {
        const alice = await spawnPeer(browser, "Alice")
        const bob = await spawnPeer(browser, "Bob")
        const roomId = newTestRoomId()

        try {
            await enterRoom(alice, roomId)
            await enterRoom(bob, roomId)
            const aliceUid = await alice.uid()
            await bob.uid()

            // Alice writes a vanish message directly via Firebase. We
            // bypass the chat-input encrypt path so the marker text
            // shows up plain in Bob's DOM (no decryption dance) — the
            // assertion target is the *visibility lifecycle*, not the
            // content path.
            const marker = `vanish-${Date.now()}`
            // Written over the RTDB REST API as Alice. The previous version
            // used window.firebase.database() (v8 compat, absent under the
            // modular SDK) and hard-coded userId "alice-test", which the
            // security rules reject outright — authorship must match the
            // caller's auth uid.
            await rtdbPush(alice, `rooms/${roomId}/messages`, {
                text: marker,
                sender: "Alice",
                userId: aliceUid,
                userName: "Alice",
                timestamp: Date.now(),
                // 3s TTL: visible briefly, then filtered by the client.
                expiresAt: Date.now() + 3_000,
                vanishMode: "timed",
            })

            // Bob should see it within 5 seconds (initial render).
            await waitFor(bob.page, async () => {
                return (await bob.page.getByText(marker).first().isVisible().catch(() => false)) || null
            }, 5_000)

            // Then it should disappear within 10 seconds (3 s TTL +
            // tolerance for the listener filter).
            await waitFor(bob.page, async () => {
                const stillThere = await bob.page.getByText(marker).first().isVisible().catch(() => false)
                return stillThere ? false : true
            }, 10_000)

            expect(true).toBe(true)
        } finally {
            await closePeer(alice)
            await closePeer(bob)
        }
    })
})
