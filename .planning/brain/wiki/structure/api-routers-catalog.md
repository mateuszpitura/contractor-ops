---
title: API routers catalog
type: structure
tags: [structure, api, trpc, catalog]
source_commit: 52012027d6d66885d746d018d5d8db422195e2fb
verify_with:
  - packages/api/src/root.ts
  - packages/api/src/portal-root.ts
  - packages/api/src/routers/finance/tax-1099-router.ts
  - packages/api/src/routers/portal/portal-tax-1099-router.ts
  - packages/api/src/routers/compliance/classification-document.tsx
  - packages/validators/src/onboarding-import.ts
  - packages/api/src/routers/core/worker.ts
  - packages/api/src/routers/core/employee.ts
  - packages/api/src/routers/employee/employee-registry-router.ts
  - packages/api/src/routers/core/personnel-file/index.ts
  - packages/api/src/routers/finance/payment-core.ts
updated: 2026-07-01
---

# API routers catalog

> **Do not cite counts from this page alone.** Always verify `packages/api/src/root.ts` and `portal-root.ts`.

## Purpose

Complete namespace index for staff `appRouter` and contractor `portalAppRouter`. Comments copied from `root.ts` inline comments.

## Staff appRouter — always mounted (53 namespaces)

| Namespace | Summary |
|-----------|---------|
| `adminBoeRate` | Super-admin BoE base rate CRUD |
| `apiKey` | Enterprise API key management — create/list/update/revoke + **rotate** (grace window), **ipLog**, **usage**; keys bind a membership-guarded `actingUserId` |
| `bacs` | BACS Std 18 file generation |
| `organization` | Org CRUD, current org |
| `organizationDefinitions` | Nested: `team`, `project`, `costCenter` |
| `user` | list, invite, roles, deactivate |
| `settings` | org settings get/update |
| `contractor` | CRUD, lifecycle, compliance health, bulk; `insights` (list-band attention + composition rollups, filter-scoped), `financialPulse` (per-contractor money rollup) |
| `contract` | CRUD, FTS list, status, amendments |
| `document` | presigned upload/download, versioning |
| `workflow` | template CRUD, runs, tasks |
| `workflowRoles` | KT role-template CRUD + auto-selection |
| `authPermissions` | current-user permission introspection |
| `invoice` | CRUD, matching, status transitions |
| `invoiceIntake` | XRechnung/ZUGFeRD intake pipeline |
| `approval` | chains, queue, submit, bulk |
| `notification` | list, unread, preferences |
| `reminder` | reminder rules + instances |
| `integration` | Slack OAuth, mappings; `getHealth` returns `scopeCapabilities` |
| `payment` | runs, lock+export (CSV/Elixir/SEPA/BACS/SWIFT + US `ACH_NACHA`/`FEDWIRE`), bank import; opt-in `initiatePayout` (programmatic ACH, US-expansion + `payments.ach-payouts` gated); `ingestAchReturnFile` (upload a NACHA return file → flip bounced items to FAILED, US-expansion gated) — see **Notable contracts** + [[domains/us-payment-rail]] |
| `dashboard` | KPIs, spend, deadlines |
| `report` | spend, expiring, compliance gaps |
| `audit` | audit log list + export |
| `import` | CSV/XLSX contractors/contracts |
| `search` | cross-entity global search |
| `skonto` | German early payment discount |
| `esign` | DocuSign / Autenti |
| `ocr` | Claude OCR extraction |
| `ksef` | Poland KSeF |
| `latePaymentInterest` | UK LPCDA statutory interest |
| `legal` | GDPR privacy notice PDFs |
| `time` | manager timesheet review |
| `jira` | Jira Cloud integration |
| `linear` | Linear integration |
| `docs` | workflow doc linking |
| `calendar` | Google/Outlook calendar |
| `billing` | Stripe subscription |
| `deprovisioning` | IdP deprovisioning (5 providers) |
| `equipment` | CRUD, shipments |
| `googleWorkspace` | directory import, sync |
| `gdpr` | erasure + portability |
| `teams` | Microsoft Teams |
| `onboardingImport` | cross-tool import wizard — see **Notable contracts** below |
| `complianceAdmin` | compliance dashboard admin |
| `einvoice` | per-country e-invoice status |
| `leitwegId` | German public-sector Leitweg-ID |
| `exchangeRate` | ECB daily rates |
| `featureFlags` | Unleash introspection |
| `consent` | PDPL consent management |
| `peppol` | Peppol network |
| `tax` | VAT, WHT, tax summary |
| `zatca` | ZATCA device onboarding |
| `gulf` | UAE free-zone + Saudization |

