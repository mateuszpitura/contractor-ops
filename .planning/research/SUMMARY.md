# Project Research Summary

**Project:** Contractor Ops v2.0 Platform Expansion
**Domain:** B2B contractor operations platform — self-service portal, e-sign, OCR, KSeF, third-party integrations
**Researched:** 2026-03-23
**Confidence:** MEDIUM-HIGH

## Executive Summary

Contractor Ops v2.0 is a significant capability expansion that transforms the platform from an internal contractor management tool into a full-stack B2B contractor operations platform. The expansion adds seven interconnected capability domains: a contractor self-service portal, e-signature integration (DocuSign + Autenti), OCR invoice parsing, KSeF national e-invoicing integration, Jira project management sync, Notion/Confluence documentation linking, and calendar (Google + Outlook) deadline sync. The v1.0 stack (Next.js, tRPC, Prisma, Better Auth, Tailwind, shadcn/ui) is proven and unchanged — all new capabilities layer on top via new packages (`packages/esign`, `packages/ksef`, `packages/integrations`), new tRPC routers, and new Prisma schema files in the existing monorepo.

The recommended approach is infrastructure-first: build a unified integration credential store and webhook ingestion layer before any specific integration, then build the contractor portal as the foundational user-facing feature, then layer in capabilities in dependency order (OCR → e-sign → KSeF → time tracking → Jira → Notion/Confluence → calendar). KSeF carries the highest regulatory urgency — the April 1, 2026 mandatory deadline for all Polish businesses means this feature cannot slip. OCR and e-sign deliver immediate business value with moderate complexity. The contractor portal requires the most architectural care because it introduces an entirely new trust boundary (external users accessing internal data). All other integrations are largely independent once the credential and webhook infrastructure exists.

The key risks are: (1) contractor portal data isolation — contractors must be double-scoped by `org_id + contractor_id` at every query, never modeled as internal users with a restricted role; (2) KSeF complexity — the government API is session-based, still in RC, has mandatory UPO confirmation cycles, and will migrate from token auth to certificates in Jan 2027; (3) integration credential sprawl — six OAuth providers added in v2.0 must share one encrypted credential store with proactive token refresh, built before any specific integration; (4) webhook chaos — seven webhook sources need a central ingestion layer (receive → verify → store → process async) or idempotency and security collapse. Addressing these four structural risks early prevents compounding technical debt across every subsequent phase.

## Key Findings

### Recommended Stack

v2.0 adds purpose-selected libraries for each new domain, with the existing v1.0 stack (Next.js 15, tRPC v11, Prisma 6.x, Better Auth, Tailwind, shadcn/ui, Inngest, Upstash Redis, Vercel) unchanged. The guiding principle across all new dependencies is to use official or best-maintained TypeScript SDKs where they exist, build thin typed wrappers (using `openapi-typescript` + `openapi-fetch`) where they do not (Autenti, Clockify, KSeF), and abstract multi-provider features (e-sign, calendar, docs) behind clean provider interfaces. Three new monorepo packages encapsulate domain logic: `packages/esign` (DocuSign + Autenti), `packages/ksef` (KSeF session lifecycle + XML mapping), `packages/integrations` (Jira, Notion, Confluence, Clockify, Calendar providers). The contractor portal lives in `apps/web` as a route group (`/portal/*`), not a separate Next.js app — sharing auth, database, tRPC, and UI components avoids infrastructure duplication.

