# Phase 78: F2 IdP — Entra ID + Okta + GitHub Adapters (the differentiator) - Research

**Researched:** 2026-05-31
**Domain:** Identity-provider deprovisioning adapters (Microsoft Graph / Okta SDK 8.x / GitHub REST) atop Phase 76 `Deprovisionable` + Phase 77 `ImpactPreview` contract
**Confidence:** HIGH (all three providers' critical endpoints verified against official docs)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Entra Conditional Access policy detection (pre-flight). Surface CA policies that could override the session revoke BEFORE execution (Pitfall 14). Warning-banner-proceed vs risk-scored-gate is Claude's discretion — resolved below.
- **D-02:** Entra hybrid-AD detection via `onPremisesSyncEnabled` / `dirSyncEnabled`. When detected, REFUSE deprovisioning with "On-prem AD authoritative — revoke at source" + status panel link. Hard-block.
- **D-03:** Entra post-revoke `signInActivity` verification. Single-poll-after-delay vs retry-poll-with-backoff is Claude's discretion — resolved below.
- **D-04:** GitHub PAT revocation via SAML credential-authorization API for SSO orgs; surface warning for non-SAML orgs.
- **D-05:** GitHub outside-collaborator repo flagging after org-member removal — manual review item with direct links. Saga step vs offboarding task TBD by Phase 74/77 integration.
- **D-06:** GitHub org-member removal is the primary deprovision action (`octokit.rest.orgs.removeMember`).
- **D-07:** Entra app registration — separate Azure AD app vs shared with Outlook Calendar. Follows Phase 77 SLACK_ORG_GRID precedent. Resolved below.
- **D-08:** Okta connection model — API token vs OAuth 2.0. Resolved below.
- **D-09:** GitHub connection model — GitHub App vs OAuth App. Resolved below.
- **D-10:** Each provider gets detailed `customMetrics` in the `ImpactPreview` discriminated union (Phase 77 D-01 pattern — add union members without modifying GWS/Slack ones). EntraImpactCustomMetrics / OktaImpactCustomMetrics / GitHubImpactCustomMetrics shapes specified in CONTEXT.md D-10.
- **D-11:** Preview API calls follow Phase 77 D-04 (live behind Upstash 5min cache). Cache key `co:idp:preview:{provider}:{externalUserId}`. Preview-fetch failure per Phase 77 D-03.
- **D-12:** Three independent PENDING entries in `signoff-registry-flags.json`: `idp-deprovisioning-entra`, `idp-deprovisioning-okta`, `idp-deprovisioning-github`. Admin Settings > Compliance per-provider table gains 3 rows.
- **D-13:** Error classifier (Phase 77 D-07) extended for 3 new providers (Entra/Okta/GitHub HTTP-status → ErrorClass mapping in CONTEXT.md D-13).
- **D-14:** `verifyDeprovisioned` per provider (Phase 77 D-06 LIKELY_GONE pattern; per-provider semantics in CONTEXT.md D-14).

### Claude's Discretion
- CA detection approach (D-01); hybrid-AD hard-block UX (D-02); post-revoke verification timing (D-03); GitHub PAT revocation mechanics (D-04); outside-collaborator task model (D-05); Entra app registration model (D-07); Okta auth model (D-08); GitHub connection model (D-09); exact Graph scopes; exact Okta SDK 8.x signatures; exact Octokit signatures; per-error-class retry budgets; UI copy; Pino log structure for new audit events.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. Out of scope per `<domain>`: saga infrastructure (Phase 76), `Deprovisionable` interface definition (Phase 76), discriminated-union pattern establishment (Phase 77), MANUAL_ESCALATION override flow (Phase 77), IdP dashboard polish (Phase 73).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IDP-05 | Entra ID deprovisioning | Microsoft Graph v1.0 `PATCH /users/{id}` (`accountEnabled:false`) + `POST /users/{id}/revokeSignInSessions` + CA pre-flight (`GET /identity/conditionalAccess/policies`) + hybrid-AD (`$select=onPremisesSyncEnabled`) + `signInActivity` verify — all verified below |
| IDP-06 | Okta deprovisioning | `@okta/okta-sdk-nodejs@8.0.0` namespaced `userApi.deactivateUser` + `userApi.revokeUserSessions` + `userApi.getUser` status enum — verified below |
| IDP-07 | GitHub deprovisioning | Octokit `orgs.removeMember` (`DELETE /orgs/{org}/members/{username}`) + SAML credential-authorization revoke + outside-collaborator enumeration — verified below |
</phase_requirements>

## Summary

Phase 78 implements three concrete `Deprovisionable` adapters atop the Phase 76 interface contract (`suspendAccount`, `revokeAllSessions`, `verifyDeprovisioned`) and the Phase 77 `ImpactPreview` discriminated union (`describeImpact`). The phase is pure adapter + scope-const + error-classifier-extension + connection-mutation + Settings-UI work. It does NOT modify the saga, schema, or interface — it extends the type union additively (Phase 77 D-01 seam) and registers three new adapters in the HEAVY tier.

All three providers expose the exact endpoints the locked decisions assume, verified against official documentation: Microsoft Graph `revokeSignInSessions` / conditional-access-policy list / `signInActivity` / `onPremisesSyncEnabled` are all GA in **v1.0** (no beta dependency); Okta SDK 8.x has the namespaced `userApi.deactivateUser` / `revokeUserSessions` surface; GitHub has both org-member removal, the SAML credential-authorization API (Enterprise Cloud + SAML SSO only), and outside-collaborator enumeration.

**Primary recommendation:** Follow the existing `OutlookCalendarAdapter` raw-`fetch` + `fetchWithTimeout` + `withResilience` pattern for the **Entra** adapter (same IdP host, helper `encodeMicrosoftClientRequestId` is directly reusable, no new SDK dependency). Use the official `@okta/okta-sdk-nodejs@8.0.0` SDK for **Okta** (CONTEXT.md locks this version; namespaced API is stable) and `@octokit/rest@22.x` for **GitHub** (well-aged, REST-typed). Implement CA detection as a non-blocking warning surfaced in `describeImpact.customMetrics` (D-01), hybrid-AD as a hard pre-flight block that fails the run before any mutation (D-02), and post-revoke verification as a single delayed poll because Graph documents only "a few minutes" propagation with no strong-consistency read (D-03).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Provider API calls (disable/revoke/deactivate/remove) | API / Backend (`packages/integrations` adapters) | — | Credentials + Graph/Okta/Octokit calls never touch the client; adapters run inside the saga worker / API |
| CA-policy pre-flight + hybrid-AD detection | API / Backend (Entra adapter `describeImpact` / pre-flight) | — | Reads org-level Graph data with admin-consent scopes; must run server-side |
| Error classification | API / Backend (`error-classifier.ts`) | — | Maps provider HTTP responses to closed enum for retry budgeting |
| Preview cache | Database / Storage (Upstash Redis via `cache.ts`) | API / Backend | 5min cache key, server-managed |
| Connection lifecycle mutations | API / Backend (tRPC `integrations` router subfolder) | — | OAuth start / token store / health check — tenant-scoped, server-authoritative |
| Settings provider cards + per-provider toggle | Frontend (web-vite Page→Container→Hook→Component) | API / Backend (tRPC) | UI surfaces; data fetch isolated to hooks per ARCHITECTURE.md |
| Per-provider feature flags | Code registry (`signoff-registry-flags.json`) | — | PENDING entries gate production; LOCAL-ONLY bypass via `FLAG_SIGNOFF_BYPASS=local` |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| (none — raw `fetch`) | Node 22 builtin | Microsoft Graph calls for Entra adapter | Repo convention: `OutlookCalendarAdapter` calls Graph via `fetchWithTimeout` + `withResilience`, NOT `@microsoft/microsoft-graph-client`. Entra adapter MUST follow this — no new SDK. `[VERIFIED: codebase grep]` |
| `@okta/okta-sdk-nodejs` | `8.0.0` (CONTEXT-locked; 8.1.0 current on registry) | Okta admin API | CONTEXT.md D-08 locks 8.0.0. Namespaced client (`client.userApi.*`). `[VERIFIED: npm registry — 8.0.0 exists]` `[CITED: github.com/okta/okta-sdk-nodejs]` |
| `@octokit/rest` | `22.x` (current 22.0.1, published 2025-10-31, well-aged) | GitHub org/SAML/collaborator REST | Official GitHub SDK, fully typed REST methods. `[VERIFIED: npm registry]` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | (already a dep) | Validate connection-mutation inputs + parse provider responses at boundary | tRPC procedure inputs; never `as` external payloads |
| `p-limit` | (already a dep) | Cap concurrency on outside-collaborator pagination / per-PAT revocation loops | Mirrors Phase 77 GWS `tokens.delete` cap-5 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| raw `fetch` for Entra | `@microsoft/microsoft-graph-client` (3.0.7) | Diverges from existing Outlook adapter, adds a dep + auth-provider wiring, loses the shared `withResilience` timeout/retry budgeting. **Rejected** — repo already calls Graph via raw fetch successfully. |
| `@octokit/rest` for GitHub | raw `fetch` | Loses typed methods + auto pagination (`octokit.paginate`). For SAML credential-authorization + outside-collaborator paging, typed Octokit is materially safer. **Use Octokit.** |
| `@okta/okta-sdk-nodejs` SDK | raw `fetch` to Okta REST | CONTEXT.md explicitly names the SDK + version; SDK handles auth modes + pagination. **Use SDK.** |

**Installation:**
```bash
pnpm --filter @contractor-ops/integrations add @okta/okta-sdk-nodejs@8.0.0 @octokit/rest@22.0.1
```

**Version verification:** `npm view @okta/okta-sdk-nodejs@8.0.0 version` → `8.0.0` (exists). `npm view @octokit/rest version` → `22.0.1` (modified 2025-10-31; satisfies 7-day release age). Entra needs no new dependency.

## Package Legitimacy Audit

| Package | Registry | Age | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-------------|-----------|-------------|
| `@okta/okta-sdk-nodejs` | npm | Mature (Okta-published, years) | github.com/okta/okta-sdk-nodejs | not run (env-restricted) → `[ASSUMED]` legitimate; official Okta scope `@okta/*` | Approved — official vendor scope, CONTEXT-locked version |
| `@octokit/rest` | npm | Mature (GitHub-published; v22 Oct 2025) | github.com/octokit/rest.js | not run → `[ASSUMED]` legitimate; official GitHub `@octokit/*` scope | Approved — official vendor scope, well-aged |

**Packages removed due to slopcheck [SLOP] verdict:** none.
**Packages flagged [SUS]:** none. Both are first-party vendor-scoped packages (`@okta/*`, `@octokit/*`) with long histories and matching source repos; typosquat risk is low. Planner SHOULD still add a `pnpm audit` + `pnpm security:scan` step after install per CLAUDE.md. slopcheck could not run in the planning environment — packages tagged `[ASSUMED]` per protocol; install is gated by the post-add audit step rather than a separate checkpoint (vendor-scoped, CONTEXT-named).

## Architecture Patterns

### System Architecture Diagram
```
Offboarding ACCESS_REVOKE task
        │
        ▼
@contractor-ops/idp-saga  (Phase 76 — NOT modified)
   startDeprovisioningRun → per-(provider,stepKind) QStash fan-out
        │
        ├─ describeImpact(externalUserId) ──► Upstash cache (co:idp:preview:{provider}:{id}, 5min)
        │        │ miss
        │        ▼
        │   ENTRA: GET /users/{id}?$select=... + GET /identity/conditionalAccess/policies
        │   OKTA:  client.userApi.getUser + factors + apps + groups
        │   GITHUB: orgs.get membership + repos + outside_collaborators + credential-authorizations
        │
        ├─ [Entra pre-flight] onPremisesSyncEnabled? ──► HARD BLOCK (refuse, status panel link)
        │
        ├─ suspendAccount(externalUserId)
        │   ENTRA: PATCH /users/{id} {accountEnabled:false}
        │   OKTA:  POST /api/v1/users/{id}/lifecycle/deactivate (SDK deactivateUser)
        │   GITHUB: DELETE /orgs/{org}/members/{username} (removeMember)
        │
        ├─ revokeAllSessions(externalUserId)
        │   ENTRA: POST /users/{id}/revokeSignInSessions  (+ post-poll signInActivity)
        │   OKTA:  DELETE /api/v1/users/{id}/sessions (SDK revokeUserSessions)
        │   GITHUB: DELETE /orgs/{org}/credential-authorizations/{cred_id} per PAT (SAML SSO only)
        │           + flag outside-collaborator repos (MANUAL)
        │
        ▼
   error-classifier.ts (HTTP status + provider error code → ErrorClass)
        │
        ▼
   verifyDeprovisioned → LIKELY_GONE short-circuit
```

### Recommended Project Structure
```
packages/integrations/src/
├── adapters/
│   ├── entra-id-adapter.ts      # extends BaseAdapter implements Deprovisionable (raw Graph fetch)
│   ├── okta-adapter.ts          # extends BaseAdapter implements Deprovisionable (@okta SDK 8.x)
│   ├── github-adapter.ts        # extends BaseAdapter implements Deprovisionable (@octokit/rest)
│   └── register-all.ts          # +3 HEAVY-tier dynamic imports + registerDeprovisionableAdapter
├── scopes/
│   ├── entra-deprovision-scopes.ts    # ENTRA_DEPROVISION_SCOPES/_CAPABILITIES as const
│   ├── okta-deprovision-scopes.ts
│   └── github-deprovision-scopes.ts
├── idp/
│   └── error-classifier.ts      # extend classifyError() for entra|okta|github
└── types/
    └── impact-preview.ts (Phase 77) # +3 union members (Entra/Okta/GitHub custom metrics)
```

### Pattern 1: Raw Graph call via shared resilience (Entra)
**What:** Reuse `fetchWithTimeout` + `withResilience` + `encodeMicrosoftClientRequestId`.
**When:** Every Entra Graph call.
**Example:**
```typescript
// Source: packages/integrations/src/adapters/outlook-calendar-adapter.ts (existing pattern)
const resp = await withResilience(
  () => fetchWithTimeout(
    `https://graph.microsoft.com/v1.0/users/${externalUserId}/revokeSignInSessions`,
    { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'client-request-id': clientRequestId } },
    { timeoutMs: 30_000, retries: 0 },
  ),
  { provider: 'entra-id', retryAttempts: 0 }, // POST action — non-idempotent transport
);
```
Note: `revokeSignInSessions` is functionally idempotent (resets `signInSessionsValidFromDateTime` to now), so a deterministic `client-request-id` + a small retry budget is safe; PATCH `accountEnabled:false` is idempotent.

### Pattern 2: Discriminated-union extension (no modification of existing members)
**What:** Add `{ provider: 'ENTRA_ID' | 'OKTA' | 'GITHUB', commonMetrics, customMetrics, fetchedAt, cacheKey }` members to `ImpactPreview` (Phase 77 D-01). Saga UI `switch(preview.provider)` stays exhaustive.
**When:** `describeImpact` return types.

### Pattern 3: Scope/capability typed-const per provider (Phase 76 D-14)
```typescript
// Mirrors packages/integrations/src/scopes/google-workspace-deprovision-scopes.ts (Phase 76-03)
export const ENTRA_DEPROVISION_SCOPES = [
  'https://graph.microsoft.com/User.ReadWrite.All',
  'https://graph.microsoft.com/Directory.Read.All',
  'https://graph.microsoft.com/Policy.Read.All',
  'https://graph.microsoft.com/AuditLog.Read.All',
] as const;
export const ENTRA_DEPROVISION_CAPABILITIES = ['user.deprovision', 'directory.user.write'] as const;
```

### Anti-Patterns to Avoid
- **Adding `@microsoft/microsoft-graph-client`** — diverges from the working Outlook raw-fetch pattern. Don't.
- **Modifying existing `ImpactPreview` GWS/Slack members** — Phase 77 D-01 seam is additive only.
- **Treating CA detection as a hard block** — D-01 is a WARNING (CA policies *may* override; admin should be informed, not stopped). Only hybrid-AD (D-02) is a hard block.
- **Assuming GitHub PAT revocation works on non-SAML orgs** — `credential-authorizations` is SAML-SSO + Enterprise-Cloud only. Surface a warning, do not throw.
- **Polling `signInActivity` in a tight loop** — Graph documents only "a few minutes" propagation; backfill is best-effort. Single delayed poll, treat absence as non-fatal.

## Don't Hand-Roll
| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Graph timeout/retry | custom fetch wrapper | `fetchWithTimeout` + `withResilience` | Already tuned, shared budgets |
| Graph correlation id | random per call | `encodeMicrosoftClientRequestId` (Outlook adapter) | Deterministic dedup, telemetry correlation |
| Okta pagination/auth | manual cursor + bearer | `@okta/okta-sdk-nodejs` client | SDK handles cursors + auth modes |
| GitHub pagination | manual `?page=` loops | `octokit.paginate(...)` | Auto-follows `Link` headers |
| Preview cache | new Redis client | `packages/api/src/services/cache.ts` singleton | Phase 77 D-02 key convention |
| Audit emission | new audit table | `getIdpAuditLogger()` (`packages/logger/src/idp-audit-logger.ts` — EXISTS) | `IDP_AUDIT_ALLOWED_FIELDS` allow-list |
| Error classification | inline status checks | `idp/error-classifier.ts` (Phase 77 D-07) extended | Per-class retry budgeting |

**Key insight:** Phase 78 is almost entirely composition of existing primitives. The only genuinely new logic is the Entra CA-policy + hybrid-AD pre-flight and the GitHub SAML/outside-collaborator enumeration — everything else is provider-specific mapping onto Phase 76/77 seams.

## Common Pitfalls

### Pitfall 14 (CONTEXT-named): Conditional Access silent override
**What goes wrong:** `revokeSignInSessions` resets `signInSessionsValidFromDateTime`, but a CA "sign-in frequency" session control or a token-lifetime policy can re-issue tokens or extend a session such that the revoke appears ineffective.
**Why:** CA policies are evaluated independently of session-token validity windows.
**How to avoid:** Enumerate `GET /identity/conditionalAccess/policies`, filter to `state === 'enabled'` policies whose `conditions.users.includeUsers` contains the target id or `"All"` (and not excluded), and surface their `displayName` + `sessionControls`/`grantControls` in `describeImpact.customMetrics.conditionalAccessPolicies`. Non-blocking warning banner.
**Warning signs:** Post-revoke `signInActivity.lastSignInDateTime` newer than revoke time.

### Pitfall: Hybrid-AD authoritative source
**What goes wrong:** Disabling a hybrid-synced Entra account is overwritten on the next Entra Connect sync from on-prem AD — the cloud disable silently reverts.
**How to avoid:** `GET /users/{id}?$select=onPremisesSyncEnabled,onPremisesDistinguishedName`. If `onPremisesSyncEnabled === true`, HARD BLOCK before any mutation; show "On-prem AD authoritative — revoke at source" + status panel link (D-02). `dirSyncEnabled` is the org-level twin; the per-user `onPremisesSyncEnabled` is authoritative.

### Pitfall 7 (CONTEXT-named): GitHub outside-collaborator back-door
**What goes wrong:** `orgs.removeMember` removes org + team access but a user who is ALSO an outside collaborator on specific repos retains those repos.
**How to avoid:** After removal, `GET /orgs/{org}/outside_collaborators` (paginated). The target won't appear immediately if they were only a member; the real risk is repos where they were directly invited as a collaborator. Enumerate via `octokit.paginate` and flag each repo with a direct link as a MANUAL item (D-05). Removal of an outside collaborator is `DELETE /orgs/{org}/outside_collaborators/{username}` (422 if still a member — call AFTER member removal).

### Pitfall: GitHub PAT revocation only on SAML SSO orgs
**What goes wrong:** Assuming every org can revoke per-PAT credentials.
**How to avoid:** `GET /orgs/{org}/credential-authorizations` requires SAML SSO + Enterprise Cloud (`read:org` to list, `admin:org` to delete). On non-SAML orgs the endpoint is unavailable → surface "Per-PAT revocation unavailable (org not on SAML SSO)" warning, do not fail the run.

### Pitfall: Okta deactivate is async + has a sendEmail side-effect
**What goes wrong:** `deactivateUser` can trigger a deactivation email and transitions through states; calling on an already-DEPROVISIONED user 400s.
**How to avoid:** `verifyDeprovisioned` first (LIKELY_GONE short-circuit). Pass `sendEmail: false` where the SDK supports it. Treat `status === 'DEPROVISIONED'` and 404 as LIKELY_GONE.

## Code Examples

### Entra: disable account (idempotent PATCH)
```typescript
// Source: learn.microsoft.com/en-us/graph/api/user-update (v1.0)
await fetchWithTimeout(`https://graph.microsoft.com/v1.0/users/${id}`, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ accountEnabled: false }),
}, { timeoutMs: 15_000, retries: 2 }); // 204 No Content on success
```

### Entra: signInActivity verify (v1.0, AuditLog.Read.All)
```typescript
// Source: learn.microsoft.com/en-us/graph/api/resources/signinactivity (v1.0 GA)
// GET /users/{id}?$select=accountEnabled,signInActivity
// accountEnabled === false → LIKELY_GONE; 404 → LIKELY_GONE
```

### Okta: deactivate + revoke sessions (SDK 8.x namespaced)
```typescript
// Source: github.com/okta/okta-sdk-nodejs (v8 namespaced API)
await client.userApi.deactivateUser({ userId });        // → status DEPROVISIONED
await client.userApi.revokeUserSessions({ userId });    // clears active sessions
const u = await client.userApi.getUser({ userId });     // u.status === 'DEPROVISIONED' → LIKELY_GONE
```

### GitHub: remove member + revoke PATs + flag outside repos
```typescript
// Source: docs.github.com/en/rest/orgs/members + .../outside-collaborators + credential-authorizations
await octokit.rest.orgs.removeMember({ org, username });                       // DELETE /orgs/{org}/members/{username}
const auths = await octokit.paginate('GET /orgs/{org}/credential-authorizations', { org }); // SAML SSO only
for (const a of auths.filter(a => a.login === username))
  await octokit.request('DELETE /orgs/{org}/credential-authorizations/{credential_id}', { org, credential_id: a.credential_id });
