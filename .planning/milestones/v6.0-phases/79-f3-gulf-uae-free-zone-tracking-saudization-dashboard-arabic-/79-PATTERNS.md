# Phase 79: F3 Gulf — UAE Free-Zone Tracking + Saudization Dashboard + Arabic + RTL - Pattern Map

**Mapped:** 2026-06-03
**Files analyzed:** 19 new / 7 modified
**Analogs found:** 24 / 26 (2 net-new with template-only analogs)

> Read-only mapping. Every excerpt below is copied from a live in-tree file with path + line numbers so the planner can reference the exact analog in each plan's action section. No source was modified.

---

## File Classification

### NEW files

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `packages/db/prisma/schema/gulf.prisma` | model (Prisma) | CRUD | `packages/db/prisma/schema/contractor.prisma` (`ContractorComplianceItem`, `ContractorAssignment`, enums) | exact |
| `packages/db/scripts/lint-region-leakage.ts` | utility (tsx CI script) | transform/batch | `packages/db/scripts/audit-enum-casing.ts` | role-match (net-new assertion) |
| `packages/api/src/services/free-zone-compliance.ts` | service | event-driven (write/supersede item) | `packages/api/src/services/compliance-supersession.ts` | exact (structural client + materialise) |
| `packages/api/src/services/saudization-dashboard.ts` | service | transform/derivation | `computeComplianceHealth` (`packages/api/src/routers/core/contractor.ts:56`) | role-match (derivation) |
| `packages/api/src/services/permitted-activity-check.ts` | service | event-driven (contract-create hook) | `compliance-supersession.ts` `materialiseFromPolicy` (item create) | role-match |
| `packages/api/src/routers/gulf/free-zone.ts` | router | CRUD / request-response | `packages/api/src/routers/compliance/zatca.ts` + `contractor.ts` country-fields procs | exact |
| `packages/api/src/routers/gulf/saudization.ts` | router | CRUD + read-model | `zatca.ts` (tenantProcedure + permission) + `contractor.ts` `updateCountryFields` | exact |
| `packages/api/src/routers/gulf/index.ts` | route (namespace barrel) | — | `packages/api/src/routers/finance/index.ts` barrel + `root.ts` mount | exact |
| `packages/compliance-policy/src/policies/uae.ts` (rule bump) | config (policy rule) | event-driven | existing `uae.free_zone_license@v1` in same file | exact (in-place) |
| `packages/validators/src/legal/ae.ts` | config (locked phrases) | — | `packages/validators/src/legal/gb.ts` | exact |
| `packages/validators/src/legal/sa.ts` | config (locked phrases) | — | `packages/validators/src/legal/gb.ts` | exact |
| `apps/web-vite/src/components/saudization/saudization-dashboard-container.tsx` | container | request-response | `apps/web-vite/.../settings/expiry-reminder-defaults-container.tsx` | exact |
| `apps/web-vite/src/components/saudization/hooks/use-saudization-dashboard.ts` | hook | request-response (read) | `apps/web-vite/.../dashboard/hooks/use-tax-obligations-widget.ts` | exact |
| `apps/web-vite/src/components/saudization/hooks/use-saudization-config.ts` | hook | CRUD (mutation) | `apps/web-vite/.../settings/hooks/use-expiry-reminder-defaults.ts` | exact |
| `apps/web-vite/src/components/saudization/saudization-dashboard.tsx` | component | presentational | `country-compliance-section.tsx` view + `use-rtl-chart-config.ts` for charts | role-match |
| `apps/web-vite/src/components/contractors/free-zone/free-zone-assignment-form.tsx` | component | presentational | `country-compliance-section.tsx` (view + field render) | exact |
| `apps/web-vite/src/components/contractors/free-zone/free-zone-assignment-container.tsx` | container | request-response | `country-compliance-section-container.tsx` | exact |
| `apps/web-vite/src/components/contractors/free-zone/hooks/use-free-zone-assignment.ts` | hook | CRUD | `use-expiry-reminder-defaults.ts` | exact |
| `apps/web-vite/src/components/contractors/free-zone/scope-mismatch-banner.tsx` | component | presentational | `alert` primitive (UI-SPEC) + advisory copy | partial |

### MODIFIED files

