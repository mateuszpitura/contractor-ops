---
phase: 91-theme-b-akta-osobowe-personnel-file
plan: 03
subsystem: compliance
tags: [retention, personnel-file, akta-osobowe, personalakte, registry, jurisdiction, gdpr, i9]

# Dependency graph
requires:
  - phase: 91-01
    provides: personnel-registry.test.ts RED scaffold (registry API contract + single-source-of-years guard)
  - phase: 91-02
    provides: PersonnelFileSection enum (SECTION_A..D) in the Prisma client
provides:
  - Register-on-import per-jurisdiction personnel-file section registry (PL/DE/UK/US) in compliance-policy
  - PersonnelSection / PersonnelRetentionRule / RetentionAnchor / PersonnelRetentionRecordType type surface
  - Deterministic DocumentType->section resolver (resolveSectionForDocumentType) + retention-rule getter (getPersonnelRetentionRules)
  - 8 akta retention-year tokens registered on the shared db RETENTION_YEARS map (single source of years)
  - gdpr RETENTION_CITATIONS extended with per-token statutory citations
affects: [91-04, 91-05, 91-06, personnel-file-rbac, retention-resolver, gdpr-erasure]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Register-on-import per-jurisdiction registry (mirrors doc-registry.ts): module-level Map + BASELINE loop that throws on duplicate (jurisdiction, id)"
    - "Section carries its own retention rules + deterministic DocumentType set (unified model, no parallel rule map)"
    - "Per-rule event-typed retention anchor (HIRE_DATE|TERMINATION_DATE|DOCUMENT_DATE); US I-9 two-rule max() shape"
    - "Years live only in db RETENTION_YEARS keyed by recordType token (single source, no db import from compliance-policy)"

key-files:
  created:
    - packages/compliance-policy/src/personnel-types.ts
    - packages/compliance-policy/src/personnel-registry.ts
  modified:
    - packages/db/src/retention-policy.ts
    - packages/api/src/routers/compliance/gdpr.ts
    - packages/compliance-policy/src/index.ts

key-decisions:
  - "Consolidated the plan's proposed 3-file split (personnel-sections + personnel-retention-rules) into a single personnel-registry.ts to match the authoritative 91-01 RED scaffold, which imports one module and models retention rules as a field of the section."
  - "Pulled 91-05 Task 1's RETENTION_YEARS token additions forward into 91-03 because 91-01's single-source-of-years guard (this plan's GREEN target) reads RETENTION_YEARS directly and cannot pass without them."
  - "US general employment/certification/disciplinary sections carry no retention rule (no single federal window); only I-9 (SECTION_A) carries the two-anchor rule."

patterns-established:
  - "Personnel-file section registry: register-on-import, duplicate id throws, jurisdiction nuance in seed data"
  - "Adviser-verify annotation on every seeded statutory string (LOCAL-ONLY; legal sign-off deferred)"

requirements-completed: [AKTA-01, AKTA-02]

# Metrics
duration: 30min
completed: 2026-07-01
---

# Phase 91 Plan 03: Personnel-file Section Taxonomy + Retention Registry Summary

**Register-on-import per-jurisdiction (PL/DE/UK/US) personnel-file section taxonomy with deterministic DocumentType->section resolution and event-anchored retention rules, feeding 8 akta year tokens into the shared db RETENTION_YEARS map; turns the 91-01 personnel-registry RED scaffold GREEN (9/9).**

## Performance

- **Duration:** ~30 min (incl. fresh-worktree `pnpm install`)
- **Started:** 2026-07-01T09:06Z
- **Completed:** 2026-07-01T09:36Z
- **Tasks:** 2
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments
- Built `personnel-registry.ts`: a register-on-import Map seeded with 16 sections (SECTION_A..D x PL/DE/UK/US), each carrying its retention rules + deterministic DocumentType set; duplicate `(jurisdiction, section)` id throws, mirroring `doc-registry.ts`.
- Declared the type surface in `personnel-types.ts`: `PersonnelFileSection`, `RetentionAnchor`, the 8-token `PersonnelRetentionRecordType` union, `PersonnelRetentionRule`, `PersonnelSection`.
- US SECTION_A (I-9) carries the two-rule `max()` shape (`us-i9-post-hire` HIRE_DATE + `us-i9-post-termination` TERMINATION_DATE, 8 CFR 274a.2); DE SECTION_C carries the 30-year `de-accident-records` DOCUMENT_DATE rule alongside the 10-year tax rule.
- Registered all 8 akta year tokens on the shared `RETENTION_YEARS` map in `@contractor-ops/db` (single source of years; no parallel engine) and kept the exhaustive gdpr `RETENTION_CITATIONS` record valid.
- Every section carries an adviser-verify i18n key and every retention citation ends with `(PENDING jurisdiction legal/tax adviser verification)` (LOCAL-ONLY).

## Task Commits

Each task was committed atomically:

1. **Task 1: personnel-types + section taxonomy registry (register-on-import)** — `7151ac2b6` (feat)
2. **Task 2: akta retention tokens + gdpr citations + index wiring** — `c2238c538` (feat)

**Plan metadata:** committed with this SUMMARY (docs).

