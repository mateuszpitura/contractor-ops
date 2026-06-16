---
phase: 85-theme-a-w-form-intake-tax-treaty-engine
plan: 03
subsystem: api
tags: [w-form, w-9, w-8ben, tax-treaty, portal, esign, immutable-record, idor, rbac, feature-flag, tdd]

# Dependency graph
requires:
  - phase: 85-01
    provides: "TaxFormSubmission model + TaxFormType/TaxFormStatus enums + WithholdingTaxRate.treatyArticle + US treaty seed rows (live on DB)"
  - phase: 85-02
    provides: "applyTreaty/resolveTreatyDecision (treaty rate + article), determineFormType (W-9/W-8BEN/W-8BEN-E routing), taxFormSubmissionSchema (discriminated union, no full-SSN field)"
provides:
  - "Portal W-form self-cert surface (portal.getTaxFormDetermination/saveTaxFormDraft/submitTaxForm/getMyTaxForms) — IDOR-scoped, server-derived ESIGN attestation, append-only supersede, audited, flag-gated"
  - "tax-form.service: buildFormSnapshot (PII-safe immutable record) + supersedeAndInsert (append-only re-cert) + computeExpiry"
  - "Staff taxForm.listFormSubmissions/requestTaxForm read-track surface — status only, no full-SSN leak, contractor:read gated"
  - "module.us-expansion gate: assertUsExpansionEnabled per-request guard + isUsExpansionRegistered boot gate + root.ts conditional-spread"
