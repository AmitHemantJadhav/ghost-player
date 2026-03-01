"""Streaming vision tool for board analysis.

Reads camera frames from a shared frame buffer (written by server.py),
then calls Gemini 2.5 Flash for vision analysis. Video frames are kept
completely separate from the Live API audio stream.
"""

import asyncio
import logging
import time
from collections.abc import AsyncGenerator

import chess
from google import genai
from google.genai import types

from . import game_state

logger = logging.getLogger(__name__)

# Vision model — separate from the live agent model.
# The live model handles voice; this model handles frame analysis.
_VISION_MODEL = "gemini-2.5-flash"

# How often to poll for new frames (seconds). Board games are slow.
_POLL_INTERVAL = 2.0

# Minimum seconds between repeated error messages to avoid spamming the player
_ERROR_COOLDOWN = 10.0

# Prompt for initial full-board detection
_INITIAL_PROMPT = """Analyze this image of a chess board. Determine:

1. The positions of all pieces on the board.
2. Output the position as a FEN string (just the piece placement part, e.g.,
   "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR").
3. Determine whose turn it likely is based on the position (if it looks like
   the starting position, it's White's turn).

Respond in this exact format:
FEN: <full FEN string including turn, castling, en passant, halfmove, fullmove>
DESCRIPTION: <brief description of the position>
CONFIDENCE: <HIGH, MEDIUM, or LOW>

Special cases — respond with the appropriate tag:

If a hand or fingers are blocking the view of the board:
HAND_BLOCKING: A hand is blocking the view.

If the board appears rotated (Black pieces at the bottom instead of top):
BOARD_ROTATED: The board appears to be viewed from Black's side.
FEN: <FEN string adjusted for the detected orientation>

If you can see a board but can't identify pieces reliably:
UNCLEAR_POSITION: <explanation of what's unclear>

If you cannot see a chess board at all:
ERROR: <explanation of what you see instead>

Important guidelines:
- Use standard FEN notation. Lowercase = black pieces, uppercase = white pieces.
- Ranks go from 8 (top, black's back rank) to 1 (bottom, white's back rank).
- The board may be wooden, vinyl, plastic, or displayed on a screen — all are valid.
- Ignore any hands, fingers, or arms that may appear in the frame. Focus only on the board and pieces.
- If the board orientation is ambiguous, assume White is at the bottom (closest to the camera)."""

# Prompt for differential analysis (compare to last known FEN)
_DIFF_PROMPT_TEMPLATE = """Analyze this image of a chess board. The last known position was:
{last_fen}

In that position it was {turn}'s turn to move (move {move_number}).

Look at the board and determine:
1. Has a move been made since the last known position?
2. If yes, what move was made? Express it in UCI format (e.g., e2e4, g8f6).
3. What is the new FEN after the move?

Respond in this exact format if a move was detected:
MOVE: <UCI move, e.g., e2e4>
FEN: <new full FEN string>
DESCRIPTION: <brief description of the move>
CONFIDENCE: <HIGH, MEDIUM, or LOW>

If no move has been made (board looks the same):
NO_CHANGE: The board position has not changed.

Special cases — respond with the appropriate tag:

If a hand or fingers are blocking the view:
HAND_BLOCKING: A hand is blocking the view.

If the board appears to have been rotated or flipped:
BOARD_ROTATED: The board orientation has changed.

If you can see the board but can't determine the position reliably:
UNCLEAR_POSITION: <explanation>

If you cannot see the board clearly:
ERROR: <explanation>

Important guidelines:
- The move must be from {turn}'s perspective since it was their turn.
- Ignore hands, fingers, or arms in the frame — focus on piece positions.
- The board may be wooden, vinyl, plastic, or on a screen.
- For castling: kingside = e1g1 (white) or e8g8 (black), queenside = e1c1 or e8c8.
- For en passant: the capturing pawn moves diagonally and the captured pawn disappears.
- If you see multiple pieces moved, it might be castling — check for that."""


def _get_new_frame(last_timestamp: float) -> tuple[bytes | None, float]:
    """Get the latest frame from the shared buffer if it's newer than last_timestamp.

    Returns:
        A tuple of (frame_bytes, timestamp). frame_bytes is None if no new
        frame is available since last_timestamp.
    """
    frame, timestamp = game_state.get_latest_frame()
    if frame is not None and timestamp > last_timestamp:
        return frame, timestamp
    return None, last_timestamp


