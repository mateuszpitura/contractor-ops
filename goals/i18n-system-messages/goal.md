# Goal — i18n system messages (no hardcoded English)

Make translation keys the only legal source of user-facing strings across `apps/web-vite` and the `packages/api` error surface that feeds it. Every `TRPCError` carries a key (plus optional interpolation params) instead of an English message, the client auto-translates that key inside `useResourceMutation` + `<ApiErrorMessage>` so no component ever reads `error.message` directly, and Biome lint + a four-locale parity test prevent regression at the sink level.

## Shared understanding

See [`facts.md`](./facts.md) — the canonical fact sheet describing the API error contract, the extended `errorFormatter` shape, the branded `TranslationKey` codegen, the `useTranslatedError` / `<ApiErrorMessage>` / `useResourceMutation` wiring, the Zod-message strategy, the test inventory, the Biome enforcement perimeter, the sweep scope, and the final verification block.

## Execution plan

See [`plan.md`](./plan.md) — Phase 0 investigation gates (turbo task ownership, Biome 2.4 rule mechanism, `error.cause` round-trip), Phase 1 infrastructure (warn-mode lint), Phase 2 domain-by-domain sweep, Phase 3 flip to `error`, plus risks and open questions.

## Companion goal

`goals/i18n-typed-keys/` covers the same principle for `apps/web` (next-intl) — typed keys + cast cleanup. This goal complements it on the `apps/web-vite` (react-i18next) side and adds the API-side error-key contract that both clients benefit from.

## Done condition

All of the following hold:

- Every `TRPCError` thrown in `packages/api/src/**` carries a `message` that is a constant from `packages/api/src/errors.ts` — no string literals (verified by Biome rule at `error` severity).
- `packages/api/src/init.ts` `errorFormatter` exposes `shape.data.errorKey` and `shape.data.errorParams`; F-SEC-20 protections preserved; `error-formatter.test.ts` green.
- `packages/api/src/__tests__/errors-i18n-parity.test.ts` asserts `Errors.<code>` parity across `en`, `pl`, `de`, `ar` and fails in either direction (key missing in any locale, or locale entry without a matching `errors.ts` export).
- `apps/web-vite/src/generated/i18n/keys.d.ts` is emitted deterministically by the turbo `i18n:types` (or `i18n:keys`) task and exports a branded `TranslationKey` union; a plain `string` cannot satisfy `TranslationKey` without going through `t(...)` or `tKey(...)`.
- `apps/web-vite/src/i18n/use-translated-error.ts` and `apps/web-vite/src/components/feedback/api-error-message.tsx` exist with the test coverage listed in `facts.md` Tests section.
- `apps/web-vite/src/hooks/use-resource-mutation.ts` typed `successMessage` / `errorMessage` as `TranslationKey | { key, params }`; auto-translates API errors when no override is set; raw `error.message` fallback removed; covered by `use-resource-mutation.test.ts`.
- All hardcoded English at the sweep-scope sinks is gone in `apps/web-vite/src/**` (toast.*, *Message configs/props, empty/confirmation/system text, Zod schema messages).
- `rg "toast\.(success|error|info|warning)\(\s*['\"]" apps/web-vite/src` returns zero matches; same for `rg "successMessage:\s*['\"]" apps/web-vite/src` and `rg "errorMessage:\s*['\"]" apps/web-vite/src`.
- `rg "new TRPCError\(\{[^}]*message:\s*['\"]" packages/api/src | grep -v errors.ts` returns zero matches.
- `pnpm i18n:types` (or `i18n:keys`), `pnpm typecheck`, `pnpm lint`, `pnpm --filter @contractor-ops/api test`, and `pnpm --filter @contractor-ops/web-vite test` (scoped per `feedback_test_run_memory`) all exit 0 with the Biome rules at `error` severity.
- Manual smoke in `pnpm dev`: a representative API error renders the translated string in each of the four locales and switches with the language toggle without page reload.
