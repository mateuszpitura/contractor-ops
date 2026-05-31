# Cluster F — Onboarding / Offboarding / Legal / Consent / ContractorWizard verdicts

## Summary
- Total: 154
- DELETE-NOW: 3
- KEEP-PLANNED: 11
- KEEP-INDIRECT (dynamic t(id)): 140
- CONSOLIDATE: 0

## Per sub-namespace

### Offboarding.Templates  (54)
- **Verdict:** KEEP-INDIRECT
- **Phase ref / evidence:** Phase 74 (F4 Offboarding — KT Templates) completed 2026-04-27. KT-template seed registry stores the i18n keys as columns and resolves them at runtime via `t(key)`.
  - `packages/offboarding-templates/src/seeds.ts` references every `displayNameI18nKey` / `titleI18nKey` / `descriptionI18nKey` listed in the dossier.
  - 74-02-PLAN.md L34: "provides: Offboarding.Templates.* + Offboarding.OverrideDialog.* + Offboarding.OverrideBadge.* + Offboarding.PtoBadge.* … keys".
  - Scanner misses these because keys live as string columns in seed data — the consumer presumably joins runtime contractor role → seed `*I18nKey` → `t(key)`.
- **Sample keys:** `Offboarding.Templates.SoftwareEngineer.handoverDocs.title`, `Offboarding.Templates.Designer.figmaTransfer.description`, `Offboarding.Templates.GenericConsultant.deliverableArchive.title`.

### Legal.subProcessors  (48)
- **Verdict:** KEEP-INDIRECT
- **Phase ref / evidence:** Live binding in `apps/web-vite/src/components/legal/sub-processors-table.tsx`. The component iterates `PROCESSOR_IDS = ['vercel','neon','cloudflare','stripe','resend','sentry','axiom','upstash','cronitor','uptimerobot','qstash']` and emits `t(\`processors.${id}.name|purpose|data|location\`)` (11 × 4 = 44 row cells). The 4 table-header keys (`table.processor|purpose|dataProcessed|location`) are also bound. Route registered at `/legal/sub-processors`. Container hosts `useTranslations('Legal.subProcessors')` with explicit decision comment.
- **Sample keys:** `Legal.subProcessors.processors.vercel.name`, `Legal.subProcessors.table.purpose`.

### Onboarding.steps  (16)
- **Verdict:** KEEP-INDIRECT (15) + DELETE-NOW (1)
- **Phase ref / evidence:** `apps/web-vite/src/components/onboarding/onboarding-checklist.tsx` resolves `steps.${stepKey}.title|description|cta` dynamically. Step keys (`addContractor`, `configureApprovals`, `connectSlack`, `inviteTeam`, `orgDetails`) all flow through `tKey(t, \`steps.${step.stepKey}.title\`)`.
- **DELETE-NOW:** `Onboarding.steps.addContractor.secondary` — only `addContractor` has a `secondary` ("Import from file") and the checklist never reads `.secondary` from any step. No planning doc references a secondary CTA on the checklist.
- **Sample keys (KEEP):** `Onboarding.steps.orgDetails.title`, `Onboarding.steps.connectSlack.cta`.

### Consent.purposes  (12)
- **Verdict:** KEEP-INDIRECT
- **Phase ref / evidence:** `apps/web-vite/src/components/consent/consent-purpose-toggle.tsx` lines 34-35: `tKey(t, \`purposes.${purposeKey}.label\`)` + `tKey(t, \`purposes.${purposeKey}.description\`)`. Hosts under `useTranslations('Consent')`. Bound to GDPR consent rows surfaced in onboarding consent step + Settings consent management.
- **Sample keys:** `Consent.purposes.analytics-reporting.label`, `Consent.purposes.invoice-payment-processing.description`.

### ContractorWizard  (10)
- **Verdict:** KEEP-LIVE (4) + KEEP-INDIRECT (6)
- **Phase ref / evidence:**
  - `nipError` + `nipSuccess` → explicit `t('nipSuccess')` / `t('nipError')` in `apps/web-vite/src/components/contractors/hooks/use-contractor-wizard.ts` lines 87/89/92 (GUS NIP lookup outcome).
  - `billingModelOptions.{fixed,hourly,milestone,project}` → resolved dynamically via `tDynLoose(t, 'billingModelOptions', enumKey(m))` in `apps/web-vite/src/components/contracts/contract-wizard/step-financial.tsx` L53 and `step-billing.tsx` (host `useTranslations('ContractorWizard.billingModelOptions')`).
  - `fields.typeOptions.{company,individualFreelancer,other,soleTrader}` → `tDynLoose(t, 'typeOptions', enumKey(type))` in `step-company.tsx` L109 + `contract-wizard/step-details.tsx` L217 + contractor & contract data-table filters.
