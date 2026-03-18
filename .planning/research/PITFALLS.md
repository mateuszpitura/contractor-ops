# Pitfalls Research

**Domain:** B2B Contractor Operations / Multi-Tenant SaaS
**Researched:** 2026-03-18
**Confidence:** HIGH (stack-specific), MEDIUM (domain workflows)

## Critical Pitfalls

### Pitfall 1: Multi-Tenant Data Leakage via Missing or Bypassed Tenant Scoping

**What goes wrong:**
Tenant A sees Tenant B's contractors, invoices, or financial data. This is a business-ending security failure in B2B SaaS. The most common cause is not a missing WHERE clause on the obvious queries, but on forgotten edge paths: search endpoints, report aggregations, audit log queries, file download URLs, and bulk export operations.

**Why it happens:**
Prisma middleware for `organization_id` scoping works for standard CRUD but breaks in several ways:
- New tables added without tenant scoping (developer forgets to add the middleware rule for a new model).
- Raw SQL queries (for reports or complex aggregations) bypass Prisma middleware entirely.
- Prisma Client Extensions or `$queryRaw` calls do not go through middleware.
- Admin/debug endpoints accidentally bypass tenant context.
- Connection pooling with Neon: session variables (if using RLS) can leak between requests if not explicitly reset per request.

**How to avoid:**
1. Use Prisma Client Extensions (not deprecated middleware) to inject `organization_id` into every query automatically. Create a tenant-scoped client factory that returns a client bound to a specific org.
2. Add a database-level safety net: create a PostgreSQL function that checks `current_setting('app.current_org_id')` and use it in critical views.
3. Write integration tests that specifically test cross-tenant isolation: create data in Org A, query as Org B, assert zero results. Run these tests for every model.
4. For raw SQL queries (reports), always use parameterized `organization_id` and review in code review checklist.
5. File access: never expose raw S3 keys. Generate signed URLs scoped to the requesting org, and validate org ownership before generating the URL.

**Warning signs:**
- Any Prisma `$queryRaw` or `$executeRaw` call without explicit `organization_id` parameter.
- New Prisma models without `organizationId` field.
- API endpoints that return data without checking the tenant context in tests.
- Search/filter endpoints returning unexpected result counts.

**Phase to address:**
Foundation phase (database + auth setup). Tenant scoping must be baked into the Prisma client factory from day 1, not retrofitted. Every subsequent phase inherits this protection.

---

### Pitfall 2: Approval Workflow State Machine Corruption

**What goes wrong:**
Invoices get stuck in limbo states, approved twice, or skip approval levels. Common edge cases:
- Approver is deleted/deactivated mid-approval chain -- invoice is stuck with no valid next approver.
- Concurrent approvals: two people approve/reject simultaneously, creating race conditions.
- Approval chain is reconfigured while invoices are mid-flight -- do in-flight invoices follow the old chain or the new one?
- Delegated approval: person A delegates to person B, but person B also has a pending approval at a later level -- creates circular or duplicate approval.
- Approver approves, then the invoice amount is corrected -- should the approval be invalidated?

**Why it happens:**
Approval workflows look simple (pending -> approved -> paid) but are actually complex state machines. Developers model them as a status field with conditional logic instead of an explicit state machine with defined transitions, guards, and effects.

