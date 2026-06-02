# Phase 80: v6.0 Verification + Hardening + Manual UAT - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning

<domain>
## Phase Boundary

The v6.0 milestone-close verification phase (0 requirements — covers all v6.0 surfaces). Mirrors v5.0 Phase 69. Four deliverables:

1. **Cross-feature integration test** proving F1 (compliance) + F3 (Gulf) + F4 (offboarding) compose: one contractor in a UAE free zone with an expiring license + IP-clause `LIKELY_MISSING` + Saudi-national assignment with a Qiwa-auth gap → payment hard-blocked AND offboarding hard-blocked AND Saudization band-trajectory preview shown; every gate fires, every audit row written, locked-phrase guard green.
2. **`80-HUMAN-UAT.md`** — every manual UI UAT scenario across F1/F2/F3/F4 with repro steps, expected behaviour, "post-deploy" disposition (mirrors `63-HUMAN-UAT.md`).
3. **Consolidated post-deploy legal sign-off list** — catalogues every "Needs verification by legal entity" annotation across the milestone, per adviser.
4. **v6.0 retrospective** — dependency play-out, PENDING Unleash flags by namespace + post-deploy approval ticket pointers, plan-completion velocity vs v5.0 baseline.

**Out of scope:** new feature code (this phase verifies + documents only); fixing pre-existing unrelated offenders; actually obtaining legal sign-off (DEFERRED, post-deploy); production perf/load testing (LOCAL-ONLY, no real traffic).

</domain>

<decisions>
## Implementation Decisions

### Cross-feature integration test (Area A)
- **D-01:** **One composed scenario, F1 + F3 + F4** — exactly the SC#1 mega-scenario. F2 IdP is verified at the per-phase + UAT level, NOT folded into this test: F2's `ACCESS_REVOKE` saga runs only AFTER offboarding completes (post final-invoice cooldown), so it cannot compose into a hard-blocked-offboarding path. No composition matrix.
- **D-02:** The single test must assert, in one run: payment hard-block (free-zone license EXPIRED, BLOCKING), offboarding hard-block (IP-clause `LIKELY_MISSING` ratification gate), Saudization band-trajectory advisory render, every expected `writeAuditLog` row, and a green locked-phrase guard.

### Test layer + location (Area B)
- **D-03:** **vitest integration test in `packages/api`** — exercises DB + tRPC procedures + cron/services with MSW for any IdP/gov-API edges, seeded via the existing `seed-dev` fixtures. Matches how F1/F4 gates are already tested; cheap in CI. NOT a Playwright/E2E browser harness (heavy, overlaps the manual-UAT scope this phase also produces).

### "Hardening" deliverable (Area C)
- **D-04:** Hardening = **milestone-wide re-run of all v6.0 gates + dependency/security scan, documented**: `lint:audit-log`, `lint:raw-sql`, `lint:logs`, `lint:silent-catch`, `lint:schema`, `i18n:parity`, `db:audit-enum-casing`, `check:web-vite-{data-layer,page-shells,presentational,table-pattern,dialog-pattern}`, plus `pnpm audit` + `pnpm security:scan`. Record results in the retrospective/verification output. **No dedicated perf/load pass** (LOCAL-ONLY, no prod traffic).

### Doc structure (Area D)
- **D-05:** **Three separate docs**, mirroring the v5.0 Phase 69 structure:
  - `80-HUMAN-UAT.md` — manual UI UAT scenarios across F1/F2/F3/F4 (mirrors `63-HUMAN-UAT.md`).
  - `80-LEGAL-SIGNOFF.md` — consolidated post-deploy legal sign-off list, **one section per adviser**: DE Steuerberater (§48b EStG / A1 / Aufenthaltstitel / Werkvertrag IP wording), UK tax/legal (Border Security Act, IR35/ITEPA), UAE legal (free-zone permitted-activity catalogues), KSA MOL/HRSD + legal (Saudization rates, Iqama + Qiwa-auth flow).
  - `80-RETROSPECTIVE.md` — dependency play-out, PENDING flags by namespace + ticket pointers, velocity vs v5.0.

