"use client"

import { useEffect, useRef } from "react"
import { ref, onValue, get, set } from "firebase/database"
import { getFirebaseDatabase } from "../../lib/firebase"
import { NotificationSystem } from "@/utils/core/notification-system"
import { MessageStorage } from "@/utils/infra/message-storage"
import { UserPresenceSystem, type UserPresence } from "@/utils/infra/user-presence"
import { CallSignaling, type CallData } from "@/utils/infra/call-signaling"
import { TheaterSignaling, type TheaterInvite } from "@/utils/infra/theater-signaling"
import { QuizSystem, type QuizSession, type QuizAnswer } from "@/utils/games/quiz-system"
import { presentationModeManager } from "@/utils/infra/presentation-mode"
import { EncryptionManager } from "@/utils/infra/encryption-manager"
import { whiteboardSignaling } from "@/utils/infra/whiteboard-signaling"
import { p2pFileTransfer } from "@/utils/infra/p2p-file-transfer"
import { karaokeManager } from "@/utils/games/karaoke"
import type { Message } from "../message-bubble"
import type { RoomMember } from "@/stores/chat-store"

interface UseChatEffectsParams {
    roomId: string
    userProfile: { name: string; avatar?: string }
    currentUserId: string
    themeContext: any
    // Store
    messages: Message[]
    setMessages: (msgs: Message[]) => void
    setOnlineUsers: (users: UserPresence[]) => void
    roomMembers: RoomMember[]
    setRoomMembers: (members: RoomMember[]) => void
    setReplyingTo: (msg: Message | null) => void
    currentUserMood: { emoji: string; text: string } | null
    // State setters
    setIncomingCall: (val: any) => void
    currentCall: CallData | null
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
    setKaraokeInvite: (val: any) => void
    setCurrentKaraokeSession: (val: any) => void
    setPresentationInvite: (val: any) => void
    setWhiteboardInvite: (val: any) => void
    setPinnedMessageId: (val: string | null) => void
    setPinnedMessage: (val: Message | null) => void
    setFirebaseConnected: (connected: boolean) => void
    setIsHost: (val: boolean) => void
    isHost: boolean
    setRoomIsProtected: (val: boolean) => void
    setPasswordValidated: (val: boolean) => void
    setMoodBackgroundImage: (val: string | null) => void
    setMoodBackgroundMusic: (val: string | null) => void
    setMoodPlaylist: (val: string[]) => void
    // Refs
    typingTimeoutRef: React.MutableRefObject<any>
    quizTimerRef: React.MutableRefObject<any>
    quizSessionUnsubscribeRef: React.MutableRefObject<(() => void) | null>
    quizAnswersUnsubscribeRef: React.MutableRefObject<(() => void) | null>
    // Callbacks from useChatCalls
    listenForGameInvites: () => () => void
    startQuizTimer: (time: number) => void
    handleQuizFinished: (sessionId: string) => void
    handleNextQuestion: () => void
    showSharedNotes: boolean
    showSharedTaskList: boolean
    setHasUnreadNotes: (val: boolean) => void
    setHasUnreadTasks: (val: boolean) => void
    pinnedMessageId: string | null
    currentQuizSession: QuizSession | null
    quizAnswers: QuizAnswer[]
    isQuizMinimized: boolean
}

