# Ghost Player — AI Board Game Opponent

Real-time AI agent that watches a physical chess board through a webcam, plays as Black, and talks to the player naturally using voice. Built for the **Gemini Live Agent Challenge** hackathon (deadline: March 16, 2026).

## Project Context

Read `docs/Ghost_Player_Research_Report.md` for full hackathon requirements and architecture research.
Read `docs/TODO.md` for the prioritised build plan and remaining tasks.

---

## Current Status (March 3, 2026)

**Phase 7 fully complete.** Working features:
- Real-time voice conversation via Gemini Live API (Fenrir voice)
- Camera board detection via separate Gemini 2.5 Flash vision calls
- Chess engine with minimax alpha-beta (easy/medium/hard)
- Verbal move fallback (player speaks move when camera can't detect)
- Real-time game state broadcast to frontend via WebSocket
- Barge-in / interruption support
- Visual evaluation bar (material balance, centipawns, smooth animation)
- Opening recognition (~65 openings, ECO codes, `recognize_opening` tool)
- Coach mode (`toggle_coach_mode`, cyan badge in UI, agent explains every move)
- Post-game analysis (`analyze_game` tool: turning point, blunder detection, phase counts, key insight shown in game-over overlay)
- Google Search grounded rules lookup
- React UI: chess board, eval bar, move history, transcript, coach badge, post-game insight

**Remaining**: multi-agent ADK refactor (8a), Firestore (8b), frame preprocessing (8c),
captured pieces + move animation (9a/9b), demo mode (9c), Terraform (10a),
Cloud Run deploy (10b), architecture diagram (10c), demo video + submission (11).

---

## Tech Stack

- **Backend**: Python 3.11+, FastAPI, Google ADK (Agent Development Kit)
- **AI Model**: Gemini Live API — `gemini-2.5-flash-native-audio-preview-12-2025`
- **Vision**: `gemini-2.5-flash` (separate calls, NOT the live model)
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Game Logic**: `python-chess` — minimax with alpha-beta pruning
- **Deployment**: Google Cloud Run
- **Session Storage**: `InMemorySessionService` (dev) → Firestore (prod, Phase 8b)

---

## Actual Architecture (as built)

Single ADK `root_agent` with tools. NOT multi-agent yet (Phase 8a will refactor).

```
Browser
  │  mic (PCM16, 16kHz)           camera (JPEG, 1 FPS)
  │  speaker (PCM16, 24kHz)       ↓
  └──── WebSocket (/run_live) ────┐
                                  │
              FastAPI server.py   │
              ├─ Intercepts image blobs → shared frame buffer (game_state.py)
              ├─ Audio/text → LiveRequestQueue → ADK Runner → Gemini Live API
              └─ Broadcasts game state changes → WebSocket → React UI
                                  │
              ADK root_agent      │
              └─ tools:           │
                 analyze_board ───┘ (reads frame buffer, calls gemini-2.5-flash)
                 suggest_move      (minimax, records eval score)
                 apply_move        (verbal move input, SAN or UCI)
                 get_game_status   (includes coach_mode flag)
                 get_legal_moves
                 validate_move
                 get_move_history
                 set_difficulty
                 reset_game
                 recognize_opening  (prefix-match against ~65 openings)
                 toggle_coach_mode  (flips coach_mode in GameState)
                 analyze_game       (turning point, blunder detection, post-game insight)
                 lookup_chess_rules (Gemini 2.5 Flash + Google Search)
                 stop_streaming
```

**Key architectural decision**: Video frames are intercepted by `server.py` and stored
in a shared in-process buffer. They are NEVER sent to the Gemini Live API (the native
audio model can't handle video). The `analyze_board` tool reads from this buffer and
makes separate `gemini-2.5-flash` calls for vision analysis.

---

## Important Files

| File | Purpose |
|------|---------|
| `backend/ghost_player/agent.py` | `root_agent` definition, system prompt, tools list |
| `backend/ghost_player/server.py` | FastAPI + WebSocket bridge to ADK `run_live()` |
| `backend/ghost_player/tools/game_state.py` | `GameState` singleton: FEN, history, difficulty, eval score, coach mode, post-game insight, frame buffer |
| `backend/ghost_player/tools/chess_engine.py` | python-chess tools: `suggest_move` (minimax), `apply_move`, `get_game_status`, etc. |
| `backend/ghost_player/tools/vision.py` | Streaming async generator: polls frame buffer, calls Gemini vision, detects moves |
| `backend/ghost_player/tools/openings.py` | Opening book (~65 entries) + `recognize_opening()` tool |
| `backend/ghost_player/tools/rules.py` | `lookup_chess_rules` — Gemini 2.5 Flash + Google Search grounding |
| `backend/ghost_player/tools/__init__.py` | Exports all ADK tools |
| `backend/ghost_player/.env` | `GOOGLE_API_KEY` — never commit |
| `frontend/src/App.tsx` | Main UI: board-centric two-column layout |
| `frontend/src/hooks/useWebSocket.ts` | WS management, ADK event parsing, game state updates |
| `frontend/src/hooks/useMediaCapture.ts` | Mic (PCM16 16kHz via AudioWorklet) + camera (1 FPS JPEG) |
| `frontend/src/hooks/useAudioPlayback.ts` | Scheduled `AudioBufferSourceNode` playback (24kHz) |
| `frontend/src/components/ChessBoard.tsx` | FEN → Unicode chess board with last-move + check highlights |
| `frontend/src/types/game.ts` | `ServerGameState` TypeScript interface |
| `docs/TODO.md` | Full task breakdown with implementation details |
| `infra/` | Terraform scripts (Phase 10a — not yet created) |

---

## Commands

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Dev server (custom FastAPI + React frontend)
uvicorn ghost_player.server:app --host 0.0.0.0 --port 8000 --reload

# OR: ADK dev UI (voice/video, no custom frontend)
adk web

# Frontend
cd frontend
npm install
npm run dev   # http://localhost:3000 — proxies /run_live and /api to :8000

# Deploy
adk deploy cloud_run --project=$GOOGLE_CLOUD_PROJECT --region=us-central1 --with_ui

# Test
cd backend && python -m pytest tests/
```

---

## Code Standards

- Python: type hints on all functions, docstrings on all ADK tools (ADK uses the docstring for the LLM)
- Use `async`/`await` throughout — ADK streaming is async
- Never hardcode API keys — use `.env` and `GOOGLE_API_KEY` env var
- Frontend: functional React components, Tailwind CSS, no `any` types in TypeScript
- ADK streaming tools must be `async` generators returning `AsyncGenerator[str, None]`
- The `root_agent` variable name is required by ADK — don't rename it
- `__init__.py` must contain `from . import agent` for ADK to find the agent

---

## Key Technical Facts (learned from implementation)

- The Gemini Live native-audio model **cannot** process video — intercept frames server-side
- `InMemorySessionService` keeps session alive on the Python side; only the Live API WebSocket needs reconnection on the 2-min limit
- Fenrir voice: set via `RunConfig(speech_config=...)` only — do NOT set `response_modalities`
- Audio input: 16kHz PCM16 | Audio output: 24kHz PCM16
- Vision polling: every 2 seconds; board games are slow so 1 FPS camera + 2s poll is fine
- `_notify()` in `game_state.py` triggers WebSocket broadcast to all connected clients
- `evaluation_score` is computed in `GameState.record_move()` for every move — covers all code paths (vision, verbal, AI)
- `coach_mode` persists in `GameState` and is included in `get_game_status()` result so the agent can rediscover it after long context
- `analyze_game()` recomputes eval at every `fen_after` in history using `_compute_white_advantage` — blunder threshold is 300cp (3 pawns)
- `post_game_insight` is stored in `GameState` and broadcast via `_notify()` so the overlay updates the moment the agent calls `analyze_game`

---

## Hackathon Submission Checklist

### Required
- [ ] Public GitHub repo with spin-up instructions in README
- [ ] Architecture diagram in `docs/architecture.png`
- [ ] Demo video (<4 min) showing real working software
- [ ] Proof of GCP deployment (screen recording or code file)
- [ ] Text description of features and technologies

### Bonus (Do All Three)
- [ ] Blog post with `#GeminiLiveAgentChallenge`
- [ ] Terraform/IaC scripts in `infra/`
- [ ] GDG profile link
