# Phase 68: Skonto BG-20 XRechnung Emission Fix - Context

**Gathered:** 2026-04-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Thread the existing per-invoice / per-billing-profile Skonto term through `XRechnungDEProfile.generate` / `generateAndValidate` and through the ZUGFeRD embedded-CII generation path so that finalized DE invoices emit structured `ram:SpecifiedTradePaymentTerms` (BG-20) carrying the locked German Skonto phrase and the `#SKONTO#TAGE=…#PROZENT=…#BASISBETRAG=…#` extension string per XRechnung 3.0.2 Anhang E.

The CII-level emission helper (`buildPaymentTerms` in `packages/einvoice/src/profiles/xrechnung-de/generator.ts:278-326`) already produces correct BG-20 output and `generateXRechnungCii(invoice, leitwegId, skontoTerm)` already accepts a third argument. The defect is purely at the *wiring* layer:

1. `XRechnungGenerateOptions` only exposes `leitwegId` (no `skontoTerm`).
2. `XRechnungDEProfile.generate` / `generateAndValidate` discard whatever Skonto context the caller has.
3. `einvoice-finalize.ts:246-247` calls `profile.generateAndValidate(envelope, { leitwegId })` and never resolves the effective term via the existing `resolveSkontoTerm` cascade in `services/skonto.ts:51`.
4. `ZugferdDEProfile.generate(invoice)` takes no opts and `generateZugferdPdf({ invoice, leitwegId })` does not accept a Skonto term, so the embedded CII inside ZUGFeRD PDF/A-3 inherits the same omission.

**Out of scope (explicit):** Multi-tier Skonto, KoSIT artifact regeneration, BG-20 string format changes, cascade-rule changes, feature-flag changes, custom Schematron authoring, validator-side semantic assertions, UI/UX changes, locked-phrase template revisions, contract-level Skonto templates, multi-invoice backfill scripts.

</domain>

<decisions>
## Implementation Decisions

### Profile options API shape (XRechnung)

- **D-01:** **Reuse `SkontoTermInput` from `xrechnung-de/generator.ts`** as the profile-options field type. Re-export it from `packages/einvoice/src/profiles/xrechnung-de/index.ts` and add `skontoTerm?: SkontoTermInput | null` to `XRechnungGenerateOptions`. The `einvoice` package stays fully decoupled from `@contractor-ops/api` (matches the existing dependency direction `api → einvoice`). The caller in `einvoice-finalize.ts` maps `SkontoTermData → SkontoTermInput` inline (3 fields: `discountPercent`, `discountPeriodDays`, `netPeriodDays` — identical shape).
- **D-02:** **`XRechnungDEProfile.generate(invoice, opts)`** forwards `opts.skontoTerm ?? null` as the third positional argument to `generateXRechnungCii(invoice, leitwegId, skontoTerm)`. **`generateAndValidate(invoice, opts)`** does the same and then runs the existing `validateXRechnungCii` pipeline against the produced XML — no change to the validator path.

### Cascade resolution in `einvoice-finalize.ts`

- **D-03:** **Inline cascade in `loadInvoiceWithRelations` + `services/skonto.ts:resolveSkontoTerm`.** Extend the Prisma `include` in `loadInvoiceWithRelations` to eager-fetch `skontoTerms: { take: 1 }` on the invoice and `skontoTerms: { take: 1 }` on `contractor.billingProfiles[0]` — mirrors the exact include shape used by `payment.ts:1213-1294`. Inside `finalizeEInvoice`, immediately after the Leitweg-ID resolution and before `profile.generateAndValidate`, compute:
  ```ts
  const invoiceSkonto = invoice.skontoTerms[0] ?? null;
  const profileSkonto = invoice.contractor?.billingProfiles[0]?.skontoTerms[0] ?? null;
  const effectiveSkonto = resolveSkontoTerm(
    toSkontoTermData(invoiceSkonto),
    toSkontoTermData(profileSkonto),
  );
  ```
  Pass `{ leitwegId, skontoTerm: effectiveSkonto }` into `profile.generateAndValidate`. `resolveSkontoTerm` from `packages/api/src/services/skonto.ts:51` stays the **single source-of-truth** for the cascade rule established in Phase 63 D-21 — no new resolver helper, no extracted service.
