# Phase 67: Phase 56 & 58 Verification - Context

**Gathered:** 2026-04-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Produce two parallel verification artifacts for already-shipped foundation phases:

1. **`56-VERIFICATION.md`** — confirms FOUND-01..FOUND-06 are satisfied (UK/DE contractor profile fields validate per country, German i18n routing works, jurisdiction-appropriate privacy/GDPR notices render).
2. **`58-VERIFICATION.md`** — confirms CLASS-01, CLASS-02, CLASS-05, CLASS-11 are satisfied (classification engine accepts per-country rule sets, IR35 5-area scoring + DRV 20-criteria scoring produce correct outcomes, per-engagement assessment storage is independent).

Out of scope: any new feature work, schema migrations, UI changes, broader test-infra refactors not required to make verification produce clean signal, retroactive remediation of pre-existing issues that need investigation rather than a one-touch fix, Phase 56 STEUERBERATER legal sign-off (Pre-Deploy Manual-Only).

</domain>

<decisions>
## Implementation Decisions

### Stream structure (D-01 .. D-04)
- **D-01:** Two parallel plans: `67-01-PLAN.md` covers Phase 56 verification + writes `56-VERIFICATION.md`; `67-02-PLAN.md` covers Phase 58 verification + writes `58-VERIFICATION.md`. Plans are independent and execute in the same wave (wave 1).
- **D-02:** No final "consolidation plan" — each verification artifact stands on its own. Cross-phase invariants (e.g. classification depends on Phase 56 country fields) are captured as explicit reads in the relevant 58-VERIFICATION row, not as a third plan.
- **D-03:** Both plans MUST land before Phase 67 closes — partial closure (e.g. only 56-VERIFICATION.md committed) is not a valid Phase 67 state.
- **D-04:** Manager-flag flips for both Phase 56 and Phase 58 (`roadmap_complete`, `has_verification`) happen at the end of their respective plans, not as a Phase 67 epilogue.

### Re-validation gate (D-05 .. D-07)
- **D-05:** Mirror Phase 66 D-04: re-run all Phase 56 + Phase 58 acceptance commands on current `v2` HEAD before writing the verification doc. Drop any remediation step from the plan if intervening commits already resolved it. Phase 65 D-04 just demonstrated this pattern saves work — 7 enumerated bugs reduced to 2 because 5 were already closed.
- **D-06:** Re-run commands to source from each phase's SUMMARY files: `56-01-SUMMARY.md` through `56-08-SUMMARY.md` for Phase 56, `58-01-SUMMARY.md` through `58-05-SUMMARY.md` for Phase 58. Each SUMMARY's "Verification Results" section names the exact test commands to re-run.
- **D-07:** Re-run results captured directly into the verification doc Programmatic Evidence section with command + pass/fail + count (e.g. `pnpm --filter @contractor-ops/api test --run classification` → 36/36 passed). Do NOT just say "tests pass" — cite the run on `v2` HEAD with hash.

### Steuerberater / legal disposition (D-08 .. D-10)
- **D-08:** Phase 56's `56-STEUERBERATER-REVIEW.md` legal sign-off is NOT a Phase 67 closure gate. Per STATE.md "Standing Project Constraints" section, legal/regulatory verification is DEFERRED for the local-only deploy posture; same disposition pattern as Phase 66 D-14 used for HMRC sandbox provisioning.
- **D-09:** `56-VERIFICATION.md` flips to `status: verified` when programmatic FOUND-01..06 evidence is green. Steuerberater sign-off recorded in a separate `manual_only[]` row with disposition `pre_deploy_legal_review` and a link to `.planning/phases/56-country-foundations-german-i18n/56-STEUERBERATER-REVIEW.md`.
- **D-10:** Same pattern for Phase 58 — German DRV terminology / Scheinselbstandigkeit legal review (if any review file exists or future review is anticipated) goes into `manual_only[]`. The classification engine being feature-flag-gated by Phase 64 already covers the runtime safety story; Phase 67's job is verification of the engine, not its rollout policy.

