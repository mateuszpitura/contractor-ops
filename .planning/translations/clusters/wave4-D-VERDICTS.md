# Wave 4-D — residual verdicts

## Summary
- Total: 30
- DELETE-NOW: 28
- KEEP-PLANNED: 0
- KEEP-INDIRECT: 2 (ContractorWizard.fields.nipError/nipSuccess — verified live in `use-contractor-wizard.ts`)
- CONSOLIDATE: 0

Verification method: per-NS `grep -rnE "<NS>\\."` for binding + literal `t('<leaf>')` calls across `apps/web-vite/src` (excluding `keys.d.ts`, `messages.d.ts`, `messages/*.json`). Cross-checked `.planning/` for upcoming-phase use.

## Per sub-NS

### CalendarSettings (5 leaves) — DELETE-NOW
Duration labels were planned for `calendar-event-config-dialog` / `use-calendar-task-config.ts` but the hook hard-codes English strings (`'30 min'`, `'1 hour'`, …) in `durationLabels: Record<string, string>` at `use-calendar-task-config.ts:56`. The keys exist but `t('duration*')` is never called. Safe DELETE; refactor hook to use t() is out of scope for this audit.

DELETE list:
- CalendarSettings.duration1h
- CalendarSettings.duration2h
- CalendarSettings.duration30m
- CalendarSettings.duration4h
- CalendarSettings.durationFullDay

### Billing.gate (4 leaves) — DELETE-NOW
`Billing.gate` namespace is bound only in `upgrade-inline-banner.tsx`, which uses `requiresTier` + `upgradePlan`. No page-level gate component exists; `pageBody/pageHeading/tierErrorToast/upgradeAction` have no consumers. Not referenced in `.planning/` upcoming work.

DELETE list:
- Billing.gate.pageBody
- Billing.gate.pageHeading
- Billing.gate.tierErrorToast
- Billing.gate.upgradeAction

### GoogleWorkspace (4 leaves) — DELETE-NOW
`GoogleWorkspace.import` and `.sync` bindings exist in multiple components/hooks, but none of these four leaves are referenced. `orgUnitFilter` shows up only as a React state name (`useState<string>('')`) in `directory-preview-table.tsx`, not a `t()` call; the actual i18n label there is `t('allOrgUnits')`. `retryFailed`/`syncComplete`/`syncNoChanges` have zero `t()` consumers.

DELETE list:
- GoogleWorkspace.import.orgUnitFilter
- GoogleWorkspace.import.retryFailed
- GoogleWorkspace.sync.syncComplete
- GoogleWorkspace.sync.syncNoChanges

### Offboarding (3 leaves) — DELETE-NOW
`Offboarding.OverrideDialog` is bound (`override-dialog.tsx:71`), but `reasonServerError` is not consumed (server validation messages come from tRPC errors). `Offboarding.PtoBadge` has no binding anywhere — no component renders a PTO badge with these keys.

DELETE list:
- Offboarding.OverrideDialog.reasonServerError
- Offboarding.PtoBadge.label
- Offboarding.PtoBadge.tooltip

### OnboardingImport (3 leaves) — DELETE-NOW
`OnboardingImport.step4` is bound (`confirm-import-step.tsx`, `import-progress-tracker.tsx`) and root `OnboardingImport` is bound in `source-selection-step.tsx` / `onboarding-import-container.tsx` — but `oauthError`, `settingsReimport`, and `step4.errorPrefix` are never invoked via `t()`. Error UI uses different keys.

DELETE list:
- OnboardingImport.oauthError
- OnboardingImport.settingsReimport
- OnboardingImport.step4.errorPrefix

### Time (3 leaves) — DELETE-NOW
`Time` and `Time.spotCheck` namespaces are heavily bound (15+ components/hooks) but these three leaves are not called. Spot-check loading uses skeletons, not text labels; `entryEntityLabel` plural form has no consumer (entry counts use a different key elsewhere).

DELETE list:
- Time.entryEntityLabel
- Time.spotCheck.loadingContractors
- Time.spotCheck.loadingContracts

### ContractorWizard.fields (2 leaves) — KEEP-INDIRECT
Both keys are live: `apps/web-vite/src/components/contractors/hooks/use-contractor-wizard.ts:87` calls `toast.success(t('nipSuccess'))` and lines 89/92 call `toast.error(t('nipError'))`. False positive from auditor — keys are consumed via toast callbacks (GUS NIP lookup branch).

DELETE list: none

### boundaries (2 leaves) — DELETE-NOW
Lowercase top-level namespace; no `useTranslations('boundaries')` binding anywhere. The actual error/loading UI lives in `apps/web-vite/src/components/error/route-error-boundary.tsx`, which hard-codes English text (`'Reload'` at line 107) and uses no i18n. Namespace was allocated but never wired — not a typo of a plural counterpart, just orphan. Safe DELETE.

DELETE list:
- boundaries.error.reload
- boundaries.loading.ariaLabel

### Auth.login (1 leaf) — DELETE-NOW
`social-buttons.tsx:16` binds `Auth.register` (not `Auth.login`) and calls `t('socialDivider')` against the register namespace. The `Auth.login.socialDivider` copy is a duplicate under the wrong sub-NS and has no consumer.

DELETE list:
- Auth.login.socialDivider

### Integrations.GoogleWorkspaceReconnect (1 leaf) — DELETE-NOW
`google-workspace-reconnect-banner.tsx:75` binds the namespace but only renders `bannerTitle`, `bannerBody`, `reconnectButton` — the dismiss control is implemented as an icon button with `aria-label={t('bannerTitle')}` (line 87), not via `dismissAria`. Phase 70-10-PLAN.md mentions `dismissAria` as part of the provided keyset, but the implementation never wired a dismiss-specific aria label; key is dead in shipped code.

DELETE list:
- Integrations.GoogleWorkspaceReconnect.dismissAria

### Layout.footer (1 leaf) — DELETE-NOW
`app-footer.tsx:13` binds `Layout.footer` and uses `t('privacy')` + `t('terms')`. The copyright line is hard-coded `© {year} Contractor Ops` (line 29). `copyright` key has no consumer and would need a code change to be used — out of scope, DELETE.

DELETE list:
- Layout.footer.copyright

### TopBar (1 leaf) — DELETE-NOW
`top-bar.tsx:57` binds `TopBar` and uses `t('search')` only. `searchShortcut` (Cmd+K) is never referenced; shortcut hint is either hard-coded in JSX or absent. DELETE.

DELETE list:
- TopBar.searchShortcut

## Notes
- Total DELETE: 28 leaves across all 4 locale files (en, de, pl, ar) → 112 JSON entries.
- Total KEEP: 2 leaves (ContractorWizard.fields.nipError, ContractorWizard.fields.nipSuccess) — verified live via `t()` in `use-contractor-wizard.ts`.
- No CONSOLIDATE / KEEP-PLANNED cases — orphan namespaces (`boundaries`, `Billing.gate.page*`) were allocated by design contracts but the receiving components hard-code text or use different keys. Deletion is reversible if a future phase wires them up.
- `dismissAria` is mentioned in `70-10-PLAN.md` as a planned key, but Phase 70-10 has shipped and the dismiss button uses `bannerTitle` for its aria-label. Treating as DELETE-NOW; if a future a11y pass adds a dedicated dismiss label, re-add via translation PR.
- Out-of-scope follow-ups (do not action here):
  - `use-calendar-task-config.ts:56-62` should call `t('duration*')` instead of hard-coding labels — file an i18n debt ticket.
  - `route-error-boundary.tsx` hard-codes "Reload" — same.
  - `app-footer.tsx:29` hard-codes copyright — same.
