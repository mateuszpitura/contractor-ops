# Feature Research: v2.0 Platform Expansion

**Domain:** B2B Contractor Operations Platform -- self-service portal, e-sign, OCR, KSeF, integrations
**Researched:** 2026-03-23
**Confidence:** MEDIUM-HIGH (verified against official APIs, competitor analysis, regulatory docs)

## Feature Landscape

### Table Stakes (Users Expect These)

Features that v2.0 must ship. Without these, each module feels incomplete or unusable.

#### Contractor Self-Service Portal

| Feature | Why Expected | Complexity | Dependencies on v1.0 | Notes |
|---------|--------------|------------|----------------------|-------|
| Contractor login with scoped access | Contractors need their own auth context, not org-member accounts | HIGH | Better Auth (new role type), RBAC, multi-tenant | New auth flow: magic link or password. Contractors are NOT org users -- separate identity model with org-scoped access |
| View own contracts (read-only) | Contractors expect to see active contracts, terms, rates | LOW | Contract repository | Read-only filtered view of existing contract data |
| Submit invoices via portal | Core Deel-like expectation: contractor uploads invoice, it enters org's intake pipeline | MEDIUM | Invoice intake pipeline | Replaces email/upload -- portal submission feeds into existing matching + approval flow |
| Payment status tracking | "When am I getting paid?" is the #1 contractor question | LOW | Payment runs | Read-only view: invoice submitted -> approved -> in payment run -> paid. Expose status from existing data |
| View/download own documents | Contractors need access to signed contracts, NDAs, tax forms | LOW | Document management, R2 storage | Scoped access to documents tagged to their contractor record |
| Profile self-management | Update bank details, tax info, contact info, NIP | MEDIUM | Contractor registry | Edits go through approval/review before updating master record (security concern) |
| Portal notification preferences | Contractors control what emails they receive | LOW | Notification system | Subset of existing notification engine |

#### E-Sign Integration

| Feature | Why Expected | Complexity | Dependencies on v1.0 | Notes |
|---------|--------------|------------|----------------------|-------|
| Send contract for signature from app | Click "Send for signing" on any contract -- routes to DocuSign or Autenti | MEDIUM | Contract repository | Provider-agnostic adapter: same UX regardless of backend provider |
| Embedded signing experience | Signer signs within Contractor Ops (iframe/redirect), not in separate DocuSign tab | MEDIUM | None (new UI flow) | DocuSign embedded signing URL + Autenti redirect flow. Both support this pattern |
| Signature status tracking | Real-time status: sent -> viewed -> signed -> completed | LOW | Contract repository | Webhook-driven status updates from providers, stored on contract record |
| Multi-party signing (contractor + org rep) | Contracts need both parties to sign, in defined order | MEDIUM | Contract repository | Signing order / routing rules. DocuSign and Autenti both support sequential signing |
| Signed document auto-storage | Completed signed PDF automatically saved to document management | LOW | Document management, R2 | Webhook on completion -> download signed PDF -> upload to R2 -> link to contract |
| Audit trail for signatures | Legal requirement: who signed what, when, from where | LOW | Audit log | Both providers return detailed audit certificates. Store as linked document |

#### OCR Invoice Parsing

| Feature | Why Expected | Complexity | Dependencies on v1.0 | Notes |
|---------|--------------|------------|----------------------|-------|
| Auto-extract fields from uploaded PDF | Upload invoice PDF -> pre-fill: vendor NIP, invoice number, date, amount, line items | MEDIUM | Invoice intake | Use Mindee Invoice API or equivalent. 98-99% accuracy on structured Polish invoices |
| Confidence scores per field | Show which extracted fields are high/low confidence so user knows what to verify | LOW | None (new UI) | Mindee returns confidence per field. Display as visual indicator |
| Human review/correction UI | Side-by-side: PDF preview on left, extracted fields on right, edit-in-place | HIGH | Invoice intake forms | Key UX investment. This is where OCR becomes useful vs annoying |
| Line item extraction | Extract individual line items, not just header totals | MEDIUM | Invoice data model | Mindee supports line items. May need invoice schema expansion |
| Multi-page invoice support | Invoices can span multiple pages | LOW | None | Mindee handles this natively |

#### KSeF Native Integration

