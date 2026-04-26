---
phase: 76
slug: f2-idp-capability-mixin-saga-schema-cooldown-gate-gws-scope
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-27
---

# Phase 76 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (monorepo) |
| **Config files** | `packages/idp-saga/vitest.config.ts` (NEW); existing per-package configs for `@contractor-ops/feature-flags`, `@contractor-ops/integrations`, `@contractor-ops/api`, `@contractor-ops/lint-guards`, `@contractor-ops/db`, `apps/web` |
| **Quick run command** | `pnpm --filter @contractor-ops/idp-saga test` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~45 seconds (full); ~3 seconds (idp-saga slice) |

---

## Sampling Rate

- **After every task commit:** Run the package-scoped quick command for the package(s) the task modified (e.g., `pnpm --filter @contractor-ops/idp-saga test`).
- **After every plan wave:** Run `pnpm test` (full monorepo suite).
- **Before `/gsd-verify-work`:** Full suite green PLUS `pnpm lint:scopes && pnpm lint:schema && pnpm lint:logs && pnpm i18n:parity && pnpm typecheck` all green.
- **Max feedback latency:** 5 seconds for the saga slice; 60 seconds for the full suite.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 76-01-01 | 01 | 0 | (Wave 0 Nyquist) | T-76-01 | Failing-test scaffolds compile; baseline RED | scaffold | `pnpm --filter @contractor-ops/idp-saga test` | ❌ W0 | ⬜ pending |
| 76-01-02 | 01 | 0 | (Wave 0 Nyquist) | T-76-01 | Signoff-registry RED test asserts entry absent | scaffold | `pnpm --filter @contractor-ops/feature-flags test signoff-registry-flags-idp-entries` | ❌ W0 | ⬜ pending |
| 76-01-03 | 01 | 0 | IDP-08, IDP-09, IDP-10, IDP-13 | T-76-01 | All saga function stubs compile-error or throw `Not implemented` (RED) | scaffold | `pnpm --filter @contractor-ops/idp-saga test cooldown run-status provenance gc` | ❌ W0 | ⬜ pending |
| 76-02-01 | 02 | 1 | IDP-09, IDP-10 | T-76-02-01 | Schema migration applies via `prisma db push` (single-region happy path) | unit | `pnpm --filter @contractor-ops/db db:generate` | ✅ | ⬜ pending |
| 76-02-02 | 02 | 1 | IDP-09, IDP-10 | T-76-02-01 | `lint:schema` passes — all multi-tenant models declare `organizationId` | unit | `pnpm lint:schema` | ✅ | ⬜ pending |
| 76-02-03 | 02 | 1 | IDP-02 | T-76-02-02 | `ContractorAssignment.endedAt` column exists | unit | `grep -q "endedAt" packages/db/prisma/schema/contractor.prisma` | ✅ | ⬜ pending |
| 76-02-04 | 02 | 1 | IDP-09, IDP-10, IDP-13 | T-76-02-03 | Multi-region apply documented; manual-step note in plan SUMMARY | manual | (manual checklist — see Manual-Only Verifications below) | ❌ | ⬜ pending |
| 76-03-01 | 03 | 1 | IDP-08 | T-76-03-01 | `Deprovisionable` interface exported; non-implementing class rejected by `tsc` | typecheck | `pnpm --filter @contractor-ops/integrations typecheck` | ✅ | ⬜ pending |
| 76-03-02 | 03 | 1 | IDP-14 | T-76-03-02 | `GOOGLE_WORKSPACE_DEPROVISION_SCOPES` typed-const exists with the GWS admin scope | unit | `pnpm --filter @contractor-ops/integrations test deprovisionable-contract` | ✅ | ⬜ pending |
| 76-03-03 | 03 | 1 | IDP-10 | T-76-03-03 | `IDP_AUDIT_ALLOWED_FIELDS` includes `runId, stepId, requestSha256, responseSha256, attempts, stepKind, failureKind, matchedProvenanceId` | unit | `pnpm --filter @contractor-ops/logger test idp-audit-logger-fields` | ✅ | ⬜ pending |
| 76-04-01 | 04 | 1 | IDP-02 | T-76-04-01 | `canStartDeprovisioning` returns `{ allowed: false, reason: '14-day cooldown active...' }` for endedAt-10-days-ago in `Europe/Berlin` | unit | `pnpm --filter @contractor-ops/idp-saga test cooldown` | ✅ | ⬜ pending |
| 76-04-02 | 04 | 1 | IDP-09 | T-76-04-02 | `deriveRunStatus` returns COMPLETED/PARTIAL_FAILURE/FAILED/IN_PROGRESS per fixture | unit | `pnpm --filter @contractor-ops/idp-saga test run-status` | ✅ | ⬜ pending |
| 76-04-03 | 04 | 1 | IDP-13 | T-76-04-03 | `provenanceLookup` returns null on cold table; `{ id }` on hit; UPDATE atomic (concurrent-call test) | unit | `pnpm --filter @contractor-ops/idp-saga test provenance` | ✅ | ⬜ pending |
| 76-04-04 | 04 | 1 | IDP-13 | T-76-04-04 | `gcExpiredProvenance` deletes rows older than 90d; idempotent (second call deletes 0) | unit | `pnpm --filter @contractor-ops/idp-saga test gc` | ✅ | ⬜ pending |
| 76-05-01 | 05 | 1 | IDP-02 | T-76-05-01 | tRPC `getDeprovisioningEligibility` query returns same decision as helper for matching inputs | integration | `pnpm --filter @contractor-ops/api test deprovisioning-eligibility` | ✅ | ⬜ pending |
| 76-05-02 | 05 | 1 | IDP-10 | T-76-05-02 | Eligibility query emits `getIdpAuditLogger()` line on every call (audit-grade) | integration | Same command — additional assertion | ✅ | ⬜ pending |
| 76-06-01 | 06 | 2 | IDP-09 | T-76-06-01 | `startDeprovisioningRun` enqueues N independent QStash jobs; transaction commits before fan-out | integration | `pnpm --filter @contractor-ops/api test deprovisioning-start` | ✅ | ⬜ pending |
| 76-06-02 | 06 | 2 | IDP-10 | T-76-06-02 | `retryDeprovisioningStep` rejects steps not in FAILED state; idempotent on double-click | integration | `pnpm --filter @contractor-ops/api test deprovisioning-retry` | ✅ | ⬜ pending |
| 76-06-03 | 06 | 2 | IDP-09 | T-76-06-03 | `_step-runner` route inserts provenance BEFORE adapter call; calls `recomputeRunStatus` after | integration | `pnpm --filter @contractor-ops/api test deprovisioning-step-runner` | ✅ | ⬜ pending |
| 76-06-04 | 06 | 2 | IDP-09 | T-76-06-04 | Aggregate run status reflects derived rule (COMPLETED on all-success; PARTIAL_FAILURE mix; FAILED all-fail-at-max) | integration | Same command, multiple `it()` cases | ✅ | ⬜ pending |
| 76-07-01 | 07 | 2 | IDP-14 | T-76-07-01 | `lint:scopes` passes when adapter scopes match typed-const; fails when literal added without typed-const | integration | `pnpm --filter @contractor-ops/lint-guards test scopes-guard` | ✅ | ⬜ pending |
| 76-07-02 | 07 | 2 | IDP-14 | T-76-07-02 | Root `pnpm lint:scopes` runs end-to-end (no offences in current adapter set) | smoke | `pnpm lint:scopes` | ✅ | ⬜ pending |
| 76-07-03 | 07 | 2 | IDP-14 | T-76-07-03 | `.husky/pre-push` hook line includes `lint:scopes`; CI workflow yml includes `lint:scopes` | smoke | `grep -q 'lint:scopes' .husky/pre-push` + `grep -q 'lint:scopes' .github/workflows/*.yml` | ✅ | ⬜ pending |
| 76-08-01 | 08 | 2 | IDP-11 | T-76-08-01 | `GoogleWorkspaceReconnectBanner` renders write-access variant when capabilities lack `directory.user.write` | unit (RTL) | `pnpm --filter @contractor-ops/web test google-workspace-reconnect-banner-write-access` | ✅ | ⬜ pending |
| 76-08-02 | 08 | 2 | IDP-11 | T-76-08-02 | OAuth start URL includes `prompt=consent` query param | unit | Same command | ✅ | ⬜ pending |
| 76-08-03 | 08 | 2 | IDP-11 | T-76-08-03 | OAuth callback writes `directory.user.write` capability into `scopeCapabilities.capabilities` | integration | `pnpm --filter @contractor-ops/api test google-workspace-oauth-callback` | ✅ | ⬜ pending |
| 76-08-04 | 08 | 2 | IDP-11 | T-76-08-04 | Existing v3.0 read-only directory-import keeps working after scope upgrade (regression guard) | integration | `pnpm --filter @contractor-ops/integrations test google-workspace-directory-import` | ✅ | ⬜ pending |
| 76-08-05 | 08 | 2 | IDP-11 | T-76-08-05 | i18n parity: `integrations.gws.banner.writeAccessRequired.*` keys present in en, de, pl, ar | unit | `pnpm i18n:parity` | ✅ | ⬜ pending |
| 76-09-01 | 09 | 3 | IDP-08 | T-76-09-01 | GWS adapter `implements Deprovisionable`; `suspendAccount` + `revokeAllSessions` + `verifyDeprovisioned` exist | typecheck | `pnpm --filter @contractor-ops/integrations typecheck` | ✅ | ⬜ pending |
| 76-09-02 | 09 | 3 | IDP-08 | T-76-09-02 | GWS suspendAccount → MSW → result.status === 'SUCCEEDED'; verifyDeprovisioned within 5 min via vi.useFakeTimers | unit | `pnpm --filter @contractor-ops/integrations test google-workspace-deprovision` | ✅ | ⬜ pending |
| 76-09-03 | 09 | 3 | IDP-13 | T-76-09-03 | GWS `handleWebhook` user-suspended event with matching IdpChangeProvenance returns `{ suppressed: true }` | unit | `pnpm --filter @contractor-ops/integrations test google-workspace-webhook-provenance` | ✅ | ⬜ pending |
| 76-09-04 | 09 | 3 | IDP-13 | T-76-09-04 | GWS `handleWebhook` user-suspended event WITHOUT match falls through to default v3.0 path | unit | Same command | ✅ | ⬜ pending |
| 76-10-01 | 10 | 3 | IDP-08 | T-76-10-01 | D-16 template test (GWS) is the canonical example; comments document Phase 77/78 reuse pattern | unit | `pnpm --filter @contractor-ops/integrations test google-workspace-deprovision` | ✅ | ⬜ pending |
| 76-10-02 | 10 | 3 | IDP-13 | T-76-10-02 | GC cron sub-task wired into `apps/web/src/app/api/cron/reminders/route.ts`; daily run schedule | integration | `pnpm --filter @contractor-ops/web test cron-reminders` | ✅ | ⬜ pending |
| 76-10-03 | 10 | 3 | IDP-15 | T-76-10-03 | RTL render of contractor profile + ENDED contractor list — no "Reactivate" button rendered | unit (RTL) | `pnpm --filter @contractor-ops/web test no-reactivate-button` | ✅ | ⬜ pending |
| 76-10-04 | 10 | 3 | IDP-15 | T-76-10-04 | Static grep across `apps/web/src` + `apps/web/messages/*.json` returns no matches for /reactivate.*contractor/i | unit | Same command — companion grep test | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/idp-saga/src/__tests__/cooldown.test.ts` — failing stubs for IDP-02 (cooldown rule)
- [ ] `packages/idp-saga/src/__tests__/run-status.test.ts` — failing stubs for IDP-09 (deriveRunStatus rule)
- [ ] `packages/idp-saga/src/__tests__/provenance.test.ts` — failing stubs for IDP-13 (lookup + atomic update)
- [ ] `packages/idp-saga/src/__tests__/gc.test.ts` — failing stub for D-12 (90-day GC)
- [ ] `packages/integrations/src/__tests__/deprovisionable-contract.test.ts` — typecheck-fails RED test for IDP-08
- [ ] `packages/integrations/src/adapters/__tests__/google-workspace-deprovision.test.ts` — failing stubs for IDP-08 (template)
- [ ] `packages/integrations/src/adapters/__tests__/google-workspace-webhook-provenance.test.ts` — failing stubs for IDP-13
- [ ] `packages/api/src/__tests__/deprovisioning-start.test.ts` — failing for IDP-09 (saga start)
- [ ] `packages/api/src/__tests__/deprovisioning-retry.test.ts` — failing for IDP-10 (manual retry)
- [ ] `packages/api/src/__tests__/deprovisioning-step-runner.test.ts` — failing for IDP-09 (step runner)
- [ ] `packages/api/src/__tests__/deprovisioning-eligibility.test.ts` — failing for IDP-02
- [ ] `packages/api/src/__tests__/google-workspace-oauth-callback.test.ts` — failing for IDP-11 (write-access capability write)
- [ ] `packages/feature-flags/src/__tests__/signoff-registry-flags-idp-entries.test.ts` — failing until JSON registers `idp-deprovisioning`
- [ ] `packages/logger/src/__tests__/idp-audit-logger-fields.test.ts` — failing for D-15 audit-fields extension
- [ ] `packages/lint-guards/src/scopes-guard/__tests__/run-guard.test.ts` — failing for IDP-14
- [ ] `apps/web/src/components/integrations/__tests__/google-workspace-reconnect-banner-write-access.test.tsx` — failing for IDP-11 RTL
- [ ] `apps/web/src/__tests__/no-reactivate-button.test.tsx` — failing for IDP-15 absence test
- [ ] `apps/web/src/__tests__/cron-reminders-gc-provenance.test.ts` — failing until GC sub-task wired (Plan 76-10)
- [ ] `packages/idp-saga/package.json` + `tsconfig.json` + `vitest.config.ts` + `src/index.ts` skeleton — typecheck green; runtime stubs throw `Not implemented`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Multi-region schema migration applied (EU + ME) | IDP-09, IDP-10, IDP-13 | LOCAL-ONLY constraint — engineer runs `npx tsx packages/db/scripts/push-all-regions.ts` against actual regional DBs after Plan 76-02 lands. Standing constraint. | 1. Plan 76-02 ships schema + generated migration SQL. 2. Engineer reviews SQL diff. 3. Run `npx tsx packages/db/scripts/push-all-regions.ts` against `DATABASE_URL_EU` and `DATABASE_URL_ME` (set as env). 4. Verify pino log emits `region: 'EU'` and `region: 'ME'` ok. |
| Legal review of `idp-deprovisioning` flag entry | IDP-08, IDP-13 | Project standing constraint = legal review DEFERRED post-deploy. Phase 76 ships entry as PENDING. | 1. Confirm `idp-deprovisioning` entry exists in `packages/feature-flags/src/signoff-registry-flags.json` with `status: PENDING`. 2. Post-deploy: legal/compliance team reviews cooldown semantics + cross-border data-handling implications. 3. Separate PR flips PENDING → APPROVED with `legalTicketRef`. |
| GWS write-access banner shown to a real engineer | IDP-11 | The banner only shows when an actual `IntegrationConnection` exists with `scopeCapabilities` lacking `directory.user.write`. Component-level RTL covers the rendering; the end-to-end behaviour requires a real OAuth flow against Google Workspace. | After Plan 76-08 lands: 1. Connect GWS via existing v3.0 flow (read-only). 2. Confirm banner appears with "Re-OAuth required for write access" copy. 3. Click reconnect → Google consent screen with `prompt=consent`. 4. Approve → callback writes `directory.user.write` into JSONB; banner disappears. |
| Per-provider deprovisioning works against actual provider sandboxes (GWS) | IDP-08 | LOCAL-ONLY constraint = no live sandbox in CI. MSW-mocked tests cover happy path + error branches. | After Phases 77-78 introduce real adapter implementations: schedule a one-off manual test against a Google Workspace sandbox tenant per the `/gsd-verify-work` UAT instructions. Phase 76 ships the test template (D-16) only. |
| Webhook self-trigger filter end-to-end | IDP-13 | Real webhook delivery from GWS requires a live provider connection. MSW + integration tests cover all branches; the production cycle is verified post-deploy. | Post-deploy with a real GWS connection: 1. Trigger `startDeprovisioningRun` for a sandbox contractor. 2. Confirm GWS sends `user.suspended` webhook. 3. Confirm `IdpChangeProvenance.matchedAt` is populated and v3.0 directory-import does NOT fire `user-departed` notification. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every plan has at least one auto-verify task)
- [x] Wave 0 covers all MISSING references (19 RED scaffolds map 1:1 to verification rows above)
- [x] No watch-mode flags (`vitest run` is non-watch by default per `packages/lint-guards/package.json` precedent)
- [x] Feedback latency < 60s (full suite); < 5s (saga slice)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-27 — ready for Wave 0.
