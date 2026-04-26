---
phase: 61
plan: 05
subsystem: einvoice
tags: [wave-2, storecove, peppol, capability-cache, format-discriminator, xrechnung, d-09, d-11]
dependency-graph:
  requires:
    - "61-01 · STORECOVE_CII_XRECHNUNG_DOC_TYPE_ID literal, PeppolParticipant.supportsXRechnungCii + lastCapabilityCheckAt columns, PeppolCapabilityCache model"
    - "61-02 · CII XML envelope the Storecove adapter ships via cii-xrechnung format"
  provides:
    - "EInvoiceFormat discriminator on TransmitInvoiceParams (D-09)"
    - "StorecoveAdapter.lookupParticipantCapabilities + adapter format-dispatch"
    - "storecoveDiscoveryResponseSchema + extractDocumentTypes normaliser"
    - "packages/validators: peppolSchemeIdSchema, peppolParticipantValueSchema, peppolLookupCapabilitiesSchema"
    - "getCapabilitiesWithCache service (6h TTL, per-org)"
    - "assertSenderParticipantActive + assertReceiverAcceptsXRechnung pre-flight helpers"
    - "peppolRouter.lookupCapabilities query + peppolRouter.listParticipants query"
    - "buildStorecoveAdapterForOrg credential-aware factory"
    - "Plan 07 UI error code mapping targets PEPPOL_PARTICIPANT_NOT_ACTIVE / PARTICIPANT_NOT_REACHABLE / PEPPOL_NOT_CONNECTED"
  affects:
    - "Plan 61-06 — einvoice.send mutation calls the pre-flight gates + adapter.transmitInvoice with format='cii-xrechnung'"
    - "Plan 61-07 — Settings page calls peppolRouter.lookupCapabilities + listParticipants; Invoice tab consumes error codes verbatim"
tech-stack:
  added:
    - "no new runtime deps"
  patterns:
    - "Format-discriminated adapter (re-uses Phase 57 format adapter precedent)"
    - "6h TTL content-addressed capability cache (CONTEXT D-11)"
    - "Error-code pre-flight gates (literal string codes mapped 1:1 to i18n keys)"
    - "SSRF-pinned sandbox/production base URL selection via credential blob"
    - "Per-org credential resolution through IntegrationConnection.credentialsRef"
key-files:
  created:
    - packages/api/src/services/peppol-capability.ts
    - packages/api/src/services/peppol-adapter-factory.ts
    - packages/api/src/services/__tests__/peppol-capability.test.ts
  modified:
    - packages/einvoice/src/asp/types.ts
    - packages/einvoice/src/asp/storecove/adapter.ts
    - packages/einvoice/src/asp/storecove/client.ts
    - packages/einvoice/src/asp/storecove/schemas.ts
    - packages/einvoice/src/index.ts
    - packages/einvoice/src/__tests__/storecove-adapter.test.ts
    - packages/validators/src/peppol.ts
    - packages/validators/src/index.ts
    - packages/api/src/routers/peppol.ts
    - packages/api/src/routers/__tests__/peppol.test.ts
key-decisions:
  - "EInvoiceFormat lives canonically in packages/einvoice/src/asp/types.ts as a plain discriminated union. The Zod mirror in profiles/xrechnung-de/schemas.ts continues to exist for Plan 02 router input — both shapes are structurally identical, cross-validated by intent, not by a runtime guard."
  - "Storecove /discovery/receives response shape is MEDIUM-confidence — Zod schema accepts BOTH flat documentTypes[] AND nested processes[].documentTypes[] variants with .passthrough() so a future Storecove-side addition does not hard-break the adapter."
  - "404 from /discovery/receives returns documentTypes:[] (not a thrown error) so the cache still writes a fresh row and the pre-flight helper can translate empty → PARTICIPANT_NOT_REACHABLE uniformly."
  - "Error codes are literal strings (PEPPOL_PARTICIPANT_NOT_ACTIVE, PARTICIPANT_NOT_REACHABLE, PEPPOL_NOT_CONNECTED) thrown via new Error(code) so Plan 07's i18n map is a direct key-lookup with zero parsing."
  - "Adapter factory reads credentials from IntegrationConnection.credentialsRef (existing peppol.connect writer) — no new env var, no new config file. Sandbox/production base URL is selected from the persisted configJson.environment, which was validated via Zod at connect time."
  - "Capability cache upsert key is (organizationId, schemeId, value) — matching the Prisma @@unique. Cross-tenant isolation is structurally impossible at this layer."
