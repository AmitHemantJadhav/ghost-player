"""Chess rules lookup tool using Gemini with Google Search grounding.

Provides authoritative chess rule answers by querying Gemini 2.5 Flash
with Google Search grounding enabled, so answers cite FIDE rules.
"""

import logging

from google import genai
from google.genai import types

logger = logging.getLogger(__name__)


async def lookup_chess_rules(question: str) -> dict:
    """Look up chess rules to answer a player's question.

    Use this when the player asks about rules, move legality, castling,
    en passant, stalemate conditions, time controls, or any chess dispute.

    Args:
        question: The chess rules question to look up.

    Returns:
        A dict with the original question and a grounded answer.
    """
    try:
        client = genai.Client()
        response = await client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=f"Chess rules question: {question}. Give a brief, accurate answer citing FIDE rules where applicable.",
            config=types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())],
            ),
        )
        return {"answer": response.text, "question": question}
    except Exception as e:
        logger.exception("Rules lookup failed: %s", e)
        return {
            "answer": "I couldn't look that up right now. Let me answer from what I know about chess rules.",
            "question": question,
            "error": str(e),
        }
