---
phase: 78-f2-idp-entra-id-okta-github-adapters-the-differentiator
plan: 01
subsystem: integrations
tags: [idp, deprovisioning, entra, okta, github, msw, types, vitest, octokit, okta-sdk]

requires:
  - phase: 76-f2-idp-capability-mixin-saga-schema-cooldown-gate-gws-scope
    provides: Deprovisionable interface, scope-registry typed-const pattern (D-14), DeprovisioningProvider Prisma enum
  - phase: 77-f2-idp-gws-slack-adapters-the-wedge
    provides: ImpactPreview discriminated union (D-01), error-classifier, GWS/Slack adapter shape, impact-preview-union CI assertion
provides:
  - "@okta/okta-sdk-nodejs@8.0.0 + @octokit/rest@^22.0.1 vendor SDKs pinned in integrations"
  - "Three per-provider scope/capability typed-consts (Entra/Okta/GitHub)"
  - "ImpactPreview union extended with ENTRA/OKTA/GITHUB members + custom-metrics interfaces"
  - "Three MSW handler files (graph.microsoft.com, okta lifecycle, api.github.com)"
  - "Three RED it.todo test files (20 todos) for the Wave 2 adapter plans"
affects: [78-02, 78-03, 78-04, 78-05, 78-06, 78-07]

tech-stack:
  added: ["@okta/okta-sdk-nodejs@8.0.0", "@octokit/rest@^22.0.1"]
  patterns: ["Phase 76 D-14 typed-const scope registry", "Phase 77 D-01 additive ImpactPreview union extension", "MSW URL-predicate handlers (path-to-regexp v8 safe)"]

key-files:
  created:
    - packages/integrations/src/scopes/entra-deprovision-scopes.ts
    - packages/integrations/src/scopes/okta-deprovision-scopes.ts
    - packages/integrations/src/scopes/github-deprovision-scopes.ts
    - packages/test-utils/src/msw/handlers/entra.ts
    - packages/test-utils/src/msw/handlers/okta.ts
    - packages/test-utils/src/msw/handlers/github.ts
    - packages/integrations/src/adapters/__tests__/entra-deprovision.test.ts
    - packages/integrations/src/adapters/__tests__/okta-deprovision.test.ts
    - packages/integrations/src/adapters/__tests__/github-deprovision.test.ts
  modified:
    - packages/integrations/package.json
    - packages/integrations/src/scopes/index.ts
    - packages/integrations/src/idp/impact-preview.ts
    - packages/integrations/src/idp/index.ts
    - packages/integrations/src/types/index.ts
    - packages/integrations/src/__tests__/impact-preview-union.test.ts
    - packages/test-utils/src/msw/handlers/index.ts

key-decisions:
  - "Used provider discriminant 'ENTRA' (not the plan's 'ENTRA_ID') to match the shipped Prisma DeprovisioningProvider enum + idp-saga provider keys, keeping the D-01 CI subset assertion green and saga adapter-resolution working"
  - "Extended the REAL ImpactPreview at packages/integrations/src/idp/impact-preview.ts (re-exported via both idp/index.ts and types/index.ts), NOT the plan's stale path packages/integrations/src/types/impact-preview.ts"
  - "Scope-capability consts use plain `as const` (not `satisfies CapabilityEnum[]` like the 76 GWS file) because the plan-specified capability literals ('directory.user.write', 'org.member.remove', 'org.credential.revoke') are not members of the closed db CapabilityEnum"
  - "MSW handlers use URL-predicate matchers per the google-workspace.ts convention (MSW v2 + path-to-regexp v8 rejects :id glob/regex path literals)"

patterns-established:
  - "Per-provider deprovision scope-const file with Scope + Capability `as const` arrays and derived literal types"
  - "MSW handler-array file matching real provider hostnames + barrel registration in handlersByProvider"

requirements-completed: [IDP-05, IDP-06, IDP-07]

duration: 18min
completed: 2026-05-31
---

# Phase 78 Plan 01: IdP Adapter Typed Foundation Summary

**Typed contract layer for the Entra/Okta/GitHub Deprovisionable adapters — two pinned vendor SDKs, three scope-capability consts, a 3-member ImpactPreview union extension, three MSW endpoint mocks, and 20 RED it.todo scaffolds — all typechecking against the shipped Phase 76/77 reality.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-05-31T20:17:02Z
- **Completed:** 2026-05-31T22:26:00Z (wall clock includes pnpm install + audits)
- **Tasks:** 5
- **Files modified/created:** 16

## Accomplishments
- Pinned `@okta/okta-sdk-nodejs@8.0.0` (exact, CONTEXT D-08) + `@octokit/rest@^22.0.1`; install clean, no new high/critical audit advisory attributable to either package
- Three minimum-privilege scope/capability typed-consts following the Phase 76 D-14 registry pattern, re-exported from the scopes barrel
- `ImpactPreview` union grown by three members (`ENTRA`/`OKTA`/`GITHUB`) + `EntraImpactCustomMetrics`/`OktaImpactCustomMetrics`/`GitHubImpactCustomMetrics` (CONTEXT D-10 fields) without touching the GWS/Slack members; CI subset assertion updated and green
- Three MSW handler files mocking the exact provider endpoints + barrel registration
- Three RED test files (20 it.todo) that Wave 2 adapter plans flip GREEN

