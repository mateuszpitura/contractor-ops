---
phase: 75-f4-offboarding-contract-health-check-ip-verification-credent
plan: 03
subsystem: compliance-policy
tags: [compliance-policy, jurisdiction, ip-assignment, registry]

requires:
  - phase: 71-f1-compliance-policy-package
    provides: registerPolicyRule + resolvePolicyRules + Severity/PolicyRule types
provides:
  - 6 IP-assignment policyRules (uk/de/pl/us/ksa/uae) the health-check materialiser references on LIKELY_MISSING (D-07)
  - NEW us.ts jurisdiction module + boot-path wiring
  - compliance-policy Jurisdiction union extended to include 'US'
affects: [75-06]

tech-stack:
  added: []
  patterns:
    - "Universal offboarding-time WARNING rules (appliesIf: () => true) — surface on dashboard, never block payment"

key-files:
  created:
    - packages/compliance-policy/src/policies/us.ts
  modified:
    - packages/compliance-policy/src/types.ts
    - packages/compliance-policy/src/policies/uk.ts
    - packages/compliance-policy/src/policies/de.ts
    - packages/compliance-policy/src/policies/pl.ts
    - packages/compliance-policy/src/policies/ksa.ts
    - packages/compliance-policy/src/policies/uae.ts
    - packages/compliance-policy/src/index.ts
    - packages/compliance-policy/src/__tests__/registry.test.ts
    - packages/compliance-policy/src/__tests__/resolve.test.ts

key-decisions:
  - "Extended compliance-policy Jurisdiction union from UK/DE/PL/KSA/UAE to add 'US' — required because us.ts uses jurisdiction: 'US'; verified no exhaustive switch consumers break (COUNTRY_TO_JURISDICTION maps are Record<string,Jurisdiction>)"
  - "DE rule id is de.werkvertrag_ip@v1 (not de.ip_assignment) per CONTEXT D-07 — reflects Nutzungsrechte, not assignment"
  - "documentType uses the string literal 'IP_RATIFICATION' (PolicyRule.documentType is typed `string`, no Prisma enum coupling in this package)"

patterns-established:
  - "Each jurisdiction module independently legal-reviewable; draftLegalText ends with PENDING legal review marker"

requirements-completed: [OFFB-05]

duration: 22 min
completed: 2026-05-31
---

# Phase 75 Plan 03: Per-jurisdiction IP-assignment Policy Rules Summary

**Registered 6 universal offboarding-time IP-assignment policy rules (one per jurisdiction, incl. a new US module) that the health-check materialiser uses for LIKELY_MISSING ContractorComplianceItem creation; extended the Jurisdiction union to include US.**

## Performance
- **Duration:** ~22 min
- **Tasks:** 8/8
- **Files:** 10 (1 new module + 5 module edits + types + index + 2 test edits)

## Accomplishments
- 6 WARNING-severity, IP_RATIFICATION-documentType rules with appliesIf always-true; DE rule carries §31/§7 UrhG + UK-INSUFFICIENT engineering signal.
- New us.ts wired into the index boot path; Jurisdiction union now UK/DE/PL/US/KSA/UAE.
- compliance-policy 26/26 tests pass; workspace typecheck 42/42.

## Task Commits
1. **75-03-01..08 (us.ts + 5 module edits + Jurisdiction + boot + 2 tests)** - `02f02b47` (feat)

## Deviations from Plan

**[Rule 2 — missing critical] Jurisdiction union lacked US** — The compliance-policy `Jurisdiction` type was `UK|DE|PL|KSA|UAE` (no US). The plan's us.ts requires `jurisdiction: 'US'` → would fail typecheck. Extended the union to add `'US'`. Verified consumers (backfill script, classification router, supersession) use `Record<string, Jurisdiction>` maps — no exhaustive switch breaks.

**[Rule 2 — missing critical] existing exact-count/exact-set tests** — `registry.test.ts` hardcoded `length === 13`; updated to baseline(13)+phase75(6)=19. `resolve.test.ts` `.toEqual([...])` UK IR35-INSIDE (4→5) and DE construction (3→4) fixtures now include the new universal IP rules; updated both with intent-preserving comments.

**[Rule 3 — test API] registry test EngagementContext shape** — Plan's test used `{ jurisdiction, outcome, engagementType }`; real `EngagementContext` needs `sector`, `contractorNationality`, `requiresRegulatedEquipment`. Added a `ctx()` helper with the correct shape.

**Total deviations:** 3 (2 missing-critical existing-test updates + 1 test-API). **Impact:** none on behavior; new rules resolve correctly per jurisdiction.

## Self-Check: PASSED
- 6 rules registered + resolvable per jurisdiction; us.ip_assignment@v1 reachable via boot path.
- compliance-policy 26/26; workspace typecheck 42/42.
- DE rule cites §31/§7/Schöpferprinzip/INSUFFICIENT; all carry PENDING marker.

## Next
Wave 1 complete (75-02/03/04/05 done). Proceed to Wave 2: 75-06 (health-check engine + QStash) and 75-07 (credential-vault + IP-gate tRPC).
