# Phase 37: Shipment Task Auto-Completion Wiring - Research

**Researched:** 2026-04-05
**Domain:** Courier webhook/polling to workflow task completion wiring
**Confidence:** HIGH

## Summary

This phase closes MISSING-02 from the v3.0 audit: webhook and polling paths update shipment status but skip `checkShipmentTaskCompletion`, so workflow tasks linked to shipments never auto-complete via external status updates. The fix is adding one function call to each of 4 code paths (InPost webhook handler, InPost polling service, DPD polling service, UPS polling service).

The `checkShipmentTaskCompletion` function is fully implemented, idempotent, and self-contained with internal error handling. Three existing call sites in `equipment.ts` router demonstrate the exact fire-and-forget pattern. The existing `inpost-status-poll` cron route already polls all 3 carriers (InPost, DPD, UPS) in a single endpoint, so the CONTEXT.md decision D-03 (create separate DPD/UPS cron routes) is already satisfied -- no new cron routes are needed.

**Primary recommendation:** Add `void checkShipmentTaskCompletion(db, organizationId, { id, workflowTaskRunId, direction, currentStatus })` after each status update in the 4 service files, following the existing fire-and-forget pattern. Extend existing test suites to verify the call is made with correct arguments.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Direct import of `checkShipmentTaskCompletion` from `equipment-workflow.ts` into each service -- no callback injection or dependency inversion
- **D-02:** Fire-and-forget calls using `void checkShipmentTaskCompletion(...)` pattern, matching existing pattern in equipment.ts router (lines 1265, 1454). Non-blocking
- **D-03:** Create `dpd-status-poll` and `ups-status-poll` cron routes (NOTE: already satisfied -- unified cron route at `inpost-status-poll` already polls all 3 carriers)
- **D-04:** Register QStash schedules for new cron routes (NOTE: already satisfied -- single cron already registered)
- **D-05:** No extra error handling at call sites. `checkShipmentTaskCompletion` already has internal try/catch
- **D-06:** Unit tests with mocked `checkShipmentTaskCompletion` -- verify function called with correct arguments when shipment reaches DELIVERED or RETURNED
- **D-07:** One integration test per path for happy path end-to-end

### Claude's Discretion
- Exact placement of the `void checkShipmentTaskCompletion(...)` call within each service (after shipment status update vs after equipment status update)
- Integration test fixture setup (how to create minimal shipment + task + workflow chain)

### Deferred Ideas (OUT OF SCOPE)
None.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EQUIP-09 | Onboarding workflow task "Ship equipment" auto-creates shipment, offboarding task "Return equipment" triggers return request | Task auto-completion function exists at `equipment-workflow.ts:169`; needs wiring into webhook/polling paths so external status updates trigger it |
| EQUIP-10 | Workflow task auto-completes when shipment reaches target status (e.g., "delivered") | `checkShipmentTaskCompletion` checks direction-specific targets (OUTBOUND->DELIVERED, RETURN->RETURNED); currently only called from manual `addShipmentEvent` tRPC mutation, not from webhook/polling |
</phase_requirements>

## Architecture Patterns

### Existing Fire-and-Forget Pattern (from equipment.ts router)

**What:** Async side-effect call that does not block the main flow
**When to use:** When task completion is a side effect of status update, not the primary operation

**Pattern A -- IIFE wrapper (equipment.ts line 727):**
```typescript
// Source: packages/api/src/routers/equipment.ts:727
void (async () => {
  await checkShipmentTaskCompletion(prisma, ctx.organizationId, {
    id: shipment.id,
    workflowTaskRunId: shipment.workflowTaskRunId,
    direction: shipment.direction as "OUTBOUND" | "RETURN",
    currentStatus: input.status,
  });
})();
```

**Pattern B -- Direct void with .catch (equipment.ts line 1265):**
```typescript
// Source: packages/api/src/routers/equipment.ts:1265
void checkShipmentTaskCompletion(prisma, ctx.organizationId, {
  id: shipments[0].id,
  workflowTaskRunId: input.workflowTaskRunId,
  direction: input.direction,
  currentStatus: "CREATED",
}).catch(console.error);
```

**Recommendation:** Use Pattern B (direct void with .catch) for the 4 new call sites. It is simpler, explicit about error handling, and used at 2 of the 3 existing call sites.

### Wiring Insertion Points

Each service follows the same structure: update shipment status, then auto-advance equipment status. The `checkShipmentTaskCompletion` call should go **after** the shipment status update (after `db.shipment.update`) because:
1. The function reads `currentStatus` from the shipment parameter, not from DB
2. Equipment status advancement is independent -- task completion checks shipment status, not equipment status
3. Placing it after equipment update would mean the call only fires when equipment also transitions, missing cases where equipment is already at target status

