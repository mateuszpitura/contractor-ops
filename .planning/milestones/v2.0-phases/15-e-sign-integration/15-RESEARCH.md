# Phase 15: E-Sign Integration - Research

**Researched:** 2026-03-23
**Domain:** E-signature provider integration (DocuSign + Autenti)
**Confidence:** MEDIUM-HIGH

## Summary

Phase 15 integrates two e-signature providers (DocuSign and Autenti) into the existing contract management flow using the provider adapter pattern established in Phase 12. The core challenge is building a provider-agnostic abstraction layer that normalizes two fundamentally different APIs -- DocuSign's envelope-based model with a mature Node.js SDK, and Autenti's document-process-based REST API with no SDK -- into a unified signing interface.

The existing codebase already has strong foundations: the `IntegrationProviderAdapter` interface, `BaseAdapter` class, adapter registry, webhook dispatcher, credential encryption, and the `ExternalLink` model for mapping internal entities to external IDs. `PENDING_SIGNATURE` is already a `ContractStatus` enum value, but `SIGNATURE_DECLINED` and `SIGNATURE_EXPIRED` must be added to the Prisma schema, and `CONTRACT_TRANSITIONS` must be extended. The `DocumentSource.ESIGN` and `DocumentLinkRole.SIGNED_COPY` enum values already exist for storing signed PDFs.

**Primary recommendation:** Extend `IntegrationProviderAdapter` with an optional `ESignAdapter` interface. Build DocuSign adapter using the official `docusign-esign` SDK (v8.6.0) and Autenti adapter as a thin REST client using native `fetch`. Create a new `SigningEnvelope` model to track envelope lifecycle independent of either provider. Use `ExternalLink` to map envelopes to provider-specific IDs. Process signing status updates via webhooks using the existing Phase 12 infrastructure.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Build DocuSign and Autenti adapters simultaneously using a provider-agnostic abstraction layer. Both providers ship in Phase 15.
- **D-02:** Per-contract provider choice -- admin connects both providers via IntegrationConnection (Phase 12 infrastructure), then picks DocuSign or Autenti when sending each contract for signature. No org-wide default required.
- **D-03:** Embedded signing with redirect fallback -- try embedded (iframe/modal) first. If the provider or plan doesn't support embedded, fall back to redirect flow. Applies to both admin and portal signing views.
- **D-04:** Portal + email signing -- contractors can sign from the contractor portal (pending signatures on dashboard) OR from the email link sent by the provider. Email serves as fallback for contractors not using the portal.
- **D-05:** Full-page modal for embedded signing on admin side -- document fills the screen for readability. Close button returns to contract detail. Portal uses similar full-page approach.
- **D-06:** Dual trigger points -- "Send for Signature" button on contract detail header (sends main contract PDF) AND per-document action in the Documents tab (sends any attached document like NDAs, amendments individually).
- **D-07:** Full setup dialog with preview -- provider picker (DocuSign/Autenti), signer list auto-populated from contract parties, custom message field, document preview with signature placement markers, expiry date, and reminder settings.
- **D-08:** Contract status update on signing -- contract moves to "Pending Signature" status when sent. Returns to "Active" when all parties sign. Shows signing progress on contract list and detail. Integrates with existing workflow engine.
- **D-09:** Sequential with default order -- contractor signs first, then org representative countersigns. Admin can reorder signers in the setup dialog.
- **D-10:** Admin picks countersigner from org members -- signing setup dialog shows dropdown of org members. Admin selects who countersigns. Different contracts can have different countersigners.
- **D-11:** Decline/expiry handling -- contract status moves to "Signature Declined" or "Signature Expired". Admin gets notified (in-app + email) and can re-send or cancel. No auto-void.

