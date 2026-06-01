---
status: issues_found
phase: 77-f2-idp-gws-slack-adapters-the-wedge
depth: deep
reviewed: 2026-06-01
method: inline (subagent — gsd-code-reviewer agent unavailable in this runtime)
files_reviewed: 22
findings:
  critical: 1
  warning: 6
  info: 6
  total: 13
focus: SOLID/DRY across GWS+Slack adapters; token/secret handling; tenant scoping; audit; QStash; frontend layering/a11y/i18n (deterministic lint scan NOT re-reported)
---

# Phase 77 Code Review — F2 IdP GWS + Slack Adapters (the wedge)

Scope: the non-generated, non-test source changed by the 30 `*(77*)` commits. Generated
Prisma client + `*.test.*` excluded. Deterministic lint findings are NOT re-reported except
where a guard is broken or where VERIFICATION.md asserts a guard passes but it does not.

Severity legend: **CRITICAL** = ship-blocker (reliability/security/correctness regression);
**WARNING** = should fix before relying on the surface; **INFO** = polish / follow-up / confirm.

---

## CRITICAL

### CR-01 — GWS adapter deprovision + preview calls use raw unbounded `fetch()` (no timeout, no resilience); `lint:raw-fetch` actually FAILS

**File:** `packages/integrations/src/adapters/google-workspace-adapter.ts`
**Lines:** 406, 426, 446, 475, 508, 519, 543, 562 (all phase-77 `Deprovisionable` code)

Every Google deprovision/preview call (`suspendAccount`, `revokeAllSessions` token-list +
delete + signOut, `verifyDeprovisioned`, `describeImpact` users.get/tokens/drives) uses the
global `fetch()` directly — no `fetchWithTimeout`, no `withResilience`. The OAuth methods in
the *same file* (`exchangeCodeForTokens` L168, `refreshToken` L225, `listAllDirectoryUsers`
L289, `listUserGroups` L341) correctly compose `withResilience(() => fetchWithTimeout(...))`.
The deprovision path silently regressed off that pattern.

Two distinct problems:

1. **Reliability (the real bug, not just lint):** these calls run inside the QStash
   `_step-runner` callback (`apps/api/src/routes/idp-deprovisioning.ts`). A slow/hung Google
   Admin SDK response has no wall-clock bound, so the step can hang past the QStash `timeout: '60s'`
   and the platform request deadline. `fetchWithTimeout` is the established bound and also honours
   `Retry-After`; bypassing it removes the breaker/bulkhead per the `withResilience` contract.
   Note the adapter even re-throws `TRANSIENT_*` to drive QStash retry (L606-609) — but a network
   *hang* never reaches that classifier because there is no timeout to convert it into a throw.

2. **Verification gap:** `77-VERIFICATION.md` (Gates table) states *"every lint guard pass."*
   Running `node scripts/lint-raw-fetch.mjs` exits **1** with 8 GWS phase-77 violations (plus
   the Entra/phase-78 adapter and a `run-health-check.ts` line; and one *false positive* on the
   Slack JSDoc at `slack-adapter.ts:393` because the guard's comment-skip only matches lines
   starting with `*`, not `/**`). The guard is wired into `lint:ci` (package.json:16) so CI
   would fail; the phase was verified without this guard actually being green.

**Concrete fix:** wrap each deprovision/preview call the same way the OAuth methods already do
in this file — `withResilience(() => fetchWithTimeout(url, init, { timeoutMs, retries: 0 }),
{ provider: 'google-workspace' })` — OR, for the genuinely best-effort preview reads
(`tokens`/`drives`, already wrapped in try/catch → degrade to `[]`/`null`), add the explicit
`// resilience: raw-fetch-OK reason=<why>` annotation the guard documents (L13-16). The mutating
calls (`suspendAccount` PATCH, token DELETE, `signOut` POST) must NOT be annotated-away — they
need the real timeout. Slack's `#scimFetch`/`#adminApi` (slack-adapter.ts L394-431) are the
in-repo reference implementation; GWS should mirror them with private `#fetch` helpers.

