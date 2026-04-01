# Phase 17: KSeF Integration - Research

**Researched:** 2026-03-27
**Domain:** KSeF (Krajowy System e-Faktur) REST API integration, FA(3) XML parsing, invoice sync pipeline
**Confidence:** MEDIUM

## Summary

Phase 17 integrates Poland's national KSeF e-invoicing system to auto-fetch invoices issued to the organization's NIP. The KSeF API v2 is a REST/JSON API with OpenAPI spec, using a multi-step authentication flow (challenge + RSA encryption + JWT session). Invoices are stored as FA(3) XML with 300+ fields covering header, parties, line items, tax aggregation, and payment details. The existing codebase provides strong foundations: `IntegrationProvider.KSEF` and `InvoiceSource.KSEF` enums already exist, the adapter pattern from Phase 12 is proven, QStash is established for async jobs, and the invoice matching pipeline from Phase 5 handles NIP-based matching and duplicate detection.

The critical technical challenge is the KSeF authentication flow (6-step RSA-OAEP + JWT dance) and the fact that invoice queries are asynchronous (query start, poll status, download encrypted ZIP packages). The ecosystem for Node.js/TypeScript KSeF libraries is immature (all <1.0, single-maintainer), so building a thin custom API client wrapping the official REST endpoints directly is the recommended approach. FA(3) XML parsing via `fast-xml-parser` (already in dependency tree) with a Zod schema for the parsed output provides type-safe extraction.

**Primary recommendation:** Build a custom `KsefApiClient` class in `packages/integrations` wrapping the official KSeF REST API v2 endpoints directly, rather than depending on immature community libraries. Parse FA(3) XML with `fast-xml-parser` + Zod validation schema.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Support both token-based and certificate-based authentication. Token is the primary path (admin generates in KSeF portal, pastes into settings). Certificate upload (.p12/.pem) as advanced option for orgs with qualified e-seals.
- **D-02:** KSeF connection lives in the existing Integration Settings tab as another provider card, consistent with Slack/DocuSign/Autenti pattern. Provider card shows connection status and last sync time.
- **D-03:** Org NIP for KSeF queries is pulled from existing organization settings, not re-entered during KSeF setup. Reduces duplication.
- **D-04:** Verify credentials on save -- test API call to KSeF before persisting the connection. Shows success/error immediately, prevents silent auth failures.
- **D-05:** Hourly cron via Upstash QStash to poll KSeF for new invoices. Balances freshness with API rate limits. Uses IntegrationSyncLog for tracking.
- **D-06:** Manual "Sync now" button on the KSeF provider card for on-demand pulls without waiting for next cron cycle.
- **D-07:** Sync history displayed in expandable section on the KSeF integration card -- last 10 syncs with timestamp, invoice count pulled, and status. Reuses Phase 12 IntegrationSyncLog model.
- **D-08:** KSeF invoices enter the pipeline as RECEIVED and immediately run through the auto-matching engine (same as manual uploads). Reuses existing Phase 5 matching pipeline.
- **D-09:** Full auto-fill -- all FA(3) XML fields mapped to Invoice model including line items, bank account, dates, NIPs, amounts. User reviews but rarely needs to edit since data is government-validated.
- **D-10:** Batch notification after each sync -- one notification: "N new invoices from KSeF" with link to invoice list filtered by source=KSEF. Uses existing Phase 7 notification system.
- **D-11:** Cross-source duplicate detection by invoiceNumber + sellerTaxId (seller NIP) combination -- the natural business key for Polish invoices. More reliable than hash-based approach across different sources.
- **D-12:** When duplicate found between KSeF and manual upload: flag both invoices, link them together, prefer KSeF as authoritative (government-validated data). Manual version gets "KSeF duplicate found" badge. User decides to void or keep.
- **D-13:** KSeF reference number and UPO receipt shown in both places -- small KSeF badge/icon on KSeF-sourced rows in invoice list table, full KSeF reference number + UPO receipt + link to KSeF portal on invoice detail page in a dedicated metadata section.

