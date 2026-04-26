# Phase 71: F1 Compliance — Policy Package + Schema + Classification Reconcile - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

A new contractor whose engagement is classified as IR35 / Scheinselbständigkeit / cross-border immediately gets the correct per-jurisdiction document set materialised as `ContractorComplianceItem` rows; existing rows survive policy rotation (preserved as WAIVED, never deleted); admins can manually trigger a drift recompute mirroring the v5.0 `recreateDraftAfterDrift` pattern. Per-jurisdiction expiry boundaries resolve in the contractor's jurisdiction TZ, not the org HQ TZ.

This phase delivers the **policy registry, schema additions, and reconcile-on-classification logic** for F1 Compliance. The reminder cascade and payment-block enforcement are Phase 72; the admin dashboard + portal self-service + i18n are Phase 73. Legal verification of per-jurisdiction document text is DEFERRED per Standing Project Constraints (LOCAL-ONLY, legal review post-deploy).

</domain>

<decisions>
## Implementation Decisions

### Policy registry shape & versioning
- **D-01:** New `@contractor-ops/compliance-policy` workspace package with a typed TS const tree. One sub-module per jurisdiction (`policies/uk.ts`, `policies/de.ts`, `policies/pl.ts`, `policies/uae.ts`, `policies/ksa.ts`). Imported at compile time by the classification router. Matches Phase 70 D-02 (typed constants) and Phase 70 D-09 (parallel-package pattern from `feature-flags/signoff-registry-flags.ts`).
- **D-02:** `policyRuleId` is a stable semantic ID + monotonic version: `'uk.right_to_work@v3'`. Stored as a single string column. Stable namespace (`uk.right_to_work`) survives policy text revisions; `@vN` suffix bumps on every legal-text revision. Drift detection compares stored version against the registry's current version per stable namespace.
- **D-03:** Registry exports `POLICY_RULE_SET_VERSION` as a single const matching the package semver (e.g. `'v6.0.0'`). Persisted on `ClassificationAssessment.policyRuleSetVersion` so `recreateComplianceAssessment` can compare snapshot-then vs registry-now in O(1). Mirrors the v5 `RULE_SET_VERSION` pattern.
- **D-04:** All initial registry entries ship `PENDING` in `signoff-registry-flags.ts`. The `compliance-policy-engine` flag stays PENDING until post-deploy legal review. Engineers develop and test against the seeds locally via `FLAG_SIGNOFF_BYPASS=local` (Phase 70 D-10's LOCAL-ONLY bypass). This honors the Standing Constraint that legal review is DEFERRED.

### ContractorComplianceItem schema additions
- **D-05:** New `severity` enum on `ContractorComplianceItem`: `BLOCKING | WARNING | INFO` (3-tier).
  - **BLOCKING** drives Phase 72's hard-payment-block (UK Right-to-Work missing, A1 expired).
  - **WARNING** surfaces in Phase 73's admin dashboard but does not block payment.
  - **INFO** is a record-only entry visible in audit reports.
- **D-06:** `policyRuleId String?` (nullable) — value-checked at write time against the registry. No DB-level FK (registry lives in TS code per D-01). Validation lives in the classification router pre-insert.
- **D-07:** `expiryJurisdictionTz String?` (nullable) — IANA TZ string (e.g. `'Asia/Riyadh'`, `'Europe/London'`, `'Europe/Berlin'`). Set at row-creation time from the engagement's jurisdiction (UK Right-to-Work → `'Europe/London'`; KSA Iqama → `'Asia/Riyadh'`). Never retroactively rewritten. Boundary computation: `dayjs.tz(expiresAt, expiryJurisdictionTz).startOf('day')`. Satisfies success criterion #2 (Riyadh contractor's "expires today" resolves at 00:00 Asia/Riyadh).
- **D-08:** Migration is two-step:
  - Step 1 (this phase, schema plan): all three columns added as NULLABLE in the same Prisma migration.
  - Step 2 (this phase, follow-up backfill plan): once policy registry seed lands, idempotent backfill re-runs classification logic over each contractor's last assessment to populate the three new columns.
  - Idempotent — backfill can resume after partial failure (skip rows where `policyRuleId IS NOT NULL`).

### Policy rotation / supersession semantics
- **D-09:** When `policyRuleSetVersion` bumps, existing rows are **WAIVED, never deleted**.
  - Old row: `status = WAIVED`, new column `waivedReason = 'superseded_by_policy_version'`.
  - New row: inserted referencing the new `policyRuleId@v(N+1)`.
  - Admin dashboard (Phase 73) groups by stable namespace (`uk.right_to_work`) so the 'one card per requirement' UX stays clean across versions.
