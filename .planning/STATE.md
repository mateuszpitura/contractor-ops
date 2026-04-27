---
gsd_state_version: 1.0
milestone: v6.0
milestone_name: Platform Maturity & Operational Hardening
status: executing
stopped_at: "Phase 70 complete (10/10 plans); backfill apply deferred to post-deploy"
last_updated: "2026-04-27T00:00:00.000Z"
last_activity: 2026-04-27 — Phase 70 checkpoint cleared; multi-region backfill recorded as deferred post-deploy item
progress:
  percent: 9
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-26 — v6.0 milestone started)

**Core value:** The invoice-to-payment flow must work end-to-end: invoice arrives, gets matched to contract, routed through approval, and batched for payment — with full audit trail.
**Current focus:** v6.0 Platform Maturity & Operational Hardening — close critical operational gaps across PL, UK, DE, UAE, SA. No new market entry.

## Current Position

Phase: 70 — COMPLETE (10/10 plans landed; multi-region backfill deferred to post-deploy)
Plan: — (Phase 70 closed)
Status: Phase 70 shipped end-to-end. Plans 70-09 + 70-10 committed (`9212adf1`, `2a41d142`). The multi-region backfill apply (`tsx packages/db/scripts/backfill-scope-capabilities.ts` against EU + ME) is recorded as a deferred post-deploy item per LOCAL-ONLY Standing Constraint — does NOT block downstream phases. Phase 71 fully planned (7 plans, ready to execute). Phase 76 fully planned (10 plans, ready to execute). Phase 74 context gathered, ready to plan.
Last activity: 2026-04-27 — Phase 70 checkpoint cleared; backfill apply recorded as deferred

Progress: [█░░░░░░░░░] 9% (v6.0 — 1/11 phases complete; Phase 70 done; Phases 71 + 76 plans ready; Phase 74 ready to plan)

**Active Phase:** none (Phase 70 closed)
**Next Phase candidates (parallel-ready):**
- Phase 71 (F1 Compliance — Policy Package + Schema + Classification Reconcile) — 7 plans, depends on 70 ✓
- Phase 76 (F2 IdP — Capability Mixin + Saga + Cooldown + GWS Scope) — 10 plans, depends on 70 ✓ + 74 + 75 (still gated on F4)
- Phase 74 (F4 Offboarding — Workflow Foundation + KT Templates + Override Permission) — discussed, ready for `/gsd-plan-phase 74`

## Phase 76 Planned (2026-04-27)

10 plans across 4 waves; 1 marked `autonomous: false` (Plan 76-02 schema migration — multi-region apply per Plan 70-09 precedent):

| Wave | Plan | Title | autonomous | Requirements |
|------|------|-------|------------|--------------|
| 0 | 76-01 | Failing test scaffolds (19 RED) + new `@contractor-ops/idp-saga` package skeleton + `idp-deprovisioning` PENDING signoff entry | true | All 8 (RED state) |
| 1 | 76-02 | Prisma schema — DeprovisioningRun + DeprovisioningStep + IdpChangeProvenance + ContractorAssignment.endedAt + multi-region usage docs | **false** | IDP-02, 09, 10, 13 |
| 1 | 76-03 | Deprovisionable interface + GWS scope-registry typed-const + IDP_AUDIT_ALLOWED_FIELDS extension (8 new fields) + adapter registry mapping | true | IDP-08, 10, 14 |
| 1 | 76-04 | Saga helpers — canStartDeprovisioning (TZDate via `@date-fns/tz`, reuses Phase 71 D-07 pin) + deriveRunStatus pure function + recomputeRunStatus + provenanceLookup atomic claim + insertProvenance + gcExpiredProvenance | true | IDP-02, 09, 13 |
| 1 | 76-05 | tRPC `getDeprovisioningEligibility` query + audit-log on every call (single-source-of-truth helper consumed by both UI and server-side mutation) | true | IDP-02, 10 |
| 2 | 76-06 | tRPC `startDeprovisioningRun` + `retryDeprovisioningStep` mutations + QStash fan-out + `_step-runner` API route + saga-canonicalize helper for SHA-256 hashes | true | IDP-09, 10 |
| 2 | 76-07 | `pnpm lint:scopes` CI guard (4th sibling in `@contractor-ops/lint-guards`) + ts-morph drift detector + structured-diff format-offence + husky pre-push + CI workflow extension | true | IDP-14 |
| 2 | 76-08 | GWS scope-upgrade flow — additive `getOAuthConfig().scopes` + `prompt=consent` + 3-state reconnect banner (write-access variant) + i18n keys (en/de/pl/ar) + OAuth callback writes `directory.user.write` capability | true | IDP-11 |
| 3 | 76-09 | `GoogleWorkspaceAdapter implements Deprovisionable` — suspendAccount + revokeAllSessions + verifyDeprovisioned + handleWebhook provenance lookup + register-all wires registerDeprovisionableAdapter | true | IDP-08, 13 |
| 3 | 76-10 | D-16 template annotation on GWS deprovision test + GC cron sub-task in reminders/route.ts + SC#7 no-Reactivate-button RTL + grep guard | true | IDP-08, 13, 15 |

