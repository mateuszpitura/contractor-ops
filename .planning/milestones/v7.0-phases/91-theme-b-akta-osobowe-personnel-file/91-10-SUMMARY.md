---
phase: 91-theme-b-akta-osobowe-personnel-file
plan: 10
subsystem: personnel-file
tags: [personnel-file, akta-osobowe, web-vite, rbac, bfla, retention, i18n, rtl, feature-flags]

# Dependency graph
requires:
  - phase: 91-07
    provides: personnelFile.getFile (per-section {locked|unlocked+docs}+retention) + getRetentionSummary the hook consumes
provides:
  - Staff personnel-file 4-section shell at employees/:workerId/personnel-file (flag-gated module.workforce-employees)
  - use-personnel-file hook — sole tRPC boundary mapping getFile into five per-section states (loading|locked|empty|error|populated)
  - Conspicuous server-driven locked card (title + Lock + blocked badge, NO document body/count), section-scoped error, retention posture chips + page-level retention panel
  - PersonnelFile i18n namespace across en/de/pl/ar (real translations, ar RTL)
affects: [91-11 personnel-file document-list/upload extension, 91-12 wiki synthesis]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hook-as-sole-boundary maps an atomic per-section server payload to presentational state props; the lock is never re-decided in the view — a server {status:'locked'} maps straight to the locked card with an empty documents array, so ungranted bytes are neither fetched nor rendered (BFLA fence held in the UI)"
    - "Section-scoped error over an atomic query: getFile is one query, so a query error maps every card to its own inline error + Retry while the header and retention panel (fed by the same per-section retention, present even for locked sections) stay independent"
    - "base-nova shadcn primitives compose via the base-ui `render` prop, not Radix `asChild` (CollapsibleTrigger/TooltipTrigger/Button-as-Link)"
    - "Section labels + adviser-verify notes are localized per UI locale under PersonnelFile.sections.<JUR>.<A|D>; PL/US carry a statutory citation chip, DE/UK read as organizational groupings (no chip); citation ROW shown only when the server supplied a citation — never fabricated"

key-files:
  created:
    - apps/web-vite/src/components/employees/personnel-file/hooks/use-personnel-file.ts
    - apps/web-vite/src/components/employees/personnel-file/personnel-file-shell.tsx
    - apps/web-vite/src/components/employees/personnel-file/personnel-file-section-card.tsx
    - apps/web-vite/src/components/employees/personnel-file/personnel-file-section-status-badge.tsx
    - apps/web-vite/src/components/employees/personnel-file/personnel-retention-panel.tsx
    - apps/web-vite/src/pages/dashboard/employees/personnel-file.tsx
    - apps/web-vite/src/components/employees/personnel-file/__tests__/personnel-file-section-card.test.tsx
  modified:
    - apps/web-vite/src/router/dashboard-routes.tsx
    - apps/web-vite/messages/en.json
    - apps/web-vite/messages/de.json
    - apps/web-vite/messages/pl.json
    - apps/web-vite/messages/ar.json

key-decisions:
  - "Route lives at pages/dashboard/employees/personnel-file.tsx + dashboardRoutes (the actual web-vite routing convention), not the plan's non-existent src/routes/ path"
  - "Retention panel is fed by getFile's per-section retention (present for locked sections too) rather than a second getRetentionSummary call — keeps use-personnel-file the sole boundary and avoids a redundant query"
  - "getFile carries no employee display name, so the header shows the localized PersonnelFile.shell.header title + jurisdiction + Active/Terminated chips — no fabricated name, no raw workerId"
  - "Populated state reuses the DocumentList presentational wrapper with per-document metadata rows (documentId/date the router returns); the rich DocumentCard (filename/preview/version/delete) needs the Document join and is 91-11's document-list extension"

requirements-completed: [AKTA-01, AKTA-02]

# Metrics
duration: ~55min
completed: 2026-07-01
---

# Phase 91 Plan 10: Staff Personnel-File 4-Section Shell + Retention Display Summary

**A flag-gated staff `employees/:workerId/personnel-file` surface whose `use-personnel-file` hook is the sole tRPC boundary over `personnelFile.getFile`, mapping each server section into one of five visually distinct states — with a deliberately conspicuous, server-driven Locked card that mounts NO document body or count (the per-section RBAC from 91-07 made undeniable in the UI), a section-scoped error + Retry, per-section retention posture chips, a page-level retention panel with an amber adviser-verify note, and a new `PersonnelFile` i18n namespace in real en/de/pl/ar translations (ar RTL).**

## Performance
- **Duration:** ~55 min (incl. fresh-worktree `pnpm install` + turbo dep build)
- **Completed:** 2026-07-01
- **Tasks:** 2 (2 atomic commits)
- **Files:** 12 (7 created, 5 modified)

