---
phase: 82-v7-0-foundation-add-on-billing-flag-registry-us-region-enabl
plan: 03
subsystem: feature-flags
tags: [feature-flags, boot-gate, signoff-registry, v7.0, FOUND7-02]
requires:
  - "82-02: 'payroll' flag category in schemas.ts (8 payroll.* keys depend on it)"
  - "82-02: regionSchema EU/ME/US (regionSchema lockstep test, shared file)"
  - "82-01: RED stubs (v7-flags-registered.test.ts + boot-gate.test.ts v7.0 cohort cases)"
provides:
  - "19 v7.0 FLAGS entries (D-09) + exported V7_FLAG_KEYS cohort const"
  - "19 PENDING signoff-registry entries (boot-gate registry)"
  - "10 v7.0 gated namespace prefixes in GATED_FLAG_NAMESPACE_PREFIXES"
  - "assertFlagSignoffsOrExit() wired into apps/api, apps/public-api, apps/cron-worker boot"
affects:
  - "packages/feature-flags (FLAGS, signoff registry, gated prefixes, exports)"
  - "apps/{api,public-api,cron-worker} boot path"
tech-stack:
  added: []
  patterns:
    - "dot-namespaced flag key + PENDING signoff + gated prefix (3-file lockstep, gulf.* precedent)"
    - "fail-closed boot gate via existing exported assertFlagSignoffsOrExit() (no hand-rolled exit guard)"
key-files:
  created: []
  modified:
    - packages/feature-flags/src/flags-core.ts
    - packages/feature-flags/src/registry.ts
    - packages/feature-flags/src/index.ts
    - packages/feature-flags/src/signoff-registry-flags.json
    - packages/feature-flags/src/signoff-registry-flags.ts
    - apps/api/src/index.ts
    - apps/api/package.json
    - apps/public-api/src/index.ts
    - apps/public-api/package.json
    - apps/cron-worker/src/index.ts
    - pnpm-lock.yaml
decisions:
  - "Wired the existing exported gate (Don't-Hand-Roll) rather than adding a new process.exit guard"
  - "Added @contractor-ops/feature-flags as a direct dep to api + public-api to avoid a phantom dependency (was transitive via @contractor-ops/api)"
  - "v7.0 gated prefixes scoped narrow so pre-v7.0 non-gated flags (payments.bacs-enabled, module.classification-engine) stay ungated (D-10)"
metrics:
  duration: ~18m
  completed: 2026-06-07
  tasks: 3
  files: 11
---

# Phase 82 Plan 03: Flag Registry + Boot Gate Wiring Summary

FOUND7-02 complete: registered all 19 v7.0 Unleash flags PENDING in the boot-gate signoff registry (dot-namespaced FLAGS + V7_FLAG_KEYS cohort + 19 PENDING entries + narrow gated prefixes) and wired the previously-UNWIRED `assertFlagSignoffsOrExit()` into all three app boots (apps/api, apps/public-api, apps/cron-worker) — the load-bearing fix that makes SC#2's "boot-time gate exits if any listed flag is missing" actually fire.

## What Was Built

**Task 1 — 19 v7.0 FLAGS + V7_FLAG_KEYS cohort** (`ea21327f`)
- Added the 19 dot-namespaced v7.0 flags (D-09 locked mapping) to `FLAGS` in `flags-core.ts`, each `default: false`, `jurisdiction: 'ANY'`, cloning the `gulf.*` entry shape: 5 `module.*` (us-expansion, workforce-employees, public-api, outbound-webhooks, iris-efile), 5 `integration.*` (personio-sync, bamboohr-sync, marketplace-{zapier,n8n,make}), 1 `payments.ach-payouts`, 8 `payroll.*` adapters.
- Exported `V7_FLAG_KEYS` cohort const (`as const satisfies readonly FlagKey[]`) — a compile-time guarantee every cohort key exists in FLAGS. Re-exported via `registry.ts` and `index.ts`.
- `module.irs-fire-efile` deliberately NOT included (D-09 = exactly 19).
- `schemas.ts` untouched (82-02 owns the `'payroll'` category, already merged).