| Modified File | Change | Reference |
|---------------|--------|-----------|
| `packages/db/prisma/schema/contractor.prisma` | + 3 nullable cols on `ContractorAssignment` (`isSaudi`, `nationality`, `qiwaContractAuthenticated`) | RESEARCH GULF-04; model at line 160 |
| `packages/compliance-policy/src/policies/uae.ts` | bump `free_zone_license@v1` WARNING → `@v2` BLOCKING + narrow `appliesIf` | D-03/D-04 |
| `packages/api/src/services/compliance-reminder-scan.ts` | thread regional client (remove `prismaRaw` close-over) | Pitfall 18 |
| `packages/api/src/routers/core/contractor.ts` | hide AE freeform fields after D-02 migration (drop AE from `getCountryFieldsConfig` field list) | D-02; lines 1312-1325 |
| `apps/web-vite/.../contractors/country-compliance-section.tsx` | hide old UAE freeform inputs (`freeZone`/`tradeLicense*`) | D-02 |
| `packages/api/src/root.ts` | mount `gulf:` namespace | line 149 `appRouter = router({...})` |
| `packages/validators/src/index.ts` | export `LOCKED_AE_PHRASES`/`LOCKED_SA_PHRASES` + reserved keys + types | lines 361-369 (gb.ts export block) |
| `packages/feature-flags/src/registry.ts` + `signoff-registry.json` | Gulf flags PENDING | D-09 Phase 70 pattern |

---

## Pattern Assignments

### `packages/db/prisma/schema/gulf.prisma` (model, CRUD)

**Analog:** `packages/db/prisma/schema/contractor.prisma`

**Model shape pattern** (`ContractorComplianceItem`, lines 237-271) — copy the cuid id + `organizationId` first field + `@@index([organizationId, ...])` convention; every tenant-scoped model leads with `organizationId` and indexes it:
```prisma
model ContractorComplianceItem {
  id                    String                @id @default(cuid())
  organizationId        String
  contractorId          String
  // ...
  createdAt             DateTime              @default(now())
  updatedAt             DateTime              @updatedAt
  organization Organization @relation(fields: [organizationId], references: [id])
  contractor   Contractor   @relation(fields: [contractorId], references: [id])
  @@index([organizationId])
  @@index([organizationId, contractorId, status])
  @@index([organizationId, expiresAt])
}
```

**Enum convention** (lines 333-373) — ALL values `UPPER_SNAKE_CASE` (enforced by `db:audit-enum-casing`). Severity is the tri-tier; DO NOT add `CRITICAL`:
```prisma
enum Severity {
  BLOCKING
  WARNING
  INFO
}
```

**New enums to add** (values UPPER_SNAKE per RESEARCH GULF-04, lines 434-438):
```prisma
enum NitaqatBand { PLATINUM HIGH_GREEN MID_GREEN LOW_GREEN YELLOW RED }
enum UaeFreeZoneCode { DIFC DMCC IFZA DUBAI_INTERNET_CITY DUBAI_MEDIA_CITY
                       MEYDAN_FZ JAFZA SHAMS RAKEZ ADGM MAINLAND }
```

**ME-region annotation (GULF-11):** Prisma has NO `@region` attribute (Pitfall 19). The 4 new models get a **doc-comment** declaring ME-region intent (precedent: `regional-storage.ts REGION_BUCKET_MAP` comments). "Region" is a runtime routing concern only — the same schema deploys to BOTH EU+ME physical DBs.

