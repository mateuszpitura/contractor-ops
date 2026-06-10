---
title: Wiki log
type: log
---

# Wiki log (append only)

## 2026-06-09 — Brain vault bootstrap

- Scaffolded `.planning/brain/` from claude-obsidian v1.9.2 (generic + github use case)
- Curated ingest: codebase maps, MEMORY, CONCERNS, web-vite ARCHITECTURE, PATTERNS 70/72/82 → `.raw/`
- Hub pages: invoice-to-payment, web-vite-data-layer, tenant-and-audit
- Hooks: `wiki-brain-inject.sh` for hot cache at SessionStart/PostCompact
- Removed legacy `.planning/obsidian-vault/`

## 2026-06-09 — Full codebase wiki build

- Meta: agent-discovery, page-template, refresh-triggers
- Structure: 8 pages (topology, apps, packages, router groups/catalog, web-vite domains, prisma, cron)
- Patterns: 12 pages (extended existing 3 + 9 new)
- Domains: 19 pages (finance, HR, compliance, platform)
- Integrations: 16 pages (framework + providers + infra)
- Decisions: arch-decisions, tech-debt-hotspots
- Sources: 12 summaries for `.raw/` files
- Updated: index.md, hot.md, overview.md; INDEX.md §8 structure compass pointer

## 2026-06-10 — Design patterns registry (Faza 0)

- Added `patterns/registry-plugin.md` — register/get convention, existing registries, when registry vs switch
- Updated `patterns/_index.md`, `CONVENTIONS.md` § Registry plug-in pattern

## 2026-06-10 — Money rounding policy

- Added `patterns/money-rounding.md` — integer minor units, HALF-UP default, skonto FLOOR / interest HALF-UP exceptions, no-float invariant
- Aligned code + comments: `skonto.ts` (kept floor), `late-payment-interest.ts` (kept half-up), `exchange-rate.ts` (finite-guard + single round), `bank-statement.ts` (zod-validate external amount before single round)
- Updated `patterns/_index.md`; appended invariant to `.planning/MEMORY.md`
- Execution plan: user-source + calendar + IdP factory + tax validators + UI shells (see `.cursor/plans/design_patterns_audit_c748b798.plan.md`)

## 2026-06-10 — Wave 2 depth pass

- Expanded all 16 `integrations/*` to full page template (Purpose, Flow, Agent mistakes)
- Added: `patterns/ci-guards`, `patterns/i18n-and-locales`, `patterns/better-auth-staff`
- Added: `domains/notifications-and-reminders`, `meta/graphify`
- Verified `HEAD` still `70f5782` — no `map-codebase` refresh required
- Updated indexes, INDEX.md graphify pointer, BM25 re-chunk

## 2026-06-10 — Wave 3 gap closure

- New pages: `integrations/sentry`, `couriers`, `gov-api`; `structure/cms-and-landing`, `key-services`
- Expanded all 12 `sources/*` with Purpose, verify_with, Agent mistakes
- `scripts/check-wiki-brain.mjs` + `pnpm check:wiki-brain` in `lint:ci`
- `wiki-brain-inject.sh`: session warn on missing graph / stale router catalog
- Graph: `graphify update` AST → `.planning/graphs/graph.json` (~19k nodes)
- Docs: graphify command fix (`update` not `extract` for AST-only)

## 2026-06-10 — Knowledge refresh binding rule

- `CLAUDE.md` § Knowledge refresh (mandatory table + commands)
- `.claude/core-values.yml` § Knowledge refresh → `pnpm standards:gen`
- `wiki-brain-inject.sh`: SessionStart rule block; Stop `KNOWLEDGE_REFRESH_REQUIRED` on structural code paths
- Cursor: `25-wiki-brain.mdc`, `20-tools-workflow.mdc`; wiki `refresh-triggers`, `agent-discovery`

## 2026-06-10 — Documentation follows code (broadened)

- Renamed principle: wiki **tracks code** — every product change, not only routers/refactors
- Hook: all `apps/*` / `packages/*` (excl. tests/generated) → `KNOWLEDGE_REFRESH_REQUIRED`; `DOC_DRIFT_WARN` if no wiki edit
- `25-wiki-brain.mdc` globs extended to `apps/**` + `packages/**`; full change-type table
- `refresh-triggers.md` expanded; `core-values.yml` § Documentation follows code

## 2026-06-10 — Obsidian graph fix

- Root cause: `.obsidian/graph.json` filter `path:wiki file:f` + zoom 0.12; 220 broken parent-relative wikilinks
- Fixed: graph filter `path:wiki`, color groups by folder, `normalize-wiki-wikilinks.mjs` (83 files)
- New: `wiki/meta/obsidian-setup.md` — Obsidian graph vs graphify vs BM25

## 2026-06-10 — P0/P1/P2 polish (code-verified)

- P0: `.gitignore` graph.json + `.vault-meta/`; GRAPH_REPORT + README regen policy
- P1: `web-vite-domains` full folder map; router bullets in settings/workflows/invoice; `public-api` route table
- P2: `domains/staff-dashboard`, `integrations/slack`, `patterns/audit-log`, `meta/vault-map.canvas`
- Split `teams.md` / `slack.md`; removed dead `registry-plugin` from patterns index

## 2026-06-11 — Design patterns audit implementation (Fazy 1–4)