## Files Created/Modified
- `packages/compliance-policy/src/personnel-types.ts` — type surface for the section + retention registry (no db import).
- `packages/compliance-policy/src/personnel-registry.ts` — register-on-import registry: `registerPersonnelSection`, `getPersonnelSections`, `getPersonnelRetentionRules`, `resolveSectionForDocumentType`, `clearPersonnelSections`, `PERSONNEL_SECTION_REGISTRY`, plus the PL/DE/UK/US BASELINE.
- `packages/db/src/retention-policy.ts` — added the 8 akta tokens to `RETENTION_YEARS` (pl-akta-post2019=10, pl-akta-legacy=50, de-personalakte-tax=10, de-accident-records=30, uk-personnel-general=6, uk-personnel-financial=7, us-i9-post-hire=3, us-i9-post-termination=1).
- `packages/api/src/routers/compliance/gdpr.ts` — extended `RETENTION_CITATIONS` (`Record<RetainedRecordType,string>`) with the 8 personnel tokens so the erasure summary keeps a statutory citation per hold.
- `packages/compliance-policy/src/index.ts` — side-effect import of `./personnel-registry` + re-export of the three getters and the personnel types.

## Decisions Made
- **Single registry module over the plan's 3-file split.** The 91-01 RED scaffold (`personnel-registry.test.ts`) imports one module `../personnel-registry.js` and registers sections shaped `{ jurisdiction, id, labelKey, retentionRules, documentTypes }` — retention rules are a *field of the section*, not a separate map. The plan's proposed `personnel-sections.ts` + `personnel-retention-rules.ts` split could not satisfy those imports, so the taxonomy + rules were consolidated into `personnel-registry.ts` (with types in `personnel-types.ts`). `getPersonnelRetentionRules` / `resolveSectionForDocumentType` are thin lookups over the section map.
- **`resolveSectionForDocumentType` returns the section object (or null), not a bare enum** — the scaffold asserts `section?.id`, so the resolver returns `PersonnelSection | null`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pulled 91-05's RETENTION_YEARS token additions forward**
- **Found during:** Task 2 (single-source-of-years guard)
- **Issue:** 91-01's `personnel-registry.test.ts` guard reads `packages/db/src/retention-policy.ts` as text and asserts every `rule.recordType` is a key in `RETENTION_YEARS`. Those 8 tokens were planned for **91-05** (91-05-PLAN.md Task 1), which runs after this plan — so the guard could not go GREEN with the tokens absent.
- **Fix:** Added the identical 8 tokens (same names + years 91-05 specifies) to `RETENTION_YEARS`.
- **Files modified:** `packages/db/src/retention-policy.ts`
- **Verification:** `personnel-registry.test.ts` GREEN 9/9; existing `db/retention-policy.test.ts` still GREEN 5/5.
- **Committed in:** `c2238c538`
- **Note for 91-05 executor:** the 8 tokens are ALREADY present. 91-05 should treat them as registered (verify, do not duplicate-add) and focus on `getPersonnelRetentionCutoff` + `packages/db/src/personnel-retention.ts` + the db `index.ts` export. Token names match 91-05's list exactly.

**2. [Rule 3 - Blocking] Extended gdpr RETENTION_CITATIONS to keep the exhaustive Record valid**
- **Found during:** Task 2 (api typecheck)
- **Issue:** Adding tokens to `RETENTION_YEARS` widens `RetainedRecordType`; `gdpr.ts` declares `const RETENTION_CITATIONS: Record<RetainedRecordType, string>`, so the 8 new keys became mandatory (else api `tsc` error TS2353).
- **Fix:** Added a statutory citation (with adviser-verify note) for each of the 8 tokens, surfaced in the erasure summary/audit.
- **Files modified:** `packages/api/src/routers/compliance/gdpr.ts`
- **Verification:** api typecheck reports zero errors in gdpr/retention/personnel files after rebuilding db dist.
- **Committed in:** `c2238c538`

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking).
**Impact on plan:** Both were required to make the mandated RED scaffold GREEN without leaving a downstream typecheck broken. The file-structure consolidation (single `personnel-registry.ts` vs the plan's 3-file split) is a shape change dictated by the authoritative 91-01 scaffold, not scope creep. No new runtime surface beyond the plan's intent.

## Issues Encountered
- **Fresh worktree had no `node_modules`.** Ran `pnpm install`; the `postinstall` `turbo build` aborted on a pre-existing `@contractor-ops/classification` build error (missing `rule-set.ts` / `scoring.ts` source behind their test imports). Worked around by building `@contractor-ops/integrations` and `@contractor-ops/db` directly to validate typechecks. The classification breakage + the 27 cascaded api classification-file errors are pre-existing and out of scope — logged to `deferred-items.md`.
- **db is consumed via built `dist`, not `src`.** api's first typecheck saw the stale `RetainedRecordType`; rebuilding db dist resolved the gdpr.ts error and confirmed the change is clean.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- **91-04 / 91-05 ready:** the section taxonomy + rule shapes + retention tokens are registered. 91-05's `getPersonnelRetentionCutoff` reads years from `RETENTION_YEARS` by `recordType` (tokens already present) and combines anchors via `max()` — its RED scaffold `db/personnel-retention.test.ts` stays RED here by design.
- **Sibling RED scaffolds still RED (owned by later plans):** `db/personnel-retention.test.ts` (91-05 resolver) and `api/personnel-erasure.test.ts` (erasure plan).
- **Doc-follows-code:** wiki synthesis for the personnel-file domain is deferred to the phase's dedicated wiki-synthesis plan (mirrors 89-06), consistent with the prior theme-B phases. New source files are not referenced by any wiki page `verify_with`, so `check:wiki-brain` is not tripped by this change.

## Self-Check: PASSED

- `packages/compliance-policy/src/personnel-types.ts` — FOUND
- `packages/compliance-policy/src/personnel-registry.ts` — FOUND
- Commit `7151ac2b6` — FOUND
- Commit `c2238c538` — FOUND
- `personnel-registry.test.ts` — GREEN (9/9); full compliance-policy suite GREEN (46/46)

---
*Phase: 91-theme-b-akta-osobowe-personnel-file*
*Completed: 2026-07-01*
