# Phase 43: DPD/UPS Notification Dispatch Wiring - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 43-dpd-ups-notification-dispatch
**Areas discussed:** Notification scope, Code sharing approach, Notification content

---

## Notification Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Fix all three (Recommended) | InPost polling has the identical gap. Fixing it here is ~10 lines and avoids a separate phase for one copy-paste. | ✓ |
| DPD/UPS only | Stay strictly within roadmap scope. InPost webhook already covers most cases; polling is just a fallback. | |

**User's choice:** Fix all three
**Notes:** None

---

## Code Sharing Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Extract shared helper (Recommended) | Create a dispatchShipmentNotification(db, orgId, shipment, mappedStatus, carrier) helper. All 4 call sites use it. Single place to change notification format. | ✓ |
| Inline duplicate | Copy the block into each polling service. Simpler diff, no new abstraction, but 4 copies to maintain. | |
| You decide | Claude picks the approach during implementation based on what fits best. | |

**User's choice:** Extract shared helper
**Notes:** None

---

## Notification Content

| Option | Description | Selected |
|--------|-------------|----------|
| Identical notifications (Recommended) | Same title/body/metadata. User doesn't care how the status was detected. Carrier field in metadata already distinguishes INPOST/DPD/UPS. | ✓ |
| Include source hint | Add a 'source: polling' field in metadata so admins or logs can tell if the status came from webhook vs polling. No user-visible difference. | |

**User's choice:** Identical notifications
**Notes:** None

---

## Claude's Discretion

- Shared helper file location
- Whether to refactor InPost webhook handler to use the shared helper
- Error handling approach in the helper

## Deferred Ideas

None
