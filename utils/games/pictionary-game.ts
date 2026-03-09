/**
 * Pictionary Game Engine
 * 
 * Multiplayer drawing and guessing game with
 * real-time collaboration, AI hints, and scoring.
 */

type GamePhase = 'lobby' | 'drawing' | 'guessing' | 'reveal' | 'round-end' | 'game-end';
type BrushTool = 'pencil' | 'brush' | 'eraser' | 'fill' | 'spray';
type DrawingCategory = 'animals' | 'food' | 'objects' | 'actions' | 'people' | 'places' | 'all';

interface BrushSettings {
    tool: BrushTool;
    size: number;
    color: string;
    opacity: number;
    hardness: number;
}

interface Stroke {
    id: string;
    points: { x: number; y: number }[];
    settings: BrushSettings;
    timestamp: number;
}

interface DrawingLayer {
    id: string;
    name: string;
    strokes: Stroke[];
    visible: boolean;
    opacity: number;
    locked: boolean;
}

interface PictionaryWord {
    word: string;
    difficulty: 'easy' | 'medium' | 'hard';
    category: DrawingCategory;
    hints: string[];
}

interface Player {
    id: string;
    name: string;
    avatar?: string;
    score: number;
    isDrawing: boolean;
    hasGuessed: boolean;
    guessedCorrectly: boolean;
    isReady: boolean;
    joinTime: number;
}

interface GuessedPlayer {
    playerId: string;
    guessTime: number;
    points: number;
}

interface PictionaryGameState {
    gameId: string;
    phase: GamePhase;
    players: Player[];
    currentDrawer: string | null;
    currentWord: PictionaryWord | null;
    wordOptions: PictionaryWord[];
    drawingTime: number;
    roundNumber: number;
    maxRounds: number;
    drawingLayers: DrawingLayer[];
    currentLayerId: string;
    brushSettings: BrushSettings;
    guessedPlayers: GuessedPlayer[];
    totalGuesses: number;
    correctGuessOrder: string[];
    revealedWords: string[];
}

interface GameConfig {
    drawingTime: number; // seconds
    maxRounds: number;
    minPlayers: number;
    maxPlayers: number;
    categories: DrawingCategory[];
    difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
    enableAIHints: boolean;
    enableProgressiveReveal: boolean;
}

interface AIGuess {
    word: string;
    confidence: number;
    reasoning: string;
}

class PictionaryGame {
    private static instance: PictionaryGame;
    private state: PictionaryGameState;
    private config: GameConfig;
    private wordBank: PictionaryWord[] = [];
    private listeners: ((state: PictionaryGameState) => void)[] = [];
    private timerInterval: NodeJS.Timeout | null = null;

    private constructor() {
        this.config = {
            drawingTime: 60,
            maxRounds: 3,
            minPlayers: 2,
            maxPlayers: 8,
            categories: ['all'],
            difficulty: 'mixed',
            enableAIHints: true,
            enableProgressiveReveal: true,
        };

        this.state = this.getInitialState();
        this.initializeWordBank();
    }

    static getInstance(): PictionaryGame {
        if (!PictionaryGame.instance) {
            PictionaryGame.instance = new PictionaryGame();
        }
        return PictionaryGame.instance;
    }

