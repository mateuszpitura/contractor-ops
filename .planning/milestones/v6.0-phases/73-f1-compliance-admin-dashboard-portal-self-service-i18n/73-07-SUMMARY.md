---
phase: 73-f1-compliance-admin-dashboard-portal-self-service-i18n
plan: 07
subsystem: ui
tags: [portal, web-vite, trpc, upload, r2, compliance, COMPL-04]

requires:
  - phase: 73-02
    provides: DocumentStatus.PENDING_REVIEW
  - phase: 73-05
    provides: defaultExpiryFromUploadDate
  - phase: 73-06
    provides: useComplDocName shared hook
provides:
  - portal.complianceItems query + portal.submitUploadReplacement mutation (portalRouter)
  - /portal/compliance list + /portal/compliance/upload-replacement flow + home banner
affects: [73-08]

tech-stack:
  added:
    - "@contractor-ops/compliance-policy as a web-vite dependency (browser-safe; for defaultExpiryFromUploadDate auto-fill)"
  patterns:
    - "portal mutations live on portalRouter (portalAppRouter) — the portal tRPC client cannot reach the staff appRouter/classification router"
    - "Document has no contractorId column — portal upload ownership asserted via DocumentLink (entityType CONTRACTOR + entityId = ctx.contractorId)"

key-files:
  created:
    - apps/web-vite/src/pages/portal/compliance.tsx
    - apps/web-vite/src/pages/portal/compliance-upload-replacement.tsx
    - apps/web-vite/src/components/portal/compliance/portal-compliance-container.tsx
    - apps/web-vite/src/components/portal/compliance/portal-compliance-list.tsx
    - apps/web-vite/src/components/portal/compliance/portal-upload-replacement-container.tsx
    - apps/web-vite/src/components/portal/compliance/portal-upload-replacement-form.tsx
    - apps/web-vite/src/components/portal/compliance/hooks/use-portal-compliance.ts
    - apps/web-vite/src/components/portal/compliance/hooks/use-portal-upload-replacement.ts
    - apps/web-vite/src/components/portal/portal-home-compliance-banner.tsx
  modified:
    - packages/api/src/routers/portal/portal.ts
    - apps/web-vite/src/router/portal-routes.tsx
    - apps/web-vite/src/components/portal/portal-index-container.tsx
    - apps/web-vite/messages/{en,de,pl,ar}.json
    - apps/web-vite/package.json
    - packages/compliance-policy/src/index.ts (export defaultExpiryFromUploadDate)

key-decisions:
  - "submitUploadReplacement placed on portalRouter (not classification.ts as the plan said) — portalAppRouter is the only router the portal client reaches; the staff classification router is unreachable from a portal session"
  - "Document ownership scoped via DocumentLink (entityType=CONTRACTOR, entityId=ctx.contractorId) because the Document model has no contractorId column"
  - "added @contractor-ops/compliance-policy as a web-vite dep (no node-only imports) so the upload-replacement container computes the auto-fill expiry client-side"

patterns-established:
  - "portal upload-replacement flow: portal.getUploadUrl -> R2 PUT -> portal.submitUploadReplacement"

requirements-completed: [COMPL-04]

duration: 90 min
completed: 2026-06-01
---

# Phase 73 Plan 07: Contractor Portal Compliance Self-Service Summary

**Portal /compliance list + one-click upload-replacement flow (DropZone -> R2 -> PENDING_REVIEW) + home attention banner, over a portalRouter-scoped backend (portal.complianceItems + submitUploadReplacement); Wave 0 scaffolds GREEN.**

## Performance

- **Duration:** 90 min
- **Tasks:** 9
- **Files modified:** 22 (compliance-policy barrel export incl.)

## Accomplishments
- Backend: portal.complianceItems + portal.submitUploadReplacement (PENDING_REVIEW + audit, item-status-stable, DocumentLink ownership); 7 API tests GREEN via portalAppRouter caller
- UI: list/container/form/banner + upload-replacement hook (R2 chain); auto-filled editable expiry; disabled-until-file submit; home banner mounted
- Portal.compliance.* i18n in 4 locales (parity clean); 7 form/banner tests GREEN; typecheck + 3 web-vite gates clean

## Task Commits

1. **Tasks 73-07-01..09** - `f8e616dc` (feat)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 4-adjacent / Rule 1] submitUploadReplacement on portalRouter, not classification.ts**
- The plan placed the portal mutation in classification.ts (staff appRouter). The portal tRPC client only reaches portalAppRouter (portal + portalTime). Moved the mutation to portalRouter so the portal client can call it (`portal.submitUploadReplacement`); the API test uses the portalAppRouter caller.

**2. [Rule 1] DocumentLink ownership check** — Document has no contractorId column; scoped the status update via DocumentLink (entityType CONTRACTOR + entityId = portal contractor) instead of a non-existent Document.contractorId filter.

**3. [Rule 3] compliance-policy added as web-vite dep + defaultExpiryFromUploadDate barrel export** — needed for the client-side auto-fill expiry; verified browser-safe (no node imports).

**4. [Rule 1] buttonVariants on Link** — web-vite Button has no `asChild`; styled the Renew-now Link with buttonVariants.

---

**Total deviations:** 4 auto-fixed. The router placement (1) is the notable one — a correctness fix for the portal/staff router split. No scope creep.

## Issues Encountered
- None beyond the router-split discovery.

## User Setup Required
None.

## Deferred Verification
- Manual UAT (LOCAL-ONLY): portal EXPIRED item -> home banner -> /portal/compliance -> Renew now -> upload PDF -> auto-filled expiry -> submit -> Document PENDING_REVIEW + item unchanged until admin approves (73-08).

## Next Phase Readiness
- 73-08 builds the admin approve/reject of these PENDING_REVIEW uploads + the override modal + Compliance tab wiring.

---
*Phase: 73-f1-compliance-admin-dashboard-portal-self-service-i18n*
*Completed: 2026-06-01*
