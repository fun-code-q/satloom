import type React from "react"

export interface MessageFormat {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  doubleSize?: boolean
  color?: string
}

export function parseMessageFormatting(text: string): React.ReactNode[] {
  if (!text) return []

  const parts: React.ReactNode[] = []
  let currentIndex = 0
  let partIndex = 0

  while (currentIndex < text.length) {
    let nextSpecialIndex = text.length
    let specialChar = ""
    let endChar = ""
    let formatType = ""

    // Find the next special character - Updated formatting rules
    const specialChars = [
      { start: "*", end: "*", type: "bold" }, // Bold with *
      { start: "$", end: "$", type: "italic" }, // Italic with $
      { start: "=", end: "=", type: "underline" }, // Underline with =
      { start: "{", end: "}", type: "doubleSize" }, // Double size with {}
      { start: "^r", end: "^r", type: "red" }, // Red color
      { start: "^g", end: "^g", type: "green" }, // Green color
      { start: "^b", end: "^b", type: "blue" }, // Blue color
      { start: "^y", end: "^y", type: "yellow" }, // Yellow color
      { start: "`", end: "`", type: "code" }, // Code formatting
      { start: "~", end: "~", type: "strikethrough" }, // Strikethrough
    ]

    for (const special of specialChars) {
      const index = text.indexOf(special.start, currentIndex)
      if (index !== -1 && index < nextSpecialIndex) {
        nextSpecialIndex = index
        specialChar = special.start
        endChar = special.end
        formatType = special.type
      }
    }

    // Add regular text before special formatting
    if (nextSpecialIndex > currentIndex) {
      const regularText = text.substring(currentIndex, nextSpecialIndex)
      if (regularText) {
        parts.push(<span key={partIndex++}>{regularText}</span>)
      }
    }

    if (nextSpecialIndex < text.length) {
      // Find the end of the special formatting
      const startIndex = nextSpecialIndex + specialChar.length
      const endIndex = text.indexOf(endChar, startIndex)

      if (endIndex !== -1 && endIndex > startIndex) {
        const formattedText = text.substring(startIndex, endIndex)
        const formattedElement = formatText(formattedText, formatType, partIndex++)
        parts.push(formattedElement)
        currentIndex = endIndex + endChar.length
      } else {
        // No closing tag found, treat as regular text
        parts.push(<span key={partIndex++}>{specialChar}</span>)
        currentIndex = nextSpecialIndex + specialChar.length
      }
    } else {
      break
    }
  }

  return parts.length > 0 ? parts : [<span key={0}>{text}</span>]
}

function formatText(text: string, formatType: string, key: number): React.ReactNode {
  let className = ""
  const style: React.CSSProperties = {}

  switch (formatType) {
    case "bold":
      className = "font-bold"
      break
    case "italic":
      className = "italic"
      break
    case "underline":
      className = "underline"
      break
    case "doubleSize":
      className = "text-2xl"
      break
    case "strikethrough":
      className = "line-through"
      break
    case "code":
      className = "bg-slate-700 px-1 py-0.5 rounded text-sm font-mono"
      break
    case "red":
      style.color = "#ef4444"
      break
    case "green":
      style.color = "#22c55e"
      break
    case "blue":
      style.color = "#3b82f6"
      break
    case "yellow":
      style.color = "#eab308"
      break
  }

  // Recursively parse for nested formatting to support combinations
  const nestedParts = parseMessageFormatting(text)
  return (
    <span key={key} className={className} style={style}>
      {nestedParts}
    </span>
  )
}

// Mention detection
export function parseMentions(text: string): React.ReactNode[] {
  const mentionSplitRegex = /(@[A-Za-z0-9_]+)/g
  const mentionTokenRegex = /^@[A-Za-z0-9_]+$/
  const parts = text.split(mentionSplitRegex)

  return parts.map((part, index) => {
    if (mentionTokenRegex.test(part)) {
      const readableMention = part.replace(/_/g, " ")
      return (
        <span
          key={index}
          className="text-cyan-400 font-medium bg-cyan-900/30 px-1 rounded"
        >
          {readableMention}
        </span>
      )
    }
    return parseMessageFormatting(part)
  })
}

// URL detection and linking with safety warnings
export function parseUrls(text: string): React.ReactNode[] {
  const urlSplitRegex = /(https?:\/\/[^\s]+)/g
  const urlTokenRegex = /^https?:\/\/[^\s]+$/
  const parts = text.split(urlSplitRegex)

  return parts.map((part, index) => {
    if (urlTokenRegex.test(part)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-400 hover:text-cyan-300 underline inline-flex items-center gap-1 group"
          title="Safe external link"
        >
          {part}
          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] bg-slate-800 px-1 rounded text-cyan-300 border border-cyan-500/30">
            External Safe Link
          </span>
        </a>
      )
    }
    return parseMentions(part)
  })
}

// Emoji support
export function parseEmojis(text: string): string {
  const emojiMap: { [key: string]: string } = {
    ":)": "😊",
    ":(": "😢",
    ":D": "😃",
    ":P": "😛",
    ";)": "😉",
    ":o": "😮",
    ":heart:": "❤️",
    ":thumbsup:": "👍",
    ":thumbsdown:": "👎",
    ":fire:": "🔥",
    ":star:": "⭐",
    ":rocket:": "🚀",
    ":party:": "🎉",
    ":coffee:": "☕",
    ":pizza:": "🍕",
  }

  let result = text
  Object.entries(emojiMap).forEach(([key, emoji]) => {
    result = result.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), emoji)
  })

  return result
}
