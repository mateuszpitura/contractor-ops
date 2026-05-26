# UX Regression Audit — Skeleton Chrome (2026-05-26)

Scope: containers under `apps/web-vite/src/components/` that perform top-level
`isLoading → return <Skeleton/>` lifts and may have dropped chrome (page-header,
toolbar, filter chips, tabs, breadcrumb, sticky actions, card header, table
header) that the success-path renders.

Method: read-only inspection of containers + their success view + their
sibling Skeleton component; compared rendered chrome between branches.

## Summary

| Bucket | Count |
|--------|------:|
| OK (chrome preserved) | 22 |
| OK (no chrome needed) | 7 |
| REGRESSION-LOST-CHROME | 10 |
| REGRESSION-LOST-DATA-AREA-SHIMMER | 3 |

(Counts cover the audited subset of high-visibility list/table/detail/section
containers; ~48 containers across `apps/web-vite/src/components/` perform a
top-level Skeleton lift.)

## Regressions

### REGRESSION-LOST-CHROME

#### invoices

- `apps/web-vite/src/components/invoices/invoice-detail-container.tsx`
  - Success path: `<h1>` invoice number + `<AtelierStatusPill/>` + source/peppol/zatca badges + `<InvoiceDetailTabs/>` (Details ↔ E-invoice tab strip).
  - Skeleton (`invoice-detail/invoice-detail-skeleton.tsx`): renders title + status pill + 60/40 PDF column placeholders, but DROPS the tab strip and all source/peppol/zatca badges.
  - Fix: include a horizontal tabs-strip placeholder (`<div className="flex gap-2 border-b pb-2">` with 2 width-24 skeletons) above the 60/40 grid; add 2 small badge placeholders next to the title pill placeholder.

- `apps/web-vite/src/components/invoices/invoice-ocr-section-container.tsx`
  - Success path: `<Card data-slot="invoice-ocr-section"><CardHeader><CardTitle>{ocrSectionHeading}</CardTitle></CardHeader><CardContent><ExtractionStatusBar/>…</CardContent></Card>`.
  - Skeleton: bare `<Skeleton className="h-20 w-full rounded-lg"/>` — drops the Card, CardHeader, CardTitle.
  - Fix: wrap skeleton in `<Card><CardHeader><Skeleton h-5 w-40 /></CardHeader><CardContent><Skeleton h-10 w-full /></CardContent></Card>`.

- `apps/web-vite/src/components/invoices/intake/intake-detail-container.tsx`
  - Success path: `<AtelierPageHeader title={pageTitle} description={extractedSupplierName} />` then 2-column grid (PDF pane + fields).
  - Skeleton: `<Skeleton h-10 w-64>` (title-only) — drops the description line placeholder rendered by `AtelierPageHeader`.
  - Fix: add `<Skeleton h-4 w-48 mt-1/>` under the title block to mirror the description line.

#### payments

- `apps/web-vite/src/components/payments/payment-run-side-panel-container.tsx`
  - Success path (`PaymentRunSidePanel`): Sheet → `SheetHeader > SheetTitle` + metrics + action buttons. Sticky header chrome.
  - Skeleton (`PaymentRunSidePanelSkeleton`): Sheet → 6 generic `h-4` bars only — no `SheetHeader`, no `SheetTitle` placeholder.
  - Fix: render `<SheetHeader className="space-y-3"><Skeleton h-6 w-48 /></SheetHeader>` block then content placeholders, so the sheet title slot is stable.

#### workflows

- `apps/web-vite/src/components/workflows/my-tasks-list-container.tsx`
  - Success path (`MyTasksListBody`): `<Switch>` + `<Label>{filterOverdueOnly}</Label>` toolbar row, then task cards.
  - Skeleton (`MyTasksListSkeleton`): only 5 card-shaped placeholders — drops the overdue-only filter toolbar.
  - Fix: include `<div className="flex items-center gap-2"><Skeleton h-5 w-9 /><Skeleton h-4 w-32 /></div>` above the card list.

#### time

- `apps/web-vite/src/components/time/time-detail-container.tsx`
  - Success path (`ContractorTimesheetReview`): title row + content + sticky-bottom action bar (`<div className="sticky bottom-0…"><Button>Back</Button>…<Button>Approve</Button></div>`).
  - Skeleton (`ReviewSkeleton`): title + content placeholders only — drops the sticky bottom action bar entirely.
  - Fix: append a sticky-bottom shimmer row with 2-3 button-shaped placeholders to keep page height stable and pre-allocate the action bar.

