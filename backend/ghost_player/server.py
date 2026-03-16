"""FastAPI WebSocket server bridging the React frontend to ADK run_live().

Follows the same pattern as ADK's built-in adk_web_server.py:
- All WebSocket messages are JSON text (no binary frames)
- Audio/video blobs are base64-encoded in LiveRequest JSON
- Server sends ADK Event objects as JSON

Run with:
    cd backend && uvicorn ghost_player.server:app --host 0.0.0.0 --port 8000 --reload
"""

import asyncio
import json
import logging
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
from .tools import game_state
from .tools.game_state import get_state, store_frame
from . import demo_games

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

# ---------------------------------------------------------------------------
# WebSocket broadcast — push game state changes to all connected clients
# ---------------------------------------------------------------------------
_connected_websockets: set[WebSocket] = set()


def _broadcast_game_state(state: dict) -> None:
    """Send a game-state update to every connected WebSocket (best-effort)."""
    msg = json.dumps({"_gameStateUpdate": state})
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return
    for ws in list(_connected_websockets):
        try:
            loop.create_task(ws.send_text(msg))
        except Exception:
            _connected_websockets.discard(ws)


game_state.register_broadcast(_broadcast_game_state)


_active_demo_task: asyncio.Task | None = None


@app.get("/health")
async def health() -> dict:
    """Health check endpoint."""
    return {"status": "ok", "agent": "ghost_player"}


@app.get("/api/demo/games")
async def list_demo_games() -> dict:
    """Return available demo games for Watch Demo feature."""
    return {
        "games": [
            {"id": gid, "name": g["name"], "description": g["description"]}
            for gid, g in demo_games.DEMO_GAMES.items()
        ]
    }


@app.post("/api/demo/play/{game_id}")
async def play_demo(game_id: str) -> dict:
    """Start replaying a demo game (applies moves automatically every 2.5s)."""
    global _active_demo_task
    if game_id not in demo_games.DEMO_GAMES:
        return {"error": f"Unknown demo: {game_id}. Choose from: {list(demo_games.DEMO_GAMES)}"}

    if _active_demo_task and not _active_demo_task.done():
        _active_demo_task.cancel()

    _active_demo_task = asyncio.create_task(demo_games.replay_game(game_id))
    return {"status": "started", "game": demo_games.DEMO_GAMES[game_id]["name"]}


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
    _connected_websockets.add(websocket)
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

    async def keepalive() -> None:
        """Send a silent ping every 90s to prevent the Gemini Live 2-min timeout."""
        while True:
            await asyncio.sleep(90)
            try:
                live_request_queue.send(LiveRequest(text="..."))
            except Exception:
                break

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

    # Run all tasks concurrently; cancel the rest if one fails.
    tasks = [
        asyncio.create_task(forward_events()),
        asyncio.create_task(process_messages()),
        asyncio.create_task(keepalive()),
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
        _connected_websockets.discard(websocket)
        for task in pending:
            task.cancel()
        live_request_queue.close()
