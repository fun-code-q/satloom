import { test } from "@playwright/test"
import { skipWithoutFirebase, spawnPeer, closePeer, newTestRoomId, waitFor, expect, enterRoom, rtdbRead } from "./_helpers"

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
            await enterRoom(alice, roomId)
            await enterRoom(bob, roomId)

            const aliceUid = await alice.uid()
            const bobUid = await bob.uid()
            expect(aliceUid).not.toBe(bobUid)

            // Confirm each peer can read the members node and sees both of
            // them. Read over the RTDB REST API as that peer, so the live
            // security rules are exercised as that real user — this is the
            // canary for the membership read-gate.
            //
            // The previous version called window.firebase.database(), the v8
            // compat namespace. The app uses the modular SDK, which never
            // creates it, so the count was always 0 and this spec could not
            // pass regardless of whether the room flow worked.
            for (const peer of [alice, bob]) {
                const memberCount = await waitFor(peer.page, async () => {
                    const members = await rtdbRead(peer, `rooms/${roomId}/members`).catch(() => null)
                    const n = members && typeof members === "object" ? Object.keys(members).length : 0
                    return n >= 2 ? n : false
                }, 20_000)
                expect(memberCount).toBeGreaterThanOrEqual(2)

                const members = (await rtdbRead(peer, `rooms/${roomId}/members`)) as Record<string, unknown>
                expect(Object.keys(members)).toEqual(expect.arrayContaining([aliceUid, bobUid]))
            }
        } finally {
            await closePeer(alice)
            await closePeer(bob)
        }
    })
})
