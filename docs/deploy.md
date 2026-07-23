# SatLoom Operator Deploy Runbook

This is the manual operator checklist for deploying the server-side pieces
SatLoom's documented privacy/integrity contract depends on. The web app
itself is a static export (Next.js `output: 'export'` → `out/`, shipped to
GitHub Pages); everything below is the Firebase side, which **must be
deployed by an operator with Firebase CLI access** — it is not automated.

> **Use a dedicated Firebase project for testing.** Never run experiments
> against the production database. E2E tests that opt in
> (`PLAYWRIGHT_HAS_FIREBASE=true`) prefix rooms with `_e2e_` so cleanup is
> `firebase database:remove /rooms/_e2e_*`.

## Prerequisites

```bash
npm install -g firebase-tools
firebase login            # use the operator account, not a shared one
```

Confirm `firebase.json` points at your project, or pass `--project <id>`.

## 1. Security Rules — `firebase-rules.json`

The rules enforce room-membership read gates, message authorship, vanish
`expiresAt` server-timestamp validation, burner-link ownership, the quiz
answer-key isolation, and more. **Without deploying them, every `auth != null`
user can read every room's messages, PIN hash+salt, and encryption salt.**

```bash
firebase deploy --only database
```

Verify in the Firebase Console → Realtime Database → Rules that the deployed
JSON matches `firebase-rules.json` in the repo.

## 2. Cloud Functions — the vanish-TTL pruner

`functions/src/index.ts` exports `pruneExpiredVanishMessages`, a scheduled
function (every 5 minutes, Admin-privileged) that removes any chat message
whose `expiresAt` is in the past. This is the authoritative vanish-mode
cleanup — the in-app 30s pruner is author-scoped and best-effort, so without
this Cloud Function a vanish message whose author never returns lingers on
disk indefinitely (clients hide it, but the row remains).

```bash
cd functions
npm install
npm run deploy      # or: firebase deploy --only functions
cd ..
```

- Requires the **Blaze (pay-as-you-go)** plan (scheduled functions need it).
- Budget: on the order of one or two cents per million sweeps. The function
  reads `rooms/$rid/messages` per room; it's bounded by active-room count.
- See `functions/README.md` for logs / emulator / shell.

## 3. Deploy both together (typical release)

```bash
firebase deploy --only database,functions
```

## 4. Verify the vanish contract after deploy

1. Create a room, send a vanish message with a short TTL (e.g. 10s).
2. Leave the room (close the tab) so the in-app pruner does NOT run.
3. Wait > 5 minutes.
4. In the Firebase Console, confirm the message row is gone from
   `rooms/$rid/messages`. If it remains, the function isn't deployed or
   errored — check `firebase functions:log`.

## What each piece actually enforces

| Piece | Enforces | If NOT deployed |
|---|---|---|
| Security rules | membership-gated reads, authorship writes, `expiresAt`/`now` validation, quiz-key isolation | any authed user reads any room; backdated vanish TTLs accepted |
| `pruneExpiredVanishMessages` | vanish rows are deleted from disk after TTL even if author never returns | expired vanish rows linger on disk (still hidden from clients) |

## Updating rules / functions

Any change to `firebase-rules.json` or `functions/src/**` requires re-running
`firebase deploy --only database` / `--only functions` respectively. There is
no CI step that does this automatically — it is an explicit operator action.
