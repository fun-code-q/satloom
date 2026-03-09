/**
 * Presentation Mode Manager
 * 
 * Real-time slide sharing and presentation control for collaborative viewing.
 */

import { getFirebaseDatabase } from "@/lib/firebase"
import { ref, set, update, onValue, remove, serverTimestamp } from "firebase/database"

// Safe database reference with null check
const getDbRef = (path: string) => {
    if (!getFirebaseDatabase()!) {
        console.error("Firebase database not initialized")
        return null
    }
    return ref(getFirebaseDatabase()!, path)
}

export interface Slide {
    id: string
    type: "title" | "content" | "image" | "code" | "video" | "poll" | "quiz" | "screen"
    title?: string
    content?: string
    imageUrl?: string
    code?: string
    language?: string
    videoUrl?: string
    options?: string[]
    correctAnswer?: number
    duration?: number
}

export interface Presentation {
    id: string
    roomId: string
    hostId: string
    title: string
    slides: Record<string, Slide>
    currentSlideIndex: number
    isPlaying: boolean
    startTime: number
    duration: number
    viewers: Record<string, { name: string; joinedAt: number }>
}

export interface PresentationState {
    isPresenting: boolean
    presentation: Presentation | null
    currentSlide: Slide | null
    canControl: boolean
    viewerCount: number
}

class PresentationModeManager {
    private static instance: PresentationModeManager
    private state: PresentationState = {
        isPresenting: false,
        presentation: null,
        currentSlide: null,
        canControl: false,
        viewerCount: 0,
    }
    private listeners: ((state: PresentationState) => void)[] = []
    private unsubscribe: (() => void) | null = null
    private roomId: string = ""
    private userId: string = ""
    private userName: string = ""

    private constructor() { }

    static getInstance(): PresentationModeManager {
        if (!PresentationModeManager.instance) {
            PresentationModeManager.instance = new PresentationModeManager()
        }
        return PresentationModeManager.instance
    }

    initialize(roomId: string, userId: string, userName: string): void {
        this.roomId = roomId
        this.userId = userId
        this.userName = userName
    }

    subscribe(listener: (state: PresentationState) => void): () => void {
        this.listeners.push(listener)
        listener(this.state)

        return () => {
            this.listeners = this.listeners.filter(l => l !== listener)
        }
    }

    private notify(): void {
        this.listeners.forEach(listener => listener(this.state))
    }

    async createPresentation(title: string): Promise<string> {
        const presentationId = `pres_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        const slide1: Slide = {
            id: "slide_1",
            type: "title",
            title: title,
            content: "Welcome to this presentation!",
        }

        const presentation: Presentation = {
            id: presentationId,
            roomId: this.roomId,
            hostId: this.userId,
            title,
            slides: { slide_1: slide1 },
            currentSlideIndex: 0,
            isPlaying: false,
            startTime: Date.now(),
            duration: 0,
            viewers: {},
        }

        const dbRef = getDbRef(`presentations/${presentationId}`)
        if (dbRef) {
            await set(dbRef, presentation)
        }

        // Broadcast to room
        const roomPresRef = getDbRef(`rooms/${this.roomId}/activePresentation`)
        if (roomPresRef) {
            await set(roomPresRef, {
                id: presentationId,
                title: title,
                hostName: this.userName,
                startTime: Date.now()
            })
        }

        return presentationId
    }

    private cleanObject(obj: any): any {
        const cleaned: any = {}
        Object.keys(obj).forEach(key => {
            if (obj[key] !== undefined) {
                cleaned[key] = obj[key]
            }
        })
        return cleaned
    }

    async addSlide(presentationId: string, slide: Omit<Slide, "id">): Promise<string> {
        const slideId = `slide_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        const newSlide: Slide = this.cleanObject({
            ...slide,
            id: slideId,
        })

        const slideRef = getDbRef(`presentations/${presentationId}/slides/${slideId}`)
        if (slideRef) {
            await set(slideRef, newSlide)
        }

        return slideId
    }

    async startPresentation(presentationId: string): Promise<void> {
        const presRef = getDbRef(`presentations/${presentationId}`)
        if (presRef) {
            await update(presRef, {
                isPlaying: true,
                startTime: Date.now(),
            })
        }

        this.state.isPresenting = true
        this.state.canControl = true
        this.notify()
    }

    async goToSlide(presentationId: string, slideIndex: number): Promise<void> {
        const presRef = getDbRef(`presentations/${presentationId}`)
        if (presRef) {
            await update(presRef, {
                currentSlideIndex: slideIndex,
            })
        }
    }

    async nextSlide(presentationId: string): Promise<void> {
        if (!this.state.presentation) return

        const nextIndex = this.state.presentation.currentSlideIndex + 1
        if (nextIndex < Object.keys(this.state.presentation.slides).length) {
            await this.goToSlide(presentationId, nextIndex)
        }
    }

    async previousSlide(presentationId: string): Promise<void> {
        if (!this.state.presentation) return

        const prevIndex = Math.max(0, this.state.presentation.currentSlideIndex - 1)
        await this.goToSlide(presentationId, prevIndex)
    }

    async pausePresentation(presentationId: string): Promise<void> {
        const presRef = getDbRef(`presentations/${presentationId}`)
        if (presRef) {
            await update(presRef, {
                isPlaying: false,
            })
        }
    }

    async resumePresentation(presentationId: string): Promise<void> {
        const presRef = getDbRef(`presentations/${presentationId}`)
        if (presRef) {
            await update(presRef, {
                isPlaying: true,
            })
        }
    }