requirements-completed: [EINV-06]
metrics:
  duration_min: 18
  completed_date: "2026-04-14"
  tasks_completed: 2
  commits:
    - hash: "e9c1b1eb"
      subject: "test(61-05): RED - format discriminator + lookupParticipantCapabilities"
    - hash: "e832f494"
      subject: "feat(61-05): GREEN - format discriminator + Storecove capability lookup"
    - hash: "a78c845b"
      subject: "test(61-05): RED - peppol-capability service cache + pre-flight helpers"
    - hash: "5392ba37"
      subject: "feat(61-05): GREEN - peppol capability service + router procedures + pre-flight gates"
---

# Phase 61 Plan 05: Storecove format discriminator + capability cache + pre-flight gates

## One-Liner

Storecove adapter now carries a `format` discriminator routing CII-XRechnung / UBL-PINT-AE / UBL Peppol-BIS-3 payloads through the single `/document_submissions` endpoint (D-09); `lookupParticipantCapabilities` probes the Peppol SMP with a 6h-TTL `PeppolCapabilityCache` + per-org isolation; `peppolRouter.lookupCapabilities` + `listParticipants` surface the results to the UI; and `assertSenderParticipantActive` + `assertReceiverAcceptsXRechnung` throw the precise `PEPPOL_PARTICIPANT_NOT_ACTIVE` / `PARTICIPANT_NOT_REACHABLE` error codes Plan 07 maps 1:1 to i18n.

## Performance

- **Duration:** 18 min
- **Completed:** 2026-04-14
- **Tasks:** 2 / 2
- **Files touched:** 11 (3 created, 8 modified)
- **Commits on branch:** 4 (2 RED + 2 GREEN)

## Accomplishments

- `EInvoiceFormat` discriminated union on `TransmitInvoiceParams` — backwards-compatible (`format` is optional, legacy callers with only `documentTypeId` untouched). 44/44 peppol-ae tests zero-regression.
- Storecove adapter: `transmitInvoice` dispatches to `STORECOVE_CII_XRECHNUNG_DOC_TYPE_ID` / `PINT_AE_DOCUMENT_TYPE_ID` / `UBL_PEPPOL_BIS_3_DOC_TYPE_ID` per format. Adds `lookupParticipantCapabilities` with 404→empty-list semantics and full rate-limit + audit-log integration via existing deps.
- Zod `storecoveDiscoveryResponseSchema` + `extractDocumentTypes` normalise both flat and nested Storecove discovery response variants into a single `string[]`.
- `packages/api/src/services/peppol-capability.ts`: `getCapabilitiesWithCache` (cache read → adapter fetch → upsert) with 6h TTL, forceRefresh bypass, cross-tenant-isolated reads/writes. `supportsXRechnungCii` pure predicate. `assertSenderParticipantActive` / `assertReceiverAcceptsXRechnung` pre-flight gates.
- `peppolRouter.lookupCapabilities`: `requirePermission({ settings: ['read'] })`-gated query. Side-effect: mirrors `supportsXRechnungCii` + `lastCapabilityCheckAt` onto the org's own `PeppolParticipant` row when the lookup matches.
- `peppolRouter.listParticipants`: scoped to org for Plan 07 Settings UI.
- `buildStorecoveAdapterForOrg` factory: pulls per-org credentials from `IntegrationConnection.credentialsRef` (existing `peppol.connect` writer), pins base URL to sandbox / production literal per the persisted `environment` field — SSRF-safe.
- `packages/validators`: adds `peppolSchemeIdSchema` (`/^\d{4}$/`), `peppolParticipantValueSchema` (1-64 chars), `peppolLookupCapabilitiesSchema` (`{schemeId, value, forceRefresh?}`).

## Test Coverage

| Suite | New | Total Green | Notes |
|-------|-----|-------------|-------|
| `packages/einvoice` storecove-adapter.test.ts | +5 | 30 / 30 | 9 pre-existing + 16 parallel-agent + 5 Plan 05 |
| `packages/einvoice` peppol-ae regression | 0 | 44 / 44 | Zero regression |
| `packages/api` peppol-capability.test.ts | +14 | 14 / 14 | TTL fresh/stale/forceRefresh, multi-tenant, predicates, pre-flight gates |
| `packages/api` peppol.test.ts (router) | +5 | 16 / 16 | lookupCapabilities happy + UBL-only negative + PEPPOL_NOT_CONNECTED + own-participant mirror + listParticipants tenant-scope |
| `packages/validators` peppol | +0 | 27 / 27 | Pre-existing suite unaffected |

