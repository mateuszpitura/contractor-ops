# Phase 2: Contractor Registry - Research

**Researched:** 2026-03-20
**Domain:** Data table CRUD, full-text search, compliance scoring, GUS API integration
**Confidence:** HIGH

## Summary

Phase 2 builds the contractor registry -- the first major data-heavy feature. The core technical challenges are: (1) implementing TanStack Table with server-side pagination, sorting, filtering, and full-text search via PostgreSQL tsvector; (2) building a multi-step wizard form with GUS NIP autofill; (3) implementing compliance health scoring logic; and (4) creating the slide-out side panel and full profile page with 8 tabs.

The existing codebase provides solid foundations: Prisma Contractor model with all fields and indexes already exists, tRPC routers follow a clean pattern with tenant middleware and RBAC permission checks, and the RBAC permission matrix already includes `contractor` resource permissions for all 8 roles. The UI component library (shadcn/ui) has the base components installed; Phase 2 needs additional shadcn blocks (checkbox, popover, calendar, progress, scroll-area, radio-group, collapsible) plus TanStack Table integration.

The GUS BIR1 API is a SOAP service requiring API key registration. The recommended approach is to use the `bir1` npm package (TypeScript, ESM, parses SOAP to JSON) as a server-side tRPC procedure, keeping the API key secure. NIP validation uses a mod-11 checksum algorithm that should be implemented in the shared validators package.

**Primary recommendation:** Use TanStack Table v8 with server-side data fetching via tRPC, PostgreSQL full-text search with a generated tsvector column and GIN index, and the `bir1` package for GUS autofill. Compliance health scoring should be a computed server-side function, not stored -- recalculated on each profile load from live data.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- All 12 columns visible by default: Name/Company, Type, Status, Owner, Billing model, Rate, Currency, Next invoice expected, Team/Project, Contract end date, Last activity, Compliance health badge
- Default sort: Created (newest first)
- Click row -> slide-out side panel with profile summary. "Open" button for full profile page.
- User-configurable column visibility (show/hide dropdown, persisted per user)
- Bulk actions when rows selected: assign owner, export CSV/XLSX, archive, launch workflow
- Pagination with configurable page size (follows density setting from Phase 1)
- Full-text search across name, company, NIP, email (PostgreSQL full-text search)
- Filters: status, owner, team, billing model, contract end date range, compliance health
- Full header on profile: name, company, status chip, type badge, owner avatar, action buttons
- All 8 tabs present from day 1: Overview, Contracts, Documents, Workflows, Invoices, Payments, Activity, Compliance
- Tabs for future phases show placeholder: "Coming in Phase X"
- Overview tab: company details, billing info, active contract summary, health card, key dates
- Compliance tab: full checklist with required docs per type, upload status, expiry dates, missing items highlighted
- Sticky right rail: activity timeline + quick notes
- Multi-step wizard: Step 1 (Company details) -> Step 2 (Billing) -> Step 3 (Assignment)
- Required fields: legal name, type, NIP, email, billing model, currency, rate, owner
- GUS autofill: enter NIP -> auto-fetch company name, address, REGON from Polish GUS registry API
- Multi-factor health calculation: required documents + contract status + overdue tasks + unpaid invoices
- Green/Yellow/Red health scoring
- Required documents per contractor type are configurable by admin in Settings
- Health card on Overview tab with checklist items

### Claude's Discretion
- Exact GUS API integration approach (direct API vs third-party wrapper)
- Side panel width and animation
- Contractor profile URL structure
- Search debounce timing and minimum query length
- Export file format details (column mapping)
- How to handle contractor type change (what happens to required docs)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CONT-01 | User can add a contractor with company details (legal name, NIP, VAT-EU, address, type) | Multi-step wizard with React Hook Form + Zod, GUS autofill via `bir1` package, NIP validation with mod-11 checksum |
| CONT-02 | User can set contractor billing details (bank account, currency, billing model, default rate) | Wizard Step 2, IBAN validation via `ibantools`, rate stored as integer grosze, ContractorBillingProfile model |
| CONT-03 | User can assign a contractor to an internal owner, team, project, and cost center | Wizard Step 3, Select components with server-side search for users/teams/projects, ContractorAssignment model |
| CONT-04 | User can search contractors with full-text search across name, company, NIP, email | PostgreSQL tsvector column with GIN index, `$queryRaw` for search, 300ms debounce |
| CONT-05 | User can filter contractors by status, owner, team, billing model, contract end date, compliance health | TanStack Table column filters with server-side filtering, Popover multi-select components, nuqs for URL state |
| CONT-06 | User can perform bulk actions on contractors (assign owner, export, archive, launch workflow) | TanStack Table row selection, server-side bulk mutations, CSV/XLSX export via `xlsx` package |
| CONT-07 | User can view contractor profile with tabs | Profile page at `/contractors/[id]`, tab routing via query param, Sheet side panel from list |
| CONT-08 | System calculates compliance health score (green/yellow/red) | Server-side computed function checking ComplianceRequirementTemplate + ContractorComplianceItem + contract status |
| CONT-09 | Contractor status follows lifecycle: draft -> onboarding -> active -> offboarding -> inactive -> archived | ContractorLifecycleStage enum already exists in schema, status transition validation in tRPC mutation |