**Core new technologies:**
- `docusign-esign` ^8.5.0 — official DocuSign SDK, TypeScript-first, full envelope/signing/webhook support
- Custom REST client (Autenti) — no official Node.js SDK exists; generate types from OpenAPI spec via `openapi-typescript`
- `mindee` ^4.27.1 — best-in-class invoice OCR with dedicated pre-trained model; MIT license; 95%+ accuracy on structured invoices
- `@ksef/client` ^1.7.1 — only maintained TypeScript KSeF 2.0 client; single-maintainer risk; fallback is custom client from government OpenAPI spec
- `fast-xml-parser` ^5.x + `xml-crypto` ^6.x — parse/generate FA(3) XML and XAdES signatures for KSeF; zero native dependencies
- `jira.js` ^5.3.1 — TypeScript-first, near-100% Jira API coverage, actively maintained (March 2026)
- `confluence.js` ^2.1.0 — same author as jira.js, same patterns, full Confluence API coverage
- `@notionhq/client` ^2.x — official Notion SDK; use API version `2026-03-11`
- `@microsoft/microsoft-graph-client` ^3.0.7 + `@azure/identity` ^4.x — official Microsoft Graph SDK for Outlook Calendar
- `googleapis` ^146.x — official Google SDK for Calendar API v3

**What NOT to use:** `node-jira-client` (stale, no TypeScript), `@microsoft/msgraph-sdk` (still preview), Tesseract.js for invoice OCR (poor accuracy on Polish documents), a separate Next.js app for the contractor portal (infrastructure duplication), or a custom e-sign engine (legal/compliance risk, no legal standing under eIDAS).

### Expected Features

The feature landscape divides cleanly into four priority levels. P1 features are mandatory for v2.0 to have a coherent story; without them, v2.0 is not meaningfully different from v1.0. KSeF is uniquely urgent due to the April 2026 regulatory deadline — it carries the same P1 priority as the core portal despite being the most technically complex feature.

**Must have (P1 — table stakes):**
- Contractor portal: magic-link auth, contract viewing, invoice submission, payment status tracking, document access — the foundational external-user layer
- E-sign (DocuSign + Autenti): send for signature, embedded/redirect signing, webhook-driven status tracking, signed PDF auto-storage, multi-party signing — contracts go from print/sign/scan/email to one-click
- KSeF invoice pull: auto-fetch invoices from Poland's national e-invoicing system, FA(3) XML parsing, UPO tracking, KSeF compliance badge — mandatory from April 1, 2026 for all businesses
- OCR invoice parsing: Mindee-powered field extraction with confidence scores, mandatory human review UI with side-by-side PDF view — reduces manual invoice data entry

**Should have (P2 — competitive differentiators):**
- OCR + KSeF unified intake pipeline: normalize both sources into identical matching/approval flow
- Time tracking (manual entry + approval + Clockify/Jira import): contractor-facing, kept minimal (weekly grid UI)
- Jira integration: create issues from workflows, bidirectional status sync, time log import
- Profile self-management with approval review gate
- Time-to-invoice matching: flag when approved hours x rate diverges from invoice amount

**Nice to have (P3 — polish and depth):**
- Notion/Confluence doc linking and search within workflows
- Calendar deadline sync to Google/Outlook (push only, no bidirectional sync)
- Meeting scheduling from workflow steps
- Contractor portal org branding (white-label)
- Cross-system workflow templates combining all integrations

**Defer to v3+:**
- KSeF invoice sending (issuing invoices is accounting system territory)
- Full time tracker with timers/screenshots (Clockify does this better — import, do not build)
- Bidirectional calendar sync (one-way push is sufficient; reading back creates conflict resolution complexity)
- Notion content rendering/mirroring (link + preview snippet, not full replication)
- Automated invoice generation from time entries (tax/legal implications, accounting system territory)

### Architecture Approach

The v2.0 architecture extends the existing clean monorepo without breaking any existing boundaries. The contractor portal becomes a new route group in `apps/web` with its own layout, middleware chain, and auth context that is fully independent from Better Auth. New tRPC routers (`portal.*`, `esign.*`, `ksef.*`, `ocr.*`, `calendar.*`, `time-tracking.*`) call new service classes that abstract all external API calls behind provider interfaces. Four new Prisma schema files (`portal.prisma`, `esign.prisma`, `ocr.prisma`, `ksef.prisma`) follow the existing convention of per-domain schema files. Three external-facing concerns — OAuth callbacks (`/api/oauth/[provider]`), webhook ingestion (`/api/webhooks/[provider]`), and portal auth (`/api/portal/auth`) — are exposed as Next.js API routes (not tRPC) because they require raw body access for HMAC signature verification.

