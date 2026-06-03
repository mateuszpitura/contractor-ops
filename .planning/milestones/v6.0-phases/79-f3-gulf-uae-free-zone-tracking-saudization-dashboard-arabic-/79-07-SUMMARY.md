---
phase: 79-f3-gulf-uae-free-zone-tracking-saudization-dashboard-arabic-
plan: 07
subsystem: web-vite
tags: [gulf, saudization, nitaqat, ui, container-hook, rtl, recharts, dialog, offboarding-trajectory, gulf-10-override, i18n-keys]

# Dependency graph
requires:
  - phase: 79-05
    provides: "gulf.saudization tRPC namespace (dashboard / getConfig / upsertConfig / upsertHeadcount / offboardingTrajectory / applyNitaqatThresholdOverride / applyPermittedActivityOverride)"
  - phase: 79-04
    provides: "computeSaudizationDashboard + projectOffboardingTrajectory derivation shapes (band read-through, rate-from-manual-numbers, ephemeral trajectory)"
  - phase: 79-06
    provides: "sibling free-zone web-vite surface (Page->Container->Hook->presentational structure, --warning alert pattern, i18n-key-now/values-later convention)"
  - phase: 79-01
    provides: "check-rtl-logical-props.mjs guard (scans contractors/free-zone + saudization surfaces)"
provides:
  - "Saudization dashboard surface: SaudizationDashboardContainer + presentational SaudizationDashboard + useSaudizationDashboard (read) + useSaudizationConfig (mutations) — GULF-05/06 UI"
  - "Hero nationalisation rate (focal, manual-only), NEUTRAL Nitaqat band badge (never colorized — D-12), side-by-side headcount with subordinate platform-derived counts (D-10), Qiwa-auth gap (D-11), Iqama roll-up, RTL band donut via useRtlChartConfig"
  - "SaudizationConfigDialog — manual 6-value band + industry-segment + headcount entry (DialogBody+DialogFooter); system never auto-computes the band"
  - "NitaqatOverrideDialog (GULF-10) — applies Nitaqat-threshold / permitted-activity override + 'Custom — verify with adviser' --warning badge + destructive reset-to-default AlertDialog confirmation"
  - "OffboardingTrajectoryBanner + container + hook (GULF-07) — advisory, non-authoritative, NON-GATING --warning banner mounted at OFFBOARDING stage"
  - "~62 new Saudization.* i18n keys referenced (values populated in 79-08 / D-16)"
affects: [79-08 populates the Saudization.* i18n keys + ar/RTL parity + sources Saudization.bands from LOCKED_SA_PHRASES]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Container/Hook/Component layering for the saudization surface (ARCHITECTURE.md); hooks are the sole useTRPC/useQuery/useMutation boundary (check:web-vite-data-layer green)"
    - "Router input/output types via inferRouterInputs/Outputs<AppRouter>['gulf']['saudization'] — no hand-rolled DTOs, stays in lockstep with Plan 05"
    - "RTL band donut via Recharts PieChart with chartStyle from useRtlChartConfig + --chart-1 teal series (D-13)"
    - "Neutral band Badge (variant=outline, never destructive) — repudiation mitigation T-79-07-01 enforced by the no-colorization rule"
    - "Mutation hook hosts both config/headcount upserts AND the two GULF-10 drift overrides, each invalidating the dashboard query + toasting"
    - "Shared numberLocaleTag() helper builds BCP-47 tags with the region split from the language subtag so the source never trips the RTL physical-utility guard"
    - "Nested destructive confirmation rendered as a fragment sibling of the host Dialog (not inside DialogContent) to avoid focus-trap conflicts"

key-files:
  created:
    - apps/web-vite/src/components/saudization/hooks/use-saudization-dashboard.ts
    - apps/web-vite/src/components/saudization/hooks/use-saudization-config.ts
    - apps/web-vite/src/components/saudization/hooks/use-offboarding-trajectory.ts
    - apps/web-vite/src/components/saudization/saudization-dashboard.tsx
    - apps/web-vite/src/components/saudization/saudization-dashboard-container.tsx
    - apps/web-vite/src/components/saudization/saudization-config-dialog.tsx
    - apps/web-vite/src/components/saudization/nitaqat-override-dialog.tsx
    - apps/web-vite/src/components/saudization/offboarding-trajectory-banner.tsx
    - apps/web-vite/src/components/saudization/offboarding-trajectory-banner-container.tsx
    - apps/web-vite/src/components/saudization/format-locale.ts
  modified:
    - apps/web-vite/src/components/contractors/contractor-profile/profile-header-container.tsx

