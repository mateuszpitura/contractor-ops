---
title: Compliance dashboard
type: domain
tags: [compliance, renewals, payments]
source_commit: cbcf8a2bb
verify_with:
  - packages/api/src/routers/compliance/compliance-admin.ts
  - packages/api/src/services/compliance-payment-gate.ts
updated: 2026-07-05
---

# Compliance dashboard

## Purpose

Admin compliance KPIs, at-risk contractors, upcoming renewals, blocked payments, manual overrides, upload approve/reject with audit trail.

## Entry points

| Piece | Path |
|-------|------|
| Router | `complianceAdmin` — `routers/compliance/compliance-admin.ts` |
| Payment gate | `services/compliance-payment-gate.ts` |
| Policy | `packages/compliance-policy/` |
| UI | `apps/web-vite/src/components/compliance/dashboard/` |

## Invariants

- Gate uses `@contractor-ops/compliance-policy` — not ad-hoc checks in payment router
- Always mounted (not flag-gated unlike classification)
- `approveUploadReplacement` / `rejectUploadReplacement` enqueue the contractor-outcome notice (`compliance.upload.approved` / `.rejected`) into the transactional outbox **inside** the approve/reject `$transaction` ([[patterns/transactional-outbox]]) — atomic with the item/document flip, delivered exactly-once by the drain (dedupKey = reviewed documentId). A provider outage can't roll back the approval because the send is deferred to the drain.

## Related

- [[invoice-to-payment]]
- [[payments-and-bank-files]]
- [[classification-ir35]]

## Verify live

```bash
semble search "complianceAdmin"
semble search "compliance-payment-gate"
```

## Agent mistakes

- Duplicating eligibility rules outside compliance-policy package
