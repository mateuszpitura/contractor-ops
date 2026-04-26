---
phase: 57-government-api-clients
verified: 2026-04-26T03:25:00Z
status: gaps_found
score: 15/16 truths verified

re_verification:
  previous_status: pending
  previous_score: 0/16
  gaps_closed:
    - "Vitest alias chain repaired so packages/api router test suites can load (Plan 66-01 — fix(66-01) commit 2a52cf4e)"
    - "§2 router-layer HMRC 404→invalid surface coverage added (Plan 66-02 contractor.test new case — commit c232b907)"
    - "§6 organization.setKleinunternehmer DE-only gate coverage added (Plan 66-02 organization.test new describe block + extended @contractor-ops/logger mock — commit c232b907)"
    - "§2 MSW Layer A post-network 404 wire-level coverage added (Plan 66-03 hmrc-vat-client.msw.integration new case — implementation in commit e7cab893; see fix_commits[] note)"
    - "Plan 57-04 Task 3 9-scenario human-verify checkpoint converted to deterministic CI evidence (combination of pre-existing tests + Plan 66-02 + 66-03 additions; one scenario — accessibility spot-check — explicitly remains manual_only[])"
  gaps_remaining:
    - "Phase 62 zugferd-de module-load regression in @contractor-ops/validators barrel breaks the apps/web `country-compliance-section.test.tsx` suite at module-load time (TypeError: 'The URL must be of scheme file' raised at packages/einvoice/src/profiles/zugferd-de/invoice-template.tsx:35). This affects Truth #15 (Phase 57 ships intended UI components) — the country-compliance-section component itself is still on disk and its source unchanged from Phase 57's commits, but its co-located test cannot load. Pre-existing baseline noise per concurrent Phase 67's 56-VERIFICATION.md classification (R-07 / R-09 / R-10 / R-11). Out of Phase 57 / 66 scope; should be addressed by a future Phase 62 vitest-config polish phase."
  regressions: []
  fix_commits:
    - hash: "2a52cf4eb6dca7af2f4c34db867a8067568add28"
      scope: "fix(66-01): repair @contractor-ops/einvoice subpath alias in api vitest config"
      files:
        - "packages/api/vitest.config.ts"
      changes:
        - "Replaced single-file alias '@contractor-ops/einvoice'→einvoice/src/index.ts with array-of-aliases pattern enumerating /zatca/schemas, /zatca/types, /compliance, and the bare entry. Subpath entries listed BEFORE the bare entry per Vite alias matching semantics."
    - hash: "c232b907b6d412147c0b8d463122a775584e1ab1"
      scope: "test(66-02): close router-layer Phase 57 coverage gaps for §2 + §6"
      files:
        - "packages/api/src/routers/__tests__/contractor.test.ts"
        - "packages/api/src/routers/__tests__/organization.test.ts"
      changes:
        - "contractor.test.ts: added validateVat surfaces responseStatus='invalid' (HMRC 404 router-layer assertion)."
        - "organization.test.ts: added describe block 'organization.setKleinunternehmer' with 3 cases (DE flips flag, GB FORBIDDEN, PL FORBIDDEN)."
        - "organization.test.ts: extended @contractor-ops/logger mock to include createIntegrationLogger / createCronLogger / createWebhookLogger / logger so the suite can load against current root.ts."
    - hash: "e7cab893eb118820584c93aaa82e95c965f738b5"
      scope: "test(66-03) implementation [bundled with concurrent docs(67-01) commit due to multi-agent git index race; see 66-03-SUMMARY.md Issues Encountered]: close MSW Layer A gap for §2 HMRC post-network 404"
      files:
        - "packages/gov-api/src/clients/__tests__/hmrc-vat-client.msw.integration.test.ts"
      changes:
        - "Added per-test server.use() override returning 404 for a checksum-passing VRN (GB193054661); asserts client returns { status: 'invalid', raw: null } AFTER a real fetch round-trip and that the override handler was actually invoked (handlerCallCount === 1)."
        - "Added http / HttpResponse imports via @contractor-ops/test-utils re-export (gov-api does not depend on msw directly)."

