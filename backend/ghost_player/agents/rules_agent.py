"""Chess Rules Expert — dedicated sub-agent for rule lookups.

A focused ADK agent that handles all chess rules questions via
Google Search grounding. Exposed to the root_agent as an AgentTool,
demonstrating multi-agent ADK architecture.
"""

from google.adk.agents import Agent

from ..tools.rules import lookup_chess_rules

rules_agent = Agent(
    name="chess_rules_expert",
    model="gemini-2.5-flash",
    description=(
        "Specialist agent for chess rules and FIDE regulations. "
        "Use this whenever the player asks about rules, legality of moves, "
        "castling conditions, en passant, stalemate, draws, or any rules dispute."
    ),
    instruction=(
        "You are a FIDE chess rules expert. Answer chess rule questions accurately "
        "and concisely. Cite the specific FIDE rule where applicable. "
        "Keep answers short — two or three sentences maximum."
    ),
    tools=[lookup_chess_rules],
)
