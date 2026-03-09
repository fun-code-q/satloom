/**
 * Chess Game Engine
 * 
 * Multiplayer chess game with move validation,
 * AI opponent, and game state management.
 */

type PieceType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';
type PieceColor = 'white' | 'black';
type GameStatus = 'playing' | 'check' | 'checkmate' | 'stalemate' | 'draw';

interface Piece {
    type: PieceType;
    color: PieceColor;
    hasMoved: boolean;
}

interface Move {
    from: { row: number; col: number };
    to: { row: number; col: number };
    piece: Piece;
    captured?: Piece;
    promotion?: PieceType;
    castling?: 'kingside' | 'queenside';
    enPassant?: boolean;
}

interface GameState {
    board: (Piece | null)[][];
    currentTurn: PieceColor;
    status: GameStatus;
    winner?: PieceColor;
    moveHistory: Move[];
    capturedPieces: { white: Piece[]; black: Piece[] };
    halfMoveClock: number; // For 50-move rule
    fullMoveNumber: number;
    enPassantTarget?: { row: number; col: number };
}

interface AIDifficulty {
    name: string;
    depth: number;
    skill: number; // 0-20 for Stockfish-like skill level
}

class ChessGame {
    private static instance: ChessGame;
    private board: (Piece | null)[][] = [];
    private currentTurn: PieceColor = 'white';
    private gameStatus: GameStatus = 'playing';
    private moveHistory: Move[] = [];
    private capturedPieces = { white: [] as Piece[], black: [] as Piece[] };
    private halfMoveClock = 0;
    private fullMoveNumber = 1;
    private enPassantTarget: { row: number; col: number } | null = null;
    private aiEnabled = false;
    private aiDifficulty: AIDifficulty = { name: 'Easy', depth: 2, skill: 5 };
    private playerColor: PieceColor = 'white';
    private winner: PieceColor | null = null;

    private constructor() { }

    static getInstance(): ChessGame {
        if (!ChessGame.instance) {
            ChessGame.instance = new ChessGame();
        }
        return ChessGame.instance;
    }

    /**
     * Initialize new game
     */
    initialize(options?: { aiEnabled?: boolean; aiDifficulty?: AIDifficulty; playerColor?: PieceColor }): void {
        // Standard chess board setup
        this.board = Array(8).fill(null).map(() => Array(8).fill(null));

        // Place pawns
        for (let col = 0; col < 8; col++) {
            this.board[1][col] = { type: 'pawn', color: 'black', hasMoved: false };
            this.board[6][col] = { type: 'pawn', color: 'white', hasMoved: false };
        }

        // Place other pieces
        const pieceOrder: PieceType[] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
        for (let col = 0; col < 8; col++) {
            this.board[0][col] = { type: pieceOrder[col], color: 'black', hasMoved: false };
            this.board[7][col] = { type: pieceOrder[col], color: 'white', hasMoved: false };
        }

        this.currentTurn = 'white';
        this.gameStatus = 'playing';
        this.moveHistory = [];
        this.capturedPieces = { white: [], black: [] };
        this.halfMoveClock = 0;
        this.fullMoveNumber = 1;
        this.enPassantTarget = null;

        if (options) {
            this.aiEnabled = options.aiEnabled || false;
            this.aiDifficulty = options.aiDifficulty || this.aiDifficulty;
            this.playerColor = options.playerColor || 'white';
        }
    }

    /**
     * Get current game state
     */
    getGameState(): GameState {
        return {
            board: this.board.map(row => row.map(piece => piece ? { ...piece } : null)),
            currentTurn: this.currentTurn,
            status: this.gameStatus,
            moveHistory: [...this.moveHistory],
            capturedPieces: { ...this.capturedPieces },
            halfMoveClock: this.halfMoveClock,
            fullMoveNumber: this.fullMoveNumber,
            enPassantTarget: this.enPassantTarget || undefined,
        };
    }

