# Codebase Review Handover — 2026-07-05

Full-surface review of contractor-ops (6 parallel investigators: packages/api, web-vite, server apps, domain packages + data layer, planning-vs-code gap, tests + quality gates). **Extended same day with a 4-investigator integration-reliability pass (outbound delivery, gov e-invoicing sync, payments, saga/cron execution) — see "ADDENDUM: Integration reliability" at the end; its INT-0 tier ranks alongside TIER 0.** This document is written for execution by lower-tier models: every task has exact paths, the fix, and an acceptance check. **Read `CLAUDE.md` in full before starting any task.** Judgments below are final — do not re-litigate severity or re-investigate CONFIRMED items; do re-read the cited code before editing (Read-before-Edit is enforced by the runtime).

## Baseline at review time

- `main` @ `c6c94708a` (92 wave-1 slices 02–05 merged). `pnpm typecheck`: 42/42 green.
- Tests: packages/api 3921 passed / 5 failed; all small packages green except `iris` (2 files, known XSD-bundle gap); apps/api **25 of 32 test files fail at import** (env, single root cause); cron-worker 4 failed (real regression); public-api green (117).
- Gates: `lint:no-breadcrumbs` PASS, `check:web-vite-data-layer` PASS, `check:wiki-brain` PASS (1 warn), `check:no-process-env` **FAIL (184 vs baseline 182)**.
- `pnpm audit --prod`: 49 vulns — 14 high / 27 moderate / 8 low.

## Hard rules for executors (violations = rejected work)

1. NEVER run the full web-vite test suite unscoped — always `pnpm --filter @contractor-ops/web-vite test <path>`. Never `pnpm test` at repo root.
2. NEVER `git stash` / `reset --hard` / `checkout --` / `restore`. Another session is actively recovering worktrees — see "Out of scope" below.
3. Every product-code change in `apps/` or `packages/` requires a wiki update in the SAME change set (`.planning/brain/wiki/...` + `log.md` + `hot.md` + `pnpm check:wiki-brain`). Test-only changes exempt.
4. No planning/phase IDs in source comments (`lint:no-breadcrumbs` gates). Keep the WHY, drop the ID.
5. New i18n keys go to ALL FOUR locales: en, de, pl, ar. packages/api error keys have their own parity test.
6. `semble search` before grep; Read before Edit; minimal diffs; no bulk sed/awk scripts.
7. Dependency upgrades: respect 7-day `minimumReleaseAge`; after upgrade run `pnpm audit` + `pnpm security:scan`.
8. Commits: conventional, no phase-ID breadcrumbs in code, traceability in the commit message.

## Out of scope — DO NOT TOUCH

- **Worktree recovery** (phases 87 slice-9 commit, 92-01 re-run, worktree pruning under `.claude/worktrees/`): owned by another live session. Do not commit, merge, or prune anything there. Includes the uncommitted `20260701000000_ewidencja_append_only` migration in worktree `agent-af928c3f...` — that session lands it.
- **Phase 86 execution** (IRIS transmitter 86-06, 1099 batch UI 86-07, state CFSF 86-08): GSD-flow work, not ad-hoc fixes. Tasks below only ANNOTATE the dark seams; wiring happens in phase 86.
- **Refuted security findings** (recorded in project memory): Infisical-SSRF and OAuth-redirect "gaps" were checked against source and refuted. Do not re-report or "fix".
- Human-action checkpoints: IRS IRIS XSD bundle download (86-01), Pub 1187 1042-S XSD, IRIS TCC enrollment (matures ~2026-07-22), multi-region prod migration apply, ar-locale legal-wording native review. Track, don't fake.

---

# TIER 0 — bugs and compliance defects (fix first, in this order)

### T0-1. cron-worker data-purge regression (4 failing tests)
- **Where:** `apps/cron-worker/src/jobs/handlers/data-purge.ts` (handler) + `apps/cron-worker/src/__tests__/data-purge.test.ts:103,121,174,196`.
- **Symptom:** handler returns `ok:false` where tests expect `ok:true`; in the retention-aware path a `cutoffOf` helper hits `TypeError: Cannot read properties of undefined (reading 'where')` and `deleteMany` is never reached. Introduced with the retention-aware purge (US-INFRA-03 era).
- **Fix:** debug the handler (not the tests — tests encode intended behavior: "returns ok=true with totalPurged 0 when nothing is expired", "purges R2 objects before the DB tx"). Likely a model-name/args mismatch between the purge list and the Prisma delegate lookup in `cutoffOf`.
- **Accept:** `pnpm --filter @contractor-ops/cron-worker test` → 59/59 green.

### T0-2. `EMPLOYEE_PII_ENCRYPTION_KEY` missing → 25 apps/api test files brick at import
- **Where:** `packages/validators/src/env.ts:494` (`validateServerEnv`) throws; chain: `packages/api/src/services/stripe-client.ts:4` module-scope `getServerEnv()` → `root.ts` → `apps/api/src/server.ts`.
- **Fix (two parts):** (a) add `EMPLOYEE_PII_ENCRYPTION_KEY` to local `.env` / the test env setup used by apps/api vitest (check how other required keys are provided — likely `apps/api/vitest.setup` or `.env.test`); confirm it is present in `.env.example` and add if missing. (b) Optional hardening: move the module-scope `getServerEnv()` in `stripe-client.ts` to lazy (inside the factory) so one missing var doesn't brick unrelated imports.
- **Accept:** `pnpm --filter @contractor-ops/api-server test` → all 32 files execute (35+ tests, 0 import errors).

### T0-3. RODO/GDPR erasure success path writes NO audit row
- **Where:** `packages/api/src/routers/core/personnel-file/erasure.ts:195-208`. Only the retained-under-statute branch calls audit (`auditRetainedUnderStatute`); the `disposition === 'erased'` branch soft-deletes documents with no `writeAuditLog`. Sibling `gdpr.ts:318` always writes `organization.erasure_requested`.
- **Fix:** always write a `personnel_file.erasure_requested` audit row inside the same transaction, payload carrying per-section dispositions (erased/retained map), actor, employee id. Mirror `gdpr.ts` shape. Use `writeAuditLog` from `packages/api/src/services/audit-writer.ts`, pass `tx`.
- **Accept:** new/updated test in the personnel-file erasure suite asserting an audit row on the erased path; scoped api tests green.
- **Wiki:** update personnel-file domain page (audit-trail row) same change set.

### T0-4. Org-creation hook never runs — offboarding seed templates never materialize
- **Where:** `packages/api/src/services/post-org-create-hook.ts:14` (`runPostOrganizationCreateHooks`) has zero callers. `packages/auth/src/config.ts:533` `organizationHooks` defines only `beforeCreateOrganization`.
- **Effect:** no org gets `WorkflowRoleTemplate` seeds; all run the degraded NULL-fallback.
- **Fix:** add `afterCreateOrganization` in `organizationHooks` calling `runPostOrganizationCreateHooks(prismaRaw, organization.id)` (check Better Auth v-current hook signature via context7 first). ALSO write a one-shot backfill script invocation path for existing orgs (idempotent — `upsertSeedTemplates` is an upsert), e.g. extend `seed-dev.ts` or add an admin-only maintenance procedure; do NOT leave existing orgs unseeded.
- **Accept:** integration test: create org → templates exist. Backfill run documented.
- **Wiki:** offboarding/workflow domain page.

### T0-5. 1042-S batch generation: non-transactional + no DB uniqueness → duplicate ACTIVE forms
- **Where:** `packages/api/src/services/form-1042s.service.ts:645` (persists per-recipient with `persist: ctx.db`, no `$transaction`), catch at `:707-710` clears the 24h Redis idempotency key but rolls back nothing; `packages/db/prisma/schema/tax.prisma` `Form1042S` has only an `@@index`, no unique. Contrast: `fileCorrection` (router `:310`) is correctly transactional.
- **Fix:** (a) wrap batch persistence in `ctx.db.$transaction` and pass the tx as `persist`; (b) add a Postgres partial unique index on `(organizationId, payerOrgId, recipientId, taxYear) WHERE status = 'ACTIVE'` — as a hand-authored additive migration (see T0-6, do together); handle P2002 as an idempotent skip.
- **Accept:** test simulating mid-batch throw → zero rows persisted; re-run after success → no duplicates.
- **Wiki:** 1042-S domain page.

### T0-6. Nine US tax-form models have NO CREATE TABLE migration (schema↔migration drift)
- **Where:** `packages/db/prisma/schema/tax.prisma` — `TaxFormSubmission`, `Form1099Nec`, `IrisSubmission`, `IrisAck`, `Tax1099Threshold`, `StateFilingConfig`, `Form1042S`, `Form1099KTrackerState`, `Tax1099KThreshold`. No migration under `packages/db/prisma/schema/migrations/**` creates them (baseline + additive ones checked; `20260701000000_phase88_us_payment_rail_schema` only ALTERs). Live routers query these models → fresh regional DB = `relation does not exist`. Local DBs work only because of db-push/dev drift.
- **Fix:** author one hand-written additive migration creating all nine tables exactly per schema (columns, enums, FKs, indexes) + `down.sql`, following the repo's existing `__*_additive` migration style and `migrate-all-regions.ts` flow. Include the T0-5 partial unique index. THEN add a CI drift check: script comparing `prisma migrate diff --from-migrations --to-schema-datamodel` (or equivalent) so schema↔migrations can't diverge silently again — wire next to `packages/db/scripts/check-generated-drift.ts`.
- **Accept:** `prisma migrate diff` reports empty; fresh shadow DB provisions and the form-1042s router tests pass against it.
- **Note:** prod apply stays a deferred ops action (local-only posture) — authoring is what's owed now.

