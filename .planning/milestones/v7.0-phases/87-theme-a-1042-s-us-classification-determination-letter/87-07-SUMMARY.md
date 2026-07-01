---
phase: 87-theme-a-1042-s-us-classification-determination-letter
plan: 07
subsystem: api
tags: [1042-s, iris, pub-1187, fast-xml-parser, libxmljs2, xsd, ftin, transmit, cross-phase-hold]

# Dependency graph
requires:
  - phase: 87-01
    provides: iris schema-bundle skeleton + checksum guard; 1042-S generator/validator RED scaffolds; deferred human Pub 1187 XSD checkpoint
  - phase: 87-02
    provides: Form1042S Prisma model (used by the held transmit path, not by the generator/validator)
  - phase: 87-04
    provides: form-1042s.service + staff form1042s router (us-expansion gated) — the transmit/ack procedures append here when P86 lands
  - phase: 86
    provides: base IRIS buildIrisXml/xsdValidate (landed); TaxFilingTransmitter seam + iris-ack-parser (NOT yet landed — still it.todo)
provides:
  - "buildIris1042SXml: sibling 1042-S IRIS builder via fast-xml-parser XMLBuilder (no string concat) — Transmission Manifest + 1042-S recipient record with income code, box 2 gross income, ch3/ch4 exemption + rate, box 7 withheld, 13j/13k status, 13n LOB, treaty article; masked last-4 FTIN only"
  - "xsdValidate1042S: form-parameterized libxmljs2 { nonet: true } / noent:false validation against the checksum-pinned Pub 1187 bundle (code complete; VALID case XSD-gated)"
  - "form-parameterized bundle loader (validateAgainstBundle) so a form-specific entry is never substituted from another form's XSD"
affects: [87-08, 1042-s-transmit, iris, form-1042s-router]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sibling 1042-S builder rather than a parameterized 1099 builder — distinct Pub 1187 record layout (ch3/ch4 status/exemption codes, income codes, treaty fields); shares the Transmission Manifest shape + the XMLBuilder instance"
    - "Per-form XSD entry selection in the validator (ENTRY_MATCHERS + per-form memoized loader) — a missing 1042-S XSD reports missing rather than validating against the 1099 schema"

key-files:
  created: []
  modified:
    - packages/iris/src/generator.ts
    - packages/iris/src/validator.ts
    - packages/iris/src/types.ts
    - packages/iris/src/index.ts

key-decisions:
  - "buildIris1042SXml is a sibling builder (not a parameterized 1099 builder): the Pub 1187 record layout differs materially, so it gets its own recipient record while sharing the Transmission Manifest shape and the fast-xml-parser XMLBuilder"
  - "Validator loader is now form-keyed: each form's payload XSD is selected by filename (ENTRY_MATCHERS) with per-form memoization; the 1099 fallback-to-first-XSD behavior was dropped so a form never silently validates against another form's schema"
  - "Withholding rate is emitted as a two-decimal percent string derived from basis points (1500 -> '15.00'); amounts convert minor units to whole US dollars (shared toUsAmount). Element names + code formatting are adviser-verify against i1042s Appendix B/C when the pinned XSD lands"
  - "Task 2 (transmit) is a documented cross-phase HOLD: the P86 TaxFilingTransmitter seam + iris-ack-parser are not on disk (still it.todo). No rebuild — form-1042s-transmit.service.ts was NOT created and no procedures were added to form-1042s-router.ts / root.ts"

patterns-established:
  - "1042-S generator/validator mirror the P86 1099 IRIS layer (XMLBuilder + libxmljs2 { nonet: true }) with a distinct record shape and its own bundle entry matcher"

requirements-completed: []  # US-FORM-06 already recorded by 87-04 (deterministic core); this plan delivers the generator/validator half — the transmit half is HELD on the P86 seam

# Metrics
duration: 25min
completed: 2026-07-01
---

# Phase 87 Plan 07: 1042-S IRIS Generator + Validator, Transmit Held Summary

