---
last_mapped_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
last_mapped_at: 2026-06-08
---

# Testing Conventions

How tests are organized, run, and gated in contractor-ops. **Never cite failure counts from memory** — run `pnpm test` and read output.

## Commands

| Command | What it runs |
|---------|--------------|
| `pnpm test` | `turbo test` — all package/app vitest projects |
| `pnpm test:coverage` | Builds deps, then `vitest run --coverage` from root workspace config |
| `pnpm test:integration:smoke` | Live provider smoke (`vitest.smoke.config.ts`) — opt-in via `RUN_LIVE_SMOKE=1` |
| `pnpm --filter @contractor-ops/api test` | Single package |
| `vitest run --project api` | Single named project (see `vitest.monorepo.ts`) |

Dev typecheck (faster, non-CI): `pnpm typecheck:fast` (tsgo). CI uses `pnpm typecheck` (tsc).

## Turbo orchestration

`turbo.json` defines the `test` task:

```json
"test": { "dependsOn": ["^build", "i18n:types"] }
```

Tests wait for upstream package builds and generated i18n types (`apps/web-vite/src/generated/i18n/**`). Run `pnpm build` before first test in a clean clone if turbo cache is cold.

`TURBO_TELEMETRY_DISABLED=1` in CI.

## Vitest workspace (root)

Root [`vitest.config.ts`](../../vitest.config.ts) defines a **multi-project workspace** for merged coverage:

**Projects in root coverage run:** `apps/api`, `apps/cron-worker`, `apps/public-api`, `packages/api`, `packages/auth`, `packages/db`, `packages/integrations`, `packages/logger`, `packages/validators`, `packages/einvoice`, `packages/feature-flags`, `packages/gov-api`, `packages/idp-saga`.

**Not in root coverage denominator:** `packages/test-utils` (MSW harness — test-only), `apps/web-vite` (separate project), `packages/lint-guards`, etc.

Coverage uses **v8** provider; `coverage.include` lists every matching source file so unimported files count as 0% (honest denominator). Reports: `text`, `text-summary`, `json-summary`, `html` → `./coverage`.

Vitest **4.1.x** — keep `vitest` and `@vitest/coverage-v8` on same major/minor in root `package.json`.

## Project registry (`vitest.monorepo.ts`)

Single source of truth for project `name` and `sequence.groupOrder`:

```ts
export const vitestProject = {
  api: { name: 'api', groupOrder: 1 },
  // … auth, db, integrations, logger, validators, einvoice, govApi,
  // testUtils, classification, secrets, publicApi, billing,
  // apiServer, cronWorker, webVite, idpSaga
} as const;
```

- Filter: `vitest run --project web-vite`
- VS Code Vitest extension uses the same `name` labels.
- Lower `groupOrder` runs earlier (stable ordering).

## Per-package configs

Each testable package/app has its own `vitest.config.ts` referencing `vitestProject.*`.

### `packages/api` (largest suite)

- **Environment:** `node`, `globals: true`
- **Pool:** `forks` — isolates `vi.mock('@contractor-ops/db')` between files
- **Setup:** `src/__tests__/setup-logger-mock.ts`
- **Env:** `minimalServerEnv()` + test Stripe/Slack keys so modules loading `getServerEnv()` succeed
- **Aliases:** subpath-before-bare resolution for `@contractor-ops/einvoice`, `@contractor-ops/validators`, etc. (see comment re ENOTDIR failures)
- **Includes:** `src/**/__tests__/**/*.test.ts(x)`, `src/__tests__/**/*.test.ts`

### `apps/web-vite`

- **Environment:** `jsdom`, `@vitejs/plugin-react`
- **Setup:** `src/test/setup.ts`
- **Alias:** `@` → `src/` (legacy port compat)
- **Includes:** `src/**/__tests__/**/*.test.{ts,tsx}`

### `packages/lint-guards`

- Tests architecture guard rules (`run-guard.ts`, `format-offence.ts`)
- Validates `inline-entity-id`, `local-format-amount`, `web-vite-db-import` detection

### Other packages

Follow the same pattern: `defineConfig`, `vitestProject.<name>`, package-local `include`/`setupFiles`/`alias` as needed. Examples: `packages/auth`, `packages/db`, `packages/validators`, `apps/api`, `apps/cron-worker`, `apps/public-api`.

## Integration smoke (live)

[`vitest.smoke.config.ts`](../../vitest.smoke.config.ts) — **separate** from turbo `test`:

- Includes: `tests/integration-smoke/**/*.smoke.ts`
- `testTimeout` / `hookTimeout`: 30s; `fileParallelism: false`
- Self-skips unless `RUN_LIVE_SMOKE=1` + provider creds (`tests/integration-smoke/harness.ts`)
- Credential-less run = all-skipped pass (not failure)

Invoke: `pnpm test:integration:smoke`.

## MSW test harness (`@contractor-ops/test-utils`)

Primary external-service mocking — intercepts HTTP at network level. See [`packages/test-utils/CLAUDE.md`](../../packages/test-utils/CLAUDE.md).

