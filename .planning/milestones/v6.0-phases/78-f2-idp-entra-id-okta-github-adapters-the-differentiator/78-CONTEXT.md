# Phase 78: F2 IdP — Entra ID + Okta + GitHub Adapters (the differentiator) - Context

**Gathered:** 2026-05-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Three new IdP adapter implementations atop Phase 76's `Deprovisionable` interface and Phase 77's established patterns (discriminated-union `ImpactPreview`, error classifier, `LIKELY_GONE`, `MANUAL_ESCALATION`). This is the "differentiator" phase — after Phase 77's wedge (GWS+Slack covering ~95% SMB), Phase 78 adds the enterprise-tier providers:

1. **Entra ID adapter** — implements `Deprovisionable` via Microsoft Graph. Disables account (`accountEnabled: false`), revokes all sign-in sessions (`revokeSignInSessions`). Novel pre-flight: Conditional Access policy enumeration warns admin of policies that may silently override the revoke (Pitfall 14). Novel hard-block: hybrid-AD detection refuses deprovisioning when on-prem AD is authoritative. Post-revoke verification via `signInActivity` polling.
2. **Okta adapter** — implements `Deprovisionable` via `@okta/okta-sdk-nodejs@8.0.0` namespaced API. Deactivates user (`userApi.deactivateUser`), clears active sessions (`revokeUserSessions`). Straightforward — follows Phase 77 GWS/Slack pattern closely.
3. **GitHub adapter** — implements `Deprovisionable` with GitHub-specific authorization model. Removes org member (`octokit.rest.orgs.removeMember`), explicitly revokes per-PAT credentials (SAML credential-authorization API for SSO orgs), flags outside-collaborator repos as manual-task with direct links.

Out of scope: saga infrastructure (Phase 76), `Deprovisionable` interface definition (Phase 76), discriminated-union pattern establishment (Phase 77), MANUAL_ESCALATION override flow (Phase 77), IdP dashboard polish (Phase 73).

</domain>

<decisions>
## Implementation Decisions

### Entra ID pre-flight checks

- **D-01:** Conditional Access policy detection — Claude's discretion on approach. Research must determine what Microsoft Graph exposes via `Policy.Read.All` for CA policy enumeration. The admin should see which policies exist that could override the session revoke BEFORE execution (Pitfall 14). Whether this is a warning-banner-proceed or risk-scored-gate depends on what Graph actually returns. The preview (`describeImpact`) surfaces CA policies; the saga-start can reference them.
- **D-02:** Hybrid-AD detection — Claude's discretion on implementation. Detection via `onPremisesSyncEnabled` / `dirSyncEnabled` fields from Microsoft Graph `User.Read.All`. When detected, system refuses deprovisioning with "On-prem AD authoritative — revoke at source" + link to a status panel (mirrors v3.0 GWS directory-import-style per SC#4). Whether this creates an offboarding workflow manual-task or simply blocks with a status panel link depends on Phase 74 workflow integration patterns — Researcher resolves.
- **D-03:** Post-revoke `signInActivity` verification — Claude's discretion. Researcher determines Microsoft Graph propagation guarantees and picks between single-poll-after-delay vs retry-poll-with-backoff. The verification maps to Phase 77 D-06's `verifyDeprovisioned` implementation for Entra.

### GitHub authorization model

- **D-04:** PAT revocation — Claude's discretion on mechanics. Researcher must determine what GitHub API supports for org-level PAT revocation. For SAML SSO orgs, the SAML credential-authorization API may allow revoking org-authorized PATs. For non-SAML orgs, PAT revocation may not be possible at the org level — in that case, surface a warning. The approach depends on what GitHub's API actually exposes.
- **D-05:** Outside-collaborator repo flagging — Claude's discretion on task model. After org-member removal, enumerate repos where the user remains an outside collaborator. Flag these as a manual review item (with direct GitHub links per repo) — whether as a saga step of type `MANUAL_REVIEW` or an offboarding workflow task depends on Phase 74/77 integration patterns. The key requirement is that the admin sees a list of repos with actionable links.
- **D-06:** Org-member removal is the primary deprovision action (`octokit.rest.orgs.removeMember`). This removes the user from the org, all teams, and revokes org-level access. However, outside-collaborator repo access survives org removal — hence D-05.

