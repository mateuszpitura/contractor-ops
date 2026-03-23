# Pitfalls Research

**Domain:** B2B contractor ops platform expansion -- adding contractor portal, e-sign, OCR, KSeF, and third-party integrations to existing multi-tenant SaaS
**Researched:** 2026-03-23
**Confidence:** HIGH (well-documented integration domains with known failure modes)

## Critical Pitfalls

### Pitfall 1: Contractor Portal Blows Open the Tenant Boundary

**What goes wrong:**
The existing system is internal-only -- every user belongs to an organization and is trusted. Adding a contractor portal introduces external users who see data across organizations (a contractor may work for multiple clients), need restricted views of internal data, and authenticate differently. The existing RBAC model (8 roles, all internal) was not designed for this. Bolting on contractor access without rethinking the permission boundary leads to data leaks, confused authorization logic, and permissions spaghetti that touches every query in the system.

**Why it happens:**
Developers treat the contractor portal as "just another role" and add a `CONTRACTOR` role to the existing RBAC. But contractors are fundamentally different: they exist across tenant boundaries (one contractor, many orgs), they should never see other contractors' data within the same org, and their access is scoped to their own records (invoices, contracts, payments) rather than org-wide resources. This is not a role problem -- it is a trust boundary problem.

**How to avoid:**
- Model contractor access as a separate authentication context, not just another RBAC role. Contractors get their own auth flow (invite-based, possibly passwordless) with a dedicated session type.
- Every contractor query must be double-scoped: `organization_id` AND `contractor_id`. Never rely on RBAC alone.
- Build a contractor-specific Prisma client extension that enforces this double-scoping automatically, similar to the existing tenant-scoping extension.
- The contractor portal should be a separate Next.js route group (`/portal/...`) with its own layout, middleware, and auth guards -- not interleaved with the admin app.
- Design the data access layer so contractors can ONLY read their own: contracts, invoices, payments, documents, time entries. They cannot list other contractors, see approval chains, or access org settings.

**Warning signs:**
- Adding `if (user.role === 'CONTRACTOR')` checks scattered across existing tRPC routers instead of a dedicated router layer.
- Contractor can see the admin sidebar or navigation items they should not access.
- No integration test that verifies contractor A cannot see contractor B's data within the same org.

**Phase to address:**
Contractor Portal phase (should be early -- it is the foundation for contractor-facing features like e-sign and time tracking).

---

### Pitfall 2: KSeF Integration Treated as Simple REST -- Ignoring Session Model and UPO Flow

**What goes wrong:**
KSeF is not a typical REST API. It uses a session-based model: you open a session, transmit invoices within that session, and must collect the UPO (Urzedowe Poswiadczenie Odbioru -- official receipt confirmation) with the unique KSeF-ID before closing. Developers who treat it like a fire-and-forget API call end up with invoices that were "sent" but never confirmed, missing KSeF-IDs that are legally required, and no recovery path when KSeF has outages (which are frequent -- the system launched Feb 2026 and is still stabilizing).

**Why it happens:**
KSeF documentation is primarily in Polish, the API changed significantly between KSeF 1.0 and 2.0 (FA(3) format), and most developers have no prior experience with government e-invoicing systems. The temptation is to wrap it in a simple "send invoice" function and move on.

**How to avoid:**
- Build KSeF integration as an async job pipeline, not a synchronous call: (1) open session, (2) submit invoice batch, (3) poll for UPO, (4) store KSeF-ID + UPO reference, (5) close session.
- Implement a dedicated `ksef_submissions` table tracking each invoice's KSeF lifecycle: `PENDING -> SUBMITTED -> CONFIRMED -> FAILED`. Never mark an invoice as KSeF-compliant without the UPO.
- Build retry logic with exponential backoff. KSeF outages can last hours. The system must queue and retry, not fail permanently.
- Store the raw FA(3) XML for every submitted invoice -- you will need it for audit, resubmission, and JPK_VDEK cross-referencing.
- KSeF authentication changes: as of Feb 2026, the National Electronic Identification Node is required. Tokens will be replaced by KSeF certificates from Jan 2027. Plan for certificate-based auth.
- Test against the KSeF test environment (api-test.ksef.mf.gov.pl) extensively before going live.

**Warning signs:**
- No KSeF submission status tracking in the database -- just a boolean `ksef_sent` flag.
- No retry mechanism for failed submissions.
- Invoice shows as "sent to KSeF" in the UI before UPO confirmation.
- No offline/degraded mode when KSeF is down.

**Phase to address:**
KSeF Integration phase (should come after OCR, since OCR-parsed invoices are a primary input to KSeF validation).

