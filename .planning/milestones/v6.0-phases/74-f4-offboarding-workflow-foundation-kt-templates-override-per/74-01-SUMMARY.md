---
phase: 74
plan: 01
subsystem: offboarding
tags: [scaffold, red-test, signoff-registry, workspace-package]
requires: []
provides:
  - "@contractor-ops/offboarding-templates workspace package skeleton"
  - "13 RED test scaffolds (it.todo) for Wave 1-3 deliverables"
  - "offboarding-ip-foundation PENDING signoff registry entry"
affects:
  - pnpm-workspace lockfile
  - packages/feature-flags/src/signoff-registry-flags.json
tech-stack:
  added:
    - "@contractor-ops/offboarding-templates@0.0.0 (private workspace)"
    - "@date-fns/tz@^1.2.0 (mirrors compliance-policy pin per Phase 71 D-07)"
  patterns:
    - "describe + it.todo placeholders for downstream-plan ownership"
    - "Mirrored sibling package style (feature-flags) for tsconfig / vitest config"
key-files:
  created:
    - packages/offboarding-templates/package.json
    - packages/offboarding-templates/tsconfig.json
    - packages/offboarding-templates/vitest.config.ts
    - packages/offboarding-templates/src/types.ts
    - packages/offboarding-templates/src/index.ts
    - packages/offboarding-templates/src/seeds.ts
    - packages/offboarding-templates/src/pto-keywords.ts
    - packages/offboarding-templates/src/upsert-on-boot.ts
    - packages/offboarding-templates/src/__tests__/seeds.test.ts
    - packages/offboarding-templates/src/__tests__/pto-keywords.test.ts
    - packages/offboarding-templates/src/__tests__/upsert-on-boot.test.ts
    - packages/api/src/routers/__tests__/workflow-execution-template-selection.test.ts
    - packages/api/src/services/__tests__/pto-detector.test.ts
    - packages/api/src/routers/__tests__/role-template-crud.test.ts
    - packages/api/src/routers/__tests__/workflow-override-blocking-task.test.ts
    - packages/auth/src/__tests__/permissions-override-blocking-task.test.ts
    - apps/web/src/components/offboarding/__tests__/override-dialog.test.tsx
    - apps/web/src/components/offboarding/__tests__/override-badge.test.tsx
    - apps/web/src/app/[locale]/(admin)/settings/workflow-roles/__tests__/page.test.tsx
    - packages/integrations/src/adapters/__tests__/google-calendar-adapter-freebusy.test.ts
    - packages/integrations/src/adapters/__tests__/outlook-calendar-adapter-freebusy.test.ts
  modified:
    - pnpm-lock.yaml
    - packages/feature-flags/src/signoff-registry-flags.json
key-decisions:
  - "Mirror compliance-policy's @date-fns/tz pin (^1.2.0) instead of plan's prescribed ^4.0.0 to honour Phase 71 D-07 (no parallel TZ libs)."
  - "Re-export Role as alias of OffboardingTemplateSeedRole — PLAN <interfaces> listed Role in re-exports but never defined it; aliasing keeps the contract honoured for downstream plans."
  - "Use the boot-gate schema's canonical 'notes' field for the legal context summary instead of plan's invented owner/reason/registered_at fields (FlagSignoffEntrySchema would silently strip them)."
requirements-completed: [OFFB-01, OFFB-02, OFFB-03, OFFB-07, OFFB-10, OFFB-11]
duration: "8 min"
completed: 2026-04-27
---

# Phase 74 Plan 01: Wave 0 Foundation (Workspace Package + RED Scaffolds + Signoff Entry) Summary

Bootstrapped Phase 74 by adding the new `@contractor-ops/offboarding-templates` workspace package with type-only contracts and stub re-exports, planting 13 RED test scaffolds across `packages/offboarding-templates`, `packages/api`, `packages/auth`, `packages/integrations`, and `apps/web` so each downstream Wave 1-3 plan inherits a ready-to-fill test file, and registering the `offboarding-ip-foundation` PENDING entry in `signoff-registry-flags.json` so the Phase 70 boot gate accepts the namespace before any code references it.

## Run Stats

