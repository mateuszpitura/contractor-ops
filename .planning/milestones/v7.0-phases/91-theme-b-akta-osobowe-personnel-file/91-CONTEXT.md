# Phase 91: Theme B — Akta Osobowe / Personnel File - Context

**Gathered:** 2026-07-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Each employee has a **jurisdiction-correct personnel file** ("akta osobowe") attached to the
Phase-89/90 `Worker`/`Employee` abstraction, delivering four locked requirements (AKTA-01..04):

1. **4-section structure** (PL cz. A/B/C/D per KP §94; DE Personalakte / UK personnel file /
   US I-9 + file equivalents) with **per-section RBAC**.
2. **Per-jurisdiction retention engine** (PL 10yr post-2019 / 50yr legacy, DE 10yr tax / 30yr
   accident, UK 6yr general / 7yr financial, US I-9 3yr-post-hire-or-1yr-post-termination).
3. **RODO/GDPR erasure** that honors erasure only past the retention window and flags blocked
   sections with a statutory citation — never claims full erasure during a hold.
4. **Document upload auto-classification** to section A/B/C/D; ambiguous document triggers an
   admin classify-step.

**HARD DEPENDENCY:** Phase 90 (`EmployeeProfile`) must land first — the personnel file attaches
to the employee identity (`workerId`). At context-gathering time Phase 90 is mid-execution (3/7
plans); this context can be planned, execution waits on 90.

**NOT this phase:** leave/time (P92), on/offboarding (P93 — supplies the termination event the
retention clock anchors on, but P91 only consumes it where present), payroll export (P94),
HRIS sync (P95), the **employee self-service portal akta view** (P96 — staff-side file view only
here, `EMP-PORTAL-02` personal akta view is P96), HR dashboard (P97).
</domain>

<decisions>
## Implementation Decisions

