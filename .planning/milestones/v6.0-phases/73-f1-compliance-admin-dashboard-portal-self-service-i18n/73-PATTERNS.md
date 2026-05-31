# Phase 73 — Pattern Map

For each new/modified file, lists the closest in-repo analog and the concrete code shape to mirror. Read this before any plan executes.

> **RE-PLAN BANNER (2026-05-31).** Any `apps/web/...` analog below is STALE (Next.js app removed). The
> live web-vite analogs are authoritative in `73-CONTEXT.md` `<web_vite_binding>` (recompute-compliance
> triplet, payment-block-modal, kpi-cards/dashboard-home-container, drop-zone, portal-index-container,
> dashboard/portal route registries) + `<phase72_binding>` (shipped backend services + router namespace
> `classification`). The backend analogs below (Prisma schema, validators legal modules, classification
> router, audit-writer, compliance-policy) are CURRENT — Phase 72 is shipped. Read the CONTEXT binding
> blocks over any `apps/web` path here.

---

## New: `packages/db/prisma/schema/contractor.prisma` (additive — `WaivedReasonCategory` enum + 2 nullable columns + dashboard index)

**Analog:** `packages/db/prisma/schema/contractor.prisma:241-264` (existing `ContractorComplianceItem` model + Phase 71 `WaivedReason` enum).

**Pattern excerpt — additive enum + nullable columns (Phase 71 D-11 precedent):**
```prisma
// Existing — Phase 71 D-11
enum WaivedReason {
  superseded_by_policy_version
  classification_outcome_change
  admin_manual_waive
  contractor_offboarded
}

model ContractorComplianceItem {
  // ...
  waivedReason WaivedReason? // Phase 71 D-11 — populated only when status = WAIVED
  // ...
}
```

**Phase 73 mirrors:** new `WaivedReasonCategory` enum following the same lower-snake-case shape, two new nullable columns on `ContractorComplianceItem` (`waivedReasonCategory WaivedReasonCategory?`, `waivedReasonNote String?`), one new composite index `@@index([organizationId, severity, status, expiresAt])` for the dashboard "At risk" filter (D-02).

---

## New: `packages/db/prisma/schema/contract.prisma` (additive — `DocumentStatus` enum extension)

