import { test, type Browser, type BrowserContext, type Page, expect } from "@playwright/test"

/**
 * Shared helpers for the Playwright e2e suite — extended in Phase 12.
 *
 * Tests are split into two cohorts:
 *
 *   1. **Firebase-independent** (the Phase 9 set: landing, theme).
 *      Run in every PR, no credentials needed. The dev server boots with
 *      stub env vars (see playwright.config.ts).
 *
 *   2. **Firebase-credentialed** (Phase 12 set: auth, room flow, message
 *      round-trip, P2P file transfer, theater broadcast).
 *      Skipped unless `PLAYWRIGHT_HAS_FIREBASE=true` AND a complete set of
 *      `NEXT_PUBLIC_FIREBASE_*` env vars are present. This keeps CI green
 *      on fork PRs (no secrets) while letting maintainers run the full
 *      suite locally with a real `.env.local` or in a dedicated CI job
 *      that has access to repository secrets.
 *
 *   Operator note: the credentialed cohort writes to a real Firebase RTDB.
 *   Use a *dedicated* test project, not the production one — rooms created
 *   by these tests carry a `_e2e_` prefix that can be swept by a one-line
 *   `firebase database:remove /rooms/_e2e_*` between runs.
 */

const FIREBASE_ENV_VARS = [
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_DATABASE_URL",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
] as const

function hasRealFirebaseCreds(): boolean {
    if (process.env.PLAYWRIGHT_HAS_FIREBASE !== "true") return false
    return FIREBASE_ENV_VARS.every((k) => {
        const v = process.env[k]
        return typeof v === "string" && v.length > 0 && v !== "test" && !v.startsWith("https://test-")
    })
}

/**
 * Mark a test as requiring real Firebase credentials. Skips with a clear
 * message if PLAYWRIGHT_HAS_FIREBASE!=true or stub creds detected.
 */
export function skipWithoutFirebase(): void {
    test.skip(
        !hasRealFirebaseCreds(),
        "Requires real Firebase credentials. Set PLAYWRIGHT_HAS_FIREBASE=true and supply NEXT_PUBLIC_FIREBASE_* env vars to opt in.",
    )
}

// ---------------------------------------------------------------------------
// Multi-context helpers (two browsers in the same Playwright test)

export interface PeerContext {
    context: BrowserContext
    page: Page
    name: string
    /** Reads `auth.currentUser.uid` once auth has settled. */
    uid: () => Promise<string>
}

/**
 * Spin up a fresh incognito-style context with the given display name
 * persisted to localStorage. Returns a wrapper around the Playwright
 * Page plus a helper to read the live Firebase uid.
 *
 * Use `closePeer(p)` to clean up.
 */
export async function spawnPeer(browser: Browser, name: string): Promise<PeerContext> {
    const context = await browser.newContext({
        permissions: ["clipboard-read", "clipboard-write", "microphone", "camera"],
    })
    const page = await context.newPage()
    // Stub the user profile so we land directly in chat after auth,
    // skipping the ProfileModal step. Persisted by Zustand `persist`.
    await page.addInitScript((n) => {
        const profile = { state: { profile: { name: n }, activeRoomId: null }, version: 0 }
        window.localStorage.setItem("satloom-session", JSON.stringify(profile))
    }, name)
    return {
        context,
        page,
        name,
        async uid() {
            return await page.evaluate(async () => {
                const w = window as unknown as {
                    firebase?: { auth?: () => { currentUser?: { uid: string } } }
                }
                // Most reliable: read the global auth state via the SDK.
                // The app exposes it via the `lib/firebase` module's
                // imperative singleton; we can poll for it.
                const start = Date.now()
                while (Date.now() - start < 8000) {
                    const u = w.firebase?.auth?.()?.currentUser?.uid
                    if (u) return u
                    await new Promise((r) => setTimeout(r, 100))
                }
                throw new Error("timed out waiting for auth uid")
            })
        },
    }
}

export async function closePeer(p: PeerContext): Promise<void> {
    await p.context.close()
}

/**
 * Generate a fresh room id prefixed `_e2e_` so cleanup can sweep them.
 * Length matches the app's own room id format (8 chars after prefix).
 */
export function newTestRoomId(): string {
    const rand = Math.random().toString(36).slice(2, 10)
    return `_e2e_${rand}`
}

/**
 * Wait until a condition predicate evaluates true on the page, polling
 * at 200ms intervals. Throws if `timeoutMs` elapses. Useful for "wait
 * until N items appear in the DOM" style assertions when no aria-live
 * region exists.
 */
export async function waitFor<T>(
    page: Page,
    predicate: () => Promise<T | null | false | undefined>,
    timeoutMs = 8_000,
    intervalMs = 200,
): Promise<T> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
        try {
            const v = await predicate()
            if (v) return v as T
        } catch {
            // ignore intermittent
        }
        await new Promise((r) => setTimeout(r, intervalMs))
    }
    throw new Error(`waitFor timed out after ${timeoutMs}ms`)
}

// Re-export expect so test files have one canonical import surface.
export { expect }
