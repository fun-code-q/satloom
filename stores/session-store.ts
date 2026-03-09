import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UserProfile {
    name: string
    avatar?: string
}

interface SessionState {
    userProfile: UserProfile
    activeRoomId: string | null
    isHost: boolean

    // Actions
    setUserProfile: (profile: UserProfile) => void
    setActiveRoomId: (roomId: string | null) => void
    setIsHost: (isHost: boolean) => void
    resetSession: () => void
}

export const useSessionStore = create<SessionState>()(
    persist(
        (set) => ({
            userProfile: { name: '' },
            activeRoomId: null,
            isHost: false,

            setUserProfile: (userProfile) => set({ userProfile }),
            setActiveRoomId: (activeRoomId) => set({ activeRoomId }),
            setIsHost: (isHost) => set({ isHost }),
            resetSession: () => set({ activeRoomId: null, isHost: false }),
        }),
        {
            name: 'satloom-session',
        }
    )
)