// verify: orgs.checkMembershipForUser → 404 (not a member) === LIKELY_GONE
```

## Resolved Discretion Decisions

- **D-01 (CA approach):** Warning-banner-proceed. CA policies are surfaced in `describeImpact.customMetrics.conditionalAccessPolicies` (array of `{ displayName, state, hasSessionControls, appliesToUser }`); saga UI renders a non-blocking warning. NOT a gate (a CA policy is informational risk, not a hard failure). `[CITED: learn.microsoft.com conditionalaccessroot-list-policies — v1.0, Policy.Read.All]`
- **D-03 (verify timing):** Single delayed poll. Graph docs state revoke takes "a few minutes" with no consistency guarantee, and `signInActivity` is best-effort/not-backfilled. `verifyDeprovisioned` reads `accountEnabled` (strongly consistent) as primary truth; `signInActivity` is supplementary forensic data, never the gate. `[CITED: learn.microsoft.com user-revokesigninsessions + resources/signinactivity]`
- **D-07 (Entra app):** Separate Azure AD app registration with admin-consent application permissions (`User.ReadWrite.All`, `Directory.Read.All`, `Policy.Read.All`, `AuditLog.Read.All`). Mirrors Phase 77 SLACK_ORG_GRID precedent — clean separation from the Outlook Calendar delegated `Calendars.ReadWrite` app. Separate `IntegrationConnection` row with a deprovision `subKind`. Client-credentials (app-only) token flow, not delegated.
- **D-08 (Okta auth):** API token model (`Client({ orgUrl, token })`) stored encrypted in `IntegrationConnection.credentials`, aligning with existing API-key adapters (KSeF, Clockify). OAuth-2.0-private-key is supported by the SDK but adds JWK management for no benefit at local-only scope. Health-check via `userApi.getUser` on a known id (or `me`). `[CITED: github.com/okta/okta-sdk-nodejs]`
- **D-09 (GitHub connection):** GitHub App (org-level installation) with org `Members: write` + `Administration: read` permissions for member removal + outside-collaborator listing; SAML credential-authorization needs a classic token with `admin:org` OR equivalent App permission. Where the App cannot reach credential-authorizations, fall back to surfacing the warning (non-SAML path). Installation token retrieved per-org. `[CITED: docs.github.com REST orgs + credential-authorizations — admin:org]`

## State of the Art
| Old Approach | Current Approach | When | Impact |
|--------------|------------------|------|--------|
| `signInActivity` beta-only | GA in v1.0 + `lastSuccessfulSignInDateTime` added | Dec 2023 | Can `$select` it on v1.0 `/users` |
| Okta SDK flat `client.deactivateUser()` | v8 namespaced `client.userApi.deactivateUser({userId})` | v7→v8 | Method paths changed — use namespaced form |

## Assumptions Log
| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@okta/okta-sdk-nodejs` v8 `revokeUserSessions` clears sessions equivalently to `DELETE /users/{id}/sessions` | Code Examples | Low — both documented; if SDK lacks it, fall back to raw `DELETE /api/v1/users/{id}/sessions` |
| A2 | Outlook adapter raw-fetch + client-credentials app-token flow extends cleanly to app-only Graph calls (no delegated `/me`) | Pattern 1 / D-07 | Low — `/users/{id}` action endpoints support app permissions per docs; only `/me` requires delegated |
| A3 | A GitHub App can list `credential-authorizations`; otherwise a classic `admin:org` token is needed | D-09 | Medium — if App can't, connection model must store a classic PAT for the SAML path. Planner must make the credential model pluggable. |
| A4 | slopcheck legitimacy of `@okta/*` / `@octokit/*` (env could not run slopcheck) | Package Audit | Low — official vendor scopes; mitigated by post-add `pnpm audit` + `pnpm security:scan` |

