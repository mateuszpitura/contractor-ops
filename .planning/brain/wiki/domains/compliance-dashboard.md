---
title: Compliance dashboard
type: domain
tags: [compliance, renewals, payments]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - packages/api/src/routers/compliance/compliance-admin.ts
  - packages/api/src/services/compliance-payment-gate.ts
updated: 2026-06-09
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
