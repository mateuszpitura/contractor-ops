---
phase: 69-de-i18n-parity-fix
plan: 01
subsystem: i18n
tags: [i18n, de-locale, next-intl, lpcda, translations, parity, message-keys]

# Dependency graph
requires:
  - phase: 56-country-foundations-german-i18n
    provides: DE locale infrastructure (next-intl wiring, formal-Sie register invariant, R-06 parity test, R-14 informal-register guard, locked-phrases-guard 78/78)
  - phase: 63-uk-payments-financial-features
    provides: 25 EN-only Payments.lateInterest.* keys (LPCDA dialog, claim PDF, waiver flow) + Payments.skonto.previewLineEn key
  - phase: 64-legal-compliance-hardening
    provides: 6 EN-only Admin.ClassificationEngineFlag.* keys (super-admin classification-engine kill-switch panel)
  - phase: 67-phase-56-58-verification
    provides: GAP-67-01-01 — the verification finding that surfaced the 32-key DE-locale parity drift
provides:
  - 32 new German translations in apps/web/messages/de.json (25 lateInterest + 1 previewLineEn + 6 ClassificationEngineFlag)
  - Full EN ⊂ DE message-key parity (3639+ leaf keys; R-06 missing-key array empty)
  - FOUND-03 traceability flip from Pending → Complete in REQUIREMENTS.md (both checkbox and Traceability table)
  - Atomic single-commit delivery matching Phase 67 verified-and-flipped pattern
affects: [future i18n hardening phases, post-deploy Steuerberater + Plain ops review queue, v5.0 milestone audit closure]

# Tech tracking
tech-stack:
  added: []
  patterns: [LPCDA-aware German legal copy convention — German with parenthetical English on first occurrence per UI surface (D-01); GBP placeholder (£{amount}) preserved verbatim for UK-statute-bound copy (D-05); ICU placeholder names locked across locales (D-06); runtime UI string aligned byte-identically with CI-locked compile-time legal phrase (D-07)]

key-files:
  created: []
  modified:
    - apps/web/messages/de.json
    - .planning/REQUIREMENTS.md

key-decisions:
  - "D-03: Authoritative term mapping for LPCDA late-interest copy used verbatim — 'Statutory late-payment interest' → 'Gesetzliche Verzugszinsen (LPCDA)', 'Bank of England base rate' → 'Bank of England Leitzins', 'fixed compensation' → 'pauschale Entschädigung', etc."
  - "D-04: Formal-Sie register throughout (no Du/Dir/Dein); CTAs use imperative-formal or infinitive forms (Erlassen / Widerrufen / Zinsen erlassen). R-14 grep returns 0 at HEAD."
  - "D-05: £{amount} kept verbatim — LPCDA is intrinsically GBP-denominated; semantic precision over locale-uniform currency formatting."
  - "D-06: ICU placeholder names ({date}, {percent}, {discountDays}, {netDays}, {amount}, {name}, {revokeLink}, {count}) preserved verbatim from EN; call sites depend on exact names."
  - "D-07: Payments.skonto.previewLineEn aligned byte-identically with XRECHNUNG_SKONTO_DESCRIPTION_TEMPLATE at packages/validators/src/legal/de.ts:91-93. Both sources must remain aligned; if the locked-phrase template ever changes, this key needs to be re-aligned."
  - "D-08: Admin.ClassificationEngineFlag.* uses internal/operational German register; backticked code identifiers (module.classification-engine, packages/validators/src/legal/signoff-registry.json) preserved verbatim — they're file paths, not natural-language terms."
  - "D-11: Atomic commit pattern — 32-key insertion + FOUND-03 flip ship as one commit fix(69-01): ... matching Phase 67 verified-and-flipped convention."

patterns-established:
  - "LPCDA-aware translation pattern: full English statute name on first occurrence per UI surface with (LPCDA) parenthetical, then 'LPCDA' or 'der Act' thereafter. Mirrors how German legal writing conventionally handles foreign statutes."
  - "Forward-only single-commit traceability flip: requirement-row Pending→Complete + traceability-table Pending→Complete + implementing file changes ship as one atomic commit (Phase 67 pattern reused)."
  - "Disjoint-vocabulary defense: LPCDA UK statute terms vs locked DE-tax-locked phrases (Scheinselbständigkeit / DRV / SGB) occupy disjoint vocabulary domains — locked-phrases-guard 78/78 stays green by design without explicit deconfliction."

requirements-completed:
  - FOUND-03

# Metrics
duration: 8min
completed: 2026-04-26
---

# Phase 69: DE Message-Key Parity Fix Summary

**32 missing German translations authored in apps/web/messages/de.json, closing the GAP-67-01-01 parity drift introduced by Phases 63 + 64 and flipping FOUND-03 to Complete in a single atomic commit.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-26
- **Completed:** 2026-04-26
- **Tasks:** 2/2
- **Files modified:** 2 (apps/web/messages/de.json + .planning/REQUIREMENTS.md)

## Accomplishments