## Open Questions
1. **GitHub App vs classic-PAT for SAML credential-authorization** — App permissions for `credential-authorizations` are not clearly documented; the classic-token `admin:org` path is. Recommendation: connection model stores whichever the org configures; the SAML revocation step is best-effort + warns if the stored credential lacks reach.
2. **Where does the per-provider Settings>Compliance toggle table live in web-vite?** — Phase 77 D-15 creates it; Phase 78 adds 3 rows. Current tree has no `settings/compliance` page yet (only `components/contractors/compliance/`). Planner anchors the table to a new web-vite settings sub-route/tab created by 77, and Phase 78 extends it; if 77's surface isn't present at execute time, the executor creates the row source in the compliance settings tab following the per-provider table shape.

## Environment Availability
| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Microsoft Graph v1.0 | Entra adapter | ✓ (public API) | v1.0 GA | — |
| Okta org + API token | Okta adapter | runtime/tenant-provided | SDK 8.0.0 | — |
| GitHub org (Enterprise Cloud for SAML) | GitHub adapter | runtime/tenant-provided | Octokit 22.x | non-SAML → warn, skip PAT revoke |
| `@okta/okta-sdk-nodejs@8.0.0` | Okta adapter | npm (verified exists) | 8.0.0 | — |
| `@octokit/rest@22.x` | GitHub adapter | npm (verified, aged) | 22.0.1 | — |
| MSW infra | tests | ✓ `packages/test-utils/src/msw/` | — | — |

