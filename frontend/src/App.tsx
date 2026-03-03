import { useState, useRef, useEffect, useCallback } from "react";
import type { TranscriptEntry, ServerGameState } from "./types/game";
import { useWebSocket } from "./hooks/useWebSocket";
import { useMediaCapture } from "./hooks/useMediaCapture";
import { useAudioPlayback } from "./hooks/useAudioPlayback";
import ChessBoard from "./components/ChessBoard";

/** Group move history into paired rows: [white, black?] */
function pairMoves(
  moves: ServerGameState["move_history"]
): Array<{ num: number; white: string; black?: string }> {
  const pairs: Array<{ num: number; white: string; black?: string }> = [];
  for (const m of moves) {
    if (m.side === "white") {
      pairs.push({ num: m.move_number, white: m.move_san });
    } else if (pairs.length > 0) {
      pairs[pairs.length - 1].black = m.move_san;
    }
  }
  return pairs;
}

/** Derive last move's from/to squares from the last UCI move. */
function deriveLastMove(
  history: ServerGameState["move_history"]
): { from: string; to: string } | undefined {
  if (history.length === 0) return undefined;
  const last = history[history.length - 1];
  const uci = last.move_uci;
  if (uci.length >= 4) {
    return { from: uci.slice(0, 2), to: uci.slice(2, 4) };
  }
  return undefined;
}

