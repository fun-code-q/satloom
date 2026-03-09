"use client"

import React, { useEffect, useState, useCallback } from "react"
import { createPortal } from "react-dom"
import { Button } from "../ui/button"
import { X, Smile } from "lucide-react"
import { AudioCallModal } from "../audio-call-modal"
import { VideoCallModal } from "../video-call-modal"
import { SettingsModal } from "../settings-modal"
import { AboutModal } from "../about-modal"
import { MediaRecorder } from "../media-recorder"
import { PlaygroundSetupModal, type GameConfig } from "../playground-setup-modal"
import { TheaterSetupModal } from "../theater-setup-modal"
import { TheaterFullscreen } from "../theater-fullscreen"
import { TheaterInviteNotification } from "../theater-invite-notification"
import { DotsAndBoxesGameComponent } from "../dots-and-boxes-game"
import { GameInviteNotification } from "../game-invite-notification"
import { QuizSetupModal } from "../quiz-setup-modal"
import { MoodSetupModal } from "../mood/mood-setup-modal"
import { WhiteboardModal } from "../whiteboard-modal"
import { Soundboard } from "../soundboard"
import { PasswordEntryModal } from "../password-entry-modal"
import { HostPasswordModal } from "../host-password-modal"
import { KaraokeSetupModal, KaraokePlayer } from "../karaoke"
import { MafiaSetupModal, MafiaGame } from "../mafia"
import { SharedNotesPanel } from "../shared-notes-panel"
import { SharedTaskListPanel } from "../shared-task-list-panel"
import { RemoteBuzzerPanel } from "../remote-buzzer-panel"
import { BurnerLinkModal } from "../burner-link-modal"
import { GifAvatarPicker } from "../gif-avatar-picker"
import { BreakoutRoomsModal } from "../breakout-rooms-modal"
import { PrivacyTermsModal } from "../privacy-terms-modal"
import { RandomMatchButton } from "../random-match-button"
import { BingoSetupModal } from "../bingo/bingo-setup-modal"
import { BingoGame } from "../bingo/bingo-game"
import { PresentationSetupModal } from "../presentation/presentation-setup-modal"
import { PresentationViewer } from "../presentation/presentation-viewer"
import { PresentationInviteNotification } from "../presentation/presentation-invite-notification"
import { GameMenu } from "../game-menu"
import { ChessBoard } from "../games/chess-board"
import { ConnectFourBoard } from "../games/connect-four-board"
import { TicTacToeBoard } from "../games/tic-tac-toe-board"
import { EmojiPicker } from "../emoji-picker"
import { ReactionRain } from "../reaction-rain"
import { ChatInput } from "./chat-input"
import { MessageList } from "./message-list"
import { BaseModal } from "../base-modal"
import type { CallData } from "@/utils/infra/call-signaling"
import type { TheaterSession, TheaterInvite } from "@/utils/infra/theater-signaling"
import type { QuizSession, QuizAnswer, QuizResult } from "@/utils/games/quiz-system"
import type { Message } from "../message-bubble"
import type { GameInvite } from "@/utils/infra/game-signaling"
import type { KaraokeSong } from "@/utils/games/karaoke"

