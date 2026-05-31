# Phase 77: F2 IdP — GWS + Slack Adapters (the wedge) — Research

**Researched:** 2026-05-31
**Status:** Complete (with two upstream caveats — see §0)
**Method note:** Subagent spawning (`gsd-phase-researcher`) was unavailable in the
background-agent runtime, so this research was performed inline by the plan-phase
orchestrator against the live tree (semble search + Read). Context7 CLI was
unavailable (fresh-global-install blocked by the repo supply-chain guard — correct
behavior); external-API specifics below are pinned from stable, long-published
Google Admin SDK + Slack API surfaces and flagged `VERIFY-AT-EXECUTION` where an
exact rate-limit number or response field must be reconfirmed against live docs
before the adapter call ships.

---

## 0. Two upstream caveats that reshape this phase (READ FIRST)

### 0.1 Phase 76 is PLANNED but NOT executed — its infra does not exist yet

Phase 77's CONTEXT.md treats the entire Phase 76 surface as "existing — extend it."
It is not. Verified in-tree on 2026-05-31:

| CONTEXT.md assumes exists | Actual tree state |
|---|---|
| `Deprovisionable` interface (`packages/integrations/src/types/deprovisionable.ts`) | **absent** — created by Plan 76-03 |
| `idp-saga` workspace package | **absent** — created by Plan 76-01/04 |
| `DeprovisioningRun/Step/IdpChangeProvenance` Prisma tables | **absent** — created by Plan 76-02 |
| deprovisioning tRPC router | **absent** — `packages/api/src/routers/deprovisioning.ts` created by Plan 76-05/06 |
| GWS/Slack deprovision scope registries | **absent** — `packages/integrations/src/scopes/` created by Plan 76-03 |
| `IDP_AUDIT_ALLOWED_FIELDS` saga fields | **absent** — extended by Plan 76-03 (`getIdpAuditLogger` itself exists from Phase 70) |

Both Phase 76 and Phase 77 are unchecked `[ ]` in ROADMAP.md. Phase 76 has 10
PLAN.md files but **zero** SUMMARY.md files (never executed).

**Consequence for planning:** Phase 77 plans MUST treat Phase 76's artifacts as an
**upstream dependency built by Phase 76**, not as files to read-and-extend today.
Every Phase 77 plan that imports `Deprovisionable`, `getDeprovisionableAdapter`,
`recomputeRunStatus`, `canStartDeprovisioning`, the `DeprovisioningStep` model, the
`deprovisioning` router, etc. declares this dependency in its `<read_first>` as
"created by Phase 76 (Plan 76-NN) — read once Phase 76 is executed" and the
acceptance criteria gate on Phase-76-built symbols existing. Phase 77 cannot pass
verification until Phase 76 is executed first. This is correct and expected for a
`Depends on: Phase 76` phase — GSD plans the phase now; execute-phase runs it after
its dependency.

### 0.2 `apps/web` (Next.js) is GONE — migrated to `apps/web-vite` + Fastify `apps/api`

The `audit/post-migration-parity` branch deleted `apps/web`. Both 77-CONTEXT.md AND
Phase 76's plans still reference dead Next.js paths. Phase 77 anchors to the CURRENT
tree:

| Stale reference (CONTEXT.md / Phase 76 plans) | Current-tree anchor |
|---|---|
| `apps/web/src/app/api/idp-deprovisioning/_step-runner/route.ts` (Next.js App Router) | **`apps/api/src/routes/idp-deprovisioning.ts`** — Fastify route, `POST /idp-deprovisioning/_step-runner`, QStash auth via `guardQStashRequest` (see §4) |
| `apps/web/src/app/[locale]/(dashboard)/settings/integrations/` | **`apps/web-vite/src/components/settings/integrations-tab.tsx`** + `apps/web-vite/src/components/integrations/*` (Page→Container→Hook→Component) |
| `apps/web/src/app/[locale]/(dashboard)/settings/compliance/` | **`apps/web-vite/src/components/settings/`** — new compliance/IdP-deprovisioning tab + container + hook |
| `apps/web/src/components/offboarding/override-badge.tsx` | **`apps/web-vite/src/components/offboarding/override-badge.tsx`** (already ported) |
| `idp-deprovisioning.ts` router name (CONTEXT.md) | Phase 76 actually names it **`deprovisioning.ts`** / `deprovisioningRouter` — Phase 77 extends THAT file/router |
| `idp-saga.prisma` (CONTEXT.md) | Phase 76 actually names it **`idp-deprovisioning.prisma`** |