**Analog:** Phase 71 `20260427103913_add_compliance_policy_columns_v6/migration.sql` enum extension precedent (raw SQL migration since Prisma's auto-migrate is conservative on enum mutations); Phase 72's `PENDING_COMPLIANCE` extension on `ApprovalStatus`.

**Pattern excerpt:**
```sql
-- migration.sql
ALTER TYPE "DocumentStatus" ADD VALUE 'PENDING_REVIEW' AFTER 'ACTIVE';
```

**Phase 73 mirrors:** identical raw-SQL enum extension. The `Document` model already declares `status DocumentStatus @default(ACTIVE)`; the new `PENDING_REVIEW` value is positioned between `ACTIVE` and `SUPERSEDED` for state-machine readability.

---

## New: `packages/db/prisma/schema/audit.prisma` (additive — partial GIN index on AuditLog.metadataJson)

**Analog:** Phase 72 GIN index on `ApprovalFlow.complianceHoldsJson` (raw SQL migration since Prisma does not auto-emit GIN for `Json` columns).

**Pattern excerpt:**
```sql
-- migration.sql
CREATE INDEX IF NOT EXISTS "AuditLog_metadata_itemId_idx"
  ON "AuditLog" USING GIN ((metadataJson))
  WHERE "resourceType" = 'CONTRACTOR';
```

**Phase 73 mirrors:** indexed lookup of `AuditLog.metadataJson @> '{"itemId":"..."}'` for the Compliance tab History timeline (D-13). Partial-index `WHERE resourceType = 'CONTRACTOR'` keeps the index small and tenant-relevant.

---

## New: `packages/auth/src/permissions.ts` (additive — `compliance` resource)

**Analog:** existing `accessControlStatement` resource entries (e.g., `workflow: ['create', 'read', 'update', 'delete', 'execute', 'override_blocking_task']` — Phase 74 D-03 precedent for the `override_blocking_task` action). The pattern is one resource → array of action literals.

**Pattern excerpt:**
```ts
// Existing
workflow: ['create', 'read', 'update', 'delete', 'execute', 'override_blocking_task'],
```

**Phase 73 mirrors:** `compliance: ['read', 'override']`. The `roles.ts` updates follow the same "subset of permissions per role" pattern already in the file. CI guard (existing `permissions.test.ts` if it exists; else add a minimal test in Plan 73-03) asserts every role refers to the new resource exactly as the file declares.

---

## New: `packages/api/src/services/compliance-dashboard.ts` (NEW)

**Analog:** `packages/api/src/services/audit-writer.ts` (single-purpose service module with 3-5 named exports); per-feature service pattern from Phase 71's `compliance-supersession.ts` (read 2026-04-27 in Phase 72 PATTERNS.md).

**Pattern excerpts to mirror:**

```ts
// Imports — same shape as audit-writer.ts
import { prisma } from '@contractor-ops/db';
import type { Prisma } from '@contractor-ops/db';
import { createServiceLogger } from '@contractor-ops/logger';

const log = createServiceLogger('compliance-dashboard');

// Per-query helper — accepts a tenant-scoped tx OR `prisma` fallback,
// matches Phase 71 D-13 transactional helper signature pattern.
export async function countAtRiskContractors(
  db: Prisma.TransactionClient | typeof prisma,
  organizationId: string,
): Promise<number> {
  return db.contractorComplianceItem.count({
    where: {
      organizationId,
      severity: 'BLOCKING',
      NOT: { status: 'WAIVED' },
      OR: [
        { status: { in: ['MISSING', 'EXPIRED'] } },
        {
          AND: [
            { status: 'SATISFIED' },
            { expiresAt: { lte: addDays(new Date(), 30) } },
          ],
        },
      ],
    },
  });
}
```

**Phase 73 mirrors:** four named exports (`countAtRiskContractors`, `listAtRiskItems`, `listUpcomingRenewals`, `listBlockedPayments`). Every helper uses the indexed columns introduced in Plan 73-02. The `listBlockedPayments` helper composes Phase 72's `assertContractorPaymentEligibility` + the historical query against `PaymentRunComplianceCheck`.

---

## New: `packages/api/src/routers/compliance/classification.ts` (extension — 4 new procedures)

**Analog:** existing `recreateComplianceAssessment` mutation in the same file (Phase 71 D-13). Read it before extending.

**Pattern excerpts to mirror verbatim:**

```ts
// tenantProcedure + permission middleware (existing pattern)
overrideItem: tenantProcedure
  .use(requirePermission({ compliance: ['override'] }))
  .input(overrideItemSchema)
  .mutation(async ({ ctx, input }) => {
    return await ctx.db.$transaction(async (tx) => {
      // ... read, mutate, audit-log within tx
      const auditWriterTx = tx as unknown as AuditWriterClient;
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user!.id,
        action: 'compliance.item.overridden',
        resourceType: 'CONTRACTOR',
        resourceId: contractorId,
        metadata: { itemId, reasonCategory, reasonNote, previousStatus, actorRoleSnapshot },
        tx: auditWriterTx,
      });
      return updated;
    });
  });
```

**Phase 73 mirrors:** identical `tenantProcedure` chain, identical `prisma.$transaction` shape, identical `writeAuditLog` discipline (tx-scoped). All four new procedures (`overrideItem`, `submitUploadReplacement` — `portalProcedure` instead, `approveUploadReplacement`, `rejectUploadReplacement`) follow the same skeleton.

---

## New: `apps/web/src/components/contractors/compliance/override-compliance-item-dialog.tsx` (NEW)

**Analog:** `apps/web/src/components/contractors/compliance/recompute-compliance-dialog.tsx` (Phase 71 D-15 — read 2026-04-27, ~200 LoC).

**Pattern excerpts to mirror:**

```tsx
'use client';

import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/trpc/init';

type OverrideReason = 'contractor_offboarded' | 'engagement_changed' | 'regulatory_exemption' | 'temporary_grace_period' | 'admin_correction' | 'other';

const REASON_OPTIONS: OverrideReason[] = [
  'contractor_offboarded',
  'engagement_changed',
  'regulatory_exemption',
  'temporary_grace_period',
  'admin_correction',
  'other',
];

export function OverrideComplianceItemDialog({
  open,
  onOpenChange,
  itemId,
  onSuccess,
}: { open: boolean; onOpenChange: (open: boolean) => void; itemId: string; onSuccess?: () => void }) {
  const t = useTranslations('Contractors.Compliance.Override');
  const [reasonCategory, setReasonCategory] = useState<OverrideReason | null>(null);
  const [reasonNote, setReasonNote] = useState('');

  const mutation = useMutation(
    trpc.classification.overrideItem.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.success'));
        setReasonCategory(null);
        setReasonNote('');
        onOpenChange(false);
        onSuccess?.();
      },
      onError: (err: { message?: string }) => toast.error(err.message || t('toast.error')),
    }),
  );

  const isValid = reasonCategory !== null && reasonNote.length >= 20;

  // ... render Select + Textarea + AlertDialogAction (disabled when !isValid)
}
```

**Phase 73 mirrors:** identical mutation hook + toast pattern + reset-on-close. Adds `Textarea` for the freetext rationale + a min-length validation gate. Submit button disabled until both inputs are valid.

---

## New: `apps/web/src/components/compliance/dashboard/compliance-kpi-cards.tsx` (NEW)

**Analog:** `apps/web/src/components/dashboard/kpi-cards.tsx` (read 2026-04-27, 259 LoC).

**Pattern excerpts to mirror:**

```tsx
const COMPLIANCE_KPI_CARDS: KpiCardConfig[] = [
  { key: 'atRisk', labelKey: 'kpi.atRisk', tab: 'at-risk' },
  { key: 'upcomingRenewals', labelKey: 'kpi.upcomingRenewals', tab: 'upcoming-renewals' },
  { key: 'blockedPayments', labelKey: 'kpi.blockedPayments', tab: 'blocked-payments' },
];

export function ComplianceKpiCards({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) {
  const t = useTranslations('compliance.dashboard');
  const { data, isLoading } = useQuery(trpc.compliance.dashboardKpis.queryOptions());
  // ... map COMPLIANCE_KPI_CARDS over data → render <Card> with click handler that calls onTabChange(card.tab)
}
```

**Phase 73 mirrors:** same `Card` primitive, same hover affordance, NO hero variant. Click on card calls `onTabChange(card.tab)` to switch the tabbed table region.

---

## New: `apps/web/src/components/compliance/dashboard/compliance-dashboard-table.tsx` (NEW)

**Analog:** v3.0 / v5.0 tabbed-table dashboard pattern. Existing siblings (read 2026-04-27):
- `apps/web/src/components/contractors/classification/dashboard/` — multi-tab classification dashboard
- `apps/web/src/components/reports/compliance-gaps-report.tsx` — existing tab-driven compliance report

**Pattern excerpts:**

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function ComplianceDashboardTable({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) {
  const t = useTranslations('compliance.dashboard');
  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <TabsList>
        <TabsTrigger value="at-risk">{t('tabs.atRisk')}</TabsTrigger>
        <TabsTrigger value="upcoming-renewals">{t('tabs.upcomingRenewals')}</TabsTrigger>
        <TabsTrigger value="blocked-payments">{t('tabs.blockedPayments')}</TabsTrigger>
      </TabsList>
      <TabsContent value="at-risk"><AtRiskTable /></TabsContent>
      <TabsContent value="upcoming-renewals"><UpcomingRenewalsTable /></TabsContent>
      <TabsContent value="blocked-payments"><BlockedPaymentsTable /></TabsContent>
    </Tabs>
  );
}
```

**Phase 73 mirrors:** controlled `Tabs` with `value` lifted to the page level so card-clicks switch the tab. Each `Table` is a separate component fetching its own indexed query — no client-side filter/sort.

---

## New: `apps/web/src/app/[locale]/(dashboard)/compliance/dashboard/page.tsx` (NEW)

**Analog:** `apps/web/src/app/[locale]/(dashboard)/page.tsx` (existing dashboard root) and `apps/web/src/app/[locale]/(dashboard)/contractors/page.tsx` (page-level data fetch + client island).

**Pattern excerpt — server component shell with translations:**

```tsx
import { setRequestLocale } from 'next-intl/server';
import { ComplianceDashboardClient } from './_components/compliance-dashboard-client';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ComplianceDashboardClient />;
}
```

**Phase 73 mirrors:** server-component shell + client island for the interactive parts (tab state, polling). Re-uses `setRequestLocale(locale)` per Next.js 15 SSR pattern.

---

## New: `apps/web/src/app/[locale]/(portal)/portal/compliance/page.tsx` + `upload-replacement/page.tsx` (NEW)

**Analog:** `apps/web/src/app/[locale]/(portal)/portal/documents/page.tsx` and `apps/web/src/app/[locale]/(portal)/portal/invoices/submit/page.tsx` (existing portal sub-routes with portal-scoped data + upload).

**Pattern excerpts to mirror:**

```tsx
// Portal layout already wraps all portal/* pages with portal-auth-context.
// Use portalProcedure-backed tRPC queries for all data fetches.

