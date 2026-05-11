import type { CampaignPhase, LevelConfig } from "@/levels/types";

interface CutsceneOverlayProps {
  phase: CampaignPhase;
  level: LevelConfig;
  hasNextLevel: boolean;
  boardIntroReady: boolean;
  onBeginBoardIntro: () => void;
  onStartPlaying: () => void;
  onShowNextLevelIntro: () => void;
  onChallengeAgain: () => void;
}

export function CutsceneOverlay({
  phase,
  level,
  hasNextLevel,
  boardIntroReady,
  onBeginBoardIntro,
  onStartPlaying,
  onShowNextLevelIntro,
  onChallengeAgain,
}: CutsceneOverlayProps) {
  if (phase === "playing" || phase === "intro-transition") return null;

  if (phase === "intro-board") {
    if (!boardIntroReady) return null;

    return (
      <div className="absolute bottom-8 left-1/2 z-40 -translate-x-1/2">
        <button
          onClick={onStartPlaying}
          className="px-5 py-2 bg-amber-700/90 hover:bg-amber-600/90 text-white text-sm font-semibold shadow-2xl backdrop-blur border border-amber-500/40 transition-colors"
        >
          Begin The Match
        </button>
      </div>
    );
  }

  const content = getCutsceneContent(phase, level, hasNextLevel);
  const action = getAction(phase, hasNextLevel, {
    onBeginBoardIntro,
    onStartPlaying,
    onShowNextLevelIntro,
    onChallengeAgain,
  });

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/62 backdrop-blur-[2px]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.2)_42%,rgba(0,0,0,0.78)_100%)]" />

      <div className="relative w-[min(720px,calc(100vw-32px))] border border-stone-700 bg-stone-950/88 shadow-2xl">
        <div className="border-b border-stone-800 px-6 py-4">
          <div className="text-[10px] uppercase tracking-[0.28em] text-stone-500">
            {content.eyebrow}
          </div>
          <h2 className="mt-2 text-amber-100 text-xl font-bold leading-tight">
            {content.title}
          </h2>
          <p className="mt-1 text-stone-500 text-xs">
            {level.title}
          </p>
        </div>

        <div className="px-6 py-5 space-y-3">
          {content.lines.map((line) => (
            <p key={line} className="text-stone-300 text-sm leading-relaxed">
              {line}
            </p>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-stone-800 px-6 py-4">
          <p className="text-stone-600 text-xs">
            Placeholder cinematic beat. Later: prerender/video/3D character action.
          </p>
          {action && (
            <button
              onClick={action.onClick}
              className="shrink-0 px-4 py-2 bg-amber-700 hover:bg-amber-600 text-white text-sm font-semibold transition-colors"
            >
              {action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function getCutsceneContent(
  phase: CampaignPhase,
  level: LevelConfig,
  hasNextLevel: boolean,
) {
  if (phase === "intro-video") {
    return {
      eyebrow: "Opening Cutscene",
      title: "The Knight Falls",
      lines: level.cutscenes.intro,
    };
  }

  if (phase === "post-level") {
    return {
      eyebrow: "Aftermath",
      title: hasNextLevel ? "Death Rearranges the Rules" : "The Last Move, For Now",
      lines: level.cutscenes.victory,
    };
  }

  return {
    eyebrow: "Between Levels",
    title: "Another Seal Opens",
    lines: [
      ...level.cutscenes.intro,
      `"${level.deathLine}"`,
    ],
  };
}

function getAction(
  phase: CampaignPhase,
  hasNextLevel: boolean,
  handlers: {
    onBeginBoardIntro: () => void;
    onStartPlaying: () => void;
    onShowNextLevelIntro: () => void;
    onChallengeAgain: () => void;
  },
) {
  if (phase === "intro-video") {
    return { label: "Fade To The Board", onClick: handlers.onBeginBoardIntro };
  }

  if (phase === "between-levels") {
    return { label: "Begin The Match", onClick: handlers.onStartPlaying };
  }

  if (phase === "post-level" && hasNextLevel) {
    return { label: "Challenge Death Again", onClick: handlers.onShowNextLevelIntro };
  }

  if (phase === "post-level") {
    return { label: "Reset This Level", onClick: handlers.onChallengeAgain };
  }

  return null;
}
