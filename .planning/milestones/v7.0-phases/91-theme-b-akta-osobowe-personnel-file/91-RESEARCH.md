# Phase 91: Theme B — Akta Osobowe / Personnel File - Research

**Researched:** 2026-07-01
**Domain:** Jurisdiction-correct personnel file (RBAC + statutory retention + RODO erasure + doc classification) on the Worker/Employee abstraction
**Confidence:** HIGH on code-surface findings (every canonical_ref verified against the live tree); MEDIUM-LOW on statutory windows/section taxonomies (legal-deferred, adviser-verify — see Assumptions Log)

## Summary

Phase 91 is a **compose-don't-rebuild** phase. Five of the six investigation surfaces already exist as production primitives; the research confirms their exact extension points, signatures, and the precise gap each genuine new build must fill. The shared retention map, GDPR statutory-hold mechanism, the v6.0-F1 register-on-import per-jurisdiction registry idiom, the Document/`DocumentLink`/`PENDING_REVIEW` stack, and the Claude-Vision-behind-a-killswitch OCR flow are all live and were read end-to-end. There are exactly **three genuine new builds** (per-section RBAC grain, per-employee/per-section/per-jurisdiction statutory-hold erasure, document→section AI classifier) plus **one structural addition the existing primitive cannot express** (a per-rule event-typed retention *rule* layer over the flat years map).

The single most important technical finding: the shared retention primitive (`RETENTION_YEARS` / `MODEL_RETENTION_TYPE` / `getRetentionCutoff`) is a **flat `model → years` map** whose chokepoints compute `cutoff = now − years` and compare against `deletedAt`. It **cannot** express (a) a per-rule event anchor (HIRE/TERMINATION/DOCUMENT), (b) a `max()` combinator (US I-9), (c) indefinite-retain-while-active, or (d) per-jurisdiction/per-section selection where one model maps to many rules. D-03 ("register on the SAME map, no parallel engine") is satisfied by registering the **years values + citations** as new `RetainedRecordType` tokens on the shared map; D-04's rule structure (anchor + combinator + jurisdiction/section selection) is a **new resolver** in a `compliance-policy` register-on-import module that the three chokepoints call for the `PersonnelFile` model. This is the "reuse vs new structure" boundary the planner must task precisely.

