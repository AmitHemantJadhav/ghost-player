/**
 * Visual chessboard rendered from a FEN string using Unicode chess pieces.
 * Read-only display — no interaction. Supports last-move and check highlights.
 */

const PIECE_MAP: Record<string, string> = {
  K: "\u2654", // ♔
  Q: "\u2655", // ♕
  R: "\u2656", // ♖
  B: "\u2657", // ♗
  N: "\u2658", // ♘
  P: "\u2659", // ♙
  k: "\u265A", // ♚
  q: "\u265B", // ♛
  r: "\u265C", // ♜
  b: "\u265D", // ♝
  n: "\u265E", // ♞
  p: "\u265F", // ♟
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

function parseFen(fen: string): (string | null)[][] {
  const placement = fen.split(" ")[0];
  const rows = placement.split("/");
  const board: (string | null)[][] = [];

  for (const row of rows) {
    const rank: (string | null)[] = [];
    for (const ch of row) {
      if (ch >= "1" && ch <= "8") {
        for (let i = 0; i < parseInt(ch); i++) rank.push(null);
      } else {
        rank.push(ch);
      }
    }
    board.push(rank);
  }
  return board;
}

/** Convert UCI square (e.g. "e2") to [rankIdx, fileIdx] on the board array. */
function squareToIdx(sq: string): [number, number] {
  const file = sq.charCodeAt(0) - 97; // a=0 .. h=7
  const rank = 8 - parseInt(sq[1]);   // 8=0 .. 1=7
  return [rank, file];
}

interface ChessBoardProps {
  fen: string;
  lastMove?: { from: string; to: string };
  isCheck?: boolean;
}

export default function ChessBoard({ fen, lastMove, isCheck }: ChessBoardProps) {
  const board = parseFen(fen);

  // Determine which side is in check from FEN
  const turn = fen.split(" ")[1]; // "w" or "b"
  const kingChar = turn === "w" ? "K" : "k";

  // Build sets for highlight lookups
  const lastMoveSquares = new Set<string>();
  if (lastMove) {
    lastMoveSquares.add(`${squareToIdx(lastMove.from)}`);
    lastMoveSquares.add(`${squareToIdx(lastMove.to)}`);
  }

  return (
    <div className="flex items-start gap-0">
      {/* Rank labels */}
      <div className="flex flex-col" style={{ paddingTop: "0px" }}>
        {RANKS.map((r) => (
          <div
            key={r}
            className="flex items-center justify-center text-[10px] text-gray-500 w-4 h-12"
          >
            {r}
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center">
        {/* Board */}
        <div className="grid grid-cols-8 border border-emerald-900/30 rounded-lg overflow-hidden shadow-lg shadow-emerald-900/20">
          {board.map((row, rankIdx) =>
            row.map((piece, fileIdx) => {
              const isLight = (rankIdx + fileIdx) % 2 === 0;
              const key = `${[rankIdx, fileIdx]}`;
              const isLastMove = lastMoveSquares.has(key);
              const isKingInCheck = isCheck && piece === kingChar;

              return (
                <div
                  key={`${rankIdx}-${fileIdx}`}
                  className={`flex items-center justify-center aspect-square w-12 text-2xl select-none transition-colors ${
                    isLight
                      ? "bg-amber-100 text-gray-900"
                      : "bg-amber-800 text-gray-100"
                  } ${
                    isLastMove
                      ? "ring-2 ring-inset ring-emerald-400/60"
                      : ""
                  } ${
                    isKingInCheck
                      ? "ring-2 ring-inset ring-red-500/80"
                      : ""
                  }`}
                >
                  {piece ? PIECE_MAP[piece] ?? "" : ""}
                </div>
              );
            })
          )}
        </div>

        {/* File labels */}
        <div className="grid grid-cols-8 mt-0.5" style={{ width: "384px" }}>
          {FILES.map((f) => (
            <div key={f} className="text-center text-[10px] text-gray-500">
              {f}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