### Adjacent-gap handling (D-11 .. D-13)
- **D-11:** If re-validation surfaces broken tests / type errors / schema drift that block clean signal, fix inline in the same Phase 67 plan IF the fix is one-touch (single mock-harness extension, single typo, single import-path correction). Mirror Phase 66 D-07 (mock harness extension for `contract.count` / `contract.groupBy`).
- **D-12:** If a fix needs investigation (root-cause unclear, ripples across multiple files, or requires schema migration), DO NOT fix in Phase 67 — record in the relevant VERIFICATION.md as a `gaps[]` row, set verification `status` to `gaps_found`, open a follow-up phase (Phase 68 or backlog 999.x) for the fix work. Phase 67's status remains `gaps_found` for that requirement until follow-up closes it.
- **D-13:** Each one-touch fix lands as its own atomic commit `fix(67-NN): <summary>` referencing the requirement ID it unblocks (e.g. `fix(67-01): extend i18n test harness for FOUND-03 evidence`). Do NOT batch unrelated fixes into a single commit.

### Verification artifact format (D-14 .. D-17)
- **D-14:** Both `56-VERIFICATION.md` and `58-VERIFICATION.md` follow the existing `63-VERIFICATION.md` frontmatter shape: `phase`, `verified` (ISO timestamp), `status` (`verified` | `gaps_found`), `score` (`N/M must-haves verified`), `gaps[]`, `manual_only[]`. Same shape as `66-CONTEXT.md` D-15 prescribes for `57-VERIFICATION.md`.
- **D-15:** Each requirement (FOUND-01..06, CLASS-01/02/05/11) gets an explicit row in a `requirements_verified[]` table mapping requirement-ID → list of test IDs that prove it + commit hashes producing the evidence.
- **D-16:** `manual_only[]` rows MUST have a `disposition` field (`pre_deploy_legal_review` | `pre_deploy_ops` | `pre_deploy_manual_qa`) so downstream tooling and audits can group items by closure type. New value `pre_deploy_legal_review` is introduced in Phase 67 (Phase 66 used `pre_deploy_ops` for HMRC).
- **D-17:** No `gaps_remaining` field if `status: verified` — verified means zero gaps; presence of gaps forces `status: gaps_found`. Distinguish from `manual_only[]` which is deferred-not-blocking and does not affect status.

### Commit atomicity (D-18 .. D-19)
- **D-18:** Per-plan commits: `docs(67-01): write 56-VERIFICATION.md`, `docs(67-02): write 58-VERIFICATION.md`. Adjacent fixes (per D-13) land BEFORE the corresponding `docs(67-NN)` commit so the docs reference the post-fix state.
- **D-19:** Per-plan execution gate inherits Phase 65 D-11 / Phase 66 D-20: `pnpm --filter <changed-package> typecheck` clean + new tests pass + no regression in existing tests. No `--no-verify`.

### Claude's Discretion
- Format of the `requirements_verified[]` table (markdown table vs YAML list) — pick whichever the existing `63-VERIFICATION.md` uses
- Granularity of test-ID citations (suite-level "all green" vs per-test ID) — match the precision of the requirement claim being made
- Whether IR35 + DRV scoring evidence is one row per requirement or per (requirement × country) — pick the framing that maps cleanly to existing test files

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source of truth — what's being verified
- `.planning/REQUIREMENTS.md` — Look up FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06, CLASS-01, CLASS-02, CLASS-05, CLASS-11. These ten IDs ARE the verification lens.
- `.planning/ROADMAP.md` §"Phase 67: Phase 56 & 58 Verification" — Success criteria + dependency declaration.

### Phase 56 (FOUND verification target)
- `.planning/phases/56-country-foundations-german-i18n/56-CONTEXT.md` — Phase 56 implementation decisions; verification must remain consistent with these.
- `.planning/phases/56-country-foundations-german-i18n/56-VALIDATION.md` — Phase 56 nyquist contract; re-run commands derive from here + each SUMMARY.
- `.planning/phases/56-country-foundations-german-i18n/56-01-SUMMARY.md` through `56-08-SUMMARY.md` — Per-plan acceptance evidence; D-06 sources the re-run commands from each SUMMARY's "Verification Results" section.
- `.planning/phases/56-country-foundations-german-i18n/56-STEUERBERATER-REVIEW.md` — Legal review artifact; D-08/D-09 reference this in `manual_only[]` with disposition `pre_deploy_legal_review` (do NOT block verification on it).
- `.planning/phases/56-country-foundations-german-i18n/deferred-items.md` — Phase 56 deferred items; cross-check that nothing here is mis-attributed to FOUND-01..06.

