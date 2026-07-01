# Phase 91: Theme B — Akta Osobowe / Personnel File - Pattern Map

**Mapped:** 2026-07-01
**Files analyzed:** 18 source files (6 new, 12 modified) + 6 Wave-0 test files + wiki/docs
**Analogs found:** 17 / 18 with a concrete file:line analog (3 are genuine NEW builds mapped to nearest partial analog)

> All statutory windows, section taxonomies, citations, and the RBAC matrix ship as **seeded data carrying a "needs jurisdiction legal/tax-adviser verification" annotation** (REQUIREMENTS.md line 26 Standing Constraint; local-only). The adviser-verify string idiom is established in `retention-policy.ts:9-11`, `gdpr.ts:19-21`, and `policies/pl.ts` `draftLegalText: '... (PENDING legal review)'` — mirror it in every new retention/section copy string.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/db/prisma/schema/worker.prisma` (MOD: +`PersonnelFile`, +`PersonnelFileDocument`) | model | CRUD | `Contractor.workerId @unique` FK (`contractor.prisma:68,76`) + `Document` (`contract.prisma:130`) | exact |
| `packages/db/src/retention-policy.ts` (MOD: +akta tokens) | config | transform | self (`RETENTION_YEARS:13`) | self-extend |
| `packages/db/src/personnel-retention.ts` (NEW) | utility/resolver | transform | `getRetentionCutoff` (`retention-policy.ts:48`) | partial (flat map → event-anchor; NEW structure) |
| `packages/db/src/soft-delete.ts` (MOD: route PersonnelFile) | middleware | event-driven | self (`isRetentionGuarded:72`) | self-extend (chokepoint #1) |
| `apps/cron-worker/src/jobs/handlers/data-purge.ts` (MOD: route PersonnelFile) | service/cron | batch | self (`cutoffFor:43`) | self-extend (chokepoint #2) |
| `packages/compliance-policy/src/personnel-sections.ts` (NEW) | config/registry | transform | `doc-registry.ts:17-61` (register-on-import) | exact (mirror idiom) |
| `packages/compliance-policy/src/personnel-retention-rules.ts` (NEW) | config/registry | transform | `doc-registry.ts:17-61` + `policies/pl.ts` `registerPolicyRule` | exact (mirror idiom) |
| `packages/compliance-policy/src/index.ts` (MOD: side-effect imports + re-exports) | config | — | self (`index.ts:7-12`) | self-extend |
| `packages/auth/src/permissions.ts` (MOD: +`employeeFileA..D`) | config/RBAC | request-response | `contractorPii`/`employee` resources (`permissions.ts:44,49`) | partial (NEW section grain) |
| `packages/auth/src/roles.ts` (MOD: wire sections into 4 HR roles) | config/RBAC | request-response | 4 HR roles (`roles.ts:189-213`) + owner `allPermissions` fence (`:20-44`) | partial (NEW section grain) |
| `packages/api/src/routers/core/personnel-file.ts` (NEW) | router/controller | CRUD + request-response | `employee.ts` (workforce-gated router) + `compliance-admin.ts:239` (approve/reject) | role-match |
| `packages/api/src/routers/compliance/gdpr.ts` (MOD) **or** `personnelFile.requestErasure` (NEW) | router/controller | request-response | `gdpr.ts requestErasure:89` + `RETENTION_CITATIONS:23` + `retainedUnderStatute:295-332` | partial (org/model → per-employee/per-section grain; NEW) |
| `packages/api/src/services/personnel-classifier.ts` (NEW) | service | event-driven (QStash async) | `ocr-extraction.ts processOcrExtraction:100` (killswitch-gated AI) | partial (invoice → section classifier; NEW result type) |
| `packages/feature-flags/src/flags-core.ts` (MOD: +`killswitch.ai-personnel-classifier`) | config | — | `killswitch.ai-invoice-parser` (`flags-core.ts:76-85`) | exact (clone shape) |
| `packages/api/src/root.ts` (MOD: mount `personnelFile` in `workforceRouters`) | route/config | — | self (`root.ts:175-182`) | self-extend |
| `packages/db/src/index.ts` (MOD: export resolver) | config | — | self (`index.ts:31` retention exports) | self-extend |
| `apps/web-vite/src/components/employees/personnel-file/` (NEW shell + hook) | component + hook | request-response | `components/documents/*` + `hooks/use-document-list.ts:31` | role-match (reuse family; new 4-section shell) |
| Wave-0 tests (6 files) | test | — | `worker-tenant-isolation.test.ts:294-353` (mock-Prisma cross-org harness) | exact (clone harness) |

---

## Pattern Assignments

### `packages/db/prisma/schema/worker.prisma` (model, CRUD) — MODIFY

**Analog:** `Contractor.workerId @unique` 1:1 sidecar FK + `Document` model.

**1:1 sidecar FK to the Worker identity root** (`packages/db/prisma/schema/contractor.prisma:68,76`):
```prisma
workerId  String  @unique          // 1:1 sidecar link to Worker identity root
worker    Worker  @relation(fields: [workerId], references: [id])
```
The `Worker` side has a commented stub to uncomment/extend (`worker.prisma:31-32`):
```prisma
  contractor   Contractor?
  // employee  Employee?
```
**Apply:** add `personnelFile PersonnelFile?` to `Worker`; `PersonnelFile { workerId String @unique; worker Worker @relation(...) }` mirroring `Contractor.workerId`. Tenant-owning: carries `organizationId` + `deletedAt`, **deliberately absent from `globalModels`** (see `worker.prisma:8-10` invariant comment).

**Section enum on the join (D-01 lean, enum-on-link):** model `PersonnelFileDocument` carrying `section SECTION_A|B|C|D` + FK to `Document` (`contract.prisma:130`). Reuse the existing `Document`/`DocumentLink` stack (`contract.prisma:130-176`) — do NOT build a parallel document model. `DocumentStatus.PENDING_REVIEW` (`contract.prisma:252`) is the admin classify-step state. Add nullable `hireDate`/`terminatedAt` read-seam columns (P93 populates `terminatedAt`; null → active → indefinite retain).

---

### `packages/db/src/retention-policy.ts` (config, transform) — MODIFY (self-extend)

**Analog:** self — `RETENTION_YEARS` (`:13`). The source comment **explicitly invites** Phase 91 to register here (`:4-5`, `:16-17`): *"per-jurisdiction personnel-file rules register on the SAME map — no parallel retention engines."*

**Add years tokens only** (D-03 — years are the single source of truth; the rule structure lives elsewhere):
```typescript
// extends RETENTION_YEARS (retention-policy.ts:13) — ADVISER-VERIFY each value
'pl-akta-post2019': 10,   'pl-akta-legacy': 50,
'de-personalakte-tax': 10,'de-accident-records': 30,
'uk-personnel-general': 6,'uk-personnel-financial': 7,
'us-i9-post-hire': 3,     'us-i9-post-termination': 1,
```
**Do NOT** map `PersonnelFile` directly into `MODEL_RETENTION_TYPE` (`:29`) with a single token — that flat path computes `now − years` against `deletedAt` (Pitfall 1). The akta rows route through the new resolver instead.

---

### `packages/db/src/personnel-retention.ts` (utility/resolver, transform) — NEW

**Nearest analog:** `getRetentionCutoff` (`retention-policy.ts:48-58`). This is a **genuine new structure** — the flat `model→years` map cannot express (a) per-rule event anchor, (b) `max()` combinator, (c) indefinite-while-active, (d) per-jurisdiction×section selection.

**Existing flat resolver (the shape to wrap, NOT copy):**
```typescript
// retention-policy.ts:48-58 (VERIFIED)
export function getRetentionCutoff(model, now, overrideMap = MODEL_RETENTION_TYPE): Date | null {
  const recordType = overrideMap[model];
  if (!recordType) return null;
  const cutoff = new Date(now);
  cutoff.setFullYear(cutoff.getFullYear() - RETENTION_YEARS[recordType]);
  return cutoff;
}
```
**Build (D-04):** `getPersonnelRetentionCutoff(rules, { hireDate, terminationDate, documentDate, now })` — reads years from `RETENTION_YEARS[rule.recordType]`, resolves each rule's anchor (`HIRE_DATE|TERMINATION_DATE|DOCUMENT_DATE`), `max()`-combines, returns `null` (= retain indefinitely / never purge) when a required anchor is absent (active employee → Pitfall 2). Return `{ erasable, retainUntil, citation }`. **Critical:** `null` cutoff must propagate as "never purge" through both chokepoints exactly like `getRetentionCutoff` returning `null` means "no rule".

---

### `packages/db/src/soft-delete.ts` (middleware, event-driven) — MODIFY (chokepoint #1, self-extend)

**Analog:** self — `isRetentionGuarded` (`:72-75`):
```typescript
// soft-delete.ts:72-75 (VERIFIED) — a non-null cutoff forces soft-delete
const isRetentionGuarded = (model: string): boolean =>
  getRetentionCutoff(model, new Date(), retentionOverride) !== null;
const requiresSoftDelete = (model: string): boolean =>
  softDeleteModels.has(model) || isRetentionGuarded(model);
```
**Apply:** add `PersonnelFile`/`PersonnelFileDocument` to the soft-delete path; a delete inside the statutory window must convert to soft-delete (set `deletedAt`), never hard-delete. The personnel-retention resolver decides "guarded" for these models (per-row, anchor-driven) — a dedicated branch, not the flat `getRetentionCutoff` default.

---

### `apps/cron-worker/src/jobs/handlers/data-purge.ts` (service/cron, batch) — MODIFY (chokepoint #2, self-extend)

**Analog:** self — `cutoffFor` (`:43-45`), THE load-bearing hard-delete path (runs on BASE prisma, no soft-delete extension):
```typescript
// data-purge.ts:43-45 (VERIFIED)
function cutoffFor(model: string, now: Date, flatCutoff: Date): Date {
  return getRetentionCutoff(model, now) ?? flatCutoff;
}
// usage pattern (:139): deleteMany where deletedAt < cutoffFor(model, now, cutoff)
```
**Apply:** add a `PersonnelFileDocument`/`PersonnelFile` sweep that gates each row on `getPersonnelRetentionCutoff(...)`; a row whose resolver returns `null` (indefinite) or whose `retainUntil > now` must be **excluded** from the `deleteMany`. Follow the children→parents delete order (`:7-15`) and R2-before-DB cleanup (`:90-110`) since personnel docs carry `storageKey`.

---

### `packages/compliance-policy/src/personnel-sections.ts` (config/registry, transform) — NEW

**Analog (exact idiom):** `doc-registry.ts:17-61` register-on-import.
```typescript
// doc-registry.ts:17-61 (VERIFIED) — the shape to mirror
const complianceDocs = new Map<string, ComplianceDocRegistryEntry>();
export function registerComplianceDoc(entry): void {
  if (complianceDocs.has(entry.id)) throw new Error(`already registered: ${entry.id}`);
  complianceDocs.set(entry.id, entry);
}
const BASELINE_DOCS: ComplianceDocRegistryEntry[] = [ /* per-jurisdiction */ ];
for (const doc of BASELINE_DOCS) registerComplianceDoc(doc);
```
**Build:** `(jurisdiction, DocumentType) → SECTION_A|B|C|D` + per-section display labels, keyed by the `Jurisdiction` type (`types.ts:6` — `'UK'|'DE'|'PL'|'US'|'KSA'|'UAE'`; only PL/DE/UK/US in scope). **Gotcha:** `doc-registry.ts:11` uses a *different* `'DE'|'UK'|'PL'|'US'|'AE'|'SA'` enum — pick the `Jurisdiction` type (KSA/UAE form) since `mapIsoToJurisdiction` (`jurisdiction-resolver.ts`) already emits it.

---

### `packages/compliance-policy/src/personnel-retention-rules.ts` (config/registry, transform) — NEW

**Analog:** `doc-registry.ts` register-on-import + the per-jurisdiction sub-module `registerPolicyRule({...})` shape (`policies/pl.ts`), including the adviser-verify string:
```typescript
// policies/pl.ts (VERIFIED) — register-on-import + PENDING-legal annotation idiom
registerPolicyRule({
  policyRuleId: 'pl.zus_a1@v1', jurisdiction: 'PL', documentType: 'PL_ZUS_A1',
  severity: 'BLOCKING',
  draftLegalText: '... (ZUS / EU Reg 883/2004 Art 12; PENDING legal review)',
});
```
**Build:** `(jurisdiction, section) → PersonnelRetentionRule[]` where each rule = `{ recordType: keyof RETENTION_YEARS, anchor, citation }`. US I-9 section carries two rules (`us-i9-post-hire` HIRE_DATE + `us-i9-post-termination` TERMINATION_DATE) combined by `max()`. The resolver in `personnel-retention.ts` reads `RETENTION_YEARS[rule.recordType]` so years stay single-sourced (D-03). Every `citation` carries the adviser-verify annotation.

---

### `packages/compliance-policy/src/index.ts` (config) — MODIFY (self-extend)

**Analog:** self — side-effect wiring (`:7-12`):
```typescript
// index.ts:7-12 (VERIFIED)
import './policies/uk'; import './policies/de'; import './policies/pl';
import './policies/us'; import './policies/ksa'; import './policies/uae';
```
**Apply:** add `import './personnel-sections';` + `import './personnel-retention-rules';` (side-effect) and re-export the public getters/types in the existing export block (`:14-61`).

---

### `packages/auth/src/permissions.ts` (config/RBAC, request-response) — MODIFY  ⚠ GENUINE NEW BUILD #1

**Nearest analog (no exact):** the finest existing grain is **resource-split**, not section-scoped — `contractorPii` split from `contractor` (`permissions.ts:44`) and `employee` split from `contractor` (`:49`). There is **no precedent for a section dimension** on a single resource.
```typescript
// permissions.ts:44,49 (VERIFIED) — finest existing grain = separate resource
contractorPii: ['read'],   // gate for SSN reveal; deny-by-default for 7 roles
employee: ['create', 'read', 'update', 'delete', 'approve_leave'],
```
**Build (D-02, recommend resource-per-section):** add `employeeFileA..D: ['read', 'write']` to `accessControlStatement` (`:12`). The `Permission` type (`:67-69`) and `requirePermission` flow through unchanged (research-verified: attribute-layer would force changes to `Permission`, `requirePermission`, the Better-Auth statement, AND `permissionToScopes` — resource-per-section drops in unchanged). **Planner writes this at full fidelity — no copy-from analog for the section semantics.**

---

### `packages/auth/src/roles.ts` (config/RBAC, request-response) — MODIFY  ⚠ GENUINE NEW BUILD #1 (cont.)

**Analog:** the 4 HR roles (`roles.ts:189-213`) + the owner BFLA fence (`:20-44`).
```typescript
// roles.ts:189-213 (VERIFIED) — 4 HR roles to wire sections into
hr_admin:      ac.newRole({ employee: ['create','read','update','delete','approve_leave'], contractor:['read'], ... }),
hr_manager:    ac.newRole({ employee: ['read','update'], contractor:['read'], ... }),
payroll_officer: ac.newRole({ employee: ['read'], payment:['read'], report:['read','export'] }),
leave_approver: ac.newRole({ employee: ['read','approve_leave'] }),
```
**BFLA fence (CRITICAL — `roles.ts:20-44`):** `allPermissions` (owner's sole grant) is a DUPLICATE of `accessControlStatement` and deliberately **does NOT list `employee`** — the new `employeeFileA..D` resources MUST be **equally absent** from `allPermissions`. Adding them to owner re-opens the P89 BFLA hole. Recommended matrix (ADVISER-VERIFY, A9): `hr_admin` A/B/C/D r+w; `hr_manager` A/B/D r+w + C read; `payroll_officer` C read; `leave_approver` A read; `owner` NONE.

---

### `packages/api/src/routers/core/personnel-file.ts` (router/controller, CRUD + request-response) — NEW

**Analog:** `employee.ts` (workforce-gated router) for mount/guard/Zod-strict; `compliance-admin.ts:239` for the approve/reject classify-step.

**Workforce gate + Zod-strict + per-request flag re-assert** (`employee.ts:1-34`):
```typescript
// employee.ts:23-33 (VERIFIED)
list: tenantProcedure
  .use(requirePermission({ contractor: ['read'] }))
  .input(z.object({ take: z.number().int().min(1).max(200).default(100) }).strict())
  .query(async ({ ctx, input }) => {
    assertWorkforceEnabled(ctx.organizationId, ctx.region);  // defense-in-depth per request
    return ctx.db.worker.findMany({ where: { organizationId: ctx.organizationId, ... } });
  }),
