---
phase: 84-theme-a-us-contractor-profile-fields-en-us-locale
plan: 02
subsystem: i18n / web-vite locale registration + lint-guards parity gate
tags: [i18n, en-US, locale, fallback, parity-guard, US-LOC-01]
requirements: [US-LOC-01]
dependency_graph:
  requires:
    - "apps/web-vite i18n bootstrap (SUPPORTED_LOCALES / localeMeta / loaders / applyLocale)"
    - "packages/lint-guards i18n-parity run-guard + scripts/i18n-parity.mjs"
  provides:
    - "en-US selectable thin-override locale at effective full parity via fallbackLng (en-US → en → pl)"
    - "fallback-aware i18n:parity peer mode (fallbackPeers) — a thin en-US.json passes without relaxing strict de/pl/ar"
    - "exported flattenLocaleKeys helper for building fallback key sets"
  affects:
    - "Plan 05 (US copy keys land in messages/en-US.json as divergent overrides)"
    - "Plan 06 (US compliance components render under en-US)"
tech_stack:
  added: []
  patterns:
    - "thin-override locale + i18next fallbackLng map"
    - "fallback-aware parity peer (union of peerKeys ∪ fallbackBaseKeys)"
    - "exact region-tag match before 2-letter normalization in pickBestLocale"
key_files:
  created:
    - apps/web-vite/messages/en-US.json
    - apps/web-vite/public/flags/us.svg
    - apps/web-vite/src/i18n/__tests__/messages.test.ts
    - packages/lint-guards/src/__fixtures__/messages-fallback/{en,de,pl,ar,en-US}.json
  modified:
    - apps/web-vite/src/i18n/messages.ts
    - apps/web-vite/src/i18n/index.ts
    - apps/web-vite/src/components/settings/language-card.tsx
    - apps/web-vite/messages/{en,de,pl,ar}.json
    - packages/lint-guards/src/i18n-parity/run-guard.ts
    - packages/lint-guards/src/__tests__/i18n-parity.test.ts
    - scripts/i18n-parity.mjs
decisions:
  - "en-US is fallback-aware, NOT a strict peer — a thin override passes parity while a real de/pl/ar gap still fails (T-84-02-01 mitigation preserved)"
  - "fallbackPeers is a Record<locale, Set<key>> on I18nParityOptions; covered = peerKeys ∪ fallbackKeys ∪ baseline"
  - "pickBestLocale exact region-tag match wins first (en-US → en-US) so a US user lands on the override, not the en base; en-GB still normalises to en"
  - "thin en-US.json ships as {} this plan; divergent US copy keys are Plan 05"
  - "added a real divergent key languageEnglishUs to all four strict peers (the locale-switcher label) — forced by widening the Locale union, kept parity green"
metrics:
  duration: ~25min
  tasks: 2
  files: 14
  completed: 2026-06-08
---

# Phase 84 Plan 02: en-US Locale (Fallback-Parity) Summary

Registered `en-US` as a selectable thin-override locale at effective full parity via the i18next `fallbackLng` chain (`en-US → en → pl`), and taught the `i18n:parity` gate a fallback-aware peer mode so a deliberately-thin `en-US.json` passes CI without relaxing the exact-parity semantics of the strict `de/pl/ar` peers.

## What Was Built

**Task 1 — fallback-aware i18n:parity guard (TDD):**
- `I18nParityOptions` gains `fallbackPeers?: Record<string, ReadonlySet<string>>`. In `runI18nParity`, a fallback-aware peer's covered set is `peerKeys ∪ fallbackKeys ∪ baseline` — a base key present in the fallback locale (en) counts as covered for en-US. Strict peers keep exact `peerKeys` semantics unchanged.
- Exported `flattenLocaleKeys(filePath)` so callers build the fallback key set without re-implementing flatten.
- `scripts/i18n-parity.mjs` runs en-US as a fallback-aware peer (`fallbackPeers: { 'en-US': <en keys> }`) in BOTH the `--update-baseline` and main branches; `peers: ['de','pl','ar']` stays the strict array.
- Test extended with the four behavior cases: en-US divergent-key pass, en-only-key covered-for-en-US pass, strict-peer (de) gap still fails, both-missing (en-US ∪ partial-fallback) flagged.

**Task 2 — register en-US locale + fallback chain + thin override (TDD):**
- `SUPPORTED_LOCALES` += `'en-US'`; `localeMeta['en-US']` = `{ nativeName/englishName 'English (US)', dir 'ltr' }`; `localeLoaders['en-US']` dynamic-imports `messages/en-US.json`.
- `pickBestLocale` gains an exact (case-insensitive) region-tag match pass before the 2-letter normalization, so an explicit `en-US` preference resolves to `en-US` while `en-GB` still normalises to `en`.
- `index.ts`: `fallbackLng` changed from the bare default to a map `{ 'en-US': ['en', DEFAULT_LOCALE], default: [DEFAULT_LOCALE] }`; `applyLocale('en-US')` also registers the `en` fallback bundle so inherited keys resolve. `<html dir>` ternary unchanged — en-US stays `ltr`, ar stays `rtl`.
- `messages/en-US.json` created as a near-empty thin override `{}` (US copy keys are Plan 05).
- New `messages.test.ts` pins registration + exact-match + `Intl` en-US `MM/DD/YYYY` dates + leading-`$` USD currency.

