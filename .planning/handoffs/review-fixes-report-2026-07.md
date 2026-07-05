# Review-Fix Execution Report — 2026-07-05

Execution of the fix backlog in [`codebase-review-2026-07-05.md`](./codebase-review-2026-07-05.md), run as 8 waves of parallel subagents in one shared worktree, plus a follow-up batch (FW-1..FW-3) closing the discovered follow-ups.

- **Branch:** `review-fixes`
- **Base commit:** `2bd9229ae` (main, 92 wave-1 merged)
- **Head commit:** `ae3415e94`
- **Commits:** 44 (task-tagged, atomic; 36 waves + 1 report + 7 follow-up)
- **Worktree:** `.claude/worktrees/review-fixes` (NOT merged, NOT pushed, NOT pruned)

## Final gate results

| Gate | Result | Notes |
|------|--------|-------|
| Full `pnpm typecheck` | 41/42 packages green | Only failure = **pre-existing base debt**: `apps/web-vite` `leave/__tests__/team-calendar.test.tsx` imports `team-calendar-view` (never implemented). Added by base commit `c5a2c8d0e` (phase-92 "Wave-0 RED/HOLD contracts"); **untouched by any review-fix wave**. Every package this work modified typechecks clean. |
| `@contractor-ops/api` tests | **4017 passed, 0 failed** (17 skip, 27 todo) | Green (re-run after the follow-up batch). |
| `@contractor-ops/cron-worker` tests | **81/81** | Green. |
| `@contractor-ops/api-server` tests | 192 passed, **1 failed** | Failure = **pre-existing**: `teams-auth-config.test.ts` forces `NODE_ENV=production` and trips an UPSTASH guard; observed failing in Wave 1 immediately after branching. No wave touched teams-auth source. |
| `@contractor-ops/public-api` tests | **117/117** | Green. |
| Security suite (`api/src/__tests__/security`) | **80 passed, 3 todo, 1 skip** | Green; matches review baseline. `payment-export-race` extended for INT-0-1. |
| `check:no-process-env` | **184** (ratchet 182) | **Pre-existing** — base was already 184 (review handover noted "184 vs 182 FAIL"). This work is **ratchet-neutral**: the one offender it introduced (`outbox-drain-schedule.ts`) was migrated to `getServerEnv` (`ff37b015e`). Closing 184→≤182 is T2-6 / T1-5b scope (public-api `sentry.ts`), which was not in the executed wave plan. |
| `lint:no-breadcrumbs` | 11 findings | **All pre-existing**, in phase-92 leave/KP-time **test files** (`LEAVE-*`/`TIME-EMP-*` req-IDs). **None in any review-fix commit.** |
| `check:wiki-brain` | 1 error, 1 warn | Error = **pre-existing**: `root.ts` newer than `api-routers-catalog.md`. `root.ts` is **unchanged since base** (last touched by phase-87 `01c17af08`); drift predates this branch. Warn = `source_commit` prefixes (T3-7 rolling cleanup). Every wiki page this work edited was updated in its own change set — **zero new drift introduced.** |

**Bottom line:** every check that is red was already red on the base branch `2bd9229ae`; no review-fix wave introduced a regression. All work this branch authored typechecks and tests green.

## Task ledger

### TIER 0 — bugs & compliance

| Task | Status | Commit(s) | Note |
|------|--------|-----------|------|
| T0-1 | fixed | `273cac567` | Root cause was a **stale test mock** (personnel-file delegates added in 91-05 never mocked), not a handler bug. Production handler verified correct; 59/59 green. |
| T0-2 | fixed | `1eecbd4c9`, `64f25f0a8` | Lazy `stripe-client` Proxy + `EMPLOYEE_PII_ENCRYPTION_KEY` **and** `SSN_ENCRYPTION_KEY` in test env; 32/32 api-server files execute. Test updated to assert lazy construction. |
| T0-3 | fixed | `658a5956c` | Unconditional `personnel_file.erasure_requested` audit row, in-tx. |
| T0-5 | fixed | `3e4749ae7` (+ index in `28061f01e`) | 1042-S batch wrapped in `$transaction`; `Form1042S_active_key` P2002 handled as idempotent skip. |
| T0-6 | fixed | `28061f01e` | Hand-authored additive migration for all 9 US tax-form tables; **`prisma migrate diff` verified empty on a live Postgres-17 shadow**. Drift-check script wired into CI. |
| T0-7 | fixed | `285d53936` | Parity test masked **10** missing error keys (not 1); all added ×4 locales. AR flagged for native review. |
| T0-8 | fixed | `2832af75d` | Exports contract test 8→9 + new-key shape assertion. |
| T0-4 | **not done** | — | Org-creation hook wiring was **not in the executed wave plan**; deferred (touches Better Auth hook API — coordinate with a T1-3 upgrade). |

