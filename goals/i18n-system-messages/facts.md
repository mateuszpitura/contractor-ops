# Facts — i18n system messages (no hardcoded English)

> Companion to `goals/i18n-typed-keys/` which covers `apps/web` (next-intl) typed-key safety.
> This goal covers `apps/web-vite` (react-i18next) + the API error contract + the lint/test enforcement perimeter.
> Both goals share the principle that translation keys are the only legal source of user-facing strings.

## In scope

- API error throws across `packages/api/**` (every `TRPCError({ message })` site).
- Frontend translation pipeline for `apps/web-vite/src/**`: toasts, mutation results, query error UI, validation messages, empty/confirmation/system text.
- Type-level + lint-level enforcement that prevents reintroduction of hardcoded English strings at user-facing sinks.
- Existing parity test extended to cover all four locales.

## Out of scope

- `@contractor-ops/logger` / Pino output and any server-side log messages — stay in English by design.
- Email templates and in-app notification body text — separate i18n surface, handled later.
- CMS-authored content in `apps/cms` (Authors, Categories, Posts) — author-supplied per locale, not code strings.
- `/scripts/**`, pnpm CLI output, debug-only console messages — developer tooling, not user-facing.
- `apps/web` (next-intl) typed-key cleanup — owned by `goals/i18n-typed-keys/`.

## API error contract

- Every `throw new TRPCError(...)` inside `packages/api/**` uses a constant imported from `packages/api/src/errors.ts` as its `message`.
- `packages/api/src/errors.ts` remains the single source of truth for error keys; values stay camelCase (e.g. `'approvalStepNotFound'`); const names stay SCREAMING_SNAKE_CASE.
- Existing string-literal `message` values such as `'errors.approval.noUserWithRole'` in `packages/api/src/services/approval-engine.ts` are replaced with a constant from `errors.ts`.
- A TRPCError that needs interpolation passes structured data via `cause: { params: Record<string, string | number> }` — never via string concatenation in `message`.
- The `Errors` namespace in `apps/web-vite/messages/{en,pl,de,ar}.json` defines a translation for every key exported from `errors.ts`.
- The `Errors` namespace includes a `generic` entry used as a fallback when an unknown key reaches the client.

## API error formatter

- `packages/api/src/init.ts` `errorFormatter` is extended to surface two fields on `shape.data`:
  - `errorKey: string` — the original `error.message` value (the camelCase key) when it matches a value exported from `errors.ts`; otherwise `'unknownError'`.
  - `errorParams?: Record<string, string | number>` — copied from `error.cause.params` when present.
- The extension preserves the existing F-SEC-20 behavior: production `INTERNAL_SERVER_ERROR` messages stay stripped, `BAD_REQUEST` Zod shapes stay intact, the 200-char message cap is unchanged.
- Server-side logging via `errorLog.error(...)` remains in English and keeps the full original error.

## Frontend translation pipeline (`apps/web-vite`)

- `apps/web-vite/src/i18n/use-translated-error.ts` exports a hook `useTranslatedError()` that returns `(err: unknown) => string`, reading `shape.data.errorKey` and `shape.data.errorParams` from a tRPC error and resolving them through the `Errors` namespace; unknown keys fall back to `Errors.generic`.
- `apps/web-vite/src/components/feedback/api-error-message.tsx` exports `<ApiErrorMessage error={err} />` — a thin component wrapping `useTranslatedError` for query error UI states.
- Container components render `<ApiErrorMessage error={query.error} />` (or call `useTranslatedError`) in error states instead of `String(error)` / `error.message`.
- `apps/web-vite/src/hooks/use-resource-mutation.ts` is updated so that:
  - `successMessage` and `errorMessage` accept a `TranslationKey` (or `{ key: TranslationKey; params?: Record<string, …> }`) rather than a free string.
  - The internal `onError` uses `useTranslatedError` to translate the API error key, then renders the toast. The current `error.message?.length ? error.message : ''` fallback is removed.
  - When the caller supplies `errorMessage`, it overrides the auto-translation; otherwise the API key is auto-translated.
- No component or hook in `apps/web-vite/src/**` reads `error.message` directly and renders it to the user.

## Typed translation keys (`apps/web-vite`)

