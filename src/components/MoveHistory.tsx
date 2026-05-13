import { useRef, useEffect } from "react";
import type { Move, PieceType } from "@/game/types";

const COL_LETTERS = ["a", "b", "c", "d", "e", "f", "g", "h"];

const PIECE_LETTERS: Record<PieceType, string> = {
  pawn: "",
  rook: "R",
  knight: "N",
  bishop: "B",
  queen: "Q",
  king: "K",
};

function moveToAlgebraic(move: Move): string {
  if (move.rubiksShift) {
    const label = move.rubiksShift.axis === "row"
      ? `R${move.rubiksShift.index + 1}`
      : `F${COL_LETTERS[move.rubiksShift.index]}`;
    return `${label}${move.rubiksShift.amount > 0 ? "+" : ""}${move.rubiksShift.amount}`;
  }

  if (move.isCastle === "kingside") return "O-O";
  if (move.isCastle === "queenside") return "O-O-O";

  const piece = move.capturedPiece || move.teleportCapturedPiece ? PIECE_LETTERS["pawn"] : "";
  const from = `${COL_LETTERS[move.from.col]}${move.from.row + 1}`;
  const capture = move.capturedPiece || move.teleportCapturedPiece || move.isEnPassant ? "x" : "";
  const to = `${COL_LETTERS[move.to.col]}${move.to.row + 1}`;
  const promo = move.promotionPiece
    ? `=${PIECE_LETTERS[move.promotionPiece]}`
    : "";
  const mine = move.mineTriggeredAt ? "!" : "";
  return `${from}${capture}${to}${promo}${mine}`;
}

interface MoveHistoryProps {
  moves: Move[];
}

export function MoveHistory({ moves }: MoveHistoryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [moves.length]);

  const pairs: [Move, Move | undefined][] = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push([moves[i], moves[i + 1]]);
  }

  return (
    <div className="bg-stone-900/80 backdrop-blur border border-stone-700 rounded-xl p-3 w-48">
      <h3 className="text-stone-400 text-xs font-semibold uppercase tracking-wider mb-2">
        Move History
      </h3>
      <div
        ref={scrollRef}
        className="overflow-y-auto max-h-52 space-y-0.5 scrollbar-thin"
      >
        {pairs.length === 0 && (
          <p className="text-stone-600 text-xs italic">No moves yet</p>
        )}
        {pairs.map(([white, black], i) => (
          <div key={i} className="flex items-center gap-1 text-xs">
            <span className="text-stone-600 w-5 text-right shrink-0">
              {i + 1}.
            </span>
            <span className="text-stone-200 w-16">{moveToAlgebraic(white)}</span>
            {black && (
              <span className="text-stone-400">{moveToAlgebraic(black)}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
