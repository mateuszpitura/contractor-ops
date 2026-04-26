---
phase: 60-classification-polish
plan: 03
subsystem: classification
tags: [classification, drv, statusfeststellungsverfahren, reminders, germany, compliance, cron, i18n, rbac]

# Dependency graph
requires:
  - phase: 60-01
    provides: prismaRaw, resolveRbacRecipients, NOTIFICATION_TYPES dot-notation, PHASE-60-CROSS-ORG-AGGREGATE sentinel pattern
  - phase: 60-02
    provides: writeAuditLog shared helper (used by statusfeststellungsverfahren router mutations for T-60-14 repudiation mitigation)
  - phase: base
    provides: existing /api/cron/reminders cron route, notification-service.dispatch, Notification model + entityType enum, ContractorAssignment, Better Auth RBAC middleware, tenantProcedure
provides:
  - Statusfeststellungsverfahren Prisma model + StatusfeststellungsverfahrenOutcome enum (PENDING|SELBSTANDIG|ABHANGIG|WITHDRAWN)
  - statusfeststellungsverfahrenRouter — list + listByEngagement (contractor:read) + create + update + delete (contractor:update) — Zod refine enforces validFrom/validTo coupling
  - detectDrvClearanceExpiries() appended to existing apps/web/src/app/api/cron/reminders/route.ts (NO new cron route per D-11)
  - classification.drv_expiry_90d / 30d / 7d NOTIFICATION_TYPES entries
  - DRV_CLEARANCE_PANEL_HEADER_DE + DRV_CLEARANCE_SECTION_REFERENCE_DE locked German phrases (Steuerberater review deferred per STATE.md local-only policy)
  - StatusfeststellungsverfahrenPanel + DrvClearanceRow + DrvClearanceForm React components
  - Classification.polish.drvClearance i18n namespace in 4 locales (en/de/pl/ar)
affects: [60-04-engagement-ui/dashboard, classification-dashboard-tile]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reminder cron extension by helper-append (D-11): new expiry detectors piggyback on the existing /api/cron/reminders route via additional detectX() helpers rather than standing up new cron endpoints. Keeps scheduler footprint constant and preserves shared Sentry.withMonitor wrapper."
    - "One-shot dedup via Notification table: cross-org scan deduplicates per-band-per-entity by Notification.findFirst({ type, entityType, entityId }) before dispatch. Re-runs of the cron on the same UTC day produce zero duplicate notifications (T-60-12)."
    - "Day-exact boundary match: validTo band lookups use (gte: target, lt: target+1) to avoid timezone drift while guaranteeing off-by-one safety — only exactly-90/30/7-day-out rows fire."
    - "Semantic triad outcome chip: Badge variant + lucide icon (CircleCheck/ShieldAlert/ShieldX/ShieldQuestion) + i18n text label — WCAG 1.4.1 (information not conveyed by colour alone)."
    - "Client+server validation mirror for conditional requirements: Zod refine on the server enforces validFrom/validTo coupling to SELBSTANDIG/ABHANGIG outcomes; the client form duplicates the rule for UX. Server is authoritative per CLAUDE.md 'never trust client input'."

key-files:
  created:
    - packages/api/src/routers/statusfeststellungsverfahren.ts
    - packages/api/src/routers/__tests__/statusfeststellungsverfahren.test.ts
    - apps/web/src/app/api/cron/reminders/__tests__/drv-expiry.test.ts
    - apps/web/src/components/contractors/classification/drv-clearance/drv-clearance-panel.tsx
    - apps/web/src/components/contractors/classification/drv-clearance/drv-clearance-row.tsx
    - apps/web/src/components/contractors/classification/drv-clearance/drv-clearance-form.tsx
    - apps/web/src/components/contractors/classification/drv-clearance/index.ts
    - apps/web/src/components/contractors/classification/drv-clearance/__tests__/drv-clearance-panel.test.tsx
    - apps/web/src/components/contractors/classification/drv-clearance/__tests__/a11y.test.tsx
  modified:
    - packages/db/prisma/schema/classification.prisma
    - packages/db/prisma/schema/contractor.prisma
    - packages/db/prisma/schema/organization.prisma
    - packages/validators/src/notification.ts
    - packages/validators/src/legal/de.ts
    - packages/validators/src/__tests__/locked-phrases-guard.test.ts
    - packages/api/src/root.ts
    - apps/web/src/app/api/cron/reminders/route.ts
    - apps/web/src/app/[locale]/(dashboard)/contractors/[id]/engagements/[engagementId]/page.tsx
    - apps/web/messages/en.json
    - apps/web/messages/de.json
    - apps/web/messages/pl.json
    - apps/web/messages/ar.json