**Plan-checker verdict:** PASSED (manual checker run — gsd-plan-checker agent not installed in this environment). All 16 LOCKED CONTEXT decisions (D-01..D-16) addressed; every IDP-{02,08,09,10,11,13,14,15} requirement covered by ≥1 plan beyond Wave 0; Standing Constraint LOCAL-ONLY honoured (legal review DEFERRED, multi-region manual). Threat models (8 plans × ~5 threats), validation strategy (Nyquist with 35-row per-task verification map), Phase 70 dependency hooks (`signoff-registry-flags.json`, `IDP_AUDIT_ALLOWED_FIELDS`, `getIdpAuditLogger`, `scopeCapabilities` JSONB infrastructure, `lint-guards` 4th-sibling extension), and Phase 71 D-07 TZ library convergence (`@date-fns/tz`) all present.

**Key risks identified:**
- Plan 76-02 schema migration is `autonomous: false` — requires manual `npx tsx packages/db/scripts/push-all-regions.ts` against EU + ME databases post-merge.
- Plans 76-07 (`lint:scopes` guard) and 76-08 (GWS scope expansion) are sequenced in Wave 2 such that the guard ships before the GWS adapter import. The plan accepts that 76-07 may be RED-then-GREEN within the brief 76-07-only window before 76-08 lands; the guard itself passes its own unit tests in 76-07.
- Phase 71 is being planned in parallel; both phases reuse `@date-fns/tz` from the Phase 71 D-07 pin. Cross-checked against 71-RESEARCH.md (line 23, 385) — single library, no parallel pin.

**Phase 76 plan artefacts:**

- `76-RESEARCH.md` — schema shapes, TZ library convergence, QStash topology, DeprovisionResult type shape (USER_NOT_FOUND → SUCCEEDED rule + MAX_ATTEMPTS = 3), validation architecture, 10-plan wave shape
- `76-PATTERNS.md` — 18 Phase-76 elements mapped to existing codebase siblings (no new architectural primitives — every D-NN has a precedent: Phase 70 D-13/D-15/D-16, Phase 71 D-07, v5 `recreateDraftAfterDrift`, classification `claimDraft` atomic-update, `late-payment-interest.ts` QStash fan-out)
- `76-VALIDATION.md` — 35 verification rows across 10 plans; 5 manual-only (multi-region apply, legal review of `idp-deprovisioning` flag, GWS write-access banner end-to-end, real-provider sandbox tests, webhook self-trigger end-to-end)


## Phase 71 Planned (2026-04-27)

7 plans across 4 waves; 2 marked `autonomous: false` (Plans 71-03 schema migration + 71-07 backfill — both follow Phase 70 Plan 09 multi-region precedent):

| Wave | Plan | Title | autonomous | Requirements |
|------|------|-------|------------|--------------|
| 0 | 71-01 | Failing test scaffolds + new `@contractor-ops/compliance-policy` package skeleton | true | All 4 (RED state) |
| 1 | 71-02 | 13-rule policy registry seeds (5 jurisdictions) + 13 PENDING signoff entries + TZ-aware isExpired helper | true | COMPL-08, COMPL-09 |
| 2 | 71-03 | Schema migration — 4 cols + 2 enums + 1 col on ClassificationAssessment + drift index | **false** | COMPL-08 |
| 2 | 71-04 | `submit` transactional refactor + supersession-on-outcome-change + materialiseFromPolicy/supersedeAndMaterialise helpers | true | COMPL-02 |
| 3 | 71-05 | `recreateComplianceAssessment` admin tRPC mutation + idempotency guard + single audit-log emission | true | COMPL-10 |
| 3 | 71-06 | Recompute UI button + bulk action + 4-locale i18n strings | true | COMPL-10 |
| 3 | 71-07 | Idempotent backfill script + multi-region run docs | **false** | COMPL-08 |

**Plan-checker verdict:** PASSED. All 16 LOCKED CONTEXT decisions (D-01..D-16) addressed; every COMPL-{02,08,09,10} requirement covered; Standing Constraint LOCAL-ONLY honoured (legal review DEFERRED, multi-region manual). Threat models, validation strategy (Nyquist), and Phase 70 dependency hooks (`signoff-registry-flags.json`, `lint:schema`/`lint:logs`/`i18n:parity` regression checks) all present.

**Phase 71 plan artefacts:**

- `71-RESEARCH.md` — pinned per-jurisdiction document specifics + draft legal text + library choice (`@date-fns/tz` v4)
- `71-PATTERNS.md` — analog files: feature-flags signoff registry, classification recreateDraftAfterDrift, audit-writer, push-all-regions, revalidate-vat-button
- `71-VALIDATION.md` — 36 verification entries across 7 plans; 5 manual-only (multi-region apply, visual SQL review, admin UI, legal text approval)

## Phase 70 Complete (cleared 2026-04-27)