**Major components:**
1. **Integration Credential Store** — unified `integration_connections` table with AES-encrypted credentials, `expires_at`, proactive Inngest refresh cron; shared `getCredential(orgId, provider)` function used by all integration adapters
2. **Webhook Ingestion Layer** — per-provider API routes: verify HMAC → store in `webhook_events` → return 200 → process async via Inngest/QStash; Google Calendar renewal cron (every 20h); Microsoft Graph subscription renewal (every 3 days)
3. **Portal Route Group** (`/portal/*`) — contractor-facing self-service UI with dedicated layout and magic-link auth; separate from admin routes via middleware; shares all existing packages
4. **Portal Auth Middleware** — independent `portalAuth` tRPC middleware chain using `PortalSession` model; contractors never added to the internal user table; all portal queries double-scoped by `organizationId + contractorId`
5. **OCR-Then-Review Pipeline** — invoice created immediately on upload, OCR triggered async via Redis/Inngest, human review UI shows per-field confidence scores and original PDF side-by-side before any fields are committed to the system
6. **E-Sign Provider Abstraction** — thin `EsignProvider` TypeScript interface with independent DocuSign and Autenti implementations; each provider gets its own webhook endpoint; status normalized to internal enum (`PENDING_SIGNATURE → SIGNED → REJECTED → EXPIRED`) at adapter boundary
7. **KSeF Sync Pipeline** — Vercel Cron triggers per-org polling, Inngest manages session lifecycle (open → submit → poll UPO → store KSeF-ID → close), full FA(3) XML stored in R2 for audit, exponential backoff retry for KSeF outages
8. **Calendar/Docs Provider Abstractions** — same interface pattern for Google/Outlook Calendar and Notion/Confluence; push-only to calendar; link + preview for docs; page ID (not URL) stored for resilience to page moves

### Critical Pitfalls

1. **Contractor portal blows open the tenant boundary** — Adding `CONTRACTOR` role to existing RBAC is wrong. Contractors are fundamentally different (cross-org identity, restricted to own records only). Prevention: dedicated `PortalSession` model, separate `portalAuth` middleware chain, Prisma extension that enforces double-scoping (`organizationId + contractorId`) on all portal queries. Integration test: verify Contractor A cannot see Contractor B's invoices/contracts within the same org.

2. **KSeF treated as simple REST (ignores session model and UPO flow)** — KSeF is session-based, not fire-and-forget. Invoices are not legally compliant without a stored UPO and KSeF-ID. Prevention: async Inngest pipeline with `PENDING → SUBMITTED → CONFIRMED → FAILED` state tracking, exponential backoff retries, raw FA(3) XML stored in R2, offline queue for KSeF outages. Also plan for: token auth ends Jan 2027, certificates required from then.

3. **Integration credential sprawl** — Building each integration's credential storage independently creates 6+ divergent schemas, duplicated token refresh logic, and a security audit nightmare. Prevention: build the shared `integration_connections` table (encrypted credentials, `expires_at`, `status`, proactive refresh cron) before any specific integration is built.

4. **Webhook chaos (no central router, no idempotency, no signature verification)** — v2.0 introduces 7+ webhook sources (DocuSign, Autenti, Jira, Google Calendar, Microsoft Graph, Clockify, KSeF notifications). Without a central pattern: duplicate processing, forged events, lost events during deployments. Prevention: receive → verify HMAC → store in `webhook_events` → return 200 → process async. Separate endpoints per provider, idempotency keys per event, webhook event log with retention policy.

5. **OCR accuracy treated as solved** — Real-world Polish invoices fail OCR at a much higher rate than demos suggest (varied layouts, handwriting, poor scans, ambiguous date formats). Prevention: mandatory human review for ALL financial fields (amounts, NIP, dates), confidence score display with visual indicators, side-by-side PDF viewer, NIP checksum validation, cross-reference against contractor registry. Never auto-accept OCR results.

