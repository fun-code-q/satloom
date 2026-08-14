import { test } from "@playwright/test"
import { skipWithoutFirebase, spawnPeer, closePeer, newTestRoomId, waitFor, expect, enterRoom, rtdbRead, rtdbPush } from "./_helpers"

/**
 * Theater session signalling smoke.
 *
 * WHAT THIS COVERS: a host publishes a theater session into the room, and
 * a second member can read it back. That exercises the `theater` write and
 * the member read-gate, which is the part that actually broke when the
 * hardened rules went in.
 *
 * WHAT THIS DOES NOT COVER: media. No `RTCPeerConnection` is established
 * and no track is exchanged, so this says nothing about whether a viewer
 * really receives the host's stream.
 *
 * It used to claim otherwise. The previous version was titled "viewer
 * receives the host's media stream" but dynamic-imported
 * `/satloom/_next/static/utils/infra/theater-signaling.js` — a path that
 * does not exist in a static export — swallowed the failure with
 * `.catch(() => null)`, and fell through to asserting `lastActivityAt > 0`
 * via `window.firebase` (the v8 compat namespace this app never creates,
 * so it read 0 and the whole spec was unfalsifiable). Verifying real media
 * needs two live peer connections and frame inspection; until someone
 * builds that, this spec is scoped to what it can actually prove.
 */

test.describe("@firebase theater session", () => {
    test.beforeEach(() => skipWithoutFirebase())

    test("a room member can read a theater session published by the host", async ({ browser }) => {
        const host = await spawnPeer(browser, "TheaterHost")
        const viewer = await spawnPeer(browser, "TheaterViewer")
        const roomId = newTestRoomId()

        try {
            await enterRoom(host, roomId)
            await enterRoom(viewer, roomId)
            const hostUid = await host.uid()
            const viewerUid = await viewer.uid()

            // A theater session is readable by the room's members and by
            // nobody else. That read-gate is what this spec can honestly
            // verify end-to-end; see the note above about media.
            await rtdbPush(host, `rooms/${roomId}/theater`, {
                hostId: hostUid,
                hostName: "TheaterHost",
                mediaType: "webrtc",
                startedAt: Date.now(),
                status: "playing",
            })

            const seen = await waitFor(viewer.page, async () => {
                const t = await rtdbRead(viewer, `rooms/${roomId}/theater`).catch(() => null)
                return t && typeof t === "object" && Object.keys(t).length > 0 ? t : false
            }, 15_000)

            const sessions = Object.values(seen as Record<string, { hostId?: string; status?: string }>)
            expect(sessions.some((s) => s.hostId === hostUid && s.status === "playing")).toBe(true)
            expect(hostUid).not.toBe(viewerUid)
        } finally {
            await closePeer(host)
            await closePeer(viewer)
        }
    })
})
