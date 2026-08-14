/**
 * @deprecated UNWIRED — this hardened replacement (SHA-256 integrity,
 * accept handshake, buffered-amount backpressure, uid-keyed signaling) is
 * NOT used by the live app. The UI still imports the OLD module at
 * utils/infra/p2p-file-transfer.ts (no integrity check, name-keyed
 * signaling). Switching requires a non-trivial API refactor (registerFile→
 * registerOutgoing, requestFile→receiveFile, fileId string→FileOffer
 * object, name→uid) across 3 call sites and CANNOT be e2e-tested without
 * two real WebRTC peers. Tracked as a dedicated future task requiring
 * multiplayer testing. See DEPRECATED.md.
 *
 * P2P file transfer over WebRTC DataChannel.
 *
 * Files NEVER touch Firebase. Only short-lived signaling messages
 * (SDP offer/answer + ICE candidates + a request handshake) flow through
 * Firebase Realtime DB at `rooms/$roomId/p2pSignals/$peerUid`. The actual
 * payload is exchanged peer-to-peer.
 *
 * Wire protocol (per file, per DataChannel):
 *
 *   1. Channel opens.
 *   2. Sender ──── { kind: "offer", offer: FileOffer } ────▶ Receiver
 *      (FileOffer carries name, mime, size, sha256 hex of full payload, senderUid)
 *   3. Receiver ──── { kind: "accept" } ────▶ Sender         (or { kind: "reject", reason })
 *   4. Sender streams binary chunks (raw ArrayBuffer, ≤ 16 KiB each)
 *      — backpressure via the `bufferedamountlow` event, NOT setTimeout polling.
 *   5. Sender ──── { kind: "eof" } ────▶ Receiver
 *   6. Receiver hashes assembled blob; verifies against offer.sha256.
 *      ──── { kind: "ack" } ────▶ Sender                     (or { kind: "fail", reason })
 *   7. Both sides close the channel.
 *
 * At any point either side may send { kind: "cancel", reason }.
 *
 * Designed for Phase 2 of the implementation plan. Replaces the old
 * `utils/infra/p2p-file-transfer.ts` which had no integrity check, no
 * accept handshake, used setTimeout busy-loop for backpressure, and
 * keyed signaling on usernames instead of auth UIDs.
 */

import { getFirebaseDatabase } from "@/lib/firebase"
import { onChildAdded, push, ref, remove } from "firebase/database"
import { WEBRTC_CONFIG } from "@/lib/webrtc"

// ---------------------------------------------------------------------------
// Public types

export interface FileOffer {
    fileId: string
    name: string
    mime: string
    size: number
    sha256: string
    senderUid: string
}

export type TransferStatus =
    | "idle"
    | "connecting"
    | "transferring"
    | "verifying"
    | "completed"
    | "rejected"
    | "cancelled"
    | "error"

export interface TransferProgress {
    fileId: string
    bytesTransferred: number
    totalBytes: number
    status: TransferStatus
    error?: string
}

export interface ReceiveOptions {
    onProgress?: (p: TransferProgress) => void
    /** Auto-accept the file. Default: true. Set false to require manual accept. */
    autoAccept?: boolean
}

// ---------------------------------------------------------------------------
// Configuration

/** Hard cap on file size. Larger files are rejected client-side before transfer. */
export const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

/** DataChannel chunk size. 16 KiB is safe across all browsers. */
const CHUNK_SIZE = 16 * 1024

/** Pause sending when DC bufferedAmount exceeds this. */
const BUFFER_HIGH_WATER = 1 * 1024 * 1024 // 1 MB

/** Resume sending when DC bufferedAmount drops below this. */
const BUFFER_LOW_WATER = 256 * 1024 // 256 KiB

/** Connecting timeout (ICE not connected within this → fail). */
const CONNECT_TIMEOUT_MS = 30_000

/** Per-file overall timeout (no progress for this long → fail). */
const STALL_TIMEOUT_MS = 60_000

// ---------------------------------------------------------------------------
// Helpers

async function sha256Hex(data: ArrayBuffer): Promise<string> {
    const hash = await crypto.subtle.digest("SHA-256", data)
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("")
}

function newFileId(): string {
    // Crypto-strong random ID, hex-encoded for compactness without BigInt.
    const bytes = crypto.getRandomValues(new Uint8Array(12))
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("")
    return `p2p_${Date.now().toString(36)}_${hex}`
}

