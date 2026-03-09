/**
 * Buzzword Bingo Game Manager
 * 
 * A chat-based bingo game where players mark words as they're spoken.
 */

import { getFirebaseDatabase } from "@/lib/firebase"
import { ref, set, get, update, onValue, remove } from "firebase/database"

// Safe database reference with null check
const getDbRef = (path: string) => {
    if (!getFirebaseDatabase()!) {
        console.error("Firebase database not initialized")
        return null
    }
    return ref(getFirebaseDatabase()!, path)
}

export interface BingoCard {
    id: string
    userId: string
    userName: string
    words: string[]
    markedWords: string[]
    linesCompleted: number
    hasBingo: boolean
}

export interface BingoGame {
    id: string
    roomId: string
    hostId: string
    status: "lobby" | "playing" | "finished"
    bingoWords: string[]
    cards: Record<string, BingoCard>
    calledWords: string[]
    startTime: number
    winner: string | null
}

export interface BingoState {
    isPlaying: boolean
    game: BingoGame | null
    myCard: BingoCard | null
    calledWords: string[]
    canPlay: boolean
}

export const DEFAULT_BINGO_WORDS = [
    "literally", "basically", "actually", "honestly", "like",
    "you know", "I mean", "at the end of the day", "moving forward",
    "leverage", "synergy", "pivot", "disrupt", "innovate",
    "game changer", "paradigm shift", "circle back", "deep dive",
    "low hanging fruit", "touch base", "bandwidth", "optics",
    "new normal", "pivot", "flex", "slay", "vibe",
    "periodt", "it's giving", "main character", "no cap",
    "understood the assignment", "let's go", "sheesh", "ohio",
    "sigma", "mogging", "anning", "beta", "ratio"
]

class BingoGameManager {
    private static instance: BingoGameManager
    private state: BingoState = {
        isPlaying: false,
        game: null,
        myCard: null,
        calledWords: [],
        canPlay: false,
    }
    private listeners: ((state: BingoState) => void)[] = []
    private unsubscribe: (() => void) | null = null
    private roomId: string = ""
    private userId: string = ""
    private userName: string = ""

    private constructor() { }

    static getInstance(): BingoGameManager {
        if (!BingoGameManager.instance) {
            BingoGameManager.instance = new BingoGameManager()
        }
        return BingoGameManager.instance
    }

    initialize(roomId: string, userId: string, userName: string): void {
        this.roomId = roomId
        this.userId = userId
        this.userName = userName
    }

    subscribe(listener: (state: BingoState) => void): () => void {
        this.listeners.push(listener)
        listener(this.state)

        return () => {
            this.listeners = this.listeners.filter(l => l !== listener)
        }
    }

    private notify(): void {
        this.listeners.forEach(listener => listener(this.state))
    }

