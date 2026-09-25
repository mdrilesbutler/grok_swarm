# grok_swarm — AGENTS.md (the only rules file; every agent reads this)

You are one of several agents on this repo: Claude Code, Codex, Grok, Hermes, Cursor.
This file is the constitution. Chat history, Obsidian, old PRDs and other chats do NOT override it.
**Automatic, every session, without being asked:** your first actions are SESSION START, your last are SESSION END.
If Riles just says "go", "start", or "next", that means: do the NOW item.
Scripts live in `~/.claude/skills/canon/scripts/` (below: `$C`; set `C=~/.claude/skills/canon/scripts` in your shell).
Your agent name = `<tool>-<machine>`: `claude-wsl`, `codex-piclaw`, `grokbot`, `hermes-piclaw`.
Codex: run with network access on, or git/gh/claim will fail.

## SESSION START
1. `git status --porcelain` must be empty. If not, stop: tell Riles what's uncommitted. Don't carry it into new work.
2. `git switch <default branch> && git pull --ff-only`. If that fails, stop and tell Riles.
3. Read this file. Then `python3 $C/canon_state.py show` — NOW.md as it is on GitHub right now (it lives on the `canon-state` branch, never here).
4. `python3 $C/canon_state.py claim --agent <you>` → prints your session id (e.g. `claude-wsl#3f9a`); use it for release.
   Exit 2 = another session holds it: change nothing, tell Riles, stop.
5. `python3 $C/canon_check.py --repo . --repo-only`. Fix code-side issues on your branch. NOW.md issues get fixed in your release file.
6. `git switch -c agent/<you>/<short-slug>`. All code goes on this branch. Do only the item under `## NOW`.
   If something isn't in this file or NOW.md, ask Riles. Don't dig through old notes, PRDs or chats.

## SESSION END (output contract)
The status line reports THIS session. NOW.md is the NEXT session's handoff.
- Done (tests pass):
  1. `git push -u origin HEAD`, then `gh pr create --base <default branch> --title "<NOW item>" --body-file <file>` where the body is:
     **What changed** (2 lines, plain English) · **Tests** (n/n) · **Outside the NOW item** (none, or what and why) · **Preview** (link, if the repo gets preview deploys).
  2. `bash $C/canon_review.sh <pr#> <you>` — a different agent comments SAFE TO MERGE / DON'T MERGE on the PR and sets the `canon/review` check GitHub requires before merging.
  3. `NOWF=$(mktemp)`; write the new NOW.md there: STATE gains "<date> PR #n open: <item>", NOW = top item of NEXT (removed from NEXT),
     BLOCKED `none` — or `BLOCKED · <next item> · needs PR #n merged · NEED YOU: merge #n` if the next item depends on it.
     `python3 $C/canon_state.py release --agent <session id> --now-file "$NOWF"` (exit 5 = fix the file and rerun).
  4. Print: `DONE · <item> · tests <n/n> · PR #<n> · review: <first line of the review>`
- Stuck: push the branch if it has work. New NOW.md: NOW unchanged, BLOCKED = the line below. Release the same way. Print:
  `BLOCKED · <item> · <what failed> · NEED YOU: <exact action, or "none — next: <command>">`
- A paragraph, "still working", "see chat", "updated the PRD" = a leak. Not an ending.
- Can't finish properly (lint won't pass, release keeps failing)? Release anyway with the current `show` output plus one BLOCKED line describing it. Never leave the lock held.

## MERGING
Only when Riles says "merge it" / "merge #n": `gh pr merge <n> --squash --delete-branch`, then `git switch <default> && git pull --ff-only`.
Merging is what deploys. Never merge on your own judgment, never because a review said SAFE.

## WHAT THIS IS
"ASTRA CORE" — a cinematic 3D visualization of an agent swarm. Astra (a reasoning layer) decomposes a goal into
10 K3 workstreams / 300 agents; swarms run in parallel with live web search, then Astra verifies and merges one
report. This is a real job against the xAI API, not a timed animation. Done (current phase) = the app runs and
a Launch produces a real merged report end to end.

## WHAT'S LIVE
- Repo: mdrilesbutler/grok_swarm (canonical). Default branch: `main`. Deploys: none configured.
- Stack: TanStack Start + React 19, Three.js / React Three Fiber, xAI Grok (`grok-4.5`) via `src/lib/astra.ts` (server-side `process.env.XAI_API_KEY`, not client-exposed).
- No tests, no CI, no `node_modules/` installed in this checkout.
- Dev: `npm install && cp .env.example .env` (add `XAI_API_KEY`) `&& npm run dev` (port 8080).

## HOW TO WORK WITH RILES
- He does not code. Terse, decisive answers. Recommend one thing; no option menus.
- Key decisions get an explicit `[VERIFY]` and a yes before executing.
- Never cut, kill, demote, or drop scope without his yes on the specific item.
- Merge / deploy / send / spend = his explicit yes.

## HARD RULES
- State lives only in NOW.md on the `canon-state` branch, and only `canon_state.py` changes it. Never create a NOW.md on a code branch.
  Never write status into this file, a PRD, or Obsidian.
- Obsidian updates itself from GitHub (piclaw mirrors NOW.md every 2 min). Never edit the vault copy.
- Never push to the default branch yourself (GitHub and a local hook both refuse it). Never force-push. Code = branch + PR.
- Scratch notes go in `docs/notes/`. History is git.
- **Global no-llm-api-keys rule applies (`~/.claude/rules/no-llm-api-keys.md`): Michael does not want a pay-per-token
  `XAI_API_KEY` used.** This app is built around exactly that (real xAI Grok API calls on every Launch). Do not
  provision, fund, or "just test" a real `XAI_API_KEY` — ask Riles first if a live run is ever needed; running
  `npm run dev` without a key populated is fine (Launch will simply fail without one).

## LOCKED (settled — do not re-open)
- none

## KILLED (dead — never resurface; deleted from runtime, not archived)
- none

## ROADMAP
- No forward roadmap is documented past "the app runs end to end." Ask Riles before deciding what's next.

## SPEC
- No PRD exists for this repo. `README.md` — what it is, how to run, stack.
