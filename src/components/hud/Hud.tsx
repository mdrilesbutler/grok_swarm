import { useMemo, type ReactNode } from "react";
import { PRESETS, PHASE_COPY, type Phase } from "@/lib/mission";
import { AGENTS } from "@/lib/layout";
import { useMission } from "@/lib/store";
import { cn } from "@/lib/utils";

function Corner({ className }: { className?: string }) {
  return <span className={cn("pointer-events-none absolute h-2.5 w-2.5 border-fg/55", className)} />;
}

function Frame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative border border-line bg-panel px-3 py-2.5", className)}>
      <Corner className="left-0 top-0 border-l border-t" />
      <Corner className="right-0 top-0 border-r border-t" />
      <Corner className="bottom-0 left-0 border-b border-l" />
      <Corner className="bottom-0 right-0 border-b border-r" />
      {children}
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="min-w-0">
      <div className="hud-label text-[9px] text-muted">{k}</div>
      <div className="hud-mono text-sm text-fg tabular-nums">{v}</div>
    </div>
  );
}

function PhaseTitle({ phase }: { phase: Phase }) {
  const copy = PHASE_COPY[phase];
  const rationale = useMission((s) => s.rationale);
  if (phase === "idle") return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[16%] z-10 flex flex-col items-center px-4 text-center md:top-[14%]">
      <div key={phase} className="phase-copy max-w-xl">
        <div className="hud-label mb-2 text-[10px] text-gold/80">{copy.kicker}</div>
        <div className="hud-label text-2xl text-fg md:text-4xl">{copy.title}</div>
        {phase === "reason" && !rationale ? (
          <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-fg/70 md:text-sm">
            Astra is decomposing the goal into parallel K3 workstreams.
          </p>
        ) : rationale && (phase === "reason" || phase === "decompose") ? (
          <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-fg/70 md:text-sm">{rationale}</p>
        ) : null}
      </div>
    </div>
  );
}

function TopBar() {
  const phase = useMission((s) => s.phase);
  const activeAgents = useMission((s) => s.activeAgents);
  const plan = useMission((s) => s.plan);
  const running = useMission((s) => s.runningSwarms);
  const live = phase !== "idle";
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3 md:p-5">
      <div>
        <div className="hud-label text-xs text-fg md:text-sm">ASTRA CORE</div>
        <div className="hud-label mt-1 text-[9px] text-teal">K3 execution layer</div>
      </div>
      <div className="flex items-center gap-4 text-right">
        {live && (
          <span className="live-dot hidden items-center gap-1.5 md:inline-flex">
            <span className="inline-block size-1.5 rounded-full bg-teal" />
            <span className="hud-label text-[9px] text-teal">{running.length ? "agents live" : "live"}</span>
          </span>
        )}
        <Stat k="agents" v={live ? String(activeAgents).padStart(3, "0") : "300"} />
        <Stat k="swarms" v={plan ? String(plan.workstreams.length).padStart(2, "0") : "10"} />
        <Stat k="plan" v="1" />
      </div>
    </div>
  );
}

function SwarmBoard() {
  const phase = useMission((s) => s.phase);
  const plan = useMission((s) => s.plan);
  const running = useMission((s) => s.runningSwarms);
  const findings = useMission((s) => s.findings);
  if (!plan) return null;
  if (phase === "idle" || phase === "reason") return null;
  return (
    <Frame className="hidden w-[248px] md:block">
      <div className="hud-label mb-3 text-[10px] text-gold">Swarms</div>
      <ul className="space-y-1.5">
        {plan.workstreams.map((ws, i) => {
          const found = findings.find((f) => f.index === i);
          const isRun = running.includes(i);
          const status = found ? `${found.findings.length} hits` : isRun ? "running" : "queued";
          return (
            <li key={ws.id} className="flex items-baseline justify-between gap-3">
              <span className="hud-mono truncate text-[10px] text-fg/85">
                {ws.id} {ws.name}
              </span>
              <span
                className={cn(
                  "hud-mono shrink-0 text-[10px] uppercase",
                  found ? "text-teal" : isRun ? "text-gold" : "text-muted",
                )}
              >
                {status}
              </span>
            </li>
          );
        })}
      </ul>
    </Frame>
  );
}

function SharedState() {
  const phase = useMission((s) => s.phase);
  const plan = useMission((s) => s.plan);
  const values = useMission((s) => s.stateValues);
  const findings = useMission((s) => s.findings);
  if (!plan) return null;
  if (phase === "idle" || phase === "reason") return null;
  const latest = findings.flatMap((f) => f.findings.map((text) => ({ id: f.id, text }))).slice(-4);
  return (
    <Frame className="hidden w-[248px] md:block">
      <div className="hud-label mb-3 text-[10px] text-gold">Shared state</div>
      <ul className="space-y-2">
        {plan.stateKeys.map((k, i) => (
          <li key={k.key} className="flex items-baseline justify-between gap-3">
            <span className="hud-label text-[9px] text-muted">{k.key}</span>
            <span className="hud-mono text-xs text-teal tabular-nums">{values[i] ?? 0}</span>
          </li>
        ))}
      </ul>
      {latest.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-line pt-2">
          {latest.map((row, i) => (
            <li key={`${row.id}-${i}`} className="text-[10px] leading-snug text-fg/75">
              <span className="hud-mono text-gold">{row.id}</span> {row.text}
            </li>
          ))}
        </ul>
      )}
    </Frame>
  );
}

