---
plan: 64-03
phase: 64-legal-compliance-hardening
status: complete
commit: da4ad9ef
completed_at: 2026-04-26
---

# Plan 64-03: Prisma Schema Models

## What Was Built

Added `DRV_DECISION_LETTER` enum value to `ClassificationDocumentKind`. Added `ClassificationEscalationEvent` model with `EscalationVerdict` and `EscalationTriggerKind` enums (append-only, indexed for compliance reporting). Added `SdsApproval` model with `@unique` on `assessmentId` and `approvalStatementSnapshot` field frozen at approval time. Added `ConsentEvent` model with `ConsentEventScope` enum (TOS scope) to `consent.prisma` for ToS re-acceptance tracking, separate from PDPL `ConsentRecord`. Added `expertReferralEmail` nullable field to `Organization` model. Added all required back-relations on `ClassificationAssessment`, `Organization`, and `User` models. Ran `prisma db push --accept-data-loss` — all new tables and enum values applied to Neon EU pooler successfully.

## Key Files Modified

- `packages/db/prisma/schema/classification.prisma` — DRV_DECISION_LETTER + ClassificationEscalationEvent + SdsApproval + back-relations
- `packages/db/prisma/schema/consent.prisma` — ConsentEvent model + ConsentEventScope enum
- `packages/db/prisma/schema/organization.prisma` — expertReferralEmail field + back-relations
- `packages/db/prisma/schema/auth.prisma` — User back-relations for escalation events, SDS approvals, consent events

## Database Push

`prisma db push --accept-data-loss` completed in 6.33s against Neon EU (`ep-spring-meadow-al06qnru-pooler.c-3.eu-central-1.aws.neon.tech`). `--accept-data-loss` required for pre-existing unique constraint additions on PaymentRun and ReminderInstance (from Phase 63), not from Phase 64 changes.

## Manual-Only Verifications

None required.

## Self-Check: PASSED

- ClassificationEscalationEvent model with EscalationVerdict + EscalationTriggerKind enums ✓
- SdsApproval model with @unique on assessmentId ✓
- ClassificationDocumentKind.DRV_DECISION_LETTER ✓
- ConsentEvent model with ConsentEventScope.TOS ✓
- Organization.expertReferralEmail nullable field ✓
- Back-relations on ClassificationAssessment (escalationEvents, sdsApproval) ✓
- Back-relations on Organization (classificationEscalationEvents, sdsApprovals, consentEvents) ✓
- Back-relations on User (classificationEscalationEvents, sdsApprovals, consentEvents) ✓
- prisma generate: ✓ Generated Prisma Client (v7.7.0) ✓
- prisma db push: 🚀 Your database is now in sync ✓
