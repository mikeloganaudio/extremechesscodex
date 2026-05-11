import { Suspense, useEffect, useMemo, useState } from "react";
import { ChessBoard3D } from "@/components/3d/ChessBoard";
import { CampaignHUD } from "@/components/CampaignHUD";
import { CutsceneOverlay } from "@/components/CutsceneOverlay";
import { GameHUD } from "@/components/GameHUD";
import { MoveHistory } from "@/components/MoveHistory";
import { PromotionModal } from "@/components/PromotionModal";
import { RulesPanel } from "@/components/RulesPanel";
import { WebGLCheck } from "@/components/WebGLCheck";
import { useChessGame } from "@/game/useChessGame";
import { generateSnakesAndLadders } from "@/game/snakesLadders";
import { levelCatalog } from "@/levels/levelCatalog";
import {
  createLevelRules,
  createLevelRuntime,
  randomSnakeLadderCount,
} from "@/levels/levelRuntime";
import type { CampaignPhase } from "@/levels/types";

export default function ChessGame() {
  const [activeLevelIndex, setActiveLevelIndex] = useState(0);
  const [phase, setPhase] = useState<CampaignPhase>("intro-video");
  const [cameraSequenceKey, setCameraSequenceKey] = useState(0);
  const [freeCameraEnabled, setFreeCameraEnabled] = useState(false);
  const [introFadeStage, setIntroFadeStage] = useState<"none" | "fade-out" | "hold" | "fade-in">("none");
  const [boardIntroReady, setBoardIntroReady] = useState(false);
  const activeLevel = levelCatalog[activeLevelIndex];
  const hasNextLevel = activeLevelIndex < levelCatalog.length - 1;
  const [levelRuntime, setLevelRuntime] = useState(() =>
    createLevelRuntime(activeLevel),
  );

  const activeRules = useMemo(
    () => createLevelRules(activeLevel, levelRuntime),
    [activeLevel, levelRuntime],
  );

  const {
    gameState,
    handleSquareSelect,
    handlePromotion,
    resetGame,
    activatePawnBuff,
    deactivatePawnBuff,
  } = useChessGame(activeRules);

  useEffect(() => {
    if (phase === "playing" && gameState.status === "checkmate") {
      setPhase("post-level");
    }
  }, [gameState.status, phase]);

  useEffect(() => {
    if (phase !== "playing") {
      setFreeCameraEnabled(false);
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== "intro-board") return;

    setBoardIntroReady(false);
    const timer = window.setTimeout(() => {
      setBoardIntroReady(true);
    }, 8500);

    return () => window.clearTimeout(timer);
  }, [cameraSequenceKey, phase]);

  function loadLevel(index: number) {
    const nextLevel = levelCatalog[index];
    if (!nextLevel) return;

    setActiveLevelIndex(index);
    setLevelRuntime(createLevelRuntime(nextLevel));
    resetGame();
  }

  function handleSelectLevel(index: number) {
    loadLevel(index);
    setBoardIntroReady(false);
    setPhase(index === 0 ? "intro-video" : "between-levels");
  }

  function handleBeginBoardIntro() {
    setBoardIntroReady(false);
    setPhase("intro-transition");
    setIntroFadeStage("fade-out");

    window.setTimeout(() => {
      setIntroFadeStage("hold");
    }, 500);

    window.setTimeout(() => {
      setPhase("intro-board");
      setIntroFadeStage("fade-in");
    }, 1000);

    window.setTimeout(() => {
      setCameraSequenceKey((key) => key + 1);
      setIntroFadeStage("none");
    }, 1500);
  }

  function handleStartPlaying() {
    setBoardIntroReady(false);
    setPhase("playing");
  }

  function handleShowNextLevelIntro() {
    loadLevel(activeLevelIndex + 1);
    setPhase("between-levels");
  }

  function handleRestartLevel() {
    resetGame();
    setBoardIntroReady(false);
    setCameraSequenceKey((key) => key + 1);
    setPhase("intro-board");
  }

  function handleGenerateSnakesAndLadders() {
    setLevelRuntime((runtime) => ({
      ...runtime,
      snakesAndLadders: generateSnakesAndLadders(randomSnakeLadderCount()),
    }));
  }

  function handleSetSnakesAndLadders(
    snakesAndLadders: typeof levelRuntime.snakesAndLadders,
  ) {
    setLevelRuntime((runtime) => ({ ...runtime, snakesAndLadders }));
  }

  return (
    <WebGLCheck>
      <div className={`w-full h-screen ${activeLevel.theme.backgroundClassName} flex flex-col relative overflow-hidden`}>
        {phase === "playing" && (
          <>
            <GameHUD gameState={gameState} onReset={resetGame} />
            <CampaignHUD
              levels={levelCatalog}
              activeLevel={activeLevel}
              gameState={gameState}
              onSelectLevel={handleSelectLevel}
              onNextLevel={handleShowNextLevelIntro}
            />
          </>
        )}

        <div className="flex-1 relative">
          <Suspense
            fallback={
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-stone-400 text-sm">Loading board...</div>
              </div>
            }
          >
            <ChessBoard3D
              gameState={gameState}
              onSquareClick={freeCameraEnabled ? () => undefined : handleSquareSelect}
              snakesAndLadders={levelRuntime.snakesAndLadders}
              mines={levelRuntime.mines}
              theme={activeLevel.theme}
              cameraMode={
                phase === "intro-board"
                  ? introFadeStage === "fade-in"
                    ? "intro-hold"
                    : "intro"
                  : "play"
              }
              cameraSequenceKey={cameraSequenceKey}
              freeCamera={freeCameraEnabled}
            />
          </Suspense>

          {phase === "playing" && gameState.promotionPending && (
            <PromotionModal
              color={gameState.currentTurn === "white" ? "black" : "white"}
              options={activeLevel.baseRules.promotionPieces}
              onSelect={handlePromotion}
            />
          )}
        </div>

        {phase === "playing" && (
          <>
            <div className="absolute bottom-4 right-4 z-10">
              <MoveHistory moves={gameState.moveHistory} />
            </div>

            <div className="absolute bottom-4 left-4 z-10 flex gap-2 items-end">
              <button
                onClick={resetGame}
                className="px-4 py-2 bg-stone-800/80 hover:bg-stone-700/80 backdrop-blur border border-stone-700 text-stone-300 text-sm rounded-lg transition-colors"
              >
                New Game
              </button>
              <button
                onClick={() => setFreeCameraEnabled((enabled) => !enabled)}
                className={`px-4 py-2 backdrop-blur border text-sm rounded-lg transition-colors ${
                  freeCameraEnabled
                    ? "bg-sky-200/90 hover:bg-sky-100/90 border-sky-100 text-stone-950"
                    : "bg-stone-800/80 hover:bg-stone-700/80 border-stone-700 text-stone-300"
                }`}
              >
                {freeCameraEnabled ? "Return Camera" : "Free Camera"}
              </button>
            </div>

            <div className="absolute top-16 right-4 z-20">
              <RulesPanel
                gameState={gameState}
                level={activeLevel}
                snakesAndLadders={levelRuntime.snakesAndLadders}
                mines={levelRuntime.mines}
                onActivatePawnBuff={activatePawnBuff}
                onDeactivatePawnBuff={deactivatePawnBuff}
                onSetSnakesAndLadders={handleSetSnakesAndLadders}
                onGenerateSnakesAndLadders={handleGenerateSnakesAndLadders}
              />
            </div>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
              <p className="text-stone-600 text-xs whitespace-nowrap">
                {freeCameraEnabled
                  ? "Free camera - Drag to orbit - Right-drag to pan - Wheel or pinch to zoom"
                  : "Tap a piece - Tap a green dot to move - Pinch to zoom - Drag to orbit"}
              </p>
            </div>
          </>
        )}

        <CutsceneOverlay
          phase={phase}
          level={activeLevel}
          hasNextLevel={hasNextLevel}
          boardIntroReady={boardIntroReady}
          onBeginBoardIntro={handleBeginBoardIntro}
          onStartPlaying={handleStartPlaying}
          onShowNextLevelIntro={handleShowNextLevelIntro}
          onChallengeAgain={handleRestartLevel}
        />

        {introFadeStage !== "none" && (
          <div
            className={`absolute inset-0 z-50 bg-black pointer-events-none ${
              introFadeStage === "fade-out"
                ? "animate-[fadeToBlack_500ms_ease-in_forwards]"
                : introFadeStage === "fade-in"
                  ? "animate-[fadeFromBlack_500ms_ease-out_forwards]"
                  : "opacity-100"
            }`}
          />
        )}
      </div>
    </WebGLCheck>
  );
}
