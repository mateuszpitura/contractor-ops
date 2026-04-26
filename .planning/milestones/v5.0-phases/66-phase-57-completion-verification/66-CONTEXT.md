# Phase 66: Phase 57 Completion & Verification - Context

**Gathered:** 2026-04-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Formally close out Phase 57 (Government API Clients) by:

1. **Re-running** the Plan 57-04 acceptance commands (typecheck + targeted test suites) on the current `v2` HEAD so the evidence in the verification doc matches today's tree, not the snapshot in `57-04-SUMMARY.md`.
2. **Fixing** 3 pre-existing failures in `packages/api/src/routers/__tests__/contractor.test.ts` (archive / updateLifecycleStage INACTIVE / bulkArchive) caused by `da74861e refactor: deep lint cleanup` — the lint cleanup added `contract.count` / `contract.groupBy` calls to the archive mutations, but the mock Prisma harness was never extended.
3. **Replacing** Plan 57-04 Task 3's 9 interactive operator scenarios with deterministic MSW-driven vitest equivalents so PAY-03/04/05 acceptance no longer requires HMRC sandbox credentials or a human operator.
4. **Producing** `57-VERIFICATION.md` — a hybrid (programmatic + flagged manual-gap) artifact confirming PAY-02 (UK VAT rates), PAY-03 (HMRC validation), PAY-04 (DE VAT + Kleinunternehmer), PAY-05 (VIES validation) are delivered.

Out of scope: any new feature work, schema migrations, UI changes beyond what's needed to make MSW scenarios drive existing components, broader test-infra refactors that aren't required to fix the 3 named failures, Phase 67 work (Phase 56 + 58 verification).

</domain>

<decisions>
## Implementation Decisions

### Scope (D-01 .. D-05)
- **D-01:** Three-stream comprehensive scope — (a) re-run Plan 57-04 acceptance evidence, (b) fix 3 pre-existing `contractor.test.ts` failures, (c) replace Task 3 manual scenarios with MSW programmatic equivalents — then (d) write `57-VERIFICATION.md`. Verification depends on (a)+(b)+(c) producing clean signal.
- **D-02:** No new Phase 57 feature work. Implementation per `57-04-SUMMARY.md` is treated as complete; D-04 below mandates re-validation of that claim before signing off.
- **D-03:** Drop any remediation step at planning time if a recent commit on `v2` already resolved the underlying issue (matches Phase 65 D-04 pattern). Specifically check whether `da74861e` follow-up commits already extended the mock harness or added `contract.count` / `contract.groupBy` mocks.
- **D-04:** Re-validation pass at planning time — run `pnpm --filter @contractor-ops/api test --run contractor.test invoice.test gov-api-clients` and `pnpm --filter @contractor-ops/api typecheck` before plan creation, so the plan reflects current truth not the 2026-04-13 snapshot in `57-04-SUMMARY.md`.
- **D-05:** Phase 67 (Phase 56 + 58 verification) is explicitly out of scope. Any verification work surfacing for those phases gets noted in `<deferred>`.

### Test fix stream (D-06 .. D-08)
- **D-06:** The 3 failing tests live at `packages/api/src/routers/__tests__/contractor.test.ts` and break on `ctx.db.contract.count` and `ctx.db.contract.groupBy` not existing in the mock harness. Root cause is `da74861e refactor: deep lint cleanup` adding those calls to archive mutations without updating the test harness.
- **D-07:** Fix at the test harness layer (`makePrisma` or whichever shared helper builds `ctx.db` for these router tests). Add `contract.count` + `contract.groupBy` mock fns. Existing test bodies should not need to change beyond adding return-value setup where the assertion requires it.
- **D-08:** Verify after fix that ALL `contractor.test.ts` tests pass green AND that no other router tests broke from the harness change. If the harness change ripples into other suites, scope broadens minimally to make those green too — no other test logic changes.

### MSW scenario replacement stream (D-09 .. D-12)
- **D-09:** Plan 57-04 Task 3 lists 9 operator scenarios: HMRC happy path, HMRC sad path, D-07 trigger 1 profile-save flow, VIES soft-fail (D-08 graceful degradation), GB rate preselect, DE rate preselect, Kleinunternehmer forced KU, RC auto-detect + override, UK RC footer + accessibility spot-check. Each becomes a deterministic vitest test driving the existing components/routers through MSW handlers.
- **D-10:** Reuse existing MSW handlers from `@contractor-ops/test-utils`. Per `57-04-SUMMARY.md` Task 1, MSW handlers for HMRC + VIES already cover happy/sad/outage paths from Plans 57-01..57-03.
- **D-11:** Tests live alongside their domain — router-flow scenarios in `packages/api/src/routers/__tests__/`, UI-driven scenarios (RC override reason, KU footer rendering, stale-pill display) in the matching `apps/web/src/components/.../__tests__/` files. Do NOT create a single mega-test file; co-locate.
- **D-12:** Accessibility spot-check (Task 3 scenario 9) becomes a vitest test using `@testing-library/jest-dom` + `axe-core` or whichever a11y matcher the codebase already uses. If no a11y test infra exists yet, this scenario stays manual-only with clear note in 57-VERIFICATION.md (do not add new infra in this phase).