### Claude's Discretion
- KSeF API client implementation details (session management, pagination)
- FA(3) XML parsing approach (DOM vs streaming, Zod schema for parsed output)
- KSeF-specific fields on Invoice model (ksefReferenceNumber, upoNumber, etc.) vs reusing externalInvoiceId/sourceReference
- Cron job scheduling details within QStash
- "Sync now" button loading/progress UI
- Error handling for KSeF API downtime or rate limiting
- Certificate validation and storage encryption approach
- KSeF connection setup dialog layout and form design
- Duplicate linking UI on invoice detail page

### Deferred Ideas (OUT OF SCOPE)
- KSeF invoice validation against structured data -- explicitly v3 (KSEF-05, KSEF-06 in REQUIREMENTS.md)
- KSeF invoice sending/issuing -- out of scope, contractors issue their own
- KSeF push notifications / real-time webhooks -- if KSeF adds webhook support in the future, could replace polling
- Auto-void of manual duplicate when KSeF version exists -- too aggressive for v2, user should decide
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| KSEF-01 | System auto-fetches invoices issued to org's NIP from national KSeF system | KSeF API v2 `POST /invoices/query/metadata` + `POST /invoices/exports` for batch retrieval; QStash hourly cron; IntegrationSyncLog for tracking |
| KSEF-02 | System parses KSeF FA(3) XML into invoice data model | `fast-xml-parser` for XML parsing; FA(3) field mapping documented below; Zod schema for parsed output; maps to Invoice + InvoiceLine models |
| KSEF-03 | Invoice displays KSeF reference number and UPO receipt | Use `externalInvoiceId` for KSeF reference number, `sourceReference` for UPO number; KSeF badge on list, metadata section on detail page |
| KSEF-04 | System detects duplicates between KSeF-pulled and manually uploaded invoices | Cross-source detection via `invoiceNumber + sellerTaxId` business key (D-11); `duplicateCheckHash` already computed; link + flag approach (D-12) |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fast-xml-parser | 5.5.9 | Parse FA(3) XML to JSON | Already in dependency tree (AWS SDK), mature, fast, well-typed |
| @upstash/qstash | ^2.10.1 | Cron scheduling for hourly sync | Already used in project (Phase 12 token refresh, Phase 16 OCR) |
| zod | (existing) | FA(3) parsed data validation | Already the project standard for all validation schemas |
| node:crypto | built-in | RSA-OAEP encryption for KSeF auth challenge | Required for KSeF token authentication flow |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @upstash/redis | ^1.34.0 (existing) | Distributed lock for sync dedup | Prevent concurrent sync runs for same org |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom KSeF client | ksef-client (0.4.1) | Community package is <1.0, 2 stars, single maintainer. STATE.md explicitly flags this risk. Custom client is safer for production. |
| fast-xml-parser | @xmldom/xmldom + xpath | xmldom gives DOM API but fast-xml-parser is faster, already in tree, and JSON output maps directly to Zod |
| Dedicated KSeF fields on Invoice | externalInvoiceId + sourceReference | Existing fields are sufficient for reference number + UPO. Avoids schema migration for 2 string fields. |

**Installation:**
```bash
pnpm add fast-xml-parser@^5.5.9 --filter @contractor-ops/integrations
```
Note: fast-xml-parser is already a transitive dependency. Adding as direct dependency in integrations package.

## Architecture Patterns

### Recommended Project Structure
```
packages/integrations/src/
  adapters/
    ksef-adapter.ts          # BaseAdapter subclass for KSeF provider
  services/
    ksef-api-client.ts       # Low-level REST client (auth, sessions, queries)
    ksef-invoice-sync.ts     # Sync orchestrator (fetch, parse, store, match)
    ksef-xml-parser.ts       # FA(3) XML -> Zod-validated JSON
packages/api/src/
  routers/
    ksef.ts                  # KSeF-specific tRPC endpoints
  services/
    ksef-sync-orchestrator.ts  # Coordinates sync: fetch -> parse -> create -> match
packages/validators/src/
  ksef.ts                    # KSeF-specific Zod schemas (connection config, parsed invoice)
apps/web/src/
  app/api/ksef/
    _sync/route.ts           # QStash callback for scheduled sync
  components/invoices/
    ksef-badge.tsx            # Small badge for invoice list rows
    ksef-metadata-section.tsx # Detail page metadata section
```

