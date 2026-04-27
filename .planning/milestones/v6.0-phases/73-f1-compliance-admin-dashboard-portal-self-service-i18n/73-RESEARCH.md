# Phase 73 — Research

**Researched:** 2026-04-27
**Goal:** "What do I need to know to PLAN Phase 73 well?"

Phase 73 surfaces the Phase 71 + 72 compliance engine to humans:

1. **Admin dashboard** at `/compliance/dashboard` — three KPI cards driving a tabbed-table region.
2. **Contractor portal self-service** — `/portal/compliance` sub-route + one-click upload-replacement flow.
3. **Manual admin override → WAIVED** — gated by a new `compliance:override` permission, audit-logged with inline timeline.
4. **i18n parity** — five new per-jurisdiction modules in `packages/validators/src/legal/` keyed by `policyRuleId`, en/pl/de phrase maps, PENDING signoff.

This phase has minimal external research surface — every architectural decision is locked in `73-CONTEXT.md` against existing in-repo twins (Phase 71's `recreate-compliance-assessment` mutation flow, Phase 72's `contractorReasons[]` payload, the `RecomputeComplianceDialog` modal pattern, the v1.0 dashboard KPI-card pattern, the `legal/gb.ts` locked-phrase shape, the `Document` upload pipeline). Research below confirms each twin, names the precise file/function targets, and pins the small set of items left to "Claude's Discretion" in CONTEXT.md.

---

## Architectural Twins (canonical references)

### Twin 1 — Phase 71 `RecomputeComplianceDialog` (D-12 modal pattern)

`apps/web/src/components/contractors/compliance/recompute-compliance-dialog.tsx` is the **single architectural anchor** for D-12 `<OverrideComplianceItemDialog>`.

Confirmed shape (read 2026-04-27):

| Element | Twin construct | Phase 73 mapping |
|---------|----------------|------------------|
| Modal primitive | `AlertDialog` from `@/components/ui/alert-dialog` (already used) | identical |
| Reason input | `Select` from `@/components/ui/select` with closed-enum `RecomputeReason` literals | `Select` with `WaivedReasonCategory` literals (D-11) |
| Mutation hook | `useMutation(trpc.classification.recreateComplianceAssessment.mutationOptions(...))` | `useMutation(trpc.classification.overrideComplianceItem.mutationOptions(...))` (D-12) |
| Toast | `sonner.toast.success / .warning / .error` | identical |
| Reset on close | `setReason(null); onOpenChange(false)` | `setCategory(null); setNote(''); onOpenChange(false)` |
| i18n surface | `useTranslations('Contractors.Compliance.Recompute')` | `useTranslations('Contractors.Compliance.Override')` |

**Critical divergence** — override carries TWO inputs (closed-enum + ≥20-char free-text rationale per D-11). The twin only has the closed-enum. Add a `Textarea` (`@/components/ui/textarea` — exists per `apps/web/src/components/ui/`) below the `Select`, with min-length validation client-side and server-side.

### Twin 2 — Phase 71 `recreateComplianceAssessment` mutation (D-12 server-side)

`packages/api/src/routers/compliance/classification.ts` `recreateComplianceAssessment` is the **architectural anchor** for the new `overrideComplianceItem` mutation.

Confirmed shape:
- Lives in `compliance/classification.ts` (Phase 71 D-13 already extracted — the router file is `routers/compliance/classification.ts`, not the legacy `routers/classification.ts`).
- Uses `tenantProcedure` (auto-scopes by `organizationId` via Prisma extension).
- Uses `requirePermission({ contractor: ['update'] })` middleware — Phase 73 swaps this for `requirePermission({ compliance: ['override'] })` after the new permission is registered (D-10).
- Wraps the mutation body in a `prisma.$transaction(async (tx) => { ... })` block; passes `tx` into `writeAuditLog({ ..., tx: auditWriterTx })` so the audit row commits/rolls-back atomically.

**Phase 73 mirrors:** the new `overrideComplianceItem` mutation lives next to `recreateComplianceAssessment`, follows the same tx-shape, the same `writeAuditLog` discipline, and the same `TRPCError` failure modes.

### Twin 3 — Phase 72 `assertContractorPaymentEligibility` payload (D-04 dashboard reuse)

`packages/api/src/services/compliance-payment-gate.ts` (Plan 72-04) `assertContractorPaymentEligibility(contractorIds)` returns a `{ blocked, wouldBlock, contractorReasons }` payload. The `contractorReasons[]` shape is exactly what Phase 73's "Blocked payments" dashboard tab needs:

```ts
type ContractorReason = {
  contractorId: string;
  contractorName: string;
  reasons: Array<{
    itemId: string;
    policyRuleId: string;
    documentTypeLabelKey: string;     // resolved via i18n (Phase 73 D-15)
    expiredOnDate: string;            // ISO date
    jurisdictionTz: string;
    deepLinkPath: string;             // /contractors/{id}/compliance#item-{itemId}
  }>;
};
```

