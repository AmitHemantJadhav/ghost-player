# Ghost Player — AI Board Game Opponent

Real-time AI agent that watches a physical board game through a camera, plays as an opponent, and talks to players naturally. Built for the **Gemini Live Agent Challenge** hackathon (deadline: March 16, 2026).

## Project Context

Read `docs/Ghost_Player_Research_Report.md` for full hackathon requirements, architecture decisions, and technical research before making any major changes.

## Tech Stack

- **Backend**: Python 3.11+, FastAPI, Google ADK (Agent Development Kit)
- **AI Model**: Gemini Live API (`gemini-live-2.5-flash-preview-native-audio` or latest live model)
- **Frontend**: React + TypeScript (webcam/audio capture, game state display)
- **Game Logic**: `python-chess` for chess, custom tools for other games
- **Deployment**: Google Cloud Run
- **Session Storage**: In-memory for dev, Firestore for prod

## Architecture

Multi-agent system using ADK:

- `agents/coordinator.py` — Root agent that orchestrates the others
- `agents/vision.py` — Streaming tool that analyzes board via camera frames using `LiveRequestQueue`
- `agents/game_engine.py` — Computes moves using python-chess or custom game tools
- `agents/personality.py` — Generates trash talk, commentary, persona responses
- `agents/rules.py` — Grounded rule lookups via Google Search tool

Frontend is in `frontend/`. Backend is in `backend/`.

## Commands

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
adk web                          # Dev UI with voice/video (http://localhost:8000)
adk run ghost_player             # Terminal mode

# Frontend
cd frontend
npm install
npm run dev                      # React dev server (http://localhost:3000)

# Deploy
adk deploy cloud_run --project=$GOOGLE_CLOUD_PROJECT --region=us-central1 --with_ui

# Test
cd backend && python -m pytest tests/
```

## Code Standards

- Python: type hints on all functions, docstrings on agents and tools
- Use `async`/`await` throughout — ADK streaming is async
- ADK tools are plain Python functions with docstrings (ADK uses the docstring for the LLM)
- Never hardcode API keys — use `.env` files and `GOOGLE_API_KEY` env var
- Frontend: functional React components, Tailwind CSS, no `any` types in TypeScript

## Key Constraints

- Gemini Live API processes video at **1 FPS** — fine for board games, design around it
- Audio+video sessions limited to **2 min** — implement session resumption via ADK RunConfig
- Audio-only sessions limited to **15 min**
- ADK streaming tools must be `async` generators returning `AsyncGenerator[str, None]`
- Video streaming tools must accept `input_stream: LiveRequestQueue` as a parameter
- The `root_agent` variable name is required by ADK — don't rename it
- `__init__.py` must contain `from . import agent` for ADK to find the agent

## Hackathon Submission Checklist

All of these must exist before submission:

- [ ] Public GitHub repo with spin-up instructions in README
- [ ] Architecture diagram in `docs/architecture.png`
- [ ] Demo video (<4 min) showing real working software
- [ ] Proof of GCP deployment (screen recording or code file)
- [ ] Text description of features and technologies
- [ ] Blog post with `#GeminiLiveAgentChallenge` (bonus)
- [ ] Terraform/IaC scripts in `infra/` (bonus)
- [ ] GDG profile link (bonus)

## Important Files

- `docs/Ghost_Player_Research_Report.md` — Full research, architecture, and roadmap
- `backend/ghost_player/agent.py` — Main agent definition with `root_agent`
- `backend/ghost_player/.env` — API keys (never commit)
- `frontend/src/App.tsx` — Main React app with webcam/audio
- `infra/` — Terraform scripts for Cloud Run deployment