**Plan 70-09 + 70-10 status:** SHIPPED. The `autonomous: false` flag on 70-09 referred to the per-region backfill *apply step*, not the code work. Code-side acceptance criteria were met and committed; the apply step is recorded as a deferred post-deploy item under the LOCAL-ONLY Standing Constraint (mirrors v5.0 deferred-items pattern).

**Phase 70 commits (all 10 plans on `main`):**

| Plan | Commit | Subject |
|------|--------|---------|
| 70-01 | `bcaa2e70` | Wave 0 failing test scaffolds for FOUND6-01..06 + lint-guards package |
| 70-02 | `cde07dc8` | pnpm lint:schema CI guard for FOUND6-01 (P27) |
| 70-03 | `abc00a7c` | default-redact logger bodies + pnpm lint:logs guard for FOUND6-02 (P28) |
| 70-04 | `eb4486ce` | pnpm i18n:parity CI guard for FOUND6-03 (P29) |
| 70-05 | `c251e4c7` | flag-namespace signoff registry schema + helpers for FOUND6-04 (P30) |
| 70-06 | `f2d76942` | wire pnpm lint:schema/lint:logs/i18n:parity into CI + husky pre-push |
| 70-07 | `99a6c74f` | boot-time flag-signoff gate + LOCAL-ONLY bypass for FOUND6-04 (P30) |
| 70-08 | `741f62f0` | getIdpAuditLogger() with allow-list semantics for FOUND6-06 (P28) |
| 70-09 | `9212adf1` | IntegrationConnection.scopeCapabilities + backfill migration for FOUND6-05 (P31) |
| 70-10 | `2a41d142` | GWS reconnect banner + i18n keys for FOUND6-05 / D-16 |

**Deferred post-deploy item (recorded in Deferred Items table below):**

The backfill apply against `DATABASE_URL_EU` and `DATABASE_URL_ME` is idempotent and documented in `packages/db/scripts/README.md`. Recommended sequence (run from a deploy workstation, NOT in background sessions):

```sh
DATABASE_URL=$DATABASE_URL_EU tsx packages/db/scripts/backfill-scope-capabilities.ts --dry-run
DATABASE_URL=$DATABASE_URL_EU tsx packages/db/scripts/backfill-scope-capabilities.ts
DATABASE_URL=$DATABASE_URL_ME tsx packages/db/scripts/backfill-scope-capabilities.ts --dry-run
DATABASE_URL=$DATABASE_URL_ME tsx packages/db/scripts/backfill-scope-capabilities.ts
```

`WHERE scopeCapabilities IS NULL` precondition makes both runs idempotent — safe to re-run after partial failure or to verify zero-write convergence.

**Downstream unblocked:** Phase 71 (depends on 70 ✓), Phase 74 (depends on 70 ✓ — context gathered, ready to plan), Phase 79 (depends on 71). Phase 76 still gated on Phase 74 + 75 landing.

## Performance Metrics

**Velocity:**

- Total plans completed: 324 (51 v1.0 + 52 v2.0 + 47 v3.0 + 55 v4.0 + 70 v5.0 [Phases 56–69] + 10 v6.0 [Phase 70])
- v6.0 plans completed: 10 (Phase 70: 70-01..70-10)
- v6.0 phases completed: 1 / 11 (Phase 70)
- v6.0 phases planned: 11 (70-80)

**v5.0 Reference:**

- 70 plans across 14 phases (56–69)
- Trend: Stable; gap-closure phases reduced verification debt to zero before milestone close

*Updated after each plan completion*

## Accumulated Context

## Deferred Items

Items acknowledged and deferred at v5.0 milestone close on 2026-04-26:

| Category | Phase | File | Status | Disposition |
|----------|-------|------|--------|-------------|
| migration_apply | 70 | 70-09-SUMMARY.md | code shipped (`9212adf1`) — multi-region apply pending | post-deploy: `tsx packages/db/scripts/backfill-scope-capabilities.ts` against `$DATABASE_URL_EU` then `$DATABASE_URL_ME` (idempotent, dry-run-supported) |
| uat_gap | 60 | 60-HUMAN-UAT.md | partial — 4 pending scenarios | post-deploy manual UI verification |
| uat_gap | 61 | 61-UAT.md | partial — 12 pending scenarios | post-deploy manual UI verification |
| uat_gap | 62 | 62-HUMAN-UAT.md | partial — 3 pending scenarios | post-deploy manual UI verification |
| uat_gap | 63 | 63-HUMAN-UAT.md | partial — 6 pending scenarios | post-deploy manual UI verification |
| verification_gap | 56 | 56-VERIFICATION.md | gaps_found | GAP-67-01-01 closed by Phase 69 (commit ee0dc8aa); FOUND-03 → Complete |
| verification_gap | 57 | 57-VERIFICATION.md | gaps_found | code-level passed; gap addressed by Phase 66 + Phase 57 plan 04 audit-acknowledgement |
| verification_gap | 58 | 58-VERIFICATION.md | gaps_found | I-3 documented as warning (verification-shape only, runtime works); Phase 67 verified |
| verification_gap | 60 | 60-VERIFICATION.md | human_needed | manual UI UAT — same items as 60-HUMAN-UAT above |
| verification_gap | 61 | 61-VERIFICATION.md | human_needed | manual UI UAT — same items as 61-UAT above |
| verification_gap | 62 | 62-VERIFICATION.md | human_needed | manual UI UAT — same items as 62-HUMAN-UAT above |