#### zatca

- `apps/web-vite/src/components/zatca/onboarding-wizard-container.tsx`
  - Success path (`OnboardingWizardView`): `<CardHeader className="space-y-4 border-b"><CardTitle>{title}</CardTitle><Stepper steps onStepClick/></CardHeader>` + body.
  - Skeleton (`OnboardingWizardSkeleton`): `<CardHeader><Skeleton h-6 w-60 /></CardHeader>` — DROPS the Stepper progress nav.
  - Fix: render a stepper-shaped placeholder (`<div className="flex gap-2">{N×<Skeleton h-2 w-12 rounded-full />}</div>`) under the title placeholder.

- `apps/web-vite/src/components/zatca/zatca-invoice-chain-table-container.tsx`
  - Success path (`ZatcaInvoiceChainTableView`): `<Card><CardHeader>{title + Refresh button}</CardHeader><CardContent><Table><TableHeader>{ICV, Invoice, Submitted, Status, Actions}</TableHeader>…</Table></CardContent></Card>`.
  - Skeleton (`ZatcaInvoiceChainTableSkeleton`): `<Card><CardHeader><Skeleton h-5 w-40 /></CardHeader><CardContent>{3×h-10 rows}</CardContent></Card>` — drops the refresh button and table column heads.
  - Fix: add a button placeholder in the CardHeader row (`flex-row justify-between` + `<Skeleton h-8 w-24>` on the right); inside CardContent render `<TableHeader>` with skeleton-filled `TableHead` cells so the column grid is stable.

#### einvoice

- `apps/web-vite/src/components/einvoice/compliance-detail-container.tsx`
  - Success path (`EInvoiceComplianceDetailView` + `EInvoiceComplianceDetailEmpty`): both render `<DetailHeading>` (`<h2><FileCheck/> heading</h2>` + subline `<p>`).
  - Skeleton (`EInvoiceComplianceDetailSkeleton`): `<Skeleton h-8 w-48 /> + <Skeleton h-32 w-full/>` — drops the subline placeholder and the icon slot.
  - Fix: add `<div className="flex items-center gap-2"><Skeleton size-5 rounded /><Skeleton h-6 w-48 /></div><Skeleton h-3 w-72 />` to mirror the rendered DetailHeading.

#### onboarding

- `apps/web-vite/src/components/onboarding/people-review-step-container.tsx`
  - Success / Error / Empty paths all render `<PeopleReviewHeader/>`; LOADING returns bare `<PeopleReviewSkeleton/>` (heading placeholder, no Header component).
  - Inconsistent with sibling error/empty branches which DO wrap with the Header.
  - Fix: change loading branch to `<div className="space-y-6"><PeopleReviewHeader /><PeopleReviewSkeleton /></div>` (match error/empty wrapping pattern).

- `apps/web-vite/src/components/onboarding/project-import-step-container.tsx`
  - Same pattern: error/empty wrap with `<ProjectImportHeader/>`; loading branch returns bare skeleton (no Header).
  - Fix: wrap loading branch in `<div className="space-y-6"><ProjectImportHeader /><ProjectImportSkeleton /></div>`.

#### equipment

- `apps/web-vite/src/components/equipment/equipment-detail/tab-shipments-container.tsx`
  - Success path (`TabShipmentsView`): `<PendingReturnBanner/>` + right-aligned `<Button>Create Shipment</Button>` toolbar + table.
  - Skeleton (`TabShipmentsSkeleton`): preserves PendingReturnBanner, drops the right-aligned "Create Shipment" button.
  - Fix: add `<div className="flex justify-end"><Skeleton h-9 w-40 /></div>` between banner and rows.

#### settings (notifications)

- `apps/web-vite/src/components/settings/notification-preferences-container.tsx`
  - Success path: `<Card><CardHeader><CardTitle/><CardDescription/></CardHeader><CardContent><Table><TableHeader>…</TableHeader>…</Table></CardContent></Card>`.
  - Skeleton (`NotificationPreferencesSkeleton`): bare `<div>` with title + 6 row strips — drops the `<Card>` wrapper, `CardHeader`, and table column header.
  - Fix: wrap skeleton with `<Card><CardHeader><Skeleton h-5 w-48 /><Skeleton h-4 w-96 mt-1 /></CardHeader><CardContent>…rows…</CardContent></Card>`; add a `<TableHeader>` row.

