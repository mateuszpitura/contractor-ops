---
title: web-vite UI domains
type: structure
tags: [structure, web-vite, ui]
source_commit: d839f52eb
verify_with:
  - apps/web-vite/src/components/
  - apps/web-vite/ARCHITECTURE.md
  - apps/web-vite/src/router/
updated: 2026-06-18
---

# web-vite UI domains

## Purpose

`apps/web-vite/src/components/{domain}/` maps product areas to UI. Pages in `src/pages/` compose route shells; domain logic stays in hooks.

## Layering

```
pages/**  →  *PageContent or wired section  →  hooks/use-*.ts  →  *View / presentational *.tsx
```

Routes: `apps/web-vite/src/router/dashboard-routes.tsx`, `portal-routes.tsx`.

## Component folders → domain wiki

| Folder | Domain / pattern page |
|--------|------------------------|
| `invoices/` | [[domains/invoice-to-payment]] |
| `payments/` | [[domains/payments-and-bank-files]] |
| `approvals/` | [[domains/approvals-engine]] |
| `contractors/` | [[domains/contractors-engagements]] |
| `contractors/insights/` | [[domains/contractors-engagements]] — list insight band (attention rail + composition strip, view-mode arranger); `hooks/use-contractor-insights.ts` = sole tRPC boundary |
| `contractors/contractor-profile/overview/` | [[domains/contractors-engagements]] — detail overview widgets (compliance + financial pulse) |
| `contractors/tax-forms/` | [[domains/us-tax-forms]] — staff W-form status card (`tax-form-status-card.tsx` + `hooks/use-tax-form-status.ts`) |
| `contracts/` | [[domains/contracts-lifecycle]] |
| `portal/` | [[domains/portal-external]] |
| `portal/tax-forms/` | [[domains/us-tax-forms]] — portal W-9/W-8BEN/W-8BEN-E self-cert wizard (`tax-form-wizard.tsx` + `hooks/use-tax-form-wizard.ts`), route `portal/tax-form` |
| `compliance/` | [[domains/compliance-dashboard]] |
| `classification/` | [[domains/classification-ir35]] |
| `workflows/`, `workflow/` | [[domains/workflows-and-roles]] |
| `offboarding/` | [[domains/workflows-and-roles]] — override badges/dialogs on offboarding runs |
| `equipment/` | [[domains/equipment-logistics]] |
| `time/` | [[domains/time-and-reconciliation]] |
| `integrations/` | [[integrations/_index]] |
| `settings/`, `organization/` | [[domains/settings-and-org-admin]] |
| `admin/` | [[domains/settings-and-org-admin]] (BoE rate, super-admin) |
| `onboarding/`, `import/` | [[domains/onboarding-and-import]] — import wizard page: `pages/dashboard/onboarding-import.tsx` (`OnboardingImportPageContent`); first-run org-create wizard: `onboarding/organization-onboarding.tsx` (`OrganizationOnboardingContainer`), gated by `DashboardShellContainer` when no active org |
| `billing/` | [[domains/billing-and-feature-gates]] |
| `search/`, `reports/` | [[domains/search-and-reports]] |
| `dashboard/` | [[domains/staff-dashboard]] |
| `notifications/` | [[domains/notifications-and-reminders]] |
| `consent/`, `legal/` | [[domains/consent-gdpr-pdpl]] |
| `idp/` | [[domains/idp-deprovisioning]] |
| `documents/` | [[domains/documents-and-ocr]] |
| `ocr/` | [[domains/documents-and-ocr]] |
| `einvoice/`, `peppol/`, `zatca/` | [[integrations/_index]] |
| `saudization/` | [[domains/gulf-saudization]] |
| `wht/` | [[domains/tax-and-wht]] |
| `wizard/` | [[domains/contracts-lifecycle]] |
| `auth/` | [[patterns/better-auth-staff]] |
| `layout/`, `shared/`, `table-kit/`, `error/` | [[patterns/web-vite-data-layer]] |

## Invariants

- tRPC only in `hooks/use-*.ts` — `pnpm check:web-vite-data-layer`
- No `*-container.tsx` under `components/` (wired + view co-located instead)
- `formatMoneyAmount` from `apps/web-vite/src/lib/money.ts`
- `@contractor-ops/ui` `DataTable` — `pnpm check:web-vite-table-pattern`

## Shared patterns

| Pattern | Path |
|---------|------|
| `useListDataTable` | `src/hooks/use-list-data-table.ts` — [[patterns/data-tables-workbench]] |
| `EntitySummarySheet` | `src/components/table-kit/entity-summary-sheet.tsx` |
| `WizardDialogShell` | `src/components/wizard/wizard-dialog-shell.tsx` |
| `FeatureGate` / `BillingTierGate` | `layout/feature-gate.tsx` / `billing/billing-tier-gate.tsx` |
| `useDirection` | `src/hooks/use-direction.ts` |

Integration providers: `*-provider-section.tsx` (wired + `*View`) + `integrations/hooks/use-*-provider-section.ts`. Health tRPC lives in `useIntegrationHealthProviderSection` (same file as base provider hook). Slack org-grid: `settings/slack-org-grid-card.tsx` + `settings/hooks/use-slack-org-grid-card.ts`. Onboarding uses `*StepContainer` wired exports co-located in step files.

## Related

- [[patterns/web-vite-data-layer]]
- [[patterns/data-tables-workbench]]
- [[apps]]

## Verify live

```bash
ls apps/web-vite/src/components/
pnpm check:web-vite-data-layer
semble search "useTRPC" apps/web-vite/src/pages
```

## Agent mistakes

- `useQuery` in pages or wired sections (bypass hook)
- Local `formatAmount` helpers in components
- New folder without row in this table + domain wiki update
- Citing removed `*-container.tsx` paths from old docs or tests
