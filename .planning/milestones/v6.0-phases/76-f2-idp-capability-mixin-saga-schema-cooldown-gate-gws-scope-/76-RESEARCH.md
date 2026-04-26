# Phase 76 Research — F2 IdP — Capability Mixin + Saga Schema + Cooldown Gate + GWS Scope Migration

**Researched:** 2026-04-27
**Phase Goal:** Every IdP adapter declares a uniform `Deprovisionable` contract with both `suspendAccount()` and `revokeAllSessions()`; deprovisioning runs are observable as saga state with idempotent retry; no deprovisioning starts within 14 days of `ContractorAssignment.status = ENDED`; v3.0 GWS read-only directory-import never breaks during scope upgrade; webhook self-trigger loops are impossible.
**Phase Requirements:** IDP-02, IDP-08, IDP-09, IDP-10, IDP-11, IDP-13, IDP-14, IDP-15
**Confidence:** HIGH on architectural shape (every D-XX has a sibling already shipped — Phase 70 D-15 audit logger, Phase 70 D-13 ScopeCapabilities, Phase 71 D-07 TZ pinning, v5 `recreateDraftAfterDrift` saga pattern). MEDIUM on the `Deprovisionable` adapter discriminator — adapter registry returns `IntegrationProviderAdapter` and Phase 76 must layer a typed mapping table to surface `Deprovisionable` adapters at compile time without breaking the existing registry.

---

## What we already have (foundation we extend, do NOT duplicate)

| Asset | Location | Phase 76 role |
|---|---|---|
| `IntegrationConnection.scopeCapabilities` JSONB column + `ScopeCapabilities` TS type + `scopeCapabilitiesSchema` Zod | `packages/db/prisma/schema/integration.prisma`, `packages/db/src/types/scope-capabilities.ts`, `packages/db/src/scope-capabilities-schema.ts` (Phase 70 D-13, Plan 70-09) | SC#3 — OAuth callback writes `['directory.read', 'directory.user.write']` here after consent re-flow |
| `getIdpAuditLogger()` factory + `IDP_AUDIT_ALLOWED_FIELDS` allow-list | `packages/logger/src/idp-audit-logger.ts` (Phase 70 D-15) | SC#2 — audit trail emits per-step; allow-list extended for `runId`, `stepId`, `requestSha256`, `responseSha256`, `attempts`, `stepKind` |
| Flag-namespace signoff registry — `FlagSignoffRegistrySchema` + `idp-deprovisioning` gated namespace prefix | `packages/feature-flags/src/signoff-registry-flags.ts` + `signoff-registry-flags.json` + `signoff-registry-flags-schema.ts` (Phase 70 D-09..12) | Phase 76 ships the `idp-deprovisioning` flag PENDING entry in the JSON registry |
| `BaseAdapter` abstract class + `IntegrationProviderAdapter` interface | `packages/integrations/src/adapters/base-adapter.ts`, `packages/integrations/src/types/provider.ts` | D-13 — IdP-capable adapters extend BaseAdapter AND implement Deprovisionable; mapping table surfaces them |
| `GoogleWorkspaceReconnectBanner` component + host section | `apps/web/src/components/integrations/google-workspace-reconnect-banner.tsx`, `google-workspace-provider-section.tsx` (Phase 70 D-16) | SC#3 — write-access variant added to existing component (capability-aware: hides when `user.deprovision` capability present, shows when scope upgrade required) |
| `@contractor-ops/lint-guards` workspace package with three guards (lint:schema, lint:logs, i18n:parity) | `packages/lint-guards/src/{schema-guard,logs-guard,i18n-parity}/`, root `package.json` scripts, `.husky/pre-push` (Phase 70 D-04) | D-15 — fourth guard `lint:scopes` ships as a fourth sibling subdirectory + new root npm script + pre-push extension |
| `getQStashClient().publishJSON()` + idempotency-key shape | `packages/integrations/src/services/qstash-client.ts`, `packages/api/src/routers/late-payment-interest.ts` line 533 | D-03 — saga fan-out enqueues per-step QStash jobs; D-04 — manual retry uses idempotencyKey `runId+stepId+attempt` |
| MSW QStash handlers + partial-failure scenario fixture | `packages/test-utils/src/msw/handlers/qstash.ts`, `packages/test-utils/src/msw/scenarios/partial-failure.ts` | D-16 — test stub template uses these directly; SC#2 PARTIAL_FAILURE state tests reuse the scenario |
| `recreateDraftAfterDrift` saga-state-management + idempotency precondition | `packages/api/src/routers/classification.ts` lines 219–276 (v5 precedent) | D-04 — manual-retry-per-step mirrors the precondition + transactional pattern; DeprovisioningStep.status check gates the retry |
| `push-all-regions.ts` multi-region migration runner | `packages/db/scripts/push-all-regions.ts` | D-01, D-09 — three new tables (DeprovisioningRun, DeprovisioningStep, IdpChangeProvenance) apply via this; manual post-deploy step (LOCAL-ONLY) |
| `ContractorAssignment` model with `AssignmentStatus` enum (ACTIVE/ENDED/PLANNED) and `activeTo` date | `packages/db/prisma/schema/contractor.prisma` lines 152–177, 273–277 | D-06 — `endedAt` does NOT exist on the model. Phase 76 adds `endedAt DateTime?` (timestamp, not date) to drive cooldown — distinct from `activeTo` (calendar end-of-engagement) because `endedAt` is the **administrative termination instant** that drives the 14-day clock |
| `audit_log` table + `writeAuditLog` helper | `packages/db/prisma/schema/audit.prisma`, `packages/api/src/services/audit-writer.ts` | SC#2 audit trail uses single-entry-per-event (Phase 71 D-15 precedent) via `getIdpAuditLogger()` which already writes through this layer |
| `date-fns@^4.1.0` already a dep on `apps/web` | `apps/web/package.json` line 58 | D-06 — TZ-aware boundary computation. **Reuses Phase 71 D-07's pin: `@date-fns/tz` sub-package (TZDate + startOfDay).** New `@contractor-ops/idp-saga` package adds `@date-fns/tz` as a dep — same library, no second pin |
| `webhooks/[provider]/route.ts` dynamic webhook receiver + `webhooks/_process/route.ts` async dispatcher | `apps/web/src/app/api/webhooks/[provider]/route.ts`, `apps/web/src/app/api/webhooks/_process/route.ts` | D-09..D-12 — webhook handler integration: provenance lookup happens inside the provider's `handleWebhook(payload, organizationId, connectionId)` for user-suspend events |
| Existing reminder-cron infrastructure | `apps/web/src/app/api/cron/reminders/route.ts` | D-12 — 90-day GC job for IdpChangeProvenance rows runs alongside existing reminder cron |

