---
status: issues-found
phase: 73
phase_name: F1 Compliance — Admin Dashboard + Portal Self-Service + i18n
depth: deep
review_type: standards + quality (manual, lint-complement)
files_reviewed: 33
findings:
  critical: 2
  warning: 6
  info: 6
  total: 14
reviewer: gsd-code-review (manual, inline)
date: 2026-06-01
---

# Phase 73 Code Review — F1 Compliance Dashboard / Portal Self-Service / i18n

Scope: source files changed by the phase-73 feat/test commits (web-vite UI, `packages/api`
classification + portal routers, `packages/api` dashboard service, `packages/auth`,
`packages/compliance-policy`, `packages/validators`, Prisma migration). Generated lint guards
already ran; this review covers only what they cannot catch: layering, a11y, i18n correctness,
end-to-end wiring, RBAC/tenant/audit semantics, and DRY/SOLID.

Tests (`*.test.ts(x)`) and generated Prisma client files were read for intent but not graded.

---

## CRITICAL

### CR-1 — Portal upload-replacement flow is broken end-to-end (no Document/DocumentLink ever created; wrong upload purpose)
**Files:**
- `apps/web-vite/src/components/portal/compliance/hooks/use-portal-upload-replacement.ts:35-49`
- `packages/api/src/routers/portal/portal.ts:869-899` (`getUploadUrl`)
- `packages/api/src/routers/portal/portal.ts:1713-1769` (`submitUploadReplacement`)
- `packages/api/src/services/pending-upload.ts:40-44,117-144`

The contractor self-service upload chain cannot succeed against a real backend:

1. The hook calls `portal.getUploadUrl({ contentType: file.type || 'application/octet-stream' })`.
   `getUploadUrl`'s input refines `contentType` to **exactly `application/pdf`**
   (`portal.ts:873`). Any non-PDF compliance scan (PNG/JPEG — which the form's own comment at
   `portal-upload-replacement-form.tsx:22-26` claims is allowed) is rejected at the edge.
2. `getUploadUrl` mints a `PendingUpload` row with `purpose: 'PORTAL_INVOICE_SUBMIT'` and
   **does not create a `Document` row** (by design — `submitInvoice` later creates it via
   `consumePendingUpload`).
3. `submitUploadReplacement` then does `tx.document.update({ where: { id: documentId } })`
   (`portal.ts:1748`) on a Document that **was never created**, and additionally requires a
   pre-existing `DocumentLink` (`entityType: CONTRACTOR`, `entityId: contractorId`) which
   **nothing in this flow creates** (`portal.ts:1736-1747`). At runtime the `document.update`
   throws Prisma `P2025` (record not found); even if a Document existed, the `documentLink`
   guard returns `NOT_FOUND`.
4. `submitUploadReplacement` never calls `consumePendingUpload`, so the F-SEC-01 pending-upload
   row is orphaned and the server-trusted `storageKey` is never bound to a Document.

Net effect: the contractor portal "Renew now" flow is non-functional for every document type.
The unit test (`packages/api/src/__tests__/compliance-portal-upload.test.ts:22-36,170-180`)
mocks `document.update` to succeed and stubs a `documentLink.findFirst` hit, so it is
**false-green** — it never exercises the missing Document creation, the purpose mismatch, or the
missing link creation.

**Fix:** mirror `submitInvoice`. Add a `PORTAL_COMPLIANCE_UPLOAD` purpose to
`PendingUploadPurpose`; have the upload-replacement hook request that purpose with the real
file MIME (relax `getUploadUrl`'s `application/pdf`-only refinement to an allowlist that includes
pdf/png/jpeg, gated by purpose). In `submitUploadReplacement`, `consumePendingUpload(...)` to
recover the trusted `storageKey`, `document.create({ id: documentId, status: 'PENDING_REVIEW', ... })`,
create the `DocumentLink(CONTRACTOR, contractorId)`, then write the audit row — all inside the
existing `$transaction`. Replace the stubbed unit test with one that asserts Document + link
creation and rejects a foreign/expired pending row.

### CR-2 — Admin upload-review surface (D-08 approve/reject) is built but never mounted — dead code
**Files:**
- `apps/web-vite/src/components/contractors/compliance/upload-review-dialog.tsx`
- `apps/web-vite/src/components/contractors/compliance/upload-review-dialog-container.tsx`
- `apps/web-vite/src/components/contractors/contractor-profile/tab-compliance.tsx` (mounts override + history, **not** upload-review)

