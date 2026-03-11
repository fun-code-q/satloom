"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import { ref, onValue, set, remove } from "firebase/database"
import { getFirebaseDatabase } from "../../lib/firebase"
import { NotificationSystem } from "@/utils/core/notification-system"
import { UserPresenceSystem } from "@/utils/infra/user-presence"
import { CallSignaling } from "@/utils/infra/call-signaling"
import { TheaterSignaling, type TheaterSession } from "@/utils/infra/theater-signaling"
import { QuizSystem, type QuizSession } from "@/utils/games/quiz-system"
import { karaokeManager, type KaraokeSong } from "@/utils/games/karaoke"
import { presentationModeManager } from "@/utils/infra/presentation-mode"
import type { GameConfig } from "../playground-setup-modal"
import type { GameInvite } from "@/utils/infra/game-signaling"
import { ChessManager } from "@/utils/games/chess-manager"
import { TicTacToeManager } from "@/utils/games/tic-tac-toe"
import { ConnectFourManager } from "@/utils/games/connect-four"
import { DotsBoxesManager } from "@/utils/games/dots-boxes-manager"
import type { MenuGroup } from "./chat-types"
import { telemetry } from "@/utils/core/telemetry"
import {
    Phone, Video, Monitor, Camera, BellRing, UserPlus, Users,
    Film, Music, Volume2,
    Gamepad2, Ghost, Zap, Dices, Shuffle, Palette, Calendar, BarChart2,
    MonitorPlay, FileText, CheckSquare, Globe, Share2,
    Briefcase, Link, Shield, Settings, ShieldCheck, Info,
} from "lucide-react"

interface UseChatCallsParams {
    roomId: string
    userProfile: { name: string; avatar?: string }
    currentUserId: string
    isHost: boolean
    onlineUsersCount: number
    // Call state & setters
    incomingCall: any
    currentCall: any
    isInCall: boolean
    currentTheaterSession: TheaterSession | null
    isTheaterHost: boolean
    theaterInvite: any
    gameInvite: GameInvite | null
    currentQuizSession: QuizSession | null
    quizTimeRemaining: number
    userQuizAnswer: string
    currentKaraokeSession: any
    presentationInvite: { presentationId: string; hostName: string; hostId: string } | null
    playgroundGame: "dots" | "chess" | "tictactoe" | "connect4"
    // Setters
    setShowAudioCall: (val: boolean) => void
    setShowVideoCall: (val: boolean) => void
    setIsInCall: (val: boolean) => void
    setIncomingCall: (val: any) => void
    setCurrentCall: (val: any) => void
    setShowTheaterSetup: (val: boolean) => void
    setShowTheaterFullscreen: (val: boolean) => void
    setCurrentTheaterSession: (val: any) => void
    setTheaterInvite: (val: any) => void
    setIsTheaterHost: (val: boolean) => void
    setShowPlaygroundSetup: (val: boolean) => void
    setShowPlayground: (val: boolean) => void
    setPlaygroundConfig: (val: any) => void
    setPlaygroundGame: (val: "dots" | "chess" | "tictactoe" | "connect4") => void
    setGameInvite: (val: any) => void
    setActiveGame: (val: any) => void
    setShowKaraokeSetup: (val: boolean) => void
    setCurrentKaraokeSession: (val: any) => void
    setShowQuizSetup: (val: boolean) => void
    setCurrentQuizSession: (val: any) => void
    setQuizAnswers: (val: any) => void
    setQuizResults: (val: any) => void
    setQuizTimeRemaining: (val: any) => void
    setUserQuizAnswer: (val: string) => void
    setShowQuizResults: (val: boolean) => void
    setShowGameMenu: (val: boolean) => void
    setShowSoundboard: (val: boolean) => void
    setShowMafiaSetup: (val: boolean) => void
    setShowRemoteBuzzer: (val: boolean) => void
    setShowBingoSetup: (val: boolean) => void
    setShowRandomMatch: (val: boolean) => void
    setShowWhiteboard: (val: boolean) => void
    setShowPresentationSetup: (val: boolean) => void
    setShowPresentationViewer: (val: boolean) => void
    setCurrentPresentationId: (val: string | null) => void
    setShowSharedNotes: (val: boolean) => void
    setShowSharedTaskList: (val: boolean) => void
    setShowBreakoutRooms: (val: boolean) => void
    setShowBurnerLink: (val: boolean) => void
    setShowGifAvatar: (val: boolean) => void
    setShowHostPassword: (val: boolean) => void
    setShowSettings: (val: boolean) => void
    setShowMoodSetup: (val: boolean) => void
    setShowPrivacyPolicy: (val: boolean) => void
    setShowTermsOfService: (val: boolean) => void
    setShowAbout: (val: boolean) => void
    setPresentationInvite: (val: any) => void
    quizTimerRef: React.MutableRefObject<any>
    handleCopyRoomLink: () => void
}

