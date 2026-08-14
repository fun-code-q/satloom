import { defineConfig, devices } from "@playwright/test"

/**
 * Playwright config — Phase 9.
 *
 * Boots its own dev server before running tests. `next dev` is preferred
 * over `next start` because `output: 'export'` makes `next start` refuse
 * to run; for tests we just need *some* hostable build of the app at
 * /satloom (the configured basePath).
 *
 * Most tests in this suite are deliberately Firebase-independent: they
 * exercise the landing page, the static UI surface, and the no-config
 * error path. Tests that need real Firebase auth (WebRTC peer flows,
 * message round-trips) are gated by `PLAYWRIGHT_HAS_FIREBASE=true` and
 * will silently skip when env vars are missing — see e2e/_helpers.ts.
 *
 * Local: `npm run test:e2e` boots the dev server automatically.
 * CI:    GitHub Actions sets PLAYWRIGHT_BASE_URL or lets webServer launch.
 */

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3000)
// baseURL is the server root; the `/satloom` basePath lives inside test
// `page.goto()` calls. URL.resolve semantics: `goto("/")` against a
// baseURL ending in `/satloom` would resolve to `http://host/`, not
// `http://host/satloom/`. Keeping baseURL at the root + every test
// navigating to `/satloom/...` matches what users hit in production.
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Serial by default, not just in CI. Each credentialed spec drives TWO
  // browser contexts, so Playwright's default (one worker per core) puts
  // 8+ contexts and the dev server's first compile on the machine at once.
  // Under that load the specs time out and contexts die with
  // "Failed to find context" — the same tests pass in ~5x less wall-clock
  // each when run one at a time.
  workers: 1,
  reporter: process.env.CI ? "line" : "list",
  // 60s: next dev cold-compiles the first request per worker, and the
  // landing/theme goto calls wait for the "load" event which Firebase
  // long-polling can delay past 30s under parallel workers. 30s caused
  // intermittent e2e failures (re-audit NEW-ISSUE 1).
  timeout: 60_000,

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    video: "retain-on-failure",
    // Auto-grant clipboard / notifications / mic / camera — the privacy
    // shield and chat input touch these, and an unhandled permission
    // prompt mid-test would hang.
    permissions: ["clipboard-read", "clipboard-write"],
  },

  // Skip the auto-server when the caller already has one (CI builds the
  // static export and serves ./out via a separate step) — gate on the
  // PLAYWRIGHT_BASE_URL env var.
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
      command: `npx next dev -p ${PORT}`,
      // Hit the actual app path the basePath publishes at — Next's dev
      // server returns 404 at "/" when basePath is set.
      url: `${BASE_URL}/satloom/`,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      // Pass through dummy Firebase env vars so the app boots far enough
      // for static-surface tests. Real-Firebase tests rely on the real
      // values being present in `.env.local`.
      env: {
        NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "test",
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "test.firebaseapp.com",
        NEXT_PUBLIC_FIREBASE_DATABASE_URL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ?? "https://test-default-rtdb.firebaseio.com",
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "test",
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "test.appspot.com",
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "0",
        NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "test",
      },
    },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Phase 12 / E1: Chromium's fake-media flags. Lets credentialed
        // WebRTC tests drive `getUserMedia()` + `getDisplayMedia()`
        // without a real camera. Synthetic streams produce a moving
        // colour pattern, which is enough to verify that frames arrive
        // on the viewer side of a theater broadcast.
        launchOptions: {
          args: [
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
            "--autoplay-policy=no-user-gesture-required",
          ],
        },
      },
    },
  ],
})