#### settings (diagnostics)

- `apps/web-vite/src/components/settings/feature-flags-tab-container.tsx`
  - Success path (`FeatureFlagsTab`): `<h3>{title}</h3><p>{description}</p>` then `<Table><TableHeader>{flag, category, jurisdiction, state}</TableHeader>…</Table>`.
  - Skeleton (`FeatureFlagsTabSkeleton`): centered `<Loader2 />` spinner only — drops the heading, description, and table chrome entirely.
  - Fix: replace spinner with `<div className="space-y-4"><div><Skeleton h-5 w-48 /><Skeleton h-4 w-72 mt-1 /></div><div className="rounded-lg border"><Table><TableHeader>…</TableHeader><TableBody>{3×TableRow with 4× TableCell skeletons}</TableBody></Table></div></div>`.

### REGRESSION-LOST-DATA-AREA-SHIMMER

#### time

- `apps/web-vite/src/components/time/reconciliation-table-container.tsx`
  - Success path (`ReconciliationTableView`): `<Table><TableHeader>{contractor, period, approvedHours, expectedAmount, invoicedAmount, deviation, …}</TableHeader>…</Table>` (7 columns).
  - Skeleton (`ReconciliationSkeleton`): flex rows of variable-width pills — no table-shaped column grid, no `TableHeader`.
  - Fix: switch to `<Table><TableHeader>` with skeleton-filled `TableHead` cells then `TableBody` with 5 skeleton rows whose `TableCell`s match the column widths.

#### settings (tax)

- `apps/web-vite/src/components/settings/tax/wht-certificates-section-container.tsx`
  - Success path: Card preserved + `<Table><TableHeader>{certificateNumber, contractor, country, whtAmount, paymentDate, actions}</TableHeader>…</Table>`.
  - Skeleton: Card preserved, but CardContent contains only `3× <Skeleton h-10 w-full />` — drops the column-header chrome (no `TableHeader`).
  - Fix: render `<Table><TableHeader>` with skeleton-filled cells in the CardContent so column alignment is stable when data lands.

#### zatca

- `apps/web-vite/src/components/zatca/zatca-invoice-chain-table-container.tsx`
  - Also in REGRESSION-LOST-CHROME above — data area issue: skeleton replaces the entire `<Table>` (including `TableHeader`) with `3× h-10` rows. Same fix already noted (render TableHeader with skeleton-filled cells).

## OK-with-notes (chrome preserved — sampled)