interface ControlMessage {
    kind: "offer" | "accept" | "reject" | "eof" | "ack" | "fail" | "cancel"
    offer?: FileOffer
    reason?: string
}

function parseControlMessage(data: unknown): ControlMessage | null {
    if (typeof data !== "string") return null
    try {
        const parsed = JSON.parse(data) as Partial<ControlMessage>
        if (typeof parsed?.kind !== "string") return null
        return parsed as ControlMessage
    } catch {
        return null
    }
}

// ---------------------------------------------------------------------------
// Singleton manager

interface OutgoingState {
    file: File
    offer: FileOffer
    /** Resolved when transfer completes successfully. */
    resolve: (offer: FileOffer) => void
    reject: (err: Error) => void
    onProgress?: (p: TransferProgress) => void
    cancelled: boolean
}

interface IncomingState {
    offer: FileOffer
    resolve: (blob: Blob) => void
    reject: (err: Error) => void
    onProgress?: (p: TransferProgress) => void
    chunks: ArrayBuffer[]
    bytesReceived: number
    cancelled: boolean
    autoAccept: boolean
}

interface SignalingMessage {
    fromUserId: string
    type: "request" | "offer" | "answer" | "candidate" | "cancel"
    payload?: unknown
    fileId: string
    timestamp: number
}

class P2PFileTransferManager {
    private static _instance: P2PFileTransferManager | null = null

    private roomId = ""
    private uid = ""
    private initialized = false

    /** fileId → outgoing state (sender side) */
    private outgoing = new Map<string, OutgoingState>()

    /** fileId → incoming state (receiver side) */
    private incoming = new Map<string, IncomingState>()

    /** connectionKey (`${peerUid}_${fileId}`) → RTCPeerConnection */
    private peerConnections = new Map<string, RTCPeerConnection>()

    /** connectionKey → pending ICE candidates received before remote SDP */
    private iceBuffers = new Map<string, RTCIceCandidateInit[]>()

    /** Unsubscribe function for the signaling listener. */
    private unsubSignals: (() => void) | null = null

    static getInstance(): P2PFileTransferManager {
        if (!P2PFileTransferManager._instance) {
            P2PFileTransferManager._instance = new P2PFileTransferManager()
        }
        return P2PFileTransferManager._instance
    }

    /**
     * Initialize the manager for a room. Must be called with the user's
     * Firebase auth UID — NOT a display name.
     */
    initialize(roomId: string, uid: string): void {
        if (this.initialized && this.roomId === roomId && this.uid === uid) return
        this.cleanup()

        this.roomId = roomId
        this.uid = uid
        this.initialized = true

        const db = getFirebaseDatabase()
        if (!db) {
            console.warn("[p2p] Firebase not available; signaling disabled")
            return
        }

        const signalsRef = ref(db, `rooms/${roomId}/p2pSignals/${uid}`)
        const handler = onChildAdded(signalsRef, async snapshot => {
            const signal = snapshot.val() as SignalingMessage | null
            const signalId = snapshot.key
            if (!signal || !signalId) return

            // Always remove the signal after handling — single-use mailbox.
            remove(ref(db, `rooms/${roomId}/p2pSignals/${uid}/${signalId}`)).catch(() => {})

            try {
                await this.handleSignal(signal)
            } catch (err) {
                console.error("[p2p] signal handler error:", err)
            }
        })
        this.unsubSignals = () => handler()
    }

    /** Tear down all in-flight transfers and signaling. */
    cleanup(): void {
        this.unsubSignals?.()
        this.unsubSignals = null

        for (const pc of this.peerConnections.values()) {
            try { pc.close() } catch { /* ignore */ }
        }
        this.peerConnections.clear()
        this.iceBuffers.clear()

        for (const out of this.outgoing.values()) {
            out.cancelled = true
            out.reject(new Error("Manager cleaned up"))
        }
        this.outgoing.clear()

        for (const inc of this.incoming.values()) {
            inc.cancelled = true
            inc.reject(new Error("Manager cleaned up"))
        }
        this.incoming.clear()

        this.initialized = false
        this.roomId = ""
        this.uid = ""
    }

    // -----------------------------------------------------------------
    // SENDER API

