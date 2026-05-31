# Wave 4-C — Part 1 verdicts (Import / Classification / Common / EInvoice / Documents)

## Summary
- Total in this part: 76
- DELETE-NOW: 76
- KEEP-PLANNED: 0
- KEEP-INDIRECT: 0

## Per NS

### Import (21)
- Verdict: DELETE-NOW. All 7 import wizard steps use `useTranslations('Import')` but call different leaves (`confirm.complete`, `confirm.created`, `confirm.updated`, `confirm.skipped`, `confirm.failed`, `confirm.viewEntities`, `confirm.contractors`, `confirm.contracts`, `confirm.importing`, `confirm.errorTitle`, `confirm.tryAgain`, `confirm.ready`, `confirm.newRecordsLabel`, `confirm.updatesLabel`, `confirm.skippedDuplicatesLabel`, `confirm.skippedErrorsLabel`, `confirm.importButton`, `mapping.description`, `mapping.skip`, `mapping.note`, `upload.entityType`, etc.). Candidate keys are pre-rename leftovers (no `*Label` suffix) and unused error/title strings. No `tDyn*` over `Import.*` subtrees. onboarding-import router doesn't drive these (server-side). Phase plan for import wizard already shipped.
- DELETE list (FULL paths):
  - Import.confirm.completeHeading
  - Import.confirm.importCta
  - Import.confirm.newRecords
  - Import.confirm.processing
  - Import.confirm.skippedDuplicates
  - Import.confirm.skippedErrors
  - Import.confirm.updates
  - Import.confirm.viewCta
  - Import.dialogTitle
  - Import.errors.emptyFile
  - Import.errors.importFailed
  - Import.errors.invalidFile
  - Import.errors.tooManyRows
  - Import.mapping.autoMatched
  - Import.mapping.mapsTo
  - Import.mapping.required
  - Import.mapping.unmappedNote
  - Import.mapping.yourColumns
  - Import.toast.importComplete
  - Import.upload.entityContractors
  - Import.upload.entityContracts

### Classification (16)
- Verdict: DELETE-NOW. Classification namespace has ~25 live `useTranslations('Classification*')` bindings, but none reach these leaves. `AdvisoryBanner.label`: advisory-banner.tsx uses hardcoded `'Rechtlicher Hinweis'`/`'Legal notice'` literals (not i18n), so `AdvisoryBanner.label` is unused (and not part of legal-locked phrases set, which live in `packages/validators/src/legal/`). `backToEngagement`, `pageSubtitle`, `tile.completedLabel`, `outcome.printedOn`, `outcome.drv.thresholds`, `emptyState.noAssessmentBody`, `error.rationaleTooLong`: no callsites in components (live calls use `outcome.drv.totalScore`, `outcome.drv.verdict.*`, `outcome.drv.criterion`, `outcome.drv.score`, `emptyState.noAssessment`, `emptyState.notSupported*`, `error.draftDrift*`). `polish.dashboard.emptyNoAssessment*` / `emptyNoEngagement*` and `polish.reassessmentTrigger.notificationTitle/Body/reasonLine`: dashboard container reads other `polish.dashboard.*` keys; reassessmentTrigger is server/notification-shape (not UI) so dotted paths don't resolve through tDyn. Includes `_NOTE` documentation pseudo-key. Phase 71 (Compliance Policy Package) completed — locked phrases stay in validators package, not in messages.json.
- DELETE list (FULL paths):
  - Classification.AdvisoryBanner.label
  - Classification._NOTE
  - Classification.backToEngagement
  - Classification.emptyState.noAssessmentBody
  - Classification.error.rationaleTooLong
  - Classification.outcome.drv.thresholds
  - Classification.outcome.printedOn
  - Classification.pageSubtitle
  - Classification.polish.dashboard.emptyNoAssessmentsBody
  - Classification.polish.dashboard.emptyNoAssessmentsHeading
  - Classification.polish.dashboard.emptyNoEngagementsBody
  - Classification.polish.dashboard.emptyNoEngagementsHeading
  - Classification.polish.reassessmentTrigger.notificationBody
  - Classification.polish.reassessmentTrigger.notificationTitle
  - Classification.polish.reassessmentTrigger.reasonLine
  - Classification.tile.completedLabel