---

### Pitfall 3: E-Sign Becomes Two Completely Different Integrations Pretending to Be One

**What goes wrong:**
DocuSign and Autenti have fundamentally different APIs, authentication models, webhook behaviors, and signing ceremony flows. Developers build an abstraction layer that papers over the differences, but the abstraction leaks everywhere -- different error codes, different status lifecycle, different embedded vs. redirect signing flows, different webhook payloads. The result is an unreliable signing experience where edge cases in one provider break the abstraction for both.

**Why it happens:**
It seems elegant to have `signDocument(provider, document)` that works identically for both. But DocuSign uses envelope-based workflows with embedded signing (suppresses all emails, requires unique clientUserId per recipient), while Autenti uses a simpler document-centric model with qualified electronic signatures (QES) that carry legal weight under Polish law and eIDAS. The flows are not isomorphic.

**How to avoid:**
- Define a thin e-sign interface (TypeScript interface) with the minimum contract: `createSigningRequest`, `getSigningUrl`, `getStatus`, `handleWebhook`. Each provider implements this interface independently.
- Do NOT try to normalize status enums across providers. DocuSign has `sent -> delivered -> completed -> voided` while Autenti has its own lifecycle. Map them to your internal status (`PENDING_SIGNATURE -> SIGNED -> REJECTED -> EXPIRED`) at the adapter boundary.
- Webhook handlers must be completely separate endpoints per provider. DocuSign Connect sends XML by default (configurable to JSON); Autenti sends JSON. Do not share a webhook handler.
- For embedded signing (DocuSign), the signing URL expires in 5 minutes. Generate it on-demand when the user clicks "Sign", not when the envelope is created.
- For Autenti QES, the user is redirected to Autenti's platform -- there is no true embedded signing. Design the UX to handle this redirect gracefully.
- Store the provider-specific envelope/document ID alongside your internal contract ID. You will need it for status polling, resending, and audit.

**Warning signs:**
- A single `handleEsignWebhook` endpoint trying to parse both DocuSign and Autenti payloads.
- Signing status in the database that does not distinguish between provider-native status and your internal status.
- "Works with DocuSign but not Autenti" bugs recurring after every change.

**Phase to address:**
E-Sign Integration phase.

---

### Pitfall 4: OCR Accuracy Treated as a Solved Problem

**What goes wrong:**
Teams integrate an OCR service, test it on 10 clean invoices, get 95% accuracy, and ship it with auto-fill. In production, Polish invoices have wildly varying layouts, mixed Polish/English text, handwritten annotations, poor scan quality, and date formats that are ambiguous (01/02/2026 = Jan 2 or Feb 1?). The OCR confidently returns wrong data -- wrong amounts, wrong NIP numbers, wrong dates -- and if auto-accepted, these errors flow into approval chains, payment runs, and tax reporting.

**Why it happens:**
OCR demos are impressive. Real-world invoice diversity is brutal. Polish invoices have specific fields (NIP, numer faktury, data wystawienia, data sprzedazy, kwota netto/brutto/VAT) that template-based OCR handles poorly when layouts vary. Even with AI-based extraction, one misread character in a NIP or bank account number can route a payment to the wrong entity.

**How to avoid:**
- OCR output must ALWAYS go through human review before entering the system as trusted data. Never auto-accept OCR results for financial fields (amounts, NIP, bank account, dates).
- Display OCR confidence scores per field. Highlight low-confidence fields in the review UI so the user knows where to look.
- Pre-validate extracted fields against known data: match NIP against the contractor registry, validate NIP checksum, compare amounts against contract expected values (you already have this matching logic from v1.0).
- For dates, enforce explicit format detection: look for Polish date keywords (e.g., "Data wystawienia:", "Data sprzedazy:") to disambiguate format.
- Store the original PDF alongside OCR results. Users must be able to view the source document side-by-side with extracted fields during review.
- Track OCR accuracy metrics per invoice source/contractor over time. If a particular contractor's invoices consistently fail OCR, flag them for manual processing.

**Warning signs:**
- No human review step between OCR extraction and invoice creation.
- OCR results stored without confidence scores.
- No side-by-side view of original document and extracted data.
- Test suite uses only clean, well-formatted sample invoices.

**Phase to address:**
OCR Invoice Parsing phase (should come before KSeF since OCR feeds into the invoice pipeline that KSeF validates).

---

### Pitfall 5: Integration Credential Sprawl Across Tenants

