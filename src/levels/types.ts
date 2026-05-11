import type { Mine, RulesConfig, SnakeLadder } from "@/game/types";

export type MechanicId =
  | "classic-chess"
  | "pawn-range"
  | "snakes-ladders"
  | "minesweeper";
export type GameModeId = "chess-board-3d";
export type CampaignPhase =
  | "intro-video"
  | "intro-transition"
  | "intro-board"
  | "playing"
  | "post-level"
  | "between-levels";

export interface LevelMechanicConfig {
  id: MechanicId;
  label: string;
  description: string;
}

export interface BoardThemeConfig {
  id: string;
  label: string;
  lightSquare: number;
  darkSquare: number;
  rim: number;
  rimTexture?: string;
  underside: number;
  boardOverlayTexture?: string;
  boardOverlayOpacity?: number;
  boardDecor?: "racing" | "retro-lcd" | "battlefield" | "rubiks";
  backgroundClassName: string;
  lighting: {
    ambient: number;
    key: number;
    fill: number;
  };
  camera: {
    playPosition: [number, number, number];
    introStartRadius: number;
    introEndRadius: number;
    introStartHeight: number;
    introEndHeight: number;
  };
  environment: {
    ground: number;
    horizonGround: number;
    fog: number;
    fogNear?: number;
    fogFar?: number;
    mist?: "heavy";
    backdropTexture: string;
    deathPosition: [number, number, number];
    deathRotation: [number, number, number];
    deathScale: number;
  };
}

export interface LevelConfig {
  id: string;
  chapter: number;
  title: string;
  subtitle: string;
  deathLine: string;
  cutscenes: {
    intro: string[];
    victory: string[];
  };
  mode: GameModeId;
  theme: BoardThemeConfig;
  mechanics: LevelMechanicConfig[];
  baseRules: RulesConfig;
  runtime: {
    startWithSnakesAndLadders: boolean;
    snakeLadderCount: number;
    startWithMines: boolean;
    mineCount: number;
  };
}

export interface LevelRuntimeState {
  snakesAndLadders: SnakeLadder[];
  mines: Mine[];
}
