import { useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import type { BoardThemeConfig } from "@/levels/types";
import { BOARD_ELEVATION } from "./sceneLayout";

interface BoardEnvironmentProps {
  theme: BoardThemeConfig;
}

export function BoardEnvironment({ theme }: BoardEnvironmentProps) {
  return (
    <>
      <color attach="background" args={[theme.environment.fog]} />
      <fog
        attach="fog"
        args={[
          theme.environment.fog,
          theme.environment.fogNear ?? 12,
          theme.environment.fogFar ?? 42,
        ]}
      />
      <StormBeachBackdrop textureUrl={theme.environment.backdropTexture} />
      <StormBeachGround theme={theme} />
      {theme.environment.mist === "heavy" && <MistBanks />}
      <BoardStone />
      <DeathSeat
        position={[
          theme.environment.deathPosition[0],
          0.84,
          theme.environment.deathPosition[2] + 0.05,
        ]}
        rotation={theme.environment.deathRotation}
        scale={3}
      />
      <BackdropProps />
      <DeathPlaceholder
        position={theme.environment.deathPosition}
        rotation={theme.environment.deathRotation}
        scale={theme.environment.deathScale}
      />
    </>
  );
}

function MistBanks() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = Math.sin(clock.elapsedTime * 0.08) * 0.18;
    groupRef.current.position.x = Math.sin(clock.elapsedTime * 0.17) * 0.55;
  });

  const banks = [
    { position: [-8.8, 1.0, -3.8], scale: [6.8, 1.35, 1], speed: 0.08, opacity: 0.1 },
    { position: [7.8, 1.35, -5.8], scale: [7.6, 1.55, 1], speed: -0.06, opacity: 0.09 },
    { position: [-5.4, 1.9, 5.2], scale: [5.8, 1.2, 1], speed: -0.1, opacity: 0.075 },
    { position: [5.5, 2.0, 4.4], scale: [6.2, 1.3, 1], speed: 0.11, opacity: 0.07 },
    { position: [0, 1.15, -10.5], scale: [10.8, 1.65, 1], speed: 0.05, opacity: 0.095 },
  ];

  return (
    <group ref={groupRef}>
      {banks.map((bank, index) => (
        <DriftingMist
          key={index}
          position={bank.position as [number, number, number]}
          scale={bank.scale as [number, number, number]}
          speed={bank.speed}
          opacity={bank.opacity}
        />
      ))}
    </group>
  );
}

function DriftingMist({
  position,
  scale,
  speed,
  opacity,
}: {
  position: [number, number, number];
  scale: [number, number, number];
  speed: number;
  opacity: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const alphaMap = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    if (!context) return null;

    const gradient = context.createRadialGradient(64, 64, 8, 64, 64, 64);
    gradient.addColorStop(0, "rgba(255,255,255,0.78)");
    gradient.addColorStop(0.34, "rgba(255,255,255,0.46)");
    gradient.addColorStop(0.68, "rgba(255,255,255,0.14)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.x = position[0] + Math.sin(clock.elapsedTime * speed * 4) * 0.55;
    ref.current.position.y = position[1] + Math.sin(clock.elapsedTime * speed * 2.6) * 0.16;
    ref.current.rotation.z = Math.sin(clock.elapsedTime * speed) * 0.18;
  });

  return (
    <mesh ref={ref} position={position} scale={scale} rotation={[0, 0, 0]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        color={0xc4c9bf}
        alphaMap={alphaMap ?? undefined}
        transparent
        opacity={opacity}
        depthWrite={false}
        fog={false}
      />
    </mesh>
  );
}

function StormBeachBackdrop({ textureUrl }: { textureUrl: string }) {
  const texture = useLoader(THREE.TextureLoader, textureUrl);
  const radius = 96;
  const floorY = -0.44;
  const centerY = 2.8;
  const phiStart = 0.08;
  const phiEndAtFloor = Math.acos((floorY - centerY) / radius);
  const phiLength = phiEndAtFloor - phiStart;
  const geometry = useMemo(() => {
    const domeGeometry = new THREE.SphereGeometry(
      radius,
      64,
      32,
      0,
      Math.PI * 2,
      phiStart,
      phiLength,
    );
    const uvAttribute = domeGeometry.attributes.uv;

    for (let i = 0; i < uvAttribute.count; i++) {
      const u = uvAttribute.getX(i);
      const v = uvAttribute.getY(i);
      const distanceFromFloor = 1 - v;
      const fisheyeV = 1 - Math.pow(distanceFromFloor, 1.55);
      uvAttribute.setXY(i, u, fisheyeV);
    }

    uvAttribute.needsUpdate = true;
    return domeGeometry;
  }, [phiLength]);

  useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.repeat.set(1, 1);
    texture.offset.set(0, 0);
  }, [texture]);

  return (
    <mesh geometry={geometry} position={[0, centerY, 0]} rotation={[0, Math.PI, 0]}>
      <meshBasicMaterial
        map={texture}
        side={THREE.BackSide}
        fog={false}
        toneMapped={false}
        depthWrite={false}
      />
    </mesh>
  );
}

