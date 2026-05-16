# Plan — Comprehensive Dev Seed

## Solution approach

Extend `packages/db/scripts/seed-dev.ts` with new seed sections covering every previously-skipped tenant model, plus a new `--omit=<keys>` CLI flag with transitive dependency expansion. The script remains a single file; helpers stay co-located. Seeding is gated by per-profile size knobs and per-section toggles. The wipe table list is updated atomically with the new sections. The pre-existing `PHASES_PER_ORG` drift (18 declared / 20 actual) is corrected as part of this work. Reuse the canonical `OFFBOARDING_TEMPLATE_SEEDS` from `packages/offboarding-templates/src/seeds.ts` for any role-template path that does not already pull from it (current code keeps a parallel `WORKFLOW_ROLE_SEEDS` inline; we leave that path alone but the new `WorkflowTemplate`/`WorkflowTaskTemplate` seeding is built fresh from a hardcoded canonical set as agreed in facts.md).

## Step plan

Steps run in dependency order. Each step lists touched files, what to do, and how to verify. Atomic-commit boundaries are noted with `[commit]`.

### 1. Section registry + dependency graph + omit flag

**Files:** `packages/db/scripts/seed-dev.ts`

- Introduce a `SectionKey` string-literal union enumerating every section (matches the keys in `PHASE_EMOJI` plus all new sections from facts.md).
- Introduce a `SECTION_DEPENDENCIES: Record<SectionKey, readonly SectionKey[]>` declaring each section's direct parents (e.g. `invoices: ['contractors']`, `peppol: ['invoices']`, `'workflow-runs': ['workflow-templates']`).
- Add a pure helper `expandOmittedSections(omitted: SectionKey[]): { resolved: Set<SectionKey>; transitively: Map<SectionKey, SectionKey[]> }` that walks the reverse-dependency graph until fixed point.
- Add a CLI flag `--omit=<csv>` to the existing `defineCommand` block (`seed-dev.ts:4748–4856`), parsed into `string[]`, validated against the `SectionKey` union with a clear `unknown section key` error printed before any DB connection.
- Add `flags.omit: readonly SectionKey[]` to `CliFlags` (line `156`).
- Add a `printOmitSummary(resolved, transitively)` helper using `cli-table3` (already imported), printed both for `--progress` and `--no-progress` modes.
- Thread the resolved omit set into `seedOrg()` so each section can early-return.
- Update `--help` to document `--omit`, valid keys, the dependency graph, and the example: `pnpm db:seed:dev --profile=showcase --confirm --omit=workflow-runs,esign`.

**Verification:**
- `pnpm db:seed:dev --help` prints the new flag, key list, dependency graph, and example.
- `pnpm db:seed:dev --profile=small --confirm --omit=does-not-exist` exits non-zero **before** opening a DB connection (verify: temporarily set `DATABASE_URL` to an unreachable host — script must still abort with "unknown section key").
- `pnpm db:seed:dev --profile=small --confirm --omit=contractors` prints an omit summary table that lists `contracts`, `invoices`, `payment-runs`, `peppol`, `workflow-runs`, etc. as transitively-skipped.

`[commit]` `feat(seed-dev): add --omit flag with transitive dependency expansion`

### 2. Sync `PHASES_PER_ORG` and add per-section gating

**Files:** `packages/db/scripts/seed-dev.ts`

- Replace the `PHASES_PER_ORG = 18` constant (`seed-dev.ts:183`) with a derived value: `Object.keys(PHASE_EMOJI).length` (or equivalent), and grow `PHASE_EMOJI` to include every new section from step 3 onward.
- Wrap each existing `reporter.tick()` call (`seed-dev.ts:4508–4560`) in a guard that bumps the bar but skips the underlying section call when the section is in the omit set.
- Confirm the progress bar reaches 100% with and without `--omit` by always emitting one `tick()` per declared section regardless of skip.

**Verification:**
- `pnpm db:seed:dev --profile=small --confirm --progress` ends with the progress bar at 100%.
- `pnpm db:seed:dev --profile=small --confirm --progress --omit=workflow-runs` also reaches 100%.

`[commit]` `fix(seed-dev): derive PHASES_PER_ORG from emoji map and gate ticks by --omit`

### 3. Seed WorkflowTemplate + WorkflowTaskTemplate

**Files:** `packages/db/scripts/seed-dev.ts`, schema reference `packages/db/prisma/schema/workflow.prisma:4` and `:26`

