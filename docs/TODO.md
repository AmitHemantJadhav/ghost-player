# Ghost Player — Build Plan & TODO

> **Hackathon**: Gemini Live Agent Challenge
> **Deadline**: March 16, 2026
> **Track**: Live Agents
> **Start Date**: March 1, 2026

---

## Phase 1: Scaffolding (Days 1–2 | March 1–2) ✅ DONE

- [x] Write research report and CLAUDE.md
- [x] Create project scaffolding (backend + frontend)
- [x] Set up ADK agent package (`backend/ghost_player/`)
- [x] Create minimal `root_agent` with Gemini Live model
- [x] Scaffold React + Vite + TypeScript frontend
- [x] Set up Tailwind CSS
- [x] Create landing page with placeholder UI sections
- [x] Write project README with quick-start instructions
- [x] Verify `adk web` loads the agent in dev UI
- [x] Verify frontend dev server runs

## Phase 2: Core Agent — Voice & Vision (Days 3–5 | March 3–5) ✅ DONE

- [x] Get basic voice interaction working via `adk web` (speak to agent, hear response)
- [x] Build vision streaming tool — accept `LiveRequestQueue`, process camera frames
- [x] Test vision tool: point camera at chessboard, confirm agent describes what it sees
- [x] Build board state parser — extract piece positions from Gemini vision output (FEN via Gemini 2.5 Flash)
- [x] Define structured game state format (FEN string for chess)
- [x] Build chess tools using python-chess (`get_game_status`, `get_legal_moves`, `validate_move`, `suggest_move`)
- [x] Minimax engine with alpha-beta pruning (easy/medium/hard difficulty)
- [ ] Wire up session resumption for 2-min video session limit (ADK RunConfig) — deferred to Phase 4

### Phase 2 Notes
- Voice, camera, and chess tools all verified working in `adk web`
- Vision tool uses separate `gemini-2.5-flash` model call (not the live model)
- `LiveRequestQueue` import: `from google.adk.agents import LiveRequestQueue` (ADK 1.18.0)
- Camera + mic must both be enabled BEFORE starting session in ADK dev UI
- Chess engine tools are in `backend/ghost_player/tools/chess_engine.py`
- Vision streaming tool is in `backend/ghost_player/tools/vision.py`
- Agent plays as Black, human plays as White

## Phase 3: Game Engine Integration & End-to-End Play (Days 5–7 | March 5–7) ✅ DONE

> Chess tools already built in Phase 2. This phase focuses on integrating
> the full pipeline: vision detects move → engine responds → agent speaks.

