---
phase: 91-theme-b-akta-osobowe-personnel-file
verified: 2026-07-01T14:45:00Z
status: gaps_found
score: 2/4 must-haves fully verified (2 backend-verified but UI-orphaned)
overrides_applied: 0
gaps:
  - truth: "A RODO/GDPR erasure request honors erasure only past the retention window and flags blocked sections with a statutory citation (never claims full erasure during a hold)."
    status: partial
    reason: "Backend (personnelFile.requestErasure) is fully correct, tested, and legally honest (fullErasureClaimed = retained.length===0). But the staff-facing PersonnelErasureDialog component that lets a human actually trigger and see this flow is never imported/mounted anywhere in the app (route, page, or shell) — it exists only in its own file and a unit test. A staff user has no way to reach the erasure flow through the product."
    artifacts:
      - path: "apps/web-vite/src/components/employees/personnel-file/personnel-erasure-dialog.tsx"
        issue: "PersonnelErasureDialog (and ErasureResultView) exported but never imported outside this file except by its own component test. Not mounted in personnel-file-shell.tsx, personnel-file.tsx page, or any route."
    missing:
      - "Mount <PersonnelErasureDialog workerId={...} jurisdiction={...} /> into personnel-file-shell.tsx (or the page) so an HR admin can actually request erasure from the personnel-file screen, per 91-11's own plan and human-verify checkpoint script."
  - truth: "A document uploaded to the file is auto-classified to section A/B/C/D; an ambiguous document triggers an admin classify step."
    status: partial
    reason: "Backend classifier (classifyPersonnelDocument) + router (attachDocument/classifyApprove/classifyReject/pendingReviewQueue) is fully correct and tested — taxonomy-first, killswitch-gated AI fallback, PENDING_REVIEW admin routing, never blocks upload. But the admin classify-review queue UI (PersonnelClassifyQueuePanel / data-table.tsx / personnel-classify-review-dialog.tsx) is never imported/mounted on any route or page — there is no reachable 'admin classify step' surface in the product."
    artifacts:
      - path: "apps/web-vite/src/components/employees/personnel-file/personnel-classify-queue/data-table.tsx"
        issue: "Exports PersonnelClassifyQueuePanel; zero imports anywhere else in apps/web-vite/src (checked via grep across the whole app, router, and pages trees)."
      - path: "apps/web-vite/src/components/employees/personnel-file/personnel-classify-queue/personnel-classify-review-dialog.tsx"
        issue: "Only imported by data-table.tsx itself (same orphaned subtree); no admin route registers it."
    missing:
      - "Register an admin/compliance route that mounts PersonnelClassifyQueuePanel so HR/compliance can actually review and approve/reject PENDING_REVIEW personnel documents."
---

# Phase 91: Theme B — Akta Osobowe / Personnel File Verification Report

**Phase Goal:** Each employee has a jurisdiction-correct personnel file with section-level access control, statutory retention, and RODO-defensible erasure.
**Verified:** 2026-07-01T14:45:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

