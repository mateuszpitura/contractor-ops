---
phase: 101-theme-c-marketplace-listings-developer-experience
plan: 09
subsystem: ui
tags: [web-vite, landing, marketplace, status-page, sandbox, trpc, i18n, feature-flags]

# Dependency graph
requires:
  - phase: 101-03
    provides: MarketplaceListing model + marketplaceListing router (list/update state machine)
  - phase: 101-05
    provides: public /status.json aggregator + IncidentReport router
  - phase: 101-02
    provides: apiKey.createSandboxKey mutation (fail-closed co_test_ sandbox tier)
provides:
  - Settings -> Developer marketplace listing-status dashboard (three listings, state machine advance, version pin, review feedback)
  - Developer-surface "Create sandbox key" action (reveal-once co_test_ key + 100/day + sandbox-org note)
  - Public status page at apps/landing /status over /status.json (operational|degraded|down + incident history)
  - Minimal vitest test harness for apps/landing (first test runner in that app)
affects: [101-10-docs, external-enablement]

# Tech tracking
tech-stack:
  added: [vitest+jsdom+@testing-library harness for apps/landing]
  patterns:
    - "web-vite container+hooks: use-marketplace-tab is the sole tRPC boundary; presentational listing-card + tested MarketplaceTabView"
    - "ship-dark UI: marketplace section flag-gated (module.developer-portal), sandbox action flag-gated (module.api-sandbox); data hook mounted inside the flag gate so no query fires while dark"
    - "landing static-export status page: client-side fetch of /status.json with loading/error/empty states"
    - "status conveyed by text + icon + color (not color alone); role=status/alert; useId aria-labelledby"

key-files:
  created:
    - apps/web-vite/src/components/settings/hooks/use-marketplace-tab.ts
    - apps/web-vite/src/components/settings/marketplace-tab.tsx
    - apps/web-vite/src/components/settings/marketplace/listing-card.tsx
    - apps/web-vite/src/components/settings/__tests__/marketplace-tab.test.tsx
    - apps/landing/src/app/status/page.tsx
    - apps/landing/src/app/status/status-view.tsx
    - apps/landing/src/app/status/__tests__/status.test.tsx
    - apps/landing/vitest.config.ts
    - apps/landing/src/test/setup.ts
  modified:
    - apps/web-vite/src/components/settings/api-keys-tab.tsx
    - apps/web-vite/src/components/settings/hooks/use-api-keys-tab.ts
    - apps/web-vite/messages/{en,de,pl,ar}.json
    - apps/landing/package.json
    - .env.example

key-decisions:
  - "Marketplace dashboard mounted inside the ApiKeysTab container (the Settings -> Developer surface) rather than a new top-level settings tab — honors files_modified while staying reachable (Shield S1 wired)"
  - "UI transition map (LISTING_NEXT_STATUSES) mirrors the server state machine only to shape the advance affordance; the router re-validates every transition (single enforcement source)"
  - "Landing status page is a client-fetch surface because apps/landing is a static export (output: 'export') — a build-time server fetch would bake a stale status"

patterns-established:
  - "Flag-gate the data-hook-bearing component (not just its children) so a default-off module.* flag prevents any dark tRPC query/side-effect"
  - "apps/landing test harness: minimal vitest.config.ts + src/test/setup.ts + `test` script reusing already-locked workspace dep versions"

requirements-completed: [INTEG-MARKETPLACE-01, INTEG-DX-03, INTEG-DX-04]

# Metrics
duration: 31min
completed: 2026-07-16
---

# Phase 101 Plan 09: Marketplace dashboard + sandbox-key action + public status page Summary

**Built the two front-ends over the shipped 101-03/101-05/101-02 backends: the internal marketplace listing-status dashboard + reveal-once sandbox-key action in Settings -> Developer (web-vite container+hooks), and the public /status page in apps/landing over the /status.json aggregator — both wired to real routers, both ship-dark behind their phase flags.**

## Performance

- **Duration:** 31 min
- **Started:** 2026-07-16T21:12:10Z
- **Completed:** 2026-07-16T21:43:13Z
- **Tasks:** 2 (Task 2 is a human-verify checkpoint — built to completion, visual pass deferred)
- **Files modified/created:** 18

## Accomplishments