</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-table | 8.21.3 | Headless data table | Server-side pagination, sorting, filtering, column visibility, row selection. The shadcn data-table pattern wraps this. |
| nuqs | 2.8.9 | URL search params state | Type-safe URL state for filters, search, pagination, sort. Shareable URLs. Already in project stack recommendation. |
| bir1 | 4.1.1 | GUS BIR1 API client | TypeScript ESM package, parses SOAP to JSON. Server-side only (tRPC procedure). |
| validate-polish | 2.1.40 | NIP/REGON validation | Lightweight, zero-dependency validation for Polish identification numbers. |
| ibantools | 4.5.1 | IBAN validation | Standard library for IBAN format validation. |
| xlsx | 0.18.5 | Excel export | XLSX/CSV generation for bulk export. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| papaparse | 5.5.3 | CSV export (alternative) | If xlsx bundle size is too large, use papaparse for CSV-only export |
| date-fns | (already available via shadcn calendar) | Date formatting | Contract end date display, relative timestamps in activity timeline |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| bir1 | node-regon | bir1 is newer, TypeScript ESM, actively maintained. node-regon is older (v1.1.0) |
| bir1 | Direct SOAP via `soap` package | More control but significant boilerplate for WSDL handling |
| xlsx | papaparse | papaparse is 10x smaller but CSV-only. xlsx handles both CSV and XLSX formats |
| PostgreSQL FTS | pg_trgm (trigram) | FTS is better for word-based search; trigram better for fuzzy/typo matching. Start with FTS, add trigram later if needed |

**Installation:**
```bash
pnpm add @tanstack/react-table nuqs
pnpm add -w bir1 validate-polish ibantools xlsx
```

Note: `bir1` and `xlsx` go in the API/server package. `validate-polish` and `ibantools` go in the validators package. `@tanstack/react-table` and `nuqs` go in the web app.

## Architecture Patterns

### Recommended Project Structure

```
apps/web/src/
├── app/[locale]/(dashboard)/
│   └── contractors/
│       ├── page.tsx                    # Contractor list page (server component shell)
│       └── [id]/
│           └── page.tsx                # Contractor profile page
├── components/contractors/
│   ├── contractor-table/
│   │   ├── columns.tsx                 # TanStack Table column definitions
│   │   ├── data-table.tsx              # TanStack Table wrapper
│   │   ├── data-table-toolbar.tsx      # Search + filters + bulk actions
│   │   ├── data-table-pagination.tsx   # Pagination controls
│   │   ├── data-table-column-toggle.tsx # Column visibility dropdown
│   │   └── data-table-bulk-actions.tsx # Bulk action toolbar
│   ├── contractor-side-panel.tsx       # Sheet slide-out panel
│   ├── contractor-wizard/
│   │   ├── wizard-dialog.tsx           # Dialog wrapper with step progress
│   │   ├── step-company.tsx            # Step 1: Company details + GUS autofill
│   │   ├── step-billing.tsx            # Step 2: Billing details
│   │   └── step-assignment.tsx         # Step 3: Owner/team/project assignment
│   ├── contractor-profile/
│   │   ├── profile-header.tsx          # Name, status, type, actions
│   │   ├── profile-tabs.tsx            # Tab navigation
│   │   ├── tab-overview.tsx            # Overview tab content
│   │   ├── tab-compliance.tsx          # Compliance tab content
│   │   ├── tab-placeholder.tsx         # "Coming in Phase X" placeholder
│   │   └── right-rail.tsx              # Activity timeline + quick notes
│   └── compliance-health-badge.tsx     # Reusable green/yellow/red badge
packages/api/src/routers/
│   └── contractor.ts                   # Contractor tRPC router
packages/validators/src/
│   └── contractor.ts                   # Contractor Zod schemas
```