    /**
     * Get valid moves for a piece
     */
    getValidMoves(row: number, col: number): { row: number; col: number }[] {
        const piece = this.board[row][col];
        if (!piece) return [];

        let moves: { row: number; col: number }[] = [];

        switch (piece.type) {
            case 'pawn':
                moves = this.getPawnMoves(row, col, piece);
                break;
            case 'rook':
                moves = this.getRookMoves(row, col, piece);
                break;
            case 'knight':
                moves = this.getKnightMoves(row, col, piece);
                break;
            case 'bishop':
                moves = this.getBishopMoves(row, col, piece);
                break;
            case 'queen':
                moves = this.getQueenMoves(row, col, piece);
                break;
            case 'king':
                moves = this.getKingMoves(row, col, piece);
                break;
        }

        // Filter out moves that would leave king in check
        return moves.filter(move => {
            const tempBoard = this.simulateMove(row, col, move.row, move.col);
            return !this.isInCheck(tempBoard, piece.color);
        });
    }

    /**
     * Make a move
     */
    makeMove(from: { row: number; col: number }, to: { row: number; col: number }, promotion?: PieceType): boolean {
        const piece = this.board[from.row][from.col];
        if (!piece) return false;

        if (piece.color !== this.currentTurn) return false;

        const validMoves = this.getValidMoves(from.row, from.col);
        const isValid = validMoves.some(m => m.row === to.row && m.col === to.col);

        if (!isValid) return false;

        // Check for capture
        const capturedPiece = this.board[to.row][to.col];
        if (capturedPiece) {
            this.capturedPieces[piece.color].push(capturedPiece);
        }

        // Handle en passant
        if (piece.type === 'pawn') {
            if (this.enPassantTarget && to.row === this.enPassantTarget.row && to.col === this.enPassantTarget.col) {
                const captureRow = piece.color === 'white' ? to.row + 1 : to.row - 1;
                const capturedPawn = this.board[captureRow][to.col];
                if (capturedPawn) {
                    this.capturedPieces[piece.color].push(capturedPawn);
                    this.board[captureRow][to.col] = null;
                }
            }
        }

        // Make the move
        const move: Move = {
            from: { ...from },
            to: { ...to },
            piece: { ...piece, hasMoved: true },
            captured: capturedPiece || undefined,
        };

        this.board[to.row][to.col] = piece;
        this.board[from.row][from.col] = null;

        // Handle promotion
        if (piece.type === 'pawn') {
            if ((piece.color === 'white' && to.row === 0) || (piece.color === 'black' && to.row === 7)) {
                const promotionPiece = promotion || 'queen';
                this.board[to.row][to.col] = { type: promotionPiece, color: piece.color, hasMoved: true };
                move.promotion = promotionPiece;
            }
        }

        // Handle castling
        if (piece.type === 'king' && Math.abs(to.col - from.col) === 2) {
            if (to.col > from.col) {
                // Kingside
                const rook = this.board[to.row][7];
                if (rook) {
                    this.board[to.row][5] = rook;
                    this.board[to.row][7] = null;
                    move.castling = 'kingside';
                }
            } else {
                // Queenside
                const rook = this.board[to.row][0];
                if (rook) {
                    this.board[to.row][3] = rook;
                    this.board[to.row][0] = null;
                    move.castling = 'queenside';
                }
            }
        }

        this.moveHistory.push(move);

        // Update en passant target
        if (piece.type === 'pawn' && Math.abs(to.row - from.row) === 2) {
            this.enPassantTarget = {
                row: (from.row + to.row) / 2,
                col: from.col,
            };
        } else {
            this.enPassantTarget = null;
        }

        // Update clocks
        if (capturedPiece || piece.type === 'pawn') {
            this.halfMoveClock = 0;
        } else {
            this.halfMoveClock++;
        }

        if (this.currentTurn === 'black') {
            this.fullMoveNumber++;
        }

        // Switch turns
        this.currentTurn = this.currentTurn === 'white' ? 'black' : 'white';

        // Check game status
        this.updateGameStatus();

        // AI move if enabled
        if (this.aiEnabled && this.gameStatus === 'playing' && this.currentTurn !== this.playerColor) {
            setTimeout(() => this.makeAIMove(), 500);
        }

        return true;
    }

