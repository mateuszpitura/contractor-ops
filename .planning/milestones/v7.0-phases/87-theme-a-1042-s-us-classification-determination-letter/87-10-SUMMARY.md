---
phase: 87-theme-a-1042-s-us-classification-determination-letter
plan: 10
subsystem: docs
tags: [wiki, documentation-follows-code, us-tax-forms, us-classification, 1042-s, 1099-k, irs-iris, memory]

# Dependency graph
requires:
  - phase: 87-02..87-09
    provides: the shipped Phase 87 code (Prisma models, classification profile, 1042-S core, determination letter, 1099-K cron, IRIS 1042-S, mounted staff UI) that this wiki tracks
provides:
  - domains/us-classification.md (new) + domains/us-tax-forms.md extended with the 1042-S surface
  - integrations/irs-1042s.md (new) + integrations/_index registration
  - structure/prisma-schema-areas.md + web-vite-domains.md extended; api-routers-catalog source_commit bumped
  - wiki/log.md Phase 87 entry + hot.md discovery section + MEMORY.md four Phase 87 invariants
  - rebuilt BM25 index; check:wiki-brain green
affects: [wiki, next-agent-discovery]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Documentation-follows-code: domain + structure + integration pages track the shipped code, verify_with → real source, source_commit bumped on HEAD advance"

key-files:
  created:
    - .planning/brain/wiki/domains/us-classification.md
    - .planning/brain/wiki/integrations/irs-1042s.md
  modified:
    - .planning/brain/wiki/domains/us-tax-forms.md
    - .planning/brain/wiki/domains/_index.md
    - .planning/brain/wiki/integrations/_index.md
    - .planning/brain/wiki/structure/prisma-schema-areas.md
    - .planning/brain/wiki/structure/api-routers-catalog.md
    - .planning/brain/wiki/structure/web-vite-domains.md
    - .planning/brain/wiki/log.md
    - .planning/brain/wiki/hot.md
    - .planning/MEMORY.md

key-decisions:
  - "api-routers-catalog.md + cron-jobs.md already documented form1042s / form1099kTracker / form-1099k-tracker accurately (Plans 04/06 updated them incrementally) — verified against root.ts, left content-unchanged; only bumped the catalog source_commit (HEAD advanced + a filesystem-mtime staleness flag)."
  - "domains/_index was missing BOTH us-tax-forms and us-classification (pre-existing gap) — added both under Compliance & jurisdiction."
  - "BM25 index is gitignored — rebuilt locally to clear the check:wiki-brain missing-index error, not committed."
  - "Cross-phase HOLD (P86 seam) is recorded across every touched page (us-tax-forms, irs-1042s, web-vite-domains, hot, MEMORY) so the next agent reuses-not-rebuilds."

requirements-completed: [US-FORM-06, US-CLASS-01, US-CLASS-02, US-CLASS-03, US-CLASS-04]

# Metrics
completed: 2026-07-05
---

# Phase 87 Plan 10: Wiki synthesis (documentation-follows-code) Summary

**The wiki now tracks every Phase 87 product change — a new US-classification domain page, the 1042-S surface added to us-tax-forms, a new IRS-1042-S integration page, the new Prisma models in prisma-schema-areas, the mounted /tax-filing UI in web-vite-domains, refreshed log/hot/MEMORY, and a rebuilt BM25 index — with `check:wiki-brain` green (0 errors).**

## Accomplishments (Task 1 — domain + structure + integration pages)