### Phase 58 (CLASS verification target)
- `.planning/phases/58-classification-engine-rule-sets/58-CONTEXT.md` — Phase 58 implementation decisions.
- `.planning/phases/58-classification-engine-rule-sets/58-VALIDATION.md` — Phase 58 nyquist contract.
- `.planning/phases/58-classification-engine-rule-sets/58-01-SUMMARY.md` through `58-05-SUMMARY.md` — Per-plan acceptance evidence; D-06 sources the re-run commands from these.
- `.planning/phases/58-classification-engine-rule-sets/58-RESEARCH.md` — Background on IR35 5-area + DRV 20-criteria scoring; verification rows reference this for scoring rationale.

### Cross-phase invariants
- `.planning/phases/64-legal-compliance-hardening/64-CONTEXT.md` — Phase 64 added the feature-flag gating around classification (Phases 58-60). Phase 58 verification must NOT contradict Phase 64's "completely inaccessible when flag disabled" invariant.
- `.planning/phases/63-uk-payments-financial-features/63-VERIFICATION.md` — Reference shape for `56-VERIFICATION.md` and `58-VERIFICATION.md` frontmatter, gaps[] / manual_only[] structure.

### Pattern reference (sibling phases)
- `.planning/phases/65-phase-63-critical-bug-fixes/65-CONTEXT.md` — Sibling gap-closure phase. Same conventions: comprehensive scope from VERIFICATION.md gaps, atomic commits per fix, per-plan typecheck+test gate. Phase 65 D-04 is the canonical re-validation pattern that D-05 inherits.
- `.planning/phases/66-phase-57-completion-verification/66-CONTEXT.md` — Sibling verification phase. D-13/D-14 (HMRC manual-only deferral) is the precedent for D-08/D-09 (Steuerberater manual-only deferral). D-15..D-17 verification artifact format inherits Phase 66's hybrid pattern.

### Project-level standing constraints
- `.planning/STATE.md` §"Standing Project Constraints" — Local-only deploy + legal/regulatory verification is DEFERRED. The single most-cited constraint in this CONTEXT.md (D-08, D-09).
- `.planning/STATE.md` §"Decisions" — Recent classification-related decisions (e.g. classification stored per-engagement, German legal terminology locked as code constants) — verification rows for CLASS-XX must remain consistent.
- `.planning/PROJECT.md` Key Decisions — Re-read before planning to avoid contradiction.

### Code under verification
- `packages/classification/` — Classification engine + IR35 + Scheinselbstandigkeit profiles. CLASS-01 (engine accepts rule sets), CLASS-02 (per-country rule sets), CLASS-05 (scoring outcomes) trace here.
- `packages/api/src/routers/classification.ts` — Classification tRPC router. CLASS-11 (per-engagement assessment storage) traces through this.
- `packages/db/prisma/schema.prisma` — `Contractor`, `Organization`, `ClassificationAssessment`, `TaxIdValidation` models. FOUND-01..06 + CLASS-11 verification reads schema fields here.
- `apps/web/messages/de.json` — German i18n for FOUND-03 (German routing) + privacy notice rendering for FOUND-05/06.
- `apps/web/src/app/[locale]/` — i18n routing structure. FOUND-03 evidence reads route map here.
- `packages/validators/src/legal/de.ts` — Locked German legal phrases (Phase 56 D-05). FOUND-05/06 + CLASS-XX legal-text invariants reference these constants.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Existing test suites for both phases** — Phase 56 + Phase 58 already have full test coverage per their SUMMARY files. Verification re-runs the existing suites; does not author new tests EXCEPT where adjacent-gap fixes (D-11) add a regression test.
- **`63-VERIFICATION.md` and `66-CONTEXT.md` D-15..D-17** — Provide the canonical artifact shape. Both 56-VERIFICATION.md and 58-VERIFICATION.md inherit it.
- **`makePrisma` test harness (Phase 66 D-07 will extend)** — If Phase 66 lands first, the harness with `contract.count` / `contract.groupBy` is available; if Phase 67's re-validation surfaces a similar gap in Phase 56/58 test suites, the same extension pattern applies (or the existing extension already fixed it).
- **Locked-phrases-guard test** (32/32 green per Phase 57 summary; expanded by Phase 58) — Already protects German legal phrases. CLASS-XX evidence cites this rather than re-deriving phrase invariants.

