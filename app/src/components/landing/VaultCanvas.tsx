"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { useReducedMotion } from "@/lib/useReducedMotion";

/**
 * The vault. Built entirely from primitives: no model files, nothing to download.
 *
 * Stage 0  Awaiting acceptance  door closed, bolts drawn back, brass light
 * Stage 1  Active               wheel turns, bolts slam home
 * Stage 2  Disputed             bolts retract, door splits in two, red light leaks out,
 *                               both parties' filings appear
 * Stage 3  Ruled                door rejoins and locks, a hash seal forms in front
 * Stage 4  Settled              door swings open, coins leave toward the winner
 *
 * Stage changes are never snapped: every parameter is critically damped toward its
 * target, and later motions are gated on earlier ones (bolts before door, door before coins).
 */

const R = 1.55; // door radius
const T = 0.5; // door thickness
const BOLTS = 12;
const COINS = 12;
const TICKS = 32;

const damp = THREE.MathUtils.damp;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);

const COLORS = {
  brass: new THREE.Color("#ddb04a"),
  flare: new THREE.Color("#ff7052"),
  signal: new THREE.Color("#74b4ff"),
  verdict: new THREE.Color("#4bdda3"),
};

const TARGETS = [
  { lock: 0, split: 0, seal: 0, open: 0, light: 0.7, glow: COLORS.brass },
  { lock: 1, split: 0, seal: 0, open: 0, light: 0.9, glow: COLORS.brass },
  { lock: 0, split: 1, seal: 0, open: 0, light: 2.2, glow: COLORS.flare },
  { lock: 1, split: 0, seal: 1, open: 0, light: 1.3, glow: COLORS.signal },
  { lock: 0, split: 0, seal: 0, open: 1, light: 2.6, glow: COLORS.verdict },
] as const;

function makeGlowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.22, "rgba(255,255,255,0.4)");
  grad.addColorStop(0.55, "rgba(255,255,255,0.07)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Image-based lighting without downloading an HDR: a tiny procedural "room". */
function Env() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = pmrem.fromScene(room, 0.04);
    scene.environment = target.texture;
    scene.environmentIntensity = 0.42;
    return () => {
      scene.environment = null;
      target.dispose();
      pmrem.dispose();
      room.dispose();
    };
  }, [gl, scene]);

  return null;
}

/** Keeps the whole vault in frame at any container aspect ratio. */
function Fit() {
  const size = useThree((s) => s.size);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / Math.max(size.height, 1);
    const half = 2.55;
    const tan = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    cam.position.z = (half / tan) * Math.max(1, 1 / aspect);
    cam.updateProjectionMatrix();
  }, [size, camera]);

  return null;
}

type Mats = ReturnType<typeof useMats>;

function useMats() {
  const mats = useMemo(() => {
    const glowTex = makeGlowTexture();
    return {
      glowTex,
      steel: new THREE.MeshStandardMaterial({ color: "#2c3d43", metalness: 0.55, roughness: 0.5 }),
      frame: new THREE.MeshStandardMaterial({ color: "#26363b", metalness: 0.85, roughness: 0.42 }),
      brass: new THREE.MeshStandardMaterial({ color: "#ddb04a", metalness: 1, roughness: 0.26 }),
      accent: new THREE.MeshStandardMaterial({
        color: "#ddb04a",
        emissive: "#ddb04a",
        emissiveIntensity: 0.8,
        metalness: 0.4,
        roughness: 0.3,
      }),
      cavity: new THREE.MeshStandardMaterial({
        color: "#0c1a1e",
        metalness: 0.6,
        roughness: 0.7,
        side: THREE.BackSide,
      }),
      floor: new THREE.MeshBasicMaterial({ color: "#040b0d" }),
      paper: new THREE.MeshStandardMaterial({ color: "#efe7d3", roughness: 0.9 }),
      ink: new THREE.MeshBasicMaterial({ color: "#4a463a" }),
      crystal: new THREE.MeshStandardMaterial({
        color: "#74b4ff",
        metalness: 0.35,
        roughness: 0.18,
        emissive: "#0b2a55",
        emissiveIntensity: 0.6,
        flatShading: true,
      }),
      tick: new THREE.MeshStandardMaterial({
        color: "#4bdda3",
        emissive: "#4bdda3",
        emissiveIntensity: 1.2,
      }),
      back: new THREE.MeshBasicMaterial({
        map: glowTex,
        color: COLORS.brass.clone(),
        transparent: true,
        depthWrite: false,
      }),
      halo: new THREE.SpriteMaterial({
        map: glowTex,
        color: COLORS.brass.clone(),
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    };
  }, []);

  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => m.dispose());
    },
    [mats]
  );

  return mats;
}

const boltAngle = (i: number) => (i + 0.5) * ((Math.PI * 2) / BOLTS);

