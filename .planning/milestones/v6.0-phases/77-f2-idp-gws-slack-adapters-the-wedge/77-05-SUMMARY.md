---
phase: 77-f2-idp-gws-slack-adapters-the-wedge
plan: 05
subsystem: ui
tags: [idp, deprovisioning, web-vite, react, i18n, rbac]

requires:
  - phase: 77-04
    provides: deprovisioning.describeImpact / overrideStepFailure / enableProviderForOrg / connectSlackOrgGrid / getDeprovisioningRun / getProviderToggleState
provides:
  - impact-preview panel (SC#1) + container (reconnect / admin-choice routing)
  - saga run-view + container (LIKELY_GONE/MANUAL_COMPLETED rendering, gated Mark-complete)
  - override-step-dialog (category + min-20 rationale) + step-override-badge (D-13)
  - Slack org-grid connection card + per-provider enable toggle table (D-14/D-15)
  - Idp.* i18n namespace (en/de/pl/ar parity) + idp:override_step_failure in the web-vite permission matrix
affects: []

tech-stack:
  added: []
  patterns:
    - "Page→Container→Hook→Component: hooks are the sole tRPC boundary; containers decide loading/empty/error/permission; views are props-in/JSX-out"

key-files:
  created:
    - apps/web-vite/src/components/idp/hooks/use-deprovisioning-run.ts
    - apps/web-vite/src/components/idp/hooks/use-impact-preview.ts
    - apps/web-vite/src/components/idp/deprovisioning-run-view.tsx
    - apps/web-vite/src/components/idp/deprovisioning-run-view-container.tsx
    - apps/web-vite/src/components/idp/impact-preview-panel.tsx
    - apps/web-vite/src/components/idp/impact-preview-panel-container.tsx
    - apps/web-vite/src/components/idp/override-step-dialog.tsx
    - apps/web-vite/src/components/idp/step-override-badge.tsx
    - apps/web-vite/src/components/settings/hooks/use-slack-org-grid-card.ts
    - apps/web-vite/src/components/settings/hooks/use-idp-deprovisioning-toggles.ts
    - apps/web-vite/src/components/settings/slack-org-grid-card.tsx
    - apps/web-vite/src/components/settings/slack-org-grid-card-container.tsx
    - apps/web-vite/src/components/settings/idp-deprovisioning-toggle-table.tsx
    - apps/web-vite/src/components/settings/idp-deprovisioning-toggle-table-container.tsx
    - apps/web-vite/src/components/idp/__tests__/deprovisioning-run-view.test.tsx
    - apps/web-vite/src/components/idp/__tests__/override-step-dialog.test.tsx
    - apps/web-vite/src/components/settings/__tests__/idp-deprovisioning-toggle-table.test.tsx
  modified:
    - apps/web-vite/src/components/settings/integrations-tab.tsx
    - apps/web-vite/src/hooks/use-permissions.ts
    - apps/web-vite/messages/{en,de,pl,ar}.json
    - packages/api/src/routers/integrations/deprovisioning.ts
    - scripts/check-web-vite-table-pattern.mjs

key-decisions:
  - "Added two backend queries 77-04 didn't ship but the UI required: getDeprovisioningRun (run+steps for the saga view) and getProviderToggleState (per-provider connected/flagApproved/enabled for the toggle table)."
  - "i18n catalog is apps/web-vite/messages/{locale}.json (the plan's i18n/messages/*.json path was stale); added an Idp namespace via a structured JSON read-modify-write (parity preserved)."
  - "Client permission matrix in use-permissions.ts gained idp:override_step_failure for owner+admin (parity with the auth package from 77-01); the parity test stays green."
  - "Toggle table uses raw <Table> (settings matrix exemption) and is allowlisted in check-web-vite-table-pattern, mirroring feature-flags-tab."
  - "base-ui Switch reflects disabled/checked via aria-* / data-* attributes (not native props) — tests assert on aria-disabled/aria-checked."

patterns-established:
  - "Presentational override dialog (no useMutation) — the container injects the mutation via onSubmit, keeping check:web-vite-data-layer green."

requirements-completed: [IDP-01, IDP-12]

duration: 95min
completed: 2026-05-31
---

# Phase 77 Plan 05: web-vite IdP admin surfaces Summary

**Admin UI for the deprovisioning wedge following Page→Container→Hook→Component: the pre-flight impact-preview panel (SC#1, with freshness/refresh + reconnect/admin-choice routing), the saga run/step view with LIKELY_GONE/MANUAL_COMPLETED rendering + the permission-gated override dialog + permanent badge (SC#4/SC#5), and the Slack org-grid connection card + per-provider enable toggle table — all i18n'd across en/de/pl/ar.**

## Performance
- **Duration:** ~95 min
- **Tasks:** 4
- **Files modified/created:** 23

## Accomplishments
- Impact-preview surface: `use-impact-preview` hook (sole tRPC boundary) + container routing (Skeleton / GWS reconnect banner on 401 / admin-choice banner on fetch failure / preview panel) + a per-IdP panel showing suspend/revoke/sign-out counts (sessionCount null → "—"), super-admin/org-owner warnings, the Slack NOT_ON_ENTERPRISE_GRID non-fatal state, freshness label + Refresh (forceRefresh).
- Saga run-view: `use-deprovisioning-run` hook (run/step query + override mutation + permission read + modal state) + decisive container + presentational view rendering each step's status (incl. MANUAL_COMPLETED override badge), the per-failed-step "Mark complete" button gated on `idp:override_step_failure`, and the override-step-dialog (category Select + min-20 rationale, DialogBody/DialogFooter).
- Settings: the Slack org-grid connection card (greyed Connect + docs link when not on Enterprise Grid) and the per-provider enable toggle table (disabled when flag != APPROVED; GWS independent of Slack), both wired into integrations-tab.
- Full i18n parity (en/de/pl/ar) + the client permission-matrix grant. All web-vite lint guards + 12 UI tests green.

## Task Commits
1. **queries + permission matrix + table allowlist** - `0b5dd144` (feat)
2. **idp run-view/impact-preview/override/badge** - `6d46fb56` (feat)
3. **slack org-grid card + toggle table** - `6d7181c3` (feat)
4. **i18n keys** - `4346e937` (feat)

## Decisions Made
See `key-decisions` frontmatter — notably the two UI-required backend queries added here and the stale i18n catalog path correction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added getDeprovisioningRun + getProviderToggleState queries**
- **Issue:** 77-05's run-view + toggle table need a run/step read + per-provider state query; 77-04 (and Phase 76) never shipped them.
- **Fix:** Added both org-scoped queries to the deprovisioning router.

**2. [Rule 3 - Blocking] i18n catalog path correction**
- **Issue:** The plan's `apps/web-vite/src/i18n/messages/{locale}.json` does not exist; the real catalog is `apps/web-vite/messages/{locale}.json` (TS bundle loader).
- **Fix:** Added the Idp namespace to the real catalog via a structured JSON edit; i18n:parity green.

**3. [Rule 2 - Missing critical] Client permission-matrix grant + base-ui test attrs**
- **Issue:** The web-vite `usePermissions` matrix lacked `idp:override_step_failure`, so the Mark-complete gate would never show; base-ui Switch uses aria-/data- attributes, not native disabled/checked.
- **Fix:** Granted owner+admin in the matrix (parity test green); tests assert on aria-disabled/aria-checked.

---

**Total deviations:** 3 (2 blocking backend/path additions, 1 critical matrix + test-attr). **Impact:** Required for a functional, gated UI; no scope creep.

## Issues Encountered
- None blocking. Raw `<Table>` for the small settings matrix is allowlisted (mirrors feature-flags-tab), not a workbench DataTable.

## Deferred Items
- The saga run-view + impact-preview surfaces are built as composable containers but are NOT yet mounted into a route/page (the offboarding `ACCESS_REVOKE` task screen that hosts them is outside 77-05's file set). Mounting `DeprovisioningRunViewContainer` / `ImpactPreviewPanelContainer` into the offboarding run page is a small follow-up.
- Inherited from 77-04: the Slack org-grid OAuth `/start`+callback route and the saga-start eligibility filter remain follow-ups; the card's Connect button targets the documented `/api/oauth/slack-org-grid/start` URL.

## Next Phase Readiness
- The wedge UI (preview + override + per-provider enable + org-grid connect) is implemented, tested, typechecked, and i18n-complete. Phase 78 (Entra/Okta/GitHub) extends the same surfaces.

---
*Phase: 77-f2-idp-gws-slack-adapters-the-wedge*
*Completed: 2026-05-31*
