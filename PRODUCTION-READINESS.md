# SatLoom Production Readiness

State of the `tier0-3-integration` line as verified on 2026-08-14, plus the
work that is deliberately **not** done and why. Read this before publishing
or deploying.

## Verified green

Every gate below was executed, not inferred from commit messages:

| Gate | Command | Result |
|---|---|---|
| Types | `npm run typecheck` | pass (exit 0) |
| Lint | `npm run lint` | pass (exit 0, warnings only) |
| Build | `npm run build` | pass — static export, 200 kB First Load JS |
| E2E | `npm run test:e2e` | pass — 9 passed, 6 skipped |
| Install | `npm ci` | pass — lockfile in sync with `package.json` |

The 6 skipped E2E tests are the `@firebase`-tagged specs. They self-skip
unless `PLAYWRIGHT_HAS_FIREBASE=true` is set with real credentials (see
`e2e/_helpers.ts`). **Skipped is not passed** — the Firebase round-trip
paths (message delivery, room membership, vanish TTL, reactions, theater,
P2P file transfer) have no automated coverage in CI. They are covered only
by the manual checks in `docs/deploy.md`.

Lint is configured to report `no-unused-vars`, `no-explicit-any` and
`ts-comment` as warnings rather than errors (commit `01a027c`). This is
intentional so the gate stays green while the backlog is worked down; it
does mean lint will not fail CI on new occurrences.

## Blocking for production: Firebase must be deployed

The application's entire security model lives in `firebase-rules.json` and
`functions/`, and **neither is deployed by CI**. Shipping the static bundle
without them leaves the documented privacy contract unenforced.

From `docs/deploy.md`: without the rules deployed, *"every `auth != null`
user can read every room's messages, PIN hash+salt, and encryption salt."*

```bash
firebase deploy --only database,functions
```

Then verify in the Firebase Console that the deployed rules match
`firebase-rules.json`, and run the vanish-TTL verification in
`docs/deploy.md` §4. The Cloud Functions pruner requires the **Blaze** plan.

This is an explicit operator action on every rules/functions change. There
is no automation for it, by design.

## Degraded until configured: TURN relay

`.github/workflows/github-pages.yml` originally forwarded only the seven
Firebase secrets to the build. Because `NEXT_PUBLIC_*` values are inlined at
build time, the STUN/TURN variables `lib/webrtc.ts` expects could never reach
the deployed bundle — setting them in repository settings would have had no
effect. The workflow now forwards them.

Configuring TURN is now just adding the secrets (see `docs/deploy.md` §5).
Until then the live site runs **STUN-only**: fine on most networks, but peers
behind symmetric NAT (~15-20% of users) cannot connect a call. This is a
connectivity limitation, not a security one, and the app warns about it in
the console rather than failing silently.

## Known dependency advisories — accepted, not fixed

`npm audit` reports 10 remaining advisories. Both clusters require major
version bumps that are not safe to apply blind:

**`sharp` (< 0.35.0, high)** — inherits libvips CVEs (GHSA-f88m-g3jw-g9cj).
It is a transitive dependency of Next.js. `npm audit fix --force` resolves
it by installing `next@16.3.1`, a major upgrade across the App Router.

**`next-pwa` → `workbox-webpack-plugin` → `workbox-build` →
`rollup-plugin-terser`** — `next-pwa` 5.6.0 pins an unmaintained workbox
chain. There is no patched release on the 5.x line; `next-pwa` itself is
effectively unmaintained.

Both are **build-time/SSR-side** dependencies. This app ships as a static
export (`output: 'export'`) to GitHub Pages, so neither `sharp` nor the
workbox build chain executes in the served artifact — which is why these
are tolerable short-term rather than release-blocking.

Recommended path, as one deliberate piece of work with its own testing:
upgrade to Next 16 (clears `sharp`) and replace `next-pwa` with
`@serwist/next` (the maintained successor). Do not bundle this with
unrelated changes.

## Known unwired code

`utils/p2p/file-transfer.ts` is the hardened P2P transfer implementation
(SHA-256 integrity, accept handshake, backpressure, uid-keyed signaling).
**It is not what the app runs.** The UI still imports the older
`utils/infra/p2p-file-transfer.ts`, which has no integrity check and uses
name-keyed signaling.

Switching requires an API refactor across 3 call sites (`registerFile` →
`registerOutgoing`, `requestFile` → `receiveFile`, `fileId` string →
`FileOffer` object, name → uid) and cannot be E2E-tested without two real
WebRTC peers. See `DEPRECATED.md` for the full inventory of modules in this
state.

## Publishing

`origin/main` is a strict ancestor of this branch — publishing is a
fast-forward and cannot discard anything already on GitHub. The public
repository currently serves the pre-hardening code, so it is missing every
security fix in this line (membership read gates, PIN hardening, burner
link scoping, telemetry neutralization, uid keying).