**Sibling `buildIris1042SXml` + form-parameterized `xsdValidate1042S` land GREEN (generator + the two non-VALID validator cases); the 1042-S transmit is a clean cross-phase HOLD on the unlanded P86 TaxFilingTransmitter seam, and the validator VALID case stays RED behind the deferred human Pub 1187 XSD.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-01T11:24:00Z
- **Completed:** 2026-07-01T11:48:40Z
- **Tasks:** 1 of 2 built (Task 2 held — cross-phase)
- **Files modified:** 4

## Accomplishments

- `buildIris1042SXml` sibling builder implemented via fast-xml-parser `XMLBuilder` (never string concatenation): emits a Transmission Manifest carrying the schema version, a `WithholdingAgent`, and a 1042-S recipient record with the box fields (income code, box 2 gross income, ch3/ch4 exemption + rate, box 7 withheld, 13j/13k recipient status, 13n LOB, treaty article). Only the caller-supplied masked last-4 FTIN reaches the payload — the full FTIN is never reconstructed or emitted (asserted in the generator test).
- `xsdValidate1042S` implemented against the checksum-pinned Pub 1187 bundle with `libxmljs2 { nonet: true }` (no SSRF) + default `noent: false` (no XXE). The bundle loader is now form-parameterized (`validateAgainstBundle` + `ENTRY_MATCHERS` + per-form memoization) so a missing 1042-S XSD reports missing rather than falling back to the 1099 schema.
- `generator-1042s.test.ts` GREEN (3/3); `validator-1042s.test.ts` 2/3 GREEN (INVALID + nonet cases). No regressions to the P86 1099 suite (`generator.test.ts` 3/3, `validator.test.ts` unchanged). `pnpm typecheck` + `biome check` on `@contractor-ops/iris` pass.

## Task Commits

Each task was committed atomically:

1. **Task 1: buildIris1042SXml + 1042-S XSD validator (sibling builder)** — `604fc54b1` (feat)
2. **Task 2: 1042-S transmit via the P86 TaxFilingTransmitter seam** — HELD (no commit; cross-phase HOLD, see Deferred Items)

## Files Created/Modified

- `packages/iris/src/generator.ts` — added `buildIris1042SXml` + `build1042SRecipientRecord` + `toRatePercent`; shares the module `XMLBuilder` and `toUsAmount`.
- `packages/iris/src/validator.ts` — added `xsdValidate1042S`; refactored the entry-schema loader to a form-keyed `validateAgainstBundle` core with `ENTRY_MATCHERS` and per-form memoization; `xsdValidate` (1099) preserved as a thin wrapper.
- `packages/iris/src/types.ts` — added `Iris1042SSubmissionInput`, `Iris1042SRecipient`, `Iris1042SWithholdingAgent`.
- `packages/iris/src/index.ts` — export `buildIris1042SXml`, `xsdValidate1042S`, and the new types.

## Verification

| Check | Result |
|-------|--------|
| `generator-1042s.test.ts` | GREEN (3/3) — Transmission Manifest version, box fields, no full-FTIN leak |
| `validator-1042s.test.ts` | 2/3 GREEN (INVALID + nonet); VALID case RED (XSD-gated — see Deferred Items) |
| P86 `generator.test.ts` / `validator.test.ts` | No new regressions (1099 VALID case remains pre-existing XSD-gated RED) |
| `pnpm --filter @contractor-ops/iris typecheck` | GREEN |
| `pnpm --filter @contractor-ops/iris lint` (biome) | GREEN |
| `grep -c buildIris1042SXml generator.ts` / `grep -c nonet validator.ts` | 1 / 4 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] biome format on the new validator core signature**
- **Found during:** Task 1 (post-implementation lint)
- **Issue:** `validateAgainstBundle(...)` was written multi-line; biome's formatter requires the short signature on a single line.
- **Fix:** collapsed the signature to one line.
- **Files modified:** `packages/iris/src/validator.ts`
- **Commit:** `604fc54b1`

