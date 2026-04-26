# Phase 76 Patterns Map

> Analog files in the codebase that the planner/executor MUST mirror. Every new file in Phase 76 has at least one near-twin already shipped.

---

## D-01 — DeprovisioningRun + DeprovisioningStep Prisma schema

### NEW: `packages/db/prisma/schema/idp-deprovisioning.prisma`

**Closest analogs:**

1. `packages/db/prisma/schema/audit.prisma` — single-concern Prisma schema file (parent + indexes). Same one-file-per-domain conventions.
2. `packages/db/prisma/schema/integration.prisma` line 3–37 — `IntegrationConnection` parent with FKs to `Organization`. We mirror the multi-tenant pattern (`organizationId` on parent, child inherits via FK).
3. `packages/db/prisma/schema/classification.prisma` — parent assessment + multiple child rows; `ClassificationAssessment.ruleSetVersion` snapshot pattern. We mirror the parent/child split + the `@unique` constraint on `(parentId, kind)` shape.

**Pattern excerpt** (`packages/db/prisma/schema/integration.prisma` lines 3–37 — multi-tenant model with FKs):
```prisma
model IntegrationConnection {
  id                String              @id @default(cuid())
  organizationId    String
  provider          IntegrationProvider
  // ...
  organization      Organization        @relation(fields: [organizationId], references: [id])
  @@index([organizationId, provider])
}
```

**Apply to Phase 76 (Plan 76-02):**
```prisma
// packages/db/prisma/schema/idp-deprovisioning.prisma
model DeprovisioningRun {
  id                  String                  @id @default(cuid())
  organizationId      String
  contractorId        String
  assignmentId        String
  status              DeprovisioningRunStatus @default(PENDING)
  // ... (full shape in 76-RESEARCH.md)
  organization        Organization            @relation(fields: [organizationId], references: [id])
  contractor          Contractor              @relation(fields: [contractorId], references: [id])
  assignment          ContractorAssignment    @relation(fields: [assignmentId], references: [id])
  steps               DeprovisioningStep[]
  @@index([organizationId, status])
}
```

`Organization`, `Contractor`, `ContractorAssignment`, `User` parent models all gain inverse-relation declarations (Prisma rule). This is a multi-file edit — the relation has to be declared on both sides.

---

### Schema-lint compliance (Phase 70 lint:schema)

**Closest analog:** `scripts/lint-schema.mjs` + `packages/lint-guards/src/schema-guard/`. All multi-tenant models declare `organizationId String`. FK-scoped child models (e.g., `DeprovisioningStep` via `runId`) are covered by the lint guard's allow-list (Phase 70 D-04). `IdpChangeProvenance` is multi-tenant directly (declares `organizationId`).

---

## D-09 — IdpChangeProvenance Prisma model

### NEW: `IdpChangeProvenance` model in same `idp-deprovisioning.prisma` file

**Closest analogs:**

1. `packages/db/prisma/schema/audit.prisma` `AuditLog` — short-lived row + indexed-by-time pattern. We add the `(initiatedAt)` GC scan index in the same shape.
2. `packages/db/prisma/schema/notification.prisma` reminder rows — also short-lived + cron-GC'd (Phase 70 has reminder rows GC'd by daily cron).
3. `packages/db/prisma/schema/einvoice.prisma` deduplication keys — `@unique` on natural composite + index for lookup.

**Pattern excerpt** (audit-log idiom):
```prisma
@@index([organizationId, createdAt])
@@index([entityType, entityId, createdAt])
```

**Apply to Phase 76:**
```prisma
@@index([provider, externalUserId, actionKind, initiatedAt])  // D-10 lookup
@@index([initiatedAt])                                          // D-12 GC scan
```

---

## D-02 + D-04 — `recomputeRunStatus` + manual-retry transactional shape

### NEW: `packages/idp-saga/src/run-status.ts` + retry mutation

**Closest analogs:**

1. `packages/api/src/routers/classification.ts` lines 219–276 `recreateDraftAfterDrift` — v5 saga-state-management with idempotency precondition. The retry mutation MIRRORS this shape verbatim.
2. `packages/api/src/services/audit-writer.ts` `writeAuditLog` — single audit row per state-changing call. Retry emits one entry per click.
3. `packages/classification/src/snapshot.ts` `buildQuestionsSnapshot` — pure-function-plus-CLI-entry (Phase 70 D-14). `deriveRunStatus` follows the same shape: pure function, plus a thin async wrapper that does the read+update.

