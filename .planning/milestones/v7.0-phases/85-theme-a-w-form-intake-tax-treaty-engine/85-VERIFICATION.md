---
phase: 85-theme-a-w-form-intake-tax-treaty-engine
verified: 2026-06-16T21:00:00Z
status: human_needed
score: 16/16
overrides_applied: 0
human_verification:
  - test: "Complete the portal W-9 wizard end-to-end in a browser with the module.us-expansion flag enabled"
    expected: "Determination step shows 'W-9' routed correctly; W-9 fields appear; attestation step gates Sign & submit until all checkboxes checked + typed name matches; on submit the receipt renders with the signed date"
    why_human: "Multi-step wizard state machine, form interaction, and browser rendering cannot be verified by grep or file inspection"
  - test: "Complete the W-8BEN wizard for a PL-resident contractor and verify treaty auto-populate"
    expected: "Step shows 'Article 7' and rate '0%' pre-filled in the treaty claim caption; aria-live region present; the submitted snapshot record contains treatyArticle='Article 7' and treatyRate=0"
    why_human: "Auto-populate wiring from getDetermination through to the rendered W-8BEN step requires live interaction"
  - test: "Submit a re-certification (submit a second W-9 for the same contractor)"
    expected: "Prior ACTIVE row flips to SUPERSEDED; new ACTIVE row inserted; getMyTaxForms returns only the new ACTIVE row as the current cert"
    why_human: "Supersede chain correctness with real DB round-trips requires running the app"
  - test: "Open the staff tax-form status card for a contractor without contractorPii:read"
    expected: "Status pill shows ACTIVE/DRAFT/SUPERSEDED correctly; the SSN reveal control is ABSENT from the DOM (not just disabled)"
    why_human: "RBAC rendering behavior (control absent vs disabled) requires browser inspection of the rendered DOM"
  - test: "Open the wizard under the Arabic locale (RTL)"
    expected: "Stepper arrow flips (rtl:rotate-180); step labels flow right-to-left; all strings appear in Arabic; no layout breakage"
    why_human: "RTL rendering correctness requires visual inspection in the browser"
---

# Phase 85: W-Form Intake + Tax Treaty Engine — Verification Report

