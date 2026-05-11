import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import type { GameState, Mine, Move, Square, SnakeLadder } from "@/game/types";
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
  isCheck: boolean;
  theme: BoardThemeConfig;
  onClick: (row: number, col: number) => void;
  onHover: (row: number, col: number, on: boolean) => void;
}

function BoardSquare({
  row,
  col,
  isLight,
  isSelected,
  isValidMove,
  isCheck,
  theme,
  onClick,
  onHover,
}: BoardSquareProps) {
  const materialRef = useRef<THREE.MeshLambertMaterial>(null);
  const isRubiks = theme.boardDecor === "rubiks";
  const baseColor =
    isRubiks
      ? getRubiksSquareColor(row, col)
      : isLight ? theme.lightSquare : theme.darkSquare;
  let color = baseColor;
  if (isSelected) color = 0xe8e844;
  else if (isCheck) color = 0xff4444;

  const [wx, , wz] = boardToWorld(row, col);
  const targetColor = useMemo(() => new THREE.Color(color), [color]);
  const rubiksStickerShape = useMemo(() => createRoundedSquareShape(0.82, 0.09), []);

  useFrame(() => {
    materialRef.current?.color.lerp(targetColor, 0.08);
  });

  if (isRubiks) {
    return (
      <group>
        <mesh
          position={[wx, -0.055, wz]}
          receiveShadow
          onPointerDown={(e) => {
            e.stopPropagation();
            onClick(row, col);
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
          <boxGeometry args={[SQUARE_SIZE, 0.12, SQUARE_SIZE]} />
          <meshLambertMaterial color={0x050505} />
        </mesh>
        <mesh
          position={[wx, 0.014, wz]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
          onPointerDown={(e) => {
            e.stopPropagation();
            onClick(row, col);
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
          <shapeGeometry args={[rubiksStickerShape]} />
          <meshLambertMaterial ref={materialRef} color={baseColor} />
        </mesh>
        <mesh position={[wx, 0.018, wz]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
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

        {isValidMove && (
          <mesh position={[wx, 0.04, wz]}>
            <cylinderGeometry args={[0.2, 0.2, 0.04, 14]} />
            <meshLambertMaterial color={0x44bb44} transparent opacity={0.72} />
          </mesh>
        )}
      </group>
    );
  }

  return (
    <group>
      <mesh
        position={[wx, -0.05, wz]}
        receiveShadow
        onPointerDown={(e) => {
          e.stopPropagation();
          onClick(row, col);
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

      {isValidMove && (
        <mesh position={[wx, 0.01, wz]}>
          <cylinderGeometry args={[0.2, 0.2, 0.04, 14]} />
          <meshLambertMaterial color={0x44bb44} transparent opacity={0.72} />
        </mesh>
      )}
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
  const stickerColors = [0xffffff, 0xffdf34, 0xff8b22, 0xef3434, 0x22b95a, 0x2f79ff];
  const stickerPositions = [-3.35, -2.05, -0.75, 0.75, 2.05, 3.35];

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
      {stickerPositions.map((x, index) => (
        <mesh key={`rubiks-front-${index}`} position={[x, 0.05, 4.47]} raycast={() => null}>
          <boxGeometry args={[0.45, 0.035, 0.12]} />
          <meshBasicMaterial color={stickerColors[index]} transparent opacity={0.85} depthWrite={false} />
        </mesh>
      ))}
      {stickerPositions.map((z, index) => (
        <mesh key={`rubiks-side-${index}`} position={[4.47, 0.05, z]} raycast={() => null}>
          <boxGeometry args={[0.12, 0.035, 0.45]} />
          <meshBasicMaterial color={stickerColors[(index + 3) % stickerColors.length]} transparent opacity={0.85} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function RacingDecor() {
  const stripePositions = [-3.5, -2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3.5];

  return (
    <group>
      <mesh position={[0, 0.018, -4.62]} raycast={() => null}>
        <boxGeometry args={[8.4, 0.026, 0.12]} />
        <meshBasicMaterial color={0xe01d2f} transparent opacity={0.88} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.019, 4.62]} raycast={() => null}>
        <boxGeometry args={[8.4, 0.026, 0.12]} />
        <meshBasicMaterial color={0xe01d2f} transparent opacity={0.88} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.02, -4.38]} raycast={() => null}>
        <boxGeometry args={[8.0, 0.022, 0.055]} />
        <meshBasicMaterial color={0xffffff} transparent opacity={0.8} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.02, 4.38]} raycast={() => null}>
        <boxGeometry args={[8.0, 0.022, 0.055]} />
        <meshBasicMaterial color={0xffffff} transparent opacity={0.8} depthWrite={false} />
      </mesh>
      {stripePositions.map((x, index) => (
        <mesh key={`start-stripe-${index}`} position={[x, 0.046, 3.95]} raycast={() => null}>
          <boxGeometry args={[0.5, 0.026, 0.18]} />
          <meshBasicMaterial color={index % 2 === 0 ? 0xffffff : 0x020202} transparent opacity={0.86} depthWrite={false} />
        </mesh>
      ))}
      {stripePositions.map((x, index) => (
        <mesh key={`finish-stripe-${index}`} position={[x, 0.046, -3.95]} raycast={() => null}>
          <boxGeometry args={[0.5, 0.026, 0.18]} />
          <meshBasicMaterial color={index % 2 === 0 ? 0x020202 : 0xffffff} transparent opacity={0.72} depthWrite={false} />
        </mesh>
      ))}
      {[-4.32, 4.32].map((x) => (
        <group key={`kerb-${x}`}>
          {[-2.8, -2.0, -1.2, -0.4, 0.4, 1.2, 2.0, 2.8].map((z, index) => (
            <mesh key={`${x}-${z}`} position={[x, 0.04, z]} raycast={() => null}>
              <boxGeometry args={[0.28, 0.024, 0.5]} />
              <meshBasicMaterial color={index % 2 === 0 ? 0xe01d2f : 0xf0f0ec} transparent opacity={0.78} depthWrite={false} />
            </mesh>
          ))}
        </group>
      ))}
      <pointLight position={[0, 1.0, 4.2]} color={0xff3030} intensity={0.45} distance={4.5} />
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
  snakesAndLadders: SnakeLadder[];
  mines: Mine[];
  theme: BoardThemeConfig;
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

  useEffect(() => {
    startTime.current = 0;
  }, [sequenceKey]);

  useFrame(({ clock }) => {
    if (mode !== "intro" && mode !== "intro-hold") return;

    if (mode === "intro-hold") {
      const angle = Math.PI * 1.45;
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
    const t = Math.min(Math.max(elapsed / 8, 0), 1);
    const eased = 1 - Math.pow(1 - t, 3);
    const angle = Math.PI * 1.45 - eased * Math.PI * 0.72;
    const radius =
      theme.camera.introStartRadius -
      eased * (theme.camera.introStartRadius - theme.camera.introEndRadius);
    const height =
      theme.camera.introStartHeight -
      eased * (theme.camera.introStartHeight - theme.camera.introEndHeight);

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
            <group key={`mine-clue-${piece.id}`} position={[wx + 0.32, 0.09, wz + 0.32]}>
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
          );
        })}
    </>
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

function Scene({ gameState, onSquareClick, snakesAndLadders, mines, theme }: SceneProps) {
  const [hoveredSquare, setHoveredSquare] = useState<Square | null>(null);

  const handleHover = useCallback(
    (row: number, col: number, on: boolean) => {
      setHoveredSquare(on ? { row, col } : null);
    },
    [],
  );

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
      const isCheck = kingInCheck?.row === row && kingInCheck?.col === col;

      squares.push(
        <BoardSquare
          key={`${row}-${col}`}
          row={row}
          col={col}
          isLight={isLight}
          isSelected={isSelected}
          isValidMove={isValidMove}
          isCheck={isCheck}
          theme={theme}
          onClick={onSquareClick}
          onHover={handleHover}
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
        <BoardRim theme={theme} />
        {squares}
        <BoardSurfaceOverlay theme={theme} />
        <BoardThemeDecor theme={theme} />
        <BoardNotation theme={theme} />

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

        {gameState.pieces.map((piece) => {
          const [wx, wy, wz] = boardToWorld(piece.row, piece.col);
          const isSelected =
            gameState.selectedSquare?.row === piece.row &&
            gameState.selectedSquare?.col === piece.col;
          const isHovered =
            hoveredSquare?.row === piece.row && hoveredSquare?.col === piece.col;

          return (
            <ChessPiece
              key={piece.id}
              type={piece.type}
              color={piece.color}
              position={[wx, wy, wz]}
              isSelected={isSelected}
              isHovered={isHovered}
            />
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
  snakesAndLadders,
  mines,
  theme,
  cameraMode,
  cameraSequenceKey,
  freeCamera,
}: ChessBoardProps) {
  const effectiveCameraMode = freeCamera ? "free" : cameraMode;

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
        far: 120,
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
        snakesAndLadders={snakesAndLadders}
        mines={mines}
        theme={theme}
      />
      <OrbitControls
        enabled={effectiveCameraMode !== "intro"}
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
