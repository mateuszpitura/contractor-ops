---
phase: 88-theme-a-us-payment-rail
verified: 2026-07-01T03:30:00Z
reverified: 2026-07-01T14:05:00Z
status: passed
score: 5/5 truths verified (initial gaps SC#1 + SC#4 closed by gap plans 88-08..88-12; SC#5 onboarding half wired; tin-match writer deferred to Phase 86 with recorded seam)
overrides_applied: 0
reverification:
  summary: "Gap plans 88-08 (RED scaffolds) → 88-09 (Gap A enum mirror + Gap B US-format wiring) → 88-10 (Gap C ACH return-code service) → 88-11 (Gap C reachable ingestAchReturnFile entry) → 88-12 (Plaid onboarding verifyBillingProfilePlaid + tin-match defer) closed the two FAILED truths and the SC#5 partial. Evidence: 66 gap tests green + reachability greps now positive."
  sc1_status: passed
  sc4_status: passed
  sc5_status: passed
  probes:
    - "paymentExportFormatEnum now includes ACH_NACHA + FEDWIRE (packages/validators/src/payment.ts:61-62); parity test asserts subset-of-Prisma + presence."
    - "detectUsFormat has production callers: payment-format-detection.ts:195 (detectFormatForDestination) + :250 (groupItemsByFormat); detectFormatForDestination is reachable via payment-export-router.ts:414 (getFormatDetection advisory)."
    - "lockAndExport produces NACHA .txt (<=ceiling) + Fedwire pacs.008 .xml (>ceiling) end-to-end carrying the item's decrypted US routing/account (payment-us-export.e2e green)."
    - "ACH return codes reachable: paymentCore.ingestAchReturnFile (payment-core.ts:425) → parseNachaReturnFile + applyAchReturns; R01/R02/R03 → FAILED, NOC/COR → advisory (ach-return.service + payment-ach-return green); idempotent + tenant-scoped + audited + unmatched signal."
    - "Plaid onboarding verify wired: paymentCore.verifyBillingProfilePlaid (payment-core.ts:499) runs MockPlaidIdentityClient and persists plaidVerificationStatus (advisory + fail-open); payout advisory read now has a real non-null status."
    - "tin-match backupWithholdingFlagged writer still has zero production callers BY DESIGN — explicitly deferred to Phase 86 (year-end batch owner) with the seam recorded in deferred-items.md (not a silent drop)."
gaps:
  - truth: "A payment run can export a balanced ACH NACHA file (PPD/CCD/CTX) as a new format in the existing payment-export factory, with valid effective-entry-date and return-code handling."
    status: closed
    closed_by: "88-09 (enum mirror + US-format wiring, lockAndExport reachable) + 88-10/88-11 (ACH return-code service + reachable ingestAchReturnFile)"
    reason: "generateNachaFile is real, unit-tested, and produces a spec-correct 94-char PPD/CCD/CTX file with a valid effective-entry-date field — but it is NOT reachable from any tRPC procedure. The only caller of the internal dispatch (_generateExportFileForFormat) is payment-export-router.ts's lockAndExport, whose Zod input (paymentRunLockSchema.exportFormat -> paymentExportFormatEnum in packages/validators/src/payment.ts) still only allows CSV | BANK_FILE | SEPA_XML | SWIFT_XML. Unlike BACS (which got its own dedicated bacs.ts router/procedure), NACHA has no equivalent reachable entry point. Additionally, ACH return-code (R01/R02/R03...) handling — explicitly named in the ROADMAP success criterion and in 88-CONTEXT.md — has zero implementation anywhere in the codebase (no parsing, no retry, no returned/failed payout status)."
    artifacts:
      - path: "packages/api/src/services/payment-export.ts"
        issue: "generateNachaFile (line 911) is correct and tested but has exactly one caller (_generateExportFileForFormat in payment-shared.ts), which itself has exactly one caller gated by an enum that excludes ACH_NACHA."
      - path: "packages/validators/src/payment.ts"
        issue: "paymentExportFormatEnum (line 50) = z.enum(['CSV','BANK_FILE','SEPA_XML','SWIFT_XML']) — never extended with 'ACH_NACHA' (or 'BACS_STD18', 'FEDWIRE')."
    missing:
      - "A reachable tRPC procedure (mirroring bacs.ts's dedicated router) or an extended paymentExportFormatEnum that lets an org actually select/generate an ACH_NACHA file end-to-end."
      - "ACH return-code (R01/R02/R03...) ingestion/handling + retry, or an explicit, documented descope of that clause with an override."
  - truth: "A Fedwire wire-transfer file (ISO 20022 pacs.008) exports for high-value payouts above the Same-Day ACH ceiling, with the ceiling held as a config value (not a constant)."
    status: closed
    closed_by: "88-09 (detectUsFormat threaded into detectFormatForDestination + reachable via getFormatDetection; ceiling routes FEDWIRE vs ACH_NACHA end-to-end)"
    reason: "generateFedwirePacs008 and the dated sameDayAchCeilingMinor() config function are both real and unit-tested (boundary-tested at the ceiling and at the 2027 transition). But detectUsFormat — the function that actually applies the ceiling to route FEDWIRE vs ACH_NACHA — is never called from any production code path (grep across packages/api/src confirms zero call sites outside its own definition and test files). Combined with the same paymentExportFormatEnum gap above, there is no way for a real payment run to produce a Fedwire file today."
    artifacts:
      - path: "packages/api/src/services/payment-format-detection.ts"
        issue: "detectUsFormat (line 193) is defined and unit-tested but has zero production callers; the ceiling-based routing it implements never executes outside tests."
    missing:
      - "A production call site for detectUsFormat (auto-routing a US payout run) and a reachable procedure/enum member for FEDWIRE, mirroring the fix needed for ACH_NACHA above."
  - truth: "A US contractor bank account is verifiable via Plaid Identity at onboarding; an unverified status produces an advisory warning and never blocks the payout."
    status: closed
    closed_by: "88-12 (verifyBillingProfilePlaid onboarding trigger writes plaidVerificationStatus via MockPlaidIdentityClient, advisory + fail-open)"
    reason: "The 'never blocks' half is fully verified: initiatePayout reads PaymentRunItem.billingProfile.plaidVerificationStatus per item (tenant-scoped) and surfaces a non-blocking advisory warning when unverified or the profile is null — tested for fail-open behavior and tenant isolation. The 'verifiable at onboarding' half is not wired: grep across packages/api confirms no production code ever calls PlaidIdentityClient.verify / MockPlaidIdentityClient, and there is no write path anywhere to ContractorBillingProfile.plaidVerificationStatus outside migrations/tests. This may be an accepted consequence of the deliberately deferred live Plaid SDK/Link integration (which needs end-user interaction) — but even a mock-triggerable onboarding verification call was not wired, so plaidVerificationStatus can never become non-null in the shipped state, meaning the payout path will always take the 'unverified' branch."
    artifacts:
      - path: "packages/integrations/src/adapters/plaid/plaid-identity-client.ts"
        issue: "Interface + mock + dark-live concrete exist and are unit-tested in isolation but have no production caller anywhere in packages/api or apps/*."
    missing:
      - "Either a human decision to defer 'verifiable at onboarding' to the live-Plaid-Link phase (with an override), or a minimal onboarding trigger (even against the mock) that writes plaidVerificationStatus."
deferred: []
human_verification:
  - test: "Confirm whether 'ACH return-code (R01/R02/R03...) handling + retry' and 'NACHA/Fedwire selectable end-to-end via a real procedure' were meant to ship in Phase 88 or were silently descoped during planning."
    expected: "Either a closure plan wires a reachable NACHA/Fedwire export entry point (mirroring bacs.ts) + return-code handling, or the developer records an explicit override accepting the current unreachable-but-tested state for this milestone."
    why_human: "This is a scope/intent question — the ROADMAP wording explicitly promises this behavior and the 88-04 SUMMARY asserts (incorrectly, per source inspection) that 88-06 would make it reachable end-to-end. Only a human can decide whether to close this now or explicitly accept the deviation."
  - test: "Confirm whether 'Plaid verifiable at onboarding' is intentionally deferred alongside the live SDK, or whether a minimal mock-triggerable onboarding flow should ship in this milestone."
    expected: "A recorded decision (override or closure plan)."
    why_human: "Judgment call on acceptable phase-88 scope vs a genuine gap; the advisory-read half is solid, only the write/trigger half is missing."
---

# Phase 88: Theme A — US Payment Rail Verification Report

**Phase Goal:** US and cross-border payouts settle through ACH/wire rails with USD as a first-class currency and optional programmatic initiation.
**Verified:** 2026-07-01T03:30:00Z
**Status:** passed — re-verified 2026-07-01 after gap closure (plans 88-08..88-12)
**Re-verification:** Yes — initial verdict was `gaps_found` (SC#1 + SC#4 FAILED, SC#5 PARTIAL); the gap plans below closed all three.

## Re-verification — Gap Closure (2026-07-01)

Gap plans **88-08 → 88-12** closed the two FAILED truths and the SC#5 partial. The downstream generators (`generateNachaFile`, `generateFedwirePacs008`), the string dispatch in `_generateExportFileForFormat`, and the Prisma enum members already existed — the failures were reachability wiring, now landed:

- **SC#1 → PASS.** `paymentExportFormatEnum` mirrors `ACH_NACHA`/`FEDWIRE` (validators/src/payment.ts:61-62), so `lockAndExport` accepts them; `_buildExportItems` decrypts + surfaces the item's US routing/account into `ExportItem`; the pre-existing dispatch reaches `generateNachaFile`. **ACH return-code handling now exists and is reachable**: `ach-return.service.ts` (`parseNachaReturnFile` + `mapReturnCodeToStatus` R01/R02/R03→FAILED, NOC/COR→advisory + idempotent tenant-scoped `applyAchReturns`) behind `paymentCore.ingestAchReturnFile` (payment-core.ts:425), US-gated + `payment:export`-gated + audited + `{failed,advisory,skipped,unmatched}` summary.
- **SC#4 → PASS.** `detectUsFormat` now has production callers (payment-format-detection.ts:195 in `detectFormatForDestination`, :250 in `groupItemsByFormat`); `detectFormatForDestination` is reachable via the `getFormatDetection` advisory (payment-export-router.ts:414). A USD-to-US-bank run ≤ Same-Day-ACH ceiling routes `ACH_NACHA`, above it `FEDWIRE`; the e2e proves NACHA `.txt` + Fedwire pacs.008 `.xml` emit end-to-end.
- **SC#5 → PASS.** `paymentCore.verifyBillingProfilePlaid` (payment-core.ts:499) runs `MockPlaidIdentityClient` and persists `ContractorBillingProfile.plaidVerificationStatus` (+ `plaidVerifiedAt`, `plaidAccountId`), advisory + fail-open (never throws/blocks); the payout advisory read now has a real non-null status to differentiate.
- **Supplementary (tin-match) — deferred, not dropped.** `createBackupWithholdingFlagWriter`/`createDbTinMatchPersistence` keep zero production callers **by design**: explicitly deferred to **Phase 86** (year-end batch owner) with the seam recorded in `deferred-items.md`.

**Re-verification evidence:** `pnpm --filter @contractor-ops/api exec vitest run payment-export-format-parity payment-format-detection payment-us-export.e2e ach-return.service payment-ach-return payment-plaid-onboarding` → **6 files / 66 tests passed** on the merged main; reachability greps (above) now positive; `check:wiki-brain` 0 errors.

## Goal Achievement

### Observable Truths (ROADMAP.md Success Criteria, verbatim)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A payment run can export a balanced ACH NACHA file (PPD/CCD/CTX), with valid effective-entry-date and return-code handling. | PASS (closed 88-08..88-11 — see Re-verification) | `generateNachaFile` (payment-export.ts:911) is real, hand-rolled, zero-dep, 94-char records, correct entry hash, control totals, 10-line blocking, PPD/CCD/CTX-parameterizable, effective-entry-date populated (batch header). **Unreachable in production**: the only caller chain is `_generateExportFileForFormat` → `payment-export-router.ts` `lockAndExport`, whose Zod input is gated by `paymentExportFormatEnum = z.enum(['CSV','BANK_FILE','SEPA_XML','SWIFT_XML'])` (packages/validators/src/payment.ts:50) — `ACH_NACHA` was never added. No dedicated router (unlike `bacs.ts`) was built. **Return-code (R01/R02/R03…) handling is entirely absent** — zero occurrences anywhere in the merged codebase (confirmed via exhaustive grep). |
| 2 | USD is selectable as a first-class currency with per-org default, exchange-rate sourcing, and settlement-currency choice on cross-border payouts. | VERIFIED | `exchange-rate.ts` `convertAmount` is byte-unchanged and confirmed to have no `USD=1.0` short-circuit — USD cross-rates through the real stored EUR↔USD rate; same-currency short-circuits to rate 1; missing rate returns `null` (read in full, lines 262-321). `payment-settlement.ts` `resolveSettlementCurrency`/`convertForSettlement` exist and are genuinely wired: reachable via `lockAndExport` → `_buildExportItems` (payment-shared.ts:334/339) AND via `initiatePayout` → `_initiatePayoutForRun` (payment-shared.ts:750/754). 28 currency/settlement tests + the full 304-test payment suite pass. |
| 3 | An opt-in org can initiate programmatic ACH payouts via a Modern Treasury / Stripe Treasury adapter on the integration framework. | VERIFIED | `payment-core.ts` `initiatePayout` tenantProcedure exists, gated by `requirePermission({payment:['export']})` + `assertUsExpansionEnabled` + the existing `payments.ach-payouts` flag (dark default); `.strict()` Zod input; idempotent via `reserve/complete/clear` (tested — no double-pay); `writeAuditLog` on init (masked-only metadata); `PayoutInitiationAdapter` interface + deterministic `MockModernTreasuryAdapter` (default) + dark `LiveModernTreasuryAdapter` + `StripeTreasuryAdapter` stub all exist and compile with zero new dependencies (`git diff` on package.json confirms no modern-treasury/stripe/plaid SDK added). 10/10 payout-init tests + tenant-isolation test pass. |
| 4 | A Fedwire wire-transfer file (ISO 20022 pacs.008) exports for high-value payouts above the Same-Day ACH ceiling, ceiling as config (not constant). | PASS (closed 88-09 — see Re-verification) | `generateFedwirePacs008` and `sameDayAchCeilingMinor(asOf)` (dated $1M → $10M 2027-09-17 config, not a constant) both exist and are unit/boundary-tested. **`detectUsFormat`, the function that applies the ceiling to route FEDWIRE vs ACH_NACHA, is never called from any production code path** (grep confirms zero call sites outside its own file/tests). Same unreachable-enum problem as Truth 1 — no procedure can request `FEDWIRE`. |
| 5 | A US contractor bank account is verifiable via Plaid Identity at onboarding; an unverified status produces an advisory warning and never blocks the payout. | PASS (onboarding half wired 88-12 — see Re-verification) | The **advisory / never-blocks** half is solid and tested: `initiatePayout` → `_initiatePayoutForRun` reads `PaymentRunItem.billingProfile.plaidVerificationStatus` via a tenant-scoped include and surfaces a non-blocking warning when unverified/null (fail-open unit-tested, tenant-isolation unit-tested). The **"verifiable at onboarding"** half has no production caller: `PlaidIdentityClient`/`MockPlaidIdentityClient` are exported from the integrations barrel but never invoked by any router/service in `packages/api` or `apps/*`, and there is no write path anywhere to `ContractorBillingProfile.plaidVerificationStatus` outside migrations/tests. |

**Score:** 3/5 ROADMAP success criteria fully verified (2 FAILED, with 1 of the 3 "verified" truths carrying an additional partial/WARNING finding below).

### Supplementary Finding (affects Truth 1's mechanics, not separately scored)

The US 24% backup-withholding branch of `applyWithholding` (88-03) is fully implemented, unit-tested, and reachable via `seedRunItems` (called from `payment-core.ts:177`, confirmed wired). However `Contractor.backupWithholdingFlagged` can never become `true` in production today: `createBackupWithholdingFlagWriter` (tin-match.service.ts:339) and `createDbTinMatchPersistence` (tin-match.service.ts:290) have **zero production callers** — the P86 year-end batch/staff router that is supposed to consume them does not exist yet or does not call this factory. This was **honestly disclosed** in the 88-03 SUMMARY ("documented downstream follow-up," not hidden) — unlike the NACHA/Fedwire reachability gap, which the 88-04 SUMMARY incorrectly asserted would be resolved by 88-06 (it was not: `initiatePayout` calls the `PayoutInitiationAdapter` directly and never touches `_generateExportFileForFormat`/`generateNachaFile`).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/api/src/services/payment-export.ts::generateNachaFile` | NACHA generator | VERIFIED (exists, substantive) / ORPHANED (not wired to any reachable procedure) | 94-char records, entry hash, blocking, PPD/CCD/CTX, effective-entry-date all correct; single caller chain dead-ends at an enum that excludes it. |
| `packages/api/src/services/payment-export.ts::generateFedwirePacs008` | Fedwire pacs.008 generator | VERIFIED (exists, substantive) / ORPHANED | Same reachability issue as NACHA. |
| `packages/api/src/services/payment-format-detection.ts::detectUsFormat` | USD+US-bank routing incl. ceiling | VERIFIED (exists, substantive) / ORPHANED | Zero production call sites. |
| `packages/db/prisma/schema/payment.prisma` (`ACH_NACHA`, `FEDWIRE`) | Export-format enum members | VERIFIED | Present, UPPER_SNAKE_CASE, passes enum-casing audit (pre-existing unrelated offenders in `idp-deprovisioning.prisma` confirmed out of scope). |
| `packages/db/prisma/schema/contractor.prisma` (`backupWithholdingFlagged`, US bank pairs, Plaid fields) | Schema for withholding + US bank + Plaid | VERIFIED | All present, additive, nullable; `prisma validate` passes; migration `20260701000000_phase88_us_payment_rail_schema` committed (production apply explicitly deferred per local-only posture — not a phase-88 gap per instructions). |
| `packages/api/src/services/payment-settlement.ts` | `resolveSettlementCurrency` + `convertForSettlement` | VERIFIED, WIRED, DATA FLOWING | Consumed by both `_buildExportItems` and `_initiatePayoutForRun`. |
| `packages/api/src/routers/finance/payment-shared.ts` (`applyWithholding`/`applyWithholdingToRun`) | Jurisdiction-agnostic withholding | VERIFIED, WIRED | Called from `seedRunItems`, called from `payment-core.ts:177`. SA regression green. US 24%/1042-S branches correct, but see Supplementary Finding on the flag-writer trigger. |
| `packages/integrations/src/adapters/payout/*` | PayoutInitiationAdapter seam | VERIFIED, WIRED | Interface + mock + dark live + Stripe stub; consumed by `_initiatePayoutForRun`; builds with zero external deps. |
| `packages/integrations/src/adapters/plaid/*` | PlaidIdentityClient seam | VERIFIED (exists, substantive) / ORPHANED (no onboarding-trigger caller) | Advisory-read consumer (payment-shared.ts) exists and works; the verification-initiation half has no caller. |
| `packages/api/src/routers/finance/payment-core.ts::initiatePayout` | Opt-in payout-init procedure | VERIFIED, WIRED, DATA FLOWING | Gated, idempotent, audited, settlement-aware, Plaid-advisory-aware. |
| `.planning/brain/wiki/domains/us-payment-rail.md` + integrations/modern-treasury.md + integrations/plaid.md | Documentation-follows-code | VERIFIED | All exist, contain "source of truth" language, `verify_with` points at real shipped files; `pnpm check:wiki-brain` → 0 errors, 1 pre-existing WARN (mixed source_commit prefixes, unrelated). |
| `.planning/MEMORY.md` | Withholding-source-of-truth invariant | VERIFIED | Entry present at line 134. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `payment-shared.ts _generateExportFileForFormat` | `payment-export.ts generateNachaFile/generateFedwirePacs008` | format dispatch branch | WIRED (internal) | Dispatch branches correct (lines 247/258). |
| Any tRPC procedure | `_generateExportFileForFormat` with `format='ACH_NACHA'\|'FEDWIRE'` | client-supplied `exportFormat` | **NOT_WIRED** | `paymentExportFormatEnum` excludes both values; no alternate procedure exists. |
| `payment-format-detection.ts detectUsFormat` | Same-Day ACH ceiling config | `sameDayAchCeilingMinor` param | WIRED (internal, function-level) / **NOT_WIRED (production call site)** | Function itself correctly takes the ceiling as a parameter; never called in production. |
| `payment-shared.ts _buildExportItems` | `payment-settlement.ts resolveSettlementCurrency/convertForSettlement` | settle-before-export | WIRED | Confirmed at payment-shared.ts:334/339; reachable via `lockAndExport`. |
| `payment-core.ts initiatePayout` | `payment-settlement.ts` (per-run override) | Zod `settlementCurrency` → `resolveSettlementCurrency` | WIRED | Confirmed at payment-shared.ts:750/754. |
| `payment-core.ts initiatePayout` | `PaymentRunItem.billingProfile.plaidVerificationStatus` | tenant-scoped include | WIRED | Read-only advisory; fail-open + tenant-isolation tested. |
| tin-match batch/router (P86) | `createDbTinMatchPersistence`/`createBackupWithholdingFlagWriter` | writers injection | **NOT_WIRED** | Zero production callers found; disclosed in 88-03 SUMMARY as a downstream follow-up. |
| Onboarding flow | `PlaidIdentityClient.verify`/`MockPlaidIdentityClient` | verification trigger | **NOT_WIRED** | Zero production callers found anywhere in the repo. |
| `payment-core.ts seedRunItems` | `applyWithholdingToRun` | withholding deduction at seeding | WIRED | Confirmed at payment-shared.ts:172, called from payment-core.ts:177. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `initiatePayout` payout amount | settled amount | `convertForSettlement` → `convertAmount` (real ECB-rate DB query) | Yes (or throws `UNPROCESSABLE_CONTENT` on missing rate — never zeros) | FLOWING |
| `_buildExportItems` export amount | settled amount | same seam | Yes | FLOWING |
| `applyWithholdingToRun` withheld amount | `whtAmountMinor` | `calculateWht`/`applyTreaty`/24% branch, real DB-backed rate resolution | Yes, when the upstream trigger condition is true | FLOWING (mechanism), but see Supplementary Finding — `backupWithholdingFlagged` trigger is never set in production |
| `initiatePayout` Plaid advisory | `plaidVerificationStatus` | direct Prisma read | Always `null` in production today (no writer) — the mechanism is correct but the input is permanently absent | STATIC (upstream write missing) |
| NACHA/Fedwire generated file | export buffer | `generateNachaFile`/`generateFedwirePacs008` | Correct when called | DISCONNECTED — no production caller ever supplies real payment-run data to these functions |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase-88 API unit suite (7 files) | `pnpm --filter @contractor-ops/api exec vitest run payment-export-nacha payment-export-fedwire payment-withholding payment-currency payment-format-detection payment-settlement payment-payout-init` | 73/73 passed | PASS |
| Integrations adapter suite | `pnpm --filter @contractor-ops/integrations exec vitest run modern-treasury plaid` | 10/10 passed | PASS |
| Full payment regression suite | `pnpm --filter @contractor-ops/api exec vitest run payment` | 304/304 passed (18 files) | PASS |
| API typecheck | `pnpm typecheck --filter=@contractor-ops/api` | 14/14 tasks successful | PASS |
| DB + integrations typecheck | `pnpm typecheck --filter=@contractor-ops/db --filter=@contractor-ops/integrations` | 9/9 successful | PASS |
| Prisma schema validity | `prisma validate` | "schemas at prisma/schema are valid" | PASS |
| Enum-casing audit | `pnpm --filter @contractor-ops/db run db:audit-enum-casing` | 5 pre-existing offenders in `idp-deprovisioning.prisma` (Phase 77, unrelated); `ACH_NACHA`/`FEDWIRE` NOT flagged | PASS (phase-88 scope clean) |
| Breadcrumb lint | `pnpm lint:no-breadcrumbs` | OK | PASS |
| Wiki-brain gate | `pnpm check:wiki-brain` | 0 errors, 1 pre-existing WARN | PASS |
| Reachability of `ACH_NACHA`/`FEDWIRE` via `lockAndExport` | source read of `paymentExportFormatEnum` | Enum excludes both values | FAIL (see gaps) |
| Reachability of `detectUsFormat` in production | `grep -rn detectUsFormat packages/api/src --include=*.ts \| grep -v __tests__` | Zero hits outside definition | FAIL (see gaps) |
| Reachability of `PlaidIdentityClient.verify` in production | same grep pattern | Zero hits | FAIL (see gaps) |
| Reachability of `createDbTinMatchPersistence`/`createBackupWithholdingFlagWriter` | same grep pattern | Zero hits | FAIL (disclosed pre-existing scope boundary — see Supplementary Finding) |

### Probe Execution

Step 7c: SKIPPED — no `scripts/*/tests/probe-*.sh` files declared by this phase's PLAN/SUMMARY docs, and none found under conventional probe paths.

### Requirements Coverage

| Requirement | Source Plan(s) | Description (REQUIREMENTS.md) | Status | Evidence |
|--------------|----------------|----------------------------------|--------|----------|
| US-PAY-01 | 88-01, 88-02, 88-03, 88-04, 88-07 | ACH NACHA file (PPD/CCD/CTX) as a new format in the payment-export factory (same shape as BACS/SWIFT/Elixir/SEPA) | **BLOCKED** | Generator exists and passes its own tests, but is not reachable "as a new format" the way BACS/SWIFT/Elixir/SEPA are (those are all selectable through a real procedure; NACHA is not). |
| US-PAY-02 | 88-05, 88-04, 88-07 | USD first-class currency, per-org default, exchange-rate sourcing, settlement-currency choice | SATISFIED | Fully wired and reachable via both the file-export and programmatic-payout paths. |
| US-PAY-03 | 88-06, 88-07 | Programmatic ACH payouts via Modern Treasury / Stripe Treasury adapter (opt-in, v2.0 integration framework) | SATISFIED | `initiatePayout` gated, idempotent, audited, tested. |
| US-PAY-04 | 88-04, 88-07 | Fedwire wire-transfer format for high-value cross-border payouts above the Same-Day ACH ceiling | **BLOCKED** | Generator + config ceiling exist and are tested, but `detectUsFormat` is never invoked and `FEDWIRE` is unreachable through any procedure. |
| US-PAY-05 | 88-06, 88-02, 88-07 | Verify US contractor bank accounts at onboarding via Plaid Identity (anti-fraud) | **NEEDS HUMAN** | The advisory-read/fail-open half is satisfied; the "verify at onboarding" half has no production trigger. |

No orphaned requirements — all 5 US-PAY-* IDs declared across the 7 plans' frontmatter are present in REQUIREMENTS.md, and vice versa.

### Anti-Patterns Found

None. Scanned all phase-88-modified production files (`payment-export.ts`, `payment-format-detection.ts`, `payment-settlement.ts`, `exchange-rate.ts`, `payment-shared.ts`, `payment-core.ts`, the payout + plaid adapters, `tin-match.service.ts`) for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/"not yet implemented" — zero blocking hits (two harmless doc comments using the phrase "not available" describing a missing FX rate, not a debt marker).

### Human Verification Required

#### 1. NACHA/Fedwire end-to-end reachability — scope decision

**Test:** Decide whether Phase 88 must ship a reachable NACHA/Fedwire export entry point (e.g., extend `paymentExportFormatEnum` + wire `detectUsFormat`, or add a dedicated router mirroring `bacs.ts`) and ACH return-code handling, or accept the current state (generators built/tested but unreachable) via an explicit override.
**Expected:** Either a closure plan lands the missing wiring, or an override is recorded in this file's frontmatter with a reason + acceptance.
**Why human:** This is a scope/intent judgment — the ROADMAP wording explicitly promises the behavior, and the 88-04 SUMMARY's claim that 88-06 would close this gap did not hold up under source inspection.

#### 2. Plaid "verifiable at onboarding" — scope decision

**Test:** Decide whether the onboarding-time Plaid verification trigger is intentionally deferred alongside the live SDK, or whether a minimal (even mock-only) trigger should ship now.
**Expected:** A recorded decision (override or closure plan).
**Why human:** The advisory/fail-open consumption is solid; only the initiation side is missing, and it may be reasonably tied to the deferred live-SDK/Plaid-Link UI work.

### Gaps Summary

Phase 88 delivered a large, well-tested body of payment-rail code (USD/settlement-currency wiring and the opt-in Modern Treasury/Stripe programmatic-ACH path are both genuinely wired and reachable end-to-end — Success Criteria 2 and 3 pass cleanly with 304/304 regression tests green). However, two of the five ROADMAP success criteria are not actually achievable by an end user or operator today:

1. **NACHA and Fedwire file generation (SC#1, SC#4) are built and unit-tested but structurally unreachable** — the only tRPC procedure that could invoke them (`lockAndExport`) validates its input against a Zod enum that was never extended to include `ACH_NACHA`/`FEDWIRE`, and no dedicated router (unlike `bacs.ts`) was created. `detectUsFormat`, which implements the Same-Day-ACH-ceiling routing rule, has zero production callers. This directly contradicts the 88-04 plan's own must-have ("a payment run exports a NACHA file") and its SUMMARY's claim that 88-06 would make the branches "reachable end-to-end" (it does not — `initiatePayout` calls the adapter directly and never touches the file-generation path).
2. **ACH return-code (R01/R02/R03…) handling**, explicitly named in the ROADMAP success criterion, has no implementation anywhere in the merged codebase.
3. Two secondary findings (Plaid onboarding-trigger wiring, and the tin-match `backupWithholdingFlagged` writer having zero production callers) mean two of the conditional branches inside otherwise-correct, well-tested deduction/advisory logic can never actually fire in production today. Both were either honestly disclosed (tin-match) or plausibly tied to the deliberately deferred live-SDK work (Plaid) — flagged for a human scope decision rather than as unambiguous blockers.

None of these gaps are related to the explicitly out-of-scope items the user identified (multi-region production migration apply, the pre-existing `rbac-recipients.test.ts` failure, or the pre-existing `check:no-process-env` ratchet drift) — all of those were independently spot-checked and confirmed pre-existing/unrelated to phase 88's changes.

---

*Verified: 2026-07-01T03:30:00Z*
*Verifier: Claude (gsd-verifier)*