### Pattern 1: Server-Side Data Table with tRPC

**What:** TanStack Table in "manual" mode where all pagination, sorting, filtering happens server-side via tRPC queries. URL state managed by nuqs.
**When to use:** Any table with more than ~100 rows or server-side full-text search.
**Example:**

```typescript
// packages/validators/src/contractor.ts
export const contractorListSchema = z.object({
  page: z.number().min(1).default(1),
  pageSize: z.number().min(10).max(50).default(25),
  search: z.string().optional(),
  sortBy: z.enum(["createdAt", "legalName", "status"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  filters: z.object({
    status: z.array(z.nativeEnum(ContractorStatus)).optional(),
    lifecycleStage: z.array(z.nativeEnum(ContractorLifecycleStage)).optional(),
    ownerUserId: z.array(z.string()).optional(),
    primaryTeamId: z.array(z.string()).optional(),
    billingModel: z.array(z.string()).optional(),
    contractEndDateFrom: z.string().datetime().optional(),
    contractEndDateTo: z.string().datetime().optional(),
    complianceHealth: z.array(z.enum(["green", "yellow", "red"])).optional(),
  }).optional(),
});
```

```typescript
// In contractor tRPC router - list procedure
list: tenantProcedure
  .use(requirePermission({ contractor: ["read"] }))
  .input(contractorListSchema)
  .query(async ({ ctx, input }) => {
    const { page, pageSize, search, sortBy, sortOrder, filters } = input;
    const skip = (page - 1) * pageSize;

    // Build where clause
    const where: Prisma.ContractorWhereInput = {
      organizationId: ctx.organizationId,
      ...(filters?.status && { status: { in: filters.status } }),
      ...(filters?.ownerUserId && { ownerUserId: { in: filters.ownerUserId } }),
      // ... other filters
    };

    // Full-text search via raw SQL if search term provided
    // Regular Prisma query for everything else

    const [items, total] = await Promise.all([
      prisma.contractor.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortBy]: sortOrder },
        include: {
          owner: { select: { id: true, name: true, image: true } },
          primaryTeam: { select: { id: true, name: true } },
          billingProfiles: { where: { isDefault: true }, take: 1 },
        },
      }),
      prisma.contractor.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }),
```

### Pattern 2: Multi-Step Wizard with React Hook Form

**What:** A Dialog containing a multi-step form where each step validates independently before advancing. Form state persists across steps using a single React Hook Form instance.
**When to use:** Complex creation flows with many required fields (10+).
**Example:**

```typescript
// Single form schema for all steps, validated per-step
const wizardSchema = z.object({
  // Step 1
  legalName: z.string().min(1),
  type: z.nativeEnum(ContractorType),
  taxId: z.string().refine(val => validatePolish.nip(val), "Invalid NIP"),
  email: z.string().email(),
  // Step 2
  billingModel: z.string().min(1),
  currency: z.string().length(3),
  rateValueGrosze: z.number().positive(),
  bankAccount: z.string().optional().refine(
    val => !val || isValidIBAN(val), "Invalid IBAN"
  ),
  // Step 3
  ownerUserId: z.string().min(1),
  primaryTeamId: z.string().optional(),
});

// Per-step validation
const stepSchemas = [
  wizardSchema.pick({ legalName: true, type: true, taxId: true, email: true }),
  wizardSchema.pick({ billingModel: true, currency: true, rateValueGrosze: true }),
  wizardSchema.pick({ ownerUserId: true }),
];
```

### Pattern 3: Compliance Health Scoring (Computed)

**What:** Health score computed server-side from multiple data sources, not stored as a column. Returns green/yellow/red per factor and an aggregate.
**When to use:** Any multi-factor status that depends on live data from multiple tables.
**Example:**

