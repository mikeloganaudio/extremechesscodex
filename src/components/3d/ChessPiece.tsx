import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PieceType, PieceColor } from "@/game/types";

const WHITE_MAT = new THREE.MeshLambertMaterial({ color: 0xf5ead6 });
const BLACK_MAT = new THREE.MeshLambertMaterial({ color: 0x3b3630 });
const WHITE_TRIM = new THREE.MeshLambertMaterial({ color: 0xe8c97a });
const BLACK_TRIM = new THREE.MeshLambertMaterial({ color: 0x7a5a1a });
const BLACK_RIM = new THREE.MeshLambertMaterial({
  color: 0xe2ded2,
  transparent: true,
  opacity: 0.42,
});

type PieceVisualVariant = "default" | "racing";

function mat(color: PieceColor, variant: PieceVisualVariant = "default") {
  if (color === "white") return WHITE_MAT;
  return BLACK_MAT;
}
function trim(color: PieceColor) {
  return color === "white" ? WHITE_TRIM : BLACK_TRIM;
}

/* ── Shared geometry helpers ── */

function Base({ r, color, variant = "default" }: { r: number; color: PieceColor; variant?: PieceVisualVariant }) {
  return (
    <mesh material={mat(color, variant)} position={[0, 0.04, 0]} castShadow>
      <cylinderGeometry args={[r * 0.82, r, 0.08, 10]} />
    </mesh>
  );
}

function Disc({ y, r, color, variant = "default" }: { y: number; r: number; color: PieceColor; variant?: PieceVisualVariant }) {
  return (
    <mesh material={mat(color, variant)} position={[0, y, 0]} castShadow>
      <cylinderGeometry args={[r, r * 1.08, 0.05, 10]} />
    </mesh>
  );
}

/* ──────────────────────────────
   PAWN  – rounded ball top, tapered waist, broad base
   Total height ~0.82
────────────────────────────── */
function PawnMesh({ color }: { color: PieceColor }) {
  const m = mat(color);
  return (
    <group>
      {/* base */}
      <mesh material={m} position={[0, 0.04, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.2, 0.08, 10]} />
      </mesh>
      {/* taper */}
      <mesh material={m} position={[0, 0.18, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.17, 0.22, 10]} />
      </mesh>
      {/* collar ring */}
      <Disc y={0.3} r={0.1} color={color} />
      {/* neck */}
      <mesh material={m} position={[0, 0.42, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.1, 0.22, 10]} />
      </mesh>
      {/* head */}
      <mesh material={m} position={[0, 0.62, 0]} castShadow>
        <sphereGeometry args={[0.14, 10, 8]} />
      </mesh>
    </group>
  );
}

/* ──────────────────────────────
   ROOK  – crenellated turret
   Total height ~0.9
────────────────────────────── */
function RookMesh({ color }: { color: PieceColor }) {
  const m = mat(color);
  return (
    <group>
      <mesh material={m} position={[0, 0.04, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.23, 0.08, 10]} />
      </mesh>
      {/* shaft */}
      <mesh material={m} position={[0, 0.26, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.19, 0.36, 10]} />
      </mesh>
      {/* mid collar */}
      <Disc y={0.46} r={0.18} color={color} />
      {/* upper shaft */}
      <mesh material={m} position={[0, 0.58, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.16, 0.2, 10]} />
      </mesh>
      {/* parapet ring */}
      <mesh material={m} position={[0, 0.69, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.16, 0.04, 10]} />
      </mesh>
      {/* 4 merlons (battlements) */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2;
        return (
          <mesh
            key={i}
            material={m}
            position={[Math.cos(a) * 0.13, 0.78, Math.sin(a) * 0.13]}
            castShadow
          >
            <boxGeometry args={[0.07, 0.14, 0.07]} />
          </mesh>
        );
      })}
    </group>
  );
}

/* ──────────────────────────────
   KNIGHT  – angular horse head silhouette
   Total height ~1.0
────────────────────────────── */
function KnightMesh({ color }: { color: PieceColor }) {
  const m = mat(color);
  return (
    <group>
      {/* base */}
      <mesh material={m} position={[0, 0.04, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.23, 0.08, 10]} />
      </mesh>
      {/* pedestal */}
      <mesh material={m} position={[0, 0.18, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.19, 0.2, 10]} />
      </mesh>
      {/* collar */}
      <Disc y={0.29} r={0.16} color={color} />
      {/* neck block angled forward */}
      <mesh material={m} position={[0.02, 0.5, 0.04]} rotation={[0.28, 0, 0.06]} castShadow>
        <boxGeometry args={[0.22, 0.42, 0.2]} />
      </mesh>
      {/* snout */}
      <mesh material={m} position={[0.03, 0.58, 0.18]} rotation={[-0.5, 0, 0.04]} castShadow>
        <boxGeometry args={[0.18, 0.16, 0.22]} />
      </mesh>
      {/* poll (top of head) */}
      <mesh material={m} position={[0.01, 0.79, -0.02]} castShadow>
        <boxGeometry args={[0.17, 0.1, 0.18]} />
      </mesh>
      {/* ears */}
      <mesh material={m} position={[-0.06, 0.88, -0.01]} rotation={[0, 0, 0.3]} castShadow>
        <coneGeometry args={[0.035, 0.1, 4]} />
      </mesh>
      <mesh material={m} position={[0.06, 0.88, -0.01]} rotation={[0, 0, -0.3]} castShadow>
        <coneGeometry args={[0.035, 0.1, 4]} />
      </mesh>
    </group>
  );
}

