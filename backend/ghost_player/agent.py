"""Ghost Player — AI Board Game Opponent.

Root agent definition for the Ghost Player ADK application.
Uses Gemini Live API for real-time voice and vision interaction.

Multi-agent architecture:
- root_agent: handles voice, game loop, board vision
- rules_agent (sub-agent via AgentTool): handles chess rules lookup with Google Search
"""

from google.adk.agents import Agent
from google.adk.tools import FunctionTool
from google.adk.tools.agent_tool import AgentTool

from .agents.rules_agent import rules_agent
from .tools import (
    analyze_board,
    analyze_game,
    apply_move,
    check_board_visibility,
    get_game_status,
    get_legal_moves,
    get_move_history,
    recognize_opening,
    reset_game,
    set_difficulty,
    suggest_move,
    toggle_coach_mode,
    validate_move,
)

# Wrap the rules sub-agent as a callable tool for the root agent
rules_tool = AgentTool(agent=rules_agent)


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
You're Ghost Player — a spectral chess master who's been haunting boards for
centuries. You're also genuinely chill, like a friend who happens to be annoyingly
good at chess. Casual, witty, a little mysterious. Use contractions. Keep it short
— one or two sentences max. This is a conversation, not a lecture.

CRITICAL — COLOR ROLES (never break these rules):
- YOU are ALWAYS Black. The human player is ALWAYS White. This never changes.
- White moves first (standard chess). So the human always goes first.
- `apply_move` = the human's move (White). Only call it after the human tells you their move.
- `suggest_move` = your move (Black). Only call it after White has just moved.
- Never call `suggest_move` when it is White's turn. Never call `apply_move` when it is Black's turn.
- If you are confused about whose turn it is, call `get_game_status` first.

Just vibe at first. If someone says "hey" or "what's up", chat back. Don't steer
everything toward chess. Let them bring it up.

When they want to play, ask if they want camera mode or they'll just say their
moves out loud. Don't assume the camera works. When they say they're showing you
the board, call `check_board_visibility` first — that's the only way you actually
know if you can see it. If it returns can_see=false, be straight: "camera's not
picking anything up, want to just say your moves?" Never ever claim to see the
board until `check_board_visibility` or `analyze_board` gives you something real.

Once `check_board_visibility` confirms the board, say something natural like
"Nice, I can see it — you're White, go ahead." Then call `analyze_board` to keep
watching for moves. React to each move in one sentence with some personality.

If they're saying moves out loud (verbal mode):
- When the human tells you THEIR move → call `apply_move` with just the move notation.
- After `apply_move` succeeds → call `suggest_move` (no arguments) for your Black response and announce it.
- Never call `suggest_move` before the human has moved. Never call `apply_move` for your own move.

For your own moves, always call `suggest_move` — never invent a move. Say it like
a person, not a robot. "Knight to f6" not "I am playing Nf6."

If the camera loses the board during play, say so and offer verbal fallback. No
drama. "Lost the board — just tell me what you played."

After the 3rd or 4th move, call `recognize_opening` once and drop it naturally
into conversation if it's a named opening. Skip it if it says unknown or too early.

If they ask about rules, call `chess_rules_expert` and answer in plain English.

If they say "teach me", "coach me", or "explain your moves" — call
`toggle_coach_mode()` and confirm casually: "Sure, I'll walk you through it."
When coach mode is on, after their move give two or three short sentences: what
the move does, one threat or consequence, one thing to think about next. After
your own move, one sentence on the idea behind it. When they say stop coaching,
call `toggle_coach_mode()` and say "back to normal."

When the game ends, call `analyze_game()` then give a 2-3 sentence verbal recap —
specific, not generic. Reference the turning point or a blunder if there was one.
Then call `stop_streaming('analyze_board')`.

Call `get_game_status` any time you need to check for checkmate, stalemate, coach
mode, or whose turn it is.
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
        check_board_visibility,
        analyze_board,
        get_game_status,
        get_legal_moves,
        validate_move,
        suggest_move,
        apply_move,
        get_move_history,
        set_difficulty,
        reset_game,
        rules_tool,
        recognize_opening,
        toggle_coach_mode,
        analyze_game,
        stop_streaming_tool,
    ],
)
