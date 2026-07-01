---
phase: 88-theme-a-us-payment-rail
plan: 09
subsystem: payments
tags: [nacha, fedwire, ach, us-payment-rail, tRPC, zod, prisma, format-detection]

# Dependency graph
requires:
  - phase: 88-theme-a-us-payment-rail
    provides: "generateNachaFile / generateFedwirePacs008 generators + _generateExportFileForFormat string dispatch, detectUsFormat + sameDayAchCeilingMinor, ExportItem US fields, Prisma PaymentExportFormat ACH_NACHA/FEDWIRE members (88-04)"
  - phase: 88-theme-a-us-payment-rail
    provides: "Four RED scaffolds pinning the enum-parity, US routing/grouping, and end-to-end lockAndExport US-export contracts (88-08)"
provides:
  - "paymentExportFormatEnum extended with ACH_NACHA + FEDWIRE — lockAndExport's Zod input now accepts the US file formats"
  - "detectFormatForDestination US branch (USD + US bank → ACH_NACHA at/below the Same-Day ACH ceiling, FEDWIRE above) between the BACS rail and the IBAN fallback"
  - "groupItemsByFormat US-aware split (internal-consistency helper; no production caller)"
  - "getFormatDetection advisory routed through detectFormatForDestination — a reachable production caller for detectUsFormat (SC#4)"
  - "_buildExportItems decrypts + populates ExportItem.usRoutingNumber/usAccountNumber so the emitted NACHA carries the real routing/account"