Otherwise the generator/validator task executed as written.

## Deferred Items

### 1. XSD GATE (Task 1) — validator VALID case RED, deferred (consistent with 87-01)

The 1042-S Publication 1187 XSD is a human IRS-SOR download deferred in Plan 87-01 Task 3 — it is not in `packages/iris/src/schema-bundle/` and `checksums.txt` is empty. The `xsdValidate1042S` **code is complete and correct-by-construction** (form-keyed bundle loader, `{ nonet: true }`, `noent: false`), but with no XSD present it returns the `XSD-BUNDLE-MISSING` report, so `validator-1042s.test.ts` "returns VALID for a golden output" stays RED. No XSD was fabricated. This matches the pre-existing P86 `validator.test.ts` 1099 VALID case, which is RED for the same reason. Both go GREEN once the human places + pins the XSD (`pnpm --filter @contractor-ops/iris exec tsx scripts/verify-iris-schema-checksums.ts --write`).

### 2. P86 SEAM HOLD (Task 2) — 1042-S transmit held, no rebuild

The P86 `packages/api/src/services/tax-filing-transmitter.ts` + `iris-ack-parser.ts` are **not on disk** — their test scaffolds are still P86 Wave-0 `it.todo`, and no `TaxFilingTransmitter` symbol exists in `packages/api/src`. Per the plan's cross-phase gate, Task 2 is HELD and the P86 seam was **not** rebuilt:

- `packages/api/src/services/form-1042s-transmit.service.ts` was **not** created.
- No transmit / ack-upload procedures were added to `form-1042s-router.ts`; `root.ts` was **not** touched.

All downstream dependencies for Task 2 already exist and are ready for when P86 lands the seam GREEN: `form-1042s-router.ts` (87-04), `lib/idempotency.ts`, `services/audit-writer.ts`, `middleware/require-us-expansion-flag.ts`. When the seam lands, add `form-1042s-transmit.service.ts` reusing the seam form-type-parameterized (ManualDownload default / IrisA2A dark behind `module.iris-efile` / Vendor stub) + the single ack parser, idempotent + `writeAuditLog({ action: 'form1042s.transmit' })`, and append the two procedures to `form-1042s-router.ts` (Zod `.strict()`, `assertUsExpansionEnabled`).

**The phase is not blocked overall:** the deterministic core (Plans 03–06) and the 1042-S model/service/PDF/router (Plan 04) are already GREEN; this plan adds the generator/validator half of US-FORM-06, with the transmit half held on the declared cross-phase dependency.

## Threat Model Coverage

| Threat ID | Disposition | Status |
|-----------|-------------|--------|
| T-87-07-03 (full FTIN in XML) | mitigate | DONE — last-4 only; asserted in the generator test |
| T-87-07-05 (string-concat XML) | mitigate | DONE — fast-xml-parser XMLBuilder only |
| T-87-07-02 (XXE / SSRF via XSD import) | mitigate | DONE (code) — `{ nonet: true }` + `noent: false`; effective once the bundle lands |
| T-87-07-01 (tampered/unpinned XSD) | mitigate | Inherited from 87-01 — checksum guard already in place; enforced when the XSD lands |
| T-87-07-04 (double-transmit / repudiation) | mitigate | HELD with Task 2 — idempotency + audit apply to the transmit path when the P86 seam lands |

## Known Stubs

None. The RED `validator-1042s` VALID case is an XSD-gated deferral (documented above), not a code stub — the validator logic is complete.

## Self-Check: PASSED

- `packages/iris/src/generator.ts` contains `buildIris1042SXml` — FOUND
- `packages/iris/src/validator.ts` contains `nonet` (4×) + `xsdValidate1042S` — FOUND
- Commit `604fc54b1` — FOUND on `worktree-agent-a8a24a1fd93a2667d`
- `form-1042s-transmit.service.ts` — correctly ABSENT (Task 2 held)
