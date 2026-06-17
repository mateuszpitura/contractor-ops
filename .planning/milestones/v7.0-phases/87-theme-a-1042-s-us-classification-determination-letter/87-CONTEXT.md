# Phase 87: Theme A — 1042-S + US Classification + Determination Letter - Context

**Gathered:** 2026-06-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Two related US compliance surfaces, both composing with already-built engines:

1. **1042-S** (US-FORM-06) — the foreign-person US-source withholding return: report US-source payments to foreign contractors with the treaty-correct withholding rate (from the P85 treaty table), a recipient PDF, and an IRS file via the P86 IRIS pipeline.
2. **US worker classification** (US-CLASS-01/02) — a US rule set in the v5.0 classification engine: federal common-law / economic-realities + CA ABC/AB5 + §530 safe-harbor, with a CA AB5 watchlist auto-flag and audit-logged admin override.
3. **1099-K informational tracker** (US-CLASS-03) — surface cumulative payouts approaching `$20,000 + 200 transactions` on the contractor profile. Informational only — **we never file 1099-K**.
4. **Classification Determination Letter** (US-CLASS-04) — a PDF mirroring the v5.0 UK SDS generator, produced from the scored US classification assessment.

**NOT this phase:**
- The actual **payout withholding deduction** (treaty rate or 24%) → **Phase 88** (payment rails). This phase REPORTS withholding (1042-S box 2), it does not reduce payouts.
- ACH/wire/USD payment rails → **Phase 88**.
- TIN-Match, 1099-NEC, IRIS transmit, per-state CFSF → **Phase 86** (this phase reuses P86's IRIS seam + ack parser + transmitter + recipient-PDF infra).
- Any **AI/LLM** document generation — the Determination Letter is deterministic (see D-01); Phase 87 therefore does **not** require `/gsd:ai-integration-phase`.
</domain>

<decisions>
## Implementation Decisions

### Classification Determination Letter (US-CLASS-04)
- **D-01:** **Deterministic React-PDF template, mirroring the v5.0 UK SDS generator.** Build the letter as a `pdf-templates/*.tsx` component + reuse `classification-document-render.ts` (`renderAndArchiveDocument` → react-pdf `renderToBuffer` → R2 + signed URL), rendering the scored factors, verdict band, CA-AB5 / §530 flags, and case-law citations from the **frozen assessment snapshot**. **No LLM.** Inherits the existing advisory / not-legal-advice footer (`SOFTWARE_NOT_LEGAL_ADVICE_EN`). This keeps Phase 87 off the AI-integration path entirely (resolves the ROADMAP research flag) and avoids introducing the product's first LLM document-generation surface + the classification-verdict liability that an LLM-asserted determination would carry.
- **D-02:** New `ClassificationDocument` kind (e.g. `US_DETERMINATION_LETTER`) on the existing model, with `ruleSetVersion` frozen at generation, mirroring how the SDS kind is handled. Staff-generated + downloadable like the SDS (no contractor self-generation).

### US Classification Rule Set (US-CLASS-01 / US-CLASS-02)
- **D-03:** **One US `ClassificationProfile`** registered via the existing `registerProfile` registry (no `registry.ts` change; `getProfileForCountry('US')`). It combines the three required tests into a single scored assessment, mirroring the IR35 / Scheinselbständigkeit weighted-criteria pattern: **federal common-law / economic-realities as the base weighted assessment**, **CA ABC/AB5 as a stricter overlay** that defaults the outcome when the worker is CA, and **§530 safe-harbor surfaced as a relief-eligibility flag** on the result. `ClassificationAssessment` already carries `countryCode`, so `countryCode='US'` slots in.
- **D-04:** **AB5 watchlist auto-flag triggers on the engagement work-location (state).** Add an engagement **work-state** field; auto-flag + default to the stricter ABC test when work-state = `CA`, **falling back to the contractor's P84 US state** when work-state is unset (AB5 governs work *performed* in CA, not residence — so the explicit work-state is the primary, legally-correct signal). The flag/override is **audit-logged** (`writeAuditLog`), mirroring the treaty/reverse-charge override-with-reason pattern.
- **D-05:** **Advisory posture inherited, not re-decided.** The US classification is **decision-support, not a legal verdict** — it reuses the existing `SOFTWARE_NOT_LEGAL_ADVICE_EN` disclaimer + expert-help adviser-referral surface. No outcome is presented as a final legal determination (consistent with the product's deliberate avoidance of classification-as-verdict liability).

### 1042-S (US-FORM-06)
- **D-06:** **New `Form1042S` Prisma model**, mirroring the P86 `Form1099Nec` immutable-snapshot + SUPERSEDED-chain idiom (different box structure: boxes 1a–1c income, **box 2 withholding**, **box 5 treaty-article snapshot**; recipient is a foreign person/entity). Append-only; CORRECTED = supersede in a `$transaction`.
- **D-07:** **Withholding is REPORTED-only this phase.** The treaty article + rate are resolved from the **P85 `WithholdingTaxRate` table** via `treaty-rate.service` / `applyTreaty` and **snapshotted** on the 1042-S (box 2), with **§875(d) gating** — the treaty rate applies only when the W-8 chain is complete, otherwise **30% statutory**. The **actual payout deduction is Phase 88** (no payout-withholding-deduction logic exists anywhere yet; consistent with the 1099-NEC box-4 reported-only precedent in P86).
- **D-08:** **Reuse the P86 IRIS pipeline** — the `TaxFilingTransmitter` seam (ManualDownload default / IrisA2A dark behind `module.iris-efile` / Vendor stub), the single ack parser (6 statuses), XSD-validate-in-CI, and `packages/iris`. 1042-S is a different IRS form-type payload (different XSD) routed through the **same** transmit tail; FIRE remains doc-only.
- **D-09:** **Recipient PDF reuses the P86 consent gate.** The 1042-S recipient copy is a deterministic react-pdf template (mirror the 1099-NEC Copy-B render/archive), delivered via the **same affirmative IRS e-delivery consent gate**; **no consent / no portal access → flagged for paper/manual** (covers foreign W-8 recipients without a portal seat). TIN/FTIN masked to last-4; full value never in the snapshot/PDF.

### 1099-K Informational Tracker (US-CLASS-03)
- **D-10:** **Cron-tracked band state, mirroring the v5.0 `EconomicDependencyAlertState`.** A new `Form1099KTrackerState` row per contractor per tax-year tracks cumulative payout minor-amount + transaction count; a periodic cron (`createCronLogger`) transitions bands (e.g. SAFE → APPROACHING → OVER) and fires a **proactive heads-up notification**. Surfaces on the contractor profile. **Purely informational — the platform never files 1099-K** (that is the payment settler's return).
- **D-11:** **Threshold is a tax-year-keyed config** (`$20,000 + 200 transactions`, OBBBA-reverted — NOT the stale `$5K/$600`), same no-constants pattern as the P86 `Tax1099Threshold` table, so a future change is data, not code.

### Cross-Cutting (carried forward — not re-asked)
- **D-12:** Whole surface gated on **`module.us-expansion`** (P85/P86 pattern); per-request `assertUsExpansionEnabled` + conditional `root.ts` spread.
- **D-13:** **Immutable + supersede** archives (`Form1042S`, classification documents) + **adviser-verify annotations** on figures/determinations (local-only / legal-deferred posture).
- **D-14:** **i18n parity** en / en-US / de / pl / ar (RTL) on all new user-facing strings (1042-S surface, classification UI, 1099-K badge/notification, Determination Letter copy). No hardcoded strings.
- **D-15:** **`writeAuditLog`** on classification override, 1042-S generate/correct/transmit, Determination-Letter generation; **idempotency** (`packages/api/src/lib/idempotency.ts`) on any 1042-S batch generation/transmit (mirror P86).

### Claude's Discretion
- Exact `Form1042S` columns + the `US_DETERMINATION_LETTER` / `Form1099KTrackerState` model shapes (planner; tenant-owning, never in `globalModels`; cross-org leak test per model).
- US `ClassificationProfile` question set + scoring weights for the federal economic-realities factors, the CA ABC three prongs, and the §530 safe-harbor criteria (mirror IR35/Scheinselbständigkeit rule-set authoring; rule-set version frozen on submit).
- Whether 1042-S reuses the P86 IRIS XML builder by parameterizing form-type vs a sibling builder in `packages/iris` (planner, after the P86 builder lands).
- The 1099-K band thresholds/notification cadence and the contractor-profile badge component (mirror `EconomicDependencyAlertState` bands + the P84/P85 profile-card idiom).
- Determination-Letter layout specifics (planner, mirroring `ir35-sds.tsx`).
- 1042-S vs 1099-NEC routing for a given contractor (foreign W-8 → 1042-S; US W-9 → 1099-NEC) — derive from the P85 form-routing + the contractor's tax-form on file.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone planning
- `.planning/REQUIREMENTS.md` — US-FORM-06, US-CLASS-01/02/03/04 verbatim; line 20 the OBBBA `$20,000 + 200` 1099-K correction (backlog `$5K/$600` is stale).
- `.planning/ROADMAP.md` (Phase 87 entry) — goal + 4 success criteria + research flag (US-CLASS-04 AI candidacy — resolved deterministic per D-01) + UI hint. Phase 85/86/88 entries for the engines this composes with.
- `.planning/milestones/v7.0-BACKLOG.md` — A2 classification block; local-only/legal-deferred annotation rule (line 227); AI-integration candidates (line 306).
- `.planning/phases/85-theme-a-w-form-intake-tax-treaty-engine/85-CONTEXT.md` — treaty engine + WithholdingTaxRate + form routing (1042-S withholding source).
- `.planning/phases/86-theme-a-tin-match-1099-nec-iris-e-file-state-filing/86-CONTEXT.md` — IRIS transmitter seam, ack parser, manual-upload default, recipient-PDF + consent gate, tax-year-keyed threshold config (the patterns 1042-S + 1099-K reuse).

### Classification engine (v5.0 — extend)
- `packages/classification/src/registry.ts` (`registerProfile`/`getProfile`/`getProfileForCountry`) + `src/types/profile.ts` (`ClassificationProfile` contract) — how the US rule set plugs in.
- `packages/classification/src/profiles/ir35/{rule-set.ts,index.ts}` + `profiles/scheinselbstandigkeit/rule-set.ts` — the weighted-criteria rule-set pattern to mirror for the US profile.
- `packages/db/prisma/schema/classification.prisma` (`ClassificationAssessment` line 15 multi-country; `ClassificationDocument` line 55 kinds + `ruleSetVersion`) — models to extend (US assessment + `US_DETERMINATION_LETTER` kind).
- `packages/api/src/routers/compliance/{classification-draft,classification-read,classification-document}.ts` + `classification-shared.ts` (`getProfileForCountry`) — generic routers (no change needed beyond US wiring).

### Determination Letter (mirror)
- `packages/api/src/pdf-templates/ir35-sds.tsx` + `packages/api/src/services/classification-document-render.ts` (`renderAndArchiveDocument`) — the SDS template + render/archive service the Determination Letter mirrors.
- `packages/validators/src/legal/disclaimers.ts` (`SOFTWARE_NOT_LEGAL_ADVICE_EN`) — advisory footer (D-05).

### 1042-S (reuse P86 + P85)
- `packages/iris/` + `packages/api/src/services/tax-filing-transmitter.ts` + `iris-ack-parser` (P86 — IRIS XML/validator + transmitter seam + ack parser; built in Phase 86).
- `packages/api/src/pdf-templates/form-1099-nec-copy-b.tsx` + `services/form-1099-nec-pdf.ts` (`renderAndArchiveCopyB` — recipient-PDF + R2 CAS archive pattern to mirror for the 1042-S recipient copy).
- `packages/db/prisma/schema/tax.prisma` (`WithholdingTaxRate` line ~165; `Form1099Nec`/`Tax1099Threshold`/`StateFilingConfig` — immutable-snapshot + config-table idioms) + `packages/api/src/services/treaty-rate.service.ts` (`applyTreaty`) / `tax-rate.service.ts` (`calculateWht`).

### 1099-K tracker (mirror)
- v5.0 `EconomicDependencyAlertState` (Phase 60 economic-dependency alert — rolling cron + band transitions + notification) — the tracker pattern to mirror.
- `apps/cron-worker/src/jobs/registry.ts` (+ a handler) — register the periodic 1099-K tracker job.

### PII / audit / flags / docs
- `packages/auth/src/permissions.ts` (`CONTRACTOR_PII:READ`), `packages/api/src/services/audit-writer.ts` (`writeAuditLog`), `packages/api/src/lib/idempotency.ts`, `packages/api/src/middleware/require-us-expansion-flag.ts`, `packages/feature-flags/src/registry.ts`.

### Documentation-follows-code (update in the same change set)
- `.planning/brain/wiki/domains/` (US classification + 1042-S — extend the us-tax-forms page / classification domain page), `wiki/structure/api-routers-catalog.md`, `wiki/structure/prisma-schema-areas.md` (`Form1042S`, US classification, `Form1099KTrackerState`), `wiki/structure/cron-jobs.md` (1099-K tracker), `wiki/integrations/` (IRS 1042-S via IRIS), `wiki/log.md` + `hot.md`; `.planning/MEMORY.md` for any new invariant.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Classification registry + profile contract** (`registry.ts`, `types/profile.ts`) — the US rule set is a new `ClassificationProfile`; registry auto-discovers it, routers are already multi-country.
- **IR35 / Scheinselbständigkeit rule sets** — the weighted-criteria + case-law-citation authoring pattern for the US federal/CA/§530 tests.
- **UK SDS generator** (`ir35-sds.tsx` + `classification-document-render.ts`) — the deterministic Determination-Letter template + render/archive service.
- **P86 IRIS pipeline** (`packages/iris`, `tax-filing-transmitter.ts`, ack parser, `form-1099-nec-copy-b.tsx` / `form-1099-nec-pdf.ts`) — 1042-S routes through the same transmit tail + mirrors the recipient-PDF render/archive.
- **P85 treaty engine** (`WithholdingTaxRate`, `treaty-rate.service.ts`/`applyTreaty`) — the 1042-S box-2 withholding-rate source (§875(d)-gated).
- **`EconomicDependencyAlertState`** (v5.0) — the cron + band-transition + notification pattern for the 1099-K tracker.
- **`SOFTWARE_NOT_LEGAL_ADVICE_EN`** + expert-help surface — advisory posture inherited wholesale.
- **`writeAuditLog`, `idempotency.ts`, `require-us-expansion-flag.ts`, `Tax1099Threshold`** — audit, dedupe, gating, tax-year config patterns.

### Established Patterns
- **Pluggable country `ClassificationProfile`** — add a profile, don't fork the engine.
- **Deterministic React-PDF document generation** (SDS, 1099-NEC Copy-B) — no LLM in any document surface; the Determination Letter follows.
- **Immutable + supersede compliance records** (`Form1099Nec`, classification docs) — `Form1042S` follows.
- **Reported-now / deducted-later** — 1042-S withholding + 1099 box-4 are reported; the payout reduction is Phase 88.
- **Advisory decision-support, never legal verdict** — the established classification liability posture.
- **Tax-year-keyed config, not constants** — 1099-K threshold + treaty rates.
- **No hardcoded user-facing strings; i18n parity en/en-US/de/pl/ar(RTL).**

### Integration Points
- US `ClassificationProfile` resolves via `getProfileForCountry('US')`; AB5 reads the new engagement work-state (fallback contractor P84 state); outcome feeds the Determination-Letter render.
- 1042-S withholding reads `applyTreaty` (P85) and snapshots article+rate; the form files through the P86 transmitter; the reported rate is what P88 will actually deduct.
- 1099-K tracker reads payment data (cumulative tax-year payouts + transaction count) on a cron; surfaces on the contractor profile.
- 1042-S vs 1099-NEC selection derives from the contractor's W-8/W-9 on file (P85 form routing).

</code_context>

<specifics>
## Specific Ideas

- **Compose, don't rebuild** — every Phase 87 surface extends a shipped engine (v5.0 classification registry, P85 treaty table, P86 IRIS pipeline + react-pdf, v5.0 economic-dependency alert). The only genuinely new models are `Form1042S`, the US classification assessment/document kind, and `Form1099KTrackerState`.
- **Determination Letter is deterministic on purpose** — mirroring the SDS keeps the product's no-LLM-generation, advisory-not-verdict posture intact and avoids the ai-integration-phase dependency. An LLM asserting a worker classification is exactly the liability the product avoids.
- **Report, don't deduct** — 1042-S withholding is a reported figure sourced from the published treaty table (a mechanical lookup like reverse-charge), not a payout mutation; Phase 88 owns the deduction.
- **1099-K is a courtesy heads-up, never a filing** — the platform isn't the payment settlor; the tracker only warns the contractor/staff as the $20k+200 threshold approaches.
- **AB5 is about where work is performed** — the engagement work-state is the correct trigger, not the contractor's residence; residence is only the fallback.

</specifics>

<deferred>
## Deferred Ideas

- **AI-generated Determination-Letter narrative** — deterministic template ships now; an LLM-drafted plain-language summary (flag-gated) could be revisited later via `/gsd:ai-integration-phase` if a real need emerges.
- **Actual 1042-S / treaty / backup-withholding payout deduction** — reported here; the 24%/treaty-rate payout reduction is **Phase 88**.
- **Live IRIS A2A transmit for 1042-S** — reuses the P86 dark `module.iris-efile` path; activated with the same TCC enrollment.
- **1099-K filing** — out of scope permanently for this product (settlor's return); tracker is informational only.
- **Additional US state classification tests beyond CA AB5** (e.g. other states' ABC variants) — CA AB5 + federal + §530 this phase; other states when a customer needs them.

None of these expand the phase scope — discussion stayed within the 1042-S + US-classification + 1099-K-tracker + Determination-Letter boundary.

</deferred>

---

*Phase: 87-theme-a-1042-s-us-classification-determination-letter*
*Context gathered: 2026-06-18*
