# Phase 37: Shipment Task Auto-Completion Wiring - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 37-shipment-task-auto-completion
**Areas discussed:** Wiring approach, DPD/UPS cron routes, Error handling, Testing strategy

---

## Wiring Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Direct import + fire-and-forget | Import checkShipmentTaskCompletion directly and call with void (non-blocking, like equipment router). Simplest, matches existing pattern. | ✓ |
| Direct import + await | Import and await the call so errors bubble up. More defensive but slows down webhook/polling. | |
| You decide | Claude picks based on existing patterns | |

**User's choice:** Direct import + fire-and-forget (Recommended)
**Notes:** Matches existing pattern in equipment router at lines 1265, 1454.

---

## DPD/UPS Cron Routes

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, create both | Create dpd-status-poll and ups-status-poll cron routes following inpost-status-poll pattern. Without them, polling services are dead code. | ✓ |
| No, wiring only | Only add checkShipmentTaskCompletion calls. Leave cron routes to future phase. | |
| Create routes but skip QStash | Create Next.js API routes but don't register QStash schedules yet. Manual trigger only. | |

**User's choice:** Yes, create both (Recommended)
**Notes:** Polling services exist but cannot run without cron routes. Essential for Phase 37 success criteria (DPD/UPS polling must trigger task completion).

---

## Error Handling

| Option | Description | Selected |
|--------|-------------|----------|
| No extra handling | Fire-and-forget with void. Function handles its own errors internally. Webhook/polling shouldn't fail due to task completion issues. | ✓ |
| Wrap in try/catch + log | Add try/catch at call site for defense-in-depth. Extra logging at webhook/polling level. | |
| You decide | Claude picks based on codebase error handling patterns | |

**User's choice:** No extra handling (Recommended)
**Notes:** checkShipmentTaskCompletion already has internal try/catch with console.error logging. Self-contained.

---

## Testing Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Unit tests with mocked function | Mock checkShipmentTaskCompletion in existing test suites. Verify correct args on DELIVERED/RETURNED. | |
| Integration tests with DB | Full integration: create shipment + task, simulate webhook/poll, verify task status changes. | |
| Both unit + integration | Unit tests for call verification + one integration test for happy path E2E. | ✓ |
| You decide | Claude picks testing approach | |

**User's choice:** Both unit + integration
**Notes:** Unit tests for fast call verification in each service, plus integration tests for the full happy path.

---

## Claude's Discretion

- Exact placement of checkShipmentTaskCompletion call within each service
- DPD/UPS cron route auth pattern
- QStash schedule registration
- Integration test fixture setup
