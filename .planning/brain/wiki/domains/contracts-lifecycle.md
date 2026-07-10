---
title: Contracts lifecycle
type: domain
tags: [contracts, esign, legal]
source_commit: e0d533fa5
verify_with:
  - packages/api/src/routers/core/contract.ts
  - packages/api/src/services/contract-expiry-scan.ts
  - packages/api/src/services/esign-orchestrator.ts
updated: 2026-07-10
---

# Contracts lifecycle

## Purpose

Engagement contracts: wizard creation, amendments, status transitions, e-sign (DocuSign/Autenti), health checks, Linear/Jira links.

## Flow

```mermaid
flowchart LR
  wizard[contract wizard] --> draft[DRAFT]
  draft --> esign[esign envelope]
  esign --> active[ACTIVE]
  active --> amend[amendments / expiry]
  active --> expiring[EXPIRING cron]
  expiring --> expired[EXPIRED cron]
```

## Entry points

| Piece | Path |
|-------|------|
| Router | `contract` — `packages/api/src/routers/core/contract.ts` |
| E-sign | `esign` router + `services/esign-orchestrator.ts` |
| Health templates | `services/contract-health/` |
| Expiry scan | `services/contract-expiry-scan.ts` + `apps/cron-worker/.../contract-expiry-scan.ts` |
| UI | `apps/web-vite/src/components/contracts/` |

## Invariants

- Legal clauses from validators — not ad-hoc UI copy
- Audit on create/update/transition/delete via `auditedMutation` + `auditMutationCtx` — DB write + audit row same `$transaction` (calendar sync remains fire-and-forget after commit)
- `transitionStatus` guards writes with `updateMany({ id, status: current })` — 0 rows → `CONFLICT`
- `createAmendment` allocates `AME-n` inside the same `$transaction` as the audit row
- `updateExpiryReminders` — audit `contract.expiry_reminders.update` with old/new `reminderDaysBefore`
- **Daily `contract-expiry-scan` cron** (`runContractExpiryScan`, `0 4 * * *` UTC): fans out per `SUPPORTED_REGIONS`; `ACTIVE` with `endDate` within 30 calendar days → `EXPIRING`; `ACTIVE`/`EXPIRING` with `endDate` strictly before today → `EXPIRED`. CAS `updateMany({ id, status })` + `writeAuditLog` (`actorType: SYSTEM`, `action: STATUS_TRANSITION`) in the same `$transaction`. Open-ended contracts (`endDate` null) are untouched.

## Related

- [[contractors-engagements]]
- [[workflows-and-roles]]
- [[integrations/docusign-esign]]

## Verify live

```bash
semble search "esign-orchestrator"
semble search "contractRouter"
```

## Agent mistakes

- Letting `ACTIVE` contracts pass `endDate` without the cron — invoice matching and portal surfaces key off `status`; stale `ACTIVE` rows still match invoices
