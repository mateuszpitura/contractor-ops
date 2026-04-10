# Phase 30: Equipment Tracking Foundation - Research

**Researched:** 2026-04-02
**Domain:** Equipment registry CRUD, shipment tracking, workflow task integration
**Confidence:** HIGH

## Summary

Phase 30 introduces a new bounded context (Equipment) into the existing monorepo. The domain is well-scoped: equipment CRUD, contractor assignment with history, manual shipment entry with timeline display, and workflow integration where EQUIPMENT-type tasks auto-create shipments and auto-complete on delivery/return status. No external API integrations -- those are Phase 33.

The project already has all necessary infrastructure: multi-tenant scoping, RBAC middleware, the `WorkflowTaskType.EQUIPMENT` enum value in schema, established CRUD patterns (Contractors, Invoices), profile tabs with URL-based state, and fire-and-forget integration hooks in the workflow router. The work is primarily new schema, a new tRPC router, new UI components following established patterns, and wiring EQUIPMENT task handling into the existing workflow engine.

**Primary recommendation:** Model Equipment, EquipmentAssignment, Shipment, and ShipmentEvent as four new Prisma models in a dedicated `equipment.prisma` schema file. Follow the exact CRUD + detail page pattern from Contractors. Wire workflow integration via the existing `configJson`/fire-and-forget pattern used by Jira/Linear/Calendar tasks.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Equipment gets its own top-level nav item with icon in the sidebar, alongside Contractors, Invoices, Workflows
- **D-02:** List page uses sortable table with status/type/assignee filters and search -- consistent with Contractors and Invoices pages
- **D-03:** Detail view is a dedicated page at `/equipment/[id]` with sections: info, assignment history, shipments timeline, linked workflows -- matches contractor profile pattern
- **D-04:** Equipment types are predefined (Laptop, Monitor, Phone, Headset, Keyboard, Mouse, Other) with icons per type, plus admin can add custom types
- **D-05:** Full lifecycle status enum: AVAILABLE, ASSIGNED, IN_TRANSIT, DELIVERED, RETURN_REQUESTED, RETURN_IN_TRANSIT, RETURNED, RETIRED
- **D-06:** Status auto-advances on shipment events (ASSIGNED -> IN_TRANSIT when shipment created, IN_TRANSIT -> DELIVERED when shipment delivered, etc.) with manual override available for admin
- **D-07:** One contractor assignment at a time with full assignment history preserved (who had it, when, for how long). Must unassign before reassigning
- **D-08:** Assignment initiated from equipment detail page -- "Assign to contractor" button with contractor picker. Unassign also from detail page
- **D-09:** Vertical chronological timeline of status events with timestamps -- familiar courier-tracking pattern. Each event shows status, date, optional notes
- **D-10:** Full timeline on equipment detail page's shipment section. Condensed version (latest status + carrier info) on contractor profile's Equipment tab
- **D-11:** Manual shipments capture: carrier name (dropdown: InPost, DPD, UPS, Other + free text), tracking number, expected delivery date. Admin manually updates status events
- **D-12:** Unified shipment status enum: CREATED, LABEL_GENERATED, PICKED_UP, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, FAILED, RETURNED -- designed for courier API compatibility in Phase 33
- **D-13:** EQUIPMENT-type task in onboarding workflow triggers a pre-filled shipment creation form (contractor address auto-populated). Admin reviews and confirms. Task stays IN_PROGRESS until shipment reaches DELIVERED
- **D-14:** EQUIPMENT-type task in offboarding workflow creates a return request. Admin creates return shipment (reverse direction). Equipment status: RETURN_REQUESTED -> RETURN_IN_TRANSIT -> RETURNED. Task auto-completes on RETURNED
- **D-15:** Outbound shipments auto-complete linked task on DELIVERED status. Return shipments auto-complete on RETURNED status. Clear, distinct triggers per direction
- **D-16:** EQUIPMENT task covers all equipment currently assigned to the contractor -- one task handles the whole set. Individual items tracked via separate shipments if needed