function App() {
  const [micOn, setMicOn] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [gameState, setGameState] = useState<ServerGameState | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [userId] = useState(() => crypto.randomUUID());
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());

  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // --- Audio playback ---
  const { playChunk, stop: stopPlayback, isPlaying } = useAudioPlayback();

  // --- Transcript handler ---
  const handleTranscript = useCallback((entry: TranscriptEntry) => {
    setTranscript((prev) => {
      const idx = prev.findIndex((e) => e.id === entry.id);
      if (idx >= 0) {
        const updated = [...prev];
        if (entry.finished && entry.content === "") {
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
    onInterrupted: stopPlayback,
    onGameStateUpdate: setGameState,
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

  // --- One-time fetch game state on connect (fallback) ---
  useEffect(() => {
    if (!ws.isConnected) return;
    (async () => {
      try {
        const res = await fetch("/api/game-state");
        if (res.ok) setGameState(await res.json());
      } catch {
        // Server may not be ready
      }
    })();
  }, [ws.isConnected]);

  // --- Connect + start session ---
  const ensureConnected = useCallback(async () => {
    if (ws.isConnected) return;
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

  // --- Play Again ---
  const handlePlayAgain = useCallback(async () => {
    // Reset on backend will be triggered by agent on new game;
    // for now just start a fresh session
    handleNewSession();
  }, [handleNewSession]);

  // Derived state
  const currentTurn = gameState?.current_fen
    ? gameState.current_fen.split(" ")[1] === "w" ? "White" : "Black"
    : null;
  const pairedMoves = gameState ? pairMoves(gameState.move_history) : [];
  const lastMove = gameState ? deriveLastMove(gameState.move_history) : undefined;

  // Recent transcript entries (last 4)
  const recentTranscript = transcript.slice(-4);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={isPlaying ? "animate-[ghost-pulse_1.5s_ease-in-out_infinite]" : ""}>
              <GhostIcon className="h-8 w-8 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                Ghost <span className="text-emerald-400">Player</span>
              </h1>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                {ws.isConnected && (
                  <span className="flex items-center gap-1 text-emerald-400">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Connected
                  </span>
                )}
                {micOn && <WaveformIndicator />}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={toggleMic}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
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
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
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
              className="rounded-lg bg-gray-800 px-3 py-2 text-sm font-medium text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors"
              title="Start new session"
            >
              New
            </button>
          </div>
        </div>
      </header>

      {/* Main Content — board-centric two-column layout */}
      <main className="mx-auto max-w-6xl p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          {/* Left: Board + Camera PIP */}
          <div className="relative flex items-start justify-center rounded-xl border border-gray-800 bg-gray-900 p-6 min-h-[480px]">
            {gameState?.started ? (
              <>
                <div className="flex flex-col items-center gap-3">
                  <EvaluationBar score={gameState.evaluation_score ?? 0} />
                  <ChessBoard
                    fen={gameState.current_fen}
                    lastMove={lastMove}
                    isCheck={gameState.is_check}
                  />
                </div>

                {/* Game-end overlay */}
                {gameState.is_game_over && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/80 rounded-xl backdrop-blur-sm z-10">
                    <GhostIcon className="h-16 w-16 text-emerald-400 mb-4" />
                    <h2 className="text-2xl font-bold text-white mb-2">
                      {gameState.is_checkmate
                        ? `Checkmate — ${gameState.winner === "white" ? "White" : "Black"} wins!`
                        : gameState.is_stalemate
                        ? "Stalemate — Draw!"
                        : "Game Over — Draw"}
                    </h2>
                    <button
                      onClick={handlePlayAgain}
                      className="mt-4 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
                    >
                      Play Again
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full">
                <GhostIcon className="h-16 w-16 text-gray-700" />
                <p className="mt-4 text-gray-500">No game in progress</p>
                <p className="mt-1 text-xs text-gray-600">
                  Turn on your mic and say "let's play"
                </p>
              </div>
            )}

            {/* Camera PIP overlay */}
            {cameraOn && (
              <div className="absolute bottom-3 right-3 z-20 overflow-hidden rounded-lg border border-emerald-900/40 shadow-lg">
                <video
                  ref={media.videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-[90px] w-[120px] object-cover"
                />
              </div>
            )}

            {media.error && (
              <div className="absolute bottom-3 left-3 right-36 rounded-lg bg-red-900/80 px-3 py-2 text-xs text-red-200 z-20">
                {media.error}
              </div>
            )}
          </div>

          {/* Right: Game Info Panel */}
          <div className="flex flex-col gap-4">
            {/* Info bar */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 px-4 py-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-300">
                  {currentTurn ? `${currentTurn} to move` : "Waiting..."}
                </span>
                {gameState && (
                  <div className="flex items-center gap-1.5">
                    {gameState.coach_mode && (
                      <span className="rounded-full bg-cyan-900/60 px-2.5 py-0.5 text-xs font-medium text-cyan-300">
                        Coach
                      </span>
                    )}
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      gameState.difficulty === "easy" ? "bg-green-900/60 text-green-300" :
                      gameState.difficulty === "hard" ? "bg-red-900/60 text-red-300" :
                      "bg-yellow-900/60 text-yellow-300"
                    }`}>
                      {gameState.difficulty}
                    </span>
                  </div>
                )}
              </div>
              {gameState?.started && (
                <p className="text-xs text-gray-500 mt-1">
                  {gameState.total_moves} move{gameState.total_moves !== 1 ? "s" : ""} played
                  {gameState.is_check && !gameState.is_game_over && (
                    <span className="ml-2 text-red-400 font-medium">Check!</span>
                  )}
                </p>
              )}
            </div>

            {/* Move history */}
            <div className="flex-1 rounded-xl border border-gray-800 bg-gray-900 flex flex-col min-h-[200px] max-h-[300px]">
              <div className="border-b border-gray-800 px-4 py-2">
                <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Moves</h2>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-2">
                {pairedMoves.length === 0 ? (
                  <p className="text-xs text-gray-600 mt-2">No moves yet</p>
                ) : (
                  <div className="space-y-0.5 font-mono text-xs">
                    {pairedMoves.map((pair) => (
                      <div key={pair.num} className="flex gap-1">
                        <span className="w-5 text-gray-500 shrink-0 text-right">{pair.num}.</span>
                        <span className="w-14 text-gray-300">{pair.white}</span>
                        {pair.black && (
                          <span className="w-14 text-emerald-400">{pair.black}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Compact transcript — last few messages */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 flex flex-col max-h-[200px]">
              <div className="border-b border-gray-800 px-4 py-2">
                <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Transcript</h2>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
                {recentTranscript.length === 0 ? (
                  <p className="text-xs text-gray-600 py-2 text-center">
                    Start talking...
                  </p>
                ) : (
                  recentTranscript.map((entry) => (
                    <div
                      key={entry.id}
                      className={`rounded-lg px-2.5 py-1.5 text-xs ${
                        entry.sender === "player"
                          ? "bg-gray-800 text-gray-300"
                          : "bg-emerald-900/30 text-emerald-200"
                      }`}
                    >
                      <span className="font-medium text-gray-500 mr-1.5">
                        {entry.sender === "player" ? "You:" : "Ghost:"}
                      </span>
                      {entry.content}
                      {!entry.finished && (
                        <span className="ml-1 inline-block animate-pulse text-gray-500">...</span>
                      )}
                    </div>
                  ))
                )}
                <div ref={transcriptEndRef} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * Horizontal evaluation bar.
 * score > 0 = White (human) ahead, score < 0 = Black (Ghost) ahead.
 * Range is capped at ±1000cp (10 pawns) for display purposes.
 */
function EvaluationBar({ score }: { score: number }) {
  const MAX = 1000;
  const clamped = Math.max(-MAX, Math.min(MAX, score));
  // 0–100% where 50 = even, >50 = White ahead
  const whitePct = ((clamped + MAX) / (2 * MAX)) * 100;

  const absScore = Math.abs(score / 100);
  const label =
    score === 0 ? "0.0" : score > 0 ? `+${absScore.toFixed(1)}` : `-${absScore.toFixed(1)}`;
  const labelColor =
    score > 50 ? "text-gray-200" : score < -50 ? "text-emerald-400" : "text-gray-500";

  return (
    <div className="flex w-full max-w-[384px] items-center gap-2">
      <span className="w-4 text-center text-[10px] text-gray-500">W</span>
      <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-gray-800">
        {/* White bar grows from the left */}
        <div
          className="absolute left-0 top-0 h-full rounded-l-full bg-gray-200 transition-all duration-500"
          style={{ width: `${whitePct}%` }}
        />
        {/* Centre tick */}
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gray-600" />
      </div>
      <span className="w-4 text-center text-[10px] text-gray-500">B</span>
      <span className={`w-10 text-right font-mono text-[11px] ${labelColor}`}>{label}</span>
    </div>
  );
}

/** Animated waveform bars indicating mic is active. */
function WaveformIndicator() {
  return (
    <span className="flex items-center gap-[2px] h-4">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="w-[2px] rounded-full bg-amber-400"
          style={{
            animation: `waveform-bar 0.8s ease-in-out ${i * 0.1}s infinite`,
            height: "4px",
          }}
        />
      ))}
      <span className="text-amber-400 ml-1">Listening</span>
    </span>
  );
}

function GhostIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M12 2C7.58 2 4 5.58 4 10v10.5c0 .83.67 1.5 1.5 1.5s1.06-.26 1.33-.63c.42-.58 1.26-.58 1.68 0 .42.58 1.26.58 1.68 0 .42-.58 1.26-.58 1.68 0 .42.58 1.26.58 1.68 0 .42-.58 1.26-.58 1.68 0 .27.37.77.63 1.33.63.83 0 1.5-.67 1.5-1.5V10c0-4.42-3.58-8-8-8ZM9.5 13a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" />
    </svg>
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

export default App;
