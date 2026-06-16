---
phase: 85-theme-a-w-form-intake-tax-treaty-engine
plan: 02
subsystem: tax / treaty-engine + w-form validation
status: complete
tags: [treaty-rate, reverse-charge-mirror, form-routing, w-form, zod, discriminated-union, tdd]
requires:
  - "85-01 — WithholdingTaxRate.treatyArticle column + US business_profits treaty seed rows (live)"
  - "Phase 84 — us-validators (isValidEin) + usEntityTypeEnum + ContractorType enum"
provides:
  - "resolveTreatyDecision (pure) + applyTreaty (DB) — US treaty rate/article resolution with reasoned override"
  - "determineFormType — pure W-9/W-8BEN/W-8BEN-E routing from countryCode + ContractorType"
  - "taxFormSubmissionSchema — per-form discriminated-union Zod schema (W9/W8BEN/W8BENE) + FTIN + LOB"
  - "Non-breakage regression proving US WithholdingTaxRate rows do not affect the SA-gated calculateWht path"
affects:
  - "Phase 85 Plan 03 (portal/staff routers) consumes resolveTreatyDecision/applyTreaty + taxFormSubmissionSchema + writes the override audit"
  - "Phase 85 Plan 04 (wizard) consumes determineFormType + taxFormSubmissionSchema for the RHF resolver"
  - "Phase 87 (1042-S) reuses applyTreaty + the same WithholdingTaxRate rows"
tech-stack:
  added: []
  patterns:
    - "Pure decision fn + DB-loading apply fn (mirrors reverse-charge.service resolve/apply layering)"
    - "Override precedence with required reason + auto-detected value preserved for the audit trail"
    - "Zod discriminatedUnion keyed on a literal discriminant for per-form variant validation"
    - "PII boundary: form schema carries EIN or SSN last-4 only — never a full SSN"
key-files:
  created:
    - "packages/api/src/services/treaty-rate.service.ts"
    - "packages/api/src/services/__tests__/treaty-rate.service.test.ts"
    - "packages/api/src/services/tax-form-routing.ts"
    - "packages/api/src/services/__tests__/tax-form-routing.test.ts"
    - "packages/validators/src/w-form-validators.ts"
    - "packages/validators/src/__tests__/w-form-validators.test.ts"
  modified:
    - "packages/api/src/services/__tests__/tax-rate.service.test.ts (non-breakage regression added)"
    - "packages/validators/src/index.ts (barrel export of the new schema/types)"
decisions:
  - "D-10: treaty resolution mirrors reverse-charge — pure resolveTreatyDecision + DB applyTreaty; override requires a non-empty reason and flags auditRequired (the router writes the audit)"
  - "applyTreaty resolves the auto-detected value from the table even under an override so the audit captures what was overridden (T-85-02-01) — diverges from reverse-charge which passes a constant auto value"
  - "treaty-rate.service is a PARALLEL function to calculateWht — never edits it; the SA gate keeps US rows off the WHT path (T-85-02-03)"
  - "D-09 / Pitfall 1: determineFormType routes W-9 on countryCode==='US'; the foreign W-8BEN vs W-8BEN-E split routes on the coarse Contractor.type (COMPANY -> W8BENE), NOT the fine-grained US entity type"
  - "US-FORM-01 PII: the W-9 variant carries EIN or SSN last-4 only — no full-SSN field (T-85-02-02, grep gate count 0)"
  - "TaxFormType is mirrored as a local literal union in tax-form-routing.ts to keep the function pure (no @contractor-ops/db import); the literal matches the Prisma enum and is enforced at the Plan-03 router boundary"
metrics:
  duration: "~11m"
  completed: "2026-06-16"
  tasks_completed: 3
  tasks_total: 3
  checkpoint_pending: false
---

# Phase 85 Plan 02: Treaty-Rate Engine + Form-Routing + W-Form Validators Summary

Built the three pure-then-DB resolution primitives the Plan-03 routers and Plan-04 wizard
consume: a `treaty-rate.service` that auto-detects the US treaty rate + article (mirroring
`reverse-charge.service`), defaults to the 30% statutory rate, and honors a reasoned manual
override; a pure `determineFormType` router (W-9 / W-8BEN / W-8BEN-E); and a per-form
discriminated-union Zod schema with FTIN + LOB and no full-SSN field. TDD throughout —
every behavior had a failing test first. A non-breakage regression proves the new US
`WithholdingTaxRate` rows leave the SA-gated `calculateWht` path untouched.

