# Cluster H — residual verdicts

## Summary
- Total: 376
- DELETE-NOW: ~24 (commandPalette.* legacy 10, contractor.vatValidation.* if no roadmap 8 → CONSOLIDATE-or-KEEP, Portal.return.step1/2Title dead 2, plus 4 confirmed-stale Documents.scanStatus)
- KEEP-PLANNED: ~12 (ContractorProfile.placeholder.* Phase-N scaffolds, Time.spotCheck dynamic, Portal duplicates with reverse-charge polish)
- KEEP-INDIRECT: ~316 (vast majority — dynamic sub-NS access via `useTranslations('Equipment.status')`, `useTranslations('Portal.return')`, `useTranslations('Time.spotCheck')` etc. — detector saw no top-level `t('Equipment.status.assigned')` literal because code does `useTranslations('Equipment.status'); t('assigned')`)
- CONSOLIDATE: ~24 (lowercase `contractor.*` / `invoice.*` / `commandPalette.*` legacy duplicates of `Contractors.*` / `Invoices.*` / `Common.commandPalette.*`)

**Bias-toward-KEEP outcome:** detector almost universally mistook sub-namespaced bindings (`useTranslations('NS.sub')` + `t('leaf')`) for dead keys. True-dead leaves are mostly the lowercase top-level duplicates plus a handful of cosmetic ones.

## Per sub-namespace (sub-NS with ≥10 dead)

### Equipment.* (43)
- Verdict mix: **KEEP-INDIRECT ~42, DELETE-NOW 0–1**
- Live bindings: `Equipment.status` (equipment-status-badge.tsx:44), `Equipment.shipment.status` (shipment-status-badge.tsx:44), `Equipment.inpost` (carrier-shipment-form.tsx:68), `Equipment.dpd` (dpd-fieldset.tsx:30), `Equipment.ups` (ups-fieldset.tsx:42), `Equipment.paczkomat` (paczkomat-picker.tsx:61, paczkomat-display.tsx:25), `Equipment.return` (return-approval-banner.tsx:41), `Equipment.carrier` (carrier-shipment-form.tsx:67 + 4 others), plus top-level `Equipment` in 15+ files.
- KEEP-PLANNED sub-trees: `Equipment.label.{download,notAvailable,notAvailableDescription,print}` — likely dynamic (sibling `t('label.downloadError')` IS live in tab-shipments.tsx:256). KEEP.
- KEEP-INDIRECT sub-trees: `Equipment.{inpost,dpd,ups,paczkomat,shipment.status,status,type}.*` — all reached via parent sub-NS binding + leaf literal.
- DELETE-NOW: none confidently — `Equipment.type.*` icons render via `<EquipmentTypeIcon type={type}/>` (visual only, no labels), but icon component may grow labels later → KEEP-PLANNED until confirmed.
- Sample keys: `Equipment.status.assigned`, `Equipment.inpost.shipmentCreated`, `Equipment.paczkomat.noSelection`, `Equipment.ups.expressSaver` — all bound via sub-NS.

### ContractorProfile.* (41)
- Verdict mix: **KEEP-INDIRECT 38, KEEP-PLANNED 3**
- Live bindings: 10+ files (profile-tabs, profile-header, hooks/use-contractor-profile.ts, equipment-list-container.tsx:35 as `tProfile`, etc.).
- KEEP-INDIRECT: `actions.*`, `tabs.*`, `lifecycle.*`, `compliance.*`, `breadcrumb`, `comingIn` — profile-header.tsx uses `labelKey: 'actions.startOnboarding'` (dynamic key construction) at line 210+216, lifecycle map at 54–58.
- KEEP-PLANNED: `placeholder.{contracts,documents,heading,invoices,payments,workflows}` — visible "Coming in Phase N" scaffolds; remove only when those tabs land or when Phase manifest closes them.
- Sample: all kept.

