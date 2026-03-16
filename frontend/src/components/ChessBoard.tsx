/**
 * Spectral chessboard — classical ivory/rosewood palette, Unicode pieces.
 * Read-only display with last-move highlight, check highlight, and piece-slide animation.
 */

import { useRef, useEffect, useState } from "react";

const PIECE_MAP: Record<string, string> = {
  K: "\u2654", Q: "\u2655", R: "\u2656", B: "\u2657", N: "\u2658", P: "\u2659",
  k: "\u265A", q: "\u265B", r: "\u265C", b: "\u265D", n: "\u265E", p: "\u265F",
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

function parseFen(fen: string): (string | null)[][] {
  const placement = fen.split(" ")[0];
  return placement.split("/").map((row) => {
    const rank: (string | null)[] = [];
    for (const ch of row) {
      if (ch >= "1" && ch <= "8") {
        for (let i = 0; i < parseInt(ch); i++) rank.push(null);
      } else {
        rank.push(ch);
      }
    }
    return rank;
  });
}

function squareToIdx(sq: string): [number, number] {
  const file = sq.charCodeAt(0) - 97;
  const rank = 8 - parseInt(sq[1]);
  return [rank, file];
}

interface ChessBoardProps {
  fen: string;
  lastMove?: { from: string; to: string };
  isCheck?: boolean;
}

export default function ChessBoard({ fen, lastMove, isCheck }: ChessBoardProps) {
  const board = parseFen(fen);
  const turn = fen.split(" ")[1];
  const kingChar = turn === "w" ? "K" : "k";

  // Track which square key is currently animating (piece-slide)
  const prevLastMoveRef = useRef<{ from: string; to: string } | undefined>(undefined);
  const [animatingKey, setAnimatingKey] = useState<string | null>(null);

  useEffect(() => {
    const prev = prevLastMoveRef.current;
    if (
      lastMove &&
      (!prev || prev.from !== lastMove.from || prev.to !== lastMove.to)
    ) {
      prevLastMoveRef.current = lastMove;
      const [r, f] = squareToIdx(lastMove.to);
      const key = `${r}-${f}`;
      setAnimatingKey(key);
      const timer = setTimeout(() => setAnimatingKey(null), 420);
      return () => clearTimeout(timer);
    }
  }, [lastMove]);

  const lastMoveSquares = new Set<string>();
  if (lastMove) {
    lastMoveSquares.add(`${squareToIdx(lastMove.from)}`);
    lastMoveSquares.add(`${squareToIdx(lastMove.to)}`);
  }

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "0" }}>
      {/* Rank labels */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {RANKS.map((r) => (
          <div
            key={r}
            style={{
              width: "18px",
              height: "52px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              color: "rgba(154,136,112,0.5)",
            }}
          >
            {r}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {/* Board */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(8, 52px)",
            borderRadius: "2px",
            overflow: "hidden",
            boxShadow: `
              0 0 0 1px rgba(200, 168, 75, 0.25),
              0 8px 40px rgba(0, 0, 0, 0.7),
              0 0 60px rgba(130, 85, 8, 0.15)
            `,
          }}
        >
          {board.map((row, rankIdx) =>
            row.map((piece, fileIdx) => {
              const isLight = (rankIdx + fileIdx) % 2 === 0;
              const key = `${[rankIdx, fileIdx]}`;
              const cellKey = `${rankIdx}-${fileIdx}`;
              const isLastMove = lastMoveSquares.has(key);
              const isKingInCheck = isCheck && piece === kingChar;
              const isWhitePiece = piece !== null && piece === piece.toUpperCase();
              const isAnimating = animatingKey === cellKey;

              let bg = isLight ? "#f0d9b5" : "#b58863";
              if (isLastMove) bg = isLight ? "#cdd16f" : "#a3a832";

              return (
                <div
                  key={cellKey}
                  style={{
                    width: "52px",
                    height: "52px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "28px",
                    background: bg,
                    position: "relative",
                    transition: "background 0.15s",
                    outline: isKingInCheck ? "2px solid rgba(192, 57, 43, 0.9)" : "none",
                    outlineOffset: "-2px",
                    boxShadow: isKingInCheck
                      ? "inset 0 0 24px rgba(192, 57, 43, 0.4)"
                      : undefined,
                  }}
                >
                  {piece ? (
                    <span
                      style={{
                        color: isWhitePiece ? "#fffdf0" : "#1a1008",
                        filter: isWhitePiece
                          ? "drop-shadow(0 1px 2px rgba(0,0,0,0.5))"
                          : "drop-shadow(0 1px 2px rgba(0,0,0,0.35))",
                        lineHeight: 1,
                        userSelect: "none",
                        animation: isAnimating ? "piece-slide 0.35s ease-out" : undefined,
                      }}
                    >
                      {PIECE_MAP[piece] ?? ""}
                    </span>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        {/* File labels */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 52px)", marginTop: "5px" }}>
          {FILES.map((f) => (
            <div
              key={f}
              style={{
                textAlign: "center",
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                color: "rgba(154,136,112,0.5)",
              }}
            >
              {f}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