async def _analyze_frame(
    client: genai.Client,
    frame_bytes: bytes,
    last_fen: str | None,
) -> dict:
    """Send a frame to Gemini vision model for analysis.

    Args:
        client: The google.genai Client instance.
        frame_bytes: JPEG image bytes of the board.
        last_fen: The last known FEN, or None for initial detection.

    Returns:
        Parsed result dict with keys like 'fen', 'move', 'error', etc.
    """
    if last_fen is None:
        prompt = _INITIAL_PROMPT
    else:
        turn = "white" if " w " in last_fen else "black"
        state = game_state.get_state()
        move_number = len(state["move_history"]) + 1
        prompt = _DIFF_PROMPT_TEMPLATE.format(
            last_fen=last_fen, turn=turn, move_number=move_number,
        )

    # Defensive: if data arrived as base64 string instead of bytes, decode it
    if isinstance(frame_bytes, str):
        import base64
        frame_bytes = base64.b64decode(frame_bytes)

    image_part = types.Part.from_bytes(data=frame_bytes, mime_type="image/jpeg")
    text_part = types.Part.from_text(text=prompt)

    try:
        response = await client.aio.models.generate_content(
            model=_VISION_MODEL,
            contents=types.Content(
                parts=[image_part, text_part],
                role="user",
            ),
        )
    except Exception as e:
        logger.error("Vision model call failed: %s", e)
        return {"error": f"Vision analysis failed: {e}"}

    text = response.text.strip() if response.text else ""
    return _parse_vision_response(text, last_fen)


def _parse_vision_response(text: str, last_fen: str | None) -> dict:
    """Parse the vision model's text response into structured data."""
    result: dict = {"raw": text}

    for line in text.split("\n"):
        line = line.strip()
        if line.startswith("FEN:"):
            result["fen"] = line[4:].strip()
        elif line.startswith("MOVE:"):
            result["move"] = line[5:].strip()
        elif line.startswith("DESCRIPTION:"):
            result["description"] = line[12:].strip()
        elif line.startswith("CONFIDENCE:"):
            result["confidence"] = line[11:].strip().upper()
        elif line.startswith("NO_CHANGE:"):
            result["no_change"] = True
        elif line.startswith("HAND_BLOCKING:"):
            result["hand_blocking"] = True
        elif line.startswith("BOARD_ROTATED:"):
            result["board_rotated"] = True
        elif line.startswith("UNCLEAR_POSITION:"):
            result["unclear"] = line[17:].strip()
        elif line.startswith("ERROR:"):
            result["error"] = line[6:].strip()

    return result


def _validate_detected_fen(fen: str) -> bool:
    """Check if a FEN string is valid using python-chess."""
    try:
        chess.Board(fen)
        return True
    except ValueError:
        return False


def _validate_detected_move(fen: str, move_uci: str) -> bool:
    """Check if a detected move is legal in the given position."""
    try:
        board = chess.Board(fen)
        move = chess.Move.from_uci(move_uci)
        return move in board.legal_moves
    except (ValueError, Exception):
        return False