/* ──────────────────────────────
   BISHOP – tall mitre with diagonal notch
   Total height ~1.05
────────────────────────────── */
function BishopMesh({ color }: { color: PieceColor }) {
  const m = mat(color);
  const t = trim(color);
  return (
    <group>
      <mesh material={m} position={[0, 0.04, 0]} castShadow>
        <cylinderGeometry args={[0.19, 0.22, 0.08, 10]} />
      </mesh>
      {/* tapered body */}
      <mesh material={m} position={[0, 0.24, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.18, 0.32, 10]} />
      </mesh>
      {/* collar */}
      <Disc y={0.42} r={0.12} color={color} />
      {/* upper neck */}
      <mesh material={m} position={[0, 0.58, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.11, 0.3, 10]} />
      </mesh>
      {/* band ring (trim) */}
      <mesh material={t} position={[0, 0.52, 0]} castShadow>
        <torusGeometry args={[0.09, 0.018, 6, 16]} />
      </mesh>
      {/* ball */}
      <mesh material={m} position={[0, 0.76, 0]} castShadow>
        <sphereGeometry args={[0.1, 9, 8]} />
      </mesh>
      {/* mitre spike */}
      <mesh material={m} position={[0, 0.95, 0]} castShadow>
        <coneGeometry args={[0.04, 0.2, 6]} />
      </mesh>
      {/* finial orb */}
      <mesh material={t} position={[0, 1.06, 0]} castShadow>
        <sphereGeometry args={[0.03, 6, 5]} />
      </mesh>
    </group>
  );
}

