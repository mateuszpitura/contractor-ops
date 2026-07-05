---
title: Hot cache
type: hot-cache
updated: 2026-07-05
source_commit: ed9575550
---

# Hot cache

Discovery shortcuts for agents — not a changelog. History lives in `wiki/log.md` and git.

## Worker on/offboarding (employee lifecycle)

Employee on/offboarding = **extend the generic run + worker-key the coupled saga, never duplicate**. Single `startWorkflowRun` helper (`workflow-execution-runs.ts`) owns the only `workflowRun.create`; `startRunSchema` + `startDeprovisioningRun` are `CONTRACTOR|EMPLOYEE` discriminated unions. `EmployeeProfile.terminatedAt` arms the 14-day IdP cooldown (mirrors `ContractorAssignment.endedAt`). Per-market DRAFT templates = `@contractor-ops/employee-templates` on `@@unique([organizationId, jurisdiction, type, seedKey])`. Statutory certs = `statutory-cert-pdf.ts` (snapshot `*Last4`-only + CAS → `emp-cert/<org>/<id>.pdf`, LOCKED `CERT_ADVISER_VERIFY_*`). Gov interactions = network-free `{source:'STUB'}` seams. Router: `employeeLifecycle.*`. Detail: [[domains/worker-onboarding-offboarding]].

## Agent delegation (subagent-first)

Prefer **Task subagents** over ad-hoc bulk shell scripts on source files.

| Task | Subagent |
|------|----------|
| Locate | `cavecrew-investigator` (default); `explore` for prose |
| Fix ≤2 files | `cavecrew-builder` or main `Edit` after `Read` |
| Review | `cavecrew-reviewer` |
| Fix 3+ files | Parallel investigator/builder per file — not one `sed` loop |
| `/gsd:*` | `gsd-*` per workflow; trivial → `/gsd:fast` inline |

**Forbidden:** `sed -i`, `awk`, `perl -pi`, `python -c/-e`, `node -e` replace on `apps/`/`packages/`/`prisma/`.

**Surfaces:** `core-values.yml`, `CLAUDE.md`, SessionStart hook, `no-bulk-script-guard.js`, `.cursor/rules/15-delegation-subagents.mdc`, [[patterns/agent-delegation]].

## UI skills routing

Layered stack — **not mutex**. Every UI touch:

1. **frontend-design** (plugin, binding)
2. **semble search**
3. **web-vite / portal / packages/ui** → impeccable + `PRODUCT.md` product register
4. **apps/landing** → design-taste (+ image-to-code, redesign, full-output as needed)

Never design-taste on dashboards, tables, or wizards. Detail: [[patterns/ui-skills-routing]] · `30-ui-a11y.mdc` · hooks `[ui]`/`[ui-strict]` on `apps/web-vite/`, `apps/landing/`, `packages/ui/`.

## web-vite UI layering (current)

| Layer | Where | tRPC? |
|-------|-------|-------|
| Page | `pages/**` — `Suspense` + `*PageContent` (route shell) | No |
| Wired section | `components/{domain}/*.tsx` — calls hook, branches loading/empty/error | No (hooks only) |
| Presentational | `*View` or props-only component in same/sibling file | No |
| Hook | `components/{domain}/hooks/use-*.ts` | **Yes** |

No `*-container.tsx` files under `apps/web-vite/src/`. Verify: `find apps/web-vite/src -name '*-container.tsx'`.

## Gates

```bash
pnpm check:web-vite-data-layer
pnpm check:web-vite-page-shells
pnpm check:web-vite-presentational
```

**KB freshness (enforced, not advisory):**
- `pnpm check:wiki-brain` (CI) — **fails** on NEW doc drift: a source file under a page's `verify_with` changed in the diff but the page wasn't updated. graph/BM25 absence = WARN only (local artifacts).
- Stop hook — **blocks turn-end once** if `apps/`/`packages/` changed with no wiki update this session.
- `.husky/post-commit` — auto-rebuilds graphify graph (incremental, AST-only, background) on code commits. Graph never silently rots.

## US W-form intake (W-9 / W-8BEN / W-8BEN-E)