- **`domains/us-classification.md` (new):** the US `ClassificationProfile` (registry plugin via `getProfileForCountry('US')`, IRS common-law base + dispositive CA-AB5 overlay on `US_WORK_STATE` + §530 relief flag), the audited `classification.override` (AuditLog-only), and the append-only no-LLM `US_DETERMINATION_LETTER` react-pdf (frozen `ruleSetVersion`). Purpose / Flow / Determination Letter / Entry points / UI surface / Invariants / Agent mistakes; `verify_with` → the shipped profile/router/pdf/UI source.
- **`domains/us-tax-forms.md` (extended):** a new "Form 1042-S (chapter-3 foreign withholding)" section (`form-1042s.service` §875(d) gate + server-derived boxes + immutable supersede + REPORTED-only idempotent batch; recipient PDF; sibling `buildIris1042SXml` + form-parameterized `xsdValidate1042S`; transmit-tail cross-phase HOLD), a staff 1042-S batch-review UI-surface bullet, four 1042-S entry-point rows, a 1042-S invariant + agent-mistake note, `us-classification`/`irs-1042s` cross-links; `verify_with` (1042-S service/router/pdf/template + tax-filing UI + page) + `source_commit` bumped.
- **`integrations/irs-1042s.md` (new)** + `integrations/_index` registration: IRS 1042-S via IRIS (Pub 1187 sibling builder, form-keyed XSD, human-only XSD download checkpoint, ManualDownload default, transmit HOLD on the P86 seam).
- **`structure/prisma-schema-areas.md`:** Tax row extended with `Form1042S` (immutable/supersede), `Form1099KTrackerState`, `Tax1099KThreshold` ($20,000 + 200 OBBBA), `ClassificationDocumentKind.US_DETERMINATION_LETTER`, and nullable `ContractorAssignment.workState`; `verify_with` (tax/classification/contractor schema) + `source_commit` bumped.
- **`structure/web-vite-domains.md`:** a `contractors/tax-filing/` row + the `/tax-filing` route + `navigation.ts` in `verify_with`; `source_commit` bumped.
- **`domains/_index.md`:** now lists both `us-classification` and `us-tax-forms` (both were missing — pre-existing gap).
- **Verified-already-accurate (content unchanged):** `structure/api-routers-catalog.md` (`form1042s` + `form1099kTracker` + US determination-letter, gated by `module.us-expansion`) and `structure/cron-jobs.md` (`form-1099k-tracker`) were updated incrementally by Plans 04/06 — re-verified against `root.ts`; only the catalog `source_commit` was bumped (HEAD advanced + a filesystem-mtime staleness flag).

## Accomplishments (Task 2 — log / hot / MEMORY / brain pipeline)

- **`wiki/log.md`:** a 2026-07-05 Phase 87 entry (code/domain facts — mounted 1042-S surface, the new/extended pages, the cross-phase HOLD, the verification result). No operational round-status.
- **`wiki/hot.md`:** a "US 1042-S filing + worker classification" discovery section + `source_commit`/`updated` bumped.
- **`.planning/MEMORY.md`:** a Phase 87 section with the four invariants — (1) US classification pluggable profile, advisory-not-verdict, audited override; (2) 1042-S `Form1099Nec`-mirror immutable+supersede, §875(d)-gated, REPORTED-only; (3) 1099-K informational cron band ($20k+200 tax-year config), never files; (4) 1042-S IRIS sibling `buildIris1042SXml` through the P86 form-parameterized transmit tail (+ the cross-phase HOLD).
- **Brain pipeline:** contextual-prefix (`--no-llm`) + `bm25-index.py build` (232 docs) rebuilt; `pnpm check:wiki-brain` → **0 errors** (the multi-source_commit-prefix WARN is pre-existing and non-gating). BM25 index is gitignored (not committed).

## Deviations from Plan

- **api-routers-catalog.md + cron-jobs.md were already accurate** (Plans 04/06 documented the routers/cron incrementally), so Task 1's "add the new procedures / add the cron" reduced to verify-against-root.ts + a `source_commit` bump on the catalog. No content invented.
- **BM25 missing-index surfaced as an ERROR (not WARN)** from `check:check-wiki-brain` locally; resolved by running the documented rebuild pipeline. graph.json was not rebuilt (WARN-only, and `.husky/post-commit` auto-rebuilds it).

## Verification

- `pnpm check:wiki-brain` — **0 errors**, 1 warning (pre-existing multi-source_commit prefixes).
- Automated acceptance: `us-classification.md` + `irs-1042s.md` exist; `Form1042S` in `prisma-schema-areas.md`; `form-1099k-tracker` in `cron-jobs.md`; both new `[[…]]` link targets resolve; frontmatter well-formed.
- Router facts verified against `packages/api/src/root.ts` (`form1042s` line 165, `form1099kTracker` line 166, `classificationDocument` line 145).

## User Setup Required

None — docs-only.

## Self-Check: PASSED

- Both new pages present; all 9 touched pages committed in `761723957`.
- `check:wiki-brain` green; Phase 87 documentation-follows-code gate satisfied.

---
*Phase: 87-theme-a-1042-s-us-classification-determination-letter*
*Completed: 2026-07-05*