function VerifyPanel() {
  const phase = useMission((s) => s.phase);
  const rows = useMission((s) => s.verifyRows);
  if (!["verify", "result"].includes(phase) || rows.length === 0) return null;
  return (
    <Frame className="hidden w-[260px] md:block">
      <div className="hud-label mb-3 text-[10px] text-gold">Verify</div>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.label}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="hud-label text-[9px] text-muted">{row.label}</span>
              <span
                className={cn(
                  "hud-mono text-[10px] uppercase",
                  row.status === "pass" && "text-teal",
                  row.status === "fail" && "text-fail",
                  row.status === "retry" && "text-gold",
                  row.status === "pending" && "text-muted",
                )}
              >
                {row.status}
              </span>
            </div>
            {row.note ? <div className="mt-0.5 text-[10px] leading-snug text-fg/60">{row.note}</div> : null}
          </li>
        ))}
      </ul>
    </Frame>
  );
}

function ResultPanel() {
  const phase = useMission((s) => s.phase);
  const title = useMission((s) => s.resultTitle);
  const stats = useMission((s) => s.resultStats);
  const report = useMission((s) => s.report);
  if (phase !== "result") return null;
  return (
    <Frame className="pointer-events-auto w-[min(100%,340px)] max-h-[42vh] overflow-y-auto">
      <div className="hud-label mb-1 text-[10px] text-gold">Result</div>
      <div className="hud-label mb-3 text-sm text-fg">{title || "SWARM DELIVERABLE"}</div>
      {stats.length > 0 && (
        <ul className="mb-3 space-y-1.5">
          {stats.map((s) => (
            <li key={s.label} className="flex items-baseline justify-between gap-3">
              <span className="hud-label text-[9px] text-muted">{s.label}</span>
              <span className="hud-mono text-xs text-teal tabular-nums">{s.value}</span>
            </li>
          ))}
        </ul>
      )}
      {report ? (
        <div className="whitespace-pre-wrap text-[11px] leading-relaxed text-fg/80">{report}</div>
      ) : null}
    </Frame>
  );
}

