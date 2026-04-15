---
phase: 63
slug: uk-payments-financial-features
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-15
---

# Phase 63 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | vitest.config.ts (root) + vitest.monorepo.ts |
| **Quick run command** | `pnpm vitest run --reporter=verbose` |
| **Full suite command** | `pnpm turbo test` |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run --reporter=verbose`
- **After every plan wave:** Run `pnpm turbo test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 63-01-01 | 01 | 1 | PAY-01, PAY-06, PAY-07 | -- | N/A (schema) | unit | `pnpm --filter @contractor-ops/db exec prisma validate` | yes | pending |
| 63-01-02 | 01 | 1 | PAY-01, PAY-06, PAY-07 | -- | locked phrase CI guard | unit | `pnpm --filter @contractor-ops/validators run test -- --run` | yes | pending |
| 63-02-01 | 02 | 2 | PAY-01 | transliteration | deterministic ASCII mapping | unit | `pnpm --filter @contractor-ops/shared run test -- --run ascii-transliterate` | yes | pending |
| 63-02-02 | 02 | 2 | PAY-01 | field width | BACS Std 18 fixed-width + format detection | unit | `pnpm --filter @contractor-ops/api run test -- --run payment-export` | yes | pending |
| 63-03-01 | 03 | 2 | PAY-06 | rate lookup | LPCDA statutory period rate resolution | unit | `pnpm --filter @contractor-ops/api run test -- --run late-payment-interest` | yes | pending |
| 63-03-02 | 03 | 2 | PAY-06 | -- | BoE poller idempotent upsert | integration | `grep -c 'pollBoeBaseRate' packages/integrations/src/services/boe-base-rate-poller.ts && grep -c 'CRON_SECRET' apps/web/src/app/api/cron/boe-rate-poll/route.ts` | no | pending |
| 63-04-01 | 04 | 3 | PAY-01 | auth | BACS router admin-gated procedures | grep | `grep -c 'previewExport\|generateExport\|validateSortCode\|saveSubmitterConfig' packages/api/src/routers/bacs.ts` | no | pending |
| 63-04-02 | 04 | 3 | PAY-01 | -- | BACS settings + preview UI | file-exists | `ls apps/web/src/app/*/\(dashboard\)/settings/payments/page.tsx apps/web/src/components/payments/bacs/bacs-preview-card.tsx` | no | pending |
| 63-05-01 | 05 | 3 | PAY-06 | auth | late-interest router + claim PDF + admin BoE rate router | grep | `grep -c 'getForInvoice\|waive\|revokeWaiver\|claim' packages/api/src/routers/late-payment-interest.ts` | no | pending |
| 63-05-02 | 05 | 3 | PAY-06 | -- | Admin BoE rate page | file-exists | `ls apps/web/src/app/admin/boe-rate/page.tsx apps/web/src/app/admin/layout.tsx` | no | pending |
| 63-06-01 | 06 | 3 | PAY-07 | discount validation | Skonto eligibility + tRPC router + payment router extensions | unit | `pnpm --filter @contractor-ops/api run test -- --run skonto` | yes | pending |
| 63-06-02 | 06 | 3 | PAY-07 | XML injection | XRechnung BG-20 Skonto extension | unit | `pnpm --filter @contractor-ops/einvoice run test -- --run generator` | yes | pending |
| 63-07-01 | 07 | 4 | PAY-06 | currency display | Late interest UI + invoice list overdue column + filter | file-exists + grep | `ls apps/web/src/components/invoices/late-interest/late-interest-card.tsx && grep -c 'overdueInterest\|overdue' apps/web/src/components/invoices/invoice-table/columns.tsx` | no | pending |
| 63-07-02 | 07 | 4 | PAY-07 | checkbox state | Skonto UI + invoice list Skonto column | file-exists + grep | `ls apps/web/src/components/invoices/skonto/skonto-banner.tsx && grep -c 'skonto\|Skonto' apps/web/src/components/invoices/invoice-table/columns.tsx` | no | pending |
| 63-07-03 | 07 | 4 | PAY-01, PAY-06, PAY-07 | -- | Human verification checkpoint | manual | Human visual verification of 9-step checklist | N/A | pending |

*Status: pending / green / red / flaky*

---

## Nyquist Continuity Check

No 3 consecutive tasks lack an `<automated>` verify command:
- 63-01-01 (automated) -> 63-01-02 (automated) -> 63-02-01 (automated) -> 63-02-02 (automated) -> 63-03-01 (automated) -> 63-03-02 (automated/grep) -> 63-04-01 (automated/grep) -> 63-04-02 (automated/ls) -> 63-05-01 (automated/grep) -> 63-05-02 (automated/ls) -> 63-06-01 (automated) -> 63-06-02 (automated) -> 63-07-01 (automated/ls+grep) -> 63-07-02 (automated/ls+grep) -> 63-07-03 (manual -- checkpoint)

Maximum consecutive manual-only: 1 (63-07-03 only). Nyquist compliant.

---

## Wave 0 Requirements

- [ ] BACS Standard 18 generator unit tests -- stubs for PAY-01
- [ ] Late payment interest calculator tests -- stubs for PAY-06
- [ ] Skonto discount calculator tests -- stubs for PAY-07
- [ ] Sort code validation tests
- [ ] ASCII transliteration tests

*Existing test infrastructure (vitest) covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| BACS file import into banking software | PAY-01 | Requires bank test environment | Generate sample file, verify field positions match spec |
| PDF rendering of Skonto terms | PAY-07 | Visual verification needed | Generate invoice PDF, check discount line items render correctly |
| Full Phase 63 UI surfaces | PAY-01, PAY-06, PAY-07 | Visual + interaction verification | 9-step checklist in Plan 07 Task 3 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 45s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
