# Phase 37: Shipment Task Auto-Completion Wiring - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Webhook and polling paths trigger workflow task auto-completion when shipments reach target status. The `checkShipmentTaskCompletion` function already exists and works — this phase wires it into InPost webhook handler, InPost polling service, DPD polling service, and UPS polling service. Also creates missing DPD/UPS cron routes so polling services can actually run. Closes MISSING-02 from v3.0 audit.

</domain>

<decisions>
## Implementation Decisions

### Wiring Approach
- **D-01:** Direct import of `checkShipmentTaskCompletion` from `equipment-workflow.ts` into each webhook handler and polling service — no callback injection or dependency inversion
- **D-02:** Fire-and-forget calls using `void checkShipmentTaskCompletion(...)` pattern, matching the existing pattern in `equipment.ts` router (lines 1265, 1454). Non-blocking — webhook response and polling loop are not delayed by task completion logic

### DPD/UPS Cron Routes
- **D-03:** Create `dpd-status-poll` and `ups-status-poll` cron routes in `apps/web/src/app/api/cron/` following the exact `inpost-status-poll` pattern. Without these routes, the DPD/UPS polling services are dead code
- **D-04:** Register QStash schedules for both new cron routes (same frequency pattern as InPost polling — every 30-60 min per Phase 35 D-07)

### Error Handling
- **D-05:** No extra error handling at call sites. `checkShipmentTaskCompletion` already has internal try/catch with `console.error` logging. Fire-and-forget means webhook/polling cannot fail due to task completion issues

### Testing Strategy
- **D-06:** Unit tests with mocked `checkShipmentTaskCompletion` in existing webhook handler and polling service test suites — verify function is called with correct arguments (shipment id, direction, currentStatus) when shipment reaches DELIVERED or RETURNED
- **D-07:** One integration test per path (webhook + polling) for the happy path end-to-end: create shipment linked to workflow task, simulate status update to DELIVERED/RETURNED, verify task status changes to DONE and workflow progress recomputes

### Claude's Discretion
- Exact placement of the `void checkShipmentTaskCompletion(...)` call within each service (after shipment status update vs after equipment status update)
- DPD/UPS cron route authentication/authorization pattern (follow InPost cron route)
- QStash schedule registration approach (env vars, manual setup docs, or infrastructure-as-code)
- Integration test fixture setup (how to create minimal shipment + task + workflow chain)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Task auto-completion function
- `packages/api/src/services/equipment-workflow.ts` — `checkShipmentTaskCompletion` function (line 169), checks all linked shipments, auto-completes task, recomputes workflow progress
- `packages/api/src/routers/equipment.ts` — Existing call sites at lines 727, 1265, 1454 showing the fire-and-forget pattern

### InPost webhook + polling (wiring targets)
- `packages/api/src/services/courier/inpost-webhook-handler.ts` — Webhook handler that updates shipment + equipment but skips task completion
- `packages/api/src/services/courier/inpost-polling-service.ts` — Polling service with same gap (lines 128-163 show status update without task completion call)
- `apps/web/src/app/api/webhooks/inpost/route.ts` — InPost webhook API route
- `apps/web/src/app/api/cron/inpost-status-poll/route.ts` — InPost polling cron route (pattern to replicate for DPD/UPS)

### DPD/UPS polling (wiring targets + cron route creation)
- `packages/api/src/services/courier/dpd-polling-service.ts` — DPD polling service (same gap as InPost)
- `packages/api/src/services/courier/ups-polling-service.ts` — UPS polling service (same gap as InPost)

### Existing tests (extend for coverage)
- `packages/api/src/services/courier/__tests__/inpost-webhook-handler.test.ts` — InPost webhook tests to extend
- `packages/api/src/services/courier/__tests__/inpost-polling-service.test.ts` — InPost polling tests to extend
- `packages/api/src/services/__tests__/equipment-workflow.test.ts` — `checkShipmentTaskCompletion` unit tests (line 414)

### Requirements
- `.planning/REQUIREMENTS.md` — EQUIP-09 (shipment status auto-completes linked workflow task), EQUIP-10 (all carriers trigger task completion)
- `.planning/ROADMAP.md` §Phase 37 — Success criteria, dependency chain
- `.planning/v3.0-MILESTONE-AUDIT.md` — MISSING-02 gap definition

### Prior phase decisions
- `.planning/phases/30-equipment-tracking-foundation/30-CONTEXT.md` — D-15 (outbound=DELIVERED, return=RETURNED), D-16 (one task covers all equipment)
- `.planning/phases/33-inpost-courier-integration/33-CONTEXT.md` — D-05 (webhook primary + polling fallback), D-07 (webhook pipeline pattern)
- `.planning/phases/35-feature-gating-dpd-ups-billing-polish/35-CONTEXT.md` — D-07 (polling only for DPD/UPS)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `checkShipmentTaskCompletion`: Fully implemented, handles multi-shipment tasks, idempotent, self-contained error handling
- `inpost-status-poll` cron route: Complete reference implementation for DPD/UPS cron routes
- All 3 polling services already have the status update logic — just need one additional function call

### Established Patterns
- Fire-and-forget with `void` prefix for async side effects (equipment router lines 1265, 1454)
- Duplicated status maps (`SHIPMENT_TO_EQUIPMENT_STATUS`, `EQUIPMENT_STATUS_TRANSITIONS`) across polling services to avoid circular imports
- QStash cron route pattern: Next.js API route → load org configs → call polling service per org

### Integration Points
- Webhook handler: call after shipment status update (after `db.shipment.update` + equipment status update)
- Polling services: call after shipment status update in the per-shipment loop (after equipment status advance)
- New cron routes connect to existing QStash scheduling infrastructure

</code_context>

<specifics>
## Specific Ideas

No specific requirements — straightforward wiring following established patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 37-shipment-task-auto-completion*
*Context gathered: 2026-04-05*