**InPost Webhook Handler** (`inpost-webhook-handler.ts`):
- Insert after line 174 (after `db.shipment.update`) and before line 177 (equipment status logic)
- The `shipment` variable from `findFirst` has `workflowTaskRunId`, `direction`, `id`
- `mappedStatus` is the `currentStatus` to pass

**InPost Polling Service** (`inpost-polling-service.ts`):
- Insert after line 141 (after `db.shipment.update`) and before line 144 (equipment status logic)
- The `shipment` from the `for` loop has all needed fields
- `mappedStatus` is the `currentStatus` to pass

**DPD Polling Service** (`dpd-polling-service.ts`):
- Insert after line 141 (after `db.shipment.update`) and before line 144 (equipment status logic)
- Same pattern as InPost polling

**UPS Polling Service** (`ups-polling-service.ts`):
- Insert after line 141 (after `db.shipment.update`) and before line 144 (equipment status logic)
- Same pattern as UPS polling

### Import Statement

Each service file needs one new import:
```typescript
import { checkShipmentTaskCompletion } from "../equipment-workflow.js";
```

Note: The service files use loosely typed `PrismaClient = any`, and `checkShipmentTaskCompletion` accepts `PrismaClient` from Prisma. The `db` parameter passed in each service is the same Prisma instance, so the types are compatible.

### Cron Route Status

**Key finding:** D-03 and D-04 are already satisfied. The unified cron route at `apps/web/src/app/api/cron/inpost-status-poll/route.ts` already imports and calls all three polling services:
- `pollInPostShipmentStatuses` (InPost)
- `pollDpdShipmentStatuses` (DPD)
- `pollUpsShipmentStatuses` (UPS)

Each carrier is wrapped in independent try/catch for resilience. No new cron routes or QStash schedules are needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Task completion logic | Custom completion check per service | `checkShipmentTaskCompletion` from equipment-workflow.ts | Already handles multi-shipment tasks, direction-specific targets, idempotency, workflow progress recomputation |
| Error isolation | try/catch in each call site | Internal try/catch in `checkShipmentTaskCompletion` + `.catch(console.error)` on void call | Function already has comprehensive error handling; adding more is redundant per D-05 |

## Common Pitfalls

### Pitfall 1: Passing stale shipment data
**What goes wrong:** Passing the shipment object from before the status update, so `currentStatus` is the old value
**Why it happens:** The shipment variable from `findFirst`/`findMany` has the old status before `db.shipment.update`
**How to avoid:** Pass `mappedStatus` (the new status) as `currentStatus`, not `shipment.currentStatus`
**Warning signs:** Task completion never triggers because `currentStatus` never equals target status

### Pitfall 2: Missing workflowTaskRunId in select
**What goes wrong:** `shipment.workflowTaskRunId` is undefined because the query doesn't include it in select
**Why it happens:** Some queries use explicit `select` clauses that omit fields
**How to avoid:** The polling services use `findMany` without explicit select (returns all fields). The webhook handler also has no explicit select. Both are safe.
**Warning signs:** `checkShipmentTaskCompletion` returns immediately (early return on null `workflowTaskRunId`)

### Pitfall 3: Import path extension
**What goes wrong:** Import fails at runtime
**Why it happens:** ESM requires `.js` extension in import paths
**How to avoid:** Use `import { checkShipmentTaskCompletion } from "../equipment-workflow.js"` (with `.js` extension)
**Warning signs:** Module not found errors

### Pitfall 4: Forgetting the deduplication context
**What goes wrong:** Task completion fires on every status update, even non-target statuses
**Why it happens:** Calling `checkShipmentTaskCompletion` unconditionally
**How to avoid:** This is actually fine -- `checkShipmentTaskCompletion` has its own early-return guard that checks if `currentStatus === targetStatus`. The function is safe to call on any status update. No conditional wrapping needed at call sites.

## Code Examples

### Webhook Handler Wiring (InPost)
```typescript
// Source: packages/api/src/services/courier/inpost-webhook-handler.ts
// After line 174 (db.shipment.update), before equipment status logic:

// 6b. Fire-and-forget: check workflow task auto-completion
void checkShipmentTaskCompletion(db, organizationId, {
  id: shipment.id,
  workflowTaskRunId: shipment.workflowTaskRunId,
  direction: shipment.direction as "OUTBOUND" | "RETURN",
  currentStatus: mappedStatus,
}).catch(console.error);
```

### Polling Service Wiring (InPost/DPD/UPS -- identical pattern)
```typescript
// Source: packages/api/src/services/courier/inpost-polling-service.ts
// After db.shipment.update, before equipment status logic:

// Fire-and-forget: check workflow task auto-completion
void checkShipmentTaskCompletion(db, organizationId, {
  id: shipment.id,
  workflowTaskRunId: shipment.workflowTaskRunId,
  direction: shipment.direction as "OUTBOUND" | "RETURN",
  currentStatus: mappedStatus,
}).catch(console.error);
```

