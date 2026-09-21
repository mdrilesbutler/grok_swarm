import { createServerFn } from "@tanstack/react-start";
import {
  localPlan,
  normalizePlan,
  type MissionPlan,
  type MergeResult,
  type Workstream,
  type WorkstreamResult,
} from "./mission";

type ChatOk = { ok: true; text: string; searches: string[] };
type ChatErr = { ok: false; error: string };
type ChatResult = ChatOk | ChatErr;

function extractJson(text: string): unknown {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] ?? text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

function asStringList(raw: unknown, limit: number): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => {
      if (typeof x === "string") return x.trim();
      if (x && typeof x === "object") {
        const row = x as Record<string, unknown>;
        return String(row.name ?? row.text ?? row.title ?? "").trim();
      }
      return String(x ?? "").trim();
    })
    .filter(Boolean)
    .slice(0, limit);
}

function outputText(body: {
  output?: { type?: string; content?: { type?: string; text?: string }[] }[];
}): string {
  const chunks: string[] = [];
  for (const item of body.output ?? []) {
    if (item.type !== "message") continue;
    for (const c of item.content ?? []) {
      if (c.type === "output_text" || c.type === "text") chunks.push(c.text ?? "");
    }
  }
  return chunks.join("\n").trim();
}

function searchQueries(body: {
  output?: { type?: string; action?: { query?: string } }[];
}): string[] {
  const out: string[] = [];
  for (const item of body.output ?? []) {
    if (item.type === "web_search_call" && item.action?.query) out.push(item.action.query);
  }
  return out.slice(0, 4);
}

async function chatCompletions(opts: {
  messages: { role: "system" | "user"; content: string }[];
  max_tokens: number;
  temperature?: number;
}): Promise<ChatResult> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { ok: false, error: "AI is not available" };

  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.max_tokens,
        reasoning_effort: "low",
        response_format: { type: "json_object" },
        messages: opts.messages,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return { ok: false, error: `xAI API error ${res.status}` };
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return { ok: true, text: body.choices?.[0]?.message?.content ?? "", searches: [] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "request failed";
    return { ok: false, error: msg };
  }
}

async function agentSearch(opts: {
  messages: { role: "system" | "user"; content: string }[];
  max_tokens: number;
}): Promise<ChatResult> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { ok: false, error: "AI is not available" };

  try {
    const res = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        reasoning: { effort: "low" },
        max_output_tokens: opts.max_tokens,
        max_tool_calls: 2,
        tools: [{ type: "web_search" }],
        input: opts.messages,
      }),
      signal: AbortSignal.timeout(40000),
    });
    if (!res.ok) return { ok: false, error: `xAI API error ${res.status}` };
    const body = (await res.json()) as Parameters<typeof outputText>[0] &
      Parameters<typeof searchQueries>[0];
    const text = outputText(body);
    if (!text) return { ok: false, error: "empty agent response" };
    return { ok: true, text, searches: searchQueries(body) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "request failed";
    return { ok: false, error: msg };
  }
}

async function chat(opts: {
  messages: { role: "system" | "user"; content: string }[];
  max_tokens: number;
  temperature?: number;
  search?: boolean;
}): Promise<ChatResult> {
  if (opts.search) {
    const searched = await agentSearch(opts);
    if (searched.ok) return searched;
  }
  return chatCompletions(opts);
}

export type PlanOk = { ok: true; plan: MissionPlan };
export type PlanErr = { ok: false; error: string };