## What Was Built

### Task 1 — treaty-rate.service.ts (RED `49e190a15` → GREEN `ad89db07e`)
- **`resolveTreatyDecision` (pure):** returns `{ rate, article, source, autoDetected, auditRequired, autoRate, autoArticle }`.
  Three branches — `'treaty'` (a matched row with a treaty rate), `'statutory_30'` (no row / null
  treaty rate → 30%), `'override'` (an override rate + a non-empty reason wins; `auditRequired: true`).
  An override without a non-empty reason throws (required reason). The auto-detected value is
  preserved on the override branch for the audit trail.
- **`applyTreaty` (DB):** `WithholdingTaxRate.findFirst` scoped to `sourceCountry: 'US'`,
  `serviceType: 'business_profits'`, `contractorResidency: { in: [residency, 'XX'] }`,
  `orderBy: { contractorResidency: 'asc' }` (specific before XX); reads the structured
  `treatyArticle` column; an `'XX'` fallback or a null treaty rate resolves to the 30% statutory
  default. The lookup runs even under an override so the audit carries the auto-detected value.
- **Non-breakage regression** added to the existing `tax-rate.service.test.ts` (extended, not
  recreated): `calculateWht('SA', …)` still resolves the SA row with the divide-by-100 percent
  contract while US rows coexist in the table, and `calculateWht('US', …)` returns null without
  touching the DB (the SA gate short-circuits).
- 10 treaty-rate tests + 2 regression tests green. `grep -c "function calculateWht"` on the new
  service is 0 (parallel function, never copied/edited).

### Task 2 — tax-form-routing.ts (RED `6e6d1f22e` → GREEN `8365a8f10`; breadcrumb fix `b9606fddd`)
- **`determineFormType` (pure):** `countryCode === 'US' → 'W9'`; foreign `COMPANY → 'W8BENE'`;
  foreign else (`SOLE_TRADER` / `INDIVIDUAL_FREELANCER` / `OTHER`) → `'W8BEN'`. No DB / no `ctx`.
  Routes the foreign split on the coarse `Contractor.type`, not the fine-grained US entity type
  (the enum-mismatch pitfall). The confirm/override step in Plan 04 is the human safety net.
- 5 routing tests green; function is pure (zero `prisma`/`ctx`/`@contractor-ops/db` references).
- Follow-up `style` commit stripped a `Pitfall 1` ID from a test comment to pass `lint:no-breadcrumbs`.

### Task 3 — w-form-validators.ts (`6a3ce6689`)
- **`taxFormSubmissionSchema`:** `z.discriminatedUnion('formType', […])` over three variants.
  - **W9:** `usEntityType` (reused `usEntityTypeEnum`), `backupWithholding: boolean`, and a
    TIN reference object that accepts a full EIN (via `isValidEin`) **or** an SSN last-4 (exactly
    4 digits) — refined so at least one is present. No `ssn:` field exists (`grep -c "ssn:"` = 0).
  - **W8BEN:** `treatyCountry` (2-letter), loose `ftin`, foreign-address fields, optional
    auto-populated `treatyArticle` / `treatyRate`.
  - **W8BENE:** adds Chapter-3 `entityType` classification + `lobCategory` (line 14b) + `ftin`.
  - **Shared attestation:** `perjuryAccepted: z.literal(true)` + non-empty `signerName`;
    `signedAt`/IP are server-derived and deliberately absent from the client schema.
- Exported from the validators barrel (`taxFormSubmissionSchema`, the three variant schemas,
  `lobCategoryEnum`, `w8beneEntityTypeEnum`, and the inferred types).
- 15 unit tests green, including the PII guard asserting an out-of-schema `ssn` key is stripped.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] applyTreaty resolves the auto value under an override**
- **Found during:** Task 1 (GREEN run — one test expected `autoRate`/`autoArticle` populated on the override path).
- **Issue:** The literal reverse-charge analog short-circuits the DB before an override; that would
  leave the audit trail without the auto-detected value the threat register (T-85-02-01) requires
  ("the auto-detected value is returned alongside for audit").