### Portal.* (33)
- Verdict mix: **KEEP-INDIRECT 30, DELETE-NOW 2, KEEP-PLANNED 1**
- Live bindings: portal-equipment-tab, portal-contracts-container, portal-settings-page, portal-invoice-detail-container, portal-mobile-menu (`Portal.orgSwitch`), use-portal-invoice-submit, use-portal-time, etc. (≥19 files).
- KEEP-INDIRECT: `equipment.*`, `submitInvoice.*`, `toast.*`, `contracts.*`, `orgSwitch.*`, `settings.*`, `return.cancelConfirm*` — all reached via parent or sub-NS bindings. Explicit hits: `t('returnAll')` portal-equipment-tab:128, `t('toast.weekSaved')` use-portal-time:64, `t('toast.uploadReady')` use-portal-invoice-submit:35, `tReturn('cancelConfirmTitle')` portal-equipment-tab:188.
- DELETE-NOW: `Portal.return.step1Title`, `Portal.return.step2Title` — no live ref in `apps/web-vite/src/components/portal/**`. Hits exist only in `integrations/google-workspace/**` for the GW wizard (different NS). Confirm with `pnpm check:i18n-unused` post-removal.
- KEEP-PLANNED: `Portal.contracts.noticePeriodDays` — already covered by `Portal.contracts.paymentTermsDays` reuse at line 249; kept as semantic alias for future-proofing.
- Sample: `Portal.equipment.viewLabel` LIVE (portal-equipment-tab:149); `Portal.toast.synced` LIVE (use-portal-time:117).

### Time.* (28)
- Verdict mix: **KEEP-INDIRECT 27, KEEP-PLANNED 1**
- Live bindings: `Time.spotCheck` (use-reconciliation-spot-check.ts:29), top-level `Time` in 13 files.
- KEEP-INDIRECT: all `Time.spotCheck.*` (26 keys) reached via sub-NS — detector blind to this pattern.
- KEEP-PLANNED: `Time.entryEntityLabel` — plural template used by shared `DataTablePagination`-style entity label; verify via `entityLabel={t('timesheetEntityLabel', ...)}` pattern in approval-queue-table:375 — close cousin. Likely live indirectly. KEEP.

### Import.* (26)
- Verdict mix: **KEEP-INDIRECT 26**
- Live bindings: 7 files (step-confirm, step-duplicates, step-preview, step-mapping, step-upload, hooks/use-import-wizard).
- All `Import.{errors,mapping,confirm,upload,toast,dialogTitle}.*` reached via top-level `Import` NS + dotted literals.

### Classification.* (25)
- Verdict mix: **KEEP-INDIRECT 23, KEEP-PLANNED 2**
- Live bindings: 17 files across classification engine UI (Phase 71 shipped).
- KEEP-PLANNED: `Classification._NOTE` (intentional in-file comment for translators — DO NOT DELETE, see file note), `Classification.polish.dashboard.empty*` — Phase 71 deferred-polish strings; bind audit needed before delete.
- KEEP-INDIRECT: `outcome.ir35.areaVerdict.*`, `outcome.drv.thresholds`, `AdvisoryBanner.label` — verify dynamic lookups in outcome cards before any prune.

### Billing.* (21)
- Verdict mix: **KEEP-INDIRECT 21**
- Live bindings: `Billing.topUp` (top-up-dialog-container.tsx:16 + use-billing.ts:93), `Billing.usage` (4 files), `Billing.gate` (upgrade-inline-banner.tsx:21), `Billing.proration` (proration-preview-container.tsx:22), `Billing.billingTab` (use-billing.ts:50), `Billing.creditExhausted`, `Billing.trial`, `Billing.overlay`, `Billing.planComparison`.
- All keys reached via sub-NS + leaf. Wildcard-detector likely already covers `Billing.planCards.*` per dossier note — same pattern applies here.

