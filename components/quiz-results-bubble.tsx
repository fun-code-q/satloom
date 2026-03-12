"use client"

import { Trophy, Medal, Award, Star } from "lucide-react"
import type { QuizResult } from "@/utils/games/quiz-system"

interface QuizResultsBubbleProps {
  results: QuizResult[]
  totalQuestions: number
}

export function QuizResultsBubble({ results, totalQuestions }: QuizResultsBubbleProps) {
  // Sort results by score (descending), then by average time (ascending)
  const sortedResults = [...(results || [])].sort((a, b) => {
    if (b.score !== a.score) {
      return (b.score || 0) - (a.score || 0)
    }
    return (a.averageTime || 0) - (b.averageTime || 0)
  })

  const winner = sortedResults[0]

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-5 h-5 text-yellow-400" />
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />
      case 3:
        return <Award className="w-5 h-5 text-amber-600" />
      default:
        return <Star className="w-5 h-5 text-gray-500" />
    }
  }

  const getRankEmoji = (rank: number) => {
    switch (rank) {
      case 1:
        return "🥇"
      case 2:
        return "🥈"
      case 3:
        return "🥉"
      default:
        return "🏅"
    }
  }

  const getScorePercentage = (score: number) => {
    return Math.round((score / totalQuestions) * 100)
  }

  const formatTime = (seconds: number) => {
    return `${seconds.toFixed(1)}s`
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-gradient-to-br from-yellow-900/40 to-orange-900/40 backdrop-blur-sm border border-yellow-500/30 rounded-2xl p-6 shadow-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Quiz Complete!</h2>
          <p className="text-gray-300">Final Results & Rankings</p>
        </div>

        {/* Winner Announcement */}
        {winner && (
          <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-400/30 rounded-xl p-4 mb-6">
            <div className="text-center">
              <div className="text-4xl mb-2">🎉</div>
              <h3 className="text-xl font-bold text-yellow-400 mb-1">{winner.playerName} Wins!</h3>
              <p className="text-gray-300">
                {winner.score}/{totalQuestions} correct ({getScorePercentage(winner.score)}%)
              </p>
            </div>
          </div>
        )}

        {/* Rankings */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Medal className="w-5 h-5 text-yellow-400" />
            Final Rankings
          </h3>

          {sortedResults.map((result, index) => {
            const rank = index + 1
            const percentage = getScorePercentage(result.score)

            return (
              <div
                key={result.playerId}
                className={`flex items-center justify-between p-4 rounded-xl border-2 ${rank === 1
                    ? "bg-yellow-500/10 border-yellow-400/30"
                    : rank === 2
                      ? "bg-gray-500/10 border-gray-400/30"
                      : rank === 3
                        ? "bg-amber-600/10 border-amber-500/30"
                        : "bg-slate-700/30 border-slate-600/30"
                  }`}
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getRankEmoji(rank)}</span>
                    <div className="flex items-center gap-2">
                      {getRankIcon(rank)}
                      <span className="text-lg font-bold text-white">#{rank}</span>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-white">{result.playerName}</h4>
                    <p className="text-sm text-gray-400">Avg. response time: {formatTime(result.averageTime)}</p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xl font-bold text-white">
                    {result.score}/{totalQuestions}
                  </div>
                  <div
                    className={`text-sm font-medium ${percentage >= 80
                        ? "text-green-400"
                        : percentage >= 60
                          ? "text-yellow-400"
                          : percentage >= 40
                            ? "text-orange-400"
                            : "text-red-400"
                      }`}
                  >
                    {percentage}%
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Statistics */}
        <div className="mt-6 pt-6 border-t border-slate-600">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-2xl font-bold text-white">{totalQuestions}</div>
              <div className="text-sm text-gray-400">Total Questions</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-2xl font-bold text-white">{results.length}</div>
              <div className="text-sm text-gray-400">Participants</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-gray-400 text-sm">
            Thanks for playing! Type <span className="text-cyan-400 font-mono">?quiz?</span> to start another quiz.
          </p>
        </div>
      </div>
    </div>
  )
}
