import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { AGENTS, GOLD, GOLD_2, HALO, SWARM_CENTERS, TEAL, TEAL_DIM, swarmLabel } from "@/lib/layout";
import { useMission } from "@/lib/store";
import type { Phase } from "@/lib/mission";

const dummy = new THREE.Object3D();
const color = new THREE.Color();
const CAM = new THREE.Vector3();
const LOOK = new THREE.Vector3(0, 0.15, 0);
const ASSIGNED = new THREE.Color(GOLD_2).lerp(new THREE.Color(TEAL_DIM), 0.55);

const DIST: Record<Phase, { d: number; e: number; spin: number }> = {
  idle: { d: 15.4, e: 0.42, spin: 0.08 },
  reason: { d: 6.8, e: 0.12, spin: 0.12 },
  decompose: { d: 13.6, e: 0.32, spin: 0.1 },
  execute: { d: 16.2, e: 0.32, spin: 0.18 },
  verify: { d: 11.6, e: 0.22, spin: 0.08 },
  result: { d: 14.2, e: 0.38, spin: 0.05 },
};

function makeGlow() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(255,230,170,1)");
  grd.addColorStop(0.22, "rgba(240,177,74,0.55)");
  grd.addColorStop(0.55, "rgba(240,177,74,0.12)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

function CameraRig() {
  const phase = useMission((s) => s.phase);
  const angle = useRef(0.55);
  const dist = useRef(15.4);
  const elev = useRef(0.42);
  const offset = useRef(0);
  const dragging = useRef(false);
  const lastX = useRef(0);
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    const el = gl.domElement;
    const down = (e: PointerEvent) => {
      dragging.current = true;
      lastX.current = e.clientX;
    };
    const move = (e: PointerEvent) => {
      if (!dragging.current) return;
      offset.current += (e.clientX - lastX.current) * 0.0045;
      lastX.current = e.clientX;
    };
    const up = () => {
      dragging.current = false;
    };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [gl]);

  useFrame((state, dt) => {
    const d = Math.min(dt, 0.05);
    const t = DIST[phase];
    const k = 1 - Math.exp(-d * 1.7);
    dist.current += (t.d - dist.current) * k;
    elev.current += (t.e - elev.current) * k;
    if (!dragging.current) angle.current += t.spin * d;
    const a = angle.current + offset.current;
    const ce = Math.cos(elev.current);
    CAM.set(Math.cos(a) * dist.current * ce, Math.sin(elev.current) * dist.current, Math.sin(a) * dist.current * ce);
    state.camera.position.copy(CAM);
    state.camera.lookAt(LOOK);
  });

  return null;
}

function Core() {
  const phase = useMission((s) => s.phase);
  const group = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Mesh>(null);
  const glowTex = useMemo(() => makeGlow(), []);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const d = Math.min(dt, 0.05);
    if (group.current) group.current.rotation.y += d * 0.12;
    if (inner.current) {
      const pulse =
        phase === "reason" || phase === "verify"
          ? 1 + Math.sin(t * 4.2) * 0.06
          : 1 + Math.sin(t * 1.8) * 0.025;
      inner.current.scale.setScalar(pulse);
    }
  });

  return (
    <group ref={group}>
      <mesh ref={inner}>
        <sphereGeometry args={[0.72, 48, 48]} />
        <meshStandardMaterial color={GOLD_2} emissive={GOLD} emissiveIntensity={3.4} roughness={0.22} metalness={0.35} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.98, 32, 32]} />
        <meshBasicMaterial color={GOLD} transparent opacity={0.1} />
      </mesh>
      <sprite scale={[5.4, 5.4, 1]}>
        <spriteMaterial map={glowTex} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <pointLight color={GOLD} intensity={8} distance={18} />
      <pointLight color={TEAL} intensity={1.6} distance={14} position={[0, 2.2, 0]} />
      <CoreRings />
    </group>
  );
}

function CoreRings() {
  const g1 = useRef<THREE.Mesh>(null);
  const g2 = useRef<THREE.Mesh>(null);
  const g3 = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05);
    if (g1.current) g1.current.rotation.z += d * 0.35;
    if (g2.current) g2.current.rotation.x += d * 0.22;
    if (g3.current) g3.current.rotation.y -= d * 0.18;
  });
  return (
    <>
      <mesh ref={g1} rotation={[Math.PI / 2.2, 0.2, 0]}>
        <torusGeometry args={[1.55, 0.012, 8, 96]} />
        <meshBasicMaterial color={GOLD_2} transparent opacity={0.85} />
      </mesh>
      <mesh ref={g2} rotation={[0.6, 0.4, 0.2]}>
        <torusGeometry args={[1.85, 0.01, 8, 96]} />
        <meshBasicMaterial color={GOLD} transparent opacity={0.55} />
      </mesh>
      <mesh ref={g3} rotation={[1.2, 0.1, 0.8]}>
        <torusGeometry args={[2.2, 0.008, 8, 80]} />
        <meshBasicMaterial color={TEAL} transparent opacity={0.35} />
      </mesh>
    </>
  );
}