| Feature | Why Expected | Complexity | Dependencies on v1.0 | Notes |
|---------|--------------|------------|----------------------|-------|
| Pull invoices from KSeF | Auto-fetch invoices issued to the org's NIP from the national system | HIGH | Invoice intake, org NIP config | KSeF 2.0 API (OpenAPI 3.0.4). Auth via tokens (until 2027) then certificates. XML FA(3) schema |
| Parse KSeF XML into invoice records | Convert FA(3) structured XML into existing invoice data model | MEDIUM | Invoice data model | XML parsing + field mapping. KSeF invoices are already structured -- no OCR needed |
| KSeF invoice status display | Show KSeF reference number (numer KSeF), UPO receipt | LOW | Invoice records | Additional metadata fields on invoice record |
| Duplicate detection: KSeF vs uploaded | If an invoice comes via KSeF AND is uploaded manually, detect the duplicate | MEDIUM | Existing duplicate detection | Extend existing NIP + invoice number matching to include KSeF reference |
| KSeF compliance badge | Visual indicator that invoice was received/validated via KSeF | LOW | Invoice list UI | Simple badge/icon. Important for audit confidence |

#### Jira Integration

| Feature | Why Expected | Complexity | Dependencies on v1.0 | Notes |
|---------|--------------|------------|----------------------|-------|
| Connect Jira workspace (OAuth) | Admin configures Jira Cloud connection via OAuth 2.0 | MEDIUM | Settings, integration framework | Atlassian OAuth 2.0 (3LO). Store tokens per org |
| Create Jira issue from Contractor Ops | E.g., onboarding workflow step -> auto-create Jira ticket for IT setup | MEDIUM | Workflow engine | Jira REST API v3: POST /rest/api/3/issue. Configurable project + issue type mapping |
| Sync Jira issue status back | When Jira ticket moves to "Done", update linked workflow task | MEDIUM | Workflow engine | Jira webhooks (jira:issue_updated). Map Jira statuses to workflow task statuses |
| Bidirectional link display | Show linked Jira issues on contractor/workflow views, clickable | LOW | UI components | Store Jira issue key + URL. Display as linked chip |

#### Notion/Confluence Integration

| Feature | Why Expected | Complexity | Dependencies on v1.0 | Notes |
|---------|--------------|------------|----------------------|-------|
| Link external docs to workflows | Attach Notion page or Confluence page URL to onboarding workflow steps | LOW | Workflow engine | URL + metadata (title, icon). Fetch page title via API for display |
| Embed/preview linked pages | Show page preview or content snippet inline, not just a bare URL | MEDIUM | UI components | Notion API: retrieve block children. Confluence REST API: get page content. Render markdown preview |
| Search external docs from within app | Find and link Notion/Confluence pages without leaving Contractor Ops | MEDIUM | Cmd+K, search UI | Notion: POST /search. Confluence: GET /wiki/rest/api/content/search |

#### Calendar Integration

| Feature | Why Expected | Complexity | Dependencies on v1.0 | Notes |
|---------|--------------|------------|----------------------|-------|
| Sync deadlines to calendar | Contract expiry, approval SLA, payment due dates appear in Google/Outlook calendar | MEDIUM | Contracts, approvals, payments | Create calendar events via API. Google Calendar API + Microsoft Graph API, OR unified via Cronofy |
| Schedule meetings from workflows | Onboarding workflow step: "Schedule kickoff meeting" -> create calendar event | MEDIUM | Workflow engine | Event creation with attendees. Needs calendar provider auth per user |
| Calendar reminders for deadlines | Push reminders for upcoming contract renewals, payment dates | LOW | Notification system | Extend existing reminder system to push to external calendars |

#### Time Tracking (Portal Feature)

| Feature | Why Expected | Complexity | Dependencies on v1.0 | Notes |
|---------|--------------|------------|----------------------|-------|
| Manual time entry in portal | Contractor logs hours: date, hours, project/task, description | MEDIUM | Contractor portal, new data model | New time_entries table. Simple form in portal |
| Time entry approval by org | Manager reviews and approves submitted hours before invoicing | MEDIUM | Approval workflow | Reuse existing approval chain infrastructure. New approval type |
| Clockify import | Pull time entries from Clockify via API (REST, free tier available) | MEDIUM | Time tracking data model | Clockify API: GET /workspaces/{id}/time-entries. Map to internal model |
| Jira time log import | Pull worklogs from Jira issues assigned to contractor | MEDIUM | Jira integration, time tracking model | Jira REST API: GET /rest/api/3/issue/{id}/worklog. Requires Jira integration first |
| Time-to-invoice matching | Link approved hours to invoice line items for verification | MEDIUM | Invoice matching | Compare: (approved hours x rate) vs invoice amount. Flag deviations |

