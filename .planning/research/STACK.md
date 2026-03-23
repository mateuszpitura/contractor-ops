# Stack Research: v2.0 Platform Expansion

**Domain:** Contractor operations platform -- new capabilities (contractor portal, e-sign, OCR, KSeF, integrations)
**Researched:** 2026-03-23
**Confidence:** MEDIUM-HIGH (most libraries verified via npm/GitHub; KSeF and Autenti ecosystems have less community validation)

> This document covers ONLY the stack additions for v2.0. The existing v1.0 stack (Next.js, tRPC, Prisma, Better Auth, Tailwind, shadcn/ui, etc.) is validated and unchanged. See previous STACK.md in git history for v1.0 stack rationale.

## Recommended Stack Additions

### E-Signature (DocuSign + Autenti)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `docusign-esign` | ^8.5.0 | DocuSign eSignature API client | Official SDK, actively maintained (published Dec 2025), full TypeScript types. Covers envelope creation, embedded signing, webhook callbacks, template management. 37+ npm dependents. The standard for e-sign in Node.js. |
| Custom REST client (Autenti) | N/A | Autenti e-signature integration | Autenti has no official Node.js SDK. Their API v2 is a standard REST API with OAuth2 (Client ID + Client Secret). Build a thin typed wrapper. PDF-in, signed-PDF-out model. Use their OpenAPI spec from developers.autenti.com to generate types with `openapi-typescript`. |

**Architecture decision:** Abstract both providers behind a common `ESignProvider` interface in a new `packages/esign` package. The interface handles: create signing request, generate embedded signing URL, check status, download signed document, process webhook. This lets you swap/add providers without touching business logic. Org settings determine which provider is active.

**Why two providers:** DocuSign is the global standard (required for international contractors). Autenti is Poland-native, cheaper for Polish B2B, and uses qualified electronic signatures (QES) recognized under eIDAS -- critical for Polish legal compliance.

### OCR Invoice Parsing

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `mindee` | ^4.27.1 | Invoice OCR -- extract structured data from PDF invoices | Best-in-class invoice parsing API with dedicated pre-trained Invoice model. MIT-licensed Node.js SDK. Extracts: supplier info, NIP/VAT numbers, line items, totals, dates, currency. Node.js >= 20 required (matches existing stack). Returns structured JSON that maps directly to the invoice schema. |

**Why Mindee over alternatives:**
- **Veryfi:** Good accuracy but more expensive, less transparent pricing, weaker TypeScript support.
- **Tesseract.js (self-hosted OCR):** Free but terrible accuracy on Polish invoices -- no pre-trained invoice model, requires building your own extraction pipeline. Not worth the engineering cost for a solo dev.
- **Google Document AI / Azure Form Recognizer:** Overkill infrastructure dependency. Mindee is SaaS with simple API key auth, no cloud provider lock-in.
- **Eden AI (aggregator):** Adds unnecessary abstraction layer and cost. Go direct to Mindee.

**Pricing consideration:** Mindee charges per page. For a B2B contractor platform processing 50-500 invoices/month, this is affordable. Free tier exists for development. Flag for cost monitoring at scale.

**Integration point:** OCR runs as an Inngest function triggered on invoice upload. Extract fields, pre-populate invoice form, present to user for confirmation before saving. Never auto-approve OCR results -- always human-in-the-loop.

### KSeF (National e-Invoice System)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@ksef/client` (ksef-client-ts) | ^1.7.1 | KSeF API v2 SDK for Poland's e-invoicing | Only actively maintained TypeScript KSeF client. Covers JWT auth (token + XAdES), session management, AES-256 encryption, invoice upload/download, UPO polling, permissions management. ESM-only, Node.js 20+. Targets API 2.0 RC5.7. Released March 2026 -- current with mandatory KSeF timeline. |
| `fast-xml-parser` | ^5.x | Parse/generate FA(3) XML schema for KSeF invoices | KSeF uses XML-based structured invoices (FA schema version 3). fast-xml-parser is the fastest pure JS XML parser, supports namespaces, validation, and building XML from objects. No native dependencies -- works in serverless. |
| `xml-crypto` | ^6.x | XAdES XML digital signatures for KSeF authentication | KSeF requires XAdES digital signatures for some auth flows. xml-crypto handles XML signature creation and verification. |