- `portal-invoices-container.tsx`, `portal-payments-container.tsx`, `portal-documents-container.tsx`, `portal-contracts-container.tsx`, `portal-index-container.tsx`, `portal-invoice-detail-container.tsx` — PageHeader / SectionLabel / back-link chrome preserved; skeleton renders inside the section slot only. Exemplary pattern.
- `organization-index-container.tsx` — `OrganizationLayout` wraps both branches; card-shaped skeleton mirrors success grid.
- `contractor-detail-container.tsx` — Header + tab-strip + right rail all render placeholders alongside view content.
- `contracts/contract-detail-container.tsx` + `contract-detail/detail-skeletons.tsx` — Header skeleton + dedicated `DetailTabsSkeleton` (tabs strip + 2-col cards).
- `equipment-detail-container.tsx` — DetailSkeleton mirrors title row + tab strip + 2-col cards.
- `time-tracking-container.tsx` — PageHeader + Tabs + SectionLabel stay outside loading; `LoadingSkeleton` replaces data area only.
- `approvals/approval-queue-container.tsx` — Toolbar/Tabs preserved; isLoading drilled into `<ApprovalQueueTable isLoading/>`.
- `notifications/notification-center-container.tsx` — PageHeader + Tabs + Switch toolbar stay; skeleton inside body.
- `notifications/notification-popover-container.tsx` — `<NotificationPopoverShell>` slot pattern keeps trigger + popover chrome stable across loading/empty/list.
- `workflows/workflow-side-panel-container.tsx` — `WorkflowSidePanelShell` slot pattern preserves sheet chrome.
- `workflows/template-picker-container.tsx` — dialog shell preserved; only `listContent` slot varies.
- `workflows/workflow-run-detail-container.tsx` — skeleton mirrors title row + progress + checklist.
- `workflows/workflow-template-detail-container.tsx` — skeleton mirrors title + 4-card stack.
- `workflows/calendar-task-config.tsx` — switch + label + button row mirrored.
- `workflows/workflow-run/task-attachments-container.tsx` + `task-comments-container.tsx` — slot pattern: heading + button + composer stay outside the loading branch.
- `contractors/contractor-profile/workflows-tab-container.tsx` + `tab-documents-container.tsx` — SectionLabel + DropZone (disabled) preserved across all branches.
- `integrations/jira-activity-summary-container.tsx` — bordered card with logo + title placeholders, matching row shapes.
- `integrations/google-workspace/sync-status-section-container.tsx` — Card preserved + button placeholders for sync/import.
- `integrations/doc-links-section-container.tsx` — header + disabled attach button + chip placeholders match success.
- `integrations/{jira,linear,teams,google-workspace}-provider-section-container.tsx` — FeatureGate wrapper preserved; mild note that the inner ProviderConnectionCard icon/title/description is replaced by a single `h-24` block (could be improved but is a card-content swap, not an outer chrome loss).
- `approvals/chain-tracker-container.tsx` + `audit-timeline-container.tsx` — Card + CardHeader preserved with title placeholder.
- `zatca/zatca-compliance-widget-container.tsx`, `zatca-stats-cards-container.tsx`, `zatca-status-card-container.tsx`, `zatca-connection-pill-container.tsx` — Card or pill chrome preserved.
- `peppol/peppol-status-card-container.tsx` — Card + CardHeader chrome preserved.
- `invoices/einvoice-compliance-summary-tile-container.tsx` — Card preserved + matching tile placeholders.
- `invoices/late-interest/late-interest-card-container.tsx`, `invoices/skonto/skonto-banner-container.tsx` — Card + CardHeader preserved.
- `invoices/intake/intake-detail-match-pane-container.tsx`, `intake-detail-pdf-pane-container.tsx` — Card + CardHeader preserved.
- `einvoice/compliance-widget-container.tsx` — Card chrome preserved.
- `settings/dpd-provider-section-container.tsx`, `ups-provider-section-container.tsx`, `my-calendar-section-container.tsx`, `org-calendar-section-container.tsx`, `org-settings-form-container.tsx`, `slack-user-mapping-container.tsx` — Card / heading chrome preserved with matching placeholders.
- `billing/usage-dashboard-container.tsx` — 4-card grid skeleton matches.
- `contractors/classification/classification-dashboard-container.tsx` — Banner + PageHeader stay; only `ClassificationGlobalHeader` data-area shows skeletons.
- `documents/version-history-container.tsx` — `ExpandedHeader` rendered in all expanded variants (loading, empty, list).
- `onboarding/source-selection-step-container.tsx` — loading branch DOES wrap with `<SourceSelectionHeader/>` (correct pattern, contrast with people/project siblings above).
- `invoices/status-chip-bar-container.tsx` — skeleton matches one chip per status.
- `invoices/einvoice-tab/einvoice-tab-container.tsx` — section blocks match in 3 cards.

### OK (no chrome needed — data-only widget / dialog body)

- `billing/proration-preview-container.tsx` — dialog body, no outer chrome.
- `invoices/vat-rate-selector-container.tsx` — form-control wrapper.
- `contractors/country-compliance-section-container.tsx` — loading card variant; outer page chrome handled by parent.
- `contractors/engagement-classification-container.tsx` — wizard spinner inside Card; no surrounding section chrome.
- `notifications/notification-popover-container.tsx` — already noted above.

## Notes

- Total `*-container.tsx` files under `apps/web-vite/src/components/`: 303.
- Containers with `isLoading` + `Skeleton` references: 68.
- Containers with explicit top-level `if (...isLoading) return <*Skeleton/>` lift: ~48.
- Risk-free domains (no regressions found): portal, approvals (top-level pages), contractors (top-level pages), notifications, payments (top-level list — table-internal skeleton handles loading).
- Domains with regression hotspots: invoices, settings, zatca, workflows, time, einvoice, equipment, onboarding.
- Sticky / toolbar / tab-strip chrome is the most common loss pattern. Card-header chrome is mostly preserved; table-header chrome is the second most common loss.
- Recommended next step: codemod-friendly fix in each Skeleton — wrap content with the same outer chrome (Card/CardHeader, TableHeader, sticky action stub) and keep skeleton bars inside.
