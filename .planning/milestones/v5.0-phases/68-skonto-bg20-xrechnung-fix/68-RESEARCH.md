# Phase 68: Skonto BG-20 XRechnung Emission Fix - Research

**Researched:** 2026-04-26
**Mode:** CONTEXT.md re-validation against current code (CONTEXT-driven phase — most decisions already locked in 68-CONTEXT.md D-01..D-11)

<summary>
## What I learned

Phase 68 is a tight wiring fix. The CII-level emission (`buildPaymentTerms`, `generateXRechnungCii(invoice, leitwegId, skontoTerm)`) already produces correct BG-20 output and was test-locked in Phase 63 Plan 06. The defect is purely at the *plumbing* layer between (a) the Skonto term stored on `Invoice` / `ContractorBillingProfile` and (b) the `generateXRechnungCii` third positional argument — across two call paths (the `XRechnungDEProfile` finalize path and the `ZugferdDEProfile` PDF/A-3 generation path).

I verified every line-number / file-path / signature claim in `68-CONTEXT.md` against the v2 branch as of commit `b5610b3e` and found four small discrepancies that planners must respect (none invalidates a CONTEXT decision):

1. The tRPC mutation is named `generateZugferdPdf`, not `generateZugferd` (`einvoice.ts:234`). CONTEXT.md uses the short form in prose; the actual procedure key is `generateZugferdPdf`. **Plan 03 must use the real name** when wiring the cascade and updating the test (`einvoice.generate-zugferd.test.ts` already mocks the right symbol).
2. The XRechnung fixtures directory is `packages/einvoice/src/profiles/xrechnung-de/__tests__/fixtures/` (not `__fixtures__/` at the profile root, as CONTEXT.md says). New Skonto fixtures land in `__tests__/fixtures/`.
3. `services/skonto.ts` does **not** contain a Prisma → `SkontoTermData` mapper today (the `payment.ts:1239-1253` cascade inlines the conversion). Per CONTEXT.md D-04 Claude's Discretion + the codebase pattern, the mapper goes inline in `einvoice-finalize.ts` and inline in the `generateZugferdPdf` router procedure (each is a 6-line ternary; extracting a one-call-site helper would be premature DRY).
4. There is no `profile.test.ts` for `xrechnung-de` today. Layer A (per CONTEXT D-08) lands as a new file `packages/einvoice/src/profiles/xrechnung-de/__tests__/profile.test.ts` (the pre-existing Skonto coverage in `generator.test.ts:341-408` exercises `generateXRechnungCii` directly, NOT the profile wrapper — the wrapper is what slipped per audit I-1, so the new file specifically locks the profile-level wiring).

CONTEXT.md is otherwise an exact match — `generateXRechnungCii` arity at `generator.ts:351-355`, `buildPaymentTerms` at `:278-326`, `XRechnungGenerateOptions` at `index.ts:28-31`, `XRechnungDEProfile.generate(invoice, opts)` and `generateAndValidate(invoice, opts)` at `index.ts:49-83`, `ZugferdDEProfile.generate(invoice)` at `profile.ts:46-49`, `GenerateZugferdInput` at `generator.ts:32-48`, `generateXRechnungCii(input.invoice, leitwegId)` at `zugferd-de/generator.ts:82` (current 2-arg call — exactly the wiring gap), `loadInvoiceWithRelations` at `einvoice-finalize.ts:400-413` (current `include` lacks `skontoTerms` and `billingProfiles`), `profile.generateAndValidate(envelope, { leitwegId })` at `:246-248` (current 1-key opts — exactly the wiring gap), `resolveSkontoTerm` at `services/skonto.ts:51-56`, `SkontoTermData` at `services/skonto.ts:18-22`, the include shape at `payment.ts:1213-1222`, the cascade-resolution call at `payment.ts:1235-1255`.

</summary>

<revalidation>
## CONTEXT.md Re-validation (executed 2026-04-26)

### File / line / signature audit