### Claude's Discretion
- Database schema design for equipment, shipment, and assignment history models
- Equipment detail page section layout and responsive behavior
- Shipment timeline component styling and event iconography
- Carrier dropdown implementation (static list vs configurable)
- Equipment type icon selection and custom type management UI
- Assignment history timeline formatting
- Status badge colors and transition animations
- Form validation rules for shipment creation
- How EQUIPMENT task template configuration appears in the workflow template builder

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EQUIP-01 | Admin can manage equipment registry (CRUD) with type, serial number, status, and assigned contractor | New Prisma model + tRPC router following contractor CRUD pattern; new `/equipment` page + `/equipment/[id]` detail |
| EQUIP-02 | Admin can assign/unassign equipment to contractors with assignment history and audit trail | EquipmentAssignment model with temporal tracking; assign/unassign mutations with audit log entries |
| EQUIP-03 | Contractor profile shows Equipment tab with assigned items and shipment status | Extend `profile-tabs.tsx` TAB_KEYS array; new `tab-equipment.tsx` component with condensed shipment status |
| EQUIP-04 | Admin can create shipment for equipment with carrier, tracking number, and expected delivery (manual entry) | Shipment + ShipmentEvent models; shipment form dialog with carrier select, tracking input, date picker |
| EQUIP-08 | Shipment status displays as timeline on equipment detail and contractor profile with unified status model | Custom ShipmentTimeline component; ShipmentCondensed for contractor tab; ShipmentEvent records drive timeline |
| EQUIP-09 | Onboarding workflow task "Ship equipment" auto-creates shipment, offboarding task "Return equipment" triggers return request | Wire into workflow startRun fire-and-forget hooks; equipmentTaskConfig validator; task stays IN_PROGRESS until target status |
| EQUIP-10 | Workflow task auto-completes when shipment reaches target status (e.g., "delivered") | ShipmentEvent creation mutation checks linked tasks and calls completeTask logic when target status reached |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **UI tool:** Use `frontend-design` plugin for all UI work; aim for polished, production-ready interfaces
- **Libraries:** Always use `ctx7` CLI for library documentation
- **Architecture:** Monorepo with Turborepo, clean architecture, SOLID/DRY, clear boundaries between packages
- **Validation:** Schema validation (Zod) for all external inputs, forms, API payloads
- **Security:** Multi-tenant scoping via organizationId, RBAC middleware, RLS policies
- **i18n:** Polish + English translations required for all UI strings (next-intl)
- **Accessibility:** WCAG AA, keyboard navigation, screen reader support, focus states
- **Code quality:** Strong typing, no unsafe shortcuts, explicitness over magic
- **Performance:** Avoid unnecessary re-renders, overfetching; use caching strategies
- **Observability:** Proper logging, error handling; no silent failures

## Standard Stack

### Core (already in project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | ^7.5.0 | ORM + schema + migrations | Project standard, multi-file schema |
| tRPC | (project version) | Type-safe API layer | 30+ routers already, zero API drift |
| Next.js | ^15.3.0 | App router, pages, layouts | Project standard |
| React | ^19.0.0 | UI rendering | Project standard |
| Zod | (project version) | Schema validation | All validators use Zod |
| shadcn/ui | base-nova preset | Component library (Radix-based) | Per UI-SPEC |
| lucide-react | (project version) | Icons | Per UI-SPEC equipment type icons defined |
| next-intl | (project version) | i18n | pl/en translations required |
| TanStack Table | (project version) | Data tables | Equipment list table |
| React Hook Form | (project version) | Form handling | Equipment + shipment forms |
| sonner | (project version) | Toast notifications | CRUD feedback per UI-SPEC |

### No New Dependencies Required

This phase uses exclusively existing project dependencies. No new npm packages needed.

## Architecture Patterns

### Recommended Project Structure

