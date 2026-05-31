# Cluster D — Settings.* (other) verdicts

## Summary
- Total candidates: 195
- DELETE-NOW: 16
- KEEP-PLANNED: 15
- KEEP-INDIRECT: 138
- CONSOLIDATE: 26

## Per sub-namespace

### Settings.reminderRules  (29)
- Verdict: KEEP-INDIRECT
- Phase / evidence: Live in `apps/web-vite/src/components/settings/reminder-rules-section.tsx`, `reminder-rule-editor.tsx`, `reminder-rule-user-picker.tsx`, hook `hooks/use-reminder-rules-section.ts:21-42` (`TRIGGER_LABEL_KEYS`, `CHANNEL_LABEL_KEYS`, `RECIPIENT_LABEL_KEYS` map enum → leaf at runtime via template-literal `editor.${labelKey}`).
- KEEP-INDIRECT count: 20 — all `editor.channel*` (3), `editor.entity*` (4), `editor.recipient*` (5), `editor.trigger*` (6), `editor.active`, `ruleDescription`.
- KEEP-INDIRECT (scaffold) count: 9 — `validation.*` keys are parity scaffolds: zod schema in `packages/validators/src/reminder.ts:44-54` uses raw `.min/.max` without `{ message }`, so leaves are not bound today but pair 1-1 with constraints. Bias KEEP.
- Sample DELETE keys: none.

### Settings.changeRequest  (26)
- Verdict: KEEP-INDIRECT (with 3 DELETE)
- Phase / evidence: Live in `apps/web-vite/src/components/settings/change-request-diff-card.tsx` bound via `Settings.changeRequest` namespace in `hooks/use-change-request-diff-card.ts:20`; `getFieldLabel` calls `tDynLoose(t, 'fieldLabels', labelKey)` at `change-request-diff-card.tsx:78-84`.
- KEEP-INDIRECT count: 23 — `title`, `table.{field,currentValue,requestedValue}`, `approveChanges`, `approving`, `rejectChanges`, `rejectDescription`, `rejectPlaceholder`, `rejectTitle`, `rejecting`, `confirmRejection`, and all 11 `fieldLabels.*` (dynamic).
- DELETE-NOW: 3 — `status.approved`, `status.pending`, `status.rejected` (no source reference, no phase plan).
- Sample DELETE keys: `Settings.changeRequest.status.approved`.

### Settings.provider  (22)
- Verdict: CONSOLIDATE (entire sub-NS is duplicate of `Settings.integrations.provider.*`)
- Phase / evidence: `en.json` has two `provider` blocks (lines 6271 inside integrations, 6411 top-level). All real consumers bind `useTranslations('Settings.integrations')` then call `t('provider.x')` — `provider-detail-sheet.tsx:171/194/196/224/233/241-244/293-304`, `provider-connection-card.tsx:140` (`tDynLoose(t, 'provider', statusLabelKey)`). No source binds `Settings.provider` directly.
- CONSOLIDATE count: 22 — collapse into `Settings.integrations.provider.*` (already covered), then DELETE top-level block. Two leaves missing from integrations.provider (`statusConnected`, `statusDisconnected`, `statusError`, `statusReauth`, `connectedBy`, `scopes`) must be merged into integrations namespace before delete — they are wired via `statusLabelKey` (`tDynLoose`).
- Sample CONSOLIDATE keys: `Settings.provider.statusConnected`, `Settings.provider.scopes`, `Settings.provider.syncLogHeading`.

### Settings.branding  (14)
- Verdict: KEEP (all live; auditor false-positive)
- Phase / evidence: `hooks/use-admin-branding-section.ts:18`, `hooks/use-portal-subdomain-section.ts:11`, `brand-color-picker.tsx:78`, `brand-preview-strip.tsx:16` — all 14 leaves resolved via `admin-branding-section.tsx`, `portal-subdomain-section.tsx` (`t('heading'/'description'/'logoLabel'/'logoAlt'/'logoHint'/'uploadLogo'/'removeLogo'/'saving'/'accentColor'/'subdomainHeading'/'subdomainDescription'/'subdomainCardDescription'/'subdomainPlaceholder'/'subdomainSuffix')`).
- KEEP-INDIRECT count: 14.
- DELETE-NOW: 0.

