# Architecture Research: v2.0 Platform Expansion

**Domain:** B2B contractor operations platform -- integration expansion
**Researched:** 2026-03-23
**Confidence:** HIGH (existing architecture well-understood, integration APIs documented)

## System Overview: v2.0 Additions

The existing architecture is a clean monorepo with well-separated concerns. v2.0 adds seven capability domains that integrate at specific seams. The diagram below shows **new components only** (marked with `[NEW]`) and their attachment points to existing infrastructure.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        apps/web (Next.js)                               │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │ [NEW] Portal │  │ Internal App │  │ [NEW] OAuth  │                   │
│  │ /portal/*    │  │ /dashboard/* │  │ Callbacks    │                   │
│  │ (contractor  │  │ (existing)   │  │ /api/oauth/* │                   │
│  │  self-serve) │  │              │  │ DocuSign,    │                   │
│  └──────┬───────┘  └──────┬───────┘  │ Autenti,     │                   │
│         │                 │          │ Jira, Google, │                   │
│         │                 │          │ Microsoft     │                   │
│         │                 │          └──────┬────────┘                   │
│  ┌──────┴─────────────────┴─────────────────┴───────────────────────┐   │
│  │                  [NEW] Webhook Routes                             │   │
│  │  /api/webhooks/docusign, /api/webhooks/autenti, /api/webhooks/ksef│   │
│  └──────────────────────────┬────────────────────────────────────────┘   │
├─────────────────────────────┼───────────────────────────────────────────┤
│                        packages/api (tRPC)                              │
│                                                                         │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐           │
│  │ [NEW]      │ │ [NEW]      │ │ [NEW]      │ │ [NEW]      │           │
│  │ portal.*   │ │ esign.*    │ │ ksef.*     │ │ calendar.* │           │
│  │ router     │ │ router     │ │ router     │ │ router     │           │
│  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘           │
│        │              │              │              │                   │
│  ┌─────┴──────────────┴──────────────┴──────────────┴───────────────┐   │
│  │                   [NEW] Services Layer                            │   │
│  │  ocr-service, esign-client, ksef-client, jira-client,            │   │
│  │  notion-client, confluence-client, calendar-client,               │   │
│  │  portal-auth-service, time-tracking-service                       │   │
│  └──────────────────────────┬────────────────────────────────────────┘   │
│                             │                                           │
│  ┌──────────────────────────┴────────────────────────────────────────┐   │
│  │            [EXISTING] Middleware Chain                             │   │
│  │  auth -> tenant -> rbac -> sensitive                               │   │
│  │  [NEW] portalAuth -> portalTenant (for portal routes)             │   │
│  └───────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────┤
│                        packages/db (Prisma)                             │
│                                                                         │
│  [NEW SCHEMAS]:                                                         │
│  portal.prisma    - PortalSession, PortalInvitation, TimeEntry          │
│  esign.prisma     - EsignEnvelope, EsignRecipient, EsignEvent          │
│  ocr.prisma       - OcrResult, OcrFieldExtraction                       │
│  ksef.prisma      - KsefSession, KsefInvoice, KsefSyncState            │
│                                                                         │
│  [MODIFIED SCHEMAS]:                                                    │
│  integration.prisma - Add NOTION, CONFLUENCE, CLOCKIFY to enum          │
│  invoice.prisma     - Add ocrResultId, ksefReferenceNumber fields       │
│  contract.prisma    - Add esignEnvelopeId, esignStatus fields           │
├─────────────────────────────────────────────────────────────────────────┤
│                    External Services                                    │
│                                                                         │
│  [NEW] Mindee API    [NEW] DocuSign API    [NEW] Autenti API            │
│  [NEW] KSeF 2.0 API  [NEW] Jira Cloud     [NEW] Notion API             │
│  [NEW] Confluence    [NEW] Google Calendar [NEW] Microsoft Graph        │
│  [EXISTING] Slack    [EXISTING] Resend     [EXISTING] R2                │
│  [EXISTING] Upstash Redis                                               │
└─────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### New Components

| Component | Responsibility | Attachment Point |
|-----------|----------------|------------------|
| Portal App (`/portal/*`) | Contractor-facing self-service UI: view contracts, submit invoices, track payments, upload docs, manage profile, log time | New Next.js route group under `apps/web`, separate layout, separate auth |
| Portal Auth Middleware | Magic-link-based auth for contractors (no password). Separate from Better Auth. Validates portal sessions independently | New middleware in `packages/api/src/middleware/portal-auth.ts` |
| OCR Service | Sends invoice PDFs to Mindee API, parses structured response, populates Invoice fields | New service in `packages/api/src/services/ocr-service.ts` |
| E-Sign Client | Abstracts DocuSign + Autenti behind unified interface. Creates envelopes, tracks signing status, handles webhooks | New service in `packages/api/src/services/esign-client.ts` with provider implementations |
| KSeF Client | Authenticates with KSeF 2.0 API, pulls invoices (batch/interactive), converts FA(3) XML to internal model, pushes outbound invoices | New service in `packages/api/src/services/ksef-client.ts` |
| Jira Client | Creates issues, syncs statuses bidirectionally, maps contractors to Jira users | New service in `packages/api/src/services/jira-client.ts` |
| Notion/Confluence Client | Links external docs to workflows and onboarding, embeds references | New service in `packages/api/src/services/docs-client.ts` |
| Calendar Client | Creates/syncs events in Outlook (Graph API) and Google Calendar. Deadline reminders, onboarding meetings | New service in `packages/api/src/services/calendar-client.ts` |
| Time Tracking Service | Accepts manual time entries from portal, pulls from Clockify/Jira, validates against contract hours | New service in `packages/api/src/services/time-tracking-service.ts` |

### Modified Components

| Component | Change | Reason |
|-----------|--------|--------|
| `integration.prisma` | Add enum values: `DOCUSIGN`, `AUTENTI`, `NOTION`, `CONFLUENCE`, `CLOCKIFY`, `GOOGLE_CALENDAR`, `MICROSOFT_365` (already exists) | IntegrationConnection model is generic -- reuse it for all new providers |
| `integrationRouter` | Generalize OAuth flow pattern from Slack to support all OAuth 2.0 providers | Currently Slack-specific; needs provider-agnostic OAuth state + callback |
| `invoice.prisma` | Add `ocrResultId`, `ksefReferenceNumber`, `ksefSessionId`, `ksefStatus` fields | Link invoices to OCR extraction results and KSeF tracking |
| `contract.prisma` | Add `esignEnvelopeId`, `esignStatus`, `esignCompletedAt` fields | Track e-sign state on contracts |
| `notification-service.ts` | Add portal notification channel (email to contractor) | Contractors need invoice status, payment, and contract notifications |
| Resend inbound webhook | After creating invoice, trigger OCR automatically | Currently creates invoice with zeroed fields -- OCR fills them |

## Recommended Project Structure (New Files Only)

```
packages/api/src/
├── middleware/
│   ├── portal-auth.ts           # [NEW] Magic link session validation
│   └── portal-tenant.ts         # [NEW] Tenant scoping for portal requests
├── routers/
│   ├── portal.ts                # [NEW] Portal-specific endpoints
│   ├── esign.ts                 # [NEW] E-sign management
│   ├── ksef.ts                  # [NEW] KSeF sync & status
│   ├── ocr.ts                   # [NEW] OCR trigger & results
│   ├── calendar.ts              # [NEW] Calendar event management
│   ├── time-tracking.ts         # [NEW] Time entry CRUD
│   └── integration.ts           # [MODIFIED] Generalize OAuth flows
├── services/
│   ├── ocr-service.ts           # [NEW] Mindee API integration
│   ├── esign/
│   │   ├── esign-client.ts      # [NEW] Unified interface
│   │   ├── docusign-provider.ts # [NEW] DocuSign implementation
│   │   └── autenti-provider.ts  # [NEW] Autenti implementation
│   ├── ksef-client.ts           # [NEW] KSeF 2.0 API client
│   ├── jira-client.ts           # [NEW] Jira Cloud API client
│   ├── docs-client.ts           # [NEW] Notion + Confluence unified
│   ├── calendar/
│   │   ├── calendar-client.ts   # [NEW] Unified interface
│   │   ├── google-provider.ts   # [NEW] Google Calendar impl
│   │   └── outlook-provider.ts  # [NEW] Microsoft Graph impl
│   ├── time-tracking-service.ts # [NEW] Time entry logic
│   └── portal-auth-service.ts   # [NEW] Magic link generation/validation

packages/db/prisma/schema/
├── portal.prisma                # [NEW] Portal sessions, time entries
├── esign.prisma                 # [NEW] E-sign envelopes, events
├── ocr.prisma                   # [NEW] OCR results
├── ksef.prisma                  # [NEW] KSeF sync state
├── integration.prisma           # [MODIFIED] New enum values
├── invoice.prisma               # [MODIFIED] OCR + KSeF fields
└── contract.prisma              # [MODIFIED] E-sign fields

packages/validators/src/
├── portal.ts                    # [NEW] Portal input schemas
├── esign.ts                     # [NEW] E-sign input schemas
├── ksef.ts                      # [NEW] KSeF input schemas
├── ocr.ts                       # [NEW] OCR input schemas
├── calendar.ts                  # [NEW] Calendar input schemas
└── time-tracking.ts             # [NEW] Time entry schemas

apps/web/src/app/
├── [locale]/portal/             # [NEW] Contractor portal pages
│   ├── layout.tsx               # Portal-specific layout (no sidebar)
│   ├── login/page.tsx           # Magic link request
│   ├── verify/page.tsx          # Magic link verification
│   ├── dashboard/page.tsx       # Contractor home
│   ├── contracts/page.tsx       # View contracts
│   ├── invoices/
│   │   ├── page.tsx             # List invoices
│   │   └── submit/page.tsx      # Submit new invoice
│   ├── payments/page.tsx        # Payment status
│   ├── time/page.tsx            # Time tracking
│   └── profile/page.tsx         # Edit profile/billing
├── api/
│   ├── webhooks/
│   │   ├── docusign/route.ts    # [NEW] DocuSign webhook handler
│   │   ├── autenti/route.ts     # [NEW] Autenti webhook handler
│   │   └── ksef/route.ts        # [NEW] KSeF notification handler
│   ├── oauth/
│   │   ├── docusign/route.ts    # [NEW] DocuSign OAuth callback
│   │   ├── autenti/route.ts     # [NEW] Autenti OAuth callback
│   │   ├── jira/route.ts        # [NEW] Jira OAuth callback
│   │   ├── google/route.ts      # [NEW] Google OAuth callback
│   │   ├── microsoft/route.ts   # [NEW] Microsoft OAuth callback
│   │   └── notion/route.ts      # [NEW] Notion OAuth callback
│   └── portal/
│       └── auth/route.ts        # [NEW] Portal magic link endpoints
```

### Structure Rationale

- **Portal as route group, not separate app:** Sharing tRPC client, validators, UI components, and i18n config avoids duplication. The portal gets its own layout and auth middleware but stays in `apps/web`.
- **Service provider pattern for e-sign and calendar:** DocuSign and Autenti have fundamentally different APIs (REST vs REST with different auth). A unified `EsignClient` interface with swappable providers keeps router code clean. Same for Google Calendar vs Microsoft Graph.
- **Per-domain Prisma schema files:** Matches existing convention (12 schema files currently). New domains get their own files.
- **OAuth callbacks centralized under `/api/oauth/`:** Cleaner than scattering across provider-specific paths. All follow the same pattern: verify state, exchange code, store credentials in IntegrationConnection.

## Architectural Patterns

### Pattern 1: Provider Abstraction for Multi-Vendor Features

**What:** Unified interface with swappable provider implementations for e-sign, calendar, and docs.
**When to use:** When two providers serve the same function (DocuSign/Autenti, Google/Outlook, Notion/Confluence).
**Trade-offs:** Small overhead of abstraction layer, but prevents provider-specific logic from leaking into business layer. Critical when orgs choose different providers.

```typescript
// packages/api/src/services/esign/esign-client.ts
interface EsignProvider {
  createEnvelope(params: CreateEnvelopeParams): Promise<EsignEnvelope>;
  getEnvelopeStatus(envelopeId: string): Promise<EsignStatus>;
  getSigningUrl(envelopeId: string, recipientId: string): Promise<string>;
  cancelEnvelope(envelopeId: string): Promise<void>;
  parseWebhook(payload: unknown, headers: Headers): Promise<EsignEvent>;
}

// Factory resolves provider from IntegrationConnection
function getEsignProvider(connection: IntegrationConnection): EsignProvider {
  switch (connection.provider) {
    case "DOCUSIGN": return new DocuSignProvider(connection);
    case "AUTENTI": return new AutentiProvider(connection);
    default: throw new Error(`Unsupported e-sign provider: ${connection.provider}`);
  }
}
```

### Pattern 2: Portal Auth as Separate Middleware Chain

**What:** Contractor portal uses magic-link sessions stored in a separate `PortalSession` table, validated by `portalAuth` middleware -- completely independent from Better Auth.
**When to use:** When external users (contractors) need access without being org members.
**Trade-offs:** Two auth systems to maintain, but contractors should never share the internal user session model. Keeps RBAC clean -- portal users have implicit "contractor" role, not the 8-role internal model.

```typescript
// packages/api/src/middleware/portal-auth.ts
const portalAuthMiddleware = t.middleware(async ({ ctx, next }) => {
  const token = ctx.req?.headers.get("x-portal-token");
  if (!token) throw new TRPCError({ code: "UNAUTHORIZED" });

  const session = await prisma.portalSession.findFirst({
    where: { token, expiresAt: { gt: new Date() }, verified: true },
    include: { contractor: true },
  });
  if (!session) throw new TRPCError({ code: "UNAUTHORIZED" });

  return tenantStore.run({ organizationId: session.organizationId }, () =>
    next({
      ctx: {
        ...ctx,
        portalSession: session,
        contractorId: session.contractorId,
        organizationId: session.organizationId,
      },
    })
  );
});

export const portalProcedure = publicProcedure.use(portalAuthMiddleware);
```

### Pattern 3: OCR-Then-Review Pipeline

**What:** Invoices flow through: Upload/Intake -> OCR Extraction -> Human Review -> Approval. OCR populates fields with confidence scores; humans confirm or correct.
**When to use:** Every invoice intake path (upload, email, portal submission).
**Trade-offs:** Adds latency to intake (Mindee API call ~2-5s), but saves 5-10 min of manual data entry per invoice. Non-blocking -- invoice is created immediately, OCR runs async.

```typescript
// After invoice creation (in email webhook, portal submit, or manual upload)
await redis.publish("invoice:ocr", JSON.stringify({
  invoiceId: invoice.id,
  documentId: document.id,
  organizationId: orgId,
}));

// OCR worker (cron-based queue consumer on Vercel)
async function processOcr(invoiceId: string, documentId: string) {
  const signedUrl = await generatePresignedUrl(document.storageKey);
  const result = await mindeeClient.parse(signedUrl);

  await prisma.ocrResult.create({
    data: {
      invoiceId,
      documentId,
      provider: "MINDEE",
      overallConfidence: result.confidence,
      extractedJson: result.fields,
      rawResponseJson: result.raw,
    },
  });

  // Auto-populate invoice fields if high confidence
  if (result.confidence > 0.9) {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: mapOcrToInvoiceFields(result),
    });
  }
}
```

### Pattern 4: KSeF Polling with Sync State

**What:** KSeF 2.0 does not push webhooks. The system polls KSeF periodically (via Vercel Cron), tracks sync state per org, and pulls new invoices since last sync.
**When to use:** KSeF invoice retrieval specifically.
**Trade-offs:** Polling adds delay (up to cron interval) vs real-time webhooks. Acceptable for invoice intake where 5-15 min delay is fine. Must track watermark to avoid duplicates.

### Pattern 5: Generalized OAuth Connection Flow

**What:** Extend the existing Slack OAuth pattern into a reusable flow for all OAuth 2.0 providers (DocuSign, Jira, Google, Microsoft, Notion).
**When to use:** Every new OAuth integration.
**Trade-offs:** Slight increase in abstraction, but eliminates duplicated OAuth boilerplate across 6+ providers.

```typescript
// Shared OAuth config registry
interface OAuthConfig {
  provider: IntegrationProvider;
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  redirectPath: string;
}

// All OAuth callbacks follow the same flow:
// 1. Verify HMAC state (CSRF) -- reuse existing generateOAuthState()
// 2. Exchange code for token at provider's token URL
// 3. Encrypt token with encryptToken() (existing pattern from Slack)
// 4. Upsert IntegrationConnection with provider + encrypted credentials
// 5. Redirect to settings with status query param
```

## Data Flow

### Invoice Intake Flow (v2.0 -- Three New Paths)

```
[1. Portal Submit]     [2. Email Intake]     [3. KSeF Pull]
       |                      |                     |
       v                      v                     v
  Upload PDF to R2     (existing flow)        KSeF API fetch
       |                      |                FA(3) XML parse
       v                      v                     |
  Create Invoice       Create Invoice          Create Invoice
  (source: PORTAL)     (source: EMAIL)         (source: KSEF)
       |                      |                     |
       +----------+-----------+                     |
                  v                                  |
            [OCR Service]                            |
            Mindee API call                    (already parsed
            Extract fields                      from XML)
            Store OcrResult                          |
                  |                                  |
                  v                                  v
            [Auto-populate fields with confidence scores]
                  |
                  v
            [Human Review]  <-- Contractor reviews in portal
                  |              or admin reviews in dashboard
                  v
            [Invoice Matching]  (existing)
                  |
                  v
            [Approval Flow]  (existing)
                  |
                  v
            [Payment Run]  (existing)
```

### Contract E-Sign Flow

```
[Admin Creates/Edits Contract]
       |
       v
[Select "Send for Signature"]
       |
       v
[E-Sign Service: createEnvelope()]
  - Upload contract PDF
  - Define signers (contractor + internal)
  - Set signing order
       |
       v
[DocuSign/Autenti processes]
  - Sends email to signers
  - Tracks signing progress
       |
       v
[Webhook: signing status update]
  - Update EsignEnvelope status
  - Update Contract.esignStatus
       |
       v
[All signed? -> Contract status = ACTIVE]
  - Store signed PDF in R2
  - Create Document record (source: ESIGN)
  - Link to contract
  - Notify admin + contractor
  - Trigger onboarding workflow if configured
```

### Contractor Portal Authentication Flow

```
[Contractor visits /portal/login]
       |
       v
[Enter email address]
       |
       v
[Server: lookup ContractorContact by email]
  - Verify contractor is ACTIVE in at least one org
  - Generate magic link token (CUID + 30min expiry)
  - Store PortalSession (token, contractorId, orgId, expiresAt)
  - Send email via Resend with magic link
       |
       v
[Contractor clicks link -> /portal/verify?token=xxx]
       |
       v
[Server: validate token, not expired]
  - Mark session as verified
  - Set HTTP-only cookie with session token
  - Redirect to /portal/dashboard
       |
       v
[Subsequent requests: portalAuth middleware]
  - Read cookie -> find PortalSession -> inject contractorId + orgId
  - All tRPC calls scoped to that contractor's data only
```

### Time Tracking Flow

```
[Contractor in Portal]
       |
       +-- Manual Entry: date, hours, description, project
       |
       +-- Clockify Import: pull entries via Clockify API
       |        (requires contractor to connect their Clockify)
       |
       +-- Jira Worklog Import: pull from Jira API
                (uses org's Jira connection + contractor mapping)
       |
       v
[TimeEntry records created]
  - Linked to contractor, contract, project
  - Validated against contract.expectedHoursPerPeriod
       |
       v
[Admin reviews in Time Tracking tab]
  - Approve/reject entries
  - Auto-populated on invoice matching
```

## Key Data Models (New)

### Portal Session

```prisma
model PortalSession {
  id             String    @id @default(cuid())
  organizationId String
  contractorId   String
  token          String    @unique
  email          String
  verified       Boolean   @default(false)
  expiresAt      DateTime
  lastAccessAt   DateTime?
  ipAddress      String?
  userAgent      String?
  createdAt      DateTime  @default(now())

  organization   Organization @relation(fields: [organizationId], references: [id])
  contractor     Contractor   @relation(fields: [contractorId], references: [id])

  @@index([organizationId])
  @@index([token])
  @@index([expiresAt])
}
```

### E-Sign Envelope

```prisma
model EsignEnvelope {
  id                      String              @id @default(cuid())
  organizationId          String
  integrationConnectionId String
  contractId              String?
  externalEnvelopeId      String
  provider                IntegrationProvider
  status                  EsignEnvelopeStatus @default(CREATED)
  documentStorageKey      String
  signedDocumentKey       String?
  sentAt                  DateTime?
  completedAt             DateTime?
  expiresAt               DateTime?
  metadataJson            Json?
  createdAt               DateTime            @default(now())
  updatedAt               DateTime            @updatedAt

  organization            Organization        @relation(fields: [organizationId], references: [id])
  recipients              EsignRecipient[]
  events                  EsignEvent[]

  @@index([organizationId])
  @@index([organizationId, contractId])
  @@index([externalEnvelopeId])
}

enum EsignEnvelopeStatus {
  CREATED
  SENT
  DELIVERED
  PARTIALLY_SIGNED
  COMPLETED
  DECLINED
  VOIDED
  EXPIRED
}
```

### OCR Result

```prisma
model OcrResult {
  id                String   @id @default(cuid())
  organizationId    String
  invoiceId         String
  documentId        String
  provider          String   @default("MINDEE")
  overallConfidence Decimal  @db.Decimal(5, 4)
  extractedJson     Json
  rawResponseJson   Json
  processedAt       DateTime @default(now())
  reviewedAt        DateTime?
  reviewedByUserId  String?

  organization      Organization @relation(fields: [organizationId], references: [id])
  invoice           Invoice      @relation(fields: [invoiceId], references: [id])

  @@index([organizationId])
  @@index([organizationId, invoiceId])
}
```

### Time Entry

```prisma
model TimeEntry {
  id               String          @id @default(cuid())
  organizationId   String
  contractorId     String
  contractId       String?
  projectId        String?
  date             DateTime        @db.Date
  hours            Decimal         @db.Decimal(5, 2)
  description      String?
  source           TimeEntrySource
  externalId       String?
  status           TimeEntryStatus @default(PENDING)
  approvedAt       DateTime?
  approvedByUserId String?
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt

  organization     Organization @relation(fields: [organizationId], references: [id])
  contractor       Contractor   @relation(fields: [contractorId], references: [id])
  contract         Contract?    @relation(fields: [contractId], references: [id])
  project          Project?     @relation(fields: [projectId], references: [id])

  @@index([organizationId])
  @@index([organizationId, contractorId, date])
  @@index([organizationId, contractId])
  @@index([organizationId, status])
}

enum TimeEntrySource {
  MANUAL
  CLOCKIFY
  JIRA
}

enum TimeEntryStatus {
  PENDING
  APPROVED
  REJECTED
}
```

### KSeF Sync State

```prisma
model KsefSyncState {
  id              String         @id @default(cuid())
  organizationId  String         @unique
  lastSyncAt      DateTime?
  lastInvoiceDate DateTime?
  sessionToken    String?
  tokenExpiresAt  DateTime?
  status          KsefSyncStatus @default(IDLE)
  errorMessage    String?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  organization    Organization   @relation(fields: [organizationId], references: [id])
}

enum KsefSyncStatus {
  IDLE
  SYNCING
  ERROR
}
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-500 orgs (current target) | Vercel serverless is fine. OCR calls are async via Redis queue. KSeF polling via Vercel Cron (1 org per cron invocation). All integrations use standard REST clients. |
| 500-5K orgs | KSeF polling needs batch processing -- fan out cron to process N orgs per invocation. OCR queue may need dedicated worker (not Vercel function). Consider connection pooling for 3rd-party APIs. |
| 5K+ orgs | Move integration syncs to dedicated worker service. KSeF needs rate limiting per org. OCR should batch requests. Calendar sync needs smart scheduling to avoid API quota exhaustion. |

### Scaling Priorities

1. **First bottleneck: KSeF polling at scale.** Each org needs periodic sync. At 1000 orgs with 5-min cron intervals, that is 200 orgs/minute. KSeF API has rate limits. Solution: stagger syncs, batch process, track per-org sync schedules.
2. **Second bottleneck: OCR API costs.** Mindee charges per page. At 50 invoices/org/month and 500 orgs, that is 25K pages/month. Solution: skip OCR for KSeF invoices (already structured), cache duplicate invoice OCR results.

## Anti-Patterns

### Anti-Pattern 1: Sharing Internal Auth with Portal

**What people do:** Make contractors into "users" with a restricted role in Better Auth.
**Why it's wrong:** Pollutes the internal user model, complicates RBAC (8 internal roles + contractor), creates security surface where a contractor could escalate to internal access. Better Auth's organization plugin assumes members are internal.
**Do this instead:** Separate PortalSession model with magic-link auth. Contractor identity stays in Contractor table. Portal middleware is independent.

### Anti-Pattern 2: Direct KSeF XML in Database

**What people do:** Store raw FA(3) XML blobs in the invoice table.
**Why it's wrong:** XML is 300+ fields. Querying, indexing, and reporting becomes impossible. Schema changes in FA(3) break existing records.
**Do this instead:** Parse XML on intake, map to Invoice + InvoiceLine models. Store raw XML in R2 as a Document (source: KSEF) for audit trail. Keep the KSeF reference number on the Invoice for cross-referencing.

### Anti-Pattern 3: Synchronous OCR in Request Path

**What people do:** Call Mindee API during the invoice upload request and block until results return.
**Why it's wrong:** OCR takes 2-10 seconds. User sees a spinner. If Mindee is down, upload fails.
**Do this instead:** Create the invoice immediately, trigger OCR async via Redis queue, show "Processing..." status in UI. Update via TanStack Query invalidation when OCR completes.

### Anti-Pattern 4: Provider-Specific Logic in Routers

**What people do:** Put DocuSign-specific API calls directly in the tRPC router handler.
**Why it's wrong:** When Autenti support is added, the router becomes a mess of conditionals. Testing requires mocking specific provider APIs.
**Do this instead:** Provider abstraction pattern. Router calls `esignClient.createEnvelope()`. Implementation dispatches to DocuSign or Autenti based on org's IntegrationConnection.

### Anti-Pattern 5: Calendar Sync Without Conflict Detection

**What people do:** Blindly create calendar events without checking for existing ones, leading to duplicates on re-sync.
**Why it's wrong:** Users get spammed with duplicate events. Deleting the integration leaves orphaned events.
**Do this instead:** Use ExternalLink table to track (entityId -> externalCalendarEventId) mapping. Check before creating. Support update and delete lifecycle.

## Integration Points

### External Services

| Service | Auth Pattern | Integration Pattern | Webhook Support | Notes |
|---------|-------------|---------------------|-----------------|-------|
| Mindee (OCR) | API key (header) | REST API call per document | No (poll result) | Pay-per-page pricing. 95%+ accuracy on invoices. Node.js SDK available. |
| DocuSign | OAuth 2.0 (JWT for backend, Auth Code for user) | REST API: create envelope, check status | Yes (Connect webhooks) | Use JWT Grant for automated sending. Webhook for status updates. |
| Autenti | OAuth 2.0 / API key | REST API v2 | Yes (webhooks for signing events) | Postman docs available. Important for Polish market (QES support). |
| KSeF 2.0 | Token auth + XAdES certificates | OpenAPI 3.0 REST | No (polling only) | XML FA(3) format. Batch and interactive modes. No Node.js SDK -- build client from OpenAPI spec. |
| Jira Cloud | OAuth 2.0 (3LO) | REST API v3 via jira.js library | Yes (webhooks for issue events) | jira.js provides full API coverage. Node 20+ required. |
| Notion | OAuth 2.0 (integration token) | REST API via @notionhq/client | No (polling only) | API version 2025-09-03. Read pages/databases, link to workflows. |
| Confluence Cloud | OAuth 2.0 (3LO) | REST API v2 via confluence.js | No (polling, or Atlassian Connect webhooks) | Shares OAuth app with Jira (same Atlassian developer console). |
| Google Calendar | OAuth 2.0 (Auth Code Grant) | REST API via googleapis library | Yes (push notifications via Pub/Sub) | Requires Google Cloud project. Calendar push uses webhook channels. |
| Microsoft Graph (Outlook) | OAuth 2.0 (Auth Code Grant) | REST API via @microsoft/microsoft-graph-client | Yes (change notifications/subscriptions) | Azure AD app registration. Supports calendar + mail + contacts. |
| Clockify | API key (per-user) | REST API | Yes (webhooks) | Contractor connects their own Clockify. Pull time entries by date range. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Portal UI <-> Portal API | tRPC (portalProcedure) | Same tRPC infrastructure but different middleware chain. Portal procedures use portalAuth instead of auth+tenant. |
| OCR Service <-> Invoice Router | Redis queue (async) | Invoice created first, OCR triggered as background job. Result linked via ocrResultId on Invoice. |
| KSeF Client <-> Invoice Pipeline | Vercel Cron -> Service call | Cron triggers sync. New invoices flow into existing matching/approval pipeline. |
| E-Sign Service <-> Contract Router | Direct service call + webhook | Create envelope synchronously. Status updates via webhook (async). |
| Calendar Client <-> Reminder/Contract | Event-driven via notification service | On contract deadline, onboarding start, etc. -- create/update calendar events. |
| Jira Client <-> Workflow Engine | Bidirectional sync | Workflow task completion -> update Jira issue. Jira status change webhook -> update workflow task. |

## Build Order (Dependency-Driven)

The recommended phase order considers data dependencies and incremental value delivery:

1. **Contractor Portal (foundation)** -- Requires new auth system, new route group, new UI layout. No external API dependencies. Unlocks contractor self-service as a platform.
2. **OCR Invoice Parsing** -- Depends on existing invoice pipeline. Single external API (Mindee). Enhances portal (contractors see auto-parsed invoices) and internal flow.
3. **E-Sign Integration** -- Depends on existing contract model. Adds DocuSign + Autenti. Natural follow-on: contracts created in portal can be sent for signing.
4. **KSeF Native Integration** -- Most complex. Depends on invoice pipeline. No Node.js SDK (must build from OpenAPI spec). Regulatory deadline pressure.
5. **Time Tracking** -- Depends on portal (primary UI is portal). Enhances invoice validation. Can import from Jira (if integrated) or Clockify.
6. **Jira Integration** -- Depends on generalized OAuth flow (built in earlier phases). Bidirectional sync with workflows.
7. **Notion/Confluence Integration** -- Lightest integration. Link docs to workflows. Read-only initially.
8. **Calendar Integration** -- Depends on generalized OAuth flow. Google + Microsoft. Enhances reminders.

**Rationale:** Portal first because it is the foundation for contractor-facing features (time tracking, invoice submission, contract viewing). OCR second because it immediately improves the core invoice flow for both portal and internal users. E-sign third because it directly enhances the contract lifecycle. KSeF fourth despite regulatory urgency because it is the most technically complex and benefits from patterns established in earlier phases. Remaining integrations are independent and can be parallelized.

## Sources

- [KSeF 2.0 API and FA(3) Schema Documentation](https://rtcsuite.com/understanding-polands-ksef-2-0-api-documentation-and-fa3-structure-key-changes-and-released-api-documentation/) -- MEDIUM confidence
- [DocuSign Node SDK](https://developers.docusign.com/docs/esign-rest-api/sdks/node/) -- HIGH confidence
- [Autenti API V2 (Postman)](https://www.postman.com/autenti-api/autenti-api/documentation/uzn9w70/autenti-api-v2) -- MEDIUM confidence
- [Mindee Invoice OCR API](https://developers.mindee.com/docs/nodejs-invoice-ocr) -- HIGH confidence
- [jira.js Library](https://mrrefactoring.github.io/jira.js/) -- HIGH confidence
- [Notion JavaScript SDK](https://github.com/makenotion/notion-sdk-js) -- HIGH confidence
- [confluence.js Library](https://mrrefactoring.github.io/confluence.js/) -- HIGH confidence
- [Microsoft Graph Calendar API](https://learn.microsoft.com/en-us/graph/outlook-calendar-concept-overview) -- HIGH confidence
- [Google Calendar API Quickstart](https://developers.google.com/workspace/calendar/api/quickstart/nodejs) -- HIGH confidence
- [KSeF Portal (Official)](https://ksef.podatki.gov.pl/) -- HIGH confidence
- [Jira Cloud OAuth 2.0 (3LO)](https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/) -- HIGH confidence
- [Notion API Developers](https://developers.notion.com/) -- HIGH confidence

---
*Architecture research for: Contractor Ops v2.0 Platform Expansion*
*Researched: 2026-03-23*
