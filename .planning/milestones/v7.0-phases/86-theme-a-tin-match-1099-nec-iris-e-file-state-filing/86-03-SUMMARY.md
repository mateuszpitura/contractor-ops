---
phase: 86-theme-a-tin-match-1099-nec-iris-e-file-state-filing
plan: 03
subsystem: api
tags: [us, tax, tin-match, irs, e-services, adapter-seam, ssrf, backup-withholding, audit, cache]

# Dependency graph
requires:
  - phase: 86-02
    provides: Form1099Nec + IRIS records + config tables (generated Prisma client; the 1099 batch reads the backup-withholding flag this service records)
  - phase: 85-theme-a-w-form-intake-tax-treaty-engine
    provides: tax-form.service immutable-snapshot + last-4-only PII posture; us-validators isValidEin/isValidSsn; module.us-expansion gating
provides:
  - TinMatchClient adapter seam (interface + deterministic MockTinMatchClient default + dark SSRF-safe EServicesTinMatchClient) in packages/integrations
  - tin-match.service.ts — 24h cache + bounded retry + advisory mismatch handling (sets backup-withholding flag + admin escalation + audit, NEVER hard-blocks); single-recipient matchRecipientTin + year-end revalidateBatchTins
  - createDbTinMatchPersistence — production wiring of the mismatch audit row through writeAuditLog (caller supplies flag + escalation writers against the applied schema)
affects: [86-04 1099 service (reads backup-withholding flag), 86-06 transmitter/routers (wires TIN-match procedures), phase-88 backup-withholding payout reduction]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Adapter seam + deterministic mock default + dark flag-gated live client (TinMatchClient)"
    - "SSRF-safe pinned-literal base URL by credential environment (mirrors peppol-adapter-factory)"
    - "Advisory auto-record-and-escalate, never hard-block (mirrors reverse-charge / P85 auto-record posture)"
    - "Injected side-effect ports so a DB-writing service is fully unit-tested with no live database"
    - "Process-local 24h cache keyed on TIN-last4 only — a full TIN never enters a cache key, log, or audit row"

key-files:
  created:
    - packages/integrations/src/adapters/tin-match/tin-match-client.ts
    - packages/integrations/src/adapters/tin-match/mock-tin-match-client.ts
    - packages/integrations/src/adapters/tin-match/eservices-tin-match-client.ts
    - packages/integrations/src/adapters/tin-match/index.ts
    - packages/api/src/services/tin-match.service.ts
  modified:
    - packages/api/src/services/__tests__/tin-match.service.test.ts
    - packages/integrations/src/index.ts
    - packages/integrations/package.json
    - .planning/brain/wiki/domains/us-tax-forms.md
    - .planning/brain/wiki/structure/key-services.md
    - .planning/brain/wiki/log.md

key-decisions:
  - "TinMatchClient.match (not check) matches the Wave-0 RED scaffold contract; result carries responseIndicator + derived matched"
  - "Side-effect persistence is an injected port (flag-set / escalation / audit), defaulting to advisory-result-only — turns the RED scaffold GREEN with no live DB and respects the unapplied 86-02 migration"
  - "createDbTinMatchPersistence writes the audit row through writeAuditLog (real today); flag + escalation writers stay caller-supplied because no dedicated backup-withholding-flag column / TIN-mismatch escalation model is in the applied schema yet"
  - "EServicesTinMatchClient refuses live calls (throws) while ungated — a constructed-but-dark client never fabricates an indicator"

patterns-established:
  - "TinMatchClient adapter seam: mock default + dark SSRF-safe live client"
  - "Advisory mismatch handling: flag + escalate + audit, never throw / never block the 1099"
  - "Injected persistence ports for DB-free unit testing of a side-effecting service"

requirements-completed: [US-FORM-03]

# Metrics
duration: ~13min
completed: 2026-06-17
---

# Phase 86 Plan 03: IRS TIN-Matching Seam + Cache/Retry/Escalation Service Summary

**A `TinMatchClient` adapter seam (deterministic mock default + dark SSRF-safe e-Services client) plus `tin-match.service` that applies a 24h cache + bounded retry and, on a mismatch, sets the recipient backup-withholding flag + raises an admin escalation + writes an audit row — advisory only, never a hard block; the 1099 still generates.**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-06-16T23:08:59Z
- **Completed:** 2026-06-16T23:21:52Z
- **Tasks:** 2 of 2 (both autonomous, both TDD)
- **Files modified:** 11 (5 created, 6 modified — 3 of the modified are wiki pages)