export const planMission = createServerFn({ method: "POST" })
  .validator((data: { goal: string }) => {
    const goal = String(data?.goal ?? "").trim().slice(0, 280);
    if (!goal) throw new Error("Goal is required");
    return { goal };
  })
  .handler(async ({ data }): Promise<PlanOk | PlanErr> => {
    const result = await chat({
      max_tokens: 800,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "You are ASTRA, the reasoning core above a K3 agent swarm. You do not execute. You decompose one goal into parallel workstreams and a shared-state schema. Return ONLY JSON.",
        },
        {
          role: "user",
          content: `Decompose this goal into exactly 10 parallel K3 workstreams.

Goal: ${data.goal}

JSON shape:
{
  "title": "SHORT ALL-CAPS TITLE",
  "rationale": "2 sentences: what to find, how the swarms split the work, what shared state they write.",
  "workstreams": [{"id":"WS-01","name":"2-4 WORD NAME","agents":30,"focus":"specific slice this swarm owns"}],
  "stateKeys": [{"key":"COMPANIES","target":100}]
}

Rules:
- Exactly 10 workstreams. agents must sum to 300.
- Exactly 5 stateKeys with integer targets that this job will actually fill.
- Names ALL CAPS, operational.
- Each focus must be a distinct slice so agents do not duplicate work.
- No markdown.`,
        },
      ],
    });

    if (!result.ok) return result;
    const parsed = normalizePlan(extractJson(result.text), data.goal);
    if (!parsed) {
      const fallback = localPlan(data.goal);
      fallback.rationale =
        "ASTRA returned an unstructured plan. Using a structured 10-swarm split of the same goal.";
      return { ok: true, plan: fallback };
    }
    return { ok: true, plan: parsed };
  });

function asWorkstream(raw: unknown, index: number, fallback: Workstream): Workstream {
  const row = (raw ?? {}) as Record<string, unknown>;
  return {
    id: typeof row.id === "string" ? row.id : fallback.id,
    name: typeof row.name === "string" ? row.name : fallback.name,
    agents: typeof row.agents === "number" ? row.agents : fallback.agents,
    focus: typeof row.focus === "string" ? row.focus : fallback.focus,
  };
}

function normalizeWorkstreamResult(
  raw: unknown,
  index: number,
  ws: Workstream,
  searches: string[],
): WorkstreamResult {
  const o = (raw ?? {}) as Record<string, unknown>;
  const findings = asStringList(o.findings, 8);
  const entities = asStringList(o.entities, 16);
  const claims = (Array.isArray(o.claims) ? o.claims : [])
    .slice(0, 8)
    .map((c) => {
      const row = (c ?? {}) as Record<string, unknown>;
      return {
        text: String(row.text ?? "").trim(),
        source: String(row.source ?? "").trim() || "unspecified",
      };
    })
    .filter((c) => c.text);
  const logs = (Array.isArray(o.logs) ? o.logs : [])
    .slice(0, 10)
    .map((l, i) => {
      const row = (l ?? {}) as Record<string, unknown>;
      return {
        id: index * 20 + i,
        agent: String(row.agent ?? `K3-${String(index * 30 + i + 1).padStart(3, "0")}`),
        tool: String(row.tool ?? "reason"),
        detail: String(row.detail ?? ws.name).slice(0, 140),
      };
    });
  searches.forEach((q, i) => {
    if (logs.some((l) => l.detail.includes(q))) return;
    logs.unshift({
      id: index * 20 + 50 + i,
      agent: `K3-${String(index * 30 + 1 + i).padStart(3, "0")}`,
      tool: "web.search",
      detail: q.slice(0, 140),
    });
  });
  const countsRaw = (o.counts ?? {}) as Record<string, unknown>;
  return {
    index,
    id: ws.id,
    name: ws.name,
    findings: findings.length ? findings : ["No structured findings returned."],
    entities,
    claims,
    logs:
      logs.length > 0
        ? logs.slice(0, 12)
        : [
            {
              id: index * 20,
              agent: `K3-${String(index * 30 + 1).padStart(3, "0")}`,
              tool: "swarm.run",
              detail: ws.focus,
            },
          ],
    counts: {
      entities: typeof countsRaw.entities === "number" ? countsRaw.entities : entities.length,
      sources: typeof countsRaw.sources === "number" ? countsRaw.sources : claims.length,
      claims: typeof countsRaw.claims === "number" ? countsRaw.claims : claims.length,
      edges: typeof countsRaw.edges === "number" ? countsRaw.edges : Math.max(0, entities.length - 1),
    },
  };
}

