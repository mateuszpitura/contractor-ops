---
phase: 78-f2-idp-entra-id-okta-github-adapters-the-differentiator
plan: 06
subsystem: api
tags: [idp, deprovisioning, registry, feature-flags, trpc, audit, multi-tenant]

requires:
  - phase: 76-f2-idp-capability-mixin-saga-schema-cooldown-gate-gws-scope
    provides: registerDeprovisionableAdapter (DeprovisioningProviderId), deprovisioning router
  - phase: 77-f2-idp-gws-slack-adapters-the-wedge
    provides: enableProviderForOrg / getProviderToggleState (per-org toggle), signoff flag convention, web-vite toggle hook
  - phase: 78-f2-idp-entra-id-okta-github-adapters-the-differentiator
    provides: EntraIdAdapter/OktaAdapter/GitHubAdapter (78-03/04/05)
provides:
  - "Three adapters registered in the HEAVY tier as Deprovisionable (saga resolves them by ENTRA/OKTA/GITHUB)"
  - "Three PENDING signoff flags (module.idp-deprovisioning-entra/-okta/-github)"
  - "deprovisioning.enableProviderForOrg + getProviderToggleState extended to all five providers"
  - "Three per-provider connection routers (entra/okta/github) — getStatus + gated setEnabled, mounted in root.ts"
affects: [78-07]

tech-stack:
  added: []
  patterns: ["same-instance dual registration (provider + Deprovisionable registries)", "approved-or-FLAG_SIGNOFF_BYPASS provider gate", "per-org toggle in Organization.settingsJson.idpDeprovisioningEnabled"]

key-files:
  created:
    - packages/api/src/routers/integrations/entra.ts
    - packages/api/src/routers/integrations/okta.ts
    - packages/api/src/routers/integrations/github.ts
    - packages/api/src/routers/integrations/__tests__/idp-deprovision-connections.test.ts
  modified:
    - packages/integrations/src/adapters/register-all.ts
    - packages/feature-flags/src/signoff-registry-flags.json
    - packages/api/src/routers/integrations/deprovisioning.ts
    - packages/api/src/routers/integrations/index.ts
    - packages/api/src/root.ts
    - apps/web-vite/src/components/settings/hooks/use-idp-deprovisioning-toggles.ts

key-decisions:
  - "Provider keys ENTRA/OKTA/GITHUB (NOT ENTRA_ID) — the registry DeprovisioningProviderId type, Prisma enum, and saga union all use ENTRA"
  - "Flag keys follow the 77 convention module.idp-deprovisioning-{provider} (NOT the plan's idp-deprovisioning-{provider}); the AC grep still matches (substring)"
  - "Signoff JSON is an OBJECT keyed by flag (not the plan's array-of-tuples); appended three PENDING entries"
  - "Gate uses getFlagSignoff(key)?.status === 'APPROVED' || FLAG_SIGNOFF_BYPASS=local (mirrors 77's isProviderSignoffSatisfied) — NOT isFlagSignoffSatisfied (which only checks existence, returns true for PENDING)"
  - "Extended the existing deprovisioning.ts per-org toggle (the real 77 D-15 seam) rather than building new connect/disconnect/health routers; ENTRA/OKTA are absent from the IntegrationProvider Prisma enum, so credential-row connect flows for those are schema-blocked and deferred (LOCAL-ONLY, no migration in this autonomous phase). The three thin per-provider routers expose getStatus + gated setEnabled delegating to the shared settings storage."

patterns-established:
  - "Per-provider router = thin facade over the shared per-org toggle + signoff gate + audit, no client-supplied tenant id"

requirements-completed: [IDP-05, IDP-06, IDP-07]

duration: 28min
completed: 2026-05-31
---

# Phase 78 Plan 06: Adapter Registration + Flags + Connection Routers Summary

**The integration seam: three adapters registered as Deprovisionable (saga-resolvable by ENTRA/OKTA/GITHUB), three PENDING per-provider signoff flags, the per-org enable toggle extended to all five providers, and three thin tRPC connection routers with session-scoped tenant + signoff gate + audit — monorepo typecheck green.**

## Performance
- **Duration:** ~28 min
- **Tasks:** 5
- **Files:** 10 (4 created + 6 modified)