- **Faza 1:** `user-source-registry`, `calendar-provider-registry`, `createConfiguredDeprovisionableAdapter`, `tax-id-validators/registry`; API services delegate (onboarding-import, calendar-event, idp deprovision, tax validation)
- **Faza 2:** `jurisdiction-resolver` in compliance-policy; `integration-status-mapping` generic; `loadIntegrationConnection` + Jira router pilot
- **Faza 3:** `useListDataTable`, `EntitySummarySheet`, `WizardDialogShell`; migrated contractor/contract tables + side panels + payment-run panel; contract wizard on shell; GWS provider section collapsed
- **Faza 4:** `useDirection`, `FeatureGate`, `doc-registry` register-on-import
- **Tests:** Vitest for user-source, idp factory, mergeByEmail, tax registry, jurisdiction-resolver, use-list-data-table
- **Wiki:** `registry-plugin.md`, `data-tables-workbench.md`, `web-vite-data-layer.md` updated

## 2026-06-11 — design patterns rest slice

- `structure/web-vite-domains.md` — shared UI table: `useListDataTable`, `EntitySummarySheet`, `WizardDialogShell`, `FeatureGate`, `useDirection`; collapsed GWS provider section note
- `patterns/registry-plugin.md` — Faza 2 `loadIntegrationConnection` + Jira pilot; `verify_with` includes `integration-connection.ts`
- `hot.md` — verify commands for design-patterns audit closure
- `HEAD` unchanged (`70f5782`) — `source_commit` frontmatter still valid

## 2026-06-11 — design patterns batch 2

- **Collapsed sections:** settings `dpd`, `ups`, `ksef` provider sections — hook + skeleton + view, no `*-provider-section-container.tsx` (integrations batch already done)
- **FeatureGate:** GWS, Jira, Linear, Teams `*-provider-section.tsx` use `layout/feature-gate.tsx`
- **RTL shells:** `useDirection()` in `EntitySummarySheet`, `WizardDialogShell`
- **Workflow-runs:** `useWorkflowRunsDataTable` adopts `useListDataTable` in domain hook (not in `data-table.tsx`)
- **Wiki:** `structure/web-vite-domains.md`, `patterns/web-vite-data-layer.md`, `patterns/data-tables-workbench.md`, `hot.md`
## 2026-06-11 — design patterns batch 3

- `loadOrgIntegrationConnection`: `status: 'any'`, `optional: true`; all integration routers migrated off inline `findFirst`
- Collapsed `api-keys-tab-container` into `api-keys-tab.tsx`
- Workflow runs: column visibility toggle + persisted `workflow-runs-table-columns`

## 2026-06-11 — design patterns batch 4

- **`integrationProcedure`:** `packages/api/src/lib/integration-procedure.ts` — `tenantProcedure` → optional permission/tier; `integrationSettingsProcedure` helper; Jira + Linear router pilots
- **`useListDataTable` in list hooks:** `useContractorList`, `useContractList`, `useInvoiceList` own sort/selection/column visibility; presentational `*-table/data-table.tsx` props-only (aligns with workflow-runs pattern)
- **`EntitySummarySheet`:** `invoice-side-panel.tsx` migrated to shared shell (`EntityDetailItem` + `useDirection` RTL)
- **`CachedStore`:** constructor param property removed for `erasableSyntaxOnly` — explicit `this.backing` assign in `packages/secrets/src/cached-store.ts`
- **Wiki:** `patterns/registry-plugin.md`, `patterns/web-vite-data-layer.md`, `structure/web-vite-domains.md`, `hot.md`
- `HEAD` unchanged (`70f5782`) — `source_commit` frontmatter still valid

## 2026-06-11 — design patterns phase 5 (final)

- **5A:** `integrationProcedure` factories on teams (2), google-workspace (5), peppol (9), ksef (5) — 21 procedures total
- **5B:** `EntitySummarySheet` on `workflow-side-panel.tsx`, `approval-queue/side-panel.tsx`
- **5C:** `useListDataTable` in `use-equipment-table.ts`; new `use-report-table-state.ts` for report tables
- **5D:** `WorkbenchDataTable` + wizard `AlertDialogContent` set `dir={useDirection()}`; JSDoc on `use-direction.ts`
- **5E:** `deprovisioning.ts` — 10 factory procedures (8× `integrationProcedure` + 2× `integrationSettingsProcedure`)
- **Wiki:** `registry-plugin.md`, `web-vite-data-layer.md`, `data-tables-workbench.md`, `structure/web-vite-domains.md`, `hot.md`
- **MEMORY:** § Design patterns audit (2026-06)
- `source_commit` bumped to `365943fc` on edited wiki pages

## 2026-06-09 — design patterns phase 6 (close-out)

- **6A:** Integration routers migration complete — zero plain `tenantProcedure` in `integrations/*`; teams read queries on `integrationSettingsProcedure('read')`; Jira/Linear linked-issue paths gated `workflow:read`
- **6B:** `PaymentRunSidePanelSkeleton` uses shared `EntitySummarySheet` (`payment-run-side-panel.tsx`)
- **6C:** `DataTableColumnToggle` in report tables; i18n `Reports.columnToggle` + `columns.<id>` (en/de/pl/ar); state via `useReportTableState`
- **6D:** Collapsed settings sections — `my-calendar-section`, `org-calendar-section`, `integrations-tab` (hooks co-located; no `*-container` split)
- **Wiki:** `registry-plugin.md`, `web-vite-data-layer.md`, `web-vite-domains.md`, `data-tables-workbench.md`, `hot.md`
- **MEMORY:** 2 bullets appended (integration RBAC closure + reports column toggle / settings collapse)
- `source_commit` bumped to `19f747bc` on edited wiki pages