```
packages/db/prisma/schema/
  equipment.prisma              # Equipment, EquipmentAssignment, Shipment, ShipmentEvent models + enums

packages/validators/src/
  equipment.ts                  # Zod schemas for equipment CRUD, assignment, shipment, task config

packages/api/src/
  routers/equipment.ts          # Equipment tRPC router (CRUD, assign, shipments, status updates)
  services/equipment-workflow.ts # Workflow integration: auto-shipment creation, task auto-completion
  root.ts                       # Register equipmentRouter

apps/web/src/
  app/[locale]/(dashboard)/equipment/
    page.tsx                    # Equipment list page
    [id]/page.tsx               # Equipment detail page
  components/equipment/
    equipment-table/            # Table, columns, toolbar, filters (mirrors contractor-table/)
    equipment-detail/           # Detail page tabs and sections
    equipment-form.tsx          # Create/edit dialog
    assignment-dialog.tsx       # Contractor picker dialog
    shipment-timeline.tsx       # Vertical timeline component
    shipment-form.tsx           # Create shipment dialog
    shipment-condensed.tsx      # Inline status for contractor tab
  components/contractors/contractor-profile/
    tab-equipment.tsx           # New Equipment tab content

messages/
  en.json                       # Equipment.* namespace additions
  pl.json                       # Equipment.* namespace additions
```

### Pattern 1: CRUD Router (follow contractor.ts pattern)

**What:** tRPC router with tenantProcedure + RBAC middleware, Zod input validation, `plain()` serialization helper.
**When to use:** All equipment CRUD operations.
**Example pattern (from existing code):**
```typescript
// packages/api/src/routers/equipment.ts
import { router } from "../init.js";
import { tenantProcedure } from "../middleware/tenant.js";
import { requirePermission } from "../middleware/rbac.js";

export const equipmentRouter = router({
  list: tenantProcedure
    .use(requirePermission({ equipment: ["read"] }))
    .input(equipmentListSchema)
    .query(async ({ ctx, input }) => { /* ... */ }),

  create: tenantProcedure
    .use(requirePermission({ equipment: ["create"] }))
    .input(equipmentCreateSchema)
    .mutation(async ({ ctx, input }) => { /* ... */ }),
  // ...
});
```

### Pattern 2: Workflow Task Integration (follow Jira/Linear configJson pattern)

**What:** Task template stores config in `configJson` field. On workflow run start, eligible tasks are identified and integration hooks fire as fire-and-forget.
**When to use:** EQUIPMENT task type handling during workflow run start and shipment status updates.
**Key insight:** The existing workflow router in `startRun` already:
1. Creates task runs from templates
2. Reads `configJson` to determine integration eligibility
3. Fires integration hooks as `void (async () => { ... })()`

For EQUIPMENT tasks, the pattern differs slightly: instead of creating external resources (Jira/Linear issues), it needs to:
- On startRun: set EQUIPMENT tasks to IN_PROGRESS and associate them with the contractor's assigned equipment
- On shipment status change: check if any linked workflow task should auto-complete

```typescript
// Validator: packages/validators/src/equipment.ts
export const equipmentTaskConfigSchema = z.object({
  equipmentEnabled: z.boolean().default(false),
  direction: z.enum(["OUTBOUND", "RETURN"]).optional(),
});
```

### Pattern 3: Status State Machine

**What:** Equipment status transitions are governed by a legal transition map (like ContractorLifecycleStage).
**When to use:** All equipment status changes.

```typescript
const EQUIPMENT_TRANSITIONS: Record<string, string[]> = {
  AVAILABLE:          ["ASSIGNED", "RETIRED"],
  ASSIGNED:           ["IN_TRANSIT", "AVAILABLE", "RETIRED"],
  IN_TRANSIT:         ["DELIVERED", "AVAILABLE"],
  DELIVERED:          ["RETURN_REQUESTED", "AVAILABLE", "RETIRED"],
  RETURN_REQUESTED:   ["RETURN_IN_TRANSIT"],
  RETURN_IN_TRANSIT:  ["RETURNED"],
  RETURNED:           ["AVAILABLE", "RETIRED"],
  RETIRED:            [],
};
```

### Pattern 4: Profile Tab Extension

**What:** Add "equipment" to TAB_KEYS in `profile-tabs.tsx`, pass new content prop.
**When to use:** Contractor profile Equipment tab (EQUIP-03).

