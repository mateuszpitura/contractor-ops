---
title: Source STACK
type: meta
tags: [source, raw]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - .planning/brain/.raw/STACK.md
  - .planning/codebase/STACK.md
updated: 2026-06-10
---

# Raw source: STACK.md

## Purpose

Technology stack snapshot: versions, deploy targets, DB regions, auth library choices.

**Immutable copy:** `.planning/brain/.raw/STACK.md`

## Summary

pnpm 10 + Turborepo, React/Vite SPA, Fastify API, Hono public API, Prisma 7 PG17, Better Auth, Unleash OSS.

## Wiki synthesis

- [[structure/monorepo-topology]]
- [[patterns/multi-region-db]]
- [[patterns/better-auth-staff]]

## When to re-ingest

Major version bump (tRPC, Prisma, React) or new deploy service.

## Verify live

```bash
cat package.json | head -5
cat .planning/intel/stack.json 2>/dev/null | head -20
```

## Agent mistakes

- Trusting session memory for router/test counts
- Adding deps with `@latest` (7-day release age policy)