- **D-04:** **`toSkontoTermData` mapping happens in einvoice-finalize**, not in `services/skonto.ts`. The Prisma `SkontoTerm` row's `discountPercent` is `Decimal`; the cascade helper expects a `number`. Mapping is a small local helper in `einvoice-finalize.ts` (or extracted to `services/skonto.ts` only if the same Prisma → SkontoTermData mapper already exists there — check during planning). The mapper also strips fields not consumed by the generator (`id`, `organizationId`, `invoiceId`, `billingProfileId`, timestamps).

### ZUGFeRD propagation surface

- **D-05:** **Extend `ZugferdDEProfile.generate(invoice, opts?: { leitwegId?: string | null; skontoTerm?: SkontoTermInput | null })`** so the contract is symmetric with `XRechnungDEProfile.generate`. Add `skontoTerm` to `GenerateZugferdInput` and thread it through to `generateXRechnungCii(input.invoice, leitwegId, skontoTerm)` at `packages/einvoice/src/profiles/zugferd-de/generator.ts:82`. Symmetric DE profile contracts make the wiring obvious for the next person and are the natural extension point if future cross-DE-format options arise.
- **D-06:** **Cascade resolution lives in `packages/api/src/routers/einvoice.ts`** inside the `generateZugferd` procedure (mirrors D-03 placement at `einvoice-finalize.ts`). Eager-fetch `skontoTerms` via the existing invoice load, call `resolveSkontoTerm`, pass the resolved value into `generateZugferdPdf({ invoice, leitwegId, skontoTerm })`. **Do NOT** add a new `services/zugferd-for-invoice.ts` wrapper — it would hide cascade logic behind a thin layer for one caller.
- **D-07:** **Widen `EInvoiceProfile.generate` to `generate(invoice, opts?: unknown): Promise<string>`** in `packages/einvoice/src/types/profile.ts`. Each profile narrows `opts` to its own type at the implementation. KSeF / ZATCA / Peppol-AE all keep ignoring `opts` (zero behavior change — they already accept `invoice` only and the new param is optional). Same widening on `parse(xml, _metadata?)` is **not** in scope — only `generate` needs it. `generateAndValidate` already has its own per-profile signature outside the shared interface, so D-02's per-profile typing stays type-safe.

### Regression test scope

- **D-08:** **Three test layers ship in this phase** (audit-grade, given v5.0 audit flagged I-1 as CRITICAL):
  - **Layer A (unit, profile boundary):** New test in `packages/einvoice/src/profiles/xrechnung-de/__tests__/profile.test.ts` (or extend an existing one) — instantiate `XRechnungDEProfile`, call `generate(invoice, { skontoTerm: {...} })`, assert returned XML contains `<ram:SpecifiedTradePaymentTerms>` with the structured `#SKONTO#TAGE=…#PROZENT=…#BASISBETRAG=…#` substring. Locks the profile-level wiring.
  - **Layer B (integration, finalize service):** Extend `packages/api/src/services/__tests__/einvoice-finalize.test.ts` — finalize a DE invoice that has a `SkontoTerm` set on the invoice (and, separately, a default on the billing profile), assert the persisted XML in R2 contains BG-20, assert `validationStatus === 'VALID'` (KoSIT 3-layer passes). Locks the cascade + plumbing through `loadInvoiceWithRelations`.
  - **Layer C (integration, ZUGFeRD path):** Extend `packages/api/src/routers/__tests__/einvoice.generate-zugferd.test.ts` — call the `generateZugferd` procedure with a Skonto-bearing DE invoice, parse the embedded CII out of the produced PDF/A-3, assert it contains the same BG-20 structure. Locks the ZUGFeRD-specific wiring path the audit explicitly called out as cascading from I-1.
- **D-09:** **Both fixture branches (with-Skonto + without-Skonto) must exercise KoSIT 3-layer validation.** Phase 61 D-04 established that `generateAndValidate` runs XSD → EN 16931 Schematron → XRechnung CIUS Schematron, and Phase 61 fixture tests already cover the no-Skonto path. The new tests must add Skonto fixtures alongside the existing ones in `packages/einvoice/src/profiles/xrechnung-de/__fixtures__/` (one new `skonto-invoice.json` envelope + matching `skonto-invoice.xml` golden file) and assert validation status `'VALID'` on both branches. Reuses Phase 63 D-23's planned test fixture intent (which slipped through in Phase 63 implementation per audit I-1 evidence).

