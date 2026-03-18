---
phase: 01-foundation-auth
verified: 2026-03-18T22:30:00Z
status: gaps_found
score: 8/9 truths verified
gaps:
  - truth: "All tRPC procedures are tenant-scoped via middleware chain"
    status: failed
    reason: "tenant.ts middleware sets organizationId in tRPC context but never calls tenantStore.run() from @contractor-ops/db. AsyncLocalStorage is not populated, so Prisma Client Extension cannot inject organizationId into database queries. Any future direct Prisma query in a router would bypass tenant isolation entirely."
    artifacts:
      - path: "packages/api/src/middleware/tenant.ts"
        issue: "Missing import of tenantStore from @contractor-ops/db. Missing tenantStore.run({ organizationId: orgId }, () => next({ ctx })) wrapper around the next() call."
    missing:
      - "Import tenantStore from '@contractor-ops/db' in packages/api/src/middleware/tenant.ts"
      - "Wrap next() call inside tenantStore.run({ organizationId: orgId }, async () => next({ ctx })) so the AsyncLocalStorage context is active for the entire request handler duration"
human_verification:
  - test: "Auth flow end-to-end"
    expected: "Register creates org, login works, invite email sent in dev (console log), invite acceptance creates account"
    why_human: "Email flow (magic link, invitation) uses console.log in dev -- requires running app to verify log output and redirect behavior"
  - test: "Dark mode toggle"
    expected: "User menu toggle switches theme without flash; system preference detected on first load"
    why_human: "Visual appearance and FOUC prevention require browser testing"
  - test: "Sidebar collapse"
    expected: "240px expanded to 48px icon-only with 200ms animation; mobile sheet below 1024px"
    why_human: "Animation and responsive behavior require browser testing"
  - test: "Polish locale rendering"
    expected: "Visiting /pl/ renders Polish text; visiting /en/ renders English; language switcher works"
    why_human: "Locale routing requires running the Next.js dev server with browser navigation"
---

# Phase 1: Foundation & Auth Verification Report

**Phase Goal:** Users can create organizations, invite team members with role-based access, and navigate a tenant-isolated app shell in Polish or English
**Verified:** 2026-03-18T22:30:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Monorepo builds and all packages are wired | VERIFIED | turbo.json with `tasks.build` exists; 6 packages scaffold confirmed (web, db, auth, api, validators, ui) |
| 2 | Prisma schema contains all tables with organizationId on tenant-scoped models | VERIFIED | 10 files with organizationId found; contractor.prisma has 32 occurrences; all 11 bounded context schema files present |
| 3 | Tenant isolation Client Extension injects organizationId on all queries | VERIFIED (Extension exists) / NOT WIRED (to API layer) | packages/db/src/tenant.ts implements withTenantScope with AsyncLocalStorage — but tenant.ts middleware in API never calls tenantStore.run() |
| 4 | User can register with email, password, and org name | VERIFIED | register-form.tsx calls authClient.signUp.email() then authClient.organization.create(); wired to authClient |
| 5 | User can login via email/password, magic link, or social OAuth | VERIFIED | login-form.tsx has email/password flow and magicLink flow; social-buttons.tsx calls authClient.signIn.social() for google/microsoft |
| 6 | Invited user can accept invitation | VERIFIED | invite-accept-form.tsx calls authClient.signUp.email() then authClient.organization.acceptInvitation() |
| 7 | 8 predefined roles are defined and enforced at tRPC level | VERIFIED | roles.ts defines all 8 roles with correct permission mappings; requirePermission middleware uses auth.api.hasPermission(); all sensitive procedures use sensitiveActionProcedure |
| 8 | All UI text renders in Polish and English with locale-aware formatting | VERIFIED | en.json and pl.json both have 9 matching top-level namespaces; all components use useTranslations hooks; next-intl routing with [locale] segment; request.ts has PLN currency + Europe/Warsaw timezone formatters |
| 9 | All tRPC procedures are tenant-scoped via middleware chain | FAILED | tenant.ts in packages/api sets organizationId in tRPC ctx but does NOT call tenantStore.run() — AsyncLocalStorage context is never populated, making Prisma Client Extension inoperable at the API layer |