function StormBeachGround({ theme }: BoardEnvironmentProps) {
  const terrainTexture = useLoader(THREE.TextureLoader, "/assets/wet-beach-sand-terrain.png");

  useMemo(() => {
    terrainTexture.colorSpace = THREE.SRGBColorSpace;
    terrainTexture.wrapS = THREE.RepeatWrapping;
    terrainTexture.wrapT = THREE.RepeatWrapping;
    terrainTexture.repeat.set(14, 14);
    terrainTexture.anisotropy = 8;
  }, [terrainTexture]);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0x8b8f8c,
        map: terrainTexture,
        emissive: 0x101418,
        emissiveIntensity: 0.06,
        roughness: 0.72,
        metalness: 0.05,
      }),
    [terrainTexture],
  );

  return (
    <>
      <mesh position={[0, -0.44, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[170, 170, 1, 1]} />
        <primitive object={material} attach="material" />
      </mesh>
    </>
  );
}

function BoardStone() {
  const stoneMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0xb8b6ad,
        roughness: 0.94,
        metalness: 0.02,
      }),
    [],
  );

  return (
    <group position={[0, 0, 0]} rotation={[0, -0.08, 0]}>
      <mesh position={[0, 0.28, 0]} scale={[1.08, 0.2, 0.88]} receiveShadow castShadow>
        <dodecahedronGeometry args={[5.35, 1]} />
        <primitive object={stoneMaterial} attach="material" />
      </mesh>
      <mesh position={[-0.1, 1.28, 0.18]} rotation={[0.03, 0.12, -0.02]} receiveShadow castShadow>
        <boxGeometry args={[8.6, 3.18, 7.6]} />
        <meshStandardMaterial color={0xaaa79d} roughness={0.98} />
      </mesh>
      <mesh position={[0.55, BOARD_ELEVATION - 0.52, -0.15]} rotation={[0.03, 0.02, -0.015]} receiveShadow castShadow>
        <boxGeometry args={[9.8, 0.3, 9.1]} />
        <meshStandardMaterial color={0xc6c3b8} roughness={0.96} />
      </mesh>
      <mesh position={[-3.2, 0.44, 2.9]} scale={[1.9, 0.58, 1.2]} rotation={[0.02, 0.5, 0.06]} receiveShadow castShadow>
        <dodecahedronGeometry args={[1.4, 0]} />
        <meshStandardMaterial color={0x9f9d96} roughness={0.98} />
      </mesh>
      <mesh position={[3.5, 0.38, -2.8]} scale={[1.7, 0.52, 1.1]} rotation={[-0.04, -0.7, -0.03]} receiveShadow castShadow>
        <dodecahedronGeometry args={[1.25, 0]} />
        <meshStandardMaterial color={0xaaa79f} roughness={0.98} />
      </mesh>
    </group>
  );
}