All items consistent with Standing Project Constraints (LOCAL-ONLY, manual UI verification deferred to post-deploy).
Code-level audit gaps (I-1 / EINV-01/02/04 / PAY-04 / FOUND-03) all closed this session by Phases 65-69.

### Standing Project Constraints

- **Deployment status: LOCAL-ONLY.** The application is still in local development and has not been deployed to production. No external users, no regulated customers, no live data flows.
- **Legal/regulatory verification is DEFERRED.** Any feature that ordinarily requires sign-off from an external legal entity (UK tax adviser for IR35 / ITEPA wording, German Steuerberater for DRV / Scheinselbständigkeit / SGB terminology, Polish doradca podatkowy for JPK, Arabic legal counsel for PDPL, etc.) should be marked as "Needs verification by legal entity before production deploy" in the relevant SUMMARY.md / VALIDATION.md / plan checkpoint, but must NOT hard-block the build, the CI pipeline, or local execution. There is no point running approval workflows pre-deploy.
- **Default behaviour for legal-review checkpoints:** treat the plan-provided legal wording as the working copy, ship it, and record the outstanding legal sign-off as a post-merge item in the phase SUMMARY under "Manual-Only Verifications" or an equivalent section. Do NOT write STATE.md blockers for missing legal sign-off unless the plan explicitly hard-stops on it.

### v6.0 Roadmap Summary (created 2026-04-26)

**11 phases (70-80) covering 54 requirements:**

| Phase | Name | Reqs | Research |
|---|---|---|---|
| 70 | v6.0 Foundation — CI Guards & Observability | 6 | STANDARD |
| 71 | F1 Compliance — Policy Package + Schema | 4 | NEEDS RESEARCH |
| 72 | F1 Compliance — Reminder + Payment Block | 4 | STANDARD |
| 73 | F1 Compliance — Dashboard + Portal + i18n | 3 | STANDARD |
| 74 | F4 Offboarding — Workflow + KT Templates | 6 | STANDARD |
| 75 | F4 Offboarding — IP Verify + Credentials | 5 | NEEDS RESEARCH |
| 76 | F2 IdP — Capability + Saga + Cooldown | 8 | STANDARD |
| 77 | F2 IdP — GWS + Slack (the wedge) | 4 | NEEDS RESEARCH |
| 78 | F2 IdP — Entra + Okta + GitHub | 3 | NEEDS RESEARCH |
| 79 | F3 Gulf — UAE Free-Zone + Saudization | 11 | NEEDS RESEARCH |
| 80 | v6.0 Verification + Hardening + UAT | 0 | STANDARD |

**Hard dependency edges:**

- 70 → all (foundation guards must ship first)
- 71 → 79 (free-zone trade license participates in F1 reminder cron)
- 71 → 75 (F4 IP-clause findings persist as ContractorComplianceItem)
- 74 → 75 (F4 IP_VERIFICATION needs override permission + workflow foundation)
- 75 → 76 (F2 14-day cooldown gate references F4 final-invoice-paid state — Pitfall 7)
- 76 → 77 → 78 (saga + cooldown infra → wedge → differentiator)

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v6.0 roadmap, 2026-04-26]: Foundation-first (Phase 70) — PITFALLS P27-P31 wins over ARCHITECTURE F1-first proposal; cross-cutting CI guards prevent CRITICAL-recovery-cost bug classes
- [v6.0 roadmap, 2026-04-26]: F4 ships before F2 — Pitfall 7 cooldown gate references F4's final-invoice-paid state machine
- [v6.0 roadmap, 2026-04-26]: F2 split into wedge (GWS+Slack, Phase 77) + differentiator (Entra+Okta+GitHub, Phase 78) — ~95% SMB market hits the wedge with narrowest scope expansion
- [v6.0 roadmap, 2026-04-26]: F1 ships before F3 + F4 — both compose on F1's `ContractorComplianceItem` + reminder cron schema
- [v6.0 requirements, 2026-04-26]: Drift escape hatch reused 3x (compliance requirement-set / Saudization Nitaqat thresholds / role taxonomy) — milestone-wide pattern mirrors v5.0 `recreateDraftAfterDrift`
- [v6.0 requirements, 2026-04-26]: Saudization band entry is MANUAL — system never auto-computes (legal liability + quarterly matrix changes); GULF-FUTURE-02 likely never
- [v6.0 requirements, 2026-04-26]: Contract clause scanner is REGEX-FIRST per-jurisdiction phrase library; Claude Vision tool_use only as MANUAL_REVIEW_REQUIRED tristate fallback (PITFALLS P22)
- [v6.0 requirements, 2026-04-26]: Credentials are POINTERS only (`CredentialReference` schema) — content-validation regex rejects AKIA*/GitHub PATs/JWT/hex≥32; storing actual credentials explicitly out of scope (PITFALLS P21)
- [v5.0 roadmap]: Classification engine as new `packages/classification` with pluggable country rule sets (mirrors einvoice pattern)
- [v5.0 roadmap]: XRechnung uses CII XML syntax (not UBL) — different from existing Peppol-AE profile
- [v5.0 roadmap]: ZUGFeRD requires PDF/A-3 with embedded CII XML via pdf-lib — highest technical risk, needs proof-of-concept
- [v5.0 roadmap]: Classification stored per-engagement, not per-contractor
- [v5.0 roadmap]: German legal terminology locked as code constants, not in translation files

