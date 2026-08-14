import { test } from "@playwright/test"
import { skipWithoutFirebase, spawnPeer, closePeer, newTestRoomId, waitFor, expect, enterRoom, CHAT_INPUT } from "./_helpers"

/**
 * Credentialed Firebase message round-trip — Phase 12 / E1.
 *
 * Verifies the chat-store + Firebase pipeline end-to-end:
 *   sender writes message → Firebase rules accept → listener fires →
 *   receiver decrypts → message visible in the receiver's DOM.
 *
 * Regression-guards every layer touched by Phases 1, 6, 6.5, 8.
 */

test.describe("@firebase chat message round-trip", () => {
    test.beforeEach(() => skipWithoutFirebase())

    test("message sent by Alice appears in Bob's chat within 5 s", async ({ browser }) => {
        const alice = await spawnPeer(browser, "Alice")
        const bob = await spawnPeer(browser, "Bob")
        const roomId = newTestRoomId()

        try {
            // enterRoom drives the profile modal and waits for the composer.
            await enterRoom(alice, roomId)
            await enterRoom(bob, roomId)
            await alice.uid()
            await bob.uid()

            // Alice sends a message with a unique marker.
            const marker = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
            const input = alice.page.locator(CHAT_INPUT).first()
            await input.fill(marker)
            await input.press("Enter")

            // Bob should see the marker text in his DOM within 5 seconds.
            await waitFor(bob.page, async () => {
                const found = await bob.page.getByText(marker, { exact: false }).first().isVisible().catch(() => false)
                return found || null
            }, 5_000)

            expect(true).toBe(true) // waitFor would have thrown otherwise
        } finally {
            await closePeer(alice)
            await closePeer(bob)
        }
    })
})
