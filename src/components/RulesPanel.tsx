import { useState } from "react";
import type { GameState, Mine, SnakeLadder } from "@/game/types";
import { squareLabel } from "@/game/snakesLadders";
import type { LevelConfig } from "@/levels/types";

interface RulesPanelProps {
  gameState: GameState;
  level: LevelConfig;
  snakesAndLadders: SnakeLadder[];
  mines: Mine[];
  onActivatePawnBuff: () => void;
  onDeactivatePawnBuff: () => void;
  onSetSnakesAndLadders: (snl: SnakeLadder[]) => void;
  onGenerateSnakesAndLadders: () => void;
}

export function RulesPanel({
  level,
  snakesAndLadders,
  mines,
  onSetSnakesAndLadders,
  onGenerateSnakesAndLadders,
}: RulesPanelProps) {
  const [open, setOpen] = useState(false);
  const pawnRangeMechanic = level.mechanics.find((m) => m.id === "pawn-range");
  const snakeLadderMechanic = level.mechanics.find((m) => m.id === "snakes-ladders");
  const minesweeperMechanic = level.mechanics.find((m) => m.id === "minesweeper");
  const hasMechanics = Boolean(pawnRangeMechanic || snakeLadderMechanic || minesweeperMechanic);
  const snlEnabled = snakesAndLadders.length > 0;

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 bg-stone-800/85 hover:bg-stone-700/85 backdrop-blur border border-stone-600 text-stone-300 text-sm rounded-lg transition-colors shadow-lg"
        title="Level Mechanics"
      >
        <span className="text-base">Rules</span>
        {hasMechanics && (
          <span className="flex items-center justify-center min-w-5 h-5 px-1 bg-amber-500 text-stone-900 text-xs font-bold rounded-full leading-none">
            {level.mechanics.length}
          </span>
        )}
      </button>

      <div
        className={`
          fixed top-0 right-0 h-full z-50 flex flex-col
          w-72 bg-stone-900 border-l border-stone-700 shadow-2xl
          transition-transform duration-300 ease-in-out
          ${open ? "translate-x-0" : "translate-x-full"}
        `}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-700">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
              Level Rules
            </div>
            <h2 className="mt-1 text-amber-200 font-bold text-sm leading-tight">
              {level.title}
            </h2>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-stone-500 hover:text-stone-200 transition-colors text-xl leading-none"
          >
            x
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {!hasMechanics && (
            <p className="text-stone-500 text-xs leading-relaxed">
              No extra mechanics are active yet. This is Death pretending to be fair.
            </p>
          )}

          {pawnRangeMechanic && (
            <section className="rounded-lg border border-amber-500/50 bg-amber-900/15 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-stone-100 text-sm font-semibold">
                    {pawnRangeMechanic.label}
                  </h3>
                  <p className="mt-1 text-stone-400 text-xs leading-relaxed">
                    {pawnRangeMechanic.description}
                  </p>
                </div>
                <StatusPill active label="Active" />
              </div>
            </section>
          )}

          {snakeLadderMechanic && (
            <section className="space-y-3">
              <div className="rounded-lg border border-emerald-500/50 bg-emerald-900/15 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-stone-100 text-sm font-semibold">
                      {snakeLadderMechanic.label}
                    </h3>
                    <p className="mt-1 text-stone-400 text-xs leading-relaxed">
                      {snakeLadderMechanic.description} Snakes drop toward rank 1;
                      ladders climb toward rank 8.
                    </p>
                  </div>
                  <StatusPill active={snlEnabled} label={snlEnabled ? "On" : "Off"} />
                </div>
              </div>

              <button
                onClick={onGenerateSnakesAndLadders}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-stone-800 hover:bg-stone-700 border border-stone-600 text-stone-300 text-xs rounded-lg transition-colors"
              >
                Randomize layout
              </button>

              {snakesAndLadders.length > 0 && (
                <div className="space-y-1">
                  {snakesAndLadders.map((snl) => (
                    <div
                      key={snl.id}
                      className="flex items-center gap-2 px-3 py-2 bg-stone-800/60 rounded-lg"
                    >
                      <span className="text-stone-300 text-xs capitalize font-medium w-12 shrink-0">
                        {snl.kind}
                      </span>
                      <span className="text-stone-500 text-xs">
                        {squareLabel(snl.start.row, snl.start.col)}
                        <span className="mx-1 text-stone-600">to</span>
                        {squareLabel(snl.end.row, snl.end.col)}
                      </span>
                      <button
                        className="ml-auto text-stone-600 hover:text-stone-400 text-xs transition-colors"
                        onClick={() =>
                          onSetSnakesAndLadders(
                            snakesAndLadders.filter((s) => s.id !== snl.id),
                          )
                        }
                        title="Remove"
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {minesweeperMechanic && (
            <section className="rounded-lg border border-red-500/50 bg-red-950/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-stone-100 text-sm font-semibold">
                    {minesweeperMechanic.label}
                  </h3>
                  <p className="mt-1 text-stone-400 text-xs leading-relaxed">
                    {minesweeperMechanic.description} Clue numbers appear on occupied
                    ranks 3-6 and count mines in the surrounding 3x3 area.
                  </p>
                </div>
                <StatusPill active={mines.length > 0} label={`${mines.length} mines`} />
              </div>
            </section>
          )}
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`shrink-0 px-2 py-1 rounded-full text-[10px] font-semibold ${
        active ? "bg-amber-500 text-stone-950" : "bg-stone-700 text-stone-400"
      }`}
    >
      {label}
    </span>
  );
}