| CONTEXT claim | Actual code | Status |
|---|---|---|
| `XRechnungGenerateOptions` only exposes `leitwegId` | `index.ts:28-31` — `{ leitwegId?: string \| null }` | **MATCH** — exactly the type to extend |
| `XRechnungDEProfile.generate(invoice, opts)` discards Skonto context | `index.ts:49-51` — `generateXRechnungCii(invoice, opts?.leitwegId ?? null)` (2-arg call) | **MATCH** — third arg `skontoTerm` is dropped |
| `XRechnungDEProfile.generateAndValidate` does the same | `index.ts:76-83` — delegates to `this.generate(invoice, opts)` | **MATCH** — single fix-site once `generate` is corrected |
| `einvoice-finalize.ts:246-247` calls `generateAndValidate(envelope, { leitwegId })` | `einvoice-finalize.ts:246-248` — exact match | **MATCH** |
| `loadInvoiceWithRelations` Prisma include lacks Skonto + billingProfiles | `einvoice-finalize.ts:400-413` — include is `{ lines, contractor, contract, organization }` | **MATCH** — extend to `{ ..., skontoTerms: { take: 1 }, contractor: { include: { billingProfiles: { take: 1, include: { skontoTerms: { take: 1 } } } } } }` |
| `ZugferdDEProfile.generate(invoice)` takes no opts | `profile.ts:46-49` — `generate(invoice)` only | **MATCH** — extend to `generate(invoice, opts?)` |
| `generateZugferdPdf({ invoice, leitwegId })` does not accept Skonto | `generator.ts:32-48` (`GenerateZugferdInput`) — has `leitwegId?` only | **MATCH** — add `skontoTerm?` |
| `generator.ts:82` calls `generateXRechnungCii(input.invoice, leitwegId)` | `zugferd-de/generator.ts:82` — exact 2-arg call | **MATCH** — add third arg |
| `resolveSkontoTerm` at `services/skonto.ts:51` | `services/skonto.ts:51-56` — exact match | **MATCH** — reused, not modified |
| `SkontoTermInput` at `xrechnung-de/generator.ts:46` | `generator.ts:46-50` — `{ discountPercent, discountPeriodDays, netPeriodDays }` | **MATCH** — re-export from `index.ts` per D-01 |
| `buildPaymentTerms` at `:278-326` | `generator.ts:278-334` (slightly longer body — empty branch at 332-333) | **MATCH** — no change |
| `generateXRechnungCii` 3-arg signature at `:351` | `generator.ts:351-355` | **MATCH** — no change |
| Cascade pattern at `payment.ts:1213-1294` | `payment.ts:1213-1255` (include) + 1235-1255 (mapper + resolve) | **MATCH** — copy-not-import per CONTEXT D-03 |

### Discrepancies

| CONTEXT.md says | Reality | Impact |
|---|---|---|
| Procedure called `generateZugferd` | Procedure key is `generateZugferdPdf` (`einvoice.ts:234`) | Plan 03 uses correct name when patching the procedure body |
| Fixtures live in `__fixtures__/` at profile root | Fixtures live in `__tests__/fixtures/` (sibling of test files) | New Skonto fixture lands in `__tests__/fixtures/` |
| "Test file `profile.test.ts` (or extend an existing one)" | No `profile.test.ts` exists for `xrechnung-de` | Plan 04 creates a new `profile.test.ts` (it is the cleanest break — the existing `generator.test.ts` exercises `generateXRechnungCii` directly, not the profile wrapper that slipped per audit I-1) |
| Says check during planning whether mapper exists in `services/skonto.ts` | No Prisma→`SkontoTermData` mapper exists; `payment.ts:1239-1253` inlines the conversion | Inline the 6-line ternary in `einvoice-finalize.ts` and in the `generateZugferdPdf` router procedure (DO NOT extract a helper for two callers) |

### Tests-as-validation note

CONTEXT.md does not declare a `## Validation Architecture` section because Phase 68 is a wiring fix where the *tests themselves* are the validation strategy: D-08 specifies three test layers (A unit profile, B integration finalize service, C integration ZUGFeRD route) that together prove BG-20 is emitted at every fan-out point. The KoSIT 3-layer validator (XSD → EN 16931 Schematron → XRechnung CIUS Schematron) continues to act as the runtime semantic checker; D-09 requires both fixture branches (with-Skonto + without-Skonto) to exercise it and assert `validationStatus === 'VALID'`. No separate `VALIDATION.md` is required for this phase.

