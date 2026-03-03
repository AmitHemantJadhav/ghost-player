"""Chess engine tools using python-chess.

These are ADK tools — each function's docstring is used by the LLM to decide
when and how to call it. Keep docstrings clear and descriptive.
"""

import random

import chess

from . import game_state


def get_game_status(fen: str) -> dict:
    """Get the current status of a chess game from a FEN string.

    Use this tool to check the state of the game: whose turn it is,
    whether the game is over (checkmate, stalemate, draw), and if
    either side is in check.

    Args:
        fen: A FEN string representing the current board position.

    Returns:
        A dictionary with game status information including turn,
        check/checkmate/stalemate/draw flags, and a human-readable summary.
    """
    try:
        board = chess.Board(fen)
    except ValueError:
        return {"error": f"Invalid FEN string: {fen}"}

    turn = "white" if board.turn == chess.WHITE else "black"

    status: dict = {
        "fen": board.fen(),
        "turn": turn,
        "is_check": board.is_check(),
        "is_checkmate": board.is_checkmate(),
        "is_stalemate": board.is_stalemate(),
        "is_insufficient_material": board.is_insufficient_material(),
        "is_fifty_moves": board.can_claim_fifty_moves(),
        "is_threefold_repetition": board.can_claim_threefold_repetition(),
        "is_game_over": board.is_game_over(),
        "fullmove_number": board.fullmove_number,
        "coach_mode": game_state.get_coach_mode(),
    }

    # Human-readable summary
    if board.is_checkmate():
        winner = "black" if board.turn == chess.WHITE else "white"
        status["summary"] = f"Checkmate! {winner.title()} wins."
    elif board.is_stalemate():
        status["summary"] = "Stalemate — the game is a draw."
    elif board.is_insufficient_material():
        status["summary"] = "Draw by insufficient material."
    elif board.is_game_over():
        status["summary"] = "The game is over (draw)."
    elif board.is_check():
        status["summary"] = f"It's {turn}'s turn. {turn.title()} is in check!"
    else:
        status["summary"] = f"It's {turn}'s turn to move."

    return status


def get_legal_moves(fen: str) -> dict:
    """Get all legal moves in the current position.

    Use this tool when you need to know what moves are available.
    Returns moves in both UCI format (e.g., e2e4) and SAN format (e.g., e4).

    Args:
        fen: A FEN string representing the current board position.

    Returns:
        A dictionary with the list of legal moves in UCI and SAN formats,
        and the total count.
    """
    try:
        board = chess.Board(fen)
    except ValueError:
        return {"error": f"Invalid FEN string: {fen}"}

    moves = []
    for move in board.legal_moves:
        moves.append({
            "uci": move.uci(),
            "san": board.san(move),
        })

    turn = "white" if board.turn == chess.WHITE else "black"
    return {
        "fen": fen,
        "turn": turn,
        "moves": moves,
        "count": len(moves),
    }


def validate_move(fen: str, move_uci: str) -> dict:
    """Check if a specific move is legal in the current position.

    Use this tool to verify a move before announcing it. The move should
    be in UCI format (e.g., 'e2e4', 'g1f3', 'e7e8q' for promotion).

    Args:
        fen: A FEN string representing the current board position.
        move_uci: The move to validate in UCI format.

    Returns:
        A dictionary indicating whether the move is legal, and the
        resulting FEN if it is.
    """
    try:
        board = chess.Board(fen)
    except ValueError:
        return {"error": f"Invalid FEN string: {fen}"}

    try:
        move = chess.Move.from_uci(move_uci)
    except ValueError:
        return {
            "legal": False,
            "reason": f"'{move_uci}' is not a valid UCI move format.",
        }

    if move not in board.legal_moves:
        return {
            "legal": False,
            "reason": f"'{move_uci}' ({board.san(move) if board.is_legal(move) else move_uci}) is not a legal move in this position.",
        }

    san = board.san(move)
    board.push(move)
    return {
        "legal": True,
        "move_uci": move_uci,
        "move_san": san,
        "resulting_fen": board.fen(),
    }