affects: [88-10, 88-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Amount-gated US rail selection: the US branch is only entered when a defined amountMinor is supplied — a missing amount falls straight through to the IBAN fallback (no silent ACH default)"
    - "Presence-only encrypted-field signal in the advisory: ciphertext reduced to a sentinel before it reaches the routing object — never decrypted, logged, or returned"

key-files:
  created: []
  modified:
    - packages/validators/src/payment.ts
    - packages/api/src/services/payment-format-detection.ts
    - packages/api/src/routers/finance/payment-export-router.ts
    - packages/api/src/routers/finance/payment-shared.ts

key-decisions:
  - "Destination US fields are OPTIONAL (usRoutingNumberEncrypted?/usAccountNumberEncrypted?), not required string|null as the plan's interface literal suggested — required fields would break the untouched no-regression test destinations (makeDest, gbpUkDestination, eurDestination) that construct a Destination without the US pair. Optional keeps them typechecking while a present-both pair still marks a US bank."
  - "getFormatDetection passes a presence sentinel ('present' | null) into the Destination rather than the raw encrypted column, so the AES-256-GCM ciphertext never enters the routing object — honouring the threat register's presence-only mitigation (T-88-09-04)."
  - "_buildExportItems decrypts the US routing/account only when BOTH encrypted columns are present; the plaintext lives only inside the function and lands solely in the file buffer (bacs.ts precedent), never in a log or the export audit trail (T-88-09-01)."

patterns-established:
  - "GREEN-after-RED wiring for money-movement: reuse the existing generators/dispatch/enum members and supply only the missing wires + the US-field mapping — no generator or serializer was reimplemented."

requirements-completed: [US-PAY-01, US-PAY-04]

# Metrics
duration: 25min
completed: 2026-07-01
---

# Phase 88 Plan 09: US Payment Rail Gap-Closure (GREEN) Summary

**Closed Gap A (mirror ACH_NACHA/FEDWIRE into the Zod export-format enum) and Gap B (thread the existing detectUsFormat into detectFormatForDestination + US-aware groupItemsByFormat, and surface the decrypted US routing/account into ExportItem) so the already-complete NACHA/Fedwire generators are now reachable end-to-end from a real payment run — restoring ROADMAP Success Criteria #1 and #4. Wiring only: no generator, serializer, dispatch, or Prisma enum member was reimplemented.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-07-01
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- **Gap A (Task 1) — enum parity GREEN:** `paymentExportFormatEnum` now reads `['CSV','BANK_FILE','SEPA_XML','SWIFT_XML','ACH_NACHA','FEDWIRE']`, a strict subset of the Prisma `PaymentExportFormat` source of truth. `lockAndExport`'s Zod input no longer rejects the US formats. `payment-export-format-parity` passes (subset + contains both).
- **Gap B (Task 2) — US routing + grouping GREEN:** `detectFormatForDestination` gained an amount-aware US branch between the BACS check and the IBAN fallback — USD to a US bank routes `ACH_NACHA` at/below the Same-Day ACH ceiling and `FEDWIRE` above it; a call omitting `amountMinor` skips the US branch and falls straight through (no silent ACH default). `groupItemsByFormat` is US-aware. `getFormatDetection` now routes through `detectFormatForDestination`, giving `detectUsFormat` a reachable production caller (SC#4). BACS/SEPA/SWIFT/PLN cases are unchanged. All 36 detection tests pass.
- **Gap B wiring (Task 3) — end-to-end GREEN:** `lockAndExport`'s `billingProfile` select surfaces the encrypted US columns; `_buildExportItems` decrypts them (only when both present) into `ExportItem.usRoutingNumber/usAccountNumber`. The `payment-us-export.e2e` proves a real `lockAndExport` USD run emits a balanced NACHA `.txt` whose 94-char detail records carry the **decrypted** routing (first 8 digits) + account — not the masked/empty fallback — and a Fedwire `pacs.008` `.xml` above the ceiling. The selected `exportFormat` flows through `_generateExportFileForFormat`'s pre-existing string dispatch unchanged.

## Task Commits

Each task committed atomically (with hooks, no `--no-verify`):

1. **Task 1: Gap A — mirror ACH_NACHA/FEDWIRE into the Zod enum** — `10d8edbe1` (feat)
2. **Task 2: Gap B — thread detectUsFormat into routing + grouping + advisory** — `62368ecf1` (feat)
3. **Task 3: Gap B wiring — decrypt + surface US routing/account into export items** — `a6a4e3697` (feat)

## Files Modified

- `packages/validators/src/payment.ts` — extended `paymentExportFormatEnum` with `ACH_NACHA`/`FEDWIRE`; updated the mirror comment to name the selectable file-export subset + the Prisma schema source of truth.
- `packages/api/src/services/payment-format-detection.ts` — `Destination` gained optional US signals; `detectFormatForDestination` gained the amount-gated US branch; `groupItemsByFormat` made US-aware.
- `packages/api/src/routers/finance/payment-export-router.ts` — `getFormatDetection` routed through `detectFormatForDestination` with a presence-only US signal; `lockAndExport` `billingProfile` select extended with the encrypted US columns.
- `packages/api/src/routers/finance/payment-shared.ts` — imported `decryptBankAccount`; widened `_buildExportItems`' `billingProfile` param with optional encrypted US fields; decrypts + populates the US routing/account on the export item.

## Verification

- `pnpm --filter @contractor-ops/api exec vitest run payment-export-format-parity payment-format-detection payment-us-export.e2e payment payment-export-nacha payment-export-fedwire payment-export-settlement` → **20 files / 314 tests pass**.
- `pnpm typecheck --filter=@contractor-ops/api` and `--filter=@contractor-ops/validators` → **clean**.
- `pnpm lint:logs` → **clean** (no `console.*`; decrypted routing/account never logged).
- `grep detectUsFormat packages/api/src --include='*.ts' | grep -v __tests__` → reachable production callers at `payment-format-detection.ts:195` (detectFormatForDestination) and `:250` (groupItemsByFormat); `detectFormatForDestination` is itself reached by `getFormatDetection`.
- `ach-return.service` tests remain **RED (5 failed)** — untouched, owned by 88-10.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `Destination` US fields made OPTIONAL, not required `string | null`**
- **Found during:** Task 2
- **Issue:** The plan's interface literal specified `usRoutingNumberEncrypted: string | null` (required, mirroring the UK pair). Required fields break the untouched no-regression tests: `makeDest` returns a `Destination` without the US pair, and `gbpUkDestination`/`eurDestination` are constructed without it. Requiring the fields would fail `pnpm typecheck` on those pre-existing (not-to-be-weakened) test destinations.
- **Fix:** Declared them optional (`usRoutingNumberEncrypted?: string | null`). A US bank is still detected only when BOTH are present (`Boolean(a && b)`), so behavior is identical; only the type is more permissive.
- **Files modified:** `payment-format-detection.ts`
- **Committed in:** `62368ecf1`

**2. [Rule 3 - Blocking / environment] libxmljs2 native addon compiled to run the full regression suite**
- **Found during:** Task 3 verification
- **Issue:** The worktree bootstrap used `pnpm install --ignore-scripts` (sanctioned for speed), which skips native build scripts. `payment.test.ts` and `payment-export-race.security.test.ts` transitively load `libxmljs2` (an approved `onlyBuiltDependencies` native addon for XML validation) and failed at **collection** with `Could not locate the bindings file` — before any of this plan's code ran. Not a code defect; unrelated to the wiring.
- **Fix:** Ran the package's own `prebuild-install` to fetch the prebuilt `xmljs.node` binding (no lockfile change, no new package — materialises an already-declared, already-approved dependency). Both suites then passed.
- **Files modified:** none (environment only).

### Out-of-scope (not fixed — SCOPE BOUNDARY)

- `pnpm lint:no-breadcrumbs` fails on **three sibling test files** — `pdf-templates/__tests__/us-determination-letter.test.tsx`, `services/__tests__/form-1042s.service.test.ts`, `services/__tests__/form-1099k-tracker.service.test.ts` (decision-ID comments). These belong to concurrent phase-87 tax-form work, are present in the base commit, and are **not** among this plan's four files. My four files pass the breadcrumb scan. Left untouched (a sibling agent owns them).

## Known Stubs

None. All four files carry production wiring; no placeholders or hardcoded empty values were introduced.

## Threat Flags

None new. Both threat-register mitigations for the touched surface are satisfied in code: the advisory (`getFormatDetection`) passes a presence sentinel — never the ciphertext (T-88-09-04); `_buildExportItems` decrypts only server-side, only when both fields are present, and the plaintext reaches only the file buffer — never a log or the export audit trail (T-88-09-01). The selected `exportFormat` is Zod-constrained and flows unchanged into the string dispatch (T-88-09-02).

## Doc-follows-code

Per the plan, the `us-payment-rail` domain wiki page + `api-routers-catalog` updates are owned by **88-11** (which synthesises the full US rail once Gap C lands). This plan is pure wiring of already-documented generators/enum members; no new router namespace, service, model, env var, or flag was introduced. The four modified files are covered by 88-11's domain-page scope; no new wiki drift is created by this change set beyond that already-planned page.

## Next Phase Readiness

- **88-10 (Gap C):** implement `ach-return.service.ts` against the locked contract (its 5 tests stay RED here).
- **88-11:** synthesise the `us-payment-rail` domain wiki page + `api-routers-catalog` entry now that the NACHA/Fedwire path is reachable end-to-end.

## Self-Check: PASSED

All four modified source files + the SUMMARY exist on disk; all three feat commits (`10d8edbe1`, `62368ecf1`, `a6a4e3697`) are present in the git log.

---
*Phase: 88-theme-a-us-payment-rail*
*Completed: 2026-07-01*
</content>
</invoke>
