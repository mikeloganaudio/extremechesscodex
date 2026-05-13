import { defaultRules } from "@/game/defaultRules";
import type { LevelConfig } from "./types";
import {
  deathBoardTheme,
  fogOfWarBoardTheme,
  minesweeperBoardTheme,
  racingBoardTheme,
  rubiksBoardTheme,
  serpentsBoardTheme,
  snake2BoardTheme,
} from "./themes";

export const firstGameLevel: LevelConfig = {
  id: "death-first-game",
  chapter: 1,
  title: "I. The First Game",
  subtitle: "A fair board, or so Death claims.",
  deathLine: "A familiar game. That is usually how the trap introduces itself.",
  cutscenes: {
    intro: [
      "Placeholder prerender: you are a brave knight who has fallen in battle, heroic and inconveniently dead.",
      "Fade to black. Wind over an empty, stormy beach. A chess board waits where the tide should be.",
      "As the camera approaches, a hooded black figure sits across from you. He speaks: One game. A little more time.",
    ],
    victory: [
      "Death studies the defeated king without moving.",
      "You have won time, perhaps. You have also won his attention.",
    ],
  },
  mode: "chess-board-3d",
  theme: deathBoardTheme,
  baseRules: defaultRules,
  mechanics: [
    {
      id: "classic-chess",
      label: "Classic Chess",
      description: "The baseline rules that future levels mutate.",
    },
  ],
  runtime: {
    startWithSnakesAndLadders: false,
    snakeLadderCount: 2,
    startWithMines: false,
    mineCount: 0,
  },
};

export const pawnRangeLevel: LevelConfig = {
  id: "ranged-advance",
  chapter: 2,
  title: "II. Ranged Advance",
  subtitle: "The pawns remember they were soldiers.",
  deathLine: "Forward, then. Further than you were promised.",
  cutscenes: {
    intro: [
      "The board returns, but the front line has changed.",
      "Death touches a pawn. It leans forward as if hearing a battlefield trumpet.",
    ],
    victory: [
      "The pawns fall silent again.",
      "Death almost smiles. Almost.",
    ],
  },
  mode: "chess-board-3d",
  theme: racingBoardTheme,
  baseRules: defaultRules,
  mechanics: [
    {
      id: "pawn-range",
      label: "Ranged Advance",
      description: "Pawns can advance farther and capture diagonally up to 2 squares away.",
    },
  ],
  runtime: {
    startWithSnakesAndLadders: false,
    snakeLadderCount: 2,
    startWithMines: false,
    mineCount: 0,
  },
};

export const snakesAndLaddersLevel: LevelConfig = {
  id: "serpents-and-rungs",
  chapter: 3,
  title: "III. Serpents and Rungs",
  subtitle: "The board begins to cheat in visible ways.",
  deathLine: "Some paths rise. Some descend. None are accidental.",
  cutscenes: {
    intro: [
      "The beach cracks beneath the board.",
      "Ladders surface like bones from wet sand. Serpents coil between the squares.",
      "Death says nothing. The new rules explain themselves badly enough.",
    ],
    victory: [
      "The last serpent sinks beneath the board.",
      "Death reaches for another seal.",
    ],
  },
  mode: "chess-board-3d",
  theme: serpentsBoardTheme,
  baseRules: defaultRules,
  mechanics: [
    {
      id: "snakes-ladders",
      label: "Snakes & Ladders",
      description: "Balanced snakes and ladders appear on ranks 3-6.",
    },
  ],
  runtime: {
    startWithSnakesAndLadders: true,
    snakeLadderCount: 4,
    startWithMines: false,
    mineCount: 0,
  },
};

export const minesweeperLevel: LevelConfig = {
  id: "minesweeper",
  chapter: 4,
  title: "IV. Minesweeper",
  subtitle: "The board remembers the battlefield.",
  deathLine: "Every square is safe until it is not.",
  cutscenes: {
    intro: [
      "The stone board darkens beneath your pieces.",
      "Death presses one pale finger to the board. Somewhere below, metal clicks.",
      "The battle did not end when you died. It merely learned the rules.",
    ],
    victory: [
      "The mines lie quiet, spent or undiscovered.",
      "Death folds his hands. Another kindness removed from the game.",
    ],
  },
  mode: "chess-board-3d",
  theme: minesweeperBoardTheme,
  baseRules: defaultRules,
  mechanics: [
    {
      id: "minesweeper",
      label: "Minesweeper",
      description: "5-6 hidden mines appear on ranks 3-6. Any non-king piece landing on one is destroyed.",
    },
  ],
  runtime: {
    startWithSnakesAndLadders: false,
    snakeLadderCount: 0,
    startWithMines: true,
    mineCount: 0,
  },
};

