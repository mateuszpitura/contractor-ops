# Phase 30: Equipment Tracking Foundation - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Equipment registry CRUD with contractor assignment, manual shipment tracking with timeline display, and lifecycle-aware workflow integration (onboarding auto-ships, offboarding auto-returns, tasks auto-complete on delivery). Courier API integration (InPost, DPD, UPS) is Phase 33 — this phase builds the foundation with manual entry and a unified status model that courier APIs will map to later. Contractor portal equipment return (EQUIP-11) is Phase 33.

</domain>

<decisions>
## Implementation Decisions

### Equipment Registry UI
- **D-01:** Equipment gets its own top-level nav item with icon in the sidebar, alongside Contractors, Invoices, Workflows
- **D-02:** List page uses sortable table with status/type/assignee filters and search — consistent with Contractors and Invoices pages
- **D-03:** Detail view is a dedicated page at `/equipment/[id]` with sections: info, assignment history, shipments timeline, linked workflows — matches contractor profile pattern
- **D-04:** Equipment types are predefined (Laptop, Monitor, Phone, Headset, Keyboard, Mouse, Other) with icons per type, plus admin can add custom types

### Equipment Status Model
- **D-05:** Full lifecycle status enum: AVAILABLE, ASSIGNED, IN_TRANSIT, DELIVERED, RETURN_REQUESTED, RETURN_IN_TRANSIT, RETURNED, RETIRED
- **D-06:** Status auto-advances on shipment events (ASSIGNED -> IN_TRANSIT when shipment created, IN_TRANSIT -> DELIVERED when shipment delivered, etc.) with manual override available for admin
- **D-07:** One contractor assignment at a time with full assignment history preserved (who had it, when, for how long). Must unassign before reassigning
- **D-08:** Assignment initiated from equipment detail page — "Assign to contractor" button with contractor picker. Unassign also from detail page

### Shipment Timeline Display
- **D-09:** Vertical chronological timeline of status events with timestamps — familiar courier-tracking pattern. Each event shows status, date, optional notes
- **D-10:** Full timeline on equipment detail page's shipment section. Condensed version (latest status + carrier info) on contractor profile's Equipment tab
- **D-11:** Manual shipments capture: carrier name (dropdown: InPost, DPD, UPS, Other + free text), tracking number, expected delivery date. Admin manually updates status events
- **D-12:** Unified shipment status enum: CREATED, LABEL_GENERATED, PICKED_UP, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, FAILED, RETURNED — designed for courier API compatibility in Phase 33

### Workflow Auto-Triggers
- **D-13:** EQUIPMENT-type task in onboarding workflow triggers a pre-filled shipment creation form (contractor address auto-populated). Admin reviews and confirms. Task stays IN_PROGRESS until shipment reaches DELIVERED
- **D-14:** EQUIPMENT-type task in offboarding workflow creates a return request. Admin creates return shipment (reverse direction). Equipment status: RETURN_REQUESTED -> RETURN_IN_TRANSIT -> RETURNED. Task auto-completes on RETURNED
- **D-15:** Outbound shipments auto-complete linked task on DELIVERED status. Return shipments auto-complete on RETURNED status. Clear, distinct triggers per direction
- **D-16:** EQUIPMENT task covers all equipment currently assigned to the contractor — one task handles the whole set. Individual items tracked via separate shipments if needed

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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Equipment & shipment requirements
- `.planning/REQUIREMENTS.md` — EQUIP-01 through EQUIP-10 define acceptance criteria for this phase (EQUIP-11 is Phase 33)
- `.planning/ROADMAP.md` §Phase 30 — Success criteria, dependency info, and Phase 33 dependency on this phase's courier interface

### Workflow engine (integration point)
- `packages/db/prisma/schema/workflow.prisma` — WorkflowTaskType.EQUIPMENT already defined, WorkflowTaskRun model, WorkflowRunStatus enum
- `packages/api/src/routers/workflow.ts` — Workflow router for task operations

### Contractor profile (extension point)
- `apps/web/src/components/contractors/contractor-profile/profile-tabs.tsx` — Tab component to extend with Equipment tab (currently 8 tabs)

### UI patterns to follow
- `apps/web/src/components/contractors/` — Table + filters pattern, CRUD flow, detail page structure
- `apps/web/src/components/invoices/` — Table with status filters pattern
- `apps/web/src/components/layout/nav-items.tsx` — Navigation items to extend

### Project context
- `.planning/PROJECT.md` — Architecture principles, multi-tenant patterns, audit trail requirements

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `profile-tabs.tsx`: Clean tab pattern with URL-based tab state — extend with "equipment" tab
- `nav-items.tsx`: Navigation configuration — add equipment nav item
- Table/filter components from Contractors and Invoices pages — reuse for equipment list
- WorkflowTaskType.EQUIPMENT enum value already exists in schema

### Established Patterns
- Multi-tenant: All queries scoped by organizationId
- CRUD: Table list -> detail page pattern (Contractors, Contracts, Invoices)
- Audit trail: All state changes logged with immutable audit entries
- i18n: All UI strings through next-intl with pl/en translations
- Workflow integration: Task types drive behavior (DOCUMENT_COLLECTION, APPROVAL, etc.) — EQUIPMENT follows same pattern

### Integration Points
- Workflow engine: EQUIPMENT task type needs handler for shipment creation trigger and status-based auto-completion
- Contractor profile: New Equipment tab showing assigned items and shipment status
- Navigation: New top-level nav item
- Audit log: Equipment assignment/unassignment and shipment status changes need audit entries

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 30-equipment-tracking-foundation*
*Context gathered: 2026-04-02*
