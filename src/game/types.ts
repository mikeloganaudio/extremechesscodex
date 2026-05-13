export type PieceColor = "white" | "black";

export type PieceType =
  | "pawn"
  | "rook"
  | "knight"
  | "bishop"
  | "queen"
  | "king";

export interface Piece {
  id: string;
  type: PieceType;
  color: PieceColor;
  row: number;
  col: number;
  hasMoved?: boolean;
}

export interface Square {
  row: number;
  col: number;
}

export interface Move {
  from: Square;
  to: Square;
  capturedPiece?: Piece;
  promotionPiece?: PieceType;
  isCastle?: "kingside" | "queenside";
  isEnPassant?: boolean;
  /** Set when the turn action was a Rubik's row/column shift rather than a piece move. */
  rubiksShift?: RubiksShift;
  /** Set when the piece that moved was teleported by a snake or ladder. */
  teleportedTo?: Square;
  /** Set when a snake/ladder teleport captured a piece at the exit square. */
  teleportCapturedPiece?: Piece;
  /** Set when the move ended on a mine and destroyed the moving piece. */
  mineTriggeredAt?: Square;
}

export interface RubiksShift {
  axis: "row" | "col";
  index: number;
  amount: number;
}

export type TurnAction =
  | { kind: "move"; move: Move }
  | { kind: "rubiks-shift"; shift: RubiksShift };

export type GameStatus =
  | "playing"
  | "check"
  | "checkmate"
  | "stalemate"
  | "draw";

/** A single snake or ladder connecting two board squares. */
export interface SnakeLadder {
  id: string;
  kind: "snake" | "ladder";
  /** Entrance: a piece landing here is teleported to `end`. */
  start: Square;
  /** Exit: where the piece (and any captured enemy) ends up. */
  end: Square;
}

export interface Mine {
  id: string;
  square: Square;
}

export interface GameState {
  pieces: Piece[];
  currentTurn: PieceColor;
  status: GameStatus;
  selectedSquare: Square | null;
  validMoves: Square[];
  moveHistory: Move[];
  enPassantTarget: Square | null;
  capturedWhite: Piece[];
  capturedBlack: Piece[];
  promotionPending: Square | null;
  /** Countdown: number of half-moves remaining on the pawn +1 range buff. 0 = inactive. */
  pawnBuffMovesLeft: number;
}

export interface PieceMovementRule {
  type: PieceType;
  canJump: boolean;
  directions: Array<[number, number]>;
  /** For sliding pieces: null = unlimited. For pawn forward movement: max squares to advance. */
  maxDistance: number | null;
  /**
   * Pawn first-move bonus: total max distance including the normal maxDistance.
   * e.g. maxDistance=1, firstMoveMaxDistance=2 means 2 squares on first move.
   */
  firstMoveMaxDistance?: number;
  captureOnly?: Array<[number, number]>;
  moveOnly?: Array<[number, number]>;
}

export interface RulesConfig {
  movementRules: Record<PieceType, PieceMovementRule>;
  pawnRangeMode?: "normal" | "extended";
  allowCastling: boolean;
  allowEnPassant: boolean;
  allowPromotion: boolean;
  promotionPieces: PieceType[];
  checkWinCondition: boolean;
  /** Active snakes and ladders overlay. Empty array = disabled. */
  snakesAndLadders: SnakeLadder[];
  /** Active booby-trapped squares. Empty array = disabled. */
  mines: Mine[];
  /** Allows row/column wrap shifts as a turn action. */
  rubiksMode?: boolean;
}
