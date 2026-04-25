---
phase: 64-legal-compliance-hardening
status: passed
verified_at: "2026-04-26T01:45:00.000Z"
plans_verified: 9
must_haves_checked: 42
must_haves_passed: 42
human_verification:
  - item: "Legal sign-off for all 12 disclaimer keys in signoff-registry.json (all PENDING) — defer to post-deploy"
  - item: "Verify TosReacceptanceModal renders correctly in browser when user lacks ConsentEvent"
  - item: "Verify classification routes return 404 in browser when flag is OFF"
  - item: "Verify advisory banner is non-scrollable/sticky on classification pages in browser"
  - item: "Verify DRV decision letter upload with real PDF file in browser"
  - item: "Verify SDS approval gate UI renders and approveSds mutation fires correctly"
  - item: "Verify admin/feature-flags/classification-engine page renders correctly for super-admin"
---

# Verification — Phase 64: Legal Compliance Hardening

## Phase Goal

Classification features (Phases 58-60) are completely inaccessible when the feature flag is disabled — no routes, no sidebar entries, no API endpoints, no data leakage — and when enabled after legal sign-off, all screens clearly communicate advisory-only status with escalation paths.

## Automated Checks

### LEGAL-01: Disclaimer signoff registry infrastructure
- [x] `signoff-registry.json` exists with 12 keys all PENDING
- [x] `SignoffRegistrySchema` validates registry at module load (fail-fast)
- [x] `getAllPending()` returns 12 keys
- [x] `isAllApproved()` returns false (all PENDING — correct initial state)
- [x] 779/779 validators tests pass (including 14 Phase 64 registry guard tests)

### LEGAL-02: CI production deploy gate
- [x] `legal-gate-production` job in `.github/workflows/ci.yml` — only runs on main branch push
- [x] CODEOWNERS entry for `signoff-registry.json` requiring `@contractor-ops/legal-platform`

### LEGAL-03: Non-dismissible advisory banner
- [x] `ClassificationAdvisoryBanner` exists at `apps/web/src/components/classification/advisory-banner.tsx`
- [x] `role="note"` for accessibility
- [x] Amber palette (bg-amber-50/border-amber-400/text-amber-900)
- [x] No close button (non-dismissible)
- [x] Jurisdiction-aware (GB→IR35 EN, DE/AT→Schein DE)
- [x] `'use client'` directive is first statement (fixed CR-01)

### LEGAL-04: Escalation events + Get Expert Help page
- [x] `logEscalation` mutation exists in classification router using `classificationProcedure`
- [x] `onAmberVerdictMounted` callback in VerdictBanner fires once via `useRef` guard
- [x] `expert-help/page.tsx` exists with CIOT/HMRC + Steuerberaterkammer/DRV links
- [x] `rel="noopener noreferrer"` on all external links
- [x] `expertReferralEmail` optional org card rendered with `!!` coercion
- [x] `SOFTWARE_NOT_LEGAL_ADVICE` locked phrase on expert-help page

### LEGAL-05: SDS approval gate
- [x] `SDS_NOT_APPROVED` guard in `generateSds` (PRECONDITION_FAILED)
- [x] `approveSds` mutation stores `SDS_APPROVAL_STATEMENT_EN` snapshot
- [x] `@unique` on `SdsApproval.assessmentId` (one approval per assessment)
- [x] CONFLICT thrown on duplicate (P2002 catch)
- [x] SDS approval gate UI in `generate-sds-button.tsx` (checkbox + clientName input)
- [x] SDS cover page in `ir35-sds.tsx` when `approvalData` prop present

### LEGAL-06: DRV decision letter upload
- [x] `uploadDrvDecisionLetter` mutation with MIME magic-byte validation
- [x] 10MB file size cap enforced server-side
- [x] `DRV_DECISION_LETTER` enum value in `ClassificationDocumentKind`
- [x] `DRV_UNVERIFIED_ENTRY_DISCLAIMER_DE` banner in `drv-clearance-panel.tsx`
- [x] Upload dropzone with `accept=".pdf,.jpg,.jpeg,.png"`