**Phase 73 mirror (D-04):** the dashboard tab issues two queries:
1. **Live source:** `assertContractorPaymentEligibility(...)` over all `contractorId`s referenced by DRAFT `PaymentRun`s — re-uses the helper directly. (`assertContractorPaymentEligibility` already accepts `{ throwOnFail: false }` per the helper signature; pass it.)
2. **Historical source:** `PaymentRunComplianceCheck WHERE eligibilityVerdict = 'FAIL' AND snapshottedAt >= now() - 7 days` — uses Phase 72 D-19's audit row.

Dedup by `contractorId` (NOT `paymentRunId` — CONTEXT.md D-04 has a typo; an admin sees ONE row per contractor on the "Blocked payments" tab regardless of how many runs they're blocked in). Dashboard renders the same per-contractor / per-doc grouping as the wizard error modal.

### Twin 4 — v1.0 Dashboard KPI Cards (D-01 cards)

`apps/web/src/components/dashboard/kpi-cards.tsx` is the **architectural anchor** for the 3-up KPI summary row.

Confirmed shape (read 2026-04-27, 259 LoC):
- Configuration array `KPI_CARDS: KpiCardConfig[]` of `{ key, labelKey, href, isCurrency?, isHero? }`.
- Data fetched via `useQuery(trpc.dashboard.kpis.queryOptions())` — single tRPC endpoint returns ALL KPI values.
- Each card rendered as `<Card>` (shadcn `@/components/ui/card`) with hover affordance + `<Link>` from `@/i18n/navigation`.
- Hero card variant uses `bento-span-2` (CSS class) + `conic-border neon-card iridescent` for the spotlight card.
- Trend indicator (`TrendingUp` / `TrendingDown` / `Minus` from `lucide-react`) computed from `value` vs `prevValue`.

**Phase 73 mirror (D-01):**
- New tRPC endpoint `compliance.dashboardKpis` returns `{ atRisk: { value, prevValue }, upcomingRenewals: { value, prevValue }, blockedPayments: { value, prevValue } }` — ONE round-trip.
- New `apps/web/src/components/compliance/dashboard/compliance-kpi-cards.tsx` mirrors `kpi-cards.tsx` shape. Three cards, no hero variant (all three are equally important per CONTEXT.md D-01).
- Click affordance: card click selects the matching tab in the table region below — done via `useState<'at-risk' | 'upcoming-renewals' | 'blocked-payments'>` lifted to the page-level component.
- `prevValue` for trend = the same query at `now() - 7 days` (re-uses the cron-driven snapshot in `audit_log` — see "tRPC Endpoint Shape" below). Phase 73 ships `prevValue: 0` initially with a TODO marker; trend is non-blocking polish.

### Twin 5 — Locked-phrase registry shape (`legal/gb.ts`)

`packages/validators/src/legal/gb.ts` is the **architectural anchor** for the new `compliance-{jurisdiction}.ts` modules.

Confirmed shape (read 2026-04-27, 47 LoC):
- Each phrase is a `string as const`.
- A `RESERVED_<JX>_LEGAL_KEYS` array enumerates identifier names (CI-guard reserves these from `messages/*.json`).
- A `LOCKED_<JX>_PHRASES` const-record maps identifier → phrase.
- A literal-union type `Locked<JX>PhraseKey` is exported.

**Phase 73 mirror (D-14, D-15):** five new modules — `compliance-uk.ts`, `compliance-de.ts`, `compliance-pl.ts`, `compliance-ksa.ts`, `compliance-uae.ts`. Each exports `LOCKED_COMPL_NAMES_<JX>` (a record keyed by `policyRuleId`, value = `{ en, pl, de }` phrase map) AND `RESERVED_COMPL_KEYS_<JX>` (the array of `policyRuleId` strings, used by the new parity guard). Plus optional `LOCKED_COMPL_DOCNAME_*` flat constants if any specific phrase needs to be reserved verbatim from `messages/*.json`. The aggregator `legal/index.ts` re-exports all five.

### Twin 6 — Existing `Document` upload pipeline (D-06)

`apps/web/src/components/documents/drop-zone.tsx` + `packages/api/src/routers/core/document.ts` `requestUpload` / `confirmUpload` mutations are the **architectural anchor** for the portal upload-replacement form.

Confirmed shape:
- `DropZone` accepts `documentType?: string` prop; existing call-sites pass `'OTHER'` by default.
- `requestUpload` mutation enforces `isAllowedMimeType` server-side, creates a `Document` row with `status = ACTIVE`, generates a presigned R2 PUT URL, returns `{ documentId, uploadUrl, storageKey }`.
- `confirmUpload` mutation finalises the row after the client PUT completes — virus scan kicks off async.

**Phase 73 mirror (D-06):**
- Portal upload form re-uses `DropZone` with `documentType={policyRule.documentType}` (auto-derived from the deep-link's `policyRuleId`).
- ON `confirmUpload` success, the portal form calls a NEW `compliance.submitUploadReplacement` mutation (`packages/api/src/routers/compliance/classification.ts`). This mutation:
  1. Looks up the `ContractorComplianceItem` by `itemId`, asserts it belongs to the logged-in contractor's `contractorId` (portal session).
  2. Updates `Document.status = 'PENDING_REVIEW'` (NEW enum value — see "Schema Diffs" below).
  3. Writes `AuditLog { action: 'compliance.upload.submitted', resourceId: itemId }`.
  4. Returns the updated item.
- The `ContractorComplianceItem` row STAYS at `status = MISSING|EXPIRED` until an admin reviews and approves.
- Admin approval/rejection is performed via the Compliance tab on the contractor profile — via two new mutations `compliance.approveUploadReplacement` and `compliance.rejectUploadReplacement` (D-07, D-08). Approval flips the item to `SATISFIED` + sets `satisfiedByDocumentId` + sets `expiresAt = defaultExpiryFromUploadDate(policyRule, uploadDate)` (or admin's confirmed override).

**MIME whitelist for portal upload (D-06):** `application/pdf`, `image/png`, `image/jpeg` ONLY. The portal form passes a tighter `accept` map than `DropZone`'s default (which also includes `.docx` and `.xlsx`). The server-side enforcement uses the existing `isAllowedMimeType` function from the `requestUpload` mutation — Phase 73 adds a per-context override hook OR (simpler) lets the existing whitelist through and relies on the rejection flow to clean up wrong types. Pin: **rely on existing `isAllowedMimeType` whitelist** (already includes pdf/png/jpeg) and add `'image/jpg'` if missing — `.docx`/`.xlsx` are unlikely-but-not-malicious for compliance docs and the admin reject flow handles them.

**Size cap (D-06):** existing `MAX_FILE_SIZE = 25 * 1024 * 1024` (25 MB) in `drop-zone.tsx` is more permissive than the 10 MB CONTEXT specifies. Two options:
- (a) Add a per-context size override prop to `DropZone` and pass `10 * 1024 * 1024` for the compliance flow.
- (b) Accept the 25 MB default and document the 10 MB target as polish.

Recommend (a) — the prop already exists in spirit (`documentType` is a per-context override); add a `maxFileSize?: number` prop with the same shape.

---

## Schema Diffs (D-11 + D-08 + D-06)

### `ContractorComplianceItem` — TWO new nullable columns (D-11)

```prisma
// packages/db/prisma/schema/contractor.prisma
model ContractorComplianceItem {
  // ... existing columns ...
  waivedReason         WaivedReason? // Phase 71 D-11
  waivedReasonCategory WaivedReasonCategory? // Phase 73 D-11 — NEW
  waivedReasonNote     String?               // Phase 73 D-11 — NEW (free-text rationale, ≥20 chars when set)
}

enum WaivedReasonCategory {
  contractor_offboarded
  engagement_changed
  regulatory_exemption
  temporary_grace_period
  admin_correction
  other
}
```

**Migration shape:** additive-only, multi-region apply per Standing Constraint (Plan 70-09 precedent — `npx tsx packages/db/scripts/push-all-regions.ts`). `autonomous: false` for the migration plan.

### `Document.status` — NEW enum value `PENDING_REVIEW` (D-06)

```prisma
// packages/db/prisma/schema/contract.prisma — co-located with Document model
enum DocumentStatus {
  ACTIVE
  PENDING_REVIEW   // Phase 73 D-06 — NEW (portal upload awaiting admin approval)
  SUPERSEDED
  EXPIRED
  ARCHIVED
}
```

**Migration shape:** Postgres-native enum extension via raw migration SQL (Phase 71 D-09 precedent + Phase 72 `PENDING_COMPLIANCE` precedent):

```sql
ALTER TYPE "DocumentStatus" ADD VALUE 'PENDING_REVIEW' AFTER 'ACTIVE';
```

### Index for dashboard "At risk" query (D-02)

```prisma
@@index([organizationId, severity, status, expiresAt])
```

The Phase 71 D-13 helper already owns `@@index([organizationId, contractorId, status])` and `@@index([organizationId, expiresAt])`. Phase 73's "At risk" filter combines `severity` AND `status` AND `expiresAt`. Researcher confirmed Phase 72 does NOT add this exact index (Phase 72's index is `@@index([severity, status, expiresAt])` WITHOUT `organizationId` — incorrect for tenant-scoped queries; Phase 73 adds the correct ORG-prefixed version). **Pin:** add `@@index([organizationId, severity, status, expiresAt])` in the Phase 73 migration.

### `Document.rejectionReason` — DEFER to audit log only (Claude's Discretion in CONTEXT.md)

CONTEXT.md leaves this open. Recommendation: **audit-log only, no schema column**. The `Document` model already has 14 columns; adding `rejectionReason` would couple the low-level upload domain to a cross-cutting compliance-specific concern. The audit log is the canonical source of truth for "why was this rejected, by whom, when". The portal-side rejection notification renders the reason via a join `notification.metadata` payload — no schema change needed.

---

## tRPC Endpoint Shape (D-01..D-04, D-06..D-08, D-12)

The router file is `packages/api/src/routers/compliance/classification.ts` (Phase 71 D-13 already extracted it from the legacy `routers/classification.ts`). Phase 73 adds the following procedures to this same file:

### Admin dashboard queries (D-01..D-05)

```ts
compliance.dashboardKpis: tenantProcedure
  .use(requirePermission({ compliance: ['read'] }))
  .query(async ({ ctx }) => {
    // Three indexed queries — single Promise.all
    const [atRisk, upcomingRenewals, blockedPayments] = await Promise.all([
      countAtRiskContractors(ctx.db, ctx.organizationId),
      countUpcomingRenewals(ctx.db, ctx.organizationId),
      countBlockedPayments(ctx.db, ctx.organizationId),
    ]);
    return { atRisk, upcomingRenewals, blockedPayments };
  });

compliance.dashboardAtRisk: tenantProcedure
  .use(requirePermission({ compliance: ['read'] }))
  .query(async ({ ctx }) => listAtRiskItems(ctx.db, ctx.organizationId));

compliance.dashboardUpcomingRenewals: tenantProcedure
  .use(requirePermission({ compliance: ['read'] }))
  .query(async ({ ctx }) => listUpcomingRenewals(ctx.db, ctx.organizationId));

compliance.dashboardBlockedPayments: tenantProcedure
  .use(requirePermission({ compliance: ['read'] }))
  .query(async ({ ctx }) => listBlockedPayments(ctx.db, ctx.organizationId));
```

The four query helpers live in `packages/api/src/services/compliance-dashboard.ts` (NEW). Each issues ONE indexed Prisma query — no N+1.

**`compliance:read` permission scope:** new permission key, default-granted to OWNER + ADMIN + FINANCE_ADMIN + LEGAL_COMPLIANCE_VIEWER + OPS_MANAGER (everyone who already has any compliance-adjacent read). Registered alongside `compliance:override` in Plan 73-03.

### Portal mutation (D-06)

```ts
compliance.submitUploadReplacement: portalProcedure
  .input(z.object({
    itemId: z.string(),
    documentId: z.string(),
    suggestedExpiresAt: z.date().optional(),
  }))
  .mutation(async ({ ctx, input }) => { /* see Plan 73-07 */ });
```

`portalProcedure` (from `packages/api/src/middleware/portal-auth.ts`) auto-scopes by the contractor's session. The mutation asserts `item.contractorId === ctx.contractorId` and writes the audit row.

### Admin review mutations (D-07, D-08)

```ts
compliance.approveUploadReplacement: tenantProcedure
  .use(requirePermission({ compliance: ['override'] }))  // same permission as override
  .input(z.object({
    itemId: z.string(),
    documentId: z.string(),
    expiresAt: z.date(),  // admin-confirmed
  }))
  .mutation(async ({ ctx, input }) => { /* see Plan 73-08 */ });

compliance.rejectUploadReplacement: tenantProcedure
  .use(requirePermission({ compliance: ['override'] }))
  .input(z.object({
    documentId: z.string(),
    reasonCategory: z.enum([
      'wrong_document_type', 'illegible', 'already_expired',
      'forged_or_altered', 'other',
    ]),
    freeText: z.string().max(500).optional(),
  }))
  .mutation(async ({ ctx, input }) => { /* see Plan 73-08 */ });
```

Note: per CONTEXT.md "Claude's Discretion", we use the `compliance:override` permission for both admin review actions. They are operationally similar (manual override of compliance state) and the audit log captures action-level granularity. A separate `compliance:review` permission would be over-engineering at this stage.

### Manual override mutation (D-12)

```ts
compliance.overrideItem: tenantProcedure
  .use(requirePermission({ compliance: ['override'] }))
  .input(z.object({
    itemId: z.string(),
    reasonCategory: z.enum([
      'contractor_offboarded',
      'engagement_changed',
      'regulatory_exemption',
      'temporary_grace_period',
      'admin_correction',
      'other',
    ]),
    reasonNote: z.string().min(20).max(1000),
  }))
  .mutation(async ({ ctx, input }) => {
    return await ctx.db.$transaction(async (tx) => {
      const before = await tx.contractorComplianceItem.findFirstOrThrow({ where: { id: input.itemId } });
      const updated = await tx.contractorComplianceItem.update({
        where: { id: input.itemId },
        data: {
          status: 'WAIVED',
          waivedReason: 'admin_manual_waive',
          waivedReasonCategory: input.reasonCategory,
          waivedReasonNote: input.reasonNote,
        },
      });
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user!.id,
        actorName: ctx.user!.name ?? null,
        action: 'compliance.item.overridden',
        resourceType: 'CONTRACTOR',  // CompliancesItem doesn't have its own EntityType — use CONTRACTOR + metadata.itemId
        resourceId: before.contractorId,
        metadata: { itemId: input.itemId, reasonCategory: input.reasonCategory, reasonNote: input.reasonNote, previousStatus: before.status, actorRoleSnapshot: ctx.user?.role },
        tx,
      });
      return updated;
    });
  });
```

**Why `resourceType: 'CONTRACTOR'` and not a new `COMPLIANCE_ITEM`:** the `EntityType` enum is shared org-wide and additions require a migration. Phase 73 piggybacks on `CONTRACTOR` with `metadata.itemId` (matches Phase 71's audit-log conventions for compliance ops). If a future phase needs `COMPLIANCE_ITEM` as a dedicated entity type, it can add it as an additive enum extension at that point.

---

## Compliance Tab Surface — TWO new components (D-12, D-13)

`apps/web/src/components/contractors/contractor-profile/tab-compliance.tsx` (read 2026-04-27, ~80 LoC scanned) renders a flat list of `ComplianceItem` rows. Phase 73 adds:

1. **`<OverrideComplianceItemButton>`** — hover-revealed (keyboard-focusable) inline button per row, visible when `severity === 'BLOCKING' && (status === 'MISSING' || status === 'EXPIRED')`. Lives at `apps/web/src/components/contractors/compliance/override-compliance-item-button.tsx`. Opens `<OverrideComplianceItemDialog>` (the modal twin from D-12).
2. **`<ComplianceItemHistoryDrawer>`** — per-row expand-arrow (or `Disclosure` from Base UI) rendering an audit-log-driven timeline. Lives at `apps/web/src/components/contractors/compliance/compliance-item-history.tsx`. Calls a new tRPC query `compliance.itemAuditTrail({ itemId })` that filters `AuditLog WHERE metadata.itemId = ? AND resourceType = 'CONTRACTOR' ORDER BY createdAt DESC`. (The query uses `metadata @> '{"itemId": "..."}'::jsonb` for indexed lookup — but `AuditLog.metadataJson` does NOT have a GIN index in the current schema. Phase 73 either adds the index OR scans the contractor's full audit trail and filters in app code. **Pin: add a partial GIN index** `CREATE INDEX ON "AuditLog" USING GIN ((metadataJson->'itemId')) WHERE "resourceType" = 'CONTRACTOR'` in the Phase 73 migration.)
3. **WAIVED badge** — status-pill on the row when `status === 'WAIVED'`, with an i18n tooltip that interpolates `waivedReasonCategory` + admin name from the latest `audit_log` entry.

**Drilldown (D-05):** dashboard table row click → `router.push(/contractors/{id}/compliance#item-{itemId})`. The Compliance tab adds a `useEffect` that scrolls the matching row into view + briefly highlights it. Standard `<Link>` from `@/i18n/navigation` carries the locale through.

---

## i18n Surface (D-15, D-17, COMPL-11)

### Locked-phrase registry — shape of one entry (D-15)

```ts
// packages/validators/src/legal/compliance-uk.ts
import type { PolicyRuleId } from '@contractor-ops/compliance-policy';

export const LOCKED_COMPL_NAMES_UK: Record<PolicyRuleId, { en: string; pl: string; de: string }> = {
  'uk.right_to_work@v3': {
    en: 'Right-to-Work share code',
    pl: 'Kod udostępniania prawa do pracy',
    de: 'Right-to-Work Share-Code',
  },
  // ... one entry per uk.* policyRuleId
} as const;

export const RESERVED_COMPL_KEYS_UK = Object.keys(LOCKED_COMPL_NAMES_UK) as PolicyRuleId[];
```

**Critical type-safety pin:** `Record<PolicyRuleId, …>` would be too loose (the type is `${Lowercase<string>}.${string}@v${number}`, accepting any conformant string). Use a per-jurisdiction const-object pattern + a `satisfies` assertion at the bottom of the file:

```ts
// At end of compliance-uk.ts
const _typecheck: Record<string, { en: string; pl: string; de: string }> = LOCKED_COMPL_NAMES_UK;
```

…and the parity guard test (D-17) validates that every uk-namespace `policyRuleId` has an entry.

### Existing `compliance-policy` package — confirmed `policyRuleId` enumeration

`packages/compliance-policy/src/registry.ts` exports `listPolicyRules(): readonly PolicyRule[]`. The Phase 73 parity test `compl-doc-names-parity.test.ts` calls this to enumerate every registered `policyRuleId`, then asserts each has a matching entry in the relevant `LOCKED_COMPL_NAMES_<jurisdiction>` const.

The Phase 71 registry currently registers ~13 policy rules across 5 jurisdictions (per Phase 71 D-01). Phase 73 ships ~13 entries spread across the 5 new files (uk: ~3, de: ~3, pl: ~2, ksa: ~3, uae: ~2). Exact counts confirmed via `listPolicyRules()` enumeration at test time — the test is data-driven, not hardcoded.

### Signoff registry (D-16)

`packages/validators/src/legal/signoff-registry.json` is the parallel signoff registry (Phase 70 D-09). Phase 73 adds ~13 entries, all PENDING:

```json
{
  // existing entries...
  "COMPL_DOCNAME_uk_right_to_work_v3": { "status": "PENDING" },
  "COMPL_DOCNAME_uk_utr_v1":           { "status": "PENDING" },
  // ... one per policyRuleId in the locked phrase registry
}
```

**Key naming:** map `policyRuleId` to a flat key by replacing `.` and `@v` with `_`: `uk.right_to_work@v3` → `COMPL_DOCNAME_uk_right_to_work_v3`. The naming is mechanical so the parity test (D-17) validates it deterministically.

### Locale message keys (COMPL-11)

`apps/web/messages/{en,pl,de}.json` get NEW namespaces:

- `compliance.dashboard.*` — dashboard page strings (page title, KPI labels, tab labels, empty states, filter affordances)
- `compliance.docName.<jurisdiction>.<stable-namespace>` — per-rule doc names (D-15, derived mechanically from `policyRuleId`)
- `compliance.override.*` — override modal copy (heading, reason category labels, free-text label, submit button, validation errors)
- `compliance.history.*` — timeline copy (action labels per audit-log action, "by Admin Jane on …" interpolation)
- `compliance.upload.*` — admin review modal copy (approve / reject buttons, rejection reason category labels)
- `Portal.compliance.*` — portal sub-route page strings (page title, banner copy, upload form labels, success/error states)

**Arabic = Phase 79 scope** per CONTEXT.md D-15 / D-17. The Phase 73 i18n parity test (D-17) explicitly skips the `ar` locale.

### i18n parity guard (D-17)

`packages/validators/src/__tests__/compl-doc-names-parity.test.ts` — NEW test file mirroring the shape of `locked-phrases-guard.test.ts`. Asserts:

1. Every `policyRuleId` in `listPolicyRules()` has a matching entry in the relevant `LOCKED_COMPL_NAMES_<JX>` const (catches "Phase 71 added a rule but Phase 73 forgot the name").
2. Every locked-name entry has `en` + `pl` + `de` keys (Arabic explicitly skipped).
3. Every `policyRuleId` has a corresponding `signoff-registry.json` entry with state PENDING or APPROVED.
4. No `compliance.docName.<jurisdiction>.<stable-namespace>` key is missing from `messages/en.json`, `messages/pl.json`, `messages/de.json`.

**Existing `i18n:parity` guard** (lives at `packages/lint-guards/src/i18n-parity/`) covers en/pl/de/ar key parity for ALL message keys at file level. Phase 73's new test is COMPL-specific (legal-review concerns) and runs alongside the existing guard. CONTEXT.md D-17 explicitly rejects folding the two together.

---

## Cron / Notification Wiring (D-09)

Phase 72 D-04 already emits the contractor-side digest via `dispatch()` from `notification-service.ts`. Phase 73 adds:

1. **NEW `NotificationType` values** (in `notification-service.ts`'s `NOTIFICATION_TYPES` array):
   - `compliance.upload.rejected` — fired by `compliance.rejectUploadReplacement` mutation
   - `compliance.upload.approved` — fired by `compliance.approveUploadReplacement` mutation
   - (the existing Phase 72 types `compliance.expiry_reminder.D90` etc. and `compliance.expiry_digest` ALREADY route to the contractor — Phase 73 only consumes them on the portal side)

2. **NEW portal route `/portal/compliance/upload-replacement`** — the deep-link target carrying `?itemId=...&policyRuleId=...` in the query string.

3. **NEW portal home banner** at `/portal` — surfaces a "X documents need attention" banner when any `ContractorComplianceItem` for the logged-in contractor is `MISSING/EXPIRED` or within 30-day expiry band.

**No new cron** — Phase 73 is pure surface, as CONTEXT.md D-09 specifies.

---

## Default Expiry Helper (D-07)

`packages/compliance-policy/src/expiry.ts` already exports `isExpired(...)` (Phase 71 D-07). Phase 73 adds a sibling `defaultExpiryFromUploadDate(rule, uploadDate)`:

```ts
// packages/compliance-policy/src/expiry.ts
export function defaultExpiryFromUploadDate(
  rule: PolicyRule,
  uploadDate: Date,
): Date {
  // Each PolicyRule declares its expiry semantic via a new optional field.
  // Phase 71 PolicyRule does NOT yet have an expirySemantic — Phase 73 adds it.
  switch (rule.expirySemantic) {
    case 'fixed_days': return addDays(uploadDate, rule.expiryDays!);
    case 'fixed_months': return addMonths(uploadDate, rule.expiryMonths!);
    case 'no_expiry': return addYears(uploadDate, 100); // sentinel — "no expiry"
    default: throw new Error(`Unknown expirySemantic: ${rule.expirySemantic}`);
  }
}
```

The new `expirySemantic`, `expiryDays`, `expiryMonths` fields are added to `PolicyRule` in `packages/compliance-policy/src/types.ts` (additive, optional). The existing 13 policy rules in `packages/compliance-policy/src/policies/*.ts` get their `expirySemantic` filled in (e.g., `uk.right_to_work@v3 = { expirySemantic: 'fixed_days', expiryDays: 90 }`). Plan 73-05 owns this.

---

## Permission Registration (D-10)

`packages/auth/src/permissions.ts` `accessControlStatement` has NO `compliance` resource today. Phase 73 adds:

```ts
export const accessControlStatement = {
  // ... existing resources
  compliance: ['read', 'override'],
} as const;
```

And updates `packages/auth/src/roles.ts`:
- `owner` (via `allPermissions`) → `compliance: ['read', 'override']`
- `admin` → `compliance: ['read', 'override']`
- `finance_admin` → `compliance: ['read']`
- `ops_manager` → `compliance: ['read']`
- `team_manager` → `compliance: ['read']`
- `legal_compliance_viewer` → `compliance: ['read']`
- `external_accountant` → `compliance: ['read']`
- `readonly` → `compliance: ['read']`
- `it_admin` → (no compliance access)
- `platform_operator` → (no compliance access — already excluded from per-org permissions)

**CI guard:** an existing test at `packages/auth/src/__tests__/permissions.test.ts` (or similar) asserts every resource in `accessControlStatement` is referenced by at least one role. Phase 73's role updates satisfy this.

---

## Validation Architecture (Nyquist)

### Wave 0 — Failing Test Scaffolds (Plan 73-01)

| Test file | Plan | Asserts |
|-----------|------|---------|
| `packages/api/src/services/__tests__/compliance-dashboard.test.ts` | 73-05 | `countAtRiskContractors`, `listAtRiskItems`, `listUpcomingRenewals`, `listBlockedPayments` |
| `packages/api/src/__tests__/compliance-override-mutation.test.ts` | 73-03 | `compliance.overrideItem` happy path + permission check + audit emission + closed-enum validation + ≥20-char freetext validation |
| `packages/api/src/__tests__/compliance-portal-upload.test.ts` | 73-07 | `compliance.submitUploadReplacement` happy path + cross-contractor isolation + tenant scoping |
| `packages/api/src/__tests__/compliance-upload-review.test.ts` | 73-08 | `compliance.approveUploadReplacement` + `compliance.rejectUploadReplacement` |
| `packages/compliance-policy/src/__tests__/expiry-from-upload-date.test.ts` | 73-05 | `defaultExpiryFromUploadDate` for `fixed_days` / `fixed_months` / `no_expiry` |
| `packages/validators/src/__tests__/compl-doc-names-parity.test.ts` | 73-04 | parity (every policyRuleId has a locked-name entry, en/pl/de present, signoff entry exists) |
| `apps/web/src/components/contractors/compliance/__tests__/override-compliance-item-dialog.test.tsx` | 73-08 | Override modal RTL — closed-enum select + freetext min-length validation + submit calls mutation |
| `apps/web/src/app/[locale]/(dashboard)/compliance/dashboard/__tests__/page.test.tsx` | 73-06 | Dashboard page renders 3 KPI cards + 3 tabs + tab switch on card click |
| `apps/web/src/app/[locale]/(portal)/portal/compliance/__tests__/upload-replacement-page.test.tsx` | 73-07 | Portal upload-replacement form renders with auto-derived documentType + auto-computed expiresAt |
| `packages/auth/src/__tests__/compliance-permission.test.ts` | 73-03 | New `compliance:read` + `compliance:override` permission keys are registered + granted to expected roles |

### Sampling Cadence

- **After every task commit:** Run quick command (`pnpm --filter @contractor-ops/<package> test --run --testNamePattern='...'` for affected service).
- **After every plan wave:** Run quick command for ALL Phase 73 services + the schema validation (`pnpm --filter @contractor-ops/db test --run` after Plan 73-02 lands).
- **Before `/gsd-verify-work`:** Full suite must be green plus `pnpm typecheck` and `pnpm lint`.
- **Max feedback latency:** 30s for unit, 90s for integration.

### Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Multi-region migration apply | COMPL-01 | Standing Constraint — manual ops post-deploy step | `npx tsx packages/db/scripts/push-all-regions.ts` after merge to main; verify each region's schema diff matches |
| Production legal review of 13 locked-phrase additions | COMPL-11 | Standing Project Constraint — DEFERRED post-deploy | Track in STATE.md as legal-review checkpoint per jurisdiction (UK adviser, Steuerberater, etc.); do not block phase verification |
| Real notification dispatch end-to-end (rejection + approval emails) | COMPL-04 | Production email infra (Resend) is mocked in tests | Trigger the upload/approve/reject flow against staging; observe email delivery |
| Real R2 upload pipeline against staging bucket | COMPL-04 | R2 + virus-scan infra is mocked in unit tests | Upload a real PDF via `/portal/compliance/upload-replacement` against staging; observe `Document.status = PENDING_REVIEW` row + admin sees it on Compliance tab |
| `compliance-portal-self-service` PENDING flag flip | COMPL-04 | Boot-time signoff registry behaviour | Set `FLAG_SIGNOFF_BYPASS=local` in dev; observe portal route renders; flip to APPROVED in `signoff-registry-flags.json` for production deploy |

### Verification Closure

Phase 73 passes verification when:

1. All Wave 0 tests turn from RED to GREEN as Plans 73-02..08 land.
2. `pnpm test` exits 0 across affected workspaces.
3. `pnpm typecheck` exits 0.
4. `pnpm lint` exits 0 (including the new `compl-doc-names-parity` test in CI).
5. Manual UAT verifications recorded in STATE.md as deferred / completed.

---

## Open Items (Claude's Discretion → Pinned)

| CONTEXT.md item | Pin |
|-----------------|-----|
| Exact KPI card visual / colour treatment | Match v1.0 dashboard `kpi-cards.tsx` shape: `Card` + hover ring + `lucide-react` icons. NO hero variant for compliance — all 3 cards are equal weight. |
| Exact table column order + responsive collapse | Tab-table re-uses the `Table` primitive from `@/components/ui/table` with `[Contractor name | Document name | Status badge | Days to expiry | Actions]`. On mobile (<768px), collapse `Days to expiry` and `Actions` into an expand-row. |
| `Document.rejectionReason` schema column vs audit-log only | **Audit-log only** (per "Schema Diffs" above). |
| Portal home banner placement | Top-of-page banner, full-width, `Alert` variant from `@/components/ui/alert` (already exists). Above the existing portal home content. |
| Polling cadence for "Blocked payments" tab | **60s** — confirmed against existing `apps/web/src/components/contractors/classification/dashboard/refresh-dashboard-button.tsx` patterns (which uses 60s `staleTime` + manual refresh). |
| Override modal copy + reject modal copy | Placeholder English in `messages/en.json` keyed by `compliance.override.*` and `compliance.upload.*`. Final wording is admin-facing (NOT legal-sensitive) so no signoff registry. |
| `WaivedReasonCategory` location | **Prisma enum** in `packages/db/prisma/schema/contractor.prisma` — matches Phase 71 `WaivedReason` / `Severity` precedent. |
| "Pending legal review" subscript flag UI | Plan 73-04 — minimal text-only footnote ("¹ phrasing pending legal review"), rendered by `useComplDocName(policyRuleId)` hook when `signoffRegistry[key].status === 'PENDING'`. Locks UI shape so future flip to APPROVED is a registry-only change. |

---

## Plan Wave Shape

| Wave | Plans | Dependency |
|------|-------|-----------|
| 0 | 73-01 (failing test scaffolds) | none |
| 1 | 73-02 (schema migration) | 73-01 |
| 2 | 73-03 (permission + override mutation), 73-04 (locked-phrase registry), 73-05 (dashboard query helpers + expiry helper) | 73-01, 73-02 |
| 3 | 73-06 (dashboard route + KPI cards), 73-07 (portal upload-replacement flow), 73-08 (compliance tab override / history / upload review + flag entry + i18n) | 73-03, 73-04, 73-05 |

**Wave parallelism:** Wave 2 = 3 parallel plans (different file targets). Wave 3 = 3 parallel plans (different route surfaces). Wave 1 (schema) is `autonomous: false` per Phase 70/71/72 multi-region precedent.

---

*Phase: 73-f1-compliance-admin-dashboard-portal-self-service-i18n*
*Researched: 2026-04-27*

## RESEARCH COMPLETE