</revalidation>

<implementation_notes>
## Implementation notes

### Wiring graph

```
                                        ┌─────────────────────────────────────┐
                                        │  packages/einvoice/src/profiles/    │
                                        │  xrechnung-de/generator.ts:351      │
                                        │                                     │
                                        │  generateXRechnungCii(              │
                                        │    invoice,                         │
                                        │    leitwegId,                       │
                                        │    skontoTerm? ◄─── ALREADY ACCEPTS │
                                        │  )                                  │
                                        └────────────────▲────────────────────┘
                                                         │
        ┌──────────────────────────────────────┬─────────┴───────────┐
        │                                      │                     │
┌───────┴──────────────────┐         ┌─────────┴──────┐    ┌─────────┴───────────────┐
│ XRechnungDEProfile       │         │ ZugferdDE      │    │ direct test imports     │
│ .generate(invoice, opts) │         │ generator.ts   │    │ (already pass — 3rd-arg │
│ index.ts:49 ◄── DROPS    │         │ :82 ◄── DROPS  │    │  exists since Phase 63) │
│ THE 3RD ARG (D-02 fix)   │         │ THE 3RD ARG    │    └─────────────────────────┘
└────▲─────────────────────┘         │ (D-05 fix)     │
     │                                └────▲───────────┘
     │                                     │
┌────┴────────────────────────┐    ┌───────┴─────────────────────┐
│ einvoice-finalize.ts:246    │    │ einvoice.ts:281             │
│ profile.generateAndValidate │    │ generateZugferdPdf({         │
│ (envelope, { leitwegId })   │    │   invoice: envelope,        │
│ ◄── DROPS skontoTerm        │    │ })                          │
│ FROM CALLER (D-03 fix)      │    │ ◄── DROPS skontoTerm        │
└────▲────────────────────────┘    │ FROM CALLER (D-06 fix)      │
     │                             └────▲────────────────────────┘
     │                                  │
     └──────┬───────────────────────────┘
            │
   ┌────────┴──────────────────────────┐
   │ services/skonto.ts:51             │
   │ resolveSkontoTerm(invoice, profile)│
   │ ◄── single source of cascade truth │
   │ (NOT MODIFIED — called from 2     │
   │  new sites)                       │
   └───────────────────────────────────┘
```

The fix is to plumb `skontoTerm` upward at each "DROPS" boundary and resolve the cascade at each `← DROPS skontoTerm FROM CALLER` site using the existing `resolveSkontoTerm` + the `payment.ts:1213-1255` Prisma include + mapper pattern.

### Plan decomposition

Five plans, three waves. Each plan ships its own atomic commit and the test that locks its fix.

- **Wave 1 (parallelizable, type-only foundations)**:
  - **68-01-PLAN.md** — Widen `EInvoiceProfile.generate` to `(invoice, opts?: unknown)` (D-07). Profile-interface change with zero runtime impact; KSeF / ZATCA / Peppol-AE / ZUGFeRD-DE / XRechnung-DE all keep their per-profile narrowed signatures. `tsc --noEmit` across the einvoice package and api package must pass.
  - **68-02-PLAN.md** — Re-export `SkontoTermInput` from `xrechnung-de/index.ts` and add `skontoTerm?: SkontoTermInput | null` to `XRechnungGenerateOptions` (D-01). Update `XRechnungDEProfile.generate` and `generateAndValidate` to forward `opts?.skontoTerm ?? null` as the third positional argument to `generateXRechnungCii` (D-02). Layer A test (new `profile.test.ts` per D-08 + D-09) asserts the profile-level wiring emits `<ram:SpecifiedTradePaymentTerms>` with `#SKONTO#TAGE=…#PROZENT=…#BASISBETRAG=…#` AND that `validateXRechnungCii` returns `status === 'VALID'` on both with-Skonto and without-Skonto fixtures (D-09 KoSIT 3-layer cross-check).

