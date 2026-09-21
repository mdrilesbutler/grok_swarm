# ASTRA CORE — grok_swarm

Cinematic 3D agent swarm. Astra (reasoning layer) decomposes a goal into **10 K3 workstreams / 300 agents**. Swarms search in parallel, write shared state, then Astra verifies and merges one report.

This is a real job, not a timed animation: Launch runs live Grok calls (plan → pooled workstreams with web search → verify).

## Run

```bash
npm install
cp .env.example .env   # add XAI_API_KEY
npm run dev
```

Open the app, type a goal (or pick a preset), hit **Launch**. Watch swarms go `queued → running → hits`, then read the result. Click a lit agent to see what that K3 node did.

## Stack

- TanStack Start + React 19
- Three.js / React Three Fiber
- xAI Grok (`grok-4.5`) for plan, search workstreams, and merge
