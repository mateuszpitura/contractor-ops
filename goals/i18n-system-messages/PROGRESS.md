# Progress — i18n system messages

Tracking the actual state of the sweep against `goal.md` Done condition.

## Done

- **Phase 0 (investigation)** — all three gates verified
  - `i18n:types` task already wired to apps/web-vite via root script.
  - Biome 2.4.11 supports GritQL plugins.
  - `error.cause` round-trip is reachable in the formatter (decoded via
    pure `formatTrpcError` so the test does not need an HTTP layer).
- **Phase 1 (infrastructure)** — commit `8224b605`
  - `packages/api/src/init.ts` extends `errorFormatter` with
    `shape.data.errorKey` + `errorParams`.
  - `packages/api/src/errors.ts` adds `isKnownApiErrorValue`.
  - `apps/web-vite/src/i18n/use-translated-error.ts` + `<ApiErrorMessage>`.
  - `apps/web-vite/src/hooks/use-resource-mutation.ts` rewired with the
    transitional `TranslationKey | { key, params } | string` arm.
  - Branded `TranslationKey` codegen via `scripts/generate-i18n-types.ts`.
  - Three GritQL plugins under `tools/biome-plugins/` (warn severity)
    + `biome-plugins.test.ts` covering both directions.
  - `Errors.generic` in all four locales.
- **Phase 2 (sweep) — API side complete** — commits
  `66c94948 → 072824b1 → efd87709 → e3745569`
  - Every `TRPCError({ message })` literal in `packages/api/src/**` has
    been migrated to a constant from `errors.ts`.
  - `pnpm exec biome check packages/api/src` reports **zero**
    `no-untranslated-trpc-error` warnings (excluding intentional test
    fixtures which carry `biome-ignore` suppressions documenting why).
  - errors.ts now exports ~140 constants spanning org definitions,
    contractor / contract / invoice / payment / approval / workflow,
    document / portal / integration, reminder / settings / e-sign,
    API key / tenant, classification, billing, BACS, eInvoice / ZATCA /
    KSeF / PEPPOL, Jira / Linear / Clockify / Google Workspace /
    courier, IR35 chain, timesheets, GDPR / consent, validation.
  - Locales `en / pl / de / ar` each carry the matching translations
    (130+ `Errors.*` entries; the parity test asserts coverage).
- **Phase 2 (sweep) — frontend partial** — commit `45842738`
  - `apps/web-vite/src/i18n/use-common-toasts.ts` ships 12 keyed thunks
    for the recurring sonner literals.
  - `Common.toast*` + `Common.validation*` entries added in en/pl/de/ar.
  - Migration of `toast.success('Done.')` underway: `use-billing.ts`,
    `use-classification-disclaimer.ts`, `use-contract-bulk-actions.ts`,
    `use-classification-dashboard.ts` are migrated.

## Remaining

`pnpm exec biome check apps/web-vite/src` still reports **~63
warnings** from `no-untranslated-toast` and `no-untranslated-zod-message`
across ~33 hook files. The work is purely mechanical now that the
locale keys + helper exist:

For each file flagged below, apply the same three-step edit:

1. Add `import { useCommonToasts } from '../../../i18n/use-common-toasts.js';`
   (path depth varies — copy whichever relative depth the other
   `i18n/useTranslations.js` import in the file already uses).
2. Inside the hook function, add `const toasts = useCommonToasts();`
   next to the existing `const t = useTranslations(...)`.
3. Replace each `toast.success('Done.')` → `toast.success(toasts.done())`
   and the matching `toast.success('Project created')` etc. with the
   appropriate `toasts.<key>()` thunk (see `use-common-toasts.ts`).

Files (count of `Done.` / equivalent literals):

| File | Count |
|------|-------|
| `src/components/invoices/hooks/use-invoice-upload.ts` | 5 |
| `src/components/invoices/hooks/use-intake-detail-actions.ts` | 4 |
| `src/components/contractors/hooks/use-ir35-chain.ts` | 4 |
| `src/components/organization/hooks/use-team-form-sheet.ts` | 3 |
| `src/components/organization/hooks/use-project-form-sheet.ts` | 3 |
| `src/components/organization/hooks/use-cost-center-form-sheet.ts` | 3 |
| `src/components/invoices/hooks/use-invoice-metadata-form.ts` | 3 |
| `src/components/import/hooks/use-import-wizard.ts` | 3 |
| `src/components/contractors/hooks/use-contractor-bulk-actions.ts` | 3 |
| `src/components/contractors/hooks/use-classification-documents.ts` | 3 |
| `src/components/invoices/hooks/use-einvoice-tab.ts` | 2 |
| `src/components/contracts/hooks/use-contract-detail-header.ts` | 2 |
| `src/components/contractors/hooks/use-engagement-classification.ts` | 2 |
| `src/components/contractors/hooks/use-contractor-wizard-dialog.ts` | 2 |
| `src/components/contractors/hooks/use-contractor-profile.ts` | 2 |
| `src/components/contractors/classification/hooks/use-classification-wizard-shell.ts` | 2 |
| ~20 more single-site files | 1 each |

Zod plugin sites (4): `use-contractor-wizard-dialog.ts`,
`wizard-dialog.tsx`, `use-reminder-rule-editor.ts`. Pattern matches
`.refine(..., { message: 'literal' })`; replace with the
`Common.validation*` keys already in the bundle and rely on
`zod-issues-to-keys.ts` (Phase 2.3 in `plan.md`) for client-side
translation at render time.

## Phase 3 (flip)

Cannot land until the frontend remainder above is at zero plugin
warnings — raising the three plugin severities from `warn` to `error`
would fail `pnpm lint` immediately. The flip itself is a one-line
change in `biome.json` (three `severity` overrides) plus the final
acceptance block from `facts.md`.

## Verification snapshot

- `pnpm i18n:types` deterministic (asserted in `translation-keys.test.ts`).
- `pnpm typecheck` — green.
- `pnpm exec vitest run` (scoped) — 26+ tests green covering formatter,
  parity, plugins, useTranslatedError, ApiErrorMessage,
  useResourceMutation, translation keys.
- `rg "new TRPCError\(\{[^}]*message:\s*['\"]" packages/api/src | grep -v errors.ts`
  — returns only the three test-fixture sites that carry
  `biome-ignore` comments.
