# 101-04 SUMMARY — Postman + Insomnia collections + the drift-check CLI

**Status:** complete (committed artifacts deferred on the 98-11 snapshot) · **Wave:** 1 · **Requirements:** INTEG-DX-02

## What shipped

- `generate-postman.ts` — `generatePostman(spec)` → a Postman Collection v2.1: collection-level API-key auth
  (`Bearer {{apiKey}}`), a `{{baseUrl}}` variable, one request per snapshot path+method (grouped by tag),
  request bodies from the snapshot `example`. Deterministic.
- `generate-insomnia.ts` — `generateInsomnia(spec)` → an Insomnia v4 export (`_type:'export'`,
  `export_format:4`): a workspace + request group + a base environment (`baseUrl`/`apiKey`), one request
  resource per path+method with bearer auth. Stable ids, no timestamps → deterministic.
- `index.ts` — re-exports both emitters.
- `cli.ts` — `generate [--check]`: builds the committed collection artifacts from
  `apps/public-api/openapi.snapshot.json`; `--check` regenerates to memory and diffs the committed files,
  exiting non-zero on drift (the CI gate, mirroring the snapshot diff-check). Snapshot-conditional: while the
  snapshot is absent it logs and no-ops (exit 0), so CI never bricks before the snapshot exists.
- `@contractor-ops/logger` added to the package deps (the CLI uses structured logging, no `console.*`).

Greens `collection-generation.test.ts` (7/7). All 4 marketplace-manifests suites green (15/15).

## Deferred (blocked on the 98-11 snapshot)

The committed real collections (`apps/public-api/collections/{postman,insomnia}.json`) and the turbo/CI
wiring of `generate --check` are deferred because they need the real `apps/public-api/openapi.snapshot.json`,
which does not exist: Phase 98 was only partially executed (98-01..08), so 98-11's snapshot builder was never
created, and building the snapshot from the app requires the full production server env (SSN/ANTHROPIC/QSTASH
keys) which is unavailable in this environment. The emitters + the drift-check CLI are complete and verified
against the fixture; they produce the committed collections deterministically the moment the snapshot lands.
Recorded for the 101-10 EXTERNAL-ENABLEMENT close.

## Verification

- `pnpm --filter @contractor-ops/marketplace-manifests test` — GREEN (15/15).
- `pnpm --filter @contractor-ops/marketplace-manifests build` — clean.
- `node dist/cli.js generate --check` (snapshot absent) — no-op, exit 0.