## 2026-06-09 — design patterns phase 7

- **7A:** Collapsed 9 thin settings `*-container.tsx` — wired hook + `*View` in tab/section files (`audit-log-tab`, `approval-chains-tab`, `feature-flags-tab`, `out-of-office-section`, `portal-subdomain-section`, `expiry-reminder-defaults`, `reminder-rules-section`, `admin-branding-section`); calendar route inlined in `pages/dashboard/settings/calendar.tsx`
- **7B:** `EntitySummarySheet.titleVisuallyHidden` + `PaymentRunSidePanelSkeleton` uses `Payments.sidePanel.loadingTitle` (sr-only)
- **7C:** `core/integration.ts` — 5 Slack/generic procedures on `loadOrgIntegrationConnection` (`listUserMappings`, `linkUser`, `syncUsers`, `disconnectGeneric`, `getSyncLog`); `getSlackStatus` keeps `include: connectedBy` (sole inline `findFirst`)
- **Wiki:** `web-vite-data-layer.md`, `web-vite-domains.md`, `registry-plugin.md`, `hot.md`
- **MEMORY:** phase 7 bullets

## 2026-06-09 — design patterns phase 8

- **8A:** 14 thin containers removed — settings index (transfer-title, invoice-matching, notification-preferences, gdpr), tax sections (rates/calculator/certificates), integrations slack (sync + mapping), ksef-controls, consent section, e-invoicing cards (peppol, leitweg, transmissions log)
- **Tests:** presentational tests target `*View` exports (`slack-user-mapping`, `transfer-title-settings`, `peppol-participant-card`, `ups-provider-section`)
- **Wiki:** `web-vite-data-layer.md`, `web-vite-domains.md`, `hot.md`

## 2026-06-09 — design patterns phase 9

- **9A–9D:** 27 thin settings containers removed (parallel subagents) — e-invoicing dialogs/rows + `ksef-sync-history`; API key dialogs + user pickers; workflow/reminder/carrier + consent/ksef setup; integrations IDP/slack/provider cards
- **9E:** 19 settings `__tests__` files fixed — `*View` imports + mocks on wired module paths (not deleted `*-container` paths); 220 vitest pass
- **Remaining:** 8 route orchestrators under `settings/*-container.tsx` + `org-settings-form-container.tsx`
- **Wiki:** `web-vite-data-layer.md`, `web-vite-domains.md`, `hot.md`, `MEMORY.md`

## 2026-06-09 — design patterns phase 10

- **10A:** `kleinunternehmer-toggle-container` + `org-settings-form-container` collapsed — `KleinunternehmerToggleView` + wired toggle; `OrgSettingsFormSection` (+ alias `OrgSettingsFormContainer`)
- **10B:** `members/container.tsx` deleted — wired `UsersTable` in `data-table.tsx`; `settings-e-invoicing-container` + `settings-e-invoicing-log-container` inlined into route pages
- **Remaining:** 5 route orchestrators (`settings-index`, `tax`, `payments`, `members`, `workflow-roles`)
- **Wiki:** `web-vite-data-layer.md`, `web-vite-domains.md`, `hot.md`, `MEMORY.md`

## 2026-06-09 — design patterns phase 11–12

- **11:** Inlined 5 settings route orchestrators + `bacs-submitter-form-container` into `pages/dashboard/settings/*.tsx` — settings folder has zero `*-container.tsx`
- **12A:** Billing collapse — `usage-dashboard`, `proration-preview`, `top-up-dialog`, `billing-overlay`, `billing-tab` wired; `BillingTierGate` replaces `FeatureGateContainer`
- **12B:** Einvoice `compliance-detail` + `compliance-widget` wired in section files; integrations thin dialogs (jira status mapping, teams fallback approver, jira activity summary, GWS sync status)
- **Tests:** 10 files mock `layout/feature-gate` instead of deleted billing container; 401 vitest pass in settings+integrations scope
- **Wiki:** `web-vite-data-layer.md`, `web-vite-domains.md`, `hot.md`, `MEMORY.md`

## 2026-06-09 — design patterns phase 13A

- **13A:** Collapsed all 8 remaining integration orchestrators — `attach-doc-dialog`, `doc-links-section`, `teams-channel-mapping-card`, `jira-task-config`, `linear-task-config`, `linear-status-mapping-dialog`, `jira-project-mapping-dialog`, GWS `directory-import-wizard`; wired exports + `*View` in co-located files
- **Imports:** `task-card-run`, `task-card`, provider sections updated to wired module paths
- **Wiki:** `web-vite-data-layer.md`, `web-vite-domains.md`, `hot.md`, `MEMORY.md`

## 2026-06-10 — design patterns phase 13B (payments)

- **13B:** 6 thin payments containers collapsed — View+wired in `skonto-apply-checkbox`, `wht-summary-card`, `step-review`, `bacs-preview-card`, `bank-statement-dialog`, `payment-run-side-panel` (skeleton + BACS/skonto flags in wired export)
- **Deferred:** `payments-container`, `new-payment-run-dialog-container`, `step-select-container`
- **Tests:** 4 files → `*View` + mock wired sibling paths; 197 payments vitest pass
- **Wiki:** `web-vite-data-layer.md`, `web-vite-domains.md`, `hot.md`, `MEMORY.md`

- 2026-06-10: Onboarding user-source registry — GWS pageToken pagination, Linear cursor pagination, Zod boundaries, unified fetch errors; fetchPeople returns sourceErrors; getHealth exposes scopeCapabilities; GWS provider section wired.