### Claude's Discretion
- Exact integration-test fixture/seed shape + which existing `seed-dev` helpers to reuse.
- How the locked-phrase guard is asserted inside the test (reuse existing guard vs inline check).
- Retrospective velocity metric computation (plans/day vs v5.0 baseline source).
- Whether `80-LEGAL-SIGNOFF.md` cross-links each item back to its origin SUMMARY/VALIDATION "Needs verification by legal entity" annotation, or restates inline.
- Which UAT scenarios are net-new vs already captured in per-phase HUMAN-UAT/VALIDATION docs (dedup vs re-list).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements + roadmap
- `.planning/ROADMAP.md` "Phase 80: v6.0 Verification + Hardening + Manual UAT" — 4 success criteria (source of truth). SC#1→D-01/D-02; SC#2→D-05 (UAT); SC#3→D-05 (legal); SC#4→D-05 (retrospective).
- `.planning/STATE.md` "Standing Project Constraints" — LOCAL-ONLY, legal review DEFERRED (legal items are post-deploy, never hard-block); the full lint/biome/db gate list (D-04 re-runs these).
- `.planning/REQUIREMENTS.md` — Phase 80 has 0 requirements; it verifies all v6.0 GULF/COMPL/IDP/OFFB surfaces.

### v5.0 precedent to mirror
- `.planning/milestones/v5.0-phases/63-*/63-HUMAN-UAT.md` (and `60-`, `62-HUMAN-UAT.md`) — exact `80-HUMAN-UAT.md` format.
- v5.0 Phase 69 retrospective + milestone-close artifacts — `80-RETROSPECTIVE.md` shape.

### Existing verification scaffolding
- `.planning/reports/integration-verification.md` — possible starting point for the cross-feature test plan.
- `.planning/reports/N10-integration-response-zod-plan.md`, `TEST-GAP-AUDIT.md`, `CODE-OPTIMIZATION-AUDIT-2026-05-31.md` — prior audit context.

### Feature surfaces under verification (per-phase CONTEXT/SUMMARY are the detail source)
- F1: phases 71–73 (`ContractorComplianceItem`, reminder cron, payment-block, dashboard).
- F2: phases 76–78 (IdP saga, GWS/Slack/Entra/Okta/GitHub adapters) — UAT-level coverage.
- F3: phase 79 (`79-CONTEXT.md`) — Gulf free-zone + Saudization + Arabic/RTL; the integration test's F3 leg.
- F4: phases 74–75 (offboarding workflow, IP-verification gate, credential vault).

### Test infrastructure
- `packages/db/scripts/seed-dev.ts` — fixture seeds (contractors, assignments, compliance items, workflow templates) for the integration test.
- `packages/test-utils/src/msw/` — MSW templates for IdP/gov-API edges.
- Existing v6.0 CI gate scripts (package.json `lint:*`, `check:web-vite-*`, `i18n:parity`, `db:audit-enum-casing`, `security:scan`) — D-04 re-runs.

### PENDING flag inventory (retrospective SC#4)
- `packages/feature-flags/src/signoff-registry.json` + `registry.ts` — all PENDING v6.0 namespaces (compliance, idp-deprovisioning-*, gulf-*) with their post-deploy approval pointers.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`seed-dev.ts`** fixtures — build the composed contractor (UAE free-zone + expiring license + IP-missing + Saudi/Qiwa-gap assignment) for the integration test.
- **MSW templates** (`test-utils/src/msw`) — stub IdP/gov edges if the test touches them.
- **v6.0 CI gate scripts** — D-04 re-runs them milestone-wide; no new gate code.
- **`63-HUMAN-UAT.md`** — copy-forward format for `80-HUMAN-UAT.md`.
- **signoff-registry** — single source for the PENDING-flag retrospective section.

### Established Patterns
- **vitest integration over E2E** for cross-cutting gate verification (matches F1/F4 test style).
- **Per-jurisdiction legal doc sections** (mirrors v5.0 locked-phrase + sign-off layout).
- **LOCAL-ONLY post-deploy disposition** — UAT + legal items documented, never hard-blocking.

### Integration Points
- New `packages/api` integration test file (cross-feature composition).
- Three planning docs in the phase dir: `80-HUMAN-UAT.md`, `80-LEGAL-SIGNOFF.md`, `80-RETROSPECTIVE.md`.
- Reads (does not modify) every v6.0 feature surface + the signoff registry.

</code_context>

<specifics>
## Specific Ideas

- F2 IdP is deliberately NOT in the composed integration test (its saga runs post-offboarding-completion, off the blocked path) — but it MUST appear in `80-HUMAN-UAT.md`.
- "CRITICAL" framing from F3 maps to the `BLOCKING` severity enum — the test asserts BLOCKING-driven payment block, no CRITICAL enum value.
- No perf pass — LOCAL-ONLY, no production traffic to profile against.
- Legal sign-off is catalogued, not obtained — DEFERRED until LOCAL-ONLY flips.
- This phase depends on Phases 70–79 all shipping; it cannot fully run until Phase 79 is executed.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 80-v6-0-verification-hardening-manual-uat*
*Context gathered: 2026-06-03*
