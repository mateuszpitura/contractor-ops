# Phase 76: F2 IdP — Capability Mixin + Saga Schema + Cooldown Gate + GWS Scope Migration - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Architectural foundation for IdP deprovisioning. This phase ships the **infrastructure** that Phases 77 (GWS+Slack adapters) and 78 (Entra+Okta+GitHub adapters) build on; it does NOT ship any actual provider deprovisioning logic. Specifically:

- A `Deprovisionable` TS interface contract that every IdP-capable adapter MUST implement (suspendAccount + revokeAllSessions) at compile time.
- `DeprovisioningRun` + `DeprovisioningStep` saga schema with idempotent retry, SOC2-evidence-grade audit (request/response SHA-256 hashes, no PII).
- `IdpChangeProvenance` self-trigger filter that prevents webhook events from our own deprovision calls re-firing the v3.0 user-departed notification path (Pitfall 8).
- 14-day cooldown gate that blocks deprovisioning starts within 14 days of `AssignmentStatus = ENDED` (Pitfall 7 — final-invoice race protection).
- GWS scope-upgrade-flow extension: detect-and-prompt banner with `prompt=consent` for write-access escalation (extends Phase 70 D-16's reconnect banner).
- Minimum-privilege OAuth scope registry per provider + `pnpm lint:scopes` CI guard preventing scope-expansion drift.
- Per-provider integration-test stub template asserting revocation verifiable within mocked-clock 5 minutes (template only — Phases 77-78 ship the per-provider real implementations).

Out of scope for Phase 76: actual GWS/Slack/Entra/Okta/GitHub adapter logic; admin reconcile-queue UI dashboard polish (Phase 73 owns that surface); per-provider OAuth flow UX beyond the GWS write-access banner extension.

</domain>

<decisions>
## Implementation Decisions

### Saga schema + QStash topology + retry/audit semantics
- **D-01:** Two-table parent/child Prisma schema:
  - `DeprovisioningRun` (parent): `id`, `organizationId`, `contractorId`, `assignmentId`, `status` (enum: `PENDING` | `IN_PROGRESS` | `COMPLETED` | `PARTIAL_FAILURE` | `FAILED`), `startedAt`, `finishedAt`, `triggeredByUserId`, `idempotencyKey` (string).
  - `DeprovisioningStep` (child, N per run): `id`, `runId` (FK), `provider` (enum), `stepKind` (`suspendAccount` | `revokeAllSessions`), `status`, `attempts`, `requestSha256`, `responseSha256`, `lastErrorMessage`, `qstashMessageId`, `startedAt`, `finishedAt`.
- **D-02:** Aggregate `DeprovisioningRun.status` is **derived in code**, written by a single `recomputeRunStatus(runId)` function called by the QStash job-completion handler after every step transition. Rule:
  - All steps SUCCEEDED → `COMPLETED`
  - Any step FAILED with `attempts >= MAX_ATTEMPTS` AND any step SUCCEEDED → `PARTIAL_FAILURE`
  - All steps FAILED at max attempts → `FAILED`
  - Otherwise → `IN_PROGRESS`
  - Admin reconcile queue queries `WHERE status = 'PARTIAL_FAILURE'`. Single source of truth for the rule.
- **D-03:** **Fan-out QStash topology at saga-start**. `startDeprovisioningRun` enqueues N independent QStash jobs (one per (provider, stepKind) tuple — typically 5 providers × 2 stepKinds = 10 jobs for a full run). Each job: (a) reads its step row, (b) calls the adapter method, (c) writes result + SHA-256 hashes back, (d) calls `recomputeRunStatus(runId)`. **Per Pitfall 10: NO `Promise.allSettled` aggregation in code; jobs stand alone**. Retries via QStash native exponential-backoff; head-of-job guard checks `attempts <= MAX_ATTEMPTS` and short-circuits to FAILED if exceeded.
- **D-04:** Manual-retry-per-provider button: per-step button enqueues a fresh QStash job for **only that step**, idempotent via step.attempts reset.
  - Mutation contract: verify step is in `FAILED` state → reset `step.attempts = 0` and `step.status = 'PENDING'` → enqueue QStash job → emit audit-log entry via `getIdpAuditLogger()`.
  - QStash idempotencyKey: `runId + stepId + attempt-counter` to prevent double-enqueue races.
  - Run-level retry button is NOT shipped (per-step is in the success criteria; run-level adds noise without value).

### 14-day cooldown gate
- **D-05:** **Single source-of-truth helper** `cooldown.canStartDeprovisioning(assignment): { allowed: boolean; earliestDate?: Date; reason?: string }` lives in a new `@contractor-ops/idp-saga` workspace package. Called from BOTH:
  - The tRPC `startDeprovisioningRun` mutation server-side (security boundary — returns `FORBIDDEN` with structured error if blocked).
  - The contractor-profile UI via tRPC `getDeprovisioningEligibility` query (UX — disables the button + shows earliestDate tooltip).
  - One rule, two consumers. Client UI cannot lie about the gate state.
- **D-06:** **14 calendar days, resolved in the contractor's jurisdiction TZ**. Reuses the date-with-TZ library Phase 71 D-07 pins (likely `date-fns-tz` or `dayjs/plugin/timezone` — Researcher confirms). Calendar days because final-invoice statutes (DE/UK/PL/UAE/SA) all run on calendar-day windows. Jurisdiction TZ for symmetry with Phase 71 D-07's `expiryJurisdictionTz` field. The `assignment.endedAt` timestamp + the contractor's jurisdiction TZ drive the boundary.
- **D-07:** **Portal magic-link auth has no IdP dependency** — already true in `packages/api/src/services/portal-magic-link.ts` (verify in research phase). Cooldown gate only affects IdP deprovisioning calls (`adapter.suspendAccount()` / `adapter.revokeAllSessions()`); it does NOT touch the contractor's portal session token. A contractor in cooldown can still log into the portal and upload final invoices. **If research uncovers a cross-dependency, fixing it is in scope for this phase**.
- **D-08:** **No admin override** for the 14-day cooldown. The gate is a function of `assignment.endedAt` only. If business needs deprovisioning sooner, admin must edit `assignment.endedAt` to an earlier date (which audits via the existing assignment-edit audit trail). No `force=true` flag, no second-admin approval flow, no single-click override. Pitfall 7's framing — "we got burned by NOT having the gate" — points to a hard rule, not an escape-hatchable one.

### IdpChangeProvenance self-trigger filter
- **D-09:** **Standalone `IdpChangeProvenance` Prisma table.** Columns: `id`, `organizationId`, `provider`, `externalUserId`, `actionKind` (enum: `suspend` | `revoke_session`), `initiatedAt`, `matchedAt` (nullable), `deprovisioningStepId` (FK).
  - Index on `(provider, externalUserId, actionKind, initiatedAt)` for the lookup.
  - Inserted by the QStash deprovision job BEFORE calling the adapter method. Updated (matchedAt = now()) by the webhook handler when a match is found.
- **D-10:** **Matching algorithm: exact match on (provider, externalUserId, actionKind) + 1-hour time window**.
  - Webhook handler query: `WHERE provider=$ AND externalUserId=$ AND actionKind=$ AND initiatedAt > NOW() - 1h AND matchedAt IS NULL ORDER BY initiatedAt DESC LIMIT 1`.
  - On hit: set `matchedAt = NOW()`, suppress the downstream notification.
  - Acceptable false-positive: a separate human admin manually suspending the same user via the GWS console within 1 hour of our suspend call would also be suppressed — but the user is suspended either way, so no functional difference.
- **D-11:** **Non-matching webhook events flow through the existing v3.0 user-departed notification path**. Absence of a provenance match means the event is genuinely external (someone else suspended via the provider's console, external HR sync triggered it, etc.). Default to delivery — Pitfall 8 framing is "no own-loop", not "no external events".
- **D-12:** **Two-tier retention policy**:
  - Match window: 1 hour (the actionable filter logic).
  - Audit retention: 90 days. A scheduled background GC job (using existing reminder-cron infrastructure) deletes rows where `initiatedAt < NOW() - 90d`.
  - Keeps the active-match table small while preserving SOC2 audit evidence ("why did we filter this webhook on 2026-04-12").

### Deprovisionable interface + minimum-privilege OAuth scope registry
- **D-13:** **Standalone `Deprovisionable` TS interface** at `packages/integrations/src/types/deprovisionable.ts`:
  ```ts
  export interface Deprovisionable {
    suspendAccount(externalUserId: string): Promise<DeprovisionResult>;
    revokeAllSessions(externalUserId: string): Promise<DeprovisionResult>;
    verifyDeprovisioned(externalUserId: string): Promise<boolean>;
  }
  ```
  IdP-capable adapters declare `class GoogleWorkspaceAdapter extends BaseAdapter implements Deprovisionable { ... }`. The saga's QStash job resolves the concrete class via the adapter registry; if the resolved class lacks `Deprovisionable`, the registry lookup fails at compile time via a typed mapping table. **Phase 78 Entra adapter that forgets `revokeAllSessions()` will not compile**.
- **D-14:** **Per-provider typed-constant scope registry** at `packages/integrations/src/scopes/{provider}-deprovision-scopes.ts`. Each file exports a typed const (e.g., `export const GOOGLE_WORKSPACE_DEPROVISION_SCOPES = ['https://www.googleapis.com/auth/admin.directory.user'] as const;`). The adapter's `getOAuthConfig()` spreads scopes from these constants. Mirrors Phase 70 D-02 (typed-constants per concern). Reuses Phase 70 D-13's `scopeCapabilities` JSONB shape — capabilities array maps to these scopes via Phase 71-style write-time validation.
- **D-15:** **New `pnpm lint:scopes` CI guard** lives in the existing `@contractor-ops/lint-guards` workspace package (Phase 70 D-04). Mirrors the three Phase 70 guards (lint:schema, lint:logs, i18n:parity):
  - Parses every adapter's `getOAuthConfig()` return value.
  - Asserts every scope string appears in the corresponding `{provider}-deprovision-scopes.ts` constant.
  - Adding a scope without updating the typed constant fails CI.
  - Structured-diff output (Phase 70 D-03 pattern) naming the offending adapter and the new scope.
  - Independent script, no umbrella (Phase 70 D-04). Runs in CI + husky pre-push (Phase 70 D-01).
  - CODEOWNERS on the scope files is complementary, not a substitute (not in scope for this phase, but recommended in SUMMARY).
- **D-16:** **Per-provider MSW-mocked integration-test stub template** at `packages/integrations/src/adapters/__tests__/{provider}-deprovision.test.ts`.
  - Setup: mock-clock (vitest's `vi.useFakeTimers()`) + MSW handlers for the provider's API (existing infrastructure: `packages/test-utils/src/msw/`).
  - Test body: (a) call `adapter.suspendAccount(externalUserId)`, assert `result.status === 'SUCCEEDED'`; (b) advance mocked clock by 5 min; (c) call `adapter.verifyDeprovisioned(externalUserId)`, assert truthy.
  - **Phase 76 ships ONE such test as the template** (e.g., a fixture provider or the GWS adapter as the example).
  - Phases 77-78 ship the per-provider real-mock implementations against this template.
  - LOCAL-ONLY constraint honored: no live sandbox account requirements in CI.

### Claude's Discretion
- The exact `DeprovisionResult` type shape (success/failure variants, error-classification taxonomy) — Researcher to draft against Phase 70 D-15 audit-fields conventions.
- The `MAX_ATTEMPTS` constant value (3? 5?) — pick based on QStash exponential-backoff economics; document in the saga config file.
- Which provider gets the example test stub in D-16 (likely GWS since it's also the SC#3 scope-upgrade subject — convenient consolidation).
- The exact tRPC mutation surface for `startDeprovisioningRun` (input shape, return shape) — match existing v5 `recreateDraftAfterDrift` conventions.
- The exact UI copy + interaction model for the GWS write-access banner extension — Phase 73 owns the dashboard polish; this phase ships functional UI only.
- The exact background GC job schedule for D-12 (daily? weekly?) — pick a sensible default; document in the cron registry.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 70 dependencies (Phase 76 builds directly on these)
- `packages/db/prisma/schema/integration.prisma` — `IntegrationConnection.scopeCapabilities` JSONB (Phase 70 D-13). Phase 76 SC#3 writes new `directory.user.write` capability here.
- `packages/db/src/types/scope-capabilities.ts` — `ScopeCapabilities` + `CapabilityEnum` types from Phase 70 D-13.
- `packages/db/src/scope-capabilities-schema.ts` — `scopeCapabilitiesSchema` Zod schema for boundary validation; Phase 76 SC#3's OAuth callback validates here.
- `packages/logger/src/idp-audit-logger.ts` — Phase 70 D-15 `getIdpAuditLogger()` factory. Phase 76 SC#2 audit trail emits through this.
- `packages/logger/src/idp-audit-logger.ts` `IDP_AUDIT_ALLOWED_FIELDS` constant — defines the allow-list of audit fields. May need extension for `runId`, `stepId`, `requestSha256`, `responseSha256`, `attempts`.
- `packages/feature-flags/src/signoff-registry-flags.ts` — Phase 70 D-09..12 parallel signoff registry; Phase 76 ships the `idp-deprovisioning` flag PENDING entry here.
- `packages/feature-flags/src/registry.ts` — Phase 70 D-11 `idp-deprovisioning` is one of the four gated namespaces.
- `apps/web/src/components/integrations/google-workspace-reconnect-banner.tsx` — Phase 70 D-16 banner component. Phase 76 SC#3 extends this with the "Re-OAuth required for write access" variant (separate banner state, same component file or a sibling — Researcher chooses).
- `apps/web/src/components/integrations/google-workspace-provider-section.tsx` — host of the reconnect banner; SC#3 extension lives here.

### Adapter baseline
- `packages/integrations/src/adapters/base-adapter.ts` — `BaseAdapter` abstract class with optional methods. Phase 76 D-13 adds the new `Deprovisionable` interface; IdP-capable adapters implement BOTH BaseAdapter AND Deprovisionable.
- `packages/integrations/src/adapters/google-workspace-adapter.ts` — current GWS adapter (lines 50-70 = current OAuth scope set). Phase 76 SC#3 extension upgrades to write-capable scopes; Phase 76 D-14 adds the typed scope const for it.
- `packages/integrations/src/types/provider.ts` — `IntegrationProviderAdapter` and `OAuthConfig` types — Phase 76 D-14 typed constants spread INTO this.

### Saga / QStash baseline
- `packages/api/src/routers/late-payment-interest.ts` — existing QStash usage pattern (publishJSON, idempotencyKey).
- `packages/api/src/routers/google-workspace.ts` — existing QStash + GWS pattern.
- `packages/api/src/routers/classification.ts` `recreateDraftAfterDrift` — v5 saga-state-management precedent (also referenced from Phase 71); the transactional + idempotency-precondition pattern carries forward.
- `packages/test-utils/src/msw/handlers/qstash.ts` — existing MSW handlers for QStash (used by D-16 test stubs).
- `packages/test-utils/src/msw/scenarios/partial-failure.ts` — existing MSW scenario fixture for partial-failure testing — directly applicable to SC#2's PARTIAL_FAILURE state tests.

### Magic-link portal (D-07 verify)
- `packages/api/src/services/portal-magic-link.ts` — magic-link issuance and verification. Researcher confirms there's no IdP cross-dependency.
- `packages/api/src/services/portal-session.ts` — portal session validation; same verify task.

### TZ handling (D-06)
- Whichever date-with-TZ library Phase 71 D-07 pins (`date-fns-tz` or `dayjs/plugin/timezone`).

### Audit log
- Existing `audit_log` Prisma table — `getIdpAuditLogger()` already routes there; Phase 76 SC#2's per-run audit shape uses the same single-entry-per-event pattern from Phase 71 D-15.

### Multi-region constraints
- `packages/db/scripts/push-all-regions.ts` — schema migration must apply to EU + ME regions; D-01 (DeprovisioningRun + Step), D-09 (IdpChangeProvenance) all require multi-region migration. Manual post-deploy step per Standing Constraint.

### ROADMAP entry (success criteria source-of-truth)
- `.planning/ROADMAP.md` "Phase 76: F2 IdP — Capability Mixin + Saga Schema + Cooldown Gate + GWS Scope Migration" — 8 numbered success criteria + Pitfalls 7, 8, 10, 11.

### Standing constraints
- `.planning/STATE.md` "Standing Project Constraints" — LOCAL-ONLY deploy, legal review DEFERRED. Multi-region migrations recorded as manual post-deploy.

### Cross-phase dependencies
- **Phase 70 (shipped)**: scopeCapabilities, getIdpAuditLogger, banner pattern, signoff-registry, gated namespace.
- **Phase 74 (planned, not yet built)**: workflow `ACCESS_REVOKE` task hook — Phase 76 saga is the consumer of this hook. Researcher should align task-hook contract.
- **Phase 75 (planned, not yet built)**: F4 ends → cooldown gate references `final-invoice-paid` state. Phase 76 D-08's `assignment.endedAt` boundary depends on Phase 74-75 establishing the lifecycle.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`BaseAdapter` (packages/integrations/src/adapters/base-adapter.ts)** — abstract class with optional methods. Phase 76 D-13 layers `implements Deprovisionable` on top.
- **`getIdpAuditLogger()`** + `IDP_AUDIT_ALLOWED_FIELDS` (Phase 70 D-15) — used by SC#2 audit trail; may need extension for runId/stepId/SHA hashes.
- **`scopeCapabilitiesSchema`** Zod schema (Phase 70 D-13) — used by SC#3 callback boundary validation.
- **`google-workspace-reconnect-banner.tsx`** (Phase 70 D-16) — the reconnect-required banner. SC#3 extends with write-access variant.
- **MSW handlers infrastructure** (`packages/test-utils/src/msw/`) — directly applicable to D-16 test stubs.
- **`partial-failure.ts` MSW scenario** — fixture for SC#2 PARTIAL_FAILURE state testing.
- **`signoff-registry-flags.ts`** (Phase 70 D-09..12) — Phase 76 ships the `idp-deprovisioning` flag PENDING entry here.
- **Existing QStash patterns** (`packages/api/src/routers/late-payment-interest.ts`) — QStash publishJSON + idempotencyKey shape.
- **`@contractor-ops/lint-guards` workspace package** (Phase 70 D-04) — host for the new `lint:scopes` CI guard (D-15).

### Established Patterns
- **Typed-constants over runtime config** (Phase 70 D-02; Phase 71 D-01) — D-14 follows this pattern for OAuth scope registry.
- **WAIVED preserved, never deleted** (Phase 71 D-09) — saga rows are similarly preserved (no DELETE on completion); 90-day GC retention pattern (Phase 76 D-12) mirrors this audit-trail discipline.
- **Single audit-log entry per state-changing invocation** (Phase 71 D-15) — D-04 (manual retry) emits a single entry per click, same shape.
- **Pure-function-plus-CLI-entry** (Phase 70 D-14) — saga's `recomputeRunStatus` is a pure function used by both QStash job-completion handlers and tests.
- **Idempotency via precondition guard** (Phase 71 D-16; v5 `recreateDraftAfterDrift`) — manual-retry-per-step (D-04) uses the same pattern: verify state then mutate.
- **Multi-region migrations via `push-all-regions.ts`** — D-01 and D-09 schema changes must apply to EU + ME.

### Integration Points
- **`packages/integrations/src/adapters/google-workspace-adapter.ts`** — D-13 forces it to `implements Deprovisionable` (compile-error-driven design); D-14 introduces a typed scope const that the OAuthConfig spreads from; SC#3 banner extension wires here.
- **New `@contractor-ops/idp-saga` workspace package** — host for `cooldown.canStartDeprovisioning()` (D-05), `recomputeRunStatus()` (D-02), QStash job entry-points, manual-retry mutation logic (D-04).
- **`packages/db/prisma/schema/`** — three new models (DeprovisioningRun, DeprovisioningStep, IdpChangeProvenance) + at least one new field on `ContractorAssignment` if `endedAt` doesn't already exist (Researcher confirms; current schema shows AssignmentStatus enum but `endedAt` timestamp field needs verification).
- **`packages/api/src/routers/`** — new `deprovisioning.ts` router with `startDeprovisioningRun`, `getDeprovisioningEligibility`, `getDeprovisioningRun`, `retryDeprovisioningStep` mutations/queries.
- **Webhook receiver routers** (e.g., `packages/api/src/routers/google-workspace.ts`) — gain the IdpChangeProvenance lookup at the top of the user-suspend event handler (D-09..12).
- **`@contractor-ops/lint-guards`** package — gains `lint:scopes` script (D-15).
- **CI workflow + husky pre-push** (Phase 70 D-04) — gain `pnpm lint:scopes` invocation.
- **`apps/web/src/components/integrations/`** — banner extension (SC#3) for write-access variant.

</code_context>

<specifics>
## Specific Ideas

- The 14-day cooldown is a hard gate not an escape-hatchable one — Pitfall 7's framing is unambiguous.
- "No `Promise.allSettled` aggregation" (SC#8 / Pitfall 10) is the architectural law for the whole saga: every step is independent in QStash, aggregate state is computed not stored-as-promise-result.
- The `IdpChangeProvenance` filter must default to delivery on non-match — silently dropping legitimate user-departed events would defeat the purpose of the v3.0 directory-import feature.
- The `lint:scopes` guard must use the same UX as Phase 70's three guards (structured diff + remediation pointer per D-03) for engineer familiarity.
- The Phase 70 banner component extension for write-access (SC#3) is the consumer-of-our-own-API moment for the scopeCapabilities JSONB infrastructure — a natural integration test of the foundation that just shipped.

</specifics>

<deferred>
## Deferred Ideas

- **Run-level retry button** (retry all FAILED steps in one click) — rejected in D-04 in favor of per-step retry. Revisit if admin telemetry shows the per-step UX is too clicky during recurring partial-failure incidents.
- **Admin override / 4-eyes flow for the 14-day cooldown** — rejected in D-08 (Pitfall 7's framing). Revisit if a real edge case (termination-for-cause, no final invoice owed) shows up in production telemetry post-deploy.
- **Live integration tests against real provider sandbox accounts** — rejected in D-16 in favor of MSW-mocked stubs. Revisit when LOCAL-ONLY constraint lifts and CI gains sandbox-secrets management.
- **CODEOWNERS on the scope files** — complementary to D-15's lint guard, recommended in SUMMARY but not in scope for this phase.
- **Loose-window provenance match (24-hour, user-only)** — rejected in D-10 (too loose). Revisit if production telemetry shows the 1-hour window misses real self-trigger events.
- **Redis-backed provenance lookup** — rejected in D-09 (loses audit trail). Revisit if DB lookup latency becomes a webhook-handler bottleneck.

</deferred>

---

*Phase: 76-f2-idp-capability-mixin-saga-schema-cooldown-gate-gws-scope-*
*Context gathered: 2026-04-27*
