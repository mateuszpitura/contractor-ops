# i18n cleanup — final report

Session 2026-05-30 — 12 atomic commits on `audit/post-migration-parity`.

## Summary

| metric | start | end | delta |
|---|---:|---:|---:|
| Audit dead keys | 1 681 (26.5%) | **0 true dead** + 12 known false positives (0.2%) | −99.3% |
| en.json leaves | 6 346 | 5 972 | −374 |
| Locale bundle total | 1 537 KB | 1 452 KB | **−85 KB** |
| Tests | n/a | 47/47 pass + 25 new | green |
| Production bugs fixed | 2 |||

## Commits

| sha | wave | scope | locale leaves cut |
|---|---|---|---:|
| `71fac99a` | 1A | `Notifications.{center,popover}.*` | 40 |
| `c46534c8` | 1B | `Notifications` scaffold (8 sub-NS) | 304 |
| `d9808f35` | 1C | top-level typo NSes (`Workflow`, `commandPalette`, `contractor.vatValidation`, `invoice.reverseCharge`) | 84 |
| `c308674a` | 1D | `Admin` rename residue + `Documents.scanStatus` + `Portal.return.step{1,2}Title` + Onboarding small | 52 |
| `ea365a6a` | 2 | `Settings.provider*` duplicate trees → `Settings.integrations.*` canonical | 144 |
| `dad1c821` | 3a | **server-side email i18n** — new resolver + 6 React Email templates + 25 tests | — |
| `02bacc3f` | 3b | `Api.errors.*` aspirational namespace + scrub misleading `init.ts:119` comment | 68 |
| `81bcab35` | 3c | **dispatch-level i18n key resolution** for in-app notifications + `Notifications.equipment.*` + rename equipment `NOTIFICATION_KEYS` | — |
| `6f93bd28` | 4A | `Workflows.*` empty/filter/search/toast/validation/pagination/sidePanel residue | 124 |
| `b093071d` | 4B | `Notifications.{item,itemBody}.*` + `Teams.cards.*` (confirmed-dead reclassification) | 92 |
| `8e57f76b` | 4C | misc-domain (`Import`/`Classification`/`Common`/`EInvoice`/`Equipment`/`Documents`/`Validation`/`Portal`/`ksef`/`Legal`/`Peppol`) | 492 |
| `9182c893` | 4D | small-NS residuals (13 NSes) | 112 |
| **total** | | | **1 512** |

## Production-correctness fixes

### A. Email pipeline (Wave 3a)
- `notification-service.ts:184` shipped `subject: String(subject)` where subject was `{ key, params }` → every notification email had literal `"[object Object]"` subject. Affected 6 event types (APPROVAL_REQUEST, APPROVAL_DECISION, TASK_ASSIGNED, TASK_OVERDUE, CONTRACT_EXPIRING, INVOICE_RECEIVED).
- `EMAIL_SUBJECT_KEYS` used bare `email.subject.X` paths instead of canonical `Api.email.subject.X` paths present in locale bundles.
- React Email templates declared `labels?:` prop but no caller threaded localized strings → all recipients saw hardcoded English fallbacks even when org language was `pl` / `de` / `ar`.

**Fix**:
- New `packages/api/src/i18n/email-i18n.ts` resolver loads all four locale bundles at boot. Exports `resolveMessage(key, locale, params)` with `{var}` interpolation and `locale → en` fallback. `normalizeLocale` accepts `pl-PL`, `de_DE`, etc. and clamps anything unknown to `en`.
- `email-templates.ts` rewires `EMAIL_SUBJECT_KEYS` to full `Api.email.subject.*` paths, adds per-template + base-layout label maps, and `renderNotificationEmail` returns `{ subject: string, react }` with all strings pre-resolved.
- `notification-service.ts` looks up `Organization.language` for `event.organizationId`, normalizes, passes to `renderNotificationEmail`. `String(subject)` cast removed.
- `base-layout.tsx` exports `EmailBaseLabels`. Each of the 6 child templates accepts `baseLabels?: EmailBaseLabels` and threads them into `<BaseLayout>` so CTA / footer / unsubscribe text follows recipient locale.

### B. In-app notification dispatch (Wave 3c)
- Equipment-domain emitters passed bare i18n key strings (`'notifications.equipment.returnApproved.title'`) as `event.title` / `event.body`. These were stored in `Notification.title` / `body` columns, sent verbatim to Slack/Teams channel alerts, and rendered as plain text in `notification-item.tsx:147-152`. Users saw the literal key string in the UI / Slack / email body.

