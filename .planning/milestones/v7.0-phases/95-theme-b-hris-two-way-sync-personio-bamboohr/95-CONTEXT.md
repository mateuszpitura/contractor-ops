# Phase 95: Theme B — HRIS Two-Way Sync (Personio + BambooHR) - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning

<domain>
## Phase Boundary

An org **syncs people data two-way with exactly one HRIS** (Personio OR BambooHR, never both).
The **HRIS owns registry fields** (name/contact/position/department); **Contractor Ops owns
financial/compliance fields** (invoice/payment/classification/compliance). The source-of-truth
split is **enforced, not advisory** — protected fields are physically un-writable by the pull mapper.

- **Personio** (HRIS-SYNC-01/02/03) — adapter on the v2.0 integration framework: proprietary
  client-credentials bearer, API v2, 200 req/min/credential, offset/limit (max 200) pagination, no Node SDK → direct REST.
  Pull people/contracts/departments/custom-attributes (hourly cron + on-demand); push invoice-paid / payment-status /
  classification-outcome on event.
- **BambooHR** (HRIS-SYNC-04) — OAuth 2.0 mandatory, REST, no Node SDK → direct REST adapter; **same sync surface** as Personio.
  **Custom-attribute contract NOT yet verified** — gate before implementing custom-attr mapping.

**Depends on:** Phase 90 (`EmployeeProfile` registry fields = the HRIS-owned target of the pull).

**NOT this phase:**
- Bi-directional field-level *merge* — out; source-of-truth split (SYNC-05) replaces arbitrary merge.
- Any third HRIS, ATS / recruiting pipeline, performance reviews / OKR / 1:1s — out of charter (Personio/Lattice territory).
- AI conflict-resolution — SYNC-05 is a deterministic ownership split, not scoring → **no `/gsd:ai-integration-phase`**.
- Payroll export (P94), portal (P96), HR dashboard (P97).
</domain>

<decisions>
## Implementation Decisions

### Source-of-Truth Enforcement (HRIS-SYNC-05) — D-01
- **D-01:** **Allowlist projection in the pull mapper.** The pull path writes only a **typed HRIS-writable field allowlist**
  (name, contact, position, department, and the mapped registry/custom attributes). Financial/compliance fields
  (invoice, payment status, classification outcome, compliance) are **not present** in the pull DTO nor in the Prisma
  update payload the mapper emits — so an HRIS value can never overwrite them. Code-enforced and unit-tested
  ("physically un-writable" satisfied at the mapper boundary; no advisory flag). A cross-org leak test + a
  "protected field survives a conflicting HRIS pull" test are mandatory.

### Inbound Pull — Change Detection + Orchestration (HRIS-SYNC-02) — D-02
- **D-02:** **Reuse the existing sync-orchestrator pattern** (`org-definition-sync` / `google-workspace-sync-orchestrator`):
  - **Triggers:** cron-worker hourly (one run per connected integration) + a "Sync now" tRPC mutation + fire-and-forget on OAuth/connect complete.
  - **Logging:** write `IntegrationSyncLog` rows (`direction: INBOUND`, syncType, status STARTED→…) per run.
  - **Concurrency:** `sync` advisory-lock namespace (`pg_advisory_xact_lock`) to serialize per-org sync.
  - **Change detection:** **delta via `updated-since` where the provider API supports it, else snapshot-diff** against stored state.
  - **Rate/pagination:** respect Personio 200 req/min + offset/limit (max 200) pagination; back off within the limiter.

### Outbound Push — Trigger (HRIS-SYNC-03) — D-03
- **D-03:** **Reuse the `OutboxEvent` transactional outbox.** New outbox handlers dispatch the connected HRIS adapter's
  push method for invoice-paid / payment-status / classification-outcome. `invoice.paid` is already an outbox event type;
  **add outbox event types for payment-status and classification-outcome** (register in the type map + handlers). Push is
  **transactional, idempotent (keyed on `outboxEventId`), and retriable** (`attempts` / `nextAttemptAt` / `lastError`).
  No direct adapter calls inside domain mutations — the mutation only enqueues the outbox event.

