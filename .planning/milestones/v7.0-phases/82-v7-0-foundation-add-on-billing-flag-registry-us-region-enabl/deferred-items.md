# Phase 82 — Deferred / Out-of-Scope Items (logged during execution)

These are pre-existing issues discovered during plan execution that are OUT OF SCOPE
(not caused by the current plan's changes). Logged per the SCOPE BOUNDARY rule.

## 82-02 (US region enablement)

- **`packages/api/src/routers/__tests__/feature-flags.test.ts` fails to collect (0 tests).**
  Error: `[vitest] No "prismaRaw" export is defined on the "@contractor-ops/db" mock.`
  The test's `vi.mock("@contractor-ops/db")` is stale — it does not return `prismaRaw`,
  which `compliance-reminder-scan.ts` (transitively imported) now requires.
  Pre-existing (last touched by commit `ac66ff76`, before this plan); imports none of the
  files 82-02 modified (region.ts / replica.ts / schemas.ts / feature-flag.ts middleware / env.ts).
  Fix = add `prismaRaw` to that test's db mock. Not done here (out of scope; would be a
  separate test-debt fix).

- **`pnpm check:no-process-env` reports ~25 offender lines (158+ total occurrences)** across
  `apps/public-api/**`, etc. All pre-existing; none in files 82-02 modified. 82-02's env access
  is via the Zod schema (`packages/validators/src/env.ts`) — correct, not flagged.
