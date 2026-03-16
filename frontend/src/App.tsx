import { useState, useRef, useEffect, useCallback } from "react";
import type { TranscriptEntry, ServerGameState } from "./types/game";
import { useWebSocket } from "./hooks/useWebSocket";
import { useMediaCapture } from "./hooks/useMediaCapture";
import { useAudioPlayback } from "./hooks/useAudioPlayback";
import ChessBoard from "./components/ChessBoard";

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

function deriveLastMove(
  history: ServerGameState["move_history"]
): { from: string; to: string } | undefined {
  if (history.length === 0) return undefined;
  const last = history[history.length - 1];
  const uci = last.move_uci;
  if (uci.length >= 4) return { from: uci.slice(0, 2), to: uci.slice(2, 4) };
  return undefined;
}

function App() {
  const [micOn, setMicOn] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [gameState, setGameState] = useState<ServerGameState | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [userId] = useState(() => crypto.randomUUID());
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [demoLoading, setDemoLoading] = useState(false);

  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const { playChunk, stop: stopPlayback, isPlaying } = useAudioPlayback();

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

  const ws = useWebSocket({
    onAudioChunk: playChunk,
    onTranscript: handleTranscript,
    onInterrupted: stopPlayback,
    onGameStateUpdate: setGameState,
  });

  const media = useMediaCapture({
    onAudioChunk: ws.sendAudio,
    onVideoFrame: ws.sendImage,
  });

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  useEffect(() => {
    if (!ws.isConnected) return;
    (async () => {
      try {
        const res = await fetch("/api/game-state");
        if (res.ok) setGameState(await res.json());
      } catch { /* ignore */ }
    })();
  }, [ws.isConnected]);

  const ensureConnected = useCallback(async () => {
    if (ws.isConnected) return;
    try {
      await fetch(`/api/session/${userId}/${sessionId}`, { method: "POST" });
    } catch { /* ignore */ }
    ws.connect(userId, sessionId);
  }, [ws, userId, sessionId]);

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

  const handlePlayAgain = useCallback(async () => {
    handleNewSession();
  }, [handleNewSession]);

  const handleDemo = useCallback(async (gameId: string) => {
    setDemoLoading(true);
    try {
      await fetch(`/api/demo/play/${gameId}`, { method: "POST" });
    } catch { /* ignore */ } finally {
      setDemoLoading(false);
    }
  }, []);

  const currentTurn = gameState?.current_fen
    ? gameState.current_fen.split(" ")[1] === "w" ? "White" : "Black"
    : null;
  const pairedMoves = gameState ? pairMoves(gameState.move_history) : [];
  const lastMove = gameState ? deriveLastMove(gameState.move_history) : undefined;
  const recentTranscript = transcript.slice(-6);

  return (
    <div
      style={{
        minHeight: "100vh",
        fontFamily: "var(--font-body)",
        background: `
          radial-gradient(ellipse 120% 60% at 50% 105%, rgba(130, 85, 8, 0.13) 0%, transparent 55%),
          radial-gradient(ellipse 50% 40% at 5% 0%, rgba(60, 40, 8, 0.25) 0%, transparent 50%),
          var(--bg-void)
        `,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* ── Header ──────────────────────────────────────── */}
      <header
        style={{
          position: "relative",
          zIndex: 10,
          borderBottom: "1px solid var(--border-dim)",
          padding: "14px 32px",
        }}
      >
        <div style={{ maxWidth: "1140px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ animation: isPlaying ? "gold-glow-pulse 2.5s ease-in-out infinite" : undefined }}>
              <GhostSvg size={26} color={isPlaying ? "#e8c87a" : "#c8a84b"} />
            </div>
            <div>
              <h1
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "16px",
                  fontWeight: 600,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "var(--ivory)",
                  lineHeight: 1,
                }}
              >
                Ghost <span style={{ color: "var(--gold)" }}>Player</span>
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px", height: "14px" }}>
                {ws.isConnected && (
                  <span
                    style={{
                      width: "5px", height: "5px", borderRadius: "50%",
                      background: "var(--gold)",
                      boxShadow: "0 0 7px rgba(200,168,75,0.9)",
                      display: "inline-block",
                      animation: "candle-flicker 2.5s ease-in-out infinite",
                    }}
                  />
                )}
                {micOn && <WaveformIndicator />}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <ControlButton active={micOn} onClick={toggleMic} icon={<MicIcon />} label={micOn ? "Mic On" : "Mic"} />
            <ControlButton active={cameraOn} onClick={toggleCamera} icon={<CameraIcon />} label={cameraOn ? "Cam On" : "Camera"} />
            <GhostButton onClick={handleNewSession}>New Game</GhostButton>
          </div>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────── */}
      <main style={{ position: "relative", zIndex: 1, maxWidth: "1140px", margin: "0 auto", padding: "28px 32px 52px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 278px", gap: "24px", alignItems: "start" }}>

          {/* ── Left: Board area ────────────────────────── */}
          <div
            className="panel"
            style={{
              borderRadius: "3px",
              padding: "36px",
              minHeight: "560px",
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {gameState?.started ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", animation: "fade-in-up 0.4s ease-out" }}>
                <EvaluationBar score={gameState.evaluation_score ?? 0} />
                <CapturedRow pieces={gameState.captured_by_black ?? []} />
                <ChessBoard fen={gameState.current_fen} lastMove={lastMove} isCheck={gameState.is_check} />
                <CapturedRow pieces={gameState.captured_by_white ?? []} />
              </div>
            ) : (
              <GhostSpecter isPlaying={isPlaying} onDemo={handleDemo} demoLoading={demoLoading} />
            )}

            {/* Game-over overlay */}
            {gameState?.is_game_over && (
              <div
                style={{
                  position: "absolute", inset: 0, borderRadius: "3px",
                  background: "rgba(11, 9, 6, 0.93)",
                  backdropFilter: "blur(10px)",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  zIndex: 10, animation: "fade-in 0.35s ease-out",
                  gap: "0",
                }}
              >
                <div style={{ marginBottom: "24px", animation: "gold-glow-pulse 3s ease-in-out infinite" }}>
                  <GhostSvg size={52} color="#c8a84b" />
                </div>

                {/* Decorative rule */}
                <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "18px" }}>
                  <div style={{ width: "40px", height: "1px", background: "var(--gold-dim)" }} />
                  <span style={{ color: "var(--gold-dim)", fontSize: "12px" }}>✦</span>
                  <div style={{ width: "40px", height: "1px", background: "var(--gold-dim)" }} />
                </div>

                <h2
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "18px", fontWeight: 600,
                    color: "var(--ivory)",
                    letterSpacing: "0.1em",
                    textAlign: "center",
                    textTransform: "uppercase",
                  }}
                >
                  {gameState.is_checkmate
                    ? `Checkmate — ${gameState.winner === "white" ? "White" : "Black"} Wins`
                    : gameState.is_stalemate
                    ? "Stalemate — Draw"
                    : "Game Over — Draw"}
                </h2>

                {gameState.post_game_insight && (
                  <p
                    style={{
                      fontSize: "16px", color: "var(--parchment)", fontStyle: "italic",
                      maxWidth: "320px", textAlign: "center", lineHeight: 1.7,
                      marginTop: "16px",
                    }}
                  >
                    "{gameState.post_game_insight}"
                  </p>
                )}

                <button
                  onClick={handlePlayAgain}
                  style={{
                    marginTop: "28px",
                    padding: "10px 36px",
                    fontFamily: "var(--font-display)",
                    fontSize: "10px",
                    fontWeight: 400,
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    background: "transparent",
                    border: "1px solid var(--gold)",
                    color: "var(--gold)",
                    borderRadius: "2px",
                    cursor: "pointer",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget).style.background = "rgba(200,168,75,0.1)"; }}
                  onMouseLeave={(e) => { (e.currentTarget).style.background = "transparent"; }}
                >
                  Play Again
                </button>
              </div>
            )}

            {/* Camera PIP */}
            <div
              style={{
                position: "absolute", bottom: "14px", right: "14px", zIndex: 20,
                borderRadius: "2px", overflow: "hidden",
                border: `1px solid ${cameraOn ? "var(--border)" : "transparent"}`,
                display: cameraOn ? "block" : "none",
                boxShadow: cameraOn ? "0 4px 20px rgba(0,0,0,0.5)" : "none",
              }}
            >
              <video ref={media.videoRef} autoPlay playsInline muted style={{ width: "128px", height: "96px", objectFit: "cover", display: "block" }} />
            </div>

            {media.error && (
              <div
                style={{
                  position: "absolute", bottom: "14px", left: "14px", right: "158px",
                  borderRadius: "2px", background: "rgba(120, 30, 20, 0.85)",
                  padding: "8px 12px", fontSize: "13px", color: "#fca5a5", zIndex: 20,
                }}
              >
                {media.error}
              </div>
            )}
          </div>

          {/* ── Right: Info panel ───────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

            {/* Status */}
            <div className="panel" style={{ borderRadius: "3px", padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "13px", fontWeight: 600,
                    color: "var(--ivory)",
                    letterSpacing: "0.06em",
                  }}
                >
                  {currentTurn ? `${currentTurn} to Move` : "Waiting..."}
                </span>
                {gameState && (
                  <div style={{ display: "flex", gap: "5px" }}>
                    {gameState.coach_mode && (
                      <Badge color="cyan">Coach</Badge>
                    )}
                    <DifficultyBadge difficulty={gameState.difficulty} />
                  </div>
                )}
              </div>
              {gameState?.started && (
                <p style={{ fontSize: "12px", color: "var(--stone)", fontFamily: "var(--font-mono)" }}>
                  {gameState.total_moves} move{gameState.total_moves !== 1 ? "s" : ""}
                  {gameState.is_check && !gameState.is_game_over && (
                    <span style={{ marginLeft: "8px", color: "#ef4444" }}> Check</span>
                  )}
                </p>
              )}
            </div>

            {/* Move history */}
            <div className="panel" style={{ borderRadius: "3px", display: "flex", flexDirection: "column", minHeight: "180px", maxHeight: "260px" }}>
              <PanelHeader label="Notation" />
              <div style={{ flex: 1, overflowY: "auto", padding: "10px 18px" }}>
                {pairedMoves.length === 0 ? (
                  <p style={{ fontSize: "13px", color: "var(--stone)", fontStyle: "italic" }}>No moves yet</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", fontFamily: "var(--font-mono)", fontSize: "12px" }}>
                    {pairedMoves.map((pair) => (
                      <div
                        key={pair.num}
                        style={{ display: "flex", gap: "6px", alignItems: "center", padding: "2px 0", borderBottom: "1px solid var(--border-dim)" }}
                      >
                        <span style={{ width: "22px", textAlign: "right", color: "var(--stone)", flexShrink: 0 }}>{pair.num}.</span>
                        <span style={{ width: "54px", color: "var(--parchment)" }}>{pair.white}</span>
                        {pair.black && (
                          <span style={{ width: "54px", color: "var(--gold)" }}>{pair.black}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Transcript */}
            <div className="panel" style={{ borderRadius: "3px", display: "flex", flexDirection: "column", maxHeight: "260px" }}>
              <PanelHeader label="Dialogue" />
              <div style={{ flex: 1, overflowY: "auto", padding: "12px 18px", display: "flex", flexDirection: "column", gap: "14px" }}>
                {recentTranscript.length === 0 ? (
                  <p style={{ fontSize: "14px", color: "var(--stone)", textAlign: "center", padding: "10px 0", fontStyle: "italic" }}>Begin speaking...</p>
                ) : (
                  recentTranscript.map((entry) => (
                    <div key={entry.id} style={{ animation: "fade-in-up 0.25s ease-out" }}>
                      <div
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: "8px", fontWeight: 400,
                          letterSpacing: "0.22em", textTransform: "uppercase",
                          color: entry.sender === "player" ? "var(--stone)" : "var(--gold-dim)",
                          marginBottom: "4px",
                          display: "flex", alignItems: "center", gap: "8px",
                        }}
                      >
                        {entry.sender === "player" ? "You" : "Fenrir"}
                        <span style={{ flex: 1, height: "1px", background: entry.sender === "player" ? "var(--border-dim)" : "rgba(200,168,75,0.12)" }} />
                      </div>
                      <p
                        style={{
                          fontSize: "14px", lineHeight: 1.6,
                          color: entry.sender === "player" ? "var(--parchment)" : "var(--ivory)",
                        }}
                      >
                        {entry.content}
                        {!entry.finished && (
                          <span style={{ marginLeft: "4px", animation: "candle-flicker 1s ease-in-out infinite", color: "var(--gold)" }}>▋</span>
                        )}
                      </p>
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

/* ── Captured pieces row ────────────────────────────── */
const PIECE_UNICODE: Record<string, string> = {
  K: "\u2654", Q: "\u2655", R: "\u2656", B: "\u2657", N: "\u2658", P: "\u2659",
  k: "\u265A", q: "\u265B", r: "\u265C", b: "\u265D", n: "\u265E", p: "\u265F",
};

function CapturedRow({ pieces }: { pieces: string[] }) {
  if (pieces.length === 0) return <div style={{ height: "18px" }} />;
  return (
    <div style={{ display: "flex", gap: "2px", flexWrap: "wrap", maxWidth: "416px", minHeight: "18px" }}>
      {pieces.map((ch, i) => (
        <span
          key={i}
          style={{
            fontSize: "14px",
            lineHeight: 1,
            color: ch === ch.toUpperCase() ? "#fffdf0" : "#1a1008",
            filter: ch === ch.toUpperCase()
              ? "drop-shadow(0 1px 1px rgba(0,0,0,0.6))"
              : "drop-shadow(0 1px 1px rgba(0,0,0,0.4))",
            opacity: 0.75,
          }}
        >
          {PIECE_UNICODE[ch] ?? ch}
        </span>
      ))}
    </div>
  );
}

/* ── Ghost Specter (idle state) ─────────────────────── */
function GhostSpecter({
  isPlaying,
  onDemo,
  demoLoading,
}: {
  isPlaying: boolean;
  onDemo: (gameId: string) => void;
  demoLoading: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "36px", animation: "fade-in-up 0.6s ease-out" }}>
      <div style={{ position: "relative", width: "190px", height: "210px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {/* Candle-glow beneath */}
        <div
          style={{
            position: "absolute", bottom: "0", left: "50%",
            transform: "translateX(-50%)",
            width: "150px", height: "55px",
            background: "radial-gradient(ellipse at center bottom, rgba(200,168,75,0.38) 0%, transparent 70%)",
            filter: "blur(18px)",
            animation: "candle-flicker 3.5s ease-in-out infinite",
          }}
        />

        {/* Speaking rings */}
        {isPlaying && (
          <>
            <div style={{ position: "absolute", inset: "25px", borderRadius: "50%", border: "1px solid rgba(200,168,75,0.38)", animation: "ring-expand 2.8s ease-out infinite" }} />
            <div style={{ position: "absolute", inset: "25px", borderRadius: "50%", border: "1px solid rgba(200,168,75,0.22)", animation: "ring-expand 2.8s ease-out 0.9s infinite" }} />
            <div style={{ position: "absolute", inset: "25px", borderRadius: "50%", border: "1px solid rgba(200,168,75,0.12)", animation: "ring-expand 2.8s ease-out 1.8s infinite" }} />
          </>
        )}

        {/* Ghost */}
        <div
          style={{
            position: "relative", zIndex: 2,
            animation: "specter-float 5s ease-in-out infinite, gold-glow-pulse 4s ease-in-out infinite",
          }}
        >
          <GhostSvg size={76} color="#c8a84b" />
        </div>

        {/* Floating motes */}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              width: i % 2 === 0 ? "3px" : "2px",
              height: i % 2 === 0 ? "3px" : "2px",
              borderRadius: "50%",
              background: `rgba(200, 168, 75, ${0.25 + i * 0.07})`,
              animation: `mote-drift ${4.5 + i * 0.6}s ease-in-out ${i * 0.55}s infinite`,
              left: `${12 + i * 14}%`,
              bottom: `${15 + (i % 3) * 20}%`,
            }}
          />
        ))}
      </div>

      <div style={{ textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", justifyContent: "center", marginBottom: "16px" }}>
          <div style={{ width: "28px", height: "1px", background: "var(--gold-dim)" }} />
          <span style={{ color: "var(--gold-dim)", fontSize: "12px" }}>✦</span>
          <div style={{ width: "28px", height: "1px", background: "var(--gold-dim)" }} />
        </div>
        <p
          style={{
            fontFamily: "var(--font-display)", fontSize: "12px", fontWeight: 400,
            letterSpacing: "0.22em", textTransform: "uppercase",
            color: isPlaying ? "var(--gold-light)" : "var(--gold)",
            marginBottom: "10px",
          }}
        >
          {isPlaying ? "Fenrir Speaks" : "Awaiting Challenger"}
        </p>
        <p style={{ fontSize: "15px", color: "var(--parchment)", fontStyle: "italic" }}>
          Engage the mic and say{" "}
          <span style={{ color: "var(--gold-light)" }}>"let's play"</span>
        </p>

        {/* Demo buttons */}
        <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap", justifyContent: "center" }}>
          {[
            { id: "scholars_mate", label: "Scholar's Mate" },
            { id: "opera_game", label: "Opera Game" },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => onDemo(id)}
              disabled={demoLoading}
              style={{
                padding: "5px 14px", borderRadius: "2px",
                fontFamily: "var(--font-display)",
                fontSize: "8px", fontWeight: 400, letterSpacing: "0.16em",
                textTransform: "uppercase",
                background: "transparent",
                border: "1px solid rgba(200,168,75,0.18)",
                color: "var(--stone)",
                cursor: demoLoading ? "not-allowed" : "pointer",
                opacity: demoLoading ? 0.5 : 1,
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                if (!demoLoading) {
                  (e.currentTarget).style.borderColor = "var(--border)";
                  (e.currentTarget).style.color = "var(--parchment)";
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget).style.borderColor = "rgba(200,168,75,0.18)";
                (e.currentTarget).style.color = "var(--stone)";
              }}
            >
              {demoLoading ? "Loading…" : `▶ ${label}`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Evaluation bar ─────────────────────────────────── */
function EvaluationBar({ score }: { score: number }) {
  const MAX = 1000;
  const clamped = Math.max(-MAX, Math.min(MAX, score));
  const whitePct = ((clamped + MAX) / (2 * MAX)) * 100;
  const absScore = Math.abs(score / 100);
  const label = score === 0 ? "0.0" : score > 0 ? `+${absScore.toFixed(1)}` : `-${absScore.toFixed(1)}`;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", maxWidth: "416px" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.05em", color: "var(--stone)", width: "8px" }}>W</span>
      <div style={{ flex: 1, height: "3px", borderRadius: "1px", background: "rgba(255,255,255,0.06)", position: "relative", overflow: "hidden" }}>
        <div
          style={{
            position: "absolute", left: 0, top: 0, height: "100%",
            width: `${whitePct}%`,
            background: "linear-gradient(90deg, var(--ivory), rgba(240,230,208,0.65))",
            transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)",
          }}
        />
        <div style={{ position: "absolute", left: "50%", top: 0, height: "100%", width: "1px", background: "rgba(200,168,75,0.18)", transform: "translateX(-50%)" }} />
      </div>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.05em", color: "var(--stone)", width: "8px" }}>B</span>
      <span
        style={{
          fontFamily: "var(--font-mono)", fontSize: "10px",
          color: score > 50 ? "var(--ivory)" : score < -50 ? "var(--gold)" : "var(--stone)",
          width: "36px", textAlign: "right",
        }}
      >
        {label}
      </span>
    </div>
  );
}

/* ── Panel header ───────────────────────────────────── */
function PanelHeader({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: "10px 18px 9px",
        borderBottom: "1px solid var(--border-dim)",
        display: "flex", alignItems: "center", gap: "10px",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-display)", fontSize: "8px", fontWeight: 400,
          letterSpacing: "0.22em", color: "var(--gold-dim)", textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1, height: "1px", background: "var(--border-dim)" }} />
    </div>
  );
}

/* ── Badges ─────────────────────────────────────────── */
function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  const styles: Record<string, { bg: string; border: string; text: string }> = {
    cyan: { bg: "rgba(6,182,212,0.08)", border: "rgba(6,182,212,0.22)", text: "#67e8f9" },
  };
  const s = styles[color] ?? styles.cyan;
  return (
    <span
      style={{
        padding: "2px 8px", borderRadius: "1px",
        fontSize: "8px", fontWeight: 400, letterSpacing: "0.14em",
        textTransform: "uppercase", fontFamily: "var(--font-display)",
        background: s.bg, border: `1px solid ${s.border}`, color: s.text,
      }}
    >
      {children}
    </span>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const map: Record<string, { bg: string; border: string; color: string }> = {
    easy:   { bg: "rgba(34,197,94,0.07)",    border: "rgba(34,197,94,0.18)",    color: "#86efac" },
    medium: { bg: "rgba(200,168,75,0.07)",   border: "rgba(200,168,75,0.18)",   color: "#e8c87a" },
    hard:   { bg: "rgba(192,57,43,0.07)",    border: "rgba(192,57,43,0.18)",    color: "#fca5a5" },
  };
  const s = map[difficulty] ?? map.medium;
  return (
    <span
      style={{
        padding: "2px 8px", borderRadius: "1px",
        fontSize: "8px", fontWeight: 400, letterSpacing: "0.14em",
        textTransform: "uppercase", fontFamily: "var(--font-display)",
        background: s.bg, border: `1px solid ${s.border}`, color: s.color,
      }}
    >
      {difficulty}
    </span>
  );
}

/* ── Waveform ───────────────────────────────────────── */
function WaveformIndicator() {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: "2px", height: "14px" }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          style={{
            width: "2px", borderRadius: "1px",
            background: "var(--gold)",
            animation: `waveform-bar 0.7s ease-in-out ${i * 0.1}s infinite`,
            height: "3px", display: "inline-block",
          }}
        />
      ))}
    </span>
  );
}