export function useChatEffects(params: UseChatEffectsParams) {
    const {
        roomId, userProfile, currentUserId, themeContext,
        messages, setMessages, setOnlineUsers, roomMembers, setRoomMembers, setReplyingTo,
        setIncomingCall, currentCall, setCurrentCall, setIsInCall, setShowAudioCall, setShowVideoCall,
        setCurrentQuizSession, setQuizAnswers, setQuizResults, setUserQuizAnswer, setShowQuizResults, setQuizTimeRemaining,
        setCurrentTheaterSession, setTheaterInvite, setIsTheaterHost,
        setGameInvite, setKaraokeInvite, setPresentationInvite, setWhiteboardInvite, setPinnedMessageId, setPinnedMessage, setIsHost,
        setCurrentKaraokeSession,
        setRoomIsProtected, setPasswordValidated, setMoodBackgroundImage, setMoodBackgroundMusic, setMoodPlaylist,
        setHasUnreadNotes, setHasUnreadTasks, showSharedNotes, showSharedTaskList,
        typingTimeoutRef, quizTimerRef, quizSessionUnsubscribeRef, quizAnswersUnsubscribeRef,
        listenForGameInvites, startQuizTimer, handleQuizFinished, handleNextQuestion, pinnedMessageId,
        currentUserMood,
        currentQuizSession, quizAnswers, isHost, isQuizMinimized
    } = params

    const notificationSystem = NotificationSystem.getInstance()
    const messageStorage = MessageStorage.getInstance()
    const userPresence = UserPresenceSystem.getInstance()
    const callSignaling = CallSignaling.getInstance()
    const theaterSignaling = TheaterSignaling.getInstance()
    const joinTime = useRef(Date.now()).current
    const quizSystem = QuizSystem.getInstance()
    const prevOnlineUsersRef = useRef<string[]>([])
    const lastMessageCountRef = useRef(messages.length)
    const wasCallAnsweredRef = useRef(false)
    const currentCallRef = useRef<CallData | null>(null)

    // Sync currentCallRef
    useEffect(() => {
        currentCallRef.current = params.currentCall
    }, [params.currentCall])

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

    // Clear unread badges when panels are opened
    useEffect(() => {
        if (showSharedNotes) setHasUnreadNotes(false)
    }, [showSharedNotes])

    useEffect(() => {
        if (showSharedTaskList) setHasUnreadTasks(false)
    }, [showSharedTaskList])

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
        if (!roomId || !currentUserId) return

        console.log("ChatInterface: Initializing for room", roomId)
        karaokeManager.initialize(roomId, currentUserId, userProfile.name)
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
        setRoomMembers([])
        setGameInvite(null)
        setKaraokeInvite(null)
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

        const cleanUserInfo = { name: userProfile.name, currentActivity: "chat" as const, mood: currentUserMood || undefined }
        if ((userProfile as any).avatar && (userProfile as any).avatar.trim() !== "") {
            (cleanUserInfo as any).avatar = (userProfile as any).avatar
        }
        userPresence.setUserOnline(currentUserId, roomId, cleanUserInfo)

        // Add to persistent members collection
        const memberRef = ref(db, `rooms/${roomId}/members/${userProfile.name}`)
        set(memberRef, {
            name: userProfile.name,
            avatar: userProfile.avatar || null,
            joinedAt: Date.now()
        }).catch(err => {
            console.warn("ChatInterface: Failed to register member (possibly permission denied):", err)
        })

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

            // Play sound for NEW incoming messages from others
            if (processedMessages.length > lastMessageCountRef.current) {
                const newestMsg = processedMessages[processedMessages.length - 1]
                if (newestMsg.sender !== userProfile.name) {
                    notificationSystem.newMessage(newestMsg.sender, newestMsg.text)
                }
            }
            lastMessageCountRef.current = processedMessages.length

            setMessages(processedMessages)
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
                if (call.callerId !== currentUserId) {
                    // If it's for us specifically or a general room call
                    const isForMe = !call.targetUserId || call.targetUserId === currentUserId || call.targetUserId === "all"
                    if (call.status === "ringing" && isForMe) {
                        console.log(`[useChatEffects] Incoming call ring: ${call.id} from ${call.caller} (Target: ${call.targetUserId})`)
                        setIncomingCall(call)
                        if (call.type === "video") {
                            setShowVideoCall(true)
                            notificationSystem.incomingVideoCall(call.caller)
                        } else {
                            setShowAudioCall(true)
                            notificationSystem.incomingCall(call.caller)
                        }
                    }
                }
            },
            (call: CallData) => {
                console.log("[Signaling] Call update received:", call)
                // Ignore updates if they don't relate to our current call or incoming call
                // and we are already in call state
                setCurrentCall((prev: CallData | null) => {
                    // If no call tracked, take this one if it's active
                    if (!prev) {
                        if (call.status !== "ended") return call
                        return null
                    }

                    // If we have a tracked call, only take updates for it
                    if (prev.id === call.id) {
                        return call
                    }

                    return prev
                })

                if (call.status === "answered") {
                    // Only process 'answered' for the relevant call
                    setCurrentCall((prev: CallData | null) => {
                        if (prev && prev.id === call.id) {
                            if (!wasCallAnsweredRef.current) {
                                notificationSystem.callConnected()
                            }
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
                        }
                        return prev
                    })
                } else if (call.status === "ended") {
                    setCurrentCall((prev: CallData | null) => {
                        if (prev && prev.id === call.id) {
                            setIsInCall(false)
                            setShowAudioCall(false)
                            setShowVideoCall(false)

                            if (!wasCallAnsweredRef.current && call.callerId !== currentUserId) {
                                notificationSystem.callNotAnswered()
                            } else {
                                notificationSystem.callEnded()
                            }
                            wasCallAnsweredRef.current = false
                            return null
                        }
                        return prev
                    })
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

        const whiteboardUnsubscribe = whiteboardSignaling.listenForInvites(roomId, currentUserId, (invite) => {
            setWhiteboardInvite(invite)
            notificationSystem.whiteboardInvite(invite.hostName)
        })

        // Listen for room members (persistent)
        const membersRef = ref(db, `rooms/${roomId}/members`)
        const membersUnsubscribe = onValue(membersRef, (snapshot) => {
            const data = snapshot.val()
            if (data) {
                const membersList: RoomMember[] = Object.values(data)
                setRoomMembers(membersList)
                console.log(`ChatEffects: Syncing ${membersList.length} members for room ${roomId}`)
            } else {
                setRoomMembers([])
            }
        })

        // Karaoke Sessions
        const karaokeSessionUnsubscribe = karaokeManager.listenForSession(roomId, (session) => {
            setCurrentKaraokeSession(session)
        })

        // Karaoke Invitations
        const karaokeInviteUnsubscribe = karaokeManager.listenForInvites(roomId, currentUserId, (invite) => {
            if (invite) {
                console.log("Incoming karaoke invite:", invite)
                setKaraokeInvite(invite)
                notificationSystem.karaokeInvite(invite.hostName)
                // Auto-clear invite after 45 seconds
                setTimeout(() => setKaraokeInvite(null), 45000)
            } else {
                setKaraokeInvite(null)
            }
        })

        // Productivity Badges Listening
        const notesRef = ref(db, `rooms/${roomId}/productivity/notes/lastModified`)
        const notesUnsubscribe = onValue(notesRef, (snapshot) => {
            if (snapshot.exists() && !showSharedNotes) {
                const lastMod = snapshot.val()
                if (typeof lastMod === 'number' && lastMod > joinTime) {
                    setHasUnreadNotes(true)
                    notificationSystem.notesUpdated("Someone")
                }
            }
        })

        const tasksRef = ref(db, `rooms/${roomId}/productivity/tasks/lastModified`)
        const tasksUnsubscribe = onValue(tasksRef, (snapshot) => {
            if (snapshot.exists() && !showSharedTaskList) {
                const lastMod = snapshot.val()
                if (typeof lastMod === 'number' && lastMod > joinTime) {
                    setHasUnreadTasks(true)
                    notificationSystem.tasksUpdated("Someone")
                }
            }
        })

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
            karaokeInviteUnsubscribe()
            karaokeSessionUnsubscribe()
            whiteboardUnsubscribe()
            notesUnsubscribe()
            tasksUnsubscribe()
            membersUnsubscribe()
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

            // End active call if any
            if (currentCallRef.current) {
                console.log("Cleaning up active call on room exit:", currentCallRef.current.id)
                callSignaling.endCall(roomId, currentCallRef.current.id)
            }
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
                setMoodPlaylist(moodData.playlist || [])

                // If there's a playlist, we can potentially use the first song as 'current' music
                // but MoodPlayer handles the actual playback of the playlist.
                if (moodData.playlist && moodData.playlist.length > 0) {
                    setMoodBackgroundMusic(moodData.playlist[0])
                } else {
                    setMoodBackgroundMusic(null)
                }
            } else {
                setMoodBackgroundImage(null)
                setMoodBackgroundMusic(null)
                setMoodPlaylist([])
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
            console.log(`[useChatEffects] Active quiz update for room ${roomId}: ${sessionId || 'none'}`)
            if (quizSessionUnsubscribeRef.current) { quizSessionUnsubscribeRef.current(); quizSessionUnsubscribeRef.current = null }
            if (quizAnswersUnsubscribeRef.current) { quizAnswersUnsubscribeRef.current(); quizAnswersUnsubscribeRef.current = null }
            if (!sessionId) {
                setCurrentQuizSession(null); setQuizAnswers([]); setUserQuizAnswer(""); setShowQuizResults(false)
                return
            }
            quizSystem.joinQuizSession(roomId, sessionId, currentUserId).then(async () => {
                // Fetch the session to see who started it
                const db = getFirebaseDatabase()
                if (db) {
                    const sessionRef = ref(db, `rooms/${roomId}/quiz/${sessionId}`)
                    const snapshot = await get(sessionRef)
                    const sessionData = snapshot.val() as QuizSession
                    if (sessionData && sessionData.hostName !== userProfile.name) {
                        notificationSystem.quizInvite(sessionData.hostName, sessionData.topic || "general")
                    }
                }

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

    // Sync current user mood change
    useEffect(() => {
        if (!roomId || !currentUserId) return
        // Only set mood if it's a valid value (not undefined/null)
        if (currentUserMood) {
            userPresence.setUserMood(roomId, currentUserId, currentUserMood)
        }
    }, [currentUserMood, roomId, currentUserId])

    // Auto-advance quiz if everyone answered
    useEffect(() => {
        if (!currentQuizSession || currentQuizSession.status !== "active" || !isHost) return

        const currentQuestionId = currentQuizSession.questions[currentQuizSession.currentQuestionIndex]?.id
        if (!currentQuestionId) return

        const currentAnswers = quizAnswers.filter((a: QuizAnswer) => a.questionId === currentQuestionId)

        // If everyone answered, advance!
        if (currentAnswers.length > 0 && currentAnswers.length >= currentQuizSession.participants.length) {
            console.log(`[useChatEffects] Everyone answered (${currentAnswers.length}/${currentQuizSession.participants.length}). Advancing question...`)
            handleNextQuestion()
        }
    }, [quizAnswers, currentQuizSession, isHost, handleNextQuestion])
}
