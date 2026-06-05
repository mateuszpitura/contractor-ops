# Audit Deferred-Items — Execution Plans (ready-to-fire)

**Date:** 2026-06-05
**Branch:** `audit/post-migration-parity`
**Source audit:** [`CODE-OPTIMIZATION-AUDIT-2026-05-31.md`](./CODE-OPTIMIZATION-AUDIT-2026-05-31.md)
**Produced by:** read-only investigation workflow (`wq1d8lf9u`), verified live in tree.

## Status of the audit backlog

Already shipped (this branch): #5, #10, #23, #30, #31, #39, #40 (Wave 2) + test-mock repairs; **#34** (`bad896aa`) and **#46** (`1b5152e2`) this round.

The four items below are **blocked**, not unscoped. Every one overlaps the concurrent v6.0 agent's **uncommitted** work — the `demo-readonly-mode` feature spanning `packages/api/**`, `packages/validators/src/env.ts`, `apps/web-vite/src/components/layout/**`, `apps/web-vite/src/providers/trpc-provider.tsx`, `apps/api/src/routes/peppol.ts`, `.env.example`, `packages/api/package.json`.

**Gate for all four:** `git status --porcelain` must show those globs CLEAN before starting. If still dirty → abort, the concurrent agent hasn't merged.

---

## #38 — Missing strict TS flags (`noUncheckedIndexedAccess` + 3)

Do **not** bundle. Each flag its own commit. Measured error counts (CLI flag-override, zero edits):

### Step A — `noUnusedVariables: "error"` in `biome.json` (correctness block, ~L96-101)
- 0 hits across api/web-vite/ui src **but not exhaustively measured**; re-run `biome check --config-path=biome.ci.json packages apps` full-repo first. **Blocked now** because the concurrent agent's in-flight api code may carry transient unused vars — flipping to error would break their lint. Safe once tree quiet + full-repo check is 0.

### Step B — `noImplicitReturns: true` in `tsconfig.base.json` (after L7)
6 errors / 4 files:
- `apps/api/src/lib/webhooks/slack-webhook-context.ts` — 4 fns (end L28,32,43,50) need `return undefined;` *(not dirty — fixable now, but see below)*
- `apps/public-api/src/lib/rate-limiter.ts:~115` — 1 fall-through return *(not dirty)*
- `apps/web-vite/src/components/layout/user-menu.tsx:88` — **DIRTY (layout glob)** → blocks the global flag flip
- Cannot add the flag to base tsconfig until `user-menu.tsx` is fixed (else CI typecheck fails). Fix the 2 clean files + `user-menu.tsx` + flip flag as ONE commit once layout clears.

### Step C — `noUncheckedIndexedAccess` — per-package migration, **api first** (NOT base tsconfig)
Per-package error counts (baseline 0): **api: 1** (`packages/api/src/i18n/email-i18n.ts:62` — `let cur: Json` → `let cur: Json | undefined`; existing L66 guard covers rest), validators 2, db 1, billing 2, gov-api 2, ui 12, integrations 13, **einvoice 39**, shared 0, auth 0; apps: cms 0, api 1, cron-worker 1, public-api 1, landing 2, **web-vite 103**. Total ~180.
- Add `"noUncheckedIndexedAccess": true` to each package's own `tsconfig.json` (the per-package override IS the tracking mechanism), api first, then ascending cost. Flip base tsconfig only after every package is green, then drop the overrides.
- **Blocked:** api file + tsconfig both under `packages/api/**`.

### Step D — `exactOptionalPropertyTypes` — **DEFER** (145 errors in api alone). Backlog only.

---

## #43 — ~400 migration breadcrumb comments (comment-only, repo-wide)

**Scope is EXACTLY `apps/web-vite/src`** (verified: 412 files carry an `apps/web/` token, 100% inside comments; landing/api/cms/public-api/cron-worker = 0). Minus the 12 dirty `components/layout/**` files → **400 actionable files**. Comment-only → zero runtime/type/test radius; the cost is review burden + diff size.

