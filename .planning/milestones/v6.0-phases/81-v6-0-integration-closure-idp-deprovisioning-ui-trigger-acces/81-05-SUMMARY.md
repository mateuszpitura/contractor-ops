---
phase: 81-v6-0-integration-closure-idp-deprovisioning-ui-trigger-acces
plan: 05
subsystem: ui
tags: [web-vite, trpc, react-query, idp-deprovisioning, rbac, i18n, int-01]

# Dependency graph
requires:
  - phase: 81
    plan: 02
    provides: idp:start_run gate + startDeprovisioningRun/getDeprovisioningEligibility/resolveAssignmentForContractor procedures
  - phase: 77
    provides: impact-preview-panel(-container), deprovisioning-run-view(-container), use-impact-preview, use-deprovisioning-run hooks
provides:
  - use-start-deprovisioning hook — sole tRPC boundary for both entry points (resolver + eligibility + idempotencyKey + start)
  - deprovisioning-trigger-container — permission/cooldown/existing-run state machine reusing impact-preview + run-view
  - deprovisioning-trigger presentational button + confirm dialog (DialogBody/DialogFooter)
  - ACCESS_REVOKE task-card inline trigger wired through the run-page container (card stays tRPC-free)
  - client-side usePermissions mirror of the idp:start_run grant (owner/admin/it_admin) so the UI gate matches the server
  - Idp.trigger.* i18n keys across en/de/pl/ar (full parity)
