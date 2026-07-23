import { test, expect } from "@playwright/test"

/**
 * Theme system smoke tests — Phase 9.
 *
 * Verifies the Phase 8.1 work:
 *   - The root <html> ends up with either `dark` or `light` class.
 *   - The user's preference persists across navigations.
 *
 * We don't click the in-app theme toggle (it lives inside a modal that
 * requires being in a room); instead we exercise the persistence
 * contract directly via localStorage, which is what `ThemeProvider`
 * consumes on mount.
 */

test.describe("theme provider", () => {
    test("applies a theme class to <html> on mount", async ({ page }) => {
        await page.goto("/satloom/")
        // Either class should be present (depending on system preference).
        const root = page.locator("html")
        await expect(root).toHaveClass(/\b(dark|light)\b/, { timeout: 5_000 })
    })

    test("respects persisted user preference (light)", async ({ page }) => {
        await page.addInitScript(() => {
            window.localStorage.setItem("satloom-theme", "light")
        })
        await page.goto("/satloom/")
        await expect(page.locator("html")).toHaveClass(/\blight\b/, { timeout: 5_000 })
    })

    test("respects persisted user preference (dark)", async ({ page }) => {
        await page.addInitScript(() => {
            window.localStorage.setItem("satloom-theme", "dark")
        })
        await page.goto("/satloom/")
        await expect(page.locator("html")).toHaveClass(/\bdark\b/, { timeout: 5_000 })
    })
})
