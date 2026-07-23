# Firebase Realtime Database Rules — Reference

This document explains the security model in [`firebase-rules.json`](./firebase-rules.json).
The rules file itself must remain valid JSON (Firebase rejects comments), so the
"why" lives here.

> Phase 1 of the implementation plan rewrote these rules. If you are reading
> this after April 2026, cross-check that the rules file in the Firebase
> Console matches the file in this repo.

---

## Threat model

The app uses Firebase Anonymous Auth, so **every visitor on the site is a valid
`auth.uid`**. "Authenticated" means almost nothing on its own. Authorization
must therefore be expressed as **room membership**, not just `auth != null`.

A "member" of a room is someone whose UID has an entry under
`rooms/$roomId/members/$uid` (written either when the user creates the room or
when they join it). Membership is the canonical capability used everywhere
below.

The room **creator** is identified by `rooms/$roomId/createdByUid`. The creator
is the only one allowed to:

- delete or replace the room metadata
- ban/unban members
- write to `protection` (password protection state)
- write to `members/$otherUid` (kick a member)
- transfer hostId in the **theater** mirror

---

## Top-level structure

```
/
├── rooms/$roomId/                     ← canonical per-room data
│   ├── createdAt, createdBy, createdByUid
│   ├── lastActivityAt
│   ├── members/$uid
│   ├── banned/$uid
│   ├── presence/$uid
│   ├── messages/$messageId
│   │   ├── text, userId, userName, timestamp
│   │   ├── reactions/$emoji
│   │   ├── readBy/$uid
│   │   ├── poll/options/$optionId
│   │   └── event/attendees/$uid
│   ├── protection                     (password-protection metadata)
│   ├── quiz/$sessionId/...
│   ├── theater/$sessionId/...
│   ├── karaoke/$sessionId/...
│   ├── presentations/$sessionId/...
│   ├── whiteboards/$sessionId/...
│   ├── notes, tasks, polls, events
│   ├── mood, activeQuiz
│   ├── calls, games, breakout
│
├── mafia/$roomId                      ← mafia public state (host id, phase, players)
├── mafiaRoles/$roomId/$uid/role       ← private — hidden from non-host non-self
├── mafiaNightActions/$roomId/$uid     ← private — hidden from non-host non-self
│
├── theater/$roomId                    ← top-level mirror (used by some legacy paths)
├── karaoke/$roomId                    ← top-level (actively used)
├── presentations/$roomId
├── whiteboards/$roomId
├── calls/$roomId
├── games/$roomId
├── quizzes/$roomId
│
├── gameInvites/$roomId/$inviteId      ← per-room invite stream
├── quizAnswerKeys/$sessionId          ← host-only answer keys
├── burnerLinks/$linkId                ← single-use invite links
│
├── authorized_admins/$uid             ← admin role table
├── telemetry/$roomId                  ← writes only by room members
├── reports                             ← read-only for admins
└── moderation                          ← admin-only
```

---

## Permission model in plain language