- Authored 25 Payments.lateInterest.* keys with LPCDA-aware formal-Sie translations following the D-03 authoritative term mapping (covers section heading, explanation tooltip, B2C banner, breakdown labels, claim CTA + dialog, claim PDF download, claimed-banner snapshot, waive CTA + dialog, waive types + reason, waived-banner, revoke waiver CTA + reason).
- Authored 1 Payments.skonto.previewLineEn key aligned byte-identically with the locked XRECHNUNG_SKONTO_DESCRIPTION_TEMPLATE at packages/validators/src/legal/de.ts:91-93 per D-07.
- Authored 6 Admin.ClassificationEngineFlag.* keys for the super-admin classification-engine flag-status panel (Phase 64) using internal/operational German register per D-08, with backticked code identifiers preserved verbatim.
- OVERWROTE the existing untranslated EN literal "Statutory late-payment interest" at lateInterest.sectionHeading with the formal-Sie translation "Gesetzliche Verzugszinsen (LPCDA)" per D-03 (1 of the 32 was an overwrite, not a new insertion — the rest were new).
- Preserved the 3 DE-only stubs (overdueInterestColumn, overdueFilterChip, emptyOverdue) at the end of the lateInterest block — strict-scope rule "no refactoring of existing DE entries" applied; deleting them risked runtime MISSING_MESSAGE errors at unaudited call sites.
- Flipped REQUIREMENTS.md FOUND-03 status from Pending to Complete in BOTH the requirement-row checkbox (line 14) AND the Traceability table (line 104).
- All four pre-commit verification gates green: JSON.parse OK, R-06 5/5, R-14 = 0, locked-phrases-guard 78/78.

## Task Commits

The atomic-commit pattern means BOTH tasks land as a single commit:

1. **Task 1 + Task 2 (combined): Author 32 DE translations + flip FOUND-03 to Complete** — `ee0dc8aa` (fix)

## Files Created/Modified

- `apps/web/messages/de.json` — 32 new German translations across 3 namespaces; 1 overwrite (sectionHeading) + 31 net-new keys; 36 lines added, 1 line removed.
- `.planning/REQUIREMENTS.md` — FOUND-03 row checkbox `[ ]` → `[x]` (line 14); FOUND-03 Traceability table status `Pending` → `Complete` (line 104); 2 line edits.

## Verification Results

| Gate | Command | Result |
|------|---------|--------|
| JSON validity | `node -e "JSON.parse(...de.json)"` | PASS — JSON_VALID=true |
| R-06 de-locale parity | `pnpm --filter @contractor-ops/web exec vitest run de-locale` | PASS — 5/5 tests, missing-key array empty |
| Full EN⊂DE parity (defense-in-depth) | inline node script counting missing leaf keys | PASS — MISSING_COUNT=0 |
| R-14 informal-register | `grep -cE '\b(Du\|Dir\|Dein[a-z]*)\b' apps/web/messages/de.json` | PASS — 0 |
| Locked-phrases guard | `pnpm --filter @contractor-ops/validators exec vitest run locked-phrases-guard` | PASS — 78/78 |
| Atomic commit subject | `git log -1 --pretty=format:'%s'` | PASS — `fix(69-01): add 32 missing DE translations + flip FOUND-03 to Complete` |
| Atomic commit scope | `git log -1 --stat` | PASS — exactly 2 files (de.json + REQUIREMENTS.md), no other files |
| FOUND-03 flip recorded | `grep -E '^\| FOUND-03 \|.*\| Complete \|' .planning/REQUIREMENTS.md` | PASS — 1 match |

## Manual-Only Verifications (Post-Deploy — D-10)

Per CONTEXT.md D-10 + Standing Project Constraints (STATE.md: app is LOCAL-ONLY, legal/regulatory verification is DEFERRED), the following expert reviews are recorded as **post-deploy** items. They do NOT block this phase and do NOT create a STATE.md blocker. Reworks (if any) are handled in a follow-on phase before any production rollout.

- [ ] **Steuerberater review of LPCDA late-interest copy** (25 Payments.lateInterest.* keys) — verify the LPCDA-vs-BGB framing per D-02 (LPCDA is a UK statute distinct from German §§ 286, 288 BGB Verzugszinsen; translation must NOT mislead a DE user into thinking BGB rules apply). Joins the existing Phase 56 Steuerberater queue.
- [ ] **Plain operations review of LPCDA late-interest copy** (customer-facing tone, formal-Sie compliance, readability of long DE legal sentences per D-04). Joins the existing Phase 56 Plain operations queue.
- [ ] **Realignment trigger**: if `XRECHNUNG_SKONTO_DESCRIPTION_TEMPLATE` at packages/validators/src/legal/de.ts:91-93 ever changes (Phase 63 D-22 locked phrase), re-align `Payments.skonto.previewLineEn` in apps/web/messages/de.json to remain byte-identical (D-07 invariant).

## Self-Check: PASSED

- All 32 EN-only keys identified by GAP-67-01-01 are present in apps/web/messages/de.json
- R-06 de-locale parity test exits 0 with missing-key array empty
- R-14 informal-register grep returns 0 (formal-Sie invariant intact)
- Locked-phrases guard remains 78/78 (no drift)
- Every ICU placeholder name preserved verbatim from EN
- REQUIREMENTS.md FOUND-03 status flipped Pending → Complete in both spots
- JSON.parse(de.json) does not throw
- 32-key insertion + FOUND-03 flip shipped as single atomic commit `fix(69-01): ...`
- Strict scope respected: only 2 files touched (de.json + REQUIREMENTS.md), no UI/TSX/EN/PL/AR changes