## Task Commits

1. **Task 1 RED — format discriminator + lookupParticipantCapabilities tests** — `e9c1b1eb` (test)
2. **Task 1 GREEN — adapter + schemas + types + client + validators + re-exports** — `e832f494` (feat)
3. **Task 2 RED — peppol-capability service tests** — `a78c845b` (test)
4. **Task 2 GREEN — capability service + router procedures + adapter factory** — `5392ba37` (feat)

## Plan 05 SUMMARY-specific outputs (per PLAN.md <output>)

### Resolved `STORECOVE_CII_XRECHNUNG_DOC_TYPE_ID` literal

**Status:** STILL pending sandbox verification — `STORECOVE_API_KEY` remains unset in local env (the 61-01 blocker has not been cleared; Plan 03 also ran without a key per `582bb1b6` / `chore(61-03): populate KoSIT validator-bundle + test fixtures`). The committed literal remains:

```
urn:cen.eu:en16931:2017::CrossIndustryInvoice##urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0::2.1
```

No one-off probe script was created (no key to use it with). The in-source `PENDING sandbox verification` comment in `packages/einvoice/src/profiles/xrechnung-de/constants.ts` is preserved unchanged. Plan 06's first `einvoice.send` integration run against the sandbox is the first opportunity to confirm the literal — if Storecove rejects it with a 422 listing the authoritative doc-type IDs, patch the constant in-place.

### Storecove discovery response shape — observed vs Zod-allowed variants

- **Zod schema accepts:** `{ documentTypes: string[] }` (flat) OR `{ processes: [{ documentTypes: string[] }, ...] }` (nested-per-process) — both behind `.passthrough()` so unknown Storecove fields survive.
- **Observed:** Not yet — no live round-trip possible without `STORECOVE_API_KEY`. The test fixture simulates the nested form (which matches the Peppol-BIS standard discovery shape) and the 404 path.
- **Contingency:** If a third variant surfaces (e.g. `{ supported_document_types: [...] }`), extend `storecoveDiscoveryResponseSchema` + `extractDocumentTypes` — the whole normalisation is a single 8-line pure function.

### TTL rationale — 6h confirmed (CONTEXT D-11)

6 h balances freshness against Storecove's per-org rate budget. SMP participant registrations rarely change — a buyer onboarding a new document type is a multi-hour SMP propagation event anyway, so a 6h staleness window never produces a user-visible false "cannot send" in practice. Force-refresh is available on demand (admin-gated via `requirePermission({ settings: ['read'] })`, same gate as the base lookup — Plan 07 may upgrade to `['update']` for the force-refresh path alone).

Alternative considered: 24h. Rejected because a mid-day SMP change would only propagate to the UI after an explicit force-refresh click, which confuses the "why is the send button still red?" flow.

### Adapter retry pitfalls on 429 / 5xx

- **429 rate limit:** NOT hit in this plan's code path — the adapter's `checkRateLimit` runs against our own `GovApiRateLimiter` bucket BEFORE the HTTP call. A genuine Storecove 429 (e.g. account-wide burst) would surface as a `StorecoveApiError` with `statusCode: 429`; the capability-lookup method propagates it as-is (only 404 is swallowed). Plan 06's send mutation should translate 429 to a retryable status on the `EInvoiceLifecycle` FSM.
- **5xx:** Propagated as-is from `getDiscoveryReceives` — callers retry at their own cadence. The cache is NOT written on a 5xx (we only upsert after a successful adapter return), so a transient outage does not poison the cache with empty document-types.

### Pre-flight latency measurement

Unit tests use an in-memory Prisma double, so latency numbers are microsecond-scale and not meaningful. Real-world measurement deferred to Plan 06 integration run when `STORECOVE_API_KEY` is available. Expected budget (per Storecove docs, typical SMP lookup): **~400-800 ms uncached**, **<1 ms cached** (single Prisma `findUnique` against an indexed column).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Adapter-test-file path mismatch**

