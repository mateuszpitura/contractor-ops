# Phase 51: PDPL Compliance - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Add jurisdiction-specific privacy controls for UAE and Saudi organizations. Covers privacy notices, granular per-purpose consent management with auditable records, template-based DPA and standard contractual clause PDF generation, and blocking consent step in the org onboarding wizard.

</domain>

<decisions>
## Implementation Decisions

### Privacy Notices & Consent
- **D-01:** Granular per-purpose consent toggles — each data processing purpose (contractor data processing, analytics, cross-border transfer, etc.) has its own toggle. Users accept/reject individually. PDPL requires purpose-specific consent.
- **D-02:** `ConsentRecord` Prisma table — dedicated table with user_id, purpose, granted (bool), version, granted_at, revoked_at. Immutable append-only: revocations create new records, never update existing ones. Queryable for compliance audits.

### Legal Document Generation
- **D-03:** Template-based PDF generation — Markdown/HTML templates per jurisdiction with org-specific data merged in (org name, address, country, processing purposes). Rendered to PDF via React-PDF. Templates versioned in code for change tracking.

### Onboarding Integration
- **D-04:** Blocking "Privacy & Compliance" step in the org setup wizard — appears AFTER country selection. UAE/Saudi orgs must accept required processing purposes before proceeding. Shows jurisdiction-specific privacy notice + consent toggles. Only required purposes block; optional purposes can be managed later in settings.

### Claude's Discretion
- Data processing purpose taxonomy (which purposes per jurisdiction)
- Privacy notice content structure per jurisdiction
- ConsentRecord schema details (indexes, version tracking)
- DPA and SCC template content structure
- Settings page layout for consent management post-onboarding
- Cross-border transfer detection logic (org jurisdiction vs data hosting region)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior phase context
- `.planning/phases/47-vat-engine-wht-calculator-country-fields/47-CONTEXT.md` — D-06: countryFields JSONB, org country setting
- `.planning/phases/52-multi-region-infrastructure` — (future) data residency and region routing

### Existing infrastructure
- Org setup wizard — add blocking consent step
- Audit log system — reference for immutable record patterns
- React-PDF — if used for WHT certificates (Phase 47 D-05), reuse for DPAs

### Requirements
- `.planning/REQUIREMENTS.md` — PDPL-01 through PDPL-04

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Org setup wizard — extensible with new steps
- Existing audit log pattern — reference for immutable ConsentRecord
- React-PDF (if added in Phase 47 for WHT certs) — reuse for DPA generation
- Organization model with country setting — drives jurisdiction detection

### Established Patterns
- Zod schema validation at boundaries
- Settings page sections — add Privacy & Consent section
- Prisma model patterns — append-only tables

### Integration Points
- Org setup wizard — new blocking consent step after country selection
- Settings page — consent management section
- Organization model — jurisdiction detection from country
- Phase 52 multi-region — cross-border transfer detection

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 51-pdpl-compliance*
*Context gathered: 2026-04-11*