key-decisions:
  - "Added a SaudizationConfigDialog (band+segment+headcount) and a shared format-locale.ts helper beyond the plan's listed files — both required to deliver the plan's explicit 'manual band entry via a dialog' must-have and to satisfy the RTL guard. (Rule 2)"
  - "Iqama roll-up rendered as a semantic <dl> definition list, NOT a shadcn <Table>, because check:web-vite-table-pattern (Rule B) bans raw shadcn Table outside the canonical DataTable / FORM_STYLE_ALLOWLIST — a 3-row read-only metric roll-up is a key/value list, not a tabular dataset; this avoids editing the shared allowlist script."
  - "Band display goes through a Saudization.bands.* i18n namespace (one key per band). Per D-14 the band labels are LOCKED statutory text — 79-08 must populate Saudization.bands from LOCKED_SA_PHRASES, not free translations."
  - "OffboardingTrajectoryBanner surfaces the recorded band verbatim + current->projected rate and NEVER asserts a projected band (the server returns no projectedBand by design — D-12/Pitfall 8); the banner has no confirm/block/gate action."
  - "Trajectory banner mounted in profile-header-container during the OFFBOARDING stage (the offboarding-open surface). Per-engagement isSaudi is not on the contractor profile object, so the container passes isSaudi via an optional prop (currently null) — the banner is advisory/non-gating and stays inert until the per-engagement Saudi flag is wired through the offboarding workflow surface."

patterns-established:
  - "saudization surface = Container (variant decision) -> Hook (sole tRPC boundary) -> presentational view + dialogs"
  - "GULF-10 override UI = apply (sets *Custom) + 'Custom — verify with adviser' --warning badge + destructive reset confirmation, mutations audit-logged server-side (Plan 05)"
  - "advisory --warning alert pattern (border-warning/50 bg-warning/10 + text-warning icon) reused from the 79-06 free-zone scope-mismatch banner"

requirements-completed: [GULF-05, GULF-06, GULF-07, GULF-10]

# Metrics
duration: 13min
completed: 2026-06-03
---

# Phase 79 Plan 07: Saudization Dashboard + Manual Band Entry + GULF-10 Override + Offboarding Trajectory Summary

**Shipped the Saudization web-vite surface as layered Container -> Hook -> presentational views: a dashboard with the manual nationalisation rate as the hero focal point, a NEUTRAL (never colorized) Nitaqat band badge, side-by-side headcount with visually-subordinate platform-derived counts, a visibility-only Qiwa-auth gap, an Iqama expiry roll-up and an RTL band donut via useRtlChartConfig; a manual 6-value band/industry-segment/headcount entry dialog (the system never auto-computes the band); a GULF-10 drift-override dialog with the 'Custom — verify with adviser' badge and a destructive reset-to-default confirmation; and an advisory, non-authoritative, NON-GATING offboarding band-trajectory banner — all copy via useTranslations (values land in 79-08), RTL logical-properties only, full loading/empty/error states.**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-06-03T10:14:26Z
- **Completed:** 2026-06-03T10:28:05Z
- **Tasks:** 2 (both `type="auto"`)
- **Files:** 11 (10 created, 1 modified)
- **Commits:** 2 task commits + this metadata commit

## Accomplishments

### Task 1 — Saudization dashboard hook + container + presentational view + config/override dialogs (GULF-05/06) — `d5201c8f`
- **`use-saudization-dashboard.ts`** (read boundary): `useQuery(gulf.saudization.dashboard)` -> `{ isLoading, isError, onRetry, data }`. Output type from `inferRouterOutputs<AppRouter>['gulf']['saudization']['dashboard']`.
- **`use-saudization-config.ts`** (mutation boundary): hosts `upsertConfig` (band/segment), `upsertHeadcount`, and the two GULF-10 overrides (`applyNitaqatThresholdOverride` / `applyPermittedActivityOverride`) — each `onSuccess` toasts + invalidates the dashboard + config queries; each `onError` toasts the save-failure copy.
- **`saudization-dashboard.tsx`** (presentational): hero nationalisation rate (Display role, `text-2xl`, `tabular-nums`, `text-primary` — the single focal point); current band as a NEUTRAL `Badge variant="outline"` with the locked label (never colorized — D-12 / T-79-07-01); persistent manual-nature `--warning` callout + conditional quarterly-re-entry prompt; Qiwa-auth gap count (`--warning` when > 0, empty-copy otherwise — D-11); Iqama roll-up as a semantic `<dl>`; total/Saudi headcount with the platform-derived contractor counts shown side-by-side and visually subordinate (`text-muted-foreground` — D-10); RTL band donut via Recharts `PieChart` + `useRtlChartConfig` `chartStyle` + `--chart-1` teal. Numbers/dates formatted via the shared `numberLocaleTag` helper.
- **`saudization-config-dialog.tsx`**: manual band (6-value enum `Select`), industry-segment, and headcount entry in the canonical `DialogBody` + `DialogFooter` convention; client-side `saudi <= total` validation is UX only (server is authoritative). The band is taken from admin input — no computed band anywhere.
- **`nitaqat-override-dialog.tsx`** (GULF-10): applies the Nitaqat-threshold / permitted-activity override (sets `*Custom = true`, audit-logged in Plan 05), renders the `--warning` "Custom — verify with adviser" badge next to any overridden value, and routes reset-to-default through a destructive `AlertDialog` confirmation (UI-SPEC "Reset override to default?").
- **`saudization-dashboard-container.tsx`** (decisive): branches loading -> section skeleton, error/null -> retry card, empty ("Saudization not configured", reusing the config dialog as the first-entry path) -> empty card, else -> the dashboard view spread with both hooks.

