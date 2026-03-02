# Ghost Player — Build Plan & TODO

> **Hackathon**: Gemini Live Agent Challenge
> **Deadline**: March 16, 2026
> **Track**: Live Agents
> **Start Date**: March 1, 2026
> **Today**: March 2, 2026 — 14 days remaining

---

## Judging Criteria (Weight)

| Criterion | Weight | Key Evidence |
|-----------|--------|--------------|
| Innovation & Multimodal UX | 40% | Breaks text-box, live context-aware, distinct persona |
| Technical Implementation | 30% | ADK/GenAI depth, GCP services, agent logic, grounding |
| Demo & Presentation | 30% | Architecture diagram, deployment proof, working video |

---

## ✅ Phase 1: Scaffolding (Days 1–2 | March 1–2) DONE

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

---

## ✅ Phase 2: Core Agent — Voice & Vision (Days 3–5 | March 3–5) DONE

- [x] Get basic voice interaction working via `adk web`
- [x] Build vision streaming tool — process camera frames via shared frame buffer
- [x] Build board state parser — FEN extraction via Gemini 2.5 Flash
- [x] Build chess tools using python-chess (`get_game_status`, `get_legal_moves`, `validate_move`, `suggest_move`)
- [x] Minimax engine with alpha-beta pruning (easy/medium/hard difficulty)

### Notes
- Vision tool uses separate `gemini-2.5-flash` model (not the live model)
- Camera frames intercepted in server.py → shared buffer → vision tool reads
- Chess engine in `backend/ghost_player/tools/chess_engine.py`

---

## ✅ Phase 3: Game Engine Integration (Days 5–7 | March 5–7) DONE

- [x] Tune vision prompts for reliable FEN extraction across board styles/lighting
- [x] Add move history tracking
- [x] Handle edge cases: hand blocking camera, board rotated, unclear position
- [x] Add verbal move input fallback (`apply_move` — accepts SAN or UCI)
- [x] Tune difficulty selection (player changes mid-game via voice)
- [x] `set_difficulty`, `reset_game`, `get_move_history` tools

### Notes
- Shared game state: `backend/ghost_player/tools/game_state.py`
- Vision tool wired to GameState — detected moves auto-recorded in history

---

## ✅ Phase 4: Frontend Integration (Days 7–9 | March 7–9) DONE

- [x] FastAPI WebSocket server bridging browser ↔ ADK `run_live()`
- [x] Stream webcam video from browser to backend (base64 JPEG)
- [x] Stream mic audio from browser to backend (PCM16 16kHz via AudioWorklet)
- [x] Play agent audio responses (24kHz PCM via scheduled AudioBufferSourceNodes)
- [x] Display chess board (FEN → Unicode pieces, CSS grid)
- [x] Display move history (paired white/black)
- [x] Session create → WebSocket connect flow
- [x] Auto-reconnect on transient disconnect

### Notes
- Vite proxies `/run_live` (WS) and `/api` to backend:8000
- `useWebSocket`, `useMediaCapture`, `useAudioPlayback` hooks
- Video frames intercepted server-side before reaching Live API

---

## ✅ Phase 5: Personality & Polish (Days 9–11 | March 9–11) DONE

- [x] Spectral chess master persona with dry wit and competitive edge
- [x] Fenrir voice via RunConfig SpeechConfig
- [x] Rules grounding via `lookup_chess_rules` (Gemini 2.5 Flash + Google Search)
- [x] Ghost branding, emerald accent, polished board UI
- [x] Last-move highlight, check highlight, game-over overlay

---

## ✅ Phase 6a: Voice Experience Overhaul (March ~11) DONE

- [x] Barge-in / interruption support (stops playback on `interrupted` event)
- [x] Real-time game state push via WebSocket broadcast (no more polling)
- [x] Board-centric two-column layout (board left, info right)
- [x] Waveform indicator when mic active
- [x] Animated ghost icon when agent is speaking

---

## 🔴 Phase 6b: Critical Bug Fix — Session Resumption (March 3 | 1 day)

> **DEMO-KILLER**: Audio+video sessions cap at 2 minutes. Without this, the
> demo dies mid-session in front of judges. Fix this before everything else.

- [ ] Read ADK docs for session resumption via `RunConfig` (reconnection token)
- [ ] Implement automatic session reconnect in `server.py` when the Live API
      closes the stream at the 2-min mark