### Backfill of historical lifecycles

- **D-10:** **Forward-only fix — no migration script.** Standing project constraint (`STATE.md` §"Standing Project Constraints") establishes the app is local-only with no production data, no live B2G recipients, and no external users. Any dev / test fixture invoices that need corrected XML can be re-finalized via the existing public surface: `finalizeEInvoice({ invoiceId, force: true })`. No `scripts/refinalize-de-skonto-invoices.ts`, no one-shot job, no SUMMARY-only manual procedure. If a future deploy ever ships into production with affected lifecycle data, that's a separate phase.

### KoSIT Schematron / validator-side semantic assertion

- **D-11:** **Defer to a follow-up phase.** Audit `follow_up` for EINV-04 marked this as "consider adding KoSIT-level Schematron assertion that BG-20 is present when `invoice.skontoTerms[0]` exists" — explicitly *consider*, not required to close I-1. The three test layers (D-08) plus the existing KoSIT 3-layer validation already give strong coverage. A custom Schematron would mean authoring a hand-rolled `.sch`, recompiling via `scripts/recompile-kosit-schematron.ts`, and shipping a non-bundled XSLT alongside the pinned KoSIT artifacts — that breaks the Phase 61 D-03 invariant of treating the KoSIT validator-bundle as a black-box pinned release. Park in **Deferred Ideas** and revisit only if a regression escapes the test suite.

### Claude's Discretion

- Exact location of the `toSkontoTermData(prismaRow)` helper (inline private fn in `einvoice-finalize.ts` vs co-located in `services/skonto.ts` if a similar mapper already exists there) — decide during planning after reading `services/skonto.ts` end-to-end.
- Naming of the new fixture file (`skonto-invoice.json` / `with-skonto.json` / `de-invoice-skonto.json` etc.) — pick whichever matches the existing `__fixtures__/` naming convention.
- Whether the Layer B finalize-service test reuses the existing test harness's invoice factory or adds a new one with `skontoTerms` pre-attached — pick whichever keeps the test file under the project's typical test-file-size norm.
- Whether to also add a `parse(xml)` round-trip assertion that the BG-20 block is preserved (XRechnung CII parser exists at `parser.ts`) — nice-to-have; include if it's a 5-line test, skip otherwise.
- Whether the `EInvoiceProfile.generate(invoice, opts?: unknown)` widening (D-07) uses a type parameter (`generate<O = void>(invoice, opts?: O)`) or a plain `unknown` — decide based on whether any other generic profile machinery already uses type parameters; default to plain `unknown` for minimal blast radius.

### Folded Todos

No todos folded — `gsd-sdk query todo.match-phase 68` returned 0 matches at discovery time; STATE.md "Pending Todos" section is empty.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap

- `.planning/REQUIREMENTS.md` — EINV-01 (XRechnung CII generation), EINV-02 (ZUGFeRD PDF/A-3 with embedded CII), EINV-04 (KoSIT 3-layer validation), PAY-04 (German VAT + Skonto early-payment-discount semantics) — all marked `partial` per audit
- `.planning/ROADMAP.md` §"Phase 68: Skonto BG-20 XRechnung Emission Fix" — Goal, 4 success criteria, `Depends on Phase 61 + Phase 62 + Phase 63`
- `.planning/v5.0-MILESTONE-AUDIT.md` §I-1 (CRITICAL cross-phase integration finding), §F-4 BROKEN (DE invoice → XRechnung → KoSIT → Peppol flow), §EINV-01/02/04 partials, §PAY-04 partial — these define the exact wiring gap and call sites to fix

### Standing project constraints

- `.planning/STATE.md` §"Standing Project Constraints" — app is LOCAL-ONLY; legal/regulatory verification is DEFERRED; no production data; no hard-block on missing legal sign-off (relevant for D-10 backfill decision)

### Prior phase context (foundations this phase plumbs through)