export const snake2Level: LevelConfig = {
  id: "snake-2-mode",
  chapter: 5,
  title: "V. Snake 2 Mode",
  subtitle: "The board learns an older kind of hunger.",
  deathLine: "A smaller screen. A longer body. The same appetite.",
  cutscenes: {
    intro: [
      "The sea wind thins into an electronic hiss.",
      "For a moment the board looks trapped beneath the glass of an old handheld screen.",
      "Death tilts his head, as if remembering a game that only moved forward.",
    ],
    victory: [
      "The display flickers back into wood and stone.",
      "Somewhere, a tiny speaker dies politely.",
    ],
  },
  mode: "chess-board-3d",
  theme: snake2BoardTheme,
  baseRules: defaultRules,
  mechanics: [
    {
      id: "classic-chess",
      label: "Classic Chess",
      description: "Placeholder level: classic rules for now, with Snake 2 mechanics coming later.",
    },
  ],
  runtime: {
    startWithSnakesAndLadders: false,
    snakeLadderCount: 0,
    startWithMines: false,
    mineCount: 0,
  },
};

export const fogOfWarLevel: LevelConfig = {
  id: "fog-of-war",
  chapter: 6,
  title: "VI. Fog of War",
  subtitle: "The board becomes a battlefield you cannot quite see.",
  deathLine: "Armies always vanish before they arrive.",
  cutscenes: {
    intro: [
      "Mist rolls over the stone table and the squares sink into old grass.",
      "Broken branches, ash, and dark stains surface beneath the pieces.",
      "Death waits beyond the haze, as patient as smoke.",
    ],
    victory: [
      "The fog loosens its grip on the board.",
      "Death watches the battlefield disappear as if it was never yours.",
    ],
  },
  mode: "chess-board-3d",
  theme: fogOfWarBoardTheme,
  baseRules: defaultRules,
  mechanics: [
    {
      id: "classic-chess",
      label: "Classic Chess",
      description: "Placeholder level: classic rules for now, with fog of war mechanics coming later.",
    },
  ],
  runtime: {
    startWithSnakesAndLadders: false,
    snakeLadderCount: 0,
    startWithMines: false,
    mineCount: 0,
  },
};

export const rubiksCubeLevel: LevelConfig = {
  id: "rubiks-cube",
  chapter: 7,
  title: "VII. Rubik's Cube",
  subtitle: "The board stops pretending it has only two colours.",
  deathLine: "Every face turns. Every certainty goes with it.",
  cutscenes: {
    intro: [
      "The board fractures into coloured panels.",
      "White, yellow, orange, red, green, and blue squares lock into a pattern that feels random until it moves.",
      "Death rests one hand beside the board, waiting to twist the rules.",
      "While a king is safe, either player may move a piece or drag a rank/file to wrap the board. But in check, the board locks: the threat must be answered by a normal move.",
    ],
    victory: [
      "The colours settle, but only for a moment.",
      "Death studies the arrangement as though memorising a more difficult shape.",
    ],
  },
  mode: "chess-board-3d",
  theme: rubiksBoardTheme,
  baseRules: defaultRules,
  mechanics: [
    {
      id: "rubiks",
      label: "Rubik's Cube",
      description: "Either move a piece or drag a tile to wrap-shift that row or column.",
    },
  ],
  runtime: {
    startWithSnakesAndLadders: false,
    snakeLadderCount: 0,
    startWithMines: false,
    mineCount: 0,
  },
};

export const levelCatalog: LevelConfig[] = [
  firstGameLevel,
  pawnRangeLevel,
  snakesAndLaddersLevel,
  minesweeperLevel,
  snake2Level,
  fogOfWarLevel,
  rubiksCubeLevel,
];