- [ ] Test full game loop: human makes move on physical board → vision detects → agent responds with its move
- [x] Tune vision prompts for reliable FEN extraction across different board styles/lighting
- [x] Add move history tracking (maintain list of moves played in the session)
- [x] Handle edge cases: piece knocked over, hand blocking camera, board rotated
- [ ] Test checkmate/stalemate/draw detection end-to-end
- [x] Add verbal move input fallback (player says move when vision can't detect)
- [x] Tune difficulty selection (let player change mid-game via voice)

### Phase 3 Notes
- Shared game state: `backend/ghost_player/tools/game_state.py` — module-level singleton
- New tools: `apply_move` (verbal fallback, accepts SAN or UCI), `get_move_history`, `set_difficulty`, `reset_game`
- Vision prompts improved: handles hand blocking, board rotation, unclear position, confidence levels
- Vision tool wired to GameState — moves detected by vision are recorded in history
- `suggest_move` now reads difficulty from GameState if not explicitly passed
- Error cooldown in vision tool prevents spamming the player
- Agent instructions updated with verbal move flow, difficulty switching, move history commentary

## Phase 4: Frontend Integration (Days 7–9 | March 7–9) ✅ DONE

- [x] Set up WebSocket connection between frontend and backend
- [x] Stream webcam video from browser to backend via WebSocket
- [x] Stream audio from browser mic to backend
- [x] Play agent audio responses in browser
- [x] Display game state in frontend (board position, move history)
- [x] Display chat/transcript log with agent messages
- [x] Wire up mic toggle and camera toggle buttons
- [x] Build FastAPI WebSocket endpoint that bridges to ADK `run_live()`

### Phase 4 Notes
- Backend: `backend/ghost_player/server.py` — FastAPI WebSocket server following `adk_web_server.py` pattern
- All WebSocket messages are JSON text; audio/video blobs are base64-encoded in LiveRequest format
- Frontend hooks: `useWebSocket`, `useMediaCapture`, `useAudioPlayback`
- AudioWorklet processors for mic capture (16kHz PCM16) and playback (24kHz PCM16)
- Camera captures at 1 FPS as JPEG, sent as base64 in LiveRequest blob
- Vite dev server proxies `/run_live` (WebSocket) and `/api` to backend:8000
- Text input fallback for typing moves/messages when mic isn't available
- Game state polled every 3s from `/api/game-state` REST endpoint
- Session created via POST `/api/session/{userId}/{sessionId}` before WebSocket connect
- Auto-reconnect on WebSocket close (up to 5 attempts, 2s delay)

## Phase 5: Personality & Polish (Days 9–11 | March 9–11)

- [ ] Tune agent personality — competitive but friendly chess opponent
- [ ] Add trash talk and commentary to agent responses
- [ ] Choose a distinct voice (from Puck, Charon, Kore, Fenrir, Aoede, Leda, Orus, Zephyr)
- [ ] Add graceful error handling ("I can't see the board clearly, could you adjust the camera?")
- [ ] Add rules grounding via Google Search tool (settle disputes)
- [ ] Add a second simple game (Connect Four) for demo variety
- [ ] Polish frontend UI — clean layout, responsive design

## Phase 6: Deployment & Submission (Days 11–14 | March 11–14)

- [ ] Deploy to Google Cloud Run via `adk deploy cloud_run`
- [ ] Test deployed version end-to-end
- [ ] Create Terraform/IaC scripts in `infra/` (bonus points)
- [ ] Record demo video (under 4 minutes, real working software)
- [ ] Create architecture diagram (`docs/architecture.png`)
- [ ] Write text description of features and technologies
- [ ] Publish blog post with `#GeminiLiveAgentChallenge` (bonus)
- [ ] Sign up for GDG and link profile (bonus)
- [ ] Final README polish with deployment instructions
- [ ] Submit to DevPost

---

## Hackathon Submission Checklist

### Required

- [ ] Public GitHub repo with spin-up instructions in README
- [ ] Architecture diagram in `docs/architecture.png`
- [ ] Demo video (< 4 min) showing real working software (no mockups)
- [ ] Proof of GCP deployment (screen recording or code file)
- [ ] Text description of features and technologies

### Bonus (Do All Three)

- [ ] Blog post / content with `#GeminiLiveAgentChallenge`
- [ ] Terraform / IaC scripts in `infra/` for automated deployment
- [ ] GDG profile link

---

## Technical Risks & Unknowns

### HIGH PRIORITY — Investigate Early

1. **Board detection accuracy**: Can Gemini reliably identify chess piece positions from a webcam image? Need to test with various lighting conditions, board styles, and camera angles. If unreliable, we may need to simplify (e.g., show the board on a screen instead of physical).

2. **2-minute video session limit**: Audio+video sessions cap at 2 min. Must implement session resumption via ADK RunConfig early — this is table stakes. Audio-only has a 15 min limit, so fallback to audio-only with periodic camera snapshots is an option.

3. **ADK Live API model ID**: The model ID `gemini-live-2.5-flash-preview-native-audio` may change. Verify the latest working model ID before building. Check ADK docs and release notes.

4. **WebSocket ↔ ADK bridging**: How exactly to bridge the browser WebSocket to ADK's `run_live()` and `LiveRequestQueue`. Study the `bidi-demo` sample code closely.

### MEDIUM PRIORITY

5. **FEN extraction reliability**: Going from a camera image to a valid FEN string is a multi-step process. May need to prompt-engineer heavily or use a two-pass approach (first identify pieces, then map to squares).

6. **Audio latency**: End-to-end latency from user speech → agent response must feel conversational. Test early on Cloud Run to catch deployment-specific latency issues.

7. **Cloud Run cold starts**: ADK on Cloud Run may have significant cold start times. Consider keep-alive strategies or minimum instance configuration.

### LOW PRIORITY

8. **Connect Four as second game**: Only if chess works well. Don't scope-creep.
9. **Multiple personality personas**: Nice-to-have. Focus on one good chess persona first.