import { trpc } from '@/trpc/init';
import { useQuery } from '@tanstack/react-query';

export default function CompliancePage() {
  const t = useTranslations('Portal.compliance');
  const { data: items } = useQuery(trpc.portal.complianceItems.queryOptions());
  // ... render banner + per-item cards with deep-link buttons
}
```

**Phase 73 mirrors:** server-component shell + client islands. The portal compliance items query is added to the existing `packages/api/src/routers/portal/portal.ts` router (NOT to the admin `compliance` router) so portal session scoping is automatic.

---

## New: `packages/validators/src/legal/compliance-uk.ts` (NEW — and four siblings)

**Analog:** `packages/validators/src/legal/gb.ts` (read 2026-04-27, 47 LoC) and `packages/validators/src/legal/de.ts` (existing — `LOCKED_DE_PHRASES` shape).

**Pattern excerpts to mirror:**

```ts
// packages/validators/src/legal/compliance-uk.ts
//
// LOCKED COMPL DOC NAMES — Phase 73 (D-14, D-15, D-16).
//
// Per-jurisdiction locked-phrase registry. Keyed by Phase 71 PolicyRuleId.
// Per-locale phrase map: en + pl + de (Arabic = Phase 79 scope).
//
// DO NOT add any of these identifiers as keys in messages/*.json —
// the CI guard in __tests__/compl-doc-names-parity.test.ts will fail the build.
//
// Each entry ships PENDING in signoff-registry.json per Phase 70 D-09.
// Per-jurisdiction legal review (UK adviser) flips entries to APPROVED in
// dedicated PRs each carrying a `legalTicketRef`.

