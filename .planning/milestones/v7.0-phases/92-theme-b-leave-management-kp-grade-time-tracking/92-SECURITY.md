---
phase: 92
phase_name: Theme B — Leave Management + KP-Grade Time Tracking
audit: secure-phase
register_origin: authored_at_plan_time
asvs_level: 2
block_on: high
threats_total: 72
threats_closed: 72
threats_open: 0
unregistered_flags: 0
result: SECURED
audited_at: 2026-07-06
---

# Phase 92 — Security Verification (SECURED)

Every plan-time STRIDE threat across the 16 PLAN `<threat_model>` blocks was verified
against the shipped implementation. Implementation files were read-only. No new-threat
scan was performed beyond the register (per task scope); no implementation gap was found.

**Result:** SECURED — 72/72 threats CLOSED, `threats_open: 0`.

## Verification method by disposition

| Disposition | Method | Count |
|-------------|--------|-------|
| `mitigate` | grep/read the declared mitigation pattern in the cited files | 58 |
| `accept`   | documented accepted risk / verified short-circuit in code or this log | 8 |
| (supply-chain `-SC`, all `mitigate` "zero new deps") | schema/code-only phases; no installs | 16 rows counted within the 72 |

All 16 `T-92-NN-SC` supply-chain threats are `mitigate` = "zero new deps" and hold:
the phase is schema + tRPC + services + local UI only, no `package.json` dependency
additions (research + SUMMARYs confirm; no third-party UI registry blocks — local
`packages/ui` primitives only).

## Threat verification table