- **Wave 2 (depends on Wave 1 — both call sites consume the new opts)**:
  - **68-03-PLAN.md** — `einvoice-finalize.ts` cascade wiring (D-03, D-04). Extend `loadInvoiceWithRelations` Prisma include to fetch `skontoTerms: { take: 1 }` on the invoice and `contractor.billingProfiles[0].skontoTerms[0]`. Add inline `toSkontoTermData(prismaRow)` helper. Resolve `effectiveSkonto = resolveSkontoTerm(toSkontoTermData(invoice.skontoTerms[0]), toSkontoTermData(invoice.contractor?.billingProfiles[0]?.skontoTerms[0]))`. Pass `{ leitwegId, skontoTerm: effectiveSkonto }` into `profile.generateAndValidate`. Layer B test (extend `einvoice-finalize.test.ts`) asserts the `opts.skontoTerm` arg passed to the mocked profile resolves correctly across three branches: invoice-level term wins over profile-level, profile-level used when invoice-level absent, null when neither is present.
  - **68-04-PLAN.md** — `ZugferdDEProfile.generate` opts widening (D-05) + `generateZugferdPdf` `skontoTerm?` field (D-05) + `generator.ts:82` 3-arg call. The profile widening is the symmetric counterpart of Plan 02 for `ZugferdDEProfile`.

- **Wave 3 (depends on Wave 2 — router consumes the widened generator + finalize cascade pattern)**:
  - **68-05-PLAN.md** — `generateZugferdPdf` tRPC procedure cascade (D-06). Extend the existing `ctx.db.invoice.findFirst` include in `einvoice.ts:241-263` to mirror Plan 03's eager-fetch shape. Add inline `toSkontoTermData` mapper + `resolveSkontoTerm` call. Pass `{ invoice: envelope, leitwegId, skontoTerm }` to `generateZugferdPdf`. Layer C test (extend `einvoice.generate-zugferd.test.ts`) asserts `mockGenerateZugferdPdf` is called with `expect.objectContaining({ skontoTerm: <resolved-term> })` for both invoice-level and profile-level cascade branches; assertion uses the existing mock harness — no real PDF parsing required (the einvoice package's own `generator.test.ts` already proves the embedded CII contains BG-20 via `generateXRechnungCii(invoice, leitwegId, skontoTerm)`).

### Tests-as-spec, NOT tests-as-decoration

Per CONTEXT.md D-08 (audit-grade) — every plan ships its locking test in the *same atomic commit* as the fix. Reverting the fix must fail at least one new test deterministically. No plan is considered complete unless `pnpm typecheck` and the new tests pass.

### Layer C scope (D-08 Layer C clarification)

CONTEXT.md D-08 Layer C says: "parse the embedded CII out of the produced PDF/A-3, assert it contains the same BG-20 structure". The router test (`einvoice.generate-zugferd.test.ts`) mocks `generateZugferdPdf` at the boundary so end-to-end PDF parsing is impractical there. The right partition is:
- The **router test** asserts the cascade resolution + the *call shape* (router→generator boundary).
- The **einvoice package** already has end-to-end CII-content tests via `generator.test.ts:341-408` that exercise `generateXRechnungCii(invoice, leitwegId, skontoTerm)` directly. This is the same code-path ZUGFeRD invokes at `zugferd-de/generator.ts:82` once Plan 04 lands — so once Plan 04 wires the third arg through, the existing einvoice tests fully cover the embedded CII content.

If a deeper Layer C is desired (real PDF generation + extraction + BG-20 grep), it must live as a new test file in `packages/einvoice/src/profiles/zugferd-de/__tests__/` — not in the router test which boundary-mocks the generator. Per CONTEXT.md D-08 wording ("assert it contains the same BG-20 structure"), one such einvoice-package-level integration test should ship in Plan 04 alongside the generator wiring change so the wiring is provably correct end-to-end.

### Forward-only fix (D-10)

No migration script. Per `STATE.md` standing constraint, the app is local-only with no production data. Any dev fixture invoices needing corrected XML can be re-finalized via `finalizeEInvoice({ invoiceId, force: true })` through the existing public surface.

### Deferred (D-11)

