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
  const activeIndex = levels.findIndex((level) => level.id === activeLevel.id);
  const hasNext = activeIndex >= 0 && activeIndex < levels.length - 1;
  const isComplete = gameState.status === "checkmate";

  return (
    <div className="absolute left-4 top-4 z-20 w-72 pointer-events-auto">
      <div className="bg-stone-900/82 backdrop-blur border border-stone-700 rounded-lg shadow-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-700">
          <div className="text-[10px] uppercase tracking-[0.22em] text-stone-500">
            Eighth Seal
          </div>
          <h1 className="mt-1 text-amber-100 text-sm font-bold leading-tight">
            {activeLevel.title}
          </h1>
          <p className="mt-1 text-stone-400 text-xs leading-snug">
            {activeLevel.subtitle}
          </p>
        </div>

        <div className="px-4 py-3 border-b border-stone-800">
          <p className="text-stone-300 text-xs italic leading-relaxed">
            "{activeLevel.deathLine}"
          </p>
        </div>

        <div className="p-2 space-y-1">
          {levels.map((level, index) => {
            const selected = level.id === activeLevel.id;

            return (
              <button
                key={level.id}
                onClick={() => onSelectLevel(index)}
                className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                  selected
                    ? "bg-amber-500/18 border border-amber-500/40"
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
                <div className="mt-0.5 text-xs text-stone-400 truncate">
                  {level.title.replace(/^[IVX]+\.\s*/, "")}
                </div>
              </button>
            );
          })}
        </div>

        {isComplete && hasNext && (
          <div className="px-4 pb-3">
            <button
              onClick={onNextLevel}
              className="w-full px-3 py-2 bg-amber-700 hover:bg-amber-600 text-white text-xs font-semibold rounded-md transition-colors"
            >
              Challenge Death Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
