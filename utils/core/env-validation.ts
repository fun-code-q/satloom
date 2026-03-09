/**
 * Environment variable validation utilities
 */

export interface EnvConfig {
    NEXT_PUBLIC_FIREBASE_API_KEY: string
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: string
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: string
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: string
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: string
    NEXT_PUBLIC_FIREBASE_APP_ID: string
    NEXT_PUBLIC_FIREBASE_DATABASE_URL: string
    NEXT_PUBLIC_APP_URL?: string
    NEXT_PUBLIC_APP_NAME?: string
}

export interface EnvValidationResult {
    isValid: boolean
    errors: string[]
    warnings: string[]
}

/**
 * Required environment variables
 */
const REQUIRED_ENV_VARS: (keyof EnvConfig)[] = [
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
    "NEXT_PUBLIC_FIREBASE_DATABASE_URL",
]

/**
 * Optional environment variables with defaults
 */
const OPTIONAL_ENV_VARS: (keyof EnvConfig)[] = [
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_APP_NAME",
]

/**
 * Validate all required environment variables
 */
export function validateEnvironment(): EnvValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Check required variables
    for (const envVar of REQUIRED_ENV_VARS) {
        const value = process.env[envVar]

        if (!value) {
            errors.push(`Missing required environment variable: ${envVar}`)
        } else if (value.trim() === "") {
            errors.push(`Empty environment variable: ${envVar}`)
        } else if (value.includes(" ")) {
            warnings.push(`Environment variable ${envVar} contains spaces - this may cause issues`)
        }
    }

    // Validate Firebase URL format
    const databaseUrl = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
    if (databaseUrl) {
        try {
            const url = new URL(databaseUrl)
            if (!url.hostname.includes("firebaseio.com") && !url.hostname.includes("firebasedatabase.app")) {
                warnings.push("Firebase database URL may not be in the expected format")
            }
        } catch {
            errors.push("Invalid Firebase database URL format")
        }
    }

    // Validate API key format (should not be too short)
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
    if (apiKey && apiKey.length < 10) {
        warnings.push("Firebase API key seems unusually short - verify it's correct")
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
    }
}

/**
 * Get environment variable with type safety
 */
export function getEnvVar<K extends keyof EnvConfig>(key: K): EnvConfig[K] | null {
    const value = process.env[key]
    return (value as EnvConfig[K]) || null
}

/**
 * Get environment variable with default
 */
export function getEnvVarWithDefault<K extends keyof EnvConfig>(
    key: K,
    defaultValue: NonNullable<EnvConfig[K]>
): NonNullable<EnvConfig[K]> {
    const value = process.env[key]
    return (value as NonNullable<EnvConfig[K]>) || defaultValue
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
    return process.env.NODE_ENV === "development"
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
    return process.env.NODE_ENV === "production"
}

/**
 * Check if running on server side
 */
export function isServer(): boolean {
    return typeof window === "undefined"
}

/**
 * Check if running on client side
 */
export function isClient(): boolean {
    return typeof window !== "undefined"
}

/**
 * Get app configuration
 */
export function getAppConfig() {
    return {
        name: getEnvVarWithDefault("NEXT_PUBLIC_APP_NAME", "SatLoom"),
        url: getEnvVarWithDefault("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),
        isDevelopment: isDevelopment(),
        isProduction: isProduction(),
    }
}

/**
 * Throw error if environment is invalid
 */
export function assertEnvironment(): void {
    const result = validateEnvironment()

    if (!result.isValid) {
        const errorMessage = [
            "Environment validation failed:",
            ...result.errors.map((e) => `  - ${e}`),
            ...result.warnings.map((w) => `  Warning: ${w}`),
        ].join("\n")

        throw new Error(errorMessage)
    }

    // Log warnings in development
    if (isDevelopment() && result.warnings.length > 0) {
        console.warn("Environment warnings:", result.warnings)
    }
}

/**
 * Log environment status on app startup
 */
export function logEnvironmentStatus(): void {
    const result = validateEnvironment()
    const config = getAppConfig()

    console.log("=".repeat(50))
    console.log("SatLoom Environment Check")
    console.log("=".repeat(50))
    console.log(`App Name: ${config.name}`)
    console.log(`App URL: ${config.url}`)
    console.log(`Environment: ${config.isDevelopment ? "Development" : "Production"}`)
    console.log("-".repeat(50))

    if (result.isValid) {
        console.log("✓ All required environment variables are set")
    } else {
        console.log("✗ Environment validation failed:")
        result.errors.forEach((e) => console.log(`  - ${e}`))
    }

    if (result.warnings.length > 0) {
        console.log("Warnings:")
        result.warnings.forEach((w) => console.log(`  - ${w}`))
    }

    console.log("=".repeat(50))
}