export const runWorkstream = createServerFn({ method: "POST" })
  .validator((data: { goal: string; index: number; workstream: Workstream }) => {
    const goal = String(data?.goal ?? "").trim().slice(0, 280);
    const index = Math.max(0, Math.min(9, Number(data?.index) || 0));
    const fallback: Workstream = {
      id: `WS-${String(index + 1).padStart(2, "0")}`,
      name: "STREAM",
      agents: 30,
      focus: goal,
    };
    if (!goal) throw new Error("Goal is required");
    return { goal, index, workstream: asWorkstream(data.workstream, index, fallback) };
  })
  .handler(async ({ data }): Promise<WorkstreamResult> => {
    const { goal, index, workstream: ws } = data;
    const base = index * 30;
    const lo = String(base + 1).padStart(3, "0");
    const hi = String(base + ws.agents).padStart(3, "0");
    const result = await chat({
      max_tokens: 900,
      temperature: 0.4,
      search: true,
      messages: [
        {
          role: "system",
          content: `You are the lead of K3 swarm ${ws.id}. You command agents K3-${lo} through K3-${hi}. Search the web for current facts in YOUR slice only. Return ONLY JSON.`,
        },
        {
          role: "user",
          content: `Goal: ${goal}
Your workstream: ${ws.id} ${ws.name}
Focus: ${ws.focus}
Agents: K3-${lo} … K3-${hi}

Return JSON:
{
  "logs": [{"agent":"K3-XXX","tool":"web.search|fetch.source|extract.claim","detail":"what this agent did"}],
  "findings": ["concrete finding with a name, number, or date"],
  "entities": ["named companies or people"],
  "claims": [{"text":"checkable claim","source":"url or publisher"}],
  "counts": {"entities":0,"sources":0,"claims":0,"edges":0}
}

Rules:
- 4 to 6 findings. Specific names and numbers. No filler.
- 6 to 8 logs from DISTINCT agent ids spanning your range.
- 6 to 12 entities.
- counts must match the lists.
- Do not invent sources. If a fact is from search, put the URL in claims.`,
        },
      ],
    });

    if (!result.ok) {
      return {
        index,
        id: ws.id,
        name: ws.name,
        findings: [`Swarm ${ws.id} failed: ${result.error}`],
        entities: [],
        claims: [],
        logs: [
          {
            id: index * 20,
            agent: `K3-${lo}`,
            tool: "error",
            detail: result.error,
          },
        ],
        counts: { entities: 0, sources: 0, claims: 0, edges: 0 },
      };
    }

    return normalizeWorkstreamResult(extractJson(result.text), index, ws, result.searches);
  });

type MergeIn = {
  goal: string;
  title: string;
  findings: {
    id: string;
    name: string;
    findings: string[];
    claims: { text: string; source: string }[];
    counts: WorkstreamResult["counts"];
  }[];
};