### Claude's Discretion
- Provider-agnostic abstraction layer design (adapter pattern, interface shape)
- Webhook event processing for signing status updates (using Phase 12 webhook infrastructure)
- Signature field placement strategy (auto-detect vs manual placement in preview)
- Signing audit trail storage schema
- Portal pending signatures UI design (badge count, list vs cards)
- Notification templates for signing events (sent, completed, declined, expired)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SIGN-01 | User can send a contract or NDA for signature via DocuSign or Autenti | DocuSign `createEnvelope` + `docusign-esign` SDK; Autenti `Create_draft` + `Add_file` + `Add_participant` + `Actions` REST endpoints; provider-agnostic `ESignAdapter` interface |
| SIGN-02 | Signer can sign documents within Contractor Ops (embedded/redirect flow) | DocuSign `createRecipientView` generates signing URL for iframe embedding with postMessage events; Autenti provides redirect-based signing URLs; EmbeddedSigningModal component per UI-SPEC |
| SIGN-03 | Contracts support multi-party signing (contractor + org rep) in defined order | DocuSign `routingOrder` property on signers; Autenti `constraints` with `constrainedActions` on participants; `SigningEnvelope` model tracks per-signer status |
| SIGN-04 | Signed PDF is auto-saved to document management with signature audit trail | DocuSign `getDocument` API + Autenti `Download_file` endpoint; save to R2 via existing presigned URL service; create `Document` record with `source: ESIGN` and `DocumentLink` with role `SIGNED_COPY`; `SigningEvent` model for audit trail |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| docusign-esign | 8.6.0 | DocuSign eSignature API client | Official SDK, handles auth, envelope CRUD, recipient views, document download |
| native fetch | Node built-in | Autenti REST API client | No official Autenti npm SDK exists; REST API is simple enough for a thin wrapper |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @dnd-kit/core | 6.x | Drag-and-drop signer reorder | SignerList component in setup dialog per UI-SPEC |
| @dnd-kit/sortable | 10.x | Sortable list integration | Complements @dnd-kit/core for ordered signer list |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| docusign-esign SDK | Raw fetch to DocuSign REST API | SDK handles JWT auth flow, token refresh, API versioning automatically -- raw fetch would duplicate effort |
| @dnd-kit for reorder | react-beautiful-dnd | react-beautiful-dnd is unmaintained; @dnd-kit is the modern replacement with better a11y |
| Separate Autenti SDK | Build npm package | Unnecessary abstraction for ~5 endpoints; thin fetch wrapper in adapter is simpler |

**Installation:**
```bash
npm install docusign-esign @dnd-kit/core @dnd-kit/sortable
```

**Version verification:**
- `docusign-esign@8.6.0` -- verified via `npm view` on 2026-03-23
- `@dnd-kit/core` and `@dnd-kit/sortable` -- verify at implementation time

## Architecture Patterns

### Recommended Project Structure
```
packages/integrations/src/
  adapters/
    docusign-adapter.ts      # DocuSign ESignAdapter implementation
    autenti-adapter.ts       # Autenti ESignAdapter implementation
    register-all.ts          # Extended to register both new adapters
  services/
    esign-service.ts         # Provider-agnostic signing orchestration
    esign-webhook-handler.ts # Webhook processing for signing events
  types/
    esign.ts                 # ESignAdapter interface + shared types

packages/api/src/
  routers/
    esign.ts                 # tRPC router for signing operations
  services/
    esign-orchestrator.ts    # Business logic: create envelope, track status, save PDF

packages/db/prisma/schema/
  esign.prisma               # SigningEnvelope, SigningRecipient, SigningEvent models

apps/web/src/
  components/contracts/contract-detail/
    send-for-signature-button.tsx
    send-for-signature-dialog.tsx
    signing-progress-bar.tsx
    signing-status-badge.tsx
    signing-audit-trail.tsx
    embedded-signing-modal.tsx
    void-envelope-dialog.tsx
  components/portal/
    portal-pending-signatures.tsx
```

### Pattern 1: ESign Adapter Interface (extends existing adapter pattern)

**What:** A sub-interface of `IntegrationProviderAdapter` that defines e-signing capabilities. Each provider adapter implements this interface alongside the base adapter.

**When to use:** Any operation that interacts with the e-sign provider API.

**Example:**
```typescript
// packages/integrations/src/types/esign.ts

export interface SigningEnvelopeRequest {
  documentBase64: string;
  documentName: string;
  signers: SignerInfo[];
  message?: string;
  expiresInDays?: number;
  reminderIntervalDays?: number;
  embeddedReturnUrl?: string;
}

export interface SignerInfo {
  name: string;
  email: string;
  role: "signer" | "countersigner";
  routingOrder: number;
  clientUserId?: string; // For embedded signing
}

export interface SigningEnvelopeResult {
  externalEnvelopeId: string;
  status: string;
  signers: { externalRecipientId: string; email: string; status: string }[];
}

export interface EmbeddedSigningUrlResult {
  url: string;
  expiresAt?: string;
}

export interface SignedDocumentResult {
  documentBase64: string;
  mimeType: string;
  fileName: string;
}

export interface ESignAdapter {
  /** Create an envelope/document process and send for signature */
  createEnvelope(
    connectionId: string,
    request: SigningEnvelopeRequest,
  ): Promise<SigningEnvelopeResult>;

  /** Generate embedded signing URL for a specific recipient */
  getEmbeddedSigningUrl(
    connectionId: string,
    envelopeId: string,
    recipientEmail: string,
    returnUrl: string,
  ): Promise<EmbeddedSigningUrlResult>;

  /** Download the signed document from the provider */
  getSignedDocument(
    connectionId: string,
    envelopeId: string,
  ): Promise<SignedDocumentResult>;

  /** Get current envelope status from provider */
  getEnvelopeStatus(
    connectionId: string,
    envelopeId: string,
  ): Promise<SigningEnvelopeResult>;

  /** Void/cancel an in-progress envelope */
  voidEnvelope(
    connectionId: string,
    envelopeId: string,
    reason: string,
  ): Promise<void>;

  /** Resend signing notification to a specific recipient */
  resendToRecipient(
    connectionId: string,
    envelopeId: string,
    recipientEmail: string,
  ): Promise<void>;

  /** Whether this provider supports embedded signing */
  readonly supportsEmbeddedSigning: boolean;
}
```

