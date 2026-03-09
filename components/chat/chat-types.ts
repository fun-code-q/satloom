import type { LucideIcon } from "lucide-react"
import type { CallData } from "@/utils/infra/call-signaling"
import type { TheaterSession, TheaterInvite } from "@/utils/infra/theater-signaling"
import type { GameConfig } from "../playground-setup-modal"
import type { QuizSession, QuizAnswer, QuizResult } from "@/utils/games/quiz-system"
import type { Message } from "../message-bubble"
import type { UserPresence } from "@/utils/infra/user-presence"
import type { GameInvite } from "@/utils/infra/game-signaling"

export interface ChatInterfaceProps {
    roomId: string
    userProfile: { name: string; avatar?: string; currentActivity?: "chat" | "game" | "theater" }
    onLeave: () => void
}

export interface MenuItem {
    icon: LucideIcon
    label: string
    action: () => void
}

export interface MenuGroup {
    label: string
    items: MenuItem[]
}

// All the state that the ChatInterface manages
export interface ChatState {
    // Game
    showGameMenu: boolean
    activeGame: { type: "chess" | "connect4" | "tictactoe"; id: string } | null

    // Dropdown states
    isMenuOpen: boolean
    isMediaMenuOpen: boolean
    isGamesMenuOpen: boolean
    isProductivityMenuOpen: boolean
    isSettingsMenuOpen: boolean
    showAudioCall: boolean
    showSettings: boolean
    showAbout: boolean
    showMediaRecorder: boolean
    mediaRecorderMode: "audio" | "video" | "photo"

    // Call-related
    incomingCall: CallData | null
    currentCall: CallData | null
    isInCall: boolean
    showVideoCall: boolean

    // Knock Knock
    showKnockKnock: boolean
    knockKnockCaller: string
    knockKnockCallType: "audio" | "video"

    // Playground
    showPlaygroundSetup: boolean
    showPlayground: boolean
    playgroundConfig: GameConfig | null

    // Game invite
    gameInvite: GameInvite | null

    // Theater
    showTheaterSetup: boolean
    showTheaterFullscreen: boolean
    currentTheaterSession: TheaterSession | null
    theaterInvite: TheaterInvite | null
    isTheaterHost: boolean

    // Pinned Message
    pinnedMessageId: string | null
    pinnedMessage: Message | null

    // Whiteboard & Leave
    showWhiteboard: boolean
    showLeaveConfirmation: boolean
    isHost: boolean

    // Quiz
    showQuizSetup: boolean
    showMoodSetup: boolean
    currentQuizSession: QuizSession | null
    quizAnswers: QuizAnswer[]
    quizResults: QuizResult[]
    quizTimeRemaining: number
    userQuizAnswer: string
    showQuizResults: boolean

    // Mood & Emoji
    currentUserMood: { emoji: string; text: string } | null
    isMoodSelectorOpen: boolean
    showEmojiPicker: boolean

    // Soundboard
    showSoundboard: boolean

    // Password
    showPasswordEntry: boolean
    showHostPassword: boolean
    roomIsProtected: boolean
    passwordValidated: boolean
    moodBackgroundImage: string | null
    moodBackgroundMusic: string | null

    // Karaoke
    showKaraokeSetup: boolean
    currentKaraokeSession: any

    // Mafia
    showMafiaSetup: boolean
    showMafiaGame: boolean
    mafiaConfig: any

    // Other features
    showSharedNotes: boolean
    showSharedTaskList: boolean
    showRemoteBuzzer: boolean
    showRandomMatch: boolean
    showBingoSetup: boolean
    showBingoGame: boolean
    bingoGameId: string | null
    showPresentationSetup: boolean
    showPresentationViewer: boolean
    currentPresentationId: string | null
    showAudioEmoji: boolean
    showBurnerLink: boolean
    showGifAvatar: boolean
    userAvatar: string | undefined
    showFakeAmbientAudio: boolean
    showBreakoutRooms: boolean
    showPrivacyPolicy: boolean
    showTermsOfService: boolean
}
