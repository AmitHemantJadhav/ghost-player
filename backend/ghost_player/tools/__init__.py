"""Ghost Player tools package.

Exports all ADK-compatible tools for the Ghost Player agent.
"""

from .chess_engine import (
    apply_move,
    get_game_status,
    get_legal_moves,
    get_move_history,
    suggest_move,
    validate_move,
)
from .game_state import analyze_game, reset_game, set_difficulty, toggle_coach_mode
from .openings import recognize_opening
from .vision import analyze_board, check_board_visibility

__all__ = [
    "get_game_status",
    "get_legal_moves",
    "validate_move",
    "suggest_move",
    "apply_move",
    "get_move_history",
    "set_difficulty",
    "reset_game",
    "analyze_board",
    "check_board_visibility",
    "recognize_opening",
    "toggle_coach_mode",
    "analyze_game",
]
