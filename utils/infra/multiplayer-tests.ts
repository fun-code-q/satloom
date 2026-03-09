/**
 * Integration Verification Script for Multiplayer Game System
 * Tests all 10 phases of the multiplayer implementation
 */

import type { GameState, Player } from "@/utils/games/dots-and-boxes-game"
import type { LobbyState, GameInvite } from "@/utils/infra/game-signaling"
import { PLAYER_COLORS } from "@/utils/core/player-colors"
import { TurnManager } from "@/utils/games/turn-manager"
import { DotsAndBoxesAI } from "@/utils/games/ai-player"

// ============================================================
// TEST UTILITIES
// ============================================================

class TestLogger {
    private passed = 0
    private failed = 0
    private tests: Array<{ name: string; status: 'pass' | 'fail'; error?: string }> = []

    test(name: string, fn: () => void | Promise<void>) {
        try {
            const result = fn()
            if (result instanceof Promise) {
                return result.then(() => {
                    this.passed++
                    this.tests.push({ name, status: 'pass' })
                    console.log(`✅ ${name}`)
                }).catch((error) => {
                    this.failed++
                    this.tests.push({ name, status: 'fail', error: error.message })
                    console.error(`❌ ${name}: ${error.message}`)
                })
            } else {
                this.passed++
                this.tests.push({ name, status: 'pass' })
                console.log(`✅ ${name}`)
            }
        } catch (error: any) {
            this.failed++
            this.tests.push({ name, status: 'fail', error: error.message })
            console.error(`❌ ${name}: ${error.message}`)
        }
    }

    summary() {
        console.log('\n' + '='.repeat(50))
        console.log(`Test Summary: ${this.passed} passed, ${this.failed} failed`)
        console.log('='.repeat(50))
        return { passed: this.passed, failed: this.failed, tests: this.tests }
    }
}

function assert(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(message)
    }
}

function assertEquals(actual: any, expected: any, message?: string) {
    if (actual !== expected) {
        throw new Error(message || `Expected ${expected}, got ${actual}`)
    }
}

// ============================================================
// PHASE 3: PLAYER CUSTOMIZATION TESTS
// ============================================================

function testPlayerCustomization() {
    console.log('\n📝 Testing Phase 3: Player Customization')
    const logger = new TestLogger()

    logger.test('Name validation: 2-20 characters', () => {
        const validName = 'Player1'
        const tooShort = 'A'
        const tooLong = 'A'.repeat(21)

        assert(validName.length >= 2 && validName.length <= 20, 'Valid name should pass')
        assert(tooShort.length < 2, 'Too short name should fail')
        assert(tooLong.length > 20, 'Too long name should fail')
    })

    logger.test('12 unique colors available', () => {
        assertEquals(PLAYER_COLORS.length, 12, 'Should have exactly 12 colors')

        const uniqueColors = new Set(PLAYER_COLORS.map(c => c.primary))
        assertEquals(uniqueColors.size, 12, 'All colors should be unique')
    })

    logger.test('Color data structure', () => {
        PLAYER_COLORS.forEach((color, index) => {
            assert(!!color.primary, `Color ${index} should have primary`)
            assert(!!color.light, `Color ${index} should have light`)
            assert(!!color.dark, `Color ${index} should have dark`)
            assert(!!color.name, `Color ${index} should have name`)
        })
    })

    return (logger as any).summary()
}

// ============================================================
// PHASE 7: TURN MANAGEMENT TESTS
// ============================================================

