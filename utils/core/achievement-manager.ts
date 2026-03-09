// Achievement System for Gamification
// Tracks user achievements, badges, and stats

import { getFirebaseDatabase } from "@/lib/firebase"
import { ref, set, get, update, increment } from "firebase/database"

export type AchievementCategory = "communication" | "games" | "social" | "special" | "time"

export interface Achievement {
    id: string
    name: string
    description: string
    icon: string
    category: AchievementCategory
    requirement: number
    points: number
    isSecret: boolean
}

export interface UserAchievement {
    achievementId: string
    unlockedAt: number
    progress: number
}

export interface UserStats {
    userId: string
    totalPoints: number
    achievements: UserAchievement[]
    stats: {
        messagesSent: number
        callsJoined: number
        gamesPlayed: number
        gamesWon: number
        whiteboardsCreated: number
        quizzesCompleted: number
        timeSpent: number // minutes
        streak: number // days
        lastActive: number
    }
    level: number
    rank: string
}

export interface LeaderboardEntry {
    userId: string
    userName: string
    avatar?: string
    totalPoints: number
    level: number
    rank: string
}

// Achievement Definitions
export const ACHIEVEMENTS: Achievement[] = [
    // Communication
    { id: "first_message", name: "First Step", description: "Send your first message", icon: "💬", category: "communication", requirement: 1, points: 10, isSecret: false },
    { id: "chatty", name: "Chatty", description: "Send 100 messages", icon: "🗣️", category: "communication", requirement: 100, points: 50, isSecret: false },
    { id: "storyteller", name: "Storyteller", description: "Send 1000 messages", icon: "📖", category: "communication", requirement: 1000, points: 100, isSecret: false },

    // Games
    { id: "first_game", name: "Player One", description: "Play your first game", icon: "🎮", category: "games", requirement: 1, points: 20, isSecret: false },
    { id: "gamer", name: "Dedicated Gamer", description: "Play 50 games", icon: "🕹️", category: "games", requirement: 50, points: 75, isSecret: false },
    { id: "champion", name: "Champion", description: "Win 25 games", icon: "🏆", category: "games", requirement: 25, points: 150, isSecret: false },
    { id: "quiz_master", name: "Quiz Master", description: "Complete 10 quizzes with 80%+ score", icon: "🎓", category: "games", requirement: 10, points: 100, isSecret: false },

    // Social
    { id: "introduce", name: "Nice to Meet You", description: "Join a room with at least 3 other people", icon: "👋", category: "social", requirement: 1, points: 25, isSecret: false },
    { id: "social_butterfly", name: "Social Butterfly", description: "Visit 20 different rooms", icon: "🦋", category: "social", requirement: 20, points: 100, isSecret: false },
    { id: "host_with_most", name: "Host with the Most", description: "Create 10 rooms", icon: "🏠", category: "social", requirement: 10, points: 100, isSecret: false },

    // Time-based
    { id: "early_bird", name: "Early Bird", description: "Be active before 7 AM", icon: "🌅", category: "time", requirement: 1, points: 30, isSecret: false },
    { id: "night_owl", name: "Night Owl", description: "Be active after 11 PM", icon: "🦉", category: "time", requirement: 1, points: 30, isSecret: false },
    { id: "weekend_warrior", name: "Weekend Warrior", description: "Be active on weekends for 4 weeks", icon: "🎉", category: "time", requirement: 4, points: 75, isSecret: false },

    // Special
    { id: "founding_member", name: "Founding Member", description: "Be among the first 100 users", icon: "⭐", category: "special", requirement: 1, points: 200, isSecret: true },
    { id: "bug_hunter", name: "Bug Hunter", description: "Report a bug that gets fixed", icon: "🐛", category: "special", requirement: 1, points: 150, isSecret: false },
]

// Level definitions
export const LEVELS = [
    { level: 1, title: "Newcomer", minPoints: 0 },
    { level: 2, title: "Regular", minPoints: 100 },
    { level: 3, title: "Contributor", minPoints: 300 },
    { level: 4, title: "Member", minPoints: 600 },
    { level: 5, title: "Active", minPoints: 1000 },
    { level: 6, title: "Power User", minPoints: 1500 },
    { level: 7, title: "Expert", minPoints: 2500 },
    { level: 8, title: "Master", minPoints: 4000 },
    { level: 9, title: "Legend", minPoints: 6000 },
    { level: 10, title: "Elite", minPoints: 10000 },
]