```ts
import { useMockServer } from '@contractor-ops/test-utils/msw/server';
const { server, capture } = useMockServer();
```

- **Handlers:** per-provider defaults in `src/msw/handlers/` (Stripe, Jira, Linear, Slack, KSeF, QStash, R2, …)
- **Select subset:** `selectHandlers(['stripe', 'jira'])`
- **Scenarios:** `missingDataHandlers()`, `degradedHandlers()`, `rateLimitedHandlers()`, `tokenExpiredHandlers()`, webhook replay factories
- **Fixtures:** `stripeFixtures.customer()`, `jiraFixtures.issue()`, etc.
- **Request capture:** `RequestCapture` for assertCalled / getByUrl
- **Stateful:** `clearRedisStore()` in `afterEach` when using Redis handlers

`createIntegrationMswHandlers()` in `integration-msw-factory.ts` reduces per-provider registration boilerplate.

**Not MSW-intercepted:** ClamAV (TCP), Prisma/DB (mock client or test DB), Sentry/Axiom/Cronitor (fire-and-forget, degrade silently).

## Test file placement

| Pattern | Location |
|---------|----------|
| Unit / router tests | `src/**/__tests__/**/*.test.ts` |
| Package-level tests | `src/__tests__/**/*.test.ts` |
| Component tests (web-vite) | `src/**/__tests__/**/*.test.tsx` |
| Live smoke | `tests/integration-smoke/**/*.smoke.ts` |
| Load tests | `load-tests/*.js` (k6 — `pnpm load:smoke`, not vitest) |

Co-locate tests near the code they exercise; `__tests__` subdirs keep spec files out of production bundles.

## What to test (project norms)

- **Quality > speed** — do not skip tests/types to finish faster; fix root cause.
- Add tests when requested or when they cover real behavior — avoid trivial assertions.
- Router mutations: tenant scoping, Zod input rejection, audit log emission where applicable.
- Webhooks/cron: `safeParse` paths, idempotency, error handling.
- UI: loading/empty/error states; a11y-critical paths where regressions are likely.
- Architecture guard rules have their own unit tests in `packages/lint-guards`.

## CI pipeline (`.github/workflows/ci.yml`)

Single `ci` job — **Lint, Typecheck & Test** (15 min timeout):

1. `pnpm install --frozen-lockfile`
2. `db:check-drift` — committed Prisma client matches schema
3. `format:check` (biome)
4. **`lint:ci`** — biome + i18n-casts + all `check:web-vite-*` + security/architecture lints including **`lint:architecture`**
5. `check:no-process-env`, `lint:schema`, `lint:logs`, `lint:scopes`
6. **`i18n:parity`**, **`i18n:code-coverage`** (strict missing-key gate)
7. `i18n:quality` (advisory, `continue-on-error`)
8. **`pnpm build`**
9. **`pnpm typecheck`** (tsc — CI-canonical; catches web-vite types vite build strips)
10. **`pnpm test`**
11. `pnpm audit` (informational, `continue-on-error`)

Separate job: **bundle-size** (after `ci`) — `apps/web-vite/.size-limit.json` budgets.

Env in CI: `SKIP_ENV_VALIDATION=true`, Node 24, pnpm cache.

## Local pre-push checklist

```bash
pnpm format:check
pnpm lint:ci                    # includes lint:architecture + web-vite gates
pnpm typecheck                  # match CI
pnpm test                       # full turbo suite
pnpm --filter @contractor-ops/<pkg> test   # when touching one package
```

For shared package API changes:

```bash
pnpm typecheck --filter=@contractor-ops/api
pnpm test --filter=@contractor-ops/api
```

For web-vite data-layer ports:

```bash
pnpm check:web-vite-data-layer
pnpm check:web-vite-page-shells
pnpm --filter @contractor-ops/web-vite test
```

## Coverage expectations

Root `pnpm test:coverage` merges cross-package coverage for backend-focused projects. Web-vite and other front-end packages maintain separate vitest projects — run their coverage via filtered vitest if needed.

Excluded from coverage denominator: `**/generated/**`, `**/__tests__/**`, `*.test.ts(x)`, `packages/test-utils/**`.

## Debugging failures

| Symptom | Likely cause |
|---------|--------------|
| `ENOTDIR` on einvoice import | Vitest alias order — subpath before bare package |
| Cross-file mock leakage | `packages/api` uses `pool: 'forks'` for db mocks |
| Missing i18n key in CI | Run `pnpm i18n:code-coverage` locally |
| `inline-entity-id` lint fail | Replace inline `z.object({ id })` with `entityIdSchema` |
| Data-layer check fail | Move `useQuery`/`useTRPC` to `components/{domain}/hooks/` |
| Smoke tests skip | Expected without `RUN_LIVE_SMOKE=1` |

Historical test-debt snapshot (may be stale): [`.planning/handoffs/test-cleanup-2026-04-27.md`](../../.planning/handoffs/test-cleanup-2026-04-27.md).
