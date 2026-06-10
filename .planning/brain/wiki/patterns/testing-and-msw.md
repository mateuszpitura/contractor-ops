---
title: Testing and MSW
type: pattern
tags: [testing, vitest, msw]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - .planning/codebase/TESTING.md
  - vitest.monorepo.ts
  - packages/test-utils/src/msw/
updated: 2026-06-09
---

# Testing and MSW

## Purpose

Vitest multi-project workspace via Turborepo. MSW fixtures in `@contractor-ops/test-utils` for API/UI tests.

## Entry points

| Piece | Path |
|-------|------|
| Root workspace | `vitest.config.ts`, `vitest.monorepo.ts` |
| MSW handlers | `packages/test-utils/src/msw/handlers/` |
| MSW fixtures | `packages/test-utils/src/msw/fixtures/` |
| web-vite project | `vitest run --project web-vite` |

## Commands

```bash
pnpm test                              # all via turbo
pnpm test --filter @contractor-ops/api # single package
pnpm typecheck                         # CI canonical
pnpm typecheck --filter=@contractor-ops/web-vite
```

## Invariants

- **Never cite failure counts from memory** — run `pnpm test`
- Turbo `test` depends on `^build` and `i18n:types`
- Live smoke: `RUN_LIVE_SMOKE=1 pnpm test:integration:smoke`

## Related

- [[web-vite-data-layer]]
- [[decisions/tech-debt-hotspots]]

## Agent mistakes

- Skipping typecheck on web-vite after large UI change
- Stale i18n generated types
