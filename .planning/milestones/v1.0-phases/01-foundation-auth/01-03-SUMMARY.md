---
phase: 01-foundation-auth
plan: 03
subsystem: ui
tags: [shadcn-ui, next-themes, react-hook-form, sonner, zustand, lucide-react, tailwindcss, dark-mode, rbac-ui]

# Dependency graph
requires:
  - phase: 01-foundation-auth/01-02
    provides: "Better Auth client, tRPC routers (user, settings, organization), RBAC roles and permissions"
provides:
  - "Auth screens (register, login, invite accept, email verification)"
  - "App shell with collapsible sidebar, org switcher, top bar with breadcrumb/search/actions"
  - "Organization settings form with all fields"
  - "User management table with invite, role change, deactivate"
  - "Dark mode with ThemeProvider and system preference detection"
  - "Error pages (404, 500, unauthorized)"
  - "usePermissions hook for RBAC-based UI filtering"
  - "Navigation config with 10 items filtered by role"
affects: [01-foundation-auth/01-04, 02-contractor-registry]

# Tech tracking
tech-stack:
  added: [shadcn-ui, next-themes, zustand, react-hook-form, "@hookform/resolvers", sonner, lucide-react]
  patterns: [shadcn-sidebar-collapsible, trpc-react-query-mutations, role-based-nav-filtering, density-toggle]

key-files:
  created:
    - apps/web/src/app/globals.css
    - apps/web/src/app/[locale]/layout.tsx
    - apps/web/src/app/[locale]/(auth)/layout.tsx
    - apps/web/src/app/[locale]/(auth)/login/page.tsx
    - apps/web/src/app/[locale]/(auth)/register/page.tsx
    - apps/web/src/app/[locale]/(auth)/invite/[token]/page.tsx
    - apps/web/src/app/[locale]/(auth)/verify-email/page.tsx
    - apps/web/src/components/auth/login-form.tsx
    - apps/web/src/components/auth/register-form.tsx
    - apps/web/src/components/auth/invite-accept-form.tsx
    - apps/web/src/components/auth/social-buttons.tsx
    - apps/web/src/app/[locale]/(dashboard)/layout.tsx
    - apps/web/src/app/[locale]/(dashboard)/page.tsx
    - apps/web/src/components/layout/sidebar.tsx
    - apps/web/src/components/layout/nav-items.tsx
    - apps/web/src/components/layout/org-switcher.tsx
    - apps/web/src/components/layout/top-bar.tsx
    - apps/web/src/components/layout/user-menu.tsx
    - apps/web/src/hooks/use-permissions.ts
    - apps/web/src/lib/navigation.ts
    - apps/web/src/app/[locale]/not-found.tsx
    - apps/web/src/app/[locale]/error.tsx
    - apps/web/src/app/[locale]/(dashboard)/unauthorized/page.tsx
    - apps/web/src/app/[locale]/(dashboard)/settings/page.tsx
    - apps/web/src/app/[locale]/(dashboard)/settings/members/page.tsx
    - apps/web/src/components/settings/org-settings-form.tsx
    - apps/web/src/components/settings/users-table.tsx
    - apps/web/src/components/settings/invite-dialog.tsx
    - apps/web/src/components/settings/deactivate-dialog.tsx
  modified:
    - apps/web/src/app/layout.tsx

key-decisions:
  - "Removed asChild prop from DropdownMenuTrigger — shadcn v2 Radix primitives do not support asChild"
  - "Role badge colors use Tailwind utility classes with dark mode variants instead of CSS custom properties"
  - "Users table uses simple shadcn Table (not TanStack DataTable) — sufficient for v1 team sizes"

patterns-established:
  - "tRPC mutation pattern: useMutation(trpc.x.y.mutationOptions({onSuccess, onError})) with toast feedback"
  - "Form pattern: react-hook-form + zodResolver + controlled Select components via watch/setValue"
  - "RBAC UI pattern: usePermissions().can(resource, [actions]) to conditionally render elements"
  - "Role badge pattern: color map per role using Tailwind bg/text classes with dark variants"

requirements-completed: [ORG-02, ORG-03, ORG-05]

# Metrics
duration: 4min
completed: 2026-03-18
---

# Phase 1 Plan 3: Auth Screens, App Shell, and User Management Summary

**Auth screens (register/login/invite), collapsible sidebar with org switcher and RBAC-filtered nav, org settings form, user management table with invite/role-change/deactivate, dark mode, and Indigo theme**

## Performance

