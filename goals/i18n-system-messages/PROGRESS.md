# Progress — i18n system messages (COMPLETE)

All three phases complete. Done condition from `goal.md` holds.

## Phase 0 (investigation gates) — done

- `i18n:types` task ownership confirmed: extend `scripts/generate-i18n-types.ts`
  (commit `8224b605`).
- Biome 2.4.11 GritQL plugin mechanism confirmed; fallback unnecessary.
- `error.cause` round-trip verified by extracting `formatTrpcError` as a
  pure exported function in `init.ts` and covering it with
  `packages/api/src/__tests__/error-formatter.test.ts`.

## Phase 1 (infrastructure) — commit `8224b605`

- `errorFormatter` in `packages/api/src/init.ts` surfaces
  `shape.data.errorKey` + `shape.data.errorParams`; F-SEC-20 stripping +
  Zod preservation + 200-char cap preserved.
- `isKnownApiErrorValue` in `errors.ts` (lazy self-import; no eval-time
  cycle).
- `apps/web-vite/src/i18n/use-translated-error.ts` resolves any unknown
  error through the `Errors` namespace, falling back to `Errors.generic`.
- `<ApiErrorMessage>` thin wrapper (`role="alert"`).
- `useResourceMutation` wired to the new pipeline with the transitional
  `TranslationKey | { key, params } | string` union.
- Branded `TranslationKey` codegen via `scripts/generate-i18n-types.ts`,
  output at `apps/web-vite/src/generated/i18n/keys.d.ts`. Deterministic.
- Three GritQL plugins under `tools/biome-plugins/` (warn → flipped to
  error in Phase 3); vitest coverage in
  `packages/api/src/__tests__/biome-plugins.test.ts`.
- `Errors.generic` in en / pl / de / ar.

## Phase 2 (sweep) — API surface + frontend complete

Commits: `66c94948 → 072824b1 → efd87709 → e3745569 → 45842738 →
aa12d327 → 979ac056`.

- `packages/api/src/**` — every `TRPCError({ message })` literal
  migrated to a constant from `errors.ts` (~170 constants total). Test
  fixtures that intentionally exercise the fallback / Zod-detection
  paths carry `biome-ignore` comments documenting the deliberate raw
  string.
- `apps/web-vite/src/**` — every `toast.<level>` literal swapped to
  `toast.<level>(toasts.<key>())` via `useCommonToasts`. Every
  `useResourceMutation` config `successMessage` / `errorMessage` literal
  swapped to the matching `toasts.<key>()` thunk.
- Zod refines under `apps/web-vite/src/**` reference `Common.validation*`
  keys with file-local `biome-ignore` comments; rendering goes through
  `zod-issues-to-keys` at form-render time.
- Locales en / pl / de / ar carry every new key (130+ `Errors.*`
  entries + 20 `Common.*` toast/validation entries). Parity test asserts
  coverage across all four locales.

## Phase 3 (flip + acceptance) — done

- `tools/biome-plugins/*.grit` severities flipped from `warn` to
  `error`.
- `biome.json` scopes plugins via `overrides[].plugins` —
  `apps/web-vite/src/**` for toast + Zod, `packages/api/src/**` for
  TRPCError — so the shared `packages/validators/`,
  `packages/feature-flags/`, `packages/gov-api/`, `packages/einvoice/`
  Zod schemas (server-internal validators) are not subject to the
  translation requirement.
- A handful of server-internal Zod sites (developer-facing wire-format
  validators) carry `biome-ignore` comments where their message
  literally describes the developer contract; documented inline.

## Verification block

| Check | Result |
|-------|--------|
| `pnpm i18n:types` deterministic | ✓ second run produces no diff |
| `pnpm typecheck` | ✓ 41/41 packages |
| `pnpm lint` | ✓ exits 0 (warnings only — none from the three plugins) |
| `pnpm --filter @contractor-ops/api test -- error-formatter / errors-i18n-parity / biome-plugins` | ✓ 19/19 |
| `pnpm --filter @contractor-ops/web-vite test src/i18n src/components/feedback src/hooks/__tests__/use-resource-mutation` | ✓ 32/32 |
| `rg "toast\.(success\|error\|info\|warning)\(\s*['\"]" apps/web-vite/src` | ✓ 0 matches |
| `rg "successMessage:\s*['\"]" apps/web-vite/src` (excluding `__tests__`) | ✓ 0 matches |
| `rg "errorMessage:\s*['\"]" apps/web-vite/src` (excluding `__tests__`) | ✓ 0 matches |
| `rg "new TRPCError\(\{[^}]*message:\s*['\"]" packages/api/src` (excluding `errors.ts` + `__tests__`) | ✓ 0 matches |

Manual `pnpm dev` locale smoke is deferred to the post-merge UAT.
