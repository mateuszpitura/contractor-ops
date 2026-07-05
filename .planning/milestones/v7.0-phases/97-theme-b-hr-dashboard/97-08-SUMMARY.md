# 97-08 SUMMARY — 5-locale i18n parity + documentation-follows-code

**Wave:** 5 · **Status:** done · closes Phase 97 with full i18n + wiki/graph/BM25 refresh.

## What landed
- **`HrDashboard` i18n namespace** authored in `apps/web-vite/messages/{en,de,pl,ar}.json` at full key parity — 102
  leaf keys each, identical key sets (verified). Covers title/subtitle, KPI header, headcount breakdown +
  employment-type + contract-end labels, utilization + under-utilization + degraded copy, doc-expiry band/category
  labels + section note, probation severity buckets, nationalisation (KSA/UAE) labels + the "record manual headcount"
  prompt, and every loading/empty/degraded/error string. Plus `Navigation.hr` (en "HR", de "Personal", pl "Kadry",
  ar "الموارد البشرية"). ICU plural placeholders (`{count, plural, …}`) preserved intact; ar is RTL; de uses the
  formal Sie register.
- **en-US** inherits en (fallback-aware peer) — the `HrDashboard` base is already US spelling ("utilization",
  "nationalization"), with proper program nouns "Saudization"/"Emiratisation" verbatim, so there is no US-specific
  divergence to override. `pnpm i18n:parity` is GREEN (en → de/pl/ar; 494 pre-existing baseline sites; zero new drift).
- **de/pl/ar are machine-assisted and FLAGGED for native review** — recorded as EXTERNAL-ENABLEMENT #9 (native-quality
  copy deferred; parity, not quality, is the gate).
- **Documentation-follows-code** (same change set):
  - NEW `wiki/domains/hr-dashboard.md` — Purpose / Flow / Entry points / UI surface (the six widget groups) /
    Invariants / Agent mistakes, with `verify_with` anchoring the router + services + page + components + `hr-roles.ts`.
  - `wiki/domains/_index.md` links it; `wiki/structure/web-vite-domains.md` gains the `hr-dashboard/` row (source_commit
    bumped). The router/services/schema/flag structure pages were already written by the 97-01/03 backend commits and
    already cross-reference `[[domains/hr-dashboard]]`.
  - `.planning/MEMORY.md` — the four phase invariants (RBAC = employee:read → four HR roles / owner-excluded / client
    `MemberRole` gap; columns ADDED in 97-01 not P90-promoted; doc-expiry composes compliance-policy not
    compliance-reminder-scan; Gulf rate manual-input only).
  - `wiki/log.md` entry + `wiki/hot.md` HR-dashboard discovery section (source_commit bumped).
  - `.planning/EXTERNAL-ENABLEMENT.md` #23 — the `__hr_dashboard_columns` deferred migration apply (deploy-time human step).
- **Refresh pipeline** — BM25 index rebuilt (`.vault-meta/bm25/index.json`, 283 docs incl. the new page); graphify
  graph rebuilt into `.planning/graphs/graph.json` (gitignored local artifacts). `pnpm check:wiki-brain` is GREEN
  (0 errors; the multiple-source_commit WARN is pre-existing/benign).

## Verification
- `pnpm i18n:parity` — GREEN. `pnpm check:wiki-brain` — 0 errors.
- `pnpm --filter @contractor-ops/web-vite typecheck` — green (unchanged; i18n JSON is the only product change here).
- Key parity confirmed: en/de/pl/ar each carry the same 102 `HrDashboard.*` leaf keys + `Navigation.hr`.

## Notes / deviations
- The plan's per-locale-directory path (`i18n/messages/<locale>/HrDashboard.json`) is stale — web-vite uses single
  per-locale message files (`apps/web-vite/messages/<locale>.json`); the namespace was inserted there. en-US stays the
  thin fallback override (no HrDashboard entry needed).
- The four structure/pattern index updates the plan lists were already delivered by the 97-01/03 backend commits; this
  plan adds the missing frontend surfaces (domain page UI section + web-vite-domains row) to complete the cross-links.
