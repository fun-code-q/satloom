// Firebase configuration using environment variables
// IMPORTANT: Never hardcode credentials in source code

import { initializeApp, getApps, FirebaseApp } from "firebase/app"
import { getDatabase, Database } from "firebase/database"
import { getAuth, Auth } from "firebase/auth"

// Declare environment variables for TypeScript
declare global {
  interface Window {
    __ENV?: {
      NEXT_PUBLIC_FIREBASE_API_KEY?: string
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?: string
      NEXT_PUBLIC_FIREBASE_DATABASE_URL?: string
      NEXT_PUBLIC_FIREBASE_PROJECT_ID?: string
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?: string
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?: string
      NEXT_PUBLIC_FIREBASE_APP_ID?: string
    }
  }
}

// Firebase config type
interface FirebaseConfig {
  apiKey: string
  authDomain: string
  databaseURL: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
}

// Lazy initialization to prevent issues during build time
let app: FirebaseApp | null = null
let database: Database | null = null
let auth: Auth | null = null
let initialized = false

/**
 * Get Firebase config from environment variables
 */
function getFirebaseConfig(): FirebaseConfig | null {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID

  if (!apiKey || !authDomain || !databaseURL || !projectId) {
    return null
  }

  return {
    apiKey,
    authDomain,
    databaseURL,
    projectId,
    storageBucket: storageBucket || `${projectId}.appspot.com`,
    messagingSenderId: messagingSenderId || "",
    appId: appId || "",
  }
}

/**
 * Initialize Firebase app
 */
export function initializeFirebase(): {
  app: FirebaseApp | null
  database: Database | null
  auth: Auth | null
} {
  if (typeof window === "undefined") {
    return { app: null, database: null, auth: null }
  }

  if (initialized && app && database && auth) {
    return { app, database, auth }
  }

  const config = getFirebaseConfig()
  console.log("Firebase: Config attempt:", config ? "Found" : "Missing")
  if (!config) return { app: null, database: null, auth: null }

  const apps = getApps()
  if (apps.length > 0) {
    app = apps[0]
  } else {
    try {
      app = initializeApp(config)
    } catch (error) {
      console.error("Firebase initialization error:", error)
      return { app: null, database: null, auth: null }
    }
  }

  try {
    if (app) {
      database = getDatabase(app)
      auth = getAuth(app)
      initialized = true

      // Diagnostic logging
      console.log("Firebase: Initialization Successful")
      console.log("Firebase: Project ID:", config.projectId)
      console.log("Firebase: Database URL:", config.databaseURL.substring(0, 20) + "...")

      // Expose for debugging (masked)
      if (typeof window !== "undefined") {
        (window as any).__FIREBASE_DIAGNOSTICS = {
          initialized: true,
          projectId: config.projectId,
          databaseURL: config.databaseURL.substring(0, 15) + "...",
          hasApp: !!app,
          hasDb: !!database,
          hasAuth: !!auth,
          timestamp: new Date().toISOString()
        }
      }
    }
  } catch (error) {
    console.error("Error getting Firebase services:", error)
  }

  return { app, database, auth }
}

export function getFirebaseDatabase(): Database | null {
  if (!database) {
    const { database: db } = initializeFirebase()
    return db
  }
  return database
}

export function getFirebaseAuth(): Auth | null {
  if (!auth) {
    const { auth: au } = initializeFirebase()
    return au
  }
  return auth
}

export { database, auth }
export default app