## 2026-06-10 — design patterns phase 13C (contractors)

- **13C:** Collapsed **22** thin `contractors/*-container.tsx` (≤18 lines) — View+wired in co-located `*.tsx`; new `contractor-classification.tsx`; `TabDocumentsSection` in `tab-documents.tsx`
- **Deferred (20):** list, detail, classification dashboard, wizard shell, country-compliance, tab-payments, engagement-detail/classification, free-zone, profile orchestrators, compliance upload/override dialogs, DRV panel, document-history, etc.
- **Tests:** collapsed-component tests use `*View`; mocks updated to wired module paths (`generate-sds-button.js`, `recompute-compliance-dialog.js` partial mock, etc.)
- **Verify:** `pnpm check:web-vite-data-layer` OK; contractors vitest 543/596 pass (6 pre-existing unrelated suites fail on auth/TRPC provider mocks)
- **Wiki:** `web-vite-data-layer.md`, `web-vite-domains.md`, `hot.md`, `MEMORY.md`

## 2026-06-10 — design patterns phase 14A (payments)

- **14A:** Collapsed last 3 payments orchestrators — `step-select` View+wired in `step-select.tsx`; `NewPaymentRunDialog` wired in `new-payment-run-dialog-view.tsx`; payments list inlined into `pages/dashboard/payments.tsx` as `PaymentsPageContent` (settings wave 11 pattern)
- **Deleted:** `payments-container.tsx`, `new-payment-run-dialog-container.tsx`, `step-select-container.tsx`
- **Exports:** `NewPaymentRunDialog` from `new-payment-run-dialog/index.tsx` (replaces `NewPaymentRunDialogContainer`)
- **Tests:** `step-select.test.tsx` → `StepSelectView`; `new-payment-run-dialog.test.tsx` comment updated
- **Wiki:** `web-vite-data-layer.md`, `web-vite-domains.md`, `hot.md`, `MEMORY.md`

## 2026-06-10 — design patterns phase 14A (invoices + approvals thin)

- **14A:** Collapsed **8** thin containers (≤23 lines) — View+wired in co-located files:
  - **Invoices (6):** `match-card`, `status-chip-bar`, `skonto/skonto-banner`, `einvoice-tab/download-zugferd-pdf-button`, `reverse-charge-banner`, `vat-rate-selector`
  - **Approvals (2):** `audit-timeline`, `chain-tracker`
- **Deferred (>23 lines):** `einvoice-compliance-summary-tile-container`, `invoice-ocr-section-container`, intake containers, `invoices-list-container`, `invoice-detail-container`, `approval-queue-container`, etc.
- **Imports:** `invoice-detail-container`, `invoices-list-container`, `integration-banners`, `invoice-metadata-form`, `einvoice-tab` updated to wired module paths
- **Verify:** `pnpm check:web-vite-data-layer` OK; invoices + approvals vitest
- **Wiki:** `web-vite-data-layer.md`, `web-vite-domains.md`, `hot.md`, `MEMORY.md`

## 2026-06-10 — design patterns phase 14B (contractors)

- **14B:** Collapsed **20** deferred `contractors/*-container.tsx` — View+wired in co-located `*.tsx` or new siblings:
  - **Route orchestrators (5):** `contractor-list.tsx`, `contractor-detail.tsx`, `engagement-detail.tsx`, `engagement-classification.tsx`, `classification/classification-dashboard.tsx`
  - **Profile tabs (4):** `tab-contracts`, `tab-payments`, `workflows-tab`, `tabs/invoices-tab`
  - **Classification/compliance (11):** `classification-tile`, `classification-disclaimer-dialog`, `classification-wizard-shell`, `country-compliance-section`, `free-zone-assignment`, DRV panel, IR35 panel, document-history-list, override/upload review dialogs, `profile-header`
- **Deleted:** all 20 `contractors/*-container.tsx` files
- **Barrel/index:** `ir35-chain/index.ts`, `drv-clearance/index.ts`, `classification-documents/index.ts` → wired module paths
- **Tests:** mock paths updated to wired siblings; `country-compliance-section.test` mocks `use-permissions`
- **Verify:** `pnpm check:web-vite-data-layer` OK; contractors vitest 572/596 pass
- **Wiki:** `web-vite-data-layer.md`, `web-vite-domains.md`, `hot.md`, `MEMORY.md`
- 2026-06-10 (round 2): Fixed healthQuery blocker in integration hooks; source error codes; fetchPeople output validation; partial-import Alert; registry pagination cap + Slack fetchJsonWithTimeout; expanded tests.

## 2026-06-10 — design patterns phase 15A (invoices + approvals medium-thin containers)

- **15A:** Collapsed **14** medium-thin (≤48 lines) `*-container.tsx`:
  - **Invoices (13):** `einvoice-compliance-summary-tile`, `invoice-ocr-section`, `intake-list`, `intake-upload-dialog` (`IntakeUploadDialogFrame` + wired), `import-split-button`, intake detail panes (pdf/match/validation/actions-bar), `einvoice-tab`, `skonto-form-section`, `invoice-metadata-form`, `invoice-intake-page` (new sibling)
  - **Approvals (1):** `approval-queue/side-panel` (`ApprovalSidePanelView` + `ApprovalSidePanel`)
