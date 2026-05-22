import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { CampaignPhase, LevelConfig } from "@/levels/types";

interface CutsceneOverlayProps {
  phase: CampaignPhase;
  level: LevelConfig;
  hasNextLevel: boolean;
  boardIntroReady: boolean;
  onBeginBoardIntro: (alreadyBlack?: boolean) => void;
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
  const [deathReplyVisible, setDeathReplyVisible] = useState(false);
  const startTimer = useRef<number | null>(null);

  useEffect(() => {
    setDeathReplyVisible(false);
    if (startTimer.current !== null) {
      window.clearTimeout(startTimer.current);
      startTimer.current = null;
    }
  }, [phase, level.id]);

  useEffect(
    () => () => {
      if (startTimer.current !== null) {
        window.clearTimeout(startTimer.current);
      }
    },
    [],
  );

  function handleIntroChoice() {
    if (deathReplyVisible) return;

    setDeathReplyVisible(true);
    startTimer.current = window.setTimeout(() => {
      startTimer.current = null;
      onStartPlaying();
    }, 3600);
  }

  if (phase === "playing" || phase === "intro-transition") return null;

  if (phase === "intro-board") {
    if (!boardIntroReady) return null;

    return (
      <div className="absolute bottom-7 left-1/2 z-40 w-[min(760px,calc(100vw-32px))] -translate-x-1/2">
        <div className="eighth-dialog-shell px-5 py-4">
          <div className="eighth-dialog-eyebrow">
            Death
          </div>
          {deathReplyVisible ? (
            <p className="eighth-dialog-body mt-2">
              Ah. Such arrogance. I have come to expect little else from mortals.
              Let us see how long yours endures; I have never yet been beaten.
            </p>
          ) : (
            <>
              <p className="eighth-dialog-body mt-2">
                Defeat me, and I will return you to the realm of the living. Lose,
                and you will remain here, in my realm, F O R E V E R . . .
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  onClick={handleIntroChoice}
                  className="eighth-dialog-choice"
                >
                  Why do I feel like I have seen this exact scenario somewhere before?
                </button>
                <button
                  onClick={handleIntroChoice}
                  className="eighth-dialog-choice"
                >
                  I accept your challenge.
                </button>
              </div>
            </>
          )}
        </div>
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
  const isOpeningCard = phase === "intro-video";

  if (isOpeningCard) {
    return <PreIntroStoryboard onComplete={onBeginBoardIntro} />;
  }

  return (
    <div
      className={`absolute inset-0 z-40 flex items-center justify-center ${
        isOpeningCard ? "bg-black" : "bg-black/62 backdrop-blur-[2px]"
      }`}
    >
      {!isOpeningCard && (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.2)_42%,rgba(0,0,0,0.78)_100%)]" />
      )}

      <div className="eighth-dialog-shell relative w-[min(720px,calc(100vw-32px))]">
        <div className="eighth-dialog-section px-6 py-4">
          <div className="eighth-dialog-eyebrow">
            {content.eyebrow}
          </div>
          <h2 className="eighth-dialog-title mt-2">
            {content.title}
          </h2>
          <p className="mt-1 text-stone-500 text-xs">
            {level.title}
          </p>
        </div>

        <div className="px-6 py-5 space-y-3">
          {content.lines.map((line) => (
            <p key={line} className="eighth-dialog-body">
              {line}
            </p>
          ))}
        </div>

        <div className="eighth-dialog-section flex items-center justify-between gap-3 px-6 py-4">
          <p className="text-stone-600 text-xs">
            Placeholder cinematic beat. Later: prerender/video/3D character action.
          </p>
          {action && (
            <button
              onClick={action.onClick}
              className="eighth-dialog-action shrink-0"
            >
              {action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const introScenes = [
  {
    image: "/assets/preintro/fallen-knight-clean.png",
    text: "You lie broken on a muddy hill, alone and far from home. Your life of chivalry and honour is cut short by a lucky blow in the chaos of a battle you did not understand, for a lord who does not know you exist. Your grip on this world fades as you gaze up at the sky over a land you will never know by name, and die.",
    render: <FlagFlipbook />,
  },
  {
    image: "/assets/preintro/storm-beach.png",
    text: "You wake to rain on a shore you do not know. Your wound is gone. Your sword is gone. The world behind you has vanished, and far by the water a dark figure waits as though it knew you would arrive.",
    render: (
      <>
        <CloudAndWaveFlicker variant="beach" />
        <DistantFigureFlicker />
      </>
    ),
  },
  {
    image: "/assets/preintro/death-awaits.png",
    text: "The figure has laid out a chessboard between you. It gives no name, no comfort, and no answer to where you are. It only rests one pale hand beside the pieces, and waits for you to make the first move.",
    render: (
      <>
        <CloudAndWaveFlicker variant="death" />
        <DeathMist />
        <StormDarkening />
      </>
    ),
  },
];

function PreIntroStoryboard({ onComplete }: { onComplete: () => void }) {
  const [activeScene, setActiveScene] = useState(0);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (closeTimer.current !== null) {
        window.clearTimeout(closeTimer.current);
      }
    },
    [],
  );

  function handleContinue() {
    if (isClosing) return;

    if (activeScene < introScenes.length - 1) {
      setActiveScene((scene) => scene + 1);
      return;
    }

    setIsClosing(true);
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      onComplete(true);
    }, 2000);
  }

  const scene = introScenes[activeScene];

