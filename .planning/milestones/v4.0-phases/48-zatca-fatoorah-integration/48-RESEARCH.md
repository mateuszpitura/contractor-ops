# Phase 48: ZATCA Fatoorah Integration — Research

**Researched:** 2026-04-11
**Phase Goal:** Saudi organizations can submit e-invoices to ZATCA for clearance (B2B) and reporting (B2C) with full cryptographic compliance
**Requirements:** ZATCA-01, ZATCA-02, ZATCA-03, ZATCA-04, ZATCA-05, ZATCA-06, ZATCA-07

---

## 1. ZATCA E-Invoicing Technical Specification Summary

### Invoice Types
ZATCA defines two invoice categories:
- **Standard Tax Invoice (B2B):** Requires clearance — submitted to ZATCA before sharing with buyer. Uses `invoiceTypeCode: "388"` with subtypes `0100000` (standard) and `0100001` (third-party).
- **Simplified Tax Invoice (B2C):** Requires reporting — submitted to ZATCA within 24 hours. Uses `invoiceTypeCode: "388"` with subtypes `0200000` (simplified) and `0200001` (third-party simplified).

Both types also support credit notes (`invoiceTypeCode: "381"`) and debit notes (`invoiceTypeCode: "383"`).

### UBL 2.1 Extensions
ZATCA invoices use UBL 2.1 with Saudi-specific extensions:
- `UBLExtensions` element containing the XAdES signature
- `ProfileID: "reporting:1.0"` for B2C, `"clearance:1.0"` for B2B (proposal name only — actual values from latest ZATCA spec)
- `AdditionalDocumentReference` with `ICV` (Invoice Counter Value) and `PIH` (Previous Invoice Hash)
- `cbc:InvoiceTypeCode @name` attribute for subtype identification
- Custom `TaxCategory` with ZATCA-specific tax exemption reason codes

### Mandatory Fields (beyond standard UBL)
1. **Invoice Counter Value (ICV):** Sequential integer per organization, monotonically increasing
2. **Previous Invoice Hash (PIH):** SHA-256 hash of the previous invoice XML for this organization
3. **UUID:** Unique identifier per invoice (UUID v4)
4. **QR Code data** embedded in `AdditionalDocumentReference`

## 2. XAdES Enveloped Digital Signatures

### Signature Architecture
ZATCA requires XAdES-BES (Basic Electronic Signature) enveloped signatures:

