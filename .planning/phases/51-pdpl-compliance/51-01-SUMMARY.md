---
phase: 51-pdpl-compliance
plan: 01
subsystem: database, api
tags: prisma, consent, privacy, pdpl, zod

requires:
  - phase: 47
    provides: Organization.countryCode field
provides:
  - ConsentRecord Prisma model (append-only, immutable)
  - PrivacyNotice Prisma model (jurisdiction+version unique)
  - ConsentPurpose enum (6 purposes)
  - Zod consent validators (grantConsentSchema, bulkGrantConsentSchema, consentQuerySchema)
  - PDPL jurisdiction detection (isPdplJurisdiction, PDPL_JURISDICTIONS)
  - Privacy notice service (getPrivacyNotice, getDefaultNoticeContent, createPrivacyNotice)
  - Consent record service (grantConsent, revokeConsent, getCurrentConsent, getConsentHistory, hasRequiredConsents, bulkGrantConsent)
affects: [consent-router, legal-document-generation, onboarding-consent-step, settings-privacy-tab]

tech-stack:
  added: []
  patterns: [append-only immutable records (ConsentRecord), jurisdiction-specific content templates]

key-files:
  created:
    - packages/db/prisma/schema/consent.prisma
    - packages/validators/src/consent.ts
    - packages/api/src/services/privacy-notice.ts
    - packages/api/src/services/consent-record.ts
    - packages/api/src/services/__tests__/consent-record.test.ts
    - packages/api/src/services/__tests__/privacy-notice.test.ts
  modified:
    - packages/db/prisma/schema/organization.prisma
    - packages/db/prisma/schema/auth.prisma
    - packages/validators/src/index.ts

key-decisions:
  - "ConsentRecord follows AuditLog immutable pattern — no updatedAt, revocations create new records"
  - "6 consent purposes: contractor data, invoices, analytics, cross-border, integrations, communications"
  - "3 required purposes block onboarding; 3 optional purposes can be managed later"
  - "Privacy notices auto-created from jurisdiction defaults (UAE/Saudi) when first requested"

patterns-established:
  - "Append-only consent: grant/revoke creates new records, current state is latest per purpose"
  - "Jurisdiction detection: isPdplJurisdiction(countryCode) checks AE/SA"

requirements-completed: [PDPL-01, PDPL-02]

duration: 12min
completed: 2026-04-11
---

# Phase 51 Plan 01: Consent Schema, Privacy Notice Service & Consent Record Service

**Established PDPL consent infrastructure with Prisma models, Zod validators, and backend services supporting append-only consent tracking and jurisdiction-specific privacy notices for UAE and Saudi Arabia.**

## What was built

1. **Prisma schema** (`consent.prisma`): ConsentRecord (append-only, indexed for audit queries) and PrivacyNotice (jurisdiction+version unique constraint) models with ConsentPurpose enum.

2. **Zod validators** (`consent.ts`): Purpose enum mirror, required/optional purpose classification, PDPL jurisdiction detection, and input schemas for grant/bulk/query operations.

3. **Privacy notice service**: Returns jurisdiction-specific notices for AE (UAE Federal Decree-Law No. 45/2021) and SA (Royal Decree M/19). Auto-creates defaults from templates. Cached via existing Redis cache-aside pattern.

4. **Consent record service**: Grant, revoke (append-only), current state query, history query, required consent check, and bulk grant operations. Version auto-increments per (org, user, purpose) tuple.

5. **Tests**: 17 tests covering all service functions — grant, revoke, current state, history, required consent validation, bulk operations, version incrementing, and privacy notice generation.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED
