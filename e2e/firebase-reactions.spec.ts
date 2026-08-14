import { test } from "@playwright/test"
import { skipWithoutFirebase, spawnPeer, closePeer, newTestRoomId, waitFor, expect, enterRoom, CHAT_INPUT, rtdbRead } from "./_helpers"

/**
 * Reaction toggle smoke — Phase 12 / E2 (verifies Phase 8.2).
 *
 * Alice sends a message, reacts to her own message with a heart, then
 * reacts again — the toggle should remove it. The optimistic UI path
 * (Phase 8.2) means the local count flips instantly; we assert the
 * final Firebase-canonical state matches: count goes 0 → 1 → 0.
 */

test.describe("@firebase reaction toggle", () => {
    // The global 60s budget is tight here: enterRoom can spend up to 50s on
    // its two waits on a cold compile, before this spec even sends a message
    // and polls Firebase twice for the canonical reaction state.
    test.setTimeout(120_000)
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

            // The reaction toolbar is revealed by hovering the `group/msg`
            // wrapper. It is a SIBLING of the bubble, not a descendant — the
            // bubble is overflow-hidden, so the toolbar has to live outside it
            // to avoid being clipped. Scoping to the bubble's nearest `group`
            // ancestor therefore finds no buttons at all.
            const row = bubble.locator("xpath=ancestor::div[contains(@class,'message-virtual-row')][1]").first()
            const heartBtn = row.locator("button[title='Love']").first()

            await row.hover()
            await heartBtn.click()

            // Assert on the canonical Firebase state rather than scraping the
            // rendered HTML for a chip class. The old version regex-matched
            // page.content() for a Tailwind class, which silently passes the
            // moment that class is restyled.
            const heartsAfterFirst = await waitFor(alice.page, async () => {
                const hearts = await rtdbRead(alice, `rooms/${roomId}/messages`)
                    .then((msgs) => {
                        const m = Object.values((msgs ?? {}) as Record<string, { text?: string; reactions?: { heart?: unknown } }>)
                        const mine = m.find((x) => typeof x?.text === "string")
                        const h = mine?.reactions?.heart
                        return h && typeof h === "object" ? Object.keys(h).length : 0
                    })
                    .catch(() => 0)
                return hearts > 0 ? hearts : false
            }, 10_000)
            expect(heartsAfterFirst).toBe(1)

            // Click again → toggle off.
            await row.hover()
            await heartBtn.click()

            const clearedAgain = await waitFor(alice.page, async () => {
                const hearts = await rtdbRead(alice, `rooms/${roomId}/messages`)
                    .then((msgs) => {
                        const m = Object.values((msgs ?? {}) as Record<string, { text?: string; reactions?: { heart?: unknown } }>)
                        const mine = m.find((x) => typeof x?.text === "string")
                        const h = mine?.reactions?.heart
                        return h && typeof h === "object" ? Object.keys(h).length : 0
                    })
                    .catch(() => 1)
                return hearts === 0 ? true : false
            }, 10_000)
            expect(clearedAgain).toBe(true)
        } finally {
            await closePeer(alice)
        }
    })
})