### OAuth connection topology

- **D-07:** Entra ID app registration — Claude's discretion, following Phase 77 SLACK_ORG_GRID precedent. Entra deprovisioning requires admin-consent scopes (`User.ReadWrite.All`, `Directory.Read.All`, `Policy.Read.All`) which are fundamentally different from the existing Outlook Calendar app's `Calendars.ReadWrite`. Researcher evaluates: separate Azure AD app registration (clean separation, mirrors SLACK_ORG_GRID pattern) vs shared app with scope upgrade (fewer app registrations but mixed concerns). Separate `IntegrationConnection` row with appropriate `subKind` either way.
- **D-08:** Okta connection model — Claude's discretion. Okta admin operations can use either API tokens or OAuth 2.0. Researcher determines what `@okta/okta-sdk-nodejs@8.0.0` supports and what aligns with existing API-key adapter patterns (KSeF, Clockify). Stored encrypted in `IntegrationConnection.credentials` with pre-flight validation via health check.
- **D-09:** GitHub connection model — GitHub Apps (org-level installation) or OAuth Apps. GitHub Apps are the modern recommended approach, provide org-level access, and can be installed per-org. Researcher confirms exact scopes/permissions needed for `orgs.removeMember` + SAML credential-authorization + repo listing.

### Provider-specific preview data (user decision: rich)

- **D-10:** Each provider gets detailed `customMetrics` in the `ImpactPreview` discriminated union (Phase 77 D-01 pattern — add new union members without modifying existing GWS/Slack ones):
  - **Entra ID `EntraImpactCustomMetrics`:** Conditional Access policies (policy names + types that could override revoke), assigned licenses (license SKU names), group memberships count, hybrid-AD status (`onPremisesSyncEnabled`), registered devices count, app role assignments count.
  - **Okta `OktaImpactCustomMetrics`:** assigned application count (app assignments), enrolled MFA factors (factor types), group membership count, admin roles (if any), linked IdP count (social/SAML linked accounts).
  - **GitHub `GitHubImpactCustomMetrics`:** repository count (repos accessible within org), team membership count, outside-collaborator repo count (repos where user would retain access after org removal), pending org invitations, PAT count (if SAML SSO — number of authorized credentials), is org owner boolean.
- **D-11:** Preview API calls follow Phase 77 D-04 pattern — live calls behind Upstash Redis 5min cache (Phase 77 D-02). Cache key format: `co:idp:preview:{provider}:{externalUserId}`. Preview-fetch failure handling per Phase 77 D-03 (error banner + allow proceed without preview).

### Per-flag gating

- **D-12:** Three independent PENDING entries in `signoff-registry.json` (Phase 70 D-09): `idp-deprovisioning-entra`, `idp-deprovisioning-okta`, `idp-deprovisioning-github`. Mirrors Phase 77 D-15 pattern exactly. Admin Settings > Compliance > IdP Deprovisioning per-provider table gains 3 new rows. Each provider can be independently enabled/disabled — enterprise rollout by provider.

### Error classification

- **D-13:** Error classifier (Phase 77 D-07 pattern) extended for 3 new providers:
  - **Entra:** 401 → `PERMANENT_AUTH_EXPIRED` (routes to reconnect flow); 403 `Authorization_RequestDenied` → `PERMANENT_FORBIDDEN` (insufficient Graph permissions); 404 → `PERMANENT_NOT_FOUND` (maps to LIKELY_GONE); 429 → `TRANSIENT_RATE_LIMIT`.
  - **Okta:** 401 → `PERMANENT_AUTH_EXPIRED`; 403 → `PERMANENT_FORBIDDEN`; 404 → `PERMANENT_NOT_FOUND`; 429 → `TRANSIENT_RATE_LIMIT`.
  - **GitHub:** 401 → `PERMANENT_AUTH_EXPIRED`; 403 → `PERMANENT_FORBIDDEN`; 404 → `PERMANENT_NOT_FOUND`; 403 with `require_two_factor_authentication` → provider-specific error class.
  Exact per-error-code classification deferred to Researcher pinning each provider's error response shapes.

### LIKELY_GONE per provider