KoSIT-level Schematron assertion that BG-20 is emitted when `invoice.skontoTerms[0]` is set is parked to a future hardening phase. The three test layers (Plan 02 / 03 / 05 + the einvoice-package integration in Plan 04) plus the existing KoSIT 3-layer validation (which D-09 cross-checks against `'VALID'`) provide audit-grade coverage. A custom Schematron would mean authoring a hand-rolled `.sch`, recompiling via `scripts/recompile-kosit-schematron.ts`, and shipping a non-bundled XSLT alongside the pinned KoSIT artifacts — that breaks the Phase 61 D-03 invariant of treating the KoSIT validator-bundle as a black-box pinned release.

</implementation_notes>

<final_scope>
## Final Phase 68 scope

5 plans, 3 waves:

| Wave | Plan | Deliverable | Locks |
|---|---|---|---|
| 1 | **68-01** | `EInvoiceProfile.generate(invoice, opts?: unknown)` widening (D-07) | Type-level. No runtime change. `tsc --noEmit` clean across einvoice + api. |
| 1 | **68-02** | `XRechnungGenerateOptions.skontoTerm` + `SkontoTermInput` re-export (D-01); `XRechnungDEProfile.generate` + `generateAndValidate` forward to `generateXRechnungCii` 3rd arg (D-02); Layer A profile test (D-08 A); D-09 fixture pair (with/without Skonto) hitting KoSIT 3-layer | Profile-level wiring. New `profile.test.ts`, new `__tests__/fixtures/skonto-invoice.json` + `skonto-invoice.xml` golden file. |
| 2 | **68-03** | `loadInvoiceWithRelations` include extension + inline `toSkontoTermData` + `resolveSkontoTerm` cascade in `finalizeEInvoice` (D-03, D-04); Layer B test (D-08 B) extending `einvoice-finalize.test.ts` with three cascade branches (invoice-wins, profile-default, neither) | Finalize-service plumbing. |
| 2 | **68-04** | `ZugferdDEProfile.generate(invoice, opts?)` (D-05); `GenerateZugferdInput.skontoTerm?` (D-05); `generator.ts:82` 3-arg call; einvoice-package integration test that generates a ZUGFeRD PDF, extracts the CII, asserts it contains `#SKONTO#TAGE=…#PROZENT=…#BASISBETRAG=…#` (the deeper end of D-08 C) | ZUGFeRD plumbing + provable embedded-CII BG-20 emission. |
| 3 | **68-05** | `generateZugferdPdf` tRPC procedure (`einvoice.ts:234-301`) include extension + inline cascade + `generateZugferdPdf({ ..., skontoTerm })` call (D-06); Layer C router test (D-08 C, router half) extending `einvoice.generate-zugferd.test.ts` with three cascade branches against the mocked generator | Router-level cascade resolution. |

**Phase exit gate (per CONTEXT D-08 audit-grade requirement):**

- `pnpm typecheck` (or `tsc --noEmit` package-by-package) clean.
- All five new / extended test files pass: `xrechnung-de/__tests__/profile.test.ts`, `xrechnung-de/__tests__/generator.test.ts` (existing — no regression), `services/__tests__/einvoice-finalize.test.ts`, `zugferd-de/__tests__/<new-or-extended>.test.ts`, `routers/__tests__/einvoice.generate-zugferd.test.ts`.
- KoSIT 3-layer validation passes for both fixture branches (D-09).
- `git log --oneline | head -5` shows five `fix(68-NN):` atomic commits.
- The v5.0 audit's I-1 finding can flip from `CRITICAL OPEN` to `RESOLVED — covered by tests TBD-list`.

</final_scope>

<pitfalls>
## Pitfalls / landmines

1. **Don't import `SkontoTermInput` from `services/skonto.ts` into `einvoice/`.** Project convention is `api → einvoice`, never reverse. CONTEXT.md D-01 locks `SkontoTermInput` as an einvoice-side public type re-exported via `xrechnung-de/index.ts`. The api caller maps `SkontoTermData → SkontoTermInput` inline (the two interfaces are structurally identical so no runtime conversion is needed — only a TS type-cast / explicit object construction).

