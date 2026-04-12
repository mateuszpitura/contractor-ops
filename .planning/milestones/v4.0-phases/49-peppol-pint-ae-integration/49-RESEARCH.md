# Phase 49: Peppol PINT-AE Integration - Research

**Researched:** 2026-04-11
**Researcher:** Claude Opus (gsd-phase-researcher)

## Executive Summary

Phase 49 adds Peppol PINT-AE as the third country profile in `packages/einvoice`. The scope covers ASP adapter abstraction, outbound PINT-AE UBL 2.1 XML generation, inbound invoice reception via ASP webhook + polling, and QR code generation per UAE FTA requirements. The existing engine architecture (EInvoiceProfile, pipeline, registry) is well-suited for this addition — KSeF and ZATCA profiles serve as proven templates.

## 1. Peppol Network Architecture

### How Peppol Works
- **Four Corner Model:** Sender → Access Point (AP/ASP) → SML/SMP Lookup → Receiver's AP → Receiver
- **ASP (Accredited Service Provider):** Certified intermediary that connects organizations to the Peppol network. The ASP handles network-level concerns: SMP registration, AS4 message exchange, certificate management, network-level encryption
- **Participant ID:** Each party on Peppol has a unique identifier (e.g., `0088:7300010000001` for GLN, or `0192:123456789` for TRN/TIN). UAE organizations use scheme `0192` (UAE TRN - Tax Registration Number)
- **Document Exchange:** Invoices are transmitted as UBL 2.1 XML via AS4 protocol between access points. The sender's app generates UBL XML, sends to ASP via REST API, ASP handles AS4 transport

### What Our Platform Does vs What the ASP Does
| Responsibility | Our Platform | ASP |
|---|---|---|
| UBL 2.1 XML generation | Yes (PINT-AE profile) | No |
| XML validation | Yes (pre-submission) | Yes (post-receipt) |
| AS4 transport | No | Yes |
| SMP/SML registration | No (API call to ASP) | Yes |
| Certificate management | No (ASP-managed) | Yes |
| Network-level encryption | No | Yes |
| Delivery confirmation | Receive from ASP | Generate |
| Inbound invoice routing | Yes (parse + intake) | Yes (receive + forward) |

### Key Insight
Unlike ZATCA (where we handle crypto directly), Peppol abstracts the transport layer behind the ASP. Our integration is REST API-based — we send XML to ASP, ASP handles the network. This simplifies the implementation significantly compared to ZATCA.

## 2. PINT-AE (Peppol International for UAE)

### What is PINT-AE?
- PINT (Peppol International) is the international invoice specification for Peppol
- PINT-AE is the UAE localization of PINT, mandated by the UAE Ministry of Finance (MoF) and Federal Tax Authority (FTA)
- Based on UBL 2.1 Invoice schema with UAE-specific business rules and extensions
- Document ID: `urn:peppol:pint:billing-1@uae-1.0` (customization ID)
- Profile ID: `urn:peppol:bis:billing` (standard Peppol BIS Billing 3.0 profile)

### Mandatory PINT-AE Fields (Beyond Standard UBL 2.1)
1. **Invoice level:**
   - `cbc:CustomizationID` = `urn:peppol:pint:billing-1@uae-1.0`
   - `cbc:ProfileID` = `urn:peppol:bis:billing`
   - `cbc:InvoiceTypeCode` = 380 (invoice) or 381 (credit note)
   - `cbc:DocumentCurrencyCode` = `AED` (or other, but AED for UAE domestic)
   - `cbc:TaxCurrencyCode` (if different from document currency)
   - `cbc:BuyerReference` (mandatory for UAE)
   
2. **Supplier (AccountingSupplierParty):**
   - `cac:PartyIdentification/cbc:ID @schemeID="0192"` — UAE TRN
   - `cac:PartyLegalEntity/cbc:CompanyID` — Trade License number
   - `cac:PostalAddress` with `cbc:CountrySubentity` (Emirate)
   
3. **Customer (AccountingCustomerParty):**
   - Same TRN identification scheme
   - Postal address with Emirate
   
4. **Tax (TaxTotal):**
   - UAE VAT at 5% standard rate
   - Tax category codes: S (standard), Z (zero-rated), E (exempt), O (out of scope)
   - `cac:TaxScheme/cbc:ID` = `VAT`

5. **QR Code (per UAE FTA):**
   - Base64-encoded data containing: seller name, TRN, invoice date, total, VAT amount
   - Embedded as `cbc:EmbeddedDocumentBinaryObject` in `cac:AdditionalDocumentReference`
   - MIME type: `image/png`

