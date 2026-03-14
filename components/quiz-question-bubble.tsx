"use client"

import React, { useState, useEffect } from "react"
import { Timer, Users, CheckCircle2, XCircle, Trophy, Gamepad2, Maximize, Minus, X, Clock } from "lucide-react"
import { Button } from "./ui/button"
import type { QuizQuestion, QuizAnswer } from "@/utils/games/quiz-system"
import { NotificationSystem } from "@/utils/core/notification-system"

interface QuizQuestionBubbleProps {
  question: QuizQuestion
  currentQuestionNumber: number
  totalQuestions: number
  timeRemaining: number
  participants: Array<{ id: string; name: string; hasAnswered: boolean }>
  userAnswer: string
  onAnswer: (answer: string) => void
  onExit: () => void
  showResults?: boolean
  correctAnswer?: string
  isMinimized?: boolean
  onMinimize?: () => void
  onRestore?: () => void
  answers?: QuizAnswer[]
}

export function QuizQuestionBubble({
  question,
  currentQuestionNumber,
  totalQuestions,
  timeRemaining,
  participants,
  userAnswer,
  onAnswer,
  onExit,
  showResults = false,
  correctAnswer,
  isMinimized,
  onMinimize,
  onRestore,
  answers = [],
}: QuizQuestionBubbleProps) {
  const [localAnswer, setLocalAnswer] = useState<string>("")
 
  useEffect(() => {
    setLocalAnswer("")
  }, [question.id])
 
  if (isMinimized) {
    return (
      <div className="max-w-md mx-auto mb-4 animate-in slide-in-from-bottom-4 duration-300">
        <div className="bg-slate-900/90 backdrop-blur-md border border-purple-500/30 rounded-xl p-3 flex items-center justify-between shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-purple-600/20 flex items-center justify-center">
              <Gamepad2 className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Quiz Active</div>
              <div className="text-sm text-white font-medium">Question {currentQuestionNumber} of {totalQuestions}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right mr-2">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Time</div>
              <div className={`text-sm font-bold ${timeRemaining < 5 ? 'text-red-400 animate-pulse' : 'text-cyan-400'}`}>
                {timeRemaining}s
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onRestore}
              className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10 rounded-full"
            >
              <Maximize className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    )
  }
  const handleAnswerClick = (answer: string) => {
    if (userAnswer || localAnswer || showResults) return
    setLocalAnswer(answer)
 
    // Instant feedback sound/vibration
    if (answer === question.correctAnswer) {
      NotificationSystem.getInstance().quizCorrect()
    } else {
      NotificationSystem.getInstance().quizWrong()
    }
 
    onAnswer(answer)
  }

  const getAnswerStats = (option: string) => {
    if (!showResults || !answers.length) return { count: 0, percentage: 0 }

    const optionAnswers = answers.filter((a) => a.answer === option)
    const count = optionAnswers.length
    const percentage = answers.length > 0 ? Math.round((count / answers.length) * 100) : 0

    return { count, percentage }
  }

  const getAnswerStyle = (option: string) => {
    // Priority 1: Final results from server
    if (showResults) {
      if (option === correctAnswer) {
        return "bg-green-500/20 border-green-400 text-green-300"
      } else if (option === userAnswer && option !== correctAnswer) {
        return "bg-red-500/20 border-red-400 text-red-300"
      } else {
        return "bg-slate-700/50 border-slate-600 text-gray-300"
      }
    }
 
    // Priority 2: Instant local feedback
    if (localAnswer) {
      if (option === question.correctAnswer) {
        return "bg-green-500/20 border-green-400 text-green-300"
      } else if (option === localAnswer && option !== question.correctAnswer) {
        return "bg-red-500/20 border-red-400 text-red-300"
      } else {
        return "bg-slate-700/50 border-slate-600 text-gray-300"
      }
    }
 
    // Priority 3: Remote user selection (if sync is slow)
    if (userAnswer === option) {
      return "bg-purple-500/20 border-purple-400 text-purple-300"
    }
 
    // Default
    return "bg-slate-700/50 border-slate-600 text-white hover:bg-slate-600/50 hover:border-slate-500"
  }

  const progressPercentage = ((totalQuestions - currentQuestionNumber + 1) / totalQuestions) * 100

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 backdrop-blur-sm border border-purple-500/30 rounded-2xl p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">Q{currentQuestionNumber}</span>
            </div>
            <div>
              <h3 className="text-white font-medium">Quiz Question</h3>
              <p className="text-gray-400 text-sm">
                {currentQuestionNumber} of {totalQuestions}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Timer */}
            <div
              className={`flex items-center gap-2 px-3 py-1 rounded-full ${timeRemaining <= 5 ? "bg-red-500/20 text-red-300 animate-pulse" : "bg-slate-700/50 text-gray-300"
                }`}
            >
              <Clock className="w-4 h-4" />
              <span className="font-mono font-bold">{timeRemaining}s</span>
            </div>

            {/* Minimize Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onMinimize}
              className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10 rounded-full"
              title="Minimize Quiz"
            >
              <Minus className="h-4 w-4" />
            </Button>

            {/* Exit Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onExit}
              className="h-8 w-8 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-full"
              title="Exit Quiz"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Progress</span>
            <span className="text-sm text-gray-400">{Math.round((currentQuestionNumber / totalQuestions) * 100)}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentQuestionNumber / totalQuestions) * 100}%` }}
            />
          </div>
        </div>

        {/* Category Badge */}
        {question.category && (
          <div className="mb-4">
            <span className="inline-block px-3 py-1 bg-purple-500/20 text-purple-300 text-xs font-medium rounded-full border border-purple-500/30">
              {question.category}
            </span>
          </div>
        )}

        {/* Question */}
        <div className="mb-6 relative">
          <h2 className="text-xl font-medium text-white leading-relaxed">{question.question}</h2>
          {userAnswer && !showResults && (
            <div className="absolute -bottom-8 left-0 flex items-center gap-2 text-purple-400 text-sm animate-pulse">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
              </span>
              Waiting for other participants...
            </div>
          )}
        </div>

        <div className="grid gap-3 mb-6">
          {(question.options || []).map((option, index) => {
            const stats = getAnswerStats(option)
            const isCorrect = showResults && option === correctAnswer
            const isUserAnswer = option === userAnswer

            return (
              <button
                key={index}
                onClick={() => handleAnswerClick(option)}
                disabled={!!userAnswer || showResults}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-200 ${getAnswerStyle(option)} ${!userAnswer && !showResults ? "cursor-pointer" : "cursor-default"
                  }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold ${(showResults || localAnswer) && isCorrect
                          ? "border-green-400 bg-green-500"
                          : (showResults || localAnswer) && (isUserAnswer || option === localAnswer) && !isCorrect
                            ? "border-red-400 bg-red-500"
                            : isUserAnswer || option === localAnswer
                              ? "border-purple-400 bg-purple-500"
                              : "border-gray-400"
                        }`}
                    >
                      {String.fromCharCode(65 + index)}
                    </div>
                    <span className="font-medium">{option}</span>
                  </div>

                  {showResults && (
                    <div className="flex items-center gap-2">
                      {isCorrect && <CheckCircle2 className="w-5 h-5 text-green-400" />}
                      {isUserAnswer && !isCorrect && <XCircle className="w-5 h-5 text-red-400" />}
                      <div className="text-right">
                        <div className="text-sm font-bold">{stats.percentage}%</div>
                        <div className="text-xs text-gray-400">{stats.count} votes</div>
                      </div>
                    </div>
                  )}
                </div>

                {showResults && (
                  <div className="mt-2">
                    <div className="w-full bg-slate-600 rounded-full h-1">
                      <div
                        className={`h-1 rounded-full transition-all duration-500 ${isCorrect ? "bg-green-400" : "bg-gray-400"
                          }`}
                        style={{ width: `${stats.percentage}%` }}
                      />
                    </div>
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Participants */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-gray-400">
            <Users className="w-4 h-4" />
            <span>
              {participants.length} participant{participants.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-400">
              Answered: {participants.filter((p) => p.hasAnswered).length}/{participants.length}
            </span>
            <div className="flex -space-x-1">
              {(participants || []).slice(0, 3).map((participant, index) => (
                <div
                  key={participant.id}
                  className={`w-6 h-6 rounded-full border-2 border-slate-800 flex items-center justify-center text-xs font-bold ${participant.hasAnswered ? "bg-green-500 text-white" : "bg-gray-600 text-gray-300"
                    }`}
                  title={participant.name}
                >
                  {participant.name[0]}
                </div>
              ))}
              {participants.length > 3 && (
                <div className="w-6 h-6 rounded-full border-2 border-slate-800 bg-gray-600 flex items-center justify-center text-xs font-bold text-gray-300">
                  +{participants.length - 3}
                </div>
              )}
            </div>
          </div>
        </div>

        {showResults && (
          <div className="mt-4 p-3 bg-slate-800/50 rounded-lg">
            <div className="text-center text-sm text-gray-300">
              {correctAnswer && (
                <p>
                  <span className="text-green-400 font-medium">Correct Answer: </span>
                  {correctAnswer}
                </p>
              )}
              <p className="mt-1 text-gray-400">Next question in 2 seconds...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
