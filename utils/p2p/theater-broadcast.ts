/**
 * Theater-mode video broadcast over WebRTC.
 *
 * The host plays a local video file (or a screen-share stream) and pipes
 * the resulting MediaStream to every other room member who has joined the
 * theater session. There is no SFU and no server: each viewer establishes
 * its own peer connection to the host, so the host's uplink scales linearly
 * with the audience.
 *
 * To keep the uplink survivable on a typical home internet connection, the
 * encoding parameters auto-ramp with audience size and we cap the number
 * of viewers at {@link MAX_VIEWERS}. Viewers beyond the cap receive a
 * "theater-full" signal and bail out cleanly.
 *
 * Why this module exists
 * ----------------------
 * Before this module, host-side broadcast logic was duplicated in three
 * places inside `components/theater-fullscreen.tsx` and the cleanup path
 * called `WebRTCManager.getInstance().cleanup()` with no argument — which
 * tears down ALL peer connections in the singleton, including unrelated
 * call connections. This module owns those concerns:
 *
 *   - tracks which peers are bound to the broadcast (vs. regular calls)
 *   - performs surgical cleanup when the theater ends (no blast radius)
 *   - applies encoding parameters as viewers join/leave
 *   - rejects late joiners past the cap
 *
 * SDP signaling still flows through `TheaterSignaling` (Firebase) and is
 * consumed by `theater-fullscreen.tsx` viewer-side. This module only owns
 * the *host* side of the broadcast.
 */

import { WebRTCManager } from "@/utils/infra/webrtc-manager"
import { TheaterSignaling } from "@/utils/infra/theater-signaling"

// ---------------------------------------------------------------------------
// Configuration

/** Hard cap on simultaneous viewers per host. Keeps the uplink survivable. */
export const MAX_VIEWERS = 6

/**
 * Encoding presets keyed by audience size. Each preset pins a per-viewer
 * outbound bitrate and resolution scaler. Picked empirically to keep
 * total uplink under ~12 Mbps (typical residential upstream).
 */
const ENCODING_PRESETS: Array<{
    upTo: number
    maxBitrate: number
    scaleResolutionDownBy: number
    maxFramerate: number
    label: string
}> = [
    { upTo: 2, maxBitrate: 2_000_000, scaleResolutionDownBy: 1, maxFramerate: 30, label: "720p" },
    { upTo: 4, maxBitrate: 1_200_000, scaleResolutionDownBy: 1.33, maxFramerate: 30, label: "540p" },
    { upTo: 6, maxBitrate: 700_000, scaleResolutionDownBy: 2, maxFramerate: 24, label: "360p" },
]

function presetFor(viewerCount: number) {
    return ENCODING_PRESETS.find(p => viewerCount <= p.upTo) ?? ENCODING_PRESETS[ENCODING_PRESETS.length - 1]
}

// ---------------------------------------------------------------------------
// Types

export interface TheaterBroadcastOptions {
    roomId: string
    sessionId: string
    hostUid: string
    /** The captured MediaStream (from VideoStreamManager.captureStream() or getDisplayMedia). */
    stream: MediaStream
    signaling: TheaterSignaling
    /** Called when a viewer is rejected because the theater is full. */
    onViewerRejected?: (viewerUid: string) => void
    /** Called whenever the encoding preset changes, for status UI. */
    onQualityChange?: (label: string, viewerCount: number) => void
}

// ---------------------------------------------------------------------------
// Implementation

export class TheaterBroadcast {
    private readonly opts: TheaterBroadcastOptions
    private readonly webrtc = WebRTCManager.getInstance()

    /** UIDs of viewers we have actively bound to this broadcast. */
    private readonly connectedViewers = new Set<string>()

    /** Disposed: stop all activity, ignore further events. */
    private disposed = false

    constructor(opts: TheaterBroadcastOptions) {
        this.opts = opts
    }

    get viewerCount(): number {
        return this.connectedViewers.size
    }

    /**
     * Reconcile the broadcast against the latest participant list from the
     * theater session. Adds peer connections for new participants (up to
     * the cap), drops connections for participants who left, and updates
     * encoding parameters across all senders.
     */
    async reconcile(participants: string[]): Promise<void> {
        if (this.disposed) return

        // 1. Compute incoming viewers (participants minus host minus already connected).
        const incoming = participants.filter(
            uid => uid !== this.opts.hostUid && !this.connectedViewers.has(uid),
        )

        // 2. Compute departed viewers.
        const departed = Array.from(this.connectedViewers).filter(
            uid => !participants.includes(uid),
        )

        // 3. Drop departed viewers' peer connections — surgical, only theater peers.
        for (const uid of departed) {
            this.dropViewer(uid)
        }

        // 4. Add new viewers up to the cap.
        for (const uid of incoming) {
            if (this.connectedViewers.size >= MAX_VIEWERS) {
                this.rejectViewer(uid)
                continue
            }
            await this.addViewer(uid)
        }

        // 5. Re-apply encoding params (viewer count may have changed).
        await this.applyEncodingParams()
    }