## Implications for Roadmap

Based on combined research, the recommended phase structure is dependency-driven with infrastructure concerns addressed first, then user-facing features in order of business impact and architectural dependency.

### Phase 1: Integration Foundation

**Rationale:** The credential store and webhook ingestion layer are shared infrastructure that every subsequent integration phase depends on. Building them first means each later phase is 30-40% smaller because the boilerplate is already handled. Without this phase, the alternative is 6+ divergent credential implementations and webhook handlers — Pitfalls 5 and 6 actualized across every integration.
**Delivers:** Unified `integration_connections` table with encrypted credential storage per org; proactive token refresh via Inngest cron; `webhook_events` ingestion table with per-provider HMAC verification and async processing; generalized OAuth 2.0 authorization flow (extending existing Slack pattern) reusable for all 6+ providers; generic approval engine extracted from invoice-specific code (prerequisite for time tracking and e-sign approvals)
**Addresses:** Integration credential management, webhook reliability, approval chain flexibility
**Avoids:** Credential sprawl (Pitfall 5), webhook chaos (Pitfall 6), approval chain inflexibility (Pitfall 8)
**Research flag:** Standard patterns — extends existing Slack OAuth and Inngest patterns. No deep research needed.

### Phase 2: Contractor Portal

**Rationale:** The contractor portal is the foundational external-user layer. Time tracking, portal invoice submission, and portal-based contract signing all depend on portal auth existing. Without the new `PortalSession` model and double-scoped middleware, any portal feature built before it will need rearchitecting. This is the highest architectural risk phase because it introduces a new trust boundary — external users accessing scoped internal data.
**Delivers:** Portal route group (`/portal/*`) with dedicated layout; magic-link auth flow (`/portal/login`, `/portal/verify`); `PortalSession` model; `portalAuth` tRPC middleware with double-scoped queries; contractor views for contracts (read-only), invoices (submit + list), payment status, documents, profile self-management with approval gate, notification preferences; portal-specific email notifications via Resend
**Addresses:** Contractor login, contract viewing, invoice submission via portal, payment tracking, document access (all P1 must-haves)
**Avoids:** Tenant boundary violation (Pitfall 1), contractor role RBAC confusion
**Research flag:** Needs phase research for magic-link auth implementation details against existing Better Auth setup, and multi-org contractor context-switching UX design.

### Phase 3: OCR Invoice Parsing

**Rationale:** OCR enhances the core invoice intake flow that both internal admins and portal contractors use immediately. It is one of the highest-value, medium-complexity features. Building it before KSeF establishes the async invoice pipeline pattern that the unified OCR + KSeF intake design requires. Both OCR and KSeF feed into the same matching/approval flow — OCR first means KSeF can be plugged into an already-working normalized pipeline.
**Delivers:** Mindee API integration (`packages/api/src/services/ocr-service.ts`); async OCR queue (Redis-triggered Inngest function); `OcrResult` model with per-field confidence scores; `Invoice.ocrResultId` link; human review UI (side-by-side PDF preview + extracted fields, confidence score indicators, edit-in-place correction); NIP checksum validation; accuracy tracking per contractor/source; OCR skipped for KSeF-sourced invoices (already structured)
**Addresses:** OCR invoice parsing, confidence scores, human review UI (all P1/P2)
**Avoids:** OCR accuracy overconfidence (Pitfall 4), synchronous OCR in request path (architecture anti-pattern)
**Research flag:** Standard patterns — Mindee SDK is well-documented. Review UI is custom React work.

### Phase 4: E-Sign Integration