def suggest_move(fen: str, difficulty: str = "") -> dict:
    """Compute the AI's next move for the given position.

    Use this tool when it's your turn (Black) and you need to decide
    what move to play. The difficulty level is read from the game settings
    unless you override it here:
    - 'easy': picks a random legal move
    - 'medium': evaluates material balance, picks a good move (depth 2)
    - 'hard': deeper search for strong play (depth 3)

    Args:
        fen: A FEN string representing the current board position.
        difficulty: One of 'easy', 'medium', or 'hard'. Leave empty to
                    use the current game difficulty setting.

    Returns:
        A dictionary with the chosen move in UCI and SAN formats,
        the resulting FEN, and a brief evaluation.
    """
    if not difficulty:
        difficulty = game_state.get_difficulty()

    try:
        board = chess.Board(fen)
    except ValueError:
        return {"error": f"Invalid FEN string: {fen}"}

    if board.is_game_over():
        return {"error": "The game is already over. No moves to suggest."}

    legal_moves = list(board.legal_moves)
    if not legal_moves:
        return {"error": "No legal moves available."}

    if difficulty == "easy":
        move = random.choice(legal_moves)
        eval_comment = "Picked a random move — going easy on you!"
    elif difficulty == "hard":
        move, score = _find_best_move(board, depth=3)
        eval_comment = _eval_comment(score)
    else:
        move, score = _find_best_move(board, depth=2)
        eval_comment = _eval_comment(score)

    san = board.san(move)
    uci = move.uci()
    board.push(move)
    resulting_fen = board.fen()

    # Record AI's move in shared game state (also updates evaluation_score)
    game_state.record_move(fen, uci)

    return {
        "move_uci": uci,
        "move_san": san,
        "resulting_fen": resulting_fen,
        "evaluation": eval_comment,
        "difficulty": difficulty,
    }


def apply_move(fen: str, move: str) -> dict:
    """Apply a move spoken by the player to the given position.

    Use this tool as a fallback when the camera can't detect the player's
    move. The player says their move out loud (e.g., "e4", "knight to f3",
    "castle kingside") and you parse it into either:
    - SAN format (e.g., "e4", "Nf3", "O-O", "Qxd5", "e8=Q")
    - UCI format (e.g., "e2e4", "g1f3", "e1g1")

    The tool accepts either format and will figure out which one it is.
    The move is validated and recorded in the game history.

    Args:
        fen: A FEN string representing the current board position.
        move: The move in SAN format ("Nf3", "O-O") or UCI format ("g1f3").

    Returns:
        A dictionary with the validated move details and resulting FEN,
        or an error if the move is invalid/illegal.
    """
    try:
        board = chess.Board(fen)
    except ValueError:
        return {"error": f"Invalid FEN string: {fen}"}

    move = move.strip()
    chess_move: chess.Move | None = None

    # Try UCI first
    try:
        candidate = chess.Move.from_uci(move)
        if candidate in board.legal_moves:
            chess_move = candidate
    except ValueError:
        pass

    # Try SAN if UCI didn't work
    if chess_move is None:
        try:
            chess_move = board.parse_san(move)
        except (chess.InvalidMoveError, chess.IllegalMoveError, chess.AmbiguousMoveError) as e:
            return {
                "error": f"Could not parse '{move}' as a legal move: {e}",
                "hint": "Try UCI format (e.g., 'e2e4') or standard notation (e.g., 'Nf3', 'O-O').",
            }

    if chess_move is None or chess_move not in board.legal_moves:
        return {
            "error": f"'{move}' is not a legal move in this position.",
            "legal_moves_sample": [board.san(m) for m in list(board.legal_moves)[:10]],
        }

    san = board.san(chess_move)
    uci = chess_move.uci()
    side = "white" if board.turn == chess.WHITE else "black"

    # Record in shared game state (also updates evaluation_score)
    game_state.record_move(fen, uci)
    board.push(chess_move)
    resulting_fen = board.fen()

    return {
        "move_uci": uci,
        "move_san": san,
        "side": side,
        "resulting_fen": resulting_fen,
        "message": f"{side.title()} played {san}.",
    }