- **Found during:** Task 1 RED read-first.
- **Issue:** PLAN.md `<files>` block references `packages/einvoice/src/asp/storecove/__tests__/adapter.test.ts`, but the canonical existing Storecove adapter test file is `packages/einvoice/src/__tests__/storecove-adapter.test.ts` (one directory up).
- **Fix:** Extended the existing file in place (do NOT replace). A parallel agent concurrently added ~13 rate-limit / audit-log tests to the same file — I kept all of them untouched and appended my 5 Plan 05 tests after them. Net: 5 new Plan 05 tests + the parallel agent's tests all live together, 30/30 green.
- **Files modified:** `packages/einvoice/src/__tests__/storecove-adapter.test.ts`.
- **Committed in:** `e9c1b1eb` (Task 1 RED).

**2. [Rule 2 — Missing critical] `EInvoiceFormat` type-name collision**

- **Found during:** Task 1 GREEN re-export.
- **Issue:** Plan 02 already shipped a Zod-inferred `EInvoiceFormat` at `packages/einvoice/src/profiles/xrechnung-de/schemas.ts` (re-exported from package root). My new plain TypeScript union in `asp/types.ts` collided on import.
- **Fix:** Re-exported `asp/types.ts`'s version as `AspEInvoiceFormat` from the package root; left the Zod-inferred `EInvoiceFormat` export as the primary public surface. Both shapes are structurally identical so callers can use either interchangeably.
- **Files modified:** `packages/einvoice/src/index.ts`.
- **Committed in:** `e832f494` (Task 1 GREEN).

**3. [Rule 3 — Blocking] `FAILED_PRECONDITION` is not a tRPC error code**

- **Found during:** Task 2 GREEN typecheck.
- **Issue:** Used `TRPCError { code: 'FAILED_PRECONDITION' }` for the `PEPPOL_NOT_CONNECTED` surface; tRPC's `TRPC_ERROR_CODE_KEY` union only allows `PRECONDITION_FAILED`.
- **Fix:** Changed to `PRECONDITION_FAILED` (same HTTP 412 semantic, correct tRPC spelling).
- **Files modified:** `packages/api/src/routers/peppol.ts`.
- **Committed in:** `5392ba37` (Task 2 GREEN).

**4. [Rule 3 — Blocking] Prisma client type coercion**

- **Found during:** Task 2 GREEN typecheck.
- **Issue:** `ctx.db` (from tenantProcedure) carries the Prisma extension overlay type that does not structurally assign to our minimal `PeppolCapabilityDb` interface.
- **Fix:** Narrow `as never` cast at the call-site, matching the pattern used elsewhere in the codebase (`peppol-orchestrator.ts` and `leitweg-id-resolver` call-sites). Does NOT weaken the service internals — the service still uses its strict `PeppolCapabilityDb` interface, which is what the tests exercise.
- **Files modified:** `packages/api/src/routers/peppol.ts`.
- **Committed in:** `5392ba37` (Task 2 GREEN).

**5. [Rule 2 — Missing critical] `retrieveCredentials` does not exist as a named export**

- **Found during:** Task 2 GREEN adapter-factory implementation.
- **Issue:** Initial factory implementation imported `retrieveCredentials` from `@contractor-ops/integrations` — that helper does not exist in the current codebase. The canonical retrieval path for encrypted credentials is `IntegrationConnection.credentialsRef` → `decryptCredentials(ref, providerSlug)` (pattern established by `jira-issue-sync`, `ksef-sync-orchestrator`, `calendar-event-service`, `doc-link-service`).
- **Fix:** Rewrote `buildStorecoveAdapterForOrg` to accept `db` + `organizationId`, fetch the `IntegrationConnection` row (status `CONNECTED`, provider `PEPPOL`), decrypt the credential blob, and construct the adapter. The caller (router) now threads `ctx.db` through.
- **Files modified:** `packages/api/src/services/peppol-adapter-factory.ts`, `packages/api/src/routers/peppol.ts`.
- **Committed in:** `5392ba37` (Task 2 GREEN).

---

**Total deviations:** 5 auto-fixed (3 blocking-issue Rule 3, 2 missing-critical Rule 2).
**Impact on plan:** No scope creep. Each fix restored the plan's intended contract either by discovering the correct existing pattern (Rules 3) or by picking a non-colliding export name (Rule 2 item 2).

### Authentication Gates