    async endPresentation(presentationId: string): Promise<void> {
        const presRef = getDbRef(`presentations/${presentationId}`)
        if (presRef) {
            await update(presRef, {
                isPlaying: false,
                duration: Date.now() - (this.state.presentation?.startTime || Date.now()),
            })
        }

        // Clear from room
        const roomPresRef = getDbRef(`rooms/${this.roomId}/activePresentation`)
        if (roomPresRef) {
            await remove(roomPresRef)
        }

        this.state.isPresenting = false
        this.state.presentation = null
        this.state.currentSlide = null
        this.state.canControl = false
        this.notify()
    }

    async joinPresentation(presentationId: string): Promise<void> {
        const viewerRef = getDbRef(`presentations/${presentationId}/viewers/${this.userId}`)
        if (viewerRef) {
            await set(viewerRef, {
                name: this.userName,
                joinedAt: Date.now(),
            })
        }

        this.state.isPresenting = true
        this.state.canControl = false
        this.notify()
    }

    async leavePresentation(presentationId: string): Promise<void> {
        const viewerRef = getDbRef(`presentations/${presentationId}/viewers/${this.userId}`)
        if (viewerRef) {
            await remove(viewerRef)
        }

        this.state.isPresenting = false
        this.state.presentation = null
        this.state.currentSlide = null
        this.state.canControl = false
        this.notify()
    }

    async updateSlideContent(presentationId: string, slideId: string, updates: Partial<Slide>): Promise<void> {
        const slideRef = getDbRef(`presentations/${presentationId}/slides/${slideId}`)
        if (slideRef) {
            await update(slideRef, this.cleanObject(updates))
        }
    }

    async deleteSlide(presentationId: string, slideId: string): Promise<void> {
        const slideRef = getDbRef(`presentations/${presentationId}/slides/${slideId}`)
        if (slideRef) {
            await remove(slideRef)
        }
    }

    // WebRTC Signaling for Screen Sharing
    async sendSignal(
        presentationId: string,
        type: "offer" | "answer" | "ice-candidate",
        payload: any,
        fromUserId: string,
        toUserId: string
    ) {
        const signalId = `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const signalRef = getDbRef(`presentations/${presentationId}/signals/${toUserId}/${signalId}`)
        if (signalRef) {
            await set(signalRef, {
                type,
                payload,
                fromUserId,
                timestamp: Date.now()
            })
        }

        // Auto-remove signal after 10 seconds
        setTimeout(async () => {
            try {
                if (signalRef) await remove(signalRef)
            } catch (e) { }
        }, 10000)
    }

    listenForSignals(
        presentationId: string,
        userId: string,
        onSignal: (type: string, payload: any, fromUserId: string) => void
    ) {
        const signalsRef = getDbRef(`presentations/${presentationId}/signals/${userId}`)
        if (!signalsRef) return () => { }

        const unsubscribe = onValue(signalsRef, (snapshot) => {
            const signals = snapshot.val()
            if (signals) {
                Object.values(signals).forEach((sig: any) => {
                    onSignal(sig.type, sig.payload, sig.fromUserId)
                })
            }
        })
        return unsubscribe
    }

    listenForPresentation(presentationId: string): void {
        const presRef = getDbRef(`presentations/${presentationId}`)
        if (presRef) {
            this.unsubscribe = onValue(presRef, (snapshot) => {
                const data = snapshot.val() as Presentation | null
                if (data) {
                    this.state.presentation = data
                    this.state.viewerCount = Object.keys(data.viewers || {}).length

                    const slideKeys = Object.keys(data.slides || {})
                    if (slideKeys.length > 0 && data.currentSlideIndex >= 0) {
                        const currentSlideId = slideKeys[data.currentSlideIndex]
                        this.state.currentSlide = data.slides[currentSlideId]
                    }

                    this.state.isPresenting = true
                    this.state.canControl = data.hostId === this.userId
                    this.notify()
                }
            })
        }
    }

    getState(): PresentationState {
        return this.state
    }

    getCurrentSlide(): Slide | null {
        return this.state.currentSlide
    }

    getPresentation(): Presentation | null {
        return this.state.presentation
    }

    isHost(): boolean {
        return this.state.presentation?.hostId === this.userId
    }

    destroy(): void {
        if (this.unsubscribe) {
            this.unsubscribe()
            this.unsubscribe = null
        }
        this.listeners = []
        this.state = {
            isPresenting: false,
            presentation: null,
            currentSlide: null,
            canControl: false,
            viewerCount: 0,
        }
        this.roomId = ""
        this.userId = ""
        this.userName = ""
    }

    async broadcastInvite(presentationId: string): Promise<void> {
        if (!this.roomId || !this.userId) return

        const inviteRef = getDbRef(`rooms/${this.roomId}/presentationInvites/${presentationId}`)
        if (inviteRef) {
            await set(inviteRef, {
                presentationId,
                hostName: this.userName,
                hostId: this.userId,
                timestamp: serverTimestamp()
            })
        }
    }

    listenForInvites(callback: (invite: { presentationId: string; hostName: string; hostId: string }) => void): () => void {
        const inviteRef = getDbRef(`rooms/${this.roomId}/presentationInvites`)
        if (!inviteRef) return () => { }

        const unsubscribe = onValue(inviteRef, (snapshot) => {
            const data = snapshot.val()
            if (data) {
                // Get the latest invite
                const invites = Object.values(data) as any[]
                invites.sort((a, b) => b.timestamp - a.timestamp)
                if (invites.length > 0 && invites[0].hostId !== this.userId) {
                    callback(invites[0])
                }
            }
        })

        return unsubscribe
    }
}

export const presentationModeManager = PresentationModeManager.getInstance()
