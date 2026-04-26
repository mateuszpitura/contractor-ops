---
phase: 14-portal-self-service-branding
plan: 04
subsystem: api
tags: [subdomain-routing, middleware, next-intl, prisma, trpc, portal, branding]

requires:
  - phase: 14-portal-self-service-branding
    provides: "Plan 01 API: settings router, Plan 03: AdminBrandingSection, portal layout with brand injection"
  - phase: 13-contractor-portal-auth-core-views
    provides: "Portal auth middleware (portalProcedure), portal layout, PortalTopBar"
provides:
  - "portalSubdomain and portalCustomDomain fields on Organization model with unique constraints"
  - "getPortalDomain/updatePortalDomain settings router endpoints with format validation and uniqueness check"
  - "Combined Next.js middleware for subdomain routing + next-intl i18n"
  - "Portal layout subdomain-based org resolution for branded unauthenticated shell"
  - "Portal auth middleware portalSubdomain context metadata"
  - "Admin UI for portal subdomain configuration in branding section"
affects: []

tech-stack:
  added: []
  patterns:
    - "Combined Next.js middleware: subdomain routing + next-intl (not one or the other)"
    - "x-portal-org-subdomain header flow: middleware sets, layout reads, auth passes as context"
    - "PORTAL_BASE_DOMAIN env var for configurable subdomain base domain"

key-files:
  created: []
  modified:
    - packages/db/prisma/schema/organization.prisma
    - apps/web/src/middleware.ts
    - packages/api/src/routers/settings.ts
    - apps/web/src/app/[locale]/(portal)/layout.tsx
    - packages/api/src/middleware/portal-auth.ts
    - apps/web/src/components/settings/admin-branding-section.tsx
    - .env.example

key-decisions:
  - "Session.organizationId remains authoritative for tenantStore scoping -- subdomain is supplementary context metadata only"
  - "PORTAL_BASE_DOMAIN env var with portal.localhost:3000 default for local dev"
  - "Auto-lowercase and strip invalid chars on subdomain input for better admin UX"

patterns-established:
  - "Subdomain header flow: Next.js middleware sets x-portal-org-subdomain, portal layout reads for unauthenticated branding, portal-auth passes as ctx.portalSubdomain"
  - "Separate save buttons for logically distinct settings sections (branding vs domain)"

requirements-completed: [PORT-08]

duration: 4min
completed: 2026-03-23
---

# Phase 14 Plan 04: Custom Subdomain Routing Summary

**End-to-end portal subdomain routing via Next.js middleware with x-portal-org-subdomain header flow, admin subdomain config UI, and branded unauthenticated portal shell**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-23T20:38:07Z
- **Completed:** 2026-03-23T20:42:09Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Organization model extended with portalSubdomain (unique) and portalCustomDomain (unique) fields for custom portal routing
- Next.js middleware upgraded from static next-intl to combined subdomain routing + i18n: detects {slug}.portal.{domain} pattern, sets x-portal-org-subdomain header, rewrites root to /en/portal
- Settings router gains getPortalDomain query and updatePortalDomain mutation with 3-63 char format validation, regex enforcement, and cross-org uniqueness check
- Portal layout reads x-portal-org-subdomain header to resolve org branding (logo + color) on unauthenticated subdomain access (e.g., login page at acme.portal.app.com shows Acme branding)
- Portal auth middleware passes portalSubdomain as supplementary context metadata without overriding session-based org scoping
- Admin branding section extended with Portal Subdomain configuration: input with auto-lowercase, inline domain suffix, separate Save Domain button, uniqueness error handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Add portalSubdomain fields, middleware, API endpoint, and wire subdomain header** - `e110c7d` (feat)
2. **Task 2: Add portal subdomain config UI to admin branding section** - `fce2d25` (feat)

## Files Created/Modified
- `packages/db/prisma/schema/organization.prisma` - Added portalSubdomain and portalCustomDomain fields with @unique constraints
- `apps/web/src/middleware.ts` - Combined subdomain routing + next-intl middleware with PORTAL_BASE_DOMAIN env var
- `packages/api/src/routers/settings.ts` - Added getPortalDomain query, updatePortalDomain mutation with TRPCError import
- `apps/web/src/app/[locale]/(portal)/layout.tsx` - Reads x-portal-org-subdomain header for org-branded shell on unauthenticated access
- `packages/api/src/middleware/portal-auth.ts` - Reads x-portal-org-subdomain as ctx.portalSubdomain supplementary metadata
- `apps/web/src/components/settings/admin-branding-section.tsx` - Portal Subdomain config section with input, validation, separate save button
- `.env.example` - Added PORTAL_BASE_DOMAIN documentation

## Decisions Made
- Session.organizationId remains the authoritative source for tenantStore scoping -- the subdomain header is passed as supplementary context metadata (for logging/audit), never as an org override. This prevents subdomain spoofing from affecting data access.
- PORTAL_BASE_DOMAIN defaults to portal.localhost:3000 for local development. Production deployments set this to portal.contractorops.com or similar.
- Auto-lowercase and strip invalid characters on subdomain input for better admin UX (rather than showing validation error on every keystroke).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added TRPCError import to settings router**
- **Found during:** Task 1 (updatePortalDomain endpoint)
- **Issue:** The updatePortalDomain endpoint throws TRPCError on CONFLICT but the import was missing from the settings router
- **Fix:** Added `import { TRPCError } from "@trpc/server"` to settings.ts
- **Files modified:** packages/api/src/routers/settings.ts
- **Verification:** TypeScript compilation passes
- **Committed in:** e110c7d (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Necessary import for the planned endpoint to compile. No scope creep.

## Issues Encountered
- `prisma db push` fails without DATABASE_URL env var -- expected in CI/local dev without DB connection. Schema changes are correct and will apply on deployment.

## Known Stubs
None - all endpoints are wired to real Prisma queries, subdomain routing flows end-to-end from middleware through layout to auth context.

## User Setup Required
- Add `PORTAL_BASE_DOMAIN` environment variable for production deployment (documented in .env.example)
- Run `prisma db push` or `prisma migrate` to apply portalSubdomain/portalCustomDomain columns

## Next Phase Readiness
- Custom subdomain routing complete (PORT-08 satisfied)
- Full flow: admin configures subdomain -> middleware detects -> layout renders branded shell -> auth passes context
- portalCustomDomain field added for future CNAME + Vercel API SSL provisioning (not implemented in this plan)

---
*Phase: 14-portal-self-service-branding*
*Completed: 2026-03-23*

## Self-Check: PASSED
