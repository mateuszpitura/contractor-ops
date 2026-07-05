# Phase 97: Theme B — HR Dashboard - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning
**UI phase:** yes — run `/gsd:ui-phase 97` for a UI-SPEC before/alongside planning.

<domain>
## Phase Boundary

HR sees **workforce health at a glance** on a staff-side dashboard (NOT the portal) across:
headcount, vacation utilization, document expiry, probation, and Gulf nationalization.

- **HR-DASH-01** headcount — total / by department / jurisdiction / employment-type / contract-end date.
- **HR-DASH-02** vacation-utilization — days taken vs entitled per worker; flags under-utilization (>10 unused days approaching year-end).
- **HR-DASH-03** document-expiry (visa / work-permit / contract-renewal / medical-cert / training-cert) composing with the **v6.0 F1 compliance-document engine**.
- **HR-DASH-04** probation-end watchlist — auto-surface workers within 14 / 7 / 0 days.
- **HR-DASH-05** Saudization / Emiratisation rollup composing with **v6.0 F3 Gulf operational polish**.

**Depends on:** Phases 90–93 (employee registry + leave + document data). P90 promoted the
department / jurisdiction / employment-type / status / Saudization columns **specifically for this dashboard**.

**NOT this phase:**
- Reimplementing document-expiry, reminder-digest, or nationalization-rate logic — this phase **composes** F1/F3.
- The employee/manager self-service portal (P96) — this is the org-wide HR/staff view.
- Own leave/time/akta engines — read-only aggregation over P90–93 data.
</domain>

<decisions>
## Implementation Decisions

### Aggregation Strategy (HR-DASH-01/02) — D-01
- **D-01:** **On-demand `groupBy` aggregation procedures + `report-rate-limit`.** New `hrDashboard.*` (or `report.*`-family)
  tRPC procedures use Prisma `groupBy` over **P90's promoted/indexed columns** (department, jurisdiction, employment-type,
  status, contract-end, Saudization category) — the columns P90 promoted for exactly this. Protect them with the existing
  **`report-rate-limit`** middleware (30/min/org, since these are multi-table aggregates). React Query caching on the client.
  **No materialized read-model / cache table** in v7.0 (single-org dashboard volume doesn't warrant it). Vacation utilization =
  per-worker days-taken (P92) vs entitled, with the >10-unused-near-year-end flag computed in the aggregation procedure.

### Composition vs Rebuild (HR-DASH-03 + HR-DASH-05) — D-02
- **D-02:** **Compose the existing engines; add a thin employee-doc adapter.**
  - **HR-DASH-03** reads the **`packages/compliance-policy`** per-jurisdiction expiry rules + **`compliance-reminder-scan`**
    expiry outputs (visa / work-permit / contract-renewal / medical / training). Because F1 was **contractor**-oriented, add a
    **thin adapter** so **employee akta documents (P91)** feed the same expiry engine — do NOT fork the expiry/TZ/digest logic.
  - **HR-DASH-05** **extends the existing `saudization-dashboard` service** (`packages/api/src/services/saudization-dashboard.ts`
    + the `saudization-dashboard` component) to add **Emiratisation / UAE** alongside KSA — reuse its headcount + nationalisation-rate shape.
  - Zero reimplementation of expiry, reminder-digest, or rate computation.

### Probation Watchlist + Under-Utilization (HR-DASH-04, HR-DASH-02) — D-03
- **D-03:** **Read-only watchlist widgets in v7.0; the reminder-cron decision is the planner's.** Probation 14/7/0-day windows
  and the >10-unused-days-near-year-end flag are computed via **date-window queries** and surfaced as **dashboard widgets**
  (satisfies "auto-surface"). **Whether to also emit proactive notifications** by reusing the digest-throttled
  `compliance-reminder-scan` infra is **deferred to the planner** — if wired, it MUST reuse the existing digest throttle
  (the v1.0 spam lesson), never a per-item notification.

### Access + Degradation — D-04
- **D-04:** **HR-role RBAC + per-widget empty states.** Gate the dashboard on **`module.workforce-employees`** + the HR roles
  (**`HR_ADMIN` / `HR_MANAGER`**, WORKER-04); tenant-scoped aggregation (`organizationId` from session, never client input).
  Each widget renders a proper **empty/unavailable** state when its source surface isn't live for the org (e.g. P92 leave is
  partial) — the dashboard ships independent of sibling completion.

### Cross-Cutting (carried forward — not re-asked)
- **D-05:** Staff **web-vite dashboard layering** — page (thin composer) → container (section loading/empty/error) → hook
  (sole tRPC boundary) → presentational widget, mirroring `pages/dashboard/reports.tsx` (ExpiringContractsReport / OverdueInvoices
  widget+hook pattern). NOT the portal.
- **D-06:** `frontend-design` + impeccable at build; WCAG (keyboard/focus/contrast/semantic); mandatory loading/empty/error;
  i18n parity en / de / pl / ar (RTL) / en-US. Documentation-follows-code: new dashboard routes/hooks/widgets + the employee-doc
  adapter → domain wiki + `structure/web-vite-domains.md` + `structure/key-services.md` in the same change set.
- **D-07:** No `console.*` (`@contractor-ops/logger`); `writeAuditLog` if any sensitive read/export is added; no unsafe `as`.

