---
phase: 56
plan: 01
subsystem: testing-infrastructure
tags: [wave-0, tdd, i18n, german, uk, validators, mdx, react-pdf]
requirements: [FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06]
requirements_addressed: [FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06]
dependency_graph:
  requires: []
  provides:
    - "12 failing Wave 0 test scaffolds for Plans 02–08"
    - "@next/mdx + @mdx-js/react + rehype-slug + rehype-autolink-headings installed for Plan 07"
    - "@react-pdf/renderer installed for Plan 07 PDF export"
  affects:
    - "apps/web/package.json"
    - "pnpm-lock.yaml"
    - "packages/validators/src/__tests__/"
    - "apps/web/src/**/__tests__/"
tech_stack:
  added:
    - "@next/mdx@16.2.3"
    - "@mdx-js/react@3"
    - "rehype-slug@6.0.0"
    - "rehype-autolink-headings@7.1.0"
    - "@react-pdf/renderer@4.4.1"
  patterns:
    - "Wave 0 scaffold comment convention: // Wave 0 scaffold — implemented in Plan NN"
    - "Import-error-as-RED signal (no production code created)"
    - "Per-Plan ownership annotation on each test file (T-56-02 mitigation)"
key_files:
  created:
    - "packages/validators/src/__tests__/uk-validators.test.ts"
    - "packages/validators/src/__tests__/de-validators.test.ts"
    - "packages/validators/src/__tests__/locked-phrases-guard.test.ts"
    - "packages/validators/src/__tests__/country-fields.test.ts"
    - "apps/web/src/i18n/__tests__/de-locale.test.ts"
    - "apps/web/src/components/contractors/compliance/__tests__/uk-compliance-fields.test.tsx"
    - "apps/web/src/components/contractors/compliance/__tests__/de-compliance-fields.test.tsx"
    - "apps/web/src/app/[locale]/(legal)/privacy/__tests__/privacy-gb.test.tsx"
    - "apps/web/src/app/[locale]/(legal)/privacy/__tests__/privacy-de.test.tsx"
    - "apps/web/src/app/[locale]/(legal)/privacy/__tests__/privacy-eu.test.tsx"
    - ".planning/phases/56-country-foundations-german-i18n/deferred-items.md"
  modified:
    - "apps/web/package.json"
    - "pnpm-lock.yaml"
    - "apps/web/src/components/layout/__tests__/user-menu.test.tsx"
    - "apps/web/src/components/consent/__tests__/onboarding-consent-step.test.tsx"
key_decisions:
  - "Used pnpm --ignore-scripts to bypass pre-existing broken postinstall (dinero.js + Prisma generated client missing on base commit)"
  - "Locked DE phrases asserted both in DOM (compliance/privacy tests) and in privacy-notices/de.ts (content guard)"
  - "IDOR guard (V4 Access Control) asserted at tRPC handler level, not at UI — server is the trust boundary"
metrics:
  duration: "~12 minutes"
  completed_date: "2026-04-12"
  tasks_completed: 3
  commits: 3
  test_files_created: 10
  test_files_modified: 2
---

# Phase 56 Plan 01: Wave 0 Test Infrastructure & Dependency Install — Summary

**One-liner:** Created 12 failing Wave 0 test scaffolds across `packages/validators` and `apps/web` that cover FOUND-01..06 with per-Plan ownership annotations, and installed the five MDX + React-PDF dependencies (`@next/mdx@16.2.3`, `@mdx-js/react@3`, `rehype-slug@6.0.0`, `rehype-autolink-headings@7.1.0`, `@react-pdf/renderer@4.4.1`) needed by Plan 07 privacy-notice rendering and PDF export.

## What Was Built

### Task 1 — Dependency install (`1028fa1`)

Installed five new direct dependencies into `apps/web/package.json` at the exact RESEARCH-verified versions. `--ignore-scripts` was required because the workspace's postinstall chain (`turbo build --filter=@contractor-ops/validators ...`) fails independently of this plan (missing `dinero.js`, missing Prisma generated client). All five packages are resolvable via `require.resolve(..., { paths: ['apps/web'] })`.

### Task 2 — Validator test scaffolds (`d24d7fc`)

