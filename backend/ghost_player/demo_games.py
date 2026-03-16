"""Demo game replayer for Ghost Player.

Provides pre-recorded games that can be automatically replayed
on the board for demo/recording purposes. Each move is applied
to the shared GameState with a delay so the frontend updates live.
"""

import asyncio
import logging

from .tools.game_state import record_move, reset_game

logger = logging.getLogger(__name__)

# Sequences of UCI moves for demo games.
# These are real, legal game sequences.
DEMO_GAMES: dict[str, dict] = {
    "fools_mate": {
        "name": "Fool's Mate",
        "description": "The fastest possible checkmate — 4 moves",
        "moves": ["f2f3", "e7e5", "g2g4", "d8h4"],
    },
    "scholars_mate": {
        "name": "Scholar's Mate",
        "description": "Classic 4-move trap targeting f7",
        "moves": ["e2e4", "e7e5", "f1c4", "b8c6", "d1h5", "g8f6", "h5f7"],
    },
    "opera_game": {
        "name": "The Opera Game (Morphy, 1858)",
        "description": "Paul Morphy's brilliant 17-move masterpiece",
        "moves": [
            "e2e4", "e7e5",
            "g1f3", "d7d6",
            "d2d4", "c8g4",
            "d4e5", "g4f3",
            "d1f3", "d6e5",
            "f1c4", "g8f6",
            "f3b3", "d8e7",
            "b1c3", "c7c6",
            "c1g5", "b7b5",
            "c3b5", "c6b5",
            "c4b5", "b8d7",
            "e1c1", "a8d8",
            "d1d7", "d8d7",
            "h1d1", "e7e6",
            "b5d7", "f6d7",
            "b3b8", "d7b8",
            "d1d8",
        ],
    },
}


async def replay_game(game_id: str, delay: float = 2.5) -> None:
    """Replay a demo game by applying moves to GameState one at a time.

    Each move triggers a WebSocket broadcast so the frontend updates live.
    Resets the game before starting.

    Args:
        game_id: Key into DEMO_GAMES.
        delay: Seconds between moves.
    """
    if game_id not in DEMO_GAMES:
        logger.error("Unknown demo game: %s", game_id)
        return

    game = DEMO_GAMES[game_id]
    moves = game["moves"]

    logger.info("Starting demo replay: %s (%d moves)", game["name"], len(moves))
    reset_game()
    await asyncio.sleep(1.0)

    import chess
    current_fen = chess.STARTING_FEN

    for i, uci in enumerate(moves):
        await asyncio.sleep(delay)
        result = record_move(current_fen, uci)
        if "error" in result:
            logger.error("Demo move %d (%s) failed: %s", i + 1, uci, result["error"])
            break
        current_fen = result["fen_after"]
        logger.info("Demo move %d/%d: %s (%s)", i + 1, len(moves), result["move_san"], uci)

    logger.info("Demo replay complete: %s", game["name"])