- **Deleted:** all 14 `*-container.tsx` listed above
- **Imports:** pages (`invoices`, `invoice-detail`, `approvals`, `intake`), `intake-detail-client`, `invoice-detail-tabs`, `top-bar`, `import-split-button`
- **Tests:** presentational `*View`; frame tests use `IntakeUploadDialogFrame`; mock paths → wired siblings (not deleted containers)
- **Verify:** `pnpm check:web-vite-data-layer` OK; 15A-scoped vitest 78/78 pass
- **Wiki:** `web-vite-data-layer.md`, `web-vite-domains.md`, `hot.md`, `MEMORY.md`

## 2026-06-10 — design patterns phase 15B (invoices + approvals orchestrators)

- **15B:** Collapsed **6** deferred orchestrators:
  - **View+wired:** `invoice-upload-area.tsx` (`InvoiceUploadAreaView` + `InvoiceUploadArea`), `intake/intake-detail.tsx` (`IntakeDetail`), `late-interest/late-interest-card.tsx` (`LateInterestCardView` + `LateInterestCard`)
  - **Page inline:** `pages/dashboard/invoices.tsx` (`InvoicesListPageContent`), `invoice-detail.tsx` (`InvoiceDetailPageContent`), `approvals.tsx` (`ApprovalsPageContent`)
- **Deleted:** `invoice-upload-area-container`, `intake-detail-container`, `late-interest-card-container`, `invoices-list-container`, `invoice-detail-container`, `approval-queue-container`
- **Imports:** `invoice-metadata-form-container`, `contractors/.../invoices-tab` → wired `InvoiceUploadArea` / `LateInterestCard`
- **Tests:** `invoice-upload-area.test` → `InvoiceUploadAreaView`; `invoices-tab.test` mock path → `invoice-upload-area.js`
- **Verify:** `pnpm check:web-vite-data-layer` OK
- **Wiki:** `web-vite-data-layer.md`, `web-vite-domains.md`, `hot.md`, `MEMORY.md`

## 2026-06-10 — Onboarding import + integration health wiki sync

- **Code context:** user-source-registry (pagination cap, Zod schemas, Slack `fetchJsonWithTimeout`); `fetchPeople` → `{ people, sourceErrors }` with `.output()`; `getHealth.scopeCapabilities`; integration hook split (`useIntegrationHealthProviderSection`)
- **Updated:** `domains/onboarding-and-import.md` (full flow, API contract, UI surfaces); `integrations/google-workspace.md` (health hook, reconnect banner); `integrations/framework-core.md`, `integrations/slack.md`; `structure/api-routers-catalog.md` (notable contracts); `structure/key-services.md`; `structure/web-vite-domains.md`; `patterns/registry-plugin.md`
- **Cache:** `hot.md`, `log.md`; `source_commit` = `19f747b`
- **Verify:** `pnpm check:wiki-brain` + BM25 rebuild

## 2026-06-10 — wave 16B contracts container collapse

- **16B:** Collapsed **12** `contracts/*-container.tsx`:
  - **View+wired:** `wizard-dialog` (`ContractWizardDialogView` + `ContractWizardDialog`), `send-for-signature-dialog`, `detail-header` (`DetailHeaderWired`), `signing-progress-bar` (`SigningProgressBarPanel`), `overview-tab`, `documents-tab`, `amendments-tab`, `linear-linked-issues-panel`, `embedded-signing-modal`, `health-check-panel`
  - **Page inline:** `pages/dashboard/contracts.tsx` (`ContractsListPageContent`), `contract-detail.tsx` (`ContractDetailPageContent`)
- **Deleted:** all 12 contracts `*-container.tsx` under `components/contracts/`
- **Imports:** `contract-detail-tabs`, `send-for-signature-button`, `top-bar`, contractor profile (`tab-contracts`, `profile-header`), `workflow-run/task-checklist` → wired exports
- **Tests:** `*View` + wired mock paths (`contract-detail-tabs`, `send-for-signature-dialog`, `documents-tab` mock `drop-zone.js` / `document-list.js`)
- **Verify:** `pnpm check:web-vite-data-layer` OK; contracts vitest 249/269 pass (19 pre-existing failures: `contract-side-panel` useLocale, `data-table` missing `selectedRows` in test props)
- **Wiki:** `web-vite-data-layer.md`, `web-vite-domains.md`, `MEMORY.md` (not `hot.md`)

## 2026-06-10 — wave 16C equipment container collapse

- **16C:** Collapsed **11** `equipment/*-container.tsx`:
  - **View+wired:** `equipment-form`, `assignment-dialog`, `shipment-form`, `carrier-shipment-form`, `equipment-table/data-table` (`EquipmentDataTable`), `equipment-detail-header`, `tab-shipments`, `shipment-timeline`, `return-approval-banner`
  - **Page inline:** `pages/dashboard/equipment.tsx` (`EquipmentListPageContent`), `equipment-detail.tsx` (`EquipmentDetailPageContent`)
- **Deleted:** all 11 equipment `*-container.tsx` under `components/equipment/`
- **Script:** `check-web-vite-dialog-pattern` PERMANENT_ALLOW → `pages/dashboard/equipment.tsx` (retire/unassign confirm dialogs)
- **Verify:** `pnpm check:web-vite-data-layer` OK; equipment vitest scoped run
- **Wiki:** `web-vite-data-layer.md`, `web-vite-domains.md`, `MEMORY.md` (not `hot.md`)

## 2026-06-10 — wave 16A workflows container collapse