- A codegen step reads `apps/web-vite/messages/en.json` and emits a `.d.ts` file containing a `TranslationKey` union of every leaf path (dotted form, e.g. `'Errors.approvalStepNotFound'`).
- The generated file lives at `apps/web-vite/src/generated/i18n/keys.d.ts` and is git-ignored, mirroring `src/generated/prisma/client/`.
- The generator is implemented as `scripts/generate-i18n-keys.ts` and invoked via a `pnpm i18n:keys` script.
- A turbo task `i18n:keys` is defined with `inputs: ["apps/web-vite/messages/en.json", "scripts/generate-i18n-keys.ts"]` and `outputs: ["apps/web-vite/src/generated/i18n/**"]`.
- `typecheck`, `build`, and `dev` for `@contractor-ops/web-vite` depend on `i18n:keys`.
- Re-running the generator against an unchanged `en.json` produces a byte-identical output (deterministic, cache-hit on turbo).
- `TranslationKey` is exported as a branded type — assignment from a plain `string` fails `tsc`; only `tKey(t, key)`, `t(key)`, or a literal that matches the union is accepted.
- The existing `apps/web-vite/src/i18n/typed-keys.ts` (`tKey`, `tDyn`, `tDynLoose`, `tHas`) is updated to consume `TranslationKey` rather than `any`/`string`; existing call sites continue to compile after the swap (no behavior change beyond stricter typing).

## Zod validation messages

- Zod schemas in `apps/web-vite/src/**` and shared schema packages emit translation keys as their `message`, e.g. `z.string().min(1, { message: 'validation.required' })`.
- A shared helper `apps/web-vite/src/i18n/zod-issues-to-keys.ts` maps a `ZodError.issues[]` array to translated strings, used uniformly by client-side form error rendering and server-side `BAD_REQUEST` surfaces.
- Default Zod messages (English fallback) never reach the user for in-scope forms.

## Frontend enforcement

- A Biome lint rule (`noRestrictedSyntax` pattern, or a small custom rule registered in `biome.json` under `linter.rules`) rejects raw string-literal arguments to `toast.success`, `toast.error`, `toast.info`, `toast.warning` (from `sonner`) in `apps/web-vite/src/**` unless wrapped by `t(...)`, `tKey(...)`, or `tDyn(...)`.
- The same Biome rule rejects string-literal values for the `successMessage` and `errorMessage` fields of `useResourceMutation`'s config and for any prop named `errorMessage` / `successMessage` / `validationMessage` on shared UI components.
- A second Biome rule rejects raw string-literal `message` values on Zod schema chains (`.min(…, { message: … })`, `.max(…, { message: … })`, `.refine(…, { message: … })`) inside `apps/web-vite/src/**`.
- The rules are added to `biome.json` (root, or `apps/web-vite/biome.jsonc` if domain-scoped) and start at `warn` severity during the infra phase, flipping to `error` once every in-scope source file passes.
- `pnpm lint` (which invokes `biome check`) exits non-zero after the flip if any sink reintroduces a string literal.
- The exact Biome rule shape (`noRestrictedSyntax` AST selector vs. plugin) is decided in `plan.md` step 0; the binding contract here is "Biome, not ESLint, enforces this".

## API enforcement

- A Biome lint rule rejects string-literal `message` arguments to `new TRPCError({ message: … })` inside `packages/api/**` except inside `packages/api/src/errors.ts`. Allowed forms: identifier reference, member access (e.g. `E.APPROVAL_STEP_NOT_FOUND`), or template containing only such references.
- The existing `packages/api/src/__tests__/errors-i18n-parity.test.ts` is extended to also load `de.json` and `ar.json` and assert the same `Errors.<code>` parity for all four locales.
- The parity test is extended to fail when an error key reaches the `errorFormatter` that is not present in the `Errors` namespace of any locale (covers throws bypassing `errors.ts` until the lint flip lands).

## Sweep scope (frontend hardcoded English removal)

- Every `toast.*` call in `apps/web-vite/src/**` uses a translated string.
- Every `successMessage` / `errorMessage` passed to `useResourceMutation` is a `TranslationKey` (or `{ key, params }`).
- Every `<Empty …>` / empty-state copy, every confirmation dialog body, every system message banner in `apps/web-vite/src/**` resolves through `t(...)`.
- All six hooks already touched on the current branch (`use-drv-clearance.ts`, `use-equipment-detail-actions.ts`, `use-payment-run-step-review.ts`, `use-workflow-ui.ts`, `use-approval-actions.ts`, `use-template-mutations.ts`) are migrated as part of the sweep.
- The sweep proceeds domain-by-domain, one PR (or atomic commit) per domain: approvals, contractors, contracts, equipment, invoices, payments, timesheets, workflows, einvoice, notifications, settings, dashboard.

## Tests

