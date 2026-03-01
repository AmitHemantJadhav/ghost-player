"""Shared game state for the Ghost Player session.

Module-level singleton that tracks the current game: board position,
move history, difficulty setting. Both the vision tool and chess engine
tools read/write this state.

This is single-session / in-process state — fine for the hackathon.
For production, swap to Firestore-backed session storage.
"""

import threading
import time

import chess


class GameState:
    """Mutable game state for one chess session."""

    def __init__(self) -> None:
        self.current_fen: str = chess.STARTING_FEN
        self.move_history: list[dict] = []
        self.difficulty: str = "medium"
        self.started: bool = False

    def reset(self) -> None:
        """Clear all state for a new game."""
        self.current_fen = chess.STARTING_FEN
        self.move_history.clear()
        self.difficulty = "medium"
        self.started = False

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

        return entry

    def snapshot(self) -> dict:
        """Return a JSON-serializable snapshot of the current state."""
        return {
            "current_fen": self.current_fen,
            "move_history": list(self.move_history),
            "difficulty": self.difficulty,
            "started": self.started,
            "total_moves": len(self.move_history),
        }


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
    return {
        "status": "reset",
        "fen": _state.current_fen,
        "message": "Game reset to starting position. White to move.",
    }


def record_move(fen_before: str, move_uci: str) -> dict:
    """Record a move in the shared game state.

    Not an ADK tool — called internally by other tools.
    """
    return _state.record_move(fen_before, move_uci)


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