**Architecture decision:** Create a `packages/ksef` package that encapsulates all KSeF-specific logic: session lifecycle, invoice XML mapping (Prisma model <-> FA(3) XML), UPO management, rate limiting. The ksef-client-ts library handles transport; your package handles domain mapping.

**Risk (MEDIUM):** The ksef-client-ts library is maintained by a single developer. The KSeF API is still being finalized (RC5.7). Plan for the possibility of forking or writing a thin client from the OpenAPI 3.0.4 spec using `openapi-typescript` + `openapi-fetch`. Test against the KSeF test environment (test.ksef.podatki.gov.pl) from day one.

**KSeF timeline alignment:** Large companies mandatory from Feb 1, 2026. All businesses from April 1, 2026. Your target customers (10-200 people) fall into the April 1 wave. This feature is time-sensitive.

### Jira Integration

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `jira.js` | ^5.3.1 | Jira Cloud REST API client | Best TypeScript Jira client. Nearly 100% API coverage (v2/v3, Agile, Service Desk). Full type definitions included -- no @types needed. Node.js 20+, ESM/CJS dual support. Actively maintained (published March 2026). Same author maintains confluence.js -- consistent patterns. |

**Key Jira endpoints needed:**
- `issues.createIssue` / `issues.editIssue` -- create/update tickets on contractor events
- `issueWorklogs.getIssueWorklog` -- pull time entries for contractor time tracking
- `webhooks` -- receive status change notifications for automation
- `issueSearch.searchForIssuesUsingJql` -- find issues assigned to contractors

### Notion / Confluence Integration

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@notionhq/client` | ^2.x | Notion API -- link pages, search docs, embed references | Official SDK from Notion. TypeScript-first. Set `notionVersion: "2026-03-11"` for latest API. Covers page CRUD, database queries, block manipulation, search. |
| `confluence.js` | ^2.1.0 | Confluence Cloud API client | Same author as jira.js. Full TypeScript support, nearly 100% API coverage. Actively maintained (published Nov 2025). |

**Architecture decision:** Both Notion and Confluence serve the same purpose in this product: linking external documentation to onboarding workflows and contractor profiles. Abstract behind a `DocProvider` interface with methods like `searchPages(query)`, `getPageContent(id)`, `getPageUrl(id)`. This keeps the feature generic enough that adding Google Docs or SharePoint later is trivial.

**Scope note:** This is a link-and-reference integration, not a sync engine. You store the external page ID + URL + title in your database, display it in the UI, and link out. You do NOT replicate content into your system.

### Calendar Integration (Outlook + Google Calendar)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@microsoft/microsoft-graph-client` | ^3.0.7 | Microsoft Graph API -- Outlook Calendar events and scheduling | Official Microsoft SDK. Stable v3 line. Covers calendar CRUD, event creation, free/busy lookup, meeting scheduling. Combine with `@azure/identity` for OAuth2 token management. |
| `@microsoft/microsoft-graph-types` | latest | TypeScript type definitions for Graph API responses | Separate types package for full IntelliSense on calendar events, users, etc. |
| `@azure/identity` | ^4.x | Azure AD OAuth2 token management | Handles token acquisition, refresh, and caching for Microsoft Graph. Required companion to the Graph client. |
| `googleapis` | ^146.x | Google Calendar API v3 -- events, reminders, scheduling | Official Google SDK. Use `google.calendar({ version: 'v3' })`. OAuth2 for user calendars. |

**Architecture decision:** Abstract both calendar providers behind a `CalendarProvider` interface: `createEvent`, `updateEvent`, `deleteEvent`, `getFreeBusy`, `listEvents`. Store provider config + OAuth2 tokens per organization (some orgs use Google Workspace, some use Microsoft 365). Store encrypted refresh tokens in PostgreSQL, not Redis (persistence matters).

**Alternative considered:** `@microsoft/msgraph-sdk` v1.0.0-preview.80 is a newer TypeScript-first Microsoft Graph SDK. Still in preview -- not production-ready. Stick with `@microsoft/microsoft-graph-client` v3.0.7. Revisit when it reaches GA.

