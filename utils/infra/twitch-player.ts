// Twitch Player SDK Integration
// Provides control over Twitch embeds via Twitch Player SDK

declare global {
    interface Window {
        Twitch?: {
            Player: new (element: HTMLElement, options: TwitchPlayerOptions) => TwitchPlayer
        }
    }
}

export interface TwitchPlayerOptions {
    width?: string | number
    height?: string | number
    channel?: string
    video?: string
    autoplay?: boolean
    muted?: boolean
    parent?: string[]
    controls?: boolean
}

export interface TwitchPlayer {
    play: () => void
    pause: () => void
    seek: (timestamp: number) => void
    getVolume: () => number
    setVolume: (volume: number) => void
    getMuted: () => boolean
    setMuted: (muted: boolean) => void
    getCurrentTime: () => number
    getDuration: () => number
    getPlaybackRate: () => number
    setPlaybackRate: (rate: number) => void
    isPaused: () => boolean
    ready: boolean
    addEventListener: (event: string, callback: (player: TwitchPlayer) => void) => void
}

let twitchScriptLoaded = false

// Load Twitch Player SDK
export function loadTwitchSDK(): Promise<typeof window.Twitch> {
    return new Promise((resolve) => {
        if (window.Twitch) {
            resolve(window.Twitch)
            return
        }

        if (twitchScriptLoaded) {
            // Already loading, wait for it
            const checkInterval = setInterval(() => {
                if (window.Twitch) {
                    clearInterval(checkInterval)
                    resolve(window.Twitch)
                }
            }, 100)
            return
        }

        twitchScriptLoaded = true

        // Load the script
        const script = document.createElement('script')
        script.src = 'https://player.twitch.tv/js/embed/v1.js'
        script.async = true
        script.onload = () => {
            if (window.Twitch) {
                resolve(window.Twitch)
            }
        }
        document.head.appendChild(script)
    })
}

// Twitch Player Controller Class
export class TwitchPlayerController {
    private player: TwitchPlayer | null = null
    private playerContainerId: string = 'twitch-player-container'
    private isReady = false
    private readyCallbacks: Array<() => void> = []
    private channelName: string = ''

    async initialize(channelName: string): Promise<void> {
        this.channelName = channelName

        try {
            const Twitch = await loadTwitchSDK()

            if (!Twitch) {
                console.error('Failed to load Twitch SDK')
                return
            }

            // Create container if it doesn't exist
            let container = document.getElementById(this.playerContainerId)
            if (!container) {
                container = document.createElement('div')
                container.id = this.playerContainerId
                container.style.display = 'none' // Hide the container, we'll use iframe instead
                document.body.appendChild(container)
            }

            // Create Twitch player
            this.player = new Twitch.Player(container, {
                channel: channelName,
                width: '100%',
                height: '100%',
                autoplay: false,
                muted: false,
                parent: [window.location.hostname],
                controls: true
            }) as unknown as TwitchPlayer

            // Wait for player to be ready
            this.player.addEventListener('ready', () => {
                this.isReady = true
                console.log('[Twitch] Player ready')
                this.readyCallbacks.forEach(cb => cb())
                this.readyCallbacks = []
            })

            // Handle errors
            this.player.addEventListener('playerError', (player: TwitchPlayer) => {
                console.error('[Twitch] Player error:', player)
            })

        } catch (error) {
            console.error('Failed to initialize Twitch player:', error)
        }
    }

    whenReady(callback: () => void): void {
        if (this.isReady) {
            callback()
        } else {
            this.readyCallbacks.push(callback)
        }
    }

    play(): void {
        if (!this.player || !this.isReady) {
            console.warn('[Twitch] Player not ready for play')
            return
        }
        this.player.play()
    }

    pause(): void {
        if (!this.player || !this.isReady) {
            console.warn('[Twitch] Player not ready for pause')
            return
        }
        this.player.pause()
    }

    seek(timestamp: number): void {
        if (!this.player || !this.isReady) {
            console.warn('[Twitch] Player not ready for seek')
            return
        }
        this.player.seek(timestamp)
    }

    getCurrentTime(): number {
        if (!this.player || !this.isReady) {
            return 0
        }
        return this.player.getCurrentTime()
    }

    getDuration(): number {
        if (!this.player || !this.isReady) {
            return 0
        }
        return this.player.getDuration()
    }

    isPaused(): boolean {
        if (!this.player || !this.isReady) {
            return true
        }
        return this.player.isPaused()
    }

    destroy(): void {
        this.player = null
        this.isReady = false
    }
}