### Common (14)
- Verdict: DELETE-NOW. ~30 live `useTranslations('Common')` and `useTranslations('Common.aria')` bindings throughout app + portal, but none reach these specific leaves. `appName`/`appTagline`: no references anywhere (HTML title uses static strings). `aria.breadcrumb`/`aria.closeDialog`/`aria.closePanel`/`aria.dateFrom`/`aria.dateTo`/`aria.toggleSidebar`: only matches in code are `Contracts.dateFrom`/`Contracts.dateTo` (different namespace) and identifier names — no `tAria('breadcrumb')`, `tAria('closeDialog')`, etc. callsites. `darkMode`, `language`, `switchToLanguage`, `filterFrom`, `filterTo`, `srOnly.more`: confirmed unused (only `srOnly.moreActions`, `srOnly.actions`, `srOnly.remove`, `srOnly.signingActions` are live).
- DELETE list (FULL paths):
  - Common.appName
  - Common.appTagline
  - Common.aria.breadcrumb
  - Common.aria.closeDialog
  - Common.aria.closePanel
  - Common.aria.dateFrom
  - Common.aria.dateTo
  - Common.aria.toggleSidebar
  - Common.darkMode
  - Common.filterFrom
  - Common.filterTo
  - Common.language
  - Common.srOnly.more
  - Common.switchToLanguage

### EInvoice (13)
- Verdict: DELETE-NOW. EInvoice has ~20 live bindings across PeppolDialog/PeppolCard/intake/InvoiceTab/InvoicesList. PeppolCard component calls only `emptyHeading`, `emptyBody`, `labelParticipant`, `labelStatus`, `labelAsp`, `labelLastCapabilityCheck`, `neverChecked`, `ctaNotRegistered` plus dialog passthrough — none of the `status*` or `ctaRegistered` leaves are reached. PeppolDialog calls only `activeHeading`, `pendingHeading`, `deregisterButton`, `registerButton`, etc. — never `activeBodyPattern` or `pendingBody`. intake namespace lives in `invoice-intake-page-container.tsx`/`intake-detail-*` and uses `pageTitle`, `pageSubtitle`, `field.*`, `column.*`, `level.*`, action labels — but `sendCta` is `EInvoice.InvoiceTab.sendCta` (different subtree), and `uploadNetworkError`/`xmlPreviewTitle` have no callsites. KSA/EU e-invoice roadmap continues with separate keys that already exist (`InvoiceTab.*`, `LeitwegIdDialog.*`).
- DELETE list (FULL paths):
  - EInvoice.PeppolDialog.activeBodyPattern
  - EInvoice.PeppolDialog.activeHeading
  - EInvoice.PeppolDialog.pendingBody
  - EInvoice.Settings.PeppolCard.ctaRegistered
  - EInvoice.Settings.PeppolCard.pendingHeading
  - EInvoice.Settings.PeppolCard.statusActive
  - EInvoice.Settings.PeppolCard.statusDeregistered
  - EInvoice.Settings.PeppolCard.statusNotRegistered
  - EInvoice.Settings.PeppolCard.statusRegistered
  - EInvoice.Settings.PeppolCard.statusSuspended
  - EInvoice.intake.sendCta
  - EInvoice.intake.uploadNetworkError
  - EInvoice.intake.xmlPreviewTitle

### Documents (12)
- Verdict: DELETE-NOW. ~15 live `useTranslations('Documents')` bindings (document-card, document-list, version-history, drop-zone, pdf-preview, upload-progress, tab-documents, hooks). version-history uses `t('version', {n})` and `t('versionHistory')`/`t('superseded')`/`t('download')`/`t('loading')`/`t('noOtherVersions')` — never `versionLabel` or `currentVersion`. document-card uses `scanning`/`clean`/`infected`/`failed`/`download`/`preview`/`uploadNewVersion`/`delete*` — never `uploadCTA` or `emptyCTA`. tab-documents uses `contractorTab.heading`/`emptyHeading`/`emptyBody` — never `contractorTab.uploadCTA`. compliance subtree: `tab-compliance.tsx` calls `ContractorProfile.compliance.requiredDocuments` (different namespace, not `Documents.compliance.*`). `errors.downloadFailed` not called — code uses inline error toasts. metadata.size/uploadedBy/uploadedOn: document-card renders these inline with formatters (no i18n leaf reach).
- DELETE list (FULL paths):
  - Documents.compliance.complianceTypes
  - Documents.compliance.requiredDocuments
  - Documents.compliance.uploadCompliance
  - Documents.contractorTab.uploadCTA
  - Documents.currentVersion
  - Documents.emptyCTA
  - Documents.errors.downloadFailed
  - Documents.metadata.size
  - Documents.metadata.uploadedBy
  - Documents.metadata.uploadedOn
  - Documents.uploadCTA
  - Documents.versionLabel