**What goes wrong:**
v2.0 adds 6+ external service connections (DocuSign, Autenti, KSeF, Jira, Notion/Confluence, Google/Outlook Calendar). Each tenant needs their own OAuth tokens, API keys, or certificates for each service. Without a centralized credential management system, tokens end up scattered across config tables, some expire and are never refreshed, webhook secrets are stored in plaintext, and there is no way to know which tenant's integration is broken until a user reports it.

**Why it happens:**
Each integration is built in a different phase, and each one invents its own way to store credentials. Jira stores tokens in `jira_config`, Calendar stores them in `calendar_tokens`, KSeF stores certificates in `ksef_auth` -- all with different schemas, different refresh logic, and different error handling.

**How to avoid:**
- Build a unified `integration_credentials` table early, before any integration phase. Schema: `org_id, provider (enum), credential_type (oauth_token | api_key | certificate), encrypted_credentials (jsonb), expires_at, last_refreshed_at, status (active | expired | revoked | error), metadata`.
- Encrypt all credentials at rest using a per-tenant encryption key. Never store OAuth tokens or API keys in plaintext.
- Build a credential refresh service that runs on a schedule (cron/Upstash QStash), checks `expires_at`, and proactively refreshes tokens before they expire. Google Calendar tokens expire in 1 hour; DocuSign tokens in 8 hours; Notion tokens do not expire but can be revoked.
- Build an "Integration Health" dashboard in org settings showing connection status for each service. Alert the org admin when a credential fails.
- All integration adapters must use a shared `getCredential(orgId, provider)` function that handles decryption, checks expiry, and triggers refresh if needed.

**Warning signs:**
- Multiple tables storing credentials with different schemas.
- Token refresh logic duplicated per integration.
- No monitoring for expired/revoked credentials.
- Credentials stored as plaintext JSON.

**Phase to address:**
Integration Foundation phase (should be the FIRST phase of v2.0 -- build the credential store, webhook router, and health monitoring as shared infrastructure before any specific integration).

---

### Pitfall 6: Webhook Chaos -- No Central Router, No Idempotency, No Verification

**What goes wrong:**
v2.0 introduces webhooks from DocuSign, Autenti, KSeF (polling, but similar pattern), Jira, Google Calendar, and Microsoft Graph. Each webhook has different payload formats, different signature verification methods, different retry behaviors, and different idempotency guarantees. Without a central webhook handling pattern, you end up with duplicate event processing, unverified payloads (security risk), lost events during deployments, and no way to debug "why did this integration stop working."

**Why it happens:**
Each integration adds its own `/api/webhooks/[provider]` endpoint. In isolation, each works fine. But Vercel serverless functions have cold starts, timeouts, and no persistent state. Jira expects a response within 30 seconds. DocuSign Connect retries failed deliveries up to 3 times. Google Calendar webhooks expire after 24 hours and must be renewed. Without coordination, these constraints compound.

**How to avoid:**
- Build a webhook ingestion layer: receive, verify signature, store raw event in a `webhook_events` table, return 200 immediately. Process asynchronously via a job queue (Upstash QStash or Redis-based).
- Each webhook endpoint does only three things: (1) verify signature/secret, (2) store raw payload, (3) return 200. All business logic happens in background processing.
- Implement idempotency keys per provider: DocuSign envelope ID + status, Jira issue ID + event type + timestamp, Calendar event ID + sequence number. Deduplicate before processing.
- Signature verification per provider: DocuSign uses HMAC-SHA256 on the payload, Jira uses shared secret in header, Google uses channel token, Microsoft Graph uses client state + validation handshake.
- Google Calendar webhooks expire every 24 hours. Build a renewal cron job that refreshes all active calendar subscriptions every 20 hours.
- Microsoft Graph subscriptions require a validation handshake on creation (respond with validationToken within 10 seconds). Your endpoint must handle both validation requests and notification deliveries.
- Log ALL incoming webhooks with timestamp, provider, payload hash, and processing status. This is your debugging lifeline.

**Warning signs:**
- Webhook handlers that contain business logic (database writes, notifications) inline.
- No webhook event log table.
- Duplicate events causing duplicate notifications or double-processing.
- Google Calendar sync "randomly stops working" (expired webhook subscription).
- No signature verification on any webhook endpoint.

**Phase to address:**
Integration Foundation phase (same as credential management -- build the webhook router before any specific integration).

---

### Pitfall 7: Contractor Portal Time Tracking That Nobody Uses

**What goes wrong:**
Time tracking is built as a full-featured module (projects, tasks, daily logs, overtime rules) that contractors find too complex compared to their existing habits (Excel, Clockify, or nothing). Adoption is near zero. The feature becomes shelfware, and the Jira integration for time data is never used because the manual tracking UX drives users away before they discover integrations.

