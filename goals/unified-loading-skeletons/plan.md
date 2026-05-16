# Plan: Unified Skeleton Loading Animations

## Approach

Audit-and-fix pass across web + portal apps. No new primitives needed — `SectionLabel`, `DataTableBody`, `AtelierTableShell`, `Skeleton`, and `PageLoadingSpinner` already exist. Work is adoption and migration.

Ordered by risk: table migrations (highest structural change) first, then missing loading states, then SectionLabel additions, then page-level Suspense standardization.

---

## Steps

### Step 1 — Migrate non-standard tables to DataTableBody

**Files touched:**
- `apps/web/src/components/settings/audit-log-table.tsx`
- `apps/web/src/components/settings/slack-user-mapping.tsx`
- `apps/web/src/components/invoices/intake/intake-list.tsx`
- `apps/web/src/components/contractors/contractor-profile/tab-equipment.tsx`

**What to do per file:**
- `audit-log-table.tsx`: Remove manual `isLoading` skeleton block (lines ~240-278). Add `skeletonColumns` descriptor: timestamp→text, actor→text, action→text, resource→badge, details→actions. Wrap in `AtelierTableShell` with `isLoading` prop.
- `slack-user-mapping.tsx`: Remove manual 5-row skeleton (lines ~168-186). Add `skeletonColumns`: user→avatar, name→text, email→text, status→badge, action→actions.
- `intake-list.tsx`: Replace 5-row uniform Skeleton with `DataTableBody` + `skeletonColumns`: supplier→text, invoiceNumber→text, date→text, total→text, level→badge, status→badge, validation→badge. Wrap in `AtelierTableShell`.
- `tab-equipment.tsx`: Remove custom `isLoading` 5-row skeleton. Add `skeletonColumns`: name→text, serialNumber→text, status→badge, shipment→text.

**Verification:** Each table renders skeleton rows on first load; overlay on refetch; no empty state flash; toolbar disabled during load.

---

### Step 2 — Fix card widgets returning null during load

**Files touched:**
- `apps/web/src/components/dashboard/tax-obligations-widget.tsx`
- `apps/web/src/components/onboarding/onboarding-checklist.tsx`

**What to do:**
- `tax-obligations-widget.tsx`: Replace `if (isLoading) return null` with a Card skeleton:
  - Card header: `Skeleton h-5 w-32`
  - Two sections, each with 3 rows: `Skeleton h-4 w-24` (label) + `Skeleton h-4 w-16` (value) + `Skeleton h-5 w-14 rounded-full` (badge)
- `onboarding-checklist.tsx`: Replace `if (permissionsLoading || settingsLoading) return null` with a Card skeleton:
  - Title: `Skeleton h-6 w-40`
  - Progress bar: `Skeleton h-2 w-full`
  - 6 step items: `Skeleton h-6 w-6 rounded-full` (indicator) + `Skeleton h-4 w-48` (title)
  - Footer: `Skeleton h-8 w-24`

**Verification:** Both widgets render skeleton placeholder while queries are in-flight. Widget never disappears from layout during load.

---

### Step 3 — Add SectionLabel to tables/sections that lack it

**Files touched:**
- `apps/web/src/app/[locale]/(dashboard)/time/page.tsx` (or its content component)
- `apps/web/src/app/[locale]/(dashboard)/invoices/intake/page.tsx` (or IntakeList wrapper)
- `apps/web/src/app/[locale]/(dashboard)/equipment/page.tsx` — verify, add if missing
- `apps/web/src/app/[locale]/(dashboard)/reports/page.tsx` — verify, add above report tables
- All contractor detail page tabs (`tab-contracts.tsx`, `tab-equipment.tsx`, `tab-documents.tsx`, `tab-payments.tsx`, invoices tab, workflows tab) — add `SectionLabel` above each sub-table
- All other detail pages (`invoices/[id]`, `contracts/[id]`) — add `SectionLabel` above any nested data sections

**Pattern:**
```tsx
<SectionLabel icon={Clock}>Time Entries</SectionLabel>
<DataTable ... />
```

