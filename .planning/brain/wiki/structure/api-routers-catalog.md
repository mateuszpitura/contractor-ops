---
title: API routers catalog
type: structure
tags: [structure, api, trpc, catalog]
source_commit: 19f747bca80fe58d162d3e8c3967ec553e057151
verify_with:
  - packages/api/src/root.ts
  - packages/api/src/portal-root.ts
  - packages/validators/src/onboarding-import.ts
updated: 2026-06-10
---

# API routers catalog

> **Do not cite counts from this page alone.** Always verify `packages/api/src/root.ts` and `portal-root.ts`.

## Purpose

Complete namespace index for staff `appRouter` and contractor `portalAppRouter`. Comments copied from `root.ts` inline comments.

## Staff appRouter — always mounted (53 namespaces)

| Namespace | Summary |
|-----------|---------|
| `adminBoeRate` | Super-admin BoE base rate CRUD |
| `apiKey` | Enterprise API key management |
| `bacs` | BACS Std 18 file generation |
| `organization` | Org CRUD, current org |
| `organizationDefinitions` | Nested: `team`, `project`, `costCenter` |
| `user` | list, invite, roles, deactivate |
| `settings` | org settings get/update |
| `contractor` | CRUD, lifecycle, compliance health, bulk |
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
| `payment` | runs, lock+export, bank import |
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
| `classificationDocument` | IR35 SDS + DRV PDFs (R2) |
| `ir35Chain` | chain participants + SDS delivery |
| `ir35Attestation` | other-client attestation |
| `economicDependencyAlert` | §2 SGB VI billing-share bands |
| `reassessmentTrigger` | material-change triggers |
| `statusfeststellungsverfahren` | DRV § 7a clearance procedure |

When flag OFF: runtime `METHOD_NOT_FOUND`; client types still see namespaces.

## Portal portalAppRouter (2 namespaces)

Mount: `/api/trpc/portal/*` (registered **before** staff wildcard).

| Namespace | Summary |
|-----------|---------|
| `portal` | auth, invoices, contracts, profile, equipment (merged) |
| `portalTime` | portal time entries + external sync |

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

## Related

- [[api-router-groups]]
- [[patterns/trpc-procedure-stack]]
- [[patterns/portal-auth]]
- [[domains/portal-external]]

## Verify live

```bash
grep -E '^\s+[a-zA-Z]+:' packages/api/src/root.ts
cat packages/api/src/portal-root.ts
```

## Agent mistakes

- Putting `portal` in `appRouter` — TS inference cost; use `portal-root.ts`
- Assuming classification routers exist in prod without flag check