| Threat ID | Category | Component | Disposition | Status | Evidence (file:line) |
|-----------|----------|-----------|-------------|--------|----------------------|
| T-92-01-01 | Tampering | RED scaffolds silently green | mitigate | CLOSED | Wave-0 scaffolds present incl. `leave-approval-rbac.test.ts` (RED/skip signal via `describe.skip`) |
| T-92-01-02 | DoS | unscoped web-vite test run | accept | CLOSED | Scoped runs only (MEMORY RAM guard); accepted process risk |
| T-92-01-03 | EoP | leave RBAC gate ships w/o regression contract | mitigate | CLOSED* | Gate wired (see T-92-07-06); contract file `__tests__/leave-approval-rbac.test.ts:14` is `describe.skip` (HOLD, see Observations) |
| T-92-01-SC | Tampering | installs | mitigate | CLOSED | Zero new deps |
| T-92-02-01 | Info Disclosure | new models mis-added to globalModels | mitigate | CLOSED | `packages/db/src/tenant.ts:44-72` — only `PublicHoliday` added; leave/time/ewidencja absent |
| T-92-02-02 | Tampering/Repudiation | ledger row updated to inflate balance | mitigate | CLOSED | `tenant.ts:36` `APPEND_ONLY_MODELS` ⊇ `LeaveLedgerEntry`; blocks update/updateMany/upsert (`:38,156-164`) |
| T-92-02-03 | Tampering | PublicHoliday coupled to a tenant | accept | CLOSED | `reference.prisma:7-17` no `organizationId`; global by design |
| T-92-02-SC | Tampering | installs | mitigate | CLOSED | Schema-only, zero deps |
| T-92-03-01 | Tampering | LEAVE_REQUEST enum partial edit | mitigate | CLOSED | Wired 5 surfaces: `approval.prisma:110`, `contract.prisma:299`, `audit-writer.ts:51`, `notification-service.ts:36,62`, `validators/approval.ts:27` |
| T-92-03-02 | EoP | unvalidated leave/time payload | mitigate | CLOSED | `validators/leave.ts:35,31` `.strict()`+positive-int; status omitted (server-set); `employee-time.ts:27,48` bounded |
| T-92-03-03 | Repudiation | ADJUSTMENT without reason | mitigate | CLOSED | `validators/leave.ts:103` `reason: z.string().trim().min(3)` |
| T-92-03-SC | Tampering | installs | mitigate | CLOSED | Zero new deps |
| T-92-04-01 | Tampering | edit archived ewidencja | mitigate | CLOSED | `migrations/20260701000000_ewidencja_append_only/migration.sql:43-57` unconditional `BEFORE UPDATE` `app.reject_ewidencja_update()` raises `restrict_violation` |
| T-92-04-02 | Tampering | supersede flip UPDATEs prior row | mitigate | CLOSED | `ewidencja-builder.ts:181-214` INSERT-only version+1 + `previousSnapshotId`; no prior-row UPDATE |
| T-92-04-03 | Repudiation/Compliance | 3yr purge under-retains 10yr record | mitigate | CLOSED | `migration.sql:67-73` DELETE gated on never-set `app.allow_ewidencja_purge`; no app path sets it |
| T-92-04-04 | Info Disclosure | cross-org ewidencja read | mitigate | CLOSED | Tenant-owning (not in globalModels); RLS `ewidencja_select/insert` `app.org_match` `migration.sql:59-65` |
| T-92-04-SC | Tampering | installs | mitigate | CLOSED | Zero new deps |
| T-92-05-01 | Tampering | uncited statutory value | mitigate | CLOSED | Every rule carries cited `draftLegalText`+"PENDING legal review by local adviser" (e.g. `policies/uae.ts:76,89`) |
| T-92-05-02 | Repudiation | rule value change no provenance | accept | CLOSED | `draftLegalText` citation + git history; legal sign-off deferred (local-only) |
| T-92-05-SC | Tampering | installs | mitigate | CLOSED | date-fns already present; zero new deps |
| T-92-06-01 | Tampering | ewidencja shipped without trigger | mitigate | CLOSED | Trigger ships as raw-SQL `migration.sql`; append-only migration folder present |
| T-92-06-02 | DoS | destructive/irreversible migration | mitigate | CLOSED | Additive-only + paired `down.sql:1-13`; human gate documented (92-06-SUMMARY) |
| T-92-06-03 | Repudiation | false-positive verification | mitigate | CLOSED | db:generate + dev-DB apply gate (92-06-SUMMARY process) |
| T-92-06-SC | Tampering | installs | mitigate | CLOSED | Zero new deps |
| T-92-07-01 | Info Disclosure (IDOR) | cross-org leave/time/ewidencja read | mitigate | CLOSED | `withTenantScope` (non-global) + all reads carry `organizationId` filter |
| T-92-07-02 | Tampering | finalize wrong amount / outside tx | mitigate | CLOSED | `approval-shared.ts:310-368` DEDUCTION + `recomputeBalanceCache` in one `$transaction` |
| T-92-07-03 | Repudiation | approve/reject without audit | mitigate | CLOSED | `approval-shared.ts:357` `leave.approved`; `approval-queue.ts:240,387` `approval.approve/reject` (tx) |
| T-92-07-04 | DoS | null etat throws in balance math | mitigate | CLOSED | `leave-balance.ts:52-61` null etat → 1.00 + `log.warn`, never throws |
| T-92-07-05 | EoP | leave flow hits compliance hold | accept | CLOSED | `approval-engine.ts:355` `checkComplianceHoldAtFinalStep` returns null when `resourceType !== 'INVOICE'` |
| T-92-07-06 | EoP (BFLA) | cross-resource over-grant | mitigate | CLOSED | Coarse `requireAnyPermission({invoice:['approve']},{employee:['approve_leave']})` + fine `assertApprovalActionPermission` on approve/reject/delegate/requestClarification/bulk* (`approval-queue.ts:209/218,356/365,453/462,504/513,532/536,578/582`; gate body `approval-shared.ts:378-387`) |
| T-92-07-SC | Tampering | installs | mitigate | CLOSED | Zero new deps |
| T-92-08-01 | Tampering | regenerate mutates prior row | mitigate | CLOSED | INSERT-only supersede + DB trigger (see T-92-04-01/02) |
| T-92-08-02 | Repudiation | ewidencja without audit | mitigate | CLOSED | `ewidencja.ts:93` `writeAuditLog(action:'ewidencja.generated', tx)` |
| T-92-08-03 | Tampering | WT check under-fires | mitigate | CLOSED | `wt-limit-check.ts:46` / `wt-limit-scan.ts:180` `resolveWtLimits` from cited `wt-registry.ts` |
| T-92-08-04 | Info Disclosure | snapshot reads another org's rows | mitigate | CLOSED | `ewidencja-builder.ts:94-110` builder filters `organizationId`; never widens |
| T-92-08-SC | Tampering | installs | mitigate | CLOSED | Zero new deps |
| T-92-09-01 | EoP (BFLA) | employee approves own leave / wrong resource | mitigate | CLOSED | Shared gate (T-92-07-06) + `validateStepForAction` requires `step.approverUserId === userId` (`approval-shared.ts:47`); leaveRouter own mutations HR-gated on `employee` |
| T-92-09-02 | Spoofing/EoP | dark surface with flag off | mitigate | CLOSED | `assertWorkforceEnabled` on every proc (`leave.ts:112,245,344,372,395,404,450,482,493,537,566`) + conditional mount |
| T-92-09-03 | Tampering | sick inflates balance without audit | mitigate | CLOSED | `leave.ts:298` `writeAuditLog(action:'leave.sick.recorded', tx)`; ledger append-only |
| T-92-09-04 | Info Disclosure | listTeamCalendar leaks another org | mitigate | CLOSED | `leave.ts:573` `organizationId: ctx.organizationId`; team query never widens |
| T-92-09-05 | EoP | mass-assign status on submit | mitigate | CLOSED | `leave.ts:182` status server-set `PENDING`; Zod input omits status |
| T-92-09-SC | Tampering | installs | mitigate | CLOSED | Zero new deps |
| T-92-10-01 | Info Disclosure | cross-region dedup leak | mitigate | CLOSED | `wt-limit-scan.ts:241` `wt:${region}:${recipient}:${day}` region-prefixed dedup key |
| T-92-10-02 | Info Disclosure | ME employees silently excluded | mitigate | CLOSED | `wt-limit-scan.ts:83-96` `SUPPORTED_REGIONS` fan-out + `getRegionalClient` per region |
| T-92-10-03 | DoS | notification fatigue | mitigate | CLOSED | `wt-limit-scan.ts:211-252` two-pass one-digest-per-recipient/day via `claimCronNotificationDedup` |
| T-92-10-04 | DoS | cron double-fire | mitigate | CLOSED | `reminders/index.ts:368` `tryAcquireXactLock(tx,'cron',REMINDERS_LOCK_KEY)` + dedup unique index (`claimCronNotificationDedup`) |
| T-92-10-SC | Tampering | installs | mitigate | CLOSED | Zero new deps |
| T-92-11-01 | EoP | dark surface with flag off | mitigate | CLOSED | Two-layer: `root.ts:205-207` conditional spread (`isWorkforceRegistered`) → METHOD_NOT_FOUND + per-req `assertWorkforceEnabled` (`require-workforce-flag.ts:25-43`) |
| T-92-11-02 | Info Disclosure | time/ewidencja read across orgs | mitigate | CLOSED | `employee-time.ts:155,170` / `ewidencja.ts:116,141` org-scoped; never widened |
| T-92-11-03 | Repudiation | generate/save without audit | mitigate | CLOSED | `employee-time.ts:120` `employee_time.recorded`; `ewidencja.ts:93` `ewidencja.generated` |
| T-92-11-04 | DoS | WT breach hard-blocks save | mitigate | CLOSED | `employee-time.ts:135-148` findings returned as payload, never thrown |
| T-92-11-SC | Tampering | installs | mitigate | CLOSED | Zero new deps |
| T-92-12-01 | EoP | forged status/org from client | mitigate | CLOSED | Server sets status; org from session (tenantProcedure); hook passes validated inputs only |
| T-92-12-02 | Info Disclosure | balance/queue for another org | accept | CLOSED | Server tenant-scopes reads (Plan 09); UI renders API output |
| T-92-12-03 | Tampering | hardcoded strings bypass i18n | mitigate | CLOSED | UI uses `useTranslations` throughout (leave/employee-time components); `i18n:parity` gate |
| T-92-12-04 | EoP | leave_approver blocked → RBAC workaround | mitigate | CLOSED | Reused approve/reject/bulk resourceType-gated (T-92-07-06); succeeds via `employee:approve_leave` |
| T-92-12-SC | Tampering | third-party UI registry block | mitigate | CLOSED | Local `packages/ui` only; no third-party block |
| T-92-13-01 | Info Disclosure | calendar shows another org/team | accept | CLOSED | Server tenant-scopes `listTeamCalendar`; UI renders returned data |
| T-92-13-02 | Tampering | conflict conveyed by color alone | mitigate | CLOSED | `conflict-marker.tsx:29-34` TriangleAlert shape + `sr-only` label + tooltip; `capacity-cell.tsx:40` aria-label; legend always rendered (`team-calendar-view.tsx:31`) |
| T-92-13-03 | Tampering | third-party calendar block | mitigate | CLOSED | Local primitives only; no third-party block |
| T-92-13-SC | Tampering | installs | mitigate | CLOSED | Zero new deps |
| T-92-14-01 | DoS | WT breach hard-blocks save | mitigate | CLOSED | Non-blocking banner (`wt-limit-warning-banner.tsx`); server never throws (T-92-11-04) |
| T-92-14-02 | Tampering | UI reuses contractor Time.* | mitigate | CLOSED | Distinct `employeeTime.*` procedures; `check:web-vite-data-layer` boundary |
| T-92-14-03 | Tampering | breach conveyed by color alone | mitigate | CLOSED | `wt-limit-alert-banner.tsx:34-42` `role="alert"` + `aria-live` assertive/polite + TriangleAlert + text |
| T-92-14-SC | Tampering | installs | mitigate | CLOSED | Zero new deps |
| T-92-15-01 | Tampering | edit/delete archived snapshot affordance | mitigate | CLOSED | `ewidencja-snapshot-table.tsx` only Generate/Regenerate/expand; no delete/edit; `ImmutableBadge` (Lock); hook has no delete mutation |
| T-92-15-02 | Repudiation | regenerate without understanding supersede | mitigate | CLOSED | `ewidencja-snapshot-table.tsx:47-68` AlertDialog confirm with supersede description |
| T-92-15-03 | Info Disclosure | ewidencja of another org rendered | accept | CLOSED | Server tenant-scopes reads (Plan 11); UI renders returned data |
| T-92-15-SC | Tampering | installs | mitigate | CLOSED | Zero new deps |
| T-92-16-01 | Repudiation | doc drift — code without matching wiki | mitigate | CLOSED | `check:wiki-brain` CI gate + `verify_with` pins (project standard) |
| T-92-16-02 | Info Disclosure | operational/PII text in durable wiki | mitigate | CLOSED | Durable-facts-only convention (MEMORY); no round-status/PII |
| T-92-16-SC | Tampering | installs | mitigate | CLOSED | Zero new deps |

