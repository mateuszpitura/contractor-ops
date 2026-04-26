# Phase 60: Classification Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 60-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-14
**Phase:** 60-classification-polish
**Areas discussed:** Alert detection & dedup (CLASS-07), Reassessment trigger signal (CLASS-08), Statusfeststellungsverfahren model (CLASS-09), Compliance dashboard layout (CLASS-10)

---

## Alert Detection & Dedup (CLASS-07)

### Q1 — Detection mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Cron-based daily scan | Daily cron (pattern from `/api/cron/reminders`). Iterates DE engagements, computes billing share over 12mo window, notifies on threshold crossing | ✓ |
| Event-driven on invoice write + cron safety-net | Prisma middleware recomputes on each invoice mutation; cron safety net | |
| Event-driven on assessment submit only | Recompute only when new DRV assessment completes | |

**User's choice:** Cron-based daily scan
**Notes:** 24h latency acceptable for a trend indicator; simplest infra.

### Q2 — Re-fire cadence

| Option | Description | Selected |
|--------|-------------|----------|
| Alert once per crossing + monthly reminder while over | Cross triggers → fire. Monthly reminder while still over. Down-crossing clears dedup | ✓ |
| Alert once only, no re-fire | Single fire, assumes user acknowledges | |
| Re-fire daily while over threshold | Daily while unresolved | |

**User's choice:** Alert once + monthly reminder
**Notes:** Keeps signal visible without notification fatigue.

### Q3 — Delivery channels

| Option | Description | Selected |
|--------|-------------|----------|
| Respect UserNotificationPreference, default in-app + email ON | New types registered with sensible defaults; opt-in via settings | ✓ |
| In-app only in v5.0 | Just in-app; external channels deferred | |
| Broadcast over all channels regardless of preference | Override for compliance-critical tier | |

**User's choice:** Respect UserNotificationPreference
**Notes:** In-app + email default; Slack/Teams opt-in.

---

## Reassessment Trigger Signal (CLASS-08)

### Q1 — What counts as material change?

| Option | Description | Selected |
|--------|-------------|----------|
| Rate + dates + scope + contract amendments | `activeTo` change, rate change, `projectId`/`teamId` change, new signed contract version; ignore cosmetic edits (tags, allocationPercent ≤5%, notes, cost-center) | ✓ |
| Any field change on ContractorAssignment or Contract | Conservative; produces false positives | |
| Manual "mark for reassessment" mutation only | No auto-detection; weakest compliance value | |

**User's choice:** Rate + dates + scope + contract amendments
**Notes:** Matches HMRC off-payroll guidance.

### Q2 — Detection mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| AuditLog post-hoc scan in daily cron | Reads existing `AuditLog` rows; decoupled, replay-safe | ✓ |
| Prisma middleware synchronous hook | Low latency; risks blocking mutations | |
| Event-bus / outbox pattern | Overkill for v5.0 (no existing outbox) | |

**User's choice:** AuditLog post-hoc scan
**Notes:** Reuses existing audit infrastructure; no mutation-path contention.

### Q3 — Trigger action

| Option | Description | Selected |
|--------|-------------|----------|
| Create ReassessmentTrigger row + in-app notification + dashboard chip | Persistent row with reasons + status; notification + chip on engagement page; auto-resolves on new assessment | ✓ |
| Just a notification, no persistent trigger row | No new model; harder to track lifecycle | |
| Trigger row + email + auto-open new draft assessment | Pre-creates draft; risks cluttering draft list | |

**User's choice:** ReassessmentTrigger row + notification + chip
**Notes:** Receipts visible in triggerReasons for user trust; auto-resolve on new assessment.

---

## Statusfeststellungsverfahren Model (CLASS-09)

### Q1 — Model shape

| Option | Description | Selected |
|--------|-------------|----------|
| Lightweight — single Prisma model, enum outcomes, no uploads | filedAt, drvReference, outcome enum, validFrom/To, notes — matches CLASS-09 fields exactly | ✓ |
| Lightweight + single linked PDF upload | Adds optional decision-letter R2 upload | |
| Fuller lifecycle — state machine + correspondence log + multi-document | Matches regulated DRV teams; overkill for v5.0 | |

