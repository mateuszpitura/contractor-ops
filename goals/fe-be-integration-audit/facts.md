# FE↔BE Integration Audit — Facts

## Scope

- Audit covers `apps/web` (dashboard + portal route groups), `apps/public-api`, and `apps/landing`.
- Audit covers all tRPC routers under `packages/api/src/routers/` across 7 domains (compliance, core, equipment, finance, integrations, portal, public-api, workflow).
- No call sites excluded by default; cron/webhook/auth/public-api consumers are classified as "intentional non-UI" rather than skipped.

## Deliverable

- Audit produces a structured report at `goals/fe-be-integration-audit/AUDIT.md` enumerating every finding.
- Audit then applies fixes for every detected gap in atomic commits, one logical fix per commit.
- Report and fixes happen in a single `/goal` run; user is not prompted per-fix.

## Detection — FE → BE direction

- Every UI action that triggers a tRPC mutation is detected: buttons, form submits, table row 3-dot actions, Radix `DropdownMenu` items, Radix `ContextMenu` items, toggle switches.
- Each detected mutation call site is checked for: `onSuccess` toast, `onError` toast, query invalidation via `useUtils()`, pending/loading state on the trigger element, disabled state during pending.
- Destructive mutations (delete, archive, remove, revoke, cancel, disconnect) must be guarded by an `AlertDialog` confirmation before firing.

## Detection — BE → FE direction

- Every tRPC procedure exported under `packages/api/src/routers/` is matched against FE import sites in `apps/web/src/`, `apps/public-api/src/`, and `apps/landing/src/`.
- A procedure with zero FE consumers is flagged as an orphan finding.
- Orphans are listed in the report only; the audit does not auto-wire orphans to UI and does not delete orphan procedures.
- Orphans known to be consumed by jobs, cron, webhooks, or external `public-api` callers are tagged "intentional non-UI" in the report and counted separately.

## Conventions enforced

- Toasts use `sonner` directly: `toast.success(msg)` in `onSuccess`, `toast.error(err.message)` in `onError`. No wrapper hooks added.
- Toast success and error messages are user-readable strings, not raw error objects or technical jargon.
- Invalidation uses `trpc.<router>.<procedure>.invalidate()` (or `trpc.<router>.invalidate()` for whole router) via `useUtils()` in `onSuccess`.
- Invalidation scope is narrowed to the affected router/procedure, not blanket `utils.invalidate()`.
- Mutation trigger element (button, menu item) reads `mutation.isPending` and renders disabled + loading indicator while pending.
- Destructive actions render a confirmation `AlertDialog` between user click and mutation fire.

## Severity classification

- HIGH: destructive mutation with no confirmation dialog; mutation fires but never updates UI (no invalidation AND no router push); mutation silently fails (no error toast); orphan procedure under destructive verb (delete/archive/revoke).
- MED: mutation missing success toast; mutation missing invalidation; mutation missing error toast on a non-destructive action; orphan procedure under non-destructive verb.
- LOW: missing loading spinner; trigger not disabled during pending; toast message too technical or untranslated.

## Report structure

- Report lists findings grouped by severity (HIGH first), then by router/domain.
- Each finding includes: severity tag, file path with line number, one-sentence problem statement, one-sentence fix description.
- Report includes a summary table: total findings per severity per domain.
- Report includes an "intentional non-UI" appendix listing procedures correctly invoked from non-FE callers, with their caller location.

## Fix execution

- Fixes are applied in severity order: HIGH → MED → LOW.
- Each fix is a single atomic commit referencing the finding ID from the report.
- Fixes that require new UI (e.g., adding a confirmation dialog) follow the existing component patterns in `apps/web/src/components/ui/`.
- Fixes that require new toast strings reuse existing i18n namespaces where translations exist; otherwise use plain English with a `// TODO: i18n` marker.
- No fix introduces a new abstraction layer; all changes use direct `sonner` and `useUtils()` calls.

## Done condition

- Report exists at `goals/fe-be-integration-audit/AUDIT.md` covering 100% of routers and 100% of mutation call sites in scope.
- All HIGH and MED findings have a corresponding commit applying the fix.
- LOW findings either have fixes applied or are explicitly deferred with rationale in the report.
- `pnpm run typecheck` passes on the final state.
- `pnpm run lint` passes on the final state.