### Pattern 2: SigningEnvelope Database Model

**What:** A local model that tracks the signing lifecycle independent of the provider. Links to Contract/Document via entity references. Signer statuses tracked in a child table.

**When to use:** All signing operations reference this model, not provider-specific IDs directly.

**Example schema (packages/db/prisma/schema/esign.prisma):**
```prisma
model SigningEnvelope {
  id                      String                @id @default(cuid())
  organizationId          String
  integrationConnectionId String
  provider                IntegrationProvider
  externalEnvelopeId      String
  contractId              String?
  documentId              String?
  status                  SigningEnvelopeStatus  @default(CREATED)
  message                 String?
  expiresAt               DateTime?
  reminderIntervalDays    Int?
  sentByUserId            String
  sentAt                  DateTime?
  completedAt             DateTime?
  voidedAt                DateTime?
  voidReason              String?
  createdAt               DateTime              @default(now())
  updatedAt               DateTime              @updatedAt

  organization            Organization          @relation(fields: [organizationId], references: [id])
  sentBy                  User                  @relation(fields: [sentByUserId], references: [id])
  recipients              SigningRecipient[]
  events                  SigningEvent[]

  @@index([organizationId])
  @@index([organizationId, contractId])
  @@index([organizationId, status])
  @@index([externalEnvelopeId])
}

model SigningRecipient {
  id                   String                    @id @default(cuid())
  signingEnvelopeId    String
  externalRecipientId  String?
  name                 String
  email                String
  role                 SigningRecipientRole
  routingOrder         Int
  status               SigningRecipientStatus     @default(PENDING)
  signedAt             DateTime?
  declinedAt           DateTime?
  declineReason        String?
  viewedAt             DateTime?

  signingEnvelope      SigningEnvelope             @relation(fields: [signingEnvelopeId], references: [id])

  @@index([signingEnvelopeId])
}

model SigningEvent {
  id                String             @id @default(cuid())
  organizationId    String
  signingEnvelopeId String
  eventType         SigningEventType
  actorName         String?
  actorEmail        String?
  description       String
  providerEventId   String?
  occurredAt        DateTime
  createdAt         DateTime           @default(now())

  organization      Organization       @relation(fields: [organizationId], references: [id])
  signingEnvelope   SigningEnvelope     @relation(fields: [signingEnvelopeId], references: [id])

  @@index([organizationId, signingEnvelopeId, occurredAt])
}

enum SigningEnvelopeStatus {
  CREATED
  SENT
  DELIVERED
  COMPLETED
  DECLINED
  VOIDED
  EXPIRED
}

enum SigningRecipientRole {
  SIGNER
  COUNTERSIGNER
}

enum SigningRecipientStatus {
  PENDING
  SENT
  DELIVERED
  VIEWED
  SIGNED
  DECLINED
}

enum SigningEventType {
  ENVELOPE_CREATED
  ENVELOPE_SENT
  RECIPIENT_VIEWED
  RECIPIENT_SIGNED
  RECIPIENT_DECLINED
  ENVELOPE_COMPLETED
  ENVELOPE_VOIDED
  ENVELOPE_EXPIRED
  SIGNED_PDF_SAVED
}
```

### Pattern 3: Webhook Processing for Signing Events

**What:** Extend the existing webhook infrastructure to handle DocuSign Connect and Autenti webhook callbacks. Each provider adapter implements `handleWebhook` to normalize events into `SigningEvent` records.

**When to use:** Asynchronous status updates from providers.

**Flow:**
1. Provider sends webhook to `/api/webhooks/docusign/route.ts` or `/api/webhooks/autenti/route.ts`
2. `dispatchWebhook` verifies signature via adapter
3. `logWebhookDelivery` records the raw payload
4. `queueWebhookProcessing` sends to QStash for async processing
5. Webhook handler maps provider event to internal status update
6. Updates `SigningEnvelope`, `SigningRecipient`, `Contract.status`
7. On `COMPLETED`: downloads signed PDF, stores in R2, creates `Document` record
8. Creates `Notification` for relevant users

