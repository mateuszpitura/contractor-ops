---
phase: 13-contractor-portal-auth-core-views
verified: 2026-03-23T16:30:00Z
status: passed
score: 18/18 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Navigate to /portal/login, enter email, submit"
    expected: "'Check your inbox' confirmation shown regardless of whether email matches a contractor"
    why_human: "Anti-enumeration behavior is logic-verified in code but real network call cannot be tested programmatically here"
  - test: "Click magic link in email, single-org contractor flow"
    expected: "Portal session cookie set, redirect to /portal with top bar visible"
    why_human: "Requires live email delivery and browser session handling"
  - test: "Click magic link in email, multi-org contractor flow"
    expected: "Org picker cards shown; selecting one sets cookie and redirects to /portal"
    why_human: "Requires multi-org test data and browser interaction"
  - test: "Mobile viewport (<768px): navigate portal pages"
    expected: "Top bar shows hamburger icon; clicking opens Sheet with nav links"
    why_human: "Responsive layout behavior requires visual browser check"
  - test: "Submit invoice via portal form"
    expected: "Invoice created with RECEIVED status + PORTAL source; appears in org admin intake pipeline"
    why_human: "End-to-end pipeline integration requires live DB and admin UI verification"
  - test: "Sign out via profile dropdown"
    expected: "Cookie cleared, DB session deleted, redirected to /portal/login"
    why_human: "Requires browser interaction and DB state inspection"
---

# Phase 13: Contractor Portal Auth & Core Views Verification Report

**Phase Goal:** Contractors can securely access their own data through a dedicated portal without touching internal admin surfaces
**Verified:** 2026-03-23T16:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | PortalSession and PortalMagicToken models exist in DB with correct fields and indexes | VERIFIED | `portal.prisma` contains both models with all required fields, `@@index([token])` on both, `@@index([contractorId, organizationId])` on PortalSession |
| 2  | InvoiceSource enum includes PORTAL value | VERIFIED | `invoice.prisma` line 138: `PORTAL` present in enum |
| 3  | PortalSession and PortalMagicToken excluded from tenant scoping (globalModels) | VERIFIED | `tenant.ts` lines 30–31: `"PortalSession"` and `"PortalMagicToken"` in globalModels Set |
| 4  | Session tokens are hashed with SHA-256 before storage | VERIFIED | `portal-session.ts`: `createHash("sha256").update(token).digest("hex")` in `hashToken`; hash used in all DB writes |
| 5  | Magic link tokens expire after 15 minutes and can only be used once | VERIFIED | `portal-magic-link.ts`: `MAGIC_LINK_EXPIRY_MS = 15 * 60 * 1000`; `verifyMagicLinkToken` checks `record.usedAt` and sets it on first use |
| 6  | Portal sessions expire after 7 days | VERIFIED | `portal-session.ts`: `SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000`; expiry checked in `validatePortalSession` |
| 7  | portalProcedure authenticates via portal_session cookie and rejects expired/invalid sessions | VERIFIED | `portal-auth.ts`: parses `portal_session=` cookie, calls `validatePortalSession`, throws `UNAUTHORIZED` on null; wraps `next()` in `tenantStore.run()` |
| 8  | Portal router provides magic link request and verification endpoints | VERIFIED | `portal.ts`: `requestMagicLink` always returns `{ success: true }` (anti-enumeration); `verifyMagicLink` validates token and branches on org count |
| 9  | Portal router provides org picker data for multi-org contractors | VERIFIED | `portal.ts` lines 155–166: returns `orgs[]` array with `needsOrgPicker: true` when 2+ contractors found |
| 10 | Portal router provides contractor-scoped contract list and detail (read-only) | VERIFIED | `listContracts` and `getContract` both filter by `contractorId: ctx.contractorId`; internal fields excluded per D-11 |
| 11 | Portal router provides invoice list with statuses, invoice detail with timeline data, and invoice submission | VERIFIED | `listInvoices`, `getInvoice` (with activityLog built from timestamps), `submitInvoice` all present and wired |
| 12 | Portal router provides document list with download URLs and payment history | VERIFIED | `listDocuments` generates presigned download URLs per document; `listPayments` returns only invoice number, amount, date (no batch IDs) |
| 13 | All portal queries double-scope: org via tenantStore + contractorId | VERIFIED | All read endpoints use `contractorId: ctx.contractorId`; `portalAuthMiddleware` sets `tenantStore.run({ organizationId })` |
| 14 | Invoice submission creates RECEIVED status with PORTAL source and triggers auto-match | VERIFIED | `portal.ts` line 841: `source: "PORTAL"`, line 848: `status: "RECEIVED"`, `matchStatus: "UNMATCHED"` |
| 15 | Portal login page shows email form with Send Magic Link and Check your inbox confirmation | VERIFIED | `login/page.tsx`: "Contractor Portal" heading, "Send Magic Link" button, "Check your inbox" state after mutation; admin login link present |
| 16 | Magic link verification sets httpOnly cookie via API route and handles single/multi-org flow | VERIFIED | `verify/page.tsx` calls `POST /api/portal/set-session`; `set-session/route.ts` sets `httpOnly: true, secure: prod, sameSite: lax, path: /` |
| 17 | Portal layout has top bar with 5 nav links, org branding, profile dropdown; no sidebar | VERIFIED | `portal-top-bar.tsx`: NAV_ITEMS 5 items, `h-14` height, `hidden md:flex` desktop nav, `md:hidden` hamburger, DropdownMenu logout; `layout.tsx` has no SidebarProvider |
| 18 | Invoice submission form, status timeline, and activity log fully wired | VERIFIED | `invoice-submit-form.tsx` calls `portal.getUploadUrl` then `portal.submitInvoice`; `invoices/[id]/page.tsx` renders `StatusTimeline` and `ActivityLog` from `portal.getInvoice` response |