### HMRC sandbox blocker (D-13 .. D-14)
- **D-13:** HMRC dev-hub registration / sandbox credentials remain pending — but with D-09 MSW replacements, no Phase 66 closure step depends on them. Provisioning continues independently and unblocks pre-deploy ops work; it is NOT a Phase 66 gate.
- **D-14:** `57-VERIFICATION.md` records HMRC production-onboarding (the 2-week dev-hub registration) as a "Pre-Deploy Manual-Only Verification" item with the same disposition pattern STATE.md uses for legal/regulatory verification (deferred until pre-deploy). Distinguish clearly: PAY-02..05 functional acceptance is GREEN via MSW; HMRC live-credential exercise is PENDING ops.

### Verification artifact (D-15 .. D-18)
- **D-15:** `57-VERIFICATION.md` follows the existing project verification frontmatter pattern (matches `63-VERIFICATION.md` shape: `phase`, `verified`, `status`, `score`, `gaps[]`, `manual_only[]`).
- **D-16:** Status set to `verified` only when (a) the 3 fixed contractor.test.ts cases pass, (b) all 9 MSW scenario tests pass, (c) all D-04 re-run commands report 100% green within phase-57 scope, (d) PAY-02..05 each have an explicit row mapping to test IDs that pass.
- **D-17:** Hybrid evidence model — Programmatic section captures grep + test results with command output excerpts; Manual-Only section explicitly lists HMRC live sandbox exercise (per D-14) as deferred-pre-deploy. No silent omissions.
- **D-18:** After 57-VERIFICATION.md commits, also flip Phase 57's `roadmap_complete` and `has_verification` flags via `gsd-sdk` so the manager dashboard shows Phase 57 as fully verified.

### Commit atomicity (D-19 .. D-20)
- **D-19:** One commit per discrete unit of work, mirroring Phase 65 convention: `fix(66-NN): <summary>` for code/test changes, `docs(66): <summary>` for verification artifact. Expected commits: harness extension fix, MSW scenario tests (likely 2-3 commits if router/UI tests split), 57-VERIFICATION.md write, manager-flag flip.
- **D-20:** Each plan-level commit must satisfy the per-plan gate from Phase 65 D-11: `pnpm --filter @contractor-ops/api typecheck` clean + new tests pass + existing tests not regressed. No `--no-verify`.

### Claude's Discretion
- Exact mock-harness API shape (whether `contract.count` / `groupBy` are vi.fn() returning a default, or full `mockResolvedValue` patterns) — match whichever pattern the existing harness already uses for sibling models like `invoice.count`.
- Whether the 9 MSW scenarios become 9 vitest cases or some merge logically (e.g., GB-preselect + DE-preselect could share a parameterized test). Optimize for clarity, not test count.
- Format of the Pre-Deploy Manual-Only section in 57-VERIFICATION.md — text matching whichever pattern the project's existing VALIDATION.md `Manual-Only Verifications` section uses.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source of truth — Phase 57 acceptance
- `.planning/phases/57-government-api-clients/57-04-PLAN.md` — Wave 4 plan with 9-scenario Task 3, must_haves truths, acceptance criteria, artifact paths. The verification matrix derives from `must_haves.truths` here.
- `.planning/phases/57-government-api-clients/57-04-SUMMARY.md` — What actually shipped per Plan 57-04 (code paths, test counts, deferrals). Use as baseline for D-04 re-run; do NOT trust uncritically — re-evidence is the point.
- `.planning/phases/57-government-api-clients/57-VALIDATION.md` — Approved nyquist contract for Phase 57. Verification status flips after Phase 66 closes.
- `.planning/phases/57-government-api-clients/57-CONTEXT.md` — Phase 57 implementation decisions (D-01..D-14: credentials, freshness, rate seeding, RC auto-detect rules, KU regelung). Implementation must remain consistent with these.
- `.planning/ROADMAP.md` §"Phase 66: Phase 57 Completion & Verification" — Success criteria + dependency declaration.

