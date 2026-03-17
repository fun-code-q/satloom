"use client"

import type React from "react"
import { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Mic, MicOff, X, Trophy, Clock, Pause, Play, RotateCcw, Settings, Minimize2 } from "lucide-react"
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
    isVoiceChatActive,
    isPTTActive,
    localStream,
    handlePushToTalk,
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

  useEffect(() => {
    if (gameState?.gameStatus !== "playing" || isPaused) return
    const timer = setInterval(() => setGameTime((prev) => prev + 1), 1000)
    return () => clearInterval(timer)
  }, [gameState?.gameStatus, isPaused])

  useEffect(() => {
    if (gameState?.gameStatus !== "finished") return
    setIsPaused(false)
    setShowPauseMenu(false)
  }, [gameState?.gameStatus])

  const handlePauseToggle = () => {
    if (isPaused) {
      setIsPaused(false)
      setShowPauseMenu(false)
      return
    }
    setIsPaused(true)
    setShowPauseMenu(true)
  }

  const handleResume = () => {
    setIsPaused(false)
    setShowPauseMenu(false)
  }

  const handleRestart = () => {
    restartGame()
    setGameTime(0)
    setIsPaused(false)
    setShowPauseMenu(false)
  }

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
      <div className="game-shell h-full flex flex-col text-white relative p-2 sm:p-0">
        {/* Header */}
        <div className="game-header-bar flex-shrink-0 py-1 sm:py-2 px-2 sm:px-4">
          <div className="flex items-center gap-2 sm:gap-3 overflow-hidden flex-1 mr-2 min-w-0">
            <div className="p-1 sm:p-2 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-lg sm:rounded-xl border border-white/10 shrink-0">
              <Trophy className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-cyan-300" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-lg font-bold text-white whitespace-nowrap tracking-tight leading-tight">Dots & Boxes</h1>
              <div className="flex items-center gap-1 text-[9px] sm:text-xs text-slate-400 mt-0.5">
                <Clock className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" />
                <span className="font-mono text-cyan-400/80">{formatTime(gameTime)}</span>
              </div>
            </div>
            <div className="game-turn-chip hidden sm:flex items-center gap-2 overflow-hidden max-w-[170px]">
              <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: currentPlayer.color }} />
              <span className="font-medium text-[10px] sm:text-xs truncate text-slate-100">{currentPlayer.name}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {gameConfig.voiceChatEnabled && isVoiceChatActive && (
              <Button
                variant="ghost"
                size="icon"
                className={`game-action-btn relative transition-all ${isPTTActive ? "bg-green-500 scale-110 shadow-[0_0_10px_rgba(34,197,94,0.6)] border-green-300/60 text-white" : ""} haptic`}
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

            <Button variant="ghost" size="icon" onClick={handlePauseToggle} className="game-action-btn h-8 w-8 sm:h-10 sm:w-10 haptic">
              {isPaused ? <Play className="w-3.5 h-3.5 sm:w-5 sm:h-5" /> : <Pause className="w-3.5 h-3.5 sm:w-5 sm:h-5" />}
            </Button>
            {onMinimize && (
              <Button variant="ghost" size="icon" onClick={onMinimize} className="game-action-btn h-8 w-8 sm:h-10 sm:w-10 haptic">
                <Minimize2 className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => setShowSettingsModal(true)} className="game-action-btn h-8 w-8 sm:h-10 sm:w-10 haptic">
              <Settings className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleExit} className="game-action-btn h-8 w-8 sm:h-10 sm:w-10 game-action-btn-danger haptic">
              <X className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
            </Button>
          </div>
        </div>

        {/* Board */}
        <div className="flex-1 min-h-0">
          <Board
            gameState={gameState}
            isPaused={isPaused}
            onMove={makeMove}
            gridSize={gameConfig.gridSize || 5}
            canMove={isMyTurn && (!isFirstMove || isHost || gameConfig.gameType === "single")}
          />
        </div>

        {/* Footer / Scores */}
        <div className="px-2 sm:px-4 pb-2 sm:pb-4 pt-1 sm:pt-3 flex-shrink-0">
          <div className="game-info-panel p-1.5 sm:p-3 flex justify-center gap-1.5 sm:gap-4 overflow-x-auto scrollbar-hide">
            {(gameState.players || []).map((player) => (
              <div key={player.id} className={`flex items-center gap-1.5 sm:gap-3 p-1.5 px-2.5 sm:p-2 sm:px-4 rounded-xl transition-all flex-shrink-0 ${player.id === currentPlayer.id ? "bg-slate-700 ring-1 sm:ring-2 ring-cyan-500/50" : "bg-slate-900/30"}`}>
                <div className="w-5 h-5 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-[10px] sm:text-sm" style={{ backgroundColor: player.color }}>
                  {player.initials}
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] sm:text-xs text-gray-400 font-medium uppercase tracking-wider leading-tight">{player.name}</span>
                  <span className="text-xs sm:text-lg font-bold text-white leading-tight">{gameState.scores[player.id] || 0}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Overlays */}
        {showPauseMenu && (
          <div className="game-pause-overlay animate-in fade-in duration-300">
            <div className="game-pause-card">
              <h2 className="game-modal-title text-center mb-2">Game Paused</h2>
              <p className="game-modal-subtitle text-center mb-6">Tap resume to continue this round.</p>
              <div className="space-y-3">
                <Button onClick={handleResume} className="w-full game-modal-btn bg-cyan-600 hover:bg-cyan-500 text-white">
                  <Play className="mr-2 w-4 h-4" /> Resume
                </Button>
                <Button onClick={handleRestart} variant="outline" className="w-full game-modal-btn border-slate-600">
                  <RotateCcw className="mr-2 w-4 h-4" /> Restart
                </Button>
                <Button onClick={() => setShowSettingsModal(true)} className="w-full game-modal-btn bg-slate-700 hover:bg-slate-600 text-white">
                  <Settings className="mr-2 w-4 h-4" /> Game Settings
                </Button>
                <Button onClick={handleExit} variant="ghost" className="w-full text-red-400 hover:bg-red-500/10 hover:text-red-300 py-3 rounded-xl">
                  <X className="mr-2 w-4 h-4" /> Exit Game
                </Button>
              </div>
            </div>
          </div>
        )}

        {isGameFinished && (
          <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center z-50 animate-in fade-in zoom-in duration-300">
            <div className="game-pause-card max-w-md text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
              <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4 animate-bounce" />
              <h2 className="text-3xl sm:text-4xl font-black mb-2 text-white">Game Over!</h2>
              <p className="text-base sm:text-lg text-gray-400 mb-6">{winner ? `${winner.name} Wins!` : "It's a Draw!"}</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={handleRestart} className="flex-1 game-modal-btn bg-cyan-600 hover:bg-cyan-500 text-white font-bold">Play Again</Button>
                <Button onClick={handleExit} variant="outline" className="flex-1 game-modal-btn border-slate-700 font-bold">Main Menu</Button>
              </div>
            </div>
          </div>
        )}
        {showSettingsModal && (
          <PlaygroundSetupModal
            isOpen={showSettingsModal}
            onClose={() => setShowSettingsModal(false)}
            onStartGame={(_newConfig) => {
              setShowSettingsModal(false)
              handleRestart()
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