### Claude's Discretion
- Namespace choice (`hrDashboard.*` vs extending `report.*`/`dashboard.*`) + which procedures carry `report-rate-limit`.
- The employee-akta-doc → compliance-policy adapter shape (whether F1 is already worker-generic or needs a mapping layer).
- Whether to wire the probation/under-utilization reminder cron (D-03) — and if so, the event/digest shape.
- Exact widget → source-surface flag mapping for the empty states.
- Emiratisation extension shape within the saudization-dashboard service (shared vs per-country rollup).
- Route placement in the staff dashboard nav + UI-SPEC via `/gsd:ui-phase`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope + requirements
- `.planning/ROADMAP.md` §"Phase 97: Theme B — HR Dashboard" (goal, success criteria, UI-hint, "composes with v6.0 F1 + F3")
- `.planning/REQUIREMENTS.md` — HR-DASH-01..05

### Data sources (upstream phases)
- `.planning/milestones/v7.0-phases/90-theme-b-employee-registry-per-market-6/90-CONTEXT.md` — `EmployeeProfile` + promoted columns (dept / jurisdiction / employment-type / status / Saudization) explicitly added for this dashboard; HR roles
- `.planning/milestones/v7.0-phases/91-*` (akta / documents) + `92-*` (leave/time) + `93-*` (probation / offboarding) CONTEXT — the widget data surfaces

### Compose targets — v6.0 F1 compliance-document engine (HR-DASH-03)
- `packages/compliance-policy/src/policies/*.ts` — per-jurisdiction expiry rules (KSA Qiwa work-permit, DE Aufenthaltstitel, UK right-to-work) with expiry TZ + severity
- `packages/api/src/services/compliance-reminder-scan.ts` — expiry scan + two-pass digest throttle (do NOT bypass the digest layer — documented v1.0 spam lesson)
- `packages/api/src/services/compliance-recovery.ts` — renewal-reset listener surface

### Compose targets — v6.0 F3 Gulf polish (HR-DASH-05)
- `packages/api/src/services/saudization-dashboard.ts` — headcount + nationalisation-rate service to extend for Emiratisation
- `apps/web-vite/src/components/saudization/saudization-dashboard.tsx` — existing Gulf dashboard component + headcount stat pattern

### Reuse — dashboard aggregation idiom (HR-DASH-01/02)
- `packages/api/src/middleware/report-rate-limit.ts` — 30/min/org cap on `report.*`/`dashboard.*` aggregate reads (apply to the new procedures)
- `packages/api/src/routers/finance/invoice-crud.ts` (~L509) — `ctx.db.*.groupBy({ by, _count })` aggregation pattern
- `apps/web-vite/src/pages/dashboard/reports.tsx` — widget + hook + container pattern (ExpiringContractsReport / OverdueInvoices) to mirror

### Conventions
- `apps/web-vite/ARCHITECTURE.md` — staff dashboard layering (page → container → hook = sole tRPC boundary → presentational)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`packages/compliance-policy` + `compliance-reminder-scan`** — the F1 expiry engine (per-jurisdiction rules, TZ math, digest throttle); HR-DASH-03 composes it via an employee-akta-doc adapter.
- **`saudization-dashboard` service + component** — existing Gulf headcount + nationalisation rate; HR-DASH-05 extends for Emiratisation.
- **`report-rate-limit` middleware + `groupBy` idiom** — proven multi-table aggregate pattern for HR-DASH-01/02.
- **`reports.tsx` widget/hook pattern** — staff dashboard widget composition to mirror.
- **P90 promoted columns** — dept / jurisdiction / employment-type / status / Saudization, indexed for exactly these aggregations.

### Established Patterns
- **Server-side aggregation** under `report.*`/`dashboard.*` with `report-rate-limit`; tenant-scoped; no client-supplied ids.
- **Compose, don't rebuild** — reuse F1 expiry + digest + F3 nationalization; adapter over fork.
- **Feature-gated widgets + empty states** when a source surface is dark (D-04).
- **web-vite dashboard layering** (page → container → hook → presentational); i18n parity + RTL; WCAG.

### Integration Points
- New `hrDashboard.*` procedures (or `report.*` extension) with `report-rate-limit`, reading P90–93 data.
- Thin adapter: employee akta docs (P91) → compliance-policy expiry engine (HR-DASH-03).
- Emiratisation extension inside `saudization-dashboard.ts` (HR-DASH-05).
- New staff dashboard route + widget/hook set (mirror reports.tsx); nav entry gated on module + HR roles.

</code_context>

<specifics>
## Specific Ideas

- P90 promoted its indexed columns *for this phase* — HR-DASH-01 aggregation should lean on them, not JSON scans.
- "Composes with v6.0 F1/F3" is literal — the expiry engine and the Saudization service already exist; extend them, add Emiratisation, adapt for employee docs.
- Respect the `compliance-reminder-scan` digest throttle if any notification is wired — the no-digest version already failed once (v1.0 spam).

</specifics>

<deferred>
## Deferred Ideas

- **Proactive probation / under-utilization notification cron** — planner's call (D-03); if built, must reuse the digest throttle.
- **Materialized dashboard read-model** — only if single-org aggregate volume proves it necessary.
- **Employee/manager self-service portal** — Phase 96 (this is the org-wide HR view).

None are in Phase 97 scope beyond what the planner may fold from D-03 — recorded so they aren't lost.

</deferred>

---

*Phase: 97-theme-b-hr-dashboard*
*Context gathered: 2026-07-05*
