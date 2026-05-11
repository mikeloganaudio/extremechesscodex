import type {
  Piece,
  Square,
  Move,
  GameState,
  PieceColor,
  PieceType,
  RulesConfig,
  PieceMovementRule,
  SnakeLadder,
  Mine,
} from "./types";
import { defaultRules, applyPawnBuff } from "./defaultRules";

/* ─── Initial state ─── */

export function createInitialPieces(): Piece[] {
  const pieces: Piece[] = [];
  let id = 0;

  const backRow: PieceType[] = [
    "rook", "knight", "bishop", "queen",
    "king", "bishop", "knight", "rook",
  ];

  for (let col = 0; col < 8; col++) {
    pieces.push({ id: `w-${id++}`, type: backRow[col], color: "white", row: 0, col });
    pieces.push({ id: `w-${id++}`, type: "pawn",       color: "white", row: 1, col });
    pieces.push({ id: `b-${id++}`, type: "pawn",       color: "black", row: 6, col });
    pieces.push({ id: `b-${id++}`, type: backRow[col], color: "black", row: 7, col });
  }
  return pieces;
}

export function createInitialGameState(): GameState {
  return {
    pieces: createInitialPieces(),
    currentTurn: "white",
    status: "playing",
    selectedSquare: null,
    validMoves: [],
    moveHistory: [],
    enPassantTarget: null,
    capturedWhite: [],
    capturedBlack: [],
    promotionPending: null,
    pawnBuffMovesLeft: 0,
  };
}

/* ─── Helpers ─── */

function getPieceAt(pieces: Piece[], row: number, col: number): Piece | undefined {
  return pieces.find((p) => p.row === row && p.col === col);
}

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function sameSquare(a: Square, b: Square): boolean {
  return a.row === b.row && a.col === b.col;
}

function isMineSquare(mines: Mine[], square: Square): boolean {
  return mines.some((mine) => sameSquare(mine.square, square));
}

function forward(color: PieceColor): number {
  return color === "white" ? 1 : -1;
}

/** Returns the rules to use given the current buff state. */
function effectiveRules(rules: RulesConfig, pawnBuffMovesLeft: number): RulesConfig {
  return rules.pawnRangeMode === "extended" || pawnBuffMovesLeft > 0
    ? applyPawnBuff(rules)
    : rules;
}

/* ─── Snake / Ladder teleportation ─── */

/**
 * After a piece lands on a snake/ladder entrance, teleport it to the exit.
 * - If a friendly piece is at the exit, the teleport is blocked (piece stays).
 * - If an enemy piece is at the exit, it is captured and the piece teleports.
 * Returns the updated piece array and the square the piece ended up on.
 */
function resolveTeleports(
  pieces: Piece[],
  movedPieceId: string,
  landedRow: number,
  landedCol: number,
  snakesAndLadders: SnakeLadder[],
): { pieces: Piece[]; finalSquare: Square | null } {
  const snl = snakesAndLadders.find(
    (s) => s.start.row === landedRow && s.start.col === landedCol,
  );
  if (!snl) return { pieces, finalSquare: null };

  const movedPiece = pieces.find((p) => p.id === movedPieceId);
  if (!movedPiece) return { pieces, finalSquare: null };

  const exitOccupant = getPieceAt(pieces, snl.end.row, snl.end.col);

  // Blocked by friendly piece — no teleport
  if (exitOccupant && exitOccupant.color === movedPiece.color) {
    return { pieces, finalSquare: null };
  }

  // Teleport: remove enemy at exit (if any), move piece to exit
  const newPieces = pieces
    .filter((p) => !(p.row === snl.end.row && p.col === snl.end.col))
    .map((p) =>
      p.id === movedPieceId
        ? { ...p, row: snl.end.row, col: snl.end.col }
        : p,
    );

  return { pieces: newPieces, finalSquare: { row: snl.end.row, col: snl.end.col } };
}

/* ─── Raw move generation ─── */