```typescript
type HealthFactor = {
  key: "documents" | "contract" | "tasks" | "invoices";
  status: "green" | "yellow" | "red";
  label: string;
  detail?: string;
};

function computeComplianceHealth(
  complianceItems: ContractorComplianceItem[],
  activeContract: Contract | null,
  overdueTaskCount: number,
  unpaidInvoiceCount: number,
  requiredTemplates: ComplianceRequirementTemplate[],
): { overall: "green" | "yellow" | "red"; factors: HealthFactor[] } {
  const factors: HealthFactor[] = [];

  // Documents: check required docs satisfied
  const requiredMissing = requiredTemplates.filter(t =>
    !complianceItems.some(i =>
      i.requirementTemplateId === t.id && i.status === "SATISFIED"
    )
  );
  // ... scoring logic per factor

  // Aggregate: red if any factor red, yellow if any yellow, else green
  const overall = factors.some(f => f.status === "red") ? "red"
    : factors.some(f => f.status === "yellow") ? "yellow" : "green";

  return { overall, factors };
}
```

### Pattern 4: PostgreSQL Full-Text Search with Prisma

**What:** A generated tsvector column with GIN index for fast full-text search, queried via Prisma `$queryRaw`.
**When to use:** Full-text search across multiple text columns.
**Implementation approach:**

```sql
-- Migration: Add generated tsvector column
ALTER TABLE "Contractor" ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("legalName", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("displayName", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("taxId", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce("email", '')), 'B')
  ) STORED;

CREATE INDEX "Contractor_search_vector_idx" ON "Contractor" USING GIN ("search_vector");
```

```typescript
// In tRPC router: search with $queryRaw
if (search && search.length >= 2) {
  const searchQuery = search.split(/\s+/).map(w => w + ":*").join(" & ");
  const results = await prisma.$queryRaw`
    SELECT id FROM "Contractor"
    WHERE "organizationId" = ${ctx.organizationId}
      AND "search_vector" @@ to_tsquery('simple', ${searchQuery})
    ORDER BY ts_rank("search_vector", to_tsquery('simple', ${searchQuery})) DESC
    LIMIT ${pageSize} OFFSET ${skip}
  `;
}
```

**Note:** The 'simple' dictionary (not 'polish') is recommended because NIP and email are not natural language. The 'simple' dictionary tokenizes without stemming, which is correct for identifiers. Prefix matching (`:*`) enables search-as-you-type.

### Anti-Patterns to Avoid

- **Client-side filtering on large datasets:** Never fetch all contractors to filter client-side. Always use server-side filtering with TanStack Table in manual mode.
- **Storing compliance health as a column:** Health depends on live data (expiring contracts, new invoices). Computing on read avoids stale cache.
- **Single monolithic form component:** The wizard should have separate step components sharing one form instance, not one 500-line component.
- **Using Prisma `search` mode for FTS:** Prisma's built-in `search` mode uses `LIKE` patterns, not true PostgreSQL full-text search. Use `$queryRaw` for proper tsvector queries.
- **GUS API calls from client:** The GUS API key must never be exposed to the browser. Always proxy through a tRPC mutation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| NIP validation | Custom checksum calculator | `validate-polish` package | Edge cases with leading zeros, special NIP formats |
| IBAN validation | Regex-based IBAN check | `ibantools` package | IBAN has country-specific length rules and check digits |
| Data table | Custom table with sorting/pagination | TanStack Table + shadcn DataTable pattern | Column visibility, row selection, sorting, filtering are deeply interconnected |
| URL state sync | Manual URLSearchParams management | `nuqs` | Handles serialization, history, shallow routing, SSR |
| Excel export | Manual CSV string building | `xlsx` package | Handles encoding, special characters, multi-sheet, column types |
| GUS SOAP API | Raw SOAP XML construction | `bir1` package | WSDL parsing, session management, response parsing already handled |
| Date range picker | Custom calendar component | shadcn Calendar + Popover | Accessible, keyboard-navigable, locale-aware |

**Key insight:** This phase has many "deceptively complex" problems (NIP validation, IBAN validation, SOAP API integration, Excel export) where hand-rolling leads to subtle bugs. Use battle-tested packages for all validation and data format concerns.

## Common Pitfalls

### Pitfall 1: Tenant Data Leakage in Search

**What goes wrong:** Raw SQL queries for full-text search bypass Prisma's tenant scoping extension.
**Why it happens:** `$queryRaw` does not go through Prisma Client Extensions.
**How to avoid:** Always include `WHERE "organizationId" = ${ctx.organizationId}` in every raw query. Create a helper function that enforces this.
**Warning signs:** Search results showing contractors from other organizations in development/testing.