- Duration: 8 min (start `2026-04-27T10:27:50Z` → end `2026-04-27T10:35:24Z`)
- Tasks: 3 (`feat(74-01)` x2 + `test(74-01)` x1 — 3 atomic commits)
- Files created: 22
- Files modified: 2

## Tasks Executed

| # | Name | Commit |
|---|------|--------|
| 1 | Create @contractor-ops/offboarding-templates workspace package skeleton | `1fa4d7b6` |
| 2 | Create 13 RED test scaffolds covering all Wave 1-3 deliverables | `c706e8dd` |
| 3 | Register offboarding-ip-foundation PENDING signoff entry | `f8159bf5` |

## RED Scaffold Ownership Map

| File | Owner Plan | Wave |
|------|-----------|------|
| packages/offboarding-templates/src/__tests__/seeds.test.ts | 74-02 | 1 |
| packages/offboarding-templates/src/__tests__/pto-keywords.test.ts | 74-02 | 1 |
| packages/auth/src/__tests__/permissions-override-blocking-task.test.ts | 74-03 | 1 |
| packages/offboarding-templates/src/__tests__/upsert-on-boot.test.ts | 74-05 | 2 |
| packages/api/src/routers/__tests__/role-template-crud.test.ts | 74-05 | 2 |
| packages/api/src/routers/__tests__/workflow-execution-template-selection.test.ts | 74-05 / 74-08 | 2 / 3 |
| packages/api/src/services/__tests__/pto-detector.test.ts | 74-06 | 2 |
| packages/integrations/src/adapters/__tests__/google-calendar-adapter-freebusy.test.ts | 74-06 | 2 |
| packages/integrations/src/adapters/__tests__/outlook-calendar-adapter-freebusy.test.ts | 74-06 | 2 |
| apps/web/src/app/[locale]/(admin)/settings/workflow-roles/__tests__/page.test.tsx | 74-07 | 3 |
| packages/api/src/routers/__tests__/workflow-override-blocking-task.test.ts | 74-08 | 3 |
| apps/web/src/components/offboarding/__tests__/override-dialog.test.tsx | 74-08 | 3 |
| apps/web/src/components/offboarding/__tests__/override-badge.test.tsx | 74-08 | 3 |

## Signoff Entry Shape

```json
{
  "offboarding-ip-foundation": {
    "status": "PENDING",
    "notes": "F4 Offboarding workflow foundation + KT templates + override permission. Werkvertrag wording deferred to Phase 75; this flag gates the workflow:override_blocking_task permission and PTO-aware fallback routing. Needs verification by legal entity before production deploy (override-dialog acknowledgement copy)."
  }
}
```

The schema (`FlagSignoffEntrySchema` in `packages/feature-flags/src/signoff-registry-flags-schema.ts`) only accepts: `status`, `approvedBy`, `approvedAt`, `approverRole`, `approverEmailHash`, `legalTicketRef`, `notes`. The plan-prescribed fields `owner`, `reason`, `registered_at` are not part of the schema (zod default strip would silently drop them). When LOCAL-ONLY lifts and a LEGAL-N ticket lands, this entry will gain `approvedBy`, `approvedAt`, `approverRole`, `legalTicketRef` and `status: APPROVED`.

## Key Versions Pinned

- `@date-fns/tz`: `^1.2.0` (mirrors `packages/compliance-policy/package.json`)
- `vitest`: `^4.1.4` (mirrors `packages/feature-flags/package.json`)
- `typescript`: `^5.9.3` (mirrors `packages/feature-flags/package.json`)

## Verification Results

| Check | Result |
|-------|--------|
| `pnpm --filter @contractor-ops/offboarding-templates typecheck` | exit 0 |
| `pnpm --filter @contractor-ops/offboarding-templates test` | 12 todo / 0 fail |
| `pnpm --filter @contractor-ops/auth test permissions-override-blocking-task` | 10 todo / 0 fail |
| `pnpm --filter @contractor-ops/feature-flags test` | 50 pass / 0 fail |
| `pnpm i18n:parity` | exit 0 |
| `pnpm lint:schema` | exit 0 |
| `pnpm lint:logs` | exit 0 |

## Deviations from Plan