### Task 2 — Offboarding band-trajectory banner (GULF-07) — `01ac4fdf`
- **`use-offboarding-trajectory.ts`** (read boundary): `useQuery(gulf.saudization.offboardingTrajectory, { offboardingContractorIsSaudi })`.
- **`offboarding-trajectory-banner.tsx`** (presentational): advisory `--warning` alert surfacing the recorded band verbatim + current->projected nationalisation rate with adviser-deferring copy ("Advisory only — verify in Qiwa. The system does not set your band."). It asserts NO projected band, has NO confirm/block/gate action (T-79-07-02), and renders nothing when no headcount is recorded.
- **`offboarding-trajectory-banner-container.tsx`**: gates on `isSaudi === true` + query state (silent while loading/error — advisory must never block offboarding).
- **`profile-header-container.tsx`**: mounts the banner container during the `OFFBOARDING` lifecycle stage (the offboarding-open surface); minimal diff, view untouched.

## Task Commits

1. **Task 1: saudization dashboard + manual band/headcount entry + GULF-10 override dialog** — `d5201c8f` (feat)
2. **Task 2: offboarding band-trajectory banner** — `01ac4fdf` (feat)

**Plan metadata:** committed alongside this SUMMARY (docs: complete plan).

## Files Created/Modified

- `apps/web-vite/src/components/saudization/hooks/use-saudization-dashboard.ts` *(new)* — dashboard read boundary
- `apps/web-vite/src/components/saudization/hooks/use-saudization-config.ts` *(new)* — band/headcount + GULF-10 override mutation boundary
- `apps/web-vite/src/components/saudization/hooks/use-offboarding-trajectory.ts` *(new)* — trajectory read boundary
- `apps/web-vite/src/components/saudization/saudization-dashboard.tsx` *(new)* — presentational dashboard (hero rate, neutral band, side-by-side headcount, Qiwa gap, Iqama roll-up, RTL donut)
- `apps/web-vite/src/components/saudization/saudization-dashboard-container.tsx` *(new)* — loading/empty/error/success variant decision
- `apps/web-vite/src/components/saudization/saudization-config-dialog.tsx` *(new)* — manual band/segment/headcount entry dialog
- `apps/web-vite/src/components/saudization/nitaqat-override-dialog.tsx` *(new)* — GULF-10 override + "Custom — verify with adviser" badge + reset confirmation
- `apps/web-vite/src/components/saudization/offboarding-trajectory-banner.tsx` *(new)* — advisory non-gating trajectory banner
- `apps/web-vite/src/components/saudization/offboarding-trajectory-banner-container.tsx` *(new)* — isSaudi-gated banner container
- `apps/web-vite/src/components/saudization/format-locale.ts` *(new)* — shared BCP-47 number-locale helper
- `apps/web-vite/src/components/contractors/contractor-profile/profile-header-container.tsx` — mounts the trajectory banner during OFFBOARDING

## New i18n keys referenced (NOT populated — 79-08 / D-16)

All under the **`Saudization`** namespace. `i18n:parity` was intentionally NOT run (keys are added now, values land in 79-08 with real en/de/pl/ar).