**Score:** 18/18 truths verified

---

### Required Artifacts

| Artifact | Plan | Status | Evidence |
|----------|------|--------|---------|
| `packages/db/prisma/schema/portal.prisma` | 13-01 | VERIFIED | Exists, contains both models with correct fields and indexes |
| `packages/api/src/services/portal-session.ts` | 13-01 | VERIFIED | Exports all 5 required functions; SHA-256 hashing present; 7-day expiry |
| `packages/api/src/services/portal-magic-link.ts` | 13-01 | VERIFIED | Exports all 4 required functions; 15-min expiry; single-use enforcement |
| `packages/api/src/middleware/portal-auth.ts` | 13-02 | VERIFIED | Exports `portalProcedure` and `portalPublicProcedure`; cookie parsing wired to validatePortalSession |
| `packages/api/src/routers/portal.ts` | 13-02 | VERIFIED | Exports `portalRouter` with 15 endpoints; merged into appRouter at root.ts:63 |
| `apps/web/src/app/[locale]/(portal)/layout.tsx` | 13-03 | VERIFIED | Server component, validates session, renders PortalTopBar conditionally |
| `apps/web/src/app/[locale]/(portal)/login/page.tsx` | 13-03 | VERIFIED | "Send Magic Link" button, "Check your inbox" state, requestMagicLink mutation |
| `apps/web/src/app/[locale]/(portal)/login/verify/page.tsx` | 13-03 | VERIFIED | verifyMagicLink mutation, OrgPicker when needsOrgPicker, httpOnly cookie via API route |
| `apps/web/src/components/portal/portal-top-bar.tsx` | 13-03 | VERIFIED | 5 NAV_ITEMS, h-14, hidden md:flex desktop nav, md:hidden hamburger, DropdownMenu |
| `apps/web/src/components/portal/portal-mobile-menu.tsx` | 13-03 | VERIFIED | Sheet component navigation for mobile |
| `apps/web/src/components/portal/org-picker.tsx` | 13-03 | VERIFIED | Card-per-org layout, "Select Organization" heading |
| `apps/web/src/app/api/portal/set-session/route.ts` | 13-03 | VERIFIED | httpOnly, secure in production, sameSite lax, 7-day expiry from token |
| `apps/web/src/app/api/portal/clear-session/route.ts` | 13-03 | VERIFIED | Deletes DB session + clears cookie |
| `apps/web/src/app/[locale]/(portal)/page.tsx` | 13-04 | VERIFIED | "Welcome back" greeting, 4 SummaryCards, quick actions, activity list |
| `apps/web/src/app/[locale]/(portal)/contracts/page.tsx` | 13-04 | VERIFIED | listContracts query, grid-cols-1 md:grid-cols-2, ContractCard, empty state |
| `apps/web/src/app/[locale]/(portal)/contracts/[id]/page.tsx` | 13-04 | VERIFIED | getContract query, document download section, ArrowLeft back nav |
| `apps/web/src/app/[locale]/(portal)/documents/page.tsx` | 13-04 | VERIFIED | listDocuments query, Table components, download buttons, empty state |
| `apps/web/src/app/[locale]/(portal)/payments/page.tsx` | 13-04 | VERIFIED | listPayments query, Table, no batch IDs or internal fields |
| `apps/web/src/components/portal/summary-card.tsx` | 13-04 | VERIFIED | SummaryCard and SummaryCardSkeleton exports |
| `apps/web/src/components/portal/contract-card.tsx` | 13-04 | VERIFIED | Link to /portal/contracts/{id}, status Badge |
| `apps/web/src/components/portal/status-timeline.tsx` | 13-05 | VERIFIED | STEPS array (5 steps), getActiveStep function, hidden md:flex horizontal, md:hidden vertical |
| `apps/web/src/components/portal/activity-log.tsx` | 13-05 | VERIFIED | ScrollArea wrapping, icon+description+timestamp per entry |
| `apps/web/src/components/portal/invoice-submit-form.tsx` | 13-05 | VERIFIED | Zod schema, React Hook Form, contract auto-select, getUploadUrl + submitInvoice mutations, Progress bar |
| `apps/web/src/app/[locale]/(portal)/invoices/page.tsx` | 13-05 | VERIFIED | listInvoices query, responsive Table/Card layout, status badge mapping |
| `apps/web/src/app/[locale]/(portal)/invoices/[id]/page.tsx` | 13-05 | VERIFIED | getInvoice query, StatusTimeline, ActivityLog, no internal fields |
| `apps/web/src/app/[locale]/(portal)/invoices/submit/page.tsx` | 13-05 | VERIFIED | "Submit Invoice" heading, InvoiceSubmitForm wrapper |
| `apps/web/src/app/[locale]/(portal)/invoices/submit/success/page.tsx` | 13-05 | VERIFIED | "Invoice Submitted" heading, CheckCircle2 icon, Track Status link, invoiceNumber from searchParams |