### Pattern 1: KSeF Authentication Flow
**What:** 6-step RSA-OAEP challenge-response authentication
**When to use:** Every time a KSeF session needs to be established
**Flow:**
```
1. GET /auth/public-key           -> RSA public key (PEM certificate)
2. POST /auth/challenge           -> { challenge, timestampMs }
3. RSA-OAEP encrypt(token + timestamp) using public key
4. POST /auth/token/redeem        -> { temporaryJWT, referenceNumber }
5. GET /auth/{referenceNumber}    -> poll until ready
6. Access token from step 4 is the session JWT
```

### Pattern 2: Async Invoice Query Flow
**What:** KSeF invoice queries are asynchronous -- you start a query, poll for completion, then download results
**When to use:** Every sync cycle (hourly cron or manual)
**Flow:**
```
1. POST /invoices/query/metadata   -> { queryId }
   Body: { dateFrom, dateTo, subjectNip }
2. GET /invoices/query/{queryId}/status  -> poll until done
3. For each part:
   POST /invoices/exports  OR  GET /invoices/ksef/{ksefNumber}
4. Parse FA(3) XML -> Invoice records
```

### Pattern 3: QStash Cron for Hourly Sync (matching OCR pattern)
**What:** QStash schedules a POST to /api/ksef/_sync endpoint hourly
**When to use:** Automatic invoice fetching per D-05
**Example:**
```typescript
// Schedule setup (one-time, in integration connection creation)
const qstash = getQStashClient();
await qstash.schedules.create({
  destination: `${process.env.NEXT_PUBLIC_APP_URL}/api/ksef/_sync`,
  cron: "0 * * * *", // Every hour
  body: JSON.stringify({ organizationId, connectionId }),
  retries: 2,
});
```

### Pattern 4: Reuse Integration Infrastructure
**What:** KSeF adapter follows the established Phase 12 adapter pattern
**When to use:** Registration, health checks, credential encryption
**Example:**
```typescript
export class KsefAdapter extends BaseAdapter {
  readonly slug = "ksef";
  readonly displayName = "KSeF";
  readonly supportsOAuth = false;    // Token/cert auth, not OAuth
  readonly supportsWebhooks = false; // Polling-based

  async getHealthStatus(connectionId: string): Promise<ProviderHealthStatus> {
    // Query IntegrationSyncLog for recent syncs
  }
}
```

### Anti-Patterns to Avoid
- **Do NOT use community KSeF packages in production:** They are pre-1.0, single-maintainer, and the API surface is small enough to wrap directly. The STATE.md explicitly flags "@ksef/client single-maintainer risk."
- **Do NOT store KSeF token as plaintext:** Use the existing AES-256-GCM credential encryption from Phase 12 (`encryptCredentials`/`decryptCredentials`).
- **Do NOT re-enter NIP in KSeF setup:** Per D-03, read from Organization settings. However, Organization model currently lacks a dedicated NIP field -- it must be stored in `settingsJson` or as a new field added in this phase.
- **Do NOT sync all-time invoices on every run:** Track `lastSyncAt` cursor and only query KSeF for invoices issued after last successful sync.
- **Do NOT skip duplicate detection for KSeF invoices:** Even though KSeF data is government-validated, the same invoice may have been manually uploaded before KSeF pull.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| XML parsing | Custom XML parser | fast-xml-parser | 300+ field FA(3) schema, edge cases in namespaces, encoding |
| Credential encryption | Custom crypto | Phase 12 credential-service.ts | AES-256-GCM with per-provider keys, proven pattern |
| Duplicate detection | New detection algorithm | Existing `computeDuplicateCheckHash` + `invoiceNumber+sellerTaxId` | Phase 5 already handles this; extend, don't rebuild |
| Invoice auto-matching | New matcher | Existing `runAutoMatch` from invoice-matching.ts | NIP-based matching already works |
| Sync logging | Custom log table | IntegrationSyncLog model | Phase 12 infrastructure, already queried by provider cards |
| Background scheduling | Custom cron | QStash cron schedules | Already used for token refresh; serverless-friendly |
| Notification dispatch | Custom notification | `dispatch()` from notification-service.ts | Add KSEF_SYNC_COMPLETE type to NOTIFICATION_TYPES array |

