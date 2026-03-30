# Phase 26: Calendar Wiring Fixes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-30
**Phase:** 26-calendar-wiring-fixes
**Areas discussed:** OAuth connect URL fix, Calendar event hook placement, Error handling scope

---

## OAuth connect URL fix

| Option | Description | Selected |
|--------|-------------|----------|
| Fix adapter slug mapping only | Ensure connect button looks up correct adapter slug and OAuth URL construction works correctly. Minimal change. | |
| Add URL validation guard | Fix slug mapping AND add runtime check that constructed URL matches provider's authorization domain. | |
| You decide | Claude picks minimal correct fix based on codebase patterns. | ✓ |

**User's choice:** You decide
**Notes:** Claude has discretion to determine the exact fix based on the codebase — slug mismatch or URL field selection.

---

## Calendar event hook placement

| Option | Description | Selected |
|--------|-------------|----------|
| After Jira hook | Add createTaskCalendarEvent immediately after Jira block. Same try/catch pattern. | |
| Separate integration block | Create dedicated "calendar integrations" block in startRun, separate from Jira block. | ✓ |
| You decide | Claude picks placement based on existing code structure. | |

**User's choice:** Separate integration block
**Notes:** More readable and extensible. Keeps calendar concerns isolated from Jira integration code.

---

## Error handling scope

| Option | Description | Selected |
|--------|-------------|----------|
| Server-side logs only | console.error with structured log. User never sees calendar failures. Matches Jira pattern. | |
| Non-blocking toast warning | Log server-side AND show dismissible warning toast. User aware but not blocked. | ✓ |
| You decide | Claude picks based on Jira precedent and UX impact. | |

**User's choice:** Non-blocking toast warning
**Notes:** Departs from Jira's silent-failure pattern — user wants visibility into calendar event creation failures without blocking workflow operations.

---

## Claude's Discretion

- OAuth URL fix: exact code changes to resolve slug mismatch or URL field selection
- Calendar hook: exact placement within startRun function body relative to Jira block
- Toast warning: implementation approach (tRPC response metadata vs websocket vs mutation return)

## Deferred Ideas

None — discussion stayed within phase scope.
