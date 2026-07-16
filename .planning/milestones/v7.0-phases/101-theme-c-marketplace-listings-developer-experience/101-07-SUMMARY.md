---
phase: 101-theme-c-marketplace-listings-developer-experience
plan: 07
subsystem: api
tags: [zapier, make, marketplace, zapier-platform-core, webhooks, openapi, integrations]

# Dependency graph
requires:
  - phase: 101-03
    provides: "@contractor-ops/marketplace-manifests generator (generateZapier / generateMake / load-spec) + the MarketplaceListing model"
  - phase: 100
    provides: "the 16-event webhook catalog (packages/validators/src/webhooks) — the trigger source"
  - phase: 98
    provides: "openapi.snapshot.json contract (the write-action source; absent until 98-11 runs)"
provides:
  - "@contractor-ops/zapier-app — a Zapier CLI app (custom API-key auth + 16 REST-hook triggers + one create per write op) assembled from the generated Zapier definition"
  - "apps/public-api/marketplace/make/blueprint.json — the generated + drift-checked Make.com app blueprint"
  - "the Make blueprint wired into the manifests CLI generate/--check drift gate"
  - "EXTERNAL-ENABLEMENT rows recording the deferred Zapier (2-4wk) + Make (1-2wk) submissions behind integration.marketplace-{zapier,make}"
affects: [101-06 n8n-nodes, 101-09 marketplace web UI, 101-10 phase close, marketplace submissions]

# Tech tracking
tech-stack:
  added: ["zapier-platform-core@19.0.0 (pinned, 58d old, audited)"]
  patterns:
    - "Marketplace app packages consume the generated manifests (generateZapier/generateMake) — never hand-authored per platform"
    - "Bundle test runs the platform's own compile+schema-clean+validate pipeline (zapier-platform-core/src/tools/schema validateApp) — the zapier validate equivalent that serializes perform functions"
    - "Action count derived from the snapshot's write set (zero pre-flip); triggers derived from the event catalog"

key-files:
  created:
    - packages/zapier-app/src/index.ts
    - packages/zapier-app/src/authentication.ts
    - packages/zapier-app/src/triggers/index.ts
    - packages/zapier-app/src/creates/index.ts
    - packages/zapier-app/src/http-method.ts
    - packages/zapier-app/src/__tests__/app.test.ts
    - apps/public-api/marketplace/make/blueprint.json
    - packages/marketplace-manifests/src/__tests__/make-blueprint.test.ts
    - packages/zapier-app/README.md
  modified:
    - packages/marketplace-manifests/src/cli.ts
    - packages/marketplace-manifests/src/generate-make.ts
    - packages/marketplace-manifests/src/index.ts
    - .planning/EXTERNAL-ENABLEMENT.md

key-decisions:
  - "Validate the app via zapier-platform-core's own validateApp (which serializes perform functions before schema-checking) instead of raw zapier-platform-schema.validateAppDefinition, which rejects raw JS functions"
  - "The Zapier bundle test uses a 6-write fixture snapshot to demonstrate the 6 named actions; a writes-hidden case proves the 0-action pre-flip posture — the count is always snapshot-derived"
  - "Reconciled EXTERNAL-ENABLEMENT rows #32/#34 (enrich + narrow) rather than adding duplicate submission rows"

patterns-established:
  - "Zapier/Make app assembled from generated defs: metadata (keys/nouns/events/URLs) from the generator, perform functions wired in-package"
  - "Committed marketplace artifacts (Make blueprint) are generated + drift-checked from the OpenAPI snapshot by the manifests CLI"

requirements-completed: [INTEG-ZAPIER-01, INTEG-MAKE-01]

# Metrics
duration: 37min
completed: 2026-07-16
---

# Phase 101 Plan 07: Marketplace apps (Zapier CLI + Make blueprint) Summary

**A Zapier CLI app (custom `co_live_`/`co_test_` API-key auth, 16 REST-hook triggers, one create per write op) and a Make.com blueprint — both generated from the one marketplace-manifests source, bundle-validated locally, with the public-listing submissions recorded as deferred, dashboard-tracked external steps.**

## Performance

- **Duration:** ~37 min
- **Started:** 2026-07-16T21:11:35Z
- **Completed:** 2026-07-16T21:48:16Z
- **Tasks:** 2
- **Files modified:** 17 (+ pnpm-lock.yaml)

## Accomplishments