- **16A:** Collapsed **20** `workflows/` + `workflow/credentials-tab-container.tsx`:
  - **View+wired:** `my-tasks-list`, `template-picker-dialog`, `templates/data-table` (`TemplatesTableSection`), `workflow-runs-table/data-table` (`WorkflowRunsDataTableSection`), `workflow-side-panel`, `calendar-task-config`, `template-form`, `task-card` (`TaskCardSection`), `run-header` (`RunHeaderSection`), `task-card-run` (`TaskCardRunSection`), `task-attachments`, `task-comments`, `linear-task-issue-chip`, `workflow-side-panel-linked-jira`, `workflow-side-panel-linked-linear`, `workflow/credentials-tab` (`CredentialsTabSection`)
  - **Page inline:** `pages/dashboard/workflows.tsx` (`WorkflowsListPageContent`), `workflows/detail.tsx`, `template-new.tsx`, `template-detail.tsx`
- **Deleted:** all 20 workflow `*-container.tsx` under `components/workflows/` + `workflow/credentials-tab-container.tsx`
- **Also:** fixed `drop-zone.tsx` duplicate `useDocumentDropZone` import (oxc parse); workflow tests updated to mock wired paths + `*View` components
- **Verify:** `pnpm check:web-vite-data-layer` OK; workflows vitest 234/235 (1 pre-existing hook test: `use-workflow-template-detail` isNotFound)
- **Wiki:** `web-vite-data-layer.md`, `web-vite-domains.md`, `MEMORY.md` (not `hot.md`)

## 2026-06-10 — wave 16D layout + documents + thin time/onboarding/portal

- **16D:** Collapsed **24** thin `*-container.tsx` (View+wired in co-located files; shell exports stay in layout/portal siblings):
  - **Layout (7):** `org-switcher`, `nav-items`, `user-menu`, `cookie-consent-banner`, `top-bar`, `dashboard-shell`, `portal-shell` — wired exports in same `*.tsx`; router/prefetch → `dashboard-shell.js` / `portal-shell.js`
  - **Documents (4):** `drop-zone`, `document-card`, `document-list`, `version-history` — wired in co-located files; **zero** `documents/*-container.tsx`
  - **Time thin (2):** `reconciliation-spot-check`, `reconciliation-table` (new sibling `reconciliation-table.tsx`)
  - **Onboarding thin (3):** `import-progress-tracker`, `source-selection-step`, `confirm-import-step` — skipped orchestrators (`onboarding-import`, `people-review-step`, `project-import-step`)
  - **Portal thin (8, ≤44 lines):** `notification-preferences-section`, `portal-top-bar`, `portal-mobile-menu`, `portal-settings-page`, `portal-invoice-submit` (new), `portal-pending-signatures`, `invoice-submit-form`, `portal-invoice-submit-success` (new) — deferred wave 17: `portal-index`, `login`, `invoices`, `contract-detail`, `time`, etc.
- **Deleted:** all 24 `*-container.tsx` listed above
- **Tests:** mock/import paths → wired siblings (`sidebar`, `document-card`, `reconciliation-table`, `portal-settings-page`, `portal-top-bar`, `portal-upload-replacement-form`); 16D-scoped vitest 48/48 pass
- **Verify:** `pnpm check:web-vite-data-layer` OK
- **Wiki:** `web-vite-data-layer.md`, `web-vite-domains.md`, `MEMORY.md` (not `hot.md`)

## 2026-06-10 — Onboarding import partial errors and registry hardening

- `fetchPeople` / `fetchProjects` return `{ people|projects, sourceErrors }` with `.output()` validation; `fetchPeople` requires `credentialsRef`
- Registry: pagination cap, GWS skip suspended/archived, Slack/Linear invalid email row skip, Zod page schemas
- UI: `allSourcesFailed` routing, refetch sync, source-change reset, GWS `needsReauth` banner (en/pl/de/ar)

## 2026-06-10 — Onboarding wizard gates and import confirm

- Step 2/3 Continue gated by hook `canContinueStep`; `allSourcesFailed` when every selected source errors
- Refetch preserves role/skip/conflict selections; `startImport` uses `resolvedConflicts.name`
- `listSources` `.output()`; Jira missing `cloudId` → `fetch_failed`; step3 partial-error i18n

## 2026-06-10 — wave 17B onboarding + time + compliance orchestrators

- **17B:** Collapsed **6** route/step orchestrators:
  - **Onboarding (3):** `onboarding-import-container` → page inline `pages/dashboard/onboarding-import.tsx` (`OnboardingImportPageContent`); `people-review-step-container` + `project-import-step-container` → wired exports co-located in `people-review-step.tsx` + `project-import-step.tsx`
  - **Time (2):** `time-tracking-container` + `time-detail-container` → page inline `pages/dashboard/time.tsx` + `time-detail.tsx` (`TimePageContent`, `TimeDetailPageContent` + Suspense)
  - **Compliance (1):** `compliance-dashboard-container` → page inline `pages/dashboard/compliance-dashboard.tsx` (`ComplianceDashboardPageContent` + Suspense)
- **Deleted:** all 6 `*-container.tsx` listed above
- **Tests:** onboarding + compliance container tests retargeted to exported `*PageContent`; mock paths → co-located step modules
- **Verify:** `pnpm check:web-vite-data-layer` OK; scoped vitest onboarding/time/compliance — container/page tests green; 3 pre-existing hook/badge failures unchanged
- **Wiki:** `web-vite-data-layer.md`, `web-vite-domains.md`, `MEMORY.md`, `onboarding-and-import.md` (not `hot.md`)

## 2026-06-10 — wave 17C1 zatca/admin/auth/peppol container collapse