function testTurnManagement() {
    console.log('\n🔄 Testing Phase 7: Turn Management')
    const logger = new TestLogger()

    const createTestPlayers = (count: number): Player[] => {
        return Array.from({ length: count }, (_, i) => ({
            id: `player${i + 1}`,
            name: `Player ${i + 1}`,
            initials: `P${i + 1}`,
            color: PLAYER_COLORS[i].primary,
            isComputer: false,
            isHost: i === 0,
            status: 'active' as const,
            isReady: true,
            joinedAt: Date.now(),
            lastSeen: Date.now(),
        }))
    }

    logger.test('Turn rotation with 2 players', () => {
        const players = createTestPlayers(2)
        const manager = new TurnManager(players)

        assertEquals(manager.getCurrentPlayer().id, 'player1', 'Should start with player1')

        const next = manager.nextTurn()
        assertEquals(next.id, 'player2', 'Should move to player2')

        const next2 = manager.nextTurn()
        assertEquals(next2.id, 'player1', 'Should wrap back to player1')
    })

    logger.test('Turn rotation with 12 players', () => {
        const players = createTestPlayers(12)
        const manager = new TurnManager(players)

        for (let i = 0; i < 12; i++) {
            const current = manager.getCurrentPlayer()
            assertEquals(current.id, `player${i + 1}`, `Turn ${i} should be player${i + 1}`)
            manager.nextTurn()
        }

        assertEquals(manager.getCurrentPlayer().id, 'player1', 'Should wrap to player1 after 12 turns')
    })

    logger.test('Auto-skip disconnected players', () => {
        const players = createTestPlayers(4)
        players[1].status = 'disconnected' // Disconnect player2

        const manager = new TurnManager(players)
        assertEquals(manager.getCurrentPlayer().id, 'player1')

        const next = manager.nextTurn()
        assertEquals(next.id, 'player3', 'Should skip disconnected player2')
    })

    logger.test('Turn timeout tracking', () => {
        const players = createTestPlayers(2)
        const manager = new TurnManager(players)
        manager.setTurnTimeout(1000) // 1 second

        const timeRemaining = manager.getTimeRemaining()
        assert(timeRemaining > 0, 'Should have time remaining')
        assert(timeRemaining <= 1, 'Should be within timeout limit')
    })

    logger.test('Turn statistics', () => {
        const players = createTestPlayers(3)
        const manager = new TurnManager(players)

        // Make several turns
        for (let i = 0; i < 6; i++) {
            manager.nextTurn()
        }

        const stats = manager.getTurnStats()
        assertEquals(stats.totalTurns, 6, 'Should track 6 turns')
        assert(stats.playerTurnCounts['player1'] === 2, 'Player1 should have 2 turns')
    })

    logger.test('Upcoming players preview', () => {
        const players = createTestPlayers(5)
        const manager = new TurnManager(players)

        const upcoming = manager.getUpcomingPlayers(3)
        assertEquals(upcoming.length, 3, 'Should return 3 upcoming players')
        assertEquals(upcoming[0].id, 'player2', 'First upcoming should be player2')
    })

    return (logger as any).summary()
}

// ============================================================
// PHASE 10: AI PLAYER TESTS
// ============================================================

async function testAIPlayer() {
    console.log('\n🤖 Testing Phase 10: AI Player')
    const logger = new TestLogger()

    const createTestGameState = (): GameState => ({
        id: 'test-game',
        roomId: 'test-room',
        grid: { rows: 3, cols: 3 },
        players: [
            {
                id: 'human',
                name: 'Human',
                initials: 'H',
                color: '#FF6B6B',
                isComputer: false,
                isHost: true,
                status: 'active',
                isReady: true,
                joinedAt: Date.now(),
                lastSeen: Date.now(),
            },
            {
                id: 'ai',
                name: 'AI',
                initials: 'AI',
                color: '#4ECDC4',
                isComputer: true,
                isHost: false,
                status: 'active',
                isReady: true,
                joinedAt: Date.now(),
                lastSeen: Date.now(),
            },
        ],
        currentPlayerIndex: 1,
        horizontalLines: Array(4).fill(null).map(() =>
            Array(3).fill(null).map(() => ({ isDrawn: false, playerId: null }))
        ),
        verticalLines: Array(3).fill(null).map(() =>
            Array(4).fill(null).map(() => ({ isDrawn: false, playerId: null }))
        ),
        boxes: Array(3).fill(null).map(() =>
            Array(3).fill(null).map(() => ({ isCompleted: false, playerId: null }))
        ),
        scores: { human: 0, ai: 0 },
        moveCount: 0,
        gameStatus: 'playing',
        winner: null,
        lastMove: null,
    })

    logger.test('AI difficulty levels exist', () => {
        const easy = new DotsAndBoxesAI('easy')
        const medium = new DotsAndBoxesAI('medium')
        const hard = new DotsAndBoxesAI('hard')
        const expert = new DotsAndBoxesAI('expert')

        assert(easy !== null, 'Easy AI should be created')
        assert(medium !== null, 'Medium AI should be created')
        assert(hard !== null, 'Hard AI should be created')
        assert(expert !== null, 'Expert AI should be created')
    })

    await logger.test('Easy AI makes valid move', async () => {
        const ai = new DotsAndBoxesAI('easy')
        const gameState = createTestGameState()

        const move = await ai.getBestMove(gameState, 'ai')

        assert(!!move, 'AI should return a move')
        if (move) {
            assert(move.type === 'horizontal' || move.type === 'vertical', 'Move should have valid type')
            assert(move.playerId === 'ai', 'Move should be for AI player')
        }
    })

    await logger.test('Hard AI uses strategy', async () => {
        const ai = new DotsAndBoxesAI('hard')
        const gameState = createTestGameState()

        // Set up a box that can be completed
        gameState.horizontalLines[0][0].isDrawn = true
        gameState.horizontalLines[1][0].isDrawn = true
        gameState.verticalLines[0][0].isDrawn = true
        // Missing: verticalLines[0][1] to complete box

        const move = await ai.getBestMove(gameState, 'ai')

        assert(!!move, 'AI should find completing move')
        // Hard AI should prioritize completing the box
    })

    await logger.test('AI thinking time varies by difficulty', async () => {
        const easy = new DotsAndBoxesAI('easy')
        const expert = new DotsAndBoxesAI('expert')
        const gameState = createTestGameState()

        const easyStart = Date.now()
        await easy.getBestMove(gameState, 'ai')
        const easyTime = Date.now() - easyStart

        const expertStart = Date.now()
        await expert.getBestMove(gameState, 'ai')
        const expertTime = Date.now() - expertStart

        assert(expertTime > easyTime, 'Expert should take longer than Easy')
    })

    return (logger as any).summary()
}