## Conditional classification (8 namespaces)

Gated by `module.classification-engine` or `QA_DEFAULT_ORG_ID` in `root.ts`:

| Namespace | Summary |
|-----------|---------|
| `classification` | IR35 + Scheinselbständigkeit assessments |
| `classificationDashboard` | per-market compliance health |
| `classificationDocument` | IR35 SDS + DRV + US determination-letter PDFs (R2) |
| `ir35Chain` | chain participants + SDS delivery |
| `ir35Attestation` | other-client attestation |
| `economicDependencyAlert` | §2 SGB VI billing-share bands |
| `reassessmentTrigger` | material-change triggers |
| `statusfeststellungsverfahren` | DRV § 7a clearance procedure |

When flag OFF: runtime `METHOD_NOT_FOUND`; client types still see namespaces.

## Conditional US expansion (4 namespaces)

Gated by `module.us-expansion` (or `QA_DEFAULT_ORG_ID`) in `root.ts`; each procedure also re-checks the flag per request (`assertUsExpansionEnabled`):

| Namespace | Summary |
|-----------|---------|
| `taxForm` | staff read/track of US W-form submissions (status, treaty claim, expiry) + request/remind — no on-behalf signing; full SSN never projected |
| `form1042s` | staff Form 1042-S generate/correct/recipient-copy + `contractorPii:read`-gated full-FTIN reveal; box figures always server-derived from settled USD payouts + the W-form on file |
| `form1099kTracker` | read-only informational 1099-K band for the contractor profile (`getTrackerState`): band + cumulative settled-USD payout + transaction count + the tax-year threshold. Band state is written **exclusively** by the `form-1099k-tracker` cron — the router never mutates it. Purely informational; the platform never files a 1099-K |
| `tax1099` | staff 1099-NEC year-end filing (`routers/finance/tax-1099-router.ts`): `list`, `generateBatch` (review-before-file — aggregates box-1 by payment date, never transmits), `buildAndValidateXml` / `downloadValidatedXml` (ManualDownload default — build IRIS XML → `xsdValidate` → download; records an `IrisSubmission` via idempotency), `uploadAck` (XXE-safe `parseIrisAck` → `IrisAck`), `listTinMismatches` / `escalateMismatch` / `resolveMismatch` (**amber advisory, never blocks generation**), `fileCorrection` (supersede), `getStateFilingOutput` (CFSF code vs per-state CSV). Zod-strict, audited, box figures server-derived. Full loop: [[domains/us-tax-year-end-filing]] |

When flag OFF: runtime `METHOD_NOT_FOUND`; the portal W-form + 1099 procedures throw `FORBIDDEN`.

## Conditional workforce (3 namespaces)

Gated by `module.workforce-employees` (or `QA_DEFAULT_ORG_ID`) in `root.ts`; each procedure also re-checks the flag per request (`assertWorkforceEnabled` in `middleware/require-workforce-flag.ts`):

| Namespace | Summary |
|-----------|---------|
| `worker` | shared cross-type worker reads (`list`, `getById`) — pass an explicit `workerType` so the `withWorkerTypeDefault` extension does not force-filter to CONTRACTOR; returns contractors + employees |
| `employee` | employee reads (`list`, `workerType=EMPLOYEE`) + the registry surface `mergeRouters`-composed from `employee-registry-router.ts` (`employeeRegistryRouter`): `register` (`employee:create`, creates `Worker(EMPLOYEE)` + `EmployeeProfile` in one `$transaction`, per-market validation, encrypts 4 national IDs, `omit`s every `*Encrypted`, `employee.registered` audit), `revealPii` (`employeePii:read`, field-routed decrypt + `<field>.revealed` audit, **staff-only** — absent from `portalAppRouter`), `listReferenceLists` (`employee:read`, seeded non-PII tuples). Full model + flow: [[domains/employee-registry]] |
| `personnelFile` | jurisdiction-correct personnel file (akta osobowe) `mergeRouters`-composed from `routers/core/personnel-file/{read,classify,erasure}.ts`. **read:** `getFile` (per-section `{ locked \| unlocked+documents }` + retention posture — the lock is decided at the permission layer by `hasSectionPermission` BEFORE querying, a locked section returns NO document payload/count; cross-org read → `null`) + `getRetentionSummary`. **classify:** `attachDocument` (`employee:update` — links a virus-scanned `Document`, runs the hybrid classifier, files ACTIVE or routes ambiguous → `PENDING_REVIEW`, never blocks the upload), `classifyApprove`/`classifyReject`/`pendingReviewQueue` (`compliance:override`, in-tx audit). **erasure:** `requestErasure` (`employee:delete` — per-section erased/retained dispositions, `fullErasureClaimed = retained.length===0`, `personnel_file.erasure_retained_under_statute` audit). Full model + flow: [[domains/personnel-file]] |