**Pattern excerpt** (`packages/api/src/routers/classification.ts` lines 219–276 abstracted):
```ts
.mutation(async ({ ctx, input }) => {
  const existing = await ctx.db.classificationAssessment.findUnique({ where: { id: input.id } });
  if (!existing || existing.status !== 'DRIFTED') {
    return { noop: true, reason: 'not in drifted state' };  // idempotent precondition
  }
  return await ctx.db.$transaction(async tx => {
    const draft = await tx.classificationAssessment.create({ /* ... */ });
    await tx.classificationAssessment.update({ where: { id: existing.id }, data: { /* ... */ } });
    return draft;
  });
});
```

**Apply to Phase 76 (Plan 76-06):**
```ts
// packages/api/src/routers/deprovisioning.ts — retryDeprovisioningStep
.mutation(async ({ ctx, input }) => {
  const step = await ctx.db.deprovisioningStep.findUnique({ where: { id: input.stepId } });
  if (!step || step.status !== 'FAILED') {
    return { noop: true, reason: 'step not in FAILED state' };  // idempotent precondition
  }
  await ctx.db.$transaction(async tx => {
    await tx.deprovisioningStep.update({
      where: { id: step.id, status: 'FAILED' },  // optimistic concurrency
      data: { status: 'PENDING', attempts: 0, lastErrorMessage: null },
    });
  });
  await getQStashClient().publishJSON({
    url: `${getServerEnv().NEXT_PUBLIC_APP_URL}/api/idp-deprovisioning/_step-runner`,
    body: { runId: step.runId, stepId: step.id, /* ... */ },
    deduplicationId: `${step.runId}:${step.id}:${nextAttempt}`,
    retries: 3,
  });
  getIdpAuditLogger().info(
    { auditEvent: 'deprovision_step_retried', runId: step.runId, stepId: step.id, /* ... */ },
    'Manual retry enqueued',
  );
  return { ok: true };
});
```

---

## D-03 — QStash fan-out

### NEW: `apps/web/src/app/api/idp-deprovisioning/_step-runner/route.ts`

**Closest analog:** `apps/web/src/app/api/late-interest/_render-claim-pdf/route.ts` — QStash signature verification + body parse + work execution + status update. Same shape we mirror.

**Pattern excerpt** (`packages/api/src/routers/late-payment-interest.ts` lines 529–544 — fan-out call):
```ts
await getQStashClient().publishJSON({
  url: `${getServerEnv().NEXT_PUBLIC_APP_URL}/api/late-interest/_render-claim-pdf`,
  body: { claimId: claim.id, organizationId: ctx.organizationId },
  retries: 3,
  timeout: '60s',
});
```

**Apply to Phase 76 (Plan 76-06):**
```ts
// packages/api/src/routers/deprovisioning.ts — startDeprovisioningRun fan-out
for (const step of run.steps) {
  await getQStashClient().publishJSON({
    url: `${getServerEnv().NEXT_PUBLIC_APP_URL}/api/idp-deprovisioning/_step-runner`,
    body: {
      runId: run.id, stepId: step.id, organizationId: ctx.organizationId,
      provider: step.provider, stepKind: step.stepKind, externalUserId: step.externalUserId,
    },
    retries: 3,
    timeout: '60s',
    deduplicationId: `${run.id}:${step.id}:0`,
  });
}
```

---

## D-05 + D-06 + D-08 — Cooldown gate

### NEW: `packages/idp-saga/src/cooldown.ts`

**Closest analogs:**

1. `packages/compliance-policy/src/expiry.ts` (Phase 71 D-07) — TZDate-based boundary computation. Same library, same boundary idiom (`startOfDay(new TZDate(...))`).
2. `packages/classification/src/profiles/ir35/profile.ts` `evaluate` — pure function returning `{ outcome, reason }`. Same shape: `canStartDeprovisioning` returns `{ allowed, earliestDate?, reason? }`.

