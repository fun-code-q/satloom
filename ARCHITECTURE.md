# SatLoom — Architecture & Trust Model

> One page for anyone who wants to know *what the app actually guarantees*
> per surface — and which guarantees are still aspirational.

Read this alongside [`firebase-rules.md`](./firebase-rules.md) (the database
contract) and the [`README.md`](./README.md) "What's actually private —
and what isn't" section (the user-facing claims).

---

## The stack in two diagrams

### Static client

```
┌──────────────────────────────────────────────────────────────────┐
│  Next.js 15 (React 19, `output: 'export'`)                        │
│  └─ Hosted as static files at /satloom on GitHub Pages            │
│     · No server, no API routes (any code in app/api/ won't run)   │
│     · No SSR, no middleware                                       │
│     · CSP / security headers must come from the host (none today) │
└──────────────────────────────────────────────────────────────────┘
              │
              │ HTTPS (TLS in transit)
              ▼
┌──────────────────────────────────────────────────────────────────┐
│  Firebase Realtime Database (rules in firebase-rules.json)        │
│  └─ Signaling + chat state + game state + small derivatives only  │
│  └─ Firebase Anonymous Auth gives every visitor an `auth.uid`     │
└──────────────────────────────────────────────────────────────────┘
              │
              │ WebRTC (P2P, Firebase as signaling)
              ▼
┌──────────────────────────────────────────────────────────────────┐
│  Peer media + bytes                                               │
│  └─ Audio/video MediaStreams (calls, theater broadcast)           │
│  └─ DataChannel files (Phase 2): chunked, SHA-256 verified        │
└──────────────────────────────────────────────────────────────────┘
```

### Per-room data shape (Firebase RTDB)

```
rooms/$roomId/
├── createdByUid                          ← who owns the room
├── members/$uid                          ← who's in it (canonical capability)
├── banned/$uid                           ← creator-only writes
├── presence/$uid                         ← typing, mood, recording flags
├── messages/$msgId                       ← chat + reactions + polls + vanish
│   ├── text, userId, userName, timestamp ← validated lengths
│   ├── reactions/{heart,thumbsUp}        ← member-only writes
│   ├── poll/options                      ← member-only writes
│   ├── event/attendees                   ← member-only writes
│   ├── expiresAt                         ← Phase 7: server-rule `> now`
│   └── file/{name,size,sha256,thumbnail,duration,…}
│                                          ← *metadata only*; bytes go P2P
├── protection                            ← creator-only password + Phase 6.5 mode
├── encryption/salt                       ← Phase 6: immutable per-room
├── quiz/$sessionId/...                   ← host-gated
├── theater|karaoke|presentations|whiteboards/$sessionId
│                                          ← member-only writes
├── notes|tasks|polls|events|mood|breakout
│                                          ← member-only writes
└── p2pSignals/$uid/$sigId                ← Phase 2: WebRTC handshake mailbox
```

Top-level (outside `rooms/`) also exists for `mafia*`, `quizAnswerKeys`,
`burnerLinks`, `gameInvites/$roomId`, plus the mirrored `theater/$roomId`,
`karaoke/$roomId`, `calls/$roomId`, `games/$roomId` paths — all locked
down to room membership in Phase 1.

---

## The trust matrix

Every surface in the app falls into one of these tiers. **Read this row by
row to decide how much to trust a given feature.**