human_verification:
  - test: "WCAG / accessibility spot-check on Phase 57 UI surfaces"
    expected: "Tab through contractor profile → VAT pill + Revalidate button reachable via keyboard. Pill variants always render icon + text (no color-only signal). Stale pill tooltip is screen-reader accessible. Kleinunternehmer toggle has focus-visible state. RC line toggle dialog focus-traps the textarea."
    why_human: "No axe-core / matcher-based a11y test infrastructure currently exists in apps/web. Adding it is out of scope per Phase 66 CONTEXT.md decision D-12; this spot-check stays manual until a future test-infrastructure phase. Per Phase 57 D-09 the visual signal must always include text alongside color (WCAG AA), and the existing component tests grep the literal label strings ('Valid', 'Invalid', 'Stale', 'Unavailable', 'Not validated') as a proxy."
    deferral_pattern: "STATE.md 'Manual-Only Verifications' convention; mirrors Phase 57 VALIDATION.md §Manual-Only Verifications."

  - test: "HMRC live sandbox round-trip on a real GB VRN (PAY-03 production-onboarding evidence)"
    expected: "Once HMRC Developer Hub registration completes (~2-week wait per STATE.md Blockers), exercise validateVat against the live HMRC sandbox endpoint with real client_id / client_secret to confirm: (a) production-VRN guard tolerates empty platformVrn in sandbox, (b) OAuth 2.0 client-credentials Bearer flow round-trips, (c) lookup returns canonical sandbox valid (193054661 → 200 valid) and invalid (555555555 → 404 invalid), (d) fraud-prevention headers reach HMRC."
    why_human: "HMRC sandbox credentials are pre-deploy ops infrastructure tracked in STATE.md Blockers. Per Phase 66 CONTEXT.md decisions D-13 and D-14, this is NOT a Phase 66 gate — MSW deterministic tests cover the application code path; the live-credential exercise is pre-deploy ops hygiene, not pre-merge. Phase 66 explicitly removes it as a verification gate."
    deferral_pattern: "STATE.md 'Standing Project Constraints — Legal/regulatory verification deferred' convention extended to live-credential ops gates."
---

# Phase 57: Government API Clients — Verification Report

**Phase Goal:** Users can validate UK VAT numbers via HMRC, validate German USt-IdNr via VIES qualified confirmation with graceful degradation, see UK / DE VAT rates correctly applied to invoices, and use the Kleinunternehmer toggle + reverse-charge auto-detection with override-with-reason audit (per ROADMAP.md Phase 57 Success Criteria 1-4 and REQUIREMENTS.md PAY-02..05).

