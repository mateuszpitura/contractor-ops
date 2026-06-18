# Phase 89: Theme B — Worker Model Abstraction (serial gate) - Context

**Gathered:** 2026-06-18
**Status:** Ready for planning

<domain>
## Phase Boundary

The Theme B **serial gate** — the platform learns to model employees as a discriminated `Worker`
type, with **zero regression to v1–v6 contractor read paths**. No other Theme B phase (90–97)
starts until this lands. It is the thinnest possible foundation:

1. **Worker discriminated union** (WORKER-01) — a `Worker` base table; `Contractor` and `Employee`
   link to it; `workerType` defaults to `CONTRACTOR`.
2. **tRPC namespace split** (WORKER-02) — shared `workerRouter` + the existing `contractorRouter`
   (route shapes preserved, snapshot-locked) + a new (skeleton) `employeeRouter`.
3. **Tenant + per-type RBAC** (WORKER-03) — `organizationId` invariant on `Worker`; HR-only fields
   gated by per-type RBAC.
4. **4 new roles** (WORKER-04) — `HR_ADMIN`, `HR_MANAGER`, `PAYROLL_OFFICER`, `LEAVE_APPROVER`
   (existing roles unchanged).
5. **Flag gating** (WORKER-05) — `module.workforce-employees` gates all Theme B routes; flag-off =
   web-vite render-tree removal + tRPC FORBIDDEN/NOT_FOUND (v5.0 classification flag-off pattern).

**NOT this phase (scope fence):**
- **Employee profile fields / per-market statutory identifiers** → **Phase 90** (this gate ships an
  `Employee` table skeleton + the abstraction, NOT the field set).
- Leave / time / akta / on-offboarding / payroll / HRIS / portal / HR-dashboard → **Phases 91–97**.
- The `employeeRouter` is a **skeleton** (flag-gated, minimal/empty procedures) — populated later.
</domain>

<decisions>
## Implementation Decisions

### Worker Model Shape (WORKER-01) — AMENDS the original requirement
- **D-01:** **Dedicated `Worker` base table; `Contractor` and `Employee` link to it; `workerType` discriminator (default `CONTRACTOR`).** This is the normalized model the user chose over the additive-`workerType`-on-Contractor option. **It AMENDS WORKER-01's original "zero data migration / extend Contractor in place" phrasing** (REQUIREMENTS.md updated 2026-06-18). Shared identity/worker fields live on `Worker`; contractor-specific data stays on the existing `Contractor` (+ `ContractorBillingProfile`); employee-specific data lands on a P90 `EmployeeProfile`.
- **D-02:** **The migration is a ONE-TIME, additive, idempotent, per-region, reversible backfill** — create the `Worker` table, then backfill one `Worker` row per existing v1–v6 contractor and link it; NO contractor row destroyed or lossily relinked. `[BLOCKING]` multi-region migration (EU/ME/US) at a human gate (P83–88 convention), with an explicit down/rollback path. This is the **highest-risk operation in the milestone so far** — treat accordingly.
- **D-03:** **Zero contractor-path regression is the gate's pass condition.** Contractor parity (lists, dashboards, payment-runs, classification-scans, exports, portal) MUST be verified on a **staging snapshot of the largest org** before the backfill is accepted (the original WORKER-01 success criterion is retained). A Wave-0 regression suite locks the behavior before any model change.

### Contractor Query-Site Filtering (WORKER-02 / regression crux) — 67 files / ~252 reads
- **D-04:** **Central Prisma extension `withWorkerTypeDefault`**, chained after the existing `withTenantScope` / `withSoftDelete` extensions (`packages/db/src/index.ts` `createTenantClient`). It auto-injects `workerType='CONTRACTOR'` on `contractor.*` (and the worker-base) reads so existing contractor lists/dashboards/payment-runs/classification-scans never accidentally include Employees — **can't-forget across all 67 sites**, mirroring the proven soft-delete/tenant extension pattern.
- **D-05:** **Explicit-where-wins opt-out.** The extension injects the `CONTRACTOR` default ONLY when the query's `where` does not already specify `workerType` — so the shared `workerRouter` (cross-type) and `employeeRouter` (`workerType='EMPLOYEE'`) pass an explicit `workerType` and are not force-filtered. Mirrors how soft-delete respects an explicit `deletedAt`. A lint/grep guard + the regression suite back it up.

### Router Split + Route-Shape Preservation (WORKER-02)
- **D-06:** **Shared `workerRouter` (cross-type ops) + the existing `contractorRouter` (shapes preserved) + a skeleton `employeeRouter`.** The `contractorRouter` composition (`core + country + tax + engagements + bulk`) and its `contractor` mount in `root.ts` are unchanged in shape.
- **D-07:** **Wave-0 RED contract/snapshot test** captures the existing `contractor.*` procedure names + input/output shapes BEFORE the split; any accidental shape drift fails CI (no such snapshot exists today — greenfield). Directly satisfies "route shapes preserved (snapshot-locked)".