`contractor.*` is **not** gated — it is the always-on existing surface; the split adds `worker`/`employee` without changing the contractor route shape (locked by `contractor-contract-snapshot.test.ts`).

When flag OFF: runtime `METHOD_NOT_FOUND`; the per-request guard also throws `FORBIDDEN` (`workforceDisabled`). When ON, the web client shows a flag-gated `/employees` entry (`dashboard-home.tsx` → `useFlag('module.workforce-employees')`). Both read cross-type `Worker` rows behind the `withWorkerTypeDefault` extension; per-type HR-only fields gate on the separate `employee` RBAC resource. Full model + flow: [[domains/worker-foundation]].

## Portal portalAppRouter (2 namespaces)

Mount: `/api/trpc/portal/*` (registered **before** staff wildcard).

| Namespace | Summary |
|-----------|---------|
| `portal` | auth, invoices, contracts, profile, equipment, US W-form self-cert (merged) |
| `portalTime` | portal time entries + external sync |

Portal W-form procedures (`getTaxFormDetermination`, `saveTaxFormDraft`, `submitTaxForm`, `getMyTaxForms`) self-gate on `module.us-expansion` per request — the flat portal merge cannot be conditionally spread. The portal 1099-NEC procedures (`portal-tax-1099-router.ts`: `getEdeliveryConsent`, `recordEdeliveryConsent`, `withdrawConsent`, `downloadCopyB`) are merged the same way — every read/write scoped to `ctx.contractorId` (IDOR); consent is a server-derived, append-only AuditLog fact; Copy-B is furnished only with stored consent (else a paper-copy flag).

## Mount points

| Router | Path | File |
|--------|------|------|
| Staff | `/api/trpc/*` | `apps/api/src/plugins/trpc.ts` |
| Portal | `/api/trpc/portal/*` | same plugin, portal first |

## Notable contracts

### `onboardingImport.listSources`

| Field | Type / notes |
|-------|----------------|
| Input | — |
| Output | `ListSourcesOutput` — array of 4 providers (`JIRA`, `LINEAR`, `GOOGLE_WORKSPACE`, `SLACK`) with `connected` + `selected` |
| Validation | `.output(listSourcesOutputSchema)` |
| Tier | PRO |
| Permission | `settings:read` |

### `onboardingImport.fetchProjects`

| Field | Type / notes |
|-------|----------------|
| Input | `fetchProjectsInputSchema` — `{ sources: ('JIRA' \| 'LINEAR')[] }` min 1 |
| Output | `{ projects: ImportedProject[], sourceErrors: FetchPeopleSourceError[] }` |
| Output validation | `.output(fetchProjectsOutputSchema)` |
| Tier | PRO |
| Permission | `settings:read` |

Same per-source error codes as `fetchPeople`. Partial success supported. Jira connected without `cloudId` → `fetch_failed` (not silent empty list).

### `onboardingImport.fetchPeople`

| Field | Type / notes |
|-------|----------------|
| Input | `{ sources: SourceProvider[] }` — min 1 |
| Output | `{ people: MergedPerson[], sourceErrors: FetchPeopleSourceError[] }` |
| `sourceErrors[].code` | `'not_connected'` \| `'fetch_failed'` |
| Validation | `.output(fetchPeopleOutputSchema)` — `@contractor-ops/validators` |
| Tier | PRO |
| Permission | `settings:read` |

Partial success: failed sources in `sourceErrors`; successful sources merged into `people`. Directory fetch via `user-source-registry.ts`.

### `onboardingImport.startImport`

| Field | Type / notes |
|-------|----------------|
| Input | `startImportInputSchema` — `{ people, projects }` with per-item `skip` |
| Output | `{ jobId }` — job stored in org `settingsJson.importJobs` |
| Tier | PRO |
| Permission | `member:create` + `workflow:update` |

Processes people invitations (Better Auth) and project workflow templates synchronously; final status written before return. Project templates created per-project (one failure does not fail siblings).

### `onboardingImport.getProgress`

| Field | Type / notes |
|-------|----------------|
| Input | `{ jobId: string }` |
| Output | `ImportJob` — `jobId`, `status` (`pending` \| `processing` \| `completed` \| `failed`), `totalItems`, `completedItems`, `failedItems[]` |
| Tier | PRO |
| Permission | `settings:read` |

