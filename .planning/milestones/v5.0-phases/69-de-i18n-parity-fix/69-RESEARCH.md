# Phase 69: DE Message-Key Parity Fix - Research

**Researched:** 2026-04-26
**Mode:** CONTEXT.md re-validation against current code (CONTEXT-driven phase — all 11 implementation decisions and the authoritative D-03 term mapping table already locked in 69-CONTEXT.md)

<summary>
## What I learned

Phase 69 is a translation-only fix. Every plan-level decision is already nailed down in `69-CONTEXT.md` D-01..D-11:

- **What to translate:** the exact 32 EN-only keys identified by GAP-67-01-01 (25 `Payments.lateInterest.*` + 1 `Payments.skonto.previewLineEn` + 6 `Admin.ClassificationEngineFlag.*`).
- **How to translate them:** D-01 (German with parenthetical English on first occurrence per UI surface), D-02 (no BGB conflation — always qualify "nach LPCDA"), D-03 (verbatim term mapping), D-04 (formal-Sie register, R-14 must continue at 0), D-05 (`£{amount}` kept verbatim), D-06 (every ICU placeholder name preserved verbatim from EN), D-07 (`previewLineEn` aligned with the locked `XRECHNUNG_SKONTO_DESCRIPTION_TEMPLATE` constant), D-08 (Admin.ClassificationEngineFlag mapping with backtick-code-identifiers verbatim).
- **What to verify:** D-09 — three commands: R-06 (`pnpm --filter @contractor-ops/web exec vitest run de-locale`), R-14 informal-register check, locked-phrases-guard (78/78 still passes).
- **What to flip:** D-11 — REQUIREMENTS.md FOUND-03 status from `Pending` to `Complete` and the Traceability table line.
- **What is deferred:** D-10 — LPCDA copy gets a post-deploy Steuerberater + Plain operations review checkpoint recorded in `69-SUMMARY.md` under "Manual-Only Verifications". Standing Project Constraints (LOCAL-ONLY, legal sign-off DEFERRED) explicitly disallow making this a pre-merge blocker.

I re-validated every code-anchor claim in CONTEXT.md against the current `v2` branch (HEAD `b5610b3e`):

</summary>

<revalidation>
## CONTEXT.md Re-validation (executed 2026-04-26)

### File / line / signature audit