| Surface | Trust tier | What enforces it | Phase |
|---|---|---|---|
| **Anonymous identity** (`auth.uid`) | ✅ Server-issued | Firebase Anonymous Auth | n/a |
| **Room membership** (`rooms/$roomId/members/$uid`) | ✅ Server-validated | Firebase rule: only self or creator can write your member entry | Phase 1 |
| **Chat messages — authorship** | ✅ Server-validated | Rule pins `userId === auth.uid` for the writer; non-author can't impersonate | Phase 1 |
| **Chat messages — content shape** | ✅ Server-validated | Rule caps `text ≤ 4096`, `userName ≤ 64`, `timestamp` is number | Phase 1 |
| **Reactions / readBy / poll vote / event RSVP** | ✅ Server-validated | Member-only write rule | Phase 1 |
| **Theater / karaoke / whiteboard / notes / tasks / calls / games** (room sub-paths AND top-level mirrors) | ✅ Server-validated | Member-only write rules everywhere | Phase 1 |
| **`gameInvites/$roomId/$inviteId`** | ✅ Server-validated | Rule path now matches code path; member-only | Phase 1 |
| **Mafia — private roles** | ✅ Server-validated | `mafiaRoles/$roomId/$uid` readable only by self or host | Phase 1 |
| **Mafia — vote tally + lynch** | ⚠️ Trust mode | Vote/lynch use read-modify-write `update()` calls, NOT `runTransaction` (runTransaction is not imported in mafia-game.ts). Concurrent votes can be lost; there is no atomic phase-flip lock. The private-roles isolation (above) is server-validated, but the vote tally and lynch resolution are client-trusted. | n/a |
| **Karaoke score** | ✅ Transaction-protected | `runTransaction` on `players/$id/score` (concurrent +N adds add up) | Phase 5 |
| **Bingo word-call** | ✅ Transaction-protected | `runTransaction` on `wordCallSeq` with 5s min-delay dedup | Phase 5 |
| **Quiz — answer key** | ⚠️ Trust mode | QuizSystem is a client-side in-memory singleton — `correctAnswer` lives in the host's JS heap, not in a Firebase node. A DevTools-equipped player can read it. The `quizAnswerKeys` rule path exists but is unused (the engine never persists the key to Firebase). The TrustModeBadge surfaces this to players. | n/a |
| **Quiz — `timeToAnswer`** | ✅ Server-validated | Rule caps `0 ≤ x ≤ 600`; client-side clamp belt-and-braces | Phase 5 |
| **Tic-Tac-Toe, Connect Four** | ✅ Referee-validated | Phase 14: distributed referee (lowest-UID election + handoff) is the only writer allowed by Firebase rules; pure rule adapter (`tic-tac-toe-rules.ts`, `connect-four-rules.ts`) re-runs the validator on every proposal | Phase 14 |
| **Dots & Boxes** | ⚠️ Trust mode | Migration template in `utils/games/referee.ts` + `tic-tac-toe-rules.ts`. Pending. | Phase 5 marks the UI; Phase 14 template ready |
| **Bingo — player self-mark** | ⚠️ Trust mode | Player marks words on their own card; word-call cadence is host-controlled | Phase 5 marks the UI |
| **Karaoke — score application** | ⚠️ Trust mode | Host applies points; player can edit DOM (real-game-state is via the transaction above, but the *award* decision is host-only) | Phase 5 marks the UI |
| **File transfer (images, audio, video, PDFs, docs, code, 3D)** | 🔒 Peer-to-peer only | Phase 2 — bytes flow over WebRTC DataChannel with SHA-256 integrity; Firebase only carries `{name, size, sha256, …}` metadata + signaling | Phase 2 |
| **Inline image thumbnails (≤6 KB) / audio waveform / duration** | ✅ Server-validated derivatives | Phase 2.5 — small base64 thumbs ride the message; caps enforced by rules | Phase 2.5 |
| **Theater video broadcast (1 → up to 6 viewers)** | 🔒 Peer-to-peer media | Phase 3 — host's `videoElement.captureStream()` is added to each viewer's PC; cap enforced by host (`theater-full` signal sent to extras) | Phase 3 |
| **Encryption at rest** (unprotected room) | ⚠️ Theater for link-holders | AES-GCM with PBKDF2 key derived from public `roomId` + per-room random salt. Useful against a Firebase data-center breach; useless against anyone with the URL. | Phase 6 (salt), 6.5 (mode) |
| **Encryption at rest** (password-protected room, `encryptionMode: "password"`) | 🔒 Real password derivation | Same AES-GCM, but key derived from the **plaintext PIN** the user typed. Stored only in memory; cleared on room leave. Anyone with the PIN can decrypt — that's the model. | Phase 6.5 |
| **Vanish-mode TTL** | ✅ Server-validated + best-effort prune | Rule rejects backdated `expiresAt`; read filter hides expired client-side. Two pruners: an in-app 30s pass (author-scoped, best-effort) AND a Cloud Function `pruneExpiredVanishMessages` that sweeps every 5 min with Admin privileges — so expired rows are deleted even if the author never returns. The Cloud Function is the authoritative cleanup; deploy it (see `docs/deploy.md`). **Caveat:** a row can linger up to ~5 min past TTL before the sweep runs, but no client renders it. | Phase 7, 13 |
| **Vanish-mode "screenshot prevention"** | ❌ Not a guarantee | Browsers can't reliably detect or block screenshots. Phase 7 removed the false-claim copy and the bogus key intercepts. Watermark + tab-blur are deterrents only. | Phase 7 |
| **Burner links (one-time-use invites)** | ✅ Transaction-protected | `runTransaction` on view counter with atomic expiry check | n/a |