Four files under `packages/validators/src/__tests__/`:
- **uk-validators.test.ts** — FOUND-01: UTR (mod-11 + trailing K), GB VAT (mod-97 + GBGD/GBHA prefixes), Companies House (regional prefixes)
- **de-validators.test.ts** — FOUND-02: USt-IdNr (ISO 7064 MOD-11-10, canonical `DE136695976` vector), SV-Nr structural checks, per-Bundesland Steuernummer (BW vs BY), Handelsregister composite (HRA/HRB/PR/GnR/VR)
- **locked-phrases-guard.test.ts** — FOUND-04: All 9 `LOCKED_DE_PHRASES` asserted verbatim, `RESERVED_LEGAL_KEYS` absence check across `en/pl/ar/de.json`, Sie-register guard (`/\b(Du|Dir|Dein|Deine|Deiner|Deines|Dich)\b/`), privacy-notices/de.ts presence
- **country-fields.test.ts** — FOUND-01/FOUND-02: GB + DE discriminated-union zod schemas (sole-trader / Ltd / VAT-registered / Einzelunternehmen / GmbH / Kleinunternehmer branches)

### Task 3 — apps/web test scaffolds (`a16dfaa`)

Eight test files (6 new, 2 extended):
- **de-locale.test.ts** (new) — FOUND-03: `routing.locales` includes `de`, `messages/de.json` parity with `en.json` (every flattened key present), `localeSettings.de = { timeZone: 'Europe/Berlin', currency: 'EUR' }`
- **uk-compliance-fields.test.tsx** (new) — FOUND-01: UTR/CH/VAT conditional rendering with `aria-required`
- **de-compliance-fields.test.tsx** (new) — FOUND-02/FOUND-04: 16-Bundesland select (alphabetical), Steuernummer disabled until Bundesland chosen, verbatim locked phrases in DOM, Handelsregister `<fieldset>` legend
- **privacy-gb.test.tsx** (new) — FOUND-05: 8 Article 13 `<h2>` sections, skip-link, PDF download
- **privacy-de.test.tsx** (new) — FOUND-06: 9 verbatim LOCKED_DE_PHRASES in DOM, `/legal/privacy/de` redirect for `countryCode=DE`, IDOR guard on PDF mutation
- **privacy-eu.test.tsx** (new) — FOUND-05/06 fallback for non-GB/DE/AE/SA codes
- **user-menu.test.tsx** (extended) — FOUND-03: localeOrder drift guard (`routing.locales` cardinality check + cycle-through-every-locale assertion)
- **onboarding-consent-step.test.tsx** (extended) — FOUND-01..06: GB/DE privacy acknowledgement renders, checkbox unchecked, Continue disabled until toggled, link safe-rel/target

## Verification Results

- **`pnpm --filter @contractor-ops/validators test`** → 11 test files failed (4 of which are our new Wave 0 scaffolds failing with `Cannot find module '../{uk,de}-validators.js'` / `../legal/de.js` — expected RED signal)
- **`pnpm --filter @contractor-ops/web test`** → 23 test files failed (8 of which are our new/extended Wave 0 scaffolds failing with unresolved imports for Plan 05/06/07/08 modules — expected RED signal)
- **`pnpm install`** completes (via `--ignore-scripts`) with lockfile updated
- **`node -e "require.resolve('@next/mdx', { paths: ['apps/web'] })"`** exits 0 (and same for the other 4 packages)
- **Locked phrase grep**: `grep -c "Verantwortlicher im Sinne der DSGVO" packages/validators/src/__tests__/locked-phrases-guard.test.ts` → 1
- **Locked phrase grep (DE privacy)**: `grep -c "Verantwortlicher im Sinne der DSGVO" apps/web/src/app/[locale]/(legal)/privacy/__tests__/privacy-de.test.tsx` → 1
- **IDOR guard**: `grep -c "jurisdiction.*SA" apps/web/src/app/[locale]/(legal)/privacy/__tests__/privacy-de.test.tsx` → 1
- **Plan ownership annotation** present in every file (`// Wave 0 scaffold — implemented in Plan NN` / `// Implemented in Plan NN`) satisfying T-56-02

## Deviations from Plan

### 1. [Rule 3 — Blocking issue] Used `--ignore-scripts` for Task 1 install