### T0-7. packages/api i18n parity: `Errors.paymentSettlementRateUnavailable` missing in all 4 locales
- **Where:** `packages/api/src/__tests__/errors-i18n-parity.test.ts` (4 fails). Key referenced in code but absent from en/de/pl/ar error locale files.
- **Fix:** add the key to all four files (find them via the parity test's imports). en/de/pl full translations; ar translation + note for native review if legal-adjacent.
- **Accept:** parity test green.

### T0-8. Exports contract test stale (new determination-letter export type)
- **Where:** `packages/api/src/services/exports/__tests__/exports.test.ts:31` expects 8 registry entries; `EXPORT_REGISTRY` now has 9 (`classification-document-us-determination-letter` added in 87-05).
- **Fix:** update the test to 9 and assert the new key's shape (this is the contract test doing its job — the entry itself is legitimate and mounted).
- **Accept:** exports test green. Test-only → wiki exempt.

---

# TIER 1 — security hardening

### T1-1. public-api: unauthenticated DB-lookup amplification (no per-IP limiter)
- **Where:** `apps/public-api/src/lib/rate-limiter.ts:83-89` + `app.ts:106`. Rate-limit key = first 12 chars of the presented API key — attacker-rotatable; each fresh prefix = fresh bucket = one `prisma.organizationApiKey.findMany` against primary DB. No-`co_live_` requests skip the limiter entirely.
- **Fix:** add per-IP sliding-window limiter (reuse the apps/api `rate-limit-store` pattern; respect proxy headers the way apps/api does) running BEFORE key resolution, independent of the per-key bucket. Fail-closed in prod like the existing limiter.
- **Accept:** test — 100 requests, distinct fabricated prefixes, same IP → 429 after threshold; legitimate keyed traffic unaffected.
- **Wiki:** public-api integration/structure page.

### T1-2. apps/api global error handler leaks `error.message` on 5xx
- **Where:** `apps/api/src/plugins/sentry.ts:29` — `reply.code(status).send({ error: error.message || 'Internal Server Error' })` for all statuses.
- **Fix:** for `status >= 500` send generic `'Internal Server Error'`; keep full message in server log + Sentry. 4xx keep message.
- **Accept:** test asserting 500 body is generic.

### T1-3. Dependency vulns — 14 high
- **Targets (high):** better-auth (device-auth approve/deny accepts any authentication), hono (CORS reflects any Origin with credentials — public-api sets its own CORS but verify config not vulnerable pattern), form-data, nodemailer, protobufjs, tmp, undici, vite, ws. Moderates: dompurify, js-yaml, tar, @opentelemetry/core (many transitive via payload/vitest/jsdom).
- **Fix:** upgrade direct deps (better-auth, hono) to patched versions ≥7 days old; for transitive-only, use `pnpm.overrides` ONLY for actual CVEs and document each in the commit. After: `pnpm audit`, `pnpm security:scan`, `pnpm typecheck`, scoped tests for auth (`packages/auth`, apps/api auth tests) and public-api.
- **Better Auth caution:** upgrading may change hook/session APIs — coordinate with T0-4 (do T0-4 against the upgraded version, or upgrade first).

### T1-4. Personnel classify mutations skip per-request flag re-check
- **Where:** `packages/api/src/routers/core/personnel-file/classify.ts:281` (`classifyApprove`), `:337` (`classifyReject`) — siblings `attachDocument`:180 and `pendingReviewQueue`:392 call `assertWorkforceEnabled(ctx.organizationId, ctx.region)`; these two don't (documented invariant: every procedure re-evaluates per request).
- **Fix:** add the assert at top of both handlers.
- **Accept:** existing flag-gating test pattern extended to both mutations.

### T1-5. public-api operational hardening (3 small fixes, one change set)
- (a) **Graceful shutdown** — `apps/public-api/src/index.ts:85-90`: capture `serve()` handle; on SIGTERM/SIGINT close server, `Sentry.close(2000)`, exit — mirror `apps/api/src/index.ts:66-78`.
- (b) **Env schema** — create `apps/public-api/src/env.ts` (Zod, mirror apps/cron-worker/src/env.ts style) covering `PUBLIC_API_PORT`, `PUBLIC_API_CORS_ORIGINS`, `ENABLE_API_DOCS`, `SCALAR_SRI_HASH`, `API_KEY_HMAC_SECRET`, `UPSTASH_*`; replace raw `process.env` reads in `app.ts:53,58,70,127,133`, `index.ts:62-64,80`, `lib/rate-limiter.ts:28-29`. This also fixes part of the T2-6 ratchet.
- (c) **US org fail-closed** — `packages/db/src/region.ts:59` lazy-throws on missing `DATABASE_URL_US` only at first query. Gate org creation instead: in `packages/auth/src/config.ts` `beforeCreateOrganization` (where `dataRegion` is derived, ~:137), reject `US` when `DATABASE_URL_US` unset with a clear error.
- **Accept:** boot public-api with bad env → immediate validation error; SIGTERM drains; US org create without env → 4xx with clear message, not runtime 500s.

---

# TIER 2 — wiring gaps (built-but-dark) and doc-truth

### T2-1. Mount the 3 orphaned US-expansion UI components
`module.us-expansion` has ZERO references in `apps/web-vite/src` while backend gates on it everywhere. Pattern to copy: `personnel-file-shell.tsx:128` gating on `module.workforce-employees`.
- (a) `apps/web-vite/src/components/contractors/classification/us-classification-result.tsx` (`UsClassificationResult`) — mount in the contractor/engagement classification surface. ALSO extend `components/contractors/engagement-classification.tsx:317` `OutcomeBody` (currently returns null for any non-GB/non-DE outcome): add US branch rendering it. Gate: `useFlag('module.us-expansion')`.
- (b) `apps/web-vite/src/components/contractors/form-1099k-band.tsx` (`Form1099kBand`, fully finished states) — host on contractor profile overview or `compliance/us-compliance-fields.tsx`, gated by flag + US jurisdiction.
- (c) `apps/web-vite/src/components/contractors/tax-forms/tax-form-status-card.tsx` (`TaxFormStatusCard`, staff W-form tracker) — host on contractor profile compliance/documents tab behind flag.
- **Do NOT** double-book with phase 87-09/10 — check `.planning/milestones/v7.0-phases/87-*/87-09-PLAN.md` and `87-10-PLAN.md` first: if these mounts are already tasks there, execute via that plan instead of ad-hoc.
- **Accept:** each component reachable behind the flag; scoped web-vite tests for touched paths; `pnpm check:web-vite-data-layer` green. Wiki: US-expansion / contractors domain pages + `web-vite-domains.md`.
- i18n note: `SOFTWARE_NOT_LEGAL_ADVICE_EN` in `us-classification-result.tsx` is English-only by constant name — confirm intent with user before translating (likely intentional single-language legal text).

### T2-2. Annotate dark seams so they stop reading as dead code
Add ONE header comment each (why-focused, no phase IDs — e.g. "Deferred: unreachable until the IRIS transmit path ships; see .planning deferred ledger"):
- `packages/api/src/services/form-1099-nec.service.ts` (full pipeline, zero non-test callers; also its `SEEDED_THRESHOLDS_MINOR:197` hardcodes thresholds the schema says must come from `Tax1099Threshold` — when phase 86 wires this, the sync gate must read config; note that in the comment).
- `packages/api/src/services/tin-match.service.ts` (`matchRecipientTin`, `createBackupWithholdingFlagWriter` — 0 prod callers; lands with year-end batch).
- `packages/iris/src/index.ts` (whole package runtime-unwired pending transmit; XSD bundle = human checkpoint, validator returns INVALID/`XSD-BUNDLE-MISSING` until placed).
- `packages/api/src/services/elstam-stub.ts` (confirm future-phase placeholder with user; if none, delete).
- **Also delete:** `apps/cron-worker/src/jobs/handlers/compliance-reminder.ts:20` `complianceReminderHandler` export — unregistered duplicate of the scan folded into `reminders` (`reminders/index.ts:401`). Keep `executeComplianceReminderScan`.
- **Accept:** typecheck + scoped tests green; `lint:no-breadcrumbs` green.

### T2-3. public-api surface consistency
- (a) Add `/feature-flags` to `apps/public-api/src/openapi.ts` paths (it's mounted at `app.ts:113` but undiscoverable).
- (b) Scope decision for `packages/api/src/routers/public-api/feature-flags.ts:21`: currently tier-gated only, no scope (BFLA inconsistency vs all siblings). RECOMMENDATION: gate behind `organization:read` scope. Confirm with user only if they push back.
- **Accept:** public-api tests green; OpenAPI snapshot updated. Wiki: public-api page.

### T2-4. Planning-doc truth sync (docs only, no code)
- `ROADMAP.md` + `STATE.md`: phase 87 shows 2/10 & "Plan 1 of 10" — reality ≈8/10 executed + slice 9 in recovery. Update counts after the recovery session lands its commit.
- `REQUIREMENTS.md` drift, both directions: UNCHECK `US-FORM-03` (escalation persistence has 0 prod callers — returned boolean ≠ persisted escalation) and `US-FORM-04` (1099-NEC batch/router unbuilt). CHECK `US-PAY-01/02/03/04` (phase 88 shipped, code-verified) and `US-CLASS-01..04` + recipient-copy half of `US-FORM-06` (mark 1042-S transmit part open). Mark `US-PAY-05` partial (Plaid mock-only).
- `88-VERIFICATION.md`: frontmatter says passed but body still narrates pre-closure FAILs (line ~136 "DISCONNECTED", ~151-154 FAIL rows) — rewrite body to post-closure state, keep history note.
- Consolidate the deferred-work ledger (11 items — from the gap analysis in this review) into `.planning/` where the user keeps it; ensure phase-86 plans actually enumerate the 3 HOLDs that land there (tin-match flag-writer trigger, 1042-S transmit, backup-withholding persistence).
- **Accept:** `pnpm check:wiki-brain` green; no source changes.

### T2-5. Verification debt
- Phases 86 and 87 have executed plans but NO VERIFICATION.md. After recovery session finishes 87 slice 9: run `/gsd:verify-work` or `gsd-verifier` for 87; 86 gets one when its tail executes.
- Root-cause note (already proven twice — phase 91 and the T2-1 orphans): "component built + tested" passes verification while unmounted. RECOMMENDATION for user: add a cheap CI guard — script asserting every exported component under `apps/web-vite/src/components/**` (non-test, non-index) has ≥1 importer outside its own directory; allowlist for intentional staging. This turns the recurring orphan class into a gate.

### T2-6. process-env ratchet broken (184 vs 182)
- **Fix:** find the 2 new raw reads (`git log -p` recent commits over `process.env`, or diff the checker's file list vs baseline; suspects: recent 92-wave merges, `apps/public-api/src/app.ts`, sentry.ts files). Migrate to `getServerEnv()`/package env schema. T1-5(b) may cover them — run `pnpm check:no-process-env` after it first.
- **Accept:** checker ≤182.

---

# TIER 3 — hygiene / optimization (batch when touching the area)

- **T3-1** `.env.example` cleanup: delete dead `LOAD_TEST_BYPASS`/`LOAD_TEST_SECRET` (:305-306, references retired Next.js route + `VERCEL_ENV`, 0 code hits); add `CRON_HEALTH_HOST` (schema'd in cron-worker env.ts:34, undocumented).
- **T3-2** Fold documented-but-unschema'd env vars into `serverEnvSchema` (or package-local schemas): `PG_POOL_MAX`, `PRISMA_SLOW_QUERY_THRESHOLD_MS` (`packages/db/src/client.ts:16,24`), `RLS_POLICIES_ENFORCED`, `INFISICAL_TOKEN_TTL_MS`, `CLAUDE_OCR_MODEL_ID`, `DOCUSIGN_*`, `ADVISORY_LOCK_TRANSITION_DUAL_HOLD`, `KSEF_*`, `HMRC_*`, `COMPANY_REGISTRY_PROVIDER`/`DATAPORT_*`. All currently raw `process.env` with safe defaults — mechanical but touches many packages; do per-package, typecheck each.
- **T3-3** `packages/auth/src/config.ts:8,590` — `nextCookies()` plugin from `better-auth/next-js` in a Vite+Fastify stack. Verify Set-Cookie works without it (staging smoke: login via apps/api), then remove. Do together with T1-3 better-auth upgrade.
- **T3-4** Dead flags: `integration.gulf-payments` (flags-core:60), `integration.sepa-instant` (:68) — not v7.0 cohort, zero refs, ship-dark with no consumer. Ask user: remove or keep. The 13 v7.0-cohort dark flags (module.public-api, payroll.*, marketplace.*, iris-efile, personio/bamboohr) are expected scaffolding — leave.
- **T3-5** Index candidates (only if slow-query logs confirm): `OrganizationApiKey.createdByUserId`; `deletedAt` on `Form1042S`/`Form1099Nec` (data-purge scans). Piggyback on T0-6 migration if done together.
- **T3-6** `IrisSubmission`/`IrisAck` (tax.prisma:180,203) and `StateFilingConfig` (:231, seed-only) are dead until transmit/CFSF phases — covered by T0-6 creation + T2-2 annotations; no separate action.
- **T3-7** wiki-brain WARN: 15 distinct `source_commit` prefixes across wiki — bump stale frontmatter when touching those pages (rolling cleanup, not a sprint).

---

# What's LEFT in v7.0 (context for planners — not executor tasks)

| Track | State | Blocker |
|---|---|---|
| Phase 86 tail (4/8): IRIS transmitter, 1099 batch UI, state CFSF | unexecuted | IRS XSD download (human), TCC matures ~2026-07-22 |
| Phase 87 | ≈9/10 after recovery lands; transmit HELD → phase 86 | recovery session |
| Phase 92 | wave 1/8 merged; 92-01 re-run pending | recovery session |
| Phases 93 (planned), 94–97 (untouched) | Theme B remainder | ADP partner lead-time (94) → possibly v7.1; QuickBooks+Gusto = floor |
| Phases 98–101 Theme C | 98 pre-planning done, 0 plans | NOTE: phase 99 scope is largely PRE-BUILT (public-api: HMAC keys, scopes/BFLA, per-key rate limiting, tier gating all live) — planner should re-scope 99 to the delta: per-IP limiting (T1-1 closes part), key-management UI, quotas, docs |
| Cross-phase HOLDs | tin-match flag-writer, 1042-S transmit, backup-withholding persistence — all land in phase 86 | phase 86 |
| Ops debt | multi-region prod migration apply (every phase since 82), Pub 1187 XSD, ar legal-wording review | human |

# Known NON-defects (do not "fix" — verified this review)

- `classification-override.ts:71,98` findFirst without explicit organizationId — safe: `withTenantScope` (`packages/db/src/tenant.ts`) auto-injects tenant scoping.
- Backend-gated flags with zero UI refs (killswitch.*, gulf.*, module.legal-approval etc.) — legitimate; only `module.us-expansion` was a real gap (T2-1).
- `z.record(z.string(), z.unknown())` inputs in employee/import/portal-tax-form — wholesale revalidated by strict per-market schemas downstream.
- Plaid verification mock-only + masked-value compare — intentional dark-live seam.
- `compliance-payment-block` referenced by boot gate but absent from FLAGS — it's a signoff-registry key, by design.
- apps/api webhook signature verification (Stripe/InPost/Storecove/multi-provider/QStash/revalidate-legal) — all present and fail-closed; QStash lives in apps/api NOT cron-worker (cron-worker is pure node-cron + health server).
- iris validator returning INVALID — by design until XSD bundle placed (`XSD-BUNDLE-MISSING`).

# Suggested execution order

1. T0-1, T0-2, T0-7, T0-8 — restore green baseline (independent, parallelizable).
2. T0-3, T0-4, T0-5+T0-6 (one migration change set) — compliance + data integrity.
3. T1-3 (upgrades) then T3-3; T1-1, T1-2, T1-4, T1-5 — security.
4. T2-1 (check 87-09/10 plans first), T2-2, T2-3, T2-6 — wiring + consistency.
5. T2-4, T2-5 — doc truth (after recovery session lands).
6. T3-* opportunistically.

After each change set: scoped tests + `pnpm typecheck --filter=<touched>` + wiki update + `pnpm check:wiki-brain`. Full `pnpm typecheck` before any merge.

---
---

# ADDENDUM: Integration reliability — external systems, sync + execution guarantees (2026-07-05, same review)

Second pass, 4 investigators: outbound delivery infra, gov e-invoicing sync (KSeF/ZATCA/Storecove/Peppol), payments (Stripe/export/ACH/FX), saga+cron execution. All findings code-verified with file:line. The product is workflow/processing-centric, so these rank as high as TIER 0 — INT-0 items are money/compliance defects.

## Three systemic root causes (understand these before fixing anything)

**S1 — The transactional outbox exists, is correctly built, and is completely unwired.** `packages/api/src/services/outbox/` has dedup (`ON CONFLICT (organizationId, dedupKey)`), `FOR UPDATE SKIP LOCKED` claiming, backoff+jitter, 5 attempts, Sentry on exhaustion — and: only ONE event type (`notification.dispatch`, `handlers.ts:28`), ZERO production callers of `enqueueOutboxEvent` (`index.ts:200`), and the drain route (`apps/api/src/routes/outbox.ts`) has NO QStash schedule creating it (schedules exist only for peppol/ksef/google-workspace). Meanwhile 12+ sites dispatch notifications post-commit fire-and-forget with swallowed errors (= at-most-once): `approval-submit.ts:95-116`, `invoice-crud.ts:229-248`, `billing-webhook.ts:171-184` (Stripe payment-failed/trial emails), `workflow-execution-runs.ts:152`, `workflow-execution-tasks.ts:293`, `equipment-returns.ts:187,279`, `portal-equipment-router.ts:183`, `credit-service.ts:304`, `compliance-admin.ts:88`, `ksef-sync-orchestrator.ts:78`, `economic-dependency-scan.ts:384`, `compliance-reminder-scan.ts:562`, `form-1099k-tracker.service.ts:309`, `google-workspace-sync-orchestrator.ts:153,193`.

**S2 — Concurrency guards are missing where the repo already owns the correct patterns.** Reference implementations to COPY, all in-repo: advisory lock per tick (`apps/cron-worker/src/jobs/handlers/reminders/index.ts:362-416` + `packages/api/src/lib/advisory-lock.ts` `tryAcquireXactLock`), CAS claim (`apps/api/src/routes/webhooks/process.ts:193-215` `updateMany RECEIVED|FAILED→PROCESSING`, abort on `count===0`), atomic lock-claim (`packages/integrations/src/services/token-refresh.ts:47-58`). Missing at: cron runner (12/13 jobs), approvals, OCR callback, idp step runner, deprovisioning start, workflow task complete, late-interest claim, 1042-S batch (already T0-5).

**S3 — In-flight external state has no reconciliation anywhere.** Every provider flow that crashes between "provider accepted" and "DB persisted" wedges forever: ZATCA `PENDING`, Storecove lifecycle `QUEUED`, Peppol `PENDING`, payment runs `EXPORTED`, Stripe entitlement drift. No requery/reaper jobs exist for any of them; `job-health` only watches `WebhookDelivery`. Plus two dedup constraints that are INERT: `WebhookDelivery @@unique([provider, providerEventId])` — column never populated anywhere (NULLs never collide); `EInvoiceLifecycleEvent @@unique([organizationId, providerEventId])` — handler never sets it.

## Delivery-guarantee inventory (as wired today)

| Mechanism | Guarantee | Gap |
|---|---|---|
| Outbox | none (unwired) | S1 |
| Direct `dispatch()` notifications | at-most-once | S1 |
| QStash jobs (webhook/ocr/ksef/peppol/zatca/late-interest) | at-least-once from QStash | consumers not all idempotent (OCR, DocuSign) |
| Webhook ingress → `WebhookDelivery` | at-least-once via `_process` CAS | `FAILED`-at-ingress rows never replayed; upstream-event dedup inert |
| `withResilience` provider calls | at-most-once | correct by design |
| Token refresh | exactly-once (lock claim) | 30s TTL vs unbounded refresh call |
| Payment export | exactly-once DB row | but BOTH racers receive a bank file |
| Stripe webhook | exactly-once per event.id | no ordering, late events dropped, no reconcile |

---

## INT-0 — money + compliance defects (rank with TIER 0)

### INT-0-1. Payment export race returns TWO bank files (double-payment)
- **Where:** `packages/api/src/routers/finance/payment-export-router.ts:329-363`; transition guard at `:115-140` is correct (guarded `updateMany` + `PaymentExport @@unique([paymentRunId])`) but file buffer generated before transition (`:311-322`) and returned unconditionally — loser of the race also gets `fileBase64`.
- **Fix:** `runExportTransaction` must signal winner/loser; on `transition.count !== 1` return `fileBase64: null` + status telling operator an export already happened. Extend `packages/api/src/__tests__/security/payment-export-race.security.test.ts` (currently asserts row-uniqueness only, `:242-249`) to assert loser's file is null.
- **Accept:** race test asserts exactly one non-null `fileBase64`.

### INT-0-2. KSeF sync drops pagination — permanent invoice loss
- **Where:** `packages/api/src/services/ksef-sync-orchestrator.ts:440-442` consumes only `result.invoiceMetadataList`; client returns `hasMore`/`pageToken` (`ksef/api-client.ts:238-241`) that nobody loops on. Checkpoint (`lastSuccessAt`) then advances past the lost invoices.
- **Fix:** loop on `hasMore`, feeding `pageToken` into the query request; advance checkpoint only after final page ingested. Keep per-invoice poison isolation (`:317-332` — already good).
- **Accept:** test with 2-page mock response ingests all invoices; checkpoint unchanged when page 2 fails.

### INT-0-3. ZATCA: transient errors become permanent REJECTED; retries dead; no reconcile
- **Where:** `packages/api/src/services/zatca-submission.ts:248-267` catch marks ANY error `REJECTED` (incl. network timeout where ZATCA may have cleared); on QStash retry `recordChainEntry` hits `ZatcaInvoiceChain.invoiceId @unique` P2002 before submit — retry can never run. gov-api gives POST `effectiveMaxRetries=0` (`gov-api/client.ts:303-304`). No job requeries `PENDING` chains.
- **Fix:** (a) on retry, load existing PENDING chain row and re-submit with the same `zatcaUuid` (ZATCA idempotent on uuid) instead of re-creating; (b) classify: transient error → keep `PENDING` (so retry/reconcile can act), only validation/4xx → `REJECTED`; (c) add reconcile cron: requery ZATCA for `PENDING` rows older than N minutes and settle status.
- **Accept:** simulated 503 → row stays PENDING → retry succeeds; no P2002 path; reconcile test settles a stale PENDING.

### INT-0-4. Stripe entitlement drift is permanent (three defects, one change set)
- **Where:** `apps/api/src/routes/webhooks/stripe.ts:42-95` — `subscription.updated/deleted` older than 24h → `200 {skipped:'late_delivery'}` (Stripe retries up to 3 days; late cancellation never applied). `packages/api/src/services/billing-webhook.ts:321-373` — `handleSubscriptionUpdated` upserts unconditionally, no ordering guard: retried stale event overwrites newer status (e.g. ACTIVE clobbers PAST_DUE). No reconcile cron exists.
- **Fix:** (a) exempt state-changing subscription lifecycle events from the age gate (age-gate only cosmetic/notification types); (b) store source event `created` timestamp on Subscription, guard update with `incomingCreated >= stored`; (c) add daily reconcile cron pulling `stripe.subscriptions.list` and repairing status/tier drift.
- **Accept:** late-delivery test applies cancellation; out-of-order redelivery test keeps newer state; reconcile test repairs a manually-drifted row.
- **Note (verified good, keep):** event dedup via `StripeEvent.stripeEventId @unique` + Serializable tx (`stripe.ts:100-124`) is correct; 500-on-error retry semantics correct.

### INT-0-5. Stuck in-flight submissions: Storecove QUEUED + Peppol PENDING + payment runs EXPORTED (reapers)
- **Storecove lifecycle:** `packages/api/src/routers/core/einvoice.ts:644-742` — crash between QUEUED-commit and SENT-commit wedges document; FSM (`einvoice-lifecycle-fsm.ts:134-166`) has no QUEUED timeout edge, retry gets `EINVOICE_TRANSMISSION_IN_PROGRESS` forever. Fix: add stale-QUEUED→FAILED reaper (age > N min, cron-worker) so the existing FAILED→QUEUED retry edge becomes reachable; idempotency already safe (org-scoped content-addressed `Idempotency-Key`, `:683`).
- **Peppol UAE:** `packages/api/src/services/peppol-orchestrator.ts:156-203` — stuck PENDING, `updateTransmissionStatus` early-returns on null `aspTransmissionId` (`:295`); `PeppolTransmission` has NO unique on invoiceId (`peppol.prisma:45-48`) → duplicate rows; `transmitInvoice` called WITHOUT `organizationId` (`:170`) → idempotency key falls back to `_global` (`storecove/client.ts:89-91`), `senderLegalEntityId:0` hardcoded (`adapter.ts:215`). Fix: thread organizationId; add partial unique on active `(invoiceId)`; stale-PENDING reaper.
- **Payment runs:** items stay `PENDING` after export; only manual `updateItemStatus`/`markAllPaid` or ACH-return upload settles; `autoCompleteRunIfTerminal` (`payment-shared.ts:268-286`) never fires without them. Fix: aging report/reaper — alert on runs `EXPORTED` > N days with unreconciled items (do NOT auto-assume success).
- **Accept:** each reaper has a test: stale row → transitioned/alerted; fresh row untouched.

### INT-0-6. Storecove webhook: guid-coarse dedup + FSM bypass → status regression / stuck FAILED
- **Where:** `apps/api/src/routes/webhooks/storecove.ts:92-102` — `hasRecordedEvent` matches on transmission guid (stable per transmission, NOT per event) → first recorded event makes ALL later events no-ops: transient `failed` then real `delivered` = stuck FAILED. `:118-154` `applyLifecycleOutcome` raw-updates `transmissionStatus`, never calls `transitionTransmission` — FSM's "DELIVERED terminal" not enforced. Schema already has the right tool: `EInvoiceLifecycleEvent @@unique([organizationId, providerEventId])` (`einvoice.prisma:94`) — never populated.
- **Fix:** populate `providerEventId` with a true per-event id, dedup via the unique constraint (catch P2002 → 200); route status changes through the FSM (late `failed` after `delivered` → no-op).
- **Accept:** redelivery test: failed→delivered sequence ends DELIVERED; delivered→late-failed stays DELIVERED.

### INT-0-7. Approval state machine: no race guard + no SLA escalation
- **Where:** `packages/api/src/routers/core/approval-queue.ts:210-235` (approve), `:344-400` (reject), `approval-shared.ts:30-45` — `findFirst` → validate → `update` with no locked read/version/CAS. T1 approve + T2 reject both read PENDING → two decision rows, flow advanced AND rejected. Bulk variants same TOCTOU. Escalation: `computeSlaStatus` renders "OVERDUE" in UI only; no cron touches `ApprovalStep.slaDeadline` (reminders' `detectOverdueTasks` covers `workflowTaskRun` only).
- **Fix:** (a) replace with guarded `updateMany({where:{id, status:'PENDING', approverUserId}, ...})`, `count===0` → CONFLICT error; same for bulk; (b) add approval-SLA sub-job in reminders (mirror `detectOverdueTasks:273-335`): notify pending approver on breach, escalate to next chain step after N. This is the invoice-to-payment core flow — an approval stalling silently violates the product's core value.
- **Accept:** concurrent approve+reject test → exactly one decision row; SLA-breach test → notification created.

### INT-0-8. FX correctness: silent staleness + no provenance (one change set)
- **Where:** `packages/api/src/services/exchange-rate.ts:244-255` — `getRate` has no max-age floor: 5-day ECB outage → all conversions silently use stale rate; `:113-137` carry-forward fallback copies yesterday's rows preserving `source:'ECB'` (staleness invisible). `payment-shared.ts:350-355,776-781` — `PAYMENT_SETTLEMENT_RATE_UNAVAILABLE` fires only on "no rate EVER". `_buildExportItems`/`_initiatePayoutForRun` discard `settled.rate`/`rateDate`; `PaymentRunItem` has no rate columns — settled payouts have NO FX provenance. `boe-rate-cache.ts:22-45` — module-level cache, NO TTL (comment claims one), cron writes in cron-worker process, API process serves stale BoE rate until restart. `late-payment-interest.ts:112-113` — missing rate history → silent 0 base rate.
- **Fix:** (a) `getRate(maxAgeDays?)` — settlement + invoice conversion fail loudly (or flag result) when rate older than threshold; (b) stamp carry-forward rows `source:'CARRIED_FORWARD'` + original date; (c) persist `settlementRate`+`settlementRateDate` on PaymentRunItem or audit metadata (needs additive migration — combine with T0-6); (d) real TTL on BoE cache (or Redis invalidation on cron write); (e) `resolveStatutoryRate` missing history → `applicable:false`, not 0+margin.
- **Accept:** stale-rate test → settlement throws/flags; carried-forward rows distinguishable; payout audit reconstructs rate.

### INT-0-9. ACH return-file: no entry-level ledger
- **Where:** `packages/api/src/services/ach-return.service.ts:158,245-257` — idempotency = terminal-status skip only; `traceNumber` parsed (`:133`) but unused; stale-file re-upload after item corrected (FAILED→DRAFT→re-run, `payment-shared.ts:650`) re-flips it; advisory (NOC) entries write duplicate audit rows each upload.
- **Fix:** persist processed entries keyed `(paymentRunId, traceNumber, returnCode)` (or file SHA-256 like `invoice_intake_org_sha_uniq`); short-circuit already-applied; dedup advisory audits.
- **Accept:** double-upload test → second is full no-op; corrected-item + stale-file test → not re-flipped.

### INT-0-10. Late-interest claim: concurrent double-claim
- **Where:** `packages/api/src/routers/finance/late-payment-interest.ts:410-419,492-508` — guard is non-atomic `interestClaims.length > 0` read; `InvoiceInterestClaim` has no `@@unique([invoiceId])` (`invoice.prisma:339-365`); concurrent claims → duplicate claim rows + duplicate LPC-* secondary invoices.
- **Fix:** partial unique index on active claims per invoice (additive migration — combine with T0-6/INT-0-8c) + catch P2002 → CONFLICT.
- **Accept:** concurrent-claim test → one row.

## INT-1 — execution semantics (crash-safety, idempotency, overlap)

### INT-1-1. Wire the outbox (S1) — biggest single reliability win
- (a) Add event types beyond `notification.dispatch` as needed (`outbox/handlers.ts:28`).
- (b) Convert the 12+ fire-and-forget dispatch sites (list in S1) to `enqueueOutboxEvent({tx,...})` INSIDE their existing `$transaction`; `notification-service.ts` already supports `outboxEventId` + dedupKey `${outboxEventId}:${userId}`. Start with the money-path ones: `billing-webhook.ts` (payment-failed/trial emails), `approval-submit.ts`, `invoice-crud.ts`; then the rest mechanically.
- (c) **Schedule the drain**: create the QStash schedule for `/outbox/_drain` in code next to the peppol/ksef/google-workspace schedule creation; assert its existence in a boot check.
- **Accept:** kill-between-commit-and-dispatch test (commit tx, skip dispatch, run drain) → notification delivered exactly once; drain schedule asserted at boot.

### INT-1-2. cron-worker runner hardening (12 of 13 jobs unguarded)
- **Where:** `apps/cron-worker/src/index.ts:51-53` (`void runJob(...)` — no overlap guard), `runner.ts:62` (no timeout), no replica protection, in-memory `lastSuccessByJob` wiped on restart, missed ticks never caught up.
- **Fix, in runner (one place, not 13):** (a) per-job in-process running-guard (skip tick if previous still running, log WARN); (b) `Promise.race` job timeout (per-job `maxMs` in registry meta, default e.g. 5 min) → Sentry on timeout; (c) per-tick Postgres advisory lock via `tryAcquireXactLock('cron', jobName)` — copy `reminders/index.ts:362-416` — makes replicas safe; (d) persist last-success per job (DB table or Redis) + startup catch-up for must-run daily jobs; (e) extend `job-health.ts` to compare each job's persisted last-success against schedule → Sentry alert on `now - lastSuccess > 2×interval` (today job-health watches ONLY WebhookDelivery — a dead cron job is undetected).
- **Accept:** long-running-job test → second tick skipped; hung-handler test → timeout fires; job-health test → stale job alerts.

### INT-1-3. Webhook ingress: inert upstream-event dedup + FAILED rows never replayed
- **Where:** `packages/db/prisma/schema/integration.prisma:100,128` — `@@unique([provider, providerEventId])` with column populated NOWHERE (NULLs never collide; comment claims DB-enforced dedup — false assurance). `apps/api/src/routes/webhooks/multi-provider.ts:226-260` — QStash publish failure → row `FAILED` + 2xx, comment says replay cron picks it up; reaper (`job-health.ts:142-146`) selects only `RECEIVED/PROCESSING` — `FAILED` parked forever.
- **Fix:** (a) populate `providerEventId` from verified payload at every ingress (multi-provider, stripe already has own dedup, storecove, inpost, resend, docusign), catch P2002 → 200 OK; (b) reaper `where` gains `FAILED` (+ attempts cap), or keep publish-failure rows as `RECEIVED`.
- **Accept:** duplicate upstream event test → one delivery row; ingress-publish-failure test → row re-enqueued by reaper.

### INT-1-4. DocuSign/e-sign completion: duplicates + swallowed failures
- **Where:** `packages/api/src/services/esign-orchestrator.ts:304-416` — `handleSigningCompletion` creates Document+DocumentLink with fresh cuid every call, no already-saved guard → redelivered "completed" event = duplicate signed Document. `apps/api/src/routes/webhooks/process.ts:104-125` — completion errors swallowed, delivery still flipped `PROCESSED` (`:246`) → R2 outage = signed PDF never saved, no retry. Also `esign-orchestrator.ts:132-242` — provider envelope created BEFORE the DB tx; rollback → orphan envelope at provider + signer emails sent; verify adapter idempotency key is deterministic per (org, document, signer-set) or write an intent row first.
- **Fix:** idempotent completion (upsert keyed on `signingEnvelopeId` + SIGNED_COPY link, early-return if present); let retriable completion errors fail the delivery (5xx/FAILED) so QStash/reaper retries instead of marking PROCESSED.
- **Accept:** double-delivery test → one signed Document; simulated R2 failure → delivery not PROCESSED, retried.

### INT-1-5. idp-saga deprovisioning: step CAS + run-level guard
- **Where:** `packages/api/src/services/idp-deprovisioning-step-runner.ts:73-102` — read attempts → check cap → `update IN_PROGRESS` with no CAS; QStash redelivery of slow step runs concurrently (attempts corrupted past MAX_ATTEMPTS=3, duplicate provenance; provider ops idempotent so external effect benign). `routers/integrations/deprovisioning.ts:202-345` — only guard is client-supplied idempotencyKey; two admins = two different keys = two full runs, double fan-out.
- **Fix:** (a) claim step via `updateMany({where:{id, status:{in:['PENDING','FAILED']}}, data:{status:'IN_PROGRESS', attempts:{increment:1}}})`, abort on `count===0`; (b) run-start: advisory xact lock on assignmentId + reject when non-terminal run exists (or partial unique on `(assignmentId)` where status non-terminal).
- **Accept:** concurrent step-delivery test → one execution; concurrent start test → one run.
- **Keep (verified good):** PARTIAL_FAILURE reconcile queue + manual retry/override; provenance GC safe for in-flight runs (`gc.ts:14-23`).

### INT-1-6. OCR callback idempotency
- **Where:** `packages/api/src/services/ocr-extraction.ts:106-109` — unconditional `update{status:'PROCESSING'}`, no terminal-state skip; publish (`:55-64`) has NO `deduplicationId`. Redelivery → double Claude Vision spend + a completed result clobbered back to PROCESSING.
- **Fix:** CAS claim (`updateMany where status:'PENDING'` → abort on 0); add `deduplicationId` to publish. Credits already single-deduct at trigger — keep.
- **Accept:** redelivery-after-done test → no second extraction, result intact.

### INT-1-7. Reminders engine: lost PENDING + no failure isolation
- **Where:** `apps/cron-worker/src/jobs/handlers/reminders/index.ts:102-110` — `if (existing) continue` with NO status filter: dispatch threw → row stays PENDING → skipped forever (unique constraint also blocks re-create) = reminder permanently lost. `:203-271` — no per-rule try/catch: one org's throw aborts the whole cross-org run (remaining rules + `detectOverdueTasks` + DRV sweep abandoned). `:365-416` — advisory lock held on `tx` connection while work runs on global `prisma`; >60s tx timeout releases lock mid-run (blast radius small due to uniques, but fix while here).
- **Fix:** skip only when `existing.status === 'SENT'`, else re-dispatch; per-rule try/catch + error accumulation; move guarded work onto lock-holding connection or use session-level lock.
- **Accept:** dispatch-failure test → next tick re-sends; poison-rule test → other rules still processed.

### INT-1-8. Workflow task completion TOCTOU (low)
- **Where:** `packages/api/src/routers/workflow/workflow-execution-tasks.ts:107-244` — findFirst → validateTransition → update, no locked read; double-complete double-fires `unblockDependentsAndRecomputeRun` (mostly benign). Same guarded-updateMany fix as INT-0-7 when touching the file. `overrideBlockingTask` already correct.

## INT-2 — audit-evidence + observability

### INT-2-1. GovApiAuditLog is never written in production
- **Where:** `GovApiAuditLogger` instantiated only in tests + `seed-dev.ts`. `ZatcaApiClient` and `StorecoveAdapter` default `auditLogger:null` and production constructors pass none (`zatca-submission.ts:204-208`, `routes/peppol.ts:60,222,348`); VIES/HMRC/USPS never override the no-op `emitAuditEntry` (`gov-api/client.ts:542-544`). Even when enabled, rows store no response payload — insufficient dispute evidence for filings.
- **Fix:** inject the logger in each client/adapter factory; override `emitAuditEntry` for VIES/HMRC/USPS; persist redacted response body (or full-body hash + R2 blob) for filing submissions. Keep writes fire-and-forget (don't fail business calls on audit failure) but count failures to Sentry.
- **Accept:** integration test per client → audit row with response evidence.

### INT-2-2. Peppol inbound: poison isolation + cursor correctness
- **Where:** `packages/api/src/services/peppol-orchestrator.ts:327-360` — no per-payload try/catch: poison doc aborts batch AND `since` cursor derives from newest inserted row's `createdAt` (DB insert time) → unprocessed earlier docs permanently excluded from next poll. `:220-254` — inbound dedup `findFirst(aspTransmissionId)` then create, no unique constraint (`peppol.prisma:48` is index only); poll + webhook paths race → duplicate invoices (TOCTOU).
- **Fix:** per-payload try/catch (copy KSeF `ingestKsefInvoices:317-332`); cursor from source document timestamp, advanced only past successfully-processed docs; unique on `(organizationId, aspTransmissionId)`.
- **Accept:** poison-batch test → other docs processed, poison retried next poll; concurrent ingest test → one invoice.

### INT-2-3. Health surfacing
- **Where:** `packages/integrations/src/services/health-service.ts` is real (provider health + dependency probes + circuit-breaker snapshots) but UNVERIFIED as mounted: confirm `/api/health` (apps/api `routes/health.ts`) calls `getDependencyHealth`, and that ANY UI/alert consumes `getAllProviderHealth`. If not surfaced: breaker-OPEN/DEGRADED state is computed and invisible — mount it in health route + admin integrations page.
- Also: KSeF sync-log/connection status divergence — `finalizeSyncSuccess` marks log SUCCESS while `updateConnectionAfterSync` marks connection ERROR when per-invoice errors exist (`ksef-sync-orchestrator.ts:350-361`) — align (PARTIAL status).

## INT-3 — hardening (batch with area work)

- **INT-3-1** USPS fetches have NO timeout (`packages/gov-api/src/clients/usps-client.ts:260-263,343-350`) — route through `fetchWithTimeout`. Everything else uses the excellent `fetch-helpers.ts` baseline.
- **INT-3-2** `gov-api/rate-limiter.ts:101-120` fails OPEN on Redis outage — for globally-capped shared credentials (USPS 60/hr) add conservative in-memory fallback bucket instead of unlimited.
- **INT-3-3** Token-refresh lock TTL 30s vs unbounded `adapter.refreshToken` network call (`token-refresh.ts:47-60`) — bound the refresh call well under `LOCK_TTL_MS` (or raise TTL); otherwise stale-lock takeover double-redeems single-use refresh token → wrongly parks connection REAUTH_REQUIRED.
- **INT-3-4** Slack per-channel 1 req/s claimed "enforced by callers" (`resilience-config.ts:134`) — no such enforcement found; add per-channel token bucket before burst alerting lands.
- **INT-3-5** Direct `publishJSON` callers (`ksef.ts:304`, `zatca-submission.ts:323`, `ocr-extraction.ts:55`, `peppol.ts:131`, `google-workspace.ts:432`) pass no `deduplicationId` — add stable dedup ids (the `queue.ts` `enqueueJob` helper already supports it; migrate callers).
- **INT-3-6** Stripe refund → credits reversal is manual-only (documented gap, `billing-webhook.ts:684-751`) — keep, but add to the ops runbook; the 0-credit REFUND_AUDIT row is the trigger.
- **INT-3-7** KSeF null `duplicateCheckHash` rows (seller tax id absent) have no unique backstop (`ksef-sync-orchestrator.ts:126-132`) — consider unique on `(organizationId, externalInvoiceId, source)`.
- **INT-3-8** Peppol outbound error classification string-matches `err.message` (`routes/peppol.ts:287-308`) — brittle; prefer typed error codes from the adapter.

## Verified SOLID — do not "fix", do not regress

- Outbox internals (design is correct — only wiring missing); `fetch-helpers.ts` (timeout incl. body-read, retry taxonomy, Retry-After); `resilience.ts` breaker→limit→retry composition with 4xx errorFilter; token-refresh atomic claim + REAUTH_REQUIRED operator visibility; USPS global-key + VIES per-org rate limiting + Zod safeParse boundaries; multi-provider ingress design (durable row → QStash → CAS claim → reaper) — strongest path in the system; Stripe event-id dedup + Serializable tx + 500-retry semantics; payment export DB-row uniqueness; late-interest PDF reaper (CAS + stable dedup id); KSeF per-invoice poison isolation + safe checkpoint-on-success; ZATCA/lifecycle unique-invoiceId double-filing guards (keep the constraint — fix the retry path around it); reminders advisory-lock pattern; inbound HMAC verification everywhere (timingSafeEqual, per-connection secrets).

## Addendum execution order

1. **INT-0-1** (one-line fix + test — double-payment) and **INT-0-2** (KSeF pagination — data loss). Immediately.
2. **INT-0-4** Stripe drift trio; **INT-0-3** ZATCA retry/reconcile.
3. **INT-1-1** outbox wiring (money-path sites first) + drain schedule.
4. **INT-0-6** Storecove webhook dedup/FSM; **INT-1-3** ingress dedup + FAILED replay; **INT-1-4** e-sign idempotency.
5. **INT-0-7** approvals CAS + SLA escalation; **INT-1-2** cron runner hardening.
6. **INT-0-8** FX staleness/provenance + **INT-0-9/10** (share one additive migration with T0-5/T0-6).
7. **INT-1-5..8**, **INT-2-***, **INT-3-*** opportunistically.

Migrations note: INT-0-5 (peppol unique), INT-0-8c (settlement rate columns), INT-0-9 (ACH entry ledger), INT-0-10 (claim unique), INT-1-2d (job last-success table) are all additive — batch them with the T0-6 migration work to keep the migration count sane.

---
---

# ADDENDUM 2: Go-live readiness (2026-07-05, same review) — authz, PII/GDPR, deploy/ops, performance

Third pass, 4 investigators. Overall posture per surface: **authz architecture solid** (portal isolation, magic-link single-use, live role re-read, upload key derivation all verified CLEAN — 5 gaps); **PII encryption strong** (AES-256-GCM per-class keys, no plaintext full SSN/TIN anywhere) but **erasure/purge machinery has region + model gaps that make GDPR promises false**; **deploy config has 7 blockers**; **performance already well-hardened** (short tail only).

## GL-0 — go-live blockers (do before any prod traffic)

### GL-0-1. PR previews run cron-worker + api-server against PRODUCTION secrets/DB
- **Where:** `render.yaml:28` `generation: automatic` global; cron-worker/api-server/public-api/cms blocks have no `previews: generation: off` (only clamav/unleash-*/cloudflared opt out). Previews inherit `app-shared` env (prod `DATABASE_URL_EU/ME`). A preview cron-worker schedules `data-purge` — "THE load-bearing hard-delete path" (`data-purge.ts:110-111`) — against prod.
- **Fix:** `previews: { generation: off }` on cron-worker (mandatory), api-server, public-api, cms; or isolated preview env group + preview DB. YAML-only change.
- **Accept:** open a test PR → no preview services spawn (or spawn with preview env group).

### GL-0-2. Deploys apply NO app migrations + runbook lies about it
- **Where:** only `cms` has `preDeployCommand` (`render.yaml:308`). `docs/DEPLOYMENT-RENDER.md:7,16` claims "Migrations are executed automatically on every Render deploy" via a `web` service that no longer exists. `migrate-all-regions.ts` is manual-only.
- **Also:** no `directUrl` in datasource (`packages/db/prisma/schema/schema.prisma:1-3`), no `DIRECT_URL_*` in `.env.example` — `prisma migrate deploy` against Neon pooler hosts can hang on advisory locks (already flagged in `docs/PRODUCTION-CHECKLIST.md:167`).
- **Fix:** add `preDeployCommand: pnpm --filter @contractor-ops/db run db:migrate:all` to api-server; add `directUrl` + `DIRECT_URL_EU/ME/US` envs, migrate script injects direct URL; correct DEPLOYMENT-RENDER.md.
- **Accept:** deploy to a staging Render service applies a test migration; runbook matches reality.

### GL-0-3. api-server health check self-destructs the fleet during incidents
- **Where:** `render.yaml:559` `healthCheckPath: /health` = deep probe (`apps/api/src/routes/health.ts:207-257`) that 503s on Redis/QStash/R2/backpressure failure — incl. `probeBackpressure` (`:122-150`) on webhook queue depth. Webhook backlog → all instances 503 → Render cycles the fleet mid-incident. Shallow `/ready` (`:268`) exists, unused.
- **Fix:** point healthCheckPath at `/ready`; keep `/health` for dashboards/alerts.

### GL-0-4. GDPR erasure is structurally incomplete (two defects — RODO exposure on core market)
- **(a) Employee national IDs erased by NO path:** `compliance/gdpr.ts` (org-wide erasure) never references Worker/EmployeeProfile/PersonnelFile/leave/tax-form models (grep: zero matches); `personnel-file/erasure.ts:195` only soft-deletes PersonnelFileDocument rows — never nulls `EmployeeProfile.peselEncrypted/ssnEncrypted/iqamaEncrypted/emiratesIdEncrypted`. PESEL/SSN survive an org-wide "DELETE ALL DATA" indefinitely. Fix: extend org erasure to the Worker/EmployeeProfile/PersonnelFile subtree + leave/tax records (respect statutory windows already modeled in retention-policy); null `*Encrypted`/`*Last4` on erasure.
- **(b) data-purge cron is region-blind:** `data-purge.ts:42` uses the global `prisma` bound to `DATABASE_URL` (`packages/db/src/client.ts:163,176`), never iterates `SUPPORTED_REGIONS`; one cron-worker in frankfurt (`render.yaml:588`). ME (and future US) soft-deletes and GDPR erasures are NEVER finalized — `gdpr.ts:354` "permanent deletion after 90 days" is false outside DATABASE_URL's DB. Also purge's R2 cleanup uses legacy single-bucket `services/r2` `deleteObject` (`data-purge.ts:135`), not `deleteRegionalObject` — wrong-bucket risk. Fix: loop regions via `getRegionalClient` (skip unset URLs); switch to `deleteRegionalObject` with region threaded.
- **Accept:** erasure test → employee ciphertext columns nulled; purge test executes against every configured region; R2 delete hits the org's regional bucket.

### GL-0-5. Audit rows for ME/US orgs land in the WRONG region's DB
- **Where:** `packages/api/src/services/audit-writer.ts:120` — `input.tx ?? prisma` falls back to the global `DATABASE_URL` client, ignoring `ctx.region`. 97 no-tx call sites incl. SSN reveal, FTIN reveal, GDPR erasure audits. Residency crossing (actorName, IP, userAgent) + regional erasure (`gdpr.ts:177` deletes `tx.auditLog` on the regional client) never reaches these rows.
- **Fix:** resolve fallback client from `tenantStore` region → `getRegionalClient`; forbid the global fallback (lint or runtime assert).
- **Accept:** ME-org mutation test → audit row in ME DB.

### GL-0-6. RBAC holes on financial/legal mutations
- **(a)** `core/tax.ts:68` `generateWhtCertificate` — bare `tenantProcedure`, no permission: any org member (lowest role) mints withholding-tax certificates. Fix: `requirePermission({ payment: ['create'] })` (or dedicated tax scope); same for the sibling reads if WHT certs are sensitive.
- **(b)** Classification write cluster on bare `classificationProcedure` (flag-gate only, no RBAC): `classification-draft.ts:27,71,175` (createDraft/recreateDraftAfterDrift/saveAnswer), `ir35-chain.ts` (upsertParticipant/reorderParticipants/**markDelivered/markAcknowledged**/removeParticipant), `ir35-other-client-attestation.ts` upsert, `classification-read.ts` logEscalation. SDS delivered/acknowledged marks are legally significant (IR35 liability transfer) yet permission-free while sibling `submit` requires `contractor:update` (`classification-shared.ts:147`). Fix: move writes to `contractorUpdateProcedure`; leave reads permissive.
- **(c) minor:** `core/docs.ts:37,73` attach/detach (→ `workflow:update`), `core/calendar.ts:92` disconnect (→ `settings:update`).
- **Accept:** low-role member test → FORBIDDEN on each.

### GL-0-7. Ops guardrails absent: dead-man switch + backup drill + landing env
- **(a)** cron-worker has no external liveness: Render workers get no HTTP probe; `job-health` can't detect its own scheduler dying; `CRONITOR_API_KEY` declared (`render.yaml:182`), never used. Fix: heartbeat ping in `runner.ts` per tick (Cronitor/Better Uptime) → pages on silence.
- **(b)** No backup policy, no PITR restore drill ever (`docs/PRODUCTION-CHECKLIST.md:169,256-259`). Fix: BACKUP-POLICY.md (Neon retention/RPO/RTO per region, R2, CMS + Unleash DBs) + one recorded restore drill.
- **(c)** `landing` service has NO `envVars` block (`render.yaml:344-394`) — `NEXT_PUBLIC_POSTHOG_KEY/HOST/CMS_URL/LANDING_URL` unset at build → analytics dead at launch, empty CMS links. Fix: add the four vars.

## GL-1 — first-month items

### GL-1-1. Unbounded PII tables — add time-based sweeps
`WebhookDelivery.payloadJson` (raw provider payloads), `IntegrationSyncLog.request/responsePayloadJson`, `OcrExtraction.resultJson` (full invoice OCR), `StripeEvent.payloadJson`, `Notification`, expired `Session`/`Invitation`, `TaxIdValidation.responseBody` — none swept, all grow forever with names/emails/bank data. Fix: register retention types + 90–180d sweep in data-purge (after GL-0-4b regionalizes it). Priority order: WebhookDelivery, IntegrationSyncLog, OcrExtraction, StripeEvent.

### GL-1-2. Sentry scrub list out of sync with logger mask
`*/lib/sentry-scrub.ts:18-44` (4 hand-copies) missing `ssn, ein, pesel, iqama, emiratesid, nationalid, routingnumber, accountnumber, sortcode, dateofbirth` — all present in `packages/logger/src/pii-mask.ts:48-62` despite "keep in sync" headers. Fix: export shared keyword list from `@contractor-ops/logger`, import in all four.

### GL-1-3. Portal downloads skip virus-scan gate
`portal/portal-invoices-router.ts:81` + `portal-doc-mapper.ts:35` sign R2 URLs without `virusScanStatus` check (staff `core/document.ts:359` and public-api both gate). Contractor can download staff-uploaded INFECTED/PENDING attachment. Fix: filter/deny non-CLEAN before signing.

### GL-1-4. Performance tail (all quick)
- `core/time.ts:181` `listContractors` — unbounded whole-org contractor fetch + JS filter; drive from the timesheet `groupBy` ids + paginate.
- `core/time.ts:50` `listPending` — no cursor; copy `listAll`'s `cursorClause` pattern (`:93`).
- `core/einvoice.ts:822-824` `listByOrg` — `include: {eInvoiceLifecycle: true}` drags JSON blobs into lists; use 2-field `select` like `invoice-crud.ts:456`.
- `portal/portal-invoices-router.ts:15,174` — unbounded portal lists; `contractorId`-only filter unindexed (Invoice index is `(organizationId, contractorId)` org-first). Cursor-paginate (copy `portal-time.ts:192`); consider `where: {organizationId, contractorId}` to use the existing index.
- `core/contractor-core.ts:109-116` — `complianceHealth` filter applied AFTER pagination → short pages + wrong `total` (correctness bug on hot path; fix or document).
- Everything else verified CLEAN — dashboards SQL-aggregated, lists paginated+capped, indexes match, external I/O outside tx, flags local-eval, frontend code-split with sane staleTime.

### GL-1-5. Ops polish
- Per-region reference-data seed: `db:seed:reference` iterating EU/ME/US (today seed targets single `DATABASE_URL`; tax/WHT/BoE/1099 tables must exist per region).
- First operator-org bootstrap script/runbook (`PLATFORM_OPERATOR_ORG_ID` needs a real UUID; no creation path documented).
- Unleash flag bootstrap script (Admin API upsert of all registry flags × 2 regions); missing-flag behavior verified safe (stub returns declared default).
- Commit Sentry alert rules (job-health captureMessage lands in Sentry but nothing pages); add outbox-depth + stuck-payment-run monitors (pairs with INT-1-2e).
- Set `PG_POOL_MAX` explicitly per service in render.yaml; verify ≈320-socket worst case vs Neon plan before raising autoscale maxima.
- Sentry `environment` derives from NODE_ENV → previews pollute prod env; derive from a preview flag.
- render.yaml header + PRODUCTION-CHECKLIST describe services that don't exist (stale); domain inconsistency `contractor-ops.io` vs `.com` (`render.yaml:292` vs `:575,689`) — confirm apex before DNS.
- cms healthCheckPath `/api/users/me` — prefer shallow `/healthz`.

### GL-1-6. Product decisions to schedule (flag, not build)
- **Individual DSAR (GDPR Art. 15/20):** no subject-level access/portability export exists; org `exportData` (`gdpr.ts:377`) is admin-only, omits employee/personnel/tax models, and masks the subject's own identifiers. Needs product decision + phase.
- `WhtCertificate.contractorTaxId` plaintext (`tax.prisma:57`) — individual TIN not masked/encrypted unlike snapshots; decide encrypt vs last-4.
- Portal has no "download my data"; portal PII exposure otherwise verified CLEAN (own data only, masked bank, no full TIN).

## Verified CLEAN at go-live level — do not re-audit

Portal isolation (every procedure scoped to session-derived `ctx.contractorId`; cross-ID probes → NOT_FOUND); magic-link single-use atomic claim + HMAC-bound session cookie + server-side email/nonce; upload keys server-derived `orgs/{orgId}/documents/{uuid}` (no traversal), PendingUpload atomic + purpose-checked; staff `document.getDownloadUrl` triple gate (tenant + `document:read` + CLEAN); role changes effective immediately (JWE cache stores no role; `hasPermission` re-reads live); admin surfaces server-gated (`admin:boe-rate` etc.); RBAC coverage otherwise dense (~317 explicit `requirePermission` + factory-injected in all integration procedures; payments/billing/api-keys/settings/erasure/exports all correctly scoped); encryption stack (3 dedicated AES-256-GCM keys, hex32 fail-loud env validation, value-free audit metadata, last-4 snapshots); R2 bucket-per-region compile-time lockstep; boot robustness (fail-fast env, Unleash-down graceful, local flag-signoff gate); log hygiene (pino body-redaction, ID-only log shapes — one minor `payload` log at `reassessment-trigger-scan.ts:296`).

## Go-live sequencing (combined with earlier tiers)

**Before first prod deploy:** GL-0-1 (previews), GL-0-2 (migrations+directUrl), GL-0-3 (health path), GL-0-7c (landing env) — pure config, half a day.
**Before first real org:** GL-0-6 (RBAC holes), INT-0-1 (double bank file), T0-3 (erasure audit), GL-0-4a (employee erasure), GL-0-5 (audit region), T0-6 (migrations for 9 models).
**Before first PL/DE payroll-adjacent usage:** GL-0-4b (regional purge), INT-0-2 (KSeF pagination), INT-0-4 (Stripe drift).
**First month:** GL-1-*, INT-1-*, remaining T-tiers per their orders.

---
---

# ADDENDUM 3: Long-tail audits (2026-07-05, same review) — CMS, i18n quality, a11y, test coverage, security suite

Fourth pass, 4 investigators + security-suite re-run. These surfaces were flagged "not covered" in the earlier passes.

## Security regression suite — re-run result
`pnpm --filter @contractor-ops/api test src/__tests__/security` → **80 passed / 3 todo / 1 file skipped** (suite grew from the remembered 53). The 3 todos = `tax-filing-tenant-isolation` IRIS stubs (models unwired — T0-6/T2-2 territory). Caveat: `payment-export-race.security.test.ts` passes but does NOT cover the double-bank-file gap (INT-0-1) — extend it there.

## CMS-0 — apps/cms blockers (deploy-fatal if CMS/blog ships at launch)

### CMS-0-1. Migration drift: Authors/Categories/heroImage/readingTime have NO migration
- `apps/cms/migrations/20260517_152937_initial.json` is the ONLY migration; `Authors`/`Categories` collections + `Posts.heroImage`/`readingTimeMinutes` (Posts.ts:146,170,178,196) were added after it (commit d225aa832). Dev works via drizzle push; prod `payload migrate` → missing tables → admin/blog errors on fresh prod DB.
- **Fix:** `pnpm --filter @contractor-ops/cms migrate:create`, commit, verify against a fresh DB.

### CMS-0-2. `preDeployCommand` cannot run in the shipped image
- `render.yaml:308` runs `pnpm --filter @contractor-ops/cms run migrate`, but `apps/cms/Dockerfile:62-84` runner stage is bare `node:24-alpine` with only `.next/standalone` — no pnpm/corepack, no payload CLI, no migrations dir → every CMS deploy aborts on `pnpm: not found` (or silently never migrates). Compounded by `package.json:18` scripts hard-coding `dotenv -e ../../.env` which doesn't exist in the image (`.dockerignore:4`).
- **Fix:** run migrations from a stage that has pnpm+source (dedicated migrate image/step), or bake a compiled migrate entrypoint into standalone; make migrate script env-file-optional.

### CMS-0-3. LegalDocuments drafts publicly readable
- `LegalDocuments.ts:109` `read: () => true` + `versions.drafts` on with no `access.readVersions` override → anonymous `GET /api/legal-documents?draft=true` returns unpublished/scheduled legal terms; `/versions` exposes full history. On the public blog host.
- **Fix:** `read: ({req}) => req.user ? true : { _status: { equals: 'published' } }` + explicit `readVersions: ({req}) => Boolean(req.user)`.

### CMS-0-4. First-user window + weak env validation
- Nothing runs `seed:admin` on deploy → fresh CMS DB has 0 users → Payload's public `/admin/create-first-user` lets the first visitor self-register as admin. Also `src/lib/env.ts:26-27`: `PAYLOAD_SECRET`/`CMS_DATABASE_URL` are `z.string().default('')` — empty/1-char secret passes (forgeable JWTs).
- **Fix:** add `seed:admin` post-migrate to deploy; `PAYLOAD_SECRET: z.string().min(32)`, `CMS_DATABASE_URL: z.string().url()`.

### CMS-1 — first-month CMS items
- **schedulePublish never fires:** `Posts.ts:90-96` + LegalDocuments enqueue payload-jobs; no jobs runner/autoRun/cron executes the queue. Add `jobs.autoRun` or scheduled hit to `/api/payload-jobs/run`.
- **Dual-status footgun:** admin Publish sets `_status=published`; site visibility filters on the CUSTOM `status` select (Posts.ts:65-76, landing cms.ts:222) → published-via-UI content stays hidden until editor also flips the select. Drop custom field or mirror in `beforeChange`.
- No `rateLimit` on public REST/GraphQL (only per-account login lockout); disable unused GraphQL (`graphQL: { disable: true }`); assert-throw in prod when R2 storage vars incomplete (silent ephemeral-disk fallback, `payload.config.ts:56-72`); `Media` has no filesize/pixel limits; autosave drafts with no livePreview/draft-mode route (editors can't preview what they autosave).
- **CLEAN:** write access auth-gated on all 6 collections; Users not publicly readable/registerable; seed-admin idempotent, env-driven; landing consumes REST with `overrideAccess:false` (client `where` ANDed, not trusted); revalidate-legal HMAC timing-safe both ends; isolated Neon DB; webhook suppression during seeds.

## I18N-Q — translation quality (parity was green; quality is not)

**Verdicts:** de **needs-native-review** (796 identical-to-en, 234 English-sentence leaks), pl **needs-native-review** (558/213), **ar MACHINE-DRAFT — block AR locale from release** (681 identical, 203 English sentences, 726 English fragments embedded mid-Arabic, ≥1 inverted meaning). API errors + emails read the SAME bundles (`packages/api/src/i18n/email-i18n.ts` → `apps/web-vite/messages/*`), so all defects hit emails too.

Fix order:
1. **21 pseudo-loc scaffold keys** shipped in ALL 3 locales — `Compliance.paymentBlockModal.*` + `Compliance.documentType.*` literally render `'[de] Compliance EXPIRED — payment blocked'`. Compliance-critical UI. Translate, drop tags.
2. **AR: full native re-translation, not patching.** Worst domains: Approvals, Errors (59 half-English error strings), Settings (137), CalendarSettings (semantic inversion: `statusNotConnected` = `'تم توصيل Not'` reads "connected Not"). Also 25 naive one/other plurals — Arabic needs zero/one/two/few/many/other; Approvals.* does it correctly, copy that pattern.
3. **PL mechanical fixes:** 7 diacritic-stripped strings (`'Pobierz czlonkow zespolu…'` → `członków zespołu`; `Settings.integrations.teams.mappingSaveFailed`, `Billing.usage.*`); 14 plurals missing few/many forms (`Invoices.bulkActions.submittedToast` is doubly broken: English + one/other only → needs `one{# faktura} few{# faktury} many{# faktur} other{# faktury}`).
4. **DE:** 3 `du/dein` keys in an otherwise-consistent `Sie` product (`OrganizationOnboarding.*`).
5. **~200 fully-English keys in all 3 locales:** Idp.* (63), Organization.* (13), Time.singleEntry.*, Invoices.bulkActions.* — batch-translate.
6. **Legal/statutory strings translated with NO adviser gate:** 27 keys (Classification.disclaimer.*, Payments.wht.certFooter, Employees.compliance.pl.statutoryNote). DE/PL read correct; **AR statutory text came from the same broken pipeline — lawyer/native review before Gulf exposure** (extends the existing ar-legal-review deferred item).
7. `overdue-receivables-tile.tsx:22` hardcodes `Intl.NumberFormat('en-GB')` — use the locale helper.
- **GOOD (don't touch):** PL/DE core tax/legal/HR terminology verified native-correct (podatek u źródła, akta osobowe, faktura, Scheinselbständigkeit compounds, Doppelbesteuerungsabkommen, Quellensteuer, consistent Auftragnehmer/Arbeitszeitnachweis, PL informal-ty consistent, DE Sie consistent at 618 keys).

## A11Y — static WCAG 2.1 AA (grade B+; browser/axe pass still needed for contrast + focus-visible + route-focus)

1. **Level A, systemic: data-table row-open is mouse-only** — `packages/ui/src/components/workbench/data-table/data-table-body.tsx:62-65` (`onClick` + `cursor-pointer`, no `tabIndex/role/onKeyDown`); invoice rows have NO keyboard alternative (primary cell is a span; only link goes to contractor). One shared fix (focusable row or primary-cell `<Link>`) repairs invoices/contracts/payments/projects/teams/cost-centers/audit lists.
2. Search inputs placeholder-only in ~13 toolbars (`invoices/invoice-table/data-table-toolbar.tsx:~67` etc.) — add `aria-label` + `type="search"` via one shared component.
3. Desktop sidebar has no `<nav>` landmark (`packages/ui/src/components/shadcn/sidebar.tsx:195,469`); portal is correct.
4. Skip-link targets not focusable — add `tabIndex={-1}` to `<main>` (`portal-shell.tsx:48`, `dashboard-shell.tsx:75`; `legal-document-layout.tsx:88` is the correct reference).
5. `organization-tabs-nav.tsx:38-53` — tablist-of-anchors ARIA mismatch + the ONLY hardcoded-English `aria-label` in the app.
6. Browser pass items: `--muted-foreground` (oklch 0.5 on 0.985) borderline 4.5:1; `placeholder:text-muted-foreground/60` likely fails; verify ~59 DialogContent sites without a DialogTitle (401 vs 342); route-change focus management not evidenced.
- **Strong (keep):** base-ui primitives (focus trap/ESC/restore inherited), 459 labeled inputs + aria-invalid/describedby error wiring, ~503 aria-labels / ~478 aria-hidden icons, real table semantics, RTL exemplary (useDirection, logical props + lint guard, Bdi for IDs).

## COV — test-coverage map (~460 modules checked, ~1,388 test files, >95% of critical modules have dedicated tests)

**Truly zero-coverage, ranked by blast radius (top 9):**
1. `packages/billing/src/webhook/stripe-mappers.ts` — subscription status/period mapping (money) — only transitive happy-path via api billing-webhook.test; also `webhook/index.ts` envelope.
2. `packages/api/src/services/form-1099-nec-pdf.ts` — render+R2-archive service (template tested, service not; asymmetric vs fully-tested form-1042s-pdf).
3. `packages/api/src/services/approval-filters.ts` — approval-queue where-clause builder; wrong filter = wrong approvals shown.
4. `packages/api/src/services/post-org-create-hook.ts` — 0 tests, 0 importers (= T0-4; add test WITH the wiring fix).
5. `apps/public-api/src/lib/sentry-scrub.ts` — PII scrubbing, untested (pairs with GL-1-2 keyword fix — add tests then).
6. `packages/api/src/services/queue.ts` — enqueueJob infra, every async path.
7. `packages/api/src/services/idp-token-resolver.ts` — OAuth token resolution for deprovisioning.
8. `apps/cron-worker/.../compliance-reminder.ts` handler (scan service tested; handler is the T2-2 delete candidate — resolve together).
9. `packages/api/src/services/boe-rate-cache.ts` — feeds UK late-interest money calc (pairs with INT-0-8d TTL fix — test then).
**Direct-unit-missing but transitively exercised (~20):** idp-deprovisioning-step-runner internals, integration-status-mapping, contractor-tax-id, oauth-challenge CSRF state, tenant-db/audited-mutation/pagination libs, public-api plumbing, 3 apps/api routes (contract-health, web-vitals, idp-deprovisioning).
**Quality smell to re-verify:** phase-88 pattern — builders unit-tested green while wired path was unreachable at merge; confirm `payment-us-export.e2e.test.ts` drives real factory selection, not mocks.
**Exemplary — spend zero effort:** payment export/settlement/skonto/late-interest/ACH, all 5 e-invoice profile validator suites, classification rule-sets, 1042-S/1099-K/WHT/TIN/treaty, all webhook handlers (unit+MSW), public-api auth/rate-limit/scopes, tenant/audit/outbox/advisory-lock infra, provider adapters, personnel-file + leave (Ph91/92).

## Addendum-3 sequencing
- **Blockers if CMS/blog in launch scope:** CMS-0-1..4 (else defer whole CMS tier).
- **Blocker for Gulf/AR release:** AR locale re-translation (I18N-Q-2) + AR statutory review (I18N-Q-6). EN/DE/PL launch unaffected — fix scaffold keys (I18N-Q-1) regardless, they render broken text in all locales.
- **First month:** A11Y-1..5 (row keyboard fix first — Level A), PL/DE i18n batches, COV top-5 tests (write them alongside the corresponding fixes, not separately).
- **Needs a browser session:** axe contrast pass, focus-visible sweep, dialog-title verification, route-focus — schedule one UI session with the app running.
