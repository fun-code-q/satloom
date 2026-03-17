import React, { useRef, useEffect, useCallback, useState } from "react"
import { GameState } from "@/utils/games/dots-and-boxes-game"

interface BoardProps {
    gameState: GameState | null
    isPaused: boolean
    onMove: (type: "horizontal" | "vertical", row: number, col: number) => void
    gridSize: number
    canMove: boolean
}

export function Board({ gameState, isPaused, onMove, gridSize, canMove }: BoardProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [selectedDot, setSelectedDot] = useState<{ row: number; col: number } | null>(null)

    const CANVAS_SIZE = 400
    const BOX_SIZE = (CANVAS_SIZE - 80) / gridSize
    const PADDING = 40
    const DOT_RADIUS = 15

    const getDotPosition = useCallback((row: number, col: number) => ({
        x: col * BOX_SIZE + PADDING,
        y: row * BOX_SIZE + PADDING,
    }), [BOX_SIZE, PADDING])

    const findDotAt = useCallback((x: number, y: number): { row: number; col: number } | null => {
        for (let row = 0; row <= gridSize; row++) {
            for (let col = 0; col <= gridSize; col++) {
                const dotPos = getDotPosition(row, col)
                const distance = Math.sqrt((x - dotPos.x) ** 2 + (y - dotPos.y) ** 2)
                if (distance <= DOT_RADIUS * 2) return { row, col }
            }
        }
        return null
    }, [gridSize, getDotPosition])

    const drawGame = useCallback(() => {
        const canvas = canvasRef.current
        if (!canvas || !gameState) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return

        canvas.width = CANVAS_SIZE
        canvas.height = CANVAS_SIZE
        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
        ctx.fillStyle = "#1e293b"
        ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

        // Faint grid lines
        ctx.strokeStyle = "#374151"
        ctx.lineWidth = 1
        ctx.setLineDash([2, 2])
        for (let row = 0; row <= gridSize; row++) {
            for (let col = 0; col < gridSize; col++) {
                if (!gameState.horizontalLines[row][col].isDrawn) {
                    const start = getDotPosition(row, col)
                    const end = getDotPosition(row, col + 1)
                    ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke()
                }
            }
        }
        for (let row = 0; row < gridSize; row++) {
            for (let col = 0; col <= gridSize; col++) {
                if (!gameState.verticalLines[row][col].isDrawn) {
                    const start = getDotPosition(row, col)
                    const end = getDotPosition(row + 1, col)
                    ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke()
                }
            }
        }
        ctx.setLineDash([])

        // Completed lines
        ctx.lineWidth = 4; ctx.lineCap = "round"
        for (let row = 0; row <= gridSize; row++) {
            for (let col = 0; col < gridSize; col++) {
                const line = gameState.horizontalLines[row][col]
                if (line.isDrawn) {
                    const player = gameState.players.find(p => p.id === line.playerId)
                    ctx.strokeStyle = player?.color || "#3b82f6"
                    const start = getDotPosition(row, col); const end = getDotPosition(row, col + 1)
                    ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke()
                }
            }
        }
        for (let row = 0; row < gridSize; row++) {
            for (let col = 0; col <= gridSize; col++) {
                const line = gameState.verticalLines[row][col]
                if (line.isDrawn) {
                    const player = gameState.players.find(p => p.id === line.playerId)
                    ctx.strokeStyle = player?.color || "#3b82f6"
                    const start = getDotPosition(row, col); const end = getDotPosition(row + 1, col)
                    ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke()
                }
            }
        }

        // Boxes
        ctx.font = "bold 16px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
        for (let row = 0; row < gridSize; row++) {
            for (let col = 0; col < gridSize; col++) {
                const box = gameState.boxes[row][col]
                if (box.isCompleted && box.playerId) {
                    const player = gameState.players.find(p => p.id === box.playerId)
                    if (player) {
                        const boxX = col * BOX_SIZE + PADDING; const boxY = row * BOX_SIZE + PADDING
                        ctx.fillStyle = player.color + "40"; ctx.fillRect(boxX, boxY, BOX_SIZE, BOX_SIZE)
                        ctx.fillStyle = player.color; ctx.fillText(player.initials, boxX + BOX_SIZE / 2, boxY + BOX_SIZE / 2)
                    }
                }
            }
        }

        // Dots
        for (let row = 0; row <= gridSize; row++) {
            for (let col = 0; col <= gridSize; col++) {
                const pos = getDotPosition(row, col)
                const isSelected = selectedDot?.row === row && selectedDot?.col === col
                if (isSelected) {
                    ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(pos.x, pos.y, DOT_RADIUS + 5, 0, Math.PI * 2); ctx.stroke()
                }
                ctx.fillStyle = isSelected ? "#fbbf24" : "#64748b"
                ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(pos.x, pos.y, DOT_RADIUS, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
            }
        }
    }, [gameState, selectedDot, gridSize, getDotPosition, BOX_SIZE, PADDING])

    useEffect(() => { drawGame() }, [drawGame])

    const getCanvasPoint = (clientX: number, clientY: number) => {
        const rect = canvasRef.current?.getBoundingClientRect()
        if (!rect) return null
        const scaleX = CANVAS_SIZE / rect.width
        const scaleY = CANVAS_SIZE / rect.height
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        }
    }

    const handleCanvasInteraction = (clientX: number, clientY: number) => {
        if (!gameState || isPaused || !canMove) return
        const point = getCanvasPoint(clientX, clientY)
        if (!point) return

        const clickedDot = findDotAt(point.x, point.y)
        if (!clickedDot) return

        if (!selectedDot) {
            setSelectedDot(clickedDot)
        } else {
            if (selectedDot.row === clickedDot.row && selectedDot.col === clickedDot.col) {
                setSelectedDot(null); return
            }
            const rowDiff = Math.abs(selectedDot.row - clickedDot.row)
            const colDiff = Math.abs(selectedDot.col - clickedDot.col)
            if ((rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1)) {
                const type = rowDiff === 1 ? "vertical" : "horizontal"
                const row = Math.min(selectedDot.row, clickedDot.row)
                const col = Math.min(selectedDot.col, clickedDot.col)
                onMove(type, row, col)
            }
            setSelectedDot(null)
        }
    }

    const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
        event.preventDefault()
        handleCanvasInteraction(event.clientX, event.clientY)
    }

    return (
        <div className="flex-1 flex items-center justify-center p-4">
            <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                className="max-w-full max-h-full rounded-xl shadow-2xl cursor-pointer touch-none haptic-subtle"
                style={{ width: "min(400px, 90vw)", height: "min(400px, 90vw)" }}
            />
        </div>
    )
}