    /**
     * Register a file for outgoing transfer. Computes SHA-256 of the file
     * eagerly so the offer can carry it. Returns the public {@link FileOffer}
     * descriptor that should be embedded in the chat message — receivers
     * use this to claim the file.
     */
    async registerOutgoing(file: File): Promise<FileOffer> {
        if (!this.initialized) throw new Error("P2P manager not initialized")
        if (file.size > MAX_FILE_SIZE) {
            throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB > ${MAX_FILE_SIZE / 1024 / 1024} MB cap)`)
        }

        const fileId = newFileId()
        const sha256 = await sha256Hex(await file.arrayBuffer())
        const offer: FileOffer = {
            fileId,
            name: file.name,
            mime: file.type || "application/octet-stream",
            size: file.size,
            sha256,
            senderUid: this.uid,
        }

        // Stash the file; receiver will claim it via a "request" signal.
        // We resolve the promise eagerly — completion is reported via the
        // optional progress callback registered on receive.
        return new Promise<FileOffer>(resolve => {
            this.outgoing.set(fileId, {
                file,
                offer,
                resolve: () => resolve(offer),
                reject: () => resolve(offer), // metadata is already valid
                cancelled: false,
            })
            // Resolve immediately with the descriptor
            resolve(offer)
        })
    }

    /**
     * Cancel a pending outgoing transfer (releases the File reference).
     * Safe to call even if no such transfer exists.
     */
    /**
     * Return the File registered for outgoing transfer with this id, if any.
     * Used by the sender's own message bubble to render a local preview
     * without a peer round-trip — the file is already in this tab's memory.
     */
    getOutgoingFile(fileId: string): File | null {
        return this.outgoing.get(fileId)?.file ?? null
    }

    cancelOutgoing(fileId: string): void {
        const out = this.outgoing.get(fileId)
        if (!out) return
        out.cancelled = true
        this.outgoing.delete(fileId)

        // Also tear down any active PCs for this file
        for (const [key, pc] of this.peerConnections.entries()) {
            if (key.endsWith("_" + fileId)) {
                try { pc.close() } catch { /* ignore */ }
                this.peerConnections.delete(key)
                this.iceBuffers.delete(key)
            }
        }
    }

    // -----------------------------------------------------------------
    // RECEIVER API

    /**
     * Receive a file given an offer from the sender. Resolves with the
     * assembled Blob once it's been verified against the offer's SHA-256.
     */
    receiveFile(offer: FileOffer, opts: ReceiveOptions = {}): Promise<Blob> {
        if (!this.initialized) return Promise.reject(new Error("P2P manager not initialized"))
        if (offer.size > MAX_FILE_SIZE) {
            return Promise.reject(new Error("File exceeds size cap"))
        }
        if (offer.senderUid === this.uid) {
            return Promise.reject(new Error("Cannot receive own file"))
        }

        const existing = this.incoming.get(offer.fileId)
        if (existing) {
            // Already in flight; piggyback onto the existing promise via progress only.
            return Promise.reject(new Error("Transfer already in progress for this fileId"))
        }

        return new Promise<Blob>((resolve, reject) => {
            const state: IncomingState = {
                offer,
                resolve,
                reject,
                onProgress: opts.onProgress,
                chunks: [],
                bytesReceived: 0,
                cancelled: false,
                autoAccept: opts.autoAccept ?? true,
            }
            this.incoming.set(offer.fileId, state)

            opts.onProgress?.({
                fileId: offer.fileId,
                bytesTransferred: 0,
                totalBytes: offer.size,
                status: "connecting",
            })

            // Send a request to the sender; they'll create the offer + DC.
            this.sendSignal(offer.senderUid, "request", { offer }, offer.fileId).catch(err => {
                this.failIncoming(offer.fileId, err instanceof Error ? err.message : "request failed")
            })

            // Connection-establishment timeout
            setTimeout(() => {
                const cur = this.incoming.get(offer.fileId)
                if (!cur) return
                if (cur.bytesReceived === 0) {
                    this.failIncoming(offer.fileId, "connection timed out")
                }
            }, CONNECT_TIMEOUT_MS)
        })
    }

    cancelIncoming(fileId: string, reason = "cancelled by receiver"): void {
        const inc = this.incoming.get(fileId)
        if (!inc) return
        inc.cancelled = true

        // Notify sender
        this.sendSignal(inc.offer.senderUid, "cancel", { reason }, fileId).catch(() => {})

        this.failIncoming(fileId, reason)
    }

    // -----------------------------------------------------------------
    // SIGNAL HANDLING

    private async handleSignal(signal: SignalingMessage): Promise<void> {
        const { fromUserId, type, fileId } = signal
        const connectionKey = `${fromUserId}_${fileId}`

        switch (type) {
            case "request":
                await this.onRequestForFile(fromUserId, fileId)
                return
            case "offer":
                await this.onSdpOffer(fromUserId, fileId, signal.payload as RTCSessionDescriptionInit)
                return
            case "answer":
                await this.onSdpAnswer(connectionKey, signal.payload as RTCSessionDescriptionInit)
                return
            case "candidate":
                await this.onIceCandidate(connectionKey, signal.payload as RTCIceCandidateInit)
                return
            case "cancel":
                // Sender ↔ receiver propagated cancel
                this.peerConnections.get(connectionKey)?.close()
                this.peerConnections.delete(connectionKey)
                this.iceBuffers.delete(connectionKey)
                this.failIncoming(fileId, "remote cancelled")
                return
        }
    }

    /** Sender-side: receiver wants the file → create PC + DataChannel and send SDP offer. */
    private async onRequestForFile(receiverUid: string, fileId: string): Promise<void> {
        const out = this.outgoing.get(fileId)
        if (!out || out.cancelled) {
            // No such file (or cancelled) — silently ignore; receiver will time out.
            return
        }

        const connectionKey = `${receiverUid}_${fileId}`
        const pc = this.createPeerConnection(receiverUid, fileId)
        const dc = pc.createDataChannel(`file_${fileId}`, { ordered: true })

        dc.binaryType = "arraybuffer"
        dc.bufferedAmountLowThreshold = BUFFER_LOW_WATER

        dc.onopen = () => {
            this.startSenderFlow(out, dc).catch(err => {
                console.error("[p2p] sender flow failed:", err)
                this.cleanupConnection(connectionKey)
            })
        }
        dc.onmessage = ev => this.onSenderControlMessage(out, dc, ev.data, connectionKey)
        dc.onclose = () => this.cleanupConnection(connectionKey)
        dc.onerror = err => {
            console.error("[p2p] sender DC error:", err)
            this.cleanupConnection(connectionKey)
        }

        try {
            const sdp = await pc.createOffer()
            await pc.setLocalDescription(sdp)
            await this.sendSignal(receiverUid, "offer", sdp, fileId)
        } catch (err) {
            console.error("[p2p] createOffer failed:", err)
            this.cleanupConnection(connectionKey)
        }
    }

    /** Receiver-side: handle the sender's SDP offer; create answer + accept channel. */
    private async onSdpOffer(senderUid: string, fileId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
        const inc = this.incoming.get(fileId)
        if (!inc) return

        const connectionKey = `${senderUid}_${fileId}`
        const pc = this.peerConnections.get(connectionKey) ?? this.createPeerConnection(senderUid, fileId)

        pc.ondatachannel = ev => {
            const dc = ev.channel
            dc.binaryType = "arraybuffer"
            dc.onmessage = mev => this.onReceiverMessage(inc, dc, mev.data)
            dc.onclose = () => this.cleanupConnection(connectionKey)
            dc.onerror = err => {
                console.error("[p2p] receiver DC error:", err)
                this.failIncoming(fileId, "datachannel error")
            }
        }

        try {
            await pc.setRemoteDescription(sdp)
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            await this.sendSignal(senderUid, "answer", answer, fileId)
            await this.flushIceBuffer(connectionKey)
        } catch (err) {
            console.error("[p2p] receiver SDP handling failed:", err)
            this.failIncoming(fileId, "SDP exchange failed")
        }
    }

    private async onSdpAnswer(connectionKey: string, sdp: RTCSessionDescriptionInit): Promise<void> {
        const pc = this.peerConnections.get(connectionKey)
        if (!pc) return
        try {
            await pc.setRemoteDescription(sdp)
            await this.flushIceBuffer(connectionKey)
        } catch (err) {
            console.error("[p2p] sender setRemoteDescription failed:", err)
        }
    }

    private async onIceCandidate(connectionKey: string, candidate: RTCIceCandidateInit): Promise<void> {
        const pc = this.peerConnections.get(connectionKey)
        if (!pc) return

        if (!pc.remoteDescription) {
            const buf = this.iceBuffers.get(connectionKey) ?? []
            buf.push(candidate)
            this.iceBuffers.set(connectionKey, buf)
            return
        }
        try {
            await pc.addIceCandidate(candidate)
        } catch (err) {
            console.warn("[p2p] addIceCandidate failed:", err)
        }
    }

    private async flushIceBuffer(connectionKey: string): Promise<void> {
        const pc = this.peerConnections.get(connectionKey)
        const buf = this.iceBuffers.get(connectionKey)
        if (!pc || !pc.remoteDescription || !buf) return
        while (buf.length > 0) {
            const c = buf.shift()
            if (!c) continue
            try { await pc.addIceCandidate(c) } catch { /* ignore */ }
        }
    }

    // -----------------------------------------------------------------
    // SENDER FLOW (over DataChannel)

    private async startSenderFlow(out: OutgoingState, dc: RTCDataChannel): Promise<void> {
        // 1. Send the offer
        dc.send(JSON.stringify({ kind: "offer", offer: out.offer } as ControlMessage))
        // 2. Wait for the receiver's accept/reject in onSenderControlMessage
        // (chunk streaming is kicked off there)
    }

    private async onSenderControlMessage(out: OutgoingState, dc: RTCDataChannel, data: unknown, connectionKey: string): Promise<void> {
        const msg = parseControlMessage(data)
        if (!msg) return

        switch (msg.kind) {
            case "accept":
                this.streamFile(out, dc, connectionKey).catch(err => {
                    console.error("[p2p] streamFile error:", err)
                    this.cleanupConnection(connectionKey)
                })
                return
            case "reject":
                console.info(`[p2p] receiver rejected: ${msg.reason ?? "no reason"}`)
                dc.close()
                this.cleanupConnection(connectionKey)
                return
            case "ack":
                // Transfer succeeded — release the File reference.
                this.outgoing.delete(out.offer.fileId)
                out.onProgress?.({
                    fileId: out.offer.fileId,
                    bytesTransferred: out.offer.size,
                    totalBytes: out.offer.size,
                    status: "completed",
                })
                dc.close()
                return
            case "fail":
                console.warn(`[p2p] receiver reported failure: ${msg.reason ?? "no reason"}`)
                dc.close()
                return
            case "cancel":
                dc.close()
                return
        }
    }

    private async streamFile(out: OutgoingState, dc: RTCDataChannel, connectionKey: string): Promise<void> {
        const buf = await out.file.arrayBuffer()
        let offset = 0

        while (offset < buf.byteLength) {
            if (out.cancelled) {
                try { dc.send(JSON.stringify({ kind: "cancel", reason: "sender cancelled" })) } catch { /* */ }
                this.cleanupConnection(connectionKey)
                return
            }

            // Backpressure: block while the channel is full
            if (dc.bufferedAmount > BUFFER_HIGH_WATER) {
                await new Promise<void>(resolve => {
                    const onLow = () => {
                        dc.removeEventListener("bufferedamountlow", onLow)
                        resolve()
                    }
                    dc.addEventListener("bufferedamountlow", onLow)
                })
            }

            const end = Math.min(offset + CHUNK_SIZE, buf.byteLength)
            try {
                dc.send(buf.slice(offset, end))
            } catch (err) {
                console.error("[p2p] chunk send failed:", err)
                return
            }
            offset = end

            out.onProgress?.({
                fileId: out.offer.fileId,
                bytesTransferred: offset,
                totalBytes: out.offer.size,
                status: "transferring",
            })

            // Yield to the event loop occasionally so UI stays responsive
            if ((offset / CHUNK_SIZE) % 64 === 0) {
                await new Promise(r => setTimeout(r, 0))
            }
        }

        try {
            dc.send(JSON.stringify({ kind: "eof" } as ControlMessage))
        } catch (err) {
            console.error("[p2p] eof send failed:", err)
        }
    }

    // -----------------------------------------------------------------
    // RECEIVER FLOW (over DataChannel)

    private onReceiverMessage(inc: IncomingState, dc: RTCDataChannel, data: unknown): void {
        if (inc.cancelled) return

        // Control message?
        const ctrl = parseControlMessage(data)
        if (ctrl) {
            this.handleReceiverControl(inc, dc, ctrl)
            return
        }

        // Otherwise it's a binary chunk
        if (data instanceof ArrayBuffer) {
            inc.chunks.push(data)
            inc.bytesReceived += data.byteLength

            // Soft cap — protect against a malicious sender ignoring offer.size
            if (inc.bytesReceived > inc.offer.size + CHUNK_SIZE) {
                this.failIncoming(inc.offer.fileId, "received more bytes than offered")
                try { dc.send(JSON.stringify({ kind: "fail", reason: "size overflow" })) } catch { /* */ }
                dc.close()
                return
            }

            inc.onProgress?.({
                fileId: inc.offer.fileId,
                bytesTransferred: inc.bytesReceived,
                totalBytes: inc.offer.size,
                status: "transferring",
            })
        }
    }

    private async handleReceiverControl(inc: IncomingState, dc: RTCDataChannel, msg: ControlMessage): Promise<void> {
        switch (msg.kind) {
            case "offer":
                if (inc.autoAccept) {
                    dc.send(JSON.stringify({ kind: "accept" } as ControlMessage))
                } else {
                    // Future: surface to UI for manual accept. For now treat as reject.
                    dc.send(JSON.stringify({ kind: "reject", reason: "manual accept required (not implemented)" }))
                }
                return

            case "eof": {
                inc.onProgress?.({
                    fileId: inc.offer.fileId,
                    bytesTransferred: inc.bytesReceived,
                    totalBytes: inc.offer.size,
                    status: "verifying",
                })

                const blob = new Blob(inc.chunks, { type: inc.offer.mime })
                const actualHash = await sha256Hex(await blob.arrayBuffer())
                if (actualHash !== inc.offer.sha256) {
                    try { dc.send(JSON.stringify({ kind: "fail", reason: "sha256 mismatch" })) } catch { /* */ }
                    this.failIncoming(inc.offer.fileId, "integrity check failed")
                    dc.close()
                    return
                }

                try { dc.send(JSON.stringify({ kind: "ack" } as ControlMessage)) } catch { /* */ }
                inc.onProgress?.({
                    fileId: inc.offer.fileId,
                    bytesTransferred: inc.offer.size,
                    totalBytes: inc.offer.size,
                    status: "completed",
                })
                inc.resolve(blob)
                this.incoming.delete(inc.offer.fileId)
                dc.close()
                return
            }

            case "cancel":
                this.failIncoming(inc.offer.fileId, msg.reason ?? "remote cancelled")
                dc.close()
                return
        }
    }

    private failIncoming(fileId: string, reason: string): void {
        const inc = this.incoming.get(fileId)
        if (!inc) return
        this.incoming.delete(fileId)
        inc.onProgress?.({
            fileId,
            bytesTransferred: inc.bytesReceived,
            totalBytes: inc.offer.size,
            status: "error",
            error: reason,
        })
        inc.reject(new Error(reason))
    }

    // -----------------------------------------------------------------
    // PEER CONNECTION + SIGNALING PLUMBING

    private createPeerConnection(peerUid: string, fileId: string): RTCPeerConnection {
        const connectionKey = `${peerUid}_${fileId}`

        // Reuse if one already exists (e.g., receiver creates one for ICE buffering before SDP arrives)
        const existing = this.peerConnections.get(connectionKey)
        if (existing) return existing

        const pc = new RTCPeerConnection(WEBRTC_CONFIG)

        pc.onicecandidate = ev => {
            if (ev.candidate) {
                this.sendSignal(peerUid, "candidate", ev.candidate.toJSON(), fileId).catch(() => {})
            }
        }
        pc.onconnectionstatechange = () => {
            if (pc.connectionState === "failed" || pc.connectionState === "closed") {
                this.cleanupConnection(connectionKey)
            }
        }

        this.peerConnections.set(connectionKey, pc)
        this.iceBuffers.set(connectionKey, [])

        // Per-file stall timeout
        setTimeout(() => {
            const cur = this.peerConnections.get(connectionKey)
            if (cur && cur.connectionState !== "connected" && cur.connectionState !== "closed") {
                console.warn(`[p2p] connection ${connectionKey} stalled, closing`)
                this.cleanupConnection(connectionKey)
            }
        }, STALL_TIMEOUT_MS)

        return pc
    }

    private cleanupConnection(connectionKey: string): void {
        const pc = this.peerConnections.get(connectionKey)
        if (pc) {
            try { pc.close() } catch { /* */ }
            this.peerConnections.delete(connectionKey)
        }
        this.iceBuffers.delete(connectionKey)
    }

    private async sendSignal(toUid: string, type: SignalingMessage["type"], payload: unknown, fileId: string): Promise<void> {
        const db = getFirebaseDatabase()
        if (!db || !this.roomId || !this.uid) return
        const inboxRef = ref(db, `rooms/${this.roomId}/p2pSignals/${toUid}`)
        const message: SignalingMessage = {
            fromUserId: this.uid,
            type,
            payload,
            fileId,
            timestamp: Date.now(),
        }
        await push(inboxRef, message)
    }
}

// ---------------------------------------------------------------------------
// Public singleton

export const p2pFileTransfer = P2PFileTransferManager.getInstance()
