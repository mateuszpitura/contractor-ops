---
status: passed
phase: 80-v6-0-verification-hardening-manual-uat
verified: 2026-06-05
verifier: inline (gsd-verifier agent not installed in this runtime)
milestone: v6.0
milestone_name: Platform Maturity & Operational Hardening
deliverable: D-04 (hardening gate re-run) + D-05 (milestone-close retrospective)
gates_total: 14
gates_pass: 9
gates_pre_existing: 3
gates_recorded_only: 2
pending_flags: 24
---

# Phase 80: v6.0 Verification + Hardening — Milestone-Close Retrospective

## Goal Recap

This is the v6.0 (Platform Maturity & Operational Hardening, **phases 70–80**) milestone-close
retrospective. It proves the v6.0 CI/static gates still pass milestone-wide (the D-04 hardening
pass), inventories the deferred PENDING Unleash-flag approvals that ship dark, records the
cross-feature integration-test outcome (Plan 80-01), and captures the plan-completion velocity
learning against the v5.0 baseline. It is one of the three D-05 milestone-close docs alongside
`80-HUMAN-UAT.md` (Plan 80-02) and `80-LEGAL-SIGNOFF.md` (Plan 80-03).

Per the Standing Project Constraint (STATE.md): **the app is LOCAL-ONLY and legal/regulatory
sign-off is DEFERRED post-deploy**. Pre-existing gate offenders and `pnpm audit` advisories are
**recorded, not fixed** — this is a verification phase that touches no feature source and modifies
no gate script or dependency (D-04 scope: re-run-and-record).

## Hardening Gate Re-Run (D-04)

Every D-04 v6.0 gate was re-run from the repo root on 2026-06-05 and its exit code recorded. The
criterion is **re-run-and-record**: a gate surfacing a known pre-existing offender is RECORDED
(offender named), never fixed (Standing Constraint + phase scope). The working tree carries ~83
uncommitted entries from unrelated concurrent work (demo-readonly-mode, web-vite wizards,
validators, peppol, scripts) — the table separates **v6.0-surface gate status** from
**pre-existing committed offenders** and confirms no offender traces to a phase-80 change.

| Gate | Command | Result | Evidence |
|------|---------|--------|----------|
| lint:audit-log | `pnpm lint:audit-log` | **PASS** (exit 0) | OK — no direct `auditLog.create` calls in 582 scanned files |
| lint:raw-sql | `pnpm lint:raw-sql` | **PASS** (exit 0) | OK — 1191 source files scanned; all `$queryRaw` callsites tenant-scoped or annotated |
| lint:logs | `pnpm lint:logs` | **PRE-EXISTING — documented, out of scope to fix** (exit 1) | 1 offender: `apps/api/src/routes/csp-report.ts:86` (`log.warn({ body }, …)`). Committed `e320911b` 2026-05-26 in the `apps/api` scaffold — pre-dates phase-80 execution (2026-06-05) and is NOT a v6.0 feature surface. Not in `git status` (committed, not dirty-tree). Remediation pointer: omit `body` or add prefix to `LOG_BODY_INCLUDE_PREFIXES`. |
| lint:silent-catch | `pnpm lint:silent-catch` | **PASS** (exit 0) | OK — no silent catch blocks in 3030 scanned files |
| lint:schema | `pnpm lint:schema` | **PRE-EXISTING — documented, out of scope to fix** (exit 1) | 1 offender: model `UserPinnedView` (`packages/db/prisma/schema/auth.prisma:114`) missing `organizationId` / not in `GLOBAL_LOOKUP_MODELS_ALLOWLIST`. Committed `45a7c742` 2026-05-31 (Phase 76 schema work) — pre-dates phase-80, not dirty-tree. Recorded for a follow-up (add `organizationId` or allowlist the model). |
| i18n:parity | `pnpm i18n:parity` | **PASS** (exit 0) | OK — `en.json` keys covered in `de.json`, `pl.json`, `ar.json` (494 pre-existing sites tolerated as baseline) |
| db:audit-enum-casing | `pnpm --filter @contractor-ops/db db:audit-enum-casing` | **PRE-EXISTING — documented, out of scope to fix** (exit 1) | 5 offenders: `ManualOverrideCategory` enum values (`verified_via_vendor_console`, `user_already_inactive`, `provider_endpoint_deprecated`, `transient_provider_issue_resolved`, `other`) at `packages/db/prisma/schema/idp-deprovisioning.prisma:117-121` are lower_snake_case rather than UPPER_SNAKE. Committed `6afe0724` 2026-06-01 (Phase 76 IdP schema) — pre-dates phase-80, not dirty-tree. Recorded for a follow-up enum-casing migration. |
| check:web-vite-data-layer | `pnpm check:web-vite-data-layer` | **PASS** (exit 0) | check:web-vite-data-layer — OK |
| check:web-vite-page-shells | `pnpm check:web-vite-page-shells` | **PASS** (exit 0) | check:web-vite-page-shells — OK |
| check:web-vite-presentational | `pnpm check:web-vite-presentational` | **PASS** (exit 0) | check:web-vite-presentational — OK |
| check:web-vite-table-pattern | `pnpm check:web-vite-table-pattern` | **PASS** (exit 0) | check:web-vite-table-pattern — OK |
| check:web-vite-dialog-pattern | `pnpm check:web-vite-dialog-pattern` | **PASS** (exit 0) | check:web-vite-dialog-pattern — OK |
| audit | `pnpm audit` | **RECORDED — advisories, no dependency changed** (exit 1) | 10 advisories: **1 critical** (Vitest UI server arbitrary-file via dev `vitest` UI), **2 high** (`tmp` path-traversal; Better Auth device-authorization approve/deny), **6 moderate** (Hono middleware-bypass / IP-restriction / cookie sameSite / JWT scheme / `app.mount()` percent-encoding via `apps/public-api>hono`; @hono/node-server middleware bypass; Turbo login-callback CSRF), **1 low** (Turbo local-code-execution Yarn-Berry detection). Recorded read-only per 7-day release-age policy + D-04 record-only scope; no `package.json`/`pnpm-lock.yaml` change made (note: `packages/api/package.json` is dirty from unrelated concurrent work — NOT touched here). |
| security:scan | `pnpm security:scan` | **RECORDED — audit FAIL + gitleaks env-unavailable** (exit 1) | Two checks: (1) **Gitleaks (secret scan)** — could NOT run locally: `gitleaks` binary not in PATH and Docker daemon not running (`dial unix .../docker.sock: connect: no such file or directory`). This is an **environment/tooling limitation, NOT a detected leak** — the secret scan must run in CI where gitleaks is available. (2) **pnpm audit** — same 10 advisories above; the script's ≥moderate threshold trips exit 1. No secret leak was observed; no dependency changed. |

