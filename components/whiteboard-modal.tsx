"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { X, Eraser, Download, Trash2, Palette, Undo, Redo } from "lucide-react"
import { getFirebaseDatabase } from "@/lib/firebase"
import { ref, onValue, push, remove, set, get } from "firebase/database"
import { Slider } from "@/components/ui/slider"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface WhiteboardModalProps {
    isOpen: boolean
    onClose: () => void
    roomId: string
    currentUser: string
}

interface Point {
    x: number
    y: number
}

interface Line {
    id: string
    points: Point[]
    color: string
    width: number
    userId: string
}

export function WhiteboardModal({ isOpen, onClose, roomId, currentUser }: WhiteboardModalProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [isDrawing, setIsDrawing] = useState(false)
    const [color, setColor] = useState("#000000")
    const [brushSize, setBrushSize] = useState(5)
    const [lines, setLines] = useState<Line[]>([])
    const [currentLine, setCurrentLine] = useState<Point[]>([])
    const [isErasing, setIsErasing] = useState(false)

    // Colors palette
    const colors = [
        "#000000", "#ef4444", "#22c55e", "#3b82f6", "#eab308",
        "#a855f7", "#ec4899", "#f97316", "#ffffff", "#64748b"
    ]

    // Initialize canvas and formatting
    useEffect(() => {
        if (!isOpen || !canvasRef.current) return

        const canvas = canvasRef.current
        const ctx = canvas.getContext("2d")
        if (!ctx) return

        // Set canvas size to parent container
        const resizeCanvas = () => {
            const parent = canvas.parentElement
            if (parent) {
                canvas.width = parent.clientWidth
                canvas.height = parent.clientHeight
                // Redraw content after resize
                drawLines(ctx, lines)
            }
        }

        resizeCanvas()
        window.addEventListener("resize", resizeCanvas)

        return () => {
            window.removeEventListener("resize", resizeCanvas)
        }
    }, [isOpen, lines])

    // Listen for whiteboard data from Firebase
    useEffect(() => {
        if (!isOpen || !roomId) return

        const db = getFirebaseDatabase()
        if (!db) return

        const whiteboardRef = ref(db, `whiteboards/${roomId}`)
        const unsubscribe = onValue(whiteboardRef, (snapshot) => {
            const data = snapshot.val()
            if (data) {
                const loadedLines: Line[] = Object.entries(data).map(([key, value]: [string, any]) => ({
                    id: key,
                    ...value
                }))
                setLines(loadedLines)

                // Redraw
                const canvas = canvasRef.current
                const ctx = canvas?.getContext("2d")
                if (canvas && ctx) {
                    // Clear and redraw
                    ctx.clearRect(0, 0, canvas.width, canvas.height)
                    drawLines(ctx, loadedLines)
                }
            } else {
                setLines([])
                const canvas = canvasRef.current
                const ctx = canvas?.getContext("2d")
                if (canvas && ctx) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height)
                }
            }
        })

        return () => unsubscribe()
    }, [isOpen, roomId])

    const drawLines = (ctx: CanvasRenderingContext2D, linesToDraw: Line[]) => {
        ctx.lineCap = "round"
        ctx.lineJoin = "round"

        linesToDraw.forEach(line => {
            if (line.points.length < 2) return

            ctx.beginPath()
            ctx.strokeStyle = line.color
            ctx.lineWidth = line.width
            ctx.moveTo(line.points[0].x, line.points[0].y)

            for (let i = 1; i < line.points.length; i++) {
                ctx.lineTo(line.points[i].x, line.points[i].y)
            }
            ctx.stroke()
        })
    }

    const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
        if (!canvasRef.current) return null

        const canvas = canvasRef.current
        const rect = canvas.getBoundingClientRect()

        let clientX, clientY

        if ('touches' in e) {
            clientX = e.touches[0].clientX
            clientY = e.touches[0].clientY
        } else {
            clientX = (e as React.MouseEvent).clientX
            clientY = (e as React.MouseEvent).clientY
        }

        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        }
    }

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        const coords = getCoordinates(e)
        if (!coords) return

        setIsDrawing(true)
        setCurrentLine([coords])
    }

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing || !canvasRef.current) return

        const coords = getCoordinates(e)
        if (!coords) return

        const newPoints = [...currentLine, coords]
        setCurrentLine(newPoints)

        const ctx = canvasRef.current.getContext("2d")
        if (ctx) {
            ctx.lineCap = "round"
            ctx.lineJoin = "round"
            ctx.strokeStyle = isErasing ? "#ffffff" : color
            ctx.lineWidth = brushSize

            // Draw local preview just for this segment
            if (currentLine.length > 0) {
                const lastPoint = currentLine[currentLine.length - 1]
                ctx.beginPath()
                ctx.moveTo(lastPoint.x, lastPoint.y)
                ctx.lineTo(coords.x, coords.y)
                ctx.stroke()
            }
        }
    }

    const stopDrawing = async () => {
        if (!isDrawing) return

        setIsDrawing(false)

        if (currentLine.length > 1) {
            // Save line to Firebase
            const newLine = {
                points: currentLine,
                color: isErasing ? "#ffffff" : color,
                width: brushSize,
                userId: currentUser,
                timestamp: Date.now()
            }

            const db = getFirebaseDatabase()
            if (!db) return

            const whiteboardRef = ref(db, `whiteboards/${roomId}`)
            await push(whiteboardRef, newLine)
        }

        setCurrentLine([])
    }

    const clearCanvas = async () => {
        if (confirm("Are you sure you want to clear the whiteboard for everyone?")) {
            const db = getFirebaseDatabase()
            if (!db) return

            const whiteboardRef = ref(db, `whiteboards/${roomId}`)
            await remove(whiteboardRef)
        }
    }

    const handleDownload = () => {
        if (!canvasRef.current) return
        const link = document.createElement('a')
        link.download = `whiteboard-${Date.now()}.png`
        link.href = canvasRef.current.toDataURL()
        link.click()
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-3xl p-6 animate-in fade-in duration-500">
            <div className="bg-slate-900/50 border border-white/10 rounded-[40px] shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden relative backdrop-blur-md">
                {/* Decorative gradients */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 blur-[100px] pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/5 blur-[100px] pointer-events-none" />

                {/* Header */}
                <div className="flex items-center justify-between p-6 px-10 border-b border-white/5 z-10">
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30 shadow-lg shadow-cyan-500/10">
                            <Palette className="h-5 w-5 text-cyan-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white tracking-tighter uppercase">Collaborative Space</h2>
                            <p className="text-[10px] text-white/30 font-bold tracking-widest uppercase">REAL-TIME WHITEBOARD</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="h-10 w-10 rounded-xl bg-white/5 hover:bg-red-500 text-white transition-all border border-white/5"
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="flex items-center justify-center gap-4 p-4 z-10 bg-white/2">
                    <div className="flex items-center gap-2 p-1.5 bg-slate-800/50 border border-white/5 rounded-2xl backdrop-blur-xl shadow-xl">
                        {/* Color Picker Container */}
                        <Popover>
                            <PopoverTrigger asChild>
                                <button
                                    className="w-10 h-10 rounded-xl border-2 transition-transform hover:scale-105 active:scale-95 shadow-inner"
                                    style={{ backgroundColor: isErasing ? '#ffffff' : color, borderColor: isErasing ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)' }}
                                >
                                    <span className="sr-only">Pick color</span>
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-4 bg-slate-900/95 border-white/10 backdrop-blur-xl rounded-2xl grid grid-cols-5 gap-3 shadow-2xl">
                                {colors.map(c => (
                                    <button
                                        key={c}
                                        className={cn(
                                            "w-9 h-9 rounded-xl border-2 transition-all hover:scale-110",
                                            color === c && !isErasing ? "border-white ring-4 ring-white/10" : "border-transparent"
                                        )}
                                        style={{ backgroundColor: c }}
                                        onClick={() => {
                                            setColor(c)
                                            setIsErasing(false)
                                        }}
                                    />
                                ))}
                            </PopoverContent>
                        </Popover>

                        <div className="h-4 w-[1px] bg-white/10 mx-1" />

                        {/* Brush Size */}
                        <div className="flex items-center gap-3 px-3 w-40">
                            <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
                            <Slider
                                value={[brushSize]}
                                max={30}
                                min={1}
                                step={1}
                                onValueChange={(val) => setBrushSize(val[0])}
                                className="flex-1"
                            />
                            <div className="w-4 h-4 rounded-full bg-white/40" />
                        </div>

                        <div className="h-4 w-[1px] bg-white/10 mx-1" />

                        {/* Tools Grid */}
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsErasing(!isErasing)}
                                className={cn(
                                    "h-10 w-10 rounded-xl transition-all",
                                    isErasing ? "bg-white text-slate-950 hover:bg-white/90" : "text-white/60 hover:text-white hover:bg-white/10"
                                )}
                                title="Eraser"
                            >
                                <Eraser className="w-5 h-5" />
                            </Button>

                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleDownload}
                                className="h-10 w-10 rounded-xl text-white/60 hover:text-white hover:bg-white/10"
                                title="Export Image"
                            >
                                <Download className="w-5 h-5" />
                            </Button>

                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={clearCanvas}
                                className="h-10 w-10 rounded-xl text-red-500/60 hover:text-red-500 hover:bg-red-500/10"
                                title="Delete All"
                            >
                                <Trash2 className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Canvas Stage */}
                <div className="flex-1 relative bg-white m-6 mt-0 rounded-[32px] overflow-hidden shadow-inner border border-white/5 cursor-crosshair touch-none">
                    <canvas
                        ref={canvasRef}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                        className="w-full h-full"
                    />
                </div>
            </div>
        </div>
    )
}
