---
title: Validators and boundaries
type: pattern
tags: [zod, validators, security]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - packages/validators/src/common-inputs.ts
  - packages/validators/src/legal/
updated: 2026-06-09
---

# Validators and boundaries

## Purpose

Zod schemas at every boundary: tRPC inputs, forms, env, webhooks. Shared inputs in `@contractor-ops/validators`.

## Entry points

| Schema | Path |
|--------|------|
| entityIdSchema | `packages/validators/src/common-inputs.ts` |
| paginationSchema | same module |
| Domain inputs | `packages/validators/src/*.ts` |
| Public API | `packages/validators/src/public-api/` |
| Legal locked phrases | `packages/validators/src/legal/` |

## Invariants

- No bare `as` on external/webhook payloads — `safeParse`
- `entityIdSchema` for single-entity inputs — `pnpm lint:architecture`
- Legal copy: DEFERRED sign-off — do not duplicate locked phrases in UI/CMS

## Related

- [[entity-id-and-money]]
- [[trpc-procedure-stack]]
- [[decisions/tech-debt-hotspots]]

## Verify live

```bash
pnpm lint:architecture
grep entityIdSchema packages/validators/src/common-inputs.ts
```

## Agent mistakes

- Inline `z.object({ id: z.string() })` in routers
- Copy-pasting jurisdiction legal text into components