### Differentiators (Competitive Advantage)

Features that make Contractor Ops stand out vs Deel, Faktura.pl, and manual Excel workflows.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| KSeF-first invoice intake | While competitors bolt on KSeF as afterthought, Contractor Ops treats it as primary intake channel alongside upload and email. Auto-pull + auto-match + compliance badge | HIGH | Poland-specific but massive competitive advantage given April 2026 mandate for all companies. No competitor in the contractor-ops niche does this natively |
| Unified OCR + KSeF pipeline | Same invoice goes through OCR (if uploaded) or XML parsing (if KSeF), both feed into identical matching + approval flow. Contractor and org never think about the source | MEDIUM | Abstraction layer that normalizes invoice data regardless of source. Key architectural differentiator |
| Contractor portal with org branding | White-labeled portal URL (contractors.yourcompany.com or similar), org logo, colors. Feels like the client's tool, not a generic SaaS | MEDIUM | Custom subdomain/path + org branding settings (already partially built in v1.0 org setup). Builds trust with contractors |
| Time tracking -> invoice verification | Approved hours automatically compared against submitted invoice amounts. Flags deviations. "You approved 160h at 150 PLN/h but invoice says 25,000 PLN" | MEDIUM | Requires time tracking + invoice matching. Unique workflow that competitors don't automate |
| E-sign with dual provider (DocuSign + Autenti) | DocuSign for international contractors, Autenti for Polish QES compliance. Auto-route based on contractor country or contract type | MEDIUM | Poland-specific advantage. Autenti provides legally required QES for certain document types. No competitor offers both in one flow |
| Cross-system workflow automation | Onboarding workflow that creates Jira ticket, sends contract for e-sign, schedules kickoff meeting, and links Notion docs -- all from one workflow template | HIGH | Requires all integrations working together. The "killer" v2.0 demo scenario |
| Smart OCR correction learning | Track which OCR fields users correct most often. Surface "frequently corrected" fields more prominently. Per-vendor accuracy tracking | LOW | Analytics on correction patterns. Low effort, high perceived value |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Full time tracking app (timers, screenshots, activity) | "We need to track contractor productivity" | Massive scope, hostile to contractors, Clockify/Toggl do this better. Building a timer app is not your business | Import from Clockify/Jira. Manual entry for simple cases. Link, don't build |
| KSeF invoice SENDING (issuing invoices via KSeF) | "If we can pull, we should push too" | Sending structured invoices requires full FA(3) XML generation, which is an accounting system's job. Out of scope per PROJECT.md | Pull-only for v2.0. Sending is v3+ if ever. Contractors issue their own invoices |
| Real-time calendar sync (bi-directional) | "Keep everything in sync always" | Complex conflict resolution, rate limits, credential management per user. Calendar APIs have aggressive rate limits | Push events TO calendar (one-way). Don't try to read/sync back. Use calendar as notification channel |
| Notion/Confluence content mirroring | "Show the full Notion page inside our app" | Content rendering is complex, breaks on updates, requires constant API polling. Notion blocks have 100+ types | Link + title + preview snippet. Open in new tab for full content. Don't try to replicate Notion's renderer |
| Build own e-sign engine | "DocuSign is expensive, let's just do PDF stamping" | Legal compliance (eIDAS, QES), audit trails, identity verification -- this is a regulated domain. Homebrew e-sign has zero legal standing | Use DocuSign + Autenti. The cost ($600/yr DocuSign starter) is trivial vs legal risk |
| Contractor messaging / chat | "Let contractors message the org through the portal" | Chat is a massive feature (real-time, history, notifications, read receipts). Slack/email already exists | Use existing notification system for status updates. Link to Slack channel if needed |
| Multi-provider calendar aggregation | "Show a unified calendar view of all providers" | Building a calendar UI is enormous scope. Different providers have different event models | Push deadlines to user's preferred calendar. Don't build a calendar view |
| Automated invoice creation from time entries | "Just auto-generate the invoice from approved hours" | Contractors issue their own invoices (B2B model). Auto-generating invoices crosses into accounting territory and has tax implications | Show "expected amount" based on approved hours. Contractor creates actual invoice. Flag discrepancy if mismatch |

## Feature Dependencies

