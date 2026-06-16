---
title: Shared packages
type: structure
tags: [structure, packages]
source_commit: c89762ffe45f4cabdc59f5deeb67eefb39726530
verify_with:
  - packages/
  - .planning/codebase/STRUCTURE.md
updated: 2026-06-16
---

# Shared packages

## Purpose

`packages/*` holds domain logic, DB, auth, validators, UI primitives, and integration adapters consumed by apps.

## Entry points

| Package | Path | Role |
|---------|------|------|
| `api` | `packages/api` | tRPC routers, middleware, services, PDF templates |
| `db` | `packages/db` | Prisma 7 schema, migrations, regional + tenant clients |
| `auth` | `packages/auth` | Better Auth config |
| `validators` | `packages/validators` | Shared Zod inputs (incl. `w-form-validators.ts` — `taxFormSubmissionSchema` W-9/W-8BEN/W-8BEN-E discriminated union, no full-SSN field; see [[domains/us-tax-forms]]) |
| `ui` | `packages/ui` | shadcn + workbench `DataTable` |
| `feature-flags` | `packages/feature-flags` | Unleash wrapper + `registry.ts` |
| `compliance-policy` | `packages/compliance-policy` | Payment eligibility rules |
| `einvoice` | `packages/einvoice` | Country e-invoice profiles |
| `integrations` | `packages/integrations` | Adapter framework |
| `classification` | `packages/classification` | IR35 / Scheinselbständigkeit scoring |
| `billing` | `packages/billing` | Stripe webhook handlers |
| `logger` | `packages/logger` | Pino structured logging |
| `test-utils` | `packages/test-utils` | MSW fixtures |
| `lint-guards` | `packages/lint-guards` | Architecture CI guards |
| `shared` | `packages/shared` | Money helpers, shared types |
| `gov-api` | `packages/gov-api` | Government API schemas |

## Invariants

- No `@contractor-ops/db` imports in `apps/web-vite` — `lint:architecture`
- Feature flag keys only in `packages/feature-flags/src/registry.ts`
- Legal locked phrases in `packages/validators/src/legal/` — not duplicated in UI

## Related

- [[api-router-groups]]
- [[prisma-schema-areas]]
- [[integrations/framework-core]]
- [[patterns/validators-boundaries]]

## Verify live

```bash
pnpm typecheck --filter=@contractor-ops/api
pnpm lint:architecture
```

## Agent mistakes

- Calling Unleash SDK from apps — use `@contractor-ops/feature-flags`
- Inline `z.object({ id: z.string() })` — use `entityIdSchema`
