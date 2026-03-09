/**
 * Burner Link Manager
 * 
 * Temporary self-destructing links for sharing files/messages
 */

import { getFirebaseDatabase } from "@/lib/firebase"
import { ref, set, get, update, onValue, remove } from "firebase/database"

// Safe database reference with null check
const getDbRef = (path: string) => {
    if (!getFirebaseDatabase()!) {
        console.error("Firebase database not initialized")
        return null
    }
    return ref(getFirebaseDatabase()!, path)
}

export interface BurnerLink {
    id: string
    code: string // Short 6-char code
    type: "text" | "file" | "link"
    content: string
    fileName?: string
    fileSize?: number
    fileType?: string
    createdBy: string
    createdAt: number
    expiresAt: number
    views: number
    maxViews: number
    isActive: boolean
    password?: string
}

export interface BurnerLinkState {
    isGenerating: boolean
    activeLinks: BurnerLink[]
    pendingLinks: BurnerLink[]
}

const LINK_EXPIRY_OPTIONS = [
    { label: "1 Hour", value: 60 * 60 * 1000 },
    { label: "24 Hours", value: 24 * 60 * 60 * 1000 },
    { label: "7 Days", value: 7 * 24 * 60 * 60 * 1000 },
    { label: "30 Days", value: 30 * 24 * 60 * 60 * 1000 },
]

const MAX_VIEW_OPTIONS = [
    { label: "1 View", value: 1 },
    { label: "10 Views", value: 10 },
    { label: "100 Views", value: 100 },
    { label: "Unlimited", value: Infinity },
]

class BurnerLinkManager {
    private static instance: BurnerLinkManager
    private state: BurnerLinkState = {
        isGenerating: false,
        activeLinks: [],
        pendingLinks: [],
    }
    private listeners: ((state: BurnerLinkState) => void)[] = []
    private unsubscribe: (() => void) | null = null
    private roomId: string = ""
    private userId: string = ""

    private constructor() { }

    static getInstance(): BurnerLinkManager {
        if (!BurnerLinkManager.instance) {
            BurnerLinkManager.instance = new BurnerLinkManager()
        }
        return BurnerLinkManager.instance
    }

    initialize(roomId: string, userId: string): void {
        this.roomId = roomId
        this.userId = userId
    }

    subscribe(listener: (state: BurnerLinkState) => void): () => void {
        this.listeners.push(listener)
        listener(this.state)

        return () => {
            this.listeners = this.listeners.filter(l => l !== listener)
        }
    }

    private notify(): void {
        this.listeners.forEach(listener => listener(this.state))
    }

    private generateCode(): string {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        let code = ""
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        return code
    }

    async generateLink(
        type: "text" | "file" | "link",
        content: string,
        fileName?: string,
        fileSize?: number,
        fileType?: string,
        expiryMs: number = 24 * 60 * 60 * 1000,
        maxViews: number = Infinity,
        password?: string
    ): Promise<BurnerLink> {
        this.state.isGenerating = true
        this.notify()

        const id = `burner_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const code = this.generateCode()

        const link: BurnerLink = {
            id,
            code,
            type,
            content,
            fileName,
            fileSize,
            fileType,
            createdBy: this.userId,
            createdAt: Date.now(),
            expiresAt: Date.now() + expiryMs,
            views: 0,
            maxViews,
            isActive: true,
            password,
        }

        // Save to Firebase
        const linkRef = getDbRef(`burnerLinks/${id}`)
        if (linkRef) {
            await set(linkRef, link)
        }

        // Add to local state
        this.state.activeLinks.push(link)
        this.state.isGenerating = false
        this.notify()

        return link
    }

    async getLink(code: string): Promise<BurnerLink | null> {
        // Search through active links for the code
        const link = this.state.activeLinks.find(l => l.code === code && l.isActive)

        if (link) {
            return link
        }

        if (!getFirebaseDatabase()!) return null
        const snapshot = await get(ref(getFirebaseDatabase()!, "burnerLinks"))
        if (snapshot.exists()) {
            const allLinks = snapshot.val() as Record<string, BurnerLink>
            for (const key in allLinks) {
                const l = allLinks[key]
                if (l.code === code && l.isActive) {
                    return l
                }
            }
        }

        return null
    }

    async viewLink(id: string): Promise<{ success: boolean; content: string; error?: string }> {
        const linkRef = getDbRef(`burnerLinks/${id}`)
        if (!linkRef) {
            return { success: false, content: "", error: "Database not initialized" }
        }

        const snapshot = await get(linkRef)
        if (!snapshot.exists()) {
            return { success: false, content: "", error: "Link not found" }
        }

        const link = snapshot.val() as BurnerLink

        // Check if link is active
        if (!link.isActive) {
            return { success: false, content: "", error: "This link has been deactivated" }
        }

        // Check if link has expired
        if (Date.now() > link.expiresAt) {
            await update(linkRef, { isActive: false })
            return { success: false, content: "", error: "This link has expired" }
        }

        // Check max views
        if (link.views >= link.maxViews) {
            await update(linkRef, { isActive: false })
            return { success: false, content: "", error: "Maximum views reached" }
        }

        // Increment views
        await update(linkRef, { views: link.views + 1 })

        // Update local state
        const localLink = this.state.activeLinks.find(l => l.id === id)
        if (localLink) {
            localLink.views++
        }

        this.notify()

        return { success: true, content: link.content }
    }

    async deactivateLink(id: string): Promise<void> {
        const linkRef = getDbRef(`burnerLinks/${id}`)
        if (linkRef) {
            await update(linkRef, { isActive: false })
        }

        const link = this.state.activeLinks.find(l => l.id === id)
        if (link) {
            link.isActive = false
        }

        this.notify()
    }

    async deleteLink(id: string): Promise<void> {
        const linkRef = getDbRef(`burnerLinks/${id}`)
        if (linkRef) {
            await remove(linkRef)
        }

        this.state.activeLinks = this.state.activeLinks.filter(l => l.id !== id)
        this.notify()
    }

    async refreshLinks(): Promise<void> {
        // Check for expired links and mark them inactive
        const now = Date.now()
        for (const link of this.state.activeLinks) {
            if (link.expiresAt < now && link.isActive) {
                link.isActive = false
                const linkRef = getDbRef(`burnerLinks/${link.id}`)
                if (linkRef) {
                    await update(linkRef, { isActive: false })
                }
            }
        }

        this.state.activeLinks = this.state.activeLinks.filter(l => l.isActive)
        this.notify()
    }

    getShareUrl(code: string): string {
        return `${window.location.origin}/burner/${code}`
    }

    copyToClipboard(text: string): Promise<void> {
        return navigator.clipboard.writeText(text)
    }

    getState(): BurnerLinkState {
        return this.state
    }

    getMyLinks(): BurnerLink[] {
        return this.state.activeLinks.filter(l => l.createdBy === this.userId)
    }

    destroy(): void {
        if (this.unsubscribe) {
            this.unsubscribe()
        }
        this.listeners = []
        this.state = {
            isGenerating: false,
            activeLinks: [],
            pendingLinks: [],
        }
    }
}

export const burnerLinkManager = BurnerLinkManager.getInstance()
export { LINK_EXPIRY_OPTIONS, MAX_VIEW_OPTIONS }
