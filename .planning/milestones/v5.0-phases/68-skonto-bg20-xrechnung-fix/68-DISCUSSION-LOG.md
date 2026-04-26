# Phase 68: Skonto BG-20 XRechnung Emission Fix - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-26
**Phase:** 68-skonto-bg20-xrechnung-fix
**Areas discussed:** Profile options API shape, ZUGFeRD propagation surface, Regression test scope + backfill, KoSIT Schematron assertion

---

## Profile options API shape

### Q1 — XRechnungGenerateOptions Skonto field type

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse `SkontoTermInput` from `generator.ts` | Re-export from `xrechnung-de/index.ts` and add to `XRechnungGenerateOptions`; einvoice stays decoupled from `@contractor-ops/api`; caller maps `SkontoTermData → SkontoTermInput` inline. | ✓ |
| Export a public `SkontoTerm` type from einvoice | Promote to `packages/einvoice/src/types/skonto.ts`; both generator.ts and the new options field import it. | |
| Accept `SkontoTermData` from `services/skonto.ts` | Forces einvoice to depend on the api package — violates current dependency direction. | |

**User's choice:** Reuse `SkontoTermInput` from `generator.ts`.
**Notes:** Locks in the existing dependency direction `api → einvoice`; zero new types; mapping happens at the only caller (einvoice-finalize).

### Q2 — Cascade resolution placement in `einvoice-finalize.ts`

| Option | Description | Selected |
|--------|-------------|----------|
| Inline in `einvoice-finalize.ts` (mirror `payment.ts` pattern) | Add `skontoTerms` include to `loadInvoiceWithRelations`; call `resolveSkontoTerm` from `services/skonto.ts` inline; ~15 LOC change. | ✓ |
| Extract `resolveSkontoTermForInvoice` helper | New `services/skonto-for-invoice.ts` taking `(db, organizationId, invoiceId) → SkontoTermData | null`; both `payment.ts` and `einvoice-finalize.ts` call it. | |

**User's choice:** Inline in `einvoice-finalize.ts`.
**Notes:** `resolveSkontoTerm` from `services/skonto.ts:51` stays the single source-of-truth for the cascade rule established in Phase 63 D-21 — no new resolver helper.

---

## ZUGFeRD propagation surface

### Q3 — How the Skonto term reaches the ZUGFeRD embedded-CII path

| Option | Description | Selected |
|--------|-------------|----------|
| Add opts to `ZugferdDEProfile.generate` + extend `GenerateZugferdInput` | Symmetric with `XRechnungDEProfile` contract; thread `skontoTerm` through `generateZugferdPdf` to `generateXRechnungCii` at `zugferd-de/generator.ts:82`. | ✓ |
| Patch `generateZugferdPdf` only + update `einvoice.ts` router caller | Leave `ZugferdDEProfile.generate(invoice)` untouched; resolve + pass at the router caller. | |
| Share a resolved-skonto cache via the call site | Per-request struct shared between `finalizeEInvoice` and `generateZugferd` procedures. | |

**User's choice:** Add opts to `ZugferdDEProfile.generate` + extend `GenerateZugferdInput`.
**Notes:** Symmetric DE profile contracts make the wiring obvious for the next person.

### Q4 — Where to invoke cascade resolution from the ZUGFeRD generate path

| Option | Description | Selected |
|--------|-------------|----------|
| Resolve in the `einvoice.ts` router (`generateZugferd` procedure) | Mirror the `einvoice-finalize.ts` placement; cascade lives close to data fetch. | ✓ |
| Resolve inside the ZUGFeRD service layer | New thin wrapper service `generateZugferdForInvoice(invoiceId)` that does Prisma fetch + cascade + generate. | |

**User's choice:** Resolve in the `einvoice.ts` router.
**Notes:** Avoids a thin wrapper service for a single caller; matches the finalize-service pattern.

### Q5 — `EInvoiceProfile.generate` signature widening

