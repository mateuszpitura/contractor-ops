# Phase 91 — Deferred / Out-of-Scope Items

## 91-02 execution

- **Pre-existing `db:audit-enum-casing` offenders (NOT introduced by 91-02):**
  `prisma/schema/idp-deprovisioning.prisma` enum `ManualOverrideCategory` has 5
  lowercase values (`verified_via_vendor_console`, `user_already_inactive`,
  `provider_endpoint_deprecated`, `transient_provider_issue_resolved`, `other`).
  These pre-date this plan (Phase 76 idp-deprovisioning) and cause the whole
  `db:audit-enum-casing` script to exit non-zero. Out of scope for 91-02 (SCOPE
  BOUNDARY: only auto-fix issues directly caused by this task). The 91-02 enums
  (`PersonnelFileSection` SECTION_A..D, `PersonnelDocClassificationMethod`
  DETERMINISTIC/AI/MANUAL/PENDING) are correct UPPER_SNAKE and are absent from the
  offender list.
