# Phase 77: F2 IdP — GWS + Slack Adapters (the wedge) - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Concrete first-two adapters atop Phase 76's `Deprovisionable` interface, saga, and scope registry — the "wedge" that gets ~95% of SMB customers (per FEATURES analysis):

1. **Google Workspace adapter** — extends existing v3.0 `google-workspace-adapter.ts`. Implements `Deprovisionable.suspendAccount` (= `users.update({ suspended: true })`) and `Deprovisionable.revokeAllSessions` (= `directory.tokens.list → tokens.delete` per token + `users.signOut`).
2. **Slack adapter** — extends existing v2.0 `slack-adapter.ts`. Implements `Deprovisionable.suspendAccount` (= SCIM PATCH `/Users/{id}` `{ active: false }` via raw fetch with org-grid token) and `Deprovisionable.revokeAllSessions` (= `admin.users.session.invalidate`).
3. **Per-IdP `describeImpact` preview** — typed discriminated-union `ImpactPreview` returned to the saga UI BEFORE deprovision runs, with provider-specific custom metrics + 5min Upstash Redis cache + force-refresh.
4. **MANUAL_ESCALATION override after retry exhaustion** — new step status `MANUAL_COMPLETED` + closed-enum reason category + free-text rationale + permanent inline badges across saga UI, offboarding-record header, and AuditLog. New permission `idp:override_step_failure` (default OWNER + ADMIN).
5. **Slack Enterprise Grid org-token plumbing** — separate `IntegrationConnection` row of `subKind: 'SLACK_ORG_GRID'` with org-level `scim:write` + `admin.users.session:write` scopes; pre-flight Enterprise-Grid detection layered across Settings + describeImpact + saga-start.
6. **Per-flag gating** — TWO independent `compliance-policy-engine`-style PENDING flags: `idp-deprovisioning-gws` + `idp-deprovisioning-slack`, with admin Settings > Compliance > IdP Deprovisioning per-provider opt-in toggle.

Out of scope: saga + cooldown gate + interface itself (Phase 76), Entra/Okta/GitHub adapters (Phase 78), webhook self-trigger filter (Phase 76 `IdpChangeProvenance` is reused — no new webhook plumbing). Phase 77 is purely adapter implementations + the per-IdP preview/escalation UI surfaces atop Phase 76's saga.

</domain>

<decisions>
## Implementation Decisions

### `describeImpact` preview — data, freshness, type extensibility

- **D-01:** `describeImpact` returns a typed discriminated-union `ImpactPreview` keyed by `provider`:
  ```ts
  type ImpactPreview =
    | {
        provider: 'GOOGLE_WORKSPACE',
        commonMetrics: {
          externalUserId: string,
          externalUserDisplayName: string,
          accountStatus: 'ACTIVE' | 'SUSPENDED' | 'NOT_FOUND',
          sessionCount: number | null,
        },
        customMetrics: GwsImpactCustomMetrics,  // { oauthGrants: Array<{ appName, scopes: string[] }>, isSuperAdmin: boolean, drivesOwnedCount: number | null }
        fetchedAt: string,  // ISO-8601
        cacheKey: string,
      }
    | {
        provider: 'SLACK',
        commonMetrics: {...},
        customMetrics: SlackImpactCustomMetrics,  // { channelsMemberCount, ownedChannelCount, installedAppCount, isWorkspaceAdmin: boolean, isOrgOwner: boolean, error?: 'NOT_ON_ENTERPRISE_GRID' | null }
        fetchedAt: string,
        cacheKey: string,
      };
  ```
  Saga UI narrows on `provider` field with exhaustive `switch` for rendering. Phase 78 adds new union members without modifying existing ones. CI lint asserts the union matches Phase 76 D-14 scope-registry providers list.
