---
phase: 80-v6-0-verification-hardening-manual-uat
plan: 03
subsystem: docs
tags: [legal-signoff, compliance, signoff-registry, feature-flags, milestone-close, gulf, ip-clauses]

# Dependency graph
requires:
  - phase: 70-v6-0-foundation-cross-cutting-ci-guards-observability-baseli
    provides: "signoff-registry-flags.json PENDING-flag infrastructure + isGatedFlag namespace gating"
  - phase: 71-f1-compliance-policy-package-schema-classification-reconcile
    provides: "compliance-policy-engine.* PENDING flags (uk/de/pl/ksa/uae jurisdiction rules)"
  - phase: 75-f4-offboarding-contract-health-check-ip-verification-credent
    provides: "legal-signoff.ip_clauses.* IP-clause registry keys (UK/DE/PL/US/KSA/UAE)"
  - phase: 79-f3-gulf-uae-free-zone-tracking-saudization-dashboard-arabic-
    provides: "gulf.free-zone-tracking + gulf.saudization-dashboard flags + LOCKED_AE/SA phrases + Arabic statutory sign-off routing"
provides:
  - "80-LEGAL-SIGNOFF.md — consolidated post-deploy legal sign-off list, one section per adviser"
  - "Per-adviser mapping of all 24 PENDING signoff-registry-flags namespaces + validators IP-clause/doc-name rows"
affects: [milestone-close, v6.0-retrospective, post-deploy-legal-review]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Per-adviser legal sign-off catalogue (mirrors v5.0 69-VERIFICATION Post-Deploy Items framing)"]

key-files:
  created:
    - .planning/phases/80-v6-0-verification-hardening-manual-uat/80-LEGAL-SIGNOFF.md
  modified: []

key-decisions:
  - "Restate registry notes inline rather than cross-link each origin SUMMARY (signoff-registry notes are the single source either way; CONTEXT discretion bullet)"
  - "Keep exactly four ## adviser sections per D-05; PL + US rows have no named adviser section so they live in a plain-text closing subsection (preserves grep -c '^## ' == 4)"
  - "Route the 6 IdP cross-border data-handling flags to a separate data-protection queue (privacy counsel, not one of the four tax/labour advisers) and list them under cross-cutting flags for 24-flag completeness"

patterns-established:
  - "Per-adviser post-deploy legal catalogue: each row = artifact/copy to verify + source namespace/file + queue it joins; framed catalogued-not-obtained, non-blocking"

requirements-completed: []  # verification phase — 0 ROADMAP requirement IDs

# Metrics
duration: 14min
completed: 2026-06-05
---

# Phase 80 Plan 03: v6.0 Consolidated Post-Deploy Legal Sign-Off List Summary

**80-LEGAL-SIGNOFF.md catalogues every "Needs verification by legal entity" annotation across v6.0 under exactly four adviser sections (DE Steuerberater / UK tax-legal / UAE legal / KSA MOL-HRSD+legal), sourced verbatim from the two in-repo signoff registries, framed post-deploy and non-blocking.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-06-05T15:49:12Z (plan kickoff)
- **Completed:** 2026-06-05
- **Tasks:** 1
- **Files modified:** 1 (created)

## Accomplishments

- Produced `80-LEGAL-SIGNOFF.md` — one section per adviser, in the D-05-mandated order: DE Steuerberater, UK tax/legal, UAE legal, KSA MOL/HRSD + legal.
- Mapped **all 24 PENDING** `signoff-registry-flags.json` namespaces onto adviser sections by namespace prefix; jurisdiction-specific flags sit under their adviser, cross-cutting flags (`compliance-payment-block`, `compliance-portal-self-service`, `offboarding-ip-foundation`, 6× `idp-deprovisioning*`) are explicitly accounted for so the 24-flag inventory is complete.
- Folded in the parallel `packages/validators/src/legal/signoff-registry.json` rows: DE/UK/UAE/KSA IP-clause keys (`legal-signoff.ip_clauses.*@v1`), COMPL doc-name keys (`COMPL_DOCNAME_*`), and generic disclaimer banners.
- Routed the Phase 79 "Arabic statutory copy legal sign-off" item (`79-HUMAN-UAT.md:23-24`) to the UAE + KSA sections via `LOCKED_AE_PHRASES` (11 keys) / `LOCKED_SA_PHRASES` (8 keys).
- DE section names §48b EStG, A1, Aufenthaltstitel, Werkvertrag/Schöpferprinzip (UrhG §31); UK names IR35/ITEPA + Border Security Act; UAE names free-zone permitted-activity + NOC + payment-block lockout copy; KSA names Saudization/Nitaqat + Qiwa + Iqama.

## Item Count Per Adviser Section