### UAE-Specific Business Rules
- Invoices for UAE domestic B2B MUST include both supplier and buyer TRN
- Cross-border invoices require buyer's country-specific tax ID
- Reverse charge invoices use tax category `AE`
- UAE does not require digital signatures on Peppol invoices (unlike ZATCA) — the ASP handles AS4-level signing

## 3. ASP Vendor Evaluation

### Candidates (from STATE.md blocker)

| Criterion | Storecove | Pagero (now Thomson Reuters) | EDICOM |
|---|---|---|---|
| UAE Peppol ASP certified | Yes | Yes | Yes |
| REST API | Yes (OpenAPI 3.0) | Yes | Yes |
| Webhook support | Yes (configurable) | Yes | Yes |
| Sandbox environment | Yes (free) | Yes (request) | Yes (request) |
| Developer docs quality | Excellent (public) | Good (portal) | Good (portal) |
| Pricing model | Per-document | Per-document | Enterprise license |
| Inbound parsing | Returns UBL XML as-is | Returns UBL XML + metadata | Returns UBL XML + metadata |
| Delivery notifications | Webhook + polling | Webhook + polling | Webhook + polling |
| Multi-country | 60+ countries | 70+ countries | 80+ countries |
| Setup complexity | Low (API key) | Medium (onboarding) | Medium (onboarding) |

### Recommendation: Storecove
**Rationale:**
1. Best developer experience — public OpenAPI spec, comprehensive docs, free sandbox
2. Simplest onboarding — API key auth, no complex provisioning
3. REST-first API design aligns with our integration patterns
4. Strong multi-country support for future expansion
5. Per-document pricing scales well for our SaaS model

**But:** Abstract the ASP adapter interface (per D-01) so vendor can be swapped. Implement `StorecoveAdapter` as the first concrete adapter.

## 4. ASP Adapter Interface Design

### Abstract Interface

```typescript
interface ASPAdapter {
  readonly providerId: string;
  readonly displayName: string;
  
  // Participant management
  registerParticipant(params: RegisterParticipantParams): Promise<ParticipantRegistration>;
  getParticipantStatus(participantId: string): Promise<ParticipantStatus>;
  
  // Outbound
  transmitInvoice(params: TransmitInvoiceParams): Promise<TransmissionResult>;
  getTransmissionStatus(transmissionId: string): Promise<TransmissionStatus>;
  
  // Inbound
  parseWebhookPayload(rawBody: string, headers: Record<string, string>): Promise<InboundInvoicePayload>;
  verifyWebhookSignature(rawBody: string, headers: Record<string, string>): WebhookVerification;
  pollInboundInvoices(since: Date): Promise<InboundInvoicePayload[]>;
  
  // Health
  checkHealth(): Promise<ASPHealthStatus>;
}
```

### Key Types

```typescript
interface TransmitInvoiceParams {
  xml: string;
  senderParticipantId: string;
  receiverParticipantId: string;
  documentTypeId: string; // PINT-AE document type identifier
}

interface TransmissionResult {
  transmissionId: string;
  status: 'accepted' | 'rejected';
  timestamp: Date;
  errors?: { code: string; message: string }[];
}

interface TransmissionStatus {
  transmissionId: string;
  status: 'pending' | 'transmitted' | 'delivered' | 'failed';
  deliveredAt?: Date;
  failureReason?: string;
}

interface InboundInvoicePayload {
  documentId: string;
  senderParticipantId: string;
  receiverParticipantId: string;
  xml: string; // Raw UBL 2.1 XML
  receivedAt: Date;
  metadata: Record<string, unknown>;
}
```

## 5. Implementation Architecture

### File Structure

```
packages/einvoice/src/profiles/peppol-ae/
  index.ts          — PeppolAEProfile class (implements EInvoiceProfile + QRCodeable)
  generator.ts      — EInvoice → PINT-AE UBL 2.1 XML
  parser.ts         — PINT-AE UBL 2.1 XML → EInvoice
  validator.ts      — PINT-AE business rule validation
  qr-code.ts        — UAE QR code generation (Base64 PNG)
  schemas.ts        — Zod schemas for PINT-AE specific data
  constants.ts      — PINT-AE URNs, scheme IDs, tax categories

packages/einvoice/src/asp/
  types.ts          — ASPAdapter interface and shared types
  storecove/
    adapter.ts      — StorecoveAdapter (concrete ASP implementation)
    client.ts       — Storecove REST API client
    schemas.ts      — Storecove API response schemas
    types.ts        — Storecove-specific types

packages/api/src/services/
  peppol-orchestrator.ts  — Async outbound submission + inbound processing
  
packages/api/src/routers/
  peppol.ts               — tRPC router for Peppol operations

packages/db/prisma/schema/
  peppol.prisma           — Peppol-specific models (PeppolParticipant, PeppolTransmission)
```

