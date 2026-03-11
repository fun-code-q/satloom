"use client"

import React from "react"
import { useChatStore } from "../stores/chat-store"
import { useState, useRef } from "react"
import { useTheme } from "../contexts/theme-context"
import { UserPresenceSystem } from "@/utils/infra/user-presence"
import { SpaceBackground } from "./space-background"
import { PrivacyShield } from "./privacy-shield"
import type { CallData } from "@/utils/infra/call-signaling"
import type { TheaterSession, TheaterInvite } from "@/utils/infra/theater-signaling"
import type { GameConfig } from "./playground-setup-modal"
import type { QuizSession, QuizAnswer, QuizResult } from "@/utils/games/quiz-system"
import type { GameInvite } from "@/utils/infra/game-signaling"
import type { Message } from "./message-bubble"

import { useChatHandlers } from "./chat/use-chat-handlers"
import { useChatCalls } from "./chat/use-chat-calls"
import { useChatEffects } from "./chat/use-chat-effects"
import { useChatUIState } from "./chat/use-chat-ui-state"
import { useChatFeatureState } from "./chat/use-chat-feature-state"
import { ChatHeader } from "./chat/chat-header"
import { ChatModals } from "./chat/chat-modals"
import { MoodPlayer } from "./mood/mood-player"
import { KaraokePlayer } from "./karaoke/karaoke-player"
import { FilePreviewModal } from "./chat/file-preview-modal"
import {
  MessageSquare, Users, Settings, Gamepad2, Film, Music, Palette, Phone, Video, Monitor,
  Camera, Zap, Ghost, Dices, Shuffle, Calendar, BarChart2,
  MonitorPlay, FileText, CheckSquare, Globe, Share2,
  Briefcase, Link, Shield, ShieldCheck, Info, BellRing, UserPlus,
  Mic
} from "lucide-react"

interface ChatInterfaceProps {
  roomId: string
  userProfile: { name: string; avatar?: string; currentActivity?: "chat" | "game" | "theater" }
  onLeave: () => void
}