### Settings.gdpr  (14)
- Verdict: KEEP (all live; auditor false-positive)
- Phase / evidence: `gdpr-data-rights-section.tsx` calls `t('description')`, `t('title')`, `t('export.{body,cta,title}')`, `t('erasure.{body,cancel,confirm,confirmBody,confirmTitle,cta,retainFinancialLabel,title,typePhrase}')` — every dossier leaf maps.
- KEEP-INDIRECT count: 14.
- DELETE-NOW: 0.

### Settings.outOfOffice  (13)
- Verdict: KEEP-INDIRECT (with 2 KEEP-PAIR)
- Phase / evidence: `hooks/use-out-of-office-section.ts:11`, `out-of-office-section.tsx` calls `t('{applyCta,clearCta,description,fromTime,rangePickerLabel,rangePickerPlaceholder,reason,reasonPlaceholder,saveCta,title,untilTime}')`.
- KEEP-INDIRECT count: 11.
- KEEP-PAIR: 2 — `from`, `until` not used today; paired siblings of `fromTime`/`untilTime`, kept for label parity (a11y aria-label / planned form refactor). Bias KEEP.
- Sample DELETE keys: none.

### Settings.approvals  (12)
- Verdict: mixed
- Phase / evidence: Editor: `chain-editor-dialog.tsx`, `chain-editor-user-picker.tsx`, `condition-builder.tsx:36-43,199-213`, `approval-chains-tab.tsx`. Validation strings hardcoded in `hooks/use-chain-editor-dialog.ts:30-56` (zod `.min(1, 'Level name is required')`) — not i18n-wired.
- KEEP-INDIRECT count: 3 — `editor.operatorEq`, `editor.operatorGt`, `editor.operatorLt` (selected via `labelKey` in `condition-builder.tsx:41-43`).
- KEEP-INDIRECT (scaffold) count: 7 — `validation.*` parity scaffolds for hardcoded zod messages (`approverRequired`, `chainNameMax`, `chainNameRequired`, `levelNameRequired`, `minOneLevel`, `slaRange`, `slaRequired`).
- DELETE-NOW: 2 — `activeToggle`, `conditionSummary` (no source reference; `chain-editor-dialog` already uses different leaves; toggle UI is a Switch with no label key bound).
- Sample DELETE keys: `Settings.approvals.activeToggle`, `Settings.approvals.conditionSummary`.

### Settings.carriers  (12)
- Verdict: KEEP (all live; auditor false-positive)
- Phase / evidence: `hooks/use-carrier-credential-form.ts:26`, `carrier-credential-form.tsx` resolves `t('accountNumber'/'clientId'/'clientSecret'/'connected'/'fid'/'notConfigured'/'password'/'sandbox'/'saveCredentials'/'testConnection'/'username')`; `heading` referenced via `Settings.carriers` namespace expose in `use-dpd-provider-section.ts`/`use-ups-provider-section.ts` (label rendered by consumers).
- KEEP-INDIRECT count: 12.
- DELETE-NOW: 0.

### Settings.featureFlags  (12)
- Verdict: KEEP (all live; auditor false-positive)
- Phase / evidence: `feature-flags-tab.tsx` resolves every leaf: `t('title')`, `t('description')`, `t('emptyHeading')`, `t('emptyBody')`, `t('loadFailedTitle')`, `t('loadFailedBody')`, `t('state.on')`, `t('state.off')`, `t('tableHeaders.{category,flag,jurisdiction,state}')`.
- KEEP-INDIRECT count: 12.
- DELETE-NOW: 0.

### Settings.WorkflowRoles  (11)
- Verdict: KEEP-PLANNED
- Phase / evidence: Phase 74 `74-UI-SPEC.md:227-237` enumerates exactly these 11 leaves as the new namespace for the KT-template-override roles table. Current container at `settings-workflow-roles-container.tsx:15` still uses `useTranslations('WorkflowRoles')` (top-level) — Phase 74 cuts over to `Settings.WorkflowRoles.*`. Top-level `WorkflowRoles.*` block becomes the candidate for removal post-cutover (out of cluster D scope).
- KEEP-PLANNED count: 11.
- DELETE-NOW: 0.
- Sample evidence: `.planning/phases/74-f4-offboarding-workflow-foundation-kt-templates-override-per/74-UI-SPEC.md:227-237`.

