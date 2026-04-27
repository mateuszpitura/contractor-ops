# Phase 73: F1 Compliance — Admin Dashboard + Portal Self-Service + i18n - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Surface the Phase 71 + 72 compliance engine to humans:

1. **Admin dashboard** at `/compliance/dashboard` — three KPI cards (at-risk contractor count, upcoming-renewal count, blocked-payments count) + a tabbed table region driven by the same three queries. All indexed (no N+1).
2. **Contractor portal self-service** — new `/portal/compliance` sub-route + a one-click upload-replacement flow triggered from the in-app notification deep-link. The portal cron emit is owned by Phase 72; Phase 73 ships only the contractor-side rendering surface and the upload flow.
3. **Manual admin override → WAIVED** — gated by a new `compliance:override` permission (default OWNER + ADMIN), surfaced from both the `/compliance/dashboard` table rows and the contractor profile Compliance tab. Closed-enum reason category + free-text rationale, audit-logged with inline timeline visible on the Compliance tab.
4. **i18n parity** — new per-jurisdiction modules in the existing `packages/validators/src/legal/` locked-phrase registry (`compliance-uk.ts`, `compliance-de.ts`, etc.), keyed by `policyRuleId`, with en/pl/de phrase maps. Every entry ships PENDING in `signoff-registry.json` per Phase 70 D-09; Arabic is Phase 79's job.

