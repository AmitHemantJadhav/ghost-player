import { useState, useRef, useEffect, useCallback } from "react";
import type { TranscriptEntry, ServerGameState } from "./types/game";
import { useWebSocket } from "./hooks/useWebSocket";
import { useMediaCapture } from "./hooks/useMediaCapture";
import { useAudioPlayback } from "./hooks/useAudioPlayback";

function App() {
  const [micOn, setMicOn] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [gameState, setGameState] = useState<ServerGameState | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [userId] = useState(() => crypto.randomUUID());
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [textInput, setTextInput] = useState("");

  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // --- Audio playback ---
  const { playChunk, stop: stopPlayback } = useAudioPlayback();

  // --- Transcript handler ---
  const handleTranscript = useCallback((entry: TranscriptEntry) => {
    setTranscript((prev) => {
      const idx = prev.findIndex((e) => e.id === entry.id);
      if (idx >= 0) {
        const updated = [...prev];
        // Append or finalize content
        if (entry.finished && entry.content === "") {
          // Finalize existing entry
          updated[idx] = { ...updated[idx], finished: true };
        } else {
          updated[idx] = { ...updated[idx], content: entry.content, finished: entry.finished };
        }
        return updated;
      }
      return [...prev, entry];
    });
  }, []);

  // --- WebSocket ---
  const ws = useWebSocket({
    onAudioChunk: playChunk,
    onTranscript: handleTranscript,
  });

  // --- Media capture ---
  const media = useMediaCapture({
    onAudioChunk: ws.sendAudio,
    onVideoFrame: ws.sendImage,
  });

  // --- Auto-scroll transcript ---
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // --- Poll game state ---
  useEffect(() => {
    if (!ws.isConnected) return;

    const poll = async () => {
      try {
        const res = await fetch("/api/game-state");
        if (res.ok) {
          const state: ServerGameState = await res.json();
          setGameState(state);
        }
      } catch {
        // Ignore — server may not be ready
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [ws.isConnected]);

  // --- Connect + start session ---
  const ensureConnected = useCallback(async () => {
    if (ws.isConnected) return;

    // Create session via REST first
    try {
      await fetch(`/api/session/${userId}/${sessionId}`, { method: "POST" });
    } catch {
      // Server may not be up yet
    }
    ws.connect(userId, sessionId);
  }, [ws, userId, sessionId]);

  // --- Mic toggle ---
  const toggleMic = useCallback(async () => {
    if (micOn) {
      media.stopMic();
      setMicOn(false);
    } else {
      await ensureConnected();
      await media.startMic();
      setMicOn(true);
    }
  }, [micOn, media, ensureConnected]);

  // --- Camera toggle ---
  const toggleCamera = useCallback(async () => {
    if (cameraOn) {
      media.stopCamera();
      setCameraOn(false);
    } else {
      await ensureConnected();
      await media.startCamera();
      setCameraOn(true);
    }
  }, [cameraOn, media, ensureConnected]);

  // --- Send text message ---
  const handleSendText = useCallback(async () => {
    if (!textInput.trim()) return;
    await ensureConnected();
    ws.sendText(textInput.trim());
    handleTranscript({
      id: crypto.randomUUID(),
      sender: "player",
      content: textInput.trim(),
      timestamp: Date.now(),
      finished: true,
    });
    setTextInput("");
  }, [textInput, ws, ensureConnected, handleTranscript]);

  // --- New session ---
  const handleNewSession = useCallback(() => {
    ws.disconnect();
    stopPlayback();
    media.stopMic();
    media.stopCamera();
    setMicOn(false);
    setCameraOn(false);
    setTranscript([]);
    setGameState(null);
    setSessionId(crypto.randomUUID());
  }, [ws, stopPlayback, media]);

  // Derive turn from FEN
  const currentTurn = gameState?.current_fen
    ? gameState.current_fen.split(" ")[1] === "w" ? "White" : "Black"
    : null;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Ghost Player
            </h1>
            <p className="text-sm text-gray-400">
              AI Board Game Opponent
              {ws.isConnected && (
                <span className="ml-2 inline-block h-2 w-2 rounded-full bg-emerald-500" title="Connected" />
              )}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={toggleMic}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                micOn
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
              }`}
            >
              <MicIcon />
              {micOn ? "Mic On" : "Mic Off"}
            </button>
            <button
              onClick={toggleCamera}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                cameraOn
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
              }`}
            >
              <CameraIcon />
              {cameraOn ? "Camera On" : "Camera Off"}
            </button>
            <button
              onClick={handleNewSession}
              className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors"
              title="Start new session"
            >
              New Session
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Camera Feed */}
          <div className="lg:col-span-2">
            <div className="flex h-96 flex-col items-center justify-center rounded-xl border border-gray-800 bg-gray-900 overflow-hidden relative">
              {/* Always render video so ref stays attached; hide when camera off */}
              <video
                ref={media.videoRef}
                autoPlay
                playsInline
                muted
                className={`h-full w-full object-cover ${cameraOn ? "" : "hidden"}`}
              />
              {!cameraOn && (
                <>
                  <CameraIcon className="h-12 w-12 text-gray-600" />
                  <p className="mt-3 text-sm text-gray-500">Camera Feed</p>
                  <p className="mt-1 text-xs text-gray-600">
                    Point your camera at the board to begin
                  </p>
                </>
              )}
              {media.error && (
                <div className="absolute bottom-3 left-3 right-3 rounded-lg bg-red-900/80 px-3 py-2 text-xs text-red-200">
                  {media.error}
                </div>
              )}
            </div>
          </div>

          {/* Game State */}
          <div>
            <div className="flex h-96 flex-col rounded-xl border border-gray-800 bg-gray-900">
              {gameState?.started ? (
                <div className="flex flex-col h-full">
                  {/* Header */}
                  <div className="border-b border-gray-800 px-4 py-3 flex items-center justify-between">
                    <h2 className="text-sm font-medium text-gray-400">Game State</h2>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      gameState.difficulty === "easy" ? "bg-green-900 text-green-300" :
                      gameState.difficulty === "hard" ? "bg-red-900 text-red-300" :
                      "bg-yellow-900 text-yellow-300"
                    }`}>
                      {gameState.difficulty}
                    </span>
                  </div>

                  {/* Turn indicator */}
                  <div className="px-4 py-3 border-b border-gray-800">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Turn</span>
                      <span className="font-medium text-white">{currentTurn} to move</span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="text-gray-400">Moves</span>
                      <span className="font-medium text-white">{gameState.total_moves}</span>
                    </div>
                  </div>

                  {/* Move history */}
                  <div className="flex-1 overflow-y-auto px-4 py-2">
                    <h3 className="text-xs font-medium text-gray-500 mb-2">Move History</h3>
                    {gameState.move_history.length === 0 ? (
                      <p className="text-xs text-gray-600">No moves yet</p>
                    ) : (
                      <div className="space-y-0.5">
                        {gameState.move_history.map((m, i) => (
                          <div key={i} className="flex text-xs">
                            {m.side === "white" && (
                              <span className="w-6 text-gray-500 shrink-0">{m.move_number}.</span>
                            )}
                            <span className={`${
                              m.side === "white" ? "text-gray-300" : "text-emerald-400 ml-6"
                            }`}>
                              {m.move_san}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center">
                  <BoardIcon className="h-12 w-12 text-gray-600" />
                  <p className="mt-3 text-sm text-gray-500">Game State</p>
                  <p className="mt-1 text-xs text-gray-600">
                    No game in progress
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chat / Transcript Log */}
        <div className="mt-6">
          <div className="flex h-64 flex-col rounded-xl border border-gray-800 bg-gray-900">
            <div className="border-b border-gray-800 px-4 py-3">
              <h2 className="text-sm font-medium text-gray-400">
                Transcript
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {transcript.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-gray-600">
                    Start a conversation with Ghost Player...
                  </p>
                </div>
              ) : (
                transcript.map((entry) => (
                  <div
                    key={entry.id}
                    className={`flex ${
                      entry.sender === "player" ? "justify-start" :
                      entry.sender === "system" ? "justify-center" :
                      "justify-end"
                    }`}
                  >
                    <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      entry.sender === "player"
                        ? "bg-gray-800 text-gray-200"
                        : entry.sender === "system"
                        ? "bg-gray-800/50 text-gray-500 text-xs"
                        : "bg-emerald-900/50 text-emerald-100"
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-500">
                          {entry.sender === "player" ? "You" :
                           entry.sender === "ghost_player" ? "Ghost Player" : "System"}
                        </span>
                      </div>
                      <p className="mt-0.5">
                        {entry.content}
                        {!entry.finished && (
                          <span className="ml-1 inline-block animate-pulse text-gray-500">...</span>
                        )}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={transcriptEndRef} />
            </div>

            {/* Text input */}
            <div className="border-t border-gray-800 px-4 py-3">
              <form
                onSubmit={(e) => { e.preventDefault(); handleSendText(); }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Type a move or message..."
                  className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-emerald-600 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!textInput.trim()}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function MicIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

function CameraIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

function BoardIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M3 12h18" />
      <path d="M12 3v18" />
    </svg>
  );
}

export default App;