    /**
     * Initialize word bank
     */
    private initializeWordBank(): void {
        this.wordBank = [
            // Animals
            { word: 'elephant', difficulty: 'easy', category: 'animals', hints: ['Large mammal', 'Has trunk', 'Gray color'] },
            { word: 'giraffe', difficulty: 'easy', category: 'animals', hints: ['Long neck', 'Spots', 'Tallest animal'] },
            { word: 'penguin', difficulty: 'easy', category: 'animals', hints: ['Black and white', 'Cannot fly', 'Lives in cold'] },
            { word: 'dolphin', difficulty: 'medium', category: 'animals', hints: ['Smart', 'Lives in water', 'Makes sounds'] },
            { word: 'octopus', difficulty: 'medium', category: 'animals', hints: ['Eight arms', 'Lives in ocean', 'Can change color'] },
            { word: 'chameleon', difficulty: 'hard', category: 'animals', hints: ['Changes color', 'Long tongue', 'Lizard family'] },

            // Food
            { word: 'pizza', difficulty: 'easy', category: 'food', hints: ['Italian food', 'Has cheese', 'Round shape'] },
            { word: 'hamburger', difficulty: 'easy', category: 'food', hints: ['Fast food', 'Has bun', 'Contains meat'] },
            { word: 'sushi', difficulty: 'medium', category: 'food', hints: ['Japanese food', 'Has rice', 'Raw fish'] },
            { word: 'croissant', difficulty: 'medium', category: 'food', hints: ['French', 'Pastry', 'Crescent shape'] },
            { word: 'tacos', difficulty: 'easy', category: 'food', hints: ['Mexican food', 'Shell shape', 'Has meat and toppings'] },
            { word: 'ice cream', difficulty: 'easy', category: 'food', hints: ['Cold dessert', 'Comes in flavors', 'Can be in cone'] },

            // Objects
            { word: 'umbrella', difficulty: 'easy', category: 'objects', hints: ['Keeps you dry', 'Has handle', 'Opens up'] },
            { word: 'telescope', difficulty: 'medium', category: 'objects', hints: ['See far away', 'Has lenses', 'Used for stars'] },
            { word: 'hourglass', difficulty: 'medium', category: 'objects', hints: ['Measures time', 'Has sand', 'Two glass bulbs'] },
            { word: 'typewriter', difficulty: 'hard', category: 'objects', hints: ['Old writing device', 'Keys', 'No screen'] },
            { word: 'microscope', difficulty: 'hard', category: 'objects', hints: ['See small things', 'Has lenses', 'Used in science'] },

            // Actions
            { word: 'swimming', difficulty: 'easy', category: 'actions', hints: ['Water activity', 'Uses arms and legs', 'Olympic sport'] },
            { word: 'cooking', difficulty: 'easy', category: 'actions', hints: ['Kitchen activity', 'Uses heat', 'Makes food'] },
            { word: 'juggling', difficulty: 'medium', category: 'actions', hints: ['Keep things in air', 'Uses hands', 'Circus skill'] },
            { word: 'meditating', difficulty: 'medium', category: 'actions', hints: ['Relaxing', 'Eyes closed', 'Sitting position'] },
            { word: 'rock climbing', difficulty: 'hard', category: 'actions', hints: ['Vertical sport', 'Uses ropes', 'On mountain or wall'] },

            // People
            { word: 'firefighter', difficulty: 'easy', category: 'people', hints: ['Hero job', 'Wears helmet', 'Uses hose'] },
            { word: 'astronaut', difficulty: 'easy', category: 'people', hints: ['Space job', 'Wears suit', 'Goes to moon'] },
            { word: 'pirate', difficulty: 'medium', category: 'people', hints: ['Sailor', 'Has eye patch', 'Says ahoy'] },
            { word: 'wizard', difficulty: 'medium', category: 'people', hints: ['Magical', 'Has wand', 'Wears robe'] },
            { word: 'detective', difficulty: 'medium', category: 'people', hints: ['Investigates', 'Uses magnifying glass', 'Solves crimes'] },

            // Places
            { word: 'beach', difficulty: 'easy', category: 'places', hints: ['Sand and water', 'Vacation spot', 'Sunny'] },
            { word: 'volcano', difficulty: 'medium', category: 'places', hints: ['Mountain', 'Erupts', 'Has lava'] },
            { word: 'camping', difficulty: 'medium', category: 'places', hints: ['Outdoor', 'Tent', 'Nature'] },
            { word: 'lighthouse', difficulty: 'hard', category: 'places', hints: ['Near ocean', 'Has light', 'Helps ships'] },
            { word: 'pyramid', difficulty: 'medium', category: 'places', hints: ['Ancient', 'Triangle shape', 'In Egypt'] },
        ];
    }

