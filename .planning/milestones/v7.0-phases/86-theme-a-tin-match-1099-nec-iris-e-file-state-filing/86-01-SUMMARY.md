---
phase: 86-theme-a-tin-match-1099-nec-iris-e-file-state-filing
plan: 01
subsystem: us-year-end-filing
status: paused-at-checkpoint
tags: [iris, 1099-nec, tin-match, xsd, wave-0, red-scaffold, supply-chain-guard]
dependency_graph:
  requires:
    - "packages/einvoice validator-bundle layout (checksum-pin + provenance template)"
    - "packages/logger createLogger (no console.* mandate)"
  provides:
    - "@contractor-ops/iris workspace package (vitest config + schema-bundle dir)"
    - "verify-iris-schema-checksums.ts CI guard (SHA-256 pin over bundled IRS XSDs)"
    - "9 Wave-0 RED test scaffolds (the executable Nyquist contract for Waves 1-N)"
  affects:
    - "packages/api (services + pdf-templates + security test scaffolds)"
    - "vitest.monorepo.ts (iris project registered)"
tech_stack:
  added:
    - "@contractor-ops/iris — new private workspace package (no new external dep)"
  patterns:
    - "XSD supply-chain checksum guard mirroring einvoice validator-bundle"
    - "terminal-RED Wave-0 scaffolds (resolution-fail) — P82/P84 posture"
key_files:
  created:
    - packages/iris/package.json
    - packages/iris/tsconfig.json
    - packages/iris/vitest.config.ts
    - packages/iris/scripts/verify-iris-schema-checksums.ts
    - packages/iris/src/schema-bundle/README.md
    - packages/iris/src/schema-bundle/source.txt
    - packages/iris/src/schema-bundle/checksums.txt
    - packages/iris/src/__tests__/generator.test.ts
    - packages/iris/src/__tests__/validator.test.ts
    - packages/api/src/services/__tests__/tin-match.service.test.ts
    - packages/api/src/services/__tests__/form-1099-nec.service.test.ts
    - packages/api/src/services/__tests__/iris-ack-parser.test.ts
    - packages/api/src/services/__tests__/tax-filing-transmitter.test.ts
    - packages/api/src/pdf-templates/__tests__/form-1099-nec-copy-b.test.tsx
    - packages/api/src/__tests__/security/tax-filing-tenant-isolation.security.test.ts
  modified:
    - vitest.monorepo.ts
    - pnpm-lock.yaml
decisions:
  - "D-01: XSD-validate-in-CI seam established via the new iris package + checksum guard (mirrors einvoice KoSIT)."
  - "D-18: source.txt carries the adviser-verify provenance note + the exact TY2025 v2.0 (posted 2025-11-06) IRS SOR package to fetch."
  - "Reused fast-xml-parser ^5.7.3 + libxmljs2 ^0.37.0 verbatim from einvoice — zero NEW external deps (T-86-01-SC: accept, no legitimacy checkpoint)."
  - "iris package registered in vitest.monorepo (groupOrder 18) so vitest --project iris and the root run pick it up."
metrics:
  duration_min: 5
  tasks_completed: 2
  tasks_total: 3
  files_created: 15
  files_modified: 2
  completed_date: 2026-06-16
---

# Phase 86 Plan 01: Wave-0 RED Contract + IRIS Schema-Validation Foundation Summary

Established the new `@contractor-ops/iris` workspace package (mirroring the
`packages/einvoice` validator-bundle + checksum-guard layout), a CI SHA-256
checksum guard that pins every bundled IRS XSD, and the full set of 9 Wave-0
RED test scaffolds from `86-VALIDATION.md`. Paused at the `checkpoint:human-action`
gate: the IRS IRIS XSD package must be downloaded from the IRS Secure Object
Repository (IRS-login-only) before checksums can be pinned and the
generator/validator turn RED → GREEN.

## What Was Built

### Task 1 — `@contractor-ops/iris` package + checksum guard (commit `8cf11edd5`)
- New private workspace package: `package.json` (name `@contractor-ops/iris`,
  `test: vitest run`, `verify:schema-checksums` script), `tsconfig.json`,
  `vitest.config.ts` — all mirroring `packages/einvoice`.
- Dependencies `fast-xml-parser ^5.7.3` + `libxmljs2 ^0.37.0` reused **byte-for-byte**
  from einvoice — no new external dependency, no version bump (7-day-release-age
  rule untouched; the threat register `T-86-01-SC` accepts this with no legitimacy
  checkpoint).
- `scripts/verify-iris-schema-checksums.ts`: recursively hashes every `.xsd`
  under `src/schema-bundle/` with `node:crypto` `createHash('sha256')`, compares
  against `checksums.txt`, and exits non-zero on any mismatch, pinned-but-missing
  file, or unlisted `.xsd`. `--write` pins the freshly-downloaded bundle. Uses
  `@contractor-ops/logger` (`createLogger`) — **no `console.*`**.
- `src/schema-bundle/`: `README.md` (explains the bundle, the SSRF/`nonet:true`
  invariant, the pin workflow), `source.txt` (IRS SOR provenance — TY2025 v2.0
  posted 2025-11-06 — plus the D-18 adviser-verify note), and an empty
  `checksums.txt` (populated at the human-action checkpoint).