- **STORECOVE_API_KEY absent** — continues from Plan 01. Not a Plan 05 blocker; the literal is still committed with a "pending sandbox verification" comment, and Plan 06 will own the first live round-trip. Recorded in §Resolved `STORECOVE_CII_XRECHNUNG_DOC_TYPE_ID` literal above.

## Issues Encountered

- **Pre-existing `@contractor-ops/einvoice` test-file TS errors (lines 522-580 of storecove-adapter.test.ts)** added by the parallel rate-limit/audit-log test expansion. Errors are `GovApiRateLimiter` / `GovApiAuditLogger` structural-typing mismatches on vitest `Mock<Procedure>` shims. Not caused by Plan 05. Out of scope — noted here so Plan 06's executor isn't surprised when `tsc --noEmit` on einvoice reports them.
- **Pre-existing `packages/einvoice/src/profiles/xrechnung-de/svrl-normalizer.ts` missing `@contractor-ops/logger` module** — surfaced during `einvoice build`. Not caused by Plan 05. Plan 03 owns `svrl-normalizer.ts`; flagged for Plan 03's executor to resolve (the parallel agent has since landed `582bb1b6`; check that commit for the resolution).
- **Pre-existing peppol router typing error at line 94 / 100 of `routers/peppol.ts`** (IntegrationConnection.create input type mismatch on `connectedByUserId`). Not caused by Plan 05 — reproduced identically on a `git stash -u` check. Out of scope.
- **`ksef.test.ts` 9 pre-existing failures** in einvoice (`profile.validate` returns `valid:false` for the default stub). Reproduced on base commit. Out of scope.

## Deferred Issues

- **Sandbox round-trip verification of `STORECOVE_CII_XRECHNUNG_DOC_TYPE_ID`** — owned by Plan 06.
- **Discovery-response shape third variant** — monitor; extend `storecoveDiscoveryResponseSchema` + `extractDocumentTypes` if needed.
- **Pre-flight latency SLI measurement** — Plan 06 integration run.
- **Own-participant webhook update for `supportsXRechnungCii`** — Plan 06 webhook handler; the `peppolRouter.lookupCapabilities` side-effect is a manual trigger, not a push-based refresh.

## Known Stubs

None. All methods are fully implemented — `getCapabilitiesWithCache` hits the real adapter, the adapter talks to real HTTP (or a mocked fetch in tests), the cache is a real Prisma model, the router procedures are wired into `appRouter` via the pre-existing `peppolRouter` export.

## Threat Flags

No new trust boundaries introduced beyond those already in the Plan 05 threat model (T-61-05-01 .. T-61-05-07 all in PLAN.md `<threat_model>`). Mitigations:

- **T-61-05-01 Tampering (untrusted Storecove response):** `storecoveDiscoveryResponseSchema` with explicit shape + `.passthrough()` + dedicated `extractDocumentTypes` normalizer.
- **T-61-05-02 Information Disclosure (cross-tenant cache leak):** Every `peppolCapabilityCache.findUnique` / `upsert` call filters by the composite `organizationId_schemeId_value` key — structurally impossible to leak.
- **T-61-05-03 Spoofing (forged capability result):** Service-owned writes only; no client-write path to `peppolCapabilityCache`.
- **T-61-05-04 DoS (rate-budget exhaustion):** Existing `GovApiRateLimiter` enforces the per-org bucket; 6h cache absorbs repeat lookups.
- **T-61-05-05 Repudiation:** `assertSenderParticipantActive` throws BEFORE HTTP, audit log surfaces via existing `GovApiAuditLogger` per-endpoint emission.
- **T-61-05-06 Elevation of Privilege:** Both new procedures gated by `requirePermission({ settings: ['read'] })`. Plan 07 UI tests will extend the FORBIDDEN-case coverage.
- **T-61-05-07 SSRF:** Base URL is one of two pinned literals selected by the persisted `environment` string (validated at connect time via Zod `connectPeppolSchema`); no user input touches the URL path. Discovery query-string is `URLSearchParams`-encoded.

## Next Plan Readiness (61-06 `einvoice.send`)

