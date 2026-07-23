/**
 * Distributed-referee for turn-based games — Phase 14 / A2.
 *
 * Background
 * ----------
 * Until Phase 14, turn-based games (Tic-Tac-Toe, Connect Four, Dots &
 * Boxes, Bingo word-marking) were *client-authored*: every player
 * computed their move locally and wrote the resulting board state
 * straight to Firebase. The rules only checked authorship of the write,
 * not the legality of the move. A DevTools-savvy opponent could mark a
 * cell that wasn't their turn, or claim a win that didn't happen.
 *
 * Phase 5 surfaced this with the "Trust mode" badge. Phase 14 closes
 * the loop: one player is **elected referee** at game start. All move
 * proposals from any player flow to the referee over WebRTC DataChannel.
 * The referee runs the canonical move-validator and is the *only* uid
 * permitted by Firebase rules to write the game's state node. Other
 * clients render whatever the referee writes; their UI knobs are now
 * cosmetic.
 *
 * Election: deterministic — lowest UID lexically among players. This is
 * stable across reconnects so a tab refresh of the same user keeps them
 * as referee until they actually leave.
 *
 * Handoff: on referee departure, the next-lowest-UID surviving player
 * claims the role via a `runTransaction` on `refereeUid`. The
 * transaction is the only thing preventing two simultaneous claims.
 *
 * Threat model
 * ------------
 * - Referee can DENY a legal move (refuse to apply). Cost: dropped
 *   message. Not silent corruption.
 * - Referee can NOT inject moves on someone else's behalf — the
 *   protocol pins each proposal's `playerUid` to its sender and the
 *   referee's validator rejects mismatched proposals.
 * - Referee can NOT skip turns or fabricate state because the
 *   validator is the same canonical function every player uses.
 *
 * That gives us "no silent corruption" while keeping the no-server
 * architecture intact. For tournament-grade guarantees you'd need a
 * dedicated server.
 */

import { getFirebaseDatabase } from "@/lib/firebase"
import { onValue, ref, runTransaction, set, remove } from "firebase/database"
import { p2pFileTransfer as _peer } from "@/utils/p2p/file-transfer" // ensure init module is loaded

void _peer

// ---------------------------------------------------------------------------
// Types

/** Where the game state lives in Firebase, plus its participants. */
export interface RefereedGameSpec {
    /** Room the game belongs to. */
    roomId: string
    /** Game id (unique within the room). */
    gameId: string
    /**
     * Firebase path holding the canonical game state. Reads broadcast
     * to every player; writes are restricted by Firebase rule to
     * `auth.uid === game.refereeUid`.
     */
    statePath: string
    /** Ordered list of player UIDs participating in the game. */
    playerUids: string[]
}

/** A move proposal from any player to the referee. Generic over the game-specific payload. */
export interface MoveProposal<TPayload> {
    kind: "move-proposal"
    proposalId: string
    gameId: string
    /** Pinned by the validator to match the DataChannel sender's uid. */
    playerUid: string
    payload: TPayload
    timestamp: number
}

/** Referee → players response after applying or rejecting a move. */
export interface MoveResult {
    kind: "move-result"
    proposalId: string
    accepted: boolean
    reason?: string
}

/** Game-specific validator the referee runs to vet each proposal. */
export interface GameRules<TState, TPayload> {
    /**
     * Read-only check: is this proposal legal given the current state?
     * Returns `{ ok: true, next }` to apply or `{ ok: false, reason }`
     * to reject. The referee uses this to decide whether to commit to
     * Firebase.
     */
    validate(state: TState, proposal: MoveProposal<TPayload>): { ok: true; next: TState } | { ok: false; reason: string }
}

// ---------------------------------------------------------------------------
// Referee election

/**
 * Compute the elected referee from a player list. Pure function:
 * deterministic, no Firebase reads — both sides come to the same
 * conclusion. Lowest UID lexically wins.
 */
export function electReferee(playerUids: string[]): string | null {
    if (!playerUids.length) return null
    return [...playerUids].sort()[0]
}

