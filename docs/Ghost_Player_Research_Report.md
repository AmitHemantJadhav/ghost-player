# Ghost Player — Hackathon Research & Technical Blueprint

## 1. Hackathon Requirements Summary

### Mandatory Technical Requirements

- **Must use a Gemini model** (e.g., `gemini-live-2.5-flash-preview-native-audio` for Live API)
- **Must be built with Google GenAI SDK OR Agent Development Kit (ADK)**
- **Must use at least one Google Cloud service** (e.g., Cloud Run for hosting)
- **Must comply with Google Cloud Acceptable Use Policy**

### Submission Deliverables

- Text description of features, technologies, and learnings
- Public code repository with spin-up instructions in README
- Proof of Google Cloud deployment (screen recording or code file showing GCP usage)
- Architecture diagram
- Demo video (under 4 minutes, real working software — no mockups)

### Bonus Points (Do All Three)

- Publish content (blog/video) about the build process with `#GeminiLiveAgentChallenge`
- Automate cloud deployment with scripts or infrastructure-as-code (included in repo)
- Sign up for a Google Developer Group and link your public GDG profile

### Judging Criteria

- **Innovation & Multimodal UX (40%):** Does it break the "text box"? Does it see, hear, speak seamlessly? Distinct persona/voice? Live and context-aware?
- **Technical Implementation (30%):** Effective use of GenAI SDK/ADK? Robust GCP hosting? Sound agent logic? Error handling? Grounding to avoid hallucinations?
- **Demo & Presentation (30%):** Clear problem/solution? Architecture diagram? Cloud deployment proof? Actual working software shown?

### Category: Live Agents 🗣️

Ghost Player fits the **Live Agents** track perfectly:

- Real-time interaction via audio and vision
- Users can talk naturally and interrupt (barge-in)
- Mandatory tech: Gemini Live API or ADK, hosted on Google Cloud

---

## 2. What is Google ADK?

Agent Development Kit (ADK) is Google's open-source framework for building and deploying AI agents. It's the same framework powering agents inside Google products like Agentspace.

### Why Use ADK (Instead of Raw Live API)

The raw Live API requires you to manually manage WebSocket connections, tool execution, reconnection logic, session persistence, and concurrent audio stream coordination. ADK abstracts all of this:

- **Tools execute automatically** — define Python functions, ADK handles invocation lifecycle
- **Connections resume transparently** when WebSocket timeouts occur
- **Sessions persist** to your choice of database with zero custom code
- **Built-in streaming** — bidirectional audio and video via `run_live()`
- **Multi-agent orchestration** — Sequential, Parallel, and Loop workflow agents
- **One-command deployment** to Cloud Run: `adk deploy cloud_run`

### Core ADK Concepts

- **Agent**: Defined with a name, model, instructions, and tools
- **Tools**: Python functions, Google Search, MCP tools, OpenAPI specs, or other agents
- **Runner**: Orchestrates agent execution
- **SessionService**: Manages conversational state (in-memory for dev, database for prod)
- **LiveRequestQueue**: Thread-safe async FIFO buffer that decouples WebSocket input from model consumption

### ADK + Live API Streaming Architecture

```
User (Browser) → WebSocket → FastAPI Server → LiveRequestQueue → ADK Runner → Gemini Live API
                                                                    ↓
                                                              Tool Execution
                                                                    ↓
                                                          Audio/Text Response ← Gemini
```

### Key Code Pattern (Python)

```python
from google.adk.agents import Agent
from google.adk.tools import google_search

root_agent = Agent(
    name="ghost_player",
    model="gemini-live-2.5-flash-preview-native-audio",  # verify latest model ID
    description="AI board game opponent that sees the board and talks to players",
    instruction="You are a competitive but friendly board game player...",
    tools=[google_search, analyze_board, suggest_move]
)
```

### Streaming Tools (Critical for Ghost Player)

ADK supports **video streaming tools** — async generators that receive the live video stream:

```python
async def monitor_board_state(
    input_stream: LiveRequestQueue,
) -> AsyncGenerator[str, None]:
    """Continuously watches the board via camera and tracks game state."""
    # Pull latest frames from input_stream
    # Analyze board position using Gemini vision
    # Yield updates when board state changes
```

This is the mechanism Ghost Player would use to watch the physical board.

---

## 3. Gemini Live API Capabilities

### What It Does

- Enables low-latency, bidirectional voice and video interactions
- Processes continuous streams of audio, video, or text
- Delivers immediate, human-like spoken responses
- Supports natural interruption (barge-in)

### Technical Specs