| Path | Read | Write | Notes |
|---|---|---|---|
| `rooms/$roomId` | any auth | creator only (for the root node) | Room ID acts as a capability — knowing it is the entry condition. |
| `rooms/$roomId/members/$uid` | any auth | self or creator | Self-join, self-leave, creator can kick. Validates `{uid,name,joinedAt}` shape and length. |
| `rooms/$roomId/banned/$uid` | any auth | creator only | Creator can ban/unban. |
| `rooms/$roomId/presence/$uid` | any auth | self or creator | Indexed on `lastSeen`. |
| `rooms/$roomId/messages/$messageId` | any auth | **member**, AND author or creator | Can no longer write a message into a room you don't belong to. Validates `text.length ≤ 4096`. |
| `rooms/$roomId/messages/$messageId/reactions` | inherited | **member** | Was `auth != null` — anyone could add reactions to any room's messages. Closed. |
| `rooms/$roomId/messages/$messageId/readBy` | inherited | **member** | Closed. |
| `rooms/$roomId/messages/$messageId/poll/options` | inherited | **member** | Closed. |
| `rooms/$roomId/messages/$messageId/event/attendees` | inherited | **member** | Closed. |
| `rooms/$roomId/protection` | any auth | creator only | Unchanged. |
| `rooms/$roomId/encryption/salt` | any auth | creator only, **immutable once written** | Phase 6: per-room random PBKDF2 salt. Anyone joining needs to read it to derive the same key as other members. The `.validate` rule enforces immutability — once a salt exists, no write can change it (so a late attacker can't swap salts to invalidate everyone's key derivation). |
| `rooms/$roomId/quiz/$sessionId/...` | any auth | **member** + sub-rules | Existing quiz host rules preserved, plus a parent-level membership requirement. |
| `rooms/$roomId/theater/$sessionId` | **member** | **member** | Was `auth != null` blanket. Closed. |
| `rooms/$roomId/karaoke/$sessionId` | **member** | **member** | Closed. |
| `rooms/$roomId/presentations/$sessionId` | **member** | **member** | Closed. |
| `rooms/$roomId/whiteboards/$sessionId` | **member** | **member** | Closed. |
| `rooms/$roomId/{notes,tasks,polls,events,mood,activeQuiz,calls,games,breakout}` | **member** | **member** | All previously `auth != null`. Closed. |
| `rooms/$roomId/p2pSignals/$uid` | only `$uid === auth.uid` (your own inbox) | any room **member**, but `$uid` must also be a member | Used by Phase 2's WebRTC DataChannel file-transfer protocol to exchange SDP offer/answer + ICE candidates. **Files themselves never touch Firebase** — only the short-lived signaling. The `$signalId` validate rule pins `fromUserId` to the writer's `auth.uid` so signals can't be forged. |
| `mafia/$roomId` | **member** | **member**; `hostId` validated to `auth.uid` | Stranger can no longer flip mafia state. `hostId` can only be set to your own uid, and only by current host (or if no host exists yet). |
| `mafiaRoles/$roomId` | **member** + host (parent), or self at `$uid/role` | host only | Stronger isolation: even a non-host member can only read **their own** role. |
| `mafiaNightActions/$roomId` | **member** + (host or self) | **member** + (host or self) | Same pattern. |
| `gameInvites/$roomId/$inviteId` | **member** | **member** | Path was wrong before — rule said `$inviteId` but code wrote `$roomId/$inviteId`. Now matches. Indexed on `targetUserId`. |
| `quizAnswerKeys/$sessionId` | host only (`hostId === auth.uid`) | host only / first-write | Unchanged. |
| `burnerLinks/$linkId` | any auth | creator only | Validates `createdByUid === auth.uid` and `expiresAt: number`. Indexed on `expiresAt`. |
| `theater/$roomId`, `karaoke/$roomId`, `presentations/$roomId`, `whiteboards/$roomId`, `calls/$roomId`, `games/$roomId`, `quizzes/$roomId` (top-level) | **member** | **member** | These were the worst hole — `auth != null` blanket. Strangers could pause your movie or wipe your whiteboard. Closed. `theater/$roomId.write` also accepts the room creator (so room cleanup still works after presence is gone). |
| `authorized_admins/$uid` | self only | super_admin only | Unchanged. |
| `telemetry/$roomId` | admins only | members of `$roomId` only | Was: any auth could write any path. Now scoped by room. |
| `reports` | admins only | any auth | Unchanged (anyone can submit a report). |
| `moderation` | admins only | admins only | Unchanged. |

---

## Vanish-mode TTL (Phase 7)

Messages can carry an `expiresAt` (Unix-ms) and a `vanishMode` discriminator.
The validate rule on `expiresAt` requires `newData.val() > now` — the server
won't accept a message that's already "expired" at write time, so a
malicious client can't sneak a long-history message in past the read
filter by lying about the timestamp.

How a vanish message dies in three places:

1. **Sender attaches `expiresAt`** in `sendEncryptedMessage` (chat-input.tsx)
   based on the active vanish-mode + duration setting.
2. **Receivers filter on read** in `use-chat-effects.ts`: any incoming
   message whose `expiresAt < Date.now()` is dropped before render.
3. **Pruner removes from DB**: every 30 seconds, the chat-effects code
   sweeps `rooms/$roomId/messages` and deletes expired rows the current
   user authored. (Permission rules already restrict deletes to the
   author or the room creator.)

What was intentionally not implemented in Phase 7 — **and what Phase 13
filled in**:

- **`read_once`** ✅ Phase 13 / A5: each recipient acks via
  `readBy/$uid = now` 2 seconds after the bubble becomes visible. Both
  the in-app pruner and the Cloud Function delete the message once
  every eligible member (all members except the sender) has acked.
  Falls back to the 30s timer if some recipients never visit.
- **`after_exit`**: marker carried on the message but no special server
  handling — sender-local cleanup only. Still deferred.
- **Hard guarantee that expired rows leave the DB** ✅ Phase 13 / A4:
  scheduled Cloud Function (`functions/src/index.ts`) sweeps
  `rooms/*/messages` every 5 minutes with Admin privileges. Closes the
  gap when no message author returns to delete via the in-app pruner.

---

## Encryption salt (Phase 6) and password-derived mode (Phase 6.5)

### `rooms/$roomId/encryption/salt`

Base64-encoded 16-byte random salt, generated at room creation by
[`utils/infra/encryption-salt.ts`](./utils/infra/encryption-salt.ts).
Phase 6 fix: before, the salt was a deterministic `"salt_" + roomId`, so
every room's salt was as predictable as its room ID. Now random.

**Migration:** rooms created before Phase 6 don't have a salt under this
path. The runtime helper `getRoomSalt()` falls back to the legacy
deterministic salt so existing message history remains decipherable.

### `rooms/$roomId/protection/encryptionMode` (Phase 6.5)

Optional string, `"password"` or `"legacy"`. When set to `"password"`,
the chat encryption layer derives its AES-GCM key from the **plaintext
password the user typed** (held only in memory by `EncryptionManager`)
instead of the public roomId.

This is the fix for what Phase 6 documented as "still encryption theater
for unprotected rooms." After Phase 6.5:

- Password-protected rooms (`encryptionMode: "password"`) use the actual
  password for derivation. Anyone with the URL but without the PIN cannot
  decrypt messages.
- Rooms without `encryptionMode` (created before Phase 6.5, or
  unprotected) keep using the roomId — that's still link-derivable, but
  preserves history and matches the user expectation for public rooms.

The plaintext password is **never written to Firebase, localStorage, or
any persistent surface**. It's captured in `RoomPasswordManager.setPassword`
(host) and `validatePassword` (joiner) on success, and cleared in the
chat effect's cleanup when the user leaves the room.

---

## Inline preview derivatives (Phase 2.5)

Image, audio, and video messages carry a small derivative on the message
itself so the bubble can paint immediately, while the full payload still
flows peer-to-peer:

| Field | What | Cap |
|---|---|---|
| `file.thumbnail` | base64 JPEG (~240×180, q=0.5) | 8 192 chars (≈ 6 KB) |
| `file.duration`  | audio/video seconds, 0–7200 | numeric range validate |
| `file.waveform`  | 16-element peak array, values 0–1 | client-side; no validate (size is fixed by the client) |

These fields are **derivatives, not the original media**. The full image
bytes, audio bytes, video bytes still travel only over the WebRTC
DataChannel — Firebase carries at most a thumbnail's worth of bytes per
media message.

If a generator fails (codec unsupported, AudioContext blocked, image too
weird), the field is simply absent and the bubble falls back to a generic
"Download" card. No path is required.

---

## P2P file-transfer signaling (Phase 2)

The `rooms/$roomId/p2pSignals/$uid` subtree is a **short-lived per-user
inbox** for WebRTC handshake messages used by `utils/p2p/file-transfer.ts`:

- only `auth.uid === $uid` can read their own inbox
- only room **members** can write to another member's inbox
- the writer's `auth.uid` is pinned by the `fromUserId` validate rule, so a
  member can't forge a signal "from" someone else
- the manager `remove()`s each signal as it's consumed — these messages
  don't accumulate

The actual file payload is exchanged peer-to-peer over a DataChannel with
SHA-256 integrity verification. **Firebase only sees the SDP/ICE handshake
plus a small request envelope — never bytes of the file.**

---

## What was removed

- **`rooms/$roomId/{karaoke,theater,…}` blanket rules** at the previous lines
  99–110 of the old file (`auth != null` read/write). Replaced by per-session
  membership rules. Any-auth wildcard write into these paths is now denied by
  default cascade.
- **Top-level `presence/$uid`** rule. Nothing in the codebase wrote to this
  path; presence lives at `rooms/$roomId/presence/$uid`. Removing the rule
  defaults to deny (`.read: false, .write: false` at root).