**Verified:** 2026-04-26T03:25:00Z
**Status:** gaps_found
**Re-verification:** First — Phase 57 reached `VALIDATION.md status: approved` on 2026-04-13 but never produced a VERIFICATION.md; this is the goal-backward closure, made possible by the Plan 66-01 vitest-load fix and the Plan 66-02 / 66-03 coverage fills. One non-Phase-57 baseline-noise gap surfaces (a Phase 62 zugferd-de module-load regression that breaks the apps/web country-compliance-section test loader) — flagged in `gaps_remaining[]` and routed to a future Phase 62 polish phase per the spirit of Phase 67's pre-existing-baseline-noise classification.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | UK VAT validation via HMRC end-to-end (HmrcVatClient → orchestrator → router → UI pill) — PAY-03 / Success Criterion 1 | ✓ VERIFIED | Layer A wire-level: `packages/gov-api/src/clients/__tests__/hmrc-vat-client.msw.integration.test.ts` `checkVatNumber returns valid result for sandbox VRN (193054661)`. Router layer: `packages/api/src/routers/__tests__/contractor.test.ts §781` `validateVat dispatches GB_VAT for a UK contractor`. Orchestrator dispatch: `validateTaxId` invoked with `taxIdType: 'GB_VAT'`. UI: `apps/web/src/components/contractors/__tests__/vat-validation-status-pill.test.tsx §5` `renders "Valid" badge for valid status`. |
| 2 | UK VAT validation 404 sad path surfaces as 'invalid' to UI — PAY-03 | ✓ VERIFIED — newly closed by Phase 66 | Layer A wire-level: hmrc-vat-client.msw.integration.test.ts `post-network sad path` (Plan 66-03) — checksum-passing VRN against MSW 404 returns `{status: 'invalid', raw: null}`. Router layer: `contractor.test.ts validateVat surfaces responseStatus=invalid` (Plan 66-02). UI: vat-validation-status-pill.test.tsx §14 `renders "Invalid" badge for invalid status` + §55 destructive variant assertion. |
| 3 | DE USt-IdNr validation via VIES qualified confirmation — PAY-05 / Success Criterion 2 | ✓ VERIFIED | Layer A: `packages/gov-api/src/clients/__tests__/vies-client.msw.integration.test.ts` `qualified checkVatNumber returns confirmationRef (requestIdentifier)`. Router layer: `contractor.test.ts §804` `validateVat dispatches DE_USTIDNR for a DE contractor`. |
| 4 | VIES outage graceful soft-fail — yellow stale pill — PAY-05 / D-08 | ✓ VERIFIED | Router layer: `contractor.test.ts §869` `revalidateVat returns stale responseStatus when orchestrator soft-fails (D-08)`. UI: vat-validation-status-pill.test.tsx §23 `renders "Stale" badge for stale status` (asserts visible label + `data-status='stale'`). Layer A coverage of MS_UNAVAILABLE branch lives in vies-client MSW integration suite. |
| 5 | UK VAT rate preselect — PAY-02 / Success Criterion 3 | ✓ VERIFIED | `packages/api/src/routers/__tests__/invoice.test.ts §994` `GB org invoice pre-selects the isDefault TaxRate code 20 — PAY-02`. Underlying: `getTaxRatesForCountry('GB')` returns 4 rates ordered isDefault-first (covered in `packages/api/src/services/__tests__/tax-rate.service.test.ts`). |
| 6 | DE VAT rate preselect — PAY-04 / Success Criterion 4 | ✓ VERIFIED | `invoice.test.ts §1007` `DE org invoice pre-selects the isDefault TaxRate code 19 — PAY-04`. |
| 7 | DE Kleinunternehmer forces 'KU' on all lines + footer notice — PAY-04 | ✓ VERIFIED | Router layer: `invoice.test.ts §1019` `DE Kleinunternehmer org forces invoice vatRate to KU — PAY-04 (§19 UStG)`. Footer: `apps/web/src/components/invoices/__tests__/invoice-footer-legal-notices.test.tsx §22` `renders Kleinunternehmer notice for DE org` (asserts the locked-phrase substring `Gemäß § 19 UStG …` from `@contractor-ops/validators`). Locked-phrase guard: `packages/validators/src/__tests__/locked-phrases-guard.test.ts` 78/78 green. |
| 8 | DE Kleinunternehmer toggle DE-only gate — PAY-04 / D-02 | ✓ VERIFIED — newly closed by Phase 66 | Router layer: `organization.test.ts organization.setKleinunternehmer (Phase 57 · Plan 04 / Phase 66)` — 3 cases (DE pass / GB FORBIDDEN / PL FORBIDDEN) added by Plan 66-02. UI gate: `KleinunternehmerToggle` returns null for non-DE orgs (component-render branch covered indirectly by the country-compliance-section component test — note: that test currently fails to load due to a Phase 62 pre-existing baseline-noise regression; see gaps_remaining[]). |
| 9 | Reverse-charge auto-detect (DE→GB B2B + DE domestic 13b UStG) — PAY-04 | ✓ VERIFIED | `invoice.test.ts §1032` `auto-selects RC when detectReverseCharge reports shouldApply=true`. Service-layer rules covered by `packages/api/src/services/__tests__/reverse-charge.service.test.ts`. |
| 10 | RC override requires reason (Zod refine + AlertDialog gate) and writes audit log — PAY-04 / D-13 | ✓ VERIFIED | `invoice.test.ts §1108` `persists AuditLog when user disables auto-detected RC with a reason (D-13)`. Refusal: `invoice.test.ts §1150` `rejects reverseChargeOverride=false without a reason (Zod refine)`. UI: `apps/web/src/components/invoices/__tests__/reverse-charge-line-toggle.test.tsx`. |
| 11 | UK reverse-charge footer locked phrase render — PAY-04 / D-14 | ✓ VERIFIED | `invoice-footer-legal-notices.test.tsx §47` `renders UK reverse charge notice` — asserts the literal locked phrase `Reverse charge: Customer to pay the VAT to HMRC` and `lang='en'`. Locked-phrase identifier imported from `@contractor-ops/validators` per Phase 57 D-12 (CI guard: locked-phrases-guard 78/78 green). |
| 12 | D-07 trigger 1: profile-save-with-changed-VAT-number dispatches inline validateTaxId | ✓ VERIFIED | `contractor.test.ts §911` `dispatches validateTaxId exactly once when a UK contractor VAT number changes`. Scope guard: §928 `does NOT dispatch validateTaxId when the VAT number is unchanged`. Clear path: §939 `clears summary fields without API call when updated row has null vatId`. |
| 13 | gov-api-clients factory — production VRN guard | ✓ VERIFIED | `packages/api/src/__tests__/gov-api-clients.test.ts` 6/6 green. Defense-in-depth: zod superRefine + runtime throw on `HMRC_PLATFORM_VRN` empty when `HMRC_ENV=production`; permits empty in sandbox. |
| 14 | Cross-org isolation on validateVat — defense in depth — Phase 57 Threat T-57-04-01 | ✓ VERIFIED | `contractor.test.ts §831` `validateVat throws NOT_FOUND for a contractor in another organization`. |
| 15 | Phase 57 ships intended UI components (5 new + 1 extended) | ◆ PARTIAL — files-on-disk verified; co-located component test for country-compliance-section currently fails to LOAD due to Phase 62 zugferd-de module-load baseline noise (pre-existing). | All component files present (verified by `ls`): `vat-validation-status-pill.tsx`, `revalidate-vat-button.tsx`, `kleinunternehmer-toggle.tsx`, `reverse-charge-line-toggle.tsx`, `invoice-footer-legal-notices.tsx`, `country-compliance-section.tsx` (extended). 4 of 5 co-located tests green: `vat-validation-status-pill`, `revalidate-vat-button`, `reverse-charge-line-toggle`, `invoice-footer-legal-notices`. The 5th — `country-compliance-section.test.tsx` — fails at module-load with `TypeError: The URL must be of scheme file` raised at `packages/einvoice/src/profiles/zugferd-de/invoice-template.tsx:35` (Phase 62 import-time path leak through the validators barrel). Tracked in gaps_remaining[] for a future Phase 62 polish. |
| 16 | Microcopy present in all 4 locales (en/de/pl/ar) for Phase 57 namespaces | ✓ VERIFIED | Per 57-04-SUMMARY.md verification, `jq '.contractor.vatValidation.valid' apps/web/messages/{en,de,pl,ar}.json` returns the translated label in all 4 files. Locked-phrase identifiers (TAX_KLEINUNTERNEHMER_NOTICE etc.) are NOT mirrored in messages — guard test (locked-phrases-guard 78/78) enforces. |

