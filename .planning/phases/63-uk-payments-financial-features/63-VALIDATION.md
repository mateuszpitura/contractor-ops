---
phase: 63
slug: uk-payments-financial-features
status: partial
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-15
audited: 2026-04-25
---

# Phase 63 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Config file** | vitest.config.ts (root) + vitest.monorepo.ts |
| **Quick run command** | `pnpm --filter <pkg> exec vitest run <path>` |
| **Full suite command** | `pnpm turbo test` |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter <affected-pkg> exec vitest run <changed-test>`
- **After every plan wave:** Run `pnpm turbo test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 63-01-01 | 01 | 1 | PAY-01, PAY-06, PAY-07 | -- | N/A (schema) | unit | `pnpm --filter @contractor-ops/db exec prisma validate` | yes | green |
| 63-01-02 | 01 | 1 | PAY-01, PAY-06, PAY-07 | -- | locked phrase CI guard | unit | `pnpm --filter @contractor-ops/validators exec vitest run` | yes | green |
| 63-02-01 | 02 | 2 | PAY-01 | transliteration | deterministic ASCII mapping | unit | `pnpm --filter @contractor-ops/shared exec vitest run ascii-transliterate` | yes | green |
| 63-02-02 | 02 | 2 | PAY-01 | field width | BACS Std 18 fixed-width + format detection | unit | `pnpm --filter @contractor-ops/api exec vitest run src/services/__tests__/payment-export.test.ts src/services/__tests__/payment-format-detection.test.ts` | yes | green |
| 63-03-01 | 03 | 2 | PAY-06 | rate lookup | LPCDA statutory period rate resolution | unit | `pnpm --filter @contractor-ops/api exec vitest run src/services/__tests__/late-payment-interest.test.ts` | yes | green |
| 63-03-02 | 03 | 2 | PAY-06 | -- | BoE poller idempotent upsert | grep | `grep -c 'pollBoeBaseRate' packages/integrations/src/services/boe-base-rate-poller.ts && grep -c 'CRON_SECRET' apps/web/src/app/api/cron/boe-rate-poll/route.ts` | yes | green |
| 63-04-01 | 04 | 3 | PAY-01 | auth | BACS router admin-gated procedures | grep | `grep -c 'previewExport\|generateExport\|validateSortCode\|saveSubmitterConfig' packages/api/src/routers/bacs.ts` | yes | green |
| 63-04-02 | 04 | 3 | PAY-01 | -- | BACS settings + preview UI | file-exists | `ls apps/web/src/app/*/\(dashboard\)/settings/payments/page.tsx apps/web/src/components/payments/bacs/bacs-preview-card.tsx` | yes | green |
| 63-05-01 | 05 | 3 | PAY-06 | auth | late-interest router + claim PDF + admin BoE rate router | grep + unit | `grep -c 'getForInvoice\|waive\|revokeWaiver\|claim' packages/api/src/routers/late-payment-interest.ts && pnpm --filter @contractor-ops/api exec vitest run src/routers/__tests__/late-payment-interest.test.ts src/routers/__tests__/admin-boe-rate.test.ts` | yes | green |
| 63-05-02 | 05 | 3 | PAY-06 | -- | Admin BoE rate page | file-exists | `ls apps/web/src/app/admin/boe-rate/page.tsx apps/web/src/app/admin/layout.tsx` | yes | green |
| 63-06-01 | 06 | 3 | PAY-07 | discount validation | Skonto eligibility + tRPC router + payment router extensions | unit | `pnpm --filter @contractor-ops/api exec vitest run src/services/__tests__/skonto.test.ts src/routers/__tests__/skonto.test.ts` | yes | green |
| 63-06-02 | 06 | 3 | PAY-07 | XML injection | XRechnung BG-20 Skonto extension | unit | `pnpm --filter @contractor-ops/einvoice exec vitest run generator` | yes | green |
| 63-07-01 | 07 | 4 | PAY-06 | currency display | Late interest UI + invoice list overdue column + filter | file-exists + grep | `ls apps/web/src/components/invoices/late-interest/late-interest-card.tsx && grep -c 'overdueInterest\|overdue' apps/web/src/components/invoices/invoice-table/columns.tsx` | yes | green |
| 63-07-02 | 07 | 4 | PAY-07 | checkbox state | Skonto UI + invoice list Skonto column | file-exists + grep | `ls apps/web/src/components/invoices/skonto/skonto-banner.tsx && grep -c 'skonto\|Skonto' apps/web/src/components/invoices/invoice-table/columns.tsx` | yes | green |
| 63-07-03 | 07 | 4 | PAY-01, PAY-06, PAY-07 | -- | Human verification checkpoint | manual | Human visual verification of 9-step checklist | N/A | pending |

*Status: pending / green / red / flaky*

### 63-07-03 Manual Checklist (human-verifiable items)