- Invoke `assertSenderParticipantActive(db, orgId)` before any adapter call — throws `PEPPOL_PARTICIPANT_NOT_ACTIVE` on sender-gate failure.
- Invoke `assertReceiverAcceptsXRechnung(db, adapter, orgId, schemeId, value)` after sender-gate passes — throws `PARTICIPANT_NOT_REACHABLE` on receiver-gate failure.
- Call `adapter.transmitInvoice({ xml, ..., format: { kind: 'cii-xrechnung', customizationId: XRECHNUNG_CUSTOMIZATION_ID, profileId: XRECHNUNG_PROFILE_ID } })` — the doc-type ID is resolved automatically.
- The adapter returns `accepted` / `rejected` / throws — Plan 06 handles FSM transitions.
- `buildStorecoveAdapterForOrg(ctx.db, ctx.organizationId)` is the canonical factory; Plan 06's send mutation should use it directly.

## Self-Check: PASSED

**Files created (verified present):**
- FOUND: `packages/api/src/services/peppol-capability.ts`
- FOUND: `packages/api/src/services/peppol-adapter-factory.ts`
- FOUND: `packages/api/src/services/__tests__/peppol-capability.test.ts`

**Files modified (verified diff present):**
- FOUND: `packages/einvoice/src/asp/types.ts` (EInvoiceFormat + LookupParticipantCapabilitiesParams + ParticipantCapabilityResult + ASPAdapter method)
- FOUND: `packages/einvoice/src/asp/storecove/adapter.ts` (resolveDocumentTypeId + lookupParticipantCapabilities)
- FOUND: `packages/einvoice/src/asp/storecove/client.ts` (getDiscoveryReceives)
- FOUND: `packages/einvoice/src/asp/storecove/schemas.ts` (storecoveDiscoveryResponseSchema + extractDocumentTypes)
- FOUND: `packages/einvoice/src/index.ts` (re-exports)
- FOUND: `packages/einvoice/src/__tests__/storecove-adapter.test.ts` (+5 Plan 05 tests)
- FOUND: `packages/validators/src/peppol.ts` (peppolSchemeIdSchema + peppolParticipantValueSchema + peppolLookupCapabilitiesSchema)
- FOUND: `packages/validators/src/index.ts` (re-exports)
- FOUND: `packages/api/src/routers/peppol.ts` (lookupCapabilities + listParticipants procedures)
- FOUND: `packages/api/src/routers/__tests__/peppol.test.ts` (+5 Plan 05 tests)

**Commits (verified in `git log --oneline 07b7ddcc..HEAD`):**
- FOUND: `e9c1b1eb` — Task 1 RED
- FOUND: `e832f494` — Task 1 GREEN
- FOUND: `a78c845b` — Task 2 RED
- FOUND: `5392ba37` — Task 2 GREEN

**Critical invariants:**
- `grep "export type EInvoiceFormat" packages/einvoice/src/asp/types.ts` → 1 match ✓
- `grep "kind: 'cii-xrechnung'" packages/einvoice/src/asp/types.ts` → 1 match ✓
- `grep "STORECOVE_CII_XRECHNUNG_DOC_TYPE_ID" packages/einvoice/src/asp/storecove/adapter.ts` → 2 matches (import + use) ✓
- `grep -cE "lookupCapabilities|listParticipants" packages/api/src/routers/peppol.ts` → 2 procedure names ✓
- `grep -c "^export " packages/api/src/services/peppol-capability.ts` → 9 exports (incl. types) ✓
- `grep "6 \* 60 \* 60 \* 1000" packages/api/src/services/peppol-capability.ts` → 1 match (CAPABILITY_CACHE_TTL_MS) ✓
- `grep -c "PEPPOL_PARTICIPANT_NOT_ACTIVE\|PARTICIPANT_NOT_REACHABLE" packages/api/src/services/peppol-capability.ts` → 8 matches ✓
- `grep -c "organizationId" packages/api/src/services/peppol-capability.ts` → 18 matches (every query scoped) ✓

**Test verifications:**
- `pnpm --filter @contractor-ops/einvoice test -- --run storecove` → 30/30 green ✓
- `pnpm --filter @contractor-ops/einvoice test -- --run peppol-ae` → 44/44 green (zero regression) ✓
- `pnpm --filter @contractor-ops/api test -- --run peppol-capability` → 14/14 green ✓
- `pnpm --filter @contractor-ops/api test -- --run peppol.test` → 16/16 green ✓
- `pnpm --filter @contractor-ops/validators test -- --run peppol` → 27/27 green ✓
- `pnpm --filter @contractor-ops/validators exec tsc --noEmit` → clean ✓

---
*Phase: 61-xrechnung-e-invoicing*
*Plan: 05 — Storecove ASP + format discriminator + capability cache*
*Completed: 2026-04-14*