### Requirements being verified
- `.planning/REQUIREMENTS.md` — Look up PAY-02 (UK VAT rates), PAY-03 (HMRC validation), PAY-04 (DE VAT + Kleinunternehmer), PAY-05 (VIES validation). These four IDs are the verification lens.

### Files exercised by verification
- `packages/api/src/routers/contractor.ts` — `validateVat` (line 1348), `revalidateVat` (line 1409), `update` D-07 trigger 1.
- `packages/api/src/routers/organization.ts` — `setKleinunternehmer` (line 108).
- `packages/api/src/routers/invoice.ts` — upsertLine pipeline: default rate preselect → RC detect → KU override → reason audit.
- `packages/api/src/gov-api-clients.ts` — `getHmrcVatClient`, `getViesClient` factories with production-VRN guard.
- `apps/web/src/components/contractors/vat-validation-status-pill.tsx` — Stale + valid + invalid display.
- `apps/web/src/components/contractors/revalidate-vat-button.tsx` — Manual revalidation entry point.
- `apps/web/src/components/contractors/country-compliance-section.tsx` — Inline VAT pill + revalidate composition for GB/DE.
- `apps/web/src/components/invoices/reverse-charge-line-toggle.tsx` — RC override + reason capture.
- `apps/web/src/components/invoices/invoice-footer-legal-notices.tsx` — Locked-phrase rendering for KU + RC notices.
- `apps/web/src/components/invoices/reverse-charge-banner.tsx` — RC banner display.
- `apps/web/src/components/organization/kleinunternehmer-toggle.tsx` — DE-only toggle gate.
- `packages/validators/src/legal/de.ts` — Locked-phrase constants (TAX_KLEINUNTERNEHMER_NOTICE, TAX_STEUERSCHULDNERSCHAFT, etc).
- `apps/web/messages/{en,de,pl,ar}.json` — i18n strings under `contractor.vatValidation`, `organization.kleinunternehmer`, `invoice.reverseCharge`.

### Test homes (where MSW scenario tests + harness fix land)
- `packages/api/src/routers/__tests__/contractor.test.ts` — Hosts the 3 mock-harness fix targets AND new validateVat/revalidateVat MSW scenarios.
- `packages/api/src/routers/__tests__/invoice.test.ts` — GB/DE rate preselect, KU forced override, RC auto-detect MSW scenarios.
- `packages/api/src/routers/__tests__/organization.test.ts` — setKleinunternehmer MSW scenario (if not already covered).
- `packages/api/src/routers/__tests__/gov-api-clients.test.ts` — Production-VRN guard verification.
- `apps/web/src/components/contractors/__tests__/vat-validation-status-pill.test.tsx` — Stale UI scenario.
- `apps/web/src/components/contractors/__tests__/revalidate-vat-button.test.tsx` — Manual revalidate flow.
- `apps/web/src/components/invoices/__tests__/reverse-charge-line-toggle.test.tsx` — Override-with-reason flow.
- `apps/web/src/components/invoices/__tests__/invoice-footer-legal-notices.test.tsx` — Locked-phrase footer rendering.

### Project-level standing constraints
- `.planning/STATE.md` §"Standing Project Constraints" — Local-only deploy + legal/regulatory verification deferred. Applies: HMRC live sandbox credentials are pre-deploy ops infrastructure, not a Phase 66 closure gate.
- `.planning/STATE.md` §"Blockers/Concerns" — Confirms HMRC dev-hub registration is a tracked multi-week pre-existing blocker; D-13/14 honor this, do not re-litigate.
- `.planning/PROJECT.md` Key Decisions — Re-read before planning to avoid contradiction.

### Pattern reference (consistency)
- `.planning/phases/65-phase-63-critical-bug-fixes/65-CONTEXT.md` — Sibling gap-closure phase. Same conventions: comprehensive scope, atomic commits per fix, regression tests use real Prisma not mocked-broken-shapes, per-plan typecheck+test gate, hybrid VERIFICATION.md.
- `.planning/phases/63-uk-payments-financial-features/63-VERIFICATION.md` — Reference shape for `57-VERIFICATION.md` frontmatter and gaps[]/manual_only[] structure.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **MSW handlers for HMRC + VIES** — Already provisioned in `@contractor-ops/test-utils` per Plan 57-01 + 57-02. Cover happy/sad/outage paths. D-09's 9 scenarios drive these handlers, not new ones.
- **Existing test harness for `ctx.db`** — Used across all router tests. Mock layer is the right surface for D-07 fix; do NOT introduce a real test DB or pg-mem just for these 3 cases.
- **`tenantProcedure` + `where: {organizationId}` enforcement** — Already in place per `57-04-SUMMARY.md` Threat T-57-04-01. MSW scenarios should exercise the negative path (cross-org → NOT_FOUND) once for evidence, not 9 times.
- **`@testing-library/jest-dom` matchers** — Standard across `apps/web/.../__tests__/`. UI-driven MSW scenarios use these.
- **`locked-phrases-guard` test** (32/32 green per Phase 57 summary) — Already protects locked legal phrases. Don't duplicate; reference it in 57-VERIFICATION.md as evidence for PAY-04 phrase invariants.