### Pattern 4: DocuSign Embedded Signing Flow

**What:** DocuSign embedded signing uses `clientUserId` on recipients to enable in-app signing. The `createRecipientView` API generates a signing URL that loads in an iframe. DocuSign sends `postMessage` events back to the parent window.

**Key implementation details:**
1. When creating envelope, set `clientUserId` on each signer (marks as embedded)
2. Call `createRecipientView` with `returnUrl`, `frameAncestors`, and `messageOrigins`
3. `returnUrl` should point to a lightweight page that calls `window.postMessage` back to parent
4. Parent window listens for `signing_complete`, `decline`, `exception` events
5. `frameAncestors` must include the app's origin for CSP compliance

### Pattern 5: Autenti Document Process Flow

**What:** Autenti uses a multi-step REST API: create draft -> add files -> add participants -> send (perform action). No embedded signing -- Autenti provides redirect URLs. Status updates via webhook callbacks.

**Key implementation details:**
1. `POST /document-process` -- creates draft with title, description, language
2. `POST /document-process/{id}/files` -- upload PDF (multipart)
3. `POST /document-process/{id}/participants` -- add each signer with role, email, constraints
4. `POST /document-process/{id}/actions` with event_type `SEND` -- starts signing process
5. Participants receive email with signing link from Autenti
6. Webhook `Document Change` notifies on status changes
7. `GET /document-process/{id}/files?filePurpose=SIGNED` -- download signed PDF
8. Base URL: `https://api.autenti.com` (production), sandbox available for dev

### Anti-Patterns to Avoid
- **Coupling to provider data structures:** Never store DocuSign envelope JSON or Autenti document-process JSON directly. Always normalize to `SigningEnvelope`/`SigningRecipient` models.
- **Polling for status instead of webhooks:** Both providers support webhooks. Polling wastes API quota and adds latency.
- **Storing signing URLs in DB:** Signing URLs expire quickly (5 minutes for DocuSign). Generate on-demand when user clicks "Sign Now".
- **Synchronous PDF download in webhook handler:** Signed PDF download can be large. Queue it as a separate async task after envelope completion.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DocuSign API client | Raw HTTP calls to DocuSign | `docusign-esign` SDK v8.6.0 | SDK handles JWT auth, token refresh, API versioning, retries, proper serialization |
| E-signature legal compliance | Own signature capture/verification | DocuSign / Autenti providers | eIDAS/QES compliance requires certified providers (explicitly out of scope per REQUIREMENTS.md) |
| Signer drag reorder | Custom drag-and-drop | `@dnd-kit/core` + `@dnd-kit/sortable` | Accessible, performant, well-tested reorder behavior |
| Webhook signature verification | Manual HMAC verification | Provider-specific adapter `verifyWebhookSignature` | DocuSign uses HMAC-SHA256 with Connect secret; Autenti has its own scheme |
| Credential encryption | Custom crypto | Existing Phase 12 `credential-service.ts` | AES-256-GCM with per-provider keys already implemented |

**Key insight:** The e-sign domain has strict legal requirements (eIDAS, QES). The app is a signing orchestrator, not a signing engine. All cryptographic signature operations are delegated to certified providers.

## Common Pitfalls

### Pitfall 1: DocuSign Embedded Signing CSP/iframe Issues
**What goes wrong:** iframe-based signing fails with blank pages or blocked requests due to Content Security Policy or cross-origin restrictions.
**Why it happens:** Modern browsers block iframes from different origins unless CSP headers explicitly allow them. DocuSign signing pages need to be allowed as frame sources.
**How to avoid:** Set `frameAncestors` and `messageOrigins` in the `RecipientViewRequest` to your app's origin. Update `next.config.js` CSP headers to allow `frame-src` from DocuSign domains (`*.docusign.com`, `*.docusign.net`). Test in Chrome with strict site isolation.
**Warning signs:** Blank iframe, console errors about frame-ancestors, signing page loads but postMessage never fires.

### Pitfall 2: Autenti Has No Embedded Signing
**What goes wrong:** Attempting to render Autenti signing in an iframe fails because Autenti does not offer embedded signing -- only redirect-based.
**Why it happens:** Autenti's signing ceremony happens on their domain. They provide signing URLs for redirect, not for iframe embedding.
**How to avoid:** The `ESignAdapter.supportsEmbeddedSigning` flag controls behavior. For Autenti, always use redirect flow with the fallback UI from UI-SPEC (centered card with "Continue to Autenti" button). Handle return via callback URL parameter.
**Warning signs:** `X-Frame-Options: DENY` from Autenti URLs when attempting iframe.