**Pattern excerpt** (Phase 71 71-RESEARCH.md line 401):
```ts
export function isExpired(expiresAt: Date, expiryJurisdictionTz: string, now: Date = new Date()): boolean {
  const startOfToday = startOfDay(new TZDate(now, expiryJurisdictionTz));
  const expiryBoundary = startOfDay(new TZDate(expiresAt, expiryJurisdictionTz));
  // ...
}
```

**Apply to Phase 76 (Plan 76-04):** identical boundary idiom — see `76-RESEARCH.md` "TZ library convergence" section.

---

## D-05 + D-07 — Single-source-of-truth helper called from BOTH server + UI

### NEW: tRPC `getDeprovisioningEligibility` query

**Closest analog:** `packages/api/src/routers/classification.ts` `getDriftStatus` query — one helper, called by tRPC + UI. UI cannot lie about the gate state.

**Pattern excerpt:**
```ts
// query (read-only):
.query(async ({ ctx, input }) => {
  return getDriftStatus(ctx.db, input.assessmentId);
});
// mutation (write — same helper, same rule):
.mutation(async ({ ctx, input }) => {
  const drift = await getDriftStatus(ctx.db, input.assessmentId);
  if (!drift.driftDetected) throw new TRPCError({ code: 'BAD_REQUEST', message: drift.reason });
  // ...
});
```

**Apply to Phase 76 (Plans 76-05 + 76-06):**
```ts
// query — UI consumes for button-disabled + tooltip:
.query(async ({ ctx, input }) => {
  const assignment = await ctx.db.contractorAssignment.findUniqueOrThrow({ where: { id: input.assignmentId } });
  const contractor = await ctx.db.contractor.findUniqueOrThrow({ where: { id: assignment.contractorId } });
  return canStartDeprovisioning({
    endedAt: assignment.endedAt, jurisdictionTz: contractor.jurisdictionTz, status: assignment.status,
  });
});
// mutation — server-side authoritative gate:
.mutation(async ({ ctx, input }) => {
  const decision = canStartDeprovisioning({ /* ... same inputs ... */ });
  if (!decision.allowed) throw new TRPCError({ code: 'FORBIDDEN', message: decision.reason });
  // ... saga-start ...
});
```

---

## D-10 + D-11 — Provenance lookup atomic update

### NEW: `packages/idp-saga/src/provenance.ts`

**Closest analog:** `packages/api/src/services/audit-writer.ts` `writeAuditLog` — Prisma single-statement INSERT with no read-modify-write race.

**Concurrent-webhook-safe pattern** (proven in `packages/api/src/routers/classification.ts` `claimDraft`):
```ts
// Atomic update with WHERE — only one of N concurrent calls succeeds:
const result = await tx.someRow.updateMany({
  where: { id, claimedBy: null },
  data: { claimedBy: userId },
});
if (result.count === 0) return null;  // someone else won the race
```

**Apply to Phase 76 (Plan 76-04):**
```ts
export async function provenanceLookup(input): Promise<{ id: string } | null> {
  const candidate = await db.idpChangeProvenance.findFirst({
    where: {
      provider: input.provider, externalUserId: input.externalUserId,
      actionKind: input.actionKind, matchedAt: null,
      initiatedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
    orderBy: { initiatedAt: 'desc' },
  });
  if (!candidate) return null;
  const claimed = await db.idpChangeProvenance.updateMany({
    where: { id: candidate.id, matchedAt: null },
    data: { matchedAt: new Date() },
  });
  return claimed.count > 0 ? { id: candidate.id } : null;  // null on lost race → delivers
}
```

---

## D-12 — GC cron entry

### NEW: `packages/idp-saga/src/gc.ts` + cron wiring

**Closest analog:** `apps/web/src/app/api/cron/reminders/route.ts` — existing daily cron handler that already runs multiple sub-tasks (Phase 70 added reminder cleanup here). We add a new sub-task.

**Pattern excerpt** (existing cron dispatcher idiom — pseudocode for clarity):
```ts
// reminders/route.ts
export async function GET(req) {
  await processReminders();
  await cleanupOldReminderDeliveries();
  // Phase 76 adds:
  await gcExpiredProvenance(db);
  return NextResponse.json({ ok: true });
}
```

**Apply to Phase 76 (Plan 76-10):** add the call after existing reminder steps; structured pino log emission.

---

## D-13 — `Deprovisionable` interface + adapter mapping

