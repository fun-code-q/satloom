"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { User, Upload } from "lucide-react"
import { toast } from "sonner"
import { Toaster } from "@/components/ui/sonner"

interface ProfileModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (profile: { name: string; avatar?: string }) => void
  defaultProfile?: { name: string; avatar?: string }
}

export function ProfileModal({ isOpen, onClose, onSave, defaultProfile }: ProfileModalProps) {
  const [name, setName] = useState("")
  const [avatar, setAvatar] = useState<string | undefined>(defaultProfile?.avatar)
  const [isUploading, setIsUploading] = useState(false)

  useEffect(() => {
    if (defaultProfile?.name) {
      setName(defaultProfile.name)
    } else if (!name) {
      setName(`User-${Math.floor(Math.random() * 1000)}`)
    }

    if (defaultProfile?.avatar !== undefined) {
      setAvatar(defaultProfile.avatar)
    }
  }, [defaultProfile])
  const isMobile = useIsMobile()

  const enterFullscreen = useCallback(() => {
    if (isMobile && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn("Fullscreen request failed:", err)
      })
    }
  }, [isMobile])

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Please enter a name", {
        description: "Your name is required to set up your profile."
      })
      return
    }
    onSave({ name: name.trim(), avatar })
    toast.success("Profile saved successfully!")
    enterFullscreen()
    onClose()
  }

  const handleSkip = () => {
    if (!name.trim()) {
      setName(`User-${Math.floor(Math.random() * 1000)}`)
    }
    onSave({ name: name.trim() })
    toast.success("Profile saved with default name")
    enterFullscreen()
    onClose()
  }

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast.error("Invalid file type", {
          description: "Please select an image file (JPEG, PNG, GIF, etc.)"
        })
        return
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File too large", {
          description: "Please select an image smaller than 5MB"
        })
        return
      }

      setIsUploading(true)

      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        if (result) {
          setAvatar(result)
          toast.success("Photo uploaded successfully!")
        }
        setIsUploading(false)
      }
      reader.onerror = () => {
        toast.error("Failed to read file", {
          description: "Please try again or select a different file"
        })
        setIsUploading(false)
      }
      reader.readAsDataURL(file)
    }
  }

  const triggerFileUpload = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"
    input.onchange = handleAvatarUpload as unknown as (e: Event) => void
    input.click()
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent
          className="bg-slate-800 border-slate-700 text-white w-full max-w-md mx-4 sm:mx-auto max-h-[90vh] overflow-y-auto"
          aria-label="Profile setup modal"
        >
          <DialogHeader>
            <DialogTitle className="text-center text-cyan-400 flex items-center justify-center gap-2 text-lg sm:text-xl">
              <User className="w-5 h-5" aria-hidden="true" />
              Set Up Your Profile
            </DialogTitle>
            <DialogDescription className="text-center text-gray-400 text-sm">
              Upload a photo and enter your name to personalize your experience
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center space-y-4 sm:space-y-6 py-4 px-4 sm:px-6">
            <div className="relative" role="group" aria-label="Avatar upload">
              <div
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-cyan-400 flex items-center justify-center bg-slate-700 overflow-hidden"
                aria-label="Avatar preview"
              >
                {avatar ? (
                  <img
                    src={avatar || "/placeholder.svg"}
                    alt="Avatar preview"
                    className="w-full h-full object-cover"
                    onError={() => {
                      console.error("Error loading avatar image")
                      setAvatar(undefined)
                      toast.error("Failed to load avatar image")
                    }}
                  />
                ) : (
                  <User className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400" aria-hidden="true" />
                )}
              </div>
              {avatar && (
                <button
                  onClick={() => setAvatar(undefined)}
                  className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white text-xs transition-colors"
                  title="Remove photo"
                  aria-label="Remove photo"
                >
                  ×
                </button>
              )}
            </div>

            <Button
              variant="outline"
              className="border-slate-600 text-white hover:bg-slate-700 bg-transparent w-full sm:w-auto min-h-[44px]"
              onClick={triggerFileUpload}
              type="button"
              disabled={isUploading}
              aria-label={isUploading ? "Uploading photo..." : "Upload a profile photo"}
            >
              <Upload className="w-4 h-4 mr-2" aria-hidden="true" />
              {isUploading ? "Uploading..." : "Upload Photo"}
            </Button>

            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-slate-700 border-slate-600 text-white min-h-[44px] text-base"
              placeholder="Enter your name"
              maxLength={50}
              aria-label="Your name"
              aria-describedby="name-hint"
            />
            <span id="name-hint" className="sr-only">
              Enter a display name for your profile. Maximum 50 characters.
            </span>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full" role="group" aria-label="Profile actions">
              <Button
                onClick={handleSave}
                className="bg-cyan-500 hover:bg-cyan-600 transition-colors w-full sm:flex-1 min-h-[44px]"
                aria-label="Save profile"
              >
                Save
              </Button>
              <Button
                onClick={handleSkip}
                variant="outline"
                className="border-slate-600 text-white hover:bg-slate-700 bg-transparent transition-colors w-full sm:flex-1 min-h-[44px]"
                aria-label="Skip and use default name"
              >
                Skip
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Toaster />
    </>
  )
}
