"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ImageIcon, Camera, Video, FileText, Mic, MapPin, User, Paperclip, BarChart2, Calendar, X, HelpCircle, Palette, Eye, Music2, Sparkles, Plus, Monitor, CheckSquare, MonitorPlay } from "lucide-react"
import { toast } from "sonner"

interface AttachmentMenuProps {
  onFileSelect: (type: string, file?: File | any) => void
  onPollCreate?: () => void
  onEventCreate?: () => void
  onAudioRecord?: () => void
  onVideoRecord?: () => void
  onPhotoCapture?: () => void
  onMoodTrigger?: () => void
  onVanishMode?: () => void
  onSoundboard?: () => void
  onReactRoom?: () => void
  onAudioCall?: () => void
  onVideoCall?: () => void
  onWhiteboard?: () => void
  onPresentation?: () => void
  onNotes?: () => void
  onCheckList?: () => void
  onQuizStart?: () => void
  onClose?: () => void
  isMobile?: boolean
  hasUnreadNotes?: boolean
  hasUnreadTasks?: boolean
}

export function AttachmentMenu({
  onFileSelect,
  onPollCreate,
  onEventCreate,
  onAudioRecord,
  onVideoRecord,
  onPhotoCapture,
  onMoodTrigger,
  onVanishMode,
  onSoundboard,
  onReactRoom,
  onAudioCall,
  onVideoCall,
  onWhiteboard,
  onPresentation,
  onNotes,
  onCheckList,
  onQuizStart,
  onClose,
  isMobile = false,
  hasUnreadNotes = false,
  hasUnreadTasks = false
}: AttachmentMenuProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleClose = () => {
    setIsOpen(false)
    onClose?.()
  }

  const attachmentOptions = [
    {
      icon: ImageIcon,
      label: "Gallery",
      type: "gallery",
      action: () => triggerFileInput("image/*,video/*", "file"),
    },
    {
      icon: Camera,
      label: "Camera",
      type: "camera",
      action: () => {
        if (onPhotoCapture) {
          onPhotoCapture()
        }
        handleClose()
      },
    },
    {
      icon: MapPin,
      label: "Location",
      type: "location",
      action: () => shareLocation(),
    },
    {
      icon: User,
      label: "Contact",
      type: "contact",
      action: () => shareContact(),
    },
    {
      icon: FileText,
      label: "Document",
      type: "document",
      action: () => triggerFileInput(".pdf,.doc,.docx,.txt,.xlsx,.pptx", "document"),
    },
    {
      icon: Mic,
      label: "Audio",
      type: "audio",
      action: () => {
        if (onAudioRecord) {
          onAudioRecord()
        } else {
          triggerFileInput("audio/*", "audio")
        }
        handleClose()
      },
    },
    {
      icon: BarChart2,
      label: "Poll",
      type: "poll",
      action: () => {
        onPollCreate?.()
        handleClose()
      },
    },
    {
      icon: Calendar,
      label: "Event",
      type: "event",
      action: () => {
        onEventCreate?.()
        handleClose()
      },
    },
    {
      icon: Eye,
      label: "Vanish",
      type: "vanish",
      action: () => {
        onVanishMode?.()
        handleClose()
      },
    },
    {
      icon: Music2,
      label: "Sounds",
      type: "sounds",
      action: () => {
        onSoundboard?.()
        handleClose()
      },
    },
    {
      icon: Sparkles,
      label: "React",
      type: "react",
      action: () => {
        onReactRoom?.()
        handleClose()
      },
    },
    {
      icon: Mic,
      label: "Audio Call",
      type: "audio-call",
      action: () => {
        onAudioCall?.()
        handleClose()
      },
    },
    {
      icon: Video,
      label: "Video Call",
      type: "video-call",
      action: () => {
        onVideoCall?.()
        handleClose()
      },
    },
    {
      icon: Monitor,
      label: "Board",
      type: "whiteboard",
      action: () => {
        onWhiteboard?.()
        handleClose()
      },
    },
    {
      icon: MonitorPlay,
      label: "Present",
      type: "presentation",
      action: () => {
        onPresentation?.()
        handleClose()
      },
    },
    {
      icon: FileText,
      label: "Notes",
      type: "notes",
      action: () => {
        onNotes?.()
        handleClose()
      },
    },
    {
      icon: CheckSquare,
      label: "Tasks",
      type: "checklist",
      action: () => {
        onCheckList?.()
        handleClose()
      },
    },
    {
      icon: HelpCircle,
      label: "Quiz",
      type: "quiz",
      action: () => {
        onQuizStart?.()
        handleClose()
      },
    },
  ]

  const filteredOptions = isMobile
    ? attachmentOptions.filter(
      (opt) =>
        [
          "poll",
          "event",
          "vanish",
          "whiteboard",
          "presentation",
          "notes",
          "checklist",
          "quiz",
        ].includes(opt.type)
    )
    : attachmentOptions.filter(opt => !["audio-call", "video-call", "sounds", "react", "gallery", "camera", "location", "contact", "document", "audio"].includes(opt.type))

  const triggerFileInput = (accept: string, type: string) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = accept
    input.multiple = type !== "document"

    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files
      if (files) {
        Array.from(files).forEach((file) => {
          onFileSelect(type, file)
        })
      }
    }
    input.click()
    handleClose()
  }

  const shareLocation = () => {
    if (navigator.geolocation) {
      toast.loading("Getting your location...", {
        id: "location-loading"
      })

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          }
          toast.dismiss("location-loading")
          toast.success("Location shared successfully!")
          onFileSelect("location", location as any)
        },
        (error) => {
          toast.dismiss("location-loading")
          console.error("Error getting location:", error)

          switch (error.code) {
            case error.PERMISSION_DENIED:
              toast.error("Location access denied", {
                description: "Please enable location permissions in your browser settings."
              })
              break
            case error.POSITION_UNAVAILABLE:
              toast.error("Location unavailable", {
                description: "Unable to determine your location."
              })
              break
            case error.TIMEOUT:
              toast.error("Location request timed out", {
                description: "Please try again."
              })
              break
            default:
              toast.error("Could not get location", {
                description: "Please check your location permissions."
              })
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        }
      )
    } else {
      toast.error("Geolocation not supported", {
        description: "Your browser does not support location services."
      })
    }
    handleClose()
  }

  const shareContact = async () => {
    try {
      if ("contacts" in navigator && "ContactsManager" in window) {
        toast.loading("Opening contacts...", {
          id: "contacts-loading"
        })

        const contacts = await (navigator as any).contacts.select(["name", "tel", "email"], { multiple: false })
        toast.dismiss("contacts-loading")

        if (contacts.length > 0) {
          const contact = contacts[0]
          toast.success("Contact selected!")
          onFileSelect("contact", {
            name: contact.name?.[0] || "Unknown",
            phone: contact.tel?.[0] || "",
            email: contact.email?.[0] || "",
          } as any)
        }
      } else {
        const name = prompt("Enter contact name:")
        const phone = prompt("Enter phone number:")
        if (name && phone) {
          toast.success("Contact shared!")
          onFileSelect("contact", {
            name,
            phone,
            email: "",
          } as any)
        }
      }
    } catch (error) {
      console.error("Error accessing contacts:", error)
      toast.error("Could not access contacts", {
        description: "Please check your permissions and try again."
      })
    }
    handleClose()
  }

  if (isMobile) {
    return (
      <div className="w-fit bg-slate-900/40 backdrop-blur-xl rounded-2xl p-2 shadow-2xl transition-all">
        {/* Mobile attachment menu - Compact Icon-only Grid */}
        <div className="grid grid-cols-4 gap-1">
          {filteredOptions.map((option, index) => (
            <button
              key={index}
              type="button"
              onClick={option.action}
              className="flex items-center justify-center p-2 rounded-xl active:scale-95 transition-transform"
              aria-label={option.label}
            >
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center shadow-lg hover:bg-white/10 relative">
                <option.icon className="w-6 h-6 text-cyan-400" />
                {((option.type === 'notes' && hasUnreadNotes) || (option.type === 'checklist' && hasUnreadTasks)) && (
                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 border-2 border-slate-900 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Desktop layout
  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-gray-400 hover:text-white hover:bg-slate-700 relative z-[70]"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        aria-label="Attach file"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Plus className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-45' : ''}`} aria-hidden="true" />
      </Button>

      {isOpen && (
        <div
          className="absolute bottom-14 left-0 z-[70] bg-slate-800/95 backdrop-blur-sm border border-slate-600 rounded-2xl p-4 shadow-2xl"
          role="menu"
          aria-label="Attachment options"
        >
          <div className="grid grid-cols-4 gap-4 w-[340px]">
            {filteredOptions.map((option, index) => (
              <button
                key={index}
                type="button"
                onClick={option.action}
                className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-slate-700/50 transition-colors group"
                role="menuitem"
                aria-label={option.label}
              >
                <div
                  className="w-12 h-12 rounded-xl bg-cyan-500 flex items-center justify-center group-hover:bg-cyan-400 transition-colors relative"
                  aria-hidden="true"
                >
                  <option.icon className="w-6 h-6 text-white" />
                  {((option.type === 'notes' && hasUnreadNotes) || (option.type === 'checklist' && hasUnreadTasks)) && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-slate-800 rounded-full" />
                  )}
                </div>
                <span className="text-white text-sm font-medium">{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
