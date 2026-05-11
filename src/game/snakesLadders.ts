import type { SnakeLadder } from "./types";

const PLAY_ROWS = [2, 3, 4, 5]; // Board ranks 3, 4, 5, and 6.
const ALL_COLS = [0, 1, 2, 3, 4, 5, 6, 7];
const COL_LETTERS = ["a", "b", "c", "d", "e", "f", "g", "h"];

/** Chebyshev distance: the "king move" metric. */
function chebyshev(r1: number, c1: number, r2: number, c2: number): number {
  return Math.max(Math.abs(r2 - r1), Math.abs(c2 - c1));
}

function sqKey(row: number, col: number): string {
  return `${row},${col}`;
}

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

function allPlayableSquares() {
  return PLAY_ROWS.flatMap((row) => ALL_COLS.map((col) => ({ row, col })));
}

function makeKindList(count: number): SnakeLadder["kind"][] {
  const evenCount = Math.max(2, count % 2 === 0 ? count : count + 1);

  return shuffle([
    ...Array(evenCount / 2).fill("snake"),
    ...Array(evenCount / 2).fill("ladder"),
  ]);
}

function isValidDirectionalEnd(
  kind: SnakeLadder["kind"],
  start: { row: number; col: number },
  end: { row: number; col: number },
): boolean {
  if (end.row === start.row && end.col === start.col) return false;
  if (kind === "snake" && end.row >= start.row) return false;
  if (kind === "ladder" && end.row <= start.row) return false;

  const distance = chebyshev(start.row, start.col, end.row, end.col);
  return distance >= 2 && distance <= 5;
}

/**
 * Generate balanced snakes and ladders.
 * Endpoints are restricted to ranks 3-6.
 * Snakes move in black's attacking direction, toward rank 1.
 * Ladders move in white's attacking direction, toward rank 8.
 */
export function generateSnakesAndLadders(count = 2): SnakeLadder[] {
  const usedSquares = new Set<string>();
  const result: SnakeLadder[] = [];
  const kinds = makeKindList(count);

  let attempts = 0;
  while (result.length < kinds.length && attempts < 1000) {
    attempts++;

    const kind = kinds[result.length];
    const starts = shuffle(allPlayableSquares()).filter(
      (square) => !usedSquares.has(sqKey(square.row, square.col)),
    );

    const start = starts.find((candidate) =>
      allPlayableSquares().some(
        (end) =>
          !usedSquares.has(sqKey(end.row, end.col)) &&
          isValidDirectionalEnd(kind, candidate, end),
      ),
    );
    if (!start) break;

    const end = shuffle(allPlayableSquares()).find(
      (candidate) =>
        !usedSquares.has(sqKey(candidate.row, candidate.col)) &&
        isValidDirectionalEnd(kind, start, candidate),
    );
    if (!end) continue;

    usedSquares.add(sqKey(start.row, start.col));
    usedSquares.add(sqKey(end.row, end.col));

    result.push({
      id: `snl-${Date.now()}-${result.length}`,
      kind,
      start,
      end,
    });
  }

  return result;
}

/** Human-readable label for a SnakeLadder endpoint square, e.g. "d4". */
export function squareLabel(row: number, col: number): string {
  return `${COL_LETTERS[col]}${row + 1}`;
}
