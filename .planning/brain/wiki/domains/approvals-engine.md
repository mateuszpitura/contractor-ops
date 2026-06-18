---
title: Approvals engine
type: domain
tags: [approvals, workflow]
source_commit: 336516f5da666c16acff84e412a3d338db8bbbb8
verify_with:
  - packages/api/src/services/approval-engine.ts
  - packages/api/src/routers/core/approval-queue.ts
updated: 2026-06-17
---

# Approvals engine

## Purpose

Configurable approval chains, queue operations (approve/reject/delegate/clarify), operators registry, and invoice submit-for-approval.

## Flow

```mermaid
flowchart TD
  submit[submitForApproval] --> chain[approval chain]
  chain --> step1[step N operators]
  step1 --> approved[APPROVED]
  step1 --> rejected[REJECTED]
```

## Entry points

| Piece | Path |
|-------|------|
| Engine | `packages/api/src/services/approval-engine.ts` |
| Operators | `services/approval-engine/operators/registry.ts` |
| Queue | `routers/core/approval-queue.ts` |
| Submit | `routers/core/approval-submit.ts` |
| UI | `apps/web-vite/src/components/approvals/` |

## Invariants

- Invoice must be matched before submit — [[invoice-to-payment]]
- Teams/Slack cards via integration framework
- `approve` / `reject` each write a same-tx `writeAuditLog` row (`approval.approve` / `approval.reject`) keyed to the flow's `resourceType` / `resourceId` — see [[patterns/audit-log]]

## Related

- [[workflows-and-roles]]
- [[invoice-to-payment]]
- [[integrations/teams]]

## Verify live

```bash
semble search "approval-engine"
semble search "submitForApproval"
```

## Agent mistakes

- Bypassing operator registry for one-off approval logic