interface ChatModalsProps {
    roomId: string
    userProfile: { name: string; avatar?: string }
    currentUserId: string
    isHost: boolean
    onLeave: () => void
    messages: Message[]
    // Chat Input
    showEmojiPicker: boolean
    setShowEmojiPicker: (val: boolean) => void
    setIsMoodSelectorOpen: (val: boolean) => void
    setShowQuizSetup: (val: boolean) => void
    showChatSearch: boolean
    setShowChatSearch: (val: boolean) => void
    // Message list handlers
    handleReply: (msg: Message) => void
    handleReact: (id: string, reaction: "heart" | "thumbsUp", userId: string) => void
    handleDeleteMessage: (id: string) => void
    handleEditMessage: (id: string, text: string) => void
    handleCopyMessage: (text: string) => void
    handleVote: (id: string, idx: number) => void
    handleRSVP: (id: string, status: "going" | "maybe" | "notGoing") => void
    handlePinMessage: (id: string) => void
    handleQuizAnswer: (answer: string) => void
    handleExitQuiz: () => void
    handleFileSelect: (type: string, file?: File | any) => void
    handleStartMediaRecording: (mode: "audio" | "video" | "photo") => void
    getUserColor: (username: string) => string
    // Quiz
    currentQuizSession: QuizSession | null
    quizTimeRemaining: number
    quizAnswers: QuizAnswer[]
    quizResults: QuizResult[]
    userQuizAnswer: string
    showQuizResults: boolean
    // Call
    showAudioCall: boolean
    showVideoCall: boolean
    incomingCall: CallData | null
    currentCall: CallData | null
    handleEndCall: () => void
    handleEndVideoCall: () => void
    handleAnswerCall: () => void
    handleAnswerVideoCall: () => void
    handleDeclineCall: () => void
    handleStartAudioCall: () => void
    handleStartVideoCall: () => void
    // Settings & About
    showSettings: boolean
    setShowSettings: (val: boolean) => void
    showAbout: boolean
    setShowAbout: (val: boolean) => void
    // Media Recorder
    showMediaRecorder: boolean
    setShowMediaRecorder: (val: boolean) => void
    mediaRecorderMode: "audio" | "video" | "photo"
    handleMediaRecorded: (file: File, type: string) => void
    handleStopMediaRecording: () => void
    // Whiteboard
    showWhiteboard: boolean
    setShowWhiteboard: (val: boolean) => void
    // Playground
    showPlaygroundSetup: boolean
    setShowPlaygroundSetup: (val: boolean) => void
    playgroundGame: "dots" | "chess" | "tictactoe" | "connect4"
    setPlaygroundGame: (val: "dots" | "chess" | "tictactoe" | "connect4") => void
    showPlayground: boolean
    playgroundConfig: GameConfig | null
    handleStartPlayground: (config: GameConfig) => void
    handleExitPlayground: () => void
    // Theater
    showTheaterSetup: boolean
    setShowTheaterSetup: (val: boolean) => void
    showTheaterFullscreen: boolean
    currentTheaterSession: TheaterSession | null
    isTheaterHost: boolean
    theaterInvite: TheaterInvite | null
    handleCreateTheaterSession: (videoUrl: string, videoType: "direct" | "youtube" | "vimeo" | "twitch" | "dailymotion" | "archive" | "webrtc", file?: File) => void
    handleAcceptTheaterInvite: () => void
    handleDeclineTheaterInvite: () => void
    handleExitTheater: () => void
    pendingMediaFile: File | null
    setPendingMediaFile: (file: File | null) => void
    // Quiz Modal
    showQuizSetup: boolean
    handleStartQuiz: (topic?: string) => void
    // Mood
    showMoodSetup: boolean
    setShowMoodSetup: (val: boolean) => void
    // Soundboard
    showSoundboard: boolean
    setShowSoundboard: (val: boolean) => void
    // Password
    showPasswordEntry: boolean
    setShowPasswordEntry: (val: boolean) => void
    setPasswordValidated: (val: boolean) => void
    showHostPassword: boolean
    setShowHostPassword: (val: boolean) => void
    roomIsProtected: boolean
    passwordValidated: boolean
    setRoomIsProtected: (val: boolean) => void
    // Karaoke
    showKaraokeSetup: boolean
    setShowKaraokeSetup: (val: boolean) => void
    currentKaraokeSession: any
    handleStartKaraoke: (song: KaraokeSong) => void
    handleExitKaraoke: () => void
    // Mafia
    showMafiaSetup: boolean
    setShowMafiaSetup: (val: boolean) => void
    showMafiaGame: boolean
    setShowMafiaGame: (val: boolean) => void
    mafiaConfig: any
    setMafiaConfig: (val: any) => void
    // Feature panels
    showSharedNotes: boolean
    setShowSharedNotes: (val: boolean) => void
    showSharedTaskList: boolean
    setShowSharedTaskList: (val: boolean) => void
    showRemoteBuzzer: boolean
    setShowRemoteBuzzer: (val: boolean) => void
    showRandomMatch: boolean
    setShowRandomMatch: (val: boolean) => void
    showBingoSetup: boolean
    setShowBingoSetup: (val: boolean) => void
    showBingoGame: boolean
    showPresentationSetup: boolean
    setShowPresentationSetup: (val: boolean) => void
    showPresentationViewer: boolean
    setShowPresentationViewer: (val: boolean) => void
    currentPresentationId: string | null
    setCurrentPresentationId: (val: string | null) => void
    showBurnerLink: boolean
    setShowBurnerLink: (val: boolean) => void
    showGifAvatar: boolean
    setShowGifAvatar: (val: boolean) => void
    setUserAvatar: (val: string | undefined) => void
    showGameMenu: boolean
    setShowGameMenu: (val: boolean) => void
    activeGame: { type: "chess" | "connect4" | "tictactoe"; id: string } | null
    setActiveGame: (val: any) => void
    showBreakoutRooms: boolean
    setShowBreakoutRooms: (val: boolean) => void
    showPrivacyPolicy: boolean
    setShowPrivacyPolicy: (val: boolean) => void
    showTermsOfService: boolean
    setShowTermsOfService: (val: boolean) => void
    // Game invites
    gameInvite: GameInvite | null
    handleAcceptGameInvite: () => void
    handleDeclineGameInvite: () => void
    // Leave Handlers
    showLeaveConfirmation: boolean
    handleConfirmLeave: () => void
    handleCancelLeave: () => void
    handleSwitchCallType: (type: "audio" | "video") => void | Promise<void>
    onOpenPlayground: (type?: "dots" | "chess" | "tictactoe" | "connect4") => void
    presentationInvite: { presentationId: string; hostName: string; hostId: string } | null
    setPresentationInvite: (val: any) => void
    handleAcceptPresentationInvite: () => void
    handleDeclinePresentationInvite: () => void
}

