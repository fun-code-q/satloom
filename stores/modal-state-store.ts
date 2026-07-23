/**
 * Modal-state store — Phase 11 / C1.
 *
 * Centralised open/close booleans for every dialog, drawer, popover,
 * and overlay panel in the chat UI. Replaces the prop drill from
 * `ChatInterface` → `ChatModals` (~50 boolean + setter prop pairs)
 * with a single Zustand store every modal can subscribe to.
 *
 * Why this is *just* the open-state and not all chat state:
 *
 *   The original "useChatFeatureState" hook (kept untouched) holds
 *   *data* state — current call, current quiz session, theater session,
 *   etc. That data legitimately threads through props because it has
 *   lifecycle implications and is scoped to the room session. Modal
 *   open-state is the pure-UI subset that benefits from being global:
 *   any handler anywhere can open the settings modal without needing
 *   the open-setter wired through props.
 *
 * Migration plan:
 *
 *   1. `useChatUIState` (the existing hook) now reads from this store
 *      via a flat shape so existing call sites compile unchanged.
 *   2. `ChatModals` and any other consumer can subscribe to fields
 *      individually with `useModalStateStore(s => s.showAbout)` rather
 *      than receiving them as props.
 *   3. Over time, props in `ChatModalsProps` get deleted as their
 *      consumers switch to direct subscription.
 */

import { create } from "zustand"
import { useShallow } from "zustand/react/shallow"
import type { GameConfig } from "@/components/playground-setup-modal"

type ActiveGame = { type: "chess" | "connect4" | "tictactoe"; id: string } | null
type MediaRecorderMode = "audio" | "video" | "photo"
type PlaygroundGame = "dots" | "chess" | "tictactoe" | "connect4"

interface ModalState {
    // Top-level menus
    showGameMenu: boolean
    activeGame: ActiveGame
    isMenuOpen: boolean
    isMediaMenuOpen: boolean
    isGamesMenuOpen: boolean
    isProductivityMenuOpen: boolean
    isSettingsMenuOpen: boolean
    isAppMenuOpen: boolean

    // Modal visibility
    showAudioCall: boolean
    showVideoCall: boolean
    showSettings: boolean
    showAbout: boolean
    showMediaRecorder: boolean
    mediaRecorderMode: MediaRecorderMode
    showKnockKnock: boolean
    showWhiteboard: boolean
    isWhiteboardMinimized: boolean
    showLeaveConfirmation: boolean
    showQuizSetup: boolean
    showQuizResults: boolean
    showMoodSetup: boolean
    showSoundboard: boolean
    showPasswordEntry: boolean
    showHostPassword: boolean
    showKaraokeSetup: boolean
    showMafiaSetup: boolean
    showMafiaGame: boolean
    showSharedNotes: boolean
    showSharedTaskList: boolean
    showRemoteBuzzer: boolean
    showRandomMatch: boolean
    showBingoSetup: boolean
    showBingoGame: boolean
    showPresentationSetup: boolean
    showPresentationViewer: boolean
    isPresentationMinimized: boolean
    showBurnerLink: boolean
    showGifAvatar: boolean
    showBreakoutRooms: boolean
    showPrivacyPolicy: boolean
    showTermsOfService: boolean
    showPollCreator: boolean
    showEventCreator: boolean
    showVanishModal: boolean
    showMobileReactions: boolean

    // Mood, emoji, search
    isMoodSelectorOpen: boolean
    showEmojiPicker: boolean
    showChatSearch: boolean
    showParticipants: boolean

    // Playground (turn-based games)
    playgroundGame: PlaygroundGame
    showPlaygroundSetup: boolean
    showPlayground: boolean
    playgroundConfig: GameConfig | null
    showGameSeriesViewer: boolean

    // Theater
    showTheaterSetup: boolean
    showTheaterFullscreen: boolean
    isTheaterMinimized: boolean
    isKaraokeMinimized: boolean
    isPlaygroundMinimized: boolean
    isQuizMinimized: boolean

    // Setters (suffixed `set*`). Kept in the store so existing call
    // sites that destructure `{ showAbout, setShowAbout }` work unchanged.
    setShowGameMenu: (v: boolean) => void
    setActiveGame: (v: ActiveGame) => void
    setIsMenuOpen: (v: boolean) => void
    setIsMediaMenuOpen: (v: boolean) => void
    setIsGamesMenuOpen: (v: boolean) => void
    setIsProductivityMenuOpen: (v: boolean) => void
    setIsSettingsMenuOpen: (v: boolean) => void
    setIsAppMenuOpen: (v: boolean) => void