- [ ] On reconnect: reuse the same `session_id` so game state is preserved
- [ ] Test: start a game, let it run 3+ minutes, verify seamless continuation
- [ ] Frontend: handle brief reconnect gap gracefully (no error flash to user)

### Notes
- ADK `RunConfig` has a `resume_supported` / token mechanism — check latest ADK docs
- The `InMemorySessionService` keeps session alive on the Python side; only the
  Live API WebSocket needs to be re-established
- Worst case: implement keep-alive pings to reset the 2-min timer

---

## 🟠 Phase 7: High-Impact Features (March 4–7 | ~4 days)

These directly address the **Innovation & Multimodal UX (40%)** criterion.

### 7a: Visual Evaluation Bar (0.5 days)

The minimax engine already computes a score — expose it in the UI.

- [ ] In `suggest_move`, add `score` to the returned dict (already computed internally)
- [ ] In `game_state.py`, track `evaluation_score: int` — updated on every AI move
- [ ] Add `evaluation_score` to `GameState.snapshot()` so it broadcasts via WebSocket
- [ ] In `App.tsx`, render a thin horizontal bar above the chess board:
      - Centered = even, white side fills left, black side fills right
      - Color: white side = gray-200, black side = gray-700, emerald accent at center
      - Label: current evaluation in pawns (score / 100), capped at ±10
- [ ] Animate bar transitions with CSS transition

### 7b: Opening Book Recognition (1 day)

When the agent names a player's opening, it feels genuinely context-aware.

