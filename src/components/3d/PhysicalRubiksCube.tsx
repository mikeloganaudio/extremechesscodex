import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { ChessPiece } from "./ChessPiece";
import { getLegalTurnActions, isInCheck } from "@/game/engine";
import { defaultRules } from "@/game/defaultRules";
import type { GameState, PieceColor, PieceType, Square } from "@/game/types";

type Vec3 = [number, number, number];
type FaceId = "top" | "bottom" | "front" | "back" | "right" | "left";

interface Sticker {
  id: string;
  cell: Vec3;
  normal: Vec3;
  u: Vec3;
  v: Vec3;
  color: number;
}

interface CubePiece {
  id: string;
  cell: Vec3;
  normal: Vec3;
  type: PieceType;
  color: PieceColor;
  hasMoved?: boolean;
}

interface TurnState {
  axis: Vec3;
  layer: number;
  angle: number;
}

interface SelectedPiece {
  id: string;
  face: FaceId;
  validTargets: Square[];
}

const SIZE = 8;
const HALF = 3.5;
const OUTER = 4.18;
const STICKER_COLORS = [0xffffff, 0xe5cf25, 0xee7d2e, 0xd7192b, 0x158946, 0x285ac0];

const FACES: Record<FaceId, { normal: Vec3; u: Vec3; v: Vec3 }> = {
  top: { normal: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  bottom: { normal: [0, -1, 0], u: [1, 0, 0], v: [0, 0, -1] },
  front: { normal: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  back: { normal: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
  right: { normal: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
  left: { normal: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
};

function vector(value: Vec3) {
  return new THREE.Vector3(...value);
}

function tuple(value: THREE.Vector3): Vec3 {
  return [value.x, value.y, value.z];
}

function rounded(value: THREE.Vector3): Vec3 {
  return [Math.round(value.x), Math.round(value.y), Math.round(value.z)];
}

function cellFor(face: FaceId, row: number, col: number) {
  const basis = FACES[face];
  return vector(basis.normal)
    .multiplyScalar(HALF)
    .addScaledVector(vector(basis.u), col - HALF)
    .addScaledVector(vector(basis.v), HALF - row);
}

function stickerFor(face: FaceId, row: number, col: number, faceIndex: number): Sticker {
  const basis = FACES[face];
  const globalIndex = faceIndex * SIZE * SIZE + row * SIZE + col;
  // A coprime permutation scrambles the visual order while assigning each of
  // the six colours to exactly 64 of the cube's 384 stickers.
  const colourSlot = Math.floor(((globalIndex * 73 + 19) % (SIZE * SIZE * 6)) / (SIZE * SIZE));
  return {
    id: `${face}-${row}-${col}`,
    cell: tuple(cellFor(face, row, col)),
    normal: basis.normal,
    u: basis.u,
    v: basis.v,
    color: STICKER_COLORS[colourSlot],
  };
}

const BACK_RANK: PieceType[] = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"];

function makePieces(face: FaceId): CubePiece[] {
  const basis = FACES[face];
  const pieces: CubePiece[] = [];
  BACK_RANK.forEach((type, col) => {
    // The shared chess engine advances White toward increasing row numbers.
    // Keep every cube face aligned with that convention from the start.
    pieces.push({ id: `${face}-white-${type}-${col}`, cell: tuple(cellFor(face, 0, col)), normal: basis.normal, type, color: "white" });
    pieces.push({ id: `${face}-black-${type}-${col}`, cell: tuple(cellFor(face, 7, col)), normal: basis.normal, type, color: "black" });
    pieces.push({ id: `${face}-white-pawn-${col}`, cell: tuple(cellFor(face, 1, col)), normal: basis.normal, type: "pawn", color: "white" });
    pieces.push({ id: `${face}-black-pawn-${col}`, cell: tuple(cellFor(face, 6, col)), normal: basis.normal, type: "pawn", color: "black" });
  });
  return pieces;
}

function belongsToSlice(cell: Vec3, turn: TurnState | null) {
  return !!turn && Math.abs(vector(cell).dot(vector(turn.axis)) - turn.layer) < 0.1;
}

function rotateSticker(sticker: Sticker, turn: TurnState): Sticker {
  const axis = vector(turn.axis);
  return {
    ...sticker,
    cell: rounded(vector(sticker.cell).applyAxisAngle(axis, turn.angle)),
    normal: rounded(vector(sticker.normal).applyAxisAngle(axis, turn.angle)),
    u: rounded(vector(sticker.u).applyAxisAngle(axis, turn.angle)),
    v: rounded(vector(sticker.v).applyAxisAngle(axis, turn.angle)),
  };
}

function rotatePiece(piece: CubePiece, turn: TurnState): CubePiece {
  const axis = vector(turn.axis);
  return {
    ...piece,
    cell: rounded(vector(piece.cell).applyAxisAngle(axis, turn.angle)),
    normal: rounded(vector(piece.normal).applyAxisAngle(axis, turn.angle)),
  };
}

function orientationForNormal(normal: Vec3) {
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vector(normal));
  const euler = new THREE.Euler().setFromQuaternion(quaternion);
  return [euler.x, euler.y, euler.z] as [number, number, number];
}

function faceForNormal(normal: Vec3): FaceId {
  return (Object.keys(FACES) as FaceId[]).find((face) => vector(FACES[face].normal).distanceTo(vector(normal)) < 0.1) ?? "top";
}

function squareOnFace(cell: Vec3, face: FaceId): Square {
  const basis = FACES[face];
  const cellVector = vector(cell);
  return {
    row: Math.round(HALF - cellVector.dot(vector(basis.v))),
    col: Math.round(cellVector.dot(vector(basis.u)) + HALF),
  };
}

function cellOnFace(face: FaceId, square: Square) {
  return tuple(cellFor(face, square.row, square.col));
}

function chessPiecesForFace(pieces: CubePiece[], face: FaceId) {
  return pieces
    .filter((piece) => faceForNormal(piece.normal) === face)
    .map((piece) => ({
      id: piece.id,
      type: piece.type,
      color: piece.color,
      hasMoved: piece.hasMoved,
      ...squareOnFace(piece.cell, face),
    }));
}

export function PhysicalRubiksCube({ onTurnActive }: { onTurnActive?: (active: boolean) => void }) {
  const [stickers, setStickers] = useState<Sticker[]>(() =>
    (Object.keys(FACES) as FaceId[]).flatMap((face, faceIndex) =>
      Array.from({ length: SIZE * SIZE }, (_, index) => stickerFor(face, Math.floor(index / SIZE), index % SIZE, faceIndex)),
    ),
  );
  const [pieces, setPieces] = useState<CubePiece[]>(() => (Object.keys(FACES) as FaceId[]).flatMap(makePieces));
  const [turn, setTurn] = useState<TurnState | null>(null);
  const [selected, setSelected] = useState<SelectedPiece | null>(null);
  const [faceTurns, setFaceTurns] = useState<Record<FaceId, PieceColor>>({
    top: "white", bottom: "white", front: "white", back: "white", right: "white", left: "white",
  });
  const piecesRef = useRef<CubePiece[]>(pieces);
  const faceTurnsRef = useRef(faceTurns);
  const dragRef = useRef<{ sticker: Sticker; startX: number; startY: number; axis: Vec3 | null; layer: number } | null>(null);
  const settleTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (settleTimer.current) window.clearTimeout(settleTimer.current);
  }, []);

  useEffect(() => {
    piecesRef.current = pieces;
    faceTurnsRef.current = faceTurns;
  }, [faceTurns, pieces]);

  const updateRotationDrag = useCallback((clientX: number, clientY: number) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = clientX - drag.startX;
    const dy = clientY - drag.startY;
    if (!drag.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 6) {
      const useHorizontal = Math.abs(dx) >= Math.abs(dy);
      drag.axis = useHorizontal ? drag.sticker.v : drag.sticker.u;
      drag.layer = Math.round(vector(drag.sticker.cell).dot(vector(drag.axis)));
    }
    if (!drag.axis) return;
    const displacement = Math.abs(dx) >= Math.abs(dy) ? dx : -dy;
    setTurn({ axis: drag.axis, layer: drag.layer, angle: THREE.MathUtils.clamp(displacement * 0.012, -Math.PI / 2, Math.PI / 2) });
  }, []);

  const finishRotationDrag = useCallback(() => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    setTurn((current) => {
      if (!current || Math.abs(current.angle) < 0.22) {
        onTurnActive?.(false);
        return null;
      }
      const settled: TurnState = { ...current, angle: current.angle > 0 ? Math.PI / 2 : -Math.PI / 2 };
      const rotatedPieces = piecesRef.current.map((piece) => belongsToSlice(piece.cell, settled) ? rotatePiece(piece, settled) : piece);
      // A physical turn distributes a rank across several faces. Treating every
      // intermediate face as a complete chess board makes that transient state
      // look like a check and rejects every turn. The press-time guard below is
      // the meaningful rule here: a face already in check must be resolved by a
      // chess move, not rotated away.
      settleTimer.current = window.setTimeout(() => {
        setStickers((previous) => previous.map((sticker) => belongsToSlice(sticker.cell, settled) ? rotateSticker(sticker, settled) : sticker));
        setPieces(rotatedPieces);
        setTurn(null);
        onTurnActive?.(false);
      }, 180);
      return settled;
    });
  }, [onTurnActive]);

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      updateRotationDrag(event.clientX, event.clientY);
    };
    const handleUp = () => finishRotationDrag();
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [finishRotationDrag, updateRotationDrag]);

  const split = useMemo(() => ({
    staticStickers: stickers.filter((sticker) => !belongsToSlice(sticker.cell, turn)),
    movingStickers: stickers.filter((sticker) => belongsToSlice(sticker.cell, turn)),
    staticPieces: pieces.filter((piece) => !belongsToSlice(piece.cell, turn)),
    movingPieces: pieces.filter((piece) => belongsToSlice(piece.cell, turn)),
  }), [pieces, stickers, turn]);

  const turnQuaternion = useMemo(() => {
    if (!turn) return new THREE.Quaternion();
    return new THREE.Quaternion().setFromAxisAngle(vector(turn.axis), turn.angle);
  }, [turn]);

  const selectPiece = (piece: CubePiece) => {
    if (turn) return;
    const face = faceForNormal(piece.normal);
    if (piece.color !== faceTurns[face]) {
      setSelected(null);
      return;
    }
    const facePieces = chessPiecesForFace(pieces, face);
    const state: GameState = {
      pieces: facePieces,
      currentTurn: faceTurns[face],
      status: "playing",
      selectedSquare: null,
      validMoves: [],
      moveHistory: [],
      enPassantTarget: null,
      capturedWhite: [],
      capturedBlack: [],
      promotionPending: null,
      pawnBuffMovesLeft: 0,
    };
    const validTargets = getLegalTurnActions(state, defaultRules)
      .filter((action) => action.kind === "move" && action.move.from.row === squareOnFace(piece.cell, face).row && action.move.from.col === squareOnFace(piece.cell, face).col)
      .map((action) => action.kind === "move" ? action.move.to : null)
      .filter((square): square is Square => !!square);
    setSelected({ id: piece.id, face, validTargets });
  };

  const tryMoveToSticker = (sticker: Sticker) => {
    if (!selected || turn) return false;
    const face = faceForNormal(sticker.normal);
    const target = squareOnFace(sticker.cell, face);
    if (face !== selected.face || !selected.validTargets.some((square) => square.row === target.row && square.col === target.col)) {
      setSelected(null);
      return false;
    }
    setPieces((previous) => previous
      .filter((piece) => {
        if (piece.id === selected.id) return true;
        return !(faceForNormal(piece.normal) === face && squareOnFace(piece.cell, face).row === target.row && squareOnFace(piece.cell, face).col === target.col);
      })
      .map((piece) => piece.id === selected.id ? { ...piece, cell: cellOnFace(face, target), normal: FACES[face].normal, hasMoved: true } : piece));
    setFaceTurns((previous) => ({ ...previous, [face]: previous[face] === "white" ? "black" : "white" }));
    setSelected(null);
    return true;
  };

  const beginRotationDrag = (sticker: Sticker, event: { clientX: number; clientY: number }) => {
    if (turn || settleTimer.current || selected) return;
    const face = faceForNormal(sticker.normal);
    // This is deliberately checked before the drag begins. It preserves the
    // level rule that a player cannot turn reality merely to escape check.
    if (isInCheck(chessPiecesForFace(piecesRef.current, face), faceTurnsRef.current[face], defaultRules)) return;
    dragRef.current = {
      sticker,
      startX: event.clientX,
      startY: event.clientY,
      axis: null,
      layer: 0,
    };
    onTurnActive?.(true);
  };

  const renderSticker = (sticker: Sticker) => {
    const position = vector(sticker.cell).addScaledVector(vector(sticker.normal), 0.69);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vector(sticker.normal));
    const face = faceForNormal(sticker.normal);
    const square = squareOnFace(sticker.cell, face);
    const isLegalTarget = selected?.face === face && selected.validTargets.some((target) => target.row === square.row && target.col === square.col);
    return (
      <mesh
        key={sticker.id}
        position={position}
        quaternion={quaternion}
        castShadow
        receiveShadow
        onPointerDown={(event) => {
          event.stopPropagation();
          if (turn || settleTimer.current) return;
          // Moves are committed by click below. Keeping pointer-down exclusively
          // for turn drags stops a target click from being swallowed by a drag.
          if (!selected) {
            const target = event.nativeEvent.target;
            if (target === null) return;

            if (target instanceof Element) {
              target.setPointerCapture(event.pointerId);
            }
            beginRotationDrag(sticker, event.nativeEvent);
          }
        }}
        onPointerMove={(event) => {
          if (!dragRef.current) return;
          event.stopPropagation();
          updateRotationDrag(event.nativeEvent.clientX, event.nativeEvent.clientY);
        }}
        onPointerUp={(event) => {
          if (!dragRef.current) return;
          event.stopPropagation();
          const target = event.nativeEvent.target;
          if (target instanceof Element && target.hasPointerCapture(event.pointerId)) {
            target.releasePointerCapture(event.pointerId);
          }
          finishRotationDrag();
        }}
        onClick={(event) => {
          event.stopPropagation();
          if (!selected || turn || settleTimer.current) return;
          tryMoveToSticker(sticker);
        }}
      >
        <boxGeometry args={[0.84, 0.09, 0.84]} />
        <meshLambertMaterial color={sticker.color} />
        {isLegalTarget && (
          <mesh position={[0, 0.06, 0]} raycast={() => null}>
            <boxGeometry args={[0.88, 0.035, 0.88]} />
            <meshBasicMaterial color={0x05f20e} transparent opacity={0.72} />
          </mesh>
        )}
      </mesh>
    );
  };

  const renderPiece = (piece: CubePiece) => {
    // ChessPiece's local base sits at y=0, so place that origin just beyond
    // the sticker rather than inside the cube body.
    const position = vector(piece.cell).addScaledVector(vector(piece.normal), 0.76);
    return (
      <group
        key={piece.id}
      >
        <ChessPiece
          type={piece.type}
          color={piece.color}
          position={tuple(position)}
          isSelected={selected?.id === piece.id}
          isConveying={!!turn}
          sliceRotation={orientationForNormal(piece.normal)}
          onPointerDown={(event) => {
            event.stopPropagation();
            if (turn || settleTimer.current) return;
            selectPiece(piece);
          }}
        />
      </group>
    );
  };

  return (
    <group position={[0, -4.18, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[8.36, 8.36, 8.36]} />
        <meshLambertMaterial color={0x060606} />
      </mesh>
      {split.staticStickers.map(renderSticker)}
      {split.staticPieces.map(renderPiece)}
      {turn && (
        <group quaternion={turnQuaternion}>
          {split.movingStickers.map(renderSticker)}
          {split.movingPieces.map(renderPiece)}
        </group>
      )}
    </group>
  );
}