```
[Contractor Portal Auth]
    |-- requires --> [New contractor identity model in Better Auth]
    |-- requires --> [Portal-scoped RBAC (separate from org RBAC)]
    |
    +-- [Contract Viewing] -- requires --> [Existing contract repository]
    +-- [Invoice Submission] -- requires --> [Existing invoice intake]
    +-- [Payment Tracking] -- requires --> [Existing payment runs]
    +-- [Document Access] -- requires --> [Existing document management]
    +-- [Profile Management] -- requires --> [Existing contractor registry]
    +-- [Time Entry] -- requires --> [New time tracking data model]
         |
         +-- [Time Entry Approval] -- requires --> [Existing approval workflow]
         +-- [Clockify Import] -- requires --> [Time tracking data model]
         +-- [Jira Time Import] -- requires --> [Jira Integration] + [Time tracking data model]
         +-- [Time-to-Invoice Match] -- requires --> [Time tracking] + [Invoice matching]

[E-Sign Integration]
    |-- requires --> [Provider adapter layer (DocuSign + Autenti)]
    |-- requires --> [Webhook endpoint for status callbacks]
    |
    +-- [Send for Signing] -- requires --> [Contract repository]
    +-- [Embedded Signing] -- requires --> [Provider adapter + frontend redirect/iframe]
    +-- [Signed Doc Storage] -- requires --> [Document management, R2]
    +-- [Portal Signing] -- enhances --> [Contractor Portal]

[OCR Invoice Parsing]
    |-- requires --> [Mindee API integration (or equivalent)]
    |-- requires --> [Human review UI (side-by-side PDF + fields)]
    |
    +-- [Auto-extract Fields] -- enhances --> [Invoice intake]
    +-- [Line Item Extraction] -- may require --> [Invoice schema expansion]

[KSeF Integration]
    |-- requires --> [KSeF 2.0 API client (OpenAPI, XML/FA(3))]
    |-- requires --> [Org-level KSeF auth token configuration]
    |-- requires --> [XML to invoice data model mapper]
    |
    +-- [Pull Invoices] -- enhances --> [Invoice intake]
    +-- [KSeF Duplicate Detection] -- enhances --> [Existing duplicate detection]
    +-- [KSeF + OCR Unified Pipeline] -- requires --> [Both OCR and KSeF]

[Jira Integration]
    |-- requires --> [Atlassian OAuth 2.0 connection]
    |-- requires --> [Webhook receiver for Jira events]
    |
    +-- [Create Issues] -- enhances --> [Workflow engine]
    +-- [Status Sync] -- enhances --> [Workflow engine]
    +-- [Jira Time Import] -- enhances --> [Time tracking]

[Notion/Confluence Integration]
    |-- requires --> [Notion OAuth + Confluence OAuth connections]
    |
    +-- [Link Docs] -- enhances --> [Workflow engine]
    +-- [Search Docs] -- enhances --> [Cmd+K, search]

[Calendar Integration]
    |-- requires --> [Google Calendar API + Microsoft Graph API auth per user]
    |       OR --> [Cronofy unified API (simpler but adds cost)]
    |
    +-- [Deadline Sync] -- requires --> [Contract reminders, approval SLAs, payment dates]
    +-- [Meeting Scheduling] -- enhances --> [Workflow engine]
```

### Dependency Notes

- **Contractor Portal requires new auth model:** Contractors are NOT org members. They need a separate identity type in Better Auth with org-scoped access. This is the foundational prerequisite -- everything else in the portal depends on it.
- **Time tracking requires portal first:** Time entry lives in the contractor portal. The data model and approval flow can be designed in parallel, but the UI is portal-dependent.
- **Jira time import requires Jira integration:** The Jira connection must exist before worklogs can be pulled. Plan Jira integration before time tracking import.
- **KSeF and OCR are independent but converge:** Both feed into invoice intake. They can be built in parallel, but the unified pipeline (normalizing both sources) should be designed upfront.
- **E-sign enhances portal:** Contractors signing contracts via the portal is a key flow, but e-sign can work standalone (org sends signing link via email) even without the portal.
- **Calendar integration is leaf-level:** Depends on existing data (deadlines, meetings) but nothing depends on it. Build last.
- **Notion/Confluence are leaf-level:** Low dependency, low risk. Can be built in any order after the integration framework exists.

## MVP Definition

### Phase 1: Build First (Foundation)

- [ ] **Contractor portal auth + scoped access** -- Everything else in the portal depends on this. New identity model, magic link login, org-scoped contractor view
- [ ] **Contract viewing + document access in portal** -- Lowest complexity portal features, validates the auth model end-to-end
- [ ] **Invoice submission via portal** -- Core value: contractor submits invoice, it enters existing intake pipeline. Validates portal -> org data flow
- [ ] **Payment status tracking** -- Read-only, uses existing data. Completes the contractor's core question loop
- [ ] **E-sign integration (DocuSign + Autenti)** -- Independent of portal. High business value: contracts go from "print, sign, scan, email" to one-click. Provider adapter pattern for both