**Why it happens:**
Developers build for completeness rather than contractor workflow reality. Most B2B contractors in Poland track time loosely (if at all) -- they invoice for agreed monthly amounts, not hours. Time tracking is primarily for the client company's visibility and compliance, not the contractor's benefit. Forcing contractors into a rigid time entry system creates friction without value.

**How to avoid:**
- Start with the simplest possible input: a weekly summary grid (Mon-Fri, hours per day, optional project/description). One screen, one save button, done.
- Make the Jira/Clockify import the primary path for contractors who already track time elsewhere. Do not make them double-enter data.
- Add complexity only on the company side (approval, reports, overtime detection) -- keep the contractor-facing entry minimal.
- Make time tracking optional per contractor/contract. Some contracts are fixed-price and do not need hour tracking.
- Show contractors WHY tracking matters: link it to their payment visibility ("Your timesheet was approved, payment scheduled for [date]").

**Warning signs:**
- Time tracking UI has more than 3 screens/steps for a contractor to submit weekly time.
- No import from external tools (Jira, Clockify) in the initial release.
- Time tracking is mandatory for all contractors regardless of contract type.
- No feedback loop connecting time entry to payment status.

**Phase to address:**
Contractor Portal phase (time tracking should be a sub-feature of the portal, not a standalone module).

---

### Pitfall 8: Existing Approval Chain Does Not Extend Cleanly to New Document Types

**What goes wrong:**
v1.0 built approval chains for invoices. v2.0 needs approval-like flows for: e-sign requests (contract needs manager approval before sending for signature), time sheets (submitted time needs manager approval), and KSeF submissions (invoice verified before sending to government). Developers either (a) shoehorn everything through the existing invoice approval system (wrong states, wrong roles), or (b) build separate approval logic for each new entity (duplication, inconsistency).

**Why it happens:**
The v1.0 approval system was designed specifically for invoice amounts with finance-centric approval levels. It has invoice-specific fields (amount threshold, deviation percentage, NIP matching) baked into the approval logic. Extending it to "approve a timesheet" or "approve a contract for signing" requires extracting the generic approval engine from the invoice-specific rules.

**How to avoid:**
- Refactor the approval system into a generic approval engine that works with any entity type. Core concepts: `ApprovalRequest { entityType, entityId, requestedBy, metadata }`, `ApprovalChain { orgId, entityType, levels[] }`, `ApprovalDecision { requestId, level, decidedBy, decision, comment }`.
- Entity-specific logic (amount thresholds, deviation checks) lives in the entity's module and is called by the generic engine via hooks/callbacks.
- This refactor should happen BEFORE adding e-sign or time tracking, not after.
- Each entity type gets its own approval chain configuration in org settings. Do not force invoice approval rules onto timesheet approvals.

**Warning signs:**
- New approval flows copying code from the invoice approval module.
- Approval chain configuration tightly coupled to invoice fields.
- Different approval UIs for different entity types instead of a unified approval experience.

