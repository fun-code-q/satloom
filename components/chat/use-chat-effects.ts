"use client"

import { useEffect, useRef } from "react"
import { ref, onValue, get } from "firebase/database"
import { getFirebaseDatabase } from "../../lib/firebase"
import { NotificationSystem } from "@/utils/core/notification-system"
import { MessageStorage } from "@/utils/infra/message-storage"
import { UserPresenceSystem, type UserPresence } from "@/utils/infra/user-presence"
import { CallSignaling, type CallData } from "@/utils/infra/call-signaling"
import { TheaterSignaling, type TheaterInvite } from "@/utils/infra/theater-signaling"
import { QuizSystem, type QuizSession, type QuizAnswer } from "@/utils/games/quiz-system"
import { presentationModeManager } from "@/utils/infra/presentation-mode"
import { EncryptionManager } from "@/utils/infra/encryption-manager"
import { p2pFileTransfer } from "@/utils/infra/p2p-file-transfer"
import type { Message } from "../message-bubble"

interface UseChatEffectsParams {
    roomId: string
    userProfile: { name: string; avatar?: string }
    currentUserId: string
    themeContext: any
    // Store
    messages: Message[]
    setMessages: (msgs: Message[]) => void
    setOnlineUsers: (users: UserPresence[]) => void
    setReplyingTo: (msg: Message | null) => void
    // State setters
    setIncomingCall: (val: any) => void
    setCurrentCall: (val: any) => void
    setIsInCall: (val: boolean) => void
    setShowAudioCall: (val: boolean) => void
    setShowVideoCall: (val: boolean) => void
    setCurrentQuizSession: (val: any) => void
    setQuizAnswers: (val: any) => void
    setQuizResults: (val: any) => void
    setUserQuizAnswer: (val: string) => void
    setShowQuizResults: (val: boolean) => void
    setQuizTimeRemaining: (val: number) => void
    setCurrentTheaterSession: (val: any) => void
    setTheaterInvite: (val: any) => void
    setIsTheaterHost: (val: boolean) => void
    setGameInvite: (val: any) => void
    setPresentationInvite: (val: any) => void
    setPinnedMessageId: (val: string | null) => void
    setPinnedMessage: (val: Message | null) => void
    setFirebaseConnected: (connected: boolean) => void
    setIsHost: (val: boolean) => void
    setRoomIsProtected: (val: boolean) => void
    setPasswordValidated: (val: boolean) => void
    setMoodBackgroundImage: (val: string | null) => void
    setMoodBackgroundMusic: (val: string | null) => void
    // Refs
    typingTimeoutRef: React.MutableRefObject<any>
    quizTimerRef: React.MutableRefObject<any>
    quizSessionUnsubscribeRef: React.MutableRefObject<(() => void) | null>
    quizAnswersUnsubscribeRef: React.MutableRefObject<(() => void) | null>
    // Callbacks from useChatCalls
    listenForGameInvites: () => () => void
    startQuizTimer: (time: number) => void
    handleQuizFinished: (sessionId: string) => void
    pinnedMessageId: string | null
}