    setShowAudioCall: (v: boolean) => void
    setShowVideoCall: (v: boolean) => void
    setShowSettings: (v: boolean) => void
    setShowAbout: (v: boolean) => void
    setShowMediaRecorder: (v: boolean) => void
    setMediaRecorderMode: (v: MediaRecorderMode) => void
    setShowKnockKnock: (v: boolean) => void
    setShowWhiteboard: (v: boolean) => void
    setIsWhiteboardMinimized: (v: boolean) => void
    setShowLeaveConfirmation: (v: boolean) => void
    setShowQuizSetup: (v: boolean) => void
    setShowQuizResults: (v: boolean) => void
    setShowMoodSetup: (v: boolean) => void
    setShowSoundboard: (v: boolean) => void
    setShowPasswordEntry: (v: boolean) => void
    setShowHostPassword: (v: boolean) => void
    setShowKaraokeSetup: (v: boolean) => void
    setShowMafiaSetup: (v: boolean) => void
    setShowMafiaGame: (v: boolean) => void
    setShowSharedNotes: (v: boolean) => void
    setShowSharedTaskList: (v: boolean) => void
    setShowRemoteBuzzer: (v: boolean) => void
    setShowRandomMatch: (v: boolean) => void
    setShowBingoSetup: (v: boolean) => void
    setShowBingoGame: (v: boolean) => void
    setShowPresentationSetup: (v: boolean) => void
    setShowPresentationViewer: (v: boolean) => void
    setIsPresentationMinimized: (v: boolean) => void
    setShowBurnerLink: (v: boolean) => void
    setShowGifAvatar: (v: boolean) => void
    setShowBreakoutRooms: (v: boolean) => void
    setShowPrivacyPolicy: (v: boolean) => void
    setShowTermsOfService: (v: boolean) => void
    setShowPollCreator: (v: boolean) => void
    setShowEventCreator: (v: boolean) => void
    setShowVanishModal: (v: boolean) => void
    setShowMobileReactions: (v: boolean) => void

    setIsMoodSelectorOpen: (v: boolean) => void
    setShowEmojiPicker: (v: boolean) => void
    setShowChatSearch: (v: boolean) => void
    setShowParticipants: (v: boolean) => void

    setPlaygroundGame: (v: PlaygroundGame) => void
    setShowPlaygroundSetup: (v: boolean) => void
    setShowPlayground: (v: boolean) => void
    setPlaygroundConfig: (v: GameConfig | null) => void
    setShowGameSeriesViewer: (v: boolean) => void

    setShowTheaterSetup: (v: boolean) => void
    setShowTheaterFullscreen: (v: boolean) => void
    setIsTheaterMinimized: (v: boolean) => void
    setIsKaraokeMinimized: (v: boolean) => void
    setIsPlaygroundMinimized: (v: boolean) => void
    setIsQuizMinimized: (v: boolean) => void
}