- Add `WORKFLOW_TEMPLATE_SEEDS: readonly { type: WorkflowTemplateType; name: string; appliesTo: EntityType; tasks: SeedTaskDef[] }[]` constant near the existing `WORKFLOW_ROLE_SEEDS` declaration (`seed-dev.ts:3895`).
- Cover every `WorkflowTemplateType` enum value: `ONBOARDING`, `OFFBOARDING`, `DOCUMENT_COLLECTION`, `COMPLIANCE_REVIEW`, `CUSTOM`. Each template carries 5–9 task definitions exercising mixed `taskType`, `assigneeMode`, `sortOrder`, plus exactly one `dependsOnTaskTemplateId` example.
- Add `seedWorkflowTemplates(prisma, organizationId, fakers, ownerUserId)` that creates `WorkflowTemplate` then a `createMany` for `WorkflowTaskTemplate` per template (resolving `dependsOnTaskTemplateId` after both inserts).
- Update the existing `seedWorkflowRuns()` block (`seed-dev.ts:4171–4290`) so it now finds non-empty templates (no schema change; just data).

**Verification:**
- Reset DB → `pnpm db:seed:dev --profile=showcase --confirm`.
- Query: `SELECT type, COUNT(*) FROM "WorkflowTemplate" GROUP BY type;` returns at least one row per `WorkflowTemplateType`.
- Query: `SELECT COUNT(*) FROM "WorkflowTaskTemplate";` returns ≥ 5 × template count for the showcase org.
- `WorkflowRun` row count for the showcase org is non-zero (was zero before).

`[commit]` `feat(seed-dev): seed WorkflowTemplate + WorkflowTaskTemplate to unblock WorkflowRun`

### 4. Seed WorkflowComment + WorkflowAttachment

**Files:** `packages/db/scripts/seed-dev.ts`, schema reference `packages/db/prisma/schema/workflow.prisma:181,199`

- After the `WorkflowTaskRun` createMany (`seed-dev.ts:4306`), pick a deterministic subset of runs (driven by `fakers.org`) and add 1–3 `WorkflowComment` rows and 0–2 `WorkflowAttachment` rows per chosen run.
- Comments use `fakers.org.lorem.sentence`; attachments use synthetic `fileKey` paths.

**Verification:**
- `SELECT COUNT(*) FROM "WorkflowComment";` ≥ 1 for showcase org; same for `WorkflowAttachment`.

`[commit]` `feat(seed-dev): seed WorkflowComment + WorkflowAttachment for run timelines`

### 5. Seed jurisdiction-aware tax/legal compliance

**Files:** `packages/db/scripts/seed-dev.ts`, schema files `tax.prisma`, `classification.prisma`

- Add `seedTaxCompliance(prisma, org, contractors, fakers)`:
  - For each DE contractor: optionally a `Statusfeststellungsverfahren` row (mixed states from enum).
  - For each UK contractor: `Ir35ChainParticipant` and `Ir35OtherClientAttestation` rows.
  - For each ES contractor: `SdsApproval` rows in mixed states.
  - For a sampled subset of all contractors: one `WhtCertificate` row tied to its billing profile (cross-reference an existing `WithholdingTaxRate` already seeded via prisma/seed).
  - For the same subset: one `TaxIdValidation` row in mixed states.
  - For a sampled subset: `EconomicDependencyAlertState` rows (mix of OK/WARNING/BREACH).
  - For a sampled subset: `ReassessmentTrigger` rows.
- Run order respects FK direction (contractors first, billing profiles before WhtCertificate, etc.).

**Verification:**
- DE-region showcase org has ≥ 1 row in `Statusfeststellungsverfahren`.
- UK-region showcase org has ≥ 1 row in `Ir35ChainParticipant` and `Ir35OtherClientAttestation`.
- ES rows present for `SdsApproval`.
- `EconomicDependencyAlertState` shows all three severity values across the dataset.

`[commit]` `feat(seed-dev): seed jurisdiction-aware tax + classification compliance`

### 6. Seed classification assessments

**Files:** `packages/db/scripts/seed-dev.ts`, schema `classification.prisma:15,55,295`

- Add `seedClassification(prisma, org, contractors, fakers)`:
  - For a subset of contractors: `ClassificationAssessment` row + 1–3 `ClassificationDocument` rows.
  - For a smaller subset of those assessments: a `ClassificationEscalationEvent` row.

