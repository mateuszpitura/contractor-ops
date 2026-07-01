---
phase: 88-theme-a-us-payment-rail
plan: 07
subsystem: documentation
tags: [wiki, documentation-follows-code, us-payment-rail, nacha, fedwire, withholding, memory-invariant]

# Dependency graph
requires:
  - phase: 88-02
    provides: schema (backupWithholdingFlagged, US ACH encrypted+masked pairs, Plaid fields, ACH_NACHA/FEDWIRE enum)
  - phase: 88-03
    provides: jurisdiction-agnostic withholding (applyWithholding/applyWithholdingToRun) + tin-match flag writer
  - phase: 88-04
    provides: NACHA + Fedwire generators, detectUsFormat, settlement wiring on the export path
  - phase: 88-05
    provides: USD first-class + resolveSettlementCurrency/convertForSettlement seam
  - phase: 88-06
    provides: PayoutInitiationAdapter + Plaid seams, payment.initiatePayout, payments.plaid-verification flag, env keys
provides:
  - "domains/us-payment-rail.md — the US payout-rail domain compass (Purpose/Flow/Withholding/Formats/USD/Seams/Entry points/UI surface/Invariants/Agent mistakes) with verify_with → the real shipped source"
  - "integrations/modern-treasury.md + integrations/plaid.md — provider pages (mock-behind-seam, flag-dark, credential env keys, deferred live path)"
  - "structure/api-routers-catalog.md + prisma-schema-areas.md + patterns/money-rounding.md + patterns/feature-flags.md updated to track the Phase-88 code"
  - ".planning/MEMORY.md — the payment-run-is-the-withholding-source-of-truth invariant (+ one jurisdiction-agnostic path, hand-rolled NACHA, config ceiling, no USD=1.0, mock-behind-seam flag-dark, Plaid advisory fail-open)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Documentation-follows-code: every Phase-88 product change gets a matching wiki + index + MEMORY entry in the same milestone; check:wiki-brain green closes the loop"
    - "Derived-cache contention discipline: BM25/.vault-meta is gitignored (WARN-only); hot.md left untouched when another session holds it dirty"

key-files:
  created:
    - .planning/brain/wiki/domains/us-payment-rail.md
    - .planning/brain/wiki/integrations/modern-treasury.md
    - .planning/brain/wiki/integrations/plaid.md
  modified:
    - .planning/brain/wiki/structure/api-routers-catalog.md
    - .planning/brain/wiki/structure/prisma-schema-areas.md
    - .planning/brain/wiki/patterns/money-rounding.md
    - .planning/brain/wiki/patterns/feature-flags.md
    - .planning/brain/wiki/index.md
    - .planning/brain/wiki/domains/_index.md
    - .planning/brain/wiki/integrations/_index.md
    - .planning/brain/wiki/log.md
    - .planning/MEMORY.md

key-decisions:
  - "hot.md left unstaged/untouched — it was dirty from a concurrent session and the CLAUDE.md python pipeline (contextual-prefix + bm25) does not regenerate hot.md (that is a separate claude-obsidian plugin step). Regeneration deferred to the next pipeline run; a slightly stale derived cache is WARN-only per check:wiki-brain."
  - "Wiki pages carry durable facts + real domain IDs only (NACHA/PPD/CCD/CTX/§3406/pacs.008.001.08/Fedwire); no planning-ID breadcrumbs, no operational/round-status text."
  - "Extended navigation _index/index pages (not in the plan files_modified) additively so the three new pages are discoverable — per the doc-follows-code 'integrations/_index on new provider' trigger."

requirements-completed: [US-PAY-01, US-PAY-02, US-PAY-03, US-PAY-04, US-PAY-05]

# Metrics
duration: ~8min
completed: 2026-07-01
---

# Phase 88 Plan 07: US Payment-Rail Wiki Synthesis Summary

**Closed the documentation-follows-code loop for the US payment rail: authored a new `domains/us-payment-rail.md` domain compass + `integrations/modern-treasury.md` and `integrations/plaid.md` provider pages, updated the catalog/schema/money-rounding/feature-flags pages to track the merged Phase-88 code (88-02..88-06), recorded the payment-run-is-the-withholding-source-of-truth invariant in MEMORY.md, appended the wiki log entry, rebuilt the BM25 index, and left `check:wiki-brain` green with zero errors — all matched against the actual shipped source on main.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-01T01:01:16Z
- **Completed:** 2026-07-01T01:09:30Z
- **Tasks:** 2 (both auto)
- **Files:** 3 created + 9 modified (12 wiki/planning files); BM25 index rebuilt (gitignored)