**Phase Goal:** US-resident and foreign contractors complete the correct tax-status wizard, with treaty rates and articles auto-applied from a single treaty table.
**Verified:** 2026-06-16T21:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | WithholdingTaxRate carries a structured treatyArticle column | VERIFIED | `tax.prisma` L34: `treatyArticle String? @db.VarChar(40)` present on the model; grep confirms column on both `WithholdingTaxRate` (L34) and `TaxFormSubmission` (L96) |
| 2 | US treaty rows exist for PL/DE/GB/IE/NL (reduced) and AE/SA (30% statutory) plus XX fallback | VERIFIED | `wht-rates.ts` yields 8 `sourceCountry: 'US'` rows; PL/DE/GB/IE/NL each have `treatyRate: 0.0, treatyArticle: 'Article 7'`; AE and SA have `treatyRate: null`; XX fallback row with `treatyRate: null` present |
| 3 | A TaxFormSubmission table exists with a supersede chain, FK'd to Contractor | VERIFIED | `tax.prisma` L86: `model TaxFormSubmission` present with `supersededById @unique` self-relation named `"Supersede"`, FK to `Contractor`; back-relations confirmed in `contractor.prisma` L87 and `organization.prisma` L122 |
| 4 | The new table + columns exist in the live database (migration applied) | VERIFIED | SUMMARY-01 checkpoint documents operator-approved direct-DDL full-sync; post-apply diff empty (modulo permanent FTS artifacts); US seed rows applied. Flagged as separate infra debt: migration history (`_prisma_migrations`) remains out of sync — out of scope per call-out in context |
| 5 | US rows store treatyRate as whole-number percent (30.0 / 0.0 / null), never fractions | VERIFIED | Seed file uses `30.0`, `0.0`, `null` — no fractional values present in the 8 US rows |
| 6 | Treaty rate + article resolve from (residency, US source, business_profits) with specific beating XX fallback | VERIFIED | `treaty-rate.service.ts` L150: `contractorResidency: { in: [residency, 'XX'] }`, `orderBy: { contractorResidency: 'asc' }` (specific row lexicographically before 'XX'); confirmed by test at line 179 asserting specific residency beats XX |
| 7 | No treaty row resolves to 30% statutory default when a treaty exists | VERIFIED | `treaty-rate.service.ts` L163: only returns treaty result when `row.treatyRate !== null && row.contractorResidency !== 'XX'`; otherwise falls through to `statutory_30` |
| 8 | A manual override with a required reason wins over the auto-detected rate | VERIFIED | `treaty-rate.service.ts` L86: `source: 'override'` branch; SUMMARY-02 reports override-without-reason throws confirmed in 10 passing tests |
| 9 | US WithholdingTaxRate rows do NOT affect the SA-gated calculateWht path | VERIFIED | `treaty-rate.service.ts` grep: `function calculateWht` count = 0 (parallel service, never edits calculateWht); regression test proves `calculateWht('US')` returns null |
| 10 | Form routing returns W-9 for US contractors, W-8BEN-E for foreign companies, W-8BEN for foreign individuals | VERIFIED | `tax-form-routing.ts` L37: `export function determineFormType` — pure function with no `prisma`/`ctx` imports; 5 routing tests green per SUMMARY-02 |
| 11 | A contractor can submit a W-9/W-8BEN/W-8BEN-E from the portal; immutable record + audit | VERIFIED | `portal-tax-form-router.ts` wires `buildFormSnapshot + supersedeAndInsert + writeAuditLog` all scoped to `ctx.contractorId`; 8 portal integration tests green per SUMMARY-03 |
| 12 | Re-certification inserts a NEW row and supersedes the prior ACTIVE one | VERIFIED | `tax-form.service.ts` L181 (`supersedeAndInsert`): `updateMany ACTIVE→SUPERSEDED` then `create`; test at portal test line 276 covers this case |
| 13 | Full SSN never appears in the snapshot or the portal response | VERIFIED | `tax-form.service.ts`: no `ssnEncrypted`/`fullSsn`/`ssn:` in service body; `getMyTaxForms` explicit `select` omits `snapshotJson`; `w-form-validators.ts` `grep -c "ssn:"` = 0; portal test line 289 asserts PII non-leak |
| 14 | ESIGN attestation captures typed name + server-derived timestamp + IP + contractorId into snapshot | VERIFIED | `portal-tax-form-router.ts` L174-175: `signedAt = new Date()`, `ip = deriveClientIp(ctx.headers)`; `grep -n "input.ip\|body.ip"` returns 0; `ctx.contractorId` used as actorId; portal test line 303-323 covers ESIGN capture |
| 15 | All US form procedures gated behind module.us-expansion | VERIFIED | `root.ts` L161: `isUsExpansionRegistered()` conditional-spread for staff `taxForm` namespace; `portal-tax-form-router.ts` calls `assertUsExpansionEnabled` in every procedure (lines 60, 96, 128); FORBIDDEN test at line 370 covers gating |
| 16 | Portal wizard renders with confirm/override determination, treaty auto-populate with aria-live, attestation gate | VERIFIED | `tax-form-wizard.tsx` dispatches steps via hook; `treaty-claim-caption.tsx` L24: `aria-live="polite"` present; `step-attest.tsx` L90/109: real `type="checkbox"` perjury inputs; 12 component tests green per SUMMARY-04 |