Portal-primary self-cert (beneficial owner signs). Portal procedures (`getTaxFormDetermination`, `saveTaxFormDraft`, `submitTaxForm`, `getMyTaxForms`) on `routers/portal/portal-tax-form-router.ts` — IDOR-scoped to `ctx.contractorId`; ESIGN ip/actorId/signedAt server-derived; submit = `applyTreaty` + `buildFormSnapshot` + `supersedeAndInsert` + CONTRACTOR audit in one `$transaction`. Append-only: only DRAFT mutable, re-cert supersedes. Full SSN never in `snapshotJson` (last-4 only). Staff get `taxForm` namespace (read/track + request) — no on-behalf signing; full-SSN reveal stays on `contractor.revealSsn`. Whole surface flag-gated on `module.us-expansion` (`middleware/require-us-expansion-flag.ts` + `root.ts` conditional-spread). Services: `treaty-rate.service.ts`, `tax-form.service.ts`, `tax-form-routing.ts`. **UI:** portal wizard `components/portal/tax-forms/` (`tax-form-wizard.tsx` container + `hooks/use-tax-form-wizard.ts` sole tRPC boundary + determination/W-9/W-8BEN/W-8BEN-E/attest/receipt steps; route `portal/tax-form`); attestation gate = real `<input type=checkbox>` perjury + typed-name match + legal-signature affirmation; treaty article/rate announced via `aria-live`. Staff card `components/contractors/tax-forms/tax-form-status-card.tsx` reuses `SsnMaskedReveal` + `UspsAddressStatusPill` idiom. i18n `TaxFormWizard`/`TaxFormStaff` en/de/pl/ar. Detail: [[domains/us-tax-forms]] · [[domains/portal-external]] · [[structure/api-routers-catalog]].

## First-run org onboarding

New user with no org → `DashboardShellContainer` (`components/layout/dashboard-shell.tsx`) renders `OrganizationOnboardingContainer` (`components/onboarding/organization-onboarding.tsx`) instead of the shell, so tenant procedures never throw `tenantNoActiveOrganization`. Create via Better Auth `authClient.organization.create` + `setActive` (no tRPC), then reload. Detail: [[domains/onboarding-and-import]].

## AuditLog is DB-level append-only

`AuditLog` is append-only in Postgres, not by convention (migration `20260617000000_auditlog_append_only`): a `BEFORE UPDATE` trigger rejects **every** UPDATE; the `auditlog_delete` RLS policy permits a DELETE **only** inside a tx that called `allowAuditPurge(tx)` (`@contractor-ops/db`, `packages/db/src/rls.ts`). Sole caller = GDPR erasure (`routers/compliance/gdpr.ts`). Never `tx.auditLog.update*` (trigger throws) or `.delete*` without `allowAuditPurge` (RLS denies). To "fix" a row, INSERT a new one. Detail: [[patterns/audit-log]] · [[patterns/tenant-and-audit]].

## OCR AI kill-switch

`processOcrExtraction` (`services/ocr-extraction.ts`) gates Claude Vision on `killswitch.ai-invoice-parser` (`default: true`, `killWhenUnknown: true`). Off or Unleash unreachable → skip the AI call, keep the upload persisted, mark `OcrExtraction` FAILED with a manual-entry message + `ocr.skipped` metric. Region for per-org targeting comes from `resolveOrgRegion` (`Organization.dataRegion`, default EU) since the QStash callback has no tenant ctx. Detail: [[domains/documents-and-ocr]] · [[patterns/feature-flags]].

## Contractor list insight band + view modes

The `/contractors` list page is two layers — an insight band (visuals) + the data table — arranged by a per-user view mode. Band = `components/contractors/insights/`: attention rail (at-risk / expiring / payment-blocked / stalled, each a click-to-filter facet) + composition strip (lifecycle / type / jurisdiction chips + health ribbon). Sole tRPC boundary `hooks/use-contractor-insights.ts` → `contractor.insights`. View mode persisted client-side in `hooks/use-contractor-list-view.ts` (Zustand `persist`, localStorage `contractor-list-view`; in-page `ViewModeSwitcher` + Settings `ContractorViewSetting` write the same store — the stored value IS the default). Modes: visuals-first/last, data-oriented, tabbed, single.