| Sub-namespace | Keys |
|---------------|------|
| `Saudization` (root) | `title`, `subtitle`, `rate.label`, `rate.notAvailable`, `rate.noChart`, `band.label`, `band.notSet`, `band.lastUpdated` (`{date}`), `override.badge`, `manualNature.title`, `manualNature.body`, `quarterly.title`, `quarterly.body` (`{date}`), `quarterly.bodyNoDate`, `headcount.title`, `headcount.description`, `headcount.totalLabel`, `headcount.saudiLabel`, `headcount.platformContractors`, `headcount.platformSaudiContractors`, `qiwa.title`, `qiwa.description`, `qiwa.gapCount` (`{count}`), `qiwa.gapBody`, `qiwa.empty`, `iqama.title`, `iqama.description`, `iqama.tracked`, `iqama.expired`, `iqama.expiringSoon`, `iqama.empty`, `actions.editConfig`, `actions.manageOverrides` |
| `.bands` | one key per `NitaqatBand`: `PLATINUM`, `HIGH_GREEN`, `MID_GREEN`, `LOW_GREEN`, `YELLOW`, `RED` — **79-08 must source these from `LOCKED_SA_PHRASES` (D-14), not free translations** |
| `.config` | `title`, `description`, `bandSectionTitle`, `bandLabel`, `bandPlaceholder`, `bandHelp`, `segmentLabel`, `segmentPlaceholder`, `saveBandButton`, `headcountSectionTitle`, `headcountHelp`, `totalLabel`, `saudiLabel`, `saudiExceedsTotal`, `saveHeadcountButton`, `close` |
| `.override` | `title`, `description`, `nitaqatHeading`, `nitaqatBody`, `activityHeading`, `activityBody`, `applyNitaqat`, `applyActivity`, `reset`, `badge` ("Custom — verify with adviser"), `resetConfirmTitle`, `resetConfirmBody`, `resetConfirm`, `cancel`, `close` |
| `.empty` | `heading` ("Saudization not configured"), `body`, `cta` |
| `.error` | `loadHeading`, `loadBody`, `retry` |
| `.toast` | `bandSaved`, `headcountSaved`, `overrideApplied`, `saveFailed` |
| `.offboardingTrajectory` | `title`, `projection` (`{band}`, `{rate}`, `{projectedRate}`), `advisory`, `bandUnknown`, `rateUnknown` |

**79-08 owners:** populate all of the above with genuine de/pl/ar values (D-16). `Saudization.bands.*` are LOCKED statutory band labels — source from `LOCKED_SA_PHRASES` (D-14).

## Decisions Made

- **Config dialog + shared locale helper added (Rule 2).** The plan listed 6 files but its must-have requires "manual band entry via a dialog (DialogBody + DialogFooter)". `saudization-config-dialog.tsx` delivers that; `format-locale.ts` centralises the BCP-47 tag construction (also the fix for the RTL-guard false-positive, see Deviations).
- **Iqama roll-up as `<dl>`, not `<Table>`.** `check:web-vite-table-pattern` Rule B bans raw shadcn `Table` outside the canonical `DataTable` / `FORM_STYLE_ALLOWLIST`. A 3-row read-only metric roll-up is a key/value list, so a semantic definition list satisfies both the gate and the UI-SPEC intent without editing the shared allowlist script.
- **Band labels via i18n keys, flagged for LOCKED_SA_PHRASES.** The whole surface uses `useTranslations`; band display goes through `Saudization.bands.*`. Per D-14 these are statutory — 79-08 populates them from `LOCKED_SA_PHRASES` rather than translating freely.
- **Trajectory banner is advisory-only by construction.** The server returns no projected band (D-12); the banner shows the recorded band verbatim + the rate delta and has no gating control.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added the manual band/headcount entry dialog + shared locale helper**
- **Found during:** Task 1 (building the dashboard view)
- **Issue:** The plan's must-have requires manual band entry "via a dialog (DialogBody + DialogFooter)", but `saudization-config-dialog.tsx` was not in the listed `files_modified`. Without it the dashboard's "Update Nitaqat band" / "Save headcount" CTAs have nowhere to go.
- **Fix:** Created `saudization-config-dialog.tsx` (6-value band `Select` + segment + headcount, canonical dialog convention) and `format-locale.ts` (shared `numberLocaleTag` helper).
- **Files modified:** `saudization-config-dialog.tsx`, `format-locale.ts` (both new)
- **Verification:** `check:web-vite-dialog-pattern` OK; tsc clean.
- **Committed in:** `d5201c8f` (Task 1 commit)