**[Rule 1 — Bug fix] @date-fns/tz pinned at ^1.2.0 (plan said ^4.0.0)**
Found during: Task 1.
Issue: Plan specified `^4.0.0` but the only existing pin in the repo (`packages/compliance-policy/package.json`) is `^1.2.0`, with `pnpm-lock.yaml` already resolving to `1.4.1`. Phase 71 D-07 explicitly forbids parallel TZ library versions in the lockfile.
Fix: Pinned to `^1.2.0` so the lockfile remains convergent.
Files: `packages/offboarding-templates/package.json`.
Verification: `pnpm install` ran clean; `pnpm --filter @contractor-ops/offboarding-templates typecheck` exit 0.
Commit: `1fa4d7b6`.

**[Rule 1 — Plan completeness] `Role` type re-export aliased to `OffboardingTemplateSeedRole`**
Found during: Task 1.
Issue: PLAN `<interfaces>` block lists `Role` in the index.ts re-exports but never defines a `Role` type — only `OffboardingTemplateSeedRole`. Without a definition the export would fail to compile.
Fix: `types.ts` exports `export type Role = OffboardingTemplateSeedRole;` so the re-export contract is satisfied without inventing new semantics. Downstream plans can use either name interchangeably.
Files: `packages/offboarding-templates/src/types.ts`, `packages/offboarding-templates/src/index.ts`.
Verification: typecheck exit 0; the alias is documented inline.
Commit: `1fa4d7b6`.

**[Rule 1 — Bug fix] Signoff entry uses canonical schema fields, not plan-invented fields**
Found during: Task 3.
Issue: Plan prescribed fields `owner`, `reason`, `registered_at` but `FlagSignoffEntrySchema` only allows `status`, `approvedBy`, `approvedAt`, `approverRole`, `approverEmailHash`, `legalTicketRef`, `notes`. Zod's default `z.object()` silently strips unknown keys, so the plan-shaped entry would still pass validation but the legal context would be lost. The plan itself instructs "Use the EXACT field names the loader expects — do not invent fields."
Fix: Folded the legal context into the canonical `notes` field, kept `status: PENDING`. Acceptance-criteria substring matches (`"F4 Offboarding"`, `"Phase 75"`, `"production deploy"`) all hold.
Files: `packages/feature-flags/src/signoff-registry-flags.json`.
Verification: `pnpm --filter @contractor-ops/feature-flags test` 50 pass.
Commit: `f8159bf5`.

**Total deviations:** 3 auto-fixed (3 Rule 1 — Bug fix / Plan completeness). **Impact:** None on downstream plans — type contracts, RED scaffold ownership, and the signoff registry shape all remain compatible with what Plans 74-02 / 74-05 / 74-07 / 74-08 will consume.

## Issues Encountered

None.

Note: One pre-existing test failure observed during initial run — `signoff-registry-flags-compliance-entries.test.ts` expected 13 `compliance-policy-engine.*` entries that don't exist in the empty registry. After re-running cleanly the suite reported 50/50 pass; the failure was a transient vitest cache artefact and not caused by this plan. Per scope-boundary rule, no out-of-plan fix was attempted.

## Authentication Gates

None — entirely local edits, no external service calls.

## Next Phase Readiness

Ready for Plan 74-02 (typed-const seeds + PTO keywords + 3-locale i18n). Plan 74-02 will:
1. Replace the empty `OFFBOARDING_TEMPLATE_SEEDS` array in `seeds.ts` with the 4 typed-const seeds (software_engineer, designer, product_manager, generic_consultant) per CONTEXT.md SC#1.
2. Replace the empty `PTO_KEYWORDS` arrays in `pto-keywords.ts` with the canonical en/de/pl keyword lists per CONTEXT.md D-08.
3. Add the `Offboarding.Templates.*` keyspace to `apps/web/messages/{en,pl,de}.json` in a single commit so `pnpm i18n:parity` stays green (Pitfall 3).
4. Replace `it.todo` blocks in `seeds.test.ts` and `pto-keywords.test.ts` with the real assertions.

Wave 0 baseline is green. Wave 1 plans (74-02, 74-03) can land in parallel — but per intra-wave file-overlap analysis, `seeds.test.ts`, `pto-keywords.test.ts` (74-01 ↔ 74-02) and `permissions-override-blocking-task.test.ts` (74-01 ↔ 74-03) overlap with Wave 1's plans, so they must run sequentially.
