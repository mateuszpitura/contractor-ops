# Plan — i18n system messages (no hardcoded English)

Binding spec: [`./facts.md`](./facts.md). This plan sequences the work; if a step contradicts the facts, the facts win and the plan is wrong.

## Solution approach

1. Lock the API → client error contract by extending the existing `errorFormatter` in `packages/api/src/init.ts` to expose `shape.data.errorKey` + `shape.data.errorParams`. The wire payload becomes the single source of truth; the client never reads `error.message` directly.
2. Generate a branded `TranslationKey` union from `apps/web-vite/messages/en.json` via codegen wired into the existing turbo `i18n:types` task pattern.
3. Funnel every API error through one `useTranslatedError` hook; expose it via `<ApiErrorMessage>` for query UI and inline it into `useResourceMutation` so mutation toasts auto-translate.
4. Add two Biome lint rules (warn → error) covering toast/sink/Zod literals on the client and `TRPCError({ message })` literals in the API.
5. Sweep the existing hardcoded English in waves, one atomic commit per domain on the active branch `dry-solid-audit/extract-shared`.
6. Flip the rules to `error` only after every in-scope file passes, then delete the ad-hoc per-hook mapping code.

## Phase 0 — Investigation gates (no code changes; resolve before Phase 1)

### Step 0.1 — Confirm scope of the existing `i18n:types` turbo task

- Files inspected: `turbo.json:30-33`, `scripts/generate-i18n-types.ts` (if present), `apps/web/package.json`, `apps/web-vite/package.json`.
- Decision: either (a) extend the existing generator and reuse the `i18n:types` task name (preferred — the task already deps `typecheck`, `build`, `dev`), or (b) add a sibling `i18n:keys` task scoped only to `@contractor-ops/web-vite`. Verification: `pnpm turbo run i18n:types --filter @contractor-ops/web-vite --dry=json` shows the task wired to web-vite or fails — that decides (a) vs (b).
- Acceptance: a written note appended to this plan (or to the Phase-1 commit body) recording which task drives the web-vite codegen.

### Step 0.2 — Confirm Biome 2.4 rule mechanism for sink-literal bans

- File inspected: `biome.json:1-247`. Biome 2.4 does not ship an ESLint-style `noRestrictedSyntax`; rule shape is either (a) an existing typed rule (`noRestrictedImports` is not enough), (b) a GritQL plugin under `biome.json` `plugins`, or (c) an external check script invoked from the `lint` turbo task.
- Decision: try (b) first — register a small GritQL plugin file (e.g. `tools/biome-plugins/no-untranslated-toast.grit`, `no-untranslated-trpc-error.grit`, `no-untranslated-zod-message.grit`); fall back to (c) (a `scripts/lint-untranslated-strings.ts` invoked by `pnpm lint:i18n` and added to the root `lint` script) only if the GritQL surface in 2.4.11 cannot express the sink patterns.
- Verification: write one failing fixture + one passing fixture per rule; the chosen mechanism reports the failing fixture and ignores the passing one.
- Acceptance: a written note recording the chosen mechanism; the rule names and the fixture-test command land with the Phase-1 commit.

### Step 0.3 — Confirm `error.cause` round-trips through tRPC

- Files inspected: `packages/api/src/init.ts:34-105`, the `@trpc/server` version pinned in `packages/api/package.json`, the existing `superjson` transformer config.
- Concern: tRPC v11 strips `cause` from the wire payload unless it is copied onto `shape.data` explicitly.
- Verification: a one-off vitest in `packages/api/src/__tests__/error-formatter.test.ts` (skeleton ahead of Phase 1.2) throws `new TRPCError({ code: 'BAD_REQUEST', message: E.CONTRACTOR_NOT_FOUND, cause: { params: { id: 1 } } })` through the formatter and asserts the params reach `shape.data.errorParams`.
- Acceptance: the test passes against the extended formatter; the implementation uses `(error.cause as { params?: … } | undefined)?.params` rather than reflecting through prototype.

## Phase 1 — Infrastructure (warn-mode lint)

### Step 1.1 — `Errors.generic` fallback key

- Files: `apps/web-vite/messages/en.json`, `pl.json`, `de.json`, `ar.json` — add `"generic"` under the existing `Errors` namespace if missing. Translation text matches the existing UX of the production INTERNAL_SERVER_ERROR generic message ("Something went wrong" / locale equivalents).
- Verification: `rg '"generic"' apps/web-vite/messages/{en,pl,de,ar}.json` shows four hits inside the `Errors` block.
- Acceptance: parity test (after Step 1.4) passes with `Errors.generic` listed alongside the existing keys.

### Step 1.2 — Extend tRPC `errorFormatter`

