# i18n cleanup verdicts — consolidated

Per-cluster reports in `.planning/translations/clusters/{A..H}-VERDICTS.md`.
Generated 2026-05-30. Source: 1 681 keys nominated as "dead" by
`scripts/audit-i18n-unused-keys.ts` (see `i18n-unused-findings.md`).

## TL;DR

**The auditor over-reports by ~5×.** The dominant binding pattern in this
codebase is `useTranslations('NS.sub')` + `t('leaf')`, plus dynamic resolvers
(`tDynLoose`, `tKey`, hook → prop chains). The script's current heuristics
miss all of them.

After 8 parallel cluster audits with planning-doc + roadmap + live-binding
verification, the **real cleanup surface is ~455 leaves**, not 1 681:

| bucket | leaves | meaning |
|---|---:|---|
| **DELETE-NOW** | **~290** | confirmed dead, no plan, no consolidation candidate |
| **CONSOLIDATE** | **~80** | duplicate sub-trees — collapse into canonical |
| **FIX-BUG** | **~85** | server-side rendering currently broken; wire server-i18n or accept English-only |
| KEEP-PLANNED | ~50 | Phase 73/74/77 scaffolds |
| KEEP-INDIRECT | ~1 176 | false positive — auditor blind spot |

## Per-cluster verdict mix

| cluster | candidates | DELETE-NOW | CONSOLIDATE | FIX-BUG | KEEP-PLANNED | KEEP-INDIRECT |
|---|---:|---:|---:|---:|---:|---:|
| A — Notifications + Teams | 168 | 137 | 16 | 26 | 0 | 5 |
| B — Api.* server | 59 | 0 | 0 | 59 | 0 | 0 |
| C — Settings.{integrations,auditLog,apiKeys} | 260 | 15 | 30 | 0 | 12 | 203 |
| D — Settings.* (other) | 195 | 16 | 26 | 0 | 15 | 138 |
| E — Compliance scaffold (Zatca/TaxAdmin/EInvoice/ksef/Peppol) | 344 | 0 | 0 | 0 | 0 | 344 |
| F — Onboarding/Offboarding/Legal/Consent | 154 | 3 | 0 | 0 | 11 | 140 |
| G — Workflows + Admin | 125 | 43 | 0 | 0 | 0 | 79 + 10* |
| H — residual catch-all | 376 | 21 | 8 | 0 | 12 | 316 |
| **total** | **1 681** | **~235** | **~80** | **~85** | **~50** | **~1 235** |

\* G also has 5 `Workflow.*` (singular) leaves slated DELETE/CONSOLIDATE.

## Action waves

### Wave 1 — pure DELETE (low risk, immediate)

| sub-namespace | leaves | source |
|---|---:|---|
| `Notifications.center.*`, `.popover.*`, `.reminderEditor.*`, `.preferences.*`, `.integrations.*`, `.userMapping.*`, `.emptyPage.*`, `.reminders.*`, `.toasts.*`, `.validation.*`, `.destructive.*`, `.errors.*` | 137 | A — UI was rebuilt under `Settings.*`; old `Notifications.*` duplicates never removed |
| `Workflows.*` (singular `Workflow.Start.*` etc., orphan stubs) | 36 | G — zero runtime refs |
| `Admin.{BoeRate,ClassificationEngineFlag}` renamed leaves | 7 | G — superseded names |
| `commandPalette.*` (top-level, lowercase) | 10 | H — superseded by `Common.commandPalette.*` |
| `invoice.reverseCharge.*` | 5 | H — superseded by `Invoices.reverseCharge.*` |
| `Documents.scanStatus.*` | 4 | H — superseded by `Documents.scan.*` |
| `Portal.return.{step1Title,step2Title}` | 2 | H — no consumer |
| `Onboarding.{completed,toast.stepComplete}` | 2 | F — zero bindings |
| `Settings.{changeRequest.status.*, approvals.{activeToggle,conditionSummary}, returnCarrier.*, appearance.uiLanguage}` | 9 | D — abandoned concepts |
| `auditLog.pagination.*` | 3 | C — replaced by shared `DataTablePagination` |
| `Settings.integrations.{description,heading,emptyState.*,syncFailedToast,syncSuccessToast,syncNow,syncing}` | 8 | C — top-level orphans |
| `Onboarding.addContractor.secondary` | 1 | F |
| `Workflow.*` (singular top-level NS, likely typo of `Workflows`) | 5 | G — investigate one rogue typo first; if none, delete |

**Wave 1 total: ~229 leaves × 4 locales = ~916 string deletions.**

### Wave 2 — CONSOLIDATE (medium risk, requires code edits)