- [ ] Create `backend/ghost_player/tools/openings.py`
- [ ] Embed a compact opening book dict: `{moves_tuple: (name, eco_code)}` covering
      ~50 most common openings (Ruy López, Sicilian, French, King's Indian, etc.)
- [ ] Add `recognize_opening(move_history: list[str]) -> dict` tool
      - Input: list of UCI moves played so far
      - Returns: `{name, eco, description}` or `{name: "Unknown opening"}`
- [ ] Agent instruction: call `recognize_opening` after moves 2–6 and weave the
      name into commentary naturally: *"Ah, the Sicilian Defense. You've done your homework."*
- [ ] Test with 10 common openings

### 7c: Coach Mode (2 days)

Transforms Ghost Player from a novelty into a genuinely useful product.

- [ ] Add `coach_mode: bool = False` to `GameState`
- [ ] Add `toggle_coach_mode() -> dict` ADK tool:
      - Toggles the flag, broadcasts state, returns confirmation
- [ ] Update agent instruction: detect player saying "teach me", "coach mode",
      "explain your moves", "go easy and explain" → call `toggle_coach_mode()`
- [ ] In coach mode, after every move (detected by vision OR verbal), agent should:
      1. Confirm the move: "You played e4."
      2. Evaluate it: "That controls the center — good instinct."
      3. Name the threat or idea: "Watch out — I can now develop my bishop to c5."
      4. Suggest what to think about next: "Consider developing your knight before moving pawns."
- [ ] `suggest_move` in coach mode: agent explains its own move after playing it
- [ ] Add `coach_mode` to GameState snapshot → frontend shows "Coach Mode" badge
- [ ] Test full coaching flow for 10 moves

### 7d: Post-Game Analysis (0.5 days)

Memorable and shows the agent understands the full game narrative.

- [ ] After `is_game_over` becomes true, agent automatically calls `get_move_history()`
- [ ] Add `analyze_game(move_history) -> dict` tool:
      - Scans history for: biggest material swing, longest move streak, blunders
        (move where eval dropped > 300cp), and move count by phase (opening/mid/end)
      - Returns a structured summary dict
- [ ] Agent delivers a 2–3 sentence verbal post-game review based on the analysis:
      - If player won: genuine congratulations + one specific observation
      - If player lost: graceful acknowledgement + one teaching point
      - If draw: acknowledge the fight
- [ ] Frontend: post-game overlay already exists — add a "Game Analysis" subtitle
      line with the key insight (e.g., "Turning point: move 14 Bxf7+")

---

## 🟡 Phase 8: Technical Depth — ADK & GCP (March 8–10 | ~3 days)

These address **Technical Implementation (30%)** — shows ADK mastery and GCP breadth.

### 8a: Multi-Agent ADK Architecture (2 days)

Currently a single agent with tools. Refactoring to proper sub-agents demonstrates
ADK expertise and earns technical points.

- [ ] Create `backend/ghost_player/agents/` directory
- [ ] Move rules tool into a dedicated `RulesAgent`:
      ```python
      rules_agent = Agent(
          name="chess_rules_expert",
          model="gemini-2.5-flash",
          description="Looks up chess rules via Google Search grounding",
          tools=[google_search],
          instruction="Answer chess rule questions accurately, citing FIDE rules."
      )
      ```
- [ ] Move personality/commentary generation into a `PersonalityAgent`:
      ```python
      personality_agent = Agent(
          name="ghost_personality",
          model="gemini-2.5-flash",
          description="Generates Ghost Player's personality responses",
          instruction="You are Ghost Player — spectral chess master..."
      )
      ```
- [ ] Wire sub-agents as tools on the root agent using `agent_as_tool`:
      ```python
      root_agent = Agent(
          tools=[
              analyze_board, suggest_move, apply_move, ...,
              agent_as_tool(rules_agent),
              agent_as_tool(personality_agent),
          ]
      )
      ```
- [ ] Update agent instruction to delegate rule questions to rules agent and
      commentary generation to personality agent
- [ ] Test: ask a rules question → confirm rules_agent is invoked in ADK trace
- [ ] Update architecture diagram to show multi-agent structure

### 8b: Firestore Session Storage (0.5 days)

Replaces InMemorySessionService — adds a second GCP service, enables multi-session.

- [ ] Enable Firestore in GCP project (Native mode, us-central1)
- [ ] In `server.py`, swap session service:
      ```python
      from google.adk.sessions import FirestoreSessionService
      session_service = FirestoreSessionService(project_id=GCP_PROJECT)
      ```
- [ ] Add `GOOGLE_CLOUD_PROJECT` to `.env` and Cloud Run env vars
- [ ] Test: create session, disconnect, reconnect with same session_id,
      verify game state persists
- [ ] Update Terraform to provision Firestore database (see Phase 9a)

### 8c: Frame Preprocessing for Better Board Detection (0.5 days)

Improves vision reliability in real demo conditions (imperfect lighting, angle).

- [ ] Add `Pillow` to `requirements.txt`
- [ ] In `vision.py`, add `_preprocess_frame(frame_bytes: bytes) -> bytes`:
      - Enhance contrast using `ImageEnhance.Contrast(img).enhance(1.4)`
      - Sharpen slightly: `ImageEnhance.Sharpness(img).enhance(1.2)`
      - Normalize brightness: histogram equalize if mean < 80 or > 180
      - Re-encode as JPEG at quality 85
- [ ] Apply preprocessing before every `_analyze_frame()` call
- [ ] Test: capture frame under dim lighting, verify detection improves
- [ ] Add image dimensions to vision request (helps Gemini orient the board)

---

## 🟡 Phase 9: UI Polish & Demo Readiness (March 11–12 | ~2 days)

These address **Demo & Presentation (30%)** — makes the demo video compelling.

### 9a: Captured Pieces Display (0.5 days)

Standard chess UI element — makes the board panel look complete.

- [ ] In `game_state.py`, compute `captured_by_white` and `captured_by_black`
      by diffing consecutive FEN positions in move history
- [ ] Add to `GameState.snapshot()`: `{"captured_by_white": ["p","p","n"], ...}`
- [ ] In `App.tsx` / `ChessBoard.tsx`, render captured pieces above/below the board:
      - White's captures (black pieces) shown above board
      - Black's captures (white pieces) shown below board
      - Use the PIECE_MAP unicode chars, gray-400 color, small size

### 9b: Move Animation (0.5 days)

Makes the demo video dramatically more compelling when a move is detected.

- [ ] In `ChessBoard.tsx`, track `previousFen` and `currentFen` as props
- [ ] When `lastMove` changes, add a CSS `translate` animation on the moved piece:
      - Piece starts at `from` square position, animates to `to` square over 300ms
      - Use CSS `@keyframes piece-slide` with `transform: translate()`
- [ ] Add piece capture flash: `to` square briefly flashes red when a capture occurs
- [ ] Ensure animation doesn't break when rapid moves arrive

### 9c: Demo Fallback / Watch Mode (1 day)

A safety net for when demo conditions are bad — ensures the video is perfect.

- [ ] Create `backend/ghost_player/demo_games.py` with 3 famous short games:
      - Fool's Mate (2 moves — shows checkmate detection)
      - Immortal Game highlights (Anderssen vs Kieseritzky, 1851)
      - One modern grandmaster game with tactical fireworks
- [ ] Add `GET /api/demo/games` endpoint — returns list of available demo games
- [ ] Add `POST /api/demo/play/{game_id}` endpoint — starts replaying a game:
      - Applies moves one at a time with 3-second delay
      - Uses `game_state.record_move()` so state broadcasts normally
      - Agent receives game state updates and comments live
- [ ] In frontend, add "Watch Demo Game" button (visible only when game not started)
- [ ] On click: fetch game list, let user pick, start playback
- [ ] Agent instruction: when in demo playback, provide rich commentary on each move

### 9d: Mobile Camera Optimization (0.5 days)

Phone cameras are better for board detection than laptop webcams — optimize for mobile.

- [ ] In `useMediaCapture.ts`, prefer back camera on mobile:
      ```ts
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }
      ```
- [ ] Increase JPEG quality to 0.85 for mobile (better cameras can handle it)
- [ ] In `App.tsx`, make layout stack vertically on small screens:
      board fills width, info panel below
- [ ] Add PWA manifest so the app can be "installed" on mobile for a cleaner demo

---

## 🟢 Phase 10: Infrastructure & Deployment (March 12–13 | ~2 days)

### 10a: Terraform IaC in `infra/` (1 day)

Bonus points item — also shows production-readiness to judges.

- [ ] Create `infra/main.tf`:
      - Provider: `google` with project and region vars
      - Cloud Run service: `ghost_player_api` with container, env vars, min instances
      - Firestore database (Native mode)
      - Secret Manager secret for `GOOGLE_API_KEY`
      - IAM bindings: Cloud Run SA → Firestore reader, Secret Manager accessor
      - Artifact Registry repo for Docker images
- [ ] Create `infra/variables.tf` and `infra/outputs.tf`
- [ ] Create `infra/README.md` with: `terraform init && terraform apply`
- [ ] Create `Dockerfile` in `backend/` for Cloud Run container
- [ ] Create `frontend/Dockerfile` or integrate frontend build into backend static serving
- [ ] Test: `terraform plan` runs without errors on a clean GCP project

### 10b: Cloud Run Deployment (0.5 days)

- [ ] Deploy via `adk deploy cloud_run` OR from the Terraform-built container
- [ ] Set min instances to 1 (avoid cold start killing demo)
- [ ] Set memory to 1Gi (vision model calls need headroom)
- [ ] Configure Cloud Run to serve frontend static files from the same service
      (or deploy frontend to Firebase Hosting — simpler)
- [ ] Test deployed version end-to-end: mic, camera, board detection, AI move
- [ ] Screen-record the Cloud Run deployment as proof for submission

### 10c: Architecture Diagram (0.5 days)

Required submission deliverable — must be polished.

- [ ] Create `docs/architecture.png` using Excalidraw, Lucidchart, or draw.io
- [ ] Show all components:
      - Browser (mic, camera, speaker, React UI)
      - WebSocket transport
      - FastAPI server on Cloud Run
      - ADK Runner + LiveRequestQueue
      - Ghost Player Agent (root) + sub-agents (Rules, Personality)
      - Gemini Live API (voice)
      - Gemini 2.5 Flash (vision analysis, rules lookup)
      - Google Search (grounding)
      - Firestore (sessions)
      - Frame buffer (camera path separate from Live API audio path)
- [ ] Color code: Google Cloud services in blue, AI calls in purple, user in green
- [ ] Export as PNG at 2x resolution

---

## 🟢 Phase 11: Submission Materials (March 14–16 | ~2 days)

### 11a: Demo Video (1 day)

- [ ] Script the 4-minute demo — practice 3 times before recording
- [ ] Scene 1 (30s): Show the app, open browser, point camera at chess board
- [ ] Scene 2 (60s): Ghost Player detects the starting position, player makes move,
      agent detects it via camera, responds with its move via voice
- [ ] Scene 3 (60s): Demonstrate coach mode — agent teaches as it plays
- [ ] Scene 4 (30s): Ask a rules question — agent looks it up via Google Search
- [ ] Scene 5 (30s): Show evaluation bar, opening recognition, captured pieces
- [ ] Scene 6 (30s): Show the Cloud Run deployment URL in browser (proof of GCP)
- [ ] Ending (30s): Architecture diagram shown with voiceover explanation
- [ ] Record at 1080p, good lighting, physical chess board in frame
- [ ] Edit: trim silences, add captions for key feature callouts

### 11b: Blog Post (0.5 days)

Bonus points item.

- [ ] Platform: Dev.to or Medium (Dev.to preferred — technical audience)
- [ ] Title: "I built an AI ghost that watches my physical chess board and plays against me"
- [ ] Sections: Problem, Architecture (embed diagram), Key challenges (vision
      separation from Live API, session resumption, multi-agent ADK), Results, Lessons
- [ ] Embed the demo video
- [ ] Tag with `#GeminiLiveAgentChallenge` and `#GoogleADK`
- [ ] Publish before March 16

### 11c: Final README & Submission (0.5 days)

- [ ] README: add architecture diagram image, link to demo video, one-command setup
- [ ] Add `docker-compose.yml` for local one-command startup (bonus UX for judges)
- [ ] README sections: What it does, Demo video link, Quick start, Architecture,
      How it works, Tech stack, Deployment
- [ ] DevPost submission form:
      - Text description of features and technologies (500 words)
      - Public GitHub repo URL
      - Demo video URL
      - GCP deployment proof link/screenshot
      - Architecture diagram
      - Blog post URL
      - GDG profile URL
- [ ] Sign up for Google Developer Group and note profile URL
- [ ] Submit before March 16, 11:59 PM deadline

---

## Hackathon Submission Checklist

### Required

- [ ] Public GitHub repo with spin-up instructions in README
- [ ] Architecture diagram in `docs/architecture.png`
- [ ] Demo video (< 4 min) showing real working software (no mockups)
- [ ] Proof of GCP deployment (Cloud Run URL + screen recording)
- [ ] Text description of features and technologies

### Bonus (Do All Three)

- [ ] Blog post / content with `#GeminiLiveAgentChallenge`
- [ ] Terraform / IaC scripts in `infra/` for automated deployment
- [ ] GDG profile link

---

## Updated Timeline

| Dates | Phase | Focus |
|-------|-------|-------|
| March 3 | 6b | Session resumption (critical fix) |
| March 4–7 | 7 | Coach mode, opening recognition, eval bar, post-game |
| March 8–10 | 8 | Multi-agent ADK, Firestore, frame preprocessing |
| March 11–12 | 9 | Captured pieces, move animation, demo mode, mobile |
| March 12–13 | 10 | Terraform, Cloud Run deploy, architecture diagram |
| March 14–16 | 11 | Demo video, blog post, README, DevPost submission |

---

## Feature Priority by Judging Criterion

### Innovation & Multimodal UX (40%)
1. Coach mode — expands use case beyond novelty
2. Opening recognition — proves context-awareness
3. Post-game analysis — shows full-game comprehension
4. Visual evaluation bar — telegraphs strategic thinking
5. Move animation — makes the camera detection moment dramatic

### Technical Implementation (30%)
1. Session resumption — demo would literally break without it
2. Multi-agent ADK architecture — demonstrates framework mastery
3. Firestore sessions — second GCP service, shows production thinking
4. Frame preprocessing — improves real-world reliability
5. Terraform IaC — bonus + shows DevOps maturity

### Demo & Presentation (30%)
1. Architecture diagram — required, evaluated directly
2. Demo fallback / Watch Mode — safety net for live demo
3. Demo video — plan the script, shoot at 1080p
4. Blog post — bonus points
5. docker-compose for judges trying locally

---

## Technical Notes & Lessons Learned

- Vision model: separate `gemini-2.5-flash` call (not the live model) — live model can't handle video + audio
- Camera frames intercepted in server.py before reaching LiveRequestQueue
- ADK requires `root_agent` name and `from . import agent` in `__init__.py`
- Fenrir voice: configured via `RunConfig(speech_config=...)` only — no `response_modalities`
- Audio output: 24kHz PCM16; input: 16kHz PCM16 via AudioWorklet
- `InMemorySessionService` → Python session persists; only Live API WS needs reconnection
- Board detection reliability: HIGH confidence required before applying moves
- Minimax depth: easy=random, medium=depth 2, hard=depth 3 (depth 4+ too slow)
- FEN parsing for captured pieces: diff consecutive FENs piece counts
