---
phase: 73-f1-compliance-admin-dashboard-portal-self-service-i18n
plan: 06
subsystem: ui
tags: [web-vite, dashboard, datatable, i18n, compliance, COMPL-01, COMPL-11]

requires:
  - phase: 73-05
    provides: dashboardKpis + dashboardAtRisk/UpcomingRenewals/BlockedPayments tRPC queries
  - phase: 73-04
    provides: COMPL doc-name locked-phrase registry + signoff PENDING state
  - phase: 73-03
    provides: compliance:read permission
provides:
  - admin compliance dashboard route /compliance/dashboard (Page->Container->Hook->Component)
  - useComplDocName hook (policyRuleId -> per-locale label + PENDING flag) shared with 73-07/73-08
  - validators exports complDocNameSignoffKey/isComplDocNamePending + LOCKED_COMPL_NAMES_*
affects: [73-08]

tech-stack:
  added: []
  patterns:
    - "useComplDocName resolves via the existing Compliance.documentType.compliance-policy-engine catalog (not a new compliance.docName namespace) — reuses Phase 71/72 doc-name keys"
    - "tables leave a documented renderRowActions? slot so Plan 73-08 cross-mounts the override button without re-plumbing"

key-files:
  created:
    - apps/web-vite/src/pages/dashboard/compliance-dashboard.tsx
    - apps/web-vite/src/components/compliance/dashboard/compliance-dashboard-container.tsx
    - apps/web-vite/src/components/compliance/dashboard/hooks/use-compliance-dashboard.ts
    - apps/web-vite/src/components/compliance/dashboard/compliance-kpi-cards.tsx
    - apps/web-vite/src/components/compliance/dashboard/compliance-dashboard-skeleton.tsx
    - apps/web-vite/src/components/compliance/dashboard/{at-risk,upcoming-renewals,blocked-payments}-table/{data-table,columns}.tsx
    - apps/web-vite/src/components/compliance/hooks/use-compl-doc-name.ts
    - packages/validators/src/legal/compl-doc-name-signoff.ts
  modified:
    - apps/web-vite/src/router/dashboard-routes.tsx
    - apps/web-vite/messages/{en,de,pl,ar}.json
    - packages/validators/src/index.ts

key-decisions:
  - "useComplDocName points at the EXISTING Compliance.documentType.compliance-policy-engine catalog rather than the plan's new compliance.docName namespace — avoids duplicating doc-name strings already maintained since Phase 71"
  - "status cell uses the tab-compliance.tsx Badge palette (no `compliance` StatusDomain exists in @contractor-ops/ui statusToVariant)"
  - "added a validators signoff helper (compl-doc-name-signoff.ts) + barrel re-exports so the web-vite hook reads the PENDING flag without coupling to internal file layout"

patterns-established:
  - "renderRowActions? slot on at-risk + blocked-payments tables for the Plan 73-08 override button"

requirements-completed: [COMPL-01, COMPL-11]

duration: 95 min
completed: 2026-06-01
---

# Phase 73 Plan 06: Admin Compliance Dashboard UI Summary

**TanStack-routed admin compliance dashboard (3 KPI cards driving 3 canonical-DataTable tabs: at-risk, upcoming-renewals, blocked-payments) with permission gate, loading/empty/error states, 60s blocked-payments polling, deep-link drilldown, and full en/de/pl/ar i18n.**

## Performance

- **Duration:** 95 min
- **Tasks:** 8
- **Files modified:** 22 (18 created)

## Accomplishments
- Page->Container->Hook->Component dashboard; all 5 web-vite gates + typecheck + i18n:parity clean; container test 8 GREEN
- KPI cards keyboard-activatable (aria-pressed); tables via canonical DataTable; rows deep-link to /contractors/{id}/compliance#item-{id}; blocked-payments renders D-10 contractorReasons[]
- useComplDocName shared hook + validators signoff helper

## Task Commits

1. **Tasks 73-06-01..08** - `ca7322a6` (feat)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1] doc-name catalog reuse** — pointed useComplDocName at the existing `Compliance.documentType.compliance-policy-engine` catalog instead of a new `compliance.docName` namespace (avoids string duplication). Added only the missing IP-assignment/werkvertrag/us entries.

**2. [Rule 1] status Badge not AtelierStatusPill** — no `compliance` StatusDomain in statusToVariant; used the tab-compliance.tsx Badge palette.

**3. [Rule 1] AtelierEmptyState renderAction** — required prop; wired the shared `renderEmptyStateAction` bridge.

**4. [Rule 3] validators signoff helper + barrel exports** — added compl-doc-name-signoff.ts + re-exported LOCKED_COMPL_NAMES_* so the web-vite hook reads PENDING state cleanly.

---

**Total deviations:** 4 auto-fixed (3 Rule 1, 1 Rule 3). No scope creep.

## Issues Encountered
- None beyond the type/lib-shape deviations.

## User Setup Required
None.

## Deferred Verification
- Manual UAT (LOCAL-ONLY post-deploy): navigate /<locale>/compliance/dashboard, confirm card-click tab switch, drilldown, ~60s blocked-payments refresh.

## Next Phase Readiness
- 73-08 cross-mounts <OverrideComplianceItemButton/> via the renderRowActions? slots on at-risk + blocked-payments tables and reuses useComplDocName.

---
*Phase: 73-f1-compliance-admin-dashboard-portal-self-service-i18n*
*Completed: 2026-06-01*
