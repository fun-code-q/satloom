"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Clock, Users, X, CheckCircle, XCircle } from "lucide-react"
import type { QuizQuestion, QuizAnswer } from "@/utils/games/quiz-system"

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
  answers = [],
}: QuizQuestionBubbleProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string>("")

  useEffect(() => {
    setSelectedAnswer("")
  }, [question.id])

  const handleAnswerClick = (answer: string) => {
    if (userAnswer || showResults) return
    setSelectedAnswer(answer)
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
    if (showResults) {
      if (option === correctAnswer) {
        return "bg-green-500/20 border-green-400 text-green-300"
      } else if (option === userAnswer && option !== correctAnswer) {
        return "bg-red-500/20 border-red-400 text-red-300"
      } else {
        return "bg-slate-700/50 border-slate-600 text-gray-300"
      }
    } else if (userAnswer === option) {
      return "bg-purple-500/20 border-purple-400 text-purple-300"
    } else {
      return "bg-slate-700/50 border-slate-600 text-white hover:bg-slate-600/50 hover:border-slate-500"
    }
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

          <div className="flex items-center gap-3">
            {/* Timer */}
            <div
              className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                timeRemaining <= 5 ? "bg-red-500/20 text-red-300 animate-pulse" : "bg-slate-700/50 text-gray-300"
              }`}
            >
              <Clock className="w-4 h-4" />
              <span className="font-mono font-bold">{timeRemaining}s</span>
            </div>

            {/* Exit Button */}
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 text-red-400 hover:text-red-300 hover:bg-red-500/20"
              onClick={onExit}
            >
              <X className="w-4 h-4" />
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
        <div className="mb-6">
          <h2 className="text-xl font-medium text-white leading-relaxed">{question.question}</h2>
        </div>

        {/* Answer Options */}
        <div className="grid gap-3 mb-6">
          {question.options.map((option, index) => {
            const stats = getAnswerStats(option)
            const isCorrect = showResults && option === correctAnswer
            const isUserAnswer = option === userAnswer

            return (
              <button
                key={index}
                onClick={() => handleAnswerClick(option)}
                disabled={!!userAnswer || showResults}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-200 ${getAnswerStyle(option)} ${
                  !userAnswer && !showResults ? "cursor-pointer" : "cursor-default"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                        showResults && isCorrect
                          ? "border-green-400 bg-green-500"
                          : showResults && isUserAnswer && !isCorrect
                            ? "border-red-400 bg-red-500"
                            : isUserAnswer
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
                      {isCorrect && <CheckCircle className="w-5 h-5 text-green-400" />}
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
                        className={`h-1 rounded-full transition-all duration-500 ${
                          isCorrect ? "bg-green-400" : "bg-gray-400"
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
              {participants.slice(0, 3).map((participant, index) => (
                <div
                  key={participant.id}
                  className={`w-6 h-6 rounded-full border-2 border-slate-800 flex items-center justify-center text-xs font-bold ${
                    participant.hasAnswered ? "bg-green-500 text-white" : "bg-gray-600 text-gray-300"
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
              <p className="mt-1 text-gray-400">Next question in 3 seconds...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
