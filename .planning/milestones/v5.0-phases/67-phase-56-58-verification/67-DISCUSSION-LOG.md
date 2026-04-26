# Phase 67: Phase 56 & 58 Verification - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-26
**Phase:** 67-phase-56-58-verification
**Areas discussed:** Stream structure, Phase 56 Steuerberater dependency, Re-validation depth, Adjacent gap handling

---

## Pre-discussion State Verification

| Artifact | Phase 56 | Phase 58 |
|---|---|---|
| CONTEXT.md | ✅ exists | ✅ exists |
| RESEARCH.md | ✅ exists | ✅ exists |
| VALIDATION.md | ✅ exists (likely approved) | ✅ exists (likely approved) |
| Plans | ✅ 8 plans + 8 summaries | ✅ 5 plans + 5 summaries |
| VERIFICATION.md | ❌ MISSING (Phase 67 creates) | ❌ MISSING (Phase 67 creates) |
| Special artifacts | `56-STEUERBERATER-REVIEW.md` (legal review on disk), `deferred-items.md` | (none) |

Both phases shipped fully and have validated nyquist contracts; only the formal VERIFICATION.md artifacts are outstanding.

Sibling phase context informing decisions:
- Phase 65 D-04 just demonstrated re-validation pays off (7 enumerated bugs → 2 plans after intervening commits closed 5)
- Phase 66 D-13/D-14 established the manual-only deferral pattern for HMRC sandbox provisioning under STATE.md local-only constraint

---

## Stream structure

| Option | Description | Selected |
|--------|-------------|----------|
| Two parallel plans (one per phase) | 67-01: Phase 56 verification + 56-VERIFICATION.md. 67-02: Phase 58 verification + 58-VERIFICATION.md. Independent, parallelizable. | ✓ |
| Single plan covering both | One sequential plan covering both verification artifacts. | |
| Two parallel plans + final consolidation plan | 67-01 + 67-02 in wave 1, 67-03 cross-phase consolidation in wave 2. | |

**User's choice:** Two parallel plans (one per phase)
**Notes:** Cross-phase invariants (e.g. classification depends on Phase 56 country fields) captured as explicit reads inside the relevant 58-VERIFICATION row, not as a third plan. D-03 still requires both plans land before Phase 67 closes — no partial closure.

---

## Phase 56 Steuerberater dependency

| Option | Description | Selected |
|--------|-------------|----------|
| Defer per local-only constraint | Steuerberater sign-off recorded as Pre-Deploy Manual-Only. 56-VERIFICATION.md flips to verified on programmatic FOUND-01..06 evidence. | ✓ |
| Steuerberater is a hard gate | 56-VERIFICATION.md cannot flip to verified until 56-STEUERBERATER-REVIEW.md is signed off. | |
| Hybrid — verified for code, separate gate for legal | 56-VERIFICATION.md flips to verified for code; legal_review_status starts pending. | |

**User's choice:** Defer per local-only constraint
**Notes:** Same disposition pattern as Phase 66 D-14 used for HMRC sandbox provisioning. CONTEXT.md D-16 introduces a `disposition: pre_deploy_legal_review` field on the manual_only[] row to formalize this category. Honors STATE.md "Standing Project Constraints" deferral.

---

## Re-validation depth before writing the verification docs

| Option | Description | Selected |
|--------|-------------|----------|
| Full re-run (mirror Phase 66 D-04) | Re-run all Phase 56 + Phase 58 acceptance commands on current v2 HEAD. Drop already-fixed remediation steps. | ✓ |
| Smoke check only | Run test commands from SUMMARY files; trust if green. | |
| Trust VALIDATION.md / SUMMARY claims | Skip re-running entirely. | |

**User's choice:** Full re-run (mirror Phase 66 D-04)
**Notes:** This pattern just paid off massively for Phase 65 — 7 enumerated bugs reduced to 2 after D-04 re-validation found 5 already closed by intervening commits. SUMMARY snapshots can be weeks stale; re-running on `v2` HEAD is the only authoritative source.

---

## Adjacent-gap handling

| Option | Description | Selected |
|--------|-------------|----------|
| Fix in this phase | One-touch fixes inline; investigation-required gaps deferred. | ✓ |
| Document only — add to backlog | Note as gaps[] in VERIFICATION.md; create backlog phase. | |
| Defer to a follow-up phase | Open Phase 68 for any findings. | |

**User's choice:** Fix in this phase
**Notes:** Mirrors Phase 66 D-07 + Phase 65 D-04. Scope-creep guard: if a fix needs investigation (root-cause unclear, ripples across multiple files, requires schema migration), Phase 67 records as gaps_found and opens follow-up. CONTEXT.md D-12 enforces this guard.

---

## Claude's Discretion

- Format of the `requirements_verified[]` table (markdown vs YAML) — match `63-VERIFICATION.md`
- Granularity of test-ID citations (suite-level vs per-test) — match precision of the requirement claim
- Whether IR35 + DRV scoring evidence is one row per requirement or per (requirement × country)

## Deferred Ideas

- Steuerberater sign-off completion (pre-deploy ops / legal coordination)
- Phase 64 verification (out of scope for Phase 67)
- Phase 59, 60, 61, 62 verification (out of scope)
- VALIDATION.md → VERIFICATION.md template unification (inherited from Phase 66 deferred)
- `disposition` vocabulary expansion (formalize in a project-level reference)
- Manager-flag automation (gsd-sdk improvement)