// Generate consistent colors for users
function getUserColor(username: string): string {
  const colors = [
    "#00BCD4", "#E91E63", "#FF9800", "#4CAF50", "#9C27B0",
    "#2196F3", "#FF5722", "#009688", "#673AB7", "#F44336",
    "#03A9F4", "#8BC34A", "#FFC107", "#3F51B5", "#CDDC39",
  ]
  let hash = 0
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

export function ChatInterface({ roomId, userProfile, onLeave }: ChatInterfaceProps) {
  console.log("ChatInterface: Initialized with roomId:", roomId)

  const {
    messages, onlineUsers, setMessages, setOnlineUsers, setReplyingTo, setCurrentUser, setRoomId,
    hasUnreadNotes, hasUnreadTasks, setHasUnreadNotes, setHasUnreadTasks,
    roomMembers, setRoomMembers,
  } = useChatStore()

  // Use modular hooks for state
  const ui = useChatUIState()
  const feature = useChatFeatureState(userProfile.avatar)

  // Destructure for shorthand properties and easier access
  const {
    showGameMenu, setShowGameMenu, activeGame, setActiveGame,
    isMenuOpen, setIsMenuOpen, isMediaMenuOpen, setIsMediaMenuOpen,
    isGamesMenuOpen, setIsGamesMenuOpen, isProductivityMenuOpen, setIsProductivityMenuOpen,
    isSettingsMenuOpen, setIsSettingsMenuOpen, isAppMenuOpen, setIsAppMenuOpen,
    showAudioCall, setShowAudioCall, showVideoCall, setShowVideoCall,
    showSettings, setShowSettings, showAbout, setShowAbout,
    showMediaRecorder, setShowMediaRecorder, mediaRecorderMode, setMediaRecorderMode,
    showWhiteboard, setShowWhiteboard, isWhiteboardMinimized, setIsWhiteboardMinimized,
    showLeaveConfirmation, setShowLeaveConfirmation, showQuizSetup, setShowQuizSetup,
    showQuizResults, setShowQuizResults, showMoodSetup, setShowMoodSetup,
    showSoundboard, setShowSoundboard, showPasswordEntry, setShowPasswordEntry,
    showHostPassword, setShowHostPassword, showKaraokeSetup, setShowKaraokeSetup,
    showMafiaSetup, setShowMafiaSetup, showMafiaGame, setShowMafiaGame,
    showSharedNotes, setShowSharedNotes, showSharedTaskList, setShowSharedTaskList,
    showRemoteBuzzer, setShowRemoteBuzzer, showRandomMatch, setShowRandomMatch,
    showBingoSetup, setShowBingoSetup, showBingoGame, setShowBingoGame,
    showPresentationSetup, setShowPresentationSetup, showPresentationViewer, setShowPresentationViewer,
    isPresentationMinimized, setIsPresentationMinimized,
    isKaraokeMinimized, setIsKaraokeMinimized,
    showBurnerLink, setShowBurnerLink, showGifAvatar, setShowGifAvatar,
    showBreakoutRooms, setShowBreakoutRooms, showPrivacyPolicy, setShowPrivacyPolicy,
    showTermsOfService, setShowTermsOfService, playgroundGame, setPlaygroundGame,
    showPlaygroundSetup, setShowPlaygroundSetup, showPlayground, setShowPlayground,
    playgroundConfig, setPlaygroundConfig, showTheaterSetup, setShowTheaterSetup,
    showTheaterFullscreen, setShowTheaterFullscreen,
    isPlaygroundMinimized, setIsPlaygroundMinimized,
    isMoodSelectorOpen, setIsMoodSelectorOpen,
    showEmojiPicker, setShowEmojiPicker, showChatSearch, setShowChatSearch,
  } = ui

  const [firebaseConnected, setFirebaseConnected] = useState(true)

  const {
    incomingCall, setIncomingCall, currentCall, setCurrentCall, isInCall, setIsInCall,
    currentTheaterSession, setCurrentTheaterSession, theaterInvite, setTheaterInvite,
    isTheaterHost, setIsTheaterHost, currentQuizSession, setCurrentQuizSession,
    quizAnswers, setQuizAnswers, quizResults, setQuizResults,
    quizTimeRemaining, setQuizTimeRemaining, userQuizAnswer, setUserQuizAnswer,
    currentUserMood, setCurrentUserMood, userAvatar, setUserAvatar,
    gameInvite, setGameInvite, pinnedMessageId, setPinnedMessageId,
    pinnedMessage, setPinnedMessage, passwordValidated, setPasswordValidated,
    roomIsProtected, setRoomIsProtected,
    presentationInvite, setPresentationInvite,
    currentKaraokeSession, setCurrentKaraokeSession,
    karaokeInvite, setKaraokeInvite,
    moodBackgroundImage, setMoodBackgroundImage, moodBackgroundMusic, setMoodBackgroundMusic,
    mafiaConfig, setMafiaConfig, currentPresentationId, setCurrentPresentationId,
    whiteboardInvite, setWhiteboardInvite
  } = feature

  // Memoize getUserColor
  const memoizedGetUserColor = React.useMemo(() => getUserColor, [])

  // Refs with proper types
  const fileInputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const quizTimerRef = useRef<NodeJS.Timeout | null>(null)
  const quizSessionUnsubscribeRef = useRef<(() => void) | null>(null)
  const quizAnswersUnsubscribeRef = useRef<(() => void) | null>(null)

  React.useEffect(() => {
    if (roomId) setRoomId(roomId)
    if (userProfile && userProfile.name) setCurrentUser({ name: userProfile.name, avatar: userProfile.avatar })
  }, [roomId, userProfile, setRoomId, setCurrentUser])

  React.useEffect(() => {
    const me = onlineUsers.find(u => u.name === userProfile.name)
    if (me?.isKicked) {
      alert("You have been kicked from the room by the host.")
      onLeave()
    }
  }, [onlineUsers, userProfile.name, onLeave])

  const themeContext = useTheme()
  const userPresence = UserPresenceSystem.getInstance()
  const currentUserId = useRef(userPresence.createUniqueUserId(userProfile.name)).current

  // Room host status (basic check, could be improved)
  const [isHost, setIsHost] = useState(false)

  // --- Custom Hooks ---
  const handlers = useChatHandlers({
    roomId, userProfile, currentUserId, isHost, onLeave,
    setReplyingTo, setShowMediaRecorder, setMediaRecorderMode,
    setShowLeaveConfirmation, setPasswordValidated, setCurrentUserMood, fileInputRef,
    setPendingChatFile: feature.setPendingChatFile
  })

  const calls = useChatCalls({
    roomId, userProfile, currentUserId, isHost,
    onlineUsersCount: onlineUsers.length,
    incomingCall: feature.incomingCall,
    currentCall: feature.currentCall,
    isInCall: feature.isInCall,
    currentTheaterSession: feature.currentTheaterSession,
    isTheaterHost: feature.isTheaterHost,
    theaterInvite: feature.theaterInvite,
    gameInvite: feature.gameInvite,
    currentQuizSession: feature.currentQuizSession,
    quizTimeRemaining: feature.quizTimeRemaining,
    userQuizAnswer: feature.userQuizAnswer,
    currentKaraokeSession: feature.currentKaraokeSession,
    karaokeInvite: feature.karaokeInvite,
    setKaraokeInvite: feature.setKaraokeInvite,
    presentationInvite: feature.presentationInvite,
    playgroundGame,
    setShowAudioCall, setShowVideoCall, setIsInCall,
    setIncomingCall, setCurrentCall,
    setShowTheaterSetup, setShowTheaterFullscreen,
    setCurrentTheaterSession, setTheaterInvite, setIsTheaterHost,
    setShowPlaygroundSetup, setShowPlayground,
    setPlaygroundConfig, setPlaygroundGame,
    setGameInvite, setActiveGame,
    setShowKaraokeSetup, setCurrentKaraokeSession,
    setShowQuizSetup, setCurrentQuizSession,
    setQuizAnswers, setQuizResults,
    setQuizTimeRemaining, setUserQuizAnswer,
    setShowQuizResults, setShowGameMenu,
    setShowSoundboard, setShowMafiaSetup,
    setShowRemoteBuzzer, setShowBingoSetup,
    setShowRandomMatch, setShowWhiteboard,
    setShowPresentationSetup, setPresentationInvite,
    setShowPresentationViewer, setCurrentPresentationId,
    setShowSharedNotes, setShowSharedTaskList,
    setShowBreakoutRooms, setShowBurnerLink,
    setShowGifAvatar, setShowHostPassword,
    setShowSettings, setShowMoodSetup,
    setShowPrivacyPolicy, setShowTermsOfService,
    setShowAbout, quizTimerRef, handleCopyRoomLink: handlers.handleCopyRoomLink
  })

  useChatEffects({
    roomId, userProfile, currentUserId, themeContext,
    messages, setMessages, setOnlineUsers, roomMembers, setRoomMembers, setReplyingTo,
    setIncomingCall, currentCall: feature.currentCall, setCurrentCall, setIsInCall, setShowAudioCall, setShowVideoCall,
    setCurrentQuizSession, setQuizAnswers, setQuizResults, setUserQuizAnswer,
    setShowQuizResults, setQuizTimeRemaining,
    setCurrentTheaterSession, setTheaterInvite, setIsTheaterHost,
    setGameInvite, setKaraokeInvite, setCurrentKaraokeSession: feature.setCurrentKaraokeSession, setPresentationInvite, setWhiteboardInvite, setPinnedMessageId, setPinnedMessage, setIsHost,
    setRoomIsProtected, setPasswordValidated,
    setMoodBackgroundImage, setMoodBackgroundMusic, setMoodPlaylist: feature.setMoodPlaylist,
    showSharedNotes, showSharedTaskList,
    setHasUnreadNotes, setHasUnreadTasks,
    typingTimeoutRef, quizTimerRef, quizSessionUnsubscribeRef, quizAnswersUnsubscribeRef,
    listenForGameInvites: calls.listenForGameInvites,
    startQuizTimer: calls.startQuizTimer,
    handleQuizFinished: calls.handleQuizFinished,
    pinnedMessageId,
    setFirebaseConnected,
    currentUserMood: feature.currentUserMood,
  })

  // --- Render ---
  if (!roomId || roomId.trim() === "") {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900">
        <div className="text-white text-center">
          <div className="text-xl mb-4">Error: Invalid Room ID</div>
          <div className="text-gray-400 mb-4">Room ID: &quot;{roomId}&quot;</div>
          <button onClick={onLeave} className="bg-cyan-500 hover:bg-cyan-600 px-4 py-2 rounded">
            Return to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <PrivacyShield>
      <div className="h-full flex flex-col relative overflow-hidden">
        {/* Room Background - renders below all content */}
        <SpaceBackground backgroundImage={feature.moodBackgroundImage} />

        {/* Mood Player - invisible audio component */}
        <MoodPlayer roomId={roomId} />

        {/* Karaoke Restore Button */}
        {feature.currentKaraokeSession && isKaraokeMinimized && (
          <div className="fixed bottom-24 right-6 z-50 animate-in slide-in-from-right-10 duration-500">
            <button
              onClick={() => setIsKaraokeMinimized(false)}
              className="group relative flex items-center gap-3 bg-slate-900/80 backdrop-blur-xl border border-cyan-500/30 p-2 pr-5 rounded-2xl shadow-2xl shadow-cyan-500/20 hover:border-cyan-400 transition-all active:scale-95"
            >
              <div className="h-10 w-10 bg-cyan-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-600/20 group-hover:scale-110 transition-transform">
                <Mic className="h-5 w-5 text-white" />
              </div>
              <div className="text-left">
                <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest leading-none mb-1">On Stage</p>
                <p className="text-sm font-bold text-white leading-none truncate max-w-[120px]">
                  {feature.currentKaraokeSession.song?.title || "Karaoke"}
                </p>
              </div>
            </button>
          </div>
        )}


        <ChatHeader
          roomId={roomId}
          isHost={isHost}
          currentUserMood={currentUserMood}
          setCurrentUserMood={setCurrentUserMood}
          isMoodSelectorOpen={isMoodSelectorOpen}
          setIsMoodSelectorOpen={setIsMoodSelectorOpen}
          handleCopyRoomLink={handlers.handleCopyRoomLink}
          handleLeaveRoom={handlers.handleLeaveRoom}
          handleUnpinMessage={handlers.handleUnpinMessage}
          mediaGroup={calls.mediaGroup}
          gamesGroup={calls.gamesGroup}
          productivityGroup={calls.productivityGroup}
          settingsGroup={calls.settingsGroup}
          appSettingsGroup={calls.appSettingsGroup}
          menuGroups={calls.menuGroups}
          isMenuOpen={isMenuOpen}
          setIsMenuOpen={setIsMenuOpen}
          isMediaMenuOpen={isMediaMenuOpen}
          setIsMediaMenuOpen={setIsMediaMenuOpen}
          isGamesMenuOpen={isGamesMenuOpen}
          setIsGamesMenuOpen={setIsGamesMenuOpen}
          isProductivityMenuOpen={isProductivityMenuOpen}
          setIsProductivityMenuOpen={setIsProductivityMenuOpen}
          isSettingsMenuOpen={isSettingsMenuOpen}
          setIsSettingsMenuOpen={setIsSettingsMenuOpen}
          isAppMenuOpen={isAppMenuOpen}
          setIsAppMenuOpen={setIsAppMenuOpen}
          onlineUsers={onlineUsers}
          currentUserId={currentUserId}
          currentUserName={userProfile.name}
          pinnedMessage={pinnedMessage}
          onKickUser={handlers.handleKickUser}
          firebaseConnected={firebaseConnected}
          showChatSearch={showChatSearch}
          setShowChatSearch={setShowChatSearch}
          hasUnreadNotes={hasUnreadNotes}
          hasUnreadTasks={hasUnreadTasks}
          roomMembers={roomMembers}
          autoHide={!!(
            showPlayground || activeGame ||
            showTheaterFullscreen ||
            showWhiteboard ||
            showAudioCall || showVideoCall ||
            showPresentationViewer ||
            (currentKaraokeSession && !isKaraokeMinimized) ||
            showBreakoutRooms
          )}
        />

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          onChange={(e) => handlers.handleFileSelect("input", e.target.files?.[0] || e.target.files)}
        />

        <ChatModals
          roomId={roomId}
          userProfile={userProfile}
          currentUserId={currentUserId}
          isHost={isHost}
          onLeave={onLeave}
          messages={messages}
          showEmojiPicker={showEmojiPicker}
          setShowEmojiPicker={setShowEmojiPicker}
          showChatSearch={showChatSearch}
          setShowChatSearch={setShowChatSearch}
          setIsMoodSelectorOpen={setIsMoodSelectorOpen}
          setShowQuizSetup={setShowQuizSetup}
          handleReply={handlers.handleReply}
          handleReact={handlers.handleReact}
          handleDeleteMessage={handlers.handleDeleteMessage}
          handleEditMessage={handlers.handleEditMessage}
          handleCopyMessage={handlers.handleCopyMessage}
          handleVote={handlers.handleVote}
          handleRSVP={handlers.handleRSVP}
          handlePinMessage={handlers.handlePinMessage}
          handleQuizAnswer={calls.handleQuizAnswer}
          handleExitQuiz={calls.handleExitQuiz}
          handleFileSelect={handlers.handleFileSelect}
          handleStartMediaRecording={handlers.handleStartMediaRecording}
          getUserColor={memoizedGetUserColor}
          currentQuizSession={currentQuizSession}
          quizTimeRemaining={quizTimeRemaining}
          quizAnswers={quizAnswers}
          quizResults={quizResults}
          userQuizAnswer={userQuizAnswer}
          showQuizResults={showQuizResults}
          showAudioCall={showAudioCall}
          showVideoCall={showVideoCall}
          incomingCall={incomingCall}
          currentCall={currentCall}
          handleEndCall={calls.handleEndCall}
          handleEndVideoCall={calls.handleEndVideoCall}
          handleAnswerCall={calls.handleAnswerCall}
          handleAnswerVideoCall={calls.handleAnswerVideoCall}
          handleDeclineCall={calls.handleDeclineCall}
          handleStartAudioCall={calls.handleStartAudioCall}
          handleStartVideoCall={calls.handleStartVideoCall}
          presentationInvite={presentationInvite}
          handleAcceptPresentationInvite={calls.handleAcceptPresentationInvite}
          handleDeclinePresentationInvite={calls.handleDeclinePresentationInvite}
          setPresentationInvite={setPresentationInvite}
          showSettings={showSettings}
          setShowSettings={setShowSettings}
          showAbout={showAbout}
          setShowAbout={setShowAbout}
          showMediaRecorder={showMediaRecorder}
          setShowMediaRecorder={setShowMediaRecorder}
          mediaRecorderMode={mediaRecorderMode}
          handleMediaRecorded={handlers.handleMediaRecorded}
          handleStopMediaRecording={handlers.handleStopMediaRecording}
          showWhiteboard={showWhiteboard}
          setShowWhiteboard={setShowWhiteboard}
          isWhiteboardMinimized={isWhiteboardMinimized}
          setIsWhiteboardMinimized={setIsWhiteboardMinimized}
          whiteboardInvite={whiteboardInvite}
          setWhiteboardInvite={setWhiteboardInvite}
          showPlaygroundSetup={showPlaygroundSetup}
          setShowPlaygroundSetup={setShowPlaygroundSetup}
          showPlayground={showPlayground}
          isPlaygroundMinimized={isPlaygroundMinimized}
          setIsPlaygroundMinimized={setIsPlaygroundMinimized}
          playgroundConfig={playgroundConfig}
          handleStartPlayground={calls.handleStartPlayground}
          handleExitPlayground={calls.handleExitPlayground}
          onOpenPlayground={calls.handleOpenPlayground}
          playgroundGame={playgroundGame}
          setPlaygroundGame={setPlaygroundGame}
          showTheaterSetup={showTheaterSetup}
          setShowTheaterSetup={setShowTheaterSetup}
          showTheaterFullscreen={showTheaterFullscreen}
          currentTheaterSession={currentTheaterSession}
          isTheaterHost={isTheaterHost}
          theaterInvite={theaterInvite}
          handleAcceptTheaterInvite={calls.handleAcceptTheaterInvite}
          handleDeclineTheaterInvite={calls.handleDeclineTheaterInvite}
          handleExitTheater={calls.handleExitTheater}
          isTheaterMinimized={ui.isTheaterMinimized}
          setIsTheaterMinimized={ui.setIsTheaterMinimized}
          showQuizSetup={showQuizSetup}
          handleStartQuiz={calls.handleStartQuiz}
          showGameMenu={showGameMenu}
          setShowGameMenu={setShowGameMenu}
          showSoundboard={showSoundboard}
          setShowSoundboard={setShowSoundboard}
          showMafiaSetup={showMafiaSetup}
          setShowMafiaSetup={setShowMafiaSetup}
          showRemoteBuzzer={showRemoteBuzzer}
          setShowRemoteBuzzer={setShowRemoteBuzzer}
          showBingoSetup={showBingoSetup}
          setShowBingoSetup={setShowBingoSetup}
          showRandomMatch={showRandomMatch}
          setShowRandomMatch={setShowRandomMatch}
          showPresentationSetup={showPresentationSetup}
          setShowPresentationSetup={setShowPresentationSetup}
          showPresentationViewer={showPresentationViewer}
          setShowPresentationViewer={setShowPresentationViewer}
          isPresentationMinimized={isPresentationMinimized}
          setIsPresentationMinimized={setIsPresentationMinimized}
          currentPresentationId={currentPresentationId}
          setCurrentPresentationId={setCurrentPresentationId}
          showSharedNotes={showSharedNotes}
          setShowSharedNotes={setShowSharedNotes}
          showSharedTaskList={showSharedTaskList}
          setShowSharedTaskList={setShowSharedTaskList}
          showBreakoutRooms={showBreakoutRooms}
          setShowBreakoutRooms={setShowBreakoutRooms}
          showBurnerLink={showBurnerLink}
          setShowBurnerLink={setShowBurnerLink}
          showGifAvatar={showGifAvatar}
          setShowGifAvatar={setShowGifAvatar}
          showHostPassword={showHostPassword}
          setShowHostPassword={setShowHostPassword}
          showMoodSetup={showMoodSetup}
          setShowMoodSetup={setShowMoodSetup}
          showPrivacyPolicy={showPrivacyPolicy}
          setShowPrivacyPolicy={setShowPrivacyPolicy}
          showTermsOfService={showTermsOfService}
          setShowTermsOfService={setShowTermsOfService}
          gameInvite={gameInvite}
          handleAcceptGameInvite={calls.handleAcceptGameInvite}
          handleDeclineGameInvite={calls.handleDeclineGameInvite}
          handleSwitchCallType={calls.handleSwitchCallType}
          pendingMediaFile={calls.pendingMediaFile}
          setPendingMediaFile={calls.setPendingMediaFile}
          setUserAvatar={setUserAvatar}
          activeGame={activeGame}
          setActiveGame={setActiveGame}
          showPasswordEntry={showPasswordEntry}
          setShowPasswordEntry={setShowPasswordEntry}
          setPasswordValidated={setPasswordValidated}
          roomIsProtected={roomIsProtected}
          passwordValidated={passwordValidated}
          setRoomIsProtected={setRoomIsProtected}
          showKaraokeSetup={showKaraokeSetup}
          setShowKaraokeSetup={setShowKaraokeSetup}
          currentKaraokeSession={currentKaraokeSession}
          isKaraokeMinimized={ui.isKaraokeMinimized}
          setIsKaraokeMinimized={ui.setIsKaraokeMinimized}
          karaokeInvite={karaokeInvite}
          setKaraokeInvite={setKaraokeInvite}
          handleAcceptKaraokeInvite={calls.handleAcceptKaraokeInvite}
          handleDeclineKaraokeInvite={calls.handleDeclineKaraokeInvite}
          handleStartKaraoke={calls.handleStartKaraoke}
          handleExitKaraoke={calls.handleExitKaraoke}
          showMafiaGame={showMafiaGame}
          setShowMafiaGame={setShowMafiaGame}
          mafiaConfig={mafiaConfig}
          setMafiaConfig={setMafiaConfig}
          showBingoGame={showBingoGame}
          showLeaveConfirmation={showLeaveConfirmation}
          handleConfirmLeave={handlers.handleConfirmLeave}
          handleCancelLeave={handlers.handleCancelLeave}
          handleCreateTheaterSession={calls.handleCreateTheaterSession}
        />
      </div>

      {/* Karaoke Stage */}
      {feature.currentKaraokeSession && !isKaraokeMinimized && (
        <KaraokePlayer
          session={feature.currentKaraokeSession}
          onEnd={calls.handleExitKaraoke}
          onMinimize={() => setIsKaraokeMinimized(true)}
        />
      )}

      {/* File Preview before sending */}
      <FilePreviewModal
        fileData={feature.pendingChatFile}
        onClose={() => feature.setPendingChatFile(null)}
        onSend={handlers.handleSendFile}
      />
    </PrivacyShield>
  )
}
