# Facts — i18n typed keys cleanup

## Scope

- All 134 occurrences of `as Parameters<typeof t>[0]` across 74 files under `apps/web/src/` are removed.
- All `as keyof <IntlMessages|Messages>` casts on translation keys are removed.
- Zero translation-related `as` casts remain in `apps/web/src/`.
- No code outside `apps/web/src/` is modified (no casts exist in `packages/*`).
- The 4 message JSON files (`apps/web/messages/{en,pl,ar,de}.json`) are not modified.

## Type source

- A codegen step reads `apps/web/messages/en.json` and emits a `.d.ts` file with the full `Messages` type tree.
- The generated file lives at `apps/web/src/generated/i18n/messages.d.ts`.
- The generated file is git-ignored, mirroring `src/generated/prisma/client/`.
- The generator is implemented as `scripts/generate-i18n-types.ts` and invoked via `pnpm i18n:types`.
- Re-running the generator with unchanged `en.json` produces a byte-identical output (deterministic).
- Running the generator after editing `en.json` regenerates `messages.d.ts` without manual intervention.

## next-intl integration

- A module augmentation declares `IntlMessages` as the generated `Messages` type so next-intl's `useTranslations` / `getTranslations` resolve keys strictly.
- After augmentation, passing a non-existent dotted key to `t(...)` fails `tsc`.
- After augmentation, passing a non-leaf (object) key to `t(...)` fails `tsc`.
- The existing `apps/web/src/types/next-intl.d.ts` is updated to perform the global augmentation; its prior "deliberately do not augment" comment is removed.

## Dynamic-key helper

- A typed helper `tDyn` lives at `apps/web/src/i18n/typed-keys.ts`.
- Signature: `tDyn(t, subNs, key)` where `subNs` is constrained to keys of `t`'s namespace whose value is an object, and `key` is constrained to leaf string keys of that sub-namespace.
- `tDyn` returns a translated string (same return type as `t`).
- `tDyn` supports an optional 4th argument for interpolation values, typed the same as `t`'s second argument.
- At every site previously written as `t(\`<subNs>.${expr}\` as Parameters<typeof t>[0])`, the code becomes `tDyn(t, '<subNs>', expr)` with no cast.
- Passing an invalid `subNs` to `tDyn` fails `tsc`.
- Passing an invalid `key` (not a leaf of the chosen sub-namespace) fails `tsc`.

## Codegen wiring

- A turbo task `i18n:types` is defined in `turbo.json` with `inputs: ["apps/web/messages/en.json", ...]` and `outputs: ["apps/web/src/generated/i18n/**"]`.
- `typecheck`, `build`, and `dev` tasks have `i18n:types` as a dependency (directly or via task graph).
- Running `pnpm typecheck`, `pnpm build`, or `pnpm dev` from a clean checkout regenerates `messages.d.ts` before the dependent task runs.
- Re-running `pnpm typecheck` with no changes to `en.json` produces a turbo cache hit for the `i18n:types` task.

## Regression guard

- A Biome `noRestrictedSyntax` rule (or equivalent Biome pattern rule) blocks the literal pattern `as Parameters<typeof t>` in `apps/web/src/`.
- The same rule blocks `as keyof IntlMessages` and `as keyof Messages` in `apps/web/src/`.
- `pnpm lint` exits non-zero if either pattern is reintroduced.
- The rule does not flag non-translation `as Parameters<typeof X>` usage in unrelated code.

## Existing safety nets

- `scripts/audit-i18n-code-coverage.ts` continues to run via `pnpm i18n:code-coverage` as the runtime safety net for dynamic-key prefixes.
- The `LeafKeysOf<T>` helper in `apps/web/src/types/next-intl.d.ts` is retained or removed based on whether it is still referenced after the migration; no orphaned helper remains.

## Verification

- After all changes, `rg "as Parameters<typeof t>" apps/web/src` returns zero matches.
- After all changes, `rg "as keyof (IntlMessages|Messages)" apps/web/src` returns zero matches.
- `pnpm typecheck` exits 0.
- `pnpm lint` exits 0.
- `pnpm i18n:code-coverage` exits 0.
- `pnpm test` (relevant unit tests) exits 0.
- A representative sample of the previously cast-using components renders without runtime `MISSING_MESSAGE` errors in `pnpm dev`.