### RBAC (WORKER-03 / WORKER-04)
- **D-08:** **Add a new `employee` resource + 4 roles** (`HR_ADMIN`, `HR_MANAGER`, `PAYROLL_OFFICER`, `LEAVE_APPROVER`) in `packages/auth/src/{roles.ts,permissions.ts}`; existing roles unchanged. HR-only fields gated by per-type RBAC (employee resource actions). Do NOT touch the pre-existing duplicated `allPermissions` const on `owner` (out of scope; note it).
- **D-09:** **`organizationId` tenant invariant on `Worker`** — `Worker` is tenant-owning (NOT in `globalModels`); cross-org leak test on the new table; inherits the `withTenantScope` extension.

### Flag Gating (WORKER-05)
- **D-10:** **Reuse the existing `module.workforce-employees` flag** (already registered PENDING in `flags-core.ts`/signoff-registry from P82 — do NOT re-register). Flag-off = the proven v5.0 pattern: `root.ts` conditional-spread of the Theme B routers (→ tRPC METHOD_NOT_FOUND / FORBIDDEN) + per-request guard middleware; web-vite `useFlag('module.workforce-employees')` render-tree removal of `/employee/*` surfaces.

### Cross-Cutting (carried forward — not re-asked)
- **D-11:** `Worker`/`Employee` are tenant-owning models — never in `globalModels`; cross-org leak test per new model.
- **D-12:** Store against the new `Worker`/`Contractor` model now; this is the abstraction that later lets Theme A re-point its `Contractor` FKs to `Worker` if ever needed (out of scope here).
- **D-13:** `writeAuditLog` on the backfill migration (a system-actor audit row recording the one-time backfill) + on any new worker/employee mutation; the migration is idempotent + reversible.
- **D-14:** i18n parity en/en-US/de/pl/ar for any new user-facing strings (minimal this phase — mostly backend + a flag-gated skeleton).

### Claude's Discretion
- Exact `Worker` base-table columns (shared identity: `organizationId`, name, email, status, `workerType`, timestamps) vs what stays on `Contractor`; the `Contractor`→`Worker` FK/relation shape and whether `Contractor.id` becomes `workerId` or a 1:1 relation — planner, preserving zero contractor-row loss.
- The backfill migration mechanics (raw SQL vs Prisma script), batching, per-region ordering, and the down/rollback script — planner; must be idempotent + re-runnable.
- The `withWorkerTypeDefault` extension's exact model-targeting (which Prisma models it scopes) and the explicit-where-wins detection.
- The route-shape snapshot format (Vitest snapshot of the router def vs a generated contract artifact).
- The `employee` permission action set + per-role grants.
- Whether the regression suite runs against a seeded fixture vs a documented staging-snapshot procedure (the largest-org snapshot is an operational verify step).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone planning
- `.planning/REQUIREMENTS.md` — WORKER-01..05 verbatim; **WORKER-01 amended 2026-06-18** (Worker base table + one-time additive backfill, supersedes zero-migration phrasing — see D-01/D-02); line 14 theme-ordering (WORKER-01 = the only Theme B serialization point).
- `.planning/ROADMAP.md` (Phase 89 entry) — goal + 4 success criteria (zero-migration-on-staging-snapshot, shapes preserved, tenant+RBAC, flag-off) + research flag (the contractor-corruption pitfall).
- `.planning/milestones/v7.0-BACKLOG.md` — Theme B block; locked-decision #2/#9 (WORKER-01 serial gate).
- `.planning/phases/82-...82-CONTEXT.md` — the add-on + flag registry (`module.workforce-employees` registered here).

### Model + migration + filtering
- `packages/db/prisma/schema/contractor.prisma` (`Contractor` model — tenant-scoped, existing `type: ContractorType` entity-type which is NOT the worker discriminator, soft-delete, 10 indexes; `ContractorBillingProfile`) — the model the `Worker` base abstracts.
- `packages/db/src/tenant.ts` (`withTenantScope`) + `packages/db/src/soft-delete.ts` (`withSoftDelete`, Contractor in `softDeleteModels`) + `packages/db/src/index.ts` (`createTenantClient` = `withSoftDelete(withTenantScope(base))`) — the extension chain to add `withWorkerTypeDefault` to (D-04/D-05).
- `packages/api/src/routers/core/contractor-shared.ts` (`buildContractorListWhere`) + `contractor-core.ts` (CRUD entry) + `contractor.ts` (`contractorRouter` composition) — the list path + the router whose shape must be preserved.