Phase 73 is purely a surface layer over Phase 71 + 72. No new schema (the Compliance tab inline timeline reads existing `audit_log`; the override `WAIVED` flow uses Phase 71 D-11's existing `WaivedReason` enum). Out of scope: Arabic / RTL (Phase 79), schema migrations (no new tables/columns), changes to the reminder cron or payment-gate engine. Legal verification of the new locked-phrase entries is DEFERRED per Standing Project Constraints.

</domain>

<decisions>
## Implementation Decisions

### Admin dashboard — composition, semantics, drilldown

- **D-01:** `/compliance/dashboard` (under `(dashboard)` route group) renders a 3-up KPI summary card row + a single tabbed table region beneath. Three cards: "At risk", "Upcoming renewals", "Blocked payments". Three matching tabs in the table region. Card click switches the active tab. Default tab on landing = "At risk". Reuses the existing v1.0 dashboard KPI-card pattern + v3.0 tabbed-table idiom (no new shared components).
- **D-02:** "At risk" filter semantics:
  ```sql
  WHERE severity = 'BLOCKING'
    AND status != 'WAIVED'
    AND (
      status IN ('MISSING','EXPIRED')
      OR (status = 'SATISFIED' AND expiresAt <= now() + interval '30 days')
    )
  ```
  Excludes WAIVED. Captures both currently-failing items AND items approaching the 30-day reminder band. Matches the v5 economic-dependency "warning" band semantics so admins building mental models from v5 → v6 work. INDEX REQUIRED: `@@index([severity, status, expiresAt])` on `ContractorComplianceItem` for the dashboard query path. (Phase 72 may already add a similar index for the eligibility check; Researcher to dedupe.)
- **D-03:** "Upcoming renewals" tab: same severity filter, but ordered by `expiresAt ASC`, capped at 90 days forward (`expiresAt <= now() + 90 days AND status = 'SATISFIED'`). Lists the renewal queue contractors will hit if they don't act.
- **D-04:** "Blocked payments" tab data source — TWO sources merged, deduped by `paymentRunId`:
  - **Live source:** `assertContractorPaymentEligibility` re-run over all DRAFT `PaymentRun`s for the org (catches "this run will fail when admin hits Export").
  - **Historical source:** `PaymentRunComplianceCheck WHERE eligibilityVerdict = 'FAIL' AND snapshottedAt >= now() - 7 days` (catches recent failed export attempts; Phase 72 D-19 ensures these rows exist).
  - Refresh on page load + 60s polling. Uses Phase 72 D-10's `contractorReasons[]` payload shape directly so the dashboard renders the same per-contractor / per-doc grouping as the wizard error modal.
- **D-05:** Drilldown pattern — every table row click navigates to `/contractors/{id}/compliance#item-{itemId}` (the existing Compliance tab + scroll-to-anchor). The Compliance tab is the canonical per-contractor surface; Phase 71 already added the "Recompute" button there; Phase 73 adds the "Override" button (D-09). No drawers, no inline-expand accordions — single source of truth for per-contractor compliance UX. Per-row hover affordances: "Recompute" + "Override" inline buttons (both call existing tRPC mutations).

### Portal self-service — upload-replacement flow

- **D-06:** Upload validation pipeline (no AI verdict for v6.0):
  - MIME whitelist: `application/pdf`, `image/png`, `image/jpeg`. Size cap 10 MB. Both enforced server-side via existing `Document` upload pipeline (already has virus scan, signed-URL R2 PUT).
  - On upload, server creates a `Document` row with `status = PENDING_REVIEW`, `documentType` pre-populated from the `policyRule.documentType` the contractor was invited to replace (deep-link carries `?itemId=...&policyRuleId=...`).
  - `ContractorComplianceItem.status` STAYS `MISSING/EXPIRED` until an admin reviews and approves the upload. Approve flips item to `SATISFIED`, sets `satisfiedByDocumentId`, sets `expiresAt` per D-07.
  - Skipping OCR/Claude Vision on COMPL surfaces is deliberate per Standing Constraint — legal-sensitive verdicts stay human. (Phase 75 IP-clause scanner is a separate AI-on-legal decision under its own feature flag.)
- **D-07:** `expiresAt` source on portal upload: auto-derived from policy template, contractor confirms.
  - Each `policyRule` declares its expiry semantics (UK Right-to-Work share code = upload date + 90 days; DE A1 = upload date + 24 months max; KSA Iqama = upload date + 1 year, etc.). Phase 71 typed-const registry already captures this — Phase 73 adds a `defaultExpiryFromUploadDate` helper.
  - Upload form pre-fills "Expires: <auto-computed>" with an editable date picker. Contractor confirms or overrides (rare — e.g. an A1 issued for less than the 24-month max).
  - Admin reviewing the PENDING_REVIEW upload sees the contractor-provided expiresAt + the policy default in the same field, can adjust before approving. Admin's confirmed value is what writes to `ContractorComplianceItem.expiresAt`.
- **D-08:** Admin rejection flow with structured reason:
  - Reject form: closed-enum category (`wrong_document_type`, `illegible`, `already_expired`, `forged_or_altered`, `other`) + optional free-text. Mirrors Phase 71 D-11's `WaivedReason` enum philosophy.
  - On reject: `Document.status = REJECTED`, `Document.rejectionReason` (new column on `Document`? OR captured in audit log only — see "Claude's Discretion"). `ContractorComplianceItem.status` stays `MISSING/EXPIRED`.
  - Contractor receives a new portal notification + email "Your <document> upload was rejected: <reason>" with a "Re-upload" deep-link button. The original upload-replacement flow re-fires.
  - Audit-log entry `compliance.upload.rejected` with `documentId`, `reasonCategory`, `freeText`, `rejectorUserId`.
- **D-09:** Portal notification trigger — Phase 72 cron is already the emitter; Phase 73 ships only the rendering surface:
  - Phase 72 D-04 `dispatch()` already targets `Contractor.userId` as a recipient via `notification-service.ts`.
  - Phase 73 adds: (a) a new in-app notification template for the contractor-side digest payload (renders "X documents need attention" with per-item rows + per-item "Renew now" deep-link buttons), (b) a new portal route `/portal/compliance/upload-replacement?itemId=...&policyRuleId=...` that the deep-link opens, (c) a portal-home banner if any `ContractorComplianceItem` for the logged-in contractor is in MISSING/EXPIRED or within 30-day band.
  - No duplicate cron, no separate band-state-machine. Phase 73 = pure surface.

### Manual admin override → WAIVED

- **D-10:** Permission scope — new `compliance:override` permission registered in `packages/auth/src/permissions.ts` (mirrors Phase 74 D-03's `workflow:override_blocking_task` registration pattern). Default-granted to OWNER + ADMIN roles. Per-org admins can re-scope to a custom "Compliance Officer" role via existing role customisation. Audit log captures `actor.permissions` snapshot at override time.
- **D-11:** Reason input shape — closed enum + free-text BOTH required:
  - Closed enum `WaivedReasonCategory`: `contractor_offboarded`, `engagement_changed`, `regulatory_exemption`, `temporary_grace_period`, `admin_correction`, `other`. Stored on `ContractorComplianceItem.waivedReasonCategory` (new column, additive nullable).
  - Free-text rationale (min 20 chars, mirrors Phase 74 D-04 OVERRIDE-MIN-CHARS). Stored on `ContractorComplianceItem.waivedReasonNote` (new column, additive nullable).
  - The existing `ContractorComplianceItem.waivedReason` column (Phase 71 D-11 — `WaivedReason` enum) is set automatically to `admin_manual_waive` on override. The new `waivedReasonCategory` + `waivedReasonNote` supplement it for richer audit / future query.
- **D-12:** Override button placement — TWO surfaces, ONE shared modal component:
  - **Compliance tab inline:** each `ContractorComplianceItem` row gets a hover-revealed (keyboard-focusable) "Override" button when the row is BLOCKING + (MISSING / EXPIRED).
  - **Dashboard table rows:** "At risk" + "Blocked payments" tab tables expose the same hover button per row.
  - Both open the same `<OverrideComplianceItemDialog>` modal. The dialog handles tRPC mutation `compliance.overrideItem(itemId, reasonCategory, reasonNote)` — mutation enforces the new `compliance:override` permission and writes the audit log entry per D-13.
- **D-13:** Override audit + history surface — inline timeline on Compliance tab:
  - Every `compliance.overrideItem` mutation emits one `AuditLog` entry: `action = 'compliance.item.overridden'`, `target = itemId`, `payload = { previousStatus, reasonCategory, reasonNote, actorRoleSnapshot }`.
  - Compliance tab item row gets a "History" expand-arrow rendering a chronological timeline of state changes (created, satisfied, expired, overridden, recomputed, etc.). Data source: `audit_log` table filtered by `target = itemId`. Reuses existing `audit_log` query infrastructure — no new table.
  - Visible badge on the row when status = WAIVED with category icon + tooltip "Overridden by Admin Jane on 2026-04-27 — reason: temporary_grace_period".

### Locked-phrase registry — COMPL doc names

- **D-14:** New per-jurisdiction modules under `packages/validators/src/legal/`: `compliance-uk.ts`, `compliance-de.ts`, `compliance-pl.ts`, `compliance-uae.ts`, `compliance-ksa.ts`. Each exports its own `LOCKED_COMPL_NAMES_<jurisdiction>` const + `RESERVED_COMPL_KEYS_<jurisdiction>`. The existing `legal/index.ts` aggregator re-exports. Mirrors the modular shape already established by `legal/de.ts`, `legal/gb.ts`, `legal/en.ts`, `legal/disclaimers.ts`. Per-jurisdiction legal review can land per-file (UK adviser reviews `compliance-uk.ts`, Steuerberater reviews `compliance-de.ts`, etc.).
- **D-15:** Entry schema — keyed by `policyRuleId`, value = per-locale phrase map.
  ```ts
  // packages/validators/src/legal/compliance-uk.ts
  export const LOCKED_COMPL_NAMES_UK = {
    'uk.right_to_work@v3': {
      en: 'Right-to-Work share code',
      pl: 'Kod udostępniania prawa do pracy',
      de: 'Right-to-Work Share-Code',
    },
    'uk.utr@v1': {
      en: 'UTR (Unique Taxpayer Reference)',
      pl: 'UTR (Unique Taxpayer Reference)',
      de: 'UTR (Unique Taxpayer Reference)',
    },
    // ...
  } as const;
  ```
  - The `policyRuleId` is already the canonical identifier (Phase 71 D-02 — stable namespace + `@vN` suffix).
  - Phase 73 derives i18n keys mechanically: `compliance.docName.<jurisdiction>.<stable-namespace>` (drop the `@vN` for the i18n key — UI shows the current rule's phrase regardless of version; locked-phrase registry pins the version-specific text).
  - Renderable client-side via existing `useTranslations` + a thin `useComplDocName(policyRuleId)` hook.
- **D-16:** Signoff posture — all new entries land PENDING in `signoff-registry.json` per Phase 70 D-09. Engineers develop locally with `FLAG_SIGNOFF_BYPASS=local` (Phase 70 D-10). Per-jurisdiction legal review flips entries to APPROVED in dedicated PRs each carrying a `legalTicketRef`. Until APPROVED, the UI renders the phrase with a small subscript flag: "Right-to-Work share code¹" with footer "¹ phrasing pending legal review". Honours Standing Constraint (LOCAL-ONLY, legal review DEFERRED). Production-deploy gate (when LOCAL-ONLY flips): zero PENDING entries in the deploy scope.
- **D-17:** Parity validation — new dedicated test file `packages/validators/src/__tests__/compl-doc-names-parity.test.ts`. Asserts:
  - (a) Every `policyRuleId` in the Phase 71 `@contractor-ops/compliance-policy` registry has a matching entry in the relevant `LOCKED_COMPL_NAMES_<jurisdiction>` (catches "Phase 71 added a policyRule but Phase 73 forgot the locked phrase").
  - (b) Every entry has en + pl + de keys (Arabic = Phase 79; this test ignores `ar`).
  - (c) Every `policyRuleId` has a corresponding `signoff-registry.json` entry with state PENDING or APPROVED.
  - Mirrors the standalone shape of `locked-phrases-guard.test.ts`. Runs in CI via existing test pipeline.

### Claude's Discretion

- Exact dashboard KPI-card visual: copy + icons + colour treatment per pillar — match v1.0 dashboard KPI-card style.
- Exact table column order + responsive collapse behaviour — match existing v1.0/v3.0 dashboard table conventions.
- Whether `Document.rejectionReason` is a new column on `Document` or captured only via audit log (D-08) — Researcher pin based on existing `Document` schema patterns; recommend audit-log-only if `Document` already has no rejection-reason field.
- Exact contractor portal home banner placement (top-of-page vs floating notification chip) — match existing portal patterns.
- Exact polling cadence for "Blocked payments" tab (recommend 60s; Researcher to confirm against existing dashboard polling conventions).
- Exact wording of override modal copy + reject modal copy (placeholder English; final wording in Phase 73 i18n locked-phrase pass — admins, not legal-sensitive, so no signoff registry).
- Whether `WaivedReasonCategory` lives in `packages/db/prisma/schema/contractor.prisma` as a Prisma enum vs in `@contractor-ops/compliance-policy` as a TypeScript const-mapped Zod literal union — Researcher pin based on existing enum-vs-const patterns; recommend Prisma enum given the existing `WaivedReason`/`Severity` Phase 71 enum lives there.
- Exact font/icon for the "pending legal review" subscript flag — match existing `signoff-registry-flags.ts` UI convention if one exists; otherwise minimal text-only footnote.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architectural twin & data sources
- `.planning/phases/71-f1-compliance-policy-package-schema-classification-reconcile/71-CONTEXT.md` — Phase 71 decisions: 3-tier severity (D-05), `policyRuleId` semantic versioning (D-02), `WaivedReason` enum (D-11), `recreateComplianceAssessment` admin mutation + UI (D-13..D-16). Phase 73 builds the dashboard surface over this engine.
- `.planning/phases/72-f1-compliance-reminder-cascade-payment-block/72-CONTEXT.md` — Phase 72 decisions: `PaymentRunComplianceCheck` schema (D-16), `eligibilityVerdict` enum (D-19), block-modal payload structure (D-10) reused by Phase 73 dashboard, per-recipient digest cron (D-04) emitting to contractor portal recipients.

### Existing UI patterns (admin dashboard)
- `apps/web/src/app/[locale]/(dashboard)/` — admin dashboard route group. Phase 73 adds `compliance/dashboard/page.tsx` here.
- v1.0 dashboard KPI cards (read existing `apps/web/src/components/dashboard/*.tsx` for the pattern — Researcher to enumerate) — Phase 73 reuses for the 3-up summary row.
- v3.0 / v5.0 tabbed-table dashboard idiom (per-market compliance health dashboard from v5 — read existing `compliance-gaps-report.tsx` and similar) — Phase 73 reuses for the table region.

### Existing UI patterns (portal)
- `apps/web/src/app/[locale]/(portal)/portal/{contracts,documents,equipment,invoices,payments,settings,time}/` — existing portal sub-routes. Phase 73 adds `compliance/` sub-route + `compliance/upload-replacement/page.tsx`.
- Existing portal home banner / notification surface (Researcher to enumerate) — Phase 73 hooks into this for the in-app notification template.
- Existing `Document` upload pipeline (signed-URL R2 PUT + virus scan) — Phase 73 reuses verbatim for the upload form's MIME-validated file ingestion.

### Existing UI patterns (Compliance tab)
- Contractor profile Compliance tab (Phase 71 added the "Recompute compliance" button + dialog there — file path resolved during research). Phase 73 adds:
  - Per-row inline "Override" button + `<OverrideComplianceItemDialog>`.
  - Per-row "History" expand-arrow timeline component.
  - Per-row WAIVED badge + tooltip with category icon.

### Locked-phrase registry baseline (Phase 73 extension target)
- `packages/validators/src/legal/de.ts` — existing DE legal phrases (LOCKED_DE_PHRASES, RESERVED_LEGAL_KEYS).
- `packages/validators/src/legal/gb.ts` — existing UK legal phrases (LOCKED_GB_PHRASES, RESERVED_GB_LEGAL_KEYS).
- `packages/validators/src/legal/en.ts` — existing EN legal phrases (LOCKED_EN_PHRASES, RESERVED_EN_LEGAL_KEYS).
- `packages/validators/src/legal/disclaimers.ts` — existing disclaimers (LOCKED_DISCLAIMERS, RESERVED_DISCLAIMER_KEYS).
- `packages/validators/src/legal/signoff-registry.json` + `signoff-registry-schema.ts` — Phase 70 D-09 parallel signoff registry. Phase 73 adds COMPL doc-name entries here per D-16.
- `packages/validators/src/__tests__/locked-phrases-guard.test.ts` — existing parity / locked-phrases CI guard. Phase 73's new `compl-doc-names-parity.test.ts` mirrors its shape.
- `apps/web/messages/{en,pl,de,ar}.json` — locale message files. Phase 73 adds `compliance.docName.*` keys to en/pl/de (ar = Phase 79).
- `packages/lint-guards/src/__fixtures__/messages/*.json` — i18n parity guard fixtures (Researcher to confirm whether these also need updating).

### RBAC / permission registry
- `packages/auth/src/permissions.ts` — Phase 74 D-03 registered `workflow:override_blocking_task` here. Phase 73 D-10 registers `compliance:override` in the same module following the same shape.
- `packages/auth/src/roles.ts` — default permission grants per role. Phase 73 D-10 adds `compliance:override` to OWNER + ADMIN.

### tRPC + audit log
- `packages/api/src/routers/compliance.ts` (or wherever Phase 71's classification-router-resident `recreateComplianceAssessment` lives — likely `packages/api/src/routers/classification.ts` per Phase 71 D-13). Phase 73 D-12 adds `compliance.overrideItem(itemId, reasonCategory, reasonNote)` mutation in the same router.
- Existing `audit_log` table — Phase 73 emits `compliance.item.overridden`, `compliance.upload.rejected`, `compliance.upload.approved` entries. Reuses existing `auditWriter` service. No new audit-log table.

### Notification & i18n infrastructure
- `packages/api/src/services/notification-service.ts` — `dispatch()` Phase 72 already uses for cron emit. Phase 73 adds new in-app notification templates for the contractor-side digest + rejection notifications.
- `apps/web/src/components/portal/notifications/*` (Researcher to enumerate) — existing portal in-app notification UI. Phase 73 adds the new compliance template surface.

### Standing constraints
- `.planning/STATE.md` "Standing Project Constraints" — LOCAL-ONLY, legal review DEFERRED. Phase 73's locked-phrase additions land PENDING per D-16; flag for production deploy is `compliance-portal-self-service` PENDING.

### ROADMAP entry (success criteria source-of-truth)
- `.planning/ROADMAP.md` "Phase 73: F1 Compliance — Admin Dashboard + Portal Self-Service + i18n" — 4 numbered success criteria. Phase 73 maps:
  - SC #1 → D-01..D-05 (dashboard composition + at-risk semantics + drilldown + indexed queries)
  - SC #2 → D-06..D-09 (portal upload-replacement flow + notification rendering surface)
  - SC #3 → D-10..D-13 (manual admin override → WAIVED + audit + history)
  - SC #4 → D-14..D-17 (locked-phrase registry additions + signoff posture + parity guard) — *Needs verification by legal entity before production deploy* per Standing Constraint.

### Requirements
- `.planning/REQUIREMENTS.md` — COMPL-01 (admin dashboard at-risk count + clickable drilldown), COMPL-04 (contractor portal one-click upload-replacement), COMPL-11 (en/pl/de message-key parity + locked-phrase registry COMPL additions).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`packages/validators/src/legal/{de,gb,en,disclaimers}.ts`** — locked-phrase registry baseline. Phase 73 D-14 adds parallel `compliance-{jurisdiction}.ts` modules in the same shape.
- **`packages/validators/src/legal/signoff-registry.json` + `signoff-registry-schema.ts`** (Phase 70 D-09) — parallel signoff registry. Phase 73 D-16 adds COMPL doc-name entries here as PENDING.
- **`packages/validators/src/__tests__/locked-phrases-guard.test.ts`** — existing parity guard test. Phase 73 D-17's new test mirrors its shape and import discipline.
- **`packages/auth/src/permissions.ts` + `roles.ts`** (Phase 74 extended these) — Phase 73 D-10 plugs `compliance:override` into the same registry.
- **Existing v1.0 dashboard KPI-card components** + tabbed-table idiom — Phase 73 D-01 reuses both verbatim. Researcher to enumerate exact paths.
- **Existing portal `Document` upload pipeline** (signed-URL R2 PUT + virus scan) — Phase 73 D-06 reuses for the upload form's file ingestion.
- **Existing `audit_log` infrastructure + `auditWriter` service** — Phase 73 D-13 emits override entries; D-08 emits rejection entries. No new audit table.
- **`packages/api/src/services/notification-service.ts` `dispatch()`** (Phase 72 cron emitter) — Phase 73 D-09 hooks new in-app templates into this; no new dispatcher.
- **`@contractor-ops/compliance-policy` package** (Phase 71) — Phase 73 D-07 adds `defaultExpiryFromUploadDate(policyRule, uploadDate)` helper here.
- **`useTranslations` hook + `apps/web/messages/{en,pl,de,ar}.json`** — i18n surface. Phase 73 D-15 adds `compliance.docName.*` keys.

### Established Patterns
- **Per-jurisdiction file boundary in legal registry** (`legal/de.ts`, `legal/gb.ts` separate from `legal/en.ts`) — Phase 73 D-14 follows this so per-jurisdiction legal review can land per-file.
- **Hover-revealed inline action buttons on table rows** (existing v1.0 contractor list patterns) — Phase 73 D-12 reuses for Override/Recompute buttons.
- **Closed-enum + free-text-rationale combo for blocking actions** (Phase 74 D-04 OWNER override on workflows) — Phase 73 D-11 follows the same pattern for compliance overrides.
- **Audit-log-driven inline timeline** (existing audit-log surface) — Phase 73 D-13 follows this for the Compliance tab history surface.
- **PENDING signoff entries + LOCAL-ONLY bypass** (Phase 70 D-09 / D-10) — Phase 73 D-16 follows this for legal-sensitive locked-phrase additions.
- **Phase-gated feature flag** (existing `compliance-portal-self-service` PENDING in ROADMAP) — Phase 73 wires this flag at the portal route entry; LOCAL-ONLY engineers bypass.
- **3-tier severity skip discipline** (Phase 71 D-05; Phase 72 reminder + payment-block) — Phase 73 dashboard D-02 / D-03 / D-04 all filter on severity to keep BLOCKING from being diluted by WARNING/INFO.

### Integration Points
- **`apps/web/src/app/[locale]/(dashboard)/compliance/dashboard/page.tsx`** (NEW) — main dashboard route. Server-component fetches via existing tRPC patterns + indexed queries.
- **`apps/web/src/app/[locale]/(portal)/portal/compliance/page.tsx` + `upload-replacement/page.tsx`** (NEW) — portal sub-route + one-click flow.
- **`packages/api/src/routers/classification.ts` (or `compliance.ts` if extracted by Phase 71)** — Phase 73 D-12 adds `compliance.overrideItem` mutation; Phase 73 D-08 adds `compliance.rejectUpload` admin mutation; Phase 73 D-06 adds `compliance.submitUploadReplacement` portal mutation.
- **`packages/db/prisma/schema/contractor.prisma`** — Phase 73 D-11 adds two nullable columns to `ContractorComplianceItem`: `waivedReasonCategory` (new enum `WaivedReasonCategory`) + `waivedReasonNote String?`. Migration is additive-only (multi-region apply per Standing Constraint).
- **`packages/auth/src/permissions.ts`** — Phase 73 D-10 registers `compliance:override`. CI lint asserts entry presence.
- **`packages/validators/src/legal/`** — five new modules (D-14) + signoff-registry.json entries (D-16) + new parity test (D-17).
- **`apps/web/messages/{en,pl,de}.json`** — new `compliance.docName.*` + `compliance.dashboard.*` + `portal.compliance.*` + `compliance.override.*` keys. Arabic is Phase 79 scope.
- **Compliance tab on contractor profile** (path resolved during research) — Phase 73 adds inline Override button + History timeline + WAIVED badge.

</code_context>

<specifics>
## Specific Ideas

- The "at-risk" definition (D-02) deliberately includes both currently-failing AND 30-day-forward-look — admins should see what NEEDS attention now AND what they SHOULD attend to soon. Pure point-in-time would be too narrow.
- Drilldown to the canonical Compliance tab (D-05) keeps per-contractor compliance in ONE place. Anti-pattern to avoid: rendering a parallel mini-compliance UI inline on the dashboard that drifts out of sync with the Compliance tab.
- The portal upload-replacement flow stays human-in-the-loop on COMPL surfaces (D-06) per Standing Constraint. Phase 75's IP-clause scanner is the only AI-on-legal surface in v6.0; that's gated by its own legal-sensitive feature flag.
- The `expiresAt` policy-template auto-fill (D-07) is the "one-click" success-criterion concrete: contractor uploads the file, sees the auto-computed expiry, hits Submit, done. ~3 clicks, not a wizard.
- The override permission `compliance:override` (D-10) is its own permission key (not reusing `contractor:write`) so a future "Compliance Officer" role can hold it without other contractor edit rights.
- Closed-enum `WaivedReasonCategory` (D-11) intentionally includes `temporary_grace_period` so admins have a graceful escape for "I'll renew this in 2 weeks but pay them this Friday" without the alternative being "pretend the doc is satisfied" or "block the payment".
- The inline timeline on the Compliance tab (D-13) is the audit-discoverability surface non-engineers will use. Auditors grep AuditLog directly; admins read the timeline.
- Per-jurisdiction legal review (D-14, D-16) lands per-file so a UK tax adviser doesn't need to also re-approve Skonto wording when reviewing UK doc names. File boundaries match the legal review boundaries.
- The "PENDING" subscript flag in the UI (D-16) is the visible "this is unverified" signal — when a future bug-report says "why does the UI say A1 instead of A1-Bescheinigung?", the answer is right there on the surface, not buried in the registry.
- The new dedicated parity test (D-17) is shaped exactly like `locked-phrases-guard.test.ts` so the test file is self-documenting next to its sibling.

</specifics>

<deferred>
## Deferred Ideas

- **Three-column side-by-side queue layout** — rejected in D-01 in favour of 3-up cards + tabbed table region. Revisit if user feedback shows admins want simultaneous-view of all three queues; could ship as a togglable view.
- **OCR/Claude Vision pre-parse on portal uploads** — rejected in D-06 in favour of MIME + admin review. Revisit if admin reviewer fatigue becomes evident in production telemetry; could ship under the same legal-sensitive flag posture as Phase 75's IP-clause scanner.
- **Contractor-only `expiresAt` entry, no template** — rejected in D-07 in favour of policy-template auto-fill. Revisit if a jurisdiction emerges with no fixed expiry semantic.
- **`Document.rejectionReason` schema column** — left to Researcher (Claude's Discretion). Recommend audit-log-only.
- **Auto-purge rejected uploads after N days** — captured in D-08 alternatives but explicitly deferred. GDPR/PDPL retention policy is a cross-cutting concern that belongs in its own phase, not bolted onto rejection flow.
- **OWNER-only override for compliance items** — rejected in D-10 in favour of `compliance:override` permission default-granted to OWNER + ADMIN. Phase 74's OWNER-only IP-verification override is appropriate for that surface (rare end-of-engagement action); compliance overrides are routine ops.
- **Free-text-only override reason** — rejected in D-11 in favour of closed enum + free text. Closed enum protects audit queryability.
- **Per-jurisdiction structured override forms** — rejected in D-11 alternatives. Revisit if production usage shows the closed enum is too coarse for any specific jurisdiction.
- **Separate `/compliance/at-risk` + `/compliance/renewals` + `/compliance/blocked-payments` full pages** — rejected in D-01 in favour of single tabbed table region. Could revisit if any tab grows beyond ~200 rows AND admins want dedicated pagination per surface.
- **Drawer-based drilldown UX** — rejected in D-05 in favour of navigate-to-Compliance-tab. Drawer pattern not currently used in the codebase; introducing it for one surface is over-investment.
- **Side-by-side dashboard layout, no summary cards** — rejected in D-01.
- **APPROVED-on-first-commit signoff posture** — rejected in D-16; conflicts with Standing Constraint and Phase 70 D-09 separation.
- **Folding COMPL parity test into existing `locked-phrases-guard.test.ts`** — rejected in D-17 in favour of dedicated test for clearer failure-mode signal.
- **Folding COMPL parity into existing `i18n:parity` CI guard** — rejected in D-17; conflates legal-review concerns with translation-coverage concerns.
- **Arabic / RTL parity for COMPL surfaces** — explicitly deferred to Phase 79 (F3 Gulf). Phase 73 ships en/pl/de only.

</deferred>

---

*Phase: 73-f1-compliance-admin-dashboard-portal-self-service-i18n*
*Context gathered: 2026-04-27*