**Missing dependencies with no fallback:** none. Both new packages install cleanly under the 7-day release-age policy.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (`vitest run`) |
| Config file | `packages/integrations/vitest.config.ts` |
| Quick run command | `pnpm --filter @contractor-ops/integrations test <file>` |
| Full suite command | `pnpm --filter @contractor-ops/integrations test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IDP-05 | Entra disable + revokeSignInSessions + CA preflight + hybrid-AD block + verify | unit (MSW) | `pnpm --filter @contractor-ops/integrations test entra-deprovision` | ❌ Wave 0 |
| IDP-06 | Okta deactivate + revokeUserSessions + status verify + error class | unit (MSW) | `pnpm --filter @contractor-ops/integrations test okta-deprovision` | ❌ Wave 0 |
| IDP-07 | GitHub removeMember + SAML PAT revoke + outside-collab flag + verify | unit (MSW) | `pnpm --filter @contractor-ops/integrations test github-deprovision` | ❌ Wave 0 |
| IDP-05/06/07 | error-classifier per-provider status mapping | unit | `pnpm --filter @contractor-ops/integrations test error-classifier` | ❌ Wave 0 (extend Phase 77 file) |
| IDP-05/06/07 | ImpactPreview union has 3 new members (compile + lint) | type | `pnpm --filter @contractor-ops/integrations typecheck` | n/a |

### Sampling Rate
- **Per task commit:** `pnpm --filter @contractor-ops/integrations test <changed-file>`
- **Per wave merge:** `pnpm --filter @contractor-ops/integrations test`
- **Phase gate:** Full integrations suite green + `pnpm --filter @contractor-ops/integrations typecheck` exit 0 before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/integrations/src/adapters/__tests__/entra-deprovision.test.ts` — MSW Graph handlers (covers IDP-05)
- [ ] `packages/integrations/src/adapters/__tests__/okta-deprovision.test.ts` — MSW Okta handlers (IDP-06)
- [ ] `packages/integrations/src/adapters/__tests__/github-deprovision.test.ts` — MSW GitHub handlers (IDP-07)
- [ ] MSW handler stubs: `packages/test-utils/src/msw/handlers/{entra,okta,github}.ts` (follow `outlook-calendar.ts` / `google-workspace.ts` / `slack.ts`)

