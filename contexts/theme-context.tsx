"use client"

import type React from "react"

import { createContext, useContext, useEffect, useState, useMemo } from "react"

type Theme = "dark" | "light"

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  notifications: boolean
  toggleNotifications: () => void
  notificationSound: boolean
  toggleNotificationSound: () => void
  vibration: boolean
  toggleVibration: () => void
  hapticFeedback: boolean
  toggleHapticFeedback: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme] = useState<Theme>("dark") // Fixed theme
  const [notifications, setNotifications] = useState(true)
  const [notificationSound, setNotificationSound] = useState(true)
  const [vibration, setVibration] = useState(true)
  const [hapticFeedback, setHapticFeedback] = useState(true)

  useEffect(() => {
    // Load saved preferences
    const savedTheme = localStorage.getItem("satloom-theme") as Theme
    const savedNotifications = localStorage.getItem("satloom-notifications") === "true"
    const savedNotificationSound = localStorage.getItem("satloom-notification-sound") === "true"
    const savedVibration = localStorage.getItem("satloom-vibration") === "true"
    const savedHapticFeedback = localStorage.getItem("satloom-haptic-feedback") === "true"

    // Theme is always dark, ignore savedTheme from localStorage
    setNotifications(savedNotifications)
    setNotificationSound(savedNotificationSound)
    setVibration(savedVibration)
    setHapticFeedback(savedHapticFeedback)
  }, [])

  useEffect(() => {
    // Force dark theme on mount
    document.documentElement.classList.remove("light")
  }, [])

  useEffect(() => {
    localStorage.setItem("satloom-notifications", notifications.toString())
  }, [notifications])

  useEffect(() => {
    localStorage.setItem("satloom-notification-sound", notificationSound.toString())
    // Update notification system
    import("@/utils/core/notification-system").then(({ NotificationSystem }) => {
      NotificationSystem.getInstance().setSoundEnabled(notificationSound)
    })
  }, [notificationSound])

  useEffect(() => {
    localStorage.setItem("satloom-vibration", vibration.toString())
    // Update notification system
    import("@/utils/core/notification-system").then(({ NotificationSystem }) => {
      NotificationSystem.getInstance().setVibrationEnabled(vibration)
    })
  }, [vibration])

  useEffect(() => {
    localStorage.setItem("satloom-haptic-feedback", hapticFeedback.toString())
  }, [hapticFeedback])

  const toggleTheme = () => {
    // Disabled intentionally to preserve continuity
  }

  const toggleNotifications = () => {
    setNotifications((prev) => !prev)
  }

  const toggleNotificationSound = () => {
    setNotificationSound((prev) => !prev)
  }

  const toggleVibration = () => {
    setVibration((prev) => !prev)
  }

  const toggleHapticFeedback = () => {
    setHapticFeedback((prev) => !prev)
  }

  const memoizedValue = useMemo(() => ({
    theme,
    toggleTheme,
    notifications,
    toggleNotifications,
    notificationSound,
    toggleNotificationSound,
    vibration,
    toggleVibration,
    hapticFeedback,
    toggleHapticFeedback,
  }), [theme, notifications, notificationSound, vibration, hapticFeedback])

  return (
    <ThemeContext.Provider value={memoizedValue}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