- **Found during:** Task 1 first install attempt
- **Issue:** `pnpm --filter @contractor-ops/web add` triggers workspace postinstall (`turbo build`) which fails on pre-existing broken state: `packages/shared/src/money.ts` imports `dinero.js` (uninstalled), `packages/db` imports `../generated/prisma/client/index.js` and `@prisma/adapter-neon` (both missing). These errors are unrelated to the MDX/React-PDF packages being installed.
- **Fix:** Re-ran with `pnpm --filter @contractor-ops/web add --ignore-scripts ...`. Then ran `pnpm install --ignore-scripts` to regenerate workspace symlinks (the first `add` had completed the package manifest change but skipped symlink creation). Resulting state: all 5 new deps in `apps/web/package.json` at exact versions, lockfile committed, packages resolvable.
- **Commit:** `1028fa1`
- **Out-of-scope items logged:** `deferred-items.md` (Prisma generated client, dinero.js)

### 2. [Plan accommodation] Used relative-path `readFileSync` in locked-phrases-guard.test.ts

- **Found during:** Task 2
- **Issue:** Plan specified reading `apps/web/messages/de.json` and `apps/web/src/content/privacy-notices/de.ts` from a validators-package test. Wired via `join(__dirname, '..', '..', '..', '..', 'apps', 'web', ...)` to preserve cross-package guard behavior.
- **Fix:** Explicit constants `WEB_MESSAGES_DIR` and `DE_PRIVACY_NOTICE_PATH` at top of file for readability and easy adjustment in Plan 05/07.

### 3. [Scope note] user-menu + onboarding-consent tests extended, not replaced

Plan text says "EXTEND existing user-menu behavior" / "If file doesn't exist, create fresh; include a case for ... — the existing ... is skipped". Both test files already exist; Wave 0 additions are appended as a dedicated `describe` block with `// Wave 0 scaffold — implemented in Plan NN` header so the checker can trace ownership and so the existing passing tests are undisturbed.

## Authentication Gates

None — no network calls, no external services involved.

## Known Stubs

None introduced by this plan (no production code written).

## Threat Flags

None — this plan introduces no new runtime surface, only npm dependencies (pinned per threat model T-56-01) and test files with Plan-ownership annotations (T-56-02 mitigation).

## Deferred Issues

See `.planning/phases/56-country-foundations-german-i18n/deferred-items.md` for the full catalog of pre-existing workspace failures and test failures that were observed but explicitly NOT fixed (out-of-scope per GSD deviation rules).

## Commits

| # | Task | Hash     | Subject |
|---|------|----------|---------|
| 1 | Install MDX + React-PDF deps | `1028fa1` | `chore(56-01): install MDX + React-PDF deps for German i18n` |
| 2 | Validator test scaffolds     | `d24d7fc` | `test(56-01): add Wave 0 failing validator test scaffolds` |
| 3 | apps/web test scaffolds      | `a16dfaa` | `test(56-01): add Wave 0 failing apps/web test scaffolds` |

## Self-Check: PASSED

Files verified to exist:
- packages/validators/src/__tests__/uk-validators.test.ts ✓
- packages/validators/src/__tests__/de-validators.test.ts ✓
- packages/validators/src/__tests__/locked-phrases-guard.test.ts ✓
- packages/validators/src/__tests__/country-fields.test.ts ✓
- apps/web/src/i18n/__tests__/de-locale.test.ts ✓
- apps/web/src/components/contractors/compliance/__tests__/uk-compliance-fields.test.tsx ✓
- apps/web/src/components/contractors/compliance/__tests__/de-compliance-fields.test.tsx ✓
- apps/web/src/app/[locale]/(legal)/privacy/__tests__/privacy-gb.test.tsx ✓
- apps/web/src/app/[locale]/(legal)/privacy/__tests__/privacy-de.test.tsx ✓
- apps/web/src/app/[locale]/(legal)/privacy/__tests__/privacy-eu.test.tsx ✓
- apps/web/src/components/layout/__tests__/user-menu.test.tsx (extended) ✓
- apps/web/src/components/consent/__tests__/onboarding-consent-step.test.tsx (extended) ✓

Commits verified in `git log --oneline`:
- 1028fa1 ✓ | d24d7fc ✓ | a16dfaa ✓