**Phase to address:**
Integration Foundation or early Contractor Portal phase -- extract the generic approval engine before new approval-requiring features are built.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Polling KSeF instead of proper async pipeline | Simpler implementation | Missed confirmations, wasted API calls, no retry on failure | Never in production -- polling is fine for testing only |
| Single webhook handler for all providers | Less code initially | Impossible to debug, payload parsing breaks cross-provider | Never -- separate endpoints from day one |
| Storing OCR results directly as invoice fields | Skip review step, faster flow | Wrong financial data in system, tax reporting errors | Never for financial fields (amounts, NIP, dates) |
| Hardcoding DocuSign as only e-sign provider | Ship faster | Painful Autenti addition later, tight coupling everywhere | Acceptable only if Autenti phase is explicitly planned within 2-3 months |
| Per-integration credential storage | Each phase is self-contained | 6 different token refresh implementations, security audit nightmare | Never -- build shared credential store first |
| Contractor portal sharing admin tRPC routers | Avoid code duplication | Authorization leaks, contractor sees internal data in error responses | Never -- separate router layer for portal |
| Synchronous e-sign status checks | Simpler code flow | Blocked UI, timeouts, stale status | Acceptable as fallback when webhooks fail, not as primary |
| Skipping webhook signature verification | Faster development | Any attacker can forge webhook events, triggering fake approvals or status changes | Never |
| Skipping generic approval engine refactor | Ship timesheet/e-sign approvals faster | 3 divergent approval implementations, inconsistent UX, impossible to maintain | Only if v2.0 has a single new approval type (not 3+) |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| DocuSign | Generating signing URL at envelope creation time | Generate on-demand when user clicks "Sign" -- URL expires in 5 minutes |
| DocuSign | Same clientUserId for multiple recipients | Each recipient MUST have a unique clientUserId within an envelope |
| DocuSign | Relying on redirect URL for completion status | Redirect can be spoofed/cancelled -- confirm via webhook or Envelopes:get API call |
| DocuSign | Expecting real-time webhook delivery | Connect has 20 sec to several minute delay -- design UI for eventual consistency |
| Autenti | Expecting embedded signing like DocuSign | Autenti uses redirect-based signing flow -- design UX for leaving and returning |
| Autenti | Ignoring QES vs. standard signature distinction | QES carries full legal equivalence to handwritten signature under eIDAS; request the correct type based on document requirements |
| KSeF | Treating invoice submission as synchronous | Session-based: open session, submit batch, poll for UPO, store KSeF-ID, close session |
| KSeF | Not storing FA(3) XML | Required for audit, resubmission, and JPK_VDEK cross-referencing |
| KSeF | Ignoring authentication changes | Token auth ends Jan 2027, replaced by KSeF certificates. Plan for migration now |
| KSeF | Not handling `buyer_company` field | This boolean field determines whether the invoice is automatically sent to KSeF -- must always be set |
| Jira | Using API tokens without awareness of burst limits | New burst rate limits enforced per-endpoint per-tenant per-second as of Nov 2025. Points-based quota limits enforced from March 2026 |
| Jira | Many webhooks with heavy JQL filters | Slows down the Jira instance globally. Use minimal webhooks, filter in your handler |
| Jira | Not handling webhook concurrency limits | Max 20 concurrent requests per tenant+URL pair. Respond quickly, process async |
| Notion | Expecting webhook/real-time events | Notion API has NO webhooks. You must poll for changes or accept stale data |
| Notion | Aggressive API calls | Rate limit is 3 req/sec average (2700 per 15 min per integration token). Batch operations where possible |
| Notion | Large payload requests | Max 1000 block elements and 500KB per request. Paginate block retrieval |
| Confluence | Ignoring points-based rate limits | New points-based system from March 2026 -- complex operations cost more points than simple reads |
| Google Calendar | Not renewing webhook subscriptions | Webhooks expire after ~24 hours. Renewal cron every 20 hours is mandatory |
| Google Calendar | Not handling refresh token limits | Google limits refresh tokens per user-client pair. Exceeding limit silently invalidates older tokens |
| Google Calendar | Missing incremental sync | Use syncToken for subsequent syncs instead of re-fetching all events. Full sync is expensive and rate-limit-prone |
| Outlook/Graph | Skipping subscription validation handshake | Microsoft sends a validation POST on subscription creation -- must respond with validationToken in 10 seconds |
| Outlook/Graph | Assuming subscription longevity | Graph calendar subscriptions expire (max 4230 minutes ~3 days). Must renew proactively |
| Outlook/Graph | Not handling notification batching | Graph may batch multiple notifications into a single POST. Handler must iterate the `value` array |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| OCR processing blocking request thread | Upload endpoint times out, UI hangs | Process OCR as background job (QStash), return immediately with "processing" status | First invoice upload with a 5+ page PDF |
| KSeF polling in a tight loop | API rate limits hit, wasted compute | Use exponential backoff with jitter. Typical UPO arrives in 30 sec to 5 min | When submitting batch of 50+ invoices |
| Loading full contractor portal data on every page | Slow page loads, excessive DB queries | Scope queries strictly, use pagination, cache contractor profile data | When contractor has 100+ invoices/contracts |
| Calendar sync checking all events on every poll | API quota exhausted, slow sync | Use incremental sync tokens (Google syncToken, Graph deltaLink) | When org has 20+ calendar-connected users |
| Storing all webhook payloads without cleanup | Database bloat, slow queries on webhook_events | Add TTL/retention policy (30-90 days), archive old events | After 6 months of active webhook traffic |
| E-sign document storage duplicating files | R2 storage costs spike | Store document once, reference by ID. E-sign providers store their own copy | When processing 100+ contracts/month |
| Notion polling all linked pages on every sync | Rate limit exhaustion (3 req/sec), sync takes minutes | Cache page metadata, poll only pages modified since last sync (use `last_edited_time` filter) | When org links 50+ Notion pages |
| Multiple integrations refreshing tokens concurrently | Token refresh race conditions, credential store contention | Use a distributed lock or sequential refresh queue per org+provider | When 5+ integrations are active per org |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Contractor portal sharing session/cookie with admin app | Contractor gains admin access via session manipulation | Separate auth contexts, different cookie names/domains, distinct JWT claims with `user_type: contractor` |
| KSeF credentials (certificates) stored alongside app secrets | Compromise of app exposes tax system access for all tenants | Dedicated secrets management for KSeF certificates, not in .env or unencrypted database columns |
| OAuth tokens for integrations stored in plaintext | Database breach exposes all connected service tokens for all tenants | Encrypt at rest with per-tenant key, use Vercel encrypted environment for master key |
| Webhook endpoints without signature verification | Attacker forges webhook events (fake invoice approvals, fake signing completions, fake Jira status changes) | Verify HMAC/signature on every webhook before processing. Each provider has its own verification method |
| Contractor can enumerate other contractors via ID manipulation | Data leak across contractors within same org | Double-scope ALL portal queries: org_id + contractor_id. Never expose sequential IDs in portal URLs |
| E-sign callback URLs predictable or lacking state parameter | CSRF on signing completion, fake completion attacks | Include cryptographic state/nonce in returnUrl, verify on callback |
| Integration tokens with excessive OAuth scopes | Compromised token grants write access to all Jira projects, all calendars, all Notion workspace | Request minimum scopes needed. Jira: `read:jira-work`. Calendar: read/write only for specific calendar. Notion: specific page access only |
| OCR service receiving unscanned files | Malicious PDFs exploit OCR service vulnerabilities | Virus-scan files before sending to OCR service. Use sandboxed OCR processing |
| KSeF UPO not verified on receipt | Forged UPO could mark non-compliant invoice as compliant | Verify UPO signature against Ministry of Finance public key |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| OCR auto-fills invoice and submits without review | Wrong amounts enter approval chain, erode trust in the system | Always show review screen with original PDF side-by-side, highlight low-confidence fields in red/yellow |
| E-sign flow opens in new tab with no way back | User loses context, does not return to complete workflow | Use embedded signing where possible (DocuSign), clear "return to Contractor Ops" messaging for redirect flows (Autenti) |
| KSeF errors shown as raw API messages | User sees "SESJA_WYGASLA" or "BLAD_WALIDACJI" with no context | Map KSeF error codes to user-friendly Polish/English messages with actionable guidance |
| Contractor portal is a stripped-down admin UI | Feels half-baked, confusing navigation, contractor sees features they cannot use | Design portal as its own product experience -- dedicated layout, contractor-centric navigation, clear information hierarchy |
| Integration settings buried in org settings | Admin cannot find or monitor integrations, troubleshooting is painful | Dedicated "Integrations" page in settings with status indicators, connect/disconnect, health monitoring, and last-sync timestamps |
| Calendar sync creates duplicate reminders | Users get spammed with notifications from both the app and their calendar | Deduplicate: if calendar integration is active, suppress in-app reminders for synced events. Let user choose notification channel |
| Time tracking requires contractor to learn complex UI | Low adoption, contractors continue submitting time via email or not at all | Start simple: weekly summary with hours per day. One screen. Add project/task breakdown as optional enhancement |
| Jira integration requires admin-level Jira knowledge to configure | Non-technical ops users cannot set up the Jira connection | Guided setup wizard with project selection, default mappings, and test connection. No JQL required for basic setup |
| E-sign status shows "Processing" for minutes with no progress indicator | User clicks "Sign" again, creating duplicate envelopes | Show clear progress steps: "Document sent to [provider]" -> "Waiting for signature" -> "Signed". Disable re-send during processing |
| Notion/Confluence links break when pages are moved or renamed | Broken references in workflows and onboarding docs | Store page ID (not URL), fetch current title on display. Show "page not found" with re-link option when ID lookup fails |