affects: [81-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One shared hook serves two UI entry points (assignmentId direct OR contractorId→server resolver) keeping check:web-vite-data-layer green"
    - "Inline action injected into a presentational card via a triggerSlot ReactNode prop (no tRPC in the card)"
    - "Reuse-by-composition: confirm dialog wraps the existing ImpactPreviewPanelContainer; success renders DeprovisioningRunViewContainer inline (no rebuilt run/preview UI)"

key-files:
  created:
    - apps/web-vite/src/components/idp/hooks/use-start-deprovisioning.ts
    - apps/web-vite/src/components/idp/deprovisioning-trigger-container.tsx
    - apps/web-vite/src/components/idp/deprovisioning-trigger.tsx
    - apps/web-vite/src/components/idp/__tests__/use-start-deprovisioning.test.tsx
  modified:
    - apps/web-vite/src/hooks/use-permissions.ts
    - apps/web-vite/src/components/workflows/workflow-run/task-card-run.tsx
    - apps/web-vite/src/components/workflows/workflow-run/task-card-run-container.tsx
    - apps/web-vite/src/components/workflows/workflow-run/task-checklist.tsx
    - apps/web-vite/src/components/workflows/workflow-run-detail-container.tsx
    - apps/web-vite/messages/en.json
    - apps/web-vite/messages/de.json
    - apps/web-vite/messages/pl.json
    - apps/web-vite/messages/ar.json

key-decisions:
  - "Existing-run signal (D-09) comes from the start mutation's returned runId (P2002 returns the existing run), not from eligibility — eligibility only carries the cooldown decision { allowed, earliestDate?, reason? }"
  - "No standalone deprovisioning-run route exists, so D-03 'navigate to run-view' is satisfied by rendering DeprovisioningRunViewContainer inline (in place of the trigger) on success/existing-run"
  - "Client-side use-permissions map had no it_admin role and lacked idp:start_run — added the mirror so the advisory UI gate matches the 81-02 server grant (the seam would otherwise be permission-hidden for the seeded ACCESS_REVOKE assignee)"
  - "Deterministic idempotencyKey = deprov:<assignmentId> clamped to 128 chars (D-09)"

patterns-established:
  - "triggerSlot ReactNode prop pattern for injecting a fully-wired container element into a presentational card without breaching the data-layer guard"

requirements-completed: [IDP-01, IDP-02, IDP-10]

# Metrics
duration: ~30min
completed: 2026-06-06
---

# Phase 81 Plan 05: INT-01 Trigger UI (web-vite) Summary

**Built the INT-01 deprovisioning trigger UI in web-vite — one shared hook as the sole tRPC boundary serving both entry points (assignment detail + the offboarding ACCESS_REVOKE task card via a server-side contractorId→assignmentId resolve), a container owning the permission/cooldown/existing-run state machine that reuses the existing impact-preview panel + run-view, a presentational confirm-dialog button, and en/de/pl/ar parity — making the F2 differentiator reachable from the UI for owner/admin/it_admin.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 3
- **Files modified:** 13 (4 created, 9 modified)

## Accomplishments

- **Sole-boundary hook (`use-start-deprovisioning.ts`).** Accepts either `assignmentId` (detail surface) or `contractorId` (task card). On the contractorId path it calls `trpc.deprovisioning.resolveAssignmentForContractor` in ONE server round-trip (no client-side resolution) so `check:web-vite-data-layer` stays green. Exposes the cooldown gate via `getDeprovisioningEligibility` (`allowed`/`earliestDate`/`reason`, D-11), a deterministic per-assignment `idempotencyKey` (`deprov:<id>`, clamped to 128, D-09), the start mutation (D-03 — surfaces the returned `runId`, including the P2002 existing-run id, D-09), confirm-dialog open state, and loading/error/unresolved flags. 6-case hook test GREEN.
- **Trigger container + presentational component.** `deprovisioning-trigger-container.tsx` gates on `usePermissions().can('idp', ['start_run'])` (D-10 UI mirror) and renders all required states: loading skeleton, error+retry (`role="alert"`), not-configured/unresolved (`role="status"`, D-06), existing-run (renders `DeprovisioningRunViewContainer` inline, D-03/D-09), cooldown-disabled (disabled button + earliest-date tooltip, D-11), and startable (opens the confirm dialog, D-02). The confirm dialog wraps the EXISTING `ImpactPreviewPanelContainer` in `<DialogBody>` with start/cancel in `<DialogFooter>` (dialog convention). The presentational `deprovisioning-trigger.tsx` is props-in/JSX-out with WCAG-friendly tooltip-over-disabled-button handling.
- **ACCESS_REVOKE inline wiring + i18n.** `task-card-run-container.tsx` mounts `DeprovisioningTriggerContainer` (passing the run's `contractorId`) and injects it as a `triggerSlot` prop into the presentational `task-card-run.tsx`, which renders it in `TaskActionToolbar` only for `ACCESS_REVOKE` — the card never calls tRPC. `contractorId` is threaded from `workflow-run-detail-container` → `task-checklist` → the card container. `Idp.trigger.*` (13 keys) added to all four locales with full parity.

## Task Commits

Each task was committed atomically:

1. **Task 1: shared hook (sole tRPC boundary) + hook test** — `1668dbd3` (feat)
2. **Task 2: trigger container + presentational component + permission mirror** — `cb51ac7f` (feat)
3. **Task 3: ACCESS_REVOKE task-card wiring + en/de/pl/ar i18n** — `9d3d5ca7` (feat)

## Files Created/Modified

- `apps/web-vite/src/components/idp/hooks/use-start-deprovisioning.ts` (NEW) — sole tRPC boundary: resolver + eligibility + idempotencyKey + start mutation; exports `deriveIdempotencyKey`.
- `apps/web-vite/src/components/idp/deprovisioning-trigger-container.tsx` (NEW) — permission gate + 6-way state machine; reuses impact-preview + run-view.
- `apps/web-vite/src/components/idp/deprovisioning-trigger.tsx` (NEW) — presentational start button + confirm dialog (DialogBody/DialogFooter).
- `apps/web-vite/src/components/idp/__tests__/use-start-deprovisioning.test.tsx` (NEW) — 6-case hook spec.
- `apps/web-vite/src/hooks/use-permissions.ts` — added `idp:start_run` to owner/admin and a new `it_admin` role (start_run only).
- `apps/web-vite/src/components/workflows/workflow-run/task-card-run.tsx` — `triggerSlot` prop threaded into `TaskActionToolbar`, rendered for ACCESS_REVOKE.
- `apps/web-vite/src/components/workflows/workflow-run/task-card-run-container.tsx` — mounts `DeprovisioningTriggerContainer` for ACCESS_REVOKE.
- `apps/web-vite/src/components/workflows/workflow-run/task-checklist.tsx` + `workflow-run-detail-container.tsx` — forward `run.contractorId`.
- `apps/web-vite/messages/{en,de,pl,ar}.json` — `Idp.trigger.*` keys (13 each, parity).

## Decisions Made

- **Existing-run signal sourced from the start mutation, not eligibility.** `getDeprovisioningEligibility` returns only the `canStartDeprovisioning` cooldown decision (`{ allowed, earliestDate?, reason? }`) — it does not surface an existing run. The plan's D-09 "view run vs start" therefore keys off the start mutation's returned `runId` (a P2002 collision returns the same run id), which the container renders inline once present.
- **D-03 "navigate to run-view" = render inline.** There is no standalone deprovisioning-run route in web-vite (the run-view is only rendered by its own container). The trigger container swaps to `<DeprovisioningRunViewContainer runId={...} />` in place on success/existing-run, honoring "reuse, do not rebuild."
- **Provider default for the preview = GOOGLE_WORKSPACE** (per the plan; GWS impact is populated, others render the generic shape).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Client-side permission map lacked idp:start_run and the it_admin role**
- **Found during:** Task 2 (trigger container — UI permission gate)
- **Issue:** `apps/web-vite/src/hooks/use-permissions.ts` carries a client-side mirror of the role→permission matrix used by `usePermissions().can(...)`. It had no `it_admin` role at all and `idp` only held `override_step_failure`. With the 81-02 server grant in place, `can('idp', ['start_run'])` would still return `false` for every actor — hiding the trigger from owner/admin AND the seeded ACCESS_REVOKE assignee (it_admin), making the entire INT-01 seam unreachable from the UI (the plan's whole purpose).
- **Fix:** Added `start_run` to the owner and admin `idp` arrays and added a new `it_admin` role entry holding `idp: ['start_run']` only — an exact mirror of `packages/auth/src/roles.ts` (owner/admin: `override_step_failure` + `start_run`; it_admin: `start_run`). The server remains authoritative; this only aligns the advisory UI gate.
- **Files modified:** `apps/web-vite/src/hooks/use-permissions.ts`
- **Verification:** Cross-checked against `packages/auth/src/roles.ts` (lines 28/58/124-132); typecheck clean; data-layer guard clean.
- **Committed in:** `cb51ac7f` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing-critical UI gate). No scope creep.
**Impact on plan:** Required for the trigger to be reachable by the intended actors (T-81-05-01 disposition — the UI gate is advisory but must be present and correct). The server gate (81-02) remains the authoritative enforcement.

## Issues Encountered

None beyond the permission-mirror deviation above. The 81-01 hook RED test did not pre-exist, so the hook test was created fresh per the plan. All guards (`check:web-vite-data-layer`, `check:web-vite-dialog-pattern`, `i18n:parity`), the scoped hook test (6/6), the existing `task-checklist` test (4/4), and `pnpm typecheck --filter @contractor-ops/web-vite` are green.

## Threat Flags

None — no new network endpoint, auth path, or schema change. The UI permission mirror is advisory only (T-81-05-01); all destructive calls re-hit the server `requirePermission({ idp: ['start_run'] })` gate (81-02). assignmentId is resolved server-side (T-81-05-02), tRPC is confined to the one hook (T-81-05-03), and the deterministic per-assignment idempotencyKey makes a double-click return the existing run (T-81-05-04).

## Known Stubs

None — both entry points are fully wired. The detail-surface entry point (passing `assignmentId` directly) is exercised by the hook + container and is ready for a contractor/assignment detail page to mount `<DeprovisioningTriggerContainer assignmentId={...} />`; the ACCESS_REVOKE card path is wired end-to-end.

## User Setup Required

None — no external service configuration. The `idp:start_run` grant is code (Better Auth evaluates roles per request); the UI gate mirror takes effect on the next session.

## Next Phase Readiness

- **81-06 (E2E):** the trigger is reachable from both the ACCESS_REVOKE card and the detail surface through the one hook. Before the P2002 idempotency E2E relies on the unique index, confirm `DeprovisioningRun_organizationId_idempotencyKey` is applied locally (carried forward from 81-01/02).

## Self-Check: PASSED

All four created files exist on disk; all three task commits (`1668dbd3`, `cb51ac7f`, `9d3d5ca7`) are present in git history; the scoped hook test (6/6), data-layer + dialog + i18n-parity guards, and web-vite typecheck are all green.

---
*Phase: 81-v6-0-integration-closure-idp-deprovisioning-ui-trigger-acces*
*Completed: 2026-06-06*
