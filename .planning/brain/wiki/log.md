---
title: Wiki log
type: log
---

# Wiki log (append only)

## 2026-07-16 — Marketplace runnable packages + UIs (Phase 101 waves-2 build)

Built the three deferred Phase-101 plans (06/07/09): `@contractor-ops/n8n-nodes` + `@contractor-ops/zapier-app`
runnable packages (both generated from `marketplace-manifests` so their surface can't drift; publish/submission
dark), the Make.com blueprint (`apps/public-api/marketplace/make/blueprint.json`), the web-vite Settings→Developer
marketplace listing-status dashboard (`marketplace-tab.tsx` + `use-marketplace-tab.ts`, wired to the
`marketplaceListing` router), and the `apps/landing` public `/status` front-end over `/v1/status.json`. Dep-age
gate cleared (`n8n-workflow@2.16.0`, `zapier-platform-core@19.0.0`, both ≥7 days). Post-merge tests green
(n8n 23, zapier 9, manifests 20, marketplace-tab 8, landing status 9). Updated [[domains/developer-experience]]
+ [[structure/packages]].

## 2026-07-10 — Shield patterns from adversarial round 2 (~01:45 batch)

Extended skill with S8–S10, T8–T11 (same-file stale refs, seed backfill, handler sibling fan-out, nullable silent wrong math, batch determinism, boolean→enum guess, mandatory touched-module vitest). Wiki table maps handoff round-2 findings → pattern classes. Hooks unchanged — T11 is verify-gate not PreToolUse.

## 2026-07-10 — Business logic shield skill + hooks

New agent skill `.claude/skills/business-logic-shield/` (S1–S7, T1–T7 from business-logic review). Opt-in hooks: `[shield]` blocks logic-path Write/Edit until skill read + `.claude/hooks/.state/shield-scope.json`; `[shield-strict]` also blocks Grep/Glob until skill read. Implementation: `shield-workflow-{lib,prompt,track,guard}.js` (`.claude/` + `.codex/`). Cursor rule `35-business-logic-shield.mdc`. Wiki: [[patterns/business-logic-shield]].

## 2026-07-10 — Contract expiry cron + isExpired TZ fix

`runContractExpiryScan` (`packages/api/src/services/contract-expiry-scan.ts`) + `contract-expiry-scan` cron handler (`0 4 * * *`, `CRON_CONTRACT_EXPIRY_SCAN_SCHEDULE`): per-region fan-out, ACTIVE→EXPIRING within 30 calendar days of `endDate`, ACTIVE/EXPIRING→EXPIRED when `endDate` < today, CAS `updateMany` + SYSTEM `STATUS_TRANSITION` audit. `isExpired`/`daysUntilExpiryInTz` now build expiry boundary from UTC Y-M-D of `@db.Date` (fixes US negative-offset off-by-one). Wiki: [[domains/contracts-lifecycle]], [[structure/cron-jobs]].

## 2026-07-10 — Pack7-integrations MED/LOW closure

API-key create/update/revoke + webhook-subscription CRUD/rotate audit in `$transaction`; import `commit` re-validates rows + audit; Jira disconnect audit-in-tx; gulf `setSaudiAssignmentFields` + saudization upserts + marketplace listing update audit-in-tx; deprovisioning `enableProviderForOrg` audit-in-tx; Linear inbound `validateTransition` + org-scoped task update; dispatcher kill-switch re-enqueues disabled attempts; subscribe create/update assert `module.outbound-webhooks`; Teams channel mapping + fallback approver audit; Jira/Linear status-mapping + task-config audit; import-processor uses `ctx.db`; dispatch rate-limit in-memory fallback. Wiki: [[domains/outbound-webhooks]], [[domains/onboarding-and-import]].

## 2026-07-10 — Pack1-finance MED/LOW closure

BACS `generateExport` audit in tx; `_initiatePayoutForRun` persists adapter order id on `PaymentRunItem.paymentReference`; `verifyBillingProfilePlaid` org-scoped update; `toggleReverseCharge` blocks PAID/IN_RUN/VOID; LPC `claim` audit; intake finalize updates pre-filter `organizationId`; `roundHalfUpMinor` + BACS digit-length + NACHA ABA checksum guards. Wiki: [[domains/payments-and-bank-files]].

## 2026-07-10 — Pack2-tax MED/LOW closure

`taxSummary` pending WHT uses uncertificated payment-run-item join; WHT cert `@unique(paymentRunItemId)` + P2002 retry; ZATCA onboarding + WHT list/issue use `ctx.db`; ZATCA UBL builder per-line VAT + grouped tax breakdown. Wiki: [[domains/tax-and-wht]], [[integrations/zatca]].

## 2026-07-10 — Pack4-workforce MED/LOW closure

Leave sick/adjust audits use `WORKER`; org leave-config audits use `ORGANIZATION` + config id in metadata; notification dispatch failures logged. Ewidencja: month-aligned period guard + `P2002` → `CONFLICT`. Payroll export: `sensitiveActionMiddleware` + explicit mixed-country batch rejection in `buildPayrollFeed`. Employee register/reveal audits use `resourceType:'EMPLOYEE'`. Wiki: [[domains/leave-and-time]], [[domains/payroll-export]].

## 2026-07-10 — Pack5-workflow MED/LOW closure

Bulk approval steps process sequentially (no parallel `advanceFlow` races); delegate/clarify audit already present; `processShipmentStatusChange` wraps DB writes + SYSTEM audit in one tx; `reassignTask` audit + IN_PROGRESS guard; `workflowRoles.list`/`selectForContractor` require `workflow:read`; equipment `createShipment` links active `assignmentId`; shipment event IIFE `.catch`. Wiki: [[domains/approvals-engine]], [[domains/workflows-and-roles]], [[domains/equipment-logistics]].

## 2026-07-10 — Pack6-docs MED/LOW closure

Reminder `update` maps whitelisted columns only (`buildReminderRuleUpdateData`); `reminderRuleUpdateSchema` is `.strict()`. New `document-virus-scan-reconcile` cron re-schedules stale `PENDING`/`FAILED` document scans. Wiki: [[domains/documents-and-ocr]], [[structure/cron-jobs]].

## 2026-07-09 — Wave 2 partials (H-OFF-1/3/7, H-CLS-3, H-APP-1) + API test mock fixes

Template builder exposes `IP_VERIFICATION` / `CONTRACT_HEALTH_CHECK` and auto-injects IP verification on new OFFBOARDING templates. `forceCompleteRunWithPendingCredentials` rejects any open non-terminal task. Deprovisioning retry enqueue failure reverts step to FAILED (matches start path). Classification dashboard test fixtures use uppercase band enums. Approval-engine adds unmocked `memberRoleToUserRole` test. API tests: deprovisioning `subjectType`, compliance virus-scan + contractor gate mocks, employee `personnelFile`, leave-approval billing/add-on/ledger mocks, reminder/v6 logger `createIntegrationLogger`. Wiki: [[domains/workflows-and-roles]].

## 2026-07-09 — Zero-debt review closure (raw-pack LOW stragglers)

Equipment auto-InPost + auto-complete SYSTEM audit rows; `resolveOcrCreditAllowance` blocks unknown-tier NaN credits; webhook dispatch rate-limit uses in-memory fallback when Redis errors (no fail-open); invoice-intake `findFirst({ id, organizationId })` on match/finalize paths. Handoff + review docs marked zero-debt ✅. Wiki: [[domains/equipment-logistics]], [[integrations/framework-core]], [[domains/documents-and-ocr]].

## 2026-07-09 — Opportunistic MED/LOW review closure

Business-logic review stragglers: InPost HTTP outside tx + FSM-filtered courier updates; e-sign read RBAC (`contract:read`); payroll export `employeePii:read`; leave submit balance scoped to leave year; OCR `createRegionalPresignedDownloadUrl`; Linear webhook `validateTransition`; deprovisioning + Gulf saudization audit-in-tx; classification/reassessment CAS; `invoice.create` audit. Handoff + review docs updated ✅. Wiki: [[domains/equipment-logistics]], [[integrations/docusign-esign]], [[domains/payroll-export]], [[domains/leave-and-time]], [[domains/documents-and-ocr]], [[domains/workflows-and-roles]], [[domains/idp-deprovisioning]], [[domains/gulf-saudization]], [[domains/classification-ir35]], [[domains/invoice-to-payment]].

## 2026-07-09 — Residual review follow-ups (KSeF inbound, ZATCA OTP, Peppol 0235, T6/T7, MED batch)

KSeF FA(3) inbound: `P_11A` parsed as gross (not VAT); mixed-rate `P_13_*`/`P_14_*` totals; buyer NIP relaxed for B2C/foreign (`schemas.ts`). ZATCA web-vite: OTP field on compliance CSID step (`compliance-csid.tsx`). Peppol: UI preview `0235:` + migration `20260709120000_peppol_uae_scheme_0235`. T6: `assertWorkforceEnabled` on classify approve/reject; HR dashboard requires `module.workforce-employees`; webhook create re-asserts `module.outbound-webhooks`. T7/MED: import-processor uses `ctx.db`; payment-run item transition guards; 1042-S box-2 FX to USD; WHT cert dedup; LPC waive/revoke audit; import commit audit; Peppol connect/disconnect audit; 1099 uploadAck schemaVersion filter; `forceCompleteRunWithPendingCredentials` → `override_blocking_task`. Updated [[integrations/ksef]], [[integrations/zatca]], [[integrations/peppol]].

## 2026-07-09 — Business-logic review closure (docs + last gaps)

Closed remaining review-pack HIGH rows: WHT certificate issuance audit (`wht-certificate.service.ts` + `tax.ts`); ZATCA compliance/production cert audit (`zatca-onboarding.ts` + `zatca.ts`); extended `CURRENCY_MAP` for Gulf/EU settlement currencies (`packages/shared/src/money.ts`); equipment return terminal `RECEIVED` enum (migration `20260708120000_equipment_return_received`). Updated handoff + consolidated review docs to 100% BLOCKER/HIGH status. Wiki: [[domains/equipment-logistics]], [[domains/payments-and-bank-files]], [[integrations/zatca]].

## 2026-07-08 — Multi-region EU-pinning (C-29 / H-REG-1)

Fixed EU-pinned out-of-request-frame paths: outbox drain (`drainOutboxBatch` fans `SUPPORTED_REGIONS`), webhook `_process`, Peppol QStash routes, ZATCA submit/reconcile, e-sign completion, public-API key resolve (`findAcrossRegions`), 1099-K/NEC crons, API-key leak alarm. New `@contractor-ops/db` helpers: `tryGetRegionalClient`, `findAcrossRegions`, `resolveOrganizationRegion`. Updated [[structure/cron-jobs]], [[patterns/transactional-outbox]].

## 2026-07-08 — E-invoicing C-19..C-22 (ZATCA submit + Peppol UAE)

ZATCA: `enqueueJob('zatca.submit')` on invoice approval; `queueZatcaSubmission` uses typed queue; REJECTED chain rows reset to PENDING on resubmit; invoice hash via `zatca/hash.ts` (C14N excl. extensions/QR, base64 to API). Onboarding uses real `ZatcaApiClient` + OTP on `requestComplianceCsid`. Peppol: UAE scheme **0235**; `peppol.outbound` producer on UAE approval. Updated [[integrations/zatca]], [[integrations/peppol]].

## 2026-07-08 — Workforce C-5..C-9 (leave accrual, portal flow, PersonnelFile, HRIS linking)

Wired built-but-unwired workforce seams: `leave-accrual.ts` (onboarding + daily cron + `leave.adjustBalance` + Jan-1 carryover); portal manager closes `ApprovalFlow` before `finalizeApprovedLeave`; `PersonnelFile` created on `employee.register` + HRIS upsert + dual termination mirror; HRIS email auto-match + `linkEmployee`/`listUnlinkedEmployees`; pull hash only when `applied:true`. Updated [[domains/leave-and-time]], [[domains/personnel-file]], [[domains/hris-sync]], [[domains/employee-portal]].

## 2026-07-06 — UAE + KSA statutory leave/working-time rules (Phase 92 reconcile, Theme B)

Closed a real scope gap found while reconciling Phase 92: the per-market leave-accrual + working-time
registries (`compliance-policy` `leave-registry.ts` / `wt-registry.ts`) only covered PL/DE/UK. Registered
**UAE** (Federal Decree-Law No. 33/2021 Art. 17/19/29 — 30-day annual leave, 48h/wk, 2h/day OT ceiling,
25/50% premium) and **KSA** (Royal Decree M/51 Art. 98/107/109 — 21→30-day annual leave at 5yr, 48h/wk,
50% OT) in `policies/{uae,ksa}.ts`, each cited + `PENDING legal review` adviser-verify. Documented in
`policies/us.ts` that **US is intentionally unregistered** (no federal statutory paid-leave floor; FLSA has
no max-hours cap) — `resolve*('US')` returns `undefined` → org-policy fallback; US remains the test's
"unregistered exemplar". Added UAE/KSA assertions to `leave-registry.test.ts` + `wt-registry.test.ts`.
Updated [[domains/leave-and-time]].

## 2026-07-05 — Staff HR dashboard UI (Phase 97, Theme B)

New [[domains/hr-dashboard]]: the web-vite `/dashboard/hr` surface on the 97-03/04/05 `hrDashboard.*` procedures.
Six wired sections (KPI header + headcount + vacation-utilization + doc-expiry + probation + Gulf nationalisation),
each `page → wired section → hooks/use-hr-* (sole tRPC boundary) → *View`, with loading/empty/degraded/error states;
watchlists use the canonical `WorkbenchDataTable`. Dark behind `module.hr-dashboard`. Gate correction recorded: the
four HR roles are NOT in the client `MemberRole` union, so `can('employee','read')` is a client no-op — the page +
nav match the raw role via `apps/web-vite/src/lib/hr-roles.ts` (new additive `NavItem.roles` predicate in
`use-nav-items.ts`); the server stays authoritative. Doc-expiry renders only the server's section-filtered set; the
Gulf rollup shows the "record manual headcount" prompt (never a derived rate). Full 5-locale `HrDashboard` i18n
(en/en-US/de/pl/ar; de/pl/ar machine-assisted, native-review-flagged) + `Navigation.hr`. Updated
[[structure/web-vite-domains]], [[domains/_index]], `.planning/MEMORY.md`.

## 2026-07-05 — Outbound webhooks + integration security (Phase 100)

New [[domains/outbound-webhooks]]: signed (`X-CO-Signature` HMAC + 5-min replay), PII-safe (redact-before-persist),
SSRF/DNS-rebind-guarded (both gates, hand-rolled `lookup` hook — no new dep), DLQ-backed (`webhook_failures`,
backoff `[1m,5m,30m,2h,12h,24h]` max 6) event delivery. Fan-out reuses the OutboxEvent outbox; per-delivery
retry is a dedicated `/webhooks-outbound/_deliver` drain. New `webhookSubscription` router + Settings → Developer →
Webhooks UI + `webhooks:manage` scope. API-key leak alarm cron (>3 IPs/24h). The INTEG-SEC-04 OWASP gate passed
→ the P99 write routes were un-hidden into the spec/SDK (per-org `module.public-api` grant stays manual).
Updated [[structure/api-routers-catalog]], [[domains/public-api-surface]].

## 2026-07-05 — Transactional outbox WIRED (INT-1-1, reliability S1)

- The outbox (`services/outbox/`) was built-correct but completely unwired: zero production callers of `enqueueOutboxEvent`, no QStash schedule polling `/outbox/_drain`. Notifications went out post-commit fire-and-forget (`dispatch().catch()`) = at-most-once, lost on a crash between commit and dispatch.
- **Infra:** new typed producer helper `enqueueNotificationOutboxEvent({tx, event, dedupKey})` (`services/outbox/index.ts`); new boot bootstrap `apps/api/src/lib/outbox-schedule.ts` `ensureOutboxDrainSchedule` (idempotent `schedules.create({scheduleId:'outbox-drain', cron:'* * * * *'})` + list-assert), called from `apps/api/src/index.ts` `main()` gated on `QSTASH_TOKEN`, non-fatal. Only event type remains `notification.dispatch` (all dispatch sites are notifications). Exactly-once path proven by a commit→skip-dispatch→drain test.
- **Money-path sites** converted to enqueue INSIDE the existing `$transaction`: Stripe billing webhook (`apps/api/src/routes/webhooks/stripe.ts` — enqueues the `routeStripeEvent` notification queue before the tx commits, replaces the post-commit `dispatchStripeWebhookNotifications`), `approval-submit.ts` (APPROVAL_REQUEST), `invoice-crud.ts` (INVOICE_RECEIVED). Wiki: [[domains/notifications-and-reminders]], [[structure/key-services]], [[structure/apps]].
- **Mechanical sites** converted (enqueue in-tx): `workflow-execution-runs.ts` startRun (TASK_ASSIGNED, per-task), `equipment-returns.ts` approve/reject (EQUIPMENT_RETURN_APPROVED/REJECTED, inside the `auditedMutation` tx), `portal-equipment-router.ts` requestReturn (EQUIPMENT_RETURN_REQUESTED). Wiki: [[domains/workflows-and-roles]], [[domains/equipment-logistics]].
- **Deferred (needs-tx-refactor — dispatch is post-commit with the announced write in a separate tx, `prismaRaw` upsert, or a cron/no-tx context; forcing a tx would be a larger change):** `workflow-execution-tasks.ts` reassignTask, `credit-service.ts` CREDIT_EXHAUSTED, `compliance-admin.ts`, `ksef-sync-orchestrator.ts`, `economic-dependency-scan.ts`, `compliance-reminder-scan.ts`, `form-1099k-tracker.service.ts`, `google-workspace-sync-orchestrator.ts` (new-hire/departure).