### Pitfall 2: N+1 Queries in Contractor List

**What goes wrong:** Computing compliance health for each contractor in the list triggers separate queries per row.
**Why it happens:** Naive implementation computes health inside a loop.
**How to avoid:** For the list view, precompute a simplified health status (e.g., a single query counting missing compliance items per contractor using GROUP BY). Full health computation only on profile page.
**Warning signs:** List page taking >500ms to load with 50+ contractors.

### Pitfall 3: Form State Loss on Wizard Step Navigation

**What goes wrong:** User fills Step 1, goes to Step 2, goes back to Step 1, and data is lost.
**Why it happens:** Each step component mounts/unmounts and has its own form state.
**How to avoid:** Use a single React Hook Form instance at the wizard level. Steps read/write from the same form. Use `display: none` or conditional rendering that preserves the form registration.
**Warning signs:** Users reporting data loss when navigating between wizard steps.

### Pitfall 4: GUS API Rate Limiting and Timeouts

**What goes wrong:** GUS BIR1 API is slow (2-5 seconds) and has rate limits. Multiple rapid NIP lookups can fail.
**Why it happens:** Government APIs are not designed for high throughput.
**How to avoid:** (1) Show loading spinner on the button, disable NIP field during fetch. (2) Cache successful lookups in memory or short-lived cache. (3) Set a 10-second timeout. (4) Graceful fallback to manual entry on any error.
**Warning signs:** Users seeing repeated timeout errors, or the form feeling "stuck" during GUS fetch.

### Pitfall 5: PostgreSQL Full-Text Search Migration Drift

**What goes wrong:** Prisma migrations don't support generated columns or GIN indexes natively. Custom SQL in migrations can drift from Prisma's understanding of the schema.
**Why it happens:** Prisma schema file cannot express `GENERATED ALWAYS AS` or `USING GIN`.
**How to avoid:** Add the tsvector column and GIN index via a manual SQL migration file (`prisma migrate dev --create-only` then edit). Mark the column as `Unsupported("tsvector")` in the Prisma schema with a comment. Use `prisma db pull` periodically to verify schema alignment.
**Warning signs:** `prisma migrate dev` wanting to drop the search_vector column.

### Pitfall 6: Stale Compliance Health on Status Transitions

**What goes wrong:** Contractor appears "green" in the list but actually has expired documents.
**Why it happens:** List view uses a simplified health check that doesn't account for all factors.
**How to avoid:** The list badge should show a real-time computed value. For performance, batch-compute health for all contractors in a single query using SQL aggregation, not individual computations.
**Warning signs:** Users clicking into a "green" contractor and seeing red items on the compliance tab.

## Code Examples

### TanStack Table Column Definitions

```typescript
// apps/web/src/components/contractors/contractor-table/columns.tsx
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ComplianceHealthBadge } from "../compliance-health-badge";

type ContractorRow = {
  id: string;
  legalName: string;
  displayName: string;
  type: string;
  status: string;
  lifecycleStage: string;
  ownerName: string | null;
  billingModel: string | null;
  rateDisplay: string | null;
  currency: string;
  teamName: string | null;
  contractEndDate: string | null;
  lastActivity: string | null;
  complianceHealth: "green" | "yellow" | "red";
};

export function getColumns(t: (key: string) => string): ColumnDef<ContractorRow>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label={t("selectAll")}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label={t("selectRow")}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "displayName",
      header: t("columns.name"),
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.displayName}</div>
          <div className="text-xs text-muted-foreground">{row.original.legalName}</div>
        </div>
      ),
    },
    // ... remaining 11 columns
    {
      accessorKey: "complianceHealth",
      header: t("columns.health"),
      cell: ({ row }) => (
        <ComplianceHealthBadge health={row.original.complianceHealth} />
      ),
    },
  ];
}
```

### GUS Autofill tRPC Procedure