Legend: ✅ enforced  ·  🔒 cryptographic or P2P-only  ·  ⚠️ trust mode  ·  ❌ false claim corrected

---

## Where each phase landed

| Phase | What was wrong | What it fixed |
|---|---|---|
| **0** | Repo had ~3 MB of polluted forks, `latest` deps, no CI, broken README claims | Pinned all deps, deleted pollution, added `verify.yml` CI gate, rewrote the README's privacy section |
| **1** | Blanket `auth != null` writes on theater/karaoke/games/etc. let strangers grief any room | Membership-checked rules everywhere; closed the `gameInvites` path mismatch; added validation rules |
| **2** | Files were headed for Firebase Storage / base64 in RTDB | Built `utils/p2p/file-transfer.ts` — chunked DataChannel with SHA-256, accept/reject handshake, backpressure via `bufferedamountlow`. Firebase never sees file bytes. |
| **2.5** | Image / audio messages had no inline preview while bytes were P2P-only | Added `thumbnail` (≤6 KB base64), `duration`, `waveform` (16 buckets) as small derivatives in the message itself. Validated server-side. |
| **3** | Theater "stream from device" was half-wired; `WebRTCManager.cleanup()` nuked all room PCs on theater exit; no audience cap | `utils/p2p/theater-broadcast.ts` owns host-side lifecycle: viewer cap 6, encoding ramp 720p→540p→360p with audience size, surgical per-viewer cleanup, `theater-full` viewer-side signal |
| **4** | Heavy libs static-imported into the entry chunk (Monaco, three.js, FFmpeg); 6 dead deps + 351 transitive | Dynamic imports for previews + FFmpeg; deleted gif.js, react-big-calendar, recharts, react-menubar, next-pwa; First Load JS = **211 KB** |
| **5** | Mafia/Karaoke/Bingo had read-modify-write races and duplicate lynches; client-authored turn games | `runTransaction` on Karaoke score + Bingo word-call (verified); Mafia vote/lynch still uses plain `update()` (re-audit found runTransaction was never imported — trust mode); `TrustModeBadge` on TicTacToe / ConnectFour / DotsAndBoxes / Bingo / Karaoke / Quiz |
| **6** | Salt was `"salt_" + roomId` — as predictable as the room ID itself; 885 lines of dead "Signal-style" code with false claims | Random 16-byte salt per room (immutable rule); deleted `e2ee.ts` and `encryption.ts` |
| **6.5** | The PBKDF2 password was the public `roomId` — encryption was theater for anyone with the URL | Plaintext PIN flows in-memory from password modal → `EncryptionManager.setSessionPassword`; new rooms get `encryptionMode: "password"`; cleared on leave |
| **7** | Vanish mode was UI state only — no `expiresAt` ever reached the message; privacy-shield blocked key combos it couldn't actually block | Real `expiresAt` on outgoing messages + server `now`-validate rule + read filter + 30s pruner; dropped fake key intercepts; honest watermark copy |
| **8** | Theme toggle was a no-op stub; reactions felt sluggish; z-index numerology; iOS rubber-band leaked chrome; landing copy was generic | Real dark/light/system theme; optimistic reaction toggle; `useModalStack` hook; `overscroll-behavior: none`; new landing headline; module-level LinkPreview LRU; loading skeleton |
| **9** | No tests beyond a placeholder; no single doc explaining the trust model | Playwright config now auto-boots a dev server; Firebase-independent smoke tests for landing + theme; **this doc** |
| **10** | Three components still nuked all peer connections on cleanup; theater viewers sent empty `sendrecv` SDP; `code-splitter.ts` was 360 lines of dead chunk-manager; 29 shadcn UI wrappers never imported; in-flight P2P transfers had no Cancel | Per-peer `ownedPeersRef` cleanup in audio-call/video-call/presentation-viewer; `recvOnly` direction option in `WebRTCManager.initialize`; code-splitter shrunk to a 30-line shim; 29 dead UI files + 16 npm deps + 22 transitive packages removed; Cancel button wired to `cancelIncoming` in three bubble render paths |
| **12** | Credentialed Firebase tests existed only as a skip helper | Multi-context test infrastructure: `spawnPeer` / `closePeer` / `waitFor` / `newTestRoomId` in `e2e/_helpers.ts`; 5 new credentialed specs (room flow, message round-trip, P2P file message, theater broadcast, reaction toggle, vanish TTL); Chromium fake-device flags for synthetic media; README documents the opt-in flow |
| **13** | In-app vanish pruner was author-scoped — if author never returned, expired rows lingered. read_once was a 30 s timer. | Cloud Function `pruneExpiredVanishMessages` (Admin-privileged sweep every 5 min) is **written but NOT deployed** — scheduled functions require the Blaze plan and the project is on Spark, so the disk-cleanup gap is still open: expired vanish rows remain on disk (hidden from clients, not deleted). Treat vanish mode as client-side enforcement only. read_once now tracks per-recipient ack via `readBy/$uid`; pruner deletes once every eligible member acked. New `functions/` workspace + `firebase.json`. |
| **14** | Tic-Tac-Toe, Connect Four were 100 % client-authored: any DevTools-savvy player could write any board state. Phase 5 added the **Trust mode** badge as honest disclosure. | Distributed-referee model: lowest-UID election + handoff transaction + pure rules adapters (`tic-tac-toe-rules.ts`, `connect-four-rules.ts`). Move proposals flow to the referee through `rooms/$rid/games/$gid/proposals`; Firebase rule allows state writes only from `auth.uid === game.refereeUid`. Trust badge removed from both games. Dots & Boxes / Bingo follow the same template (see below). |
| **15 (A6)** | Phase 6.5 made password-protected rooms use the actual PIN for key derivation, but if the host rotated the PIN there was no story for re-keying. Old messages with the old key stayed decryptable forever. | EncryptionManager now tracks `epochKeys: Map<roomId#epoch, CryptoKey>`. Wire format gains an `enc:e{N}::iv::ciphertext` header. Decrypt tries the tagged epoch first, then every cached epoch newest-first. `RoomPasswordManager.rotatePassword(newPin)` writes new salt + hash + bumped `keyEpoch`; `use-chat-effects` listens to `protection` and re-derives the new epoch's key without forgetting the old one. Old messages decrypt with the previous key until the user leaves the room. |