### Pending Todos

- Phase 70 — DONE (10/10 plans on `main`); multi-region backfill apply is a deferred post-deploy item (see Deferred Items table).
- Phase 74 (F4 Offboarding — Workflow Foundation) — context gathered, run `/gsd-plan-phase 74` next.
- Phase 71 + 76 plans ready — execute when ready (71 unblocked, 76 still gated on 74 + 75).
- Phase 75, 77, 78, 79 carry NEEDS RESEARCH flags — `/gsd-plan-phase` will spawn `gsd-phase-researcher` for those.
- Standing reminder: every legal-sensitive Unleash flag introduced by a v6.0 phase must register PENDING in `signoff-registry.ts` (FOUND6-04 CI gate enforces this since Phase 70 shipped).

### Blockers/Concerns

- **[RESOLVED — 2026-04-13] Phase 58 Plan 58-04 COMPLETE.** Wizard UI + i18n shipped in commits `3fed4277` (i18n Classification namespace across en/pl/de/ar + Pitfall-9 _NOTE) and `13310313` (13 wizard component files + RSC page entry + 16/16 RTL + a11y tests + new `recreateDraftAfterDrift` tRPC mutation for the rule-set drift escape hatch). All plan grep assertions green (scoring-free client bundle, aria-current / aria-valuenow / aria-live / inputMode="numeric" / CLASSIFICATION_SCHEIN_NOT_APPLICABLE / isNotApplicable / Classification namespace / _NOTE all present). Locked-phrases guard 32/32 green. See `.planning/phases/58-classification-engine-rule-sets/58-04-SUMMARY.md`. Plan 58-05 remains (outcome page + disclaimer modal + classification tile + 2 human-verify checkpoints — `autonomous: false`).

- **[HISTORICAL — 2026-04-13] Plan 58-04 prior race-condition blocker (now obsolete).** Agent invoked for Plan 58-04 per orchestrator instructions that Plans 58-02 and 58-03 were running as parallel agents. On inspection at start of this session (branch `v2`, HEAD `fb95eb3e`): (1) `packages/classification/src/profiles/ir35/` and `packages/classification/src/profiles/scheinselbstandigkeit/` still contain ONLY `__tests__/` subdirectories — no `rule-set.ts`, no `scoring.ts`, no registered profiles; (2) `packages/api/src/routers/classification.ts` does NOT exist — there is no `classification` router in `packages/api/src/routers/` at all; (3) `58-02-SUMMARY.md` and `58-03-SUMMARY.md` are both absent from `.planning/phases/58-classification-engine-rule-sets/`; (4) `git log --oneline -30` contains zero commits referencing `[58-02]` or `[58-03]` — newest classification-related commit remains `55ce4204` (Plan 58-01 Task 3). Plan 58-04's wizard shell (`apps/web/src/components/contractors/classification/wizard/classification-wizard-shell.tsx`) explicitly imports `IR35_QUESTIONS`, `RULE_SET_VERSION` from `@contractor-ops/classification/profiles/ir35/rule-set`, `SCHEIN_QUESTIONS`, `CATEGORY_WEIGHTS`, `CATEGORY_TITLES` from `@contractor-ops/classification/profiles/scheinselbstandigkeit/rule-set`, and calls `trpc.classification.createDraft`, `.getDraft`, `.saveAnswer`, `.submit`, `.acknowledgeDisclaimer` — every one of those exports depends on Plan 58-02's rule-set constants landing AND Plan 58-03's tRPC router landing. Plan 58-04's `<context>` block even directly `@`-references `58-03-SUMMARY.md` as a read-first input. Note that Plan 58-03's own agent has just recorded its own blocker above — 58-03 is gated on 58-02, and 58-04 is gated on both, so the dependency chain is: 58-02 must land → 58-03 can run → 58-04 can run. Executing 58-04 now would (a) produce TypeScript errors against missing exports, (b) require speculative mocking of both upstream APIs that would need rewriting once real code exists, (c) violate the plan's `depends_on: [58-01, 58-02, 58-03]` declaration, and (d) risk making import paths drift from what 58-02/58-03 will actually export. Per dispatch instructions ("If Plan 58-04 has a file-level dependency on 58-02 or 58-03 output, check whether those commits have landed before proceeding; if not, write a blocker stating the dependency and stop"), STOPPING without making any code changes. No files were modified and no commits were created by this aborted 58-04 run. Resolution: wait for Plan 58-02 parallel agent to land IR35 + DRV rule-sets + scoring + profile registration on `v2`, then for Plan 58-03 parallel agent to land the classification tRPC router on `v2`, then re-dispatch `/gsd:execute-plan 58-04` as a fresh top-level agent. Re-run checks: (a) `ls packages/classification/src/profiles/ir35/ packages/classification/src/profiles/scheinselbstandigkeit/` must show more than `__tests__/`, (b) `ls packages/api/src/routers/classification.ts` must succeed, (c) `ls .planning/phases/58-classification-engine-rule-sets/58-02-SUMMARY.md .planning/phases/58-classification-engine-rule-sets/58-03-SUMMARY.md` must succeed, (d) `git log --oneline --all | grep -E "\[58-0[23]\]"` must return commits.