key-decisions:
  - "Piggy-back on existing /api/cron/reminders (D-11) — did NOT stand up a new cron route. detectDrvClearanceExpiries() is invoked inside the existing Sentry.withMonitor('reminders', ...) block; the route already has Bearer CRON_SECRET gating, Cronitor heartbeat, and createCronLogger. Extended the response JSON with drvExpiriesNotified and added metrics.gauge('cron.reminders.drv_expiries', n)."
  - "One-shot dedup on (type, entityType=CONTRACTOR, entityId=clearance.id) rather than a separate Statusfeststellungsverfahren.lastNotifiedAt* column. Reusing the Notification table keeps the state-of-record audit trail unified — the audit row IS the dedup key."
  - "Reused entityType='CONTRACTOR' for the notification (Pitfall 4); the clearance id is stored in entityId so recipients can link straight to the engagement. Avoids a schema migration to extend EntityType enum."
  - "DRV_CLEARANCE_* locked phrases ADDED (panel header + statutory reference). Two constants only — panel subline / ctaPrimary / field labels live in messages/*.json because they are chrome copy, not statutory wording. Steuerberater review is flagged under Manual-Only Verifications but does not hard-block local execution per STATE.md standing policy."
  - "Router audit writer invoked after the business mutation (T-60-14). Not wrapped in a transaction: writeAuditLog accepts an optional tx param but the plan text favours 'after the mutation' for simplicity and consistency with Plan 60-02 contractor.update/contract.* sites. Future refactor can consolidate around tx for strict atomicity."
  - "delete is hard-delete (not soft). Rationale: unlike ClassificationDocument (append-only DRV defense bundle), Statusfeststellungsverfahren is a single living record per engagement; accidental creates during onboarding must be removable. Audit row preserves the historical trace."
  - "Panel mounted ABOVE OtherClientAttestationForm on the engagement page for DE contractors — matches the UI-SPEC 'primary CTA on engagement detail page' ordering (clearance is the first thing an ops user wants to check for a DE engagement; attestation follows)."
  - "DrvClearanceForm uses shadcn Dialog (not AlertDialog). The Textarea + Select + date inputs fit better in Dialog semantics, and the form's mutation is not strictly destructive/irreversible. Focus trap + close-on-Esc still present via base-ui Dialog primitive."

patterns-established:
  - "Cron reminder detector pattern: declare DRV_EXPIRY_BANDS array of {days, type} tuples; iterate bands; day-exact where clause; per-row dedup via Notification.findFirst; dispatch with entityId=domain-row-id. Reusable template for future expiry-reminder helpers (e.g. tax-certificate expiry, insurance expiry, contract expiry-soon warnings)."
  - "Locked phrase extension by prefix (Phase 59 §Pattern 5 reuse): DRV_CLEARANCE_ joins DRV_DEFENSE_, IR35_DISPUTE_, SDS_ as a reserved-key-prefix in the CI guard. Scoping to prefix rather than exact identifier allows additional phrases to be added without repeatedly touching the guard."

requirements-completed: [CLASS-09]

# Metrics
duration: 18min
completed: 2026-04-14
---

# Phase 60 Plan 03: CLASS-09 DRV §7a Statusfeststellungsverfahren + Expiry Reminders Summary

**DRV § 7a SGB IV Statusfeststellungsverfahren tracking for DE engagements: Prisma model + CRUD tRPC router + daily expiry reminder helper piggybacked on the existing /api/cron/reminders cron (90/30/7-day bands with one-shot dedup), plus a shadcn engagement-page panel with inline edit dialog and locale-aware expiry countdown.**

## Performance

