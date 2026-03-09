"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Settings, Battery, BatteryMedium, BatteryLow } from "lucide-react"
import { useTheme } from "@/contexts/theme-context"
import { useState, useEffect } from "react"
import { batterySaver, BatteryMode } from "@/utils/hardware/battery-saver"

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const {
    notifications, toggleNotifications,
    notificationSound, toggleNotificationSound,
    vibration, toggleVibration
  } = useTheme()

  const [batteryMode, setBatteryMode] = useState<BatteryMode>("balanced")
  const [batteryInfo, setBatteryInfo] = useState({ level: 100, charging: true, supported: false })

  useEffect(() => {
    if (isOpen) {
      setBatteryMode(batterySaver.getMode())
      setBatteryInfo(batterySaver.getBatteryInfo())

      const unsubscribe = batterySaver.onBatteryChange((info) => {
        setBatteryInfo(info)
      })

      return () => unsubscribe()
    }
  }, [isOpen])

  const handleBatteryModeChange = (mode: BatteryMode) => {
    batterySaver.setMode(mode)
    setBatteryMode(mode)
  }

  const getBatteryIcon = () => {
    if (batteryInfo.level > 80) return <Battery className="w-5 h-5 text-green-400" />
    if (batteryInfo.level > 40) return <BatteryMedium className="w-5 h-5 text-yellow-400" />
    return <BatteryLow className="w-5 h-5 text-red-400" />
  }

  const handleSaveSettings = () => {
    // Settings are automatically saved via context
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white w-full max-w-md mx-4 sm:mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center text-cyan-400 flex items-center justify-center gap-2 text-lg sm:text-xl">
            <Settings className="w-5 h-5" />
            Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6 py-4 px-4 sm:px-6">
          {/* Theme is fixed to Dark for consistency */}
          {/* Notifications */}
          <div className="flex items-center justify-between gap-4">
            <span className="text-white text-sm sm:text-base">Notifications:</span>
            <button
              onClick={toggleNotifications}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notifications ? "bg-cyan-500" : "bg-gray-600"
                }`}
              aria-label={`Turn notifications ${notifications ? "off" : "on"}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notifications ? "translate-x-6" : "translate-x-1"
                  }`}
              />
            </button>
          </div>

          {/* Notification Sound */}
          <div className="flex items-center justify-between gap-4">
            <span className="text-white text-sm sm:text-base">Notification Sound:</span>
            <button
              onClick={toggleNotificationSound}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notificationSound ? "bg-cyan-500" : "bg-gray-600"
                }`}
              aria-label={`Turn notification sound ${notificationSound ? "off" : "on"}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notificationSound ? "translate-x-6" : "translate-x-1"
                  }`}
              />
            </button>
          </div>

          {/* Vibration */}
          <div className="flex items-center justify-between gap-4">
            <span className="text-white text-sm sm:text-base">Vibration:</span>
            <button
              onClick={toggleVibration}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${vibration ? "bg-cyan-500" : "bg-gray-600"
                }`}
              aria-label={`Turn vibration ${vibration ? "off" : "on"}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${vibration ? "translate-x-6" : "translate-x-1"
                  }`}
              />
            </button>
          </div>

          {/* Debug Mode */}
          <div className="flex items-center justify-between gap-4">
            <span className="text-white text-sm sm:text-base">Debug Mode:</span>
            <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-600" aria-label="Debug mode (disabled)">
              <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
            </button>
          </div>

          {/* Battery Saver Mode */}
          <div className="border-t border-slate-600 pt-4 mt-4">
            <div className="flex items-center gap-2 mb-3">
              {getBatteryIcon()}
              <span className="text-white text-sm sm:text-base font-medium">Battery Saver</span>
              {batteryInfo.supported && (
                <span className="text-xs text-slate-400">
                  ({batteryInfo.level}%{batteryInfo.charging ? ', charging' : ''})
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleBatteryModeChange("performance")}
                className={`py-2 px-3 rounded-lg text-sm transition-all ${batteryMode === "performance"
                  ? "bg-green-500/20 text-green-400 border border-green-500/50"
                  : "bg-slate-700 text-slate-300 border border-slate-600"
                  }`}
              >
                ⚡ Performance
              </button>
              <button
                onClick={() => handleBatteryModeChange("balanced")}
                className={`py-2 px-3 rounded-lg text-sm transition-all ${batteryMode === "balanced"
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/50"
                  : "bg-slate-700 text-slate-300 border border-slate-600"
                  }`}
              >
                ⚖ Balanced
              </button>
              <button
                onClick={() => handleBatteryModeChange("battery-saver")}
                className={`py-2 px-3 rounded-lg text-sm transition-all ${batteryMode === "battery-saver"
                  ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/50"
                  : "bg-slate-700 text-slate-300 border border-slate-600"
                  }`}
              >
                🔋 Saver
              </button>
            </div>

            <p className="text-xs text-slate-400 mt-2">
              {batteryMode === "performance" && "Maximum quality and features. Uses more battery."}
              {batteryMode === "balanced" && "Optimized balance between quality and battery life."}
              {batteryMode === "battery-saver" && "Reduced quality to extend battery life. Auto-disables on charger."}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center pt-4 px-4 sm:px-6 pb-4">
          <Button onClick={handleSaveSettings} className="bg-cyan-500 hover:bg-cyan-600 w-full sm:w-auto min-h-[44px]">
            Save Settings
          </Button>
          <Button
            onClick={onClose}
            variant="outline"
            className="border-slate-600 text-white hover:bg-slate-700 bg-transparent w-full sm:w-auto min-h-[44px]"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