| dead sub-tree | canonical target | leaves | source |
|---|---|---:|---|
| `Notifications.{center,popover,emptyPage}.*` duplicates | `Notifications.{title,empty,viewAll,markAllRead,unreadOnly,filters.*}` + `EmptyStates.notifications.*` | 16 | A |
| Linear per-provider `Settings.integrations.<provider>.{status,cta,connectedBy,heading,disconnectConfirm,toasts,templateSettings}` | `Settings.integrations.provider.*` + `disconnectConfirmGeneric.*` + `providerToasts.*` | 30 | C |
| `Settings.provider.*` (top-level under Settings) | `Settings.integrations.provider.*` (merge top-level extras into integrations.provider before drop) | 22 | D |
| `Settings.providerToasts.*` | `Settings.integrations.providerToasts.*` | 4 | D |
| `contractor.vatValidation.*` (top-level lowercase) | `Contractors.vatValidation.*` (wire `vat-validation-status-pill.tsx` to `useTranslations` — currently hardcoded English) | 8 | H |

**Wave 2 total: ~80 dead leaves removed + 1 i18n-debt pill fix (`vat-validation-status-pill.tsx`).**

### Wave 3 — FIX-BUG (server-side rendering broken)

Three same-root-cause bugs, all server-side, all stem from "store an
i18n key string in the DB / pass it via tRPC and expect the client to
render it via `useTranslations`" but the wiring was never finished.

#### 3a. Email subjects + labels (`Api.email.*`, 24 leaves)
- `packages/api/src/services/email-templates.ts:14` — `EMAIL_SUBJECT_KEYS`
  uses bare `'email.subject.X'` (missing `Api.` prefix).
- `packages/api/src/services/notification-service.ts:184` — `subject: String(subject)` → literal `"[object Object]"` in production email subjects.
- `packages/api/src/emails/approval-request.tsx:32-37` — `labels?` prop never threaded; templates render hardcoded English.

**Fix path:** wire a thin server-side i18next bundle reader, resolve
`subject.key + subject.params` before `sendAppEmail`, and pass localized
`labels` into each React Email template. Then `Api.email.*` becomes
genuinely USED.

**Alternative:** delete `Api.email.*` + EMAIL_SUBJECT_KEYS + fix the
`String(subject)` line to use a real string constant. Accepts
English-only emails forever.

#### 3b. In-app notification keys rendered raw (Cluster A — 26 leaves under `Api.notifications.equipment.*` + `Notifications.item.*` + `Notifications.itemBody.*` + `Teams.cards.*`)
- `apps/web-vite/src/components/notifications/notification-item.tsx:149-151`
  renders the bare key in `title` / `body`.
- Server writes them as raw strings at:
  - `apps/api/src/.../equipment-shared.ts:14-19`
  - `apps/api/src/.../equipment-returns.ts:180-181, 279-280`
  - `apps/api/src/.../portal/portal.ts:1540-1541`
  - `apps/api/src/.../workflow-shared.ts:22-35`
  - `apps/api/src/.../workflow-templates.ts:380-494`
- `Teams.cards.*` — `packages/api/src/services/messaging/teams-messaging-provider.ts:176` constructs the adaptive card body, never reads any `Teams.cards.*` JSON.

**Fix path:** notification render layer needs to detect "this is an i18n
key" (e.g. a `titleI18nKey` column convention like the offboarding
templates already use, see `packages/offboarding-templates/src/seeds.ts`)
and call `t(key, params)` on the client.

#### 3c. `Api.errors.*` (17 leaves) — aspirational namespace
- `packages/api/src/init.ts:117-124` comment claims
  `errors.tenant.noActiveOrganization` is a live convention.
- Actual flow uses camelCase constants from `packages/api/src/errors.ts`
  rendered through the `Errors.*` namespace (wildcard-covered in audit).
- Either: wire these `Api.errors.*` paths into real `TRPCError` throw
  sites, or delete and remove the misleading comment.

### Wave 4 — KEEP-PLANNED (do NOT delete)

| sub-namespace | leaves | phase | notes |
|---|---:|---|---|
| `Settings.integrations.slack.*` | 12 | 77 | Slack Org Grid deprovisioning card |
| `Settings.{WorkflowRoles.*, PtoKeywords.*}` | 15 | 74 | KT-template-override table (Phase 74 UI-SPEC L227-242) |
| `Legal.privacyIndex.*` (description + jurisdictions.{de,eu,gb}.{label,subtitle}) | 5 | 56→deferred | jurisdiction picker at `/legal/privacy` deferred |
| `Offboarding.PtoBadge.*`, `Offboarding.OverrideDialog.reasonServerError` | 3 | 74 | Settings wave-3 (per-team Fallback Approver + per-user OOO) not shipped |
| `Legal.DrvUpload.downloadLetter`, `Legal.SdsApproval.approved` | 2 | 64 D-22/D-27 | sibling keys live, symmetric deferred |
| `ContractorProfile.placeholder.*` | ~3 | — | scaffold; verify on portal v2 sweep |
| `Workflows.overrideBlockingTask.*` | 10 | 72 ref | live but bound via sub-NS rebind — auditor false positive |

### Wave 5 — HOLD (entire cluster KEEP-INDIRECT, do not delete)