## Accomplishments
- **`use-personnel-file.ts` (sole tRPC boundary):** `useQuery(trpc.personnelFile.getFile.queryOptions({ workerId }))` mapped to `PersonnelFileSectionView[]` with `state ∈ {loading, locked, empty, error, populated}`. A server `{ status: 'locked' }` section maps straight to the `locked` state with an empty `documents` array — the lock is never re-decided in the view (T-91-10-01 BFLA fence held in the client). `getFile` returning `null` surfaces as `notFound`; a query error maps every section to `error`; `retry` refetches. No `useTRPC/useQuery` anywhere else in the tree (`check:web-vite-data-layer` OK).
- **`personnel-file-section-card.tsx` (five states):** loading = documents-family skeleton rhythm; **locked** = title + `Lock` + `--status-blocked` badge with NO `CollapsibleContent`/count mounted, the control `aria-disabled` + `tabIndex={0}` (announced-but-inert, still Tab-reachable); empty = the documents empty pattern with `PersonnelFile.sections.empty.*` copy; error = section-scoped `AlertTriangle` + Retry re-triggering only that section; populated = the reused `DocumentList` wrapper with per-document metadata rows. Header carries the adviser-verify `Info` tooltip and a `Statutory` citation chip for PL/US only.
- **`personnel-retention-panel.tsx`:** collapsed-by-default page-level summary listing all four sections' posture (`Retained while employed` vs `Retained until {date}`), each row expanding a statutory citation ROW only when the server supplied one (DE/UK organizational groupings with no citation stay inert — never fabricated), and the amber `role="note"` adviser-verify legal note once at the foot (the shared `border-amber-300 bg-amber-50 text-amber-800` + dark pattern).
- **`personnel-file-section-status-badge.tsx`:** locked/empty/populated badge via the shared `STATUS_CLASS_MAP` + `tDynLoose` pattern, coloured only from the pre-verified `--status-blocked/--status-success` tokens.
- **`personnel-file-shell.tsx` + route:** thin flag-gated composer (`useFlag('module.workforce-employees')` → `null` when off, mirroring the employee-registration surface), header (title + jurisdiction chip + Active/Terminated chip), retention panel, four section cards, and a page-level not-found card with a Back-to-employees link. Registered at `employees/:workerId/personnel-file` in `dashboardRoutes`.
- **i18n:** new top-level `PersonnelFile` namespace (60 leaf keys) added to en/de/pl/ar in the same change set — shell, section empty/locked/error/status, per-jurisdiction PL/DE/UK/US A–D labels + adviser-verify notes, retention posture + legal note. de/pl/ar are real translations; ar renders under the existing RTL + `--font-arabic` swap.

## Task Commits
1. **Task 1 — hook + shell + section card (5 states) + status badge + retention panel + route** — `4af4f2c3f` (feat)
2. **Task 2 — PersonnelFile i18n namespace (en/de/pl/ar) + section-card state test** — `0c5509795` (feat)

**Plan metadata:** this SUMMARY committed separately at the real milestones path.

## Decisions Made
- **Route follows the actual web-vite convention.** The plan listed `apps/web-vite/src/routes/dashboard/employees/personnel-file-route.tsx`, but web-vite has no `src/routes/` tree — routing is `pages/dashboard/**` + a `dashboardRoutes` array in `router/dashboard-routes.tsx`. Delivered as `pages/dashboard/employees/personnel-file.tsx` (thin `Suspense` composer) + one lazy import + one route entry (`employees/:workerId/personnel-file`), matching the existing `contractors/:id/...` detail pattern.
- **Retention panel fed by `getFile`, not a second query.** `getFile` already returns each section's retention posture (including locked sections — retention is non-sensitive), so the panel receives it as props from the shell. This keeps `use-personnel-file` the sole boundary and avoids a redundant `getRetentionSummary` round-trip; that procedure stays available for a standalone compliance-sweep context.
- **Header has no employee name (contract-honest).** `getFile` returns `workerId/jurisdiction/employmentActive/terminatedAt` — no display name. The header renders the localized `shell.header` title + jurisdiction + Active/Terminated chips rather than fabricating a name or exposing the raw workerId.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] base-ui `render` prop, not Radix `asChild`**
- **Found during:** Task 1 (web-vite typecheck).
- **Issue:** The initial components used `asChild` on `CollapsibleTrigger`/`TooltipTrigger`/`Button`; the `base-nova` shadcn primitives here wrap `@base-ui/react`, which composes via the `render` prop (`Property 'asChild' does not exist`).
- **Fix:** Rewrote all four call sites to the established `render={<Button … />}` / direct-`CollapsibleTrigger className=…` patterns (mirroring `peppol-status-badge.tsx`, `ksef-sync-history.tsx`). Zero typecheck errors in my files after.
- **Files:** personnel-file-section-card.tsx, personnel-file-shell.tsx, personnel-retention-panel.tsx
- **Commit:** `4af4f2c3f`

