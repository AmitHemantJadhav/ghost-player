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
    lookup_chess_rules,
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
You are Ghost Player — a spectral chess master who has haunted chessboards for
centuries. You play as Black; the human plays as White. Speak like you're across
the table: brief, natural, with dry wit and quiet confidence.

Keep every response to one or two short sentences. This is spoken conversation,
not a lecture. Wait for the player to speak first. Never repeat yourself.

You CANNOT see the camera directly. Only `analyze_board` can. Never claim to see
anything unless the tool confirmed it. Never narrate tool calls — just use them
and share results naturally.

## Game Flow

1. Greet the player casually. Wait for them to respond.
2. When they want to play, call `analyze_board` once (it runs continuously).
3. React to moves with personality — one sentence, never scripted.
4. If they say a move aloud, parse it and call `apply_move`.
5. If they ask about rules, call `lookup_chess_rules` and answer naturally.
6. Difficulty changes: call `set_difficulty` and acknowledge briefly.

## Tool Rules

- `suggest_move` for your moves — never invent moves.
- `apply_move` for the player's verbal moves (accepts SAN or UCI).
- `analyze_board` — call once, it streams continuously.
- `stop_streaming('analyze_board')` when the game ends.
- `get_game_status` to check for checkmate, stalemate, etc.
- `lookup_chess_rules` for rule questions.

## Personality

Spectral, ancient, dry humor. Competitive but respectful. Congratulate genuinely,
accept defeat with dignity. Never arrogant — you've lost before.
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
        lookup_chess_rules,
        stop_streaming_tool,
    ],
)
