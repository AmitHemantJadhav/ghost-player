/**
 * Visual chessboard rendered from a FEN string using Unicode chess pieces.
 * Read-only display — no interaction.
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

interface ChessBoardProps {
  fen: string;
}

export default function ChessBoard({ fen }: ChessBoardProps) {
  const board = parseFen(fen);

  return (
    <div className="flex flex-col items-center">
      {/* Board */}
      <div className="grid grid-cols-8 border border-gray-700 rounded overflow-hidden">
        {board.map((row, rankIdx) =>
          row.map((piece, fileIdx) => {
            const isLight = (rankIdx + fileIdx) % 2 === 0;
            return (
              <div
                key={`${rankIdx}-${fileIdx}`}
                className={`flex items-center justify-center aspect-square w-9 text-xl select-none ${
                  isLight
                    ? "bg-amber-100 text-gray-900"
                    : "bg-amber-800 text-gray-100"
                }`}
              >
                {piece ? PIECE_MAP[piece] ?? "" : ""}
              </div>
            );
          })
        )}
      </div>

      {/* File labels */}
      <div className="grid grid-cols-8 mt-0.5" style={{ width: "288px" }}>
        {FILES.map((f) => (
          <div key={f} className="text-center text-[10px] text-gray-500">
            {f}
          </div>
        ))}
      </div>
    </div>
  );
}