## "Looks Done But Isn't" Checklist

- [ ] **Contractor Portal:** Often missing cross-contractor data isolation tests -- verify contractor A cannot see contractor B's invoices/contracts within the same org
- [ ] **Contractor Portal:** Often missing multi-org contractor access -- verify a contractor who works for Org A and Org B can switch contexts without data bleeding
- [ ] **Contractor Portal:** Often missing invite flow edge cases -- verify expired invite, re-invite, contractor already exists in system via different org
- [ ] **E-Sign (DocuSign):** Often missing signing order enforcement -- verify sequential signing works when second signer tries to sign before first completes
- [ ] **E-Sign (DocuSign):** Often missing embedded signing email suppression handling -- verify completion notifications still reach signers when needed
- [ ] **E-Sign (Autenti):** Often missing QES vs. standard signature distinction -- verify the correct signature type is requested based on document legal requirements
- [ ] **E-Sign (Both):** Often missing expiry/timeout handling -- verify what happens when a signing request expires without completion (30 days DocuSign default)
- [ ] **OCR:** Often missing poor-quality document handling -- verify the system gracefully handles blurry scans, rotated pages, and multi-page invoices
- [ ] **OCR:** Often missing Polish-specific field extraction -- verify NIP (10-digit, checksum-validated), REGON, numer faktury, and Polish date formats are correctly parsed
- [ ] **OCR:** Often missing confidence score display -- verify low-confidence fields are visually distinct in the review UI
- [ ] **KSeF:** Often missing offline/degraded mode -- verify the system queues invoices when KSeF is down and retries when it recovers
- [ ] **KSeF:** Often missing UPO retrieval -- verify every submitted invoice has a KSeF-ID and UPO reference before marking as compliant
- [ ] **KSeF:** Often missing FA(3) format validation before submission -- verify invoices are validated against the schema before sending to KSeF
- [ ] **Jira:** Often missing permission checking on the Jira side -- verify the connected Jira account has access to the projects being referenced
- [ ] **Jira:** Often missing disconnection handling -- verify what happens when Jira admin revokes the OAuth app or changes permissions
- [ ] **Calendar:** Often missing timezone handling -- verify events created in Warsaw timezone display correctly for users in other timezones
- [ ] **Calendar:** Often missing webhook renewal -- verify Google Calendar subscriptions are renewed before 24-hour expiry
- [ ] **Calendar:** Often missing Graph subscription renewal -- verify Outlook subscriptions are renewed before 3-day expiry
- [ ] **Integrations (All):** Often missing disconnect/cleanup flow -- verify disconnecting an integration revokes tokens, cancels webhooks, and cleans up data
- [ ] **Integrations (All):** Often missing re-auth flow -- verify when a token is revoked externally, the user is prompted to reconnect (not stuck in silent failure)
- [ ] **Integrations (All):** Often missing rate limit handling -- verify graceful degradation when any external API rate limits are hit

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Contractor data leak (cross-tenant or cross-contractor) | HIGH | Audit all contractor queries, add double-scoping extension, run data access audit, notify affected contractors, security disclosure if required |
| KSeF invoices submitted without UPO tracking | MEDIUM | Query KSeF API for historical submissions by NIP, backfill KSeF-IDs, add submission tracking table, resubmit any unconfirmed invoices |
| OCR auto-accepted wrong invoice amounts | HIGH | Audit all OCR-created invoices, flag unreviewed ones, add mandatory review step, reprocess flagged invoices, reverse any incorrect payments |
| E-sign abstraction breaks for one provider | LOW | The thin interface pattern limits blast radius -- fix the specific adapter without touching the other |
| Webhook events lost during deployment | MEDIUM | Each provider has retry logic -- ensure endpoints recover quickly. Backfill by polling provider APIs for recent events |
| Integration tokens expired silently | LOW | Run credential health check across all tenants, trigger re-auth for affected orgs, add proactive monitoring |
| Calendar sync created duplicates | LOW | Deduplicate by external event ID, add idempotency check, clean up existing duplicates via batch script |
| Credential store breached (plaintext tokens) | HIGH | Rotate ALL integration tokens across ALL tenants, encrypt credential store, audit access logs, notify affected customers |
| Approval chain does not work for new entity types | MEDIUM | Extract generic engine from invoice-specific code, migrate existing approval data to generic schema, update all entity-specific modules |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Credential sprawl | Integration Foundation (Phase 1) | Unified `integration_credentials` table exists, all integrations use shared `getCredential()` |
| Webhook chaos | Integration Foundation (Phase 1) | Central webhook router with event log table, signature verification per provider, async processing |
| Approval chain not generic | Integration Foundation (Phase 1) | Generic approval engine extracted, working for at least 2 entity types |
| Contractor tenant boundary | Contractor Portal (Phase 2) | Double-scoped Prisma extension, cross-contractor isolation tests pass for all portal queries |
| Time tracking low adoption | Contractor Portal (Phase 2) | Simple weekly grid UX, Jira import working, time tracking optional per contract |
| OCR accuracy overconfidence | OCR Parsing (Phase 3) | Mandatory human review step, confidence scores displayed, side-by-side PDF view, NIP validation |
| KSeF session mishandling | KSeF Integration (Phase 4) | Async pipeline with status tracking, UPO retrieval, retry with backoff, degraded mode |
| KSeF auth migration needed | KSeF Integration (Phase 4) | Certificate-based auth implemented alongside token auth, migration path documented |
| E-sign abstraction leak | E-Sign Integration (Phase 5) | Thin interface with separate adapters, provider-specific webhook endpoints, both providers tested independently |
| Calendar webhook expiry | Calendar Integration (Phase 6) | Renewal cron job verified, subscription health monitoring, incremental sync tokens used |
| Jira rate limiting | Jira Integration (Phase 6) | Burst-aware rate limiter, async webhook processing, points-based quota tracking |
| Notion no-webhook gap | Notion/Confluence Integration (Phase 6) | Polling strategy with `last_edited_time` filter, cache layer, stale-data indicator in UI |