**Score:** 15/16 truths verified. Plan 66 newly closed: #2 (via Plans 66-02 + 66-03), #8 (via Plan 66-02). 1 partial (#15) — files exist and 4 of 5 co-located tests green; 5th fails to LOAD due to a Phase 62 baseline-noise regression unrelated to Phase 57's Plan 04 implementation. 2 deferred items in `human_verification` block (a11y spot-check, HMRC live sandbox round-trip).

### Required Artifacts

| Artifact | Plan | Status | Details |
|----------|------|--------|---------|
| `packages/db/prisma/schema/*.prisma` (TaxIdValidation model + Contractor.latestVat* + Organization.isKleinunternehmer) | 57-01 | ✓ VERIFIED | Per 57-04-SUMMARY.md: schema models present, fields wired through. |
| `packages/api/src/gov-api-clients.ts` (env-driven factory) | 57-04 | ✓ VERIFIED | 6 tests green; production-VRN guard active. |
| `packages/api/src/routers/contractor.ts` (validateVat / revalidateVat / D-07 trigger 1 in update) | 57-04 | ✓ VERIFIED | 9 phase-57 router tests + 3 D-07 trigger tests + Phase 66 §2 surface test all green (44 cases total in contractor.test.ts). |
| `packages/api/src/routers/organization.ts` (setKleinunternehmer DE-only) | 57-04 | ✓ VERIFIED — gate now tested | Newly tested via Plan 66-02 organization.test setKleinunternehmer block (3 cases). 7 cases total in organization.test.ts (4 pre-existing + 3 new). |
| `packages/api/src/routers/invoice.ts` (upsertLine pipeline: preselect + RC + KU + audit) | 57-04 | ✓ VERIFIED | 8 phase-57 invoice.test cases green (§944-1158); 14 cases total in invoice.test.ts. |
| 6 UI components + extended country-compliance-section | 57-04 | ◆ PARTIAL | 6 component files present; 4 of 5 co-located tests green; country-compliance-section test fails to load (Phase 62 baseline). |
| 4 locales × 3 namespaces of microcopy | 57-04 | ✓ VERIFIED | 57-04-SUMMARY.md `jq` evidence; replicated. |
| MSW handlers for HMRC + VIES (test-utils) | 57-01 | ✓ VERIFIED | `packages/test-utils/src/msw/handlers/{hmrc,vies}.ts` exist; consumed by gov-api MSW integration tests + Plan 66-03 override. |

## Re-run Evidence

Captured during Phase 66 closure (2026-04-26T03:22:00Z):

