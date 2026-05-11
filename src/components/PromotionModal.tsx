import type { PieceType, PieceColor } from "@/game/types";

interface PromotionModalProps {
  color: PieceColor;
  options: PieceType[];
  onSelect: (piece: PieceType) => void;
}

const PIECE_SYMBOLS: Record<PieceType, { white: string; black: string }> = {
  queen: { white: "♕", black: "♛" },
  rook: { white: "♖", black: "♜" },
  bishop: { white: "♗", black: "♝" },
  knight: { white: "♘", black: "♞" },
  pawn: { white: "♙", black: "♟" },
  king: { white: "♔", black: "♚" },
};

export function PromotionModal({ color, options, onSelect }: PromotionModalProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/60">
      <div className="bg-stone-800 border-2 border-amber-600 rounded-xl p-6 shadow-2xl">
        <h2 className="text-amber-200 text-xl font-bold text-center mb-4">
          Pawn Promotion
        </h2>
        <p className="text-stone-300 text-sm text-center mb-5">
          Choose a piece to promote to
        </p>
        <div className="flex gap-3">
          {options.map((type) => (
            <button
              key={type}
              onClick={() => onSelect(type)}
              className="w-16 h-16 flex flex-col items-center justify-center bg-stone-700 hover:bg-amber-700 border border-stone-500 hover:border-amber-400 rounded-lg transition-all cursor-pointer"
            >
              <span className="text-3xl leading-none">
                {PIECE_SYMBOLS[type][color]}
              </span>
              <span className="text-xs text-stone-400 mt-1 capitalize">
                {type}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