- **17C1:** Collapsed **26** `*-container.tsx` across `zatca/` (12), `admin/` (7), `auth/` (4), `peppol/` (3):
  - **View+wired:** zatca onboarding steps (`tax-details-form`, `csr-generation`, `compliance-csid`, `compliance-checks`, `production-certificate`, `onboarding-wizard`), status widgets (`zatca-status-card`, `zatca-connection-pill`, `zatca-stats-cards`, `zatca-compliance-widget`, `zatca-submission-detail`); peppol (`peppol-status-card`, `peppol-wizard`, `peppol-transmission-status`); admin boe-rate (`poller-status-strip`, `data-table` → `BoeRateTableSection`, add/edit/delete dialog `*Wired`)
  - **Page inline:** `pages/dashboard/settings/integrations-zatca.tsx` (`ZatcaIntegrationPageContent`); `pages/admin/boe-rate.tsx` (`AdminBoeRatePageContent`), `classification-engine.tsx` (`ClassificationEnginePageContent`); auth routes (`login`, `register`, `invite`, `verify-email`) — AuthLayout + form/copy inlined
- **Deleted:** all 26 `*-container.tsx` under `components/zatca/`, `admin/`, `auth/`, `peppol/`
- **Imports:** `integrations-tab`, `integration-banners` → wired sibling paths; zatca test mocks updated (`onboarding-wizard.test`, `zatca-status-card.test`)
- **Verify:** `pnpm check:web-vite-data-layer` OK; scoped vitest 273/274 (1 pre-existing `use-peppol.test` toast timeout)
- **Wiki:** `web-vite-data-layer.md`, `web-vite-domains.md`, `MEMORY.md` (not `hot.md`)

## 2026-06-10 — wave 17C2 staff remainder container collapse

- **17C2:** Collapsed **31** non-portal `*-container.tsx`:
  - **Page inline:** `pages/dashboard/organization/{index,teams,projects,cost-centers}.tsx`; `pages/legal/{terms,privacy,breach-notification,sub-processors,privacy-jurisdiction}.tsx`; `pages/dashboard/{index,notifications,reports,unauthorized,classification-expert-help}.tsx`
  - **View+wired:** organization form sheets (`TeamFormSheetWired`, `ProjectFormSheetWired`, `CostCenterFormSheetWired`, `CostCenterCsvImportDialogWired`, `PendingMergesInboxWired`); legal `PrivacyNoticePdfDownloadWired`; idp (`ImpactPreviewPanelWired`, `DeprovisioningRunViewWired`, `DeprovisioningTriggerWired`); saudization (`SaudizationDashboardSection`, `OffboardingTrajectoryBannerWired`); notifications `NotificationPopover`; search `CommandPalette` + shared `JumpCommandPalette`; `OcrReviewPanelWired`, `ImportWizardDialog`, `TosReacceptanceModal`; `ClassificationGuard`
- **Deleted:** all 31 target `*-container.tsx` under organization/, legal/, idp/, saudization/, notifications/, classification/, search/, reports/, ocr/, import/, dashboard/, shared/, root `tos-reacceptance-modal-container.tsx`
- **Renamed:** `dashboard-home-container.tsx` → `dashboard-home.tsx` (`DashboardHome` export)
- **Verify:** `pnpm check:web-vite-data-layer` OK; `find components -name '*-container.tsx'` → **0**
- **Wiki:** `web-vite-data-layer.md`, `web-vite-domains.md`, `MEMORY.md` (not `hot.md`)

## 2026-06-10 — Wave 17A portal orchestrator collapse

- **Portal (17A):** Collapsed **14** remaining `portal/*-container.tsx` → `*PageContent` + Suspense in `pages/portal/*.tsx` (index, login, login-verify, invoices, invoice-detail, contracts, contract-detail, documents, equipment, payments, time, compliance, compliance-upload-replacement, signatures)
- **View+wired:** `embedded-signing-modal.tsx` — `EmbeddedSigningModalWired`; removed `PortalPendingSignaturesContainer` / `PortalSignaturesContainer` from `portal-pending-signatures.tsx`
- **Deleted:** all 14 `portal/*-container.tsx` files listed above
- **Verify:** `pnpm check:web-vite-data-layer` OK; portal vitest 208/210 pass (2 pre-existing env failures in `use-portal-top-bar.test.tsx`)
- **Wiki:** `web-vite-data-layer.md`, `web-vite-domains.md`, `MEMORY.md` (not `hot.md`)

## 2026-06-10 — Integration status mapping tenant scope and onboarding error hygiene

- `integration-status-mapping` save/get scoped by `organizationId`; Jira/Linear callers updated
- Onboarding `sourceErrors` use stable client messages; `fetchProjects` input limited to `JIRA`/`LINEAR`
- Workflow: `cancelRun` audit log; `reassignTask` org-member check; comment task/run ID validation
- GWS directory import skips invalid emails per row; `clearAdapters` re-registers built-in user-source fetchers

## 2026-06-10 — Onboarding refetch gates and workflow audit atomicity

- Wizard hooks gate on `isFetching`; source change resets step Continue flags
- `cancelRun` audit inside transaction; Jira/GWS/mergeByEmail skip invalid emails before output schema
- GWS integration health error/retry UI; Teams org-grid select-team-first state; import progress display/aria fixes

## 2026-06-10 — Import job UX and tenant-scoped project templates

- `createWorkflowTemplatesFromProjects` uses tenant `ctx.db` + transaction; project import requires authenticated user
- Import progress: no retry on `project:` failures; complete state when failures cleared; OAuth poll cleanup on unmount
- Credential reference: successor must be org member; audit `resourceId` is workflow run id