---

## TZ library convergence with Phase 71

Phase 71's `71-RESEARCH.md` (line 23, 385) pins **`date-fns` v4.1.0 + `@date-fns/tz` sub-package** for `expiryJurisdictionTz` boundary computation (Phase 71 D-07). Phase 76 D-06 explicitly states it "Reuses the date-with-TZ library Phase 71 D-07 pins."

**Decision:** Phase 76's new `@contractor-ops/idp-saga` package adds `@date-fns/tz` as a dependency (peer-aligned with the root `date-fns@^4.1.0`). Implementation pattern below mirrors Phase 71 verbatim:

```ts
// packages/idp-saga/src/cooldown.ts
import { TZDate } from '@date-fns/tz';
import { differenceInCalendarDays, startOfDay } from 'date-fns';

export const COOLDOWN_DAYS = 14;

export interface CooldownDecision {
  allowed: boolean;
  earliestDate?: Date;
  reason?: string;
}

/**
 * D-05/D-06 — Single source-of-truth gate. Pure function: no DB reads.
 * Caller passes the assignment's `endedAt` + the contractor's jurisdiction TZ.
 * Phase 71-style: TZDate boundaries computed at the JURISDICTION TZ.
 */
export function canStartDeprovisioning(input: {
  endedAt: Date | null;
  jurisdictionTz: string;
  status: 'ACTIVE' | 'ENDED' | 'PLANNED';
  now?: Date;
}): CooldownDecision {
  if (input.status !== 'ENDED' || !input.endedAt) {
    return { allowed: false, reason: 'Assignment is not ENDED' };
  }
  const now = input.now ?? new Date();
  const endedAtTz = new TZDate(input.endedAt, input.jurisdictionTz);
  const boundaryTz = new TZDate(
    new Date(endedAtTz.getTime() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000),
    input.jurisdictionTz,
  );
  const earliestDate = startOfDay(boundaryTz);
  if (now.getTime() < earliestDate.getTime()) {
    return {
      allowed: false,
      earliestDate,
      reason: `14-day cooldown active — earliest deprovisioning date: ${earliestDate.toISOString().slice(0, 10)}`,
    };
  }
  return { allowed: true, earliestDate };
}
```

**Reasoning for calendar days (not business days):** All five jurisdictions (DE Steuerberater, UK HMRC, PL ZUS, UAE ICA, KSA MOI) define final-invoice statutes in **calendar days**. Business-day semantics would require per-jurisdiction holiday calendars (out of scope; Phase 71 already declined the same dependency).

**Reasoning for jurisdiction TZ (not UTC):** A contractor whose `endedAt = 2026-04-12T22:30Z` (i.e., 23:30 Berlin time on 2026-04-12) is "ENDED on 2026-04-12 in Berlin." The 14-day boundary = 2026-04-26 00:00 Berlin (the start of day after the 14th day). UTC computation would land at 2026-04-26 22:30 UTC — 22.5 hours late from the contractor's perspective. Phase 71 D-07 made the same call.

---