    /**
     * Get initial state
     */
    private getInitialState(): PictionaryGameState {
        return {
            gameId: this.generateGameId(),
            phase: 'lobby',
            players: [],
            currentDrawer: null,
            currentWord: null,
            wordOptions: [],
            drawingTime: this.config.drawingTime,
            roundNumber: 1,
            maxRounds: this.config.maxRounds,
            drawingLayers: [
                { id: 'layer-1', name: 'Layer 1', strokes: [], visible: true, opacity: 1, locked: false },
            ],
            currentLayerId: 'layer-1',
            brushSettings: {
                tool: 'pencil',
                size: 5,
                color: '#000000',
                opacity: 1,
                hardness: 0.5,
            },
            guessedPlayers: [],
            totalGuesses: 0,
            correctGuessOrder: [],
            revealedWords: [],
        };
    }

    /**
     * Generate game ID
     */
    private generateGameId(): string {
        return 'pictionary-' + Math.random().toString(36).substring(2, 9);
    }

    /**
     * Get current state
     */
    getState(): PictionaryGameState {
        return { ...this.state };
    }

    /**
     * Update config
     */
    updateConfig(config: Partial<GameConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Add player
     */
    addPlayer(player: Omit<Player, 'score' | 'isDrawing' | 'hasGuessed' | 'guessedCorrectly' | 'isReady' | 'joinTime'>): void {
        const newPlayer: Player = {
            ...player,
            score: 0,
            isDrawing: false,
            hasGuessed: false,
            guessedCorrectly: false,
            isReady: false,
            joinTime: Date.now(),
        };

        this.state.players.push(newPlayer);
        this.notifyListeners();
    }

    /**
     * Remove player
     */
    removePlayer(playerId: string): void {
        this.state.players = this.state.players.filter(p => p.id !== playerId);
        this.notifyListeners();
    }

    /**
     * Set player ready
     */
    setPlayerReady(playerId: string, ready: boolean): void {
        const player = this.state.players.find(p => p.id === playerId);
        if (player) {
            player.isReady = ready;
            this.notifyListeners();
        }
    }

    /**
     * Check if all players ready
     */
    private allPlayersReady(): boolean {
        return this.state.players.length >= this.config.minPlayers &&
            this.state.players.every(p => p.isReady);
    }

    /**
     * Start game
     */
    async startGame(): Promise<boolean> {
        if (!this.allPlayersReady()) return false;

        this.state.phase = 'drawing';
        this.state.roundNumber = 1;
        this.state.drawingLayers = [
            { id: 'layer-1', name: 'Layer 1', strokes: [], visible: true, opacity: 1, locked: false },
        ];
        this.state.currentLayerId = 'layer-1';

        // Start first round
        await this.startRound();

        return true;
    }

    /**
     * Start new round
     */
    private async startRound(): Promise<void> {
        if (this.state.roundNumber > this.state.maxRounds) {
            this.state.phase = 'game-end';
            this.notifyListeners();
            return;
        }

        // Select drawer (rotate through players)
        if (!this.state.currentDrawer) {
            this.state.currentDrawer = this.state.players[0]?.id || null;
        } else {
            const currentIndex = this.state.players.findIndex(p => p.id === this.state.currentDrawer);
            const nextIndex = (currentIndex + 1) % this.state.players.length;
            this.state.currentDrawer = this.state.players[nextIndex]?.id || null;
        }

        // Select word
        this.selectWord();

        // Reset player states
        this.state.players.forEach(p => {
            p.isDrawing = p.id === this.state.currentDrawer;
            p.hasGuessed = false;
            p.guessedCorrectly = false;
        });

        this.state.guessedPlayers = [];
        this.state.totalGuesses = 0;
        this.state.phase = 'drawing';
        this.state.drawingTime = this.config.drawingTime;

        // Start timer
        this.startTimer();
        this.notifyListeners();
    }

    /**
     * Select word for current drawer
     */
    private selectWord(): void {
        // Get words that haven't been revealed this game
        const availableWords = this.wordBank.filter(
            w => !this.state.revealedWords.includes(w.word)
        );

        // Select random words for options
        const shuffled = [...availableWords].sort(() => Math.random() - 0.5);
        this.state.wordOptions = shuffled.slice(0, 3);

        // First option will be the word to draw
        this.state.currentWord = this.state.wordOptions[0] || null;

        // Remove from available for this game
        if (this.state.currentWord) {
            this.state.revealedWords.push(this.state.currentWord.word);
        }
    }

    /**
     * Start drawing timer
     */
    private startTimer(): void {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }

        this.timerInterval = setInterval(() => {
            this.state.drawingTime--;

            if (this.state.drawingTime <= 0) {
                this.endRound();
            }

            this.notifyListeners();
        }, 1000);
    }

