import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { SnakeLadder } from "@/game/types";
import { boardToWorld } from "@/utils/boardUtils";

/* ─── Primitive: cylinder between two 3D points ─── */

interface CylBetweenProps {
  x1: number; y1: number; z1: number;
  x2: number; y2: number; z2: number;
  radius: number;
  color: number;
  opacity?: number;
}

function CylBetween({ x1, y1, z1, x2, y2, z2, radius, color, opacity = 1 }: CylBetweenProps) {
  const [mid, len, quat] = useMemo(() => {
    const p1  = new THREE.Vector3(x1, y1, z1);
    const p2  = new THREE.Vector3(x2, y2, z2);
    const m   = p1.clone().lerp(p2, 0.5);
    const l   = p1.distanceTo(p2);
    const dir = p2.clone().sub(p1).normalize();
    // Guard against degenerate case where dir ≈ (0,1,0) or (0,-1,0)
    const up  = Math.abs(dir.y) > 0.99
      ? new THREE.Vector3(1, 0, 0)
      : new THREE.Vector3(0, 1, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(up, dir);
    return [[m.x, m.y, m.z] as [number, number, number], l, q] as const;
  }, [x1, y1, z1, x2, y2, z2]);

  return (
    <mesh position={mid} quaternion={quat}>
      <cylinderGeometry args={[radius, radius, len, 8]} />
      <meshLambertMaterial color={color} transparent={opacity < 1} opacity={opacity} />
    </mesh>
  );
}

function angleForDirection(dir: THREE.Vector3): number {
  return Math.atan2(dir.x, dir.z);
}

function FlowDot({
  start,
  end,
  color,
  speed = 0.28,
  delay = 0,
}: {
  start: THREE.Vector3;
  end: THREE.Vector3;
  color: number;
  speed?: number;
  delay?: number;
}) {
  const ref = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = (clock.elapsedTime * speed + delay) % 1;
    const eased = t * t * (3 - 2 * t);
    ref.current.position.copy(start).lerp(end, eased);
  });

  return (
    <group ref={ref}>
      <mesh>
        <sphereGeometry args={[0.08, 16, 10]} />
        <meshBasicMaterial color={color} transparent opacity={0.14} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.26, 20, 12]} />
        <meshBasicMaterial color={color} transparent opacity={0.04} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function SnakeShadowFlow({ curve }: { curve: THREE.CatmullRomCurve3 }) {
  const ref = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = (clock.elapsedTime * 0.22) % 1;
    const p = curve.getPoint(t);
    ref.current.position.set(p.x, p.y + 0.045, p.z);
  });

  return (
    <group ref={ref}>
      <mesh scale={[1.55, 0.2, 0.86]}>
        <sphereGeometry args={[0.16, 16, 10]} />
        <meshBasicMaterial
          color={0x020202}
          transparent
          opacity={0.12}
          blending={THREE.NormalBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh scale={[2.1, 0.16, 1.12]}>
        <sphereGeometry args={[0.26, 20, 12]} />
        <meshBasicMaterial
          color={0x000000}
          transparent
          opacity={0.04}
          blending={THREE.NormalBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/* ─── Ladder ─── */

const RAIL_COLOR = 0x7B4F2A;
const RUNG_COLOR = 0xC48A35;
const RAIL_R     = 0.038;
const RUNG_R     = 0.028;
const RAIL_HALF  = 0.19; // how far apart the two rails are (half-gap)
const LADDER_Y   = 0.06;

export function Ladder3D({ snl }: { snl: SnakeLadder }) {
  const geom = useMemo(() => {
    const [x1, , z1] = boardToWorld(snl.start.row, snl.start.col);
    const [x2, , z2] = boardToWorld(snl.end.row, snl.end.col);
    const Y = LADDER_Y;

    const p1  = new THREE.Vector3(x1, Y, z1);
    const p2  = new THREE.Vector3(x2, Y, z2);
    const dir = p2.clone().sub(p1).normalize();
    // Perpendicular in the XZ plane
    const perp = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    const len  = p1.distanceTo(p2);

    // Rail end-points
    const r1a = p1.clone().addScaledVector(perp,  RAIL_HALF);
    const r1b = p2.clone().addScaledVector(perp,  RAIL_HALF);
    const r2a = p1.clone().addScaledVector(perp, -RAIL_HALF);
    const r2b = p2.clone().addScaledVector(perp, -RAIL_HALF);

    // Rungs evenly spaced
    const rungCount = Math.max(2, Math.round(len / 0.42));
    const rungs: Array<[THREE.Vector3, THREE.Vector3]> = [];
    for (let i = 0; i <= rungCount; i++) {
      const t = i / rungCount;
      rungs.push([r1a.clone().lerp(r1b, t), r2a.clone().lerp(r2b, t)]);
    }

    const flowStart = p1.clone().setY(Y + 0.12);
    const flowEnd = p2.clone().setY(Y + 0.12);

    return { r1a, r1b, r2a, r2b, rungs, flowStart, flowEnd };
  }, [snl]);

  function pts(a: THREE.Vector3, b: THREE.Vector3) {
    return { x1: a.x, y1: a.y, z1: a.z, x2: b.x, y2: b.y, z2: b.z };
  }

  return (
    <group>
      {/* Rails */}
      <CylBetween {...pts(geom.r1a, geom.r1b)} radius={RAIL_R} color={RAIL_COLOR} />
      <CylBetween {...pts(geom.r2a, geom.r2b)} radius={RAIL_R} color={RAIL_COLOR} />

      {/* Rungs */}
      {geom.rungs.map(([a, b], i) => (
        <CylBetween key={i} {...pts(a, b)} radius={RUNG_R} color={RUNG_COLOR} />
      ))}

      <FlowDot start={geom.flowStart} end={geom.flowEnd} color={0xffffff} speed={0.34} />
      <FlowDot start={geom.flowStart} end={geom.flowEnd} color={0xf8f4df} speed={0.34} delay={0.5} />

      {/* End-cap spheres at start and end */}
      <mesh position={[geom.r1a.x, geom.r1a.y, geom.r1a.z]}>
        <sphereGeometry args={[RAIL_R * 1.3, 8, 6]} />
        <meshLambertMaterial color={RAIL_COLOR} />
      </mesh>
      <mesh position={[geom.r2a.x, geom.r2a.y, geom.r2a.z]}>
        <sphereGeometry args={[RAIL_R * 1.3, 8, 6]} />
        <meshLambertMaterial color={RAIL_COLOR} />
      </mesh>
      <mesh position={[geom.r1b.x, geom.r1b.y, geom.r1b.z]}>
        <sphereGeometry args={[RAIL_R * 1.3, 8, 6]} />
        <meshLambertMaterial color={RAIL_COLOR} />
      </mesh>
      <mesh position={[geom.r2b.x, geom.r2b.y, geom.r2b.z]}>
        <sphereGeometry args={[RAIL_R * 1.3, 8, 6]} />
        <meshLambertMaterial color={RAIL_COLOR} />
      </mesh>

      {/* Floor markers: golden discs at start & end */}
      <mesh position={[geom.r1a.x + RAIL_HALF, 0.001, geom.r1a.z - (geom.r1a.z - geom.r2a.z) / 2]}
        rotation={[-Math.PI / 2, 0, 0]}>
      </mesh>
      <ShimmerMarker row={snl.start.row} col={snl.start.col} tone="white" intensity="strong" />
      <ShimmerMarker row={snl.end.row}   col={snl.end.col}   tone="ladder-exit" />
    </group>
  );
}

/* ─── Snake ─── */

const SNAKE_BODY_COLOR = 0x2dc52d;
const SNAKE_HEAD_COLOR = 0x0f7a0f;
const SNAKE_EYE_COLOR  = 0xffffff;
const SNAKE_Y          = 0.07;

export function Snake3D({ snl }: { snl: SnakeLadder }) {
  const [x1, , z1] = boardToWorld(snl.start.row, snl.start.col);
  const [x2, , z2] = boardToWorld(snl.end.row, snl.end.col);

  const { tubeGeo, curve, headPos, tailPos, eyeOffsets, headDir, tailDir, scaleMarks } = useMemo(() => {
    const Y   = SNAKE_Y;
    const p0  = new THREE.Vector3(x1, Y, z1);
    const p4  = new THREE.Vector3(x2, Y, z2);
    const dir = p4.clone().sub(p0).normalize();
    const perp = new THREE.Vector3(-dir.z, 0, dir.x);

    // Wavy S-curve control points
    const p1 = p0.clone().lerp(p4, 0.25).addScaledVector(perp,  0.4).setY(Y + 0.18);
    const p2 = p0.clone().lerp(p4, 0.50)                             .setY(Y + 0.32);
    const p3 = p0.clone().lerp(p4, 0.75).addScaledVector(perp, -0.4).setY(Y + 0.18);

    const curve = new THREE.CatmullRomCurve3([p0, p1, p2, p3, p4]);
    const tubeGeo = new THREE.TubeGeometry(curve, 64, 0.068, 12, false);

    // Head direction for positioning eyes
    const tangentAtHead = curve.getTangent(0).normalize();
    const tangentAtTail = curve.getTangent(1).normalize();

    // Eye offset: perpendicular to the tangent in XZ, then a bit up
    const eyePerp = new THREE.Vector3(-tangentAtHead.z, 0, tangentAtHead.x).normalize();
    const scaleMarks = Array.from({ length: 22 }, (_, i) => {
      const t = 0.06 + i * 0.04;
      const p = curve.getPoint(t);
      const tangent = curve.getTangent(t).normalize();
      const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      const offset = side.multiplyScalar(i % 2 === 0 ? 0.048 : -0.048);
      return {
        position: [p.x + offset.x, p.y + 0.065, p.z + offset.z] as [number, number, number],
        rotation: [0, angleForDirection(tangent), 0] as [number, number, number],
      };
    });

    return {
      tubeGeo,
      curve,
      headPos: [x1, Y + 0.07, z1] as [number, number, number],
      tailPos: [x2, Y + 0.04, z2] as [number, number, number],
      eyeOffsets: [
        eyePerp.clone().multiplyScalar( 0.055),
        eyePerp.clone().multiplyScalar(-0.055),
      ],
      headDir: tangentAtHead,
      tailDir: tangentAtTail,
      scaleMarks,
    };
  }, [x1, z1, x2, z2]);

  // Tongue: two small cylinders forming a fork
  const [tx, ty, tz] = headPos;
  const tongueFwd = new THREE.Vector3(headDir.x, 0, headDir.z).normalize().multiplyScalar(0.1);
  const headAngle = angleForDirection(headDir);
  const tailAngle = angleForDirection(tailDir);

  return (
    <group>
      {/* Body tube */}
      <mesh geometry={tubeGeo}>
        <meshLambertMaterial color={SNAKE_BODY_COLOR} />
      </mesh>

      {/* Subtle raised scale texture */}
      {scaleMarks.map((mark, i) => (
        <mesh
          key={i}
          position={mark.position}
          rotation={mark.rotation}
          scale={[0.7, 0.16, 1]}
        >
          <sphereGeometry args={[0.035, 8, 5]} />
          <meshLambertMaterial color={i % 2 === 0 ? 0x1c8f22 : 0x7bd145} />
        </mesh>
      ))}

      <SnakeShadowFlow curve={curve} />

      {/* Shaped head */}
      <group position={headPos} rotation={[0, headAngle, 0]}>
        <mesh scale={[1.15, 0.72, 1.55]}>
          <sphereGeometry args={[0.12, 16, 10]} />
          <meshLambertMaterial color={SNAKE_HEAD_COLOR} />
        </mesh>
        <mesh position={[0, -0.012, 0.12]} scale={[0.82, 0.46, 1.05]}>
          <sphereGeometry args={[0.09, 14, 8]} />
          <meshLambertMaterial color={0x2ab52e} />
        </mesh>
        <mesh position={[-0.045, 0.04, 0.085]} rotation={[0.18, 0, 0.1]}>
          <coneGeometry args={[0.022, 0.07, 8]} />
          <meshLambertMaterial color={0x1e7f20} />
        </mesh>
        <mesh position={[0.045, 0.04, 0.085]} rotation={[0.18, 0, -0.1]}>
          <coneGeometry args={[0.022, 0.07, 8]} />
          <meshLambertMaterial color={0x1e7f20} />
        </mesh>
      </group>

      {/* Eyes */}
      {eyeOffsets.map((off, i) => (
        <group key={i}>
          <mesh position={[tx + off.x, ty + 0.06, tz + off.z]}>
            <sphereGeometry args={[0.032, 8, 6]} />
            <meshLambertMaterial color={SNAKE_EYE_COLOR} />
          </mesh>
          <mesh position={[tx + off.x, ty + 0.07, tz + off.z]}>
            <sphereGeometry args={[0.018, 6, 5]} />
            <meshLambertMaterial color={0x111111} />
          </mesh>
        </group>
      ))}

      {/* Tongue */}
      <CylBetween
        x1={tx} y1={ty + 0.02} z1={tz}
        x2={tx + tongueFwd.x * 0.9} y2={ty + 0.01} z2={tz + tongueFwd.z * 0.9}
        radius={0.012} color={0xcc2222}
      />
      <CylBetween
        x1={tx + tongueFwd.x * 0.8} y1={ty + 0.01} z1={tz + tongueFwd.z * 0.8}
        x2={tx + tongueFwd.x * 1.2 + 0.04} y2={ty} z2={tz + tongueFwd.z * 1.2 - 0.04}
        radius={0.009} color={0xcc2222}
      />
      <CylBetween
        x1={tx + tongueFwd.x * 0.8} y1={ty + 0.01} z1={tz + tongueFwd.z * 0.8}
        x2={tx + tongueFwd.x * 1.2 - 0.04} y2={ty} z2={tz + tongueFwd.z * 1.2 + 0.04}
        radius={0.009} color={0xcc2222}
      />

      {/* Tail tip */}
      <group position={tailPos} rotation={[Math.PI / 2, tailAngle, 0]}>
        <mesh>
          <coneGeometry args={[0.065, 0.22, 10]} />
          <meshLambertMaterial color={0x87c94a} />
        </mesh>
        <mesh position={[0, 0.09, 0]}>
          <sphereGeometry args={[0.032, 8, 5]} />
          <meshLambertMaterial color={0xb7a54a} />
        </mesh>
      </group>

      {/* Floor markers */}
      <ShimmerMarker row={snl.start.row} col={snl.start.col} tone="black" intensity="strong" />
      <ShimmerMarker row={snl.end.row}   col={snl.end.col}   tone="snake-exit" />
    </group>
  );
}

/* ─── Floor marker (flat torus ring on the board square) ─── */

interface ShimmerMarkerProps {
  row: number;
  col: number;
  tone: "white" | "black" | "ladder-exit" | "snake-exit";
  intensity?: "normal" | "strong";
}

function ShimmerMarker({
  row,
  col,
  tone,
  intensity = "normal",
}: ShimmerMarkerProps) {
  const [wx, , wz] = boardToWorld(row, col);
  const isBlackAccess = tone === "black";
  const isWhiteAccess = tone === "white";
  const color =
    tone === "white" ? 0xffffff :
    tone === "black" ? 0x030303 :
    tone === "ladder-exit" ? 0xf5d98a :
    0x296f2c;
  const edgeColor = isBlackAccess ? 0x3b332b : color;
  const blend = isBlackAccess ? THREE.NormalBlending : THREE.AdditiveBlending;
  const baseOpacity = intensity === "strong" ? 0.34 : 0.18;
  const ringOpacity = intensity === "strong" ? 0.58 : 0.32;

  return (
    <group position={[wx, 0.004, wz]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh scale={[1.28, 0.78, 1]} rotation={[0, 0, 0.18]}>
        <circleGeometry args={[0.43, 40]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={baseOpacity}
          blending={blend}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh scale={[1.02, 0.58, 1]} rotation={[0, 0, -0.42]}>
        <ringGeometry args={[0.27, 0.38, 48]} />
        <meshBasicMaterial
          color={edgeColor}
          transparent
          opacity={ringOpacity}
          blending={blend}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh scale={[0.72, 1.08, 1]} rotation={[0, 0, 0.82]}>
        <ringGeometry args={[0.16, 0.2, 32]} />
        <meshBasicMaterial
          color={isWhiteAccess ? 0xf8f4df : edgeColor}
          transparent
          opacity={isBlackAccess ? 0.42 : 0.5}
          blending={blend}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

/* ─── Combined renderer ─── */

export function SnakeLadderOverlay({ snakesAndLadders }: { snakesAndLadders: SnakeLadder[] }) {
  return (
    <>
      {snakesAndLadders.map((snl) =>
        snl.kind === "ladder"
          ? <Ladder3D key={snl.id} snl={snl} />
          : <Snake3D  key={snl.id} snl={snl} />,
      )}
    </>
  );
}