### Time Tracking (Contractor Portal)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Custom REST client (Clockify) | N/A | Clockify time tracking API integration | Clockify has no official Node.js SDK worth using. Their REST API is simple and well-documented (docs.clockify.me). Auth via API key header (`X-Api-Key`). Build a thin typed wrapper. Key endpoints: time entries, projects, workspaces. |
| Built-in time tracker | N/A | Manual time entry in contractor portal | For contractors not using Clockify or Jira. Simple time entry form: date, hours, project/contract, description. Store natively in your database. This is table stakes for the portal. |

**Jira time tracking:** Already covered by `jira.js` -- use the worklog API to pull time entries from Jira issues assigned to contractors. No additional dependency needed.

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `pdf-lib` | ^1.17.1 | PDF manipulation | Stamp "SIGNED" watermark on e-signed documents, add metadata to invoices before KSeF submission, merge multi-page documents. Works with Uint8Array from R2 storage. |
| `openapi-typescript` | ^7.x | Generate TypeScript types from OpenAPI specs | Generate typed interfaces from Autenti and KSeF OpenAPI specs. Dev dependency only -- types are generated at build time. |
| `openapi-fetch` | ^0.12.x | Type-safe fetch client from OpenAPI types | Pair with openapi-typescript for Autenti REST client. Tiny (2kB), type-safe, no runtime overhead. |
| `crypto` (Node.js built-in) | N/A | AES-256 encryption for KSeF batch sessions | KSeF requires encrypted payloads for batch operations. Use Node.js built-in -- no extra dependency. |

## New Monorepo Packages

```
packages/
  esign/          # DocuSign + Autenti abstraction (ESignProvider interface)
  ksef/           # KSeF client, XML mapping, session lifecycle
  integrations/   # Jira, Notion, Confluence, Clockify, Calendar providers
                  # Each provider implements a common interface
                  # OAuth2 token management shared across providers

apps/
  web/            # Existing -- add contractor portal routes (e.g., /portal/*)
                  # Do NOT create a separate app for the portal
                  # Use middleware + auth to gate portal vs admin routes
```

**Why NOT a separate portal app:** The contractor portal shares the same database, auth system, tRPC routers, and UI components. A separate Next.js app would duplicate infrastructure, complicate deployment, and create data sync issues. Use route groups (`app/(portal)/` and `app/(admin)/`) with middleware-based access control instead.

## Installation