export const LOCKED_COMPL_NAMES_UK = {
  'uk.right_to_work@v3': {
    en: 'Right-to-Work share code',
    pl: 'Kod udostępniania prawa do pracy',
    de: 'Right-to-Work Share-Code',
  },
  'uk.utr@v1': {
    en: 'UTR (Unique Taxpayer Reference)',
    pl: 'UTR (Unique Taxpayer Reference)',
    de: 'UTR (Unique Taxpayer Reference)',
  },
  // ... one entry per uk.* policyRuleId registered in Phase 71
} as const;

/** policyRuleIds covered by this jurisdiction module — used by parity guard. */
export const RESERVED_COMPL_KEYS_UK = Object.keys(LOCKED_COMPL_NAMES_UK) as Array<keyof typeof LOCKED_COMPL_NAMES_UK>;

/** Literal-union of jurisdiction-specific keys. */
export type LockedComplNameKeyUK = keyof typeof LOCKED_COMPL_NAMES_UK;
```

**Phase 73 mirrors:** five files (`compliance-uk.ts`, `compliance-de.ts`, `compliance-pl.ts`, `compliance-ksa.ts`, `compliance-uae.ts`). Each follows the identical shape.

---

## New: `packages/validators/src/legal/index.ts` (extension — re-export new modules)

**Analog:** existing `packages/validators/src/legal/index.ts` (re-exports `de`, `en`, `gb`, `disclaimers`, `signoff-registry`, `signoff-registry-schema`).

**Pattern excerpt:**
```ts
export * from './gb.js';
export * from './de.js';
// existing re-exports