function Halo() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const rot = useRef(0);

  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    HALO.forEach((node, i) => {
      dummy.position.set(...node.position);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      color.set(node.ring === 0 ? GOLD : TEAL);
      m.setColorAt(i, color);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, []);

  useFrame((_, dt) => {
    const m = mesh.current;
    if (!m) return;
    rot.current += Math.min(dt, 0.05) * 0.15;
    const phase = useMission.getState().phase;
    const show = phase === "idle" || phase === "reason" || phase === "verify" ? 1 : 0.55;
    HALO.forEach((node, i) => {
      const a = rot.current * (node.ring % 2 === 0 ? 1 : -1);
      const x = node.position[0];
      const z = node.position[2];
      dummy.position.set(
        x * Math.cos(a) - z * Math.sin(a),
        node.position[1],
        x * Math.sin(a) + z * Math.cos(a),
      );
      dummy.scale.setScalar(show);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, HALO.length]}>
      <sphereGeometry args={[0.035, 8, 8]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

const LIVE = new Uint8Array(AGENTS.length);

function Swarms() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const setSelected = useMission((s) => s.setSelected);

  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    AGENTS.forEach((agent, i) => {
      dummy.position.set(...agent.position);
      dummy.scale.setScalar(0.0001);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      color.set(TEAL);
      m.setColorAt(i, color);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, []);

  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;
    const t = state.clock.elapsedTime;
    const { phase: ph, runningSwarms, doneSwarms, selected: sel, liveAgents } = useMission.getState();
    LIVE.fill(0);
    for (let i = 0; i < liveAgents.length; i++) {
      const id = liveAgents[i]!;
      if (id >= 0 && id < LIVE.length) LIVE[id] = 1;
    }
    const appear = ph === "idle" ? 0.62 : ph === "reason" ? 0.12 : 1;

    AGENTS.forEach((agent, i) => {
      const running = runningSwarms.includes(agent.swarm);
      const done = doneSwarms.includes(agent.swarm);
      const reported = LIVE[i] === 1;
      let scale = 0.55 * appear;
      if (ph === "idle") {
        scale = 0.62 + Math.sin(t * 0.6 + i * 0.04) * 0.04;
      } else if (reported && running) {
        scale = 1.25 + Math.abs(Math.sin(t * 4.4 + i * 0.2)) * 0.35;
      } else if (reported) {
        scale = 1.05 + Math.sin(t * 1.6 + i * 0.1) * 0.06;
      } else if (running) {
        scale = 0.7 + Math.sin(t * 1.8 + agent.swarm) * 0.08;
      } else if (done) {
        scale = 0.78;
      }
      dummy.position.set(
        agent.position[0],
        agent.position[1] + (reported ? Math.sin(t * 1.1 + i * 0.07) * 0.06 : 0),
        agent.position[2],
      );
      dummy.scale.setScalar(Math.max(0.0001, scale));
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);

      if (sel === i) color.set(GOLD_2);
      else if (reported && running) color.set(GOLD);
      else if (reported) color.set(TEAL);
      else if (running) color.copy(ASSIGNED);
      else color.set(TEAL_DIM);
      m.setColorAt(i, color);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, AGENTS.length]}
      onClick={(e) => {
        e.stopPropagation();
        setSelected(e.instanceId ?? null);
      }}
    >
      <sphereGeometry args={[0.075, 8, 8]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

function Links() {
  const geo = useMemo(() => {
    const positions = new Float32Array(SWARM_CENTERS.length * 6);
    SWARM_CENTERS.forEach((c, i) => {
      const o = i * 6;
      positions[o] = 0;
      positions[o + 1] = 0;
      positions[o + 2] = 0;
      positions[o + 3] = c[0];
      positions[o + 4] = c[1];
      positions[o + 5] = c[2];
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, []);
  const mat = useRef<THREE.LineBasicMaterial>(null);
  useFrame((state) => {
    if (!mat.current) return;
    const running = useMission.getState().runningSwarms.length;
    const base = running > 0 ? 0.4 : 0.16;
    mat.current.opacity = base + Math.sin(state.clock.elapsedTime * 2) * 0.05;
  });
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial ref={mat} color={TEAL} transparent opacity={0.2} />
    </lineSegments>
  );
}

function Packets() {
  const COUNT = 64;
  const mesh = useRef<THREE.InstancedMesh>(null);

  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;
    const { liveAgents, runningSwarms } = useMission.getState();
    const t = state.clock.elapsedTime;
    const n = Math.min(COUNT, liveAgents.length);
    for (let i = 0; i < COUNT; i++) {
      if (i >= n) {
        dummy.scale.setScalar(0.0001);
        dummy.position.set(0, 0, 0);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
        color.set(TEAL);
        m.setColorAt(i, color);
        continue;
      }
      const agent = AGENTS[liveAgents[i]!]!;
      const u = (t * 0.32 + i * 0.09) % 1;
      dummy.position.set(agent.position[0] * (1 - u), agent.position[1] * (1 - u), agent.position[2] * (1 - u));
      dummy.scale.setScalar(runningSwarms.includes(agent.swarm) ? 1 : 0.45);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      color.set(i % 3 === 0 ? GOLD : TEAL);
      m.setColorAt(i, color);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, COUNT]}>
      <octahedronGeometry args={[0.05, 0]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

function SwarmLabels() {
  const phase = useMission((s) => s.phase);
  const plan = useMission((s) => s.plan);
  const runningSwarms = useMission((s) => s.runningSwarms);
  const doneSwarms = useMission((s) => s.doneSwarms);
  if (phase === "idle" || phase === "reason") return null;
  if (typeof window !== "undefined" && window.innerWidth < 700) return null;
  return (
    <>
      {SWARM_CENTERS.map((c, i) => {
        const info = swarmLabel(plan?.workstreams, i);
        const running = runningSwarms.includes(i);
        const done = doneSwarms.includes(i);
        const on = running || done || phase === "result" || phase === "verify" || phase === "decompose";
        const tag = running ? "LIVE" : done ? "DONE" : phase === "decompose" ? "ROUTE" : "QUEUE";
        return (
          <Html key={info.id} position={[c[0], c[1] + 1.35, c[2]]} center sprite distanceFactor={22}>
            <div className="pointer-events-none select-none whitespace-nowrap text-center" style={{ opacity: on ? 1 : 0.28 }}>
              <div className="hud-mono text-[9px] tracking-[0.22em] text-teal">
                {info.id} · {tag}
              </div>
              <div className="hud-label text-[9px] tracking-[0.18em] text-fg/85">{info.name}</div>
            </div>
          </Html>
        );
      })}
    </>
  );
}

function Dust() {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const n = 420;
    const arr = new Float32Array(n * 3);
    const rand = (s: number) => {
      const x = Math.sin(s * 127.1) * 43758.5453;
      return x - Math.floor(x);
    };
    for (let i = 0; i < n; i++) {
      arr[i * 3] = (rand(i + 1) - 0.5) * 40;
      arr[i * 3 + 1] = (rand(i + 9) - 0.5) * 24;
      arr[i * 3 + 2] = (rand(i + 17) - 0.5) * 40;
    }
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    return g;
  }, []);

  useEffect(() => () => geom.dispose(), [geom]);

  return (
    <points geometry={geom}>
      <pointsMaterial color={TEAL_DIM} size={0.035} transparent opacity={0.45} sizeAttenuation />
    </points>
  );
}

function Effects() {
  return (
    <EffectComposer>
      <Bloom luminanceThreshold={0.32} intensity={0.38} mipmapBlur luminanceSmoothing={0.3} />
      <Vignette eskil={false} offset={0.2} darkness={0.55} />
    </EffectComposer>
  );
}

export function World() {
  const setSelected = useMission((s) => s.setSelected);
  return (
    <>
      <color attach="background" args={["#040406"]} />
      <fog attach="fog" args={["#040406", 24, 52]} />
      <ambientLight intensity={0.12} />
      <CameraRig />
      <Core />
      <Halo />
      <Swarms />
      <Links />
      <Packets />
      <Dust />
      <SwarmLabels />
      <Effects />
      <mesh visible={false} onClick={() => setSelected(null)}>
        <sphereGeometry args={[80, 8, 8]} />
        <meshBasicMaterial side={THREE.BackSide} />
      </mesh>
    </>
  );
}