- File: `packages/api/src/init.ts:34-105`. Inside `errorFormatter({ shape, error, path, type })` after the existing F-SEC-20 hardening, set:
  - `shape.data.errorKey = isKnownApiErrorValue(error.message) ? error.message : 'unknownError'`.
  - `shape.data.errorParams = (error.cause as { params?: Record<string, string|number> } | undefined)?.params`.
- The existing `INTERNAL_SERVER_ERROR` message-stripping path keeps overwriting `shape.message`; the `errorKey` / `errorParams` fields are added regardless of code so the client always has a translation anchor.
- A small helper `isKnownApiErrorValue` lives in `packages/api/src/errors.ts` (set built from the exported string values) so the formatter does not reflect over the module each call.
- Verification: new `error-formatter.test.ts` (Step 1.3) green; `pnpm typecheck --filter @contractor-ops/api` green.
- Acceptance: spot-check a real BAD_REQUEST against `pnpm dev` — devtools network tab shows the new fields on the tRPC error payload.

### Step 1.3 — `packages/api/src/__tests__/error-formatter.test.ts`

- New test file. Cases per facts `Tests` section: known key → `shape.data.errorKey` matches; `cause.params` → `shape.data.errorParams` matches; unknown message → `errorKey: 'unknownError'`; INTERNAL_SERVER_ERROR in production still strips the message but still attaches `errorKey: 'unknownError'`.
- Verification: `pnpm --filter @contractor-ops/api test -- error-formatter` (scoped) green.

### Step 1.4 — Extend `errors-i18n-parity.test.ts`

- File: `packages/api/src/__tests__/errors-i18n-parity.test.ts:11-40`.
- Changes: load `de.json` and `ar.json` alongside `en.json` and `pl.json`; assert `Errors.<code>` parity in all four; add a reverse-direction assertion that every key under `Errors.*` in `en.json` is either exported from `errors.ts` or is one of the documented page-layout entries (existing `isPageLayoutEntry` predicate already handles object-shaped entries).
- Verification: `pnpm --filter @contractor-ops/api test -- errors-i18n-parity` green.

### Step 1.5 — Branded `TranslationKey` codegen

- Resolution from Step 0.1 dictates (a) extend `scripts/generate-i18n-types.ts` to also emit a `TranslationKey` branded union for web-vite or (b) add `scripts/generate-i18n-keys.ts` + a web-vite-scoped turbo task.
- Output: `apps/web-vite/src/generated/i18n/keys.d.ts` exporting `TranslationKey` (branded, dotted-leaf union from `en.json`).
- `.gitignore` whitelist mirrors `packages/db/src/generated/prisma/` (per recon: `.gitignore` excludes `generated/` globally but whitelists specific package paths). Add `!/apps/web-vite/src/generated/i18n` near the existing whitelist line.
- Verification: `pnpm i18n:types` (or `pnpm i18n:keys`) produces the file; second run produces no diff (`git diff --exit-code apps/web-vite/src/generated/i18n`).
- Acceptance: `scripts/__tests__/generate-i18n-keys.test.ts` covers determinism + brand-type rejection of a non-key literal.

### Step 1.6 — `useTranslatedError` hook

- File: `apps/web-vite/src/i18n/use-translated-error.ts`. Signature: `useTranslatedError(): (err: unknown) => string`.
- Reads `(err as TRPCClientError<AppRouter>).data?.errorKey` + `.data?.errorParams`. If `errorKey` is missing or not present in the `Errors` namespace, falls back to `Errors.generic`. Uses the existing compat `useTranslations('Errors')` shim.
- Test: `apps/web-vite/src/i18n/__tests__/use-translated-error.test.ts` covers the four cases in facts.
- Verification: `pnpm --filter @contractor-ops/web-vite test -- src/i18n/__tests__/use-translated-error` (scoped per `feedback_test_run_memory`).

### Step 1.7 — `<ApiErrorMessage>` component

- File: `apps/web-vite/src/components/feedback/api-error-message.tsx`. Thin wrapper rendering `useTranslatedError()(error)` inside a span with `role="alert"`.
- Test: `apps/web-vite/src/components/feedback/__tests__/api-error-message.test.tsx` covers known key, unknown key, and the query-state wrapper case.

### Step 1.8 — Wire `useResourceMutation` to the new pipeline

- File: `apps/web-vite/src/hooks/use-resource-mutation.ts`.
- Changes:
  - `UseResourceMutationConfig.successMessage: TranslationKey | { key: TranslationKey; params?: Record<string, string|number> }`.
  - `UseResourceMutationConfig.errorMessage?: TranslationKey | { key: TranslationKey; params?: … }`.
  - `onSuccess` resolves `successMessage` through `t(...)` (uses the bound `useTranslations()` from `@/i18n/useTranslations` at hook level).
  - `onError` calls `useTranslatedError` for the auto-translation; an explicit `errorMessage` override wins.
  - The `error.message?.length ? error.message : ''` raw-message fallback is removed.