- New `@contractor-ops/zapier-app`: custom API-key authentication (bearer `co_live_`/`co_test_`), 16 REST-hook triggers mapped 1:1 to the webhook event catalog, and one create per snapshot write operationId — all assembled from `generateZapier`, never hand-authored. An OAuth 2.0 authorization-code variant is scaffolded but not wired.
- Bundle test (the local `zapier validate` equivalent) runs the platform's compile + schema-clean + validate pipeline and asserts every trigger maps to a real catalog event, every action to a real write operationId (count snapshot-derived, zero pre-flip), and the API-key header is wired. 9/9 GREEN.
- Finalized the Make.com blueprint: `apiKey` connection now carries the `Bearer ` prefix; wired the blueprint into the manifests CLI so it is generated + drift-checked from the same OpenAPI snapshot as the collections. Committed `apps/public-api/marketplace/make/blueprint.json` (3 modules, 16 instant triggers). 20/20 marketplace-manifests tests GREEN.
- Pinned `zapier-platform-core@19.0.0` (published 58 days ago, well past the 7-day floor; official Zapier repo/maintainers; no advisory traverses it) — the dep-age wall was clear, not a blocker.
- Recorded the deferred Zapier (2-4wk) + Make (1-2wk) marketplace submissions in EXTERNAL-ENABLEMENT behind `integration.marketplace-{zapier,make}`, dashboard-tracked; the Zapier app README documents install/auth/triggers/actions/submission.

## Task Commits

Each task was committed atomically:

1. **Task 1: Zapier CLI app (auth + triggers + creates) + bundle test** - `82e8b4ac9` (feat)
2. **Task 2: Make blueprint + deferred-submission register rows + README** - `9a5f09447` (feat)

## Files Created/Modified

- `packages/zapier-app/src/index.ts` - App definition: loads the snapshot, assembles auth + `beforeRequest` + triggers + creates via `defineApp`
- `packages/zapier-app/src/authentication.ts` - Custom API-key auth mapper, `addApiKeyHeader` bearer middleware, scaffolded (unwired) OAuth 2.0 variant
- `packages/zapier-app/src/triggers/index.ts` - REST-hook triggers from the generated trigger list (subscribe/unsubscribe/perform/performList + sample)
- `packages/zapier-app/src/creates/index.ts` - Write actions from the generated create list (POST/PATCH perform + dict passthrough inputFields)
- `packages/zapier-app/src/http-method.ts` - Fail-closed narrower from generated method strings to the platform's HTTP-method union
- `packages/zapier-app/src/__tests__/app.test.ts` + `fixtures/openapi.snapshot.fixture.json` - The bundle test + a 6-write fixture
- `packages/zapier-app/{package.json,tsconfig.json,vitest.config.ts,README.md}` - Package scaffold + docs
- `apps/public-api/marketplace/make/blueprint.json` - The committed Make.com blueprint
- `packages/marketplace-manifests/src/cli.ts` - Emit + drift-check the Make blueprint alongside the collections
- `packages/marketplace-manifests/src/generate-make.ts` - `apiKeyPrefix: 'Bearer '` on the connection (new `MakeConnection` type)
- `packages/marketplace-manifests/src/index.ts` - Export the generated Zapier/Make def types for consumers
- `packages/marketplace-manifests/src/__tests__/make-blueprint.test.ts` - Generator shape + committed-artifact shape + no-secret test
- `.planning/EXTERNAL-ENABLEMENT.md` - Reconciled rows #32 (built-now + explicit Zapier/Make submissions) and #34 (narrowed to n8n)

## Decisions Made

- **Validation via core, not raw schema.** `zapier-platform-schema.validateAppDefinition` rejects raw JS `perform` functions ("is not of a type(s) object"). The correct `zapier validate` equivalent is `zapier-platform-core/src/tools/schema` `validateApp`, which serializes functions (via `recurseCleanFuncs`) before schema-checking. The bundle test uses `prepareApp` + `validateApp`. The now-unused direct `zapier-platform-schema` devDep was removed.
- **6-write fixture demonstrates the "6+ actions" design; a writes-hidden case proves the pre-flip posture.** The must-have's "6+ actions" and "0 pre-flip" are reconciled by asserting the create count equals `writeOperationIds(spec).length` for both a 6-write fixture and a reads-only spec.
- **Generated-defs are the single source.** App metadata (keys, nouns, events, method+URL) comes from the generator; only the runtime perform functions are wired in-package.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Enabling] Exported the generated Zapier/Make def types from marketplace-manifests**
- **Found during:** Task 1
- **Issue:** The app needed to import `ZapierAuthentication`/`ZapierTrigger`/`ZapierCreate` (and `MakeModule`/`MakeInstantTrigger`) but `index.ts` only re-exported `ZapierApp`/`MakeBlueprint`.
- **Fix:** Added the type re-exports (additive).
- **Files modified:** packages/marketplace-manifests/src/index.ts
- **Committed in:** 82e8b4ac9

**2. [Rule 2 - Correctness] Fail-closed method/field-type narrowers instead of unsafe `as`**
- **Found during:** Task 1
- **Issue:** The generator emits `method`/`type` as plain `string`; the platform types require literal unions.
- **Fix:** Added `toHttpMethod` (http-method.ts) and `toAuthFieldType` (authentication.ts) that validate + narrow, throwing on unsupported values — no `as` on the values.
- **Files modified:** packages/zapier-app/src/http-method.ts, src/authentication.ts, src/creates/index.ts
- **Committed in:** 82e8b4ac9

