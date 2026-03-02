"""FastAPI WebSocket server bridging the React frontend to ADK run_live().

Follows the same pattern as ADK's built-in adk_web_server.py:
- All WebSocket messages are JSON text (no binary frames)
- Audio/video blobs are base64-encoded in LiveRequest JSON
- Server sends ADK Event objects as JSON

Run with:
    cd backend && uvicorn ghost_player.server:app --host 0.0.0.0 --port 8000 --reload
"""

import asyncio
import logging
import traceback
from pathlib import Path

from dotenv import load_dotenv

# Load .env from the ghost_player package directory (same as adk web does)
_env_path = Path(__file__).parent / ".env"
load_dotenv(_env_path)

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware

from google.adk.agents.live_request_queue import LiveRequest, LiveRequestQueue
from google.adk.agents.run_config import RunConfig
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from .agent import root_agent
from .tools.game_state import get_state, store_frame

_RUN_CONFIG = RunConfig(
    speech_config=types.SpeechConfig(
        voice_config=types.VoiceConfig(
            prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Fenrir")
        )
    )
)

logger = logging.getLogger(__name__)

app = FastAPI(title="Ghost Player API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

session_service = InMemorySessionService()
runner = Runner(
    app_name="ghost_player",
    agent=root_agent,
    session_service=session_service,
)


@app.get("/health")
async def health() -> dict:
    """Health check endpoint."""
    return {"status": "ok", "agent": "ghost_player"}


@app.get("/api/game-state")
async def game_state() -> dict:
    """Return the current game state snapshot."""
    return get_state()


@app.post("/api/session/{user_id}/{session_id}")
async def create_session(user_id: str, session_id: str) -> dict:
    """Create a session in InMemorySessionService.

    Must be called before connecting to /run_live, since the runner
    expects the session to already exist.
    """
    session = await session_service.get_session(
        app_name="ghost_player",
        user_id=user_id,
        session_id=session_id,
    )
    if session is not None:
        return {"status": "exists", "session_id": session_id}

    session = await session_service.create_session(
        app_name="ghost_player",
        user_id=user_id,
        session_id=session_id,
    )
    return {"status": "created", "session_id": session.id}


@app.websocket("/run_live")
async def run_agent_live(
    websocket: WebSocket,
    app_name: str = Query(default="ghost_player"),
    user_id: str = Query(...),
    session_id: str = Query(...),
) -> None:
    """WebSocket endpoint that bridges the browser to ADK's run_live().

    Protocol (matching adk_web_server.py):
    - Client sends JSON text: LiveRequest objects (audio/video blobs are base64)
    - Server sends JSON text: ADK Event objects
    """
    await websocket.accept()
    logger.info("WebSocket connected: user=%s session=%s", user_id, session_id)

    # Look up the session object — run_live with session= (not user_id/session_id)
    # matches the exact pattern from adk_web_server.py
    session = await session_service.get_session(
        app_name="ghost_player",
        user_id=user_id,
        session_id=session_id,
    )
    if not session:
        await websocket.close(code=1002, reason="Session not found")
        return

    live_request_queue = LiveRequestQueue()

    async def forward_events() -> None:
        """Read events from runner.run_live() and send to WebSocket."""
        live_events = runner.run_live(
            session=session,
            live_request_queue=live_request_queue,
            run_config=_RUN_CONFIG,
        )
        async for event in live_events:
            await websocket.send_text(
                event.model_dump_json(exclude_none=True, by_alias=True)
            )

    async def process_messages() -> None:
        """Read messages from WebSocket and feed into LiveRequestQueue.

        Image blobs are intercepted and stored in the shared frame buffer
        so the vision tool can read them. They are NOT sent to the Live API
        (the native audio model can't handle video and would error/hallucinate).
        """
        while True:
            data = await websocket.receive_text()
            live_request = LiveRequest.model_validate_json(data)

            # Intercept image blobs → shared frame buffer (not the Live API)
            if (
                hasattr(live_request, "blob")
                and live_request.blob
                and getattr(live_request.blob, "mime_type", "")
                .startswith("image/")
            ):
                frame_data = live_request.blob.data
                if isinstance(frame_data, str):
                    import base64
                    frame_data = base64.b64decode(frame_data)
                store_frame(frame_data)
            else:
                # Audio and text go to the Live API via the queue
                live_request_queue.send(live_request)

    # Run both tasks concurrently and cancel all if one fails.
    tasks = [
        asyncio.create_task(forward_events()),
        asyncio.create_task(process_messages()),
    ]
    done, pending = await asyncio.wait(
        tasks, return_when=asyncio.FIRST_EXCEPTION
    )
    try:
        for task in done:
            task.result()
    except WebSocketDisconnect:
        logger.info("Client disconnected: user=%s session=%s", user_id, session_id)
    except Exception as e:
        logger.exception("Error during live websocket: %s", e)
        await websocket.close(code=1011, reason=str(e)[:123])
    finally:
        for task in pending:
            task.cancel()
        live_request_queue.close()
