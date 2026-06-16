---
phase: 86-theme-a-tin-match-1099-nec-iris-e-file-state-filing
plan: 05
subsystem: api
tags: [us, tax, 1099-nec, obbba, react-pdf, fx, idempotency, immutable-record, audit, backup-withholding]

# Dependency graph
requires:
  - phase: 86-02
    provides: Form1099Nec + Tax1099Threshold models (generated Prisma client; the threshold table this gate reads, the supersede-chain model this fills)
  - phase: 86-03
    provides: tin-match.service backup-withholding flag + the injected-port pattern for a DB-writing service with no live DB
  - phase: 85-theme-a-w-form-intake-tax-treaty-engine
    provides: tax-form.service supersedeAndInsert + buildFormSnapshot/sanitizeFields (last-4-only) idiom; exchange-rate convertAmount FX source
provides:
  - form-1099-nec.service — box-1 aggregation by payment-date + FX-to-USD per recipient/payer-org, tax-year-keyed Tax1099Threshold gate, box-4 backup withholding, CORRECTED = supersede in one transaction, idempotent batch + audit, last-4-only immutable snapshot
  - form-1099-nec-pdf + form-1099-nec-copy-b — lazy renderToBuffer recipient Copy-B substitute PDF (Pub 1179 §4.6) rendered from the immutable snapshot, last-4 TIN, adviser-verify, R2 archive with a pdfArchiveKey CAS guard
affects: [86-06 transmitter/routers (wires generateBatch / fileCorrection / renderAndArchiveCopyB + supplies the persistence sink), 86-07 ui (1099 batch panel), phase-88 backup-withholding payout reduction]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Payment-date FX-to-USD aggregation reusing exchange-rate convertAmount (single HALF-UP round on integer minor units, no float drift)"
    - "Tax-year-keyed threshold gate read from a config table, never a constant ($600 TY2025 / $2,000 TY2026 OBBBA)"
    - "CORRECTED = supersede (prior ACTIVE -> SUPERSEDED, new ACTIVE in one transaction); filed row never mutated"
    - "Immutable last-4-only snapshot via a sanitizer mirroring tax-form.service; PDF renders from the snapshot, never a live recompute"
    - "Idempotent batch generation (reserve/complete/clear); injected persistence sink so the deterministic core is unit-tested with no live DB"
    - "Lazy import('@react-pdf/renderer') renderToBuffer + R2 archive under <feature>/<orgId>/<id>.pdf with a CAS render guard"

key-files:
  created:
    - packages/api/src/services/form-1099-nec.service.ts
    - packages/api/src/services/form-1099-nec-pdf.ts
    - packages/api/src/pdf-templates/form-1099-nec-copy-b.tsx
  modified:
    - packages/api/src/services/__tests__/form-1099-nec.service.test.ts
    - packages/api/src/pdf-templates/__tests__/form-1099-nec-copy-b.test.tsx
    - .planning/brain/wiki/domains/us-tax-forms.md
    - .planning/brain/wiki/structure/key-services.md
    - .planning/brain/wiki/log.md

key-decisions:
  - "Box-4 backup withholding is computed from caller-supplied flags (W-9 flag / TIN mismatch + recorded amount), not a Contractor column — no dedicated backup-withholding column exists in the applied schema yet (mirrors 86-03's deferral)"
  - "generateBatch persistence is an injected sink (default: compute-only) so the engine is fully unit-tested with no live DB; the 86-06 wiring caller supplies the real writer against the applied migration"
  - "aggregateBox1 (sync) requires non-USD payouts to carry a pre-converted usdAmountMinor and throws otherwise; aggregateBox1Async runs the payment-date FX conversion — keeps the pure reducer testable and refuses to silently understate the box"
  - "isAboveThreshold mirrors the seeded config figures for the pure gate; the live batch path reads getBox1ThresholdMinor from Tax1099Threshold (never a hardcoded 60000/200000 constant)"

patterns-established:
  - "Tax-year-keyed threshold gate from a config table"
  - "CORRECTED supersede chain for 1099 returns + audited fileCorrection in one transaction"
  - "Copy-B substitute PDF rendered from the immutable snapshot with a pdfArchiveKey CAS guard"

requirements-completed: [US-FORM-04]

# Metrics
duration: ~10min
completed: 2026-06-16
---

# Phase 86 Plan 05: 1099-NEC Generation Engine + Recipient Copy-B PDF Summary

**Deterministic 1099-NEC year-end engine — box-1 aggregated by payment-date + FX-to-USD per recipient/payer-org, gated by the tax-year-keyed Tax1099Threshold table ($600 TY2025 / $2,000 TY2026 OBBBA), box-4 backup withholding, CORRECTED = immutable supersede, idempotent + audited batch — plus a recipient Copy-B substitute PDF (Pub 1179 §4.6, last-4 TIN, adviser-verify) rendered from the immutable snapshot and archived to the US R2 tax bucket.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-16T23:29:02Z
- **Completed:** 2026-06-16T23:39:52Z
- **Tasks:** 2 of 2 (both autonomous, both TDD)
- **Files modified:** 8 (3 created, 5 modified — 3 of the modified are wiki pages)

