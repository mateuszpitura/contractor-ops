---
phase: 51-pdpl-compliance
plan: 02
subsystem: api
tags: trpc, consent, rbac, sensitive-action

requires:
  - phase: 51
    provides: consent-record service, privacy-notice service, consent validators
provides:
  - Consent tRPC router (consentRouter) with 7 endpoints
  - Privacy notice query (getPrivacyNotice)
  - User consent CRUD (getCurrentConsent, grant, bulkGrant, getConsentHistory, hasRequiredConsents)
  - Admin consent audit (adminGetUserConsent, adminGetUserConsentHistory)
affects: [onboarding-consent-step, settings-privacy-tab, legal-document-download]

tech-stack:
  added: []
  patterns: [sensitiveActionProcedure for consent mutations, IP/UA extraction from headers]

key-files:
  created:
    - packages/api/src/routers/consent.ts
    - packages/api/src/routers/__tests__/consent.test.ts
  modified:
    - packages/api/src/root.ts

key-decisions:
  - "Consent mutations use sensitiveActionProcedure requiring recent session"
  - "Admin endpoints scope to org via tenantProcedure + requirePermission settings:read"
  - "Map converted to plain object for tRPC serialization"
  - "IP and User-Agent extracted from headers for consent audit trail"

patterns-established:
  - "extractClientInfo helper for getting IP/UA from request headers"

requirements-completed: [PDPL-01, PDPL-02]

duration: 8min
completed: 2026-04-11
---

# Phase 51 Plan 02: Consent tRPC Router & API Endpoints

**Created consent tRPC router exposing 7 endpoints for privacy notice retrieval, per-purpose consent management, and admin audit, all protected by tenant isolation and RBAC.**

## What was built

1. **Consent router** (`consent.ts`): Registered in appRouter with 7 endpoints covering the full consent lifecycle.

2. **User endpoints**: getPrivacyNotice (jurisdiction-aware), getCurrentConsent, grant/revoke (single purpose), bulkGrant (onboarding flow), hasRequiredConsents, getConsentHistory.

3. **Admin endpoints**: adminGetUserConsent and adminGetUserConsentHistory with settings:read RBAC.

4. **Security**: All mutations use sensitiveActionProcedure. IP address and user agent captured from request headers for audit trail.

5. **Tests**: 10 integration tests covering all endpoints, proper mocking of services and middleware.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED
