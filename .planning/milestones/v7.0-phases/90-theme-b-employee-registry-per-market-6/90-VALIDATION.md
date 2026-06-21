---
phase: 90
slug: theme-b-employee-registry-per-market-6
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-21
---

# Phase 90 — Validation Strategy

> Per-phase validation contract. Validators are checksum-of-record — every greenfield validator gets a canonical-test-vector unit test. Execution is gated on Phase 89.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (turbo-orchestrated) |
| **Config file** | per-package `vitest.config.ts` (`packages/validators`, `packages/api`, `packages/db`, `packages/web-vite`) |
| **Quick run command** | `pnpm --filter @contractor-ops/<pkg> test -- <path>` (scoped) |
| **Full suite command** | `pnpm test --filter @contractor-ops/validators --filter @contractor-ops/api --filter @contractor-ops/db` |
| **Estimated runtime** | ~30–90s scoped |

> Each greenfield statutory validator (PESEL, Steuer-IdNr, NI, tax-code, Iqama, Emirates-ID, GOSI, W-4, state-withholding) has a unit test with canonical valid + invalid test vectors. Web-vite registration form runs check:web-vite-data-layer.

---

## Sampling Rate

- **After every task commit:** scoped quick command for the touched package.
- **After the schema task:** EmployeeProfile cross-org leak test + the encrypted-PII round-trip test.
- **Before `/gsd:verify-work`:** validators + api + db + web-vite-data-layer green; PII reveal RBAC + audit test green.
- **Max feedback latency:** ~90 seconds (scoped).

---

## Per-Task Verification Map

> Planner fills from PLAN.md task IDs. Anchor rows (from RESEARCH Validation Architecture):

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-----------|--------|
| 90-0X-XX | 0X | 0 | all EMP-REG | — | Wave-0 RED scaffolds | unit | scoped | ❌ W0 | ⬜ pending |
| 90-0X-XX | 0X | N | EMP-REG-PL | — | PESEL mod-11 + embedded-DOB cross-check (test vectors); ZUS/NFZ/urząd reference-list pickers | unit | `pnpm --filter @contractor-ops/validators test -- pesel` | ❌ W0 | ⬜ pending |
| 90-0X-XX | 0X | N | EMP-REG-DE | — | Steuer-IdNr via mod11_10CheckDigit (ISO 7064, reuse — not naive); Lohnsteuerklasse enum; ELStAM stub hook | unit | scoped | ❌ W0 | ⬜ pending |
| 90-0X-XX | 0X | N | EMP-REG-UK | — | NI format + DWP exclusion ranges; tax-code 1257L + emergency/W1/M1/K flags; student-loan plan | unit | `pnpm --filter @contractor-ops/validators test -- ni-number tax-code` | ❌ W0 | ⬜ pending |
| 90-0X-XX | 0X | N | EMP-REG-US | — | W-4 step-1c enum; 10-state withholding + free-text fallback; SSN reuse P84 | unit | scoped | ❌ W0 | ⬜ pending |
| 90-0X-XX | 0X | N | EMP-REG-AE | — | Emirates ID format-strict + checksum-ADVISORY (never hard-block); visa enum + OTHER; WPS Establishment ID | unit | scoped | ❌ W0 | ⬜ pending |
| 90-0X-XX | 0X | N | EMP-REG-SA | — | Iqama/National ID Luhn; GOSI lenient + adviser-verify; Saudization = reuse NitaqatBand enum | unit | scoped | ❌ W0 | ⬜ pending |
| 90-0X-XX | 0X | N | all EMP-REG | — | EmployeeProfile tenant-owning; NOT in globalModels; cross-org leak test | unit | `pnpm --filter @contractor-ops/db test -- employee-profile-cross-org` | ❌ W0 | ⬜ pending |
| 90-0X-XX | 0X | N | EMP-REG-PL/US/AE/SA | — | national-ID PII (PESEL/SSN/Iqama/Emirates-ID) encrypted + last4 + masked; employeePii:read reveal + audit; full value never logged/in JSON | unit | `pnpm --filter @contractor-ops/api test -- employee-pii-reveal` | ❌ W0 | ⬜ pending |
| 90-0X-XX | 0X | N | all EMP-REG | — | per-market registration form dispatches by countryCode; loading/empty/error; PII masked-reveal; i18n parity | unit | `pnpm check:web-vite-data-layer && pnpm --filter @contractor-ops/web-vite test -- employee-compliance` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] RED scaffolds for: each greenfield validator (with canonical test vectors), the EmployeeProfile schema + cross-org leak, the encrypted-PII round-trip + reveal RBAC/audit, the per-market form dispatch.
- [ ] Reference-list seed fixtures (ZUS/NFZ oddział, urząd skarbowy, Krankenkasse) — versioned + date-stamped + adviser-verify-flagged (mirror bacs-modulus-tables.ts).
- [ ] Cross-phase note: EmployeeProfile FK + employee resource + module.workforce-employees come from P89 — assert against P89's delivered surface; if P89 not landed, the schema/router tasks HOLD.
- [ ] Existing vitest infrastructure covers the rest.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| P89 dependency (Employee table + employee resource + flag) | all EMP-REG | EmployeeProfile attaches to P89's Employee | Confirm P89 executed before P90's schema/router tasks run; else HOLD |
| Emirates-ID checksum | EMP-REG-AE | No official checksum spec | Format-strict + advisory only; adviser-verify the rule |
| GOSI / WPS Establishment ID formats | EMP-REG-AE/SA | No authoritative public spec | Lenient validation + adviser-verify annotation |
| Reference-list completeness + statutory rules | all EMP-REG | local-only / legal-deferred | Seed lists date-stamped + adviser-verify; not a code gate |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (validators, cross-org leak, PII reveal, reference fixtures)
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