**Key insight:** This phase is primarily an integration and orchestration exercise. Almost every infrastructure component exists. The new code is: (1) KSeF API client, (2) FA(3) XML parser, (3) sync orchestrator gluing existing pieces, (4) UI for KSeF metadata display.

## Common Pitfalls

### Pitfall 1: Organization Missing NIP Field
**What goes wrong:** D-03 says "Org NIP for KSeF queries is pulled from existing organization settings" but the Organization model has no `taxId` or `nip` field. The `legalName` is stored in `settingsJson` metadata but NIP is not.
**Why it happens:** Organization was designed for generic multi-tenant use; NIP is Poland-specific.
**How to avoid:** Either add NIP to `settingsJson` (lower migration cost, read from org-settings-form) or add a dedicated column (better for indexing but requires migration). Recommendation: store in `settingsJson.taxId` alongside existing `legalName`, since it is already the pattern for org metadata. Validate NIP format (10 digits, modulo-11 checksum) on save.
**Warning signs:** NIP is empty/null when sync runs -- must validate during connection setup (D-04).

### Pitfall 2: KSeF Auth Session Expiry
**What goes wrong:** KSeF sessions have limited validity. If the sync takes longer than expected or is retried, the session JWT expires.
**Why it happens:** KSeF uses short-lived JWTs (typically 20-60 minutes).
**How to avoid:** Use `POST /auth/token/refresh` before each major operation. Store session JWT in memory only (not persisted), re-authenticate for each sync run.
**Warning signs:** 401 responses from KSeF during ongoing sync.

### Pitfall 3: Encrypted Invoice Packages
**What goes wrong:** KSeF query results are returned as AES-256 encrypted ZIP packages, not plain XML.
**Why it happens:** Security measure -- invoice data is encrypted with a key generated during session creation.
**How to avoid:** When opening a session, capture the AES encryption key. Use it to decrypt each downloaded package before unzipping and parsing XML.
**Warning signs:** Garbage data or decryption errors when trying to parse downloaded content.

### Pitfall 4: Date Range Limitation (Max 3 Months)
**What goes wrong:** KSeF API limits queries to 3-month date ranges. First sync attempt for an org that has been on KSeF for years will fail.
**Why it happens:** API rate limiting / resource management.
**How to avoid:** For initial sync, break into 3-month windows. For ongoing sync, track `lastSyncAt` and query only the delta (last sync to now). Use `IntegrationConnection.lastSuccessAt` as the cursor.
**Warning signs:** API error when date range exceeds 3 months.

### Pitfall 5: Rate Limits (HTTP 429)
**What goes wrong:** KSeF API has per-second/minute/hour rate limits. Batch processing multiple orgs simultaneously can hit limits.
**Why it happens:** Shared national infrastructure with rate limiting.
**How to avoid:** Respect `Retry-After` header on 429 responses. Implement exponential backoff. The `GET /api/v2/rate-limits` endpoint returns current limits -- check on startup.
**Warning signs:** 429 responses, especially during peak hours.

### Pitfall 6: Duplicate Detection Across Sources
**What goes wrong:** Hash-based duplicate detection (`computeDuplicateCheckHash`) includes `totalGrosze` in the hash. KSeF amounts may have slight grosze differences from OCR-extracted or manually entered amounts.
**Why it happens:** OCR/manual entry may round differently than KSeF government-validated amounts.
**How to avoid:** Per D-11, use `invoiceNumber + sellerTaxId` as the cross-source business key (not the full hash). The existing `duplicateCheckHash` includes amount and is good for same-source dedup. For cross-source (KSeF vs manual), query by `invoiceNumber + sellerTaxId` directly.
**Warning signs:** Same invoice exists from both KSeF and manual upload but is not flagged as duplicate.