export const mergeSwarm = createServerFn({ method: "POST" })
  .validator((data: MergeIn) => {
    const goal = String(data?.goal ?? "").trim().slice(0, 280);
    const title = String(data?.title ?? "SWARM RESULT").slice(0, 80);
    const findings = Array.isArray(data?.findings) ? data.findings.slice(0, 10) : [];
    if (!goal) throw new Error("Goal is required");
    return { goal, title, findings };
  })
  .handler(async ({ data }): Promise<MergeResult> => {
    const compact = data.findings.map((f) => ({
      id: f.id,
      name: f.name,
      findings: (f.findings ?? []).slice(0, 6),
      claims: (f.claims ?? []).slice(0, 6),
      counts: f.counts,
    }));

    const result = await chat({
      max_tokens: 1000,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are ASTRA verifying a K3 swarm. Cross-check findings, surface contradictions, and write one deliverable. Return ONLY JSON.",
        },
        {
          role: "user",
          content: `Goal: ${data.goal}
Working title: ${data.title}

Swarm outputs:
${JSON.stringify(compact)}

JSON shape:
{
  "title": "DELIVERABLE NAME",
  "report": "markdown briefing, 3-6 short sections, names and numbers from the swarm only",
  "stats": [{"label":"entities","value":"12"}],
  "checks": [{"label":"SOURCE TRACE","status":"pass|fail","note":"one line"}],
  "state": [{"key":"ENTITIES","value":12}]
}

Rules:
- 4 stats, 4-5 checks. status must be pass or fail based on the evidence.
- report must only use facts present in the swarm outputs. If coverage is thin, say so.
- state values are sums/unique counts from the outputs, not invented targets.`,
        },
      ],
    });

    const findingsN = compact.reduce((a, f) => a + f.findings.length, 0);
    const claimsN = compact.reduce((a, f) => a + f.claims.length, 0);
    const emptyStreams = compact.filter((f) =>
      f.findings.every((x) => x.startsWith("No structured") || x.startsWith("Swarm ")),
    ).length;
    const empty: MergeResult = {
      title: data.title,
      report: compact
        .map((f) => `## ${f.id} ${f.name}\n${f.findings.map((x) => `- ${x}`).join("\n")}`)
        .join("\n\n"),
      stats: [
        { label: "workstreams", value: String(compact.length) },
        { label: "findings", value: String(findingsN) },
        { label: "claims", value: String(claimsN) },
        { label: "unresolved", value: String(emptyStreams) },
      ],
      checks: [
        {
          label: "SWARM COVERAGE",
          status: compact.length >= 8 ? "pass" : "fail",
          note: `${compact.length} workstreams reported`,
        },
        {
          label: "FINDING DENSITY",
          status: findingsN >= 20 ? "pass" : "fail",
          note: `${findingsN} findings across the swarm`,
        },
        {
          label: "CLAIM TRACE",
          status: claimsN >= 8 ? "pass" : "fail",
          note: `${claimsN} sourced claims`,
        },
        {
          label: "EMPTY STREAMS",
          status: emptyStreams === 0 ? "pass" : "fail",
          note: emptyStreams ? `${emptyStreams} streams returned no structure` : "all streams structured",
        },
      ],
      state: [
        { key: "FINDINGS", value: findingsN },
        { key: "CLAIMS", value: claimsN },
      ],
    };

    if (!result.ok) {
      empty.report = `Verify failed: ${result.error}\n\n${empty.report}`;
      return empty;
    }

    const o = (extractJson(result.text) ?? {}) as Record<string, unknown>;
    const stats = (Array.isArray(o.stats) ? o.stats : empty.stats).slice(0, 4).map((s) => {
      const row = (s ?? {}) as Record<string, unknown>;
      return { label: String(row.label ?? "stat"), value: String(row.value ?? "—") };
    });
    const checks = (Array.isArray(o.checks) ? o.checks : empty.checks).slice(0, 6).map((c) => {
      const row = (c ?? {}) as Record<string, unknown>;
      const status = String(row.status ?? "pending");
      return {
        label: String(row.label ?? "CHECK").toUpperCase(),
        status: (status === "fail" ? "fail" : status === "pass" ? "pass" : "pending") as MergeResult["checks"][number]["status"],
        note: String(row.note ?? ""),
      };
    });
    const state = (Array.isArray(o.state) ? o.state : empty.state).slice(0, 6).map((k) => {
      const row = (k ?? {}) as Record<string, unknown>;
      return {
        key: String(row.key ?? "KEY").toUpperCase(),
        value: typeof row.value === "number" ? row.value : Number(row.value) || 0,
      };
    });

    return {
      title: typeof o.title === "string" ? o.title.toUpperCase() : data.title,
      report: typeof o.report === "string" && o.report.trim() ? o.report : empty.report,
      stats: stats.length ? stats : empty.stats,
      checks: checks.length ? checks : empty.checks,
      state: state.length ? state : empty.state,
    };
  });