## 2026-06-10 — Onboarding RBAC, Jira webhook idempotency, partial import UX

- `onboardingImport`: reads gated `settings:read`; `startImport` needs `member:create` + `workflow:update`; `retryFailedItem` uses `itemKey`
- Jira: deregister-before-register webhooks; inbound task updates validate transitions + org scope; mapping entries use `workflowTaskStatusEnum`
- Workflow: `completeTask` / `skipTask` reject terminal parent runs
- UI: partial-complete card + dashboard CTA; per-row retry; OAuth connect guard; stepper read-only

## 2026-06-10 — Workflow + Jira webhook hardening (round 10)

- `getProgress` `.output(importProgressOutputSchema)`; task mutations require `IN_PROGRESS` run + assignee match
- Jira: `webhookSecret` generated on register; inbound DONE/SKIPPED unblocks dependents; override IP skip unblocks run

## 2026-06-10 — Wiki factual sync (onboarding, Slack, integration routers)

- **Onboarding:** wizard at `pages/dashboard/onboarding-import.tsx` (`OnboardingImportPageContent`); API docs for `listSources` `.output()`, `fetchPeople`/`fetchProjects` → `{ people\|projects, sourceErrors }`, `startImport`/`getProgress`/`retryFailedItem`; `canContinueStep` and `allSourcesFailed` gate semantics
- **Slack:** `integration` procedures `listUserMappings`, `linkUser`, `unlinkUser`, `syncUsers`; org-grid via `deprovisioning.connectSlackOrgGrid` + `scopeCapabilities.unavailableReason`
- **Registry pattern:** integration router procedure counts (jira 11, linear 9, teams 6, google-workspace 5, peppol 9, ksef 5, deprovisioning 10); removed migration narrative from `registry-plugin.md`

## 2026-06-10 — Deferred review backlog (import locking, audit tx, Jira toast)

- Import jobs: `importJobsRevision` optimistic lock in `patchImportJobsSettings`; `getProgress` / `retryFailedItem` `.output()` schemas
- `auditedMutation` + `auditMutationCtx`: project/team/cost-center/settings/equipment/document/compliance/credential-reference callers migrated; contract create audit inside create `$transaction`
- Workflow: `completeTask` / `skipTask` audit actions `workflow.task.completed` / `workflow.task.skipped` in same txn
- Jira status mapping UI: warning toast when `webhooksRegistered === false` (en/pl/de/ar)
- Tests: `packages/api/src/services/__tests__/onboarding-import-service.test.ts` (`mergeByEmail`)
- Wiki: `onboarding-and-import.md`, `patterns/audit-log.md`, `integrations/jira.md`

## 2026-06-10 — Contract CRUD audit atomicity + confirm-import tests

- `contract.ts`: `update`, `transitionStatus`, `delete` — prisma write inside `auditedMutation` + `auditMutationCtx` (same txn as audit); delete uses single `deletedAt` timestamp
- `import-progress-tracker.test.tsx`: retargeted to `ImportProgressTrackerView` (presentational)
- Wiki: `contracts-lifecycle.md` audit invariant

## 2026-06-10 — Equipment courier audit atomicity + confirm-import tests unskipped

- `equipment-couriers.ts`: InPost/DPD/UPS shipment creates + `saveCourierConfig` — DB write inside `auditedMutation` txn
- `confirm-import-step.test.tsx`: presentational + empty/error siblings (was deferred skip stub)
- `use-onboarding-confirm.test.tsx`: `isEmpty` / `isError` / `handleRetryStart` coverage
- Wiki: `hot.md` step 4 naming; `log.md` header fix

## 2026-06-10 — Confirm-import step data-layer alignment

- Step 4: `ConfirmImportStepView` (presentational) + `ConfirmImportStep` (wired); `ConfirmImportStepContainer` deprecated alias
- `use-onboarding-confirm`: `isEmpty`, `isError`, `handleRetryStart`; wired branches for empty + start mutation error
- `ImportProgressTrackerView` + wired `ImportProgressTracker` (progress poll/retry in `use-onboarding-progress` only)
- Page `onboarding-import.tsx` imports wired `ConfirmImportStep`; `pnpm check:web-vite-data-layer` OK

## 2026-06-10 — Equipment shipment/return audit atomicity + contract expiry reminders

- `equipment-shipments.ts`: `createShipment`, `addShipmentEvent`, `deleteShipment` — `auditedMutation` txn (fixes delete using non-tx client in array form)
- `equipment-returns.ts`: `approveReturnRequest`, `rejectReturnRequest` — audit inside txn
- `contract.updateExpiryReminders`: `contract.expiry_reminders.update` audit
- `organization.setKleinunternehmer`: audit + update same txn
- Wiki: `equipment-logistics.md`, `contracts-lifecycle.md`, `patterns/audit-log.md`

### 2026-06-10 — CI/test harness + i18n parity
- API vitest: batch-added `prismaRaw` + `getIdpAuditLogger` on `@contractor-ops/db` / `@contractor-ops/logger` mocks (`scripts/fix-api-test-mocks.mjs`); fixed `}););` syntax from inline db mock transform.
- Workflow router tests: reseed `member.findFirst` after `vi.clearAllMocks`; mock returns use real `Date` not `expect.any(Date)`.
- Jira/Linear status mapping tests aligned to `organizationId` + `$transaction` service API.
- i18n `Errors`: `workflowAssigneeNotMember`, `importJobStateConflict` (en/de/pl/ar).
- DB replica test: unsupported region `XX` (US now supported).