**Rationale:** E-sign builds on the existing contract model and the integration credential store from Phase 1. It does not depend on the contractor portal but integrates naturally with it (contractors signing contracts via the portal session). The dual-provider requirement (DocuSign + Autenti) makes the provider abstraction pattern essential — this phase validates the pattern that calendar integration later reuses.
**Delivers:** `EsignProvider` TypeScript interface with independent DocuSign and Autenti implementations; `EsignEnvelope`/`EsignRecipient`/`EsignEvent` Prisma models; `Contract.esignEnvelopeId/esignStatus/esignCompletedAt` fields; "Send for Signature" flow in contract management UI; on-demand embedded signing URL generation (DocuSign, never pre-generated); Autenti redirect-based signing flow with clear UX and "return to Contractor Ops" messaging; per-provider webhook endpoints with HMAC verification; signed PDF auto-download from provider and storage to R2; Document record creation from completed signing; signing audit trail storage
**Addresses:** E-sign send, embedded signing, status tracking, multi-party signing, signed document storage, audit trail (all P1 must-haves)
**Avoids:** E-sign abstraction leakage (Pitfall 3), DocuSign signing URL pre-generation mistake, shared webhook handler anti-pattern
**Research flag:** Standard patterns — both APIs are well-documented with Postman collections. Autenti redirect flow UX needs careful design to handle the sign-and-return pattern.

### Phase 5: KSeF Native Integration

**Rationale:** KSeF is the most technically complex feature and the most regulatorily urgent (April 1, 2026 deadline for all Polish businesses). It is placed after OCR because it benefits from the established async invoice pipeline. The OCR + KSeF unified intake design (normalizing both sources) is implemented as part of this phase. The credential store (Phase 1) already handles KSeF token storage. Building KSeF after Phases 3-4 means all async patterns are established.
**Delivers:** KSeF session lifecycle management (open → submit → poll UPO → store KSeF-ID → close) via Inngest with exponential backoff; `KsefSyncState`, `KsefInvoice` Prisma models; per-org KSeF auth token configuration in integration settings; FA(3) XML → Invoice model mapper; `Invoice.ksefReferenceNumber/ksefSessionId/ksefStatus` fields; raw FA(3) XML stored in R2 as audit Document (source: KSEF); KSeF duplicate detection against uploaded invoices (NIP + invoice number + KSeF reference); KSeF compliance badge in invoice list UI; offline queue + retry for KSeF outages; unified OCR + KSeF intake pipeline (both sources normalized to same matching/approval flow)
**Addresses:** KSeF invoice pull, XML parsing, status display, duplicate detection, compliance badge, unified intake pipeline (all P1 must-haves)
**Avoids:** KSeF session model mishandling (Pitfall 2), treating KSeF as synchronous REST, storing raw XML in database (architecture anti-pattern)
**Research flag:** Needs phase research for FA(3) schema field mapping to existing Invoice model, KSeF test environment authentication setup (api-test.ksef.mf.gov.pl), and certificate auth migration planning for Jan 2027.

### Phase 6: Time Tracking

**Rationale:** Time tracking is a portal-first feature — the primary UI is contractor-facing — and depends on the portal auth model from Phase 2. Manual entry and Clockify import can ship independently of Jira. Time tracking provides the "time-to-invoice matching" differentiator that no direct competitor automates. Keeping the contractor-facing UX minimal (simple weekly grid) is essential for adoption.
**Delivers:** `TimeEntry` Prisma model (MANUAL/CLOCKIFY/JIRA sources, `TimeEntryStatus` states); simple weekly hours grid UI in contractor portal (date + hours + description, project optional); time entry approval flow reusing generic approval engine from Phase 1; Clockify REST API wrapper for import (contractor connects their own Clockify account); time-to-invoice matching logic (approved hours × contract rate vs submitted invoice amount); deviation flagging in invoice review; admin time tracking review view
**Addresses:** Manual time entry, approval, Clockify import, time-to-invoice matching (P2)
**Avoids:** Complex time tracking UI with low adoption (Pitfall 7), mandatory tracking for fixed-price contracts
**Research flag:** Standard patterns — CRUD + approval engine reuse. Clockify API is simple REST. No dedicated research needed.

### Phase 7: Jira Integration