**Verification:** Every table/list with fetched data has a SectionLabel header visible above it.

---

### Step 4 — Verify and standardize e-invoice compliance widget

**Files touched:**
- `apps/web/src/components/einvoice/compliance-widget.tsx`

**What to do:** Read current skeleton implementation. If partial, complete it to match full card layout (status card per market with indicators). Ensure no `return null` during load.

**Verification:** Compliance widget renders skeleton matching its card layout while query is pending.

---

### Step 5 — Create portal section header variant + audit portal loading states

**Files touched:**
- `packages/ui/src/components/atelier/section-label.tsx` — add `variant="portal"` prop (or create `PortalSectionLabel`): uppercase text + divider only, no icon chip
- `apps/web/src/components/portal/portal-return-flow.tsx`
- `apps/web/src/components/portal/invoice-submit-form.tsx`
- All other portal components with `useQuery`

**What to do:**
- Extend `SectionLabel` with `variant="portal"` that renders: `text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60` + fading divider, but no icon chip. Or extract into `PortalSectionLabel` in the same file.
- Read each portal data component. Check if `isLoading`/`isPending` is handled. If missing, add appropriate skeleton (cards for card layouts, rows for list layouts).
- Add portal section headers (lighter variant) above any grouped data sections in portal views.
- Use `isLoading` from React Query for initial load (not `isPending`) consistently.

**Verification:** Portal data components show skeleton on first load. No `return null` during load. Section headers use lighter variant (no icon chip). Web app sections use full `SectionLabel`.

---

### Step 6 — Audit every dashboard page for decoupled loading

**Files to audit (read each):**
- `apps/web/src/app/[locale]/(dashboard)/time/page.tsx`
- `apps/web/src/app/[locale]/(dashboard)/reports/page.tsx`
- `apps/web/src/app/[locale]/(dashboard)/classification/page.tsx`
- `apps/web/src/app/[locale]/(dashboard)/notifications/page.tsx`
- `apps/web/src/app/[locale]/(dashboard)/contractors/[id]/page.tsx`
- `apps/web/src/app/[locale]/(dashboard)/invoices/[id]/page.tsx`
- `apps/web/src/app/[locale]/(dashboard)/contracts/[id]/page.tsx`
- `apps/web/src/app/[locale]/(dashboard)/equipment/page.tsx`
- `apps/web/src/app/[locale]/(dashboard)/payments/page.tsx`

**What to check per page:**
- Is there a single Suspense boundary gating the entire page on one query? → Break into component-level queries
- Does one slow endpoint block siblings from rendering? → Each section should own its query + local loading state
- Does the page-level Suspense boundary serve only nuqs hydration? → Good if so

**Fix pattern:** Page Suspense wraps only the content component (for nuqs). Each widget/table inside manages its own React Query hook + loading state. No waterfall of dependent queries blocking page render unless truly sequential.

**Verification:** In devtools, throttle one endpoint to slow — sibling sections still render their own data/skeletons independently.

---

### Step 7 — Standardize page-level Suspense fallbacks

**Files touched:**
- `apps/web/src/app/[locale]/(dashboard)/time/page.tsx` — uses custom `LoadingSkeleton()`
- `apps/web/src/app/[locale]/(dashboard)/notifications/page.tsx` — uses custom `NotificationsLoading()`

**What to do:** Replace custom Suspense fallback functions with `PageLoadingSpinner` to match the established pattern (contractors, invoices, payments, workflows all use `PageLoadingSpinner`). The page-level spinner is only a brief flash during nuqs hydration — detailed skeletons are at component level.

**Verification:** All dashboard pages use `<Suspense fallback={<PageLoadingSpinner />}>` as the page-level boundary. Brief spinner on hard navigation, then component skeletons take over.

---

## Risks & Open Questions

- **intake-list cursor pagination**: DataTableBody was designed for offset pagination. Full migration includes preserving the `Load More` cursor pattern — verify `DataTableBody` render is compatible or add cursor pagination support before migrating.
- **reports/page.tsx charts**: Reports page has multiple chart types — verify each chart component passes `isLoading` correctly from its query hook.