### INT-0 — money + compliance (rank with TIER 0)

| Task | Status | Commit(s) | Note |
|------|--------|-----------|------|
| INT-0-1 | fixed | `2612ccfab` | Export-race loser returns `{fileBase64:null, idempotent:true}`; test asserts exactly one non-null bank file. |
| INT-0-2 | fixed | `f9de62452` | KSeF pagination drain (`hasMore`/`pageToken`); checkpoint gated on final-page success. (Cited client path was wrong; real client `packages/einvoice/.../ksef/api-client.ts`.) |
| INT-0-3 | fixed | `730cc8e69` | Transient→PENDING classification, idempotent retry on existing `zatcaUuid`, `zatca-reconcile` cron (`*/15`). |
| INT-0-4 | fixed | `6af489728`, `85a7ea056` | Age-gate exemption for subscription lifecycle; `Subscription.lastEventCreated` ordering guard (+ migration `20260705120000`); daily `stripe-reconcile` cron. |
| INT-0-5 | fixed | `28061f01e` | `PeppolTransmission` partial unique on active `(invoiceId)`. |
| INT-0-6 | fixed | `38035cfde` | Storecove per-event `providerEventId` dedup + FSM-routed status (recovery edge FAILED→DELIVERED). |
| INT-0-7 | fixed | `b65411aa0` (CAS), `c8f8ffdbc` (SLA) | Guarded `updateMany` CAS on approve/reject/bulk (CONFLICT on loser); approval-SLA escalation sub-job in reminders. |
| INT-0-8 | fixed | `b37a101ce` (+ columns in `28061f01e`) | `getRate` max-age floor (`StaleExchangeRateError`); carry-forward `source` provenance; persisted `settlementRate`/`settlementRateDate`; BoE 5-min TTL; missing-history → `applicable:false`. |
| INT-0-9 | fixed | `28061f01e` | New `AchReturnLedgerEntry` table, unique `(paymentRunId, traceNumber, returnCode)`. (Service-side wiring of the ledger not yet consumed — table + constraint landed.) |
| INT-0-10 | fixed | `28061f01e` | `InvoiceInterestClaim` unique on `(invoiceId)`. |

### INT-1 — execution semantics

| Task | Status | Commit(s) | Note |
|------|--------|-----------|------|
| INT-1-1 | fixed | `5c549e068`, `fe6dc0709`, `2a6adf020`, `ff37b015e`, `5d5aff4c6` | Outbox wired: global `/outbox/_drain` QStash schedule + boot assert; money-path (Stripe/approval/invoice) + 4 mechanical sites converted to in-tx `enqueueOutboxEvent`. **8 mechanical sites deferred** (no enclosing `$transaction` — `workflow-execution-tasks`, `credit-service`, `compliance-admin`, `ksef-sync-orchestrator`, `economic-dependency-scan`, `compliance-reminder-scan`, `form-1099k-tracker`, `google-workspace-sync` ×2); converting them needs a tx refactor and would be forced/unsafe. **NB: this task's first run was orphaned by an external-session git collision (see below) and cleanly re-run.** |
| INT-1-2 | fixed | `b618a39e5` (+ table `28061f01e`) | Runner overlap guard + per-job timeout (`maxMs`, default 5m) + per-tick advisory lock; durable last-success in `CronJobRunState`; job-health staleness alert (`>2× interval`). |
| INT-1-3 | fixed | `ea5863a23` | `providerEventId` populated at ingress (resend `svix-id`), P2002→200; publish-fail rows kept `RECEIVED` so the existing reaper replays them. DocuSign left unset (its id is per-envelope, would drop distinct events — justified). |
| INT-1-4 | fixed | `2498ca2e2` | Idempotent e-sign completion (guard on `SIGNED_PDF_SAVED`); retriable vs permanent error split so R2 blips retry. **DocuSign idempotency-key verified deterministic. Autenti adapter FLAGGED** — no idempotency key; a durable fix needs an intent table (not authored). |
| INT-1-6 | fixed | `4bf7b3e45` | OCR CAS claim (`updateMany where PENDING`) + stable `deduplicationId`. |
| INT-1-7 | fixed | `92456c2dc`, `c45588d36` | Reminders re-dispatch stuck PENDING (SENT filter), per-rule try/catch isolation, lock-connection fix. Test-mock alignment for `gc-provenance`. |
| INT-1-5 | **not done** | — | idp-saga deprovisioning CAS — not in the executed wave plan; deferred. |
| INT-1-8 | **not done** | — | Workflow-task-completion TOCTOU (low) — deferred. |