## Saga schema (D-01) — Prisma model shape

The two-table parent/child schema lands in a new `packages/db/prisma/schema/idp-deprovisioning.prisma` file (sibling of `integration.prisma`, `audit.prisma`):

```prisma
// packages/db/prisma/schema/idp-deprovisioning.prisma — Phase 76 D-01

model DeprovisioningRun {
  id                  String                   @id @default(cuid())
  organizationId      String                   // Phase 70 lint:schema requires tenantBound
  contractorId        String
  assignmentId        String
  status              DeprovisioningRunStatus  @default(PENDING)
  startedAt           DateTime                 @default(now())
  finishedAt          DateTime?
  triggeredByUserId   String
  idempotencyKey      String                   @unique
  // Relations
  organization        Organization             @relation(fields: [organizationId], references: [id])
  contractor          Contractor               @relation(fields: [contractorId], references: [id])
  assignment          ContractorAssignment     @relation(fields: [assignmentId], references: [id])
  triggeredByUser     User                     @relation(fields: [triggeredByUserId], references: [id])
  steps               DeprovisioningStep[]

  @@index([organizationId, status])           // admin reconcile queue: WHERE status = PARTIAL_FAILURE
  @@index([organizationId, assignmentId])     // contractor-profile audit lookup
}

model DeprovisioningStep {
  id                  String                   @id @default(cuid())
  runId               String
  provider            DeprovisioningProvider   // GOOGLE_WORKSPACE | SLACK | ENTRA | OKTA | GITHUB
  stepKind            DeprovisioningStepKind   // SUSPEND_ACCOUNT | REVOKE_ALL_SESSIONS
  status              DeprovisioningStepStatus @default(PENDING)
  attempts            Int                      @default(0)
  requestSha256       String?                  // SHA-256 of canonicalised request payload (no PII; SOC2 evidence-grade)
  responseSha256      String?                  // SHA-256 of canonicalised response payload
  lastErrorMessage    String?                  // truncated to 1024 chars; surfaced in admin reconcile queue
  qstashMessageId     String?                  // QStash deduplication-id for the most recent enqueue
  startedAt           DateTime?
  finishedAt          DateTime?
  externalUserId      String                   // captured at run-start for idempotent re-issue
  // Relations
  run                 DeprovisioningRun        @relation(fields: [runId], references: [id], onDelete: Cascade)
  provenance          IdpChangeProvenance[]

  @@unique([runId, provider, stepKind])       // prevents double-fan-out on the same (run, provider, stepKind) tuple
  @@index([status, finishedAt])               // GC + retry-eligibility queries
}

enum DeprovisioningRunStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  PARTIAL_FAILURE
  FAILED
}

enum DeprovisioningStepStatus {
  PENDING
  IN_PROGRESS
  SUCCEEDED
  FAILED
}

enum DeprovisioningStepKind {
  SUSPEND_ACCOUNT
  REVOKE_ALL_SESSIONS
}

enum DeprovisioningProvider {
  GOOGLE_WORKSPACE
  SLACK
  ENTRA
  OKTA
  GITHUB
}
```

**Phase 70 lint:schema compliance** (REQ-FOUND6-01): every multi-tenant model has `organizationId`. `DeprovisioningStep` inherits scoping via the `runId` FK to `DeprovisioningRun.organizationId`; the lint guard's allow-list pattern (Phase 70 D-04) covers FK-scoped child models.

---

## Provenance schema (D-09) — IdpChangeProvenance shape

Standalone Prisma model in `packages/db/prisma/schema/idp-deprovisioning.prisma` (same file — single concern):

```prisma
model IdpChangeProvenance {
  id                    String                  @id @default(cuid())
  organizationId        String                  // tenantBound
  provider              DeprovisioningProvider
  externalUserId        String                  // provider-side user identifier (e.g., GWS primaryEmail or userId)
  actionKind            IdpProvenanceActionKind // SUSPEND | REVOKE_SESSION
  initiatedAt           DateTime                @default(now())
  matchedAt             DateTime?               // populated by webhook handler on hit
  deprovisioningStepId  String                  // FK back to the saga step that initiated
  step                  DeprovisioningStep      @relation(fields: [deprovisioningStepId], references: [id], onDelete: Cascade)

  @@index([provider, externalUserId, actionKind, initiatedAt])  // D-10 lookup index
  @@index([initiatedAt])                                         // D-12 GC scan
}

enum IdpProvenanceActionKind {
  SUSPEND
  REVOKE_SESSION
}
```

**Index strategy (D-10):** the composite `(provider, externalUserId, actionKind, initiatedAt)` index supports the webhook handler's lookup query verbatim. The `(initiatedAt)` index supports the GC job's `WHERE initiatedAt < NOW() - 90d` scan.

---

## Cooldown column addition — `ContractorAssignment.endedAt`