**Primary recommendation:** Add a `PersonnelFile` (1:1 → `Worker.id` via `workerId @unique`, mirroring `Contractor.workerId`) + a `PersonnelFileDocument` join carrying a canonical `SECTION_A|B|C|D` enum; gate the whole surface on `module.workforce-employees`; implement per-section RBAC as **resource-per-section** Better-Auth statements (`employeeFileA..D`) wired into the 4 HR roles (never into `owner`'s `allPermissions` const, preserving the P89 BFLA fence); register PL/DE/UK/US section+retention rules as a new `compliance-policy` side-effect module feeding tokens into `RETENTION_YEARS`; add a per-employee erasure procedure returning a per-section disposition list with citations; and build the section classifier as a new OCR-service path behind a new `killswitch.ai-personnel-classifier` (default-on, killWhenUnknown) routing low-confidence/kill-switch-off/Unleash-unreachable straight to a `PENDING_REVIEW` admin classify-step.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-02 (locked):** Per-section RBAC is a NEW permission grain — add a section dimension to the access check (e.g. `employeeFile:read` scoped to `{A,B,C,D}`) so a payroll role can see section C (pay) without section B (discipline). Today RBAC is resource-level only (`packages/auth/src/permissions.ts:12`); finest existing grain is splitting into separate resources (`contractorPii` vs `employee`). Wire the section→role map into the 4 HR roles from P89 (`hr_admin`, `hr_manager`, `payroll_officer`, `leave_approver`) without weakening the P89 BFLA fence (never auto-granted to `owner`, never a contractor mutation). Planner decides resource-per-section vs sub-resource/attribute layer; per-section access MUST be enforced at the permission layer, not only filtered in app logic.
- **D-03 (locked — codebase-mandated):** Extend the shared retention primitive — do NOT build a parallel engine. Per-jurisdiction personnel-file rules register on the SAME `packages/db/src/retention-policy.ts` map, read by all three deletion chokepoints. The per-jurisdiction rule registry lives as a new register-on-import module in `packages/compliance-policy/src/`, feeding `RetainedRecordType` tokens + `MODEL_RETENTION_TYPE` entries into the shared map.
- **D-04 (locked):** Per-rule, event-typed retention clock anchor. Each rule declares its own anchor: `HIRE_DATE | TERMINATION_DATE | DOCUMENT_DATE`, with a `max()` combinator for US I-9 (`max(HIRE+3y, TERMINATION+1y)`, 8 CFR 274a.2). While the employee is active (no termination), the file is retained indefinitely; the clock starts at the anchor event. Termination anchor reads the offboarding/termination event (P93) when present. Each rule carries a statutory citation.
- **D-05 (locked):** Enforcement = soft-delete + scheduled archive, reusing the existing chokepoints (`packages/db/src/soft-delete.ts` retention guard + `apps/cron-worker` data-purge cron). No bespoke deletion path.
- **D-06 constraint (locked — success criterion #3 verbatim):** honor erasure only past the retention window, flag blocked sections with a statutory citation, and NEVER claim full erasure while any hold is active. Extend the `gdpr.ts` statutory-hold mechanism from whole-org + whole-model grain to per-employee + per-section + per-jurisdiction.
- **D-07 (locked):** Hybrid classification — taxonomy-first, AI fallback, admin last. (a) Deterministic map: `DocumentType` enum + uploader-chosen doc-type → section via the per-jurisdiction registry. (b) On miss/ambiguous → Claude-Vision section classifier (extend `ocr-extraction.ts`). (c) Below confidence threshold → admin classify-step reusing `PENDING_REVIEW` + portal upload-approval flow. AI path MUST gate on a kill-switch following the `killswitch.ai-invoice-parser` idiom (off / Unleash-unreachable → skip AI, route straight to admin step; never block the upload).

### Claude's Discretion

- Section model shape (D-01) — canonical-enum+registry vs native-per-jurisdiction; constraint = 4-section view + per-section RBAC.
- Erasure resolution (D-06) — per-section partial vs all-or-nothing-with-hold-block; constraint = criterion-3 exactly.
- `PersonnelFile` model shape: dedicated model FK'd to `workerId` (identity root) vs a relation on the P90 `EmployeeProfile`; the section/document join shape; whether sections are rows or an enum on the document link.
- AI section-classifier confidence threshold + killswitch registry key + the doc-type→section seed taxonomy per jurisdiction.
- Resource-per-section vs sub-resource/attribute layer for the per-section RBAC grain (D-02).
- Staff-side file-viewer composition (reuse of `components/documents/*`).

### Deferred Ideas (OUT OF SCOPE)

- Employee self-service personal akta view → P96 (`EMP-PORTAL-02`); P91 is staff-side only.
- Termination event source → P93 on/offboarding supplies it; P91 consumes the termination anchor where present and retains indefinitely while active.
- Live government retention/registry lookups → seeded reference data only (local-only).
- Native per-jurisdiction section model (vs canonical enum) → folded into D-01 discretion, not a separate phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AKTA-01 | 4-section personnel file (PL cz. A/B/C/D per KP §94; DE Personalakte, UK personnel file, US I-9+file) with per-section RBAC | Section taxonomy enumerated below; `PersonnelFile`+`PersonnelFileDocument` model recommended; resource-per-section RBAC over Better-Auth `accessControlStatement` (`permissions.ts:12`) wired into the 4 HR roles (`roles.ts:189-213`) |
| AKTA-02 | Per-jurisdiction retention engine — PL 10/50yr, DE 10/30yr, UK 6/7yr, US I-9 3yr-post-hire-or-1yr-post-termination | Shared `RETENTION_YEARS` map (`retention-policy.ts:13`) + NEW per-rule anchor resolver in `compliance-policy`; gap analysis below shows the flat map cannot express anchors/combinator/indefinite — new structure required |
| AKTA-03 | GDPR/RODO erasure-request handler with statutory-retention exemption layer (honors erasure only past retention; flags blocked sections with citation) | `gdpr.ts` `requestErasure` (:89) + `RETENTION_CITATIONS` (:23) + `retainedUnderStatute` (:295) extended to per-employee/per-section grain; new `personnelFile.requestErasure({ workerId })` procedure returning per-section dispositions |
| AKTA-04 | Document classification at upload — assign section via doc-type taxonomy; ambiguous → admin classify-step | Deterministic taxonomy map (`DocumentType` enum `contract.prisma:233`) → AI fallback (`ocr-extraction.ts` killswitch idiom `:121`) → `PENDING_REVIEW` admin step (`compliance-admin.ts:233` approve/reject pattern) |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Per-section access enforcement (AKTA-01) | API / Backend (Better-Auth AC + `requirePermission`) | DB (tenant scope) | Constraint D-02: enforced at the permission layer, NOT app-filtered. The check is server-side in tRPC middleware |
| Section taxonomy + retention rules (jurisdiction config) | Backend config (`compliance-policy` register-on-import) | — | Pure, DB-free registry; mirrors e-invoice/classification/doc-registry pattern |
| Retention clock evaluation (AKTA-02) | DB layer (`packages/db` retention resolver) + Cron worker (data-purge) | Backend (gdpr erasure) | The three deletion chokepoints live in `packages/db` + `apps/cron-worker`; the years source-of-truth is `retention-policy.ts` |
| RODO erasure dispositions (AKTA-03) | API / Backend (`gdpr` / new `personnelFile` router) | DB (soft-delete + RLS audit purge) | Per-employee mutation with audit; statutory-hold logic is request-handler concern |
| Document→section classification (AKTA-04) | API / Backend (OCR service + QStash callback) | Integrations (Claude Vision adapter) | Mirrors the invoice OCR orchestrator; AI call is async behind a killswitch |
| Admin classify-step review queue (AKTA-04) | API / Backend (`PENDING_REVIEW` approve/reject) + web-vite staff UI | — | Reuses the contractor compliance upload-review pattern |
| Staff file viewer (UI hint) | Frontend server (web-vite SPA) | API (hook = sole tRPC boundary) | Staff-side only this phase; portal employee view deferred to P96 |
| Personnel-file persistence | DB / Storage (Prisma model + R2 via Document) | — | New tenant-owning model; never in `globalModels`; cross-org leak test |

## Standard Stack

This phase adds **no new external runtime packages.** Every capability composes on libraries already in the workspace. The "stack" is the set of internal primitives to extend.

### Core (internal primitives — extend these, do not replace)
| Module | Location | Purpose | Why Standard |
|--------|----------|---------|--------------|
| Retention map | `packages/db/src/retention-policy.ts` | Single source of statutory years + `RetainedRecordType` tokens; read by all 3 chokepoints | Codebase invariant: "no parallel retention engines" — D-03 mandates registering here `[VERIFIED: codebase grep]` |
| Soft-delete extension | `packages/db/src/soft-delete.ts` | Converts delete→soft-delete; `isRetentionGuarded` forces soft-delete when a retention cutoff is non-null | The "scheduled archive" enforcement half of D-05 `[VERIFIED: read :62-75]` |
| Data-purge cron | `apps/cron-worker/src/jobs/handlers/data-purge.ts` | THE hard-delete path; `cutoffFor(model,...)` uses `getRetentionCutoff` | The "purge after window" enforcement half of D-05 `[VERIFIED: read :43-45]` |
| GDPR erasure router | `packages/api/src/routers/compliance/gdpr.ts` | Whole-org statutory-hold erasure with citation summary | The mechanism to extend to per-employee/per-section grain (D-06) `[VERIFIED: read :74-346]` |
| Compliance-policy registry | `packages/compliance-policy/src/{doc-registry,registry,jurisdiction-resolver}.ts` | Register-on-import per-jurisdiction config keyed by `Jurisdiction` | The exact idiom to mirror for the section+retention rules registry (D-01/D-03) `[VERIFIED: read full]` |
| Better-Auth access control | `packages/auth/src/{permissions,roles}.ts` | `accessControlStatement` resource→action map + 14 roles incl. 4 HR roles | The RBAC surface the per-section grain extends (D-02) `[VERIFIED: read full]` |
| RBAC middleware | `packages/api/src/middleware/rbac.ts` | `requirePermission(permission)` — session→Better-Auth, apiKey→scopes | The check the section dimension threads through `[VERIFIED: read :19-61]` |
| OCR orchestrator | `packages/api/src/services/ocr-extraction.ts` | QStash-async Claude-Vision invoice extraction behind `killswitch.ai-invoice-parser` | The exact killswitch idiom to mirror for the classifier (D-07) `[VERIFIED: read :100-146]` |
| Document stack | `packages/db/prisma/schema/contract.prisma` `Document`/`DocumentLink`/`DocumentStatus` | Polymorphic doc attach + `PENDING_REVIEW` status | The file is built on it; admin classify-step reuses `PENDING_REVIEW` `[VERIFIED: read :130-256]` |
| Feature-flag killswitch | `packages/feature-flags/src/flags-core.ts` | `evaluate(key, ctx) → { enabled, reason }`; killWhenUnknown forces OFF on Unleash outage | The classifier killswitch declaration shape (D-07) `[VERIFIED: read :76-85]` |

### Supporting (already wired — no install)
| Library | Version (workspace) | Purpose | When to Use |
|---------|--------|---------|-------------|
| `@anthropic-ai/sdk` (`Anthropic`) | present in `packages/integrations` (`ClaudeOcrAdapter`) | Claude Vision `messages.create` + tool_use for structured JSON | The section classifier's model call `[VERIFIED: read claude-ocr-adapter.ts:238-262]` |
| `@contractor-ops/feature-flags` `evaluate` | workspace | Killswitch eval | Classifier gate `[VERIFIED: read evaluator.ts:73-147]` |
| `@contractor-ops/logger` (Pino) | workspace | Structured logging (no `console.*`) | All new services |
| `zod` | workspace (v11 tRPC) | `.strict()` boundary validation | Every new procedure input |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Resource-per-section RBAC (`employeeFileA..D`) | Sub-resource/attribute layer threaded through `requirePermission` | Attribute layer requires changing the `Permission` type (`permissions.ts:67`), `requirePermission`, the Better-Auth `createAccessControl` statement shape, AND `permissionToScopes` (`scope-utils.ts:13`). Resource-per-section drops into all four unchanged. **Recommend resource-per-section.** |
| Sections as a `SECTION` enum on `PersonnelFileDocument` | Sections as their own rows (`PersonnelFileSection` table) | Enum-on-link is simpler, keeps RBAC keyed on a literal, and matches D-01's "canonical 4-section enum" lean. Rows add a join for no behavioral gain. **Recommend enum-on-link.** |
| New per-employee erasure procedure | Overload the whole-org `requestErasure` | The org-wide procedure soft-deletes ~40 models; AKTA-03 is employee-scoped with per-section dispositions. A new `personnelFile.requestErasure({ workerId })` keeps the org path untouched. **Recommend new procedure.** |

**Installation:** None. (No `npm install`. Anthropic SDK + all internal packages already present.)

## Package Legitimacy Audit

**No external packages are installed in this phase.** Every dependency (`@anthropic-ai/sdk`, `zod`, `@contractor-ops/*`) is already in the workspace and was used in prior phases. slopcheck/registry verification is therefore **N/A** — there is nothing new to vet.

**Packages removed due to slopcheck [SLOP] verdict:** none (none added).
**Packages flagged as suspicious [SUS]:** none (none added).

> If the planner later decides to add a dedicated classification model SDK or a date-math helper, it MUST run the Package Legitimacy Gate (slopcheck + ecosystem registry check + 7-day release-age rule per CLAUDE.md) and gate the install behind `checkpoint:human-verify`.

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────────────────────────┐
  Staff uploads doc       │  web-vite staff UI (file viewer + 4-section  │
  to an employee file ───►│  shell; reuse components/documents/*)        │
                          │  hook = sole tRPC boundary (no *-container)  │
                          └───────────────┬─────────────────────────────┘
                                          │ tRPC (module.workforce-employees gate)
                                          ▼
          ┌──────────────────────────────────────────────────────────────┐
          │  personnelFile router (NEW, mounted in workforceRouters)      │
          │  requirePermission({ employeeFileX: ['read'|'write'] })       │
          └───┬───────────────┬───────────────────────┬──────────────────┘
              │ classify       │ retention/erasure      │ list/read (per-section RBAC)
              ▼                ▼                        ▼
   ┌─────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
   │ (a) deterministic│  │ getPersonnelRetention│  │ PersonnelFile (1:1    │
   │ taxonomy map     │  │ Cutoff(jurisdiction, │  │ Worker.id) +          │
   │ DocumentType +   │  │ section, {hire,term, │  │ PersonnelFileDocument │
   │ uploader doctype │  │ doc, now}) — NEW      │  │ (SECTION_A..D enum)   │
   │ → SECTION_A..D   │  │ resolver reads years  │  │ → Document/DocumentLink│
   └───┬─────────────┘  │ from RETENTION_YEARS  │  └──────────────────────┘
       │ miss/ambiguous  └──────────┬───────────┘
       ▼                            │ years tokens (D-03)
   ┌─────────────────┐              ▼
   │ killswitch.ai-   │   ┌────────────────────────────────────────────┐
   │ personnel-       │   │ packages/db retention-policy.ts             │
   │ classifier (NEW) │   │ RETENTION_YEARS (+ new akta tokens)         │
   │ off/unreachable ─┼──►│ consumed by: soft-delete · data-purge cron ·│
   │ → admin step     │   │ gdpr erasure                                │
   └───┬─────────────┘   └────────────────────────────────────────────┘
       │ AI section guess
       ▼
   ┌─────────────────────────────────────────────┐
   │ Claude Vision (ClaudeOcrAdapter, QStash async)│
   │ confidence ≥ threshold → auto-assign section  │
   │ confidence < threshold → PENDING_REVIEW       │
   └───────────────┬─────────────────────────────┘
                   ▼
   ┌─────────────────────────────────────────────┐
   │ Admin classify-step (PENDING_REVIEW)          │
   │ approve→ACTIVE+section / reject→ARCHIVED       │
   │ (mirrors compliance-admin approve/reject)     │
   └─────────────────────────────────────────────┘
```

### Recommended Project Structure (new files, not exhaustive)
```
packages/db/prisma/schema/
└── worker.prisma                    # add PersonnelFile + PersonnelFileDocument models (uncomment employee link path)
packages/db/src/
├── retention-policy.ts              # add akta RetainedRecordType tokens (years only)
└── personnel-retention.ts (NEW)     # getPersonnelRetentionCutoff resolver (anchor + max combinator + indefinite)
packages/compliance-policy/src/
├── personnel-sections.ts (NEW)      # register-on-import: jurisdiction → {section labels, doctype→section}
├── personnel-retention-rules.ts (NEW) # register-on-import: (jurisdiction, section) → {token, anchor, combinator, citation}
└── index.ts                         # add side-effect imports (mirror policies/* imports)
packages/auth/src/
├── permissions.ts                   # add employeeFileA..D resources
└── roles.ts                         # wire sections into 4 HR roles (NOT owner allPermissions)
packages/api/src/
├── routers/core/personnel-file.ts (NEW)   # the router (mounts in workforceRouters)
├── services/personnel-classifier.ts (NEW) # taxonomy-first → AI → PENDING_REVIEW
└── routers/compliance/gdpr.ts       # OR new personnelFile.requestErasure — per-section dispositions
packages/feature-flags/src/
└── flags-core.ts                    # add killswitch.ai-personnel-classifier
apps/web-vite/src/components/employees/personnel-file/ (NEW)
└── (4-section shell; reuse components/documents/* for list/card/preview)
```

### Pattern 1: Register-on-import per-jurisdiction registry (mirror for D-01/D-03)
**What:** A module-level `Map`/array with a `registerX()` function called at import time; an `index.ts` that side-effect-imports each jurisdiction sub-module.
**When to use:** The section taxonomy + retention rules registry.
**Example:**
```typescript
// Source: packages/compliance-policy/src/doc-registry.ts:17-61 (VERIFIED)
const complianceDocs = new Map<string, ComplianceDocRegistryEntry>();
export function registerComplianceDoc(entry: ComplianceDocRegistryEntry): void {
  if (complianceDocs.has(entry.id)) throw new Error(`already registered: ${entry.id}`);
  complianceDocs.set(entry.id, entry);
}
const BASELINE_DOCS: ComplianceDocRegistryEntry[] = [ /* ... */ ];
for (const doc of BASELINE_DOCS) registerComplianceDoc(doc);
```
```typescript
// Source: packages/compliance-policy/src/index.ts:7-12 (VERIFIED) — side-effect wiring
import './policies/uk'; import './policies/de'; import './policies/pl';
import './policies/us'; import './policies/ksa'; import './policies/uae';
```
**Note on jurisdiction tokens (gotcha):** Two enums coexist. `doc-registry.ts` uses `'DE'|'UK'|'PL'|'US'|'AE'|'SA'`; the `Jurisdiction` type in `types.ts:6` uses `'UK'|'DE'|'PL'|'US'|'KSA'|'UAE'`; `mapIsoToJurisdiction` (`jurisdiction-resolver.ts:7-23`) maps ISO → the `KSA/UAE` form. The personnel registry must pick one consistently — **recommend the `Jurisdiction` type (`KSA/UAE`)** since the resolver already emits it. Only PL/DE/UK/US are in scope for AKTA per the success criteria.

### Pattern 2: Killswitch-gated async AI (mirror for D-07)
**What:** Evaluate a `kill-switch`-category flag at the org-context boundary; when `!enabled` (off OR Unleash-unreachable, because `killWhenUnknown: true`), skip the AI call and fall through to the manual path — never block the upload.
**When to use:** The section classifier's Claude-Vision call.
**Example:**
```typescript
// Source: packages/api/src/services/ocr-extraction.ts:120-146 (VERIFIED)
const region = await resolveOrgRegion(params.organizationId);
const parser = evaluate('killswitch.ai-invoice-parser', { organizationId, region });
if (!parser.enabled) {
  // mark SKIPPED (not FAILED) → UI drops to manual entry; never blocks
  await prisma.ocrExtraction.update({ where: { id }, data: { status: 'SKIPPED', ... } });
  return;
}
```
```typescript
// Source: packages/feature-flags/src/flags-core.ts:76-85 (VERIFIED) — killswitch declaration shape
'killswitch.ai-invoice-parser': {
  key: 'killswitch.ai-invoice-parser', default: true, category: 'kill-switch',
  jurisdiction: 'ANY', owner: 'ops', killWhenUnknown: true,
},
```
For the classifier: declare `killswitch.ai-personnel-classifier` with the identical shape. Killswitches are **not** signoff-gated (`isGatedFlag('killswitch.ai-invoice-parser') === false`, verified in `is-gated-flag.test.ts:45`), so no PENDING signoff-registry entry is needed — unlike `module.*` flags.

### Pattern 3: PENDING_REVIEW admin approve/reject (mirror for the classify-step)
**What:** A doc created `PENDING_REVIEW`; an admin procedure (compliance:override) verifies status === `PENDING_REVIEW` + org ownership + the owning `DocumentLink`, then flips to `ACTIVE` (approve) or `ARCHIVED` (reject), with `auditedMutation` + best-effort post-tx notification.
**When to use:** The ambiguous-document admin classify-step.
**Example:**
```typescript
// Source: packages/api/src/routers/compliance/compliance-admin.ts:259-299 (VERIFIED)
const doc = await tx.document.findFirst({ where: { id, organizationId }, select: { id, status } });
if (!doc || doc.status !== 'PENDING_REVIEW') throw new TRPCError({ code: 'PRECONDITION_FAILED', ... });
// verify owning DocumentLink, then:
await tx.document.update({ where: { id }, data: { status: 'ACTIVE' } });
```
The personnel classify-step's "approve" additionally writes the chosen `SECTION_A..D` onto the `PersonnelFileDocument` row.

### Pattern 4: Flag-gated router mount (workforce surface)
**What:** Conditionally spread the new router into `appRouter` only when the flag is registered; each procedure also re-asserts the flag per request.
**Example:**
```typescript
// Source: packages/api/src/root.ts:175-182 (VERIFIED)
const workforceRouters = { worker: workerRouter, employee: employeeRouter } as const;
const conditionalWorkforceRouters = isWorkforceRegistered() ? workforceRouters : ({} as ...);
// → add `personnelFile: personnelFileRouter` to workforceRouters
```
```typescript
// Source: packages/api/src/routers/core/employee.ts:34 (VERIFIED) — per-request guard
assertWorkforceEnabled(ctx.organizationId, ctx.region);
```

### Anti-Patterns to Avoid
- **Building a parallel retention engine** — D-03 invariant. Years live ONLY in `RETENTION_YEARS`; the new resolver reads from it.
- **App-layer section filtering** — D-02 requires permission-layer enforcement. A `findMany` that returns all sections then `.filter()`s in JS is a BFLA hole. The section gate must be a `requirePermission` check before the read.
- **Adding the new sections to `owner`'s `allPermissions`** (`roles.ts:20-44`) — the P89 BFLA fence relies on `owner` NOT holding `employee`; the per-section resources must be equally absent (verified: `allPermissions` does not list `employee`).
- **Claiming full erasure during a hold** — success criterion #3 verbatim. The response shape must carry per-section dispositions with `fullErasureClaimed: false` whenever any section is retained.
- **Blocking the upload when AI is off** — D-07: kill-switch off / Unleash-unreachable routes straight to the admin step; the document is already persisted.
- **Putting `PersonnelFile` in `globalModels`** (`tenant.ts:42-68`) — it is tenant-owning; needs the cross-org leak regression test.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Statutory years source | A new per-jurisdiction years constant | `RETENTION_YEARS` tokens (`retention-policy.ts:13`) | D-03 invariant; 3 chokepoints already read it |
| Hard-delete after window | A bespoke purge job | `data-purge.ts` `cutoffFor` + `getRetentionCutoff` | The load-bearing hard-delete path already guards retained models |
| Statutory-hold erasure summary | A new "what's retained" computation | `gdpr.ts` `RETENTION_CITATIONS` + `retainedUnderStatute` (extend grain) | The never-over-claim invariant is already encoded |
| Doc-type→section config | Hard-coded switch in the classifier | `compliance-policy` register-on-import registry | Jurisdiction nuance belongs in seed data (mirrors v6-F1) |
| AI gating | Custom env-var feature toggle | `evaluate('killswitch.…')` (`flags-core.ts`) | killWhenUnknown gives correct incident behavior for free |
| Admin review queue | New status machine | `DocumentStatus.PENDING_REVIEW` + `compliance-admin` approve/reject | Already a tested, audited flow |
| Tenant scoping | `where: { organizationId }` by hand | `withTenantScope` (auto via `createTenantClient`) | Can't-forget; cross-org leak test covers it |
| Permission scope strings | Custom RBAC check | Better-Auth `accessControlStatement` + `requirePermission` | `permissionToScopes` already maps `{resource:[actions]}` → `resource:action` for API keys |
| PDF download for classification | New presign path | `createPresignedDownloadUrl` (`ocr-extraction.ts:149`) | Same regional-storage presign the invoice OCR uses |

**Key insight:** In this domain the custom-build temptation is the retention math. The codebase already solved "retain past a statutory window across 3 deletion paths." The ONLY thing missing is the *rule layer* (anchor + combinator + jurisdiction/section selection). Build exactly that — a thin resolver over the existing years map — not a second engine.

## Runtime State Inventory

> This is a greenfield-additive phase (new model + new config + new router), not a rename/refactor. The standard Runtime State Inventory (stored data / live service config / OS-registered state / secrets / build artifacts carrying an old string) does not apply — there is no string being renamed and no existing data to migrate. The one runtime-state concern is forward-looking:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data (forward) | The **termination date anchor** (D-04) is runtime state that does not exist yet — P93 (offboarding) writes it; P91 only reads it | P91 must define the read seam: a nullable `terminatedAt`/`employmentEndDate` it reads (null → active → indefinite retain). P93 later populates it. No migration of existing data (no employees exist pre-P90). |
| Build artifacts | Prisma client regenerates on `PersonnelFile` model add | `pnpm` prisma generate as part of the migration task (standard) |

**Nothing found in other categories:** None — verified no rename/string-replacement is in scope; `PersonnelFile` is a brand-new tenant model with no prior rows.

## Common Pitfalls

### Pitfall 1: Treating the flat retention map as if it supports event anchors
**What goes wrong:** A plan registers `MODEL_RETENTION_TYPE['PersonnelFile'] = 'pl-akta-post2019'` and assumes `getRetentionCutoff` does the right thing. It computes `now − 10y` and compares to `deletedAt` — i.e. "retain 10 years after the row was soft-deleted," which is NOT the statutory rule ("retain 10 years after the calendar year employment ended").
**Why it happens:** The map name (`MODEL_RETENTION_TYPE`) implies one model = one rule. Personnel files are one model = many rules (per jurisdiction × per section × per anchor).
**How to avoid:** Register the **years tokens** on `RETENTION_YEARS` (single source of years, satisfies D-03), but route `PersonnelFile`/`PersonnelFileDocument` rows through a NEW `getPersonnelRetentionCutoff(jurisdiction, section, { hireDate, terminationDate, documentDate, now })` resolver in the three chokepoints — a dedicated branch, not the flat `getRetentionCutoff` default.
**Warning signs:** A task that maps `PersonnelFile` directly in `MODEL_RETENTION_TYPE` with a single token, or a retention test that anchors on `deletedAt` instead of hire/termination/document date.

### Pitfall 2: max() combinator + indefinite-while-active edge cases (US I-9)
**What goes wrong:** US I-9 is `max(HIRE+3y, TERMINATION+1y)`. If termination is null (active employee), naive code computes `null+1y` → erases too early or throws.
**Why it happens:** The combinator has a special null branch: while active, the file is retained indefinitely (return `null` cutoff = never purge).
**How to avoid:** The resolver returns `null` (= retain indefinitely) when a required anchor event hasn't occurred; for `max()`, evaluate each present anchor and take the latest; if ANY rule yields indefinite, the section is retained.
**Warning signs:** A test that only covers terminated employees; no test for "active employee → indefinite retain."

### Pitfall 3: Section RBAC enforced in app logic, not the permission layer
**What goes wrong:** The file read returns all sections, then the UI/handler filters by role — a payroll officer's response still contains section B (discipline) bytes over the wire (BFLA).
**Why it happens:** It's easier to one-query-then-filter than to gate per section.
**How to avoid:** Per-section `requirePermission({ employeeFileC: ['read'] })`; the read query is scoped to the sections the caller can see. Negative tests assert a forbidden section is never in the payload.
**Warning signs:** A single `personnelFile.get` that returns `sections: [A,B,C,D]` with a JS `.filter`.

### Pitfall 4: Erasure response over-claiming during a hold
**What goes wrong:** The response says "all data erased" while a section is under a statutory hold — a RODO repudiation/honesty failure (criterion #3 is verbatim-locked).
**How to avoid:** The response is a per-section disposition list (`erased | retained` + citation + `retainUntil`) with an explicit `fullErasureClaimed: boolean` that is `false` whenever any section is retained; mirror `gdpr.ts`'s `organization.erasure_retained_under_statute` audit row (`:318-332`) at per-employee grain.
**Warning signs:** A success message string that hardcodes "fully erased"; no audit row when a hold is active.

### Pitfall 5: Classifier blocks or fails the upload when AI is unavailable
**What goes wrong:** Killswitch off / Unleash down marks the doc FAILED or rejects the upload.
**How to avoid:** Follow `ocr-extraction.ts:126` — mark the classification SKIPPED and route to `PENDING_REVIEW` admin step; the document is already persisted and visible.
**Warning signs:** Any code path where `!parser.enabled` throws or sets a FAILED status on the document.

### Pitfall 6: I-9 stored inside the personnel file (US)
**What goes wrong:** US best practice (and ICE inspection guidance) is to store Form I-9 **separately** from the general personnel file. Modeling US "section A = I-9" inside the same file conflates them.
**How to avoid:** Treat the US I-9 as its own section/retention rule with the I-9-specific `max()` window; flag the separate-storage expectation in the seed taxonomy copy (adviser-verify).
**Warning signs:** US retention applied uniformly across all sections at the I-9 window.

## Code Examples

### Adding personnel-file retention tokens (years only — D-03)
```typescript
// Extends packages/db/src/retention-policy.ts:13 (VERIFIED current shape)
export const RETENTION_YEARS = {
  '1099-NEC': 4,
  'backup-withholding': 7,
  // Personnel-file (akta) statutory windows — ADVISER-VERIFY (see Assumptions Log)
  'pl-akta-post2019': 10,     // KP art. 94⁵ + e-akta reform (post-2018 hires)  [ASSUMED]
  'pl-akta-legacy': 50,       // pre-1999 / 1999–2018 without ZUS RIA/OSW         [ASSUMED]
  'de-personalakte-tax': 10,  // §147 AO / §257 HGB / §41 EStG Lohnkonto           [ASSUMED]
  'de-accident-records': 30,  // occupational/accident exposure records           [ASSUMED]
  'uk-personnel-general': 6,  // Limitation Act 1980 (contract claims)            [ASSUMED]
  'uk-personnel-financial': 7,// payroll/financial records                        [ASSUMED]
  'us-i9-post-hire': 3,       // 8 CFR 274a.2(b)(2)(i)(A)                          [ASSUMED]
  'us-i9-post-termination': 1,// whichever is LATER (max combinator)              [ASSUMED]
} as const;
```

### New rule resolver (the structure the flat map cannot hold — D-04)
```typescript
// NEW: packages/db/src/personnel-retention.ts (recommended signature)
type Anchor = 'HIRE_DATE' | 'TERMINATION_DATE' | 'DOCUMENT_DATE';
interface PersonnelRetentionRule {
  recordType: keyof typeof RETENTION_YEARS;  // years come from the shared map
  anchor: Anchor;
  citation: string;                          // statutory cite (adviser-verify)
}
// (jurisdiction, section) → one or more rules; max() across rules
export function getPersonnelRetentionCutoff(
  rules: PersonnelRetentionRule[],
  dates: { hireDate: Date | null; terminationDate: Date | null; documentDate: Date | null; now: Date },
): { erasable: boolean; retainUntil: Date | null; citation: string | null } {
  // for each rule: resolve anchor date; if the required anchor is null → indefinite retain
  // retainUntil = anchorDate + RETENTION_YEARS[rule.recordType]
  // combine with max(); active employee (no termination) where a rule needs it → retainUntil = null
  // erasable = retainUntil !== null && now >= retainUntil
}
```

### Resource-per-section RBAC (D-02)
```typescript
// Extends packages/auth/src/permissions.ts:12 accessControlStatement (VERIFIED current)
export const accessControlStatement = {
  // ...existing...
  employee: ['create', 'read', 'update', 'delete', 'approve_leave'],
  // NEW per-section grain — read/write per akta section
  employeeFileA: ['read', 'write'],
  employeeFileB: ['read', 'write'],
  employeeFileC: ['read', 'write'],
  employeeFileD: ['read', 'write'],
} as const;
// roles.ts (VERIFIED 4 HR roles at :189-213) — recommended section→role matrix (ADVISER-VERIFY):
//   hr_admin:       A/B/C/D read+write
//   hr_manager:     A/B/D read+write,  C read   (no pay write)
//   payroll_officer:C read   (pay only — matches D-02 example)
//   leave_approver: A read   (basic identity only)
//   owner:          NONE (BFLA fence — do NOT add to allPermissions const)
```

### Per-section erasure disposition response (D-06 / criterion #3)
```typescript
// Recommended return shape for personnelFile.requestErasure({ workerId })
return {
  workerId,
  fullErasureClaimed: retained.length === 0,   // NEVER true while any hold active
  sections: [
    { section: 'A', disposition: 'erased' },
    { section: 'C', disposition: 'retained', citation: 'KP art. 94⁵ (10yr)', retainUntil: '2036-12-31' },
  ],
};
// + writeAuditLog 'personnel_file.erasure_retained_under_statute' with metadata.retainedUnderStatute
//   (mirror gdpr.ts:318-332, VERIFIED)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Org-wide GDPR erasure only | Statutory-hold-aware erasure with citation summary | shipped (gdpr.ts current) | The per-employee/per-section grain is the natural next extension, not a rewrite |
| Invoice-only Claude OCR | Generic killswitch-gated async AI orchestrator | shipped (ocr-extraction.ts) | The section classifier reuses the orchestration shell; only the prompt/result type are new |
| PL akta 4 parts (A/B/C/D) | PL akta **5 parts (A–E)** since 2023 — cz. E added for badania trzeźwości (sobriety checks) | 2023 KP amendment | The canonical 4-section enum (D-01) maps A/B/C/D; cz. E is a registry extension if PL sobriety docs are in scope — **flag to user** (Assumptions Log A8) |

**Deprecated/outdated:**
- IRS FIRE e-file path (unrelated to AKTA but a sibling-phase note): decommissioned 2026-12-31 — not relevant here.
- Treating "personnel file retention" as a single number per jurisdiction — modern compliance models it as per-section + per-event-anchor (which is exactly why D-04 specifies anchors).

## Assumptions Log

> Every statutory window, section taxonomy, and RBAC-matrix entry below is `[ASSUMED]` from training knowledge and the CONTEXT-locked success criteria. Per REQUIREMENTS.md line 26 (Standing Constraint) + the local-only/legal-deferred posture, ALL of these ship as **seeded data with "needs jurisdiction legal/tax adviser verification" annotations**. They are NOT verified facts. The planner must (a) carry the adviser-verify annotation into every retention/section copy string and (b) treat these as confirmable-by-user, not locked.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | PL akta retention: 10yr (hires after 2018-12-31, from end of year employment ended) / 50yr legacy — KP art. 94⁵ + e-akta reform (ustawa z 10.01.2018) | Retention | Early erasure of a legally-held file = RODO/KP violation |
| A2 | DE: 10yr tax/payroll (§147 AO, §257 HGB, §41 EStG Lohnkonto) / 30yr accident/occupational-exposure records | Retention | Misclassified DE window; 30yr "accident" basis is the weakest cite — verify exact ArbMedVV/DGUV reference |
| A3 | UK: 6yr general (Limitation Act 1980) / 7yr financial | Retention | HMRC PAYE is often cited as 3yr; the 6/7 split is the success-criterion figure — verify |
| A4 | US I-9: max(HIRE+3y, TERMINATION+1y), 8 CFR 274a.2(b)(2)(i)(A) | Retention | Highest-confidence of the four (well-established federal rule) but still adviser-verify |
| A5 | PL section taxonomy cz. A (recruitment) / B (employment course) / C (termination) / D (disciplinary) per KP §94 + rozporządzenie MRPiPS 10.12.2018 | Section | Wrong doc→section assignment = RBAC exposure |
| A6 | DE/UK have NO statutory section structure — A/B/C/D is a conceptual mapping (Stammdaten / Vertrag-Entgelt / Bescheinigungen / Abmahnungen for DE) | Section | Over-stating statutory basis for DE/UK sections |
| A7 | US I-9 must be stored SEPARATELY from the general personnel file (ICE inspection best practice) | Section | Conflating I-9 with section A |
| A8 | PL added cz. E (sobriety checks) in 2023 → akta is now 5 parts, not 4 | Section / model | The 4-section enum may need a cz. E extension for PL sobriety docs |
| A9 | Recommended section→HR-role matrix (hr_admin all; hr_manager A/B/D + read C; payroll_officer C; leave_approver A) | RBAC | Wrong grant = either over-exposure or broken HR workflow — confirm with user |
| A10 | Classifier confidence threshold = 85/100 with a margin-over-second-best check | Classifier | Too low → mis-filed sensitive docs; too high → everything routes to admin |
| A11 | Killswitch key `killswitch.ai-personnel-classifier` (default-on, killWhenUnknown, not signoff-gated) | Classifier | Naming/registration only — low risk |

**Threshold rationale (A10):** misclassifying a discipline doc (B/D) into the pay section (C) is a privacy/RBAC breach, so the system should bias toward routing-to-admin. The invoice OCR uses a 0–100 confidence scale (`ocr.ts:22`); recommend the section classifier auto-assign only when top-section confidence ≥ 85 AND (top − second) ≥ 15; otherwise `PENDING_REVIEW`. Planner sets the final number.

## Open Questions

1. **Where does the hire-date anchor come from?**
   - What we know: Worker has `status String?` but no dates; P90 `EmployeeProfile` (mid-execution) promotes "employment status" + `etat` + Saudization but the hire/start-date column is not yet confirmed in the live tree.
   - What's unclear: whether P90 lands a `hireDate`/`employmentStartDate` the retention resolver can read.
   - Recommendation: the planner verifies the P90 `EmployeeProfile` final columns at plan time; if no hire date exists, P91 adds a nullable `hireDate` on `PersonnelFile` (set at file creation) as the HIRE_DATE anchor. DOCUMENT_DATE comes from `PersonnelFileDocument.documentDate` (new column) or `Document.createdAt` fallback.

2. **One model or two for sections?**
   - What we know: D-01 leans canonical enum + registry; the section can be an enum on the document link.
   - Recommendation: `PersonnelFileDocument { section SECTION_A|B|C|D }` (enum-on-link); no separate `PersonnelFileSection` table. RBAC keys on the enum literal.

3. **Extend `gdpr.ts` or add a `personnelFile.requestErasure`?**
   - Recommendation: NEW per-employee procedure (the org-wide one stays). Reuse `RETENTION_CITATIONS` + the `retainedUnderStatute` audit idiom at per-section grain.

4. **PL cz. E (sobriety) — in scope?** See A8. Recommend confirming with the user; default to A/B/C/D and leave the enum extensible.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Anthropic API (Claude Vision) | Section classifier (D-07) | ✓ (wired in `ClaudeOcrAdapter`) | `claude-sonnet-4-6` default (`CLAUDE_OCR_MODEL_ID` override) | killswitch off → admin classify-step |
| QStash | Async classification dispatch | ✓ (`getQStashClient`, used by invoice OCR) | workspace | — |
| Unleash (feature flags) | killswitch eval | ✓ (regional clients) | workspace | killWhenUnknown → AI off → admin step |
| R2 / regional storage | Document bytes for classification | ✓ (`createPresignedDownloadUrl`) | workspace | — |
| Postgres + Prisma 7 | `PersonnelFile` model | ✓ | PG17 / Prisma 7 (`prisma-client`) | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** AI classification gracefully degrades to the admin step by design (D-07).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via Turborepo) |
| Config file | per-package `vitest.config.*` |
| Quick run command | `pnpm --filter @contractor-ops/api test <path/to/file.test.ts>` (scope by path) |
| Full suite command | `pnpm test` (turbo → vitest) |
| **Memory caveat (MEMORY.md)** | NEVER run the full web-vite suite unscoped — `pnpm --filter @contractor-ops/web-vite test <path>` only. Backend tests run in `packages/api` / `packages/db` / `packages/compliance-policy`. |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AKTA-01 | hr_admin reads section B; payroll_officer CANNOT read B (negative/BFLA) | unit | `pnpm --filter @contractor-ops/api test personnel-file-rbac.test.ts` | ❌ Wave 0 |
| AKTA-01 | owner is NOT auto-granted any `employeeFileX` (BFLA fence) | unit (structural, read `roles.ts` allPermissions) | same file | ❌ Wave 0 |
| AKTA-02 | PL post-2019 cutoff = end-of-year-of-termination + 10y; DE/UK windows | unit | `pnpm --filter @contractor-ops/db test personnel-retention.test.ts` | ❌ Wave 0 |
| AKTA-02 | US I-9 `max(HIRE+3y, TERMINATION+1y)` math | unit | same file | ❌ Wave 0 |
| AKTA-02 | active employee (termination=null) → indefinite retain (cutoff null) | unit | same file | ❌ Wave 0 |
| AKTA-03 | per-section disposition: erased past window, retained-with-citation under hold | unit | `pnpm --filter @contractor-ops/api test personnel-erasure.test.ts` | ❌ Wave 0 |
| AKTA-03 | `fullErasureClaimed === false` whenever ANY section retained (never-over-claim invariant) | unit | same file | ❌ Wave 0 |
| AKTA-04 | deterministic taxonomy hit → section assigned, no AI call | unit | `pnpm --filter @contractor-ops/api test personnel-classifier.test.ts` | ❌ Wave 0 |
| AKTA-04 | ambiguous → AI fallback path invoked | unit | same file | ❌ Wave 0 |
| AKTA-04 | killswitch OFF / Unleash-unreachable → routes to PENDING_REVIEW admin step, upload NOT blocked | unit | same file | ❌ Wave 0 |
| AKTA-04 | AI confidence < threshold → PENDING_REVIEW | unit | same file | ❌ Wave 0 |
| (cross-cutting) | `PersonnelFile` cross-org leak regression (ORG_A never sees ORG_B file) | unit | `pnpm --filter @contractor-ops/api test personnel-file-tenant-isolation.test.ts` | ❌ Wave 0 — model on `worker-tenant-isolation.test.ts` |

### Sampling Rate
- **Per task commit:** the scoped quick-run for the touched package (`pnpm --filter <pkg> test <file>`).
- **Per wave merge:** `pnpm --filter @contractor-ops/api test && pnpm --filter @contractor-ops/db test && pnpm --filter @contractor-ops/compliance-policy test`.
- **Phase gate:** full suite green before `/gsd:verify-work`; plus `pnpm typecheck` (tsc, CI-canonical) + `pnpm check:wiki-brain`.

### Wave 0 Gaps
- [ ] `packages/api/src/__tests__/personnel-file-rbac.test.ts` — covers AKTA-01 (per-section incl. negative/BFLA + owner-fence)
- [ ] `packages/db/src/__tests__/personnel-retention.test.ts` — covers AKTA-02 (4 jurisdictions + max() + indefinite)
- [ ] `packages/api/src/__tests__/personnel-erasure.test.ts` — covers AKTA-03 (per-section disposition + never-over-claim)
- [ ] `packages/api/src/__tests__/personnel-classifier.test.ts` — covers AKTA-04 (taxonomy hit / AI fallback / killswitch-off→admin / low-confidence→admin)
- [ ] `packages/api/src/__tests__/personnel-file-tenant-isolation.test.ts` — cross-org leak (clone `worker-tenant-isolation.test.ts` mock-Prisma harness, VERIFIED at `:294-353`)
- [ ] `packages/compliance-policy/src/__tests__/personnel-registry.test.ts` — registry registers PL/DE/UK/US sections + retention rules on import; no duplicate-id throw

*(No framework install needed — Vitest is the established runner across all target packages.)*

## Security Domain

`security_enforcement` is not set to `false` in `.planning/config.json` → treated as ENABLED.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture / Data Protection | yes | Personnel files are special-category personal data (RODO Art. 9). Retention windows + RODO erasure ARE the data-protection control |
| V4 Access Control | **yes (core)** | Per-section RBAC via Better-Auth `accessControlStatement` + `requirePermission`; BOLA/BFLA the central threat (a payroll role must never reach section B). Tenant scope via `withTenantScope` |
| V5 Input Validation | yes | Zod `.strict()` on every new procedure (block `organizationId`/`workerType`/`section` injection); validate uploaded `documentType` |
| V7 Error Handling / Logging | yes | `writeAuditLog` on erasure + section reveal + classify-approve (sensitive mutations); structured Pino logging, never `console.*`; never log file contents/PII |
| V8 Data Protection at Rest | yes | Documents stored via existing R2/regional-storage; retention-guarded soft-delete; AuditLog append-only (`allowAuditPurge` only on erasure path, `rls.ts:42`) |
| V12 Files & Resources | yes | Upload path already has virus-scan gate (`document.ts:359`); classifier reads via presigned URL, not public access |
| V6 Cryptography | no (new) | No new crypto in P91; PII national-ID encryption is P90's concern |
| V2 Authentication / V3 Session | no (new) | Reuses existing Better-Auth session + tenant procedure |

### Known Threat Patterns for {Worker/Employee personnel-file stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-section read (payroll role sees discipline) | Information Disclosure / Elevation | Per-section `requirePermission` at the permission layer (D-02); negative tests |
| `owner` silently auto-granted sections (BFLA) | Elevation | Keep `employeeFileX` out of `roles.ts` `allPermissions` const; structural test |
| Cross-org file read (IDOR) | Information Disclosure | Tenant-owning model + `withTenantScope` + cross-org leak regression test |
| Erasure over-claim during hold (repudiation) | Repudiation | Per-section disposition + `fullErasureClaimed:false` + `erasure_retained_under_statute` audit |
| Early erasure of a held file | Tampering | Retention resolver gates the soft-delete/purge; never purge inside the window |
| Mass-assignment of `section`/`workerType`/`organizationId` | Tampering | Zod `.strict()` DTOs; server-set tenant + section from the authorized path |
| Malicious upload routed to AI | — | Existing virus-scan gate + size cap (`MAX_PDF_SIZE_BYTES`) before any Claude call |
| Unleash outage leaves AI running on PII | Information Disclosure | killWhenUnknown forces classifier OFF → admin step (fail-safe) |

## Documentation-Follows-Code (update in the SAME change set — CLAUDE.md gated)

Per CLAUDE.md the change is incomplete until these land in the same commit set (enforced by `pnpm check:wiki-brain` + Stop hook):
- `.planning/brain/wiki/domains/` — new worker/personnel-file domain page (Purpose, Flow, Entry points, UI surface, Agent mistakes).
- `wiki/structure/prisma-schema-areas.md` (PersonnelFile/sections), `key-services.md` (retention resolver + classifier), `api-routers-catalog.md` (personnel-file router; verify `root.ts` workforce spread).
- `wiki/patterns/` — rbac-permissions.md (per-section grain), audit-log.md, feature-flags.md (classifier killswitch).
- `wiki/log.md` + overwrite `wiki/hot.md`; bump `source_commit` on touched pages.
- `.planning/MEMORY.md` — three invariants: (1) per-section RBAC grain (resource-per-section, never to owner), (2) shared-retention-map + new anchor resolver (no parallel engine), (3) per-section statutory-hold erasure never over-claims.
- `graphify` graph auto-rebuilds via `.husky/post-commit` on apps/packages changes.

## Sources

### Primary (HIGH confidence — read in-session against the live tree)
- `packages/db/src/retention-policy.ts` (full) — flat years map, `getRetentionCutoff` semantics
- `packages/db/src/soft-delete.ts` (full) — `softDeleteModels`, `isRetentionGuarded` retention guard
- `apps/cron-worker/src/jobs/handlers/data-purge.ts` (full) — `cutoffFor`, base-client hard-delete path
- `packages/api/src/routers/compliance/gdpr.ts` (full) — `requestErasure`, `RETENTION_CITATIONS`, `retainedUnderStatute`, `allowAuditPurge`
- `packages/compliance-policy/src/{doc-registry,registry,jurisdiction-resolver,types,index}.ts` — register-on-import idiom + `Jurisdiction` enum + side-effect wiring
- `packages/auth/src/{permissions,roles}.ts` — `accessControlStatement`, 4 HR roles, owner `allPermissions` fence
- `packages/api/src/middleware/rbac.ts` + `packages/api/src/lib/scope-utils.ts` — `requirePermission`, `permissionToScopes`
- `packages/api/src/services/ocr-extraction.ts` + `packages/integrations/src/{types/ocr.ts,adapters/claude-ocr-adapter.ts}` — killswitch idiom + Claude adapter
- `packages/feature-flags/src/flags-core.ts` + `evaluator.ts` — killswitch declaration + `evaluate` return shape
- `packages/db/prisma/schema/{worker,contract}.prisma` + `packages/db/prisma/schema/contractor.prisma:64-72` — Worker root, `Contractor.workerId @unique` FK, `Document`/`DocumentLink`/`DocumentType`/`DocumentStatus`
- `packages/db/src/{index,tenant,rls}.ts` — `createTenantClient` chain, `globalModels`, `allowAuditPurge`
- `packages/api/src/root.ts:160-198` + `routers/core/{employee,worker}.ts` — flag-gated workforce mount + `assertWorkforceEnabled`
- `packages/api/src/routers/compliance/compliance-admin.ts:233-340` — `PENDING_REVIEW` approve/reject pattern
- `packages/api/src/__tests__/worker-tenant-isolation.test.ts` (full) — the cross-org leak regression harness to clone
- `.planning/config.json` — `nyquist_validation: true`, no `security_enforcement: false`

### Secondary (MEDIUM — CONTEXT-locked, used as scope constraints)
- `.planning/phases/91-…/91-CONTEXT.md` (D-01..D-07 + canonical_refs), `90-CONTEXT.md`, `89-CONTEXT.md`, `.planning/REQUIREMENTS.md` (AKTA-01..04, line 26 legal posture)

### Tertiary (LOW — training knowledge, ALL adviser-verify)
- PL KP art. 94⁵/§94 + e-akta reform (10/50yr), 2018 rozporządzenie section structure, 2023 cz. E amendment — Assumptions A1, A5, A8
- DE §147 AO / §257 HGB / §41 EStG + occupational-exposure 30yr — A2
- UK Limitation Act 1980 6yr / 7yr financial — A3
- US I-9 8 CFR 274a.2(b)(2)(i)(A) max-rule + separate-storage best practice — A4, A7

## Metadata

**Confidence breakdown:**
- Standard stack (internal primitives + extension points): HIGH — every canonical_ref read against the live tree; signatures quoted verbatim.
- Architecture (model shape, RBAC grain, classifier flow, erasure grain): HIGH — grounded in verified signatures; the few open choices are flagged as Claude's-discretion with a prescriptive lean.
- Retention rule structure / gap analysis: HIGH — the flat-map limitation is verified by reading `getRetentionCutoff` + all three chokepoints.
- Statutory windows + section taxonomies: LOW — training knowledge, legal-deferred; ALL tagged `[ASSUMED]`/adviser-verify (Assumptions A1–A8). This is by design (REQUIREMENTS line 26), not a research gap.

**Research date:** 2026-07-01
**Valid until:** ~2026-08-01 for code-surface findings (stable monorepo); statutory items have no expiry — they require adviser sign-off regardless of date.
