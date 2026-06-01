---
status: issues-found
phase: 73
phase_name: F1 Compliance — Admin Dashboard + Portal Self-Service + i18n
review_type: conformance + code-smell (idiom-vs-neighbors, read-only)
method: semble search/find_related against closest existing analogs + manual diff
date: 2026-06-01
relates_to: 73-REVIEW.md (carries forward still-open LOW/INFO)
findings:
  high: 1
  medium: 4
  low: 7
  info: 5
  total: 17
---

# Phase 73 Conformance + Code-Smell Audit

Goal: make Phase 73 code indistinguishable from the rest of `apps/web-vite` / `packages/api`.
For each new/changed module the closest **existing analog** in this tree was located via
`semble search`/`find_related` and every divergence from that idiom is flagged below.

**Re-verified FIXED this session (not re-reported):** CR-1 portal upload chain (now
`getComplianceUploadUrl` + `consumePendingUpload` + `document.create` + `documentLink.create`
+ audit), CR-2 admin review surface (`ReviewUploadButton` + `UploadReviewDialogContainer` now
mounted in `tab-compliance.tsx`, fed by `contractor.ts` `pendingReviewDocumentId`), WR-1
(approve/reject now assert doc org + `PENDING_REVIEW` + `DocumentLink` ownership), WR-2
(aria-label now an explicit key map), WR-3 (at-risk + portal status badges now via
`tDynLoose`+`enumKey`), WR-4 (blocked-payments label now `t(reason.documentTypeLabelKey)`),
WR-5 (all 98 `ar` Phase-73 strings now genuinely translated — 0 identical to `en`).

**Calibration note:** `Phase NN`, `Plan NN-NN`, `D-NN`, `COMPL-NN`, and `T-NN-NN-NN` task-tag
comments ARE the established house style in the sibling compliance services
(`compliance-payment-gate.ts`, `compliance-supersession.ts`) and migrations — so those breadcrumbs
are **conformant** and are NOT flagged (per CLAUDE.md "verify in this tree"). `pathFilter()`
namespace invalidation is also idiomatic (91 sites) — not flagged. `useQuery` + manual
loading/error branching (no `useSuspenseQuery`) is the universal web-vite idiom — conformant.

---

## HIGH

### CF-H1 — Compliance dashboard/override/review procedures sit inside the flag-gated `classification` namespace; the whole loop is dead for any org without `module.classification-engine`
**Files:**
- `packages/api/src/routers/compliance/classification.ts:618,674,703,718,722,726,737,829` (new procedures on `classificationRouter`)
- `packages/api/src/root.ts:122-149` (router-level conditional mount)
- `apps/web-vite/src/components/compliance/dashboard/hooks/use-compliance-dashboard.ts:19-25` (client calls `trpc.classification.dashboard*` unconditionally)