- **[RESOLVED — 2026-04-13] Phase 58 Plan 58-03 COMPLETE.** Classification tRPC router landed in commit `4ad362f9` on `v2`. Seven procedures (createDraft / getDraft / saveAnswer / submit / acknowledgeDisclaimer / getLatest / listByContractor) wired into appRouter; `classificationSaveAnswerRateLimit` middleware (Upstash + in-memory fallback, 120/min/assessment); observability `LOG_BODY_EXCLUDE_PREFIXES` sentinel covers `classification.*`. 36 green tests (30 router integration + 6 middleware unit), 0 new TS errors. See `.planning/phases/58-classification-engine-rule-sets/58-03-SUMMARY.md`. Plan 58-04 is now unblocked.

- **[HISTORICAL BLOCKER — 2026-04-13] Phase 58 Plan 58-03 cannot proceed — file-level dependency on Plan 58-02 not yet committed.** Agent invoked for Plan 58-03 (classification tRPC router + rate-limit middleware) per orchestrator instructions that Plan 58-02 was running as a parallel agent. On inspection at start of this session: `packages/classification/src/profiles/ir35/` and `packages/classification/src/profiles/scheinselbstandigkeit/` contain ONLY `__tests__/` subdirectories (rule-set.test.ts + scoring.test.ts scaffolds from Plan 58-01). No `rule-set.ts`, no `scoring.ts`, no `index.ts` / `profile.ts` files registered. `getProfileForCountry('GB')` and `getProfileForCountry('DE')` therefore throw because Plan 58-01 registry is empty — no profiles registered. Recent git log (last 30 min) shows zero Plan 58-02 commits on `v2`; newest classification-related commit remains `55ce4204` (Plan 58-01 Task 3). Plan 58-03 PLAN.md explicitly imports `getProfileForCountry`, `buildQuestionsSnapshot`, `outcomeSchema`, `getAnswerSchemaForType`, and calls `profile.scoreAssessment(...)` — all depend on Plan 58-02's IR35 + DRV profiles + scoring functions existing. Without them, TEST CD-1..LC-3 all fail at setup (no profile for 'GB' / 'DE'), and there is no `scoreAssessment` to wire into `submit`. Per orchestrator instructions ("If Plan 58-03 has a file-level dependency on 58-02 output, check whether the required files/tests from 58-02 are already committed before proceeding; if not, write a blocker stating the dependency and stop"), STOPPING without making any code changes. Resolution: wait for Plan 58-02 parallel agent to land its commits (at minimum `packages/classification/src/profiles/ir35/rule-set.ts` + `scoring.ts` + profile registration and `packages/classification/src/profiles/scheinselbstandigkeit/rule-set.ts` + `scoring.ts` + profile registration on `v2`), then re-dispatch `/gsd:execute-plan 58-03` as a fresh top-level agent. Re-run check: `ls packages/classification/src/profiles/ir35/ packages/classification/src/profiles/scheinselbstandigkeit/` must show more than just `__tests__/`, AND `git log --oneline -- packages/classification/src/profiles/` must contain a Plan 58-02 commit. No files were modified and no commits were created by this aborted 58-03 run.

