# Phase 69: DE Message-Key Parity Fix - Context

**Gathered:** 2026-04-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Author 32 missing German translations in `apps/web/messages/de.json` so the Phase 56 R-06 de-locale parity test (`apps/web/src/i18n/__tests__/de-locale.test.ts`) passes with zero missing keys, closing GAP-67-01-01 and flipping FOUND-03 from `Pending` to `Complete` in REQUIREMENTS.md.

**The 32 keys, by namespace and origin phase:**

1. **`Payments.lateInterest.*`** — 25 keys (LPCDA late-interest dialog, claim PDF copy, waiver flow). Introduced by Phase 63.
2. **`Payments.skonto.previewLineEn`** — 1 key (English-language preview-line copy used in the Skonto preview banner). Introduced by Phase 63.
3. **`Admin.ClassificationEngineFlag.*`** — 6 keys (super-admin classification-engine flag-status panel: title, subtitle, app-side value indicator, signoff registry indicator, pending-gate banner, pending-gate resolution copy). Introduced by Phase 64.

**Strict scope (per ROADMAP):** ONLY `apps/web/messages/de.json`. NO UI changes, NO call-site changes, NO EN copy edits, NO PL/AR translations (out of v5.0 scope), NO new keys, NO refactoring of existing DE entries. Do not touch the `Payments.skonto.*` namespace's existing keys — only add the one missing `previewLineEn` entry.

**Out of scope (explicit):** PL/AR locale parity (separate concern, not currently broken), CI parity-gate hardening (deferred), Steuerberater pre-merge sign-off (deferred per Standing Project Constraints — local-only deploy posture), refactoring next-intl placeholder shapes, currency-formatter changes, locked-phrase additions, English copy revisions in `en.json`.

</domain>

<decisions>
## Implementation Decisions

### LPCDA legal terminology approach

- **D-01:** **German with parenthetical English on first occurrence per UI surface.** Primary translation in formal-Sie German; canonical English statute / term in parentheses the FIRST time it appears within a given user-facing surface. Pattern: `Late Payment of Commercial Debts (Interest) Act 1998 (LPCDA)` on first mention, then "LPCDA" or "der Act" thereafter. Same for "statutory interest" → "gesetzliche Verzugszinsen (statutory interest)" on first mention. This pattern matches how German legal writing conventionally handles foreign statutes and gives DE users invoicing UK clients traceability to the underlying UK statute without an untranslated feel.
- **D-02:** **Do NOT translate LPCDA-specific terms to BGB equivalents.** LPCDA is a UK statute; German `§§ 286, 288 BGB` Verzugszinsen is a DIFFERENT statutory framework (9 % above ECB base rate, distinct dispute regime). Translating "LPCDA statutory interest" to plain "Verzugszinsen" without the LPCDA qualifier would mislead a DE user into thinking BGB rules apply. Always qualify: `gesetzliche Verzugszinsen nach LPCDA`.
- **D-03:** **Authoritative term mapping (use these exact phrasings for the 25 lateInterest keys):**
  - "Statutory late-payment interest" → "Gesetzliche Verzugszinsen (LPCDA)"
  - "Late Payment of Commercial Debts (Interest) Act 1998" → kept verbatim with `(LPCDA)` after first mention
  - "Bank of England base rate" → "Bank of England Leitzins" (BoE name kept, function term translated)
  - "fixed compensation" → "pauschale Entschädigung" (with `£40 / £70 / £100` tier amounts kept verbatim)
  - "principal outstanding" → "ausstehender Hauptbetrag"
  - "days overdue" → "Tage in Verzug"
  - "rate used" → "verwendeter Zinssatz"
  - "daily accrual" → "tägliche Zinsanlauf"
  - "interest accrued" → "aufgelaufene Zinsen"
  - "total statutory claim" → "gesetzlicher Gesamtanspruch"
  - "Claim statutory interest" → "Gesetzliche Verzugszinsen geltend machen"
  - "Issue claim as a secondary invoice" → "Anspruch als Nebenrechnung ausstellen"
  - "claim snapshot" → "Anspruchs-Snapshot"
  - "Download claim letter" → "Anspruchsschreiben herunterladen"
  - "Waive interest" → "Zinsen erlassen"
  - "Waive statutory interest?" → "Gesetzliche Verzugszinsen erlassen?"
  - "Interest only / Compensation only / Both" → "Nur Zinsen / Nur Entschädigung / Beides"
  - "Revoke waiver" → "Verzicht widerrufen"
  - "Statutory interest not applicable (B2C transaction)" → "Gesetzliche Verzugszinsen nicht anwendbar (B2C-Transaktion)"