## Sources

- [DocuSign Embedded Signing Docs](https://developers.docusign.com/docs/esign-rest-api/esign101/concepts/embedding/embedded-signing/)
- [DocuSign Connect -- Real-Time Updates in Embedded Signing](https://www.docusign.com/blog/developers/the-trenches-real-time-updates-embedded-signing-workflow)
- [DocuSign Integration Gaps and Issues (Signeasy analysis)](https://signeasy.com/blog/business/docusign-integrations)
- [DocuSign API Usage Issues](https://developers.docusign.com/partner/integration-guide/api-usage-issues/)
- [Autenti Developer Portal](https://developers.autenti.com/)
- [Autenti Pricing / API](https://autenti.com/en/pricing/api)
- [KSeF API Test Environment](https://api-test.ksef.mf.gov.pl/)
- [KSeF 2.0 API and FA(3) Structure Changes (RTC Suite)](https://rtcsuite.com/understanding-polands-ksef-2-0-api-documentation-and-fa3-structure-key-changes-and-released-api-documentation/)
- [KSeF Implementation Roadmap (Seeburger)](https://blog.seeburger.com/ksef-and-the-e-invoicing-mandate-from-2026-your-roadmap-for-practical-implementation/)
- [Poland KSeF E-Invoicing (Dudkowiak)](https://www.dudkowiak.com/tax-law-in-poland/e-invoicing-in-poland-ksef/)
- [Poland KSeF No Launch Penalties (VATCalc)](https://www.vatcalc.com/poland/poland-mandatory-b2b-ksef-e-invoices-delay-to-july-2024/)
- [KSeF REST API Documentation (ksefapi.pl)](https://ksefapi.pl/en/rest-ksef-api-dokumentacja/)
- [OCR Invoice Accuracy Issues (Planergy)](https://planergy.com/blog/ocr-accuracy/)
- [Common OCR Errors (Gennai)](https://www.gennai.io/blog/common-ocr-errors-fix-them)
- [OCR Invoice Benchmark (AIMultiple)](https://research.aimultiple.com/invoice-ocr/)
- [Best Invoice OCR 2025 (Unstract)](https://unstract.com/blog/best-ocr-for-invoice-processing-invoice-ocr/)
- [Jira Cloud Rate Limiting](https://developer.atlassian.com/cloud/jira/platform/rate-limiting/)
- [Jira Webhooks Guide (InventiveHQ)](https://inventivehq.com/blog/jira-webhooks-guide)
- [Atlassian Burst Rate Limit Enforcement](https://community.atlassian.com/forums/Jira-articles/Reminder-Please-ensure-your-Apps-comply-with-Jira-Cloud-Burst/ba-p/3150831)
- [Notion API Rate Limits](https://developers.notion.com/reference/request-limits)
- [Understanding Notion API Rate Limits 2025 (Oreate AI)](https://www.oreateai.com/blog/understanding-notion-api-rate-limits-in-2025-what-you-need-to-know/50d89b885182f65117ff8af2609b34c2)
- [Confluence Cloud Rate Limiting](https://developer.atlassian.com/cloud/confluence/rate-limiting/)
- [Google Calendar OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [Calendar Webhook Integration Guide (CalendHub)](https://calendhub.com/blog/calendar-webhook-integration-developer-guide-2025/)
- [Outlook Calendar API Integration (GetKnit)](https://www.getknit.dev/blog/outlook-calendar-api-integration-in-depth)
- [Best Calendar APIs 2025 (Cronofy)](https://www.cronofy.com/blog/best-calendar-apis)
- [Multi-Tenant RBAC Design (WorkOS)](https://workos.com/blog/how-to-design-multi-tenant-rbac-saas)
- [Multi-Tenancy in B2B SaaS (Auth0)](https://auth0.com/blog/demystifying-multi-tenancy-in-b2b-saas/)
- [RBAC for SaaS Platforms (EnterpriseReady)](https://www.enterpriseready.io/features/role-based-access-control/)

---
*Pitfalls research for: Contractor Ops v2.0 Platform Expansion*
*Researched: 2026-03-23*
