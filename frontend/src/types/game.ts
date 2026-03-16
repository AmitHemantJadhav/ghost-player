/** Represents a position on the board (e.g., "e4" for chess). */
export interface BoardPosition {
  /** File/column identifier (e.g., "a"-"h" for chess) */
  file: string;
  /** Rank/row identifier (e.g., 1-8 for chess) */
  rank: number;
}

/** Represents a single move in the game. */
export interface Move {
  /** Starting position */
  from: BoardPosition;
  /** Ending position */
  to: BoardPosition;
  /** Piece being moved (e.g., "pawn", "knight") */
  piece: string;
  /** Optional notation string (e.g., "e2e4", "Nf3") */
  notation: string;
  /** Whether this move captures an opponent piece */
  isCapture: boolean;
}

/** Current state of the game. */
export interface GameState {
  /** Type of game being played */
  gameType: "chess" | "connect_four" | "unknown";
  /** Current status */
  status: "waiting_for_setup" | "in_progress" | "paused" | "finished";
  /** Whose turn it is */
  currentTurn: "player" | "ghost_player";
  /** Move history */
  moveHistory: Move[];
  /** Board representation (FEN string for chess) */
  boardState: string;
  /** Winner, if the game has finished */
  winner: "player" | "ghost_player" | "draw" | null;
}

/** A message in the conversation transcript. */
export interface PlayerMessage {
  /** Who sent the message */
  sender: "player" | "ghost_player" | "system";
  /** Message content (text transcript of speech) */
  content: string;
  /** Timestamp */
  timestamp: number;
  /** Optional associated game event */
  gameEvent: "move" | "capture" | "check" | "checkmate" | "chat" | null;
}

/** A transcript entry for the live conversation log. */
export interface TranscriptEntry {
  id: string;
  sender: "player" | "ghost_player" | "system";
  content: string;
  timestamp: number;
  /** Whether the message is still being streamed (not yet finalized). */
  finished: boolean;
}

/** Game state snapshot from the backend (matches game_state.snapshot()). */
export interface ServerGameState {
  current_fen: string;
  move_history: Array<{
    move_number: number;
    side: "white" | "black";
    move_san: string;
    move_uci: string;
    fen_after: string;
  }>;
  difficulty: "easy" | "medium" | "hard";
  started: boolean;
  total_moves: number;
  is_game_over: boolean;
  is_checkmate: boolean;
  is_stalemate: boolean;
  is_check: boolean;
  winner: "white" | "black" | null;
  /** Material evaluation in centipawns. Positive = White ahead, negative = Black ahead. */
  evaluation_score: number;
  /** Whether the agent is in teaching/coaching mode. */
  coach_mode: boolean;
  /** One-line post-game insight shown in the game-over overlay. */
  post_game_insight: string;
  /** Black pieces captured by white (lowercase FEN chars, e.g. "p", "n"). */
  captured_by_white: string[];
  /** White pieces captured by black (uppercase FEN chars, e.g. "P", "N"). */
  captured_by_black: string[];
}