### Phase 2: Add After Foundation

- [ ] **OCR invoice parsing** -- Enhances invoice intake. High perceived value. Mindee integration is straightforward (API call + UI work)
- [ ] **KSeF native integration** -- URGENT due to April 2026 mandate. Pull invoices from national system. Can be built in parallel with OCR
- [ ] **KSeF + OCR unified pipeline** -- Normalize both sources into one intake flow. Design this when both are working
- [ ] **Profile self-management** -- Contractor edits own profile. Needs review/approval flow for security
- [ ] **Human review UI for OCR** -- Side-by-side PDF + extracted fields. Key UX investment

### Phase 3: Expand

- [ ] **Time tracking (manual entry + approval)** -- New data model, portal UI, approval integration
- [ ] **Clockify import** -- Pull time entries from external tracker
- [ ] **Jira integration (create issues + status sync)** -- Workflow engine enhancement. OAuth + webhooks
- [ ] **Jira time log import** -- Requires both Jira integration and time tracking model
- [ ] **Time-to-invoice matching** -- Compare approved hours vs invoice amount

### Phase 4: Polish and Connect

- [ ] **Notion/Confluence doc linking** -- URL + preview in workflows
- [ ] **Calendar deadline sync** -- Push contract/payment deadlines to Google/Outlook calendars
- [ ] **Meeting scheduling from workflows** -- Create calendar events as workflow steps
- [ ] **Contractor portal branding** -- White-label with org logo/colors
- [ ] **Cross-system workflow templates** -- Pre-built templates combining Jira + e-sign + calendar + docs

### Defer (v3+)

- [ ] **KSeF invoice sending** -- Issuing invoices is accounting system territory. v3 if ever
- [ ] **Full time tracker (timers, screenshots)** -- Clockify does this better. Import, don't build
- [ ] **Calendar bi-directional sync** -- One-way push is sufficient. Reading back creates complexity
- [ ] **Notion content rendering** -- Link + preview, not full mirroring

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Urgency |
|---------|------------|---------------------|----------|---------|
| Contractor portal (auth + core views) | HIGH | HIGH | P1 | High -- enables all portal features |
| Invoice submission via portal | HIGH | MEDIUM | P1 | High -- core contractor workflow |
| E-sign (DocuSign + Autenti) | HIGH | MEDIUM | P1 | High -- immediate business value |
| KSeF invoice pull | HIGH | HIGH | P1 | CRITICAL -- April 2026 mandate |
| OCR invoice parsing | HIGH | MEDIUM | P1 | High -- reduces manual data entry |
| Payment status tracking | HIGH | LOW | P1 | High -- #1 contractor question |
| Human review UI for OCR | MEDIUM | HIGH | P2 | Medium -- OCR is less useful without it |
| Profile self-management | MEDIUM | MEDIUM | P2 | Medium -- nice to have, not blocking |
| Time tracking (manual) | MEDIUM | MEDIUM | P2 | Medium -- some orgs need it, many don't |
| Jira integration | MEDIUM | MEDIUM | P2 | Medium -- dev-heavy orgs want this |
| Time-to-invoice matching | MEDIUM | MEDIUM | P2 | Medium -- differentiator, not urgent |
| Clockify import | LOW | MEDIUM | P2 | Low -- niche need |
| Notion/Confluence linking | LOW | LOW | P3 | Low -- nice to have |
| Calendar sync | LOW | MEDIUM | P3 | Low -- nice to have |
| Meeting scheduling | LOW | MEDIUM | P3 | Low -- nice to have |
| Portal branding | LOW | LOW | P3 | Low -- polish feature |

**Priority key:**
- P1: Must have for v2.0 launch -- without these, v2.0 has no story
- P2: Should have, add in later v2.0 phases
- P3: Nice to have, can ship v2.0 without these

## Competitor Feature Analysis