def get_move_history() -> dict:
    """Get the list of all moves played so far in this game.

    Use this tool when the player asks about the game history, wants to
    know what moves have been played, or when you want to reference past
    moves in your commentary (e.g., "That's your third pawn move in a row").

    Returns:
        A dictionary with the full move list and a PGN-like summary string.
    """
    state = game_state.get_state()
    history = state["move_history"]

    if not history:
        return {
            "moves": [],
            "total": 0,
            "pgn": "",
            "message": "No moves have been played yet.",
        }

    # Build PGN-like summary
    pgn_parts: list[str] = []
    current_move_num = 0
    for entry in history:
        mn = entry["move_number"]
        if entry["side"] == "white":
            current_move_num = mn
            pgn_parts.append(f"{mn}. {entry['move_san']}")
        else:
            if mn != current_move_num:
                pgn_parts.append(f"{mn}...")
            pgn_parts.append(entry["move_san"])

    return {
        "moves": history,
        "total": len(history),
        "pgn": " ".join(pgn_parts),
        "current_fen": state["current_fen"],
    }


# ---------------------------------------------------------------------------
# Internal helpers (not ADK tools — no docstrings used by LLM)
# ---------------------------------------------------------------------------

# Piece values for material evaluation
_PIECE_VALUES = {
    chess.PAWN: 100,
    chess.KNIGHT: 320,
    chess.BISHOP: 330,
    chess.ROOK: 500,
    chess.QUEEN: 900,
    chess.KING: 0,
}


def _evaluate_board(board: chess.Board) -> int:
    """Evaluate board position from the perspective of the side to move.

    Positive = side to move is ahead, negative = behind.
    """
    if board.is_checkmate():
        return -99999  # side to move is checkmated
    if board.is_stalemate() or board.is_insufficient_material():
        return 0

    score = 0
    for piece_type in _PIECE_VALUES:
        score += len(board.pieces(piece_type, chess.WHITE)) * _PIECE_VALUES[piece_type]
        score -= len(board.pieces(piece_type, chess.BLACK)) * _PIECE_VALUES[piece_type]

    # Flip sign so it's from the perspective of the side to move
    if board.turn == chess.BLACK:
        score = -score

    # Bonus for mobility
    score += len(list(board.legal_moves)) * 5

    return score


def _minimax(
    board: chess.Board,
    depth: int,
    alpha: int,
    beta: int,
    maximizing: bool,
) -> int:
    """Minimax search with alpha-beta pruning."""
    if depth == 0 or board.is_game_over():
        return _evaluate_board(board)

    if maximizing:
        max_eval = -999999
        for move in board.legal_moves:
            board.push(move)
            val = _minimax(board, depth - 1, alpha, beta, False)
            board.pop()
            max_eval = max(max_eval, val)
            alpha = max(alpha, val)
            if beta <= alpha:
                break
        return max_eval
    else:
        min_eval = 999999
        for move in board.legal_moves:
            board.push(move)
            val = _minimax(board, depth - 1, alpha, beta, True)
            board.pop()
            min_eval = min(min_eval, val)
            beta = min(beta, val)
            if beta <= alpha:
                break
        return min_eval


def _find_best_move(board: chess.Board, depth: int) -> tuple[chess.Move, int]:
    """Find the best move using minimax with alpha-beta pruning."""
    best_move = None
    best_score = -999999

    # Shuffle to add variety when moves are equal
    moves = list(board.legal_moves)
    random.shuffle(moves)

    for move in moves:
        board.push(move)
        score = -_minimax(board, depth - 1, -999999, 999999, False)
        board.pop()
        if score > best_score:
            best_score = score
            best_move = move

    assert best_move is not None
    return best_move, best_score


def _eval_comment(score: int) -> str:
    """Turn a numeric evaluation into a human-readable quip."""
    if score > 500:
        return "I'm feeling very confident about this position."
    elif score > 200:
        return "Things are looking good for me."
    elif score > 50:
        return "Slight edge, I think."
    elif score > -50:
        return "This is pretty even — good game so far!"
    elif score > -200:
        return "You've got a slight edge. Nice play."
    elif score > -500:
        return "You're ahead here. I need to be careful."
    else:
        return "I'm in trouble, but I'm not giving up!"