| cluster | leaves | reason |
|---|---:|---|
| E — `Zatca`, `TaxAdmin`, `EInvoice`, `ksef`, `Peppol` | 344 | All bound via `useTranslations('<NS>.<sub>')` patterns the auditor missed. Verified live: `zatca-integration-container.tsx`, `apps/web-vite/src/components/einvoice/*`, etc. Backing engines exist under `packages/einvoice/src/profiles/{xrechnung-de,zugferd-de,ksef,zatca,peppol-ae}` + ASP. Feature flag `einvoice.import-enabled` live in `packages/feature-flags/src/flags-core.ts`. Roadmap commitments: Phase 61 XRechnung (done 2026-04-14), Phase 62 ZUGFeRD (done 2026-04-16), KSeF milestone 118-120, ZATCA via Phase 70. |
| C — `Settings.auditLog.{actions,resources}.*` | 89 | Dynamic via `tDynLoose(t, 'actions'|'resources', enumKey(...))` in `audit-log-table.tsx:243,262` |
| C — `Settings.apiKeys.*` | 37 | Live via hook→prop binding in `use-api-keys-tab.ts` (4 hooks) → `api-keys-tab.tsx` (4 components) |
| C — `Settings.integrations.*` (excluding deletes + planned) | ~74 | Dynamic via const maps `STATUS_BADGE.labelKey`, `CATEGORY_LABEL_KEYS`, `STATUS_LABEL_KEYS` |
| D — `Settings.{branding,gdpr,userConsent,featureFlags,notifications,carriers,outOfOffice}.*` | ~138 | Sub-NS bindings — auditor blind to `useTranslations('Settings.<sub>')` |
| F — `Offboarding.Templates.*` | 54 | Seeded in `packages/offboarding-templates/src/seeds.ts` as `displayNameI18nKey` columns, resolved via `t(key)` |
| F — `Legal.subProcessors.*` | 48 | `PROCESSOR_IDS` × `t(\`processors.${id}.{name,purpose,data,location}\`)` in `legal/sub-processors-table.tsx` |
| F — `Onboarding.steps.*` | 15 | `tKey(t, \`steps.${stepKey}.title\`)` in `onboarding-checklist.tsx` |
| F — `Consent.purposes.*` | 12 | `consent-purpose-toggle.tsx` resolves dynamically |
| F — `ContractorWizard.*` | ~7 | `billingModelOptions.*`, `typeOptions.*` via `tDynLoose` |
| G — `Workflows.{conditionValue,conditionOperator,actionType,...}.*` | 79 | `condition-builder.tsx` uses `tDynLoose(t, 'conditionValue', enumKey(v))` |
| H — `Equipment`, `Portal`, `Time.spotCheck`, `Classification.*` and others | ~316 | Sub-NS bindings |

## Recommended auditor improvements (separate task)

Before re-running the audit, teach `scripts/audit-i18n-unused-keys.ts`:

1. **Sub-NS binding resolution** — `useTranslations('A.b.c')` binds `t` to
   `A.b.c.*`. The auditor already handles this, but with the floating-literal
   fallback being too narrow, sub-NS dynamic compositions are missed.
   Reading hook destructuring chains end-to-end via a lightweight TS-AST
   pass would close most of the gap.
2. **Dynamic resolver recognition**:
   - `tDynLoose(t, 'subtree', enumKey(...))` → wildcard `${bound}.subtree.*`
   - `tKey(t, \`prefix.${expr}\`)` → dynamic prefix on the bound NS
   - `tDyn(t, subNs, leaf)` → wildcard `${bound}.${subNs}.*`
3. **Constant tables with `.labelKey` / `.i18nKey` / `.titleI18nKey`**
   convention used by:
   - `apps/web-vite/src/components/settings/.../STATUS_BADGE`
   - `apps/web-vite/src/components/integrations/.../CATEGORY_LABEL_KEYS`
   - `apps/web-vite/src/components/integrations/.../STATUS_LABEL_KEYS`
   - `apps/web-vite/src/components/settings/hooks/use-api-keys-tab.ts` (`AVAILABLE_SCOPES.labelKey`)
   - `packages/offboarding-templates/src/seeds.ts` (3 i18nKey columns)
4. **Cross-file hook return propagation** — when `use-X-tab.ts` returns
   `{ t }`, callers' `t('leaf')` should be attributed to the hook's namespace.
   Floating-literal pass partially does this; widening it to follow named
   exports would catch the rest.

With these fixes the next `pnpm i18n:dead` would surface only the ~370
real DELETE + CONSOLIDATE candidates, not 1 681.

## Output files

- `.planning/translations/clusters/{A..H}-VERDICTS.md` — per-cluster reports
- `.planning/translations/clusters/{A..H}-misc-residual.json` etc. — per-cluster key dossiers
- `.planning/translations/i18n-unused-en.json` — original 1 681-key dossier (now superseded by these verdicts)
- `.planning/translations/i18n-unused-report.json` — raw audit JSON
- `.planning/translations/i18n-unused-findings.md` — original (now-corrected) findings
- `scripts/audit-i18n-unused-keys.ts` — auditor script (needs Wave-6 improvements above)