**`ContractorAssignment` column add** (modify in-place, model at line 160; copy the additive-nullable convention used by Phase 76's `endedAt DateTime?` at line 175):
```prisma
isSaudi                   Boolean? // GULF-04 — per-engagement nationality flag
nationality               String?  // ISO-3166-1 alpha-2
qiwaContractAuthenticated Boolean? @default(false) // 2026-04-15 Qiwa requirement
```

---

### `packages/compliance-policy/src/policies/uae.ts` (config, policy-rule bump)

**Analog:** the existing `uae.free_zone_license@v1` registration in the **same file** (lines 25-37).

**Existing registration to edit** (lines 25-37):
```typescript
registerPolicyRule({
  policyRuleId: 'uae.free_zone_license@v1',   // → bump to @v2
  jurisdiction: 'UAE',
  documentType: 'UAE_FREE_ZONE_LICENSE',
  displayName: 'UAE Free-Zone Trade License',
  severity: 'WARNING',                         // → BLOCKING (D-03)
  expiryJurisdictionTz: 'Asia/Dubai',
  appliesIf: () => true,                       // → narrow / false (see Pitfall 2)
  draftLegalText: '... (PENDING legal review)',
  expirySemantic: 'fixed_months',
  expiryMonths: 12,
});
```

**Critical (Pitfall 2):** `EngagementContext` has no `zone` field and the classification path drives `resolvePolicyRules`/`supersedeAndMaterialise`. RESEARCH recommends keeping `appliesIf: () => false` (or conservative) on `@v2` so the classification path NEVER materialises free-zone — the row is written out-of-band from the FreeZoneAssignment service (see `free-zone-compliance.ts` below). `parsePolicyRuleId` regex `/^[a-z]+\.[a-z][a-z_0-9]*@v\d+$/` accepts `@v2`. Bump `POLICY_RULE_SET_VERSION`.

---

### `packages/api/src/services/free-zone-compliance.ts` (service, event-driven)

**Analog:** `packages/api/src/services/compliance-supersession.ts`

**Structural-client pattern** (lines 50-57) — accept a `tx`-or-`ctx.db` client so it composes inside/outside a transaction; mirror `audit-writer.ts`:
```typescript
export interface SupersessionClient {
  contractorComplianceItem: {
    findMany: (args: Prisma.ContractorComplianceItemFindManyArgs) => Promise<unknown>;
    updateMany: (args: Prisma.ContractorComplianceItemUpdateManyArgs) => Promise<unknown>;
    create: (args: Prisma.ContractorComplianceItemCreateArgs) => Promise<unknown>;
  };
}
```

**Item-create shape** (the columns the cron + gate select on — derived from `compliance-reminder-scan.ts:125-142` + `materialiseFromPolicy` lines 84-99):
```typescript
await client.contractorComplianceItem.create({
  data: {
    organizationId, contractorId, contractId: null,
    documentType: 'UAE_FREE_ZONE_LICENSE',
    name: 'UAE Free-Zone Trade License',
    severity: 'BLOCKING',
    policyRuleId: 'uae.free_zone_license@v2',
    expiryJurisdictionTz: 'Asia/Dubai',
    expiresAt: freeZoneAssignment.licenseExpiresAt, // @db.Date — drives cascade band math
    status: 'PENDING',                              // cron flips → EXPIRED
  },
});
```

**D-04 gate:** the service guards the write on `zone !== 'MAINLAND'` (the narrowing lives HERE, not in `appliesIf`). Mainland writes no item, arms no gate.

**Supersession exclusion (Pitfall 2):** if free-zone rows are written out-of-band, exclude them from `supersedeAndMaterialise`'s WAIVE scope — filter the `findMany` (lines 117-119) by `policyRuleId NOT LIKE 'uae.free_zone%'` OR include free-zone in `resolvePolicyRules`. MUST be tested.

---

### `packages/api/src/services/compliance-reminder-scan.ts` (MODIFY — region fan-out)

**Analog:** `packages/api/src/routers/finance/exchange-rate.ts` `fetchDaily` (lines 24-39)

**The cron is EU-only today** — `runComplianceReminderScan` closes over module-level `prismaRaw` (= `DATABASE_URL` = EU). The scan query (lines 125-142) and `processItem`/`persistBandFire`/`dispatchDigest` all use `prismaRaw`. ME free-zone/Iqama items are invisible (Pitfall 18).

**Fan-out template** (`exchange-rate.ts:27-37`):
```typescript
import { getRegionalClient, SUPPORTED_REGIONS } from '@contractor-ops/db';
for (const region of SUPPORTED_REGIONS) {
  try {
    const r = await fetchAndStoreRates(getRegionalClient(region));
    // accumulate
  } catch (err) {
    errors.push(`[${region}] ${err instanceof Error ? err.message : String(err)}`);
  }
}
```

**Refactor:** thread the regional client into `runComplianceReminderScan(client, now)` (replace every `prismaRaw` with the param), then loop `SUPPORTED_REGIONS` calling `getRegionalClient(region)`. `preWarmRegionalClients`-style graceful skip on unconfigured regions (`region.ts:69-77`). Confirm `claimCronNotificationDedup` keys don't collide cross-region (prefix with region if shared).

---

### `packages/api/src/routers/gulf/free-zone.ts` + `saudization.ts` (router, CRUD + read-model)

**Analog:** `packages/api/src/routers/compliance/zatca.ts` (tenantProcedure + permission) + `contractor.ts` country-fields procs.

**tenantProcedure + permission + Zod** (`zatca.ts:36-42`):
```typescript
export const zatcaRouter = router({
  saveTaxDetails: tenantProcedure
    .use(requirePermission({ settings: ['update'] }))
    .input(z.object({ taxDetails: zatcaTaxDetailsSchema }))
    .mutation(async ({ ctx, input }) => {
      await saveTaxDetails(ctx.organizationId, input.taxDetails);
      return { success: true };
    }),
});
```

**Region-aware read — `ctx.db` is ALREADY region-aware** (RESEARCH lines 401-407; tenant middleware resolves `org.dataRegion` → `getRegionalClient`). Gulf routers just use `ctx.db`; ME orgs transparently hit the ME DB. Do NOT use `prisma`/`prismaRaw` for the 4 new models (Pitfall 19):
```typescript
getFreeZoneAssignment: tenantProcedure
  .input(z.object({ contractorId: z.string() }))
  .query(async ({ ctx, input }) =>
    ctx.db.freeZoneAssignment.findUnique({ where: { contractorId: input.contractorId } }));
```

**Validation + safeParse pattern for writes** (`contractor.ts updateCountryFields`, lines 1340-1375) — Zod schema map, `safeParse`, `BAD_REQUEST` on failure, then tenant-scoped `ctx.db.*.update({ where: { id, organizationId: ctx.organizationId } })`.

**Audit-logged mutations (D-17)** — see Shared Patterns. Band edits, headcount edits, GULF-10 overrides, free-zone migration writes all call `writeAuditLog` with `tx`.

**Namespace mount** (`root.ts:149` + `163`/`209`): add `gulf: gulfRouter` to `appRouter = router({...})`; barrel-export from `packages/api/src/routers/gulf/index.ts` mirroring `finance/index.ts`.

---

### `packages/api/src/services/saudization-dashboard.ts` (service, derivation)

**Analog:** `computeComplianceHealth` (`packages/api/src/routers/core/contractor.ts:56-125`)

**Derivation-function pattern** (pure function, typed param object, returns a structured result; lines 56-88):
```typescript
function computeComplianceHealth(params: {
  complianceItems: Array<{ status: string; expiresAt: Date | null }>;
  activeContractCount: number;
  // ...
}): ComplianceHealthResult {
  const factors: HealthFactor[] = [];
  // derive flags from inputs, push structured factor objects
  return { factors, ... };
}
```

**Saudization rules:** rate computed from MANUAL `SaudiHeadcount` numbers ONLY (D-10/Pitfall 7) — never from platform contractors. Platform-derived contractor breakdown returned side-by-side for sanity-check (subordinate). Band is NEVER computed (Pitfall 8). Qiwa gap = count of `qiwaContractAuthenticated = false` (D-11). Iqama roll-up reuses `ContractorComplianceItem` (`ksa.iqama`) expiry data.

---

### `packages/validators/src/legal/ae.ts` + `sa.ts` (config, locked phrases)

**Analog:** `packages/validators/src/legal/gb.ts`

**Exact file shape** (gb.ts lines 15-47) — `export const` literals `as const`, a `RESERVED_*_LEGAL_KEYS` array, a `LOCKED_*_PHRASES` record, a `Locked*PhraseKey` type:
```typescript
export const DMCC_AUTHORITY_LEGAL_NAME = 'Dubai Multi Commodities Centre Authority' as const;
export const NITAQAT_BAND_PLATINUM = 'PLATINUM' as const;
// ... (PENDING legal review per Standing Constraint)

export const RESERVED_AE_LEGAL_KEYS = ['DMCC_AUTHORITY_LEGAL_NAME', /* ... */] as const;
export const LOCKED_AE_PHRASES = { DMCC_AUTHORITY_LEGAL_NAME, /* ... */ } as const;
export type LockedAePhraseKey = keyof typeof LOCKED_AE_PHRASES;
```

**Index export** (`validators/src/index.ts:361-369` — copy the gb.ts block exactly): export type `LockedAePhraseKey`, then `{ LOCKED_AE_PHRASES, RESERVED_AE_LEGAL_KEYS, ...individual consts }` from `./legal/ae.js`.

**Guard extension** (`__tests__/locked-phrases-guard.test.ts:65-70`) — add `RESERVED_AE_LEGAL_KEYS`/`RESERVED_SA_LEGAL_KEYS` to the `reserved` spread so no locked key may appear in any `messages/*.json`. Also mirror the `RESERVED_*_KEYS === Object.keys(LOCKED_*_PHRASES)` assertion (line 142).

---

### web-vite surfaces — container / hook / presentational

**Architecture (binding, D-17):** Page → Container (`*-container.tsx`) → Hook (`hooks/use-*.ts` — ONLY `useTRPC`/`useQuery`/`useMutation` boundary) → presentational Component. Enforced by `check:web-vite-{data-layer,page-shells,presentational,table-pattern,dialog-pattern}`.

**Container analog** (`settings/expiry-reminder-defaults-container.tsx`, full file) — thin: call hook, spread into view, no tRPC:
```typescript
export function ExpiryReminderDefaultsContainer() {
  const defaults = useExpiryReminderDefaults();
  return <ExpiryReminderDefaults {...defaults} />;
}
```

**Read-only hook analog** (`dashboard/hooks/use-tax-obligations-widget.ts`, full file) — `useTRPC()` → `useQuery(trpc.X.queryOptions())`, return `{ isLoading, data }`:
```typescript
export function useSaudizationDashboard() {
  const trpc = useTRPC();
  const query = useQuery(trpc.gulf.saudizationDashboard.queryOptions());
  return { isLoading: query.isPending, data: query.data ?? null } as const;
}
```

**Mutation hook analog** (`settings/hooks/use-expiry-reminder-defaults.ts`, lines 38-64) — `useMutation(trpc.X.mutationOptions({ onSuccess → toast + invalidateQueries, onError → toast }))`, `useTranslations` for all copy, `useId` for a11y:
```typescript
const updateMutation = useMutation(
  trpc.settings.updateExpiryReminderDefaults.mutationOptions({
    onSuccess: () => {
      toast.success(t('expiryReminders.successToast'));
      queryClient.invalidateQueries({ queryKey: trpc.settings.getExpiryReminderDefaults.queryKey() });
    },
    onError: () => toast.error(tToast('reminderDefaultsFailed')),
  }),
);
```

**Presentational + form analog** (`country-compliance-section.tsx`, imports lines 3-27) — shadcn primitives from `@contractor-ops/ui/components/shadcn/*`, `useTranslations` for ALL copy, `useId`/`useMemo`/`useCallback`, country-conditional render `{(countryCode === 'GB' || 'DE') && (...)}`. D-02: hide the UAE freeform `freeZone`/`tradeLicense*` block here.

**RTL charts** (`use-rtl-chart-config.ts`, full file) — wrap Recharts with `useRtlChartConfig()` (`xAxisProps reversed`, `yAxisProps orientation:right`, `chartStyle direction:rtl`); `isRtl(locale === 'ar')`. No new RTL machinery (D-13).

**RTL discipline (GULF-08):** logical props only (`ms-`/`me-`/`ps-`/`pe-`/`start-`/`end-`) — never `ml-`/`mr-`/`pl-`/`pr-`. The `ml-`/`mr-` ban guard could NOT be located (Pitfall 20) — planner must verify-or-build it.

---

### `packages/db/scripts/lint-region-leakage.ts` (utility, net-new CI script)

**Analog (template only):** `packages/db/scripts/audit-enum-casing.ts`

**tsx-script structure** (audit-enum-casing.ts lines 1-30, 76-93) — `#!/usr/bin/env tsx`, `readdirSync`/`readFileSync` over a dir, build an `Offender[]`, print + `process.exit(1)` on any offender:
```typescript
#!/usr/bin/env tsx
import { readdirSync, readFileSync } from 'node:fs';
const SCHEMA_DIR = join(import.meta.dirname, '..', 'prisma', 'schema');
function main(): void {
  const offenders = files.flatMap(findOffenders);
  if (offenders.length === 0) { process.stdout.write('...all clean\n'); return; }
  process.exit(1);
}
main();
```

**Net-new assertion (Pitfall 19):** there is NO existing leakage harness and a pure "not on EU schema" check is WRONG (the models ARE on both schemas). The realistic lint greps API/service source for default-client reads of the 4 new models — i.e. fail on any `prisma.freeZoneAssignment` / `prismaRaw.saudizationConfig` (etc.) outside an explicitly region-aware path (`ctx.db` / `getRegionalClient`). Decide exact shape with planner.

---

## Shared Patterns

### Audit logging (D-17)
**Source:** `packages/api/src/services/audit-writer.ts` `writeAuditLog`; usage at `contractor.ts:733, 849, 1037`; signature in RESEARCH lines 413-421.
**Apply to:** band edits, headcount edits, GULF-10 drift overrides, free-zone migration writes — every sensitive Gulf mutation.
```typescript
await writeAuditLog({
  organizationId: ctx.organizationId,
  actorType: 'USER',
  action: 'gulf.nitaqat_threshold.override',
  resourceType: 'CONTRACTOR',
  resourceId: input.configId,
  metadata: { before, after, custom: true }, // drives "Custom — verify with adviser" badge
  tx,                                         // pass tx inside transactions
});
```

### Region routing (GULF-11)
**Source:** `packages/db/src/region.ts` (`getRegionalClient`, `SUPPORTED_REGIONS`, `preWarmRegionalClients`).
**Apply to:** ALL Gulf data access. Routers/web read via region-aware `ctx.db`. Cron/services that lack a tenant frame loop `SUPPORTED_REGIONS` + `getRegionalClient(region)`. NEVER read the 4 new models via default `prisma`/`prismaRaw`.
```typescript
export const SUPPORTED_REGIONS = ['EU', 'ME'] as const;
export function getRegionalClient(region: string): PrismaClient { /* cached pool, throws on unset env */ }
```

### Tenant-scoped tRPC procedure (D-17)
**Source:** `zatca.ts:36-42`, `contractor.ts` (`tenantProcedure` + `requirePermission` + Zod on every proc).
**Apply to:** every Gulf router procedure. `tenantProcedure.use(requirePermission({...})).input(z.object({...})).mutation/query`. Tenant scope from `ctx.organizationId`/`ctx.db` — never client input.

### Locked-phrase registry (GULF-09 / D-15)
**Source:** `packages/validators/src/legal/gb.ts` + index export block (`index.ts:361-369`) + `locked-phrases-guard.test.ts:65-70,142`.
**Apply to:** `legal/ae.ts`, `legal/sa.ts`. Statutory identifiers (authority names, Nitaqat band labels, Qiwa terms) are locked code constants, NOT translation keys (D-14).

### Translation boundary (D-16)
**Source:** `useTranslations` (`apps/web-vite/src/i18n/useTranslations.ts`); `messages/{en,de,pl,ar}.json`; `pnpm i18n:parity`.
**Apply to:** ALL Gulf user-facing copy. Real de+pl+ar values (NOT en placeholders). `i18n:parity` checks key existence only (Pitfall 21) — genuine de/pl is a review discipline, add a human-verify checkpoint.

### Structural-client / transaction composition
**Source:** `compliance-supersession.ts:50-57` (`SupersessionClient` interface) — same as `audit-writer.ts`.
**Apply to:** `free-zone-compliance.ts`, `permitted-activity-check.ts` — accept a `tx`-or-`ctx.db` client so item writes + audit log are atomic inside `$transaction`.

### Logging (D-17)
**Source:** `@contractor-ops/logger` (`createLogger({ service })` / `createCronLogger`).
**Apply to:** all Gulf services + cron fan-out. No `console.*`, no silent catch — `log.error({ err }, '...')` like `compliance-reminder-scan.ts:156`.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `packages/db/scripts/lint-region-leakage.ts` | utility | transform | No existing region-leakage harness (Pitfall 19). `audit-enum-casing.ts` supplies only the tsx-script skeleton; the assertion logic is net-new. |
| `ml-`/`mr-` RTL ban guard | utility (CI) | — | Pitfall 20 — the asserted "Phase 70 guard" could NOT be located (web-vite uses Biome, no `ml-`/`mr-` grep in `lint:ci`). Planner must verify-or-build. |

---

## Metadata

**Analog search scope:** `packages/db/prisma/schema`, `packages/db/scripts`, `packages/compliance-policy/src/policies`, `packages/api/src/services`, `packages/api/src/routers/{compliance,core,finance}`, `packages/validators/src/legal`, `apps/web-vite/src/components/{settings,dashboard,contractors}`, `apps/web-vite/src/hooks`, `apps/cron-worker/src/jobs/handlers`.
**Files scanned:** ~22 analog files read directly.
**Pattern extraction date:** 2026-06-03