**Task 2 — 19 PENDING signoff entries + gated prefixes** (`be9cf604`)
- Appended one PENDING `{status, notes}` entry per v7.0 key to `signoff-registry-flags.json` (keyed identically to FLAGS; mirror of the `gulf.free-zone-tracking` / `module.idp-deprovisioning-gws` shape).
- Appended 10 narrow v7.0 prefixes to `GATED_FLAG_NAMESPACE_PREFIXES`: `module.us-`, `module.workforce-`, `module.iris-`, `module.public-api`, `module.outbound-`, `integration.personio-`, `integration.bamboohr-`, `integration.marketplace-`, `payments.ach-`, `payroll.`.
- Gate NOT broadened to all declared flags (D-10): the prefixes are scoped to exclude pre-v7.0 non-gated flags — verified `isGatedFlag('payments.bacs-enabled') === false`, `isGatedFlag('module.classification-engine') === false` still hold (`is-gated-flag.test.ts` GREEN).

**Task 3 — wire the boot gate into all three apps** (`1737d533`)
- Imported and called `assertFlagSignoffsOrExit()` after env load / before serving in `apps/api/src/index.ts` (in `main()`, before adapter-register + buildServer), `apps/public-api/src/index.ts` (after required-env validation, before `preWarmRegionalClients`), and `apps/cron-worker/src/index.ts` (in `main()`, before scheduling jobs).
- Reused the existing exported gate (Don't-Hand-Roll) — no new `process.exit` guard. Honors `FLAG_SIGNOFF_BYPASS=local` (warn, no exit) for local dev.

## Verification

- `pnpm --filter @contractor-ops/feature-flags test v7-flags is-gated-flag signoff` — 60 passed (cohort = 19, all 19 present in FLAGS ∧ signoff registry, pre-v7.0 flags unaffected).
- `pnpm typecheck --filter=@contractor-ops/feature-flags` — pass (the `satisfies readonly FlagKey[]` compile-time check + `'payroll'` category resolve).
- `pnpm typecheck --filter=@contractor-ops/api-server --filter=@contractor-ops/public-api --filter=@contractor-ops/cron-worker` — all pass.
- `grep -l "assertFlagSignoffsOrExit()"` confirms the call in all three entrypoints.
- **Boot does NOT regress to exit(1):** invoked the real gate against the real registry → `assertFlagSignoffsOrExit()` returns `true`, `exited: null`. All gated flags (compliance, gulf, idp, + 19 v7.0) have registry entries; boot passes cleanly with the 19 PENDING entries present.
- Boot-gate v7.0-cohort cases: all 3 Phase-82 cases GREEN (cohort gated ∧ has entry; missing-key exits(1); bypass downgrades to warn).
- `pnpm lint:logs` — touched app files (the three `index.ts`) added zero `console.*` / zero log-body sites. (One pre-existing unrelated offense flagged in `csp-report.ts:86` — out of scope, see Deferred Issues.)

## Deviations from Plan

### Auto-added (Rule 2/3 — critical for task completion)

**1. [Rule 3 - Blocking] Added @contractor-ops/feature-flags as a direct dependency to apps/api + apps/public-api**
- **Found during:** Task 3 (public-api typecheck failed: `Cannot find module '@contractor-ops/feature-flags'`).
- **Issue:** Both apps imported the gate but only had `feature-flags` transitively (via `@contractor-ops/api`) — a phantom dependency that CLAUDE.md monorepo rules forbid; public-api could not even resolve the type. cron-worker already declared it.
- **Fix:** Added `"@contractor-ops/feature-flags": "workspace:*"` to both apps' `dependencies` and ran `pnpm install` to materialize the workspace symlinks + refresh the lockfile.
- **Files modified:** apps/api/package.json, apps/public-api/package.json, pnpm-lock.yaml.
- **Commit:** 1737d533.

## Deferred Issues (out of scope — scope-boundary rule)

Logged to `82-…/deferred-items.md` under `## 82-03`:

1. **Pre-existing failing test** `boot-gate.test.ts:73-83` (`synthetic gated key…`): asserts `getFlagSignoff('compliance-portal-self-service') === undefined`, but that key has had a PENDING entry since Phase 73 (`6fc2b8f3`). The test's assumption (key chosen in Phase 70, `99a6c74f`) was invalidated by Phase 73, not by 82-03. Confirmed via `git log -S` history; 82-03 only appended the 19 v7.0 entries (0 deletions to the compliance key). Fix = repoint the test's `SYNTHETIC` to a genuinely-unregistered gated-prefix key. The 3 Phase-82 v7.0-cohort cases are GREEN.
2. **Pre-existing `lint:logs` offense** `apps/api/src/routes/csp-report.ts:86` (unredacted `body` log) — unrelated to the flag-gate wiring; already logged under 82-04.

## Self-Check: PASSED

- All 6 key files exist (3 feature-flags + 3 app entrypoints).
- All 3 commits exist: ea21327f, be9cf604, 1737d533.
