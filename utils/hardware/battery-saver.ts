/**
 * Battery Saver Mode
 * 
 * Reduces power consumption by:
 * - Lowering video quality
 * - Reducing animation frequency
 * - Limiting background processing
 * - Disabling non-essential features
 */

export type BatteryMode = "performance" | "balanced" | "battery-saver"

interface BatterySettings {
    mode: BatteryMode
    reduceMotion: boolean
    lowerVideoQuality: boolean
    disableAnimations: boolean
    limitBackgroundSync: boolean
    reduceImageQuality: boolean
    disableVoiceEffects: boolean
    autoDisconnectIdle: boolean
    idleTimeout: number // seconds
}

interface BatteryInfo {
    level: number
    charging: boolean
    chargingTime: number
    dischargingTime: number
    supported: boolean
    savingActive: boolean
}

const DEFAULT_BATTERY_SETTINGS: BatterySettings = {
    mode: "balanced",
    reduceMotion: false,
    lowerVideoQuality: false,
    disableAnimations: false,
    limitBackgroundSync: false,
    reduceImageQuality: false,
    disableVoiceEffects: false,
    autoDisconnectIdle: false,
    idleTimeout: 300,
}

class BatterySaverManager {
    private static instance: BatterySaverManager
    private settings: BatterySettings = { ...DEFAULT_BATTERY_SETTINGS }
    private batteryInfo: BatteryInfo = {
        level: 100,
        charging: true,
        chargingTime: 0,
        dischargingTime: 0,
        supported: false,
        savingActive: false,
    }
    private batteryListener: ((info: BatteryInfo) => void) | null = null
    private idleTimer: ReturnType<typeof setTimeout> | null = null
    private idleCallback: (() => void) | null = null
    private isMonitoringIdle: boolean = false

    private constructor() {
        // Load settings from localStorage
        this.loadSettings()

        // Initialize battery API if available
        this.initBatteryAPI()
    }

    static getInstance(): BatterySaverManager {
        if (!BatterySaverManager.instance) {
            BatterySaverManager.instance = new BatterySaverManager()
        }
        return BatterySaverManager.instance
    }

    /**
     * Initialize Battery Status API
     */
    private async initBatteryAPI() {
        if (typeof navigator === "undefined") return

        try {
            // @ts-ignore - Battery API is not in TypeScript definitions
            if (navigator.getBattery) {
                // @ts-ignore
                const battery = await navigator.getBattery()

                this.batteryInfo.supported = true
                this.updateBatteryInfo(battery)

                // Listen for changes
                battery.addEventListener("levelchange", () => this.updateBatteryInfo(battery))
                battery.addEventListener("chargingchange", () => this.updateBatteryInfo(battery))
                battery.addEventListener("chargingtimechange", () => this.updateBatteryInfo(battery))
                battery.addEventListener("dischargingtimechange", () => this.updateBatteryInfo(battery))
            }
        } catch (error) {
            console.log("Battery API not supported")
            this.batteryInfo.supported = false
        }
    }

    /**
     * Update battery info from API
     */
    private updateBatteryInfo(battery: any) {
        this.batteryInfo.level = Math.round(battery.level * 100)
        this.batteryInfo.charging = battery.charging
        this.batteryInfo.chargingTime = battery.chargingTime || 0
        this.batteryInfo.dischargingTime = battery.dischargingTime || 0

        // Auto-enable battery saver if low battery and not charging
        if (this.batteryInfo.level <= 20 && !this.batteryInfo.charging && this.settings.mode !== "performance") {
            this.setMode("battery-saver")
        }

        // Notify listener
        if (this.batteryListener) {
            this.batteryListener(this.batteryInfo)
        }
    }

    /**
     * Set the battery mode
     */
    setMode(mode: BatteryMode): void {
        this.settings.mode = mode
        this.applySettings()
        this.saveSettings()
    }

    /**
     * Get current mode
     */
    getMode(): BatteryMode {
        return this.settings.mode
    }

    /**
     * Get current settings
     */
    getSettings(): BatterySettings {
        return { ...this.settings }
    }

    /**
     * Apply settings to the document/environment
     */
    private applySettings(): void {
        if (typeof document === "undefined") return

        const root = document.documentElement
        const body = document.body

        // Reduce motion
        this.settings.reduceMotion = this.settings.mode === "battery-saver"
        root.classList.toggle("reduce-motion", this.settings.reduceMotion)
        root.style.setProperty("--animation-duration", this.settings.reduceMotion ? "0.1s" : "0.3s")

        // Lower video quality (affects downstream consumers)
        this.settings.lowerVideoQuality = this.settings.mode === "battery-saver"

        // Disable animations
        this.settings.disableAnimations = this.settings.mode === "battery-saver"
        body.classList.toggle("disable-animations", this.settings.disableAnimations)

        // Limit background sync
        this.settings.limitBackgroundSync = this.settings.mode === "battery-saver"

        // Reduce image quality
        this.settings.reduceImageQuality = this.settings.mode === "battery-saver"

        // Disable voice effects
        this.settings.disableVoiceEffects = this.settings.mode === "battery-saver"

        // Auto disconnect idle
        this.settings.autoDisconnectIdle = this.settings.mode === "battery-saver"

        // Set saving active flag
        this.batteryInfo.savingActive = this.settings.mode === "battery-saver"
    }