  return (
    <div className="absolute inset-0 z-40 overflow-hidden bg-black">
      <StoryboardFrame
        key={activeScene}
        image={scene.image}
        className="preintro-frame-active"
      >
        <RainFlecks />
        {scene.render}
      </StoryboardFrame>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.08)_48%,rgba(0,0,0,0.58)_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.13] mix-blend-screen preintro-film-grain" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[38%] bg-gradient-to-t from-black/82 via-black/48 to-transparent" />

      <div className="absolute bottom-[7.5%] left-1/2 z-20 w-[min(880px,calc(100vw-36px))] -translate-x-1/2 text-center">
        <p className="preintro-narration mx-auto max-w-3xl text-balance text-[clamp(1.05rem,2.35vw,1.58rem)] leading-relaxed text-stone-100 drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)]">
          {scene.text}
        </p>
        <button
          onClick={handleContinue}
          className="mt-5 border border-stone-400/42 bg-black/42 px-5 py-2 text-[11px] uppercase tracking-[0.28em] text-stone-200 shadow-xl backdrop-blur-sm transition-colors hover:border-stone-100 hover:bg-stone-950/70 hover:text-white"
        >
          {activeScene === introScenes.length - 1 ? "Enter The Game" : "Continue"}
        </button>
      </div>

      <button
        onClick={onComplete}
        className="absolute right-5 top-5 z-20 border border-stone-600/70 bg-black/55 px-3 py-2 text-[10px] uppercase tracking-[0.22em] text-stone-300 transition-colors hover:border-stone-300 hover:text-stone-100"
      >
        Skip
      </button>

      {isClosing && <div className="absolute inset-0 z-30 bg-black preintro-final-black" />}
    </div>
  );
}

function StoryboardFrame({
  image,
  className,
  children,
}: {
  image: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <div className={`absolute inset-0 opacity-0 ${className}`}>
      <div className="preintro-artboard">
        <img
          src={image}
          alt=""
          className="absolute inset-0 h-full w-full"
          draggable={false}
        />
        {children}
      </div>
    </div>
  );
}

function FlagFlipbook() {
  return (
    <div className="absolute left-[46.35%] top-[1.95%] w-[30.8%] preintro-flag" aria-hidden="true">
      <img
        src="/assets/preintro/fallen-knight-flag.png"
        alt=""
        className="h-full w-full preintro-flag-image"
        draggable={false}
      />
      <svg
        className="preintro-flag-ripples"
        viewBox="0 0 455 373"
        preserveAspectRatio="none"
      >
        <path className="preintro-flag-ripple preintro-flag-ripple-one" d="M42 30 C82 64 67 103 101 145 C132 184 137 226 166 286" />
        <path className="preintro-flag-ripple preintro-flag-ripple-two" d="M145 66 C175 104 154 142 190 186 C224 226 219 255 253 320" />
        <path className="preintro-flag-ripple preintro-flag-ripple-three" d="M274 77 C304 119 293 156 329 203 C356 238 352 276 385 344" />
      </svg>
    </div>
  );
}

function CloudAndWaveFlicker({ variant = "beach" }: { variant?: "beach" | "death" }) {
  const isDeathFrame = variant === "death";

  return (
    <>
      <div
        className={`absolute left-[-8%] top-[5%] h-[24%] w-[120%] bg-[radial-gradient(ellipse_at_20%_45%,rgba(0,0,0,0.34)_0%,transparent_28%),radial-gradient(ellipse_at_56%_38%,rgba(0,0,0,0.26)_0%,transparent_31%),radial-gradient(ellipse_at_82%_50%,rgba(255,255,255,0.09)_0%,transparent_26%)] preintro-cloud-flicker ${
          isDeathFrame ? "opacity-45" : "opacity-70"
        }`}
      />
      <svg
        className={`absolute left-0 h-[22%] w-full preintro-wave-flicker ${
          isDeathFrame ? "bottom-[28%] opacity-35" : "bottom-[36%] opacity-50"
        }`}
        viewBox="0 0 1200 200"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M-20 112 C90 81 178 141 290 106 C420 66 496 139 626 101 C776 57 869 130 1006 96 C1098 73 1162 91 1220 78" fill="none" stroke="rgba(245,245,245,0.42)" strokeWidth="7" />
        <path d="M-15 147 C104 126 189 167 306 139 C429 110 541 161 665 134 C786 107 893 167 1018 131 C1095 108 1163 139 1220 119" fill="none" stroke="rgba(12,12,12,0.45)" strokeWidth="6" />
      </svg>
    </>
  );
}

function RainFlecks() {
  return (
    <div className="absolute inset-x-0 top-0 h-1/3 overflow-hidden preintro-rain-flecks" aria-hidden="true">
      {Array.from({ length: 52 }, (_, index) => (
        <span key={index} style={{ left: `${1 + index * 1.95}%`, animationDelay: `${index * -74}ms` }} />
      ))}
    </div>
  );
}

function DistantFigureFlicker() {
  return <div className="absolute left-[70.2%] top-[52.3%] h-[4.2%] w-[2.2%] rounded-full preintro-figure-flicker" />;
}

function DeathMist() {
  return (
    <svg
      className="absolute inset-x-[-10%] bottom-[18%] h-[36%] w-[120%] preintro-death-mist"
      viewBox="0 0 1200 320"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path className="preintro-mist-line preintro-mist-line-one" d="M-40 182 C120 140 236 217 392 178 C578 133 692 212 858 171 C1018 132 1114 175 1240 141" />
      <path className="preintro-mist-line preintro-mist-line-two" d="M-60 230 C108 198 252 249 420 220 C596 190 722 246 900 216 C1036 192 1140 222 1260 198" />
      <path className="preintro-mist-line preintro-mist-line-three" d="M-80 94 C76 70 196 126 352 102 C552 72 695 119 864 91 C1030 64 1145 96 1280 72" />
    </svg>
  );
}

function StormDarkening() {
  return <div className="absolute inset-0 preintro-storm-darkening" />;
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
    onBeginBoardIntro: (alreadyBlack?: boolean) => void;
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