- `apps/web-vite/src/i18n/__tests__/use-translated-error.test.ts` covers `useTranslatedError`: known `shape.data.errorKey` resolves to the locale string, unknown key falls back to `Errors.generic`, `errorParams` are passed through ICU interpolation, non-tRPC errors return `Errors.generic`.
- `apps/web-vite/src/components/feedback/__tests__/api-error-message.test.tsx` renders `<ApiErrorMessage>` for a known key, an unknown key, and a query-state error wrapper; asserts no raw `error.message` ever appears in the DOM.
- `apps/web-vite/src/hooks/__tests__/use-resource-mutation.test.ts` covers: API error with a known key → translated toast; API error with `errorParams` → interpolated toast; caller-supplied `errorMessage` overrides auto-translation; `successMessage` resolved through `t(...)`.
- `packages/api/src/__tests__/error-formatter.test.ts` covers the extended `errorFormatter`: a TRPCError with a known `errors.ts` key exposes `shape.data.errorKey`; with `cause.params` exposes `shape.data.errorParams`; an unknown message produces `errorKey: 'unknownError'`; F-SEC-20 stripping for `INTERNAL_SERVER_ERROR` is preserved.
- `packages/api/src/__tests__/errors-i18n-parity.test.ts` (extended) asserts `Errors.<code>` parity across `en`, `pl`, `de`, `ar` and fails when `errors.ts` contains a key absent from any locale or vice versa.
- `scripts/__tests__/generate-i18n-keys.test.ts` covers the codegen: deterministic output, leaf-path enumeration, branded `TranslationKey` type compiles for a valid key and fails `tsc` for a string literal that is not a key.
- A Biome rule snapshot test (or vitest equivalent against the rule's transformer) covers both directions: an offending fixture (string literal at a sink) produces the expected diagnostic; an allowed fixture (wrapped by `t(...)` / `tKey(...)`) produces no diagnostic.
- Every domain commit in the sweep adds or updates the tests for the hooks/components it touches when those tests reference user-visible message text — assertions move from English literal strings to translation keys or to ICU-rendered output for a fixed test locale.
- All new and updated tests are committed in the same atomic commit as the code they cover; no follow-up "add tests later" commits.

## Migration mechanics

- Work continues on the existing branch `dry-solid-audit/extract-shared` so it composes with the DRY/SOLID audit agent's stream rather than forking history.
- The DRY/SOLID audit agent has been committing successfully on this branch and may continue to land more commits while this work proceeds; the i18n work assumes the `useResourceMutation`-centered mutation/toast pattern that agent has already established is in place and intact when each i18n commit lands. The exact set of prior commits is not enumerated here on purpose.
- Each i18n change ships as an atomic commit on the same branch, mirroring the DRY agent's cadence (one logical unit per commit, message of the form `refactor(web-vite,i18n): … — i18n system messages step N`).
- Phase 1 (infra) lands the codegen, the branded `TranslationKey` type, `useTranslatedError`, `<ApiErrorMessage>`, the extended `errorFormatter`, the extended parity test, the new unit tests listed above, and the Biome rules in `warn` severity.
- Phase 2 (sweep) migrates each in-scope domain one commit at a time; the `useResourceMutation`-based mutation/toast shape established by the DRY agent is the canonical pattern and is preserved.
- Phase 3 (flip) raises Biome severity to `error`, removes the ad-hoc per-hook translation mappings (e.g. the `tKey(tErr, key)` block in `use-einvoice-tab.ts`), and lets the parity test fail on any drift.
- No alternate mutation/toast mechanism is introduced; nothing in this work conflicts with the parallel DRY agent or with any future hook-refactor passes on the same branch.

## Verification (final acceptance — runs after all phases complete)

This block is executed once at the end of the goal as the acceptance gate. It is not a continuous in-progress checklist; per-phase verification lives in `plan.md`.

- `pnpm i18n:keys` is deterministic — second run against unchanged `en.json` produces no diff.
- `pnpm typecheck` exits 0 across the workspace.
- `pnpm lint` exits 0 across the workspace with the Biome rules at `error` severity.
- `pnpm --filter @contractor-ops/api test` exits 0; the extended parity test passes for `en`, `pl`, `de`, `ar`; `error-formatter.test.ts` passes.
- `pnpm --filter @contractor-ops/web-vite test` exits 0 (scoped per CLAUDE.md memory `feedback_test_run_memory` — never unscoped on this Mac); `use-translated-error.test.ts`, `api-error-message.test.tsx`, `use-resource-mutation.test.ts` all pass.
- `rg "toast\.(success|error|info|warning)\(\s*['\"]" apps/web-vite/src` returns zero matches.
- `rg "successMessage:\s*['\"]" apps/web-vite/src` returns zero matches.
- `rg "errorMessage:\s*['\"]" apps/web-vite/src` returns zero matches.
- `rg "new TRPCError\(\{[^}]*message:\s*['\"]" packages/api/src | grep -v errors.ts` returns zero matches.
- Manual smoke in `pnpm dev`: trigger a representative API error in each locale (en, pl, de, ar) — the toast renders the translated string, not the camelCase key, and switches with the language toggle without page reload.