- **Audio input**: 16-bit PCM, 16kHz, mono
- **Audio output**: 24kHz sample rate
- **Video input**: Processed at 1 FPS (not suitable for fast-moving video like sports)
- **Session limits**: Audio-only: 15 min; Audio+video: 2 min (but configurable with session resumption)
- **Supported voices**: Puck, Charon, Kore, Fenrir, Aoede, Leda, Orus, Zephyr
- **Languages**: 24+ supported languages
- **Features**: VAD, barge-in, affective dialog, function calling, Google Search grounding, audio transcription

### Vision Capabilities (Key for Ghost Player)

- Gemini can detect objects, return bounding box coordinates, and segment items in images
- Can reason over visual content with natural language prompts
- Supports custom object detection via prompts (no retraining needed)
- Example: "Identify all chess pieces on the board and their positions"

### Important Constraint

Video is processed at **1 FPS** — fine for board games (static scenes) but not for fast-action scenarios. This is actually an advantage for our use case since board states change slowly.

---

## 4. Ghost Player — Technical Architecture

### Concept

Point your phone/webcam at a physical board game. The agent watches the board through the camera, understands the game state via Gemini's vision capabilities, plays as a real opponent by speaking its moves, and engages in natural conversation (trash talk, strategy discussion, coaching).

### Multi-Agent Design (for extra technical points)

```
┌─────────────────────────────────────────────────┐
│                  Root Agent                       │
│           (ghost_player_coordinator)              │
├────────────┬──────────────┬─────────────────────┤
│            │              │                       │
▼            ▼              ▼                       ▼
Vision     Game Engine    Personality          Rules Agent
Agent      Agent          Agent               (grounding)
│            │              │                       │
│ Analyzes   │ Computes     │ Generates trash     │ Looks up
│ board via  │ best moves   │ talk, commentary,   │ rules via
│ camera     │ via game     │ persona responses    │ Google
│ frames     │ logic tools  │                     │ Search
└────────────┴──────────────┴─────────────────────┘
```

### Proposed Agent Breakdown

1. **Vision Agent** (streaming tool)
   - Receives video frames via `LiveRequestQueue`
   - Uses Gemini vision to identify board state (piece positions, card layouts, etc.)
   - Yields structured game state updates

2. **Game Engine Agent**
   - Takes structured board state as input
   - Has tools for game-specific logic (chess engine via python-chess, Catan probability calculator, etc.)
   - Computes optimal or interesting moves
   - Returns move decisions

3. **Personality Agent**
   - Takes game state + move decision
   - Generates natural speech: trash talk, commentary, reactions
   - Handles barge-in for when players interrupt
   - Distinct voice/persona per game (e.g., pirate captain for risk, wise wizard for chess)

4. **Rules Agent**
   - Grounded with Google Search for rule lookups
   - Handles disputes: "Actually, in Catan you can't trade with the bank unless..."
   - Reduces hallucination risk (addresses judging criteria)

### Supported Games (Start with 1-2, expandable)

- **Chess** — most visually distinct, strong existing engines (python-chess)
- **Settlers of Catan** — complex enough to be impressive, involves negotiation
- **Uno** — accessible, good for demo
- **Connect Four** — simple, very visual, easy to detect

**Recommendation**: Start with **Chess** — it's visually the clearest for detection and has the richest strategic commentary potential. Add a simpler game like **Connect Four** for demo variety.

### Technology Stack

| Layer           | Technology                                             |
| --------------- | ------------------------------------------------------ |
| Frontend        | React web app (webcam + audio capture)                 |
| Transport       | WebSocket (bidirectional)                              |
| Backend         | FastAPI + ADK Bidi-streaming                           |
| AI Model        | `gemini-live-2.5-flash-preview-native-audio`           |
| Game Logic      | python-chess (for chess), custom tools for other games |
| Hosting         | Google Cloud Run                                       |
| Session Storage | Firestore or in-memory                                 |
| Deployment      | `adk deploy cloud_run` (or Terraform for bonus points) |

### Architecture Diagram (for submission)

```
┌──────────────┐     WebSocket      ┌───────────────────┐
│   Browser    │◄──────────────────►│   FastAPI Server   │
│              │    Audio + Video    │   (Cloud Run)      │
│ - Webcam     │    frames          │                    │
│ - Microphone │                    │ ┌────────────────┐ │
│ - Speaker    │                    │ │ ADK Runner     │ │
│              │                    │ │                │ │
│ React UI     │                    │ │ LiveReqQueue   │ │
│ - Board view │                    │ │      ↓         │ │
│ - Game state │                    │ │ Ghost Player   │ │
│ - Chat log   │                    │ │ Agent Team     │ │
│              │                    │ │      ↓         │ │
│              │                    │ │ Gemini Live API│ │
│              │                    │ └────────────────┘ │
│              │                    │                    │
│              │                    │ ┌────────────────┐ │
│              │                    │ │ Game Tools     │ │
│              │                    │ │ python-chess   │ │
│              │                    │ │ Google Search  │ │
│              │                    │ └────────────────┘ │
└──────────────┘                    └───────────────────┘
                                            │
                                    Google Cloud Run
                                    (auto-scaling)
```

