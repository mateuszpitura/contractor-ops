---
phase: 13-contractor-portal-auth-core-views
plan: 03
subsystem: ui
tags: [react, next.js, portal, magic-link, login, layout, sheet, dropdown, cookie]

# Dependency graph
requires:
  - phase: 13-contractor-portal-auth-core-views
    plan: 01
    provides: "PortalSession service, validatePortalSession, deletePortalSession"
provides:
  - "Portal route group layout with PortalTopBar"
  - "Portal login page with magic link flow"
  - "Magic link verification page with org picker"
  - "OrgPicker component for multi-org contractors"
  - "httpOnly session cookie API routes (set-session, clear-session)"
  - "PortalTopBar with 5 nav links, org branding, profile dropdown"
  - "PortalMobileMenu with Sheet navigation"
affects: [13-04, 13-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Portal layout with server-side session validation and conditional top bar"
    - "httpOnly cookie set via API route (not client-side JS) for security"
    - "Separate clear-session route that also deletes DB session"
    - "OrgPicker card-based selection with loading state per card"

key-files:
  created:
    - apps/web/src/app/[locale]/(portal)/layout.tsx
    - apps/web/src/app/[locale]/(portal)/login/page.tsx
    - apps/web/src/app/[locale]/(portal)/login/verify/page.tsx
    - apps/web/src/components/portal/portal-top-bar.tsx
    - apps/web/src/components/portal/portal-mobile-menu.tsx
    - apps/web/src/components/portal/org-picker.tsx
    - apps/web/src/app/api/portal/set-session/route.ts
    - apps/web/src/app/api/portal/clear-session/route.ts
  modified:
    - packages/api/package.json

key-decisions:
  - "httpOnly cookie via API route rather than client-side document.cookie for security"
  - "clear-session route also deletes DB session (not just cookie) for clean logout"
  - "Portal layout validates session server-side and conditionally renders top bar"
  - "Added portal-session export path to @contractor-ops/api package.json"

patterns-established:
  - "Portal API routes at /api/portal/* for session management"
  - "Portal components in src/components/portal/ directory"
  - "Portal route group at (portal) alongside (auth) and (dashboard)"

requirements-completed: [PORT-01]

# Metrics
duration: 6min
completed: 2026-03-23
---

# Phase 13 Plan 03: Portal Shell, Login & Navigation Summary

**Portal layout with top bar navigation (5 links + org branding + profile dropdown), magic link login page, token verification with org picker for multi-org contractors, and httpOnly session cookie management via API routes**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-23T14:52:45Z
- **Completed:** 2026-03-23T14:58:20Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Portal route group layout with server-side session validation, conditional PortalTopBar rendering
- PortalTopBar with 5 nav links (Overview, Contracts, Invoices, Documents, Payments), org branding, profile dropdown, mobile hamburger
- PortalMobileMenu using Sheet component (slide from right) for mobile navigation
- Login page with centered card, email form (React Hook Form + Zod), magic link sent confirmation state
- Verify page handling token validation, single-org auto-login, and multi-org OrgPicker flow
- OrgPicker component with card-per-org selection, loading spinner, keyboard accessibility
- httpOnly session cookie management via /api/portal/set-session and /api/portal/clear-session API routes

## Task Commits

Each task was committed atomically:

1. **Task 1: Create portal layout, top bar, and mobile menu components** - `abecddf` (feat)
2. **Task 2: Create portal login page, magic link verification page, and org picker** - `3906626` (feat)

## Files Created/Modified
- `apps/web/src/app/[locale]/(portal)/layout.tsx` - Portal layout with session validation, conditional top bar
- `apps/web/src/app/[locale]/(portal)/login/page.tsx` - Login page with email form and magic link sent state
- `apps/web/src/app/[locale]/(portal)/login/verify/page.tsx` - Token verification, org picker, session cookie setting
- `apps/web/src/components/portal/portal-top-bar.tsx` - Top bar with nav links, org branding, profile dropdown, mobile hamburger
- `apps/web/src/components/portal/portal-mobile-menu.tsx` - Mobile Sheet navigation with nav links and sign out
- `apps/web/src/components/portal/org-picker.tsx` - Multi-org selection with card-per-org layout
- `apps/web/src/app/api/portal/set-session/route.ts` - Sets httpOnly portal_session cookie
- `apps/web/src/app/api/portal/clear-session/route.ts` - Deletes session from DB and clears cookie
- `packages/api/package.json` - Added portal-session export path

## Decisions Made
- Used httpOnly cookie via API route (/api/portal/set-session) rather than client-side document.cookie -- prevents XSS access to session tokens, more secure
- clear-session route deletes the DB session record in addition to clearing the cookie -- ensures clean logout without orphaned sessions
- Portal layout validates session server-side via validatePortalSession and conditionally renders the top bar -- login pages get a clean centered layout without navigation chrome
- Added portal-session service as an export path in @contractor-ops/api package.json to enable server component imports

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added portal-session export to @contractor-ops/api package.json**
- **Found during:** Task 1 (Portal layout creation)
- **Issue:** The portal layout (server component) needed to import validatePortalSession from @contractor-ops/api/services/portal-session, but no export path existed
- **Fix:** Added `./services/portal-session` export entry to packages/api/package.json
- **Files modified:** packages/api/package.json
- **Committed in:** abecddf (Task 1 commit)

**2. [Rule 2 - Missing Critical] clear-session route also deletes DB session**
- **Found during:** Task 2 (Session API routes)
- **Issue:** Plan only specified cookie deletion for logout, but orphaned DB sessions would accumulate and remain valid if cookie is re-set
- **Fix:** Added deletePortalSession call in clear-session route before clearing cookie
- **Files modified:** apps/web/src/app/api/portal/clear-session/route.ts
- **Committed in:** 3906626 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 missing critical)
**Impact on plan:** Both auto-fixes necessary for correctness and security. No scope creep.

## Issues Encountered
- TypeScript errors on trpc.portal.* calls in login and verify pages -- expected because plan 02 (portal tRPC router) runs in parallel and hasn't registered the portal router in root.ts yet. These errors will resolve when plan 02 completes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Portal shell complete: layout, login flow, session management all in place
- Plans 04 and 05 can build portal content pages within this layout
- tRPC calls in login/verify pages depend on plan 02 completing (portal router registration)

---
*Phase: 13-contractor-portal-auth-core-views*
*Completed: 2026-03-23*