```
**Per-section read gate (D-02):** swap `requirePermission({ contractor: ['read'] })` for the section resource, e.g. `requirePermission({ employeeFileC: ['read'] })`. **Anti-pattern (Pitfall 3):** never `findMany` all sections then `.filter()` in JS — the section gate is a `requirePermission` check, and the query is scoped to the caller's authorized sections.

**Admin classify-step (approve/reject)** — mirror `compliance-admin.ts:259-336`:
```typescript
// compliance-admin.ts:262-299 (VERIFIED) — PENDING_REVIEW verify + flip + audit
const doc = await tx.document.findFirst({ where: { id, organizationId }, select: { id:true, status:true } });
if (!doc || doc.status !== 'PENDING_REVIEW') throw new TRPCError({ code:'PRECONDITION_FAILED', ... });
// verify owning DocumentLink, then:
await tx.document.update({ where: { id }, data: { status: 'ACTIVE' } });
await auditedMutation(auditMutationCtx(ctx), { action:'...', resourceType:'...', metadata:{...} }, async()=>updated, tx);
```
The personnel "approve" additionally writes the chosen `SECTION_A..D` onto the `PersonnelFileDocument` row. Best-effort post-tx notification stays outside the `$transaction` (`:331`).

---

### `packages/api/src/routers/compliance/gdpr.ts` (MOD) or `personnelFile.requestErasure` (NEW)  ⚠ GENUINE NEW BUILD #2

**Nearest analog:** `gdpr.ts requestErasure` (`:89-346`) — but its grain is **whole-org × whole-model**; AKTA-03 needs **per-employee × per-section × per-jurisdiction**. Recommend a NEW `personnelFile.requestErasure({ workerId })` (the org path stays untouched), reusing the citation + audit idioms.

**Statutory-hold mechanism to extend (`gdpr.ts:110-116`):**
```typescript
// gdpr.ts:110-116 (VERIFIED) — model→citation, never over-claim
const retainedUnderStatute: Record<string, string> = {};
const recordRetention = (model: string): void => {
  const recordType = retainedModels[model];
  if (recordType) retainedUnderStatute[model] = RETENTION_CITATIONS[recordType];
};
```
**`RETENTION_CITATIONS` (`gdpr.ts:23-26`)** — extend with the akta tokens (1:1 with the new `RETENTION_YEARS` keys), each carrying the adviser-verify annotation.

**Never-over-claim audit (`gdpr.ts:318-332`)** — mirror at per-employee grain:
```typescript
// gdpr.ts:318-332 (VERIFIED)
if (hasStatutoryHold) {
  await writeAuditLog({ organizationId: orgId, action: 'organization.erasure_retained_under_statute',
    resourceType: 'ORGANIZATION', metadata: { retainedUnderStatute }, ... });
}
```
**Build (D-06 / criterion #3 verbatim):** return a per-section disposition list `{ section, disposition: 'erased'|'retained', citation?, retainUntil? }` + `fullErasureClaimed: boolean` that is `false` whenever ANY section is retained (Pitfall 4). Audit action `personnel_file.erasure_retained_under_statute`. **Planner writes the per-section grain at full fidelity — the org/model mechanism exists, the grain does not.**

---

### `packages/api/src/services/personnel-classifier.ts` (service, event-driven QStash)  ⚠ GENUINE NEW BUILD #3

**Nearest analog:** `ocr-extraction.ts processOcrExtraction` (`:100-146`) — invoice-only today; the section classifier is a new path + new result type.

**Killswitch-gated async AI (the exact idiom to mirror, `ocr-extraction.ts:120-146`):**
```typescript
// ocr-extraction.ts:120-146 (VERIFIED)
const region = await resolveOrgRegion(params.organizationId);
const parser = evaluate('killswitch.ai-invoice-parser', { organizationId: params.organizationId, region });
if (!parser.enabled) {
  // mark SKIPPED (not FAILED) → fall through to manual path; upload already persisted, never blocked
  await prisma.ocrExtraction.update({ where:{ id }, data:{ status:'SKIPPED', errorMessage:'...', completedAt:new Date() } });
  log.info({ ..., reason: parser.reason }, 'ocr extraction skipped: kill-switch off');
  return;
}
const downloadUrl = await createPresignedDownloadUrl(params.storageKey);  // :149 — reuse for classification
```
**Build (D-07 hybrid):** (a) deterministic `DocumentType`+uploader-doctype → section via the `personnel-sections` registry; (b) on map miss/ambiguous → `evaluate('killswitch.ai-personnel-classifier', {...})`; when `!enabled` (off OR Unleash-unreachable, `killWhenUnknown`) route straight to `PENDING_REVIEW` admin step — **never block or FAIL the upload** (Pitfall 5). (c) AI confidence below threshold (recommend top ≥ 85 AND top−second ≥ 15, A10) → `PENDING_REVIEW`. The Claude Vision call reuses `ClaudeOcrAdapter` (`claude-ocr-adapter.ts:232`) with a new prompt + result type.

---

### `packages/feature-flags/src/flags-core.ts` (config) — MODIFY (clone shape)

**Analog (exact):** `killswitch.ai-invoice-parser` (`flags-core.ts:76-85`):
```typescript
// flags-core.ts:76-85 (VERIFIED) — clone this declaration verbatim with the new key
'killswitch.ai-invoice-parser': {
  key: 'killswitch.ai-invoice-parser', default: true, category: 'kill-switch',
  jurisdiction: 'ANY', owner: 'ops', killWhenUnknown: true,
},
```
**Apply:** add `'killswitch.ai-personnel-classifier'` with the identical shape (`default: true`, `category: 'kill-switch'`, `killWhenUnknown: true`). **Killswitches are NOT signoff-gated** (unlike the `module.*`/`gulf.*`/v7.0 keys at `:142-384` which need a PENDING signoff entry) — no signoff-registry entry required.

---

### `packages/api/src/root.ts` (route/config) — MODIFY (self-extend)

**Analog:** self — the flag-gated workforce mount (`root.ts:175-182`):
```typescript
// root.ts:175-182 (VERIFIED) — add personnelFile to this const
const workforceRouters = {
  worker: workerRouter,
  employee: employeeRouter,
} as const;
const conditionalWorkforceRouters = isWorkforceRegistered() ? workforceRouters : ({} as typeof workforceRouters);
```
**Apply:** add `personnelFile: personnelFileRouter` to `workforceRouters`. The const-keeps-spread-type-constant pattern (`:172-174`) preserves client typing across the flag branch.

---

### `apps/web-vite/src/components/employees/personnel-file/` (component + hook) — NEW

**Analog:** `components/documents/*` family + `hooks/use-document-list.ts:31` (hook = sole tRPC boundary).
```typescript
// use-document-list.ts:31-52 (VERIFIED) — hook owns useTRPC + useQuery; returns presentational props
export function useDocumentList(entityType, entityId): DocumentListProps {
  const trpc = useTRPC();
  const documentsQuery = useQuery(trpc.document.list.queryOptions({ entityType, entityId, page:1, pageSize:50 }));
  const documents = (documentsQuery.data?.items ?? []).map(toDocumentListItem);
  return { documents, isLoading: documentsQuery.isLoading, isEmpty: !documentsQuery.isLoading && documents.length===0, ... };
}
```
**Apply (web-vite layering — CLAUDE.md):** the hook (`hooks/use-*.ts`) is the ONLY tRPC boundary; the section shell is presentational (props in, JSX out). Build NEW only the 4-section shell — reuse `document-list.tsx`/`document-card.tsx`/`pdf-preview.tsx`/`drop-zone.tsx`/`version-history.tsx` for each section's file view. Staff-side only (portal employee view is P96). Per-section visibility derived from the caller's permissions (server already gates; UI mirrors). Mandatory loading/empty/error states; i18n parity en/en-US/de/pl/ar.

---

### Wave-0 tests (test) — NEW (clone harness)

**Analog (exact):** `worker-tenant-isolation.test.ts:294-353` — the mock-Prisma cross-org leak harness.
```typescript
// worker-tenant-isolation.test.ts:294-353 (VERIFIED) — structural + behavioral cross-org assertions
it('Worker is NOT listed in the globalModels set in tenant.ts', () => { /* reads tenant.ts source */ });
it('orgA worker.list returns only orgA workers (never an orgB row)', async () => {
  const result = await callerA.worker.list({});
  expect(result.map(w=>w.id)).not.toContain(WORKER_B_ID);
});
```
Clone for `personnel-file-tenant-isolation.test.ts` (assert `PersonnelFile` absent from `globalModels` + ORG_A never sees ORG_B file). Other Wave-0 files: `personnel-file-rbac.test.ts` (per-section incl. negative/BFLA + owner-fence structural), `personnel-retention.test.ts` (4 jurisdictions + max() + indefinite-while-active), `personnel-erasure.test.ts` (per-section disposition + `fullErasureClaimed===false`), `personnel-classifier.test.ts` (taxonomy hit / AI fallback / killswitch-off→admin / low-conf→admin), `personnel-registry.test.ts` (registers on import, no duplicate-id throw). Scope runs by path: `pnpm --filter @contractor-ops/{api|db|compliance-policy} test <file>` — **never** the full web-vite suite unscoped (MEMORY.md).

---

## Shared Patterns

### Register-on-import per-jurisdiction registry
**Source:** `packages/compliance-policy/src/doc-registry.ts:17-61` + `index.ts:7-12` side-effect wiring + `policies/pl.ts` `registerPolicyRule`.
**Apply to:** `personnel-sections.ts`, `personnel-retention-rules.ts`.
```typescript
const registry = new Map<string, Entry>();
export function registerX(e: Entry): void { if (registry.has(e.id)) throw new Error(`already registered: ${e.id}`); registry.set(e.id, e); }
for (const e of BASELINE) registerX(e);   // import-time
// index.ts: import './personnel-sections'; import './personnel-retention-rules';
```
Key on the `Jurisdiction` type (`types.ts:6`, KSA/UAE form). Only PL/DE/UK/US in scope.

### Shared retention map — one map, three chokepoints (codebase invariant)
**Source:** `retention-policy.ts:13` (`RETENTION_YEARS`) consumed by `soft-delete.ts:72`, `data-purge.ts:43`, `gdpr.ts:110`.
**Apply to:** all retention work. Years live ONLY in `RETENTION_YEARS`; the new `getPersonnelRetentionCutoff` resolver reads from it. **No parallel engine** (D-03).

### Killswitch-gated AI (off / unreachable → manual, never block)
**Source:** `ocr-extraction.ts:120-146` + `flags-core.ts:76-85` (`killWhenUnknown: true`).
**Apply to:** `personnel-classifier.ts`. `!enabled` → SKIPPED/route-to-admin, upload already persisted.

### Permission-layer RBAC (never app-filter)
**Source:** `middleware/rbac.ts:19-61` (`requirePermission`) + `permissions.ts:12` (`accessControlStatement`).
**Apply to:** every `personnel-file.ts` read/write. `permissionToScopes` already maps `{resource:[actions]}` → API-key scopes, so resource-per-section threads through for free.

### writeAuditLog / auditedMutation on sensitive mutations
**Source:** `gdpr.ts:302-332` (`writeAuditLog`) + `compliance-admin.ts:300-314` (`auditedMutation` in-tx).
**Apply to:** erasure (per-section hold audit), section reveal, classify-approve. Pass `tx` inside transactions.

### Tenant-owning model + cross-org leak regression
**Source:** `tenant.ts:42-68` (`globalModels`) + `worker-tenant-isolation.test.ts:294-353`.
**Apply to:** `PersonnelFile`/`PersonnelFileDocument` — NEVER add to `globalModels`; clone the leak test.

### Adviser-verify annotation on all statutory copy
**Source:** `retention-policy.ts:9-11`, `gdpr.ts:19-21`, `policies/pl.ts` `draftLegalText: '... (PENDING legal review)'`.
**Apply to:** every retention window, citation, and section-label seed string (REQUIREMENTS.md line 26).

---

## No Analog Found (Genuine NEW Builds — planner writes at full fidelity)

| File / Concern | Role | Data Flow | Nearest Partial Analog | What Has No Precedent |
|----------------|------|-----------|------------------------|------------------------|
| `permissions.ts` + `roles.ts` per-section RBAC grain | RBAC | request-response | resource-split `contractorPii`/`employee` (`permissions.ts:44,49`) | **A section dimension on a single resource.** Today RBAC is resource-level only; finest grain = separate resource. No section-scoped check exists. |
| `personnelFile.requestErasure` per-section dispositions | router | request-response | `gdpr.ts requestErasure` org/model grain (`:89-346`) | **Per-employee × per-section × per-jurisdiction** disposition list with `fullErasureClaimed`. The whole-org mechanism + citations exist; the grain does not. |
| `personnel-classifier.ts` document→section AI classifier | service | event-driven | `ocr-extraction.ts` invoice extractor (`:100-146`) | **A section-classification result type + taxonomy-first→AI→admin routing.** The killswitch/QStash/presign shell is reusable; the classifier prompt + result + 3-stage routing are new. |
| `personnel-retention.ts` event-anchor resolver | utility | transform | `getRetentionCutoff` flat map (`:48-58`) | **Per-rule event anchor + `max()` combinator + indefinite-while-active.** The flat map computes `now − years` against `deletedAt`; cannot express anchors. |

---

## Metadata

**Analog search scope:** `packages/db` (retention, soft-delete, tenant, schema), `packages/compliance-policy` (registry idiom), `packages/auth` (RBAC), `packages/api` (gdpr, ocr, rbac, router mount, compliance-admin, tests), `packages/feature-flags` (killswitch), `apps/cron-worker` (data-purge), `apps/web-vite` (document hook/components).
**Files scanned:** 20 source files read end-to-end or targeted against verified line numbers.
**Pattern extraction date:** 2026-07-01
</content>
</invoke>