    /**
     * Get recommended video quality based on mode
     */
    getVideoQuality(): { width: number; height: number; fps: number } {
        switch (this.settings.mode) {
            case "battery-saver":
                return { width: 640, height: 360, fps: 15 }
            case "balanced":
                return { width: 1280, height: 720, fps: 24 }
            case "performance":
            default:
                return { width: 1920, height: 1080, fps: 30 }
        }
    }

    /**
     * Get recommended image quality (0-100)
     */
    getImageQuality(): number {
        switch (this.settings.mode) {
            case "battery-saver":
                return 60
            case "balanced":
                return 80
            case "performance":
            default:
                return 95
        }
    }

    /**
     * Get recommended polling interval (ms)
     */
    getPollingInterval(): number {
        switch (this.settings.mode) {
            case "battery-saver":
                return 10000 // 10 seconds
            case "balanced":
                return 5000 // 5 seconds
            case "performance":
            default:
                return 2000 // 2 seconds
        }
    }

    /**
     * Should use low quality images
     */
    shouldUseLowQualityImages(): boolean {
        return this.settings.reduceImageQuality
    }

    /**
     * Should reduce motion
     */
    shouldReduceMotion(): boolean {
        return this.settings.reduceMotion
    }

    /**
     * Should disable animations
     */
    shouldDisableAnimations(): boolean {
        return this.settings.disableAnimations
    }

    /**
     * Should limit background sync
     */
    shouldLimitBackgroundSync(): boolean {
        return this.settings.limitBackgroundSync
    }

    /**
     * Listen for battery changes
     */
    onBatteryChange(callback: (info: BatteryInfo) => void): () => void {
        this.batteryListener = callback
        return () => {
            if (this.batteryListener === callback) {
                this.batteryListener = null
            }
        }
    }

    /**
     * Get battery info
     */
    getBatteryInfo(): BatteryInfo {
        return { ...this.batteryInfo }
    }

    /**
     * Start idle monitoring
     */
    startIdleMonitoring(callback: () => void, timeout?: number): void {
        if (typeof window === "undefined") return

        this.stopIdleMonitoring()
        this.idleCallback = callback

        const idleTimeout = timeout || this.settings.idleTimeout * 1000

        const resetTimer = () => {
            if (this.idleTimer) {
                clearTimeout(this.idleTimer)
            }
            if (this.settings.autoDisconnectIdle && this.settings.mode === "battery-saver") {
                this.idleTimer = setTimeout(() => {
                    if (this.idleCallback) {
                        this.idleCallback()
                    }
                }, idleTimeout)
            }
        }

        // Listen for user activity
        const events = ["mousedown", "keydown", "touchstart", "scroll", "mousemove"]
        events.forEach((event) => {
            window.addEventListener(event, resetTimer, { passive: true })
        })

        resetTimer()
        this.isMonitoringIdle = true
    }

    /**
     * Stop idle monitoring
     */
    stopIdleMonitoring(): void {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer)
            this.idleTimer = null
        }
        this.isMonitoringIdle = false
    }

    /**
     * Is idle monitoring active
     */
    isIdleMonitoringActive(): boolean {
        return this.isMonitoringIdle
    }

    /**
     * Save settings to localStorage
     */
    private saveSettings(): void {
        if (typeof localStorage === "undefined") return
        localStorage.setItem("battery-saver-settings", JSON.stringify(this.settings))
    }

    /**
     * Load settings from localStorage
     */
    private loadSettings(): void {
        if (typeof localStorage === "undefined") return

        try {
            const saved = localStorage.getItem("battery-saver-settings")
            if (saved) {
                this.settings = { ...DEFAULT_BATTERY_SETTINGS, ...JSON.parse(saved) }
                this.applySettings()
            }
        } catch (error) {
            console.error("Failed to load battery settings:", error)
        }
    }

    /**
     * Reset to default settings
     */
    resetSettings(): void {
        this.settings = { ...DEFAULT_BATTERY_SETTINGS }
        this.applySettings()
        this.saveSettings()
    }

    /**
     * Clean up
     */
    destroy(): void {
        this.stopIdleMonitoring()
        this.batteryListener = null
    }
}

export const batterySaver = BatterySaverManager.getInstance()
export type { BatterySettings, BatteryInfo }
