import { test } from "@playwright/test"
import { skipWithoutFirebase, spawnPeer, closePeer, newTestRoomId, waitFor, expect } from "./_helpers"

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
            await alice.page.goto(`/satloom/?room=${roomId}`)
            await bob.page.goto(`/satloom/?room=${roomId}`)
            await alice.uid()
            await bob.uid()

            const inputSelector = "textarea[placeholder*='Type'], textarea[placeholder*='Vanish']"
            await alice.page.locator(inputSelector).first().waitFor({ timeout: 20_000 })
            await bob.page.locator(inputSelector).first().waitFor({ timeout: 20_000 })

            // Alice writes a vanish message directly via Firebase. We
            // bypass the chat-input encrypt path so the marker text
            // shows up plain in Bob's DOM (no decryption dance) — the
            // assertion target is the *visibility lifecycle*, not the
            // content path.
            const marker = `vanish-${Date.now()}`
            await alice.page.evaluate(async ({ rid, text }) => {
                const w = window as unknown as {
                    firebase?: { database?: () => { ref: (p: string) => { push: () => { key: string | null; set: (v: unknown) => Promise<unknown> } } } }
                }
                const db = w.firebase?.database?.()
                if (!db) throw new Error("Firebase not initialised")
                const ref = db.ref(`rooms/${rid}/messages`)
                const newRef = ref.push()
                // expiresAt 3 seconds from now: visible briefly, then filtered.
                await newRef.set({
                    text,
                    sender: "Alice",
                    userId: "alice-test",
                    userName: "Alice",
                    timestamp: Date.now(),
                    expiresAt: Date.now() + 3_000,
                    vanishMode: "timed",
                    reactions: { heart: [], thumbsUp: [] },
                })
            }, { rid: roomId, text: marker })

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