- **Sample keys:** `ContractorWizard.fields.nipSuccess`, `ContractorWizard.billingModelOptions.hourly`.

### Other small (≤5 each)

#### Legal.privacyIndex.* (5: description + jurisdictions.{de,eu,gb}.{label,subtitle})
- **Verdict:** KEEP-PLANNED
- **Evidence:** Pre-shipped from Phase 56 Country Foundations / German i18n (v5.0, completed). 56-07-PLAN.md L372 + 56-UI-SPEC.md §329 describe the unauthenticated jurisdiction-picker at `/legal/privacy` (cards: UK / Deutschland / EU → `/legal/privacy/{gb,de,eu}`). web-vite currently wires only `privacyIndex.heading` from the jurisdiction container's back-link; the picker page itself was not ported. Phase 73 (F1 Portal Self-Service + i18n) is the next jurisdiction-touching phase and is not started — these keys remain canonical for the deferred port.

#### Legal.DrvUpload.downloadLetter (1)
- **Verdict:** KEEP-PLANNED
- **Evidence:** Phase 64 D-27 DRV decision-letter upload section in `drv-clearance-panel.tsx` only renders the upload affordance; the download-letter button is not yet rendered though sibling keys (`uploadDecisionLetter`, `uploading`, `uploadedAt`, `fileTooLarge`) are live. The download side is the natural symmetric affordance for an already-shipped surface — keep until DRV download is explicitly cut.

#### Legal.SdsApproval.approved (1)
- **Verdict:** KEEP-PLANNED
- **Evidence:** `generate-sds-button.tsx` already binds 5 sibling SdsApproval keys (`gateTitle`, `clientNameLabel`, `clientNamePlaceholder`, `confirmApproval`, `confirmingApproval`). The `approved` state flag controls UI gating; the success banner text ("Approved — you can now generate the SDS") matches the post-approval UX in Phase 64 D-22's SDS approval gate. Keep as deferred surface message.

#### Offboarding.OverrideDialog.reasonServerError (1)
- **Verdict:** KEEP-PLANNED
- **Evidence:** Phase 74 UI-SPEC.md L206 + L431 explicitly require this key on Zod server-side re-validation failure ("defense-in-depth case, not the normal path"). 74-02-PLAN.md L188 and 74-08-PLAN.md L273 list it among shipped i18n keys. Current `override-dialog.tsx` renders raw `serverError` prop without mapping — the mapper is a deferred polish but the key is canonical.

#### Offboarding.PtoBadge.{label,tooltip} (2)
- **Verdict:** KEEP-PLANNED
- **Evidence:** 74-02-PLAN.md L192 + 74-02-SUMMARY.md L76 explicitly list the PtoBadge keys. 74-07-SUMMARY.md confirms the Settings host pages (per-team Fallback Approver embed, per-user Out-of-Office page) are **explicitly deferred / NOT SHIPPED** — that is where this badge renders. Phase 74 is closed but the deferred wave-3 Settings UI is the planned consumer.

#### Onboarding.completed + Onboarding.toast.stepComplete (2)
- **Verdict:** DELETE-NOW
- **Evidence:** Neither key referenced anywhere in `apps/web-vite/src` or `apps/landing`. `onboarding-checklist.tsx` uses `t('progress', ...)` for the progress label and the hook fires `toast.success(toasts.done())` (generic Common toast) on step completion — not `Onboarding.toast.stepComplete`. No planning doc reserves them. Legacy relics from the apps/web port.

## Notes
- Bias-to-KEEP applied: ambiguous keys (DrvUpload.downloadLetter, SdsApproval.approved) kept because adjacent siblings are live and surfaces are tied to closed Phase 64.
- DELETE-NOW set is conservative — only 3 keys with no planning anchor and no dynamic resolver path.
- Heavy hitters (Templates 54 + subProcessors 48 + purposes 12 + steps 15 + ContractorWizard 10 = 139 of 154) are all dynamic-`t(id)` indirection — scanner false-positives because the IDs live in DB-seeded or hardcoded ID arrays, not literal `t('Foo.bar')` call sites.
- Legal.privacyIndex.* 5-key set is the highest-value KEEP-PLANNED — picker page port to web-vite should re-use them verbatim.
- Verify before any deletion: run i18n CI scanner with the seed file (`packages/offboarding-templates/src/seeds.ts`) and dynamic-resolver components in scope.
