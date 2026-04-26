# Phase 64: Legal Compliance Hardening — Research

**Researched:** 2026-04-25
**Domain:** Feature-flag kill-switches, disclaimer lifecycle CI gates, advisory UX patterns, SDS PDF extension, Prisma schema additions, ToS re-acceptance, super-admin surfaces
**Confidence:** HIGH — all patterns verified against existing codebase; all integration points are exact extension of Phases 56–60 code.
**Primary inputs:**
- `.planning/phases/64-legal-compliance-hardening/64-CONTEXT.md` (31 locked decisions D-01..D-31)
- `.planning/REQUIREMENTS.md` LEGAL-01 through LEGAL-10
- Codebase reads: `packages/feature-flags/src/`, `packages/validators/src/legal/`, `packages/api/src/`, `packages/db/prisma/schema/`, `apps/web/src/`

---

## Summary

Phase 64 is a **compliance hardening** phase that layers legal-posture controls on top of classification (Phases 58-60) without altering the classification engine itself. It splits naturally into five capability tracks:

1. **Feature flag kill-switch** (D-01..D-10): Register `module.classification-engine` + server-side route `notFound()` gates + `<FeatureGate>` RSC wrapper + tRPC conditional router registration + `requireClassificationFlag` middleware + cron early-return + app-side evaluator override.
2. **Signoff registry + CI dual-gate** (D-11..D-15): New `signoff-registry.json` + Zod schema + module-load validation + always-run unit test + production-only deploy gate in CI.
3. **Advisory UX** (D-16..D-20): New locked phrases + `<ClassificationAdvisoryBanner>` RSC + `ClassificationEscalationEvent` Prisma model + `logEscalation` tRPC mutation + "Get Expert Help" referral page.
4. **SDS cover page + DRV upload** (D-21..D-27): `SdsApproval` Prisma model + in-app approval checkbox gate + `SDS_APPROVAL_STATEMENT_EN` locked phrase + SDS PDF cover page + `DRV_DECISION_LETTER` enum value + upload flow + `DRV_UNVERIFIED_ENTRY_DISCLAIMER_DE` locked phrase.
5. **Platform ToS** (D-28..D-31): Extend existing `/terms/page.tsx` with `SOFTWARE_NOT_LEGAL_ADVICE_*` locked phrases + ToS version mechanism + `ConsentEvent` model extension + `<TosReacceptanceModal>` + `consent.recordToS` mutation.

All five tracks are **additive** — they extend existing files and patterns without breaking current functionality.

---

<user_constraints>
## Locked Decisions Summary (from CONTEXT.md)

All 31 decisions D-01..D-31 are fully locked. Key execution-critical details:
- **D-01**: Register `'module.classification-engine'` in `packages/feature-flags/src/registry.ts`, `default: false`, `jurisdiction: 'ANY'`, `category: 'module'`, `owner: 'legal-platform'`.
- **D-05**: Conditional router registration in `packages/api/src/root.ts` using `FlagClient.getBoolean` at module level.
- **D-06**: New `requireClassificationFlag` middleware composing via `classificationProcedure = tenantProcedure.use(requireClassificationFlag)`.
- **D-10**: `classificationEngineDisclaimerGate` hook in `evaluator.ts` that overrides `{ value: true }` to `{ value: false }` when any classification disclaimer is `PENDING`.
- **D-12**: `signoff-registry.json` is a `Record<LockedDisclaimerKey, SignoffEntry>`, validated at import time by `SignoffRegistrySchema`.
- **D-14**: Layer 1 = always-run test (dangling entries + schema validity). Layer 2 = `ci-legal-gate-production` job in `ci.yml` that runs only on production branch, asserts `getAllPending().length === 0`.
- **D-18**: New `ClassificationEscalationEvent` model — append-only, multi-tenant scoped.
- **D-21**: New `SdsApproval` model — `@unique` on `assessmentId`, snapshot pattern.
- **D-25**: Extend `ClassificationDocumentKind` enum with `DRV_DECISION_LETTER`.
- **D-30**: Extend `ConsentScope`-equivalent enum (currently `ConsentPurpose` in `consent.prisma`) with `'tos'` scope via a separate new `ConsentEvent` model (distinct from `ConsentRecord`).
</user_constraints>

---

## Standard Stack

This phase uses no new libraries. Full re-use:

