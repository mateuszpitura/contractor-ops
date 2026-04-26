# Phase 53: Peppol QR Persistence & Consent Onboarding Gate - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Close two gaps from the v4.0 audit: (1) persist Peppol QR codes in the Invoice database model so they display on the invoice detail page, and (2) enforce PDPL consent as a blocking step in the onboarding checklist for Gulf jurisdictions (UAE, Saudi Arabia).

</domain>

<decisions>
## Implementation Decisions

### QR Persistence Strategy
- **D-01:** Add `qrCodeBase64` nullable String field to the Invoice Prisma model. Generate and store QR code during the async QStash Peppol submission flow (alongside XML generation), using `PeppolAEQRCode.generateQR()`. Persist the base64-encoded PNG on the Invoice row.
- **D-02:** No backfill migration needed — no existing Peppol invoices in production yet. Field is nullable; old invoices simply have null.

### Consent Onboarding Gating
- **D-03:** Dual gating approach — keep metadata-based `onboardingCompletedSteps` tracking for UX progress, plus add server-side validation via `hasRequiredConsents()` when proceeding past the consent step. Belt and suspenders: metadata tracks progress, server validates truth.
- **D-04:** Render `OnboardingConsentStep` inline within the onboarding checklist card. User completes consent without navigating away from the dashboard. No link to settings page needed during onboarding.
- **D-05:** The `privacy-consent` step only appears for PDPL jurisdictions (UAE/Saudi). Use `isPdplJurisdiction()` to conditionally include the step in the checklist. Non-Gulf orgs never see it — consistent with `OnboardingConsentStep`'s existing jurisdiction guard.

### QR Display Behavior
- **D-06:** QR code displays only on the invoice detail page (existing `PeppolQRDisplay` component). PDF export and print layout are future enhancements, not in scope for this phase.

### Claude's Discretion
- Prisma migration naming and field placement within Invoice model
- Exact integration point in the QStash Peppol submission pipeline for QR generation
- How to conditionally filter ONBOARDING_STEPS based on jurisdiction
- Server-side validation implementation (tRPC middleware vs inline check)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Peppol QR code
- `packages/einvoice/src/profiles/peppol-ae/qr-code.ts` — PeppolAEQRCode class with generateQR() and parseQR()
- `packages/einvoice/src/types/profile.ts` — QRCodeable interface definition
- `apps/web/src/components/peppol/peppol-qr-display.tsx` — PeppolQRDisplay component (already renders when qrCodeBase64 exists)
- `apps/web/src/app/[locale]/(dashboard)/invoices/[id]/page.tsx` — Invoice detail page, already checks invoice.qrCodeBase64

### PDPL consent
- `apps/web/src/components/consent/onboarding-consent-step.tsx` — OnboardingConsentStep with privacy notice + consent toggles
- `packages/api/src/services/consent-record.ts` — hasRequiredConsents(), bulkGrantConsent() service functions
- `packages/validators/src/consent.ts` — isPdplJurisdiction(), REQUIRED_PURPOSES, OPTIONAL_PURPOSES
- `packages/api/src/routers/consent.ts` — consent tRPC router (bulkGrant, getPrivacyNotice)

### Onboarding checklist
- `apps/web/src/components/onboarding/onboarding-checklist.tsx` — ONBOARDING_STEPS array, metadata-based completion tracking

### Prisma schema
- `packages/db/prisma/schema/invoice.prisma` — Invoice model (needs qrCodeBase64 field added)

### Requirements
- `.planning/REQUIREMENTS.md` — PEPPOL-04, PDPL-03, PDPL-04

### Prior phase context
- `.planning/phases/49-peppol-pint-ae-integration/49-CONTEXT.md` — D-05: QRCodeable interface, D-03: async QStash submission
- `.planning/phases/51-pdpl-compliance/51-CONTEXT.md` — D-04: blocking consent step in onboarding wizard

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PeppolAEQRCode` class — fully implemented QR generation, just needs to be called during submission
- `PeppolQRDisplay` component — already renders QR on invoice detail, ready to use once data is persisted
- `OnboardingConsentStep` component — full consent UI with toggles, privacy notice, and bulkGrant mutation
- `hasRequiredConsents()` service — server-side consent validation, ready to wire into onboarding flow
- `isPdplJurisdiction()` validator — jurisdiction detection for conditional step rendering

### Established Patterns
- Async QStash pipeline for Peppol submission (Phase 49 pattern) — QR generation slots in here
- Metadata-based onboarding completion tracking via `settings.metadata.onboardingCompletedSteps`
- Conditional rendering based on jurisdiction (existing pattern in OnboardingConsentStep)

### Integration Points
- QStash Peppol submission handler — add QR generation + Invoice update after XML generation
- Onboarding checklist ONBOARDING_STEPS — conditionally include privacy-consent step
- Invoice detail page — already wired, just needs data

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

*Phase: 53-peppol-qr-persistence-consent-onboarding-gate*
*Context gathered: 2026-04-12*
