"use client"

import { useEffect, useState } from "react"

export function LoadingBars() {
  const [activeBar, setActiveBar] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveBar((prev) => (prev + 1) % 3)
    }, 500)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex gap-4 justify-center">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className={`h-2 rounded-full transition-all duration-300 ${
            activeBar === index ? "w-20 bg-cyan-400" : "w-16 bg-cyan-600/50"
          }`}
        />
      ))}
    </div>
  )
}