export function ChatModals(props: ChatModalsProps) {
    const {
        roomId, userProfile, currentUserId, isHost, onLeave, messages,
    } = props

    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const renderModal = (content: React.ReactNode) => {
        if (!mounted) return null
        return createPortal(content, document.body)
    }

    useEffect(() => {
        if (props.showAudioCall || props.showVideoCall) {
            console.log("ChatModals: Call visibility changed", {
                audio: props.showAudioCall,
                video: props.showVideoCall,
                currentCall: !!props.currentCall,
                incomingCall: !!props.incomingCall
            })
        }
    }, [props.showAudioCall, props.showVideoCall, props.currentCall, props.incomingCall])

    return (
        <>
            <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
                {/* Message List */}
                <MessageList
                    onReply={props.handleReply}
                    onReact={props.handleReact}
                    onDelete={props.handleDeleteMessage}
                    onEdit={props.handleEditMessage}
                    onCopy={props.handleCopyMessage}
                    currentQuizSession={props.currentQuizSession}
                    quizTimeRemaining={props.quizTimeRemaining}
                    quizAnswers={props.quizAnswers}
                    quizResults={props.quizResults}
                    userQuizAnswer={props.userQuizAnswer}
                    showQuizResults={props.showQuizResults}
                    onQuizAnswer={props.handleQuizAnswer}
                    onQuizExit={props.handleExitQuiz}
                    onVote={props.handleVote}
                    onRSVP={props.handleRSVP}
                    onPin={props.handlePinMessage}
                    getUserColor={props.getUserColor}
                    showSearch={props.showChatSearch}
                />

                {/* Remote Buzzer - Absolute within chat area */}
                {props.showRemoteBuzzer && (
                    <div className="absolute inset-x-0 bottom-0 top-0 z-[50] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="w-full max-w-sm mx-4 bg-slate-800/95 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-fit glass-morphism">
                            <div className="p-3 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                                <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider">Remote Buzzer</h3>
                                <Button variant="ghost" size="icon" onClick={() => props.setShowRemoteBuzzer(false)} className="h-8 w-8 text-gray-400 hover:text-white rounded-full">
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="p-4">
                                <RemoteBuzzerPanel roomId={roomId} userId={currentUserId} userName={userProfile.name} isHost={isHost} />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Message Input - Sits at its own level */}
            <div className="relative z-[45]">
                <ChatInput
                    onFileSelect={props.handleFileSelect}
                    // @ts-ignore
                    onStartRecording={props.handleStartMediaRecording}
                    onQuizStart={() => props.setShowQuizSetup(true)}
                    onMoodTrigger={() => props.setShowMoodSetup(true)}
                    onSoundboard={() => props.setShowSoundboard(!props.showSoundboard)}
                    onStartAudioCall={props.handleStartAudioCall}
                    onStartVideoCall={props.handleStartVideoCall}
                    currentUserId={currentUserId}
                />
            </div>

            {/* PRODUCTIVITY MODALS - Portalled for true layout independence */}
            {props.showSharedNotes && renderModal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="w-full max-w-2xl mx-4 bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[85vh] glass-morphism animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/80 backdrop-blur-md">
                            <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-3">
                                <span className="w-2.5 h-2.5 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                                Shared Notes
                            </h3>
                            <Button variant="ghost" size="icon" onClick={() => props.setShowSharedNotes(false)} className="h-9 w-9 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all">
                                <X className="h-5 w-5" />
                            </Button>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <SharedNotesPanel roomId={roomId} userId={currentUserId} userName={userProfile.name} />
                        </div>
                    </div>
                </div>
            )}

            {props.showSharedTaskList && renderModal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="w-full max-w-2xl mx-4 bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[85vh] glass-morphism animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/80 backdrop-blur-md">
                            <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-3">
                                <span className="w-2.5 h-2.5 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                                Shared Task List
                            </h3>
                            <Button variant="ghost" size="icon" onClick={() => props.setShowSharedTaskList(false)} className="h-9 w-9 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all">
                                <X className="h-5 w-5" />
                            </Button>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <SharedTaskListPanel roomId={roomId} userId={currentUserId} userName={userProfile.name} />
                        </div>
                    </div>
                </div>
            )}

            {/* Call and Other Notifications - Portalled for true layout independence */}
            {props.theaterInvite && renderModal(
                <TheaterInviteNotification invite={props.theaterInvite} onAccept={props.handleAcceptTheaterInvite} onDecline={props.handleDeclineTheaterInvite} />
            )}
            {props.gameInvite && renderModal(
                <GameInviteNotification invite={props.gameInvite} onAccept={props.handleAcceptGameInvite} onDecline={props.handleDeclineGameInvite} />
            )}
            {props.presentationInvite && renderModal(
                <PresentationInviteNotification
                    invite={props.presentationInvite}
                    onAccept={props.handleAcceptPresentationInvite}
                    onDecline={props.handleDeclinePresentationInvite}
                />
            )}

            {/* Global Modals - Rendered inline since they manage their own overlays/z-index */}
            <AudioCallModal isOpen={props.showAudioCall} onClose={props.handleEndCall} onAnswer={props.handleAnswerCall} roomId={roomId} currentUser={userProfile.name} currentUserId={currentUserId} callData={props.currentCall || props.incomingCall} isIncoming={!!(props.currentCall || props.incomingCall) && (props.currentCall || props.incomingCall)?.callerId !== currentUserId} onSwitchToVideo={() => props.handleSwitchCallType("video")} />
            <VideoCallModal isOpen={props.showVideoCall} onClose={props.handleEndVideoCall} onAnswer={props.handleAnswerVideoCall} roomId={roomId} currentUser={userProfile.name} currentUserId={currentUserId} callData={props.currentCall || props.incomingCall} isIncoming={!!(props.currentCall || props.incomingCall) && (props.currentCall || props.incomingCall)?.callerId !== currentUserId} onStartWhiteboard={() => props.setShowWhiteboard(true)} onWatchTogether={() => props.setShowTheaterSetup(true)} onSwitchToAudio={() => props.handleSwitchCallType("audio")} />

            {renderModal(
                <>
                    <SettingsModal isOpen={props.showSettings} onClose={() => props.setShowSettings(false)} />
                    <AboutModal isOpen={props.showAbout} onClose={() => props.setShowAbout(false)} />
                </>
            )}
            <MediaRecorder isOpen={props.showMediaRecorder} onClose={() => props.setShowMediaRecorder(false)} mode={props.mediaRecorderMode} onMediaReady={props.handleMediaRecorded} onRecordingStart={() => { }} onRecordingEnd={props.handleStopMediaRecording} />
            <PlaygroundSetupModal isOpen={props.showPlaygroundSetup} onClose={() => props.setShowPlaygroundSetup(false)} onStartGame={props.handleStartPlayground} initialGame={props.playgroundGame} />
            <TheaterSetupModal isOpen={props.showTheaterSetup} onClose={() => props.setShowTheaterSetup(false)} onCreateSession={props.handleCreateTheaterSession} />

            {/* Overlays */}
            {props.showPlayground && props.playgroundConfig && (
                <div className="fixed inset-0 z-50 bg-slate-900 flex items-center justify-center p-4">
                    {props.playgroundConfig.selectedGame === "dots" && (
                        <DotsAndBoxesGameComponent gameConfig={props.playgroundConfig} roomId={roomId} currentUserId={currentUserId} onExit={props.handleExitPlayground} />
                    )}
                    {props.playgroundConfig.selectedGame === "chess" && (
                        <ChessBoard gameConfig={props.playgroundConfig} roomId={roomId} currentUserId={currentUserId} onClose={props.handleExitPlayground} />
                    )}
                    {props.playgroundConfig.selectedGame === "connect4" && (
                        <ConnectFourBoard gameConfig={props.playgroundConfig} roomId={roomId} currentUserId={currentUserId} onClose={props.handleExitPlayground} />
                    )}
                    {props.playgroundConfig.selectedGame === "tictactoe" && (
                        <TicTacToeBoard gameConfig={props.playgroundConfig} roomId={roomId} currentUserId={currentUserId} onClose={props.handleExitPlayground} />
                    )}
                </div>
            )}
            {props.currentTheaterSession && (
                <TheaterFullscreen
                    isOpen={props.showTheaterFullscreen}
                    onClose={props.handleExitTheater}
                    session={props.currentTheaterSession}
                    roomId={roomId}
                    currentUser={userProfile.name}
                    currentUserId={currentUserId}
                    isHost={props.isTheaterHost}
                    messages={messages as any[]}
                    pendingFile={props.pendingMediaFile}
                    onFileProcessed={() => props.setPendingMediaFile(null)}
                />
            )}

            {/* Popups */}
            {props.showLeaveConfirmation && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110]">
                    <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 text-center max-w-md mx-4">
                        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">{isHost ? "Destroy Room?" : "Leave Room?"}</h2>
                        <p className="text-gray-300 mb-6">{isHost ? "This will permanently delete the room and remove all members. This action cannot be undone." : "Are you sure you want to leave this room? You can rejoin later with the room ID."}</p>
                        <div className="flex gap-4 justify-center">
                            <Button onClick={props.handleConfirmLeave} className="bg-red-500 hover:bg-red-600 text-white px-6">{isHost ? "Yes, Destroy" : "Yes, Leave"}</Button>
                            <Button onClick={props.handleCancelLeave} variant="outline" className="border-slate-600 text-white hover:bg-slate-700 bg-transparent px-6">Cancel</Button>
                        </div>
                    </div>
                </div>
            )}

            <QuizSetupModal isOpen={props.showQuizSetup} onClose={() => props.setShowQuizSetup(false)} onStartQuiz={props.handleStartQuiz} />
            <MoodSetupModal isOpen={props.showMoodSetup} onClose={() => props.setShowMoodSetup(false)} roomId={roomId || ""} />
            <WhiteboardModal isOpen={props.showWhiteboard} onClose={() => props.setShowWhiteboard(false)} roomId={roomId} currentUser={currentUserId} />
            <Soundboard isOpen={props.showSoundboard} onClose={() => props.setShowSoundboard(false)} roomId={roomId} userId={currentUserId} userName={userProfile.name} />
            <PasswordEntryModal isOpen={props.showPasswordEntry} roomId={roomId} onSuccess={() => { props.setShowPasswordEntry(false); props.setPasswordValidated(true) }} onCancel={() => props.setShowPasswordEntry(false)} />
            <HostPasswordModal isOpen={props.showHostPassword} roomId={roomId} isProtected={props.roomIsProtected} onClose={() => props.setShowHostPassword(false)} onProtectedChange={props.setRoomIsProtected} />
            <KaraokeSetupModal isOpen={props.showKaraokeSetup} onClose={() => props.setShowKaraokeSetup(false)} onStartSession={props.handleStartKaraoke} />
            {props.currentKaraokeSession && <KaraokePlayer session={props.currentKaraokeSession} onEnd={props.handleExitKaraoke} />}

            {/* Mafia */}
            {props.showMafiaSetup && (
                <MafiaSetupModal onClose={() => props.setShowMafiaSetup(false)} onStartSession={(config) => { props.setMafiaConfig(config); props.setShowMafiaSetup(false); props.setShowMafiaGame(true) }} />
            )}
            {props.showMafiaGame && props.mafiaConfig && (
                <MafiaGame config={props.mafiaConfig} roomId={roomId} userId={currentUserId} userName={userProfile.name} isHost={isHost} onClose={() => { props.setShowMafiaGame(false); props.setMafiaConfig(null) }} />
            )}

            {/* Random Match */}
            {props.showRandomMatch && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[120] p-4 backdrop-blur-sm">
                    <div className="relative">
                        <Button variant="ghost" size="icon" className="absolute -top-4 -right-4 text-white hover:bg-slate-700 bg-slate-800 rounded-full h-8 w-8 z-10 border border-slate-600 shadow-xl" onClick={() => props.setShowRandomMatch(false)}>
                            <X className="h-4 w-4" />
                        </Button>
                        <RandomMatchButton userId={currentUserId} userName={userProfile.name} onConnect={(partnerId, partnerName) => console.log("Connected:", partnerId, partnerName)} onDisconnect={() => console.log("Disconnected")} />
                    </div>
                </div>
            )}

            <BingoSetupModal isOpen={props.showBingoSetup} onClose={() => props.setShowBingoSetup(false)} roomId={roomId} userId={currentUserId} userName={userProfile.name} />
            {props.showBingoGame && <BingoGame roomId={roomId} userId={currentUserId} userName={userProfile.name} />}
            <PresentationSetupModal
                isOpen={props.showPresentationSetup}
                onClose={() => props.setShowPresentationSetup(false)}
                roomId={roomId}
                userId={currentUserId}
                userName={userProfile.name}
                onStartPresentation={(id) => {
                    props.setCurrentPresentationId(id)
                    props.setShowPresentationViewer(true)
                }}
                onJoinPresentation={(id) => {
                    props.setCurrentPresentationId(id)
                    props.setShowPresentationViewer(true)
                }}
            />
            {props.showPresentationViewer && props.currentPresentationId && (
                <PresentationViewer roomId={roomId} userId={currentUserId} userName={userProfile.name} presentationId={props.currentPresentationId} onClose={() => { props.setShowPresentationViewer(false); props.setCurrentPresentationId(null) }} />
            )}
            <BurnerLinkModal isOpen={props.showBurnerLink} onClose={() => props.setShowBurnerLink(false)} roomId={roomId} userId={currentUserId} />
            <GifAvatarPicker isOpen={props.showGifAvatar} onClose={() => props.setShowGifAvatar(false)} onSelectAvatar={(avatarUrl) => { props.setUserAvatar(avatarUrl); props.setShowGifAvatar(false) }} />

            {props.showGameMenu && (
                <GameMenu isOpen={props.showGameMenu} onClose={() => props.setShowGameMenu(false)} roomId={roomId} currentUserId={currentUserId} currentUserName={userProfile.name} currentUserAvatar={userProfile.avatar} onJoinGame={(type, id) => props.setActiveGame({ type, id })} onOpenPlayground={props.onOpenPlayground} />
            )}

            <BreakoutRoomsModal isOpen={props.showBreakoutRooms} onClose={() => props.setShowBreakoutRooms(false)} roomId={roomId} currentUserId={currentUserId} currentUserName={userProfile.name} />
            <PrivacyTermsModal isOpen={props.showPrivacyPolicy || props.showTermsOfService} onClose={() => { props.setShowPrivacyPolicy(false); props.setShowTermsOfService(false) }} type={props.showPrivacyPolicy ? "privacy" : "terms"} />

            {/* Active Game Boards (Join existing) */}
            {props.activeGame && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    {props.activeGame.type === "chess" && (
                        <ChessBoard
                            gameConfig={{
                                gameType: "double",
                                selectedGame: "chess",
                                gameId: props.activeGame.id,
                                players: [], // Will be filled by board logic
                                difficulty: "medium",
                                voiceChatEnabled: false
                            }}
                            roomId={roomId}
                            currentUserId={currentUserId}
                            onClose={() => props.setActiveGame(null)}
                        />
                    )}
                    {props.activeGame.type === "connect4" && (
                        <ConnectFourBoard
                            gameConfig={{
                                gameType: "double",
                                selectedGame: "connect4",
                                gameId: props.activeGame.id,
                                players: [],
                                difficulty: "medium",
                                voiceChatEnabled: false
                            }}
                            roomId={roomId}
                            currentUserId={currentUserId}
                            onClose={() => props.setActiveGame(null)}
                        />
                    )}
                    {props.activeGame.type === "tictactoe" && (
                        <TicTacToeBoard
                            gameConfig={{
                                gameType: "double",
                                selectedGame: "tictactoe",
                                gameId: props.activeGame.id,
                                players: [],
                                difficulty: "medium",
                                voiceChatEnabled: false
                            }}
                            roomId={roomId}
                            currentUserId={currentUserId}
                            onClose={() => props.setActiveGame(null)}
                        />
                    )}
                </div>
            )}

            {/* Password Entry Gate */}
            <PasswordEntryModal isOpen={props.roomIsProtected && !props.passwordValidated} roomId={roomId} onSuccess={() => props.setPasswordValidated(true)} onCancel={onLeave} />
        </>
    )
}