- **D-10:** On `classification_outcome_change` (UK B2B → IR35 inside, DE selbständig → ABHANGIG, etc.), supersession is **synchronous in the same transaction as the assessment write**.
  - When `submitClassification` writes a new `ClassificationAssessment` with a different outcome than the previous, the same transaction (a) marks all existing `ContractorComplianceItem` rows for that contractor as WAIVED with `waivedReason = 'classification_outcome_change'`, (b) inserts the new outcome's policy-rule-set materialised rows.
  - Atomic: a contractor never has rows from two outcomes simultaneously. Mirrors v5 `recreateDraftAfterDrift`'s transactional pattern.
- **D-11:** New closed enum `WaivedReason` on `ContractorComplianceItem`:
  - `superseded_by_policy_version` (D-09)
  - `classification_outcome_change` (D-10)
  - `admin_manual_waive` (existing UX path — admin clicks "Waive this requirement")
  - `contractor_offboarded` (Phase 74/75 will fire this on offboarding completion)
  - Strong type at the DB level, greppable in audit queries, prevents free-text drift. New `waivedReason` column nullable (only populated when status = WAIVED).
- **D-12:** Document carry-forward on supersession:
  - If the new policy rule's `documentType` matches the old rule's `documentType` (e.g. UK Right-to-Work `@v2 → @v3` both use `DocumentType.SHARE_CODE`), the new row is inserted with `status = SATISFIED` and `satisfiedByDocumentId` copied from the old row.
  - If `documentType` differs, the new row is inserted with `status = MISSING`.
  - Avoids forcing a contractor to re-upload identical documents for a non-substantive policy version bump.

### Admin drift recompute UX
- **D-13:** `recreateComplianceAssessment(contractorIds: string[], reason: ReasonEnum)` is exposed at two trigger points:
  - **Per-contractor:** "Recompute compliance" button on the contractor profile's Compliance tab (single contractor).
  - **Bulk:** Admin selects contractors via checkbox on the contractors-list page, runs the action against the selection.
  - Both call the same tRPC mutation. **No org-wide 'recompute everyone' button** — blast radius too large for a manual action.
