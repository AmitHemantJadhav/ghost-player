# Ghost Player

Real-time AI agent that watches a physical board game through a webcam, plays as an opponent, and talks to players using voice. Built with Google ADK and the Gemini Live API for the [Gemini Live Agent Challenge](https://geminiliveagentchallenge.devpost.com/).

> **Status**: Hackathon project in active development. Deadline: March 16, 2026.

## Prerequisites

- Python 3.11+
- Node.js 18+
- [Google ADK](https://google.github.io/adk-docs/) (`pip install google-adk`)
- A Google API key with Gemini API access

## Quick Start

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Add your API key
echo "GOOGLE_API_KEY=your-key-here" > ghost_player/.env

# Launch the ADK dev UI (opens at http://localhost:8000)
adk web
```

Select **ghost_player** from the agent dropdown in the ADK dev UI. You can talk to the agent using the built-in mic/speaker controls.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Opens at [http://localhost:3000](http://localhost:3000).

## Project Structure

```
ghost-player/
├── backend/
│   ├── ghost_player/        # ADK agent package
│   │   ├── __init__.py      # Required: from . import agent
│   │   ├── agent.py         # root_agent definition
│   │   └── .env             # GOOGLE_API_KEY (not committed)
│   └── requirements.txt
├── frontend/                # React + TypeScript + Tailwind
│   └── src/
│       ├── App.tsx          # Main UI
│       ├── hooks/           # WebSocket hook (WIP)
│       └── types/           # TypeScript interfaces
├── docs/
│   ├── Ghost_Player_Research_Report.md
│   └── TODO.md              # Build plan and task tracking
└── README.md
```

## Tech Stack

- **Backend**: Python, FastAPI, Google ADK
- **AI Model**: Gemini Live API (native audio + vision)
- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **Game Logic**: python-chess
- **Deployment**: Google Cloud Run
