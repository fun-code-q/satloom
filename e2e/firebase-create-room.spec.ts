import { test } from "@playwright/test"
import { skipWithoutFirebase, spawnPeer, closePeer, CHAT_INPUT, expect } from "./_helpers"

/**
 * Room CREATION via the landing page button.
 *
 * This covers a path every other credentialed spec misses. They all enter a
 * room with `?room=<id>`, which takes the *join* branch of handleProfileSave.
 * The Create Room button takes the other branch, and that branch does a
 * collision check:
 *
 *     get(ref(db, `rooms/${candidate}`))
 *
 * on a room id that by definition does not exist yet — so the caller is not
 * a member of it. When the membership-gated read rule shipped, that read was
 * denied and room creation broke in production while all six credentialed
 * specs stayed green. The rule now permits reading a non-existent room
 * (`!data.exists()`), which returns null and discloses nothing beyond whether
 * an id is taken.
 *
 * Keep this spec: it is the only guard on the create path.
 */

test.describe("@firebase room creation", () => {
    test.setTimeout(120_000)
    test.beforeEach(() => skipWithoutFirebase())

    test("Create Room reaches a usable chat surface without permission errors", async ({ browser }) => {
        const creator = await spawnPeer(browser, "Creator")

        const denials: string[] = []
        creator.page.on("console", (m) => {
            if (m.type() === "error" && /permission denied/i.test(m.text())) denials.push(m.text())
        })
        creator.page.on("pageerror", (e) => {
            if (/permission denied/i.test(e.message)) denials.push(e.message)
        })

        try {
            await creator.page.goto("/satloom/")

            // Wait for anonymous auth to settle before creating. The create
            // path stamps createdByUid and keys the member node from
            // currentUser.uid, so clicking before auth lands writes
            // "anonymous" and the membership gate can never be satisfied.
            await creator.uid()

            await creator.page.getByRole("button", { name: /create a new chat room/i }).first().click()

            const save = creator.page.getByRole("dialog").getByRole("button", { name: /save/i })
            await save.waitFor({ state: "visible", timeout: 30_000 })
            await save.click()

            // Reaching the composer means the collision check, the room write
            // and the membership write all succeeded.
            await creator.page.locator(CHAT_INPUT).first().waitFor({ state: "visible", timeout: 30_000 })

            const roomId = await creator.page.evaluate(() => new URL(location.href).searchParams.get("room"))
            expect(roomId, "a room id should be in the URL after creation").toBeTruthy()

            expect(denials, `room creation logged permission errors: ${denials[0] ?? ""}`).toHaveLength(0)
        } finally {
            await closePeer(creator)
        }
    })
})