- **Top-level `gameInvites/$inviteId`** wildcard. The actual code path is
  `gameInvites/$roomId/$inviteId`, so the old rule was effectively broken
  (treating `$roomId` as `$inviteId` and granting blanket access). Now correct.

---

## What is *still* permissive (and why)

- **`rooms/$roomId/.read` is still `auth != null`.** Knowing the room ID is
  the capability — that matches the "paste a code and join" UX. Tightening
  this to require membership would break the join handshake (the joiner
  needs to read the room to add themselves to `members`). Phase 6 will
  re-evaluate if a join token is added.
- **`burnerLinks/$linkId.read` is `auth != null`.** Anyone who guesses the
  link ID can read it. Link IDs are random UUIDs, so this is fine in practice.
- **`reports.write` is `auth != null`.** Anyone should be able to submit
  abuse reports.

---

## Validation summary

Field shape rules added in Phase 1:

- `rooms/$roomId/createdBy` — string, length < 64
- `rooms/$roomId/members/$uid` — must have `{uid,name,joinedAt}`, name length < 64, joinedAt is number, uid matches the wildcard
- `rooms/$roomId/messages/$messageId/text` — string, length ≤ 4096
- `rooms/$roomId/messages/$messageId/userId` — string, length < 128
- `rooms/$roomId/messages/$messageId/userName` — string, length < 64
- `rooms/$roomId/messages/$messageId/timestamp` — number
- `rooms/$roomId/messages/$messageId/file/name` — string, length ≤ 256
- `rooms/$roomId/messages/$messageId/file/size` — number, 0–52428800 (50 MB)
- `rooms/$roomId/messages/$messageId/file/sha256` — hex string, exactly 64 chars
- `rooms/$roomId/messages/$messageId/file/thumbnail` — string, length ≤ 8192 (Phase 2.5: tiny base64 JPEG)
- `rooms/$roomId/messages/$messageId/file/duration` — number, 0–7200 (Phase 2.5: audio/video duration in seconds)
- `rooms/$roomId/quiz/$sessionId/answers/$answerId/timeToAnswer` — number, 0–600 (Phase 5: prevents `timeToAnswer: 0.001` cheat for fastest-answer leaderboards)
- `rooms/$roomId/quiz/$sessionId/answers/$answerId/timestamp` — number (no range validation; host evaluator should prefer this over `timeToAnswer` for authoritative timing)
- `rooms/$roomId/messages/$messageId/expiresAt` — number, **must be `> now`** (Phase 7: vanish-mode TTL; rule rejects backdated or non-future values)
- `rooms/$roomId/messages/$messageId/vanishMode` — string, one of `"timed" | "read_once" | "after_exit"`
- `mafia/$roomId/hostId` — must equal `auth.uid` and either match prior value or be unset
- `burnerLinks/$linkId/createdByUid` — must equal `auth.uid`
- `burnerLinks/$linkId/expiresAt` — number

These deflect the most common spam/grief vectors (1 MB message bodies,
impersonation by setting `userId` to someone else's uid). Fine-grained rate
limiting (max N messages per minute) is **not** expressible in RTDB rules and
remains a Phase 5 concern.

---

## Indexes

Added in Phase 1 to keep child queries fast:

- `gameInvites/$roomId.indexOn`: `["targetUserId", "createdAt"]`
- `calls/$roomId.indexOn`: `["status", "targetUserId"]`
- `burnerLinks.indexOn`: `["expiresAt", "createdByUid"]`

Already existed: `messages.timestamp`, `presence.lastSeen`.

---

## How to deploy

```bash
firebase deploy --only database
```

Or paste the contents of `firebase-rules.json` into **Firebase Console →
Realtime Database → Rules**.

After deploying, smoke-test:

1. Create a room from browser A → confirm chat works.
2. Open a second incognito window (different uid) WITHOUT joining → try
   pasting the room URL. The room fetch should succeed (room ID is the
   capability) but trying to send a message should fail with PERMISSION_DENIED.
3. Join from the second window → all member operations should work.
4. From a third browser that knows another room's ID but isn't a member,
   try `set(ref(db, 'theater/' + otherRoomId + '/state'), {paused: true})`.
   Should fail.
