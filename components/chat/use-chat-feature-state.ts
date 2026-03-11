import { useState } from "react"
import { CallData } from "@/utils/infra/call-signaling"
import { TheaterSession, TheaterInvite } from "@/utils/infra/theater-signaling"
import { KaraokeInvite } from "@/utils/games/karaoke"
import { VanishModeType } from "@/utils/infra/vanish-mode"
import { QuizSession, QuizAnswer, QuizResult } from "@/utils/games/quiz-system"
import { GameInvite } from "@/utils/infra/game-signaling"
import { WhiteboardInvite } from "@/utils/infra/whiteboard-signaling"
import { Message } from "../message-bubble"

export function useChatFeatureState(initialAvatar?: string) {
    // Call-related
    const [incomingCall, setIncomingCall] = useState<CallData | null>(null)
    const [currentCall, setCurrentCall] = useState<CallData | null>(null)
    const [isInCall, setIsInCall] = useState(false)

    // Knock Knock
    const [knockKnockCaller, setKnockKnockCaller] = useState<string>("")
    const [knockKnockCallType, setKnockKnockCallType] = useState<"audio" | "video">("video")

    // Theater
    const [currentTheaterSession, setCurrentTheaterSession] = useState<TheaterSession | null>(null)
    const [theaterInvite, setTheaterInvite] = useState<TheaterInvite | null>(null)
    const [isTheaterHost, setIsTheaterHost] = useState(false)

    // Quiz
    const [currentQuizSession, setCurrentQuizSession] = useState<QuizSession | null>(null)
    const [quizAnswers, setQuizAnswers] = useState<QuizAnswer[]>([])
    const [quizResults, setQuizResults] = useState<QuizResult[]>([])
    const [quizTimeRemaining, setQuizTimeRemaining] = useState(0)
    const [userQuizAnswer, setUserQuizAnswer] = useState<string>("")

    // Mood & Profile
    const [currentUserMood, setCurrentUserMood] = useState<{ emoji: string; text: string } | null>(null)
    const [userAvatar, setUserAvatar] = useState<string | undefined>(initialAvatar)
    const [moodBackgroundImage, setMoodBackgroundImage] = useState<string | null>(null)
    const [moodBackgroundMusic, setMoodBackgroundMusic] = useState<string | null>(null)
    const [moodPlaylist, setMoodPlaylist] = useState<string[]>([])

    // Game & Invite
    const [gameInvite, setGameInvite] = useState<GameInvite | null>(null)
    const [mafiaConfig, setMafiaConfig] = useState<any>(null)

    // Feature Data
    const [currentKaraokeSession, setCurrentKaraokeSession] = useState<any>(null)
    const [karaokeInvite, setKaraokeInvite] = useState<KaraokeInvite | null>(null)
    const [currentPresentationId, setCurrentPresentationId] = useState<string | null>(null)
    const [presentationInvite, setPresentationInvite] = useState<{ presentationId: string; hostName: string; hostId: string } | null>(null)
    const [whiteboardInvite, setWhiteboardInvite] = useState<WhiteboardInvite | null>(null)
    const [vanishMode, setVanishMode] = useState<VanishModeType>("off")
    const [vanishDuration, setVanishDuration] = useState(30000)

    // Pinned Message
    const [pinnedMessageId, setPinnedMessageId] = useState<string | null>(null)
    const [pinnedMessage, setPinnedMessage] = useState<Message | null>(null)

    // Password & Security
    const [passwordValidated, setPasswordValidated] = useState(false)
    const [roomIsProtected, setRoomIsProtected] = useState(false)

    // Pending file for preview
    const [pendingChatFile, setPendingChatFile] = useState<{ type: string; file: File } | null>(null)

    return {
        incomingCall, setIncomingCall,
        currentCall, setCurrentCall,
        isInCall, setIsInCall,
        knockKnockCaller, setKnockKnockCaller,
        knockKnockCallType, setKnockKnockCallType,
        currentTheaterSession, setCurrentTheaterSession,
        theaterInvite, setTheaterInvite,
        isTheaterHost, setIsTheaterHost,
        currentQuizSession, setCurrentQuizSession,
        quizAnswers, setQuizAnswers,
        quizResults, setQuizResults,
        quizTimeRemaining, setQuizTimeRemaining,
        userQuizAnswer, setUserQuizAnswer,
        currentUserMood, setCurrentUserMood,
        userAvatar, setUserAvatar,
        moodBackgroundImage, setMoodBackgroundImage,
        moodBackgroundMusic, setMoodBackgroundMusic,
        moodPlaylist, setMoodPlaylist,
        gameInvite, setGameInvite,
        mafiaConfig, setMafiaConfig,
        currentKaraokeSession, setCurrentKaraokeSession,
        karaokeInvite, setKaraokeInvite,
        currentPresentationId, setCurrentPresentationId,
        presentationInvite, setPresentationInvite,
        whiteboardInvite, setWhiteboardInvite,
        pinnedMessageId, setPinnedMessageId,
        pinnedMessage, setPinnedMessage,
        passwordValidated, setPasswordValidated,
        roomIsProtected, setRoomIsProtected,
        pendingChatFile, setPendingChatFile,
        vanishMode, setVanishMode,
        vanishDuration, setVanishDuration,
    }
}