**Rationale:** Jira depends on the OAuth credential store (Phase 1) and optionally enhances time tracking (Phase 6) with worklog import. It is a P2 feature targeted at engineering-heavy organizations. Bidirectional sync with the workflow engine makes it the most complex integration — webhooks must be processed async, Jira's burst rate limits (enforced March 2026) require careful request throttling.
**Delivers:** Jira Cloud OAuth 2.0 (3LO) connection via `jira.js`; issue creation from workflow engine actions; `jira:issue_updated` webhook → workflow task status update; bidirectional linked issue display (issue key + URL chip in contractor/workflow views); Jira worklog import into `TimeEntry` records; points-based rate limit handling; guided setup wizard (no JQL required for basic config)
**Addresses:** Connect Jira workspace, create issues from workflows, bidirectional status sync, Jira time import (P2)
**Avoids:** Jira burst rate limit exhaustion, JQL-heavy webhook filters that degrade Jira performance, shared webhook handler
**Research flag:** Standard patterns — jira.js is well-documented. Bidirectional sync state machine needs explicit design during planning.

### Phase 8: Notion/Confluence and Calendar Integrations

**Rationale:** These are the two lightest integrations, both P3 priority, and can be built in any order once the OAuth credential store and webhook infrastructure are in place. Notion has no webhooks (polling only with `last_edited_time` filter), so it is link-and-reference only. Calendar is push-only (no bidirectional sync). Grouping them into one phase makes sense given their low individual complexity and similar infrastructure needs.
**Delivers:** Notion OAuth + page search + link-to-workflow + page ID storage (not URL); Confluence OAuth + page search + link-to-workflow; current page title fetched on display (resilient to page moves); "page not found" with re-link option when ID lookup fails; Google Calendar OAuth + event creation for contract deadlines and onboarding meetings; Microsoft Graph OAuth + Outlook calendar event creation; Google webhook subscription renewal cron (every 20h); Microsoft Graph subscription renewal cron (every 3 days); incremental sync tokens (Google syncToken, Graph deltaLink); contractor portal org branding; cross-system workflow templates
**Addresses:** Notion/Confluence doc linking and search, calendar deadline sync, meeting scheduling, portal branding (all P3)
**Avoids:** Notion content mirroring scope creep (anti-feature), bidirectional calendar sync (anti-feature), Google Calendar webhook expiry, Microsoft Graph validation handshake failures
**Research flag:** Calendar webhook subscription renewal lifecycle needs verification. All other patterns are well-documented.

### Phase Ordering Rationale

- **Infrastructure before integration:** Phase 1 (Integration Foundation) must precede all other phases. Every specific integration depends on the credential store, webhook router, and generic OAuth flow. This is the single highest-leverage decision in the v2.0 architecture.
- **Portal before time tracking:** The contractor portal (Phase 2) is the prerequisite for time tracking (Phase 6) because time entry is a portal UI feature and uses portal auth for data scoping.
- **OCR before KSeF:** OCR (Phase 3) establishes the async invoice pipeline that KSeF (Phase 5) plugs into. The unified OCR + KSeF intake pipeline can only be designed well when OCR is already working.
- **E-sign is independent but benefits from portal:** E-sign (Phase 4) works standalone (org sends signing links via email) without the portal, but delivering it after the portal means contractors can sign from within their portal session seamlessly.
- **KSeF despite urgency comes after OCR and e-sign:** KSeF is the highest regulatory priority but benefits significantly from patterns established in Phases 3 and 4. Teams should plan KSeF implementation to complete before April 1, 2026 regardless of exact phase boundaries — if schedule pressure is high, consider parallelizing Phase 4 and Phase 5.
- **Jira after time tracking foundation:** Jira (Phase 7) benefits from the time tracking data model being in place (Phase 6) so worklog import has a destination. The Jira connection itself can be built in isolation, but worklog sync requires the `TimeEntry` model.
- **Leaf features grouped last:** Notion/Confluence and calendar (Phase 8) have no downstream dependencies and can be deferred or cut without affecting any other v2.0 capability if schedule pressure requires.