### RBAC + flag
- `packages/auth/src/roles.ts` (existing roles; the duplicated `allPermissions` on `owner` — note, don't fix) + `permissions.ts` (`accessControlStatement`) — add `employee` resource + 4 roles (D-08).
- `packages/feature-flags/src/flags-core.ts` (`module.workforce-employees` ~line 220) + `signoff-registry-flags.json` (PENDING) — reuse, don't re-register (D-10).
- `packages/api/src/root.ts` (classification conditional-spread lines ~116-149; us-expansion ~157-163) — the flag-off conditional-spread pattern to mirror; `apps/web-vite/src/components/dashboard/dashboard-home.tsx` (`useFlag` render-removal).

### Documentation-follows-code (update in the same change set)
- `.planning/brain/wiki/domains/` (a Worker/employee-foundation domain page), `wiki/structure/{prisma-schema-areas.md (Worker base + workerType + backfill), api-routers-catalog.md (workerRouter/employeeRouter split), key-services.md}`, `wiki/patterns/` (the worker-type Prisma extension + the per-type RBAC + flag-off pattern), `wiki/log.md` + `hot.md`; `.planning/MEMORY.md` for the "Worker base table + one-time backfill (WORKER-01 amended)" + "contractor reads are workerType-scoped by a central extension" invariants.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Prisma extension chain** (`withTenantScope` → `withSoftDelete` in `packages/db/src/index.ts`) — add `withWorkerTypeDefault` as a third link (D-04); the explicit-where-wins idiom mirrors soft-delete's `deletedAt` handling (D-05).
- **`buildContractorListWhere`** + `contractor-core.ts` — the central list path the default also covers.
- **`module.workforce-employees` flag** (already PENDING from P82) + the v5.0 classification conditional-spread + web-vite `useFlag` render-removal — the entire WORKER-05 flag-off mechanism is a proven pattern (D-10).
- **`roles.ts`/`permissions.ts`** — additive resource + roles (D-08).
- **`withTenantScope` + cross-org leak test idiom** — `Worker` inherits it (D-09).

### Established Patterns
- **Additive, reversible, idempotent migrations** (P83–88 multi-region) — the backfill follows it, but is the first one doing a **data backfill** over existing rows (not just additive columns) → highest risk (D-02).
- **Can't-forget central filter via Prisma extension** (soft-delete) — extended to worker-type (D-04).
- **Flag-off = conditional router spread + render-tree removal** (v5.0 classification) — reused (D-10).
- **Tenant-owning model never in globalModels + cross-org leak test** (every prior tenant model).
- **Snapshot/contract locking before a refactor** — new here (no tRPC snapshots today) but the discipline is standard (D-07).

### Integration Points
- The `Worker` base table is the new identity root; `Contractor` links to it; the central extension scopes contractor reads to `workerType='CONTRACTOR'`; the `employeeRouter` (P90+) queries `workerType='EMPLOYEE'`.
- The backfill must run after the `Worker` table + FK exist and before the contractor reads are re-scoped — ordering is load-bearing (planner sequences it).
- Theme B phases 90–97 all depend on this gate; the `module.workforce-employees` flag keeps the half-built employee surface dark until each phase ships.

</code_context>

<specifics>
## Specific Ideas

- **This is a true gate, not a feature** — its deliverable is *the abstraction + zero contractor regression*, verified on a real largest-org staging snapshot, behind a dark flag. Get the foundation right; employee features come in 90–97.
- **The user deliberately chose normalization over the easy path** — a real `Worker` base table + a one-time backfill, accepting that it amends WORKER-01's zero-migration phrasing. The trade is cleaner long-term modeling for a higher-risk one-time migration; the mitigation is idempotent + reversible + staging-snapshot-verified.
- **Can't-forget beats audit-67-sites** — the central `withWorkerTypeDefault` extension is chosen precisely because 67 hand-edited filter sites is the corruption pitfall; explicit-where-wins keeps cross-type queries honest.
- **Lock the contract before you move it** — the Wave-0 contractor route-shape snapshot is what makes "preserved shapes" verifiable rather than aspirational.

</specifics>

<deferred>
## Deferred Ideas

- **Employee profile fields / per-market statutory identifiers** → Phase 90 (this gate ships only the `Employee` table skeleton + abstraction).
- **Populating the `employeeRouter`** (registry/leave/time/etc. procedures) → Phases 90–97.
- **Re-pointing Theme A `Contractor` FKs to `Worker`** → out of scope; the abstraction enables it later if needed.
- **Fixing the pre-existing duplicated `allPermissions` on `owner`** → noted, not in scope.
- **Live `module.workforce-employees` enablement** → stays PENDING/dark until the Theme B surface is built.

None of these expand the gate's scope — discussion stayed within the Worker-abstraction + zero-regression boundary.

</deferred>

---

*Phase: 89-theme-b-worker-model-abstraction-serial-gate*
*Context gathered: 2026-06-18*
