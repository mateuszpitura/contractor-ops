# Phase 42: Tech Debt Cleanup - Discussion Log (Assumptions Mode)

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the analysis.

**Date:** 2026-04-10
**Phase:** 42-tech-debt-cleanup
**Mode:** assumptions
**Areas analyzed:** Test Scaffolds, Hardcoded Retry Role, InPost Notification Dispatch, Notification Recipients

## Assumptions Presented

### Test Scaffolds (SC 1-3)
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| All 11 test files already have real assertions — zero it.todo() stubs remain | Confident | Grep for it.todo across billing-service.test.ts, billing-webhook.test.ts, credit-service.test.ts, linear-adapter.test.ts, linear.test.ts, linear-status-mapping.test.ts, linear-issue-sync.test.ts, google-workspace-adapter.test.ts, google-workspace-directory.test.ts, google-workspace.test.ts returns 0 matches |

### Hardcoded Retry Role (SC 4)
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Fix requires 3 changes: add role to failedItems type, update Zod schema, persist role at push-time and use in retryFailedItem | Confident | packages/api/src/routers/onboarding-import.ts line 46 (interface), line 368 (push), line 465 (hardcoded); packages/validators/src/onboarding-import.ts lines 153-158 (schema) |

### InPost Notification Dispatch (SC 5)
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Add SHIPMENT_STATUS_CHANGE notification type and dispatch in webhook handler on terminal statuses | Likely | packages/validators/src/notification.ts (Zod enum, no Prisma migration); inpost-webhook-handler.ts imports NOTIFICATION_STATUSES but never uses it |
| Resolve admin/owner user IDs from org for dispatch recipients | Likely | dispatch() requires recipientUserIds; billing-webhook.ts and google-workspace-sync-orchestrator.ts follow this pattern |

## Corrections Made

No corrections — all assumptions confirmed.

## Key Finding

Success criteria 1-3 (test scaffolds) are already satisfied. Phase scope reduced from 5 items to 2 items (SC 4 and SC 5 only). Verified via grep: zero it.todo() matches in any of the 11 flagged test files.
