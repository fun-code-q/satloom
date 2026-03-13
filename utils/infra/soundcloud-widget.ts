// SoundCloud Widget Integration
// Provides full control over SoundCloud embeds via SC.Widget API

declare global {
    interface Window {
        SC?: {
            Widget: new (iframe: HTMLIFrameElement) => SCWidgetInstance
        }
    }
}

export interface SCWidgetInstance {
    play: (callback?: () => void) => void
    pause: (callback?: () => void) => void
    seekTo: (milliseconds: number, callback?: () => void) => void
    getDuration: (callback: (duration: number) => void) => void
    getPosition: (callback: (position: number) => void) => void
    isPlaying: (callback: (isPlaying: boolean) => void) => void
    bind: (event: string, callback: () => void) => void
    load: (url: string, options?: any) => void
}

let scScriptLoaded = false
let scResolve: ((value: typeof window.SC) => void) | null = null

// Load SoundCloud widget script
export function loadSoundCloudSDK(): Promise<typeof window.SC> {
    return new Promise((resolve) => {
        if (window.SC) {
            resolve(window.SC)
            return
        }

        if (scResolve) {
            // Already loading, wait for it
            const checkInterval = setInterval(() => {
                if (window.SC) {
                    clearInterval(checkInterval)
                    resolve(window.SC)
                }
            }, 100)
            return
        }

        scResolve = resolve

        // Load the script
        const script = document.createElement('script')
        script.src = 'https://w.soundcloud.com/player/api.js'
        script.async = true
        script.onload = () => {
            scScriptLoaded = true
            if (window.SC && scResolve) {
                scResolve(window.SC)
            }
        }
        document.head.appendChild(script)
    })
}

// Create SoundCloud widget from iframe
export async function createSoundCloudWidget(iframe: HTMLIFrameElement): Promise<SCWidgetInstance | null> {
    try {
        const SC = await loadSoundCloudSDK()
        if (SC && SC.Widget) {
            return new SC.Widget(iframe) as unknown as SCWidgetInstance
        }
        return null
    } catch (error) {
        console.error('Failed to create SoundCloud widget:', error)
        return null
    }
}

// SoundCloud Player Controller Class
export class SoundCloudPlayerController {
    private widget: SCWidgetInstance | null = null
    private iframe: HTMLIFrameElement | null = null
    private isReady = false
    private readyCallbacks: Array<() => void> = []
    private positionUpdateInterval: NodeJS.Timeout | null = null

    async initialize(iframe: HTMLIFrameElement): Promise<void> {
        this.iframe = iframe
        this.widget = await createSoundCloudWidget(iframe)

        if (!this.widget) {
            console.error('Failed to initialize SoundCloud widget')
            return
        }

        // Bind to ready event
        this.widget.bind('ready', () => {
            this.isReady = true
            console.log('[SoundCloud] Widget ready')

            // Execute pending callbacks
            this.readyCallbacks.forEach(cb => cb())
            this.readyCallbacks = []
        })

        // Start position tracking
        this.startPositionTracking()
    }

    private startPositionTracking(): void {
        this.positionUpdateInterval = setInterval(() => {
            if (this.widget && this.isReady) {
                this.widget.getPosition((position) => {
                    // Can emit position updates here if needed
                })
            }
        }, 1000)
    }

    whenReady(callback: () => void): void {
        if (this.isReady) {
            callback()
        } else {
            this.readyCallbacks.push(callback)
        }
    }

    play(): void {
        if (!this.widget || !this.isReady) {
            console.warn('[SoundCloud] Widget not ready for play')
            return
        }
        this.widget.play()
    }

    pause(): void {
        if (!this.widget || !this.isReady) {
            console.warn('[SoundCloud] Widget not ready for pause')
            return
        }
        this.widget.pause()
    }

    seekTo(seconds: number): void {
        if (!this.widget || !this.isReady) {
            console.warn('[SoundCloud] Widget not ready for seek')
            return
        }
        // Convert seconds to milliseconds
        this.widget.seekTo(seconds * 1000)
    }

    getPosition(callback: (position: number) => void): void {
        if (!this.widget || !this.isReady) {
            callback(0)
            return
        }
        this.widget.getPosition((ms) => {
            callback(ms / 1000) // Convert to seconds
        })
    }

    getDuration(callback: (duration: number) => void): void {
        if (!this.widget || !this.isReady) {
            callback(0)
            return
        }
        this.widget.getDuration((ms) => {
            callback(ms / 1000) // Convert to seconds
        })
    }

    isPlaying(callback: (playing: boolean) => void): void {
        if (!this.widget || !this.isReady) {
            callback(false)
            return
        }
        this.widget.isPlaying(callback)
    }

    destroy(): void {
        if (this.positionUpdateInterval) {
            clearInterval(this.positionUpdateInterval)
            this.positionUpdateInterval = null
        }
        this.widget = null
        this.iframe = null
        this.isReady = false
    }
}
