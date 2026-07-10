---
title: Agent delegation (subagent-first)
type: pattern
tags: [patterns, agents, hooks, cavecrew]
updated: 2026-06-10
source_commit: 52e6f818f245fea0392da678f5c1092e4c67cfae
verify_with:
  - .claude/core-values.yml
  - CLAUDE.md
  - .claude/skills/cavecrew/SKILL.md
  - .claude/hooks/inject-standards-build.js
  - .claude/hooks/no-bulk-script-guard.js
  - .cursor/rules/15-delegation-subagents.mdc
---

# Agent delegation — subagent-first

> Prefer Task subagents and per-file `Edit` over ad-hoc bulk shell scripts on source files.

## Purpose

Agents default to **surgical delegation** (locate → fix → review) instead of `sed`/`awk`/`python -e` loops that corrupt imports and formatting.

## Routing (daily work)

| Task | Subagent |
|------|----------|
| Domain feature / fix / multi-layer logic | **`business-logic-shield`** first — see [[business-logic-shield]] |
| Locate symbol / callers | `cavecrew-investigator` (default); `explore` for prose |
| Fix ≤2 files | `cavecrew-builder` or main `Edit` after `Read` |
| Review diff/PR | `cavecrew-reviewer`; `bugbot` / `security-review` on request |
| Fix 3+ files | Main plan → parallel investigator/builder per file |

## GSD channel

- `/gsd:*` workflows → `gsd-*` subagents per workflow artifact (PLAN.md, phases)
- Trivial inline → `/gsd:fast`, zero Task spawn

## Forbidden

- Ad-hoc `sed -i`, `awk`, `perl -pi`, `python -c/-e`, `node -e` replace on `apps/`, `packages/`, `prisma/`, `.planning/`
- Agent helper scripts (`fix-*.ts`, `bulk-rename.sh`) unless user asks

## Allowed shell

- `pnpm` / `npm run` / `turbo` project scripts
- Read-only `git`
- Test / typecheck
- Existing repo codemods (`scripts/`, jscodeshift) with user approval

## Orchestrator rule

After spawning a subagent on a scope, **do not** read/edit that scope in parallel — wait for the result.

## Enforcement surfaces

| Surface | Mechanism |
|---------|-----------|
| Binding floor | `.claude/core-values.yml` § Delegation & surgical edits → `pnpm standards:gen` |
| Full contract | `CLAUDE.md` § Agent workflow → Delegation |
| SessionStart | `.claude/hooks/inject-standards-build.js` → `DELEGATION DEFAULT` block |
| PreToolUse advisory | `.claude/hooks/no-bulk-script-guard.js` on suspicious `Bash` |
| Cursor | `.cursor/rules/15-delegation-subagents.mdc` (alwaysApply) |
| Skill | `.claude/skills/cavecrew/SKILL.md` — chaining + anti-script |

## Agent mistakes

- Spawning one `sed` loop instead of `cavecrew-investigator` first
- Using `cavecrew-builder` on 5 files (returns `too-big.` — plan waves instead)
- Parallel main-thread edits while subagent runs on same files
- Using GSD executor for a simple “find all usages” task

## Related

- [[patterns/ci-guards]]
- [[meta/agent-discovery]]
- [[meta/refresh-triggers]]
