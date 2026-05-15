import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import type { GameState, Mine, Move, Piece, RubiksShift, Square, SnakeLadder } from "@/game/types";
import type { BoardThemeConfig } from "@/levels/types";
import { ChessPiece } from "./ChessPiece";
import { BoardEnvironment } from "./BoardEnvironment";
import { SnakeLadderOverlay } from "./SnakeLadder3D";
import { boardToWorld } from "@/utils/boardUtils";
import { BOARD_ELEVATION, BOARD_TARGET } from "./sceneLayout";

const SQUARE_SIZE = 1;
const COL_LETTERS = ["a", "b", "c", "d", "e", "f", "g", "h"];

type RubiksColorName = "white" | "yellow" | "orange" | "red" | "green" | "blue";

const RUBIKS_PALETTE: Record<RubiksColorName, number> = {
  white: 0xf2f0e8,
  yellow: 0xffd21f,
  orange: 0xff7a18,
  red: 0xdb2027,
  green: 0x179b49,
  blue: 0x1657d8,
};

const RUBIKS_COLOR_LAYOUT: RubiksColorName[] = (() => {
  const colors: RubiksColorName[] = ["white", "yellow", "orange", "red", "green", "blue"];
  const layout: RubiksColorName[] = [
    ...colors.flatMap((color) => Array.from({ length: 10 }, () => color)),
    "white",
    "red",
    "green",
    "blue",
  ];

  let seed = 831331;
  for (let i = layout.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    const j = seed % (i + 1);
    [layout[i], layout[j]] = [layout[j], layout[i]];
  }

  return layout;
})();

function getRubiksSquareColor(row: number, col: number) {
  const colorName = RUBIKS_COLOR_LAYOUT[row * 8 + col];
  return RUBIKS_PALETTE[colorName];
}

function createRoundedSquareShape(size: number, radius: number) {
  const half = size / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-half + radius, -half);
  shape.lineTo(half - radius, -half);
  shape.quadraticCurveTo(half, -half, half, -half + radius);
  shape.lineTo(half, half - radius);
  shape.quadraticCurveTo(half, half, half - radius, half);
  shape.lineTo(-half + radius, half);
  shape.quadraticCurveTo(-half, half, -half, half - radius);
  shape.lineTo(-half, -half + radius);
  shape.quadraticCurveTo(-half, -half, -half + radius, -half);
  return shape;
}

const PIXEL_FONT: Record<string, string[]> = {
  "0": ["111", "101", "101", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "010", "010", "111"],
  "2": ["111", "001", "001", "111", "100", "100", "111"],
  "3": ["111", "001", "001", "111", "001", "001", "111"],
  "4": ["101", "101", "101", "111", "001", "001", "001"],
  "5": ["111", "100", "100", "111", "001", "001", "111"],
  "6": ["111", "100", "100", "111", "101", "101", "111"],
  "7": ["111", "001", "001", "010", "010", "010", "010"],
  "8": ["111", "101", "101", "111", "101", "101", "111"],
  "9": ["111", "101", "101", "111", "001", "001", "111"],
  a: ["010", "101", "101", "111", "101", "101", "101"],
  b: ["110", "101", "101", "110", "101", "101", "110"],
  c: ["011", "100", "100", "100", "100", "100", "011"],
  d: ["110", "101", "101", "101", "101", "101", "110"],
  e: ["111", "100", "100", "110", "100", "100", "111"],
  f: ["111", "100", "100", "110", "100", "100", "100"],
  g: ["011", "100", "100", "101", "101", "101", "011"],
  h: ["101", "101", "101", "111", "101", "101", "101"],
  m: ["101", "111", "111", "101", "101", "101", "101"],
  n: ["101", "111", "111", "111", "101", "101", "101"],
  u: ["101", "101", "101", "101", "101", "101", "111"],
  ":": ["0", "1", "1", "0", "1", "1", "0"],
};

function PixelLabel({
  text,
  position,
  rotation,
  pixelSize = 0.045,
  color = 0x142414,
  opacity = 0.82,
}: {
  text: string;
  position: [number, number, number];
  rotation: [number, number, number];
  pixelSize?: number;
  color?: number;
  opacity?: number;
}) {
  const pixels: React.ReactNode[] = [];
  const gap = pixelSize * 0.36;
  const charGap = pixelSize * 1.12;
  let cursor = 0;

  text.toLowerCase().split("").forEach((char, charIndex) => {
    const pattern = PIXEL_FONT[char] ?? PIXEL_FONT["0"];
    const width = Math.max(...pattern.map((row) => row.length));

    pattern.forEach((line, row) => {
      line.split("").forEach((bit, col) => {
        if (bit !== "1") return;
        pixels.push(
          <mesh
            key={`${charIndex}-${row}-${col}`}
            position={[
              cursor + col * (pixelSize + gap),
              -row * (pixelSize + gap),
              0,
            ]}
            raycast={() => null}
          >
            <boxGeometry args={[pixelSize, pixelSize, 0.012]} />
            <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
          </mesh>,
        );
      });
    });

    cursor += width * (pixelSize + gap) + charGap;
  });

  const totalWidth = Math.max(0, cursor - charGap);
  const totalHeight = 7 * pixelSize + 6 * gap;

  return (
    <group position={position} rotation={rotation}>
      <group position={[-totalWidth / 2, totalHeight / 2, 0]}>{pixels}</group>
    </group>
  );
}

