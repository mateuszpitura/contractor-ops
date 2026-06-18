---
title: Consent GDPR and PDPL
type: domain
tags: [gdpr, consent, privacy]
source_commit: 336516f5da666c16acff84e412a3d338db8bbbb8
verify_with:
  - packages/api/src/routers/compliance/consent.ts
  - packages/api/src/routers/compliance/gdpr.ts
updated: 2026-06-17
---

# Consent, GDPR, and PDPL

## Purpose

PDPL consent management (privacy notices, per-purpose consent), GDPR Art. 17 erasure and Art. 20 portability, legal privacy notice PDFs (IDOR-safe).

## Entry points

| Namespace | Path |
|-----------|------|
| `consent` | `routers/compliance/consent.ts` |
| `gdpr` | `routers/compliance/gdpr.ts` |
| `legal` | `routers/core/legal.ts` |
| UI | `apps/web-vite/src/components/consent/`, `legal/` |
| Data purge cron | [[structure/cron-jobs]] `data-purge.ts` |

## Invariants

- Jurisdiction from session — not client override for legal PDFs
- Locked legal phrases in validators
- **Erasure is the only path that may delete audit rows.** `AuditLog` is DB-level append-only; the erasure `$transaction` calls `allowAuditPurge(tx)` (`@contractor-ops/db`) immediately before `tx.auditLog.delete*` so the gated `auditlog_delete` RLS policy permits it. No other code sets the flag. See [[patterns/audit-log]]

## Related

- [[settings-and-org-admin]]
- [[patterns/validators-boundaries]]

## Verify live

```bash
semble search "consentRouter"
semble search "gdprRouter"
```

## Agent mistakes

- Duplicating privacy notice text in UI