All Phase 77 UI follows `apps/web-vite/ARCHITECTURE.md`: Page (thin composer) →
Container (`*-container.tsx`, calls domain hooks, owns loading/empty/error) → Hook
(`components/{domain}/hooks/use-*.ts`, the ONLY tRPC/React-Query boundary) →
Component (presentational). Run `pnpm check:web-vite-data-layer` after UI plans.

---

## 1. The `Deprovisionable` contract Phase 77 implements (from Phase 76 Plan 76-03)

Phase 76 Plan 76-03 defines the EXACT interface in
`packages/integrations/src/types/deprovisionable.ts`:

```ts
export type DeprovisionResultStatus = 'SUCCEEDED' | 'FAILED';
export type DeprovisionFailureKind =
  | 'AUTH_REVOKED' | 'USER_NOT_FOUND' | 'RATE_LIMITED'
  | 'PROVIDER_ERROR' | 'NETWORK' | 'UNKNOWN';
export interface DeprovisionResult {
  status: DeprovisionResultStatus;
  failureKind?: DeprovisionFailureKind;
  errorMessage?: string;
  requestSha256: string;
  responseSha256: string;
}
export interface Deprovisionable {
  suspendAccount(externalUserId: string): Promise<DeprovisionResult>;
  revokeAllSessions(externalUserId: string): Promise<DeprovisionResult>;
  verifyDeprovisioned(externalUserId: string): Promise<boolean>;
}
```

Registry (same plan, `packages/integrations/src/registry.ts`):
`registerDeprovisionableAdapter(provider, adapter: BaseAdapter & Deprovisionable)` +
`getDeprovisionableAdapter(provider): BaseAdapter & Deprovisionable`. Provider id
union: `'GOOGLE_WORKSPACE' | 'SLACK' | 'ENTRA' | 'OKTA' | 'GITHUB'`.

### 1.1 Interface tensions Phase 77 MUST reconcile (cross-phase)

These are the highest-risk planning decisions — the Phase 77 CONTEXT.md assumes
shapes that differ from Phase 76's locked interface:

1. **`LIKELY_GONE` status (D-06)** — Phase 76's `DeprovisionResultStatus` is only
   `'SUCCEEDED' | 'FAILED'`. Phase 77 D-06 needs a third value. **Resolution:**
   Phase 77 additively extends the union to
   `'SUCCEEDED' | 'FAILED' | 'LIKELY_GONE'` in `deprovisionable.ts` and adds an
   optional `skipped?: boolean` + `reason?: string` to `DeprovisionResult`. Because
   Phase 76 is not yet executed, this is a coordinated edit, not a breaking change —
   Phase 77's schema/type plan owns the additive extension and notes that Phase 76's
   `recomputeRunStatus` (Plan 76-04) must treat `LIKELY_GONE` as terminal-success
   (D-06/D-11). Flag this as a key_link to Phase 76's run-status code.

2. **`ErrorClass` vs `DeprovisionFailureKind` (D-07)** — two distinct 6-value enums.
   Phase 76's `DeprovisionFailureKind` is the *adapter-result* discriminant; Phase
   77 D-07's `ErrorClass` (TRANSIENT_RATE_LIMIT / TRANSIENT_NETWORK /
   PERMANENT_NOT_FOUND / PERMANENT_AUTH_EXPIRED / PERMANENT_FORBIDDEN /
   PERMANENT_OTHER) is the *retry-policy + UX-routing* classification persisted in
   the new `DeprovisioningStep.errorClass` column. **Resolution:** they coexist. The
   new `packages/integrations/src/idp/error-classifier.ts` maps `(httpStatus,
   providerErrorCode) → ErrorClass`; the adapter sets BOTH `failureKind` (for the
   saga's existing USER_NOT_FOUND→success rule) and surfaces `errorClass` (persisted
   for retry budgeting + the reconnect/lint-hint UX routing). PERMANENT_NOT_FOUND
   ⇒ failureKind USER_NOT_FOUND ⇒ status maps toward LIKELY_GONE per D-06.

