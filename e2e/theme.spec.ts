import { test, expect } from "@playwright/test"

/**
 * Theme system smoke tests — Phase 9.
 *
 * SatLoom is intentionally dark-only (see contexts/theme-context.tsx):
 * `toggleTheme` is a no-op and the persisted `satloom-theme` value is
 * ignored by design. The ThemeProvider's job is to (1) mount so consumers
 * like `useTheme()` in chat-interface.tsx / settings-modal.tsx don't throw,
 * and (2) actively apply the `dark` class to <html> so Tailwind's `dark:`
 * variant and downstream styling resolve correctly.
 *
 * These tests verify that contract:
 *   - The root <html> ends up with the `dark` class on mount.
 *   - The class is `dark` regardless of any persisted preference (dark-only).
 *
 * We don't click the in-app theme toggle (it lives inside a modal that
 * requires being in a room) and toggling is a no-op anyway.
 */

test.describe("theme provider", () => {
    test("applies the dark class to <html> on mount", async ({ page }) => {
        await page.goto("/satloom/")
        const root = page.locator("html")
        await expect(root).toHaveClass(/\bdark\b/, { timeout: 5_000 })
    })

    test("ignores a persisted light preference (dark-only by design)", async ({ page }) => {
        // A legacy/persisted 'light' value must NOT switch the theme — the
        // app is dark-only. The provider reads satloom-theme but discards it.
        await page.addInitScript(() => {
            window.localStorage.setItem("satloom-theme", "light")
        })
        await page.goto("/satloom/")
        // Still dark, and explicitly NOT light.
        await expect(page.locator("html")).toHaveClass(/\bdark\b/, { timeout: 5_000 })
        await expect(page.locator("html")).not.toHaveClass(/\blight\b/)
    })

    test("applies dark when the persisted preference is already dark", async ({ page }) => {
        await page.addInitScript(() => {
            window.localStorage.setItem("satloom-theme", "dark")
        })
        await page.goto("/satloom/")
        await expect(page.locator("html")).toHaveClass(/\bdark\b/, { timeout: 5_000 })
    })
})
