import { generateSnakesAndLadders } from "@/game/snakesLadders";
import { generateMines, randomMineCount } from "@/game/mines";
import type { RulesConfig } from "@/game/types";
import type { LevelConfig, LevelRuntimeState } from "./types";

export function createLevelRuntime(level: LevelConfig): LevelRuntimeState {
  return {
    snakesAndLadders: level.runtime.startWithSnakesAndLadders
      ? generateSnakesAndLadders(level.runtime.snakeLadderCount)
      : [],
    mines: level.runtime.startWithMines
      ? generateMines(level.runtime.mineCount || randomMineCount())
      : [],
  };
}

export function createLevelRules(
  level: LevelConfig,
  runtime: LevelRuntimeState,
): RulesConfig {
  return {
    ...level.baseRules,
    pawnRangeMode: level.mechanics.some((m) => m.id === "pawn-range")
      ? "extended"
      : level.baseRules.pawnRangeMode,
    snakesAndLadders: runtime.snakesAndLadders,
    mines: runtime.mines,
  };
}

export function randomSnakeLadderCount(): number {
  return Math.random() < 0.5 ? 2 : 4;
}