**Score:** 16/16 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/db/prisma/schema/tax.prisma` | treatyArticle column + TaxFormSubmission model + TaxFormType/TaxFormStatus enums | VERIFIED | All present: treatyArticle at L34 on WithholdingTaxRate + L96 on TaxFormSubmission; model at L86; enums at L74/L80 |
| `packages/db/prisma/seed/wht-rates.ts` | US sourceCountry='US' business_profits rows + XX fallback | VERIFIED | 8 rows confirmed; PL/DE/GB/IE/NL with Article 7; AE/SA statutory; XX fallback |
| `packages/api/src/services/treaty-rate.service.ts` | resolveTreatyDecision (pure) + applyTreaty (DB) | VERIFIED | Both exported; all three source branches present (treaty/override/statutory_30) |
| `packages/api/src/services/tax-form-routing.ts` | determineFormType pure function | VERIFIED | Exported at L37; no prisma/ctx imports |
| `packages/validators/src/w-form-validators.ts` | discriminated-union Zod schema keyed on formType + FTIN + LOB | VERIFIED | `z.discriminatedUnion('formType', ...)` at L141; lobCategory on W8BENE; no `ssn:` full-value field |
| `packages/api/src/services/tax-form.service.ts` | buildFormSnapshot + supersedeAndInsert exports | VERIFIED | Both exported at L108 and L181 |
| `packages/api/src/routers/portal/portal-tax-form-router.ts` | getDetermination/saveDraft/submitTaxForm/getMyForms (portalProcedure) | VERIFIED | All four procedures present; IDOR-scoped to ctx.contractorId |
| `packages/api/src/routers/core/tax-form-router.ts` | staff listFormSubmissions / requestTaxForm | VERIFIED | listFormSubmissions at L31; staff router exported |
| `packages/api/src/middleware/require-us-expansion-flag.ts` | assertUsExpansionEnabled + isUsExpansionRegistered | VERIFIED | File exists; both functions imported in router and root.ts |
| `apps/web-vite/src/components/portal/tax-forms/tax-form-wizard.tsx` | container with Stepper + step dispatch + 4 states | VERIFIED | 67+ lines; dispatches via useTaxFormWizard hook; loading/error states present |
| `apps/web-vite/src/components/portal/tax-forms/hooks/use-tax-form-wizard.ts` | sole tRPC/RHF boundary | VERIFIED | Imports `usePortalTRPC`; calls getTaxFormDetermination, saveTaxFormDraft, submitTaxForm; container uses hook only |
| `apps/web-vite/src/components/portal/tax-forms/step-attest.tsx` | perjury checkboxes + typed-name gate | VERIFIED | Real `type="checkbox"` at L90/109; role="alert" aria-live at L137-138; submit gate present |
| `apps/web-vite/src/components/contractors/tax-forms/tax-form-status-card.tsx` | staff status card with SsnMaskedReveal | VERIFIED | SsnMaskedReveal imported and rendered at L146 |
| `apps/web-vite/src/pages/portal/tax-form-page.tsx` | thin portal page | VERIFIED | File exists; registered in portal-routes.tsx at path `portal/tax-form` |
| `.planning/brain/wiki/domains/us-tax-forms.md` | US W-form domain wiki page | VERIFIED | File exists; Purpose/Flow/Entry points/UI surface/Agent mistakes sections all present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/db/prisma/seed/wht-rates.ts` | WithholdingTaxRate | upsert on composite unique key | VERIFIED | `upsert` call at L243 keyed on the 4-field composite; 8 US rows present |
| `TaxFormSubmission` | `Contractor` | FK relation | VERIFIED | `contractor Contractor @relation(...)` in model; `taxFormSubmissions TaxFormSubmission[]` back-relation in contractor.prisma L87 |
| `treaty-rate.service.ts` | WithholdingTaxRate | findFirst with sourceCountry='US' | VERIFIED | `applyTreaty` at L144 does `withholdingTaxRate.findFirst` with `sourceCountry: 'US'`, `serviceType: 'business_profits'` |
| `treaty-rate.service.ts` | resolveTreatyDecision override branch | audit trail | VERIFIED | `source: 'override'` branch at L86; `auditRequired: true` returned; auto-detected value preserved |
| `portal-tax-form-router.ts` | ctx.contractorId | IDOR-safe scoping | VERIFIED | 9 occurrences of `ctx.contractorId` for every read/write; no `input.contractorId` used for scoping |
| `portal-tax-form-router.ts` | applyTreaty | resolve treaty claim on submit | VERIFIED | `applyTreaty` imported at L17 and called in submitTaxForm at L169 |
| `packages/api/src/root.ts` | module.us-expansion | conditional-spread router gating | VERIFIED | `isUsExpansionRegistered()` conditional at L161 spreads `taxForm` namespace |
| `tax-form-wizard.tsx` | use-tax-form-wizard hook | container consumes hook only | VERIFIED | L24 imports hook; L67 calls `useTaxFormWizard()`; no direct tRPC in container |
| `use-tax-form-wizard.ts` | portal tax-form procedures | useTRPC portal namespace | VERIFIED | L84: `trpc.portal.getTaxFormDetermination.queryOptions()`; L108: `trpc.portal.submitTaxForm.mutationOptions()` |
| `tax-form-status-card.tsx` | SsnMaskedReveal | gated reveal reuse | VERIFIED | SsnMaskedReveal imported at L23 and rendered verbatim at L146 |
| `use-tax-form-status.ts` | taxForm.listFormSubmissions | staff tRPC boundary | VERIFIED | L45: `trpc.taxForm.listFormSubmissions.queryOptions({ contractorId })` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `tax-form-wizard.tsx` | `wizard` (from useTaxFormWizard) | `use-tax-form-wizard.ts` via `trpc.portal.getTaxFormDetermination` + `trpc.portal.submitTaxForm` | Yes — portal procedures query DB via `ctx.db.taxFormSubmission`; determination calls `applyTreaty` which queries `WithholdingTaxRate` | FLOWING |
| `tax-form-status-card.tsx` | form submissions data | `use-tax-form-status.ts` via `trpc.taxForm.listFormSubmissions` | Yes — `tax-form-router.ts` queries `ctx.db.taxFormSubmission.findMany` with explicit status/treaty/expiry select | FLOWING |
| `portal-tax-form-router.ts` (submitTaxForm) | snapshot stored in DB | `buildFormSnapshot` + `supersedeAndInsert` | Yes — `supersedeAndInsert` calls `ctx.db.$transaction` with real Prisma operations; no static/empty returns | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — portal procedures require a running server + live DB; treaty resolution requires the seeded rows. Tests and grep verification are the appropriate substitute here.

