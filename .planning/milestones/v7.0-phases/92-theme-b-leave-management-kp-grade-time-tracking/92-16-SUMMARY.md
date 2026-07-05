---
phase: 92-theme-b-leave-management-kp-grade-time-tracking
plan: 16
type: execute
status: complete
requirements: [LEAVE-01, LEAVE-02, LEAVE-03, TIME-EMP-01, TIME-EMP-02, TIME-EMP-03]
---

# Plan 92-16 Summary — Wiki closure (documentation-follows-code)

Discharges the deferred `KNOWLEDGE_REFRESH_REQUIRED` for the whole phase.

## What shipped

- **New domain page** `wiki/domains/leave-and-time.md` — Purpose / Flow (mermaid) / Entry points / UI surface / Invariants / Agent mistakes, with `verify_with` pinned to the shipped leave/employee-time/ewidencja source (prisma + routers + services + web-vite hooks).
- **Structure catalogs extended:**
  - `api-routers-catalog.md` — workforce namespaces **3 → 6**; added `leave` / `employeeTime` / `ewidencja` rows + `verify_with`.
  - `key-services.md` — `leave-balance`, `wt-limit-check`, `wt-limit-scan`, `ewidencja-builder` rows + `verify_with`.
  - `prisma-schema-areas.md` — leave / employee-time / ewidencja area (append-only ledger, DISTINCT `EmployeeTimeRecord`, INSERT-only trigger-immutable `EwidencjaSnapshot`, `PublicHoliday`) + `verify_with`.
  - `cron-jobs.md` — the WT-limit daily scan (region fan-out + per-recipient digest) + `verify_with`.
  - `web-vite-domains.md` — `leave/`, `employee-time/`, `employee-time/ewidencja/` folder rows.
- **Pattern reuse** documented in `domains/approvals-engine.md` (the resource-agnostic engine + branch-on-`resourceType` `LEAVE_REQUEST` reuse at two seams). No standalone `patterns/approval-chain.md` was created — the canonical home is the approvals-engine domain page; a parallel pattern file would duplicate it.
- **`MEMORY.md`** — 5 Phase-92 invariants appended (append-only leave ledger; `EmployeeTimeRecord` distinct from `TimeEntry`; INSERT-only DB-immutable ewidencja; `LEAVE_REQUEST` two-seam chain; region-prefixed WT-scan dedup) + post-deploy legal checkpoints (statutory values + 10yr retention) recorded, non-blocking.
- **`log.md`** appended (2026-07-05 entry); **`hot.md`** `source_commit` bumped.
- **Brain pipeline rebuilt** — `contextual-prefix.py --no-llm` on the touched pages + `bm25-index.py build` (docs=60). `.vault-meta/` is gitignored.

## Verification

- `pnpm check:wiki-brain` — **0 errors, 1 warning** (the benign "multiple source_commit prefixes" note; no doc-drift). The Phase-92 source files changed on the branch are all covered by an updated `verify_with` in the same change set.

## Deviation

- `patterns/approval-chain.md` (listed in the plan) folded into `domains/approvals-engine.md` to avoid a near-duplicate orphan page.

## Deferred (recorded, non-blocking)

- de/pl/ar i18n native review (machine-assisted); ewidencja PDF/CSV export (no backend endpoint); statutory-value + 10yr-retention adviser/legal sign-off (LOCAL-ONLY posture).