3. **`MANUAL_COMPLETED` step status (D-10)** — Phase 76's `DeprovisioningStepStatus`
   enum is `PENDING|IN_PROGRESS|SUCCEEDED|FAILED`. Phase 77 D-10 additively appends
   `MANUAL_COMPLETED`. Prisma enum additions are non-destructive. Phase 76's
   `recomputeRunStatus` must treat `MANUAL_COMPLETED` as `SUCCEEDED`-equivalent
   (D-11) — another key_link to Phase 76 run-status code.

4. **`describeImpact` is NOT in Phase 76's interface** — Phase 77 D-01 adds it.
   **Resolution:** add `describeImpact(externalUserId: string): Promise<ImpactPreview>`
   to the `Deprovisionable` interface (additive). The `ImpactPreview` discriminated
   union (keyed on `provider`) lives in a new
   `packages/integrations/src/idp/impact-preview.ts` (or `types/`) and is re-exported
   from `types/index.ts`. CI lint asserts union members == scope-registry providers
   (D-01) — a small test, not a heavy guard, this phase.

---

## 2. Existing adapter infrastructure (Phase 77 extension target — VERIFIED in tree)

`packages/integrations/src/adapters/google-workspace-adapter.ts` (v3.0,
directory-import) and `slack-adapter.ts` (v2.0, approval flows) both:
- `extends BaseAdapter` (`base-adapter.ts` — has NO `Deprovisionable` yet; Phase 76
  D-13 layers the interface; Phase 77 adds `implements Deprovisionable`).
- Use `fetchWithTimeout` (`../services/fetch-helpers.js`), `withResilience`
  (`../services/resilience.js` — breaker + retry + bulkhead, keyed by
  `{ provider, retryAttempts }`), `parseJsonResponse` (`../services/parse-json-response.js`
  — Zod-validated boundary; note this file is currently **untracked** in git but
  already imported by slack-adapter), and `pLimit` (`../services/concurrency.js`)
  for capped concurrency.
- GWS already lists directory users via `https://admin.googleapis.com/admin/directory/v1/users`
  with `Bearer ${accessToken}`, `do/while` pagination on `nextPageToken`, 15s
  timeout + 2 retries. Phase 77's GWS deprovision/preview calls follow this exact
  fetch+resilience+pagination shape.
- Slack already has per-channel self-throttle (`p-limit(1)` + min-interval) for
  `chat.postMessage`. Phase 77's Slack web-API preview reads reuse `withResilience({ provider: 'slack' })`.

Access-token acquisition: adapters receive `accessToken` as a method arg today
(directory sync passes it in). The deprovision step-runner resolves the
`IntegrationConnection` + decrypts credentials before calling the adapter (mirrors
`apps/api/src/routes/google-workspace.ts` → `processDirectorySync`). **SCIM (Slack
D-05) uses raw `fetch` with the SLACK_ORG_GRID org token, NOT the workspace web-API
client.**

---

## 3. External API specifics (the genuine NEEDS RESEARCH items)

> All endpoints below are stable, long-published surfaces. Rate-limit *numbers* and a
> couple of response-field details are flagged `VERIFY-AT-EXECUTION` (Context7
> `googleapis` / Slack API docs) — these are the CONTEXT.md "Claude's Discretion"
> signature-pinning items, deferred to adapter-execution time per CONTEXT.md.

### 3.1 Google Workspace Admin SDK Directory API

**Suspend (D-05 `suspendAccount`):**
`PUT https://admin.googleapis.com/admin/directory/v1/users/{userKey}`
body `{ "suspended": true }` (a partial `PATCH` to the same URL also works and is
preferred — only the changed field). `userKey` = the user's primary email or
immutable id.
**Scope required:** `https://www.googleapis.com/auth/admin.directory.user` (the
**write** scope — current adapter only has `.user.readonly`; Phase 76 Plan 76-03
ships `GOOGLE_WORKSPACE_DEPROVISION_SCOPES = ['…/admin.directory.user']` and Plan
76-08 layers it into `getOAuthConfig().scopes`). Phase 77 relies on that write
scope already being present on the connection.

**Revoke OAuth grants (D-05 `revokeAllSessions` sub-action a):**
- List tokens: `GET https://admin.googleapis.com/admin/directory/v1/users/{userKey}/tokens`
  → `{ items: Array<{ clientId, displayText, scopes: string[], anonymous, nativeApp, userKey }> }`.
  No `nextPageToken` (tokens list is not paginated — it returns the full set). The
  `displayText` field is the human app name used in the preview ("Notion", "Linear",
  …). `scopes` is the per-app granted scope list.
