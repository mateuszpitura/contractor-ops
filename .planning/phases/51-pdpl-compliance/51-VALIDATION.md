---
phase: 51
slug: pdpl-compliance
status: partial
nyquist_compliant: false
wave_0_complete: true
created: 2026-04-11
updated: 2026-04-12
---

# Phase 51 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `packages/api/vitest.config.ts`, `apps/web/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @contractor-ops/api test -- --run` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @contractor-ops/api test -- --run`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 51-01-01 | 01 | 1 | PDPL-01 | T-51-01 | Privacy notice matches org jurisdiction | unit | `pnpm --filter @contractor-ops/api test -- --run -t "privacy-notice"` | ✅ | ✅ green |
| 51-01-02 | 01 | 1 | PDPL-02 | T-51-02 | ConsentRecord created on grant, append-only on revoke | unit | `pnpm --filter @contractor-ops/api test -- --run -t "consent-record"` | ✅ | ✅ green |
| 51-02-01 | 02 | 1 | PDPL-02 | T-51-03 | Only authorized users can manage consent | integration | `pnpm --filter @contractor-ops/api test -- --run -t "consentRouter"` | ✅ | ⚠️ external blocker |
| 51-03-01 | 03 | 2 | PDPL-03 | T-51-04 | DPA PDF contains correct org data | unit | `pnpm --filter @contractor-ops/api test -- --run -t "legal-document"` | ✅ | ✅ green |
| 51-03-02 | 03 | 2 | PDPL-04 | T-51-05 | SCC generated only for cross-border orgs | unit | `pnpm --filter @contractor-ops/api test -- --run -t "legal-document"` | ✅ | ✅ green |
| 51-04-01 | 04 | 2 | PDPL-01 | — | Blocking consent step prevents org setup | component | `pnpm --filter web test -- --run src/components/consent/__tests__/onboarding-consent-step.test.tsx` | ✅ | ✅ green |
| 51-04-03 | 04 | 2 | PDPL-01–04 | — | Settings Privacy tab consent management | component | `pnpm --filter web test -- --run src/components/consent/__tests__/consent-management-section.test.tsx` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky/blocker*

---

## Wave 0 Requirements

- [x] `packages/api/src/services/__tests__/privacy-notice.test.ts` — 4 tests, green
- [x] `packages/api/src/services/__tests__/consent-record.test.ts` — 13 tests, green
- [x] `packages/api/src/routers/__tests__/consent.test.ts` — 10 tests, blocked by peppol.ts import error
- [x] `packages/api/src/services/__tests__/legal-document-generation.test.ts` — 10 tests, green
- [x] `apps/web/src/components/consent/__tests__/onboarding-consent-step.test.tsx` — 9 tests, green
- [x] `apps/web/src/components/consent/__tests__/consent-management-section.test.tsx` — 10 tests, green

*Existing vitest infrastructure covers framework setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Privacy notice content is legally accurate | PDPL-01 | Legal review required | Review generated notice text against UAE/Saudi PDPL articles |
| DPA template matches jurisdiction requirements | PDPL-03 | Legal review required | Compare DPA content with standard DPA clauses |

---

## External Blockers

| Task ID | Test File | Blocker | Detail |
|---------|-----------|---------|--------|
| 51-02-01 | `packages/api/src/routers/__tests__/consent.test.ts` | peppol.ts import error | `TypeError: Cannot use 'in' operator to search for '~standard' in undefined` at `peppol.ts:325` via `root.ts:29`. Pre-existing issue — `getTransmissionByInvoiceIdSchema` is undefined at import time. Not a Phase 51 issue. |

---

## Validation Audit 2026-04-12

| Metric | Count |
|--------|-------|
| Gaps found | 3 |
| Resolved | 2 |
| Escalated | 1 (external blocker) |
| Tests created | 19 (9 + 10) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [x] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter (blocked by external blocker)

**Approval:** partial — 6/7 tasks verified, 1 externally blocked (consent router test blocked by peppol.ts)