- **Marketplace listing-status dashboard** — `use-marketplace-tab.ts` is the sole tRPC boundary (`marketplaceListing.list`/`update`); `marketplace-tab.tsx` renders loading/empty/error + three `listing-card`s with a WCAG status badge (icon+text+color), version pin, last review feedback, listing URL, and a state-machine advance control. Enterprise-tier + `module.developer-portal` flag gated (dark by default; the data hook only fires when the flag is on).
- **Sandbox-key action** — the Developer surface gains a "Create sandbox key" button (behind `module.api-sandbox`) calling `apiKey.createSandboxKey`, revealing the one-time `co_test_` key with the sandbox-org note + the 100/day cap, reveal-once (never re-fetchable).
- **Public status page** — `apps/landing /status` fetches `/status.json`, renders the three coarse component states (operational/degraded/down) with text+icon+color, incident history, an all-clear empty state, plus loading + fetch-error(+retry) states. No tenant data (only `/status.json`).
- **Green tests** — `marketplace-tab.test.tsx` 8/8; landing `status.test.tsx` 9/9; api-keys regression 8/8; web-vite + landing typecheck clean; `check:web-vite-data-layer` OK; `lint:no-breadcrumbs` OK; biome clean on new files.

## Task Commits

1. **Task 1: Marketplace dashboard + sandbox-key action** - `33162d57b` (feat)
2. **Task 2: Public status page (apps/landing) + test harness** - `c2adec9f6` (feat)

## Files Created/Modified

- `apps/web-vite/src/components/settings/hooks/use-marketplace-tab.ts` - sole tRPC boundary: list/update + the UI transition map
- `apps/web-vite/src/components/settings/marketplace-tab.tsx` - flag-gated container + tested `MarketplaceTabView` (loading/empty/error/list)
- `apps/web-vite/src/components/settings/marketplace/listing-card.tsx` - presentational listing card (status badge, version, feedback, advance)
- `apps/web-vite/src/components/settings/api-keys-tab.tsx` - sandbox-key button + reveal-once dialog; mounts `<MarketplaceTab />` in the Developer container
- `apps/web-vite/src/components/settings/hooks/use-api-keys-tab.ts` - `useCreateSandboxKeyDialog` (createSandboxKey boundary)
- `apps/web-vite/messages/{en,de,pl,ar}.json` - `Settings.marketplace.*` + `Settings.apiKeys.sandbox.*` keys (parity across all four locales; native review deferred)
- `apps/landing/src/app/status/{page,status-view}.tsx` + `__tests__/status.test.tsx` - the public status page + test
- `apps/landing/vitest.config.ts`, `apps/landing/src/test/setup.ts`, `apps/landing/package.json` - minimal test harness
- `.env.example` - `NEXT_PUBLIC_PUBLIC_API_URL` (status-page fetch base; DNS deferred)

## Decisions Made

- **Marketplace surface placement:** mounted `<MarketplaceTab />` inside the `ApiKeysTab` container (the Settings -> Developer surface) rather than adding a new top-level settings tab. This honors the plan's `files_modified` (which excluded `settings-tabs.ts` / `settings/index.tsx`) while keeping the dashboard reachable in-product (Shield S1). The container composes the two sections; the api-keys `View` test stays isolated.
- **Transition map ownership:** `LISTING_NEXT_STATUSES` in the hook mirrors the server state machine only to decide which advance options to show; the `marketplaceListing.update` router re-validates every transition, so the UI map can never mismark a listing (single enforcement source).
- **Client-fetch status page:** `apps/landing` builds with `output: 'export'` (static), so the status page fetches `/status.json` on the client with loading/error states rather than server-rendering the initial state — a build-time fetch would bake a stale status.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] i18n message-file path corrected**
- **Found during:** Task 1
- **Issue:** The plan's `files_modified` listed `apps/web-vite/src/i18n/messages/en/settings.json` (a per-namespace path that does not exist). The real structure is monolithic per-locale files at `apps/web-vite/messages/{en,de,pl,ar,en-US}.json` with a `Settings` top-level key.
- **Fix:** Added `Settings.marketplace.*` + `Settings.apiKeys.sandbox.*` to en.json and to de/pl/ar for parity (en-US inherits from en via the fallback-aware parity peer). `i18n:parity` NEW-drift-free by construction.
- **Committed in:** `33162d57b`

**2. [Rule 3 - Blocking] apps/landing had no test runner**
- **Found during:** Task 2
- **Issue:** The plan requires `apps/landing/.../status.test.tsx` + `pnpm --filter @contractor-ops/landing test status`, but the landing app had no vitest/test script.
- **Fix:** Added a minimal `vitest.config.ts` + `src/test/setup.ts` + `test`/`test:watch` scripts + devDeps (`vitest@4.1.5`, `jsdom@29.1.1`, `@testing-library/{react,dom,jest-dom}`, `@vitejs/plugin-react`) — all reusing versions already locked/vetted for web-vite (no new registry fetch; not a package-legitimacy concern). Greened `status.test.tsx` (9/9).
- **Committed in:** `c2adec9f6`

