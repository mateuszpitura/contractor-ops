---
phase: 73-f1-compliance-admin-dashboard-portal-self-service-i18n
plan: 08
subsystem: ui
tags: [compliance, override, upload-review, audit-trail, notification, feature-flag, COMPL-01, COMPL-04, COMPL-11]

requires:
  - phase: 73-03
    provides: overrideItem mutation + itemAuditTrail query
  - phase: 73-06
    provides: dashboard renderRowActions slot + useComplDocName
  - phase: 73-07
    provides: portal upload-replacement (PENDING_REVIEW documents to review)
provides:
  - approveUploadReplacement + rejectUploadReplacement admin mutations + notification types
  - compliance-portal-self-service PENDING feature-flag entry
  - override modal triplet + override button (Compliance tab + dashboard) + history disclosure + upload-review dialog
affects: []

tech-stack:
  added: []
  patterns:
    - "single shared override modal triplet mounted in two places (Compliance tab inline + dashboard at-risk renderRowActions slot)"
    - "compliance upload-outcome notifications dispatched best-effort post-tx to the contractor:read RBAC set (contractors are portal-session, not platform users)"

key-files:
  created:
    - apps/web-vite/src/components/contractors/compliance/override-compliance-item-dialog.tsx
    - apps/web-vite/src/components/contractors/compliance/override-compliance-item-dialog-container.tsx
    - apps/web-vite/src/components/contractors/compliance/override-compliance-item-button.tsx
    - apps/web-vite/src/components/contractors/compliance/compliance-item-history.tsx
    - apps/web-vite/src/components/contractors/compliance/upload-review-dialog.tsx
    - apps/web-vite/src/components/contractors/compliance/upload-review-dialog-container.tsx
    - apps/web-vite/src/components/contractors/compliance/hooks/use-override-compliance-item.ts
    - apps/web-vite/src/components/contractors/compliance/hooks/use-compliance-item-history.ts
    - apps/web-vite/src/components/contractors/compliance/hooks/use-upload-review.ts
    - packages/feature-flags/src/__tests__/compliance-portal-self-service-entry.test.ts
  modified:
    - packages/api/src/routers/compliance/classification.ts (approve/reject mutations + dispatch helper)
    - packages/validators/src/notification.ts (compliance.upload.approved/rejected types)
    - packages/feature-flags/src/signoff-registry-flags.json
    - apps/web-vite/src/components/contractors/contractor-profile/tab-compliance.tsx
    - apps/web-vite/src/components/compliance/dashboard/compliance-dashboard-container.tsx
    - apps/web-vite/messages/{en,de,pl,ar}.json

key-decisions:
  - "approve/reject mutations live on the staff classification router (tenantProcedure + compliance:override) — distinct from the portal submitUploadReplacement (73-07, portalRouter)"
  - "contractor notification recipient = the contractor:read RBAC set (the staff who review uploads); contractors lack a platform User so a direct contractor recipientUserId is impossible — dispatch is best-effort post-tx and the contractor sees the outcome in their portal"
  - "Document.rejectionReason schema column DEFERRED — the rejection reason is captured in the audit log only (Researcher pin)"

patterns-established:
  - "ComplianceItem type extended with severity + waivedReasonCategory (returned by the contractor-detail Prisma include automatically — no API change needed)"

requirements-completed: [COMPL-01, COMPL-04, COMPL-11]

duration: 110 min
completed: 2026-06-01
---

# Phase 73 Plan 08: Compliance Override Surface + Admin Upload-Review + Tab UX Summary

**Admin approve/reject of contractor uploads (item->SATISFIED / Document->ARCHIVED + audit + best-effort notification), a shared override modal mounted on the Compliance tab + dashboard, an audit-log History disclosure, the WAIVED badge, and the compliance-portal-self-service PENDING flag — all Wave 0 scaffolds GREEN.**

## Performance

- **Duration:** 110 min
- **Tasks:** 11
- **Files modified:** 24 (10 created)

## Accomplishments
- approve/reject admin mutations (atomic status flip + audit), notification types, PENDING flag
- override modal triplet + single override button (tab inline + dashboard slot), history disclosure, upload-review dialog triplet
- tab-compliance per-row override + history + WAIVED tooltip; ComplianceItem type extended
- Compliance.override/uploadReview/history/notifications i18n in 4 locales (parity clean)
- upload-review API 9 GREEN, flag entry 2 GREEN, override-dialog + history 7 GREEN; typecheck + 4 web-vite gates clean

## Task Commits

1. **Tasks 73-08-01..11** - `6fc2b8f3` (feat)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1] Contractor notification recipient** — contractors authenticate via portal sessions, not the platform User table, so there is no contractor recipientUserId. Dispatched best-effort post-tx to the contractor:read RBAC set; the contractor sees the outcome in their portal list. Notification TYPES exist as required.

**2. [Rule 1] TooltipTrigger has no asChild** — this Tooltip is base-ui (render/children, not Radix asChild). Rendered the WAIVED badge content directly inside TooltipTrigger.

**3. [Rule 1] tab-compliance.test fixtures + ComplianceItem type** — extended the type with severity + waivedReasonCategory (returned by the contractor-detail Prisma `include` automatically) and updated the pre-existing test fixtures.

---

**Total deviations:** 3 auto-fixed (3 Rule 1). The notification-recipient one reflects a real data-model constraint. No scope creep.

## Issues Encountered
- useDateFormatter pulls tRPC (org-locale settings) — the history test mocks it to avoid a TRPCProvider.

## User Setup Required
None.

## Deferred Verification
- compliance-portal-self-service flag stays PENDING until post-deploy legal review (Phase 70 D-09 gate).
- Document.rejectionReason schema column deferred (reason in audit log only).
- Manual UAT (LOCAL-ONLY): admin override a BLOCKING item (-> WAIVED + history entry), review a PENDING_REVIEW upload (approve -> SATISFIED + notify; reject -> ARCHIVED + notify with re-upload link).

## Next Phase Readiness
- Phase 73 complete: admin dashboard + portal self-service + override/review surface + 4-locale i18n all shipped.

---
*Phase: 73-f1-compliance-admin-dashboard-portal-self-service-i18n*
*Completed: 2026-06-01*
