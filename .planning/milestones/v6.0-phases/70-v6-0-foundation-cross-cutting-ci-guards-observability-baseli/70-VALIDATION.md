---
phase: 70
slug: v6-0-foundation-cross-cutting-ci-guards-observability-baseli
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-26
---

# Phase 70 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Foundation phase — every CI guard introduced here must itself be unit-tested with <3s feedback so future PRs can land without flakiness.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (existing — `packages/*/vitest.config.ts`, `apps/web/vitest.config.ts`) |
| **Config file** | per-package `vitest.config.ts` (no new config needed) |
| **Quick run command** | `pnpm --filter @contractor-ops/<pkg> test` (per package, <3s) |
| **Full suite command** | `pnpm test && pnpm lint:schema && pnpm lint:logs && pnpm i18n:parity` |
| **Estimated runtime** | ~45s full / <3s per-package quick |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @contractor-ops/<pkg-touched> test` for the touched package.
- **After every plan wave:** Run `pnpm test` (turbo orchestrates per-package).
- **Before `/gsd-verify-work`:** Full suite + all three new lint commands must be green.
- **Max feedback latency:** **3 seconds** per-package vitest run (Nyquist requirement — schema/log/i18n changes happen on every PR).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 70-01-01 | 01 | 0 | FOUND6-01 | P27 | Failing test scaffold for missing-organizationId detection on a fixture .prisma file | unit (vitest) | `pnpm --filter @contractor-ops/lint-guards test schema-guard` | ❌ W0 | ⬜ pending |
| 70-01-02 | 01 | 0 | FOUND6-02 | P28 | Failing test scaffold for ts-morph body-log AST detection on fixture .ts files | unit (vitest) | `pnpm --filter @contractor-ops/lint-guards test logs-guard` | ❌ W0 | ⬜ pending |
| 70-01-03 | 01 | 0 | FOUND6-03 | P29 | Failing test scaffold for EN-key-missing-from-DE/PL/AR detection on fixture JSON dirs | unit (vitest) | `pnpm --filter @contractor-ops/lint-guards test i18n-parity` | ❌ W0 | ⬜ pending |
| 70-01-04 | 01 | 0 | FOUND6-04 | P30 | Failing test scaffold for boot-time signoff-registry gate (process.exit spy) | unit (vitest) | `pnpm --filter @contractor-ops/feature-flags test signoff-registry-flags` | ❌ W0 | ⬜ pending |
| 70-01-05 | 01 | 0 | FOUND6-02 | P28 | Failing test scaffold for default-redact body in logger root | unit (vitest) | `pnpm --filter @contractor-ops/logger test default-body-redact` | ❌ W0 | ⬜ pending |
| 70-01-06 | 01 | 0 | FOUND6-06 | P28 | Failing test scaffold for getIdpAuditLogger() allow-list semantics | unit (vitest) | `pnpm --filter @contractor-ops/logger test idp-audit-logger` | ❌ W0 | ⬜ pending |
| 70-01-07 | 01 | 0 | FOUND6-05 | P31 | Failing test scaffold for scopeCapabilities backfill correctness | unit (vitest) | `pnpm --filter @contractor-ops/db test scope-capabilities-backfill` | ❌ W0 | ⬜ pending |
| 70-01-08 | 01 | 0 | FOUND6-05 | P31 | Failing test scaffold for GoogleWorkspaceReconnectBanner visibility logic | unit (vitest+RTL) | `pnpm --filter @contractor-ops/web test google-workspace-reconnect-banner` | ❌ W0 | ⬜ pending |
| 70-02-01 | 02 | 1 | FOUND6-01 | P27 | `lint:schema` parses .prisma files, fails on multi-tenant model without organizationId not in allowlist | unit | `pnpm --filter @contractor-ops/lint-guards test schema-guard` | ❌ W0 | ⬜ pending |
| 70-02-02 | 02 | 1 | FOUND6-01 | P27 | Allowlist constant `GLOBAL_LOOKUP_MODELS_ALLOWLIST` typed and reviewed; failing model emits structured diff matching D-03 shape | integration | `pnpm lint:schema` (via fixture project) | ❌ W0 | ⬜ pending |
| 70-03-01 | 03 | 1 | FOUND6-02 | P28 | Logger root default-redacts `body` key; `[REDACTED]` appears in serialized output | unit | `pnpm --filter @contractor-ops/logger test default-body-redact` | ❌ W0 | ⬜ pending |
| 70-03-02 | 03 | 1 | FOUND6-02 | P28 | `withBodyLogging(parent, ['router.proc'])` returns child whose body field is plaintext for matching procedures, redacted otherwise | unit | `pnpm --filter @contractor-ops/logger test with-body-logging` | ❌ W0 | ⬜ pending |
| 70-03-03 | 03 | 1 | FOUND6-02 | P28 | `lint:logs` ts-morph scan emits `.lint-logs-baseline.json` listing every `body:` log site and fails when an unlisted-prefix call appears | integration | `pnpm lint:logs` (via fixture .ts files) | ❌ W0 | ⬜ pending |
| 70-03-04 | 03 | 1 | FOUND6-02 | P28 | `LOG_BODY_INCLUDE_PREFIXES` constant ships empty; entry without `// reason: ...` comment fails lint | unit | `pnpm --filter @contractor-ops/lint-guards test logs-guard --grep reason-comment` | ❌ W0 | ⬜ pending |
| 70-04-01 | 04 | 1 | FOUND6-03 | P29 | `i18n:parity` flattens en.json + de.json + pl.json + ar.json keysets, fails when EN ⊄ {DE, PL, AR} | unit | `pnpm --filter @contractor-ops/lint-guards test i18n-parity` | ❌ W0 | ⬜ pending |
| 70-04-02 | 04 | 1 | FOUND6-03 | P29 | Locked-phrases-guard 78/78 still passes (regression check) | unit | `pnpm --filter @contractor-ops/validators exec vitest run locked-phrases-guard` | ✅ existing | ⬜ pending |
| 70-05-01 | 05 | 1 | FOUND6-04 | P30 | Zod schema for flag signoff entries (PENDING/APPROVED + legalTicketRef regex `LEGAL-\d+|https?://`) parses valid + rejects invalid | unit | `pnpm --filter @contractor-ops/feature-flags test signoff-registry-flags-schema` | ❌ W0 | ⬜ pending |
| 70-05-02 | 05 | 1 | FOUND6-04 | P30 | `GATED_FLAG_NAMESPACE_PREFIXES` constant covers compliance-/idp-deprovisioning/gulf-/offboarding-ip- with helper `isGatedFlag` returning true for matches | unit | `pnpm --filter @contractor-ops/feature-flags test is-gated-flag` | ❌ W0 | ⬜ pending |
| 70-06-01 | 06 | 2 | FOUND6-01..03 | P27 P28 P29 | `.github/workflows/ci.yml` invokes `pnpm lint:schema && pnpm lint:logs && pnpm i18n:parity` before Test step | integration | `grep -E 'lint:(schema|logs)\|i18n:parity' .github/workflows/ci.yml \| wc -l` returns ≥3 | ❌ W0 | ⬜ pending |
| 70-06-02 | 06 | 2 | FOUND6-01..03 | P27 P28 P29 | `.husky/pre-push` runs all three lint commands sequentially after format/lint | integration | `grep -E 'lint:(schema\|logs)\|i18n:parity' .husky/pre-push` returns 1 line | ❌ W0 | ⬜ pending |
| 70-06-03 | 06 | 2 | FOUND6-01..03 | — | `docs/lint-remediation/{lint-schema,lint-logs,i18n-parity}.md` exist with anchors `#missing-organization-id`, `#unredacted-body-log`, `#missing-translation-key` | unit | `test -f docs/lint-remediation/lint-schema.md && grep -q 'missing-organization-id' docs/lint-remediation/lint-schema.md` | ❌ W0 | ⬜ pending |
| 70-07-01 | 07 | 2 | FOUND6-04 | P30 | `packages/feature-flags/src/registry.ts` boot-time iteration calls `assertSignoffForGatedNamespace` and `process.exit(1)`s on missing/invalid entry | unit | `pnpm --filter @contractor-ops/feature-flags test boot-gate` | ❌ W0 | ⬜ pending |
| 70-07-02 | 07 | 2 | FOUND6-04 | P30 | Boot proceeds when `FLAG_SIGNOFF_BYPASS=local` env var set (LOCAL-ONLY constraint) | unit | `pnpm --filter @contractor-ops/feature-flags test boot-gate-bypass` | ❌ W0 | ⬜ pending |
| 70-08-01 | 08 | 2 | FOUND6-06 | P28 | `getIdpAuditLogger()` returns child logger; `externalUserId` plaintext, `password`/`token` redacted | unit | `pnpm --filter @contractor-ops/logger test idp-audit-logger` | ❌ W0 | ⬜ pending |
| 70-08-02 | 08 | 2 | FOUND6-06 | — | `IdpAuditEvent` TS type rejects calls missing `auditEvent`, allows whitelisted fields, rejects extras at compile time | unit | `pnpm --filter @contractor-ops/logger typecheck` (tsc strict) | ✅ existing | ⬜ pending |
| 70-09-01 | 09 | 3 | FOUND6-05 | P31 | `IntegrationConnection.scopeCapabilities Json?` field present in Prisma schema; client typegen succeeds | unit | `pnpm --filter @contractor-ops/db db:generate && grep -q 'scopeCapabilities' packages/db/src/generated/index.d.ts` | ❌ W0 | ⬜ pending |
| 70-09-02 | 09 | 3 | FOUND6-05 | P31 | Backfill script populates `directory.read` + `group.read` capabilities for every existing GOOGLE_WORKSPACE connection; idempotent (second run no-op) | unit | `pnpm --filter @contractor-ops/db test scope-capabilities-backfill` | ❌ W0 | ⬜ pending |
| 70-09-03 | 09 | 3 | FOUND6-05 | — | Multi-region runner script (or documented loop) executes backfill against EU + ME databases via `push-all-regions`-style env iteration | manual (deferred) | See "Manual-Only" below | ❌ W0 | ⬜ pending |
| 70-10-01 | 10 | 3 | FOUND6-05 | P31 | `GoogleWorkspaceReconnectBanner` renders when `scopeCapabilities.capabilities` lacks `user.deprovision`, hides when present | unit (RTL) | `pnpm --filter @contractor-ops/web test google-workspace-reconnect-banner` | ❌ W0 | ⬜ pending |
| 70-10-02 | 10 | 3 | FOUND6-03 | P29 | New banner i18n keys present in en.json + de.json + pl.json + ar.json — `pnpm i18n:parity` stays green | integration | `pnpm i18n:parity` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/lint-guards/` — new package with `package.json`, `tsconfig.json`, `vitest.config.ts`, scripts entrypoints, allowlist constants. Failing test stubs for `schema-guard.test.ts`, `logs-guard.test.ts`, `i18n-parity.test.ts`.
- [ ] `packages/feature-flags/src/__tests__/signoff-registry-flags.test.ts` — failing test scaffold for boot-time gate.
- [ ] `packages/logger/src/__tests__/default-body-redact.test.ts` — failing scaffold for default-redact behaviour.
- [ ] `packages/logger/src/__tests__/with-body-logging.test.ts` — failing scaffold for opt-in body logging.
- [ ] `packages/logger/src/__tests__/idp-audit-logger.test.ts` — failing scaffold for `getIdpAuditLogger()` allow-list.
- [ ] `packages/db/src/__tests__/scope-capabilities-backfill.test.ts` — failing scaffold for backfill correctness (uses Prisma test util).
- [ ] `apps/web/src/components/integrations/__tests__/google-workspace-reconnect-banner.test.tsx` — failing scaffold for banner visibility.
- [ ] `docs/lint-remediation/.gitkeep` — placeholder so plans 02–04 can drop remediation .md files into a tracked directory.

**No new framework install.** Vitest already runs in every target package. The new `@contractor-ops/lint-guards` package reuses the workspace vitest config pattern (`packages/validators/vitest.config.ts` is the closest analog).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Multi-region backfill executes against EU + ME databases (D-14) | FOUND6-05 | Requires real `DATABASE_URL_EU` + `DATABASE_URL_ME` connection strings — not available in CI without secret leakage; LOCAL-ONLY constraint means we don't have a hosted multi-region staging | After Plan 09 lands: developer runs `tsx packages/db/scripts/backfill-scope-capabilities.ts` once with `DATABASE_URL=$DATABASE_URL_EU`, again with `DATABASE_URL=$DATABASE_URL_ME`. Logs show row count touched per region; second run reports 0 updates (idempotent). |
| Husky `pre-push` actually fires three new commands on a real `git push` | FOUND6-01..03 | Husky behaviour can only be observed against a real git operation | Developer creates a temp branch with a synthetic violation (e.g., new model without organizationId), runs `git push origin HEAD:nope`, observes the push aborts with the structured-diff D-03 output; reverts. |
| Banner visibility on a real GWS connection rendered in the app shell | FOUND6-05 | Real OAuth flow + Prisma row required | Developer connects a sandbox GWS account, observes banner appears; clicks reconnect (no new scopes in Phase 70 — flow returns to settings page); banner remains until Phase 76 adds capabilities. |
| LOCAL-ONLY signoff bypass actually unblocks dev boot | FOUND6-04 | Requires running `pnpm dev` against a fresh checkout missing the new signoff JSON | Developer unsets `FLAG_SIGNOFF_BYPASS`, runs `pnpm dev` with deliberately broken `signoff-registry-flags.json` — boot fails with `[FLAG-SIGNOFF]` error. Sets `FLAG_SIGNOFF_BYPASS=local`, re-runs — boot proceeds with `warn` log. |

*Legal review (D-12 sign-off content correctness — whether `LEGAL-123` is actually a real ticket): **DEFERRED per Standing Project Constraints**. Recorded as post-deploy item.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (one task per row above maps to a `pnpm ... test` command)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (manual-only items above are post-implementation, not interspersed with build tasks)
- [ ] Wave 0 covers all MISSING references (`packages/lint-guards/` is the new home; existing packages get `__tests__/` additions)
- [ ] No watch-mode flags (every command above runs `vitest run` semantics, not `vitest`)
- [ ] Feedback latency < 3s per package (existing vitest configs hit this; new `@contractor-ops/lint-guards` uses small fixture trees — confirmed by D-07's "AST scan allowed to be slow as long as correct" provided full-repo scan stays in CI, not pre-task)
- [ ] `nyquist_compliant: true` set in frontmatter — flip after Wave 0 lands

**Approval:** pending