### LEGAL-07: ToS + software-not-legal-advice
- [x] `terms/page.tsx` includes `SOFTWARE_NOT_LEGAL_ADVICE_EN/DE` blockquote section
- [x] `TosReacceptanceModal` non-dismissible (ESC disabled, click-outside disabled, no close button)
- [x] `trpc.consent.recordToS` called on I Accept
- [x] Dashboard layout checks `consentEvent.findFirst` with `TOS_CURRENT_VERSION`
- [x] Modal only rendered when `needsTosAcceptance` is true
- [x] `TOS_CURRENT_VERSION = '2026.1.0'` in `tos.ts`

### LEGAL-08: Classification feature flag kill-switch (API + route + sidebar)
- [x] `module.classification-engine` in FLAGS registry (default: false, jurisdiction: ANY)
- [x] `classificationProcedure` middleware throws FORBIDDEN/CLASSIFICATION_ENGINE_DISABLED
- [x] All 7 classification tRPC routers use `classificationProcedure` (coverage test: 9/9 pass)
- [x] Both classification cron routes return `{ skipped: true, reason: 'FLAG_OFF' }`
- [x] Three classification layout.tsx files call `notFound()` when flag is off
- [x] `FeatureGate` RSC component returns null (not CSS hidden) when flag is off
- [x] Classification nav item has `flag: 'module.classification-engine'`

### LEGAL-09: Conditional root.ts registration
- [x] `CLASSIFICATION_ENABLED` conditional spread in `appRouter`
- [x] All 8 classification routers absent from appRouter when flag is OFF
- [x] `classificationProcedure` middleware provides defense-in-depth when ON

### LEGAL-10: Super-admin flag status page
- [x] Page exists at `admin/feature-flags/classification-engine/page.tsx`
- [x] Shows app-side evaluated flag value (per-request evaluation)
- [x] Signoff registry table shows all 12 keys with status
- [x] Actionable override banner when flag ON but PENDING disclaimers block it
- [x] No Unleash credentials exposed (UNLEASH_URL/UNLEASH_API_TOKEN: 0 occurrences)
- [x] Read-only (no toggle/mutation buttons)

## Test Results

| Package | Test Files | Tests | Status |
|---------|-----------|-------|--------|
| validators | 38 | 779 | PASS |
| feature-flags | 2 | 30 | PASS |

## Manual-Only Verifications

Per Standing Project Constraints (app is LOCAL-ONLY, legal sign-off deferred):

1. **Legal sign-off** — All 12 disclaimer keys in `signoff-registry.json` remain PENDING. Post-deploy: submit PR updating each key to APPROVED with approvedBy/approvedAt/approverRole. Requires `@contractor-ops/legal-platform` CODEOWNERS review.

2. **TosReacceptanceModal browser test** — Verify modal renders on dashboard load when user lacks ConsentEvent with current TOS_CURRENT_VERSION. Click "I accept" and confirm modal dismisses.

3. **Classification route 404 test** — With flag OFF (default), verify `/classification`, `/contractors/[id]/classification`, and `/contractors/[id]/engagements/[id]/classification/[id]` return 404.

4. **Advisory banner non-dismissible test** — With flag ON, verify banner appears on all classification pages and has no close button.

5. **DRV upload browser test** — Upload a real PDF, verify MIME magic-byte check and 10MB cap work correctly.

6. **SDS approval gate browser test** — Verify approval checkbox gate renders and approveSds mutation fires before generateSds.

7. **Admin status page test** — Verify `/admin/feature-flags/classification-engine` renders correctly for super-admin with correct PENDING counts.

## Code Review Notes

1 critical issue (CR-01) was found and immediately fixed: `'use client'` directive placement in `verdict-banner.tsx`. See `64-REVIEW.md` for full review report including 3 warnings and 2 info findings (non-blocking).