    /**
     * End round
     */
    private endRound(): void {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }

        this.state.phase = 'reveal';

        // Award points to drawer based on guesses
        const drawer = this.state.players.find(p => p.id === this.state.currentDrawer);
        if (drawer) {
            const guessBonus = Math.max(0, 5 - this.state.totalGuesses);
            drawer.score += guessBonus * 10;
        }

        this.notifyListeners();

        // Show reveal for a few seconds then next round
        setTimeout(() => {
            this.state.roundNumber++;
            this.startRound();
        }, 5000);
    }

    /**
     * Submit guess
     */
    submitGuess(playerId: string, guess: string): { correct: boolean; points: number } {
        if (this.state.phase !== 'drawing') return { correct: false, points: 0 };

        const player = this.state.players.find(p => p.id === playerId);
        const drawer = this.state.players.find(p => p.id === this.state.currentDrawer);

        if (!player || player.id === this.state.currentDrawer || player.hasGuessed) {
            return { correct: false, points: 0 };
        }

        const normalizedGuess = guess.toLowerCase().trim();
        const normalizedWord = this.state.currentWord?.word.toLowerCase();

        if (normalizedGuess === normalizedWord) {
            player.hasGuessed = true;
            player.guessedCorrectly = true;

            // Calculate points based on time and guesses
            const timeBonus = Math.floor(this.state.drawingTime / 10);
            const guessOrderBonus = 10 - this.state.totalGuesses;
            const points = 100 + timeBonus + guessOrderBonus;

            player.score += points;
            drawer!.score += points / 2;

            this.state.guessedPlayers.push({
                playerId,
                guessTime: Date.now(),
                points,
            });

            this.state.totalGuesses++;
            this.state.correctGuessOrder.push(playerId);

            // Check if all players guessed
            const nonDrawers = this.state.players.filter(p => p.id !== this.state.currentDrawer && !p.hasGuessed);
            if (nonDrawers.length === 0) {
                this.endRound();
            }

            this.notifyListeners();
            return { correct: true, points };
        }

        return { correct: false, points: 0 };
    }

    /**
     * Add stroke to drawing
     */
    addStroke(stroke: Stroke): void {
        const layer = this.state.drawingLayers.find(l => l.id === this.state.currentLayerId);
        if (layer && !layer.locked) {
            layer.strokes.push(stroke);
            this.notifyListeners();
        }
    }

    /**
     * Undo last stroke
     */
    undoStroke(): void {
        const layer = this.state.drawingLayers.find(l => l.id === this.state.currentLayerId);
        if (layer && layer.strokes.length > 0) {
            layer.strokes.pop();
            this.notifyListeners();
        }
    }

    /**
     * Clear current layer
     */
    clearLayer(): void {
        const layer = this.state.drawingLayers.find(l => l.id === this.state.currentLayerId);
        if (layer && !layer.locked) {
            layer.strokes = [];
            this.notifyListeners();
        }
    }

    /**
     * Update brush settings
     */
    updateBrushSettings(settings: Partial<BrushSettings>): void {
        this.state.brushSettings = { ...this.state.brushSettings, ...settings };
        this.notifyListeners();
    }

    /**
     * Create new layer
     */
    createLayer(name?: string): void {
        const layerId = `layer-${Date.now()}`;
        const layerNumber = this.state.drawingLayers.length + 1;

        this.state.drawingLayers.push({
            id: layerId,
            name: name || `Layer ${layerNumber}`,
            strokes: [],
            visible: true,
            opacity: 1,
            locked: false,
        });

        this.state.currentLayerId = layerId;
        this.notifyListeners();
    }

    /**
     * Switch to layer
     */
    switchToLayer(layerId: string): void {
        if (this.state.drawingLayers.some(l => l.id === layerId)) {
            this.state.currentLayerId = layerId;
            this.notifyListeners();
        }
    }

    /**
     * Toggle layer visibility
     */
    toggleLayerVisibility(layerId: string): void {
        const layer = this.state.drawingLayers.find(l => l.id === layerId);
        if (layer) {
            layer.visible = !layer.visible;
            this.notifyListeners();
        }
    }

    /**
     * Delete layer
     */
    deleteLayer(layerId: string): void {
        if (this.state.drawingLayers.length > 1) {
            const index = this.state.drawingLayers.findIndex(l => l.id === layerId);
            if (index !== -1) {
                this.state.drawingLayers.splice(index, 1);
                if (this.state.currentLayerId === layerId) {
                    this.state.currentLayerId = this.state.drawingLayers[0]?.id || '';
                }
                this.notifyListeners();
            }
        }
    }

    /**
     * AI hint generation
     */
    generateAIHint(): AIGuess | null {
        if (!this.config.enableAIHints || !this.state.currentWord) return null;

        const hints = this.state.currentWord.hints;
        const revealedHint = hints[Math.floor(Math.random() * hints.length)];

        return {
            word: revealedHint,
            confidence: 0.3,
            reasoning: 'AI analysis of drawing patterns',
        };
    }

    /**
     * Get leaderboard
     */
    getLeaderboard(): Player[] {
        return [...this.state.players].sort((a, b) => b.score - a.score);
    }

    /**
     * Export drawing as JSON
     */
    exportDrawing(): string {
        return JSON.stringify({
            layers: this.state.drawingLayers,
            brushSettings: this.state.brushSettings,
            word: this.state.currentWord?.word,
            exportedAt: new Date().toISOString(),
        });
    }

    /**
     * Import drawing from JSON
     */
    importDrawing(json: string): boolean {
        try {
            const data = JSON.parse(json);
            if (data.layers) {
                this.state.drawingLayers = data.layers;
                if (data.brushSettings) {
                    this.state.brushSettings = data.brushSettings;
                }
                this.notifyListeners();
                return true;
            }
            return false;
        } catch {
            return false;
        }
    }

    /**
     * Subscribe to state changes
     */
    subscribe(listener: (state: PictionaryGameState) => void): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    /**
     * Notify all listeners
     */
    private notifyListeners(): void {
        this.listeners.forEach(listener => listener(this.state));
    }

    /**
     * Reset game
     */
    reset(): void {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.state = this.getInitialState();
        this.notifyListeners();
    }

    /**
     * Get final scores
     */
    getFinalScores(): { player: string; score: number; rank: number }[] {
        const sorted = this.getLeaderboard();
        return sorted.map((p, index) => ({
            player: p.name,
            score: p.score,
            rank: index + 1,
        }));
    }
}

export const pictionaryGame = PictionaryGame.getInstance();
export type { PictionaryGameState, PictionaryWord, Player, BrushSettings, Stroke, DrawingLayer, GameConfig, GamePhase, GuessedPlayer, AIGuess };
