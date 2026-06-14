import { useState, useCallback, useRef } from "react";
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
  const undoStackRef = useRef<GameState[]>([]);

  const pushUndoState = useCallback((state: GameState) => {
    undoStackRef.current.push({
      ...state,
      pieces: state.pieces.map((piece) => ({ ...piece })),
      selectedSquare: null,
      validMoves: [],
      moveHistory: state.moveHistory.map((move) => ({ ...move })),
      capturedWhite: state.capturedWhite.map((piece) => ({ ...piece })),
      capturedBlack: state.capturedBlack.map((piece) => ({ ...piece })),
      enPassantTarget: state.enPassantTarget ? { ...state.enPassantTarget } : null,
      promotionPending: state.promotionPending ? { ...state.promotionPending } : null,
    });
  }, []);

  const handleSquareSelect = useCallback(
    (row: number, col: number) => {
      setGameState((prev) => {
        const next = selectSquare(prev, row, col, rules);
        if (next.moveHistory.length > prev.moveHistory.length) {
          pushUndoState(prev);
        }
        return next;
      });
    },
    [pushUndoState, rules],
  );

  const handlePromotion = useCallback(
    (pieceType: PieceType) => {
      setGameState((prev) => promotePane(prev, pieceType, rules));
    },
    [rules],
  );

  const handleRubiksShift = useCallback(
    (shift: RubiksShift) => {
      setGameState((prev) => {
        const next = applyRubiksShift(prev, shift, rules);
        if (next.moveHistory.length > prev.moveHistory.length) {
          pushUndoState(prev);
        }
        return next;
      });
    },
    [pushUndoState, rules],
  );

  const handleTurnAction = useCallback(
    (action: TurnAction) => {
      setGameState((prev) => {
        const next = applyTurnAction(prev, action, rules);
        if (next.moveHistory.length > prev.moveHistory.length) {
          pushUndoState(prev);
        }
        return next;
      });
    },
    [pushUndoState, rules],
  );

  const resetGame = useCallback(() => {
    undoStackRef.current = [];
    setGameState(createInitialGameState());
  }, []);

  const undoLastMove = useCallback(() => {
    const previousState = undoStackRef.current.pop();
    if (!previousState) return;
    setGameState(previousState);
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
    undoLastMove,
    canUndo: undoStackRef.current.length > 0,
    clearSelection,
    activatePawnBuff,
    deactivatePawnBuff,
  };
}