---

## WARNING

### WR-01 — Adapter asymmetry: Slack centralises HTTP through `#scimFetch`/`#adminApi`; GWS inlines raw `fetch()` at 8 sites (DRY/SOLID)

**Files:** `slack-adapter.ts` L393-431 vs `google-workspace-adapter.ts` L402-572

Slack routes all deprovision/preview I/O through two private helpers that own auth header,
content-type, timeout and resilience. GWS repeats the `fetch(this.#usersUrl(...), { headers:
this.#authHeaders() })` shape eight times with no shared helper, so the missing-timeout defect
(CR-01) had to be reintroduced per call site and a future fix must touch all eight. Extract a
`#gwsFetch(url, init)` mirroring `#adminApi` so the two adapters converge on one HTTP discipline.
This is the root cause that made CR-01 easy to introduce.

### WR-02 — `ImpactPreview.cacheKey` returned by the adapters is org-LESS and is not the real cache key (misleading + latent cross-tenant footgun)

**Files:** `google-workspace-adapter.ts:515`, `slack-adapter.ts:528`

Both adapters embed `cacheKey = \`co:idp:preview:{PROVIDER}:${externalUserId}\`` into the
returned `ImpactPreview`. The *actual* Redis key used by `getImpactPreview` is
`CacheKeys.idpPreview(orgId, provider, externalUserId)` =
`co:{orgId}:idp:preview:{provider}:{externalUserId}` (cache.ts:310) — org-scoped. So the field
shipped to the client is (a) dead/cosmetic and (b) **omits the orgId**. No live cross-tenant
poisoning today (nothing reads `preview.cacheKey` for invalidation), but it is a trap: any future
code that trusts this field to invalidate would build an unscoped key and could touch another
tenant's entry. Either remove `cacheKey` from the union (it leaks an internal concern to the
client and is wrong) or have the service overwrite it with the real org-scoped key before return.

### WR-03 — `enableProviderForOrg` does a read-modify-write on `settingsJson` outside a transaction (lost-update race)

**File:** `packages/api/src/routers/integrations/deprovisioning.ts:620-634`

`findUnique(settingsJson)` → spread-merge → `organization.update(settingsJson)` is not atomic
and not in a `$transaction`. Two concurrent toggles (e.g. admin enables GWS while a second tab
enables Slack) read the same base `settingsJson`, each merges only its own provider, and the
second write clobbers the first — one toggle is silently lost. `overrideStepFailure` correctly
uses `$transaction` for its multi-write; this mutation should too, or use a JSONB merge
(`settingsJson: { ...path update }`) / `SELECT ... FOR UPDATE`. Settings writes are low-frequency
so impact is bounded, but the failure is silent and the audit log (L637) would record "ENABLED"
for a value that did not persist.

### WR-04 — Step-runner trusts `body.organizationId` for tenant client without re-binding the step to that org

**Files:** `apps/api/src/routes/idp-deprovisioning.ts:45-52`, `idp-deprovisioning-step-runner.ts:60-63`

The QStash route builds the tenant client from `body.organizationId` (regional client +
`createTenantClientFrom`), then the runner does `deprovisioningStep.findUniqueOrThrow({ where:
{ id: body.stepId } })` — keyed on `stepId` ALONE, with no `run.organizationId === body.organizationId`
guard. The payload is HMAC-signed by QStash (`guardQStashRequest`) and enqueued only by our own
mutations, so this is trusted-internal input, not external — hence WARNING not CRITICAL. But the
defense-in-depth invariant elsewhere in this router (every read is `where: { ..., organizationId:
ctx.organizationId }` or `run: { organizationId }`) is dropped here. If a future enqueue path ever
mismatches `organizationId`/`stepId`, the runner would operate a step under the wrong regional
client. Add `run: { organizationId: body.organizationId }` to the `where` (and treat a miss as a
non-retryable 400, not a 500 retry loop).

### WR-05 — Slack Org-Grid card reads the WORKSPACE connection health, not the org-grid connection; Connect targets a route that does not exist yet

