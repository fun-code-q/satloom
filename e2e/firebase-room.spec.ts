import { test } from "@playwright/test"
import { skipWithoutFirebase, spawnPeer, closePeer, newTestRoomId, waitFor, expect } from "./_helpers"

/**
 * Credentialed Firebase room-flow smoke — Phase 12.
 *
 * Two anonymous browser contexts create + join a room and verify each
 * sees the other in the member list. This is the canary for the whole
 * Phase 1 rules contract: if a non-member can't join, this fails; if
 * member-list reads break, this fails; if anonymous auth breaks, this
 * fails.
 *
 * Skipped without `PLAYWRIGHT_HAS_FIREBASE=true` + real env vars.
 */

test.describe("@firebase room flow", () => {
    test.beforeEach(() => skipWithoutFirebase())

    test("two peers see each other in the same room", async ({ browser }) => {
        const alice = await spawnPeer(browser, "Alice")
        const bob = await spawnPeer(browser, "Bob")
        const roomId = newTestRoomId()

        try {
            // Alice creates the room by navigating to the deep link.
            // The app's "join existing" flow accepts any room ID from
            // the URL; if Firebase doesn't know it, Alice becomes the
            // creator.
            await alice.page.goto(`/satloom/?room=${roomId}`)
            await bob.page.goto(`/satloom/?room=${roomId}`)

            // Both peers should reach the chat surface — wait for the
            // member list panel to be present (any element tagged with
            // either room id or members container).
            const aliceUid = await alice.uid()
            const bobUid = await bob.uid()
            expect(aliceUid).not.toBe(bobUid)

            // Confirm both see at least 2 distinct UIDs in the live
            // Firebase members snapshot (read via the page's evaluate
            // since Playwright can't poke Firebase directly from CI).
            for (const peer of [alice, bob]) {
                const memberCount = await waitFor(peer.page, async () => {
                    const n = await peer.page.evaluate(async (rid) => {
                        const w = window as unknown as {
                            firebase?: { database?: () => { ref: (p: string) => { get: () => Promise<{ val: () => unknown }> } } }
                        }
                        const db = w.firebase?.database?.()
                        if (!db) return 0
                        try {
                            const snap = await db.ref(`rooms/${rid}/members`).get()
                            const v = snap.val()
                            return v && typeof v === "object" ? Object.keys(v).length : 0
                        } catch {
                            return 0
                        }
                    }, roomId)
                    return n >= 2 ? n : false
                }, 20_000)
                expect(memberCount).toBeGreaterThanOrEqual(2)
            }
        } finally {
            await closePeer(alice)
            await closePeer(bob)
        }
    })
})