- Registered `iris` in `vitest.monorepo.ts` (groupOrder 18).
- Verified: guard runs clean against the empty bundle (structured WARN, exit 0).

### Task 2 — 9 Wave-0 RED scaffolds (commit `93431e58c`)
All scaffolds import the not-yet-built modules and fail RED at module
resolution (terminal-RED accepted for Wave 0, matching the P82/P84 posture):
- `iris/generator.test.ts` — `buildIrisXml` emits the Transmission Manifest
  VersionNum/VersionDt + the CFSF state code in the payee B-record; full TIN
  never leaks (US-FORM-05/07).
- `iris/validator.test.ts` — `xsdValidate` reports VALID for a `buildIrisXml`
  golden output and INVALID with per-error detail for a broken document
  (US-FORM-05).
- `tin-match.service.test.ts` — mismatch sets the backup-withholding flag +
  creates an escalation and never hard-blocks (D-12); 24h cache hit avoids a
  re-call (D-10); retry on transient failure (US-FORM-03).
- `form-1099-nec.service.test.ts` — box-1 aggregated by payment date per
  recipient per payer-org, FX-converted to USD (D-06); `$600` TY2025 vs
  `$2,000` TY2026 threshold (Pitfall 1); CORRECTED supersede chain — prior
  ACTIVE → SUPERSEDED then new ACTIVE inserted, supersede-before-insert (D-08)
  (US-FORM-04).
- `iris-ack-parser.test.ts` — maps all six IRIS statuses + Error Information
  Group + `OriginalReceiptId` (US-FORM-05, D-04).
- `tax-filing-transmitter.test.ts` — factory selects `ManualDownload` by default;
  `IrisA2A` only when `module.iris-efile` is enabled (D-03, US-FORM-05).
- `form-1099-nec-copy-b.test.tsx` — Copy-B PDF renders to a non-empty Buffer and
  shows the TIN last-4 only (US-FORM-04, D-09).
- `tax-filing-tenant-isolation.security.test.ts` — a second org cannot read
  another org's `Form1099Nec`/`IrisSubmission` rows (D-16).

> The 9th scaffold is the two-file iris pair (generator + validator) counted
> alongside the 7 API/security scaffolds = 8 files, 9 asserted behaviors per the
> 86-VALIDATION anchor rows.

## Deviations from Plan

None — plan executed exactly as written through Task 2. Two pre-commit
adjustments resolved during authoring (not behavioral deviations):
- The guard script's logger import was corrected from a non-existent
  `createServiceLogger` to the real `createLogger({ service })` factory after
  verifying `packages/logger/src/index.ts` exports.
- `vi` import was added to `form-1099-nec.service.test.ts` (used by the
  supersede-chain mock).
- Biome reformatted whitespace / import-alias ordering on commit (cosmetic).

## Checkpoint Reached (Task 3 — `human-action`)

Task 3 is a `checkpoint:human-action` gate. The IRS IRIS XSD schema package is
NOT on npm and NOT in-tree; it is downloaded from the IRS Secure Object
Repository, which requires an IRS account login an automated agent cannot
perform. **No XSD was fabricated and nothing was downloaded from a non-IRS
source.** The empty `checksums.txt` + the guard are in place so that, once the
human places the real `.xsd` files, a single `--write` run pins them and the
generator/validator scaffolds can begin turning GREEN in later waves.

### Resume instructions
1. Log in to irs.gov → "IRIS Schemas and Business Rules" page / Secure Object
   Repository (SOR).
2. Download the TY2025 (v2.0) IRIS Schema & Business Rules package; place every
   `.xsd` (preserving directory structure) under
   `packages/iris/src/schema-bundle/`. Confirm the 1099-NEC payload XSD + the
   Transmission Manifest XSD are present.
3. Pin checksums:
   `pnpm --filter @contractor-ops/iris exec tsx scripts/verify-iris-schema-checksums.ts --write`
4. Verify the guard passes:
   `pnpm --filter @contractor-ops/iris verify:schema-checksums` (exit 0).
5. Record the schema VersionNum/VersionDt the bundle was built against (Pitfall 4)
   and update `source.txt`'s `sha256:` line with the package hash.

## Known Stubs

The empty `checksums.txt` is an intentional, documented placeholder — it is
populated at the human-action checkpoint (step 3 above). All Wave-0 test files
are intentional RED scaffolds (the implementations they import are built in
later waves of Phase 86). Neither is a UI-rendering stub.

## Verification

- `@contractor-ops/iris` package installed + linked (offline cache lacked the
  dep metadata; a normal `pnpm install` linked the existing einvoice deps with
  no fresh fetch).
- Checksum guard exits 0 against the empty bundle (WARN: not-yet-bundled).
- All 9 Wave-0 scaffolds FAIL RED (resolution-fail); `form-1099-nec.service`
  test exits non-zero as the plan's verify command requires.
- `grep -c "console."` is 0 in the guard script + both named test files.

## Self-Check: PASSED

All 15 created files + the SUMMARY exist on disk; both task commits
(`8cf11edd5`, `93431e58c`) are present in git history.