function getRawMoves(
  piece: Piece,
  pieces: Piece[],
  enPassantTarget: Square | null,
  rule: PieceMovementRule,
  rules: RulesConfig,
): Square[] {
  const moves: Square[] = [];
  const fwd = forward(piece.color);

  /* ── Pawn ── */
  if (piece.type === "pawn") {
    const moveOnlyDirs = rule.moveOnly ?? [[1, 0]];
    const captureDirs  = rule.captureOnly ?? [[1, 1], [1, -1]];
    const maxFwd       = rule.maxDistance ?? 1;
    const maxFirstFwd  = rule.firstMoveMaxDistance ?? maxFwd;

    // Forward advance (non-jumping)
    for (const [, dc] of moveOnlyDirs) {
      const limit = !piece.hasMoved ? maxFirstFwd : maxFwd;
      for (let dist = 1; dist <= limit; dist++) {
        const nr = piece.row + fwd * dist;
        const nc = piece.col + dc;
        if (!inBounds(nr, nc)) break;
        if (getPieceAt(pieces, nr, nc)) break;
        moves.push({ row: nr, col: nc });
      }
    }

    // Diagonal captures (reach — does not require clear path)
    for (const [dr, dc] of captureDirs) {
      const nr = piece.row + fwd * Math.abs(dr);
      const nc = piece.col + dc;
      if (!inBounds(nr, nc)) continue;

      const target = getPieceAt(pieces, nr, nc);
      if (target && target.color !== piece.color) {
        moves.push({ row: nr, col: nc });
      }
      // En passant (only standard 1-step diagonal)
      if (
        Math.abs(dr) === 1 &&
        rules.allowEnPassant &&
        enPassantTarget?.row === nr &&
        enPassantTarget?.col === nc
      ) {
        moves.push({ row: nr, col: nc });
      }
    }

    return moves;
  }

  /* ── Jumping pieces (knight) ── */
  if (rule.canJump) {
    for (const [dr, dc] of rule.directions) {
      const nr = piece.row + dr;
      const nc = piece.col + dc;
      if (inBounds(nr, nc)) {
        const target = getPieceAt(pieces, nr, nc);
        if (!target || target.color !== piece.color) {
          moves.push({ row: nr, col: nc });
        }
      }
    }
    return moves;
  }

  /* ── Sliding pieces ── */
  const maxDist = rule.maxDistance ?? 7;
  for (const [dr, dc] of rule.directions) {
    for (let dist = 1; dist <= maxDist; dist++) {
      const nr = piece.row + dr * dist;
      const nc = piece.col + dc * dist;
      if (!inBounds(nr, nc)) break;
      const target = getPieceAt(pieces, nr, nc);
      if (target) {
        if (target.color !== piece.color) moves.push({ row: nr, col: nc });
        break;
      }
      moves.push({ row: nr, col: nc });
    }
  }

  return moves;
}

/* ─── Apply move to piece array (no teleport) ─── */

function applyMoveRaw(pieces: Piece[], move: Move): Piece[] {
  const movingPiece = pieces.find(
    (p) => p.row === move.from.row && p.col === move.from.col,
  );
  if (!movingPiece) return pieces;

  const filtered = pieces.filter((p) => {
    if (p.row === move.from.row && p.col === move.from.col) return false;
    if (p.row === move.to.row   && p.col === move.to.col)   return false;
    if (move.isEnPassant && p.row === move.from.row && p.col === move.to.col) return false;
    return true;
  }).map((p) => ({ ...p }));

  const updated: Piece = {
    ...movingPiece,
    row: move.to.row,
    col: move.to.col,
    hasMoved: true,
    ...(move.promotionPiece ? { type: move.promotionPiece } : {}),
  };

  if (move.isCastle) {
    const castleRow   = movingPiece.color === "white" ? 0 : 7;
    const rookFromCol = move.isCastle === "kingside" ? 7 : 0;
    const rookToCol   = move.isCastle === "kingside" ? 5 : 3;
    const rook = pieces.find(
      (p) => p.row === castleRow && p.col === rookFromCol && p.type === "rook",
    );
    if (rook) {
      return [...filtered, updated, { ...rook, col: rookToCol, hasMoved: true }];
    }
  }

  return [...filtered, updated];
}

/**
 * Apply a move then resolve snake/ladder teleportation.
 * Returns `{ pieces, teleportedTo }` — `teleportedTo` is non-null when a
 * teleport occurred.
 */
function applyMoveWithTeleport(
  pieces: Piece[],
  move: Move,
  rules: RulesConfig,
): { pieces: Piece[]; teleportedTo: Square | null; mineTriggeredAt: Square | null } {
  const afterMove = applyMoveRaw(pieces, move);

  // Find the piece that just moved (now at move.to)
  const movedPiece = afterMove.find(
    (p) => p.row === move.to.row && p.col === move.to.col,
  );
  if (!movedPiece) return { pieces: afterMove, teleportedTo: null, mineTriggeredAt: null };

  const { pieces: resolved, finalSquare } = resolveTeleports(
    afterMove,
    movedPiece.id,
    move.to.row,
    move.to.col,
    rules.snakesAndLadders,
  );

  const landedSquare = finalSquare ?? move.to;
  const movedAfterTeleport = resolved.find((p) => p.id === movedPiece.id);

  if (
    movedAfterTeleport &&
    movedAfterTeleport.type !== "king" &&
    isMineSquare(rules.mines, landedSquare)
  ) {
    return {
      pieces: resolved.filter((p) => p.id !== movedAfterTeleport.id),
      teleportedTo: finalSquare,
      mineTriggeredAt: landedSquare,
    };
  }

  return { pieces: resolved, teleportedTo: finalSquare, mineTriggeredAt: null };
}

