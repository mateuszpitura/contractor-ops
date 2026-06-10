---
title: entityId and money formatting
type: pattern
tags: [validators, web-vite, lint]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - packages/validators/src/common-inputs.ts
  - apps/web-vite/src/lib/money.ts
  - pnpm lint:architecture
updated: 2026-06-09
---

# entityId and money

## Purpose

CI-enforced shared schemas for single-entity inputs and currency display in staff SPA.

## Entry points

| Piece | Path |
|-------|------|
| entityIdSchema | `packages/validators/src/common-inputs.ts` |
| entityIdsSchema (bulk) | same |
| formatMoneyAmount | `apps/web-vite/src/lib/money.ts` |
| Minor units | `@contractor-ops/shared` |

## Invariants

- **No** inline `z.object({ id: z.string() })` in routers
- **No** local `formatAmount` in components — `lint:architecture`
- **No** `@contractor-ops/db` in web-vite

## Related

- [[validators-boundaries]]
- [[web-vite-data-layer]]

## Verify live

```bash
pnpm lint:architecture
semble search "entityIdSchema"
```

## Agent mistakes

- New router using inline id schema "just once"
- Duplicating money formatting per table column
