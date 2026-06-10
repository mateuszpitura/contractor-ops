---
title: Architecture decisions
type: decision
tags: [architecture, invariants]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - .planning/intel/arch-decisions.json
updated: 2026-06-09
---

# Architecture decisions (structured)

> Synthesized from `.planning/intel/arch-decisions.json`. Verify in-tree before citing.

## Authority order

1. In-tree verification (`root.ts`, `pnpm test`, `pnpm typecheck`)
2. `CLAUDE.md` + `.planning/PROJECT.md`
3. `.planning/codebase/*` (commit pinned)
4. `.planning/intel/*`
5. This wiki
6. **Discard** stale session memory, cross-repo handoffs

## Key invariants

| ID | Rule | Where |
|----|------|-------|
| tenant-from-session | Never trust client org id alone | `tenantProcedure`, `portalProcedure` |
| audit-on-sensitive-mutations | `writeAuditLog` / `writeAuditLogMany` | `audit-writer.ts`, `lint:audit-log` |
| container-hook-data-layer | tRPC only in domain hooks | `apps/web-vite/ARCHITECTURE.md` |
| merge-routers | Large domains split + merge | `init.ts` → invoice, payment, approval, portal |
| portal-router-split | Portal not in appRouter | `portal-root.ts` |
| zod-at-boundaries | Zod + entityIdSchema | `validators/common-inputs.ts` |
| feature-flags-wrapper | Registry only, no direct Unleash | `feature-flags/registry.ts` |
| payment-compliance-gate | Block runs on compliance fail | `compliance-payment-gate.ts` |
| invoice-approval-prerequisite | Matched before submit | invoice-matching → approval |
| no-console-in-apps | Pino logger | `lint:logs` |
| env-schema | `.env.example` + env.ts | `check:no-process-env` |
| supply-chain-age | 7-day minimumReleaseAge | `pnpm-workspace.yaml` |

## Procedure stacks

- Staff mutation: `public → authed → tenant → requirePermission → handler`
- Portal: `portalProcedure → handler`
- Classification: `tenant → classificationProcedure → handler` (when enabled)

## RLS

- Reads: `withRlsReads` — `SET LOCAL app.org_id`
- Transactions: `withRlsTransactions`
- Client: `createTenantClientFrom`

## Related

- [[memory-authority]]
- [[patterns/_index]]
- [[tech-debt-hotspots]]