async def analyze_board() -> AsyncGenerator[str, None]:
    """Continuously watch the chess board through the camera and detect moves.

    This tool reads camera frames from a shared buffer (frames are stored
    by the server when the frontend sends image blobs). It analyzes the
    board position using Gemini vision, detects when moves are made, and
    reports changes to the agent.

    The tool starts by detecting the initial board position from the first
    clear frame. After that, it watches for changes and reports each new
    move as it's detected. All detected moves are validated against
    python-chess to ensure they are legal.

    Call this tool when the player says they want to start a game or asks
    you to watch the board. The tool will keep running and reporting moves
    until stopped.
    """
    client = genai.Client()
    last_fen: str | None = None
    frames_without_board = 0
    last_error_time: float = 0.0
    last_frame_timestamp: float = 0.0
    no_frame_count = 0

    yield "Starting board analysis. I'll watch for your camera frames..."

    while True:
        await asyncio.sleep(_POLL_INTERVAL)

        # Get latest frame from the shared buffer
        frame, new_timestamp = _get_new_frame(last_frame_timestamp)

        if frame is None:
            no_frame_count += 1
            # After 15 polls (~30s) with no frames, hint the player
            if no_frame_count == 15:
                yield "I don't see any camera frames yet. Make sure your camera is turned on and pointed at the board."
            continue

        no_frame_count = 0
        last_frame_timestamp = new_timestamp

        # Analyze the frame
        result = await _analyze_frame(client, frame, last_fen)
        now = time.monotonic()

        # --- Handle transient obstructions ---
        if result.get("hand_blocking"):
            if now - last_error_time >= _ERROR_COOLDOWN:
                yield "I can see a hand blocking the board. Please move your hand so I can see the pieces."
                last_error_time = now
            continue

        if result.get("board_rotated"):
            if "fen" in result and _validate_detected_fen(result["fen"]):
                # Accept rotated board with adjusted FEN
                last_fen = result["fen"]
                game_state._state.current_fen = last_fen
                yield (
                    "It looks like the board is viewed from the other side. "
                    f"I've adjusted — current position (FEN): {last_fen}."
                )
            elif now - last_error_time >= _ERROR_COOLDOWN:
                yield (
                    "The board seems to be rotated. Could you rotate it so White's "
                    "pieces are at the bottom (closest to the camera)?"
                )
                last_error_time = now
            continue

        if result.get("unclear"):
            if now - last_error_time >= _ERROR_COOLDOWN:
                yield (
                    f"I can see the board but I'm not sure about the position: "
                    f"{result['unclear']}. Could you adjust the lighting or camera angle?"
                )
                last_error_time = now
            continue

        # --- Handle errors ---
        if "error" in result:
            frames_without_board += 1
            if frames_without_board >= 3 and now - last_error_time >= _ERROR_COOLDOWN:
                yield (
                    f"I'm having trouble seeing the board: {result['error']}. "
                    f"Please adjust the camera. Or you can tell me your move verbally."
                )
                frames_without_board = 0
                last_error_time = now
            continue

        frames_without_board = 0

        # --- Initial detection mode ---
        if last_fen is None:
            if "fen" not in result:
                yield "I can see something but I'm not sure it's a chess board. Can you adjust the camera?"
                continue

            fen = result["fen"]
            if not _validate_detected_fen(fen):
                yield "I detected a board but the position doesn't look valid. Let me try again..."
                continue

            last_fen = fen
            # Sync game state with detected position
            game_state._state.current_fen = fen
            game_state._state.started = True

            description = result.get("description", "Chess board detected.")
            confidence = result.get("confidence", "")
            board = chess.Board(fen)
            turn = "White" if board.turn == chess.WHITE else "Black"
            conf_note = f" (confidence: {confidence})" if confidence else ""
            yield (
                f"Board detected! {description}{conf_note} "
                f"Current position (FEN): {fen}. "
                f"It's {turn}'s turn. "
                f"I'm playing as Black. Make your move when ready!"
            )
            continue

        # --- Differential mode — check for changes ---
        if result.get("no_change"):
            continue

        if "move" not in result:
            continue

        move_uci = result["move"]
        new_fen = result.get("fen")
        confidence = result.get("confidence", "")

        # Validate the detected move against current position
        if _validate_detected_move(last_fen, move_uci):
            # Move is legal — apply it and record
            board = chess.Board(last_fen)
            move = chess.Move.from_uci(move_uci)
            san = board.san(move)

            # Record in shared game state
            game_state.record_move(last_fen, move_uci)

            board.push(move)
            last_fen = board.fen()
            description = result.get("description", "")

            state = game_state.get_state()
            move_num = len(state["move_history"])
            turn = "White" if board.turn == chess.WHITE else "Black"
            yield (
                f"Move {move_num} detected: {san} ({move_uci}). "
                f"{description} "
                f"New position (FEN): {last_fen}. "
                f"It's now {turn}'s turn."
            )
        elif new_fen and _validate_detected_fen(new_fen):
            # Move wasn't legal from last_fen, but the new FEN is valid.
            # The vision model might have missed an intermediate move.
            last_fen = new_fen
            game_state._state.current_fen = new_fen
            board = chess.Board(new_fen)
            turn = "White" if board.turn == chess.WHITE else "Black"
            yield (
                f"The board position has changed but I couldn't track the exact move. "
                f"New position (FEN): {new_fen}. "
                f"It's {turn}'s turn. "
                f"Could you tell me what move was played?"
            )
        else:
            # Can't validate — ask for verbal fallback
            yield (
                f"I think I saw a move ({move_uci}) but I couldn't verify it. "
                f"Could you tell me what move you just played? "
                f"For example, say 'I moved pawn to e4' or 'knight to f3'."
            )