**Score:** 8/9 truths verified (gap in ORG-07 wiring)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/db/prisma/schema/schema.prisma` | Datasource + generator config | VERIFIED | Contains `generator client`, `provider = "postgresql"` |
| `packages/db/src/client.ts` | Prisma client with Neon adapter | VERIFIED | Contains `PrismaNeon`, singleton pattern with global caching |
| `packages/db/src/tenant.ts` | Tenant-scoped client extension | VERIFIED | Contains `tenantStore` (AsyncLocalStorage), `withTenantScope` with full CRUD operation injection |
| `packages/db/src/soft-delete.ts` | Soft-delete client extension | VERIFIED | Contains `withSoftDelete`, intercepts delete/deleteMany/findMany/findFirst/count for 5 models |
| `turbo.json` | Turborepo pipeline | VERIFIED | Contains `tasks.build` with `dependsOn: ["^build"]` |
| `packages/auth/src/permissions.ts` | Access control with all resource-action pairs | VERIFIED | 11 resources: organization, member, invitation, contractor, contract, invoice, workflow, payment, report, settings, integration |
| `packages/auth/src/roles.ts` | 8 predefined role definitions | VERIFIED | All 8 roles defined with correct permission subsets |
| `packages/auth/src/config.ts` | Better Auth server configuration | VERIFIED | betterAuth with Prisma adapter, email/password, Google/Microsoft OAuth, magicLink, organization plugin, admin plugin, nextCookies() last |
| `packages/api/src/middleware/auth.ts` | Auth middleware for tRPC | VERIFIED | authMiddleware + authedProcedure |
| `packages/api/src/middleware/tenant.ts` | Tenant scoping middleware | PARTIAL | Sets organizationId in ctx — but missing tenantStore.run() wrapper |
| `packages/api/src/middleware/rbac.ts` | RBAC permission checking | VERIFIED | requirePermission factory + adminProcedure; imports @contractor-ops/auth |
| `packages/api/src/middleware/sensitive.ts` | Re-auth guard | VERIFIED | 5-minute session age check; sensitiveActionProcedure chains after tenantProcedure |
| `packages/api/src/root.ts` | Root tRPC router | VERIFIED | appRouter merges organization, user, settings routers; AppRouter type exported |
| `apps/web/src/app/[locale]/layout.tsx` | Root locale layout | VERIFIED | ThemeProvider, NextIntlClientProvider, TRPCProvider (via Providers), Toaster all present |
| `apps/web/src/components/layout/sidebar.tsx` | Collapsible sidebar | VERIFIED | Uses `Sidebar collapsible="icon"`, SidebarProvider in dashboard layout |
| `apps/web/src/components/layout/top-bar.tsx` | Top bar with breadcrumb + actions | VERIFIED | Breadcrumb, UserPlus, Upload, Search, Bell all present |
| `apps/web/src/components/settings/users-table.tsx` | User management table | VERIFIED | Calls trpc.user.list, trpc.user.updateRole, trpc.user.deactivate, trpc.user.reactivate via useMutation/useQuery |
| `apps/web/src/components/auth/register-form.tsx` | Registration form | VERIFIED | authClient.signUp.email + authClient.organization.create; useTranslations; no hardcoded strings |
| `apps/web/src/app/globals.css` | CSS with Indigo accent + dark mode | VERIFIED | oklch Indigo primary (light/dark variants); --success, --warning, --info semantic colors; .density-compact class |
| `apps/web/messages/en.json` | Complete English translations | VERIFIED | 9 namespaces: Auth, Navigation, TopBar, Dashboard, Settings, Users, Errors, Validation, Common; Auth.register.title = "Create your organization" |
| `apps/web/messages/pl.json` | Complete Polish translations | VERIFIED | Same 9 namespaces; Navigation.dashboard = "Pulpit"; Auth.register.title = "Utworz organizacje" |
| `apps/web/src/i18n/routing.ts` | Locale routing config | VERIFIED | defineRouting with locales ["en","pl"], defaultLocale "pl" |
| `apps/web/src/i18n/request.ts` | next-intl request config | VERIFIED | getRequestConfig with timeZone "Europe/Warsaw", PLN currency format, date formatters |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/db/src/client.ts` | `packages/db/prisma/schema/schema.prisma` | Import from generated/prisma | WIRED | Imports `PrismaClient` from `../generated/prisma/client/index.js` |
| `packages/db/src/index.ts` | `packages/db/src/tenant.ts` | Re-exports withTenantScope + tenantStore | WIRED | `export { withTenantScope, tenantStore } from "./tenant.js"` |
| `packages/api/src/middleware/auth.ts` | `packages/auth/src/config.ts` | Session validation via auth | WIRED | `import { auth } from "@contractor-ops/auth"` |
| `packages/api/src/middleware/tenant.ts` | `packages/db/src/tenant.ts` | tenantStore.run() for AsyncLocalStorage | NOT WIRED | tenant.ts does not import tenantStore or call tenantStore.run(). orgId is set in ctx only. |
| `packages/api/src/middleware/sensitive.ts` | `packages/api/src/middleware/tenant.ts` | Chains after tenantProcedure | WIRED | `sensitiveActionProcedure = tenantProcedure.use(sensitiveActionMiddleware)` |
| `apps/web/src/app/api/auth/[...all]/route.ts` | `packages/auth/src/config.ts` | Better Auth request handler | WIRED | `toNextJsHandler(auth)` exporting GET, POST |
| `apps/web/src/app/api/trpc/[trpc]/route.ts` | `packages/api/src/root.ts` | tRPC fetch adapter | WIRED | `fetchRequestHandler` with `appRouter` and `createContext` |
| `apps/web/src/app/[locale]/layout.tsx` | `apps/web/src/i18n/request.ts` | NextIntlClientProvider with messages | WIRED | `NextIntlClientProvider messages={messages}` with `getMessages()` and `setRequestLocale` |
| `apps/web/src/components/auth/register-form.tsx` | `apps/web/messages/en.json` | useTranslations("Auth.register") | WIRED | `useTranslations("Auth.register")` present; no hardcoded "Create your organization" |
| `apps/web/src/components/layout/nav-items.tsx` | `apps/web/src/hooks/use-permissions.ts` | Filter nav items by role permissions | WIRED | `usePermissions()` imported and called; items filtered via `can(item.permission.resource, item.permission.actions)` |
| `apps/web/src/components/settings/users-table.tsx` | `packages/api/src/routers/user.ts` | tRPC calls for list/invite/updateRole/deactivate | WIRED | `trpc.user.list.queryOptions()`, `trpc.user.updateRole.mutationOptions()`, `trpc.user.deactivate.mutationOptions()` all present |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| ORG-01 | 01-01, 01-02 | User can create a new organization with name, country, default currency, and timezone | SATISFIED | organization.create tRPC procedure; register-form creates org via authClient.organization.create(); schema stores countryCode, defaultCurrency, timezone |
| ORG-02 | 01-03 | Admin can configure organization settings | SATISFIED | org-settings-form.tsx wired to trpc.settings.update; 8 fields (name, legalName, country, currency, timezone, language, fiscal year, billing email) |
| ORG-03 | 01-02, 01-03 | Admin can invite users by email with a specific role | SATISFIED | user.invite tRPC procedure calls auth.api.createInvitation; invite-dialog.tsx wired; inviteUserSchema with all 8 role names |
| ORG-04 | 01-03 | Invited user can accept invitation | PARTIALLY SATISFIED | invite-accept-form.tsx calls acceptInvitation; but requireEmailVerification is false (deferred to Phase 7) — the invitation flow works but without email verification |
| ORG-05 | 01-02, 01-03 | Admin can deactivate a user, immediately revoking access | SATISFIED | user.deactivate calls auth.api.banUser; deactivate-dialog.tsx wired; sensitiveActionProcedure enforces re-auth |
| ORG-06 | 01-02 | 8 roles enforced via RBAC | SATISFIED | All 8 roles defined in roles.ts; requirePermission middleware checks via auth.api.hasPermission; nav items filtered by usePermissions hook |
| ORG-07 | 01-01, 01-02 | All data access scoped to organization with no cross-tenant leakage | PARTIALLY SATISFIED | Prisma Client Extension exists and is correct; but tenant.ts middleware in API layer does NOT call tenantStore.run() — DB queries in routers bypass AsyncLocalStorage isolation. Current routers use Better Auth API exclusively (no direct Prisma), so no immediate leakage in Phase 1, but the wiring is broken and any future direct Prisma query would be unscoped. |
| I18N-01 | 01-04 | All UI strings externalized in Polish and English | SATISFIED | en.json and pl.json with 9 matching namespaces; all components verified using useTranslations |
| I18N-02 | 01-04 | Dates, numbers, currency formatted by locale | SATISFIED | request.ts configures PLN currency format + date formatters; Europe/Warsaw timezone; locale routing via [locale] segment |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/auth/src/config.ts` | 18 | `requireEmailVerification: false` with TODO | Warning | Email verification disabled — deferred to Phase 7. Documented intentional deviation. Sign-up works without verification. Invitation flow is functional. |
| `packages/auth/src/config.ts` | 57, 66 | `// TODO: Implement production email sending via Resend (Phase 7)` | Info | Dev environment only uses console.log for magic link and invitation emails. Expected — Phase 7 will wire Resend. |
| `packages/api/src/middleware/tenant.ts` | 26-28 | Missing `tenantStore.run()` wrapper | Blocker | The AsyncLocalStorage context is never set. Prisma Client Extension in packages/db/src/tenant.ts cannot inject organizationId into queries. Any direct Prisma query in a router bypasses tenant isolation. |

