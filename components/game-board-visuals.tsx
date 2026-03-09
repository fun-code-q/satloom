"use client"

import type { GameState, Line } from "@/utils/games/dots-and-boxes-game"
import { getColorByPrimary } from "@/utils/core/player-colors"

interface GameBoardVisualsProps {
    gameState: GameState
    onLineClick?: (type: 'horizontal' | 'vertical', row: number, col: number) => void
    isInteractive?: boolean
    currentPlayerId?: string
}

export function GameBoardVisuals({
    gameState,
    onLineClick,
    isInteractive = true,
    currentPlayerId,
}: GameBoardVisualsProps) {
    const gridSize = gameState.grid.rows
    const dotSize = 8
    const lineThickness = 4
    const cellSize = 60
    const boardSize = cellSize * gridSize + dotSize

    const isCurrentPlayerTurn =
        currentPlayerId &&
        gameState.players[gameState.currentPlayerIndex]?.id === currentPlayerId

    const canInteract = isInteractive && isCurrentPlayerTurn && gameState.gameStatus === 'playing'

    const handleLineClick = (type: 'horizontal' | 'vertical', row: number, col: number) => {
        if (!canInteract || !onLineClick) return

        const line = type === 'horizontal'
            ? gameState.horizontalLines[row][col]
            : gameState.verticalLines[row][col]

        if (!line.isDrawn) {
            onLineClick(type, row, col)
        }
    }

    const getLineColor = (line: Line): string => {
        if (!line.isDrawn) return '#475569' // slate-600
        if (!line.playerId) return '#64748b' // slate-500

        const player = gameState.players.find(p => p.id === line.playerId)
        return player?.color || '#64748b'
    }

    const getBoxColor = (row: number, col: number): string => {
        const box = gameState.boxes[row][col]
        if (!box.isCompleted || !box.playerId) return 'transparent'

        const player = gameState.players.find(p => p.id === box.playerId)
        if (!player) return 'transparent'

        const colorData = getColorByPrimary(player.color)
        return colorData ? `${colorData.primary}40` : `${player.color}40`
    }

    const getBoxBorderColor = (row: number, col: number): string => {
        const box = gameState.boxes[row][col]
        if (!box.isCompleted || !box.playerId) return 'transparent'

        const player = gameState.players.find(p => p.id === box.playerId)
        return player?.color || 'transparent'
    }

    return (
        <div className="relative inline-block p-4 bg-slate-900 rounded-lg">
            <svg
                width={boardSize}
                height={boardSize}
                className="select-none"
            >
                {/* Boxes (filled areas) */}
                {gameState.boxes.map((row, rowIndex) =>
                    row.map((box, colIndex) => (
                        <rect
                            key={`box-${rowIndex}-${colIndex}`}
                            x={dotSize / 2 + colIndex * cellSize}
                            y={dotSize / 2 + rowIndex * cellSize}
                            width={cellSize}
                            height={cellSize}
                            fill={getBoxColor(rowIndex, colIndex)}
                            stroke={getBoxBorderColor(rowIndex, colIndex)}
                            strokeWidth={box.isCompleted ? 2 : 0}
                            className="transition-all duration-300"
                        />
                    ))
                )}

                {/* Horizontal Lines */}
                {gameState.horizontalLines.map((row, rowIndex) =>
                    row.map((line, colIndex) => {
                        const isDrawn = line.isDrawn
                        const color = getLineColor(line)
                        const isHoverable = canInteract && !isDrawn

                        return (
                            <g key={`h-line-${rowIndex}-${colIndex}`}>
                                <line
                                    x1={dotSize / 2 + colIndex * cellSize}
                                    y1={rowIndex * cellSize}
                                    x2={dotSize / 2 + (colIndex + 1) * cellSize}
                                    y2={rowIndex * cellSize}
                                    stroke={color}
                                    strokeWidth={isDrawn ? lineThickness : 2}
                                    strokeLinecap="round"
                                    className={`transition-all duration-200 ${isHoverable ? 'cursor-pointer hover:stroke-cyan-400' : ''
                                        }`}
                                    onClick={() => handleLineClick('horizontal', rowIndex, colIndex)}
                                    opacity={isDrawn ? 1 : 0.3}
                                />
                                {/* Invisible clickable area for better UX */}
                                {isHoverable && (
                                    <line
                                        x1={dotSize / 2 + colIndex * cellSize}
                                        y1={rowIndex * cellSize}
                                        x2={dotSize / 2 + (colIndex + 1) * cellSize}
                                        y2={rowIndex * cellSize}
                                        stroke="transparent"
                                        strokeWidth={20}
                                        className="cursor-pointer"
                                        onClick={() => handleLineClick('horizontal', rowIndex, colIndex)}
                                    />
                                )}
                            </g>
                        )
                    })
                )}

                {/* Vertical Lines */}
                {gameState.verticalLines.map((row, rowIndex) =>
                    row.map((line, colIndex) => {
                        const isDrawn = line.isDrawn
                        const color = getLineColor(line)
                        const isHoverable = canInteract && !isDrawn

                        return (
                            <g key={`v-line-${rowIndex}-${colIndex}`}>
                                <line
                                    x1={colIndex * cellSize}
                                    y1={dotSize / 2 + rowIndex * cellSize}
                                    x2={colIndex * cellSize}
                                    y2={dotSize / 2 + (rowIndex + 1) * cellSize}
                                    stroke={color}
                                    strokeWidth={isDrawn ? lineThickness : 2}
                                    strokeLinecap="round"
                                    className={`transition-all duration-200 ${isHoverable ? 'cursor-pointer hover:stroke-cyan-400' : ''
                                        }`}
                                    onClick={() => handleLineClick('vertical', rowIndex, colIndex)}
                                    opacity={isDrawn ? 1 : 0.3}
                                />
                                {/* Invisible clickable area for better UX */}
                                {isHoverable && (
                                    <line
                                        x1={colIndex * cellSize}
                                        y1={dotSize / 2 + rowIndex * cellSize}
                                        x2={colIndex * cellSize}
                                        y2={dotSize / 2 + (rowIndex + 1) * cellSize}
                                        stroke="transparent"
                                        strokeWidth={20}
                                        className="cursor-pointer"
                                        onClick={() => handleLineClick('vertical', rowIndex, colIndex)}
                                    />
                                )}
                            </g>
                        )
                    })
                )}

                {/* Dots */}
                {Array.from({ length: gridSize + 1 }).map((_, row) =>
                    Array.from({ length: gridSize + 1 }).map((_, col) => (
                        <circle
                            key={`dot-${row}-${col}`}
                            cx={col * cellSize}
                            cy={row * cellSize}
                            r={dotSize / 2}
                            fill="#94a3b8"
                            className="pointer-events-none"
                        />
                    ))
                )}

                {/* Player Initials in Completed Boxes */}
                {gameState.boxes.map((row, rowIndex) =>
                    row.map((box, colIndex) => {
                        if (!box.isCompleted || !box.playerId) return null

                        const player = gameState.players.find(p => p.id === box.playerId)
                        if (!player) return null

                        return (
                            <text
                                key={`text-${rowIndex}-${colIndex}`}
                                x={dotSize / 2 + colIndex * cellSize + cellSize / 2}
                                y={dotSize / 2 + rowIndex * cellSize + cellSize / 2}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fill={player.color}
                                fontSize="20"
                                fontWeight="bold"
                                className="pointer-events-none select-none"
                            >
                                {player.avatar || player.initials}
                            </text>
                        )
                    })
                )}
            </svg>

            {/* Turn Indicator */}
            {!canInteract && gameState.gameStatus === 'playing' && (
                <div className="absolute top-2 right-2 bg-slate-800/90 backdrop-blur-sm rounded-lg px-3 py-2 border border-slate-700">
                    <p className="text-xs text-gray-400">
                        {isCurrentPlayerTurn ? "Your turn!" : "Waiting for other player..."}
                    </p>
                </div>
            )}
        </div>
    )
}