- **D-14:** `verifyDeprovisioned` implementation per Phase 77 D-06 pattern:
  - **Entra:** `users.get(externalUserId)` → `accountEnabled === false` is LIKELY_GONE; 404 → also LIKELY_GONE.
  - **Okta:** `userApi.getUser(externalUserId)` → `status === 'DEPROVISIONED'` is LIKELY_GONE; 404 → also LIKELY_GONE.
  - **GitHub:** `orgs.checkMembershipForUser` → 404 (not a member) is LIKELY_GONE; `orgs.getMembershipForUser` returning `state !== 'active'` → also LIKELY_GONE.

### Claude's Discretion

- Conditional Access detection approach — depends on Microsoft Graph `conditionalAccess/policies` API shape and what fields are actionable for the admin (D-01).
- Hybrid-AD hard-block UX — status panel link only vs auto-created manual task in offboarding workflow (D-02).
- Post-revoke verification timing — single poll vs backoff, depends on Graph propagation guarantees (D-03).
- GitHub PAT revocation mechanics — depends on SAML credential-authorization API availability and non-SAML alternatives (D-04).
- Outside-collaborator flagging task model — saga step vs offboarding workflow task (D-05).
- Entra app registration model — separate vs shared with Outlook Calendar (D-07).
- Okta auth model — API token vs OAuth 2.0, depends on SDK support (D-08).
- GitHub connection model — GitHub App vs OAuth App (D-09).
- Exact Microsoft Graph scopes needed for CA policy read + user disable + session revoke + signInActivity read — Researcher pins.
- Exact Okta SDK 8.x namespaced method signatures for `userApi.deactivateUser`, `revokeUserSessions` — Researcher pins via Context7.
- Exact GitHub Octokit method signatures for `orgs.removeMember`, SAML credential endpoints — Researcher pins via Context7.
- Exact retry budgets per error class per provider — may differ from Phase 77 GWS/Slack budgets.
- UI copy for Entra hybrid-AD hard-block panel, CA policy warning, GitHub outside-collab manual-task.
- Pino log structure for new audit events — match existing `packages/api/src/services/*.ts` log conventions.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 76 + 77 infrastructure (Phase 78 builds directly on these)
- `.planning/milestones/v6.0-phases/76-f2-idp-capability-mixin-saga-schema-cooldown-gate-gws-scope-/76-CONTEXT.md` — D-13 `Deprovisionable` interface (Phase 78 implements), D-01..D-04 saga + fan-out + recomputeRunStatus, D-07 error classifier pattern, D-16 MSW test template.
- `.planning/milestones/v6.0-phases/77-f2-idp-gws-slack-adapters-the-wedge/77-CONTEXT.md` — D-01 `ImpactPreview` discriminated union (Phase 78 adds 3 new members), D-02 Upstash cache pattern, D-03 preview-fetch failure handling, D-05 step-method distribution, D-06 `LIKELY_GONE` pattern, D-07 error classifier, D-09..D-13 MANUAL_ESCALATION override, D-14 SLACK_ORG_GRID connection pattern, D-15 per-flag gating, D-16 Enterprise-Grid detection layering.

### Existing adapters (Phase 78 references and mirrors)
- `packages/integrations/src/adapters/google-workspace-adapter.ts` — GWS adapter (Phase 77 extended with `implements Deprovisionable`). Phase 78 adapters follow same class structure.
- `packages/integrations/src/adapters/slack-adapter.ts` — Slack adapter (Phase 77 extended). Phase 78 adapters follow same class structure.
- `packages/integrations/src/adapters/outlook-calendar-adapter.ts` — existing Microsoft Graph adapter using MS Identity Platform `/common` tenant. Entra adapter may share or diverge from this OAuth base.
- `packages/integrations/src/adapters/base-adapter.ts` — `BaseAdapter` abstract class. Phase 78 adapters extend this + `implements Deprovisionable`.
- `packages/integrations/src/adapters/register-all.ts` — adapter registry with ESSENTIAL/HEAVY tier loading. Phase 78 adds 3 new adapters to the HEAVY tier.
- `packages/integrations/src/types/deprovisionable.ts` — Phase 76 D-13 `Deprovisionable` interface (Phase 78 implements verbatim).

