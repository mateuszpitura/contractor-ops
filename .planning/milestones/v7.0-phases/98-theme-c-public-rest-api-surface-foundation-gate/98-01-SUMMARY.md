# 98-01 SUMMARY — deps + Zod-4↔zod-openapi metadata spike

**Wave:** 0 · **Status:** done

## Spike VERDICT: **A (validators-authored schemas register)**

Downstream plans (98-05, 98-07, 98-08, 98-09, 98-10) author route DTOs in
`@contractor-ops/validators` (plain `zod`) and pass them straight to `createRoute`. For named SDK
component models, add a Zod-4 native `.meta({ id: '<Name>' })` in validators — no package `z`
required. Query DTOs need no name (always inlined as `parameters`). Full detail in
`98-SPIKE-FINDINGS.md`.

## What landed
- Pinned exact ≥7-day deps in `apps/public-api`: `@hono/zod-openapi@1.4.0` (57 days old) +
  `@scalar/hono-api-reference@0.11.6` (9 days old). Both resolve against existing `hono@4.12.18`;
  a transitive `@hono/zod-validator@0.8.0` came along. Speakeasy NOT added (CI-only binary, plan 98-11).
- `apps/public-api/src/__tests__/openapi-metadata-spike.test.ts` — 3 green tests proving: 3.1 doc
  emitted; validators query params surface; validators `.meta({id})` response registers a named
  component (identical to package `z` `.openapi()`).
- `98-SPIKE-FINDINGS.md` with the locked Verdict A.

## Supply-chain gate (human-verify, pre-approved)
- `pnpm audit` + `pnpm security:scan`: **no advisory routes through either new package** (confirmed by
  path grep). The 53 advisories are the pre-existing repo baseline (undici via web-vite/jsdom + cms/
  payload, js-yaml via cms, turbo, hono `<4.12.21`/`<4.12.25`) — all predate this change. `security:scan`
  exits 1 on that baseline audit only (secret-scan portion clean); the gate condition "fails on these
  new packages" is NOT met, so execution proceeds.

## Notes
- `packages/validators/src/legal/de.js` + `de.d.ts` are pre-existing tracked build artifacts that the
  worktree's first `pnpm install`/postinstall `turbo build` reformatted. Left UNSTAGED (not restored —
  git-safety) so commits stay clean; they clean up with the worktree.