```bash
# E-Sign
pnpm add docusign-esign

# OCR
pnpm add mindee

# KSeF
pnpm add @ksef/client fast-xml-parser xml-crypto

# Jira + Confluence (same ecosystem)
pnpm add jira.js confluence.js

# Notion
pnpm add @notionhq/client

# Calendar - Microsoft
pnpm add @microsoft/microsoft-graph-client @microsoft/microsoft-graph-types @azure/identity

# Calendar - Google
pnpm add googleapis

# PDF manipulation
pnpm add pdf-lib

# Dev dependencies
pnpm add -D openapi-typescript openapi-fetch @types/xml-crypto
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `mindee` (SaaS OCR) | Tesseract.js (self-hosted) | Only if you need zero external API calls and accept much lower accuracy on Polish invoices. Not recommended. |
| `mindee` (SaaS OCR) | Google Document AI | If already heavily invested in GCP and processing >10K invoices/month. |
| `@ksef/client` (community) | Custom client from OpenAPI spec | If ksef-client-ts becomes unmaintained. Generate a typed client with `openapi-typescript` + `openapi-fetch` from the government OpenAPI 3.0.4 spec. |
| `jira.js` | Direct Atlassian REST API calls | Never. jira.js wraps the full API with types. Only go direct for a single endpoint not yet covered. |
| `@microsoft/microsoft-graph-client` v3 | `@microsoft/msgraph-sdk` (preview) | When msgraph-sdk reaches v1.0 GA. Better TypeScript ergonomics but not production-ready yet. |
| `googleapis` (monolithic) | `@googleapis/calendar` (standalone) | If cold start times on Vercel become problematic. The standalone package is smaller. Either works. |
| Custom Autenti REST client | Wait for official SDK | If Autenti releases an official Node.js SDK. As of March 2026, none exists. |
| Custom Clockify REST client | `clockify-ts` (community) | Community package has minimal downloads and uncertain maintenance. Custom wrapper is safer. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `node-jira-client` / `jira-client` | Last published 3+ years ago, no TypeScript, stale API coverage | `jira.js` ^5.3.1 |
| `confluence-api` (npm) | Outdated, no TypeScript, minimal maintenance | `confluence.js` ^2.1.0 |
| Tesseract.js for invoice OCR | Poor accuracy on structured Polish documents, requires custom extraction pipeline | `mindee` ^4.27.1 |
| `@microsoft/msgraph-sdk` in production | Still preview (v1.0.0-preview.80), breaking changes likely | `@microsoft/microsoft-graph-client` ^3.0.7 |
| Raw `fetch` for KSeF | Complex auth (JWT + XAdES), session management, encryption -- rolling your own is weeks of work | `@ksef/client` ^1.7.1 |
| `docusign` (npm, unofficial) | Not the official package, stale | `docusign-esign` ^8.5.0 (official) |
| Multi-provider e-sign SaaS (SignNow, etc.) | Unnecessary abstraction. You need exactly DocuSign + Autenti. | Direct SDK/REST per provider behind your own interface |
| Separate Next.js app for contractor portal | Duplicates infrastructure, complicates deployment, creates data sync issues | Route groups + middleware in existing `apps/web` |

## OAuth2 Strategy (Cross-Cutting)

Six integrations require OAuth2: Google Calendar, Outlook/Microsoft Graph, Jira, Confluence, Notion, DocuSign. Use a consistent pattern:

1. **Token storage:** Encrypted in PostgreSQL (`integration_connections` table), scoped to `organization_id` + `integration_type`. Never store tokens in Redis (persistence risk on eviction).
2. **Token refresh:** Inngest cron function that refreshes tokens approaching expiry. Each provider has different token lifetimes (Google: 1hr access / permanent refresh, Microsoft: 1hr / 90 days, Atlassian: 1hr / permanent, DocuSign: 8hr / 30 days).
3. **Connection UI:** Settings page per integration with "Connect" button triggering OAuth2 authorization flow, "Disconnect" to revoke and delete tokens.
4. **Scopes:** Request minimal scopes. Google Calendar: `calendar.events`. Microsoft Graph: `Calendars.ReadWrite`. Jira: `read:jira-work write:jira-work`. Notion: default integration token scope. DocuSign: `signature`.
5. **Webhook verification:** DocuSign uses HMAC, Jira uses shared secret, KSeF uses session tokens. Each webhook endpoint verifies signatures before processing.

## Serverless Considerations (Vercel)

- **Cold starts:** `googleapis` is a large package (~45MB). Import only `google.calendar` to minimize bundle. Consider `@googleapis/calendar` standalone if cold starts exceed 3s.
- **Execution time:** Mindee OCR calls take 3-5 seconds per page. KSeF polling can take 10-30 seconds for batch operations. Offload to Inngest functions -- they handle long-running steps with `step.run()` and retries.
- **Webhook endpoints:** DocuSign, KSeF, Jira, and Clockify send webhooks. Use Next.js API routes (not tRPC) for webhook receivers -- they need raw body access for signature verification. Place in `app/api/webhooks/[provider]/route.ts`.
- **Bundle size:** The new dependencies add ~60MB to node_modules but most are server-only. Ensure none leak into client bundles via `"use server"` boundaries and proper package.json `exports`.

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@ksef/client` ^1.7.1 | Node.js 20+ | ESM-only. Verify tsconfig `moduleResolution: "bundler"` handles this. |
| `mindee` ^4.27.1 | Node.js >= 20 (22 recommended) | Matches existing stack requirement. |
| `jira.js` ^5.3.1 | Node.js 20+ | ESM/CJS dual support. |
| `confluence.js` ^2.1.0 | Node.js 20+ | Same author as jira.js, same patterns. |
| `docusign-esign` ^8.5.0 | Node.js 18+ | Broad compatibility, no issues. |
| `@notionhq/client` ^2.x | Node.js 12+ | Very permissive. Use `notionVersion: "2026-03-11"` for latest API features. |
| `googleapis` ^146.x | Node.js 14+ | Large package but works fine on Vercel Pro. |
| `@microsoft/microsoft-graph-client` ^3.0.7 | Node.js 12+ | Stable, well-tested. |
| `fast-xml-parser` ^5.x | Node.js 14+ | Pure JS, zero native dependencies. |
| All v2.0 packages | Prisma 6.x/7.x | No direct Prisma dependency -- integration data stored via your existing Prisma models. |

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| DocuSign SDK | HIGH | Official SDK, 8.5.0 verified on npm, well-documented, large community |
| Autenti integration | MEDIUM | No Node.js SDK exists. REST API documented but less community experience. Need to build custom client. |
| Mindee OCR | HIGH | v4.27.1 verified, MIT license, dedicated invoice model, clear docs |
| KSeF integration | LOW-MEDIUM | ksef-client-ts is single-maintainer. KSeF API still RC. Government APIs can be unreliable. Test environment required early. |
| Jira / Confluence (jira.js) | HIGH | v5.3.1 verified, TypeScript-first, near-complete API coverage, actively maintained |
| Notion SDK | HIGH | Official SDK from Notion, TypeScript, latest API version 2026-03-11 supported |
| Microsoft Graph (Outlook) | HIGH | Official SDK, stable v3, extensive documentation on Microsoft Learn |
| Google Calendar | HIGH | Official googleapis package, well-documented quickstarts |
| Clockify integration | MEDIUM | Simple REST API but no official SDK. Custom wrapper straightforward but untested at scale. |
| Time tracking (built-in) | HIGH | Standard CRUD -- no external dependency risk |