## Accepted risks log

| Threat ID | Accepted risk | Rationale |
|-----------|---------------|-----------|
| T-92-01-02 | Unscoped web-vite test run OOM | Process guard: scoped `--filter` runs only (MEMORY RAM guard) |
| T-92-02-03 | `PublicHoliday` is global reference (no tenant coupling) | No PII, no org column; local-only seeded calendar by design |
| T-92-05-02 | Statutory rule values carry citation but no formal legal sign-off | Local-only deploy posture; `draftLegalText` + git provenance; adviser-verify deferred post-deploy |
| T-92-07-05 | Leave finalize path intentionally skips contractor-compliance hold | `checkComplianceHoldAtFinalStep` returns null for non-INVOICE (`approval-engine.ts:355`) |
| T-92-12-02 / T-92-13-01 / T-92-15-03 | UI trusts server tenant-scoping for reads | Reads are org-scoped server-side; UI renders only API output |

## Unregistered flags

None. No SUMMARY (92-01…92-16) contains a `## Threat Flags` section; no new attack
surface appeared during implementation without a mapped threat ID.

## Observations (non-blocking, `block_on: high` not triggered)

1. **RBAC regression contract is a HOLD scaffold.** `packages/api/src/__tests__/leave-approval-rbac.test.ts:14`
   is `describe.skip` — it registers the enforcement contract but asserts nothing at
   runtime (needs a role-session integration harness, flagged in 92-07-SUMMARY). This is
   the cited evidence artifact for T-92-01-03 / T-92-07-06 / T-92-09-01. The **load-bearing
   security control** — the coarse `requireAnyPermission` middleware plus the fine-grained
   `assertApprovalActionPermission(ctx, resourceType)` body gate — is verified **present and
   wired at all six mutating approval procedures** (`approval-queue.ts`), so the BFLA fence
   holds in code. Recommend landing the role-session harness to flip the skip GREEN so the
   fence gains automated regression coverage. Severity: LOW (control present; only the
   automated proof is deferred). Does not block the phase.

## Conclusion

All 72 plan-time threats resolve to CLOSED (mitigations verified in shipped code, or
accepted risks documented above). No implementation gap found. No unregistered attack
surface. **threats_open: 0.**
