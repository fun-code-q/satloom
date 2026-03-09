"use client"

import React, { useState, useEffect } from "react"
import { randomMatchManager, type RandomMatchConfig } from "@/utils/games/random-match"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Search, X, Zap, Globe, Heart } from "lucide-react"
import { cn } from "@/lib/utils"

interface RandomMatchButtonProps {
    userId: string
    userName: string
    onConnect: (partnerId: string, partnerName: string) => void
    onDisconnect: () => void
}

export function RandomMatchButton({ userId, userName, onConnect, onDisconnect }: RandomMatchButtonProps) {
    const [isSearching, setIsSearching] = useState(false)
    const [waitTime, setWaitTime] = useState(0)
    const [session, setSession] = useState<any>(null)
    const [showInterests, setShowInterests] = useState(false)
    const [selectedInterests, setSelectedInterests] = useState<string[]>([])
    const [language, setLanguage] = useState("en")

    const interests = [
        "Gaming", "Music", "Movies", "Sports", "Tech",
        "Art", "Cooking", "Travel", "Books", "Science",
        "Comedy", "Fitness", "Fashion", "Politics", "Nature"
    ]

    const languages = [
        { code: "en", name: "English" },
        { code: "es", name: "Español" },
        { code: "fr", name: "Français" },
        { code: "de", name: "Deutsch" },
        { code: "pt", name: "Português" },
        { code: "ja", name: "日本語" },
        { code: "ko", name: "한국어" },
        { code: "zh", name: "中文" },
    ]

    useEffect(() => {
        randomMatchManager.initialize(userId, userName)

        const unsubscribe = randomMatchManager.subscribe((state) => {
            setIsSearching(state.isSearching)
            setSession(state.session)

            if (state.session?.partnerId && !state.session.partnerName) {
                onConnect(state.session.partnerId, state.session.partnerName || "Stranger")
            }

            if (state.session?.status === "ended") {
                onDisconnect()
            }
        })

        return () => {
            unsubscribe()
            randomMatchManager.destroy()
        }
    }, [userId, userName])

    useEffect(() => {
        let interval: NodeJS.Timeout | null = null

        if (isSearching) {
            interval = setInterval(() => {
                setWaitTime((prev) => prev + 1)
            }, 1000)
        } else {
            setWaitTime(0)
        }

        return () => {
            if (interval) clearInterval(interval)
        }
    }, [isSearching])

    const handleStartSearch = async () => {
        const config: RandomMatchConfig = {
            interests: selectedInterests.length > 0 ? selectedInterests : undefined,
            language,
        }
        await randomMatchManager.startSearching(config)
        setShowInterests(false)
    }

    const handleStopSearch = async () => {
        await randomMatchManager.endSearch()
    }

    const formatWaitTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        if (mins > 0) {
            return `${mins}:${secs.toString().padStart(2, "0")}`
        }
        return `${secs}s`
    }

    return (
        <div className="flex flex-col items-center gap-4">
            {!isSearching ? (
                <div className="flex flex-col items-center gap-4">
                    <Button
                        onClick={() => setShowInterests(true)}
                        className={cn(
                            "bg-gradient-to-r from-purple-500 to-pink-500",
                            "hover:from-purple-600 hover:to-pink-600",
                            "text-white font-bold py-6 px-8 rounded-full",
                            "shadow-lg shadow-purple-500/30 transition-all",
                            "transform hover:scale-105"
                        )}
                    >
                        <Zap className="h-6 w-6 mr-2" />
                        Find Stranger
                    </Button>

                    <p className="text-sm text-muted-foreground text-center max-w-xs">
                        Connect with a random stranger for a chat. You can filter by interests and language.
                    </p>
                </div>
            ) : (
                <Card className="bg-slate-800 border-slate-700 w-80">
                    <CardHeader className="text-center">
                        <div className="mx-auto w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mb-2 animate-pulse">
                            <Search className="h-8 w-8 text-purple-400" />
                        </div>
                        <CardTitle className="text-white">Finding Stranger...</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="text-center">
                            <p className="text-3xl font-mono text-purple-400">{formatWaitTime(waitTime)}</p>
                            <p className="text-sm text-muted-foreground">Average: ~45s</p>
                        </div>

                        {session && (
                            <div className="flex items-center justify-center gap-2">
                                <Users className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">
                                    {session.interests.length > 0
                                        ? `Matching: ${session.interests.join(", ")}`
                                        : "No filters"}
                                </span>
                            </div>
                        )}

                        <Button
                            onClick={handleStopSearch}
                            variant="outline"
                            className="w-full"
                        >
                            <X className="h-4 w-4 mr-2" />
                            Stop Searching
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Interests Modal */}
            {showInterests && !isSearching && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <Card className="bg-slate-800 border-slate-700 max-w-md w-full max-h-[80vh] overflow-auto">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <Heart className="h-5 w-5 text-pink-400" />
                                Find Your Match
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Language Selection */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                    <Globe className="h-4 w-4" />
                                    Preferred Language
                                </label>
                                <div className="grid grid-cols-4 gap-2">
                                    {languages.map((lang) => (
                                        <Button
                                            key={lang.code}
                                            variant={language === lang.code ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setLanguage(lang.code)}
                                            className={language === lang.code ? "bg-purple-500" : ""}
                                        >
                                            {lang.code.toUpperCase()}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            {/* Interests Selection */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">
                                    Interests (optional)
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {interests.map((interest) => (
                                        <Button
                                            key={interest}
                                            variant={selectedInterests.includes(interest) ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => {
                                                setSelectedInterests((prev) =>
                                                    prev.includes(interest)
                                                        ? prev.filter((i) => i !== interest)
                                                        : [...prev, interest]
                                                )
                                            }}
                                            className={selectedInterests.includes(interest) ? "bg-pink-500" : ""}
                                        >
                                            {interest}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => setShowInterests(false)}
                                    className="flex-1"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleStartSearch}
                                    className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500"
                                >
                                    <Search className="h-4 w-4 mr-2" />
                                    Start
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}