**Faceting + consistency:** band + table share `contractorFiltersSchema` + `buildContractorListWhere` (`contractor-shared.ts`), but `contractor.insights` aggregates the **core** population (status/owner/team/billingModel/search only — segment+attention facet groups EXCLUDED) so segment counts don't collapse while drilling. So with a facet filter active, band counts are intentionally broader than the table. Guaranteed: `atRiskCompliance === composition.health.red` (shared `computeListHealthBadge` JS tally, since health is JS-derived). Clicks write the shared `useContractorFilters` nuqs state. New `list` facets `countryCode`/`expiringWithin`/`paymentBlocked`/`stalled`. Detail overview leads with compliance + `financialPulse` widgets (`contractor-profile/overview/`), fields demoted to a collapsible. Detail: [[domains/contractors-engagements]] · [[structure/web-vite-domains]].

## Worker-model abstraction (Theme B gate)

`Worker` (`packages/db/prisma/schema/worker.prisma`) is the org-scoped identity root for the workforce union — contractors today, employees from Phase 90. `Contractor` links via a sidecar `workerId String @unique` 1:1 FK (`Contractor.id` is **stable**, not a re-key); `Worker` is tenant-owning and **absent from `globalModels`** (inherits `withTenantScope`). Contractor reads are `workerType`-scoped by `withWorkerTypeDefault` (`packages/db/src/worker-type.ts`) chained outermost — injects `workerType='CONTRACTOR'` unless the caller sets it (explicit-where-wins; `worker`/`employee` routers pass an explicit type). Its blind spot is raw SQL: the 4 `$queryRaw FROM "Contractor"` sites are contractor-only-by-table, annotated `// contractor-only-raw-sql:`, and `check:contractor-rawsql-workertype` (in `lint:ci`) fails any new unannotated one. The link was populated by an idempotent (`WHERE workerId IS NULL`) + reversible (`--rollback`) + per-region backfill (`packages/db/scripts/backfill-worker.ts`); two-step migration ordering A (nullable) → backfill → B (`NOT NULL`+FK, **last**). `worker`/`employee` tRPC + the `/employees` UI are dark behind `module.workforce-employees` (three-layer flag-off — `METHOD_NOT_FOUND` / `FORBIDDEN` / `useFlag` removal); per-type HR fields gate on a separate `employee` RBAC resource + 4 HR roles (BFLA fence, never a contractor mutation, not granted to `owner`). Detail: [[domains/worker-foundation]] · [[structure/prisma-schema-areas]] · [[structure/api-routers-catalog]] · [[patterns/rbac-permissions]].

## Employee registry (Theme B gate)

Per-market employee onboarding — an employee is a `Worker(workerType='EMPLOYEE')` + a tenant-owning 1:1 `EmployeeProfile` (`packages/db/prisma/schema/employee.prisma`, `workerId String @unique` FK — **no standalone `Employee` table**). `employeeRegistryRouter` (`packages/api/src/routers/employee/employee-registry-router.ts`) is `mergeRouters`-composed into the staff `employeeRouter` (`routers/core/employee.ts`): `register` (`employee:create`) validates per-market fields via `validateEmployeeCountryFields` + the 8 greenfield ID validators (`packages/validators/src/employee-validators.ts`), encrypts PESEL/Iqama/Emirates-ID via `encryptPii` on `EMPLOYEE_PII_ENCRYPTION_KEY` + SSN via `encryptSsn` on `SSN_ENCRYPTION_KEY` into dedicated `*Encrypted`/`*Last4` columns, splits the promoted typed columns (`saudizationCategory`/`etat`/`employmentStatus`) out of `countryFields` JSON, creates `Worker(EMPLOYEE)` + `EmployeeProfile` in one `$transaction`, **`omit`s every `*Encrypted` on return**, and writes an `employee.registered` audit row (`resourceType: 'ORGANIZATION'` — `EntityType` has no EMPLOYEE member). Emirates-ID format blocks but its checksum is **advisory** (`checksumAdvisory`, never throws). `revealPii` (`employeePii:read`, input `{ workerId, field }`) field-routes the decrypt + writes `employee.<field>.revealed` — **staff-only, never on `portalAppRouter`**. National IDs never enter `countryFields` (each per-market schema is `.strict()`); reference lists (ZUS/NFZ/urzędy/Krankenkassen) + ELStAM are versioned adviser-verify LOCAL-ONLY seeds + a no-network `elstam-stub.ts` — **no live gov API**. UI `apps/web-vite/src/components/employees/` (page → wired `EmployeeComplianceSection` → `use-employee-compliance` sole tRPC boundary → presentational, NO container; flag `module.workforce-employees` render-tree removal; i18n in `messages/{en,de,pl,ar}.json` under `Employees`). Deferred: live per-region migration apply + the web-vite RBAC mirror (`use-permissions.ts`/`memberRoles`) granting `employee`/`employeePii` to HR roles (controls fail closed until wired). Detail: [[domains/employee-registry]] · [[structure/prisma-schema-areas]] · [[structure/api-routers-catalog]] · [[patterns/rbac-permissions]].