### Settings.userConsent  (10)
- Verdict: KEEP (all live; auditor false-positive)
- Phase / evidence: `user-consent-sheet.tsx` resolves all 10 leaves (`title`, `description`, `currentHeading`, `currentEmpty`, `historyHeading`, `historyEmpty`, `granted`, `notGranted`, `revoked`, `lastUpdated`).
- KEEP-INDIRECT count: 10.
- DELETE-NOW: 0.

### Settings.notifications  (6)
- Verdict: KEEP (all live; auditor false-positive)
- Phase / evidence: `notification-preferences.tsx:67-91` maps 5 event types via `labelKey` (eventApprovalDecision, eventTaskAssigned, eventTaskOverdue, eventContractExpiring, eventInvoiceReceived); `eventApprovalRequest` covered by test `__tests__/notification-preferences.test.tsx:74`.
- KEEP-INDIRECT count: 6.
- DELETE-NOW: 0.

### Other (<5 each)

- **Settings.PtoKeywords (4)** — KEEP-PLANNED. Phase 74 `74-UI-SPEC.md:239-242` enumerates exactly `heading/subtitle/empty/addCta`. Currently no source binding. KEEP-PLANNED: 4.
- **Settings.providerToasts (4)** — CONSOLIDATE. Duplicate of `Settings.integrations.providerToasts.*` (en.json lines 6303 vs 6451). Real consumers (`use-provider-detail-sheet.ts:117/128`, `use-provider-connection-card.ts:33/44/52/62`) bind `Settings.integrations` and call `t('providerToasts.x')`. Top-level Settings.providerToasts has zero binding. CONSOLIDATE: 4.
- **Settings.returnCarrier (3)** — DELETE-NOW. No source binding, no phase plan, no consumer of the "default return carrier" concept; equipment carriers ship via per-shipment selection. DELETE: 3 (`helper`, `label`, `saved`).
- **Settings.fields (2)** — KEEP-INDIRECT. `Settings.fields.timeFormat.12h` / `24h` resolved via `tDyn(t, 'fields.timeFormat', fmt === '24h' ? '24h' : '12h')` at `org-settings-form.tsx:270,278`.
- **Settings.appearance (1)** — DELETE-NOW. `Settings.appearance.uiLanguage` has zero references (live `language-card.tsx:100-102` uses `t('appearance.heading')`/`t('appearance.description')` from a different block; auditor likely confused). DELETE: 1.

## Notes

- "KEEP-INDIRECT (scaffold)" tracked under KEEP-INDIRECT in summary: `reminderRules.validation.*` (9) + `approvals.validation.*` (7) = 16 leaves. These are pre-wired English copy for zod messages currently hardcoded in `use-chain-editor-dialog.ts` and `packages/validators/src/reminder.ts`. Following project bias toward KEEP and the v6.0 i18n roadmap (parity guard in Phase 70), do not delete — flag as wiring debt instead.
- Two CONSOLIDATE clusters (`Settings.provider.*` x22 + `Settings.providerToasts.*` x4 = 26 leaves) are pure duplicates of the live `Settings.integrations.*` siblings. Before deleting top-level blocks, diff the leaves: top-level `Settings.provider` has 6 leaves not present under integrations (`connectedBy`, `scopes`, `statusConnected`, `statusDisconnected`, `statusError`, `statusReauth`) that ARE wired via `tDynLoose(t, 'provider', statusLabelKey)` in `provider-connection-card.tsx:140` and `provider-detail-sheet.tsx:167`. Merge those into `Settings.integrations.provider.*` first, then drop top-level.
- Auditor false-positives dominate this cluster: 138/195 leaves (~71%) are bound through directly-namespaced `useTranslations('Settings.<sub>')` calls that resolve every dossier leaf statically. Dossier appears to have missed namespace-scoped bindings entirely for branding/gdpr/userConsent/featureFlags/notifications/carriers — likely a scanner heuristic that only matched fully-qualified `t('Settings.<sub>.<leaf>')` literals.
- Phase 74 UI-SPEC is the only roadmap document that pre-declares dossier leaves (WorkflowRoles 11 + PtoKeywords 4 = 15 KEEP-PLANNED). Phases 72/73 do not introduce new i18n keys in this cluster.
- Net delete recommendation if accepting both CONSOLIDATE merges: 16 DELETE + 26 CONSOLIDATE = 42 leaves removable from `Settings.*` (other) without risk; remaining 153 should stay.
