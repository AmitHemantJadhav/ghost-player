"""Shared game state for the Ghost Player session.

Module-level singleton that tracks the current game: board position,
move history, difficulty setting. Both the vision tool and chess engine
tools read/write this state.

This is single-session / in-process state — fine for the hackathon.
For production, swap to Firestore-backed session storage.
"""

import threading
import time
from collections.abc import Callable
from typing import Any

import chess

# Material values used for the evaluation bar (centipawns, White-perspective).
_MATERIAL_VALUES: dict[int, int] = {
    chess.PAWN: 100,
    chess.KNIGHT: 320,
    chess.BISHOP: 330,
    chess.ROOK: 500,
    chess.QUEEN: 900,
    chess.KING: 0,
}


def _compute_white_advantage(fen: str) -> int:
    """Return material balance in centipawns from White's perspective.

    Positive = White ahead, negative = Black (Ghost) ahead. Pure material
    count — no mobility term, so the bar stays stable between moves.
    """
    try:
        board = chess.Board(fen)
    except ValueError:
        return 0
    score = 0
    for pt, val in _MATERIAL_VALUES.items():
        score += len(board.pieces(pt, chess.WHITE)) * val
        score -= len(board.pieces(pt, chess.BLACK)) * val
    return score


# ---------------------------------------------------------------------------
# Broadcast callback — server.py registers this to push state via WebSocket
# ---------------------------------------------------------------------------
_broadcast_callback: Callable[[dict], Any] | None = None


def register_broadcast(cb: Callable[[dict], Any]) -> None:
    """Register a callback that receives game-state snapshots on every change."""
    global _broadcast_callback
    _broadcast_callback = cb


def _notify() -> None:
    """Fire the broadcast callback with the current snapshot (best-effort)."""
    if _broadcast_callback:
        try:
            _broadcast_callback(_state.snapshot())
        except Exception:
            pass


class GameState:
    """Mutable game state for one chess session."""

    def __init__(self) -> None:
        self.current_fen: str = chess.STARTING_FEN
        self.move_history: list[dict] = []
        self.difficulty: str = "medium"
        self.started: bool = False
        self.evaluation_score: int = 0  # centipawns, positive = White ahead
        self.coach_mode: bool = False

    def reset(self) -> None:
        """Clear all state for a new game."""
        self.current_fen = chess.STARTING_FEN
        self.move_history.clear()
        self.difficulty = "medium"
        self.started = False
        self.evaluation_score = 0
        self.coach_mode = False

    def record_move(self, fen_before: str, move_uci: str) -> dict:
        """Validate, apply, and record a move.

        Args:
            fen_before: FEN of the position before the move.
            move_uci: The move in UCI format (e.g. 'e2e4').

        Returns:
            Dict with move details and the new FEN, or an error dict.
        """
        try:
            board = chess.Board(fen_before)
        except ValueError:
            return {"error": f"Invalid FEN: {fen_before}"}

        try:
            move = chess.Move.from_uci(move_uci)
        except ValueError:
            return {"error": f"Invalid UCI move: {move_uci}"}

        if move not in board.legal_moves:
            return {"error": f"Illegal move {move_uci} in position {fen_before}"}

        san = board.san(move)
        side = "white" if board.turn == chess.WHITE else "black"
        move_number = board.fullmove_number

        board.push(move)
        fen_after = board.fen()

        entry = {
            "move_number": move_number,
            "side": side,
            "move_san": san,
            "move_uci": move_uci,
            "fen_after": fen_after,
        }
        self.move_history.append(entry)
        self.current_fen = fen_after
        self.started = True
        self.evaluation_score = _compute_white_advantage(fen_after)

        return entry

    def snapshot(self) -> dict:
        """Return a JSON-serializable snapshot of the current state."""
        board = chess.Board(self.current_fen)
        result = {
            "current_fen": self.current_fen,
            "move_history": list(self.move_history),
            "difficulty": self.difficulty,
            "started": self.started,
            "total_moves": len(self.move_history),
            "is_game_over": board.is_game_over(),
            "is_checkmate": board.is_checkmate(),
            "is_stalemate": board.is_stalemate(),
            "is_check": board.is_check(),
            "winner": None,
            "evaluation_score": self.evaluation_score,
            "coach_mode": self.coach_mode,
        }
        if board.is_checkmate():
            result["winner"] = "black" if board.turn == chess.WHITE else "white"
        return result