**User's choice:** Lightweight only
**Notes:** Document upload and correspondence log deferred.

### Q2 — Expiry reminder cadence

| Option | Description | Selected |
|--------|-------------|----------|
| 90 / 30 / 7 days before validTo | Three reminders; 90 days accounts for DRV 3-6 month processing | ✓ |
| 30 / 7 days before validTo | Two reminders; optimistic turnaround | |
| Configurable per-org | Adds settings surface | |

**User's choice:** 90 / 30 / 7 days
**Notes:** Piggyback on existing `/api/cron/reminders` helper — not a separate cron.

### Q3 — Entry point / CTA location

| Option | Description | Selected |
|--------|-------------|----------|
| Per-engagement CTA + list view in compliance dashboard | Primary on engagement detail page; secondary list on dashboard | ✓ |
| Org settings only (admin-owned) | Simpler permissions; inconvenient | |
| Contractor profile page only | Attached to Contractor, loses per-engagement granularity | |

**User's choice:** Per-engagement CTA + dashboard list
**Notes:** Writes gated by `contractor:update`; reads by `contractor:read`.

---

## Compliance Dashboard Layout (CLASS-10)

### Q1 — Page layout

| Option | Description | Selected |
|--------|-------------|----------|
| Single page with per-market cards stacked (GB above DE) | Global header + two market cards each with 4 tiles | ✓ |
| Tabbed per-market | Focused view; hides other market | |
| Per-engagement summary with filter chips | Highest granularity; loses at-a-glance health | |

**User's choice:** Single page, per-market cards stacked
**Notes:** Best cross-market view for the primary compliance-officer use case.

### Q2 — Risk distribution visualisation

| Option | Description | Selected |
|--------|-------------|----------|
| Horizontal stacked bar with counts | Matches Phase 58 pill palette; compact; compares markets side-by-side | ✓ |
| Donut/pie chart | Visually appealing; harder to compare markets | |
| Per-risk KPI cards (3 numbers stacked) | Clean; loses proportional visual | |

**User's choice:** Horizontal stacked bar
**Notes:** Colour segments match Phase 58 outcome pills.

### Q3 — Data freshness

| Option | Description | Selected |
|--------|-------------|----------|
| Live query on page load + manual refresh | tRPC queries per tile; no caching | ✓ |
| Materialised view refreshed nightly | Faster load; adds cron + schema | |
| Client-side polling every 60s | Noisy; unnecessary | |

**User's choice:** Live query + manual refresh
**Notes:** Engagement volume low enough that live queries are fine; no caching layer.

---

## Claude's Discretion

Areas where exact values are deferred to planning/implementation:
- Exact CSS layout (card spacing, tile widths, typography) — follow existing dashboard patterns
- Chart library for stacked bar (native SVG vs Recharts vs Tremor)
- Exact cron schedule slots (avoid colliding with existing crons)
- Batch/pagination of the crons for large tenants
- Whether `triggerReasons` uses `unknown[]` or Zod-validated schema (likely Zod)
- Visual style of reassessment chip on engagement page — defer to frontend-design
- Optional help-text link to DRV V0023 form from Statusfeststellungsverfahren panel

## Deferred Ideas

Captured in 60-CONTEXT.md `<deferred>` section:
- DRV decision-letter upload on Statusfeststellungsverfahren
- Correspondence log / fuller lifecycle state machine
- Event-driven alerting (Prisma middleware / outbox)
- Materialised compliance-dashboard snapshot
- Client-side polling / SSE
- Configurable per-org thresholds
- Threshold-crossing audit log
- Auto draft-assessment pre-fill on trigger
- Per-engagement time-based reassessment cadence
- Third-market support beyond GB + DE
- Auditor-portal share links
- Slack/Teams rich-card polish

Reviewed Todos (not folded): none — `gsd-tools todo match-phase 60` returned 0 matches.
