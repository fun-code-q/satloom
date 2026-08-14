# Deprecated / Dead Modules

The modules below are **confirmed dead** — they have zero importers across the
live application code (`app/`, `components/`, `hooks/`, `stores/`, `utils/`,
`contexts/`, `lib/`), verified by import-graph search. They are **excluded
from the TypeScript build** (`tsconfig.json` `exclude`) so they neither
typecheck nor ship in the bundle, but are **kept in the repo for reference**
and potential future salvage.

If you consider reviving one: first confirm its zero-importer status is still
current (`grep -rn "<moduleName>" app components hooks stores utils contexts lib`),
then re-add it to `tsconfig.json`'s `include`/remove from `exclude` and fix
whatever drift has accumulated.

| Module | Category | Notes |
|---|---|---|
| `utils/core/analytics.ts` | analytics | Auto-tracking singleton with hardcoded fake dashboard numbers; never wired. |
| `utils/core/enhanced-error-handler.ts` | error handling | Global-listener version; superseded by `error-handler.ts`. |
| `utils/core/worker-manager.ts` | infra | Web-worker-from-inline-source builder; one path references `document` inside a Worker (broken). |
| `utils/infra/firebase-query-optimizer.ts` | firebase | Query cache; init is correct but the module is unused. |
| `utils/infra/connection-pool.ts` | infra | Placeholder `createXConnection` methods returning `unknown`. |
| `utils/infra/knock-knock.ts` | calls | Pre-call preview feature; `simulateIncomingCall` emits fake events. |
| `utils/infra/twitch-player.ts` | theater | Twitch SDK loader; theater renders twitch via generic iframe instead. |
| `utils/infra/prefetcher.ts` | infra | `SmartPrefetcher`; auto-attaches a MutationObserver if ever imported. |
| `utils/infra/cdn-manager.ts` | infra | Image-transform layer; `baseUrl` empty so all transforms are no-ops. |
| `utils/infra/message-replies.ts` | chat | localStorage-backed parallel replies impl; live replies use Firebase inline. |
| `utils/infra/message-pins.ts` | chat | localStorage-backed pins impl; live pins use Firebase `pinnedMessageId`. |
| `utils/infra/message-scheduler.ts` | chat | Scheduler with `mockSend` (95% random success); never wired. |
| `utils/infra/reaction-manager.ts` | chat | DOM-style `document.createElement` at module load (SSR-unsafe); live reactions use Firebase. |
| `utils/hardware/noise-suppression.ts` | calls | `NoiseSuppressor`/`AudioQualityManager`; never imported. |
| `utils/hardware/video-call-scaler.ts` | calls | Resolution scaler; never imported. |
| `utils/hardware/video-quality-scaler.ts` | calls | Quality scaler; never imported. |
| `utils/hardware/local-recording.ts` | calls | `RecordingManager`; distinct from the (also-unwired) `use-call-recording` hook. |
| `utils/games/pictionary-game.ts` | games | Full in-memory engine; not in the game menu or any route. |
| `utils/games/turn-manager.ts` | games | Only imported by `multiplayer-tests.ts`, itself an orphan test harness. |

**Verification date:** 2026-07 (re-audit pass). Re-verify before revival.

## Borderline (NOT deprecated — kept live)

- `utils/infra/vanish-mode.ts` — imported by 4 live chat files for the
  `VanishModeType` alias (the `vanishModeManager` singleton within is unused,
  but the module is alive via its type export).
- `components/picture-in-picture.tsx` — registered in the lazy-loader but
  never preloaded; kept because the lazy path is intentional plumbing.
- `utils/p2p/theater-broadcast.ts` — zero importers but recently made to
  compile (T3 fix); represents intended host-broadcast encapsulation. Wire
  before deleting.
- `utils/p2p/file-transfer.ts` — hardened P2P replacement (SHA-256 integrity,
  accept handshake, backpressure, uid-keyed) that is NOT wired into the live
  app. The UI uses the older `utils/infra/p2p-file-transfer.ts`. Switching
  requires a 3-call-site API refactor + multiplayer testing. Do not delete —
  this is the intended security upgrade; it needs wiring, not removal.