## Task Commits

1. **Task 78-01-01: vendor SDKs** - `da06522a` (chore)
2. **Task 78-01-02: scope-capability consts** - `3011b9ce` (feat)
3. **Task 78-01-03: ImpactPreview union extension** - `1a2922bc` (feat)
4. **Task 78-01-04: MSW handlers** - `f0890453` (test)
5. **Task 78-01-05: RED it.todo scaffolds** - `abffd692` (test)

## Decisions Made
See key-decisions frontmatter. The headline reconciliation: the plan was authored with `provider: 'ENTRA_ID'` and a `src/types/impact-preview.ts` path, but the shipped 76/77 tree uses the `ENTRA` enum key and `src/idp/impact-preview.ts`. Bound to the real reality on both counts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Provider discriminant 'ENTRA_ID' → 'ENTRA'**
- **Found during:** Task 78-01-03 (ImpactPreview union extension)
- **Issue:** Plan specified `provider: 'ENTRA_ID'`, but the shipped Prisma `DeprovisioningProvider` enum and `packages/idp-saga/src/types.ts` use `ENTRA`. The D-01 CI assertion (`impact-preview-union.test.ts`) checks union discriminants are a subset of that enum, and the saga resolves adapters by the enum key — `ENTRA_ID` would have failed the assertion and desynced adapter resolution.
- **Fix:** Used `provider: 'ENTRA'` for the union member (interface name kept as `EntraImpactCustomMetrics` per plan). Added `ENTRA`/`OKTA`/`GITHUB` to `UNION_PROVIDERS`.
- **Files modified:** packages/integrations/src/idp/impact-preview.ts, packages/integrations/src/__tests__/impact-preview-union.test.ts
- **Verification:** `pnpm --filter @contractor-ops/integrations test impact-preview-union` → 3 passed
- **Committed in:** 1a2922bc

**2. [Rule 1 - Bug] Stale union path src/types → src/idp**
- **Found during:** Task 78-01-03
- **Issue:** Plan's `files_modified` + `<dependency_gate>` pointed at `packages/integrations/src/types/impact-preview.ts`, but Phase 77 shipped the union at `packages/integrations/src/idp/impact-preview.ts` (re-exported via both `idp/index.ts` and `types/index.ts`).
- **Fix:** Extended the real `src/idp/impact-preview.ts` and added the three new interface re-exports to both barrels. Did NOT create a competing union file.
- **Files modified:** packages/integrations/src/idp/impact-preview.ts, packages/integrations/src/idp/index.ts, packages/integrations/src/types/index.ts
- **Verification:** typecheck clean; union test green
- **Committed in:** 1a2922bc

**3. [Rule 1 - Bug] Scope-capability `satisfies CapabilityEnum[]` not applicable**
- **Found during:** Task 78-01-02
- **Issue:** The 76 GWS sibling uses `satisfies readonly CapabilityEnum[]`, but the plan's capability literals (`directory.user.write`, `org.member.remove`, `org.credential.revoke`) are NOT members of the closed db `CapabilityEnum` — `satisfies` would fail typecheck.
- **Fix:** Used plain `as const` exactly as the plan's literal spec wrote (the plan text uses `as const`, not `satisfies`). Capability types derived from the const.
- **Files modified:** the three scope files
- **Verification:** `pnpm --filter @contractor-ops/integrations typecheck` exit 0
- **Committed in:** 3011b9ce

---

**Total deviations:** 3 auto-fixed (3 Rule-1 path/key/type corrections binding the plan to the shipped 76/77 reality).
**Impact on plan:** No scope creep. All corrections were required for the foundation to typecheck and stay consistent with the saga/CI contracts the Wave 2 adapters depend on.

## Issues Encountered
- `pnpm security:scan` exits 1 on pre-existing repo-wide advisories (`tmp` via `packages/api > exceljs`, `@hono/node-server` via `apps/web-vite` shadcn devtool, `turbo` root devtool). None are attributable to the two new packages (confirmed: neither `okta` nor `octokit` appears in any audit advisory path; the vulnerable packages are absent from the lockfile diff). Per the scope boundary, pre-existing unrelated advisories were not auto-fixed. The task AC ("no NEW high/critical attributable to the two new packages") passes.

## User Setup Required
None - no external service configuration required for this types/scaffold plan.

## Next Phase Readiness
- Wave 1 (78-02 error-classifier per-provider mappings) ready: classifier at `packages/integrations/src/idp/error-classifier.ts` confirmed present.
- Wave 2 (78-03/04/05 adapters) ready: scope consts, ImpactPreview members, MSW handlers, and RED tests all in place and typechecking.
- IMPORTANT for downstream plans: use provider key `ENTRA` (not `ENTRA_ID`); the union lives at `src/idp/impact-preview.ts`.

---
*Phase: 78-f2-idp-entra-id-okta-github-adapters-the-differentiator*
*Completed: 2026-05-31*
