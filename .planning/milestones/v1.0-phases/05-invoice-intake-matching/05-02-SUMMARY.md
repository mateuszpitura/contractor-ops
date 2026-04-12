---
phase: 05-invoice-intake-matching
plan: 02
subsystem: api
tags: [resend, webhook, email-intake, r2, invoice, s3]

# Dependency graph
requires:
  - phase: 05-01
    provides: "Invoice schema, matching service, R2 storage patterns"
  - phase: 03-02
    provides: "Document model, R2 upload/download, virus scan infrastructure"
provides:
  - "POST /api/webhooks/resend-inbound endpoint for email-to-invoice intake"
  - "Org slug parsing from recipient email addresses"
  - "PDF attachment upload to R2 with Invoice draft creation"
  - "RESEND_WEBHOOK_SECRET env var for webhook signature verification"
affects: [05-03, 05-04, 05-05]

# Tech tracking
tech-stack:
  added: [resend]
  patterns: [webhook-signature-verification, email-org-routing, server-side-r2-upload]

key-files:
  created:
    - apps/web/src/app/api/webhooks/resend-inbound/route.ts
  modified:
    - .env.example
    - apps/web/package.json

key-decisions:
  - "Resend webhooks.verify with svix headers for signature verification"
  - "Org slug parsed from recipient domain (invoices@{slug}.contractorhub.io)"
  - "Server-side PutObjectCommand for R2 upload (not presigned URL) since webhook is server context"
  - "Documents created with virusScanStatus PENDING for async scan infrastructure"
  - "resend SDK installed in web package (not api) since webhook route lives in Next.js app"
  - "Added @contractor-ops/db as web dependency for direct Prisma access in webhook route"

patterns-established:
  - "Webhook route pattern: signature verify -> event type filter -> org lookup -> process"
  - "Email domain routing: {slug}.contractorhub.io maps to organization by slug"
  - "Non-PDF attachments stored as SUPPORTING_ATTACHMENT when PDF attachments exist"

requirements-completed: [INV-02]

# Metrics
duration: 7min
completed: 2026-03-21
---

# Phase 05 Plan 02: Resend Inbound Webhook Summary

**Resend Inbound webhook handler that receives emails, verifies signatures, parses org slug from recipient, uploads PDF attachments to R2, and creates Invoice drafts with EMAIL_INTAKE source**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-21T20:36:54Z
- **Completed:** 2026-03-21T20:44:20Z
- **Tasks:** 1
- **Files modified:** 4

## Accomplishments
- POST /api/webhooks/resend-inbound endpoint processes Resend email.received webhook events
- Webhook signature verification via resend.webhooks.verify rejects invalid requests with 401
- Org slug parsed from recipient email (invoices@{slug}.contractorhub.io) with Display Name format support
- Each PDF attachment creates a separate Invoice draft (RECEIVED status, EMAIL_INTAKE source, UNMATCHED)
- Non-PDF attachments stored as SUPPORTING_ATTACHMENT role linked to invoice
- submittedByEmail stores the sender email address

## Task Commits

Each task was committed atomically:

1. **Task 1: Resend Inbound webhook handler and env vars** - `eb911b4` (feat)

## Files Created/Modified
- `apps/web/src/app/api/webhooks/resend-inbound/route.ts` - Resend Inbound webhook POST handler
- `.env.example` - Added RESEND_WEBHOOK_SECRET env var
- `apps/web/package.json` - Added resend SDK and @contractor-ops/db dependencies
- `pnpm-lock.yaml` - Lockfile update

## Decisions Made
- Used Resend SDK's `webhooks.verify({ payload, headers: { id, timestamp, signature }, webhookSecret })` API (not the deprecated two-arg form)
- Installed resend in web package rather than api package since the webhook route is a Next.js API route
- Added @contractor-ops/db as direct dependency of web package for Prisma access in webhook route
- Server-side PutObjectCommand for R2 upload (not presigned URL) since this is a server-to-server context
- Documents stay in virusScanStatus PENDING -- the existing scan infrastructure handles async scanning
- Non-PDF-only emails return 200 with no processing (graceful skip)
- Missing org returns 200 (don't trigger webhook retry for unknown orgs)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Resend webhooks.verify API signature**
- **Found during:** Task 1
- **Issue:** Plan specified `resend.webhooks.verify(payload, headers)` two-arg form, but SDK requires single object `{ payload, headers: { id, timestamp, signature }, webhookSecret }`
- **Fix:** Used correct single-object API with typed headers
- **Files modified:** apps/web/src/app/api/webhooks/resend-inbound/route.ts
- **Verification:** TypeScript compiles cleanly
- **Committed in:** eb911b4

**2. [Rule 3 - Blocking] Added @contractor-ops/db dependency to web package**
- **Found during:** Task 1
- **Issue:** Web package didn't have @contractor-ops/db as dependency, preventing Prisma import
- **Fix:** Added workspace dependency via pnpm
- **Files modified:** apps/web/package.json, pnpm-lock.yaml
- **Verification:** TypeScript compiles, import resolves
- **Committed in:** eb911b4

**3. [Rule 1 - Bug] Simplified virus scan to PENDING status**
- **Found during:** Task 1
- **Issue:** Plan specified fire-and-forget virus scan, but file-type and clamscan packages not available in web package (installed only in api package's node_modules)
- **Fix:** Documents created with virusScanStatus PENDING; existing scan infrastructure handles them asynchronously
- **Files modified:** apps/web/src/app/api/webhooks/resend-inbound/route.ts
- **Verification:** TypeScript compiles cleanly, no missing import errors
- **Committed in:** eb911b4

---

**Total deviations:** 3 auto-fixed (2 bug fixes, 1 blocking)
**Impact on plan:** All fixes necessary for correctness. Virus scanning delegated to existing infrastructure rather than duplicated. No scope creep.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required

External services require manual configuration:
- **RESEND_API_KEY**: Resend Dashboard -> API Keys -> Create API Key
- **RESEND_WEBHOOK_SECRET**: Resend Dashboard -> Webhooks -> Signing Secret
- Configure MX records for contractorhub.io domain pointing to Resend
- Create webhook endpoint URL pointing to /api/webhooks/resend-inbound

## Next Phase Readiness
- Email intake pipeline ready for end-to-end testing with Resend
- Invoice drafts created in RECEIVED/UNMATCHED status ready for matching (05-03+)
- Documents in PENDING virus scan status will be processed by existing scan infrastructure

---
*Phase: 05-invoice-intake-matching*
*Completed: 2026-03-21*
