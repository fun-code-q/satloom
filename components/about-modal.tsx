"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Info } from "lucide-react"

interface AboutModalProps {
  isOpen: boolean
  onClose: () => void
}

export function AboutModal({ isOpen, onClose }: AboutModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white w-full max-w-lg mx-4 sm:mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center text-cyan-400 flex items-center justify-center gap-2">
            <Info className="w-5 h-5" />
            About SatLoom
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <span className="text-cyan-400 font-medium">Open-source:</span>
            <span className="text-white ml-2">Designed to provide secure, encrypted communication.</span>
          </div>

          <div>
            <span className="text-cyan-400 font-medium">Version:</span>
            <span className="text-white ml-2">1.8.0</span>
          </div>

          <div>
            <span className="text-cyan-400 font-medium">Developed by:</span>
            <span className="text-white ml-2">SatLoom Developers</span>
          </div>

          <div>
            <span className="text-cyan-400 font-medium">Features:</span>
            <span className="text-white ml-2">Real-time text chat, video calling, audio calling, and more.</span>
          </div>
        </div>

        <div className="flex justify-center pt-4">
          <Button onClick={onClose} className="bg-cyan-500 hover:bg-cyan-600">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