### Section Model + Per-Section RBAC (AKTA-01)
- **D-01 (Claude's discretion — lean recorded):** Section model is planner's discretion. **Lean:
  a canonical internal 4-section enum (`SECTION_A|B|C|D`) + a seeded per-jurisdiction registry**
  that maps display labels and doc-type→section assignment per country (PL cz. A/B/C/D, DE
  Personalakte groupings, UK personnel-file groupings, US I-9+file groupings). This keeps RBAC,
  retention, and classification uniform with jurisdiction nuance in seed data — matching the P90
  country-fields-registry idiom. **Constraint (locked): a 4-section view + per-section RBAC must
  hold** regardless of the model chosen.
- **D-02 (locked):** **Per-section RBAC is a NEW permission grain** — add a section dimension to
  the access check (e.g. `employeeFile:read` scoped to `{A,B,C,D}`), so a payroll role can see
  section C (pay) without section B (discipline). This is a genuine new primitive — today RBAC is
  resource-level only (`packages/auth/src/permissions.ts:12`); the finest existing grain is
  splitting into separate resources (`contractorPii` vs `employee`). Wire the section→role map
  into the **4 HR roles from P89** (`hr_admin`, `hr_manager`, `payroll_officer`, `leave_approver`)
  without weakening the P89 BFLA fence (never auto-granted to `owner`, never a contractor mutation).
  Planner decides resource-per-section vs sub-resource/attribute layer; per-section access MUST be
  enforced at the permission layer, not only filtered in app logic.

### Retention Engine + Clock (AKTA-02)
- **D-03 (locked — codebase-mandated):** **Extend the shared retention primitive — do NOT build a
  parallel engine.** Per-jurisdiction personnel-file rules register on the SAME
  `packages/db/src/retention-policy.ts` map (`RETENTION_YEARS` / `RetainedRecordType` /
  `MODEL_RETENTION_TYPE` / `getRetentionCutoff`), which is read by all three deletion chokepoints
  (soft-delete extension, data-purge cron, GDPR erasure). The source comment explicitly invites
  Phase 91 to register on it. The per-jurisdiction **rule registry** lives as a new register-on-
  import module in `packages/compliance-policy/src/` (alongside `doc-registry.ts` / `registry.ts`),
  feeding `RetainedRecordType` tokens + `MODEL_RETENTION_TYPE` entries into the shared map.
- **D-04 (locked):** **Per-rule, event-typed retention clock anchor.** Each retention rule declares
  its own anchor: `HIRE_DATE | TERMINATION_DATE | DOCUMENT_DATE`, with a `max()` combinator for
  US I-9 (`max(HIRE+3y, TERMINATION+1y)`, 8 CFR 274a.2). While the employee is active (no
  termination event), the file is **retained indefinitely**; the clock starts at the anchor event.
  Termination anchor reads the offboarding/termination event (P93) when present. Each rule carries
  a **statutory citation**.
- **D-05 (locked):** **Enforcement = soft-delete + scheduled archive**, reusing the existing
  chokepoints (`packages/db/src/soft-delete.ts` retention guard + `apps/cron-worker` data-purge
  cron). No bespoke deletion path.

### RODO / GDPR Erasure with Statutory Holds (AKTA-03)
- **D-06 (Claude's discretion — lean recorded):** Erasure resolution is planner's discretion.
  **Lean: per-section partial erasure** — erase each section past its retention window, retain
  sections still under a statutory hold and return them with their citation; the response is a
  per-section disposition list. **Constraint (locked — success criterion #3 verbatim): honor
  erasure only past the retention window, flag blocked sections with a statutory citation, and
  NEVER claim full erasure while any hold is active.** Extend the existing statutory-hold mechanism
  in `gdpr.ts` (`RETENTION_CITATIONS`, soft-delete-with-exemption, `retainedUnderStatute` summary)
  from its current whole-**org** + whole-**model** grain to **per-employee + per-section + per-
  jurisdiction**. This is a partial new build — the concept exists, the grain does not.

### Document Upload Classification (AKTA-04)
- **D-07 (locked):** **Hybrid classification — taxonomy-first, AI fallback, admin last.**
  (a) Deterministic map first: existing `DocumentType` enum + uploader-chosen doc-type → section
  via the per-jurisdiction registry (D-01). (b) On map miss/ambiguous doc-type, fall back to a
  **Claude-Vision section classifier** (extend `packages/api/src/services/ocr-extraction.ts`;
  today OCR only does `extractInvoice` — the section classifier is a new build). (c) Below a
  confidence threshold → **admin classify-step**, reusing the existing `PENDING_REVIEW` document
  status + portal upload-approval flow. The AI path MUST gate on a kill-switch following the
  `killswitch.ai-invoice-parser` idiom (off / Unleash-unreachable → skip AI, route straight to the
  admin step; never block the upload). Planner sets the confidence threshold + killswitch key.

### Claude's Discretion
- Section model shape (D-01) — canonical-enum+registry vs native-per-jurisdiction; constraint =
  4-section view + per-section RBAC.
- Erasure resolution (D-06) — per-section partial vs all-or-nothing-with-hold-block; constraint =
  criterion-3 exactly.
- `PersonnelFile` model shape: dedicated model FK'd to `workerId` (identity root) vs a relation on
  the P90 `EmployeeProfile`; the section/document join shape; whether sections are rows or an enum
  on the document link.
- AI section-classifier confidence threshold + killswitch registry key + the doc-type→section seed
  taxonomy per jurisdiction.
- Resource-per-section vs sub-resource/attribute layer for the per-section RBAC grain (D-02).
- Staff-side file-viewer composition (reuse of `components/documents/*`).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone planning
- `.planning/REQUIREMENTS.md` — AKTA-01..04 verbatim (lines 100-105); line 26 (legal sign-off
  posture: akta/Personalakte retention text ships with "needs jurisdiction legal/tax adviser
  verification" annotations — Standing Constraint).
- `.planning/ROADMAP.md` (Phase 91 entry) — goal + 4 success criteria + research flag (composes
  with v6.0 F1 compliance-document engine + document infra; legal annotation required on retention
  copy) + UI hint = yes.
- `.planning/phases/90-theme-b-employee-registry-per-market-6/90-CONTEXT.md` — the `EmployeeProfile`
  the file attaches to (HARD dependency); `module.workforce-employees` flag; PII/encrypt/reveal +
  per-market registry idioms carried forward.
- `.planning/phases/89-theme-b-worker-model-abstraction-serial-gate/89-CONTEXT.md` — `Worker`
  identity root + `employee` RBAC resource + 4 HR roles + BFLA fence the per-section grain extends.

### Retention engine (extend, do not rebuild)
- `packages/db/src/retention-policy.ts` (`RETENTION_YEARS` :13, `RetainedRecordType`,
  `MODEL_RETENTION_TYPE`, `getRetentionCutoff`; comment lines 4-5/16-17 invite Phase 91 to register
  on the same map) — the shared retention primitive (D-03/D-04).
- `packages/db/src/index.ts:31` — public retention exports.
- `packages/db/src/soft-delete.ts` (`softDeleteModels` :26, `isRetentionGuarded` :72) — soft-delete
  chokepoint (D-05).
- `apps/cron-worker/src/jobs/handlers/data-purge.ts` (`cutoffFor` :43, uses `getRetentionCutoff`
  :24) — scheduled archive/purge chokepoint (D-05).

### RODO/GDPR erasure + statutory hold (extend grain)
- `packages/api/src/routers/compliance/gdpr.ts` (`requestErasure` :74/:89; `RETENTION_CITATIONS`
  :23; `isRetained`/`recordRetention` :106-116; `retainedUnderStatute` summary :315-332;
  `organization.erasure_retained_under_statute` audit :141-146) — the statutory-hold mechanism to
  extend from org/model grain to per-employee/per-section/per-jurisdiction (D-06).
- `packages/db/src/rls.ts:32` — `allowAuditPurge` gate (AuditLog append-only; only GDPR path sets
  it).

### v6.0 F1 compliance-document engine (closest analog for per-jurisdiction required-docs)
- `packages/compliance-policy/src/doc-registry.ts` (`registerComplianceDoc` :19, `BASELINE_DOCS`
  :44, jurisdiction DE/UK/PL/US/AE/SA) — the register-on-import per-jurisdiction registry shape to
  mirror for the section/retention rules registry.
- `packages/compliance-policy/src/registry.ts:34` (`resolvePolicyRules`), `jurisdiction-resolver.ts`
  (`mapIsoToJurisdiction`, `Jurisdiction`) — per-jurisdiction resolver.
- `packages/db/prisma/schema/contractor.prisma` (`ComplianceRequirementTemplate` :251,
  `ContractorComplianceItem` :267 — status/severity/satisfiedByDocumentId,
  `ContractorComplianceReminderState` :306) — the per-instance required-doc model analog.
- `packages/api/src/services/compliance-dashboard.ts:111`,
  `packages/api/src/routers/compliance/compliance-admin.ts` — service + admin router patterns.

### Document infrastructure + classification
- `packages/db/prisma/schema/contract.prisma` (`Document` :130 — storageKey/checksumSha256/
  `documentType`/status/virusScanStatus/encrypted/deletedAt; `DocumentType` enum :233;
  `DocumentStatus` ACTIVE/PENDING_REVIEW/SUPERSEDED/EXPIRED/ARCHIVED :250; `DocumentLink`
  polymorphic attach :161) — the document model the file is built on.
- `packages/api/src/routers/core/document.ts` (virus gate :359, scan-result :136, list :410) +
  `services/r2.ts` / `services/regional-storage.ts` / `services/pending-upload.ts:28` — upload +
  presign + virus-scan + PENDING_REVIEW flow (admin classify-step reuse, D-07).
- `packages/api/src/services/ocr-extraction.ts:90` (`processOcrExtraction`),
  `packages/integrations/src/adapters/claude-ocr-adapter.ts:232`,
  `packages/integrations/src/types/ocr.ts:54` — the Claude-Vision path to extend for the section
  classifier (D-07; today invoice-extraction only). Kill-switch idiom: `killswitch.ai-invoice-parser`.

### Worker / Employee + RBAC
- `packages/db/prisma/schema/worker.prisma:17` (`Worker` identity root; `// employee Employee?`
  commented stub :32) — the `workerId` attach point.
- `packages/api/src/routers/core/employee.ts`, `routers/core/worker.ts`, `root.ts:175` (flag-gated
  workforce router registration) — where the personnel-file router mounts.
- `packages/auth/src/permissions.ts:49` (`employee` resource), `packages/auth/src/roles.ts` (4 HR
  roles), `packages/api/src/middleware/rbac.ts:19` (`requirePermission`) — the RBAC surface the
  per-section grain extends.

### UI (web-vite)
- `apps/web-vite/src/components/documents/` (`document-list.tsx`, `document-card.tsx`,
  `version-history.tsx`, `pdf-preview.tsx`, `drop-zone.tsx`; hook `hooks/use-document-list.ts:11`)
  — the reusable file-viewer family; build new only the 4-section personnel-file shell.
- `apps/web-vite/src/components/ocr/pdf-viewer.tsx`, `components/compliance/`,
  `components/contractors/classification-documents/` — viewer + review-queue analogs.

### Documentation-follows-code (update in the SAME change set)
- `.planning/brain/wiki/domains/` (new worker/personnel-file domain page),
  `wiki/structure/{prisma-schema-areas.md (PersonnelFile/sections), key-services.md (retention +
  classifier), api-routers-catalog.md (personnel-file router)}`,
  `wiki/patterns/{rbac-permissions.md (per-section grain), audit-log.md, feature-flags.md
  (classifier killswitch)}`, `wiki/log.md` + overwrite `hot.md`; `.planning/MEMORY.md` (per-section
  RBAC grain + shared-retention-map + per-section statutory-hold erasure invariants);
  `pnpm check:wiki-brain`.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Shared retention primitive** (`packages/db/src/retention-policy.ts`) — register per-jurisdiction
  tokens on the same map; 3 chokepoints already consume it (D-03/D-05).
- **GDPR statutory-hold mechanism** (`gdpr.ts` soft-delete-with-exemption + `RETENTION_CITATIONS`)
  — extend grain to per-employee/per-section (D-06).
- **v6.0 F1 required-docs registry** (`compliance-policy/doc-registry.ts` register-on-import) — the
  shape to mirror for the section + retention rules registry.
- **Document stack** (`Document` + `DocumentLink` polymorphic + virus-scan + presign +
  `PENDING_REVIEW` status) — the file is built on it; admin classify-step reuses PENDING_REVIEW.
- **Claude-Vision OCR** (`ocr-extraction.ts`) — extend for the section classifier behind a
  kill-switch (D-07).
- **`components/documents/*` UI family** (list/card/drop-zone/version-history/pdf-preview) — reuse
  for the file viewer.

### Established Patterns
- **Register-on-import per-jurisdiction registry keyed by `Jurisdiction`** (e-invoice, classification,
  compliance-policy) — the canonical config pattern for the section + retention rules.
- **No parallel retention engines** — one shared map, 3 chokepoints (codebase invariant).
- **AI behind a kill-switch** (`killswitch.ai-invoice-parser`, default-on, kill-when-unknown) —
  the classifier follows it.
- **New tenant-owning model never in `globalModels` + cross-org leak test** (every prior tenant
  model — applies to `PersonnelFile`).
- **`writeAuditLog` on sensitive mutations; statutory text adviser-verify annotated; i18n parity
  en/en-US/de/pl/ar; web-vite layering (hook = sole tRPC boundary, no `*-container.tsx`).**

### Integration Points
- `PersonnelFile` FK → `Worker.workerId` (or P90 `EmployeeProfile`); gated by
  `module.workforce-employees`.
- Section/retention rules registry (compliance-policy) → tokens into `retention-policy.ts` map →
  consumed by soft-delete + data-purge cron + gdpr erasure.
- Upload → taxonomy map → AI classifier (killswitch) → PENDING_REVIEW admin step.
- Per-section RBAC grain → P89 `employee` resource + 4 HR roles.

</code_context>

<specifics>
## Specific Ideas

- **Compose, don't rebuild** — the retention map, GDPR statutory-hold, v6 F1 required-docs registry,
  and Document stack already solve most of the mechanics; Phase 91 is mostly *registering* on those
  primitives + three genuine new builds.
- **Three genuine new builds** (scout-confirmed, no existing primitive): (1) per-section RBAC grain,
  (2) per-employee + per-section + per-jurisdiction statutory-hold erasure, (3) document→section
  AI classifier + admin-fallback review queue.
- **Legally honest erasure** — the response must never claim full erasure while a hold is active;
  per-section dispositions with statutory citations are the defensible shape.
- **Local-only / legal-deferred** — retention windows + section taxonomies ship as seeded data with
  adviser-verify annotations; no live government calls.

</specifics>

<deferred>
## Deferred Ideas

- **Employee self-service personal akta view** → P96 (`EMP-PORTAL-02`); P91 is staff-side only.
- **Termination event source** → P93 on/offboarding supplies it; P91 consumes the termination
  anchor where present and retains indefinitely while active.
- **Live government retention/registry lookups** → seeded reference data only (local-only).
- **Native per-jurisdiction section model** (vs canonical enum) → folded into D-01 discretion, not a
  separate phase.

None expand the phase scope — discussion stayed within the personnel-file boundary (AKTA-01..04).

</deferred>

---

*Phase: 91-theme-b-akta-osobowe-personnel-file*
*Context gathered: 2026-07-01*
