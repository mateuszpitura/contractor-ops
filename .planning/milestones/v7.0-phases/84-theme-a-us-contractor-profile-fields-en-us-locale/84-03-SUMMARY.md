---
phase: 84-theme-a-us-contractor-profile-fields-en-us-locale
plan: 03
subsystem: security
tags: [aes-256-gcm, ssn, pii, rbac, better-auth, prisma, pino, encryption]

# Dependency graph
requires:
  - phase: 84-01
    provides: SSN_ENCRYPTION_KEY hex-32 env var (env.ts + minimal-server-env.ts + .env.example)
  - phase: 84-00
    provides: ssn-crypto.test.ts RED scaffold (Wave 0)
  - phase: 83
    provides: db push / direct-ALTER fallback posture (migrate dev drift-blocked)
provides:
  - "Contractor.ssnEncrypted/ssnLast4/uspsVerified/uspsValidatedAt columns (additive-nullable, applied to live dev DB)"
  - "ssn-crypto.ts encryptSsn/decryptSsn (AES-256-GCM, dedicated SSN_ENCRYPTION_KEY) + maskSsnLast4"
  - "contractorPii:['read'] Better Auth permission granted to owner/admin/finance_admin only"
  - "ssn/ein pino PII_MASK_PATHS + countryFields variants"