affects: ["Phase 85 Plan 04 (wizard UI consumes getTaxFormDetermination + submitTaxForm)", "Phase 86 (1099-NEC reads the immutable W-9 snapshot)", "Phase 87 (1042-S reads the W-8 treaty claim)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Immutable record-of-record: server-built signed JSON snapshot is the legal artifact; official IRS PDF deferred to the filing phase"
    - "Append-only supersede chain: re-cert flips prior ACTIVE → SUPERSEDED then inserts new ACTIVE in one $transaction; signed rows never mutated in place"
    - "Defense-in-depth feature gating: conditional-spread at root.ts assembly + per-request flag guard (portal flat-merge self-gates, staff belt-and-braces)"
    - "Server-derived attestation: ESIGN ip/actorId/signedAt from session+headers, never client body (forgery-proof identity)"
    - "PII-strip-on-write: snapshot builder recursively drops full-SSN keys, keeps last-4 reference only"

key-files:
  created:
    - "packages/api/src/services/tax-form.service.ts"
    - "packages/api/src/services/__tests__/tax-form.service.test.ts"
    - "packages/api/src/routers/portal/portal-tax-form-router.ts"
    - "packages/api/src/routers/core/tax-form-router.ts"
    - "packages/api/src/middleware/require-us-expansion-flag.ts"
    - "packages/api/src/routers/portal/__tests__/tax-form.test.ts"
    - "packages/api/src/routers/core/__tests__/tax-form-staff.test.ts"
  modified:
    - "packages/api/src/root.ts (conditional-spread taxForm behind module.us-expansion)"
    - "packages/api/src/routers/portal/portal.ts (merge portalTaxFormRouter)"
    - "packages/api/src/routers/core/index.ts (export taxFormRouter)"
    - "packages/api/src/errors.ts (US_EXPANSION_DISABLED)"

key-decisions:
  - "Staff read/track lives on a NEW dedicated taxForm router (conditionally spread behind module.us-expansion) rather than extending the always-mounted taxRouter — only a separate namespace can be flag-gated at assembly time"
  - "Dropped unused TAX_FORM_NOT_FOUND/TAX_FORM_NOT_DRAFT error exports — the append-only invariant is structural (saveDraft only ever finds/updates DRAFT rows; supersedeAndInsert never updates a signed row), so a non-DRAFT reject path would be unreachable dead code"
  - "Snapshot param tightened to Prisma.InputJsonValue for clean router wiring"

patterns-established:
  - "Immutable signed-snapshot record (D-05/D-06/D-11) reused by the filing phases"
  - "module.us-expansion gate idiom for the whole US cross-border surface"

requirements-completed: [US-FORM-01, US-FORM-02, US-LOC-02, US-LOC-03]

# Metrics
duration: ~40min
completed: 2026-06-16
---

# Phase 85 Plan 03: W-Form Intake Routers + Immutable Record Service Summary

**Portal-primary W-9/W-8BEN/W-8BEN-E self-certification: IDOR-scoped portal procedures build a server-signed immutable JSON snapshot (ESIGN attestation, full SSN stripped to last-4), resolve the treaty claim, append-only supersede the prior cert, and audit — all flag-gated behind `module.us-expansion`; staff get a read/track-only mirror.**

## Performance

- **Duration:** ~40 min (this session; Task 1 RED/GREEN was committed in a prior interrupted session and verified here)
- **Completed:** 2026-06-16T15:14:00Z
- **Tasks:** 3
- **Files modified:** 11 (7 created, 4 modified) + 8 wiki/planning files

## Accomplishments

- **tax-form.service** — `buildFormSnapshot` embeds the captured fields + server-derived ESIGN attestation block + resolved treaty claim and recursively strips any full-SSN/TIN key (last-4 reference survives); `supersedeAndInsert` flips the prior ACTIVE row to SUPERSEDED and inserts the new ACTIVE row in the caller's `$transaction` (append-only — signed rows never mutated); `computeExpiry` returns ~3yr for W-8 forms, null for W-9.
- **portal-tax-form-router** — `getTaxFormDetermination` (routes the form + auto-populates the treaty article/rate), `saveTaxFormDraft` (DRAFT-only upsert), `submitTaxForm` (validate → resolve treaty → build snapshot → supersede → insert → CONTRACTOR audit, one transaction), `getMyTaxForms` (status/expiry, snapshot never projected). Every read/write scoped to `ctx.contractorId` + `ctx.organizationId`; the attestation IP is derived from `ctx.headers` server-side.
- **staff taxForm router** — `listFormSubmissions` (status/track columns only, no full SSN) + `requestTaxForm` (USER audit, no signed record); `contractor:read` gated; the full-SSN reveal stays on the existing `contractor.revealSsn` (`contractorPii:read`).
- **module.us-expansion gate** — `assertUsExpansionEnabled` per-request guard (FORBIDDEN when off) + `isUsExpansionRegistered` boot gate; `root.ts` conditionally spreads the staff `taxForm` namespace, the portal procedures self-gate per request (the flat portal merge cannot be conditionally spread).
- **25 scoped integration/unit tests GREEN** proving immutability, supersede, PII non-leak, ESIGN capture, W-8BEN-E LOB+article, IDOR, staff RBAC, and flag gating.

## Task Commits

1. **Task 1: tax-form.service (snapshot + supersede + expiry)** — `584b97b6d` (test, RED) → `2351c6ed3` (feat, GREEN) *(committed in the prior interrupted session; verified GREEN here)*
2. **Task 2: portal router + staff taxForm router + flag gating** — `7ea70eb45` (feat)
3. **Task 3: staff read/track integration test** — `59089f023` (test)

_Task 2's portal behavior test (`tax-form.test.ts`) was authored alongside the router and landed in `7ea70eb45`; Task 3 adds the staff-side integration file._

## Files Created/Modified

- `packages/api/src/services/tax-form.service.ts` — immutable snapshot builder + append-only supersede + expiry calc; PII-strip on write
- `packages/api/src/services/__tests__/tax-form.service.test.ts` — snapshot/expiry/supersede unit tests (9)
- `packages/api/src/routers/portal/portal-tax-form-router.ts` — portal self-cert procedures (4)
- `packages/api/src/routers/core/tax-form-router.ts` — staff read/track procedures (2)
- `packages/api/src/middleware/require-us-expansion-flag.ts` — `assertUsExpansionEnabled` + `isUsExpansionRegistered`
- `packages/api/src/routers/portal/__tests__/tax-form.test.ts` — portal integration tests (8)
- `packages/api/src/routers/core/__tests__/tax-form-staff.test.ts` — staff integration tests (8)
- `packages/api/src/root.ts` — conditional-spread `taxForm` behind `module.us-expansion`
- `packages/api/src/routers/portal/portal.ts` — merge `portalTaxFormRouter`
- `packages/api/src/routers/core/index.ts` — export `taxFormRouter`
- `packages/api/src/errors.ts` — `US_EXPANSION_DISABLED`
- Wiki (doc-follows-code, same change set): `domains/portal-external.md`, `structure/api-routers-catalog.md`, `structure/api-router-groups.md`, `structure/key-services.md`, `structure/packages.md`, `domains/classification-ir35.md`, plus `hot.md` + `log.md` + BM25 rebuild

## Decisions Made

- **Staff surface = separate `taxForm` router, not a `tax.ts` extension.** The plan's `files_modified` listed `routers/core/tax.ts`, but the always-mounted `taxRouter` cannot be flag-gated at assembly time. A dedicated `tax-form-router.ts` mounted as the `taxForm` namespace lets `root.ts` conditionally spread the whole US staff surface (mirroring `conditionalClassificationRouters`) while the per-request `assertUsExpansionEnabled` guard provides defense-in-depth. Same procedures, same audit/RBAC contract, cleaner gating.
- **Removed unused `TAX_FORM_NOT_FOUND`/`TAX_FORM_NOT_DRAFT` exports.** The append-only invariant (T-85-03-05) is enforced structurally: `saveTaxFormDraft` only ever queries/updates `status: 'DRAFT'` rows, and `supersedeAndInsert` only `updateMany`s ACTIVE→SUPERSEDED then `create`s — neither path can mutate a signed row, so an explicit non-DRAFT reject would be unreachable dead code.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Dead error exports removed**
- **Found during:** Task 2
- **Issue:** `TAX_FORM_NOT_FOUND` + `TAX_FORM_NOT_DRAFT` were exported in `errors.ts` but referenced nowhere (the append-only design makes a non-DRAFT reject path unreachable). Dead code violates the production-grade / no-leftover-placeholders standard.
- **Fix:** Removed both exports; kept `US_EXPANSION_DISABLED` (used by the flag guard).
- **Files modified:** `packages/api/src/errors.ts`
- **Committed in:** `7ea70eb45`

**2. [Rule 3 - Blocking] Stripped planning-ID breadcrumbs from source comments**
- **Found during:** Task 2 verification (`pnpm lint:no-breadcrumbs` flagged `D-08`, `D-07`, `D-05`, `Pitfall 4` in the new router comments)
- **Fix:** Rewrote each comment to state the WHY without the ID (kept the explanation, dropped the tag), per CLAUDE.md hard rule.
- **Files modified:** `routers/core/tax-form-router.ts`, `routers/portal/portal-tax-form-router.ts`
- **Committed in:** `7ea70eb45`

**3. [Rule 2 - Missing critical functionality] Wiki updated in the same change set (doc-follows-code)**
- **Found during:** Task 2 verification (`pnpm check:wiki-brain` reported 8 doc-drift errors for the new router/service/`root.ts` files)
- **Fix:** Updated `portal-external.md`, `api-routers-catalog.md`, `api-router-groups.md`, `key-services.md`, `packages.md`, `classification-ir35.md` (the pages owning the changed files), plus `hot.md`/`log.md` and a BM25 rebuild. All 8 plan-caused drift errors resolved.
- **Files modified:** 8 wiki files
- **Committed in:** `7ea70eb45` (code-owning pages); remaining doc/state in the final metadata commit

---

**Total deviations:** 3 auto-fixed (1 bug, 1 blocking, 1 missing critical). Plus 2 architecture refinements documented under Decisions (separate staff router; dead-export removal).
**Impact on plan:** No scope creep. The staff-router relocation is a strictly-better gating choice that still satisfies every acceptance criterion (the `root.ts` `module.us-expansion` gate is present; staff procedures are `contractor:read` gated and PII-safe). All deviations were necessary for correctness, security, or the doc-follows-code gate.

## Threat Model Mitigations Honored

| Threat ID | Mitigation in this plan |
|-----------|-------------------------|
| T-85-03-01 (full SSN via snapshot/response) | `buildFormSnapshot` recursively strips full-SSN/TIN keys (last-4 only); `getMyTaxForms`/`listFormSubmissions` never select `snapshotJson`; tests assert no full SSN in the serialized response or stored snapshot. |
| T-85-03-02 (cross-contractor IDOR) | Every portal read/write scoped to `ctx.contractorId` (9 occurrences); `getMyTaxForms` test injects a foreign-contractor row and asserts it is never returned. |
| T-85-03-03 (cross-tenant) | `ctx.organizationId` from session + `ctx.db` regional tenant client; staff `listFormSubmissions`/`requestTaxForm` scope + reject cross-tenant (NOT_FOUND test). |
| T-85-03-04 (forged attestation IP/identity) | IP from `ctx.headers` (`x-forwarded-for`/`x-real-ip`), `actorId = ctx.contractorId`, `signedAt = new Date()` server-side; grep gate `input.ip`/`body.ip` = 0; test asserts the snapshot IP equals the request header, not any body value. |
| T-85-03-05 (mutating a signed record) | Append-only `supersedeAndInsert` (updateMany ACTIVE→SUPERSEDED then create); `saveTaxFormDraft` only touches DRAFT rows; supersede test asserts prior status SUPERSEDED + new ACTIVE. |
| T-85-03-06 (treaty override tampering) | Override requires a reason + audit (Plan 02 `resolveTreatyDecision` flags `auditRequired`; the submit path persists the resolved claim and audits the submission). |
| T-85-03-07 (staff on-behalf signing) | accept — no staff mutation creates a signed record; `requestTaxForm` only writes an audit event (test asserts `taxFormRows` stays empty). |
| T-85-03-08 (US surface before flag sign-off) | `module.us-expansion` conditional-spread in `root.ts` + per-request `assertUsExpansionEnabled`; both portal and staff tests assert FORBIDDEN when the flag is off. |
| T-85-03-SC (package installs) | accept — no package installs this plan. |

## Issues Encountered

- **Continuation of an interrupted prior session.** Tasks 1's RED/GREEN commits (`584b97b6d`, `2351c6ed3`) and the bulk of the Task-2 implementation were already on disk uncommitted when this session started. Verified each piece (typecheck + scoped tests GREEN), tightened one service type, fixed the breadcrumb + dead-export issues, completed the missing staff integration test (Task 3), and committed the remaining work atomically per task.

## Known Stubs

None — `requestTaxForm` deliberately defers only the *notification delivery* (per the plan's deferred list); it persists a real auditable request event. No empty/mock data flows to any response.

## Deferred Issues

- **Pre-existing branch/working-tree doc-drift (out of scope).** `check:wiki-brain` still reports 3 pages for source files an EARLIER branch commit (or a prior session's unstaged edit) changed without updating the page: `messages/ar.json`, `feature-flags/src/evaluator.ts`, `validators/src/legal/de.d.ts.map`. None is in any 85-03 commit. All 8 drift errors that 85-03 *caused* are fixed in the same change set. Logged precisely in `deferred-items.md` (CLAUDE.md: only NEW drift vs the branch base retro-bricks; these predate the plan).

## TDD Gate Compliance

- **Task 1:** `584b97b6d` (test, RED) → `2351c6ed3` (feat, GREEN) — clean gate sequence.
- **Task 2:** portal/staff routers + their behavior test landed together (`7ea70eb45`); the underlying service primitives they wire already had their RED→GREEN cycle in Task 1. All 17 service+portal assertions GREEN.
- **Task 3:** staff integration test (`59089f023`) added against the GREEN staff router; 8 assertions GREEN.

## Next Phase Readiness

- Plan 04 (wizard UI) can consume `portal.getTaxFormDetermination` (prefill + routing) and `portal.submitTaxForm` (`taxFormSubmissionSchema` RHF resolver) directly.
- The US surface is dark behind `module.us-expansion` (default false; dev bypass `FLAG_SIGNOFF_BYPASS=local` / `QA_DEFAULT_ORG_ID`) — flip the flag to exercise it.
- No DB/migration changes (schema is live from Wave 1).

## Self-Check: PASSED

- All 7 created files + 4 modified files present on disk.
- All 4 plan commits present in `git log` (`584b97b6d`, `2351c6ed3`, `7ea70eb45`, `59089f023`).
- 25 scoped tests GREEN (9 service + 8 portal + 8 staff); `pnpm typecheck --filter @contractor-ops/api` GREEN; `lint:audit-log` + `lint:no-breadcrumbs` OK.

---
*Phase: 85-theme-a-w-form-intake-tax-treaty-engine*
*Completed: 2026-06-16*