## Accomplishments
- Shipped the `TinMatchClient` interface modelling the IRS numerical response indicator (0 = match), with a deterministic `MockTinMatchClient` default that reuses `isValidEin`/`isValidSsn` for format gating, and a dark `EServicesTinMatchClient` that pins its base URL to one of two compile-time literals by credential `environment` (SSRF-safe) and refuses to transmit while its PAF/flag gate is uncleared.
- Built `tin-match.service.ts`: a 24h process-local cache (keyed on org+recipient+name+TIN-last4, never a full TIN), a bounded transient retry, and the advisory mismatch handler that sets the backup-withholding flag + raises an admin escalation + writes an audit row and RETURNS a result — it never throws and never blocks. Exposed a single-recipient `matchRecipientTin` (W-9 intake) and a `revalidateBatchTins` year-end loop that completes every recipient even when one mismatches.
- Turned the Plan 86-01 Wave-0 RED scaffold GREEN (6 tests pass), strengthening it with persistence-port and batch coverage, and removed every planning/requirement/decision/phase breadcrumb ID from the touched files (kept real domain IDs: W-9, 1099, CP2100, B-notice, EIN/SSN, PAF).
- Documentation-follows-code: extended the `us-tax-forms` domain page with a TIN-Matching section + entry points + invariants + agent mistakes, added the service to `key-services.md`, and logged the change in `wiki/log.md`.

## Task Commits

Each task was committed atomically:

1. **Task 1: TinMatchClient seam + deterministic mock + dark live e-Services client** - `8f0ee7224` (feat)
2. **Task 2: tin-match.service — 24h cache + retry + advisory mismatch handling** - `1f89de393` (feat)

**Plan metadata:** see final docs commit (SUMMARY + STATE + ROADMAP + wiki).

_Note: this is a TDD plan; the GREEN implementation commits flip the pre-existing Wave-0 RED scaffold (no separate test-first commit was authored in this plan — the RED commit landed in Plan 86-01)._

## Files Created/Modified
- `packages/integrations/src/adapters/tin-match/tin-match-client.ts` - `TinMatchClient` interface + `TinMatchInput`/`TinMatchResult`/`TinType` (IRS numerical response indicator).
- `packages/integrations/src/adapters/tin-match/mock-tin-match-client.ts` - Deterministic mock default; format gate via `isValidEin`/`isValidSsn`, fixture-keyed mismatch indicators.
- `packages/integrations/src/adapters/tin-match/eservices-tin-match-client.ts` - Dark live client: `decryptCredentials(..., 'irs-tin-match')` + pinned literal base URL by environment; throws while ungated; never logs a full TIN.
- `packages/integrations/src/adapters/tin-match/index.ts` - Barrel export of the seam.
- `packages/api/src/services/tin-match.service.ts` - 24h cache + retry + advisory mismatch handler; `matchRecipientTin` / `revalidateBatchTins` / `createDbTinMatchPersistence`; injected persistence ports.
- `packages/api/src/services/__tests__/tin-match.service.test.ts` - Wave-0 RED scaffold turned GREEN; breadcrumbs removed; added persistence-port + match + batch coverage.
- `packages/integrations/src/index.ts` - Re-export the TIN-match seam from the package root.
- `packages/integrations/package.json` - Added `@contractor-ops/validators` workspace dependency.
- `.planning/brain/wiki/domains/us-tax-forms.md` / `structure/key-services.md` / `log.md` - Documentation-follows-code.

## Decisions Made
- The injected `client.match(...)` method name (not `check`) matches the RED scaffold; the result exposes both `responseIndicator` and a derived `matched`.
- Side-effects (backup-withholding flag, escalation, audit) are injected ports defaulting to advisory-result-only, so the deterministic core is fully unit-tested with no live database — necessary because the 86-02 migration is not yet applied and the unit test injects only a client.
- `createDbTinMatchPersistence` makes the D-19 audit path real (writes through `writeAuditLog`, joins the caller `tx`); the backup-withholding-flag set + escalation-record writers stay caller-supplied because no dedicated flag column or TIN-mismatch escalation model exists in the applied schema yet — that wiring lands in the 1099-batch / staff-router plans against the applied schema.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `@contractor-ops/validators` workspace dependency to `integrations`**
- **Found during:** Task 1 (mock format gating)
- **Issue:** The mock reuses `isValidEin`/`isValidSsn` (plan: "do NOT duplicate validators"), but `@contractor-ops/validators` was not a dependency of `packages/integrations`, so the import would not resolve.
- **Fix:** Added `"@contractor-ops/validators": "workspace:*"` to `integrations/package.json` (verified no dependency cycle: validators does not depend on integrations) and re-installed.
- **Files modified:** `packages/integrations/package.json`, `pnpm-lock.yaml`
- **Verification:** `pnpm typecheck --filter @contractor-ops/integrations` green; the validators import resolves.
- **Committed in:** `8f0ee7224` (Task 1 commit)