affects: [84-04, 84-05, 84-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dedicated-key field encryption (SSN_ENCRYPTION_KEY separate from BANK_ACCOUNT_ENCRYPTION_KEY) for blast-radius isolation"
    - "New Better Auth access-control statement edited in BOTH permissions.ts and the roles.ts allPermissions owner-duplicate"

key-files:
  created:
    - packages/api/src/services/ssn-crypto.ts
  modified:
    - packages/db/prisma/schema/contractor.prisma
    - packages/auth/src/permissions.ts
    - packages/auth/src/roles.ts
    - packages/auth/src/__tests__/permissions.test.ts
    - packages/auth/src/__tests__/roles.test.ts
    - packages/logger/src/pii-mask.ts
    - packages/logger/src/__tests__/index.test.ts

key-decisions:
  - "SSN stored in dedicated encrypted columns, never countryFields JSONB (D-01) — prevents leak via wholesale getCountryFields read path"
  - "SSN keyed by a SEPARATE SSN_ENCRYPTION_KEY, not BANK_ACCOUNT_ENCRYPTION_KEY (blast-radius isolation, D-01)"
  - "contractorPii:read granted to owner/admin/finance_admin ONLY; external_accountant + 6 others DENIED (D-09 data-minimization)"
  - "Columns applied via direct additive ALTER (db push fallback); prisma migrate dev avoided (pre-existing drift); per-region production apply deferred (Phase 82/83 posture)"

patterns-established:
  - "Pattern: dedicated-key AES-256-GCM column crypto mirroring bank-account-crypto.ts with its own env key"
  - "Pattern: new RBAC permission requires editing accessControlStatement AND the roles.ts allPermissions duplicate to avoid owner drift (Pitfall 2)"

requirements-completed: [US-FIELD-02]

# Metrics
duration: 7min
completed: 2026-06-08
---

# Phase 84 Plan 03: SSN Security Foundation Summary

**SSN encrypt-at-rest in dedicated Contractor columns (AES-256-GCM, dedicated SSN_ENCRYPTION_KEY) + contractorPii:read RBAC granted to owner/admin/finance_admin only + ssn/ein pino log-masking.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-06-08T14:04:00Z
- **Completed:** 2026-06-08T14:12:00Z
- **Tasks:** 3
- **Files modified:** 8 (1 created, 7 modified)

## Accomplishments
- Four additive-nullable columns (`ssnEncrypted`, `ssnLast4`, `uspsVerified`, `uspsValidatedAt`) added to `Contractor`, applied to the live dev DB via direct ALTER, and the Prisma client regenerated — before any reader (Plan 05 depends on this).
- `ssn-crypto.ts` shipped: `encryptSsn`/`decryptSsn` (AES-256-GCM, `iv:authTag:ciphertext`) keyed by the dedicated `SSN_ENCRYPTION_KEY`; Plan 00 RED test now GREEN (6/6).
- `contractorPii:['read']` registered in the Better Auth access-control statement and granted to `owner` (via the `allPermissions` owner-duplicate, Pitfall 2), `admin`, and `finance_admin`; the other 7 roles (incl. `external_accountant`) deny. Full 10-role matrix test added.
- `*.ssn`/`*.ein` (+ casing + `countryFields` variants) added to pino `PII_MASK_PATHS`; `ssn`/`ein` added to `PII_MASK_KEYWORDS`; logger redaction test extended.

## Task Commits

Each task committed atomically:

1. **Task 1: [BLOCKING] additive Contractor columns — push to dev DB + regenerate client** - `1737a6f7` (feat)
2. **Task 2: ssn-crypto.ts (AES-256-GCM, dedicated key)** - `2a725efb` (feat — Plan 00 RED→GREEN)
3. **Task 3: contractorPii:read permission + grants + pii-mask** - `8b7757d8` (feat)

_Note: the ssn-crypto RED test (`ssn-crypto.test.ts`) was committed in Plan 00; Task 2 is the GREEN implementation commit._

## Files Created/Modified
- `packages/api/src/services/ssn-crypto.ts` (created) - AES-256-GCM SSN encrypt/decrypt + `maskSsnLast4`, keyed by `SSN_ENCRYPTION_KEY`.
- `packages/db/prisma/schema/contractor.prisma` - `ssnEncrypted`/`ssnLast4`/`uspsVerified`/`uspsValidatedAt` on `Contractor` (all nullable).
- `packages/auth/src/permissions.ts` - `contractorPii: ['read']` in `accessControlStatement`.
- `packages/auth/src/roles.ts` - `contractorPii: ['read']` in `allPermissions` (owner dup) + `admin` + `finance_admin`.
- `packages/auth/src/__tests__/permissions.test.ts` - added `contractorPii` (and missing `compliance`) to the resource-list assertion.
- `packages/auth/src/__tests__/roles.test.ts` - 10-role `contractorPii` grant/deny matrix + owner-dup regression guard.
- `packages/logger/src/pii-mask.ts` - `*.ssn`/`*.ein` paths (+ casing + `countryFields` variants) + `ssn`/`ein` keywords.
- `packages/logger/src/__tests__/index.test.ts` - ssn/ein redaction assertions (fresh-pino-over-sink harness).

## Decisions Made
- None beyond the plan's locked decisions (D-01, D-09). All followed as specified.
- Used a direct additive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` via the `pg` driver against `DATABASE_URL` because `packages/db` has no `db:push` script and the schema datasource has no `url` block (driver-adapter setup) — this is the Phase 82/83 "db push fallback / direct ALTER" posture. **Per-region production column apply deferred.**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Restored missing `compliance` resource to the access-control test assertion**
- **Found during:** Task 3 (contractorPii permission)
- **Issue:** `permissions.test.ts`'s `expectedResources` length-check omitted the `compliance` resource (present in `accessControlStatement` since Phase 73). At HEAD the list had 19 entries vs the statement's 20 keys — a pre-existing latent mismatch the count assertion would surface. Adding `contractorPii` (21st key) made the gap visible.
- **Fix:** Added both `contractorPii` and the long-missing `compliance` to `expectedResources` (21 == 21).
- **Files modified:** packages/auth/src/__tests__/permissions.test.ts
- **Verification:** `pnpm --filter @contractor-ops/auth test` — 8 files / 78 tests pass.
- **Committed in:** `8b7757d8` (Task 3 commit)

**2. [Rule 3 - Blocking] Rebuilt stale `@contractor-ops/validators` dist so `SSN_ENCRYPTION_KEY` surfaces in `getServerEnv()` types**
- **Found during:** Post-Task-3 cross-package typecheck (`pnpm --filter @contractor-ops/api typecheck`)
- **Issue:** Plan 84-01 added `SSN_ENCRYPTION_KEY` to `env.ts` source but the package's built `dist/*.d.ts` (consumed by the `api` package's tsc) was stale, so `getServerEnv().SSN_ENCRYPTION_KEY` errored TS2339 in `ssn-crypto.ts` (runtime test passed; only the type was stale).
- **Fix:** `pnpm --filter @contractor-ops/validators build`. `dist/` is gitignored — no file changes to commit.
- **Verification:** `pnpm --filter @contractor-ops/api typecheck` clean afterward.
- **Committed in:** N/A (build artifact, gitignored)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both necessary for a clean build/test pass. No scope creep — neither added functionality beyond the plan.

## Issues Encountered
- `pnpm lint:logs` reports one **pre-existing, out-of-scope** unredacted-body failure at `apps/api/src/routes/csp-report.ts:86` (commit `e320911b`, ~13 days old; untouched by this plan; the `body`/`*.body` redact paths already censor the value at runtime). Logged to `deferred-items.md`; NOT fixed here per the scope-boundary rule.

## Known Stubs
None — all delivered code is wired and tested. The `uspsVerified`/`uspsValidatedAt` columns are intentionally unread until Plan 84-04 (USPS adapter); the `ssnEncrypted`/`ssnLast4` columns are intentionally unread until Plan 84-05 (reveal procedure + write path). These are the load-bearing foundation columns this plan exists to land ahead of those readers (documented as such in the plan).

## User Setup Required
None - no external service configuration required. `SSN_ENCRYPTION_KEY` was added to env schemas + `.env.example` in Plan 84-01; a dev value must be present for SSN writes (Plan 84-05).

## Next Phase Readiness
- Plan 84-04 (USPS adapter) can read/write `uspsVerified`/`uspsValidatedAt`.
- Plan 84-05 (reveal procedure + UI) can call `encryptSsn`/`decryptSsn`/`maskSsnLast4`, write `ssnEncrypted`/`ssnLast4`, and gate the reveal procedure on `contractorPii:read`.
- **Deferred (production):** per-region production apply of the four columns (dev DB only so far, Phase 82/83 posture).

## Self-Check: PASSED

All created/modified files present on disk; all three task commits (`1737a6f7`, `2a725efb`, `8b7757d8`) present in git history.

---
*Phase: 84-theme-a-us-contractor-profile-fields-en-us-locale*
*Completed: 2026-06-08*
