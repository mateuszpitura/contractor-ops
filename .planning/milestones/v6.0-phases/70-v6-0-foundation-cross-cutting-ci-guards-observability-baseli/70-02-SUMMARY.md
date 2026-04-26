---
phase: 70-v6-0-foundation-cross-cutting-ci-guards-observability-baseli
plan: 02
subsystem: testing

requires:
  - phase: 70-01
    provides: failing schema-guard test scaffold + fixture trees + lint-guards package skeleton

provides:
  - "runSchemaGuard({ files, allowlist }) — pure async function, line-based Prisma SDL parser, comment-stripping, returns SchemaGuardOffence[]"
  - "GLOBAL_LOOKUP_MODELS_ALLOWLIST typed `as const satisfies readonly string[]` with 16 categorised exempt models, each annotated with a `// reason: ...` comment"
  - "formatSchemaOffences(offences) — D-03 structured-diff formatter"
  - "scripts/lint-schema.mjs — tsx-shebang CLI entrypoint walking packages/db/prisma/schema/**/*.prisma"
  - "Root package.json `pnpm lint:schema` script"
  - "docs/lint-remediation/lint-schema.md remediation doc with the required #missing-organization-id and #allowlisting-a-global-lookup-model anchors"

affects: [70-06]

tech-stack:
  added: ["tinyglobby (root devDep, was already a transitive dep)", "tsx (root devDep — was already used by packages/db/scripts/push-all-regions.ts)"]
  patterns: ["Line-based comment-stripping parser preserves line numbers via replace-with-whitespace; allowlist categorisation in source comments serves as documentation"]

key-files:
  created:
    - packages/lint-guards/src/schema-guard/global-lookup-allowlist.ts
    - packages/lint-guards/src/schema-guard/run-guard.ts
    - packages/lint-guards/src/schema-guard/format-offence.ts
    - scripts/lint-schema.mjs
    - docs/lint-remediation/lint-schema.md
  modified:
    - packages/lint-guards/src/index.ts (re-export schema-guard surface)
    - packages/feature-flags/tsconfig.json (exclude src/**/__tests__ — fixes Wave 0 build break)
    - package.json (lint:schema script + tsx + tinyglobby devDeps)
    - pnpm-lock.yaml

key-decisions:
  - "Line-based parser (not @mrleebo/prisma-ast / Prisma's official parser) — fits the dependency budget (T-70-01-03), and the only feature we need is `find a model and check its field names`. The parser strips both `//` and `/* */` comments before scanning so commented-out `organizationId` fields cannot satisfy the gate (T-70-02-02 mitigation)."
  - "Allowlist scope expanded beyond the original 7-entry plan list to cover the 16 real existing models that legitimately have no organizationId. Categorised in source comments (Global reference data / Tenant root / Auth identity / System+cron / Junction)."
  - "CLI uses `#!/usr/bin/env tsx` shebang and is invoked via `tsx scripts/lint-schema.mjs` — Node 24 deprecated `--loader` so `register('tsx/esm', ...)` fails at runtime; tsx as the runner is the documented modern path."
  - "Side-effect fix: `packages/feature-flags/tsconfig.json` now excludes `src/**/__tests__` to match the existing logger/db/validators pattern. Without this, the Wave 0 failing-test scaffolds (which import not-yet-existing modules) broke the postinstall tsc build."

patterns-established:
  - "Per-guard CLI lives at `scripts/lint-<name>.mjs` and is invoked via `pnpm lint:<name>` (D-04 — three independent scripts, no umbrella)."
  - "Structured-diff failure output: `[lint:<name>] FAIL: <count> ...` header + per-offence block with offending/file/expected/remediation lines (D-03)."
  - "Allowlist constants use `as const satisfies readonly string[]` for compile-time enforcement (D-02)."

requirements-completed: [FOUND6-01]

duration: 35min
completed: 2026-04-26
---

# Phase 70 · Plan 02 Summary

**`pnpm lint:schema` CI guard turning Wave 0's RED schema-guard suite GREEN — line-based Prisma SDL parser plus a typed 16-model allowlist that catalogues every existing exemption with a one-line reason comment.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 6
- **Files created:** 5
- **Files modified:** 4

## Accomplishments
- `runSchemaGuard()` library + `formatSchemaOffences()` formatter (offence → D-03 structured diff)
- Typed `GLOBAL_LOOKUP_MODELS_ALLOWLIST` with 16 entries grouped into 5 categories (Global reference, Tenant root, Auth, System/cron, Junction)
- `scripts/lint-schema.mjs` CLI; root `pnpm lint:schema` script
- Live verification: 28 schema files clean. Synthetic `model SecretLeakRegression { ... }` insertion is detected and named in the failure output; exit code 1.
- `docs/lint-remediation/lint-schema.md` with `#missing-organization-id` and `#allowlisting-a-global-lookup-model` anchors
- Side-effect fix in `packages/feature-flags/tsconfig.json` to unblock the postinstall build that Wave 0's failing scaffolds had broken

## Task Commits