| CONTEXT claim | Actual code | Status |
|---|---|---|
| `apps/web/messages/en.json` line 2852 starts the `Payments.lateInterest` block with 25 leaf keys | `en.json:2852-2879` — exact 25 leaf keys (`sectionHeading`, `explanationTooltip`, `b2cBanner`, `principalOutstanding`, `daysOverdue`, `rateUsed`, `dailyAccrual`, `interestAccrued`, `fixedCompensation`, `totalStatutoryClaim`, `claimCta`, `claimSecondaryOption`, `claimDialogTitle`, `claimDialogBody`, `downloadClaimPdf`, `claimedBanner`, `waiveCta`, `waiveDialogTitle`, `waiveReasonPlaceholder`, `waiveTypeInterestOnly`, `waiveTypeCompensationOnly`, `waiveTypeBoth`, `waiveConfirm`, `waivedBanner`, `revokeWaiverCta`, `revokeReasonPlaceholder`) | **MATCH** — 25 keys confirmed |
| `apps/web/messages/de.json` `Payments.lateInterest` exists but lacks the 25 EN keys | `de.json:2994-2999` — only 4 placeholder-style keys (`sectionHeading` matches EN; `overdueInterestColumn`, `overdueFilterChip`, `emptyOverdue` are DE-only stubs that DON'T appear in EN at this path — they're scoped to a different surface) | **PARTIAL MATCH** — `sectionHeading` already exists in DE with the EN value `"Statutory late-payment interest"` (no German translation). Plan must overwrite this one to formal-Sie German AND add the other 24 missing keys. The 3 DE-only stubs (`overdueInterestColumn`, `overdueFilterChip`, `emptyOverdue`) stay untouched — they're not in EN, so removing them would create the inverse-direction parity drift (DE keys missing from EN), and the parity test only asserts `enKeys ⊂ deKeys` (line 67-71 of `de-locale.test.ts`), so they're harmless. |
| `apps/web/messages/en.json` line 2897 has `Payments.skonto.previewLineEn` | `en.json:2897` — `"previewLineEn": "{percent}% discount if paid within {discountDays} days, otherwise net {netDays} days"` | **MATCH** |
| `apps/web/messages/de.json` `Payments.skonto.*` is missing `previewLineEn` | `de.json:3010-3035` — 25 leaf keys present, no `previewLineEn` | **MATCH** — single missing key in this namespace |
| `apps/web/messages/en.json` line 5440 has `Admin.ClassificationEngineFlag.*` 6 keys | `en.json:5440-5447` — exact 6 leaf keys (`title`, `subtitle`, `appSideValue`, `signoffRegistry`, `pendingGate`, `pendingGateResolution`) | **MATCH** — 6 keys confirmed |
| `apps/web/messages/de.json` `Admin.ClassificationEngineFlag` is missing entirely | `de.json:5540-5559` — `Admin` namespace exists with `BoeRate.*` only, no `ClassificationEngineFlag` block | **MATCH** — entire 6-key block must be added |
| `XRECHNUNG_SKONTO_DESCRIPTION_TEMPLATE` locked phrase | `packages/validators/src/legal/de.ts:91-93` — `'{percent}% Skonto bei Zahlung innerhalb von {discountDays} Tagen, sonst netto {netDays} Tage'` | **MATCH** — D-07 alignment is the literal string above |
| R-06 parity test asserts `enKeys ⊂ deKeys` | `apps/web/src/i18n/__tests__/de-locale.test.ts:55-72` — `flattenKeys(en)` then `for (const key of enKeys) if (!deKeys.has(key)) missing.push(key); expect(missing).toEqual([])` | **MATCH** — closes when all 32 keys land |
| R-14 informal-register check pattern | CONTEXT.md D-04 specifies `grep -cE '\b(Du\|Dir\|Dein[a-z]*)\b' apps/web/messages/de.json` returns 0 | **MATCH** — current value is 0; must remain 0 after the 32-key insertion |
| `de.json` total leaf-key count baseline | `wc -l de.json` = 5560; `wc -l en.json` = 5449 (DE has 111 more lines because the 4 placeholder `lateInterest` keys + DE-specific stubs throughout add lines but not parity-relevant content) | **MATCH** — DE was at 3639 leaf-key parity per Phase 56 D-04+; 32-key gap from Phase 63+64 brings DE behind EN; this phase restores parity |

### Discrepancies