// Rank definitions
export const RANKS = [
    { rank: "Bronze", minLevel: 1 },
    { rank: "Silver", minLevel: 3 },
    { rank: "Gold", minLevel: 5 },
    { rank: "Platinum", minLevel: 7 },
    { rank: "Diamond", minLevel: 9 },
]

export class AchievementManager {
    private static instance: AchievementManager

    static getInstance(): AchievementManager {
        if (!AchievementManager.instance) {
            AchievementManager.instance = new AchievementManager()
        }
        return AchievementManager.instance
    }

    // Get all achievements
    static getAchievements(): Achievement[] {
        return ACHIEVEMENTS
    }

    // Get achievement by ID
    static getAchievement(id: string): Achievement | undefined {
        return ACHIEVEMENTS.find((a) => a.id === id)
    }

    // Calculate level from points
    static calculateLevel(totalPoints: number): { level: number; title: string; progress: number } {
        let currentLevel = 1
        let currentTitle = LEVELS[0].title

        for (let i = LEVELS.length - 1; i >= 0; i--) {
            if (totalPoints >= LEVELS[i].minPoints) {
                currentLevel = LEVELS[i].level
                currentTitle = LEVELS[i].title
                break
            }
        }

        // Calculate progress to next level
        let progress = 100
        if (currentLevel < LEVELS.length) {
            const currentMin = LEVELS[currentLevel - 1].minPoints
            const nextMin = LEVELS[currentLevel].minPoints
            const range = nextMin - currentMin
            const current = totalPoints - currentMin
            progress = Math.min(100, Math.round((current / range) * 100))
        }

        return { level: currentLevel, title: currentTitle, progress }
    }

    // Get rank from level
    static getRank(level: number): string {
        for (let i = RANKS.length - 1; i >= 0; i--) {
            if (level >= RANKS[i].minLevel) {
                return RANKS[i].rank
            }
        }
        return RANKS[0].rank
    }

    // Initialize user stats
    async initializeUser(userId: string, userName: string): Promise<UserStats | null> {
        if (!getFirebaseDatabase()!) return null

        try {
            const statsRef = ref(getFirebaseDatabase()!, `users/${userId}/stats`)
            const snapshot = await get(statsRef)

            if (snapshot.exists()) {
                return snapshot.val() as UserStats
            }

            const stats: UserStats = {
                userId,
                totalPoints: 0,
                achievements: [],
                stats: {
                    messagesSent: 0,
                    callsJoined: 0,
                    gamesPlayed: 0,
                    gamesWon: 0,
                    whiteboardsCreated: 0,
                    quizzesCompleted: 0,
                    timeSpent: 0,
                    streak: 0,
                    lastActive: Date.now(),
                },
                level: 1,
                rank: "Bronze",
            }

            await set(statsRef, stats)
            return stats
        } catch (error) {
            console.error("Failed to initialize user stats:", error)
            return null
        }
    }

    // Increment stat and check achievements
    async incrementStat(
        userId: string,
        statName: keyof UserStats["stats"],
        amount: number = 1
    ): Promise<UserAchievement[]> {
        if (!getFirebaseDatabase()!) return []

        try {
            const statsRef = ref(getFirebaseDatabase()!, `users/${userId}/stats`)
            const snapshot = await get(statsRef)

            if (!snapshot.exists()) {
                await this.initializeUser(userId, "Unknown")
            }

            const stats = snapshot.val() as UserStats
            const newAchievements: UserAchievement[] = []

            // Increment stat
            stats.stats[statName] = (stats.stats[statName] || 0) + amount
            stats.totalPoints += amount * 1 // 1 point per stat increment
            stats.stats.lastActive = Date.now()

            // Check for new achievements
            for (const achievement of ACHIEVEMENTS) {
                if (achievement.category !== this.getCategoryFromStat(statName)) continue

                const existing = stats.achievements.find((a) => a.achievementId === achievement.id)
                if (existing) {
                    existing.progress = stats.stats[statName]
                    if (existing.progress >= achievement.requirement && !existing.unlockedAt) {
                        existing.unlockedAt = Date.now()
                        stats.totalPoints += achievement.points
                        newAchievements.push(existing)
                    }
                } else if (stats.stats[statName] >= achievement.requirement) {
                    const newAchievement: UserAchievement = {
                        achievementId: achievement.id,
                        unlockedAt: Date.now(),
                        progress: stats.stats[statName],
                    }
                    stats.achievements.push(newAchievement)
                    stats.totalPoints += achievement.points
                    newAchievements.push(newAchievement)
                }
            }

            // Update level and rank
            const levelInfo = AchievementManager.calculateLevel(stats.totalPoints)
            stats.level = levelInfo.level
            stats.rank = AchievementManager.getRank(stats.level)

            // Save to Firebase
            await set(statsRef, stats)

            return newAchievements
        } catch (error) {
            console.error("Failed to increment stat:", error)
            return []
        }
    }