### Probe Execution

Step 7c: No probes declared in PLAN files; no `scripts/*/tests/probe-*.sh` found for this phase. SKIPPED — not applicable.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|------------|----------------|-------------|--------|---------|
| US-FORM-01 | 85-01, 85-02, 85-03, 85-04 | US-resident contractor completes a W-9 collection wizard (TIN + entity type + backup-withholding flag), stored against Contractor with audit trail | SATISFIED | Schema (TaxFormSubmission), service (buildFormSnapshot/supersedeAndInsert), portal router (submitTaxForm with audit), wizard UI (step-w9.tsx, step-attest.tsx), 8 portal integration tests |
| US-FORM-02 | 85-01, 85-02, 85-03, 85-04 | Foreign contractor completes a W-8BEN / W-8BEN-E wizard (treaty country + article picker, FTIN, certifications) | SATISFIED | taxFormSubmissionSchema W8BEN/W8BENE variants (FTIN, lobCategory, treatyArticle), step-w8ben.tsx + step-w8ben-e.tsx, portal submitTaxForm resolves treaty, W-8BEN-E test at line 324 |
| US-LOC-02 | 85-01, 85-02, 85-03, 85-04 | US tax-treaty rate table (PL/DE/UK/UAE/KSA/IE/NL) auto-applied when contractor + payer jurisdictions trigger a treaty | SATISFIED | 8 US seed rows in WithholdingTaxRate; applyTreaty does the lookup; portal submitTaxForm calls applyTreaty; getDetermination auto-populates |
| US-LOC-03 | 85-01, 85-02, 85-03, 85-04 | W-8BEN treaty-article auto-populate based on contractor home jurisdiction + treaty table | SATISFIED | treatyArticle structured column on WithholdingTaxRate; applyTreaty reads it; getDetermination returns it; treaty-claim-caption.tsx renders it with aria-live announcement |

