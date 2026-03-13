"use client"

import { useState, useMemo, useEffect } from "react"
import { createPortal } from "react-dom"
import { Search, History, Smile, Hand, Heart, Box } from "lucide-react"

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void
  isOpen: boolean
  onClose: () => void
}

const emojiCategories = {
  Smileys: {
    icon: <Smile className="w-4 h-4" />,
    emojis: ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳", "🤠", "🤡", "🤢", "🤮", "🥵", "🥶", "🥺", "🤯", "🥱", "🤐", "😵", "😴"]
  },
  Gestures: {
    icon: <Hand className="w-4 h-4" />,
    emojis: ["👍", "👎", "👌", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👋", "🤚", "🖐️", "✋", "🖖", "👏", "🙌", "🤲", "🤝", "🙏"]
  },
  Hearts: {
    icon: <Heart className="w-4 h-4" />,
    emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟"]
  },
  Objects: {
    icon: <Box className="w-4 h-4" />,
    emojis: ["🎉", "🎊", "🎈", "🎁", "🏆", "🥇", "🥈", "🥉", "⭐", "🌟", "💫", "✨", "🔥", "💯", "⚡", "💥", "💢", "💨", "💦", "💤"]
  },
}

export function EmojiPicker({ onEmojiSelect, isOpen, onClose }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState<keyof typeof emojiCategories>("Smileys")
  const [searchQuery, setSearchQuery] = useState("")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const filteredEmojis = useMemo(() => {
    if (!searchQuery) return emojiCategories[activeCategory].emojis
    const allEmojis = Object.values(emojiCategories).flatMap(c => c.emojis)
    return allEmojis.filter((e) => e.includes(searchQuery) || searchQuery === "")
  }, [activeCategory, searchQuery])

  if (!isOpen || !mounted) return null

  return createPortal(
    <>
      <div className="fixed inset-0 z-[600] bg-black/20" onClick={onClose} />
      <div className="fixed bottom-24 right-4 md:absolute md:bottom-16 md:right-0 z-[601] bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-[32px] p-5 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)] w-[calc(100vw-32px)] max-w-[360px] animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300 ease-out flex flex-col gap-4">
        <div className="relative group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-cyan-400 transition-colors" />
          <input
            id="emoji-search-input"
            name="emoji-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search emoji..."
            className="w-full bg-slate-800/50 border border-white/5 rounded-2xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all"
          />
        </div>

        <div className="flex justify-between gap-1 p-1 bg-slate-800/30 rounded-2xl border border-white/5">
          {(Object.keys(emojiCategories) as Array<keyof typeof emojiCategories>).map((category) => (
            <button
              key={category}
              onClick={() => {
                setActiveCategory(category)
                setSearchQuery("")
              }}
              className={`flex items-center justify-center flex-1 py-2 rounded-xl transition-all duration-200 ${activeCategory === category && !searchQuery
                ? "bg-cyan-500/20 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.15)] border border-cyan-500/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"
                }`}
              title={category}
            >
              {emojiCategories[category].icon}
            </button>
          ))}
        </div>

        <div className="relative h-[240px]">
          <div className="grid grid-cols-7 gap-2 h-full overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent text-center">
            {filteredEmojis.map((emoji, index) => (
              <button
                key={`${activeCategory}-${index}`}
                onClick={() => {
                  onEmojiSelect(emoji)
                  onClose()
                }}
                className="w-10 h-10 flex items-center justify-center text-2xl hover:bg-white/10 rounded-xl transition-all hover:scale-125 active:scale-90 mx-auto"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {!searchQuery && (
          <div className="pt-2 border-t border-white/5">
            <div className="flex items-center gap-2 mb-2 px-1">
              <History className="w-3 h-3 text-slate-500" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Recent</span>
            </div>
            <div className="flex justify-between gap-1">
              {["😀", "👍", "❤️", "🎉", "🔥", "🚀"].map((emoji, index) => (
                <button
                  key={`recent-${index}`}
                  onClick={() => {
                    onEmojiSelect(emoji)
                    onClose()
                  }}
                  className="w-10 h-10 flex items-center justify-center text-xl hover:bg-white/5 rounded-xl transition-all hover:scale-110 active:scale-95 border border-transparent hover:border-white/5"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="absolute bottom-[-10px] right-6 w-5 h-5 bg-slate-900 shadow-[10px_10px_30px_rgba(0,0,0,0.5)] rotate-45 border-r border-b border-white/10 hidden md:block" />
      </div>
    </>,
    document.body
  )
}
