---
phase: 75-f4-offboarding-contract-health-check-ip-verification-credent
plan: 04
subsystem: validators
tags: [zod, ip-clauses, regex, jurisdiction, legal]

requires:
  - phase: 75-01
    provides: signoff-registry phraseIds + ip-clauses RED tests flipped GREEN here
provides:
  - 6 per-jurisdiction IP_CLAUSES_* phrase modules (17 phrases total)
  - ALL_IP_CLAUSES aggregate + IP_CLAUSES_BY_JURISDICTION + getPhraseJurisdiction + IP_CLAUSE_PHRASE_LIBRARY_VERSION + Jurisdiction type
  - ipAssignmentResultsSchema (D-06 Zod verdict shape) + PHRASE_ID_REGEX
affects: [75-06, 75-08]

tech-stack:
  added: []
  patterns:
    - "Jurisdiction-prefixed phraseId keys (uk.*, de.* ...) so a flat aggregate has no collisions"
    - "Zod 4 results schema: z.iso.datetime + z.record(z.string(), z.unknown()) for verbatim passthrough + .strict() outer"

key-files:
  created:
    - packages/validators/src/legal/ip-clauses-uk.ts
    - packages/validators/src/legal/ip-clauses-de.ts
    - packages/validators/src/legal/ip-clauses-pl.ts
    - packages/validators/src/legal/ip-clauses-us.ts
    - packages/validators/src/legal/ip-clauses-ksa.ts
    - packages/validators/src/legal/ip-clauses-uae.ts
    - packages/validators/src/legal/ip-clauses-index.ts
    - packages/validators/src/legal/ip-clauses-results-schema.ts
  modified:
    - packages/validators/src/index.ts
    - packages/validators/src/__tests__/ip-clauses-parity.test.ts
    - packages/validators/src/legal/__tests__/ip-clauses-results-schema.test.ts

key-decisions:
  - "Zod 4 adaptation: plan used z.string().datetime() + z.record(...).passthrough() + z.ZodIssueCode; this repo is Zod 4.4.3 — used z.iso.datetime() and bare z.record (passthrough is default) per existing validators idioms"
  - "Barrel uses explicit named re-exports (validators index style) rather than the plan's export *"
  - "parity test reads ip-clauses-de.ts via fileURLToPath(import.meta.url) (package-relative) instead of a cwd-relative path so it works under pnpm --filter"

patterns-established:
  - "Each jurisdiction module independently legal-reviewable; signoff gated by legal-signoff.ip_clauses.<phraseId>"

requirements-completed: [OFFB-05]

duration: 26 min
completed: 2026-05-31
---

# Phase 75 Plan 04: IP-clause Phrase Libraries + Verdict Schema Summary

**Shipped the regex-grounding half of the D-13 verdict pipeline — 6 per-jurisdiction phrase modules (17 phrases) + the D-06 Zod results schema + the ALL_IP_CLAUSES aggregate; flipped both ip-clauses RED scaffolds to 18 GREEN tests.**

## Performance
- **Duration:** ~26 min
- **Tasks:** 8/8
- **Files:** 11

## Accomplishments
- 17 phrases (3 UK + 4 DE + 3 PL + 3 US + 2 KSA + 2 UAE), each with regex + citedTextExample + legalBasisRef + locale/jurisdiction/sufficiency/version; DE module carries the §7/§31 UrhG Schöpferprinzip + UK-INSUFFICIENT block.
- Aggregate registry + getPhraseJurisdiction + Zod ipAssignmentResultsSchema (verdict, citedClauses, crossJurisdictionMismatch, pendingPhrasesCited, verbatim rawModelToolUseInput).
- ip-clauses-parity 8/8 + ip-clauses-results-schema 10/10 GREEN; full validators suite 853/853; workspace typecheck 42/42.

## Task Commits
1. **75-04-01..08 (6 modules + schema + index + barrel + 2 tests)** - `2eb45aad` (feat)

## Deviations from Plan

**[Rule 1 — API] Zod 4 idioms** — Plan used Zod-3-style `z.string().datetime()`, `z.record(...).passthrough()`, `z.ZodIssueCode`. Repo is Zod 4.4.3 → used `z.iso.datetime()` and bare `z.record(z.string(), z.unknown())` (matches existing `changesSummaryJson` usage). Functionally equivalent.

**[Path drift — 75-DRIFT-MAP] validators subpath export** — The validators package `exports` map only declares `.` (no `./legal/*`). Plan 75-06 assumed it could import `@contractor-ops/validators/legal/ip-clauses-index`; the working path is the barrel `@contractor-ops/validators` (ALL_IP_CLAUSES etc. now re-exported there). Flagged in 75-DRIFT-MAP and the commit body for 75-06.

**[Rule 3 — test infra] parity test file-read path** — Plan read ip-clauses-de.ts via a cwd-relative path; changed to `fileURLToPath(new URL('../legal/ip-clauses-de.ts', import.meta.url))` so it resolves under `pnpm --filter`.

**Total deviations:** 1 API + 1 path-drift + 1 test-infra. **Impact:** none on behavior; 75-06 must import from the barrel.

## Self-Check: PASSED
- 8 new files; 17 phrases; both RED scaffolds GREEN.
- Full validators suite 853 passed; workspace typecheck 42/42.
- secret-shape-detector also GREEN (75-05 already landed).

## Next
Wave 1 final plan: 75-03 (compliance policies — 6 per-jurisdiction policy rules the engine references on LIKELY_MISSING).
