"use client"

import type React from "react"
import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Mic, MicOff, Volume2, VolumeX, X, Trophy, Clock, Pause, Play, RotateCcw, Settings, Minimize2 } from "lucide-react"
import { PlaygroundSetupModal } from "@/components/playground-setup-modal"
import { AudioVisualizer } from "@/components/audio-visualizer"
import { PrivacyShield } from "@/components/privacy-shield"

import { useGameVoice } from "@/hooks/use-game-voice"
import { useGameSync } from "@/hooks/use-game-sync"
import { Board } from "@/components/games/dots-and-boxes/board"
import type { GameConfig } from "@/components/playground-setup-modal"

interface DotsAndBoxesGameComponentProps {
  gameConfig: GameConfig
  roomId: string
  currentUserId: string
  onExit: () => void
  onMinimize?: () => void
}

export function DotsAndBoxesGameComponent({
  gameConfig,
  roomId,
  currentUserId,
  onExit,
  onMinimize,
}: DotsAndBoxesGameComponentProps) {
  const [gameTime, setGameTime] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [showPauseMenu, setShowPauseMenu] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)

  const {
    isMicMuted,
    isSpeakerMuted,
    isVoiceChatActive,
    isPTTActive,
    localStream,
    handlePushToTalk,
    toggleMicrophone,
    toggleSpeaker,
    cleanupVoice
  } = useGameVoice({ gameConfig, roomId, currentUserId })

  const handleExit = useCallback(() => {
    cleanupVoice()
    onExit()
  }, [cleanupVoice, onExit])

  const {
    gameState,
    isMyTurn,
    isHost,
    isFirstMove,
    makeMove,
    restartGame
  } = useGameSync({ gameConfig, roomId, currentUserId, onExit: handleExit, isPaused })

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  if (!gameState) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-white text-center">
          <div className="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full mx-auto mb-4" />
          <p>Loading game...</p>
        </div>
      </div>
    )
  }

  const currentPlayer = gameState.players[gameState.currentPlayerIndex]
  const isGameFinished = gameState.gameStatus === "finished"
  const winner = isGameFinished ? gameState.players.find((p) => p.id === gameState.winner) : null

  return (
    <PrivacyShield>
      <div className="h-full flex flex-col bg-slate-900 text-white relative">
        {/* Header */}
        <div className="flex items-center justify-between p-2 sm:p-3 bg-slate-800 border-b border-slate-700 min-h-[56px] sm:min-h-[64px] flex-shrink-0">
          <div className="flex items-center gap-2 overflow-hidden flex-1 mr-2">
            <h1 className="text-base sm:text-xl font-bold text-cyan-400 whitespace-nowrap">Dots & Boxes</h1>
            <div className="hidden xs:flex items-center gap-2 ml-2 sm:ml-4 bg-slate-700/50 px-2 py-1 rounded-full overflow-hidden max-w-[120px] sm:max-w-none">
              <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full flex-shrink-0" style={{ backgroundColor: currentPlayer.color }} />
              <span className="font-medium text-[10px] sm:text-sm truncate">
                {currentPlayer.name}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="hidden sm:flex items-center gap-1 text-sm text-gray-400 mr-2">
              <Clock className="w-4 h-4" />
              <span>{formatTime(gameTime)}</span>
            </div>

            {gameConfig.voiceChatEnabled && isVoiceChatActive && (
              <Button
                variant="ghost"
                size="icon"
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full relative transition-all ${isPTTActive ? "bg-green-500 scale-110 shadow-[0_0_10px_rgba(34,197,94,0.6)]" : "bg-slate-700 hover:bg-slate-600"} haptic`}
                onMouseDown={() => handlePushToTalk(true)}
                onMouseUp={() => handlePushToTalk(false)}
                onMouseLeave={() => handlePushToTalk(false)}
                onTouchStart={(e) => { e.preventDefault(); handlePushToTalk(true); }}
                onTouchEnd={() => handlePushToTalk(false)}
              >
                {isPTTActive ? (
                  <div className="flex items-center justify-center">
                    <AudioVisualizer stream={localStream} width={24} height={16} barColor="#ffffff" />
                    <Mic className="w-4 h-4 text-white absolute" />
                  </div>
                ) : (
                  <MicOff className="w-4 h-4 text-gray-400" />
                )}
              </Button>
            )}

            <Button variant="ghost" size="icon" onClick={() => setIsPaused(!isPaused)} className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-700 hover:bg-slate-600 haptic">
              {isPaused ? <Play className="w-4 h-4 sm:w-5 sm:h-5" /> : <Pause className="w-4 h-4 sm:w-5 sm:h-5" />}
            </Button>
            {onMinimize && (
              <Button variant="ghost" size="icon" onClick={onMinimize} className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-700 hover:bg-slate-600 haptic">
                <Minimize2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={handleExit} className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white haptic">
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
          </div>
        </div>

        {/* Board */}
        <Board
          gameState={gameState}
          isPaused={isPaused}
          onMove={makeMove}
          gridSize={gameConfig.gridSize || 5}
          canMove={isMyTurn && (!isFirstMove || isHost || gameConfig.gameType === "single")}
        />

        {/* Footer / Scores */}
        <div className="p-3 sm:p-4 bg-slate-800 border-t border-slate-700 flex justify-center gap-3 sm:gap-6 overflow-x-auto scrollbar-hide flex-shrink-0">
          {gameState.players.map((player) => (
            <div key={player.id} className={`flex items-center gap-2 sm:gap-3 p-2 px-3 sm:px-4 rounded-xl transition-all flex-shrink-0 ${player.id === currentPlayer.id ? "bg-slate-700 ring-2 ring-cyan-500/50" : "bg-slate-900/30"}`}>
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm" style={{ backgroundColor: player.color }}>
                {player.initials}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] sm:text-xs text-gray-400 font-medium uppercase tracking-wider leading-tight">{player.name}</span>
                <span className="text-sm sm:text-lg font-bold text-white leading-tight">{gameState.scores[player.id] || 0}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Overlays */}
        {isPaused && (
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-2xl text-center max-w-xs w-full">
              <h2 className="text-2xl font-bold mb-6 text-cyan-400">Game Paused</h2>
              <div className="flex flex-col gap-4">
                <Button onClick={() => setIsPaused(false)} className="w-full bg-cyan-600 hover:bg-cyan-500 py-6 text-lg"><Play className="mr-2" /> Resume</Button>
                <Button onClick={restartGame} variant="outline" className="w-full border-slate-600 py-6"><RotateCcw className="mr-2" /> Restart</Button>
                <Button onClick={handleExit} variant="ghost" className="w-full text-red-400 hover:bg-red-500/10 hover:text-red-300 py-6"><X className="mr-2" /> Exit Game</Button>
              </div>
            </div>
          </div>
        )}

        {isGameFinished && (
          <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center z-50 animate-in fade-in zoom-in duration-300">
            <div className="bg-slate-800 p-10 rounded-3xl border-2 border-cyan-500/50 shadow-[0_0_50px_rgba(6,182,212,0.3)] text-center max-w-md w-full relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
              <Trophy className="w-20 h-20 text-yellow-400 mx-auto mb-4 animate-bounce" />
              <h2 className="text-4xl font-black mb-2 text-white">Game Over!</h2>
              <p className="text-xl text-gray-400 mb-8">{winner ? `${winner.name} Wins!` : "It's a Draw!"}</p>
              <div className="flex gap-4">
                <Button onClick={restartGame} className="flex-1 bg-cyan-600 hover:bg-cyan-500 py-8 text-xl font-bold">Play Again</Button>
                <Button onClick={handleExit} variant="outline" className="flex-1 border-slate-700 py-8 text-xl font-bold">Main Menu</Button>
              </div>
            </div>
          </div>
        )}
        {showSettingsModal && (
          <PlaygroundSetupModal
            isOpen={showSettingsModal}
            onClose={() => setShowSettingsModal(false)}
            onStartGame={(newConfig) => {
              setShowSettingsModal(false)
              restartGame()
            }}
            initialGame="dots"
            hostName={isHost ? gameState.players[0].name : gameState.players[1].name}
            currentUserId={currentUserId}
          />
        )}
      </div>
    </PrivacyShield>
  )
}
