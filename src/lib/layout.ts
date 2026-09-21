import type { Workstream } from "./mission";

export const SWARM_COUNT = 10;
export const AGENT_COUNT = 300;

export type Vec3 = [number, number, number];

export type AgentLayout = {
  id: number;
  swarm: number;
  local: number;
  position: Vec3;
};

const TAU = Math.PI * 2;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SWARM_CENTERS: Vec3[] = Array.from({ length: SWARM_COUNT }, (_, i) => {
  const a = (i / SWARM_COUNT) * TAU + 0.18;
  const y = Math.sin(i * 1.37) * 1.55;
  const r = 8.35 + Math.cos(i * 0.9) * 0.35;
  return [Math.cos(a) * r, y, Math.sin(a) * r];
});

export const AGENTS: AgentLayout[] = (() => {
  const rand = mulberry32(42);
  const out: AgentLayout[] = [];
  let id = 0;
  for (let s = 0; s < SWARM_COUNT; s++) {
    const [cx, cy, cz] = SWARM_CENTERS[s]!;
    for (let k = 0; k < 30; k++) {
      const u = rand();
      const v = rand();
      const w = rand();
      const theta = u * TAU;
      const phi = Math.acos(2 * v - 1);
      const rad = 0.35 + w * 1.35;
      out.push({
        id,
        swarm: s,
        local: k,
        position: [
          cx + Math.sin(phi) * Math.cos(theta) * rad,
          cy + Math.cos(phi) * rad * 0.72,
          cz + Math.sin(phi) * Math.sin(theta) * rad,
        ],
      });
      id += 1;
    }
  }
  return out;
})();

export type HaloNode = { position: Vec3; ring: number };

export const HALO: HaloNode[] = (() => {
  const rings = [
    { r: 2.15, n: 22, y: 0.05 },
    { r: 3.25, n: 34, y: -0.08 },
    { r: 4.45, n: 48, y: 0.12 },
  ];
  const out: HaloNode[] = [];
  rings.forEach((ring, ri) => {
    for (let i = 0; i < ring.n; i++) {
      const a = (i / ring.n) * TAU + ri * 0.2;
      out.push({
        ring: ri,
        position: [Math.cos(a) * ring.r, ring.y + Math.sin(a * 3) * 0.12, Math.sin(a) * ring.r],
      });
    }
  });
  return out;
})();

export function swarmLabel(workstreams: Workstream[] | undefined, index: number) {
  const ws = workstreams?.[index];
  return {
    id: ws?.id ?? `WS-${String(index + 1).padStart(2, "0")}`,
    name: ws?.name ?? "SWARM",
    agents: ws?.agents ?? 30,
  };
}

export const GOLD = 0xf0b14a;
export const GOLD_2 = 0xffd78a;
export const TEAL = 0x5eead4;
export const TEAL_DIM = 0x2a6f68;
export const FAIL = 0xff5c5c;