### Integrations.* (21)
- Verdict mix: **KEEP-INDIRECT 21**
- Live bindings: `Integrations.GoogleWorkspaceReconnect` (google-workspace-reconnect-banner.tsx:75), `Integrations.jira.statusMapping` (use-jira-status-mapping-dialog.ts:31), `Integrations.jira.taskConfig` (use-jira-task-config.ts:19), `Integrations.linear.statusMapping` (use-linear-status-mapping-dialog.ts:71), `Integrations.linear.taskConfig` (use-linear-task-config.ts:24), top-level `Integrations` in 5 files.
- All sub-NS keys (jira.statusMapping.*, linear.statusMapping.workflowStatus.*, GoogleWorkspaceReconnect.dismissAria) reached via leaf access.

### Documents.* (20)
- Verdict mix: **KEEP-INDIRECT 16, DELETE-NOW 4**
- Live bindings: `Documents` top-level (6 files: document-card, document-list, pdf-preview, version-history, hooks/use-document-card, portal-pending-signatures `tDocs`), `Documents.scan` (document-card.tsx:58 + upload-progress.tsx:52).
- DELETE-NOW: `Documents.scanStatus.{clean,failed,infected,scanning}` — replaced by `Documents.scan.*` namespace; old `scanStatus.*` keys orphaned. Verify with `Documents.scan.*` parity before delete; if EN/PL/DE/AR all carry both, the `scanStatus` branch is legacy dup → DELETE.
- KEEP-INDIRECT: `compliance.*`, `dropZone.*`, `metadata.*`, `errors.downloadFailed`, `uploadCTA`, `versionLabel`, `currentVersion`, `emptyCTA`, `contractorTab.*`, `upload.invalidType` — bound via top-level + leaf.

### GoogleWorkspace.* (19)
- Verdict mix: **KEEP-INDIRECT 17, KEEP-PLANNED 2**
- Live bindings: `GoogleWorkspace.import` (5 files), `GoogleWorkspace.sync` (use-sync-status-section.ts:9).
- KEEP-INDIRECT: import.* and sync.* via sub-NS.
- KEEP-PLANNED: `GoogleWorkspace.disconnect.{title,body}`, `GoogleWorkspace.notifications.{departure,newHire}` — Phase 77 (GWS + Slack adapters); notification cards likely server-side or upcoming UI. Roadmap match → KEEP.

### Users.* (15)
- Verdict mix: **KEEP-INDIRECT 15**
- Live bindings: `Users` (settings-members-container.tsx:18, use-users-table.ts:58), `Users.deactivateDialog` (use-deactivate-dialog.ts:19), `Users.inviteDialog` (use-invite-dialog.ts:28).
- All sub-NS keys reached via leaf. `Users.status.*` likely consumed dynamically in users-table column renderer — KEEP.

### ContractDetail.* (14)
- Verdict mix: **KEEP-INDIRECT 14**
- Live bindings: 6 files including `ContractDetail.signing.toast` (use-embedded-signing-modal.ts:48 + 3 others), top-level `ContractDetail` (contract-detail-tabs, detail-header, contract-detail-container, use-contract-detail-header, portal-invoice-detail-container `tErr`).
- All actions.*, breadcrumb, tabs.*, signing.toast.* reached via sub-NS / leaf.

### Validation.* (11)
- Verdict mix: **KEEP-INDIRECT 11**
- Live bindings: `Validation` in 3 auth hooks (use-invite-accept-form.ts:43, use-register-form.ts:51, use-login-form.ts:53).
- KEEP-INDIRECT: `Validation.contractor.*` — used in contractor form Zod schemas (search for `tv('contractor.…')` or schema messages — out of scope here but follow same pattern as auth).

### commandPalette.* (10)  → see dedicated section below

## Lowercase-typo top-level NS