### Saga + infrastructure (Phase 78 reuses, does not modify)
- `packages/integrations/src/types/provider.ts` — `IntegrationProviderAdapter` and `OAuthConfig` types.
- `packages/integrations/src/scopes/{provider}-deprovision-scopes.ts` (Phase 76 D-14) — Phase 78 creates 3 new scope files: `entra-deprovision-scopes.ts`, `okta-deprovision-scopes.ts`, `github-deprovision-scopes.ts`.
- `@contractor-ops/idp-saga` workspace package (Phase 76 D-05) — saga orchestrator. Phase 78 calls it; doesn't modify it.
- `packages/db/prisma/schema/{idp-saga,contractor}.prisma` — Phase 76/77 added saga schema + MANUAL_ESCALATION columns. Phase 78 does NOT modify the schema — only adds adapter implementations.
- `packages/integrations/src/idp/error-classifier.ts` (Phase 77 D-07) — Phase 78 extends with per-provider error classification for Entra/Okta/GitHub.

### Cache + audit + permissions
- `packages/api/src/services/cache.ts` — Upstash Redis singleton. Phase 78 D-11 reuses for `co:idp:preview:{provider}:{externalUserId}` keys.
- Existing `audit_log` table — Phase 78 emits provider-specific audit events through `getIdpAuditLogger()`.
- `packages/auth/src/permissions.ts` — Phase 77 D-09 registered `idp:override_step_failure`. Phase 78 reuses this permission (applies to all provider step overrides).

### tRPC routers
- `packages/api/src/routers/idp-deprovisioning.ts` (Phase 76/77 created) — Phase 78 EXTENDS with new provider-specific connection mutations (Entra OAuth, Okta API token, GitHub App installation).

### Settings UI integration points
- `apps/web/src/app/[locale]/(dashboard)/settings/integrations/` — Phase 78 adds 3 new provider connection cards (Entra ID Deprovisioning, Okta Deprovisioning, GitHub Deprovisioning).
- `apps/web/src/app/[locale]/(dashboard)/settings/compliance/` — Phase 77 D-15 per-provider table gains 3 new rows for Phase 78 providers.

### Feature flags
- `packages/feature-flags/src/signoff-registry-flags.ts` + `signoff-registry.json` — Phase 78 D-12 adds THREE PENDING entries.

### Standing constraints
- `.planning/STATE.md` "Standing Project Constraints" — LOCAL-ONLY, legal review DEFERRED. Phase 78's three flag entries land PENDING per Phase 70 D-09.

### ROADMAP entry (success criteria source-of-truth)
- `.planning/ROADMAP.md` "Phase 78: F2 IdP — Entra ID + Okta + GitHub Adapters (the differentiator)" — 4 numbered success criteria. Phase 78 maps:
  - SC #1 → D-01..D-03 (Entra deprovision + CA detection + hybrid-AD hard-block + signInActivity verification)
  - SC #2 → D-08, D-13, D-14 (Okta deprovision + audit hashes + error classification)
  - SC #3 → D-04..D-06, D-09 (GitHub deprovision + PAT revocation + outside-collab flagging)
  - SC #4 → D-02 (hybrid-AD detection hard-warning)

### Requirements
- `.planning/REQUIREMENTS.md` — IDP-05 (Entra ID deprovisioning), IDP-06 (Okta deprovisioning), IDP-07 (GitHub deprovisioning).