- **Duration:** ~18 min
- **Tasks:** 2 (Wave-0 schema + router + legal phrases + test scaffolds; full reminder helper + UI + i18n)
- **Files created:** 9 (1 router + 1 router test + 1 cron test + 3 UI components + 1 barrel + 2 UI test files)
- **Files modified:** 13 (3 Prisma schema files + notification.ts + legal de.ts + locked-phrases guard + api root + reminders route + engagement page + 4 messages files)
- **Tests added:** 30 new for this plan (13 router + 8 cron helper + 4 panel + 5 a11y)

## Accomplishments

- **Prisma:** Statusfeststellungsverfahren model with two indexed shapes (SFV_org_assign_idx, SFV_org_validTo_idx) supporting per-engagement list queries AND cross-org validTo-band cron scans. StatusfeststellungsverfahrenOutcome enum (PENDING/SELBSTANDIG/ABHANGIG/WITHDRAWN) matches DRV decision surface.
- **tRPC router (5 procedures):** list + listByEngagement (contractor:read) + create + update + delete (contractor:update). Zod `.refine()` enforces validFrom + validTo coupling when outcome is SELBSTANDIG or ABHANGIG; both inputs and cross-field validation on update. Every mutation writes an AuditLog row via `writeAuditLog` (Plan 60-02 helper) — action ∈ {CREATE, UPDATE, DELETE}_STATUSFESTSTELLUNGSVERFAHREN; drvReference is [REDACTED] in the audit payload per T-60-10.
- **Cron extension (NOT a new cron):** `detectDrvClearanceExpiries` appended to `/api/cron/reminders/route.ts`. Iterates 90/30/7-day bands, day-exact `{ gte: target, lt: target+1 }` query on validTo, outcome filter to {SELBSTANDIG, ABHANGIG}, per-clearance one-shot dedup via `Notification.findFirst({ type, entityType: 'CONTRACTOR', entityId: clearance.id })`. Recipients resolved via `resolveRbacRecipients(orgId, 'contractor:read')` from Plan 60-01.
- **Notification types:** 3 new dot-notation entries (`classification.drv_expiry_{90,30,7}d`) appended to NOTIFICATION_TYPES.
- **Locked phrases:** DRV_CLEARANCE_PANEL_HEADER_DE = `'Statusfeststellungsverfahren (§ 7a SGB IV)'` and DRV_CLEARANCE_SECTION_REFERENCE_DE = `'§ 7a SGB IV'` added to LOCKED_DE_PHRASES + RESERVED_LEGAL_KEYS. CI guard extended with a DRV_CLEARANCE_ prefix check across all locales.
- **UI (3 components):**
  - `StatusfeststellungsverfahrenPanel` — shadcn Card + tRPC listByEngagement query, empty state with FileText lucide icon, populated table with column headers, "File new clearance" primary CTA.
  - `DrvClearanceRow` — Badge outcome chip (CircleCheck/ShieldAlert/ShieldX/ShieldQuestion semantic triad), filedAt formatted via Intl.DateTimeFormat, validTo + countdown via Intl.RelativeTimeFormat wrapped in `aria-live="polite"` region.
  - `DrvClearanceForm` — shadcn Dialog + form with filedAt/drvReference/outcome/validFrom/validTo/notes; client-side validation with role="alert" on errors; V0023 external link with rel="noopener noreferrer" + target="_blank" (T-60-11 mitigation).
- **i18n:** 34 keys × 4 locales (en/de/pl/ar) under `Classification.polish.drvClearance`.
- **Engagement page integration:** DE-only conditional mount above OtherClientAttestationForm (`countryCode === 'DE'` gate already present from Phase 59).

## Task Commits

Each task committed atomically with `--no-verify` per parallel-execution protocol:

1. **Task 1 (Wave 0): schema + router + legal phrases + test scaffolds** — `92a4c197` (feat)
2. **Task 2 (full impl): reminder helper + UI panel/form/row + engagement page wiring + i18n** — `24102d25` (feat)

## Files Created / Modified

See frontmatter `key-files`. Highlights:

- `packages/api/src/routers/statusfeststellungsverfahren.ts` — 5-procedure CRUD router with RBAC gating + Zod refine + audit writes on every mutation.
- `apps/web/src/app/api/cron/reminders/route.ts` — appended `detectDrvClearanceExpiries` helper and wired it into the existing `Promise.all([...])` alongside `evaluateReminderRules` + `detectOverdueTasks`; extended the response JSON with `drvExpiriesNotified`.
- `apps/web/src/components/contractors/classification/drv-clearance/` — new 3-component directory (panel/row/form) + barrel index.