```
$ cd packages/api && npx tsc --noEmit
EXIT: 1 — 95 pre-existing TS errors in audit.ts, consent.ts, and various services
       (Prisma deep generic mismatches; NOT introduced by Phase 57 / 66; baseline)

$ cd packages/api && pnpm vitest run "src/routers/__tests__/contractor.test.ts" \
    "src/routers/__tests__/invoice.test.ts" "src/routers/__tests__/organization.test.ts" \
    "src/__tests__/gov-api-clients.test.ts"
Test Files  4 passed (4)
Tests  71 passed (71)

$ pnpm --filter @contractor-ops/gov-api test
Test Files  9 passed (9)
Tests  68 passed (68)

$ pnpm --filter @contractor-ops/web test -- --run vat-validation-status-pill \
    invoice-footer-legal-notices reverse-charge-line-toggle revalidate-vat-button \
    country-compliance-section
Test Files  1 failed | 4 passed (5)
Tests  28 passed (28)
  ↳ FAIL src/components/contractors/__tests__/country-compliance-section.test.tsx
     (0 tests run; load-time TypeError from Phase 62 zugferd-de invoice-template.tsx:35)
     Pre-existing baseline noise per concurrent Phase 67 56-VERIFICATION.md classification.

$ pnpm --filter @contractor-ops/validators test -- --run locked-phrases-guard
Test Files  1 passed (1)
Tests  78 passed (78)
```

## Notes on the 3 originally-failing contractor.test cases

Per CONTEXT.md decision D-03, the mock-harness extension for `contract.count` / `contract.groupBy` was already landed by commit `0df1164f chore: snapshot v2 WIP before phase 61 execution` (2026-04-14, lines 73-77 of `contractor.test.ts`). The 3 failures recorded in `57-04-SUMMARY.md` "Verification Results" table (`archive`, `updateLifecycleStage INACTIVE`, `bulkArchive`) cannot fail on the harness cause anymore. Plan 66-01's vitest alias repair unblocked loading; the re-run above confirms all 3 cases pass on current HEAD as part of contractor.test.ts's 44 green cases.

## Phase 57 → Phase 66 Closure Trace

Phase 57 delivered the implementation (commits up to `d240752a` 2026-04-13). Phase 66 delivered the verification:

- Plan 66-01 (`2a52cf4e`): repaired vitest alias chain → router test suites can load.
- Plan 66-02 (`c232b907`): closed router-layer §2 (HMRC 404 invalid surface) + §6 (setKleinunternehmer DE-only gate); extended @contractor-ops/logger mock as Rule 2 prerequisite.
- Plan 66-03 (`e7cab893` — bundled with concurrent docs(67-01) commit due to multi-agent git index race; see 66-03-SUMMARY.md): closed Layer A wire-level §2 (HMRC post-network 404 vs. checksum preflight).
- Plan 66-04 (this commit): produced 57-VERIFICATION.md with status `gaps_found` due to a single non-Phase-57 baseline-noise gap (Phase 62 zugferd-de module-load regression breaking country-compliance-section.test.tsx loader).

The 9 (sub-)scenarios from Plan 57-04 Task 3 are now either (a) directly mapped to passing test IDs in the truth table above, or (b) explicitly enumerated in `human_verification[]`. PAY-02 / PAY-03 / PAY-04 / PAY-05 each have ≥ 1 passing test ID — see the truth-table evidence column.

## Phase 66 Disposition

Per Plan 66-04 Step 1 STOP directive ("If ANY command exits non-zero or shows a `failed` count > 0, STOP. Set the doc's `status:` to `gaps_found`, populate `gaps_remaining[]`, write the doc, but DO NOT run Task 2's manager-flag flip"):

- The web component test command failed (1 of 5 suites fails to LOAD, 28/28 of the loaded tests pass).
- This failure is NOT a Phase 57 / 66 implementation gap — the country-compliance-section component itself is unchanged and its tests assert its render correctly. The failure is a Phase 62 zugferd-de module-load regression in the @contractor-ops/validators barrel (TypeError: 'The URL must be of scheme file' raised at packages/einvoice/src/profiles/zugferd-de/invoice-template.tsx:35) which is also documented as pre-existing baseline noise in `56-VERIFICATION.md` (R-07 / R-09 / R-10 / R-11) by the concurrent Phase 67 verification pass.
- Following the strict STOP directive: status set to `gaps_found`; the manager-flag flip via `gsd-sdk query phase complete 57` is NOT executed by this commit; the gap is surfaced as STATE.md Pending Todo for a future Phase 62 polish phase to address.
