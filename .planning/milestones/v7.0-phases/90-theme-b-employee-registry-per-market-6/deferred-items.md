# Phase 90 — Deferred Items

Out-of-scope discoveries logged during plan execution (NOT fixed here).

## From Plan 90-02 (validators GREEN)

- **`employee-country-fields.test.ts` fails at module resolution** — this Plan-01
  RED scaffold imports `../employee-country-fields.js`, a module owned by a LATER
  wave (the `employee-country-fields.ts` country-fields registry). It is NOT in
  90-02's `files_modified` (90-02 ships only `employee-validators.ts`,
  `employee-reference-lists.ts`, and `reference-data/*`). Left RED by design; flips
  GREEN when the country-fields registry wave lands. The `-- employee-validators`
  vitest filter incidentally matches this file by substring, but the in-scope
  `employee-validators.test.ts` suite is fully GREEN (36/36) when run in isolation.
