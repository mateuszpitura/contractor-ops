# Phase 78 — Pattern Map

> Analog files + code excerpts for each file Phase 78 creates/modifies. Executor reads the analog before writing the new file. All paths verified against the current tree (branch `audit/post-migration-parity`; `apps/web` is gone → `apps/web-vite`; tRPC routers live in subfolders, not flat files).

## Contract dependency note

Phase 78 implements the **Phase 76 `Deprovisionable` interface** and extends the **Phase 77 `ImpactPreview` union + error-classifier**. Those land in code when Phases 76/77 execute. Phase 78 plans target the contract as specified in:
- Phase 76-03 PLAN — `Deprovisionable` shape: `suspendAccount(externalUserId): Promise<DeprovisionResult>`, `revokeAllSessions(...)`, `verifyDeprovisioned(...): Promise<boolean>`; `registerDeprovisionableAdapter` / `getDeprovisionableAdapter`; scope-const pattern; `IDP_AUDIT_ALLOWED_FIELDS`.
- Phase 77 CONTEXT D-01 — `ImpactPreview` discriminated union (extend additively); D-06 LIKELY_GONE; D-07 `packages/integrations/src/idp/error-classifier.ts` `ErrorClass`.

If, at execute-time, 76/77 are not yet merged, the executor must FIRST confirm the interface file `packages/integrations/src/types/deprovisionable.ts` and `idp/error-classifier.ts` exist; if missing, stop and flag dependency-not-met (Phase 78 cannot land before 76/77).

## File-by-file map

| New / Modified file | Role | Closest analog | What to copy |
|---------------------|------|----------------|--------------|
| `packages/integrations/src/adapters/entra-id-adapter.ts` | NEW — Entra adapter (raw Graph fetch) | `adapters/outlook-calendar-adapter.ts` | Class skeleton (`extends BaseAdapter`), `OAuthConfig`, `fetchWithTimeout`+`withResilience` calls, `encodeMicrosoftClientRequestId`, timeout budgets. ADD `implements Deprovisionable`. |
| `packages/integrations/src/adapters/okta-adapter.ts` | NEW — Okta adapter (@okta SDK 8.x) | `adapters/clockify-adapter.ts` / `ksef-adapter.ts` (API-token connection) + `outlook` for Deprovisionable methods | API-token health pattern; SDK client construction `new okta.Client({orgUrl, token})`. |
| `packages/integrations/src/adapters/github-adapter.ts` | NEW — GitHub adapter (@octokit/rest) | `adapters/slack-adapter.ts` (org-token raw flows) + `outlook` | Adapter skeleton + Deprovisionable methods; `octokit.paginate` for member/collaborator/credential lists. |
| `packages/integrations/src/scopes/{entra,okta,github}-deprovision-scopes.ts` | NEW — typed-const scope/capability | Phase 76 `scopes/google-workspace-deprovision-scopes.ts` (lands with 76) | `export const X_DEPROVISION_SCOPES = [...] as const;` + `_CAPABILITIES`. |
| `packages/integrations/src/idp/error-classifier.ts` | MODIFY — add 3 providers | Phase 77 establishes this file (D-07) | Extend `classifyError(provider, status, body)` switch with `entra-id`/`okta`/`github` cases (CONTEXT D-13 status map). |
| `packages/integrations/src/types/impact-preview.ts` (Phase 77) | MODIFY — +3 union members | Phase 77 D-01 union | Add `{ provider:'ENTRA_ID'|'OKTA'|'GITHUB', commonMetrics, customMetrics:<Provider>ImpactCustomMetrics, fetchedAt, cacheKey }`. Do NOT touch GWS/Slack members. |
| `packages/integrations/src/adapters/register-all.ts` | MODIFY — +3 HEAVY-tier imports | existing HEAVY-tier dynamic-import block | `const { EntraIdAdapter } = await import('./entra-id-adapter.js'); registerAdapter(...); registerDeprovisionableAdapter('ENTRA_ID', new EntraIdAdapter());` |
| `packages/api/src/routers/integrations/*` (subfolder) | MODIFY — connection mutations | existing `routers/integrations/` router files | Per-provider connect/store-token/health mutations; zod inputs; tenant from session. |
| `packages/feature-flags/src/signoff-registry-flags.json` | MODIFY — +3 PENDING entries | existing array-of-tuples shape | `["idp-deprovisioning-entra", {"status":"PENDING","notes":"..."}]` ×3. |
| `apps/web-vite/src/components/integrations/{entra,okta,github}-provider-section-container.tsx` (+ view + hook) | NEW — 3 provider cards | `integrations/google-workspace-provider-section-container.tsx` + `.tsx` view + `hooks/use-google-workspace-provider-section.ts` | Container→view→hook trio verbatim shape. |
| `apps/web-vite/src/components/settings/integrations-tab.tsx` | MODIFY — register 3 sections | existing `PROVIDER_CONFIG` + section composition | Import + render new provider sections. |
| Settings > Compliance IdP-deprovisioning table | MODIFY (77 creates) / NEW (if 77 absent) | settings tab + `components/contractors/compliance/*` field patterns | 3 new per-provider rows; toggle enableable only when flag APPROVED. |
| `packages/test-utils/src/msw/handlers/{entra,okta,github}.ts` | NEW — MSW handlers | `msw/handlers/{outlook-calendar,google-workspace,slack}.ts` | Mock the exact endpoints the adapters call. |
| `packages/integrations/src/adapters/__tests__/{entra,okta,github}-deprovision.test.ts` | NEW — adapter tests | existing adapter `__tests__/*` + Phase 76 D-16 MSW template | RED→GREEN per Deprovisionable method. |