**How to avoid:**
1. Model approval as an explicit state machine with defined states and transitions. Use a library like XState or build a simple one: define all valid transitions and reject any transition not in the map.
2. Snapshot the approval chain configuration at invoice submission time. In-flight invoices always use their snapshotted chain, never the current org config.
3. Handle approver unavailability: define a fallback (escalate to admin, auto-delegate to manager's manager) and implement SLA timers that trigger escalation.
4. Use optimistic locking (version field) on invoice/approval records to prevent concurrent state changes. Prisma supports this natively with `@updatedAt` or explicit version fields.
5. Any amount change after approval starts must reset the approval chain -- this is a business rule, enforce it in the state machine.

**Warning signs:**
- Invoice status modeled as a simple string enum without transition validation.
- No `approvalChainSnapshot` or equivalent stored with the invoice.
- No handling for "what if the approver no longer exists" in code.
- No concurrency control on status updates.

**Phase to address:**
Invoice and approval phase. Design the state machine before writing any approval UI. Document all states and transitions in a diagram.

---

### Pitfall 3: Financial Rounding and Currency Precision Errors

**What goes wrong:**
Invoice totals do not match when summed. A payment batch of 15 invoices shows a 0.01 PLN discrepancy vs. the sum of individual invoices. Reports show different totals than the invoice list. Tax calculations compound rounding errors. These "penny errors" destroy trust with finance users who reconcile to the grosz.

**Why it happens:**
- Using JavaScript `number` (IEEE 754 float) for currency calculations. `0.1 + 0.2 !== 0.3` in JavaScript.
- Prisma returns `Decimal` fields as strings by default, and developers parse them with `parseFloat()` losing precision.
- Rounding at different points in the calculation chain (round each line item vs. round the total).
- Mixing PLN (2 decimal places) with potential future currencies that have different precision.
- Database stores `DECIMAL(10,2)` but application does intermediate math in floats.

**How to avoid:**
1. Use `Decimal` type in Prisma schema for all monetary fields. Use a library like `decimal.js` or `dinero.js` for all arithmetic in application code -- never use native JS arithmetic on money.
2. Store amounts in the smallest currency unit (grosze for PLN, so 1234 = 12.34 PLN) as integers. This eliminates floating-point issues entirely. This is the strongest approach.
3. Define a single rounding policy: round each line item to 2 decimal places, then sum. Document this and apply it consistently.
4. Prisma `Decimal` fields: configure the client to return `Decimal` objects, not strings. Handle serialization explicitly.
5. Write property-based tests: generate random invoice amounts, verify that sum of parts equals the total after rounding.

**Warning signs:**
- Any use of `parseFloat()` or `Number()` on monetary values in the codebase.
- Prisma schema using `Float` instead of `Decimal` for money fields.
- Report totals that do not match the sum of line items by 0.01.
- No money library in `package.json`.

**Phase to address:**
Database schema design phase. The decision to use integers-as-grosze or `Decimal` must be made before any invoice or payment code is written. Retrofitting is extremely painful.

---

### Pitfall 4: Vercel Serverless Cannot Run Background Jobs Natively

**What goes wrong:**
Developers build the MVP assuming they can run background tasks: email intake polling, SLA timer checks, overdue invoice detection, payment file generation, report generation. Then they discover Vercel functions have a 10-second default timeout (60s max on Hobby, 300s on Pro), no persistent processes, and no native job queue.

This project requires several background operations:
- Email inbox polling for invoice intake.
- SLA timer expiry checks for approvals.
- Overdue invoice/contract expiry detection.
- Payment batch CSV/bank file generation.
- Notification digests.
- Audit log cleanup/archival.

**Why it happens:**
Vercel is optimized for request-response. Background processing requires a different execution model.

**How to avoid:**
1. Use Upstash QStash for HTTP-based async job dispatch. QStash calls your Vercel API routes as webhooks with built-in retries and dead letter queues. This is the canonical Vercel pattern.
2. Use Vercel Cron Jobs (available on all plans) for scheduled tasks: poll email inbox every 5 minutes, check SLA timers every minute, detect overdue invoices daily.
3. For long-running tasks (report generation, large CSV export): use `next/after` (Next.js 15+) to continue processing after sending the response, or split into chunked processing via QStash.
4. Design all background operations as idempotent HTTP endpoints from the start. This is the key architectural decision -- do not design them as in-process workers.
5. For email intake: use an inbound email webhook service (e.g., Resend, Postmark inbound) that POSTs to your API route, rather than polling an IMAP inbox.

**Warning signs:**
- Any code that uses `setInterval`, `setTimeout` for recurring tasks, or spawns child processes.
- Assumptions about long-running processes in architecture docs.
- Email intake designed as IMAP polling instead of webhook-based inbound.
- No QStash or equivalent in the dependency list.

**Phase to address:**
Infrastructure/foundation phase. The background job pattern must be decided before building any feature that needs it (notifications, email intake, SLA timers). Wire up QStash + Vercel Cron in the foundation.

---

### Pitfall 5: Prisma Performance Degradation at Scale

**What goes wrong:**
API response times climb from 100ms to 3-7 seconds as data grows. Memory usage spikes to multiple GB. Cold starts on Vercel become painful. Specific symptoms:
- Prisma Client generation produces a massive bundle with many models (14+ modules means 40+ tables).
- N+1 queries on contractor lists with nested relations (contracts, invoices, compliance status).
- Connection pool exhaustion under concurrent requests in serverless.
- `findMany` without pagination loading thousands of records.

**Why it happens:**
Prisma's DX-friendly API makes it easy to write queries that are convenient but inefficient. The `include` API encourages deep nesting. Serverless cold starts regenerate the Prisma engine binary. Each serverless invocation may create a new connection.

**How to avoid:**
1. Use Neon's connection pooler (PgBouncer) URL for `DATABASE_URL` and direct connection for `DIRECT_URL` (migrations only). Set `connection_limit=1` per serverless function instance.
2. Use `select` instead of `include` wherever possible -- fetch only the fields you need. Avoid nested `include` beyond 2 levels.
3. Implement cursor-based pagination for all list endpoints from day 1. Never use offset pagination for user-facing lists.
4. Use Prisma's `@prisma/adapter-neon` driver adapter for serverless-optimized connections (GA since Prisma v6.16).
5. Monitor query performance with Prisma's built-in logging (`log: ['query']` in dev) and set up query duration alerts.
6. For complex reports, use raw SQL with `$queryRaw` -- Prisma's query builder is not designed for analytical queries with GROUP BY, window functions, etc.
7. Consider Prisma Accelerate for connection pooling and global caching if Neon's pooler proves insufficient.

**Warning signs:**
- API endpoints taking > 500ms in development (they will be slower in production with cold starts).
- Prisma queries with 3+ levels of `include`.
- No `take`/`cursor` on `findMany` calls.
- Connection timeout errors in Vercel logs.
- Neon dashboard showing connection count near the limit.

**Phase to address:**
Foundation phase for connection setup. Every feature phase for query optimization. Add Prisma query logging from the start.

---

### Pitfall 6: Better Auth Organization and Session Misconfigurations

**What goes wrong:**
Users can access resources across organizations they do not belong to. Session tokens persist after org membership revocation. Role checks pass on the client but fail on the server (or vice versa). The organization plugin's default roles (owner/admin/member) do not map to the app's 8-role RBAC model.

**Why it happens:**
Better Auth's organization plugin provides a foundation, but the project requires 8 roles (admin, finance, ops, manager, legal viewer, IT admin, accountant, readonly). The default 3 roles must be extended. Key issues:
- Client-side `checkRolePermission` does not include dynamic roles -- it runs synchronously and cannot check database-stored permissions.
- Better Auth sessions may not include the current organization context, requiring explicit org switching/selection.
- Middleware-only auth checks are insufficient in Next.js -- must verify at data access layer.
- Token revocation on role change or org removal may not be immediate.

**How to avoid:**
1. Define all 8 roles and their permissions using Better Auth's custom role/permission system from the start. Map each role to specific CRUD permissions per resource type.
2. Always use server-side `hasPermission` API for authorization, never client-side `checkRolePermission` for security-critical checks. Client-side checks are for UI display only.
3. Store the active `organizationId` in the session. On every API call, verify the user's membership and role in that organization at the data layer, not just in middleware.
4. Implement a session invalidation strategy: when a user's role changes or they are removed from an org, invalidate their session or mark it for re-verification.
5. Run `npx @better-auth/cli migrate` after any plugin configuration change -- missing database tables are a silent failure mode.

**Warning signs:**
- Authorization checks only in Next.js middleware, not in tRPC procedures.
- No `organizationId` in the session or request context.
- Using default 3 roles without custom role definitions.
- No test for "user removed from org can no longer access org resources."

**Phase to address:**
Auth and RBAC phase. Must be set up correctly before any resource-level authorization is implemented. Every subsequent feature relies on this.

---

### Pitfall 7: Invoice Duplicate Detection That Misses Real Duplicates or Flags False Positives

**What goes wrong:**
The same invoice is paid twice (duplicate not caught), or legitimate invoices are blocked as duplicates (false positive), creating friction. Common failure modes:
- Contractor resubmits an invoice with a slightly different number (FV/2026/001 vs FV-2026-001).
- Same contractor, same amount, different invoice number -- is it a duplicate or two legitimate invoices?
- Invoice number normalization differs between email intake and manual upload.
- Monthly recurring invoices from the same contractor for the same amount are flagged as duplicates.

**Why it happens:**
Duplicate detection based on exact match of (invoice_number + contractor_id + amount) is too rigid. Real-world invoice numbers have inconsistent formatting. Recurring invoices legitimately repeat contractor + amount combinations.

**How to avoid:**
1. Normalize invoice numbers before comparison: strip whitespace, normalize separators (/ - _), uppercase. Store both the original and normalized form.
2. Use a composite detection strategy: exact match on (normalized_invoice_number + contractor_id) is the primary check. Amount match is secondary confirmation, not a standalone signal.
3. For recurring invoices: add a date-range window. Same contractor + same amount within 5 days = likely duplicate. Same contractor + same amount 25-35 days apart = likely recurring, not duplicate.
4. Flag suspected duplicates for human review rather than auto-rejecting. Show the matched invoice side-by-side for quick resolution.
5. Track the invoice source (email vs. manual upload) to detect cross-channel duplicates.

**Warning signs:**
- Duplicate detection using only exact string matching on invoice numbers.
- No normalization of invoice numbers.
- Recurring monthly invoices from the same contractor constantly flagged.
- No "suspected duplicate" status -- only "duplicate" or "not duplicate."

**Phase to address:**
Invoice intake phase. Design the detection algorithm before building the intake UI.

---

### Pitfall 8: File Upload Security Holes with Signed URLs

**What goes wrong:**
Attackers upload malicious files (HTML with embedded JS, SVG with scripts, executable disguised as PDF). Files are served from the same domain or a domain the browser trusts, enabling XSS. Signed URLs are shared or leaked, granting unauthorized access to sensitive documents (contracts, invoices with financial data).

**Why it happens:**
Pre-signed URLs are designed for convenience, not security. They do not authenticate the user -- anyone with the URL has access. Content-Type headers are client-provided and trivially spoofed. Developers trust file extensions rather than file content.

**How to avoid:**
1. Validate file content server-side after upload: check magic bytes (file signatures) to verify actual file type. Do not trust Content-Type headers or file extensions. Use a library like `file-type` (npm).
2. Set short expiry on signed URLs (5-15 minutes for downloads, 5 minutes for uploads).
3. Serve files from a separate domain (e.g., `files.contractorops.com`) to prevent XSS from affecting the main application. Set `Content-Disposition: attachment` to force download instead of inline rendering.
4. Set `Content-Security-Policy` and `X-Content-Type-Options: nosniff` headers on file responses.
5. Scope file paths by organization: `/{org_id}/{entity_type}/{entity_id}/{file_id}`. Verify org ownership before generating any signed URL.
6. Implement virus scanning via ClamAV or a cloud scanning service (e.g., Cloudflare R2 event notification -> scanner function).
7. Store file metadata (original name, size, content type, uploader, org) in the database. Never expose internal storage paths to clients.

**Warning signs:**
- Signed URLs with expiry > 1 hour.
- No server-side file type validation after upload.
- Files served from the main application domain.
- No `Content-Disposition: attachment` on file responses.
- File paths not scoped by organization ID.

**Phase to address:**
Document management phase. File upload infrastructure must be secure from the first implementation.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skipping tenant isolation tests | Faster development | Data leakage in production, catastrophic trust loss | Never |
| Using `Float` for money in Prisma | Simpler schema | Rounding errors that compound over time, impossible to fix without migration | Never |
| Hardcoding approval chain logic | Faster MVP for approvals | Cannot support configurable chains, massive refactor needed | Never -- model it right from the start |
| Storing files on Vercel's `/tmp` | No external storage needed | Files lost on function recycle, no persistence, no multi-instance sharing | Only for truly ephemeral processing (virus scan buffer) |
| Using offset pagination | Simpler to implement | Performance degrades linearly with page depth, inconsistent results with concurrent writes | Acceptable for admin-only views with < 1000 records |
| Polling IMAP for email intake | Works without webhook setup | Unreliable in serverless (timeouts, connection overhead), missed emails | Never on Vercel -- use inbound email webhooks |
| Single Prisma Client instance (no tenant scoping) | Less abstraction | Must retrofit tenant scoping into every query, high risk of data leakage | Never in multi-tenant SaaS |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Neon PostgreSQL | Using direct connection string for app queries (bypasses pooler, exhausts connections) | Use pooled connection for app, direct connection only for migrations in `DIRECT_URL` |
| Upstash QStash | Not verifying webhook signatures on incoming job callbacks | Always verify QStash signatures to prevent spoofed job executions |
| Cloudflare R2 / S3 | Trusting client-provided Content-Type during upload | Validate magic bytes server-side after upload completes |
| Slack API | Sending approval notifications without handling token expiry or rate limits | Implement token refresh, exponential backoff, and queue Slack messages through QStash |
| Email inbound (Resend/Postmark) | Parsing attachments synchronously in the webhook handler | Accept the webhook immediately (return 200), queue attachment processing via QStash |
| Better Auth | Not running CLI migrations after adding/changing plugins | Always run `npx @better-auth/cli migrate` and verify tables exist |
| Vercel Cron | Assuming cron runs are guaranteed exact-time | Cron on Vercel is best-effort timing; design jobs to be idempotent and handle missed/duplicate runs |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Prisma `include` with 3+ nesting levels on list pages | Slow page loads, high memory, N+1 queries | Use `select` with flat queries, fetch nested data on detail pages only | > 500 contractors with contracts and invoices |
| Audit log table without partitioning | Slow inserts, slow queries, bloated table | Partition by month from day 1, add time-range indexes | > 100K audit entries (~3-6 months of active use) |
| Dashboard KPIs computed on every request | Slow dashboard load, database contention | Pre-compute KPIs via scheduled cron job, cache in Redis/Upstash | > 10 concurrent dashboard users |
| Full-text search via Prisma `contains` (SQL LIKE) | Slow searches, full table scans | Use PostgreSQL full-text search (`tsvector`) or a search index | > 5K contractors/invoices |
| Fetching all invoices for payment batch screen | Timeout on large batches, memory spikes | Paginate and use server-side filtering, stream CSV generation | > 200 invoices per batch |
| Neon cold starts on first request | 500ms-2s latency spike after inactivity | Keep Neon compute active (disable scale-to-zero on Pro plan) or accept the latency with a loading state | Every period of 5+ minutes inactivity |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Tenant ID from client request instead of session | Attacker changes org_id in request to access other tenants | Always derive organization_id from the authenticated session, never from request params |
| Audit log entries editable or deletable | Audit trail integrity compromised, compliance failure | Remove UPDATE and DELETE permissions on audit table for the application database role |
| Approval actions without re-authentication | Stolen session can approve high-value invoices | Require re-authentication or confirmation for approvals above a configurable threshold |
| Signed URLs with long expiry shared via Slack | Documents accessible to anyone with the URL indefinitely | Short expiry (15 min), log URL generation in audit, consider one-time-use tokens |
| Invoice amount modification after approval | Approved amount differs from paid amount | Lock invoice record after first approval, any change resets the approval chain |
| Slack webhook endpoint without signature verification | Attacker can spoof approval actions via Slack | Verify Slack request signatures on every incoming webhook |
| CSV/bank file export without access control | Any logged-in user can export payment files with bank details | Restrict payment file export to finance/admin roles, log every export |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Approval notifications without context | Approver must click through to understand what they are approving | Include contractor name, amount, contract reference, and deviation flags in the notification (email, Slack, in-app) |
| No batch operations on invoice/contractor lists | Finance user must process invoices one by one | Support bulk approve, bulk reject, bulk status change from day 1 |
| Mandatory comments on every approval | Slows down routine approvals, users write "ok" or "." | Only require comments on rejection or when amount deviates from contract |
| Dashboard showing all-time data by default | Meaningless KPIs, slow load | Default to current month with easy period switching |
| Workflow tasks without clear ownership | Tasks fall through cracks, nobody knows whose responsibility | Always show assignee name, due date, and escalation path on every task |
| Contract expiry warnings too late | Contracts expire before renewal is initiated | Send warnings at 90, 60, 30, and 7 days before expiry; make the first warning early enough to act |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Multi-tenancy:** Works for CRUD but not tested for search, reports, file downloads, and audit log queries -- verify cross-tenant isolation on ALL endpoints
- [ ] **Approval workflow:** Happy path works but no handling for deleted approver, concurrent approval, amount change after approval, or expired SLA -- verify all edge cases
- [ ] **Invoice matching:** Matches exact invoice numbers but no normalization, no recurring invoice handling, no cross-channel dedup -- verify with real-world invoice formats
- [ ] **Payment batch:** Generates CSV but no idempotency key, no handling for partial failures (3 of 15 marked as failed), no re-export safeguard -- verify edge cases
- [ ] **Notifications:** Sends emails but no deduplication, no rate limiting, no unsubscribe/preference management -- verify users do not get spammed
- [ ] **Audit log:** Inserts entries but no immutability enforcement, no partition strategy, no retention policy -- verify entries cannot be modified and old data can be archived
- [ ] **File uploads:** Accepts uploads but no virus scanning, no file type validation beyond extension, no size limits enforced server-side -- verify security measures
- [ ] **RBAC:** Roles defined but no test that "readonly" user cannot approve, "accountant" cannot delete contractors, etc. -- verify negative permissions for all 8 roles
- [ ] **i18n:** UI strings translated but date formats, number formats, currency formatting not localized -- verify PLN formatting with Polish locale (1 234,56 not 1,234.56)
- [ ] **Email intake:** Parses attachments but no handling for emails without attachments, multi-attachment emails, non-PDF attachments, or oversized files -- verify all email variations

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Tenant data leakage discovered | HIGH | Immediate incident response, audit all cross-tenant queries, notify affected tenants, add RLS as defense-in-depth, comprehensive test suite |
| Float-based money calculations in production | HIGH | Migrate all monetary columns to integer (grosze), update all application code, recompute any affected totals, verify with finance team |
| Stuck approval workflows | MEDIUM | Build an admin override endpoint to force-transition invoice states, backfill missing approval chain snapshots, add monitoring for stuck states |
| Prisma connection exhaustion | LOW | Reduce `connection_limit`, switch to Neon pooler URL, add connection timeout handling, consider Prisma Accelerate |
| Audit log table performance degradation | MEDIUM | Add partitioning retroactively (requires table rewrite), archive old partitions, add time-based indexes |
| File security breach via uploaded malware | HIGH | Scan all existing files, quarantine suspicious ones, implement server-side validation, rotate all active signed URLs |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Tenant data leakage | Foundation (DB + Auth) | Cross-tenant isolation integration tests pass for every model |
| Approval state corruption | Invoice + Approval module | State machine diagram covers all transitions; edge case tests pass |
| Currency rounding errors | Foundation (DB schema) | Property-based tests verify sum consistency; no `Float` in Prisma schema |
| No background job support | Foundation (Infrastructure) | QStash + Vercel Cron wired up; at least one scheduled job running |
| Prisma performance at scale | Foundation + Every feature phase | Query logging enabled; no endpoint > 500ms in dev; no 3+ level includes |
| Better Auth misconfiguration | Auth + RBAC phase | All 8 roles tested with positive and negative permission checks |
| Duplicate invoice detection failures | Invoice intake phase | Test suite covers normalized numbers, recurring invoices, cross-channel dedup |
| File upload security | Document management phase | Uploaded test files with spoofed types are rejected; signed URLs expire correctly |
| Audit log not truly immutable | Foundation phase | Database role cannot UPDATE/DELETE audit table; trigger test confirms |
| Neon cold start latency | Foundation (Infrastructure) | Measured cold start time acceptable; scale-to-zero policy configured |

## Sources

- [Prisma multi-tenant performance issues (GitHub #20375)](https://github.com/prisma/prisma/issues/20375)
- [Prisma ORM Challenges at Large Scale](https://medium.com/@dotsinspace/challenges-with-prisma-io-orm-82bfc54043d1)
- [Neon connection pooling docs](https://neon.com/docs/connect/connection-pooling)
- [Connect from Prisma to Neon](https://neon.com/docs/guides/prisma)
- [Prisma Neon driver adapter docs](https://www.prisma.io/docs/orm/overview/databases/neon)
- [Better Auth organization plugin](https://better-auth.com/docs/plugins/organization)
- [Better Auth Next.js integration](https://better-auth.com/docs/integrations/next)
- [Better Auth CVE-2025-61928 (API key vulnerability)](https://github.com/better-auth/better-auth/issues/5584)
- [Multi-tenant data isolation with PostgreSQL RLS (AWS)](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/)
- [Postgres RLS Implementation Guide - Pitfalls](https://www.permit.io/blog/postgres-rls-implementation-guide)
- [Vercel serverless limits](https://vercel.com/docs/limits)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [Upstash QStash documentation](https://deepwiki.com/upstash/docs/3-qstash-message-queue-and-scheduler)
- [Securing S3 presigned URLs (AWS)](https://aws.amazon.com/blogs/compute/securing-amazon-s3-presigned-urls-for-serverless-applications/)
- [Bypassing bucket upload policies and signed URLs](https://labs.detectify.com/writeups/bypassing-and-exploiting-bucket-upload-policies-and-signed-urls/)
- [Currency handling pitfalls in fintech](https://bitcat.dev/avoid-common-pitfalls-fintech-currency-handling/)
- [Immutable audit log architecture patterns](https://www.designgurus.io/answers/detail/how-do-you-enforce-immutability-and-appendonly-audit-trails)
- [Invoice approval workflow best practices (Rillion)](https://www.rillion.com/blog/invoice-approval-workflow-best-practices/)

---
*Pitfalls research for: B2B Contractor Operations / Multi-Tenant SaaS*
*Researched: 2026-03-18*