### Research Flags

Phases needing deeper research during planning:
- **Phase 2 (Contractor Portal):** Magic-link auth implementation details against existing Better Auth setup; multi-org contractor context-switching UX (a contractor working for multiple orgs needs clean context switching); invite edge cases (expired invite, re-invite, contractor already exists via different org)
- **Phase 5 (KSeF):** FA(3) XML schema field mapping to existing Invoice model (300+ XML fields need mapping decisions); KSeF test environment authentication setup (api-test.ksef.mf.gov.pl); certificate auth migration architecture for Jan 2027 deadline

Phases with standard patterns (skip dedicated research-phase):
- **Phase 1 (Integration Foundation):** Extends existing Slack OAuth and Inngest patterns; encryption and credential storage are well-understood
- **Phase 3 (OCR):** Mindee SDK is well-documented with Node.js guide; review UI is standard React work; no novel patterns
- **Phase 4 (E-Sign):** Both DocuSign and Autenti have complete documentation and Postman collections; provider abstraction pattern is established
- **Phase 6 (Time Tracking):** Standard CRUD + reusing existing generic approval engine; Clockify API is simple REST
- **Phase 7 (Jira):** jira.js covers the full API; OAuth 2.0 (3LO) is well-documented by Atlassian
- **Phase 8 (Notion/Confluence/Calendar):** Well-documented official SDKs; main risk (webhook subscription renewal) is explicitly documented

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Official SDKs verified on npm for all major dependencies. Autenti has no Node.js SDK (custom client required — MEDIUM). KSeF client is single-maintainer (LOW-MEDIUM risk, fallback exists). All others HIGH. |
| Features | MEDIUM-HIGH | Verified against official APIs, competitor analysis (Deel, Faktura.pl), and regulatory documentation. Polish market specifics (KSeF mandatory dates, Autenti QES legal requirements) are MEDIUM — less community-validated. |
| Architecture | HIGH | Existing architecture well-understood. All integration patterns (provider abstraction, generalized OAuth, async pipelines) are established in the ecosystem. Portal auth model based on well-documented magic-link patterns. |
| Pitfalls | HIGH | Well-documented failure modes across all integration domains. KSeF pitfalls verified against government docs and third-party implementation guides. Integration security pitfalls cross-referenced with multiple sources. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **KSeF `@ksef/client` single-maintainer risk:** If the library becomes unmaintained, the fallback is generating a typed client from the government's OpenAPI 3.0.4 spec using `openapi-typescript` + `openapi-fetch`. Validate the library's health at Phase 5 planning time. Obtain the government OpenAPI spec regardless as a contingency artifact.
- **Autenti QES vs standard signature routing:** The business logic for when QES (qualified electronic signature) is required vs standard signature depends on Polish legal requirements for specific document types (employment contracts, IP transfer agreements, etc.). This needs legal/business input, not just API documentation. Resolve before Phase 4 begins.
- **KSeF certificate auth migration (Jan 2027):** Token-based auth works through end of 2026. Certificate-based auth is required from January 2027. Architecture for certificate management (storage, rotation, potential HSM consideration) must be designed during Phase 5 planning even if implementation is deferred.
- **Contractor multi-org access UX:** A contractor who works for multiple organizations needs to switch between org contexts in the portal. The `PortalSession` model handles a single org at a time — the UX for context-switching (choose org on login? switch org in-portal?) needs explicit design during Phase 2 planning. This is a functional gap in the current architecture design.
- **Mindee cost at scale:** At 500 orgs × 50 invoices/month × 2 pages average = 50K pages/month. Mindee's per-page pricing becomes material. Mitigations: skip OCR for KSeF-sourced invoices (already structured), cache `OcrResult` for re-submissions of identical PDFs, monitor per-org OCR page consumption.
- **Google Calendar API quota per project:** Google Calendar API quotas are per Google Cloud project. At scale (500+ active calendar integrations), a single project quota may be insufficient. Plan for quota monitoring and potential quota increase requests before Phase 8 launch.

