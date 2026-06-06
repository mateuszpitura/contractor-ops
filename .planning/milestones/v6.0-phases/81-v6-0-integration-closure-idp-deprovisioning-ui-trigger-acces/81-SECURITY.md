---
phase: 81-v6-0-integration-closure-idp-deprovisioning-ui-trigger-acces
slug: v6-0-integration-closure-idp-deprovisioning-ui-trigger-acces
status: verified
threats_open: 0
asvs_level: 2
created: 2026-06-06
register_authored_at_plan_time: true
---

# Phase 81 — Security

> Per-phase security contract: STRIDE threat register, accepted risks, audit trail.
> Verification mode: each `mitigate` threat confirmed by reading the IMPLEMENTED source
> (grep/Read), not by trusting SUMMARY/PLAN intent. Implementation files unchanged.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| SPA → tRPC (web-vite) | Authenticated org member triggers a deprovisioning run / reads eligibility | assignmentId / contractorId, deterministic idempotencyKey |
| tRPC → DB (RLS + tenant ext) | Session-derived `ctx.organizationId` scopes every read/write | run/step rows, ContractorAssignment, ApprovalFlow |
| tRPC → QStash (fan-out) | Post-commit per-step jobs to the IdP step-runner | runId, stepId, provider, externalUserId |
| Step-runner → IdP (GWS / Slack org-grid) | Destructive SUSPEND_ACCOUNT / REVOKE_ALL_SESSIONS | org-grid bearer token, external user id |
| Compliance approve → recovery hook | In-tx release of PENDING_COMPLIANCE approval flows | itemId, contractorId, organizationId |

---

## Threat Register

