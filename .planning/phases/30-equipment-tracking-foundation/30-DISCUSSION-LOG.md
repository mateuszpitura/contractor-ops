# Phase 30: Equipment Tracking Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 30-equipment-tracking-foundation
**Areas discussed:** Equipment registry UI, Equipment status model, Shipment timeline display, Workflow auto-triggers

---

## Equipment Registry UI

### Navigation placement

| Option | Description | Selected |
|--------|-------------|----------|
| Top-level nav item | Equipment gets its own icon + page in the sidebar | ✓ |
| Nested under Contractors | Equipment as a sub-page of Contractors section | |
| Settings sub-tab | Equipment registry lives in Settings | |

**User's choice:** Top-level nav item
**Notes:** Distinct domain with its own CRUD warrants top-level placement

### List view

| Option | Description | Selected |
|--------|-------------|----------|
| Table with filters | Consistent with Contractors and Invoices — sortable table, filters, search, bulk actions | ✓ |
| Card grid | Visual card per equipment item with photo placeholder, type icon, status badge | |
| Split panel | List on left, detail on right | |

**User's choice:** Table with filters

### Detail view

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated detail page | Full page at /equipment/[id] with sections — matches contractor profile pattern | ✓ |
| Side sheet / drawer | Slide-out panel from list page | |
| Expandable row | Inline row expansion | |

**User's choice:** Dedicated detail page

### Equipment types

| Option | Description | Selected |
|--------|-------------|----------|
| Predefined categories | Laptop, Monitor, Phone, Headset, Keyboard, Mouse, Other | |
| Fully custom types | Admin defines categories from scratch | |
| Predefined + custom | Ship with defaults, let admins add their own | ✓ |

**User's choice:** Predefined + custom

---

## Equipment Status Model

### Status lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Full lifecycle | AVAILABLE -> ASSIGNED -> IN_TRANSIT -> DELIVERED -> RETURN_REQUESTED -> RETURN_IN_TRANSIT -> RETURNED -> RETIRED | ✓ |
| Simple assignment only | AVAILABLE -> ASSIGNED -> RETURNED -> RETIRED, shipment tracked separately | |
| Separate equipment + shipment statuses | Two independent state machines that link together | |

**User's choice:** Full lifecycle

### Status transitions

| Option | Description | Selected |
|--------|-------------|----------|
| Auto where possible | Status auto-advances on shipment events, admin can manually override | ✓ |
| Always manual | Admin explicitly moves through statuses | |
| Auto-only, no manual override | Strictly driven by shipment events | |

**User's choice:** Auto where possible

### Assignment model

| Option | Description | Selected |
|--------|-------------|----------|
| One at a time with history | Full assignment history preserved, must unassign before reassigning | ✓ |
| One at a time, no history | Simple current-assignment only | |
| Pool assignment | Multiple contractors simultaneously | |

**User's choice:** One at a time with history

### Assignment direction

| Option | Description | Selected |
|--------|-------------|----------|
| Assign from equipment detail | "Assign to contractor" button on equipment detail page | ✓ |
| Assign from contractor profile | "Add equipment" button on contractor's Equipment tab | |
| Both directions | Can assign from either side | |

**User's choice:** Assign from equipment detail

---

## Shipment Timeline Display

### Timeline style

| Option | Description | Selected |
|--------|-------------|----------|
| Vertical timeline | Chronological list of status events with timestamps — courier-tracking pattern | ✓ |
| Horizontal stepper | Progress bar with named steps | |
| Status card with log | Current status card + collapsible event log | |

**User's choice:** Vertical timeline

### Timeline location

| Option | Description | Selected |
|--------|-------------|----------|
| Equipment detail + contractor tab | Full timeline on equipment detail, condensed on contractor profile tab | ✓ |
| Equipment detail only | Timeline only on equipment detail page | |
| Standalone shipment page | Shipments get their own page | |

**User's choice:** Equipment detail + contractor tab

### Carrier info captured

| Option | Description | Selected |
|--------|-------------|----------|
| Carrier + tracking + dates | Carrier name, tracking number, expected delivery date. Prepares for Phase 33 | ✓ |
| Minimal — carrier + tracking only | Just carrier and tracking number | |
| Rich — with cost and notes | All fields plus shipping cost, weight, dimensions, notes | |

**User's choice:** Carrier + tracking + dates

### Shipment status model

| Option | Description | Selected |
|--------|-------------|----------|
| Unified model now | Standard enum designed for courier API compatibility in Phase 33 | ✓ |
| Simple now, extend later | Start minimal, expand when courier APIs ship | |
| Carrier-specific statuses | Store raw carrier statuses as-is | |

**User's choice:** Unified model now

---

## Workflow Auto-Triggers

### Onboarding shipment creation

| Option | Description | Selected |
|--------|-------------|----------|
| Task triggers shipment form | Pre-filled form, admin reviews and confirms, task IN_PROGRESS until DELIVERED | ✓ |
| Fully automatic | Auto-creates shipment with defaults, no review | |
| Manual with nudge | Reminder to create shipment manually | |

**User's choice:** Task triggers shipment form

### Offboarding return handling

| Option | Description | Selected |
|--------|-------------|----------|
| Return request + reverse shipment | Creates return request, admin creates return shipment, auto-completes on RETURNED | ✓ |
| Simple unassign on task complete | Just unassigns equipment when admin completes task | |
| Contractor-initiated return | Contractor initiates return via portal | |

**User's choice:** Return request + reverse shipment

### Auto-complete trigger status

| Option | Description | Selected |
|--------|-------------|----------|
| DELIVERED for send, RETURNED for return | Distinct triggers per shipment direction | ✓ |
| Configurable per task template | Admin picks target status during template setup | |
| Any terminal status | DELIVERED, RETURNED, or FAILED all complete the task | |

**User's choice:** DELIVERED for send, RETURNED for return

### Equipment scope per task

| Option | Description | Selected |
|--------|-------------|----------|
| All assigned equipment | One task handles entire set, individual items via separate shipments | ✓ |
| Specific equipment selection | Admin picks which items per workflow run | |
| Equipment type-based | Template specifies type, matches at runtime | |

**User's choice:** All assigned equipment

---

## Claude's Discretion

- Database schema design for equipment, shipment, and assignment history models
- Equipment detail page section layout and responsive behavior
- Shipment timeline component styling and event iconography
- Carrier dropdown implementation
- Equipment type icon selection and custom type management UI
- Assignment history timeline formatting
- Status badge colors and transition animations
- Form validation rules for shipment creation
- EQUIPMENT task template configuration in workflow builder

## Deferred Ideas

None — discussion stayed within phase scope