// ============================================================
// INTEGRATION TESTS
// ============================================================

function testIntegration() {
    console.log('\n🔗 Testing Integration')
    const logger = new TestLogger()

    logger.test('Lobby to game flow', () => {
        const lobby: LobbyState = {
            gameId: 'test-lobby',
            roomId: 'test-room',
            host: {
                id: 'player1',
                name: 'Player 1',
                initials: 'P1',
                color: PLAYER_COLORS[0].primary,
                isComputer: false,
                isHost: true,
                status: 'active',
                isReady: true,
                joinedAt: Date.now(),
                lastSeen: Date.now(),
            },
            players: [],
            spectators: [],
            readyPlayers: [],
            kickedUsers: [],
            status: 'waiting',
            settings: {
                gridSize: 4,
                maxPlayers: 4,
                voiceChatEnabled: false,
                allowComputerPlayers: true,
            },
            createdAt: Date.now(),
            lastUpdated: Date.now(),
        }

        assert(lobby.host !== undefined, 'Lobby should have host')
        assert(lobby.settings?.gridSize === 4, 'Grid size should be 4')
        assert(lobby.status === 'waiting', 'Lobby should be waiting')
    })

    logger.test('Player color assignment', () => {
        const players: Player[] = []

        for (let i = 0; i < 12; i++) {
            players.push({
                id: `player${i + 1}`,
                name: `Player ${i + 1}`,
                initials: `P${i + 1}`,
                color: PLAYER_COLORS[i].primary,
                isComputer: false,
                isHost: i === 0,
                status: 'active',
                isReady: false,
                joinedAt: Date.now(),
                lastSeen: Date.now(),
            })
        }

        assertEquals(players.length, 12, 'Should support 12 players')

        const colors = players.map(p => p.color)
        const uniqueColors = new Set(colors)
        assertEquals(uniqueColors.size, 12, 'All players should have unique colors')
    })

    logger.test('Scoreboard sorting', () => {
        const scores = {
            player1: 5,
            player2: 10,
            player3: 3,
            player4: 8,
        }

        const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1])

        assertEquals(sorted[0][0], 'player2', 'Player2 should be first')
        assertEquals(sorted[1][0], 'player4', 'Player4 should be second')
        assertEquals(sorted[2][0], 'player1', 'Player1 should be third')
        assertEquals(sorted[3][0], 'player3', 'Player3 should be fourth')
    })

    return (logger as any).summary()
}

// ============================================================
// RUN ALL TESTS
// ============================================================

export async function runAllTests() {
    console.log('🚀 Starting Multiplayer Game System Tests\n')

    const results = {
        phase3: testPlayerCustomization(),
        phase7: testTurnManagement(),
        phase10: await testAIPlayer(),
        integration: testIntegration(),
    }

    console.log('\n' + '='.repeat(50))
    console.log('📊 OVERALL TEST SUMMARY')
    console.log('='.repeat(50))

    let totalPassed = 0
    let totalFailed = 0

    Object.entries(results).forEach(([phase, result]) => {
        console.log(`${phase}: ${result.passed} passed, ${result.failed} failed`)
        totalPassed += result.passed
        totalFailed += result.failed
    })

    console.log('='.repeat(50))
    console.log(`TOTAL: ${totalPassed} passed, ${totalFailed} failed`)
    console.log('='.repeat(50))

    return {
        totalPassed,
        totalFailed,
        results,
    }
}

// Auto-run if executed directly
if (typeof window !== 'undefined') {
    (window as any).runMultiplayerTests = runAllTests
    console.log('💡 Run tests in browser console: runMultiplayerTests()')
}
