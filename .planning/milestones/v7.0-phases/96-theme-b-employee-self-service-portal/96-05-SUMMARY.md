---
phase: 96-theme-b-employee-self-service-portal
plan: 05
subsystem: api
tags: [portal, employee-portal, akta, personnel-file, paystub, self-view, idor]
requirements: [EMP-PORTAL-02]
dependency_graph:
  requires:
    - phase: 96-01
      provides: "PERSONNEL_FILE_SELF_VIEW_SECTIONS allowlist + isSelfViewableSection"
    - phase: 96-04
      provides: "portalEmployeeRouter (the namespace these procedures merge into)"
    - phase: 96-03
      provides: "the RED net portal-akta-selfview / portal-paystub-unavailable"
  provides:
    - "portalEmployee.getMyAkta — own personnel file filtered to PERSONNEL_FILE_SELF_VIEW_SECTIONS (section C excluded in the query), grouped by section"
    - "portalEmployee.getMyAktaDocumentUrl — lazy presigned download, re-checks own-file + allowlist before signing"
    - "portalEmployee.getPayStubAvailability — truthful { available:false, reason:'EXTERNAL_PAYROLL' } read model"
  affects:
    - "96-07 (employee dashboard UI consumes the akta view + pay-stub empty state)"
tech_stack:
  patterns:
    - "the self-view allowlist is applied IN the document `where` (`section: { in: [...PERSONNEL_FILE_SELF_VIEW_SECTIONS] }`) so an excluded section's rows never read — section decided before fetch, not fetch-then-hide"
    - "the akta list returns download-safe metadata (no storageKey); the presigned URL is minted lazily by getMyAktaDocumentUrl, which re-asserts own-file + allowlist before signing"
    - "getPayStubAvailability is a forward-compatible read model — a future payslip surface flips available:true + a list without changing the contract"
key_files:
  created:
    - "packages/api/src/routers/portal/portal-employee-akta.ts"
  modified:
    - "packages/api/src/routers/portal/portal-employee-router.ts"
    - ".planning/brain/wiki/structure/api-routers-catalog.md"
decisions:
  - "getMyAkta groups by the FULL section enum ('SECTION_A' …) — the RED test asserts the enum name, and SECTION_C never appears because it is not in PERSONNEL_FILE_SELF_VIEW_SECTIONS. All three self-viewable sections (A, B, D) are returned in fixed order, even when empty, for a stable UI structure."
  - "The list does NOT presign download URLs (the akta-selfview test does not mock regional-storage, and pre-signing every row is wasteful). A dedicated getMyAktaDocumentUrl mints a short-lived URL on demand, re-checking own-file + the section allowlist so a documentId for an excluded section or another worker is never signed."
  - "The akta upload (requestAktaUpload/confirmAktaUpload) noted as 're-grouped into 96-05' in the 96-04 summary was NOT built: the 96-05 PLAN.md carries no upload task and no RED test drives it, and an untested document-write into the most legally-sensitive surface (which section? employees cannot classify) would invent an unspecified contract in a security-first phase. Deferred — see Notes."
requirements_completed: []
completed: 2026-07-05
---

# Phase 96 Plan 05: Employee akta self-view + pay-stub availability

**Built the two bespoke-entitlement read surfaces (EMP-PORTAL-02): the employee's own personnel-file view (own file, section-allowlist filtered — section C/pay+PII excluded in the query) plus a lazy presigned download, and a truthful pay-stub availability read model — flipping the 96-03 `portal-akta-selfview` and `portal-paystub-unavailable` RED tests GREEN.**

## Accomplishments

- **`getMyAkta`** — resolves the caller's `PersonnelFile` by `{ workerId: ctx.workerId, organizationId }`, then queries its documents with `where: { section: { in: [...PERSONNEL_FILE_SELF_VIEW_SECTIONS] } }` so section C's rows are never read; groups into the self-viewable sections (A, B, D) with download-safe document metadata (id, documentId, fileName, mimeType, sizeBytes, uploadedAt). No client `workerId`/`section` — the input is `.strict().optional()` empty, so a smuggled key is a hard rejection.
- **`getMyAktaDocumentUrl`** — on-demand presigned download that re-checks the requested documentId against the caller's own file AND the self-view allowlist before signing (`createRegionalPresignedDownloadUrl`); an excluded-section or foreign documentId is `NOT_FOUND`.
- **`getPayStubAvailability`** — returns `{ available: false, reason: 'EXTERNAL_PAYROLL' }`; a forward-compatible model for the UI empty state (payroll is export-only in v7.0; no payslip surface exists to fabricate a stub from).
- Both merged into `portalEmployeeRouter` via `...portalEmployeeAktaProcedures` (`portal-employee-akta.ts`), inheriting the dark-mount + per-request flag gate.

## Verification

- `pnpm typecheck --filter=@contractor-ops/api` — 0 errors (17/17 tasks).
- `pnpm --filter @contractor-ops/api test portal-akta-selfview portal-paystub-unavailable` — 3/3 GREEN (SECTION_A returned, SECTION_C never, `payslip-A.pdf` never serialized; client workerId/section rejected; `{ available:false, reason:'EXTERNAL_PAYROLL' }`).
- No regression: `portal-employee-idor portal-timeoff-request` still 9/9 GREEN.
- `pnpm lint:no-breadcrumbs` — the new file is clean (no phase/plan/req IDs in comments).
- Wiki: `structure/api-routers-catalog.md` `portalEmployee` row extended with the three procedures + the akta section-filtering invariant. The employee-portal domain page + full refresh pipeline (BM25/graph) land in 96-09.

## Notes / deviations

- **Akta upload deferred.** The 96-04 summary noted the upload was "re-grouped into 96-05", but the 96-05 PLAN.md has no upload task and no RED test drives it. Building an untested write into the akta requires an unspecified contract (target section — employees cannot self-classify; PENDING vs a fixed section; whether admin re-classification is required) that belongs in its own tested plan. Flagged rather than guessed, per "narrow scope or ask". The read/download surface (the tested EMP-PORTAL-02 scope) is complete.
- **List is unsigned by design** — presigned URLs are minted per-click via `getMyAktaDocumentUrl`, which keeps the list cheap and re-enforces the ownership + section fence at download time.
