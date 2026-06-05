# Deferred Items — Phase 80

Out-of-scope discoveries logged during plan execution. NOT fixed here.

## 80-05

- **`@contractor-ops/secrets` build fails under `erasableSyntaxOnly`** —
  `packages/secrets/src/cached-store.ts:35` raises `TS1294: This syntax is not
  allowed when 'erasableSyntaxOnly' is enabled.` This surfaces when running
  `pnpm typecheck --filter=@contractor-ops/api` because the turbo `typecheck`
  task builds upstream workspace deps first. Pre-existing on base commit
  `55a97fe7` (erasableSyntaxOnly was enabled repo-wide in `d31087cd`); unrelated
  to plan 80-05 (which edits one api test file). The api package's own
  `tsc --noEmit` passes with zero errors. Out of scope for this verification plan.