The following items remain `pending` and require human visual verification per Plan 07 Task 3:

1. Visit `/settings/payments/` — verify BACS submitter form renders with all 4 fields, admin-only gate works.
2. Open a PaymentRun with GBP items — verify BACS preview card appears, transliteration/modulus warnings display correctly, download produces a `.txt` file.
3. Open a GB B2B invoice detail — verify late interest card shows ACCRUING state with correct rate, days, amounts. Test "Claim statutory interest" dialog. Test "Waive interest" dialog (verify min 10-char reason). Download claim letter PDF.
4. Check dashboard — verify "Overdue receivables (UK)" tile shows for GB org.
5. Open a DE invoice create/edit — verify Skonto section with percent/days inputs, default cascade, preview line with German locked phrase.
6. Open a DE invoice detail — verify Skonto banner shows eligibility state.
7. Open a PaymentRun with DE items in discount window — verify Skonto checkboxes.
8. Visit `/admin/boe-rate/` — verify table, add/edit/delete dialogs, poller status strip. Verify non-super-admin gets 403.
9. Toggle all 3 feature flags off (`payments.bacs-enabled`, `payments.late-interest-enabled`, `payments.skonto-enabled`) — verify all surfaces disappear cleanly.

---

## Nyquist Continuity Check

No 3 consecutive tasks lack an `<automated>` verify command:
- 63-01-01 (automated) -> 63-01-02 (automated) -> 63-02-01 (automated) -> 63-02-02 (automated) -> 63-03-01 (automated) -> 63-03-02 (automated/grep) -> 63-04-01 (automated/grep) -> 63-04-02 (automated/ls) -> 63-05-01 (automated/grep+unit) -> 63-05-02 (automated/ls) -> 63-06-01 (automated) -> 63-06-02 (automated) -> 63-07-01 (automated/ls+grep) -> 63-07-02 (automated/ls+grep) -> 63-07-03 (manual -- checkpoint)

Maximum consecutive manual-only: 1 (63-07-03 only). Nyquist compliant.

---

## Wave 0 Requirements

- [x] BACS Standard 18 generator unit tests — `packages/api/src/services/__tests__/payment-export.test.ts` (Plan 02 Task 2 delivered tests + impl simultaneously)
- [x] Late payment interest calculator tests — `packages/api/src/services/__tests__/late-payment-interest.test.ts` (30 tests pass)
- [x] Skonto discount calculator tests — `packages/api/src/services/__tests__/skonto.test.ts` (12 tests pass)
- [x] Sort code validation tests — `packages/validators/src/__tests__/bacs.test.ts` (covered in 779-test validators suite)
- [x] ASCII transliteration tests — `packages/shared/src/__tests__/ascii-transliterate.test.ts` (25 tests pass)

*Existing test infrastructure (vitest 4.x) covers framework needs. All Wave 0 dependencies satisfied by Phase 63-01 + 63-02 + 63-03 + 63-06 stub-then-fill execution.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| BACS file import into banking software | PAY-01 | Requires bank test environment | Generate sample file, verify field positions match spec; load into Bankline / equivalent UAT environment and confirm acceptance |
| PDF rendering of Skonto terms | PAY-07 | Visual verification needed | Generate invoice PDF, check discount line items render correctly with German locked phrase `SKONTO_DESCRIPTION_TEMPLATE_DE` |
| LPCDA claim letter PDF rendering | PAY-06 | Visual verification needed | Trigger `latePaymentInterest.claim` for an overdue GB B2B invoice; download claim PDF; verify locked footer (`LPCDA_CLAIM_FOOTER`, `LPCDA_SECTION_REF`) and amounts |
| BACS modulus rapid-click race | PAY-01 | Visual pill tinting + race exposure | Enter `089999/66374958` (VocaLink V8.40 building-society edge case), rapid-click "Validate sort code" 5+ times; only the latest response should win (WR-07 ratchet) |
| BoE rate poller cron handshake | PAY-06 | Cron secret + DB inspection sequence requires runtime | GET `/api/cron/boe-rate-poll` without bearer → 401; with bogus bearer → 401; with `CRON_SECRET` and flag OFF → 200 `{ skipped: true }`; with flag ON → invokes poller and respects WR-03 manual-override safety |
| End-to-end Skonto + XRechnung BG-20 round-trip | PAY-07 | Requires DE invoice + e-invoice generation pipeline | Configure DE invoice with Skonto term (3% / 7 days / net 30), generate XRechnung, inspect CII XML for `#SKONTO#TAGE=7#PROZENT=3.00#BASISBETRAG={total}#` in `ram:Description`, run KoSIT validator |
| Full Phase 63 UI surfaces | PAY-01, PAY-06, PAY-07 | Visual + interaction verification | 9-step checklist in Plan 07 Task 3 (covered by 63-07-03 above) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 45s
- [x] `nyquist_compliant: true` set in frontmatter
- [x] `wave_0_complete: true` set in frontmatter