### NEW: `packages/integrations/src/types/deprovisionable.ts` + adapter registry mapping

**Closest analogs:**

1. `packages/integrations/src/types/provider.ts` `IntegrationProviderAdapter` — sibling interface in the same `types/` directory. Same shape conventions.
2. `packages/integrations/src/registry.ts` `registerAdapter`/`getAdapter` — runtime adapter map. Phase 76 adds a separate typed `getDeprovisionableAdapter(provider)` lookup that returns a narrowed type.

**Pattern excerpt** (`packages/integrations/src/types/provider.ts` lines 17–20):
```ts
export interface OAuthConfig {
  scopes: string[];
  // ...
}
export interface IntegrationProviderAdapter {
  readonly slug: string;
  // ... optional methods: getOAuthConfig, exchangeCodeForTokens, ...
}
```

**Apply to Phase 76 (Plan 76-03):**
```ts
// packages/integrations/src/types/deprovisionable.ts
export interface Deprovisionable {
  suspendAccount(externalUserId: string): Promise<DeprovisionResult>;
  revokeAllSessions(externalUserId: string): Promise<DeprovisionResult>;
  verifyDeprovisioned(externalUserId: string): Promise<boolean>;
}
// packages/integrations/src/registry.ts (extend)
const deprovisionableAdapters = new Map<DeprovisioningProvider, BaseAdapter & Deprovisionable>();
export function registerDeprovisionableAdapter(provider: DeprovisioningProvider, adapter: BaseAdapter & Deprovisionable) {
  deprovisionableAdapters.set(provider, adapter);  // compile-time enforcement: T must implement Deprovisionable
}
export function getDeprovisionableAdapter(provider: DeprovisioningProvider): BaseAdapter & Deprovisionable {
  const a = deprovisionableAdapters.get(provider);
  if (!a) throw new Error(`No Deprovisionable adapter registered for ${provider}`);
  return a;
}
```

`registerDeprovisionableAdapter` is the compile-time gate — TypeScript rejects passing a non-`Deprovisionable` adapter at the call site, which is where Phase 78's Entra adapter (without `revokeAllSessions`) will fail to compile.

---

## D-14 — Per-provider scope-registry typed-const

### NEW: `packages/integrations/src/scopes/google-workspace-deprovision-scopes.ts`

**Closest analogs:**

1. `packages/feature-flags/src/registry.ts` (Phase 70 D-02) — `as const satisfies` typed const. Same export shape.
2. `packages/classification/src/profiles/ir35/profile.ts` typed-const profile. Same module-shape: file exports a single named const.
3. `packages/integrations/src/adapters/google-workspace-adapter.ts` lines 56–58 — current scope literal array. We extract these into the new typed const.

**Pattern excerpt** (`packages/feature-flags/src/registry.ts` `as const` idiom — abstracted):
```ts
export const FOO_FLAGS = ['foo.feature.alpha', 'foo.feature.beta'] as const;
export type FooFlag = typeof FOO_FLAGS[number];
```

**Apply to Phase 76 (Plan 76-03):**
```ts
// packages/integrations/src/scopes/google-workspace-deprovision-scopes.ts
export const GOOGLE_WORKSPACE_DEPROVISION_SCOPES = [
  'https://www.googleapis.com/auth/admin.directory.user',
] as const;

export const GOOGLE_WORKSPACE_DEPROVISION_CAPABILITIES = ['user.deprovision', 'directory.user.write'] as const;
```

GWS adapter (Plan 76-08) imports the constant and spreads it into its `getOAuthConfig().scopes` array. CI guard (Plan 76-07) parses both files and asserts equality.

---

## D-15 — `pnpm lint:scopes` CI guard

### NEW: `packages/lint-guards/src/scopes-guard/`

**Closest analogs (within the same package):**

1. `packages/lint-guards/src/schema-guard/run-guard.ts` + `format-offence.ts` — sibling guard, same `run-guard.ts` + `format-offence.ts` two-file split. Phase 76 mirrors the directory structure verbatim.
2. `packages/lint-guards/src/logs-guard/` — same shape; the lint logic is `ts-morph`-based AST walk over `apps/web/src/**/*.ts`.
3. `scripts/lint-schema.mjs` — root-level shim that imports from `@contractor-ops/lint-guards`. Phase 76 mirrors with `scripts/lint-scopes.mjs`.