    /**
     * Get pawn moves
     */
    private getPawnMoves(row: number, col: number, piece: Piece): { row: number; col: number }[] {
        const moves: { row: number; col: number }[] = [];
        const direction = piece.color === 'white' ? -1 : 1;
        const startRow = piece.color === 'white' ? 6 : 1;

        // Forward move
        const forwardRow = row + direction;
        if (this.isValidPosition(forwardRow, col) && !this.board[forwardRow][col]) {
            moves.push({ row: forwardRow, col });

            // Double move from start
            if (row === startRow) {
                const doubleRow = row + 2 * direction;
                if (this.isValidPosition(doubleRow, col) && !this.board[doubleRow][col]) {
                    moves.push({ row: doubleRow, col });
                }
            }
        }

        // Captures
        for (const dc of [-1, 1]) {
            const captureCol = col + dc;
            const captureRow = row + direction;
            if (this.isValidPosition(captureRow, captureCol)) {
                const target = this.board[captureRow][captureCol];
                if (target && target.color !== piece.color) {
                    moves.push({ row: captureRow, col: captureCol });
                }
                // En passant
                if (this.enPassantTarget && captureRow === this.enPassantTarget.row && captureCol === this.enPassantTarget.col) {
                    moves.push({ row: captureRow, col: captureCol });
                }
            }
        }

        return moves;
    }

    /**
     * Get squares a pawn is attacking (for check detection)
     */
    private getPawnAttacks(row: number, col: number, piece: Piece): { row: number; col: number }[] {
        const attacks: { row: number; col: number }[] = [];
        const direction = piece.color === 'white' ? -1 : 1;

        for (const dc of [-1, 1]) {
            const captureCol = col + dc;
            const captureRow = row + direction;
            if (this.isValidPosition(captureRow, captureCol)) {
                attacks.push({ row: captureRow, col: captureCol });
            }
        }
        return attacks;
    }

    /**
     * Get rook moves
     */
    private getRookMoves(row: number, col: number, piece: Piece, board: (Piece | null)[][] = this.board): { row: number; col: number }[] {
        return this.getSlidingMoves(row, col, piece, [[0, 1], [0, -1], [1, 0], [-1, 0]], board);
    }

    /**
     * Get knight moves
     */
    private getKnightMoves(row: number, col: number, piece: Piece, board: (Piece | null)[][] = this.board): { row: number; col: number }[] {
        const moves: { row: number; col: number }[] = [];
        const offsets = [
            [-2, -1], [-2, 1], [-1, -2], [-1, 2],
            [1, -2], [1, 2], [2, -1], [2, 1],
        ];

        for (const [dr, dc] of offsets) {
            const newRow = row + dr;
            const newCol = col + dc;
            if (this.isValidPosition(newRow, newCol)) {
                const target = board[newRow][newCol];
                if (!target || target.color !== piece.color) {
                    moves.push({ row: newRow, col: newCol });
                }
            }
        }

        return moves;
    }

    /**
     * Get bishop moves
     */
    private getBishopMoves(row: number, col: number, piece: Piece, board: (Piece | null)[][] = this.board): { row: number; col: number }[] {
        return this.getSlidingMoves(row, col, piece, [[1, 1], [1, -1], [-1, 1], [-1, -1]], board);
    }

    /**
     * Get queen moves
     */
    private getQueenMoves(row: number, col: number, piece: Piece, board: (Piece | null)[][] = this.board): { row: number; col: number }[] {
        return [
            ...this.getRookMoves(row, col, piece, board),
            ...this.getBishopMoves(row, col, piece, board),
        ];
    }