- **Cross-phase HOLD resolved (Plan 09 Tasks 2-3):** with the P86 IRIS seam now on main, the staff 1042-S filing card + portal consent-gated recipient PDF are built, reusing the shared components verbatim (never rebuilt).
- Backend: new `form-1042s-transmit.service` (`buildAndValidate1042S`, sibling of the shared `tax-filing-transmitter` for Pub 1187) + three `form1042s` procedures (`buildAndValidateXml` / `downloadValidatedXml` / `uploadAck`) mirroring the 1099 tail — idempotent download, ack via the shared `iris-ack-parser`, the Pub 1187 schema version as the `IrisSubmission` discriminator (no form-type migration), BUNDLE_UNAVAILABLE (non-throwing) until the human XSD lands. New portal `downloadForm1042S` gates the recipient 1042-S Copy B on the SAME e-delivery consent (IDOR-scoped, FTIN last-4).
- UI: `tax-1042s-filing-card` (reuses `IrisStatusPill` + `AckUploadField` + `CorrectionDialog`) mounted on `/tax-filing`; portal `copy-1042s-download` reuses `useEdeliveryConsent` + `StepEdeliveryConsent`; `CorrectionDialog` + `StepEdeliveryConsent` gained a `namespace` prop for correct form-type copy. Added `Tax1042SFiling` + `Tax1042SConsent` namespaces across en/de/pl/ar at parity (de/pl/ar machine-translated, flagged for native review; en-US inherits en).
- Wiki: [[domains/us-tax-forms]] transmit-tail paragraph / UI-surface / entry-points / invariant / agent-mistake updated (HOLD → built); [[structure/web-vite-domains]] + [[structure/api-routers-catalog]] + [[structure/key-services]] rows + source_commit bumped.
- **Verification:** `@contractor-ops/api` typecheck green; web-vite typecheck clean except the pre-existing Phase-92 `team-calendar` scaffold (another stream); `check:web-vite-data-layer` / `dialog-pattern` OK; `i18n:parity` OK; scoped `form-1042s` / `iris-ack` tests 27/27.
## 2026-07-06 — CI migration-drift check: shadow DB provisioned, report-only (drift-gate)

- [[structure/prisma-schema-areas]] — the "Verify migrations reproduce the schema" step in `ci.yml` was **inert**: `check-migration-schema-drift.ts` WARN-skips (exit 0) when `MIGRATE_SHADOW_DATABASE_URL` is unset, and CI never set it, so the gate passed trivially and emitted no diff. Added a `postgres:17` `migrate-shadow` service container to the `ci` job and set `MIGRATE_SHADOW_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/migrate_shadow` on the step, so `prisma migrate diff --from-migrations` now RUNS TO COMPLETION and prints the precise drift diff. Kept **`continue-on-error: true` (report-only)**: the replay applies cleanly but the diff still reports the large PRE-EXISTING accumulated db-push drift tail (generated searchVector columns, PK drops, dropped uniques, additive enum variants/columns) that is unsafe to reconstruct blind, so the script exits 1 and a hard gate would brick every unrelated PR. Documented the flip condition inline (drop `continue-on-error` once the tail is reconciled in a dedicated migration change set). No script change — the script already hard-exits 1 on `migrate diff` exit-2. YAML validated (all 4 jobs intact).

## 2026-07-06 — FX settlement provenance: winner-only persist + ECB observation date (FX-low)

- [[domains/payments-and-bank-files]] — two FX provenance fixes on the payment-export path. **(1) Race loser no longer persists.** `_buildExportItems` (`payment-shared.ts`) settled each cross-currency item and wrote `PaymentRunItem.settlementRate/settlementRateDate` inline — but it runs *before* the DRAFT/LOCKED → EXPORTED transition, so both racers wrote it and the loser (returns `fileBase64:null`) wasted an idempotent out-of-tx write. It now *returns* `ExportSettlementProvenance[]` and the router persists via the new `persistExportSettlements(ctx.db, settlements)` **only after** `exportResult.exported` (winner-only). The programmatic payout loop still persists inline (`persistSettlementProvenance`) — not a race. **(2) `settlementRateDate` = ECB observation date, not the pay date.** `convertAmount` (`exchange-rate.ts`) returned `rateDate = date ?? new Date()` (the requested/pay date); it now returns the **oldest leg's `observationDate`** (the ECB rate row's real date, which recovers the embedded original for carried-forward rows), since a cross-rate is only as current as its stalest leg — so a payout on a weekend/holiday/gap reconstructs the rate actually used. Only the settlement path consumed `rateDate` (1099 box-1 + report-export use `amountMinor`/`rate` only), so the change is contained. Tests: settlement wiring proves same-currency → no provenance, and that a pay date *after* the observation stamps the observation date; the race security suite gains a loser-no-persist case (`itemUpdate` called once, not twice); `_buildExportItems` mocks in `audit-mutation-coverage` + race suite updated to the `{ items, settlements }` shape. `pnpm typecheck --filter=@contractor-ops/api` GREEN; payment-export-settlement / payment-export-race / payment-us-export.e2e / exchange-rate / audit-mutation-coverage / payment-settlement 60/60 GREEN.

## 2026-07-06 — atomic e-sign completion + crash-window CONFLICT on claimed-but-unstamped intent (M2/M3)

- [[integrations/docusign-esign]] — hardened two e-sign concurrency seams in `esign-orchestrator.ts`. **M3 (completion TOCTOU):** `handleSigningCompletion`'s signed-Document write is now atomic via the new `SIGNED_PDF_SAVED` partial unique `signing_event_signed_pdf_saved_key`. The prior read-then-write guard (check for an existing `SIGNED_PDF_SAVED` event, then write) let two concurrent "completed" deliveries both pass and create duplicate signed `Document`s. The `Document` + `SIGNED_COPY` `DocumentLink` + terminal event now commit in one `$transaction`; the loser's event insert raises **P2002** (rolling back its whole tx), which is caught as an idempotent no-op returning the winner's persisted `Document` (via the `SIGNED_COPY` link; `null` for envelopes with no contract). Fast-path event-exists check kept as an optimization only. **M2 (Autenti claimed-but-unstamped crash window):** the `EsignEnvelopeIntent` idempotency claimed a row, called the provider, then stamped `externalEnvelopeId`; a crash between provider-create and write-back left the retry finding its own unstamped row and blindly re-creating the provider process (duplicate). `sendForSignature` now distinguishes a **pre-existing** unstamped row (a prior crash that may already hold a provider process → throw `CONFLICT`/`esignNoExternalId` for manual reconcile) from a claim made in **this** call (no provider call yet → proceed). Reused the existing `ESIGN_NO_EXTERNAL_ID` constant — no new i18n key. Tests: added a claimed-but-unstamped→CONFLICT case + a `handleSigningCompletion` describe (winner persists; concurrent loser catches P2002 → winner's Document; redelivery fast-path dedup; non-P2002 rethrow). `pnpm --filter @contractor-ops/api test esign-orchestrator` 21/21 GREEN; `pnpm typecheck --filter=@contractor-ops/api` GREEN.

## 2026-07-06 — Stripe ordering guard + watermark applied to ALL subscription state changes (M1)

- [[integrations/stripe-billing]] — closed a watermark asymmetry in `billing-webhook.ts`. Only `handleSubscriptionUpdated` honoured the `Subscription.lastEventCreated` out-of-order guard; `handlePaymentFailed` (→ PAST_DUE) and `handleSubscriptionPaused` (→ PAUSED) mutated status WITHOUT checking or advancing the watermark, and `handleSubscriptionDeleted` advanced it unconditionally (no guard). Result: a stale-but-newer-`created` `subscription.updated` redelivered after a payment failure/pause slipped past the updated-handler's guard (watermark still at the old create-time value) and resurrected a delinquent org back to ACTIVE. Fix: extracted one shared `isStaleSubscriptionEvent(stored, incoming)` helper; every state-changing writer now (a) skips when the incoming event's `created` predates the stored watermark and (b) advances `lastEventCreated` to the incoming `created` on write. `eventCreated` is threaded from `routeStripeEvent` into `handlePaymentFailed`/`handleSubscriptionPaused` the same way `handleSubscriptionUpdated` already received it; `handleSubscriptionDeleted` gained a pre-fetch guard before `markSubscriptionDeleted`. The verified-good StripeEvent id-dedup + Serializable tx are untouched. Tests: +6 out-of-order cases (payment-failed/paused advance + skip-stale, stale-delete no-op, and the headline "stale `subscription.updated` cannot resurrect ACTIVE once a newer state advanced the watermark"); relaxed 3 exact-`data` assertions to `objectContaining` now that writers also stamp `lastEventCreated`. `pnpm typecheck --filter=@contractor-ops/api` GREEN; `billing-webhook` 70/70 GREEN.

## 2026-07-05 — economic-dependency alert routed through the outbox in-tx (INT-1-1)

- [[patterns/transactional-outbox]] [[domains/classification-ir35]] [[domains/notifications-and-reminders]] — converted the economic-dependency scan (the structural twin flagged in the prior INT-1-1 entry) to the same pattern as `form-1099k-tracker`. `updateBandState` gained an optional last param `client` (defaults to `prismaRaw`) used for its `EconomicDependencyAlertState` findUnique + upsert; `runEconomicDependencyScan` now wraps `updateBandState(assignment, share, now, tx)` + the `classification.economic_dependency_*` enqueue in one `prismaRaw.$transaction`, so the §2 SGB VI heads-up commits atomically with the band upsert (exactly-once via the drain; no dedupKey — the `lastReminderAt` cadence gates emission). `dispatch` → `enqueueNotificationDispatch({ tx })`; dropped from `__deps`. Closes the same `lastReminderAt`-set-but-notice-dropped silent-30d window the tracker's conversion did — economic-dependency moves from the "when NOT to convert" list to the wired-sites table. Tests: the 4 orchestrator cases re-pointed from `mockDispatch` to `mockEnqueue` (asserting `event` + `tx` is the same client the upsert ran on); the 7 `updateBandState` unit tests are unaffected (default client). `pnpm typecheck --filter=@contractor-ops/api` GREEN; `economic-dependency-scan.test.ts` 20/20 GREEN.

## 2026-07-05 — transactional-outbox tail: 4 clean-tx producers converted (INT-1-1)

