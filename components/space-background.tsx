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
      // Halve the count on phone-sized viewports. These are large blurred
      // fills covering the whole viewport, and fill cost is what actually
      // hurts on mobile GPUs — not the particle bookkeeping.
      const isSmall = window.innerWidth < 768
      const base = backgroundImage ? 30 : 50
      const count = isSmall ? Math.round(base / 2) : base
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

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const particle of particles) {
        ctx.globalAlpha = particle.opacity
        ctx.fillStyle = particle.color
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const step = () => {
      for (const particle of particles) {
        particle.x += particle.speedX
        particle.y += particle.speedY
        if (particle.x < 0 || particle.x > canvas.width) particle.speedX *= -1
        if (particle.y < 0 || particle.y > canvas.height) particle.speedY *= -1
      }
      draw()
    }

    resizeCanvas()
    createParticles()

    // Honour the OS "reduce motion" setting: paint one static frame and stop.
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    if (reduceMotion) {
      draw()
      window.addEventListener("resize", resizeCanvas)
      return () => window.removeEventListener("resize", resizeCanvas)
    }

    // Cap at ~30fps. At 60 this redraws 50 full-viewport blurred circles every
    // frame for decoration nobody looks at; halving it is invisible here and
    // halves the GPU work.
    const FRAME_MS = 1000 / 30
    let rafId = 0
    let last = 0

    const animate = (now: number) => {
      // Stored so cleanup can cancel it. The previous version re-armed rAF
      // unconditionally and never cancelled, so the loop outlived the
      // component: navigating landing -> chat left the landing page's loop
      // running forever, and every backgroundImage change started another
      // concurrent loop drawing to the same canvas. They compounded.
      rafId = requestAnimationFrame(animate)
      if (document.hidden) return
      if (now - last < FRAME_MS) return
      last = now
      step()
    }

    rafId = requestAnimationFrame(animate)
    window.addEventListener("resize", resizeCanvas)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener("resize", resizeCanvas)
    }
  }, [backgroundImage])

  return (
    <>
      {backgroundImage && (
        <div
          className="absolute inset-0 transition-all duration-1000 ease-in-out"
          style={{ zIndex: 0, pointerEvents: "none" }}
        >
          <img
            src={backgroundImage}
            alt="Mood Background"
            className="w-full h-full object-cover"
            style={{ pointerEvents: "none" }}
          />
          {/* Dark overlay so text remains readable */}
          <div className="absolute inset-0 bg-black/40" style={{ pointerEvents: "none" }} />
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{
          zIndex: 1,
          pointerEvents: "none",
          background: backgroundImage
            ? "transparent"
            : "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)"
        }}
      />
    </>
  )
}