    async createGame(words: string[] = DEFAULT_BINGO_WORDS): Promise<void> {
        const gameId = `bingo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        const game: BingoGame = {
            id: gameId,
            roomId: this.roomId,
            hostId: this.userId,
            status: "lobby",
            bingoWords: words,
            cards: {},
            calledWords: [],
            startTime: Date.now(),
            winner: null,
        }

        const dbRef = getDbRef(`bingoGames/${gameId}`)
        if (dbRef) {
            await set(dbRef, game)
        }
    }

    async joinGame(gameId: string): Promise<void> {
        // Generate random card
        const shuffled = [...this.state.game?.bingoWords || DEFAULT_BINGO_WORDS].sort(() => Math.random() - 0.5)
        const cardWords = shuffled.slice(0, 24)

        // Insert free space in center
        cardWords.splice(12, 0, "FREE SPACE")

        const card: BingoCard = {
            id: `card_${this.userId}`,
            userId: this.userId,
            userName: this.userName,
            words: cardWords,
            markedWords: ["FREE SPACE"],
            linesCompleted: 0,
            hasBingo: false,
        }

        const dbRef = getDbRef(`bingoGames/${gameId}/cards/${this.userId}`)
        if (dbRef) {
            await update(dbRef, card)
        }

        this.state.isPlaying = true
        this.state.myCard = card
        this.notify()
    }

    async startGame(gameId: string): Promise<void> {
        const dbRef = getDbRef(`bingoGames/${gameId}`)
        if (dbRef) {
            await update(dbRef, {
                status: "playing",
                startTime: Date.now(),
            })
        }

        // Start calling words
        this.callNextWord(gameId)
    }

    private async callNextWord(gameId: string): Promise<void> {
        if (!this.state.game) return

        const availableWords = this.state.game.bingoWords.filter(
            w => !this.state.game!.calledWords.includes(w)
        )

        if (availableWords.length === 0) {
            const dbRef = getDbRef(`bingoGames/${gameId}`)
            if (dbRef) {
                await update(dbRef, {
                    status: "finished",
                })
            }
            return
        }

        const randomWord = availableWords[Math.floor(Math.random() * availableWords.length)]

        const calledWordsRef = getDbRef(`bingoGames/${gameId}/calledWords`)
        if (calledWordsRef) {
            await update(calledWordsRef, {
                [Date.now()]: randomWord,
            })
        }

        // Schedule next word (every 15-30 seconds)
        const delay = 15000 + Math.random() * 15000
        setTimeout(() => {
            if (this.state.game?.status === "playing") {
                this.callNextWord(gameId)
            }
        }, delay)
    }

    async markWord(gameId: string, word: string): Promise<void> {
        if (!this.state.myCard || !this.state.game) return
        if (this.state.game.status !== "playing") return

        // Check if word was called
        const allCalledWords = Object.values(this.state.game.calledWords || {})
        if (!allCalledWords.includes(word)) return

        // Mark the word
        const newMarkedWords = [...this.state.myCard.markedWords, word]

        const markedWordsRef = getDbRef(`bingoGames/${gameId}/cards/${this.userId}/markedWords`)
        if (markedWordsRef) {
            await update(markedWordsRef, {
                ...newMarkedWords.reduce((acc, w, i) => ({ ...acc, [i]: w }), {}),
            })
        }

        // Check for bingo
        const hasBingo = this.checkForBingo(newMarkedWords, this.state.myCard.words)

        if (hasBingo && !this.state.myCard.hasBingo) {
            const cardRef = getDbRef(`bingoGames/${gameId}/cards/${this.userId}`)
            if (cardRef) {
                await update(cardRef, {
                    hasBingo: true,
                    linesCompleted: this.countLines(newMarkedWords, this.state.myCard.words),
                })
            }

            // Declare winner
            if (!this.state.game.winner) {
                const gameRef = getDbRef(`bingoGames/${gameId}`)
                if (gameRef) {
                    await update(gameRef, {
                        winner: this.userId,
                        status: "finished",
                    })
                }
            }
        }

        // Update local state
        this.state.myCard.markedWords = newMarkedWords
        this.state.myCard.hasBingo = hasBingo
        this.notify()
    }

    private checkForBingo(markedWords: string[], cardWords: string[]): boolean {
        // Check rows
        for (let row = 0; row < 5; row++) {
            const rowWords = cardWords.slice(row * 5, row * 5 + 5)
            if (rowWords.every(w => markedWords.includes(w))) return true
        }

        // Check columns
        for (let col = 0; col < 5; col++) {
            const colWords = []
            for (let row = 0; row < 5; row++) {
                colWords.push(cardWords[row * 5 + col])
            }
            if (colWords.every(w => markedWords.includes(w))) return true
        }

        // Check diagonals
        const diag1 = [0, 6, 12, 18, 24]
        if (diag1.every(i => markedWords.includes(cardWords[i]))) return true

        const diag2 = [4, 8, 12, 16, 20]
        if (diag2.every(i => markedWords.includes(cardWords[i]))) return true

        return false
    }

    private countLines(markedWords: string[], cardWords: string[]): number {
        let lines = 0

        // Check rows
        for (let row = 0; row < 5; row++) {
            const rowWords = cardWords.slice(row * 5, row * 5 + 5)
            if (rowWords.every(w => markedWords.includes(w))) lines++
        }

        // Check columns
        for (let col = 0; col < 5; col++) {
            const colWords = []
            for (let row = 0; row < 5; row++) {
                colWords.push(cardWords[row * 5 + col])
            }
            if (colWords.every(w => markedWords.includes(w))) lines++
        }

        // Check diagonals
        const diag1 = [0, 6, 12, 18, 24]
        if (diag1.every(i => markedWords.includes(cardWords[i]))) lines++

        const diag2 = [4, 8, 12, 16, 20]
        if (diag2.every(i => markedWords.includes(cardWords[i]))) lines++

        return lines
    }

    async leaveGame(gameId: string): Promise<void> {
        const cardRef = getDbRef(`bingoGames/${gameId}/cards/${this.userId}`)
        if (cardRef) {
            await remove(cardRef)
        }

        this.state.isPlaying = false
        this.state.myCard = null
        this.notify()
    }

    async endGame(gameId: string): Promise<void> {
        const dbRef = getDbRef(`bingoGames/${gameId}`)
        if (dbRef) {
            await update(dbRef, {
                status: "finished",
            })
        }

        this.state.isPlaying = false
        this.state.myCard = null
        this.notify()
    }

    listenForGame(gameId: string): void {
        const dbRef = getDbRef(`bingoGames/${gameId}`)
        if (dbRef) {
            this.unsubscribe = onValue(dbRef, (snapshot) => {
                const data = snapshot.val() as BingoGame | null
                if (data) {
                    this.state.game = data
                    this.state.calledWords = Object.values(data.calledWords || {})

                    if (data.cards[this.userId]) {
                        this.state.myCard = data.cards[this.userId]
                        this.state.isPlaying = true
                    }

                    this.notify()
                }
            })
        }
    }

    getState(): BingoState {
        return this.state
    }

    getMyCard(): BingoCard | null {
        return this.state.myCard
    }

    getCalledWords(): string[] {
        return this.state.calledWords
    }

    destroy(): void {
        if (this.unsubscribe) {
            this.unsubscribe()
        }
        this.listeners = []
        this.state = {
            isPlaying: false,
            game: null,
            myCard: null,
            calledWords: [],
            canPlay: false,
        }
    }
}

export const bingoGameManager = BingoGameManager.getInstance()
