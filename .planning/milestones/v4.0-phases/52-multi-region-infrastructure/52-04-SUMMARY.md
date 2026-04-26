---
phase: 52-multi-region-infrastructure
plan: 04
subsystem: infra
tags: [prisma, neon, migration, multi-region, schema-push]

requires:
  - phase: 52-multi-region-infrastructure
    provides: DataRegion enum, GovApiAuditLog model, regional client pool

provides:
  - Multi-region schema push script (db:push:all)

affects: [all-future-schema-changes]

tech-stack:
  added: []
  patterns: [multi-region-migration-script]

key-files:
  created:
    - packages/db/scripts/push-all-regions.ts
  modified:
    - packages/db/package.json

key-decisions:
  - "Fail-fast: abort on first region failure to prevent schema drift"
  - "Skip regions with missing env vars (graceful dev mode)"

patterns-established:
  - "Multi-region push: iterate REGION_ENV_VARS, set DATABASE_URL per region, run prisma db push"

metrics:
  files_created: 1
  files_modified: 1
  tests_added: 0
  tests_passing: 0
---

# Plan 52-04: Multi-Region Migration Script & Schema Push

## What was built

Created `packages/db/scripts/push-all-regions.ts` — a multi-region schema push script that iterates over configured regional Neon projects and runs `prisma db push` against each. Uses fail-fast behavior (aborts on first failure) to prevent schema drift between regions.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 00a709e | Add multi-region schema push script |
| 2 | — | [BLOCKING] Schema push requires live DB credentials — deferred to manual execution |

## Deviations

- Task 2 (schema push execution) is a human-action checkpoint requiring live Neon project credentials. Cannot be auto-approved. The script is ready; operator must run `cd packages/db && npm run db:push:all` with DATABASE_URL_EU and DATABASE_URL_ME set.

## Self-Check: PASSED (with deferred checkpoint)

- [x] Multi-region push script exists with fail-fast behavior
- [x] npm script `db:push:all` registered in package.json
- [ ] Schema push executed against live databases (deferred — requires credentials)