```typescript
// packages/api/src/routers/contractor.ts
import { Bir } from "bir1";

gusLookup: tenantProcedure
  .use(requirePermission({ contractor: ["create"] }))
  .input(z.object({ nip: z.string().length(10) }))
  .mutation(async ({ input }) => {
    const bir = new Bir();
    await bir.login();
    try {
      const results = await bir.search({ nip: input.nip });
      if (!results || results.length === 0) {
        return { found: false as const };
      }
      const entity = results[0];
      return {
        found: true as const,
        legalName: entity.nazwa,
        regon: entity.regon,
        addressLine1: [entity.ulica, entity.nrNieruchomosci, entity.nrLokalu]
          .filter(Boolean).join(" "),
        city: entity.miejscowosc,
        postalCode: entity.kodPocztowy,
      };
    } finally {
      await bir.logout();
    }
  }),
```

### NIP Validation in Shared Validators

```typescript
// packages/validators/src/contractor.ts
import { z } from "zod";

const NIP_WEIGHTS = [6, 5, 7, 2, 3, 4, 5, 6, 7];

export function isValidNip(nip: string): boolean {
  const cleaned = nip.replace(/[\s-]/g, "");
  if (!/^\d{10}$/.test(cleaned)) return false;

  const digits = cleaned.split("").map(Number);
  const sum = NIP_WEIGHTS.reduce((acc, weight, i) => acc + weight * digits[i], 0);
  return sum % 11 === digits[9];
}

export const nipSchema = z.string()
  .transform(val => val.replace(/[\s-]/g, ""))
  .refine(val => /^\d{10}$/.test(val), "NIP must be 10 digits")
  .refine(isValidNip, "Invalid NIP checksum");
```

### URL State with nuqs for Table Filters