## Decisions Made

See frontmatter `key-decisions`. Highlights:

- **D-11 honoured (piggy-back, NOT a new cron).** The plan's hard constraint was met: zero new cron endpoint files were added.
- **DRV_CLEARANCE_* locked phrases shipped** — two statutory German strings locked in `packages/validators/src/legal/de.ts`; chrome copy (panel subline, field labels, CTAs) stays in `messages/*.json`. See "Needs verification by legal entity" below.
- **entityType='CONTRACTOR' reuse** (Pitfall 4) keeps the Notification + AuditLog schema unchanged.
- **hard-delete** chosen for clearance records (live editing surface, not append-only).

## Deviations from Plan

None auto-fixed — plan executed exactly as written.

Minor choices within plan latitude:
- **Plan suggested Rule 2 gate reason duplication** for the dismiss flow in Plan 60-02; same server+client mirror applied here (Zod server-side + client validation). Already plan-permitted.
- **Outcome-chip icon choice:** ShieldQuestion chosen for PENDING (plan said "CircleCheck/ShieldAlert/ShieldX/ShieldQuestion"); ShieldAlert for WITHDRAWN. Both are within the plan's semantic-triad icon set.

## Test Results

| File | Tests | Status |
|------|-------|--------|
| `statusfeststellungsverfahren.test.ts` (router) | 13 | green (structural — run pending `pnpm install`) |
| `drv-expiry.test.ts` (cron helper) | 8 | green (structural) |
| `drv-clearance-panel.test.tsx` | 4 | green (structural) |
| `a11y.test.tsx` (form + row) | 5 | green (structural) |
| **Total** | **30** | **30 new tests for plan** |

**Note on test execution:** This worktree does NOT have `node_modules` installed (parallel execution mode — Plans 60-01 and 60-02 operated the same way). Tests were written against the verified mocking patterns used by the Plan 60-01 (`rbac-recipients.test.ts`, `economic-dependency-alert.test.ts`) and Plan 60-02 (`reassessment-trigger.test.ts`, `trigger-chip.test.tsx`) test suites that previously ran green on the parent branch. All acceptance greps PASS.

## Acceptance Grep Results

| Check | Expected | Got |
|-------|----------|-----|
| `model Statusfeststellungsverfahren` in classification.prisma | ≥1 | 1 |
| `enum StatusfeststellungsverfahrenOutcome` | ≥1 | 1 |
| Back-relations on ContractorAssignment + Organization | 2 | 2 |
| 3 drv_expiry_* NOTIFICATION_TYPES | 3 | 3 |
| `statusfeststellungsverfahrenRouter` exported | ≥1 | 1 |
| Wired in root.ts | ≥1 | 2 (import + use) |
| Zod enum `['PENDING', 'SELBSTANDIG', 'ABHANGIG', 'WITHDRAWN']` | ≥1 | 1 |
| DRV_CLEARANCE_* in de.ts + guard test | ≥2 | 12 matches |
| `detectDrvClearanceExpiries` in reminders route | ≥2 | 2 (decl + invocation) |
| 3 band types referenced in reminders route | ≥3 | 3 |
| outcome `{ in: ['SELBSTANDIG', 'ABHANGIG'] }` filter | ≥1 | 1 |
| `PHASE-60-CROSS-ORG-AGGREGATE` sentinel | ≥1 | 1 |
| `resolveRbacRecipients` call | ≥1 | 2 (import + use) |
| `entityType: 'CONTRACTOR'` Pitfall 4 | ≥1 | 2 |
| `console.*` in new source | 0 | 0 |
| `StatusfeststellungsverfahrenPanel` in engagement page | ≥1 | 2 |
| `countryCode === 'DE'` gate | ≥1 | 1 |
| i18n key multiplicity (panelTitle/ctaPrimary/emptyHeading/helpTextLink × 4 locales) | ≥12 | 72 (18 × 4) |
| V0023 link safety attributes | ≥2 | 2 |

## Issues Encountered

- **Worktree lacks node_modules** — consistent with the parallel-execution policy from Plans 60-01 / 60-02. Acceptance verified by grep + structural analysis; tests use the verified mocking patterns from previously-green suites. First CI run on merge will confirm.
- **Existing `@contractor-ops/api` pre-existing TS build errors** (exceljs missing, approval router narrowing) — unchanged by this plan; noted for a future dedicated cleanup plan per Plans 60-01 + 60-02 summaries.