## Key code excerpts

### Entra adapter — Graph call via shared resilience (copy from Outlook adapter)
```typescript
// packages/integrations/src/adapters/outlook-calendar-adapter.ts:304 (existing)
const response = await withResilience(
  () => fetchWithTimeout(url, { method, headers: { Authorization: `Bearer ${accessToken}`, 'client-request-id': clientRequestId }, body },
    { timeoutMs: MUTATION_TIMEOUT_MS, retries: 0 }),
  { provider: 'entra-id', retryAttempts: idempotent ? 2 : 0 },
);
if (!response.ok) { const text = await response.text(); throw new Error(`Entra ... failed: ${text}`); } // NEVER include token
```
- Disable: `PATCH https://graph.microsoft.com/v1.0/users/{id}` body `{accountEnabled:false}` (idempotent → retries 2)
- Revoke sessions: `POST https://graph.microsoft.com/v1.0/users/{id}/revokeSignInSessions` (no body; returns `{value:true}`)
- CA policies: `GET https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies`
- Hybrid-AD + verify: `GET https://graph.microsoft.com/v1.0/users/{id}?$select=accountEnabled,onPremisesSyncEnabled,signInActivity`

### Okta adapter — SDK 8.x namespaced (copy client construction from API-key adapters)
```typescript
import { Client } from '@okta/okta-sdk-nodejs';
const client = new Client({ orgUrl, token }); // token from decrypted IntegrationConnection.credentials
await client.userApi.deactivateUser({ userId });      // → DEPROVISIONED  (suspendAccount)
await client.userApi.revokeUserSessions({ userId });  // clear sessions  (revokeAllSessions)
const u = await client.userApi.getUser({ userId });   // u.status === 'DEPROVISIONED' || 404 → LIKELY_GONE
```

### GitHub adapter — Octokit (copy paginate pattern)
```typescript
import { Octokit } from '@octokit/rest';
const octokit = new Octokit({ auth: installationOrClassicToken });
await octokit.rest.orgs.removeMember({ org, username });                                   // suspendAccount (primary)
const auths = await octokit.paginate('GET /orgs/{org}/credential-authorizations', { org }); // SAML SSO only; non-SAML → catch+warn
for (const a of auths.filter(x => x.login === username))
  await octokit.request('DELETE /orgs/{org}/credential-authorizations/{credential_id}', { org, credential_id: a.credential_id });
const outside = await octokit.paginate('GET /orgs/{org}/outside_collaborators', { org });   // flag repos as MANUAL with links
// verify: octokit.rest.orgs.checkMembershipForUser → 404 === LIKELY_GONE
```

### web-vite provider section trio (copy google-workspace)
```tsx
// *-provider-section-container.tsx (decisive container)
export function EntraProviderSection() {
  const { isLoading, isError, ...rest } = useEntraProviderSection();
  if (isLoading) return <EntraProviderSectionSkeleton />;
  if (isError) return <EntraProviderSectionError onRetry={rest.onRetry} />;
  return <EntraProviderSectionView {...rest} />;
}
// hooks/use-entra-provider-section.ts — ONLY tRPC boundary (useTRPC + useQuery/useMutation here)
// *-provider-section.tsx — presentational view + skeleton, props-in/JSX-out
```

### signoff-registry-flags.json entry shape (array-of-tuples)
```json
["idp-deprovisioning-entra", { "status": "PENDING", "notes": "F2 IdP Entra deprovisioning; legal review deferred per Standing Constraint; dev via FLAG_SIGNOFF_BYPASS=local" }]
```

## CI gates the executor must satisfy
- `pnpm --filter @contractor-ops/integrations typecheck` (tsc) exit 0
- `pnpm --filter @contractor-ops/integrations test` green
- `pnpm --filter @contractor-ops/web-vite check:data-layer` + `check:page-shells` + `pnpm check:web-vite-presentational`
- `pnpm --filter @contractor-ops/web-vite test <provider-section path>` (NEVER full web-vite suite)
- `pnpm audit` + `pnpm security:scan` after adding `@okta/okta-sdk-nodejs` + `@octokit/rest`
</content>
