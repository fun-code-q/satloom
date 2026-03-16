export interface VimeoVideoRef {
  videoId: string
  hash?: string
}

const NUMERIC_ID_REGEX = /^\d+$/

function parseUrlSafely(input: string): URL | null {
  try {
    return new URL(input)
  } catch {
    try {
      return new URL(`https://${input}`)
    } catch {
      return null
    }
  }
}

function normalizeHashCandidate(value: string | undefined): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return trimmed
}

export function extractVimeoVideoRef(rawUrl: string): VimeoVideoRef | null {
  const input = (rawUrl || "").trim()
  if (!input) return null

  if (NUMERIC_ID_REGEX.test(input)) {
    return { videoId: input }
  }

  const parsed = parseUrlSafely(input)
  if (!parsed) return null

  const host = parsed.hostname.replace(/^www\./i, "").toLowerCase()
  const pathParts = parsed.pathname.split("/").filter(Boolean)
  const queryHash = normalizeHashCandidate(parsed.searchParams.get("h") || undefined)

  let videoId: string | undefined
  let hash: string | undefined = queryHash

  if (host.includes("player.vimeo.com")) {
    const videoIndex = pathParts.indexOf("video")
    const idCandidate = videoIndex >= 0 ? pathParts[videoIndex + 1] : pathParts[0]
    if (idCandidate && NUMERIC_ID_REGEX.test(idCandidate)) {
      videoId = idCandidate
    }
  } else if (host.endsWith("vimeo.com")) {
    const idIndex = pathParts.findIndex((segment) => NUMERIC_ID_REGEX.test(segment))
    if (idIndex >= 0) {
      videoId = pathParts[idIndex]
      const nextSegment = pathParts[idIndex + 1]
      if (!hash && nextSegment && !NUMERIC_ID_REGEX.test(nextSegment)) {
        hash = normalizeHashCandidate(nextSegment)
      }
    }
  }

  if (!videoId) {
    const regexFallback = input.match(/(?:player\.)?vimeo\.com\/(?:.*?\/)?(\d+)/i)
    if (regexFallback?.[1]) {
      videoId = regexFallback[1]
    }
  }

  if (!videoId) return null
  return hash ? { videoId, hash } : { videoId }
}

export function buildVimeoEmbedUrl(
  rawUrl: string,
  options?: { autoplay?: boolean; playerId?: string }
): string | null {
  const info = extractVimeoVideoRef(rawUrl)
  if (!info) return null

  const params = new URLSearchParams()
  params.set("api", "1")
  params.set("autoplay", options?.autoplay ? "1" : "0")
  if (options?.playerId) params.set("player_id", options.playerId)
  if (info.hash) params.set("h", info.hash)

  return `https://player.vimeo.com/video/${info.videoId}?${params.toString()}`
}
