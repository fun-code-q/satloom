import { test, expect } from "@playwright/test"

/**
 * Landing-page smoke tests — Phase 9.
 *
 * These don't require Firebase to actually work; they just verify the
 * static UI surface renders. If Phase 9's later tasks add Firebase-real
 * tests they live in their own spec and skip gracefully via `_helpers`.
 *
 * Copy assertions match the committed landing-page.tsx:
 *   - tagline: "Secure, anonymous, real-time communication" (landing-page.tsx:97)
 *   - region:  aria-label "Chat room options" (landing-page.tsx:90)
 */

test.describe("landing page", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/satloom/")
    })

    test("renders the landing tagline", async ({ page }) => {
        await expect(page.getByText("Secure, anonymous, real-time communication")).toBeVisible({ timeout: 15_000 })
    })

    test("offers room creation + join controls", async ({ page }) => {
        // The primary card the value prop promises. We don't click the
        // buttons here (that would need Firebase auth) — just confirm the
        // shape of the entry is what users see.
        const main = page.getByRole("region", { name: /chat room options/i })
        await expect(main).toBeVisible({ timeout: 15_000 })
    })

    test("does not leak any unhandled console errors above warn level", async ({ page }) => {
        // Fail-loud regression guard. The static surface should NOT emit
        // any `console.error` on initial paint with the test Firebase
        // config — if it does, it's a real regression and we want CI to
        // flag it. We filter out the well-known Firebase-not-configured
        // noise since the dev-server boots with stub env vars.
        const noise: string[] = []
        page.on("console", (msg) => {
            if (msg.type() !== "error") return
            const text = msg.text()
            // Tolerated noise patterns — none of these indicate a real
            // regression on the static landing surface. The dev server
            // runs with stub Firebase env vars in CI / fork PRs so a
            // 400 on the unreachable RTDB URL is expected.
            if (/firebase|auth|firestore/i.test(text)) return
            if (/PERMISSION_DENIED/i.test(text)) return
            if (/network/i.test(text)) return
            if (/Failed to load resource/i.test(text)) return
            if (/server responded with a status of (4\d\d|5\d\d)/i.test(text)) return
            if (/ERR_BLOCKED_BY_CLIENT/i.test(text)) return
            noise.push(text)
        })
        await page.goto("/satloom/")
        await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {})
        expect(noise, `unexpected console errors: ${noise.join("\n")}`).toEqual([])
    })
})