- Test: `apps/web-vite/src/hooks/__tests__/use-resource-mutation.test.ts` covers the four cases in facts.
- Verification: `pnpm typecheck --filter @contractor-ops/web-vite` green — the six DRY-touched hooks compile because their `successMessage` values either already use `t(...)` (already valid `TranslationKey`) or fail typecheck (caught and migrated in Phase 2 sweep, not Phase 1).
- ⚠️ Risk: this typecheck failure on the six DRY hooks is the gate that forces Phase 2 to start. Choose between (i) landing 1.8 + the six-hook migration in the same commit (preserves green build) or (ii) using a transitional `string | TranslationKey | …` type for one commit window, narrowed in the flip step. Default: (i), six hooks migrate alongside the helper change.

### Step 1.9 — Update `typed-keys.ts` to consume `TranslationKey`

- File: `apps/web-vite/src/i18n/typed-keys.ts`. Replace `key: any` / `key: string` in `tKey`, `tDyn`, `tDynLoose`, `tHas` with `TranslationKey` (or constraint that composes a `TranslationKey`). Existing call sites continue to compile because they pass string literals that match the union.
- Verification: `pnpm typecheck --filter @contractor-ops/web-vite` green; no behavioral diff in the affected hooks.

### Step 1.10 — Biome rules (warn)

- Files: `biome.json` overrides block (lines 144-229), plus the chosen plugin/script artefacts from Step 0.2.
- Rules:
  - **Client sinks** (`apps/web-vite/src/**`): reject string-literal arguments to `toast.success|error|info|warning` and string-literal values for `successMessage` / `errorMessage` / `validationMessage` on `useResourceMutation` configs and shared UI component props.
  - **Zod messages** (`apps/web-vite/src/**`): reject string-literal `{ message: '…' }` on `.min/.max/.refine` and similar Zod method chains.
  - **API throws** (`packages/api/src/**` except `errors.ts`): reject string-literal `new TRPCError({ message: '…' })`.
- Severity: `warn` for the full Phase 1 commit window.
- Verification: deliberate failing fixture + passing fixture per rule; `pnpm lint` reports each warning at the expected location.

### Step 1.11 — Codegen test

- File: `scripts/__tests__/generate-i18n-keys.test.ts`. Cases: deterministic output, leaf enumeration, brand-type rejection (via a `// @ts-expect-error` line in a fixture file under `apps/web-vite/src/i18n/__tests__/fixtures/`).

### Step 1.12 — Biome rule test

- Files: per chosen mechanism (GritQL plugin tests or `scripts/__tests__/lint-untranslated-strings.test.ts`). Covers both directions per facts.

### Phase 1 commit boundary

- Atomic commit on `dry-solid-audit/extract-shared`:
  - `feat(api,web-vite,i18n): land error-key contract + translated-error pipeline — i18n system messages step 1`.
  - Body explains: extended formatter, codegen, hook + component, Biome rules at warn.
- Pre-commit checks (each must pass):
  - `pnpm i18n:types` (or `i18n:keys`) — clean.
  - `pnpm typecheck` — green.
  - `pnpm lint` — green at `warn` severity (warnings recorded but no errors).
  - `pnpm --filter @contractor-ops/api test` — green.
  - `pnpm --filter @contractor-ops/web-vite test -- src/i18n src/components/feedback src/hooks` — green (scoped).

## Phase 2 — Sweep (one atomic commit per logical unit)

The sweep removes hardcoded English at every in-scope sink. Order chosen to keep each commit reviewable and to let the API side land first so any new error keys exist before the client starts depending on them.

### Step 2.1 — API: replace string-literal `TRPCError({ message })` throws

- 39 sites identified across `packages/api/src/**`. Concrete example: `packages/api/src/services/approval-engine.ts:271` `message: 'errors.approval.noUserWithRole'`.
- For each site: add a constant to `errors.ts` if missing, add the `Errors.<key>` translation in all four locales, replace the literal with the constant import. If the throw needs interpolation, add `cause: { params: { … } }`.
- Commit shape: group throws by domain folder (e.g. `routers/approvals/**`, `services/**`). Expect 5–10 commits.
- Verification per commit: `pnpm --filter @contractor-ops/api test` green; parity test green; `pnpm lint --filter @contractor-ops/api` shows the now-banned literal warnings disappear domain-by-domain.

### Step 2.2 — Web-vite domains: replace hardcoded strings

