/**
 * Application-wide constants
 */

// Timeouts (in milliseconds)
export const TIMEOUTS = {
    DEBOUNCE: 300,
    THROTTLE: 100,
    TOAST_DURATION: 3000,
    TOAST_LONG_DURATION: 5000,
    CALL_RINGING_TIMEOUT: 30000, // 30 seconds
    GAME_INVITE_TIMEOUT: 60000, // 60 seconds
    IDLE_TIMEOUT: 300000, // 5 minutes
    AUTO_SAVE: 5000, // 5 seconds
    CONNECTION_RETRY: 3000, // 3 seconds
    MESSAGE_RETRY: 5000, // 5 seconds
    SESSION_TIMEOUT: 3600000, // 1 hour
    CLEANUP_INTERVAL: 60000, // 1 minute
} as const

// Game constants
export const GAME_CONSTANTS = {
    DOTS_AND_BOXES: {
        GRID_SIZE: 6,
        MIN_PLAYERS: 2,
        MAX_PLAYERS: 4,
        WINNING_SCORE_THRESHOLD: 0,
        TIMEOUT_TURN: 30000, // 30 seconds per turn
        MAX_ROUNDS: 100,
    },
    QUIZ: {
        MIN_PLAYERS: 1,
        MAX_PLAYERS: 10,
        QUESTIONS_COUNT: 10,
        TIME_PER_QUESTION: 15000, // 15 seconds
        TIME_PER_QUESTION_MULTIPLAYER: 20000, // 20 seconds
        WINNING_SCORE: 0,
    },
    THEATER: {
        MIN_PLAYERS: 1,
        MAX_PLAYERS: 50,
        SYNC_THRESHOLD_MS: 100,
        HEARTBEAT_INTERVAL: 5000,
    },
} as const

// Message constants
export const MESSAGE_CONSTANTS = {
    MAX_MESSAGE_LENGTH: 2000,
    MAX_ATTACHMENTS: 5,
    MAX_ATTACHMENT_SIZE: 10 * 1024 * 1024, // 10MB
    RETENTION_MS: 24 * 60 * 60 * 1000, // 24 hours
    PAGINATION_LIMIT: 50,
} as const

// Firebase paths
export const FIREBASE_PATHS = {
    ROOMS: "rooms",
    MESSAGES: "messages",
    USERS: "users",
    PRESENCE: "presence",
    NOTIFICATIONS: "notifications",
    CALLS: "calls",
    GAMES: "games",
    THEATERS: "theaters",
} as const

// Local storage keys
export const STORAGE_KEYS = {
    THEME: "satloom-theme",
    USER_PREFERENCES: "satloom-preferences",
    RECENT_ROOMS: "satloom-recent-rooms",
    DRAFT_MESSAGES: "satloom-draft-messages",
    SESSION: "satloom-session",
} as const

// Emoji categories
export const EMOJI_CATEGORIES = [
    { id: "smileys", label: "Smileys", icon: "😊" },
    { id: "gestures", label: "Gestures", icon: "👋" },
    { id: "hearts", label: "Hearts", icon: "❤️" },
    { id: "objects", label: "Objects", icon: "🎁" },
    { id: "symbols", label: "Symbols", icon: "✨" },
] as const

// File types
export const FILE_TYPES = {
    IMAGE: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    VIDEO: ["video/mp4", "video/webm", "video/quicktime"],
    AUDIO: ["audio/mpeg", "audio/wav", "audio/ogg", "audio/webm"],
    DOCUMENT: ["application/pdf", "text/plain", "application/msword"],
} as const

// Default values
export const DEFAULTS = {
    USER_AVATAR: "/placeholder-user.jpg",
    ROOM_AVATAR: "/placeholder-logo.png",
    MAX_MESSAGES: 50,
    TYPING_TIMEOUT: 3000,
    PRESENCE_UPDATE_INTERVAL: 30000,
} as const

// Accessibility constants
export const A11Y_CONSTANTS = {
    FOCUS_TRAP_TABINDEX: -1,
    LIVE_REGION_POLITENESS: "polite",
    ANNOUNCEMENT_DELAY: 100,
} as const

// Error messages
export const ERROR_MESSAGES = {
    NETWORK_ERROR: "Network error. Please check your connection.",
    FIREBASE_ERROR: "Something went wrong. Please try again.",
    PERMISSION_DENIED: "Permission denied. Please allow access.",
    FILE_TOO_LARGE: "File is too large. Maximum size is 10MB.",
    INVALID_FILE_TYPE: "Invalid file type. Please try again.",
    MESSAGE_TOO_LONG: "Message is too long. Maximum 2000 characters.",
    SESSION_EXPIRED: "Your session has expired. Please log in again.",
    ROOM_NOT_FOUND: "Room not found. It may have been deleted.",
    USER_NOT_FOUND: "User not found.",
    GENERIC_ERROR: "An error occurred. Please try again.",
} as const