### Established Patterns
- **One commit per atomic change** — `fix(NN-MM): <summary>` (set in Phase 65). Phase 66 mirrors.
- **Mock Prisma harness is shared** — Multiple router tests build `ctx.db` from the same factory. Extending it for `contract.count` / `contract.groupBy` is a one-touch fix that ripples positively.
- **Phase 57 D-08 graceful soft-fail** — VIES outage → return last successful validation with `responseStatus='stale'`. MSW scenario for VIES soft-fail must drive THIS path, not a hard-error path.
- **Locked-phrase identifiers imported from `@contractor-ops/validators`, never `messages/*.json`** — Per Phase 57 D-12. PAY-04 footer evidence in 57-VERIFICATION.md must cite the validators import path, not the i18n file.
- **VALIDATION.md vs VERIFICATION.md distinction** — VALIDATION.md is the per-phase nyquist test contract (Phase 57 has one, approved). VERIFICATION.md is goal-backward proof that the phase delivers its REQUIREMENTS.md IDs. This phase produces the latter.

### Integration Points
- **No DB migration risk** — All schema changes happened in Phase 57 (TaxIdValidation model, Organization.isKleinunternehmer, Contractor summary fields). Phase 66 reads only.
- **No tRPC API surface change** — Existing mutations are the verification target. Adding tests does not change the API.
- **Manager dashboard reflects Phase 57 closure** — D-18 flag flip; `gsd-sdk query roadmap.set-complete 57` (or equivalent) after VERIFICATION.md commits.
- **Phase 65 background planner overlap** — Phase 65 background planner is touching `packages/api/src/routers/late-payment-interest.ts`, `skonto.ts`, `admin-boe-rate.ts`. Phase 66 touches `contractor.ts`, `invoice.ts`, `organization.ts`, `gov-api-clients.ts`. No file overlap; no merge risk.

</code_context>

<specifics>
## Specific Ideas

- "Per `57-04-SUMMARY.md`, the 3 contractor.test failures are pre-existing from `da74861e refactor: deep lint cleanup`, not Phase 57's fault" — but Phase 66 explicitly takes the fix because closing Phase 57 verification cleanly is impossible while red tests sit in the same router file. Document this clearly in commit message + verification doc.
- The MSW scenarios are Phase 66's substitute for HMRC dev-hub registration — that registration was always going to happen pre-deploy, not pre-merge. The MSW work permanently changes the gate from "operator + HMRC sandbox" to "deterministic CI" for PAY-03/05 acceptance.
- Verification doc style mirrors `63-VERIFICATION.md` — use the same frontmatter shape so tooling that consumes verification artifacts works uniformly across phases.
- The 9-scenario list in `57-04-PLAN.md` Task 3 IS the phase 66 plan checklist — every scenario maps to one (or one parameterized) MSW test. Don't re-imagine the scenario set; copy it.

</specifics>

<deferred>
## Deferred Ideas

- **HMRC production onboarding** — 2-week dev-hub registration; STATE.md tracked. Belongs to pre-deploy ops, not any phase. Phase 66 explicitly removes it as a verification gate (D-13/14).
- **Phase 67 work (Phase 56 + 58 verification)** — Out of scope per ROADMAP.md.
- **a11y test infrastructure** — If the codebase has no axe-core / similar matcher, the Task 3 scenario-9 a11y spot-check stays manual-only (D-12). Adding a11y test infra is its own infrastructure phase.
- **Real Prisma test harness across packages/api** — The mocked-Prisma pattern is a known anti-pattern (see Phase 65 D-07 + Phase 66 D-07). Repo-wide migration to a real-DB harness is a separate test-infra phase.
- **VALIDATION.md vs VERIFICATION.md template unification** — There's drift across phases. Consolidating the two artifact shapes into a single canonical template is a future docs/tooling phase, not Phase 66.
- **Manager-flag automation** — D-18 manually flips `roadmap_complete` / `has_verification` for Phase 57. Auto-flipping these from VERIFICATION.md presence is a tooling improvement to gsd-sdk.

### Reviewed Todos (not folded)
None — `.planning/STATE.md` "Pending Todos" was empty at gather time.

</deferred>

---

*Phase: 66-phase-57-completion-verification*
*Context gathered: 2026-04-26*