| Adviser section | Numbered items | Primary source namespaces |
|-----------------|----------------|---------------------------|
| DE Steuerberater | 5 | `compliance-policy-engine.de.*` (a1/aufenthaltstitel/eight_b_estg) + `offboarding-ip-foundation` + `legal-signoff.ip_clauses.de.*` |
| UK tax / legal | 4 | `compliance-policy-engine.uk.*` (right_to_work/utr/business_registration/sds) + `legal-signoff.ip_clauses.uk.*` |
| UAE legal | 5 | `gulf.free-zone-tracking` + `compliance-policy-engine.uae.*` (emirates_id/free_zone_license) + `LOCKED_AE_PHRASES` + `legal-signoff.ip_clauses.uae.*` |
| KSA MOL/HRSD + legal | 5 | `gulf.saudization-dashboard` + `compliance-policy-engine.ksa.*` (iqama/work_permit_qiwa) + `LOCKED_SA_PHRASES` + `legal-signoff.ip_clauses.ksa.*` |

Cross-cutting flags (3 + 6 IdP) and PL/US rows are catalogued in trailing plain-text subsections (not `## ` headings, preserving the four-section invariant).

**All 24 PENDING `signoff-registry-flags.json` namespaces are represented:** 4× UK, 3× DE, 2× PL, 2× KSA, 2× UAE compliance-policy-engine rules; `gulf.free-zone-tracking`; `gulf.saudization-dashboard`; `compliance-payment-block`; `compliance-portal-self-service`; `offboarding-ip-foundation`; `idp-deprovisioning` + 5× `module.idp-deprovisioning-{gws,slack,entra,okta,github}`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Catalogue every legal sign-off item, one section per adviser** - `2341346f` (docs)

**Plan metadata:** (this SUMMARY + STATE + ROADMAP) — see final docs commit.

## Files Created/Modified

- `.planning/phases/80-v6-0-verification-hardening-manual-uat/80-LEGAL-SIGNOFF.md` - Consolidated post-deploy legal sign-off catalogue, one section per adviser, sourced from the two signoff registries. Committed via the REAL `milestones/v6.0-phases/...` path (the `.planning/phases` symlink rejects `git add`).

## Decisions Made

- **Restate inline vs cross-link (CONTEXT discretion):** restated the registry `notes` text inline per item and included the registry key + file path, rather than cross-linking each origin SUMMARY annotation. The signoff-registry `notes` are the single source either way.
- **Four-section invariant vs PL/US rows:** D-05 mandates exactly four adviser sections and the acceptance grep requires `grep -c "^## "` == 4. PL (doradca) and US IP/doc-name rows have no named adviser section, so they are catalogued in a trailing **plain-text** subsection (`### ` headings under the divider are not counted by `^## `), keeping the count at 4 while still accounting for every PENDING validators-registry row.
- **IdP flags → data-protection queue:** the 6 `idp-deprovisioning*` flags are cross-border data-handling / privacy-counsel reviews, not jurisdiction tax/labour items; routed to a separate data-protection queue and listed under cross-cutting flags so the 24-flag inventory stays complete without inventing a fifth `## ` adviser section.

## Deviations from Plan

None - plan executed exactly as written. Read-only against both signoff registries and the milestone planning tree; modified no source. Out-of-scope items (obtaining sign-off, CI hard-block, registry edits, feature code) were enforced as out of scope.

## Issues Encountered

- **Symlink staging (known repo gotcha):** `.planning/phases` is a symlink to `milestones/v6.0-phases`; `git add` through the symlink path fails. Both the deliverable and this SUMMARY were staged via the real `.planning/milestones/v6.0-phases/80-.../` path. Verified staged via `git status --short` before each commit.

## User Setup Required

None - documentation-only plan; no external service configuration required.

## Next Phase Readiness

- 80-LEGAL-SIGNOFF.md is the SC#3 / D-05 deliverable — one of the three milestone-close docs (alongside `80-HUMAN-UAT.md` and the pending `80-RETROSPECTIVE.md`).
- The retrospective (80-04, if not yet done) can reference this catalogue's 24-flag inventory for its "PENDING flags by namespace + ticket pointers" section.
- No blockers. All items are post-deploy and non-blocking; none gates v6.0 milestone closure (Standing Constraint LOCAL-ONLY).

## Self-Check: PASSED

- FOUND: `.planning/phases/80-.../80-LEGAL-SIGNOFF.md`
- FOUND: `.planning/phases/80-.../80-03-SUMMARY.md`
- FOUND: commit `2341346f` (Task 1 deliverable)
- Acceptance greps: 4 `## ` adviser sections; DE terms 9 (>=4); UK terms 7 (>=1); UAE terms 18 (>=1); KSA terms 11 (>=2); framing 15 (>=1); secrets 0.

---
*Phase: 80-v6-0-verification-hardening-manual-uat*
*Completed: 2026-06-05*
