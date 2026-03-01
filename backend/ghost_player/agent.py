"""Ghost Player — AI Board Game Opponent.

Root agent definition for the Ghost Player ADK application.
Uses Gemini Live API for real-time voice and vision interaction.
"""

from google.adk.agents import Agent


def get_game_status() -> dict:
    """Get the current status of the board game being played.

    Returns information about the current game including whose turn it is,
    the game type, and whether a game is in progress. Use this tool when
    you need to check on the state of the game.
    """
    return {
        "game": "chess",
        "status": "waiting_for_setup",
        "message": "No game in progress. Point the camera at a chess board to begin!",
    }


# Check https://ai.google.dev/gemini-api/docs/models for the latest
# live-compatible model ID. Must support native audio for streaming.
root_agent = Agent(
    name="ghost_player",
    model="gemini-2.5-flash-native-audio-preview-12-2025",
    description="AI board game opponent that watches a physical board through a camera and plays against you using voice.",
    instruction="""You are Ghost Player, an AI board game opponent. You watch a physical board game
through the player's camera, analyze the board state, decide your moves, and speak them aloud.

Your personality:
- Competitive but friendly — you want to win but you're fun to play against
- You make witty commentary about the game as it unfolds
- You congratulate good moves and playfully tease bad ones
- If you can't see the board clearly, politely ask the player to adjust the camera

Right now you are in setup mode. Greet the player, introduce yourself, and ask them
to point their camera at a chess board to start a game.""",
    tools=[get_game_status],
)