function LogFeed() {
  const log = useMission((s) => s.log);
  const phase = useMission((s) => s.phase);
  if (phase === "idle" || log.length === 0) return null;
  return (
    <div className="hidden max-w-md md:block">
      <div className="hud-label mb-2 text-[9px] text-muted">Agent log</div>
      <ul className="space-y-1">
        {log.slice(0, 8).map((line) => (
          <li key={`${line.id}-${line.agent}`} className="hud-mono flex gap-2 text-[10px] text-fg/80">
            <span className="shrink-0 text-gold">{line.agent}</span>
            <span className="shrink-0 text-teal">{line.tool}</span>
            <span className="truncate text-muted">{line.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SelectedCard() {
  const selected = useMission((s) => s.selected);
  const plan = useMission((s) => s.plan);
  const findings = useMission((s) => s.findings);
  const work = useMission((s) => (s.selected != null ? s.agentWork[s.selected] : undefined));
  if (selected == null) return null;
  const agent = AGENTS[selected];
  if (!agent) return null;
  const ws = plan?.workstreams[agent.swarm];
  const found = findings.find((f) => f.index === agent.swarm);
  return (
    <Frame className="pointer-events-auto w-[220px]">
      <div className="hud-mono text-xs text-gold">K3-{String(agent.id + 1).padStart(3, "0")}</div>
      <div className="hud-label mt-1 text-[10px] text-teal">{ws?.id ?? `WS-${String(agent.swarm + 1).padStart(2, "0")}`}</div>
      <div className="mt-1 text-[11px] tracking-wide text-fg/80">{ws?.name ?? "SWARM"}</div>
      <div className="mt-2 text-[11px] leading-snug text-muted">{ws?.focus ?? "Local execution"}</div>
      {work ? (
        <div className="mt-2">
          <div className="hud-mono text-[10px] text-teal">{work.tool}</div>
          <div className="mt-1 text-[11px] leading-snug text-fg/80">{work.detail}</div>
        </div>
      ) : found?.findings[0] ? (
        <div className="mt-2 text-[11px] leading-snug text-fg/80">{found.findings[0]}</div>
      ) : (
        <div className="mt-2 text-[10px] text-muted">Waiting on this swarm.</div>
      )}
    </Frame>
  );
}

function Briefing() {
  const phase = useMission((s) => s.phase);
  const input = useMission((s) => s.input);
  const setInput = useMission((s) => s.setInput);
  const launch = useMission((s) => s.launch);
  const planning = useMission((s) => s.planning);
  const error = useMission((s) => s.error);
  if (phase !== "idle") return null;

  return (
    <div className="pointer-events-auto mx-auto w-full max-w-xl px-1">
      <p className="mb-4 max-w-md text-sm leading-relaxed text-fg/70 md:text-base">
        Astra writes one plan. Ten K3 swarms actually run that plan — research, write shared state, then Astra
        verifies and merges one result.
      </p>
      {error ? <p className="mb-3 text-sm text-fail">{error}</p> : null}
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void launch(input);
        }}
      >
        <label className="sr-only" htmlFor="goal">
          Mission goal
        </label>
        <input
          id="goal"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={280}
          placeholder="Give ASTRA a goal"
          className="h-11 min-h-11 flex-1 border border-line bg-void-2 px-3 font-mono text-sm text-fg outline-none placeholder:text-muted focus:border-gold"
          suppressHydrationWarning
        />
        <button
          type="submit"
          disabled={planning || !input.trim()}
          className="h-11 min-h-11 bg-fg px-5 font-display text-xs font-semibold tracking-[0.22em] text-void uppercase transition-transform duration-150 ease-out active:scale-[0.96] disabled:opacity-40"
        >
          Launch
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.goal}
            type="button"
            onClick={() => {
              setInput(p.goal);
              void launch(p.goal);
            }}
            className="h-10 border border-line px-3 font-display text-[10px] tracking-[0.16em] text-muted uppercase transition-colors duration-150 hover:border-gold hover:text-gold"
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function BottomBar() {
  const phase = useMission((s) => s.phase);
  const goal = useMission((s) => s.goal);
  const toolCalls = useMission((s) => s.toolCalls);
  const llmCalls = useMission((s) => s.llmCalls);
  const reset = useMission((s) => s.reset);
  const launch = useMission((s) => s.launch);
  const rationale = useMission((s) => s.rationale);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-3 md:p-5">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="hud-label text-[10px] text-gold">GPT-6 ASTRA</div>
          <div className="hud-label mt-1 text-[9px] text-muted">Reasoning layer</div>
        </div>
        {phase !== "idle" && (
          <div className="flex gap-4">
            <Stat k="llm calls" v={llmCalls} />
            <Stat k="agent steps" v={toolCalls} />
          </div>
        )}
      </div>

      {phase === "idle" ? (
        <Briefing />
      ) : (
        <div className="pointer-events-auto flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="hud-label text-[9px] text-muted">Goal</div>
            <div className="truncate text-sm tracking-wide text-fg">{goal}</div>
            {rationale && phase !== "reason" ? (
              <div className="mt-1 hidden max-w-xl truncate text-[11px] text-muted md:block">{rationale}</div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {phase === "result" ? (
              <>
                <button
                  type="button"
                  onClick={() => void launch(goal)}
                  className="h-11 bg-fg px-4 font-display text-[10px] tracking-[0.2em] text-void uppercase transition-transform duration-150 active:scale-[0.96]"
                >
                  Run again
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="h-11 border border-line px-4 font-display text-[10px] tracking-[0.2em] text-muted uppercase"
                >
                  New goal
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={reset}
                className="h-11 border border-line px-4 font-display text-[10px] tracking-[0.2em] text-muted uppercase"
              >
                Abort
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function Hud() {
  const phase = useMission((s) => s.phase);
  const copy = useMemo(() => PHASE_COPY[phase], [phase]);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 text-fg">
      <div className="vignette" />
      <div className="grain" />
      <TopBar />
      <PhaseTitle phase={phase} />

      <div className="pointer-events-none absolute top-16 left-3 z-20 flex flex-col gap-3 md:top-20 md:left-5">
        <SwarmBoard />
        <SharedState />
        <SelectedCard />
      </div>
      <div
        className={cn(
          "pointer-events-none absolute top-16 right-3 z-20 flex flex-col items-end gap-3 md:top-20 md:right-5",
          phase === "result" && "max-md:top-auto max-md:bottom-32 max-md:left-3 max-md:right-3 max-md:items-stretch",
        )}
      >
        <VerifyPanel />
        {phase === "result" && <ResultPanel />}
      </div>

      <div className="pointer-events-none absolute bottom-28 left-3 hidden md:bottom-32 md:left-5 md:block">
        <LogFeed />
      </div>

      {phase === "reason" && (
        <div className="pointer-events-none absolute inset-x-0 top-[28%] text-center">
          <div className="hud-label text-[10px] text-gold">{copy.kicker}</div>
        </div>
      )}

      <BottomBar />
    </div>
  );
}