---

### Key Link Verification

| From | To | Via | Status | Evidence |
|------|-----|-----|--------|---------|
| `portal-auth.ts` | `portal-session.ts` | `validatePortalSession` call | WIRED | Line 4: `import { validatePortalSession }`, line 53: called with rawToken |
| `routers/portal.ts` | `middleware/portal-auth.ts` | `portalProcedure` usage | WIRED | Line 7–9: imports both procedures; all auth endpoints use portalProcedure |
| `routers/portal.ts` | prisma.invoice.create | `source: "PORTAL"` | WIRED | Line 841: `source: "PORTAL"`, line 848: `status: "RECEIVED"` |
| `root.ts` | `routers/portal.ts` | `portal: portalRouter` | WIRED | Line 63: `portal: portalRouter` in appRouter |
| `login/page.tsx` | `portal.requestMagicLink` | tRPC mutation | WIRED | `trpc.portal.requestMagicLink.mutationOptions()` called on form submit |
| `verify/page.tsx` | `portal.verifyMagicLink` | tRPC mutation + cookie | WIRED | `trpc.portal.verifyMagicLink.mutationOptions()` on mount; calls `/api/portal/set-session` with token |
| `invoice-submit-form.tsx` | `portal.getUploadUrl` | presigned URL upload | WIRED | Line 120–122: `getUploadUrl.mutateAsync()` called before file PUT |
| `invoice-submit-form.tsx` | `portal.submitInvoice` | tRPC mutation | WIRED | Line 124–125: `submitInvoice.mutateAsync()` called on form submit |
| `invoices/[id]/page.tsx` | `portal.getInvoice` | tRPC query | WIRED | Line 111: `trpc.portal.getInvoice.queryOptions({ id: params.id })` |
| `tenant.ts` | PortalSession, PortalMagicToken | globalModels Set | WIRED | Lines 30–31: both model names in globalModels Set |