- **Fix:** `applyTreaty` always runs the lookup and layers the override on top via
  `resolveTreatyDecision`, so the override decision carries the real auto-detected rate/article.
  Header/JSDoc comments corrected to match (amended into the GREEN commit).
- **Files modified:** `packages/api/src/services/treaty-rate.service.ts`
- **Commit:** `ad89db07e`

**2. [Rule 3 - Blocking issue] Stripped a Pitfall-ID breadcrumb to pass lint:no-breadcrumbs**
- **Found during:** Task 3 verification (`pnpm lint:no-breadcrumbs` flagged a `Pitfall 1` comment in the Task-2 test).
- **Fix:** Rewrote the comment to state the WHY without the ID (kept the explanation, dropped the tag).
- **Files modified:** `packages/api/src/services/__tests__/tax-form-routing.test.ts`
- **Commit:** `b9606fddd`

## Threat Model Mitigations Honored

| Threat ID | Mitigation in this plan |
|-----------|-------------------------|
| T-85-02-01 (override tampering) | `resolveTreatyDecision` requires a non-empty reason on the override branch and flags `auditRequired`; the auto-detected value is preserved alongside. Tested: override-without-reason throws. |
| T-85-02-02 (W-9 TIN disclosure) | W9 variant carries EIN or SSN last-4 only; no full-SSN field (grep gate = 0); PII test asserts an out-of-schema `ssn` key is stripped. |
| T-85-02-03 (US rows altering SA WHT) | New parallel service never edits `calculateWht`; regression proves `calculateWht('US')` returns null and the SA path is unchanged. |
| T-85-02-04 (form-routing misclassification) | `determineFormType` routes on the decisive axes (countryCode for W-9, ContractorType for the foreign split). |
| T-85-02-SC (package installs) | No package installs this plan — N/A, no legitimacy checkpoint required. |

## Acceptance Criteria

| Criterion | Result |
|-----------|--------|
| treaty-rate.service test GREEN (treaty / 30% / override-with-reason / override-rejected / specific-beats-XX) | PASS (10 tests) |
| tax-rate.service test GREEN incl. US-rows-don't-break-SA + calculateWht('US') null | PASS (14 incl. 2 new) |
| `grep -c "function calculateWht"` on treaty-rate.service = 0 | PASS |
| all three `source:` branches present in treaty-rate.service | PASS (treaty / override / statutory_30) |
| form-routing test GREEN (4 routing cases) | PASS (5 tests) |
| `determineFormType` exported + pure (no prisma/ctx) | PASS |
| `taxFormSubmissionSchema` discriminatedUnion keyed on formType | PASS |
| `grep -c "ssn:"` on w-form-validators = 0 | PASS |
| `lobCategory` present on W8BENE | PASS |
| `taxFormSubmissionSchema` re-exported from index.ts | PASS |
| `pnpm typecheck --filter @contractor-ops/api --filter @contractor-ops/validators` | PASS |
| `pnpm lint:no-breadcrumbs` | PASS (OK) |

## Deferred Issues

- **Pre-existing `locked-phrases-guard` failure** (out of scope) — the full
  `@contractor-ops/validators` suite has one failing test (`messages/de.json` formal-"Sie"
  register). No 85-02 commit touches any `de.json`; the failure is outside this plan's change
  set. Logged to `deferred-items.md`. All 85-02 scoped test files pass.

## TDD Gate Compliance

Each behavior-adding task has a `test(...)` RED commit followed by a `feat(...)` GREEN commit:
- Task 1: `49e190a15` (test) → `ad89db07e` (feat)
- Task 2: `6e6d1f22e` (test) → `8365a8f10` (feat)
- Task 3: schema + sibling unit tests landed together (`6a3ce6689`) — the plan's `<action>` for
  Task 3 specifies "Add focused unit tests" alongside the schema (a validation-utility task, not a
  RED→GREEN behavior cycle); all 15 assertions pass.

## Self-Check: PASSED

- All six created files + two modified files present on disk.
- All six plan commits present in `git log`.
- 24 api + 15 validators scoped tests green; typecheck green on both packages.