## Security Domain

### Applicable ASVS Categories (L1)
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | OAuth client-credentials (Entra), API token (Okta), GitHub App (GitHub) — credentials encrypted at rest in `IntegrationConnection.credentials` |
| V3 Session Management | yes | This phase REVOKES provider sessions — core behavior |
| V4 Access Control | yes | Tenant scope from session (`organizationId`); connection rows org-scoped; `idp:override_step_failure` permission (Phase 77 D-09) reused |
| V5 Input Validation | yes | zod on every tRPC connection mutation; `safeParse` on provider responses, no unsafe `as` |
| V6 Cryptography | yes | Reuse existing credential encryption (`@contractor-ops/secrets` / credential-service); never hand-roll |
| V7 Error/Logging | yes | `getIdpAuditLogger()` allow-listed fields; never log access tokens / PAT values (token_last_eight only) |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tenant id from client input | Spoofing / Elevation | `organizationId` from session only (CLAUDE.md) |
| Access token leaked in error/log | Information Disclosure | Never include tokens in error strings (Outlook adapter precedent); audit allow-list |
| Silent failure when CA/hybrid overrides revoke | Repudiation | CA warning + hybrid hard-block + `signInActivity` forensic poll |
| GitHub outside-collab back-door | Elevation of Privilege | Pitfall 7 — explicit enumeration + manual flag |
| IDOR on connection mutations | Elevation | tRPC + RLS; connection lookups scoped to session org |