## Verification

| Gate | Result |
|------|--------|
| `pnpm --filter @contractor-ops/lint-guards test src/__tests__/i18n-parity.test.ts` | 5 passed (1 original strict + 4 fallback) |
| `pnpm --filter @contractor-ops/web-vite test src/i18n/__tests__/messages.test.ts` | 10 passed |
| `pnpm i18n:parity` | OK — en keys covered in de/pl/ar; en-US thin override passes (494 pre-existing baseline sites tolerated) |
| existing i18n suite (translations / pick-best-locale / translation-keys / typed-keys) | 22 passed — no ar RTL regression; `applyLocale('en-US')` exercised via SUPPORTED_LOCALES iteration |
| `pnpm typecheck --filter=@contractor-ops/lint-guards` | clean |
| web-vite `tsc --noEmit` | clean for my changes (only pre-existing 84-04/84-06 RED scaffolds remain) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Locale-switcher map completeness after Locale-union widening**
- **Found during:** Task 2 (web-vite typecheck after adding `'en-US'` to `SUPPORTED_LOCALES`)
- **Issue:** `apps/web-vite/src/components/settings/language-card.tsx` holds two `Record<Locale, string>` maps (`localeFlagSrc`, `localeToKey`). Widening `Locale` to include `'en-US'` made tsc require both maps to add an `en-US` entry (TS2741). The locale switcher renders every `SUPPORTED_LOCALES` entry, so en-US must be presentable per UI-SPEC §E ("English (US)").
- **Fix:** Added `'en-US'` to both maps (`/flags/us.svg`, label key `languageEnglishUs`); created `public/flags/us.svg` (circular-masked 512×512, same flag-icons style as the existing de/pl/sa flags); added the `languageEnglishUs` label key to all four strict peers (`en/de/pl/ar`) so parity stays green (en: "English (US)", de: "Englisch (US)", pl: "Angielski (USA)", ar: "الإنجليزية (الولايات المتحدة)").
- **Files modified:** `language-card.tsx`, `public/flags/us.svg`, `messages/{en,de,pl,ar}.json`
- **Commit:** `7671d188`

**2. [Plan path reconciliation] test file paths corrected**
- The plan/RESEARCH referenced `packages/lint-guards/src/i18n-parity/__tests__/run-guard.test.ts` and `apps/web-vite/src/i18n/__tests__/messages.test.ts`. The real lint-guards guard test is `packages/lint-guards/src/__tests__/i18n-parity.test.ts` (extended in place, matching the plan frontmatter). `messages.test.ts` did not exist — created it (the plan's `<verify>` runs it and `files_modified` lists it).

## Out of Scope (pre-existing, not fixed)

The following `tsc`/`build` errors are **84-00 Wave-0 RED scaffolds** owned by other plans in this phase — by-design failing tests that turn GREEN in their plan. Confirmed pre-existing (committed in `test(84-00)`, commits `d89ff725`/`3b409c5a`), not caused by this plan:
- `packages/gov-api/src/clients/__tests__/usps-client.test.ts` — 84-04 (USPS adapter)
- `apps/web-vite/src/components/contractors/__tests__/country-compliance-us.test.tsx` — 84-06 (US components)
- `apps/web-vite/src/components/contractors/compliance/__tests__/ssn-masked-reveal.test.tsx` — 84-06

Not logged to deferred-items.md (they are tracked by their owning plans, not novel discoveries).

## Threat Surface

No new runtime trust boundary. T-84-02-01 (parity-gate relaxation) is mitigated as designed: the fallback-aware mode applies ONLY to en-US (the test asserts a strict de gap still fails) — the gate is not globally weakened. ar RTL non-regression verified (messages.test.ts + translations.test.ts).

## Known Stubs

`apps/web-vite/messages/en-US.json` is an intentional empty thin override `{}` this plan — divergent US copy keys are added by **Plan 05** (documented in the objective + D-04). Not a blocking stub: en-US is at effective full parity via the `en` fallback chain, so every key resolves at runtime today.

## Authentication Gates

None.

## Self-Check: PASSED

- Files: en-US.json, us.svg, messages.test.ts, run-guard.ts, i18n-parity.mjs — all FOUND.
- Commits: 7eaa7179 (test), 050f36e6 (feat), 67e5eccd (test), 7671d188 (feat) — all FOUND.
- TDD gate sequence verified: `test(84-02)` precedes `feat(84-02)` for both tasks.