---

## 5. Implementation Roadmap (2 Weeks)

### Week 1: Core Functionality

| Day | Task                                                                                  |
| --- | ------------------------------------------------------------------------------------- |
| 1-2 | Set up GCP project, ADK environment, get Live API streaming working with basic agent  |
| 3-4 | Build Vision Agent: camera → frame extraction → board state recognition (chess first) |
| 5   | Build Game Engine tools: python-chess integration, move computation                   |
| 6-7 | Integrate agents: vision → game engine → spoken response loop                         |

### Week 2: Polish & Submission

| Day | Task                                                            |
| --- | --------------------------------------------------------------- |
| 8-9 | Build React frontend (webcam, audio, game state display)        |
| 10  | Personality tuning: trash talk, commentary, distinct voice      |
| 11  | Deploy to Cloud Run, set up Terraform/IaC for bonus points      |
| 12  | Record demo video (under 4 min), create architecture diagram    |
| 13  | Write blog post (bonus), sign up for GDG (bonus), polish README |
| 14  | Final testing, submit                                           |

---

## 6. What Makes This a Grand Prize Contender

### Innovation & Multimodal UX (40% weight)

- Completely breaks the "text box" paradigm — it's a physical-world interaction
- The agent genuinely sees, hears, and speaks
- Distinct persona per game (trash-talking chess opponent vs. friendly Catan trader)
- Live and context-aware — responds to actual board changes in real-time
- No one has built this — it's a genuinely novel concept

### Technical Implementation (30% weight)

- Multi-agent architecture using ADK (Vision, Game Engine, Personality, Rules)
- Robust GCP hosting on Cloud Run with session persistence
- Grounding via Google Search for rule accuracy (reduces hallucination)
- Streaming video tools for real-time board analysis
- Error handling: graceful fallback if vision is unclear ("I can't quite see the board, could you adjust the camera?")

### Demo & Presentation (30% weight)

- The demo is inherently compelling: watching an AI play a physical board game
- Clear problem: "Playing board games alone or needing a 4th player"
- Clear value: accessible gaming companion, teaching tool for beginners
- Architecture diagram is clean and understandable
- Working software with real-time interaction — impossible to fake

### Bonus Points Strategy

- Blog post on Medium/Dev.to covering the build
- Terraform script for Cloud Run deployment in the repo
- GDG profile linked in submission

---

## 7. Key Resources

- **ADK Docs**: https://google.github.io/adk-docs/
- **ADK Streaming Quickstart**: https://google.github.io/adk-docs/get-started/streaming/quickstart-streaming/
- **ADK Streaming Tools**: https://google.github.io/adk-docs/streaming/streaming-tools/
- **ADK Bidi-Streaming Dev Guide**: https://google.github.io/adk-docs/streaming/dev-guide/part1/
- **Live API Web Console (React starter)**: https://github.com/google-gemini/live-api-web-console
- **ADK Bidi Demo**: https://github.com/google/adk-samples/tree/main/python/agents/bidi-demo
- **Deploy to Cloud Run**: https://google.github.io/adk-docs/deploy/cloud-run/
- **Gemini Live API Guide**: https://ai.google.dev/gemini-api/docs/live
- **Gemini Vision Capabilities**: https://ai.google.dev/gemini-api/docs/vision
- **Hackathon Page**: https://geminiliveagentchallenge.devpost.com/
- **Hackathon Rules**: https://geminiliveagentchallenge.devpost.com/rules
- **python-chess**: https://python-chess.readthedocs.io/

---

## 8. Risk Mitigation

| Risk                               | Mitigation                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------- |
| Board detection accuracy           | Start with chess (high contrast pieces). Add "confirm what I see" verbal check.       |
| Live API 2-min video session limit | Implement session resumption per ADK docs; audio-only has 15-min limit.               |
| 1 FPS video too slow               | Board games are mostly static — 1 FPS is actually fine.                               |
| Game logic hallucination           | Use actual game engines (python-chess) as tools, not LLM reasoning for move legality. |
| Demo fails live                    | Pre-record the demo video carefully. Have backup board positions ready.               |
| Scope creep (too many games)       | Ship chess + one simple game. Quality over quantity.                                  |