---

## What's *intentionally* not implemented

These are the deferred items called out in their respective phases. Each
is documented honestly elsewhere — none of them are bugs, they're scoped
out:

- **Distributed-referee model for client-authored games** (Phase 5 Path B).
  Tic-Tac-Toe / Connect Four / Dots & Boxes / Bingo / Karaoke score
  remain trust-mode. The TrustModeBadge surfaces this in the UI.
- **WebTorrent fallback** for file shares to rooms with > 4 viewers
  (Phase 2 / Phase 4). Bundle weight isn't worth it yet.
- **SFU upgrade** for theater broadcast > 6 viewers (Phase 3 Option B).
  Contradicts the "no server" thesis.
- **`read_once`** as true per-recipient read-tracking (Phase 7). Current
  implementation is a 30s timer. *(Note: Phase 13 added `readBy/$uid` ack
  tracking + the Cloud Function pruner, so the on-disk cleanup gap is
  closed; what remains deferred is the per-recipient UX of "delete exactly
  when the last reader has seen it" rather than on the 5-min sweep.)*
- **Full Zustand modal-state migration** (Phase 8.3). ~90-prop drill
  from `ChatInterface` → `ChatModals` still exists.
- **`vaul` drawer adoption** for mobile bottom-sheet modals (Phase 8.5).
- **`motion` library** for staggered list / spring animations (Phase 8.7).
- **Canvas-based reaction rain** respecting `prefers-reduced-motion`
  (Phase 8.8).
- **Real Signal-style E2EE** (Phase 6 / A3). Deferred *explicitly* —
  the recommended implementation is a Double-Ratchet (olm/megolm-style
  group ratchet) with persistent CryptoKey storage in IndexedDB, a
  prekey-bundle exchange protocol with bundle-signature verification,
  and per-message forward secrecy. That's a 4-week-minimum project,
  introduces a meaningful persistent-state surface (key rotation,
  device-add flows, lost-device recovery) and changes the marketing
  story from "encrypted at rest" to "per-user E2EE." Worth doing if
  the privacy story is a marketing commitment; otherwise the room-
  password derivation (Phase 6.5 + A6 rotation) covers the practical
  threat model for friends + small groups. **Status:** scoped, not
  scheduled.
- **Full WebRTC peer-flow Playwright tests** (Phase 9). Tests that need
  real Firebase credentials skip via `e2e/_helpers.ts` until secrets
  are wired into a non-fork CI job.

---

## Migrating a remaining trust-mode game to the referee model (template)

The two completed migrations (Tic-Tac-Toe, Connect Four) follow the same
pattern. To migrate Dots & Boxes (or Bingo word-mark) to the referee
model:

1. **Write a pure rule adapter** in `utils/games/<game>-rules.ts` that
   implements `GameRules<TState, TPayload>` from `utils/games/referee.ts`:
   - `validate(state, proposal)` returns either `{ ok: true, next }` or
     `{ ok: false, reason }`. The function must be pure (no Firebase
     calls, no Date.now() in the validation path — use `proposal.timestamp`).

2. **Add `refereeUid?: string` to the game state interface** and seed
   it on `createGame` (creator's uid). On `joinGame` of the Nth player,
   recompute via `electReferee([...allPlayerUids])` and write.

3. **Move the game's Firebase path from `games/<type>/$gid` to
   `games/$gid`** (with the type encoded in the gameId, e.g.
   `dots_<timestamp>`). The Firebase rule for `games/$gameId` then
   applies cleanly. `sed -i 's|games/<type>/|games/|g'` is the bulk
   rewrite.

4. **Rewrite `makeMove`** to:
   - Speculative-validate locally via the rules adapter (instant rejection of illegal moves)
   - If `game.refereeUid === playerId`: apply the validator's `next` state and `set()` directly (referee fast path)
   - If `game.refereeUid` is absent: legacy path, direct write (backwards compat for in-progress pre-Phase-14 games)
   - Otherwise: call `proposeMove(...)` and rely on the referee to commit

5. **Add a `joinAsRefereedPlayer` method** that wires the game UI to
   `joinRefereedGame` (subscribes to state, runs the proposal loop if
   we are the referee, handles handoff).

6. **Remove the `TrustModeBadge`** from the game's UI header.

Reference implementations live in:
- `utils/games/tic-tac-toe-rules.ts` + `utils/games/tic-tac-toe.ts` (2-player)
- `utils/games/connect-four-rules.ts` + `utils/games/connect-four.ts` (2-player with gravity)

For N-player games (Dots & Boxes, Bingo), the only change is the
`playerUids` list passed to `proposeMove` and `joinRefereedGame` —
everything else is identical.

---

## File / module index

The repo's directory layout is documented in the [README structure
section](./README.md#-project-structure). Highlights from the security/
correctness perspective:

- [`firebase-rules.json`](./firebase-rules.json) — the actual rules in
  production. Must be deployed via `firebase deploy --only database`
  for changes to take effect.
- [`firebase-rules.md`](./firebase-rules.md) — companion doc explaining
  the rules row-by-row (Firebase rules can't contain comments).
- [`utils/infra/webrtc-manager.ts`](./utils/infra/webrtc-manager.ts) —
  the singleton that owns peer connections. ICE-restart, signaling lock,
  ICE buffering, surgical cleanup.
- [`utils/p2p/file-transfer.ts`](./utils/p2p/file-transfer.ts) — Phase 2
  chunked transfer protocol. Pure WebRTC + Firebase signaling only.
- [`utils/p2p/theater-broadcast.ts`](./utils/p2p/theater-broadcast.ts) —
  Phase 3 host-side broadcast lifecycle (viewer cap, encoding ramp).
- [`utils/p2p/preview-derivatives.ts`](./utils/p2p/preview-derivatives.ts) —
  Phase 2.5 thumbnail / duration / waveform generators.
- [`utils/infra/encryption-manager.ts`](./utils/infra/encryption-manager.ts) —
  AES-GCM key holder; Phase 6.5 added `setSessionPassword` for the
  password-derived mode.
- [`utils/infra/encryption-salt.ts`](./utils/infra/encryption-salt.ts) —
  Phase 6 per-room random salt with legacy fallback.
- [`utils/infra/room-password.ts`](./utils/infra/room-password.ts) — PIN
  validation; Phase 6.5 plumbs plaintext into the encryption layer.
- [`components/games/trust-mode-badge.tsx`](./components/games/trust-mode-badge.tsx) —
  Phase 5 honesty UI for client-authored games.
- [`hooks/use-modal-stack.ts`](./hooks/use-modal-stack.ts) — Phase 8.4
  monotonic z-index + Escape dispatch.

---

## Deploying

Every phase that touched `firebase-rules.json` carries a deployment
note in its summary. To apply *all* the rule changes from Phases 0–9:

```bash
firebase deploy --only database
```

Without that step, the Firebase rules running in production are whatever
was last deployed manually — phases land in the code immediately, but
the server-side enforcement only flips when you push.
