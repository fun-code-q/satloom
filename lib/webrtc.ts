/**
 * WebRTC utilities and peer connection management
 */

export type ConnectionState = RTCPeerConnectionState | "unknown"
export type IceConnectionState = RTCIceConnectionState | "unknown"

/**
 * Build the iceServers list from environment variables.
 *
 * env files (.env.local / .env.example) define STUN + TURN servers with
 * suffixed names: NEXT_PUBLIC_STUN_SERVER_1..N, NEXT_PUBLIC_TURN_SERVER_1..N
 * plus NEXT_PUBLIC_TURN_USERNAME_N / NEXT_PUBLIC_TURN_CREDENTIAL_N.
 *
 * IMPORTANT: a TURN entry is only added when its server URL, username, AND
 * credential are all present. There is intentionally NO hardcoded fallback —
 * the previous code fell back to the publicly-leaked `openrelayproject`
 * credentials (which this file's own history warns against) when the env vars
 * were absent, AND it read the wrong (unsuffixed) var names, so TURN silently
 * never loaded and ~15-20% of users behind symmetric NAT couldn't connect.
 *
 * If no TURN creds are configured, the app falls back to STUN-only (works on
 * most networks but not symmetric NAT). Operators must supply their own TURN
 * (Cloudflare Calls / Twilio / self-hosted coturn) for full connectivity.
 */
function buildIceServers(): RTCIceServer[] {
  const iceServers: RTCIceServer[] = []

  // STUN servers — collected from NEXT_PUBLIC_STUN_SERVER_1..N. If none are
  // set, fall back to Google's public STUN so discovery still works.
  let stunCount = 0
  for (let i = 1; i <= 12; i++) {
    const url = process.env[`NEXT_PUBLIC_STUN_SERVER_${i}`]
    if (url) {
      iceServers.push({ urls: url })
      stunCount++
    }
  }
  if (stunCount === 0) {
    iceServers.push(
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    )
  }

  // TURN servers — collected from NEXT_PUBLIC_TURN_SERVER_1..N with matching
  // _USERNAME_N / _CREDENTIAL_N. All three must be present to be included;
  // no silent fallback to leaked creds.
  for (let i = 1; i <= 6; i++) {
    const url = process.env[`NEXT_PUBLIC_TURN_SERVER_${i}`]
    const username = process.env[`NEXT_PUBLIC_TURN_USERNAME_${i}`]
    const credential = process.env[`NEXT_PUBLIC_TURN_CREDENTIAL_${i}`]
    if (url && username && credential) {
      iceServers.push({ urls: url, username, credential })
    }
  }

  if (!iceServers.some((s) => s.urls.toString().startsWith("turn:"))) {
    // Surface the config gap so operators know connectivity will be limited.
    // One warn per module load, not per call.
    console.warn(
      "[webrtc] No TURN servers configured (NEXT_PUBLIC_TURN_SERVER_*/USERNAME_*/CREDENTIAL_*). " +
        "Falling back to STUN-only — users behind symmetric NAT (~15-20%) will be unable to connect.",
    )
  }

  return iceServers
}

/**
 * WebRTC configuration
 */
export const WEBRTC_CONFIG: RTCConfiguration = {
  iceServers: buildIceServers(),
  iceCandidatePoolSize: 10,
}

/**
 * Create a new peer connection with event handlers
 */
export function createPeerConnection(
  onConnectionStateChange?: (state: ConnectionState) => void,
  onIceConnectionStateChange?: (state: IceConnectionState) => void,
  onIceCandidate?: (candidate: RTCIceCandidate | null) => void,
  onTrack?: (stream: MediaStream) => void,
  onDataChannel?: (channel: RTCDataChannel) => void
): RTCPeerConnection {
  const peerConnection = new RTCPeerConnection(WEBRTC_CONFIG)

  // Connection state handlers
  peerConnection.onconnectionstatechange = () => {
    const state = peerConnection.connectionState
    console.log("WebRTC Connection state:", state)
    onConnectionStateChange?.(state)
  }

  peerConnection.oniceconnectionstatechange = () => {
    const state = peerConnection.iceConnectionState
    console.log("WebRTC ICE connection state:", state)
    onIceConnectionStateChange?.(state)
  }

  // ICE candidate handler
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      onIceCandidate?.(event.candidate)
    } else {
      onIceCandidate?.(null) // ICE gathering complete
    }
  }

  // Track handler
  peerConnection.ontrack = (event) => {
    const stream = event.streams[0]
    console.log("WebRTC Track received:", stream?.id)
    onTrack?.(stream!)
  }

  // Data channel handler
  peerConnection.ondatachannel = (event) => {
    console.log("WebRTC Data channel received:", event.channel.label)
    setupDataChannel(event.channel)
    onDataChannel?.(event.channel)
  }

  return peerConnection
}

/**
 * Setup data channel event handlers
 */
function setupDataChannel(channel: RTCDataChannel): void {
  channel.onopen = () => {
    console.log("Data channel opened:", channel.label)
  }

  channel.onclose = () => {
    console.log("Data channel closed:", channel.label)
  }

  channel.onmessage = (event) => {
    console.log("Data channel message received:", event.data)
  }

  channel.onerror = (error) => {
    console.error("Data channel error:", error)
  }
}

