---
phase: 96-theme-b-employee-self-service-portal
plan: 07
subsystem: web-vite
tags: [portal, employee-portal, ui, web-vite, hooks, i18n]
requirements: [EMP-PORTAL-02, EMP-PORTAL-04]
dependency_graph:
  requires:
    - phase: 96-04
      provides: "portalEmployee namespace (getDashboard/getLeaveBalance/listMyLeaveRequests/getMyTime/getMyEwidencja/submitTimeOffRequest)"
    - phase: 96-05
      provides: "getMyAkta/getMyAktaDocumentUrl/getPayStubAvailability"
  provides:
    - "/portal/employee/* routes inside the existing PortalShell: dashboard + leave + time + documents + pay"
    - "employee section hooks (sole tRPC boundary) + wired sections + presentational views"
  affects:
    - "96-09 (nav wiring + full i18n parity across en/en-US/de/pl/ar)"
tech_stack:
  patterns:
    - "web-vite layering: thin Suspense pages → wired sections (own loading/empty/error/unavailable) → hooks (only usePortalTRPC callers) → presentational views"
    - "dark-widget graceful degradation: a FORBIDDEN/METHOD_NOT_FOUND/UNAUTHORIZED tRPC error maps to isUnavailable (a real 'not available' state), never an error boundary — isModuleDarkError shared from use-employee-dashboard"
    - "time-off request = react-hook-form + zod, DialogBody/DialogFooter convention, AnimateIn entrance; the form carries NO workerId (the session is the subject)"
key_files:
  created:
    - "apps/web-vite/src/components/portal/employee/hooks/use-employee-dashboard.ts"
    - "apps/web-vite/src/components/portal/employee/hooks/use-employee-leave.ts"
    - "apps/web-vite/src/components/portal/employee/hooks/use-employee-time.ts"
    - "apps/web-vite/src/components/portal/employee/hooks/use-employee-akta.ts"
    - "apps/web-vite/src/components/portal/employee/employee-section-shell.tsx"
    - "apps/web-vite/src/components/portal/employee/employee-dashboard.tsx"
    - "apps/web-vite/src/components/portal/employee/employee-leave-section.tsx"
    - "apps/web-vite/src/components/portal/employee/employee-time-section.tsx"
    - "apps/web-vite/src/components/portal/employee/employee-documents-section.tsx"
    - "apps/web-vite/src/components/portal/employee/employee-pay-section.tsx"
    - "apps/web-vite/src/pages/portal/employee/{index,leave,time,documents,pay}.tsx"
  modified:
    - "apps/web-vite/src/router/portal-routes.tsx"
    - "apps/web-vite/messages/en.json"
decisions:
  - "No `useFlag('module.employee-portal')` page gate: the portal shell does not mount a FeatureFlagProvider, so `useFlag` would THROW there. The graceful gate is instead the hooks' isUnavailable branch — a contractor subject or dark org gets UNAUTHORIZED/FORBIDDEN from the server (dark-mount + subject rejection, authoritative), which the hook maps to a real unavailable state (never a crash). This satisfies the plan's threat model (forbidden state, not a crash)."
  - "Akta UPLOAD not built: the upload backend was deferred in 96-05 (no requestAktaUpload/confirmAktaUpload procedures, no RED test), so the documents section is read + download only (getMyAkta + on-click getMyAktaDocumentUrl). Wiring an upload UI to a non-existent backend would be dead code."
  - "Time-off leave-type options are derived from the caller's own balances (leaveTypeId + available minutes) because the employee portal backend exposes no leave-types list endpoint. Options are labeled by available balance. A dedicated leave-types read would improve the labels — flagged for a later backend slice, out of this UI plan's scope."
  - "getPayStubAvailability folded into use-employee-dashboard (the plan pairs them); the pay section always renders the truthful available:false empty state in v7.0."
requirements_completed: []
completed: 2026-07-05
---

# Phase 96 Plan 07: Employee self-service dashboard UI

**Built the `/portal/employee/*` surface on the existing portal shell — four section hooks (the sole tRPC boundary), wired sections with full loading/empty/error/unavailable states, presentational views, thin pages, and English i18n source keys — turning the 96-04/96-05 backend into a polished, localized, accessible employee dashboard.**

## Accomplishments

- **Hooks (only `usePortalTRPC` callers)** — `use-employee-dashboard` (getDashboard + getPayStubAvailability), `use-employee-leave` (balances + listMyLeaveRequests + submitTimeOffRequest mutation with toasts + invalidation), `use-employee-time` (getMyTime + getMyEwidencja), `use-employee-akta` (getMyAkta + lazy getMyAktaDocumentUrl download). Each returns a props bag + `isLoading`/`isEmpty`/`isError`/`isUnavailable` flags; a dark surface maps to `isUnavailable`.
- **Sections + views** — leave (balances, own requests, a validated time-off Dialog), time (recorded time + ewidencja), documents (akta grouped by self-view section, per-document download), pay (the truthful `available:false` empty state). Each wired section owns its variants; views are props-only. A shared `employee-section-shell` provides the card / skeleton / message primitives.
- **Dashboard** — `EmployeeDashboard` renders a summary strip (available leave, pending requests, recent entries) and composes the four sections with staggered `AnimateIn` entrance.
- **Time-off form** — react-hook-form + zod, `DialogBody`/`DialogFooter` convention, no `workerId` in the payload, success/error toasts, balance-aware leave-type select, keyboard/focus + `aria-invalid` on fields.
- **Routes + thin pages** — five `/portal/employee/*` routes inside the authenticated `PortalShell`; each page is a Suspense composer over one wired root (no data boundary).
- **i18n** — English source keys under `Portal.employee.*` (dashboard/leave/time/documents/pay + the form). Parity across the other locales is 96-09.

## Verification

- `pnpm check:web-vite-data-layer` + `check:web-vite-page-shells` + `check:web-vite-presentational` + `check:web-vite-dialog-pattern` — all OK (tRPC confined to `hooks/`, pages thin, views props-only, Dialog body/footer).
- `pnpm typecheck --filter=@contractor-ops/web-vite` — 19/19 GREEN (the Prisma-7 client makes web-vite tsc memory-heavy; run with `NODE_OPTIONS=--max-old-space-size=8192`).
- `pnpm i18n:parity` — RED on the new `Portal.employee.*` keys (en-only by design); parity across en-US/de/pl/ar is finalized in 96-09 per the plan.

## Notes / deviations

- **Verification must run in the worktree**, not the shared checkout — the web-vite tsc needs the worktree's built `@contractor-ops/ui` + regenerated Prisma client (both dependency artifacts, not committed here).
- **No useFlag page gate / no akta upload / balance-derived leave-type options** — see decisions above. All are honest consequences of the current shell (no FeatureFlagProvider) and backend (no akta-upload / no employee leave-types endpoint), flagged rather than faked.
- **Nav links + full i18n parity** are 96-09.
