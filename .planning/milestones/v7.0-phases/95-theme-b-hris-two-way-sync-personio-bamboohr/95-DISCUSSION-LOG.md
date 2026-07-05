# Phase 95: Theme B — HRIS Two-Way Sync (Personio + BambooHR) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-05
**Phase:** 95-theme-b-hris-two-way-sync-personio-bamboohr
**Areas discussed:** Source-of-truth enforcement, Inbound pull change-detection, Outbound push trigger, Single-adapter constraint + config storage

---

## Source-of-Truth Enforcement (HRIS-SYNC-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Allowlist projection in pull mapper | Pull writes only a typed HRIS-writable allowlist; protected fields absent from the DTO/update payload. Code-enforced, unit-tested. | ✓ |
| Column partition + DB write guard | Separate columns/table + RLS/trigger so a protected-column pull write fails. | |
| Both: allowlist + DB backstop | Allowlist primary + DB constraint backstop. | |

**User's choice:** Allowlist projection in the pull mapper.
**Notes:** "Physically un-writable" satisfied at the mapper boundary — protected fields never enter the write payload. Mandatory tests: cross-org leak + protected-field survives a conflicting HRIS pull.

---

## Inbound Pull — Change Detection + Orchestration (HRIS-SYNC-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse sync-orchestrator pattern, delta where available | org-definition-sync / google-workspace pattern: cron + Sync-now + on-connect; IntegrationSyncLog(INBOUND); `sync` advisory-lock; delta via updated-since else snapshot-diff; respect rate limits. | ✓ |
| Full snapshot diff every run | Always full pull + diff. | |
| Planner decides per provider | Lock reuse; leave delta-vs-snapshot + custom-attr to planner. | |

**User's choice:** Reuse sync-orchestrator pattern, delta where the API supports it.
**Notes:** Respect Personio 200 req/min + offset pagination. Personio rate limits are MEDIUM-confidence — verify against contract in plan-phase research.

---

## Outbound Push — Trigger (HRIS-SYNC-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse OutboxEvent outbox | New handlers dispatch to the connected HRIS adapter push; transactional, idempotent (outboxEventId), retriable. | ✓ |
| Direct adapter call in mutation | Inline push from domain mutations. | |
| Planner decides | Lock event-driven/retriable/idempotent; leave mechanism to planner. | |

**User's choice:** Reuse the OutboxEvent transactional outbox.
**Notes:** invoice.paid already an outbox type; add payment-status + classification-outcome types + handlers. Mutations only enqueue — no inline integration calls.

---

## Single-Adapter Constraint + Config Storage (HRIS-SYNC-06)

| Option | Description | Selected |
|--------|-------------|----------|
| DB unique on connection + config in configJson | Partial unique index on IntegrationConnection (one HRIS-category connection/org); mapping in configJson (Teams pattern). | ✓ |
| Dedicated OrgHrisConnection table | New table + typed mapping columns. | |
| Planner decides shape | Lock DB-enforced single-HRIS-per-org; leave table-vs-configJson to planner. | |

**User's choice:** DB partial unique index on IntegrationConnection + mapping in configJson.
**Notes:** Reuse loadOrgIntegrationConnection on pull + push. Personio-XOR-BambooHR enforced structurally, not advisory.

## Claude's Discretion

- Outbox event-type names + payloads for payment-status / classification-outcome.
- Snapshot-diff storage when a provider lacks updated-since.
- configJson field-mapping schema (standard + custom attributes).
- Partial-failure handling per sync run + IntegrationSyncLog fields.
- HRIS-category single-connection expression on the partial index.
- Connect + field-mapping UI (reuse integration-settings pattern).
- Adapter registration wiring in register-all.

## Deferred Ideas

- Bi-directional field-level merge → out (SoT split replaces it).
- BambooHR custom-attribute mapping → gated until contract verified (conditional-skip tests).
- Third+ HRIS, ATS/recruiting, performance reviews → out of charter.
- AI conflict-resolution → declined; SYNC-05 deterministic.
