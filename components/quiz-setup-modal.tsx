"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X, Brain, Shuffle } from "lucide-react"

interface QuizSetupModalProps {
  isOpen: boolean
  onClose: () => void
  onStartQuiz: (topic?: string) => void
}

export function QuizSetupModal({ isOpen, onClose, onStartQuiz }: QuizSetupModalProps) {
  const handleStartQuiz = () => {
    onStartQuiz()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white">Start Quiz</h2>
          </div>
          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="text-center">
            <div className="mb-6">
              <div className="text-4xl mb-4">🎲</div>
              <h3 className="text-lg font-medium text-white mb-2">Random Quiz</h3>
              <p className="text-gray-400 text-sm">
                Get ready for 10 random questions from various categories!
              </p>
            </div>

            <div className="flex gap-4">
              <Button
                onClick={onClose}
                variant="outline"
                className="flex-1 border-slate-600 text-white hover:bg-slate-700"
              >
                Cancel
              </Button>
              <Button
                onClick={handleStartQuiz}
                className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white"
              >
                <Shuffle className="w-4 h-4 mr-2" />
                Start Quiz
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
