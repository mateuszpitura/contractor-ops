# FE↔BE Integration Audit Report

Generated: 2026-05-17T13:07:04.387Z

## Reclassification — 2026-05-16

After human review of the heuristic's HIGH-severity output, all five `F-HIGH-*`
findings are confirmed **false-positives** caused by detector blind spots. The
original findings are preserved below (now living in Appendix B with their
machine-generated triage notes); this section adds the codebase citations that
prove the confirm UI exists, plus a one-line note on the heuristic limitation
so the next-run auditor can be improved.

| ID | Original summary | Reclassification | Confirm-UI citation | Heuristic blind spot |
|----|------------------|------------------|---------------------|----------------------|
| **F-HIGH-001** | `approval.reject` (missing-confirmation) at `apps/web/src/app/[locale]/(dashboard)/approvals/page.tsx:152` | **false-positive (heuristic limitation)** | `apps/web/src/components/approvals/approval-queue/side-panel.tsx:531` — inline Popover-with-reason gates the mutate; non-empty `comment` required before submit | Detector only searched for `window.confirm` / `<AlertDialog>` — missed inline Popover-confirm patterns where the required-input gate substitutes for a modal. |
| **F-HIGH-002** | `time.reject` (missing-confirmation) at `apps/web/src/app/[locale]/(dashboard)/time/[contractorId]/page.tsx:71` | **false-positive (heuristic limitation)** | `apps/web/src/components/time/contractor-timesheet-review.tsx:10` imports `RejectionReasonDialog` — the dialog collects the required `reason` before mutate fires | Detector did not recognize the dedicated `RejectionReasonDialog` component (custom Dialog wrapper, not `<AlertDialog>`). Add a name-pattern allowlist for `*RejectionReasonDialog`. |
| **F-HIGH-003** | `time.reject` (missing-confirmation) at `apps/web/src/app/[locale]/(dashboard)/time/page.tsx:128` | **false-positive (heuristic limitation)** | Same `RejectionReasonDialog` consumed at the bulk-reject site — required `reason` input gates the mutate | Same blind spot as F-HIGH-002 — custom Dialog wrappers escape the `<AlertDialog>` detector. |
| **F-HIGH-004** | `approval.reject` (missing-confirmation) at `apps/web/src/hooks/use-approval-actions.ts:43` | **false-positive (heuristic limitation)** | `apps/web/src/components/approvals/approval-queue/side-panel.tsx:531` — consumer hosts the Popover-with-reason; the hook is consumer-agnostic | Detector flagged a hook in isolation; it cannot host a confirm UI itself. Add a hook-vs-component classifier so confirm-UI checks only run on call-site components. |
| **F-HIGH-005** | `workflow.deleteTemplate` (missing-confirmation) at `apps/web/src/hooks/use-template-mutations.ts:36` | **false-positive (heuristic limitation)** | `apps/web/src/components/workflows/templates-table.tsx:360-380` — canonical `<AlertDialog>` wraps the delete trigger; confirmation is enforced at the call site | Same hook-vs-component blind spot as F-HIGH-004. Hooks export mutation handlers; the modal lives in the consumer component. |

**Action for next auditor run:** add (1) a Popover-with-required-input pattern
matcher, (2) a custom-Dialog-name allowlist (`*ReasonDialog`, `*ConfirmDialog`),
and (3) a hook-vs-component classifier so hook files are excluded from
confirm-UI requirements (the check should fire on the consumer instead).

## Summary

- Active findings: **0** (HIGH 0 / MED 0 / LOW 0)
- Triaged as false positive: **0** (see Appendix B)
- Procedures audited: **416** (appRouter + portalAppRouter + publicApiRouter)
- FE mutation call sites audited: **252**

### By domain

| Domain | HIGH | MED | LOW | Total |
|--------|------|-----|-----|-------|
| core | 0 | 0 | 0 | 0 |
| compliance | 0 | 0 | 0 | 0 |
| equipment | 0 | 0 | 0 | 0 |
| finance | 0 | 0 | 0 | 0 |
| integrations | 0 | 0 | 0 | 0 |
| portal | 0 | 0 | 0 | 0 |
| workflow | 0 | 0 | 0 | 0 |

## HIGH (0)

## MED (0)

## LOW (0)

## Appendix A — Intentional non-UI consumers

These procedures have no FE caller because they are invoked from non-UI consumers (public-api REST routes, background jobs, cron scripts, services). Count: **0**.

