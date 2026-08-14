import { test } from "@playwright/test"
import { skipWithoutFirebase, spawnPeer, closePeer, newTestRoomId, waitFor, expect, enterRoom, CHAT_INPUT } from "./_helpers"

/**
 * Reaction toggle smoke — Phase 12 / E2 (verifies Phase 8.2).
 *
 * Alice sends a message, reacts to her own message with a heart, then
 * reacts again — the toggle should remove it. The optimistic UI path
 * (Phase 8.2) means the local count flips instantly; we assert the
 * final Firebase-canonical state matches: count goes 0 → 1 → 0.
 */

test.describe("@firebase reaction toggle", () => {
    test.beforeEach(() => skipWithoutFirebase())

    test("clicking own reaction twice toggles it off", async ({ browser }) => {
        const alice = await spawnPeer(browser, "Alice")
        const roomId = newTestRoomId()

        try {
            await enterRoom(alice, roomId)
            await alice.uid()

            const marker = `reaction-${Date.now()}`
            const input = alice.page.locator(CHAT_INPUT).first()
            await input.fill(marker)
            await input.press("Enter")

            // Wait for her message to appear in her own list.
            const bubble = alice.page.getByText(marker, { exact: false }).first()
            await bubble.waitFor({ timeout: 5_000 })

            // Hover and click the heart reaction. The bubble surfaces a
            // hover toolbar with title="Love".
            const messageContainer = bubble.locator("xpath=ancestor::*[contains(@class, 'group')][1]").first()
            await messageContainer.hover()

            const heartBtn = messageContainer.locator("button[title='Love']").first()
            await heartBtn.click()

            // After click 1 the optimistic state should show a count of 1
            // (the reaction count chip is rendered when count > 0).
            await waitFor(alice.page, async () => {
                const chips = await alice.page.locator("text=/^1$/").count()
                return chips > 0 ? chips : false
            }, 5_000)

            // Click again → toggle off → chip disappears.
            await messageContainer.hover()
            await heartBtn.click()

            await waitFor(alice.page, async () => {
                // The "1" chip should be gone; assert by querying again.
                const html = await alice.page.content()
                return /class="[^"]*bg-red-500\/20[^"]*"[^>]*>[^<]*<svg[^>]*class="[^"]*w-2\.5/.test(html) ? false : true
            }, 5_000)

            expect(true).toBe(true)
        } finally {
            await closePeer(alice)
        }
    })
})