`UploadReviewDialog` / `UploadReviewDialogContainer` and the `useUploadReview` hook implement the
admin approve/reject of a `PENDING_REVIEW` upload, but a repo-wide search finds **zero** importers
outside the two files themselves and their test. There is no button, badge, or surface anywhere
(Compliance tab, dashboard rows, or a dedicated review queue) that opens this dialog.
`tab-compliance.tsx` has no handling for `PENDING_REVIEW` items and `OverrideComplianceItemButton`
only renders for `MISSING`/`EXPIRED` (`override-compliance-item-button.tsx:31-34`).

Combined with CR-1, the contractor→admin compliance loop is dead at both ends: contractors can't
upload, and even if a Document reached `PENDING_REVIEW`, no admin UI exists to approve/reject it.

**Fix:** mount a "Review upload" entry point on the Compliance tab (and/or a dashboard
"pending review" tab) for items whose linked Document is `PENDING_REVIEW`, wiring
`UploadReviewDialogContainer` with `{ itemId, documentId, defaultExpiresAt }`. The data layer
must expose the pending documentId per item (currently no query returns it).

---

## WARNING

### WR-1 — `approve/rejectUploadReplacement` mutate an unvalidated client `documentId` (in-org IDOR / integrity)
**File:** `packages/api/src/routers/compliance/classification.ts:736-789, 798-854`

`documentId` comes straight from client input and is written as `satisfiedByDocumentId`
(approve) and flipped to `ACTIVE`/`ARCHIVED` with **no check** that the document (a) belongs to
the item's contractor, (b) is currently `PENDING_REVIEW`, or (c) is linked to the item at all.
The tenant extension scopes `document.update` by `organizationId` (`packages/db/src/tenant.ts:82`),
so this is not cross-tenant — but a compliance admin can mark an arbitrary same-org document
(e.g. an unrelated invoice PDF) as the item's satisfying document, corrupting
`satisfiedByDocumentId` and silently activating/archiving an unrelated Document.

**Fix:** in both mutations, load the Document via `findFirst({ where: { id: documentId,
organizationId } })`, assert `status === 'PENDING_REVIEW'`, and assert it is linked to
`item.contractorId` (DocumentLink CONTRACTOR) before mutating. Throw `PRECONDITION_FAILED`
otherwise.

### WR-2 — Dashboard section `aria-label` resolves to a missing i18n key (wrong casing)
**File:** `apps/web-vite/src/components/compliance/dashboard/compliance-dashboard-container.tsx:70`

`<section aria-label={t(`${tab.replace('-', '')}.label`)}>` produces `atrisk.label`,
`upcomingrenewals.label`, `blockedpayments.label`. The catalog keys are camelCase
(`atRisk.label`, `upcomingRenewals.label`, `blockedPayments.label` — verified present in all four
locales). `String.replace('-', '')` also only strips the first hyphen. The section's accessible
name therefore falls back to the raw missing-key string for screen-reader users.

**Fix:** map the tab to its key explicitly, e.g.
`const LABEL_KEY = { 'at-risk': 'atRisk.label', 'upcoming-renewals': 'upcomingRenewals.label', 'blocked-payments': 'blockedPayments.label' }` and use `t(LABEL_KEY[tab])`.

### WR-3 — Status badges render the raw enum instead of a translated label
**Files:**
- `apps/web-vite/src/components/compliance/dashboard/at-risk-table/columns.tsx:71-73`
- `apps/web-vite/src/components/portal/compliance/portal-compliance-list.tsx:26-28`

Both render `{row.original.status}` / `{item.status}` — `"SATISFIED"`, `"MISSING"`,
`"EXPIRED"`, `"WAIVED"` — as user-facing text. `tab-compliance.tsx:129,141` already does this
correctly via `tDynLoose(t, 'status', enumKey(statusKey))` against
`ContractorProfile.compliance.status.*`. The new Phase 73 surfaces bypass that catalog and show
the untranslated uppercase enum (and there is no `Compliance.dashboard.status.*` catalog).

**Fix:** route status through a shared translated-status helper (reuse the
`ContractorProfile.compliance.status` keys or add `Compliance.dashboard.status.*`), keeping the
badge color map keyed on the raw enum.

### WR-4 — Blocked-payments column renders a translation KEY verbatim (not translated)
**File:** `apps/web-vite/src/components/compliance/dashboard/blocked-payments-table/columns.tsx:38`

`reason.documentTypeLabelKey` is a translation key — the payment gate stores
`getDocumentTypeLabelKey(...)` into it (`packages/api/src/services/compliance-payment-gate.ts:150`).
The cell renders `{reason.documentTypeLabelKey}` raw, so the admin sees a literal key string
(e.g. `Compliance.documentType.compliance-policy-engine.uk.right_to_work`) instead of the
localized document name.

**Fix:** render `{t(reason.documentTypeLabelKey)}` (or the existing `useComplDocName`/
`Compliance.documentType.*` resolver) rather than the raw key.