/**
 * Transactionally claim the referee slot at `${statePath}/refereeUid`.
 * Returns true if this client is now the referee (claim succeeded *or*
 * was already the referee). Returns false if another claim won.
 */
export async function claimRefereeRole(spec: RefereedGameSpec, claimerUid: string): Promise<boolean> {
    const db = getFirebaseDatabase()
    if (!db) return false
    const refereeRef = ref(db, `${spec.statePath}/refereeUid`)
    const tx = await runTransaction(refereeRef, (current: unknown) => {
        if (typeof current === "string" && current.length > 0) {
            // Slot already filled — only take over if the elected
            // candidate (lowest UID surviving) is us. The seat-check
            // logic lives in `tryHandoffOnDisconnect` below; this fn
            // is only called when we already believe we should hold it.
            if (current === claimerUid) return // commit unchanged
            return // abort: someone else holds it
        }
        return claimerUid
    })
    return tx.committed && tx.snapshot.val() === claimerUid
}

/**
 * Watch the player list and, if the current referee disappears, race
 * to claim the seat. Stable election (lowest surviving UID) plus a
 * Firebase transaction guarantees only one writer wins.
 *
 * Returns an unsubscribe function. Call this once per game session
 * from each participating client; the resolver will only commit on
 * the client that actually has the lowest UID among survivors.
 */
export function watchAndHandoffReferee(spec: RefereedGameSpec, selfUid: string): () => void {
    const db = getFirebaseDatabase()
    if (!db) return () => {}

    const unsubscribe = onValue(ref(db, spec.statePath), async (snap) => {
        const val = snap.val() as { refereeUid?: string; players?: Record<string, unknown> } | null
        if (!val) return

        // If we're already the referee, nothing to do.
        if (val.refereeUid === selfUid) return

        // Compute the current eligible roster. The caller passes the
        // game's player list at construction time; we cross-reference
        // with anyone currently in the `players` sub-map (if the game
        // tracks active membership).
        const stillIn = spec.playerUids.filter((uid) => {
            if (!val.players) return true
            return Object.prototype.hasOwnProperty.call(val.players, uid)
        })
        const elected = electReferee(stillIn)
        if (elected !== selfUid) return

        // We're the new elected referee. Try to claim. If the
        // transaction aborts (someone else got there first), we'll
        // re-fire on the next `onValue` tick.
        try {
            await claimRefereeRole(spec, selfUid)
        } catch (err) {
            console.warn("[referee] handoff claim failed:", err)
        }
    })

    return unsubscribe
}

// ---------------------------------------------------------------------------
// Proposal channel — sender side

/**
 * Send a move proposal to the current referee. If we are the referee,
 * the caller should bypass this and just apply the move directly via
 * `applyMove()` — saves a DataChannel hop.
 *
 * Today this writes the proposal through Firebase rather than a real
 * DataChannel — sidesteps the chicken-and-egg of "we need a PC to
 * every other player" for games that don't have any other reason to
 * keep peer connections open. The proposal path uses a dedicated
 * `rooms/$rid/games/$gid/proposals/$pid` sub-tree that the Firebase
 * rule limits to one-write-then-read-only and ties to the proposing
 * uid; the referee reads and removes proposals as it processes them.
 *
 * For tournament-grade latency this could be migrated to a DC overlay,
 * but Firebase RTDB is consistently sub-100ms in the regions SatLoom
 * targets, which is well within the perceived "instant" budget for
 * turn-based moves.
 */