## Accomplishments
- Shipped `form-1099-nec.service`: `aggregateBox1`/`aggregateBox1Async` sum box-1 by payment (settlement) date per recipient per payer-org and FX-convert non-USD payouts to USD at the payment-date rate via the in-tree `exchange-rate` service (one HALF-UP round, no float drift); `getBox1ThresholdMinor` reads the tax-year-keyed `Tax1099Threshold` table and `isAboveThreshold` gates on it (never a constant); `computeBox4Minor` records backup withholding on the W-9 flag or a TIN mismatch; `buildForm1099NecSnapshot` builds the last-4-only immutable record-of-record with an adviser-verify note; `supersedeCorrected`/`fileCorrection` flip the prior ACTIVE row to SUPERSEDED then insert a new ACTIVE `corrected: true` row in one transaction (filed row never mutated, audit-logged); `generateBatch` wraps the run in idempotency reserve/complete/clear and writes a generate audit row, with an injected persistence sink.
- Shipped the recipient Copy-B PDF: `Form1099NecCopyBDocument` (react-pdf substitute, black ink, Pub 1179 §4.6, recipient TIN masked to last-4, adviser-verify footnote, Copy B only) + `form-1099-nec-pdf` `renderAndArchiveCopyB` (lazy `import('@react-pdf/renderer')` `renderToBuffer` from the immutable snapshot, R2 archive `1099-nec/<orgId>/<id>.pdf`, `pdfArchiveKey` CAS guard so a render is not double-run).
- Turned the two Plan 86-01 Wave-0 RED scaffolds GREEN (17 tests pass total: 14 service + 3 Copy-B), strengthening them with FX/year-boundary, threshold-edge, box-4, snapshot-masking, and idempotent-retry coverage; removed all planning/requirement/phase breadcrumb IDs from the comments in the files touched (kept real domain IDs: 1099-NEC, box-1/box-4, OBBBA, Copy-B, Pub 1179, W-9, SSN).
- Documentation-follows-code: extended the `us-tax-forms` domain page with a 1099-NEC generation section + entry points + invariants + agent mistakes (and added the two services + template to `verify_with`, bumped `source_commit`), added two rows to `key-services.md`, logged in `wiki/log.md`.

## Task Commits

Each task was committed atomically:

1. **Task 1: form-1099-nec.service — aggregation + threshold gate + box-4 + CORRECTED supersede + idempotency** - `7deca8436` (feat)
2. **Task 2: Copy-B PDF template + lazy renderToBuffer + R2 archive** - `90fd15c7c` (feat)

**Plan docs (wiki):** `8d84e0761` (docs: documentation-follows-code) — SUMMARY + STATE + ROADMAP land in the final metadata commit.

_Note: this is a TDD plan; the GREEN implementation commits flip the pre-existing Wave-0 RED scaffolds (the RED commit landed in Plan 86-01, so no separate test-first commit was authored here)._

## Files Created/Modified
- `packages/api/src/services/form-1099-nec.service.ts` - Batch aggregation (payment-date + FX), tax-year threshold gate, box-4, CORRECTED supersede + audited `fileCorrection`, idempotent `generateBatch`, last-4-only snapshot builder.
- `packages/api/src/services/form-1099-nec-pdf.ts` - Lazy `renderToBuffer` render-from-snapshot + R2 archive + `pdfArchiveKey` CAS guard.
- `packages/api/src/pdf-templates/form-1099-nec-copy-b.tsx` - `Form1099NecCopyBDocument` react-pdf substitute Copy B (last-4 TIN, adviser-verify, Copy B only).
- `packages/api/src/services/__tests__/form-1099-nec.service.test.ts` - RED scaffold GREEN; breadcrumbs removed; added FX/threshold/box-4/snapshot/idempotency coverage.
- `packages/api/src/pdf-templates/__tests__/form-1099-nec-copy-b.test.tsx` - RED scaffold GREEN; breadcrumbs removed; added adviser-verify + box-amount assertions.
- `.planning/brain/wiki/domains/us-tax-forms.md` / `structure/key-services.md` / `log.md` - Documentation-follows-code.