### NEEDS RESEARCH (per ROADMAP)
- Entra `revokeSignInSessions` Conditional Access interaction — Researcher pins via Context7 (Microsoft Graph docs).
- Okta 8.x namespaced API surface (`userApi.deactivateUser`, `revokeUserSessions`) — Researcher pins via Context7.
- GitHub SAML credential-authorization endpoint — Researcher pins via Context7 (GitHub REST API docs).
- Entra hybrid-AD detection fields (`onPremisesSyncEnabled`, `dirSyncEnabled`) — Researcher confirms availability.
- GitHub outside-collaborator enumeration API — Researcher confirms pagination + access requirements.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`OutlookCalendarAdapter`** (`packages/integrations/src/adapters/outlook-calendar-adapter.ts`) — existing Microsoft Graph integration using MS Identity Platform OAuth. Entra adapter may share OAuth infrastructure (same IdP: `login.microsoftonline.com`).
- **`BaseAdapter`** abstract class — Phase 78 adapters extend this + `implements Deprovisionable`.
- **`register-all.ts`** — HEAVY tier dynamic import pattern. Phase 78 adds 3 new entries.
- **`fetchWithTimeout`** (`packages/integrations/src/services/fetch-helpers.ts`) — shared HTTP fetch with timeout/retry. Used by Outlook adapter, reusable for Entra raw Graph calls.
- **`encodeMicrosoftClientRequestId`** (Outlook adapter) — Microsoft Graph correlation ID helper. Directly reusable for Entra adapter.
- **`packages/api/src/services/cache.ts`** Upstash Redis singleton — preview cache.
- **`getIdpAuditLogger()` + `IDP_AUDIT_ALLOWED_FIELDS`** — audit trail emission.
- **MSW test infrastructure** (`packages/test-utils/src/msw/`) — Phase 76 D-16 ships template; Phase 78 fills in Entra/Okta/GitHub real-mock tests.

### Established Patterns
- **Discriminated union for provider-specific extensions** (Phase 77 D-01) — Phase 78 adds 3 new union members to `ImpactPreview`.
- **Separate IntegrationConnection per scope tier** (Phase 77 D-14 SLACK_ORG_GRID) — Phase 78 likely follows for Entra.
- **Error classifier per HTTP status + provider error code** (Phase 77 D-07) — Phase 78 extends.
- **`verifyDeprovisioned` short-circuit + LIKELY_GONE** (Phase 77 D-06) — Phase 78 implements per provider.
- **Per-flag PENDING + LOCAL-ONLY bypass** (Phase 70 D-09/10; Phase 77 D-15) — Phase 78 follows for 3 new flags.
- **API-key adapter connection** (KSeF, Clockify) — potential pattern for Okta if API token model is chosen.
- **ESSENTIAL/HEAVY adapter registration tiers** (register-all.ts F-SCALE-14) — Phase 78 adapters go in HEAVY tier.

### Integration Points
- **New adapter files:** `packages/integrations/src/adapters/entra-id-adapter.ts`, `okta-adapter.ts`, `github-adapter.ts` — each `extends BaseAdapter implements Deprovisionable`.
- **`register-all.ts`** — 3 new dynamic imports + `registerAdapter()` calls in HEAVY tier.
- **New scope files:** `packages/integrations/src/scopes/entra-deprovision-scopes.ts`, `okta-deprovision-scopes.ts`, `github-deprovision-scopes.ts`.
- **`packages/integrations/src/idp/error-classifier.ts`** — extend error classification for 3 new providers.
- **`packages/api/src/routers/idp-deprovisioning.ts`** — new connection lifecycle mutations per provider.
- **Settings UI** — 3 new provider connection cards + 3 new per-provider toggle rows in compliance table.
- **`signoff-registry.json`** — 3 new PENDING entries.
- **MSW test files** — `entra-deprovision.test.ts`, `okta-deprovision.test.ts`, `github-deprovision.test.ts`.

</code_context>

<specifics>
## Specific Ideas

- Entra ID is the only provider with TWO novel pre-flight gates (CA detection + hybrid-AD hard-block). This makes it the most complex adapter of the three despite Microsoft Graph being well-documented.
- GitHub's authorization model is fundamentally different — org-member removal is the primary action but doesn't cover outside-collaborator access, making the manual-task flagging essential for completeness.
- The `encodeMicrosoftClientRequestId` helper from the existing Outlook Calendar adapter is directly reusable for Entra — both use Microsoft Graph.
- Okta is the most straightforward of the three — `@okta/okta-sdk-nodejs@8.0.0` has a well-defined admin API surface.
- The rich preview data decision means Researcher should enumerate ALL available admin-read APIs per provider to maximize `describeImpact` insight.
- Phase 78 does NOT modify the saga schema (Phase 76/77 established it) — it only adds adapter implementations. This keeps the scope focused on provider-specific logic.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 78-f2-idp-entra-id-okta-github-adapters-the-differentiator*
*Context gathered: 2026-05-15*
