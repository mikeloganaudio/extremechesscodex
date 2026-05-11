import type { RulesConfig, PieceMovementRule } from "./types";

const pawnRule: PieceMovementRule = {
  type: "pawn",
  canJump: false,
  directions: [],
  maxDistance: 1,
  firstMoveMaxDistance: 2,
  moveOnly: [[1, 0]],
  captureOnly: [
    [1, 1],
    [1, -1],
  ],
};

/** Pawn rule when the +1 range buff is active. */
export const buffedPawnRule: PieceMovementRule = {
  type: "pawn",
  canJump: false,
  directions: [],
  maxDistance: 2,
  firstMoveMaxDistance: 3,
  moveOnly: [[1, 0]],
  captureOnly: [
    [1, 1],
    [1, -1],
    [2, 2],
    [2, -2],
  ],
};

const rookRule: PieceMovementRule = {
  type: "rook",
  canJump: false,
  directions: [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ],
  maxDistance: null,
};

const knightRule: PieceMovementRule = {
  type: "knight",
  canJump: true,
  directions: [
    [2, 1],
    [2, -1],
    [-2, 1],
    [-2, -1],
    [1, 2],
    [1, -2],
    [-1, 2],
    [-1, -2],
  ],
  maxDistance: 1,
};

const bishopRule: PieceMovementRule = {
  type: "bishop",
  canJump: false,
  directions: [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ],
  maxDistance: null,
};

const queenRule: PieceMovementRule = {
  type: "queen",
  canJump: false,
  directions: [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ],
  maxDistance: null,
};

const kingRule: PieceMovementRule = {
  type: "king",
  canJump: false,
  directions: [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ],
  maxDistance: 1,
};

export const defaultRules: RulesConfig = {
  movementRules: {
    pawn: pawnRule,
    rook: rookRule,
    knight: knightRule,
    bishop: bishopRule,
    queen: queenRule,
    king: kingRule,
  },
  pawnRangeMode: "normal",
  allowCastling: true,
  allowEnPassant: true,
  allowPromotion: true,
  promotionPieces: ["queen", "rook", "bishop", "knight"],
  checkWinCondition: true,
  snakesAndLadders: [],
  mines: [],
};

/** Returns a RulesConfig with the pawn rule replaced by the buffed version. */
export function applyPawnBuff(rules: RulesConfig): RulesConfig {
  return {
    ...rules,
    movementRules: {
      ...rules.movementRules,
      pawn: buffedPawnRule,
    },
  };
}