The existing `profile-tabs.tsx` uses a simple `TAB_KEYS` array and renders `TabsContent` for each key. Extension requires:
1. Add `"equipment"` to `TAB_KEYS`
2. Add `equipmentContent: ReactNode` to `ProfileTabsProps`
3. Add `TabsContent` for equipment
4. Add i18n key `ContractorProfile.tabs.equipment`

### Pattern 5: Navigation Extension

**What:** Add equipment nav item to `navigationGroups` in `navigation.ts`.
**When to use:** Top-level equipment nav (D-01).

Add to "operations" group (alongside contractors, contracts, workflows):
```typescript
{
  key: "equipment",
  label: "Equipment",
  href: "/equipment",
  icon: Package, // from lucide-react
  permission: { resource: "equipment", actions: ["read"] },
}
```

### Anti-Patterns to Avoid
- **Coupling shipment logic to workflow router:** Shipment CRUD belongs in equipment router. Workflow integration is a hook that fires on shipment status change, not a workflow router concern.
- **Storing shipment timeline in JSON blob:** Use a proper ShipmentEvent model with individual records. This enables querying, pagination, and Phase 33 courier API events to be inserted programmatically.
- **Using a single status field for equipment without history:** Equipment status changes should be derivable from assignment + shipment events. Store the current status on the Equipment model for fast queries, but derive it from events during mutations.
- **Creating separate workflow tasks per equipment item:** Per D-16, one EQUIPMENT task covers all contractor's equipment. Individual items tracked via separate shipments.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Data table with sorting/filtering | Custom table logic | TanStack Table (already used) | Proven pattern in contractor-table/ and invoices/ |
| Contractor picker in assignment dialog | Custom search dropdown | shadcn Command component | Same search+select pattern used elsewhere |
| Date picking for expected delivery | Custom date input | shadcn Calendar component | Consistent UX, locale-aware |
| Form state management | Manual useState tracking | React Hook Form + Zod resolver | Project standard, type-safe validation |
| Toast notifications | Custom alert system | sonner (already used) | Per UI-SPEC interaction contracts |
| Status transition validation | Ad-hoc if/else chains | Transition map constant (like LEGAL_TRANSITIONS) | Declarative, testable, matches existing pattern |

## Common Pitfalls

### Pitfall 1: Equipment Status Drift from Shipment Events
**What goes wrong:** Equipment status gets out of sync with actual shipment status because status updates happen in two places (manual override + shipment event propagation).
**Why it happens:** Two mutation paths can change the same field without coordination.
**How to avoid:** Make shipment status change the source of truth for equipment status transitions during active shipments. Manual override should only work when no active shipment exists OR explicitly overrides (with audit log). Add a `hasActiveShipment` guard.
**Warning signs:** Equipment shows AVAILABLE but has an IN_TRANSIT shipment.

### Pitfall 2: Workflow Task Auto-Completion Race Condition
**What goes wrong:** Shipment reaches DELIVERED while the workflow task is being manually completed by admin simultaneously.
**Why it happens:** Two concurrent paths (manual complete + auto-complete from shipment status) race on the same task.
**How to avoid:** Use Prisma transaction with optimistic concurrency. Check task status is still IN_PROGRESS before completing. If already DONE, skip silently (idempotent).
**Warning signs:** Duplicate completion audit entries.

### Pitfall 3: Multi-Equipment Task Creates Multiple Shipments
**What goes wrong:** D-16 says one EQUIPMENT task covers all contractor's equipment, but the implementation creates one shipment per equipment item automatically.
**Why it happens:** Misreading the requirement -- the task should prompt the admin to create shipments manually for each item, not auto-create them.
**How to avoid:** The EQUIPMENT task stays IN_PROGRESS and shows a list of assigned equipment with "Create shipment" actions per item. Auto-completion triggers when ALL linked shipments reach the target status (DELIVERED or RETURNED).
**Warning signs:** Admin confused by auto-created shipments they didn't request.