### Strip patterns (only R1-R4 blanket-safe inside comment lines; R5-R6 need human review)
- **R1** `apps/web/` path refs — 412 lines, 100% comment-bound (master signal)
- **R2** `Step \d+ codemod port` / `codemod port from`
- **R3** `Lifted from apps/web` / `Ported from legacy` / `Lifted … unchanged`
- **R4** `Plan \d+-\d+` / `· Plan \d+` / `Plan \d+ Task \d+` — 17 lines, 100% comment-bound
- **R5** `(D-\d+)` — 117 lines, **20 in code/JSX/`describe()`** (load-bearing anchors) → strip only pure-provenance comment context
- **R6** `next-intl → react-i18next` mapping bullets — keep live `vi.mock('next-intl')` in tests

### STRIP vs PRESERVE rule
STRIP if comment's sole content is provenance/process (deleted-tree path, codemod-port, Lifted/Ported+commit sha, Phase·Plan, standalone (D-NN) tags, next-intl→ import-rewrite bullets, ASCII `----` banners). PRESERVE if it explains runtime behavior, an invariant, a security/a11y rule, a domain constraint. 385 files = leading `/** */` JSDoc (often MIXED — partial-strip, keep description + invariant); 27 files = leading `//` lines. **Never blanket-delete a top block.**
Worked examples in workflow output: `onboarding-consent-step.tsx` L1-9 strip / L10-12 keep (jurisdiction short-circuit); `classification-disclaimer-dialog.tsx` L1-3 strip / L4-12 keep (Escape-bypass + a11y + locked-phrase); `format-date.ts` keep first sentence, strip "Lifted from…".

### Execution
Reviewed per-file Edit slices via subagents (NEVER raw sed — corrupts JSDoc). Worklist:
`git grep -lI -E 'apps/web/' -- 'apps/web-vite/src/**/*.ts' 'apps/web-vite/src/**/*.tsx' ':!apps/web-vite/src/**/generated/**' | grep -v 'components/layout/'` → 400 files. Partition into ~8-10 waves by domain folder (disjoint, reviewable). After each wave: `pnpm --filter @contractor-ops/web-vite typecheck` (must stay green) + scoped `biome check`. NEVER full web-vite vitest (RAM).

### Guard (add last, after waves green)
`scripts/lint-no-migration-breadcrumbs.mjs` (model: `lint-no-next-imports.mjs`). Walk `apps/*/src` + `packages/*/src`; skip `/generated/`, `scripts/`, `.planning/`; allow `vi.mock('next-intl'`. Flag a COMMENT line matching: `apps/web/`, `Plan \d+-\d+`, `(D-\d+)`, `Step \d+ codemod`, `codemod port|Lifted from apps/web|Ported from legacy`. Do NOT flag bare `Phase \d+` or bare `next-intl`. Wire into `lint:ci` after `pnpm lint:no-next`.
**Follow-up:** the 12 `layout/**` files once that glob clears.

---

## #26 + #36 — package export contract (`api` raw-src + dead dist; `auth` type/runtime split)

`packages/api` exports raw `./src/*.ts`; its compiled `dist` (~5.2MB) is dead (3 node apps build then run their OWN dist, resolving bare `@contractor-ops/api` + service subpaths to raw src via Node type-stripping). `packages/api/src` non-test has **zero** non-erasable constructs → `erasableSyntaxOnly` passes today (lone param-property is in an excluded test). `auth` resolves types-from-src but runtime-from-dist; `validators` `.`→dist but `./roles`+minimal-server-env→src; `compliance-policy` has no build; `einvoice` all-dist.

**Recommend:** src-first for node-runtime packages + `"erasableSyntaxOnly": true` in `tsconfig.base.json` (after L12) + drop the redundant api `tsc` build & dist.

- **Wave 0 (BLOCKED — `packages/api/**` + `package.json` dirty + protected):** remove api `build` script, add `noEmit` (keep tests exclude), delete api `dist`; verify `node apps/api/dist/index.js` resolves `@contractor-ops/api` + services to src; repeat for cron-worker, public-api.
- **Wave 1 (safe once quiet):** add `erasableSyntaxOnly: true` to base tsconfig → `pnpm typecheck` all packages; flip `auth` package.json to src-only (remove build L30, add noEmit, delete auth dist), re-typecheck + boot apps/api; add `default` to `compliance-policy` root export.
- **Wave 2 (scoped):** `validators` full src-first requires `einvoice` src-first (coupling) — else keep `validators` root on dist + build + composite and DOCUMENT the mixed contract (`./roles` + minimal-server-env stay src for Vite).
- **Wave 3:** document the convention; optional `check-package-export-contract` guard into `lint:ci`.
- **Guard:** `erasableSyntaxOnly: true` makes CI `pnpm typecheck` fail on future enum/namespace/decorator/param-property/import-equals in type-stripped src.