**Pattern excerpt** (`packages/lint-guards/src/schema-guard/run-guard.ts` shape — pseudocode):
```ts
// run-guard.ts
import { Project } from 'ts-morph';
import { formatOffence } from './format-offence.js';

export function runScopesGuard(): { ok: boolean; offences: Offence[] } {
  const project = new Project({ tsConfigFilePath: 'tsconfig.base.json' });
  const adapterFiles = project.getSourceFiles('packages/integrations/src/adapters/*.ts');
  const offences: Offence[] = [];
  for (const file of adapterFiles) {
    // ... ts-morph AST walk: find class.implements('Deprovisionable'), find getOAuthConfig().scopes, ...
    // ... assert each scope literal traces to a typed-const in scopes/*.ts ...
  }
  return { ok: offences.length === 0, offences };
}

// scripts/lint-scopes.mjs (root)
const { runScopesGuard } = await import('@contractor-ops/lint-guards/dist/scopes-guard/run-guard.js');
const result = runScopesGuard();
if (!result.ok) {
  for (const o of result.offences) console.error(formatOffence(o));
  process.exit(1);
}
```

**Apply to Phase 76 (Plan 76-07):** identical shape. Output uses Phase 70 D-03's structured-diff format. Sibling of three existing guards. **Reuses the existing `@contractor-ops/lint-guards` package — does NOT create a new one** (per CONTEXT.md operating rules).

---

## D-16 — Per-provider integration-test stub template

### NEW: `packages/integrations/src/adapters/__tests__/google-workspace-deprovision.test.ts`

**Closest analogs:**

1. `packages/integrations/src/adapters/__tests__/` — existing per-adapter test directory. Same MSW + vitest infrastructure.
2. `packages/test-utils/src/msw/handlers/qstash.ts` — existing MSW QStash handlers. Phase 76 reuses for D-16's QStash interaction tests.
3. `packages/test-utils/src/msw/scenarios/partial-failure.ts` — existing MSW scenario. Phase 76 reuses for SC#2 PARTIAL_FAILURE assertions.

**Pattern excerpt** (typical adapter test shape — abstracted):
```ts
import { describe, it, expect } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const server = setupServer();
beforeEach(() => server.resetHandlers());

describe('SomeAdapter', () => {
  it('does X when API returns Y', async () => {
    server.use(http.get('https://api.example.com/x', () => HttpResponse.json({ y: true })));
    const result = await adapter.doX();
    expect(result).toBeTruthy();
  });
});
```

**Apply to Phase 76 (Plan 76-10):** see `76-RESEARCH.md` "Per-provider integration-test stub" section for the full template body. Includes mock-clock advance + verifyDeprovisioned assertion.

---

## SC#3 — GWS write-access banner extension

### MODIFY: `apps/web/src/components/integrations/google-workspace-reconnect-banner.tsx`

**Closest analog:** the banner already exists from Phase 70 D-16 (lines 22, 49 of `google-workspace-provider-section.tsx`). The Phase 70 banner shows when `scopeCapabilities` lacks `user.deprovision`.

**Phase 76 extension shape:**
```tsx
// banner has THREE display states (current = 2):
// 1. Hidden — `scopeCapabilities` is null OR contains 'user.deprovision' AND 'directory.user.write'
// 2. "Reconnect required" — capabilities present but lacks 'user.deprovision' (Phase 70 — UNCHANGED)
// 3. "Re-OAuth required for write access" — capabilities present, has 'user.deprovision' from old enum,
//    but lacks 'directory.user.write' (Phase 76 NEW)
//
// On click of state-3 button: same OAuth start endpoint with `prompt=consent` query param;
// callback handler writes `directory.user.write` capability to scopeCapabilities JSONB.
```

**i18n strings** added to `apps/web/messages/{en,de,pl,ar}.json`:
```json
{
  "integrations.gws.banner.writeAccessRequired.title": "...",
  "integrations.gws.banner.writeAccessRequired.description": "...",
  "integrations.gws.banner.writeAccessRequired.cta": "..."
}
```

i18n parity guard (Phase 70 D-04) enforces all four locales contain the keys.

---

## SC#7 — No "Reactivate contractor" button (RTL absence test)

