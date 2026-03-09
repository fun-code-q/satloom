/**
 * Reaction Rain Manager
 * 
 * Handles visual reaction effects when multiple users react simultaneously.
 * If 5 people click "Heart" at once, rain hearts down the screen.
 */

export type ReactionEmoji = "❤️" | "😂" | "😮" | "😢" | "👏" | "🔥" | "🎉" | "💯"

interface ReactionDrop {
    id: string
    emoji: ReactionEmoji
    x: number
    y: number
    speed: number
    rotation: number
    scale: number
    opacity: number
}

interface ReactionEvent {
    emoji: ReactionEmoji
    userId: string
    timestamp: number
}

class ReactionRainManager {
    private static instance: ReactionRainManager
    private drops: Map<string, ReactionDrop[]> = new Map()
    private reactionQueue: Map<ReactionEmoji, ReactionEvent[]> = new Map()
    private listeners: ((emoji: ReactionEmoji, count: number) => void)[] = []
    private animationFrameId: number | null = null
    private container: HTMLElement | null = null
    private readonly TRIGGER_COUNT = 5
    private readonly WINDOW_MS = 3000 // 3 seconds window for "simultaneous" reactions

    private constructor() {
        // Initialize queue for each emoji
        ; (["❤️", "😂", "😮", "😢", "👏", "🔥", "🎉", "💯"] as ReactionEmoji[]).forEach((emoji) => {
            this.reactionQueue.set(emoji, [])
        })
    }

    static getInstance(): ReactionRainManager {
        if (!ReactionRainManager.instance) {
            ReactionRainManager.instance = new ReactionRainManager()
        }
        return ReactionRainManager.instance
    }

    /**
     * Set the container element for rain effects
     */
    setContainer(container: HTMLElement): void {
        this.container = container
    }

    /**
     * Add a reaction and potentially trigger rain
     */
    addReaction(emoji: ReactionEmoji, userId: string): void {
        const now = Date.now()
        const queue = this.reactionQueue.get(emoji) || []

        // Add new reaction
        queue.push({ emoji, userId, timestamp: now })

        // Remove old reactions outside the window
        const windowStart = now - this.WINDOW_MS
        const recentReactions = queue.filter((r) => r.timestamp > windowStart)

        // Update queue
        this.reactionQueue.set(emoji, recentReactions)

        // Check if we should trigger rain
        const uniqueUsers = new Set(recentReactions.map((r) => r.userId)).size
        if (uniqueUsers >= this.TRIGGER_COUNT) {
            this.triggerRain(emoji, uniqueUsers)
            // Clear queue after triggering
            this.reactionQueue.set(emoji, [])
        }

        // Notify listeners
        this.notifyListeners(emoji, uniqueUsers)
    }

    /**
     * Trigger the rain effect for an emoji
     */
    private triggerRain(emoji: ReactionEmoji, count: number): void {
        if (!this.container) return

        const drops: ReactionDrop[] = []
        const dropCount = Math.min(count * 3, 30) // Max 30 drops at once

        for (let i = 0; i < dropCount; i++) {
            drops.push({
                id: `drop-${Date.now()}-${i}`,
                emoji,
                x: Math.random() * 100, // Percentage across screen
                y: -10 - Math.random() * 20, // Start above screen
                speed: 0.5 + Math.random() * 1.5, // Random fall speed
                rotation: Math.random() * 360,
                scale: 0.5 + Math.random() * 1,
                opacity: 1,
            })
        }

        const existingDrops = this.drops.get(emoji) || []
        this.drops.set(emoji, [...existingDrops, ...drops])

        // Start animation if not running
        if (!this.animationFrameId) {
            this.animate()
        }
    }

    /**
     * Animation loop for falling reactions
     */
    private animate(): void {
        if (!this.container) return

        const containerRect = this.container.getBoundingClientRect()
        const height = containerRect.height

        this.drops.forEach((drops, emojiKey) => {
            const emoji = emojiKey as ReactionEmoji
            const updatedDrops = drops
                .map((drop) => {
                    // Update position
                    drop.y += drop.speed
                    drop.rotation += 2

                    // Fade out as they fall
                    if (drop.y > 80) {
                        drop.opacity = Math.max(0, 1 - (drop.y - 80) / 20)
                    }

                    return drop
                })
                .filter((drop) => drop.y < 120 && drop.opacity > 0) // Remove when off screen

            // Update DOM
            this.renderDrops(emoji, updatedDrops)

            // Update state
            if (updatedDrops.length > 0) {
                this.drops.set(emoji, updatedDrops)
            } else {
                this.drops.delete(emoji)
            }
        })

        // Continue animation if there are drops
        const totalDrops = Array.from(this.drops.values()).reduce((sum, arr) => sum + arr.length, 0)
        if (totalDrops > 0) {
            this.animationFrameId = requestAnimationFrame(() => this.animate())
        } else {
            this.animationFrameId = null
        }
    }

    /**
     * Render drops for an emoji
     */
    private renderDrops(emoji: ReactionEmoji, drops: ReactionDrop[]): void {
        if (!this.container) return

        // Find or create container for this emoji
        let emojiContainer = this.container.querySelector(`[data-emoji="${emoji}"]`) as HTMLElement
        if (!emojiContainer) {
            emojiContainer = document.createElement("div")
            emojiContainer.setAttribute("data-emoji", emoji)
            emojiContainer.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        overflow: hidden;
        z-index: 9999;
      `
            this.container.appendChild(emojiContainer)
        }

        // Update drops
        emojiContainer.innerHTML = drops
            .map(
                (drop) => `
      <div
        style="
          position: absolute;
          left: ${drop.x}%;
          top: ${drop.y}%;
          font-size: ${drop.scale * 2}rem;
          transform: translate(-50%, -50%) rotate(${drop.rotation}deg);
          opacity: ${drop.opacity};
          transition: opacity 0.1s ease-out;
        "
      >
        ${emoji}
      </div>
    `
            )
            .join("")
    }

    /**
     * Subscribe to reaction count changes
     */
    subscribe(listener: (emoji: ReactionEmoji, count: number) => void): () => void {
        this.listeners.push(listener)
        return () => {
            this.listeners = this.listeners.filter((l) => l !== listener)
        }
    }

    /**
     * Notify all listeners
     */
    private notifyListeners(emoji: ReactionEmoji, count: number): void {
        this.listeners.forEach((listener) => listener(emoji, count))
    }

    /**
     * Clear all drops
     */
    clear(): void {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId)
            this.animationFrameId = null
        }

        this.drops.clear()
        this.reactionQueue.forEach((queue) => queue.splice(0))

        if (this.container) {
            const emojiContainers = this.container.querySelectorAll("[data-emoji]")
            emojiContainers.forEach((el) => el.remove())
        }
    }

    /**
     * Clean up
     */
    destroy(): void {
        this.clear()
        this.container = null
        this.listeners = []
    }
}

export const reactionRain = ReactionRainManager.getInstance()
export type { ReactionDrop, ReactionEvent }