**2. [Rule 2 - Missing Critical] Live client refuses to transmit while dark**
- **Found during:** Task 1
- **Issue:** A constructed-but-ungated live client returning a fabricated indicator would be a silent correctness/compliance hazard.
- **Fix:** `EServicesTinMatchClient.match` throws (with a last-4-only warning log) until the PAF/flag gate clears, rather than returning a fake indicator.
- **Files modified:** `packages/integrations/src/adapters/tin-match/eservices-tin-match-client.ts`
- **Verification:** Typecheck green; the default path uses `MockTinMatchClient`, so this never fires in shipped behavior.
- **Committed in:** `8f0ee7224` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing-critical)
**Impact on plan:** Both were necessary for correctness/build; no scope creep. The plan's acceptance criterion `grep "writeAuditLog"` is satisfied by `createDbTinMatchPersistence` (the audit path is real); the flag + escalation persistence are deferred to the schema-applied callers as the only correct option given the unapplied 86-02 migration.

## Issues Encountered
- **`pnpm --filter @contractor-ops/api test -- tin-match.service` does not single-file filter** — the `--` passthrough ran the whole api suite (~183s). Scoped the run with `pnpm exec vitest run src/services/__tests__/tin-match.service.test.ts` instead (6/6 pass, 94ms). Memory-safe (api, not the web-vite suite).
- **5 pre-existing Wave-0 RED scaffolds still fail** (`form-1099-nec.service`, `iris-ack-parser`, `tax-filing-transmitter`, and two others) — these belong to plans 86-04/05/06 and are out of scope for 86-03. They were RED before this plan; logged, not touched.
- **`lint-staged automatic backup` stash entries remain** (`dd6845ec3`, `0f0bcafbb`, and one more) — created by the pre-commit lint-staged hook, NOT by a manual `git stash`. Per Git-safety rules I did not touch the stash list. The working tree is intact (in-flight files present, scaffold GREEN). The user may clear these lint-staged backups when convenient.

## Conflict-Risk Notes (sequential executor on a dirty branch)
- `.planning/brain/wiki/structure/key-services.md` and `.planning/brain/wiki/log.md` carried pre-existing in-flight wiki edits from the active `audit/post-migration-parity` branch (AuditLog append-only / OCR killswitch docs + a `source_commit` bump). Git stages whole files, so the docs commit for this plan includes those in-flight wiki lines alongside my one-line TIN-match additions. They are coherent same-branch documentation, not unrelated source churn — surfaced here for visibility. `us-tax-forms.md` was clean (all edits mine).

## Known Stubs
- The backup-withholding-flag SET and the admin-escalation RECORD are injected ports without a default DB writer (`createDbTinMatchPersistence` wires only the audit today). This is intentional: no dedicated `Contractor` backup-withholding-flag column or TIN-mismatch escalation model exists in the applied schema, and the 86-02 migration is unapplied. The 1099-batch / staff-router plan (86-04/06) supplies these writers against the applied schema. The advisory result (`backupWithholdingFlagSet` / `escalationCreated`) is fully correct and unit-tested; only the persistence sink is deferred.

## Threat Flags
None — no new network endpoint, auth path, file-access pattern, or trust-boundary schema change beyond the plan's `<threat_model>` (T-86-03-01..05). The dark live client is SSRF-pinned and gated; full TIN never reaches a log/cache/audit.

## User Setup Required
None for this plan. (The live e-Services TIN-Match client remains dark until PAF enrollment + e-Services registration clears its flag gate — an operational prerequisite tracked at the phase level, not a code setup step.)

## Next Phase Readiness
- The `TinMatchClient` seam + `tin-match.service` are ready; 86-04 (1099 service) reads the backup-withholding flag this records, and 86-06 (staff/portal routers) wires `matchRecipientTin` / `revalidateBatchTins` + supplies `createDbTinMatchPersistence` with the schema-applied flag + escalation writers.
- BLOCKER (inherited from 86-02): the multi-region migration adding the Phase-86 models is still unapplied; the DB-backed flag-set + escalation writers cannot be wired until it lands.

## Self-Check: PASSED

- `tin-match-client.ts` / `mock-tin-match-client.ts` / `eservices-tin-match-client.ts` / `index.ts` (seam) — FOUND
- `packages/api/src/services/tin-match.service.ts` — FOUND
- `86-03-SUMMARY.md` — FOUND
- Commit `8f0ee7224` (Task 1) — FOUND
- Commit `1f89de393` (Task 2) — FOUND
- `tin-match.service.test.ts` — 6/6 pass; `typecheck` green for integrations + api; `lint:no-breadcrumbs` clean on touched files

---
*Phase: 86-theme-a-tin-match-1099-nec-iris-e-file-state-filing*
*Completed: 2026-06-17*