### Pitfall 7: Certificate Handling (.p12/.pem)
**What goes wrong:** .p12 certificates are binary files with passwords. Storing them alongside tokens in the JSON credential blob requires Base64 encoding and careful password management.
**Why it happens:** D-01 requires certificate support as an advanced option.
**How to avoid:** Base64-encode the .p12 file content and store in `CredentialBlob.extra.certificateBase64`. Store password in `CredentialBlob.extra.certificatePassword`. Both are encrypted at rest via AES-256-GCM.
**Warning signs:** Certificate parsing failures, password mismatch.

## Code Examples

### FA(3) XML Parsing with fast-xml-parser + Zod

```typescript
// packages/integrations/src/services/ksef-xml-parser.ts
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseTagValue: true,
  trimValues: true,
});

// Zod schema for parsed FA(3) invoice data
export const ksefInvoiceSchema = z.object({
  invoiceNumber: z.string(),          // Fa/P_2
  issueDate: z.string(),              // Fa/P_1
  invoiceType: z.string(),            // Fa/RodzajFaktury
  currency: z.string().length(3),     // Fa/KodWaluty
  seller: z.object({
    nip: z.string(),                  // Podmiot1/DaneIdentyfikacyjne/NIP
    name: z.string(),                 // Podmiot1/DaneIdentyfikacyjne/Nazwa
    address: z.string().optional(),
  }),
  buyer: z.object({
    nip: z.string(),                  // Podmiot2/DaneIdentyfikacyjne/NIP
    name: z.string(),                 // Podmiot2/DaneIdentyfikacyjne/Nazwa
  }),
  lines: z.array(z.object({
    lineNumber: z.number(),           // FaWiersz/NrWierszaFa
    description: z.string(),          // FaWiersz/P_7
    quantity: z.number().optional(),   // FaWiersz/P_8B
    unit: z.string().optional(),       // FaWiersz/P_8A
    unitPriceGrosze: z.number().optional(),
    netAmountGrosze: z.number().optional(),
    vatRate: z.string().optional(),    // FaWiersz/P_12
    vatAmountGrosze: z.number().optional(),
    grossAmountGrosze: z.number().optional(),
  })),
  totals: z.object({
    netGrosze: z.number(),
    vatGrosze: z.number(),
    grossGrosze: z.number(),          // Fa/P_15
  }),
  payment: z.object({
    dueDate: z.string().optional(),
    bankAccount: z.string().optional(),
    method: z.string().optional(),
  }).optional(),
});

export type KsefParsedInvoice = z.infer<typeof ksefInvoiceSchema>;

export function parseFa3Xml(xmlString: string): KsefParsedInvoice {
  const parsed = parser.parse(xmlString);
  const fa = parsed?.Faktura?.Fa ?? parsed?.Fa;

  // Map XML structure to schema, converting PLN amounts to grosze (x100)
  // ... (extraction logic)

  return ksefInvoiceSchema.parse(mapped);
}
```

### KSeF API Client Authentication