### WR-5 — Arabic (RTL) locale is entirely untranslated for all Phase 73 UI (86/86 keys = English)
**File:** `apps/web-vite/messages/ar.json` (all `Compliance.dashboard|override|uploadReview|history`
and `Portal.compliance` keys)

All 86 new Phase 73 UI strings in `ar.json` are byte-identical to the English values (German has
only 3 such shared terms). The phase title claims i18n with `ar` RTL, but the entire F1 compliance
admin dashboard and portal self-service surface is English-only for Arabic users. The parity guard
passes because it checks key *presence*, not value translation, so this slipped through.
Additionally the ICU plural strings copied into `ar` (e.g. `daysValue`,
`{count, plural, one {# day} other {# days}}`) only carry `one`/`other`; Arabic requires
`zero/one/two/few/many/other` for grammatically correct counts.

**Fix:** translate the Phase 73 `ar` strings (and supply full Arabic plural categories). Consider
strengthening the i18n guard to flag values identical to the `en` source for non-`en` locales as a
warning so machine-translation gaps surface in CI.

### WR-6 — DropZone `<Label htmlFor>` does not match any control (broken label association)
**File:** `apps/web-vite/src/components/portal/compliance/portal-upload-replacement-form.tsx:49-50`

`<Label htmlFor="upload-dropzone">` points at id `upload-dropzone`, but `<DropZone>`
(`../../documents/drop-zone-container.js`) is mounted with no `id="upload-dropzone"` passed and
does not expose its internal file input under that id. The label is therefore orphaned (clicking
it focuses nothing; screen readers don't associate it with the file control). The adjacent
`expiresAt` label/input pair (`:55-62`) is correctly associated.

**Fix:** pass an `id`/`inputId` to `DropZone` that matches the label's `htmlFor`, or wrap the
DropZone in the `<Label>` and drop `htmlFor`.

---

## INFO

### IN-1 — `itemAuditTrail` query cannot use the partial GIN index it was built for
**Files:**
- `packages/api/src/routers/compliance/classification.ts:686-695`
- `packages/db/prisma/schema/migrations/20260428000000_.../migration.sql:31-33`

The query filters with `metadataJson: { path: ['itemId'], equals: input.itemId }`, which Prisma
compiles to a `->>'itemId' = $1` path-equality. The migration creates
`USING GIN ("metadataJson") WHERE "resourceType" = 'CONTRACTOR'`, which only accelerates
containment (`@>`) operators — not `->>` path-equality. The migration comment itself says the
query should be `metadataJson @> '{"itemId":"..."}'::jsonb`, but the code does not use containment.
Result: the D-13 history index is effectively unused; the query falls back to the
`(organizationId, resourceType, resourceId)` predicate + filter. Low impact today, but the index
is dead weight and the timeline lookup won't scale as intended.

**Fix:** either switch the Prisma filter to a containment predicate (raw `$queryRaw` with `@>`, or
`metadataJson: { path: ['itemId'], ... }` is not enough — Prisma has no `@>` sugar for typed JSON,
so a small raw query keyed on `@>` is the pragmatic option), or drop the GIN index and rely on the
existing btree, documenting the decision.

### IN-2 — Migration `CREATE INDEX` (non-CONCURRENTLY) locks compliance + audit tables on deploy
**File:** `packages/db/prisma/schema/migrations/20260428000000_.../migration.sql:25-33`

The two `CREATE INDEX` statements run without `CONCURRENTLY`, taking an `ACCESS EXCLUSIVE` lock on
`ContractorComplianceItem` and `AuditLog` for the duration of the build. On a populated multi-region
Neon prod (`AuditLog` in particular grows large), this blocks writes during migration. Note this is
a posture/deploy-safety observation, not a correctness bug (local-only deploy posture per PROJECT.md).

**Fix:** if these tables are sizeable in prod, build with `CREATE INDEX CONCURRENTLY` in a separate
non-transactional migration step, or schedule during a maintenance window.

### IN-3 — `OverrideComplianceItemButton` takes a `contractorId` prop it never uses (dead prop-drill)
**File:** `apps/web-vite/src/components/contractors/compliance/override-compliance-item-button.tsx:11`

`contractorId` is declared in the props interface and passed by both call sites
(`compliance-dashboard-container.tsx:79`, `tab-compliance.tsx:120`) but is destructured away and
never used in the component body (`:22-26`). Lint `noUnusedVariables` doesn't flag unused interface
members, so it persists.

**Fix:** drop `contractorId` from the props and both call sites, or use it (e.g. in an
`aria-label`/analytics) if it was intended.

### IN-4 — Dashboard error branch interpolates the raw error into the UI
**File:** `apps/web-vite/src/components/compliance/dashboard/compliance-dashboard-container.tsx:43-44`

`{t('errorLoading')}: {String(dash.error)}` renders the raw TRPC/Error string to the admin.
Low risk (admin-only, same-org), but it can leak internal messages/stack fragments and is not
localized. Other Phase 73 error states (`portal-compliance-container.tsx:27-29`,
`compliance-item-history.tsx:41-44`) correctly show only the translated message.

**Fix:** drop the `String(dash.error)` interpolation; show only `t('errorLoading')` (log the raw
error via the client logger if diagnostics are needed).

### IN-5 — `daysUntil` in upcoming-renewals is not TZ-aware (inconsistent with backend boundary semantics)
**File:** `apps/web-vite/src/components/compliance/dashboard/upcoming-renewals-table/columns.tsx:33-37`

`daysUntil` computes `new Date(expiresAt).getTime() - Date.now()` in the browser's local TZ. The
backend deliberately resolves expiry boundaries in the contractor's `expiryJurisdictionTz`
(`packages/compliance-policy/src/expiry.ts:42-50` `daysUntilExpiryInTz`). The dashboard "days left"
can therefore be off by a day at TZ boundaries vs. the authoritative reminder bands. Display-only,
but worth aligning to avoid admin confusion.

**Fix:** either accept a server-computed `daysUntil` in the row payload, or document that the
dashboard figure is an approximate local-TZ display.

### IN-6 — Error toast surfaces raw server `err.message`
**Files:**
- `apps/web-vite/src/components/contractors/compliance/hooks/use-override-compliance-item.ts:41`
- `apps/web-vite/src/components/contractors/compliance/hooks/use-upload-review.ts:40,51`
- `apps/web-vite/src/components/portal/compliance/hooks/use-portal-upload-replacement.ts:55`

`toast.error(err.message || t('toast.error'))` shows the raw error string. For the typed TRPC
errors these routers throw (translation-key-style messages like `complianceItemNotFound`), the
toast will display the bare key rather than a localized sentence; for unexpected errors it can
leak internals. Minor UX/i18n nit.

**Fix:** map known TRPC error messages to localized toasts (or always show the localized fallback
and log the raw message).

---

## What looked good (no action)

- **Layering:** Page → Container → Hook → Component is respected across the dashboard, portal, and
  override/review surfaces. Pages are thin `Suspense` composers; hooks are the sole tRPC boundary;
  containers own loading/empty/error; components are presentational.
- **Loading/empty/error states** are present on every section (dashboard skeleton, portal skeleton
  grid, history disclosure, error `role="alert"`, `AtelierEmptyState`).
- **DialogBody/DialogFooter convention** correctly followed in both the override dialog and the
  upload-review dialog.
- **DataTable** canonical usage (client pagination, `entityLabel`/`emptyTitle`/`noResultsTitle`,
  `renderRowActions` slot) is consistent across all three dashboard tables.
- **RBAC:** override and approve/reject are double-gated — UI `can('compliance', ['override'])`
  plus server `requirePermission({ compliance: ['override'|'read'] })`; the new `compliance`
  resource is correctly distributed across all nine roles (read everywhere, override owner/admin
  only).
- **Audit:** every sensitive mutation (`overrideItem`, approve, reject, portal submit, recompute)
  writes via `writeAuditLog` inside the same `$transaction`, capturing `previousStatus`, actor,
  and a role snapshot.
- **Tenant scoping:** item/portal reads and writes are org-scoped via the tenant extension;
  `complianceItems`/`submitUploadReplacement` are strictly bound to the portal-session
  `contractorId` (no client-supplied id trusted).
- **Portal/platform boundary:** the upload-outcome notification correctly notes contractors have
  no platform `User` and notifies `contractor:read` staff best-effort, wrapped so a dispatch
  failure never rolls back the mutation.
- **i18n key parity:** the keys actually referenced by code exist in all four locales (en/de/pl/ar)
  and the four files have identical line counts — the gap is value translation (WR-5), not
  presence.

---

## By-severity summary

| Severity | Count |
|----------|-------|
| Critical | 2 |
| Warning  | 6 |
| Info     | 6 |
| **Total**| **14** |

Top blockers (fix before shipping the F1 compliance loop):
1. **CR-1** — portal upload-replacement is non-functional (wrong purpose, no Document/link created).
2. **CR-2** — admin approve/reject review UI is built but never mounted.

Both critical items hide behind false-green unit tests (mocked Document/link). The override modal,
audit, RBAC, and tenant scoping are solid; the dominant non-blocking theme is i18n (untranslated
`ar`, raw-enum/raw-key rendering, miscased aria-label).
