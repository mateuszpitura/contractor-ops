---
title: Wiki refresh triggers
type: meta
tags: [meta, maintenance]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - scripts/check-wiki-brain.mjs
  - CLAUDE.md
  - .claude/hooks/wiki-brain-inject.sh
updated: 2026-06-10
---

# Wiki refresh triggers

> **Binding:** `CLAUDE.md` § **Documentation follows code** + `.claude/core-values.yml` § Documentation follows code.
>
> **Principle:** wiki tracks code — every product change in `apps/` / `packages/` needs matching wiki in the **same change set**. This is **gated**: SessionStart rule block; Stop **blocks turn-end once** when code changed without wiki (then `KNOWLEDGE_REFRESH_REQUIRED` / `DOC_DRIFT_WARN`); CI `check:wiki-brain` **fails** on NEW drift (a `verify_with` source file changed without its page); `.husky/post-commit` auto-rebuilds the graphify graph on code commits.

## When to update what

| Event | Wiki / index action |
|-------|---------------------|
| **New or changed feature** (user-visible flow) | `domains/<area>.md` — Purpose, Flow, Entry points, UI surface, Invariants, Agent mistakes |
| **New hook / container / component / route** | Domain page + [[structure/web-vite-domains]]; [[patterns/web-vite-data-layer]] if layer rule touched |
| **New or changed tRPC** namespace/procedure | [[structure/api-routers-catalog]] + domain; verify `root.ts` |
| **New/moved `services/`** logic | [[structure/key-services]] + domain; update `verify_with` |
| **New `packages/*`** module or export | [[structure/packages]] + downstream domain/pattern |
| **New integration / webhook / OAuth** | `integrations/<provider>.md` + [[integrations/_index]] |
| **New cron / QStash job** | [[structure/cron-jobs]] + domain if user-facing |
| **Prisma model / migration** (product impact) | [[structure/prisma-schema-areas]] + domain |
| **New feature flag** | [[patterns/feature-flags]] + `registry.ts` |
| **New env var** (agents/operators need it) | Note in domain/pattern + `.env.example` |
| **Refactor / file moves** | Fix all wiki paths and flows — remove stale entry points |
| **Architectural discovery** | Pattern or decision page; [[decisions/tech-debt-hotspots]] if risk |
| **New invariant** (GSD, audit, bug) | `.planning/MEMORY.md` + pattern/domain bullet |
| **Call-graph / import wiring** | `graphify update` → `.planning/graphs/graph.json` |
| **Large multi-package refactor** | `map-codebase` + `.planning/intel/` + `.planning/codebase/*` |
| **Any wiki edit** | [[log]], [[hot]], BM25 ([[retrieval]]), `pnpm check:wiki-brain` |
| **`HEAD` advanced** | `source_commit` in touched frontmatter |
| **Quarterly hygiene** | `pnpm check:wiki-brain`; compare `source_commit` to `git rev-parse HEAD` |

## Exempt (wiki companion not required)

- `__tests__`, `*.test.ts`, `*.spec.ts`, `__mocks__`
- `packages/db/src/generated/`
- Lockfiles, coverage artifacts
- Pure formatting with **zero** behavior change

When unsure → **update wiki**.

## Do not refresh from

- `.planning/milestones/**` bulk ingest
- Unverified session memory
- Stale handoff test counts

## After any product code change

1. Identify affected wiki layer: domain / pattern / structure / integration
2. Edit pages (full template: [[page-template]])
3. Append [[log]]; overwrite [[hot]]
4. `pnpm check:wiki-brain`
5. Rebuild BM25 ([[retrieval]])
6. Graph / intel / MEMORY if table above applies

## Related

- [[agent-discovery]]
- `.planning/brain/README.md`