### Established Patterns
- **One verification artifact per phase being verified** — Phase 67 produces TWO artifacts (one per parent phase); Phase 66 produced ONE. Manager-dashboard `has_verification` flag flips per artifact independently.
- **Re-validation captures live `v2` HEAD evidence** — Phase 65 D-04 + Phase 66 D-04 + Phase 67 D-05 all share this. SUMMARY snapshots can be weeks stale (Phase 65 demonstrated 5/7 enumerated bugs were already closed).
- **Manual-only items get a `disposition` field** — D-16 introduces `pre_deploy_legal_review` for Steuerberater; Phase 66 used `pre_deploy_ops` for HMRC. Establishes the disposition vocabulary for future verification phases.
- **No `--no-verify` on commits** — D-19 explicit; consistent across Phases 65/66/67.

### Integration Points
- **No DB migration risk** — All Phase 56 + Phase 58 schema changes happened in their respective phases. Phase 67 reads only.
- **No tRPC API surface change** — Existing routers are the verification target. Optional regression tests added for adjacent-gap fixes do not change the API.
- **Manager dashboard reflects Phase 56 + 58 closure** — D-04: per-plan flag flips after each VERIFICATION.md commits. Two phases close, not one.
- **Phase 65 + 66 background planners overlap** — Phase 65 background planner targets `late-payment-interest.ts`, `skonto.ts` (services). Phase 66 background planner targets `contractor.ts`, `invoice.ts`, `organization.ts`, `gov-api-clients.ts`. Phase 67 reads `packages/classification/`, `classification.ts` router, schema, and i18n files — no overlap with the in-flight planners.
- **Feature flag interaction with Phase 64** — Phase 64 gates classification routes behind a flag. CLASS-XX verification must validate the engine works with the flag enabled (test environment) AND remain consistent with Phase 64's "inaccessible when disabled" claim. Tests likely already cover both states; D-12 says do not re-author if existing coverage is sufficient.

</code_context>

<specifics>
## Specific Ideas

- "Phase 65 D-04 just paid off massively — 7 enumerated bugs reduced to 2 after re-validation against v2 HEAD" — this is the load-bearing reason D-05 mandates the same pattern for Phase 67. Trust nothing without re-running.
- The `disposition` field in `manual_only[]` (D-16) is an explicit upgrade over Phase 66's looser shape — codifies the deferral category so future tooling can group items (e.g. "all `pre_deploy_legal_review` items must close before production deploy").
- Phase 67 closes the v5.0 audit-gap closure trio (Phases 65, 66, 67). After Phase 67's two artifacts land + flag flips, every v5.0 phase has a VERIFICATION.md and v5.0 milestone is complete-ready.
- 56-STEUERBERATER-REVIEW.md being on disk already is a positive signal — the review work was done; it just needs a sign-off. Tracking it as `pre_deploy_legal_review` rather than ignoring it preserves the audit trail.

</specifics>

<deferred>
## Deferred Ideas

- **Steuerberater sign-off completion** — pre-deploy ops / legal coordination, not a phase. Tracked in `manual_only[]` with `disposition: pre_deploy_legal_review`.
- **Phase 64 verification** (Legal Compliance Hardening) — Phase 64 has its own SUMMARY and VALIDATION.md but no VERIFICATION.md. Out of scope for Phase 67; could be folded into a future verification-completion phase or run via `/gsd-verify-work 64` ad hoc.
- **Phase 59, 60, 61, 62 verification** — same situation as Phase 64. Out of scope for Phase 67.
- **VALIDATION.md → VERIFICATION.md template unification** — drift across phases. Inherited from Phase 66 deferred ideas; remains future docs/tooling work.
- **`disposition` vocabulary expansion** — D-16 introduces three values (`pre_deploy_legal_review`, `pre_deploy_ops`, `pre_deploy_manual_qa`). A future docs phase could formalize the vocabulary in a project-level reference.
- **Manager-flag automation** — D-04 manually flips per-phase flags; auto-flipping from VERIFICATION.md presence is an inherited gsd-sdk improvement deferred from Phase 66.

### Reviewed Todos (not folded)
None — `.planning/STATE.md` "Pending Todos" was empty at gather time.

</deferred>

---

*Phase: 67-phase-56-58-verification*
*Context gathered: 2026-04-26*
