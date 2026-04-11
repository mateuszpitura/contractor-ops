# Phase 48: ZATCA Fatoorah Integration - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement ZATCA (Saudi Arabia) as the second country profile in the e-invoicing engine. Covers device onboarding (CSR → compliance CSID → production certificate), XAdES enveloped digital signatures, TLV-encoded QR codes, invoice hash chain maintenance, and submission to the Fatoora Portal for clearance (B2B tax invoices) and reporting (B2C simplified invoices).

</domain>

<decisions>
## Implementation Decisions

### Device Onboarding
- **D-01:** Multi-step wizard in Settings > Integrations > ZATCA. Steps: 1) Enter org tax details (VAT number, address), 2) Generate CSR, 3) Submit to ZATCA for compliance CSID, 4) Run compliance checks against sandbox, 5) Exchange for production certificate. Progress saved between steps.
- **D-02:** Certificates stored in external SaaS secret manager (Infisical or Doppler) — NOT in the DB. Purpose-built for per-tenant secrets with API access, rotation support, and audit logging. This is a deviation from the KSeF credential pattern (which uses AES-256-GCM in DB).

### Cryptographic Pipeline
- **D-03:** Sequential queue per organization for invoice signing. Use a per-org mutex (DB advisory lock or QStash FIFO) to ensure each invoice waits for the previous one to be signed and hashed before proceeding. ZATCA spec requires sequential hash chain ordering — no shortcuts.
- **D-04:** XAdES enveloped signatures and TLV QR code encoding built on xmlbuilder2 + xml-crypto directly (per STATE.md: no ZATCA JS libraries). Implement as the Signable and QRCodeable capability hooks from Phase 45's engine architecture.

### Submission & Status Tracking
- **D-05:** Async submission via QStash queue. Invoice creation triggers a QStash job that: signs → computes hash chain → generates QR → submits to ZATCA → records response. Consistent with existing fire-and-forget pattern.
- **D-06:** Per-invoice ZATCA status tracking: pending → submitted → cleared (B2B) / reported (B2C) / rejected. Status visible in invoice detail view and compliance dashboard widget.

### Sandbox & Testing
- **D-07:** Environment flag per ZATCA connection (sandbox or production). Sandbox uses ZATCA's sandbox API endpoints and test certificates. Same code path, different config. Matches existing KSeF environment enum pattern (`z.enum(["test", "prod"])`).

### Claude's Discretion
- CSR generation implementation details (key pair generation, X.509 attribute configuration)
- XAdES signature canonicalization and digest algorithms
- TLV encoding format for QR code data (Tag-Length-Value binary encoding)
- Invoice hash chain storage model (where to persist last hash per org)
- ZATCA API error handling and retry strategies within QStash
- Compliance check flow during onboarding (which test invoices to submit)
- Infisical vs Doppler selection (evaluate both during research)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### E-invoicing engine (from Phase 45)
- `packages/einvoice/src/types/profile.ts` — EInvoiceProfile interface, Signable, QRCodeable capability hooks
- `packages/einvoice/src/types/invoice.ts` — Core EInvoice model with tax/currency fields
- `packages/einvoice/src/schemas/invoice.ts` — Invoice validation schemas

### Existing integration patterns
- `packages/validators/src/ksef.ts` — KSeF environment enum (test/prod) as reference pattern
- `packages/integrations/src/adapters/ksef-adapter.ts` — KsefAdapter as reference for ZATCA adapter structure

### Prior phase context
- `.planning/phases/45-pluggable-e-invoicing-engine-core/45-CONTEXT.md` — D-01: Engine in packages/einvoice, D-07: Signable/QRCodeable hooks
- `.planning/phases/47-vat-engine-wht-calculator-country-fields/47-CONTEXT.md` — D-01: DB-driven TaxRate with Saudi 15%

### Requirements
- `.planning/REQUIREMENTS.md` — ZATCA-01 through ZATCA-07

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/einvoice` — Engine package with profile interface (Phase 45)
- QStash integration — reusable for async invoice submission
- `encryptCredentials` / `decryptCredentials` — reference pattern (though D-02 moves to external store)
- KSeF environment enum pattern — reusable for ZATCA sandbox/prod toggle
- Integration health monitoring via IntegrationSyncLog

### Established Patterns
- Fire-and-forget async processing via QStash
- IntegrationConnection model for connection state
- IntegrationSyncLog for audit trail
- Per-provider credential encryption (being replaced with external store for ZATCA)

### Integration Points
- `packages/einvoice` — ZATCA profile implements EInvoiceProfile + Signable + QRCodeable
- Settings > Integrations page — ZATCA onboarding wizard
- Invoice detail view — ZATCA submission status display
- Compliance dashboard widget — ZATCA clearance/reporting status
- QStash — async invoice submission jobs

</code_context>

<specifics>
## Specific Ideas

- External secret store (Infisical/Doppler) for certificates is a new infrastructure dependency — research should evaluate both and recommend one
- STATE.md blocker: "ZATCA CSD certificates require procurement (paid) — initiate before Phase 48" — ensure onboarding wizard handles the procurement flow guidance

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 48-zatca-fatoorah-integration*
*Context gathered: 2026-04-11*
