# Facts — Comprehensive Dev Seed

## Scope & invariants

- `packages/db/scripts/seed-dev.ts` is the single entry point that produces dev/test data; no new top-level scripts are introduced.
- The script continues to refuse to run when `NODE_ENV=production` or when `DATABASE_URL` host falls outside the `SEED_DEV_ALLOWED_HOST` allowlist.
- The script keeps all existing CLI flags (`--profile`, `--orgs`, `--seed`, `--regions`, `--confirm`, `--append`, `--progress`, `--help`) and adds **one new flag**: `--omit=<section>,<section>,...` (see "Section omit flag" below).
- All existing behaviors of the `empty`, `solo`, `small`, `medium`, `huge`, `showcase`, and `all` profiles continue to work end-to-end without regression.
- Faker output remains deterministic for a given `--seed`. Row IDs and timestamps continue to use `crypto.randomUUID()` + `Date.now()` (matches current documented behavior).
- Every newly seeded model is also added to `WIPE_TABLES_IN_ORDER` in dependency-safe order so `--confirm` reseed leaves no orphaned rows; missing-table failures (`42P01`) continue to be tolerated via the existing `SAVEPOINT` pattern.
- The `prisma/seed/index.ts` runner (production reference data: `TaxRate`, `WithholdingTaxRate`, `BoEBaseRateHistory`) is **not** changed.

## Coverage — every tenant model gets seeded

After this change, every model under `packages/db/prisma/schema/*.prisma` that is part of the tenant surface has at least one row created by `seed-dev.ts` for any non-`empty` profile. The list below is exhaustive against the current schema; models marked "already seeded" stay covered by current code.

### Already covered (no change required)

`User`, `Member` (nested in `Organization.create`), `Organization`, `Team`, `Project`, `CostCenter`, `Invitation`, `Contractor`, `ContractorContact`, `ContractorBillingProfile`, `ContractorAssignment`, `ContractorTag`, `ContractorTagLink`, `ContractorComplianceItem`, `Contract`, `ContractRatePeriod`, `ContractAmendment`, `Invoice`, `InvoiceLine`, `InvoiceFile`, `InvoicePayment`, `ApprovalChainConfig`, `ApprovalFlow`, `ApprovalStep`, `ApprovalDecision`, `PaymentRun`, `PaymentRunItem`, `PaymentExport`, `ReminderRule`, `ReminderInstance`, `Notification`, `UserNotificationPreference`, `Comment`, `OutboxEvent`, `WebhookDelivery`, `AuditLog`, `Equipment`, `EquipmentAssignment`, `Shipment`, `ShipmentEvent`, `ReturnRequest`, `CourierConfig`, `EInvoiceLifecycle`, `EInvoiceLifecycleEvent`, `PortalSession`, `IntegrationConnection`, `Document`, `Subscription`, `OcrCreditLedger`, `WorkflowRoleTemplate`, `WorkflowRoleTaskTemplate`, `WorkflowRun`, `WorkflowTaskRun`, `ComplianceRequirementTemplate`.

### Newly seeded — workflow

- Each org gets a canonical hardcoded set of `WorkflowTemplate` rows: at minimum **Onboarding**, **Offboarding**, **Contract Renewal**, **Compliance Review**, **Document Collection** (one per `WorkflowTemplateType` enum value, plus one `CUSTOM`).
- Each `WorkflowTemplate` has 5–9 `WorkflowTaskTemplate` rows with realistic `taskType`, `assigneeMode`, `sortOrder`, and one example of `dependsOnTaskTemplateId` to demonstrate task chaining.
- Existing `WorkflowRun` seeding now references real `WorkflowTemplate` rows instead of relying on an empty `findMany` (current code path silently creates zero runs because no templates exist).
- Each org has at least one `WorkflowRun` per status across `NOT_STARTED`, `IN_PROGRESS` (with partial task completion), `COMPLETED`, `BLOCKED`, `CANCELLED` (and `OVERDUE` where the schema allows it).
- A subset of `WorkflowTaskRun` rows have at least one `WorkflowComment` and one `WorkflowAttachment` so detail pages show non-empty timelines.

### Newly seeded — tax / legal compliance (jurisdiction-aware)

- DE-resident contractors get `Statusfeststellungsverfahren` rows in mixed states (e.g. `PENDING`, `APPROVED`, `REJECTED`).
- UK-resident contractors get `Ir35ChainParticipant` and `Ir35OtherClientAttestation` rows so the IR35 dashboard renders.
- ES-resident contractors get `SdsApproval` rows (mixed states).
- A subset of contractors get `WhtCertificate` rows tied to their billing profile and a corresponding `WithholdingTaxRate` reference.
- A subset of contractors get `EconomicDependencyAlertState` rows (mix of `OK`, `WARNING`, `BREACH`) so the alerts widget shows variety.
- A subset of contractors get `ReassessmentTrigger` rows so the reassessment queue is non-empty.
- A subset of contractors get `TaxIdValidation` rows (mixed `VALID`, `INVALID`, `PENDING`).