### Pitfall 4: Forgetting Multi-Tenant Scoping on New Models
**What goes wrong:** Equipment queries return data from other organizations.
**Why it happens:** New models miss `organizationId` field or queries miss the tenant scope filter.
**How to avoid:** Every new model MUST have `organizationId` field with index. Every query uses `ctx.organizationId`. Add RLS policies in migration.
**Warning signs:** Data leak in staging/testing with multiple test orgs.

### Pitfall 5: Missing EntityType Enum Extension
**What goes wrong:** Audit logs and notifications fail because `EQUIPMENT` and `SHIPMENT` are not in the `EntityType` enum.
**Why it happens:** Forgetting to extend the existing enum when adding new domain models.
**How to avoid:** Add `EQUIPMENT` and `SHIPMENT` to the `EntityType` enum in `contract.prisma` as part of the schema migration.
**Warning signs:** Runtime Prisma validation errors on audit log creation.

### Pitfall 6: Assignment History Not Capturing Unassignment Date
**What goes wrong:** Assignment history shows when equipment was assigned but not when it was unassigned, making duration calculations impossible.
**Why it happens:** Using a simple boolean `isActive` instead of temporal `assignedAt`/`unassignedAt` fields.
**How to avoid:** EquipmentAssignment model must have `assignedAt` (required) and `unassignedAt` (nullable). Duration = `unassignedAt - assignedAt`. Current assignment has `unassignedAt = null`.
**Warning signs:** "How long did contractor X have the laptop?" -- unanswerable.

## Code Examples

### Database Schema Design (recommended)

```prisma
// packages/db/prisma/schema/equipment.prisma

model Equipment {
  id                String          @id @default(cuid())
  organizationId    String
  name              String
  serialNumber      String?
  type              EquipmentType
  customType        String?         // When type is OTHER or custom
  status            EquipmentStatus @default(AVAILABLE)
  notes             String?
  purchaseDate      DateTime?       @db.Date
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  organization      Organization    @relation(fields: [organizationId], references: [id])
  assignments       EquipmentAssignment[]
  shipments         Shipment[]

  @@index([organizationId])
  @@index([organizationId, status])
  @@index([organizationId, type])
  @@unique([organizationId, serialNumber])
}

model EquipmentAssignment {
  id              String    @id @default(cuid())
  organizationId  String
  equipmentId     String
  contractorId    String
  assignedByUserId String
  assignedAt      DateTime  @default(now())
  unassignedAt    DateTime?
  unassignedByUserId String?
  notes           String?

  organization    Organization @relation(fields: [organizationId], references: [id])
  equipment       Equipment    @relation(fields: [equipmentId], references: [id])
  contractor      Contractor   @relation(fields: [contractorId], references: [id])

  @@index([organizationId])
  @@index([organizationId, equipmentId])
  @@index([organizationId, contractorId])
  @@index([organizationId, equipmentId, unassignedAt])
}

model Shipment {
  id                  String         @id @default(cuid())
  organizationId      String
  equipmentId         String
  assignmentId        String?        // Links to the assignment context
  workflowTaskRunId   String?        // Links to EQUIPMENT workflow task
  direction           ShipmentDirection
  carrier             String         // e.g. "InPost", "DPD", "UPS", "Other"
  carrierCustom       String?        // Free text when carrier is "Other"
  trackingNumber      String?
  expectedDeliveryAt  DateTime?      @db.Date
  currentStatus       ShipmentStatus @default(CREATED)
  createdByUserId     String
  createdAt           DateTime       @default(now())
  updatedAt           DateTime       @updatedAt

  organization        Organization   @relation(fields: [organizationId], references: [id])
  equipment           Equipment      @relation(fields: [equipmentId], references: [id])

  events              ShipmentEvent[]

  @@index([organizationId])
  @@index([organizationId, equipmentId])
  @@index([organizationId, currentStatus])
  @@index([organizationId, workflowTaskRunId])
}

model ShipmentEvent {
  id             String         @id @default(cuid())
  organizationId String
  shipmentId     String
  status         ShipmentStatus
  notes          String?
  occurredAt     DateTime       @default(now())
  createdByUserId String?       // Null for system-generated events
  createdAt      DateTime       @default(now())

  organization   Organization   @relation(fields: [organizationId], references: [id])
  shipment       Shipment       @relation(fields: [shipmentId], references: [id])

  @@index([organizationId])
  @@index([organizationId, shipmentId, occurredAt])
}

// --- Enums ---

enum EquipmentType {
  LAPTOP
  MONITOR
  PHONE
  HEADSET
  KEYBOARD
  MOUSE
  OTHER
}

enum EquipmentStatus {
  AVAILABLE
  ASSIGNED
  IN_TRANSIT
  DELIVERED
  RETURN_REQUESTED
  RETURN_IN_TRANSIT
  RETURNED
  RETIRED
}

enum ShipmentStatus {
  CREATED
  LABEL_GENERATED
  PICKED_UP
  IN_TRANSIT
  OUT_FOR_DELIVERY
  DELIVERED
  FAILED
  RETURNED
}

enum ShipmentDirection {
  OUTBOUND   // Sending to contractor
  RETURN     // Returning from contractor
}
```

