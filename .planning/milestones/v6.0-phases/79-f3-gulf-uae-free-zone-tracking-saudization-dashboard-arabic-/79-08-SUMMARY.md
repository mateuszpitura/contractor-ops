---
phase: 79-f3-gulf-uae-free-zone-tracking-saudization-dashboard-arabic-
plan: 08
subsystem: i18n
tags: [gulf, i18n, arabic, rtl, saudization, free-zone, locked-phrases, d-16, gulf-08, gulf-09]

# Dependency graph
requires:
  - phase: 79-06
    provides: "Contractors.freeZone.* key inventory (form/zones/empty/error/toast/scopeMismatch) referenced by the free-zone surface"
  - phase: 79-07
    provides: "Saudization.* key inventory (dashboard/config/override/empty/error/toast/offboardingTrajectory + bands) referenced by the Saudization surface"
  - phase: 79-02
    provides: "LOCKED_AE_PHRASES / LOCKED_SA_PHRASES + RESERVED_*_LEGAL_KEYS (the D-14 statutory source of truth; band labels come from here, never from JSON)"
  - phase: 79-01
    provides: "check-rtl-logical-props.mjs (Gulf-surface physical-direction guard)"
provides:
  - "Real 4-locale (en/de/pl/ar) values for every Gulf user-facing key used by Plans 06/07 — D-16 genuine de/pl/ar, not en placeholders"
  - "Saudization.bands.* populated from LOCKED_SA_PHRASES literal labels (identical across all 4 locales — D-14, never free-translated)"
  - "C10 GREEN at the translation layer: i18n:parity + Phase-79 AE/SA locked-phrases guard + RTL logical-props guard all pass across the Gulf surface"
affects: [80 cross-feature integration + manual UAT consolidates the pending Arabic RTL render + de/pl genuineness human-verify and the Arabic statutory legal sign-off]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gulf translatable copy lives in messages/{en,de,pl,ar}.json under Contractors.freeZone.* + Saudization.*; statutory band labels resolve to LOCKED_SA_PHRASES literals (Saudization.bands.* = the UPPER_SNAKE band string, same in every locale)"
    - "ICU plural for count copy (Saudization.qiwa.gapCount) — Arabic uses the full zero/one/two/few/many/other CLDR plural set; en uses one/other"
    - "Zone proper-noun authority/place names kept verbatim in de/pl (entity names are not translated), localized into Arabic script in ar"
    - "Interpolation placeholders ({code},{date},{count},{band},{rate},{projectedRate}) are byte-identical across all 4 locales"

key-files:
  created:
    - .planning/milestones/v6.0-phases/79-f3-gulf-uae-free-zone-tracking-saudization-dashboard-arabic-/79-08-SUMMARY.md
  modified:
    - apps/web-vite/messages/en.json
    - apps/web-vite/messages/de.json
    - apps/web-vite/messages/pl.json
    - apps/web-vite/messages/ar.json

key-decisions:
  - "Saudization.bands.* = LOCKED_SA_PHRASES literal labels (PLATINUM/HIGH_GREEN/.../RED), identical in en/de/pl/ar (D-14). The reserved-key guard forbids the identifier NAMES (NITAQAT_BAND_PLATINUM…), not the bare key path / value, so bands.PLATINUM=\"PLATINUM\" is both safe and the required statutory label."
  - "Free-zone zone names: official entity/place names kept verbatim in de/pl (e.g. Abu Dhabi Global Market (ADGM), Dubai Internet City); Arabic gets genuine Arabic names (سوق أبوظبي العالمي, مدينة دبي للإنترنت). The translation-quality audit's English-leakage heuristic flags only these proper-noun zones in de/pl — intentional, matches existing codebase convention (Contractors.steuernummer / company-registration entries)."
  - "offboardingTrajectory.projection honors the ACTUAL component call site (band/rate/projectedRate placeholders) — the UI-SPEC mentioned {projectedBand} but the shipped banner never asserts a projected band (D-12), so no {projectedBand} key was added."
  - "Bundled the concurrent demo-readonly workstream's existing demoReadOnly / Layout.demo.* JSON key additions into this i18n commit per explicit user decision (shared dirty tree); staged ONLY the 4 message JSONs — the ~22 foreign non-i18n demo files were never touched or swept."