/**
 * Create a data channel for peer-to-peer messaging
 */
export function createDataChannel(
  peerConnection: RTCPeerConnection,
  label: string,
  ordered = true
): RTCDataChannel {
  const channel = peerConnection.createDataChannel(label, {
    ordered,
  })

  setupDataChannel(channel)
  return channel
}

/**
 * Create an offer for initiating a call
 */
export async function createOffer(
  peerConnection: RTCPeerConnection
): Promise<RTCSessionDescriptionInit> {
  try {
    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    })
    await peerConnection.setLocalDescription(offer)
    return offer
  } catch (error) {
    console.error("Error creating offer:", error)
    throw error
  }
}

/**
 * Create an answer for responding to a call
 */
export async function createAnswer(
  peerConnection: RTCPeerConnection
): Promise<RTCSessionDescriptionInit> {
  try {
    const answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer)
    return answer
  } catch (error) {
    console.error("Error creating answer:", error)
    throw error
  }
}

/**
 * Set remote description from offer/answer
 */
export async function setRemoteDescription(
  peerConnection: RTCPeerConnection,
  description: RTCSessionDescriptionInit
): Promise<void> {
  try {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(description))
  } catch (error) {
    console.error("Error setting remote description:", error)
    throw error
  }
}

/**
 * Add ICE candidate to peer connection
 */
export async function addIceCandidate(
  peerConnection: RTCPeerConnection,
  candidate: RTCIceCandidateInit
): Promise<void> {
  try {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
  } catch (error) {
    console.error("Error adding ICE candidate:", error)
    throw error
  }
}

/**
 * Add a media track to the connection
 */
export function addTrack(
  peerConnection: RTCPeerConnection,
  track: MediaStreamTrack,
  stream: MediaStream
): RTCRtpSender | undefined {
  try {
    return peerConnection.addTrack(track, stream)
  } catch (error) {
    console.error("Error adding track:", error)
    return undefined
  }
}

/**
 * Remove a media track from the connection
 */
export function removeTrack(
  peerConnection: RTCPeerConnection,
  sender: RTCRtpSender
): void {
  try {
    peerConnection.removeTrack(sender)
  } catch (error) {
    console.error("Error removing track:", error)
  }
}

/**
 * Get user media with constraints
 */
export async function getUserMedia(
  constraints: MediaStreamConstraints = { video: true, audio: true }
): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia(constraints)
  } catch (error) {
    console.error("Error getting user media:", error)
    throw error
  }
}

/**
 * Get display media (screen sharing)
 */
export async function getDisplayMedia(
  constraints: DisplayMediaStreamOptions = { video: true }
): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getDisplayMedia(constraints)
  } catch (error) {
    console.error("Error getting display media:", error)
    throw error
  }
}

/**
 * Stop a media stream and all its tracks
 */
export function stopMediaStream(stream: MediaStream | null): void {
  if (stream) {
    stream.getTracks().forEach((track) => {
      track.stop()
    })
  }
}

/**
 * Close a peer connection and cleanup
 */
export function closePeerConnection(peerConnection: RTCPeerConnection): void {
  // Close all data channels
  // Note: RTCPeerConnection doesn't have getDataChannels method in all browsers
  // We'll rely on the data channels being tracked externally if needed

  // Close the connection
  peerConnection.close()
}

/**
 * Get connection quality metrics
 */
export async function getConnectionStats(
  peerConnection: RTCPeerConnection
): Promise<RTCStatsReport | null> {
  try {
    return await peerConnection.getStats()
  } catch (error) {
    console.error("Error getting connection stats:", error)
    return null
  }
}

/**
 * Check if WebRTC is supported
 */
export function isWebRTCSupported(): boolean {
  return !!(
    typeof window !== "undefined" &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function" &&
    typeof RTCPeerConnection === "function"
  )
}

/**
 * Check if getDisplayMedia is supported (screen sharing)
 */
export function isScreenShareSupported(): boolean {
  return !!(
    typeof window !== "undefined" &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getDisplayMedia === "function"
  )
}

/**
 * Get available media devices
 */
export async function getMediaDevices(): Promise<{
  audioInputs: MediaDeviceInfo[]
  audioOutputs: MediaDeviceInfo[]
  videoInputs: MediaDeviceInfo[]
}> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()

    return {
      audioInputs: devices.filter((d) => d.kind === "audioinput"),
      audioOutputs: devices.filter((d) => d.kind === "audiooutput"),
      videoInputs: devices.filter((d) => d.kind === "videoinput"),
    }
  } catch (error) {
    console.error("Error enumerating devices:", error)
    return {
      audioInputs: [],
      audioOutputs: [],
      videoInputs: [],
    }
  }
}

/**
 * Audio/video constraints presets
 */
export const MEDIA_CONSTRAINTS = {
  HIGH_QUALITY_VIDEO: {
    video: {
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 30 },
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  },

  STANDARD_VIDEO: {
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 24 },
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  },

  LOW_QUALITY_VIDEO: {
    video: {
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 15 },
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  },

  AUDIO_ONLY: {
    video: false,
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  },
} as const