**Verification:**
- `SELECT COUNT(*) FROM "ClassificationAssessment";` ≥ 1 per non-empty org.
- Every assessment with an escalation event has a matching `ClassificationDocument`.

`[commit]` `feat(seed-dev): seed ClassificationAssessment with documents and escalations`

### 7. Seed invoice extensions: Skonto + Interest + MatchResult + IntakeRequest

**Files:** `packages/db/scripts/seed-dev.ts`, schemas `financial.prisma:26,51,67`, `invoice.prisma:125,199,297,317,335`

- Inside (or immediately after) the existing invoice loop (`seed-dev.ts:4523` reporter line):
  - For every invoice: create one `SkontoTerm` row matching the invoice's terms (e.g. 2%/10 days, net 30).
  - For a sampled subset: create a `SkontoSnapshot` row and one `SkontoApplication` row showing the discount actually applied.
  - For overdue invoices (those past due date in the existing seed logic): create an `InvoiceInterestClaim` row.
  - For a smaller subset of the above: create one `InvoiceInterestCompensation` and one `InvoiceInterestWaiver`.
  - For a sampled subset of all invoices: create an `InvoiceMatchResult` row (states `MATCHED`/`PARTIAL`/`UNMATCHED`).
  - For a sampled subset of invoices: create one preceding `InvoiceIntakeRequest` row (intake → invoice transition).

**Verification:**
- For showcase org: `COUNT(*) FROM "SkontoTerm"` equals `COUNT(*) FROM "Invoice"` for that org.
- `SkontoApplication` count > 0 and < `SkontoTerm` count.
- `InvoiceInterestClaim` count > 0 for showcase org.
- `InvoiceMatchResult` rows distributed across all status enum values.

`[commit]` `feat(seed-dev): seed Skonto chain, interest claims, and invoice match/intake`

### 8. Seed Peppol + Zatca + LeitwegId per region

**Files:** `packages/db/scripts/seed-dev.ts`, schemas `peppol.prisma:3,26`, `einvoice.prisma:99`, `zatca.prisma:3`