**Tally:** 14 gates re-run — **9 PASS**, **3 PRE-EXISTING committed offenders** (all from `apps/api`
scaffold or Phase 76 IdP schema; none from a phase-80 change; recorded, not fixed), **2
recorded-only** (`pnpm audit` advisory inventory + `security:scan` whose gitleaks leg is
environment-unavailable locally). No gate script, `package.json`, `pnpm-lock.yaml`, or dependency
was modified by this plan.

## Hard Dependency Play-Out

The v6.0 hard-dependency block (ROADMAP "Dependency Graph (v6.0)") played out as follows. Each
edge is marked **as planned** or **differed**, with the difference named.

| Hard dependency | Outcome | Notes |
|-----------------|---------|-------|
| **70 → all** (foundation CI guards ship first) | **as planned** | Phase 70 (10/10) landed the cross-cutting guards (`lint:schema`, `i18n:parity`, signoff-registry gate, scope-capabilities JSONB, redaction baseline) before any feature phase. Those guards are exactly the gates re-run above. |
| **71 → 79** (UAE free-zone license expiry is a CRITICAL `ContractorComplianceItem` in the F1 reminder cascade) | **as planned** | Phase 79's `gulf.free-zone-tracking` arms a payment hard-block on an expired free-zone license through the Phase 71/72 `ContractorComplianceItem` + `reEvaluateFreeZoneStatus` path — confirmed composing in the 80-01 integration test. |
| **71 → 75** (F4 IP-clause `LIKELY_MISSING` → `ContractorComplianceItem` of severity STANDARD) | **as planned** | `run-health-check.ts` materialises a STANDARD compliance item on `LIKELY_MISSING`, consumed by F4's offboarding gate. |
| **74 → 75** (F4 IP_VERIFICATION block needs the override permission + workflow foundation) | **as planned** | Phase 74's `workflow:override_blocking_task` (OWNER-only) + workflow foundation underpin Phase 75's `assertRunCompletable` IP hard-block. |
| **75 → 76** (F2 14-day cooldown gate references F4 final-invoice-paid state — Pitfall 7) | **differed (partial upstream)** | The cooldown gate keys off `ContractorAssignment.endedAt` and works, BUT **Phase 75 is PARTIAL**: 75-08's e-sign IP-ratification signing mutation + the webhook IP-ratification atomic flow are **DEFERRED** (no template→PDF→R2 render pipeline; `SigningEnvelope` lacks a `documentType`/metadata column — needs a schema migration the plan only hand-waved). F4's IP hard-block itself ships and composes; only the e-sign *ratification-on-signing* leg is deferred. Recorded in STATE.md. |
| **76 → 77 → 78** (saga + cooldown infra → wedge → differentiator) | **as planned (with a concurrent-executor deviation in 78)** | 76 (10/10) → 77 (5/5, GWS+Slack wedge) → 78 (7/7, Entra+Okta+GitHub). **Phase 78 deviation:** TWO executor sessions ran concurrently; a clean handoff stopped one before 78-07 to avoid colliding on the same 14 web-vite files (STATE.md blocker). 78 completed; a DRY-debt refactor (consolidate the 3 per-provider connection routers into `deprovisioning.enableProviderForOrg`) is DEFERRED (78 WR-1). Schema constraint carried forward: Prisma `IntegrationProvider` enum lacks `ENTRA`/`OKTA` values, so per-provider connection rows live in `Organization.settingsJson` pending a migration. |