- **D-02:** Preview is cached 5 minutes in Upstash Redis (existing `packages/api/src/services/cache.ts`). Cache key format: `co:idp:preview:{provider}:{externalUserId}` (Phase 72-rejected pattern reused). On cache miss, adapter makes live API calls. Saga UI shows freshness label "Last refreshed: {N}min ago" + a "Refresh" button that bypasses cache. Mirrors economic-dependency-scan style staleness affordance.
- **D-03:** Preview-fetch failure handling — show error banner + allow deprovision to proceed without preview. Saga UI surfaces `"Impact preview unavailable: <reason> — deprovisioning will proceed without preview. Continue?"` with explicit `Continue without preview` + `Cancel` buttons. Audit log entry `idp.preview.failed_proceed` captures the choice. Failure-classifier: 401 routes to existing v3.0 reconnect-required banner instead (PERMANENT_AUTH_EXPIRED per D-08); 429/503 falls through to admin-choice flow; transient network errors retry once before showing the banner.
- **D-04:** Per-provider preview API calls (live, behind cache):
  - **GWS:** `users.get(externalUserId)` for accountStatus + isSuperAdmin; `tokens.list(externalUserId)` for OAuth grants (handles pagination); `users.signOut`-equivalent read API for sessionCount (best-effort; if the Admin SDK doesn't expose live session count, surface `null`); `drives.list({ q: 'me in owners' })` for `drivesOwnedCount` (best-effort).
  - **Slack:** `users.info(externalUserId)` for accountStatus + workspace/org-admin booleans; `users.conversations(types=public_channel,private_channel)` for `channelsMemberCount`; `apps.permissions.users.list` for `installedAppCount`. SCIM-only org-grid detection: if `users.lookupByEmail` returns `cannot_perform_operation`, set `customMetrics.error = 'NOT_ON_ENTERPRISE_GRID'`.
  - All calls use existing v3.0 / v2.0 adapter base infrastructure; Researcher pins exact method signatures from current Anthropic-style Context7 lookups for Google Admin SDK + Slack Web API.

### Per-step API execution + error handling + `LIKELY_GONE` detection

- **D-05:** Step-method distribution maps Phase 76 D-13's `Deprovisionable` to provider semantics:
  - **GWS:** `suspendAccount(externalUserId)` calls `users.update({ suspended: true })`. `revokeAllSessions(externalUserId)` does TWO sub-actions sequentially (capped concurrency 5 on `tokens.delete`): (a) `tokens.list` then `tokens.delete` per token (OAuth-grant revocation), (b) `users.signOut`. Both sub-actions must succeed or step is FAILED. Both sub-actions get their OWN SHA-256 request/response hash logged for audit (so ROADMAP SC#2 "three step rows with response hashes" maps to: 1 row from `suspendAccount` + 2 sub-action audit rows from `revokeAllSessions`). Saga sees one `revokeAllSessions` job; audit grep sees three rows.
  - **Slack:** `revokeAllSessions(externalUserId)` calls `admin.users.session.invalidate`. `suspendAccount(externalUserId)` calls SCIM PATCH `/Users/{id}` `{ Operations: [{ op: 'replace', path: 'active', value: false }] }` via raw `fetch` with the org-grid token. Each runs as an independent QStash job per Phase 76 D-03 fan-out — GWS-vs-Slack independence falls out naturally since they're different `(provider, stepKind)` tuples.
- **D-06:** Idempotency on second click via `Deprovisionable.verifyDeprovisioned(externalUserId)` short-circuit + new `LIKELY_GONE` result enum value:
  - Each step method first calls `verifyDeprovisioned`; if true → returns `DeprovisionResult { status: 'LIKELY_GONE', skipped: true, reason: 'already_deprovisioned' }` without making the live API call. No retry. ROADMAP SC#5 "second click returns `LIKELY_GONE` per provider" maps to this exact enum value.
  - **GWS verify:** `users.get(externalUserId)` → `user.suspended === true` is LIKELY_GONE; 404 → also LIKELY_GONE.
  - **Slack verify:** `users.info(externalUserId)` → `user.deleted === true` is LIKELY_GONE; `users.lookupByEmail` returning 404 / `users_not_found` → also LIKELY_GONE.
  - Aggregate `recomputeRunStatus` (Phase 76 D-02) treats LIKELY_GONE as terminal-success-equivalent for COMPLETED/PARTIAL_FAILURE derivation.
- **D-07:** Closed-enum error classifier per HTTP status + provider error code, in new file `packages/integrations/src/idp/error-classifier.ts`:
  ```ts
  type ErrorClass =
    | 'TRANSIENT_RATE_LIMIT'        // 429, 503; retry via QStash exp-backoff
    | 'TRANSIENT_NETWORK'            // ECONNRESET, ETIMEDOUT, fetch failures; retry
    | 'PERMANENT_NOT_FOUND'          // 404 → maps to LIKELY_GONE per D-06
    | 'PERMANENT_AUTH_EXPIRED'       // 401 → routes to existing v3.0 reconnect-required banner
    | 'PERMANENT_FORBIDDEN'          // 403 with `forbidden`/`insufficientPermissions` → scope-config drift; surface lint:scopes hint
    | 'PERMANENT_OTHER';             // all other 4xx → admin escalation per D-09
  ```
  TRANSIENT classes go through QStash native exponential-backoff (Phase 76 D-03). PERMANENT classes mark step FAILED immediately with `lastErrorMessage` AND `errorClass` columns set (additive nullable columns on `DeprovisioningStep`). CI test enumerates each HTTP status with mocked GWS + Slack responses; uses Phase 76 D-16 MSW template.
- **D-08:** Slack-specific edge cases:
  - SCIM API distinguishes `cannot_perform_operation` (org-grid not enabled) → routes to `PERMANENT_FORBIDDEN` with descriptive errorClass `slack_not_on_enterprise_grid` for clear admin messaging.
  - `admin.users.session.invalidate` requires `admin.users.session:write` scope; missing scope → `PERMANENT_FORBIDDEN` with hint pointing at Phase 76 D-15 `lint:scopes` guard.
  - Org-token expiry → re-OAuth flow on the SLACK_ORG_GRID connection (NOT the user-level Slack connection — D-13 keeps them separate).

### MANUAL_ESCALATION override after retry exhaustion

- **D-09:** New permission `idp:override_step_failure` registered in `packages/auth/src/permissions.ts` (Phase 74 D-09 pattern; Phase 73 D-10 + Phase 75 D-XX style). Default-grant to OWNER + ADMIN. Per-org admins can re-scope via existing role customisation. Distinct from Phase 74 `workflow:override_blocking_task`, Phase 73 `compliance:override`, Phase 75 (none) — each has its own audit-grep namespace.
- **D-10:** New step status `MANUAL_COMPLETED` extends `DeprovisioningStep.status` enum (Phase 76 D-01) additively: `PENDING | IN_PROGRESS | SUCCEEDED | FAILED | MANUAL_COMPLETED`. New columns added to `DeprovisioningStep`:
  - `manualOverrideCategory ManualOverrideCategory?` (closed enum: `verified_via_vendor_console`, `user_already_inactive`, `provider_endpoint_deprecated`, `transient_provider_issue_resolved`, `other`)
  - `manualOverrideNote String?` (Zod min(20))
  - `manualOverriddenByUserId String?`
  - `manualOverriddenAt DateTime?`
  All additive nullable; multi-region apply per Standing Constraint.
- **D-11:** Aggregate `recomputeRunStatus` (Phase 76 D-02) treats `MANUAL_COMPLETED` equivalent to `SUCCEEDED` for COMPLETED/PARTIAL_FAILURE derivation. The override is the equivalent of "this step is done, by manual verification" — Phase 76's run-status state-machine already knows how to consume this without changes.
- **D-12:** Override button placement + workflow effect — per-failed-step button in saga UI:
  - Each `DeprovisioningStep` row in `FAILED` status with `attempts >= MAX_ATTEMPTS` (Phase 76 D-03) exposes a "Mark complete" button gated by `idp:override_step_failure` permission.
  - Clicking opens a confirm modal: closed-enum category dropdown + Zod-min(20) free-text rationale. New tRPC mutation `idpDeprovisioning.overrideStepFailure(stepId, category, note)` performs the transition atomically: writes the four `manualOverride*` columns + flips `status = MANUAL_COMPLETED` + emits AuditLog `idp.deprovisioning.step.manual_completed` entry + calls Phase 76 `recomputeRunStatus(runId)`.
  - Parent offboarding `WorkflowRun.ACCESS_REVOKE` task observes the run reaching terminal status and auto-completes — admin DOES NOT need a second click on the workflow task. AuditLog captures BOTH the manual-override AND the parent task auto-complete as separate timestamped entries.
- **D-13:** Permanent-failure badge surfaced in THREE places (single data source):
  - **Saga UI step row:** persistent badge "Manually completed by Admin Jane on 2026-04-27 — reason: verified_via_vendor_console" with category icon + tooltip showing free-text rationale.
  - **Offboarding-record header timeline:** permanent inline entry (mirrors Phase 74 D-11 `OffboardingRecord.overrideMetadata` pattern) "GWS deprovisioning step 'revoke OAuth grants' manually completed by Admin Jane".
  - **AuditLog grep:** `idp.deprovisioning.step.manual_completed` entries with full payload (`stepId`, `runId`, `category`, `note`, `overriddenByUserId`, `actorRoleSnapshot`).
  Reuses existing `audit_log` table; no new audit table.

### Slack SCIM org-token + per-flag gating

- **D-14:** Slack SCIM org-token: separate `IntegrationConnection` row of `subKind: 'SLACK_ORG_GRID'` with org-level OAuth grant. Existing v2.0 Slack integration (workspace-level scopes for approval flows) stays unchanged. Phase 77 adds:
  - New OAuth flow at `/api/integrations/slack-org-grid/connect` requesting org-level scopes from Phase 76 D-14 typed-const registry: `admin.users.session:write` + `scim:write`.
  - Admin Settings > Integrations > Slack now shows TWO connection cards: "Slack Workspace" (existing) + "Slack Org Grid (deprovisioning)" (new).
  - `IntegrationConnection.scopeCapabilities` JSONB (Phase 70 D-13) tracks which capabilities each connection holds.
  - Pre-flight Enterprise-Grid detection: `users.lookupByEmail` returning `cannot_perform_operation` is the canonical signal (Slack returns this on workspace-only plans). Surface "Your Slack workspace is not on Enterprise Grid — deprovisioning unavailable" + link to Slack docs.
- **D-15:** Per-flag gating — per-provider check at saga-start + admin Settings UI per-provider opt-in toggle:
  - `idp-deprovisioning-gws` and `idp-deprovisioning-slack` are independent PENDING entries in `signoff-registry.json` (Phase 70 D-09).
  - Saga `startDeprovisioningRun` enumerates connected providers AND filters to those whose specific flag is APPROVED (or `FLAG_SIGNOFF_BYPASS=local` is set). Disabled providers don't enqueue QStash jobs and don't appear in the run.
  - Admin Settings > Compliance > IdP Deprovisioning shows a per-provider table: `[Provider | Connection Status | Flag Status | Action]` with explicit "Enable for org" toggle per provider (only enableable when flag is APPROVED). Each toggle persists in `Setting.idpDeprovisioningEnabled.{provider}` (boolean keyed per org).
  - Admin can flip GWS ON without flipping Slack — independent rollout per the "wedge" framing.
- **D-16:** Pre-flight "missing org-token / not on Enterprise Grid" — THREE detection points (defense-in-depth):
  - **Settings page enable-toggle:** Slack-Org Connection card greys out the "Connect" button with "Requires Slack Enterprise Grid plan" + link to Slack docs. Detection: try `users.lookupByEmail` once at OAuth-callback time and store the result in `IntegrationConnection.scopeCapabilities.unavailableReason` (or similar field).
  - **`describeImpact` (D-04):** returns `{ provider: 'SLACK', customMetrics: { error: 'NOT_ON_ENTERPRISE_GRID' } }`; saga UI renders "Slack: org-grid unavailable, will skip" non-fatal banner.
  - **Saga-start eligibility check:** `startDeprovisioningRun` enumerates eligible providers; Slack is excluded if no SLACK_ORG_GRID connection OR if its `unavailableReason = 'not_on_enterprise_grid'`. Saga UI shows "Slack: skipped (org-grid unavailable)".
  - All three trigger AuditLog `idp.slack.org_grid_unavailable` for forensics. Layered surface means the issue is detected at the earliest possible point AND reaffirmed before commit.

### Claude's Discretion

- Exact Google Admin SDK method signatures for `users.signOut` and the live-session-count read endpoint — Researcher pins via Context7 (`googleapis@latest` admin SDK docs). If `signOut` doesn't have a live-session-count read sibling, `commonMetrics.sessionCount = null` and UI shows "—" instead of zero.
- Exact `tokens.delete` rate-limit + concurrency cap — Researcher pins from current Google API quotas. Default cap-5 concurrent deletes is a reasonable starting point but tunable.
- Exact Slack `users.conversations` pagination cap (channelsMemberCount may exceed 1000 for active users) — Researcher confirms whether to fetch full list or just sample.
- Exact Slack `apps.permissions.users.list` shape — Researcher validates schema; may need to use `users.info` with `include_locale=false` if no dedicated app-installations endpoint exists.
- Exact retry budget (Phase 76 D-03 already capped attempts; Phase 77 may want per-error-class custom budgets — TRANSIENT_RATE_LIMIT could justify higher retry count vs TRANSIENT_NETWORK).
- Exact UI copy of override modal + reject modal — placeholder English; admin-facing, not legal-sensitive (no signoff registry).
- Whether to add a per-org "preview-only" mode that shows `describeImpact` without enabling actual deprovisioning — could ship as a future enhancement; out of scope this phase.
- Pino log structure for `idp.preview.failed_proceed` and the `idp.deprovisioning.step.manual_completed` events — match existing `packages/api/src/services/*.ts` log conventions.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architectural twins & data sources
- `.planning/phases/76-f2-idp-capability-mixin-saga-schema-cooldown-gate-gws-scope-/76-CONTEXT.md` — Phase 76 decisions: D-13 `Deprovisionable` interface (Phase 77 implements), D-01..D-04 saga + fan-out + recomputeRunStatus + manual-retry-per-step, D-05..D-08 14-day cooldown gate (upstream of adapter), D-09..D-12 IdpChangeProvenance self-trigger filter, D-14 typed-const scope registry, D-15 lint:scopes CI guard, D-16 MSW test template (Phase 77 fills in real GWS + Slack tests).
- `.planning/phases/74-f4-offboarding-workflow-foundation-kt-templates-override-per/74-CONTEXT.md` — Phase 74 D-09..D-12 OWNER-only override pattern + permanent-badge `OffboardingRecord.overrideMetadata` JSONB column. Phase 77 D-13 mirrors verbatim for the offboarding-record header timeline entry.
- `.planning/phases/70-v6-0-foundation-cross-cutting-ci-guards-observability-baseli/70-CONTEXT.md` — Phase 70 D-09 parallel signoff registry (Phase 77 D-15 adds 2 PENDING entries), D-10 `FLAG_SIGNOFF_BYPASS=local` bypass, D-13 `scopeCapabilities` JSONB shape (Phase 77 D-14 SLACK_ORG_GRID connection populates), D-16 google-workspace-reconnect-banner.tsx (Phase 77 D-03 routes auth-expired here).

### Existing adapters (Phase 77 extension target)
- `packages/integrations/src/adapters/google-workspace-adapter.ts` — current GWS adapter (v3.0 directory-import). Phase 77 layers `implements Deprovisionable` on top; adds suspendAccount + revokeAllSessions + verifyDeprovisioned methods.
- `packages/integrations/src/adapters/slack-adapter.ts` — current Slack adapter (v2.0 approval flows). Phase 77 layers `implements Deprovisionable` on top; adds suspendAccount + revokeAllSessions + verifyDeprovisioned methods. Note: SCIM uses raw `fetch` with org-grid token, not the adapter's web-API client.
- `packages/integrations/src/adapters/base-adapter.ts` — `BaseAdapter` abstract class. Phase 76 D-13 already added the `Deprovisionable` interface; Phase 77 implements it.
- `packages/integrations/src/types/deprovisionable.ts` — Phase 76 D-13 NEW interface file (Phase 77 implements verbatim).
- `packages/integrations/src/types/provider.ts` — `IntegrationProviderAdapter` and `OAuthConfig` types — Phase 77 D-14 SLACK_ORG_GRID `subKind` registers here.

### Saga + cooldown infrastructure (Phase 77 reuses, does not modify)
- `packages/integrations/src/scopes/google-workspace-deprovision-scopes.ts` (Phase 76 D-14 NEW) — Phase 77 EXTENDS scope registry as needed.
- `packages/integrations/src/scopes/slack-deprovision-scopes.ts` (Phase 76 D-14 NEW) — exports `SLACK_DEPROVISION_SCOPES = ['admin.users.session:write', 'scim:write'] as const`.
- `@contractor-ops/idp-saga` workspace package (Phase 76 D-05) — saga orchestrator + `cooldown.canStartDeprovisioning` helper. Phase 77 calls it; doesn't modify it.
- `packages/db/prisma/schema/{idp-saga,contractor}.prisma` — Phase 76 added `DeprovisioningRun` + `DeprovisioningStep` + `IdpChangeProvenance` tables. Phase 77 ADDS columns to `DeprovisioningStep` (D-10): `manualOverrideCategory ManualOverrideCategory?`, `manualOverrideNote String?`, `manualOverriddenByUserId String?`, `manualOverriddenAt DateTime?`, plus `errorClass ErrorClass?` (D-07). All additive nullable; multi-region apply per Standing Constraint.

### Cache infrastructure
- `packages/api/src/services/cache.ts` — Upstash Redis singleton; Phase 77 D-02 reuses for `co:idp:preview:{provider}:{externalUserId}` keys.

### Audit + permissions
- Existing `audit_log` table — Phase 77 emits: `idp.preview.failed_proceed`, `idp.deprovisioning.step.manual_completed`, `idp.slack.org_grid_unavailable`, `idp.deprovisioning.run.completed_via_override`. No new audit-log table.
- `packages/auth/src/permissions.ts` — Phase 77 D-09 registers `idp:override_step_failure` (Phase 74 D-09 pattern).
- `packages/auth/src/roles.ts` — default permission grants per role. Phase 77 D-09 adds to OWNER + ADMIN.

### tRPC routers
- `packages/api/src/routers/idp-deprovisioning.ts` (Phase 76 created or to be created — Researcher resolves) — Phase 77 EXTENDS with new mutations: `overrideStepFailure(stepId, category, note)` (D-12), `enableProviderForOrg(provider)` (D-15 toggle), `connectSlackOrgGrid(...)` (D-14 OAuth start).
- `packages/api/src/routers/integration-connection.ts` (or wherever — Researcher resolves) — Phase 77 adds the new SLACK_ORG_GRID `subKind` connection lifecycle.

### Settings UI integration points
- `apps/web/src/app/[locale]/(dashboard)/settings/integrations/` — admin Settings > Integrations > Slack. Phase 77 D-14 adds the second "Slack Org Grid (deprovisioning)" card here.
- `apps/web/src/app/[locale]/(dashboard)/settings/compliance/` (or new sub-route) — Phase 77 D-15 adds the per-provider IdP-deprovisioning toggle table here.

### Saga UI integration points
- Saga UI (Phase 76 admin reconcile-queue surface — Researcher resolves the route) — Phase 77 adds:
  - Per-step `LIKELY_GONE` rendering (D-06).
  - Per-failed-step "Mark complete" button gated by `idp:override_step_failure` permission (D-12).
  - Persistent override badge with category icon + tooltip (D-13).
  - "Refresh" button for `describeImpact` cache bypass (D-02).

### Standing constraints
- `.planning/STATE.md` "Standing Project Constraints" — LOCAL-ONLY, legal review DEFERRED. Phase 77's two flag entries (`idp-deprovisioning-gws`, `idp-deprovisioning-slack`) land PENDING per Phase 70 D-09. Engineers develop with `FLAG_SIGNOFF_BYPASS=local`. Production deploy gate: zero PENDING entries in scope.

### ROADMAP entry (success criteria source-of-truth)
- `.planning/ROADMAP.md` "Phase 77: F2 IdP — GWS + Slack Adapters (the wedge)" — 5 numbered success criteria. Phase 77 maps:
  - SC #1 → D-01..D-04 (`describeImpact` preview with concrete impact data BEFORE deprovision)
  - SC #2 → D-05 (GWS three-step audit-row distribution + step-method mapping)
  - SC #3 → D-05 (Slack two-step independence; D-14 SLACK_ORG_GRID connection plumbing)
  - SC #4 → D-09..D-13 (MANUAL_ESCALATION override + new MANUAL_COMPLETED status + permanent badge)
  - SC #5 → D-06 (LIKELY_GONE per-provider idempotent semantic via `verifyDeprovisioned` short-circuit)

### Requirements
- `.planning/REQUIREMENTS.md` — IDP-01 (`ACCESS_REVOKE` task triggers + per-IdP impact preview), IDP-03 (GWS suspend + revoke OAuth grants + sign-out-all-sessions), IDP-04 (Slack session-invalidate + SCIM-deactivate), IDP-12 (Slack admin scim:write org-token requirement).

### NEEDS RESEARCH (per ROADMAP)
- GWS `tokens.delete` behaviour + current rate-limits — Researcher pins via Context7.
- Slack SCIM `scim:write` org-token requirement — Researcher confirms via Context7 + Slack docs.
- Slack admin scopes' Enterprise-Grid-only nature — Researcher confirms.
- Current Slack rate-limits per scope — Researcher confirms.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`packages/integrations/src/adapters/google-workspace-adapter.ts`** + **`slack-adapter.ts`** — Phase 77 EXTENDS, no greenfield.
- **`BaseAdapter`** abstract class — Phase 76 D-13 layered `Deprovisionable` interface; Phase 77 implements per-provider methods.
- **`packages/integrations/src/scopes/{provider}-deprovision-scopes.ts`** (Phase 76 D-14) — Phase 77 references for OAuth scope set.
- **`packages/api/src/services/cache.ts`** Upstash Redis singleton — Phase 77 D-02 uses for preview cache.
- **`getIdpAuditLogger()` + `IDP_AUDIT_ALLOWED_FIELDS`** (Phase 70 D-15) — Phase 77 emits step-completion + override audit entries through this.
- **`IntegrationConnection.scopeCapabilities` JSONB** (Phase 70 D-13) — Phase 77 D-14 SLACK_ORG_GRID connection populates.
- **`google-workspace-reconnect-banner.tsx`** (Phase 70 D-16) — Phase 77 D-03 routes 401 errors here for re-OAuth.
- **`packages/auth/src/permissions.ts`** registry (Phase 74 D-09 / Phase 73 D-10 pattern) — Phase 77 D-09 plugs `idp:override_step_failure` in here.
- **MSW test infrastructure** (`packages/test-utils/src/msw/`) — Phase 76 D-16 ships template; Phase 77 fills in GWS + Slack real-mock tests.
- **`scopeCapabilitiesSchema`** Zod schema (Phase 70 D-13) — Phase 77 D-14 callback boundary validation.

### Established Patterns
- **Discriminated union for provider-specific extensions** (Phase 78 will add Entra/Okta/GitHub members) — Phase 77 D-01 establishes for `ImpactPreview`.
- **Cache 5min in Upstash + force-refresh button** — common across the app (similar pattern in compliance dashboard); Phase 77 D-02 follows.
- **Closed-enum error classifier per HTTP status + provider error code** (Phase 76 D-02 transient/permanent distinction; Phase 71 status-machine) — Phase 77 D-07 follows.
- **`verifyDeprovisioned` short-circuit + idempotent return enum** (Phase 76 D-13 + new LIKELY_GONE) — Phase 77 D-06 establishes per-provider verify implementation.
- **Closed-enum + free-text rationale + permanent inline badge** (Phase 71 D-11; Phase 73 D-10..D-13; Phase 75 D-12) — Phase 77 D-09..D-13 mirrors for IdP step override.
- **Per-flag PENDING + LOCAL-ONLY bypass** (Phase 70 D-09 / D-10; Phase 71 D-04; Phase 73 D-16; Phase 75 D-16) — Phase 77 D-15 follows for the two `idp-deprovisioning-*` flags.
- **Layered defense-in-depth detection** (Phase 71 transactional supersession; Phase 72 multi-entry-point assertContractorPaymentEligibility; Phase 73 dashboard + Compliance tab dual-surface) — Phase 77 D-16 follows for Enterprise-Grid pre-flight.
- **Separate IntegrationConnection rows per scope tier** (Phase 70 D-13 scopeCapabilities) — Phase 77 D-14 SLACK_ORG_GRID separate from existing Slack connection.

### Integration Points
- **`packages/integrations/src/adapters/google-workspace-adapter.ts`** — `implements Deprovisionable`; new methods suspendAccount + revokeAllSessions + verifyDeprovisioned + describeImpact.
- **`packages/integrations/src/adapters/slack-adapter.ts`** — same; SCIM via raw fetch with org-grid token.
- **`packages/db/prisma/schema/idp-saga.prisma`** (Phase 76 added) — Phase 77 adds 5 columns to `DeprovisioningStep` (D-10 + D-07) + new enum `ManualOverrideCategory` + new enum `ErrorClass`. Multi-region apply per Standing Constraint.
- **`packages/auth/src/permissions.ts`** — `idp:override_step_failure` registered (D-09).
- **`packages/api/src/routers/idp-deprovisioning.ts`** — three new mutations (D-12 + D-14 + D-15).
- **`apps/web/src/app/[locale]/(dashboard)/settings/integrations/`** — Slack Org Grid connection card.
- **`apps/web/src/app/[locale]/(dashboard)/settings/compliance/`** — per-provider IdP-deprovisioning toggle table.
- **Saga UI route (Phase 76 — Researcher resolves)** — per-step LIKELY_GONE rendering, override button, persistent badge, refresh button.
- **`packages/feature-flags/src/signoff-registry-flags.ts` + `signoff-registry.json`** — Phase 77 D-15 adds TWO PENDING entries (`idp-deprovisioning-gws`, `idp-deprovisioning-slack`).

</code_context>

<specifics>
## Specific Ideas

- The discriminated-union `ImpactPreview` (D-01) is the seam where Phase 78 plugs in 3 more providers (Entra/Okta/GitHub) without refactoring existing code — type-system enforces the fan-out.
- `LIKELY_GONE` (D-06) is the wedge-phase contribution to the saga vocabulary — Phase 76 didn't define it because it's a per-provider observation, not a saga-state concern. Phase 78 reuses verbatim.
- Three places where the Slack Enterprise-Grid limit surfaces (D-16) is intentional defense-in-depth — admin discovers the limit at the earliest point AND has it confirmed before commit.
- The error classifier (D-07) is what makes the saga's retry budget meaningful: 5 retries for TRANSIENT_RATE_LIMIT is good; 5 retries for PERMANENT_FORBIDDEN is wasted budget. Per-class budgeting (in Phase 76 D-03) becomes useful only with classification.
- Step-method distribution for GWS (D-05) is the most opinionated mapping in this phase. ROADMAP wording "audit log captures three step rows" is preserved by sub-action audit hashes inside the single `revokeAllSessions` step — Phase 77 doesn't extend Phase 76's interface to fit ROADMAP wording verbatim.
- The new permission `idp:override_step_failure` (D-09) is its own permission key, not reusing Phase 74 / 73 / 75 — three separate audit-grep namespaces, three separate signoff conversations if compliance review ever needs them.
- Slack-Org-Grid as a separate connection (D-14) means an org without Enterprise Grid still uses the existing Slack integration for approval flows; deprovisioning just isn't available. No regression.

</specifics>

<deferred>
## Deferred Ideas

- **Generic count-only ImpactPreview** — rejected in D-01 in favour of typed discriminated union with provider-specific custom metrics. ROADMAP SC#1 wording requires concrete app-name detail.
- **Free-form `description` string per provider** — rejected in D-01.
- **Live every click, no cache** — rejected in D-02. Burns rate-limit budget on saga UI peeks.
- **Cache 1h, no force-refresh** — rejected in D-02. Stale session-count is misleading.
- **Hard-block deprovision until preview succeeds** — rejected in D-03. Cascades transient outages into bigger problems.
- **Silent skip + auto-proceed without preview on fetch failure** — rejected in D-03. Defeats SC#1.
- **Generic `customMetrics: Record<string, unknown>`** — rejected in D-01. Loses compile-safety.
- **Separate `ImpactPreviewable` interface** — rejected in D-01 alternatives.
- **Three independent step methods on `Deprovisionable`** — rejected in D-05. Modifying Phase 76's locked interface for one provider breaks abstraction.
- **`suspendAccount` does everything** — rejected in D-05. Loses fan-out granularity.
- **Catch-and-ignore 404 only (no proactive verify)** — rejected in D-06. Burns API budget on no-op writes.
- **Saga-layer dedup based on previous run status** — rejected in D-06. Misses external-suspend case.
- **Generic transient/permanent split by HTTP status only** — rejected in D-07. Loses per-class budgeting + per-class UX routing.
- **Retry-everything-until-MAX_ATTEMPTS** — rejected in D-07. Burns retry budget on permanent errors.
- **Both Slack actions in `revokeAllSessions`; suspendAccount = no-op** — rejected in D-05.
- **Single Slack step that does both internally** — rejected in D-05. Loses fan-out granularity.
- **Reuse Phase 74 `workflow:override_blocking_task` (OWNER-only) for IdP override** — rejected in D-09. Too strict; routine deprovisioning failures shouldn't require OWNER intervention.
- **Reuse Phase 73 `compliance:override` for IdP override** — rejected in D-09. Naming/semantic conflict.
- **Boolean `manuallyOverridden` flag + keep status FAILED** — rejected in D-10. Audit grep ambiguity.
- **Free-text reason only, no enum** — rejected in D-10. Loses queryability.
- **Single "Mark whole run complete" button at run level** — rejected in D-12. Loses per-step audit granularity.
- **Override button on offboarding workflow task instead of saga UI** — rejected in D-12. Loses per-step granularity.
- **Saga UI badge only (no offboarding-record + audit-log)** — rejected in D-13. Phase 74 D-11 established three-surface pattern.
- **Audit-log entry only (no inline UI badges)** — rejected in D-13. Worst discoverability.
- **Extend existing Slack connection with `prompt=consent` re-OAuth** — rejected in D-14. Conflates user-level and org-level scopes.
- **Personal `xoxp-` Slack token + impersonation** — rejected in D-14. Massive security hole; Phase 75 D-11 secret-shape detector would reject the paste.
- **Single feature flag for whole IdP-deprovisioning** — rejected in D-15. Conflicts with ROADMAP wording + blocks gradual rollout.
- **Per-provider + master flag (both required)** — rejected in D-15. Adds flag without functional value.
- **Surface Enterprise-Grid limit only at saga-start** — rejected in D-16. Worst UX.
- **Hide Slack option entirely if not on Enterprise Grid** — rejected in D-16. Loses upsell potential.
- **Per-org "preview-only" mode** — captured in Claude's Discretion as a future enhancement; out of scope this phase.

</deferred>

---

*Phase: 77-f2-idp-gws-slack-adapters-the-wedge*
*Context gathered: 2026-04-27*
