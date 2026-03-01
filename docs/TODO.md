# Ghost Player — Build Plan & TODO

> **Hackathon**: Gemini Live Agent Challenge
> **Deadline**: March 16, 2026
> **Track**: Live Agents
> **Start Date**: March 1, 2026

---

## Phase 1: Scaffolding (Days 1–2 | March 1–2)

- [x] Write research report and CLAUDE.md
- [x] Create project scaffolding (backend + frontend)
- [x] Set up ADK agent package (`backend/ghost_player/`)
- [x] Create minimal `root_agent` with Gemini Live model
- [x] Scaffold React + Vite + TypeScript frontend
- [x] Set up Tailwind CSS
- [x] Create landing page with placeholder UI sections
- [x] Write project README with quick-start instructions
- [ ] Verify `adk web` loads the agent in dev UI
- [ ] Verify frontend dev server runs

## Phase 2: Core Agent — Voice & Vision (Days 3–5 | March 3–5)

- [ ] Get basic voice interaction working via `adk web` (speak to agent, hear response)
- [ ] Build vision streaming tool — accept `LiveRequestQueue`, process camera frames
- [ ] Test vision tool: point camera at chessboard, confirm agent describes what it sees
- [ ] Build board state parser — extract piece positions from Gemini vision output
- [ ] Define structured game state format (FEN string for chess)
- [ ] Wire up session resumption for 2-min video session limit (ADK RunConfig)

## Phase 3: Game Engine (Days 5–7 | March 5–7)

- [ ] Build chess tools using python-chess:
  - [ ] `get_legal_moves(fen: str)` — returns legal moves for current position
  - [ ] `evaluate_position(fen: str)` — basic position evaluation
  - [ ] `suggest_move(fen: str, difficulty: str)` — pick a move at given difficulty
  - [ ] `validate_move(fen: str, move: str)` — check if a move is legal
- [ ] Integrate vision → game engine pipeline: camera sees board → FEN → move suggestion
- [ ] Agent speaks its move and waits for human to play
- [ ] Handle turn tracking (whose turn is it?)

## Phase 4: Frontend Integration (Days 7–9 | March 7–9)

- [ ] Set up WebSocket connection between frontend and backend
- [ ] Stream webcam video from browser to backend via WebSocket
- [ ] Stream audio from browser mic to backend
- [ ] Play agent audio responses in browser
- [ ] Display game state in frontend (board position, move history)
- [ ] Display chat/transcript log with agent messages
- [ ] Wire up mic toggle and camera toggle buttons
- [ ] Build FastAPI WebSocket endpoint that bridges to ADK `run_live()`

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