- **Duration:** 4 min (continuation — Task 1 completed in prior session)
- **Started:** 2026-03-18T13:24:24Z
- **Completed:** 2026-03-18T13:27:55Z
- **Tasks:** 2 of 3 (Task 3 is human-verify checkpoint)
- **Files created:** 29

## Accomplishments
- Complete auth flow UI: register with org creation, login with email/password and magic link, invite acceptance, email verification
- App shell with collapsible sidebar (240px expanded, 48px collapsed), org switcher, top bar with breadcrumb/search/quick actions/notifications/avatar
- Organization settings form with 8 fields (name, legal name, country, currency, timezone, language, fiscal year, billing email) wired to tRPC
- User management table with role badge colors (8 roles), role change dropdown, status badges, deactivate/reactivate actions
- Dark mode via next-themes with system preference detection and manual toggle
- RBAC-filtered navigation: unauthorized items hidden based on role permissions
- Error pages: 404, 500, unauthorized — all styled

## Task Commits

Each task was committed atomically:

1. **Task 1: Initialize shadcn/ui, auth screens, app shell with sidebar and top bar, Indigo theme** - `b8ecf2f` (feat)
2. **Task 2: Build org settings page and user management table with invite, role change, deactivate** - `f2404fd` (feat)

Task 3 is a human-verify checkpoint (pending).

## Files Created/Modified
- `apps/web/src/app/globals.css` - CSS custom properties for light/dark mode with Indigo accent and density toggle
- `apps/web/src/app/[locale]/layout.tsx` - Root locale layout with ThemeProvider, TRPCProvider, Toaster
- `apps/web/src/app/[locale]/(auth)/layout.tsx` - Centered card layout for auth screens
- `apps/web/src/components/auth/register-form.tsx` - Registration form with org name, email, password, social OAuth
- `apps/web/src/components/auth/login-form.tsx` - Login with email/password, magic link, social OAuth
- `apps/web/src/components/auth/invite-accept-form.tsx` - Invite acceptance form with pre-filled email
- `apps/web/src/components/auth/social-buttons.tsx` - Google and Microsoft OAuth buttons
- `apps/web/src/components/layout/sidebar.tsx` - Collapsible sidebar using shadcn Sidebar component
- `apps/web/src/components/layout/nav-items.tsx` - 10 navigation items filtered by RBAC
- `apps/web/src/components/layout/org-switcher.tsx` - Organization switcher dropdown
- `apps/web/src/components/layout/top-bar.tsx` - Breadcrumb, search, quick actions, notifications, avatar
- `apps/web/src/components/layout/user-menu.tsx` - Avatar dropdown with dark mode and density toggles
- `apps/web/src/hooks/use-permissions.ts` - RBAC permission checker hook
- `apps/web/src/lib/navigation.ts` - Navigation config with permission requirements
- `apps/web/src/components/settings/org-settings-form.tsx` - Organization settings form with 8 fields
- `apps/web/src/components/settings/users-table.tsx` - User management table with role change and deactivate
- `apps/web/src/components/settings/invite-dialog.tsx` - Invite member dialog with email and role
- `apps/web/src/components/settings/deactivate-dialog.tsx` - Deactivate confirmation AlertDialog
- `apps/web/src/app/[locale]/not-found.tsx` - Styled 404 page
- `apps/web/src/app/[locale]/error.tsx` - Styled 500 error page
- `apps/web/src/app/[locale]/(dashboard)/unauthorized/page.tsx` - Styled 403 page

## Decisions Made
- Removed `asChild` prop from DropdownMenuTrigger -- shadcn v2 Radix primitives do not support it; used direct trigger content instead
- Role badge colors implemented via Tailwind utility classes with dark mode variants for all 8 roles
- Simple shadcn Table for user management (not TanStack DataTable) -- sufficient for v1 team sizes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed asChild prop from DropdownMenuTrigger**
- **Found during:** Task 2 (users-table.tsx build)
- **Issue:** DropdownMenuTrigger in shadcn v2 does not accept `asChild` prop -- TypeScript compilation error
- **Fix:** Used DropdownMenuTrigger directly with className instead of wrapping a child button element
- **Files modified:** apps/web/src/components/settings/users-table.tsx
- **Verification:** Next.js build succeeds
- **Committed in:** f2404fd (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor API compatibility fix. No scope creep.

## Issues Encountered
None beyond the asChild compatibility fix noted above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Auth UI and app shell complete, ready for i18n integration (Plan 04)
- All hardcoded EN strings marked for translation replacement
- ThemeProvider and TRPCProvider wired in locale layout, ready for NextIntlClientProvider wrapper

---
*Phase: 01-foundation-auth*
*Completed: 2026-03-18*