```typescript
// packages/integrations/src/services/ksef-api-client.ts
import { createPublicKey, publicEncrypt, constants } from "node:crypto";

interface KsefSession {
  jwt: string;
  referenceNumber: string;
  encryptionKey: Buffer; // AES-256 key for decrypting query results
}

export class KsefApiClient {
  private baseUrl: string;

  constructor(environment: "test" | "prod" = "prod") {
    this.baseUrl = environment === "prod"
      ? "https://ksef.mf.gov.pl/api/v2"
      : "https://ksef-test.mf.gov.pl/api/v2";
  }

  async authenticate(token: string, nip: string): Promise<KsefSession> {
    // Step 1: Get RSA public key
    const pubKeyResp = await fetch(`${this.baseUrl}/auth/public-key`);
    const { publicKey } = await pubKeyResp.json();

    // Step 2: Request challenge
    const challengeResp = await fetch(`${this.baseUrl}/auth/challenge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contextIdentifier: { type: "nip", value: nip } }),
    });
    const { challenge, timestampMs } = await challengeResp.json();

    // Step 3: RSA-OAEP encrypt token with challenge
    const rsaKey = createPublicKey(publicKey);
    const plaintext = Buffer.from(`${token}|${timestampMs}`);
    const encrypted = publicEncrypt(
      { key: rsaKey, padding: constants.RSA_PKCS1_OAEP_PADDING },
      plaintext,
    );

    // Step 4: Redeem token for JWT
    const redeemResp = await fetch(`${this.baseUrl}/auth/token/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        challenge,
        encryptedToken: encrypted.toString("base64"),
      }),
    });
    const { jwt, referenceNumber } = await redeemResp.json();

    // Step 5: Poll until ready
    // ... poll GET /auth/{referenceNumber} until status is ready

    return { jwt, referenceNumber, encryptionKey: Buffer.alloc(32) };
  }
}
```

### Sync Orchestrator (QStash callback pattern)

```typescript
// Follows the same pattern as processOcrExtraction in ocr-extraction.ts
export async function processKsefSync(params: {
  organizationId: string;
  connectionId: string;
}): Promise<void> {
  // 1. Create IntegrationSyncLog (STARTED)
  // 2. Decrypt KSeF credentials from IntegrationConnection
  // 3. Authenticate with KSeF API
  // 4. Query invoices since lastSuccessAt
  // 5. For each invoice XML:
  //    a. Parse FA(3) XML via ksef-xml-parser
  //    b. Check cross-source duplicate (invoiceNumber + sellerTaxId)
  //    c. Create Invoice record (source=KSEF, status=RECEIVED)
  //    d. Create InvoiceLine records
  //    e. Run auto-match pipeline
  //    f. If duplicate found, flag both invoices
  // 6. Update IntegrationConnection.lastSyncAt/lastSuccessAt
  // 7. Update IntegrationSyncLog (SUCCESS/FAILED)
  // 8. Dispatch batch notification if invoices found
}
```

### Cross-Source Duplicate Detection

```typescript
// Enhanced duplicate detection for KSeF vs manual uploads
async function checkCrossSourceDuplicate(
  prisma: PrismaClient,
  organizationId: string,
  invoiceNumber: string,
  sellerTaxId: string,
  currentInvoiceId?: string,
): Promise<{ isDuplicate: boolean; existingInvoiceId: string | null }> {
  const where: Record<string, unknown> = {
    organizationId,
    invoiceNumber: { equals: invoiceNumber, mode: "insensitive" },
    sellerTaxId,
    deletedAt: null,
  };
  if (currentInvoiceId) {
    where.id = { not: currentInvoiceId };
  }

  const existing = await prisma.invoice.findFirst({
    where,
    select: { id: true, source: true },
  });

  return {
    isDuplicate: !!existing,
    existingInvoiceId: existing?.id ?? null,
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| KSeF 1.0 API (FA(2)) | KSeF 2.0 API (FA(3)) | February 2026 | New XML schema, expanded fields, new auth flow |
| Optional KSeF adoption | Mandatory KSeF from Feb 2026 | Feb 1, 2026 (large business) / Apr 1, 2026 (small) | All Polish B2B invoices must flow through KSeF |
| PDF invoice exchange | Structured XML via national system | 2026 | Government-validated data, no OCR needed for KSeF invoices |

**Deprecated/outdated:**
- KSeF 1.0 API: Replaced by v2 as of Feb 2026. All new integrations must use v2.
- FA(2) XML schema: Replaced by FA(3). New invoices use FA(3) structure exclusively.

## Open Questions

1. **NIP Storage in Organization**
   - What we know: Organization model has no dedicated `taxId`/`nip` field. `legalName` is stored in `settingsJson` metadata.
   - What's unclear: Whether to add a dedicated column or use `settingsJson.taxId`.
   - Recommendation: Use `settingsJson.taxId` to match the existing metadata pattern. Add NIP input to org settings form. Validate with modulo-11 checksum. This avoids a schema migration.

2. **KSeF Test Environment Access**
   - What we know: Test environment exists at `ksef-test.mf.gov.pl`. Production at `ksef.mf.gov.pl`.
   - What's unclear: Whether we need separate test credentials or if the same token works.
   - Recommendation: Support environment toggle in connection config. Default to production. Use test env for development with configurable `KSEF_ENVIRONMENT` env var.

3. **Initial Sync Window**
   - What we know: KSeF limits queries to 3-month windows. Orgs may have been on KSeF since Feb 2026.
   - What's unclear: How far back to fetch on initial connection.
   - Recommendation: Default initial sync to last 3 months. Offer "full historical sync" option that iterates through 3-month windows. Track progress in IntegrationSyncLog.

4. **Certificate Authentication Specifics**
   - What we know: D-01 requires certificate support (.p12/.pem). KSeF v2 supports XAdES signature auth.
   - What's unclear: Exact XAdES XML signing requirements for Node.js.
   - Recommendation: Implement token auth first (primary path). Certificate auth can use `xml-crypto` or `xmldsig` for XAdES signing if needed. Flag as lower priority.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | packages/integrations/vitest.config.ts |
| Quick run command | `pnpm --filter @contractor-ops/integrations test` |
| Full suite command | `pnpm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| KSEF-01 | KSeF API client authenticates and fetches invoices | unit | `pnpm --filter @contractor-ops/integrations vitest run src/__tests__/ksef-api-client.test.ts` | No -- Wave 0 |
| KSEF-02 | FA(3) XML parsed into validated invoice data | unit | `pnpm --filter @contractor-ops/integrations vitest run src/__tests__/ksef-xml-parser.test.ts` | No -- Wave 0 |
| KSEF-03 | KSeF metadata stored in externalInvoiceId/sourceReference | unit | `pnpm --filter @contractor-ops/api vitest run src/services/__tests__/ksef-sync.test.ts` | No -- Wave 0 |
| KSEF-04 | Cross-source duplicate detection by invoiceNumber + sellerTaxId | unit | `pnpm --filter @contractor-ops/api vitest run src/services/__tests__/ksef-duplicate.test.ts` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @contractor-ops/integrations test`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/integrations/src/__tests__/ksef-api-client.test.ts` -- covers KSEF-01 (auth flow, query, error handling)
- [ ] `packages/integrations/src/__tests__/ksef-xml-parser.test.ts` -- covers KSEF-02 (FA(3) parsing with sample XML)
- [ ] `packages/api/src/services/__tests__/ksef-sync.test.ts` -- covers KSEF-01, KSEF-03 (sync orchestration, metadata persistence)
- [ ] `packages/api/src/services/__tests__/ksef-duplicate.test.ts` -- covers KSEF-04 (cross-source duplicate detection)
- [ ] Sample FA(3) XML fixture file for parser tests

## Sources

### Primary (HIGH confidence)
- KSeF 2.0 API changelog (CIRFMF/ksef-docs GitHub) -- endpoint specifications, auth flow, rate limits
- FA(3) field mapping (developer.b2brouter.net) -- XML element paths and field descriptions
- Existing codebase -- Integration adapter pattern, credential encryption, QStash usage, invoice matching

### Secondary (MEDIUM confidence)
- [KSeF 2.0 API documentation overview](https://rtcsuite.com/understanding-polands-ksef-2-0-api-documentation-and-fa3-structure-key-changes-and-released-api-documentation/) -- timeline, SDK info
- [KSeF REST API documentation](https://ksefapi.pl/en/rest-ksef-api-dokumentacja/) -- authentication, endpoints
- [ksef-client-ts GitHub](https://github.com/lkow/ksef-client-ts) -- TypeScript SDK reference (v1.7.1, March 2026)
- [npm: ksef-client](https://www.npmjs.com/search?q=keywords:ksef) -- ecosystem survey

### Tertiary (LOW confidence)
- KSeF API rate limit specifics -- exact per-second/minute limits not independently verified
- Certificate (XAdES) authentication exact implementation -- Node.js XAdES signing libraries need validation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- fast-xml-parser, QStash, Zod all established in codebase
- Architecture: HIGH -- follows proven adapter pattern from Phase 12, QStash pattern from Phase 16
- KSeF API specifics: MEDIUM -- API docs reviewed but exact payloads need validation against test environment
- Pitfalls: MEDIUM -- based on API documentation and community reports, not firsthand experience
- FA(3) field mapping: MEDIUM -- documented by third party, cross-referenced with multiple sources

**Research date:** 2026-03-27
**Valid until:** 2026-04-10 (KSeF API is stable post-launch, but early days may bring minor fixes)