### Single-Adapter Constraint + Config Storage (HRIS-SYNC-06) — D-04
- **D-04:** **DB-enforced single HRIS per org + mapping in `configJson`.** Enforce Personio-XOR-BambooHR with a
  **partial unique index on `IntegrationConnection`** (one connection of the HRIS category per `organizationId`) — a DB
  constraint, not advisory. Store the field / custom-attribute **mapping in `connection.configJson`** (mirrors the Teams
  channel-mapping pattern). Reuse `loadOrgIntegrationConnection(db, orgId, provider)` on both pull and push paths.

### Cross-Cutting (carried forward — not re-asked)
- **D-05:** Gate each adapter on its flag — `integration.personio-sync`, `integration.bamboohr-sync` (already registered;
  ship dark, flip post-deploy). Credentials via the `packages/integrations` store: **BambooHR OAuth 2.0** (encrypted token +
  refresh, refresh-lock) and **Personio client-credentials bearer**.
- **D-06:** **BambooHR custom-attribute contract is unverified** — gate/flag-defer the BambooHR *custom-attribute* mapping
  path with conditional-skip tests that auto-flip when the contract is confirmed; ship the verified standard-field sync
  first. **Personio endpoint-level rate limits are MEDIUM-confidence community data** — verify against the contract during plan-phase research.
- **D-07:** Tenant `organizationId` from session; `writeAuditLog` on connect/disconnect + on push and on inbound writes;
  Zod `.strict()` on sync procedures; no `console.*` (`@contractor-ops/logger` / `createCronLogger` in the cron worker); no unsafe `as` on external payloads (`safeParse`).
- **D-08:** Reuse, don't rebuild — integration adapter framework, outbox, sync-orchestrator, IntegrationConnection/SyncLog,
  advisory-lock. Documentation-follows-code: new adapters + outbox types + sync flow → wiki (`integrations/personio.md`,
  `integrations/bamboohr.md`, `structure/cron-jobs.md`, domain page, `patterns/feature-flags.md`) in the same change set.

### Claude's Discretion
- Exact outbox event-type names for payment-status / classification-outcome + their payload schemas.
- Snapshot-diff storage shape (where last-synced state lives) when a provider lacks `updated-since`.
- The `configJson` field-mapping schema (standard fields + Personio/BambooHR custom-attribute mapping model).
- Partial-failure / per-record error handling within a sync run + which fields `IntegrationSyncLog` carries.
- Whether the HRIS-category "single connection per org" is expressed via a provider-set check or a dedicated category column on the partial index.
- UI surface — connect + field-mapping settings page; reuse the existing integration-settings pattern (mandatory loading/empty/error + i18n parity; no new UI decision locked).
- Adapter registration wiring (heavy vs light adapter load) in `register-all`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope + requirements
- `.planning/ROADMAP.md` §"Phase 95: Theme B — HRIS Two-Way Sync" (goal, success criteria, research flags: BambooHR custom-attr unverified; Personio rate limits MEDIUM-confidence; conflict-resolution note)
- `.planning/REQUIREMENTS.md` — HRIS-SYNC-01..06; API rows for Personio (client-credentials bearer, API v2, 200 req/min, offset pagination, no Node SDK) + BambooHR (OAuth 2.0, no Node SDK, custom-attr unverified); "bi-directional field-level merge = out" non-goal
- `.planning/milestones/v7.0-BACKLOG.md` — research-gate #7 (Personio) + reuse posture
- `.planning/research/SUMMARY.md` + `.planning/research/ARCHITECTURE.md` — Personio/BambooHR API findings + reuse mandate

### Data target (upstream phase)
- `.planning/milestones/v7.0-phases/90-theme-b-employee-registry-per-market-6/90-CONTEXT.md` — `EmployeeProfile` field model = the HRIS-owned registry fields (the allowlist source for D-01)

### Reuse — integration adapter framework
- `packages/integrations/src/types/provider.ts` — `IntegrationProviderAdapter` (OAuth/webhooks/health) contract for the two new adapters
- `packages/integrations/src/registry.ts` + `packages/integrations/src/adapters/register-all.ts` — registration + heavy-adapter lazy load