### NEW: `apps/web/src/__tests__/no-reactivate-button.test.tsx`

**Closest analog:** `apps/web/src/components/contractors/__tests__/contractor-table.test.tsx` — RTL render test against the contractor profile pages.

**Pattern excerpt** — RTL absence assertion idiom:
```tsx
const { queryByText } = render(<ContractorProfile contractorId="c-1" />);
expect(queryByText(/reactivate/i)).toBeNull();
expect(queryByText(/re-activate/i)).toBeNull();
```

**Apply to Phase 76 (Plan 76-10):** RTL render of the contractor profile pages and dashboard widgets, asserting the labels never render. Backed by a separate static-grep test:
```ts
// apps/web/src/__tests__/no-reactivate-button.test.tsx (companion check)
import { execSync } from 'node:child_process';
it('grep confirms no Reactivate button label across components', () => {
  const grep = execSync('grep -rIE "Reactivate|Re-?activate.*contractor|reactivate.*contractor" apps/web/src apps/web/messages || true').toString();
  expect(grep.trim()).toBe('');
});
```

The grep test is a belt-and-braces second layer; the primary RTL test asserts at component-render level.

---

## Signoff registry — `idp-deprovisioning` PENDING entry

### MODIFY: `packages/feature-flags/src/signoff-registry-flags.json`

**Closest analog:** Phase 71 D-04 (per `71-RESEARCH.md`) adds 12 PENDING entries for `compliance-policy-engine.<jurisdiction>.<doc>` keys. Phase 76 adds ONE entry: `idp-deprovisioning`.

**Pattern excerpt** (the signoff-registry JSON shape — Phase 70 wired this empty):
```json
{
  "idp-deprovisioning": {
    "status": "PENDING",
    "notes": "F2 IdP deprovisioning rollout — flip to APPROVED post-deploy after legal review of cooldown semantics + cross-border data-handling implications of suspendAccount + revokeAllSessions"
  }
}
```

The Zod schema (`signoff-registry-flags-schema.ts`) accepts `PENDING` with no other required fields. Phase 70's `GATED_FLAG_NAMESPACE_PREFIXES` array already includes `'idp-deprovisioning'` — the JSON entry's presence is the boot-time requirement.

**Test (Plan 76-01 Wave 0 — RED initially, GREEN once entry lands):**
```ts
// packages/feature-flags/src/__tests__/signoff-registry-flags-idp-entries.test.ts
import { describe, it, expect } from 'vitest';
import { getFlagSignoff } from '../signoff-registry-flags.js';
describe('idp-deprovisioning signoff entry (Phase 76)', () => {
  it('has a registry entry (PENDING or APPROVED)', () => {
    const entry = getFlagSignoff('idp-deprovisioning');
    expect(entry).toBeDefined();
    expect(entry?.status).toMatch(/^(PENDING|APPROVED)$/);
  });
});
```

---

## `IDP_AUDIT_ALLOWED_FIELDS` extension

### MODIFY: `packages/logger/src/idp-audit-logger.ts`

**Closest analog:** the file itself (Phase 70 D-15). The allow-list is an exported `as const` array; extending it is additive.

**Apply to Phase 76 (Plan 76-03):**
```ts
// packages/logger/src/idp-audit-logger.ts
export const IDP_AUDIT_ALLOWED_FIELDS = [
  'auditEvent', 'externalUserId', 'actionResult', 'provider', 'connectionId',
  'scopeDelta', 'organizationId', 'userId', 'timestamp',
  // Phase 76 additions (D-15 / SC#2 audit grade):
  'runId', 'stepId', 'stepKind', 'requestSha256', 'responseSha256',
  'attempts', 'failureKind', 'matchedProvenanceId',
] as const;
```

Test (Plan 76-01 Wave 0 — verifies the new fields appear in the array):
```ts
// packages/logger/src/__tests__/idp-audit-logger-fields.test.ts
import { IDP_AUDIT_ALLOWED_FIELDS } from '../idp-audit-logger.js';
it('includes Phase 76 saga audit fields', () => {
  for (const f of ['runId', 'stepId', 'requestSha256', 'responseSha256', 'attempts'] as const) {
    expect(IDP_AUDIT_ALLOWED_FIELDS).toContain(f);
  }
});
```

---

## NEW: `@contractor-ops/idp-saga` workspace package skeleton

