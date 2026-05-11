import type { BoardThemeConfig } from "./types";

export const deathBoardTheme: BoardThemeConfig = {
  id: "death-board",
  label: "Death's board",
  lightSquare: 0xf0d9b5,
  darkSquare: 0xb58863,
  rim: 0x4a2e12,
  underside: 0x2e1a08,
  backgroundClassName: "bg-stone-950",
  lighting: {
    ambient: 0.5,
    key: 1.35,
    fill: 0.25,
  },
  camera: {
    playPosition: [0, 9.7, 8.4],
    introStartRadius: 72,
    introEndRadius: 10,
    introStartHeight: 30,
    introEndHeight: 9.5,
  },
  environment: {
    ground: 0x2f343b,
    horizonGround: 0x2f343b,
    fog: 0x090807,
    backdropTexture: "/assets/storm-beach-panorama.png",
    deathPosition: [0, 1.55, -8.1],
    deathRotation: [0, 0, 0],
    deathScale: 5.58,
  },
};

export const minesweeperBoardTheme: BoardThemeConfig = {
  ...deathBoardTheme,
  id: "minesweeper-board",
  label: "Minesweeper board",
  lightSquare: 0x8f999f,
  darkSquare: 0x505a60,
  rim: 0x8f1717,
  underside: 0x3a0808,
};

export const racingBoardTheme: BoardThemeConfig = {
  ...deathBoardTheme,
  id: "racing-board",
  label: "Ranged advance board",
  lightSquare: 0xf4f4ef,
  darkSquare: 0x050505,
  rim: 0x161616,
  underside: 0x080808,
  boardDecor: "racing",
  lighting: {
    ambient: 0.58,
    key: 1.28,
    fill: 0.34,
  },
};

export const serpentsBoardTheme: BoardThemeConfig = {
  ...deathBoardTheme,
  id: "serpents-board",
  label: "Serpents and rungs board",
  lightSquare: 0xd7c193,
  darkSquare: 0x5f6b3d,
  rim: 0x3f3518,
  rimTexture: "/assets/serpents-board-rim-texture.png",
  underside: 0x271f0c,
};

export const snake2BoardTheme: BoardThemeConfig = {
  ...deathBoardTheme,
  id: "snake-2-board",
  label: "Snake 2 board",
  lightSquare: 0x8fd431,
  darkSquare: 0x172018,
  rim: 0x26304b,
  underside: 0x111827,
  boardDecor: "retro-lcd",
  lighting: {
    ambient: 0.62,
    key: 1.05,
    fill: 0.38,
  },
};

export const fogOfWarBoardTheme: BoardThemeConfig = {
  ...deathBoardTheme,
  id: "fog-of-war-board",
  label: "Fog of war board",
  lightSquare: 0xb3a174,
  darkSquare: 0x415932,
  rim: 0x2a2116,
  underside: 0x15110c,
  boardOverlayTexture: "/assets/fog-of-war-battlefield-board.png",
  boardOverlayOpacity: 0.34,
  boardDecor: "battlefield",
  lighting: {
    ambient: 0.44,
    key: 1.0,
    fill: 0.18,
  },
  environment: {
    ...deathBoardTheme.environment,
    fog: 0x101311,
    fogNear: 5,
    fogFar: 24,
    mist: "heavy",
  },
};

export const rubiksBoardTheme: BoardThemeConfig = {
  ...deathBoardTheme,
  id: "rubiks-board",
  label: "Rubik's cube board",
  lightSquare: 0xffffff,
  darkSquare: 0x1d1d1d,
  rim: 0x101010,
  underside: 0x050505,
  boardDecor: "rubiks",
  lighting: {
    ambient: 0.62,
    key: 1.22,
    fill: 0.36,
  },
};
