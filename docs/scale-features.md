# Scale-feature decision docs (B1, B2, B3)

These three features were originally tagged in the audit as **"on usage
signal, not on roadmap"** — they only become worth their bundle and
ops cost once real usage data shows the existing limits being hit.
This doc captures what each one is, when to turn it on, and the
concrete wedge point in the codebase where it would slot in.

If you reach a usage signal that justifies one of these, the
implementation is well-scoped: each is **1–2 weeks** of focused work
with the wedge already drilled out.

---

## B1 — WebTorrent fallback for file shares to >4 viewers

### What it is

When the sender uploads a file in a room with N other participants,
the Phase 2 protocol opens N separate WebRTC DataChannel transfers
from sender → each peer. The sender's uplink is the bottleneck:
N viewers × file-size bytes have to leave their tab. On a 50 MB clip
shared to 6 viewers over LTE, this is 5–10 minutes of upload time.

WebTorrent ([webtorrent.io](https://webtorrent.io), MIT license, pure
browser, no server) turns this into a swarm: once the first chunk lands
on viewer A, viewer B starts pulling chunks from A as well as the
sender. Sender's uplink stops being the bottleneck.

### When to turn it on

- Median room size > 4 in usage telemetry
- File sends > 20 MB are common
- User reports of "upload is too slow"

### Wedge point

In `utils/p2p/file-transfer.ts`, `registerOutgoing` currently returns
a `FileOffer` and lets one-to-many fan-out happen as N parallel
transfers. Refactor: when the receiver count is > 4, switch from
"N DataChannel transfers" to "publish a magnet URI in the chat
message; viewers join the swarm."

```ts
// New: optional swarm mode in registerOutgoing
if (room.memberCount > SWARM_THRESHOLD) {
    const { default: WebTorrent } = await import("webtorrent")
    const client = new WebTorrent({ tracker: false })  // trackerless
    client.seed(file, { announce: [] }, (torrent) => {
        // Embed magnet URI as the file-offer.payload in the chat msg
    })
}
```

Trackerless WebRTC swarm — no server side. Same DataChannel signaling
the chat already uses.

### Bundle cost

WebTorrent + dependencies: ~150 KB gzipped. Pushes First Load JS
from 211 KB to ~360 KB. Dynamic-import it so only swarm-eligible
rooms pay.

### Documentation TODO when it lands

- Update `ARCHITECTURE.md` trust-matrix row for "File transfer"
- Document the magnet-URI shape in the chat message contract
- Add an e2e test (would need 3+ contexts; Playwright supports this)

---

## B2 — Self-hosted SFU for theater broadcast > 6 viewers

### What it is

Phase 3 capped theater broadcast at 6 mesh viewers (`MAX_VIEWERS = 6`
in `utils/p2p/theater-broadcast.ts`). Past 6, the host's uplink
saturates regardless of encoding ramp. Beyond that point you need a
selective forwarding unit (SFU) — a server that the host uploads to
once and that fans out to N viewers, all over WebRTC.

Recommended OSS options:

- **[LiveKit OSS](https://livekit.io)** (Apache-2). Ships as a single
  Go binary; native WebRTC ingress + egress; mature client SDK.
  Self-host on a $6–10/mo VPS.
- **[mediasoup](https://mediasoup.org)** (ISC). Node.js, more
  composable, more code to write to use.
- **[Jitsi Videobridge](https://jitsi.org/jitsi-videobridge)**
  (Apache-2). The OG. Big footprint.

### When to turn it on

- Median theater session > 6 viewers
- User reports of viewer cap blocking specific use cases

### Wedge point

In `utils/p2p/theater-broadcast.ts` the `MAX_VIEWERS` constant is
the gate. The `TheaterBroadcast` class encapsulates host-side state.
For SFU mode, the wedge is:

```ts
// New constructor option
new TheaterBroadcast({
    ...,
    mode: viewerCount > MAX_VIEWERS ? "sfu" : "mesh",
    sfuConfig: process.env.NEXT_PUBLIC_LIVEKIT_URL ? {
        url: process.env.NEXT_PUBLIC_LIVEKIT_URL,
        // token exchange via Firebase
    } : undefined,
})
```

In SFU mode the host publishes its captured stream to the SFU via
LiveKit's `RoomServiceClient`; viewers subscribe through the same
SFU. Existing `WebRTCManager` peers stay for the audio-call /
text-chat layer. The Firebase signaling for theater becomes a thin
layer that just announces "session at livekit-room-id $X".

### Ops cost

A $6/mo Hetzner Cloud VPS running LiveKit can comfortably handle a
few hundred viewers across many concurrent rooms. SatLoom's "no
server" thesis breaks at this scale by definition.

### Why this is "feature-flagged off by default"

Adding even an optional SFU adds operational complexity (deploy,
monitor, scale). Should only be enabled when the user-side bandwidth
math doesn't work for mesh anymore.

---

## B3 — Simulcast for theater broadcast

### What it is

Today the encoding ramp in `TheaterBroadcast` picks **one**
resolution + bitrate based on viewer count (720p / 540p / 360p) and
sends the same encoding to every viewer. A viewer on a 4G phone gets
the same 720p the desktop viewer gets, and may stall.

Simulcast: the host publishes 2-3 encodings at once (e.g. 360p / 540p
/ 720p) tagged with `rid` (restriction identifier). The receiving SFU
or peer picks the best encoding per viewer based on their network.

### When to turn it on

- B2 (SFU) is in place (simulcast is most valuable with an SFU
  selecting per-viewer)
- Viewer reports of "stuttering at higher resolutions"

### Wedge point

In `utils/p2p/theater-broadcast.ts`, `applyEncodingParams` currently
calls `sender.setParameters({ encodings: [{ maxBitrate, … }] })` with
**one** entry. Simulcast = three entries:

```ts
sender.setParameters({
    encodings: [
        { rid: "low",  maxBitrate: 360_000, scaleResolutionDownBy: 4 },
        { rid: "mid",  maxBitrate: 800_000, scaleResolutionDownBy: 2 },
        { rid: "high", maxBitrate: 2_000_000, scaleResolutionDownBy: 1 },
    ],
})
```

### Caveats

- Chromium and Firefox have different simulcast quirks
- Safari simulcast is incomplete on older versions
- SDP munging may be needed for some peer combinations

Test matrix: Chrome ↔ Firefox, Chrome ↔ Safari, Firefox ↔ Safari,
mobile-on-each.

---

## B4 — Self-host FFmpeg WASM core ✅ implemented

The wedge point in `utils/hardware/video-stream-manager.ts` now
prefers `/satloom/ffmpeg/` when present, falls back to unpkg
otherwise. Operators populate `public/ffmpeg/` per its README.

Adds 10 MB to the static export when enabled, eliminates the unpkg
runtime dependency, lets the project be deployed in air-gapped
environments. See `public/ffmpeg/README.md`.

---

## Summary table

| Feature | Bundle cost | Server cost | When to turn on | Status |
|---|---|---|---|---|
| B1 WebTorrent | ~150 KB gzipped | $0 | Median room > 4, files > 20 MB common | Wedged + documented |
| B2 SFU (LiveKit) | minimal client (~50 KB SDK) | $6–10/mo VPS | Median theater > 6 viewers | Wedged + documented |
| B3 Simulcast | minimal | depends on B2 | After B2 + viewer device variance reports | Wedged + documented |
| B4 Self-host FFmpeg | +10 MB static export | $0 | Operator preference | ✅ Implemented |

When you ship any of B1–B3, update the relevant rows in `ARCHITECTURE.md`'s
trust matrix and remove that row from the "What's intentionally not
implemented" list.