1. **Canonicalization:** Exclusive XML Canonicalization (http://www.w3.org/2001/10/xml-exc-c14n#)
2. **Digest Algorithm:** SHA-256
3. **Signature Algorithm:** ECDSA with SHA-256 (using the ZATCA-issued certificate which uses NIST P-256 curve) OR RSA-SHA256 depending on CSR key type
4. **Certificate:** X.509 v3 certificate issued by ZATCA during onboarding

### Signing Pipeline
1. Generate unsigned UBL 2.1 XML
2. Compute the document hash (SHA-256 of canonicalized XML)
3. Create `SignedProperties` with:
   - Signing time
   - Signing certificate digest (SHA-256 of the X.509 DER certificate)
   - Signing certificate V2 (issuer serial)
4. Create `SignedInfo` referencing the document and `SignedProperties`
5. Compute ECDSA/RSA signature over canonicalized `SignedInfo`
6. Embed the `Signature` element inside `UBLExtensions/ExtensionContent`

### Implementation with xml-crypto
The `xml-crypto` library supports:
- Custom canonicalization
- Custom key info providers (for X.509 certificate embedding)
- XAdES-compatible reference construction

However, XAdES-specific `SignedProperties` (signing certificate digest, signing time) must be manually constructed. The library provides XML DSig core; XAdES wrapping is our responsibility.

**Approach:** Build a `ZatcaXAdESigner` class:
- Uses `xml-crypto`'s `SignedXml` for core XML DSig operations
- Manually constructs XAdES `QualifyingProperties > SignedProperties`
- Custom `KeyInfoProvider` that embeds the X.509 certificate
- Template-based signature structure matching ZATCA's expected layout

## 3. TLV-Encoded QR Codes

### Tag-Length-Value Encoding
ZATCA QR codes use TLV binary encoding with these tags:

| Tag | Field | Value Source |
|-----|-------|-------------|
| 1 | Seller Name | `supplier.name` |
| 2 | VAT Number | `supplier.id` (Saudi TIN) |
| 3 | Timestamp | ISO 8601 with timezone |
| 4 | Invoice Total (with VAT) | `taxInclusiveAmount` (as decimal string) |
| 5 | VAT Amount | Sum of `taxBreakdown[].taxAmountMinor` (as decimal string) |
| 6 | Invoice Hash | SHA-256 of the signed XML |
| 7 | ECDSA Signature | Digital signature value |
| 8 | Public Key | ECDSA public key (from certificate) |

**Phase 2 (B2B) tags 6-8 are mandatory.** Phase 1 (B2C simplified) only requires tags 1-5.

### Encoding Implementation
```
TLV = concat(
  tag(1 byte) + length(1-2 bytes) + value(UTF-8 bytes),
  ...for each field
)
QR = base64(TLV)
```

For QR image generation, use `qrcode` npm package (mature, zero-dep for Node.js Buffer output).

## 4. Invoice Hash Chain

### Design
Each organization maintains a sequential chain:
- **ICV (Invoice Counter Value):** Integer, starts at 1, incremented per invoice
- **PIH (Previous Invoice Hash):** SHA-256 of the previous invoice's signed XML
- First invoice in chain: PIH = SHA-256 of `"0"` (the literal string zero)

### Storage Model
New Prisma model or extend existing:

```prisma
model ZatcaInvoiceChain {
  id               String   @id @default(cuid())
  organizationId   String
  icv              Int      // Invoice Counter Value (monotonically increasing)
  invoiceId        String   @unique // FK to Invoice
  invoiceHash      String   // SHA-256 hex of the signed XML
  previousHash     String   // PIH — hash of previous invoice in chain
  zatcaUuid        String   @unique // UUID v4 per ZATCA invoice
  zatcaStatus      ZatcaSubmissionStatus @default(PENDING)
  zatcaResponse    Json?    // Raw ZATCA API response
  submittedAt      DateTime?
  clearedAt        DateTime?
  reportedAt       DateTime?
  rejectedAt       DateTime?
  rejectionReason  String?
  createdAt        DateTime @default(now())

  organization     Organization @relation(fields: [organizationId], references: [id])
  invoice          Invoice      @relation(fields: [invoiceId], references: [id])

  @@unique([organizationId, icv])
  @@index([organizationId])
  @@index([organizationId, zatcaStatus])
}

enum ZatcaSubmissionStatus {
  PENDING
  SUBMITTED
  CLEARED       // B2B — ZATCA approved
  REPORTED      // B2C — ZATCA acknowledged
  REJECTED
  WARNING       // Cleared/reported with warnings
}
```

### Sequential Processing
Per D-03: Use a per-org mutex to enforce sequential invoice processing.

**Recommended approach:** Database advisory lock via `SELECT pg_advisory_xact_lock(hashtext(organizationId))` within a transaction. QStash delivers jobs, but each job acquires the lock before signing/hashing.

**Why advisory lock over QStash FIFO:**
- QStash FIFO guarantees ordering but not exclusivity (concurrent consumers can still race)
- Advisory lock is transaction-scoped — auto-released on commit/rollback
- Neon supports `pg_advisory_xact_lock` on all plans
- No additional infrastructure dependency

## 5. ZATCA Device Onboarding Flow

### CSR → CSID → Production Certificate

**Step 1: Generate CSR**
- Generate ECDSA P-256 key pair (or RSA 2048)
- Create X.509 CSR with ZATCA-required attributes:
  - CN = `{solution_name}`
  - O = Organization name
  - OU = VAT registration number (15 digits)
  - C = SA
  - SN = `1-{solution_name}|2-{model}|3-{serial}`
  - UID = Organization VAT number
  - title = `0100` (B2B) or `1000` (B2C) or `1100` (both)
  - registeredAddress = Organization address
  - businessCategory = Organization type

**Step 2: Request Compliance CSID**
- POST to ZATCA compliance API with the CSR (Base64)
- ZATCA returns:
  - `binarySecurityToken` (Base64 X.509 compliance certificate)
  - `secret` (API credential for compliance checks)
  - `requestID`

**Step 3: Run Compliance Checks**
- Submit 6 test invoices against the compliance endpoint:
  - Standard tax invoice
  - Standard credit note
  - Standard debit note
  - Simplified tax invoice
  - Simplified credit note
  - Simplified debit note
- All must return `CLEARED` or `REPORTED` status

**Step 4: Exchange for Production Certificate**
- POST to ZATCA production CSID endpoint with the `requestID`
- ZATCA returns:
  - `binarySecurityToken` (Base64 X.509 production certificate)
  - `secret` (API credential for production)

### Key Generation in Browser vs Server
CSR generation requires the private key. Options:
- **Server-side (recommended):** Generate key pair on server, never expose private key to browser. Send CSR to ZATCA, store private key in external secret store.
- Key type: ECDSA P-256 (preferred by ZATCA) — use Node.js `crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' })`

## 6. Secret Storage — Infisical vs Doppler Evaluation

### Requirements
- Per-tenant X.509 private keys and certificates
- API access from Node.js backend
- Rotation support
- Audit logging
- SOC 2 / ISO 27001 compliance desirable

### Comparison

| Feature | Infisical | Doppler |
|---------|-----------|---------|
| Self-hostable | Yes (open-source core) | No (SaaS only) |
| SDK quality | `@infisical/sdk` — well-maintained, typed | `@dopplerhq/node-sdk` — minimal, REST wrapper |
| Per-tenant secrets | Dynamic secrets + folders per org | Configs per project/environment |
| Rotation | Built-in rotation policies | Manual rotation + webhooks |
| Audit log | Full audit trail (self-hosted or cloud) | Audit log (cloud only) |
| Pricing | Free self-hosted, $6/user cloud | $4/seat/month |
| E2E encryption | Yes (client-side) | Transit encryption |
| Cert/key storage | Supports binary/multiline secrets | Supports multiline secrets |

### Recommendation: Infisical
- Self-hostable aligns with future multi-region deployment (Phase 52)
- Dynamic secrets and per-folder structure map well to per-org certificates
- Open-source core reduces vendor lock-in risk
- E2E encryption for private keys at rest is a strong security property
- SDK is typed and well-documented

**Access pattern:**
```typescript
const infisical = new InfisicalClient({ /* config */ });
const cert = await infisical.getSecret({
  environment: "production",
  projectId: "contractor-ops",
  path: `/zatca/${organizationId}`,
  secretName: "X509_CERTIFICATE",
});
```

## 7. ZATCA Fatoora Portal API

### Endpoints
- **Compliance:** `POST /compliance` — Submit test invoices during onboarding
- **Clearance:** `POST /invoices/clearance` — Submit B2B tax invoices for real-time clearance
- **Reporting:** `POST /invoices/reporting` — Submit B2C simplified invoices for reporting
- **Compliance CSID:** `POST /compliance` — Request compliance certificate
- **Production CSID:** `POST /production/csids` — Exchange compliance for production certificate

### Authentication
- Base64-encoded `{binarySecurityToken}:{secret}` in `Authorization: Basic` header
- Different credentials for compliance vs production phases

### Request/Response
- Request body: Base64-encoded signed XML + invoice hash + UUID
- Response: `validationResults` with `status` (CLEARED/REPORTED/REJECTED), `warningMessages`, `errorMessages`

### Error Handling & Retry
ZATCA API errors fall into:
1. **Validation errors** (schema/business rule): Not retryable — fix invoice data
2. **Authentication errors** (401/403): Not retryable — certificate issue
3. **Rate limiting (429):** Retryable with backoff
4. **Server errors (5xx):** Retryable with exponential backoff
5. **Network errors:** Retryable with backoff

QStash provides built-in retry with configurable backoff. Configure:
- Max retries: 3
- Backoff: exponential (1s, 4s, 16s)
- Dead letter queue for permanently failed submissions

## 8. Integration with Existing Architecture

### E-Invoicing Engine Integration
The ZATCA profile implements `EInvoiceProfile` + `Signable` + `QRCodeable`:

```
packages/einvoice/
  src/
    profiles/
      zatca/
        index.ts          # ZatcaProfile class (implements EInvoiceProfile)
        generator.ts      # UBL 2.1 XML generation with ZATCA extensions
        parser.ts         # Parse ZATCA response XML
        signer.ts         # XAdES enveloped signature (implements Signable)
        qr-code.ts        # TLV encoding + QR generation (implements QRCodeable)
        api-client.ts     # ZATCA Fatoora Portal API client
        compliance.ts     # ComplianceStatus computation
        schemas.ts        # Zod schemas for ZATCA-specific fields
        onboarding.ts     # CSR generation, CSID exchange logic
```

### API Layer
```
packages/api/
  src/
    routers/
      zatca.ts            # tRPC router for ZATCA operations
    services/
      zatca-submission.ts # QStash job handler for async submission
```

### Database Schema Changes
1. Add `ZATCA` to `IntegrationProvider` enum
2. Add `ZatcaInvoiceChain` model (see section 4)
3. Add `ZatcaSubmissionStatus` enum
4. Extend `InvoiceSource` enum with `ZATCA_CLEARANCE` (for cleared invoices returned by ZATCA)

### QStash Job Flow
```
Invoice Created → QStash Job → 
  1. Acquire advisory lock (org-level)
  2. Get last ICV + PIH from ZatcaInvoiceChain
  3. Generate UBL 2.1 XML with ZATCA extensions
  4. Sign XML (XAdES)
  5. Compute hash
  6. Generate QR code (TLV)
  7. Create ZatcaInvoiceChain record
  8. Submit to ZATCA (clearance or reporting)
  9. Update ZatcaInvoiceChain with response
  10. Release lock (transaction commit)
```

## 9. Validation Architecture

### Test Approach
1. **Unit tests:** XML generation, TLV encoding, signature structure, hash chain computation
2. **Integration tests:** Full pipeline (generate → sign → QR → validate) with test certificates
3. **ZATCA sandbox tests:** Submit to ZATCA sandbox API during CI (requires sandbox credentials)

### Validation Points
- XAdES signature structure matches ZATCA reference implementation
- TLV encoding produces correct byte sequence for known inputs
- Hash chain is deterministic (same input → same hash)
- ICV is strictly monotonic per organization
- QR code contains all required fields
- UBL 2.1 XML validates against ZATCA XML schema

### Key Risks
1. **XAdES compatibility:** ZATCA may reject signatures that are technically valid XML DSig but don't match their expected XAdES structure exactly. Mitigate by comparing output against ZATCA's published sample invoices.
2. **Certificate format:** ZATCA ECDSA certificates have specific encoding requirements. Test with actual ZATCA sandbox certificates early.
3. **Hash chain race condition:** Even with advisory locks, disconnected QStash workers could create gaps. Mitigate with ICV gap detection and alerting.

## 10. Dependencies and Packages

### New npm Dependencies
| Package | Purpose | Size | Status |
|---------|---------|------|--------|
| `xml-crypto` | XML DSig core (signing, verification) | ~50KB | Stable, widely used |
| `qrcode` | QR code image generation | ~120KB | Stable, v1.5.x |
| `@infisical/sdk` | Secret management for certificates | ~200KB | Active development |

### Existing Dependencies (reused)
| Package | Purpose |
|---------|---------|
| `xmlbuilder2` | Already used in einvoice package for XML construction |
| `fast-xml-parser` | Already used in KSeF generator |
| `zod` | Schema validation |
| `@upstash/qstash` | Async job processing |

### No New Dependencies Needed For
- CSR generation: Node.js `crypto` built-in
- SHA-256 hashing: Node.js `crypto` built-in
- TLV encoding: Simple buffer manipulation (no library needed)
- Base64 encoding: Node.js `Buffer`
- UUID generation: `crypto.randomUUID()`

## RESEARCH COMPLETE