---

## Human Verification Required

### 1. End-to-End Auth Flow

**Test:** Start dev server (`pnpm --filter @contractor-ops/web dev`), visit `/pl/register`, create account with org, verify redirect behavior, then test `/pl/login` with email/password and magic link.
**Expected:** Registration creates org and redirects to email verification page (or dashboard if verification is disabled). Login with email/password succeeds and lands on dashboard. Magic link triggers console.log in terminal.
**Why human:** Console log output, redirect behavior, and session cookie require running the app.

### 2. Invitation Flow

**Test:** As admin, go to Settings > Members, invite a new email, check console for invitation link, open link in new browser, accept invitation.
**Expected:** Invitation link appears in terminal console; accepting link creates account and joins org.
**Why human:** Invitation email is console-logged in dev; multi-browser session flow requires manual testing.

### 3. Dark Mode

**Test:** Open user menu in sidebar footer, toggle "Dark mode" switch.
**Expected:** Theme switches to dark without flash; OS preference is detected on initial load.
**Why human:** Visual flash (FOUC) and CSS transition can only be tested in browser.

### 4. Sidebar Collapse

**Test:** Click sidebar toggle, verify it collapses to icon-only mode. Resize below 1024px.
**Expected:** Sidebar collapses with 200ms animation; below 1024px hamburger/sheet appears.
**Why human:** Animation timing and responsive breakpoint require browser.