**Cross-phase planning deviation (not a hard-dep edge, recorded for completeness):** **Phase 73**
(F1 dashboard + portal) was authored 2026-04-27 against the now-removed Next.js `apps/web`; on the
`audit/post-migration-parity` branch it was **re-planned against `apps/web-vite`** (server→SPA,
next-intl→custom i18n, +ar locale, Page→Container→Hook→Component) before executing 8/8 plans
(STATE.md RESOLVED note). Same `apps/web`→`apps/web-vite` drift was absorbed inline for Phases
76/77 planning.

**Cross-feature integration-test outcome (Plan 80-01):** **PASS — 11/11 assertions green**
(`pnpm --filter @contractor-ops/api test v6-cross-feature-composition`, re-confirmed at HEAD on
2026-06-05). One seeded ME-region UAE contractor drives the **composition** of **F1 + F3 + F4** on a
single shared mutable mock-Prisma store: a free-zone BLOCKING compliance item recorded valid
(PENDING) crosses its Asia/Dubai expiry boundary, `runComplianceReminderScan` flips it
PENDING→EXPIRED, `assertContractorPaymentEligibility` then throws `PRECONDITION_FAILED` (F1 payment
hard-block), `assertRunCompletable` throws `PRECONDITION_FAILED` with
`cause.blockedTaskKind='IP_VERIFICATION'` (F4 offboarding hard-block), `projectOffboardingTrajectory`
returns the F3 Saudization advisory (`advisory:true`/`authoritative:false`, no `projectedBand`), the
`compliance.payment.would_block` audit row is asserted, and the locked-phrase guard is green.
**F2 (IdP) is deliberately NOT composed** (D-01): its `ACCESS_REVOKE` saga runs *post*
offboarding-completion (after the 14-day cooldown), off the blocked path, so it cannot compose into
a hard-blocked-offboarding scenario — F2 verification lives in `80-HUMAN-UAT.md` only.

## PENDING Unleash Flags by Namespace

All **24 PENDING** v6.0 feature flags ship **dark** (engineers develop with
`FLAG_SIGNOFF_BYPASS=local`); none flips to APPROVED until its post-deploy legal review completes
(LOCAL-ONLY Standing Constraint — never a hard-block on milestone closure). The authoritative
enumeration is `getAllPending()` in `packages/validators/src/legal/signoff-registry.ts` (reads
`signoff-registry.json`); the per-flag post-deploy approval pointer is the `notes` field of each
entry in `packages/feature-flags/src/signoff-registry-flags.json`. Grouped by namespace prefix
(matching `isGatedFlag` namespace gating in `packages/feature-flags/src/registry.ts`):

### `idp-deprovisioning*` — F2 IdP (6 flags)
| Flag | Phase | Post-deploy approval pointer (from `notes`) |
|------|-------|----------------------------------------------|
| `idp-deprovisioning` | 76 | Legal review of cooldown semantics + cross-border data-handling of `suspendAccount` + `revokeAllSessions` before APPROVED |
| `module.idp-deprovisioning-gws` | 77 | Legal review of cross-border data-handling (GWS suspend + OAuth-grant revoke + sign-out) |
| `module.idp-deprovisioning-slack` | 77 | Legal review (Slack session-invalidate + SCIM-deactivate); independent of GWS gate (D-15) |
| `module.idp-deprovisioning-entra` | 78 | Legal review deferred (Entra disable + revokeSignInSessions + CA pre-flight + hybrid-AD hard-block); independent enterprise rollout (D-12) |
| `module.idp-deprovisioning-okta` | 78 | Legal review deferred (Okta deactivate + revokeUserSessions); independent enterprise rollout (D-12) |
| `module.idp-deprovisioning-github` | 78 | Legal review deferred (GitHub org-member removal + per-PAT SAML revoke + outside-collab manual flag); independent enterprise rollout (D-12) |