## Sources

- [docusign-esign npm](https://www.npmjs.com/package/docusign-esign) -- v8.5.0 verified
- [DocuSign Node.js SDK docs](https://developers.docusign.com/docs/esign-rest-api/sdks/node/) -- setup, configuration, examples
- [Autenti API v2 overview](https://developers.autenti.com/docs/autenti-public-api-v2/overview) -- REST API, OAuth2 auth
- [Autenti API v2 Postman collection](https://www.postman.com/autenti-api/autenti-api/documentation/uzn9w70/autenti-api-v2) -- endpoint reference
- [mindee npm](https://www.npmjs.com/package/mindee) -- v4.27.1 verified
- [Mindee Invoice OCR Node.js](https://developers.mindee.com/docs/nodejs-invoice-ocr) -- integration guide
- [Mindee pricing](https://www.mindee.com/pricing) -- per-page model
- [ksef-client-ts GitHub](https://github.com/lkow/ksef-client-ts) -- v1.7.1, API 2.0 RC5.7, ESM-only
- [KSeF official portal](https://ksef.podatki.gov.pl/) -- government docs
- [KSeF 2.0 API + FA(3) schema analysis](https://rtcsuite.com/understanding-polands-ksef-2-0-api-documentation-and-fa3-structure-key-changes-and-released-api-documentation/) -- OpenAPI 3.0.4, timeline
- [Poland KSeF timeline](https://marosavat.com/vat-news/e-invoicing-poland-guide-ksef) -- Feb/April 2026 mandatory dates
- [jira.js GitHub](https://github.com/MrRefactoring/jira.js) -- v5.3.1, TypeScript, 100% API coverage
- [confluence.js docs](https://mrrefactoring.github.io/confluence.js/) -- v2.1.0, same maintainer
- [@notionhq/client GitHub](https://github.com/makenotion/notion-sdk-js) -- official, API 2026-03-11
- [@microsoft/microsoft-graph-client npm](https://www.npmjs.com/package/@microsoft/microsoft-graph-client) -- v3.0.7
- [Outlook Calendar API overview](https://learn.microsoft.com/en-us/graph/outlook-calendar-concept-overview) -- Microsoft Learn
- [Google Calendar API Node.js quickstart](https://developers.google.com/workspace/calendar/api/quickstart/nodejs) -- official guide
- [@googleapis/calendar npm](https://www.npmjs.com/package/@googleapis/calendar) -- v14.2.0
- [Clockify API docs](https://docs.clockify.me/) -- REST API reference

---
*Stack research for: Contractor Ops v2.0 Platform Expansion*
*Researched: 2026-03-23*