/* ── Control button ─────────────────────────────────── */
function ControlButton({
  active, onClick, icon, label,
}: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: "7px",
        padding: "7px 14px", borderRadius: "2px",
        fontFamily: "var(--font-display)",
        fontSize: "9px", fontWeight: 400, letterSpacing: "0.14em",
        textTransform: "uppercase",
        cursor: "pointer", transition: "all 0.15s",
        background: active ? "rgba(200,168,75,0.1)" : "transparent",
        border: active ? "1px solid var(--gold)" : "1px solid var(--border-dim)",
        color: active ? "var(--gold-light)" : "var(--parchment)",
        boxShadow: active ? "0 0 12px rgba(200,168,75,0.12)" : "none",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget).style.borderColor = "var(--border)";
          (e.currentTarget).style.color = "var(--ivory)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget).style.borderColor = "var(--border-dim)";
          (e.currentTarget).style.color = "var(--parchment)";
        }
      }}
    >
      {icon}
      {label}
    </button>
  );
}

/* ── Ghost button (secondary) ───────────────────────── */
function GhostButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "7px 18px", borderRadius: "2px",
        fontFamily: "var(--font-display)",
        fontSize: "9px", fontWeight: 400, letterSpacing: "0.14em",
        textTransform: "uppercase",
        background: "transparent",
        border: "1px solid var(--border-dim)",
        color: "var(--stone)",
        cursor: "pointer", transition: "all 0.2s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget).style.borderColor = "var(--border)";
        (e.currentTarget).style.color = "var(--parchment)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget).style.borderColor = "var(--border-dim)";
        (e.currentTarget).style.color = "var(--stone)";
      }}
    >
      {children}
    </button>
  );
}

/* ── SVG Icons ──────────────────────────────────────── */
function GhostSvg({ size = 24, color = "white" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C7.58 2 4 5.58 4 10v10.5c0 .83.67 1.5 1.5 1.5s1.06-.26 1.33-.63c.42-.58 1.26-.58 1.68 0 .42.58 1.26.58 1.68 0 .42-.58 1.26-.58 1.68 0 .42.58 1.26.58 1.68 0 .42-.58 1.26-.58 1.68 0 .27.37.77.63 1.33.63.83 0 1.5-.67 1.5-1.5V10c0-4.42-3.58-8-8-8ZM9.5 13a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

export default App;
