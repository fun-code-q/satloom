"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Trophy, Eye, BarChart3, Coins, Target, X, Users, Crown } from "lucide-react"
import { cn } from "@/utils/core/cn"
import type { GameSeries, GameSeriesMatch } from "@/utils/games/game-series-manager"

interface GameSeriesViewerProps {
    series: GameSeries
    currentUserId: string
    onClose: () => void
    onWatchMatch: (match: GameSeriesMatch) => void
    onPredict: (match: GameSeriesMatch, winnerId: string) => void
    onVote: (match: GameSeriesMatch, winnerId: string) => void
    onBet: (match: GameSeriesMatch, winnerId: string, amount: number) => void
    onReportComputerResult: (match: GameSeriesMatch, winnerId: string, winnerName: string) => void
}

export function GameSeriesViewer({
    series,
    currentUserId,
    onClose,
    onWatchMatch,
    onPredict,
    onVote,
    onBet,
    onReportComputerResult
}: GameSeriesViewerProps) {
    const [betByMatch, setBetByMatch] = useState<Record<string, number>>({})

    const sortedMatches = useMemo(() => {
        return [...series.matches].sort((a, b) => {
            if (a.round === b.round) return a.position - b.position
            return a.round - b.round
        })
    }, [series.matches])

    const getCountByWinner = (
        source: GameSeries["predictions"] | GameSeries["votes"],
        matchId: string
    ) => {
        const row = source?.[matchId] || {}
        const counts: Record<string, number> = {}
        Object.values(row).forEach((entry) => {
            counts[entry.winnerId] = (counts[entry.winnerId] || 0) + 1
        })
        return counts
    }

    const getBetTotalByWinner = (matchId: string) => {
        const row = series.bets?.[matchId] || {}
        const totals: Record<string, number> = {}
        Object.values(row).forEach((entry) => {
            totals[entry.winnerId] = (totals[entry.winnerId] || 0) + (entry.amount || 0)
        })
        return totals
    }

    return (
        <div className="fixed inset-0 z-[560] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
            <div className="w-full max-w-4xl max-h-[88vh] overflow-hidden rounded-3xl border border-white/10 bg-slate-900/95 shadow-2xl flex flex-col">
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-slate-900/80">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
                            <Trophy className="w-5 h-5 text-cyan-300" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-base sm:text-lg font-black text-white tracking-tight truncate">Game Series</h2>
                            <p className="text-xs text-slate-400">
                                Round {series.currentRound} • {series.status === "completed" ? "Completed" : "Live"}
                            </p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-9 w-9 text-slate-300 hover:text-white hover:bg-white/10">
                        <X className="w-4 h-4" />
                    </Button>
                </div>

                <div className="overflow-y-auto p-3 sm:p-4 space-y-3">
                    {series.finalWinnerId && (
                        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 flex items-center gap-3">
                            <Crown className="w-5 h-5 text-emerald-300" />
                            <div className="text-sm text-white">
                                <span className="text-emerald-300 font-black">{series.finalWinnerName}</span> is the final winner.
                            </div>
                        </div>
                    )}

                    {sortedMatches.map((match) => {
                        const predictionCounts = getCountByWinner(series.predictions, match.id)
                        const voteCounts = getCountByWinner(series.votes, match.id)
                        const betTotals = getBetTotalByWinner(match.id)
                        const myBet = betByMatch[match.id] || 100
                        const player2Id = match.player2?.id || ""
                        const hasSecondPlayer = player2Id.length > 0
                        const canReportComputer = match.isComputerMatch && !match.winnerId &&
                            (match.player1.id === currentUserId || match.player2?.id === currentUserId)

                        return (
                            <div key={match.id} className="rounded-2xl border border-white/10 bg-slate-800/50 p-3 sm:p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                    <div className="text-xs font-black uppercase tracking-widest text-cyan-300">
                                        Round {match.round} • Match {match.position}
                                    </div>
                                    <span className={cn(
                                        "text-[11px] px-2.5 py-1 rounded-full border font-semibold",
                                        match.status === "completed" ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/30" :
                                            match.status === "in_progress" ? "text-cyan-300 bg-cyan-500/10 border-cyan-500/30" :
                                                "text-amber-300 bg-amber-500/10 border-amber-500/30"
                                    )}>
                                        {match.status.replace("_", " ")}
                                    </span>
                                </div>

                                <div className="grid sm:grid-cols-2 gap-2 text-sm mb-3">
                                    <div className={cn("rounded-xl border border-white/10 p-2.5", match.winnerId === match.player1.id && "border-emerald-500/40 bg-emerald-500/10")}>
                                        <div className="text-slate-200 font-semibold truncate">{match.player1.name}</div>
                                    </div>
                                    <div className={cn("rounded-xl border border-white/10 p-2.5", match.winnerId && match.player2?.id === match.winnerId && "border-emerald-500/40 bg-emerald-500/10")}>
                                        <div className="text-slate-200 font-semibold truncate">{match.player2?.name || "TBD"}</div>
                                    </div>
                                </div>

                                {match.winnerName && (
                                    <div className="text-xs text-emerald-300 font-semibold mb-3">Winner: {match.winnerName}</div>
                                )}

                                <div className="grid md:grid-cols-3 gap-2 mb-3">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={!match.gameId}
                                        className="border-slate-600 bg-transparent hover:bg-slate-700 text-slate-200"
                                        onClick={() => onWatchMatch(match)}
                                    >
                                        <Eye className="w-3.5 h-3.5 mr-1.5" />
                                        Watch
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="border-slate-600 bg-transparent hover:bg-slate-700 text-slate-200"
                                        onClick={() => onPredict(match, match.player1.id)}
                                    >
                                        <Target className="w-3.5 h-3.5 mr-1.5" />
                                        Predict {match.player1.name}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={!hasSecondPlayer}
                                        className="border-slate-600 bg-transparent hover:bg-slate-700 text-slate-200"
                                        onClick={() => {
                                            if (!hasSecondPlayer) return
                                            onPredict(match, player2Id)
                                        }}
                                    >
                                        <Target className="w-3.5 h-3.5 mr-1.5" />
                                        Predict {match.player2?.name || "TBD"}
                                    </Button>
                                </div>

                                <div className="grid md:grid-cols-3 gap-2 mb-2">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="justify-start text-slate-300 hover:bg-slate-700"
                                        onClick={() => onVote(match, match.player1.id)}
                                    >
                                        <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
                                        Vote {match.player1.name} ({predictionCounts[match.player1.id] || 0}/{voteCounts[match.player1.id] || 0})
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        disabled={!hasSecondPlayer}
                                        className="justify-start text-slate-300 hover:bg-slate-700"
                                        onClick={() => {
                                            if (!hasSecondPlayer) return
                                            onVote(match, player2Id)
                                        }}
                                    >
                                        <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
                                        Vote {match.player2?.name || "TBD"} ({predictionCounts[player2Id] || 0}/{voteCounts[player2Id] || 0})
                                    </Button>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <input
                                            type="number"
                                            min={1}
                                            max={100000}
                                            value={myBet}
                                            onChange={(event) => {
                                                const value = Number(event.target.value) || 1
                                                setBetByMatch((prev) => ({ ...prev, [match.id]: value }))
                                            }}
                                            className="h-8 w-24 bg-slate-900 border border-slate-600 rounded-md px-2 text-xs text-white"
                                        />
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="text-slate-300 hover:bg-slate-700"
                                            onClick={() => onBet(match, match.player1.id, myBet)}
                                        >
                                            <Coins className="w-3.5 h-3.5 mr-1.5" />
                                            Bet {match.player1.name}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            disabled={!hasSecondPlayer}
                                            className="text-slate-300 hover:bg-slate-700"
                                            onClick={() => {
                                                if (!hasSecondPlayer) return
                                                onBet(match, player2Id, myBet)
                                            }}
                                        >
                                            <Coins className="w-3.5 h-3.5 mr-1.5" />
                                            Bet {match.player2?.name || "TBD"}
                                        </Button>
                                    </div>
                                </div>

                                <div className="text-[11px] text-slate-400 mb-2">
                                    Bet totals: {match.player1.name} {betTotals[match.player1.id] || 0} • {match.player2?.name || "TBD"} {betTotals[player2Id] || 0}
                                </div>

                                {canReportComputer && (
                                    <div className="grid sm:grid-cols-2 gap-2 pt-2 border-t border-white/10">
                                        <Button
                                            size="sm"
                                            className="bg-emerald-600 hover:bg-emerald-500 text-white"
                                            onClick={() => onReportComputerResult(match, currentUserId, match.player1.id === currentUserId ? match.player1.name : (match.player2?.name || "You"))}
                                        >
                                            I Won vs Computer
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="border-rose-500/30 text-rose-300 hover:bg-rose-500/10"
                                            onClick={() => onReportComputerResult(match, match.player2?.id || "computer", match.player2?.name || "Computer")}
                                        >
                                            Computer Won
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>

                <div className="p-3 border-t border-white/10 text-xs text-slate-400 flex items-center gap-2">
                    <Users className="w-3.5 h-3.5" />
                    Viewers can switch matches, vote, bet, and predict here. Use room chat for live comments and reactions.
                </div>
            </div>
        </div>
    )
}

