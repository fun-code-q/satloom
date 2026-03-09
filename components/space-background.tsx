"use client"

import { useEffect, useRef } from "react"

interface Particle {
  x: number
  y: number
  size: number
  speedX: number
  speedY: number
  color: string
  opacity: number
}

interface SpaceBackgroundProps {
  backgroundImage?: string | null
}

export function SpaceBackground({ backgroundImage }: SpaceBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const particles: Particle[] = []
    const colors = ["#60A5FA", "#A78BFA", "#F472B6", "#34D399", "#FBBF24"]

    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    const createParticles = () => {
      // Reduced particle count if background image is present to avoid clutter
      const count = backgroundImage ? 30 : 50
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 60 + 20,
          speedX: (Math.random() - 0.5) * 0.5,
          speedY: (Math.random() - 0.5) * 0.5,
          color: colors[Math.floor(Math.random() * colors.length)],
          opacity: Math.random() * 0.3 + 0.1,
        })
      }
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      particles.forEach((particle) => {
        particle.x += particle.speedX
        particle.y += particle.speedY

        if (particle.x < 0 || particle.x > canvas.width) particle.speedX *= -1
        if (particle.y < 0 || particle.y > canvas.height) particle.speedY *= -1

        ctx.globalAlpha = particle.opacity
        ctx.fillStyle = particle.color
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
        ctx.fill()
      })

      requestAnimationFrame(animate)
    }

    resizeCanvas()
    createParticles()
    animate()

    window.addEventListener("resize", resizeCanvas)
    return () => window.removeEventListener("resize", resizeCanvas)
  }, [backgroundImage])

  return (
    <>
      {backgroundImage && (
        <div className="fixed inset-0 -z-20 transition-all duration-1000 ease-in-out">
          <img
            src={backgroundImage}
            alt="Mood Background"
            className="w-full h-full object-cover opacity-60 blur-[2px]"
          />
          <div className="absolute inset-0 bg-black/40" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 -z-10"
        style={{
          background: backgroundImage
            ? "transparent"
            : "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)"
        }}
      />
    </>
  )
}