### Equipment Task Config Validator

```typescript
// packages/validators/src/equipment.ts
export const equipmentTaskConfigSchema = z.object({
  equipmentEnabled: z.boolean().default(false),
  direction: z.enum(["OUTBOUND", "RETURN"]).optional(),
});

export type EquipmentTaskConfig = z.infer<typeof equipmentTaskConfigSchema>;
```

### Workflow Integration Hook Pattern

```typescript
// packages/api/src/services/equipment-workflow.ts

/**
 * Called when a shipment event is created that changes shipment status.
 * Checks if the shipment is linked to a workflow task and auto-completes if target reached.
 */
export async function checkShipmentTaskCompletion(
  tx: PrismaTransaction,
  organizationId: string,
  shipment: { id: string; workflowTaskRunId: string | null; direction: string; currentStatus: string },
): Promise<void> {
  if (!shipment.workflowTaskRunId) return;

  const targetStatus = shipment.direction === "OUTBOUND" ? "DELIVERED" : "RETURNED";
  if (shipment.currentStatus !== targetStatus) return;

  // Check if ALL shipments linked to this task have reached target
  const linkedShipments = await tx.shipment.findMany({
    where: { organizationId, workflowTaskRunId: shipment.workflowTaskRunId },
    select: { currentStatus: true, direction: true },
  });

  const allComplete = linkedShipments.every(s => {
    const target = s.direction === "OUTBOUND" ? "DELIVERED" : "RETURNED";
    return s.currentStatus === target;
  });

  if (!allComplete) return;

  // Auto-complete the task (idempotent - skip if already DONE)
  await tx.workflowTaskRun.updateMany({
    where: {
      id: shipment.workflowTaskRunId,
      organizationId,
      status: "IN_PROGRESS",
    },
    data: {
      status: "DONE",
      completedAt: new Date(),
    },
  });

  // Recompute workflow run progress (same pattern as completeTask in workflow.ts)
}
```

### Profile Tab Extension