// Phase 73 additions
export * from './compliance-uk.js';
export * from './compliance-de.js';
export * from './compliance-pl.js';
export * from './compliance-ksa.js';
export * from './compliance-uae.js';
```

---

## New: `packages/validators/src/__tests__/compl-doc-names-parity.test.ts` (NEW)

**Analog:** `packages/validators/src/__tests__/locked-phrases-guard.test.ts` (read 2026-04-27, ~80 LoC).

**Pattern excerpts to mirror:**

```ts
// Phase 73 · Plan 04 — Parity guard for COMPL doc-name registry (D-17).
//
// Asserts:
//   1. Every policyRuleId in @contractor-ops/compliance-policy registry has a
//      matching entry in the relevant LOCKED_COMPL_NAMES_<JX> const.
//   2. Every entry has en + pl + de keys (Arabic = Phase 79; this test ignores 'ar').
//   3. Every policyRuleId has a corresponding signoff-registry.json entry with
//      state PENDING or APPROVED.

import { describe, expect, it } from 'vitest';
import { listPolicyRules } from '@contractor-ops/compliance-policy';
import { LOCKED_COMPL_NAMES_UK } from '../legal/compliance-uk.js';
import { LOCKED_COMPL_NAMES_DE } from '../legal/compliance-de.js';
// ...
import rawRegistry from '../legal/signoff-registry.json' with { type: 'json' };

const REGISTRIES_BY_JURISDICTION = {
  UK: LOCKED_COMPL_NAMES_UK,
  DE: LOCKED_COMPL_NAMES_DE,
  PL: LOCKED_COMPL_NAMES_PL,
  KSA: LOCKED_COMPL_NAMES_KSA,
  UAE: LOCKED_COMPL_NAMES_UAE,
} as const;