/* ── Board notation labels ── */
function BoardNotation({ theme }: { theme: BoardThemeConfig }) {
  if (theme.boardDecor === "retro-lcd") return <RetroBoardNotation />;
  if (theme.boardDecor === "rubiks") return <RubiksBoardNotation />;
  if (theme.boardDecor === "racing") return <RacingBoardNotation />;

  const labelColor = "#b8a090";
  const labelSize = 0.22;
  const labelOpacity = 0.55;

  const labels: React.ReactNode[] = [];

  for (let col = 0; col < 8; col++) {
    const wx = col * SQUARE_SIZE - 3.5;
    labels.push(
      <Text
        key={`col-front-${col}`}
        position={[wx, 0.01, 4.55]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={labelSize}
        color={labelColor}
        fillOpacity={labelOpacity}
        anchorX="center"
        anchorY="middle"
        font={undefined}
      >
        {COL_LETTERS[col]}
      </Text>
    );
    labels.push(
      <Text
        key={`col-back-${col}`}
        position={[wx, 0.01, -4.55]}
        rotation={[-Math.PI / 2, 0, Math.PI]}
        fontSize={labelSize}
        color={labelColor}
        fillOpacity={labelOpacity}
        anchorX="center"
        anchorY="middle"
        font={undefined}
      >
        {COL_LETTERS[col]}
      </Text>
    );
  }

  for (let row = 0; row < 8; row++) {
    const wz = -(row * SQUARE_SIZE - 3.5);
    const rankNum = String(row + 1);
    labels.push(
      <Text
        key={`row-left-${row}`}
        position={[-4.55, 0.01, wz]}
        rotation={[-Math.PI / 2, 0, Math.PI / 2]}
        fontSize={labelSize}
        color={labelColor}
        fillOpacity={labelOpacity}
        anchorX="center"
        anchorY="middle"
        font={undefined}
      >
        {rankNum}
      </Text>
    );
    labels.push(
      <Text
        key={`row-right-${row}`}
        position={[4.55, 0.01, wz]}
        rotation={[-Math.PI / 2, 0, -Math.PI / 2]}
        fontSize={labelSize}
        color={labelColor}
        fillOpacity={labelOpacity}
        anchorX="center"
        anchorY="middle"
        font={undefined}
      >
        {rankNum}
      </Text>
    );
  }

  return <>{labels}</>;
}

function RacingBoardNotation() {
  const labels: React.ReactNode[] = [];
  const labelSize = 0.25;
  const labelHeight = 0.076;
  const frontBackZ = 4.4;
  const sideX = 4.4;

  for (let col = 0; col < 8; col++) {
    const wx = col * SQUARE_SIZE - 3.5;
    labels.push(
      <Text
        key={`racing-col-front-${col}`}
        position={[wx, labelHeight, frontBackZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={labelSize}
        color="#f4f4ef"
        fillOpacity={0.94}
        anchorX="center"
        anchorY="middle"
        fontWeight={650}
        outlineWidth={0.012}
        outlineColor="#e01d2f"
        font={undefined}
      >
        {COL_LETTERS[col]}
      </Text>,
    );
    labels.push(
      <Text
        key={`racing-col-back-${col}`}
        position={[wx, labelHeight, -frontBackZ]}
        rotation={[-Math.PI / 2, 0, Math.PI]}
        fontSize={labelSize}
        color="#f4f4ef"
        fillOpacity={0.94}
        anchorX="center"
        anchorY="middle"
        fontWeight={650}
        outlineWidth={0.012}
        outlineColor="#e01d2f"
        font={undefined}
      >
        {COL_LETTERS[col]}
      </Text>,
    );
  }

  for (let row = 0; row < 8; row++) {
    const wz = -(row * SQUARE_SIZE - 3.5);
    const rankNum = String(row + 1);
    labels.push(
      <Text
        key={`racing-row-left-${row}`}
        position={[-sideX, labelHeight, wz]}
        rotation={[-Math.PI / 2, 0, Math.PI / 2]}
        fontSize={labelSize}
        color="#f4f4ef"
        fillOpacity={0.94}
        anchorX="center"
        anchorY="middle"
        fontWeight={650}
        outlineWidth={0.012}
        outlineColor="#e01d2f"
        font={undefined}
      >
        {rankNum}
      </Text>,
    );
    labels.push(
      <Text
        key={`racing-row-right-${row}`}
        position={[sideX, labelHeight, wz]}
        rotation={[-Math.PI / 2, 0, -Math.PI / 2]}
        fontSize={labelSize}
        color="#f4f4ef"
        fillOpacity={0.94}
        anchorX="center"
        anchorY="middle"
        fontWeight={650}
        outlineWidth={0.012}
        outlineColor="#e01d2f"
        font={undefined}
      >
        {rankNum}
      </Text>,
    );
  }

  return <>{labels}</>;
}

function RubiksBoardNotation() {
  const labels: React.ReactNode[] = [];
  const cubeColors = [
    "#f2f0e8",
    "#ffd21f",
    "#ff7a18",
    "#db2027",
    "#179b49",
    "#1657d8",
  ];
  const fileColors = [...cubeColors, cubeColors[0], cubeColors[1]];
  const rankColors = [...cubeColors, cubeColors[2], cubeColors[3]];
  const labelSize = 0.39;
  const labelHeight = 0.078;
  const frontBackZ = 4.4;
  const sideX = 4.4;

  for (let col = 0; col < 8; col++) {
    const wx = col * SQUARE_SIZE - 3.5;
    labels.push(
      <Text
        key={`rubiks-col-front-${col}`}
        position={[wx, labelHeight, frontBackZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={labelSize}
        color={fileColors[col]}
        fillOpacity={0.96}
        anchorX="center"
        anchorY="middle"
        fontWeight={650}
        outlineWidth={0.018}
        outlineColor="#050505"
        font={undefined}
      >
        {COL_LETTERS[col]}
      </Text>,
    );
    labels.push(
      <Text
        key={`rubiks-col-back-${col}`}
        position={[wx, labelHeight, -frontBackZ]}
        rotation={[-Math.PI / 2, 0, Math.PI]}
        fontSize={labelSize}
        color={fileColors[col]}
        fillOpacity={0.96}
        anchorX="center"
        anchorY="middle"
        fontWeight={650}
        outlineWidth={0.018}
        outlineColor="#050505"
        font={undefined}
      >
        {COL_LETTERS[col]}
      </Text>,
    );
  }

  for (let row = 0; row < 8; row++) {
    const wz = -(row * SQUARE_SIZE - 3.5);
    const rankNum = String(row + 1);
    labels.push(
      <Text
        key={`rubiks-row-left-${row}`}
        position={[-sideX, labelHeight, wz]}
        rotation={[-Math.PI / 2, 0, Math.PI / 2]}
        fontSize={labelSize}
        color={rankColors[row]}
        fillOpacity={0.96}
        anchorX="center"
        anchorY="middle"
        fontWeight={650}
        outlineWidth={0.018}
        outlineColor="#050505"
        font={undefined}
      >
        {rankNum}
      </Text>,
    );
    labels.push(
      <Text
        key={`rubiks-row-right-${row}`}
        position={[sideX, labelHeight, wz]}
        rotation={[-Math.PI / 2, 0, -Math.PI / 2]}
        fontSize={labelSize}
        color={rankColors[row]}
        fillOpacity={0.96}
        anchorX="center"
        anchorY="middle"
        fontWeight={650}
        outlineWidth={0.018}
        outlineColor="#050505"
        font={undefined}
      >
        {rankNum}
      </Text>,
    );
  }

  return <>{labels}</>;
}

function RetroBoardNotation() {
  const labels: React.ReactNode[] = [];
  const color = 0x111f12;

  for (let col = 0; col < 8; col++) {
    const wx = col * SQUARE_SIZE - 3.5;
    labels.push(
      <PixelLabel
        key={`retro-col-front-${col}`}
        text={COL_LETTERS[col]}
        position={[wx, 0.044, 4.55]}
        rotation={[-Math.PI / 2, 0, 0]}
        pixelSize={0.045}
        color={color}
        opacity={0.88}
      />,
    );
    labels.push(
      <PixelLabel
        key={`retro-col-back-${col}`}
        text={COL_LETTERS[col]}
        position={[wx, 0.044, -4.55]}
        rotation={[-Math.PI / 2, 0, Math.PI]}
        pixelSize={0.045}
        color={color}
        opacity={0.88}
      />,
    );
  }

  for (let row = 0; row < 8; row++) {
    const wz = -(row * SQUARE_SIZE - 3.5);
    const rankNum = String(row + 1);
    labels.push(
      <PixelLabel
        key={`retro-row-left-${row}`}
        text={rankNum}
        position={[-4.55, 0.044, wz]}
        rotation={[-Math.PI / 2, 0, Math.PI / 2]}
        pixelSize={0.045}
        color={color}
        opacity={0.88}
      />,
    );
    labels.push(
      <PixelLabel
        key={`retro-row-right-${row}`}
        text={rankNum}
        position={[4.55, 0.044, wz]}
        rotation={[-Math.PI / 2, 0, -Math.PI / 2]}
        pixelSize={0.045}
        color={color}
        opacity={0.88}
      />,
    );
  }

  return <>{labels}</>;
}

/* ── Single square ── */
interface BoardSquareProps {
  row: number;
  col: number;
  isLight: boolean;
  isSelected: boolean;
  isValidMove: boolean;
  isCaptureMove: boolean;
  isCheck: boolean;
  theme: BoardThemeConfig;
  onClick: (row: number, col: number) => void;
  onHover: (row: number, col: number, on: boolean) => void;
  onDragStart: (row: number, col: number, point: THREE.Vector3) => void;
  onDragEnd: (row: number, col: number, point: THREE.Vector3) => void;
  visualOffset: [number, number, number];
  wrapOffset: [number, number, number] | null;
  isRubiksDragOrigin: boolean;
  isRubiksDragLine: boolean;
}

function BoardSquare({
  row,
  col,
  isLight,
  isSelected,
  isValidMove,
  isCaptureMove,
  isCheck,
  theme,
  onClick,
  onHover,
  onDragStart,
  onDragEnd,
  visualOffset,
  wrapOffset,
  isRubiksDragOrigin,
  isRubiksDragLine,
}: BoardSquareProps) {
  const materialRef = useRef<THREE.MeshLambertMaterial>(null);
  const isRubiks = theme.boardDecor === "rubiks";
  const baseColor =
    isRubiks
      ? getRubiksSquareColor(row, col)
      : isLight ? theme.lightSquare : theme.darkSquare;
  const legalMoveColor = useMemo(() => {
    const highlightGreen = new THREE.Color(0x05f20e);
    return highlightGreen.lerp(new THREE.Color(isLight ? 0xffffff : 0x0b3f0d), isLight ? 0.1 : 0.16).getHex();
  }, [isLight]);
  const captureMoveColor = useMemo(() => {
    const captureRed = new THREE.Color(0xff1d18);
    return captureRed.lerp(new THREE.Color(isLight ? 0xffffff : 0x4a0505), isLight ? 0.08 : 0.14).getHex();
  }, [isLight]);
  let color = baseColor;
  if (isSelected) color = 0xe8e844;
  else if (isCheck) color = 0xff4444;

  const [wx, , wz] = boardToWorld(row, col);
  const validMoveLift = isValidMove ? 0.035 : 0;
  const displayPosition: [number, number, number] = [
    wx + visualOffset[0],
    visualOffset[1] + validMoveLift,
    wz + visualOffset[2],
  ];
  const targetColor = useMemo(() => new THREE.Color(color), [color]);
  const rubiksStickerShape = useMemo(() => createRoundedSquareShape(0.82, 0.09), []);

  useFrame(() => {
    materialRef.current?.color.lerp(targetColor, 0.08);
  });

  const validMoveBorder = isValidMove ? (
    <ValidMoveBorder
      position={[displayPosition[0], 0.13 + validMoveLift, displayPosition[2]]}
      color={isCaptureMove ? captureMoveColor : legalMoveColor}
    />
  ) : null;

  if (isRubiks) {
    const rubiksTile = (
      <>
        <mesh position={[0, -0.055, 0]} receiveShadow>
          <boxGeometry args={[SQUARE_SIZE, 0.12, SQUARE_SIZE]} />
          <meshLambertMaterial color={0x050505} />
        </mesh>
        <mesh position={[0, 0.014, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <shapeGeometry args={[rubiksStickerShape]} />
          <meshLambertMaterial ref={materialRef} color={baseColor} />
        </mesh>
        <mesh position={[0, 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
          <shapeGeometry args={[rubiksStickerShape]} />
          <meshBasicMaterial
            color={isLight ? 0xffffff : 0x000000}
            transparent
            opacity={isLight ? 0.18 : 0.34}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-3}
          />
        </mesh>
      </>
    );

    return (
      <group>
        <group
          position={displayPosition}
          scale={isRubiksDragOrigin ? [1.04, 1.04, 1.04] : [1, 1, 1]}
          receiveShadow
          onPointerDown={(e) => {
            e.stopPropagation();
            onDragStart(row, col, e.point);
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            onDragEnd(row, col, e.point);
          }}
          onPointerEnter={(e) => {
            e.stopPropagation();
            onHover(row, col, true);
          }}
          onPointerLeave={(e) => {
            e.stopPropagation();
            onHover(row, col, false);
          }}
        >
          {rubiksTile}
        </group>
        {wrapOffset && (
          <group
            position={[
              wx + visualOffset[0] + wrapOffset[0],
              visualOffset[1],
              wz + visualOffset[2] + wrapOffset[2],
            ]}
            raycast={() => null}
          >
            {rubiksTile}
          </group>
        )}
        {isRubiksDragOrigin && (
          <mesh position={[displayPosition[0], 0.08, displayPosition[2]]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
            <ringGeometry args={[0.48, 0.57, 28]} />
            <meshBasicMaterial color={0xffffff} transparent opacity={0.75} depthWrite={false} />
          </mesh>
        )}
        {isRubiksDragLine && !isRubiksDragOrigin && (
          <mesh position={[displayPosition[0], 0.064, displayPosition[2]]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
            <ringGeometry args={[0.42, 0.47, 28]} />
            <meshBasicMaterial color={0xffffff} transparent opacity={0.22} depthWrite={false} />
          </mesh>
        )}
        {validMoveBorder}

      </group>
    );
  }

  return (
    <group>
      <mesh
        position={displayPosition}
        receiveShadow
        onPointerDown={(e) => {
          e.stopPropagation();
          onDragStart(row, col, e.point);
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          onDragEnd(row, col, e.point);
        }}
        onPointerEnter={(e) => {
          e.stopPropagation();
          onHover(row, col, true);
        }}
        onPointerLeave={(e) => {
          e.stopPropagation();
          onHover(row, col, false);
        }}
      >
        <boxGeometry args={[SQUARE_SIZE, 0.1, SQUARE_SIZE]} />
        <meshLambertMaterial ref={materialRef} color={baseColor} />
      </mesh>
      {validMoveBorder}
    </group>
  );
}

function ValidMoveBorder({
  position,
  color,
}: {
  position: [number, number, number];
  color: number;
}) {
  const bars = [
    { key: "front", position: [0, 0, 0.46], length: 0.86, radius: 0.035, rotation: [0, 0, Math.PI / 2] },
    { key: "back", position: [0, 0, -0.46], length: 0.86, radius: 0.035, rotation: [0, 0, Math.PI / 2] },
    { key: "left", position: [-0.46, 0, 0], length: 0.86, radius: 0.035, rotation: [Math.PI / 2, 0, 0] },
    { key: "right", position: [0.46, 0, 0], length: 0.86, radius: 0.035, rotation: [Math.PI / 2, 0, 0] },
  ] as const;

  const glowBars = [
    { key: "front-glow", position: [0, -0.004, 0.46], scale: [0.94, 0.006, 0.18] },
    { key: "back-glow", position: [0, -0.004, -0.46], scale: [0.94, 0.006, 0.18] },
    { key: "left-glow", position: [-0.46, -0.004, 0], scale: [0.18, 0.006, 0.94] },
    { key: "right-glow", position: [0.46, -0.004, 0], scale: [0.18, 0.006, 0.94] },
  ] as const;

  return (
    <group position={position} raycast={() => null}>
      {glowBars.map((bar) => (
        <group key={bar.key} position={bar.position}>
          <mesh>
            <boxGeometry args={bar.scale} />
            <meshBasicMaterial color={color} transparent opacity={0.14} depthWrite={false} />
          </mesh>
          <mesh position={[0, -0.001, 0]}>
            <boxGeometry args={[bar.scale[0] * 1.35, bar.scale[1] * 0.7, bar.scale[2] * 1.65]} />
            <meshBasicMaterial color={color} transparent opacity={0.045} depthWrite={false} />
          </mesh>
        </group>
      ))}
      {bars.map((bar) => (
        <mesh key={bar.key} position={bar.position} rotation={bar.rotation}>
          <capsuleGeometry args={[bar.radius, bar.length, 5, 12]} />
          <meshBasicMaterial color={color} transparent opacity={0.95} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

/* ── Board rim ── */
function BoardRim({ theme }: { theme: BoardThemeConfig }) {
  return theme.rimTexture ? (
    <TexturedBoardRim theme={theme} textureUrl={theme.rimTexture} />
  ) : (
    <StandardBoardRim theme={theme} />
  );
}

function StandardBoardRim({ theme }: { theme: BoardThemeConfig }) {
  const rimMaterial = useMemo(
    () => new THREE.MeshLambertMaterial({ color: theme.rim }),
    [theme.rim],
  );
  const undersideMaterial = useMemo(
    () => new THREE.MeshLambertMaterial({ color: theme.underside }),
    [theme.underside],
  );

  return (
    <>
      <mesh position={[0, -0.12, 4.2]}  material={rimMaterial} receiveShadow><boxGeometry args={[9.4, 0.24, 0.4]} /></mesh>
      <mesh position={[0, -0.12, -4.2]} material={rimMaterial} receiveShadow><boxGeometry args={[9.4, 0.24, 0.4]} /></mesh>
      <mesh position={[4.2, -0.12, 0]}  material={rimMaterial} receiveShadow><boxGeometry args={[0.4, 0.24, 9.0]} /></mesh>
      <mesh position={[-4.2, -0.12, 0]} material={rimMaterial} receiveShadow><boxGeometry args={[0.4, 0.24, 9.0]} /></mesh>
      <mesh position={[0, -0.32, 0]}    material={undersideMaterial} receiveShadow><boxGeometry args={[9.6, 0.18, 9.6]} /></mesh>
    </>
  );
}

function TexturedBoardRim({
  theme,
  textureUrl,
}: {
  theme: BoardThemeConfig;
  textureUrl: string;
}) {
  const texture = useLoader(THREE.TextureLoader, textureUrl);

  useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2.5, 1);
    texture.anisotropy = 8;
  }, [texture]);

  const rimMaterial = useMemo(
    () =>
      new THREE.MeshLambertMaterial({
        color: theme.rim,
        map: texture,
      }),
    [texture, theme.rim],
  );
  const undersideMaterial = useMemo(
    () => new THREE.MeshLambertMaterial({ color: theme.underside }),
    [theme.underside],
  );

  return (
    <>
      <mesh position={[0, -0.12, 4.2]} material={rimMaterial} receiveShadow><boxGeometry args={[9.4, 0.24, 0.4]} /></mesh>
      <mesh position={[0, -0.12, -4.2]} material={rimMaterial} receiveShadow><boxGeometry args={[9.4, 0.24, 0.4]} /></mesh>
      <mesh position={[4.2, -0.12, 0]} material={rimMaterial} receiveShadow><boxGeometry args={[0.4, 0.24, 9.0]} /></mesh>
      <mesh position={[-4.2, -0.12, 0]} material={rimMaterial} receiveShadow><boxGeometry args={[0.4, 0.24, 9.0]} /></mesh>
      <mesh position={[0, -0.32, 0]} material={undersideMaterial} receiveShadow><boxGeometry args={[9.6, 0.18, 9.6]} /></mesh>
    </>
  );
}

/* ── Main scene ── */
function BoardSurfaceOverlay({ theme }: { theme: BoardThemeConfig }) {
  if (!theme.boardOverlayTexture) return null;

  return (
    <TexturedBoardSurfaceOverlay
      textureUrl={theme.boardOverlayTexture}
      opacity={theme.boardOverlayOpacity ?? 0.28}
    />
  );
}

function TexturedBoardSurfaceOverlay({
  textureUrl,
  opacity,
}: {
  textureUrl: string;
  opacity: number;
}) {
  const texture = useLoader(THREE.TextureLoader, textureUrl);

  useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = 8;
  }, [texture]);

  return (
    <mesh position={[0, 0.014, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
      <planeGeometry args={[8, 8]} />
      <meshBasicMaterial
        map={texture}
        color={0xffffff}
        transparent
        opacity={opacity}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-2}
      />
    </mesh>
  );
}

function BoardThemeDecor({ theme }: { theme: BoardThemeConfig }) {
  if (theme.boardDecor === "racing") return <RacingDecor />;
  if (theme.boardDecor === "retro-lcd") return <RetroLcdDecor />;
  if (theme.boardDecor === "battlefield") return <BattlefieldDecor />;
  if (theme.boardDecor === "rubiks") return <RubiksDecor />;
  return null;
}

function RubiksDecor() {
  return (
    <group>
      <mesh position={[0, 0.018, 4.46]} raycast={() => null}>
        <boxGeometry args={[8.6, 0.04, 0.18]} />
        <meshBasicMaterial color={0x050505} transparent opacity={0.88} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.018, -4.46]} raycast={() => null}>
        <boxGeometry args={[8.6, 0.04, 0.18]} />
        <meshBasicMaterial color={0x050505} transparent opacity={0.88} depthWrite={false} />
      </mesh>
      <mesh position={[4.46, 0.018, 0]} raycast={() => null}>
        <boxGeometry args={[0.18, 0.04, 8.6]} />
        <meshBasicMaterial color={0x050505} transparent opacity={0.88} depthWrite={false} />
      </mesh>
      <mesh position={[-4.46, 0.018, 0]} raycast={() => null}>
        <boxGeometry args={[0.18, 0.04, 8.6]} />
        <meshBasicMaterial color={0x050505} transparent opacity={0.88} depthWrite={false} />
      </mesh>
    </group>
  );
}

function RacingDecor() {
  const kerbPositions = Array.from({ length: 19 }, (_, index) => -4.5 + index * 0.5);

  return (
    <group>
      <mesh position={[0, -0.015, -4.55]} raycast={() => null}>
        <boxGeometry args={[9.05, 0.18, 0.18]} />
        <meshBasicMaterial color={0x050505} />
      </mesh>
      <mesh position={[0, -0.015, 4.55]} raycast={() => null}>
        <boxGeometry args={[9.05, 0.18, 0.18]} />
        <meshBasicMaterial color={0x050505} />
      </mesh>
      <mesh position={[-4.55, -0.015, 0]} raycast={() => null}>
        <boxGeometry args={[0.18, 0.18, 9.05]} />
        <meshBasicMaterial color={0x050505} />
      </mesh>
      <mesh position={[4.55, -0.015, 0]} raycast={() => null}>
        <boxGeometry args={[0.18, 0.18, 9.05]} />
        <meshBasicMaterial color={0x050505} />
      </mesh>

      <RacingFrameBand offset={4.55} thickness={0.22} color={0x18a978} opacity={0.84} />

      {kerbPositions.map((x, index) => (
        <mesh key={`racing-kerb-front-${index}`} position={[x, 0.052, 4.705]} raycast={() => null}>
          <boxGeometry args={[0.5, 0.026, 0.09]} />
          <meshBasicMaterial
            color={index % 2 === 0 ? 0xf4f4ef : 0xe01d2f}
            transparent
            opacity={0.88}
            depthWrite={false}
          />
        </mesh>
      ))}
      {kerbPositions.map((x, index) => (
        <mesh key={`racing-kerb-back-${index}`} position={[x, 0.052, -4.705]} raycast={() => null}>
          <boxGeometry args={[0.5, 0.026, 0.09]} />
          <meshBasicMaterial
            color={index % 2 === 0 ? 0xe01d2f : 0xf4f4ef}
            transparent
            opacity={0.88}
            depthWrite={false}
          />
        </mesh>
      ))}
      {kerbPositions.map((z, index) => (
        <mesh key={`racing-kerb-left-${index}`} position={[-4.705, 0.052, z]} raycast={() => null}>
          <boxGeometry args={[0.09, 0.026, 0.5]} />
          <meshBasicMaterial
            color={index % 2 === 0 ? 0xe01d2f : 0xf4f4ef}
            transparent
            opacity={0.88}
            depthWrite={false}
          />
        </mesh>
      ))}
      {kerbPositions.map((z, index) => (
        <mesh key={`racing-kerb-right-${index}`} position={[4.705, 0.052, z]} raycast={() => null}>
          <boxGeometry args={[0.09, 0.026, 0.5]} />
          <meshBasicMaterial
            color={index % 2 === 0 ? 0xf4f4ef : 0xe01d2f}
            transparent
            opacity={0.88}
            depthWrite={false}
          />
        </mesh>
      ))}
      <RacingCornerPatch x={-4.705} z={-4.705} color={0xe01d2f} />
      <RacingCornerPatch x={4.705} z={-4.705} color={0xf4f4ef} />
      <RacingCornerPatch x={-4.705} z={4.705} color={0xf4f4ef} />
      <RacingCornerPatch x={4.705} z={4.705} color={0xe01d2f} />
      <pointLight position={[0, 1.0, 4.2]} color={0xff3030} intensity={0.45} distance={4.5} />
    </group>
  );
}

function RacingCornerPatch({
  x,
  z,
  color,
}: {
  x: number;
  z: number;
  color: number;
}) {
  return (
    <mesh position={[x, 0.053, z]} raycast={() => null}>
      <boxGeometry args={[0.09, 0.026, 0.09]} />
      <meshBasicMaterial color={color} transparent opacity={0.88} depthWrite={false} />
    </mesh>
  );
}

function RacingFrameBand({
  offset,
  thickness,
  color,
  opacity: _opacity,
}: {
  offset: number;
  thickness: number;
  color: number;
  opacity: number;
}) {
  const outerEdge = offset + thickness / 2;
  const innerEdge = offset - thickness / 2;
  const center = (outerEdge + innerEdge) / 2;
  const span = outerEdge * 2;

  return (
    <group>
      <mesh position={[0, 0.066, center]} raycast={() => null}>
        <boxGeometry args={[span, 0.03, thickness]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.066, -center]} raycast={() => null}>
        <boxGeometry args={[span, 0.03, thickness]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[center, 0.066, 0]} raycast={() => null}>
        <boxGeometry args={[thickness, 0.03, span]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[-center, 0.066, 0]} raycast={() => null}>
        <boxGeometry args={[thickness, 0.03, span]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

function RectFrame({
  outerWidth,
  outerDepth,
  innerWidth,
  innerDepth,
  height,
  y,
  color,
  roughness = 0.82,
  metalness = 0.06,
}: {
  outerWidth: number;
  outerDepth: number;
  innerWidth: number;
  innerDepth: number;
  height: number;
  y: number;
  color: number;
  roughness?: number;
  metalness?: number;
}) {
  const sideWidth = (outerWidth - innerWidth) / 2;
  const capDepth = (outerDepth - innerDepth) / 2;
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color, roughness, metalness }),
    [color, roughness, metalness],
  );

  return (
    <>
      <mesh position={[0, y, innerDepth / 2 + capDepth / 2]} material={material} raycast={() => null}>
        <boxGeometry args={[outerWidth, height, capDepth]} />
      </mesh>
      <mesh position={[0, y, -innerDepth / 2 - capDepth / 2]} material={material} raycast={() => null}>
        <boxGeometry args={[outerWidth, height, capDepth]} />
      </mesh>
      <mesh position={[innerWidth / 2 + sideWidth / 2, y, 0]} material={material} raycast={() => null}>
        <boxGeometry args={[sideWidth, height, innerDepth]} />
      </mesh>
      <mesh position={[-innerWidth / 2 - sideWidth / 2, y, 0]} material={material} raycast={() => null}>
        <boxGeometry args={[sideWidth, height, innerDepth]} />
      </mesh>
    </>
  );
}

function RetroLcdDecor() {
  const scanLines = Array.from({ length: 17 }, (_, index) => -4 + index * 0.5);
  const verticalGrid = Array.from({ length: 9 }, (_, index) => -4 + index);
  const horizontalGrid = Array.from({ length: 9 }, (_, index) => -4 + index);
  const mazeSegments: Array<[number, number, number, number]> = [
    [-3.2, -1.7, 1.7, 0.08],
    [-1.05, -2.3, 0.08, 1.25],
    [1.4, -1.4, 2.0, 0.08],
    [2.35, -0.95, 0.08, 0.9],
    [-2.15, 1.65, 2.15, 0.08],
    [0.2, 1.1, 0.08, 1.0],
  ];
  const snakePixels: Array<[number, number]> = [
    [-2.95, 2.7],
    [-2.72, 2.7],
    [-2.49, 2.7],
    [-2.26, 2.7],
    [-2.03, 2.7],
    [-1.8, 2.47],
    [-1.8, 2.24],
    [-1.57, 2.01],
    [-1.34, 2.01],
  ];

  return (
    <group>
      <RectFrame
        outerWidth={11.45}
        outerDepth={11.1}
        innerWidth={9.65}
        innerDepth={9.35}
        height={0.18}
        y={-0.09}
        color={0x182036}
        roughness={0.86}
        metalness={0.08}
      />
      <RectFrame
        outerWidth={10.45}
        outerDepth={10.15}
        innerWidth={9.1}
        innerDepth={8.85}
        height={0.16}
        y={-0.065}
        color={0x9aa3ad}
        roughness={0.5}
        metalness={0.12}
      />
      <RectFrame
        outerWidth={9.78}
        outerDepth={9.5}
        innerWidth={8.72}
        innerDepth={8.48}
        height={0.14}
        y={-0.04}
        color={0x1f2943}
        roughness={0.8}
        metalness={0.05}
      />
      <mesh position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <planeGeometry args={[8.62, 8.62]} />
        <meshBasicMaterial color={0x7fd327} transparent opacity={0.42} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <ringGeometry args={[5.72, 5.94, 4]} />
        <meshBasicMaterial color={0xb8c2c4} transparent opacity={0.45} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.016, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <planeGeometry args={[8, 8]} />
        <meshBasicMaterial color={0x9be23b} transparent opacity={0.18} depthWrite={false} />
      </mesh>
      {scanLines.map((z) => (
        <mesh key={`scan-${z}`} position={[0, 0.032, z]} raycast={() => null}>
          <boxGeometry args={[8, 0.012, 0.035]} />
          <meshBasicMaterial color={0x14200f} transparent opacity={0.26} depthWrite={false} />
        </mesh>
      ))}
      {verticalGrid.map((x) => (
        <mesh key={`lcd-v-${x}`} position={[x, 0.034, 0]} raycast={() => null}>
          <boxGeometry args={[0.022, 0.014, 8]} />
          <meshBasicMaterial color={0xd5e2a2} transparent opacity={0.16} depthWrite={false} />
        </mesh>
      ))}
      {horizontalGrid.map((z) => (
        <mesh key={`lcd-h-${z}`} position={[0, 0.034, z]} raycast={() => null}>
          <boxGeometry args={[8, 0.014, 0.022]} />
          <meshBasicMaterial color={0xd5e2a2} transparent opacity={0.14} depthWrite={false} />
        </mesh>
      ))}
      {[
        [-3.58, -3.58],
        [3.58, -3.58],
        [-3.58, 3.58],
        [3.58, 3.58],
      ].map(([x, z], index) => (
        <mesh key={`lcd-pixel-${index}`} position={[x, 0.048, z]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
          <ringGeometry args={[0.08, 0.13, 4]} />
          <meshBasicMaterial color={0x20331b} transparent opacity={0.5} depthWrite={false} />
        </mesh>
      ))}
      <PixelLabel
        text="0035"
        position={[-3.28, 0.06, -3.86]}
        rotation={[-Math.PI / 2, 0, 0]}
        pixelSize={0.05}
        color={0x132313}
        opacity={0.9}
      />
      <PixelLabel
        text="10:30"
        position={[2.75, 0.06, -3.86]}
        rotation={[-Math.PI / 2, 0, 0]}
        pixelSize={0.05}
        color={0x132313}
        opacity={0.9}
      />
      <PixelLabel
        text="menu"
        position={[0, 0.06, 4.86]}
        rotation={[-Math.PI / 2, 0, 0]}
        pixelSize={0.048}
        color={0x182a18}
        opacity={0.76}
      />
      <group position={[3.76, 0.06, -3.82]} raycast={() => null}>
        {[0.05, 0.11, 0.17, 0.23].map((height, index) => (
          <mesh key={index} position={[index * 0.065, 0, -height / 2]}>
            <boxGeometry args={[0.04, 0.022, height]} />
            <meshBasicMaterial color={0x122212} transparent opacity={0.86} depthWrite={false} />
          </mesh>
        ))}
      </group>
      <group position={[-3.78, 0.06, -3.82]} raycast={() => null}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.28, 0.022, 0.17]} />
          <meshBasicMaterial color={0x122212} transparent opacity={0.18} depthWrite={false} />
        </mesh>
        <mesh position={[-0.12, 0, 0]}>
          <boxGeometry args={[0.04, 0.026, 0.25]} />
          <meshBasicMaterial color={0x122212} transparent opacity={0.86} depthWrite={false} />
        </mesh>
      </group>
      {mazeSegments.map(([x, z, width, depth], index) => (
        <mesh key={`snake-maze-${index}`} position={[x, 0.055, z]} raycast={() => null}>
          <boxGeometry args={[width, 0.026, depth]} />
          <meshBasicMaterial color={0x102010} transparent opacity={0.34} depthWrite={false} />
        </mesh>
      ))}
      {snakePixels.map(([x, z], index) => (
        <mesh key={`snake-preview-${index}`} position={[x, 0.07, z]} raycast={() => null}>
          <boxGeometry args={[0.18, 0.035, 0.18]} />
          <meshBasicMaterial color={0x102010} transparent opacity={index === snakePixels.length - 1 ? 0.72 : 0.58} depthWrite={false} />
        </mesh>
      ))}
      <mesh position={[2.75, 0.07, 2.55]} raycast={() => null}>
        <boxGeometry args={[0.18, 0.035, 0.18]} />
        <meshBasicMaterial color={0x102010} transparent opacity={0.62} depthWrite={false} />
      </mesh>
    </group>
  );
}

function BattlefieldDecor() {
  const emberPoints = [
    [-3.25, 0.6, 2.65],
    [2.85, 0.6, -2.95],
    [3.2, 0.6, 1.4],
  ];

  return (
    <group>
      {emberPoints.map(([x, y, z], index) => (
        <pointLight
          key={`battlefield-ember-light-${index}`}
          position={[x, y, z]}
          color={0xff6f24}
          intensity={0.35}
          distance={2.3}
        />
      ))}
      {[
        [-3.25, 2.65, 0.26],
        [2.85, -2.95, 0.2],
        [3.2, 1.4, 0.18],
        [-1.1, -3.15, 0.14],
      ].map(([x, z, radius], index) => (
        <mesh key={`battlefield-ash-${index}`} position={[x, 0.04, z]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
          <circleGeometry args={[radius, 18]} />
          <meshBasicMaterial color={0x100d0a} transparent opacity={0.24} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

interface SceneProps {
  gameState: GameState;
  onSquareClick: (row: number, col: number) => void;
  onRubiksShift?: (shift: RubiksShift) => void;
  onRubiksDragActiveChange?: (active: boolean) => void;
  onRubiksCheckBlocked?: () => void;
  snakesAndLadders: SnakeLadder[];
  mines: Mine[];
  theme: BoardThemeConfig;
}

interface RubiksDragState {
  start: Square;
  axis: RubiksShift["axis"] | null;
  amount: number;
}

function getRubiksShiftFromDrag(drag: RubiksDragState | null): RubiksShift | null {
  if (!drag) return null;
  if (!drag.axis || drag.amount === 0) return null;

  return drag.axis === "row"
    ? { axis: "row", index: drag.start.row, amount: drag.amount }
    : { axis: "col", index: drag.start.col, amount: drag.amount };
}

function getRubiksPreviewOffsets(
  row: number,
  col: number,
  shift: RubiksShift | null,
): {
  visualOffset: [number, number, number];
  wrapOffset: [number, number, number] | null;
  isLine: boolean;
} {
  if (!shift) {
    return { visualOffset: [0, 0, 0], wrapOffset: null, isLine: false };
  }

  if (shift.axis === "row" && row === shift.index) {
    const xOffset = shift.amount * SQUARE_SIZE;
    let wrapX = 0;
    if (col + shift.amount > 7) wrapX = -8 * SQUARE_SIZE;
    if (col + shift.amount < 0) wrapX = 8 * SQUARE_SIZE;

    return {
      visualOffset: [xOffset, 0.05, 0],
      wrapOffset: wrapX ? [wrapX, 0, 0] : null,
      isLine: true,
    };
  }

  if (shift.axis === "col" && col === shift.index) {
    const zOffset = -shift.amount * SQUARE_SIZE;
    let wrapZ = 0;
    if (row + shift.amount > 7) wrapZ = 8 * SQUARE_SIZE;
    if (row + shift.amount < 0) wrapZ = -8 * SQUARE_SIZE;

    return {
      visualOffset: [0, 0.05, zOffset],
      wrapOffset: wrapZ ? [0, 0, wrapZ] : null,
      isLine: true,
    };
  }

  return { visualOffset: [0, 0, 0], wrapOffset: null, isLine: false };
}

function RubiksDragIndicator({ shift }: { shift: RubiksShift | null }) {
  if (!shift) return null;

  const amountLabel = `${shift.amount > 0 ? "+" : ""}${shift.amount}`;
  const label =
    shift.axis === "row"
      ? `Rank ${shift.index + 1} ${amountLabel}`
      : `File ${COL_LETTERS[shift.index]} ${amountLabel}`;
  const arrowRotation = shift.axis === "row"
    ? [0, 0, shift.amount >= 0 ? -Math.PI / 2 : Math.PI / 2]
    : [0, 0, shift.amount >= 0 ? Math.PI : 0];

  return (
    <group position={[0, 0.35, 0]} raycast={() => null}>
      <Text
        position={[0, 0.1, -5.05]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.28}
        color="#f8f3df"
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
      <mesh position={[0, 0.04, -4.52]} rotation={arrowRotation as [number, number, number]}>
        <coneGeometry args={[0.14, 0.34, 3]} />
        <meshBasicMaterial color={0xf8f3df} transparent opacity={0.82} />
      </mesh>
    </group>
  );
}

function CinematicCamera({
  mode,
  sequenceKey,
  theme,
}: {
  mode: "intro" | "intro-hold" | "play" | "free";
  sequenceKey: number;
  theme: BoardThemeConfig;
}) {
  const { camera } = useThree();
  const startTime = useRef(0);
  const introDuration = 9.5;

  useEffect(() => {
    startTime.current = 0;
  }, [sequenceKey]);

  useFrame(({ clock }) => {
    if (mode !== "intro" && mode !== "intro-hold") return;

    if (mode === "intro-hold") {
      const endAngle = Math.atan2(
        theme.camera.playPosition[0],
        theme.camera.playPosition[2],
      );
      const angle = endAngle + Math.PI * 0.78;
      camera.position.set(
        Math.sin(angle) * theme.camera.introStartRadius,
        theme.camera.introStartHeight + BOARD_ELEVATION,
        Math.cos(angle) * theme.camera.introStartRadius,
      );
      camera.lookAt(...BOARD_TARGET);
      return;
    }

    if (startTime.current === 0) {
      startTime.current = clock.getElapsedTime();
    }

    const elapsed = clock.getElapsedTime() - startTime.current;
    const t = Math.min(Math.max(elapsed / introDuration, 0), 1);
    const eased = t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const playPosition = theme.camera.playPosition;
    const endRadius = Math.hypot(playPosition[0], playPosition[2]);
    const endAngle = Math.atan2(playPosition[0], playPosition[2]);
    const angle = endAngle + (1 - eased) * Math.PI * 0.78;
    const radius =
      theme.camera.introStartRadius -
      eased * (theme.camera.introStartRadius - endRadius);
    const height =
      theme.camera.introStartHeight -
      eased * (theme.camera.introStartHeight - (playPosition[1] - BOARD_ELEVATION));

    camera.position.set(
      Math.sin(angle) * radius,
      height + BOARD_ELEVATION,
      Math.cos(angle) * radius,
    );
    camera.lookAt(...BOARD_TARGET);
  });

  return null;
}

function CameraModePose({
  mode,
  theme,
}: {
  mode: "intro" | "intro-hold" | "play" | "free";
  theme: BoardThemeConfig;
}) {
  const { camera } = useThree();

  useEffect(() => {
    if (mode !== "play") return;

    camera.position.set(
      theme.camera.playPosition[0],
      theme.camera.playPosition[1] + BOARD_ELEVATION,
      theme.camera.playPosition[2],
    );
    camera.lookAt(...BOARD_TARGET);
  }, [camera, mode, theme.camera.playPosition]);

  return null;
}

function MineCameraShake({ gameState }: { gameState: GameState }) {
  const { camera } = useThree();
  const triggerKey = gameState.moveHistory.length;
  const lastOffset = useRef(new THREE.Vector3());
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    const lastMove = gameState.moveHistory[gameState.moveHistory.length - 1];
    if (!lastMove?.mineTriggeredAt) return;
    startedAt.current = null;
  }, [gameState.moveHistory, triggerKey]);

  useFrame(({ clock }) => {
    const lastMove = gameState.moveHistory[gameState.moveHistory.length - 1];
    if (!lastMove?.mineTriggeredAt) return;

    if (startedAt.current === null) {
      startedAt.current = clock.getElapsedTime();
    }

    camera.position.sub(lastOffset.current);

    const elapsed = clock.getElapsedTime() - startedAt.current;
    const duration = 0.46;

    if (elapsed >= duration) {
      lastOffset.current.set(0, 0, 0);
      return;
    }

    const falloff = 1 - elapsed / duration;
    const intensity = 0.1 * falloff * falloff;
    const offset = new THREE.Vector3(
      Math.sin(elapsed * 86) * intensity,
      Math.sin(elapsed * 113 + 0.8) * intensity * 0.55,
      Math.cos(elapsed * 97) * intensity,
    );

    camera.position.add(offset);
    lastOffset.current.copy(offset);
  });

  return null;
}

function MineClues({ gameState, mines }: { gameState: GameState; mines: Mine[] }) {
  if (mines.length === 0) return null;

  return (
    <>
      {gameState.pieces
        .filter((piece) => piece.row >= 2 && piece.row <= 5)
        .map((piece) => {
          const [wx, , wz] = boardToWorld(piece.row, piece.col);
          const nearbyCount = mines.filter(
            (mine) =>
              Math.abs(mine.square.row - piece.row) <= 1 &&
              Math.abs(mine.square.col - piece.col) <= 1,
          ).length;
          const clueColor =
            nearbyCount === 0
              ? "#8fb7c8"
                : nearbyCount <= 2
                ? "#f6d77a"
                : "#ef8f62";

          return (
            <group key={`mine-clue-${piece.id}`}>
              <MineScanner position={[wx, 0.075, wz]} count={nearbyCount} />
              <group position={[wx + 0.32, 0.11, wz + 0.32]}>
                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                  <circleGeometry args={[0.18, 20]} />
                  <meshBasicMaterial color={0x050505} transparent opacity={0.68} depthWrite={false} />
                </mesh>
                <Text
                  position={[0, 0.015, 0]}
                  rotation={[-Math.PI / 2, 0, 0]}
                  fontSize={0.26}
                  color={clueColor}
                  anchorX="center"
                  anchorY="middle"
                  font={undefined}
                >
                  {String(nearbyCount)}
                </Text>
              </group>
            </group>
          );
        })}
    </>
  );
}

function MineScanner({
  position,
  count,
}: {
  position: [number, number, number];
  count: number;
}) {
  const sweepRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const glowColor = count === 0 ? 0x6db6ff : count <= 2 ? 0xffd86c : 0xff6d35;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const pulse = (Math.sin(t * 2.4) + 1) / 2;

    if (sweepRef.current) {
      sweepRef.current.rotation.z = -t * 1.15;
    }
    if (ringRef.current) {
      ringRef.current.scale.setScalar(1 + pulse * 0.08);
      const mat = ringRef.current.material;
      if (mat instanceof THREE.MeshBasicMaterial) {
        mat.opacity = 0.26 + pulse * 0.14;
      }
    }
    if (glowRef.current) {
      glowRef.current.scale.setScalar(1 + pulse * 0.16);
      const mat = glowRef.current.material;
      if (mat instanceof THREE.MeshBasicMaterial) {
        mat.opacity = 0.07 + pulse * 0.05;
      }
    }
  });

  return (
    <group position={position} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
      <mesh ref={glowRef}>
        <circleGeometry args={[0.42, 32]} />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={0.08}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={ringRef}>
        <ringGeometry args={[0.32, 0.36, 36]} />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={sweepRef} position={[0, 0, 0.003]}>
        <circleGeometry args={[0.34, 32, 0, Math.PI * 0.42]} />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={0.18}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle) => (
        <mesh key={angle} position={[Math.cos(angle) * 0.34, Math.sin(angle) * 0.34, 0.006]} rotation={[0, 0, angle]}>
          <boxGeometry args={[0.1, 0.012, 0.002]} />
          <meshBasicMaterial color={glowColor} transparent opacity={0.28} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function FoundMineMarkers({ gameState }: { gameState: GameState }) {
  const foundMines = useMemo(() => {
    const seen = new Set<string>();
    return gameState.moveHistory
      .map((move) => move.mineTriggeredAt)
      .filter((square): square is Square => Boolean(square))
      .filter((square) => {
        const key = `${square.row}-${square.col}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [gameState.moveHistory]);

  if (foundMines.length === 0) return null;

  return (
    <>
      {foundMines.map((square) => {
        const [wx, , wz] = boardToWorld(square.row, square.col);
        return (
          <group key={`found-mine-${square.row}-${square.col}`} position={[wx, 0.115, wz]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.42, 28]} />
              <meshBasicMaterial color={0xff4f4f} transparent opacity={0.09} depthWrite={false} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.2, 0.42, 28]} />
              <meshBasicMaterial color={0xff4f4f} transparent opacity={0.045} depthWrite={false} />
            </mesh>
            <mesh position={[0, 0.04, 0]}>
              <sphereGeometry args={[0.13, 12, 8]} />
              <meshBasicMaterial color={0x030303} transparent opacity={0.72} depthWrite={false} />
            </mesh>
            {Array.from({ length: 8 }, (_, index) => {
              const angle = (index / 8) * Math.PI * 2;
              const longSpike = index % 2 === 0;
              return (
                <mesh
                  key={index}
                  position={[Math.cos(angle) * 0.19, 0.04, Math.sin(angle) * 0.19]}
                  rotation={[Math.PI / 2, 0, -angle]}
                >
                  <capsuleGeometry args={[longSpike ? 0.028 : 0.022, longSpike ? 0.13 : 0.08, 5, 6]} />
                  <meshBasicMaterial color={0x030303} transparent opacity={0.68} depthWrite={false} />
                </mesh>
              );
            })}
            {[
              [-0.055, 0.055],
              [0.055, 0.055],
              [-0.055, -0.055],
              [0.055, -0.055],
            ].map(([x, z], index) => (
              <mesh key={`mine-dot-${index}`} position={[x, 0.055, z]}>
                <sphereGeometry args={[0.025, 6, 5]} />
                <meshBasicMaterial color={0x879aa6} transparent opacity={0.48} depthWrite={false} />
              </mesh>
            ))}
            <mesh position={[0, 0.055, 0.17]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.045, 0.009, 5, 12]} />
              <meshBasicMaterial color={0x030303} transparent opacity={0.66} depthWrite={false} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

function MineExplosion({ square }: { square: Square }) {
  const startedAt = useRef<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [wx, , wz] = boardToWorld(square.row, square.col);

  const sparks = useMemo(
    () =>
      Array.from({ length: 18 }, (_, index) => {
        const angle = (index / 18) * Math.PI * 2;
        const speed = 0.55 + ((index * 17) % 9) * 0.045;
        const lift = 0.25 + ((index * 11) % 7) * 0.045;
        return {
          id: index,
          x: Math.cos(angle) * speed,
          z: Math.sin(angle) * speed,
          y: lift,
          size: 0.04 + (index % 3) * 0.018,
          color: index % 4 === 0 ? 0xffffff : index % 4 === 1 ? 0xffd76a : index % 4 === 2 ? 0xff5a1f : 0x262020,
        };
      }),
    [],
  );

  useFrame(({ clock }) => {
    if (startedAt.current === null) {
      startedAt.current = clock.getElapsedTime();
    }
    const elapsed = clock.getElapsedTime() - startedAt.current;
    setProgress(Math.min(elapsed / 0.95, 1));
  });

  const fade = Math.max(0, 1 - progress);
  const blastScale = 0.22 + progress * 1.1;

  if (progress >= 1) return null;

  return (
    <group position={[wx, 0.22, wz]}>
      <pointLight
        position={[0, 0.55, 0]}
        color={0xff9a33}
        intensity={8 * fade}
        distance={4}
        decay={2}
      />
      <mesh scale={[blastScale * 0.42, blastScale * 0.42, blastScale * 0.42]}>
        <sphereGeometry args={[0.42, 14, 8]} />
        <meshBasicMaterial color={0xfff2c7} transparent opacity={0.95 * fade} depthWrite={false} />
      </mesh>
      <mesh scale={[blastScale, blastScale * 0.35, blastScale]}>
        <sphereGeometry args={[0.42, 14, 8]} />
        <meshBasicMaterial color={0xff8a1f} transparent opacity={0.72 * fade} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[progress * 1.7, progress * 1.7, 1]}>
        <ringGeometry args={[0.22, 0.28, 28]} />
        <meshBasicMaterial color={0xfff0bd} transparent opacity={0.9 * fade} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[progress * 2.25, progress * 2.25, 1]}>
        <ringGeometry args={[0.16, 0.2, 30]} />
        <meshBasicMaterial color={0xff5a1f} transparent opacity={0.62 * fade} depthWrite={false} />
      </mesh>
      {sparks.map((spark) => (
        <mesh
          key={spark.id}
          position={[
            spark.x * progress,
            spark.y * Math.sin(progress * Math.PI) + 0.05,
            spark.z * progress,
          ]}
          scale={[spark.size * 1.28, spark.size * 1.28, spark.size * 1.28]}
        >
          <sphereGeometry args={[1, 6, 4]} />
          <meshBasicMaterial color={spark.color} transparent opacity={0.9 * fade} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function PawnSpeedBurst({
  move,
  gameState,
}: {
  move: Move | null;
  gameState: GameState;
}) {
  const startedAt = useRef<number | null>(null);
  const [progress, setProgress] = useState(0);

  const effect = useMemo(() => {
    if (!move) return null;

    const finalSquare = move.teleportedTo ?? move.to;
    const movedPiece = gameState.pieces.find(
      (piece) =>
        piece.type === "pawn" &&
        piece.row === finalSquare.row &&
        piece.col === finalSquare.col,
    );
    const rowDistance = Math.abs(finalSquare.row - move.from.row);
    const colDistance = Math.abs(finalSquare.col - move.from.col);
    const usedExtendedRange =
      movedPiece &&
      ((rowDistance >= 3 && colDistance === 0) ||
        (rowDistance >= 2 && colDistance >= 2));
    if (!usedExtendedRange) return null;

    const [fromX, , fromZ] = boardToWorld(move.from.row, move.from.col);
    const [toX, , toZ] = boardToWorld(finalSquare.row, finalSquare.col);
    const direction = new THREE.Vector3(toX - fromX, 0, toZ - fromZ).normalize();
    const sideways = new THREE.Vector3(-direction.z, 0, direction.x);

    return {
      from: new THREE.Vector3(fromX, 0.16, fromZ),
      to: new THREE.Vector3(toX, 0.16, toZ),
      direction,
      sideways,
      flashColor: movedPiece.color === "white" ? 0xffffff : 0xff3939,
    };
  }, [move, gameState.pieces]);

  useEffect(() => {
    startedAt.current = null;
    setProgress(0);
  }, [move]);

  useFrame(({ clock }) => {
    if (!effect) return;
    if (startedAt.current === null) startedAt.current = clock.getElapsedTime();
    const elapsed = clock.getElapsedTime() - startedAt.current;
    setProgress(Math.min(elapsed / 0.38, 1));
  });

  if (!effect || progress >= 1) return null;

  const fade = 1 - progress;
  const trailLength = effect.from.distanceTo(effect.to);
  const midpoint = effect.from.clone().lerp(effect.to, 0.5);
  const angle = Math.atan2(effect.direction.x, effect.direction.z);
  const flash = Math.max(0, 1 - progress * 2.2);
  const smoke = Math.sin(progress * Math.PI);

  return (
    <group>
      <mesh
        position={[effect.to.x, 0.17, effect.to.z]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[0.35 + progress * 1.2, 0.35 + progress * 1.2, 1]}
        raycast={() => null}
      >
        <ringGeometry args={[0.18, 0.24, 28]} />
        <meshBasicMaterial
          color={effect.flashColor}
          transparent
          opacity={0.85 * flash}
          depthWrite={false}
        />
      </mesh>
      <mesh
        position={[midpoint.x, 0.13, midpoint.z]}
        rotation={[0, angle, 0]}
        scale={[0.045 + flash * 0.035, 1, trailLength * (0.95 + flash * 0.18)]}
        raycast={() => null}
      >
        <boxGeometry args={[1, 0.04, 1]} />
        <meshBasicMaterial
          color={0xffffff}
          transparent
          opacity={0.72 * flash}
          depthWrite={false}
        />
      </mesh>
      {[-0.16, 0.16].map((offset, index) => {
        const lineMidpoint = midpoint.clone().add(effect.sideways.clone().multiplyScalar(offset));
        return (
          <mesh
            key={`skid-${index}`}
            position={[lineMidpoint.x, 0.075, lineMidpoint.z]}
            rotation={[0, angle, 0]}
            scale={[0.035, 1, trailLength * (0.72 + progress * 0.12)]}
            raycast={() => null}
          >
            <boxGeometry args={[1, 0.025, 1]} />
            <meshBasicMaterial color={0x050505} transparent opacity={0.4 * fade} depthWrite={false} />
          </mesh>
        );
      })}
      {Array.from({ length: 18 }, (_, index) => {
        const t = index / 17;
        const spread = (index % 2 === 0 ? 1 : -1) * (0.08 + (index % 5) * 0.025);
        const point = effect.from.clone().lerp(effect.to, Math.min(1, t + progress * 0.1));
        point.add(effect.sideways.clone().multiplyScalar(spread * (1 + progress * 1.8)));
        point.add(effect.direction.clone().multiplyScalar(-progress * (0.18 + (index % 4) * 0.05)));

        return (
          <mesh
            key={index}
            position={[point.x, 0.075 + smoke * 0.08, point.z]}
            scale={[
              0.09 + progress * 0.18 + (index % 3) * 0.02,
              0.025,
              0.09 + progress * 0.16 + (index % 4) * 0.015,
            ]}
            rotation={[-Math.PI / 2, 0, progress * 1.2 + index]}
            raycast={() => null}
          >
            <circleGeometry args={[1, 12]} />
            <meshBasicMaterial
              color={index % 4 === 0 ? 0x1a1a1a : 0x6f6a5f}
              transparent
              opacity={(0.26 + smoke * 0.16) * fade}
              depthWrite={false}
            />
          </mesh>
        );
      })}
      <pointLight
        position={[effect.to.x, 0.5, effect.to.z]}
        color={effect.flashColor}
        intensity={4.2 * flash}
        distance={3.4}
      />
    </group>
  );
}

function CapturedPiecePlaceholder({
  move,
  theme,
}: {
  move: Move | null;
  theme: BoardThemeConfig;
}) {
  if (!move || !getAnimationCapturedPiece(move)) return null;

  if (theme.id === "death-board") {
    return <KnockOffCaptureAnimation move={move} />;
  }

  if (theme.id === "minesweeper-board") {
    return <RocketCaptureAnimation move={move} />;
  }

  return (
    <DissolveCaptureAnimation
      move={move}
      showSerpents={theme.id === "serpents-board"}
    />
  );
}

function DissolveCaptureAnimation({
  move,
  showSerpents = false,
}: {
  move: Move;
  showSerpents?: boolean;
}) {
  const startedAt = useRef<number | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    startedAt.current = null;
    setProgress(0);
  }, [move]);

  useFrame(({ clock }) => {
    if (startedAt.current === null) startedAt.current = clock.getElapsedTime();
    const elapsed = clock.getElapsedTime() - startedAt.current;
    setProgress(Math.min(elapsed / (showSerpents ? 0.58 : 0.9), 1));
  });

  if (progress >= 1) return null;

  const captureSquare = getCapturedPieceSquare(move);
  const capturedPiece = getAnimationCapturedPiece(move);
  if (!capturedPiece) return null;
  const [wx, wy, wz] = boardToWorld(captureSquare.row, captureSquare.col);
  const fade = 1 - progress;
  const serpentYank = showSerpents
    ? easeInCubic(clamp01((progress - 0.34) / 0.48))
    : progress;
  const sink = showSerpents ? serpentYank * 0.9 : progress * 0.38;
  const wobble = showSerpents
    ? Math.sin(progress * Math.PI * 4) * 0.08 + serpentYank * 0.28
    : Math.sin(progress * Math.PI) * 0.18;
  const scatter = getCaptureScatter(capturedPiece);

  return (
    <group position={[wx, wy, wz]} raycast={() => null}>
      {showSerpents && <SerpentCaptureTendrils progress={progress} />}
      <group
        position={[0, -sink, 0]}
        rotation={[wobble * 0.45, progress * 0.9, -wobble * 0.75]}
        scale={[
          1 - serpentYank * 0.32,
          1 - serpentYank * 0.58,
          1 - serpentYank * 0.32,
        ]}
      >
        <ChessPiece
          type={capturedPiece.type}
          color={capturedPiece.color}
          position={[0, 0, 0]}
          isSelected={false}
          isHovered={false}
        />
      </group>
      {scatter.map((speck) => (
        <mesh
          key={speck.id}
          position={[
            speck.x * progress,
            0.18 + speck.y * Math.sin(progress * Math.PI) - sink * 0.35,
            speck.z * progress,
          ]}
          scale={[
            speck.size * (0.65 + fade * 0.9),
            speck.size * (0.65 + fade * 0.9),
            speck.size * (0.65 + fade * 0.9),
          ]}
        >
          <sphereGeometry args={[1, 6, 4]} />
          <meshBasicMaterial
            color={capturedPiece.color === "white" ? 0xf4ead8 : 0x3b3630}
            transparent
            opacity={0.5 * fade}
            depthWrite={false}
          />
        </mesh>
      ))}
      <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.16 + progress * 0.18, 0.2 + progress * 0.32, 28]} />
        <meshBasicMaterial
          color={capturedPiece.color === "white" ? 0xd8c4a6 : 0x171410}
          transparent
          opacity={0.22 * fade}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function KnockOffCaptureAnimation({ move }: { move: Move }) {
  const startedAt = useRef<number | null>(null);
  const [progress, setProgress] = useState(0);
  const contactDelay = 0.52;

  useEffect(() => {
    startedAt.current = null;
    setProgress(0);
  }, [move]);

  useFrame(({ clock }) => {
    if (startedAt.current === null) startedAt.current = clock.getElapsedTime();
    const elapsed = Math.max(0, clock.getElapsedTime() - startedAt.current - contactDelay);
    setProgress(Math.min(elapsed / 1.18, 1));
  });

  const capturedPiece = getAnimationCapturedPiece(move);
  if (!capturedPiece || progress >= 1) return null;

  const captureSquare = getCapturedPieceSquare(move);
  const [wx, wy, wz] = boardToWorld(captureSquare.row, captureSquare.col);
  const from = new THREE.Vector3(wx, wy, wz);
  const edgeDirection = new THREE.Vector3(wx, 0, wz);
  if (edgeDirection.lengthSq() < 0.01) {
    edgeDirection.set(move.to.col >= 4 ? 1 : -1, 0, move.to.row >= 4 ? -0.35 : 0.35);
  }
  edgeDirection.normalize();

  const horizontalEase = easeOutCubic(Math.min(progress / 0.68, 1));
  const fallT = Math.max(0, (progress - 0.42) / 0.58);
  const borderTarget = 5.05;
  const edgeComponent = Math.max(Math.abs(edgeDirection.x), Math.abs(edgeDirection.z), 0.2);
  const distanceToEdge = (borderTarget - Math.max(Math.abs(wx), Math.abs(wz))) / edgeComponent;
  const travelDistance = Math.max(2.9, distanceToEdge + 0.72);
  const position = from.clone().add(edgeDirection.clone().multiplyScalar(horizontalEase * travelDistance));
  position.y += Math.sin(Math.min(progress / 0.56, 1) * Math.PI) * 0.16 - fallT * fallT * 2.4;
  const fade = Math.max(0, 1 - fallT * 1.35);

  return (
    <group
      position={position.toArray()}
      rotation={[fallT * 1.2, horizontalEase * 1.5, -horizontalEase * 1.35]}
      scale={[1 - fallT * 0.2, 1 - fallT * 0.28, 1 - fallT * 0.2]}
      raycast={() => null}
    >
      <ChessPiece
        type={capturedPiece.type}
        color={capturedPiece.color}
        position={[0, 0, 0]}
        isSelected={false}
        isHovered={false}
      />
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.36 + progress * 0.12, 24]} />
        <meshBasicMaterial
          color={0x11100e}
          transparent
          opacity={0.16 * fade}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function RocketCaptureAnimation({ move }: { move: Move }) {
  const startedAt = useRef<number | null>(null);
  const [progress, setProgress] = useState(0);
  const contactDelay = 0.48;

  useEffect(() => {
    startedAt.current = null;
    setProgress(0);
  }, [move]);

  useFrame(({ clock }) => {
    if (startedAt.current === null) startedAt.current = clock.getElapsedTime();
    const elapsed = Math.max(0, clock.getElapsedTime() - startedAt.current - contactDelay);
    setProgress(Math.min(elapsed / 1.28, 1));
  });

  const capturedPiece = getAnimationCapturedPiece(move);
  if (!capturedPiece || progress >= 1) return null;

  const captureSquare = getCapturedPieceSquare(move);
  const [wx, wy, wz] = boardToWorld(captureSquare.row, captureSquare.col);
  const [fromX, , fromZ] = boardToWorld(move.from.row, move.from.col);
  const bumpDirection = new THREE.Vector3(wx - fromX, 0, wz - fromZ);
  if (bumpDirection.lengthSq() < 0.01) bumpDirection.set(wx || 1, 0, wz || -1);
  bumpDirection.normalize();
  const launchT = Math.min(progress / 0.68, 1);
  const explosionT = Math.max(0, (progress - 0.58) / 0.42);
  const height = easeInCubic(launchT) * 4.4;
  const shoveT = easeOutCubic(Math.min(progress / 0.32, 1));
  const driftX = bumpDirection.x * shoveT * 0.86 + Math.sin(progress * Math.PI * 1.1) * 0.18;
  const driftZ = bumpDirection.z * shoveT * 0.86 - progress * 0.18;
  const fade = Math.max(0, 1 - explosionT);
  const blastScale = 0.18 + explosionT * 1.35;
  const showPiece = explosionT < 0.32;

  return (
    <group position={[wx + driftX, wy + height, wz + driftZ]} raycast={() => null}>
      {showPiece && (
        <group rotation={[launchT * -0.24, launchT * 0.42, launchT * 0.18]}>
          <ChessPiece
            type={capturedPiece.type}
            color={capturedPiece.color}
            position={[0, 0, 0]}
            isSelected={false}
            isHovered={false}
          />
          {progress > 0.02 && <RocketFlames progress={launchT} />}
        </group>
      )}
      {explosionT > 0 && (
        <group>
          <pointLight
            position={[0, 0.2, 0]}
            color={0xff9a33}
            intensity={7 * fade}
            distance={4}
            decay={2}
          />
          <mesh scale={[blastScale * 0.42, blastScale * 0.42, blastScale * 0.42]}>
            <sphereGeometry args={[0.42, 14, 8]} />
            <meshBasicMaterial color={0xfff2c7} transparent opacity={0.9 * fade} depthWrite={false} />
          </mesh>
          <mesh scale={[blastScale, blastScale * 0.5, blastScale]}>
            <sphereGeometry args={[0.42, 14, 8]} />
            <meshBasicMaterial color={0xff8a1f} transparent opacity={0.68 * fade} depthWrite={false} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[explosionT * 2.2, explosionT * 2.2, 1]}>
            <ringGeometry args={[0.18, 0.25, 30]} />
            <meshBasicMaterial color={0xfff0bd} transparent opacity={0.84 * fade} depthWrite={false} />
          </mesh>
          {getRocketSparks(capturedPiece).map((spark) => (
            <mesh
              key={spark.id}
              position={[
                spark.x * explosionT,
                spark.y * Math.sin(explosionT * Math.PI) + spark.lift * explosionT,
                spark.z * explosionT,
              ]}
              scale={[spark.size, spark.size, spark.size]}
            >
              <sphereGeometry args={[1, 6, 4]} />
              <meshBasicMaterial color={spark.color} transparent opacity={0.88 * fade} depthWrite={false} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

function RocketFlames({ progress }: { progress: number }) {
  const flame = 0.75 + Math.sin(progress * Math.PI * 8) * 0.18;

  return (
    <group position={[0, -0.11, 0]}>
      <pointLight position={[0, -0.18, 0]} color={0xff7926} intensity={2.2 * flame} distance={2.4} />
      <mesh position={[0, -0.2, 0]} rotation={[Math.PI, 0, 0]} scale={[0.24, 0.54 * flame, 0.24]}>
        <coneGeometry args={[0.24, 0.7, 12]} />
        <meshBasicMaterial color={0xff7626} transparent opacity={0.68} depthWrite={false} />
      </mesh>
      <mesh position={[0, -0.26, 0]} rotation={[Math.PI, 0, 0]} scale={[0.14, 0.44 * flame, 0.14]}>
        <coneGeometry args={[0.18, 0.58, 12]} />
        <meshBasicMaterial color={0xfff0ad} transparent opacity={0.86} depthWrite={false} />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((index) => {
        const angle = (index / 6) * Math.PI * 2;
        const radius = 0.08 + (index % 3) * 0.028;

        return (
          <mesh
            key={index}
            position={[
              Math.cos(angle) * radius * progress,
              -0.36 - progress * (0.16 + index * 0.015),
              Math.sin(angle) * radius * progress,
            ]}
            scale={[0.055 + progress * 0.05, 0.03, 0.055 + progress * 0.05]}
            rotation={[-Math.PI / 2, 0, angle]}
          >
            <circleGeometry args={[1, 10]} />
            <meshBasicMaterial color={0x27231f} transparent opacity={0.24 * (1 - progress * 0.25)} depthWrite={false} />
          </mesh>
        );
      })}
    </group>
  );
}

function SerpentCaptureTendrils({ progress }: { progress: number }) {
  const snakes = [
    { angle: 0.15, radius: 0.19, phase: 0.2, scale: 1.0 },
    { angle: 2.25, radius: 0.18, phase: 1.45, scale: 0.94 },
    { angle: 4.25, radius: 0.205, phase: 2.7, scale: 1.04 },
  ];

  return (
    <group>
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.22, 0.64, 36]} />
        <meshBasicMaterial color={0x071607} transparent opacity={0.2 * (1 - progress * 0.45)} depthWrite={false} />
      </mesh>
      {snakes.map((snake, index) => (
        <CaptureSnake
          key={index}
          progress={progress}
          angle={snake.angle}
          radius={snake.radius}
          phase={snake.phase}
          scale={snake.scale}
        />
      ))}
    </group>
  );
}

function CaptureSnake({
  progress,
  angle,
  radius,
  phase,
  scale,
}: {
  progress: number;
  angle: number;
  radius: number;
  phase: number;
  scale: number;
}) {
  const emerge = easeOutCubic(clamp01(progress / 0.3));
  const coil = easeOutCubic(clamp01(progress / 0.58));
  const yank = easeInCubic(clamp01((progress - 0.34) / 0.48));
  const vanish = clamp01((progress - 0.78) / 0.18);
  const opacity = Math.max(0, 0.94 * emerge * (1 - vanish * 0.75));
  const slither = Math.sin(progress * 10 + phase) * 0.035;
  const visibleLength = 0.24 + coil * 0.76;
  const turns = 0.58;
  const yBase = 0.02 - yank * 0.42;
  const maxHeight = 0.36;
  const points = Array.from({ length: 9 }, (_, index) => {
    const t = (index / 8) * visibleLength;
    const rise = Math.pow(t, 0.78) * maxHeight * emerge;
    const curlAngle = angle + phase * 0.12 + t * Math.PI * 2 * turns + slither;
    const breathingRadius = radius + Math.sin(t * Math.PI * 4.2 + progress * 5 + phase) * 0.02;
    const pullIn = 1 - yank * (0.36 + t * 0.32);
    return new THREE.Vector3(
      Math.cos(curlAngle) * breathingRadius * pullIn,
      yBase + rise - yank * t * 0.32,
      Math.sin(curlAngle) * breathingRadius * pullIn,
    );
  });
  const curve = new THREE.CatmullRomCurve3(points);
  const tail = points[0];
  const head = points[points.length - 1];
  const headDir = curve.getTangent(1).normalize();
  const headYaw = angleForVector(headDir);
  const forward = new THREE.Vector3(headDir.x, 0, headDir.z).normalize();
  const side = new THREE.Vector3(-forward.z, 0, forward.x).normalize();
  const scaleMarks = Array.from({ length: 11 }, (_, index) => {
    const t = 0.1 + index * 0.075;
    const point = curve.getPoint(t);
    const tangent = curve.getTangent(t).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const offset = normal.multiplyScalar(index % 2 === 0 ? 0.018 : -0.018);
    return {
      position: [point.x + offset.x, point.y + 0.038, point.z + offset.z] as [number, number, number],
      rotation: [0, angleForVector(tangent), 0] as [number, number, number],
    };
  });

  return (
    <group scale={[scale, scale, scale]}>
      <mesh>
        <tubeGeometry args={[curve, 72, 0.022, 9, false]} />
        <meshLambertMaterial color={0x2dc52d} transparent opacity={opacity} />
      </mesh>
      {scaleMarks.map((mark, index) => (
        <mesh key={index} position={mark.position} rotation={mark.rotation} scale={[0.62, 0.14, 1]}>
          <sphereGeometry args={[0.013, 7, 4]} />
          <meshLambertMaterial color={index % 2 === 0 ? 0x1c8f22 : 0x7bd145} transparent opacity={opacity * 0.85} />
        </mesh>
      ))}
      <group position={head.toArray()} rotation={[0, headYaw, 0]}>
        <mesh scale={[1.12, 0.72, 1.48]}>
          <sphereGeometry args={[0.044, 12, 7]} />
          <meshLambertMaterial color={0x0f7a0f} transparent opacity={opacity} />
        </mesh>
        <mesh position={[0, -0.006, 0.062]} scale={[0.8, 0.48, 1.05]}>
          <sphereGeometry args={[0.03, 10, 6]} />
          <meshLambertMaterial color={0x2ab52e} transparent opacity={opacity} />
        </mesh>
        <mesh position={[-0.024, 0.026, 0.052]} rotation={[0.16, 0, 0.1]}>
          <coneGeometry args={[0.008, 0.028, 7]} />
          <meshLambertMaterial color={0x1e7f20} transparent opacity={opacity} />
        </mesh>
        <mesh position={[0.024, 0.026, 0.052]} rotation={[0.16, 0, -0.1]}>
          <coneGeometry args={[0.008, 0.028, 7]} />
          <meshLambertMaterial color={0x1e7f20} transparent opacity={opacity} />
        </mesh>
      </group>
      {[-1, 1].map((sign) => {
        const eye = head.clone().add(side.clone().multiplyScalar(sign * 0.034)).add(new THREE.Vector3(0, 0.035, 0));
        return (
          <group key={sign}>
            <mesh position={eye.toArray()}>
              <sphereGeometry args={[0.011, 7, 5]} />
              <meshLambertMaterial color={0xffffff} transparent opacity={opacity} />
            </mesh>
            <mesh position={[eye.x + forward.x * 0.008, eye.y + 0.004, eye.z + forward.z * 0.008]}>
              <sphereGeometry args={[0.006, 5, 4]} />
              <meshLambertMaterial color={0x111111} transparent opacity={opacity} />
            </mesh>
          </group>
        );
      })}
      <MiniSnakeTongue origin={head} forward={forward} side={side} opacity={opacity * (0.45 + coil * 0.55)} />
      <mesh position={tail.toArray()} rotation={[Math.PI / 2, angleForVector(headDir), 0]}>
        <coneGeometry args={[0.022, 0.08, 8]} />
        <meshLambertMaterial color={0x87c94a} transparent opacity={opacity} />
      </mesh>
    </group>
  );
}

function MiniSnakeTongue({
  origin,
  forward,
  side,
  opacity,
}: {
  origin: THREE.Vector3;
  forward: THREE.Vector3;
  side: THREE.Vector3;
  opacity: number;
}) {
  const base = origin.clone().add(forward.clone().multiplyScalar(0.052)).add(new THREE.Vector3(0, 0.006, 0));
  const tip = origin.clone().add(forward.clone().multiplyScalar(0.135));
  const forkA = tip.clone().add(side.clone().multiplyScalar(0.026));
  const forkB = tip.clone().add(side.clone().multiplyScalar(-0.026));

  return (
    <group>
      <MiniCylinderBetween start={base} end={tip} radius={0.0055} color={0xcc2222} opacity={opacity} />
      <MiniCylinderBetween start={tip} end={forkA} radius={0.0045} color={0xcc2222} opacity={opacity} />
      <MiniCylinderBetween start={tip} end={forkB} radius={0.0045} color={0xcc2222} opacity={opacity} />
    </group>
  );
}

function MiniCylinderBetween({
  start,
  end,
  radius,
  color,
  opacity,
}: {
  start: THREE.Vector3;
  end: THREE.Vector3;
  radius: number;
  color: number;
  opacity: number;
}) {
  const midpoint = start.clone().lerp(end, 0.5);
  const direction = end.clone().sub(start);
  const length = direction.length();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.clone().normalize(),
  );

  return (
    <mesh position={midpoint.toArray()} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, length, 6]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

function getCapturedPieceSquare(move: Move): Square {
  if (move.teleportCapturedPiece && move.teleportedTo) {
    return move.teleportedTo;
  }

  if (move.isEnPassant) {
    return { row: move.from.row, col: move.to.col };
  }

  return move.to;
}

function getAnimationCapturedPiece(move: Move): Piece | undefined {
  return move.teleportCapturedPiece ?? move.capturedPiece;
}

function getCaptureScatter(piece: Piece) {
  const seedBase = piece.id.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
  let seed = seedBase || 11;

  return Array.from({ length: 12 }, (_, index) => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    const angle = ((seed % 1000) / 1000) * Math.PI * 2;
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    const radius = 0.14 + ((seed % 1000) / 1000) * 0.32;
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    const lift = 0.12 + ((seed % 1000) / 1000) * 0.28;

    return {
      id: index,
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      y: lift,
      size: 0.025 + (index % 3) * 0.01,
    };
  });
}

function getRocketSparks(piece: Piece) {
  const seedBase = piece.id.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
  let seed = seedBase + 417;

  return Array.from({ length: 20 }, (_, index) => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    const angle = ((seed % 1000) / 1000) * Math.PI * 2;
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    const speed = 0.42 + ((seed % 1000) / 1000) * 0.74;
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    const lift = 0.08 + ((seed % 1000) / 1000) * 0.38;

    return {
      id: index,
      x: Math.cos(angle) * speed,
      z: Math.sin(angle) * speed,
      y: 0.08 + (index % 5) * 0.03,
      lift,
      size: 0.035 + (index % 4) * 0.012,
      color: index % 4 === 0 ? 0xffffff : index % 4 === 1 ? 0xffd76a : index % 4 === 2 ? 0xff5a1f : 0x302822,
    };
  });
}

function angleForVector(vector: THREE.Vector3) {
  return Math.atan2(vector.x, vector.z);
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function easeInCubic(t: number) {
  return t * t * t;
}

function Scene({
  gameState,
  onSquareClick,
  onRubiksShift,
  onRubiksDragActiveChange,
  onRubiksCheckBlocked,
  snakesAndLadders,
  mines,
  theme,
}: SceneProps) {
  const [hoveredSquare, setHoveredSquare] = useState<Square | null>(null);
  const [rubiksDrag, setRubiksDrag] = useState<RubiksDragState | null>(null);
  const rubiksDragStart = useRef<{ square: Square; worldX: number; worldZ: number } | null>(null);
  const rubiksCheckHold = useRef<{ square: Square; timer: number; warned: boolean } | null>(null);
  const rubiksPreviewShift = getRubiksShiftFromDrag(rubiksDrag);

  const handleHover = useCallback(
    (row: number, col: number, on: boolean) => {
      setHoveredSquare(on ? { row, col } : null);
    },
    [],
  );

  const handleSquarePointerDown = useCallback(
    (row: number, col: number, point: THREE.Vector3) => {
      if (theme.boardDecor !== "rubiks" || !onRubiksShift) {
        onSquareClick(row, col);
        return;
      }
      if (gameState.status === "check") {
        if (rubiksCheckHold.current) {
          window.clearTimeout(rubiksCheckHold.current.timer);
        }
        const holdState = { square: { row, col }, timer: 0, warned: false };
        holdState.timer = window.setTimeout(() => {
          holdState.warned = true;
          onRubiksCheckBlocked?.();
        }, 320);
        rubiksCheckHold.current = holdState;
        return;
      }
      rubiksDragStart.current = { square: { row, col }, worldX: point.x, worldZ: point.z };
      setRubiksDrag({ start: { row, col }, axis: null, amount: 0 });
      onRubiksDragActiveChange?.(true);
    },
    [gameState.status, onRubiksCheckBlocked, onRubiksDragActiveChange, onRubiksShift, onSquareClick, theme.boardDecor],
  );

  const updateRubiksDragPreview = useCallback((point: THREE.Vector3) => {
    const start = rubiksDragStart.current;
    if (!start) return;

    const dx = point.x - start.worldX;
    const dz = point.z - start.worldZ;
    const axis: RubiksShift["axis"] = Math.abs(dx) >= Math.abs(dz) ? "row" : "col";
    const rawAmount = axis === "row" ? dx / SQUARE_SIZE : -dz / SQUARE_SIZE;
    const amount = Math.max(-7, Math.min(7, Math.round(rawAmount)));

    setRubiksDrag({ start: start.square, axis, amount });
  }, []);

  const handleSquarePointerUp = useCallback(
    (row: number, col: number, point: THREE.Vector3) => {
      if (theme.boardDecor !== "rubiks" || !onRubiksShift) return;

      const blockedHold = rubiksCheckHold.current;
      if (blockedHold) {
        window.clearTimeout(blockedHold.timer);
        rubiksCheckHold.current = null;
        if (!blockedHold.warned) {
          onSquareClick(row, col);
        }
        return;
      }

      const start = rubiksDragStart.current;
      updateRubiksDragPreview(point);
      const drag = rubiksDrag;
      rubiksDragStart.current = null;
      setRubiksDrag(null);
      onRubiksDragActiveChange?.(false);
      if (!start) return;

      const dx = point.x - start.worldX;
      const dz = point.z - start.worldZ;
      const axis: RubiksShift["axis"] = drag?.axis ?? (Math.abs(dx) >= Math.abs(dz) ? "row" : "col");
      const rawAmount = axis === "row" ? dx / SQUARE_SIZE : -dz / SQUARE_SIZE;
      const amount = Math.max(-7, Math.min(7, Math.round(rawAmount)));

      if (amount === 0) {
        onSquareClick(start.square.row, start.square.col);
        return;
      }

      if (axis === "row") {
        onRubiksShift({ axis: "row", index: start.square.row, amount });
      } else {
        onRubiksShift({ axis: "col", index: start.square.col, amount });
      }
    },
    [onRubiksDragActiveChange, onRubiksShift, onSquareClick, rubiksDrag, theme.boardDecor, updateRubiksDragPreview],
  );

  const cancelRubiksDrag = useCallback(() => {
    if (rubiksCheckHold.current) {
      window.clearTimeout(rubiksCheckHold.current.timer);
      rubiksCheckHold.current = null;
    }
    if (!rubiksDragStart.current) return;
    rubiksDragStart.current = null;
    setRubiksDrag(null);
    onRubiksDragActiveChange?.(false);
  }, [onRubiksDragActiveChange]);

  useEffect(() => {
    window.addEventListener("pointerup", cancelRubiksDrag);
    window.addEventListener("blur", cancelRubiksDrag);

    return () => {
      window.removeEventListener("pointerup", cancelRubiksDrag);
      window.removeEventListener("blur", cancelRubiksDrag);
      cancelRubiksDrag();
    };
  }, [cancelRubiksDrag]);

  const lastMove =
    gameState.moveHistory.length > 0
      ? gameState.moveHistory[gameState.moveHistory.length - 1]
      : null;

  const kingInCheck =
    gameState.status === "check" || gameState.status === "checkmate"
      ? gameState.pieces.find(
          (p) => p.type === "king" && p.color === gameState.currentTurn,
        )
      : null;
  const selectedPiece = gameState.selectedSquare
    ? gameState.pieces.find(
        (piece) =>
          piece.row === gameState.selectedSquare?.row &&
          piece.col === gameState.selectedSquare.col,
      )
    : null;

  const squares: React.ReactNode[] = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const isLight    = (row + col) % 2 === 0;
      const isSelected =
        gameState.selectedSquare?.row === row &&
        gameState.selectedSquare?.col === col;
      const isValidMove = gameState.validMoves.some(
        (m) => m.row === row && m.col === col,
      );
      const isCaptureMove =
        isValidMove &&
        !!selectedPiece &&
        gameState.pieces.some(
          (piece) =>
            piece.row === row &&
            piece.col === col &&
            piece.color !== selectedPiece.color,
        );
      const isCheck = kingInCheck?.row === row && kingInCheck?.col === col;
      const rubiksPreview = getRubiksPreviewOffsets(row, col, rubiksPreviewShift);
      const isRubiksDragOrigin =
        rubiksDrag?.start.row === row && rubiksDrag.start.col === col;

      squares.push(
        <BoardSquare
          key={`${row}-${col}`}
          row={row}
          col={col}
          isLight={isLight}
          isSelected={isSelected}
          isValidMove={isValidMove}
          isCaptureMove={isCaptureMove}
          isCheck={isCheck}
          theme={theme}
          onClick={onSquareClick}
          onHover={handleHover}
          onDragStart={handleSquarePointerDown}
          onDragEnd={handleSquarePointerUp}
          visualOffset={rubiksPreview.visualOffset}
          wrapOffset={rubiksPreview.wrapOffset}
          isRubiksDragOrigin={isRubiksDragOrigin}
          isRubiksDragLine={rubiksPreview.isLine}
        />,
      );
    }
  }

  return (
    <>
      <BoardEnvironment theme={theme} />
      <ambientLight intensity={theme.lighting.ambient} />
      <directionalLight
        position={[5, 12, 7]}
        intensity={theme.lighting.key}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-far={30}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
      />
      <directionalLight position={[-5, 6, -4]} intensity={theme.lighting.fill} />
      <pointLight position={[0, 3.8, -5.4]} intensity={0.7} color={0x8f9cb8} distance={10} />

      <group position={[0, BOARD_ELEVATION, 0]}>
        {theme.boardDecor === "rubiks" && rubiksDrag && (
          <mesh
            position={[0, 0.18, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            onPointerMove={(e) => {
              e.stopPropagation();
              updateRubiksDragPreview(e.point);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              const start = rubiksDragStart.current?.square;
              handleSquarePointerUp(start?.row ?? 0, start?.col ?? 0, e.point);
            }}
          >
            <planeGeometry args={[12, 12]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        )}
        <BoardRim theme={theme} />
        {squares}
        <BoardSurfaceOverlay theme={theme} />
        <BoardThemeDecor theme={theme} />
        <BoardNotation theme={theme} />
        <RubiksDragIndicator shift={rubiksPreviewShift} />

        {/* Snakes & Ladders overlay */}
        <SnakeLadderOverlay snakesAndLadders={snakesAndLadders} />
        <MineClues gameState={gameState} mines={mines} />
        <FoundMineMarkers gameState={gameState} />
        {lastMove?.mineTriggeredAt && (
          <MineExplosion
            key={`mine-explosion-${gameState.moveHistory.length}`}
            square={lastMove.mineTriggeredAt}
          />
        )}
        {theme.boardDecor === "racing" && (
          <PawnSpeedBurst
            key={`pawn-speed-${gameState.moveHistory.length}`}
            move={lastMove}
            gameState={gameState}
          />
        )}
        <CapturedPiecePlaceholder
          key={`captured-piece-${gameState.moveHistory.length}`}
          move={lastMove}
          theme={theme}
        />

        {gameState.pieces.map((piece) => {
          const [wx, wy, wz] = boardToWorld(piece.row, piece.col);
          const rubiksPreview = getRubiksPreviewOffsets(
            piece.row,
            piece.col,
            rubiksPreviewShift,
          );
          const previewPosition: [number, number, number] = [
            wx + rubiksPreview.visualOffset[0],
            wy + rubiksPreview.visualOffset[1],
            wz + rubiksPreview.visualOffset[2],
          ];
          const isSelected =
            gameState.selectedSquare?.row === piece.row &&
            gameState.selectedSquare?.col === piece.col;
          const isHovered =
            hoveredSquare?.row === piece.row && hoveredSquare?.col === piece.col;

          return (
            <group key={piece.id}>
              <ChessPiece
                type={piece.type}
                color={piece.color}
                position={previewPosition}
                isSelected={isSelected}
                isHovered={isHovered}
                visualVariant={theme.boardDecor === "racing" ? "racing" : "default"}
              />
              {rubiksPreview.wrapOffset && (
                <ChessPiece
                  type={piece.type}
                  color={piece.color}
                  position={[
                    previewPosition[0] + rubiksPreview.wrapOffset[0],
                    previewPosition[1],
                    previewPosition[2] + rubiksPreview.wrapOffset[2],
                  ]}
                  isSelected={false}
                  isHovered={false}
                  visualVariant={theme.boardDecor === "racing" ? "racing" : "default"}
                />
              )}
            </group>
          );
        })}
      </group>
    </>
  );
}

/* ── Canvas wrapper ── */
interface ChessBoardProps {
  gameState: GameState;
  onSquareClick: (row: number, col: number) => void;
  onRubiksShift?: (shift: RubiksShift) => void;
  onRubiksCheckBlocked?: () => void;
  snakesAndLadders: SnakeLadder[];
  mines: Mine[];
  theme: BoardThemeConfig;
  cameraMode: "intro" | "intro-hold" | "play";
  cameraSequenceKey: number;
  freeCamera: boolean;
}

export function ChessBoard3D({
  gameState,
  onSquareClick,
  onRubiksShift,
  onRubiksCheckBlocked,
  snakesAndLadders,
  mines,
  theme,
  cameraMode,
  cameraSequenceKey,
  freeCamera,
}: ChessBoardProps) {
  const effectiveCameraMode = freeCamera ? "free" : cameraMode;
  const [rubiksDragActive, setRubiksDragActive] = useState(false);

  useEffect(() => {
    setRubiksDragActive(false);
  }, [theme.id, freeCamera, cameraMode]);

  return (
    <Canvas
      shadows
      camera={{
        position: [
          theme.camera.playPosition[0],
          theme.camera.playPosition[1] + BOARD_ELEVATION,
          theme.camera.playPosition[2],
        ],
        fov: 48,
        near: 0.1,
        far: 600,
      }}
      style={{ width: "100%", height: "100%" }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <CinematicCamera mode={effectiveCameraMode} sequenceKey={cameraSequenceKey} theme={theme} />
      <CameraModePose mode={effectiveCameraMode} theme={theme} />
      <MineCameraShake gameState={gameState} />
      <Scene
        gameState={gameState}
        onSquareClick={onSquareClick}
        onRubiksShift={onRubiksShift}
        onRubiksDragActiveChange={setRubiksDragActive}
        onRubiksCheckBlocked={onRubiksCheckBlocked}
        snakesAndLadders={snakesAndLadders}
        mines={mines}
        theme={theme}
      />
      <OrbitControls
        enabled={effectiveCameraMode !== "intro" && !rubiksDragActive}
        enablePan={freeCamera}
        minPolarAngle={Math.PI / 9}
        maxPolarAngle={freeCamera ? Math.PI - 0.05 : Math.PI / 2.4}
        minDistance={freeCamera ? 1.5 : 5}
        maxDistance={freeCamera ? 80 : 20}
        target={[0, freeCamera ? BOARD_ELEVATION + 1.2 : BOARD_ELEVATION, 0]}
        screenSpacePanning={freeCamera}
        touches={{
          ONE: THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_ROTATE,
        }}
      />
    </Canvas>
  );
}