/* ─── Check detection ─── */

function findKing(pieces: Piece[], color: PieceColor): Piece | undefined {
  return pieces.find((p) => p.type === "king" && p.color === color);
}

function isSquareAttacked(
  pieces: Piece[],
  row: number,
  col: number,
  byColor: PieceColor,
  rules: RulesConfig,
): boolean {
  const attackedSquares: Square[] = [
    { row, col },
    ...rules.snakesAndLadders.flatMap((snl) => {
      const target = { row, col };
      if (sameSquare(target, snl.end)) return [snl.start];
      if (sameSquare(target, snl.start)) return [snl.end];
      return [];
    }),
  ];

  return pieces
    .filter((p) => p.color === byColor)
    .some((p) => {
      const rule = rules.movementRules[p.type];
      return getThreatenedSquares(p, pieces, rule, rules).some((move) =>
        attackedSquares.some((target) => sameSquare(move, target)),
      );
    });
}

function getThreatenedSquares(
  piece: Piece,
  pieces: Piece[],
  rule: PieceMovementRule,
  rules: RulesConfig,
): Square[] {
  if (piece.type !== "pawn") {
    return getRawMoves(piece, pieces, null, rule, rules);
  }

  const fwd = forward(piece.color);
  const captureDirs = rule.captureOnly ?? [[1, 1], [1, -1]];

  return captureDirs
    .map(([dr, dc]) => ({
      row: piece.row + fwd * Math.abs(dr),
      col: piece.col + dc,
    }))
    .filter((square) => {
      if (!inBounds(square.row, square.col)) return false;
      const occupant = getPieceAt(pieces, square.row, square.col);
      return !occupant || occupant.color !== piece.color;
    });
}

function moveWouldCaptureKing(
  pieces: Piece[],
  move: Move,
  rules: RulesConfig,
): boolean {
  const directTarget = getPieceAt(pieces, move.to.row, move.to.col);
  if (directTarget?.type === "king") return true;

  const teleport = rules.snakesAndLadders.find((snl) => sameSquare(snl.start, move.to));
  if (!teleport) return false;

  return getPieceAt(pieces, teleport.end.row, teleport.end.col)?.type === "king";
}

function isInCheck(pieces: Piece[], color: PieceColor, rules: RulesConfig): boolean {
  const king = findKing(pieces, color);
  if (!king) return false;
  const enemy = color === "white" ? "black" : "white";
  return isSquareAttacked(pieces, king.row, king.col, enemy, rules);
}

/* ─── Castling ─── */

function getCastlingMoves(piece: Piece, pieces: Piece[], rules: RulesConfig): Square[] {
  if (!rules.allowCastling) return [];
  if (piece.type !== "king" || piece.hasMoved) return [];
  if (isInCheck(pieces, piece.color, rules)) return [];

  const castleRow = piece.color === "white" ? 0 : 7;
  const enemy     = piece.color === "white" ? "black" : "white";
  const result: Square[] = [];

  const kingsideRook = getPieceAt(pieces, castleRow, 7);
  if (
    kingsideRook?.type === "rook" && !kingsideRook.hasMoved &&
    !getPieceAt(pieces, castleRow, 5) &&
    !getPieceAt(pieces, castleRow, 6) &&
    !isSquareAttacked(pieces, castleRow, 5, enemy, rules) &&
    !isSquareAttacked(pieces, castleRow, 6, enemy, rules)
  ) {
    result.push({ row: castleRow, col: 6 });
  }

  const queensideRook = getPieceAt(pieces, castleRow, 0);
  if (
    queensideRook?.type === "rook" && !queensideRook.hasMoved &&
    !getPieceAt(pieces, castleRow, 1) &&
    !getPieceAt(pieces, castleRow, 2) &&
    !getPieceAt(pieces, castleRow, 3) &&
    !isSquareAttacked(pieces, castleRow, 3, enemy, rules) &&
    !isSquareAttacked(pieces, castleRow, 2, enemy, rules)
  ) {
    result.push({ row: castleRow, col: 2 });
  }

  return result;
}

