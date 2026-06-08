---
phase: 84-theme-a-us-contractor-profile-fields-en-us-locale
plan: 04
subsystem: gov-api
tags: [usps, address-validation, oauth2, rate-limiter, upstash, zod, fail-open, pino]

# Dependency graph
requires:
  - phase: 84-01
    provides: USPS_CLIENT_ID / USPS_CLIENT_SECRET optional env (absent locally → fail-open)
  - phase: 84-00
    provides: usps-client.test.ts RED scaffold (Wave 0) locking the validateAddress contract
  - phase: 57-02
    provides: GovApiClient + GovApiRateLimiter + hmrc-vat-client.ts template (OAuth2 cache, single-flight, safeParse, fail-open)
provides:
  - "UspsAddressClient.validateAddress(input) → { verified, status: verified|unverified|unavailable, normalized? }"
  - "GLOBAL-keyed (usps-global) 60/hr sliding-window limiter contract (UspsRateLimiter) + USPS_RATE_LIMIT const"
  - "sha256-keyed address-result cache contract (UspsAddressCache)"
  - "usps-address.schema.ts: OAuth token + /addresses/v3/address Zod schemas (safeParse boundary)"
affects: [84-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fail-open advisory external adapter: every failure path (throttle/5xx/network/Redis-down/malformed/missing-creds) resolves to { verified:false }, NEVER throws to the save path (D-03)"
    - "FIXED GLOBAL rate-limit identifier ('usps-global') for a per-credential global cap — diverges from HMRC's per-org keying (Pitfall 4)"
    - "Dependency-injected fetch/rateLimiter/cache so a gov-API adapter is fully unit-testable with no live creds or Redis"

key-files:
  created:
    - packages/gov-api/src/clients/usps-client.ts
    - packages/gov-api/src/schemas/usps-address.schema.ts
  modified:
    - packages/gov-api/src/clients/index.ts
    - packages/gov-api/src/index.ts
    - packages/gov-api/src/clients/__tests__/usps-client.test.ts

key-decisions:
  - "Rate limiter keyed on FIXED GLOBAL 'usps-global', config { maxRequests:60, windowMs:3_600_000 } — NOT organizationId; the 60/hr cap is per-credential global, per-org bucketing would over-permit N×60/hr and blow the cap (Pitfall 4, D-03 correction)"
  - "Fail-open advisory (D-03): self-throttle / 5xx / network / Redis-down / safeParse-fail / missing-creds → { verified:false, status:'unavailable'|'unverified' } without throwing — USPS NEVER blocks a contractor save"
  - "DI-based standalone client (not a GovApiClient subclass) — the Plan 00 RED test locks an injected { fetch, rateLimiter, cache } constructor incompatible with GovApiClient's (config, environment); HMRC behaviours (token cache TTL-5min, single-flight, safeParse) are mirrored in-class"
  - "Address-result cache keyed by sha256 of the canonical (trimmed, upper-cased, ordered) address so casing/whitespace variants share one USPS call and respect the 60/hr budget"
  - "DPVConfirmation Y/D/S ⇒ verified; everything else reachable ⇒ unverified (with normalized still returned when present)"

patterns-established:
  - "Pattern: fail-open advisory gov-API adapter — never throws to the caller; status tri-state verified|unverified|unavailable distinguishes 'no match' from 'not consulted'"
  - "Pattern: global (per-credential) rate-limit bucketing vs HMRC per-org — choose the key by where the real cap lives"

requirements-completed: [US-FIELD-03]

# Metrics
duration: 9min
completed: 2026-06-08
commits:
  - 69381ea8
---

# Phase 84 Plan 04: USPS Address-Validation Adapter Summary

USPS Addresses 3.0 adapter (`UspsAddressClient`) delivering US-FIELD-03 / D-03: OAuth2
client-credentials with a TTL−5min token cache + single-flight refresh, a Zod `safeParse`
boundary, an Upstash sliding-window limiter keyed on a FIXED GLOBAL id (`usps-global`,
60/hr), a sha256-keyed address-result cache, and fail-open advisory behaviour on every
failure path. Turns the Plan 00 RED `usps-client.test.ts` GREEN (6/6).

## What Was Built

- **`packages/gov-api/src/clients/usps-client.ts`** — `UspsAddressClient` with a single
  public method `validateAddress(input) → { verified, status, normalized? }`:
  - OAuth2 client-credentials POST `/oauth2/v3/token`, in-memory token cache (8h TTL minus
    a 5-minute early-refresh buffer) with single-flight refresh (concurrent expiries share
    one in-flight POST — no IDP stampede). One token POST across two `validateAddress` calls.
  - GET `/addresses/v3/address` with `streetAddress/secondaryAddress/city/state/ZIPCode/ZIPPlus4`
    query params.
  - **GLOBAL** rate-limit gate: `rateLimiter.checkLimit('usps-global')`, `USPS_RATE_LIMIT =
    { maxRequests: 60, windowMs: 3_600_000 }`. NEVER keyed on `organizationId` (Pitfall 4).
  - sha256-keyed address-result cache (canonical = trimmed, upper-cased, ordered components)
    so a repeat save of the same address serves from cache with no second upstream fetch.
  - Zod `safeParse` boundary on both the token and the address response; malformed bodies →
    `unverified`, never an unsafe `as` or a thrown `SyntaxError`.
  - **Fail-open advisory (D-03)** on every failure: self-throttle, 5xx, network error,
    limiter/Redis failure, safeParse failure, or missing credentials → `{ verified:false, status }`
    WITHOUT throwing. USPS can never block a contractor save.
  - `@contractor-ops/logger` (Pino) throughout; no `console.*`.
- **`packages/gov-api/src/schemas/usps-address.schema.ts`** — Zod schemas for the OAuth
  token response and the `/addresses/v3/address` response (normalized `address` +
  `additionalInfo` with `DPVConfirmation/business/vacant/centralDeliveryPoint`,
  `.passthrough()` so USPS adding fields is non-breaking).
- **Barrel exports** wired through `clients/index.ts` and the package `index.ts`.

## Status Semantics

- `verified` — DPVConfirmation `Y`/`D`/`S` (CASS-confirmed deliverability), `normalized` set.
- `unverified` — USPS reachable but no confirmed match, or a 4xx / malformed / safeParse-fail.
- `unavailable` — USPS not consulted (self-throttle, 5xx, network/Redis down, missing creds).
  Advisory only; the on-save orchestration (Plan 05) proceeds regardless.

## Deviations from Plan

### [Rule 3 - Blocking] DI-based standalone client instead of GovApiClient subclass

- **Found during:** Task 1 (reconciling the Plan 00 RED test with the plan's "subclass
  GovApiClient" wording).
- **Issue:** The locked RED test (`usps-client.test.ts`, authored in Plan 00) constructs the
  client with injected `{ clientId, clientSecret, baseUrl, fetch, rateLimiter, cache }`. That
  constructor shape is incompatible with `GovApiClient`'s `(config, environment)` signature
  and its private base-class `fetch`/limiter wiring. The RED test is the authoritative,
  non-negotiable RED→GREEN contract.
- **Fix:** Implemented `UspsAddressClient` as a standalone DI class that *mirrors* every HMRC
  behaviour the plan requires (OAuth2 client-credentials, token cache TTL−5min, single-flight
  refresh, Zod `safeParse` boundary, GLOBAL-keyed limiter, fail-open). The `UspsRateLimiter` /
  `UspsAddressCache` interfaces are structurally satisfied in production by `GovApiRateLimiter`
  (Upstash) and an Upstash-Redis cache wrapper (wired in Plan 05). No behaviour from the plan
  intent was dropped.
- **Files:** packages/gov-api/src/clients/usps-client.ts
- **Commit:** 69381ea8

### [Rule 3 - Blocking] Fixed `RequestInfo` type in the Plan 00 RED test

- **Found during:** Task 1 verification (`pnpm --filter @contractor-ops/gov-api typecheck`).
- **Issue:** The RED test typed its fetch mock param as `RequestInfo | URL`. `RequestInfo`
  is a DOM global; the gov-api tsconfig uses `lib: ["ES2022"]` + `types: ["node"]` (no DOM
  lib), so `tsc` errored `TS2552: Cannot find name 'RequestInfo'`, blocking the
  acceptance-criterion "gov-api typecheck clean".
- **Fix:** Changed the param type to `Request | string | URL` (all Node globals). The mock
  only ever calls `String(input)`, so behaviour is unchanged; tests still 6/6 GREEN.
- **Files:** packages/gov-api/src/clients/__tests__/usps-client.test.ts
- **Commit:** 69381ea8

## Out-of-Scope (Deferred)

Logged to `deferred-items.md` (Phase 84): two pre-existing `biome check` findings in
gov-api files NOT touched by this plan — `src/client.ts:288` cognitive-complexity (Phase 57
base-class retry loop) and `src/schemas/vies.schema.ts:42` unused suppression (Phase 57
VIES). Belong to the gov-api base / VIES owners. 84-04's own new files are lint-clean.

## Verification

- `pnpm --filter @contractor-ops/gov-api test src/clients/__tests__/usps-client.test.ts` →
  **6/6 GREEN** (token cache one-POST, GLOBAL self-throttle → unverified no-throw, Redis-down
  fail-open, cache hit avoids second fetch, malformed-safeParse → unverified, 5xx → unverified).
- `pnpm --filter @contractor-ops/gov-api typecheck` → **clean**.
- `pnpm --filter @contractor-ops/gov-api test` (full suite) → **105/105 GREEN** (no regression).
- Real USPS round-trip is manual-UAT post-deploy (84-VALIDATION manual row); LOCAL-ONLY has
  no creds → adapter returns `unavailable` (fail-open), never crashes.

## Known Stubs

None. Production credentials are optional-by-design (84-01); their absence yields the
documented `unavailable` advisory result, not a stub.

## Next

Plan 05 wires `validateAddress` into the contractor on-save path (advisory `uspsVerified`
flag) and constructs the production `UspsAddressClient` with a real `GovApiRateLimiter`
(`usps-global`) and an Upstash-Redis-backed address cache, reading `USPS_CLIENT_ID/SECRET`
from optional env.

## Self-Check: PASSED

- FOUND: packages/gov-api/src/clients/usps-client.ts
- FOUND: packages/gov-api/src/schemas/usps-address.schema.ts
- FOUND: .planning/milestones/v7.0-phases/84-.../84-04-SUMMARY.md
- FOUND commit: 69381ea8