- Domain order (each = one commit; skip if no in-scope strings exist): approvals, equipment, payments, invoices, contractors, contracts, workflows, timesheets, einvoice, notifications, settings, dashboard, admin, billing, classification, consent, documents, import, integrations, layout, legal, ocr.
- For each domain:
  - Replace `toast.<level>('literal')` → `toast.<level>(t('Domain.toast.key'))`.
  - Replace hardcoded `successMessage` / `errorMessage` in `useResourceMutation` configs with `TranslationKey` (or `{ key, params }`).
  - Replace `error.message` / `String(error)` renders in error UI states with `<ApiErrorMessage error={err} />` or `useTranslatedError`.
  - Replace empty-state / confirmation / system text with `t(...)` calls.
  - Add missing keys to all four locale files.
  - Update or add unit tests in the same commit so message-text assertions become key assertions (or assertions against rendered output in a fixed test locale).
- Verification per commit: `pnpm typecheck --filter @contractor-ops/web-vite` green; `pnpm --filter @contractor-ops/web-vite test -- src/components/<domain>` (scoped) green; `pnpm lint` shows the now-banned warnings disappear in that domain.

### Step 2.3 — Zod schemas

- One commit covering shared Zod schemas in `apps/web-vite/src/**` (and any schema package the client consumes).
- Replace `.min(…, { message: 'literal' })` / `.refine(…, { message: 'literal' })` with `'validation.<key>'`.
- New file: `apps/web-vite/src/i18n/zod-issues-to-keys.ts` mapping `ZodError.issues[]` to translated strings.
- Test: `apps/web-vite/src/i18n/__tests__/zod-issues-to-keys.test.ts`.
- Verification: `pnpm typecheck`, `pnpm --filter @contractor-ops/web-vite test -- src/i18n/__tests__/zod-issues-to-keys` green.

### Step 2.4 — Remove ad-hoc per-hook translation paths

- `apps/web-vite/src/components/invoices/hooks/use-einvoice-tab.ts:54-64` — the `tKey(tErr, key)` mapping is now redundant because `useResourceMutation` auto-translates. Delete the local fallback path.
- `apps/web-vite/src/components/notifications/hooks/use-notification-center.ts:84` — replace `toast.error(err.message)` with `<ApiErrorMessage>` or `useTranslatedError`.
- Audit (rg) any other `tKey(tErr, …)` or `error.message` toast/rendering site missed by the domain sweep.

## Phase 3 — Flip

### Step 3.1 — Raise Biome severity to `error`

- File: `biome.json`. Flip the three rule severities from `warn` to `error`. Single commit.
- Verification: `pnpm lint` exits 0 across the workspace. If it does not, the sweep is incomplete and Phase 3 stops until Phase 2 fills the gap.

### Step 3.2 — Final acceptance

Run the full verification block from `facts.md` (the "Verification (final acceptance — runs after all phases complete)" section) in order. Each check must pass before this goal closes.

## Risks / open questions

1. **Biome 2.4 plugin surface (Step 0.2).** If GritQL in 2.4.11 cannot express the toast / Zod / TRPCError sink patterns precisely, the fallback is a script-based check wired into `pnpm lint`. That works but slightly degrades editor-time feedback. Verify in Step 0.2 before committing to the approach in this plan.
2. **Existing `i18n:types` task ownership (Step 0.1).** The task at `turbo.json:30-33` may already serve `apps/web` (next-intl) and would need extension to also emit web-vite's branded `TranslationKey`. Plan defaults to extending; falls back to a sibling task only if extension breaks the `goals/i18n-typed-keys` work.
3. **tRPC `cause` round-tripping (Step 0.3).** If `error.cause` does not reach the formatter intact (e.g. eaten by `superjson` or by middleware), `errorParams` lands missing in production. The vitest in 0.3 catches this before any client work depends on it.
4. **Branch contention with the DRY agent.** The plan keeps each commit atomic and scoped to a single domain so a rebase against new DRY commits stays mechanical. If the DRY agent and the i18n sweep touch the same hook file in overlapping commits, the i18n commit rebases on top — it never reshapes the hooks the DRY agent established.
5. **200-char message cap.** The existing F-SEC-20 cap in `init.ts` is on `shape.message`. The new `shape.data.errorKey` is a short identifier; no cap needed. Documented here so reviewers do not add a redundant cap.
6. **`apps/web` (next-intl) coexistence.** The Biome client-sink rule is scoped to `apps/web-vite/src/**` via the `includes` glob; `apps/web` keeps its discipline under `goals/i18n-typed-keys/`. If new toast/`useResourceMutation` sites land in `apps/web` during the migration window, they fall outside this goal.
7. **Locale loading for `de.json` / `ar.json` in the parity test.** Currently only `en` + `pl` are asserted; extending to `de` + `ar` will likely surface missing translations for keys added recently. Step 2.1 commits must include the four-locale entries for any new key introduced.