/* ─── Valid moves (legal, no self-check, teleport-aware) ─── */

export function getValidMovesForPiece(
  piece: Piece,
  pieces: Piece[],
  enPassantTarget: Square | null,
  rules: RulesConfig = defaultRules,
): Square[] {
  const rule      = rules.movementRules[piece.type];
  const rawMoves  = getRawMoves(piece, pieces, enPassantTarget, rule, rules);
  const castling  = getCastlingMoves(piece, pieces, rules);
  const allMoves  = [...rawMoves, ...castling];

  if (!rules.checkWinCondition) return allMoves;

  return allMoves.filter((sq) => {
    if (piece.type === "king" && isMineSquare(rules.mines, sq)) return false;

    const isEnPassant =
      rules.allowEnPassant &&
      piece.type === "pawn" &&
      enPassantTarget?.row === sq.row &&
      enPassantTarget?.col === sq.col &&
      sq.col !== piece.col;

    const isCastle = piece.type === "king" && Math.abs(sq.col - piece.col) === 2;

    const move: Move = {
      from: { row: piece.row, col: piece.col },
      to: sq,
      isEnPassant,
      isCastle: isCastle
        ? sq.col > piece.col ? "kingside" : "queenside"
        : undefined,
    };

    if (moveWouldCaptureKing(pieces, move, rules)) return false;

    // Simulate the move including teleportation to check for self-check
    const { pieces: nextPieces } = applyMoveWithTeleport(pieces, move, rules);
    return !isInCheck(nextPieces, piece.color, rules);
  });
}

/* ─── Apply move to full game state ─── */

export function applyMove(
  state: GameState,
  move: Move,
  rules: RulesConfig = defaultRules,
): GameState {
  const effRules = effectiveRules(rules, state.pawnBuffMovesLeft);

  const movingPiece = state.pieces.find(
    (p) => p.row === move.from.row && p.col === move.from.col,
  );
  if (!movingPiece) return state;

  const capturedPiece = move.isEnPassant
    ? state.pieces.find(
        (p) => p.row === move.from.row && p.col === move.to.col && p.color !== movingPiece.color,
      )
    : state.pieces.find(
        (p) => p.row === move.to.row && p.col === move.to.col && p.color !== movingPiece.color,
      );

  const newMove: Move = { ...move, capturedPiece };

  // Apply move + teleport resolution
  const { pieces: piecesAfterMove, teleportedTo, mineTriggeredAt } = applyMoveWithTeleport(
    state.pieces,
    newMove,
    effRules,
  );

  const newPieces = piecesAfterMove;

  // Record teleport in move history entry
  const recordedMove: Move = teleportedTo
    ? { ...newMove, teleportedTo, ...(mineTriggeredAt ? { mineTriggeredAt } : {}) }
    : { ...newMove, ...(mineTriggeredAt ? { mineTriggeredAt } : {}) };

  // En passant target for the next ply
  let enPassantTarget: Square | null = null;
  if (movingPiece.type === "pawn" && Math.abs(move.to.row - move.from.row) === 2) {
    enPassantTarget = {
      row: (move.from.row + move.to.row) / 2,
      col: move.from.col,
    };
  }

  const nextTurn: PieceColor = state.currentTurn === "white" ? "black" : "white";

  const capturedWhite = [...state.capturedWhite];
  const capturedBlack = [...state.capturedBlack];
  if (capturedPiece) {
    if (capturedPiece.color === "white") capturedWhite.push(capturedPiece);
    else capturedBlack.push(capturedPiece);
  }
  // Also capture any piece removed by teleport at the exit
  if (teleportedTo) {
    const teleportCaptured = state.pieces.find(
      (p) =>
        p.row === teleportedTo.row &&
        p.col === teleportedTo.col &&
        p.color !== movingPiece.color,
    );
    if (teleportCaptured) {
      if (teleportCaptured.color === "white") capturedWhite.push(teleportCaptured);
      else capturedBlack.push(teleportCaptured);
    }
  }
  if (mineTriggeredAt) {
    if (movingPiece.color === "white") capturedWhite.push(movingPiece);
    else capturedBlack.push(movingPiece);
  }

  // Pawn promotion check — the piece may now be at teleportedTo
  const finalSquare = teleportedTo ?? move.to;
  const promotedPawn = newPieces.find(
    (p) =>
      p.type === "pawn" &&
      p.color !== nextTurn &&
      p.row === finalSquare.row &&
      p.row === (movingPiece.color === "white" ? 7 : 0),
  );
  const promotionPending: Square | null =
    effRules.allowPromotion && promotedPawn
      ? { row: promotedPawn.row, col: promotedPawn.col }
      : null;

  // Decrement buff counter
  const pawnBuffMovesLeft = Math.max(0, state.pawnBuffMovesLeft - 1);

  // Win condition with the rules active next ply
  const nextEffRules = effectiveRules(rules, pawnBuffMovesLeft);
  const enemyHasMoves = newPieces
    .filter((p) => p.color === nextTurn)
    .some(
      (p) => getValidMovesForPiece(p, newPieces, enPassantTarget, nextEffRules).length > 0,
    );

  const enemyInCheck = isInCheck(newPieces, nextTurn, nextEffRules);

  let status: GameState["status"] = "playing";
  if (!promotionPending) {
    if (!enemyHasMoves) status = enemyInCheck ? "checkmate" : "stalemate";
    else if (enemyInCheck) status = "check";
  }

  return {
    pieces: newPieces,
    currentTurn: nextTurn,
    status,
    selectedSquare: null,
    validMoves: [],
    moveHistory: [...state.moveHistory, recordedMove],
    enPassantTarget,
    capturedWhite,
    capturedBlack,
    promotionPending,
    pawnBuffMovesLeft,
  };
}