### Newly seeded — classification

- A subset of contractors get a `ClassificationAssessment` row with at least one linked `ClassificationDocument`.
- A subset of assessments produce a `ClassificationEscalationEvent` so the escalation timeline page is non-empty.

### Newly seeded — invoice extensions

- Every seeded invoice gets a realistic `SkontoTerm` line; a subset has a corresponding `SkontoSnapshot` and `SkontoApplication` with a real applied discount.
- A subset of overdue/late invoices gets `InvoiceInterestClaim` rows; a subset of those get `InvoiceInterestCompensation` and at least one `InvoiceInterestWaiver`.
- A subset of invoices gets an `InvoiceMatchResult` row demonstrating the match outcome (matched, partial, unmatched).
- A subset of invoices is preceded by an `InvoiceIntakeRequest` row so the intake queue surface shows historical requests.

### Newly seeded — e-invoicing (per region)

- For every EU org, at least one `PeppolParticipant` row exists for the org and for a subset of contractors.
- A subset of EU invoices gets `PeppolTransmission` rows in mixed states (`SENT`, `DELIVERED`, `FAILED`, `REJECTED`); each is paired with one `PeppolCapabilityCache` row for the recipient.
- DE B2G invoices get a `LeitwegId` row attached to the recipient.
- ME-region orgs get `ZatcaInvoiceChain` rows linked to a sample of their invoices.

### Newly seeded — eSign

- A subset of contracts gets a `SigningEnvelope` with at least 1 `SigningRecipient` and 2+ `SigningEvent` rows; envelopes span states `DRAFT`, `SENT`, `COMPLETED`, `DECLINED`.

### Newly seeded — OCR / uploads

- A subset of invoices that already have `InvoiceFile` rows gets one `OcrExtraction` (with realistic JSON payload) and at least one prior `PendingUpload` row showing the upload pipeline history.

### Newly seeded — exchange rates

- For every currency pair appearing on seeded invoices/contracts (e.g. `EUR`, `USD`, `GBP`, `PLN`, `SAR`, `AED`), `ExchangeRate` rows for the previous **90 calendar days** are generated with realistic small daily drift around a stable midpoint.

### Newly seeded — consent / privacy / ops

- One `PrivacyNotice` row per active region + language combination.
- Each user gets a `ConsentRecord` row with at least one matching `ConsentEvent` (granted / withdrawn timeline).
- Each contractor gets a `ContractorNotificationPreference` row.
- Each org gets at least one `OrganizationApiKey` row (one active, one revoked) so the API-keys settings page is non-empty.
- Each user gets at least one `UserPinnedView` row so pinned-tabs UI shows seeded state.
- Sample `StripeEvent`, `GovApiAuditLog`, `IntegrationSyncLog` rows are created so admin/observability pages render.
- Marker rows for `NotificationCronDedup`, `CronScanState` are created so cron/dedup history pages are non-empty.
- A subset of contractors gets a `ContractorChangeRequest` row in mixed states.

### Newly seeded — auth surface (UI display only)

- For every active user, at least one `Session`, `Account`, and `Verification` row is created so admin "active sessions" / "linked accounts" pages render.
- A small set of `OAuthChallenge` rows is created (1 expired, 1 active) so OAuth callback debugging UI is non-empty.
- A small set of `PortalMagicToken` rows is created (1 unused, 1 redeemed, 1 expired).
- **Caveat (already documented in current code at lines 1275–1279):** these rows do **not** enable login-bypass. Better Auth signs session cookies with `BETTER_AUTH_SECRET`; manually inserted `Session` rows have no matching browser cookie. Login still requires the seeded password (printed in the final summary). The seed comment is updated to reflect that rows are now seeded for UI-display purposes only.

## Profile contract — proportional coverage

- Every newly-seeded section is gated on a per-profile size knob so:
  - `empty` continues to produce **zero** new rows in the new sections.
  - `solo` produces 0–1 rows per new section.
  - `small` produces a handful (1–5) per new section per org.
  - `medium` produces 10–30 per new section per org.
  - `huge` produces hundreds per new section per org but uses `createMany({ skipDuplicates: true })` batches so wall-clock time stays in the same order of magnitude as today.
  - `showcase` deliberately exercises **every state** of every newly-seeded model so a single org shows the full UI surface.
- The `--orgs / --users-per-org / --contractors-per-org / --invoices-per-contractor` overrides continue to work; new section sizes scale off the same per-profile config object.

## Section omit flag

