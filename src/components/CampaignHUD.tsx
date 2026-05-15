import { useState } from "react";
import type { GameState } from "@/game/types";
import type { LevelConfig } from "@/levels/types";

interface CampaignHUDProps {
  levels: LevelConfig[];
  activeLevel: LevelConfig;
  gameState: GameState;
  onSelectLevel: (index: number) => void;
  onNextLevel: () => void;
}

export function CampaignHUD({
  levels,
  activeLevel,
  gameState,
  onSelectLevel,
  onNextLevel,
}: CampaignHUDProps) {
  const [open, setOpen] = useState(false);
  const activeIndex = levels.findIndex((level) => level.id === activeLevel.id);
  const hasNext = activeIndex >= 0 && activeIndex < levels.length - 1;
  const isComplete = gameState.status === "checkmate";

  return (
    <div className="absolute left-4 top-4 z-[60] pointer-events-auto">
      <button
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-lg border border-stone-600 bg-stone-800/85 px-3 py-2 text-sm text-stone-300 shadow-lg backdrop-blur transition-colors hover:bg-stone-700/85"
        title="Campaign Levels"
      >
        <span>Levels</span>
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-xs font-bold leading-none text-stone-950">
          {activeLevel.chapter}
        </span>
      </button>

      {open && (
        <button
          className="fixed inset-0 z-50 cursor-default bg-black/20"
          onClick={() => setOpen(false)}
          aria-label="Close level menu backdrop"
        />
      )}

      <div
        className={`
          fixed left-0 top-0 z-[60] flex h-full w-72 max-w-[calc(100vw-32px)] flex-col
          border-r border-stone-700 bg-stone-900 shadow-2xl
          transition-transform duration-300 ease-in-out
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="flex items-start justify-between gap-3 border-b border-stone-700 px-4 py-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-stone-500">
              Eighth Seal
            </div>
            <h1 className="mt-1 text-sm font-bold leading-tight text-amber-100">
              {activeLevel.title}
            </h1>
            <p className="mt-1 text-xs leading-snug text-stone-400">
              {activeLevel.subtitle}
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-xl leading-none text-stone-500 transition-colors hover:text-stone-200"
            title="Close level menu"
          >
            x
          </button>
        </div>

        <div className="border-b border-stone-800 px-4 py-3">
          <p className="text-xs italic leading-relaxed text-stone-300">
            "{activeLevel.deathLine}"
          </p>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto p-2">
          {levels.map((level, index) => {
            const selected = level.id === activeLevel.id;

            return (
              <button
                key={level.id}
                onClick={() => {
                  onSelectLevel(index);
                  setOpen(false);
                }}
                className={`w-full rounded-md px-3 py-2 text-left transition-colors ${
                  selected
                    ? "border border-amber-500/40 bg-amber-500/18"
                    : "border border-transparent hover:bg-stone-800/70"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-stone-100">
                    Level {level.chapter}
                  </span>
                  <span className="text-[10px] text-stone-500">
                    {level.mechanics[0]?.label ?? "Classic"}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-xs text-stone-400">
                  {level.title.replace(/^[IVX]+\.\s*/, "")}
                </div>
              </button>
            );
          })}
        </div>

        {isComplete && hasNext && (
          <div className="border-t border-stone-800 px-4 py-3">
            <button
              onClick={() => {
                onNextLevel();
                setOpen(false);
              }}
              className="w-full rounded-md bg-amber-700 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-600"
            >
              Challenge Death Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