The eight Phase-73 procedures (`dashboardKpis`, `dashboardAtRisk`, `dashboardUpcomingRenewals`,
`dashboardBlockedPayments`, `overrideItem`, `itemAuditTrail`, `approveUploadReplacement`,
`rejectUploadReplacement`) were added to `classificationRouter`. `root.ts:136-149` mounts the
entire `classificationRouters` bag into `appRouter` **only** when `module.classification-engine`
is enabled (or `QA_DEFAULT_ORG_ID` is set). For every other org the `classification` namespace is
absent, so `trpc.classification.dashboardKpis` (and the override/review mutations) do not exist —
the admin compliance dashboard, the per-row override, and the upload-review surface all 404 at the
edge. Compliance applies to **all** orgs (the portal self-service half correctly lives on
`portalRouter`, which is always mounted), so gating the admin half behind the classification
kill-switch is an unintended coupling. The procedures deliberately use bare `tenantProcedure`
(not the router's own `classificationProcedure`) to skip the per-procedure flag gate — but the
router-level conditional mount defeats that intent.

**Existing analog:** sibling compliance surfaces that must run for all orgs live in their own
always-mounted routers — `einvoiceRouter`, `zatcaRouter`, and the portal compliance procedures
on `portalRouter` (`root.ts:206,213`; `portal.ts:1718,1747`). `classification-dashboard.ts` in the
same folder is the IR35/Schein health dashboard and is *correctly* flag-gated because it aggregates
Phase-58 assessments.

**Idiomatic fix:** move the six admin compliance procedures (dashboard×4, override, review×2,
history) into a new always-mounted `compliance` router under `routers/compliance/` (sibling to
`einvoice`/`zatca`), register it unconditionally in `root.ts`, and repoint the web-vite hooks to
`trpc.compliance.*`. If product intends compliance-admin to require the classification engine,
make that explicit (document it + gate the route/nav), but do not leave the client calling a
namespace that silently disappears.

---

## MEDIUM

### CF-M1 — `tab-compliance.tsx` feeds a *localized display* date into `<input type="date">`, so the approve default-expiry silently blanks
**Files:**
- `apps/web-vite/src/components/contractors/contractor-profile/tab-compliance.tsx:165`
- `apps/web-vite/src/components/contractors/compliance/upload-review-dialog.tsx:80-86` (`<Input type="date">`)
- `apps/web-vite/src/hooks/use-date-formatter.ts:33-37` (`formatDate` = org `dateFormat`, e.g. `dd/MM/yyyy`)

`defaultExpiresAt={item.expiresAt ? formatDate(item.expiresAt) : ''}` passes a localized string
(`31/05/2026`) into `UploadReviewDialog`, which binds it to `<Input type="date">` whose `value`
**must** be ISO `yyyy-MM-dd`. A non-ISO value is rejected by the date input, so the admin opens the
approve tab with an empty expiry and must re-pick manually — defeating the D-07 auto-fill.

**Existing analog:** the *portal* side does this correctly —
`portal-upload-replacement-container.tsx:15-17` defines `toIsoDate(d).slice(0,10)` and passes ISO
into the same kind of date input. The dashboard side must do the same.

**Idiomatic fix:** pass an ISO date to `defaultExpiresAt` (e.g. `toIsoDate(new Date(item.expiresAt))`
or share the portal's `toIsoDate` helper), never `formatDate()`.

### CF-M2 — Compliance dashboard + portal containers skip the `AnimateIn` entrance convention used by every sibling top-level surface
**Files:**
- `apps/web-vite/src/components/compliance/dashboard/compliance-dashboard-container.tsx:62-106` (bare `<main>`)
- `apps/web-vite/src/components/portal/compliance/portal-compliance-container.tsx:14` (bare `<div>`)

Every neighboring list/dashboard container wraps its header + body in staggered `AnimateIn`:
`approval-queue-container.tsx:114,118`, `payments-container.tsx`, `equipment-list-container.tsx`.
The memory convention `project_web_vite_entrance_animation` documents `AnimateIn` as the single
entrance system. Both new compliance containers render with no entrance animation, so they pop in
inconsistently versus the rest of the dashboard/portal.

**Idiomatic fix:** wrap the page header and the KPI/table block in `AnimateIn` (`delay={0}` /
`delay={1}`) per `approval-queue-container.tsx`.

### CF-M3 — Compliance dashboard hand-rolls page chrome instead of `WorkbenchPageHeader` + `WORKBENCH_TABLE_*` layout primitives used by sibling dashboards
**File:** `apps/web-vite/src/components/compliance/dashboard/compliance-dashboard-container.tsx:62-77`

The container uses a raw `<main>` + `<h1 className="text-2xl font-semibold">` + a bare `<section>`,
whereas the closest analog (`approval-queue-container.tsx:112-122`) composes
`WorkbenchPageHeader title/description` + `WORKBENCH_TABLE_PAGE_FILL_CLASS` /
`WORKBENCH_TABLE_SECTION_CLASS` / `SectionLabel`. The compliance dashboard has no
description/subtitle and no shared section chrome, so its visual rhythm and fill behavior diverge
from approvals/payments/equipment.

**Idiomatic fix:** adopt `WorkbenchPageHeader` + the `WORKBENCH_TABLE_*` classes and `SectionLabel`
(with the per-tab icon) so the dashboard matches the workbench list-page shell.

### CF-M4 — `itemId`/`documentId` validated as `z.string().min(1)` instead of the router's `cuid` idiom
**File:** `packages/api/src/routers/compliance/classification.ts:193,677,741-743,750-751,833-834`

All Phase-73 inputs accept `z.string().min(1)` for ids. The same router validates every other id
with the shared `cuid` validator (`getDraftInput`, `getByIdInput`, `listByContractorInput`, etc. —
15 `cuid` uses). Loosening to `min(1)` lets malformed ids reach Prisma (still org-scoped, so not a
security hole, but it diverges from the router's own boundary-tightness idiom and weakens the
fast-fail).

**Idiomatic fix:** use `cuid` for `itemId`/`documentId` (matching the rest of this router); keep
`expiresAt` as `z.string().date()` and the closed-enum reason categories as-is.

---

## LOW

### CF-L1 — Status-badge className map is copy-pasted into 3 files (claims "single source of truth" but is a fork)
**Files:**
- `apps/web-vite/src/components/compliance/dashboard/at-risk-table/columns.tsx:17-23` (comment: "Mirrors the status badge palette in tab-compliance.tsx (single source of truth)")
- `apps/web-vite/src/components/portal/compliance/portal-compliance-list.tsx:11-16`
- `apps/web-vite/src/components/contractors/contractor-profile/tab-compliance.tsx:45-51`

The same `SATISFIED/MISSING/EXPIRED/WAIVED → className` map is duplicated verbatim across three
files (the dashboard copy even drops the `PENDING` row that `tab-compliance` has). The comment
calling `tab-compliance.tsx` the "single source of truth" is aspirational — nothing imports from
there.

**Existing analog:** the codebase has a strong idiom of dedicated `*-status-badge.tsx` components
that own a `Record<Status, variant>` map + `tKey`/`enumKey` + `aria-label`:
`equipment-status-badge.tsx`, `shipment-status-badge.tsx`, `zatca-status-badge.tsx`.

**Idiomatic fix:** extract a single `ComplianceStatusBadge` component (variant/className map +
`tDynLoose(t,'status',enumKey(status))` + `aria-label`) and consume it from all three surfaces —
mirroring `EquipmentStatusBadge`.

### CF-L2 — `DocNameCell` / `ExpiresAtCell` / `complianceItemHref` duplicated verbatim between the two dashboard column files
**Files:**
- `apps/web-vite/src/components/compliance/dashboard/at-risk-table/columns.tsx:13-15,25-43`
- `apps/web-vite/src/components/compliance/dashboard/upcoming-renewals-table/columns.tsx:9-31`

`complianceItemHref`, `DocNameCell`, and `ExpiresAtCell` are byte-identical copies across the
at-risk and upcoming-renewals column factories.

**Idiomatic fix:** hoist the three shared cells/helpers into a small
`dashboard/shared-columns.tsx` (or `dashboard/cells.tsx`) and import from both — matching how
`equipment-columns.tsx` factors `NameCell`/`AssigneeCell` into reusable cell components.

### CF-L3 — `daysUntil` computed in browser-local TZ, diverging from the backend's jurisdiction-TZ expiry boundary (carried from 73-REVIEW IN-5, still unfixed)
**File:** `apps/web-vite/src/components/compliance/dashboard/upcoming-renewals-table/columns.tsx:33-37`

`new Date(expiresAt).getTime() - Date.now()` resolves in the admin's local TZ; the authoritative
band is `daysUntilExpiryInTz` in the contractor's `expiryJurisdictionTz`
(`packages/compliance-policy/src/expiry.ts`). The "days left" cell can be off by one at TZ
boundaries vs the reminder bands.

**Idiomatic fix:** surface a server-computed `daysUntil` in the row payload, or document it as an
approximate local-TZ display.

### CF-L4 — Error toasts surface raw `err.message` (TRPC error keys / internals) (carried from 73-REVIEW IN-6, still unfixed)
**Files:**
- `apps/web-vite/src/components/contractors/compliance/hooks/use-override-compliance-item.ts:41`
- `apps/web-vite/src/components/contractors/compliance/hooks/use-upload-review.ts:40,51`
- `apps/web-vite/src/components/portal/compliance/hooks/use-portal-upload-replacement.ts:62`

`toast.error(err.message || t('toast.error'))` shows the bare server message — for the
translation-key-style messages these routers throw (`complianceItemNotFound`,
`COMPLIANCE_DOCUMENT_NOT_PENDING_REVIEW`) the admin sees a raw key/constant, and for unexpected
errors it can leak internals.

**Idiomatic fix:** show the localized fallback and log the raw message, or map known TRPC error
codes to localized toasts.

### CF-L5 — Dashboard error branch interpolates `String(dash.error)` into the UI (carried from 73-REVIEW IN-4, still unfixed)
**File:** `apps/web-vite/src/components/compliance/dashboard/compliance-dashboard-container.tsx:43`

`{t('errorLoading')}: {String(dash.error)}` renders the raw TRPC/Error string. The sibling Phase-73
error states (`portal-compliance-container.tsx:27-29`, `compliance-item-history.tsx:41-44`)
correctly show only the translated message.

**Idiomatic fix:** drop the `String(dash.error)` interpolation; show only `t('errorLoading')` and
log the raw error via the client logger.

### CF-L6 — Inline `// WR-1:` code-review-finding tags left in shipped source
**File:** `packages/api/src/routers/compliance/classification.ts:756,855` (also `portal.ts:1797`)

`// WR-1: verify the document is PENDING_REVIEW …` references this review's finding ID. Unlike the
`Phase/Plan/D/T` planning breadcrumbs (which match house style), review-finding IDs have **no**
precedent in the tree and read as scaffolding. Per `feedback_no_legacy_comments`, the *why* belongs
in the comment, not the ticket ID.

**Idiomatic fix:** keep the explanatory text, drop the `WR-1:` / `CR-2:` prefixes (e.g.
`// Verify the document is PENDING_REVIEW, in-org, and linked to this contractor …`).

---

### CF-L7 — Portal upload form `<Label htmlFor="upload-dropzone">` is orphaned — DropZone exposes no matching control (carried from 73-REVIEW WR-6, still unfixed)
**Files:**
- `apps/web-vite/src/components/portal/compliance/portal-upload-replacement-form.tsx:49-50`
- `apps/web-vite/src/components/documents/drop-zone-container.tsx:4-11` (`DropZone` props — no `id`/`inputId`)
- `apps/web-vite/src/components/documents/drop-zone.tsx:21-25,58-69` (`DropZoneView` — no id passthrough to `<FileUpload>`)

`<Label htmlFor="upload-dropzone">` points at an id that nothing renders: `DropZone`/`DropZoneView`
accept no `id`/`inputId` and don't expose the internal `FileUpload` input under that id. Clicking
the label focuses nothing and screen readers don't associate it with the file control (the adjacent
`expiresAt` label/input pair *is* correctly associated). Verified `DropZoneView` has no id prop.

**Existing analog:** the closest upload surface, `invoice-submit-upload.tsx:60-67`, labels its
DropZone with a `<h2>` heading and `getInputProps()` rather than an `htmlFor` association — i.e. the
idiomatic pattern is **not** to point `htmlFor` at a DropZone.

**Idiomatic fix:** drop the `htmlFor` and use a heading/`aria-label` like
`invoice-submit-upload.tsx`, or thread an `id`/`inputId` prop through `DropZone` → `DropZoneView` →
`FileUpload` that matches the label.

---

## INFO

### CF-I1 — `itemAuditTrail` JSON filter can't use the GIN index it was built for; migration comment now actively lies (carried from 73-REVIEW IN-1, still unfixed)
**Files:**
- `packages/api/src/routers/compliance/classification.ts:692` (`metadataJson: { path:['itemId'], equals }` → `->>'itemId' = $1`)
- `packages/db/.../20260428000000_*/migration.sql:28-33` (GIN, accelerates `@>` only)
- `classification.ts:671-672` (comment claims the query is "backed by the partial GIN index")

The path-equality predicate cannot use the containment (`@>`) GIN index, so the D-13 index is dead
weight and both the migration comment ("queries … use `@> '{"itemId":"..."}'::jsonb`") and the
router comment are now false.

**Idiomatic fix:** either switch the lookup to a raw `@>` containment `$queryRaw`, or drop the GIN
index and rely on the `(organizationId, resourceType, resourceId)` btree + `take` — and correct
both comments either way.

### CF-I2 — Two `CREATE INDEX` (non-CONCURRENTLY) lock compliance + AuditLog on deploy (carried from 73-REVIEW IN-2, still unfixed)
**File:** `packages/db/.../20260428000000_*/migration.sql:25-33`

Both indexes build with an `ACCESS EXCLUSIVE` lock. Local-only deploy posture today, but on a
populated Neon prod the `AuditLog` GIN build would block writes.

**Idiomatic fix:** if these tables are sizeable in prod, build `CONCURRENTLY` in a separate
non-transactional step or schedule a maintenance window.

### CF-I3 — `OverrideComplianceItemButton` declares + receives an unused `contractorId` prop (dead prop-drill) (carried from 73-REVIEW IN-3, still unfixed)
**Files:**
- `apps/web-vite/src/components/contractors/compliance/override-compliance-item-button.tsx:10,22-26`
- passed at `compliance-dashboard-container.tsx:84` and `tab-compliance.tsx:170`

`contractorId` is in the props interface and passed by both call sites but never destructured/used
in the body. `noUnusedVariables` doesn't catch unused interface members.

**Idiomatic fix:** drop `contractorId` from the props + both call sites (or use it in an
`aria-label`/analytics if intended).

### CF-I4 — Index-as-key on static skeleton/KPI lists without the repo's `biome-ignore` annotation
**Files:**
- `apps/web-vite/src/components/compliance/dashboard/compliance-dashboard-skeleton.tsx:12,21`
- `apps/web-vite/src/components/portal/compliance/portal-compliance-container.tsx:20`

`[0,1,2].map(i => <div key={i}>)` / `{[0,1,2,3].map(i => <Skeleton key={i}>)}`. The codebase's
convention for legitimately-static index keys is an explicit
`// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list` (see
`approval-queue-container.tsx:153`).

**Idiomatic fix:** either key on a stable token (e.g. `key={`kpi-${i}`}`) or add the same
`biome-ignore` annotation the neighbors use.

### CF-I5 — `satisfiedByDocumentId` overloaded as a pre-approval "candidate pending doc" pointer
**Files:**
- `packages/api/src/routers/portal/portal.ts:1812-1815` (set while item is still MISSING/EXPIRED)
- `packages/api/src/routers/core/contractor.ts:634-654` (re-derives `pendingReviewDocumentId` from it + doc status)

The column name asserts the item is *satisfied by* this document, but it is written
optimistically while the item is unsatisfied (pending review). It works because `contractor.ts`
re-checks `status !== 'SATISFIED'` + doc `PENDING_REVIEW`, and reject clears it — but the column
semantics are stretched.

**Idiomatic fix (optional):** acceptable given the guard + comments; if a dedicated
`pendingReviewDocumentId` column is ever added it would remove the overload. No action required
short-term.

---

## What conformed (verified, no action)

- **Page → Container → Hook → Component** layering is correct on every Phase-73 surface; pages are
  thin `Suspense` shells matching `pages/portal/*` and `pages/dashboard/*`.
- **`useQuery` + manual loading/empty/error** (no `useSuspenseQuery`) matches the universal
  web-vite idiom (0 `useSuspenseQuery` in the app).
- **DialogBody/DialogFooter** convention followed in both dialogs (matches `project_web_vite_dialog_pattern`).
- **`DataTable`** canonical usage (clientPagination, `entityLabel`/`emptyTitle`/`noResultsTitle`,
  `renderRowActions`) is consistent.
- **`tDynLoose`+`enumKey`** status/category rendering now matches `workflows/templates/data-table.tsx`
  and `audit-log/data-table.tsx`.
- **Dashboard service shape** (`(db, organizationId, …)`, structural `DashboardClient`, loose
  `Promise<unknown>`, `createLogger({service})`, graceful live-probe degradation) mirrors its cited
  analog `compliance-payment-gate.ts` exactly.
- **RBAC / audit / tenant**: double-gated override+review (`can` + `requirePermission`), every
  mutation `writeAuditLog` in-tx with `previousStatus`/role snapshot, all reads org-scoped, portal
  strictly bound to session `contractorId` — all conformant (confirmed by 73-REVIEW, re-verified).
- **Phase/Plan/D/T breadcrumb comments** match the sibling compliance-service house style — not a
  divergence.

---

## Summary

| Severity | Count |
|----------|-------|
| High     | 1  |
| Medium   | 4  |
| Low      | 7  |
| Info     | 5  |
| **Total**| **17** |

**Top items:**
1. **CF-H1** — admin compliance procedures are trapped in the flag-gated `classification` namespace;
   the dashboard/override/review loop 404s for any org without `module.classification-engine`. Move
   to an always-mounted `compliance` router (analog: `einvoice`/`zatca`/portal procedures).
2. **CF-M1** — `tab-compliance` feeds a localized date into `<input type="date">`, blanking the
   approve auto-fill (portal side already does ISO correctly — copy that).
3. **CF-M2/M3** — dashboard skips `AnimateIn` + `WorkbenchPageHeader`/`WORKBENCH_TABLE_*` chrome that
   every sibling top-level surface uses.
4. **CF-L1/L2** — status-badge map and dashboard cell components are copy-pasted 3×/2×; extract a
   `ComplianceStatusBadge` + shared column cells (analog: `EquipmentStatusBadge`).

Carried-forward-and-still-open from 73-REVIEW: IN-1 (CF-I1), IN-2 (CF-I2), IN-3 (CF-I3),
IN-4 (CF-L5), IN-5 (CF-L3), IN-6 (CF-L4). WR-6 from 73-REVIEW (orphaned DropZone `<Label htmlFor>`)
remains unfixed — `DropZoneView`/`DropZone` expose no `id`/`inputId`, so
`portal-upload-replacement-form.tsx:49` `<Label htmlFor="upload-dropzone">` is dangling; the
idiomatic neighbor (`invoice-submit-upload.tsx`) uses a heading, not `htmlFor`, against the DropZone.
(Tracked here as part of the carried-forward set; see WR-6.)