| Feature | Deel | Faktura.pl | Manual (Excel+Email) | Contractor Ops v2.0 |
|---------|------|------------|----------------------|----------------------|
| Contractor portal | Full portal with login, contracts, invoices, payments | No portal (invoice-focused) | N/A | Full portal with org branding |
| Invoice submission | Auto-generated from contract terms OR manual upload | Upload/create invoices | Email PDF to accountant | Portal upload + email intake + KSeF pull |
| E-sign | Built-in (own engine) | No | DocuSign separately | DocuSign + Autenti (dual provider) |
| OCR parsing | Minimal (structured invoices auto-generated) | Basic field extraction | Manual | Mindee-powered with confidence scores |
| KSeF integration | Not applicable (global platform) | Yes (invoice tool) | Manual portal login | Native pull + auto-match + compliance |
| Time tracking | Basic (hours + description) | No | Clockify/Toggl | Manual + Clockify/Jira import |
| Jira integration | No native Jira | No | N/A | Create issues + status sync + time import |
| Calendar sync | No | No | Manual calendar entries | Push deadlines + schedule meetings |
| Approval workflow | Basic approve/reject | No | Email threads | 1-3 level chains with SLA (existing v1.0) |
| Payment tracking | Real-time with multi-currency | Invoice status only | Bank statement checking | Status tracking linked to payment runs |
| Audit trail | Yes | Basic | None | Immutable audit log (existing v1.0) |

**Key takeaway:** Deel is the feature leader for contractor portals globally, but has zero KSeF/Polish compliance features. Faktura.pl handles invoicing but has no contractor lifecycle. Contractor Ops v2.0 uniquely combines portal + KSeF + lifecycle in one Polish-market-focused platform.

## Complexity Estimates (for Roadmap Planning)

| Module | Estimated Effort | Risk Level | Notes |
|--------|-----------------|------------|-------|
| Contractor portal (auth + views) | 3-4 weeks | HIGH | New auth model is the risk. Views are straightforward once auth works |
| E-sign integration | 2-3 weeks | MEDIUM | Well-documented APIs. Autenti API V2 has Postman collection. DocuSign has JS SDK |
| OCR invoice parsing | 2-3 weeks | MEDIUM | API integration is easy. Human review UI is the real work |
| KSeF integration | 3-4 weeks | HIGH | XML schema (FA(3)), government API quirks, auth token management. Test environment available |
| Time tracking | 2-3 weeks | LOW | Standard CRUD + approval reuse. Straightforward |
| Jira integration | 2 weeks | MEDIUM | OAuth 2.0 + webhooks. Well-documented but webhook reliability needs handling |
| Notion/Confluence | 1-2 weeks | LOW | Simple API calls. Link + search + preview |
| Calendar integration | 2 weeks | MEDIUM | Two providers (Google + Microsoft) OR Cronofy ($139/mo+). Direct integration is cheaper but more work |
| Integration framework | 1 week | LOW | Shared patterns: OAuth token storage, webhook receiver, retry logic. Build once, reuse for all integrations |

## Sources

- [DocuSign Embedded Signing](https://developers.docusign.com/docs/esign-rest-api/esign101/concepts/embedding/) -- official developer docs
- [Autenti API V2 Documentation](https://developers.autenti.com/docs/autenti-public-api-v2/overview) -- official developer portal
- [Autenti API Pricing](https://autenti.com/en/pricing/api) -- pricing page
- [Mindee Invoice OCR API](https://www.mindee.com/product/invoice-ocr-api) -- product page with accuracy claims
- [Mindee Pricing](https://www.mindee.com/pricing) -- 250 free pages/mo, $0.01-0.10/page
- [KSeF 2.0 API Documentation](https://rtcsuite.com/understanding-polands-ksef-2-0-api-documentation-and-fa3-structure-key-changes-and-released-api-documentation/) -- API overview and FA(3) schema analysis
- [KSeF GitHub Docs](https://github.com/CIRFMF/ksef-docs) -- official KSeF documentation repository
- [Jira Cloud REST API v3](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-webhooks/) -- webhooks documentation
- [Jira Webhooks Guide](https://developer.atlassian.com/cloud/jira/platform/webhooks/) -- webhook setup and events
- [Cronofy Calendar API Pricing](https://www.cronofy.com/api-pricing) -- unified calendar API pricing ($139/mo starter)
- [Clockify API Documentation](https://docs.clockify.me/) -- REST API for time tracking integration
- [Deel Contractor Portal Features](https://www.deel.com/blog/features-any-deel-contractor-can-use/) -- competitor analysis
- [Deel Contractor Invoicing Guide](https://help.letsdeel.com/hc/en-gb/articles/9266361465361-Guide-to-Contractor-Invoices-Adjustments) -- competitor invoice flow

---
*Feature research for: Contractor Ops v2.0 Platform Expansion*
*Researched: 2026-03-23*