### contractor.* (8) — likely legacy of Contractors.* sub-tree
- Evidence: zero `useTranslations('contractor.*')` bindings. VAT validation pill (`vat-validation-status-pill.tsx`) uses **HARDCODED English** labels (lines 31–55: `label: 'Valid' / 'Invalid' / 'Stale' / …`). Pill never wired to i18n.
- Sibling live NS: `Contractors.countryCompliance.vatValidationLabel` (apps/web-vite/src/components/contractors/country-compliance-section.tsx:135) — proves the canonical location is `Contractors.*` PascalCase.
- Verdict: **CONSOLIDATE → Contractors.vatValidation.*** if roadmap keeps a11y-translated VAT pill (Phase 57 polish debt). Otherwise **DELETE-NOW** + open follow-up issue: "VatValidationStatusPill hardcoded English — i18n debt". Recommend CONSOLIDATE: move 8 keys under `Contractors.vatValidation.*` and rewrite pill to call `useTranslations('Contractors.vatValidation')`.

### invoice.* (5 reverseCharge keys)
- Evidence: zero `useTranslations('invoice.*')` bindings. Live NS is **`Invoices.reverseCharge.*`** and **`Invoices.reverseChargeToggle.*`** (reverse-charge-banner.tsx:26, reverse-charge-line-toggle.tsx:46, use-reverse-charge-banner.ts:9). Lowercase `invoice.reverseCharge.*` is duplicate.
- Verdict: **DELETE-NOW**. Confirm message parity with `Invoices.reverseCharge.*` first; if texts diverge, copy missing strings into `Invoices.reverseCharge.*` then delete lowercase.

### organization.* (5 kleinunternehmer keys)
- Evidence: **LIVE** via `useTranslations('organization.kleinunternehmer')` (use-kleinunternehmer-toggle.ts:9). This sub-NS is **bound**, not dead. Detector false-positive.
- Verdict: **KEEP-INDIRECT**. (Consider future rename to `Organization.kleinunternehmer.*` for consistency with PascalCase convention used elsewhere, but not required.)

### Workflow.* (not enumerated separately in dossier; appears as small leaves)
- Bindings: live `useTranslations('Workflow…')` exist in workflows components; specific dead leaves likely all KEEP-INDIRECT.

## commandPalette (10) — DELETE-NOW
- Evidence: zero `useTranslations('commandPalette')` matches. Live cmdk components (shared/command-palette-container.tsx:12, search/command-palette.tsx) use **`useTranslations('Common.commandPalette')`** — generated keys.d.ts confirms `Common.commandPalette.{empty,groups.*,items.*,description,placeholder,…}` is the canonical NS.
- Dossier lowercase `commandPalette.*` is a legacy v1.0 duplicate that the migration consolidated under `Common.commandPalette.*`.
- Reasoning: Cmd+K is shipped (v1.0 — PROJECT.md:62, MILESTONES.md:204–205). Keys are LIVE but at a different path. The 10 lowercase leaves are pure dead duplicates.
- Verdict: **DELETE-NOW** (after `Common.commandPalette.*` parity check for `empty`, `placeholder`, `open`, `groups.{finance,navigate,preferences,team}`, `locale.switchTo`, `theme.{dark,light}` — copy any missing strings into `Common.commandPalette.*` first).