**Verified:** the current `ContractorAssignment` model does NOT have `endedAt`. It has `activeTo DateTime? @db.Date` (the planned/actual engagement-end calendar date). The cooldown gate needs a TIMESTAMP, not a date — the 14-day boundary is hour-precise (jurisdiction-TZ end-of-day).

**Add to schema** (Plan 76-02):
```prisma
model ContractorAssignment {
  // ... existing fields ...
  endedAt           DateTime?        // Phase 76 D-06 — administrative termination instant; drives 14-day cooldown
}
```

**Consumer:** `cooldown.canStartDeprovisioning(...)` reads `endedAt`. **`endedAt` is set by the workflow's `ACCESS_REVOKE` task hook (Phase 74) when the assignment transitions to ENDED.** Phase 76 cannot wait for Phase 74 to ship — Phase 76 ships the column + the consumer; Phase 74 (planned in parallel) populates it.

**Forward-compat:** when `endedAt IS NULL` AND `status = 'ENDED'` (legacy data or pre-Phase-74 transitions), `canStartDeprovisioning()` returns `{ allowed: false, reason: 'endedAt timestamp missing — set via assignment edit before deprovisioning' }`. Test fixture covers this branch.

---

## DeprovisionResult type shape (Claude's Discretion)

```ts
// packages/integrations/src/types/deprovisionable.ts — D-13
export type DeprovisionResultStatus = 'SUCCEEDED' | 'FAILED';

export type DeprovisionFailureKind =
  | 'AUTH_REVOKED'        // adapter's stored token rejected — operator action required
  | 'USER_NOT_FOUND'      // externalUserId no longer exists provider-side (idempotent: treat as success)
  | 'RATE_LIMITED'        // provider returned 429 — QStash retry will backoff
  | 'PROVIDER_ERROR'      // 5xx — QStash retry
  | 'NETWORK'             // timeout / connection — QStash retry
  | 'UNKNOWN';

export interface DeprovisionResult {
  status: DeprovisionResultStatus;
  failureKind?: DeprovisionFailureKind;
  // Sanitised error message (no PII, no tokens) — surfaces in DeprovisioningStep.lastErrorMessage
  errorMessage?: string;
  // Canonicalised hashes — written into DeprovisioningStep.requestSha256 / .responseSha256
  requestSha256: string;
  responseSha256: string;
}

export interface Deprovisionable {
  suspendAccount(externalUserId: string): Promise<DeprovisionResult>;
  revokeAllSessions(externalUserId: string): Promise<DeprovisionResult>;
  verifyDeprovisioned(externalUserId: string): Promise<boolean>;
}
```

**`USER_NOT_FOUND` → success-equivalent rule:** if the external user is already gone, the goal state is met. The QStash job-completion handler maps `failureKind === 'USER_NOT_FOUND'` to `step.status = 'SUCCEEDED'` (with an explanatory `lastErrorMessage = 'User already absent provider-side'`). Documented in saga-config.

**MAX_ATTEMPTS:** **3.** QStash native exponential backoff at 3 retries = ~6s + 12s + 24s = 42s of provider downtime tolerance. Phase 76 success criterion #5 ("revocation verifiable within 5 minutes") allows ~258s of headroom for clock-advance assertion. 3 attempts also matches `late-payment-interest.ts` line 536's `retries: 3`.

---

## QStash topology (D-03)

```
[tRPC mutation startDeprovisioningRun]
        |
        ↓ (single transaction)
   1. INSERT DeprovisioningRun (status=PENDING)
   2. INSERT N DeprovisioningStep rows (status=PENDING)
   3. UPDATE Run.status = IN_PROGRESS
        |
        ↓ (after txn commit)
   4. for each step: getQStashClient().publishJSON({
        url: `${APP_URL}/api/idp-deprovisioning/_step-runner`,
        body: { runId, stepId, organizationId, provider, stepKind, externalUserId },
        retries: 3,
        deduplicationId: `${runId}:${stepId}:${attempt}`,  // attempt=0 at saga-start
        timeout: '60s',
      })

[POST /api/idp-deprovisioning/_step-runner — QStash job handler]
        |
        ↓
   1. Verify QStash signature (existing pattern)
   2. INSERT IdpChangeProvenance row BEFORE adapter call (D-09)
   3. SELECT step row; if step.attempts >= MAX_ATTEMPTS → status=FAILED short-circuit
   4. UPDATE step.status=IN_PROGRESS, step.attempts++, step.qstashMessageId=msgId
   5. CALL adapter.suspendAccount(externalUserId) OR adapter.revokeAllSessions(externalUserId)
   6. UPDATE step with result (status, hashes, errorMessage)
   7. Emit getIdpAuditLogger() entry with full audit fields
   8. CALL recomputeRunStatus(runId) — single source-of-truth derivation
```

**No `Promise.allSettled` aggregation:** every step is an independent QStash job. The aggregate run status is computed by `recomputeRunStatus(runId)` after every step transition (called from the step handler in step 8). This is the architectural law per SC#8 / Pitfall 10.