    /**
     * Add a viewer: open a peer connection bound to this broadcast, attach
     * the broadcast stream, send the SDP offer via theater signaling.
     */
    private async addViewer(viewerUid: string): Promise<void> {
        if (this.disposed) return

        this.webrtc.initialize(
            viewerUid,
            this.opts.stream,
            // The host doesn't expect a reverse stream from viewers in theater
            // mode. Track callbacks are still wired (no-op handler) to satisfy
            // the manager's contract; receiver-side video lands in
            // theater-fullscreen.tsx via its own `listenForSignals` setup.
            () => { /* host ignores any back-stream */ },
            (candidate, uid) => {
                if (uid !== viewerUid) return
                this.opts.signaling.sendSignal(
                    this.opts.roomId,
                    this.opts.sessionId,
                    "ice-candidate",
                    candidate.toJSON(),
                    this.opts.hostUid,
                    viewerUid,
                ).catch(err => console.warn("[theater-broadcast] sendSignal ice failed:", err))
            },
            (state, uid) => {
                if (uid !== viewerUid) return
                if (state === "closed" || state === "failed") {
                    this.connectedViewers.delete(viewerUid)
                }
            },
            "theater",
        )

        try {
            const offer = await this.webrtc.createOffer(viewerUid)
            await this.opts.signaling.sendSignal(
                this.opts.roomId,
                this.opts.sessionId,
                "offer",
                offer,
                this.opts.hostUid,
                viewerUid,
            )
            this.connectedViewers.add(viewerUid)
        } catch (err) {
            // Most often this is the WebRTCManager's "Signaling lock active"
            // — safe to ignore; reconcile will retry on the next participant
            // tick.
            const msg = err instanceof Error ? err.message : String(err)
            if (msg !== "Signaling lock active") {
                console.error("[theater-broadcast] createOffer failed for", viewerUid, err)
            }
        }
    }

    /**
     * Tell a would-be viewer the theater is full, so they can show a clean
     * "broadcast full" state instead of waiting for an offer that will
     * never arrive.
     */
    private rejectViewer(viewerUid: string): void {
        this.opts.signaling.sendSignal(
            this.opts.roomId,
            this.opts.sessionId,
            "theater-full",
            { reason: "max-viewers", cap: MAX_VIEWERS },
            this.opts.hostUid,
            viewerUid,
        ).catch(err => console.warn("[theater-broadcast] reject signal failed:", err))
        this.opts.onViewerRejected?.(viewerUid)
    }

    /**
     * Close just one viewer's peer connection — surgical, won't disturb
     * other room peer connections that exist for regular calls.
     */
    private dropViewer(viewerUid: string): void {
        this.connectedViewers.delete(viewerUid)
        try {
            this.webrtc.cleanup(viewerUid)
        } catch (err) {
            console.warn("[theater-broadcast] cleanup failed for", viewerUid, err)
        }
    }

    /**
     * Apply the encoding preset that matches the current viewer count to
     * every active video sender on every viewer's peer connection.
     */
    private async applyEncodingParams(): Promise<void> {
        const preset = presetFor(this.connectedViewers.size)

        for (const viewerUid of this.connectedViewers) {
            const pc = this.webrtc.getPeerConnection(viewerUid)
            if (!pc) continue

            for (const sender of pc.getSenders()) {
                if (sender.track?.kind !== "video") continue
                try {
                    const params = sender.getParameters()
                    if (!params.encodings || params.encodings.length === 0) {
                        params.encodings = [{}]
                    }
                    params.encodings[0].maxBitrate = preset.maxBitrate
                    params.encodings[0].scaleResolutionDownBy = preset.scaleResolutionDownBy
                    params.encodings[0].maxFramerate = preset.maxFramerate
                    await sender.setParameters(params)
                } catch (err) {
                    // Some browsers reject mid-call setParameters. Non-fatal.
                    console.warn("[theater-broadcast] setParameters failed:", err)
                }
            }
        }

        this.opts.onQualityChange?.(preset.label, this.connectedViewers.size)
    }

    /**
     * Tear down ONLY the peer connections this broadcast owns. Does NOT
     * touch the WebRTCManager singleton's other connections (e.g. ongoing
     * regular calls).
     */
    dispose(): void {
        if (this.disposed) return
        this.disposed = true
        for (const uid of this.connectedViewers) {
            try { this.webrtc.cleanup(uid) } catch { /* ignore */ }
        }
        this.connectedViewers.clear()
    }
}