export function useChatEffects(params: UseChatEffectsParams) {
    const {
        roomId, userProfile, currentUserId, themeContext,
        messages, setMessages, setOnlineUsers, setReplyingTo,
        setIncomingCall, setCurrentCall, setIsInCall, setShowAudioCall, setShowVideoCall,
        setCurrentQuizSession, setQuizAnswers, setQuizResults, setUserQuizAnswer, setShowQuizResults, setQuizTimeRemaining,
        setCurrentTheaterSession, setTheaterInvite, setIsTheaterHost,
        setGameInvite, setPresentationInvite, setPinnedMessageId, setPinnedMessage, setIsHost,
        setRoomIsProtected, setPasswordValidated, setMoodBackgroundImage, setMoodBackgroundMusic,
        typingTimeoutRef, quizTimerRef, quizSessionUnsubscribeRef, quizAnswersUnsubscribeRef,
        listenForGameInvites, startQuizTimer, handleQuizFinished, pinnedMessageId,
    } = params

    const notificationSystem = NotificationSystem.getInstance()
    const messageStorage = MessageStorage.getInstance()
    const userPresence = UserPresenceSystem.getInstance()
    const callSignaling = CallSignaling.getInstance()
    const theaterSignaling = TheaterSignaling.getInstance()
    const quizSystem = QuizSystem.getInstance()
    const prevOnlineUsersRef = useRef<string[]>([])
    const lastMessageCountRef = useRef(messages.length)
    const wasCallAnsweredRef = useRef(false)

    // Initialize P2P File Transfer
    useEffect(() => {
        if (roomId && userProfile.name) {
            p2pFileTransfer.initialize(roomId, userProfile.name)
        }
    }, [roomId, userProfile.name])

    // Initialize Encryption Key
    useEffect(() => {
        const initEncryption = async () => {
            const manager = EncryptionManager.getInstance()
            const salt = new TextEncoder().encode("salt_" + roomId)
            const key = await manager.deriveKeyFromPassword(roomId, salt)
            manager.setRoomKey(roomId, key)
            console.log("Encryption key initialized for room:", roomId)
        }
        initEncryption()
    }, [roomId])

    // Mark messages as read
    useEffect(() => {
        if (!roomId || !messages.length || !userProfile.name) return
        messages.forEach((msg) => {
            if (msg.sender !== userProfile.name && (!msg.readBy || !msg.readBy.includes(userProfile.name))) {
                MessageStorage.getInstance().markMessageAsRead(roomId, msg.id, userProfile.name)
            }
        })
    }, [messages, roomId, userProfile.name])

    // Validate roomId
    useEffect(() => {
        console.log("ChatInterface: roomId prop changed to:", roomId)
        if (!roomId || roomId.trim() === "") {
            console.error("ChatInterface: Invalid roomId received:", roomId)
        }
    }, [roomId])

    // Main room initialization effect
    useEffect(() => {
        console.log("ChatInterface: Initializing for room", roomId)
        if (!roomId || roomId.trim() === "") {
            console.error("ChatInterface: Cannot initialize with invalid roomId:", roomId)
            return
        }

        // COMPLETE state reset when entering a new room
        setMessages([])
        setReplyingTo(null)
        setIncomingCall(null)
        setCurrentCall(null)
        setIsInCall(false)
        setCurrentQuizSession(null)
        setQuizAnswers([])
        setQuizResults([])
        setUserQuizAnswer("")
        setShowQuizResults(false)
        setQuizTimeRemaining(0)
        setCurrentTheaterSession(null)
        setTheaterInvite(null)
        setIsTheaterHost(false)
        setOnlineUsers([])
        setGameInvite(null)
        prevOnlineUsersRef.current = []

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
        if (quizTimerRef.current) clearInterval(quizTimerRef.current)
        const db = getFirebaseDatabase()
        if (!db) {
            console.error("ChatInterface: Firebase database not initialized. Config might be missing.")
            notificationSystem.error("Database connection failed. Please check your configuration.")
            params.setFirebaseConnected(false)
            return
        }
        params.setFirebaseConnected(true)

        notificationSystem.setNotificationsEnabled(themeContext.notifications)
        notificationSystem.setSoundEnabled(themeContext.notificationSound)
        notificationSystem.requestPermission()

        const cleanUserInfo = { name: userProfile.name, currentActivity: "chat" as const }
        if ((userProfile as any).avatar && (userProfile as any).avatar.trim() !== "") {
            (cleanUserInfo as any).avatar = (userProfile as any).avatar
        }
        userPresence.setUserOnline(currentUserId, roomId, cleanUserInfo)

        // Listen for messages
        const messageUnsubscribe = messageStorage.listenForMessages(roomId, async (newMessages) => {
            console.log(`ChatInterface: Received ${newMessages.length} messages for room ${roomId}`)
            const encryptionManager = EncryptionManager.getInstance()
            const processedMessages = await Promise.all(newMessages.map(async (msg) => {
                if (msg.text && msg.text.startsWith("enc::")) {
                    try {
                        const decryptedText = await encryptionManager.decrypt(msg.text, roomId)
                        return { ...msg, text: decryptedText }
                    } catch (error) {
                        console.error("Failed to decrypt message:", msg.id, error)
                        return { ...msg, text: "[Decryption Failed]" }
                    }
                }
                return msg
            }))
            const filteredMessages = processedMessages.filter((msg) => {
                const msgRoomId = (msg as any).roomId
                return msgRoomId === roomId || !msgRoomId
            })

            // Play sound for NEW incoming messages from others
            if (filteredMessages.length > lastMessageCountRef.current) {
                const newestMsg = filteredMessages[filteredMessages.length - 1]
                if (newestMsg.sender !== userProfile.name) {
                    notificationSystem.newMessage(newestMsg.sender, newestMsg.text)
                }
            }
            lastMessageCountRef.current = filteredMessages.length

            setMessages(filteredMessages)
        })

        const presenceUnsubscribe = userPresence.listenForPresence(roomId, (users) => {
            const onlineUsers = users.filter((user) => user.status === "online")
            const currentOnlineIds = onlineUsers.map(u => u.id)

            // Detect new joiners for sound effect
            onlineUsers.forEach(user => {
                if (user.id !== currentUserId && !prevOnlineUsersRef.current.includes(user.id)) {
                    notificationSystem.userJoined(user.name)
                }
            })

            // Detect users who left
            prevOnlineUsersRef.current.forEach((userId: string) => {
                if (!currentOnlineIds.includes(userId)) {
                    const lostUser = users.find(u => u.id === userId)
                    if (lostUser) notificationSystem.userLeft(lostUser.name)
                }
            })

            prevOnlineUsersRef.current = currentOnlineIds
            setOnlineUsers(onlineUsers)
        })

        const pinnedMessageUnsubscribe = onValue(ref(db, `rooms/${roomId}/pinnedMessageId`), (snapshot: any) => {
            setPinnedMessageId(snapshot.val())
        })

        const callUnsubscribe = callSignaling.listenForCalls(
            roomId, currentUserId,
            (call: CallData) => {
                if (call.callerId !== currentUserId && call.caller !== userProfile.name) {
                    console.log("[Signaling] Incoming call received:", call)
                    setIncomingCall(call)
                    if (call.type === "video") {
                        setShowVideoCall(true)
                        notificationSystem.incomingVideoCall(call.caller)
                    } else {
                        setShowAudioCall(true)
                        notificationSystem.incomingCall(call.caller)
                    }
                }
            },
            (call: CallData) => {
                console.log("[Signaling] Call update received:", call)
                if (call.participants.includes(currentUserId) || call.callerId === currentUserId) {
                    setCurrentCall(call)
                    if (call.status === "answered") {
                        wasCallAnsweredRef.current = true
                        setIsInCall(true)
                        // Handle modal visibility based on call type
                        if (call.type === "video") {
                            setShowVideoCall(true)
                            setShowAudioCall(false)
                        } else {
                            setShowVideoCall(false)
                            setShowAudioCall(true)
                        }
                    } else if (call.status === "ended") {
                        setIsInCall(false)
                        setCurrentCall(null)
                        setShowAudioCall(false)
                        setShowVideoCall(false)

                        if (!wasCallAnsweredRef.current && call.callerId !== currentUserId) {
                            notificationSystem.callNotAnswered()
                        } else {
                            notificationSystem.callEnded()
                        }
                        wasCallAnsweredRef.current = false
                    }
                }
            },
        )

        const theaterUnsubscribe = theaterSignaling.listenForInvites(roomId, currentUserId, (invite: TheaterInvite) => {
            if (invite.hostId !== currentUserId) {
                setTheaterInvite(invite)
                notificationSystem.theaterInvite(invite.host, invite.videoTitle)
            }
        })

        const presentationUnsubscribe = presentationModeManager.listenForInvites((invite) => {
            setPresentationInvite(invite)
            notificationSystem.presentationInvite(invite.hostName)
        })

        const gameInviteUnsubscribe = listenForGameInvites()

        notificationSystem.roomJoined(roomId)

        return () => {
            console.log("ChatInterface: Cleaning up for room", roomId)
            messageUnsubscribe()
            presenceUnsubscribe()
            callUnsubscribe()
            theaterUnsubscribe()
            presentationUnsubscribe()
            pinnedMessageUnsubscribe()
            gameInviteUnsubscribe()
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
            if (quizTimerRef.current) clearInterval(quizTimerRef.current)
            setMessages([])
            setIncomingCall(null)
            setCurrentCall(null)
            setIsInCall(false)
            setCurrentQuizSession(null)
            setQuizAnswers([])
            setQuizResults([])
            userPresence.setUserOffline(roomId, currentUserId)
            messageStorage.cleanup()
            userPresence.cleanup()
            callSignaling.cleanup()
            theaterSignaling.cleanup()
            quizSystem.cleanup()
        }
    }, [roomId, currentUserId, userProfile.name, (userProfile as any).avatar, themeContext])

    // Update pinned message
    useEffect(() => {
        if (pinnedMessageId && messages.length > 0) {
            const foundMessage = messages.find(m => m.id === pinnedMessageId)
            setPinnedMessage(foundMessage || null)
        } else {
            setPinnedMessage(null)
        }
    }, [pinnedMessageId, messages])

    // Check host status
    useEffect(() => {
        const checkHostStatus = async () => {
            try {
                const db = getFirebaseDatabase()
                if (!db || !roomId) return
                const roomRef = ref(db, `rooms/${roomId}`)
                const snapshot = await get(roomRef)
                if (snapshot.exists()) {
                    const roomData = snapshot.val()
                    setIsHost(roomData.createdBy === userProfile.name)
                }
            } catch (error) {
                console.error("Error checking host status:", error)
            }
        }
        checkHostStatus()
    }, [roomId, userProfile.name])

    // Subscribe to mood settings
    useEffect(() => {
        const db = getFirebaseDatabase()
        if (!db || !roomId) return
        const moodRef = ref(db, `rooms/${roomId}/mood`)
        const unsubscribe = onValue(moodRef, (snapshot) => {
            if (snapshot.exists()) {
                const moodData = snapshot.val()
                setMoodBackgroundImage(moodData.backgroundImage || null)
                setMoodBackgroundMusic(moodData.backgroundMusic || null)
            } else {
                setMoodBackgroundImage(null)
                setMoodBackgroundMusic(null)
            }
        })
        return () => unsubscribe()
    }, [roomId])

    // Check password protection
    useEffect(() => {
        const db = getFirebaseDatabase()
        if (!db || !roomId) return
        const passwordRef = ref(db, `rooms/${roomId}/password`)
        const unsubscribe = onValue(passwordRef, (snapshot) => {
            if (snapshot.exists()) {
                setRoomIsProtected(true)
            } else {
                setRoomIsProtected(false)
                setPasswordValidated(true)
            }
        })
        return () => unsubscribe()
    }, [roomId])

    // Listen for active quiz session
    useEffect(() => {
        if (!roomId) return
        const unsubscribeActiveQuiz = quizSystem.listenForActiveQuiz(roomId, (sessionId: string | null) => {
            if (quizSessionUnsubscribeRef.current) { quizSessionUnsubscribeRef.current(); quizSessionUnsubscribeRef.current = null }
            if (quizAnswersUnsubscribeRef.current) { quizAnswersUnsubscribeRef.current(); quizAnswersUnsubscribeRef.current = null }
            if (!sessionId) {
                setCurrentQuizSession(null); setQuizAnswers([]); setUserQuizAnswer(""); setShowQuizResults(false)
                return
            }
            quizSystem.joinQuizSession(roomId, sessionId, currentUserId).then(() => {
                quizSessionUnsubscribeRef.current = quizSystem.listenForQuizSession(roomId, sessionId, (session: QuizSession) => {
                    setCurrentQuizSession(session)
                    if (session.status === "active") startQuizTimer(session.timePerQuestion || 10)
                    if (session.status === "finished") handleQuizFinished(sessionId)
                })
                quizAnswersUnsubscribeRef.current = quizSystem.listenForQuizAnswers(roomId, sessionId, (answers: QuizAnswer[]) => {
                    setQuizAnswers(answers)
                }) as any
            }).catch((error) => {
                console.error("Error joining quiz:", error)
                notificationSystem.error("Failed to join quiz session")
            })
        }) as any
        return () => {
            unsubscribeActiveQuiz()
            if (quizSessionUnsubscribeRef.current) quizSessionUnsubscribeRef.current()
            if (quizAnswersUnsubscribeRef.current) quizAnswersUnsubscribeRef.current()
        }
    }, [roomId, currentUserId])
}