| Concern | Existing Tool | Location |
|---------|--------------|---------|
| Feature flags | `packages/feature-flags/` | `registry.ts`, `evaluator.ts`, `flag-bag.ts` |
| Locked phrases + CI guard | `packages/validators/src/legal/` | `disclaimers.ts`, `de.ts`, `en.ts`, `gb.ts` |
| tRPC middleware | `packages/api/src/middleware/` | `feature-flag.ts`, `tenant.ts`, `rbac.ts` |
| Prisma models | `packages/db/prisma/schema/` | `classification.prisma`, `consent.prisma`, `organization.prisma` |
| R2 storage + signed URLs | `packages/api/src/services/` | `r2.ts`, `classification-document-keys.ts` |
| React-PDF templates | `packages/api/src/pdf-templates/` | `ir35-sds.tsx`, `drv-defense-bundle.tsx` |
| Next.js RSC + notFound() | `apps/web/src/app/` | route `layout.tsx` pattern |
| Next-intl i18n | `apps/web/messages/` | `en.json`, `de.json` |
| Admin shell | `apps/web/src/app/admin/` | `layout.tsx` — Phase 63 introduced first admin route |

---

## Architecture Patterns

### Pattern 1: Feature flag registration in registry.ts

The `FLAGS` object in `packages/feature-flags/src/registry.ts` is the single source of truth. All keys must be declared here. The object is `deepFreeze`d at module load. New entry:

```typescript
'module.classification-engine': {
  key: 'module.classification-engine',
  description: 'Classification engine (IR35 + Scheinselbständigkeit). Ship dark — requires all disclaimer PENDING→APPROVED before enabling.',
  default: false,
  category: 'module',
  jurisdiction: 'ANY',
  owner: 'legal-platform',
},
```

After adding, `FlagKey` type union auto-expands. `FlagValues` type in `flag-bag.ts` also auto-expands. The `nav-items.tsx` `useFlagBag()` hook will pick up the key once it's declared.

### Pattern 2: Server-side route layout gate via notFound()

Existing pattern from Phase 62 (`einvoice.import-enabled` for the `/invoices/intake/` route does NOT use layout.tsx but the pattern is established). The canonical Next.js App Router approach:

```typescript
// apps/web/src/app/[locale]/(dashboard)/classification/layout.tsx
import { auth } from '@contractor-ops/auth';
import { evaluate } from '@contractor-ops/feature-flags';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';

export default async function ClassificationLayout({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.session.activeOrganizationId) notFound();
  const result = evaluate('module.classification-engine', {
    organizationId: session.session.activeOrganizationId,
    region: session.session.activeOrganizationRegion ?? 'EU',
    // countryCode from org — looked up via prisma.organization.findFirst
  });
  if (!result.enabled) notFound();
  return (
    <>
      <ClassificationAdvisoryBanner jurisdiction={org.countryCode} />
      {children}
    </>
  );
}
```

**Critical**: `notFound()` must be called BEFORE rendering any classification-specific imports so Next.js never ships those chunks for flag-off requests.

Three layout.tsx files needed per D-02:
1. `apps/web/src/app/[locale]/(dashboard)/classification/layout.tsx`
2. `apps/web/src/app/[locale]/(dashboard)/contractors/[id]/classification/layout.tsx`
3. `apps/web/src/app/[locale]/(dashboard)/contractors/[id]/engagements/[engagementId]/classification/layout.tsx`

### Pattern 3: FeatureGate RSC component

New `apps/web/src/components/feature-gate.tsx` — server component:

```typescript
import { evaluate } from '@contractor-ops/feature-flags';
// resolves org context from auth session
export async function FeatureGate({ flag, children }: { flag: FlagKey; children: ReactNode }) {
  // ...resolve context...
  const { enabled } = evaluate(flag, ctx);
  if (!enabled) return null;
  return <>{children}</>;
}
```

Used to wrap: classification sidebar nav entry, contractor profile classification tab/tile, compliance health dashboard section, economic dependency alert widget.

**Sidebar nav entry pattern**: In `apps/web/src/lib/navigation.ts`, add a new `NavItem` with `flag: 'module.classification-engine'`. The nav-items.tsx already has `if (item.flag && !flagBag[item.flag]) return false;` filtering.

### Pattern 4: tRPC conditional router registration (D-05)

The challenge: `packages/api/src/root.ts` currently imports all classification routers at the top. The `module.classification-engine` flag must remove them entirely from `appRouter` when off.

**Approach**: Use a module-level flag evaluation with the global (non-tenant) context:

```typescript
// packages/api/src/root.ts
import { buildFlagBag } from '@contractor-ops/feature-flags';

// Evaluate at module load — represents platform-wide baseline
// (per-org / per-jurisdiction enforcement handled by D-06 middleware)
const GLOBAL_FLAG_CONTEXT = {
  organizationId: 'ROOT',
  region: 'EU' as const, // jurisdiction='ANY' means EU and ME both get the same result
};

const classificationEnabled = buildFlagBag(GLOBAL_FLAG_CONTEXT).isEnabled('module.classification-engine');

export const appRouter = router({
  // ... other routers ...
  ...(classificationEnabled ? {
    classification: classificationRouter,
    classificationDashboard: classificationDashboardRouter,
    classificationDocument: classificationDocumentRouter,
    ir35Chain: ir35ChainRouter,
    ir35Attestation: ir35AttestationRouter,
    economicDependencyAlert: economicDependencyAlertRouter,
    reassessmentTrigger: reassessmentTriggerRouter,
    statusfeststellungsverfahren: statusfeststellungsverfahrenRouter,
  } : {}),
});
```