- [[patterns/transactional-outbox]] [[domains/notifications-and-reminders]] [[domains/workflows-and-roles]] [[domains/compliance-dashboard]] [[domains/us-tax-forms]] — finished the INT-1-1 outbox wiring for the deferred sites that have a single committed state to bind to. **Converted (enqueue now inside the announced write's `$transaction`):** `workflow-execution-tasks.reassignTask` (`TASK_ASSIGNED`, wraps the bare assignee `update` in a new tx; no dedupKey — each reassignment is distinct); `credit-service.checkAndDeductCredit` (`CREDIT_EXHAUSTED` enqueued inside the Serializable deduction tx when the deduction hits 0; dedupKey `CREDIT_EXHAUSTED:{org}:{periodStart}`; `notifyCreditExhausted` → `enqueueCreditExhaustedNotification(tx)`, metric stays post-tx); `compliance-admin.approve`/`rejectUploadReplacement` (`dispatchComplianceUploadOutcome` → `enqueueComplianceUploadOutcome(tx)`, threaded into the existing approve/reject tx, dedupKey = reviewed documentId — a provider outage can no longer roll back the approval since the send is deferred to the drain); `form-1099k-tracker.processContractor` (heads-up enqueued inside the `Form1099KTrackerState` upsert tx, closing the `lastReminderAt`-set-but-notice-dropped silent-30d-gap; no dedupKey). **Left as direct at-most-once dispatch (why-comment added at each):** `ksef-sync-orchestrator` (aggregate KSeF run result), `compliance-reminder-scan` (per-recipient expiry digest), `google-workspace-sync-orchestrator` ×2 (directory-diff notices, snapshot persisted separately), `economic-dependency-scan` (advisory cron heads-up — **structural twin of the converted 1099-K tracker**; left per scope, flagged as a parity-conversion candidate). Tests: enqueue asserted via the `OutboxEvent` INSERT on the tx client (`workflow-execution`, `credit-service`, `compliance-upload-review`) and via a mocked `enqueueNotificationDispatch({ tx })` scan test (`form-1099k-tracker.service`); the compliance D-14 "notification-failure isolation" case reframed to the deferred-delivery semantics. `pnpm typecheck --filter=@contractor-ops/api` GREEN; all touched suites GREEN.

## 2026-07-05 — org-creation hook now fires KT seed templates + backfill (T0-4)

- [[domains/workflows-and-roles]] — closes T0-4. `runPostOrganizationCreateHooks` had ZERO callers and the Better Auth organization plugin defined only `beforeCreateOrganization`, so no runtime-created org ever got its 4 offboarding KT `WorkflowRoleTemplate` seed rows — every one silently ran the degraded NULL-`workflowRoleId` fallback in `selectForContractor` (only dev orgs were covered, via `seed-dev.ts`'s own inline `seedWorkflowTemplates`). Root cause of it never being wired: the seed hook lives in `packages/api` and `api` depends on `@contractor-ops/auth`, so importing `runPostOrganizationCreateHooks` back into the auth config would be a **circular package dependency**. Fix (a): `packages/auth/src/config.ts` gains an `afterCreateOrganization` hook → new exported `seedOrganizationDefaults(org.id)` → `upsertSeedTemplates` imported directly from `@contractor-ops/offboarding-templates` (a leaf dep — no cycle; `auth` package.json gains the workspace dep). Non-fatal (Better Auth does not roll the org back on an `afterCreate` throw — a failed seed is logged, never silently swallowed, org still created) and idempotent (upserts keyed on the canonical `@@unique` constraints). Uses the un-scoped base `prisma` (the `@contractor-ops/db` barrel is NOT tenant-wrapped — tenant scope is applied per-request via `createTenantClient` in the API layer), so the cross-org bootstrap write for the just-created org is not rejected by the `withTenantScope` frame guard; `prismaRaw` would violate its own "never in request handlers" contract. Fix (b): existing orgs backfilled by a one-shot idempotent script `packages/api/scripts/backfill-workflow-role-templates.ts` that enumerates every org via `prismaRaw` and calls `runPostOrganizationCreateHooks` per org (giving that service its first real caller) — run once per regional DB URL (`DATABASE_URL=$DATABASE_URL_EU tsx …`, `--dry-run` to enumerate). Also fixed pre-existing extensionless relative imports in `packages/offboarding-templates/src/*` (`./types` → `./types.js` etc.) that only surfaced once `auth`'s stricter `node16` moduleResolution began type-checking that package's source. Tests: new `org-creation-seed-templates.test.ts` (seed fires for the new org id; non-fatal on upsert failure); `pnpm --filter @contractor-ops/auth test` GREEN (280), `@contractor-ops/offboarding-templates` GREEN (12); `pnpm typecheck --filter=@contractor-ops/auth --filter=@contractor-ops/api --filter=@contractor-ops/offboarding-templates` GREEN.

## 2026-07-05 — idempotent e-sign envelope creation via intent row (esign-idempotency)

- [[integrations/docusign-esign]] — closes the INT-1-4 Autenti follow-up. `sendForSignature` created the provider envelope BEFORE the local `$transaction`, so a rolled-back tx orphaned the Autenti `document-process` and a retry duplicated it (DocuSign was already safe via its server-side key). Now every send claims an `EsignEnvelopeIntent` row (unique `(organizationId, documentId, signerSetHash)`) **before** the provider call, where `signerSetHash = sha256(documentId | sorted(email:role:routingOrder))` mirrors the DocuSign businessKey. Branches: (a) intent already has `externalEnvelopeId` → short-circuit; return the persisted `SigningEnvelope` (via the `(provider, externalEnvelopeId)` unique) or, if the prior tx rolled back, re-drive **only** persistence against the existing process (`reuseProviderEnvelope`) — never a second provider create; (b) fresh/unclaimed → create the intent, call the provider, stamp `externalEnvelopeId` back onto the intent **before** the tx (`persistEnvelopeRecords`); (c) concurrent claim → **P2002** caught → resolve/reuse the winner's process, or (winner mid-flight, no id yet) fail closed `CONFLICT`. Applies uniformly; DocuSign keeps its own key on top. New helpers in `esign-orchestrator.ts`: `computeSignerSetHash`, `isUniqueViolation`, `persistEnvelopeRecords`, `reuseProviderEnvelope`. Tests: duplicate-send reuse (one provider process), rollback-then-retry reuse, P2002-resolve, P2002-mid-flight-CONFLICT (`esign-orchestrator.test.ts`). `pnpm --filter @contractor-ops/api test esign` GREEN (54); e-sign files typecheck clean (sole `tsc` error is another session's in-flight `packages/auth` → `@contractor-ops/offboarding-templates`, unrelated).

## 2026-07-05 — 1099-NEC batch generation made transactional + P2002-as-skip (1099-NEC-tx)

- [[domains/us-tax-forms]] — follow-up to the T0-5 1042-S fix, applied verbatim to `form-1099-nec.service.ts` now that `Form1099Nec_active_key` exists. `generateBatch` no longer persists per-recipient with no enclosing transaction (a mid-batch throw left a partial year-end filing, and a re-run after a partial success had no P2002 handling). The batch loop now accumulates `rowsToPersist` and inserts the whole batch inside ONE interactive `persist.$transaction`, so a mid-batch throw rolls back **every** row. The persistence sink changed from a bare `Form1099NecCreateClient` (`form1099Nec.create`) to a `$transaction`-capable `Form1099NecPersistClient` (mirroring `Form1042SPersistClient`); the inner tx client keeps the `form1099Nec.create` shape. A re-run that collides with an already-filed batch surfaces P2002 on the `Form1099Nec_active_key` partial index — caught by the new `isActive1099NecKeyViolation` structural helper (mirror of `isActive1042SKeyViolation`) and treated as an idempotent skip (`idempotent: true`, `complete()` caches it, no duplicate rows, no error) rather than propagating. Redis reserve/complete/clear idempotency preserved (the P2002-skip path completes the reservation so later retries short-circuit; the outer catch still clears on a non-P2002 failure). No production caller yet (the 1099-NEC batch is a deferred seam — only the 1042-S router wires its sibling), so the persist-interface change breaks nothing downstream. Tests: the two existing batch tests rewired onto a rollback-simulating `$transaction` double; +mid-batch-throw → zero rows committed (full rollback), +`Form1099Nec_active_key` P2002 → idempotent skip / zero new rows. `pnpm --filter @contractor-ops/api test form-1099-nec` GREEN (16/16 service); `pnpm typecheck --filter=@contractor-ops/api` GREEN.

## 2026-07-05 — migration replay repair (NitaqatBand) + Form1099Nec active-key + EsignEnvelopeIntent (F1/F2a/F3a)

- [[structure/prisma-schema-areas]] / [[domains/employee-registry]] / [[domains/us-tax-forms]] / [[integrations/docusign-esign]] — three additive DB fixes. **F1:** `__employee_profile_additive/migration.sql` used `NitaqatBand` as the `saudizationCategory` column type but no migration `CREATE TYPE`d it (the enum's other consumer, `SaudizationConfig.band` in `gulf.prisma`, is db-push-only), so a fresh `prisma migrate diff --from-migrations` replay aborted `type "NitaqatBand" does not exist` (verified live against an ephemeral PG-17 shadow). The migration now creates the enum (`PLATINUM/HIGH_GREEN/MID_GREEN/LOW_GREEN/YELLOW/RED`, matching the PSL) before the `EmployeeProfile` table; `down.sql` drops it. Replay now clears that error (it then hits a separate, **pre-existing** history-health issue — the `__`-prefixed manual-gate migrations sort ahead of `20260512000000_baseline` in a lexicographic `--from-migrations` replay, so `EmployeeProfile`'s FK fails `relation "Organization" does not exist`; that + the gulf domain having no migration at all are why the drift check is WARN-only by design, and are out of F1's scope). **F2a:** `Form1099Nec` gains partial UNIQUE `Form1099Nec_active_key` on `(organizationId, payerOrgId, recipientId, taxYear) WHERE status='ACTIVE'::"Form1099Status"` (PSL `@@unique(where: raw(...))` + migration `20260705130000_form1099nec_active_key`), mirroring `Form1042S_active_key` — the DB backstop for the 1099-NEC batch-generation idempotency guard (P2002-as-skip; DRAFT/SUPERSEDED unconstrained). Verified live: 2nd ACTIVE rejected 23505, duplicate DRAFT/SUPERSEDED allowed, `down.sql` reverses clean. **F3a:** authored `EsignEnvelopeIntent` (migration `20260705140000_esign_envelope_intent`) — the pre-provider idempotency ledger flagged by INT-1-4. Decision basis: the Autenti v2 public API's `POST /document-processes` accepts **no** idempotency header and its `DocumentProcessInput` (title/description/processLanguage/parties/tags/constraints) has no client dedup/externalReference field (verified against the published spec), unlike DocuSign's `X-DocuSign-Idempotency-Key` — so dedup must live on our side. `@@unique([organizationId, documentId, signerSetHash])` (`esign_envelope_intent_dedup_key`) + `provider`/`integrationConnectionId`/`externalEnvelopeId?` + FK to Organization; the FW-2 e-sign service writes an intent row on the business key BEFORE the provider call and short-circuits duplicates. Verified live: dedup + Organization FK enforced, `down.sql` reverses clean. Committed Prisma client regenerated (`db:check-drift` in sync); `pnpm typecheck --filter=@contractor-ops/db --filter=@contractor-ops/api` GREEN.

## 2026-07-05 — FX max-age floor + carry-forward provenance + persisted settlement rate + BoE TTL (INT-0-8)

- [[domains/us-payment-rail]] / [[patterns/money-rounding]] / [[domains/payments-and-bank-files]] / [[domains/us-tax-forms]] / [[structure/key-services]] — **INT-0-8** (FX correctness/staleness, one change set). Five seams that silently trusted stale or absent FX/rate data now fail loudly or carry provenance: **(a)** `getRate(db, base, target, date, maxAgeDays?)` (`services/exchange-rate.ts`) throws a new `StaleExchangeRateError` when the resolved observation is older than the floor; `convertAmount` threads `maxAgeDays` into both EUR legs. Settlement (`convertForSettlement`, default `FX_CONVERSION_MAX_AGE_DAYS = 7`) and 1099 box-1 conversion (`aggregateBox1Async`) pass the floor; display-only `report-export.convertToHomeCurrency` passes none (unchanged). **(b)** The ECB-outage carry-forward fallback in `fetchAndStoreRates` now stamps copied rows `CARRIED_FORWARD:<original-date>` (was preserving `source:'ECB'`), and `getRate` measures a carried-forward row's age from that embedded original date, not the daily re-stamped row date — so a multi-day outage is actually caught by the floor. **(c)** `_buildExportItems` / `_initiatePayoutForRun` (`routers/finance/payment-shared.ts`) now settle through one `settleItemAmount` helper (missing rate **and** stale rate → `UNPROCESSABLE_CONTENT` `E.PAYMENT_SETTLEMENT_RATE_UNAVAILABLE`) and persist `settled.rate`/`rateDate` onto `PaymentRunItem.settlementRate`/`settlementRateDate` via `persistSettlementProvenance` (gated to a real cross-currency conversion) — a settled payout's row reconstructs its amount as `round(amountMinor × settlementRate)`. **(d)** `boe-rate-cache.ts` module cache gained a real 5-minute TTL (`CACHE_TTL_MS`) + load timestamp, so the API process stops serving a stale BoE rate after the poller writes a new row without calling `invalidateBoeRateCache`. **(e)** `resolveStatutoryRate` (`services/late-payment-interest.ts`) returns `null` (was 0) when no BoE rate is in effect on the LPCDA §4(1) reference date, and `calculateLateInterest` returns `applicable:false` (`RATE_HISTORY_UNAVAILABLE`) rather than accruing at the bare 8% margin. No new error key / no locale change (stale reuses the existing unavailable message; the distinct cause stays in the thrown `StaleExchangeRateError`). No schema change — the `settlementRate`/`settlementRateDate` columns landed earlier (INT-0-8c). Scoped tests GREEN (`exchange-rate`, `payment-settlement`, `boe-rate-cache`, `late-payment-interest`, `payment-export-settlement`, `payment-payout-init`, `form-1099-nec`, `report-export`); `pnpm typecheck --filter=@contractor-ops/api` GREEN.

## 2026-07-05 — ZATCA transient failures stay PENDING + idempotent retry + reconcile cron (INT-0-3)

- [[integrations/zatca]] / [[structure/cron-jobs]] / [[structure/key-services]] / [[integrations/qstash-cron]] — **INT-0-3.** `submitToZatca` (`packages/api/src/services/zatca-submission.ts`) marked **any** submission error `REJECTED` — including a network timeout where ZATCA may have actually cleared the invoice — and always recreated the chain row, so a QStash retry hit `ZatcaInvoiceChain.invoiceId @unique` P2002 in `recordChainEntry` before ever reaching ZATCA (gov-api gives POST `effectiveMaxRetries=0`), and no job requeried stranded PENDING chains. Fixed three ways: (1) **error classification** — only a validation/4xx `ZatcaApiError` (`non-retryable`) writes REJECTED; a network error, timeout, 5xx/429 (`retryable`), or auth failure leaves the row PENDING with `submittedAt` unset so a retry/reconcile can resettle it; (2) **idempotent retry** — an existing chain row is reused, not recreated: a PENDING row is resubmitted with its original `zatcaUuid` (ZATCA dedups on the uuid; signed XML regenerated from the persisted icv/pih/uuid), an already-settled row is a no-op — no P2002; (3) **reconcile cron** — new `zatca-reconcile` handler (`apps/cron-worker`, registered in `jobs/registry.ts`, `*/15 * * * *`) calls the new `reconcilePendingZatcaChains` service, which resubmits every chain PENDING past `CRON_ZATCA_RECONCILE_STALE_MINUTES` (default 15). New env `CRON_ZATCA_RECONCILE_SCHEDULE` + `CRON_ZATCA_RECONCILE_STALE_MINUTES` (`apps/cron-worker/src/env.ts` + `.env.example`). Submit/settle extracted into `buildSubmissionArtifacts` + `submitAndSettle` shared by first-submit and retry. The `apps/api/src/routes/zatca.ts` `submittedAt` fast-path comment updated (P2002 no longer the reason to skip). Tests: `zatca-submission.test.ts` +transient-503-stays-PENDING, +idempotent-reuse-no-`$transaction`, +already-settled-noop, +reconcile settle/failed-count (60/60 GREEN); new `zatca-reconcile.test.ts` cron handler (3/3 GREEN). `pnpm typecheck --filter=@contractor-ops/api --filter=@contractor-ops/cron-worker` GREEN.

## 2026-07-05 — annotate deferred US-tax dark seams + drop unregistered compliance-reminder handler (T2-2)

- [[structure/cron-jobs]] / [[domains/us-tax-forms]] — **T2-2.** Dropped the dead `complianceReminderHandler` `JobHandler` export from `apps/cron-worker/src/jobs/handlers/compliance-reminder.ts` — an unregistered duplicate (0 registry entries, 0 importers) of the scan already folded into the `reminders` fan-out (`reminders/index.ts` calls `executeComplianceReminderScan` at the cross-org tick). The file now exposes only the shared `executeComplianceReminderScan` entry + its result type; the newly-unused `metrics`/`Sentry`/`JobHandler` imports went with it. `cron-jobs` entry-points table now marks compliance-reminder as a scan entry run via the reminders fan-out, not a standalone registered job. Separately, added why-focused deferred-seam header comments (no phase IDs) to the already-dark US-tax services so they stop reading as dead code — mirroring what [[domains/us-tax-forms]] already documents: `form-1099-nec.service.ts` (0 non-test callers; the sync `isAboveThreshold` gate must resolve from `Tax1099Threshold` config via `getBox1ThresholdMinor`, never the `SEEDED_THRESHOLDS_MINOR` constant, once wired), `tin-match.service.ts` (`matchRecipientTin` / `createBackupWithholdingFlagWriter`, 0 prod callers, lands with the year-end batch), `packages/iris/src/index.ts` (whole package runtime-unwired pending transmit; validators return `XSD-BUNDLE-MISSING` INVALID until the human XSD bundle lands). `elstam-stub.ts` confirmed a future-payroll placeholder (0 callers) and kept — it already carries a deliberate local-only stub-seam header. Comment/removal only, no behavior change; typecheck GREEN (api/cron-worker/iris), scoped tests GREEN.

## 2026-07-05 — one shared PII keyword list for the 4 Sentry sentry-scrub copies (GL-1-2)

- [[integrations/sentry]] / [[patterns/logging-and-errors]] / [[structure/packages]] — **GL-1-2.** The four hand-copied `sentry-scrub.ts` `beforeSend` scrubbers (`apps/api`, `apps/public-api`, `apps/cron-worker`, `apps/web-vite`) had drifted from the logger's pino mask despite "keep in sync" headers — all four were missing `ssn, ein, pesel, iqama, emiratesid, nationalid` (present in `pii-mask.ts`) plus bank/DOB tokens `routingnumber, accountnumber, sortcode, dateofbirth`, so those identifiers shipped to Sentry unmasked on any uncaught exception. Fixed: `packages/logger/src/pii-mask.ts` now exports a single canonical `PII_SCRUB_KEYWORDS` + `isPiiScrubKey` predicate (case-insensitive substring), and all four copies import it from the new dependency-free `@contractor-ops/logger/pii-mask` subpath (→ `./dist/pii-mask.js`, browser-safe — no pino/Node internals reach the web-vite bundle) instead of hand-lists. web-vite gains a `@contractor-ops/logger` workspace dep. New `packages/logger/src/__tests__/pii-scrub.test.ts` asserts full keyword coverage AND reads all four scrub files to prove each imports the shared predicate and defines no local `PII_KEYWORDS` (structural no-drift guard) — 4/4 GREEN. Matching stays substring, so short tokens are broad by design (e.g. `ein` also redacts `eInvoiceId` — over-redacting a crash report is the safe side). `pnpm typecheck` GREEN for logger + api-server + public-api + cron-worker (web-vite has one pre-existing unrelated leave/team-calendar RED-test error).

## 2026-07-05 — audit-writer region-pins its no-tx fallback client, never the global DB (GL-0-5)

- [[patterns/audit-log]] / [[patterns/tenant-and-audit]] — **GL-0-5.** `writeAuditLog` / `writeAuditLogMany` fell back to the global `prisma` (`DATABASE_URL`) whenever no `tx` was passed — 97 no-tx call sites (SSN/FTIN reveals, GDPR-erasure audits, OAuth-connect, async determination-letter render) wrote ME/US audit rows into the wrong region's DB, so regional erasure (`gdpr.ts` deletes `auditLog` on the regional client) could never reach them (residency crossing of actorName/IP/userAgent + un-erasable rows). Fixed: a new `resolveAuditWriterClient` resolves the org region in order **explicit `region` arg → `tenantStore` (AsyncLocalStorage, set by `runWithTenantContext`/`tenantMiddleware`) → global `Organization.dataRegion` directory** and writes through `getRegionalClient(region)`; if none resolves it **throws** rather than silently use the global client (fail-closed). In-tx callers keep their already-regional `tx` unchanged. New optional `region?` on `WriteAuditLogInput` / `WriteAuditLogManyInput` for context-free callers. `audit-writer.test.ts` + `audit-writer-fields.test.ts` rewired to mock `getRegionalClient`/`tenantStore`, +ME-org routing / directory-fallback / fail-closed tests; `compliance-payment-gate.test.ts` db-mock extended. Full `@contractor-ops/api` suite GREEN (3 pre-existing INT-1-1 outbox-mock failures unrelated); `pnpm typecheck --filter=@contractor-ops/api` GREEN.

## 2026-07-05 — data-purge cron regionalized across SUPPORTED_REGIONS + regional R2 delete (GL-0-4b)

- [[structure/cron-jobs]] — **GL-0-4b.** `data-purge.ts` used the global `prisma` (bound to `DATABASE_URL`) and never iterated `SUPPORTED_REGIONS`, so the single frankfurt cron-worker never finalised ME (or future US) soft-deletes / GDPR erasures — `gdpr.ts`'s "permanent deletion after 90 days" was false outside the `DATABASE_URL` DB. The R2 cleanup also used the legacy single-bucket `deleteObject` (wrong-bucket risk). Fixed: extracted `purgeRegion(client, region, ...)` and the handler now loops `SUPPORTED_REGIONS`, resolving each region's base writer via `getRegionalClient` (a region with an unset `DATABASE_URL_<region>` throws → skipped, surfaced in `details.regionsSkipped`), aggregating counts, and R2 cleanup switched to `deleteRegionalObject(key, region)`. A per-region failure is Sentry-captured (`purge.region` tag) without aborting the others. New `./services/regional-storage` subpath export on `@contractor-ops/api`. `data-purge.test.ts` rewritten to mock `getRegionalClient`+`SUPPORTED_REGIONS` and `deleteRegionalObject`; +2 tests (multi-region loop + skip, per-region failure isolation) — 7/7 GREEN; `pnpm typecheck --filter=@contractor-ops/cron-worker --filter=@contractor-ops/api` GREEN.

## 2026-07-05 — GDPR org erasure reaches the employee subtree + nulls national IDs (GL-0-4a)

- [[domains/consent-gdpr-pdpl]] — **GL-0-4a.** Employee national IDs (PESEL/SSN/iqama/Emirates ID) in `EmployeeProfile` encrypted columns previously survived an org-wide "DELETE ALL DATA" indefinitely — `gdpr.ts requestErasure` never referenced Worker/EmployeeProfile/PersonnelFile/leave/tax models. Fixed: the erasure `$transaction` now loads every `workerType=EMPLOYEE` Worker, resolves each personnel file's file-level statutory window (`getPersonnelSections` union, DOCUMENT_DATE rules excluded, `getPersonnelRetentionCutoff` — mirrors the data-purge cron), and for erasable workers nulls all `*Encrypted`/`*Last4` columns, soft-deletes `PersonnelFile`+`PersonnelFileDocument`, hard-deletes `LeaveRequest`/`LeaveLedgerEntry`/`LeaveBalance`/`EmployeeTimeRecord`, soft-deletes the Worker + drops its email. Held workers (active window / unresolved jurisdiction) are preserved fail-closed and surfaced under `retainedUnderStatute.PersonnelFile` + an `organization.erasure_retained_under_statute` audit row. `EwidencjaSnapshot` (DB-trigger immutable, KP §149) untouched. Contractor tax records (`Form1042S` soft-delete, `TaxFormSubmission`/`WhtCertificate`/`TaxIdValidation`/`Form1099KTrackerState`/`Iris*`) follow `retainFinancialRecords`; `Form1099Nec` always retained-with-exemption (IRS 4-yr). `gdpr.test.ts` +5 tests (erasable-null, past-window, held-preserve, tax-retain, tax-purge) — 13/13 GREEN; `pnpm typecheck --filter=@contractor-ops/api` GREEN.

## 2026-07-05 — go-live deploy config: previews-off + preDeploy migrate + /ready health + landing env

- [[patterns/multi-region-db]] — **GL-0-1/2/3/7c** (go-live blockers, config-only). (1) `render.yaml` backend services that carry production secrets (`api-server`, `public-api`, `cron-worker`, `cms`) now set `previews: generation: off` — a preview `cron-worker` would otherwise run the daily data-purge hard-delete against the production DBs; only the `web-vite` static SPA keeps PR previews. (2) App migrations now run on deploy: `api-server` gains `preDeployCommand: pnpm --filter @contractor-ops/db run db:migrate:all` (previously only `cms` ran Payload migrations; the runbook falsely claimed a nonexistent `web` service did it). (3) `migrate-all-regions.ts` iterates region names and prefers each region's `DIRECT_URL_<region>` (unpooled Neon) endpoint, falling back to `DATABASE_URL_<region>` — Prisma 7 removed the schema `directUrl` field (P1012), so the direct endpoint is injected via `DATABASE_URL` in the CLI child; runtime is unaffected (it connects via `@prisma/adapter-pg`). New `DIRECT_URL_EU/ME/US` in `.env.example`. (4) `api-server` `healthCheckPath` moved `/health` → shallow `/ready` so a Redis/QStash/R2/backpressure 503 on the deep probe no longer makes Render cycle the fleet mid-incident. (5) `landing` service gained its missing `envVars` (`NEXT_PUBLIC_POSTHOG_KEY/HOST`, `NEXT_PUBLIC_CMS_URL`, `NEXT_PUBLIC_LANDING_URL`, all `sync: false`) — inlined at static-export build time. `docs/DEPLOYMENT-RENDER.md` migration + preview sections corrected. YAML valid; `prisma validate` + `pnpm typecheck --filter=@contractor-ops/db` GREEN.

## 2026-07-05 — outbox mechanical conversions: workflow start + equipment returns (INT-1-1)

- [[domains/workflows-and-roles]] / [[domains/equipment-logistics]] / [[domains/portal-external]] / [[patterns/transactional-outbox]] — **INT-1-1 mechanical.** Converted the notification dispatches that had a **clean enclosing `$transaction`** to `enqueueNotificationDispatch({ tx })` (exactly-once via drain): (1) `startWorkflowRun` (`routers/workflow/workflow-execution-runs.ts`) — the per-active-assignee `TASK_ASSIGNED` loop moved INSIDE the run-creation tx (dedupKey `TASK_ASSIGNED:${taskRunId}`); (2)+(3) `approveReturnRequest` / `rejectReturnRequest` (`routers/equipment/equipment-returns.ts`) — enqueued inside the `auditedMutation` tx callback (dedupKey `EQUIPMENT_RETURN_APPROVED|_REJECTED:${returnRequestId}`); (4) portal `requestReturn` (`routers/portal/portal-equipment-router.ts`) — enqueued inside the create tx (dedupKey `EQUIPMENT_RETURN_REQUESTED:${returnRequestId}`).
- **Deferred (no clean enclosing `$transaction` — converting would force a tx refactor, out of scope):** `workflow-execution-tasks.ts` reassignTask (dispatch follows a single non-transactional `workflowTaskRun.update`); `credit-service.ts` notifyCreditExhausted (pure credit-state notification, no business write to bind to); `compliance-admin.ts` `dispatchComplianceUploadOutcome` (dedicated post-commit best-effort helper that resolves RBAC recipients); `ksef-sync-orchestrator.ts`, `economic-dependency-scan.ts`, `compliance-reminder-scan.ts`, `form-1099k-tracker.service.ts`, `google-workspace-sync-orchestrator.ts` (×2) — all cron/scan/orchestrator notifications about an already-completed sync/scan result, no enclosing tx. These stay direct `dispatch(...)`; see the "When NOT to convert" note in [[patterns/transactional-outbox]]. Tests: mock tx clients in `workflow-execution*`/`equipment-return(s)`/`portal-equipment` suites gained `$executeRawUnsafe`; `invoice.test.ts` finance-notification assertion already moved to the OutboxEvent INSERT. `pnpm typecheck` (api + api-server) + the touched suites GREEN.

## 2026-07-05 — outbox money-path: approvals + invoices + Stripe billing (INT-1-1)

- [[domains/approvals-engine]] / [[domains/invoice-to-payment]] / [[integrations/stripe-billing]] / [[patterns/transactional-outbox]] — **INT-1-1 money-path.** Converted the three money-path notification dispatches from post-commit fire-and-forget (at-most-once) to `enqueueNotificationDispatch({ tx })` inside the existing `$transaction` (exactly-once via the drain). (a) `submitForApproval` (`routers/core/approval-submit.ts`): moved the first-step + contractor lookup and the `APPROVAL_REQUEST` enqueue INSIDE the flow-creation tx (dedupKey `APPROVAL_REQUEST:${flowId}`); the tx now also returns `firstStep` for the post-commit calendar-SLA sync. (b) `invoice.create` (`routers/finance/invoice-crud.ts`): finance-team recipients resolved before the tx, `INVOICE_RECEIVED` enqueued inside it (dedupKey `INVOICE_RECEIVED:${invoiceId}`). (c) Stripe webhook (`apps/api/src/routes/webhooks/stripe.ts`): `routeStripeEvent` still collects the `NotificationEvent[]`, but the route now enqueues each into the outbox INSIDE the same Serializable tx (dedupKey `stripe:${event.id}:${i}`) and the post-commit `dispatchStripeWebhookNotifications` call is removed — so payment-failed/trial emails survive a crash between commit and send. `billing-webhook.ts` is unchanged (routeStripeEvent + the helper stay; the helper is now test-only). Tests: `invoice.test.ts` asserts the OutboxEvent INSERT + payload (was: `dispatch`); `stripe-webhook.test.ts` asserts enqueue-in-tx + no post-commit dispatch; mock tx clients gained `$executeRawUnsafe`. `billing-webhook.test.ts` (64) unchanged. `pnpm typecheck --filter=@contractor-ops/api --filter=@contractor-ops/api-server` + invoice/approval/billing/stripe suites GREEN.

## 2026-07-05 — transactional outbox WIRED: drain schedule + typed producer (INT-1-1 infra)

- [[patterns/transactional-outbox]] (new) / [[domains/notifications-and-reminders]] / [[integrations/qstash-cron]] / [[structure/apps]] / [[structure/key-services]] — **INT-1-1 infra (S1 root cause).** The transactional outbox (`packages/api/src/services/outbox/`) was correctly built but completely unwired: zero production producers, one event type, and the drain route (`apps/api/src/routes/outbox.ts`) had NO QStash schedule creating it (schedules existed only per-tenant for KSeF/Peppol/Google-Workspace). This lands the infra half. (a) New global schedule bootstrap `apps/api/src/lib/outbox-drain-schedule.ts` (`ensureOutboxDrainSchedule`): upserts one QStash schedule with a fixed `scheduleId: 'outbox-drain'` (idempotent across re-deploys) targeting `${API_URL}/outbox/_drain`, cron `* * * * *` (QStash's 1-minute cron floor — the "every 30s" docstrings were aspirational and are corrected), then asserts existence by read-back. Wired into `apps/api/src/index.ts` after `app.listen`, gated on `QSTASH_TOKEN`, fully non-fatal (QStash outage / local dev without a token logs + Sentry, never aborts boot). (b) Typed producer `enqueueNotificationDispatch({ tx, event, dedupKey? })` added to `outbox/index.ts` — hides the `NotificationEvent`→jsonb cast in one place so call sites don't spell out the payload contract; no new event type needed (all S1 sites are `notification.dispatch`). Exactly-once still rides on `OutboxEvent.id` threaded into `dispatch(payload, { outboxEventId })`. Tests: new `apps/api/.../outbox-drain-schedule.test.ts` (4: upsert+assert, skip-without-token, non-fatal-on-failure, assert-fails-when-missing); outbox suite extended with a kill-between-commit-and-dispatch case (commit tx → drain delivers exactly once → next tick no-op). `pnpm typecheck --filter=@contractor-ops/api --filter=@contractor-ops/api-server` GREEN. Producer call-site conversions (money-path + mechanical) land in follow-up commits.

## 2026-07-05 — approval-SLA overdue escalation sub-job in reminders

- [[domains/approvals-engine]] / [[structure/cron-jobs]] / [[domains/notifications-and-reminders]] — **INT-0-7 (b)** (the CAS part (a) shipped separately). Until now `computeSlaStatus` only rendered "OVERDUE" in the approval queue UI and no cron touched `ApprovalStep.slaDeadline` (reminders' `detectOverdueTasks` covers `workflowTaskRun` only) — a stalled approval silently blocked the invoice-to-payment flow. New `apps/cron-worker/src/jobs/handlers/reminders/approval-sla.ts` (`detectOverdueApprovals`) mirrors `detectOverdueTasks`: it finds PENDING `ApprovalStep` rows past `slaDeadline` (whose flow is still PENDING), nudges the assigned approver with an `APPROVAL_REQUEST` notification (entity `APPROVAL_FLOW`/step id, 24h dedup via the Notification table), and after 3 daily breaches escalates **once** — guarded by `claimCronNotificationDedup('approval_sla_escalation:<stepId>')` — to the next `NOT_STARTED` chain step's approver. It deliberately does NOT mutate flow state (step status / `currentStepOrder`); activating steps + advancing the flow stays owned by the engine so the cron never races the approve/reject CAS (INT-0-7 a). Wired into the reminders fan-out inside the per-sub-job `runIsolated` isolation (from INT-1-7), on the lock-holding `tx`. New i18n keys `Notifications.reminders.approvalOverdue.*` / `approvalEscalated.*` (en/de/pl/ar). No new notification type — reuses `APPROVAL_REQUEST`. Test: SLA-breach case asserts an `APPROVAL_REQUEST`/`APPROVAL_FLOW` notification for the overdue step. `pnpm typecheck --filter=@contractor-ops/cron-worker` + scoped `reminders.test.ts` (7 tests) GREEN.

## 2026-07-05 — reminders cron: re-dispatch stuck PENDING + per-rule/sub-job isolation + lock-connection fix

- [[structure/cron-jobs]] / [[domains/notifications-and-reminders]] — **INT-1-7** (three defects, one change set) in `apps/cron-worker/src/jobs/handlers/reminders/`. (a) `processRuleEntities` skipped any existing `ReminderInstance` (`if (existing) continue`) with no status filter — a row left `PENDING` because `dispatch` threw was skipped forever (the `(reminderRuleId, entityType, entityId, scheduledFor)` unique also blocks re-create), so the reminder was permanently lost. It now skips only `status='SENT'` and **re-dispatches** a `PENDING` row (create only when absent; mark `SENT` only after a successful dispatch). (b) No per-rule isolation — one org's throw aborted the whole cross-org run (remaining rules + `detectOverdueTasks` + DRV sweep). Each rule now runs in its own try/catch with error accumulation (`ruleErrors` surfaced in details + `cron.reminders.rule_errors` gauge), and each fan-out sub-job runs through a `runIsolated` wrapper so a throw can't reject the shared `Promise.all`. (c) The advisory lock was held on the `tx` connection while the sub-jobs queried the global `prisma`/`prismaRaw` pools — a >60s tx timeout released the lock mid-run while work continued on other connections. All sub-job reads/writes now run on the lock-holding `tx` (threaded into `evaluateReminderRules` / `detectOverdueTasks` / `detectDrvClearanceExpiries`; `dispatch`'s own writes stay off-tx by design to keep slow Resend calls out of the lock). `prisma`/`prismaRaw` in cron-worker are both plain (non-tenant) clients, so this is a pure connection change. Tests: dispatch-failure → next tick re-sends + marks SENT; poison-rule → sibling rule still dispatches. `pnpm typecheck --filter=@contractor-ops/cron-worker` + scoped `reminders.test.ts` GREEN.

## 2026-07-05 — approval decide is now compare-and-swap (TOCTOU guard)

- [[domains/approvals-engine]] — **INT-0-7 (a)**: `approve` / `reject` (and `bulkApprove` / `bulkReject`) in `packages/api/src/routers/core/approval-queue.ts` gated the state transition on the advisory `findFirst` + `validateStepForAction` read, then wrote the decision row and `approvalStep.update({ where: { id } })` unconditionally. Two racers (T1 approve + T2 reject) could both read `PENDING`, both create a decision row, and the flow would both advance AND be rejected. The transition is now a compare-and-swap: `updateMany({ where: { id, status: 'PENDING', approverUserId }, data })` — the decision row, `writeAuditLog`, flow advancement, and finalize only run when `count === 1`. The `count === 0` loser throws `CONFLICT` (`approvalStepAlreadyDecided`, new key added to `errors.ts` + all four locales). Single procedures re-read the winning row via `findUniqueOrThrow`; bulk variants surface a lost race as a failed step in the aggregate. New error key `approvalStepAlreadyDecided` (en/de/pl/ar). The SLA-escalation sub-job (INT-0-7 b) is a separate change set. Tests: new concurrent approve+reject case asserts exactly one decision row + one `CONFLICT`; existing approve/reject assertions retargeted from `update` to the guarded `updateMany`. `pnpm typecheck --filter=@contractor-ops/api` + `approval` / `errors-i18n-parity` suites GREEN.

## 2026-07-05 — Stripe entitlement drift fixed: late/out-of-order events apply + daily reconcile

- [[integrations/stripe-billing]] / [[structure/cron-jobs]] / [[structure/prisma-schema-areas]] — **INT-0-4** (three defects, one change set). (a) The 24 h late-delivery gate in `apps/api/src/routes/webhooks/stripe.ts` dropped subscription-lifecycle events older than 24 h as `skipped: 'late_delivery'` — so a genuinely late `customer.subscription.deleted` (Stripe retries for 3 days) was NEVER applied and entitlement stayed drifted. New `SUBSCRIPTION_LIFECYCLE_EVENT_TYPES` set + `isAgeGateExempt` exempt `created`/`updated`/`deleted`/`paused`/`resumed` from the gate (settlement events already were); cosmetic events like `trial_will_end` stay gated. (b) `handleSubscriptionUpdated` (`packages/api/src/services/billing-webhook.ts`) upserted unconditionally, so a retried STALE event clobbered a newer status (ACTIVE over PAST_DUE). New nullable additive column `Subscription.lastEventCreated DateTime?` (migration `20260705120000_subscription_last_event_created`, zero-backfill) stores the source event's `created`; the handler now skips any event whose `created` predates the stored value, and `handleSubscriptionDeleted` advances the watermark so a late cancellation stays sticky. (c) New daily cron `stripe-reconcile.ts` (cron-worker, `CRON_STRIPE_RECONCILE_SCHEDULE` default `0 1 * * *`) pages `stripe.subscriptions.list({ status: 'all' })` and repairs residual status/tier drift, deliberately not touching `lastEventCreated`.
- Verified-good parts kept: `StripeEvent` id dedup + Serializable tx + 500-on-error retry semantics untouched. Added `@contractor-ops/billing` (workspace) + exported `@contractor-ops/api/services/billing-constants` for the cron. Tests: subscription-event bypasses age gate (`stripe-webhook.test.ts`); out-of-order guard skip/apply/stamp + delete-watermark (`billing-webhook.test.ts`); reconcile repair/no-op/orphan/skip/error (`stripe-reconcile.test.ts`). `pnpm typecheck` (api/api-server/cron-worker) + `db:check-migration-drift` (WARN-degrade, no shadow) GREEN.

## 2026-07-05 — 1042-S batch generation is now transactional with P2002-as-skip

- [[domains/us-tax-forms]] — **T0-5** (service half): `generateBatch1042S` (`packages/api/src/services/form-1042s.service.ts`) previously persisted each recipient's ACTIVE row with a bare per-loop `persist.form1042S.create`, so a mid-batch throw left a partial year-end filing and the catch only cleared the 24h Redis idempotency key (rolled back nothing). It now collects the rows and inserts them inside ONE `persist.$transaction` (new `Form1042SPersistClient` sink type) — a mid-batch throw rolls back every row. A re-run that collides with the `Form1042S_active_key` partial UNIQUE surfaces P2002; the new `isActive1042SKeyViolation` helper detects it and the service returns `idempotent: true` (no duplicate rows, no error) instead of propagating. Mirrors the transactional `fileCorrection1042S` pattern; the DB index (T0-5 schema half) is the concurrency backstop. Tests: full-rollback-on-mid-batch-throw + P2002-idempotent-skip added to `form-1042s.service.test.ts` (green).

## 2026-07-05 — additive migration: 9 US tax-form tables + FX/ACH/peppol/claim/cron backstops + drift check

- [[structure/prisma-schema-areas]] / [[domains/us-tax-forms]] — **T0-6**: the nine US information-return tables (`TaxFormSubmission`, `Form1099Nec`, `IrisSubmission`, `IrisAck`, `Tax1099Threshold`, `StateFilingConfig`, `Form1042S`, `Form1099KTrackerState`, `Tax1099KThreshold`) lived in `tax.prisma` with NO CREATE TABLE migration — a fresh regional DB errored `relation does not exist`; local dev hid it via db-push drift. Authored one hand-written additive migration `20260705000000_us_tax_form_tables_plus_additive_integrity` (`migration.sql` + `down.sql`) creating all nine exactly per schema (columns, enums, FKs, indexes), generated from a schema-diff and verified end-to-end against a real Postgres 17 shadow (`No difference detected` both directions).
- Additive DB-integrity backstops in the same migration: **T0-5** `Form1042S` partial UNIQUE `Form1042S_active_key` on `(org, payerOrgId, recipientId, taxYear) WHERE status='ACTIVE'` (batch idempotency); **INT-0-5** [[integrations/peppol]] `PeppolTransmission_invoiceId_active_key` partial UNIQUE on `(invoiceId) WHERE status IN (PENDING, TRANSMITTED)` (one in-flight transmission per invoice); **INT-0-10** [[domains/payments-and-bank-files]] `InvoiceInterestClaim @@unique([invoiceId])` (one late-interest claim per invoice); **INT-0-8c** [[domains/us-payment-rail]] `PaymentRunItem.settlementRate`/`settlementRateDate` FX-provenance columns; **INT-0-9** new `AchReturnLedgerEntry` table (`@@unique([paymentRunId, traceNumber, returnCode])`) for entry-level ACH-return idempotency; **INT-1-2d** new [[structure/cron-jobs]] `CronJobRunState` table (global, `jobName @unique`) persisting per-job last-success across worker restarts. Partial uniques use Prisma 7's `previewFeatures = ["partialIndexes"]` + PSL `@@unique(..., where: raw("..."))` (regenerated + committed client). All service-side P2002 handling / column population / staleness alerts are later change sets — this migration is the schema half only.
- New drift guard: `packages/db/scripts/check-migration-schema-drift.ts` (+ `db:check-migration-drift` script, turbo task, CI step) replays migrations into an ephemeral shadow and diffs against the schema (`prisma migrate diff --from-migrations --to-schema --exit-code`); FAIL on a clean drift signal, WARN-degrade when no `MIGRATE_SHADOW_DATABASE_URL` or when the partly hand-curated history can't replay (a pre-existing Gulf `NitaqatBand` migration gap blocks a full replay today — orthogonal to this batch, must not retro-brick).
- **Verification:** `prisma migrate diff` (before-state + migration) → schema = empty, both directions; `db:check-drift` (generated client) GREEN; `pnpm typecheck --filter=@contractor-ops/db` GREEN; biome GREEN (both configs); `check:no-process-env` neutral (script contributes 0). Live per-region apply stays a deferred ops action (LOCAL-ONLY).

## 2026-07-05 — KSeF sync now drains query pagination before advancing the checkpoint

- [[integrations/ksef]] — `ksef-sync-orchestrator` previously read only `result.invoiceMetadataList` from a single `queryInvoices` call and ignored the client's `hasMore` / `pageToken` cursor, then advanced `IntegrationConnection.lastSuccessAt` — so every invoice past page 1 was permanently lost. `queryInvoices` gains an optional `pageToken` (fed into the metadata-query request body); the orchestrator's new `ingestAllKsefPages` loops on `hasMore`, ingesting each page and accumulating totals. The checkpoint advances **only** when the run ends with zero errors, so a mid-sync page fetch failure (or `hasMore: true` with no `pageToken`, or exceeding the 1000-page cap) pins `lastSuccessAt` and the window is re-queried next run; per-invoice poison isolation is unchanged (already-fetched invoices skip on re-query). Added `ksef-sync-orchestrator.ts` to the page verify_with. New orchestrator tests: 2-page query ingests all 4 invoices + feeds the continuation token; page-2 fetch failure throws and leaves the checkpoint unchanged (ERROR flip only, no `lastSuccessAt`).

## 2026-07-05 — personnel-file erasure success path now writes an audit row

- [[domains/personnel-file]] / [[patterns/audit-log]] — `requestErasure` previously audited **only** the retention-blocked branch (`personnel_file.erasure_retained_under_statute`); the `disposition === 'erased'` success path soft-deleted documents with no `writeAuditLog`, leaving a RODO erasure unauditable. Now **every** request writes `personnel_file.erasure_requested` (`resourceType: 'USER'`, `resourceId = workerId`, `metadata = { dispositions: { section → 'erased'|'retained' }, fullErasureClaimed }`) in the same `$transaction` as the soft-deletes, mirroring the org-grain `organization.erasure_requested` on `gdpr.ts`; a held request still additionally writes the `_retained_under_statute` row with citations. New tests in `personnel-erasure.test.ts` assert the audit row on both the erased-success and held paths.

## 2026-07-05 — payment.lockAndExport race loser returns a null bank file (double-payment fix)

- [[domains/payments-and-bank-files]] — new invariant + `payment-export-router.ts` added to verify_with: the bank-file buffer is built *before* the guarded DRAFT/LOCKED → EXPORTED `updateMany`, so before this fix a concurrent race loser (which also holds a buffer) returned it too — two callers, two identical bank files, double-payment risk. `runExportTransaction` now signals winner (`exported: true`) vs loser (`exported: false`); the loser returns `{ fileBase64: null, fileName: null, idempotent: true }` (same shape as the pre-checked idempotent path). Winner path unchanged; `PaymentExport @@unique([paymentRunId])` guard unchanged. Race security test now asserts exactly one non-null `fileBase64` across the two racers.

## 2026-07-05 — 1042-S staff surface mounted + Phase 87 US-expansion synthesis (Theme A gate)

- **Mounted the orphaned 1042-S staff batch review** (Plan 09 Task 1): the recovered wired `tax-1042s-batch-panel` + `tax-1042s-batch-summary` + `treaty-rate-caption` + `hooks/use-1042s-batch.ts` typechecked but had no route/nav/i18n. Added a thin `/tax-filing` page (`pages/dashboard/tax-filing.tsx` — Suspense + `module.us-expansion` flag gate + `contractor:read`), the dashboard route, and a flag-gated Finance nav entry (`Landmark`); added the `Tax1042SBatch` i18n namespace + `Navigation.taxFiling` across en/de/pl/ar at parity (en-US inherits en). FTIN stays last-4 via the gated `SsnMaskedReveal`; the 30% statutory branch is an amber advisory caption, never a filing block.
- New domain page [[domains/us-classification]] — US worker classification in one compass: `UsClassificationProfile` registry plugin (`getProfileForCountry('US')`), IRS common-law base + dispositive CA-AB5 overlay (server-injected `US_WORK_STATE`) + §530 relief flag; advisory-not-verdict; reason-required audited `classification.override` (AuditLog-only); append-only no-LLM `US_DETERMINATION_LETTER` react-pdf (frozen `ruleSetVersion`). Purpose/Flow/Determination Letter/Entry points/UI surface/Invariants/Agent mistakes; verify_with → shipped source.
- [[domains/us-tax-forms]] — new "Form 1042-S (chapter-3 foreign withholding)" section (`form-1042s.service` §875(d) gate + server-derived boxes + immutable supersede + REPORTED-only idempotent batch; recipient PDF; sibling `buildIris1042SXml` + form-parameterized `xsdValidate1042S`; transmit tail cross-phase HOLD on the P86 seam), a staff 1042-S batch-review UI-surface bullet, entry-point rows, a 1042-S invariant + agent-mistake note; verify_with (the 1042-S service/router/pdf/template + tax-filing UI + page) + source_commit bumped.
- New integration page [[integrations/irs-1042s]] (IRS 1042-S via IRIS, Pub 1187 sibling builder + form-keyed XSD + human-download checkpoint + transmit HOLD) + registered in [[integrations/_index]].
- [[structure/prisma-schema-areas]] — Tax row extended with the Phase 87 models (`Form1042S` immutable/supersede, `Form1099KTrackerState`, `Tax1099KThreshold` $20,000+200 OBBBA) + `US_DETERMINATION_LETTER` kind + nullable `ContractorAssignment.workState`; verify_with (tax/classification/contractor schema) + source_commit bumped. [[structure/web-vite-domains]] — `contractors/tax-filing/` row + `/tax-filing` route; source_commit bumped. Navigation: [[domains/_index]] now lists us-classification + us-tax-forms (was missing). `hot.md` gains a US-1042-S/classification discovery section (source_commit bumped). ([[structure/api-routers-catalog]] `form1042s`/`form1099kTracker` + [[structure/cron-jobs]] `form-1099k-tracker` already documented by Plans 04/06 — verified accurate, unchanged.)
- `.planning/MEMORY.md` — four Phase-87 invariants (US classification pluggable profile advisory-not-verdict; 1042-S §875(d)-gated immutable+supersede REPORTED-only; 1099-K informational cron never files; 1042-S IRIS sibling builder through the form-parameterized transmit tail).
- **Cross-phase HOLD (recorded, not a skipped build):** the P86 `iris-status-pill` / `ack-upload-field` / `step-edelivery-consent` / `use-edelivery-consent` / `copy-b-download` seam is not on disk (0 matches each), so Plan 09 Tasks 2-3 (staff filing card + portal consent-gated 1042-S PDF) + their `Tax1042SFiling`/`Tax1042SConsent` i18n HOLD — reused verbatim once P86 lands, never rebuilt.
- **Verification:** turbo typecheck (`@contractor-ops/api` + `@contractor-ops/web-vite`) 17/17 green; `check:web-vite-data-layer`/`page-shells`/`presentational`/`dialog-pattern` OK; `i18n:parity` OK; `check:wiki-brain` GREEN.

## 2026-07-05 — US tax year-end filing synthesis (documentation-follows-code, Theme A)

- New domain page [[domains/us-tax-year-end-filing]] — the whole TIN-match → 1099-NEC → IRIS e-file → state-filing loop in one compass (Purpose/Flow/Entry/UI/Agent-mistakes + `verify_with` → real source). Ships dark behind `module.us-expansion` (+ `module.iris-efile` for A2A). New integration pages [[integrations/irs-iris]] (ManualDownload default, dark A2A, SOR XSD bundle → non-throwing `BUNDLE_UNAVAILABLE` pre-enablement, one ack parser six statuses) + [[integrations/irs-eservices-tin-matching]] (mock default + dark SSRF-safe live client; advisory mismatch never blocks). Catalogued: `tax1099` staff + portal 1099 namespaces in [[structure/api-routers-catalog]]; `Form1099Nec`/`IrisSubmission`/`IrisAck`/`Tax1099Threshold`/`StateFilingConfig` in [[structure/prisma-schema-areas]]; `year-end-1099-reminder` (notify-only) in [[structure/cron-jobs]]; the `packages/iris` builder/validator in [[structure/packages]]; `module.iris-efile` = the single dark A2A gate (no `iris-a2a-transmit` flag) in [[patterns/feature-flags]]. Covers Plans 86-04 (IRIS ack parser + flag-defer XSD), 86-06 (transmitter factory + staff/portal routers + cron), 86-07 (staff tax-filing UI + portal consent + i18n).

## 2026-07-01 — Personnel file UI orphans mounted (Phase 91 gap-closure)

- Closes the two `gaps_found` verification items on [[domains/personnel-file]]: the RODO `PersonnelErasureDialog` (AKTA-03) and the admin `PersonnelClassifyQueuePanel` (AKTA-04) were built + tested but never mounted into any route, so no staff user could reach erasure or the classify-review queue. Fix: `PersonnelErasureDialog` mounted in `personnel-file-shell.tsx` below the four section cards; `PersonnelClassifyQueuePanel` reachable via a new flag-gated admin route `employees/personnel-classify-queue` (thin page → new `PersonnelClassifyQueueView` flag gate → panel). Domain page UI-surface section updated with both mount points. web-vite typecheck 16/16, layering gates OK, personnel-file component tests 6/6. Phase 91 verification re-run → `passed` (4/4). No new i18n keys (erasure dialog is self-translated; the shell aria-label reuses `PersonnelFile.erasure.requestCta`).

## 2026-07-01 — Personnel file (akta osobowe) synthesis (documentation-follows-code, Theme B gate)

- New domain page [[domains/personnel-file]] — the whole jurisdiction-correct personnel file in one compass: `PersonnelFile` 1:1 tenant-owning sidecar on `Worker` (`workerId @unique`, `countryCode` snapshot + `hireDate`/`terminatedAt` retention seams) + `PersonnelFileDocument` enum-on-link into the `Document` stack (4-section view via `PersonnelFileSection`); register-on-import section+retention registry (PL/DE/UK/US) feeding 8 akta tokens onto the SHARED `RETENTION_YEARS` map; `getPersonnelRetentionCutoff` event-anchored resolver (`HIRE/TERMINATION/DOCUMENT` + `max()` US I-9 + indefinite-while-active) wired into both deletion chokepoints; resource-per-section `employeeFileA..D` RBAC on the 4 HR roles (BFLA fence, `hasSectionPermission` before query); `personnelFile` router (`getFile`/`getRetentionSummary`/`attachDocument`/`classifyApprove`/`classifyReject`/`pendingReviewQueue`/`requestErasure`); hybrid `classifyPersonnelDocument` behind `killswitch.ai-personnel-classifier`; per-employee/per-section statutory-hold erasure (`fullErasureClaimed = retained.length===0`); staff UI (5-state shell, server-driven locked card, classify queue, RODO erasure dialog). Purpose/Flow/Entry points/Retention/RBAC/Erasure/Classifier/UI surface/Invariants/Agent mistakes; verify_with → the real shipped source.
- [[structure/prisma-schema-areas]] — Personnel file area row (`PersonnelFile` + `PersonnelFileDocument` + `PersonnelFileSection`/`PersonnelDocClassificationMethod` enums; enum-on-link 4-section view; retention seams; tenant-owning, NOT in `globalModels`; additive migration, live apply DEFERRED); `personnel.prisma` added to verify_with; source_commit bumped.
- [[structure/key-services]] — personnel retention resolver row (`getPersonnelRetentionCutoff` on the shared primitive; event anchors + `max()` + fail-closed; 8 tokens single-source; both chokepoints) + personnel document classifier row (taxonomy → kill-switch AI → admin, never blocks upload); `personnel-classifier.ts`/`retention-policy.ts`/`personnel-registry.ts` added to verify_with; source_commit bumped.
- [[structure/api-routers-catalog]] — "Conditional workforce" refreshed from 2 → 3 namespaces (adds `personnelFile` read/classify/erasure with per-section lock + non-blocking classify + never-over-claim erasure); `personnel-file/index.ts` added to verify_with; source_commit bumped.
- [[patterns/rbac-permissions]] — new "Per-section personnel-file grain" section (resource-per-section `employeeFileA..D`, HR-role matrix, owner BFLA fence, permission-layer `hasSectionPermission` before query); `section-access.ts` added to verify_with; source_commit bumped.
- [[patterns/audit-log]] — personnel-file audit bullet (`personnel_file.erasure_retained_under_statute` in-tx + classify approve/reject/attach; `allowAuditPurge` stays GDPR-only); `personnel-file/erasure.ts`/`classify.ts` added to verify_with; source_commit bumped.
- [[patterns/feature-flags]] — `killswitch.ai-personnel-classifier` entry-point row (default-on, killWhenUnknown, non-gated; off → admin step, never blocks the upload); `personnel-classifier.ts` added to verify_with; source_commit bumped.
- Navigation: [[index]] + [[domains/_index]] link the new domain page. `hot.md` gains a personnel-file section (source_commit bumped).
- `.planning/MEMORY.md` — three Phase-91 invariants (per-section RBAC grain resource-per-section never to owner; shared-retention-map + event-anchor resolver, no parallel engine; per-section statutory-hold erasure never over-claims).
- **Phase-91 seal (gate GREEN):** all seven Wave-0 tests green — db `personnel-retention` (retention resolver) within `@contractor-ops/db` 190 passed; `@contractor-ops/compliance-policy` `personnel-registry` within 46 passed; `@contractor-ops/auth` `personnel-file-rbac` within 278 passed; `@contractor-ops/api` `personnel-file-rbac-router` + `personnel-file-tenant-isolation` + `personnel-erasure` + `personnel-classifier` = 13 passed; `@contractor-ops/web-vite` `src/components/employees/personnel-file` (path-scoped) 6 passed. `check:wiki-brain` GREEN; `i18n:parity` / `check:web-vite-data-layer` / `check:web-vite-dialog-pattern` / `check:rtl-logical-props` / `lint:no-breadcrumbs` / `lint:audit-log` OK; `@contractor-ops/api` typecheck 0 errors, personnel-file UI type-clean. No AKTA-01..04 test red. Deferred (LOCAL-ONLY / follow-up): live per-region migration apply (`__personnel_file_additive` EU/ME); concrete Claude-Vision section adapter (AI tail degrades to admin queue); classify-queue admin route + erasure-dialog shell mount; web-vite RBAC mirror granting `employeeFileA..D` to HR roles. Out of scope (pre-existing, not this phase): `classification-tile.tsx` TS2366 + `idp-deprovisioning.prisma` enum-casing offenders.

## 2026-07-01 — US classification result + determination-letter + 1099-K band UI (web-vite, Theme A)

- [[domains/us-tax-forms]] — UI-surface section extended with the staff US classification result (`us-classification-result.tsx` wired 4-state + `hooks/use-us-classification.ts` sole boundary → `classification.getLatest` + reason-required `classification.override`), the amber `ab5-watchlist-flag.tsx` + info §530 chip + blocking disclaimer gate (reuses `classification.acknowledgeDisclaimer`) + `classification-override-dialog.tsx` (DialogBody/DialogFooter, required reason), the SDS-mirror `generate-determination-letter-button.tsx` (+ `hooks/use-generate-determination-letter.ts` → `classificationDocument.generateUsDeterminationLetter`; `US_DETERMINATION_LETTER` row in `document-history-list.tsx`, wired for `US` in `classification-documents-panel.tsx`), and the read-only informational `form-1099k-band.tsx` (+ `hooks/use-1099k-tracker.ts` → `form1099kTracker.getTrackerState`; SAFE/APPROACHING/OVER amber-at-most, no filing CTA). Two UI agent-mistake notes (advisory-not-verdict; informational-only band) + verify_with + source_commit bumped. i18n `UsClassification.*` + `Form1099KTracker.*` at en/en-US/de/pl/ar parity; locked disclaimers stay in `@contractor-ops/validators`.

## 2026-07-01 — Informational 1099-K threshold tracker (documentation-follows-code, Theme A gate)

- [[domains/us-tax-forms]] — new "1099-K informational threshold tracker" section + entry-point row + invariant + agent-mistake note: `form-1099k-tracker.service` (`bandFor1099K`/`updateTrackerBandState`/`runForm1099KTrackerScan`) sums cumulative settled USD payouts + transaction count per contractor and bands SAFE→APPROACHING→OVER against the tax-year-keyed `Tax1099KThreshold` ($20,000 + 200, OBBBA — never a constant, never $600); `OVER` needs BOTH dimensions, `APPROACHING` at 80% of either; up-cross fires a proactive heads-up, same non-safe band re-fires past the 30d cadence (`lastReminderAt`); `pLimit(10)`, `createCronLogger`, sole writer of `Form1099KTrackerState`; purely informational — no filing/generate/transmit path. Read-only `form1099kTracker.getTrackerState` surfaces the band for the profile. verify_with + source_commit bumped.
- [[structure/api-routers-catalog]] — "Conditional US expansion" section refreshed from 1 → 3 namespaces (adds the already-merged `form1042s` + the new read-only `form1099kTracker`); source_commit bumped.
- [[structure/cron-jobs]] — `form-1099k-tracker.ts` entry-point row (informational 1099-K band scan, `module.us-expansion`, never files); source_commit + updated bumped.

## 2026-07-01 — Employee registry synthesis (documentation-follows-code, Theme B gate)

- New domain page [[domains/employee-registry]] — the per-market employee onboarding surface in one compass: an employee is a `Worker(workerType='EMPLOYEE')` + a tenant-owning 1:1 `EmployeeProfile` (`workerId @unique` FK, NO standalone `Employee` table); `employeeRegistryRouter` (`register`/`revealPii`/`listReferenceLists`) `mergeRouters`-composed into the staff `employeeRouter`; `register` validates per-market fields (`validateEmployeeCountryFields` + 8 greenfield ID validators), encrypts the 4 national IDs into dedicated `*Encrypted`/`*Last4` columns, `omit`s every `*Encrypted` on return, Emirates-ID checksum advisory (`checksumAdvisory`, never throws), audit `resourceType: 'ORGANIZATION'`; `revealPii` `employeePii:read` field-routed decrypt + audit, staff-only; seeded LOCAL-ONLY reference lists + no-network ELStAM stub. Purpose/Flow/Entry points/Storage shape/UI surface/Invariants/Live state/Agent mistakes; verify_with → the real shipped source.
- [[structure/prisma-schema-areas]] — `EmployeeProfile` area row (hybrid `countryFields` JSON + 4 encrypted national-ID pairs + promoted typed columns `saudizationCategory`/`etat`/`employmentStatus`; `enum EmploymentStatus`; tenant-owning, not in `globalModels`; authored additive migration, live apply DEFERRED); `employee.prisma` added to verify_with; source_commit bumped.
- [[structure/packages]] — `validators` row extended (`employee-validators.ts` 8 statutory validators + `EmiratesIdResult`, `employee-country-fields.ts` parallel `.strict()` map, `employee-reference-lists.ts` + `reference-data/*` seeds, `EMPLOYEE_PII_ENCRYPTION_KEY`); `api` row extended (`employee-pii-crypto.ts` + `elstam-stub.ts`); source_commit bumped.
- [[structure/web-vite-domains]] — `employees/` + `employees/compliance/` domain rows (page → wired `EmployeeComplianceSection` → `use-employee-compliance`/`use-reveal-employee-pii` hooks → presentational; `EmployeeFieldsDispatch` PL/DE/UK/US/AE/SA; masked reveal absent without `employeePii:read`; flag render-tree removal; NO container), replacing the flag-dark skeleton row; source_commit bumped.
- [[structure/api-routers-catalog]] — `employee` namespace row updated from skeleton-read-only to the composed registry surface (`register`/`revealPii`/`listReferenceLists` with gating, encryption, staff-only reveal); `employee-registry-router.ts` added to verify_with; source_commit bumped.
- [[patterns/_index]] — three reusable idioms added to the worker-model table: parallel-not-fork country-fields registry, national-ID PII-encryption boundary (dedicated key + omit-on-return + `*Pii:read` reveal + audit), seeded reference lists (no live gov).
- Navigation: [[index]] + [[domains/_index]] link the new domain page.
- `.planning/MEMORY.md` — two invariants (employee national-ID PII-encryption boundary mentioning `EMPLOYEE_PII_ENCRYPTION_KEY`; reference-lists-are-seeded-not-live-gov + `EmployeeProfile` tenant-owning).

## 2026-07-01 — US payment-rail synthesis (documentation-follows-code, Theme A gate)

- New domain page [[domains/us-payment-rail]] — the whole US payout rail in one compass: the ACH `ACH_NACHA` hand-rolled zero-dep generator + Fedwire `pacs.008.001.08` XML in the payment-export factory (`generateNachaFile`/`generateFedwirePacs008`); `detectUsFormat` routing with the Same-Day ACH ceiling as dated config (`sameDayAchCeilingMinor` $1M→$10M 2027-09-17), not a constant; the jurisdiction-agnostic withholding deduction (`applyWithholding` — SA WHT + US 24% §3406 + 1042-S treaty) with the PAYMENT RUN AS THE SINGLE SOURCE OF TRUTH the 1099 box-4 / 1042-S box-2 aggregate; USD first-class (no `USD=1.0` short-circuit) + `resolveSettlementCurrency`/`convertForSettlement`; the Modern Treasury `PayoutInitiationAdapter` + Plaid Identity seams (mock default, flag-dark, Plaid advisory fail-open). Purpose/Flow/Withholding/Formats/USD/Seams/Entry points/UI surface/Invariants/Agent mistakes; verify_with → the real shipped source.
- New [[integrations/modern-treasury]] + [[integrations/plaid]] — provider pages: mock-behind-seam + flag-dark, the `payments.ach-payouts` (reused) / `payments.plaid-verification` (non-gated) gating, AES-256-GCM per-slug credential keys (`MODERN_TREASURY_ENCRYPTION_KEY`/`PLAID_ENCRYPTION_KEY`), zero-dep GA floor, live-path deferred.
- [[structure/api-routers-catalog]] — `payment` row extended (US `ACH_NACHA`/`FEDWIRE` + opt-in `initiatePayout`) + a `payment.initiatePayout` Notable-contract (Zod `.strict()`, gating, idempotency, per-item settlement + Plaid advisory, masked audit); `payment-core.ts` added to verify_with; source_commit bumped.
- [[structure/prisma-schema-areas]] — US payment-rail area row (`Contractor.backupWithholdingFlagged`; `ContractorBillingProfile` US ACH encrypted+masked pairs + Plaid advisory `String?` fields; `PaymentExportFormat` += `ACH_NACHA`/`FEDWIRE`; additive migration `20260701000000_phase88_us_payment_rail_schema`); source_commit bumped.
- [[patterns/money-rounding]] — withholding single-HALF-UP row (`applyWithholding`) + settlement-FX row (`convertForSettlement` verbatim `convertAmount` delegate, null-on-missing-rate); `payment-shared.ts`/`payment-settlement.ts` added to verify_with; source_commit bumped.
- [[patterns/feature-flags]] — `payments.ach-payouts` (reused for programmatic ACH, signoff PENDING→APPROVED) + `payments.plaid-verification` (non-gated, live Plaid client only) gate rows; `flags-core.ts` added to verify_with; source_commit bumped.
- Navigation: [[index]] + [[domains/_index]] + [[integrations/_index]] link the three new pages.
- `.planning/MEMORY.md` — "payment run is the withholding source of truth" invariant + one jurisdiction-agnostic path, hand-rolled NACHA / config ceiling / no-USD-short-circuit, programmatic-ACH + Plaid mock-behind-seam flag-dark + Plaid advisory fail-open.

## 2026-06-22 — Worker foundation synthesis (documentation-follows-code, Theme B gate)

- New domain page [[domains/worker-foundation]] — the whole worker-model abstraction in one compass: `Worker` identity root (org-scoped, `workerType WorkerType @default(CONTRACTOR)`, NOT in `globalModels`) + `Contractor.workerId` sidecar 1:1 FK (`Contractor.id` stable, not a re-key); idempotent reversible per-region backfill + two-step migration ordering (A nullable → backfill → B NOT NULL+FK last); `withWorkerTypeDefault` explicit-where-wins extension + the 4 raw-SQL blind-spot sites guarded by `check:contractor-rawsql-workertype`; `worker`/`employee` router split + three-layer flag-off; per-type `employee` RBAC + 4 HR roles (BFLA fence); Worker tenant isolation. Purpose/Flow/Entry points/Invariants/Agent mistakes.
- [[structure/prisma-schema-areas]] — Worker model area row + the `withWorkerTypeDefault` raw-SQL-blind-spot invariant; source_commit bumped.
- [[structure/key-services]] — `backfill-worker.ts` + `worker-type.ts` rows; source_commit bumped.
- [[structure/api-routers-catalog]] — workforce section cross-linked to the domain page; `worker.ts`/`employee.ts` added to verify_with; source_commit bumped.
- [[patterns/_index]] — new "Worker-model abstraction" table (extension / per-type RBAC / three-layer flag-off / two-step migration idioms, reusable in Phases 90–97).
- [[patterns/feature-flags]] — `module.workforce-employees` gate row + verify_with; source_commit bumped.
- `.planning/MEMORY.md` — two invariants (Worker base + one-time backfill; `workerType`-scoped reads + raw-SQL guard) + router-count anchor refreshed (workforce conditional namespaces).

## 2026-06-22 — Worker-model per-type RBAC + HR roles + tenant leak test (Theme B)

- New `employee` RBAC resource in `packages/auth/src/permissions.ts` (`create`/`read`/`update`/`delete`/`approve_leave`) — the per-type surface for the worker-model employee abstraction, kept separate from `contractor` so HR-only fields gate independently.
- Four HR roles in `packages/auth/src/roles.ts`: `hr_admin` (full employee CRUD + approve_leave), `hr_manager` (employee read/update), `payroll_officer` (employee read + payment read + report read/export), `leave_approver` (employee read + approve_leave). Each grants only `employee` (plus narrow `contractor:read` where needed) and NEVER a contractor mutation (BFLA fence). Requirement names are UPPER_SNAKE; reconciled to the codebase snake_case `RoleName` convention. `owner` is sourced from a duplicated `allPermissions` const that intentionally omits `employee`, so `owner` does not hold the HR-only resource (left untouched).
- `role-permission-matrix.test.ts` freezes the exact grant for all 14 roles; `roles.test.ts` proves the 10 pre-existing roles' grant set is unchanged and the HR roles respect the contractor-mutation fence.
- `Worker` is tenant-owning (carries `organizationId`, absent from `globalModels` in `packages/db/src/tenant.ts`) — `packages/api/src/__tests__/worker-tenant-isolation.test.ts` proves an ORG_A caller never sees ORG_B Worker rows via `worker.list`/`getById`.
- Wiki: [[patterns/rbac-permissions]] § Resources and roles (employee resource + 14 roles + HR fence).

## 2026-06-22 — Worker-model router split + workforce flag-off (Theme B)

- New tRPC namespaces behind `module.workforce-employees`: `worker` (shared cross-type reads — `list`/`getById`, explicit `workerType` so the `withWorkerTypeDefault` extension does not force-filter to CONTRACTOR) and `employee` (skeleton, `workerType=EMPLOYEE`, read-only). Both in `packages/api/src/routers/core/{worker,employee}.ts`; Zod `.strict()` inputs block `organizationId`/`workerType` mass-assignment.
- Three-layer flag-off mirrors the us-expansion gate: `root.ts` conditional-spread (`conditionalWorkforceRouters`, absent → `METHOD_NOT_FOUND`) + per-request `assertWorkforceEnabled` (FORBIDDEN / `workforceDisabled`) in `middleware/require-workforce-flag.ts` + web-vite `useFlag('module.workforce-employees')` render-removal (`dashboard-home.tsx` quick-link + flag-dark `/employees` route at `pages/dashboard/employees.tsx`). Flag already registered PENDING — not re-registered.
- `contractor.*` is NOT gated and its route shape is unchanged (locked by `contractor-contract-snapshot.test.ts`). New `WORKFORCE_DISABLED` error + `workforceDisabled` i18n key (en/de/pl/ar).
- Wiki: [[structure/api-routers-catalog]] § Conditional workforce; [[structure/web-vite-domains]] employees row.

## 2026-06-18 — IRIS 1099-NEC e-file package (`@contractor-ops/iris`)

- New: `packages/iris` (`@contractor-ops/iris`) — IRS IRIS (Information Returns Intake System) 1099-NEC Copy A e-file XML. `buildIrisXml` (`src/generator.ts`) builds the submission with fast-xml-parser `XMLBuilder` (never string-concatenated XML, mirrors `packages/einvoice`): Transmission Manifest carries the payload-manifest schema `VersionNum`/`VersionDt`, each payee B-record carries its CFSF state code, amounts emit as IRIS USAmountType whole dollars, recipient TIN masked last-4 only. `xsdValidate` (`src/validator.ts`) validates against the bundled IRS IRIS XSD with `libxmljs2` → `{ status: 'VALID' | 'INVALID', errors }` (einvoice KoSIT layer-1 shape); SSRF/XXE-safe (`parseXml({ nonet: true })`, default `noent: false`), bundle dir resolved lazily + entry XSD memoized.
- XSD bundle is a human-action checkpoint: IRS IRIS XSDs are a human-only download (IRS SOR login, not on npm) placed under `src/schema-bundle/` with SHA-256 pinned in `checksums.txt` (`pnpm --filter @contractor-ops/iris verify:schema-checksums`). Until placed, `xsdValidate` reports `XSD-BUNDLE-MISSING` (INVALID) instead of throwing — generator works today, validator VALID path stays blocked on the human download.
- Wiki: [[structure/packages]] (`iris` row); [[domains/us-tax-forms]] § IRIS XML e-file + entry point + invariant + agent mistakes.

## 2026-06-17 — 1099-NEC generation engine + recipient Copy-B PDF

- New: `packages/api/src/services/form-1099-nec.service.ts` — `generateBatch` (box-1 aggregated by payment-date + FX-to-USD per recipient/payer-org), tax-year-keyed `Tax1099Threshold` gate (never a constant: $600 TY2025 / $2,000 TY2026 OBBBA), `computeBox4Minor` backup withholding, `supersedeCorrected`/`fileCorrection` (CORRECTED = supersede in one tx), idempotent batch + `writeAuditLog`; snapshot keeps TIN last-4 only.
- New: `packages/api/src/services/form-1099-nec-pdf.ts` + `pdf-templates/form-1099-nec-copy-b.tsx` — lazy `renderToBuffer` substitute Copy B (Pub 1179 §4.6) from the immutable snapshot, last-4 TIN, adviser-verify footnote; R2 archive `1099-nec/<orgId>/<id>.pdf` with a `pdfArchiveKey` CAS guard; Copy B only (Copy A goes via IRIS XML).
- Persistence sink is an injected port — deterministic core unit-tested with no live DB (86-02 migration not yet applied); the schema-applied wiring caller supplies the real writer.
- Wiki: [[domains/us-tax-forms]] § 1099-NEC generation + entry points + invariants + agent mistakes; [[structure/key-services]] two new rows.

## 2026-06-10 — First-run org onboarding wizard

- `DashboardShellContainer` gates on client session `activeOrganizationId`; no org + no membership → `OrganizationOnboardingContainer` (replaces shell, avoids `tenantNoActiveOrganization`)
- New: `apps/web-vite/src/components/onboarding/organization-onboarding.tsx` + `hooks/use-organization-onboarding.ts`
- Create org via Better Auth `authClient.organization.create` + `setActive` (no tRPC); `billingCountry` → data region; `Intl.DisplayNames` for country labels
- i18n: `OrganizationOnboarding` namespace (en/de/pl/ar)
- Wiki: [[domains/onboarding-and-import]] § First-run organization onboarding; [[structure/web-vite-domains]]

## 2026-06-10 — Agent delegation (subagent-first)

- Binding: `.claude/core-values.yml` § Delegation & surgical edits → `pnpm standards:gen`
- `CLAUDE.md` § Agent workflow → Delegation table + orchestrator rule
- SessionStart: `inject-standards-build.js` → `DELEGATION DEFAULT` block
- PreToolUse advisory: `no-bulk-script-guard.js` on suspicious Bash (sed/awk/python -e on sources)
- Cursor: `.cursor/rules/15-delegation-subagents.mdc`; bullet in `20-tools-workflow.mdc`
- Skill: `.claude/skills/cavecrew/SKILL.md` — anti-script + when-not-to-delegate
- Wiki: [[patterns/agent-delegation]]

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

## 2026-06-10 — UI skills routing (frontend-design + impeccable + marketing stack)

- **Binding:** expanded `30-ui-a11y.mdc`, `core-values.yml` UI section, `CLAUDE.md` § UI skills, `PRODUCT.md` § Design tooling
- **Hooks:** `ui-workflow-lib.js` `isUiTargetPath` → `apps/web-vite/`, `apps/landing/`, `packages/ui/` (was stale `apps/web/`)
- **Discoverability:** symlinks `.claude/skills/{design-taste-frontend,image-to-code,redesign-existing-projects,full-output-enforcement}` → `.agents/skills/`
- **Wiki:** new [[patterns/ui-skills-routing]]; `patterns/_index`, `hot.md`

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

### 2026-06-16 — KB enforcement: doc/graph freshness gated, not advisory
- `scripts/check-wiki-brain.mjs`: added NEW-drift CI gate (source file under a page's `verify_with` changed without the page → error, vs branch base); graph.json/BM25 absence downgraded to WARN (local gitignored artifacts).
- `.claude/hooks/wiki-brain-inject.sh` Stop: block-once (`{"decision":"block"}`, respects `stop_hook_active`) when apps/packages changed with no wiki; added `GRAPH_WARN` staleness backstop.
- `.husky/post-commit`: background clean-rebuild of graphify graph on code commits (atomic lock). Discovered `graphify update` MERGES edges → must `rm graph.json` first (clean count 61,598 links vs accumulated 92k→188k); fixed canonical command in CLAUDE.md.
- `core-values.yml`: routes graphify (call graph/blast radius) + "never assert facts from memory"; semble wired in `.mcp.json` + new `.cursor/mcp.json` (Cursor parity). `ci.yml` ci job → `fetch-depth: 0`.

## 2026-06-16 — US W-form intake: portal self-cert + staff read/track (Phase 85 Wave 3)

- `services/tax-form.service.ts`: `buildFormSnapshot` (immutable record-of-record + server-derived ESIGN attestation; full SSN stripped, last-4 only), `supersedeAndInsert` (append-only re-cert — flips prior ACTIVE → SUPERSEDED then inserts new ACTIVE in one tx), `computeExpiry` (~3yr for W-8, null for W-9).
- `routers/portal/portal-tax-form-router.ts`: `getTaxFormDetermination` / `saveTaxFormDraft` / `submitTaxForm` / `getMyTaxForms` on `portalProcedure` — IDOR-scoped to `ctx.contractorId`+`ctx.organizationId`, IP derived server-side from `ctx.headers`, `applyTreaty`+snapshot+supersede+CONTRACTOR audit inside `$transaction`. Merged flat into `portal.*`.
- `routers/core/tax-form-router.ts` (`taxForm` namespace): staff `listFormSubmissions` (status/track, snapshot never projected) + `requestTaxForm` (USER audit, no signed record); `contractor:read` gated. Full-SSN reveal stays on `contractor.revealSsn`.
- `middleware/require-us-expansion-flag.ts`: `assertUsExpansionEnabled` per-request guard + `isUsExpansionRegistered` boot gate. `root.ts`: conditional-spread `taxForm` behind `module.us-expansion` (mirrors classification). Portal self-gates per request (flat merge can't conditional-spread).
- Wiki: `domains/portal-external.md`, `structure/api-routers-catalog.md`, `api-router-groups.md`, `key-services.md` updated for the W-form surface.

## 2026-06-16 — Security hardening doc sync (integration secret allowlist + contractor P2002)

- Integration `connectionStatus` now projects `configJson` through non-secret allowlists (`publicJiraConfig` / `publicLinearConfig` / `publicTeamsConfig`) instead of the raw blob — fixes webhook signing secret (`webhookSecret`/`webhookIds`) leak to any `settings:read` member; Linear/Teams drop `webhooks`/`conversationReferences` proactively. `contractor.create` catches Prisma `P2002` on duplicate org `taxId` → tRPC `CONFLICT` (`E.CONTRACTOR_TAX_ID_EXISTS`, en/de/pl/ar) instead of an unhandled 500; backing `@@unique([organizationId, taxId])` recommended/pending.
- Wiki: `domains/contractors-engagements.md`, `integrations/jira.md`, `integrations/linear.md`, `integrations/teams.md`, `patterns/registry-plugin.md` (new § connectionStatus secret hygiene), `structure/api-router-groups.md`, `structure/packages.md`; `source_commit` → `57946f64`

## 2026-06-16 — US W-form intake: portal wizard + staff status card UI (Phase 85 Wave 4)

- `components/portal/tax-forms/`: `tax-form-wizard.tsx` (container — reui Stepper + AnimateIn + loading/empty/error), `hooks/use-tax-form-wizard.ts` (SOLE tRPC/RHF boundary — `portal.getTaxFormDetermination` + `submitTaxForm`, multi-step state, `formType` discriminant sync), `step-determination` (confirm/override), `step-w9` / `step-w8ben` / `step-w8ben-e`, `step-attest`, `step-receipt`, shared `step-types.ts` / `treaty-claim-caption.tsx` (aria-live announce) / `w8-foreign-fields.tsx`. Thin `pages/portal/tax-form-page.tsx` + route `portal/tax-form`.
- Attestation gate: real `<input type="checkbox">` perjury items + typed legal-name match + "I understand this is a legal signature" affirmation gate `Sign & submit`; inline `role="alert" aria-live="polite"` submit-failure region preserves entered data; server re-derives ip/timestamp/identity.
- `components/contractors/tax-forms/tax-form-status-card.tsx` + `hooks/use-tax-form-status.ts`: staff read/track via `taxForm.listFormSubmissions`; status pill (ACTIVE/DRAFT/SUPERSEDED/expiring) reusing the `UspsAddressStatusPill` VARIANT_MAP idiom; full SSN behind `SsnMaskedReveal` (control absent without `contractorPii:read`); adviser note informational.
- i18n: `TaxFormWizard` + `TaxFormStaff` namespaces across en/de/pl/ar (en-US inherits via fallback); `i18n:parity` green. 12 scoped component tests GREEN (4 states + RTL, attestation gate, submit-failure-preserves-data, receipt, staff pill mapping + PII gating). `check:web-vite-data-layer` green (only the hook touches tRPC).
- Wiki: NEW `domains/us-tax-forms.md`; `structure/web-vite-domains.md`, `prisma-schema-areas.md`, `packages.md`, `domains/contractors-engagements.md` updated; `hot.md` overwritten; MEMORY invariant appended.

## 2026-06-18 — Lifecycle orchestration wiring facts (readiness audit)

- Jira/Linear task linking confirmed **bidirectional** in code: inbound webhooks write back to `WorkflowTaskRun` (`jira-webhook-handler.ts:294`, `linear-webhook-handler.ts:293`, `workflowTaskRun.update`, loop-suppress + dedup). Notion adapter is read-only (search/picker), not bi-di. Wiki: [[domains/workflows-and-roles]], [[integrations/jira]], [[integrations/linear]]
- A completing OFFBOARDING `WorkflowRun` does **not** auto-start a `DeprovisioningRun`; `startDeprovisioningRun` is called only from the tRPC mutation (UI `components/idp/hooks/use-start-deprovisioning.ts`). Access-revoke task = marker. Wiki: [[domains/idp-deprovisioning]], [[domains/workflows-and-roles]]

## 2026-06-17 — AuditLog DB-level append-only + new audit writes + OCR kill-switch

- AuditLog hardened in Postgres (migration `20260617000000_auditlog_append_only`): INSERT-only RLS, `BEFORE UPDATE` trigger rejects all updates, DELETE gated on `allowAuditPurge(tx)` (`packages/db/src/rls.ts`, exported from `index.ts`); GDPR erasure opts in. Wiki: [[patterns/audit-log]], [[patterns/tenant-and-audit]], [[patterns/multi-region-db]], [[structure/prisma-schema-areas]], [[domains/consent-gdpr-pdpl]]
- New same-tx `writeAuditLog` rows: `approval.approve`/`reject`, `reassessment.acknowledge`/`dismiss` (`resourceType: CONTRACTOR`), `portal.contact.update`. Wiki: [[domains/approvals-engine]], [[domains/classification-ir35]], [[domains/portal-external]]
- `killswitch.ai-invoice-parser` now wired into `processOcrExtraction` (`resolveOrgRegion` → regional Unleash; off/unknown → skip Claude Vision, persist upload, mark `OcrExtraction` FAILED for manual entry). Wiki: [[patterns/feature-flags]], [[domains/documents-and-ocr]], [[structure/key-services]]
- `mergeByEmail` now emits lowercase-normalized `canonicalEmail`. Wiki: [[domains/onboarding-and-import]]
- `scripts/check-wiki-brain.mjs`: compiled emit (`.d.ts`/`.d.ts.map`, and `.js`/`.js.map` with a sibling `.ts`/`.tsx`) is doc-exempt — committed tsc output no longer triggers false drift.

## 2026-06-17 — IRS TIN-Matching seam + cache/retry/escalation service

- New `TinMatchClient` adapter seam (`packages/integrations/src/adapters/tin-match/`): `MockTinMatchClient` (deterministic default, reuses `isValidEin`/`isValidSsn`) + dark `EServicesTinMatchClient` (pinned literal base URL by credential environment, SSRF-safe like peppol-adapter-factory; refuses live calls until PAF enrollment clears). Barrel re-exported from `@contractor-ops/integrations`.
- New `tin-match.service.ts`: 24h cache (org+recipient+name+TIN-last4 key, never a full TIN) + bounded retry; a mismatch sets the backup-withholding flag + raises an admin escalation + writes an audit row and returns an advisory result — never throws, never hard-blocks the 1099. Side-effect ports are injected so the core is unit-tested with no live DB; `createDbTinMatchPersistence` wires the audit through `writeAuditLog`. Wiki: [[domains/us-tax-forms]], [[structure/key-services]]

## 2026-06-18 — Contractor list insight band + view modes + detail overview widgets

- `contractor.insights` (list-band attention + composition rollups) and `contractor.financialPulse` (per-contractor money rollup) added to `contractor-core.ts`; `list` refactored onto shared `buildContractorListWhere` (`contractor-shared.ts`) + new `countryCode`/`expiringWithin`/`paymentBlocked`/`stalled` facets in `contractorFiltersSchema`. Band counts and table rows share one predicate; `attention.atRiskCompliance` == `composition.health.red` via the same `computeListHealthBadge` JS tally. Wiki: [[domains/contractors-engagements]], [[structure/api-routers-catalog]]
- web-vite list page gains an insight band (`components/contractors/insights/`: attention rail + composition strip + health ribbon, `hooks/use-contractor-insights.ts` sole tRPC boundary) arranged by a per-user view mode (`hooks/use-contractor-list-view.ts`, Zustand `persist`, localStorage `contractor-list-view`; in-page switcher + Settings select write the same store). Calm operational treatment — no glow tiles / TiltCard; clicks write the shared nuqs filter state. Wiki: [[structure/web-vite-domains]]
- Contractor detail overview redesigned: leads with compliance + financial-pulse widgets (`contractor-profile/overview/`), reference fields demoted to a collapsible. i18n `Contractors.insights.*` / `ContractorProfile.overview.widgets.*` / `Settings.contractorListView.*` in en/de/pl/ar.

## 2026-07-05 — Public API keys, scopes, rate limits + the write surface (Theme C, double-dark)

- API-key **actor model**: `OrganizationApiKey` gains a mutable, membership-guarded `actingUserId` (attribution FK, surfaced as `ctx.apiKeyActingUserId`) + rotation columns (`supersededAt`/`supersededByKeyId`/`graceExpiresAt`) + an `ApiKeyIpEvent` source-IP log, in one reversible migration (apply deferred). `sourceIp`/`userAgent` threaded from the Hono boundary into ctx.
- **6 write entities** (contractors/invoices/payments/paymentRun/workflows/workflowTasks) added to `publicApiRouter` under `apiKeyTenantProcedure`, each with a mandatory `requirePermission` scope (BFLA), a `.strict()` DTO, and a uniform `API_KEY`+sourceIp/UA+`metadata.actingUserId` audit via `routers/public-api/write-shared.ts`; FK-creates fill the non-null user FK from the actor. Hidden `hide:true` Hono routes. **compliance_document.create + standalone payment.create + payout-init deferred.**
- **Rotation-with-grace**: `apiKeyRouter.rotate` (default 24h / max 168h); grace-aware `resolveByPrefix`. **Per-tier monthly quota**: `enforceApiTierQuota` + `api-quota-counter` + `api-tier-limits` (Starter 1k/Pro 10k/Ent ∞), composing with the pre-auth burst limiter.
- **Developer page** (web-vite): source-IP log, scope visualization, acting-user rebind, rotation dialog, usage vs quota. Backend `apiKeyRouter.ipLog` + `usage`.
- Everything stays **double-dark** (`module.public-api` off + `hide:true`); the flag flip is Phase 100. Wiki: [[domains/public-api-surface]], [[patterns/rate-limit]], [[patterns/tenant-and-audit]], [[patterns/rbac-permissions]], [[structure/key-services]], [[structure/api-routers-catalog]]

## 2026-07-01 — US Classification Determination Letter (deterministic PDF)

- New `pdf-templates/us-determination-letter.tsx`: deterministic React-PDF letter (no LLM) mirroring `ir35-sds` — verdict pill (employee=destructive / indeterminate=warning / independent-contractor=success), federal common-law factor tally + evidence questions from the frozen snapshot, CA-AB5 amber chip (never red) + §530 info-blue chip + statute citations, `SOFTWARE_NOT_LEGAL_ADVICE_EN` locked footer. Byte-stable via pinned Document creation/modification dates. `classificationDocument.generateUsDeterminationLetter` (staff-only, us-expansion gated) enqueues the async export; `renderDeterminationLetterPdfBuffer` archives an append-only `US_DETERMINATION_LETTER` ClassificationDocument with `ruleSetVersion` frozen from the assessment + `writeAuditLog({action:'classification.determinationLetter.generate'})`. Wiki: [[domains/classification-ir35]], [[structure/api-routers-catalog]]

## 2026-07-05 — Leave + KP-grade employee time (staff/manager UI)

- New domain [[domains/leave-and-time]] over the merged Theme-B backend: append-only leave ledger + balance (`leave-balance.ts`), `LEAVE_REQUEST` on the generic approval chain (two seams: `routeToLeaveChain` + shared resourceType-gated approve/reject) + direct sick, day-grain `EmployeeTimeRecord` with a NON-blocking sync `checkWtLimits`, the region-fan-out `runWtLimitScan` daily digest, and the INSERT-only DB-immutable `EwidencjaSnapshot` (`app.reject_ewidencja_update`). Structure catalogs updated: workforce namespaces 3→6 ([[structure/api-routers-catalog]]), 4 services ([[structure/key-services]]), leave/employee-time/ewidencja + `PublicHoliday` schema areas ([[structure/prisma-schema-areas]]), WT-limit daily scan ([[structure/cron-jobs]]).
- web-vite UI (`apps/web-vite`): `/leave` register + balance-after side-panel anchor + Record-sick dialog; `/leave/calendar` month/quarter capacity + conflict grid (local primitives + div grid, 44px cells, RTL-mirrored, keyboard nav — `team-calendar.test.tsx` GREEN); `/employee-time` day-grain entry + 3 KPI cards + non-blocking on-save WT banner; `/employee-time/ewidencja` KP §149 register over `DataTable` with the ImmutableBadge anchor + supersede-chain sub-rows + AlertDialog regenerate confirm. Each: thin flag-gated page (`module.workforce-employees`) + wired section + `hooks/use-*.ts` sole tRPC boundary. `Leave`/`EmployeeTime`/`Ewidencja` i18n namespaces added at en/de/pl/ar parity (de/pl/ar machine-assisted, flagged for native review). `getEntityUrl` gains `EMPLOYEE_TIME_RECORD`/`LEAVE_REQUEST`. Wiki: [[structure/web-vite-domains]], [[domains/approvals-engine]]

## 2026-07-05 — Employee on/offboarding (Theme B, Phase 93)

- Worker-keyed employee lifecycle: `WorkflowRun`/`DeprovisioningRun` gain a nullable `workerId` (contractor/assignment FKs → nullable + defence-in-depth CHECK); the v1.0 engine, `assertRunCompletable` gate, IdP step runner/token resolver/adapters, and the pure `canStartDeprovisioning` cooldown are reused unchanged. `startRunSchema` + `startDeprovisioningRun` inputs become discriminated unions (`CONTRACTOR | EMPLOYEE`); a single exported `startWorkflowRun` helper owns the only `workflowRun.create`. The employee deprovisioning branch keys the cooldown off `EmployeeProfile.terminatedAt` + `Worker.email`; `COUNTRY_TZ` gains `US`. New `employeeLifecycleRouter` (`get`/`startOnboarding`/`startOffboarding`/`recordTermination`/`generateCert`) mounts in the existing `workforceRouters` spread. Wiki: [[domains/worker-onboarding-offboarding]], [[structure/api-routers-catalog]], [[structure/prisma-schema-areas]]
- New `@contractor-ops/employee-templates` boot-upserts 8 per-market (PL/DE/UK/US × ON/OFF) DRAFT `WorkflowTemplate` seeds on the new `@@unique([organizationId, jurisdiction, type, seedKey])`. Statutory certs: `statutory-cert-pdf.ts` (render→immutable snapshot `*Last4`-only→R2 CAS `emp-cert/<org>/<id>.pdf`) + 6 react-pdf templates on `statutory-cert-shell.tsx` with a LOCKED `CERT_ADVISER_VERIFY_*` watermark (registered PENDING, absent from messages). Five network-free gov stub seams (I-9+E-Verify, ZUS ZWUA, Abmeldung SV, HMRC RTI, PIT filing). Wiki: [[structure/key-services]]
- web-vite `employees/:workerId/lifecycle` (Page→Container→Hook→Panel); worker-keyed IdP trigger gated on `terminatedAt` (server re-runs cooldown). `EmployeeLifecycle` i18n namespace en/de/pl/ar. Migration `__phase93_worker_lifecycle` authored un-applied — per-region apply is a deferred human gate. Wiki: [[structure/web-vite-domains]]

## 2026-07-05 — Payroll export adapters (Theme B, Phase 94)

- New `@contractor-ops/payroll` package — a structural clone of `packages/einvoice`'s profile-registry engine (`PayrollExportProfile` + `PayrollFeed` DTO + registry + `PayrollExportEngine`), NOT the payment-run bank-file factory. 10 targets, all pure `PayrollFeed → {buffer,ext,mime}` golden-fixture tested: PL `symfonia` (CSV+XML)/`comarch`/`enova`, DE `datev` (Lohn ASCII, fixed 121-char + dark DATEVconnect seam)/`sage-de`, UK `rti-fps`/`rti-eps` (GovTalkMessage XML + non-throwing XSD seam), US `adp`/`gusto-csv`/`quickbooks-csv` + `gusto`/`quickbooks` native OAuth bridges. National IDs masked to last-4. Wiki: [[domains/payroll-export]], [[structure/packages]]
- `buildPayrollFeed` (`services/payroll-feed.ts`) joins `Worker`+`EmployeeProfile`+`PersonnelFile` (hire/termination anchors on PersonnelFile), org-scoped + PII-masked. `registerAllPayrollProfiles` boot hook. Gated `payrollExport` router (`listTargets`/`export`/`connectNative`) mounts in `conditionalWorkforceRouters` (METHOD_NOT_FOUND when `module.workforce-employees` off) + per-target `evaluate(payroll.*)` FORBIDDEN gate + `writeAuditLog('payroll.export')` + `fileBase64` download. New `payroll.sage-de` flag (Sage DE ≠ DATEV) → 9 `payroll.*` keys. Wiki: [[structure/key-services]], [[structure/api-routers-catalog]], [[patterns/feature-flags]]
- Gusto/QuickBooks native OAuth adapters on `packages/integrations` (`getServerEnv` creds, `GUSTO_*`/`QUICKBOOKS_*` optional) behind a DI bridge; native push is the deferred live path (CSV export is the shipping path), ADP native → v7.1. web-vite `dashboard/payroll-export` surface (Page→Container→Hook→Panel) + `PayrollExport` i18n across en/de/pl/ar/en-US. Wiki: [[structure/web-vite-domains]]

## 2026-07-05 — HRIS two-way sync: Personio + BambooHR (Theme B, Phase 95)

- Two-way HRIS sync, loop-free by a DISJOINT field partition: the pull writes ONLY the HRIS-owned allowlist (`HrisWritableEmployeePatch` — invoice/payment/classification/compliance + `*Encrypted`/`*Last4` keys are physically absent from the type); the push carries ONLY CO-owned business events. `syncHash` (SHA-256, key-order-independent) makes the pull idempotent; `assertNotHrisOwnedField` guards every push. New `packages/api/src/services/hris-sync/` (field-partition, sync-hash, mapping, apply-patch, pull-orchestrator) + `runHrisPull`/`runScheduledHrisSync` clone the directory-sync orchestrator (IntegrationSyncLog INBOUND + `sync` advisory-lock + configJson snapshot). Wiki: [[domains/hris-sync]]
- Correction C1: `invoice.paid` was NOT an outbox event type — added THREE `hris.*.push` types + handlers (`outbox/hris-push.ts`, `hris-push-target.ts`) + wired 3 EMPLOYEE-guarded producers (`payment-run-ops.updateItemStatus`, `classification-submit.submit`) that enqueue inside their `$transaction` (never inline). Adapters: `PersonioAdapter` (non-OAuth client-credentials bearer, `/v2/persons` offset≤200 under a ≤200/min limiter) + `BambooHrAdapter` (OAuth 2.0, un-paginated directory, `BAMBOOHR_CUSTOM_ATTR_VERIFIED`-gated custom attrs), HEAVY-tier registered. Wiki: [[integrations/personio]], [[integrations/bamboohr]]
- One HRIS per org = raw-SQL PARTIAL unique index (`provider::text IN ('PERSONIO','BAMBOOHR')`, C2/C3); `IntegrationProvider += PERSONIO, BAMBOOHR`. Flag-gated `hrisSync` router (connect XOR / disconnect / syncNow / mapping) mounted dark in `conditionalWorkforceRouters`; hourly `hris-sync` cron; web-vite settings surface + `HrisSync` i18n (en/en-US/de/pl/ar). Live paths dark behind `integration.personio-sync`/`integration.bamboohr-sync` + `it.skipIf(!creds)`. Migration `__20260705120000_hris_two_way_sync` authored un-applied. Wiki: [[structure/api-routers-catalog]], [[structure/cron-jobs]], [[structure/prisma-schema-areas]], [[patterns/feature-flags]]

## 2026-07-05 — Employee self-service portal (Theme B, Phase 96)

- The external portal now serves a **discriminated subject** (Contractor XOR Worker). `portalEmployeeProcedure` requires `subjectType === 'EMPLOYEE'` + `module.employee-portal` and attaches `ctx.workerId` (never `ctx.contractorId`); `portalManagerProcedure` asserts ≥1 direct report. `portalEmployee` + `portalManager` are dark-mounted on `portalAppRouter` (`isEmployeePortalRegistered()`). New `portalEmployeeRouter` (leave/time/ewidencja/akta + `submitTimeOffRequest`), `portal-employee-akta.ts` (`getMyAkta` filtered to `PERSONNEL_FILE_SELF_VIEW_SECTIONS`, section C excluded IN the query; `getMyAktaDocumentUrl`; `getPayStubAvailability` → `available:false`), and `portalManagerRouter` (reports overview + leave approve/reject reusing `finalizeApprovedLeave`). Reporting-line scope in `services/portal-reports.ts` (`resolveDirectReports`/`assertIsDirectReport`). Wiki: [[domains/employee-portal]], [[structure/api-routers-catalog]], [[structure/key-services]]
- Web-vite: `/portal/employee/*` (dashboard/leave/time/documents/pay) + `/portal/employee/team/*` (overview/approvals) inside the existing portal shell; hooks under `components/portal/employee/**/hooks/` are the sole tRPC boundary; a dark surface/wrong subject degrades via `isModuleDarkError`. i18n `Portal.employee.*` + `Portal.employee.team.*` at en/en-US/de(Sie)/pl/ar parity. Wiki: [[structure/web-vite-domains]]
- Deferred: migrations `__portal_employee_subject` + `__portal_employee_actor_type` (`ActorType += EMPLOYEE`) authored un-applied; the portal SHELL bootstrap (`portal.auth.getSession`) is still contractor-only, so the employee subject is not yet reachable end-to-end — a foundational follow-up (EXTERNAL-ENABLEMENT rows 23–25). Fixed the pre-existing 96-02 `portal.test.ts` debt (magic-link mock lacked `findEmployeesByEmail`).

## Phase 101 — Theme C developer experience (2026-07-06)

- **API sandbox tier (load-bearing isolation).** `OrganizationApiKey.environment` (`LIVE`|`SANDBOX`) + `Organization.isSandbox`: a `co_test_` key resolves ONLY to a sandbox org, `co_live_` ONLY to a production org — `resolveByPrefix` fails closed both ways. Isolation reuses the demo read-only layer (ctx `isSandbox` → `demoReadOnly` blocks sandbox mutations; `isDemoOrg` cache for the service-layer skips). Gates on global `module.api-sandbox` + 100/day (`SANDBOX_DAILY_REQUEST_QUOTA`) instead of Enterprise + `module.public-api` (branched in one `apiKeyAccessGate`; LIVE byte-identical via extracted `assertMinimumTier`). `provisionSandboxOrg`/`issueSandboxKey`; `apiKey.createSandboxKey`. Greens `sandbox-isolation.security.test.ts`; OWASP/write-routes-dark fence unregressed. Wiki: [[domains/developer-experience]], [[domains/public-api-surface]], [[structure/key-services]].
- **Public status page.** `/v1/status.json` (`routes/status.ts`, unauthenticated, `module.public-status-page`-gated, cached) → `status-aggregator.ts` maps the shipped health sources (webhookDelivery + outboxEvent thresholds) into 3 coarse component states + open-incident history; timeout-guarded, fail-safe, NO tenant data. `IncidentReport` model + `incident` router (`admin:marketplace`-gated, audited `INCIDENT`). Greens `status-page.test.ts`.
- **Developer portal.** Extends the Scalar `/v1/docs` with `/docs/{webhooks,sdks,recipes,changelog,deprecations}` + `/collections/{postman,insomnia}.json`, behind `module.developer-portal` (404 off). `portal-content.ts` sources every page from the artifacts the API generates; collections generate from the live OpenAPI doc via `@contractor-ops/marketplace-manifests`. Greens `developer-portal.test.ts`; full public-api suite 123/123.
- **Deferred:** three un-applied migrations (`__phase101_sandbox_environment`, `__phase101_incident_report`, + the 101-03 `__marketplace_listing`) + three default-off flags; the web UI (plan 09) + n8n/Zapier live-SDK packages (plans 06/07). EXTERNAL-ENABLEMENT #27–34. Wiki: [[structure/api-routers-catalog]], [[structure/packages]], [[structure/prisma-schema-areas]], [[patterns/feature-flags]].
## 2026-07-05 — Storecove webhook: per-event dedup + FSM-routed status

- `webhooks/storecove.ts` now keys idempotency on `EInvoiceLifecycleEvent.providerEventId = ${guid}:${event}` (DB-unique `einvoice_lifecycle_event_org_eid_uniq`, P2002 → 200 idempotent) instead of the transmission guid alone — the guid is stable per transmission, so a transient `failed` then a real `delivered` shared it and the old guid-only check parked the lifecycle at FAILED. All status changes route through `transitionTransmission` (einvoice-lifecycle-fsm): new recovery edge `FAILED|delivery_ack → DELIVERED`; a late `failed` on a `DELIVERED` row throws `IllegalFsmTransitionError` → 200 no-op (no regression). FSM now exported via `@contractor-ops/api/services/einvoice-lifecycle-fsm`. Wiki: [[integrations/peppol]]

## 2026-07-05 — Webhook ingress dedup (providerEventId) + FAILED-delivery replay

- [[integrations/framework-core]] — the DB-unique `webhook_delivery_provider_event_uniq` was inert because `WebhookDelivery.providerEventId` was populated nowhere (NULLs never collide). `WebhookVerificationResult` gains `providerEventId`; the resend adapter returns the Svix `svix-id` (canonical per-message idempotency key); `webhooks/multi-provider.ts` persists `verification.providerEventId` on the delivery and catches P2002 → 200 idempotent so a duplicate upstream event collapses to one row. Providers with no reliable per-event id (e.g. DocuSign — `envelopeId` is per-envelope and would drop distinct events) stay unset, so dedup is simply off there.
- QStash publish failure at ingress now leaves the row `RECEIVED` (error on `lastError`), NOT `FAILED` — the `job-health` reaper only replays `RECEIVED`/`PROCESSING`, so the previous FAILED flip parked publish-failed rows forever; `FAILED` is reserved for terminal reaper exhaustion. The reaper is unchanged.

## 2026-07-05 — OCR callback idempotency: CAS claim + dedup id

- [[domains/documents-and-ocr]] — **INT-1-6**: `processOcrExtraction` opened with an unconditional `ocrExtraction.update({ status: 'PROCESSING' })` and the QStash publish carried no `deduplicationId`, so a callback redelivery re-ran the Claude Vision extraction (double spend) and clobbered a completed `resultJson` back to `PROCESSING`. The status transition is now a compare-and-swap: `updateMany({ where: { id, status: 'PENDING' }, data: { status: 'PROCESSING' } })` with an early return when `count === 0` — a redelivery of any non-PENDING row (EXTRACTED/FAILED/SKIPPED/in-flight PROCESSING) claims nothing and does no work. `triggerOcrExtraction` also sets a stable `deduplicationId` (`ocr-extraction:<id>`) as first-line dedup. Credits stay single-deducted at trigger. Retriggers create a fresh PENDING row, so re-runs are unaffected. Tests: CAS-claim shape + redelivery-abort (no extraction) added to `ocr-extraction.test.ts`. `pnpm typecheck --filter=@contractor-ops/api` GREEN.

## 2026-07-05 — E-sign completion: idempotent + fail delivery on retriable errors

- [[integrations/docusign-esign]] — **INT-1-4**: `handleSigningCompletion` created a fresh signed `Document` + `DocumentLink` on every call (redelivered "completed" webhook → duplicate signed doc), and `webhooks/process.ts` swallowed all completion errors while still flipping the delivery `PROCESSED` (an R2 outage → signed PDF never saved, no retry). (a) Completion is now idempotent — guarded on the `SIGNED_PDF_SAVED` `SigningEvent` (written in the same tx as the Document/link); a redelivery returns the existing signed Document (contract-linked) or `null` without re-downloading or duplicating. (b) `handleSigningCompletion` throws typed `EsignCompletionError { retriable }` (R2/network = retriable, missing-external-id = permanent); the drain **rethrows retriable** (delivery → FAILED + 500 → QStash/reaper retry) and **swallows permanent** (→ PROCESSED, Sentry). Because a retry's webhook dedups to `completed=false`, the drain re-drives completion via `isSignedCopyPending` (COMPLETED envelope with no SIGNED_PDF_SAVED). **Envelope-before-tx:** DocuSign's `X-DocuSign-Idempotency-Key` is deterministic per (org, document fingerprint, signer-set) so the send path is retry-safe; **Autenti has no idempotency key** — a durable fix needs an intent/outbox record (flagged, no migration authored). Tests added to `esign-url-and-completion.test.ts` (idempotent redelivery) + `process-webhook.test.ts` (retriable→FAILED/500, permanent→PROCESSED, retry re-drive). `pnpm typecheck --filter=@contractor-ops/api --filter=@contractor-ops/api-server` GREEN.

## 2026-07-05 — cron-worker runner hardening (overlap/timeout/lock/persist/staleness)

- [[structure/cron-jobs]] — **INT-1-2**: 12 of 13 cron jobs were unguarded (`void runJob(...)`, no timeout, no replica protection, in-memory last-success wiped on restart, missed ticks never caught up). Fixed **once in the runner** (`apps/cron-worker/src/jobs/runner.ts`), not per handler: (a) in-process overlap guard (`Set` of in-flight job names; second concurrent tick skipped + WARN, `cron.tick.skipped_overlap`); (b) `Promise.race` timeout on per-job `maxMs` (registry static meta `jobs/job-meta.ts`, default `CRON_JOB_DEFAULT_MAX_MS`=5 min) → Sentry `cron.outcome=timeout`; (c) per-tick `pg_try_advisory_xact_lock('cron', jobName)` held for the handler by keeping its tx open while the handler runs on separate pool connections → second replica skips (`cron.tick.skipped_locked`); reminders self-locks on a distinct `cron:reminders` key so no collision. (persist) runner upserts `CronJobRunState` (`lastRunAt` each run, `lastSuccessAt` on success); `runStartupCatchUp` re-runs must-run daily jobs (`catchUpOnBoot`) whose persisted last-success predates one interval. (e) `job-health.ts` now reads every `CronJobRunState` row and fires Sentry `alert.type=cron_job_stale` when `now - (lastSuccessAt ?? createdAt) > 2 × interval` (`CRON_JOB_INTERVALS_MS`), keeping the existing `WebhookDelivery` reaper. New env `CRON_JOB_DEFAULT_MAX_MS` (`.env.example` + `apps/cron-worker/src/env.ts`). Tests: overlap-skip, advisory-lock-skip, timeout, persistence, boot catch-up (`runner.test.ts`), stale-job alert (`job-health.test.ts`). `pnpm typecheck --filter=@contractor-ops/cron-worker` GREEN. (Pre-existing unrelated failure: `gc-provenance.test.ts` — reminders empty-`{}` tx mock, not touched here.)

## 2026-07-06 — Prisma: SigningEvent completion backstop + InvoiceInterestClaim note + migration replay health

- [[structure/prisma-schema-areas]] — Review-fix follow-up (reviewer M3/LOW + replay-health). **FIX-A (M3):** `SigningEvent` gains a partial UNIQUE `signing_event_signed_pdf_saved_key` on `(signingEnvelopeId) WHERE eventType = 'SIGNED_PDF_SAVED'` (migration `20260705150000_signing_event_signed_pdf_saved_unique`) — makes the e-sign completion-idempotency guard (INT-1-4) atomic under concurrent webhook redelivery; the second writer is rejected P2002-as-idempotent (no duplicate signed `Document`). Service-side P2002 catch is a separate change set. **FIX-B (LOW):** `InvoiceInterestClaim @@unique([invoiceId])` stays a FULL unique — the model has no void/withdraw status column, so a partial "one ACTIVE claim" predicate is not yet expressible (documented in-schema; do NOT invent a column). **FIX-C (replay health):** `prisma migrate diff --from-migrations` (and `migrate deploy` / `db:migrate:all`) now apply the full history cleanly. Ordering: the four `__`-prefixed manual-gate migrations (Prisma sorts un-timestamped names FIRST, before `baseline`) re-timestamped `20260705160000..160003` in dependency order; `20260428000000_phase_73_...` re-dated `20260512000001` (it depends on the May-12 baseline). Missing CREATE migrations authored for db-push-only tables (the T0-6 "relation does not exist" class): gulf (`20260705160004_gulf_domain`), ewidencja (`20260630000000_ewidencja_snapshot`, before its `20260701000000_ewidencja_append_only` hardening), working-time/leave/reference (`20260705160005_working_time_leave_domain`). Also closed a pre-existing gap: `Worker_organizationId_fkey` (schema declared it, worker-base migration omitted it). **Remaining (out of scope, reported):** a large pre-existing accumulated db-push drift the replay diff now surfaces (additive enum variants + columns on ~10 tables, plus structural searchVector generated-column / PK / index-rename / unique / FK changes on ~8 baseline-era tables) — the drift check stays exit-1 until reconciled, so the CI gate is NOT yet flippable to a hard gate. `pnpm typecheck --filter=@contractor-ops/db` GREEN; `db:check-drift` (generated client) GREEN.

- 2026-07-08: Classification answer envelope fix (C-25/C-26) — Zod normalises to `{ value }` / `{ rawScore }`; submit uses `normalizeAnswerMap`; round-trip tests per profile.

- **2026-07-10** Pack3 classification MED/LOW: date-driven compliance payment gate + export snapshot; reassessment `acknowledge` CAS; IR35 reorder tx + participant assignment guard; attestation P2002 recovery; `createAmendment` count-in-tx; contractor `countryFields` validated against contractor country; `recreateComplianceAssessment` generic error code.

- **2026-07-10** [[integrations/ksef]] — FA(3) round-trip hardening: outbound `generateFa3Xml` now emits `P_11A` = gross + `P_11Vat` = VAT (was: VAT into the gross field); inbound parser gains a VAT sign guard — `P_11A − P_11` with a sign contradicting the net (legacy VAT-in-gross emitters) falls back to the `P_12` rate instead of ingesting negative VAT; KOR all-negative correction lines still pass. Kirchensteuer legacy boolean now exports **blank + warn** in DATEV/Sage (never a guessed confession code). Import commit savepoints RELEASEd per row. `CROSS-ORG-AGGREGATE` grep tag de-breadcrumbed in `economic-dependency-scan.ts`.

- **2026-07-10** Go-prod hardening sweep — [[structure/cron-jobs]] + [[integrations/peppol]]: new `peppol-reconcile` cron (`*/15`, `CRON_PEPPOL_RECONCILE_SCHEDULE`) re-enqueues lost `peppol.outbound` jobs via region fan-out + idempotent `maybeEnqueuePeppolOutbound` (now returns whether it enqueued). [[integrations/zatca]]: `resolveZatcaLineTax` letter codes `Z`/`E` now carry `cbc:Percent 0` (BR-Z-05/BR-E-05), `O` omits it. [[domains/equipment-logistics]]: `shouldApplyShipmentStatusUpdate` allows FAILED → OUT_FOR_DELIVERY/DELIVERED/RETURNED (courier retry / return-to-sender), DELIVERED/RETURNED immutable, + guard unit tests. Import-cycle cuts (biome.ci `noImportCycles` now clean): `errors-registry.ts` (errors.ts self-import), `outbox/handler-types.ts` (handlers↔hris-push), `compliance-reminder-reset.ts` (recovery↔reminder-scan↔free-zone), `teams/conversation-reference.ts` (messaging↔bot-handler↔approval-shared SCC). Six hardcoded TRPCError messages → constants + 4-locale keys (`documentScanPending`, `ir35AttestationAlreadyExists`, `lateInterestWaiverNotFound`, `payrollFeedEmpty`, `whtCertificateNumberConflict/IssueFailed`). 65-site breadcrumb-comment sweep; web-vite table-pattern conformance (shadcn Table in `batch-summary` + `settings/webhooks`, renames to `data-table.tsx`); 7 developer-portal routes added to the webhook-route contract; 4 silent-catch annotations; `entityIdSchema` at 4 routers. **Full `lint:ci` green end-to-end.**

## 2026-07-10 — Go-prod deep-audit fixes (active-path security, perf, rate-limits, UI error states)

- **Leak closures.** [[domains/payments-and-bank-files]]: payment-run export idempotent-replay branches re-select the safe response shape (staff `finance/payment-export-router.ts` `lockAndExport` + public-api `payment-run.ts` via `paymentRunSelect`) — the raw row carried bank-field ciphertext + contractor taxId; SEPA settings audit writes `fieldsUpdated` names only (at-rest encryption of settingsJson SEPA fields = backlog); org-bank UI gains error panel / translated toasts / `orgBankCannotClear` clear-block. [[domains/contractors-engagements]]: `contractor.list` `omit:{ssnEncrypted:true}`. [[domains/tax-and-wht]]: WhtCertificate `list`/`get` gated `payment:['read']`; WHT hook toasts `translateError`. [[integrations/ksef]]: `connect`/`connectionStatus` omit `credentialsRef`+`connectedByUserId`. [[integrations/docusign-esign]]: send path org-scopes `connectionId` via `loadIntegrationConnection` (cross-org IDOR closed). [[domains/public-api-surface]] + [[integrations/sentry]]: ≥500 responses carry generic bodies in prod on both the public-api error handler and the plain-Fastify handler in `apps/api/src/plugins/sentry.ts` (tRPC formatter already stripped INTERNAL).
- **Active-path integrity.** [[domains/documents-and-ocr]]: ClamAV scans the FULL object (un-ranged GetObject); the 4KB ranged read is MIME-sniff only; `use-upload-review.ts` toasts translated `documentScanPending`/`documentInfected`. [[domains/hris-sync]]: token-refresh claim moved before try/finally (lost claim can't clear the winner's `refreshLockedAt`), refresh no longer stamps `lastSyncAt`/`lastSuccessAt` (hourly-sync throttle fields), adapters without a refreshToken handler skipped (no false REAUTH_REQUIRED). [[domains/outbound-webhooks]]: CSRF-origin `EXEMPT_PREFIXES` += `/webhooks-outbound/`, `/contract-health/`, `/idp-deprovisioning/` (QStash callbacks send no Origin; `/webhooks/` doesn't prefix-match).
- **Perf/tx bounds.** [[domains/onboarding-and-import]]: import commit tx `{timeout:120s,maxWait:10s}`; row-failure logs classified `err.name` only (PrismaClientValidationError embeds the raw PII row). [[domains/leave-and-time]]: 120s tx on all three leave-finalize paths (`core/approval-queue.ts`, `core/approval-shared.ts`, `portal/portal-manager-router.ts`); `use-ewidencja.ts` drops static errorMessage override. [[domains/classification-ir35]]: DE economic-dependency scan constant 4 queries/assignment (one peer `findMany` + one `invoice.aggregate`); attestation hook invalidates via `pathFilter()`. [[integrations/peppol]]: reconcile covered-set = NOT EXISTS anti-join + ACTIVE-participant precondition (no bind-param ceiling, no take-50 starvation).
- **Rate limits.** [[domains/employee-portal]]: portal tRPC on strict `portalLimiter` 10/min (`usesPortalLimiter()`); `requestMagicLink` 5/15min per hashed email fail-closed (`middleware/magic-link-rate-limit.ts`); `portalSubjectRateLimitMiddleware` 10/min/subject on portal OCR trigger + `getPortalSigningUrl`; 4-locale rate-limit copy.
- **Cron observability.** [[structure/cron-jobs]]: `job-meta.ts` entries for `hris-sync`/`api-key-leak-alarm`/`year-end-1099-reminder` (meta-less jobs are invisible to the staleness alert); `job-health` gauges cross-region terminal-FAILED outbox backlog (`jobs.outbox.failed_backlog`, Sentry alert >10). [[domains/payroll-export]]: `PAYROLL_FEED_*` errors are registry constants with `cause.params` + 4-locale keys (prefix-parameterized strings can't translate client-side). [[domains/approvals-engine]] + [[domains/compliance-dashboard]]: compliance-held + country-compliance sections render inline error states (null-on-error looked like empty data).
- Gates: full `lint:ci` EXIT 0; api suite 4433 green; web-vite scoped 1220+650+767 green + typecheck; cron-worker typecheck + `job-health.test.ts` 8/8. Tracker: `.planning/reviews/go-prod-deep-audit-2026-07-10.md` (all findings ✅/📦, GO verdict).

## 2026-07-17 — Outbound-webhook producers wired (v7.0 milestone-audit BLOCKER #1)

- **Producer fan-in.** [[domains/outbound-webhooks]]: `enqueueWebhookEvent` had zero callers — the whole P100 engine + P101 marketplace/n8n/Zapier triggers delivered nothing once `module.outbound-webhooks` was granted. All 16 catalog types now emit from the domain mutation that owns each transition, inside that mutation's `$transaction` (durable-iff-commit). Shared helpers emit once and cover every caller: `finalizeApprovedInvoice` (invoice.approved, single+bulk), `applyInvoicePaymentOutcome` (invoice.paid, all settlement sources), `autoCompleteRunIfTerminal` (payment_run.completed), `advanceFlow` (contractor.compliance_blocked). `unblockDependentsAndRecomputeRun` now returns `runCompleted` so workflow.completed fires from every completion caller (staff + public-api). `contractor.update` was wrapped in a tx so its emit is durable. The reminder cron (compliance_doc.{expiring_soon,expired}) has no `$transaction` seam — the emit sits right after the durable band-state write and inherits the once-per-band Redis dedup. Seam test: `packages/api/src/__tests__/webhook-producer-emit.test.ts` (real mutation → real producer → real `integration.webhook.publish` outbox row, no mock on the far side).