describe('COMPL doc-name parity guard (D-17)', () => {
  const rules = listPolicyRules();

  it.each(rules.map(r => [r.policyRuleId, r.jurisdiction]))(
    'policyRuleId %s (jurisdiction=%s) has a matching locked-name entry',
    (ruleId, jurisdiction) => {
      const registry = REGISTRIES_BY_JURISDICTION[jurisdiction as keyof typeof REGISTRIES_BY_JURISDICTION];
      expect(registry, `No registry for jurisdiction ${jurisdiction}`).toBeDefined();
      expect(registry[ruleId as keyof typeof registry], `Missing locked-name entry for ${ruleId}`).toBeDefined();
    },
  );

  it.each(Object.values(REGISTRIES_BY_JURISDICTION).flatMap(r => Object.entries(r)))(
    'entry %s has en + pl + de keys',
    (key, value) => {
      expect(value.en, `${key} missing en`).toBeTruthy();
      expect(value.pl, `${key} missing pl`).toBeTruthy();
      expect(value.de, `${key} missing de`).toBeTruthy();
    },
  );

  it.each(rules.map(r => r.policyRuleId))('policyRuleId %s has a signoff entry', (ruleId) => {
    const flatKey = `COMPL_DOCNAME_${ruleId.replace(/\./g, '_').replace(/@v/g, '_v')}`;
    const entry = (rawRegistry as Record<string, { status: string }>)[flatKey];
    expect(entry, `Missing signoff entry for ${flatKey}`).toBeDefined();
    expect(['PENDING', 'APPROVED']).toContain(entry?.status);
  });
});
```

**Phase 73 mirrors:** identical `it.each` data-driven shape, identical static-import-only discipline, identical signoff-registry static import.

---

## New: `packages/api/src/services/notification-service.ts` (extension — new NotificationType values)

**Analog:** existing `NOTIFICATION_TYPES` array literal in the same file. Phase 72 already extended this for `compliance.expiry_reminder.D90` etc.

**Pattern excerpt:**
```ts
export const NOTIFICATION_TYPES = [
  // ... existing
  'compliance.expiry_reminder.D90',
  'compliance.expiry_digest',
  // Phase 73 additions
  'compliance.upload.rejected',
  'compliance.upload.approved',
] as const;
```

**Phase 73 mirrors:** literal additions only — no new dispatcher logic. The two new types are emitted from the new admin review mutations in Plan 73-08.

---

## New: `apps/web/messages/{en,pl,de}.json` (extension — new namespaces)

**Analog:** existing message-key namespaces (e.g., `Dashboard`, `Contractors.Compliance.Recompute`).

**Pattern excerpt — namespacing convention:**
```jsonc
{
  "Dashboard": { /* ... */ },
  // Phase 73 additions
  "compliance": {
    "dashboard": { /* page strings */ },
    "docName": {
      "uk": { "right_to_work": "Right-to-Work share code", "utr": "UTR (Unique Taxpayer Reference)" },
      "de": { /* ... */ },
      "pl": { /* ... */ },
      "ksa": { /* ... */ },
      "uae": { /* ... */ }
    },
    "override": { /* override modal copy */ },
    "history": { /* timeline copy */ },
    "upload": { /* admin review modal copy */ }
  },
  "Portal": {
    "compliance": { /* portal sub-route copy */ }
  }
}
```

**Phase 73 mirrors:** add the same key tree to en/pl/de. Arabic stays untouched (Phase 79). The existing i18n parity guard at `packages/lint-guards/src/i18n-parity/` will catch any en/pl/de drift; the new `compl-doc-names-parity.test.ts` catches policyRuleId-to-locked-name drift.

---

## New: `packages/feature-flags/src/signoff-registry-flags.json` (extension — `compliance-portal-self-service` PENDING)

**Analog:** existing entries in `signoff-registry-flags.json` (Phase 70 D-09 / D-10).

**Pattern excerpt:**
```json
{
  // existing entries...
  "compliance-portal-self-service": {
    "status": "PENDING",
    "notes": "Phase 73 F1 contractor portal self-service upload-replacement flow. Legal review of admin-facing override copy DEFERRED post-deploy per Standing Constraint."
  }
}
```

**Phase 73 mirrors:** single new entry. ROADMAP.md already lists this flag as PENDING; Plan 73-08 creates the registry entry.

---

## Modified: `apps/web/src/components/contractors/contractor-profile/tab-compliance.tsx` (extension — Override button + History timeline + WAIVED badge)

**Analog:** existing `tab-compliance.tsx` (read 2026-04-27, ~80 LoC scanned). Already imports `RecomputeComplianceDialog` and renders rows with `statusBadgeStyles`.

**Pattern excerpt — additive extensions:**
```tsx
// Existing
import { RecomputeComplianceDialog } from '@/components/contractors/compliance/recompute-compliance-dialog';
// Phase 73 additions
import { OverrideComplianceItemDialog } from '@/components/contractors/compliance/override-compliance-item-dialog';
import { ComplianceItemHistoryDrawer } from '@/components/contractors/compliance/compliance-item-history';
import { useHasPermission } from '@/hooks/use-permission';

// Inside the row map:
const canOverride = useHasPermission({ compliance: ['override'] });
{canOverride && item.status !== 'WAIVED' && (
  <Button variant="ghost" size="sm" onClick={() => setOverrideItemId(item.id)}>
    {t('override')}
  </Button>
)}
```

**Phase 73 mirrors:** non-destructive extension — every existing column stays, every existing test in `tab-compliance.test.ts` should still pass. The new buttons + drawer mount conditionally on permission/state.

---

## Migration Push Pattern (Plan 73-02 — autonomous: false)

**Analog:** Phase 70 Plan 09 + Phase 71 Plan 03 multi-region apply precedent.

**Pattern excerpt — manual ops post-merge step:**
```bash
# After Plan 73-02 PR merges
npx tsx packages/db/scripts/push-all-regions.ts
```

**Phase 73 mirrors:** Plan 73-02 frontmatter sets `autonomous: false`; the plan's verification block lists the manual command + asserts that schema diffs match in EU + ME regions before any downstream Wave 2/3 plan can land.

---

*Phase: 73-f1-compliance-admin-dashboard-portal-self-service-i18n*
*Pattern map: 2026-04-27*
