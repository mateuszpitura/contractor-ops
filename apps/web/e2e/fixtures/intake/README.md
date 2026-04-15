# Phase 62 e-invoice intake Playwright fixtures

Deterministic fixtures consumed by
`apps/web/e2e/functional/intake-upload-flow.spec.ts` and
`apps/web/e2e/functional/zugferd-download-flow.spec.ts`.

All three fixtures are text-diffable — no committed binaries. The PDF
fixture is stored as base64 text so changes show up cleanly in PR diffs
and CI produces byte-stable output.

## Manifest

| File                            | Purpose                                      | SHA-256 (of file bytes)                                            |
| ------------------------------- | -------------------------------------------- | ------------------------------------------------------------------ |
| `comfort-minimal.pdf.base64`    | Valid ZUGFeRD COMFORT PDF/A-3 B              | `329477900f0b21eac553c0d8e4bd47dcef46670a4380b4e6138c785677c3476e` |
| `malformed.xml`                 | XML that fails the CII_PARSE_FAILED path     | `6c81c507ebd73dd304f12032bad18eddbb1ec0b7b48f7419ab9b33bb8c139e50` |
| `xrechnung-with-warnings.xml`   | XSD-valid CII with KoSIT schematron warnings | `8f154d96003f15d0150397458f14b93420899bac70a360978502ed1064650f21` |

The SHA-256 of the *decoded* `comfort-minimal.pdf` bytes is
`2a022d92ddd8e56bf1c6e3e0f7544c80b989d6e8f2f8d40c316f5426e2547208` —
this value is stable because the generator uses a pinned
`producedAt = 2026-01-15T10:00:00Z` and a deterministic FNV-1a `/ID`
derivation (Plan 62-03 Task 5).

## Regenerating

### `comfort-minimal.pdf.base64`

The PDF is produced by the Plan 62-03 generator using the pinned
`comfort-minimal.json` fixture input. Regenerate with:

```sh
pnpm --filter @contractor-ops/einvoice exec tsx \
  scripts/generate-zugferd-fixtures.ts --out-dir /tmp/zfe2e
base64 -i /tmp/zfe2e/comfort-minimal.pdf \
  > apps/web/e2e/fixtures/intake/comfort-minimal.pdf.base64
```

The generator is byte-deterministic for the same fixture input, so the
refreshed file matches the committed SHA-256 exactly. If the hash moves,
either (a) the generator changed, or (b) an asset (Noto Sans, sRGB ICC,
or fixture JSON) was updated — both cases deserve a commit message
explaining the intentional change.

### `malformed.xml`

A literal 44-byte file. Regenerate via:

```sh
printf '<?xml version="1.0"?>\n<not-closed-properly>\n' \
  > apps/web/e2e/fixtures/intake/malformed.xml
```

It is deliberately not closed — the Plan 62-02 CII parser exits with
`CII_PARSE_FAILED` on the first pass.

### `xrechnung-with-warnings.xml`

Copied verbatim from the Phase 61 KoSIT negative fixture that lacks
`BT-10` (buyer reference). The XSD validates, the KoSIT schematron rule
`BR-DE-15` fires a warning — exactly the "soft-gate" path the intake
detail page renders.

```sh
cp packages/einvoice/src/profiles/xrechnung-de/__tests__/fixtures/kosit-negative-missing-bt10.xml \
   apps/web/e2e/fixtures/intake/xrechnung-with-warnings.xml
```

## Why not commit binary PDFs?

The intake flow is end-to-end — a Playwright spec upload expects raw
bytes. Base64 keeps the committed artifact text-diffable while the spec
can decode it at runtime (a single `Buffer.from(text, 'base64')` call).
This mirrors the Plan 62-03 fixture generator which itself never
commits PDFs — all binary outputs are derived.
