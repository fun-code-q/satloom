import { useState } from "react"
import { GameConfig } from "../playground-setup-modal"

export function useChatUIState() {
    const [showGameMenu, setShowGameMenu] = useState(false)
    const [activeGame, setActiveGame] = useState<{ type: "chess" | "connect4" | "tictactoe"; id: string } | null>(null)

    // Dropdown states
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const [isMediaMenuOpen, setIsMediaMenuOpen] = useState(false)
    const [isGamesMenuOpen, setIsGamesMenuOpen] = useState(false)
    const [isProductivityMenuOpen, setIsProductivityMenuOpen] = useState(false)
    const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false)
    const [isAppMenuOpen, setIsAppMenuOpen] = useState(false)

    // Modal visibility states
    const [showAudioCall, setShowAudioCall] = useState(false)
    const [showVideoCall, setShowVideoCall] = useState(false)
    const [showSettings, setShowSettings] = useState(false)
    const [showAbout, setShowAbout] = useState(false)
    const [showMediaRecorder, setShowMediaRecorder] = useState(false)
    const [mediaRecorderMode, setMediaRecorderMode] = useState<"audio" | "video" | "photo">("audio")
    const [showKnockKnock, setShowKnockKnock] = useState(false)
    const [showWhiteboard, setShowWhiteboard] = useState(false)
    const [isWhiteboardMinimized, setIsWhiteboardMinimized] = useState(false)
    const [showLeaveConfirmation, setShowLeaveConfirmation] = useState(false)
    const [showQuizSetup, setShowQuizSetup] = useState(false)
    const [showQuizResults, setShowQuizResults] = useState(false)
    const [showMoodSetup, setShowMoodSetup] = useState(false)
    const [showSoundboard, setShowSoundboard] = useState(false)
    const [showPasswordEntry, setShowPasswordEntry] = useState(false)
    const [showHostPassword, setShowHostPassword] = useState(false)
    const [showKaraokeSetup, setShowKaraokeSetup] = useState(false)
    const [showMafiaSetup, setShowMafiaSetup] = useState(false)
    const [showMafiaGame, setShowMafiaGame] = useState(false)
    const [showSharedNotes, setShowSharedNotes] = useState(false)
    const [showSharedTaskList, setShowSharedTaskList] = useState(false)
    const [showRemoteBuzzer, setShowRemoteBuzzer] = useState(false)
    const [showRandomMatch, setShowRandomMatch] = useState(false)
    const [showBingoSetup, setShowBingoSetup] = useState(false)
    const [showBingoGame, setShowBingoGame] = useState(false)
    const [showPresentationSetup, setShowPresentationSetup] = useState(false)
    const [showPresentationViewer, setShowPresentationViewer] = useState(false)
    const [isPresentationMinimized, setIsPresentationMinimized] = useState(false)
    const [showBurnerLink, setShowBurnerLink] = useState(false)
    const [showGifAvatar, setShowGifAvatar] = useState(false)
    const [showBreakoutRooms, setShowBreakoutRooms] = useState(false)
    const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false)
    const [showTermsOfService, setShowTermsOfService] = useState(false)
    const [showPollCreator, setShowPollCreator] = useState(false)
    const [showEventCreator, setShowEventCreator] = useState(false)
    const [showVanishModal, setShowVanishModal] = useState(false)
    const [showMobileReactions, setShowMobileReactions] = useState(false)

    // Mood & Emoji
    const [isMoodSelectorOpen, setIsMoodSelectorOpen] = useState(false)
    const [showEmojiPicker, setShowEmojiPicker] = useState(false)
    const [showChatSearch, setShowChatSearch] = useState(false)

    // Game specific state
    const [playgroundGame, setPlaygroundGame] = useState<"dots" | "chess" | "tictactoe" | "connect4">("dots")
    const [showPlaygroundSetup, setShowPlaygroundSetup] = useState(false)
    const [showPlayground, setShowPlayground] = useState(false)
    const [playgroundConfig, setPlaygroundConfig] = useState<GameConfig | null>(null)

    // Theater state
    const [showTheaterSetup, setShowTheaterSetup] = useState(false)
    const [showTheaterFullscreen, setShowTheaterFullscreen] = useState(false)
    const [isTheaterMinimized, setIsTheaterMinimized] = useState(false)
    const [isKaraokeMinimized, setIsKaraokeMinimized] = useState(false)

    const [isPlaygroundMinimized, setIsPlaygroundMinimized] = useState(false)
    const [isQuizMinimized, setIsQuizMinimized] = useState(false)

    return {
        showGameMenu, setShowGameMenu,
        activeGame, setActiveGame,
        isMenuOpen, setIsMenuOpen,
        isMediaMenuOpen, setIsMediaMenuOpen,
        isGamesMenuOpen, setIsGamesMenuOpen,
        isProductivityMenuOpen, setIsProductivityMenuOpen,
        isSettingsMenuOpen, setIsSettingsMenuOpen,
        isAppMenuOpen, setIsAppMenuOpen,
        showAudioCall, setShowAudioCall,
        showVideoCall, setShowVideoCall,
        showSettings, setShowSettings,
        showAbout, setShowAbout,
        showMediaRecorder, setShowMediaRecorder,
        mediaRecorderMode, setMediaRecorderMode,
        showKnockKnock, setShowKnockKnock,
        showWhiteboard, setShowWhiteboard,
        isWhiteboardMinimized, setIsWhiteboardMinimized,
        showLeaveConfirmation, setShowLeaveConfirmation,
        showQuizSetup, setShowQuizSetup,
        showQuizResults, setShowQuizResults,
        showMoodSetup, setShowMoodSetup,
        showSoundboard, setShowSoundboard,
        showPasswordEntry, setShowPasswordEntry,
        showHostPassword, setShowHostPassword,
        showKaraokeSetup, setShowKaraokeSetup,
        showMafiaSetup, setShowMafiaSetup,
        showMafiaGame, setShowMafiaGame,
        showSharedNotes, setShowSharedNotes,
        showSharedTaskList, setShowSharedTaskList,
        showRemoteBuzzer, setShowRemoteBuzzer,
        showRandomMatch, setShowRandomMatch,
        showBingoSetup, setShowBingoSetup,
        showBingoGame, setShowBingoGame,
        showPresentationSetup, setShowPresentationSetup,
        showPresentationViewer, setShowPresentationViewer,
        isPresentationMinimized, setIsPresentationMinimized,
        showBurnerLink, setShowBurnerLink,
        showGifAvatar, setShowGifAvatar,
        showBreakoutRooms, setShowBreakoutRooms,
        showPrivacyPolicy, setShowPrivacyPolicy,
        showTermsOfService, setShowTermsOfService,
        showPollCreator, setShowPollCreator,
        showEventCreator, setShowEventCreator,
        showVanishModal, setShowVanishModal,
        showMobileReactions, setShowMobileReactions,
        playgroundGame, setPlaygroundGame,
        showPlaygroundSetup, setShowPlaygroundSetup,
        showPlayground, setShowPlayground,
        playgroundConfig, setPlaygroundConfig,
        showTheaterSetup, setShowTheaterSetup,
        showTheaterFullscreen, setShowTheaterFullscreen,
        isTheaterMinimized, setIsTheaterMinimized,
        isKaraokeMinimized, setIsKaraokeMinimized,
        isPlaygroundMinimized, setIsPlaygroundMinimized,
        isQuizMinimized, setIsQuizMinimized,
        isMoodSelectorOpen, setIsMoodSelectorOpen,
        showEmojiPicker, setShowEmojiPicker,
        showChatSearch, setShowChatSearch,
    }
}