- Add `seedEInvoicingByRegion(prisma, org, fakers, invoices, contractors)`:
  - EU orgs: 1 `PeppolParticipant` for the org, plus 1 per a subset of contractors. Per EU invoice: optionally a `PeppolTransmission` row in mixed states (`SENT`/`DELIVERED`/`FAILED`/`REJECTED`); each receiving participant gets one matching `PeppolCapabilityCache` row (idempotent on `(participantId, …)`).
  - DE B2G invoices (subset where the invoice's recipient flag indicates B2G): one `LeitwegId` row attached.
  - ME (SA) orgs: `ZatcaInvoiceChain` rows for a subset of invoices.

**Verification:**
- DE-region showcase org has ≥ 1 `LeitwegId` row.
- SA-region showcase org has ≥ 1 `ZatcaInvoiceChain` row.
- EU-region showcase org has `PeppolTransmission` rows spanning at least 3 distinct status values.

`[commit]` `feat(seed-dev): seed Peppol participants/transmissions, Zatca chain, Leitweg-ID`

### 9. Seed eSign envelopes + recipients + events

**Files:** `packages/db/scripts/seed-dev.ts`, schema `esign.prisma:3,34,53`

- For a sampled subset of contracts (`Contract` already seeded): create one `SigningEnvelope` per contract, with 1–2 `SigningRecipient` rows and 2–4 `SigningEvent` rows. Envelopes span states `DRAFT`/`SENT`/`COMPLETED`/`DECLINED`.

**Verification:**
- `SigningEnvelope` row count > 0 for showcase org and spans ≥ 3 distinct status values.
- Every envelope has ≥ 1 recipient and ≥ 1 event.

`[commit]` `feat(seed-dev): seed SigningEnvelope/Recipient/Event timelines for contracts`

### 10. Seed OcrExtraction + PendingUpload trail

**Files:** `packages/db/scripts/seed-dev.ts`, schemas `ocr.prisma:5`, `portal.prisma:97`

- For a subset of `InvoiceFile` rows: insert one `OcrExtraction` row with realistic JSON payload (line items, totals).
- For a subset of those: insert a preceding `PendingUpload` row that "led" to the InvoiceFile.

**Verification:**
- `OcrExtraction` rows present and reference real `Document`/`InvoiceFile` IDs.
- `PendingUpload` rows reference real org IDs.

`[commit]` `feat(seed-dev): seed OcrExtraction history with PendingUpload precursors`

### 11. Seed ExchangeRate history (90 days, multi-pair)

**Files:** `packages/db/scripts/seed-dev.ts`, schema `exchange-rate.prisma:3`

- Compute the union of currency codes referenced by seeded invoices/contracts plus the active region defaults.
- For each ordered pair (avoiding identity), generate ~90 calendar days of `ExchangeRate` rows ending today, using a stable midpoint with small daily drift driven by `fakers.org`.
- Use `createMany({ skipDuplicates: true })` keyed on the model's natural unique constraint to make reseeds idempotent.

**Verification:**
- `SELECT DISTINCT date FROM "ExchangeRate";` returns ≥ 90 distinct dates.
- For currency pair `EUR↔USD`: 90 rows present.

`[commit]` `feat(seed-dev): seed 90-day ExchangeRate history for active currency pairs`

### 12. Seed consent / privacy / contractor extras / API keys / pinned views / cron markers

**Files:** `packages/db/scripts/seed-dev.ts`, schemas `consent.prisma:3,25,64`, `portal.prisma:39,67`, `api-key.prisma:3`, `auth.prisma:107`, `notification.prisma:116`, `classification.prisma:231`, `integration.prisma:59`, `gov-api.prisma:4`, `billing.prisma:43`

- Add a `seedComplianceOps(prisma, org, users, contractors, fakers)` helper covering:
  - One `PrivacyNotice` per active region+language combination (org-scoped).
  - For every user: `ConsentRecord` + ≥ 1 `ConsentEvent` (granted then optional withdrawn).
  - Every contractor: `ContractorNotificationPreference` row.
  - Every org: 2 `OrganizationApiKey` rows (one ACTIVE, one REVOKED).
  - Every user: ≥ 1 `UserPinnedView` row.
  - A subset of contractors: `ContractorChangeRequest` rows in mixed states.
  - Marker rows: a few `StripeEvent`, `GovApiAuditLog`, `IntegrationSyncLog`, `NotificationCronDedup`, `CronScanState` rows so observability/admin pages render.

**Verification:**
- `OrganizationApiKey` rows include both ACTIVE and REVOKED states for showcase org.
- `ConsentRecord` count == user count for showcase org.
- Frontend admin pages (API keys, pinned views, consent log) render non-empty lists.

`[commit]` `feat(seed-dev): seed consent, privacy, API keys, pinned views, cron markers`

### 13. Seed auth-surface display rows

**Files:** `packages/db/scripts/seed-dev.ts`, schemas `auth.prisma:120,138,158`, `oauth-challenge.prisma:24`, `portal.prisma:25`

- For every active user: one `Session`, one `Account`, one `Verification` row (clearly marked as seed-created via metadata).
- A handful of `OAuthChallenge` rows (1 active, 1 expired).
- A handful of `PortalMagicToken` rows (1 unused, 1 redeemed, 1 expired).
- Update the comment block at `seed-dev.ts:1275–1279` to clarify that these rows are now created **for UI display only** and explicitly document that they cannot bypass Better Auth login.

**Verification:**
- `Session` row count ≥ user count for showcase org.
- Login still works only with the seeded password (printed in the summary log).
- Browser-side: visiting a page that queries "active sessions" returns rows.

`[commit]` `feat(seed-dev): seed Session/Account/Verification/OAuthChallenge/PortalMagicToken (UI-display only)`

### 14. Update WIPE_TABLES_IN_ORDER for every new model

**Files:** `packages/db/scripts/seed-dev.ts`

- Insert every newly-seeded model into `WIPE_TABLES_IN_ORDER` (`seed-dev.ts:1000`), respecting child-before-parent FK direction.
- Where a section is omitted, its tables are also omitted from the wipe pass for that run (per facts.md).
- Keep the `SAVEPOINT` per-table pattern so a missing table on a newly-pushed schema continues to be tolerated.

**Verification:**
- Reset DB → `pnpm db:seed:dev --profile=showcase --confirm` → `pnpm db:seed:dev --profile=showcase --confirm` (twice). Row counts identical after the second run.
- `pnpm db:seed:dev --profile=small --confirm --omit=invoices` leaves any pre-existing `Invoice` rows from a prior `--profile=small --confirm` run untouched (test by seeding small once, then re-running with omit).

`[commit]` `chore(seed-dev): extend WIPE_TABLES_IN_ORDER to cover every newly-seeded model`

### 15. Update `--help` and end-of-run summary

**Files:** `packages/db/scripts/seed-dev.ts`

- Extend the docblock at the top of the file (`seed-dev.ts:1–91`) with the new section list (already partially structured).
- Extend `printSummaryTables()` (`seed-dev.ts:4587–4617`) so the org-summary CliTable3 has a row per newly-seeded model showing per-org counts.

**Verification:**
- `pnpm db:seed:dev --help` lists every section (no missing entries vs. `PHASE_EMOJI`).
- End-of-run summary table contains rows for `WorkflowTemplate`, `Skonto…`, `PeppolTransmission`, `SigningEnvelope`, `ExchangeRate`, etc.

`[commit]` `docs(seed-dev): update header help and end-of-run summary table`

### 16. CI + spot-check verification

**Files:** none (verification only)

- `pnpm run typecheck` (must pass with `tsc`, never `tsgo` — per repo memory).
- Existing seed-relevant vitest suites under `packages/db` and `packages/offboarding-templates` pass.
- Manual run: `pnpm db:seed:dev --profile=showcase --confirm` against an empty Neon dev DB; observe pretty logs.
- Manual run: `pnpm db:seed:dev --profile=huge --confirm` — confirm wall-clock stays within ~20% of the prior baseline.
- Open the dev frontend on the seeded showcase org and visit each of the spot-check pages enumerated in facts.md "Done condition".

`[commit]` (none — verification step)

## Risks & open questions

1. **Better Auth Session FK shape.** Better Auth versions differ on the exact `Session` row fields they expect. The seeded rows must match the runtime SDK's expectations or the "active sessions" UI may throw. Mitigation: read the Better Auth client config in the app to inspect the model adapter, and only seed columns the schema declares as required. If a column is required but cannot be populated meaningfully (e.g. `token`), generate a synthetic value clearly labeled `seed-only-` so it cannot be confused with a real cookie.
2. **`PHASES_PER_ORG` drift.** Pre-existing bug (declared 18, called 20). Step 2 fixes by deriving from the emoji map. If `PHASE_WEIGHTS` is still hardcoded to a stale list (`seed-dev.ts:231–250`), it must be updated in lockstep — verify the weights map covers every key in `PHASE_EMOJI`.
3. **Wall-clock regression on `--profile=huge`.** Twelve new sections × thousands of contractors per org × multiple rows per contractor risks a 2× runtime balloon. Mitigation: every new section uses `createMany` (no per-row `create`); per-section row counts scale sub-linearly under `huge` (e.g. 5–10% of contractors get tax-compliance rows, not 100%); benchmark before merging.
4. **`InvoiceMatchResult` and `InvoiceIntakeRequest` enums.** The exact enum value names (`MATCHED`/`PARTIAL`/`UNMATCHED` etc.) need to be confirmed against the schema before writing seed data — placeholder values must be replaced with the actual enum literals or Prisma will reject the inserts.
5. **DE B2G detection.** `Invoice` may not have an explicit B2G flag; `LeitwegId` seeding may need a heuristic (e.g. recipient name pattern or a small deterministic subset of DE invoices) rather than a real classifier.
6. **`OFFBOARDING_TEMPLATE_SEEDS` reuse vs. inline duplicate.** The existing `WORKFLOW_ROLE_SEEDS` (seed-dev.ts:3895) and `OFFBOARDING_TEMPLATE_SEEDS` (offboarding-templates/seeds.ts:12) are parallel implementations covering the same models. We **do not** consolidate them in this work to keep blast-radius small; flagged as a follow-up.
7. **Cross-region clients.** The `regions` Map iteration (`seed-dev.ts:4658`) must thread `--omit` into each region's seed pass uniformly so multi-region runs behave identically.
8. **`ExchangeRate` uniqueness.** Need to confirm the unique constraint shape (likely `(baseCurrency, quoteCurrency, date)`); use `createMany({ skipDuplicates: true })` with the proper conflict target so reseeds are idempotent.

## Order summary

1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16

Steps 3–13 are independent of one another after the registry from step 1 lands; if multiple developers parallelize, each can take one section. Steps 14–15 must come after all section steps. Step 16 is final.