    private getCategoryFromStat(statName: string): AchievementCategory {
        switch (statName) {
            case "messagesSent":
                return "communication"
            case "gamesPlayed":
            case "gamesWon":
            case "quizzesCompleted":
                return "games"
            case "callsJoined":
                return "social"
            default:
                return "special"
        }
    }

    // Get user stats
    async getUserStats(userId: string): Promise<UserStats | null> {
        if (!getFirebaseDatabase()!) return null

        try {
            const statsRef = ref(getFirebaseDatabase()!, `users/${userId}/stats`)
            const snapshot = await get(statsRef)
            return snapshot.exists() ? (snapshot.val() as UserStats) : null
        } catch (error) {
            console.error("Failed to get user stats:", error)
            return null
        }
    }

    // Get user achievements
    async getUserAchievements(userId: string): Promise<UserAchievement[]> {
        const stats = await this.getUserStats(userId)
        return stats?.achievements || []
    }

    // Get leaderboard
    async getLeaderboard(limit: number = 10): Promise<LeaderboardEntry[]> {
        if (!getFirebaseDatabase()!) return []

        try {
            const usersRef = ref(getFirebaseDatabase()!, "users")
            const snapshot = await get(usersRef)

            if (!snapshot.exists()) {
                return []
            }

            const entries: LeaderboardEntry[] = []

            snapshot.forEach((child) => {
                const userData = child.val()
                if (userData.stats) {
                    const stats = userData.stats as UserStats
                    entries.push({
                        userId: stats.userId,
                        userName: userData.name || "Unknown",
                        avatar: userData.avatar,
                        totalPoints: stats.totalPoints,
                        level: stats.level,
                        rank: stats.rank,
                    })
                }
            })

            return entries
                .sort((a, b) => b.totalPoints - a.totalPoints)
                .slice(0, limit)
        } catch (error) {
            console.error("Failed to get leaderboard:", error)
            return []
        }
    }

    // Unlock special achievement
    async unlockSpecialAchievement(userId: string, achievementId: string): Promise<boolean> {
        if (!getFirebaseDatabase()!) return false

        try {
            const achievement = AchievementManager.getAchievement(achievementId)
            if (!achievement || achievement.category !== "special") {
                return false
            }

            const stats = await this.getUserStats(userId)
            if (!stats) return false

            const existing = stats.achievements.find((a) => a.achievementId === achievementId)
            if (existing) return false

            const newAchievement: UserAchievement = {
                achievementId,
                unlockedAt: Date.now(),
                progress: 1,
            }

            stats.achievements.push(newAchievement)
            stats.totalPoints += achievement.points

            const statsRef = ref(getFirebaseDatabase()!, `users/${userId}/stats`)
            await set(statsRef, stats)

            return true
        } catch (error) {
            console.error("Failed to unlock special achievement:", error)
            return false
        }
    }

    // Check streak
    async updateStreak(userId: string): Promise<number> {
        const stats = await this.getUserStats(userId)
        if (!stats) return 0

        const now = Date.now()
        const lastActive = stats.stats.lastActive
        const oneDay = 24 * 60 * 60 * 1000

        // Check if last active was yesterday
        if (lastActive + oneDay >= now) {
            return stats.stats.streak
        }

        // Check if last active was today
        if (lastActive + oneDay < now && lastActive >= now - oneDay) {
            return stats.stats.streak
        }

        // Reset streak if more than 1 day gap
        if (now - lastActive > oneDay * 2) {
            return 0
        }

        return stats.stats.streak + 1
    }
}