- **[PARTIAL PROGRESS — 2026-04-13] Phase 58 Plan 01 (Wave-0 skeleton) COMPLETE; Plans 02–05 remain.** The `/gsd:execute-phase 58` run was invoked as a background agent session. Runtime does not expose the `Task()` subagent API, so per execute-phase.md `<runtime_compatibility>` the orchestrator fell back to sequential inline execution. Plan 58-01 (3 tasks) executed fully on-branch (v2): (1) `packages/classification` workspace scaffolded with registry + types + Zod schemas + snapshot helper + 7 Wave-0 test scaffolds (9 tests pass, 4 `describe.todo` scaffolds for Plan 02 TDD); (2) `ClassificationAssessment` Prisma model + `ClassificationAssessmentStatus` enum added with explicit index `map` names to dodge Postgres-63-char truncation collisions; back-relations on `ContractorAssignment` + `Organization`; `db:push` succeeded against Neon EU pooler; (3) 9 CLASSIFICATION_SCHEIN_* locked phrases appended to `packages/validators/src/legal/de.ts`, new `packages/validators/src/legal/disclaimers.ts` with 4 bilingual disclaimer constants + reserved-key guard, `packages/validators/src/index.ts` re-exports both modules, `locked-phrases-guard.test.ts` extended with 2 new Phase-58 describe blocks (32/32 guard tests green). See `.planning/phases/58-classification-engine-rule-sets/58-01-SUMMARY.md` for detail. **Remaining:** Plan 58-02 (IR35 + DRV rule sets + scoring, Wave 2), Plan 58-03 (classification tRPC router + rate limit, Wave 3), Plan 58-04 (wizard UI + i18n, Wave 3), Plan 58-05 (outcome pages + disclaimer dialog + tile + 2 human-verify checkpoints, Wave 3 — `autonomous: false`). Three structural issues surfaced during the run that inform how the remaining plans should be dispatched: (a) the runtime's write hooks or a file watcher repeatedly reverted edits to `packages/validators/src/legal/de.ts`, `packages/validators/src/index.ts`, and `packages/validators/src/__tests__/locked-phrases-guard.test.ts` until the final commit captured them — future edits to shared files in this package should Read+Edit then immediately `git add && git commit` to lock the change before the linter strikes; (b) `pnpm install` triggers a repo-wide postinstall build that fails in `@contractor-ops/integrations` (pre-existing docusign-adapter.test.ts + claude-ocr-adapter.msw.integration.test.ts type errors, unrelated to Phase 58) — individual `pnpm --filter @contractor-ops/{db,classification,validators} ...` commands work cleanly; (c) Phase 57 ran as a parallel background agent and rewrote `STATE.md` frontmatter during Phase 58's execution, so STATE body edits must be surgical appends, not full-file rewrites, until both phases settle. Remaining plans each have fully detailed PLAN.md files under `.planning/phases/58-classification-engine-rule-sets/` with canonical read-before-write references into RESEARCH.md + UI-SPEC.md + CONTEXT.md. Resolution: dispatch Plans 58-02 through 58-05 as **separate top-level** `/gsd:execute-plan 58-02` … `/gsd:execute-plan 58-05` invocations (one fresh agent per plan) so each loads a clean context window; 58-05 additionally needs interactive sessions for the two Steuerberater / UK-tax-adviser human-verify checkpoints before its VALIDATION.md can flip `nyquist_compliant: true`.
- **[BLOCKER — 2026-04-13] Phase 60 plan-phase workflow cannot spawn subagents.** The `Skill(gsd:plan-phase, "60 --auto")` run was invoked as a nested sub-agent / background agent session (GSD autonomous pipeline). In that context the `Task` tool is NOT available — it is not in the tool set and not discoverable via `ToolSearch`. The workflow cannot spawn `gsd-phase-researcher`, `gsd-planner`, or `gsd-plan-checker`. Before stopping, two artifacts WERE created successfully using the inline tool set: (1) `.planning/phases/60-classification-polish/60-UI-SPEC.md` — full UI design contract derived from CONTEXT.md D-01..D-16 + existing Precision Craft tokens in `apps/web/src/app/globals.css` + `apps/web/components.json` (shadcn `base-nova` preset); 4 sizes / 2 weights typography, accent reserved-for list with 5 specific items, 60/30/10 split explicit, registry safety PASS (shadcn official only — no third-party), component inventory for 15 Phase-60 components mapped to existing shadcn primitives (`card`, `badge`, `alert-dialog`, `dialog`, `dropdown-menu`, `popover`, `progress`, `table`, `tabs`, `tooltip`, `skeleton`, `button`, `input`, `select`, `separator`, `breadcrumb`, `calendar`, `sheet`, `label`), inline 6-dimension self-check PASS (commits `2aefefcf` + `b4fa1974`, frontmatter flipped to `status: executing

- **[BLOCKER — 2026-04-12] Phase 57 plan-phase workflow cannot spawn subagents.** The `/gsd-plan-phase 57 --auto` run was invoked as a background agent session (GSD autonomous pipeline). In that nested sub-agent context the `Task` tool is NOT available — it is not in the tool set and not discoverable via `ToolSearch`. The workflow cannot spawn `gsd-phase-researcher`, `gsd-planner`, or `gsd-plan-checker`. Orchestrator stopped before step 5 (research spawn) per manager instructions to record blockers instead of silently working around permission/tool-access errors. CONTEXT.md is already in place at `.planning/phases/57-government-api-clients/57-CONTEXT.md` (gathered 2026-04-12, 14 locked decisions, full canonical refs, code-context, and deferred list). DISCUSSION-LOG.md also present. No RESEARCH.md, VALIDATION.md, UI-SPEC.md, or PLAN.md files were created. Resolution options: (1) re-run `/gsd-plan-phase 57 --auto` from an interactive top-level session (not a nested background agent) so Task-tool-based subagent spawning works; (2) run the pipeline stages manually at top-level: `/gsd-ui-phase 57 --auto` (if frontend indicators trigger the gate) → `/gsd-plan-phase 57 --auto`; (3) use `--skip-research` if research is not desired. Note this is the same blocker pattern previously hit on Phase 56 — nested sub-agent spawning is a structural limit of the current autonomous orchestration, not a transient failure. Before a clean re-run, reset chain flag if stuck: `node .claude/get-shit-done/bin/gsd-tools.cjs config-set workflow._auto_chain_active false`.
- **[BLOCKER — 2026-04-12] Phase 56 plan-phase workflow cannot spawn subagents.** The `/gsd-plan-phase 56 --auto` run was invoked as a background agent session (GSD autonomous pipeline). In that context the `Task` tool is not available, so the workflow cannot spawn `gsd-ui-researcher`, `gsd-ui-checker`, `gsd-phase-researcher`, `gsd-planner`, or `gsd-plan-checker`. The workflow auto-chained into `gsd:ui-phase` (UI-SPEC gate, step 5.6) and stopped at the first researcher spawn. Resolution options: (1) re-run `/gsd-plan-phase 56 --auto` from an interactive top-level session (not as a nested background agent) so Task-tool-based subagent spawning works; (2) run the pipeline stages manually at top-level: `/gsd-ui-phase 56 --auto` → `/gsd-plan-phase 56 --auto --skip-research` (or with research) — each as a separate top-level invocation; (3) disable UI gate via `node .claude/get-shit-done/bin/gsd-tools.cjs config-set workflow.ui_phase false` and `workflow.ui_safety_gate false` and re-run (not recommended — loses design contract). Side effect: `workflow._auto_chain_active` was set to `true` during the aborted run; reset with `node .claude/get-shit-done/bin/gsd-tools.cjs config-set workflow._auto_chain_active false` before a clean re-run. CONTEXT.md is in place; no other artifacts were created.
- HMRC developer hub registration takes weeks — initiate during Phase 56 to avoid blocking Phase 57
- pdf-lib PDF/A-3b capability needs proof-of-concept before Phase 62 implementation — fallback is Apache PDFBox child process
- German Steuerberater review of tax terminology should be commissioned during Phase 56
- VIES REST API production stability in 2026 unconfirmed — may need soap fallback
- BACS Standard 18 full spec requires procurement from Vocalink/Pay.UK via BACS bureau
- [BLOCKER — 2026-04-14] Phase 62 execute-phase workflow cannot spawn subagents. The /gsd:execute-phase 62 run was invoked as a background autonomous agent session. In that context the Task() subagent API is NOT available — not in the tool set and not discoverable via ToolSearch. Per execute-phase.md <runtime_compatibility>, the documented fallback is sequential inline execution, but the scope of Phase 62 exceeds what a single inline context can reliably complete: 7 plans across 6 waves touching ~90+ files (Prisma schema + forward-only migration with [BLOCKING] live Neon push, full zugferd-de profile with CII/XRechnung parsers + PDF asset bundle, PDF/A-3 generator pipeline with veraPDF CI gate, intake matcher/service, two tRPC routers, all web UI surfaces per 62-UI-SPEC.md including intake pages/upload dialog/split-button/locale strings across en/de/gb, and Playwright E2E coverage for both EINV-02 + EINV-03). Plan artifacts total ~3,400 lines before implementation. Attempting inline would exhaust context before Wave 3 and produce partial uncommitted work — matching the pattern previously documented for Phases 56, 57, 58, 60 nested-agent blockers. Execution stopped BEFORE any code changes (STATE.md begin-phase ran but no Prisma edits, no migrations, no parser code, no UI). Current branch: v2 @ 378407dc. STATE.md frontmatter was advanced to "Phase 62 execution started" via state begin-phase — manager may want to roll that back to "Phase 63 context gathered" if restarting from a clean slate. Resolution options: (1) re-run /gsd:execute-phase 62 from an interactive top-level session where Task() subagent spawning is available — the recommended path since 7 plans deserve fresh context each; (2) run each plan individually at top-level: /gsd:execute-plan 62-01 ... /gsd:execute-plan 62-07 one at a time, each as a fresh top-level invocation, respecting wave dependencies (62-01 first, then 62-02, then 62-03 and 62-04 in parallel, then 62-05, then 62-06, then 62-07); (3) use interactive flag: /gsd:execute-phase 62 --interactive at top-level for pair-programming-style sequential inline execution with user checkpoints. Note that Plan 62-01 Task 4 is [BLOCKING] — it requires `pnpm --filter @contractor-ops/db prisma db push --accept-data-loss` against the live Neon DB; this must NOT be bypassed since downstream Prisma client types depend on the push completing. Reset chain flag before re-run if needed: `node .claude/get-shit-done/bin/gsd-tools.cjs config-set workflow._auto_chain_active false` (already reset by this session's init step).

## Session Continuity

Last session: --stopped-at
Stopped at: Phase 70 complete (10/10 plans); backfill apply deferred to post-deploy
Resume file: --resume-file
Next command: `/gsd-plan-phase 74`  (Phase 74 context gathered, ready to plan; 71 + 76 plans already ready to execute)

**Planned Phases (ready to execute):** 71 (F1 Compliance — 7 plans), 76 (F2 IdP — 10 plans, gated on 74 + 75)
**Recorded:** 2026-04-27