function BackdropProps() {
  return (
    <>
      <mesh position={[-7.5, -0.15, -8.5]} rotation={[0, 0.25, 0]} receiveShadow>
        <boxGeometry args={[0.18, 0.5, 2.6]} />
        <meshLambertMaterial color={0x24201b} />
      </mesh>
      <mesh position={[7.2, -0.18, -7.6]} rotation={[0, -0.42, 0]} receiveShadow>
        <boxGeometry args={[0.16, 0.42, 2.2]} />
        <meshLambertMaterial color={0x211e1b} />
      </mesh>
      {[-10, -6, 6, 10].map((x, i) => (
        <mesh key={x} position={[x, -0.38, -13 - i * 0.7]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.9 + i * 0.12, 24]} />
          <meshBasicMaterial color={0x050505} transparent opacity={0.18} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}

function DeathSeat({
  position,
  rotation,
  scale,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
}) {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh position={[0, 0.22, 0.04]} scale={[1.55, 0.68, 1.12]} rotation={[0.02, -0.2, -0.02]} receiveShadow castShadow>
        <dodecahedronGeometry args={[0.95, 1]} />
        <meshStandardMaterial color={0xaaa69d} roughness={0.97} />
      </mesh>
      <mesh position={[0.05, -0.03, 0]} scale={[1.2, 0.34, 0.9]} rotation={[0.04, 0.28, -0.03]} receiveShadow castShadow>
        <dodecahedronGeometry args={[0.8, 0]} />
        <meshStandardMaterial color={0x8f8c84} roughness={0.99} />
      </mesh>
    </group>
  );
}

type Point3 = [number, number, number];

function Limb({
  from,
  to,
  radius,
  color = 0x030303,
}: {
  from: Point3;
  to: Point3;
  radius: number;
  color?: number;
}) {
  const start = new THREE.Vector3(...from);
  const end = new THREE.Vector3(...to);
  const midpoint = start.clone().add(end).multiplyScalar(0.5);
  const direction = end.clone().sub(start);
  const length = direction.length();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.clone().normalize(),
  );

  return (
    <mesh position={midpoint.toArray()} quaternion={quaternion} castShadow>
      <capsuleGeometry args={[radius, Math.max(length - radius * 2, 0.02), 6, 8]} />
      <meshStandardMaterial color={color} roughness={0.96} />
    </mesh>
  );
}

function Joint({
  position,
  radius,
  color = 0x030303,
}: {
  position: Point3;
  radius: number;
  color?: number;
}) {
  return (
    <mesh position={position} castShadow>
      <sphereGeometry args={[radius, 8, 6]} />
      <meshStandardMaterial color={color} roughness={0.96} />
    </mesh>
  );
}

function DeathPlaceholder({
  position,
  rotation,
  scale,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const breath = Math.sin(clock.elapsedTime * 1.2) * 0.045;
    const sway = Math.sin(clock.elapsedTime * 0.55) * 0.025;
    groupRef.current.position.y = position[1] + breath;
    groupRef.current.rotation.z = rotation[2] + sway;
  });

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale} castShadow>
      <mesh position={[0, 0.58, 0.08]} scale={[1.25, 0.72, 0.9]} castShadow>
        <sphereGeometry args={[0.34, 10, 8]} />
        <meshStandardMaterial color={0x040404} roughness={0.96} />
      </mesh>

      <mesh position={[0, 1.13, 0.05]} scale={[0.9, 1.1, 0.58]} rotation={[0.1, 0, 0]} castShadow>
        <capsuleGeometry args={[0.34, 1.0, 8, 12]} />
        <meshStandardMaterial color={0x050505} roughness={0.96} />
      </mesh>
      <mesh position={[0, 1.28, 0.06]} scale={[1.3, 0.72, 0.58]} castShadow>
        <sphereGeometry args={[0.32, 10, 8]} />
        <meshStandardMaterial color={0x050505} roughness={0.96} />
      </mesh>

      {[
        [-0.48, 1.34, 0.08],
        [0.48, 1.34, 0.08],
        [-0.58, 0.98, 0.28],
        [0.58, 0.98, 0.28],
        [-0.55, 0.72, 0.7],
        [0.55, 0.72, 0.7],
        [-0.28, 0.5, 0.18],
        [0.28, 0.5, 0.18],
        [-0.34, 0.28, 0.72],
        [0.34, 0.28, 0.72],
      ].map((joint, index) => (
        <Joint key={index} position={joint as Point3} radius={index < 2 ? 0.15 : 0.1} />
      ))}

      <Limb from={[-0.48, 1.34, 0.08]} to={[-0.58, 0.98, 0.28]} radius={0.08} />
      <Limb from={[0.48, 1.34, 0.08]} to={[0.58, 0.98, 0.28]} radius={0.08} />
      <Limb from={[-0.58, 0.98, 0.28]} to={[-0.55, 0.72, 0.7]} radius={0.07} />
      <Limb from={[0.58, 0.98, 0.28]} to={[0.55, 0.72, 0.7]} radius={0.07} />

      <mesh position={[-0.55, 0.65, 0.83]} scale={[0.62, 0.16, 0.26]} rotation={[0.16, -0.03, 0]} castShadow>
        <boxGeometry args={[0.26, 0.12, 0.38]} />
        <meshStandardMaterial color={0x030303} roughness={0.96} />
      </mesh>
      <mesh position={[0.55, 0.65, 0.83]} scale={[0.62, 0.16, 0.26]} rotation={[0.16, 0.03, 0]} castShadow>
        <boxGeometry args={[0.26, 0.12, 0.38]} />
        <meshStandardMaterial color={0x030303} roughness={0.96} />
      </mesh>

      <Limb from={[-0.28, 0.5, 0.18]} to={[-0.34, 0.28, 0.72]} radius={0.12} />
      <Limb from={[0.28, 0.5, 0.18]} to={[0.34, 0.28, 0.72]} radius={0.12} />
      <Limb from={[-0.34, 0.28, 0.72]} to={[-0.36, 0.04, 1.18]} radius={0.1} />
      <Limb from={[0.34, 0.28, 0.72]} to={[0.36, 0.04, 1.18]} radius={0.1} />

      <mesh position={[-0.36, -0.02, 1.34]} scale={[0.72, 0.18, 0.32]} rotation={[0.18, -0.04, 0]} castShadow>
        <boxGeometry args={[0.28, 0.12, 0.46]} />
        <meshStandardMaterial color={0x030303} roughness={0.96} />
      </mesh>
      <mesh position={[0.36, -0.02, 1.34]} scale={[0.72, 0.18, 0.32]} rotation={[0.18, 0.04, 0]} castShadow>
        <boxGeometry args={[0.28, 0.12, 0.46]} />
        <meshStandardMaterial color={0x030303} roughness={0.96} />
      </mesh>

      <mesh position={[0, 1.88, -0.02]} scale={[0.72, 0.88, 0.68]} castShadow>
        <sphereGeometry args={[0.43, 14, 10]} />
        <meshStandardMaterial color={0x020202} roughness={1} />
      </mesh>
      <mesh position={[0, 1.81, 0.31]} scale={[0.4, 0.58, 0.2]} rotation={[0.03, 0, 0]} castShadow>
        <sphereGeometry args={[0.42, 14, 10]} />
        <meshStandardMaterial color={0xdedbd1} roughness={0.82} />
      </mesh>
      <mesh position={[0, 1.78, 0.41]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.11, 0.018, 0.018]} />
        <meshBasicMaterial color={0x111111} />
      </mesh>
      <mesh position={[-0.09, 1.88, 0.43]}>
        <sphereGeometry args={[0.025, 6, 5]} />
        <meshBasicMaterial color={0x020202} />
      </mesh>
      <mesh position={[0.09, 1.88, 0.43]}>
        <sphereGeometry args={[0.025, 6, 5]} />
        <meshBasicMaterial color={0x020202} />
      </mesh>

      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.6, 32]} />
        <meshBasicMaterial color={0x000000} transparent opacity={0.38} depthWrite={false} />
      </mesh>
    </group>
  );
}