**Limitation**: This is a module-load-time evaluation. For the per-org override (D-06), the `requireClassificationFlag` middleware handles request-time per-org enforcement.

**TRPC client type compatibility**: The TypeScript type of `AppRouter` will change when the flag is off (missing procedures). The frontend's `@trpc/next` client is typed from `AppRouter`. This means when the flag is off, the TypeScript compiler would reject any calls to `trpc.classification.*`. This is the desired behavior — plus the route layouts return 404 before any such call could happen.

**Simpler alternative** (more practical): Keep all classification routers registered always, but use the D-06 middleware (`requireClassificationFlag`) to return `FORBIDDEN` on every procedure when the flag is off. This avoids module-level flag evaluation complexity and AppRouter type instability. The CONTEXT.md D-05 explicitly says "When the global flag is OFF: routers absent from appRouter" but also has D-06 as defense-in-depth. The safest execution path:
- Use the spread approach for D-05 (conditional registration)
- Keep D-06 middleware regardless (defense-in-depth when the flag is ON but per-org it's off)
- Accept that TypeScript types change (frontend can use type-narrowing or the routes 404 before calling)

### Pattern 5: requireClassificationFlag middleware (D-06)

Pattern mirrors `requirePermission` middleware from `packages/api/src/middleware/rbac.ts`:

```typescript
// packages/api/src/middleware/require-classification-flag.ts
import { evaluate } from '@contractor-ops/feature-flags';
import { TRPCError } from '@trpc/server';
import { t } from '../init.js';
import { tenantProcedure } from './tenant.js';

export const classificationProcedure = tenantProcedure.use(async ({ ctx, next }) => {
  const result = evaluate('module.classification-engine', {
    organizationId: ctx.organizationId,
    region: ctx.region === 'ME' ? 'ME' : 'EU',
    countryCode: ctx.session?.user.countryCode,
  });
  if (!result.enabled) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'CLASSIFICATION_ENGINE_DISABLED',
      cause: { flag: 'module.classification-engine', reason: result.reason },
    });
  }
  return next();
});
```

All existing classification procedures use `tenantProcedure` currently. They must be updated to use `classificationProcedure`.

### Pattern 6: Cron early-return gate (D-08)

In `apps/web/src/app/api/cron/classification-economic-dependency/route.ts`:

```typescript
// FIRST lines of GET handler, after verifyCronSecret
const flagResult = evaluate('module.classification-engine', {
  organizationId: 'CRON',
  region: 'EU', // jurisdiction='ANY' so region doesn't matter
});
if (!flagResult.enabled) {
  log.info({ event: 'CRON_SKIPPED_FLAG_OFF', endpoint: 'classification-economic-dependency', skippedAt: new Date().toISOString() }, 'classification cron skipped: flag disabled');
  return NextResponse.json({ skipped: true, reason: 'FLAG_OFF' });
}
```

Same pattern for `classification-reassessment-triggers/route.ts`.

### Pattern 7: App-side evaluator override (D-10)

In `packages/feature-flags/src/evaluator.ts`, the `evaluate()` function currently calls `evaluateAgainst(def, ctx, client)`. The override hook intercepts after Unleash returns `{ enabled: true }`:

```typescript
// After existing evaluate() function:
function classificationEngineDisclaimerGate(enabled: boolean): boolean {
  if (!enabled) return false; // already off — no override needed
  // Import is lazy to avoid circular deps
  const { isAllApproved } = require('@contractor-ops/validators/legal/signoff-registry');
  if (!isAllApproved()) {
    log.warn('classification-engine flag overridden to false: disclaimer(s) PENDING');
    return false;
  }
  return true;
}

export function evaluate(key: FlagKey, ctx: EvalContext): EvalResult {
  const def = FLAGS[key];
  const client = getFlagClient(ctx.region);
  const base = evaluateAgainst(def, ctx, client);
  if (key === 'module.classification-engine' && base.enabled) {
    return { enabled: classificationEngineDisclaimerGate(base.enabled), reason: base.reason };
  }
  return base;
}
```

**Circular dependency risk**: `evaluator.ts` importing from `packages/validators` creates a cross-package import. This is acceptable since `packages/validators` is already imported by `packages/api`. But to avoid dynamic `require()`, consider exporting the `isAllApproved()` helper and importing it normally with a lazy module pattern.

### Pattern 8: Signoff registry (D-12)

```typescript
// packages/validators/src/legal/signoff-registry.json (new file)
{
  "SDS_DISCLAIMER_EN": { "status": "PENDING" },
  "DRV_DEFENSE_DISCLAIMER_DE": { "status": "PENDING" },
  "DISCLAIMER_IR35_BODY": { "status": "PENDING" },
  ...
}

// packages/validators/src/legal/signoff-registry-schema.ts
import { z } from 'zod';
export const SignoffEntrySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED']),
  approvedBy: z.string().optional(),
  approvedAt: z.string().datetime().optional(),
  approverRole: z.enum(['UK_TAX_ADVISER', 'STEUERBERATER', 'INTERNAL_COUNSEL', 'INTERNAL_PRODUCT']).optional(),
  approverEmailHash: z.string().optional(), // SHA-256 of lowercase email
  upstreamRef: z.string().optional(),
  notes: z.string().optional(),
}).refine(entry => {
  if (entry.status === 'APPROVED') {
    return !!(entry.approvedBy && entry.approvedAt && entry.approverRole);
  }
  return true;
}, { message: 'APPROVED entries require approvedBy, approvedAt, approverRole' });

export const SignoffRegistrySchema = z.record(z.string(), SignoffEntrySchema);
```

### Pattern 9: CI dual-gate (D-14)

**Layer 1** — extend `packages/validators/src/__tests__/locked-phrases-guard.test.ts`:
```typescript
describe('Phase 64 — signoff registry CI guard', () => {
  it('every key in LOCKED_DISCLAIMERS has a signoff-registry entry', () => {
    for (const key of Object.keys(LOCKED_DISCLAIMERS)) {
      expect(registry[key], `${key} missing from signoff-registry.json`).toBeDefined();
    }
  });
  it('signoff-registry.json parses against SignoffRegistrySchema', () => {
    expect(() => SignoffRegistrySchema.parse(registry)).not.toThrow();
  });
});
```

**Layer 2** — new job in `.github/workflows/ci.yml`:
```yaml
  legal-gate-production:
    name: Legal Gate (production only)
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - name: Assert no PENDING disclaimers (LEGAL-02)
        run: node -e "
          const { getAllPending } = require('./packages/validators/src/legal/signoff-registry.js');
          const pending = getAllPending();
          if (pending.length > 0) {
            console.error('LEGAL-02: Production deploy blocked. PENDING disclaimers:', pending.join(', '));
            process.exit(1);
          }
          console.log('Legal gate: all disclaimers APPROVED');
        "
```

### Pattern 10: Prisma schema additions

All new models follow existing classification.prisma patterns:
- `organizationId` + `@relation` to `Organization` for multi-tenant scoping
- `createdAt DateTime @default(now())` (no `updatedAt` for append-only models)
- Indexes on `(organizationId, ...)` pairs

**`ClassificationEscalationEvent`** (new, classification.prisma):
```prisma
enum EscalationVerdict {
  IR35_OUTSIDE
  IR35_INSIDE
  IR35_INDETERMINATE
  SCHEIN_SELFEMPLOYED
  SCHEIN_EMPLOYED
  SCHEIN_UNCLEAR
}

enum EscalationTriggerKind {
  AMBER_VERDICT_AUTO
  GET_EXPERT_HELP_CLICK
  MANUAL_FLAG
}

model ClassificationEscalationEvent {
  id              String                @id @default(cuid())
  organizationId  String
  userId          String
  contractorId    String?
  assessmentId    String
  verdict         EscalationVerdict
  triggerKind     EscalationTriggerKind
  referralTarget  String
  ipAddress       String?
  userAgent       String?               @db.Text
  createdAt       DateTime              @default(now())

  organization Organization             @relation(fields: [organizationId], references: [id])
  user         User                     @relation(fields: [userId], references: [id])
  assessment   ClassificationAssessment @relation(fields: [assessmentId], references: [id])

  @@index([organizationId, createdAt])
  @@index([organizationId, assessmentId])
}
```

**`SdsApproval`** (new, classification.prisma):
```prisma
model SdsApproval {
  id                      String   @id @default(cuid())
  organizationId          String
  assessmentId            String   @unique
  approvedByUserId        String
  approvedAt              DateTime
  clientName              String
  approvalStatementSnapshot String  @db.Text
  createdAt               DateTime @default(now())

  organization Organization             @relation(fields: [organizationId], references: [id])
  assessment   ClassificationAssessment @relation(fields: [assessmentId], references: [id])
  approvedBy   User                     @relation(fields: [approvedByUserId], references: [id])

  @@index([organizationId])
  @@index([organizationId, assessmentId])
}
```

**`ClassificationDocumentKind` enum extension**:
```prisma
enum ClassificationDocumentKind {
  SDS
  DRV_DEFENSE_BUNDLE
  DRV_DECISION_LETTER  // Phase 64 D-25
}
```

**`ConsentEvent`** — Note: the existing `ConsentRecord` model (consent.prisma) is for PDPL per-purpose consent. The CONTEXT.md D-30 refers to a `ConsentEvent` model for ToS. Looking at the codebase, there is no `ConsentEvent` model — only `ConsentRecord` and `PrivacyNotice`. The plan must create a new `ConsentEvent` model in `consent.prisma` (separate from `ConsentRecord`) with a `scope` field for ToS acceptance:

```prisma
enum ConsentEventScope {
  TOS
  PRIVACY
}

model ConsentEvent {
  id          String            @id @default(cuid())
  organizationId String
  userId      String
  scope       ConsentEventScope
  version     String            // e.g. "2026.1.0"
  acceptedAt  DateTime
  ipAddress   String?
  userAgent   String?           @db.Text
  createdAt   DateTime          @default(now())

  organization Organization @relation(fields: [organizationId], references: [id])
  user         User         @relation(fields: [userId], references: [id])

  @@index([organizationId, userId, scope])
  @@index([organizationId, scope, createdAt])
}
```

**`Organization.expertReferralEmail`** (organization.prisma extension):
```prisma
expertReferralEmail String? // Phase 64 D-20 — opt-in override for Get Expert Help page
```

### Pattern 11: Advisory banner component (D-17)

Amber palette tokens from Phase 60 compliance-pill (`bg-amber-50 border-amber-400 text-amber-900`). Non-dismissible — no close button.

```typescript
// apps/web/src/components/classification/advisory-banner.tsx
export function ClassificationAdvisoryBanner({ jurisdiction }: { jurisdiction: string }) {
  const phrase = jurisdiction === 'DE' || jurisdiction === 'AT'
    ? BANNER_SCHEIN_ADVISORY_DE
    : BANNER_IR35_ADVISORY_EN;
  return (
    <div role="note" className="sticky top-0 z-10 bg-amber-50 border-b border-amber-400 text-amber-900 px-4 py-3 text-sm">
      {phrase}
    </div>
  );
}
```

Placement: in classification route `layout.tsx` (D-02) above `{children}`.

### Pattern 12: SDS PDF cover page extension (D-24)

The existing `ir35-sds.tsx` is a React-PDF `<Document>` with pages. A new first page is prepended. The `SdsApproval` data (clientName, approvedAt, approvedByUser, approvalStatementSnapshot) is fetched by the `generateSds` tRPC procedure and passed to the template. Template props interface extended:

```typescript
interface SDSTemplateProps {
  assessment: Assessment;
  engagementContext: { clientName: string; contractorName: string; engagementTitle: string };
  renderedAt: Date;
  approval: { clientName: string; approvedAt: Date; approvedByName: string; statementSnapshot: string } | null;
}
```

If `approval` is provided, a cover page is prepended before the existing verdict page.

### Pattern 13: DRV decision letter upload (D-25/D-26)

Reuses `classificationDocumentRouter` R2 pattern exactly. New procedure `uploadDrvDecisionLetter`:
- Accepts base64-encoded file + filename + mimeType
- Server-side MIME validation (accept only `application/pdf`, `image/jpeg`, `image/png`)
- Magic byte check (first bytes must match MIME)
- 10MB size cap
- R2 key: `classification-docs/{orgId}/{assessmentId}/drv-decision-{sha256[:16]}.{ext}`
- Creates `ClassificationDocument` row with `kind = 'DRV_DECISION_LETTER'`
- Returns signed download URL (300s TTL)

### Pattern 14: ToS page extension (D-28/D-29/D-30)

The existing ToS page at `apps/web/src/app/[locale]/(legal)/terms/page.tsx` uses `useTranslations('Legal.terms')`. Instead of MDX (the current page is TSX), the CONTEXT.md D-28 calls for MDX. However, looking at the codebase, the `/terms/` page is already TSX (not MDX) and uses next-intl. Recommendation: extend the existing TSX page rather than migrating to MDX to avoid adding MDX dependencies. The `SOFTWARE_NOT_LEGAL_ADVICE_*` locked phrases are imported from `@contractor-ops/validators/legal/disclaimers` and rendered directly in the TSX. A new "Legal Notices" section is added to the existing page.

For the ToS version mechanism: the CONTEXT.md calls for a `TOS_CURRENT_VERSION` constant. Use a simple TypeScript constant in `apps/web/src/lib/tos.ts` rather than MDX frontmatter extraction.

### Pattern 15: TosReacceptanceModal (D-30)

The `<TosReacceptanceModal />` component follows the existing consent modal pattern from Phase 56. It is rendered in `apps/web/src/app/[locale]/(dashboard)/layout.tsx` (the dashboard root layout that wraps all authenticated routes). Logic:
1. Dashboard layout server-side: fetch `ConsentEvent.findFirst({ where: { userId, scope: 'TOS' }, orderBy: { acceptedAt: 'desc' } })`
2. If none found or version < `TOS_CURRENT_VERSION`: render `<TosReacceptanceModal currentVersion={TOS_CURRENT_VERSION} />` as a client component
3. Modal uses focus-trap (shadcn Dialog with `onInteractOutside={(e) => e.preventDefault()}`)
4. On "I accept": fires `trpc.consent.recordToS.mutate({ version })` → creates `ConsentEvent` row → modal dismisses

---

## Key Code Locations

| Decision | File to Create/Modify | Action |
|---------|----------------------|--------|
| D-01 | `packages/feature-flags/src/registry.ts` | Add `'module.classification-engine'` entry |
| D-02 | `apps/web/src/app/[locale]/(dashboard)/classification/layout.tsx` | NEW — 3 files |
| D-03 | `apps/web/src/components/feature-gate.tsx` | NEW RSC wrapper |
| D-03b | `apps/web/src/lib/navigation.ts` | Add classification NavItem with `flag` |
| D-05 | `packages/api/src/root.ts` | Conditional spread for classification routers |
| D-06 | `packages/api/src/middleware/require-classification-flag.ts` | NEW middleware |
| D-06b | `packages/api/src/routers/classification.ts` + `classification-dashboard.ts` + `classification-document.tsx` | Switch to `classificationProcedure` |
| D-07 | `packages/api/src/routers/__tests__/classification-flag-coverage.test.ts` | NEW test |
| D-08 | `apps/web/src/app/api/cron/classification-economic-dependency/route.ts` | Add early-return guard |
| D-08b | `apps/web/src/app/api/cron/classification-reassessment-triggers/route.ts` | Add early-return guard |
| D-09 | `packages/api/src/services/__tests__/economic-dependency-flag-off.test.ts` | NEW test |
| D-10 | `packages/feature-flags/src/evaluator.ts` | Add `classificationEngineDisclaimerGate` hook |
| D-11 | `apps/web/src/app/admin/feature-flags/classification-engine/page.tsx` | NEW super-admin page |
| D-12 | `packages/validators/src/legal/signoff-registry.json` | NEW file |
| D-12b | `packages/validators/src/legal/signoff-registry-schema.ts` | NEW Zod schema |
| D-12c | `packages/validators/src/legal/signoff-registry.ts` | NEW module + helpers |
| D-14 | `packages/validators/src/__tests__/locked-phrases-guard.test.ts` | Extend with registry guard |
| D-14b | `.github/workflows/ci.yml` | Add `legal-gate-production` job |
| D-14c | `.github/CODEOWNERS` | Add `legal-platform` CODEOWNERS rule |
| D-16 | `packages/validators/src/legal/disclaimers.ts` | Add 6 new locked phrases + registry entries |
| D-17 | `apps/web/src/components/classification/advisory-banner.tsx` | NEW component |
| D-18 | `packages/db/prisma/schema/classification.prisma` | Add `ClassificationEscalationEvent` + `SdsApproval` + enum extension |
| D-19 | `packages/api/src/routers/classification.ts` | Add `logEscalation` + `approveSds` mutations |
| D-20 | `apps/web/src/app/[locale]/(dashboard)/classification/expert-help/page.tsx` | NEW referral page |
| D-20b | `packages/db/prisma/schema/organization.prisma` | Add `expertReferralEmail` field |
| D-23 | (covered in D-16) | `SDS_APPROVAL_STATEMENT_EN` locked phrase |
| D-24 | `packages/api/src/pdf-templates/ir35-sds.tsx` | Add cover page |
| D-24b | `packages/api/src/routers/classification-document.tsx` | Fetch SdsApproval + pass to template; add `SDS_NOT_APPROVED` guard |
| D-25 | `packages/db/prisma/schema/classification.prisma` | Extend `ClassificationDocumentKind` enum |
| D-26 | `packages/api/src/routers/classification-document.tsx` | Add `uploadDrvDecisionLetter` procedure |
| D-27 | (covered in D-16) | `DRV_UNVERIFIED_ENTRY_DISCLAIMER_DE` locked phrase |
| D-28 | `apps/web/src/app/[locale]/(legal)/terms/page.tsx` | Extend with legal notice sections |
| D-29 | (covered in D-16) | `SOFTWARE_NOT_LEGAL_ADVICE_EN` + `SOFTWARE_NOT_LEGAL_ADVICE_DE` |
| D-30 | `packages/db/prisma/schema/consent.prisma` | Add `ConsentEvent` model |
| D-30b | `apps/web/src/components/tos-reacceptance-modal.tsx` | NEW modal |
| D-30c | `apps/web/src/lib/tos.ts` | NEW ToS version constant |
| D-30d | `apps/web/src/app/[locale]/(dashboard)/layout.tsx` | Add TosReacceptanceModal |
| D-31 | `packages/api/src/routers/consent.ts` | Add `recordToS` mutation |
| D-31b | `apps/web/messages/{en,de}.json` | Add i18n keys for AdvisoryBanner, ExpertHelp, ToS modal, SDS approval, DRV upload |

---

## Pitfalls & Landmines

### Pitfall 1: Module-level flag evaluation in root.ts

`packages/api/src/root.ts` is a module that initializes once at server start. Calling `buildFlagBag()` there creates an Unleash client at module load. If Unleash is unavailable at startup, `createStubClient` logs a warning and returns all defaults (which is `false` for `module.classification-engine`). This means **in environments where Unleash is not configured, classification is always off at the API level**. This is the correct fail-closed behavior.

**Warning**: If the module-level evaluation uses `region: 'EU'` for a flag with `jurisdiction: 'ANY'`, this works correctly (ANY bypasses the jurisdiction check). Do not use a non-existent `organizationId` — use the literal string `'ROOT'` as the context `organizationId`.

### Pitfall 2: AppRouter type instability

If classification routers are conditionally omitted from `appRouter`, the TypeScript type of `AppRouter` changes at module load. The web app's tRPC client is typed from `AppRouter`. When the flag is off, `trpc.classification.*` calls would cause TypeScript errors. This is actually desired behavior (prevents accidental classification calls when flag off), but it requires careful test setup. **Solution**: In test environments where the flag is off, mock the classification procedures or ensure tests don't call them.

Alternative: Use the always-registered + D-06-middleware approach (simpler TypeScript types). The middleware returns FORBIDDEN for every call when the flag is off, achieving the same security posture without AppRouter type changes. The requirement states "return FORBIDDEN or are unregistered" — the FORBIDDEN path satisfies the requirement.

### Pitfall 3: Circular import in evaluator.ts

`packages/feature-flags/src/evaluator.ts` importing `signoff-registry.ts` from `packages/validators` would create a cross-package dependency. `packages/feature-flags` currently has no dependency on `packages/validators`. Adding it creates a coupling that could cause circular dependency if `packages/validators` ever imports from `packages/feature-flags`.

**Solution**: Use dynamic import (`import()`) for the signoff registry check inside `classificationEngineDisclaimerGate`, or pass the `isAllApproved` function as a callback via an `override hook registration` pattern — the gate registers itself at app startup (in `apps/web`) rather than being hardcoded in the library.

**Simplest approach**: Add a `setDisclaimerGate(fn: () => boolean)` registration hook in `evaluator.ts`. Call it from the Next.js app bootstrap (e.g., in `apps/web/src/lib/feature-flags-init.ts` or `apps/web/src/app/api/trpc/[trpc]/route.ts`). This keeps the library clean of validators imports.

### Pitfall 4: Classification sidebar entry — current navigation.ts has no classification entry

Looking at the actual `apps/web/src/lib/navigation.ts`, there is **no existing classification sidebar entry**. Classification dashboard is accessible via `/classification/` but the nav item was never added (the nav was defined in Phase 56 before classification features existed in the app). This phase must add the classification nav item:

```typescript
{
  key: 'classification',
  label: 'Classification',
  href: '/classification',
  icon: ShieldCheck, // from lucide-react
  permission: { resource: 'contractor', actions: ['read'] },
  flag: 'module.classification-engine', // added in this phase
},
```

This means the classification dashboard is currently accessible to all users without any flag check (since there's no nav item with a flag). This is a latent issue that this phase fixes.

### Pitfall 5: SDS generation without SdsApproval guard

The `generateSds` procedure in `classificationDocumentRouter` currently does not check for an `SdsApproval` row (it doesn't exist yet). After this phase, the guard is:
```typescript
const approval = await ctx.db.sdsApproval.findUnique({ where: { assessmentId } });
if (!approval) {
  throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'SDS_NOT_APPROVED' });
}
```
This is a **breaking change** for existing SDS generation flows — the frontend outcome page must show the approval checkbox before the "Generate SDS" button is enabled. Existing generated SDSs (without an `SdsApproval` row) will still be downloadable via `getDownloadUrl` (that doesn't re-check approval), but new generations require approval.

### Pitfall 6: ConsentEvent vs ConsentRecord naming conflict

The `consent.prisma` currently has `ConsentRecord` and `PrivacyNotice`. The CONTEXT.md refers to "ConsentEvent" for the ToS acceptance. Adding a new model named `ConsentEvent` is safe — it doesn't conflict with `ConsentRecord`. However, the CONTEXT.md also references `session.user.latestTosVersion` — this field doesn't exist on the `User` model. Either add it to `User` in the `auth.prisma` schema, or fetch `ConsentEvent.findFirst({ where: { userId, scope: 'TOS' }, orderBy: { acceptedAt: 'desc' } })` on each dashboard layout render. The query-based approach is simpler and avoids schema changes to the Better Auth user model.

### Pitfall 7: Admin page route group conflict

`apps/web/src/app/admin/` is a plain `admin/` route (not a Next.js route group `(admin)`). The CONTEXT.md D-11 mentions `/(admin)/feature-flags/classification-engine/`. But the existing admin layout is at `apps/web/src/app/admin/layout.tsx`. The correct path is `apps/web/src/app/admin/feature-flags/classification-engine/page.tsx` (no route group parentheses).

### Pitfall 8: DRV upload file processing — base64 vs multipart

The `classificationDocumentRouter` for SDS/DRV bundle uses a tRPC mutation with base64 file content. tRPC procedures use JSON-serializable types, so file content must be base64-encoded. The 10MB size cap + base64 overhead (~33%) means the effective JSON payload limit must accommodate ~13.3MB. Verify that the Next.js API route body size limit (default 4MB) is increased for this endpoint. The existing SDS/DRV bundle procedures bypass this because they generate PDFs server-side (no file upload). **Solution**: Use the existing signed-URL upload pattern from Phase 59 for DRV letter upload — presign an R2 URL and have the frontend upload directly to R2, then call a tRPC mutation with the R2 key to create the DB record (no base64 transfer through tRPC).

---

## Validation Architecture

### Test matrix

| Test | Location | Type | Gate |
|------|---------|------|------|
| Signoff registry has all disclaimer keys | `locked-phrases-guard.test.ts` | Unit | Always |
| Signoff registry Zod schema validates | `locked-phrases-guard.test.ts` | Unit | Always |
| No BANNER_* / SDS_* / DRV_UNVERIFIED_* / SOFTWARE_NOT_LEGAL_ADVICE_* in messages/*.json | `locked-phrases-guard.test.ts` | Unit | Always |
| Every classification procedure uses `classificationProcedure` | `classification-flag-coverage.test.ts` | Unit | Always |
| Flag off → cron returns `{ skipped: true, reason: 'FLAG_OFF' }` | `economic-dependency-flag-off.test.ts` | Unit | Always |
| Flag off → cron no DB calls | `economic-dependency-flag-off.test.ts` | Unit | Always |
| Flag off → classification route returns 404 | `bundle-hygiene/classification-flag-off.test.ts` (integration) | Integration | Always |
| `getAllPending().length === 0` | `ci-legal-gate-production` CI job | CI | Production deploy only |
| `logEscalation` mutation creates `ClassificationEscalationEvent` row | `classification.test.ts` | Unit | Always |
| `approveSds` mutation creates `SdsApproval` row | `classification.test.ts` | Unit | Always |
| `generateSds` throws `SDS_NOT_APPROVED` without `SdsApproval` row | `classification-document.test.ts` | Unit | Always |
| `uploadDrvDecisionLetter` rejects invalid MIME types | `classification-document.test.ts` | Unit | Always |
| `recordToS` creates `ConsentEvent` row | `consent.test.ts` | Unit | Always |

---

## Waveplan Recommendation

The 31 decisions split cleanly into 5 independent waves based on dependency order:

**Wave 1 — Foundation** (no deps on later waves):
- 64-01: Feature flag registry + evaluator override + `requireClassificationFlag` middleware + cron gates (D-01, D-06, D-08, D-10)
- 64-02: Signoff registry + CI dual-gate (D-12, D-13, D-14, D-15)
- 64-03: Prisma schema additions (ClassificationEscalationEvent, SdsApproval, ClassificationDocumentKind, ConsentEvent, Organization.expertReferralEmail) + migration (D-18, D-21, D-25, D-30, D-20b) + new locked phrases (D-16, D-23, D-27, D-29)

**Wave 2 — API layer** (depends on Wave 1 schema + middleware):
- 64-04: New tRPC mutations (logEscalation, approveSds, uploadDrvDecisionLetter, recordToS) + router updates (D-19, D-26, D-31)
- 64-05: Root.ts conditional registration + coverage test (D-05, D-07)

**Wave 3 — UI layer** (depends on Wave 1 + Wave 2):
- 64-06: Route layout.tsx gates + FeatureGate component + sidebar nav entry + bundle hygiene test (D-02, D-03, D-04)
- 64-07: Advisory banner + escalation event firing + Get Expert Help page (D-17, D-19b, D-20)
- 64-08: SDS cover page + approval checkpoint UI + DRV upload panel + DRV unverified disclaimer (D-22, D-24, D-26b)
- 64-09: ToS page extension + TosReacceptanceModal + dashboard layout gate (D-28, D-29b, D-30b)

**Wave 4 — Admin surface** (depends on Wave 1 + Wave 2):
- 64-10: Super-admin flag status page (D-11)

## RESEARCH COMPLETE