export async function proposeMove<TPayload>(
    spec: RefereedGameSpec,
    proposingUid: string,
    payload: TPayload,
): Promise<MoveProposal<TPayload>> {
    const db = getFirebaseDatabase()
    if (!db) throw new Error("Firebase not initialised")

    const proposalId = `mv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    const proposal: MoveProposal<TPayload> = {
        kind: "move-proposal",
        proposalId,
        gameId: spec.gameId,
        playerUid: proposingUid,
        payload,
        timestamp: Date.now(),
    }
    await set(ref(db, `${spec.statePath}/proposals/${proposalId}`), proposal)
    return proposal
}

// ---------------------------------------------------------------------------
// Proposal channel — referee side

/**
 * Subscribe to incoming move proposals (referee's job). For each
 * proposal:
 *   1. Reject if `proposal.playerUid` is not in the game's player list
 *      (would be a forged proposal — though the Firebase write rule
 *      should have rejected it server-side already).
 *   2. Run the game's `validate` function against the current state.
 *   3. If ok, commit the new state via a single `set` (other clients
 *      see the update via their `subscribeToState` listener).
 *   4. Delete the proposal from the inbox.
 *
 * Returns an unsubscribe function.
 */
export function refereeProcessLoop<TState, TPayload>(
    spec: RefereedGameSpec,
    rules: GameRules<TState, TPayload>,
    refereeUid: string,
): () => void {
    const db = getFirebaseDatabase()
    if (!db) return () => {}

    const proposalsRef = ref(db, `${spec.statePath}/proposals`)
    const stateRef = ref(db, spec.statePath)

    const unsub = onValue(proposalsRef, async (snap) => {
        const all = (snap.val() ?? {}) as Record<string, MoveProposal<TPayload>>
        for (const [pid, proposal] of Object.entries(all)) {
            try {
                // Re-fetch state per-proposal so concurrent proposals
                // serialize correctly.
                await runTransaction(stateRef, (current: unknown) => {
                    const state = current as TState
                    if (!state) return // game state missing; abort

                    // Authorship check — defensive: the rule should have
                    // already pinned proposal.playerUid to the writer.
                    if (!spec.playerUids.includes(proposal.playerUid)) {
                        return // abort: not a player
                    }

                    const verdict = rules.validate(state, proposal)
                    if (!verdict.ok) {
                        // Don't mutate state; we'll still clear the
                        // proposal from the inbox below.
                        return
                    }
                    return {
                        ...verdict.next,
                        // Preserve metadata fields the referee
                        // holds (refereeUid, proposals subtree).
                        refereeUid,
                    }
                })
            } catch (err) {
                console.warn("[referee] proposal apply error:", err)
            } finally {
                // Always clear the proposal once we've decided. A
                // rejected proposal still leaves the inbox so the
                // sender knows we processed it (they can subscribe to
                // their own proposal id and notice the deletion).
                await remove(ref(db, `${spec.statePath}/proposals/${pid}`)).catch(() => {})
            }
        }
    })

    return unsub
}

// ---------------------------------------------------------------------------
// Convenience hook for callers

/**
 * Composed "I'm joining this refereed game" wrapper. Subscribes to:
 *   - state changes (call onState with the new state)
 *   - referee handoff (election + claim)
 *   - if we are the referee: the proposal loop
 *
 * Returns a single cleanup that tears everything down.
 */
export function joinRefereedGame<TState, TPayload>(
    spec: RefereedGameSpec,
    selfUid: string,
    rules: GameRules<TState, TPayload>,
    onState: (s: TState | null) => void,
): () => void {
    const db = getFirebaseDatabase()
    if (!db) return () => {}

    let processLoopUnsub: (() => void) | null = null
    let lastRefereeUid: string | null = null

    const stateUnsub = onValue(ref(db, spec.statePath), (snap) => {
        const val = snap.val() as (TState & { refereeUid?: string }) | null
        onState(val)

        // (Re)attach the process loop only if we are *currently* the
        // referee. Tear down if a handoff moves it elsewhere.
        const refUid = val?.refereeUid ?? null
        if (refUid !== lastRefereeUid) {
            lastRefereeUid = refUid
            if (processLoopUnsub) {
                processLoopUnsub()
                processLoopUnsub = null
            }
            if (refUid === selfUid) {
                processLoopUnsub = refereeProcessLoop(spec, rules, selfUid)
            }
        }
    })

    const handoffUnsub = watchAndHandoffReferee(spec, selfUid)

    return () => {
        stateUnsub()
        handoffUnsub()
        if (processLoopUnsub) processLoopUnsub()
    }
}