### Pitfall 3: DocuSign Signing URL Expiration
**What goes wrong:** Users click "Sign Now" but get an error because the signing URL expired.
**Why it happens:** DocuSign `createRecipientView` URLs expire in 5 minutes. If pre-generated and stored, they will be stale.
**How to avoid:** Generate signing URLs on-demand when the user clicks the sign button. Never cache them. Show loading state while generating.
**Warning signs:** DocuSign returns "The token is expired" or redirects to error page.

### Pitfall 4: Missing Contract Status Values in Schema
**What goes wrong:** Attempting to set contract status to `SIGNATURE_DECLINED` or `SIGNATURE_EXPIRED` fails because these values do not exist in the Prisma `ContractStatus` enum.
**Why it happens:** The current schema has `PENDING_SIGNATURE` but not the decline/expiry states defined in the decisions.
**How to avoid:** Add `SIGNATURE_DECLINED` and `SIGNATURE_EXPIRED` to the `ContractStatus` enum in `contract.prisma` as the first task. Update `CONTRACT_TRANSITIONS` map to include new transition paths: `DRAFT -> PENDING_SIGNATURE`, `PENDING_SIGNATURE -> ACTIVE | SIGNATURE_DECLINED | SIGNATURE_EXPIRED | TERMINATED`.
**Warning signs:** Prisma migration errors, runtime "Invalid enum value" errors.

### Pitfall 5: Webhook Delivery Race Conditions
**What goes wrong:** Webhook arrives for envelope completion before the local `SigningEnvelope` record is created, or multiple webhooks arrive simultaneously causing duplicate processing.
**Why it happens:** Provider may send webhook faster than DB write completes. Network retries can deliver the same event multiple times.
**How to avoid:** Use `externalEnvelopeId` as idempotency key. Log webhook delivery first (exists in Phase 12), then process. If `SigningEnvelope` not found by external ID, re-queue with backoff. Deduplicate by checking `SigningEvent` for same `providerEventId`.
**Warning signs:** "Signing envelope not found" errors in webhook handler, duplicate events in audit trail.

### Pitfall 6: OAuth Scope Differences Between Providers
**What goes wrong:** Provider connection works for basic operations but fails for signing-specific API calls.
**Why it happens:** DocuSign requires `signature` scope (or `impersonation` for JWT); Autenti requires specific scopes for document process operations.
**How to avoid:** DocuSign adapter OAuth config must include `signature` scope. Autenti adapter must include `document-process:write` (or equivalent per their OAuth spec). Define scopes in adapter's `getOAuthConfig()`.
**Warning signs:** 403 Forbidden responses when creating envelopes despite valid connection.

