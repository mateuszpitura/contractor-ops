---
title: Consent GDPR and PDPL
type: domain
tags: [gdpr, consent, privacy]
source_commit: e367c07fed8a84c5b504f6b0fbeb0608e2471330
verify_with:
  - packages/api/src/routers/compliance/consent.ts
  - packages/api/src/routers/compliance/gdpr.ts
updated: 2026-07-05
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
- **Org erasure reaches the employee subtree — national IDs are nulled, not just orphaned.** Employee national-person identifiers (PESEL/SSN/iqama/Emirates ID) live in `EmployeeProfile` encrypted columns reachable by no other erasure path. `requestErasure` loads every `workerType=EMPLOYEE` Worker, resolves each personnel file's **file-level** statutory window (union of hire/termination-anchored `getPersonnelSections` rules, DOCUMENT_DATE rules excluded, via `getPersonnelRetentionCutoff` — mirrors the data-purge cron's own resolution), and for every **erasable** worker nulls all `*Encrypted`/`*Last4` columns, soft-deletes the `PersonnelFile` + `PersonnelFileDocument` rows, and hard-deletes `LeaveRequest`/`LeaveLedgerEntry`/`LeaveBalance`/`EmployeeTimeRecord`. A worker still inside an active window (or an unresolvable jurisdiction) is HELD fail-closed: its identifiers survive and the citation is surfaced under `retainedUnderStatute.PersonnelFile` + a second `organization.erasure_retained_under_statute` audit row. `EwidencjaSnapshot` is DB-trigger immutable (KP §149, 10-yr retention by non-deletion) — never touched.
- **Contractor tax filings follow `retainFinancialRecords`, like invoices/payments.** When the caller keeps financial records (default) the tax subtree is retained; when they opt to erase it, `Form1042S` withholding returns are soft-deleted (never hard-deleted) and `TaxFormSubmission`/`WhtCertificate`/`TaxIdValidation`/`Form1099KTrackerState`/`IrisAck`→`IrisSubmission` are purged. `Form1099Nec` (IRS 4-year, 26 CFR 1.6001-1) is always retained-with-exemption and surfaced with its citation, superseding the flag.

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
