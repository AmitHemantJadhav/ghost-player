# Ghost Player

> *A spectral chess master haunting your board for centuries — and annoyingly good at it.*

Real-time AI chess opponent that watches your physical board through a webcam,
plays as Black, and converses with you naturally using voice.
Built with **Google ADK** + **Gemini Live API** for the
[Gemini Live Agent Challenge](https://geminiliveagentchallenge.devpost.com/).

---

## Features

- **Real-time voice conversation** — Gemini Live API with Fenrir voice, barge-in supported
- **Physical board vision** — webcam → Gemini 2.5 Flash detects piece positions and moves
- **Multi-agent architecture** — root agent (Ghost Player) + chess rules sub-agent (Google Search grounded)
- **Chess engine** — minimax with alpha-beta pruning (easy / medium / hard)
- **Verbal fallback** — say your move aloud if the camera can't detect it
- **Coach mode** — ask Ghost to teach you; it explains every move
- **Opening recognition** — ~65 openings with ECO codes
- **Evaluation bar** — real-time material balance (centipawns)
- **Post-game analysis** — turning point detection, blunder flagging
- **Demo mode** — watch Scholar's Mate or the Opera Game replayed automatically

---

## Quick Start

### Option 1 — Docker Compose (one command)

```bash
# Add your Google API key first
echo "GOOGLE_API_KEY=your-key-here" > backend/ghost_player/.env

docker-compose up
```

Frontend: http://localhost:3000 | Backend: http://localhost:8000

### Option 2 — Manual

**Backend**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

echo "GOOGLE_API_KEY=your-key-here" > ghost_player/.env

uvicorn ghost_player.server:app --host 0.0.0.0 --port 8000 --reload
```

**Frontend**
```bash
cd frontend
npm install
npm run dev   # → http://localhost:3000
```

---

## How to Play

1. Open http://localhost:3000
2. Click **Mic** to start voice conversation
3. Say *"let's play"* — Ghost will ask camera or verbal mode
4. Click **Camera** and point it at your board, or just say your moves aloud
5. Ghost plays Black; you play White
6. Say *"teach me"* to enable coach mode
7. Ask any rules question — the chess rules sub-agent will look it up via Google Search

---

## Architecture

```
Browser (React + TypeScript)
  │  mic  →  PCM16 16kHz               camera → JPEG 1FPS
  │  speaker ← PCM16 24kHz             ↓
  └──── WebSocket (/run_live) ──────────┐
                                        │
        FastAPI  server.py              │
        ├─ Intercepts image blobs ──→  frame buffer (game_state.py)
        ├─ Audio/text ─────────────→  LiveRequestQueue → ADK Runner → Gemini Live API
        ├─ Keep-alive ping (90s) ───→  prevents 2-min timeout
        └─ Game state broadcast ────→  WebSocket push to all clients
                                        │
        ADK  root_agent  (Ghost Player) │
        │  model: gemini-2.5-flash-native-audio-preview
        │  tools: analyze_board, suggest_move, apply_move,
        │         get_game_status, get_legal_moves, validate_move,
        │         get_move_history, set_difficulty, reset_game,
        │         recognize_opening, toggle_coach_mode,
        │         analyze_game, stop_streaming
        │
        └── chess_rules_expert  (sub-agent via AgentTool)
               model: gemini-2.5-flash
               tools: lookup_chess_rules (Google Search grounded)
```

**Key design decision**: Video frames are intercepted by `server.py` and stored in a
shared in-process buffer. They are **never** sent to the Gemini Live API (the native
audio model can't handle video). The `analyze_board` tool reads from the buffer and
calls `gemini-2.5-flash` separately for vision analysis.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Agent framework | Google ADK 1.0 |
| Live voice model | `gemini-2.5-flash-native-audio-preview-12-2025` |
| Vision model | `gemini-2.5-flash` |
| Rules search | Gemini 2.5 Flash + Google Search grounding |
| Backend | Python 3.11, FastAPI, uvicorn |
| Game logic | python-chess (minimax alpha-beta) |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Deployment | Google Cloud Run |

---

## Cloud Deployment

```bash
# Build and deploy to Cloud Run
cd backend
gcloud run deploy ghost-player-backend \
  --source . \
  --region us-central1 \
  --set-env-vars GOOGLE_API_KEY=$GOOGLE_API_KEY \
  --allow-unauthenticated

# Or use ADK deploy
adk deploy cloud_run \
  --project=$GOOGLE_CLOUD_PROJECT \
  --region=us-central1 \
  --with_ui
```

---

## Project Structure

```
ghost-player/
├── backend/
│   ├── ghost_player/
│   │   ├── agent.py          # root_agent (Ghost Player voice+game loop)
│   │   ├── server.py         # FastAPI + WebSocket bridge to ADK run_live()
│   │   ├── demo_games.py     # Demo game replayer (Fool's Mate, Opera Game)
│   │   ├── agents/
│   │   │   └── rules_agent.py   # chess_rules_expert sub-agent
│   │   └── tools/
│   │       ├── chess_engine.py  # minimax + chess tools
│   │       ├── vision.py        # webcam → Gemini vision → move detection
│   │       ├── game_state.py    # shared GameState singleton
│   │       ├── openings.py      # ~65 opening book entries
│   │       └── rules.py         # lookup_chess_rules (Google Search)
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # main UI
│   │   ├── components/ChessBoard.tsx
│   │   └── hooks/               # useWebSocket, useMediaCapture, useAudioPlayback
│   ├── Dockerfile
│   └── nginx.conf
├── docs/
│   ├── Ghost_Player_Research_Report.md
│   └── TODO.md
├── docker-compose.yml
└── README.md
```

---

## Demo Mode

On the idle screen, click **▶ Scholar's Mate** or **▶ Opera Game** to watch an
automated game replay (moves applied every 2.5 seconds with live board updates).
Useful for demos without a physical chess board.

---

## Prerequisites

- Python 3.11+
- Node.js 20+
- Google API key with Gemini API access enabled
- (Optional) webcam for physical board detection