**Files:** `apps/web-vite/src/components/settings/hooks/use-slack-org-grid-card.ts:16-24`,
`deprovisioning.ts:535-547`

`useSlackOrgGridCard` derives `isConnected` from `integration.getHealth({ provider: 'slack' })`,
which is the workspace bot connection — not the `SLACK_ORG_GRID` sub-kind connection this card
represents. So the card can show "Connected" when only the workspace token exists and the org-grid
deprovision token (the one `resolveDeprovisionToken` requires, idp-token-resolver.ts:41-44) is
absent. Separately, `connectSlackOrgGrid` returns `\`${apiUrl}/api/oauth/slack-org-grid/start\``,
but `grep` finds no such route under `apps/api/src` — Connect currently 302s to a 404.
`77-VERIFICATION.md` documents both as deferred follow-ups, so this is not an undisclosed
regression; flagging because the shipped card's connected-state is *incorrect* (not merely
incomplete) and the button is a dead link until the deferred route lands. Until then, prefer
gating the card behind the org-grid connection lookup or marking it clearly unavailable.

### WR-06 — `getDeprovisioningRun` exposes the free-text override note + actor to anyone with `integration:['read']`, broader than the `idp:['override_step_failure']` writer gate

**Files:** `deprovisioning.ts:350-384` (selects `manualOverrideNote`, `manualOverriddenByUserId`),
rendered at `step-override-badge.tsx:57`