## Accomplishments

- **New `domains/us-payment-rail.md`** — the whole US payout rail in one compass, verified against the merged source: the `ACH_NACHA` hand-rolled zero-dep generator + Fedwire `pacs.008.001.08` XML (`generateNachaFile`/`generateFedwirePacs008`), `detectUsFormat` routing with the Same-Day ACH ceiling as dated config (`sameDayAchCeilingMinor`, $1M→$10M 2027-09-17), the jurisdiction-agnostic withholding deduction (`applyWithholding`: SA WHT + US 24% §3406 + 1042-S treaty) with the **payment run as the single source of truth** the 1099 box-4 / 1042-S box-2 aggregate, USD first-class (no `USD=1.0` short-circuit) + `resolveSettlementCurrency`/`convertForSettlement`, and the Modern Treasury `PayoutInitiationAdapter` + Plaid Identity seams (mock default, flag-dark, Plaid advisory fail-open). `verify_with` points at the six real shipped source files.
- **New `integrations/modern-treasury.md` + `integrations/plaid.md`** — provider pages: mock-behind-seam + flag-dark, the `payments.ach-payouts` (reused) / `payments.plaid-verification` (non-gated) gating, AES-256-GCM per-slug credential env keys, zero-dep GA floor, human-gated live path deferred.
- **`structure/api-routers-catalog.md`** — `payment` row extended (US `ACH_NACHA`/`FEDWIRE` + opt-in `initiatePayout`) + a `payment.initiatePayout` Notable-contract (Zod `.strict()`, gating, idempotency, per-item settlement + Plaid advisory, masked audit); `payment-core.ts` added to `verify_with`; source_commit bumped.
- **`structure/prisma-schema-areas.md`** — US payment-rail schema area row (`Contractor.backupWithholdingFlagged`; `ContractorBillingProfile` US ACH encrypted+masked pairs + Plaid advisory `String?` fields; `PaymentExportFormat` += `ACH_NACHA`/`FEDWIRE`; additive migration `20260701000000_phase88_us_payment_rail_schema`); source_commit bumped.
- **`patterns/money-rounding.md`** — withholding single-HALF-UP row (`applyWithholding`) + settlement-FX row (`convertForSettlement`, verbatim `convertAmount` delegate, null-on-missing-rate); `payment-shared.ts`/`payment-settlement.ts` added to `verify_with`; source_commit bumped.
- **`patterns/feature-flags.md`** — `payments.ach-payouts` (reused for programmatic ACH) + `payments.plaid-verification` (non-gated, live Plaid client only) gate rows; `flags-core.ts` added to `verify_with`; source_commit bumped.
- **`.planning/MEMORY.md`** — the payment-run-source-of-truth invariant plus the one-jurisdiction path, hand-rolled NACHA / config ceiling / no-USD-short-circuit, and programmatic-ACH + Plaid mock-behind-seam flag-dark + Plaid advisory fail-open.
- **Pipeline + gate** — ran the CLAUDE.md refresh pipeline (contextual-prefix pass over all 110 wiki pages → chunks under gitignored `.vault-meta`; BM25 rebuilt, 207 docs); `pnpm check:wiki-brain` → **0 errors, 1 pre-existing WARN** (mixed `source_commit` prefixes across the whole wiki, unrelated to phase 88).

## Task Commits

Each task committed atomically on `main` (with hooks):

1. **Task 1 — US payment-rail wiki pages + catalog/schema/integration/pattern updates** — `cc9c5443b` (docs) — 10 files
2. **Task 2 — MEMORY payment-run-source-of-truth invariant + wiki log entry** — `b83e9d5cb` (docs) — 2 files

_Plan metadata (this SUMMARY) committed separately. STATE.md / ROADMAP.md intentionally NOT touched — the orchestrator owns those._

## Verification