---

## god-routers — `portal.ts` split + #37 `einvoice.ts` conformance + 10 dead subpath exports

All under `packages/api/**` → **BLOCKED**. 3 atomic commits, lowest-risk first.

### Item 3 (build-config only, do FIRST): remove 10 zero-consumer export keys from `packages/api/package.json`
Verified 0 importers anywhere outside `packages/api/src` AND 0 internal subpath-specifier uses (files stay, used via relative imports): `./services/slack-client`, `./services/approval-engine`, `./services/billing-constants`, `./services/exchange-rate`, `./schemas/reassessment-trigger-reason`, `./services/queue`, `./services/exports/registry`, `./services/email/templates/export-ready`, `./services/email`, `./services/org-cache`. Re-verify with grep, remove the 10 blocks, keep JSON valid; typecheck api + cron-worker + public-api + apps/api.

### Item 2: `core/einvoice.ts` conformance (#37) — audit row partly STALE
NO dynamic logger / NO silent noop (logger already top-level L14/68). Real debt: (a) delete redundant `await import('node:crypto')` L500 (createHash top-level L1); (b) drop ~18 db casts — replace six `(ctx.db as never as {$transaction:TxRunner}).$transaction` (L371,508,722,758,788,814) with bare `ctx.db.$transaction`, delete `LifecycleTx`(57-64)+`TxRunner`(66)+tx widenings(372-380); drop delegate casts (215,618,737,882,901,906) + result-shape casts (240-271,621-633,741,887,911-915); drop `ctx.db as never` (450,654,676,688); replace `lifecycle.xmlKey as string`(732) with guard/throw. `finance/payment.ts` proves `TenantScopedDb` types `$transaction`+delegates → casts are pure debt. (c) Add tx-scoped `writeAuditLog` on finalize, send-success (814-837), generateZugferdPdf upsert (371-411). Possibly widen `services/einvoice-finalize.ts` db param to `DbClient`. Type test mocks with `satisfies Partial<…>`, do NOT re-add source casts.

### Item 1 (highest risk, LAST): split `portal.ts` (1678 LOC, 30 flat procs)
**MUST use `mergeRouters`** (exported `init.ts:173`, used by `workflow.ts:34`/`equipment.ts:477`) to keep the FLAT `portal.*` namespace — SPA calls `trpc.portal.<proc>` flat, tests call `caller.portal.<proc>` flat. A nested `router({invoices:…})` explodes the radius to ~28 SPA + ~10 tests. New `portal-shared.ts` (helpers L30-171 incl. F-SEC comments + `ActivityEntry`). 5 sub-routers: AUTH (requestMagicLink187, verifyMagicLink207, selectOrg277, logout339, listMyOrgs356, switchOrg381, getSession1069); INVOICES (listInvoices633, getInvoice661, getUploadUrl869, submitInvoice940, getActiveContracts1050, listPayments834); CONTRACTS+DOCS (overview453, listContracts556, getContract585, listDocuments792); PROFILE+COMPLIANCE (getProfile1104, updateContactInfo1176, submitFinancialChangeRequest1219, getNotificationPreferences1316, updateNotificationPreference1351, getComplianceUploadUrl907, complianceItems1718, submitUploadReplacement1747); EQUIPMENT (listEquipment1406, getReturnStatus1453, requestReturn1483, cancelReturn1593, getReturnLabel1663). `portal.ts` body → `mergeRouters(...)` mirroring `equipment.ts:477`; `index.ts`/`portal-root.ts` need no change. Verify with `portal.test` + equipment-return + compliance-portal-upload + trpc-http-integration + demo-anchors + demo-router-drift (they enumerate the proc map → catch accidental nesting).

### Guards
Router-LOC guard (fail >~900 LOC); dead-subpath-export guard; portal flat-namespace snapshot test; extend `lint-audit-log.mjs` for einvoice finalize/send/zugferd.