- A new CLI flag `--omit=<section>,<section>,...` accepts a comma-separated list of seed-section keys; matched sections are skipped without aborting the run.
- The full list of valid section keys is documented in `--help` output and matches the section emoji map already declared in code (e.g. `contractors`, `contracts`, `invoices`, `equipment`, `payment-runs`, `reminders`, `notifications`, `outbox`, `webhook-deliveries`, `audit-logs`, `e-invoice-lifecycle`, `portal-sessions`, `integration-connections`, `invoice-documents`, `workflow-templates`, `workflow-runs`, `tax-compliance`, `classification`, `skonto`, `interest`, `peppol`, `zatca`, `esign`, `ocr`, `exchange-rates`, `consent`, `api-keys`, `auth-surface`, `pinned-views`, `cron-state`).
- An unknown section key causes the script to exit with a non-zero status **before** any DB writes occur, listing the unknown keys and the full set of valid keys.
- The script declares an explicit dependency graph between section keys (e.g. `contracts` depends on `contractors`; `invoices` depends on `contractors`; `payment-runs` depends on `invoices`; `peppol` depends on `invoices`; `workflow-runs` depends on `workflow-templates`; etc.). Omitting a parent section automatically omits every transitively dependent section.
- Before starting the wipe or write phase, the script prints a **resolved omit summary table** (using the existing `cli-table3` style already used for the end-of-run summary) listing:
  - the user-provided omit keys,
  - the additional keys that were transitively skipped because their parent was omitted (each annotated with the parent that triggered the skip),
  - the final list of sections that **will** run.
- The summary is printed in both `--progress` and `--no-progress` modes and is written through the same logger pipeline (so `--progress` mode logs it above the bar via the same `MultiBar.log()` channel already used for phase lines).
- When `--omit` is combined with `--confirm`, only the wipe targets corresponding to **actually-running** sections are truncated; tables tied to omitted sections are left untouched. (This protects developers who omit an expensive section to iterate on a different one without wiping its prior rows.)
- `--omit` and `--append` compose: `--append --omit=workflow-runs` adds rows for every other section on top of existing data and skips workflow-runs entirely.
- The `--help` text gains:
  - the new flag and its accepted values,
  - the dependency graph (rendered as a short list of `parent -> [children…]` lines),
  - an example invocation: `pnpm db:seed:dev --profile=showcase --confirm --omit=workflow-runs,esign`.
- An empty `--omit=` value is treated as "omit nothing" (same as omitting the flag).

## Determinism & safety

- Faker calls in new sections use the same per-org `Faker` factory pattern (locale-tagged) already established in the file.
- New seeding helpers are pure functions of `(faker, orgContext, refs)`; they do not read process state besides the existing `prisma` client.
- The `wipe-tables-in-order` list is updated atomically with the new sections; CI typecheck (`pnpm run typecheck`) and the existing `vitest` suites continue to pass.
- The script remains a single executable file (no new packages added). Seed helpers may be split into `packages/db/scripts/seed-dev/*.ts` modules **only if** the file would otherwise grow past ~7,000 lines; otherwise everything stays in `seed-dev.ts`.

## Observability & developer UX

- The existing pretty-logger pipeline is reused; each new section logs a phase line via the existing reporter so `--no-progress` mode shows the new phases and `--progress` mode counts them in the bar.
- `PHASES_PER_ORG` is updated to reflect every new `reporter.tick()` call so the progress bar reaches 100%.
- The header help block (`--help`) is updated to enumerate the new sections in the "What it produces" list.
- The end-of-run summary (the existing CliTable3 printout) gains rows for the newly-seeded models so a developer can verify counts at a glance.

## Out of scope

- The production seed runner `prisma/seed/index.ts` and its data files (`tax-rates.ts`, `wht-rates.ts`, `boe-base-rate-history.json`) are **not** modified.
- No changes to Prisma schema or migrations.
- No changes to any tRPC router, app code, frontend, or environment files.
- Seeding of background-job runtime state (queue rows, BullMQ job records, etc.) is out of scope.

## Done condition

- `pnpm db:seed:dev --profile=showcase --confirm` finishes without error against an empty dev DB and produces ≥1 row for every model listed above.
- `pnpm db:seed:dev --profile=showcase --confirm` followed by another identical invocation produces the same row counts (idempotent under wipe + reseed).
- `pnpm db:seed:dev --profile=huge --confirm` finishes within roughly the same wall-clock window as today (no new section adds more than ~20% to total runtime).
- `pnpm run typecheck` and the existing seed-related vitest suites pass.
- A spot-check pass through the dev frontend on the seeded showcase org shows non-empty UI for: workflow templates list, workflow runs board, IR35 dashboard, Statusfeststellungsverfahren list, ZATCA dashboard, Peppol transmissions, Skonto applications, exchange-rate history chart, consent log, API keys page, signing envelopes list.
- `pnpm db:seed:dev --profile=showcase --confirm --omit=workflow-runs,esign` finishes successfully, prints the resolved omit summary table at the start, and produces zero rows for every model belonging to those two sections (and any sections transitively dependent on them) while every other section is fully populated.
- `pnpm db:seed:dev --profile=showcase --confirm --omit=contractors` exits successfully, the omit summary explicitly lists every dependent section that was skipped (`contracts`, `invoices`, `payment-runs`, `peppol`, etc.), and the final DB has zero contractor-derived rows.
- `pnpm db:seed:dev --profile=showcase --confirm --omit=does-not-exist` exits non-zero **before** any DB write occurs and prints the unknown key plus the list of valid keys.
