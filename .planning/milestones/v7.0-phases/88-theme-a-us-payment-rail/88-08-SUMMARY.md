---
phase: 88-theme-a-us-payment-rail
plan: 08
subsystem: testing
tags: [nacha, fedwire, ach, payments, tRPC, zod, prisma, vitest, red-tdd]

# Dependency graph
requires:
  - phase: 88-theme-a-us-payment-rail
    provides: "generateNachaFile / generateFedwirePacs008 generators, detectUsFormat + sameDayAchCeilingMinor, ExportItem US fields, Prisma PaymentExportFormat ACH_NACHA/FEDWIRE members (88-04)"
provides:
  - "Four Nyquist RED scaffolds that pin the phase-88 gap-closure contracts and FAIL against today's code"
  - "Enum-parity gate: paymentExportFormatEnum must be a subset of Prisma PaymentExportFormat AND contain ACH_NACHA + FEDWIRE"
  - "US routing precedence + US-aware grouping assertions for detectFormatForDestination / groupItemsByFormat"
  - "End-to-end lockAndExport US-export reachability RED (Zod rejects the US formats today)"
  - "ach-return.service.ts throwing contract stub (locked types + signatures) + pure parse/map RED assertions"
affects: [88-09, 88-10, 88-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Nyquist RED scaffold: every new assertion encodes exact target behavior and must fail before the fix lands"
    - "Interface-first throwing stub: lock the contract (types + signatures) a later plan implements against"

key-files:
  created:
    - packages/api/src/services/__tests__/payment-export-format-parity.test.ts
    - packages/api/src/routers/finance/__tests__/payment-us-export.e2e.test.ts
    - packages/api/src/services/ach-return.service.ts
    - packages/api/src/services/__tests__/ach-return.service.test.ts
  modified:
    - packages/api/src/services/__tests__/payment-format-detection.test.ts

key-decisions:
  - "Parity test reads the Prisma enum from packages/db/prisma/schema/payment.prisma (its source of truth) rather than importing PaymentExportFormat from @contractor-ops/db, which is unimportable in api unit tests."
  - "e2e mounts router({ payment: paymentRouter }) + mocks @contractor-ops/integrations rather than the full appRouter, because a sibling package's build (classification) is mid-flight; the harness style and lockAndExport path are identical."
  - "ach-return stub throws a plain message (no plan-ID breadcrumb) per CLAUDE.md / lint:no-breadcrumbs."

patterns-established:
  - "RED-first for money-movement code: prove the gap as a failing test before wiring the fix."

requirements-completed: []  # RED plan proves the gaps; US-PAY-01 / US-PAY-04 are closed by 88-09 (Gap A/B) + 88-10/88-11 (Gap C).

# Metrics
duration: 15min
completed: 2026-07-01
---

# Phase 88 Plan 08: US Payment Rail Gap-Closure RED Scaffolds Summary

**Four failing Nyquist scaffolds + one throwing `ach-return.service` contract stub that pin the enum-parity, US routing precedence, end-to-end lockAndExport reachability, and ACH return-code parse/map contracts — every new assertion fails against today's code, exactly as a RED plan requires.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-01T10:15:20Z
- **Completed:** 2026-07-01T10:30:49Z
- **Tasks:** 3
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments
- **Enum-parity RED (Gap A):** `payment-export-format-parity.test.ts` asserts `paymentExportFormatEnum` is a strict subset of the Prisma `PaymentExportFormat` enum AND contains `ACH_NACHA` + `FEDWIRE`. The containment assertion FAILS today (the Zod enum omits both); the subset assertion passes.
- **US routing/grouping RED (Gap B):** `payment-format-detection.test.ts` gains a US-bank routing-precedence block (`detectFormatForDestination` USD+US-bank → `ACH_NACHA` at/below the Same-Day ACH ceiling, `FEDWIRE` above) plus a US-aware `groupItemsByFormat` split. Those cases FAIL today because `detectUsFormat` has no caller in either; the pre-existing BACS/SEPA/SWIFT cases still pass (no regression).
- **End-to-end reachability RED (SC#1/SC#4):** `payment-us-export.e2e.test.ts` drives `lockAndExport` with a USD-to-US-bank run and expects a NACHA `.txt` (94-char detail records carrying the decrypted routing/account) and a Fedwire `pacs.008` `.xml`. Both FAIL today — the tRPC Zod input rejects `ACH_NACHA`/`FEDWIRE`, so the US export is unreachable.
- **Return-code contract (Gap C):** `ach-return.service.ts` locks the full typed contract (types + `mapReturnCodeToStatus` + `parseNachaReturnFile` + `applyAchReturns` signatures) as throwing placeholders; `ach-return.service.test.ts` pins R01/R02/R03 → FAILED, NOC/COR → ADVISORY, and a returned-entry + addenda-99 parse. Every case fails against the stub; the module imports cleanly so the suite runs.

## Task Commits

Each task was committed atomically (RED tests):

1. **Task 1: RED enum-parity + US routing/grouping scaffolds** - `f783ab20c` (test)
2. **Task 2: RED end-to-end lockAndExport US-export scaffold** - `c99512ea0` (test)
3. **Task 3: RED ACH return-code contract stub + parse/map scaffolds** - `b3e5d3bfb` (test)

## Files Created/Modified
- `packages/api/src/services/__tests__/payment-export-format-parity.test.ts` (new) - Zod↔Prisma export-format parity gate; reads the Prisma enum from the schema file.
- `packages/api/src/services/__tests__/payment-format-detection.test.ts` (modified) - Added US-bank routing precedence + US-aware grouping RED blocks.
- `packages/api/src/routers/finance/__tests__/payment-us-export.e2e.test.ts` (new) - End-to-end lockAndExport US-export RED (NACHA `.txt` / Fedwire `pacs.008`).
- `packages/api/src/services/ach-return.service.ts` (new) - Throwing ACH return-code contract stub (types + parse/map/apply signatures).
- `packages/api/src/services/__tests__/ach-return.service.test.ts` (new) - Pure return-code parse + map RED assertions.

## RED Verification

`pnpm --filter @contractor-ops/api exec vitest run payment-export-format-parity payment-format-detection payment-us-export.e2e ach-return.service`:

- **Test Files:** 4 failed (4) — expected (RED).
- **Tests:** 11 failed | 34 passed (45).
- The 11 failures are exactly the new scaffolds: 1 parity containment + 3 detection (US ≤ceiling, US >ceiling, mixed split) + 2 e2e (ACH_NACHA, FEDWIRE) + 5 ach-return (R01/R02/R03/NOC-COR/parse).
- The 34 passing tests are the pre-existing detection cases, the parity subset check, and the US no-regression anchors (BACS/SEPA/SWIFT, amount-less fall-through). No regression authored.
- `lint:no-breadcrumbs`: clean on all new files.

## Decisions Made
See frontmatter `key-decisions`. All three were forced by the execution environment / project rules, not design preference.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Parity test sources the Prisma enum from the schema file, not `@contractor-ops/db`**
- **Found during:** Task 1
- **Issue:** The plan's interface says "import `PaymentExportFormat` from `@contractor-ops/db`". That is not possible in an api unit test: `@contractor-ops/db` has no `dist` build, is not aliased in the api vitest config, instantiates a Prisma client at import (which is why every api test mocks it), and its barrel does not even re-export `PaymentExportFormat`. Importing it errors the suite (module not found), violating the RED requirement that the suite RUN.
- **Fix:** Read `packages/db/prisma/schema/payment.prisma` (the enum's true source of truth) at test runtime and parse the `PaymentExportFormat` members. The subset gate holds and genuinely catches Zod-vs-schema drift; a self-contained comment documents WHY the schema is read rather than the enum imported.
- **Files modified:** payment-export-format-parity.test.ts
- **Verification:** Suite runs; subset assertion passes, containment assertion FAILS (RED).
- **Committed in:** `f783ab20c`

**2. [Rule 3 / CLAUDE.md] Stub throws a plain message, not the plan's literal `'not implemented — 88-10'`**
- **Found during:** Task 3
- **Issue:** The plan suggested each stub body throw `'not implemented — 88-10'`. `88-10` is a plan-ID breadcrumb, forbidden in source by CLAUDE.md and enforced by `pnpm lint:no-breadcrumbs`.
- **Fix:** Threw `'ach-return.service is a contract stub — no implementation yet'`. Provenance lives in the commit message, not the source.
- **Files modified:** ach-return.service.ts
- **Verification:** `lint:no-breadcrumbs` clean on the file; tests fail against the throw (RED).
- **Committed in:** `b3e5d3bfb`

**3. [Rule 3 - Blocking] e2e mounts the payment router + mocks `@contractor-ops/integrations` instead of importing the full `appRouter`**
- **Found during:** Task 2
- **Issue:** The plan's harness imports the full `appRouter`. In this worktree that fails to collect: `appRouter` transitively imports `@contractor-ops/classification`, whose build is broken by a sibling in-flight phase (its own test files reference not-yet-created `../rule-set.js` / `../scoring.js`), and `payment-core.ts` value-imports payout adapters from `@contractor-ops/integrations` (whose `dist` is also unbuilt, since it depends on classification). Neither is in this plan's scope to fix.
- **Fix:** Mounted `router({ payment: paymentRouter })` — the exact router that owns `lockAndExport`, which is classification-free — and added a `vi.mock('@contractor-ops/integrations')` stub (lockAndExport never uses the adapters). The db-mock/tRPC-caller harness style and the `caller.payment.lockAndExport` path are identical to `payment.test.ts`; 88-09 turns the test green unchanged.
- **Files modified:** payment-us-export.e2e.test.ts
- **Verification:** Suite runs; both US-format cases FAIL with the intended Zod rejection of ACH_NACHA/FEDWIRE (RED).
- **Committed in:** `c99512ea0`

---

**Total deviations:** 3 auto-fixed (all Rule 3 - blocking / project-rule). **Impact:** No scope creep — each keeps the RED test faithful to the plan's intended contract while making the suite actually run in this worktree. All three become green under 88-09/88-10 without editing the tests.

## Known Stubs

- `packages/api/src/services/ach-return.service.ts` — an **intentional throwing contract stub**, the designed artifact of this RED plan (locks the interface for 88-10). Not an accidental stub; resolved by 88-10 (NACHA return-file parser + `mapReturnCodeToStatus` + idempotent `applyAchReturns`).

## Issues Encountered
- **Fresh worktree had no `node_modules`.** Ran `pnpm install --frozen-lockfile --prefer-offline --ignore-scripts` to materialize the declared workspace deps from the shared store (not a new-package add — no lockfile change). Then force-built api's dependency graph for the e2e's router chain; the `classification` and `integrations` builds fail on pre-existing sibling errors (out of scope) — handled via the router-narrowing deviation above.
- **Build side-effect:** the workspace build regenerated `packages/validators/src/legal/de.js` and `de.d.ts` in the working tree. These are out-of-scope build artifacts — left **uncommitted and unreverted** (git-safety: no `git checkout --` without approval). They are not part of any of this plan's commits and do not affect the branch merge.

## Doc-follows-code
- Four of the five files are tests (`__tests__` / `*.test.ts`) — wiki-exempt. `ach-return.service.ts` is a behavior-free throwing stub; its domain documentation (US ACH return-code handling) lands with the real implementation in **88-10**, which owns the wiki/`api-routers-catalog` + domain-page updates. No wiki drift is introduced by a stub with no runtime behavior.

## Threat Flags
None new. Test fixtures use synthetic routing/account numbers only (per the plan's `T-88-08-01` mitigation); the reversible crypto mock keeps them out of real AES paths and never logs decoded file contents.

## Next Phase Readiness
- **88-09 (Gap A/B):** extend `paymentExportFormatEnum` with ACH_NACHA/FEDWIRE, thread `detectUsFormat` into `detectFormatForDestination` (US-bank signal + amount/ceiling options) + US-aware `groupItemsByFormat`, and populate `ExportItem.usRoutingNumber/usAccountNumber` in `_buildExportItems`. Turns Tasks 1 + 2 green.
- **88-10 (Gap C):** implement `ach-return.service.ts` against the locked contract (parser mirrors the NACHA generator's column layout used in the Task 3 fixture). Turns Task 3 green.
- **Blocker note:** running the e2e end-to-end (green) will require the sibling `classification`/`integrations` builds to be repaired, or continued use of the narrowed payment-router harness.

## Self-Check: PASSED

All five source files + the SUMMARY exist on disk; all four commits (`f783ab20c`, `c99512ea0`, `b3e5d3bfb`, `c7de52833`) are present in the git log.

---
*Phase: 88-theme-a-us-payment-rail*
*Completed: 2026-07-01*
