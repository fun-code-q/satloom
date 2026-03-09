"use client"

import { useEffect, useState } from "react"

export function AnimatedLogo({ className = "" }: { className?: string }) {
  const [isAnimating, setIsAnimating] = useState(true)

  useEffect(() => {
    // Add custom CSS for pulse animation
    const style = document.createElement("style")
    style.textContent = `
    @keyframes pulse {
      0% {
        box-shadow: 0 0 0 0 rgba(58, 123, 213, 0.7);
      }
      70% {
        box-shadow: 0 0 0 10px rgba(58, 123, 213, 0);
      }
      100% {
        box-shadow: 0 0 0 0 rgba(58, 123, 213, 0);
      }
    }
  `
    document.head.appendChild(style)

    const interval = setInterval(() => {
      setIsAnimating((prev) => !prev)
    }, 2000)

    return () => {
      clearInterval(interval)
      document.head.removeChild(style)
    }
  }, [])

  return (
    <div className={`flex items-center ${className}`}>
      <div
        className={`w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center mr-2.5 transition-transform duration-1000 shadow-lg ${isAnimating ? "animate-pulse shadow-cyan-400/70" : ""}`}
        style={{
          boxShadow: isAnimating ? "0 0 0 0 rgba(58, 123, 213, 0.7)" : "none",
          animation: "pulse 2s infinite",
        }}
      >
        {/* Satellite Dish Icon */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white" className="opacity-90">
          <path d="M4 12c0-4.4 3.6-8 8-8s8 3.6 8 8c0 1.5-.4 2.9-1.1 4.1l-1.4-1.4c.4-.8.5-1.7.5-2.7 0-3.3-2.7-6-6-6s-6 2.7-6 6c0 1-.2 1.9-.5 2.7L4.1 16.1C3.4 14.9 4 13.5 4 12z" />
          <path d="M12 8c-2.2 0-4 1.8-4 4 0 .7.2 1.4.5 2l-1.4 1.4C6.4 14.6 6 13.3 6 12c0-3.3 2.7-6 6-6s6 2.7 6 6c0 1.3-.4 2.6-1.1 3.4L15.5 14c.3-.6.5-1.3.5-2 0-2.2-1.8-4-4-4z" />
          <circle cx="12" cy="12" r="2" />
          <path d="M8.5 16.5L12 20l3.5-3.5" />
        </svg>
      </div>
      <span
        className="text-[22px] font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent"
        style={{
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        SatLoom
      </span>
    </div>
  )
}
