"use client"

import { useState, useCallback, useEffect, useRef } from "react"
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
import { gameSeriesManager, type GameSeries, type GameSeriesMatch } from "@/utils/games/game-series-manager"
import type { UserPresence } from "@/utils/infra/user-presence"
import type { RoomMember } from "@/stores/chat-store"
import {
    Phone, Video, Monitor, Camera, BellRing, UserPlus, Users,
    Film, Music, Volume2, Music2,
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
    onlineUsers: UserPresence[]
    roomMembers: RoomMember[]
    // Call state & setters
    incomingCall: any
    currentCall: any
    isInCall: boolean
    currentTheaterSession: TheaterSession | null
    isTheaterHost: boolean
    theaterInvite: any
    gameInvite: GameInvite | null
    activeGameSeries: GameSeries | null
    currentQuizSession: QuizSession | null
    quizTimeRemaining: number
    userQuizAnswer: string
    karaokeInvite: any
    setKaraokeInvite: (invite: any) => void
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
    setActiveGameSeries: (val: GameSeries | null) => void
    setShowGameSeriesViewer: (val: boolean) => void
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
    setPendingScreenStream: (stream: MediaStream | null) => void
}

export function useChatCalls(params: UseChatCallsParams) {
    const {
        roomId, userProfile, currentUserId, isHost,
        incomingCall, currentCall, isInCall,
        currentTheaterSession, isTheaterHost, theaterInvite, gameInvite, activeGameSeries,
        currentQuizSession, quizTimeRemaining, userQuizAnswer, currentKaraokeSession,
    } = params

    const notificationSystem = NotificationSystem.getInstance()
    const userPresence = UserPresenceSystem.getInstance()
    const callSignaling = CallSignaling.getInstance()
    const theaterSignaling = TheaterSignaling.getInstance()
    const quizSystem = QuizSystem.getInstance()

    const toBoardType = useCallback((gameType: string): "chess" | "connect4" | "tictactoe" | null => {
        if (gameType === "chess") return "chess"
        if (gameType === "connect4") return "connect4"
        if (gameType === "tictactoe") return "tictactoe"
        return null
    }, [])

    const seriesBaseConfigRef = useRef<GameConfig | null>(null)
    const openedSeriesMatchRef = useRef<string | null>(null)
    const completedSeriesNoticeRef = useRef<string | null>(null)

    useEffect(() => {
        if (!roomId || !activeGameSeries?.id) return

        const unsubscribe = gameSeriesManager.listenForSeries(roomId, activeGameSeries.id, (series) => {
            params.setActiveGameSeries(series)
        })

        const sync = async () => {
            await gameSeriesManager.syncSeriesProgress(roomId, activeGameSeries.id)
        }
        sync()
        const timer = setInterval(sync, 5000)

        return () => {
            unsubscribe()
            clearInterval(timer)
        }
    }, [roomId, activeGameSeries?.id])

    useEffect(() => {
        if (!activeGameSeries) {
            openedSeriesMatchRef.current = null
            return
        }

        if (activeGameSeries.status === "completed") {
            if (completedSeriesNoticeRef.current === activeGameSeries.id) return
            completedSeriesNoticeRef.current = activeGameSeries.id
            if (activeGameSeries.finalWinnerId && activeGameSeries.finalWinnerId === currentUserId) {
                notificationSystem.success("Series completed. You are the winner.")
            } else if (activeGameSeries.finalWinnerName) {
                notificationSystem.info(`Series completed. Winner: ${activeGameSeries.finalWinnerName}`)
            }
            return
        }

        const assignedMatch = gameSeriesManager.getAssignedMatch(activeGameSeries, currentUserId)
        if (!assignedMatch || assignedMatch.winnerId) return
        if (openedSeriesMatchRef.current === assignedMatch.id) return

        const baseConfig = seriesBaseConfigRef.current || {
            gameType: assignedMatch.isComputerMatch ? "single" : "double",
            selectedGame: assignedMatch.gameType,
            players: [],
            difficulty: "medium",
            voiceChatEnabled: false,
            matchmakingMode: "series",
            seriesId: activeGameSeries.id,
            seriesRound: assignedMatch.round,
            maxPlayers: activeGameSeries.participants.length
        }

        const matchConfig = gameSeriesManager.toMatchConfig(
            {
                ...baseConfig,
                matchmakingMode: "series",
                seriesId: activeGameSeries.id,
                seriesRound: assignedMatch.round
            },
            assignedMatch,
            currentUserId
        )

        openedSeriesMatchRef.current = assignedMatch.id
        seriesBaseConfigRef.current = {
            ...baseConfig,
            selectedGame: matchConfig.selectedGame,
            gameType: matchConfig.gameType,
            players: matchConfig.players,
            gameId: matchConfig.gameId,
            matchmakingMode: "series",
            seriesId: activeGameSeries.id,
            seriesRound: assignedMatch.round,
            assignedMatchId: assignedMatch.id
        }

        params.setActiveGame(null)
        params.setPlaygroundConfig(matchConfig as any)
        params.setShowPlayground(true)
        params.setShowGameSeriesViewer(true)
        notificationSystem.info(`Round ${assignedMatch.round} match is ready`)
    }, [activeGameSeries?.id, activeGameSeries?.currentRound, activeGameSeries?.updatedAt, currentUserId])

    // --- Call handlers ---
    const handleStartAudioCall = useCallback(async () => {
        try {
            console.log("Starting audio call...")
            notificationSystem.info("Initializing audio call...")
            // Target all users in the room if no specific user is selected (room-wide call)
            const callId = await callSignaling.startCall(roomId, currentUserId, userProfile.name, "audio", "all")
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

            // Accept the signaling immediately with our name
            callSignaling.answerCall(roomId, incomingCall.id, currentUserId, userProfile.name)

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
            const callId = await callSignaling.startCall(roomId, currentUserId, userProfile.name, "video", "all")
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

            // Accept the signaling immediately with our name
            callSignaling.answerCall(roomId, incomingCall.id, currentUserId, userProfile.name)

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

    const handleStartScreenShareStandalone = useCallback(async () => {
        try {
            console.log("Starting standalone screen share...")
            notificationSystem.info("Requesting screen capture...")

            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: "always" } as any,
                audio: true
            })

            const sessionId = await theaterSignaling.createSession(
                roomId,
                userProfile.name,
                currentUserId,
                "screen://share",
                "webrtc"
            )

            await theaterSignaling.sendInvite(
                roomId,
                sessionId,
                userProfile.name,
                currentUserId,
                "Screen Share Session"
            )

            params.setPendingScreenStream(stream)

            const session = theaterSignaling.getCurrentSession()
            if (session) {
                params.setCurrentTheaterSession(session)
                params.setIsTheaterHost(true)
                params.setShowTheaterFullscreen(true)
                userPresence.updateActivity(roomId, currentUserId, "theater")
            }

            telemetry.logEvent('screen_share_started', roomId, currentUserId, userProfile.name)
            notificationSystem.success("Screen sharing started!")
        } catch (error) {
            console.error("Error starting screen share:", error)
            // notificationSystem.error("Failed to start screen share")
        }
    }, [roomId, userProfile.name, currentUserId, params])

    // --- Theater handlers ---
    const handleStartTheater = useCallback(() => {
        params.setShowTheaterSetup(true)
    }, [])

    const handleCreateTheaterSession = useCallback(async (
        videoUrl: string,
        videoType: "direct" | "youtube" | "vimeo" | "twitch" | "dailymotion" | "archive" | "soundcloud" | "webrtc",
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

        // Sanitize config to remove undefined values which Firebase rejects
        const sanitizedConfig = JSON.parse(JSON.stringify(config))

        const inviteId = `invite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const invite: GameInvite = {
            id: inviteId, roomId,
            gameId: (config as any).gameId || "",
            hostId: currentUserId, hostName: userProfile.name,
            invitedUsers: ["all"], gameConfig: sanitizedConfig,
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

    const maybeStartSeries = useCallback(async (baseConfig: GameConfig) => {
        if (!gameSeriesManager.supportsSeriesMode(baseConfig.selectedGame)) return false
        if (baseConfig.gameType !== "double") return false

        const participants = gameSeriesManager.buildParticipantsFromPresence(
            params.onlineUsers,
            currentUserId,
            userProfile.name,
            userProfile.avatar
        )

        if (participants.length <= 2) return false

        const seriesGameType = gameSeriesManager.getSeriesGameType(baseConfig.selectedGame)
        if (!seriesGameType) return false

        const series = await gameSeriesManager.createSeries(
            roomId,
            seriesGameType,
            currentUserId,
            userProfile.name,
            participants
        )
        if (!series) return false

        const seriesConfig: GameConfig = {
            ...baseConfig,
            matchmakingMode: "series",
            seriesId: series.id,
            seriesRound: 1,
            maxPlayers: participants.length
        }

        seriesBaseConfigRef.current = seriesConfig
        openedSeriesMatchRef.current = null
        completedSeriesNoticeRef.current = null

        await sendGameInvite(seriesConfig)

        params.setActiveGameSeries(series)
        params.setShowGameSeriesViewer(true)
        params.setShowPlaygroundSetup(false)
        params.setShowPlayground(false)

        const assignedMatch = gameSeriesManager.getAssignedMatch(series, currentUserId)
        if (assignedMatch) {
            const matchConfig = gameSeriesManager.toMatchConfig(seriesConfig, assignedMatch, currentUserId)
            openedSeriesMatchRef.current = assignedMatch.id
            params.setPlaygroundConfig(matchConfig as any)
            params.setActiveGame(null)
            params.setShowPlayground(true)
        }

        telemetry.logEvent("game_started", roomId, currentUserId, userProfile.name, {
            game: baseConfig.selectedGame,
            mode: "series",
            participants: participants.length
        })
        notificationSystem.success(`Series started with ${participants.length} players`)
        return true
    }, [roomId, currentUserId, userProfile.name, userProfile.avatar, params.onlineUsers, sendGameInvite, toBoardType])

    const handleStartPlayground = useCallback(async (config: GameConfig) => {
        const gameId = (config as any).gameId || `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const configWithId = { ...config, gameId, maxPlayers: config.maxPlayers || (config.gameType === "multi" ? 6 : 2) }
        if (config.gameType === "single") {
            params.setPlaygroundConfig(configWithId as any)
            params.setShowPlaygroundSetup(false)
            params.setShowPlayground(true)
            userPresence.updateActivity(roomId, currentUserId, "game")
        } else {
            const startedSeries = await maybeStartSeries(configWithId as GameConfig)
            if (startedSeries) {
                userPresence.updateActivity(roomId, currentUserId, "game")
                return
            }
            await sendGameInvite(configWithId)
            params.setPlaygroundConfig(configWithId as any)
            params.setShowPlaygroundSetup(false)
            params.setShowPlayground(true)
            userPresence.updateActivity(roomId, currentUserId, "game")
            telemetry.logEvent('game_started', roomId, currentUserId, userProfile.name, { game: config.gameType, mode: config.gameType })
        }
    }, [roomId, currentUserId, sendGameInvite, maybeStartSeries])

    const handleAcceptGameInvite = useCallback(async (guestName?: string) => {
        if (!gameInvite) return

        const updatedConfig = { ...gameInvite.gameConfig } as any
        const isSeries = updatedConfig.matchmakingMode === "series" && !!updatedConfig.seriesId

        if (isSeries) {
            const series = await gameSeriesManager.getSeries(roomId, updatedConfig.seriesId)
            if (!series) {
                notificationSystem.error("Series not found or already ended")
                params.setGameInvite(null)
                return
            }

            seriesBaseConfigRef.current = updatedConfig
            openedSeriesMatchRef.current = null
            completedSeriesNoticeRef.current = null
            params.setActiveGameSeries(series)
            params.setShowGameSeriesViewer(true)
            await gameSeriesManager.joinAsViewer(roomId, series.id, {
                id: currentUserId,
                name: userProfile.name,
                avatar: userProfile.avatar
            })

            const assignedMatch = gameSeriesManager.getAssignedMatch(series, currentUserId)
            if (!assignedMatch) {
                const firstWatchable = gameSeriesManager.getWatchableMatches(series)[0]
                if (firstWatchable?.gameId) {
                    const boardType = toBoardType(firstWatchable.gameType)
                    if (boardType) {
                        params.setActiveGame({ type: boardType, id: firstWatchable.gameId })
                    }
                }
                notificationSystem.info("No assigned player slot. Joined as viewer.")
                params.setGameInvite(null)
                return
            }

            const matchConfig = gameSeriesManager.toMatchConfig(updatedConfig, assignedMatch, currentUserId)
            openedSeriesMatchRef.current = assignedMatch.id
            params.setPlaygroundConfig(matchConfig)
            params.setActiveGame(null)
            params.setShowPlayground(true)

            params.setGameInvite(null)
            userPresence.updateActivity(roomId, currentUserId, "game")
            return
        }

        if (updatedConfig.players && updatedConfig.players.length > 1) {
            const newPlayers = [...updatedConfig.players]
            newPlayers[1] = {
                ...newPlayers[1],
                id: currentUserId,
                name: guestName || userProfile.name,
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
    }, [roomId, currentUserId, gameInvite, userProfile, params.playgroundGame, toBoardType])

    const handleAcceptGameInviteAsViewer = useCallback(async () => {
        if (!gameInvite) return

        const updatedConfig = { ...gameInvite.gameConfig } as any
        const isSeries = updatedConfig.matchmakingMode === "series" && !!updatedConfig.seriesId

        if (isSeries) {
            const currentSeries = await gameSeriesManager.getSeries(roomId, updatedConfig.seriesId)
            if (!currentSeries) {
                notificationSystem.error("Series not found or already ended")
                params.setGameInvite(null)
                return
            }

            // Choosing viewer mode forfeits any active assigned player slot to keep the bracket progressing.
            const series =
                (await gameSeriesManager.forfeitParticipant(roomId, updatedConfig.seriesId, currentUserId, userProfile.name)) ||
                currentSeries

            seriesBaseConfigRef.current = updatedConfig
            completedSeriesNoticeRef.current = null
            params.setActiveGameSeries(series)
            params.setShowGameSeriesViewer(true)
            await gameSeriesManager.joinAsViewer(roomId, series.id, {
                id: currentUserId,
                name: userProfile.name,
                avatar: userProfile.avatar
            })

            const firstWatchable = gameSeriesManager.getWatchableMatches(series)[0]
            if (firstWatchable?.gameId) {
                const boardType = toBoardType(firstWatchable.gameType)
                if (boardType) {
                    params.setActiveGame({ type: boardType, id: firstWatchable.gameId })
                }
            }
            params.setGameInvite(null)
            userPresence.updateActivity(roomId, currentUserId, "game")
            return
        }

        if (gameInvite.gameId) {
            const boardType = toBoardType(updatedConfig.selectedGame || params.playgroundGame)
            if (boardType) {
                params.setActiveGame({ type: boardType, id: gameInvite.gameId })
            }
        }
        params.setGameInvite(null)
        userPresence.updateActivity(roomId, currentUserId, "game")
    }, [roomId, currentUserId, gameInvite, userProfile, params.playgroundGame, toBoardType])

    const handleWatchSeriesMatch = useCallback((match: GameSeriesMatch) => {
        if (!match.gameId) {
            notificationSystem.info("This match is local (player vs computer) and cannot be watched live.")
            return
        }
        const boardType = toBoardType(match.gameType)
        if (!boardType) return
        params.setActiveGame({ type: boardType, id: match.gameId })
    }, [toBoardType])

    const handleSeriesPrediction = useCallback(async (match: GameSeriesMatch, winnerId: string) => {
        if (!activeGameSeries?.id) return
        await gameSeriesManager.submitPrediction(roomId, activeGameSeries.id, match.id, currentUserId, userProfile.name, winnerId)
    }, [roomId, activeGameSeries?.id, currentUserId, userProfile.name])

    const handleSeriesVote = useCallback(async (match: GameSeriesMatch, winnerId: string) => {
        if (!activeGameSeries?.id) return
        await gameSeriesManager.submitVote(roomId, activeGameSeries.id, match.id, currentUserId, userProfile.name, winnerId)
    }, [roomId, activeGameSeries?.id, currentUserId, userProfile.name])

    const handleSeriesBet = useCallback(async (match: GameSeriesMatch, winnerId: string, amount: number) => {
        if (!activeGameSeries?.id) return
        if (!Number.isFinite(amount) || amount <= 0) {
            notificationSystem.error("Bet amount must be greater than 0")
            return
        }
        await gameSeriesManager.submitBet(roomId, activeGameSeries.id, match.id, currentUserId, userProfile.name, winnerId, amount)
    }, [roomId, activeGameSeries?.id, currentUserId, userProfile.name])

    const handleSeriesComputerResult = useCallback(async (match: GameSeriesMatch, winnerId: string, winnerName: string) => {
        if (!activeGameSeries?.id) return
        await gameSeriesManager.reportComputerMatchResult(roomId, activeGameSeries.id, match.id, winnerId, winnerName)
        await gameSeriesManager.syncSeriesProgress(roomId, activeGameSeries.id)
    }, [roomId, activeGameSeries?.id])

    const handleDeclineGameInvite = useCallback(async () => {
        if (gameInvite?.gameConfig?.matchmakingMode === "series" && gameInvite.gameConfig?.seriesId) {
            await gameSeriesManager.forfeitParticipant(roomId, gameInvite.gameConfig.seriesId, currentUserId, userProfile.name)
        }
        params.setGameInvite(null)
    }, [roomId, currentUserId, gameInvite, userProfile.name])

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
                        const isSeries = invite?.gameConfig?.matchmakingMode === "series"
                        notificationSystem.success(
                            isSeries
                                ? `${invite.hostName} invited you to join a multi-room ${invite.gameConfig.selectedGame} series.`
                                : `${invite.hostName} invited you to play ${invite.gameConfig.gameType} game!`
                        )
                    }
                })
            }
        })
        return () => unsubscribe()
    }, [roomId, currentUserId, gameInvite])

    // --- Karaoke handlers ---
    const handleStartKaraoke = useCallback(async (song: KaraokeSong, options?: { inviteAudience?: boolean }) => {
        try {
            karaokeManager.initialize(roomId, currentUserId, userProfile.name)
            const session = await karaokeManager.createSession(song)
            if (session) {
                params.setCurrentKaraokeSession(session)
                const shouldInviteAudience = options?.inviteAudience !== false
                if (shouldInviteAudience) {
                    await karaokeManager.broadcastInvite(song)
                }
                telemetry.logEvent('karaoke_started', roomId, currentUserId, userProfile.name, { song: song.title })
                if (shouldInviteAudience) {
                    notificationSystem.success(`Karaoke invite sent: ${song.title}`)
                } else {
                    notificationSystem.success(`Karaoke started privately: ${song.title}`)
                }
            }
        } catch (error) {
            console.error("Error starting karaoke:", error)
            notificationSystem.error("Failed to start karaoke session")
        }
    }, [roomId, currentUserId, userProfile.name])

    const handleExitKaraoke = useCallback(async () => {
        if (params.currentKaraokeSession?.hostId === currentUserId) {
            await karaokeManager.endSession()
        } else {
            await karaokeManager.leaveSession(currentUserId)
        }
        params.setCurrentKaraokeSession(null)
        notificationSystem.success("Karaoke ended")
    }, [params.currentKaraokeSession, currentUserId])

    const handleAcceptKaraokeInvite = useCallback(async () => {
        if (!params.karaokeInvite) return
        try {
            karaokeManager.initialize(roomId, currentUserId, userProfile.name)
            await karaokeManager.joinSession(currentUserId, userProfile.name, "audience")
            params.setKaraokeInvite(null)
            userPresence.updateActivity(roomId, currentUserId, "theater")
            notificationSystem.success("Joined Karaoke")
        } catch (error) {
            console.error("Error joining karaoke:", error)
            notificationSystem.error("Failed to join karaoke")
        }
    }, [roomId, currentUserId, userProfile.name, params.karaokeInvite])

    const handleDeclineKaraokeInvite = useCallback(() => {
        params.setKaraokeInvite(null)
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
            console.log(`[useChatCalls] Initiating quiz. Topic: ${topic || 'random'}, Room: ${roomId}`)
            const sessionId = await quizSystem.createQuizSession(roomId, currentUserId, userProfile.name, topic)
            console.log(`[useChatCalls] Quiz session created: ${sessionId}. Scheduling start in 1s...`)
            setTimeout(() => {
                console.log(`[useChatCalls] Executing delayed startQuiz for session: ${sessionId}`)
                quizSystem.startQuiz(roomId, sessionId)
            }, 1000)
            telemetry.logEvent('quiz_started', roomId, currentUserId, userProfile.name, { topic: topic || 'random' })
            userPresence.updateActivity(roomId, currentUserId, "game")
            notificationSystem.success(topic ? `${topic} quiz started!` : "Random quiz started!")
        } catch (error) {
            console.error("[useChatCalls] Error in handleStartQuiz:", error)
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
        }, 2000)
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
                        handleStartScreenShareStandalone()
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
            { icon: Music2, label: "Soundboard", action: () => params.setShowSoundboard(true) },
        ]
    }

    const gamesGroup: MenuGroup = {
        label: "Games & Entertainment",
        items: [
            { icon: Gamepad2, label: "Games Menu", action: () => params.setShowGameMenu(true) },
            { icon: Ghost, label: "Mafia/Werewolf", action: () => params.setShowMafiaSetup(true) },
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
        label: "Tools & Settings",
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
        handleSwitchCallType, handleStartScreenShareStandalone,
        // Theater handlers
        handleStartTheater, handleCreateTheaterSession,
        handleAcceptTheaterInvite, handleDeclineTheaterInvite, handleExitTheater,
        // Game handlers
        listenForGameInvites, sendGameInvite,
        handleStartPlayground, handleAcceptGameInvite, handleAcceptGameInviteAsViewer, handleDeclineGameInvite, handleExitPlayground, handleOpenPlayground,
        handleWatchSeriesMatch, handleSeriesPrediction, handleSeriesVote, handleSeriesBet, handleSeriesComputerResult,
        // Karaoke handlers
        handleStartKaraoke, handleExitKaraoke, handleAcceptKaraokeInvite, handleDeclineKaraokeInvite,
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