/* ─── Select square (click handling) ─── */

export function selectSquare(
  state: GameState,
  row: number,
  col: number,
  rules: RulesConfig = defaultRules,
): GameState {
  if (state.status === "checkmate" || state.status === "stalemate") return state;
  if (state.promotionPending) return state;

  const effRules     = effectiveRules(rules, state.pawnBuffMovesLeft);
  const clickedPiece = state.pieces.find((p) => p.row === row && p.col === col);

  if (state.selectedSquare) {
    const isValidMove = state.validMoves.some((m) => m.row === row && m.col === col);

    if (isValidMove) {
      const movingPiece = state.pieces.find(
        (p) => p.row === state.selectedSquare!.row && p.col === state.selectedSquare!.col,
      );

      let isCastle: Move["isCastle"];
      if (movingPiece?.type === "king" && Math.abs(col - movingPiece.col) === 2) {
        isCastle = col > movingPiece.col ? "kingside" : "queenside";
      }

      const isEnPassant =
        movingPiece?.type === "pawn" &&
        state.enPassantTarget?.row === row &&
        state.enPassantTarget?.col === col &&
        col !== movingPiece.col;

      const move: Move = {
        from: state.selectedSquare,
        to: { row, col },
        isCastle,
        isEnPassant: isEnPassant || false,
      };

      return applyMove(state, move, rules);
    }

    if (clickedPiece && clickedPiece.color === state.currentTurn) {
      return {
        ...state,
        selectedSquare: { row, col },
        validMoves: getValidMovesForPiece(
          clickedPiece, state.pieces, state.enPassantTarget, effRules,
        ),
      };
    }

    return { ...state, selectedSquare: null, validMoves: [] };
  }

  if (clickedPiece && clickedPiece.color === state.currentTurn) {
    return {
      ...state,
      selectedSquare: { row, col },
      validMoves: getValidMovesForPiece(
        clickedPiece, state.pieces, state.enPassantTarget, effRules,
      ),
    };
  }

  return state;
}

/* ─── Promotion ─── */

export function promotePane(
  state: GameState,
  pieceType: PieceType,
  rules: RulesConfig = defaultRules,
): GameState {
  if (!state.promotionPending) return state;

  const newPieces = state.pieces.map((p) =>
    p.row === state.promotionPending!.row &&
    p.col === state.promotionPending!.col &&
    p.type === "pawn"
      ? { ...p, type: pieceType }
      : p,
  );

  const effRules      = effectiveRules(rules, state.pawnBuffMovesLeft);
  const enemyHasMoves = newPieces
    .filter((p) => p.color === state.currentTurn)
    .some(
      (p) => getValidMovesForPiece(p, newPieces, state.enPassantTarget, effRules).length > 0,
    );

  const enemyInCheck = isInCheck(newPieces, state.currentTurn, effRules);

  let status: GameState["status"] = "playing";
  if (!enemyHasMoves) status = enemyInCheck ? "checkmate" : "stalemate";
  else if (enemyInCheck) status = "check";

  return { ...state, pieces: newPieces, promotionPending: null, status };
}
