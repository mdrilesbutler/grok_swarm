import { create } from "zustand";
import { mergeSwarm, planMission, runWorkstream } from "./astra";
import {
  EV_GOAL,
  agentIndexFromTag,
  type AgentWork,
  type LogLine,
  type MergeResult,
  type MissionPlan,
  type Phase,
  type VerifyStatus,
  type Workstream,
  type WorkstreamResult,
} from "./mission";

export type VerifyRow = { label: string; status: VerifyStatus; note?: string };

type MissionState = {
  phase: Phase;
  goal: string;
  input: string;
  plan: MissionPlan | null;
  planning: boolean;
  error: string | null;
  runId: number;
  toolCalls: number;
  llmCalls: number;
  activeAgents: number;
  stateValues: number[];
  verifyRows: VerifyRow[];
  log: LogLine[];
  findings: WorkstreamResult[];
  runningSwarms: number[];
  doneSwarms: number[];
  liveAgents: number[];
  agentWork: Record<number, AgentWork>;
  selected: number | null;
  rationale: string;
  report: string;
  resultTitle: string;
  resultStats: { label: string; value: string }[];
  launch: (goal: string) => Promise<void>;
  reset: () => void;
  setInput: (v: string) => void;
  setSelected: (id: number | null) => void;
};

const POOL = 3;

function emptyState() {
  return {
    phase: "idle" as Phase,
    planning: false,
    error: null as string | null,
    toolCalls: 0,
    llmCalls: 0,
    activeAgents: 0,
    stateValues: [] as number[],
    verifyRows: [] as VerifyRow[],
    log: [] as LogLine[],
    findings: [] as WorkstreamResult[],
    runningSwarms: [] as number[],
    doneSwarms: [] as number[],
    liveAgents: [] as number[],
    agentWork: {} as Record<number, AgentWork>,
    selected: null as number | null,
    rationale: "",
    report: "",
    resultTitle: "",
    resultStats: [] as { label: string; value: string }[],
    plan: null as MissionPlan | null,
  };
}

function failedResult(index: number, workstream: Workstream, message: string): WorkstreamResult {
  return {
    index,
    id: workstream.id,
    name: workstream.name,
    findings: [`${workstream.id} crashed: ${message}`],
    entities: [],
    claims: [],
    logs: [
      {
        id: index * 20,
        agent: `K3-${String(index * 30 + 1).padStart(3, "0")}`,
        tool: "error",
        detail: message.slice(0, 140),
      },
    ],
    counts: { entities: 0, sources: 0, claims: 0, edges: 0 },
  };
}

function applyFinding(
  get: () => MissionState,
  set: (partial: Partial<MissionState>) => void,
  result: WorkstreamResult,
) {
  const findings = [...get().findings.filter((f) => f.index !== result.index), result].sort(
    (a, b) => a.index - b.index,
  );
  const doneSwarms = findings.map((f) => f.index);
  const runningSwarms = get().runningSwarms.filter((i) => i !== result.index);
  const log = [...result.logs, ...get().log].slice(0, 28);
  const entities = new Set(findings.flatMap((f) => f.entities));
  const sources = findings.reduce((a, f) => a + f.counts.sources, 0);
  const claims = findings.reduce((a, f) => a + f.counts.claims, 0);
  const edges = findings.reduce((a, f) => a + f.counts.edges, 0);
  const keys = get().plan?.stateKeys ?? [];
  const stateValues = keys.map((k) => {
    const name = k.key.toLowerCase();
    if (name.includes("source")) return sources;
    if (name.includes("claim")) return claims;
    if (name.includes("edge") || name.includes("relat")) return edges;
    if (name.includes("contrad")) return 0;
    return entities.size;
  });

  const agentWork = { ...get().agentWork };
  const live = new Set(get().liveAgents);
  result.logs.forEach((line, i) => {
    const mapped = agentIndexFromTag(line.agent) ?? result.index * 30 + (i % 30);
    live.add(mapped);
    agentWork[mapped] = { tool: line.tool, detail: line.detail };
  });
  result.entities.forEach((entity, i) => {
    const mapped = result.index * 30 + (i % 30);
    if (agentWork[mapped]) return;
    live.add(mapped);
    agentWork[mapped] = { tool: "extract.entity", detail: entity };
  });

  set({
    findings,
    doneSwarms,
    runningSwarms,
    log,
    stateValues,
    liveAgents: Array.from(live),
    agentWork,
    toolCalls: log.length,
    activeAgents: runningSwarms.length * 30 + live.size,
  });
}

