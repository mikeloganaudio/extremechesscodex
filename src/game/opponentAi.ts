import type { GameState, Move, Piece, PieceType, RulesConfig, TurnAction } from "./types";
import { applyTurnAction, getLegalTurnActions } from "./engine";

const PIECE_VALUES: Record<PieceType, number> = {
  pawn: 100,
  knight: 320,
  bishop: 330,
  rook: 500,
  queen: 900,
  king: 0,
};

const CENTER_BONUS = [
  [0, 1, 2, 2, 2, 2, 1, 0],
  [1, 2, 4, 5, 5, 4, 2, 1],
  [2, 4, 7, 9, 9, 7, 4, 2],
  [2, 5, 9, 12, 12, 9, 5, 2],
  [2, 5, 9, 12, 12, 9, 5, 2],
  [2, 4, 7, 9, 9, 7, 4, 2],
  [1, 2, 4, 5, 5, 4, 2, 1],
  [0, 1, 2, 2, 2, 2, 1, 0],
];

interface ScoredAction {
  action: TurnAction;
  score: number;
}

export function chooseWeightedOpponentAction(
  state: GameState,
  rules: RulesConfig,
): TurnAction | null {
  const actions = getLegalTurnActions(state, rules);
  if (actions.length === 0) return null;

  const scored = actions.map((action) => ({
    action,
    score: scoreAction(state, action, rules),
  }));

  return pickWeightedAction(scored);
}

function scoreAction(
  state: GameState,
  action: TurnAction,
  rules: RulesConfig,
): number {
  const beforeMaterial = materialBalance(state.pieces, state.currentTurn);
  const nextState = applyTurnAction(state, action, rules);
  const afterMaterial = materialBalance(nextState.pieces, state.currentTurn);

  let score = 20 + (afterMaterial - beforeMaterial);

  if (nextState.status === "checkmate") score += 2000;
  else if (nextState.status === "check") score += 90;

  if (action.kind === "move") {
    score += scoreMoveShape(state, action.move);
  } else {
    score += 16;
    score += Math.random() * 24;
  }

  // Death should feel fallible. Noise keeps him beatable and a little theatrical.
  score += Math.random() * 85;

  return Math.max(1, score);
}

function scoreMoveShape(state: GameState, move: Move): number {
  const movingPiece = pieceAt(state.pieces, move.from.row, move.from.col);
  if (!movingPiece) return 0;

  const capturedPiece = move.isEnPassant
    ? state.pieces.find(
        (piece) =>
          piece.row === move.from.row &&
          piece.col === move.to.col &&
          piece.color !== movingPiece.color,
      )
    : pieceAt(state.pieces, move.to.row, move.to.col);

  let score = 0;

  if (capturedPiece && capturedPiece.color !== movingPiece.color) {
    score += PIECE_VALUES[capturedPiece.type] * 1.4;
    score -= PIECE_VALUES[movingPiece.type] * 0.18;
  }

  if (move.promotionPiece) score += 650;
  if (move.isCastle) score += 45;

  score += CENTER_BONUS[move.to.row][move.to.col] * 5;

  if (movingPiece.type === "pawn") {
    const progress = movingPiece.color === "white" ? move.to.row : 7 - move.to.row;
    score += progress * 8;
  }

  if (!movingPiece.hasMoved && movingPiece.type !== "king") score += 14;

  return score;
}

function materialBalance(pieces: Piece[], color: Piece["color"]): number {
  return pieces.reduce((total, piece) => {
    const value = PIECE_VALUES[piece.type];
    return piece.color === color ? total + value : total - value;
  }, 0);
}

function pieceAt(pieces: Piece[], row: number, col: number): Piece | undefined {
  return pieces.find((piece) => piece.row === row && piece.col === col);
}

function pickWeightedAction(scored: ScoredAction[]): TurnAction {
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const poolSize = Math.max(3, Math.ceil(sorted.length * 0.35));
  const pool = sorted.slice(0, poolSize);
  const minScore = Math.min(...pool.map((entry) => entry.score));
  const weights = pool.map((entry) => Math.max(1, entry.score - minScore + 12));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = Math.random() * totalWeight;

  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return pool[i].action;
  }

  return pool[0].action;
}
