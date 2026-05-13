import { useState, useCallback } from "react";
import type { GameState, PieceType, RulesConfig, RubiksShift, TurnAction } from "./types";
import {
  applyRubiksShift,
  applyTurnAction,
  createInitialGameState,
  selectSquare,
  promotePane,
} from "./engine";
import { defaultRules } from "./defaultRules";

const PAWN_BUFF_DURATION = 3; // half-moves the buff lasts

export function useChessGame(rules: RulesConfig = defaultRules) {
  const [gameState, setGameState] = useState<GameState>(createInitialGameState);

  const handleSquareSelect = useCallback(
    (row: number, col: number) => {
      setGameState((prev) => selectSquare(prev, row, col, rules));
    },
    [rules],
  );

  const handlePromotion = useCallback(
    (pieceType: PieceType) => {
      setGameState((prev) => promotePane(prev, pieceType, rules));
    },
    [rules],
  );

  const handleRubiksShift = useCallback(
    (shift: RubiksShift) => {
      setGameState((prev) => applyRubiksShift(prev, shift, rules));
    },
    [rules],
  );

  const handleTurnAction = useCallback(
    (action: TurnAction) => {
      setGameState((prev) => applyTurnAction(prev, action, rules));
    },
    [rules],
  );

  const resetGame = useCallback(() => {
    setGameState(createInitialGameState());
  }, []);

  const clearSelection = useCallback(() => {
    setGameState((prev) => ({ ...prev, selectedSquare: null, validMoves: [] }));
  }, []);

  /**
   * Activate the pawn +1 range buff.
   * Overwrites any remaining countdown with the full duration.
   */
  const activatePawnBuff = useCallback(() => {
    setGameState((prev) => ({
      ...prev,
      pawnBuffMovesLeft: PAWN_BUFF_DURATION,
      // Re-compute valid moves for currently selected piece, if any
      selectedSquare: null,
      validMoves: [],
    }));
  }, []);

  /**
   * Cancel the pawn buff immediately.
   */
  const deactivatePawnBuff = useCallback(() => {
    setGameState((prev) => ({
      ...prev,
      pawnBuffMovesLeft: 0,
      selectedSquare: null,
      validMoves: [],
    }));
  }, []);

  return {
    gameState,
    handleSquareSelect,
    handleRubiksShift,
    handleTurnAction,
    handlePromotion,
    resetGame,
    clearSelection,
    activatePawnBuff,
    deactivatePawnBuff,
  };
}
