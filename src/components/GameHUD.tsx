import type { GameState, PieceType } from "@/game/types";

const PIECE_SYMBOLS: Record<PieceType, { white: string; black: string }> = {
  queen: { white: "♕", black: "♛" },
  rook: { white: "♖", black: "♜" },
  bishop: { white: "♗", black: "♝" },
  knight: { white: "♘", black: "♞" },
  pawn: { white: "♙", black: "♟" },
  king: { white: "♔", black: "♚" },
};

interface GameHUDProps {
  gameState: GameState;
  onReset: () => void;
}

export function GameHUD({ gameState, onReset }: GameHUDProps) {
  const statusText = () => {
    switch (gameState.status) {
      case "checkmate":
        const winner = gameState.currentTurn === "white" ? "Black" : "White";
        return { text: `${winner} wins by checkmate!`, color: "text-amber-300" };
      case "stalemate":
        return { text: "Stalemate — Draw!", color: "text-stone-300" };
      case "check":
        return {
          text: `${capitalize(gameState.currentTurn)} is in check!`,
          color: "text-red-400",
        };
      default:
        return {
          text: `${capitalize(gameState.currentTurn)}'s turn`,
          color: "text-stone-200",
        };
    }
  };

  const { text, color } = statusText();
  const isOver =
    gameState.status === "checkmate" || gameState.status === "stalemate";

  return (
    <div className="absolute inset-x-0 top-0 z-10 flex flex-col items-center pointer-events-none">
      <div className="mt-3 px-5 py-2 bg-stone-900/80 backdrop-blur border border-stone-700 rounded-xl flex items-center gap-4 pointer-events-auto">
        <div className={`text-sm font-semibold ${color}`}>{text}</div>
        {isOver && (
          <button
            onClick={onReset}
            className="text-xs bg-amber-700 hover:bg-amber-600 text-white px-3 py-1 rounded-lg transition-colors"
          >
            New Game
          </button>
        )}
      </div>

      <div className="mt-2 flex gap-2 pointer-events-none">
        <CapturedPieces
          pieces={gameState.capturedBlack}
          label="Captured by White"
        />
        <CapturedPieces
          pieces={gameState.capturedWhite}
          label="Captured by Black"
        />
      </div>
    </div>
  );
}

function CapturedPieces({
  pieces,
  label,
}: {
  pieces: GameState["capturedWhite"];
  label: string;
}) {
  if (pieces.length === 0) return null;
  return (
    <div className="px-3 py-1 bg-stone-900/70 backdrop-blur border border-stone-700 rounded-lg">
      <div className="text-[10px] text-stone-500 mb-0.5">{label}</div>
      <div className="flex flex-wrap gap-0.5 max-w-[160px]">
        {pieces.map((p, i) => (
          <span key={i} className="text-base leading-none">
            {PIECE_SYMBOLS[p.type][p.color]}
          </span>
        ))}
      </div>
    </div>
  );
}

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