| Option | Description | Selected |
|--------|-------------|----------|
| Widen the interface to `generate(invoice, opts?: unknown)` | Update `packages/einvoice/src/types/profile.ts`; each profile narrows opts; KSeF/ZATCA/Peppol-AE keep ignoring opts (zero behavior change). | ✓ |
| Use a profile-specific subtype assertion at call sites | Cast to `XRechnungDEProfile`/`ZugferdDEProfile` based on profileId. | |
| Add a separate `generateWithOpts` method only on DE profiles | Parallel method on subset of profiles; callers branch on profileId. | |

**User's choice:** Widen the interface to `generate(invoice, opts?: unknown)`.
**Notes:** Interface widening with optional arg has zero behavior impact on the three profiles that don't consume opts; keeps the contract symmetric.

---

## Regression test scope + backfill

### Q6 — Test layer combination

| Option | Description | Selected |
|--------|-------------|----------|
| All three layers (A unit + B finalize integration + C ZUGFeRD generate) | Audit-grade. Locks profile-level wiring + finalize cascade + ZUGFeRD-specific path with KoSIT validation on both branches. | ✓ |
| Layers B + C only (skip the unit layer) | Trust existing `buildPaymentTerms` unit tests for BG-20 string formatting. | |
| Layer B only (single end-to-end finalize test) | Trust ZUGFeRD inheritance via shared generator. | |

**User's choice:** All three layers.
**Notes:** v5.0 audit flagged I-1 as CRITICAL; redundancy at three layers prevents the same wiring regression from slipping through cross-phase verification gaps that caused I-1 in the first place.

### Q7 — Historical lifecycle backfill

| Option | Description | Selected |
|--------|-------------|----------|
| Forward-only — no migration script | Standing constraint: app local-only, no production data; rely on `force=true` re-finalize for any dev fixtures. | ✓ |
| Ship a one-shot migration script | `scripts/refinalize-de-skonto-invoices.ts` to re-finalize affected lifecycle rows. | |
| Document a manual re-finalize procedure in `68-SUMMARY.md` | No script and no code; just a procedural note. | |

**User's choice:** Forward-only — no migration script.
**Notes:** Matches local-only standing constraint; script deferred to production-cutover time if ever needed.

---

## KoSIT Schematron assertion (audit follow-up)

### Q8 — Custom validator-side assertion

| Option | Description | Selected |
|--------|-------------|----------|
| Defer to a follow-up phase | Audit marked it "consider", not required to close I-1; three test layers + KoSIT 3-layer validation provide strong coverage. Custom Schematron breaks Phase 61 D-03 black-box pinned-bundle invariant. | ✓ |
| Add a TypeScript-side post-validation assertion (not Schematron) | Catches wiring regressions without touching the KoSIT bundle; requires plumbing skonto context through validate path. | |
| Author a custom Schematron + recompile via existing script | Most rigorous; highest cost; touches the KoSIT artifact pipeline. | |

**User's choice:** Defer to a follow-up phase.
**Notes:** Parked in Deferred Ideas; revisit only if a regression escapes the three regression test layers.

---

## Claude's Discretion

- Exact location of the `toSkontoTermData(prismaRow)` helper.
- Naming of the new fixture file in `xrechnung-de/__fixtures__/`.
- Whether the Layer B finalize-service test reuses the existing invoice factory or adds a new one.
- Whether to add a `parse(xml)` round-trip BG-20 preservation assertion.
- Whether the `EInvoiceProfile.generate` widening uses a generic type parameter or plain `unknown`.

## Deferred Ideas

- KoSIT-level Schematron assertion that BG-20 is emitted when `invoice.skontoTerms[0]` exists (audit follow-up).
- Migration script `scripts/refinalize-de-skonto-invoices.ts` (until production cutover).
- `parse(xml)` round-trip assertion (Claude's Discretion gate).
- `packages/einvoice/src/types/skonto.ts` public type module (if a future third consumer arrives).
