# FE↔BE Integration Audit Report

Generated: 2026-05-16T17:00:22.817Z

## Summary

- Active findings: **1** (HIGH 0 / MED 0 / LOW 1)
- Triaged as false positive: **2** (see Appendix B)
- Procedures audited: **416** (appRouter + portalAppRouter + publicApiRouter)
- FE mutation call sites audited: **252**

### By domain

| Domain | HIGH | MED | LOW | Total |
|--------|------|-----|-----|-------|
| core | 0 | 0 | 0 | 0 |
| compliance | 0 | 0 | 0 | 0 |
| equipment | 0 | 0 | 0 | 0 |
| finance | 0 | 0 | 1 | 1 |
| integrations | 0 | 0 | 0 | 0 |
| portal | 0 | 0 | 0 | 0 |
| workflow | 0 | 0 | 0 | 0 |

## HIGH (0)

## MED (0)

## LOW (0)

## Appendix A — Intentional non-UI consumers

These procedures have no FE caller because they are invoked from non-UI consumers (public-api REST routes, background jobs, cron scripts, services). Count: **1**.

- **F-MED-001** `exchangeRate.fetchDaily` — caller(s):
  - `(middleware=cronProcedure on packages/api/src/routers/finance/exchange-rate.ts:24)`

## Appendix B — Triaged false positives

Findings the detector raised that were manually reviewed and confirmed intentional. Annotations live in `data/false-positives.json` and survive pipeline regeneration.

### cell-blur-autosave (1)

- **F-LOW-001** `apps/web/src/app/[locale]/(portal)/portal/time/page.tsx:118` — portalTime.saveDraftEntries (missing-loading-state). _Why benign:_ Mutation fires from TimesheetGrid's cell-blur handler, not a discrete Button. The grid's `disabled` prop is already wired (set by submitted/approved timesheet state), and saves are batched on blur — there is no static trigger to disable mid-flight.

### optimistic-update (1)

- **F-LOW-002** `apps/web/src/components/portal/notification-preferences-section.tsx:119` — portal.updateNotificationPreference (missing-loading-state). _Why benign:_ Mutation uses optimistic-update (`onMutate` writes new value to query cache + `onSettled` refetches). Disabling the Switch while pending would defeat the optimistic UX — toggle feedback is instant by design.