```typescript
// apps/web/src/components/contractors/contractor-table/use-contractor-filters.ts
import { parseAsInteger, parseAsString, parseAsArrayOf, useQueryStates } from "nuqs";

export function useContractorFilters() {
  return useQueryStates({
    page: parseAsInteger.withDefault(1),
    pageSize: parseAsInteger.withDefault(25),
    search: parseAsString.withDefault(""),
    sortBy: parseAsString.withDefault("createdAt"),
    sortOrder: parseAsString.withDefault("desc"),
    status: parseAsArrayOf(parseAsString).withDefault([]),
    owner: parseAsArrayOf(parseAsString).withDefault([]),
    team: parseAsArrayOf(parseAsString).withDefault([]),
    billingModel: parseAsArrayOf(parseAsString).withDefault([]),
    health: parseAsArrayOf(parseAsString).withDefault([]),
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-side table filtering | Server-side with TanStack Table manual mode | TanStack Table v8 (2023+) | Scales to thousands of rows |
| Prisma `search` mode | Raw SQL with tsvector/tsquery | Prisma still preview | Proper ranking, prefix matching, weighted search |
| Storing computed status columns | Computing on read from live data | Modern pattern | No stale data, no cache invalidation complexity |
| Form wizard with separate forms per step | Single React Hook Form across steps | RHF v7+ | No data loss between steps, single submit |
| tRPC v10 useQuery hooks | tRPC v11 queryOptions pattern | March 2025 | Matches existing project pattern (see users-table.tsx) |

## Open Questions

1. **GUS API Key for Production**
   - What we know: GUS BIR1 requires registration at regon_bir@stat.gov.pl. There is a test API with a demo key.
   - What's unclear: How long the API key approval takes, and whether there are usage quotas.
   - Recommendation: Use the test/demo API during development. Store production key in environment variable. Build with graceful fallback so the feature works (with manual entry) even without a valid API key.

2. **Compliance Health Computation Performance at Scale**
   - What we know: Health depends on 4 factors from different tables. Computing for 50 contractors in a list means 4 queries per contractor (200 queries).
   - What's unclear: Exact query count acceptable for list view.
   - Recommendation: Use a single SQL query with JOINs and GROUP BY to compute health for all visible contractors at once. Only compute detailed factors on the profile page.

3. **Contractor Type Change Behavior**
   - What we know: Required documents depend on contractor type (via ComplianceRequirementTemplate.appliesToContractorType).
   - What's unclear: When a contractor type changes, should existing compliance items be removed and regenerated?
   - Recommendation: Keep existing compliance items (don't delete), regenerate the checklist from templates, mark newly required items as MISSING. Show a confirmation dialog when changing type.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (to be set up) |
| Config file | none -- see Wave 0 |
| Quick run command | `pnpm vitest run --reporter=verbose` |
| Full suite command | `pnpm turbo test` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONT-01 | Create contractor with company details | unit + integration | `vitest run packages/validators/src/__tests__/contractor.test.ts` | No -- Wave 0 |
| CONT-02 | Set billing details (IBAN, rate, currency) | unit | `vitest run packages/validators/src/__tests__/contractor.test.ts` | No -- Wave 0 |
| CONT-03 | Assign owner, team, project | integration | `vitest run packages/api/src/__tests__/contractor.test.ts` | No -- Wave 0 |
| CONT-04 | Full-text search across fields | integration | `vitest run packages/api/src/__tests__/contractor-search.test.ts` | No -- Wave 0 |
| CONT-05 | Filter by status, owner, team, etc. | integration | `vitest run packages/api/src/__tests__/contractor-filters.test.ts` | No -- Wave 0 |
| CONT-06 | Bulk actions (assign, export, archive) | unit + integration | `vitest run packages/api/src/__tests__/contractor-bulk.test.ts` | No -- Wave 0 |
| CONT-07 | View profile with tabs | manual-only | Manual browser test | N/A |
| CONT-08 | Compliance health scoring | unit | `vitest run packages/api/src/__tests__/compliance-health.test.ts` | No -- Wave 0 |
| CONT-09 | Lifecycle status transitions | unit | `vitest run packages/api/src/__tests__/contractor-lifecycle.test.ts` | No -- Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm vitest run --reporter=verbose`
- **Per wave merge:** `pnpm turbo test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `vitest.config.ts` at root and per-package -- framework not yet installed
- [ ] `packages/validators/src/__tests__/contractor.test.ts` -- covers CONT-01, CONT-02 (NIP, IBAN, schema validation)
- [ ] `packages/api/src/__tests__/contractor.test.ts` -- covers CONT-03, CONT-04, CONT-05
- [ ] `packages/api/src/__tests__/compliance-health.test.ts` -- covers CONT-08
- [ ] `packages/api/src/__tests__/contractor-lifecycle.test.ts` -- covers CONT-09
- [ ] Framework install: `pnpm add -Dw vitest @vitest/coverage-v8`

## Sources

### Primary (HIGH confidence)
- Existing Prisma schema `packages/db/prisma/schema/contractor.prisma` -- all models, enums, indexes verified
- Existing tRPC patterns `packages/api/src/routers/user.ts` -- router structure, middleware chain, mutation pattern
- Existing UI patterns `apps/web/src/components/settings/users-table.tsx` -- table rendering, i18n, permissions, loading states
- Existing RBAC `apps/web/src/hooks/use-permissions.ts` -- contractor permissions already defined for all 8 roles
- npm registry -- verified versions: @tanstack/react-table 8.21.3, nuqs 2.8.9, bir1 4.1.1, validate-polish 2.1.40, ibantools 4.5.1, xlsx 0.18.5

### Secondary (MEDIUM confidence)
- [GUS BIR1 API Portal](https://api.stat.gov.pl/Home/RegonApi?lang=en) -- official API documentation
- [bir1 npm package](https://www.npmjs.com/package/bir1) -- TypeScript GUS client
- [PostgreSQL FTS with Prisma](https://www.pedroalonso.net/blog/postgres-full-text-search/) -- tsvector + raw query pattern
- [Prisma FTS docs (Preview)](https://www.prisma.io/docs/orm/prisma-client/queries/full-text-search) -- confirms raw SQL needed for advanced FTS
- [validate-polish npm](https://www.npmjs.com/package/validate-polish) -- NIP validation library
- [NIP checksum algorithm](https://gist.github.com/amadeuszblanik/d76b029b2b16e44e507c555dbc8edaf5) -- mod-11 weights verified

### Tertiary (LOW confidence)
- GUS API key approval timeline -- no official SLA documented
- bir1 production stability -- package is relatively new (v4.1.1), limited download numbers

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages verified in npm registry with current versions, TanStack Table and nuqs already in project stack recommendations
- Architecture: HIGH -- patterns derived from existing codebase (tRPC routers, React Hook Form, shadcn components) and established TanStack Table patterns
- Pitfalls: HIGH -- based on analysis of existing tenant scoping, Prisma extension limitations, and FTS migration patterns
- GUS integration: MEDIUM -- bir1 package verified but production API key process and rate limits uncertain

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (30 days -- stable domain, no fast-moving dependencies)
