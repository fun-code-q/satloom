"use client"

import { useEffect, useRef } from "react"

interface AudioVisualizerProps {
    stream: MediaStream | null
    width?: number
    height?: number
    barColor?: string
    gap?: number
    barWidth?: number
    className?: string
}

export function AudioVisualizer({
    stream,
    width = 60,
    height = 30,
    barColor = "#22d3ee", // cyan-400
    gap = 2,
    barWidth = 3,
    className,
}: AudioVisualizerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const animationRef = useRef<number | null>(null)
    const audioContextRef = useRef<AudioContext | null>(null)
    const analyserRef = useRef<AnalyserNode | null>(null)
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)

    useEffect(() => {
        if (!stream || !canvasRef.current) return

        // Cleanup previous context if exists
        cleanup()

        try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
            audioContextRef.current = audioContext

            const analyser = audioContext.createAnalyser()
            analyser.fftSize = 64 // Small FFT size for fewer bars since displayed area is small
            analyserRef.current = analyser

            // Create source
            // Note: If stream has no audio tracks, this might throw or silently fail
            if (stream.getAudioTracks().length === 0) return

            const source = audioContext.createMediaStreamSource(stream)
            source.connect(analyser)
            sourceRef.current = source

            const bufferLength = analyser.frequencyBinCount
            const dataArray = new Uint8Array(bufferLength)
            const canvas = canvasRef.current
            const ctx = canvas.getContext("2d")

            if (!ctx) return

            const draw = () => {
                if (!analyserRef.current) return

                animationRef.current = requestAnimationFrame(draw)

                analyser.getByteFrequencyData(dataArray)

                ctx.clearRect(0, 0, width, height)

                const bars = Math.floor(width / (barWidth + gap))
                // We only use the lower half of frequencies for better visualization of speech
                const step = Math.ceil(bufferLength / bars)

                for (let i = 0; i < bars; i++) {
                    // Average out the step
                    let value = 0
                    for (let j = 0; j < step; j++) {
                        value += dataArray[(i * step) + j] || 0
                    }
                    value = value / step

                    const percent = value / 255
                    const barHeight = Math.max(2, height * percent)

                    ctx.fillStyle = barColor

                    // Draw rounded or simple rect
                    const x = i * (barWidth + gap)
                    const y = (height - barHeight) / 2 // Center vertically

                    ctx.fillRect(x, y, barWidth, barHeight)
                }
            }

            draw()
        } catch (error) {
            console.error("Error initializing audio visualizer:", error)
        }

        return cleanup
    }, [stream, width, height, barColor])

    const cleanup = () => {
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current)
        }
        if (sourceRef.current) {
            sourceRef.current.disconnect()
        }
        if (audioContextRef.current && audioContextRef.current.state !== "closed") {
            audioContextRef.current.close()
        }
    }

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className={`opacity-80 ${className || ""}`}
        />
    )
}