### Data Model

```prisma
model PeppolParticipant {
  id               String   @id @default(cuid())
  organizationId   String
  participantId    String   // e.g., "0192:123456789012345"
  schemeId         String   // e.g., "0192"
  identifierValue  String   // e.g., "123456789012345" (TRN)
  aspProvider      String   // "storecove" etc.
  aspRegistrationId String? // External ID from ASP
  status           PeppolParticipantStatus @default(PENDING)
  registeredAt     DateTime?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  organization     Organization @relation(fields: [organizationId], references: [id])
  transmissions    PeppolTransmission[]

  @@unique([organizationId, participantId])
  @@index([organizationId])
}

model PeppolTransmission {
  id                String   @id @default(cuid())
  organizationId    String
  participantId     String
  invoiceId         String?
  direction         SyncDirection // INBOUND or OUTBOUND
  aspTransmissionId String?  // External ID from ASP
  documentTypeId    String?
  status            PeppolTransmissionStatus @default(PENDING)
  xmlPayload        String?  @db.Text // Store XML for audit
  errorMessage      String?
  transmittedAt     DateTime?
  deliveredAt       DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  organization      Organization @relation(fields: [organizationId], references: [id])
  participant       PeppolParticipant @relation(fields: [participantId], references: [id])

  @@index([organizationId])
  @@index([organizationId, status])
  @@index([organizationId, invoiceId])
  @@index([aspTransmissionId])
}

enum PeppolParticipantStatus {
  PENDING
  REGISTERED
  ACTIVE
  SUSPENDED
  DEREGISTERED
}

enum PeppolTransmissionStatus {
  PENDING
  TRANSMITTED
  DELIVERED
  FAILED
  REJECTED
}
```

### Integration Enum Extension

Add to `IntegrationProvider` enum:
```prisma
PEPPOL    // For IntegrationConnection + WebhookDelivery
```

Add to `InvoiceSource` enum:
```prisma
PEPPOL    // For inbound Peppol invoices
```

## 6. Outbound Invoice Flow

```
Invoice Created → QStash Job → Peppol Orchestrator:
  1. Load invoice + org Peppol participant
  2. Run einvoice pipeline (generate PINT-AE XML → validate → QR code)
  3. Create PeppolTransmission record (status: PENDING)
  4. Call ASP adapter.transmitInvoice()
  5. Update PeppolTransmission (status: TRANSMITTED, aspTransmissionId)
  6. ASP delivers to receiver's access point
  7. Webhook / polling updates status → DELIVERED or FAILED
```

### QStash Integration
- Reuse existing QStash publishing pattern from webhook route
- Outbound job URL: `/api/peppol/outbound` (internal API route)
- Retry: 3 attempts with exponential backoff (QStash default)
- Idempotency: PeppolTransmission ID as deduplication key

## 7. Inbound Invoice Flow

```
ASP receives invoice → Webhook to our platform:
  1. POST /api/webhooks/peppol (existing [provider] pattern)
  2. Verify webhook signature (ASP-specific)
  3. Log WebhookDelivery
  4. Queue via QStash to /api/peppol/inbound
  5. Peppol Orchestrator:
     a. Parse XML via PeppolAEProfile.parse()
     b. Create PeppolTransmission (direction: INBOUND)
     c. Map to Invoice model
     d. Create Invoice (source: PEPPOL) in intake queue
     e. Trigger existing invoice matching pipeline
```

### Polling Fallback
- QStash CRON job every 15 minutes
- Calls ASP adapter.pollInboundInvoices(lastPollTimestamp)
- Deduplicates against existing PeppolTransmission records by aspTransmissionId
- Creates invoices for any missed webhook deliveries

## 8. QR Code Implementation