- `.planning/phases/61-xrechnung-e-invoicing/61-CONTEXT.md` — D-01 (`packages/einvoice/src/profiles/xrechnung-de/` layout), D-02 (XRechnung 3.0.2 + Anhang E reference for the structured Skonto string format), D-03 (KoSIT bundled validator-bundle as a black box — relevant for D-11 deferral rationale), D-04 (`finalizeEInvoice` mutation = primary call site this phase patches)
- `.planning/phases/62-zugferd-e-invoicing/62-CONTEXT.md` — establishes that ZUGFeRD reuses `generateXRechnungCii` for the embedded-CII path (the second wiring location this phase patches)
- `.planning/phases/63-uk-payments-financial-features/63-CONTEXT.md` — D-20 (`SkontoTerm` Prisma model + XOR constraint between invoice-level and profile-level), D-21 (cascade rule = invoice → billing-profile → null; locked source-of-truth), D-22 (single-tier; `XRECHNUNG_SKONTO_DESCRIPTION_TEMPLATE` locked German phrase already in use by `buildPaymentTerms`), D-23 (BG-20 emission spec — *intent* of D-23 is what this phase actually delivers; D-23's claim "extends the Phase 61 generator" was true at the helper layer but the wiring through `XRechnungDEProfile` slipped per audit I-1), D-26 (`PAY_SKONTO_ENABLED` feature flag — already gates SkontoTerm CRUD; this phase does not add or change flag behavior)

### Existing code (call sites + reusable infrastructure)

- `packages/einvoice/src/types/profile.ts` — `EInvoiceProfile` interface (widened in D-07)
- `packages/einvoice/src/profiles/xrechnung-de/index.ts` — `XRechnungGenerateOptions`, `XRechnungDEProfile.generate`, `generateAndValidate` (modified per D-01/D-02)
- `packages/einvoice/src/profiles/xrechnung-de/generator.ts` — `SkontoTermInput`, `buildPaymentTerms` (no change — already correct), `generateXRechnungCii(invoice, leitwegId, skontoTerm)` (no change — already accepts the third arg)
- `packages/einvoice/src/profiles/xrechnung-de/__fixtures__/` — fixture directory; new Skonto fixture lands here (D-09)
- `packages/einvoice/src/profiles/zugferd-de/profile.ts` — `ZugferdDEProfile.generate` (modified per D-05)
- `packages/einvoice/src/profiles/zugferd-de/generator.ts` — `GenerateZugferdInput`, `generateZugferdPdf`, `generateXRechnungCii` call at line 82 (modified per D-05)
- `packages/api/src/services/einvoice-finalize.ts:215-247` — `finalizeEInvoice` body, `loadInvoiceWithRelations` (modified per D-03/D-04); `profile.generateAndValidate` call at line 246
- `packages/api/src/services/skonto.ts:18` (`SkontoTermData`), `:51` (`resolveSkontoTerm`) — single source-of-truth for the cascade (consumed in D-03/D-06; not modified)
- `packages/api/src/routers/einvoice.ts` — `generateZugferd` procedure ~line 219+ (modified per D-06)
- `packages/api/src/routers/payment.ts:1213-1294` — reference cascade pattern (Prisma include shape + `resolveSkontoTerm` call); copy the include shape, do not import from this file
- `packages/api/src/services/__tests__/einvoice-finalize.test.ts` — Layer B test extension target
- `packages/api/src/routers/__tests__/einvoice.generate-zugferd.test.ts` — Layer C test extension target
- `packages/einvoice/src/profiles/xrechnung-de/__tests__/` — Layer A test target (existing profile-level test file or new one)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`buildPaymentTerms(invoice, skontoTerm)` at `xrechnung-de/generator.ts:278`** — already produces correct BG-20 with locked German phrase + structured `#SKONTO#TAGE=…#PROZENT=…#BASISBETRAG=…#` per Anhang E. **No change needed.** This is the load-bearing helper; the entire phase is about feeding it the data it expects.
- **`generateXRechnungCii(invoice, leitwegId, skontoTerm)` at `xrechnung-de/generator.ts:351`** — already accepts the third positional arg and forwards into `buildPaymentTerms`. **No change needed.**
- **`resolveSkontoTerm(invoiceTerm, profileDefault)` at `services/skonto.ts:51`** — pure function, locked source-of-truth for the cascade. **No change needed; called from two new sites.**
- **`SkontoTermInput` interface at `xrechnung-de/generator.ts:46`** — `{ discountPercent, discountPeriodDays, netPeriodDays }`. Identical shape to the consumed fields of `SkontoTermData`. **Re-exported from `xrechnung-de/index.ts` per D-01.**
- **Prisma include pattern at `payment.ts:1213-1218`** — `skontoTerms: { take: 1 }` on invoice + nested on `contractor.billingProfiles[0]`. **Copied verbatim into `loadInvoiceWithRelations`.**
- **`finalizeEInvoice` test harness at `einvoice-finalize.test.ts`** — already exercises the full Prisma → R2 → lifecycle round-trip with KoSIT validation; new test cases extend it (D-08 Layer B).

### Established Patterns

- **`api → einvoice` dependency direction** — never the reverse. Drives D-01 (don't import api types into einvoice).
- **Profile contracts symmetric across DE family** — `XRechnungDEProfile.generate` and `ZugferdDEProfile.generate` should accept the same shape of `opts` so cross-DE callers can stay format-agnostic. Drives D-05.
- **Single source-of-truth for cross-cutting business rules** — Phase 63 D-21 made `resolveSkontoTerm` the cascade rule; Phase 56 made `XRECHNUNG_SKONTO_DESCRIPTION_TEMPLATE` the locked phrase. This phase reuses both, adds nothing parallel.
- **KoSIT validator-bundle treated as a black-box pinned release** (Phase 61 D-03) — drives D-11's deferral of custom Schematron authoring.
- **Forward-only fixes for local-only deployment** (STATE.md standing constraint) — drives D-10's no-backfill stance.
- **Eager-fetch relations in service-layer Prisma loaders** (`loadInvoiceWithRelations` pattern) — drives D-03's choice to extend the existing loader rather than add a separate query.

### Integration Points

- `finalizeEInvoice` call site in `packages/api/src/routers/einvoice.ts` — already wired through Phase 61 Plan 06; no router-level signature change needed for the finalize path. The router's `generateZugferd` procedure does need an inline cascade resolution (D-06).
- `EInvoiceLifecycle.validationStatus` and `validationReportSummary` continue to populate from the existing `report` returned by `generateAndValidate` — no schema change.
- `PAY_SKONTO_ENABLED` feature flag (Phase 63 D-26) already gates SkontoTerm CRUD UI and PaymentRun preview; **the BG-20 emission is gated transitively** because no Skonto term will exist on an invoice when the flag is OFF. No new flag check inside `einvoice-finalize.ts` or `generateZugferd`.

</code_context>

<specifics>
## Specific Ideas

- "Three test layers (A unit + B finalize integration + C ZUGFeRD generate) — audit-grade, given v5.0 audit flagged I-1 as CRITICAL." (D-08)
- "`einvoice` package stays fully decoupled from `@contractor-ops/api` — match the existing dependency direction." (D-01 rationale)
- "Mirror `payment.ts:1213-1294` query shape exactly — copy the include, don't import." (D-03)
- "Park the custom Schematron rule as a deferred idea; revisit only if a regression escapes the three test layers." (D-11)

</specifics>

<deferred>
## Deferred Ideas

- **KoSIT-level Schematron assertion that BG-20 is emitted when `invoice.skontoTerms[0]` exists.** Audit `follow_up` for EINV-04 flagged this as a "consider"; not required for I-1 closure. Park as a candidate for a future hardening phase if any regression slips past the three regression test layers in this phase.
- **Migration script `scripts/refinalize-de-skonto-invoices.ts`** — defer until / unless this app ships into production with pre-existing affected lifecycle data. Standing constraint says local-only; revisit at production-cutover time.
- **`parse(xml)` round-trip assertion that BG-20 is preserved through the parser** — nice-to-have; included only if implementable in a 5-line test (Claude's Discretion).
- **`packages/einvoice/src/types/skonto.ts` public type module** — if a future phase needs a Skonto type used by both XRechnung and ZUGFeRD profile *and* by a third consumer, promote `SkontoTermInput` to a public types module then. Until then D-01's re-export is sufficient.

</deferred>

---

*Phase: 68-skonto-bg20-xrechnung-fix*
*Context gathered: 2026-04-26*