## Notes
- `Classification._NOTE` is documentation pseudo-key meant as a code comment — should never have shipped to messages.json; safe to delete (won't be referenced at runtime, only by humans browsing the file). The note's directive (legal phrases live in `packages/validators/src/legal/`) remains accurate; preserve as a top-of-file comment in source if needed, not as a JSON value.
- Advisory banner currently uses hardcoded German/English literals (`'Rechtlicher Hinweis'`/`'Legal notice'`) — separate i18n gap, but `Classification.AdvisoryBanner.label` isn't the binding to keep (banner needs proper i18n refactor with new key + tCommon('aria.*') or similar — file a follow-up if a11y matters).
- All deletes apply across en/de/pl/ar message bundles.

---

# Wave 4-C — Part 2 verdicts (Equipment / Validation / Portal / ksef / Legal / Peppol)

## Summary
- Total in this part: 50
- DELETE-NOW: 48
- KEEP-PLANNED: 0
- KEEP-INDIRECT: 2 (`Portal.return.cancelConfirmTitle`, `Portal.return.cancelConfirmDescription` — bound via `tReturn` in `portal-equipment-tab.tsx`)

## Per NS

### Equipment (12)
- Verdict: DELETE-NOW. Equipment NS is heavily live (`useTranslations('Equipment')` and ~10 sub-NS variants), but these specific leaves are pre-rename leftovers. `Equipment.inpost.createShipment` and `Equipment.inpost.parcelSize` are duplicates — the active calls in `carrier-shipment-form.tsx` use the `Equipment.carrier` namespace (lines 161/180/227/273). `dpd.countryCode`, `label.notAvailable*`, `label.print`, `list.filters.assignee`, `list.pagination.itemCount`, `paczkomat.noSelection*` and the two `inpost.shipment*` toast keys have no `t('<leaf>')` callers in any of the 22 Equipment binding sites. No dynamic resolver scans Equipment subtree.
- DELETE list (FULL paths):
  - Equipment.dpd.countryCode
  - Equipment.inpost.createShipment
  - Equipment.inpost.parcelSize
  - Equipment.inpost.shipmentCreated
  - Equipment.inpost.shipmentError
  - Equipment.label.notAvailable
  - Equipment.label.notAvailableDescription
  - Equipment.label.print
  - Equipment.list.filters.assignee
  - Equipment.list.pagination.itemCount
  - Equipment.paczkomat.noSelection
  - Equipment.paczkomat.noSelectionDescription

### Validation (11)
- Verdict: DELETE-NOW. Only one live binding for `Validation.contractor`: `use-contractor-wizard.ts:49` (`tv = useTranslations('Validation.contractor')`), and it calls only `tv('nipFormat')` (NOT in dossier — safe). No `tDyn`/`tKey`/`getValidationMessage` resolver loads these leaves; no cross-package consumer in `packages/*` either. zod schemas in this repo carry inline English `.message()` strings, they do not look up i18n keys at validation time. All 11 leaves are stale schema-message scaffolding.
- DELETE list (FULL paths):
  - Validation.contractor.billingModelRequired
  - Validation.contractor.currencyRequired
  - Validation.contractor.emailFormat
  - Validation.contractor.emailRequired
  - Validation.contractor.ibanFormat
  - Validation.contractor.legalNameRequired
  - Validation.contractor.nipChecksum
  - Validation.contractor.nipRequired
  - Validation.contractor.ownerRequired
  - Validation.contractor.ratePositive
  - Validation.contractor.rateRequired

### Portal (8)
- Verdict: DELETE-NOW for 6; KEEP-INDIRECT for 2. `Portal.return.cancelConfirmTitle` and `Portal.return.cancelConfirmDescription` are bound via `tReturn = useTranslations('Portal.return')` in `portal-equipment-container.tsx`/`use-portal-equipment.ts` and consumed at `portal-equipment-tab.tsx:188-199`. The remaining 6 leaves have no consumers. `Portal.contracts.noticePeriodDays` is shadowed by `t('contracts.paymentTermsDays', { days })` in `portal-contract-detail-container.tsx:249` (different key). `Portal.equipment.returnButton` is shadowed by `t('equipment.returnEquipment')` style callers, not the `returnButton` leaf. `Portal.return.dropOffBy` not used by `tReturn`. `Portal.settings.profileUpdated` is shadowed by `t('profileUpdated')` under `ContractorProfile.rightRail` NS (different namespace, not the Portal copy). `Portal.settings.changeRequestSubmitted` and `Portal.toast.preferenceUpdated` have no callers. Phase 73 (Portal i18n) ship referenced only the live keys.
- KEEP-INDIRECT (FULL paths, do NOT delete):
  - Portal.return.cancelConfirmTitle
  - Portal.return.cancelConfirmDescription
- DELETE list (FULL paths):
  - Portal.contracts.noticePeriodDays
  - Portal.equipment.returnButton
  - Portal.return.dropOffBy
  - Portal.settings.changeRequestSubmitted
  - Portal.settings.profileUpdated
  - Portal.toast.preferenceUpdated

### ksef (8)
- Verdict: DELETE-NOW. Five live ksef bindings (`use-integrations-tab`, `use-ksef-setup-dialog`, `use-ksef-sync-history`, `ksef-metadata-section`, `ksef-duplicate-banner`). Their `t('...')` calls use only `metadataHeading`, `viewInKsef`, `referenceLabel`, `upoLabel`, `fetchedLabel`, `sourceBadge`, `duplicate*`, `voidConfirm*`, `connectedToast`, `connectionFailedToast`, `syncSuccessToast`, `syncFailedToast`. None of the 8 dossier leaves are referenced. The `disconnectTitle`/`disconnectBody` calls in `my-calendar-section.tsx`/`org-calendar-section.tsx` go through `CalendarSettings` NS (not ksef). `disconnect*` calls in `peppol-status-card.tsx` go through `Peppol.statusCard` NS. `sourceBadgeTooltip*`, `syncNoNewToast`, `syncStatusPartial` have zero referents.
- DELETE list (FULL paths):
  - ksef.disconnectBody
  - ksef.disconnectCancel
  - ksef.disconnectConfirm
  - ksef.disconnectTitle
  - ksef.sourceBadgeTooltip
  - ksef.sourceBadgeTooltipNoDate
  - ksef.syncNoNewToast
  - ksef.syncStatusPartial

### Legal (8)
- Verdict: DELETE-NOW. Phase 64 (Legal docs) shipped; Phase 73 covers Portal not Legal. `Legal.DrvUpload.*` is live but `drv-clearance-panel.tsx` calls only `fileTooLarge`, `uploadDecisionLetter`, `uploading`, `uploadedAt` — never `downloadLetter`. `Legal.SdsApproval.*` is live but `generate-sds-button.tsx` calls only `gateTitle`, `clientNameLabel`, `clientNamePlaceholder`, `confirmApproval`, `confirmingApproval` — never `approved`. `Legal.privacyIndex.heading` is bound at `legal-privacy-jurisdiction-container.tsx:21`, but the `jurisdictions.{de,gb,eu}.{label,subtitle}` table is never iterated — no `JURISDICTIONS` const, no `tDyn`, no `privacyIndex` page component (route was scaffolded but landing UI lists hardcoded country cards). All 8 leaves orphaned.
- DELETE list (FULL paths):
  - Legal.DrvUpload.downloadLetter
  - Legal.SdsApproval.approved
  - Legal.privacyIndex.jurisdictions.de.label
  - Legal.privacyIndex.jurisdictions.de.subtitle
  - Legal.privacyIndex.jurisdictions.eu.label
  - Legal.privacyIndex.jurisdictions.eu.subtitle
  - Legal.privacyIndex.jurisdictions.gb.label
  - Legal.privacyIndex.jurisdictions.gb.subtitle

### Peppol (3)
- Verdict: DELETE-NOW. Only one binding for `Peppol.capabilities` (`tCap` in `use-peppol-participant-card.ts:24`) and it calls `xrechnungCiiSupported`, `xrechnungCiiUnsupported`, `recheckFailed` — never `recheckCapabilities` or `rechecking`. No binding for `Peppol.statusCard` NS at all (`peppol-status-card.tsx` uses `Peppol.statusCard.disconnect*` keys but never `notConnected`; the `notConnected` literal in `onboarding/source-card.tsx:85` runs under `OnboardingImport.sourceCard` NS, unrelated). EU e-invoicing roadmap has Peppol live, but these specific leaves are unreferenced scaffold.
- DELETE list (FULL paths):
  - Peppol.capabilities.recheckCapabilities
  - Peppol.capabilities.rechecking
  - Peppol.statusCard.notConnected

## Notes
- All deletes apply across en/de/pl/ar message bundles.
- 2 keys retained (`Portal.return.cancelConfirmTitle/Description`) — live via `tReturn` in portal equipment return flow.
- No dynamic/zod resolver covers any deleted Validation.* leaf (verified packages/* and apps/*); inline schema `.message()` strings dominate.
- `Equipment.inpost.createShipment` and `Equipment.inpost.parcelSize` are exact duplicates of `Equipment.carrier.createShipment` and `Equipment.carrier.parcelSize` (which ARE live) — deletion of the `inpost.*` variants is safe and removes the duplication.
- Generated `keys.d.ts` references will rebuild after the JSON delete (`pnpm i18n:gen` or equivalent codegen step).