**3. [Rule 3 - Blocking] Worktree missing node_modules / package dist / generated i18n types**
- **Found during:** Task 1 verification
- **Issue:** The fresh worktree had no `node_modules`, no built `packages/*/dist` (gitignored), and no `src/generated/i18n/keys.d.ts` (gitignored) — so tests + typecheck could not resolve `@contractor-ops/ui` or the `TranslationKey` type.
- **Fix:** `pnpm install --prefer-offline` (17.5s) + `pnpm turbo run build --filter=@contractor-ops/web-vite^...` (17/17 cache hits, restored dist) + `pnpm i18n:types` (regenerated keys incl. the new marketplace/sandbox keys). All are gitignored build artifacts — none committed.
- **Verification:** web-vite typecheck clean (proves the new `marketplaceListing.*` / `apiKey.createSandboxKey` tRPC calls resolve).

### Non-blocking path adjustments

- **Status page location:** created at `apps/landing/src/app/status/` (the app's real `src/app` router root) rather than the plan's `apps/landing/app/status/`. Root-level, non-localized route per the plan's path intent (status pages are English-only technical surfaces).

---

**Total deviations:** 3 blocking auto-fixes (all environment/path corrections) + 2 non-blocking path adjustments.
**Impact on plan:** No scope creep. Both surfaces built and wired exactly as specified; the fixes only made the required tests/typecheck runnable in the worktree.

## Shield Verdict

- **S1 Wired:** PASS — the marketplace dashboard calls `marketplaceListing.list`/`update` through `use-marketplace-tab` (typecheck confirms the tRPC types resolve) and is reachable via the Developer tab; the sandbox action calls `apiKey.createSandboxKey`; the status page fetches the real `/status.json`. No built-unwired surface.
- **T-101-09-01 (EoP):** mitigated — marketplace tab is Enterprise-tier + `module.developer-portal` gated; the `admin:marketplace` router re-check (101-03) is unchanged and authoritative.
- **T-101-09-02 (Info disclosure):** mitigated — the status page renders only `/status.json` (no tenant field is fetched or displayed); test asserts the incident/component shape only.
- **T-101-09-03 (one-time key):** mitigated — sandbox key is reveal-once (mirrors the live-key create flow) and never re-fetchable.
- **Verify run:** marketplace 8/8, api-keys 8/8, landing status 9/9, web-vite typecheck clean, landing typecheck clean, check:web-vite-data-layer OK, lint:no-breadcrumbs OK, biome clean.
- **Residual risk:** none (code); the human visual pass is deferred (see below).

## Known Stubs

None — both surfaces are wired to real backends; no placeholder/mock data paths.

## Human-Verify Checkpoint (Task 2) — deferred visual pass

Per the executor directive for this `autonomous: false` plan, Task 2 was built to completion + automated checks run; the **human visual pass was not performed** (autonomous run). Record for **EXTERNAL-ENABLEMENT #10**:

- **What to verify:** the marketplace dashboard (Settings -> Developer, with `module.developer-portal` on) and the public status page (`/status`, with `module.public-status-page` on) across light/dark, mobile, and RTL (ar) — status colors, badge legibility, incident layout, advance control.
- **Automated coverage already in place:** status conveyed by text+icon+color (not color alone); `role=status`/`role=alert`; `useId` aria-labelledby; keyboard-focusable controls; loading/empty/error states; 9/9 + 8/8 unit tests.
- **Deferred infra:** the public `status.contractor-ops.{tld}` hostname is a DNS/Render step (not a build blocker); `NEXT_PUBLIC_PUBLIC_API_URL` documented in `.env.example`.

## Issues Encountered

- The worktree started with no `node_modules` and gitignored `dist`/generated-types — resolved via install + turbo (cache-hit) build + `i18n:types` (see Deviation 3). Turbo's shared cache made the dependency build a 17/17 cache replay (~0.3s).

## Next Phase Readiness

- Both UIs ship-dark behind their flags; ready for the 101-10 documentation-follows-code pass (wiki `domains/developer-experience.md` + `structure/web-vite-domains.md` + `integrations/*` — explicitly this phase's 101-10 scope, deferred here per the phase plan) and the deferred human visual pass.
- No STATE.md / ROADMAP.md updates were made (per the executor directive for this plan).

## Self-Check: PASSED

All 9 created source files + the SUMMARY exist on disk; both task commits (`33162d57b`, `c2adec9f6`) are present in the branch history.

---
*Phase: 101-theme-c-marketplace-listings-developer-experience*
*Completed: 2026-07-16*
