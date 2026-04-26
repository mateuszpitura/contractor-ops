# Phase 53: Peppol QR Persistence & Consent Onboarding Gate - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-12
**Phase:** 53-peppol-qr-persistence-consent-onboarding-gate
**Areas discussed:** QR persistence strategy, Consent onboarding gating, QR display behavior

---

## QR Persistence Strategy

### When to generate QR

| Option | Description | Selected |
|--------|-------------|----------|
| At submission time | Generate QR during async QStash Peppol submission flow. Store base64 on Invoice row. Consistent with ZATCA pattern. | ✓ |
| On first view | Generate lazily when user opens invoice detail. Cache to DB. Avoids upfront compute but adds latency. | |
| You decide | Claude picks during planning | |

**User's choice:** At submission time
**Notes:** None

### Backfill for existing invoices

| Option | Description | Selected |
|--------|-------------|----------|
| Backfill migration | Re-generate QR codes for all existing Peppol invoices. One-time operation during deployment. | |
| Generate on next view | If qrCodeBase64 is null, generate on detail page load. No migration needed. | |
| No backfill | Only new invoices get QR codes. | |

**User's choice:** N/A — no existing Peppol invoices yet
**Notes:** User clarified there are no existing Peppol invoices in production, so no backfill is needed.

---

## Consent Onboarding Gating

### Completion verification

| Option | Description | Selected |
|--------|-------------|----------|
| Server-side check | Checklist queries hasRequiredConsents() instead of metadata flag. Can't be bypassed. | |
| Metadata + server validation | Keep metadata tracking, add server-side guard when proceeding. Belt and suspenders. | ✓ |
| You decide | Claude picks during planning | |

**User's choice:** Metadata + server validation
**Notes:** None

### Consent step UX

| Option | Description | Selected |
|--------|-------------|----------|
| Inline in checklist | Render OnboardingConsentStep directly within checklist card. No navigation needed. | ✓ |
| Link to settings | Keep current behavior — link to /settings?tab=privacy | |
| Modal overlay | Show in dialog/modal when clicking the step | |

**User's choice:** Inline in checklist
**Notes:** None

### Step visibility

| Option | Description | Selected |
|--------|-------------|----------|
| PDPL only | Use isPdplJurisdiction() to conditionally include step. Non-Gulf orgs skip it. | ✓ |
| Always show, auto-complete for non-PDPL | Show for all orgs, auto-mark complete for non-PDPL. | |

**User's choice:** PDPL only
**Notes:** None

---

## QR Display Behavior

### Display locations

| Option | Description | Selected |
|--------|-------------|----------|
| Detail view only | Keep QR only on invoice detail page. PDF/print are future enhancements. | ✓ |
| Detail + print layout | Include QR in browser print stylesheet | |
| Detail + PDF export | Include QR in PDF generation pipeline | |

**User's choice:** Detail view only
**Notes:** None

---

## Claude's Discretion

- Prisma migration naming and field placement
- QStash pipeline integration point for QR generation
- Conditional filtering of ONBOARDING_STEPS based on jurisdiction
- Server-side validation implementation approach

## Deferred Ideas

None — discussion stayed within phase scope