async function runPool(
  get: () => MissionState,
  set: (partial: Partial<MissionState>) => void,
  runId: number,
  goal: string,
  workstreams: Workstream[],
) {
  let cursor = 0;
  const worker = async () => {
    while (true) {
      if (get().runId !== runId) return;
      const index = cursor++;
      if (index >= workstreams.length) return;
      const workstream = workstreams[index]!;
      const lead = `K3-${String(index * 30 + 1).padStart(3, "0")}`;
      set({
        runningSwarms: get().runningSwarms.includes(index)
          ? get().runningSwarms
          : [...get().runningSwarms, index],
        llmCalls: get().llmCalls + 1,
        activeAgents: (get().runningSwarms.length + 1) * 30 + get().liveAgents.length,
        log: [
          {
            id: 9000 + index,
            agent: lead,
            tool: "dispatch",
            detail: `${workstream.id} ${workstream.name} · ${workstream.focus}`.slice(0, 140),
          },
          ...get().log,
        ].slice(0, 28),
      });
      try {
        const result = await runWorkstream({ data: { goal, index, workstream } });
        if (get().runId !== runId) return;
        applyFinding(get, set, result);
      } catch (err) {
        if (get().runId !== runId) return;
        applyFinding(
          get,
          set,
          failedResult(index, workstream, err instanceof Error ? err.message : "unknown error"),
        );
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(POOL, workstreams.length) }, () => worker()));
}

export const useMission = create<MissionState>((set, get) => ({
  ...emptyState(),
  goal: EV_GOAL,
  input: EV_GOAL,
  runId: 0,

  setInput: (v) => set({ input: v }),
  setSelected: (id) => set({ selected: id }),

  reset: () =>
    set({
      ...emptyState(),
      runId: get().runId + 1,
      goal: get().goal,
      input: get().input,
    }),

  launch: async (goal) => {
    const g = goal.trim() || EV_GOAL;
    const runId = get().runId + 1;
    set({
      ...emptyState(),
      runId,
      phase: "reason",
      planning: true,
      goal: g,
      input: g,
      activeAgents: 8,
      llmCalls: 1,
    });

    const planned = await planMission({ data: { goal: g } });
    if (get().runId !== runId) return;

    if (!planned.ok) {
      set({
        ...emptyState(),
        runId,
        goal: g,
        input: g,
        error: planned.error,
      });
      return;
    }

    const plan = planned.plan;
    set({
      plan,
      planning: false,
      phase: "decompose",
      rationale: plan.rationale,
      llmCalls: 1,
      verifyRows: [],
      stateValues: plan.stateKeys.map(() => 0),
      activeAgents: 12,
    });

    await new Promise((r) => setTimeout(r, 700));
    if (get().runId !== runId) return;

    set({
      phase: "execute",
      runningSwarms: [],
      activeAgents: 0,
    });

    await runPool(get, set, runId, g, plan.workstreams);
    if (get().runId !== runId) return;

    const indexes = plan.workstreams.map((_, i) => i);
    set({
      phase: "verify",
      runningSwarms: [],
      activeAgents: get().liveAgents.length || 40,
      llmCalls: get().llmCalls + 1,
      verifyRows: [{ label: "MERGE", status: "pending", note: "Astra is checking swarm output" }],
    });

    const findings = get().findings;
    let merged: MergeResult;
    try {
      merged = await mergeSwarm({
        data: {
          goal: g,
          title: plan.title,
          findings: findings.map((f) => ({
            id: f.id,
            name: f.name,
            findings: f.findings,
            claims: f.claims,
            counts: f.counts,
          })),
        },
      });
    } catch (err) {
      if (get().runId !== runId) return;
      set({
        phase: "result",
        error: err instanceof Error ? err.message : "Merge failed",
        report: findings
          .map((f) => `## ${f.id} ${f.name}\n${f.findings.map((x) => `- ${x}`).join("\n")}`)
          .join("\n\n"),
        resultTitle: plan.title,
        resultStats: [{ label: "workstreams", value: String(findings.length) }],
        verifyRows: [{ label: "MERGE", status: "fail", note: "merge call failed" }],
        activeAgents: 300,
        doneSwarms: indexes,
      });
      return;
    }

    if (get().runId !== runId) return;

    const prev = get().stateValues;
    const stateValues = plan.stateKeys.map((k, i) => {
      const compact = k.key.replace(/[^A-Z0-9]/g, "");
      const hit = merged.state.find((s) => {
        const other = s.key.replace(/[^A-Z0-9]/g, "");
        return other === compact || other.includes(compact) || compact.includes(other);
      });
      return hit?.value ?? prev[i] ?? 0;
    });

    set({
      phase: "result",
      report: merged.report,
      resultTitle: merged.title,
      resultStats: merged.stats,
      verifyRows: merged.checks.map((c) => ({ label: c.label, status: c.status, note: c.note })),
      stateValues: stateValues.length ? stateValues : merged.state.map((s) => s.value),
      toolCalls: get().log.length,
      activeAgents: 300,
      runningSwarms: [],
      doneSwarms: indexes,
    });
  },
}));
