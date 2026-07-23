# SatLoom Cloud Functions

Phase 13 introduced **one** server-side function:
`pruneExpiredVanishMessages`. It runs every 5 minutes against the
Realtime Database and removes any chat message whose `expiresAt`
field is in the past.

## Why this exists

Phase 7 added an in-app pruner that runs while a user is in the room.
That covers the common case — but if the *author* of a vanish-mode
message never returns, the in-app pruner has no permission to delete
it (rules require `userId === auth.uid` or room creator). The message
stayed on disk forever, even though no client rendered it (clients
already filter expired rows from the listener payload).

This function runs with Admin privileges, so it can sweep authorless
expired rows. It closes the gap: receivers never saw expired
messages, and now the database doesn't either.

## Deploy

```bash
cd functions
npm install
npm run deploy
```

The function is on Firebase's Blaze plan (required for scheduled
functions). The pruner reads `rooms/$rid/messages` for every room,
which is bounded by the number of rooms; budget on the order of one
or two cents per million sweeps.

## Local development

```bash
npm run serve            # Firebase emulator with the function loaded
npm run shell            # Functions shell for interactive testing
npm run logs             # Tail production logs
```

## What this function explicitly does NOT do

- It does not enforce TTL at the rule level. Server rules already
  reject backdated `expiresAt` values at write time (Phase 7), so the
  function's job is just disk cleanup after the fact.
- It does not delete rooms themselves (`room-janitor.ts` handles that
  client-side).
- It does not touch P2P signaling, presence, or any other ephemeral
  subtree — those have their own cleanup paths.
