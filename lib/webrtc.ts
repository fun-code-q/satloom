/**
 * WebRTC utilities and peer connection management
 */

export type ConnectionState = RTCPeerConnectionState | "unknown"
export type IceConnectionState = RTCIceConnectionState | "unknown"

/**
 * WebRTC configuration
 */
export const WEBRTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    {
      urls: process.env.NEXT_PUBLIC_TURN_SERVER_URL || "turn:openrelay.metered.ca:80",
      username: process.env.NEXT_PUBLIC_TURN_SERVER_USERNAME || "openrelayproject",
      credential: process.env.NEXT_PUBLIC_TURN_SERVER_CREDENTIAL || "openrelayproject",
    },
    {
      urls: process.env.NEXT_PUBLIC_TURN_SERVER_URL_SECURE || "turn:openrelay.metered.ca:443",
      username: process.env.NEXT_PUBLIC_TURN_SERVER_USERNAME || "openrelayproject",
      credential: process.env.NEXT_PUBLIC_TURN_SERVER_CREDENTIAL || "openrelayproject",
    },
    {
      urls: process.env.NEXT_PUBLIC_TURN_SERVER_URL_TCP || "turn:openrelay.metered.ca:443?transport=tcp",
      username: process.env.NEXT_PUBLIC_TURN_SERVER_USERNAME || "openrelayproject",
      credential: process.env.NEXT_PUBLIC_TURN_SERVER_CREDENTIAL || "openrelayproject",
    },
  ],
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
