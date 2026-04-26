# Phase 69: DE Message-Key Parity Fix - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-26
**Phase:** 69-de-i18n-parity-fix
**Areas discussed:** LPCDA legal terminology approach, currency symbol placeholder handling

---

## LPCDA legal terminology approach

### Q1 — How to translate UK statute terms in the 25 Payments.lateInterest.* keys

| Option | Description | Selected |
|--------|-------------|----------|
| German with parenthetical English on first occurrence | Primary in formal-Sie German; canonical English in parens on first mention per UI surface. Matches DE legal-writing convention for foreign statutes. | ✓ |
| Verbatim English wrapped in DE sentence framing | Keep proper-noun statute names + key terms in English; minimal German framing. Maximum legal precision; risk of feeling untranslated. | |
| Fully German equivalents (Verzugszinsen / Leitzins / pauschale Entschädigung) | Translate every term to closest DE legal equivalent. Risk: BGB Verzugszinsen is a different statutory framework — could mislead. | |

**User's choice:** German with parenthetical English on first occurrence.
**Notes:** Drove D-01 (translation pattern), D-02 (no BGB conflation), D-03 (concrete term mapping for the 25 lateInterest keys), D-04 (formal-Sie register).

### Q2 — Currency symbol handling in `claimedBanner` and similar `£{amount}` keys

| Option | Description | Selected |
|--------|-------------|----------|
| Keep `£{amount}` verbatim | Matches LPCDA's GBP-only context. Single placeholder, zero call-site changes. | ✓ |
| Reformat to `{amount} GBP` | DE convention puts ISO code after amount. Drifts from EN structure. | |

**User's choice:** Keep `£{amount}` verbatim.
**Notes:** Drove D-05 (currency placeholder kept verbatim) and reinforced D-06 (all ICU placeholder names locked).

---

## Areas not selected

The user opted to discuss only "LPCDA legal terminology approach" from the four offered areas. The other three areas were either resolved by Standing Project Constraints + prior phase patterns or are explicitly out of scope:

| Area | Disposition |
|------|-------------|
| Currency symbol placeholder handling | Folded into the LPCDA discussion (Q2 above) since the only `£{amount}` usage is inside the LPCDA late-interest namespace. |
| Re-validation + CI parity gate | Locked-on for re-validation per D-09 (single test run, no CI hardening). CI parity gate parked in Deferred Ideas. |
| Steuerberater + Plain ops review flow | Locked-on per Standing Project Constraints — D-10 records the LPCDA copy as a post-deploy review item in 69-SUMMARY, no pre-merge blocker. Pattern matches Phase 56 D-08/D-09. |

---

## Claude's Discretion

- Exact JSON insertion ordering inside the lateInterest object.
- Compound-noun vs hyphenation choices in long DE copy.
- Sentence-splitting in long lateInterest dialog body copy.
- Anchor punctuation around the `{revokeLink}` placeholder.

## Deferred Ideas

- CI parity gate across en/de/pl/ar locales.
- Steuerberater pre-merge sign-off (deferred per Standing Project Constraints).
- PL / AR parity audit (not currently broken).
- Renaming `previewLineEn` to `previewLine`.
- Deduplicating `Payments.skonto.previewLineEn` against `XRECHNUNG_SKONTO_DESCRIPTION_TEMPLATE`.
- Adding `LOCKED_LPCDA_PHRASES` to the validators legal module.