### Pitfall 7: Large PDF Upload Timeout
**What goes wrong:** Sending large contracts for signature times out or fails.
**Why it happens:** Autenti requires multipart file upload; DocuSign requires base64 encoding. Large files (>10MB) can hit request size limits or timeout.
**How to avoid:** For DocuSign, the SDK handles base64 internally. For Autenti, stream the file upload. Set reasonable size limits (e.g., 25MB matching DocuSign's limit). Show progress indicator during upload.
**Warning signs:** 413 Payload Too Large, request timeout errors.

## Code Examples

### DocuSign: Create Envelope with Embedded Signing

```typescript
// Source: DocuSign eSign REST API documentation + SDK examples
import docusign from "docusign-esign";

async function createDocuSignEnvelope(
  accessToken: string,
  accountId: string,
  request: SigningEnvelopeRequest,
): Promise<SigningEnvelopeResult> {
  const apiClient = new docusign.ApiClient();
  apiClient.setBasePath("https://na4.docusign.net/restapi");
  apiClient.addDefaultHeader("Authorization", `Bearer ${accessToken}`);

  const envelopesApi = new docusign.EnvelopesApi(apiClient);

  // Build signer objects with routingOrder for sequential signing
  const signers = request.signers.map((s, i) => {
    const signer = new docusign.Signer();
    signer.email = s.email;
    signer.name = s.name;
    signer.recipientId = String(i + 1);
    signer.routingOrder = String(s.routingOrder);
    // clientUserId enables embedded signing
    signer.clientUserId = s.clientUserId ?? s.email;
    return signer;
  });

  const doc = new docusign.Document();
  doc.documentBase64 = request.documentBase64;
  doc.name = request.documentName;
  doc.fileExtension = "pdf";
  doc.documentId = "1";

  const envelopeDefinition = new docusign.EnvelopeDefinition();
  envelopeDefinition.emailSubject = request.message ?? "Please sign this document";
  envelopeDefinition.documents = [doc];
  envelopeDefinition.recipients = new docusign.Recipients();
  envelopeDefinition.recipients.signers = signers;
  envelopeDefinition.status = "sent";

  if (request.expiresInDays) {
    envelopeDefinition.notification = new docusign.Notification();
    envelopeDefinition.notification.expirations = new docusign.Expirations();
    envelopeDefinition.notification.expirations.expireEnabled = "true";
    envelopeDefinition.notification.expirations.expireAfter = String(request.expiresInDays);
  }

  const result = await envelopesApi.createEnvelope(accountId, {
    envelopeDefinition,
  });

  return {
    externalEnvelopeId: result.envelopeId!,
    status: result.status!,
    signers: signers.map((s) => ({
      externalRecipientId: s.recipientId!,
      email: s.email!,
      status: "sent",
    })),
  };
}
```

### DocuSign: Generate Embedded Signing URL

```typescript
// Source: DocuSign eSign REST API - RecipientViewRequest
async function getDocuSignSigningUrl(
  accessToken: string,
  accountId: string,
  envelopeId: string,
  signerEmail: string,
  signerName: string,
  clientUserId: string,
  returnUrl: string,
  appOrigin: string,
): Promise<string> {
  const apiClient = new docusign.ApiClient();
  apiClient.setBasePath("https://na4.docusign.net/restapi");
  apiClient.addDefaultHeader("Authorization", `Bearer ${accessToken}`);

  const envelopesApi = new docusign.EnvelopesApi(apiClient);

  const viewRequest = new docusign.RecipientViewRequest();
  viewRequest.returnUrl = returnUrl;
  viewRequest.authenticationMethod = "none";
  viewRequest.email = signerEmail;
  viewRequest.userName = signerName;
  viewRequest.clientUserId = clientUserId;
  // Required for iframe embedding
  viewRequest.frameAncestors = [appOrigin, "https://apps-d.docusign.com"];
  viewRequest.messageOrigins = [appOrigin];

  const result = await envelopesApi.createRecipientView(accountId, envelopeId, {
    recipientViewRequest: viewRequest,
  });

  return result.url!;
}
```

### Autenti: Create Document Process (REST)

```typescript
// Source: Autenti Document Process API v2 documentation
async function createAutentiDocumentProcess(
  accessToken: string,
  request: SigningEnvelopeRequest,
): Promise<string> {
  const baseUrl = "https://api.autenti.com";

  // Step 1: Create draft
  const draftRes = await fetch(`${baseUrl}/api/v2/document-process`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: request.documentName,
      description: request.message ?? "",
      processLanguage: "pl", // Default to Polish; make configurable
    }),
  });
  const draft = await draftRes.json();
  const documentProcessId = draft.id;

  // Step 2: Add file (PDF upload)
  const fileBuffer = Buffer.from(request.documentBase64, "base64");
  const formData = new FormData();
  formData.append("file", new Blob([fileBuffer], { type: "application/pdf" }), request.documentName);

  await fetch(`${baseUrl}/api/v2/document-process/${documentProcessId}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });

  // Step 3: Add participants
  for (const signer of request.signers) {
    await fetch(`${baseUrl}/api/v2/document-process/${documentProcessId}/participants`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        party: {
          firstName: signer.name.split(" ")[0],
          lastName: signer.name.split(" ").slice(1).join(" "),
          contacts: [{ type: "email", attributes: { email: signer.email } }],
        },
        role: "signer",
        constraints: [
          {
            constrainedActions: ["SIGN"],
            classifiers: ["SIGNATURE_BASIC_AUTENTI"],
          },
        ],
      }),
    });
  }

  // Step 4: Send for signature
  await fetch(`${baseUrl}/api/v2/document-process/${documentProcessId}/actions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ event_type: "SEND" }),
  });

  return documentProcessId;
}
```

### Webhook Handler: Normalize Provider Events

```typescript
// Source: Phase 12 webhook infrastructure pattern
async function handleSigningWebhook(
  provider: "DOCUSIGN" | "AUTENTI",
  payload: unknown,
  organizationId: string,
  connectionId: string,
): Promise<void> {
  // Normalize event from provider-specific format
  const event = normalizeSigningEvent(provider, payload);

  // Find local envelope by external ID
  const envelope = await prisma.signingEnvelope.findFirst({
    where: {
      externalEnvelopeId: event.externalEnvelopeId,
      organizationId,
    },
    include: { recipients: true },
  });

  if (!envelope) {
    // Re-queue with backoff if envelope not yet created
    throw new Error(`Envelope not found: ${event.externalEnvelopeId}`);
  }

  // Idempotency check
  const existing = await prisma.signingEvent.findFirst({
    where: {
      signingEnvelopeId: envelope.id,
      providerEventId: event.providerEventId,
    },
  });
  if (existing) return; // Already processed

  // Update envelope/recipient status + create audit event
  await prisma.$transaction(async (tx) => {
    // Create signing event for audit trail
    await tx.signingEvent.create({
      data: {
        organizationId,
        signingEnvelopeId: envelope.id,
        eventType: event.eventType,
        actorName: event.actorName,
        actorEmail: event.actorEmail,
        description: event.description,
        providerEventId: event.providerEventId,
        occurredAt: event.occurredAt,
      },
    });

    // Update recipient status if applicable
    if (event.recipientEmail) {
      await tx.signingRecipient.updateMany({
        where: {
          signingEnvelopeId: envelope.id,
          email: event.recipientEmail,
        },
        data: {
          status: event.recipientStatus,
          ...(event.eventType === "RECIPIENT_SIGNED" ? { signedAt: event.occurredAt } : {}),
          ...(event.eventType === "RECIPIENT_DECLINED" ? { declinedAt: event.occurredAt } : {}),
        },
      });
    }

    // Update envelope status
    if (event.envelopeStatus) {
      await tx.signingEnvelope.update({
        where: { id: envelope.id },
        data: {
          status: event.envelopeStatus,
          ...(event.envelopeStatus === "COMPLETED" ? { completedAt: event.occurredAt } : {}),
          ...(event.envelopeStatus === "VOIDED" ? { voidedAt: event.occurredAt } : {}),
        },
      });
    }

    // Update contract status based on envelope status
    if (envelope.contractId && event.envelopeStatus) {
      const contractStatusMap: Record<string, string> = {
        COMPLETED: "ACTIVE",
        DECLINED: "SIGNATURE_DECLINED",
        EXPIRED: "SIGNATURE_EXPIRED",
      };
      const newContractStatus = contractStatusMap[event.envelopeStatus];
      if (newContractStatus) {
        await tx.contract.update({
          where: { id: envelope.contractId },
          data: {
            status: newContractStatus as any,
            ...(newContractStatus === "ACTIVE" ? { signedAt: event.occurredAt } : {}),
          },
        });
      }
    }
  });

  // Post-transaction: download signed PDF on completion
  if (event.envelopeStatus === "COMPLETED") {
    await queueSignedPdfDownload(envelope.id, connectionId, provider);
  }

  // Post-transaction: send notifications
  if (["RECIPIENT_DECLINED", "ENVELOPE_EXPIRED", "ENVELOPE_COMPLETED"].includes(event.eventType)) {
    await sendSigningNotification(organizationId, envelope, event);
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| DocuSign SOAP API | REST API v2.1 | 2018+ | SDK v8.x uses REST exclusively |
| DocuSign OAuth password grant | JWT Bearer Grant or Auth Code | 2020 | Password grant deprecated; use JWT for server-to-server |
| iframe with returnUrl redirect | postMessage API for iframe events | 2022+ | Better UX -- no page reload, real-time event handling |
| DocuSign XML webhook payload | JSON webhook payload | 2023+ | `DocuSign Connect` supports JSON format; use `payloadFormat: "json"` |
| Autenti API v1 | Autenti API v2 ("bespin") | 2024 | v2 is current; v1 may be deprecated |

**Deprecated/outdated:**
- `docusign-esign` versions before 8.x: Major API changes in v8; do not use v7 or earlier
- DocuSign password grant authentication: Removed; use JWT or Auth Code
- Autenti API v1: Superseded by v2; documentation references "v2-bespin"

## Open Questions

1. **Autenti OAuth2 Scopes**
   - What we know: Autenti uses OAuth2, application registered via management panel, client_id/client_secret assigned
   - What's unclear: Exact required scopes for document process operations (not documented in publicly accessible sources)
   - Recommendation: During implementation, test with sandbox credentials. If scope issues arise, contact Autenti support (support@autenti.com). Start with broad scope and narrow down.

2. **Autenti Embedded Signing Support**
   - What we know: All evidence suggests Autenti only supports redirect-based signing, not embedded/iframe
   - What's unclear: Whether Autenti has added embedded signing in recent updates (their docs are hard to scrape)
   - Recommendation: Implement redirect fallback first (per D-03). If embedded becomes available, the abstraction layer makes it easy to add. Flag `supportsEmbeddedSigning: false` in Autenti adapter.

3. **DocuSign Account ID Discovery**
   - What we know: DocuSign API calls require an `accountId`. After OAuth, you call `getUserInfo` to get available accounts.
   - What's unclear: Whether to store accountId in `IntegrationConnection.configJson` or fetch dynamically
   - Recommendation: Store in `configJson` during OAuth callback. DocuSign accounts rarely change, and storing avoids an extra API call per operation.

4. **Autenti Sequential Signing (routingOrder)**
   - What we know: Autenti has `constraints` on participants with `constrainedActions`
   - What's unclear: Exact constraint configuration for enforcing sequential signing order
   - Recommendation: Test with sandbox. If Autenti does not support sequential constraints natively, implement by sending to second signer only after first completes (via webhook handler).

5. **Autenti QES vs Standard Signature**
   - What we know: STATE.md flags "Autenti QES vs standard signature routing needs legal/business input before Phase 15"
   - What's unclear: Whether to offer QES (Qualified Electronic Signature) option in the signing setup dialog
   - Recommendation: Start with standard signature (`SIGNATURE_BASIC_AUTENTI` classifier). QES requires additional identity verification and is a premium feature. Can be added later without architectural changes by adding a classifier picker.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via existing config) |
| Config file | `packages/integrations/vitest.config.ts`, `packages/api/vitest.config.ts` |
| Quick run command | `cd packages/integrations && npx vitest run --reporter=verbose` |
| Full suite command | `cd packages/integrations && npx vitest run && cd ../api && npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SIGN-01 | Create envelope via DocuSign adapter | unit | `cd packages/integrations && npx vitest run src/__tests__/docusign-adapter.test.ts -x` | Wave 0 |
| SIGN-01 | Create document process via Autenti adapter | unit | `cd packages/integrations && npx vitest run src/__tests__/autenti-adapter.test.ts -x` | Wave 0 |
| SIGN-02 | Generate embedded signing URL | unit | `cd packages/integrations && npx vitest run src/__tests__/docusign-adapter.test.ts -x` | Wave 0 |
| SIGN-03 | Multi-party sequential signing setup | unit | `cd packages/integrations && npx vitest run src/__tests__/esign-service.test.ts -x` | Wave 0 |
| SIGN-04 | Webhook handler updates status + saves PDF | unit | `cd packages/api && npx vitest run src/services/__tests__/esign-webhook-handler.test.ts -x` | Wave 0 |
| SIGN-04 | Signing audit trail events created | unit | `cd packages/api && npx vitest run src/services/__tests__/esign-webhook-handler.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd packages/integrations && npx vitest run --reporter=verbose`
- **Per wave merge:** Full suite across both packages
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/integrations/src/__tests__/docusign-adapter.test.ts` -- covers SIGN-01, SIGN-02
- [ ] `packages/integrations/src/__tests__/autenti-adapter.test.ts` -- covers SIGN-01
- [ ] `packages/integrations/src/__tests__/esign-service.test.ts` -- covers SIGN-03
- [ ] `packages/api/src/services/__tests__/esign-webhook-handler.test.ts` -- covers SIGN-04

## Sources

### Primary (HIGH confidence)
- DocuSign eSign REST API official docs -- envelope creation, embedded signing, webhook events
- DocuSign Node.js SDK GitHub repository -- SDK patterns, version 8.6.0
- Autenti Microsoft Power Automate Connector documentation -- complete API operation list, parameter schemas, webhook triggers
- Existing codebase: `packages/integrations/src/types/provider.ts`, `packages/db/prisma/schema/integration.prisma`, `packages/db/prisma/schema/contract.prisma`

### Secondary (MEDIUM confidence)
- Autenti Developer Portal (developers.autenti.com) -- API overview confirmed, but detailed endpoints could not be scraped (SPA rendering)
- Autenti Postman collection reference -- API v2 "bespin" confirmed as current version
- DocuSign community forums -- iframe postMessage event handling patterns

### Tertiary (LOW confidence)
- Autenti OAuth2 exact scopes -- not verified from official docs, inferred from OAuth2 standard + management panel flow
- Autenti sequential signing constraints -- exact configuration not confirmed; recommendation is to test with sandbox

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- DocuSign SDK verified via npm, Autenti REST API confirmed via multiple sources
- Architecture: HIGH -- Adapter pattern, webhook infrastructure, and database models follow established project patterns
- Pitfalls: MEDIUM-HIGH -- DocuSign pitfalls well-documented in community; Autenti pitfalls based on inference from limited docs
- Autenti API details: MEDIUM -- API operations confirmed via Microsoft connector docs, but exact request/response shapes need sandbox validation

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (30 days -- APIs are stable, SDKs update infrequently)