- **Task 1 automated verify:** `test -f domains/us-payment-rail.md && grep -qi "source of truth" … && grep -qi "ACH_NACHA|NACHA" prisma-schema-areas.md` → **OK**.
- **Task 2 automated verify:** `grep -qi "source of truth" .planning/MEMORY.md` → present; `pnpm check:wiki-brain` → **0 errors, 1 WARN**.
- **Source accuracy:** every documented symbol verified against merged main (`payment.initiatePayout` in `payment-core.ts`; `generateNachaFile`/`generateFedwirePacs008` in `payment-export.ts`; `detectUsFormat`/`sameDayAchCeilingMinor` in `payment-format-detection.ts`; `payments.ach-payouts`/`payments.plaid-verification` in `flags-core.ts`; env keys in `packages/integrations/.env.example`).
- **Breadcrumb scan:** no phase/plan/decision-ID breadcrumbs in the authored pages (the only grep hits were false positives inside `METHOD_NOT_FOUND` / `FORBIDDEN`).

## Deviations from Plan

### Auto-fixed / auto-added (Rules 1-3)

**1. [Rule 2 - Discoverability] Extended the navigation `_index`/`index` pages (outside declared `files_modified`).**
- **Found during:** Task 1. The three new pages would not be reachable from the wiki index.
- **Fix:** Added additive link rows to `wiki/index.md`, `wiki/domains/_index.md`, and `wiki/integrations/_index.md` — per the CLAUDE.md doc-follows-code trigger ("new integration → `integrations/_index`"). Additive-only; no other content touched.

**2. [Rule 3 - Contention] `hot.md` left unstaged/untouched.**
- **Found during:** Task 2. `hot.md` was already dirty from a concurrent session, and the CLAUDE.md python pipeline (contextual-prefix + bm25) does not regenerate `hot.md` (that is a separate claude-obsidian plugin step).
- **Fix:** Did not touch or stage `hot.md`, preserving the other session's in-progress content. Regeneration is deferred to the next full pipeline run; `check:wiki-brain` treats derived-cache staleness as WARN-only, so the gate stays green.

## Concurrent-Session Notes

- The shared `main` tree carried ~18 uncommitted files from other sessions (contractor-insights UI under `apps/web-vite/`, `packages/ui/`, `config.json`, dirty `hot.md` + `contractors-engagements.md`) plus untracked `92-*` PLAN.md files. **None** were staged, reverted, stashed, or discarded — only the explicit Phase-88 wiki/MEMORY files were `git add`ed one by one.
- A concurrent session committed `7cbfed3be docs(92)` between this plan's Task 1 and Task 2 commits; both of this plan's commits (`cc9c5443b`, `b83e9d5cb`) are intact in history.

## Known Stubs

None. Documentation-only plan; every documented code path is real and merged on main. The Modern Treasury / Plaid **live** paths are dark-by-design seams (mock default), not stubs — documented as such with the human-gated live-path deferral.

## Threat Flags

None. Documentation-only; no runtime trust boundary crossed. Docs use only synthetic/masked bank-field language and reiterate the AES-256-GCM masked-only discipline (T-88-07-01 mitigation). No package installed (T-88-SC).

## Deferred Issues

- **`hot.md` regeneration** deferred to the next full wiki pipeline run (contention with a concurrent session — see Deviations). Derived-cache staleness is WARN-only.
- **Pre-existing `check:wiki-brain` WARN** — mixed `source_commit` prefixes across the whole wiki (12 distinct prefixes); pre-existing, unrelated to phase 88, WARN-only. Not fixed (SCOPE BOUNDARY).
- **Pre-existing `check:no-process-env` ratchet drift (184 vs 182)** noted by 88-06 — unrelated to this documentation plan; not touched.
- **BM25 index** rebuilt locally under gitignored `.vault-meta/` — not committed (local derived artifact, WARN-only per CLAUDE.md).

## Self-Check: PASSED

- **Files verified present:** `domains/us-payment-rail.md`, `integrations/modern-treasury.md`, `integrations/plaid.md` (created); `api-routers-catalog.md`, `prisma-schema-areas.md`, `money-rounding.md`, `feature-flags.md`, `index.md`, `domains/_index.md`, `integrations/_index.md`, `.planning/MEMORY.md`, `wiki/log.md` (modified) — all confirmed via `git show --stat`.
- **Commits verified present:** `cc9c5443b` (Task 1, 10 files) + `b83e9d5cb` (Task 2, 2 files) both in `git log --all`.
- **Gate green:** `pnpm check:wiki-brain` → 0 errors (1 pre-existing WARN).
- **No accidental deletions** in either task commit.

---
*Phase: 88-theme-a-us-payment-rail*
*Completed: 2026-07-01*