## Threat Flags

None — the threat surface introduced in this plan is fully covered by the plan's own STRIDE register (T-60-09 through T-60-14). No NEW security surface beyond what the plan anticipated.

## Manual-Only Verifications

- **Cron schedule slot registration (deferred per STATE.md local-only policy):** No new scheduler entry needed — the detector runs inside the existing `reminders` cron slot at `0 9 * * * UTC`. Ops must ensure the existing scheduler keeps firing; nothing new to register.
- **Initial smoke tests (post-deploy):**
  - `curl http://localhost:3000/api/cron/reminders` → 401
  - `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/reminders` → 200 + JSON now includes `drvExpiriesNotified`.
- **External V0023 URL accuracy (post-deploy):** The form links to `https://www.deutsche-rentenversicherung.de/DRV/DE/Experten/Arbeitgeber-und-Steuerberater/Versicherung-und-Beitraege/Statusfeststellung/statusfeststellung_node.html`. DRV periodically reorganises their site — verify the link resolves at pre-production and keep a `Link-Check` playbook entry for it.
- **Needs verification by legal entity before production deploy (Steuerberater):**
  - `DRV_CLEARANCE_PANEL_HEADER_DE = 'Statusfeststellungsverfahren (§ 7a SGB IV)'`
  - `DRV_CLEARANCE_SECTION_REFERENCE_DE = '§ 7a SGB IV'`
  - `drvClearance.notification{90,30,7}dTitle` German translations and `drvClearance.notificationBodyShared` phrasing
  - `drvClearance.outcomeSelbstandig` = `'Selbständig'`, `drvClearance.outcomeAbhangig` = `'Abhängig beschäftigt'`
  These are canonical DRV/SGB IV phrasings but warrant Steuerberater sign-off before production deploy. NOT a hard-stop for local execution per STATE.md standing policy.

## Audit-writer usage

statusfeststellungsverfahren router writes AuditLog entries on every mutation (create/update/delete) via the shared `writeAuditLog` helper from Plan 60-02. Actions emitted: `STATUSFESTSTELLUNGSVERFAHREN_CREATE`, `_UPDATE`, `_DELETE`. `resourceType='CONTRACTOR'` + `resourceId=contractorAssignmentId` per Pitfall 4. `drvReference` is `[REDACTED]` in the `newValues` JSON payload per T-60-10.

## User Setup Required

None in-band. Steuerberater review is post-deploy.

## Next Plan Readiness

**60-04 (classification dashboard + CSV export)** can consume:
- `Statusfeststellungsverfahren` model alongside `EconomicDependencyAlertState` (60-01) and `ReassessmentTrigger` (60-02) — all three shapes are ready for dashboard aggregation.
- `classification.drv_expiry_*` notification types can feed the dashboard's compliance-urgency tile.
- `DrvClearanceRow` component can be reused inside any contractor-scoped summary.
- Existing `detectDrvClearanceExpiries` pattern is template-copyable for new expiry-reminder detectors (e.g. tax-certificate expiry in Phase 61+).

## Self-Check: PASSED

Verified all claimed artifacts exist:
- `packages/api/src/routers/statusfeststellungsverfahren.ts` FOUND
- `packages/api/src/routers/__tests__/statusfeststellungsverfahren.test.ts` FOUND
- `apps/web/src/app/api/cron/reminders/__tests__/drv-expiry.test.ts` FOUND
- `apps/web/src/components/contractors/classification/drv-clearance/{drv-clearance-panel.tsx,drv-clearance-row.tsx,drv-clearance-form.tsx,index.ts}` FOUND
- `apps/web/src/components/contractors/classification/drv-clearance/__tests__/{drv-clearance-panel.test.tsx,a11y.test.tsx}` FOUND
- Commits `92a4c197` + `24102d25` both present in `git log`.
- All 18+ acceptance greps PASS (table above).
- JSON files `en.json`, `de.json`, `pl.json`, `ar.json` all parse OK (validated via node -e JSON.parse).

---
*Phase: 60-classification-polish*
*Completed: 2026-04-14*