---

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|---------|
| PORT-01 | 13-01, 13-02, 13-03 | Contractor can log in via magic link with org-scoped access | SATISFIED | Magic link flow: createMagicLinkToken -> verifyMagicLinkToken -> createPortalSession -> httpOnly cookie; portalProcedure validates cookie + sets tenant context |
| PORT-02 | 13-02, 13-04 | Contractor can view own active contracts and terms (read-only) | SATISFIED | listContracts and getContract filter by contractorId; internal fields (teamId, costCenterId, notes) excluded |
| PORT-03 | 13-02, 13-05 | Contractor can submit invoices via portal that enter org's intake pipeline | SATISFIED | submitInvoice creates invoice with source=PORTAL, status=RECEIVED, matchStatus=UNMATCHED; InvoiceSubmitForm fully wired |
| PORT-04 | 13-02, 13-04, 13-05 | Contractor can track invoice and payment status through approval and payment | SATISFIED | listInvoices (status badges), getInvoice (3-layer: badge + StatusTimeline + ActivityLog), listPayments (no internal IDs) |
| PORT-05 | 13-02, 13-04 | Contractor can view and download own documents (contracts, NDAs, tax forms) | SATISFIED | listDocuments returns presigned download URLs; documents page Table with download button per row |

No orphaned requirements — PORT-06 through PORT-08 are mapped to Phase 14 and not claimed by any Phase 13 plan.

---

### Anti-Patterns Found

None detected. Scan of all modified/created files found:
- No `TODO`, `FIXME`, `XXX`, or `HACK` comments in implementation files
- No stub implementations (empty returns, placeholder text in rendered output)
- Input `placeholder` attributes in invoice-submit-form.tsx are UI input hints (not stubs)
- No internal data fields (batch IDs, reviewer names, costCenterId) in any portal-facing view
- No hardcoded empty arrays or objects as final return values in API endpoints

---

### Human Verification Required

The following items require browser/integration testing to fully confirm:

#### 1. Magic Link Send (Anti-Enumeration)

**Test:** Navigate to `/portal/login`, enter an email that has no contractor records, submit form.
**Expected:** "Check your inbox" confirmation displayed — identical to the case where email is found.
**Why human:** Logic is code-verified (requestMagicLink always returns `{ success: true }`), but real network behavior with Resend and UI rendering must be confirmed.

#### 2. Full Login Flow (Single Org)

**Test:** Request magic link for an email with exactly one contractor record, click link in email.
**Expected:** Page briefly shows "Verifying your sign-in link...", then redirects to `/portal` with the top bar showing the org name and contractor initials.
**Why human:** Requires live email delivery, valid token in URL, browser session/cookie handling.

#### 3. Full Login Flow (Multi-Org)

**Test:** Request magic link for an email that exists in 2+ organizations.
**Expected:** After clicking the link, org picker shows one card per organization; selecting an org redirects to `/portal`.
**Why human:** Requires multi-org test data and browser interaction to trigger the org picker path.

#### 4. Mobile Navigation

**Test:** Open the portal in a viewport narrower than 768px, navigate to any authenticated portal page.
**Expected:** Top bar shows only org logo/name, hamburger icon on the right; tapping hamburger opens Sheet nav from the right with all 5 nav items and sign out.
**Why human:** Responsive layout behavior requires visual browser inspection.

#### 5. Invoice Submission End-to-End

**Test:** As an authenticated contractor with an ACTIVE contract, navigate to Submit Invoice, upload a PDF, fill in all fields, submit.
**Expected:** Success page shows "Invoice Submitted" with the invoice number; navigating to the invoice detail shows status "Submitted" and the StatusTimeline at step 1; in the admin view the invoice appears in the intake pipeline with source PORTAL.
**Why human:** Requires live S3/R2 presigned upload, database write, and cross-checking admin pipeline view.

#### 6. Logout / Session Cleanup

**Test:** Sign out via the profile dropdown.
**Expected:** Cookie is deleted from browser, session record removed from database, redirected to `/portal/login`.
**Why human:** Requires checking both browser cookies and DB state post-logout.

---

### Phase Goal Assessment

**Goal:** "Contractors can securely access their own data through a dedicated portal without touching internal admin surfaces"

All three dimensions are satisfied:

1. **Secure access:** Separate `PortalSession` model (not internal User/Session); magic links with 15-min expiry and single-use enforcement; SHA-256 hashed tokens at rest; httpOnly cookie for session transport; email enumeration prevented.

2. **Own data only:** Every read query filters by `contractorId: ctx.contractorId`; tenant context set via `tenantStore.run()` scoping to the contractor's organization; internal fields (reviewer names, batch IDs, costCenterId, approval chain details) excluded from all portal responses.

3. **No admin surface exposure:** Portal routes at `(portal)` route group, entirely separate from `(dashboard)` admin routes; no `authedProcedure` (admin) used — only `portalProcedure`; no SidebarProvider or admin navigation in portal layout.

---

_Verified: 2026-03-23T16:30:00Z_
_Verifier: Claude (gsd-verifier)_