### `compliance-*` — F1 Compliance (16 flags)
**`compliance-payment-block`** (Phase 72) — legal-sensitive admin-lockout posture; production stays
OFF (would-block soft-warn) until the legal entity verifies admin-lockout copy. Legal review DEFERRED post-deploy.

**`compliance-policy-engine.*`** (Phase 71 — per-jurisdiction document flags, legal review deferred per Standing Constraint):
| Flag | Post-deploy approval pointer (from `notes`) |
|------|----------------------------------------------|
| `compliance-policy-engine.uk.right_to_work` | UK Right-to-Work share code (90-day) — legal review deferred |
| `compliance-policy-engine.uk.utr` | HMRC UTR (10-digit; non-expiring) |
| `compliance-policy-engine.uk.business_registration` | Companies House (8-digit company number) |
| `compliance-policy-engine.uk.sds` | Status Determination Statement (Ch.10 ITEPA 2003; IR35-INSIDE) |
| `compliance-policy-engine.de.a1` | A1-Bescheinigung (DRV; 24-month max, EU Reg 883/2004 Art 12) |
| `compliance-policy-engine.de.aufenthaltstitel` | Aufenthaltstitel (AufenthG §4; non-EU nationality) |
| `compliance-policy-engine.de.eight_b_estg` | §48b EStG Freistellungsbescheinigung (construction-sector) |
| `compliance-policy-engine.pl.zus_a1` | ZUS A1 (12-month max, PL implementation) |
| `compliance-policy-engine.pl.udt` | UDT certification (regulated-equipment) |
| `compliance-policy-engine.ksa.iqama` | Iqama (1-year max, Saudi MOI; 00:00 Asia/Riyadh boundary) |
| `compliance-policy-engine.ksa.work_permit_qiwa` | Work permit + Qiwa portal authorisation boolean (Phase 79 wires API) |
| `compliance-policy-engine.uae.emirates_id` | ICA-issued Emirates ID |
| `compliance-policy-engine.uae.free_zone_license` | Free-zone trade license (DMCC, ADGM, …); annually renewed |

**`compliance-portal-self-service`** (Phase 73) — legal review of the self-service upload-replacement
flow + notification copy before APPROVED.

### `offboarding-ip-foundation` — F4 Offboarding (1 flag)
| Flag | Phase | Post-deploy approval pointer (from `notes`) |
|------|-------|----------------------------------------------|
| `offboarding-ip-foundation` | 74 | Gates `workflow:override_blocking_task` permission + PTO-aware fallback routing. Werkvertrag wording deferred to Phase 75. Needs legal verification of the override-dialog acknowledgement copy before production deploy. |

### `gulf.*` — F3 Gulf (2 flags)
| Flag | Phase | Post-deploy approval pointer (from `notes`) |
|------|-------|----------------------------------------------|
| `gulf.free-zone-tracking` | 79 | Legal review of free-zone authority legal names + payment-block lockout copy + NOC wording before APPROVED (arms a payment hard-block + auto-NOC items) |
| `gulf.saudization-dashboard` | 79 | Legal review of band/trajectory advisory copy before APPROVED; system never auto-computes the Nitaqat band (locked anti-feature) |

**Total: 24 PENDING flags** (6 `idp-deprovisioning*` + 16 `compliance-*` + 1
`offboarding-ip-foundation` + 2 `gulf.*`). Every one ships dark with a recorded post-deploy
approval pointer; full per-adviser routing of these legal items is in `80-LEGAL-SIGNOFF.md`.

## Velocity vs v5.0 Baseline

**Computation method:** plan-completion count = number of `NN-MM-PLAN.md` files per phase dir (one
landed plan each, all with a matching `NN-MM-SUMMARY.md`), summed per milestone, divided by the
**phase count** (plans/phase). Per-day velocity is not computed: v6.0 SUMMARY `completed:` dates
cluster heavily on a few execution sprints (e.g. 2026-05-31), so a plans/day denominator would be
misleading; plans/phase is the stable, comparable metric. Source dirs:
`.planning/milestones/v5.0-phases/` (phases 56–69) and `.planning/milestones/v6.0-phases/`
(phases 70–80).