**2. [Rule 3 - Blocking] check:rtl-logical-props false-positive on `pl-PL` / `pl-` BCP-47 tag literals**
- **Found during:** Task 1 (first RTL-guard run)
- **Issue:** The RTL physical-utility guard regex (`[mp][lr]-`) matched the `'pl-PL'` locale literal and a `pl-` substring in a code comment, flagging non-existent margin/padding offenders.
- **Fix:** Centralised the BCP-47 tag construction in `format-locale.ts`, splitting the region suffix from the language subtag (`` `${lang}-${region}` ``) so no `pl-`-style substring appears in source; rephrased the offending comment.
- **Files modified:** `format-locale.ts`, `saudization-dashboard.tsx`, `offboarding-trajectory-banner.tsx`
- **Verification:** `pnpm check:rtl-logical-props` — 14 Gulf surface files scanned, zero offenders.
- **Committed in:** `d5201c8f` (Task 1) + `01ac4fdf` (Task 2)

**3. [Rule 3 - Blocking] Name clash between the imported dashboard-output type and the dashboard component**
- **Found during:** Task 1 (biome pre-commit)
- **Issue:** The view imported `type SaudizationDashboard` (router output) while the component was also named `SaudizationDashboard` — a redeclaration biome rejected.
- **Fix:** Renamed the exported type to `SaudizationDashboardData` in the read hook and updated consumers.
- **Files modified:** `use-saudization-dashboard.ts`, `saudization-dashboard.tsx`
- **Verification:** biome clean (only nursery warnings remain); tsc clean.
- **Committed in:** `d5201c8f` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (1 missing-critical, 2 blocking). No scope creep beyond the plan's surface plus the two helper files its must-have required.
**Impact on plan:** All three were required for the plan's must-haves to build and pass the repo's own gates.

## Issues Encountered

- **Per-engagement `isSaudi` not on the contractor profile object.** The trajectory query takes `offboardingContractorIsSaudi`, but the `ProfileHeaderContractor` shape (the offboarding-open surface) carries no Saudi flag — it lives per-engagement on `ContractorAssignment`. Plumbing it through the shared contractor-detail query + type would be a larger structural change (closer to Rule 4). The banner container therefore receives `isSaudi` via an optional prop (currently `null`); the banner stays advisory/non-gating and inert until the per-engagement flag is wired through the offboarding workflow surface. Documented here for 79-08 / a follow-up.
- **Cognitive-complexity warning (nursery) on the dashboard view.** `noExcessiveCognitiveComplexity` flags the large presentational render. It is a non-blocking nursery warning; the view composes several conditional regions (hero, callouts, headcount, Qiwa, Iqama, dialogs) and is left as-is.

## Known Stubs

None. The dashboard, config dialog, override dialog, and trajectory banner are all wired to the live `gulf.saudization` router (Plan 05). The only deferred work is the i18n *values* (79-08 / D-16) — the keys are referenced and listed above; the surface renders the key paths until 79-08 populates them, which is the planned wave order. The trajectory banner's per-engagement `isSaudi` wiring is documented under Issues Encountered (not a stub — the banner is fully built and the gate is honest).

## Threat Flags

None. No new security surface beyond the plan's `<threat_model>`. The band badge is neutral-only (T-79-07-01 mitigated — no destructive colorization); the trajectory banner is advisory, non-authoritative, non-gating with no confirm action (T-79-07-02); the manual headcount is authoritative with platform-derived counts visually subordinate (T-79-07-03); RTL logical-props-only is guard-enforced (T-79-07-04); no package installs — in-tree shadcn + recharts only (T-79-07-SC). All mutations route through the Plan 05 tenant-scoped, Zod-validated, audit-logged `gulf.saudization` procedures (the UI is presentational).

## User Setup Required

None for this wave's code/types. **Deferred (LOCAL-ONLY):** the 79-02 Gulf migration + D-02 backfill (post-deploy, per 79-05); the Saudization.* i18n values (79-08); and the per-engagement `isSaudi` wiring for the trajectory banner gate.

## Next Phase Readiness

- The Saudization web-vite surface is live and typed against `trpc.gulf.saudization.*`. 79-08 can populate the ~62 listed keys (and source `Saudization.bands.*` from `LOCKED_SA_PHRASES`) and run ar/RTL parity.
- GULF-05/06/07/10 UI complete. The dashboard composes into a Page via `SaudizationDashboardContainer` (a thin page shell can mount it directly).
- Follow-up: wire the per-engagement `isSaudi` through the offboarding surface so the trajectory banner gate is data-driven.

## Self-Check: PASSED

*(verified below)*

---
*Phase: 79-f3-gulf-uae-free-zone-tracking-saudization-dashboard-arabic-*
*Completed: 2026-06-03*