    /**
     * Get king moves
     */
    private getKingMoves(row: number, col: number, piece: Piece, board: (Piece | null)[][] = this.board, includeCastling = true): { row: number; col: number }[] {
        const moves: { row: number; col: number }[] = [];
        const offsets = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1], [0, 1],
            [1, -1], [1, 0], [1, 1],
        ];

        for (const [dr, dc] of offsets) {
            const newRow = row + dr;
            const newCol = col + dc;
            if (this.isValidPosition(newRow, newCol)) {
                const target = board[newRow][newCol];
                if (!target || target.color !== piece.color) {
                    moves.push({ row: newRow, col: newCol });
                }
            }
        }

        // Castling (only on the real board, not during simulations or check detection)
        if (includeCastling && board === this.board && !piece.hasMoved && !this.isInCheck(board, piece.color)) {
            // Kingside
            if (this.canCastle(row, col, 'kingside')) {
                moves.push({ row, col: col + 2 });
            }
            // Queenside
            if (this.canCastle(row, col, 'queenside')) {
                moves.push({ row, col: col - 2 });
            }
        }

        return moves;
    }

    /**
     * Get sliding moves (rook, bishop, queen)
     */
    private getSlidingMoves(
        row: number,
        col: number,
        piece: Piece,
        directions: number[][],
        board: (Piece | null)[][] = this.board
    ): { row: number; col: number }[] {
        const moves: { row: number; col: number }[] = [];

        for (const [dr, dc] of directions) {
            let newRow = row + dr;
            let newCol = col + dc;

            while (this.isValidPosition(newRow, newCol)) {
                const target = board[newRow][newCol];
                if (!target) {
                    moves.push({ row: newRow, col: newCol });
                } else if (target.color !== piece.color) {
                    moves.push({ row: newRow, col: newCol });
                    break;
                } else {
                    break;
                }
                newRow += dr;
                newCol += dc;
            }
        }

        return moves;
    }

    /**
     * Check if castling is possible
     */
    private canCastle(row: number, col: number, side: 'kingside' | 'queenside'): boolean {
        const piece = this.board[row][col];
        if (!piece || piece.type !== 'king' || piece.hasMoved) return false;

        if (this.isInCheck(this.board, piece.color)) return false;

        const direction = side === 'kingside' ? 1 : -1;
        const rookCol = side === 'kingside' ? 7 : 0;
        const rook = this.board[row][rookCol];

        if (!rook || rook.type !== 'rook' || rook.hasMoved) return false;

        // Check if path is clear
        const startCol = Math.min(col, rookCol) + 1;
        const endCol = Math.max(col, rookCol) - 1;
        for (let c = startCol; c <= endCol; c++) {
            if (this.board[row][c]) return false;
        }

        // Check if king passes through check
        for (let c = col + direction; c !== rookCol + direction; c += direction) {
            const tempBoard = this.board.map(row => row.map(p => p ? { ...p } : null));
            tempBoard[row][c] = { ...piece, hasMoved: true };
            tempBoard[row][col] = null;
            if (this.isInCheck(tempBoard, piece.color)) return false;
        }

        return true;
    }

    /**
     * Check if position is valid
     */
    private isValidPosition(row: number, col: number): boolean {
        return row >= 0 && row < 8 && col >= 0 && col < 8;
    }

    /**
     * Check if king is in check
     */
    private isInCheck(board: (Piece | null)[][], color: PieceColor): boolean {
        // Find king position
        let kingRow = -1, kingCol = -1;

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = board[row][col];
                if (piece && piece.type === 'king' && piece.color === color) {
                    kingRow = row;
                    kingCol = col;
                    break;
                }
            }
            if (kingRow !== -1) break;
        }

        if (kingRow === -1) return true; // King captured (shouldn't happen)

        // Check if any opponent piece can attack king position
        const opponentColor = color === 'white' ? 'black' : 'white';

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = board[row][col];
                if (piece && piece.color === opponentColor) {
                    // Check if this piece can attack king position
                    const moves = this.getMovesForPiece(board, row, col, piece);
                    if (moves.some(m => m.row === kingRow && m.col === kingCol)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    /**
     * Get moves for a piece (used for check detection)
     */
    private getMovesForPiece(board: (Piece | null)[][], row: number, col: number, piece: Piece): { row: number; col: number }[] {
        switch (piece.type) {
            case 'pawn':
                return this.getPawnAttacks(row, col, piece);
            case 'rook':
                return this.getRookMoves(row, col, piece, board);
            case 'knight':
                return this.getKnightMoves(row, col, piece, board);
            case 'bishop':
                return this.getBishopMoves(row, col, piece, board);
            case 'queen':
                return this.getQueenMoves(row, col, piece, board);
            case 'king':
                return this.getKingMoves(row, col, piece, board, false);
            default:
                return [];
        }
    }

    /**
     * Simulate a move
     */
    private simulateMove(fromRow: number, fromCol: number, toRow: number, toCol: number): (Piece | null)[][] {
        const newBoard = this.board.map(row => row.map(p => p ? { ...p } : null));
        const piece = newBoard[fromRow][fromCol];
        if (piece) {
            newBoard[toRow][toCol] = piece;
            newBoard[fromRow][fromCol] = null;
        }
        return newBoard;
    }

    /**
     * Update game status
     */
    private updateGameStatus(): void {
        // Check for checkmate or stalemate
        let hasValidMoves = false;

        for (let row = 0; row < 8 && !hasValidMoves; row++) {
            for (let col = 0; col < 8 && !hasValidMoves; col++) {
                const piece = this.board[row][col];
                if (piece && piece.color === this.currentTurn) {
                    const moves = this.getValidMoves(row, col);
                    if (moves.length > 0) {
                        hasValidMoves = true;
                    }
                }
            }
        }

        if (this.isInCheck(this.board, this.currentTurn)) {
            if (!hasValidMoves) {
                this.gameStatus = 'checkmate';
                this.winner = this.currentTurn === 'white' ? 'black' : 'white';
            } else {
                this.gameStatus = 'check';
            }
        } else {
            if (!hasValidMoves) {
                this.gameStatus = 'stalemate';
            } else if (this.halfMoveClock >= 100) { // 50-move rule
                this.gameStatus = 'draw';
            } else {
                this.gameStatus = 'playing';
            }
        }
    }

    /**
     * Make AI move
     */
    public async makeAIMove(): Promise<void> {
        // Simple AI: Random valid move (can be enhanced with minimax/Stockfish)
        const validMoves: { from: { row: number; col: number }; to: { row: number; col: number } }[] = [];

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece && piece.color === this.currentTurn) {
                    const moves = this.getValidMoves(row, col);
                    for (const move of moves) {
                        validMoves.push({ from: { row, col }, to: move });
                    }
                }
            }
        }

        if (validMoves.length > 0) {
            // Simple evaluation: prefer captures and checks
            let bestMove = validMoves[0];
            let bestScore = -Infinity;

            for (const move of validMoves) {
                let score = Math.random() * 10; // Random base

                // Prefer captures
                const captured = this.board[move.to.row][move.to.col];
                if (captured) {
                    const pieceValues = { pawn: 10, knight: 30, bishop: 30, rook: 50, queen: 90, king: 900 };
                    score += pieceValues[captured.type] || 0;
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestMove = move;
                }
            }

            this.makeMove(bestMove.from, bestMove.to);
        }
    }

    /**
     * Undo last move
     */
    undoMove(): boolean {
        if (this.moveHistory.length === 0) return false;

        const lastMove = this.moveHistory.pop();
        if (!lastMove) return false;

        // Move piece back
        this.board[lastMove.from.row][lastMove.from.col] = lastMove.piece;
        this.board[lastMove.to.row][lastMove.to.col] = lastMove.captured || null;

        // Restore captured piece
        if (lastMove.captured) {
            const color = lastMove.captured.color;
            const capturedList = color === 'white' ? this.capturedPieces.white : this.capturedPieces.black;
            const index = capturedList.indexOf(lastMove.captured);
            if (index > -1) {
                capturedList.splice(index, 1);
            }
        }

        // Undo castling
        if (lastMove.castling) {
            const row = lastMove.to.row;
            const rookCol = lastMove.castling === 'kingside' ? 5 : 3;
            const originalRookCol = lastMove.castling === 'kingside' ? 7 : 0;
            this.board[row][originalRookCol] = this.board[row][rookCol];
            this.board[row][rookCol] = null;
        }

        // Switch turn back
        this.currentTurn = this.currentTurn === 'white' ? 'black' : 'white';
        this.gameStatus = 'playing';

        return true;
    }

    /**
     * Get FEN notation
     */
    getFEN(): string {
        let fen = '';

        for (let row = 0; row < 8; row++) {
            let emptyCount = 0;
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (!piece) {
                    emptyCount++;
                } else {
                    if (emptyCount > 0) {
                        fen += emptyCount;
                        emptyCount = 0;
                    }
                    const pieceChar = piece.type === 'knight' ? 'n' : piece.type[0];
                    fen += piece.color === 'white' ? pieceChar.toUpperCase() : pieceChar;
                }
            }
            if (emptyCount > 0) {
                fen += emptyCount;
            }
            if (row < 7) fen += '/';
        }

        fen += ` ${this.currentTurn[0]} `;

        // Castling rights
        let castling = '';
        const whiteKing = this.board[7][4];
        if (whiteKing && whiteKing.type === 'king' && !whiteKing.hasMoved) {
            const h1Rook = this.board[7][7];
            if (h1Rook && h1Rook.type === 'rook' && !h1Rook.hasMoved) castling += 'K';
            const a1Rook = this.board[7][0];
            if (a1Rook && a1Rook.type === 'rook' && !a1Rook.hasMoved) castling += 'Q';
        }
        const blackKing = this.board[0][4];
        if (blackKing && blackKing.type === 'king' && !blackKing.hasMoved) {
            const h8Rook = this.board[0][7];
            if (h8Rook && h8Rook.type === 'rook' && !h8Rook.hasMoved) castling += 'k';
            const a8Rook = this.board[0][0];
            if (a8Rook && a8Rook.type === 'rook' && !a8Rook.hasMoved) castling += 'q';
        }
        fen += castling || '-';
        fen += ' ';

        // En passant
        if (this.enPassantTarget) {
            const files = 'abcdefgh';
            fen += files[this.enPassantTarget.col] + (8 - this.enPassantTarget.row);
        } else {
            fen += '-';
        }

        fen += ` ${this.halfMoveClock} ${this.fullMoveNumber}`;

        return fen;
    }

    /**
     * Load game from FEN
     */
    loadFEN(fen: string): void {
        const parts = fen.split(' ');
        if (parts.length < 1) return;

        // Parse board
        const rows = parts[0].split('/');
        this.board = Array(8).fill(null).map(() => Array(8).fill(null));

        for (let row = 0; row < 8; row++) {
            if (!rows[row]) break;
            let col = 0;
            for (const char of rows[row]) {
                if (char >= '1' && char <= '8') {
                    const empty = parseInt(char);
                    col += empty;
                } else {
                    if (col >= 8) break;
                    const isWhite = char >= 'A' && char <= 'Z';
                    const charLower = char.toLowerCase();
                    const typeMap: Record<string, PieceType> = {
                        'p': 'pawn',
                        'n': 'knight',
                        'b': 'bishop',
                        'r': 'rook',
                        'q': 'queen',
                        'k': 'king'
                    };
                    const type = typeMap[charLower] || 'pawn';

                    // Infer hasMoved for castling pieces based on FEN castling rights
                    let hasMoved = true;
                    if (parts.length > 2) {
                        const castlingRights = parts[2];
                        if (type === 'king') {
                            if (isWhite && (castlingRights.includes('K') || castlingRights.includes('Q'))) hasMoved = false;
                            if (!isWhite && (castlingRights.includes('k') || castlingRights.includes('q'))) hasMoved = false;
                        } else if (type === 'rook') {
                            if (isWhite && row === 7) {
                                if (col === 0 && castlingRights.includes('Q')) hasMoved = false;
                                if (col === 7 && castlingRights.includes('K')) hasMoved = false;
                            } else if (!isWhite && row === 0) {
                                if (col === 0 && castlingRights.includes('q')) hasMoved = false;
                                if (col === 7 && castlingRights.includes('k')) hasMoved = false;
                            }
                        } else if (type === 'pawn') {
                            // Pawns haven't "moved" in a meaningful castling way, but they can move 2 squares from home
                            if (isWhite && row === 6) hasMoved = false;
                            if (!isWhite && row === 1) hasMoved = false;
                        }
                    } else {
                        // Default to false for home row pieces if no castling rights part (simple FEN)
                        if (isWhite && (row === 7 || row === 6)) hasMoved = false;
                        if (!isWhite && (row === 0 || row === 1)) hasMoved = false;
                    }

                    this.board[row][col++] = { type, color: isWhite ? 'white' : 'black', hasMoved };
                }
            }
        }

        this.currentTurn = parts.length > 1 ? (parts[1] === 'w' ? 'white' : 'black') : 'white';
        this.gameStatus = 'playing';
        this.moveHistory = [];
        this.halfMoveClock = parts.length > 4 ? parseInt(parts[4]) || 0 : 0;
        this.fullMoveNumber = parts.length > 5 ? parseInt(parts[5]) || 1 : 1;
        this.enPassantTarget = null;

        if (parts.length > 3 && parts[3] !== '-') {
            const files = 'abcdefgh';
            const col = files.indexOf(parts[3][0]);
            const row = 8 - parseInt(parts[3][1]);
            if (this.isValidPosition(row, col)) {
                this.enPassantTarget = { row, col };
            }
        }

        this.updateGameStatus();
    }
}

export const chessGame = ChessGame.getInstance();
export type { Piece, Move, GameState, PieceType, PieceColor, GameStatus, AIDifficulty };