## Personnel file / akta osobowe (Theme B gate)

Jurisdiction-correct personnel file (PL akta osobowe cz. A/B/C/D, DE Personalakte, UK file, US I-9+file) on the `Worker` identity. `PersonnelFile` (`packages/db/prisma/schema/personnel.prisma`) is a 1:1 tenant-owning sidecar via `workerId @unique` (`countryCode` snapshot + `hireDate`/`terminatedAt` retention seams, null `terminatedAt` = active = retain indefinitely); `PersonnelFileDocument` references the `Document` stack 1:1 with an optional `section PersonnelFileSection?` (4-section view = **enum-on-link**). Both tenant-owning, NOT in `globalModels`; additive migration `__personnel_file_additive`, live apply DEFERRED. **Per-section RBAC** = resource-per-section `employeeFileA..D` (each r+w) wired into the 4 HR roles (payroll→C not B), kept OUT of owner `allPermissions` (BFLA fence); the router's `hasSectionPermission` (`routers/core/personnel-file/section-access.ts`) decides the lock at the permission layer BEFORE any query — a locked section returns NO document payload/count. **Retention** registers on the SHARED `RETENTION_YEARS` map (8 akta tokens, no parallel engine); `getPersonnelRetentionCutoff` (`packages/db/src/retention-policy.ts`) is event-anchored (`HIRE_DATE|TERMINATION_DATE|DOCUMENT_DATE` + `max()` US I-9 + indefinite-while-active fail-closed); both deletion chokepoints (soft-delete + data-purge cron akta-hold-aware sweep) route personnel rows. **Erasure** `personnelFile.requestErasure` → per-section erased/retained dispositions; `fullErasureClaimed = retained.length===0` (never claims full erasure under a hold); `personnel_file.erasure_retained_under_statute` audit in-tx; `allowAuditPurge` stays GDPR-only. **Classifier** `classifyPersonnelDocument` (`services/personnel-classifier.ts`): taxonomy → `killswitch.ai-personnel-classifier` (default-on, killWhenUnknown, non-gated) Claude-Vision seam → `PENDING_REVIEW` admin step; never blocks the upload; concrete Claude adapter deferred (AI tail degrades to admin queue). `personnelFile` router gated by `module.workforce-employees` in `workforceRouters`. UI `apps/web-vite/src/components/employees/personnel-file/` (5-state shell, server-driven locked card, classify-review queue, RODO erasure dialog branching STRICTLY on `fullErasureClaimed`; locked adviser-verify phrase in `packages/validators/src/legal/personnel-file.ts`; i18n en/de/pl/ar). Detail: [[domains/personnel-file]] · [[structure/prisma-schema-areas]] · [[structure/api-routers-catalog]] · [[structure/key-services]] · [[patterns/rbac-permissions]] · [[patterns/audit-log]] · [[patterns/feature-flags]].

## Reading order

1. [[patterns/agent-delegation]] for bulk edits / subagent routing
2. [[patterns/ui-skills-routing]] for UI skill stack
3. [[patterns/web-vite-data-layer]] + `apps/web-vite/ARCHITECTURE.md`
4. `semble search` before code edits