/* ──────────────────────────────
   QUEEN  – tall crown with orb-topped points
   Total height ~1.15
────────────────────────────── */
function QueenMesh({ color }: { color: PieceColor }) {
  const m = mat(color);
  const t = trim(color);
  return (
    <group>
      <mesh material={m} position={[0, 0.04, 0]} castShadow>
        <cylinderGeometry args={[0.21, 0.25, 0.08, 10]} />
      </mesh>
      <mesh material={m} position={[0, 0.26, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.2, 0.36, 10]} />
      </mesh>
      <Disc y={0.46} r={0.14} color={color} />
      <mesh material={m} position={[0, 0.6, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.13, 0.26, 10]} />
      </mesh>
      {/* waist trim ring */}
      <mesh material={t} position={[0, 0.56, 0]} castShadow>
        <torusGeometry args={[0.115, 0.018, 6, 18]} />
      </mesh>
      {/* body sphere */}
      <mesh material={m} position={[0, 0.8, 0]} castShadow>
        <sphereGeometry args={[0.13, 10, 8]} />
      </mesh>
      {/* crown band */}
      <mesh material={t} position={[0, 0.93, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.13, 0.05, 10]} />
      </mesh>
      {/* 5 crown points with orbs */}
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;
        const r = 0.1;
        return (
          <group key={i} position={[Math.cos(a) * r, 0, Math.sin(a) * r]}>
            <mesh material={m} position={[0, 1.05, 0]} castShadow>
              <coneGeometry args={[0.025, 0.1, 5]} />
            </mesh>
            <mesh material={t} position={[0, 1.12, 0]} castShadow>
              <sphereGeometry args={[0.03, 6, 5]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/* ──────────────────────────────
   KING  – tallest, bold cross on crown
   Total height ~1.3
────────────────────────────── */
function KingMesh({ color }: { color: PieceColor }) {
  const m = mat(color);
  const t = trim(color);
  return (
    <group>
      <mesh material={m} position={[0, 0.04, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.26, 0.08, 10]} />
      </mesh>
      <mesh material={m} position={[0, 0.27, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.21, 0.38, 10]} />
      </mesh>
      <Disc y={0.48} r={0.15} color={color} />
      <mesh material={m} position={[0, 0.64, 0]} castShadow>
        <cylinderGeometry args={[0.11, 0.14, 0.3, 10]} />
      </mesh>
      {/* trim band */}
      <mesh material={t} position={[0, 0.6, 0]} castShadow>
        <torusGeometry args={[0.125, 0.018, 6, 18]} />
      </mesh>
      {/* body */}
      <mesh material={m} position={[0, 0.86, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, 0.1, 10]} />
      </mesh>
      {/* crown band */}
      <mesh material={t} position={[0, 0.92, 0]} castShadow>
        <cylinderGeometry args={[0.135, 0.135, 0.06, 10]} />
      </mesh>
      {/* cross vertical */}
      <mesh material={t} position={[0, 1.1, 0]} castShadow>
        <boxGeometry args={[0.055, 0.34, 0.055]} />
      </mesh>
      {/* cross horizontal */}
      <mesh material={t} position={[0, 1.2, 0]} castShadow>
        <boxGeometry args={[0.2, 0.055, 0.055]} />
      </mesh>
    </group>
  );
}

/* ── Registry ── */

const PIECE_MESHES: Record<
  PieceType,
  React.ComponentType<{ color: PieceColor }>
> = {
  pawn: PawnMesh,
  rook: RookMesh,
  knight: KnightMesh,
  bishop: BishopMesh,
  queen: QueenMesh,
  king: KingMesh,
};

/* ── Animated wrapper ── */

interface ChessPieceProps {
  type: PieceType;
  color: PieceColor;
  position: [number, number, number];
  isSelected: boolean;
  isHovered?: boolean;
  isDragging?: boolean;
  visualVariant?: PieceVisualVariant;
}

export function ChessPiece({
  type,
  color,
  position,
  isSelected,
  isHovered = false,
  isDragging = false,
  visualVariant = "default",
}: ChessPieceProps) {
  const groupRef = useRef<THREE.Group>(null);
  const currentPosition = useRef(new THREE.Vector3(...position));
  const moveStart = useRef(new THREE.Vector3(...position));
  const moveTarget = useRef(new THREE.Vector3(...position));
  const moveProgress = useRef(1);
  const liftY = useRef(0);
  const tiltX = useRef(0);
  const tiltZ = useRef(0);

  useEffect(() => {
    const nextTarget = new THREE.Vector3(...position);
    if (isDragging) {
      moveTarget.current.copy(nextTarget);
      moveProgress.current = 1;
      return;
    }

    if (nextTarget.distanceTo(moveTarget.current) < 0.001) return;

    moveStart.current.copy(currentPosition.current);
    moveTarget.current.copy(nextTarget);
    moveProgress.current = 0;
    if (type !== "knight") {
      liftY.current = 0;
    }
  }, [isDragging, position, type]);

  useEffect(() => {
    if (!groupRef.current || color !== "black") return;

    groupRef.current.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      if (child.material === BLACK_MAT) {
        child.material = BLACK_MAT;
      }
    });
  }, [color, type]);

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return;
    if (isDragging) {
      currentPosition.current.lerp(moveTarget.current, Math.min(delta * 8.5, 1));
    } else {
      const moveDuration = type === "knight" ? 0.62 : 0.74;
      moveProgress.current = Math.min(1, moveProgress.current + delta / moveDuration);
      const easedMove =
        moveProgress.current *
        moveProgress.current *
        (3 - 2 * moveProgress.current);
      currentPosition.current.lerpVectors(moveStart.current, moveTarget.current, easedMove);
    }

    const targetLift = isDragging ? 0.42 : isSelected ? 0.48 : isHovered ? 0.11 : 0;
    liftY.current += (targetLift - liftY.current) * Math.min(delta * 5.2, 1);

    const isMoving = moveProgress.current < 1;
    const knightHop = type === "knight" && isMoving
      ? Math.sin(moveProgress.current * Math.PI) * 0.58
      : 0;

    const selectedSway = isSelected || isDragging ? Math.sin(clock.elapsedTime * 1.4) : 0;
    const targetTiltX = isSelected || isDragging ? 0.12 + selectedSway * 0.025 : 0;
    const targetTiltZ = isSelected || isDragging ? -0.1 + Math.cos(clock.elapsedTime * 1.2) * 0.02 : 0;
    tiltX.current += (targetTiltX - tiltX.current) * Math.min(delta * 4.6, 1);
    tiltZ.current += (targetTiltZ - tiltZ.current) * Math.min(delta * 4.6, 1);

    groupRef.current.position.set(
      currentPosition.current.x,
      currentPosition.current.y + liftY.current + knightHop,
      currentPosition.current.z,
    );
    groupRef.current.rotation.set(
      tiltX.current,
      isSelected || isDragging ? selectedSway * 0.08 : 0,
      tiltZ.current,
    );
  });

  const MeshComponent = PIECE_MESHES[type];

  return (
    <group ref={groupRef} position={position}>
      <MeshComponent color={color} />
      {color === "black" && <BlackPieceRim />}
    </group>
  );
}

function BlackPieceRim() {
  return (
    <group raycast={() => null}>
      <mesh material={BLACK_RIM} position={[0, 0.105, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.2, 0.012, 6, 24]} />
      </mesh>
      <mesh material={BLACK_RIM} position={[0, 0.48, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.125, 0.009, 6, 22]} />
      </mesh>
      <mesh material={BLACK_RIM} position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.24, 0.26, 0.016, 20]} />
      </mesh>
    </group>
  );
}