**`recomputeRunStatus(runId)` rule** (lives in `@contractor-ops/idp-saga/src/run-status.ts`):
```ts
export type StepRow = { status: 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED'; attempts: number };
export type RunStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'PARTIAL_FAILURE' | 'FAILED';
export const MAX_ATTEMPTS = 3;

export function deriveRunStatus(steps: StepRow[]): RunStatus {
  if (steps.length === 0) return 'PENDING';
  const allSucceeded = steps.every(s => s.status === 'SUCCEEDED');
  const anyTerminalFailure = steps.some(s => s.status === 'FAILED' && s.attempts >= MAX_ATTEMPTS);
  const anySucceeded = steps.some(s => s.status === 'SUCCEEDED');
  const allTerminalFailure = steps.every(s => s.status === 'FAILED' && s.attempts >= MAX_ATTEMPTS);
  if (allSucceeded) return 'COMPLETED';
  if (allTerminalFailure) return 'FAILED';
  if (anyTerminalFailure && anySucceeded) return 'PARTIAL_FAILURE';
  return 'IN_PROGRESS';
}
```

Pure-function shape (Phase 70 D-14 pattern: pure-function-plus-CLI-entry). Trivially unit-testable; the `recomputeRunStatus(runId)` wrapper reads the rows + UPDATEs the run.

---

## Self-trigger filter (D-09..D-12) — webhook integration

**Hook point:** `packages/integrations/src/adapters/google-workspace-adapter.ts` `handleWebhook(payload, organizationId, connectionId)` — gains a top-of-method provenance lookup BEFORE any business logic. Phases 77+ replicate the same hook in Slack/Entra/Okta/GitHub adapters.

```ts
// packages/integrations/src/adapters/google-workspace-adapter.ts (D-11)
override async handleWebhook(payload, organizationId, connectionId) {
  // ... signature already verified by webhooks/[provider]/route.ts ...
  const event = parseGwsEvent(payload);
  if (event.type === 'user.suspended') {
    const matched = await provenanceLookup({
      organizationId,
      provider: 'GOOGLE_WORKSPACE',
      externalUserId: event.userId,
      actionKind: 'SUSPEND',
    });
    if (matched) {
      // D-09 — set matchedAt, suppress downstream notification
      return { suppressed: true, provenanceId: matched.id };
    }
  }
  // D-11 — non-matching: existing v3.0 user-departed notification path runs
  return super.handleWebhook(payload, organizationId, connectionId);
}
```

`provenanceLookup` lives in `@contractor-ops/idp-saga/src/provenance.ts` — pure DB query helper:

```sql
SELECT id FROM "IdpChangeProvenance"
WHERE provider = $1
  AND "externalUserId" = $2
  AND "actionKind" = $3
  AND "initiatedAt" > NOW() - INTERVAL '1 hour'
  AND "matchedAt" IS NULL
ORDER BY "initiatedAt" DESC
LIMIT 1;
-- On hit: UPDATE SET matchedAt = NOW() RETURNING id
```

Single query + atomic update via `updateMany({ where: { id, matchedAt: null }, data: { matchedAt: new Date() } })` returning `count > 0` — concurrent-webhook-safe (two webhooks for the same provenance row will only one-of them win the update; the loser does NOT get `suppressed: true` and thus delivers normally — this matches the framing of "default to delivery on non-match").

---

## GC job (D-12) — 90-day retention

`packages/idp-saga/src/gc.ts`:
```ts
export async function gcExpiredProvenance(db: PrismaClient, now = new Date()): Promise<{ deleted: number }> {
  const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const result = await db.idpChangeProvenance.deleteMany({
    where: { initiatedAt: { lt: cutoff } },
  });
  return { deleted: result.count };
}
```

**Schedule:** **daily at 03:00 UTC**, wired into the existing `apps/web/src/app/api/cron/reminders/route.ts` cron handler (a sibling cron entry in the same dispatcher — keep the cron count low; Phase 70 already added two crons here). `pino` log line emits `{ deleted: count }` per run. Idempotent — second run within an hour deletes 0 rows.

---

## Per-provider scope registry (D-14)

```ts
// packages/integrations/src/scopes/google-workspace-deprovision-scopes.ts
export const GOOGLE_WORKSPACE_DEPROVISION_SCOPES = [
  'https://www.googleapis.com/auth/admin.directory.user',  // suspendAccount + revokeAllSessions both need this
] as const;
export const GOOGLE_WORKSPACE_DEPROVISION_CAPABILITIES = ['user.deprovision', 'directory.user.write'] as const;
```

Phases 77-78 ship the parallel files for Slack / Entra / Okta / GitHub. Phase 76 ships ONLY the GWS file as the example + the typed-const **shape** that the lint:scopes guard enforces.