## Small NS (<10 each)
- **Reports.* (9)**: `custom`, `days30`, `days60`, `days90`, `exportSuccess`, `last3Months`, `last6Months`, `thisMonth`, `yearToDate` — `thisMonth/last3Months/last6Months/yearToDate/custom` LIVE via `labelKey` lookup in `date-range-filter.tsx:19–23`. `days30/60/90` and `exportSuccess` likely consumed by report views via `t('days30')`-style. **KEEP-INDIRECT**.
- **CalendarSettings.* (5)**: LIVE (4 binding sites). **KEEP-INDIRECT**.
- **Peppol.* (small)**: live via `Peppol.statusBadge`, `Peppol.qrDisplay`, `Peppol.capabilities`. **KEEP-INDIRECT**.
- **Consent.* (small)**: live (privacy-notice-display.tsx:44). **KEEP-INDIRECT**.
- **ksef.* (small)**: live in 5 files. **KEEP-INDIRECT**.
- **Ir35Chain.role.{CLIENT,WORKER}**: `Ir35Chain` NS LIVE in mark-delivered-dialog.tsx:24 and add-participant-dialog.tsx:32. `role.*` reached via dynamic lookup `t('role.' + r)` — **KEEP-INDIRECT**.
- **TopBar.{notifications,searchShortcut}**: TopBar NS LIVE (top-bar.tsx:57). **KEEP-INDIRECT**.
- **Auth.login.socialDivider**: LIVE via `Auth.login` (login-form.tsx:21). **KEEP-INDIRECT**.
- **Layout.footer.copyright**: LIVE via `Layout.footer` (app-footer.tsx:13). **KEEP-INDIRECT**.
- **OnboardingImport.* (3 keys)**: LIVE (onboarding-import-container.tsx:88, people-review-step.tsx:214). **KEEP-INDIRECT**.
- **EmptyStates.* (3 keys)**: LIVE via `EmptyStates.auditLog`, `EmptyStates.myTasks`. **KEEP-INDIRECT**.
- **boundaries.error.* (4 keys)**: error boundary scaffold. No direct `useTranslations('boundaries')` found — likely consumed by error-boundary component in `apps/web-vite/src/components/shared/**`. **KEEP-PLANNED** until verified; do not delete WCAG error-state strings without confirming.

## Notes
- **Detector blind-spot pattern**: codebase strongly uses sub-NS bindings (`useTranslations('Equipment.status')`, `useTranslations('Time.spotCheck')`) + leaf-only literals (`t('assigned')`). Any leaf under a sub-NS binding is unreachable through top-level grep for `t('Equipment.status.assigned')`. ~85% of cluster H "dead" keys are this pattern.
- **Actionable DELETE list** (consolidated, ~22 keys high-confidence):
  - `commandPalette.*` (10) — superseded by `Common.commandPalette.*`.
  - `invoice.reverseCharge.*` (5) — superseded by `Invoices.reverseCharge.*`.
  - `Portal.return.step1Title`, `Portal.return.step2Title` (2) — no consumer.
  - `Documents.scanStatus.{clean,failed,infected,scanning}` (4) — superseded by `Documents.scan.*`.
  - `contractor.vatValidation.*` (8) — either DELETE or CONSOLIDATE → `Contractors.vatValidation.*` paired with pill i18n fix. Recommend CONSOLIDATE.
- **Pre-prune checklist**: (a) `pnpm check:i18n-unused` before/after, (b) parity-diff EN→{DE,PL,AR} for keys being merged to avoid translation loss, (c) update `keys.d.ts` via codegen, (d) grep for any `t('legacy.path')` literal one more time.
- **Roadmap touchpoints**:
  - Equipment lifecycle / InPost: v3.0 Phase 33 SHIPPED — keys are LIVE not future.
  - Time / timesheets: v2.0 SHIPPED — Time.spotCheck LIVE.
  - Classification Phase 71 SHIPPED — `Classification.*_NOTE` intentional translator hint; `polish.*` legitimately scaffolded.
  - Billing Stripe subscriptions: LIVE — proration, top-up, gate, usage, billingTab all wired.
  - Integrations Phase 76–78: GW + Slack + Entra/Okta — `GoogleWorkspace.notifications.*` and `GoogleWorkspace.disconnect.*` are Phase 77 deliverables → KEEP-PLANNED.
  - Portal Phase 73: LIVE — Portal.* keys mostly bound.
- **No new lowercase-typo NS should be introduced**. Existing typos (`contractor.*`, `invoice.*`, `commandPalette.*`) are migration debris; treat as pure delete-or-consolidate.