2. **Don't extract a `toSkontoTermData(row)` helper into `services/skonto.ts` "for DRY"** — there are exactly 3 call sites today (`payment.ts` already inlined; `einvoice-finalize.ts` adds one; `einvoice.ts` adds one). All 3 inline the same 6-line ternary with the `Number(prisma.discountPercent)` Decimal-to-number conversion. Extracting it to `services/skonto.ts` for two callers is premature DRY (per CONTEXT.md D-04 Claude's Discretion).

3. **`Decimal → number` conversion at the Prisma boundary.** `Invoice.SkontoTerm.discountPercent` is `Decimal` in Prisma; `SkontoTermInput.discountPercent` is `number`. The mapper MUST do `Number(row.discountPercent)`. Forgetting this returns a `Decimal` that then gets template-string-interpolated into the XML, emitting `#PROZENT=Decimal(3.00)#` instead of `#PROZENT=3.00#`. Existing `payment.ts:1241,1249` shows the exact pattern.

4. **`{ take: 1 }` on the `skontoTerms` relation matters.** Without the `take: 1`, Prisma returns a full array and the `[0]` access works the same way — but the query becomes a full table scan on `SkontoTerm` for every invoice load. The `take: 1` constraint matches the schema-level XOR invariant from Phase 63 D-20 (at most one term per invoice, at most one per billing profile) and makes the query plan O(1).

5. **Don't add a `PAY_SKONTO_ENABLED` flag check inside `einvoice-finalize.ts` or the `generateZugferdPdf` router procedure.** The flag (Phase 63 D-26) gates the SkontoTerm CRUD UI and PaymentRun preview. When the flag is OFF, no SkontoTerm rows exist on invoices, so the cascade resolves to `null` and no BG-20 is emitted — that's the correct, transitively-gated behaviour. Adding an explicit flag check duplicates flag-state in two unrelated layers and creates a drift hazard.

6. **Procedure name in Plan 03's modification site is `finalizeEInvoice`** (not "finalize" as CONTEXT.md sometimes shortens it); Plan 05's tRPC procedure is `generateZugferdPdf` (NOT `generateZugferd`). The test file is `einvoice.generate-zugferd.test.ts` (CONTEXT line 114 has it correct).

7. **Layer A's KoSIT validation cross-check (D-09) can be slow** — the einvoice package's `validateXRechnungCii` runs three Schematron transforms and can take 1-3 seconds per invocation. Run only the with-Skonto and without-Skonto branches through KoSIT in Layer A; do NOT add a KoSIT-validation assertion to Layer B (mocked profile harness) or Layer C (mocked generator harness).

8. **`profile.test.ts` must actually call `XRechnungDEProfile.generate(invoice, { skontoTerm })`** — calling `generateXRechnungCii` directly only re-tests Phase 63 D-23 work (already covered in `generator.test.ts:341-408`) and would NOT have caught audit I-1. The point is to lock the `index.ts` wrapper that drops the third argument today.

</pitfalls>

<references>
## References

- CONTEXT.md (this phase) — `.planning/phases/68-skonto-bg20-xrechnung-fix/68-CONTEXT.md`
- ROADMAP.md §"Phase 68: Skonto BG-20 XRechnung Emission Fix"
- v5.0 milestone audit §I-1 (CRITICAL), §F-4 BROKEN, §EINV-01/02/04/PAY-04 partials
- Phase 61 CONTEXT.md (D-01..D-04) — XRechnungDEProfile + KoSIT validator-bundle layout
- Phase 62 CONTEXT.md — ZUGFeRD reuses `generateXRechnungCii` for embedded CII
- Phase 63 CONTEXT.md (D-20..D-26) — SkontoTerm Prisma model, cascade rule, locked German phrase template, `PAY_SKONTO_ENABLED` flag
- Existing reference cascade: `packages/api/src/routers/payment.ts:1213-1255`
- Existing 3-arg generator: `packages/einvoice/src/profiles/xrechnung-de/generator.ts:351-355`
- Existing BG-20 helper: `packages/einvoice/src/profiles/xrechnung-de/generator.ts:278-334`
- Existing cascade resolver: `packages/api/src/services/skonto.ts:51-56`

</references>

---

*Phase: 68-skonto-bg20-xrechnung-fix*
*Research executed: 2026-04-26*