(ROADMAP.md Success Criteria for Phase 91, verbatim, merged with PLAN.md frontmatter must_haves — no scope reduction.)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | An employee file presents a 4-section structure (PL cz. A/B/C/D per KP §94; DE Personalakte / UK personnel file / US I-9+file equivalents) with per-section RBAC. | ✓ VERIFIED | Schema (`personnel.prisma`: `PersonnelFile`/`PersonnelFileDocument`/`PersonnelFileSection` enum), RBAC (`packages/auth/src/permissions.ts` `employeeFileA..D`; `roles.ts` 4-HR-role matrix — `payroll_officer` gets C read-only not B; `owner`'s `allPermissions` deliberately excludes all 4 sections), router (`personnel-file/read.ts` `hasSectionPermission` gates BEFORE any doc query, locked section carries no document payload), UI (4-section shell mounted at `employees/:workerId/personnel-file` route, 5 states incl. conspicuous Locked card). Behavioral test `personnel-file-rbac-router.test.ts` (3/3 passing) proves payroll_officer sees B locked/C readable, hr_admin sees B unlocked, owner sees all 4 locked. |
| 2 | Retention is enforced per jurisdiction (PL 10yr post-2019 / 50yr legacy, DE 10yr tax / 30yr accident, UK 6yr / 7yr financial, US I-9 3yr-post-hire-or-1yr-post-termination). | ✓ VERIFIED | 8 akta tokens registered on the shared `RETENTION_YEARS` map (`packages/db/src/retention-policy.ts`) with exact stated years; event-anchored resolver `getPersonnelRetentionCutoff` (HIRE_DATE\|TERMINATION_DATE\|DOCUMENT_DATE + max() combinator for US I-9 + fail-closed indefinite-while-active). Both deletion chokepoints route personnel rows: `soft-delete.ts` (`softDeleteModels` includes PersonnelFile/PersonnelFileDocument) and `apps/cron-worker/data-purge.ts` (per-row anchor-driven exclusion, children-before-parents). UI retention panel + per-section retention chip mounted and reachable in the shell. Tests: `personnel-retention.test.ts` (11/11), `personnel-registry.test.ts` (9/9) passing. |
| 3 | A RODO/GDPR erasure request honors erasure only past the retention window and flags blocked sections with a statutory citation (never claims full erasure during a hold). | ✗ FAILED (backend verified, UI orphaned) | `personnelFile.requestErasure` (`erasure.ts`) is correct and legally honest: `fullErasureClaimed: Object.keys(retainedUnderStatute).length === 0`, per-section disposition list, audit row `personnel_file.erasure_retained_under_statute` written in-tx on any hold. `personnel-erasure.test.ts` passes (13 total router tests incl. this). BUT `PersonnelErasureDialog` (the only UI surface designed to invoke this) is never imported outside its own file — not mounted in the shell, the page, or any route. No staff user can reach the erasure flow through the product. |
| 4 | A document uploaded to the file is auto-classified to section A/B/C/D; an ambiguous document triggers an admin classify step. | ✗ FAILED (backend verified, UI orphaned) | `classifyPersonnelDocument` (taxonomy → killswitch-gated AI → admin) + `classify.ts` router (`attachDocument`/`classifyApprove`/`classifyReject`/`pendingReviewQueue`, tenant-scoped, audited) are correct and tested (`personnel-classifier.test.ts` passing; `killswitch.ai-personnel-classifier` declared in `flags-core.ts`, default-on + killWhenUnknown). BUT `PersonnelClassifyQueuePanel` (`personnel-classify-queue/data-table.tsx`) and its review dialog are never imported/mounted on any route — confirmed via exhaustive grep of `apps/web-vite/src/router` and `apps/web-vite/src/pages`. There is no reachable "admin classify step" in the product. |

**Score:** 2/4 truths fully verified end-to-end (backend + reachable UI); 2/4 verified at the backend/API layer only — their designated staff-facing UI exists, is substantive (330+204 LOC), tests pass in isolation, but is never wired into any route/page (confirmed ORPHANED, not STUB).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/db/prisma/schema/personnel.prisma` | PersonnelFile + PersonnelFileDocument + enums | ✓ VERIFIED | Tenant-owning, 1:1 `workerId @unique`, `documentId @unique`, hireDate/terminatedAt seams present |
| `packages/db/src/tenant.ts` (globalModels) | PersonnelFile/PersonnelFileDocument absent | ✓ VERIFIED | Confirmed absent from `globalModels` set; `personnel-file-tenant-isolation.test.ts` passes (cross-org read → `null`) |
| `packages/db/prisma/schema/worker.prisma` | `personnelFile PersonnelFile?` back-relation | ✓ VERIFIED | Line 35 |
| Generated Prisma client (`packages/db/src/generated/prisma`) | PersonnelFile types exposed, committed | ✓ VERIFIED | `models/PersonnelFile.ts` present and git-tracked (`a6f203b69`) |
| `packages/db/prisma/schema/migrations/__personnel_file_additive/` | additive migration + down.sql | ✓ VERIFIED (DB push deferred, per Standing Constraint) | Authored, not yet applied to a live Postgres (no local :5432) — explicitly recorded post-merge item in 91-02 SUMMARY, matching prior-phase deferral pattern (85-01, 89-02, 89-03). NOT a gap per verification context. |
| `packages/compliance-policy/src/personnel-registry.ts` + `personnel-types.ts` | section taxonomy + retention-rule registry, register-on-import | ✓ VERIFIED | Files consolidated from the plan's proposed `personnel-sections.ts`/`personnel-retention-rules.ts` naming into one `personnel-registry.ts` — functionally equivalent, all exports present (`getPersonnelSections`, `getPersonnelRetentionRules`, `resolveSectionForDocumentType`), PL/DE/UK/US baseline seeded, adviser-verify annotated |
| `packages/db/src/retention-policy.ts` + `personnel-retention.ts` | 8 akta tokens + event-anchored resolver | ✓ VERIFIED | `getPersonnelRetentionCutoff` with max() + indefinite-while-active fail-closed logic |
| `packages/auth/src/permissions.ts` + `roles.ts` | employeeFileA..D resources + 4-HR-role matrix + BFLA fence | ✓ VERIFIED | owner's `allPermissions` explicitly and deliberately omits all 4 section resources (commented invariant) |
| `packages/feature-flags/src/flags-core.ts` | killswitch.ai-personnel-classifier | ✓ VERIFIED | default-on, killWhenUnknown, non-gated |
| `packages/api/src/services/personnel-classifier.ts` | classifyPersonnelDocument | ✓ VERIFIED | Hybrid taxonomy→killswitch→AI→admin routing, injected seams, never throws/blocks |
| `packages/api/src/routers/core/personnel-file/{read,section-access,classify,erasure,index}.ts` | full router surface | ✓ VERIFIED | All 5 files present, substantive, tenant-scoped, audited, permission-layer-gated |
| `packages/api/src/root.ts` | personnelFile mounted in workforceRouters (flag-gated) | ✓ VERIFIED | `module.workforce-employees` gate confirmed |
| `apps/web-vite/.../personnel-file-shell.tsx` + section-card + retention-panel + `hooks/use-personnel-file.ts` | 4-section shell, 5 states, sole tRPC boundary | ✓ VERIFIED + WIRED | Route `employees/:workerId/personnel-file` registered in `router/dashboard-routes.tsx`; page → shell → hook → `personnelFile.getFile`; locked card renders no document body/count |
| `apps/web-vite/.../personnel-erasure-dialog.tsx` | erasure confirm + criterion-#3 banner | ⚠️ ORPHANED | Substantive (204 LOC), correct `fullErasureClaimed` branching, but never imported outside its own file + test — not reachable in the app |
| `apps/web-vite/.../personnel-classify-queue/data-table.tsx` + review-dialog | admin classify review queue | ⚠️ ORPHANED | Substantive (330+204 LOC), correct hook wiring, but never imported/mounted on any route |
| `packages/validators/src/legal/personnel-file.ts` (+ index.ts re-export) | PERSONNEL_FILE_RETENTION_ADVISER_VERIFY_* locked phrases | ✓ VERIFIED | `locked-phrases-guard.test.ts` 102/102 passing |
| `.planning/brain/wiki/domains/personnel-file.md` + MEMORY.md invariants | wiki tracks the code | ✓ VERIFIED | Domain page substantive (Purpose/Flow/RBAC/Retention/Erasure/Classifier/UI); 3 invariants recorded in MEMORY.md; `hot.md` updated; `pnpm check:wiki-brain` green (0 errors) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `root.ts` | `personnelFileRouter` | `workforceRouters` spread, flag-gated | ✓ WIRED | Confirmed |
| `personnel-file/read.ts` | `hasSectionPermission` | per-section gate before query | ✓ WIRED | Confirmed — locked sections never fetch document rows into the response payload for hidden sections' documents array |
| `apps/cron-worker/data-purge.ts` | `getPersonnelRetentionCutoff` | per-row anchor-driven exclusion | ✓ WIRED | Confirmed, children-before-parents ordering present |
| `personnel-file/erasure.ts` | `getPersonnelRetentionCutoff` + `writeAuditLog` | per-section disposition + in-tx audit | ✓ WIRED | Confirmed |
| `personnel-file/classify.ts` | `classifyPersonnelDocument` | attachDocument invokes hybrid classifier | ✓ WIRED | Confirmed |
| `use-personnel-file.ts` | `personnelFile.getFile` | sole tRPC boundary | ✓ WIRED | Confirmed, no tRPC leakage into presentational components |
| `personnel-file-shell.tsx` / any route | `PersonnelErasureDialog` | mount | ✗ NOT_WIRED | Zero references outside the component's own file + its test |
| any admin/compliance route | `PersonnelClassifyQueuePanel` | mount | ✗ NOT_WIRED | Zero references outside the component's own subtree |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `use-personnel-file.ts` → section cards | `fileQuery.data.sections` | `ctx.db.personnelFileDocument.findMany` (real Prisma query, tenant-scoped) | Yes | ✓ FLOWING |
| `read.ts` retention posture | `sectionRetention(...)` | `getPersonnelRetentionCutoff` fed by real `file.hireDate`/`terminatedAt` + representative document dates from DB rows | Yes | ✓ FLOWING |
| `erasure.ts` dispositions | `dispositions[]` | Same resolver, real per-section DB rows inside a transaction | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

Skipped — no local running server available; this is API/unit-test territory for this phase (all relevant suites executed directly, see below), not a curl/CLI-checkable runtime.

### Probe Execution

No `scripts/*/tests/probe-*.sh` declared or discovered for this phase (not a migration/CLI-tooling phase). Skipped.

### Test Suite Results (executed directly by the verifier, not taken from SUMMARY claims)

| Suite | Command | Result |
|-------|---------|--------|
| api: rbac-router + tenant-isolation + erasure + classifier | `npx vitest run` (4 files) | 13/13 passed |
| auth: personnel-file-rbac | `npx vitest run` | 24/24 passed |
| db: personnel-retention | `npx vitest run` | 11/11 passed |
| compliance-policy: personnel-registry | `npx vitest run` | 9/9 passed |
| validators: locked-phrases-guard | `npx vitest run` | 102/102 passed |
| web-vite: personnel-file components | `npx vitest run` | 6/6 passed |
| `pnpm --filter @contractor-ops/api typecheck` | | 0 errors |
| `pnpm --filter @contractor-ops/db typecheck` | | 0 errors |
| `pnpm --filter @contractor-ops/auth typecheck` | | 0 errors |
| `pnpm --filter @contractor-ops/compliance-policy typecheck` | | 0 errors |
| `pnpm --filter @contractor-ops/feature-flags typecheck` | | 0 errors |
| `pnpm --filter @contractor-ops/validators typecheck` | | 0 errors |
| `pnpm --filter @contractor-ops/cron-worker typecheck` | | 0 errors (after `pnpm install` refreshed a stale workspace symlink for `@contractor-ops/compliance-policy` — lockfile was already correct and unmodified; this was a local-environment-only staleness, not a source gap) |
| `pnpm --filter @contractor-ops/web-vite typecheck` | | 1 pre-existing error in `classification-tile.tsx:55` — confirmed Phase 87 (Theme A/US classification) territory, not touched by any phase-91 file (per verification context and `deferred-items.md` 91-10 entry) |
| `pnpm check:wiki-brain` | | 0 errors, 1 warning (multiple source_commit prefixes — expected/normal) |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|-----------------|--------------|--------|----------|
| AKTA-01 | 91-02, 91-03, 91-04, 91-07, 91-10 | 4-section personnel file with per-section RBAC | ✓ SATISFIED | Schema + RBAC + router + UI all verified and reachable |
| AKTA-02 | 91-03, 91-05, 91-07, 91-10 | Per-jurisdiction retention engine | ✓ SATISFIED | Shared map + event-anchor resolver + both chokepoints + UI panel verified and reachable |
| AKTA-03 | 91-09, 91-11 | RODO/GDPR erasure with statutory-hold exemption | ⚠️ PARTIALLY SATISFIED | Backend logic fully correct and tested; staff-facing UI to invoke it is not mounted anywhere reachable |
| AKTA-04 | 91-06, 91-08, 91-11 | Document upload auto-classification + admin classify-step | ⚠️ PARTIALLY SATISFIED | Backend classifier + router fully correct and tested; admin review-queue UI is not mounted anywhere reachable |

No orphaned requirements found — all 4 AKTA IDs are claimed by at least one plan's `requirements` frontmatter and cross-referenced correctly in `.planning/REQUIREMENTS.md` (lines 102-105, 297-300).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web-vite/src/components/employees/personnel-file/personnel-erasure-dialog.tsx` | whole file | Substantive component, zero mount points | 🛑 Blocker | Core AKTA-03 delivery surface unreachable by any user |
| `apps/web-vite/src/components/employees/personnel-file/personnel-classify-queue/*.tsx` | whole files | Substantive components, zero mount points | 🛑 Blocker | Core AKTA-04 admin delivery surface unreachable by any user |
| `packages/api/src/errors.ts` | 458-461 | `PERSONNEL_FILE_NOT_FOUND`, `PERSONNEL_FILE_DOCUMENT_NOT_FOUND`, `PERSONNEL_DOCUMENT_ALREADY_ATTACHED`, `PERSONNEL_DOCUMENT_NOT_PENDING_REVIEW` have zero i18n translations in any of en/de/pl/ar `messages/*.json` | ⚠️ Warning | Degrades gracefully — the personnel-file UI hooks use a static generic `t('toast.error')` on mutation failure rather than `useTranslatedError`, so no crash/raw-key leak occurs, but this is inconsistent with the project's i18n-parity convention and the (separately, pre-existingly broken) `errors-i18n-parity.test.ts` gate |
| No `TBD`/`FIXME`/`XXX` markers found in any phase-91-touched file | — | — | — | Debt-marker gate clean |

No fabricated/hardcoded-empty data patterns found in any phase-91 file; all data flows trace to real Prisma queries (Level 4 confirmed FLOWING).

### Human Verification Required

None beyond the gaps above, which are objectively confirmed via grep/import-graph analysis (not matters of visual taste or real-time behavior) — routed as gaps, not human-verify items.

### Gaps Summary

The backend/API layer of this phase is exceptionally solid: schema, tenant isolation, per-section RBAC with a correctly-preserved BFLA fence, the shared-retention-map extension with a correct event-anchored `max()` resolver, both soft-delete/purge chokepoints, the hybrid classifier with a fail-safe kill-switch, and the per-section statutory-hold erasure with the criterion-#3 legal-honesty invariant are all implemented exactly as locked, fully tested (13+24+11+9+102+6 = 165 tests executed directly by this verifier, all green), and typecheck-clean across every touched package.

However, two of the four ROADMAP success criteria (RODO erasure and document classify-step) require a **staff-reachable UI**, and the phase explicitly planned, built, and tested that UI (`PersonnelErasureDialog`, `PersonnelClassifyQueuePanel` + review dialog) in plan 91-11 — but **never mounted either component into any route, page, or shell**. This was self-documented as a "follow-up" in both the 91-11 SUMMARY and the 91-12 (phase-closing, documentation) SUMMARY, and the 91-11 human-verify checkpoint that was designed to catch exactly this (its own script says "open an employee's personnel file... Click 'Request erasure'... In the classify queue, Approve one and Reject one") was AUTO-APPROVED in background/autonomous mode with no human actually driving a browser — so the gap was never caught before being marked complete. A staff user today can see the 4-section file and its retention posture, but cannot request erasure or clear the classify-review queue anywhere in the product; those actions exist only as directly-callable tRPC procedures.

This looks like an intentional (if under-communicated) deferral rather than faked work — every SUMMARY that touches it says so plainly. If the team wants to accept this as a tracked follow-up rather than closing it now, add an override to this file's frontmatter for both gaps with `accepted_by`/`accepted_at`. Otherwise, the fix is small and mechanical: mount `<PersonnelErasureDialog>` in `personnel-file-shell.tsx` (or the page), and register+mount an admin/compliance route for `PersonnelClassifyQueuePanel`.

---

*Verified: 2026-07-01T14:45:00Z*
*Verifier: Claude (gsd-verifier)*