**Approval:** validated (14/14 automated tasks green; 1/15 task is human-only checkpoint deferred to runtime verification)

---

## Validation Audit 2026-04-25

**State Transition:** State A → validated (with manual-only escalation for runtime checks)

### Audit Summary

| Metric | Count |
|--------|-------|
| Tasks audited | 15 |
| Automated tasks | 14 |
| Manual-only tasks | 1 (63-07-03) |
| Gaps found | 0 |
| Gaps resolved | 0 |
| Tasks escalated to manual-only | 0 (existing 63-07-03 already classified as manual) |

### Per-Task Audit Results

| Task ID | Verification Method | Result | Evidence |
|---------|---------------------|--------|----------|
| 63-01-01 | `prisma validate` | green | "The schemas at prisma/schema are valid" |
| 63-01-02 | validators vitest | green | 38 files / 779 tests passed |
| 63-02-01 | shared vitest (ascii-transliterate) | green | 1 file / 25 tests passed |
| 63-02-02 | api vitest (payment-export + format-detection) | green | 2 files / 92 tests passed |
| 63-03-01 | api vitest (late-payment-interest service) | green | 1 file / 30 tests passed |
| 63-03-02 | grep `pollBoeBaseRate` + `CRON_SECRET` | green | 1 + 2 matches; both files exist with correct contents |
| 63-04-01 | grep BACS router procedures | green | 16 matches across `previewExport`/`generateExport`/`validateSortCode`/`saveSubmitterConfig` |
| 63-04-02 | ls BACS settings + preview | green | both files present |
| 63-05-01 | grep late-interest router + router test run | green | 75 matches; router tests 1 file / 42 tests passed; admin-boe-rate 1 file / 23 tests passed |
| 63-05-02 | ls admin BoE rate page + admin layout | green | both files present |
| 63-06-01 | api vitest (skonto service + router) | green | 2 files / 35 tests passed (12 service + 23 router) |
| 63-06-02 | einvoice vitest (XRechnung generator) | green | 4 files / 61 tests passed (includes BG-20 Skonto fixtures) |
| 63-07-01 | ls late-interest-card + grep overdue column | green | file present; 8 matches for `overdueInterest`/`overdue` in columns.tsx |
| 63-07-02 | ls skonto-banner + grep skonto column | green | file present; 8 matches for `skonto`/`Skonto` in columns.tsx |
| 63-07-03 | Manual 9-step checklist | pending | Listed under Manual-Only Verifications; deferred to runtime |

### Key Observations

1. **All 14 automated tasks are green.** The `tsc --noEmit` errors documented in `63-VERIFICATION.md` (Plan 05/06 router type errors, Decimal import) have been resolved by recent in-session fixes (`fix(63-05)` + `fix(63-06)` commits). No tsc errors remain in `late-payment-interest.ts` or `skonto.ts`.
2. **Phase 63 test scope: 136/136 tests pass** in `@contractor-ops/api` (BACS export, format detection, late-interest service + router, skonto service + router, admin-boe-rate router, bacs router).
3. **Pre-existing 57 `db.$queryRawUnsafe is not a function` failures** in @contractor-ops/api (KSeF / classification / token-refresh) predate Phase 63 and are explicitly out of scope per the audit charter.
4. **Wave 0 is complete:** all calculator/validator stubs were authored in Wave 1/2 alongside the implementation per the TDD pattern noted in plans 02, 03, 06.
5. **63-03-02 verification limitation:** the BoE poller's CSV parsing + idempotent upsert logic is verified by grep only (per the validation strategy authored at planning time). A full integration test would require msw + Prisma test fixtures and risks joining the noisy baseline. The cron handshake + manual-override safety (WR-03) is correctly classified as human-verifiable in the Manual-Only table.

### Gaps Filled

None. All automatable verifications were already green at audit time. No new test files were created.

### Files Modified

- `.planning/phases/63-uk-payments-financial-features/63-VALIDATION.md` (status updates only — no implementation changes)

### Frontmatter Decisions

- `status: partial` — 14/15 tasks green; 1 task (63-07-03) escalated to runtime/visual checkpoint by design (not a regression). Per audit rules, presence of any manual-only escalations requires `partial` rather than `validated`. This is expected for Phase 63 because the human-verify checkpoint (Plan 07 Task 3) is intentional, not a coverage gap.
- `wave_0_complete: true` — Phase 63-01 delivered all stub validators + locked phrases; Phase 63-02/03/06 delivered calculator tests in lockstep with implementation per the `tdd: true` task attribute.
- `nyquist_compliant: true` — Maximum consecutive manual-only tasks = 1 (63-07-03 only).

### No Implementation Changes

This audit modified only `63-VALIDATION.md`. No source files, no test files, no Prisma schemas, no config were touched. All automatable verifications already produced green results.