### Reuse — pull orchestration
- `packages/api/src/services/org-definition-sync.ts` — cron + "Sync now" + on-connect pull pattern (Jira/Linear → rows)
- `packages/api/src/services/google-workspace-sync-orchestrator.ts` — `IntegrationSyncLog(direction: INBOUND)` directory-sync orchestrator
- `packages/api/src/lib/advisory-lock.ts` — `sync` namespace for per-org sync serialization

### Reuse — push (outbox)
- `packages/api/src/services/outbox/index.ts` + `packages/api/src/services/outbox/handlers.ts` — transactional outbox: handler contract, `outboxEventId` idempotency, retry (attempts/nextAttemptAt), demo-org skip

### Reuse — connection + config
- `packages/db/prisma/schema/integration.prisma` — `IntegrationConnection` (configJson, refresh lock, RLS) + `IntegrationSyncLog`; add the partial unique index here (D-04)
- `packages/api/src/routers/core/integration.ts` — `loadOrgIntegrationConnection`, adapter resolution
- `packages/api/src/routers/integrations/teams.ts` — `configJson` mapping-storage precedent (channel mapping → field mapping)

### Feature flags
- `packages/feature-flags/src/flags-core.ts` — `integration.personio-sync`, `integration.bamboohr-sync` (source of truth)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`packages/integrations` framework** — OAuth (BambooHR) + credential store + health for both new adapters; Personio uses client-credentials bearer.
- **`org-definition-sync` / `google-workspace-sync-orchestrator`** — proven cron + on-demand + on-connect pull pattern with `IntegrationSyncLog` and advisory-lock; clone for HRIS pull.
- **`OutboxEvent` outbox** — transactional, idempotent, retriable event dispatch; `invoice.paid` already emitted → wire push handlers, add two event types.
- **`IntegrationConnection` + `loadOrgIntegrationConnection`** — per-org connection with `configJson`; the single-adapter unique index + mapping live here.
- **P90 `EmployeeProfile`** — the registry-field target; its field set defines the pull allowlist (D-01).

### Established Patterns
- **Sync orchestrator**: cron-worker handler + "Sync now" mutation + fire-and-forget on connect; `IntegrationSyncLog` per run; `sync` advisory-lock.
- **Transactional outbox**: mutation enqueues an event; a dispatcher handler pushes with retry + idempotency — never call the integration inline.
- **configJson mapping** (Teams) — per-connection JSON config for field/attribute mapping.
- **Ship-dark flag gating** + external-dep flag-defer (BambooHR custom-attr unverified → conditional-skip tests).
- **Tenant + audit + Zod-strict + safeParse** on all external payloads; cron uses `createCronLogger`.

### Integration Points
- Two new `IntegrationProviderAdapter`s (Personio, BambooHR) in `packages/integrations`, registered in `register-all`.
- New cron-worker sync handler + `hris.sync` / connect mutations in the integration router; `IntegrationSyncLog(INBOUND)` on pull.
- New outbox event types (payment-status, classification-outcome) + handlers that dispatch to the connected HRIS adapter push.
- Partial unique index on `IntegrationConnection` (HRIS category, per org) — new migration.

</code_context>

<specifics>
## Specific Ideas

- "Enforced, not advisory" is the crux of SYNC-05 — the allowlist mapper means protected fields are literally absent from the write payload, not merely skipped by a runtime check.
- "One HRIS per org" (SYNC-06) is a DB constraint (partial unique index), not app logic — prevents three-way sync hell structurally.
- Deterministic ownership split ≠ AI conflict-resolution — the research-flag hint about `ai-integration-phase` is explicitly declined.

</specifics>

<deferred>
## Deferred Ideas

- **Bi-directional field-level merge** — out of scope; source-of-truth split is the deliberate replacement.
- **BambooHR custom-attribute mapping** — gated until the custom-attribute contract is verified; standard-field sync ships first.
- **Third+ HRIS providers, ATS/recruiting, performance reviews** — out of charter.
- **AI-assisted conflict resolution** — not needed; SYNC-05 is deterministic.

None are in Phase 95 scope — recorded so they aren't lost.

</deferred>

---

*Phase: 95-theme-b-hris-two-way-sync-personio-bamboohr*
*Context gathered: 2026-07-05*