**3. [Rule 2 - Correctness] Make apiKey connection carries the Bearer prefix**
- **Found during:** Task 2
- **Issue:** The generated Make connection set `apiKeyHeader: 'Authorization'` but no prefix, so it would send the raw key instead of `Bearer <key>` — the connection would not authenticate against the public API.
- **Fix:** Added `apiKeyPrefix: 'Bearer '` (new `MakeConnection` type).
- **Files modified:** packages/marketplace-manifests/src/generate-make.ts
- **Committed in:** 9a5f09447

**4. [Rule 3 - Blocking] Wired the Make blueprint into the CLI drift-check set**
- **Found during:** Task 2
- **Issue:** The manifests CLI only emitted/drift-checked the Postman/Insomnia collections; per D-01 every committed marketplace artifact must be generated + drift-checked.
- **Fix:** Added the blueprint to `buildArtifacts` (generated from the snapshot + event catalog) and switched the write loop to mkdir per-artifact dir.
- **Files modified:** packages/marketplace-manifests/src/cli.ts
- **Committed in:** 9a5f09447

**5. [Rule 1 - Avoid drift] Reconciled EXTERNAL-ENABLEMENT rows instead of adding duplicates**
- **Found during:** Task 2
- **Issue:** Rows #32 (Zapier/n8n/Make submissions) and #34 (Zapier/n8n live-SDK packages deferred) already existed; the plan asked to "add three rows" for the Zapier + Make submissions + dashboard note, which #32 already covered.
- **Fix:** Enriched #32 to record the built-now Zapier app + Make blueprint and to enumerate (a) Zapier submission, (b) Make submission, (c) dashboard tracking; narrowed #34 to n8n-only (the Zapier live-SDK package is now built).
- **Files modified:** .planning/EXTERNAL-ENABLEMENT.md
- **Committed in:** 9a5f09447

---

**Total deviations:** 5 auto-fixed (2 correctness, 2 enabling/blocking, 1 anti-drift)
**Impact on plan:** All within scope; necessary for a valid, functional, drift-guarded app + a truthful register. No scope creep.

## Issues Encountered

- **Fresh worktree had no node_modules.** Ran a full `pnpm install` (warm cache, ~19s); `zapier-platform-core@19.0.0` installed cleanly under the 7-day floor.
- **Raw-function schema rejection.** Resolved by validating through core's `validateApp` (see Decisions).

## Known Conditional Stubs (intentional, upstream-gated)

- **App actions are zero at runtime now** because the real `apps/public-api/openapi.snapshot.json` does not exist yet (98-11 not executed). This is the documented pre-flip posture — the app is fully functional and its actions appear automatically once the snapshot exposes writes (post 100-09 flip). The bundle test proves both the 6-action design (fixture) and the 0-action pre-flip case.
- **The committed `blueprint.json` (3 modules) is fixture-derived.** The CLI regenerates it from the real snapshot's full write set once it lands; a byte-identical reproduction check confirms the drift primitive works.
- **Trigger subscribe/unsubscribe target the conventional `/v1/webhooks/subscriptions` REST path**, which the public API does not expose yet (webhook subscription management rides the Phase 100 staff surface). The bundle test validates structure, not live calls; live subscription wiring is a deferred enablement step.

## Threat Model Coverage

- **T-101-07-01 (supply-chain dep):** `zapier-platform-core@19.0.0` pinned (58d old), name/repo/maintainers verified official, `pnpm audit` shows no advisory traversing it.
- **T-101-07-02 (phantom actions):** the bundle test asserts every trigger maps to a real catalog event and every action to a real write operationId.
- **T-101-07-03 (embedded secret):** auth is the user-supplied `apiKey`; the make-blueprint test asserts no `co_(live|test)_` literal is embedded.

No new threat surface beyond the plan's register.

## User Setup Required

None for the build. Marketplace **submission** is a deferred external step (Zapier/Make partner accounts) — see EXTERNAL-ENABLEMENT row #32.

## Next Phase Readiness

- Zapier app + Make blueprint are built + validated; ready for the 101-10 close to record the `zapier push` + Make upload submission steps.
- n8n community-node package (101-06) remains deferred pending the `n8n-workflow` dep pin (EXTERNAL-ENABLEMENT #34).
- Documentation-follows-code wiki updates (integrations/{zapier,make} pages, packages catalog) are the 101-10 closure task per the phase plan; not done here.

## Self-Check: PASSED

All 10 created files present on disk; both task commits (`82e8b4ac9`, `9a5f09447`) present in history.

---
*Phase: 101-theme-c-marketplace-listings-developer-experience*
*Completed: 2026-07-16*