**2. [Rule 3 - Buildable-commit regrouping] retention panel landed in Task-1 commit**
- **Issue:** The plan lists `personnel-retention-panel.tsx` under Task 2, but the shell (Task 1) imports it — committing it in Task 2 would make the Task-1 commit non-buildable.
- **Fix:** Committed the retention panel with the shell (commit 1); Task 2 is the i18n JSON + the state test. Both commits are independently buildable (mirrors 91-07's commit-grouping deviation). All planned files delivered.

**Total:** 2 auto-fixed (both Rule 3). No architectural (Rule 4) decisions, no auth gates.

## Deferred / Out of Scope
- **Pre-existing `@contractor-ops/web-vite` typecheck offender (NOT this plan):** `src/components/contractors/classification/classification-tile.tsx:55` (`toneForOutcome` lacks an ending return, `TS2366`) — not in this plan's diff. My 7 new files + route registration + i18n add ZERO typecheck errors. Logged in `deferred-items.md` (SCOPE BOUNDARY).
- **Rich populated DocumentCard (filename/preview/version/delete):** deferred to 91-11's personnel-file document-list/upload extension. `getFile` returns per-section document metadata only (no `Document` join), so the populated state reuses the `DocumentList` wrapper with metadata rows; the full card needs the join wired in 91-11.
- **Inline upload CTA + `shell.uploadCta` wiring:** the upload flow is Screen 2 (AKTA-04, a separate plan). The `shell.uploadCta` key is added for contract parity but not rendered yet (a non-functional button would be a stub); it is reserved for the AKTA-04 upload plan. The empty state ships as a complete heading+body.
- **Wiki synthesis:** the new personnel-file web-vite surface is batched into the phase's dedicated wiki plan (91-12), matching the 89-06 / 91-03..07 pattern. No wiki `verify_with` references these new files, so `check:wiki-brain` is not tripped.

## Known Stubs
- None that block the plan goal. `shell.uploadCta` is an unrendered i18n key reserved for the AKTA-04 upload plan (documented above); the populated document row shows metadata pending 91-11's DocumentCard wiring. Neither prevents the five-state shell + retention display from functioning.

## Threat Flags
None — all new surface (per-section rendering, section states, retention display) is within the plan's `<threat_model>`. T-91-10-01 (BFLA / client-side hiding) is mitigated: the hook branches on the server `{status:'locked'}` and never fetches-all-then-filters; a locked card mounts no document payload or count. T-91-10-02 (retention read as verified fact) is mitigated: every section label carries the adviser-verify tooltip and the retention panel the amber legal note; DE/UK citations are omitted rather than fabricated.

## Verification
- `pnpm check:web-vite-data-layer` — OK (use-personnel-file is the only tRPC/React-Query boundary in the tree).
- `pnpm check:web-vite-page-shells` + `check:web-vite-presentational` — OK.
- `pnpm i18n:parity` — OK (en keys covered in de/pl/ar; PersonnelFile = 60 identical leaf keys per locale).
- `pnpm check:rtl-logical-props` — OK; my files independently verified free of physical-direction utilities (logical `ms/me/ps/pe/start/end` + gap/space only).
- `pnpm --filter @contractor-ops/web-vite test src/components/employees/personnel-file` — 4/4 GREEN (locked = title visible + blocked badge + NO document body/count + inert-Tab-reachable control; empty; section-scoped error Retry; populated N rows + statutory chip).
- `pnpm --filter @contractor-ops/web-vite typecheck` (via turbo) — my new files add ZERO errors; only the pre-existing `classification-tile.tsx` offender remains (deferred).
- `lint:no-breadcrumbs` clean for my files (no phase/decision IDs in source comments).

## Next Phase Readiness
- **91-11 (document-list/upload extension):** wire the populated state to the full `DocumentCard` (filename/preview/version/delete) once the `Document` join is exposed; render the inline upload CTA using the reserved `shell.uploadCta` key + the `DropZone` (`entityType="personnelFile"`).
- **91-12 (wiki synthesis):** document the personnel-file web-vite surface (`wiki/structure/web-vite-domains.md` + the personnel-file domain page) — the five-state shell, the BFLA-in-the-UI locked card, and the retention display.

## Self-Check: PASSED
- All 7 created files present on disk (5 components + 1 page + 1 test); `dashboard-routes.tsx` + 4 message files modified; SUMMARY at the real milestones path.
- Both task commits present (`4af4f2c3f`, `0c5509795`).
- Route `employees/:workerId/personnel-file` registered in `dashboardRoutes`.
- Gates green: check:web-vite-data-layer, page-shells, presentational, i18n:parity, rtl-logical-props; scoped tests 4/4; my files add zero typecheck errors; no source-comment breadcrumbs. No STATE.md / ROADMAP.md edits.

---
*Phase: 91-theme-b-akta-osobowe-personnel-file*
*Completed: 2026-07-01*