1. **Tasks 1–6: schema-guard implementation, CLI, allowlist, remediation doc** — `cde07dc8` (feat)

## Files Created/Modified

- `packages/lint-guards/src/schema-guard/global-lookup-allowlist.ts` — typed allowlist constant with grouped reason comments
- `packages/lint-guards/src/schema-guard/run-guard.ts` — line-based parser + main guard function
- `packages/lint-guards/src/schema-guard/format-offence.ts` — D-03 structured-diff formatter
- `scripts/lint-schema.mjs` — `#!/usr/bin/env tsx` CLI entrypoint
- `docs/lint-remediation/lint-schema.md` — remediation doc with required anchors
- `packages/lint-guards/src/index.ts` — public exports for the schema-guard surface
- `packages/feature-flags/tsconfig.json` — exclude `src/**/__tests__` (matches sibling packages)
- `package.json` — `lint:schema` script + `tinyglobby` + `tsx` root devDeps
- `pnpm-lock.yaml` — updated for the new root devDeps

## Decisions Made
- Used `tinyglobby` (already a transitive dep) over `fast-glob` for the schema file discovery — lighter and modern.
- Allowed the parser to skip models with zero fields rather than flagging them — empty models are malformed Prisma SDL and are caught by `prisma format` / `prisma validate` separately.
- The remediation doc includes a "Allowlist categories that already exist" section so future engineers can pattern-match their additions to the right category.

## Deviations from Plan

**1. [Rule: scope expansion needed for current schema] Allowlist expanded from 7 to 16 entries**
- **Found during:** Task 4 (CLI run against current schema)
- **Issue:** The plan's seed allowlist (Country, Currency, IsicCode, IndustryCode, ExchangeRate, TaxJurisdiction, BankCode) referenced 5 models that don't exist in the current schema. Real existing models without `organizationId` are: ExchangeRate, BoEBaseRateHistory, TaxRate, WithholdingTaxRate, Organization, User, Session, Account, Verification, StripeEvent, CronScanState, NotificationCronDedup, PortalMagicToken, ContractorTagLink, SigningRecipient.
- **Fix:** Replaced placeholder list with the actual existing exempt models, each with a category-grouped `// reason:` comment. The plan's intent was "every entry must have a reason and code-review must approve additions" — preserved exactly.
- **Files modified:** `packages/lint-guards/src/schema-guard/global-lookup-allowlist.ts`
- **Verification:** `pnpm lint:schema` exits 0 against the live 28-schema-file tree.
- **Committed in:** `cde07dc8`

**2. [Rule: blocking — postinstall tsc build broken by Wave 0 scaffolds] Excluded tests from feature-flags tsconfig**
- **Found during:** Task 4 (`pnpm install` during dep addition)
- **Issue:** `packages/feature-flags/tsconfig.json` did not exclude `src/**/__tests__`, so the new failing-import test files broke `tsc --noEmit` during postinstall — blocking ALL future `pnpm install` calls in the workspace until fixed.
- **Fix:** Added `src/**/__tests__` to the `exclude` array. Matches the existing pattern in `packages/logger/tsconfig.json`, `packages/db/tsconfig.json`, and `packages/validators/tsconfig.json`.
- **Files modified:** `packages/feature-flags/tsconfig.json`
- **Verification:** `pnpm install` succeeds with all turbo build tasks green.
- **Committed in:** `cde07dc8`

**3. [Rule: tsx loader API change] Switched lint-schema.mjs to tsx shebang**
- **Found during:** Task 4 (first `pnpm lint:schema` run)
- **Issue:** `register('tsx/esm', import.meta.url)` is the legacy API and Node 24 raises "tsx must be loaded with --import instead of --loader" with a hard-fail.
- **Fix:** Changed shebang to `#!/usr/bin/env tsx` and the npm script to `tsx scripts/lint-schema.mjs`. tsx is now a direct devDep on the root package.json.
- **Files modified:** `scripts/lint-schema.mjs`, `package.json`
- **Verification:** `pnpm lint:schema` runs to completion; both pass and fail paths produce the expected `[lint:schema]` output.
- **Committed in:** `cde07dc8`

---

**Total deviations:** 3 auto-fixed (1 scope expansion, 1 blocking build fix, 1 runtime API)
**Impact on plan:** All necessary for correctness. No scope creep.

## Issues Encountered

- oxc (vite's TS transformer) parse errors on JSDoc comments containing literal `*/` and unescaped `@@` decorator-like sequences. Resolved by reflowing the comment text. The runtime parser still strips both `//` and `/* */` comments correctly — tests verify this.

## Next Phase Readiness

- Wave 1 plans 03 (logs-guard), 04 (i18n-parity), 05 (signoff-registry-flags-schema) can land independently — none depends on the schema-guard surface.
- Plan 06 (CI workflow + husky pre-push) will reuse the `pnpm lint:schema` script as one of three sequential commands.

---
*Phase: 70-v6-0-foundation-cross-cutting-ci-guards-observability-baseli*
*Completed: 2026-04-26*
