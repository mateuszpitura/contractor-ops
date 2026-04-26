---
phase: 70-v6-0-foundation-cross-cutting-ci-guards-observability-baseli
plan: 09
subsystem: db

requires:
  - phase: 70-01
    provides: Failing test scaffold for backfillScopeCapabilities (Wave 0 RED state for FOUND6-05)

provides:
  - "IntegrationConnection.scopeCapabilities Json? field — sibling of configJson (Phase 70 D-13)"
  - "ScopeCapabilities, CapabilityEnum, ProviderId TS types branched on capability enum, raw scopes preserved"
  - "scopeCapabilitiesSchema Zod boundary schema — Phase 76 will validate at OAuth callback boundary"
  - "backfillScopeCapabilities pure function — idempotent, GWS-only writes, dry-run aware"
  - "backfill-scope-capabilities.ts CLI entry — single-region per invocation, mirrors push-all-regions.ts shape"
  - "scripts/README.md — per-region run pattern"

affects: []

tech-stack:
  added: ["zod ^3.25.76 (matches workspace-wide version) on packages/db"]
  patterns: ["Pure-function-plus-CLI-entry: exported function is the unit-tested core; main() is the lazy-imported runtime entry. Same shape as push-all-regions.ts but extracts the testable core."]
  notes:
    - "pnpm-lock.yaml diff also includes pre-existing peer-dep normalization (@opentelemetry/core 1.30.1 ↔ 2.6.1, better-call zod@3 ↔ zod@4) that pnpm reproduced any time install ran — drift between package.json and lockfile predating Plan 70-09. Including the normalized lockfile in this commit since adding zod required `pnpm install`."

key-files:
  created:
    - packages/db/src/types/scope-capabilities.ts
    - packages/db/src/scope-capabilities-schema.ts
    - packages/db/scripts/backfill-scope-capabilities.ts
    - packages/db/scripts/README.md
    - packages/db/prisma/schema/migrations/20260426215605_add_scope_capabilities/migration.sql
  modified:
    - packages/db/prisma/schema/integration.prisma (add scopeCapabilities Json? field)
    - packages/db/src/index.ts (re-export new types + Zod schema)
    - packages/db/package.json (zod dep)
    - packages/db/src/__tests__/scope-capabilities-backfill.test.ts (corrected import path one `..` deeper to reach packages/db/scripts/, dropped Wave-0 noUnresolvedImports biome ignores)

key-decisions:
  - "Migration SQL was generated via `prisma migrate diff --from-config-datasource --to-schema` because `prisma migrate dev --create-only` failed — shadow database replay errored on a pre-existing migration history issue (`20260318120000_enable_rls` references Member table that does not exist in shadow context). The diff command bypasses shadow DB entirely and produces the same single-statement SQL the plan expected. Pre-existing migration history issue is documented but not addressed in this plan (out of scope; will need a dedicated session)."
  - "Lazy-imported `@prisma/client` inside main() rather than at module top — keeps the pure backfillScopeCapabilities export importable in vitest without resolving `.prisma/client/default` (which lives in packages/db/generated/prisma/client/ here, not the standard node_modules location). Allows Wave 0 test scaffold to drive the function directly with synthetic ConnectionRow inputs."
  - "Wave-0 test scaffold imported `'../scripts/...'` from `src/__tests__/`, which would resolve to `packages/db/src/scripts/` — wrong directory. Corrected the test's relative path to `'../../scripts/...'` so it points at the actual location (`packages/db/scripts/`, sibling of src/, matching push-all-regions.ts). Wave-0 acknowledged this with a `noUnresolvedImports` biome ignore that's now removed."
  - "Static GWS scope strings (`admin.directory.user.readonly` + `admin.directory.group.readonly`) verified to match the live adapter at `packages/integrations/src/adapters/google-workspace-adapter.ts:57-58` exactly. T-70-09-01 mitigation."

patterns-established:
  - "Migration via `prisma migrate diff --from-config-datasource --to-schema` is the supported path when shadow DB replay fails. Documented as fallback for future migrations until migration history is reconciled."
  - "Pure-function-plus-lazy-CLI-import pattern for db scripts that need both unit-test surface and a runtime entry."

requirements-completed: [FOUND6-05]

manual-only-verifications:
  - "Multi-region backfill apply against `DATABASE_URL_EU` and `DATABASE_URL_ME` — deferred per Standing Project Constraints (LOCAL-ONLY). Run pattern documented in `packages/db/scripts/README.md`. Idempotent — safe to re-run after partial failure. Recommended dry-run sequence: `DATABASE_URL=$DATABASE_URL_EU tsx packages/db/scripts/backfill-scope-capabilities.ts --dry-run` (then same against ME) before applying."

duration: ~30min (interactive session, schema + types + Zod + script + test fix + verification)
completed: 2026-04-26
