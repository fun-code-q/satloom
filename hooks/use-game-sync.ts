import { useState, useEffect, useRef, useCallback } from "react"
import { DotsAndBoxesGame, type GameState, type Player } from "@/utils/games/dots-and-boxes-game"
import { GameSignaling } from "@/utils/infra/game-signaling"
import { GameSounds } from "@/utils/games/game-sounds"
import { NotificationSystem } from "@/utils/core/notification-system"
import { GameConfig } from "@/components/playground-setup-modal"

interface UseGameSyncProps {
    gameConfig: GameConfig
    roomId: string
    currentUserId: string
    onExit: () => void
    isPaused: boolean
}

export function useGameSync({ gameConfig, roomId, currentUserId, onExit, isPaused }: UseGameSyncProps) {
    const [game, setGame] = useState<DotsAndBoxesGame | null>(null)
    const [gameState, setGameState] = useState<GameState | null>(null)
    const [isMyTurn, setIsMyTurn] = useState(false)
    const [isHost, setIsHost] = useState(false)
    const [isFirstMove, setIsFirstMove] = useState(true)
    const [hostId, setHostId] = useState<string>("")

    const computerMoveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const gameId = useRef(
        gameConfig.gameId || `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    ).current

    const gameSignaling = GameSignaling.getInstance()
    const gameSounds = GameSounds.getInstance()
    const notificationSystem = NotificationSystem.getInstance()

    const exitRef = useRef(onExit)
    useEffect(() => {
        exitRef.current = onExit
    }, [onExit])

    // Initialize game
    useEffect(() => {
        const forcedHost = true // Initial creator is host
        setIsHost(forcedHost)
        setHostId(currentUserId)

        const players: Player[] = gameConfig.players.map((p, index) => ({
            ...p,
            id: index === 0 ? currentUserId : p.id,
            initials: p.name.substring(0, 2).toUpperCase(),
            color: p.color || "#3b82f6",
            isComputer: p.isComputer ?? false,
            isHost: index === 0,
            status: 'active' as const,
            isReady: true,
            joinedAt: Date.now(),
            lastSeen: Date.now(),
        }))

        const newGame = new DotsAndBoxesGame(gameId, roomId, players, gameConfig.gridSize, gameConfig.voiceChatEnabled)
        setGame(newGame)

        newGame.startGame()
        const updatedState = newGame.getGameState()
        setGameState(updatedState)

        const currentPlayer = updatedState.players[updatedState.currentPlayerIndex]
        const myTurn = gameConfig.gameType === "single" ? !currentPlayer.isComputer : currentPlayer.id === currentUserId
        setIsMyTurn(myTurn)

        if (gameConfig.gameType !== "single" && forcedHost) {
            gameSignaling.createGame(roomId, gameId, updatedState)
            gameSignaling.listenForHostStatus(roomId, gameId, (isHostActive) => {
                if (!isHostActive && !forcedHost) {
                    notificationSystem.error("Game host has left. Returning to chat.")
                    setTimeout(() => exitRef.current(), 2000)
                }
            })
        }

        return () => {
            if (computerMoveTimeoutRef.current) clearTimeout(computerMoveTimeoutRef.current)
        }
    }, [gameId, roomId, currentUserId, gameConfig.gameType, gameConfig.gridSize, gameConfig.voiceChatEnabled])

    // Multiplayer updates
    useEffect(() => {
        if (!game || !gameState || gameConfig.gameType === "single") return

        const unsubscribe = gameSignaling.listenForGame(roomId, gameId, (updatedState) => {
            setGameState(updatedState)
            game.updateGameState(updatedState)
            const currentPlayer = updatedState.players[updatedState.currentPlayerIndex]
            setIsMyTurn(currentPlayer.id === currentUserId)
            if (updatedState.moveCount > 0) setIsFirstMove(false)
        })

        return () => unsubscribe()
    }, [game, gameConfig.gameType, roomId, gameId, currentUserId])

    // AI Moves
    useEffect(() => {
        if (!game || !gameState || gameState.gameStatus !== "playing" || isPaused) return

        const currentPlayer = gameState.players[gameState.currentPlayerIndex]

        if (currentPlayer.isComputer && gameConfig.gameType === "single") {
            if (computerMoveTimeoutRef.current) clearTimeout(computerMoveTimeoutRef.current)

            computerMoveTimeoutRef.current = setTimeout(() => {
                if (game.makeComputerMove()) {
                    const updatedState = game.getGameState()
                    setGameState(updatedState)
                    gameSounds.playLineDrawn()
                    if (updatedState.lastMove && updatedState.lastMove.boxesCompleted > 0) {
                        gameSounds.playBoxCompleted()
                    } else {
                        gameSounds.playTurnChange()
                    }
                    if (updatedState.gameStatus === "finished") gameSounds.playGameEnd()
                }
            }, 800 + Math.random() * 800)
        }
    }, [game, gameState, gameConfig.gameType, isPaused])

    const makeMove = useCallback((type: "horizontal" | "vertical", row: number, col: number) => {
        if (!game || !gameState || !isMyTurn) return false

        const success = game.makeMove(currentUserId, type, row, col)
        if (success) {
            const updatedState = game.getGameState()
            setGameState(updatedState)

            if (gameConfig.gameType !== "single") {
                gameSignaling.updateGame(roomId, gameId, updatedState)
                if (isFirstMove) setIsFirstMove(false)
            }

            gameSounds.playLineDrawn()
            if (updatedState.lastMove && updatedState.lastMove.boxesCompleted > 0) {
                gameSounds.playBoxCompleted()
            } else {
                gameSounds.playTurnChange()
            }

            if (updatedState.gameStatus === "finished") gameSounds.playGameEnd()
            return true
        }
        return false
    }, [game, gameState, isMyTurn, currentUserId, gameConfig.gameType, roomId, gameId, isFirstMove])

    return {
        game,
        gameState,
        isMyTurn,
        isHost,
        isFirstMove,
        hostId,
        gameId,
        makeMove,
        restartGame: () => {
            if (game) {
                game.startGame()
                const updatedState = game.getGameState()
                setGameState(updatedState)
                setIsFirstMove(true)
                if (gameConfig.gameType !== "single") {
                    gameSignaling.updateGame(roomId, gameId, updatedState)
                }
            }
        }
    }
}