| Milestone | Phases | Plans (PLAN.md) | Summaries (SUMMARY.md) | Plans / phase |
|-----------|--------|-----------------|------------------------|---------------|
| **v5.0** (UK & Germany Expansion) | 14 (56–69) | 70 | 70 | **5.0** |
| **v6.0** (Platform Maturity & Hardening) | 11 (70–80) | 83 | 82 → 83 with 80-04 | **7.5** |

**Comparison:** v6.0 ran **+13 plans (83 vs 70) across 3 fewer phases (11 vs 14)** — a per-phase
plan density of **7.5 vs 5.0, ≈ +50%**. The milestone packed more work into fewer, deeper phases:
v6.0 leaned on large foundation/saga phases (Phase 70 = 10 plans, Phase 76 = 10 plans) versus
v5.0's many small gap-closure phases (65–69 each ≤ 5 plans). v6.0 also absorbed two re-plans (Phase
73 re-planned against `apps/web-vite`; Phases 76/77 planned inline) and one PARTIAL phase (75 e-sign
deferred) without dropping the plans/phase density — the per-phase granularity (`fine`, per
`config.json`) held across the milestone.

## Post-Deploy Items (Non-Blocking)

Per the Standing Project Constraint (LOCAL-ONLY; legal review DEFERRED), these are recorded as
post-deploy tasks. They do NOT block milestone closure and create no STATE.md blocker.

1. **24 PENDING flag approvals** — flip each to APPROVED only after its `notes` legal review; full
   per-adviser routing in `80-LEGAL-SIGNOFF.md`.
2. **Pre-existing gate offenders (record-only, not phase-80 regressions):**
   `apps/api/src/routes/csp-report.ts:86` (`lint:logs`), `UserPinnedView` missing `organizationId`
   (`lint:schema`), `ManualOverrideCategory` enum casing (`db:audit-enum-casing`). Each can be
   closed in a dedicated cleanup pass; none is a v6.0-verification-scope failure.
3. **`pnpm audit` advisories** (1 critical / 2 high / 6 moderate / 1 low) — triage under the 7-day
   release-age policy; the critical (`vitest` UI) is dev-tooling-only, the Hono cluster is
   `apps/public-api`-scoped. Re-run `pnpm audit` + `pnpm security:scan` after any bump.
4. **Gitleaks secret scan in CI** — could not run locally (no binary + Docker daemon down). CI must
   execute the gitleaks leg of `security:scan`; this run recorded the environment limitation, not a
   clean secret-scan result.
5. **Phase 75 e-sign IP-ratification signing + webhook atomic flow** — DEFERRED (needs
   `SigningEnvelope.documentType`/metadata column + template→PDF→R2 render pipeline); see STATE.md.
6. **Phase 78 DRY refactor (78 WR-1)** — consolidate the 3 per-provider connection routers into
   `deprovisioning.enableProviderForOrg`; deferred (coordinated UI+API surface).

## Verdict: PASSED — milestone-complete pending post-deploy

v6.0 (Platform Maturity & Operational Hardening, phases 70–80) reaches milestone close. All 14 D-04
gates were re-run and recorded: **9 PASS**, **3 pre-existing committed offenders** (all from the
`apps/api` scaffold or Phase 76 IdP schema — none introduced by phase 80, all recorded not fixed),
and **2 recorded-only** dependency/security results (`pnpm audit` advisory inventory + a
`security:scan` whose gitleaks leg is environment-unavailable locally and is routed to CI). The
SC#1 cross-feature integration test (Plan 80-01) is **GREEN 11/11**, proving F1+F3+F4 compose. All
24 PENDING Unleash flags are inventoried by namespace with their post-deploy approval pointers, and
plan-completion velocity (**7.5 plans/phase vs the v5.0 baseline of 5.0, ≈ +50%**) is recorded.

Under the **LOCAL-ONLY / DEFERRED** Standing Project Constraint, the post-deploy items above — legal
sign-offs, the 24 dark flags, the recorded pre-existing offenders, the `pnpm audit` triage, the CI
gitleaks run, and the Phase 75/78 deferred slices — **do not block milestone closure**. Phase 80 is
the final v6.0 phase; with `80-01` (integration test), `80-02` (`80-HUMAN-UAT.md`), `80-03`
(`80-LEGAL-SIGNOFF.md`), and this `80-RETROSPECTIVE.md` complete, the v6.0 milestone is
**complete pending the recorded post-deploy review items**.

---
*Phase: 80-v6-0-verification-hardening-manual-uat — Plan 80-04 (D-04 + D-05)*
*Completed: 2026-06-05*