| CONTEXT.md says | Reality | Impact |
|---|---|---|
| The 25 `Payments.lateInterest.*` keys are all "missing" from de.json | DE has 1 of the 25 keys (`sectionHeading`) but with an UNTRANSLATED English value `"Statutory late-payment interest"` | Plan 01 must **overwrite** the existing `sectionHeading` to `"Gesetzliche Verzugszinsen (LPCDA)"` per D-03, AND add the other 24 keys. The R-06 parity test treats `sectionHeading` as already-present (it's a leaf key on both sides), so technically only 24 keys are "new" — but the existing value violates the formal-Sie translated-DE invariant Phase 56 established. Net effect: 24 added + 1 overwritten = 25 D-03 entries. |
| DE `lateInterest` has 4 stub keys (`overdueInterestColumn`, `overdueFilterChip`, `emptyOverdue`, `sectionHeading`) | These 4 stubs exist (per `de.json:2994-2999`); 3 are DE-only (no EN equivalent), 1 is `sectionHeading` (covered above) | The 3 DE-only stubs are NOT touched. They're harmless to R-06 (parity test direction is `enKeys ⊂ deKeys`, not bidirectional). They're presumably wired to UI surfaces that haven't been audited; deleting them risks runtime `MISSING_MESSAGE` errors. Strict-scope rule "no refactoring of existing DE entries" (CONTEXT D-domain) applies. |
| The `Payments.skonto` namespace has the existing `previewLine` key already | DE has 25 skonto leaf keys, none called `previewLine` or `previewLineEn`. The closest is `eligibleBanner` and the various `*Banner` variants. The Skonto preview line that needs translating is genuinely missing. | No action change — D-07 inserts the new `previewLineEn` key into the existing `skonto` block. The locked template `'{percent}% Skonto bei Zahlung innerhalb von {discountDays} Tagen, sonst netto {netDays} Tage'` matches CONTEXT D-07 verbatim. |

### Tests-as-validation note

Phase 69 has a clear automated validation contract: R-06 (de-locale parity test), R-14 (informal-register grep), and the locked-phrases-guard (78/78 must continue green) — all three are **existing** infrastructure from Phase 56. No new test files are created. The VALIDATION.md sampling map maps each task to one of these three commands.

</revalidation>

<implementation_notes>
## Implementation notes

### File-level surgery summary

```
apps/web/messages/de.json     ←  ONLY file modified (CONTEXT.md "Strict scope")
                                 + 24 NEW keys in Payments.lateInterest.*
                                 + 1  OVERWRITE   Payments.lateInterest.sectionHeading
                                 + 1  NEW key  in Payments.skonto.previewLineEn
                                 + 1  NEW BLOCK Admin.ClassificationEngineFlag.{6 keys}
                                 = 32 leaf-key changes total

.planning/REQUIREMENTS.md      ←  D-11 traceability flip
                                 FOUND-03 row: "Pending" → "Complete"
                                 Traceability table: same flip
```

### Insertion-order convention (Claude's Discretion per CONTEXT.md)

For `Payments.lateInterest.*` — match the **EN key ordering** from `en.json:2853-2878` so diff-readability is preserved. The DE-only stubs (`overdueInterestColumn`, `overdueFilterChip`, `emptyOverdue`) move to the END of the namespace block (after the 25 EN-aligned keys) so the overlap with EN's order remains visually obvious.

For `Admin.ClassificationEngineFlag.*` — match the **EN key ordering** from `en.json:5441-5446` (`title`, `subtitle`, `appSideValue`, `signoffRegistry`, `pendingGate`, `pendingGateResolution`). Insert as a sibling of the existing `Admin.BoeRate.*` block.

For `Payments.skonto.previewLineEn` — insert at the same position relative to its namespace siblings as in EN (between `netPeriodLabel` and `saveTerm`, per `en.json:2896-2898`).

### JSON validity invariants

- Every new key must be a string-typed leaf (no nested objects).
- Trailing commas after the **last** key in any block are forbidden by `JSON.parse` (which the test runs at line 57-58 of `de-locale.test.ts`); insertions must respect comma placement.
- File must end with a single trailing newline (POSIX convention; matches existing en.json/de.json convention).

### R-14 verb-form gotchas to avoid

When translating the LPCDA copy, formal-Sie verb forms only:

- ✓ "Zinsen erlassen" (infinitive)
- ✓ "Erlassen" (imperative-formal)
- ✗ "Du erlässt" / "Erlasse" (informal — would trip R-14)
- ✓ "Geben Sie eine Begründung an" (formal-Sie imperative)
- ✗ "Gib eine Begründung an" (informal)

The tricky placeholder is `waiveReasonPlaceholder`: must NOT contain "Dein", "Deine", "Du", "Dir". Translation per D-04: `"Begründung (erforderlich, mind. 10 Zeichen) — z. B. mit Kunden ausgehandelter Vergleich, Kulanz, Verwaltungsfehler"` — uses no second-person pronouns at all, register stays neutral-formal.

### Post-deploy review checkpoint (D-10)

Per Standing Project Constraints (STATE.md "Standing Project Constraints"), legal/regulatory verification is DEFERRED for the LOCAL-ONLY deploy posture. The 25 LPCDA late-interest translations ship with the D-01..D-04 working copy, and the post-deploy review by Steuerberater + Plain operations is recorded in 69-SUMMARY.md "Manual-Only Verifications". This does NOT create a STATE.md blocker and does NOT prevent FOUND-03 from flipping to `Complete` (per D-11). Pattern matches Phase 56 D-08/D-09's deferred-legal-review handling.

</implementation_notes>

## Validation Architecture

> Required marker for the plan-phase Step 5.5 detector. Phase 69 reuses three existing test infrastructures (no Wave 0 install).

### Three layers of feedback

| Layer | Command | What it proves | When it runs |
|---|---|---|---|
| **R-06 — DE parity** | `pnpm --filter @contractor-ops/web exec vitest run de-locale` | Every key in `en.json` appears in `de.json` (the gap closes to zero) | After the JSON edit, before commit |
| **R-14 — Formal-Sie register** | `grep -cE '\b(Du\|Dir\|Dein[a-z]*)\b' apps/web/messages/de.json` (must return `0`) | The 32 new translations don't accidentally introduce informal-register German | After the JSON edit, before commit |
| **Locked-phrases guard** | `pnpm --filter @contractor-ops/validators exec vitest run locked-phrases-guard` (must report 78/78 passing) | The new translations don't drift any of the 78 CI-locked DE legal phrases (defense-in-depth — none of the 32 keys overlap with the locked-phrase module, but the guard catches accidental copy/paste of locked text into runtime messages) | After the JSON edit, before commit |

### Sampling rate

- One verification batch — all three commands run in sequence after Task 1 (the JSON edit) and before the atomic commit in Task 2.
- If any of the three fails, the commit does NOT happen; the JSON edit is reverted via `git checkout -- apps/web/messages/de.json` and the plan re-enters Task 1 with the failing key surfaced.

### What is NOT validated automatically

- LPCDA legal correctness — Steuerberater + Plain operations review (post-deploy item per D-10, recorded in 69-SUMMARY.md "Manual-Only Verifications").
- DE-locale UI rendering of the dialogs — the call sites already exist (Phase 63 LateInterestSection / WaiveDialog / ClaimDialog; Phase 63 SkontoPreviewBanner; Phase 64 ClassificationEngineFlagPanel). UI rendering correctness was validated in those phases; this phase only adds copy that next-intl resolves at runtime, identical lifecycle to the EN copy.

---

## Coverage of CONTEXT.md decisions

| Decision | Where addressed |
|---|---|
| D-01 — German with parenthetical English on first occurrence | Term mapping baked into Plan 01 task action verbatim from D-03 |
| D-02 — No BGB conflation | Plan 01 uses `Gesetzliche Verzugszinsen (LPCDA)` always-qualified per D-03 |
| D-03 — Authoritative term mapping (verbatim) | Plan 01 task action embeds all 19 D-03 mapping rows verbatim as the source of truth for the 25 lateInterest translations |
| D-04 — Formal-Sie register | Plan 01 verification includes R-14 grep check; acceptance criteria assert `grep ... = 0` |
| D-05 — `£{amount}` verbatim | Plan 01 task action embeds the literal `£{amount}` formatting in the affected keys (`claimedBanner`); acceptance criteria asserts literal `£{amount}` substring presence |
| D-06 — ICU placeholder names preserved | Plan 01 verification greps each placeholder name (`{date}`, `{percent}`, `{discountDays}`, `{netDays}`, `{amount}`, `{name}`, `{revokeLink}`, `{count}`) appears in the corresponding DE values |
| D-07 — `previewLineEn` aligned with `XRECHNUNG_SKONTO_DESCRIPTION_TEMPLATE` | Plan 01 task action uses the literal locked phrase `'{percent}% Skonto bei Zahlung innerhalb von {discountDays} Tagen, sonst netto {netDays} Tage'` |
| D-08 — Admin.ClassificationEngineFlag mapping | Plan 01 task action embeds all 6 D-08 mappings verbatim |
| D-09 — Three-command re-validation | Plan 01 verification step runs all three commands as `<automated>` checks; acceptance criteria require all three green |
| D-10 — Post-deploy Steuerberater + Plain review checkpoint | Plan 01 Task 2 (commit task) commit body and 69-SUMMARY checklist note this as a post-deploy item; NOT a STATE.md blocker per Standing Constraints |
| D-11 — REQUIREMENTS.md FOUND-03 traceability flip | Plan 01 Task 2 (after R-06 green) edits REQUIREMENTS.md to flip FOUND-03 from `Pending` to `Complete` and updates the Traceability table |

---

*Phase: 69-de-i18n-parity-fix*
*Research completed: 2026-04-26*