**Closest analogs:**

1. `packages/feature-flags/` — same ESM + vitest layout. Tree shape matches.
2. `packages/compliance-policy/` (Phase 71, planning in parallel) — also new ESM workspace package. Phase 76 mirrors its `package.json`/`tsconfig.json`/`vitest.config.ts` siblings verbatim.
3. `packages/lint-guards/` — also new in Phase 70. Same pattern: ts-morph + vitest.

**Apply to Phase 76 (Plan 76-01):**
```
packages/idp-saga/
├── package.json                    # @contractor-ops/idp-saga, ESM, vitest, deps: date-fns@^4.1.0, @date-fns/tz, @contractor-ops/db (peer)
├── tsconfig.json                   # extends tsconfig.base.json
├── vitest.config.ts
├── src/
│   ├── index.ts                    # public surface — re-exports cooldown, run-status, provenance, gc
│   ├── cooldown.ts                 # canStartDeprovisioning + COOLDOWN_DAYS const
│   ├── run-status.ts               # deriveRunStatus + MAX_ATTEMPTS const + recomputeRunStatus(db, runId) wrapper
│   ├── provenance.ts               # provenanceLookup + insertProvenance helpers
│   ├── gc.ts                       # gcExpiredProvenance(db, now)
│   ├── types.ts                    # CooldownDecision, RunStatus, StepRow, ProvenanceLookupInput types
│   └── __tests__/
│       ├── cooldown.test.ts
│       ├── run-status.test.ts
│       ├── provenance.test.ts
│       └── gc.test.ts
```

`pnpm-workspace.yaml` glob `packages/*` already covers this (verified by Phase 70's `lint-guards` addition).

---

## Multi-region migration runner reuse

### Plan 76-02 — schema migration

**Closest analog:** Plan 70-09 — same shape. `autonomous: false` flag. Manual run via `packages/db/scripts/push-all-regions.ts` against EU + ME databases.

**Pattern excerpt** (Plan 70-09 SUMMARY):
```
- `npx tsx packages/db/scripts/push-all-regions.ts` — applies schema to DATABASE_URL_EU + DATABASE_URL_ME
- Manual review of generated SQL before run (LOCAL-ONLY constraint)
- Idempotent (Prisma db push detects no-op)
```

**Apply to Phase 76 (Plan 76-02):** same wording verbatim in the plan's `<verification>` block.

---

## Pattern coverage check

| Phase 76 element | Closest analog | Confidence |
|---|---|---|
| DeprovisioningRun + Step Prisma | `integration.prisma` + `classification.prisma` | HIGH |
| IdpChangeProvenance Prisma | `audit.prisma` (short-lived + GC indexed) | HIGH |
| `recomputeRunStatus` pure function | Phase 70 D-14 (pure-function-plus-CLI) | HIGH |
| Manual-retry mutation transactional | `recreateDraftAfterDrift` (v5 saga) | HIGH |
| QStash fan-out | `late-payment-interest.ts` line 533 | HIGH |
| Cooldown TZ boundary | Phase 71 D-07 (`@date-fns/tz`) | HIGH |
| Single-source-of-truth helper (server + UI) | Classification `getDriftStatus` | HIGH |
| Provenance lookup atomic | Classification `claimDraft` | HIGH |
| GC cron entry | Existing reminders/route.ts | HIGH |
| `Deprovisionable` interface | `IntegrationProviderAdapter` sibling | HIGH |
| Per-provider scope const | Phase 70 D-02 typed-const + Phase 71 D-01 | HIGH |
| `lint:scopes` guard | Phase 70 D-04 three-guard topology | HIGH |
| MSW + mock-clock test stub | Existing `__tests__/` + `test-utils/msw` | HIGH |
| Banner write-access variant | Phase 70 D-16 banner | HIGH |
| Signoff registry entry | Phase 70 D-09..12 + Phase 71 D-04 sibling | HIGH |
| Audit-fields extension | Phase 70 D-15 allow-list array | HIGH |
| `idp-saga` package skeleton | `feature-flags`, `compliance-policy`, `lint-guards` | HIGH |
| Multi-region migration | Plan 70-09 verbatim | HIGH |

**No new architectural primitives. All eighteen Phase 76 elements have a sibling pattern already shipped.**