```typescript
// profile-tabs.tsx modification
const TAB_KEYS = [
  "overview", "contracts", "documents", "workflows",
  "invoices", "payments", "equipment", "activity", "compliance",
] as const;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JSON blob for shipment events | Separate ShipmentEvent model | Phase 30 design | Enables querying, Phase 33 courier API insertion |
| Custom equipment status per shipment | Unified equipment + shipment status enums | Phase 30 design | Courier APIs map to same enum in Phase 33 |

## Open Questions

1. **Custom Equipment Types Storage**
   - What we know: D-04 says admin can add custom types. Enum-based types (LAPTOP, MONITOR, etc.) are fixed.
   - What's unclear: Whether custom types should be a separate model (EquipmentCustomType) or just the `customType` string field on Equipment when type=OTHER.
   - Recommendation: Use `customType` string field. If admin enters a custom type, set `type=OTHER` and `customType="Docking Station"`. This avoids a separate model for a simple use case. Phase 33+ can upgrade to a dedicated model if needed.

2. **Audit Log Creation Mechanism**
   - What we know: The project has an AuditLog model and RLS policies. Read operations exist but no explicit `prisma.auditLog.create()` calls found in mutation code.
   - What's unclear: Whether audit logs are created via PostgreSQL triggers, Prisma middleware, or should be explicitly created in mutations.
   - Recommendation: Follow whatever pattern exists. If no automated mechanism, add explicit `prisma.auditLog.create()` calls in equipment assign/unassign/shipment status change mutations. These are the critical audit points per EQUIP-02.

3. **RBAC Permission Resource Name**
   - What we know: Existing resources: `contractor`, `contract`, `workflow`, `invoice`, `payment`, `report`, `integration`, `settings`, `time`.
   - What's unclear: Whether `equipment` needs its own resource or can share with `contractor`.
   - Recommendation: Create `equipment` as its own resource with `read`, `create`, `update`, `delete` actions. Equipment management is a distinct admin concern.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (project standard) |
| Config file | `packages/api/vitest.config.ts` |
| Quick run command | `pnpm --filter @contractor-ops/api test -- --run` |
| Full suite command | `pnpm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EQUIP-01 | Equipment CRUD (create, read, update, list with filters) | unit | `pnpm --filter @contractor-ops/api test -- --run src/routers/__tests__/equipment.test.ts` | Wave 0 |
| EQUIP-02 | Assign/unassign with history preservation | unit | `pnpm --filter @contractor-ops/api test -- --run src/routers/__tests__/equipment.test.ts` | Wave 0 |
| EQUIP-03 | Contractor equipment tab returns assigned items | unit | `pnpm --filter @contractor-ops/api test -- --run src/routers/__tests__/equipment.test.ts` | Wave 0 |
| EQUIP-04 | Shipment creation with required fields | unit | `pnpm --filter @contractor-ops/api test -- --run src/routers/__tests__/equipment.test.ts` | Wave 0 |
| EQUIP-08 | Shipment timeline events ordered chronologically | unit | `pnpm --filter @contractor-ops/api test -- --run src/routers/__tests__/equipment.test.ts` | Wave 0 |
| EQUIP-09 | EQUIPMENT task triggers shipment creation / return request | unit | `pnpm --filter @contractor-ops/api test -- --run src/services/__tests__/equipment-workflow.test.ts` | Wave 0 |
| EQUIP-10 | Task auto-completes on target shipment status | unit | `pnpm --filter @contractor-ops/api test -- --run src/services/__tests__/equipment-workflow.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @contractor-ops/api test -- --run`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/api/src/routers/__tests__/equipment.test.ts` -- covers EQUIP-01 through EQUIP-08
- [ ] `packages/api/src/services/__tests__/equipment-workflow.test.ts` -- covers EQUIP-09, EQUIP-10
- [ ] `packages/validators/src/__tests__/equipment.test.ts` -- Zod schema validation

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `packages/db/prisma/schema/workflow.prisma` -- WorkflowTaskType.EQUIPMENT exists, WorkflowTaskRun model structure
- Direct codebase inspection: `packages/api/src/routers/workflow.ts` -- fire-and-forget integration hook pattern (Jira/Linear/Calendar)
- Direct codebase inspection: `apps/web/src/components/contractors/contractor-profile/profile-tabs.tsx` -- tab extension pattern
- Direct codebase inspection: `apps/web/src/lib/navigation.ts` -- navigation group structure
- Direct codebase inspection: `packages/db/prisma/schema/contractor.prisma` -- CRUD model pattern with multi-tenant scoping
- Direct codebase inspection: `packages/validators/src/jira.ts` -- configJson schema pattern for task templates
- Phase UI-SPEC: `.planning/phases/30-equipment-tracking-foundation/30-UI-SPEC.md` -- all component, layout, and interaction contracts

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions D-01 through D-16 -- user-validated requirements and design decisions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all patterns exist in codebase
- Architecture: HIGH -- follows exact patterns from Contractors/Invoices/Workflow domains
- Pitfalls: HIGH -- derived from real patterns observed in existing integration code
- Workflow integration: MEDIUM -- EQUIPMENT task hook is new pattern (not Jira/Linear external API), but follows same fire-and-forget structure

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable -- no external dependencies, internal patterns only)