## Sources

### Primary (HIGH confidence)
- learn.microsoft.com/en-us/graph/api/user-revokesigninsessions (v1.0) — POST endpoint, `User.RevokeSessions.All`/`User.ReadWrite.All`, returns `{value:true}`, "few minutes" delay
- learn.microsoft.com/en-us/graph/api/conditionalaccessroot-list-policies (v1.0) — `GET /identity/conditionalAccess/policies`, `Policy.Read.All`, full policy shape (displayName/state/conditions/grantControls/sessionControls)
- learn.microsoft.com/en-us/graph/api/resources/signinactivity (v1.0 GA Dec 2023) — `$select=signInActivity`, `AuditLog.Read.All`, fields
- github.com/okta/okta-sdk-nodejs — v8 namespaced client (`userApi.deactivateUser` / `revokeUserSessions` / `getUser`), token + PrivateKey auth modes
- developer.okta.com management API — user status enum (…ACTIVE/SUSPENDED/DEPROVISIONED), `lifecycle/deactivate`, `DELETE /users/{id}/sessions`
- docs.github.com/en/rest/orgs/members — `DELETE /orgs/{org}/members/{username}`, membership `state`
- docs.github.com/en/rest/orgs/outside-collaborators — `GET/DELETE /orgs/{org}/outside_collaborators[/{username}]`, paginated, 422-if-member
- docs.github.com (Enterprise Cloud) credential-authorizations — `GET/DELETE /orgs/{org}/credential-authorizations[/{credential_id}]`, `read:org`/`admin:org`, SAML SSO required, fields (login/credential_id/token_last_eight/scopes)
- Codebase: `outlook-calendar-adapter.ts`, `base-adapter.ts`, `register-all.ts`, `idp-audit-logger.ts`, `signoff-registry-flags.json`, Phase 76-03 PLAN (Deprovisionable interface), Phase 77 CONTEXT (ImpactPreview/error-classifier/LIKELY_GONE)

### Secondary (MEDIUM)
- GitHub App vs classic-token permission boundary for credential-authorizations (App-permission docs ambiguous; classic `admin:org` path is documented)

## Metadata
**Confidence breakdown:**
- Standard stack: HIGH — all endpoints + SDK shapes verified against official docs; package versions verified on registry
- Architecture: HIGH — composes existing repo primitives (Outlook adapter, cache, audit logger, scope-const, error-classifier seams)
- Pitfalls: HIGH — CA/hybrid/outside-collab/SAML all confirmed in official docs

**Research date:** 2026-05-31
**Valid until:** 2026-06-30 (stable enterprise APIs; Okta SDK minor bumps possible)
</content>