### Unit Test Pattern (extending existing test suites)
```typescript
// Mock checkShipmentTaskCompletion at module level
vi.mock("../equipment-workflow", () => ({
  checkShipmentTaskCompletion: vi.fn().mockResolvedValue(undefined),
}));

import { checkShipmentTaskCompletion } from "../equipment-workflow";

// In test:
it("calls checkShipmentTaskCompletion after status update to DELIVERED", async () => {
  const mockShipment = {
    id: "ship-1",
    organizationId: "org-1",
    equipmentId: "equip-1",
    direction: "OUTBOUND",
    currentStatus: "IN_TRANSIT",
    workflowTaskRunId: "task-1",
    externalId: "12345678",
  };
  // ... setup mocks ...

  await handleInPostWebhook(db as any, "org-1", validPayload);

  expect(checkShipmentTaskCompletion).toHaveBeenCalledWith(
    db,
    "org-1",
    expect.objectContaining({
      id: "ship-1",
      workflowTaskRunId: "task-1",
      direction: "OUTBOUND",
      currentStatus: "DELIVERED",
    }),
  );
});
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (via packages/api/vitest.config.ts) |
| Config file | packages/api/vitest.config.ts |
| Quick run command | `cd packages/api && npx vitest run src/services/courier/__tests__/ --reporter=verbose` |
| Full suite command | `cd packages/api && npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EQUIP-09 | Webhook status update triggers checkShipmentTaskCompletion | unit | `cd packages/api && npx vitest run src/services/courier/__tests__/inpost-webhook-handler.test.ts -x` | Exists -- extend |
| EQUIP-10 (InPost poll) | InPost polling triggers checkShipmentTaskCompletion | unit | `cd packages/api && npx vitest run src/services/courier/__tests__/inpost-polling-service.test.ts -x` | Exists -- extend |
| EQUIP-10 (DPD poll) | DPD polling triggers checkShipmentTaskCompletion | unit | `cd packages/api && npx vitest run src/services/courier/__tests__/dpd-polling-service.test.ts -x` | Does not exist -- create |
| EQUIP-10 (UPS poll) | UPS polling triggers checkShipmentTaskCompletion | unit | `cd packages/api && npx vitest run src/services/courier/__tests__/ups-polling-service.test.ts -x` | Does not exist -- create |

### Sampling Rate
- **Per task commit:** `cd packages/api && npx vitest run src/services/courier/__tests__/ --reporter=verbose`
- **Per wave merge:** `cd packages/api && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/api/src/services/courier/__tests__/dpd-polling-service.test.ts` -- covers EQUIP-10 (DPD). Follow `inpost-polling-service.test.ts` pattern exactly
- [ ] `packages/api/src/services/courier/__tests__/ups-polling-service.test.ts` -- covers EQUIP-10 (UPS). Follow `inpost-polling-service.test.ts` pattern exactly

## Project Constraints (from CLAUDE.md)

- Use `ctx7` CLI for library documentation (not needed this phase -- no new libraries)
- Strong typing, avoid unsafe shortcuts (use `as "OUTBOUND" | "RETURN"` cast for direction, matching existing pattern)
- Schema validation for external inputs (already handled by existing webhook handler Zod validation)
- Proper logging, error handling, no silent failures (`checkShipmentTaskCompletion` already logs internally)
- Clean architecture, separation of concerns (direct import, not coupling through adapters)

## Open Questions

1. **D-03/D-04 already satisfied**
   - What we know: The unified cron route at `inpost-status-poll` already imports and calls all 3 carrier polling services
   - What's unclear: Whether the user expects separate routes despite the existing unified one
   - Recommendation: Flag in plan that D-03/D-04 are pre-satisfied. No code changes needed for cron routes. If user wants separate routes, that is a refactor of working code and should be a separate decision.

## Sources

### Primary (HIGH confidence)
- `packages/api/src/services/equipment-workflow.ts` -- `checkShipmentTaskCompletion` function signature, behavior, error handling
- `packages/api/src/routers/equipment.ts` lines 727, 1265, 1454 -- existing fire-and-forget call pattern
- `packages/api/src/services/courier/inpost-webhook-handler.ts` -- webhook handler code, insertion point
- `packages/api/src/services/courier/inpost-polling-service.ts` -- polling service code, insertion point
- `packages/api/src/services/courier/dpd-polling-service.ts` -- DPD polling code, identical pattern
- `packages/api/src/services/courier/ups-polling-service.ts` -- UPS polling code, identical pattern
- `apps/web/src/app/api/cron/inpost-status-poll/route.ts` -- unified cron route already calling all 3 carriers
- `.planning/v3.0-MILESTONE-AUDIT.md` -- MISSING-02 gap definition

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, only importing existing function
- Architecture: HIGH -- 3 existing call sites demonstrate exact pattern to follow
- Pitfalls: HIGH -- code fully reviewed, insertion points identified to exact line numbers

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable -- internal wiring, no external dependencies)
