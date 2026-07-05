---
phase: 86-theme-a-tin-match-1099-nec-iris-e-file-state-filing
plan: 04
subsystem: iris
tags: [iris, 1099-nec, xsd, ack-parser, xxe, flag-defer, bundle-unavailable]
requirements-completed: [US-FORM-05, US-FORM-07]
completed: 2026-07-05
---

# Phase 86 Plan 04: IRIS XML pipeline (validate/skip) + single ack parser

**The deterministic IRIS 1099-NEC XML core (`buildIrisXml`) + `xsdValidate` were
pre-built by Phase 87's sibling-builder work; this plan reconciled the validator
to the flag-defer operating model (typed `BUNDLE_UNAVAILABLE` report, tests that
skip-and-auto-flip on the missing XSD bundle), added the golden fixture, and
built the single `iris-ack-parser` mapping all six IRIS statuses for both the
manual-upload and dark A2A paths.**

## What was built

### Task 1 — generator/validator reconciled to flag-defer + golden fixture
- `buildIrisXml` (XMLBuilder, Transmission Manifest + B-record + CFSF state code,
  last-4-only TIN) and `xsdValidate` (libxmljs2, `nonet:true`, default
  `noent:false`, lazy `getBundleDir`) already existed from P87's 1042-S sibling
  build — no rebuild needed.
- **`xsdValidate` now returns a distinct, non-throwing `BUNDLE_UNAVAILABLE`
  status** (added to `IrisValidationReport`) when the schema-bundle holds no
  `.xsd` — separating "could not validate" from a genuine `INVALID` schema
  rejection. A corrupt/malformed bundle still throws (programmer error). This is
  the safe pre-enablement state: with `module.us-expansion` OFF nothing calls it
  at runtime, and when it is called it never crashes.
- Added `packages/iris/src/__tests__/fixtures/golden-1099-nec.json` (one non-CFSF
  + one CFSF-participating GA recipient) and drove it from `generator.test.ts`
  (asserts the GA CFSF code + both box-1 dollar figures in the B-record).
- Added `packages/iris/src/__tests__/xsd-bundle-present.ts` — a runtime
  `hasXsdBundle()` detector + loud `XSD_HOLD_MESSAGE`.
- **The XSD-validation-passes assertions now skip-and-auto-flip.** In both
  `validator.test.ts` and `validator-1042s.test.ts` the "returns VALID" and
  "returns INVALID for a broken document" assertions are `it.skipIf(!bundlePresent)`
  and a `it.runIf(!bundlePresent)` test asserts the `BUNDLE_UNAVAILABLE`
  non-throwing contract (printing the HOLD banner). **No assertion was deleted,
  weakened, or faked** — the moment `.xsd` files land in `src/schema-bundle/`,
  `hasXsdBundle()` flips true and the skipped assertions run for real (RED→GREEN).

### Task 2 — single IRIS ack parser (both paths)
- `packages/api/src/services/iris-ack-parser.ts` — one `parseIrisAck(input)`
  accepting EITHER a manual-uploaded ack XML string OR the dark A2A poll-result
  object, returning `{ status, receiptId?, originalReceiptId?, errorInformation[] }`.
- Maps all six IRIS statuses to the Prisma `IrisAckStatus` enum
  (case/space/underscore/hyphen-insensitive), extracts the Error Information
  Group (tolerant of a few IRIS element-name variants — adviser-verify once the
  bundle lands) + `OriginalReceiptId`.
- **XXE/SSRF-safe:** XML parsed with `fast-xml-parser` (never resolves DTD /
  external entities, never touches the network) + an explicit DOCTYPE/ENTITY
  reject; the A2A object is `safeParse`d with Zod — the external payload is never
  `as`-cast.

## Tests / verification
- `pnpm --filter @contractor-ops/iris test` — 11 passed, 4 skipped (the four
  XSD-passes assertions; the two `BUNDLE_UNAVAILABLE` contract tests pass).
- `pnpm --filter @contractor-ops/iris typecheck` — green.
- `iris-ack-parser.test.ts` — 14 passed (six statuses × XML path, Error
  Information Group, OriginalReceiptId, A2A path, XXE guard, unrecognized status).
- `pnpm --filter @contractor-ops/api typecheck` — green.
- `pnpm lint:no-breadcrumbs` — OK.

## Deps
- Added `@contractor-ops/iris` (workspace) + `fast-xml-parser ^5.7.3` (already in
  the lockfile via iris/einvoice — no new external dependency, no age bypass) to
  `packages/api`.

## Deviations
- Generator/validator/`index.ts` were listed in the plan's `files_modified` but
  were already built by P87 (sibling 1042-S builder). Only the validator's
  missing-bundle branch + the report type changed. The 1042-S validator test was
  also reconciled to the skip-and-auto-flip pattern (same package, same gate) so
  the iris suite is fully green.

## Deferred / external gate
- XSD-validation-passes assertions remain skipped until the IRS IRIS XSD bundle
  is downloaded (IRS SOR login). Register row #1/#2 in
  `.planning/EXTERNAL-ENABLEMENT.md` unchanged.
