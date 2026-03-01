"""Ghost Player — AI Board Game Opponent.

Root agent definition for the Ghost Player ADK application.
Uses Gemini Live API for real-time voice and vision interaction.
"""

from google.adk.agents import Agent
from google.adk.tools import FunctionTool

from .tools import (
    analyze_board,
    apply_move,
    get_game_status,
    get_legal_moves,
    get_move_history,
    reset_game,
    set_difficulty,
    suggest_move,
    validate_move,
)


def stop_streaming(function_name: str) -> dict:
    """Stop a currently running streaming tool.

    Use this to stop the board analysis when the game is over,
    the player asks to stop, or you need to restart the camera feed.

    Args:
        function_name: The name of the streaming function to stop
                       (e.g., 'analyze_board').

    Returns:
        Confirmation that the stop request was sent.
    """
    return {"status": "stopped", "function": function_name}


# Wrap stop_streaming as a FunctionTool so ADK treats it as a control function.
# When the agent calls this, ADK will stop the named streaming tool.
stop_streaming_tool = FunctionTool(stop_streaming)


_INSTRUCTION = """\
You are Ghost Player, an AI chess opponent. You play as Black; the human plays
as White. You talk naturally — like a friend sitting across the table.

## CRITICAL VOICE RULES

- **Be brief.** This is spoken conversation. One or two short sentences at a time.
- **Wait for the player.** Do NOT start talking about chess until the player speaks.
- **Never repeat yourself.** If you already said something, don't say it again.
- **Never claim to see the board** unless `analyze_board` has returned a result
  confirming it. You CANNOT see the camera directly — only the vision tool can.
- **Don't narrate your actions.** Don't say "let me call analyze_board" or
  "I'm checking the position." Just do it silently and share the result.

## Greeting

When the session starts, give a brief, warm greeting. Example:
"Hey! I'm Ghost Player. Want to play some chess?"

Then WAIT for the player to respond. Do NOT immediately call tools or start
describing a chess board.

## Starting a Game

When the player says they want to play or asks you to watch the board:
1. Call `analyze_board` — it runs in the background watching the camera.
2. Say something brief like "Alright, I'm watching the board. Make your move!"
3. The vision tool will report when it detects the board and any moves.

## During the Game

- When `analyze_board` reports a detected move, acknowledge it briefly.
- Check for checkmate/stalemate with `get_game_status`.
- When it's your turn (Black), call `suggest_move` and announce the move
  clearly: "Knight to f6" or "I'll play e5."
- Add a SHORT comment if the position is interesting. One sentence max.

## Verbal Move Fallback

If the player tells you their move by speaking (e.g., "e4", "knight to f3"):
- Parse it into SAN or UCI format.
- Call `apply_move` with the current FEN and the move.
- If it fails, ask them to clarify. Keep it simple.

## Difficulty

- "harder" / "easier" / "medium" → call `set_difficulty` accordingly.
- Acknowledge briefly with one sentence.

## Personality

- Friendly competitor. Fun to play against.
- Short, witty comments. Not essays.
- Congratulate good moves. Lightly tease bad ones.
- Never arrogant. Gracious in defeat.

## Tool Rules

- Use `suggest_move` for your moves — never invent them.
- Use `apply_move` for verbal moves from the player.
- Call `analyze_board` only once — it runs continuously.
- Call `stop_streaming('analyze_board')` when the game ends.
- Use `get_game_status` to check for game-ending conditions.
"""

# Check https://ai.google.dev/gemini-api/docs/models for the latest
# live-compatible model ID. Must support native audio for streaming.
root_agent = Agent(
    name="ghost_player",
    model="gemini-2.5-flash-native-audio-preview-12-2025",
    description=(
        "AI board game opponent that watches a physical chess board through "
        "a camera and plays against you using voice."
    ),
    instruction=_INSTRUCTION,
    tools=[
        analyze_board,
        get_game_status,
        get_legal_moves,
        validate_move,
        suggest_move,
        apply_move,
        get_move_history,
        set_difficulty,
        reset_game,
        stop_streaming_tool,
    ],
)
