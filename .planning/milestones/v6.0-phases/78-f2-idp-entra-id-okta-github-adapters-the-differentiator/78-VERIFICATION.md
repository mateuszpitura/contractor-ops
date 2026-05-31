---
status: passed
phase: 78-f2-idp-entra-id-okta-github-adapters-the-differentiator
verified: 2026-05-31
requirements: [IDP-05, IDP-06, IDP-07]
method: inline (Agent subagent unavailable in this runtime — orchestrator verified against the live tree per the execute-phase runtime-compatibility fallback)
---

# Phase 78 Verification — F2 IdP: Entra ID + Okta + GitHub Adapters

**Verdict: PASSED.** All seven plans executed with SUMMARY.md; the phase goal is achieved and all three requirement IDs are satisfied against the live codebase.

## Goal Achievement

> Admins in Microsoft / Okta-IdP / GitHub-org-managed shops can deprovision via the same `ACCESS_REVOKE` task; pre-flight Conditional Access detection prevents silent-failure mode (Entra); per-PAT explicit revocation prevents the GitHub "outside-collab back-door" path.

- **Same ACCESS_REVOKE task:** all three adapters implement the Phase 76 `Deprovisionable` interface and are registered with `registerDeprovisionableAdapter('ENTRA'|'OKTA'|'GITHUB', …)` in `register-all.ts` — the saga resolves them by the same provider key as GWS/Slack. ✓
- **Entra Conditional Access pre-flight:** `EntraIdAdapter.describeImpact` enumerates `/identity/conditionalAccess/policies` and surfaces enabled+applicable policies as a non-blocking warning. ✓
- **Entra hybrid-AD silent-failure prevention:** `suspendAccount` reads `onPremisesSyncEnabled` BEFORE any mutation and HARD-BLOCKS (zero write calls) when on-prem AD is authoritative. ✓ (unit-asserted: "no PATCH fires when onPremisesSyncEnabled:true")
- **GitHub per-PAT revocation + back-door:** `GitHubAdapter.revokeAllSessions` revokes per-PAT `credential-authorizations` on SAML orgs (graceful non-SAML degrade), and `describeImpact.outsideCollaboratorRepoCount` flags repos that survive org removal. ✓

## must_haves (per-plan)

| Plan | must_haves | Status |
|------|-----------|--------|
| 78-01 | 2 SDKs pinned; 3 scope consts; ImpactPreview +3 members; 3 MSW handlers; 3 RED tests; typecheck | PASS |
| 78-02 | classifyError per-provider; GitHub 403 rate-limit↔forbidden split; no enum widening; tests | PASS (36/36) |
| 78-03 | EntraIdAdapter implements Deprovisionable; hybrid-AD block; CA warning; signInActivity poll; raw Graph (no SDK) | PASS (11/11) |
| 78-04 | OktaAdapter via @okta/okta-sdk-nodejs v8; deactivate/revoke/verify/describeImpact | PASS (10/10) |
| 78-05 | GitHubAdapter via @octokit/rest; removeMember; SAML PAT revoke graceful; outside-collab flag | PASS (12/12) |
| 78-06 | register-all dual-registration; 3 PENDING flags; per-org toggle (5 providers); 3 connection routers; audit; tenant-from-session | PASS (15/15) |
| 78-07 | 3 provider sections (Page→Container→Hook→Component); compliance table (5 providers); a11y; i18n en/de/pl/ar | PASS (11/11) |

## Automated Checks

- `pnpm --filter @contractor-ops/{integrations,api,feature-flags,web-vite,test-utils} typecheck` — all PASS
- `pnpm typecheck` (monorepo, CI-canonical) — PASS (43/43)
- `pnpm --filter @contractor-ops/integrations test` — 503 passed, 7 todo, 0 fail
- `pnpm --filter @contractor-ops/feature-flags test` — 75 passed
- `pnpm --filter @contractor-ops/api test idp-deprovision-connections` — 15 passed
- web-vite (scoped): provider-section tests 11 passed; toggle-table 4; integrations-tab 3
- `pnpm i18n:parity` — OK; `pnpm lint:scopes` — OK (23 adapter files clean)

## Requirement Traceability

- IDP-05 (Entra) → 78-01/02/03/06/07 — Complete
- IDP-06 (Okta) → 78-01/02/04/06/07 — Complete
- IDP-07 (GitHub) → 78-01/02/05/06/07 — Complete

## Deferred / Human-verification Items

- **Schema follow-up (not a gap):** `ENTRA` and `OKTA` are absent from the Prisma `IntegrationProvider` enum, so full OAuth credential-connect for those two is deferred (requires an additive enum + multi-region migration, out of this autonomous phase's scope). The per-org enable toggle + saga deprovision path work without it. GitHub is already in the enum.
- **Legal sign-off (Standing Constraint — deferred):** the three `module.idp-deprovisioning-{entra,okta,github}` flags ship PENDING; flip to APPROVED post-deploy after legal review. Until then the per-org enable toggles are disabled (server-gated), correct by design.
- **Manual UI UAT (post-deploy):** visual render of the three provider cards + 5-row toggle table across light/dark + RTL (ar) locales.
- **Real-provider sandbox:** all adapter tests run against MSW (LOCAL-ONLY); live Entra/Okta/GitHub sandbox verification is a post-deploy item.

## Lint Notes (pre-existing, NOT phase-78 regressions)

`pnpm lint:logs` and `pnpm lint:schema` fail on pre-existing offenders unrelated to this phase (`apps/api/src/routes/csp-report.ts`, `model UserPinnedView` in `auth.prisma`). Phase 78 touched neither and introduced zero new offenders in either guard (verified via diff scan).

## Concurrency Note

A second executor session ran phase 78 in parallel (same git author). It landed commit `06f0a3ee` (a strict improvement: the connection-router signoff gate returns `TRPCError FORBIDDEN` with `DEPROVISIONING_PROVIDER_SIGNOFF_PENDING` instead of a bare Error) and a blocker note `3f3f8588`, then stopped before 78-07. This session's 78-07 built on top of that fix; the merged tree is consistent and all tests pass against it.