**GWS adapter wiring (Phase 76 SC#3):**
```ts
// packages/integrations/src/adapters/google-workspace-adapter.ts (line 56–58 region)
import { GOOGLE_WORKSPACE_DEPROVISION_SCOPES } from '../scopes/google-workspace-deprovision-scopes.js';

const baseScopes = [
  'https://www.googleapis.com/auth/admin.directory.user.readonly',
  'https://www.googleapis.com/auth/admin.directory.group.readonly',
] as const;

override getOAuthConfig(): OAuthConfig {
  return {
    // ...
    scopes: [...baseScopes, ...GOOGLE_WORKSPACE_DEPROVISION_SCOPES],  // additive — read-only still works
    extraAuthParams: { prompt: 'consent', access_type: 'offline' },   // SC#3: prompt=consent for re-OAuth
  };
}
```

**Critical:** the OLD readonly scopes are PRESERVED (additive). The OAuth callback writes both old + new capabilities into `scopeCapabilities.capabilities`. Existing v3.0 read-only directory-import continues working until the user re-OAuths. This is SC#3's "force global re-OAuth never occurs" guarantee.

---

## `lint:scopes` CI guard (D-15)

Lives in `packages/lint-guards/src/scopes-guard/`:

```
packages/lint-guards/src/scopes-guard/
├── run-guard.ts              # tsx entry — same shape as schema-guard/run-guard.ts
├── format-offence.ts         # structured-diff output (Phase 70 D-03 pattern)
└── (consumed by root scripts/lint-scopes.mjs)
```

**Algorithm:**
1. Walk `packages/integrations/src/adapters/*.ts` files.
2. For each adapter that implements `Deprovisionable` (heuristic: `implements Deprovisionable` in source — ts-morph parses the AST), find its `getOAuthConfig` return.
3. Statically extract every string literal in `scopes: [ ... ]` (concat across spread targets).
4. For each spread, resolve the imported `*_DEPROVISION_SCOPES` const.
5. Assert: every scope-string in the adapter appears in the union of (a) base read-only scopes already present, (b) the imported deprovision-scopes constant.
6. **Adding a scope literal directly into `getOAuthConfig().scopes` without putting it in the typed const → CI fails.**

Sibling of `lint-logs` (line-by-line) and `lint-schema` (model walk). Output uses the `format-offence.ts` structured-diff format already established by Phase 70 D-03.

**Wiring:**
- Root `package.json` adds: `"lint:scopes": "tsx scripts/lint-scopes.mjs"` (sibling to `lint:schema`, `lint:logs`, `i18n:parity`).
- Root `scripts/lint-scopes.mjs` is a thin shim that calls `import('@contractor-ops/lint-guards/src/scopes-guard/run-guard.js')` (mirrors `lint-schema.mjs`).
- `.husky/pre-push` line gains `&& pnpm run lint:scopes`.
- CI workflow `.github/workflows/*.yml` similarly extended (mirrors Phase 70 D-04 wiring).

---

## Per-provider integration-test stub (D-16) — GWS as example

Lives at `packages/integrations/src/adapters/__tests__/google-workspace-deprovision.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { GoogleWorkspaceAdapter } from '../google-workspace-adapter.js';

const server = setupServer();
beforeEach(() => server.resetHandlers());

describe('GoogleWorkspaceAdapter — Deprovisionable contract', () => {
  it('suspendAccount then verifyDeprovisioned → true within 5 min (mocked clock)', async () => {
    vi.useFakeTimers();
    server.use(
      http.post(/admin\.googleapis\.com\/admin\/directory\/v1\/users\/.+/, () =>
        HttpResponse.json({ primaryEmail: 'u@example.com', suspended: true }),
      ),
      http.get(/admin\.googleapis\.com\/admin\/directory\/v1\/users\/.+/, () =>
        HttpResponse.json({ primaryEmail: 'u@example.com', suspended: true }),
      ),
    );
    const adapter = new GoogleWorkspaceAdapter();
    const suspendResult = await adapter.suspendAccount('user-id-123');
    expect(suspendResult.status).toBe('SUCCEEDED');
    vi.advanceTimersByTime(5 * 60 * 1000);
    const verified = await adapter.verifyDeprovisioned('user-id-123');
    expect(verified).toBe(true);
    vi.useRealTimers();
  });
});
```

**Phases 77-78** copy this file structure for `slack-deprovision.test.ts`, `entra-deprovision.test.ts`, etc. Phase 76 ships ONLY the GWS file — establishing the template + the MSW + mock-clock pattern.

---

## Validation Architecture

> Phase 76 success criteria → automated verification commands

| Validates | Quick command | Latency | Frequency |
|---|---|---|---|
| Cooldown gate logic (SC#1, REQ-IDP-02) | `pnpm --filter @contractor-ops/idp-saga test cooldown` | <2s | Per-task commit |
| `recomputeRunStatus` derivation (SC#2 + SC#8, REQ-IDP-09 + IDP-10) | `pnpm --filter @contractor-ops/idp-saga test run-status` | <2s | Per-task commit |
| Manual-retry-per-step idempotency (SC#2, REQ-IDP-10) | `pnpm --filter @contractor-ops/api test deprovisioning-retry` | <5s | Per-task commit |
| Provenance match algorithm + suppression (SC#4, REQ-IDP-13) | `pnpm --filter @contractor-ops/idp-saga test provenance` | <3s | Per-task commit |
| GC job 90-day cutoff (D-12) | `pnpm --filter @contractor-ops/idp-saga test gc` | <2s | Per-task commit |
| Deprovisionable interface compile-time enforcement (SC#5, REQ-IDP-08) | `pnpm --filter @contractor-ops/integrations typecheck` | <8s | Per-PR CI + pre-push |
| GWS adapter Deprovisionable conformance (SC#5, REQ-IDP-08) | `pnpm --filter @contractor-ops/integrations test google-workspace-deprovision` | <3s | Per-task commit |
| `lint:scopes` CI guard (SC#6, REQ-IDP-14) | `pnpm lint:scopes` | <5s | Per-PR CI + pre-push |
| GWS scope-upgrade banner UI (SC#3, REQ-IDP-11) | `pnpm --filter @contractor-ops/web test google-workspace-reconnect-banner` | <3s | Per-task commit |
| `prompt=consent` write-access OAuth (SC#3, REQ-IDP-11) | `pnpm --filter @contractor-ops/api test deprovisioning-eligibility` (covers tRPC + scopeCapabilities branch) | <3s | Per-task commit |
| No "reactivate contractor" button anywhere (SC#7, REQ-IDP-15) | `pnpm --filter @contractor-ops/web test no-reactivate-button` (RTL spec asserting absence in profile + dashboard) | <2s | Per-task commit |
| Schema migration applies cleanly + `lint:schema` green (REQ-IDP-09 + IDP-10) | `pnpm --filter @contractor-ops/db db:generate && pnpm lint:schema` | <8s | Per-PR CI |
| Signoff registry has `idp-deprovisioning` PENDING entry | `pnpm --filter @contractor-ops/feature-flags test signoff-registry-flags-idp-entries` | <2s | Per-task commit |
| Webhook self-trigger end-to-end (SC#4, REQ-IDP-13) | `pnpm --filter @contractor-ops/integrations test google-workspace-webhook-provenance` | <5s | Per-PR CI |

**Wave 0 (Nyquist gate):** failing-test scaffolds for every row above land in Plan 76-01 BEFORE any production code. Each test starts RED and flips GREEN as later waves implement. The Wave 0 baseline:
- `packages/idp-saga/src/__tests__/cooldown.test.ts` — RED (helper not yet exported)
- `packages/idp-saga/src/__tests__/run-status.test.ts` — RED (`deriveRunStatus` not yet exported)
- `packages/idp-saga/src/__tests__/provenance.test.ts` — RED (`provenanceLookup` not yet exported)
- `packages/idp-saga/src/__tests__/gc.test.ts` — RED (`gcExpiredProvenance` not yet exported)
- `packages/integrations/src/__tests__/deprovisionable-contract.test.ts` — RED (interface not yet exported; typecheck fails by design)
- `packages/integrations/src/adapters/__tests__/google-workspace-deprovision.test.ts` — RED (`adapter.suspendAccount` not yet implemented)
- `packages/api/src/__tests__/deprovisioning-retry.test.ts` — RED (`retryDeprovisioningStep` mutation not yet exported)
- `packages/api/src/__tests__/deprovisioning-eligibility.test.ts` — RED
- `packages/feature-flags/src/__tests__/signoff-registry-flags-idp-entries.test.ts` — RED (no `idp-deprovisioning.*` entries yet)
- `apps/web/src/components/integrations/__tests__/google-workspace-reconnect-banner-write-access.test.tsx` — RED (write-access variant not yet implemented)
- `apps/web/src/__tests__/no-reactivate-button.test.tsx` — RED (asserting absence; passes only when grep across components confirms no `Reactivate` button label)
- `packages/lint-guards/src/scopes-guard/__tests__/run-guard.test.ts` — RED (guard not yet implemented)
- `packages/integrations/src/adapters/__tests__/google-workspace-webhook-provenance.test.ts` — RED (handleWebhook provenance lookup not yet wired)

**Sampling:**
- After every task commit: `pnpm --filter @contractor-ops/idp-saga test` (the saga package is the hot path — <5s).
- After every wave: full suite via `pnpm test` (<60s monorepo budget; saga + integrations + api + lint-guards + web slices).
- Before `/gsd-verify-work`: `pnpm test && pnpm lint:scopes && pnpm lint:schema && pnpm lint:logs && pnpm typecheck` — all green.

---

## Wave shape (planner has final say; this is the recommended grouping)

| Wave | Plan # | Concern | D-XX | autonomous |
|---|---|---|---|---|
| 0 | 76-01 | Failing-test scaffolds + new `@contractor-ops/idp-saga` package skeleton + signoff-registry PENDING entry | (Nyquist gate) | true |
| 1 | 76-02 | Prisma schema: 3 new tables + `ContractorAssignment.endedAt` + `idp-deprovisioning.prisma` file + multi-region migration runner usage docs | D-01 D-09 | **false** (multi-region apply per Plan 70-09 precedent) |
| 1 | 76-03 | `Deprovisionable` interface + per-provider scope-registry typed-const (GWS only — others Phases 77-78) + `IDP_AUDIT_ALLOWED_FIELDS` extension + `DeprovisionResult` types | D-13 D-14 | true |
| 1 | 76-04 | `cooldown.canStartDeprovisioning()` helper + `deriveRunStatus()` pure function + `provenanceLookup()` + `gcExpiredProvenance()` — all in new `@contractor-ops/idp-saga` package | D-02 D-05 D-06 D-08 D-10 D-12 | true |
| 1 | 76-05 | tRPC `deprovisioning` router: `getDeprovisioningEligibility` query + audit-log emission for cooldown decisions (no mutations yet) | D-05 D-07 | true |
| 2 | 76-06 | tRPC `startDeprovisioningRun` mutation + QStash fan-out + `_step-runner` API route + `recomputeRunStatus` integration + manual-retry mutation `retryDeprovisioningStep` | D-02 D-03 D-04 | true |
| 2 | 76-07 | `pnpm lint:scopes` CI guard: `packages/lint-guards/src/scopes-guard/` + root `scripts/lint-scopes.mjs` + husky pre-push + CI workflow + tests | D-15 | true |
| 2 | 76-08 | GWS write-access banner extension + `getOAuthConfig` capability-additive scopes + `prompt=consent` + OAuth callback writes `directory.user.write` capability | (SC#3) | true |
| 3 | 76-09 | GWS adapter `implements Deprovisionable`: `suspendAccount` + `revokeAllSessions` + `verifyDeprovisioned` shells (real GWS API calls in Phase 77; Phase 76 ships TYPED IMPLEMENTATIONS that satisfy the interface — they call the API but Phase 77 will swap the call shapes if needed) + GWS `handleWebhook` provenance lookup integration | D-13 (SC#4) | true |
| 3 | 76-10 | Per-provider integration-test template (D-16) using GWS as example + GC cron entry in reminders route + RTL spec for absence of "Reactivate contractor" button (SC#7) | D-12 D-16 (SC#7) | true |

**Total: 10 plans across 4 waves. One plan (76-02 schema) is `autonomous: false`.**

---

## Cross-phase coordination

- **Phase 70 (shipped):** `IntegrationConnection.scopeCapabilities`, `getIdpAuditLogger`, `signoff-registry-flags`, `lint-guards` topology, `BaseAdapter` — all directly consumed.
- **Phase 71 (planning in parallel):** Phase 76 D-06 reuses Phase 71 D-07's `@date-fns/tz` pin verbatim. Phase 71's `RESEARCH.md` line 23 is the source of truth. Phase 76 RESEARCH.md confirms the shared library.
- **Phase 74 (planned):** workflow `ACCESS_REVOKE` task hook will write `ContractorAssignment.endedAt`. Phase 76 ships the column + the consumer; Phase 74 wires the writer.
- **Phase 75 (planned):** F4 final-invoice-paid lifecycle. Cooldown gate's `endedAt` semantics align with whatever `assignment.endedAt` Phase 74-75 establishes; Phase 76's contract is "if `endedAt` is null, gate refuses" — forward-compatible.
- **Phase 77 (planned, builds on 76):** GWS + Slack adapters real implementations. Phase 76 ships the GWS adapter's `Deprovisionable` shells; Phase 77 may refine the GWS API call shapes against real-traffic experience.
- **Phase 78 (planned, builds on 76):** Entra + Okta + GitHub adapters. Phase 76 D-13 makes their pre-existing classes fail to compile until they implement `Deprovisionable` — the executor for Phase 78 will be forced to implement both methods.

---

## Validation Sign-Off

- [x] Every D-NN decision has a sibling pattern already in the codebase (no new architectural primitives).
- [x] Wave 0 RED-test scaffolds map 1:1 to the 8 ROADMAP success criteria (with one extra: signoff-registry entry).
- [x] Multi-region migration (Plan 76-02) is `autonomous: false` per Plan 70-09 precedent.
- [x] No new architectural primitives — all five `lint-guards` siblings, `signoff-registry` entries, audit-logger fields, scope-capabilities columns, QStash + recomputeRunStatus + cron-handler, RTL component tests reuse existing infrastructure.
- [x] Phase 71's date-with-TZ pin (`@date-fns/tz`) is the single source of truth — Phase 76 does not introduce a parallel library.

**Approval:** ready for planning 2026-04-27.