### GL — go-live (authz / GDPR / deploy / perf)

| Task | Status | Commit(s) | Note |
|------|--------|-----------|------|
| GL-0-1 | fixed | `e367c07fe` | `previews: generation: off` on cron-worker/api-server/public-api/cms. |
| GL-0-2 | fixed | `e367c07fe` | api-server `preDeployCommand` migrate; `DIRECT_URL_*` wired via `migrate-all-regions.ts` + `.env.example`; runbook corrected. **Deviation:** Prisma 7 rejects `directUrl` in `schema.prisma` (P1012) — direct URLs are fed through the migrate script instead (goal met; schema unchanged). |
| GL-0-3 | fixed | `e367c07fe` | api-server `healthCheckPath` → shallow `/ready`. |
| GL-0-4a | fixed | `13827d51f` | Org erasure extended to Worker/EmployeeProfile/PersonnelFile/leave/tax subtree; nulls `*Encrypted`/`*Last4`; statutory holds respected fail-closed. |
| GL-0-4b | fixed | `a691aface` | data-purge loops `SUPPORTED_REGIONS` via `getRegionalClient`; R2 cleanup via `deleteRegionalObject`. |
| GL-0-5 | fixed | `7c3e1f305` | audit-writer resolves the no-tx fallback client from tenant region (`tenantStore` → directory), fail-closed; no silent global fallback. |
| GL-0-7c | fixed | `e367c07fe` | landing service `envVars` (4 `NEXT_PUBLIC_*` vars). |
| GL-1-2 | fixed | `e339c37ff` | Shared `PII_SCRUB_KEYWORDS` exported from `@contractor-ops/logger`; imported by all 4 sentry-scrub copies + drift test. |
| GL-0-6, GL-1-3 | **excluded** | — | WHT/classification-write/docs/calendar RBAC + portal virus-scan gate — owned by another session (per handover). |
| GL-0-7a/b, GL-1-1/4/5/6 | **not done** | — | Dead-man switch / backup drill / unbounded-PII sweeps / perf tail / ops polish / product decisions — deferred (first-month + human/product scope). |

### TIER 2/3 + long-tail

| Task | Status | Commit(s) | Note |
|------|--------|-----------|------|
| T2-2 | fixed | `27f3bb421` | Dark-seam annotations (form-1099-nec / tin-match / iris); removed unregistered `complianceReminderHandler` export; `elstam-stub` confirmed intentional, kept. |
| T3-1 | fixed | `1305966ab` | Dropped dead `LOAD_TEST_*`; documented `CRON_HEALTH_HOST`. |
| I18N-Q-1 | fixed | `163a9d671` | 21 scaffold keys ×3 locales de-pseudo-loc'd (compliance UI). **AR drafted but FLAGGED for native/legal review** (AR remains machine-draft/blocked per I18N-Q-2/-6). |
| T2-1, T2-3, T2-5, T2-6, T3-2..T3-7 | **not done** | — | Orphan mounts (verify-first; risks phase-87 double-book), public-api surface, verification debt, process-env ratchet, hygiene — deferred. |
| T2-4 | **excluded** | — | REQUIREMENTS/ROADMAP/STATE doc-truth — main session owns. |
| INT-2-*, INT-3-*, CMS-0-*, I18N-Q-2..7, A11Y-1..5, COV | **not done** | — | Deferred (money/compliance INT-0/INT-1 prioritized; CMS deploy-infra, AR re-translation, a11y browser pass, and coverage need CMS-in-scope decision / human / browser session). |

## Additive migration batch (`28061f01e`)

One hand-authored additive migration `20260705000000_us_tax_form_tables_plus_additive_integrity`, live-verified `migrate diff` empty (up + down) on a Postgres-17 shadow, covering: **T0-6** (9 tables), **T0-5** index, **INT-0-5** (peppol unique), **INT-0-8c** (`PaymentRunItem.settlementRate/Date`), **INT-0-9** (`AchReturnLedgerEntry`), **INT-0-10** (claim unique), **INT-1-2d** (`CronJobRunState`). Plus `db:check-migration-drift` script + CI wiring. `INT-0-4` added a second small additive migration (`20260705120000_subscription_last_event_created`).

## Follow-up batch (FW-1..FW-3) — the discovered follow-ups, now applied

Ran after the waves as a single-owner migration step + disjoint service agents + an outbox-tail agent. All green (full api suite re-run: 4017 passed, 0 failed).

