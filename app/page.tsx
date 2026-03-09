"use client"

import React, { useState, useEffect, Suspense, lazy, useMemo, useCallback } from "react"
import { ThemeProvider } from "@/contexts/theme-context"
import { NotificationSystem } from "@/utils/core/notification-system"
import { preloadComponent, resourceHints, setupLazyImages, getAdaptiveQuality } from "@/utils/core/lazy-loader"
import { setupProgressiveLoading } from "@/utils/infra/code-splitter"
import { getFirebaseDatabase, getFirebaseAuth } from "@/lib/firebase"
import { ref, get, set, remove } from "firebase/database"
import { signInAnonymously, onAuthStateChanged, type User } from "firebase/auth"
import dynamic from "next/dynamic"
import { telemetry } from "@/utils/core/telemetry"

// Forced re-compile comment to resolve 404 after cache clear
// Lazy load components for code splitting
const LandingPage = lazy(() => import("@/components/landing-page").then(module => ({ default: module.LandingPage })))
const ProfileModal = lazy(() => import("@/components/profile-modal").then(module => ({ default: module.ProfileModal })))
const ChatInterface = dynamic(() => import("@/components/chat-interface").then(module => module.ChatInterface), { ssr: false })

// Loading fallback
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-screen bg-slate-950">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
        <p className="text-slate-400">Loading...</p>
      </div>
    </div>
  )
}

type AppState = "landing" | "profile" | "chat"

interface UserProfile {
  name: string
  avatar?: string
}

// basePath must match next.config.mjs for static export on GitHub Pages
const BASE_PATH = '/satloom'