# Module-level singleton
_state = GameState()


def reset_game() -> dict:
    """Reset the game to the starting position for a new game.

    Call this when the player wants to start a fresh game. Clears all
    move history and resets the board to the standard starting position.

    Returns:
        Confirmation with the starting FEN.
    """
    _state.reset()
    _notify()
    return {
        "status": "reset",
        "fen": _state.current_fen,
        "message": "Game reset to starting position. White to move.",
    }


def record_move(fen_before: str, move_uci: str) -> dict:
    """Record a move in the shared game state.

    Not an ADK tool — called internally by other tools.
    """
    result = _state.record_move(fen_before, move_uci)
    if "error" not in result:
        _notify()
    return result


def get_state() -> dict:
    """Return a snapshot of the current game state.

    Not an ADK tool — called internally by other tools.
    """
    return _state.snapshot()


def set_difficulty(level: str) -> dict:
    """Change the AI difficulty level mid-game.

    Call this when the player asks to change the difficulty. Valid levels
    are 'easy', 'medium', and 'hard'.

    - easy: random legal moves — great for beginners or casual play.
    - medium: solid play with moderate search depth — a fair challenge.
    - hard: deeper search for strong play — watch out!

    Args:
        level: One of 'easy', 'medium', or 'hard'.

    Returns:
        Confirmation of the new difficulty setting.
    """
    level = level.lower().strip()
    if level not in ("easy", "medium", "hard"):
        return {"error": f"Invalid difficulty '{level}'. Choose 'easy', 'medium', or 'hard'."}

    old = _state.difficulty
    _state.difficulty = level
    return {
        "previous": old,
        "current": level,
        "message": f"Difficulty changed from {old} to {level}.",
    }


def get_difficulty() -> str:
    """Return the current difficulty setting. Internal helper."""
    return _state.difficulty


def toggle_coach_mode() -> dict:
    """Toggle coach mode on or off.

    Call this when the player asks to be coached, taught, or wants
    explanations of moves. Call again when they want to stop.

    When coach mode is ON you should:
    - After each of the player's moves: confirm the move, briefly evaluate
      it, and name one idea or threat that follows.
    - After each of your own moves: explain in one sentence why you played it.

    Returns:
        The new coach_mode state and a confirmation message.
    """
    _state.coach_mode = not _state.coach_mode
    _notify()
    return {
        "coach_mode": _state.coach_mode,
        "message": (
            "Coach mode activated. I'll explain every move."
            if _state.coach_mode
            else "Coach mode deactivated. Back to normal play."
        ),
    }


def get_coach_mode() -> bool:
    """Return whether coach mode is currently active. Internal helper."""
    return _state.coach_mode


def set_evaluation(score: int) -> None:
    """Store the current material evaluation (centipawns, positive = White ahead).

    Not an ADK tool — called internally by chess_engine after each move.
    Triggers a broadcast so the frontend bar updates in real time.
    """
    _state.evaluation_score = score
    _notify()


def get_current_fen() -> str:
    """Return the current FEN from game state. Internal helper."""
    return _state.current_fen


# ---------------------------------------------------------------------------
# Shared frame buffer — video frames stored here by server.py, read by vision.py
# ---------------------------------------------------------------------------
_frame_lock = threading.Lock()
_latest_frame: bytes | None = None
_frame_timestamp: float = 0.0


def store_frame(frame_bytes: bytes) -> None:
    """Store the latest camera frame. Called by the server when an image blob arrives."""
    global _latest_frame, _frame_timestamp
    with _frame_lock:
        _latest_frame = frame_bytes
        _frame_timestamp = time.monotonic()


def get_latest_frame() -> tuple[bytes | None, float]:
    """Return (frame_bytes, timestamp) of the most recent camera frame."""
    with _frame_lock:
        return _latest_frame, _frame_timestamp


def clear_frame_buffer() -> None:
    """Clear the frame buffer. Called on session reset."""
    global _latest_frame, _frame_timestamp
    with _frame_lock:
        _latest_frame = None
        _frame_timestamp = 0.0
