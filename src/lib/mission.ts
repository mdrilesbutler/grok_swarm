export type Phase =
  | "idle"
  | "reason"
  | "decompose"
  | "execute"
  | "verify"
  | "result";

export type Workstream = {
  id: string;
  name: string;
  agents: number;
  focus: string;
};

export type StateKey = { key: string; target: number };

export type ResultStat = { label: string; value: string };

export type MissionPlan = {
  title: string;
  goal: string;
  rationale: string;
  workstreams: Workstream[];
  stateKeys: StateKey[];
};

export type LogLine = {
  id: number;
  agent: string;
  tool: string;
  detail: string;
};

export type VerifyStatus = "pending" | "pass" | "fail" | "retry";

export type WorkstreamResult = {
  index: number;
  id: string;
  name: string;
  findings: string[];
  entities: string[];
  claims: { text: string; source: string }[];
  logs: LogLine[];
  counts: { entities: number; sources: number; claims: number; edges: number };
};

export type MergeResult = {
  title: string;
  report: string;
  stats: ResultStat[];
  checks: { label: string; status: VerifyStatus; note: string }[];
  state: { key: string; value: number }[];
};

export type AgentWork = { tool: string; detail: string };

export const PHASE_COPY: Record<Phase, { kicker: string; title: string }> = {
  idle: { kicker: "K3 execution layer", title: "ASTRA CORE" },
  reason: { kicker: "Astra is planning", title: "ONE GOAL. ONE PLAN." },
  decompose: { kicker: "Route the work", title: "1 PLAN → 10 SWARMS" },
  execute: { kicker: "K3 swarm live", title: "PARALLEL EXECUTION" },
  verify: { kicker: "Astra checks the work", title: "VERIFY + MERGE" },
  result: { kicker: "Deliverable", title: "RESULT" },
};

export const EV_GOAL = "Build a complete market map of 100 EV companies";

export const PRESETS: { label: string; goal: string }[] = [
  { label: "100 EV companies", goal: EV_GOAL },
  {
    label: "Series A AI labs",
    goal: "Map every Series A AI lab that raised in 2026",
  },
  {
    label: "Agent orchestration tools",
    goal: "Audit 80 tools in the agent-orchestration space",
  },
];

const STREAM_NAMES = [
  "UNIVERSE",
  "SIGNALS",
  "PRODUCT LINES",
  "GEOGRAPHY",
  "COMPETITIVE SET",
  "SUPPLY CHAIN",
  "FUNDING",
  "RISK",
  "SOURCES + CLAIMS",
  "VERIFY + MERGE",
];

function splitAgents(n = 10, total = 300): number[] {
  const base = Math.floor(total / n);
  const extra = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}

function titleFromGoal(goal: string): string {
  const cleaned = goal.replace(/[^a-zA-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const words = cleaned.split(" ").filter(Boolean);
  const core = words.slice(0, 6).join(" ").toUpperCase();
  return core.length > 42 ? `${core.slice(0, 39)}…` : core || "SWARM DELIVERABLE";
}

export function agentIndexFromTag(tag: string): number | null {
  const m = /K3-(\d{1,3})/i.exec(tag);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 1 || n > 300) return null;
  return n - 1;
}

export function localPlan(goal: string): MissionPlan {
  const g = goal.trim() || EV_GOAL;
  const title = titleFromGoal(g);
  const agents = splitAgents();
  const noun =
    (g.match(/\b(\d+\s+)?([A-Za-z][A-Za-z-]{3,})\b/g) ?? ["entities"])
      .slice(-1)[0]
      ?.replace(/^\d+\s+/, "")
      .toUpperCase() ?? "ENTITIES";

  return {
    title,
    goal: g,
    rationale: `Split "${g}" across ten swarms so each owns a slice and writes into one shared graph.`,
    workstreams: STREAM_NAMES.map((name, i) => ({
      id: `WS-${String(i + 1).padStart(2, "0")}`,
      name,
      agents: agents[i] ?? 30,
      focus: `${name.toLowerCase()} for ${g}`,
    })),
    stateKeys: [
      { key: noun.slice(0, 14), target: 80 },
      { key: "SOURCES", target: 120 },
      { key: "CLAIMS", target: 280 },
      { key: "EDGES", target: 900 },
      { key: "CONTRADICTIONS", target: 6 },
    ],
  };
}

export function normalizePlan(raw: unknown, goal: string): MissionPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const workstreams = Array.isArray(o.workstreams) ? o.workstreams : [];
  if (workstreams.length < 6 || workstreams.length > 10) return null;

  const streams: Workstream[] = workstreams.map((w, i) => {
    const row = (w ?? {}) as Record<string, unknown>;
    return {
      id: typeof row.id === "string" ? row.id : `WS-${String(i + 1).padStart(2, "0")}`,
      name: typeof row.name === "string" ? row.name.toUpperCase() : STREAM_NAMES[i] ?? "STREAM",
      agents: typeof row.agents === "number" ? row.agents : 30,
      focus: typeof row.focus === "string" ? row.focus : "",
    };
  });

  while (streams.length < 10) {
    const i = streams.length;
    streams.push({
      id: `WS-${String(i + 1).padStart(2, "0")}`,
      name: STREAM_NAMES[i] ?? "STREAM",
      agents: 30,
      focus: `overflow coverage for ${goal}`,
    });
  }

  const sum = streams.reduce((a, s) => a + s.agents, 0);
  if (sum !== 300) {
    const scaled = splitAgents(streams.length);
    streams.forEach((s, i) => {
      s.agents = scaled[i] ?? 30;
    });
  }

  const stateKeys: StateKey[] = (Array.isArray(o.stateKeys) ? o.stateKeys : [])
    .slice(0, 5)
    .map((k) => {
      const row = (k ?? {}) as Record<string, unknown>;
      return {
        key: typeof row.key === "string" ? row.key.toUpperCase() : "KEY",
        target: typeof row.target === "number" ? Math.max(1, Math.round(row.target)) : 100,
      };
    });

  if (stateKeys.length < 3) return null;

  return {
    title: typeof o.title === "string" ? o.title.toUpperCase() : titleFromGoal(goal),
    goal,
    rationale: typeof o.rationale === "string" ? o.rationale : "",
    workstreams: streams.slice(0, 10),
    stateKeys,
  };
}