### UAE FTA QR Code Requirements
- Contains: Seller name, TRN, invoice date, total amount, VAT amount
- Format: Base64-encoded data (simpler than ZATCA's TLV encoding)
- Rendered as PNG image
- Embedded in UBL XML as `cac:AdditionalDocumentReference` with `cbc:DocumentTypeCode` = "QR"

### Implementation
```typescript
class PeppolAEQRCode implements QRCodeable {
  async generateQR(invoice: EInvoice): Promise<Buffer> {
    // 1. Build QR data string: seller|TRN|date|total|VAT
    const qrData = [
      invoice.supplier.name,
      invoice.supplier.id, // TRN
      invoice.issueDate,
      (invoice.taxInclusiveAmount / 100).toFixed(2),
      (invoice.taxBreakdown.reduce((s, t) => s + t.taxAmountMinor, 0) / 100).toFixed(2),
    ].join('|');
    
    // 2. Generate QR code PNG using qrcode library
    return QRCode.toBuffer(qrData, { type: 'png', width: 200 });
  }
  
  async parseQR(data: Buffer): Promise<Partial<EInvoice>> {
    // Decode QR PNG → extract data string → parse fields
  }
}
```

### Library: `qrcode` (npm)
- Mature, well-maintained (10M+ weekly downloads)
- Supports PNG buffer output
- No native dependencies (pure JS)
- Already commonly used in Node.js projects

## 9. UI Components

### Settings > Integrations > Peppol
1. **Connection setup wizard:**
   - Step 1: Enter organization TRN (Tax Registration Number)
   - Step 2: Select ASP provider (initially only Storecove)
   - Step 3: Enter ASP API credentials
   - Step 4: Register Peppol Participant ID via ASP
   - Step 5: Confirm registration status
   
2. **Connection status card** (reuse existing IntegrationConnection pattern)

### Invoice Detail View
- Peppol transmission status badge (Pending / Transmitted / Delivered / Failed)
- Transmission timeline (sent → confirmed → delivered)
- Error details for failed transmissions

### Compliance Dashboard Widget
- Peppol profile status (active/degraded/error)
- Transmission statistics (sent/received/failed in period)
- Reuse existing compliance widget pattern from Phase 45

## 10. Dependencies & Risks

### Dependencies
- **Phase 45 (completed):** EInvoiceProfile, pipeline, registry — foundation for Peppol profile
- **Phase 48 (planned):** External secret store pattern (Infisical/Doppler) — ASP credentials should use the same store. If Phase 48 hasn't been executed yet, use existing AES-256-GCM credential encryption as fallback
- **xmlbuilder2:** Already used in the project for XML generation
- **fast-xml-parser:** Already used for KSeF XML parsing — reuse for PINT-AE parsing
- **qrcode (npm):** New dependency for QR code PNG generation

### Risks
1. **ASP Vendor Selection Blocker:** STATE.md notes Peppol ASP selection as procurement blocker. Mitigation: Abstract adapter pattern lets us start with any vendor and swap later. Recommend Storecove for initial implementation.
2. **PINT-AE Spec Stability:** UAE MoF may update PINT-AE business rules. Mitigation: Version the customization ID and validate against versioned rule sets.
3. **Phase 48 Secret Store Dependency:** If Phase 48 hasn't shipped when Phase 49 executes, use existing `credentialsRef` + AES-256-GCM pattern. Migration to external store can happen retroactively.

## 11. Testing Strategy

### Unit Tests
- `PeppolAEProfile.generate()` — UBL 2.1 XML output matches PINT-AE schema
- `PeppolAEProfile.parse()` — roundtrip: generate → parse → compare
- `PeppolAEProfile.validate()` — mandatory fields, UAE business rules
- `PeppolAEQRCode.generateQR()` — QR data contains required fields
- `StorecoveAdapter` — API client with mocked HTTP responses

### Integration Tests
- Full pipeline: EInvoice → generate → validate → QR → transmit (mocked ASP)
- Inbound flow: webhook → parse → create invoice
- Polling catch-up: missed webhook → polling → deduplicate

### Conformance Tests
- Profile registry: register PeppolAEProfile, retrieve by "peppol-ae"
- Pipeline integration: runPipeline with PeppolAEProfile produces valid result
- Capability detection: profile.qrCode is defined, profile.sign is undefined

## Validation Architecture

### Dimension Coverage
1. **Functional:** PEPPOL-01 through PEPPOL-04 — participant registration, outbound/inbound transmission, QR codes
2. **Integration:** ASP API connectivity, webhook reception, QStash job processing
3. **Data:** EInvoice ↔ PINT-AE XML roundtrip integrity, minor unit precision
4. **Security:** ASP credential encryption, webhook signature verification, tenant isolation
5. **Performance:** QStash async processing, polling frequency tuning
6. **Error handling:** ASP API failures, malformed XML, webhook verification failures
7. **Observability:** PeppolTransmission audit trail, IntegrationSyncLog entries
8. **Validation:** Per-invoice status tracking, compliance dashboard accuracy

---

## RESEARCH COMPLETE

Research covers all 4 PEPPOL requirements (PEPPOL-01 through PEPPOL-04) and provides architecture for ASP abstraction, PINT-AE XML generation/parsing, inbound/outbound flows, QR codes, and UI components.