// Error Boundary to catch and display actual errors instead of generic crash screen
class ChatErrorBoundary extends React.Component<
  { children: React.ReactNode; onReset: () => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; onReset: () => void }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ChatInterface crashed:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full bg-slate-950">
          <div className="text-white text-center max-w-lg p-6">
            <div className="text-2xl mb-4 text-red-400">⚠️ Chat Error</div>
            <div className="text-sm text-slate-400 mb-4 font-mono bg-slate-900 p-3 rounded text-left overflow-auto max-h-40">
              {this.state.error?.message || 'Unknown error'}
            </div>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                this.props.onReset()
              }}
              className="bg-cyan-500 hover:bg-cyan-600 px-4 py-2 rounded"
            >
              Return to Home
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function Home() {
  const [appState, setAppState] = useState<AppState>("landing")
  const [currentRoomId, setCurrentRoomId] = useState<string>("")
  const [userProfile, setUserProfile] = useState<UserProfile>({ name: "" })
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [isCreatingRoom, setIsCreatingRoom] = useState(false)
  const [error, setError] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  const notificationSystem = useMemo(() => NotificationSystem.getInstance(), [])

  // Initialize performance optimizations
  useEffect(() => {
    // Set up resource hints for faster loading
    resourceHints.addPreconnect('https://firebasestorage.googleapis.com')
    resourceHints.addDnsPrefetch('firebasestorage.googleapis.com')

    // Set up progressive loading for user interactions
    const cleanupProgressive = setupProgressiveLoading()

    // Set up lazy images
    setupLazyImages()

    // Apply adaptive quality based on network
    const quality = getAdaptiveQuality()
    console.log('Adaptive quality applied:', quality)

    // Authentication
    const auth = getFirebaseAuth()
    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          console.log("App: User authenticated:", user.uid)
          setCurrentUser(user)
          setIsLoading(false)
        } else {
          console.log("App: No user, signing in anonymously...")
          signInAnonymously(auth).catch((err) => {
            console.error("App: Anonymous auth failed:", err)
            if (err.code === 'auth/admin-restricted-operation') {
              setError(
                "⚠️ Anonymous Auth is disabled. Please enable it in Firebase Console → Build → Authentication → Sign-in method → Anonymous."
              )
            } else if (err.code === 'auth/network-request-failed') {
              setError("⚠️ Network error connecting to Firebase. Check your internet connection and firebaseConfig in .env.local.")
            } else {
              setError(`⚠️ Authentication failed (${err.code || err.message}). Please refresh.`)
            }
            setIsLoading(false)
          })
        }
      })

      // Cleanup
      return () => {
        unsubscribe()
        cleanupProgressive()
      }
    } else {
      console.error("App: Auth not initialized")
      setIsLoading(false)
      const cleanupProgressive = setupProgressiveLoading() // Redundant but safe
      return () => cleanupProgressive()
    }
  }, [])

  // Preload critical components when in landing state
  useEffect(() => {
    if (appState === "landing") {
      // Preload chat interface for faster transitions
      preloadComponent('chat-interface')
    }
  }, [appState])

  useEffect(() => {
    console.log("App: Current room ID:", currentRoomId)
    console.log("App: Current state:", appState)
  }, [currentRoomId, appState])

  // Sync room ID from URL when in chat state
  useEffect(() => {
    console.log("App: Sync useEffect triggered - appState:", appState, "currentRoomId:", currentRoomId)
    if (appState === 'chat' && !currentRoomId) {
      const urlParams = new URLSearchParams(window.location.search)
      const roomFromUrl = urlParams.get("room")
      console.log("App: Attempting to sync room ID from URL:", roomFromUrl)
      if (roomFromUrl && roomFromUrl.trim()) {
        console.log("App: Syncing room ID from URL:", roomFromUrl)
        setCurrentRoomId(roomFromUrl.trim().toUpperCase())
      } else {
        console.log("App: No room ID found in URL to sync")
      }
    }
  }, [appState, currentRoomId])

  const generateRoomId = () => {
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase()
    console.log("App: Generated room ID:", newRoomId)
    return newRoomId
  }

  const handleJoinRoom = useCallback(async (roomId: string) => {
    console.log("App: Attempting to join room:", roomId)

    if (!roomId.trim()) {
      setError("Please enter a room ID")
      return
    }

    const cleanRoomId = roomId.trim().toUpperCase()
    console.log("App: Clean room ID:", cleanRoomId)

    setError("")
    setCurrentRoomId(cleanRoomId)

    // Transition immediately to profile modal instead of waiting for a blocking network check
    // This solves the hang caused by slow WebSocket fallback for get()
    console.log("App: Version V3-INSTANT-JOIN-ACTIVE")
    setShowProfileModal(true)
  }, [])

  const handleCreateRoom = useCallback(async () => {
    console.log("App: Creating new room")
    setIsCreatingRoom(true)
    setError("")
    setShowProfileModal(true)
  }, [])

  useEffect(() => {
    // Check for saved profile
    const savedProfile = localStorage.getItem("satloom-profile")
    if (savedProfile) {
      try {
        const profile = JSON.parse(savedProfile)
        setUserProfile(profile)
        console.log("App: Loaded saved profile:", profile)
      } catch (error) {
        console.error("Error loading saved profile:", error)
      }
    }

    // Check for room ID in URL parameters
    const urlParams = new URLSearchParams(window.location.search)
    const roomFromUrl = urlParams.get("room")
    console.log("App: Room from URL:", roomFromUrl)

    if (roomFromUrl && roomFromUrl.trim()) {
      // Set the room ID immediately to prevent state loss
      setCurrentRoomId(roomFromUrl.trim().toUpperCase())

      // Only trigger join if we're not already in chat state
      if (appState !== 'chat') {
        handleJoinRoom(roomFromUrl)
      }
    } else {
      setIsLoading(false)
    }
  }, [appState, handleJoinRoom])

  const handleProfileSave = async (profile: UserProfile) => {
    console.log("App: Saving profile and joining room")
    try {
      setUserProfile(profile)

      // Save profile to localStorage
      localStorage.setItem("satloom-profile", JSON.stringify(profile))

      let roomId = currentRoomId

      if (isCreatingRoom || !roomId) {
        // Creating new room
        roomId = generateRoomId()
        console.log("App: Creating new room with ID:", roomId)

        const database = getFirebaseDatabase()

        if (database) {
          // Create room in Firebase
          const roomRef = ref(database, `rooms/${roomId}`)
          // Non-blocking set
          set(roomRef, {
            createdAt: Date.now(),
            createdBy: profile.name,
            createdByUid: currentUser?.uid || "anonymous",
            members: {
              [profile.name]: {
                name: profile.name,
                avatar: profile.avatar || null,
                joinedAt: Date.now(),
              },
            },
          }).catch(err => console.error("App: Failed to create room:", err))
          console.log("App: Commenced room creation in Firebase:", roomId)
          telemetry.logEvent('room_created', roomId, currentUser?.uid || "anonymous", profile.name, { isHost: true })
        }

        notificationSystem.roomCreated(roomId)
      } else {
        // Joining existing room - add user to members
        console.log("App: Joining existing room:", roomId)

        const database = getFirebaseDatabase()

        if (database) {
          const memberRef = ref(database, `rooms/${roomId}/members/${profile.name}`)
          try {
            // Await the write so the user is registered before ChatInterface initialises its listeners
            await set(memberRef, {
              name: profile.name,
              avatar: profile.avatar || null,
              joinedAt: Date.now(),
            })
            console.log("App: Successfully added user to existing room:", roomId)
          } catch (err) {
            console.error("App: Failed to add member (room may not exist yet):", err)
          }
          telemetry.logEvent('user_joined', roomId, currentUser?.uid || "anonymous", profile.name)
        }
      }

      // Ensure room ID is set before changing state
      if (roomId && roomId.trim()) {
        console.log("App: Final room ID before entering chat:", roomId)

        // Update URL using pushState (not router.push which tries RSC fetch on static export)
        const newUrl = `${BASE_PATH}?room=${encodeURIComponent(roomId)}`
        window.history.pushState({}, "", newUrl)
        console.log("App: Updated URL to:", newUrl)

        // Use a small timeout to ensure URL is updated before state changes
        setTimeout(() => {
          setCurrentRoomId(roomId)
          setAppState("chat")
          setShowProfileModal(false)
          setIsCreatingRoom(false)
        }, 50)
      } else {
        throw new Error("Room ID is missing or invalid")
      }
    } catch (error) {
      console.error("Error saving profile:", error)
      setError("Failed to join room. Please try again.")
      notificationSystem.error("Failed to join room")
      // Reset state on error
      setCurrentRoomId("")
      setAppState("landing")
    }
  }

  const handleLeaveRoom = async () => {
    console.log("App: Leaving room:", currentRoomId)
    try {
      // Clear the room from URL
      window.history.pushState({}, "", BASE_PATH)

      const database = getFirebaseDatabase()

      if (database && currentRoomId && userProfile.name) {
        const roomRef = ref(database, `rooms/${currentRoomId}`)
        const snapshot = await get(roomRef)

        if (snapshot.exists()) {
          const roomData = snapshot.val()
          // Secure check: Only host can delete room
          if (roomData.createdByUid === currentUser?.uid && currentUser?.uid) {
            await remove(roomRef)

            // Also clean up related data
            const callsRef = ref(database, `calls/${currentRoomId}`)
            await remove(callsRef)

            const gamesRef = ref(database, `games/${currentRoomId}`)
            await remove(gamesRef)
          }
        }
      }
    } catch (error) {
      console.error("Error cleaning up room:", error)
    }

    // Reset state
    setAppState("landing")
    setCurrentRoomId("")
    setIsCreatingRoom(false)
    setError("")
  }

  const handleProfileModalClose = () => {
    console.log("App: Profile modal closed")
    setShowProfileModal(false)
    setIsCreatingRoom(false)
    setCurrentRoomId("")
    setError("")

    // Clear URL if user cancels
    window.history.pushState({}, "", BASE_PATH)
  }

  return (
    <ThemeProvider>
      <div className="h-screen h-[100dvh] overflow-hidden bg-slate-950">
        <div className="h-full w-full">
          {isLoading ? (
            <LoadingFallback />
          ) : (
            <Suspense fallback={<LoadingFallback />}>
              {appState === "landing" && (
                <LandingPage
                  onCreateRoom={handleCreateRoom}
                  onJoinRoom={handleJoinRoom}
                  error={error}
                  initialRoomId={currentRoomId}
                />
              )}

              {appState === "chat" && currentRoomId && (
                <ChatErrorBoundary onReset={() => { setAppState('landing'); setCurrentRoomId(''); window.history.pushState({}, '', BASE_PATH) }}>
                  <ChatInterface roomId={currentRoomId} userProfile={userProfile} onLeave={handleLeaveRoom} />
                </ChatErrorBoundary>
              )}

              {appState === "chat" && !currentRoomId && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-white text-center">
                    <div className="text-xl mb-4">Error: No room ID available</div>
                    <button
                      onClick={() => setAppState("landing")}
                      className="bg-cyan-500 hover:bg-cyan-600 px-4 py-2 rounded haptic"
                    >
                      Return to Home
                    </button>
                  </div>
                </div>
              )}

              <ProfileModal
                isOpen={showProfileModal}
                onClose={handleProfileModalClose}
                onSave={handleProfileSave}
                defaultProfile={userProfile}
              />
            </Suspense>
          )}
        </div>
      </div>
    </ThemeProvider>
  )
}