The override note is deliberately kept out of the audit log ("lives only in the column",
deprovisioning.ts:494) — yet the read query returns it (and the overriding user's id) to every
role with `integration:read`, which per `use-permissions.ts` includes owner/admin only, so the
blast radius is small today. Still, the *writer* gate is the narrower `idp:override_step_failure`;
a free-text operator rationale (which may contain incident detail / names) is now visible to a
strictly wider read audience than who can create it. Confirm this is intended; if the note is
meant to be override-author/admin-only, gate the field selection on the same permission or omit it
from the list query and fetch on demand behind `idp:read`.

---

## INFO

### IN-01 — `DeprovisioningRunView` renders `<OverrideStepDialog>` as a direct child of `<ul>` (invalid HTML)

**File:** `apps/web-vite/src/components/idp/deprovisioning-run-view.tsx:54,91-100`

The dialog is rendered as a sibling of the `<li>` rows, directly inside `<ul>`. Only `<li>`
(and script-supporting) elements are valid `<ul>` children. Portaled Radix dialogs render to
`document.body` at runtime so it is visually fine, but the JSX tree is invalid and can trip
hydration/lint. Move the dialog outside the `<ul>` (wrap both in a fragment/`<div>`).

### IN-02 — `lint:raw-fetch` comment-skip false-positives on `/**` JSDoc lines

**File:** `scripts/lint-raw-fetch.mjs:92` (guard, not phase-77 source — context for CR-01)

`trimmed.startsWith('*')` skips ` * ...` continuation lines but not the opening `/**` line, so
`slack-adapter.ts:393` (`/** Raw SCIM fetch ... */`) is reported even though it is a comment with
no real call. Minor guard bug; relevant because it inflates CR-01's violation list. Add
`|| trimmed.startsWith('/**')` (or strip block comments first).

### IN-03 — `i18n:code-coverage` guard is BROKEN (scans deleted `apps/web/src`), so hardcoded-string detection did not run for the IdP UI

**File:** `scripts/audit-i18n-code-coverage.ts:130` (`listSourceFiles` → `apps/web/src`)

`pnpm i18n:code-coverage` crashes with `ENOENT … apps/web/src` — the script still points at the
pre-migration SPA path (`apps/web`, now `apps/web-vite`). It was therefore NOT enforcing the new
IdP components. I verified manually: all IdP UI strings go through `useTranslations`/`t(...)`;
the only literal is the `ENTERPRISE_GRID_DOCS` URL (slack-org-grid-card.tsx:21), which is correct.
So the UI is clean *by hand* but the guard provided zero coverage. Fix the scan root to
`apps/web-vite/src` (separate cleanup, but flag now per the review brief).

### IN-04 — i18n parity (manual): Idp.* namespace is fully balanced across en/de/pl/ar

Verified 87 leaf keys under `Idp` in each of the 4 locale catalogs with no missing/extra keys
(en==de==pl==ar). `pnpm i18n:parity` is a separate working guard. No action — recorded as the
positive confirmation the brief asked for.

### IN-05 — Slack `users.info` HTTP-200-with-`ok:false` is mapped via `httpStatus` from `res.status`, which is 200 on Slack logical errors

**File:** `slack-adapter.ts:507-512` (`revokeAllSessions`), `468-501` (`suspendAccount` uses SCIM
`res.status`, correct)

`revokeAllSessions` calls `#mapSlackFailure(res.status, body.error, ...)`. Slack Web-API returns
HTTP 200 with `{ ok:false, error }` for most logical failures, so `res.status` is 200 and
`#classifySlackError(200, error)` relies entirely on the `slackError` string table (L434-453).
That table covers the common codes and falls through to `classifyError({ httpStatus:200,
providerErrorCode })` → `PERMANENT_OTHER` for anything unlisted — acceptable, but an unknown
*transient* Slack error (e.g. a new `internal_error` variant) would be classified PERMANENT and
not retried. Confirm the code table is exhaustive enough for the providers in scope, or add a
default-transient bucket for known-retryable Slack error families.

### IN-06 — `revokeAllSessions` (GWS) sub-action partial-failure: a non-FAILED token-delete failure is swallowed before sign-out

**File:** `google-workspace-adapter.ts:459-505`

If a token DELETE fails with a class that maps to `LIKELY_GONE` (not `FAILED`), the code falls
through (`if (failed.status === 'FAILED') return failed;`) and proceeds to sign-out, returning the
sign-out result with both sub-actions attached. That is the intended idempotent behaviour (a gone
grant is fine), but the `failedDelete` outcome is then dropped from the result entirely except via
its hash in `tokensResSha`. The step's single `errorClass`/`failureKind` reflects only the
sign-out call, so a partially-degraded revoke is not surfaced in the persisted step. Low impact
(LIKELY_GONE is success-equivalent), but if you want per-sub-action status visibility in the
reconcile UI, carry the sub-action outcome through, not just its hash.

---

## By-severity summary

| Severity | Count | IDs |
|----------|-------|-----|
| CRITICAL | 1 | CR-01 (GWS raw unbounded fetch in QStash path + `lint:raw-fetch` actually fails) |
| WARNING  | 6 | WR-01 adapter HTTP DRY asymmetry · WR-02 org-less `cacheKey` in ImpactPreview · WR-03 `enableProviderForOrg` lost-update race · WR-04 step-runner no org guard on stepId · WR-05 org-grid card wrong health + dead Connect route · WR-06 override note readable by wider `integration:read` audience |
| INFO     | 6 | IN-01 dialog inside `<ul>` · IN-02 raw-fetch guard `/**` false positive · IN-03 i18n:code-coverage guard broken (stale `apps/web/src`) · IN-04 Idp i18n parity OK (confirm) · IN-05 Slack 200/ok:false classification reliance · IN-06 GWS revoke sub-action partial-failure not surfaced |
| **Total**| **13** | |

**Headline:** CR-01 is the ship-blocker — it is both a genuine reliability defect (unbounded
outbound calls inside the QStash callback) AND a verification-integrity issue (the phase was
signed off as "every lint guard pass" while `lint:raw-fetch` exits non-zero and is wired into
`lint:ci`). WR-01 is its structural root cause. WR-03/WR-04 are tenant/concurrency hardening on
the new mutations. WR-05 and IN-03 corroborate the brief's "guard is broken / surface deferred"
expectations. Adapter contract, error classifier (pure/exhaustive), audit on override + toggle,
QStash HMAC verification, frontend Page→Container→Hook→Component layering, loading/empty/error
states, DialogBody/DialogFooter, and i18n key parity are all sound.
