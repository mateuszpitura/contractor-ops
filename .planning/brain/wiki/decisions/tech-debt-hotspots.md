---
title: Tech debt hotspots
type: decision
tags: [tech-debt, risks, concerns]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - .planning/codebase/CONCERNS.md
updated: 2026-06-09
---

# Tech debt hotspots (top 10)

> Synthesis of `.planning/codebase/CONCERNS.md` — read canonical file for full audit.

## CI / tooling

1. **web-vite typecheck in CI** — ~217k LOC SPA; verify `pnpm typecheck --filter=@contractor-ops/web-vite` on PRs.
2. **i18n:types orphan** — stale generated keys break hundreds of `t()` calls.

## Security

3. **InPost webhook fail-open** — `inpost-webhook-handler.ts:36` returns true on empty secret.
4. **Payment audit gap** — money-moving mutations missing `writeAuditLog` in payment router modules.
5. **Secrets stub** — `packages/secrets` MemoryStore; Infisical not wired for gov-API.
6. **Org bank metadata `as` cast** — payment flow needs Zod safeParse.

## Observability

7. **SPA error boundary** — `route-error-boundary.tsx` logs console only; no Sentry capture.
8. **Notification silent catch** — `notification-service.ts` empty catch on email/Teams dispatch.
9. **lint-silent-catch gaps** — integrations/einvoice/cron-worker excluded from scan roots.

## Code quality

10. **Stale security docs** — `SECURITY-AUDIT.md` references deleted `apps/web` Next surface.

## Agent rules when touching these areas

- Run filtered typecheck after `apps/web-vite/**` edits
- Payment mutations: add `writeAuditLog` + run `pnpm lint:audit-log`
- Webhooks: fail-closed when secret missing in production
- Never assume secrets/CI gates from session memory — verify workflows

## Related

- [[arch-decisions]]
- [[patterns/logging-and-errors]]
- [[integrations/infisical-secrets]]
