# Phase 62: ZUGFeRD E-Invoicing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `62-CONTEXT.md` — this log preserves the discussion path.

**Date:** 2026-04-15
**Phase:** 62-zugferd-e-invoicing
**Mode:** discuss (interactive, 4 areas)

## Gray Areas Presented

| # | Area | User selected |
|---|------|---------------|
| 1 | Profile layout & PDF/A-3 pipeline | ✓ |
| 2 | veraPDF validation gate | ✓ |
| 3 | Inbound sources & intake lifecycle | ✓ |
| 4 | Validation, matching, storage | ✓ |

All four selected.

## Area 1 — Profile layout & PDF/A-3 pipeline

| Question | User choice |
|----------|-------------|
| Where should ZUGFeRD code live relative to xrechnung-de? | New profile `zugferd-de/` (sibling to xrechnung-de/, reuses CII generator) |
| Which ZUGFeRD conformance levels do we support? | Generate COMFORT only; inbound parser accepts COMFORT + XRECHNUNG + EXTENDED; rejects MINIMUM/BASIC WL |
| PDF/A-3 generation pipeline? | React-PDF visual → pdf-lib post-process (XMP + attachment + OutputIntent + font embedding) |

## Area 2 — veraPDF validation gate

| Question | User choice |
|----------|-------------|
| Where does veraPDF validation run? | CI-only Docker gate via `verapdf/cli` — no runtime JVM on Render |
| Golden fixture strategy | 3 scenarios: minimal COMFORT, reverse-charge + Leitweg-ID, Kleinunternehmer |
| How is the report surfaced on failure? | CI prints first 40 failing rules + uploads full XML as 30-day artifact |

## Area 3 — Inbound sources & intake lifecycle

| Question | User choice |
|----------|-------------|
| What inbound sources for v5.0? | Manual upload only (.xml + .pdf drop-zone); email + Peppol polling deferred |
| Entity produced by parser | New `InvoiceIntakeRequest` staging entity — no `Invoice` row until explicit convert |
| Auto-matching to Contractor/Contract | Heuristic ranked candidates (VAT ID → Leitweg-ID → name fuzzy), user confirms |

## Area 4 — Validation, matching, storage

| Question | User choice |
|----------|-------------|
| KoSIT validation on inbound failure | Soft-gate: WARNINGS status + block convert until explicit "Accept despite issues" click; hard reject XSD (layer-1) failures |
| Where does upload UI live? | Invoices list split-button "Import" + dedicated `/invoices/intake` route |
| R2 storage + retention | Content-addressed, same pattern as outbound, indefinite retention (cross-domain retention policy deferred) |

## Summary

- 13 explicit decisions captured (D-01 through D-13 in CONTEXT.md), plus D-14–D-17 for UI surfaces, storage layout, and tRPC router.
- Phase 61 XRechnung CII generator + KoSIT validator reused verbatim (no fork).
- Staging `InvoiceIntakeRequest` entity decouples untrusted inbound data from the `Invoice` table until human confirmation.
- PDF/A-3 conformance treated as a CI-time engineering contract (veraPDF Docker gate), not a user-visible compliance state.
- Import feature gated behind `EINVOICE_IMPORT_ENABLED` feature flag per project feature-flag strategy.
- No scope creep — Peppol inbound, email intake, retention policies, and OCR-for-scans all deferred.
- Zero todos folded (`gsd-tools todo match-phase 62` = 0 matches).
