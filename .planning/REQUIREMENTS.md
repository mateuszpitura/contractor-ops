# Requirements: Contractor Ops

**Defined:** 2026-03-23
**Core Value:** The invoice-to-payment flow must work end-to-end: invoice arrives, gets matched to contract, routed through approval, and batched for payment — with full audit trail.

## v2.0 Requirements

Requirements for v2.0 Platform Expansion. Each maps to roadmap phases.

### Integration Framework

- [ ] **INTG-01**: Admin can connect third-party services via OAuth 2.0 with encrypted token storage
- [ ] **INTG-02**: System receives and routes webhooks from external services (Jira, DocuSign, Autenti, KSeF)
- [ ] **INTG-03**: Admin can view integration connection health and sync status per provider

### Contractor Portal

- [ ] **PORT-01**: Contractor can log in via magic link with org-scoped access
- [ ] **PORT-02**: Contractor can view own active contracts and terms (read-only)
- [ ] **PORT-03**: Contractor can submit invoices via portal that enter org's intake pipeline
- [ ] **PORT-04**: Contractor can track invoice and payment status through approval and payment
- [ ] **PORT-05**: Contractor can view and download own documents (contracts, NDAs, tax forms)
- [ ] **PORT-06**: Contractor can edit own profile (bank details, tax info, contact) with org approval
- [ ] **PORT-07**: Contractor can configure notification email preferences
- [ ] **PORT-08**: Portal displays org branding (logo, colors, custom subdomain/path)

### Time Tracking

- [ ] **TIME-01**: Contractor can log hours manually in portal (date, hours, project/task, description)
- [ ] **TIME-02**: Manager can review and approve/reject submitted time entries
- [ ] **TIME-03**: System can import time entries from Clockify via API
- [ ] **TIME-04**: System can import worklogs from Jira issues assigned to contractor
- [ ] **TIME-05**: System compares approved hours against invoice amount and flags deviations

### E-Sign

- [ ] **SIGN-01**: User can send a contract or NDA for signature via DocuSign or Autenti
- [ ] **SIGN-02**: Signer can sign documents within Contractor Ops (embedded/redirect flow)
- [ ] **SIGN-03**: Contracts support multi-party signing (contractor + org rep) in defined order
- [ ] **SIGN-04**: Signed PDF is auto-saved to document management with signature audit trail

### OCR Invoice Parsing

- [ ] **OCR-01**: System auto-extracts fields (NIP, invoice number, date, amount, line items) from uploaded PDF
- [ ] **OCR-02**: Extracted fields display confidence scores per field
- [ ] **OCR-03**: User can review OCR results in side-by-side view (PDF + extracted fields with edit-in-place)

### KSeF Integration

- [ ] **KSEF-01**: System auto-fetches invoices issued to org's NIP from national KSeF system
- [ ] **KSEF-02**: System parses KSeF FA(3) XML into invoice data model
- [ ] **KSEF-03**: Invoice displays KSeF reference number and UPO receipt
- [ ] **KSEF-04**: System detects duplicates between KSeF-pulled and manually uploaded invoices

### Jira Integration

- [ ] **JIRA-01**: Admin can connect Jira Cloud workspace via OAuth 2.0
- [ ] **JIRA-02**: Workflow steps can auto-create Jira issues with configurable project/type mapping
- [ ] **JIRA-03**: Jira issue status changes auto-update linked workflow tasks (configurable mapping)
- [ ] **JIRA-04**: Linked Jira issues display on contractor and workflow views as clickable chips

### Documentation Integration

- [ ] **DOCS-01**: User can attach Notion or Confluence page links to workflow steps
- [ ] **DOCS-02**: User can search and link Notion/Confluence pages from within Cmd+K

### Calendar Integration

- [ ] **CAL-01**: System pushes contract expiry, approval SLA, and payment deadlines to Google/Outlook calendar
- [ ] **CAL-02**: Workflow steps can create calendar events (e.g., onboarding kickoff meeting)

## Future Requirements

Deferred to v3+. Tracked but not in current roadmap.

### KSeF Advanced

- **KSEF-05**: System sends/issues invoices via KSeF (FA(3) XML generation)
- **KSEF-06**: System validates OCR-extracted fields against KSeF structured data

### Time Tracking Advanced

- **TIME-06**: Full time tracker with timers, screenshots, activity monitoring

### Calendar Advanced

- **CAL-03**: Bi-directional calendar sync (read events back from external calendars)

### Documentation Advanced

- **DOCS-03**: Notion/Confluence content rendering inline (full page mirroring)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| KSeF invoice sending | Issuing invoices is accounting system territory — contractors issue their own |
| Full time tracker (timers, screenshots) | Clockify/Toggl do this better — import, don't build |
| Bi-directional calendar sync | One-way push is sufficient — reading back creates complexity |
| Notion content mirroring | Link + preview, not full rendering — Notion has 100+ block types |
| Build own e-sign engine | Legal compliance (eIDAS, QES) requires certified providers |
| Contractor messaging/chat | Slack/email exists — chat is massive scope |
| Automated invoice creation from time | Contractors issue own invoices (B2B model) — show expected amount instead |
| SSO/SCIM | v3 |
| Open banking / payment initiation | v3+ |
| Mobile native app | Desktop-first, responsive to tablet |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INTG-01 | Phase 12 | Pending |
| INTG-02 | Phase 12 | Pending |
| INTG-03 | Phase 12 | Pending |
| PORT-01 | Phase 13 | Pending |
| PORT-02 | Phase 13 | Pending |
| PORT-03 | Phase 13 | Pending |
| PORT-04 | Phase 13 | Pending |
| PORT-05 | Phase 13 | Pending |
| PORT-06 | Phase 14 | Pending |
| PORT-07 | Phase 14 | Pending |
| PORT-08 | Phase 14 | Pending |
| TIME-01 | Phase 18 | Pending |
| TIME-02 | Phase 18 | Pending |
| TIME-03 | Phase 18 | Pending |
| TIME-04 | Phase 18 | Pending |
| TIME-05 | Phase 18 | Pending |
| SIGN-01 | Phase 15 | Pending |
| SIGN-02 | Phase 15 | Pending |
| SIGN-03 | Phase 15 | Pending |
| SIGN-04 | Phase 15 | Pending |
| OCR-01 | Phase 16 | Pending |
| OCR-02 | Phase 16 | Pending |
| OCR-03 | Phase 16 | Pending |
| KSEF-01 | Phase 17 | Pending |
| KSEF-02 | Phase 17 | Pending |
| KSEF-03 | Phase 17 | Pending |
| KSEF-04 | Phase 17 | Pending |
| JIRA-01 | Phase 19 | Pending |
| JIRA-02 | Phase 19 | Pending |
| JIRA-03 | Phase 19 | Pending |
| JIRA-04 | Phase 19 | Pending |
| DOCS-01 | Phase 20 | Pending |
| DOCS-02 | Phase 20 | Pending |
| CAL-01 | Phase 20 | Pending |
| CAL-02 | Phase 20 | Pending |

**Coverage:**
- v2.0 requirements: 35 total
- Mapped to phases: 35
- Unmapped: 0

---
*Requirements defined: 2026-03-23*
*Last updated: 2026-03-23 after roadmap creation*