- **D-14:** `reason` is required, closed enum: `policy_version_bump` | `classification_outcome_change` | `admin_correction`.
  - First two cover backfill of legacy rows or cases where auto-supersession (D-09/D-10) was bypassed.
  - `admin_correction` covers ad-hoc cases (e.g. contractor's jurisdiction was wrong, fixed after assessment).
  - Required field — no anonymous recomputes.
- **D-15:** Audit log: **single `AuditLog` entry per recompute invocation** (not per affected row).
  - `actor`: admin user
  - `action`: `compliance.recompute`
  - `target`: contractor id or list of ids
  - `payload`: structured object with `reason`, `policyRuleSetVersionBefore`, `policyRuleSetVersionAfter`, and a list of affected `ContractorComplianceItem` deltas (id + before-status + after-status + before-policyRuleId + after-policyRuleId).
  - Single entry per admin click — clean replay story. Reuses existing `audit_log` infrastructure (no new table).
- **D-16:** Idempotent via pre-check guard.
  - At mutation entry: for each contractor in the input, if existing rows reference the current `POLICY_RULE_SET_VERSION` AND the contractor's classification outcome hasn't changed, return `noop: true` for that contractor without writing.
  - Bulk recompute can resume after partial failure without double-processing already-correct contractors.
  - Mirrors v5 `recreateDraftAfterDrift`'s `PRECONDITION_FAILED if ruleSetVersion still matches`.

### Claude's Discretion
- Exact IANA TZ string per jurisdiction document (Researcher should pin from authoritative sources during research phase — `Europe/London`, `Europe/Berlin`, `Europe/Warsaw`, `Asia/Dubai`, `Asia/Riyadh`).
- Exact policy text wording — DEFERRED to legal review post-deploy. Researcher should provide draft text only; production wording lands via PRs that flip individual `signoff-registry-flags.ts` entries to APPROVED with a `legalTicketRef`.
- Exact UI copy for the "Recompute compliance" button + confirm dialog — Phase 73 owns the dashboard polish; this phase ships functional UI only.
- Exact bulk-action interaction model on the contractors-list page (selection toolbar shape, confirm-modal copy) — match the existing patterns from the contractor list view.
- Exact `dayjs.tz` library choice (or `Temporal` polyfill, or `date-fns-tz`) — Researcher to pin against existing codebase patterns; whichever the codebase already uses for the `expiresAt` pre-existing field.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Schema baseline (extension target for D-05 to D-12)
- `packages/db/prisma/schema/contractor.prisma` — existing `ContractorComplianceItem` model + `ComplianceStatus` enum (MISSING/PENDING/SATISFIED/EXPIRED/WAIVED). New columns (`severity`, `policyRuleId`, `expiryJurisdictionTz`, `waivedReason`) plug in here; new enums (`Severity`, `WaivedReason`) added to the same schema.

### v5 sibling pattern (the model for D-13 to D-16)
- `packages/api/src/routers/classification.ts` — `recreateDraftAfterDrift` mutation (~ line 289). Phase 71's `recreateComplianceAssessment` should mirror its transactional shape, idempotency guard, and audit-log pattern.

### Classification engine (consumer of the policy registry)
- `packages/classification/src/registry.ts` — profile registry that resolves classification outcomes to rule-sets
- `packages/classification/src/profiles/ir35/rule-set.ts` — IR35 outcome rules (existing v5)
- `packages/classification/src/profiles/scheinselbstandigkeit/rule-set.ts` — DE Scheinselbständigkeit rules (existing v5)
- `packages/classification/src/snapshot.ts` — pattern for snapshotting rule-set version onto persisted assessments

### Phase 70 dependencies
- `packages/feature-flags/src/signoff-registry-flags.ts` — Phase 70 D-09..12 parallel signoff registry; new `compliance-policy-engine.<jurisdiction>` entries plug in here per D-04
- `packages/feature-flags/src/registry.ts` — flag registry; `compliance-*` namespace is the gated namespace from Phase 70 D-11
- Phase 70 `FLAG_SIGNOFF_BYPASS=local` env var — engineers use this to develop against PENDING entries (LOCAL-ONLY)

### Audit log infrastructure (D-15)
- Existing `audit_log` Prisma table (locate during research) — Phase 71 emits a single entry per recompute invocation; do NOT introduce a new table.

### TZ handling (D-07)
- Whichever date-with-TZ library the codebase already uses for `expiresAt`-style fields (likely `date-fns-tz` or `dayjs/plugin/timezone` — Researcher to pin) — used to compute `dayjs.tz(expiresAt, expiryJurisdictionTz).startOf('day')`.

### Multi-region constraints
- `packages/db/scripts/push-all-regions.ts` — schema migration must apply to EU + ME regions; both regions must be on the same `POLICY_RULE_SET_VERSION` after deploy. Multi-region apply is a manual post-deploy step per Standing Constraint (LOCAL-ONLY).

### Standing constraints (LOCAL-ONLY, legal DEFERRED)
- `.planning/STATE.md` "Standing Project Constraints" — legal verification of per-jurisdiction text is DEFERRED to post-deploy. Phase 71 ships the *engine*; the *legal copy* is verified PR-by-PR via `signoff-registry-flags.ts` updates.

### ROADMAP entry (success criteria source-of-truth)
- `.planning/ROADMAP.md` "Phase 71: F1 Compliance — Policy Package + Schema + Classification Reconcile" — 4 numbered success criteria, plus 12-document baseline list (UK RTW 90-day, UK UTR, DE A1 24-month, DE Aufenthaltstitel, DE §48b EStG construction-only, PL ZUS A1 12-month, PL UDT, KSA Iqama 1-year, KSA work permit + Qiwa-auth boolean, UAE Emirates ID, UAE free-zone trade license).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`packages/db/prisma/schema/contractor.prisma`** (`ContractorComplianceItem`, `ComplianceStatus`) — schema baseline; this phase adds 4 nullable columns (`severity`, `policyRuleId`, `expiryJurisdictionTz`, `waivedReason`) + 2 enums (`Severity`, `WaivedReason`). No DROP/RENAME.
- **`packages/api/src/routers/classification.ts`** — v5 `recreateDraftAfterDrift` is the architectural twin of the new `recreateComplianceAssessment`. Reuse: transaction shape, idempotency precondition, audit-log emit pattern.
- **`packages/classification/src/snapshot.ts`** — already snapshots rule-set version onto assessments. The new `policyRuleSetVersion` column on `ClassificationAssessment` follows the same snapshot-on-write pattern.
- **`packages/feature-flags/src/signoff-registry-flags.ts`** — Phase 70 D-09 parallel signoff registry; D-04 plugs `compliance-policy-engine.<jurisdiction>` entries in here as PENDING.
- **`@contractor-ops/db` workspace exports** — re-export the new `Severity` + `WaivedReason` enums + `ScopeCapabilities`-style types if needed by the policy package.

### Established Patterns
- **Typed-constants over runtime config** (Phase 70 D-02) — policy registry follows this; no DB seed data, no JSON files, no env-var config.
- **Parallel package shape for distinct concerns** (Phase 70 D-09) — `@contractor-ops/compliance-policy` is independent of `@contractor-ops/feature-flags` and `@contractor-ops/classification`, even though it consumes both.
- **WAIVED preserved, never deleted** (D-09) — strict audit-trail discipline already established by `ContractorComplianceItem.status = WAIVED` semantics in v5.
- **Transactional mutations for state changes that span multiple tables** (v5 `recreateDraftAfterDrift`) — the new `submitClassification` supersession path (D-10) and `recreateComplianceAssessment` (D-13) both follow this.
- **Idempotency via precondition guard, not via locks** (v5 `recreateDraftAfterDrift`) — D-16 follows this.
- **Multi-region migrations via `push-all-regions.ts`** (Phase 70 manual post-deploy) — schema migration in this phase carries the same Standing Constraint.

### Integration Points
- **`packages/api/src/routers/classification.ts` `submitClassification`** — D-10 wires the supersession-on-outcome-change branch INSIDE this mutation's transaction. Existing callers don't change; the mutation gains internal logic.
- **`packages/api/src/routers/classification.ts`** — new mutation `recreateComplianceAssessment` lives next to `recreateDraftAfterDrift` (parallel sibling).
- **`packages/db/prisma/schema/contractor.prisma`** schema migration adds 4 columns + 2 enums. Migration must run against both regions per Standing Constraint.
- **`packages/feature-flags/src/signoff-registry-flags.ts`** — D-04 adds 12 PENDING entries (one per jurisdiction-document pair).
- **Web UI**: contractor profile's Compliance tab gains a "Recompute compliance" button; contractors-list page gains a bulk action. Both call the same tRPC mutation. Phase 73 will polish the dashboard surface; this phase ships the functional buttons only.
- **Existing audit_log infrastructure** — `recreateComplianceAssessment` emits a single entry per invocation (D-15); no new audit table.

</code_context>

<specifics>
## Specific Ideas

- The 12-document baseline list from ROADMAP defines the initial registry shape (UK Right-to-Work 90-day, UK UTR, business-registration, SDS; DE A1 24-month, Aufenthaltstitel, §48b EStG construction-only; PL ZUS A1 12-month, UDT; KSA Iqama 1-year, work-permit + Qiwa-auth boolean; UAE Emirates ID, free-zone trade license).
- Each entry's IANA TZ comes from the jurisdiction (`Europe/London` for UK, `Europe/Berlin` for DE, `Europe/Warsaw` for PL, `Asia/Riyadh` for KSA, `Asia/Dubai` for UAE).
- Each entry needs a `legalTicketRef` placeholder (`PENDING`) in `signoff-registry-flags.ts` per D-04.
- The `recreateComplianceAssessment` UI surface should match the existing v5 `recreateDraftAfterDrift` UI in tone — admin-only, confirmation dialog, brief loading state, success toast with affected-row count.
- Bulk recompute affected-count should be displayed in the confirm dialog before the user commits — admins want to know how many rows they're about to touch.

</specifics>

<deferred>
## Deferred Ideas

- **Org-wide "recompute everyone" button** — too much blast radius for a manual admin action; rejected in D-13. Could be revisited later as a maintenance script (with explicit dry-run + count-only mode), not as a UI button.
- **Distributed lock for concurrent recomputes** — the existing codebase doesn't have a Redis-locking pattern beyond `IntegrationConnection.refreshLockedAt`. Introducing it for a manual admin action is over-engineering. Revisit if production telemetry shows concurrent-admin race conditions.
- **DB-snapshotted policy registry** (TS source-of-truth + build-time `PolicyRule` table) — rejected in D-01. Revisit if v7+ needs runtime policy editing through the admin UI; not now.
- **Free-text reason for recompute** — rejected in D-14 (closes the audit-queryability hole). Could revisit if the closed enum becomes too rigid in practice.
- **One audit-log entry per affected row** (vs single entry per invocation) — rejected in D-15 for log-flooding reasons. Revisit if compliance audits demand row-level granularity (the structured payload in the single entry already carries the deltas, so this would be a denormalisation, not a new requirement).

</deferred>

---

*Phase: 71-f1-compliance-policy-package-schema-classification-reconcile*
*Context gathered: 2026-04-27*