## Accomplishments
- register-all.ts: EntraIdAdapter/OktaAdapter/GitHubAdapter in the HEAVY tier, each `registerAdapter` + `registerDeprovisionableAdapter('ENTRA'|'OKTA'|'GITHUB', sameInstance)`
- Three PENDING signoff flags `module.idp-deprovisioning-{entra,okta,github}` (D-12 independent rollout)
- deprovisioning.ts widened: `PROVIDER_FLAG_KEY`, `isProviderSignoffSatisfied`, `getProviderToggleState`, `enableProviderForOrg` now cover all 5 providers
- Three per-provider connection routers (`entra`/`okta`/`github`): `getStatus` + gated `setEnabled`, `organizationId` from session, audit via `writeAuditLog`, never echo a secret; barreled + mounted in root.ts
- 15/15 connection-router tests green; api + integrations + feature-flags + web-vite + monorepo typecheck all green

## Task Commits
1. **78-06-01..04: wiring** - `4aa68ff4` (feat)
2. **78-06-05: connection-router test** - `adfd4a9d` (test)
3. **web-vite ToggleProvider widening (cross-package seam)** - `a11bf9eb` (fix)

## Decisions Made
See key-decisions frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Provider key ENTRA, not ENTRA_ID**
- Plan used `registerDeprovisionableAdapter('ENTRA_ID', ...)`; the registry's `DeprovisioningProviderId` type only accepts `ENTRA`. Used `ENTRA`. Committed `4aa68ff4`.

**2. [Rule 1 - Bug] Flag-key convention + JSON shape**
- Plan said keys `idp-deprovisioning-{provider}` in an array-of-tuples file. Reality: 77 uses `module.idp-deprovisioning-{provider}` and the file is an object. Matched the shipped convention (AC grep still passes via substring). Committed `4aa68ff4`.

**3. [Rule 1 - Bug] Gate uses status===APPROVED, not isFlagSignoffSatisfied**
- `isFlagSignoffSatisfied` returns true whenever the entry exists (PENDING included), so it can't gate. Used the 77 `getFlagSignoff(key)?.status === 'APPROVED' || FLAG_SIGNOFF_BYPASS=local` pattern. The test asserts PENDING actually rejects. Committed `4aa68ff4`.

**4. [Rule 4 - Architecture/Scope] Extended the existing toggle seam; deferred ENTRA/OKTA credential-connect (schema-blocked)**
- The plan envisioned new connect/disconnect/health routers storing IntegrationConnection rows. But (a) the per-org toggle ALREADY exists in deprovisioning.ts (77 D-15) and is the real seam 78-07 needs; (b) the `IntegrationProvider` Prisma enum has GITHUB but NOT ENTRA/OKTA, and the plan objective forbids schema changes (autonomous phase, multi-region apply unavailable). Resolution: extended deprovisioning.ts for the toggle (works for all 5 via the saga keys + settingsJson, no enum needed) and built three thin per-provider routers (getStatus + gated setEnabled) instead of credential-storage connect flows. Full credential connect for ENTRA/OKTA is a follow-up requiring the enum + migration.

**5. [Rule 3 - Blocking] web-vite ToggleProvider widening**
- The widened server `getProviderToggleState` return type broke the Phase-77 web-vite toggle hook's `ToggleProvider` union (monorepo typecheck). Widened it to the 5 providers (1 line); full UI in 78-07. Committed `a11bf9eb`.

---

**Total deviations:** 5 (3 plan-vs-reality corrections, 1 scope/architecture decision for the connection-router shape under the schema constraint, 1 cross-package typecheck fix).
**Impact on plan:** The genuinely-new integration is delivered (adapters resolvable by the saga, flags gating enablement, per-org toggle for all 5, tenant-safe audited mutations). Credential-storage connect for ENTRA/OKTA is the one deferred item, gated on a schema migration that is explicitly out of this phase's scope.

## Issues Encountered
- ENTRA/OKTA are not in the `IntegrationProvider` Prisma enum — see deviation 4. GITHUB is present. No migration was made (phase scope + autonomous multi-region constraint).

## User Setup Required
None for code/tests. Post-deploy: flip the three `module.idp-deprovisioning-*` flags to APPROVED after legal review (Standing Constraint — deferred).

## Next Phase Readiness
- 78-07 (UI) consumes: `deprovisioning.getProviderToggleState` (now 5 providers), `entra/okta/github.getStatus` + `setEnabled`, and must add i18n labels for `Idp.toggleTable.provider.{ENTRA,OKTA,GITHUB}` + the three provider cards.

---
*Phase: 78-f2-idp-entra-id-okta-github-adapters-the-differentiator*
*Completed: 2026-05-31*
