# Phase 86 — Deferred Items (out of scope, discovered during execution)

## Plan 86-02

- **Pre-existing enum-casing audit failure in `packages/db/prisma/schema/idp-deprovisioning.prisma`**
  - `db:audit-enum-casing` flags `enum ManualOverrideCategory` values `transient_provider_issue_resolved` and `other` (lower_snake, not UPPER_SNAKE).
  - This file is clean (not modified by plan 86-02) and was last touched in Phase 76 (`6afe07244`). The five new enums added by this plan (`Form1099Status`, `IrisAckStatus`) all pass the audit.
  - Out of scope per the SCOPE BOUNDARY rule — only auto-fix issues directly caused by the current task's changes.

- **Pre-existing `pnpm lint:no-breadcrumbs` failures in Plan 86-01 Wave-0 RED test scaffolds**
  - 23 breadcrumb comments flagged across `packages/api/src/services/__tests__/{iris-ack-parser,tax-filing-transmitter,tin-match.service}.test.ts` (decision/wave/req IDs in comments).
  - These files were committed in `93431e58c test(86-01)` — not touched by plan 86-02. None of plan 86-02's files are flagged.
  - Out of scope; should be cleaned up under plan 86-01's follow-up or a code-review pass.
