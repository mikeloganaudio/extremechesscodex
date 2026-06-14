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
import { chooseWeightedOpponentAction } from "@/game/opponentAi";
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
  const [dragToMoveEnabled, setDragToMoveEnabled] = useState(false);
  const [introFadeStage, setIntroFadeStage] = useState<"none" | "fade-out" | "hold" | "fade-in" | "slow-fade-in">("none");
  const [boardIntroReady, setBoardIntroReady] = useState(false);
  const [rubiksCheckMessageVisible, setRubiksCheckMessageVisible] = useState(false);
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
    handleRubiksShift,
    handleTurnAction,
    handlePromotion,
    resetGame,
    undoLastMove,
    canUndo,
    activatePawnBuff,
    deactivatePawnBuff,
  } = useChessGame(activeRules);
  const [opponentThinking, setOpponentThinking] = useState(false);
  const playerInputLocked =
    phase !== "playing" ||
    opponentThinking ||
    gameState.currentTurn === "black" ||
    !!gameState.promotionPending;

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
    if (!rubiksCheckMessageVisible) return;
    const timer = window.setTimeout(() => {
      setRubiksCheckMessageVisible(false);
    }, 4200);

    return () => window.clearTimeout(timer);
  }, [rubiksCheckMessageVisible]);

  useEffect(() => {
    if (phase !== "playing") return;
    if (gameState.currentTurn !== "black") return;
    if (gameState.promotionPending) return;
    if (gameState.status === "checkmate" || gameState.status === "stalemate") return;

    setOpponentThinking(true);
    const timer = window.setTimeout(() => {
      const action = chooseWeightedOpponentAction(gameState, activeRules);
      if (action) {
        handleTurnAction(action);
      }
      setOpponentThinking(false);
    }, 650 + Math.random() * 650);

    return () => {
      window.clearTimeout(timer);
      setOpponentThinking(false);
    };
  }, [activeRules, gameState, handleTurnAction, phase]);

  useEffect(() => {
    if (phase !== "intro-board") return;

    setBoardIntroReady(false);
    const timer = window.setTimeout(() => {
      setBoardIntroReady(true);
    }, 12800);

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
    setPhase("between-levels");
  }

  function handleBeginBoardIntro(alreadyBlack = false) {
    setBoardIntroReady(false);
    setPhase("intro-transition");

    if (alreadyBlack) {
      setIntroFadeStage("hold");

      window.setTimeout(() => {
        setPhase("intro-board");
      }, 120);

      window.setTimeout(() => {
        setCameraSequenceKey((key) => key + 1);
      }, 180);

      window.setTimeout(() => {
        setIntroFadeStage("slow-fade-in");
      }, 4300);

      window.setTimeout(() => {
        setIntroFadeStage("none");
      }, 6600);

      return;
    }

    setIntroFadeStage("fade-out");

    window.setTimeout(() => {
      setIntroFadeStage("hold");
    }, 350);

    window.setTimeout(() => {
      setPhase("intro-board");
      setIntroFadeStage("fade-in");
    }, 500);

    window.setTimeout(() => {
      setCameraSequenceKey((key) => key + 1);
      setIntroFadeStage("none");
    }, 850);
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
        <CampaignHUD
          levels={levelCatalog}
          activeLevel={activeLevel}
          gameState={gameState}
          onSelectLevel={handleSelectLevel}
          onNextLevel={handleShowNextLevelIntro}
        />

        {phase === "playing" && (
          <>
            <GameHUD gameState={gameState} onReset={resetGame} />
            {opponentThinking && (
              <div className="absolute left-1/2 top-16 z-30 -translate-x-1/2 rounded-lg border border-stone-700 bg-stone-950/82 px-4 py-2 text-sm text-stone-300 shadow-xl backdrop-blur">
                Death is considering...
              </div>
            )}
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
              onSquareClick={freeCameraEnabled || playerInputLocked ? () => undefined : handleSquareSelect}
              onRubiksShift={freeCameraEnabled || playerInputLocked ? undefined : handleRubiksShift}
              onRubiksCheckBlocked={() => setRubiksCheckMessageVisible(true)}
              snakesAndLadders={levelRuntime.snakesAndLadders}
              mines={levelRuntime.mines}
              theme={activeLevel.theme}
              rules={activeRules}
              dragToMoveEnabled={dragToMoveEnabled}
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

        {phase === "playing" && rubiksCheckMessageVisible && (
          <div className="eighth-dialog-shell eighth-dialog-warning absolute left-1/2 top-28 z-40 w-[min(560px,calc(100vw-32px))] -translate-x-1/2 px-4 py-3">
            <p className="text-red-200">
              The king is named. You cannot simply rotate reality away.
            </p>
            <p className="mt-1 text-xs leading-relaxed text-stone-400">
              Rule: while in check, Rubik shifts are locked. Resolve the check with a normal piece move.
            </p>
          </div>
        )}

        <RulesPanel
          gameState={gameState}
          level={activeLevel}
          snakesAndLadders={levelRuntime.snakesAndLadders}
          mines={levelRuntime.mines}
          dragToMoveEnabled={dragToMoveEnabled}
          freeCameraEnabled={freeCameraEnabled}
          onDragToMoveChange={setDragToMoveEnabled}
          onFreeCameraChange={setFreeCameraEnabled}
          onResetGame={resetGame}
          onUndoMove={undoLastMove}
          canUndoMove={canUndo}
          onActivatePawnBuff={activatePawnBuff}
          onDeactivatePawnBuff={deactivatePawnBuff}
          onSetSnakesAndLadders={handleSetSnakesAndLadders}
          onGenerateSnakesAndLadders={handleGenerateSnakesAndLadders}
        />

        {phase === "playing" && (
          <>
            <div className="absolute bottom-4 right-4 z-10">
              <MoveHistory moves={gameState.moveHistory} />
            </div>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
              <p className="text-stone-600 text-xs whitespace-nowrap">
                {freeCameraEnabled
                  ? "Free camera - Right-drag to orbit - Middle-drag to pan - Wheel or pinch to zoom"
                  : opponentThinking
                    ? "Death is considering..."
                    : activeRules.rubiksMode
                    ? `${dragToMoveEnabled ? "Drag pieces to highlighted squares - " : "Tap piece then highlighted square - "}Drag rows or files to shift them - Right-drag to orbit`
                    : dragToMoveEnabled
                    ? "Drag pieces to highlighted squares - Or tap piece then highlighted square - Right-drag to orbit"
                    : "Tap piece - Tap highlighted square - Right-drag to orbit"}
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
                ? "animate-[fadeToBlack_350ms_ease-in_forwards]"
                : introFadeStage === "fade-in"
                  ? "animate-[fadeFromBlack_350ms_ease-out_forwards]"
                  : introFadeStage === "slow-fade-in"
                    ? "animate-[fadeFromBlack_2200ms_ease-in-out_forwards]"
                  : "opacity-100"
            }`}
          />
        )}
      </div>
    </WebGLCheck>
  );
}
