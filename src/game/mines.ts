import type { Mine, Square } from "./types";

const MINE_ROWS = [2, 3, 4, 5];

function key(square: Square): string {
  return `${square.row}-${square.col}`;
}

export function generateMines(count: number): Mine[] {
  const candidates: Square[] = [];

  for (const row of MINE_ROWS) {
    for (let col = 0; col < 8; col++) {
      candidates.push({ row, col });
    }
  }

  const mines: Mine[] = [];
  const used = new Set<string>();

  while (mines.length < count && used.size < candidates.length) {
    const square = candidates[Math.floor(Math.random() * candidates.length)];
    const squareKey = key(square);
    if (used.has(squareKey)) continue;
    used.add(squareKey);
    mines.push({
      id: `mine-${square.row}-${square.col}-${mines.length}`,
      square,
    });
  }

  return mines;
}

export function randomMineCount(): number {
  return 5 + Math.floor(Math.random() * 2);
}