| Follow-up | Status | Commit(s) | Note |
|-----------|--------|-----------|------|
| Autenti e-sign idempotency | **fixed** | `60258402c` (table), `3ac579b1b` (service) | Autenti v2 API verified to have NO idempotency mechanism → new `EsignEnvelopeIntent` table, unique `(organizationId, documentId, signerSetHash)`; the orchestrator claims an intent row (deterministic `signerSetHash`) before the provider call, short-circuits/reuses on a dup, P2002→resolve winner. Envelope-create moved after the intent claim. |
| 1099-NEC transactional | **fixed** | `60258402c` (index), `671b24f0d` (service) | `Form1099Nec_active_key` partial unique + batch wrapped in `$transaction`, P2002-as-skip — mirrors the T0-5 1042-S fix. |
| NitaqatBand missing-type gap | **fixed** | `60258402c` | `CREATE TYPE "NitaqatBand"` added to the migration that first uses it (verified live). **Note:** the *full* `--from-migrations` replay is still blocked by a **larger, separate** pre-existing issue — the `__`-prefixed manual-gate migrations replay before `baseline`, and the whole gulf domain has zero migrations. Fixing that means re-timestamping the manual-gate migrations + authoring the gulf domain; out of follow-up scope. Drift check WARN-degrades on it by design. |
| T0-4 org-create hook (was never wired) | **fixed** | `cbcf8a2bb` | `afterCreateOrganization` seeds workflow role templates via `@contractor-ops/offboarding-templates` (avoids a circular api→auth dep — the reason the hook was dead); idempotent cross-region backfill script `packages/api/scripts/backfill-workflow-role-templates.ts`. Also cleared a pre-existing `offboarding-templates` moduleResolution error. |
| 8 deferred outbox sites | **5 converted, 3 left by design** | `5a1d59bf2`, `fa6d91369` | Converted all sites with a single committed state-change: workflow `reassignTask`, credit-exhausted, compliance-upload-outcome, 1099-K tracker heads-up, economic-dependency alert (each now enqueues in-tx). The 3 genuine aggregate/digest/diff notifications (KSeF sync-complete, compliance expiry digest, Google-Workspace ×2) stay direct-dispatch with why-comments — no single committed row to bind an enqueue to. Two sibling integration tests (`compliance-upload-review`, `81-int-closure`) reframed for deferred delivery (`ae3415e94`). |

## Remaining (deferred / other-owner / human)

- **AR i18n** (I18N-Q-2/-6): AR locale is machine-draft — needs a **human native/legal review**, cannot be code-fixed. Flagged, not resolved.
- **Larger deferred backlog** (not follow-ups): T1-* security tier, T2-1/2-3/2-5/2-6, T3-2..T3-7, INT-1-5/1-8, INT-2-*, INT-3-*, CMS-0-*, A11Y-1..5, GL-1-1/4/5/6, COV — see the wave ledger's "not done" rows. GL-0-6/GL-1-3/T2-4 remain other-session-owned.
- **Pre-existing base-branch reds** (all inherited, none introduced here): web-vite `team-calendar-view` RED test, `teams-auth-config` UPSTASH test, `no-process-env` 184>182, 11 phase-92 test breadcrumbs, `root.ts` catalog drift, and the manual-gate-migration/gulf-domain replay gap.

## Operational note — external-session git collision

A concurrent worktree-recovery session (flagged out-of-scope in the handover) mutated the shared `.git` during Wave 6, orphaning the first INT-1-1 attempt onto a foreign lineage and once briefly repointing the checkout. Detected via git-integrity guards; nothing was force-resolved. The `review-fixes` branch ref stayed intact throughout; INT-1-1 was cleanly re-run on the correct tip. All 36 commits are linear on `review-fixes` with verified parents. A leftover `lint-staged automatic backup` stash exists (holds only a formatting delta + generated `de.*` artifacts — no source work); left untouched per git-safety rules.

## Handoff

Branch `review-fixes` @ `ae3415e94`, base `2bd9229ae` (44 commits, linear). **Not merged / not pushed / not pruned** — merge decision stays with the main session. Recommend resolving the pre-existing base-branch reds (team-calendar impl, process-env ratchet, root.ts catalog, manual-gate-migration/gulf replay) on `main` before merge, since they will surface in CI regardless of this branch.

**Post-merge follow-ups to ticket:** the manual-gate migration ordering + gulf-domain migration (unblocks the full drift replay); the AR-locale native/legal review; and the larger deferred backlog listed under "Remaining" above.