export function useChatCalls(params: UseChatCallsParams) {
    const {
        roomId, userProfile, currentUserId, isHost,
        incomingCall, currentCall, isInCall,
        currentTheaterSession, isTheaterHost, theaterInvite, gameInvite,
        currentQuizSession, quizTimeRemaining, userQuizAnswer, currentKaraokeSession,
    } = params

    const notificationSystem = NotificationSystem.getInstance()
    const userPresence = UserPresenceSystem.getInstance()
    const callSignaling = CallSignaling.getInstance()
    const theaterSignaling = TheaterSignaling.getInstance()
    const quizSystem = QuizSystem.getInstance()

    // --- Call handlers ---
    const handleStartAudioCall = useCallback(async () => {
        try {
            console.log("Starting audio call...")
            notificationSystem.info("Initializing audio call...")
            const callId = await callSignaling.startCall(roomId, userProfile.name, currentUserId, "audio")
            console.log("Audio call started with ID:", callId)
            telemetry.logEvent('call_started', roomId, currentUserId, userProfile.name, { type: 'audio' })
            params.setShowAudioCall(true)
            params.setIsInCall(true)
            userPresence.updateActivity(roomId, currentUserId, "call")
        } catch (error) {
            console.error("Error starting audio call:", error)
            notificationSystem.error("Failed to start audio call")
        }
    }, [roomId, userProfile.name, currentUserId, params.setShowAudioCall, params.setIsInCall])

    const handleAnswerCall = useCallback(() => {
        if (incomingCall) {
            console.log("Answering call:", incomingCall.id)
            params.setCurrentCall(incomingCall)
            params.setIncomingCall(null)

            // Accept the signaling immediately
            callSignaling.answerCall(roomId, incomingCall.id, currentUserId)

            if (incomingCall.type === "video") {
                params.setShowVideoCall(true)
            } else {
                params.setShowAudioCall(true)
            }
            params.setIsInCall(true)
            userPresence.updateActivity(roomId, currentUserId, incomingCall.type === "video" ? "video-call" : "call")
        }
    }, [roomId, currentUserId, incomingCall, params.setCurrentCall, params.setIncomingCall, params.setShowVideoCall, params.setShowAudioCall, params.setIsInCall])

    const handleDeclineCall = useCallback(() => {
        if (incomingCall) {
            console.log("Declining call:", incomingCall.id)
            callSignaling.endCall(roomId, incomingCall.id)
            params.setIncomingCall(null)
        }
    }, [roomId, incomingCall, params.setIncomingCall])

    const handleEndCall = useCallback(() => {
        console.log("Ending current call...")
        if (currentCall) {
            callSignaling.endCall(roomId, currentCall.id)
        }
        params.setShowAudioCall(false)
        params.setCurrentCall(null)
        params.setIsInCall(false)
        userPresence.updateActivity(roomId, currentUserId, "chat")
    }, [roomId, currentUserId, currentCall, params.setShowAudioCall, params.setCurrentCall, params.setIsInCall])

    const handleStartVideoCall = useCallback(async () => {
        try {
            console.log("Starting video call...")
            notificationSystem.info("Initializing video call...")
            const callId = await callSignaling.startCall(roomId, userProfile.name, currentUserId, "video")
            console.log("Video call started with ID:", callId)
            telemetry.logEvent('call_started', roomId, currentUserId, userProfile.name, { type: 'video' })
            params.setShowVideoCall(true)
            params.setIsInCall(true)
            userPresence.updateActivity(roomId, currentUserId, "video-call")
        } catch (error) {
            console.error("Error starting video call:", error)
            notificationSystem.error("Failed to start video call")
        }
    }, [roomId, userProfile.name, currentUserId, params.setShowVideoCall, params.setIsInCall])

    const handleAnswerVideoCall = useCallback(() => {
        if (incomingCall && incomingCall.type === "video") {
            console.log("Answering video call:", incomingCall.id)
            params.setCurrentCall(incomingCall)
            params.setIncomingCall(null)

            // Accept the signaling immediately
            callSignaling.answerCall(roomId, incomingCall.id, currentUserId)

            params.setShowVideoCall(true)
            params.setIsInCall(true)
            userPresence.updateActivity(roomId, currentUserId, "video-call")
        }
    }, [roomId, currentUserId, incomingCall, params.setCurrentCall, params.setIncomingCall, params.setShowVideoCall, params.setIsInCall])

    const handleEndVideoCall = useCallback(() => {
        console.log("Ending video call...")
        if (currentCall) {
            callSignaling.endCall(roomId, currentCall.id)
        }
        params.setShowVideoCall(false)
        params.setCurrentCall(null)
        params.setIsInCall(false)
        userPresence.updateActivity(roomId, currentUserId, "chat")
    }, [roomId, currentUserId, currentCall, params.setShowVideoCall, params.setCurrentCall, params.setIsInCall])

    const handleSwitchCallType = useCallback(async (type: "audio" | "video") => {
        if (currentCall) {
            try {
                await callSignaling.switchCallType(roomId, currentCall.id, type)
                telemetry.logEvent('call_type_switched', roomId, currentUserId, userProfile.name, { from: currentCall.type, to: type })
            } catch (error) {
                console.error("Error switching call type:", error)
                notificationSystem.error(`Failed to switch to ${type} call`)
            }
        }
    }, [roomId, currentUserId, currentCall, userProfile.name])

    const [pendingMediaFile, setPendingMediaFile] = useState<File | null>(null)

    // --- Theater handlers ---
    const handleStartTheater = useCallback(() => {
        params.setShowTheaterSetup(true)
    }, [])

    const handleCreateTheaterSession = useCallback(async (
        videoUrl: string,
        videoType: "direct" | "youtube" | "vimeo" | "twitch" | "dailymotion" | "archive" | "webrtc",
        file?: File
    ) => {
        try {
            if (file) {
                setPendingMediaFile(file)
            } else {
                setPendingMediaFile(null)
            }

            const sessionId = await theaterSignaling.createSession(roomId, userProfile.name, currentUserId, videoUrl, videoType)
            const videoTitle = file ? file.name : (videoUrl.includes("youtube") ? "YouTube Video" :
                videoUrl.includes("vimeo") ? "Vimeo Video" :
                    videoUrl.includes("twitch") ? "Twitch Stream" :
                        videoUrl.includes("dailymotion") ? "Dailymotion Video" : "Video")
            await theaterSignaling.sendInvite(roomId, sessionId, userProfile.name, currentUserId, videoTitle)
            telemetry.logEvent('theater_started', roomId, currentUserId, userProfile.name, { title: videoTitle, url: videoUrl, type: videoType })
            const session = theaterSignaling.getCurrentSession()
            if (session) {
                params.setCurrentTheaterSession(session)
                params.setIsTheaterHost(true)
                params.setShowTheaterFullscreen(true)
                userPresence.updateActivity(roomId, currentUserId, "theater")
            }
        } catch (error) {
            console.error("Error creating theater session:", error)
            notificationSystem.error("Failed to create theater session")
        }
    }, [roomId, userProfile.name, currentUserId])

    const handleAcceptTheaterInvite = useCallback(async () => {
        if (!theaterInvite) return
        try {
            await theaterSignaling.joinSession(roomId, theaterInvite.sessionId, currentUserId)
            theaterSignaling.listenForSession(roomId, theaterInvite.sessionId, (session) => {
                params.setCurrentTheaterSession(session)
                params.setShowTheaterFullscreen(true)
                userPresence.updateActivity(roomId, currentUserId, "theater")
            })
            params.setIsTheaterHost(false)
            params.setTheaterInvite(null)
        } catch (error) {
            console.error("Error joining theater session:", error)
            notificationSystem.error("Failed to join theater session")
        }
    }, [roomId, currentUserId, theaterInvite])

    const handleDeclineTheaterInvite = useCallback(() => {
        params.setTheaterInvite(null)
    }, [])

    const handleExitTheater = useCallback(async () => {
        if (currentTheaterSession && isTheaterHost) {
            await theaterSignaling.endSession(roomId, currentTheaterSession.id)
        }
        params.setShowTheaterFullscreen(false)
        params.setCurrentTheaterSession(null)
        params.setIsTheaterHost(false)
        userPresence.updateActivity(roomId, currentUserId, "chat")
    }, [roomId, currentUserId, currentTheaterSession, isTheaterHost])

    // --- Game handlers ---
    const sendGameInvite = useCallback(async (config: GameConfig) => {
        const db = getFirebaseDatabase()
        if (!db || !roomId) return
        const inviteId = `invite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const invite: GameInvite = {
            id: inviteId, roomId,
            gameId: (config as any).gameId || "",
            hostId: currentUserId, hostName: userProfile.name,
            invitedUsers: ["all"], gameConfig: config as any,
            expiresAt: Date.now() + 30000, status: "pending", timestamp: Date.now(),
        }
        const inviteRef = ref(db, `gameInvites/${roomId}/${inviteId}`)
        await set(inviteRef, invite)
        setTimeout(async () => { try { await remove(inviteRef) } catch (e) { } }, 30000)
    }, [roomId, currentUserId, userProfile.name])

    const handleOpenPlayground = useCallback((type?: "dots" | "chess" | "tictactoe" | "connect4") => {
        if (type) params.setPlaygroundGame(type)
        params.setShowPlaygroundSetup(true)
    }, [params.setPlaygroundGame, params.setShowPlaygroundSetup])

    const handleStartPlayground = useCallback(async (config: GameConfig) => {
        const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const configWithId = { ...config, gameId }
        if (config.gameType === "single") {
            params.setPlaygroundConfig(configWithId as any)
            params.setShowPlaygroundSetup(false)
            params.setShowPlayground(true)
            userPresence.updateActivity(roomId, currentUserId, "game")
        } else {
            await sendGameInvite(configWithId)
            params.setPlaygroundConfig(configWithId as any)
            params.setShowPlaygroundSetup(false)
            params.setShowPlayground(true)
            userPresence.updateActivity(roomId, currentUserId, "game")
            telemetry.logEvent('game_started', roomId, currentUserId, userProfile.name, { game: config.gameType, mode: config.gameType })
        }
    }, [roomId, currentUserId, sendGameInvite])

    const handleAcceptGameInvite = useCallback(async (guestName?: string) => {
        if (gameInvite) {
            const updatedConfig = { ...gameInvite.gameConfig } as any
            if (guestName && updatedConfig.players && updatedConfig.players.length > 1) {
                const newPlayers = [...updatedConfig.players]
                newPlayers[1] = {
                    ...newPlayers[1],
                    id: currentUserId,
                    name: guestName,
                    isComputer: false
                }
                updatedConfig.players = newPlayers
            }

            // Register guest in the database session
            try {
                if (gameInvite.gameId) {
                    const gameType = updatedConfig.selectedGame || params.playgroundGame
                    if (gameType === "chess") {
                        await ChessManager.getInstance().joinGame(roomId, gameInvite.gameId, currentUserId, guestName || userProfile.name, userProfile.avatar)
                    } else if (gameType === "tictactoe") {
                        await TicTacToeManager.getInstance().joinGame(roomId, gameInvite.gameId, currentUserId, guestName || userProfile.name, userProfile.avatar)
                    } else if (gameType === "connect4") {
                        await ConnectFourManager.getInstance().joinGame(roomId, gameInvite.gameId, currentUserId, guestName || userProfile.name, userProfile.avatar)
                    } else if (gameType === "dots") {
                        await DotsBoxesManager.getInstance().joinGame(roomId, gameInvite.gameId, currentUserId, guestName || userProfile.name, userProfile.avatar)
                    }
                }
            } catch (error) {
                console.error("Error joining game in database:", error)
            }

            params.setPlaygroundConfig(updatedConfig)
            params.setShowPlayground(true)
            params.setGameInvite(null)
            userPresence.updateActivity(roomId, currentUserId, "game")
        }
    }, [roomId, currentUserId, gameInvite, userProfile, params.playgroundGame])

    const handleDeclineGameInvite = useCallback(() => {
        params.setGameInvite(null)
    }, [])

    const handleExitPlayground = useCallback(() => {
        params.setShowPlayground(false)
        params.setPlaygroundConfig(null)
        userPresence.updateActivity(roomId, currentUserId, "chat")
    }, [roomId, currentUserId])

    const listenForGameInvites = useCallback(() => {
        const db = getFirebaseDatabase()
        if (!db || !roomId) return () => { }
        const gameInvitesRef = ref(db, `gameInvites/${roomId}`)
        const unsubscribe = onValue(gameInvitesRef, (snapshot: any) => {
            const invites = snapshot.val()
            if (invites) {
                Object.values(invites).forEach((invite: any) => {
                    if (invite.hostId !== currentUserId && !gameInvite) {
                        params.setGameInvite(invite as any)
                        notificationSystem.success(`${invite.hostName} invited you to play ${invite.gameConfig.gameType} game!`)
                    }
                })
            }
        })
        return () => unsubscribe()
    }, [roomId, currentUserId, gameInvite])

    // --- Karaoke handlers ---
    const handleStartKaraoke = useCallback(async (song: KaraokeSong) => {
        try {
            karaokeManager.initialize(roomId, currentUserId, userProfile.name)
            const session = await karaokeManager.createSession(song)
            if (session) {
                params.setCurrentKaraokeSession(session)
                await karaokeManager.startSession()
                telemetry.logEvent('karaoke_started', roomId, currentUserId, userProfile.name, { song: song.title })
                notificationSystem.success(`Karaoke started: ${song.title}`)
            }
        } catch (error) {
            console.error("Error starting karaoke:", error)
            notificationSystem.error("Failed to start karaoke session")
        }
    }, [roomId, currentUserId, userProfile.name])

    const handleExitKaraoke = useCallback(() => {
        params.setCurrentKaraokeSession(null)
        notificationSystem.success("Karaoke ended")
    }, [])

    // --- Quiz handlers ---
    const startQuizTimer = useCallback((timePerQuestion: number) => {
        params.setQuizTimeRemaining(timePerQuestion)
        if (params.quizTimerRef.current) {
            clearInterval(params.quizTimerRef.current)
        }
        params.quizTimerRef.current = setInterval(() => {
            params.setQuizTimeRemaining((prev: number) => {
                if (prev <= 1) {
                    handleQuizTimeout()
                    return 0
                }
                return prev - 1
            })
        }, 1000)
    }, [])

    const handleQuizTimeout = useCallback(() => {
        if (params.quizTimerRef.current) {
            clearInterval(params.quizTimerRef.current)
        }
        if (currentQuizSession) {
            handleNextQuestion()
        }
    }, [currentQuizSession])

    const handleStartQuiz = useCallback(async (topic?: string) => {
        try {
            const sessionId = await quizSystem.createQuizSession(roomId, currentUserId, userProfile.name, topic)
            setTimeout(() => { quizSystem.startQuiz(roomId, sessionId) }, 1000)
            telemetry.logEvent('quiz_started', roomId, currentUserId, userProfile.name, { topic: topic || 'random' })
            userPresence.updateActivity(roomId, currentUserId, "game")
            notificationSystem.success(topic ? `${topic} quiz started!` : "Random quiz started!")
        } catch (error) {
            console.error("Error starting quiz:", error)
            notificationSystem.error("Failed to start quiz")
        }
    }, [roomId, currentUserId, userProfile.name])

    const handleQuizAnswer = useCallback(async (answer: string) => {
        if (!currentQuizSession || userQuizAnswer) return
        const currentQuestion = currentQuizSession.questions[currentQuizSession.currentQuestionIndex]
        const timeToAnswer = 10 - quizTimeRemaining
        params.setUserQuizAnswer(answer)
        try {
            await quizSystem.submitAnswer(roomId, currentQuizSession.id, currentUserId, userProfile.name, currentQuestion.id, answer, currentQuestion.correctAnswer, timeToAnswer)
        } catch (error) {
            console.error("Error submitting quiz answer:", error)
        }
    }, [roomId, currentUserId, userProfile.name, currentQuizSession, quizTimeRemaining, userQuizAnswer])

    const handleNextQuestion = useCallback(async () => {
        if (!currentQuizSession) return
        params.setShowQuizResults(true)
        setTimeout(async () => {
            params.setShowQuizResults(false)
            params.setUserQuizAnswer("")
            if (currentQuizSession.currentQuestionIndex + 1 >= currentQuizSession.totalQuestions) {
                await quizSystem.endQuiz(roomId, currentQuizSession.id)
            } else {
                await quizSystem.nextQuestion(roomId, currentQuizSession.id, currentQuizSession.currentQuestionIndex)
            }
        }, 3000)
    }, [roomId, currentQuizSession])

    const handleQuizFinished = useCallback(async (sessionId: string) => {
        if (params.quizTimerRef.current) {
            clearInterval(params.quizTimerRef.current)
        }
        try {
            const results = await quizSystem.calculateResults(roomId, sessionId)
            params.setQuizResults(results)
            setTimeout(() => {
                params.setCurrentQuizSession(null)
                params.setQuizAnswers([])
                params.setQuizResults([])
                params.setUserQuizAnswer("")
                params.setShowQuizResults(false)
            }, 15000)
        } catch (error) {
            console.error("Error calculating quiz results:", error)
        }
    }, [roomId])

    const handleExitQuiz = useCallback(async () => {
        if (params.quizTimerRef.current) {
            clearInterval(params.quizTimerRef.current)
        }
        if (currentQuizSession) {
            try {
                await quizSystem.endQuiz(roomId, currentQuizSession.id)
                await quizSystem.cleanupQuizSession(roomId, currentQuizSession.id)
            } catch (error) {
                console.error("Error exiting quiz:", error)
            }
        }
        params.setCurrentQuizSession(null)
        params.setQuizAnswers([])
        params.setQuizResults([])
        params.setUserQuizAnswer("")
        params.setShowQuizResults(false)
        params.setQuizTimeRemaining(0)
        userPresence.updateActivity(roomId, currentUserId, "chat")
        notificationSystem.success("Quiz exited")
    }, [roomId, currentQuizSession])

    // --- Presentation handlers ---
    const handleAcceptPresentationInvite = useCallback(async () => {
        if (!params.presentationInvite) return
        const invite = params.presentationInvite
        try {
            presentationModeManager.initialize(roomId, currentUserId, userProfile.name)
            presentationModeManager.listenForPresentation(invite.presentationId)
            presentationModeManager.joinPresentation(invite.presentationId)
            params.setCurrentPresentationId(invite.presentationId)
            params.setShowPresentationViewer(true)
            params.setPresentationInvite(null)
            userPresence.updateActivity(roomId, currentUserId, "presentation")
        } catch (error) {
            console.error("Error joining presentation:", error)
            notificationSystem.error("Failed to join presentation")
        }
    }, [roomId, currentUserId, params.presentationInvite])

    const handleDeclinePresentationInvite = useCallback(() => {
        params.setPresentationInvite(null)
    }, [])

    // --- Menu groups ---
    const communicationGroup: MenuGroup = {
        label: "Communication",
        items: [
            { icon: Phone, label: "Audio Call", action: handleStartAudioCall },
            { icon: Video, label: "Video Call", action: handleStartVideoCall },
            {
                icon: Monitor, label: "Screen Share", action: () => {
                    if (params.isInCall) {
                        notificationSystem.info("Click the 'Monitor' icon inside the call window to share your screen.")
                    } else {
                        notificationSystem.info("Start a Video Call first to share your screen.")
                    }
                }
            },
        ]
    }

    const mediaGroup: MenuGroup = {
        label: "Media & Watch Together",
        items: [
            { icon: Palette, label: "Room Vibe", action: () => params.setShowMoodSetup(true) },
            { icon: Film, label: "Movie Theater", action: handleStartTheater },
            { icon: Music, label: "Karaoke", action: () => params.setShowKaraokeSetup(true) },
            { icon: Volume2, label: "Soundboard", action: () => params.setShowSoundboard(true) },
        ]
    }

    const gamesGroup: MenuGroup = {
        label: "Games & Entertainment",
        items: [
            { icon: Gamepad2, label: "Games Menu", action: () => params.setShowGameMenu(true) },
            { icon: Ghost, label: "Mafia/Werewolf", action: () => params.setShowMafiaSetup(true) },
            { icon: Zap, label: "Start Quiz", action: () => params.setShowQuizSetup(true) },
            { icon: Dices, label: "Buzzword Bingo", action: () => params.setShowBingoSetup(true) },
        ]
    }

    const productivityGroup: MenuGroup = {
        label: "Productivity & Collaboration",
        items: [
            { icon: MonitorPlay, label: "Whiteboard", action: () => params.setShowWhiteboard(true) },
            { icon: MonitorPlay, label: "Presentation", action: () => params.setShowPresentationSetup(true) },
            { icon: FileText, label: "Shared Notes", action: () => params.setShowSharedNotes(true) },
            { icon: CheckSquare, label: "Task List", action: () => params.setShowSharedTaskList(true) },
        ]
    }

    const settingsGroup: MenuGroup = {
        label: "Tools",
        items: [
            { icon: Briefcase, label: "Breakout Rooms", action: () => params.setShowBreakoutRooms(true) },
            { icon: Link, label: "Burner Links", action: () => params.setShowBurnerLink(true) },
            { icon: Shield, label: "Room Security", action: () => params.setShowHostPassword(true) },
            ...(params.onlineUsersCount <= 1 ? [{ icon: Shuffle, label: "Random Match", action: () => params.setShowRandomMatch(true) }] : []),
        ]
    }

    const appSettingsGroup: MenuGroup = {
        label: "Settings",
        items: [
            { icon: Settings, label: "Settings", action: () => params.setShowSettings(true) },
            { icon: ShieldCheck, label: "Privacy Policy", action: () => params.setShowPrivacyPolicy(true) },
            { icon: Shield, label: "Terms of Service", action: () => params.setShowTermsOfService(true) },
            { icon: Info, label: "About", action: () => params.setShowAbout(true) },
        ]
    }

    const menuGroups = [communicationGroup]

    return {
        // Call handlers
        handleStartAudioCall,
        handleAnswerCall, handleDeclineCall, handleEndCall,
        handleStartVideoCall, handleAnswerVideoCall, handleEndVideoCall,
        handleSwitchCallType,
        // Theater handlers
        handleStartTheater, handleCreateTheaterSession,
        handleAcceptTheaterInvite, handleDeclineTheaterInvite, handleExitTheater,
        // Game handlers
        listenForGameInvites, sendGameInvite,
        handleStartPlayground, handleAcceptGameInvite, handleDeclineGameInvite, handleExitPlayground, handleOpenPlayground,
        // Karaoke handlers
        handleStartKaraoke, handleExitKaraoke,
        // Quiz handlers
        startQuizTimer, handleStartQuiz, handleQuizAnswer,
        handleNextQuestion, handleQuizFinished, handleExitQuiz, handleQuizTimeout,
        // Presentation handlers
        handleAcceptPresentationInvite, handleDeclinePresentationInvite,
        // Menu groups
        communicationGroup, mediaGroup, gamesGroup, productivityGroup, settingsGroup, appSettingsGroup, menuGroups,
        pendingMediaFile, setPendingMediaFile
    }
}