All 4 requirement IDs claimed by all 4 PLAN files are covered. No orphaned requirements identified.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/api/src/routers/portal/__tests__/tax-form.test.ts` | L293 | `ssn: FULL_SSN` in a test as `as never` — a full SSN string appears in the PII non-leak test's malicious input | INFO | Test-only; this is the attack input used to assert the server strips it. Not a production leak. The `as never` cast confirms it is intentionally out-of-schema. |

No TBD/FIXME/XXX debt markers found in any phase-85 source files. No unresolved TODOs in production code paths. No placeholder stubs returning empty/null data in the render path.

### Human Verification Required

Items requiring human testing (visual, interactive, or real-time behavior):

#### 1. Portal W-9 wizard end-to-end flow

**Test:** With `module.us-expansion` enabled (FLAG_SIGNOFF_BYPASS=local or QA_DEFAULT_ORG_ID set), navigate to `portal/tax-form` as a US-resident contractor. Complete the wizard: confirm the W-9 determination, fill in entity type + backup withholding, complete the attestation step.
**Expected:** Determination step shows "W-9 (Form W-9)"; all form fields render; attestation step keeps "Sign & submit" disabled until all perjury checkboxes are checked AND the typed legal name matches the on-file name; on submit the receipt renders with the signed date.
**Why human:** Multi-step form state machine, button enable/disable gating, and real browser rendering cannot be verified by static analysis.

#### 2. W-8BEN treaty auto-populate (PL contractor)

**Test:** As a contractor with `countryCode='PL'` and `type='SOLE_TRADER'`, open the wizard. Observe the W-8BEN step.
**Expected:** The treaty claim caption shows "Article 7 — 0%" auto-populated; the caption region has `aria-live="polite"` so a screen reader would announce the rate; the field is pre-filled but can be overridden.
**Why human:** Auto-populate from the determination query to the rendered step field requires running the portal against a live DB with the PL treaty row present.

#### 3. Re-certification supersede flow

**Test:** Submit a W-9 for a contractor. Then submit a second W-9 for the same contractor.
**Expected:** The first record transitions to `status: SUPERSEDED`; the second is `status: ACTIVE`; `getMyTaxForms` returns both rows with correct statuses; the ACTIVE row has `supersededById` null and the SUPERSEDED row has `supersededById` pointing to the new ACTIVE row.
**Why human:** Requires live DB round-trips to verify the supersede chain integrity.

#### 4. Staff status card PII gating

**Test:** Log in as a staff user WITHOUT `contractorPii:read`. Open the tax-form status card for a W-9 contractor.
**Expected:** The status pill shows ACTIVE/DRAFT/SUPERSEDED correctly; the SSN reveal control is ABSENT from the DOM entirely (not just disabled/hidden with CSS).
**Why human:** DOM inspection of the ABSENT (vs merely hidden) control requires browser DevTools.

#### 5. RTL rendering of the wizard (Arabic locale)

**Test:** Switch the app to Arabic locale. Open the portal tax-form wizard.
**Expected:** Stepper arrow flips (logical rtl:rotate-180); step labels and field labels flow right-to-left; all strings display in Arabic; no horizontal overflow or layout breakage in the wizard steps.
**Why human:** RTL rendering correctness requires visual browser inspection; grep confirmed zero physical `ml-`/`mr-`/`text-left` props but logical RTL behavior is only verifiable visually.

### Gaps Summary

No blocking gaps found. All 16 must-have truths are VERIFIED at the artifact, wiring, and data-flow levels. The human verification items are behavioral/visual items that passed automated checks (tests, grep gates, typecheck) but require live browser confirmation per standard practice.

**Notable pre-existing/out-of-scope items (per call-out in context — not counted as phase-85 gaps):**
- Migration history (`_prisma_migrations`) out of sync with the actual schema — the DB schema matches HEAD but history reconciliation is separate infra debt.
- One pre-existing `de.json` "Sie"-register test failure in validators (unrelated to phase-85 files).
- 6 `check:wiki-brain` errors from earlier branch's unstaged changes (jira/linear/teams/contractor-core/errors.ts) — predating phase-85.

---

_Verified: 2026-06-16T21:00:00Z_
_Verifier: Claude (gsd-verifier)_
