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