- **D-04:** **All 25 keys use formal-Sie register.** Verb forms in CTAs and confirmations: imperative-formal ("Erlassen", "Widerrufen") or infinitive ("Zinsen erlassen") — never "du erlässt" / "erlasse". Reason placeholders use `Sie`-addressing: "Begründung (erforderlich, mind. 10 Zeichen) — z. B. mit Kunden ausgehandelter Vergleich, Kulanz, Verwaltungsfehler". The R-14 guard (`grep -cE '\b(Du|Dir|Dein[a-z]*)\b' apps/web/messages/de.json` = 0) MUST continue to return 0 after this phase.

### Currency symbol placeholder handling

- **D-05:** **Keep `£{amount}` verbatim in DE translations.** LPCDA is intrinsically GBP-denominated; the DE-locale UI surface for LPCDA is shown to users invoicing UK clients in GBP, so the £ symbol carries the correct semantic. Concrete example: `claimedBanner` becomes `'Anspruchs-Snapshot erstellt am {date} — £{amount}. Auf diesen Anspruch fallen keine weiteren Zinsen an.'` Single placeholder, zero call-site changes, zero risk of breaking the existing GBP formatter wiring from Phase 63.
- **D-06:** **Preserve every ICU placeholder name verbatim from EN.** `{date}`, `{percent}`, `{discountDays}`, `{netDays}`, `{amount}`, `{name}`, `{revokeLink}`, `{count}` — the call sites reference these exact names, so renaming would break runtime interpolation. This is non-negotiable; locked.

### Translation pattern for the non-LPCDA keys

- **D-07:** **`Payments.skonto.previewLineEn`** — Despite the key name suffix `*En`, the value is the human-readable preview line shown when the locale is German. Translation: `'{percent}% Skonto bei Zahlung innerhalb von {discountDays} Tagen, sonst netto {netDays} Tage'`. This matches the locked Phase 63 D-22 `XRECHNUNG_SKONTO_DESCRIPTION_TEMPLATE` German phrasing (single source-of-truth from `packages/validators/src/legal/de.ts`) — keep them aligned even though one is a CI-locked compile-time constant and the other is a runtime UI string. If the locked phrase ever changes, this key must be re-aligned (call out in 69-SUMMARY).
- **D-08:** **`Admin.ClassificationEngineFlag.*` (6 keys)** — Super-admin-only panel; copy is internal/operational, not customer-facing legal content. Use plain German operations register (formal-Sie still applies, but no LPCDA-style legal cross-refs). Mapping:
  - `title`: "Klassifizierungs-Engine Flag-Status"
  - `subtitle`: "Status des Kill-Switch `module.classification-engine` und Disclaimer-Signoff-Registry."
  - `appSideValue`: "App-seitiger Wert (was Nutzer sehen)"
  - `signoffRegistry`: "Signoff-Registry"
  - `pendingGate`: "Flag in Unleash AKTIV, aber app-seitig blockiert — {count} Disclaimer offen (PENDING)."
  - `pendingGateResolution`: "Auflösen durch PR-Update von `packages/validators/src/legal/signoff-registry.json`"
  - Backtick-quoted code identifiers (`module.classification-engine`, `packages/validators/...`) kept verbatim — they're file paths / identifiers, not natural-language terms.

### Re-validation + post-deploy review (Standing Project Constraints)