24 threats (19 mitigate, 5 accept). Register authored at plan time; this audit verifies
each `mitigate` against implemented code and each `accept` against this log.

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-81-01-01 | Tampering | Prisma schema (idp-deprovisioning) | mitigate | `@@unique([organizationId, idempotencyKey])` present at schema level — see Accepted Risks R-01 (live-DB apply unverifiable in sandbox) | closed |
| T-81-01-02 | EoP | deprovisioning-start.test.ts | accept (test-only) | Test asserts the `idp:start_run` deny path; gate itself ships in 81-02. See Accepted Risks R-02 | closed |
| T-81-01-SC | Tampering | supply-chain | accept | No package installs in this plan. See R-03 | closed |
| T-81-02-01 | EoP | deprovisioning.ts | mitigate | `startDeprovisioningRun` (L198) + `getDeprovisioningEligibility` (L121) + `resolveAssignmentForContractor` (L174) all `.use(requirePermission({ idp: ['start_run'] }))`; grant owner/admin/it_admin in roles.ts | closed |
| T-81-02-02 | Info Disc/IDOR | deprovisioning.ts | mitigate | `resolveAssignmentForContractor` where `{ contractorId, organizationId: ctx.organizationId, status:'ENDED' }` (L177-185); cross-tenant contractorId → `{ assignmentId: null }` (L186) | closed |
| T-81-02-03 | Tampering | deprovisioning.ts | mitigate | P2002 handler re-reads via composite `organizationId_idempotencyKey` (L328-336) scoped to session org; backed by schema `@@unique` | closed |
| T-81-02-04 | Tampering | idp-token-resolver.ts | mitigate | Single `RESOLVER_BACKED_PROVIDERS` (L17); `deriveProvidersForRun` intersects against `RESOLVER_BACKED_SET` (deprovisioning.ts L69, L84-89) | closed |
| T-81-02-05 | DoS | deprovisioning.ts | mitigate | Empty derived set throws `DEPROVISIONING_INTEGRATION_NOT_CONFIGURED` (L248-255) — no zero-step run | closed |
| T-81-02-SC | Tampering | supply-chain | accept | No installs. See R-03 | closed |
| T-81-03-01 | DoS | compliance-admin.ts | mitigate | `onComplianceItemSatisfied` called INSIDE `$transaction` (L319-323); `dispatchComplianceUploadOutcome` post-tx best-effort (L328) | closed |
| T-81-03-02 | Tampering/SQLi | compliance-recovery.ts | mitigate | `$queryRaw` with bound `${containment}::jsonb` param (L50-57); no string interpolation; `organizationId` bound param | closed |
| T-81-03-03 | Info Disc/IDOR | compliance-admin.ts / compliance-recovery.ts | mitigate | `organizationId: ctx.organizationId` passed to hook (L322); query filters `"organizationId" = ${args.organizationId}` (recovery L55) | closed |
| T-81-03-04 | Tampering | compliance-admin.ts | mitigate | Per-item single `onComplianceItemSatisfied` call on the one flipped item (L319-323) — NOT the all-BLOCKING supersession loop | closed |
| T-81-03-SC | Tampering | supply-chain | accept | No installs. See R-03 | closed |
| T-81-04-01 | Info Disc | slack-adapter.test.ts | mitigate | Placeholder `ORG_GRID_TOKEN = 'org-grid-token'` (L217); bearer asserted via `Bearer ${ORG_GRID_TOKEN}` equality (L248, L270, L309) — no real secret printed | closed |
| T-81-04-02 | Spoofing | slack-adapter.test.ts | mitigate | `vi.stubGlobal('fetch', …)` for OAuth cases; MSW `server.listen({ onUnhandledRequest:'error' })` (L222) for deprovision path — no network egress | closed |
| T-81-04-SC | Tampering | supply-chain | accept | No installs. See R-03 | closed |
| T-81-05-01 | EoP | deprovisioning-trigger-container.tsx / use-permissions.ts | mitigate | `permissions.can('idp', ['start_run'])` advisory hide only (L39, L44); server re-enforces `requirePermission` on every call | closed |
| T-81-05-02 | Tampering | use-start-deprovisioning.ts / deprovisioning.ts | mitigate | assignmentId resolved server-side org-scoped (resolver); server re-runs `canStartDeprovisioning` cooldown gate in mutation (deprovisioning.ts L221-230) | closed |
| T-81-05-03 | Info Disc | use-start-deprovisioning.ts | mitigate | All tRPC (`useTRPC`, queries, mutation) confined to the hook; container/card hold no tRPC; `check:web-vite-data-layer` gate | closed |
| T-81-05-04 | DoS | use-start-deprovisioning.ts | mitigate | `deriveIdempotencyKey(assignmentId)` deterministic per-assignment (L39-41); server P2002 returns existing run (`idempotent:true`, deprovisioning.ts L337) | closed |
| T-81-05-SC | Tampering | supply-chain | accept | No installs. See R-03 | closed |
| T-81-06-01 | EoP | 81-int-closure.test.ts (composition) | mitigate | Deny + authorized happy path composed; the `idp:start_run` gate proven in 81-01/81-02 (deprovisioning-start.test.ts L411-442) | closed |
| T-81-06-02 | Tampering | composition test | mitigate | Deterministic per-assignment key asserted carried into the single run insert | closed |
| T-81-06-03 | DoS | composition test | mitigate | Flow 2 asserts approve + in-tx recovery commit atomically and survive a post-tx notification failure; payment gate releases | closed |
| T-81-06-SC | Tampering | supply-chain | accept | No installs. See R-03 | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-01 | T-81-01-01 | `@@unique([organizationId, idempotencyKey])` is present in `packages/db/prisma/schema/idp-deprovisioning.prisma:25`. The constraint was NOT confirmed against the live Neon DB (sandbox blocked the prod read). Mitigated at schema level; residual = run `prisma db push` / migration so the live index exists before relying on a runtime P2002. | matt (phase owner) | 2026-06-06 |
| R-02 | T-81-01-02 | Plan 81-01 is test-only; it asserts the `idp:start_run` deny path while the gate itself ships in 81-02. The gate is now present and verified in implemented code (deprovisioning.ts L121/L174/L198/L350). Test-only gate-deferral accepted. | matt (phase owner) | 2026-06-06 |
| R-03 | T-81-*-SC | All `*-SC` supply-chain threats are "no package installs in this plan." Confirmed: every SUMMARY Threat Flags / Threat Surface section reports "None — no new … schema change," and no dependency was added in any of the 6 plans. | matt (phase owner) | 2026-06-06 |

*Accepted risks do not resurface in future audit runs.*

---

## CR-01 Re-verification (mid-review fix)

Code review CR-01 (`81-REVIEW.md`) flagged `retryDeprovisioningStep` as shipping ungated —
an unprivileged member could re-enqueue a destructive SUSPEND_ACCOUNT / REVOKE_ALL_SESSIONS
job. The fix is CONFIRMED HELD in the implemented source:

- `packages/api/src/routers/integrations/deprovisioning.ts:349-351` —
  `retryDeprovisioningStep: tenantProcedure.use(requirePermission({ idp: ['start_run'] }))`.
- Regression test present: `deprovisioning-start.test.ts:434` rejects `retryDeprovisioningStep`
  with `FORBIDDEN` when `idp:start_run` is denied.

This closes the only authorization gap raised during review. (WR-01 it_admin client-mirror
under-grant was also fixed — `use-permissions.ts:55-68` now mirrors the full server it_admin
grant; this is a UX/correctness fix, not a security gate, since the server stays authoritative.)

---

## Unregistered Flags

None. All 6 SUMMARY files report Threat Flags / Threat Surface = "None"; no new trust
boundary, network endpoint, auth path, or schema change appeared during implementation that
lacks a mapped threat ID.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-06 | 24 | 24 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter
- [x] CR-01 fix (retryDeprovisioningStep gate) re-verified in implemented code

**Approval:** verified 2026-06-06