## Decisions Made
- Box-4 is computed from caller-supplied flags + the recorded amount rather than a `Contractor` column — no dedicated backup-withholding column exists in the applied schema; this mirrors 86-03's deferral. The 24% payout reduction is Phase 88.
- The `generateBatch` persistence sink is injected (default compute-only) so the deterministic core is unit-testable with no live DB (86-02 migration unapplied); the 86-06 wiring caller supplies the real writer.
- `aggregateBox1` (sync, pure) requires non-USD payouts to carry a pre-converted `usdAmountMinor` and throws otherwise; `aggregateBox1Async` is the FX-running wrapper — keeps the reducer pure/testable and refuses to silently understate the box.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Mocked the idempotency module in the batch tests to avoid a live-Redis hang**
- **Found during:** Task 1 (batch-generation tests)
- **Issue:** The api vitest env sets `UPSTASH_REDIS_REST_URL: 'https://placeholder.upstash.io'`, so `idempotency.ts` instantiates a real Upstash client at module load and `reserve` made a network call to the placeholder host that hung past the 5s test timeout (two batch tests timed out).
- **Fix:** `vi.mock('../../lib/idempotency', ...)` drives reserve/complete/clear from a deterministic in-memory store in the test file, so the dedupe contract (MISS → HIT on retry) is exercised without any network I/O. The service code is unchanged — it still uses the real `idempotency.ts` in production.
- **Files modified:** `packages/api/src/services/__tests__/form-1099-nec.service.test.ts`
- **Verification:** Both batch tests now pass deterministically (114ms suite); 14/14 service tests green.
- **Committed in:** `7deca8436` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking, test-only)
**Impact on plan:** Necessary to keep the unit suite hermetic and fast; no production-code change, no scope creep. All plan acceptance greps satisfied (threshold table lookup, no hardcoded 60000/200000 constant, FX reuse, writeAuditLog, idempotency, renderToBuffer lazy import, `1099-nec/` key, last-4 TIN, adviser-verify).

## Issues Encountered
- **`pnpm --filter @contractor-ops/api test -- <name>` does not single-file filter** (the `--` passthrough runs the whole api suite, ~3min). Scoped runs with `pnpm exec vitest run <path>` per the 86-03 note (memory-safe: api, never the web-vite suite).
- **`lint:no-breadcrumbs` still reports breadcrumbs in OTHER plans' Wave-0 RED scaffolds** (`iris-ack-parser.test.ts`, `tax-filing-transmitter.test.ts`, `tax-filing-tenant-isolation.security.test.ts`) — those belong to plans 86-05-IRIS / 86-06 and are out of scope. My two scaffolds are clean. Logged to `deferred-items.md` (Plan 86-05 section).

## Known Stubs
- The `generateBatch` persistence sink and the `fileCorrection`/`renderAndArchiveCopyB` Prisma surfaces are injected ports; the real DB writer is supplied by the schema-applied 86-06 wiring caller (the 86-02 multi-region migration is still unapplied). The deterministic compute + supersede + render logic is fully implemented and unit-tested; only the persistence sink is deferred — intentional and consistent with 86-03's pattern.

## Threat Flags
None — no new network endpoint, auth path, or trust-boundary schema change beyond the plan's `<threat_model>` (T-86-05-01..06). A full TIN never enters the snapshot, the PDF, or a log (last-4 only); the threshold is table-driven (no hardcoded constant); CORRECTED supersedes (never mutates); the batch is idempotent + audited; Copy B only (never Copy A).

## User Setup Required
None for this plan. (The live IRIS A2A transmit + live e-Services TIN-Match remain dark behind their flags — operational prerequisites tracked at the phase level. The 86-02 multi-region migration is a separate human gate that must land before the 86-06 wiring caller can persist generated rows.)

## Next Phase Readiness
- The 1099-NEC engine + Copy-B PDF are ready. 86-06 (staff/portal routers) wires `generateBatch` / `fileCorrection` / `renderAndArchiveCopyB`, supplies the persistence sink + `Form1099NecArchiveClient` against the applied schema, and gates the procedures on `module.us-expansion`.
- BLOCKER (inherited from 86-02): the multi-region migration adding the Phase-86 models is still unapplied; the DB-backed persistence sink cannot be wired until it lands.

## Self-Check: PASSED

- `packages/api/src/services/form-1099-nec.service.ts` — FOUND
- `packages/api/src/services/form-1099-nec-pdf.ts` — FOUND
- `packages/api/src/pdf-templates/form-1099-nec-copy-b.tsx` — FOUND
- `86-05-SUMMARY.md` — FOUND
- Commit `7deca8436` (Task 1) — FOUND
- Commit `90fd15c7c` (Task 2) — FOUND
- Commit `8d84e0761` (docs) — FOUND
- 17/17 tests pass (14 service + 3 Copy-B); `pnpm typecheck --filter @contractor-ops/api` green; `lint:no-breadcrumbs` clean on all five touched files; all plan acceptance greps satisfied.

---
*Phase: 86-theme-a-tin-match-1099-nec-iris-e-file-state-filing*
*Completed: 2026-06-16*