patterns-established:
  - "Gulf i18n: translatable copy in JSON (4 real locales), statutory identifiers resolved from LOCKED_*_PHRASES code constants and banned from JSON by the locked-phrases guard"

requirements-completed: [GULF-08, GULF-09]

# Metrics
duration: 10min
completed: 2026-06-03
---

# Phase 79 Plan 08: Gulf 4-Locale i18n (Arabic + RTL) Summary

**Populated every Gulf user-facing key (Contractors.freeZone.* + Saudization.*) across en/de/pl/ar with REAL German, Polish, and genuine Arabic values (D-16), sourced Saudization.bands.* from LOCKED_SA_PHRASES (D-14), and turned C10 GREEN at the translation layer — i18n:parity, the Phase-79 AE/SA locked-phrases guard, and the RTL logical-property guard all pass across the Gulf surface.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-03T10:36:12Z
- **Completed:** 2026-06-03T10:46:32Z
- **Tasks:** 2 automated (`type="auto"`) complete + Task 3 `checkpoint:human-verify` deferred to the verifier (post-completion gate, not a mid-plan blocker)
- **Files modified:** 4 (the message catalogs) + this SUMMARY

## Accomplishments

- **Task 1 (`b1feda91`)** — Added the full Gulf key set with real values in all 4 locales:
  - `Contractors.freeZone.*`: `form` (18 keys incl. `isicRemoveLabel` `{code}`), `zones` (11 zone codes), `empty`, `error`, `toast`, `scopeMismatch`.
  - `Saudization.*`: root `title/subtitle`, `rate`, `band` (`lastUpdated` `{date}`), `override.badge`, `manualNature`, `quarterly` (`{date}` + `bodyNoDate`), `headcount`, `qiwa` (`gapCount` ICU plural `{count}`), `iqama`, `actions`, `bands` (6 locked labels), `config`, `override` (dialog), `empty`, `error`, `toast`, `offboardingTrajectory` (`projection` `{band}/{rate}/{projectedRate}`).
  - de + pl are genuine translations; ar is genuine Arabic (RTL), no Latin leakage, no U+200E/200F bidi marks.
- **Task 2** — Ran the C10 Gulf-surface integrity sweep and asserted GREEN: RTL logical-props (14 files, 0 offenders), i18n:parity, Phase-79 AE/SA locked-phrases (13/13), physical-direction grep sum 0. No file changes (assertion-only task).

## Task Commits

1. **Task 1: populate Gulf i18n keys in en/de/pl/ar (GULF-08/09, D-16)** — `b1feda91` (feat)
2. **Task 2: C10 Gulf-surface RTL + locked-phrase + parity sweep** — assertion-only, no commit (results recorded here).

**Plan metadata:** committed alongside this SUMMARY (docs: complete plan).

## Files Created/Modified

- `apps/web-vite/messages/en.json` — EN source values for `Contractors.freeZone.*` + `Saudization.*` (UI-SPEC Copywriting Contract).
- `apps/web-vite/messages/de.json` — genuine German Gulf translations (formal Sie register preserved).
- `apps/web-vite/messages/pl.json` — genuine Polish Gulf translations (ICU plural with few/many forms).
- `apps/web-vite/messages/ar.json` — genuine Arabic (RTL) Gulf translations + Arabic zone names + Arabic CLDR plural set.

## Verification (run honestly — results below)

