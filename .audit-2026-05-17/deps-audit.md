# Dependency Audit — 2026-05-17

Method: per-workspace static scan (regex `from "X" | require("X") | dynamic import | config-string`) over `*.ts/tsx/js/mjs/cjs/json/css/md`, plus targeted re-verification for false-positive candidates (peer deps, Next.js runtime deps, CLI binaries invoked from monorepo scripts).

Scope: `package.json` declarations only — does not assess transitive bloat or duplicate versions.

---

## High confidence — remove

| Package | Dep | Type | Reason |
|---|---|---|---|
| `apps/landing` | `@posthog/react` | dep | code uses `posthog-js/react` (sub-export of `posthog-js`); `@posthog/react` is a different package, never imported |
| `apps/landing` | `class-variance-authority` | dep | no `cva(` / import anywhere in `apps/landing/src` |
| `apps/public-api` | `@contractor-ops/validators` | dep | not imported in `apps/public-api/src` |
| `apps/public-api` | `@contractor-ops/test-utils` | devDep | not imported in any test in `apps/public-api` |
| `packages/api` | `@azure/identity` | dep | only string match is a code comment stating "no @azure/identity needed"; `teams-graph-client.ts` uses callback authProvider pattern |
| `packages/api` | `@upstash/qstash` | dep | no direct import; QStash used exclusively via re-export `@contractor-ops/integrations/services/qstash-client` |
| `packages/integrations` | `@contractor-ops/validators` | dep | not imported in `packages/integrations/src` |
| `packages/offboarding-templates` | `@date-fns/tz` | dep | not imported in source (`src` empty of date-fns usage) |
| `packages/validators` | `validate-polish` | dep | not imported anywhere in package |

---

## Likely removable — verify before delete

| Package | Dep | Notes |
|---|---|---|
| `packages/classification` | `@vitest/coverage-v8` | no `--coverage` in this package's scripts; root `test:coverage` invokes vitest on whole monorepo, which uses root-installed `@vitest/coverage-v8`. Drop unless this pkg has its own coverage pipeline. |
| `packages/validators` | `@vitest/coverage-v8` | same logic as classification |
| `packages/integrations` | `@vitest/coverage-v8` | same |
| `packages/einvoice` | `@vitest/coverage-v8` | same |
| `packages/api` | `@vitest/coverage-v8` | same |
| `apps/web` | `@vitest/coverage-v8` | apps/web declares its own `test:coverage` script; KEEP — confirmed used |

(Note: keeping `@vitest/coverage-v8` in pkgs that don't actually run coverage is harmless but inflates lockfile graph; consolidating to root is cleaner.)

---

## False positives — keep (scanner missed real usage)

| Package | Dep | Why kept |
|---|---|---|
| root | `@typescript/native-preview` | provides `tsgo` binary used in `typecheck:fast` script in ~10 packages |
| root | `lint-staged` | invoked from `.husky/pre-commit` (`pnpm exec lint-staged`) |
| root | `@types/node` | ambient types via tsconfig — no explicit import needed |
| `apps/web` | `react-dom` | Next.js runtime peer; SSR + client hydration depend on it |
| `apps/web` | `postcss` | tooling resolves it via `@tailwindcss/postcss`; explicit declaration is conventional |
| `apps/web` | `@types/react-dom` | tied to `react-dom` peer (TS types) |
| `apps/cms` | `react-dom` | Next.js + Payload admin runtime peer |
| `apps/cms` | `graphql` | Payload exposes `/api/graphql`; Payload SDK requires `graphql` as peer |
| `apps/cms` | `@types/react-dom` | tied to `react-dom` peer |
| `apps/landing` | `postcss` | same Tailwind v4 reasoning as `apps/web` |
| `packages/api` | `@prisma/client` (devDep) | imported in `late-payment-interest.ts`, `routers/core/leitweg-id.ts` (scanner regex missed) |
| `packages/einvoice` | `react` | `@react-pdf/renderer` requires `react` as runtime peer |
| `packages/einvoice` | `xslt3` (devDep) | CLI binary invoked from `scripts/recompile-kosit-schematron.ts` via `execFileSync('xslt3', …)` |
| `packages/ui` | `react-dom` peer+devDep | declared as peer for consumers; devDep needed for build/types |

---

## Notes on workspace deps (`workspace:*`)

All workspace `@contractor-ops/*` cross-imports were verified; only the two listed above (`validators` in `public-api` and `integrations`) are unused.

## Pruning checklist (suggested order)

```bash
# 1. High-confidence drops
pnpm -F @contractor-ops/landing remove @posthog/react class-variance-authority
pnpm -F @contractor-ops/public-api remove @contractor-ops/validators @contractor-ops/test-utils
pnpm -F @contractor-ops/api remove @azure/identity @upstash/qstash
pnpm -F @contractor-ops/integrations remove @contractor-ops/validators
pnpm -F @contractor-ops/offboarding-templates remove @date-fns/tz
pnpm -F @contractor-ops/validators remove validate-polish

# 2. After running typecheck + tests, consider consolidating @vitest/coverage-v8 to root only
```

After each batch: `pnpm install`, then `pnpm typecheck` + `pnpm test` to catch any missed runtime reference.

---

## Recommendations beyond this audit

1. Add `knip` or `depcheck` to CI (long-published, safe under `minimumReleaseAge`) to catch future dep drift automatically.
2. The `react-pdf` / `@react-pdf/renderer` pair appears in both `apps/web` and `packages/api` — confirm there's no transitive duplication of the renderer.
3. `pino` is declared at `apps/web`, `apps/cms`, `packages/db`, `packages/logger` — `packages/logger` is the canonical export; apps probably should consume `@contractor-ops/logger` instead of `pino` directly, per `feedback_logging` memory.