export const useModalStateStore = create<ModalState>((set) => ({
    showGameMenu: false,
    activeGame: null,
    isMenuOpen: false,
    isMediaMenuOpen: false,
    isGamesMenuOpen: false,
    isProductivityMenuOpen: false,
    isSettingsMenuOpen: false,
    isAppMenuOpen: false,

    showAudioCall: false,
    showVideoCall: false,
    showSettings: false,
    showAbout: false,
    showMediaRecorder: false,
    mediaRecorderMode: "audio",
    showKnockKnock: false,
    showWhiteboard: false,
    isWhiteboardMinimized: false,
    showLeaveConfirmation: false,
    showQuizSetup: false,
    showQuizResults: false,
    showMoodSetup: false,
    showSoundboard: false,
    showPasswordEntry: false,
    showHostPassword: false,
    showKaraokeSetup: false,
    showMafiaSetup: false,
    showMafiaGame: false,
    showSharedNotes: false,
    showSharedTaskList: false,
    showRemoteBuzzer: false,
    showRandomMatch: false,
    showBingoSetup: false,
    showBingoGame: false,
    showPresentationSetup: false,
    showPresentationViewer: false,
    isPresentationMinimized: false,
    showBurnerLink: false,
    showGifAvatar: false,
    showBreakoutRooms: false,
    showPrivacyPolicy: false,
    showTermsOfService: false,
    showPollCreator: false,
    showEventCreator: false,
    showVanishModal: false,
    showMobileReactions: false,

    isMoodSelectorOpen: false,
    showEmojiPicker: false,
    showChatSearch: false,
    showParticipants: false,

    playgroundGame: "dots",
    showPlaygroundSetup: false,
    showPlayground: false,
    playgroundConfig: null,
    showGameSeriesViewer: false,

    showTheaterSetup: false,
    showTheaterFullscreen: false,
    isTheaterMinimized: false,
    isKaraokeMinimized: false,
    isPlaygroundMinimized: false,
    isQuizMinimized: false,

    setShowGameMenu: (v) => set({ showGameMenu: v }),
    setActiveGame: (v) => set({ activeGame: v }),
    setIsMenuOpen: (v) => set({ isMenuOpen: v }),
    setIsMediaMenuOpen: (v) => set({ isMediaMenuOpen: v }),
    setIsGamesMenuOpen: (v) => set({ isGamesMenuOpen: v }),
    setIsProductivityMenuOpen: (v) => set({ isProductivityMenuOpen: v }),
    setIsSettingsMenuOpen: (v) => set({ isSettingsMenuOpen: v }),
    setIsAppMenuOpen: (v) => set({ isAppMenuOpen: v }),

    setShowAudioCall: (v) => set({ showAudioCall: v }),
    setShowVideoCall: (v) => set({ showVideoCall: v }),
    setShowSettings: (v) => set({ showSettings: v }),
    setShowAbout: (v) => set({ showAbout: v }),
    setShowMediaRecorder: (v) => set({ showMediaRecorder: v }),
    setMediaRecorderMode: (v) => set({ mediaRecorderMode: v }),
    setShowKnockKnock: (v) => set({ showKnockKnock: v }),
    setShowWhiteboard: (v) => set({ showWhiteboard: v }),
    setIsWhiteboardMinimized: (v) => set({ isWhiteboardMinimized: v }),
    setShowLeaveConfirmation: (v) => set({ showLeaveConfirmation: v }),
    setShowQuizSetup: (v) => set({ showQuizSetup: v }),
    setShowQuizResults: (v) => set({ showQuizResults: v }),
    setShowMoodSetup: (v) => set({ showMoodSetup: v }),
    setShowSoundboard: (v) => set({ showSoundboard: v }),
    setShowPasswordEntry: (v) => set({ showPasswordEntry: v }),
    setShowHostPassword: (v) => set({ showHostPassword: v }),
    setShowKaraokeSetup: (v) => set({ showKaraokeSetup: v }),
    setShowMafiaSetup: (v) => set({ showMafiaSetup: v }),
    setShowMafiaGame: (v) => set({ showMafiaGame: v }),
    setShowSharedNotes: (v) => set({ showSharedNotes: v }),
    setShowSharedTaskList: (v) => set({ showSharedTaskList: v }),
    setShowRemoteBuzzer: (v) => set({ showRemoteBuzzer: v }),
    setShowRandomMatch: (v) => set({ showRandomMatch: v }),
    setShowBingoSetup: (v) => set({ showBingoSetup: v }),
    setShowBingoGame: (v) => set({ showBingoGame: v }),
    setShowPresentationSetup: (v) => set({ showPresentationSetup: v }),
    setShowPresentationViewer: (v) => set({ showPresentationViewer: v }),
    setIsPresentationMinimized: (v) => set({ isPresentationMinimized: v }),
    setShowBurnerLink: (v) => set({ showBurnerLink: v }),
    setShowGifAvatar: (v) => set({ showGifAvatar: v }),
    setShowBreakoutRooms: (v) => set({ showBreakoutRooms: v }),
    setShowPrivacyPolicy: (v) => set({ showPrivacyPolicy: v }),
    setShowTermsOfService: (v) => set({ showTermsOfService: v }),
    setShowPollCreator: (v) => set({ showPollCreator: v }),
    setShowEventCreator: (v) => set({ showEventCreator: v }),
    setShowVanishModal: (v) => set({ showVanishModal: v }),
    setShowMobileReactions: (v) => set({ showMobileReactions: v }),

    setIsMoodSelectorOpen: (v) => set({ isMoodSelectorOpen: v }),
    setShowEmojiPicker: (v) => set({ showEmojiPicker: v }),
    setShowChatSearch: (v) => set({ showChatSearch: v }),
    setShowParticipants: (v) => set({ showParticipants: v }),

    setPlaygroundGame: (v) => set({ playgroundGame: v }),
    setShowPlaygroundSetup: (v) => set({ showPlaygroundSetup: v }),
    setShowPlayground: (v) => set({ showPlayground: v }),
    setPlaygroundConfig: (v) => set({ playgroundConfig: v }),
    setShowGameSeriesViewer: (v) => set({ showGameSeriesViewer: v }),

    setShowTheaterSetup: (v) => set({ showTheaterSetup: v }),
    setShowTheaterFullscreen: (v) => set({ showTheaterFullscreen: v }),
    setIsTheaterMinimized: (v) => set({ isTheaterMinimized: v }),
    setIsKaraokeMinimized: (v) => set({ isKaraokeMinimized: v }),
    setIsPlaygroundMinimized: (v) => set({ isPlaygroundMinimized: v }),
    setIsQuizMinimized: (v) => set({ isQuizMinimized: v }),
}))

// Convenience selector hook for components that want every field at once
// (matches the shape `useChatUIState` returned before the refactor).
export function useModalState() {
    return useModalStateStore(useShallow((s) => s))
}