## Sources

### Primary (HIGH confidence)
- [DocuSign Node.js SDK](https://developers.docusign.com/docs/esign-rest-api/sdks/node/) — e-sign SDK setup, embedded signing, webhook configuration
- [DocuSign Embedded Signing](https://developers.docusign.com/docs/esign-rest-api/esign101/concepts/embedding/) — embedded signing concepts, signing URL expiry (5 minutes)
- [Mindee Invoice OCR](https://developers.mindee.com/docs/nodejs-invoice-ocr) — OCR integration guide, confidence scores, line items
- [KSeF Official Portal](https://ksef.podatki.gov.pl/) — government documentation, test environment, authentication
- [jira.js GitHub](https://github.com/MrRefactoring/jira.js) — v5.3.1, TypeScript-first, near-100% API coverage
- [Jira Cloud OAuth 2.0 (3LO)](https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/) — OAuth flow documentation
- [Atlassian Rate Limiting](https://developer.atlassian.com/cloud/jira/platform/rate-limiting/) — burst limits and points-based quotas (March 2026)
- [Notion JavaScript SDK](https://github.com/makenotion/notion-sdk-js) — official SDK, API version 2026-03-11
- [Notion API Rate Limits](https://developers.notion.com/reference/request-limits) — 3 req/sec average, 2700 per 15-min window
- [Microsoft Graph Calendar API](https://learn.microsoft.com/en-us/graph/outlook-calendar-concept-overview) — Outlook Calendar API overview, subscription management
- [Google Calendar API Quickstart](https://developers.google.com/workspace/calendar/api/quickstart/nodejs) — official Node.js integration guide

### Secondary (MEDIUM confidence)
- [KSeF 2.0 API and FA(3) Schema Analysis](https://rtcsuite.com/understanding-polands-ksef-2-0-api-documentation-and-fa3-structure-key-changes-and-released-api-documentation/) — OpenAPI 3.0.4, FA(3) structure changes, mandatory timeline
- [KSeF E-Invoicing Poland Guide](https://marosavat.com/vat-news/e-invoicing-poland-guide-ksef) — Feb/April 2026 mandatory dates per company size
- [Autenti API v2](https://developers.autenti.com/docs/autenti-public-api-v2/overview) — REST API overview, OAuth2, QES support
- [Autenti API Postman Collection](https://www.postman.com/autenti-api/autenti-api/documentation/uzn9w70/autenti-api-v2) — endpoint reference
- [ksef-client-ts GitHub](https://github.com/lkow/ksef-client-ts) — v1.7.1, single maintainer, ESM-only, API 2.0 RC5.7
- [confluence.js docs](https://mrrefactoring.github.io/confluence.js/) — v2.1.0, same author as jira.js
- [Clockify API](https://docs.clockify.me/) — REST API reference, time entry endpoints
- [Deel Contractor Portal Analysis](https://www.deel.com/blog/features-any-deel-contractor-can-use/) — competitor feature comparison
- [OCR Invoice Accuracy Issues](https://planergy.com/blog/ocr-accuracy/) — real-world accuracy caveats for Polish documents
- [WorkOS Multi-Tenant RBAC](https://workos.com/blog/how-to-design-multi-tenant-rbac-saas) — trust boundary design patterns

### Tertiary (LOW confidence — validate during implementation)
- [Autenti Pricing](https://autenti.com/en/pricing/api) — per-signature pricing model; confirm directly with Autenti for volume pricing
- [Mindee Pricing](https://www.mindee.com/pricing) — per-page model; monitor costs during Phase 3 rollout
- [KSeF Certificate Auth Timeline](https://www.dudkowiak.com/tax-law-in-poland/e-invoicing-in-poland-ksef/) — Jan 2027 deadline; confirm against official Ministry of Finance communications before Phase 5

---
*Research completed: 2026-03-23*
*Ready for roadmap: yes*