- **D-09:** **Single re-validation run after the keys land.** Plan must include: (1) run `pnpm --filter @contractor-ops/web exec vitest run de-locale` and confirm R-06 (the de-message-parity test) is GREEN with zero missing keys; (2) run the locked-phrases-guard (`pnpm --filter @contractor-ops/validators exec vitest run locked-phrases-guard`) and confirm 78/78 still passes (no accidental locked-phrase drift); (3) run R-14 informal-register check (`grep -cE '\b(Du|Dir|Dein[a-z]*)\b' apps/web/messages/de.json`) and confirm it returns 0. NO CI parity-gate hardening in this phase (out of scope per ROADMAP — that's deferred work).
- **D-10:** **LPCDA copy gets a post-deploy Steuerberater + Plain operations review checkpoint** in `69-SUMMARY.md` under "Manual-Only Verifications". Per `STATE.md` Standing Project Constraints (local-only deploy, legal sign-off DEFERRED), this does NOT block ship and does NOT create a STATE.md blocker. The 25 lateInterest keys ship with the D-01..D-04 working translations; expert review is recorded as a post-deploy item alongside the existing Phase 56 Steuerberater queue. Pattern matches Phase 56 D-08/D-09 and Phase 63's own deferred legal-review items.
- **D-11:** **Traceability flip** — After the keys land and R-06 is green, update REQUIREMENTS.md FOUND-03 status from `Pending` to `Complete` and the Traceability table similarly. Same one-line edit pattern Phase 67 uses for verified-and-flipped requirements. This is part of the Phase 69 plan, not a follow-up.

### Claude's Discretion

- Exact JSON insertion ordering inside the `Payments.lateInterest` object (alphabetical vs match-EN-order vs grouped-by-UI-surface) — pick whichever matches the existing de.json convention for analogous namespaces; default to "match the EN key ordering" for diff readability.
- Whether `Sozialversicherungsanstalt`-style hyphenation or compound nouns ("Verzugszinsanlauf" vs "Zinsanlauf für Verzugszinsen") get used inside the longer copy — pick the form that reads most naturally; both are correct German.
- Exact wording of the secondary clauses in `claimDialogBody` ("snapshot the current interest + compensation amounts, generate a PDF claim letter, and (optionally) issue a secondary invoice...") — preserve the three-step structure; pick natural German connectives.
- Whether to break long sentences into two for readability (DE legal copy tends to be longer than EN) — split if any single translated sentence exceeds ~25 words.
- Whether `claimedBanner`'s `{revokeLink}` placeholder needs DE-specific anchor copy — it's a runtime-injected link element, not a translation surface; keep the placeholder, planner verifies the call site doesn't rely on EN-specific surrounding punctuation.

### Folded Todos

No todos folded — `gsd-sdk query todo.match-phase 69` returned 0 matches at discovery time; STATE.md "Pending Todos" section is empty.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap

- `.planning/REQUIREMENTS.md` — FOUND-03 (currently `Pending`, flips to `Complete` per D-11 once R-06 passes)
- `.planning/ROADMAP.md` §"Phase 69: DE Message-Key Parity Fix" — Goal, 4 success criteria, `Depends on Phase 56 + Phase 63 + Phase 64`
- `.planning/v5.0-MILESTONE-AUDIT.md` §FOUND-03 (status `unsatisfied`, evidence, follow_up pointer to Phase 69)

### Standing project constraints

- `.planning/STATE.md` §"Standing Project Constraints" — app is LOCAL-ONLY; legal/regulatory verification is DEFERRED; treat plan-provided legal wording as working copy and record outstanding sign-off as post-deploy item (relevant for D-10)

### Verification gap source

- `.planning/phases/56-country-foundations-german-i18n/56-VERIFICATION.md` §gaps[GAP-67-01-01] — defines the exact 32-key gap, source phases (63 + 64), test ID R-06, and follow-up phase pointer
- `.planning/phases/67-phase-56-58-verification/67-01-SUMMARY.md` — records the verification run that produced GAP-67-01-01

### Prior phase context (foundations / register / locked-phrase invariants)

- `.planning/phases/56-country-foundations-german-i18n/56-CONTEXT.md` — D-04+: locked-phrase pattern (78/78 guard test); formal-Sie register invariant; de.json shipped at 3639 leaf-key parity (the baseline this phase restores)
- `.planning/phases/63-uk-payments-financial-features/63-CONTEXT.md` — D-22 (`XRECHNUNG_SKONTO_DESCRIPTION_TEMPLATE` German locked phrase — the source-of-truth that `Payments.skonto.previewLineEn` must align with per D-07); D-26 (`PAY_SKONTO_ENABLED` flag — note that lateInterest UI is gated on `PAY_LATE_INTEREST_ENABLED` per Phase 63 D-19)
- `.planning/phases/64-legal-compliance-hardening/64-CONTEXT.md` — establishes the Admin.ClassificationEngineFlag.* namespace (super-admin classification-engine kill-switch panel)

### Existing code (target file + tone reference + tests)

- `apps/web/messages/de.json` — the file this phase modifies (only file modified, no exceptions)
- `apps/web/messages/en.json` — source-of-truth for the 32 EN-only keys (read for tone, NEVER modify in this phase)
- `apps/web/src/i18n/__tests__/de-locale.test.ts` — R-06 parity test (must pass after this phase) + R-14 routing assertion + R-17 register check
- `packages/validators/src/legal/de.ts` — locked DE legal phrases module; relevant only for D-07 alignment of `Payments.skonto.previewLineEn` with `XRECHNUNG_SKONTO_DESCRIPTION_TEMPLATE`
- `packages/validators/src/__tests__/locked-phrases-guard.test.ts` — 78/78 must continue to pass (D-09 sanity check)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **Existing `Payments.skonto` namespace in de.json** — direct tone reference. Established translations: "Skonto-Frist (Tage)", "Auftragnehmer-Voreinstellung", "Für diese Rechnung anpassen". Match this register for the new `previewLineEn` entry and lateInterest copy where overlapping vocabulary applies.
- **Existing `Admin.BoeRate.*` keys in de.json** — already established translation patterns for related UK financial copy: "Bank of England Leitzinshistorie", "Referenzdaten für die Berechnung der gesetzlichen Verzugszinsen (UK)". The new `Admin.ClassificationEngineFlag.*` namespace adopts the same admin-tone register (formal-Sie, file-path identifiers verbatim).
- **R-14 informal-register guard** — already in place; ensures D-04 invariant holds automatically.
- **R-06 parity test** (`apps/web/src/i18n/__tests__/de-locale.test.ts:55-72`) — runs `flattenKeys()` on both files and asserts `enKeys ⊂ deKeys`. The exact assertion this phase must satisfy.
- **`XRECHNUNG_SKONTO_DESCRIPTION_TEMPLATE`** in `packages/validators/src/legal/de.ts` (Phase 63 D-22 locked phrase) — single source-of-truth for the German Skonto preview phrase; D-07 alignment depends on it.

### Established Patterns

- **Formal-Sie register everywhere in DE copy** — established Phase 56; never use Du/Dir/Dein. CTAs use imperative-formal or infinitive forms.
- **Foreign statute names kept verbatim** — convention from Phase 56 D-08+ for `LOCKED_DE_PHRASES`; legal precision over translation freedom.
- **ICU placeholders preserved verbatim across locales** — next-intl convention; call sites depend on exact names.
- **Locked compile-time DE phrases live in `packages/validators/src/legal/de.ts`** (Phase 56 D-04+ locked-phrases pattern); UI copy lives in `apps/web/messages/de.json`. The 32 keys in this phase are UI copy ONLY — none of them belong in the locked-phrases module.
- **Forward-only fixes for local-only deployment** — Standing constraint; drives D-10's post-deploy review framing.

### Integration Points

- The 32 keys are call-site-anchored — every key is already referenced from existing TSX/TS files (Phase 63 LateInterestSection / WaiveDialog / ClaimDialog components for the `Payments.lateInterest.*` keys; Phase 63 SkontoPreviewBanner for `Payments.skonto.previewLineEn`; Phase 64 super-admin ClassificationEngineFlagPanel for the `Admin.ClassificationEngineFlag.*` keys). The planner should grep each key in `apps/web/src/` to confirm the call site exists and the surrounding placeholder pattern is what `de.json` needs to match — but does NOT modify any TSX file.
- `next-intl` resolves the DE locale at runtime via the `apps/web/src/i18n/routing.ts` registry (already wired by Phase 56). No routing changes needed.
- `PAY_LATE_INTEREST_ENABLED` and `PAY_SKONTO_ENABLED` feature flags (Phase 63 D-19 / D-26) gate the UI surfaces that consume these keys; this phase does NOT change flag behavior — DE translations sit dormant when flags are OFF, become visible when flags are ON, identical to the EN copy lifecycle.

</code_context>

<specifics>
## Specific Ideas

- "German with parenthetical English on first occurrence — matches how DE legal writing conventionally handles foreign statutes." (D-01)
- "Translating LPCDA terms to BGB Verzugszinsen would mislead DE users — different statutory framework." (D-02)
- "Keep `£{amount}` verbatim — LPCDA is intrinsically GBP." (D-05)
- "ICU placeholder names locked — call sites reference exact names." (D-06)
- "`Payments.skonto.previewLineEn` must align with `XRECHNUNG_SKONTO_DESCRIPTION_TEMPLATE` — same source-of-truth." (D-07)

</specifics>

<deferred>
## Deferred Ideas

- **CI-blocking parity gate across en/de/pl/ar locales** — would prevent future GAP-67-01-01-style regressions but expands beyond Phase 69's "fix the 32 keys" scope. Park as a candidate for a future i18n-hardening phase.
- **Steuerberater + Plain operations sign-off on the LPCDA late-interest dialog copy** — recorded as post-deploy review item per D-10; do NOT escalate to a pre-merge blocker (Standing Project Constraints disallow this for local-only deploy).
- **PL / AR parity audit** — not currently broken (audit only flagged DE), so out of scope. If PL or AR drift in future phases, file a separate parity-fix phase.
- **Refactoring `previewLineEn` key to a more canonical name (e.g., `previewLine`)** — would touch call sites and EN copy; out of scope for a "fix the 32 keys" phase. Park.
- **Deduplicating `Payments.skonto.previewLineEn` against `XRECHNUNG_SKONTO_DESCRIPTION_TEMPLATE` into a single shared resource** — would require restructuring how next-intl messages and CI-locked phrases share copy; significant scope. Park as a possible future i18n-architecture phase.
- **Adding `LOCKED_LPCDA_PHRASES` to `packages/validators/src/legal/`** — if Steuerberater review later concludes the LPCDA copy needs CI-locked treatment, that's a separate hardening phase. Don't preemptively lock.

</deferred>

---

*Phase: 69-de-i18n-parity-fix*
*Context gathered: 2026-04-26*
