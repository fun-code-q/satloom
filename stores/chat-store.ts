import { create } from 'zustand'
import { Message } from '@/components/message-bubble'
import { UserPresence } from '@/utils/infra/user-presence'

interface ChatState {
    roomId: string | null
    currentUser: { name: string; avatar?: string } | null
    messages: Message[]
    onlineUsers: UserPresence[]
    replyingTo: Message | null
    isTyping: boolean
    searchQuery: string
    hasUnreadNotes: boolean
    hasUnreadTasks: boolean

    // Actions
    setRoomId: (id: string) => void
    setCurrentUser: (user: { name: string; avatar?: string }) => void
    setMessages: (messages: Message[]) => void
    addMessage: (message: Message) => void
    setOnlineUsers: (users: UserPresence[]) => void
    setReplyingTo: (message: Message | null) => void
    setIsTyping: (isTyping: boolean) => void
    setSearchQuery: (query: string) => void
    setHasUnreadNotes: (val: boolean) => void
    setHasUnreadTasks: (val: boolean) => void
    reset: () => void
}

export const useChatStore = create<ChatState>((set) => ({
    roomId: null,
    currentUser: null,
    messages: [],
    onlineUsers: [],
    replyingTo: null,
    isTyping: false,
    searchQuery: "",
    hasUnreadNotes: false,
    hasUnreadTasks: false,

    setRoomId: (roomId) => set({ roomId }),
    setCurrentUser: (currentUser) => set({ currentUser }),
    setMessages: (messages) => set({ messages }),
    addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
    setOnlineUsers: (onlineUsers) => set({ onlineUsers }),
    setReplyingTo: (replyingTo) => set({ replyingTo }),
    setIsTyping: (isTyping) => set({ isTyping }),
    setSearchQuery: (searchQuery) => set({ searchQuery }),
    setHasUnreadNotes: (hasUnreadNotes) => set({ hasUnreadNotes }),
    setHasUnreadTasks: (hasUnreadTasks) => set({ hasUnreadTasks }),
    reset: () => set({
        roomId: null,
        messages: [],
        onlineUsers: [],
        replyingTo: null,
        isTyping: false,
        searchQuery: "",
        hasUnreadNotes: false,
        hasUnreadTasks: false
    })
}))