function DoorHalf({
  side,
  groupRef,
  mats,
  setBolt,
}: {
  side: 1 | -1;
  groupRef: React.RefObject<THREE.Group | null>;
  mats: Mats;
  setBolt: (i: number, el: THREE.Mesh | null) => void;
}) {
  const arcRot = side === 1 ? -Math.PI / 2 : Math.PI / 2;

  return (
    <group ref={groupRef}>
      {/* the half disc */}
      <mesh material={mats.steel} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[R, R, T, 64, 1, false, side === 1 ? 0 : Math.PI, Math.PI]} />
      </mesh>
      {/* closes the cut face so the halves read as solid when apart */}
      <mesh material={mats.steel} position={[side * 0.01, 0, 0]}>
        <boxGeometry args={[0.02, R * 2, T]} />
      </mesh>
      {/* the glowing seam */}
      <mesh material={mats.accent} position={[side * 0.02, 0, T / 2 + 0.004]}>
        <boxGeometry args={[0.02, R * 2 - 0.12, 0.02]} />
      </mesh>
      {/* engraved rings */}
      <mesh material={mats.accent} position={[0, 0, T / 2 + 0.004]} rotation={[0, 0, arcRot]}>
        <torusGeometry args={[1.28, 0.028, 12, 64, Math.PI]} />
      </mesh>
      <mesh material={mats.brass} position={[0, 0, T / 2 + 0.004]} rotation={[0, 0, arcRot]}>
        <torusGeometry args={[1.0, 0.018, 12, 64, Math.PI]} />
      </mesh>
      {/* the bolts that live on this half */}
      {Array.from({ length: BOLTS }).map((_, i) => {
        const a = boltAngle(i);
        if (Math.sign(Math.cos(a)) !== side) return null;
        return (
          <group key={i} rotation={[0, 0, a]}>
            <mesh
              ref={(el) => setBolt(i, el)}
              material={mats.brass}
              position={[R - 0.3, 0, 0]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.09, 0.09, 0.45, 16]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function Sheet({
  groupRef,
  mats,
  position,
}: {
  groupRef: React.RefObject<THREE.Group | null>;
  mats: Mats;
  position: [number, number, number];
}) {
  const lines = [0.3, 0.17, 0.04, -0.09, -0.22];
  return (
    <group ref={groupRef} position={position}>
      <mesh material={mats.paper}>
        <boxGeometry args={[0.76, 0.98, 0.02]} />
      </mesh>
      {lines.map((y, i) => (
        <mesh key={y} material={mats.ink} position={[i === 4 ? -0.1 : 0, y, 0.013]}>
          <boxGeometry args={[i === 4 ? 0.36 : 0.58, 0.03, 0.004]} />
        </mesh>
      ))}
    </group>
  );
}

function Vault({ stage, reduce }: { stage: number; reduce: boolean }) {
  const mats = useMats();

  const start = TARGETS[Math.min(Math.max(stage, 0), TARGETS.length - 1)];
  const p = useRef<{ lock: number; split: number; seal: number; open: number; light: number }>({
    lock: start.lock,
    split: start.split,
    seal: start.seal,
    open: start.open,
    light: start.light,
  });
  const glow = useRef(start.glow.clone());

  const root = useRef<THREE.Group>(null);
  const pivot = useRef<THREE.Group>(null);
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const wheel = useRef<THREE.Group>(null);
  const coinSpin = useRef<THREE.Group>(null);
  const seal = useRef<THREE.Group>(null);
  const crystal = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Group>(null);
  const sheetL = useRef<THREE.Group>(null);
  const sheetR = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);
  const bolts = useRef<(THREE.Mesh | null)[]>([]);
  const flying = useRef<(THREE.Group | null)[]>([]);

  const setBolt = (i: number, el: THREE.Mesh | null) => {
    bolts.current[i] = el;
  };

  // Where each coin ends up: out of the vault and toward the viewer.
  const coinEnds = useMemo(
    () =>
      Array.from({ length: COINS }).map((_, i) => ({
        x: ((i % 4) - 1.5) * 0.9,
        y: (Math.floor(i / 4) - 1) * 0.85 + 0.2,
        z: 1.4 + (i % 3) * 0.5,
        spin: 1.5 + (i % 5) * 0.4,
      })),
    []
  );

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;
    const tg = TARGETS[Math.min(Math.max(stage, 0), TARGETS.length - 1)];
    const k = reduce ? 80 : 3.4;
    const q = p.current;

    q.lock = damp(q.lock, tg.lock, k * 1.3, dt);
    q.split = damp(q.split, tg.split, k * 0.9, dt);
    q.seal = damp(q.seal, tg.seal, k, dt);
    q.open = damp(q.open, tg.open, k * 0.6, dt);
    q.light = damp(q.light, tg.light, k, dt);
    glow.current.lerp(tg.glow, 1 - Math.exp(-k * dt));

    const idle = reduce ? 0 : 1;
    // Gates: the bolts must be back before the door can split or swing.
    const openEff = q.open * (1 - q.lock);
    const splitEff = q.split * (1 - q.lock);
    const lit = Math.max(openEff, splitEff);

    if (root.current) {
      root.current.rotation.y = damp(
        root.current.rotation.y,
        idle * (state.pointer.x * 0.32 + Math.sin(t * 0.4) * 0.07) + 0.14,
        3,
        dt
      );
      root.current.rotation.x = damp(root.current.rotation.x, idle * -state.pointer.y * 0.16 - 0.05, 3, dt);
      root.current.position.y = idle * Math.sin(t * 0.8) * 0.05;
    }

    if (pivot.current) pivot.current.rotation.y = -1.28 * openEff;

    const gap = 0.62 * splitEff;
    const forward = 0.55 * splitEff;
    if (right.current) {
      right.current.position.set(gap, 0, forward);
      right.current.rotation.y = 0.22 * splitEff;
    }
    if (left.current) {
      left.current.position.set(-gap, 0, forward);
      left.current.rotation.y = -0.22 * splitEff;
    }

    if (wheel.current) {
      wheel.current.rotation.z = -q.lock * Math.PI * 1.25 + idle * Math.sin(t * 0.6) * 0.04;
      wheel.current.position.z = T / 2 + 0.12 + splitEff * 0.7;
    }

    for (const b of bolts.current) if (b) b.position.x = R - 0.3 + q.lock * 0.36;

    mats.accent.color.copy(glow.current);
    mats.accent.emissive.copy(glow.current);
    mats.accent.emissiveIntensity = 0.7 + splitEff * 1.2 + idle * 0.08 * Math.sin(t * 2);
    mats.back.color.copy(glow.current).multiplyScalar(0.25 + 0.75 * lit);
    mats.halo.color.copy(glow.current);
    mats.halo.opacity = 0.26 + 0.24 * Math.max(lit, q.seal);

    if (light.current) {
      light.current.color.copy(glow.current);
      light.current.intensity = q.light * 9;
    }

    if (coinSpin.current) coinSpin.current.rotation.y = idle ? t * 0.9 : 0.5;

    // Coins leave once the door is open.
    const c = clamp01(openEff * 1.15 - 0.15);
    flying.current.forEach((g, i) => {
      if (!g) return;
      const prog = clamp01(c * 1.6 - i * 0.05);
      g.visible = prog > 0.001;
      if (!g.visible) return;
      const e = coinEnds[i];
      const ep = easeOut(prog);
      g.position.set(
        e.x * ep,
        e.y * ep + Math.sin(prog * Math.PI) * 0.5 + idle * Math.sin(t * 1.4 + i) * 0.03 * prog,
        -0.7 + (e.z + 0.7) * ep
      );
      g.rotation.set(t * e.spin * idle * 0.4, t * e.spin * idle * 0.6 + prog * 4, 0);
    });

    if (seal.current) {
      const s = easeOut(q.seal);
      seal.current.visible = s > 0.01;
      seal.current.scale.setScalar(Math.max(s, 0.0001));
    }
    if (crystal.current) {
      crystal.current.rotation.y = idle * t * 0.6;
      crystal.current.rotation.x = idle * t * 0.3;
    }
    if (ring.current) ring.current.rotation.z = idle * t * 0.3;

    const sh = easeOut(splitEff);
    for (const [g, dir] of [
      [sheetL.current, -1],
      [sheetR.current, 1],
    ] as const) {
      if (!g) continue;
      g.visible = sh > 0.01;
      g.scale.setScalar(Math.max(sh * 0.82, 0.0001));
      g.rotation.z = -dir * 0.18 + idle * Math.sin(t * 1.1 + dir) * 0.03;
      g.rotation.y = dir * 0.3;
    }
  });

  return (
    <group ref={root}>
      {/* static mount */}
      <mesh material={mats.frame} position={[0, 0, -0.16]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[R + 0.72, R + 0.72, 0.1, 96]} />
      </mesh>
      <mesh material={mats.frame}>
        <torusGeometry args={[R + 0.2, 0.22, 32, 128]} />
      </mesh>
      <mesh material={mats.brass} position={[0, 0, 0.1]}>
        <torusGeometry args={[R + 0.44, 0.035, 12, 128]} />
      </mesh>

      {/* the cavity behind the door */}
      <mesh material={mats.cavity} position={[0, 0, -0.55]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[R - 0.03, R - 0.03, 1.0, 48, 1, true]} />
      </mesh>
      <mesh material={mats.floor} position={[0, 0, -1.06]}>
        <circleGeometry args={[R - 0.03, 48]} />
      </mesh>
      <mesh material={mats.back} position={[0, 0, -1.03]}>
        <planeGeometry args={[R * 2.1, R * 2.1]} />
      </mesh>
      <group ref={coinSpin} position={[0, 0, -0.72]}>
        <mesh material={mats.brass} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.5, 0.5, 0.09, 48]} />
        </mesh>
        <mesh material={mats.accent} position={[0, 0, 0.05]}>
          <torusGeometry args={[0.33, 0.022, 12, 48]} />
        </mesh>
      </group>
      <pointLight ref={light} position={[0, 0, -0.4]} distance={7} decay={1.6} color="#ddb04a" />

      {/* the door: pivots on its left edge when it swings open */}
      <group ref={pivot} position={[-R, 0, 0]}>
        <group position={[R, 0, 0]}>
          <DoorHalf side={-1} groupRef={left} mats={mats} setBolt={setBolt} />
          <DoorHalf side={1} groupRef={right} mats={mats} setBolt={setBolt} />

          <group ref={wheel} position={[0, 0, T / 2 + 0.12]}>
            <mesh material={mats.brass} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.3, 0.3, 0.22, 32]} />
            </mesh>
            <mesh material={mats.accent} position={[0, 0, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.12, 0.12, 0.04, 24]} />
            </mesh>
            {[0, 1, 2].map((k) => (
              <mesh key={k} material={mats.brass} rotation={[0, 0, (k * Math.PI) / 3]}>
                <boxGeometry args={[1.5, 0.09, 0.07]} />
              </mesh>
            ))}
            {Array.from({ length: 6 }).map((_, k) => {
              const a = (k * Math.PI) / 3;
              return (
                <mesh key={k} material={mats.brass} position={[Math.cos(a) * 0.75, Math.sin(a) * 0.75, 0]}>
                  <sphereGeometry args={[0.11, 20, 20]} />
                </mesh>
              );
            })}
            <mesh material={mats.brass}>
              <torusGeometry args={[0.75, 0.03, 12, 64]} />
            </mesh>
          </group>
        </group>
      </group>

      {/* coins that leave the vault */}
      {coinEnds.map((_, i) => (
        <group
          key={i}
          ref={(el) => {
            flying.current[i] = el;
          }}
          visible={false}
        >
          <mesh material={mats.brass} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.17, 0.17, 0.045, 28]} />
          </mesh>
        </group>
      ))}

      {/* the verdict seal: a crystal wrapped in a ring of hash ticks */}
      <group ref={seal} position={[0, 0, 1.3]} visible={false}>
        <mesh ref={crystal} material={mats.crystal}>
          <octahedronGeometry args={[0.55, 0]} />
        </mesh>
        <group ref={ring}>
          {Array.from({ length: TICKS }).map((_, i) => {
            const a = (i / TICKS) * Math.PI * 2;
            const h = i % 4 === 0 ? 0.24 : 0.14;
            return (
              <mesh
                key={i}
                material={mats.tick}
                position={[Math.cos(a) * 1.0, Math.sin(a) * 1.0, 0]}
                rotation={[0, 0, a + Math.PI / 2]}
              >
                <boxGeometry args={[0.045, h, 0.03]} />
              </mesh>
            );
          })}
        </group>
      </group>

      {/* both parties' filings, held up when the door splits */}
      <Sheet groupRef={sheetL} mats={mats} position={[-1.6, 1.2, 1.55]} />
      <Sheet groupRef={sheetR} mats={mats} position={[1.6, 1.2, 1.55]} />

      <sprite material={mats.halo} scale={[5.6, 5.6, 1]} position={[0, 0, -2.4]} />
    </group>
  );
}

/** Tells the wrapper when the scene is lit, framed and has drawn a few frames. */
function Ready({ onReady }: { onReady?: () => void }) {
  const frames = useRef(0);
  useFrame(() => {
    if (frames.current >= 4) return;
    frames.current += 1;
    if (frames.current === 4) onReady?.();
  });
  return null;
}

export default function VaultCanvas({
  stage,
  active,
  onReady,
}: {
  stage: number;
  active: boolean;
  onReady?: () => void;
}) {
  const reduce = useReducedMotion();

  return (
    <Canvas
      frameloop={active ? "always" : "never"}
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 9.4], fov: 32, near: 0.1, far: 60 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ touchAction: "pan-y" }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 1.15;
      }}
    >
      <Env />
      <Fit />
      <Ready onReady={onReady} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[3, 4, 6]} intensity={1.7} color="#fff3dc" />
      <directionalLight position={[-4, -1, 3]} intensity={0.9} color="#7fb6c9" />
      <Vault stage={stage} reduce={reduce} />
    </Canvas>
  );
}
