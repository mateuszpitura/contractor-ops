# 92-10 SUMMARY — daily working-time-limit scan (rolling-window half)

**Status:** complete. The `wt-limit-scan` Wave-0 HOLD test turned GREEN.
**Plan:** 92-10 (wave 4)

## What shipped

**`services/wt-limit-scan.ts`** (`runWtLimitScan`) — a twin of
`compliance-reminder-scan`:
- Fans out over `SUPPORTED_REGIONS` with `getRegionalClient(region)`; an
  unconfigured region is skipped with a Pino warn, never a throw — so no
  UAE/KSA (ME) employee is silently excluded by an EU-only client.
- Per region, one query pulls `EmployeeTimeRecord` for the widest window (24
  weeks), then each worker is trimmed to their jurisdiction's `weeklyWindowWeeks`
  (PL 16 / UK 17 / DE 24). Jurisdiction resolves from `EmployeeProfile.countryCode`
  via `mapCountryCodeToJurisdiction`; the rule from `resolveWtLimits`.
- **Breach = window Σ workedMinutes / weeklyWindowWeeks > weeklyAvgMaxMinutes**
  (2880 = 48h). A UK opt-out (`weeklyOptOutAllowed` + a `wtOptOut` record in
  window) suppresses it.
- Two-pass digest: breaches group per recipient (`resolveRbacRecipients(org,
  'contractor:read')`, the compliance twin's recipient gate); **ONE digest per
  recipient/day** gated by `claimCronNotificationDedup` on a **region-prefixed
  key `wt:${region}:${recipient}:${day}`** so a claim in one region never
  suppresses another's. Notification `type='employee.wt_limit_breach'`,
  `entityType='EMPLOYEE_TIME_RECORD'`, dotted i18n copy keys
  (`EmployeeTime.notifications.wtLimitDigest.*`) resolved per-locale by
  `resolveEventCopy`. `createCronLogger`; no `console.*`.

**Cron wiring:**
- `services/cron-jobs/index.ts` barrel += `runWtLimitScan`.
- `apps/cron-worker/.../reminders/wt-limit-scan.ts` (`executeWtLimitScan`) — a
  crash-isolated wrapper (never rejects; failure returns zero counts) mirroring
  `executeComplianceReminderScan`. Uses the scan's OWN regional clients, not the
  reminders lock-holding tx; the dedup unique index is the idempotency guard.
- `reminders/index.ts` — added `executeWtLimitScan()` to the `Promise.all` batch
  under the existing `tryAcquireXactLock(tx,'cron','reminders')` tick + skip-path
  zero counts + `wt_limit_breaches` / `wt_limit_digests` gauges.

**Validators:** NOTIFICATION_TYPES += `employee.wt_limit_breach` (required for
`dispatch` to typecheck; dot-notation style like the classification/compliance/tax
types).

## HOLD test turned GREEN

`wt-limit-scan` (4) — real `resolveWtLimits`/country-mapping over mocked regional
clients + dispatch + dedup: a PL worker over the 16-week 48h average fires a
breach; EU AND ME are both scanned (`getRegionalClient` called for each,
both clients queried); two same-org breaches collapse to ONE digest (`count:2`)
and a re-scan of the same region/day dispatches zero (dedup); every dedup key is
`wt:EU:` / `wt:ME:` prefixed.

## Verification

- `pnpm --filter @contractor-ops/db build` + `@contractor-ops/validators build`
  (validators rebuilt so the api sees the new notification type in its dist).
- `pnpm --filter @contractor-ops/api typecheck` — clean.
- `pnpm --filter @contractor-ops/cron-worker typecheck` — clean.
- `pnpm --filter @contractor-ops/api test wt-limit-scan` — 4 passed.
- `pnpm lint:logs` — clean (2430 files, no `console.*`).
- `pnpm lint:no-breadcrumbs` — my files clean.

## Notes

- No new migrations, no new deps.
- The `EmployeeTime.notifications.wtLimitDigest.*` i18n keys are referenced but
  their message-bundle entries land with the web-vite i18n plans (12–15); until
  then `resolveCopy` passes the key through (the scan ships dark behind
  `module.workforce-employees`, default off).
- Statutory WT values (PL/DE/UK caps + windows) stay adviser-verify per the
  LOCAL-ONLY posture.
