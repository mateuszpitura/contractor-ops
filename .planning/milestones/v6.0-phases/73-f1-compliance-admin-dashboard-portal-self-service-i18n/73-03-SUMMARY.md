---
phase: 73-f1-compliance-admin-dashboard-portal-self-service-i18n
plan: 03
subsystem: api
tags: [auth, rbac, trpc, audit-log, compliance, override, COMPL-01]

requires:
  - phase: 73-02
    provides: WaivedReasonCategory enum + waivedReasonCategory/waivedReasonNote columns + AuditLog GIN index
  - phase: 73-01
    provides: compliance-permission + compliance-override-mutation Wave 0 RED scaffolds
provides:
  - compliance:read / compliance:override permission resource + per-role grants (D-10)
  - compliance.overrideItem mutation (D-12) — atomic status→WAIVED + audit
  - compliance.itemAuditTrail query (D-13) — History timeline
affects: [73-06, 73-08]

tech-stack:
  added: []
  patterns:
    - "tRPC error messages reference i18n-key constants in errors.ts (complianceItemNotFound / complianceItemAlreadyWaived), never hardcoded English"
    - "router-caller tests use createCallerFactory(appRouter) + full @contractor-ops/db|auth|logger|feature-flags mocks + hoisted mockPrisma with observable $transaction + organization findUnique stub for the tenant middleware"

key-files:
  created:
    - packages/api/src/__tests__/compliance-item-audit-trail.test.ts
  modified:
    - packages/auth/src/permissions.ts
    - packages/auth/src/roles.ts
    - packages/auth/src/__tests__/compliance-permission.test.ts
    - packages/api/src/errors.ts
    - packages/api/src/routers/compliance/classification.ts
    - packages/api/src/__tests__/compliance-override-mutation.test.ts

key-decisions:
  - "reasonCategory Zod enum uses UPPER_SNAKE_CASE matching the Prisma WaivedReasonCategory enum (value written straight to the column); waivedReason='ADMIN_MANUAL_WAIVE' matches the existing WaivedReason enum casing — NOT the plan template's lowercase"
  - "Added COMPLIANCE_ITEM_NOT_FOUND / COMPLIANCE_ITEM_ALREADY_WAIVED i18n-key error constants in errors.ts (camelCase keys) per the codebase convention — plan template's hardcoded 'Item is already WAIVED' would break the i18n-key pattern"
  - "Rewrote the override+audit-trail tests onto the canonical createCallerFactory(appRouter) harness — the plan's minimal classificationRouter.createCaller mock cannot load the router (pre-existing test-infra requires prismaRaw/getIdpAuditLogger/organization mocks + flag enablement)"

patterns-established:
  - "actorRoleSnapshot in audit metadata is role-only (best-effort from ctx.session), never PII (T-73-03-03)"

requirements-completed: [COMPL-01]

duration: 70 min
completed: 2026-06-01
---

# Phase 73 Plan 03: Compliance Auth Resource + Override Mutation + Audit Trail Summary

**compliance:read/override permission with per-role grants, an atomic compliance.overrideItem mutation (status→WAIVED + forensic AuditLog in one transaction), and an org-scoped compliance.itemAuditTrail History query — all Wave 0 scaffolds GREEN.**

## Performance

- **Duration:** 70 min
- **Tasks:** 7
- **Files modified:** 7 (1 created, 6 modified)

## Accomplishments
- compliance resource in accessControlStatement; read+override→owner/admin, read→6 roles, none→it_admin/platform_operator
- overrideItem: tenantProcedure + requirePermission(compliance:override) + $transaction(item update + writeAuditLog), previousStatus pre-read, role-only actor snapshot
- itemAuditTrail: org+contractor scoped, partial-GIN-backed metadataJson.itemId filter, defence-in-depth item-org check
- i18n-key error constants; auth test 6 GREEN, override test 7 GREEN, audit-trail test 3 GREEN; monorepo typecheck 0; lint:audit-log clean for my files

## Task Commits

1. **Tasks 73-03-01..07** - `007b7297` (feat)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Standards] UPPER_SNAKE enum literals in Zod + WaivedReason value**
- reasonCategory Zod enum and `waivedReason: 'ADMIN_MANUAL_WAIVE'` use UPPER_SNAKE to match the Prisma enums (the value is written into the column). Plan template used lowercase. Committed in `007b7297`.

**2. [Rule 2 - Standards] i18n-key error constants, not hardcoded strings**
- Added COMPLIANCE_ITEM_NOT_FOUND/COMPLIANCE_ITEM_ALREADY_WAIVED to errors.ts (camelCase i18n keys) per the codebase tRPC-error convention; mutation/query reference the constants. Plan template hardcoded English messages.

**3. [Rule 1 - Bug] Test harness rewrite**
- Plan's `classificationRouter.createCaller` mock could not load the flag-gated router (needs prismaRaw, getIdpAuditLogger, organization.findUnique, feature-flag enablement). Rewrote both tests onto the proven createCallerFactory(appRouter) harness from routers/__tests__/classification.test.ts.

---

**Total deviations:** 3 auto-fixed (2 Rule 2 standards, 1 Rule 1 bug).
**Impact:** All required for correctness + the codebase standards the user confirmed. No scope creep.

## Issues Encountered
- Router-caller tests load the full appRouter, so the db package dist must be rebuilt (`pnpm --filter @contractor-ops/db build`) after schema changes for the API typecheck to see the new client types — done in 73-02 follow-up.

## User Setup Required
None.

## Next Phase Readiness
- 73-06 (admin dashboard) consumes compliance.itemAuditTrail for the History timeline + compliance.overrideItem for the override modal (via 73-08).
- 73-08 wires the override modal + History timeline UI onto these procedures.

---
*Phase: 73-f1-compliance-admin-dashboard-portal-self-service-i18n*
*Completed: 2026-06-01*