- Delete one token: `DELETE https://admin.googleapis.com/admin/directory/v1/users/{userKey}/tokens/{clientId}`
  → 204 No Content on success; 404 if already gone (treat as idempotent success).
- **Scope:** `https://www.googleapis.com/auth/admin.directory.user.security` is the
  documented scope for the `tokens` and `asps` sub-resources (distinct from the
  plain `admin.directory.user` write scope used for suspend). **VERIFY-AT-EXECUTION:**
  confirm whether the deployment's connection holds `.user.security`; if only
  `.user` is granted, `tokens.list/delete` returns 403 → classifier
  `PERMANENT_FORBIDDEN` with a `lint:scopes` hint (D-07/D-08 parallel). Phase 77's
  GWS scope plan SHOULD add `.user.security` to the deprovision scope set and flag
  the re-OAuth requirement.
- **Concurrency:** cap `tokens.delete` at 5 concurrent via `pLimit(5)` (CONTEXT.md
  default; tunable). Both sub-actions must succeed for the step to be SUCCEEDED.

**Sign out all sessions (D-05 `revokeAllSessions` sub-action b):**
`POST https://admin.googleapis.com/admin/directory/v1/users/{userKey}/signOut`
→ 204 No Content. Invalidates the user's web + device sessions and prompts re-auth.
**Scope:** `https://www.googleapis.com/auth/admin.directory.user.security`.
**Audit-row mapping (ROADMAP SC#2 "three step rows"):** the single
`revokeAllSessions` step emits TWO sub-action audit rows (token-revocation +
signOut) each with its own SHA-256 request/response hash, plus the `suspendAccount`
step's one row = three audit rows total. The saga sees ONE `revokeAllSessions` job;
`audit_log` grep sees three rows. (Avoids extending Phase 76's locked 2-step-kind
interface.)

**Verify (D-06 `verifyDeprovisioned`):**
`GET …/users/{userKey}` → `{ suspended: boolean, isAdmin: boolean, primaryEmail, name:{…}, … }`.
`suspended === true` ⇒ LIKELY_GONE; HTTP 404 ⇒ LIKELY_GONE.

**Preview live calls (D-04 GWS):** `users.get` (accountStatus + `isAdmin` →
`isSuperAdmin`), `users/{userKey}/tokens` (oauthGrants from `displayText`+`scopes`),
`drives.list?q=…` for `drivesOwnedCount` (best-effort — Drive API, separate scope;
if absent, surface `null`). **Live session count: no Admin SDK read endpoint
exists** — `commonMetrics.sessionCount = null`, UI shows "—" (CONTEXT.md Discretion
explicitly allows this).

**Rate limits (VERIFY-AT-EXECUTION):** Admin SDK Directory default is a per-project
QPS quota (historically ~2,400 queries/100s/project, ~most write methods lower).
`withResilience` honors `Retry-After`; 429 ⇒ classifier `TRANSIENT_RATE_LIMIT` ⇒
QStash exp-backoff. Treat the cap-5 token-delete concurrency as the practical
throttle. Pin exact current numbers at execution.

### 3.2 Slack — admin session + SCIM

**Invalidate sessions (D-05 `revokeAllSessions`):**
`POST https://slack.com/api/admin.users.session.invalidate` — JSON body
`{ user_id, team_id? }` (Enterprise Grid: `team_id` optional; org-wide invalidate
also via `admin.users.session.reset` which signs out + clears — `invalidate` is the
session-only choice per CONTEXT.md SC#3). Auth: `Bearer ${orgGridToken}`.
**Scope:** `admin.users:write` family — specifically the docs require an
**org-level admin token** with `admin.users.session:write`-class capability
(CONTEXT.md D-08 uses `admin.users.session:write`). **Enterprise-Grid-ONLY**:
`admin.*` methods are unavailable on non-Grid workspaces. **VERIFY-AT-EXECUTION:**
confirm the precise scope string Slack currently requires for
`admin.users.session.invalidate` (it has historically been gated under the
admin-API scope set granted only to org-level installs on Grid).

**SCIM deactivate (D-05 `suspendAccount`):**
`PATCH https://api.slack.com/scim/v2/Users/{id}` (SCIM v2) — raw `fetch`,
`Authorization: Bearer ${orgGridToken}`, `Content-Type: application/scim+json`,
body `{ "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"], "Operations": [{ "op": "replace", "path": "active", "value": false }] }`
→ 200 with the updated user, or 204. (Slack SCIM historically also accepted
`PATCH {"active": false}` without the PatchOp envelope; the PatchOp form is the v2
spec-compliant payload — use it, fall back only if the API rejects.) `{id}` is the
SCIM user id, resolved from email via `GET /scim/v2/Users?filter=userName eq "email"`
or the Slack `users.lookupByEmail` → mapping.
**Scope:** `scim:write` (SCIM API), org-level token. SCIM is **Enterprise Grid +
Plus plan** only.

**Enterprise-Grid detection (D-08/D-16):** the canonical non-Grid signal is
`users.lookupByEmail` returning Slack error `cannot_perform_operation` (Slack
returns this on workspace-only plans for admin/org operations) — or a SCIM call
returning 403/`cannot_perform_operation`. Map to errorClass
`slack_not_on_enterprise_grid` ⇒ classifier `PERMANENT_FORBIDDEN`, non-fatal
"org-grid unavailable, will skip" UX. **VERIFY-AT-EXECUTION:** confirm
`cannot_perform_operation` is still the current sentinel; it is the documented
behavior but Slack error strings drift.

**Verify (D-06 Slack `verifyDeprovisioned`):**
`POST/GET https://slack.com/api/users.info?user={id}` → `{ user: { deleted: boolean, … } }`;
`user.deleted === true` ⇒ LIKELY_GONE. `users.lookupByEmail` 404 /
`users_not_found` ⇒ LIKELY_GONE.

**Preview live calls (D-04 Slack):** `users.info` (accountStatus +
`is_admin`/`is_owner`/`is_primary_owner` booleans → workspace/org-admin),
`users.conversations?types=public_channel,private_channel` (channelsMemberCount —
**paginated**, `cursor`; CONTEXT.md Discretion: sample first page / cap to avoid
burning budget on >1000-channel users — recommend cap at first 1000 + "+more"),
`apps.permissions.users.list` for `installedAppCount` (**VERIFY-AT-EXECUTION:** this
method is part of the legacy permissions API; if unavailable on the token, surface
`installedAppCount = null` — CONTEXT.md Discretion allows the fallback).
`ownedChannelCount`: from `users.conversations` cross-referenced with channel
creator — best-effort, may be `null`.

**Rate limits (VERIFY-AT-EXECUTION):** Slack Web API tiers (Tier 2 ~20/min, Tier 3
~50/min, Tier 4 ~100/min) per method; `Retry-After` honored by `withResilience`.
SCIM API has its own (historically generous) limit. 429 ⇒ `TRANSIENT_RATE_LIMIT`.

---

## 4. QStash step-runner — Fastify, not Next.js (CRITICAL path correction)

Verified pattern in `apps/api/src/routes/` (`ksef.ts`, `zatca.ts`,
`google-workspace.ts`, `webhooks/process.ts`):

- Route file `apps/api/src/routes/idp-deprovisioning.ts` exporting a Fastify plugin;
  registers `POST /idp-deprovisioning/_step-runner`.
- First line: `guardQStashRequest` (from `apps/api/src/lib/qstash-verify.ts`) —
  wraps `@upstash/qstash` `Receiver`, returns `{ verified, run }`; caller invokes
  `run(fn)` to execute under the reseeded ALS request-context frame.
- Wrap work in `withQueueObservability('idp-deprovision-step', …)` (from
  `@contractor-ops/api/services/cron-monitor`) for the duration histogram.
- `createCronLogger('idp-deprovision-step')` (or `getIdpAuditLogger()` for the audit
  rows) — NO `console.*`.
- 200 on terminal outcome (QStash drops the job); throw/500 on retryable error
  (QStash exp-backoff). The step runner increments `attempts` at the START (after
  MAX_ATTEMPTS check), inserts provenance BEFORE the adapter call (D-09 ordering),
  then writes step result (status, hashes, errorClass, errorMessage) + audit row +
  `recomputeRunStatus(runId)`.
- **MANDATORY:** add the new route to the `scripts/check-webhook-routes.mjs` registry
  (`'POST /idp-deprovisioning/_step-runner': { provider: 'qstash', publisher: 'qstash', signature: 'guardQStashRequest' }`)
  — CI guard fails otherwise.

Phase 76 Plan 76-06 placed the step-runner at the dead Next.js path; Phase 77 (or a
Phase 76 re-plan) must land it in `apps/api`. Because Phase 77 owns the adapter
*invocation* and the new `errorClass`/`LIKELY_GONE`/`MANUAL_COMPLETED` handling, the
clean split is: Phase 77's step-runner plan creates `apps/api/src/routes/idp-deprovisioning.ts`
(the production location), wiring `getDeprovisionableAdapter` + the GWS/Slack adapter
methods. The Phase 76 stub is treated as superseded.

---

## 5. Reused current-tree infrastructure (VERIFIED)

- **Cache (D-02):** `packages/api/src/services/cache.ts` — `cached(key, ttlSec, fn)`,
  `cacheKey('idp','preview',provider,externalUserId)` → `co:idp:preview:…`,
  `invalidate(key)` for force-refresh. Add `CacheTTL.IDP_PREVIEW = 5 * 60`. Preview
  fetch wrapped in `cached`; "Refresh" button → `invalidate` then re-`cached`.
  INVARIANT (F-SCALE-09): run `requirePermission` BEFORE `cached`.
- **Permissions (D-09):** `packages/auth/src/permissions.ts` —
  `accessControlStatement` resource→actions map; `ac = createAccessControl(...)`.
  Add resource `idp: ['override_step_failure']` (the CONTEXT.md
  `idp:override_step_failure` maps to resource `idp`, action `override_step_failure`
  — mirrors `workflow: [..., 'override_blocking_task']`). `packages/auth/src/roles.ts`
  grants: `owner: ac.newRole(allPermissions)` (auto-gets it via `allPermissions`),
  `admin: ac.newRole({ … idp: ['override_step_failure'] … })` (explicit add). Update
  the `allPermissions` map too. tRPC gate: `requirePermission({ idp: ['override_step_failure'] })`.
- **Override pattern (D-09..D-13) — fully realized precedent in tree:**
  `packages/api/src/routers/workflow/workflow-execution.ts` `overrideBlockingTask`:
  `.use(requirePermission({ workflow: ['override_blocking_task'] }))`,
  Zod `reason: z.string().min(20).max(2000)` + `acknowledged: z.literal(true)`,
  single `$transaction` writing `WorkflowRun.overrideMetadata` JSONB + `AuditLog`
  row + task status. UI: `apps/web-vite/src/components/offboarding/override-badge.tsx`
  (permanent badge w/ tooltip) + `apps/web-vite/src/components/workflows/hooks/use-run-header.ts`
  (permission-gated button + override-modal state + mutation hook). Phase 77 D-12's
  `overrideStepFailure(stepId, category, note)` mirrors this verbatim: closed-enum
  `ManualOverrideCategory` dropdown + `note: z.string().min(20)`, $transaction
  writing the 4 `manualOverride*` columns + `status=MANUAL_COMPLETED` + AuditLog
  `idp.deprovisioning.step.manual_completed` + `recomputeRunStatus(runId)`.
- **Audit logger:** `getIdpAuditLogger()` (Phase 70) + `IDP_AUDIT_ALLOWED_FIELDS`
  (Phase 76 Plan 76-03 extends). Phase 77 emits: `idp.preview.failed_proceed`,
  `idp.deprovisioning.step.manual_completed`, `idp.slack.org_grid_unavailable`,
  `idp.deprovisioning.run.completed_via_override`. New audit fields needed
  (`manualOverrideCategory`, `errorClass`, etc.) must be added to
  `IDP_AUDIT_ALLOWED_FIELDS` by Phase 77 (additive) OR routed through existing
  allowed fields.
- **Feature flags / signoff (D-15):** `packages/feature-flags/src/signoff-registry-flags.json`
  + `signoff-registry-flags.ts` (`isGatedFlag`, `getFlagSignoff`,
  `assertFlagSignoffsOrExit`, `FLAG_SIGNOFF_BYPASS=local`). Add TWO PENDING entries
  `idp-deprovisioning-gws` + `idp-deprovisioning-slack`. Flag *definitions* go in
  `packages/feature-flags/src/flags-core.ts` (the `FLAGS` record, `category: 'module'`).
  The admin feature-flags surface (`apps/web-vite/src/components/settings/feature-flags-tab.tsx`)
  is read-only (toggles live in Unleash); the per-provider *enable toggle* (D-15) is
  a separate `Setting.idpDeprovisioningEnabled.{provider}` org-keyed boolean, NOT a
  flag mutation.
- **Workflow ACCESS_REVOKE (D-12 parent auto-complete):** `WorkflowTaskType.ACCESS_REVOKE`
  exists (`packages/db/prisma/schema/workflow.prisma`); offboarding template seeds it
  (`workflow-templates.ts`, `IT_ADMIN`, dueOffset 1). Phase 77's run reaching terminal
  status auto-completes the parent `ACCESS_REVOKE` task (observe → recompute → complete
  + dual AuditLog entries).

---

## 6. Saga / settings UI surfaces — greenfield in web-vite

No existing reconcile-queue / deprovisioning admin surface in `apps/web-vite`
(verified — only the GWS reconnect-banner exists). Phase 77 builds the saga UI fresh:
- A deprovisioning run/step view (per-step rows; `LIKELY_GONE` rendering; per-failed-step
  "Mark complete" button gated by `idp:override_step_failure`; persistent override
  badge w/ category icon + tooltip; "Refresh" preview button). Likely surfaced from
  the offboarding workflow run / contractor profile — wire as a Page→Container→Hook
  set under `apps/web-vite/src/components/idp/` (new domain) or `…/offboarding/`.
- Settings: a "Slack Org Grid (deprovisioning)" connection card in
  `integrations-tab.tsx` (second card next to existing Slack), and a per-provider
  IdP-deprovisioning toggle table (new compliance/IdP tab) — both Container+Hook.
- i18n: add keys to `apps/web-vite` message catalogs (en, de, pl, ar) — admin-facing
  English copy is placeholder per CONTEXT.md (not legal-sensitive). RTL (ar) parity
  required.

---

## 7. Validation Architecture (Nyquist — drives VALIDATION.md)

The phase goal is **behavioral** (admin deprovisions GWS + Slack, sees preview,
overrides a failed step, second click is idempotent). Validation strategy:

- **Adapter-method unit tests (MSW-mocked, Phase 76 D-16 template):** each adapter
  method (`suspendAccount`, `revokeAllSessions` incl. both GWS sub-actions,
  `verifyDeprovisioned`, `describeImpact`) against mocked GWS + Slack HTTP responses.
  Assert: correct endpoint/method/body, scope-error→`PERMANENT_FORBIDDEN`,
  404→LIKELY_GONE, 429→`TRANSIENT_RATE_LIMIT`, SHA-256 hashes present & PII-free.
- **Error-classifier table test (D-07):** enumerate each HTTP status × provider
  error code → expected `ErrorClass`. Pure function, exhaustive.
- **Idempotency test (SC#5):** `verifyDeprovisioned`-true short-circuit returns
  `LIKELY_GONE` without a live API call (assert no fetch).
- **Audit-row count test (SC#2):** GWS deprovision emits exactly 3 audit rows with
  distinct response hashes (1 suspend + 2 revoke sub-actions).
- **Independence test (SC#3):** Slack step succeeds while GWS step FAILED in the same
  run — no cross-step coupling (already structurally guaranteed by per-tuple QStash
  jobs; assert at the recompute level → `PARTIAL_FAILURE`).
- **Override-flow test (SC#4):** `overrideStepFailure` requires the permission,
  enforces `note.min(20)`, flips `MANUAL_COMPLETED`, writes 4 columns + AuditLog +
  recompute, parent ACCESS_REVOKE auto-completes.
- **describeImpact cache test (SC#1/D-02):** cache hit avoids live calls; force-refresh
  bypasses; preview-fetch failure → admin-choice flow + `idp.preview.failed_proceed`.
- **Enterprise-Grid detection test (D-16):** all three detection points emit
  `idp.slack.org_grid_unavailable` and route to non-fatal skip.
- **UI states:** loading/empty/error for preview, run view, settings toggle, override
  modal (WCAG: keyboard, focus, contrast).

**Measurement signal:** these are deterministic mocked tests + tRPC caller tests; no
live-provider calls in CI. Coverage is the audit grep (3 rows), the enum exhaustive
table, the cache call-count assertions, and the run-status derivation.

---

## RESEARCH COMPLETE