### `onboardingImport.retryFailedItem`

| Field | Type / notes |
|-------|----------------|
| Input | `retryItemInputSchema` — `{ jobId, itemKey }` (email or `project:externalId`; project keys return `BAD_REQUEST`) |
| Output | `{ success: true }` or `{ success: false, error: string }` |
| Tier | PRO |
| Permission | `member:create` |

Retries a single failed invitation from `failedItems`; updates job in `settingsJson.importJobs`.

### `integration.getHealth`

Returns `scopeCapabilities` parsed from `IntegrationConnection.scopeCapabilities` JSONB (`health-service.ts`). Used by GWS reconnect banner via `useIntegrationHealthProviderSection`.

### `payment.initiatePayout`

Opt-in programmatic-ACH payout (`payment-core.ts` → `_initiatePayoutForRun`). The NACHA/Fedwire **file** export (`lockAndExport`) remains the always-available default; this originates payouts via the `PayoutInitiationAdapter` (Modern Treasury mock by default; live is dark).

| Field | Type / notes |
|-------|----------------|
| Input | `.strict()` — `runId` (cuid), `idempotencyKey` (1–200), `provider` (`MODERN_TREASURY` \| `STRIPE_TREASURY`, default MT), optional `settlementCurrency` (3-char per-run override) |
| Gating | `assertUsExpansionEnabled` + `payments.ach-payouts` flag (dark default → `FORBIDDEN` / `PAYMENT_ACH_PAYOUTS_DISABLED`) |
| Permission | `payment:export` |
| Behavior | idempotent (Upstash reserve/complete/clear — no double-pay; PENDING → `CONFLICT` / `PAYMENT_PAYOUT_IN_PROGRESS`); per-item settlement conversion (missing rate → `UNPROCESSABLE_CONTENT`); per-item Plaid advisory fail-open; masked-only `payment_run.payout_initiated` audit |

Amount/currency are server-derived from the locked run's items — the client never supplies them. Full flow: [[domains/us-payment-rail]].

### `payment.ingestAchReturnFile`

Reachable ACH return-file ingestion (`payment-core.ts` → `parseNachaReturnFile` + `applyAchReturns` in `services/ach-return.service.ts`). The operator uploads the NACHA return file their bank produced; bounced credits flip to FAILED. The live Modern Treasury return-webhook is a documented deferred seam, not built.

| Field | Type / notes |
|-------|----------------|
| Input | `.strict()` — `runId` (cuid), `returnFileText` (string, `min(1).max(5_000_000)`) |
| Gating | `assertUsExpansionEnabled` (US-expansion + region → `FORBIDDEN` / `US_EXPANSION_DISABLED`), applied before any parse/apply |
| Permission | `payment:export` |
| Returns | `{ failed, advisory, skipped, unmatched }` verbatim from `applyAchReturns` |
| Behavior | R01/R02/R03 (+ R-family) → item `FAILED` + reason; NOC/COR → advisory (no status change); tenant-scoped; idempotent (already-FAILED item skipped → re-upload is a no-op); `unmatched > 0` flags a wrong-run / mis-uploaded file; a return-addenda file that parses to nothing → `BAD_REQUEST` / `PAYMENT_ACH_RETURN_FILE_INVALID`; masked per-item `payment_run.ach_return_applied` + ingestion-summary `payment_run.ach_return_ingested` audit rows |

Full flow: [[domains/us-payment-rail]] (ACH return-code handling).

## Public API router (separate from `appRouter`)

`packages/api/src/routers/public-api/*` (`publicApiRouter`) — read procedures for 9 entities + **write** procedures for 6 (contractor/invoice/payment/paymentRun/workflow/workflowTask), each under `apiKeyTenantProcedure` with a mandatory `requirePermission` scope. Writes stay **double-dark** (per-org `module.public-api` off + `hide:true` routes) until Phase 100. Full surface: [[domains/public-api-surface]].

## Related

- [[api-router-groups]]
- [[patterns/trpc-procedure-stack]]
- [[patterns/portal-auth]]
- [[domains/portal-external]]
- [[domains/public-api-surface]]

## Verify live

```bash
grep -E '^\s+[a-zA-Z]+:' packages/api/src/root.ts
cat packages/api/src/portal-root.ts
```

## Agent mistakes

- Putting `portal` in `appRouter` — TS inference cost; use `portal-root.ts`
- Assuming classification routers exist in prod without flag check