### 5. Polish Locale

**Test:** Navigate to `http://localhost:3000/pl/login` and `http://localhost:3000/en/login`.
**Expected:** /pl/ shows Polish text ("Zaloguj sie do Contractor Ops"); /en/ shows English text ("Sign in to Contractor Ops"); language switcher in user menu changes locale.
**Why human:** Locale routing requires running Next.js server; visual text comparison needed.

---

## Gaps Summary

One blocker gap found affecting requirement ORG-07 (tenant isolation):

**`packages/api/src/middleware/tenant.ts` does not wire `tenantStore.run()`.**

The Prisma Client Extension for tenant scoping (`packages/db/src/tenant.ts`) works correctly in isolation — it reads `organizationId` from `tenantStore.getStore()` and injects it into all queries. However, the tRPC tenant middleware that should populate this store does not import `tenantStore` from `@contractor-ops/db` and does not call `tenantStore.run({ organizationId: orgId }, () => next(...))`.

**Why no immediate data leak exists today:** All Phase 1 routers use Better Auth's server API (`auth.api.*`) for every database operation. Better Auth handles its own scoping. No Phase 1 router makes direct Prisma queries. The gap will become a real security vulnerability the moment any Phase 2+ router calls `prisma.contractor.findMany()` or similar.

**Fix required:** In `packages/api/src/middleware/tenant.ts`, import `tenantStore` from `@contractor-ops/db` and wrap the `return next(...)` call inside `tenantStore.run({ organizationId: orgId }, async () => next({ ctx }))`.

---

_Verified: 2026-03-18T22:30:00Z_
_Verifier: Claude (gsd-verifier)_