| Gate | Result | Notes |
|------|--------|-------|
| `pnpm i18n:parity` | **GREEN** | en keys covered in de/pl/ar (494 pre-existing baseline sites tolerated; my Gulf keys add zero new drift). |
| Phase-79 AE/SA locked-phrases (`vitest -t "Phase 79"`) | **GREEN** | 13/13 pass — no RESERVED_AE/SA legal key leaked into any messages/*.json; band labels are the literal locked strings. |
| `pnpm check:rtl-logical-props` | **GREEN** | 14 Gulf surface files scanned, 0 physical-direction utilities (JSON edits don't affect this guard; Plans 06/07 surfaces stay clean). |
| physical-direction grep (`ml/mr/pl/pr-`) on Gulf dirs | **0** | acceptance criterion met (sum 0). |
| Arabic bidi marks (translation-quality audit) | **0** | `Explicit RTL/LTR marks (U+200E/U+200F) in value: 0` — confirms no stray bidi marks in the new Arabic strings. |
| `grep -c "Gulf\|freeZone\|saudization\|nitaqat\|Saudization\|Nitaqat"` de/pl/ar | de=19, pl=19, ar=6 | ≥ 3 in all non-en locales (ar lower because Arabic VALUES don't contain the Latin tokens — the KEY paths do; Contractors.freeZone + Saudization namespaces resolve in all 4 via node check). |
| de.json Gulf values NOT byte-identical to en | **confirmed** | spot-check: `Saudization.title` (Saudisierung≠Saudization), `manualNature.body`, `scopeMismatch.body`, `config.bandHelp` all differ; only proper-noun zone names match (intentional). |

### Full locked-phrases-guard run note (honest)

`pnpm --filter @contractor-ops/validators test -- locked-phrases-guard` reports **1 failed | 894 passed**. The single failure is **pre-existing and out of scope (D-17)**:
`Phase 64 — Signoff registry CI guard › getAllPending() ... expect(pending).toHaveLength(29)` — actual is **48**. It reads `signoff-registry.json` (which this plan never touches) and fails identically on clean HEAD (`signoff-registry.json` is committed/unchanged, already 48 PENDING from Phase 75/79 growth vs the test's hardcoded 29). Already documented in `deferred-items.md` (lines 6-19). **All Phase-79 AE/SA locked-phrase assertions — the ones this plan owns — pass.**

## Decisions Made

See frontmatter `key-decisions`. Headline: band labels are LOCKED literals from `LOCKED_SA_PHRASES` (identical across locales, D-14); zone proper nouns kept verbatim in de/pl and localized in ar; offboarding projection follows the real call site (no `{projectedBand}`); demo-readonly i18n keys bundled per user decision.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Duplicate `override` key inside `Saudization` (caught by pre-commit biome)**
- **Found during:** Task 1 (first commit attempt)
- **Issue:** I declared `Saudization.override` twice — a small `{ "badge": ... }` block (for the dashboard hero `t('override.badge')`) AND the full override-dialog block `{ "title", "description", "badge", ... }`. JSON duplicate key — biome `--write` flagged it in all 4 files and the pre-commit hook blocked the commit.
- **Fix:** Removed the standalone badge-only `override` block in en/de/pl/ar; the full `Saudization.override` block already contains `badge` with the same value, so the dashboard hero `t('override.badge')` and the dialog `t('badge')` both resolve correctly to `Saudization.override.badge`. Re-verified parse + parity GREEN, then committed.
- **Files modified:** all 4 message JSONs
- **Verification:** all 4 parse; `Saudization.override.badge` present; i18n:parity GREEN; pre-commit hook passed on re-commit.
- **Committed in:** `b1feda91` (the fix is part of the single Task 1 commit — the broken intermediate state was never committed).

---

**Total deviations:** 1 auto-fixed (Rule 1 bug, caught by the repo's own pre-commit gate before any bad commit landed).
**Impact on plan:** No scope creep. The fix was required for valid JSON and correct key resolution.

## Issues Encountered

- **Pre-existing foreign gate failures (NOT caused by 79-08, D-17 scope boundary), all already in `deferred-items.md`:**
  - `getAllPending()` count test (48 vs hardcoded 29) — reads the untouched signoff-registry.json; fails on clean HEAD.
  - `db:audit-enum-casing` — `idp-deprovisioning.prisma` `ManualOverrideCategory` lower_snake values (Phase 76-78 IdP work); the Phase-79 `NitaqatBand`/`UaeFreeZoneCode` enums are UPPER_SNAKE and do NOT appear in the offender list.
  - `audit-translations-quality` — 739 pre-existing English-leakage / ICU / empty-value warnings across all locales (landing/marketing copy in a different app). It is a non-gating advisory audit (RESEARCH §Pitfall 21: not a placeholder-equality gate). Of the Gulf keys, ONLY the `Contractors.freeZone.zones.*` proper-noun names are flagged (de/pl only, intentional). Crucially it reports **0** RTL/LTR bidi marks in the new Arabic.
- **Shared dirty tree (demo-readonly workstream):** ~22 uncommitted foreign files (packages/api, middleware, .env.example, validators/src/env.ts, layout, etc.) were present throughout. Per explicit user decision, the demo workstream's `demoReadOnly` / `Layout.demo.*` JSON key additions are bundled into this i18n commit (the message files carry them); only the 4 message JSONs were staged — every foreign non-i18n file remained untouched and still dirty after the commit (verified: 704 insertions, 0 deletions, scope = exactly the 4 JSONs).

## Known Stubs

None. Every Gulf key referenced by the Plan 06/07 components is now defined with a real value in all 4 locales — no `MISSING_MESSAGE` path remains. Statutory identifiers (free-zone authority legal names, Nitaqat band labels, Qiwa status terms) intentionally resolve from `LOCKED_AE/SA_PHRASES` code constants, not these JSON files (D-14) — that is by design, not a stub.

## Manual-Only Verifications (PENDING — for the Phase 79 verifier / Phase 80 UAT)

Automated gates cannot cover these — they are HUMAN-UAT items, NOT build blockers (do not hard-block; LOCAL-ONLY Standing Constraint):

1. **Arabic RTL visual rendering (GULF-08).** Run the app, switch locale to `ar`, visit each Gulf surface (free-zone form, scope-mismatch banner, Saudization dashboard, config dialog, override dialog, offboarding trajectory banner) and confirm: layout mirrors (start-aligned labels, RTL control flow), the band donut/rate chart reverses via `useRtlChartConfig`, no broken bidi around the ICU placeholders, no Latin-LTR leakage, no MISSING_MESSAGE. (Automated checks confirm 0 bidi marks and 0 physical-direction utilities, but visual mirroring is human-judged.)
2. **de/pl translation genuineness (D-16, GULF-09).** `i18n:parity` checks key existence only (Pitfall 21). Spot-check the dashboard manual-nature callout, the scope-mismatch advisory, the override badge, and the offboarding advisory read as genuine German/Polish. (Automated heuristic confirms only the proper-noun zone names are en-identical; everything else is distinct.)
3. **Arabic statutory legal sign-off (T-79-08-LEGAL, accept).** Free-zone authority legal names, Nitaqat band labels, and Qiwa status terms in `LOCKED_AE/SA_PHRASES` are PENDING legal review — recorded as a post-deploy item for the Phase 80 consolidated Arabic/UAE/KSA legal sign-off. Not a build gate.

## Threat Flags

None. No new security surface introduced — only translatable JSON copy was added. T-79-08-01 (statutory label drift) is mitigated: no RESERVED_AE/SA legal key leaked into any messages/*.json (guard GREEN); band labels come from `LOCKED_SA_PHRASES`. T-79-08-02 (en-placeholder de/pl) is mitigated by genuine de/pl values (heuristic confirms distinctness) + the pending human-verify. T-79-08-03 (Arabic RTL break) is mitigated by the RTL guard (GREEN) + 0 bidi marks + the pending human RTL verify. T-79-08-SC: no package installs.

## Next Phase Readiness

- GULF-08/09 complete at the translation layer; C10 GREEN across the Gulf surface (RTL + locked-phrase + 4-locale parity).
- Phase 80 inherits the two HUMAN-UAT items above (Arabic RTL render, de/pl genuineness) and the Arabic statutory legal sign-off (post-deploy).
- No blockers introduced; the pre-existing foreign gate failures stay tracked in `deferred-items.md` for the standards-audit / F2-IdP tracks.

## Self-Check: PASSED

- All 4 message catalogs (en/de/pl/ar) exist and parse; Gulf keys present in each.
- SUMMARY.md exists at the real (non-symlink) phase path.
- Task 1 commit `b1feda91` exists in git history.

---
*Phase: 79-f3-gulf-uae-free-zone-tracking-saudization-dashboard-arabic-*
*Completed: 2026-06-03*
