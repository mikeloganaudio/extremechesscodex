export const SQUARE_SIZE = 1;
export const BOARD_OFFSET = -3.5;

/** Convert chess board coordinates (row 0-7, col 0-7) to Three.js world XYZ. */
export function boardToWorld(row: number, col: number): [number, number, number] {
  return [
    col * SQUARE_SIZE + BOARD_OFFSET,
    0,
    -(row * SQUARE_SIZE + BOARD_OFFSET),
  ];
}