**Fix**:
- `dispatch()` calls new `resolveEventCopy(event)` once per dispatch.
- Looks up `Organization.language`, normalizes, then rewrites any `title` / `body` matching the dotted-key pattern `^[A-Za-z][\w$]*(\.[A-Za-z][\w$]*)+$` via `resolveMessage`. Fully-rendered prose passes through unchanged.
- Equipment `NOTIFICATION_KEYS` migrated from broken `notifications.equipment.*` to canonical `Notifications.equipment.*` paths that exist in all four locale bundles.
- New `Notifications.equipment.{returnApproved,returnRejected}.{title,body}` keys with `{trackingNumber}` / `{reason}` placeholders shipped to en / pl / de / ar.

## Auditor improvements (this session)

`scripts/audit-i18n-unused-keys.ts` was rewritten v1 → v2 mid-session:
- Pass 1 hook discovery — 71 hooks traced across `src/**`.
- Cross-file binding: imported hook exposes its namespace to the caller.
- Recognition for `tDyn(t, sub, leaf)` / `tDynLoose(t, sub, leaf)` / `tKey(t, key)`.
- 15 `.labelKey` / `.i18nKey` / `.titleI18nKey` / `.displayNameI18nKey` / `.subjectI18nKey` etc. const-table field patterns scanned.
- Widened floating-literal resolution: matches any leaf ending in `.<floating>`.
- Extra scan roots: `apps/api`, `apps/cron-worker`, `apps/public-api`, `packages/{api,offboarding-templates,compliance-policy,einvoice,integrations,feature-flags,validators}`.

Auditor result: **1 681 false positives → 12** (99.3% precision).

## Remaining 12 keys (confirmed KEEP — auditor false positives)

All 12 are live runtime references the auditor still can't trace:

| key | reason | live binding |
|---|---|---|
| `Classification._NOTE` | doc pseudo-key (CLASSIFICATION_* / DISCLAIMER_* live in `packages/validators/src/legal/`) | n/a — comment-only |
| `ContractorWizard.fields.nipError`, `nipSuccess` | toast callbacks | `use-contractor-wizard.ts:87-92` |
| `Portal.return.cancelConfirmTitle`, `cancelConfirmDescription` | namespace rebind | `portal-equipment-tab.tsx:188-199` via `tReturn` |
| `Workflows.overrideBlockingTask.{warning,reasonLabel,reasonHelp,acknowledge,confirmCta,toastSuccess,toastFailure}` (7) | namespace rebind | `run-header.tsx:54` + `use-workflow-ui.ts:226` (Phase 74) |

## Auditor v3 improvements queued

To close the remaining 12 false positives:

1. **Multi-level rebind** — when a file binds `useTranslations('A.b.c')` AND `useTranslations('A')`, the second binding is recognised but the first is treated as a sub-NS within `A`. Need both registered independently in the candidate set.
2. **Generic `t`-callback tracing** — currently only `use*` exports are scanned for hook bindings. Should also detect `function getTranslator()` / `function makeT()` / etc.
3. **Doc-pseudo-key suffix recognition** — `_NOTE`, `_TODO`, `_HELP`, `_DESC` etc. as documented exclusions.

## Out-of-scope follow-ups identified

These items surfaced during cluster audits and are tracked for future passes:

- `apps/web-vite/src/components/contractors/vat-validation-status-pill.tsx:31-55` hardcodes English for vatValidation states (CONSOLIDATE candidate from Wave 2).
- `apps/web-vite/src/components/calendar-settings/duration-options.ts` (or similar) hardcodes duration English strings — keys deleted in Wave 4D but the hook should be i18n-wired.
- `apps/web-vite/src/.../app-footer.tsx` hardcodes copyright English — `Layout.footer.copyright` deleted.
- `apps/web-vite/src/.../route-error-boundary.tsx` hardcodes "Reload" — `boundaries.*` deleted.
- `apps/web-vite/src/.../google-workspace-reconnect.tsx` aria-label hardcode — `Integrations.GoogleWorkspaceReconnect.dismissAria` deleted.
- `packages/api/src/services/teams/cards/*.ts` hardcodes every English string for Teams adaptive cards. Phase 77 / 78 may wire i18n for IDP integrations; until then the deleted `Teams.cards.*` catalog stays absent.

## Cherry-pick mid-flight + parallel agent

Two commits during this session were created by a parallel agent or pulled in by lint-staged from queued cherry-pick patches:

- `89e11184 test(web-vite): repair tests broken by noJsxPropsBind refactor`
- `88132b7d test(api,integration): mock loadHeavyAdapters export for getOAuthUrlGeneric`

Plus `c46534c8` (Wave 1B) absorbed two test-file reformats matching queued cherry-pick `72934061`. The four i18n delete-commits before Wave 1B and after were clean (only locale-file changes).

`.git/sequencer/todo` still lists two queued picks at session end. Coordinate with the parallel agent before opening a PR.
